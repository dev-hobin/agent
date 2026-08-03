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
	MAX_RECEIPT_PAGE_SIZE,
	createReceiptProjection,
	isReceiptProjectionError,
	readCurrentReceiptPage,
	receiptKind,
	verifyDeveloperReceipt,
	verifyReceiptPage,
	verifyReceiptProjection,
	type ReceiptProjectionErrorCode,
} from "../src/receipt-projection.ts";
import { replayDeveloperRuntime } from "../src/runtime-replay.ts";
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
	type RouteFrame,
} from "../src/runtime-protocol.ts";
import {
	runtimeBlockerSetSha256,
	skillReturnSupportSha256,
} from "../src/runtime-transition.ts";

const id = (value: string) => parseDeveloperId(value);
const sha = (character: string) => parseSha256Digest(character.repeat(64));

interface EventWriter {
	readonly workScopeId: DeveloperId;
	nextSequence: number;
	previousSha256: ReturnType<typeof sha> | null;
	nextEvent: number;
}

interface FrameFixture {
	readonly frame: RouteFrame;
	readonly obligations: readonly Obligation[];
}

function writer(suffix: string): EventWriter {
	return {
		workScopeId: id(`scope:projection-${suffix}`),
		nextSequence: 0,
		previousSha256: null,
		nextEvent: 0,
	};
}

function eventRef(envelope: DeveloperEventEnvelope): DeveloperEventRef {
	return {
		workScopeId: envelope.workScopeId,
		eventId: envelope.eventId,
		eventSha256: envelope.eventSha256,
	};
}

interface AppendEventInput {
	readonly state: EventWriter;
	readonly kind: string;
	readonly payload: unknown;
	readonly causalRefs?: readonly DeveloperEventRef[];
}

function append(input: AppendEventInput): DeveloperEventEnvelope {
	const { state, kind, payload, causalRefs = [] } = input;
	const envelope = createDeveloperEventEnvelope({
		protocolVersion: DEVELOPER_RUNTIME_PROTOCOL,
		eventId: id(`event:${state.workScopeId}:${state.nextEvent}`),
		workScopeId: state.workScopeId,
		scopeSequence: state.nextSequence,
		previousScopeEventSha256: state.previousSha256,
		causalRefs,
		occurredAt: "2031-01-01T00:00:00.000Z",
		kind: id(kind),
		payload: jsonValueFromUnknown(payload),
	});
	state.nextSequence += 1;
	state.nextEvent += 1;
	state.previousSha256 = envelope.eventSha256;
	return envelope;
}

interface FrameFixtureInput {
	readonly state: EventWriter;
	readonly suffix: string;
	readonly obligationCount: number;
	readonly parentFrameId?: DeveloperId | null;
}

function frameFixture(input: FrameFixtureInput): FrameFixture {
	const { state, suffix, obligationCount, parentFrameId = null } = input;
	const route = createRouteDefinition({
		routeDefinitionId: id(`route:projection-${suffix}`),
		sign: `${suffix} projection settlement`,
		sense: `Settle the current ${suffix} projection question.`,
	});
	const frameId = id(`frame:projection-${suffix}`);
	const obligations = Array.from({ length: obligationCount }, (_, index) =>
		parseObligation({
			obligationId: id(`obligation:projection-${suffix}-${index}`),
			frameId,
			statement: `Projection obligation ${suffix} ${index}.`,
		}),
	);
	return {
		frame: parseRouteFrame({
			frameId,
			frameRevision: 1,
			workScopeId: state.workScopeId,
			parentFrameId,
			routeDefinitionId: route.routeDefinitionId,
			routeDefinitionRevisionSha256: route.revisionSha256,
			exactQuestion: `What must be true for ${suffix} projection?`,
			obligationIds: obligations.map((obligation) => obligation.obligationId),
			obligationSetSha256: obligationSetSha256(obligations),
		}),
		obligations,
	};
}

function replacementFixture(original: FrameFixture): FrameFixture {
	const obligations = original.obligations.map((_, index) =>
		parseObligation({
			obligationId: id(`obligation:projection-replacement-${index}`),
			frameId: original.frame.frameId,
			statement: `Replacement projection obligation ${index}.`,
		}),
	);
	return {
		frame: parseRouteFrame({
			...original.frame,
			frameRevision: 2,
			exactQuestion: "What must be true for the replacement projection?",
			obligationIds: obligations.map((obligation) => obligation.obligationId),
			obligationSetSha256: obligationSetSha256(obligations),
		}),
		obligations,
	};
}

