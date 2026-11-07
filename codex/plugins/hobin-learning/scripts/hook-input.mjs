// Shared by the hobin result hooks (review, stances, learning) on Claude Code and Codex; hooks.json
// names the host as the first argument. A hook checks the results its skill writes with
// `check(file, text, registered)`: its problems (an empty list when the result passes), or null
// for a file that is not one of the skill's results. A registered file is a result: it is judged,
// never null.
//
// Which results are this session's comes only from the session registry (session-registry.mjs),
// <start dir>/.hobin-<name>/sessions/<session_id>.jsonl:
// - SessionStart creates it in the event's cwd and remembers that start directory in the plugin
//   data directory. If SessionStart was missed (the plugin enabled mid-session), UserPromptSubmit
//   creates it in the project directory (Claude: CLAUDE_PROJECT_DIR; Codex: the event cwd). Later
//   events never locate it from their own cwd: on Claude Code the hook cwd follows the model's `cd`.
// - The skill's scripts register the result they make or check, and stop when the session has no
//   registry, so a session whose hooks do not run is told so at once.
// - PostToolUse of an edit tool (Claude Write/Edit/MultiEdit tool_input.file_path; Codex
//   apply_patch `*** Add File:`, `*** Update File:`, `*** Move to:`) checks the files it wrote and
//   registers the results among them; problems go back at once.
// - Stop checks exactly the files the registry lists; a listed file that no longer exists is
//   reported. Nothing searches directories, and nothing is inferred from shell text, command
//   output, file times or transcripts.
// - SessionEnd deletes the session's registry and state. Stop prunes week-old registries in the
//   start directory and week-old state.
// Problems go back to the model with exit 2; Stop lets the model finish after three blocks in a
// row, so a check that cannot pass never traps the session. A check that throws is the hook's own
// failure: exit 1, shown to the user, never sent to the model. Any other unexpected error exits 0:
// a hook never fails the user's work because of itself.
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const MAX_BLOCKS = 3;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const EDIT_TOOLS = new Set(["Write", "Edit", "MultiEdit"]);
const PATCHED = /^\*\*\* (?:Add File|Update File|Move to): (.+)$/gm;
const here = dirname(fileURLToPath(import.meta.url));
const host = process.argv[2] === "codex" ? "codex" : "claude";
const safe = (value) => String(value ?? "").replace(/[^\w-]/g, "");

// The shared session registry (core/shared/scripts/session-registry.mjs), copied next to this file
// or next to the scripts of a skill that registers results.
function registryModule() {
	let skills = [];
	try { skills = readdirSync(join(here, "../skills")).sort(); } catch {}
	const path = [join(here, "session-registry.mjs"), ...skills.map((skill) => join(here, "../skills", skill, "scripts/session-registry.mjs"))].find(existsSync);
	return import(pathToFileURL(path).href);
}

// The session's state (start directory, Stop block counter) in the host's plugin data directory
// (CLAUDE_PLUGIN_DATA on Claude Code; PLUGIN_DATA or CLAUDE_PLUGIN_DATA on Codex), or the OS temp
// directory when the host gives none.
function sessionState(name, session) {
	const dir = join(process.env.CLAUDE_PLUGIN_DATA || process.env.PLUGIN_DATA || tmpdir(), `hobin-${name}-sessions`);
	mkdirSync(dir, { recursive: true });
	const path = (kind) => join(dir, `${kind}-${safe(session)}`);
	return {
		path,
		start: () => { try { return readFileSync(path("start"), "utf8").trim() || undefined; } catch { return undefined; } },
		remember: (start) => writeFileSync(path("start"), start),
		clear: () => { for (const kind of ["start", "stop"]) rmSync(path(kind), { force: true }); },
		prune: (now = Date.now()) => {
			for (const file of readdirSync(dir)) {
				try { if (now - statSync(join(dir, file)).mtimeMs > WEEK_MS) rmSync(join(dir, file), { force: true }); } catch {}
			}
		},
	};
}

