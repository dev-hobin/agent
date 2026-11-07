// A session registry: the files an agent session made or ran, so that a plugin's hooks can check
// exactly those. It is a JSON-lines file, <start dir>/<name>/sessions/<session id>.jsonl, one line
// {"file": "<absolute path>", "at": "<time>"} per registration, append only. <name> is the caller's
// folder (for example ".my-plugin"); <name>/.gitignore holds `*` so the work tree shows nothing.
//
// A hook creates the registry where the session started (ensureRegistry) and reads it
// (registered). A script run in the session's shell finds it from its working directory upward
// with the session id the host gives shell commands (sessionId, registryFor) and appends to it
// (register). The host-specific part is only the session variable: CLAUDE_CODE_SESSION_ID on Claude
// Code and CODEX_SESSION_ID on Codex, each equal to the session_id the host gives its hooks.
//
// A hook gets one call's view of its session from hookSession, which holds the lifecycle rules every
// hook shares (see there); what a hook checks at Stop, and what it says, stays in the hook.
import { accessSync, appendFileSync, constants, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";

export const SESSION_ENV = ["CLAUDE_CODE_SESSION_ID", "CODEX_SESSION_ID"];

// The agent session ids in a shell command's environment. Usually one; more when one host was
// started from the other's shell (Codex run in a Claude Code terminal inherits
// CLAUDE_CODE_SESSION_ID), so callers look for the registry of each.
export function sessionIds(env = process.env) {
	return [...new Set(SESSION_ENV.map((name) => env[name]).filter((id) => typeof id === "string" && id.trim()).map((id) => id.trim()))];
}

const safe = (value) => String(value ?? "").replace(/[^\w-]/g, "");
export const registryPath = ({ name, sessionId, startDir }) => join(startDir, name, "sessions", `${safe(sessionId)}.jsonl`);

// Creates the registry if it is missing (never truncates one) and returns its path.
export function ensureRegistry({ name, sessionId, startDir }) {
	const path = registryPath({ name, sessionId, startDir });
	mkdirSync(dirname(path), { recursive: true });
	const ignore = join(startDir, name, ".gitignore");
	if (!existsSync(ignore)) writeFileSync(ignore, "*\n");
	writeFileSync(path, "", { flag: "a" });
	return path;
}

// The writable registry of `sessionId` in `cwd` or the nearest parent holding one, or undefined.
export function registryFor({ name, sessionId, cwd = process.cwd() }) {
	for (let dir = resolve(cwd); ; dir = dirname(dir)) {
		const path = registryPath({ name, sessionId, startDir: dir });
		if (existsSync(path)) {
			try { accessSync(path, constants.W_OK); return path; } catch { return undefined; }
		}
		if (dir === dirname(dir)) return undefined;
	}
}

// Appends `file` (made absolute) to the registry.
export function register(path, file, at = new Date().toISOString()) {
	appendFileSync(path, `${JSON.stringify({ file: resolve(file), at })}\n`);
}

// The distinct absolute paths the registry lists, in first-registered order.
export function registered(path) {
	let text;
	try { text = readFileSync(path, "utf8"); } catch { return []; }
	const files = text.split("\n").flatMap((line) => {
		try { const { file } = JSON.parse(line); return typeof file === "string" && isAbsolute(file) ? [file] : []; } catch { return []; }
	});
	return [...new Set(files)];
}

export function removeRegistry({ name, sessionId, startDir }) {
	rmSync(registryPath({ name, sessionId, startDir }), { force: true });
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// Removes registries in `startDir` not written for `maxAgeMs` (sessions that never ended cleanly).
export function pruneRegistries({ name, startDir, maxAgeMs = WEEK_MS, now = Date.now() }) {
	const dir = join(startDir, name, "sessions");
	let names;
	try { names = readdirSync(dir); } catch { return; }
	for (const file of names) {
		try { if (now - statSync(join(dir, file)).mtimeMs > maxAgeMs) rmSync(join(dir, file), { force: true }); } catch {}
	}
}

const EDIT_TOOLS = new Set(["Write", "Edit", "MultiEdit"]);
const PATCHED = /^\*\*\* (?:Add File|Update File|Move to): (.+)$/gm;

// One hook call's view of its session, from the hook's stdin `input`, the registry folder `name`
// and the `host` ("claude" or "codex") hooks.json names. The rules every hook shares:
// - The start directory is the SessionStart event's cwd, remembered in the session's state (begin).
//   If SessionStart was missed (the plugin enabled mid-session), it is the project directory
//   (Claude Code: CLAUDE_PROJECT_DIR; Codex: the event cwd), remembered from then on (start). A later
//   event's cwd never moves it: on Claude Code the hook cwd follows the model's `cd`.
// - The files an edit tool wrote come from its structured input only: Claude Write, Edit and
//   MultiEdit tool_input.file_path; Codex apply_patch `*** Add File:`, `*** Update File:` and
//   `*** Move to:` (editedFiles), resolved against the event's cwd.
// - Lifecycle: SessionStart begin(); UserPromptSubmit ensure(); SessionEnd end() removes the
//   registry and clears the session's state; Stop prune() removes week-old state and registries.
// - The session's state is files <kind>-<session id> in the host's plugin data directory
//   (CLAUDE_PLUGIN_DATA on Claude Code; PLUGIN_DATA or CLAUDE_PLUGIN_DATA on Codex), or the OS temp
//   directory when the host gives none, under <name without its dot>-sessions: the start directory,
//   the Stop block counter (blocks, block, unblock) and any kind a hook keeps (statePath).
// Without a session id there is no registry or state: start() is the project directory, registered()
// is empty and registerFiles does nothing.
export function hookSession(input, { name, host, env = process.env }) {
	const id = typeof input?.session_id === "string" && input.session_id ? input.session_id : undefined;
	const cwd = resolve(typeof input?.cwd === "string" && input.cwd ? input.cwd : process.cwd());
	const stateDir = join(env.CLAUDE_PLUGIN_DATA || env.PLUGIN_DATA || tmpdir(), `${name.replace(/^\./, "")}-sessions`);
	const fileOf = (kind) => join(stateDir, `${kind}-${safe(id)}`);
	const read = (kind) => { try { return readFileSync(fileOf(kind), "utf8").trim() || undefined; } catch { return undefined; } };
	const at = (startDir) => ({ name, sessionId: id, startDir });
	let start;
	const session = {
		id,
		// The state file of `kind` for this session (its folder created).
		statePath(kind) {
			mkdirSync(stateDir, { recursive: true });
			return fileOf(kind);
		},
		start() {
			if (start) return start;
			start = id ? read("start") : undefined;
			if (!start) {
				start = host === "claude" && env.CLAUDE_PROJECT_DIR ? resolve(env.CLAUDE_PROJECT_DIR) : cwd;
				if (id) writeFileSync(session.statePath("start"), start);
			}
			return start;
		},
		// SessionStart: the event's cwd is the start directory; the registry is created there.
		begin() {
			start = cwd;
			writeFileSync(session.statePath("start"), cwd);
			return ensureRegistry(at(cwd));
		},
		ensure: () => ensureRegistry(at(session.start())),
		registered: () => (id ? registered(registryPath(at(session.start()))) : []),
		registerFiles(files) {
			if (!id || !files.length) return;
			const path = session.ensure();
			for (const file of files) register(path, file);
		},
		editedFiles() {
			if (EDIT_TOOLS.has(input?.tool_name)) {
				const path = input?.tool_input?.file_path;
				return typeof path === "string" && path ? [resolve(cwd, path)] : [];
			}
			if (input?.tool_name !== "apply_patch") return [];
			const command = input?.tool_input?.command;
			const text = Array.isArray(command) ? command.join(" ") : typeof command === "string" ? command : "";
			return [...new Set([...text.matchAll(PATCHED)].map((m) => resolve(cwd, m[1].trim())))];
		},
		// Stop blocks in a row; what a hook does at its limit stays in the hook.
		blocks: () => Number(read("stop")) || 0,
		block: () => writeFileSync(session.statePath("stop"), String(session.blocks() + 1)),
		unblock: () => rmSync(fileOf("stop"), { force: true }),
		// SessionEnd: removes the registry in the remembered start directory (never a fallback) and the
		// state files start, stop and `kinds`.
		end(...kinds) {
			const known = id ? read("start") : undefined;
			if (known) removeRegistry(at(known));
			for (const kind of ["start", "stop", ...kinds]) rmSync(fileOf(kind), { force: true });
		},
		// State files of any session not written for a week.
		pruneState(now = Date.now()) {
			let files;
			try { files = readdirSync(stateDir); } catch { return; }
			for (const file of files) {
				try { if (now - statSync(join(stateDir, file)).mtimeMs > WEEK_MS) rmSync(join(stateDir, file), { force: true }); } catch {}
			}
		},
		// Stop: week-old state, then week-old registries in the start directory.
		prune() {
			session.pruneState();
			pruneRegistries({ name, startDir: session.start() });
		},
	};
	return session;
}
