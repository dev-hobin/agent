import assert from "node:assert/strict";
import test from "node:test";

import { jsonValueFromUnknown } from "@hobin/judgment";

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
	type CanServeRoutingBasisBody,
	type ProposedFrameContributionBody,
} from "../src/routing-context.ts";
import {
	createRuntimeChangeAuthorization,
	createRuntimeImplementationLanding,
	createRuntimeScopeClosure,
} from "../src/runtime-root.ts";
import {
	proposeReloadReconciliation,
	replayDeveloperRuntime,
	verifyAcceptedDeveloperEvent,
} from "../src/runtime-replay.ts";
import {
	DEVELOPER_RUNTIME_PROTOCOL,
	DEVELOPER_SKILL_RETURN_CONTRACT,
	canonicalValueSha256,
	createDeveloperEventEnvelope,
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
	type DeveloperEventEnvelope,
	type DeveloperEventRef,
	type DeveloperId,
	type Obligation,
	type ReadySkillAssignment,
	type RouteFrame,
} from "../src/runtime-protocol.ts";
import {
	runtimeBlockerSetSha256,
	runtimeFrameState,
} from "../src/runtime-transition.ts";

const id = (value: string) => parseDeveloperId(value);
const sha = (character: string) => parseSha256Digest(character.repeat(64));

interface EventWriter {
	readonly workScopeId: DeveloperId;
	nextSequence: number;
	previousSha256: ReturnType<typeof sha> | null;
	nextEvent: number;
}

function writer(scope: string): EventWriter {
	return {
		workScopeId: id(`scope:${scope}`),
		nextSequence: 0,
		previousSha256: null,
		nextEvent: 0,
	};
}

function ref(envelope: DeveloperEventEnvelope): DeveloperEventRef {
	return {
		workScopeId: envelope.workScopeId,
		eventId: envelope.eventId,
		eventSha256: envelope.eventSha256,
	};
}

function append(
	state: EventWriter,
	kind: string,
	payload: unknown,
	options: {
		readonly causalRefs?: readonly DeveloperEventRef[];
		readonly occurredAt?: string;
		readonly advance?: boolean;
		readonly eventId?: string;
		readonly scopeSequence?: number;
		readonly previousScopeEventSha256?: ReturnType<typeof sha> | null;
	} = {},
): DeveloperEventEnvelope {
	const envelope = createDeveloperEventEnvelope({
		protocolVersion: DEVELOPER_RUNTIME_PROTOCOL,
		eventId: id(
			options.eventId ?? `event:${state.workScopeId}:${state.nextEvent}`,
		),
		workScopeId: state.workScopeId,
		scopeSequence: options.scopeSequence ?? state.nextSequence,
		previousScopeEventSha256:
			options.previousScopeEventSha256 === undefined
				? state.previousSha256
				: options.previousScopeEventSha256,
		causalRefs: [...(options.causalRefs ?? [])].sort((left, right) => {
			const leftKey = `${left.workScopeId}:${left.eventId}:${left.eventSha256}`;
			const rightKey = `${right.workScopeId}:${right.eventId}:${right.eventSha256}`;
			if (leftKey < rightKey) return -1;
			if (leftKey > rightKey) return 1;
			return 0;
		}),
		occurredAt: options.occurredAt ?? "2030-01-01T00:00:00.000Z",
		kind: id(kind),
		payload: jsonValueFromUnknown(payload),
	});
	state.nextEvent += 1;
	if (options.advance !== false) {
		state.nextSequence += 1;
		state.previousSha256 = envelope.eventSha256;
	}
	return envelope;
}

function persisted(entries: readonly unknown[]): readonly unknown[] {
	return JSON.parse(JSON.stringify(entries));
}

interface FrameFixture {
	readonly frame: RouteFrame;
	readonly obligations: readonly Obligation[];
}

function frameFixture(
	suffix: string,
	workScopeId: DeveloperId,
	parentFrameId: DeveloperId | null = null,
): FrameFixture {
	const route = createRouteDefinition({
		routeDefinitionId: id(`route:${suffix}`),
		sign: `${suffix} settlement`,
		sense: `Settle the exact ${suffix} question with bounded current support.`,
	});
	const frameId = id(`frame:${suffix}`);
	const obligations = [
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
			frameRevision: 1,
			workScopeId,
			parentFrameId,
			routeDefinitionId: route.routeDefinitionId,
			routeDefinitionRevisionSha256: route.revisionSha256,
			exactQuestion: `What must be true for ${suffix}?`,
			obligationIds: obligations.map((obligation) => obligation.obligationId),
			obligationSetSha256: obligationSetSha256(obligations),
		}),
		obligations,
	};
}

