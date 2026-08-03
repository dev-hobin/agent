import assert from "node:assert/strict";
import test from "node:test";

import {
	DEVELOPER_RUNTIME_PROTOCOL,
	DEVELOPER_SKILL_RETURN_CONTRACT,
	MAX_EVENT_PAYLOAD_BYTES,
	MAX_RUNTIME_TEXT_LENGTH,
	canonicalDeveloperEventJson,
	canonicalRuntimeJson,
	canonicalValueSha256,
	createDeveloperEventEnvelope,
	createReadySkillAssignment,
	createRouteDefinition,
	developerEventSha256,
	obligationSetSha256,
	parseContentAddress,
	parseDeveloperEventEnvelope,
	parseDeveloperEventRef,
	parseDeveloperId,
	parseFrameConclusionProposal,
	parseInvocationSettlement,
	parseMaterialSealRef,
	parseObligation,
	parseReadySkillAssignment,
	parseRouteDefinition,
	parseRouteFrame,
	parseSha256Digest,
	parseSkillReturn,
	parseSnapshotBasis,
	parseSnapshotSealManifest,
	readySkillAssignmentSha256,
	routeDefinitionSha256,
	snapshotBasisSha256,
	type DeveloperEventDraft,
	type ReadySkillAssignmentBody,
	type RouteDefinitionBody,
} from "../src/runtime-protocol.ts";

const sha = (character: string) => parseSha256Digest(character.repeat(64));
const id = (value: string) => parseDeveloperId(value);

function routeBody(): RouteDefinitionBody {
	return {
		routeDefinitionId: id("route:meaning-settlement"),
		sign: "meaning settlement",
		sense:
			"Settle product meaning, scope, invariants, constraints, and counterexamples.",
	};
}

function assignmentBody(): ReadySkillAssignmentBody {
	return {
		assignmentId: id("assignment:one"),
		skillCapabilityId: id("skill:specify"),
		skillRevisionSha256: sha("a"),
		parentFrameId: id("frame:one"),
		parentFrameRevision: 2,
		targetObligationIds: [id("obligation:a"), id("obligation:b")],
		subquestion: "Which meaning remains unresolved?",
		applicabilityBasisSha256: sha("b"),
		expectedContribution: "A bounded claim about the unresolved meaning.",
		limitations: ["No mutation authority."],
		returnContract: DEVELOPER_SKILL_RETURN_CONTRACT,
		contextBasisSha256: sha("c"),
		authority: "contribution-only",
	};
}

test("Developer v8 canonical JSON is independent of locale collation", () => {
	const value = { z: 1, ä: 2, a: 3 };
	assert.equal(canonicalRuntimeJson(value), '{"a":3,"z":1,"ä":2}');
	assert.equal(
		canonicalValueSha256(value),
		"db9f98f8f834a409b5fc0798ba4c3ff4baf60b13f314723742ca596753248d28",
	);
});

test("route, frame, and obligation identities are exact and content-bound", () => {
	const route = createRouteDefinition(routeBody());
	assert.equal(route.revisionSha256, routeDefinitionSha256(routeBody()));
	assert.deepEqual(
		parseRouteDefinition(JSON.parse(JSON.stringify(route))),
		route,
	);
	assert.equal(Object.isFrozen(route), true);
	assert.throws(
		() => parseRouteDefinition({ ...route, sign: "condition settlement" }),
		/revisionSha256.*does not match/u,
	);
	assert.throws(
		() => parseRouteDefinition({ ...route, extra: true }),
		/extra.*not allowed/u,
	);
	assert.throws(
		() =>
			createRouteDefinition({
				...routeBody(),
				sense: "x".repeat(MAX_RUNTIME_TEXT_LENGTH + 1),
			}),
		/text is too long/u,
	);

	const obligationA = parseObligation({
		obligationId: "obligation:a",
		frameId: "frame:one",
		statement: "A bounded meaning claim exists.",
	});
	const obligationB = parseObligation({
		obligationId: "obligation:b",
		frameId: "frame:one",
		statement: "Counterexamples are accounted for.",
	});
	assert.equal(
		obligationSetSha256([obligationA, obligationB]),
		obligationSetSha256([obligationB, obligationA]),
	);
	assert.throws(
		() => obligationSetSha256([obligationA, obligationA]),
		/contains duplicates/u,
	);

	const frame = parseRouteFrame({
		frameId: "frame:one",
		frameRevision: 2,
		workScopeId: "scope:one",
		parentFrameId: null,
		routeDefinitionId: route.routeDefinitionId,
		routeDefinitionRevisionSha256: route.revisionSha256,
		exactQuestion: "What must be true?",
		obligationIds: ["obligation:a", "obligation:b"],
		obligationSetSha256: obligationSetSha256([obligationA, obligationB]),
	});
	assert.equal(frame.frameRevision, 2);
	assert.throws(
		() =>
			parseRouteFrame({
				...frame,
				obligationIds: ["obligation:b", "obligation:a"],
			}),
		/canonical order/u,
	);
});

