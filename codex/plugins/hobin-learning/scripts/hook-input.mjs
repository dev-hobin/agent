// Shared by the hobin result hooks (review, stances, learning) on Claude Code and Codex; hooks.json
// names the host as the first argument. A hook checks the results its skill writes with
// `check(file, text, registered)`: its problems (an empty list when the result passes), or null
// for a file that is not one of the skill's results. A registered file is a result: it is judged,
// never null.
//
// Which results are this session's comes only from the session registry,
// <start dir>/.hobin-<name>/sessions/<session_id>.jsonl. Its lifecycle (the start directory,
// edit-tool paths, SessionStart/UserPromptSubmit/SessionEnd, pruning at Stop, the state in the
// plugin data directory) is session-registry.mjs's hookSession, shared with hobin-feature's hook.
// - The skill's scripts register the result they make or check, and stop when the session has no
//   registry, so a session whose hooks do not run is told so at once.
// - PostToolUse of an edit tool checks the files it wrote and registers the results among them;
//   problems go back at once.
// - Stop checks exactly the files the registry lists; a listed file that no longer exists is
//   reported. Nothing searches directories, and nothing is inferred from shell text, command
//   output, file times or transcripts.
// Problems go back to the model with exit 2; Stop lets the model finish after three blocks in a
// row, so a check that cannot pass never traps the session. A check that throws is the hook's own
// failure: exit 1, shown to the user, never sent to the model. Any other unexpected error exits 0:
// a hook never fails the user's work because of itself.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const MAX_BLOCKS = 3;
const here = dirname(fileURLToPath(import.meta.url));
const host = process.argv[2] === "codex" ? "codex" : "claude";

// The shared session registry (core/shared/scripts/session-registry.mjs), copied next to this file
// or next to the scripts of a skill that registers results.
function registryModule() {
	let skills = [];
	try { skills = readdirSync(join(here, "../skills")).sort(); } catch {}
	const path = [join(here, "session-registry.mjs"), ...skills.map((skill) => join(here, "../skills", skill, "scripts/session-registry.mjs"))].find(existsSync);
	return import(pathToFileURL(path).href);
}

export async function runHook(name, check) {
	try {
		const input = JSON.parse(readFileSync(0, "utf8"));
		const event = input.hook_event_name;
		const { hookSession } = await registryModule();
		const session = hookSession(input, { name: `.hobin-${name}`, host });
		const edited = event === "PostToolUse" ? session.editedFiles() : [];
		if (!["SessionStart", "UserPromptSubmit", "Stop", "SessionEnd"].includes(event) && !edited.length) process.exit(0);
		if (!session.id && event !== "PostToolUse") process.exit(0);

		if (event === "SessionEnd") {
			session.end();
			process.exit(0);
		}
		if (event === "SessionStart") {
			session.begin();
			process.exit(0);
		}
		// Results are checked from the start directory (a review cites files from the project root).
		process.chdir(session.start());
		if (event === "UserPromptSubmit") {
			session.ensure();
			process.exit(0);
		}

		const listed = session.registered();
		if (event === "Stop") session.prune();
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
		session.registerFiles(results.filter((file) => !listed.includes(file)));

		if (!problems.length) {
			if (event === "Stop") session.unblock();
			if (!errors.length) process.exit(0);
			console.error(`hobin-${name} hook internal error (not a problem in the result; the model was not sent back):\n${errors.join("\n")}`);
			process.exit(1);
		}
		if (event === "Stop") {
			if (session.blocks() >= MAX_BLOCKS) { session.unblock(); process.exit(0); }
			session.block();
		}
		const internal = errors.length ? `\nThe hook could not check these (its own error, not yours):\n${errors.join("\n")}` : "";
		console.error(`${problems.join("\n")}${internal}\nFix ${problems.length === 1 ? "this result" : "these results"} before finishing.`);
		process.exit(2);
	} catch {
		process.exit(0);
	}
}