function replacementFixture(
	current: FrameFixture,
	suffix: string,
): FrameFixture {
	const obligations = [
		parseObligation({
			obligationId: id(`obligation:${suffix}-replacement-a`),
			frameId: current.frame.frameId,
			statement: `The replacement ${suffix} claim has fresh support.`,
		}),
		parseObligation({
			obligationId: id(`obligation:${suffix}-replacement-b`),
			frameId: current.frame.frameId,
			statement: `The replacement ${suffix} stop condition is explicit.`,
		}),
	];
	return {
		frame: parseRouteFrame({
			...current.frame,
			frameRevision: current.frame.frameRevision + 1,
			exactQuestion: `What must now be true for replacement ${suffix}?`,
			obligationIds: obligations.map((obligation) => obligation.obligationId),
			obligationSetSha256: obligationSetSha256(obligations),
		}),
		obligations,
	};
}

function openScopeEvent(state: EventWriter, occurredAt?: string) {
	return append(state, "work-scope-opened", {}, { occurredAt });
}

function openFrameEvent(state: EventWriter, fixture: FrameFixture) {
	return append(state, "route-frame-opened", {
		frame: fixture.frame,
		obligations: fixture.obligations,
		parentDependency: null,
	});
}

interface RoutingFixture {
	readonly snapshotId: DeveloperId;
	readonly snapshotBasis: ReturnType<typeof parseSnapshotBasis>;
	readonly page: ReturnType<typeof createRoutingCandidatePages>[number];
	readonly disposition: ReturnType<typeof createCandidateDisposition>;
	readonly manifest: ReturnType<typeof createRoutingSnapshotManifest>;
	readonly expectedCoverageSha256: ReturnType<typeof sha>;
	readonly basisBody: CanServeRoutingBasisBody;
	readonly expectedBasisSha256: ReturnType<typeof sha>;
	readonly assignment: ReadySkillAssignment;
}