function openFrame(
	state: EventWriter,
	fixture: FrameFixture,
	parentDependency: unknown = null,
): DeveloperEventEnvelope {
	return append({
		state,
		kind: "route-frame-opened",
		payload: {
			frame: fixture.frame,
			obligations: fixture.obligations,
			parentDependency,
		},
	});
}

function routingEvents(
	state: EventWriter,
	fixture: FrameFixture,
): Readonly<{
	events: readonly DeveloperEventEnvelope[];
	assignmentId: DeveloperId;
}> {
	const descriptor = createRoutingCandidateDescriptor({
		candidateId: id("candidate:projection"),
		kind: "capability",
		source: {
			sourceId: id("source:projection-catalog"),
			revision: "catalog-1",
		},
		subjectId: id("skill:projection"),
		subjectRevisionSha256: sha("1"),
		registryRevisionSha256: sha("2"),
	});
	const basis = parseSnapshotBasis({
		frameId: fixture.frame.frameId,
		frameRevision: fixture.frame.frameRevision,
		obligationSetSha256: fixture.frame.obligationSetSha256,
		admittedUniverseSha256: sha("3"),
		providerSourceRevisions: [
			{ sourceId: "source:projection-catalog", revision: "catalog-1" },
		],
		priorityStrategySha256: sha("4"),
	});
	const snapshotId = id("snapshot:projection");
	const pages = createRoutingCandidatePages(snapshotId, [descriptor], 100);
	const page = pages[0]!;
	const manifest = createRoutingSnapshotManifest(snapshotId, basis, pages);
	const disposition = createCandidateDisposition({
		candidateId: descriptor.candidateId,
		descriptorSha256: descriptor.descriptorSha256,
		kind: "selected-for-material",
		targetEffects: Array.from(fixture.obligations.entries(), (entry) => ({
			obligationId: entry[1].obligationId,
			effect: entry[0] === 0 ? "selected" : "cleared",
		})),
		rationale: "Selected for the first projection obligation.",
	});
	const coverage = completeRoutingCoverage(
		accountRoutingPage(
			beginRoutingCoverage(basis, manifest, fixture.obligations),
			page,
			[disposition],
		),
	);
	const basisBody: CanServeRoutingBasisBody = {
		basisId: id("basis:projection"),
		candidateId: descriptor.candidateId,
		targetObligationIds: [fixture.obligations[0]!.obligationId],
		methodRevisionSha256: sha("5"),
		policy: { kind: "complete", revisionSha256: sha("6") },
		rootApplicability: "applicable",
	};
	const canServe = createCanServeRoutingBasis(coverage, basisBody);
	const assignment = createReadySkillAssignment({
		assignmentId: id("assignment:projection"),
		skillCapabilityId: canServe.capabilityId,
		skillRevisionSha256: canServe.capabilityRevisionSha256,
		parentFrameId: fixture.frame.frameId,
		parentFrameRevision: fixture.frame.frameRevision,
		targetObligationIds: canServe.targetObligationIds,
		subquestion: "What projection support can the Skill contribute?",
		applicabilityBasisSha256: canServe.basisSha256,
		expectedContribution: "A bounded contribution for projection.",
		limitations: ["No transition authority."],
		returnContract: DEVELOPER_SKILL_RETURN_CONTRACT,
		contextBasisSha256: coverage.coverageSha256,
		authority: "contribution-only",
	});
	return {
		events: [
			append({
				state,
				kind: "routing-snapshot-opened",
				payload: { basis, manifest, replacesSnapshotId: null },
			}),
			append({
				state,
				kind: "routing-page-accounted",
				payload: { page, dispositions: [disposition] },
			}),
			append({
				state,
				kind: "routing-coverage-completed",
				payload: {
					snapshotId,
					expectedCoverageSha256: coverage.coverageSha256,
				},
			}),
			append({
				state,
				kind: "can-serve-basis-created",
				payload: {
					snapshotId,
					body: basisBody,
					expectedBasisSha256: canServe.basisSha256,
				},
			}),
			append({
				state,
				kind: "ready-assignment-recorded",
				payload: { assignment, basisId: basisBody.basisId },
			}),
		],
		assignmentId: assignment.assignmentId,
	};
}

