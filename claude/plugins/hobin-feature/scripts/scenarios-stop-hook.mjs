#!/usr/bin/env node
// Stop hook, the same script on Claude Code and Codex: when this session wrote an
// acceptance-scenario or control decision record (a record under the project changed after the
// session transcript was created), the model may finish only when `scenarios.mjs check` and
// `compile-control-model.mjs --gate` pass (G6, G7). While either fails, exit 2 sends the problems
// back so the model keeps working. After three blocks in a row it lets the model stop, so a check
// that cannot pass never traps the session; the report must then say so (G5). The hook is a plugin
// hook, so it runs in every session however the skill was started; sessions that wrote no record
// are left alone. Exits 0 on any unexpected error.
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scripts = join(dirname(fileURLToPath(import.meta.url)), "../skills/developing-features/scripts");
const checks = [["scenarios.mjs", "check"], ["compile-control-model.mjs", "--gate"]];
const MAX_BLOCKS = 3;
const SKIP = new Set(["node_modules", ".git"]);
const RECORD = /^(acceptance-scenarios|control-decisions).*\.json$/;

function records(dir, depth = 0) {
	return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) return depth < 6 && !SKIP.has(entry.name) ? records(path, depth + 1) : [];
		return RECORD.test(entry.name) ? [path] : [];
	});
}

try {
	const input = JSON.parse(readFileSync(0, "utf8"));
	// The project root: on Claude Code, input.cwd follows the model's `cd` in Bash.
	const cwd = process.env.CLAUDE_PROJECT_DIR ?? input.cwd ?? process.cwd();
	let since = 0;
	try { const t = statSync(input.transcript_path); since = t.birthtimeMs || t.ctimeMs; } catch {}
	if (!records(cwd).some((path) => statSync(path).mtimeMs >= since)) process.exit(0);
	const counter = join(tmpdir(), `hobin-feature-stop-${String(input.session_id ?? "session").replace(/[^\w-]/g, "")}`);
	const problems = checks.map(([script, arg]) => {
		try {
			execFileSync(process.execPath, [join(scripts, script), arg], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
			return "";
		} catch (error) {
			return `${error.stderr ?? ""}`.trim() || `${error.stdout ?? ""}`.trim() || `${script} ${arg} failed.`;
		}
	}).filter(Boolean).join("\n");
	if (!problems) { rmSync(counter, { force: true }); process.exit(0); }
	let blocks = 0;
	try { blocks = Number(readFileSync(counter, "utf8")) || 0; } catch {}
	if (blocks >= MAX_BLOCKS) { rmSync(counter, { force: true }); process.exit(0); }
	writeFileSync(counter, String(blocks + 1));
	console.error(`A record is not complete (scenarios.mjs check, compile-control-model.mjs --gate):\n${problems}\nFix the code or the record, run "scenarios.mjs run", and finish only when "scenarios.mjs check" and "compile-control-model.mjs --gate" pass. If a check cannot pass, say so in the report.`);
	process.exit(2);
} catch {
	process.exit(0);
}