function routingFixture(fixture: FrameFixture, suffix: string): RoutingFixture {
	const capability = createRoutingCandidateDescriptor({
		candidateId: id(`candidate:${suffix}`),
		kind: "capability",
		source: { sourceId: id("source:catalog"), revision: "catalog-rev-1" },
		subjectId: id(`skill:${suffix}`),
		subjectRevisionSha256: sha("c"),
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
	const pages = createRoutingCandidatePages(snapshotId, [capability], 100);
	const page = pages[0]!;
	const manifest = createRoutingSnapshotManifest(
		snapshotId,
		snapshotBasis,
		pages,
	);
	const disposition = createCandidateDisposition({
		candidateId: capability.candidateId,
		descriptorSha256: capability.descriptorSha256,
		kind: "selected-for-material",
		targetEffects: fixture.obligations.map((obligation) => ({
			obligationId: obligation.obligationId,
			effect: "selected" as const,
		})),
		rationale: "The exact capability is selected for current targets.",
	});
	const coverage = completeRoutingCoverage(
		accountRoutingPage(
			beginRoutingCoverage(snapshotBasis, manifest, fixture.obligations),
			page,
			[disposition],
		),
	);
	const basisBody: CanServeRoutingBasisBody = {
		basisId: id(`basis:${suffix}`),
		candidateId: capability.candidateId,
		targetObligationIds: fixture.obligations.map(
			(obligation) => obligation.obligationId,
		),
		methodRevisionSha256: sha("1"),
		policy: { kind: "complete", revisionSha256: sha("2") },
		rootApplicability: "applicable",
	};
	const basis = createCanServeRoutingBasis(coverage, basisBody);
	const assignment = createReadySkillAssignment({
		assignmentId: id(`assignment:${suffix}`),
		skillCapabilityId: basis.capabilityId,
		skillRevisionSha256: basis.capabilityRevisionSha256,
		parentFrameId: fixture.frame.frameId,
		parentFrameRevision: fixture.frame.frameRevision,
		targetObligationIds: basis.targetObligationIds,
		subquestion: `What bounded ${suffix} contribution can this Skill return?`,
		applicabilityBasisSha256: basis.basisSha256,
		expectedContribution: `A bounded ${suffix} claim.`,
		limitations: ["No frame or conclusion authority."],
		returnContract: DEVELOPER_SKILL_RETURN_CONTRACT,
		contextBasisSha256: coverage.coverageSha256,
		authority: "contribution-only",
	});
	return {
		snapshotId,
		snapshotBasis,
		page,
		disposition,
		manifest,
		expectedCoverageSha256: coverage.coverageSha256,
		basisBody,
		expectedBasisSha256: basis.basisSha256,
		assignment,
	};
}

function appendRouting(
	state: EventWriter,
	routing: RoutingFixture,
): readonly DeveloperEventEnvelope[] {
	return [
		append(state, "routing-snapshot-opened", {
			basis: routing.snapshotBasis,
			manifest: routing.manifest,
			replacesSnapshotId: null,
		}),
		append(state, "routing-page-accounted", {
			page: routing.page,
			dispositions: [routing.disposition],
		}),
		append(state, "routing-coverage-completed", {
			snapshotId: routing.snapshotId,
			expectedCoverageSha256: routing.expectedCoverageSha256,
		}),
		append(state, "can-serve-basis-created", {
			snapshotId: routing.snapshotId,
			body: routing.basisBody,
			expectedBasisSha256: routing.expectedBasisSha256,
		}),
		append(state, "ready-assignment-recorded", {
			assignment: routing.assignment,
			basisId: routing.basisBody.basisId,
		}),
	];
}

function externalProposal(
	fixture: FrameFixture,
	suffix: string,
	sourceRevisionSha256 = sha("3"),
	supportSha256 = sha("4"),
): ProposedFrameContributionBody {
	return {
		proposalId: id(`proposal:${suffix}`),
		frameId: fixture.frame.frameId,
		frameRevision: fixture.frame.frameRevision,
		source: {
			kind: "judgment-result",
			sourceId: id(`judgment:${suffix}`),
			sourceRevisionSha256,
		},
		claim: `The ${suffix} question has bounded current support.`,
		applicability: `The support applies to frame ${fixture.frame.frameId}.`,
		targetUses: fixture.obligations.map((obligation) => ({
			obligationId: obligation.obligationId,
			useAs: "evidence" as const,
		})),
		limitations: ["No authority transfers from the source."],
		supportSha256,
	};
}

function appendExternalConclusion(
	state: EventWriter,
	fixture: FrameFixture,
	suffix: string,
): Readonly<{
	events: readonly DeveloperEventEnvelope[];
	conclusion: DeveloperEventEnvelope;
	proposal: ReturnType<typeof parseFrameConclusionProposal>;
}> {
	const support = append(state, "support-observed", {
		support: {
			supportId: id(`support:${suffix}`),
			sourceKind: "judgment-result",
			sourceId: id(`judgment:${suffix}`),
			sourceRevisionSha256: sha("3"),
			supportSha256: sha("4"),
		},
	});
	const proposalBody = externalProposal(fixture, suffix);
	const proposal = createProposedFrameContribution(proposalBody);
	const admission = append(
		state,
		"frame-contribution-admitted",
		{
			proposal: proposalBody,
			expectedProposalSha256: proposal.proposalSha256,
			contributionId: id(`contribution:${suffix}`),
			admissionBasisSha256: sha("5"),
		},
		{ causalRefs: [ref(support)] },
	);
	const discharges = fixture.obligations.map((obligation, index) =>
		append(state, "obligation-discharged", {
			discharge: {
				dischargeId: id(`discharge:${suffix}-${index}`),
				frameId: fixture.frame.frameId,
				expectedFrameRevision: fixture.frame.frameRevision,
				obligationId: obligation.obligationId,
				contributionIds: [id(`contribution:${suffix}`)],
				stopEvidence: [`The ${suffix} obligation has current support.`],
				conclusion: `Resolved ${suffix} obligation ${index}.`,
			},
		}),
	);
	const conclusionProposal = parseFrameConclusionProposal({
		frameId: fixture.frame.frameId,
		expectedFrameRevision: fixture.frame.frameRevision,
		dischargeIds: discharges
			.map((_, index) => id(`discharge:${suffix}-${index}`))
			.sort(),
		stopEvidence: [`Every ${suffix} obligation is discharged.`],
		expectedBlockerSetSha256: runtimeBlockerSetSha256([]),
		conclusion: `The ${suffix} frame is resolved.`,
	});
	const conclusion = append(state, "route-frame-concluded", {
		proposal: conclusionProposal,
	});
	return {
		events: [support, admission, ...discharges, conclusion],
		conclusion,
		proposal: conclusionProposal,
	};
}

test("branch order, not timestamps, admits interleaved scopes and rejects without advancing heads", () => {
	const first = writer("first");
	const second = writer("second");
	const openFirst = openScopeEvent(first, "2035-01-01T00:00:00.000Z");
	const openSecond = openScopeEvent(second, "2020-01-01T00:00:00.000Z");
	const unknown = append(first, "unknown-event", {}, { advance: false });
	const unresolved = append(
		first,
		"support-observed",
		{
			support: {
				supportId: "support:future",
				sourceKind: "judgment-result",
				sourceId: "judgment:future",
				sourceRevisionSha256: sha("1"),
				supportSha256: sha("2"),
			},
		},
		{
			advance: false,
			causalRefs: [
				{
					workScopeId: openFirst.workScopeId,
					eventId: openFirst.eventId,
					eventSha256: sha("3"),
				},
			],
		},
	);
	const corrected = append(first, "support-observed", {
		support: {
			supportId: "support:current",
			sourceKind: "judgment-result",
			sourceId: "judgment:current",
			sourceRevisionSha256: sha("4"),
			supportSha256: sha("5"),
		},
	});
	const broken = append(
		first,
		"support-observed",
		{
			support: {
				supportId: "support:broken",
				sourceKind: "judgment-result",
				sourceId: "judgment:broken",
				sourceRevisionSha256: sha("6"),
				supportSha256: sha("7"),
			},
		},
		{
			advance: false,
			eventId: "event:broken-chain",
			scopeSequence: 9,
			previousScopeEventSha256: corrected.eventSha256,
		},
	);
	const foreign = {
		protocolVersion: "foreign/runtime",
		eventId: "legacy:event",
	};
	const duplicate = openFirst;
	const result = replayDeveloperRuntime(
		persisted([
			foreign,
			{},
			openFirst,
			openSecond,
			unknown,
			unresolved,
			corrected,
			broken,
			duplicate,
		]),
	);
	assert.equal(result.acceptedCount, 3);
	assert.equal(result.rejectedCount, 6);
	assert.deepEqual(
		result.dispositions.map((entry) =>
			entry.kind === "accepted" ? "accepted" : entry.fault.code,
		),
		[
			"unsupported-protocol",
			"invalid-envelope",
			"accepted",
			"accepted",
			"unknown-event-kind",
			"unresolved-causal-ref",
			"accepted",
			"scope-sequence-mismatch",
			"duplicate-event-id",
		],
	);
	assert.equal(result.scopes[0]?.head.scopeSequence, 1);
	assert.equal(result.scopes[1]?.head.scopeSequence, 0);
	assert.equal(
		verifyAcceptedDeveloperEvent(result.acceptedEvents[0]!),
		result.acceptedEvents[0],
	);
});

test("serialized routing state reconstructs through checked creators and reload only proposes uncertain cancellation", () => {
	const state = writer("routing");
	const fixture = frameFixture("routing", state.workScopeId);
	const routing = routingFixture(fixture, "routing");
	const events = [
		openScopeEvent(state),
		openFrameEvent(state, fixture),
		...appendRouting(state, routing),
	];
	const start = append(state, "skill-invocation-started", {
		invocationId: id("invocation:routing"),
		assignmentId: routing.assignment.assignmentId,
	});
	events.push(start);
	const replay = replayDeveloperRuntime(persisted(events));
	assert.equal(replay.rejectedCount, 0);
	assert.equal(
		replay.scopes[0]?.state.activeInvocation?.invocationId,
		id("invocation:routing"),
	);
	assert.equal(replay.scopes[0]?.routingSnapshots[0]?.status, "completed");
	assert.equal(replay.scopes[0]?.canServeBases.length, 1);

	const proposals = proposeReloadReconciliation(replay);
	assert.equal(proposals.length, 1);
	assert.equal(proposals[0]?.settlement.kind, "lifecycle");
	if (proposals[0]?.settlement.kind !== "lifecycle")
		assert.fail("expected lifecycle");
	assert.equal(proposals[0].settlement.lifecycle.kind, "cancelled");
	assert.equal(proposals[0].settlement.lifecycle.executionUncertain, true);
	assert.deepEqual(proposals[0].causalRefs, [ref(start)]);
	assert.equal(
		replay.scopes[0]?.state.activeInvocation?.invocationId,
		id("invocation:routing"),
	);
	assert.throws(
		() => proposeReloadReconciliation({ ...replay }),
		(error: unknown) =>
			typeof error === "object" &&
			error !== null &&
			"message" in error &&
			error.message === "replay result was not created by this runtime",
	);
	assert.throws(
		() => verifyAcceptedDeveloperEvent({ ...replay.acceptedEvents[0]! }),
		(error: unknown) =>
			typeof error === "object" &&
			error !== null &&
			"message" in error &&
			error.message === "accepted event was not created by replay",
	);

	const cancelled = append(state, "invocation-settled", {
		settlement: parseInvocationSettlement({
			kind: "lifecycle",
			invocationId: "invocation:routing",
			assignmentId: routing.assignment.assignmentId,
			lifecycle: {
				kind: "cancelled",
				reason: "Explicit runtime cancellation before persistence.",
				executionUncertain: false,
			},
		}),
	});
	events.push(cancelled);
	const settledReplay = replayDeveloperRuntime(persisted(events));
	assert.equal(settledReplay.rejectedCount, 0);
	assert.equal(settledReplay.scopes[0]?.state.activeInvocation, null);
	assert.equal(proposeReloadReconciliation(settledReplay).length, 0);
	assert.equal(
		runtimeFrameState(settledReplay.scopes[0]!.state, fixture.frame.frameId)
			?.blockers.length,
		0,
	);
});

test("Skill admission requires its exact settlement cause and first terminal settlement wins", () => {
	const state = writer("skill");
	const fixture = frameFixture("skill", state.workScopeId);
	const routing = routingFixture(fixture, "skill");
	const events: DeveloperEventEnvelope[] = [
		openScopeEvent(state),
		openFrameEvent(state, fixture),
		...appendRouting(state, routing),
	];
	const realStart = append(state, "skill-invocation-started", {
		invocationId: id("invocation:skill"),
		assignmentId: routing.assignment.assignmentId,
	});
	events.push(realStart);
	const settlement = parseInvocationSettlement({
		kind: "returned",
		invocationId: "invocation:skill",
		assignmentId: routing.assignment.assignmentId,
		value: {
			kind: "contribution",
			claim: "The first Skill obligation has support.",
			applicability: "Current Skill frame and first obligation.",
			targetUses: [
				{
					obligationId: fixture.obligations[0]!.obligationId,
					useAs: "evidence",
				},
			],
			limitations: ["Does not settle the second obligation."],
		},
	});
	const settled = append(state, "invocation-settled", { settlement });
	events.push(settled);
	if (
		settlement.kind !== "returned" ||
		settlement.value.kind !== "contribution"
	) {
		assert.fail("expected Contribution settlement");
	}
	const supportSha256 = canonicalValueSha256({
		domain: "developer/v8/skill-return-support",
		settlement,
	});
	const proposalBody: ProposedFrameContributionBody = {
		proposalId: id("proposal:skill"),
		frameId: fixture.frame.frameId,
		frameRevision: fixture.frame.frameRevision,
		source: {
			kind: "skill-return",
			sourceId: settlement.invocationId,
			sourceRevisionSha256: supportSha256,
		},
		claim: settlement.value.claim,
		applicability: settlement.value.applicability,
		targetUses: settlement.value.targetUses,
		limitations: settlement.value.limitations,
		supportSha256,
	};
	const proposal = createProposedFrameContribution(proposalBody);
	const missingCause = append(
		state,
		"frame-contribution-admitted",
		{
			proposal: proposalBody,
			expectedProposalSha256: proposal.proposalSha256,
			contributionId: id("contribution:skill"),
			admissionBasisSha256: sha("6"),
		},
		{ advance: false },
	);
	const admitted = append(
		state,
		"frame-contribution-admitted",
		{
			proposal: proposalBody,
			expectedProposalSha256: proposal.proposalSha256,
			contributionId: id("contribution:skill"),
			admissionBasisSha256: sha("6"),
		},
		{ causalRefs: [ref(settled)] },
	);
	events.push(missingCause, admitted);
	const late = append(
		state,
		"invocation-settled",
		{
			settlement: parseInvocationSettlement({
				kind: "lifecycle",
				invocationId: "invocation:skill",
				assignmentId: routing.assignment.assignmentId,
				lifecycle: {
					kind: "cancelled",
					reason: "Late duplicate terminal settlement.",
					executionUncertain: false,
				},
			}),
		},
		{ advance: false },
	);
	events.push(late);
	const replay = replayDeveloperRuntime(persisted(events));
	assert.deepEqual(
		replay.dispositions
			.slice(-3)
			.map((entry) =>
				entry.kind === "accepted" ? "accepted" : entry.fault.code,
			),
		["source-causality-missing", "accepted", "semantic-transition-rejected"],
	);
	assert.equal(
		runtimeFrameState(replay.scopes[0]!.state, fixture.frame.frameId)
			?.contributions.length,
		1,
	);
	assert.equal(proposeReloadReconciliation(replay).length, 0);
});

test("external support causality rejects atomically and corrected same-sequence admission can conclude", () => {
	const state = writer("external");
	const fixture = frameFixture("external", state.workScopeId);
	const events: DeveloperEventEnvelope[] = [
		openScopeEvent(state),
		openFrameEvent(state, fixture),
	];
	const support = append(state, "support-observed", {
		support: {
			supportId: "support:external",
			sourceKind: "judgment-result",
			sourceId: "judgment:external",
			sourceRevisionSha256: sha("3"),
			supportSha256: sha("4"),
		},
	});
	events.push(support);
	const body = externalProposal(fixture, "external");
	const proposal = createProposedFrameContribution(body);
	const rejected = append(
		state,
		"frame-contribution-admitted",
		{
			proposal: body,
			expectedProposalSha256: proposal.proposalSha256,
			contributionId: "contribution:external",
			admissionBasisSha256: sha("5"),
		},
		{ advance: false },
	);
	const corrected = append(
		state,
		"frame-contribution-admitted",
		{
			proposal: body,
			expectedProposalSha256: proposal.proposalSha256,
			contributionId: "contribution:external",
			admissionBasisSha256: sha("5"),
		},
		{ causalRefs: [ref(support)] },
	);
	events.push(rejected, corrected);
	for (const [index, obligation] of fixture.obligations.entries()) {
		events.push(
			append(state, "obligation-discharged", {
				discharge: {
					dischargeId: id(`discharge:external-${index}`),
					frameId: fixture.frame.frameId,
					expectedFrameRevision: 1,
					obligationId: obligation.obligationId,
					contributionIds: [id("contribution:external")],
					stopEvidence: ["External support is current and bounded."],
					conclusion: `External obligation ${index} resolved.`,
				},
			}),
		);
	}
	events.push(
		append(state, "route-frame-concluded", {
			proposal: parseFrameConclusionProposal({
				frameId: fixture.frame.frameId,
				expectedFrameRevision: 1,
				dischargeIds: ["discharge:external-0", "discharge:external-1"],
				stopEvidence: ["Every external obligation is discharged."],
				expectedBlockerSetSha256: runtimeBlockerSetSha256([]),
				conclusion: "External frame resolved.",
			}),
		}),
	);
	const replay = replayDeveloperRuntime(persisted(events));
	assert.equal(replay.dispositions[3]?.kind, "rejected");
	assert.equal(replay.dispositions[4]?.kind, "accepted");
	assert.notEqual(
		runtimeFrameState(replay.scopes[0]!.state, fixture.frame.frameId)
			?.conclusion,
		null,
	);
});

test("incomplete snapshot replacement carries no page or selected authority", () => {
	const state = writer("replace-snapshot");
	const fixture = frameFixture("replace-snapshot", state.workScopeId);
	const first = routingFixture(fixture, "snapshot-first");
	const emptyBasis = parseSnapshotBasis({
		...first.snapshotBasis,
		priorityStrategySha256: sha("8"),
	});
	const emptySnapshotId = id("snapshot:replacement");
	const emptyPages = createRoutingCandidatePages(emptySnapshotId, [], 100);
	const emptyManifest = createRoutingSnapshotManifest(
		emptySnapshotId,
		emptyBasis,
		emptyPages,
	);
	const emptyCoverage = completeRoutingCoverage(
		beginRoutingCoverage(emptyBasis, emptyManifest, fixture.obligations),
	);
	const events: DeveloperEventEnvelope[] = [
		openScopeEvent(state),
		openFrameEvent(state, fixture),
		append(state, "routing-snapshot-opened", {
			basis: first.snapshotBasis,
			manifest: first.manifest,
			replacesSnapshotId: null,
		}),
		append(state, "routing-page-accounted", {
			page: first.page,
			dispositions: [first.disposition],
		}),
		append(state, "routing-snapshot-opened", {
			basis: emptyBasis,
			manifest: emptyManifest,
			replacesSnapshotId: first.snapshotId,
		}),
	];
	const stalePage = append(
		state,
		"routing-page-accounted",
		{ page: first.page, dispositions: [first.disposition] },
		{ advance: false },
	);
	const completeReplacement = append(state, "routing-coverage-completed", {
		snapshotId: emptySnapshotId,
		expectedCoverageSha256: emptyCoverage.coverageSha256,
	});
	events.push(stalePage, completeReplacement);
	const replay = replayDeveloperRuntime(persisted(events));
	assert.equal(replay.dispositions[5]?.kind, "rejected");
	assert.equal(replay.dispositions[6]?.kind, "accepted");
	assert.equal(replay.scopes[0]?.routingSnapshots.length, 1);
	assert.equal(
		replay.scopes[0]?.routingSnapshots[0]?.snapshotId,
		emptySnapshotId,
	);
	assert.equal(
		replay.scopes[0]?.routingSnapshots[0]?.coverage.selectedCandidates.length,
		0,
	);
});

test("frame replacement reconstructs a fresh revision without routing or assignment authority", () => {
	const state = writer("frame-replacement");
	const original = frameFixture("frame-replacement", state.workScopeId);
	const routing = routingFixture(original, "frame-replacement");
	const replacement = replacementFixture(original, "frame-replacement");
	const events = [
		openScopeEvent(state),
		openFrameEvent(state, original),
		...appendRouting(state, routing),
		append(state, "route-frame-replaced", {
			frame: replacement.frame,
			obligations: replacement.obligations,
		}),
	];
	const replay = replayDeveloperRuntime(persisted(events));
	assert.equal(replay.rejectedCount, 0);
	assert.equal(replay.scopes[0]?.routingSnapshots.length, 0);
	assert.equal(replay.scopes[0]?.canServeBases.length, 0);
	assert.equal(replay.scopes[0]?.state.assignments.length, 0);
	assert.equal(
		runtimeFrameState(replay.scopes[0]!.state, original.frame.frameId)?.frame
			.frameRevision,
		2,
	);
});

test("root authorization, landing, and closure replay through exact causal events", () => {
	const state = writer("root-events");
	const fixture = frameFixture("root-events", state.workScopeId);
	const openScope = openScopeEvent(state);
	const openFrame = openFrameEvent(state, fixture);
	const resolved = appendExternalConclusion(state, fixture, "root-events");
	const authorization = createRuntimeChangeAuthorization({
		authorizationId: "change:root-events",
		frameId: fixture.frame.frameId,
		frameRevision: fixture.frame.frameRevision,
		conclusionSha256: canonicalValueSha256({
			domain: "developer/v8/route-frame-conclusion",
			proposal: resolved.proposal,
		}),
		movement: "Apply the exact root event change.",
		stableLanding: "The root event change is bounded.",
		verificationTarget: "Root replay tests pass.",
		boundary: null,
	});
	const authorized = append(
		state,
		"change-authorized",
		{ authorization },
		{ causalRefs: [ref(resolved.conclusion)] },
	);
	const landing = createRuntimeImplementationLanding({
		landingId: "landing:root-events",
		authorizationId: authorization.authorizationId,
		changedPaths: ["packages/developer/root-events.ts"],
		result: "Root events landed.",
		verification: ["focused replay passed"],
		rerouteFrameId: "frame:root-events-reroute",
		verificationFrameId: "frame:root-events-verification",
	});
	const landed = append(
		state,
		"implementation-landing-recorded",
		{ landing },
		{ causalRefs: [ref(authorized)] },
	);
	const closed = append(state, "work-scope-closed", {
		closure: createRuntimeScopeClosure({ reason: "Developer was disabled." }),
	});
	const afterClose = append(
		state,
		"support-observed",
		{
			support: {
				supportId: "support:after-close",
				sourceKind: "material",
				sourceId: "material:after-close",
				sourceRevisionSha256: sha("7"),
				supportSha256: sha("8"),
			},
		},
		{ advance: false },
	);
	const replay = replayDeveloperRuntime(
		persisted([
			openScope,
			openFrame,
			...resolved.events,
			authorized,
			landed,
			closed,
			afterClose,
		]),
	);
	assert.equal(
		replay.rejectedCount,
		1,
		JSON.stringify(
			replay.dispositions.filter(
				(disposition) => disposition.kind === "rejected",
			),
		),
	);
	const scope = replay.scopes[0];
	assert.ok(scope);
	assert.equal(scope.root.status, "closed");
	assert.equal(scope.root.activeAuthorization, null);
	assert.equal(scope.root.landings[0]?.landingId, landing.landingId);
	assert.equal(scope.root.debts[0]?.reroutePending, true);
	assert.equal(scope.head.eventRef.eventId, closed.eventId);
});

test("child support requires the exact concluded child causal event and never auto-closes parent", () => {
	const state = writer("child");
	const parent = frameFixture("parent-replay", state.workScopeId);
	const child = frameFixture(
		"child-replay",
		state.workScopeId,
		parent.frame.frameId,
	);
	const events: DeveloperEventEnvelope[] = [
		openScopeEvent(state),
		openFrameEvent(state, parent),
	];
	const childOpen = append(state, "route-frame-opened", {
		frame: child.frame,
		obligations: child.obligations,
		parentDependency: {
			blockerId: id("blocker:child-replay"),
			targetObligationIds: [parent.obligations[0]!.obligationId],
			reason: "Child replay question blocks the first parent obligation.",
		},
	});
	events.push(childOpen);
	const childCompletion = appendExternalConclusion(
		state,
		child,
		"child-replay",
	);
	events.push(...childCompletion.events);
	const resolve = append(
		state,
		"frame-blocker-resolved",
		{
			frameId: parent.frame.frameId,
			blockerId: id("blocker:child-replay"),
			resolutionBasisSha256: childCompletion.conclusion.eventSha256,
		},
		{ causalRefs: [ref(childCompletion.conclusion)] },
	);
	events.push(resolve);
	const conclusionSha256 = canonicalValueSha256({
		domain: "developer/v8/route-frame-conclusion",
		proposal: childCompletion.proposal,
	});
	const childProposalBody: ProposedFrameContributionBody = {
		proposalId: id("proposal:parent-from-child"),
		frameId: parent.frame.frameId,
		frameRevision: 1,
		source: {
			kind: "child-frame",
			sourceId: child.frame.frameId,
			sourceRevisionSha256: conclusionSha256,
		},
		claim: "The concluded child supports the first parent obligation.",
		applicability: "Only the current parent frame and first obligation.",
		targetUses: [
			{ obligationId: parent.obligations[0]!.obligationId, useAs: "evidence" },
		],
		limitations: ["The parent still owns discharge and conclusion."],
		supportSha256: conclusionSha256,
	};
	const childProposal = createProposedFrameContribution(childProposalBody);
	const missingCause = append(
		state,
		"frame-contribution-admitted",
		{
			proposal: childProposalBody,
			expectedProposalSha256: childProposal.proposalSha256,
			contributionId: id("contribution:parent-from-child"),
			admissionBasisSha256: sha("9"),
		},
		{ advance: false },
	);
	const admitted = append(
		state,
		"frame-contribution-admitted",
		{
			proposal: childProposalBody,
			expectedProposalSha256: childProposal.proposalSha256,
			contributionId: id("contribution:parent-from-child"),
			admissionBasisSha256: sha("9"),
		},
		{ causalRefs: [ref(childCompletion.conclusion)] },
	);
	events.push(missingCause, admitted);
	const replay = replayDeveloperRuntime(persisted(events));
	assert.equal(replay.dispositions.at(-2)?.kind, "rejected");
	assert.equal(replay.dispositions.at(-1)?.kind, "accepted");
	const parentState = runtimeFrameState(
		replay.scopes[0]!.state,
		parent.frame.frameId,
	)!;
	assert.equal(parentState.contributions.length, 1);
	assert.equal(parentState.conclusion, null);
});