function conclusionProposal(
	fixture: FrameFixture,
	dischargeIds: readonly DeveloperId[],
	suffix: string,
) {
	return parseFrameConclusionProposal({
		frameId: fixture.frame.frameId,
		expectedFrameRevision: fixture.frame.frameRevision,
		dischargeIds: [...dischargeIds].sort(),
		stopEvidence: [`All ${suffix} projection obligations are discharged.`],
		expectedBlockerSetSha256: runtimeBlockerSetSha256([]),
		conclusion: `${suffix} projection frame resolved.`,
	});
}

function allReceiptKindsLog(): readonly DeveloperEventEnvelope[] {
	const state = writer("all-kinds");
	const parent = frameFixture({ state, suffix: "parent", obligationCount: 2 });
	const replaceable = frameFixture({
		state,
		suffix: "replaceable",
		obligationCount: 1,
	});
	const replacement = replacementFixture(replaceable);
	const child = frameFixture({
		state,
		suffix: "child",
		obligationCount: 1,
		parentFrameId: parent.frame.frameId,
	});
	const events: DeveloperEventEnvelope[] = [
		append({ state, kind: "work-scope-opened", payload: {} }),
		openFrame(state, parent),
		openFrame(state, replaceable),
		append({
			state,
			kind: "route-frame-replaced",
			payload: {
				frame: replacement.frame,
				obligations: replacement.obligations,
			},
		}),
	];
	const routing = routingEvents(state, parent);
	events.push(...routing.events);
	const invocationId = id("invocation:projection");
	events.push(
		append({
			state,
			kind: "skill-invocation-started",
			payload: { invocationId, assignmentId: routing.assignmentId },
		}),
	);
	const settlement = parseInvocationSettlement({
		kind: "returned",
		invocationId,
		assignmentId: routing.assignmentId,
		value: {
			kind: "contribution",
			claim: "Skill support for the first parent projection obligation.",
			applicability: "Current parent projection frame.",
			targetUses: [
				{
					obligationId: parent.obligations[0]!.obligationId,
					useAs: "evidence",
				},
			],
			limitations: ["Does not discharge the obligation."],
		},
	});
	const settled = append({
		state,
		kind: "invocation-settled",
		payload: { settlement },
	});
	events.push(settled);
	const skillSupportSha256 = skillReturnSupportSha256(settlement);
	const skillProposalBody: ProposedFrameContributionBody = {
		proposalId: id("proposal:projection-skill"),
		frameId: parent.frame.frameId,
		frameRevision: parent.frame.frameRevision,
		source: {
			kind: "skill-return",
			sourceId: invocationId,
			sourceRevisionSha256: skillSupportSha256,
		},
		claim: "Skill support for the first parent projection obligation.",
		applicability: "Current parent projection frame.",
		targetUses: [
			{ obligationId: parent.obligations[0]!.obligationId, useAs: "evidence" },
		],
		limitations: ["Does not discharge the obligation."],
		supportSha256: skillSupportSha256,
	};
	const skillProposal = createProposedFrameContribution(skillProposalBody);
	events.push(
		append({
			state,
			kind: "frame-contribution-admitted",
			payload: {
				proposal: skillProposalBody,
				expectedProposalSha256: skillProposal.proposalSha256,
				contributionId: id("contribution:projection-skill"),
				admissionBasisSha256: sha("7"),
			},
			causalRefs: [eventRef(settled)],
		}),
	);
	const blockerId = id("blocker:projection-child");
	events.push(
		openFrame(state, child, {
			blockerId,
			targetObligationIds: [parent.obligations[1]!.obligationId],
			reason: "Child projection blocks the second parent obligation.",
		}),
	);
	const support = append({
		state,
		kind: "support-observed",
		payload: {
			support: {
				supportId: id("support:projection-child"),
				sourceKind: "judgment-result",
				sourceId: id("judgment:projection-child"),
				sourceRevisionSha256: sha("8"),
				supportSha256: sha("9"),
			},
		},
	});
	events.push(support);
	const childProposalBody: ProposedFrameContributionBody = {
		proposalId: id("proposal:projection-child"),
		frameId: child.frame.frameId,
		frameRevision: child.frame.frameRevision,
		source: {
			kind: "judgment-result",
			sourceId: id("judgment:projection-child"),
			sourceRevisionSha256: sha("8"),
		},
		claim: "External support resolves the child projection question.",
		applicability: "Current child projection frame.",
		targetUses: [
			{ obligationId: child.obligations[0]!.obligationId, useAs: "evidence" },
		],
		limitations: ["Child completion does not close the parent."],
		supportSha256: sha("9"),
	};
	const childProposal = createProposedFrameContribution(childProposalBody);
	events.push(
		append({
			state,
			kind: "frame-contribution-admitted",
			payload: {
				proposal: childProposalBody,
				expectedProposalSha256: childProposal.proposalSha256,
				contributionId: id("contribution:projection-child"),
				admissionBasisSha256: sha("a"),
			},
			causalRefs: [eventRef(support)],
		}),
	);
	const childDischargeId = id("discharge:projection-child");
	events.push(
		append({
			state,
			kind: "obligation-discharged",
			payload: {
				discharge: {
					dischargeId: childDischargeId,
					frameId: child.frame.frameId,
					expectedFrameRevision: child.frame.frameRevision,
					obligationId: child.obligations[0]!.obligationId,
					contributionIds: [id("contribution:projection-child")],
					stopEvidence: ["Child projection support is admitted."],
					conclusion: "Child projection obligation resolved.",
				},
			},
		}),
	);
	const childConclusionProposal = conclusionProposal(
		child,
		[childDischargeId],
		"child",
	);
	const childConclusion = append({
		state,
		kind: "route-frame-concluded",
		payload: { proposal: childConclusionProposal },
	});
	events.push(childConclusion);
	events.push(
		append({
			state,
			kind: "frame-blocker-resolved",
			payload: {
				frameId: parent.frame.frameId,
				blockerId,
				resolutionBasisSha256: childConclusion.eventSha256,
			},
			causalRefs: [eventRef(childConclusion)],
		}),
	);
	const childConclusionSha256 = canonicalValueSha256({
		domain: "developer/v8/route-frame-conclusion",
		proposal: childConclusionProposal,
	});
	const parentChildBody: ProposedFrameContributionBody = {
		proposalId: id("proposal:projection-parent-child"),
		frameId: parent.frame.frameId,
		frameRevision: parent.frame.frameRevision,
		source: {
			kind: "child-frame",
			sourceId: child.frame.frameId,
			sourceRevisionSha256: childConclusionSha256,
		},
		claim: "Concluded child supports the second parent obligation.",
		applicability: "Current parent projection frame.",
		targetUses: [
			{ obligationId: parent.obligations[1]!.obligationId, useAs: "evidence" },
		],
		limitations: ["Parent retains discharge and conclusion authority."],
		supportSha256: childConclusionSha256,
	};
	const parentChild = createProposedFrameContribution(parentChildBody);
	events.push(
		append({
			state,
			kind: "frame-contribution-admitted",
			payload: {
				proposal: parentChildBody,
				expectedProposalSha256: parentChild.proposalSha256,
				contributionId: id("contribution:projection-parent-child"),
				admissionBasisSha256: sha("b"),
			},
			causalRefs: [eventRef(childConclusion)],
		}),
	);
	const parentDischarges = Array.from(parent.obligations.entries(), (entry) => {
		const [index, obligation] = entry;
		const dischargeId = id(`discharge:projection-parent-${index}`);
		events.push(
			append({
				state,
				kind: "obligation-discharged",
				payload: {
					discharge: {
						dischargeId,
						frameId: parent.frame.frameId,
						expectedFrameRevision: parent.frame.frameRevision,
						obligationId: obligation.obligationId,
						contributionIds: [
							index === 0
								? id("contribution:projection-skill")
								: id("contribution:projection-parent-child"),
						],
						stopEvidence: ["Parent projection support is admitted."],
						conclusion: `Parent projection obligation ${index} resolved.`,
					},
				},
			}),
		);
		return dischargeId;
	});
	events.push(
		append({
			state,
			kind: "route-frame-concluded",
			payload: {
				proposal: conclusionProposal(parent, parentDischarges, "parent"),
			},
		}),
	);

	const rootState = writer("root-kinds");
	const rootFrame = frameFixture({
		state: rootState,
		suffix: "root-kinds",
		obligationCount: 1,
	});
	const rootEvents: DeveloperEventEnvelope[] = [
		append({ state: rootState, kind: "work-scope-opened", payload: {} }),
		openFrame(rootState, rootFrame),
	];
	const rootSupport = append({
		state: rootState,
		kind: "support-observed",
		payload: {
			support: {
				supportId: "support:projection-root",
				sourceKind: "judgment-result",
				sourceId: "judgment:projection-root",
				sourceRevisionSha256: sha("d"),
				supportSha256: sha("e"),
			},
		},
	});
	rootEvents.push(rootSupport);
	const rootProposalBody: ProposedFrameContributionBody = {
		proposalId: id("proposal:projection-root"),
		frameId: rootFrame.frame.frameId,
		frameRevision: rootFrame.frame.frameRevision,
		source: {
			kind: "judgment-result",
			sourceId: id("judgment:projection-root"),
			sourceRevisionSha256: sha("d"),
		},
		claim: "Root projection support is current.",
		applicability: "Current root projection frame.",
		targetUses: [
			{
				obligationId: rootFrame.obligations[0]!.obligationId,
				useAs: "evidence",
			},
		],
		limitations: [],
		supportSha256: sha("e"),
	};
	const rootProposal = createProposedFrameContribution(rootProposalBody);
	rootEvents.push(
		append({
			state: rootState,
			kind: "frame-contribution-admitted",
			payload: {
				proposal: rootProposalBody,
				expectedProposalSha256: rootProposal.proposalSha256,
				contributionId: "contribution:projection-root",
				admissionBasisSha256: sha("f"),
			},
			causalRefs: [eventRef(rootSupport)],
		}),
	);
	const rootDischargeId = id("discharge:projection-root");
	rootEvents.push(
		append({
			state: rootState,
			kind: "obligation-discharged",
			payload: {
				discharge: {
					dischargeId: rootDischargeId,
					frameId: rootFrame.frame.frameId,
					expectedFrameRevision: rootFrame.frame.frameRevision,
					obligationId: rootFrame.obligations[0]!.obligationId,
					contributionIds: [id("contribution:projection-root")],
					stopEvidence: ["Root projection support is admitted."],
					conclusion: "Root projection obligation resolved.",
				},
			},
		}),
	);
	const rootConclusionProposal = conclusionProposal(
		rootFrame,
		[rootDischargeId],
		"root",
	);
	const rootConclusion = append({
		state: rootState,
		kind: "route-frame-concluded",
		payload: { proposal: rootConclusionProposal },
	});
	rootEvents.push(rootConclusion);
	const rootAuthorization = createRuntimeChangeAuthorization({
		authorizationId: "change:projection-root",
		frameId: rootFrame.frame.frameId,
		frameRevision: rootFrame.frame.frameRevision,
		conclusionSha256: canonicalValueSha256({
			domain: "developer/v8/route-frame-conclusion",
			proposal: rootConclusionProposal,
		}),
		movement: "Project structural root authorization.",
		stableLanding: "Root projection remains structural.",
		verificationTarget: "All root receipts are present.",
		boundary: null,
	});
	const rootAuthorized = append({
		state: rootState,
		kind: "change-authorized",
		payload: { authorization: rootAuthorization },
		causalRefs: [eventRef(rootConclusion)],
	});
	rootEvents.push(rootAuthorized);
	const rootLanding = createRuntimeImplementationLanding({
		landingId: "landing:projection-root",
		authorizationId: rootAuthorization.authorizationId,
		changedPaths: ["packages/developer/root.ts"],
		result: "Root projection landed.",
		verification: ["root receipts checked"],
		rerouteFrameId: "frame:projection-root-reroute",
		verificationFrameId: "frame:projection-root-verification",
	});
	const rootLanded = append({
		state: rootState,
		kind: "implementation-landing-recorded",
		payload: { landing: rootLanding },
		causalRefs: [eventRef(rootAuthorized)],
	});
	rootEvents.push(rootLanded);
	rootEvents.push(
		append({
			state: rootState,
			kind: "work-scope-closed",
			payload: {
				closure: createRuntimeScopeClosure({
					reason: "Projection root scope closed.",
				}),
			},
		}),
	);
	return [...events, ...rootEvents];
}

