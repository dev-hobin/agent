#!/usr/bin/env node
// Stop hook for claude plugin eval cases (loaded through the case's `plugins` field, never
// installed for users). Runs the code-based checks of the core scenario named by EVAL_SCENARIO
// (command_passes, script_passes, output_contract) — the ones claude plugin eval has no grader
// for — and writes one `pass <id>` / `FAIL <id>` line per check to SCENARIO_CHECK.txt, which the
// case's regex graders read. The checks run on a copy of the workspace, so hidden test files
// never appear where the model works. Always exits 0: it observes, it never blocks.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const CHECKER = ".agents/skills/implementing-core/scripts/scenario-check.mjs";
const RESULT = "SCENARIO_CHECK.txt";

try {
	const input = JSON.parse(readFileSync(0, "utf8"));
	// The project root: input.cwd follows the model's `cd` in Bash.
	const cwd = process.env.CLAUDE_PROJECT_DIR ?? input.cwd ?? process.cwd();
	let root = process.env.CLAUDE_PLUGIN_ROOT ?? "";
	while (root !== dirname(root) && !existsSync(join(root, CHECKER))) root = dirname(root);
	const scenario = process.env.EVAL_SCENARIO;
	if (!scenario || !existsSync(join(root, CHECKER))) {
		writeFileSync(join(cwd, RESULT), `error: EVAL_SCENARIO is not set or ${CHECKER} was not found\n`);
	} else {
		const run = spawnSync(process.execPath, [join(root, CHECKER), join(root, scenario), cwd, cwd,
			"--ignore", RESULT, "--kinds", "command_passes,script_passes,output_contract"], { encoding: "utf8" });
		writeFileSync(join(cwd, RESULT), `${run.stdout}${run.stderr ? `stderr: ${run.stderr}` : ""}`);
	}
} catch (error) {
	try { writeFileSync(join(process.cwd(), RESULT), `error: ${error.message}\n`); } catch {}
}
process.exit(0);
