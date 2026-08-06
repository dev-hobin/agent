import assert from "node:assert/strict";
import test from "node:test";
import type { CapabilityAssignment } from "../src/action-loop/routing/accept-applicability.ts";
import type { SealedSkillContext } from "../src/action-loop/io/seal-skill-context.ts";
import {
	acceptSkillContribution,
	type SkillContributionProposal,
} from "../src/action-loop/contribution/accept-skill-contribution.ts";

const assignment: CapabilityAssignment = Object.freeze({
	assignmentId: "assign_1",
	workCaseId: "work-1",
	judgmentId: "judgment-1",
	contributionNeedId: "need-1",
	capabilityId: "cap_1",
	capabilityRevisionId: "caprev_1",
	applicabilityBasis: Object.freeze(["Claim assessment is required."]),
	matchedWhen: Object.freeze(["A concrete claim must be assessed."]),
});

const selectedPaths = Object.freeze([
	"references/verifier-selection.md",
	"references/pass-but-wrong.md",
]);

const sealedContext: SealedSkillContext = Object.freeze({
	sealedContextId: "sealed_1",
	workCaseId: assignment.workCaseId,
	judgmentId: assignment.judgmentId,
	contributionNeedId: assignment.contributionNeedId,
	assignmentId: assignment.assignmentId,
	selectionId: "selection_1",
	capabilityId: assignment.capabilityId,
	capabilityRevisionId: assignment.capabilityRevisionId,
	source: Object.freeze({
		kind: "package",
		locator: "npm:@hobin/developer",
		skillRoot: "skills/verify",
	}),
	skillRootLocator: "/virtual/skills/verify",
	selectedPaths,
	materials: Object.freeze([]),
});

function proposal(
	overrides: Partial<SkillContributionProposal> = {},
): SkillContributionProposal {
	return {
		workCaseId: assignment.workCaseId,
		judgmentId: assignment.judgmentId,
		contributionNeedId: assignment.contributionNeedId,
		assignmentId: assignment.assignmentId,
		capabilityId: assignment.capabilityId,
		capabilityRevisionId: assignment.capabilityRevisionId,
		sealedContextId: sealedContext.sealedContextId,
		localStatus: "resolved",
		result:
			"The claim requires an integration verifier and a negative pass-but-wrong probe.",
		referenceApplications: [
			{
				path: "references/pass-but-wrong.md",
				status: "applied",
				application:
					"A passing unit test does not observe package integration, so a negative integration probe remains necessary.",
			},
			{
				path: "references/verifier-selection.md",
				status: "applied",
				application:
					"The claim boundary selects package-level integration checks rather than unit tests alone.",
			},
		],
		limitations: [],
		residualNeeds: [],
		provenance: {
			kind: "model",
			source: "model-adapter:a",
		},
		...overrides,
	};
}

test("resolved proposal becomes one immutable source-bounded Contribution", () => {
	const result = acceptSkillContribution(
		assignment,
		sealedContext,
		proposal(),
	);

	assert.equal(result.status, "accepted");
	if (result.status !== "accepted") return;
	assert.match(result.value.contributionId, /^contribution_[a-f0-9]{64}$/);
	assert.equal(result.value.contributionNeedId, assignment.contributionNeedId);
	assert.equal(result.value.sealedContextId, sealedContext.sealedContextId);
	assert.deepEqual(
		result.value.referenceApplications.map(({ path }) => path),
		selectedPaths,
	);
	assert.equal(Object.isFrozen(result.value), true);
	assert.equal(Object.isFrozen(result.value.referenceApplications), true);
	assert.equal(Object.isFrozen(result.value.provenance), true);
	assert.equal("coverage" in result.value, false);
	assert.equal("conclusion" in result.value, false);
});

test("proposal order is normalized and provenance does not change semantic identity", () => {
	const first = acceptSkillContribution(
		assignment,
		sealedContext,
		proposal(),
	);
	const reversed = proposal({
		referenceApplications: [...proposal().referenceApplications].reverse(),
		provenance: { kind: "human", source: "reviewer:one" },
	});
	const second = acceptSkillContribution(
		assignment,
		sealedContext,
		reversed,
	);

	assert.equal(first.status, "accepted");
	assert.equal(second.status, "accepted");
	if (first.status !== "accepted" || second.status !== "accepted") return;
	assert.equal(second.value.contributionId, first.value.contributionId);
	assert.deepEqual(
		second.value.referenceApplications.map(({ path }) => path),
		selectedPaths,
	);
	assert.notDeepEqual(second.value.provenance, first.value.provenance);
});

test("SKILL-only context needs no synthetic Reference application", () => {
	const context = { ...sealedContext, selectedPaths: [] };
	const result = acceptSkillContribution(
		assignment,
		context,
		proposal({ referenceApplications: [] }),
	);

	assert.equal(result.status, "accepted");
	if (result.status === "accepted") {
		assert.deepEqual(result.value.referenceApplications, []);
	}
});

