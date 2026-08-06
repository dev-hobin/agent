import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { type TestContext } from "node:test";
import {
	acceptCapabilityApplicability,
	type CapabilityAssignment,
} from "../src/action-loop/routing/accept-applicability.ts";
import {
	bindCapability,
	type BoundCapability,
} from "../src/action-loop/routing/bind-capability.ts";
import {
	bindReferenceSelection,
	type BoundReferenceSelection,
} from "../src/action-loop/routing/bind-reference-selection.ts";
import {
	parseTocBytes,
	SKILL_TOC_SCHEMA_URI,
} from "../src/action-loop/routing/parse-toc.ts";
import { selectDeclaredReferences } from "../src/action-loop/routing/reference-selection.ts";
import {
	MAX_SEALED_MATERIAL_BYTES,
	sealSkillContext,
} from "../src/action-loop/io/seal-skill-context.ts";

const encoder = new TextEncoder();
const claimWhen = "A concrete claim must be assessed.";
const skillText = "---\nname: verify\n---\nVerify the bounded claim.\n";

async function temporaryRoot(t: TestContext): Promise<string> {
	const root = await mkdtemp(join(tmpdir(), "developer-skill-context-"));
	t.after(async () => rm(root, { recursive: true, force: true }));
	await mkdir(join(root, "references"));
	await writeFile(join(root, "SKILL.md"), skillText);
	await writeFile(
		join(root, "references/verifier-selection.md"),
		"Select a verifier that can observe the claim.\n",
	);
	await writeFile(
		join(root, "references/pass-but-wrong.md"),
		"Check whether passing evidence can still support a wrong claim.\n",
	);
	return root;
}

function capability(skillBytes = encoder.encode(skillText)): BoundCapability {
	const parsed = parseTocBytes(
		encoder.encode(
			JSON.stringify({
				$schema: SKILL_TOC_SCHEMA_URI,
				when: [claimWhen],
				unless: ["There is no concrete claim to assess."],
				references: [
					{
						path: "references/verifier-selection.md",
						when: ["Verifier relevance"],
					},
					{
						path: "references/pass-but-wrong.md",
						when: ["Pass-but-wrong risk"],
					},
				],
			}),
		),
	);
	if (!parsed.ok) throw new Error(parsed.error.message);
	const bound = bindCapability(
		{
			kind: "project",
			locator: "project:test-fixture",
			skillRoot: "skills/verify",
		},
		parsed.value,
		skillBytes,
	);
	if (!bound.ok) throw new Error(bound.error.message);
	return bound.value;
}

function assignment(currentCapability: BoundCapability): CapabilityAssignment {
	const accepted = acceptCapabilityApplicability(
		{
			workCaseId: "work-1",
			judgmentId: "judgment-1",
			contributionNeedId: "need-1",
			capability: currentCapability,
		},
		{
			workCaseId: "work-1",
			judgmentId: "judgment-1",
			contributionNeedId: "need-1",
			capabilityRevisionId: currentCapability.capabilityRevisionId,
			status: "applicable",
			matchedWhen: [claimWhen],
			matchedUnless: [],
			basis: ["The Need requires a bounded claim assessment."],
			missingContext: [],
		},
	);
	if (accepted.status !== "assigned") throw new Error(accepted.status);
	return accepted.assignment;
}

function selection(
	currentCapability: BoundCapability,
	currentAssignment: CapabilityAssignment,
	secondStatus: "selected" | "not-needed" | "needs-context" = "selected",
): BoundReferenceSelection {
	const selected = selectDeclaredReferences(currentCapability.toc.references, [
		{
			path: "references/verifier-selection.md",
			status: "selected",
			basis: ["Verifier selection changes the evidence plan."],
		},
		{
			path: "references/pass-but-wrong.md",
			status: secondStatus,
			basis: [
				secondStatus === "needs-context"
					? "The accepted claim scope is missing."
					: "Pass-but-wrong risk has an explicit disposition.",
			],
		},
	]);
	const bound = bindReferenceSelection(
		currentAssignment,
		currentCapability,
		selected,
	);
	if (!bound.ok) throw new Error(bound.error.message);
	return bound.value;
}

