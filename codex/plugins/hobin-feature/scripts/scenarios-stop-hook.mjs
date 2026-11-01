#!/usr/bin/env node
// Stop hook: when this session wrote an acceptance-scenario or control decision record (a record
// under the working directory changed after the session transcript was created), Codex may finish
// only when `scenarios.mjs check` and `compile-control-model.mjs --gate` pass (G6, G7). While it fails, exit 2 sends the problems back so Codex keeps
// working. After three blocks in a row it lets Codex stop, so a check that cannot pass never
// traps the session; the report must then say so (G5). Sessions that wrote no record are left
// alone, since Codex plugin hooks apply to every session, not only the skill's. Exits 0 on any
// unexpected error.
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scripts = join(dirname(fileURLToPath(import.meta.url)), "../skills/developing-features/scripts");
const checks = [["scenarios.mjs", "check"], ["compile-control-model.mjs", "--gate"]];
const MAX_BLOCKS = 3;

function records(dir) {
	return readdirSync(dir).flatMap((name) => {
		if (name === "node_modules" || name.startsWith(".git")) return [];
		const path = join(dir, name);
		return statSync(path).isDirectory() ? records(path) : /^(acceptance-scenarios|control-decisions).*\.json$/.test(name) ? [path] : [];
	});
}

try {
	const input = JSON.parse(readFileSync(0, "utf8"));
	const cwd = input.cwd ?? process.cwd();
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
