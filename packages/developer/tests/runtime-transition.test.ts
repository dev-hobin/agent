import assert from "node:assert/strict";
import test from "node:test";

import {
	accountRoutingPage,
	beginRoutingCoverage,
	completeRoutingCoverage,
	createCandidateDisposition,
	createCanServeRoutingBasis,
	createProposedFrameContribution,
	createRoutingCandidateDescriptor,
	createRoutingCandidatePages,
	createRoutingSnapshotManifest,
	type CanServeRoutingBasis,
	type CompletedRoutingCoverage,
} from "../src/routing-context.ts";
import {
	actionableObligationIds,
	admitFrameContribution,
	attachRoutingCoverage,
	concludeRouteFrame,
	dischargeObligation,
	initialDeveloperWorkScopeState,
	openRouteFrame,
	recordReadyAssignment,
	replaceRouteFrame,
	resolveFrameBlocker,
	runtimeBlockerSetSha256,
	runtimeFrameState,
	settleSkillInvocation,
	skillReturnSupportSha256,
	startSkillInvocation,
	type DeveloperWorkScopeState,
	type RuntimeTransitionResult,
} from "../src/runtime-transition.ts";
import {
	DEVELOPER_SKILL_RETURN_CONTRACT,
	canonicalValueSha256,
	createReadySkillAssignment,
	createRouteDefinition,
	obligationSetSha256,
	parseDeveloperId,
	parseFrameConclusionProposal,
	parseInvocationSettlement,
	parseObligation,
	parseRouteFrame,
	parseSha256Digest,
	parseSnapshotBasis,
	type DeveloperId,
	type Obligation,
	type ReadySkillAssignment,
	type RouteFrame,
} from "../src/runtime-protocol.ts";

const id = (value: string) => parseDeveloperId(value);
const sha = (character: string) => parseSha256Digest(character.repeat(64));

function accept(result: RuntimeTransitionResult): DeveloperWorkScopeState {
	if (!result.ok) assert.fail(`${result.error.code}: ${result.error.message}`);
	return result.state;
}

interface FrameFixture {
	readonly frame: RouteFrame;
	readonly obligations: readonly Obligation[];
}

function frameFixture(
	suffix: string,
	frameRevision = 1,
	parentFrameId: DeveloperId | null = null,
): FrameFixture {
	const route = createRouteDefinition({
		routeDefinitionId: id(`route:${suffix}`),
		sign: `${suffix} settlement`,
		sense: `Settle the bounded ${suffix} question without delegated authority.`,
	});
	const frameId = id(`frame:${suffix}`);
	const currentObligations = [
		parseObligation({
			obligationId: id(`obligation:${suffix}-a`),
			frameId,
			statement: `The ${suffix} claim has current support.`,
		}),
		parseObligation({
			obligationId: id(`obligation:${suffix}-b`),
			frameId,
			statement: `The ${suffix} stop condition is explicit.`,
		}),
	];
	return {
		frame: parseRouteFrame({
			frameId,
			frameRevision,
			workScopeId: "scope:one",
			parentFrameId,
			routeDefinitionId: route.routeDefinitionId,
			routeDefinitionRevisionSha256: route.revisionSha256,
			exactQuestion: `What must be true for ${suffix}?`,
			obligationIds: currentObligations.map(
				(obligation) => obligation.obligationId,
			),
			obligationSetSha256: obligationSetSha256(currentObligations),
		}),
		obligations: currentObligations,
	};
}

interface PreparedFrame extends FrameFixture {
	readonly coverage: CompletedRoutingCoverage;
	readonly basis: CanServeRoutingBasis;
	readonly assignment: ReadySkillAssignment;
}