function simpleAcceptedEvents(count: number) {
	const state = writer(`simple-${count}`);
	const events: DeveloperEventEnvelope[] = [
		append({ state, kind: "work-scope-opened", payload: {} }),
	];
	for (let index = 0; index < count; index += 1) {
		events.push(
			append({
				state,
				kind: "support-observed",
				payload: {
					support: {
						supportId: id(`support:projection-page-${index}`),
						sourceKind: "judgment-result",
						sourceId: id(`judgment:projection-page-${index}`),
						sourceRevisionSha256: sha("c"),
						supportSha256: canonicalValueSha256({ index }),
					},
				},
			}),
		);
	}
	const replay = replayDeveloperRuntime(JSON.parse(JSON.stringify(events)));
	assert.equal(replay.rejectedCount, 0);
	return replay.acceptedEvents;
}

interface SettlementContext {
	readonly invocationId: DeveloperId;
	readonly assignmentId: DeveloperId;
	readonly obligationId: DeveloperId;
	readonly suffix: string;
}

interface SettlementOutcomeCase {
	readonly suffix: string;
	readonly expected: string;
	readonly input: (context: SettlementContext) => unknown;
}

function projectedSettlementOutcome(value: SettlementOutcomeCase): string {
	const state = writer(`outcome-${value.suffix}`);
	const frame = frameFixture({
		state,
		suffix: `outcome-${value.suffix}`,
		obligationCount: 1,
	});
	const events: DeveloperEventEnvelope[] = [
		append({ state, kind: "work-scope-opened", payload: {} }),
		openFrame(state, frame),
	];
	const routing = routingEvents(state, frame);
	events.push(...routing.events);
	const context: SettlementContext = {
		invocationId: id(`invocation:projection-${value.suffix}`),
		assignmentId: routing.assignmentId,
		obligationId: frame.obligations[0]!.obligationId,
		suffix: value.suffix,
	};
	events.push(
		append({
			state,
			kind: "skill-invocation-started",
			payload: {
				invocationId: context.invocationId,
				assignmentId: context.assignmentId,
			},
		}),
	);
	const settlement = parseInvocationSettlement(value.input(context));
	events.push(
		append({
			state,
			kind: "invocation-settled",
			payload: { settlement },
		}),
	);
	const replay = replayDeveloperRuntime(JSON.parse(JSON.stringify(events)));
	assert.equal(replay.rejectedCount, 0);
	const projection = createReceiptProjection(replay.acceptedEvents);
	const page = readCurrentReceiptPage(
		{ kind: "current", projection },
		{ cursor: null, pageSize: 100 },
	);
	const receipt = page.entries.find(
		(entry) => entry.receipt.kind === "invocation-settled",
	)?.receipt;
	if (receipt?.kind !== "invocation-settled") {
		assert.fail("invocation settlement receipt is missing");
	}
	return receipt.outcome;
}

