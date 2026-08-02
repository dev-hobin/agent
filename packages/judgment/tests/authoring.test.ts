import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
	compileJudgmentPolicy,
	compiledJudgmentPolicyData,
	decodeCompiledJudgmentPolicyData,
	decodePolicyOwnerData,
	jsonValueFromUnknown,
	parseCompiledJudgmentPolicy,
	parseJudgmentAuthoringPolicyJson,
	parsePolicyOwner,
} from "../src/index.ts";
import {
	loadOptionalJudgmentPolicyFile,
	readJudgmentPolicyFile,
} from "../src/node/read-judgment-policy.ts";

const policy = {
	specVersion: "0.1",
	when: [
		"A caller-facing boundary needs an explicit owner and operation vocabulary.",
	],
	unless: [
		"A concrete candidate already exists and only its stability must be reviewed.",
	],
	references: [
		{
			path: "references/boundary.md",
			when: [
				"A dependency boundary needs the reference's explicit caller, owner, mechanism, and direction distinctions.",
			],
		},
	],
};
function owner() {
	return parsePolicyOwner(
		decodePolicyOwnerData(
			jsonValueFromUnknown({
				kind: "pi-skill",
				namespace: "test",
				name: "sketch",
				provenance: {
					source: "test",
					scope: "temporary",
					origin: "top-level",
					path: "/tmp/SKILL.md",
				},
			}),
		),
	);
}

test("authoring parser returns canonical immutable policy and ignores representation-only ordering", () => {
	const first = parseJudgmentAuthoringPolicyJson(
		JSON.stringify({
			$schema: "https://example.test/schema",
			...policy,
			when: [
				...policy.when,
				"State ownership and order still need an implementation shape.",
			],
		}),
	);
	const second = parseJudgmentAuthoringPolicyJson(
		JSON.stringify({
			...policy,
			when: [
				"State ownership and order still need an implementation shape.",
				...policy.when,
			],
		}),
	);
	assert.equal(first.authoringSha256, second.authoringSha256);
	assert.ok(Object.isFrozen(first));
	assert.ok(Object.isFrozen(first.references));
});

test("legacy graph fields, semantic duplicates, duplicate paths, and path escape fail closed", () => {
	assert.throws(
		() =>
			parseJudgmentAuthoringPolicyJson(
				JSON.stringify({ ...policy, decisionUnit: "sketch" }),
			),
		/does not match/u,
	);
	assert.throws(
		() =>
			parseJudgmentAuthoringPolicyJson(
				JSON.stringify({
					...policy,
					when: [policy.when[0], policy.when[0].toUpperCase()],
				}),
			),
		/Semantic duplicate/u,
	);
	assert.throws(
		() =>
			parseJudgmentAuthoringPolicyJson(
				JSON.stringify({
					...policy,
					references: [...policy.references, ...policy.references],
				}),
			),
		/Duplicate prepared reference path/u,
	);
	assert.throws(
		() =>
			parseJudgmentAuthoringPolicyJson(
				JSON.stringify({
					...policy,
					references: [
						{ path: "../escape.md", when: policy.references[0].when },
					],
				}),
			),
		/relative POSIX|normalized/u,
	);
});

test("compiled policy binds externally supplied owner and round-trips by parsing", () => {
	const authoring = parseJudgmentAuthoringPolicyJson(JSON.stringify(policy));
	const compiled = compileJudgmentPolicy({ owner: owner(), policy: authoring });
	const roundTrip = parseCompiledJudgmentPolicy(
		decodeCompiledJudgmentPolicyData(
			jsonValueFromUnknown(compiledJudgmentPolicyData(compiled)),
		),
	);
	assert.equal(roundTrip.policySha256, compiled.policySha256);
	assert.equal(roundTrip.owner.name, "sketch");
	assert.equal(roundTrip.references[0]?.referenceId, "references/boundary.md");
});

test("policy loading rejects a parent-directory symlink outside the allowed root", async () => {
	const allowed = await mkdtemp(join(tmpdir(), "judgment-allowed-"));
	const outside = await mkdtemp(join(tmpdir(), "judgment-outside-"));
	try {
		await mkdir(join(outside, "references"));
		await writeFile(
			join(outside, "references/boundary.md"),
			"# Boundary\n",
			"utf8",
		);
		await writeFile(
			join(outside, "judgment.json"),
			`${JSON.stringify(policy, null, 2)}\n`,
			"utf8",
		);
		await symlink(outside, join(allowed, "linked"), "dir");
		await assert.rejects(
			readJudgmentPolicyFile({
				path: join(allowed, "linked/judgment.json"),
				owner: owner(),
				allowedRoot: allowed,
			}),
			/physically escapes its allowed root/u,
		);
	} finally {
		await Promise.all([
			rm(allowed, { recursive: true, force: true }),
			rm(outside, { recursive: true, force: true }),
		]);
	}
});

test("optional policy loader distinguishes absent, loaded, and invalid", async () => {
	const root = await mkdtemp(join(tmpdir(), "judgment-authoring-"));
	try {
		const path = join(root, "judgment.json");
		assert.deepEqual(
			await loadOptionalJudgmentPolicyFile({
				path,
				owner: owner(),
				allowedRoot: root,
			}),
			{ kind: "absent" },
		);
		await writeFile(path, "{}\n", "utf8");
		const invalid = await loadOptionalJudgmentPolicyFile({
			path,
			owner: owner(),
			allowedRoot: root,
		});
		assert.equal(invalid.kind, "invalid");
		await mkdir(join(root, "references"));
		await writeFile(
			join(root, "references/boundary.md"),
			"# Boundary\n",
			"utf8",
		);
		await writeFile(path, `${JSON.stringify(policy, null, 2)}\n`, "utf8");
		const loaded = await readJudgmentPolicyFile({
			path,
			owner: owner(),
			allowedRoot: root,
		});
		assert.equal(loaded.policy.references.length, 1);
		assert.equal(
			(
				await loadOptionalJudgmentPolicyFile({
					path,
					owner: owner(),
					allowedRoot: root,
				})
			).kind,
			"loaded",
		);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