function preparedFrame(fixture: FrameFixture, suffix: string): PreparedFrame {
	const capabilityRevisionSha256 = sha("c");
	const candidate = createRoutingCandidateDescriptor({
		candidateId: id(`candidate:${suffix}`),
		kind: "capability",
		source: { sourceId: id("source:catalog"), revision: "catalog-rev-1" },
		subjectId: id(`skill:${suffix}`),
		subjectRevisionSha256: capabilityRevisionSha256,
		registryRevisionSha256: sha("d"),
	});
	const snapshotBasis = parseSnapshotBasis({
		frameId: fixture.frame.frameId,
		frameRevision: fixture.frame.frameRevision,
		obligationSetSha256: fixture.frame.obligationSetSha256,
		admittedUniverseSha256: sha("e"),
		providerSourceRevisions: [
			{ sourceId: "source:catalog", revision: "catalog-rev-1" },
		],
		priorityStrategySha256: sha("f"),
	});
	const snapshotId = id(`snapshot:${suffix}`);
	const pages = createRoutingCandidatePages(snapshotId, [candidate], 100);
	const manifest = createRoutingSnapshotManifest(
		snapshotId,
		snapshotBasis,
		pages,
	);
	const disposition = createCandidateDisposition({
		candidateId: candidate.candidateId,
		descriptorSha256: candidate.descriptorSha256,
		kind: "selected-for-material",
		targetEffects: fixture.obligations.map((obligation) => ({
			obligationId: obligation.obligationId,
			effect: "selected" as const,
		})),
		rationale: "The exact registered capability is selected.",
	});
	const coverage = completeRoutingCoverage(
		accountRoutingPage(
			beginRoutingCoverage(snapshotBasis, manifest, fixture.obligations),
			pages[0]!,
			[disposition],
		),
	);
	const targets = fixture.obligations.map(
		(obligation) => obligation.obligationId,
	);
	const basis = createCanServeRoutingBasis(coverage, {
		basisId: id(`basis:${suffix}`),
		candidateId: candidate.candidateId,
		targetObligationIds: targets,
		methodRevisionSha256: sha("1"),
		policy: { kind: "complete", revisionSha256: sha("2") },
		rootApplicability: "applicable",
	});
	const assignment = createReadySkillAssignment({
		assignmentId: id(`assignment:${suffix}`),
		skillCapabilityId: basis.capabilityId,
		skillRevisionSha256: basis.capabilityRevisionSha256,
		parentFrameId: fixture.frame.frameId,
		parentFrameRevision: fixture.frame.frameRevision,
		targetObligationIds: targets,
		subquestion: `What bounded ${suffix} contribution can this Skill return?`,
		applicabilityBasisSha256: basis.basisSha256,
		expectedContribution: `A bounded ${suffix} claim with explicit limits.`,
		limitations: ["No frame, mutation, or conclusion authority."],
		returnContract: DEVELOPER_SKILL_RETURN_CONTRACT,
		contextBasisSha256: coverage.coverageSha256,
		authority: "contribution-only",
	});
	return { ...fixture, coverage, basis, assignment };
}

function openPrepared(
	state: DeveloperWorkScopeState,
	prepared: PreparedFrame,
): DeveloperWorkScopeState {
	let next = accept(
		openRouteFrame(state, prepared.frame, prepared.obligations),
	);
	next = accept(
		attachRoutingCoverage(next, prepared.frame.frameId, prepared.coverage),
	);
	return accept(
		recordReadyAssignment(next, prepared.assignment, prepared.basis),
	);
}

function externalProposal(fixture: FrameFixture, suffix: string) {
	return createProposedFrameContribution({
		proposalId: id(`proposal:${suffix}`),
		frameId: fixture.frame.frameId,
		frameRevision: fixture.frame.frameRevision,
		source: {
			kind: "judgment-result",
			sourceId: id(`judgment:${suffix}`),
			sourceRevisionSha256: sha("3"),
		},
		claim: `The ${suffix} question has a bounded negative resolution.`,
		applicability: `The support is current for frame ${fixture.frame.frameId}.`,
		targetUses: fixture.obligations.map((obligation) => ({
			obligationId: obligation.obligationId,
			useAs: "evidence" as const,
		})),
		limitations: ["No authority transfers from the source."],
		supportSha256: sha("4"),
	});
}