function prepared(secondStatus?: "selected" | "not-needed" | "needs-context") {
	const currentCapability = capability();
	const currentAssignment = assignment(currentCapability);
	return {
		capability: currentCapability,
		assignment: currentAssignment,
		selection: selection(currentCapability, currentAssignment, secondStatus),
	};
}

test("ready selection seals exact Skill and selected Reference materials", async (t) => {
	const skillRootPath = await temporaryRoot(t);
	const request = { skillRootPath, ...prepared() };
	const first = await sealSkillContext(request);
	const repeated = await sealSkillContext(request);

	assert.equal(first.ok, true);
	assert.equal(repeated.ok, true);
	if (!first.ok || !repeated.ok) return;
	assert.match(first.value.sealedContextId, /^sealed_[a-f0-9]{64}$/);
	assert.equal(repeated.value.sealedContextId, first.value.sealedContextId);
	assert.deepEqual(
		first.value.materials.map(({ kind, path }) => ({ kind, path })),
		[
			{ kind: "skill", path: "SKILL.md" },
			{
				kind: "reference",
				path: "references/verifier-selection.md",
			},
			{ kind: "reference", path: "references/pass-but-wrong.md" },
		],
	);
	assert.equal(first.value.materials[0]?.content, skillText);
	assert.equal(
		first.value.materials[0]?.byteLength,
		encoder.encode(skillText).length,
	);
	assert.equal(Object.isFrozen(first.value), true);
	assert.equal(Object.isFrozen(first.value.materials), true);
	assert.equal(Object.isFrozen(first.value.source), true);
});

test("zero selected References seals SKILL.md alone", async (t) => {
	const skillRootPath = await temporaryRoot(t);
	const preparedContext = prepared("not-needed");
	const selected = selectDeclaredReferences(
		preparedContext.capability.toc.references,
		preparedContext.capability.toc.references.map(({ path }) => ({
			path,
			status: "not-needed" as const,
			basis: ["SKILL.md is sufficient for this bounded Need."],
		})),
	);
	const bound = bindReferenceSelection(
		preparedContext.assignment,
		preparedContext.capability,
		selected,
	);
	if (!bound.ok) throw new Error(bound.error.message);
	const result = await sealSkillContext({
		skillRootPath,
		capability: preparedContext.capability,
		assignment: preparedContext.assignment,
		selection: bound.value,
	});

	assert.equal(result.ok, true);
	if (result.ok)
		assert.deepEqual(
			result.value.materials.map((x) => x.path),
			["SKILL.md"],
		);
});

test("unresolved selection fails before filesystem acquisition", async () => {
	const context = prepared("needs-context");
	const result = await sealSkillContext({
		skillRootPath: "/path/that/does/not/exist",
		...context,
	});

	assert.equal(result.ok, false);
	if (!result.ok) assert.equal(result.error.code, "selection-not-ready");
});

test("tampered assignment or selection identity fails before acquisition", async () => {
	const context = prepared();
	const result = await sealSkillContext({
		skillRootPath: "/path/that/does/not/exist",
		...context,
		selection: {
			...context.selection,
			assignmentId: "assign_from_another_work_case",
		},
	});

	assert.equal(result.ok, false);
	if (!result.ok) assert.equal(result.error.code, "identity-mismatch");
});

test("Skill drift from the bound Capability revision fails atomically", async (t) => {
	const skillRootPath = await temporaryRoot(t);
	await writeFile(join(skillRootPath, "SKILL.md"), `${skillText}Changed.\n`);
	const result = await sealSkillContext({ skillRootPath, ...prepared() });

	assert.equal(result.ok, false);
	if (!result.ok) assert.equal(result.error.code, "skill-drift");
});