function hasProjectionError(code: ReceiptProjectionErrorCode) {
	return (error: unknown) =>
		isReceiptProjectionError(error) && error.code === code;
}

const EXPECTED_RECEIPT_KINDS = [
	"work-scope-opened",
	"work-scope-closed",
	"change-authorized",
	"implementation-landing-recorded",
	"route-frame-opened",
	"route-frame-replaced",
	"routing-snapshot-opened",
	"routing-page-accounted",
	"routing-coverage-completed",
	"can-serve-basis-created",
	"ready-assignment-recorded",
	"skill-invocation-started",
	"invocation-settled",
	"support-observed",
	"frame-contribution-admitted",
	"frame-blocker-resolved",
	"obligation-discharged",
	"route-frame-concluded",
] as const;

test("all replay semantic variants project to immutable bounded receipts", () => {
	const log = allReceiptKindsLog();
	const replay = replayDeveloperRuntime(JSON.parse(JSON.stringify(log)));
	assert.equal(
		replay.rejectedCount,
		0,
		JSON.stringify(
			replay.dispositions.filter((entry) => entry.kind === "rejected"),
		),
	);
	const projection = createReceiptProjection(replay.acceptedEvents);
	const page = readCurrentReceiptPage(
		{ kind: "current", projection },
		{ cursor: null, pageSize: MAX_RECEIPT_PAGE_SIZE },
	);
	assert.equal(page.entries.length, replay.acceptedCount);
	assert.equal(page.nextCursor, null);
	assert.deepEqual(
		[
			...new Set(page.entries.map((entry) => receiptKind(entry.receipt))),
		].sort(),
		[...EXPECTED_RECEIPT_KINDS].sort(),
	);
	for (const [ordinal, entry] of page.entries.entries()) {
		assert.equal(entry.ref.ordinal, ordinal);
		assert.equal(entry.ref.projectionSha256, projection.projectionSha256);
		assert.equal(entry.ref.receiptSha256, entry.receipt.receiptSha256);
		assert.equal(verifyDeveloperReceipt(entry.receipt), entry.receipt);
		assert.equal(Object.isFrozen(entry.receipt), true);
		assert.equal(Object.isFrozen(entry.ref), true);
	}
	assert.equal(verifyReceiptProjection(projection), projection);
	assert.equal(verifyReceiptPage(projection, page), page);
	assert.throws(
		() => verifyDeveloperReceipt(structuredClone(page.entries[0]!.receipt)),
		hasProjectionError("invalid-input"),
	);
	const serializedPage = JSON.stringify(page);
	assert.doesNotMatch(
		serializedPage,
		/Skill support for|External support resolves|stopEvidence/,
	);
});

