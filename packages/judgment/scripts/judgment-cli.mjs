#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import {
	compiledJudgmentPolicyData,
	decodePolicyOwnerData,
	jsonValueFromUnknown,
	parsePolicyOwner,
} from "../src/index.ts";
import { readJudgmentPolicyFile } from "../src/node/read-judgment-policy.ts";

function usage() {
	return "usage: judgment <check|compile|explain> <path-to-judgment.json>";
}

async function skillName(root) {
	const source = await readFile(resolve(root, "SKILL.md"), "utf8");
	const match = source.match(
		/^---\s*$[\s\S]*?^name:\s*["']?([^\n"']+)["']?\s*$/mu,
	);
	if (!match?.[1])
		throw new Error(
			"Unable to derive policy owner from co-located SKILL.md name.",
		);
	return match[1].trim();
}

async function main() {
	const [command, rawPath, ...rest] = process.argv.slice(2);
	if (
		!command ||
		!rawPath ||
		rest.length > 0 ||
		!["check", "compile", "explain"].includes(command)
	)
		throw new Error(usage());
	const path = resolve(rawPath);
	const root = dirname(path);
	const name = await skillName(root);
	const owner = parsePolicyOwner(
		decodePolicyOwnerData(
			jsonValueFromUnknown({
				kind: "pi-skill",
				namespace: "local",
				name,
				provenance: {
					source: "local",
					scope: "project",
					origin: "top-level",
					path: resolve(root, "SKILL.md"),
				},
			}),
		),
	);
	const loaded = await readJudgmentPolicyFile({
		path,
		owner,
		allowedRoot: root,
	});
	if (command === "check") {
		process.stdout.write(`valid ${loaded.policy.policySha256}\n`);
		return;
	}
	if (command === "compile") {
		process.stdout.write(
			`${JSON.stringify(compiledJudgmentPolicyData(loaded.policy), null, 2)}\n`,
		);
		return;
	}
	process.stdout.write(
		[
			`owner: ${loaded.policy.owner.namespace}/${loaded.policy.owner.name}`,
			`policy: ${loaded.policy.policySha256}`,
			"when:",
			...loaded.policy.when.map((value) => `- ${value}`),
			"unless (wins):",
			...loaded.policy.unless.map((value) => `- ${value}`),
			"prepared references:",
			...loaded.policy.references.flatMap((reference) => [
				`- ${reference.path}`,
				...reference.when.map((value) => `  - ${value}`),
			]),
			"Prepared reference membership does not create authority, coverage, or mutation permission.",
		].join("\n") + "\n",
	);
}

main().catch((error) => {
	process.stderr.write(
		`${error instanceof Error ? error.message : String(error)}\n`,
	);
	process.exitCode = 1;
});
