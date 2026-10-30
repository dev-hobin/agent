// Check a workspace against the file-based expectations of a core contract case.
// Usage: node contract-check.mjs <case.yaml> [workspace=.]   — exit 0 when every check passes.
// Used directly by hosts whose eval tools run verifier commands (Codex plugin-eval), and by
// tests that prove the expectations accept a correct result and reject a wrong one.
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parse } from "yaml";

function files(root, dir = root) {
	return readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		return statSync(path).isDirectory() ? files(root, path) : [relative(root, path)];
	});
}
const digest = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");

export function checkCase(casePath, workspace) {
	const spec = parse(readFileSync(casePath, "utf8"));
	const original = join(dirname(casePath), "workspace");
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
	const [casePath, workspace = "."] = process.argv.slice(2);
	const results = checkCase(resolve(casePath), resolve(workspace));
	for (const r of results) console.log(`${r.passed ? "pass" : "FAIL"} ${r.id}`);
	process.exit(results.every((r) => r.passed) ? 0 : 1);
}