test("invocation settlement receipts preserve every closed outcome distinction", () => {
	const cases: readonly SettlementOutcomeCase[] = [
		{
			suffix: "returned-contribution",
			expected: "returned-contribution",
			input: (context) => ({
				kind: "returned",
				invocationId: context.invocationId,
				assignmentId: context.assignmentId,
				value: {
					kind: "contribution",
					claim: "Bounded projected contribution.",
					applicability: "Current projected frame.",
					targetUses: [
						{ obligationId: context.obligationId, useAs: "evidence" },
					],
					limitations: ["No authority."],
				},
			}),
		},
		{
			suffix: "returned-dependency",
			expected: "returned-dependency",
			input: (context) => ({
				kind: "returned",
				invocationId: context.invocationId,
				assignmentId: context.assignmentId,
				value: {
					kind: "dependency",
					dependencyId: id(`dependency:${context.suffix}`),
					targetObligationIds: [context.obligationId],
					question: "What support is missing?",
					reason: "A dependency remains.",
				},
			}),
		},
		{
			suffix: "returned-not-applicable",
			expected: "returned-not-applicable",
			input: (context) => ({
				kind: "returned",
				invocationId: context.invocationId,
				assignmentId: context.assignmentId,
				value: {
					kind: "not-applicable",
					targetObligationIds: [context.obligationId],
					reason: "The capability is not applicable.",
				},
			}),
		},
		{
			suffix: "returned-needs-context",
			expected: "returned-needs-context",
			input: (context) => ({
				kind: "returned",
				invocationId: context.invocationId,
				assignmentId: context.assignmentId,
				value: {
					kind: "needs-context",
					targetObligationIds: [context.obligationId],
					missingContext: ["Current projection source revision."],
				},
			}),
		},
		{
			suffix: "returned-abort",
			expected: "returned-abort",
			input: (context) => ({
				kind: "returned",
				invocationId: context.invocationId,
				assignmentId: context.assignmentId,
				value: {
					kind: "abort",
					reason: "Provider returned an explicit abort.",
				},
			}),
		},
		{
			suffix: "resolver-error",
			expected: "capability-resolver-error",
			input: (context) => ({
				kind: "capability-failed",
				invocationId: context.invocationId,
				assignmentId: context.assignmentId,
				failure: { kind: "resolver-error", message: "Resolver failed." },
			}),
		},
		{
			suffix: "invalid-return",
			expected: "capability-invalid-or-silent-return",
			input: (context) => ({
				kind: "capability-failed",
				invocationId: context.invocationId,
				assignmentId: context.assignmentId,
				failure: {
					kind: "invalid-or-silent-return",
					reason: "Return was invalid.",
				},
			}),
		},
		{
			suffix: "timeout",
			expected: "capability-timeout",
			input: (context) => ({
				kind: "capability-failed",
				invocationId: context.invocationId,
				assignmentId: context.assignmentId,
				failure: { kind: "timeout", timeoutMs: 1_000 },
			}),
		},
		...(["cancelled", "superseded", "stale"] as const).map((kind) => ({
			suffix: kind,
			expected: `lifecycle-${kind}`,
			input: (context: SettlementContext) => ({
				kind: "lifecycle",
				invocationId: context.invocationId,
				assignmentId: context.assignmentId,
				lifecycle: {
					kind,
					reason: `Invocation became ${kind}.`,
					executionUncertain: kind === "cancelled",
				},
			}),
		})),
	];
	for (const value of cases) {
		assert.equal(
			projectedSettlementOutcome(value),
			value.expected,
			value.suffix,
		);
	}
});