function concludeWithExternalSupport(
	state: DeveloperWorkScopeState,
	fixture: FrameFixture,
	suffix: string,
): DeveloperWorkScopeState {
	const contributionId = id(`contribution:${suffix}`);
	let next = accept(
		admitFrameContribution(
			state,
			externalProposal(fixture, suffix),
			contributionId,
			sha("5"),
		),
	);
	const dischargeIds: DeveloperId[] = [];
	for (const [index, obligation] of fixture.obligations.entries()) {
		const dischargeId = id(`discharge:${suffix}-${index}`);
		dischargeIds.push(dischargeId);
		next = accept(
			dischargeObligation(next, {
				dischargeId,
				frameId: fixture.frame.frameId,
				expectedFrameRevision: fixture.frame.frameRevision,
				obligationId: obligation.obligationId,
				contributionIds: [contributionId],
				stopEvidence: [`The ${suffix} obligation has bounded current support.`],
				conclusion: `Resolved ${suffix} obligation ${index}.`,
			}),
		);
	}
	const frame = runtimeFrameState(next, fixture.frame.frameId)!;
	return accept(
		concludeRouteFrame(
			next,
			parseFrameConclusionProposal({
				frameId: fixture.frame.frameId,
				expectedFrameRevision: fixture.frame.frameRevision,
				dischargeIds: [...dischargeIds].sort(),
				stopEvidence: [`All ${suffix} obligations are explicitly discharged.`],
				expectedBlockerSetSha256: runtimeBlockerSetSha256(frame.blockers),
				conclusion: `The ${suffix} RouteFrame resolves negatively.`,
			}),
		),
	);
}

test("zero-Skill admitted support discharges and concludes without routing coverage", () => {
	const fixture = frameFixture("zero-skill");
	let state = initialDeveloperWorkScopeState(id("scope:one"));
	state = accept(openRouteFrame(state, fixture.frame, fixture.obligations));
	const premature = concludeRouteFrame(
		state,
		parseFrameConclusionProposal({
			frameId: fixture.frame.frameId,
			expectedFrameRevision: fixture.frame.frameRevision,
			dischargeIds: [],
			stopEvidence: ["No implicit completion is permitted."],
			expectedBlockerSetSha256: runtimeBlockerSetSha256([]),
			conclusion: "Premature.",
		}),
	);
	assert.equal(premature.ok, false);
	state = concludeWithExternalSupport(state, fixture, "zero-skill");
	const concluded = runtimeFrameState(state, fixture.frame.frameId)!;
	assert.notEqual(concluded.conclusion, null);
	assert.equal(concluded.routing, null);
	assert.equal(concluded.contributions.length, 1);
	assert.equal(concluded.discharges.length, 2);
});

test("one active invocation is enforced across independent frames", () => {
	const first = preparedFrame(frameFixture("first"), "first");
	const second = preparedFrame(frameFixture("second"), "second");
	let state = initialDeveloperWorkScopeState(id("scope:one"));
	state = openPrepared(state, first);
	state = openPrepared(state, second);
	state = accept(
		startSkillInvocation(
			state,
			id("invocation:first"),
			first.assignment.assignmentId,
		),
	);
	const concurrent = startSkillInvocation(
		state,
		id("invocation:second"),
		second.assignment.assignmentId,
	);
	assert.equal(concurrent.ok, false);
	if (!concurrent.ok)
		assert.equal(concurrent.error.code, "invocation-already-active");
	state = accept(
		settleSkillInvocation(
			state,
			parseInvocationSettlement({
				kind: "lifecycle",
				invocationId: "invocation:first",
				assignmentId: first.assignment.assignmentId,
				lifecycle: {
					kind: "cancelled",
					reason: "Explicit runtime cancellation.",
					executionUncertain: true,
				},
			}),
		),
	);
	assert.equal(
		runtimeFrameState(state, first.frame.frameId)?.blockers.length,
		0,
	);
	state = accept(
		startSkillInvocation(
			state,
			id("invocation:second"),
			second.assignment.assignmentId,
		),
	);
	assert.equal(state.activeInvocation?.frameId, second.frame.frameId);
});