test("one missing selected member returns no partial context", async (t) => {
	const skillRootPath = await temporaryRoot(t);
	await rm(join(skillRootPath, "references/pass-but-wrong.md"));
	const result = await sealSkillContext({ skillRootPath, ...prepared() });

	assert.equal(result.ok, false);
	if (!result.ok) {
		assert.equal(result.error.code, "material-missing");
		assert.equal(result.error.path, "references/pass-but-wrong.md");
	}
});

test("a selected non-regular member is rejected", async (t) => {
	const skillRootPath = await temporaryRoot(t);
	const selectedPath = join(skillRootPath, "references/verifier-selection.md");
	await rm(selectedPath);
	await mkdir(selectedPath);
	const result = await sealSkillContext({
		skillRootPath,
		...prepared("not-needed"),
	});

	assert.equal(result.ok, false);
	if (!result.ok) assert.equal(result.error.code, "material-not-regular");
});

test("expected sealed identity detects selected-content drift", async (t) => {
	const skillRootPath = await temporaryRoot(t);
	const context = prepared();
	const first = await sealSkillContext({ skillRootPath, ...context });
	assert.equal(first.ok, true);
	if (!first.ok) return;
	await writeFile(
		join(skillRootPath, "references/pass-but-wrong.md"),
		"Changed selected material.\n",
	);
	const replay = await sealSkillContext({
		skillRootPath,
		...context,
		expectedSealedContextId: first.value.sealedContextId,
	});

	assert.equal(replay.ok, false);
	if (!replay.ok) assert.equal(replay.error.code, "context-drift");
});

test("unselected Reference drift does not stale an existing seal", async (t) => {
	const skillRootPath = await temporaryRoot(t);
	const context = prepared("not-needed");
	const first = await sealSkillContext({ skillRootPath, ...context });
	assert.equal(first.ok, true);
	if (!first.ok) return;
	await writeFile(
		join(skillRootPath, "references/pass-but-wrong.md"),
		"Changed but unselected material.\n",
	);
	const replay = await sealSkillContext({
		skillRootPath,
		...context,
		expectedSealedContextId: first.value.sealedContextId,
	});

	assert.equal(replay.ok, true);
	if (replay.ok)
		assert.equal(replay.value.sealedContextId, first.value.sealedContextId);
});

test("invalid UTF-8 and oversized material fail explicitly", async (t) => {
	const skillRootPath = await temporaryRoot(t);
	const context = prepared("not-needed");
	await writeFile(
		join(skillRootPath, "references/verifier-selection.md"),
		Buffer.from([0xc3, 0x28]),
	);
	const invalidUtf8 = await sealSkillContext({ skillRootPath, ...context });
	assert.equal(invalidUtf8.ok, false);
	if (!invalidUtf8.ok) assert.equal(invalidUtf8.error.code, "invalid-utf8");

	await writeFile(
		join(skillRootPath, "references/verifier-selection.md"),
		Buffer.alloc(MAX_SEALED_MATERIAL_BYTES + 1, 0x61),
	);
	const oversized = await sealSkillContext({ skillRootPath, ...context });
	assert.equal(oversized.ok, false);
	if (!oversized.ok) assert.equal(oversized.error.code, "material-too-large");
});

test("physical symlink escape from the Skill root is rejected", async (t) => {
	const skillRootPath = await temporaryRoot(t);
	const outside = await mkdtemp(join(tmpdir(), "developer-skill-outside-"));
	t.after(async () => rm(outside, { recursive: true, force: true }));
	const outsideReference = join(outside, "outside.md");
	await writeFile(outsideReference, "Outside material.\n");
	await rm(join(skillRootPath, "references/verifier-selection.md"));
	await symlink(
		outsideReference,
		join(skillRootPath, "references/verifier-selection.md"),
	);
	const result = await sealSkillContext({
		skillRootPath,
		...prepared("not-needed"),
	});

	assert.equal(result.ok, false);
	if (!result.ok) assert.equal(result.error.code, "path-escape");
});