test("every selected Reference requires exactly one application", () => {
	const missing = proposal({
		referenceApplications: proposal().referenceApplications.slice(0, 1),
	});
	const duplicate = proposal({
		referenceApplications: [
			proposal().referenceApplications[0]!,
			proposal().referenceApplications[0]!,
			proposal().referenceApplications[1]!,
		],
	});
	const undeclared = proposal({
		referenceApplications: [
			...proposal().referenceApplications,
			{
				path: "references/undeclared.md",
				status: "applied",
				application: "This path was never selected.",
			},
		],
	});

	for (const candidate of [missing, duplicate, undeclared]) {
		const result = acceptSkillContribution(
			assignment,
			sealedContext,
			candidate,
		);
		assert.equal(result.status, "invalid");
		if (result.status === "invalid") {
			assert.equal(result.error.code, "reference-accounting");
		}
	}
});

test("stale Work Case, assignment, Capability, or seal identity is rejected", () => {
	for (const candidate of [
		proposal({ workCaseId: "work-stale" }),
		proposal({ assignmentId: "assign_stale" }),
		proposal({ capabilityRevisionId: "caprev_stale" }),
		proposal({ sealedContextId: "sealed_stale" }),
	]) {
		const result = acceptSkillContribution(
			assignment,
			sealedContext,
			candidate,
		);
		assert.equal(result.status, "invalid");
		if (result.status === "invalid") {
			assert.equal(result.error.code, "identity-mismatch");
		}
	}
});

test("Reference application status and bounded application text are explicit", () => {
	const unsupported = proposal({
		referenceApplications: proposal().referenceApplications.map(
			(application, index) =>
				index === 0
					? { ...application, status: "used" as "applied" }
					: application,
		),
	});
	const blank = proposal({
		referenceApplications: proposal().referenceApplications.map(
			(application, index) =>
				index === 0 ? { ...application, application: "   " } : application,
		),
	});

	for (const [candidate, code] of [
		[unsupported, "unsupported-application-status"],
		[blank, "empty-application"],
	] as const) {
		const result = acceptSkillContribution(
			assignment,
			sealedContext,
			candidate,
		);
		assert.equal(result.status, "invalid");
		if (result.status === "invalid") assert.equal(result.error.code, code);
	}
});

test("partial and resolved local statuses preserve their distinct obligations", () => {
	const unsupportedStatus = acceptSkillContribution(
		assignment,
		sealedContext,
		proposal({ localStatus: "complete" as "resolved" }),
	);
	const unsupportedPartial = acceptSkillContribution(
		assignment,
		sealedContext,
		proposal({ localStatus: "partial" }),
	);
	const resolvedWithResidual = acceptSkillContribution(
		assignment,
		sealedContext,
		proposal({
			residualNeeds: [
				{
					kind: "residual",
					description: "A claim-relevant integration run is still needed.",
					basis: ["No integration result was supplied."],
				},
			],
		}),
	);
	const acceptedPartial = acceptSkillContribution(
		assignment,
		sealedContext,
		proposal({
			localStatus: "partial",
			limitations: ["The integration environment was not available."],
			residualNeeds: [
				{
					kind: "residual",
					description: "A claim-relevant integration run is still needed.",
					basis: ["Current evidence is limited to unit tests."],
				},
			],
		}),
	);

	assert.equal(unsupportedStatus.status, "invalid");
	assert.equal(unsupportedPartial.status, "invalid");
	assert.equal(resolvedWithResidual.status, "invalid");
	assert.equal(acceptedPartial.status, "accepted");
	if (unsupportedStatus.status === "invalid") {
		assert.equal(unsupportedStatus.error.code, "unsupported-local-status");
	}
	if (unsupportedPartial.status === "invalid") {
		assert.equal(unsupportedPartial.error.code, "partial-without-limitation");
	}
	if (resolvedWithResidual.status === "invalid") {
		assert.equal(resolvedWithResidual.error.code, "resolved-with-residual");
	}
});

test("emergent Need is returned upward without assigning a sibling Capability", () => {
	const result = acceptSkillContribution(
		assignment,
		sealedContext,
		proposal({
			residualNeeds: [
				{
					kind: "emergent",
					description: "Product ownership must decide the compatibility window.",
					basis: ["Verification cannot choose product policy."],
				},
			],
		}),
	);

	assert.equal(result.status, "accepted");
	if (result.status !== "accepted") return;
	assert.equal(result.value.localStatus, "resolved");
	assert.deepEqual(result.value.residualNeeds, [
		{
			kind: "emergent",
			description: "Product ownership must decide the compatibility window.",
			basis: ["Verification cannot choose product policy."],
		},
	]);
	assert.equal("capabilityId" in result.value.residualNeeds[0]!, false);
});

test("blank, duplicate, or malformed semantic content is rejected", () => {
	for (const candidate of [
		proposal({ result: "  " }),
		proposal({ limitations: ["Bounded scope.", " Bounded scope. "] }),
		proposal({
			residualNeeds: [
				{ kind: "emergent", description: "", basis: ["A basis."] },
			],
		}),
		proposal({ provenance: { kind: "model", source: " " } }),
	]) {
		const result = acceptSkillContribution(
			assignment,
			sealedContext,
			candidate,
		);
		assert.equal(result.status, "invalid");
	}
});
