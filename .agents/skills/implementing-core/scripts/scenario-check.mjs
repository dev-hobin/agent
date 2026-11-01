// Check a workspace against the file-based checks of a core scenario (scenario.yaml).
// Usage: node scenario-check.mjs <scenario.yaml> <baseline> [workspace=.] [--ignore <path>]…
// — exit 0 when all pass. <baseline> is the workspace as presented to the run, before the run
// changed anything. --ignore drops paths the host's eval tool adds to the workspace (for
// example the plugin it installs there): every check, including capability scripts that scan
// the workspace themselves, runs on a copy without them.
// Used as a verifier command by hosts whose eval tools run commands (Codex plugin-eval) and
// by check.mjs to prove each scenario accepts its golden result and rejects wrong ones.
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parse } from "yaml";

import { checkText } from "../../../../core/shared/scripts/output-contract.mjs";

function files(root, dir = root) {
	return readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		return statSync(path).isDirectory() ? files(root, path) : [relative(root, path)];
	});
}
const digest = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
// Glob: `**/` matches any directories (or none), `**` anything, `*` within one segment.
const glob = (pattern) => new RegExp(`^${pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&")
	.replace(/\*\*\//g, "\u0000").replace(/\*\*/g, "\u0001").replace(/\*/g, "[^/]*")
	.replace(/\u0000/g, "(?:.*/)?").replace(/\u0001/g, ".*")}$`);

export function checkScenario(casePath, workspace, original, ignore = []) {
	const spec = parse(readFileSync(casePath, "utf8"));
	if (ignore.length) {
		const ignored = (path) => ignore.some((prefix) => path === prefix || path.startsWith(prefix.replace(/\/?$/, "/")));
		const copy = join(mkdtempSync(join(tmpdir(), "scenario-check-")), "workspace");
		cpSync(workspace, copy, { recursive: true, filter: (src) => !ignored(relative(workspace, src)) });
		workspace = copy;
	}
	const results = [];
	for (const expectation of spec.expect) {
		const [kind, value] = Object.entries(expectation).find(([key]) => key !== "id");
		let passed;
		if (kind === "file_exists") passed = files(workspace).some((path) => glob(value).test(path));
		else if (kind === "file_matches" || kind === "file_lacks") {
			let text = "";
			try { text = readFileSync(join(workspace, value.path), "utf8"); } catch { passed = false; }
			if (passed === undefined) {
				const found = new RegExp(value.pattern, value.flags ?? "").test(text);
				passed = kind === "file_matches" ? found : !found;
			}
		} else if (kind === "unchanged_except") {
			const before = new Map(files(original).map((path) => [path, digest(join(original, path))]));
			const after = files(workspace).filter((path) => !value.includes(path));
			passed = after.length === before.size && after.every((path) => before.get(path) === digest(join(workspace, path)));
		} else if (kind === "unchanged") {
			const inScope = (path) => value.some((prefix) => path === prefix || path.startsWith(prefix.replace(/\/?$/, "/")));
			const before = files(original).filter(inScope), after = files(workspace).filter(inScope);
			passed = before.length === after.length && before.every((path, i) => path === after[i] && digest(join(original, path)) === digest(join(workspace, path)));
		} else if (kind === "command_passes") {
			// Hidden files come from the scenario directory and are added only after the run.
			if (value.files) cpSync(join(dirname(casePath), value.files), join(workspace, value.files), { recursive: true });
			const { NODE_TEST_CONTEXT: _, ...env } = process.env;
			try { execFileSync("sh", ["-c", value.command], { cwd: workspace, env, stdio: "pipe" }); passed = true; } catch { passed = false; }
		} else if (kind === "script_passes") {
			// A capability script (resolved from core/<id>/) run in the workspace; exit 0 passes.
			const capability = resolve(dirname(casePath), "../..");
			const { NODE_TEST_CONTEXT: _, ...env } = process.env;
			try { execFileSync("node", [join(capability, value.script), ...(value.args ?? [])], { cwd: workspace, env, stdio: "pipe" }); passed = true; } catch { passed = false; }
		} else if (kind === "output_contract") {
			// The capability's own contract checker, the same one the skill runs on its result.
			const capability = resolve(dirname(casePath), "../..");
			const contract = JSON.parse(readFileSync(join(capability, value.contract), "utf8"));
			let text = null;
			try { text = readFileSync(join(workspace, value.file), "utf8"); } catch { passed = false; }
			if (text !== null) passed = checkText(contract, text).length === 0;
		} else continue; // trace-based expectations are checked by the host's own tool
		results.push({ id: expectation.id, passed });
	}
	return results;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	const args = process.argv.slice(2);
	const ignore = args.flatMap((arg, i) => (args[i - 1] === "--ignore" ? [arg] : []));
	const [casePath, baseline, workspace = "."] = args.filter((arg, i) => arg !== "--ignore" && args[i - 1] !== "--ignore");
	const results = checkScenario(resolve(casePath), resolve(workspace), resolve(baseline), ignore);
	for (const r of results) console.log(`${r.passed ? "pass" : "FAIL"} ${r.id}`);
	process.exit(results.every((r) => r.passed) ? 0 : 1);
}
