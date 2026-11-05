// Shared by the hobin result hooks (review, stances, learning) on Claude Code and Codex. A hook
// checks the results its skill writes; `check(file, text)` returns null for a file that is not
// one of the skill's results, otherwise its problems (an empty list when it passes).
//
// Which results are this session's comes from a ledger the session's own tool calls fill, never
// from file times: a checkout, a worktree, or another session's writes under the same folder are
// not this session's results.
// - PostToolUse of an edit tool (Write/Edit/MultiEdit, a Codex apply_patch) checks the files it
//   wrote and records the results among them.
// - A shell command that names a Markdown file (results are Markdown) is checked the same way on
//   PostToolUse (or PostToolUseFailure, Claude's event for a command that exited non-zero): the
//   .md files it names, found by name under its cwd too, changed since PreToolUse stamped the same
//   call (by tool_use_id). Without a usable stamp, only the files it names that changed after the
//   session started. A file git tracks and still holds as committed from before the call was
//   written by git (a checkout, a worktree, a pull), not by the session, and does not count.
// - Stop checks only the ledger's results. Problems go back to the model with exit 2; Stop lets
//   the model finish after three blocks in a row, so a check that cannot pass never traps the
//   session. A check that throws is the hook's own failure: exit 1, shown to the user, never sent
//   to the model. Any other unexpected error exits 0: a hook never fails the user's work because
//   of itself.
import { appendFileSync, existsSync, lstatSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";

const MAX_BLOCKS = 3;
// File systems with one-second mtimes round a write in the stamp's second down below the stamp.
const SLACK_MS = 1000;
const MENTIONS = /\.md\b/i;
const NAMED = /[^\s"'`;|&<>()=]+\.md\b/gi;
const MARKDOWN = /\.md$/i;

const safe = (value) => String(value ?? "").replace(/[^\w-]/g, "");
const mtime = (path) => { try { return statSync(path).mtimeMs; } catch { return -Infinity; } };

function sessionStart(input) {
	try { const t = statSync(input.transcript_path); return t.birthtimeMs || t.ctimeMs; } catch { return undefined; }
}

// Codex sends file edits as apply_patch text in tool_input.command; any other command is a shell
// command. Claude's edit tools carry tool_input.file_path.
function commandText(input) {
	const command = input?.tool_input?.command;
	return Array.isArray(command) ? command.join(" ") : typeof command === "string" ? command : "";
}
const isPatch = (input, text) => input?.tool_name === "apply_patch" || text.trimStart().startsWith("*** Begin Patch");
const isShell = (input) => {
	const text = commandText(input);
	return typeof input?.tool_input?.file_path !== "string" && Boolean(text) && !isPatch(input, text);
};

// Files an edit tool wrote: Claude's tool_input.file_path, or the paths in a Codex apply_patch
// (`*** Add File:`, `*** Update File:`, `*** Move to:`).
export function writtenFiles(input, root) {
	const direct = input?.tool_input?.file_path;
	if (typeof direct === "string") return [resolve(root, direct)];
	return [...commandText(input).matchAll(/^\*\*\* (?:Add File|Update File|Move to): (.+)$/gm)].map((m) => resolve(input?.cwd ?? root, m[1].trim()));
}

// Markdown files under dir. Symbolic links are not followed and an entry that cannot be read is
// skipped, so one dangling link or locked folder never stops the walk.
export function markdownFiles(dir) {
	let entries;
	try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return []; }
	return entries.flatMap((entry) => {
		if (entry.name === "node_modules" || entry.name.startsWith(".git") || entry.isSymbolicLink()) return [];
		const path = join(dir, entry.name);
		if (entry.isDirectory()) return markdownFiles(path);
		if (!MARKDOWN.test(entry.name)) return [];
		if (entry.isFile()) return [path];
		try { return lstatSync(path).isFile() ? [path] : []; } catch { return []; }
	});
}

// A file git tracks, still holds as committed, and last committed before `since` was written by
// git (a checkout, a worktree, a pull), not by the session. A commit made since then may be the
// session's own (a write and a commit in one command), so its files count. Outside a git
// repository, or when git cannot tell, a file counts.
export function checkedOut(path, since) {
	const git = (...args) => spawnSync("git", ["-C", dirname(path), ...args], { encoding: "utf8" });
	const status = git("status", "--porcelain", "--ignored=matching", "--untracked-files=all", "--", basename(path));
	if (status.status !== 0 || status.stdout !== "") return false;
	const committed = Number(git("log", "-1", "--format=%ct", "--", basename(path)).stdout.trim());
	return committed > 0 && committed * 1000 < since;
}

// Markdown files a shell command wrote, judged by the stamp of the same call: the files it names,
// found by name under its cwd too (so `cd docs && cat > REVIEW.md` counts), changed since the
// stamp. Unnamed files under the cwd are never the command's: another session may be writing them.
export function shellFiles(input, root, stamp) {
	const text = commandText(input);
	if (!MENTIONS.test(text)) return [];
	const cwd = input?.cwd ?? root;
	const tokens = [...text.matchAll(NAMED)].map((m) => m[0].replace(/^~(?=\/)/, process.env.HOME ?? "~"));
	const named = tokens.map((token) => resolve(cwd, token));
	if (stamp === undefined) {
		const start = sessionStart(input);
		return start === undefined ? [] : named.filter((path) => mtime(path) >= start - SLACK_MS && !checkedOut(path, start - SLACK_MS));
	}
	const suffixes = tokens.filter((token) => !isAbsolute(token)).map((token) => `/${token.replace(/^(?:\.\.?\/)+/, "")}`);
	const found = suffixes.length ? markdownFiles(cwd).filter((path) => suffixes.some((suffix) => path.endsWith(suffix))) : [];
	return [...new Set([...named, ...found])].filter((path) => mtime(path) >= stamp - SLACK_MS && !checkedOut(path, stamp - SLACK_MS));
}

// A stamp needs the call's id: without one, calls would share a stamp and a stale one would date
// a later call. Anything but a positive time not in the future is no stamp at all.
function readStamp(file) {
	let text;
	try { text = readFileSync(file, "utf8").trim(); } catch { return undefined; }
	const stamp = /^\d+$/.test(text) ? Number(text) : NaN;
	return stamp > 0 && stamp <= Date.now() ? stamp : undefined;
}

export async function runHook(name, check) {
	try {
		const input = JSON.parse(readFileSync(0, "utf8"));
		// The project root: on Claude Code, input.cwd follows the model's `cd` in Bash.
		const root = process.env.CLAUDE_PROJECT_DIR ?? input.cwd ?? process.cwd();
		process.chdir(root);
		const event = input.hook_event_name;
		const session = input.session_id ? safe(input.session_id) : undefined;
		const temp = (kind, ...parts) => join(tmpdir(), `hobin-${name}-${kind}-${[session, ...parts].map(safe).join("-")}`);
		const useId = typeof input.tool_use_id === "string" && input.tool_use_id ? input.tool_use_id : undefined;
		const stampFile = session && useId ? temp("pre", useId) : undefined;
		const ledger = session ? temp("ledger") : undefined;

		if (event === "PreToolUse") {
			if (stampFile && isShell(input) && MENTIONS.test(commandText(input))) writeFileSync(stampFile, String(Date.now()));
			process.exit(0);
		}
		let files;
		if (event === "Stop") {
			if (!ledger) process.exit(0);
			try { files = readFileSync(ledger, "utf8").split("\n").filter(Boolean); } catch { files = []; }
		} else if (isShell(input)) {
			const stamp = stampFile ? readStamp(stampFile) : undefined;
			if (stampFile) rmSync(stampFile, { force: true });
			files = shellFiles(input, root, stamp);
		} else {
			files = writtenFiles(input, root);
		}

		const problems = [];
		const errors = [];
		const results = [];
		for (const file of [...new Set(files)]) {
			let text;
			try { text = readFileSync(file, "utf8"); } catch { continue; }
			let found;
			try { found = await check(file, text); } catch (error) { errors.push(`${file}: ${error?.stack ?? error}`); continue; }
			if (found == null) continue;
			results.push(file);
			if (found.length) problems.push(`${file}:\n${found.map((p) => `- ${p}`).join("\n")}`);
		}
		if (ledger && event !== "Stop" && results.length) appendFileSync(ledger, results.map((file) => `${file}\n`).join(""));

		const counter = session && temp("stop");
		if (!problems.length) {
			if (event === "Stop" && counter) rmSync(counter, { force: true });
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