test("content and snapshot seals retain bounded content identity without store handles", () => {
	const contentAddress = parseContentAddress({
		algorithm: "sha256",
		digest: sha("d"),
		byteLength: 128,
	});
	assert.deepEqual(
		parseMaterialSealRef({
			sealId: "seal:one",
			contentAddress,
			sourceRef: "source:one",
			sourceRevision: "git:abc123",
		}),
		{
			sealId: "seal:one",
			contentAddress,
			sourceRef: "source:one",
			sourceRevision: "git:abc123",
		},
	);
	assert.throws(
		() =>
			parseContentAddress({ ...contentAddress, runtimeStoreHandle: "/tmp/x" }),
		/runtimeStoreHandle.*not allowed/u,
	);

	const basis = parseSnapshotBasis({
		frameId: "frame:one",
		frameRevision: 2,
		obligationSetSha256: sha("1"),
		admittedUniverseSha256: sha("2"),
		providerSourceRevisions: [
			{ sourceId: "source:a", revision: "rev-a" },
			{ sourceId: "source:b", revision: "rev-b" },
		],
		priorityStrategySha256: sha("3"),
	});
	const basisSha = snapshotBasisSha256(basis);
	const manifest = parseSnapshotSealManifest({
		snapshotId: "snapshot:one",
		snapshotBasisSha256: basisSha,
		pageCount: 4,
		candidateCount: 1_000,
		orderedPageRootSha256: sha("4"),
	});
	assert.equal(manifest.snapshotBasisSha256, basisSha);
	assert.throws(
		() =>
			parseSnapshotBasis({
				...basis,
				providerSourceRevisions: [
					{ sourceId: "source:b", revision: "rev-b" },
					{ sourceId: "source:a", revision: "rev-a" },
				],
			}),
		/canonical order/u,
	);
});

test("ready assignments bind capability, targets, context, limits, and authority", () => {
	const body = assignmentBody();
	const assignment = createReadySkillAssignment(body);
	assert.equal(
		assignment.assignmentRevisionSha256,
		readySkillAssignmentSha256(body),
	);
	assert.deepEqual(
		parseReadySkillAssignment(JSON.parse(JSON.stringify(assignment))),
		assignment,
	);
	assert.throws(
		() =>
			parseReadySkillAssignment({
				...assignment,
				authority: "frame-owner",
			}),
		/authority.*expected one of contribution-only/u,
	);
	assert.throws(
		() =>
			parseReadySkillAssignment({
				...assignment,
				expectedContribution: "Different contribution.",
			}),
		/assignmentRevisionSha256.*does not match/u,
	);
});