test("dependency and failure blockers stay targeted while lifecycle remains non-failure", () => {
	const prepared = preparedFrame(frameFixture("dependency"), "dependency");
	let state = openPrepared(
		initialDeveloperWorkScopeState(id("scope:one")),
		prepared,
	);
	state = accept(
		startSkillInvocation(
			state,
			id("invocation:dependency"),
			prepared.assignment.assignmentId,
		),
	);
	const dependencySettlement = parseInvocationSettlement({
		kind: "returned",
		invocationId: "invocation:dependency",
		assignmentId: prepared.assignment.assignmentId,
		value: {
			kind: "dependency",
			dependencyId: "dependency:child",
			targetObligationIds: [prepared.obligations[0]!.obligationId],
			question: "Which prerequisite settles the first obligation?",
			reason: "Only the first obligation depends on it.",
		},
	});
	state = accept(settleSkillInvocation(state, dependencySettlement));
	assert.deepEqual(actionableObligationIds(state, prepared.frame.frameId), [
		prepared.obligations[1]!.obligationId,
	]);
	const duplicate = settleSkillInvocation(state, dependencySettlement);
	assert.equal(duplicate.ok, false);
	if (!duplicate.ok)
		assert.equal(duplicate.error.code, "invocation-not-active");
	const current = runtimeFrameState(state, prepared.frame.frameId)!;
	state = accept(
		resolveFrameBlocker(
			state,
			prepared.frame.frameId,
			current.blockers[0]!.blockerId,
			sha("6"),
		),
	);
	assert.deepEqual(actionableObligationIds(state, prepared.frame.frameId), [
		prepared.obligations[0]!.obligationId,
		prepared.obligations[1]!.obligationId,
	]);

	const failed = preparedFrame(frameFixture("failure"), "failure");
	let failedState = openPrepared(
		initialDeveloperWorkScopeState(id("scope:one")),
		failed,
	);
	failedState = accept(
		startSkillInvocation(
			failedState,
			id("invocation:failure"),
			failed.assignment.assignmentId,
		),
	);
	failedState = accept(
		settleSkillInvocation(
			failedState,
			parseInvocationSettlement({
				kind: "capability-failed",
				invocationId: "invocation:failure",
				assignmentId: failed.assignment.assignmentId,
				failure: { kind: "resolver-error", message: "Resolver unavailable." },
			}),
		),
	);
	assert.deepEqual(
		actionableObligationIds(failedState, failed.frame.frameId),
		[],
	);
	assert.equal(
		runtimeFrameState(failedState, failed.frame.frameId)?.blockers[0]?.kind,
		"capability-failure",
	);

	const needsContext = preparedFrame(
		frameFixture("needs-context"),
		"needs-context",
	);
	let needsContextState = openPrepared(
		initialDeveloperWorkScopeState(id("scope:one")),
		needsContext,
	);
	needsContextState = accept(
		startSkillInvocation(
			needsContextState,
			id("invocation:needs-context"),
			needsContext.assignment.assignmentId,
		),
	);
	needsContextState = accept(
		settleSkillInvocation(
			needsContextState,
			parseInvocationSettlement({
				kind: "returned",
				invocationId: "invocation:needs-context",
				assignmentId: needsContext.assignment.assignmentId,
				value: {
					kind: "needs-context",
					targetObligationIds: [needsContext.obligations[0]!.obligationId],
					missingContext: ["An exact provider revision is missing."],
				},
			}),
		),
	);
	assert.deepEqual(
		actionableObligationIds(needsContextState, needsContext.frame.frameId),
		[needsContext.obligations[1]!.obligationId],
	);
	assert.equal(
		runtimeFrameState(needsContextState, needsContext.frame.frameId)
			?.blockers[0]?.kind,
		"needs-context",
	);
});

