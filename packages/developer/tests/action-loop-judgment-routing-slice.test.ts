import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { type TestContext } from "node:test";
import {
	acceptSkillContribution,
	type SkillContribution,
} from "../src/action-loop/contribution/accept-skill-contribution.ts";
import { closeJudgment } from "../src/action-loop/judgment/close-judgment.ts";
import { sealSkillContext } from "../src/action-loop/io/seal-skill-context.ts";
import { assessNeedCoverage } from "../src/action-loop/need-coverage/assess-need-coverage.ts";
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
import {
	selectDeclaredReferences,
	type ReferenceDispositionStatus,
} from "../src/action-loop/routing/reference-selection.ts";

const encoder = new TextEncoder();
const skillText = "---\nname: verify\n---\nAssess a bounded claim.\n";
const verifierPath = "references/verifier-selection.md";
const riskPath = "references/pass-but-wrong.md";
const rootWhen = "A concrete integration claim must be assessed.";

async function createSkillRoot(t: TestContext): Promise<string> {
	const root = await mkdtemp(join(tmpdir(), "developer-routing-slice-"));
	t.after(async () => rm(root, { recursive: true, force: true }));
	await mkdir(join(root, "references"));
	await writeFile(join(root, "SKILL.md"), skillText);
	await writeFile(
		join(root, verifierPath),
		"Choose a verifier that directly observes the claim boundary.\n",
	);
	await writeFile(
		join(root, riskPath),
		"Probe how passing evidence could still support the wrong claim.\n",
	);
	return root;
}

function bindFixtureCapability(): BoundCapability {
	const parsed = parseTocBytes(
		encoder.encode(
			JSON.stringify({
				$schema: SKILL_TOC_SCHEMA_URI,
				when: [rootWhen],
				unless: ["No concrete claim is delegated."],
				references: [
					{ path: verifierPath, when: ["Verifier relevance"] },
					{ path: riskPath, when: ["Pass-but-wrong risk"] },
				],
			}),
		),
	);
	if (!parsed.ok) throw new Error(parsed.error.message);
	const bound = bindCapability(
		{
			kind: "project",
			locator: "project:vertical-slice",
			skillRoot: "skills/verify",
		},
		parsed.value,
		encoder.encode(skillText),
	);
	if (!bound.ok) throw new Error(bound.error.message);
	return bound.value;
}

function acceptFixtureAssignment(
	capability: BoundCapability,
): CapabilityAssignment {
	const accepted = acceptCapabilityApplicability(
		{
			workCaseId: "work-slice",
			judgmentId: "judgment-slice",
			contributionNeedId: "need-claim-assurance",
			capability,
		},
		{
			workCaseId: "work-slice",
			judgmentId: "judgment-slice",
			contributionNeedId: "need-claim-assurance",
			capabilityRevisionId: capability.capabilityRevisionId,
			status: "applicable",
			matchedWhen: [rootWhen],
			matchedUnless: [],
			basis: ["The delegated outcome contains a concrete integration claim."],
			missingContext: [],
		},
	);
	if (accepted.status !== "assigned") throw new Error(accepted.status);
	return accepted.assignment;
}

function bindFixtureSelection(
	capability: BoundCapability,
	assignment: CapabilityAssignment,
	verifierStatus: ReferenceDispositionStatus = "selected",
	riskStatus: ReferenceDispositionStatus = "selected",
): BoundReferenceSelection {
	const selected = selectDeclaredReferences(capability.toc.references, [
		{
			path: riskPath,
			status: riskStatus,
			basis: [
				riskStatus === "needs-context"
					? "The accepted claim scope is not yet known."
					: "Pass-but-wrong risk is material to this claim.",
			],
		},
		{
			path: verifierPath,
			status: verifierStatus,
			basis: ["Verifier choice changes which evidence can support the claim."],
		},
	]);
	assert.notEqual(selected.status, "invalid");
	const bound = bindReferenceSelection(assignment, capability, selected);
	if (!bound.ok) throw new Error(bound.error.message);
	return bound.value;
}

async function prepareReadyContext(t: TestContext) {
	const skillRootPath = await createSkillRoot(t);
	const capability = bindFixtureCapability();
	const assignment = acceptFixtureAssignment(capability);
	const selection = bindFixtureSelection(capability, assignment);
	const sealed = await sealSkillContext({
		skillRootPath,
		capability,
		assignment,
		selection,
	});
	if (!sealed.ok) throw new Error(sealed.error.message);
	return { skillRootPath, capability, assignment, selection, sealed: sealed.value };
}