test("only replay-created accepted events can create a canonical projection", () => {
	const accepted = simpleAcceptedEvents(3);
	const projection = createReceiptProjection(accepted);
	const sameReplay = replayDeveloperRuntime(
		JSON.parse(JSON.stringify(accepted.map((event) => event.envelope))),
	);
	const sameProjection = createReceiptProjection(sameReplay.acceptedEvents);
	assert.equal(sameProjection.projectionSha256, projection.projectionSha256);
	assert.equal(
		sameProjection.orderedReceiptRootSha256,
		projection.orderedReceiptRootSha256,
	);
	assert.throws(
		() => createReceiptProjection([structuredClone(accepted[0]!)]),
		hasProjectionError("unaccepted-event"),
	);
	assert.throws(
		() => createReceiptProjection([accepted[1]!, accepted[0]!]),
		hasProjectionError("noncanonical-event-order"),
	);
	assert.throws(
		() => createReceiptProjection([accepted[0]!, accepted[0]!]),
		hasProjectionError("duplicate-event-id"),
	);
	assert.throws(
		() => verifyReceiptProjection(structuredClone(projection)),
		hasProjectionError("invalid-projection"),
	);
});

test("empty projections are deterministic and Refreshing never exposes prior receipts", () => {
	assert.equal(
		isReceiptProjectionError({
			projectionError: true,
			code: "not-a-projection-code",
			message: "forged",
		}),
		false,
	);
	const first = createReceiptProjection([]);
	const second = createReceiptProjection([]);
	assert.equal(first.projectionSha256, second.projectionSha256);
	assert.equal(first.orderedReceiptRootSha256, second.orderedReceiptRootSha256);
	assert.equal(first.receiptCount, 0);
	const page = readCurrentReceiptPage(
		{ kind: "current", projection: first },
		{ cursor: null, pageSize: 1 },
	);
	assert.deepEqual(page.entries, []);
	assert.equal(page.nextCursor, null);
	assert.throws(
		() =>
			readCurrentReceiptPage(
				{
					kind: "refreshing",
					requestedRevisionSha256: sha("d"),
					priorProjectionSha256: first.projectionSha256,
				},
				{ cursor: null, pageSize: 1 },
			),
		hasProjectionError("projection-refreshing"),
	);
});