test("returned Skill Contribution requires exact explicit admission and never auto-discharges", () => {
	const prepared = preparedFrame(frameFixture("skill-return"), "skill-return");
	let state = openPrepared(
		initialDeveloperWorkScopeState(id("scope:one")),
		prepared,
	);
	state = accept(
		startSkillInvocation(
			state,
			id("invocation:skill-return"),
			prepared.assignment.assignmentId,
		),
	);
	const settlement = parseInvocationSettlement({
		kind: "returned",
		invocationId: "invocation:skill-return",
		assignmentId: prepared.assignment.assignmentId,
		value: {
			kind: "contribution",
			claim: "The first obligation has bounded support.",
			applicability: "Current frame and first target only.",
			targetUses: [
				{
					obligationId: prepared.obligations[0]!.obligationId,
					useAs: "evidence",
				},
			],
			limitations: ["Does not settle the second obligation."],
		},
	});
	if (
		settlement.kind !== "returned" ||
		settlement.value.kind !== "contribution"
	) {
		assert.fail("expected parsed Contribution return");
	}
	const returnedContribution = settlement.value;
	state = accept(settleSkillInvocation(state, settlement));
	assert.equal(
		runtimeFrameState(state, prepared.frame.frameId)?.contributions.length,
		0,
	);
	assert.equal(
		runtimeFrameState(state, prepared.frame.frameId)?.discharges.length,
		0,
	);

	const supportSha256 = skillReturnSupportSha256(settlement);
	const exactProposal = createProposedFrameContribution({
		proposalId: id("proposal:skill-return"),
		frameId: prepared.frame.frameId,
		frameRevision: prepared.frame.frameRevision,
		source: {
			kind: "skill-return",
			sourceId: id("invocation:skill-return"),
			sourceRevisionSha256: supportSha256,
		},
		claim: returnedContribution.claim,
		applicability: returnedContribution.applicability,
		targetUses: returnedContribution.targetUses,
		limitations: returnedContribution.limitations,
		supportSha256,
	});
	const forged = admitFrameContribution(
		state,
		createProposedFrameContribution({
			proposalId: id("proposal:forged"),
			frameId: exactProposal.frameId,
			frameRevision: exactProposal.frameRevision,
			source: exactProposal.source,
			claim: "A different claim.",
			applicability: exactProposal.applicability,
			targetUses: exactProposal.targetUses,
			limitations: exactProposal.limitations,
			supportSha256: exactProposal.supportSha256,
		}),
		id("contribution:forged"),
		sha("7"),
	);
	assert.equal(forged.ok, false);
	state = accept(
		admitFrameContribution(
			state,
			exactProposal,
			id("contribution:skill-return"),
			sha("7"),
		),
	);
	assert.equal(
		runtimeFrameState(state, prepared.frame.frameId)?.contributions.length,
		1,
	);
	assert.equal(
		runtimeFrameState(state, prepared.frame.frameId)?.discharges.length,
		0,
	);
});

test("child conclusion never resolves or concludes its parent", () => {
	const parent = frameFixture("parent");
	const child = frameFixture("child", 1, parent.frame.frameId);
	let state = initialDeveloperWorkScopeState(id("scope:one"));
	state = accept(openRouteFrame(state, parent.frame, parent.obligations));
	state = accept(
		openRouteFrame(state, child.frame, child.obligations, {
			blockerId: id("blocker:child"),
			targetObligationIds: [parent.obligations[0]!.obligationId],
			reason:
				"The child question is a prerequisite for the first parent obligation.",
		}),
	);
	state = concludeWithExternalSupport(state, child, "child");
	const parentState = runtimeFrameState(state, parent.frame.frameId)!;
	assert.equal(parentState.blockers.length, 1);
	assert.equal(parentState.conclusion, null);
	assert.deepEqual(actionableObligationIds(state, parent.frame.frameId), [
		parent.obligations[1]!.obligationId,
	]);
	const blockedConclusion = concludeRouteFrame(
		state,
		parseFrameConclusionProposal({
			frameId: parent.frame.frameId,
			expectedFrameRevision: parent.frame.frameRevision,
			dischargeIds: [],
			stopEvidence: ["A child result cannot bypass the parent blocker."],
			expectedBlockerSetSha256: runtimeBlockerSetSha256(parentState.blockers),
			conclusion: "Forbidden parent auto-conclusion.",
		}),
	);
	assert.equal(blockedConclusion.ok, false);
	if (!blockedConclusion.ok) {
		assert.equal(blockedConclusion.error.code, "conclusion-not-ready");
	}
});