function acceptFixtureContribution(
	assignment: CapabilityAssignment,
	sealed: Awaited<ReturnType<typeof prepareReadyContext>>["sealed"],
	overrides: {
		readonly result?: string;
		readonly localStatus?: "resolved" | "partial";
		readonly limitations?: readonly string[];
	} = {},
): SkillContribution {
	const accepted = acceptSkillContribution(assignment, sealed, {
		workCaseId: assignment.workCaseId,
		judgmentId: assignment.judgmentId,
		contributionNeedId: assignment.contributionNeedId,
		assignmentId: assignment.assignmentId,
		capabilityId: assignment.capabilityId,
		capabilityRevisionId: assignment.capabilityRevisionId,
		sealedContextId: sealed.sealedContextId,
		localStatus: overrides.localStatus ?? "resolved",
		result:
			overrides.result ??
			"The integration claim needs a direct verifier and a negative pass-but-wrong probe.",
		referenceApplications: sealed.selectedPaths.map((path) => ({
			path,
			status: "applied" as const,
			application:
				path === verifierPath
					? "The claim boundary selects package-level integration checks."
					: "A negative probe is required because unit success may not observe integration.",
		})),
		limitations: overrides.limitations ?? [],
		residualNeeds: [],
		provenance: { kind: "model", source: "deterministic-fixture" },
	});
	if (accepted.status !== "accepted") throw new Error(accepted.error.message);
	return accepted.value;
}

function closureContract(assignment: CapabilityAssignment) {
	return {
		workCaseId: assignment.workCaseId,
		judgmentId: assignment.judgmentId,
		category: "Claim Assurance" as const,
		subject: "The package satisfies its declared integration contract.",
		contextRevisionId: "context-slice",
		requirements: [
			{
				requirementId: "requirement-claim-assurance",
				statement: "The delegated integration claim is adequately assured.",
				contributionNeedIds: [assignment.contributionNeedId],
			},
		],
	};
}

function closureProposal(
	assignment: CapabilityAssignment,
	coverageId: string,
) {
	return {
		workCaseId: assignment.workCaseId,
		judgmentId: assignment.judgmentId,
		category: "Claim Assurance" as const,
		contextRevisionId: "context-slice",
		outcome: "conclude" as const,
		answer: "The integration claim is adequately assured within the tested boundary.",
		refusalReasons: [],
		requirementDispositions: [
			{
				requirementId: "requirement-claim-assurance",
				status: "satisfied" as const,
				coverageIds: [coverageId],
				basis: ["The required Need has current covered support."],
			},
		],
		basis: ["Current Coverage satisfies the Claim Assurance requirement."],
		provenance: { kind: "model" as const, source: "deterministic-fixture" },
	};
}

test("vertical slice concludes from parsed TOC through Upper closure", async (t) => {
	const prepared = await prepareReadyContext(t);
	const contribution = acceptFixtureContribution(
		prepared.assignment,
		prepared.sealed,
	);
	const coverage = assessNeedCoverage(
		{
			workCaseId: prepared.assignment.workCaseId,
			judgmentId: prepared.assignment.judgmentId,
			contributionNeedId: prepared.assignment.contributionNeedId,
		},
		[contribution],
		{
			workCaseId: prepared.assignment.workCaseId,
			judgmentId: prepared.assignment.judgmentId,
			contributionNeedId: prepared.assignment.contributionNeedId,
			status: "covered",
			dispositions: [
				{
					contributionId: contribution.contributionId,
					status: "supports",
					basis: ["The bounded result directly supplies the required input."],
				},
			],
			conflicts: [],
			basis: ["Current Contribution support is sufficient for this Need."],
			provenance: { kind: "model", source: "deterministic-fixture" },
		},
	);
	if (coverage.status !== "accepted") throw new Error(coverage.error.message);
	const closure = closeJudgment(
		closureContract(prepared.assignment),
		[coverage.value],
		closureProposal(prepared.assignment, coverage.value.coverageId),
	);

	assert.equal(closure.status, "concluded");
	if (closure.status === "concluded") {
		assert.match(closure.value.conclusionId, /^conclusion_[a-f0-9]{64}$/);
		assert.equal("actionClearance" in closure.value, false);
	}
});

test("vertical slice stops at incomplete Reference dispositions", () => {
	const capability = bindFixtureCapability();
	acceptFixtureAssignment(capability);
	const selection = selectDeclaredReferences(capability.toc.references, [
		{
			path: verifierPath,
			status: "selected",
			basis: ["The verifier method is relevant."],
		},
	]);

	assert.equal(selection.status, "invalid");
	if (selection.status === "invalid") {
		assert.deepEqual(selection.issues, [
			{ code: "missing-disposition", path: riskPath },
		]);
	}
});

