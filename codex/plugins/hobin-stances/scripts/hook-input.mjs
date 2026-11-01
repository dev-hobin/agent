// Files a Codex PostToolUse hook input says were written: the paths named in an apply_patch
// (`*** Add File:`, `*** Update File:`, `*** Move to:`), or `tool_input.file_path` when present.
// Relative paths resolve against the session's working directory.
import { resolve } from "node:path";

export function writtenFiles(input) {
	const cwd = input?.cwd ?? process.cwd();
	const direct = input?.tool_input?.file_path;
	if (typeof direct === "string") return [resolve(cwd, direct)];
	const patch = input?.tool_input?.command;
	const text = Array.isArray(patch) ? patch.join("\n") : typeof patch === "string" ? patch : "";
	return [...text.matchAll(/^\*\*\* (?:Add File|Update File|Move to): (.+)$/gm)].map((m) => resolve(cwd, m[1].trim()));
}
