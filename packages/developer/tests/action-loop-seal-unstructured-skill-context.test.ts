import assert from "node:assert/strict";
import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test, { type TestContext } from "node:test";
import {
	sealUnstructuredSkillContext,
	type SealedUnstructuredSkillContext,
} from "../src/action-loop/io/seal-skill-context.ts";
import {
	acceptCapabilityApplicability,
	type CapabilityAssignment,
} from "../src/action-loop/routing/accept-applicability.ts";
import {
	bindUnstructuredCapability,
	type BoundUnstructuredCapability,
} from "../src/action-loop/routing/bind-capability.ts";

const encoder = new TextEncoder();
const skillText =
	"---\nname: direct\ndescription: Direct method\n---\n# Method\n";

async function temporaryRoot(t: TestContext): Promise<string> {
	const root = await mkdtemp(join(tmpdir(), "developer-unstructured-seal-"));
	t.after(async () => rm(root, { recursive: true, force: true }));
	return root;
}

function capability(
	skillFilePath: string,
	skillBytes = encoder.encode(skillText),
): BoundUnstructuredCapability {
	const bound = bindUnstructuredCapability(
		{
			kind: "cli",
			locator: `file://${skillFilePath}`,
			skillRoot: ".",
		},
		skillBytes,
	);
	if (!bound.ok) throw new Error(bound.error.message);
	return bound.value;
}

function assignment(
	currentCapability: BoundUnstructuredCapability,
): CapabilityAssignment {
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
			matchedWhen: [],
			matchedUnless: [],
			basis: ["The admitted Skill description directly addresses the Need."],
			missingContext: [],
		},
	);
	if (accepted.status !== "assigned") {
		throw new Error(`Expected assignment, received ${accepted.status}`);
	}
	return accepted.assignment;
}

async function sealFixture(
	skillFilePath: string,
): Promise<SealedUnstructuredSkillContext> {
	const currentCapability = capability(skillFilePath);
	const currentAssignment = assignment(currentCapability);
	const sealed = await sealUnstructuredSkillContext({
		skillFilePath,
		capability: currentCapability,
		assignment: currentAssignment,
	});
	if (!sealed.ok) throw new Error(sealed.error.message);
	return sealed.value;
}

test("direct-file and directory Skills seal one exact unstructured context", async (t) => {
	const root = await temporaryRoot(t);
	const paths = [join(root, "direct.md"), join(root, "nested", "SKILL.md")];
	for (const skillFilePath of paths) {
		await mkdir(dirname(skillFilePath), { recursive: true });
		await writeFile(skillFilePath, skillText);

		const first = await sealFixture(skillFilePath);
		const repeated = await sealFixture(skillFilePath);

		assert.match(first.sealedContextId, /^sealed_[a-f0-9]{64}$/);
		assert.equal(first.sealedContextId, repeated.sealedContextId);
		assert.equal(first.routing, "unstructured");
		assert.equal("selectionId" in first, false);
		assert.deepEqual(first.selectedPaths, []);
		assert.equal(first.materials.length, 1);
		assert.equal(first.materials[0]?.kind, "skill");
		assert.equal(
			first.materials[0]?.path,
			skillFilePath.endsWith("SKILL.md") ? "SKILL.md" : "direct.md",
		);
		assert.equal(first.materials[0]?.content, skillText);
		assert.equal(first.skillLocator, await realpath(skillFilePath));
		assert.equal(Object.isFrozen(first), true);
		assert.equal(Object.isFrozen(first.materials), true);
	}
});

test("unstructured sealing rejects assignment mismatch and Skill drift", async (t) => {
	const root = await temporaryRoot(t);
	const skillFilePath = join(root, "direct.md");
	await writeFile(skillFilePath, skillText);
	const currentCapability = capability(skillFilePath);
	const currentAssignment = assignment(currentCapability);

	const mismatched = await sealUnstructuredSkillContext({
		skillFilePath,
		capability: currentCapability,
		assignment: { ...currentAssignment, capabilityId: "cap_other" },
	});
	assert.equal(mismatched.ok, false);
	if (!mismatched.ok) assert.equal(mismatched.error.code, "identity-mismatch");

	const invalidPath = await sealUnstructuredSkillContext({
		skillFilePath: "direct.md",
		capability: currentCapability,
		assignment: currentAssignment,
	});
	assert.equal(invalidPath.ok, false);
	if (!invalidPath.ok) {
		assert.equal(invalidPath.error.code, "invalid-skill-file");
	}

	const contextDrift = await sealUnstructuredSkillContext({
		skillFilePath,
		capability: currentCapability,
		assignment: currentAssignment,
		expectedSealedContextId: "sealed_other",
	});
	assert.equal(contextDrift.ok, false);
	if (!contextDrift.ok) assert.equal(contextDrift.error.code, "context-drift");

	await writeFile(skillFilePath, `${skillText}\nchanged\n`);
	const drifted = await sealUnstructuredSkillContext({
		skillFilePath,
		capability: currentCapability,
		assignment: currentAssignment,
	});
	assert.equal(drifted.ok, false);
	if (!drifted.ok) assert.equal(drifted.error.code, "skill-drift");
});
