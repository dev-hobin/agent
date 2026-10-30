// Check a workspace against the file-based checks of a core scenario (scenario.yaml).
// Usage: node scenario-check.mjs <scenario.yaml> <baseline> [workspace=.] — exit 0 when all pass.
// <baseline> is the workspace as presented to the run, before the run changed anything.
// Used as a verifier command by hosts whose eval tools run commands (Codex plugin-eval) and
// by check.mjs to prove each scenario accepts its golden result and rejects wrong ones.
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parse } from "yaml";

function files(root, dir = root) {
	return readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		return statSync(path).isDirectory() ? files(root, path) : [relative(root, path)];
	});
}
const digest = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");

export function checkScenario(casePath, workspace, original) {
	const spec = parse(readFileSync(casePath, "utf8"));
	const results = [];
	for (const expectation of spec.expect) {
		const [kind, value] = Object.entries(expectation).find(([key]) => key !== "id");
		let passed;
		if (kind === "file_exists") passed = files(workspace).includes(value);
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
		} else continue; // trace-based expectations are checked by the host's own tool
		results.push({ id: expectation.id, passed });
	}
	return results;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	const [casePath, baseline, workspace = "."] = process.argv.slice(2);
	const results = checkScenario(resolve(casePath), resolve(workspace), resolve(baseline));
	for (const r of results) console.log(`${r.passed ? "pass" : "FAIL"} ${r.id}`);
	process.exit(results.every((r) => r.passed) ? 0 : 1);
}