test("raw and spread-cloned values cannot carry routing or runtime authority", () => {
	const prepared = preparedFrame(frameFixture("forged"), "forged");
	let state = initialDeveloperWorkScopeState(id("scope:one"));
	state = accept(openRouteFrame(state, prepared.frame, prepared.obligations));
	state = accept(
		attachRoutingCoverage(state, prepared.frame.frameId, prepared.coverage),
	);

	const clonedState = { ...state } as DeveloperWorkScopeState;
	const clonedResult = recordReadyAssignment(
		clonedState,
		prepared.assignment,
		prepared.basis,
	);
	assert.equal(clonedResult.ok, false);
	if (!clonedResult.ok) assert.equal(clonedResult.error.code, "invalid-input");

	const forgedBody = {
		basisId: id("basis:unselected-forged"),
		kind: "can-serve" as const,
		snapshotId: prepared.coverage.manifest.snapshotId,
		frameId: prepared.frame.frameId,
		frameRevision: prepared.frame.frameRevision,
		candidateId: id("candidate:not-selected"),
		capabilityId: id("skill:not-selected"),
		capabilityRevisionSha256: sha("8"),
		descriptorSha256: sha("9"),
		targetObligationIds: prepared.obligations.map(
			(obligation) => obligation.obligationId,
		),
		methodRevisionSha256: sha("a"),
		policy: { kind: "absent" as const },
		rootApplicability: "applicable" as const,
		contextBasisSha256: prepared.coverage.coverageSha256,
	};
	const forgedBasis = {
		...forgedBody,
		basisSha256: canonicalValueSha256({
			domain: "developer/v8/can-serve-routing-basis",
			basis: forgedBody,
		}),
	} as CanServeRoutingBasis;
	const forgedAssignment = createReadySkillAssignment({
		assignmentId: id("assignment:unselected-forged"),
		skillCapabilityId: forgedBasis.capabilityId,
		skillRevisionSha256: forgedBasis.capabilityRevisionSha256,
		parentFrameId: prepared.frame.frameId,
		parentFrameRevision: prepared.frame.frameRevision,
		targetObligationIds: forgedBasis.targetObligationIds,
		subquestion: "Can a capability absent from the snapshot serve?",
		applicabilityBasisSha256: forgedBasis.basisSha256,
		expectedContribution: "This assignment must be rejected.",
		limitations: [],
		returnContract: DEVELOPER_SKILL_RETURN_CONTRACT,
		contextBasisSha256: prepared.coverage.coverageSha256,
		authority: "contribution-only",
	});
	const forgedResult = recordReadyAssignment(
		state,
		forgedAssignment,
		forgedBasis,
	);
	assert.equal(forgedResult.ok, false);
	if (!forgedResult.ok) assert.equal(forgedResult.error.code, "invalid-input");
});

test("replacement clears frame-local authority and old assignment bases become stale", () => {
	const original = preparedFrame(frameFixture("replace"), "replace");
	let state = openPrepared(
		initialDeveloperWorkScopeState(id("scope:one")),
		original,
	);
	const replacement = frameFixture("replace", 2);
	state = accept(
		replaceRouteFrame(state, replacement.frame, replacement.obligations),
	);
	const current = runtimeFrameState(state, replacement.frame.frameId)!;
	assert.equal(current.routing, null);
	assert.equal(current.contributions.length, 0);
	assert.equal(current.discharges.length, 0);
	assert.equal(
		state.assignments.some(
			(entry) =>
				entry.assignment.assignmentId === original.assignment.assignmentId,
		),
		false,
	);
	const stale = recordReadyAssignment(
		state,
		original.assignment,
		original.basis,
	);
	assert.equal(stale.ok, false);
	if (!stale.ok) assert.equal(stale.error.code, "assignment-not-ready");
});
