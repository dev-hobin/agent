import assert from "node:assert/strict";
import test from "node:test";
import {
	bindCapability,
	type CapabilitySource,
} from "../src/action-loop/routing/bind-capability.ts";
import {
	parseTocBytes,
	SKILL_TOC_SCHEMA_URI,
	type ParsedToc,
} from "../src/action-loop/routing/parse-toc.ts";

const encoder = new TextEncoder();
const packageSource: CapabilitySource = {
	kind: "package",
	locator: "npm:@hobin/developer",
	skillRoot: "skills/verify",
};
const skillBytes = encoder.encode("---\nname: verify\n---\n");

function parseToc(overrides: Record<string, unknown> = {}): ParsedToc {
	const result = parseTocBytes(
		encoder.encode(
			JSON.stringify({
				$schema: SKILL_TOC_SCHEMA_URI,
				when: ["A concrete claim must be assessed."],
				unless: ["There is no concrete claim to assess."],
				references: [
					{
						path: "references/verifier-selection.md",
						when: ["A green check may not exercise accepted meaning."],
					},
				],
				...overrides,
			}),
		),
	);
	if (!result.ok) throw new Error(result.error.message);
	return result.value;
}

test("source provenance and normalized content produce deterministic identities", () => {
	const result = bindCapability(packageSource, parseToc(), skillBytes);

	assert.equal(result.ok, true);
	if (!result.ok) return;
	assert.match(result.value.capabilityId, /^cap_[a-f0-9]{64}$/);
	assert.match(result.value.capabilityRevisionId, /^caprev_[a-f0-9]{64}$/);
	assert.match(result.value.skillHash, /^sha256_[a-f0-9]{64}$/);
	assert.match(result.value.tocHash, /^sha256_[a-f0-9]{64}$/);
	const repeated = bindCapability(packageSource, parseToc(), skillBytes);
	assert.equal(repeated.ok, true);
	if (repeated.ok) {
		assert.equal(repeated.value.capabilityId, result.value.capabilityId);
		assert.equal(
			repeated.value.capabilityRevisionId,
			result.value.capabilityRevisionId,
		);
	}
	assert.equal(Object.isFrozen(result.value), true);
	assert.equal(Object.isFrozen(result.value.source), true);
});

test("Skill or TOC changes preserve Capability ID and change revision identity", () => {
	const original = bindCapability(packageSource, parseToc(), skillBytes);
	const changedSkill = bindCapability(
		packageSource,
		parseToc(),
		encoder.encode("---\nname: verify\n---\nchanged\n"),
	);
	const changedToc = bindCapability(
		packageSource,
		parseToc({ when: ["A changed claim condition applies."] }),
		skillBytes,
	);

	assert.equal(original.ok, true);
	assert.equal(changedSkill.ok, true);
	assert.equal(changedToc.ok, true);
	if (!original.ok || !changedSkill.ok || !changedToc.ok) return;
	assert.equal(changedSkill.value.capabilityId, original.value.capabilityId);
	assert.equal(changedToc.value.capabilityId, original.value.capabilityId);
	assert.notEqual(
		changedSkill.value.capabilityRevisionId,
		original.value.capabilityRevisionId,
	);
	assert.notEqual(
		changedToc.value.capabilityRevisionId,
		original.value.capabilityRevisionId,
	);
	assert.notEqual(changedSkill.value.skillHash, original.value.skillHash);
	assert.notEqual(changedToc.value.tocHash, original.value.tocHash);
});

test("equivalent normalized TOCs produce the same revision", () => {
	const compact = parseToc();
	const padded = parseToc({
		when: ["  A concrete claim must be assessed.  "],
		references: [
			{
				path: "references/verifier-selection.md",
				when: ["  A green check may not exercise accepted meaning.  "],
			},
		],
	});
	const first = bindCapability(packageSource, compact, skillBytes);
	const second = bindCapability(packageSource, padded, skillBytes);

	assert.equal(first.ok, true);
	assert.equal(second.ok, true);
	if (!first.ok || !second.ok) return;
	assert.equal(second.value.tocHash, first.value.tocHash);
	assert.equal(
		second.value.capabilityRevisionId,
		first.value.capabilityRevisionId,
	);
});

test("same content at different sources cannot collapse to one Capability", () => {
	const packaged = bindCapability(packageSource, parseToc(), skillBytes);
	const project = bindCapability(
		{
			kind: "project",
			locator: "file:///workspace/.pi/skills",
			skillRoot: "verify",
		},
		parseToc(),
		skillBytes,
	);

	assert.equal(packaged.ok, true);
	assert.equal(project.ok, true);
	if (!packaged.ok || !project.ok) return;
	assert.notEqual(project.value.capabilityId, packaged.value.capabilityId);
	assert.notEqual(
		project.value.capabilityRevisionId,
		packaged.value.capabilityRevisionId,
	);
});

test("source values are copied before caller mutation", () => {
	const source: CapabilitySource = {
		kind: "project",
		locator: "file:///workspace/.pi/skills",
		skillRoot: "verify",
	};
	const result = bindCapability(source, parseToc(), skillBytes);
	(source as { locator: string }).locator = "file:///changed";

	assert.equal(result.ok, true);
	if (!result.ok) return;
	assert.equal(result.value.source.locator, "file:///workspace/.pi/skills");
});

test("a single-Skill source can use dot as its relative root", () => {
	const result = bindCapability(
		{ kind: "cli", locator: "file:///tmp/verify", skillRoot: "." },
		parseToc(),
		skillBytes,
	);

	assert.equal(result.ok, true);
});

test("invalid adapter provenance fails before identity creation", () => {
	const cases = [
		{
			source: { ...packageSource, kind: "model" },
			code: "unsupported-source-kind",
			path: "source.kind",
		},
		{
			source: { ...packageSource, locator: "  " },
			code: "invalid-source-locator",
			path: "source.locator",
		},
		{
			source: { ...packageSource, skillRoot: "skills/../verify" },
			code: "invalid-skill-root",
			path: "source.skillRoot",
		},
	] as const;

	for (const fixture of cases) {
		const result = bindCapability(
			fixture.source as CapabilitySource,
			parseToc(),
			skillBytes,
		);
		assert.equal(result.ok, false);
		if (result.ok) continue;
		assert.equal(result.error.code, fixture.code);
		assert.equal(result.error.path, fixture.path);
	}
});
