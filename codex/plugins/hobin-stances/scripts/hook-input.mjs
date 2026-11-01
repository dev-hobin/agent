// Shared by the hobin plugin hooks on Claude Code and Codex. A hook checks the results its skill
// writes: on PostToolUse, the files that tool call wrote; on Stop, every Markdown file under the
// project changed since the session started, however it was written (an edit tool or a shell
// command). `check(file, text)` returns null for a file that is not one of the skill's results,
// otherwise its problems. Problems go back to the model with exit 2. Stop lets the model finish
// after three blocks in a row, so a check that cannot pass never traps the session. Any
// unexpected error exits 0: a hook never fails the user's work because of itself.
import { readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const MAX_BLOCKS = 3;
const SKIP = new Set(["node_modules", ".git"]);

// Files a PostToolUse input says were written: Claude's tool_input.file_path, or the paths in a
// Codex apply_patch (`*** Add File:`, `*** Update File:`, `*** Move to:`).
export function writtenFiles(input, root) {
	const direct = input?.tool_input?.file_path;
	if (typeof direct === "string") return [resolve(root, direct)];
	const patch = input?.tool_input?.command;
	const text = Array.isArray(patch) ? patch.join("\n") : typeof patch === "string" ? patch : "";
	return [...text.matchAll(/^\*\*\* (?:Add File|Update File|Move to): (.+)$/gm)].map((m) => resolve(input?.cwd ?? root, m[1].trim()));
}

// Markdown files under root changed at or after the session transcript was created. Without a
// transcript there is no session start to compare with, so nothing is checked.
export function sessionFiles(root, input) {
	let since;
	try { const t = statSync(input.transcript_path); since = t.birthtimeMs || t.ctimeMs; } catch { return []; }
	const walk = (dir, depth) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) return depth < 6 && !SKIP.has(entry.name) ? walk(path, depth + 1) : [];
		return entry.name.endsWith(".md") && statSync(path).mtimeMs >= since ? [path] : [];
	});
	return walk(root, 0);
}

export async function runHook(name, check) {
	try {
		const input = JSON.parse(readFileSync(0, "utf8"));
		// The project root: on Claude Code, input.cwd follows the model's `cd` in Bash.
		const root = process.env.CLAUDE_PROJECT_DIR ?? input.cwd ?? process.cwd();
		process.chdir(root);
		const stop = input.hook_event_name === "Stop";
		const problems = [];
		for (const file of stop ? sessionFiles(root, input) : writtenFiles(input, root)) {
			let text;
			try { text = readFileSync(file, "utf8"); } catch { continue; }
			const found = await check(file, text);
			if (found?.length) problems.push(`${file}:\n${found.map((p) => `- ${p}`).join("\n")}`);
		}
		const counter = join(tmpdir(), `hobin-${name}-stop-${String(input.session_id ?? "session").replace(/[^\w-]/g, "")}`);
		if (!problems.length) { if (stop) rmSync(counter, { force: true }); process.exit(0); }
		if (stop) {
			let blocks = 0;
			try { blocks = Number(readFileSync(counter, "utf8")) || 0; } catch {}
			if (blocks >= MAX_BLOCKS) { rmSync(counter, { force: true }); process.exit(0); }
			writeFileSync(counter, String(blocks + 1));
		}
		console.error(`${problems.join("\n")}\nFix ${problems.length === 1 ? "this result" : "these results"} before finishing.`);
		process.exit(2);
	} catch {
		process.exit(0);
	}
}