// The files an edit tool wrote, from its structured input only.
function editedFiles(input, cwd) {
	if (EDIT_TOOLS.has(input?.tool_name)) {
		const path = input?.tool_input?.file_path;
		return typeof path === "string" && path ? [resolve(cwd, path)] : [];
	}
	if (input?.tool_name !== "apply_patch") return [];
	const command = input?.tool_input?.command;
	const text = Array.isArray(command) ? command.join(" ") : typeof command === "string" ? command : "";
	return [...new Set([...text.matchAll(PATCHED)].map((m) => resolve(cwd, m[1].trim())))];
}

export async function runHook(name, check) {
	try {
		const input = JSON.parse(readFileSync(0, "utf8"));
		const event = input.hook_event_name;
		const session = typeof input.session_id === "string" && input.session_id ? input.session_id : undefined;
		const cwd = resolve(typeof input.cwd === "string" && input.cwd ? input.cwd : process.cwd());
		const edited = event === "PostToolUse" ? editedFiles(input, cwd) : [];
		if (!["SessionStart", "UserPromptSubmit", "Stop", "SessionEnd"].includes(event) && !edited.length) process.exit(0);
		if (!session && event !== "PostToolUse") process.exit(0);

		const { ensureRegistry, pruneRegistries, register, registered, registryPath, removeRegistry } = await registryModule();
		const state = session && sessionState(name, session);
		const registry = (startDir) => ({ name: `.hobin-${name}`, sessionId: session, startDir });
		if (event === "SessionEnd") {
			const start = state.start();
			if (start) removeRegistry(registry(start));
			state.clear();
			process.exit(0);
		}
		if (event === "SessionStart") {
			state.remember(cwd);
			ensureRegistry(registry(cwd));
			process.exit(0);
		}
		// The start directory: remembered at SessionStart; otherwise the project directory, remembered
		// from then on. Results are checked from there (a review cites files from the project root).
		const project = host === "claude" && process.env.CLAUDE_PROJECT_DIR ? resolve(process.env.CLAUDE_PROJECT_DIR) : cwd;
		const remembered = state ? state.start() : undefined;
		const start = remembered ?? project;
		if (state && !remembered) state.remember(start);
		process.chdir(start);
		if (event === "UserPromptSubmit") {
			ensureRegistry(registry(start));
			process.exit(0);
		}

		const listed = session ? registered(registryPath(registry(start))) : [];
		if (event === "Stop") { state.prune(); pruneRegistries({ name: `.hobin-${name}`, startDir: start }); }
		const files = event === "Stop" ? listed : edited;
		const problems = [];
		const errors = [];
		const results = [];
		for (const file of files) {
			let text;
			try { text = readFileSync(file, "utf8"); } catch {
				if (event === "Stop") problems.push(`${file}:\n- this session registered it as a result, but it no longer exists. Restore it, or write the result again from the skill's starter script.`);
				continue;
			}
			let found;
			try { found = await check(file, text, listed.includes(file)); } catch (error) { errors.push(`${file}: ${error?.stack ?? error}`); continue; }
			if (found == null) continue;
			results.push(file);
			if (found.length) problems.push(`${file}:\n${found.map((p) => `- ${p}`).join("\n")}`);
		}
		const added = results.filter((file) => !listed.includes(file));
		if (session && added.length) {
			const path = ensureRegistry(registry(start));
			for (const file of added) register(path, file);
		}

		const counter = session && state.path("stop");
		if (!problems.length) {
			if (event === "Stop") rmSync(counter, { force: true });
			if (!errors.length) process.exit(0);
			console.error(`hobin-${name} hook internal error (not a problem in the result; the model was not sent back):\n${errors.join("\n")}`);
			process.exit(1);
		}
		if (event === "Stop") {
			let blocks = 0;
			try { blocks = Number(readFileSync(counter, "utf8")) || 0; } catch {}
			if (blocks >= MAX_BLOCKS) { rmSync(counter, { force: true }); process.exit(0); }
			writeFileSync(counter, String(blocks + 1));
		}
		const internal = errors.length ? `\nThe hook could not check these (its own error, not yours):\n${errors.join("\n")}` : "";
		console.error(`${problems.join("\n")}${internal}\nFix ${problems.length === 1 ? "this result" : "these results"} before finishing.`);
		process.exit(2);
	} catch {
		process.exit(0);
	}
}