test("bounded pages cover every receipt without truncation", () => {
	const accepted = simpleAcceptedEvents(250);
	const projection = createReceiptProjection(accepted);
	const first = readCurrentReceiptPage(
		{ kind: "current", projection },
		{ cursor: null, pageSize: 100 },
	);
	assert.equal(first.entries.length, 100);
	assert.notEqual(first.nextCursor, null);
	const second = readCurrentReceiptPage(
		{ kind: "current", projection },
		{ cursor: first.nextCursor, pageSize: 100 },
	);
	assert.equal(second.entries.length, 100);
	assert.notEqual(second.nextCursor, null);
	const third = readCurrentReceiptPage(
		{ kind: "current", projection },
		{ cursor: second.nextCursor, pageSize: 100 },
	);
	assert.equal(third.entries.length, 51);
	assert.equal(third.nextCursor, null);
	assert.deepEqual(
		[...first.entries, ...second.entries, ...third.entries].map(
			(entry) => entry.ref.ordinal,
		),
		Array.from({ length: 251 }, (_, index) => index),
	);
	assert.throws(
		() =>
			readCurrentReceiptPage(
				{ kind: "current", projection },
				{ cursor: null, pageSize: 0 },
			),
		hasProjectionError("invalid-input"),
	);
	assert.throws(
		() =>
			readCurrentReceiptPage(
				{ kind: "current", projection },
				{ cursor: null, pageSize: 101 },
			),
		hasProjectionError("invalid-input"),
	);
});

test("cursors and pages are process-local and projection-bound", () => {
	const accepted = simpleAcceptedEvents(120);
	const projection = createReceiptProjection(accepted);
	const other = createReceiptProjection(accepted.slice(0, 2));
	const page = readCurrentReceiptPage(
		{ kind: "current", projection },
		{ cursor: null, pageSize: 50 },
	);
	assert.notEqual(page.nextCursor, null);
	assert.throws(
		() =>
			readCurrentReceiptPage(
				{ kind: "current", projection: other },
				{ cursor: page.nextCursor, pageSize: 50 },
			),
		hasProjectionError("stale-cursor"),
	);
	assert.throws(
		() =>
			readCurrentReceiptPage(
				{ kind: "current", projection },
				{ cursor: structuredClone(page.nextCursor), pageSize: 50 },
			),
		hasProjectionError("invalid-cursor"),
	);
	assert.throws(
		() => verifyReceiptPage(other, page),
		hasProjectionError("stale-page"),
	);
	assert.throws(
		() => verifyReceiptPage(projection, structuredClone(page)),
		hasProjectionError("invalid-page"),
	);
});