test("Skill returns form one exact closed union", () => {
	const contribution = parseSkillReturn({
		kind: "contribution",
		claim: "The requirement excludes a silent fallback.",
		applicability: "The target obligation asks about fallback behavior.",
		targetUses: [{ obligationId: "obligation:a", useAs: "evidence" }],
		limitations: ["No mutation authority."],
	});
	assert.equal(contribution.kind, "contribution");
	assert.equal(
		parseSkillReturn({
			kind: "dependency",
			dependencyId: "dependency:one",
			targetObligationIds: ["obligation:a"],
			question: "Which provider revision is current?",
			reason: "The current revision is required for this obligation.",
		}).kind,
		"dependency",
	);
	assert.equal(
		parseSkillReturn({
			kind: "not-applicable",
			targetObligationIds: ["obligation:a"],
			reason: "This method cannot address the target.",
		}).kind,
		"not-applicable",
	);
	assert.equal(
		parseSkillReturn({
			kind: "needs-context",
			targetObligationIds: ["obligation:a"],
			missingContext: ["Exact provider revision."],
		}).kind,
		"needs-context",
	);
	assert.equal(
		parseSkillReturn({ kind: "abort", reason: "The method cannot continue." })
			.kind,
		"abort",
	);
	assert.throws(
		() => parseSkillReturn({ kind: "unknown" }),
		/skillReturn.kind.*expected one of/u,
	);
	assert.throws(
		() => parseSkillReturn({ ...contribution, authority: "parent" }),
		/authority.*not allowed/u,
	);
});

test("provider failures, lifecycle settlements, and parsed aborts stay distinct", () => {
	const returned = parseInvocationSettlement({
		kind: "returned",
		invocationId: "invocation:one",
		assignmentId: "assignment:one",
		value: { kind: "abort", reason: "The method declined to continue." },
	});
	assert.equal(returned.kind, "returned");
	assert.equal(returned.value.kind, "abort");

	const failure = parseInvocationSettlement({
		kind: "capability-failed",
		invocationId: "invocation:two",
		assignmentId: "assignment:one",
		failure: { kind: "timeout", timeoutMs: 5_000 },
	});
	assert.equal(failure.kind, "capability-failed");

	const lifecycle = parseInvocationSettlement({
		kind: "lifecycle",
		invocationId: "invocation:three",
		assignmentId: "assignment:one",
		lifecycle: {
			kind: "cancelled",
			reason: "The runtime lease was lost during reload.",
			executionUncertain: true,
		},
	});
	assert.equal(lifecycle.kind, "lifecycle");
	assert.equal(lifecycle.lifecycle.executionUncertain, true);
	assert.throws(
		() =>
			parseInvocationSettlement({
				...failure,
				failure: { kind: "timeout", timeoutMs: 0 },
			}),
		/timeoutMs.*too small/u,
	);
});

test("frame conclusion proposals carry revision, discharges, stop, and blocker basis", () => {
	const proposal = parseFrameConclusionProposal({
		frameId: "frame:one",
		expectedFrameRevision: 4,
		dischargeIds: ["discharge:a", "discharge:b"],
		stopEvidence: ["Every required obligation has a current discharge."],
		expectedBlockerSetSha256: sha("5"),
		conclusion: "Reject the candidate because the invariant is contradicted.",
	});
	assert.equal(proposal.expectedFrameRevision, 4);
	assert.throws(
		() => parseFrameConclusionProposal({ ...proposal, stopEvidence: [] }),
		/stopEvidence.*must not be empty/u,
	);
});

