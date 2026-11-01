#!/usr/bin/env node
// Stop hook, registered by the developing-features skill: Claude may finish only when
// `scenarios.mjs check` passes in the session's working directory, and, when a control decision
// record exists there, `compile-control-model.mjs --gate` too (G6, G7). While either fails, exit 2
// sends the problems back so Claude keeps working. After three blocks in a row the hook lets Claude
// stop, so a check that cannot pass never traps the session; the report must then say so (G5).
// Exits 0 on any unexpected error.
import { execFileSync } from "node:child_process";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scripts = join(dirname(fileURLToPath(import.meta.url)), "../skills/developing-features/scripts");
const checks = [["scenarios.mjs", "check"], ["compile-control-model.mjs", "--gate"]];
const MAX_BLOCKS = 3;

try {
	const input = JSON.parse(readFileSync(0, "utf8"));
	const counter = join(tmpdir(), `hobin-feature-stop-${String(input.session_id ?? "session").replace(/[^\w-]/g, "")}`);
	// The project root: input.cwd follows the model's `cd` in Bash.
	const cwd = process.env.CLAUDE_PROJECT_DIR ?? input.cwd ?? process.cwd();
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