test("vertical slice preserves Reference needs-context and refuses sealing", async () => {
	const capability = bindFixtureCapability();
	const assignment = acceptFixtureAssignment(capability);
	const selection = bindFixtureSelection(
		capability,
		assignment,
		"selected",
		"needs-context",
	);
	assert.equal(selection.status, "needs-context");
	const sealed = await sealSkillContext({
		skillRootPath: "/path/not-read-when-selection-is-unresolved",
		capability,
		assignment,
		selection,
	});

	assert.equal(sealed.ok, false);
	if (!sealed.ok) assert.equal(sealed.error.code, "selection-not-ready");
});

test("vertical slice detects selected-content drift before Contribution", async (t) => {
	const prepared = await prepareReadyContext(t);
	await writeFile(
		join(prepared.skillRootPath, riskPath),
		"Selected material changed after the first seal.\n",
	);
	const replay = await sealSkillContext({
		skillRootPath: prepared.skillRootPath,
		capability: prepared.capability,
		assignment: prepared.assignment,
		selection: prepared.selection,
		expectedSealedContextId: prepared.sealed.sealedContextId,
	});

	assert.equal(replay.ok, false);
	if (!replay.ok) assert.equal(replay.error.code, "context-drift");
});

test("vertical slice carries partial Coverage into closure refusal", async (t) => {
	const prepared = await prepareReadyContext(t);
	const contribution = acceptFixtureContribution(
		prepared.assignment,
		prepared.sealed,
		{
			localStatus: "partial",
			limitations: ["The external integration environment was unavailable."],
		},
	);
	const coverage = assessNeedCoverage(
		{
			workCaseId: prepared.assignment.workCaseId,
			judgmentId: prepared.assignment.judgmentId,
			contributionNeedId: prepared.assignment.contributionNeedId,
		},
		[contribution],
		{
			workCaseId: prepared.assignment.workCaseId,
			judgmentId: prepared.assignment.judgmentId,
			contributionNeedId: prepared.assignment.contributionNeedId,
			status: "partially-covered",
			dispositions: [
				{
					contributionId: contribution.contributionId,
					status: "limited-support",
					basis: ["Useful support exists, but its stated limitation remains."],
				},
			],
			conflicts: [],
			basis: ["A consequential environment limitation remains."],
			provenance: { kind: "model", source: "deterministic-fixture" },
		},
	);
	if (coverage.status !== "accepted") throw new Error(coverage.error.message);
	const closure = closeJudgment(
		closureContract(prepared.assignment),
		[coverage.value],
		closureProposal(prepared.assignment, coverage.value.coverageId),
	);

	assert.equal(closure.status, "refused");
	if (closure.status === "refused") {
		assert.equal(closure.value.blockers[0]?.code, "coverage-not-covered");
	}
});

test("vertical slice carries conflicting Contributions into closure refusal", async (t) => {
	const prepared = await prepareReadyContext(t);
	const first = acceptFixtureContribution(prepared.assignment, prepared.sealed, {
		result: "The public package boundary is the required verifier scope.",
	});
	const second = acceptFixtureContribution(prepared.assignment, prepared.sealed, {
		result: "The internal module boundary is the required verifier scope.",
	});
	const coverage = assessNeedCoverage(
		{
			workCaseId: prepared.assignment.workCaseId,
			judgmentId: prepared.assignment.judgmentId,
			contributionNeedId: prepared.assignment.contributionNeedId,
		},
		[first, second],
		{
			workCaseId: prepared.assignment.workCaseId,
			judgmentId: prepared.assignment.judgmentId,
			contributionNeedId: prepared.assignment.contributionNeedId,
			status: "conflicted",
			dispositions: [
				{
					contributionId: first.contributionId,
					status: "supports",
					basis: ["The first result supports the public-boundary interpretation."],
				},
				{
					contributionId: second.contributionId,
					status: "supports",
					basis: ["The second result supports the module-boundary interpretation."],
				},
			],
			conflicts: [
				{
					leftContributionId: second.contributionId,
					rightContributionId: first.contributionId,
					basis: ["The proposed verifier boundaries are materially incompatible."],
				},
			],
			basis: ["Current Contributions support incompatible claim boundaries."],
			provenance: { kind: "model", source: "deterministic-fixture" },
		},
	);
	if (coverage.status !== "accepted") throw new Error(coverage.error.message);
	const closure = closeJudgment(
		closureContract(prepared.assignment),
		[coverage.value],
		closureProposal(prepared.assignment, coverage.value.coverageId),
	);

	assert.equal(closure.status, "refused");
	if (closure.status === "refused") {
		assert.equal(closure.value.blockers[0]?.code, "coverage-not-covered");
	}
});