test("event envelopes round-trip canonically and reject representation drift", () => {
	const draft: DeveloperEventDraft = {
		protocolVersion: DEVELOPER_RUNTIME_PROTOCOL,
		eventId: id("event:one"),
		workScopeId: id("scope:one"),
		scopeSequence: 0,
		previousScopeEventSha256: null,
		causalRefs: [],
		occurredAt: "2026-07-31T10:00:00.000Z",
		kind: id("route-frame-opened"),
		payload: { frameId: "frame:one", frameRevision: 0 },
	};
	const envelope = createDeveloperEventEnvelope(draft);
	assert.equal(envelope.eventSha256, developerEventSha256(draft));
	assert.equal(
		envelope.eventSha256,
		"78d67507f008f910b63c3a668190c9d57c33500ec77c73bd3a01ca64f6703eb6",
	);
	const source = canonicalDeveloperEventJson(envelope);
	assert.deepEqual(parseDeveloperEventEnvelope(JSON.parse(source)), envelope);
	assert.equal(Object.isFrozen(envelope), true);
	assert.equal(Object.isFrozen(envelope.payload), true);

	assert.throws(
		() => parseDeveloperEventEnvelope({ ...envelope, extra: true }),
		/extra.*not allowed/u,
	);
	assert.throws(
		() => parseDeveloperEventEnvelope({ ...envelope, eventId: "bad id" }),
		/eventId.*invalid representation/u,
	);
	assert.throws(
		() => parseDeveloperEventEnvelope({ ...envelope, scopeSequence: -1 }),
		/scopeSequence.*too small/u,
	);
	assert.throws(
		() =>
			parseDeveloperEventEnvelope({
				...envelope,
				previousScopeEventSha256: sha("6"),
			}),
		/must be null for the first/u,
	);
	assert.throws(
		() => parseDeveloperEventEnvelope({ ...envelope, eventSha256: sha("f") }),
		/eventSha256.*does not match/u,
	);
});

test("causal references are exact while timestamps never order scope events", () => {
	const first = createDeveloperEventEnvelope({
		protocolVersion: DEVELOPER_RUNTIME_PROTOCOL,
		eventId: id("event:first"),
		workScopeId: id("scope:one"),
		scopeSequence: 0,
		previousScopeEventSha256: null,
		causalRefs: [],
		occurredAt: "2026-07-31T12:00:00.000Z",
		kind: id("work-scope-opened"),
		payload: {},
	});
	const causalRef = parseDeveloperEventRef({
		workScopeId: first.workScopeId,
		eventId: first.eventId,
		eventSha256: first.eventSha256,
	});
	const second = createDeveloperEventEnvelope({
		protocolVersion: DEVELOPER_RUNTIME_PROTOCOL,
		eventId: id("event:second"),
		workScopeId: id("scope:one"),
		scopeSequence: 1,
		previousScopeEventSha256: first.eventSha256,
		causalRefs: [causalRef],
		occurredAt: "2026-07-31T09:00:00.000Z",
		kind: id("route-frame-opened"),
		payload: { frameId: "frame:one" },
	});
	assert.equal(parseDeveloperEventEnvelope(second).scopeSequence, 1);
	assert.equal(second.occurredAt < first.occurredAt, true);
	assert.throws(
		() =>
			parseDeveloperEventEnvelope({
				...second,
				causalRefs: [{ workScopeId: "scope:one", eventId: "event:first" }],
			}),
		/causalRefs\[0\]\.eventSha256.*required/u,
	);
	assert.throws(
		() =>
			createDeveloperEventEnvelope({
				protocolVersion: second.protocolVersion,
				eventId: second.eventId,
				workScopeId: second.workScopeId,
				scopeSequence: second.scopeSequence,
				previousScopeEventSha256: second.previousScopeEventSha256,
				causalRefs: Array.from({ length: 101 }, () => causalRef),
				occurredAt: second.occurredAt,
				kind: second.kind,
				payload: second.payload,
			}),
		/causalRefs.*too many items/u,
	);
});

test("event payloads fail before effects when their canonical bytes exceed the limit", () => {
	assert.throws(
		() =>
			createDeveloperEventEnvelope({
				protocolVersion: DEVELOPER_RUNTIME_PROTOCOL,
				eventId: id("event:large"),
				workScopeId: id("scope:one"),
				scopeSequence: 0,
				previousScopeEventSha256: null,
				causalRefs: [],
				occurredAt: "2026-07-31T10:00:00.000Z",
				kind: id("oversized-payload"),
				payload: { text: "x".repeat(MAX_EVENT_PAYLOAD_BYTES + 1) },
			}),
		/payload.*exceeds its byte limit/u,
	);
});
