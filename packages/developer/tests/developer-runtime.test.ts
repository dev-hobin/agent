import assert from "node:assert/strict";
import test from "node:test";

import {
	DEVELOPER_RUNTIME_ADAPTER_REVISION_SHA256,
	DEVELOPER_RUNTIME_OPERATION_MAPPINGS,
	DEVELOPER_RUNTIME_ROUTE_DEFINITIONS,
	createDeveloperRuntimeAdapterCheckpoint,
	createDeveloperRuntimeOpenPlan,
	developerRuntimeOperationMapping,
	developerRuntimeRouteDefinition,
	isDeveloperRuntimeAdapterFault,
	verifyDeveloperRuntimeAdapterCheckpoint,
	verifyDeveloperRuntimeOpenPlan,
	type CreateDeveloperRuntimeAdapterCheckpointInput,
	type DeveloperRuntimeAdapterErrorCode,
	type DeveloperRuntimeSkillCandidateInput,
} from "../extensions/developer-runtime.ts";
import {
	AUTHORIZE_CHANGE_TOOL,
	CONCLUDE_JUDGMENT_TOOL,
	DEVELOPER_PROTOCOL_TOOLS,
	OPEN_CONTEXT_SOURCES_TOOL,
	OPEN_JUDGMENT_TOOL,
	RECORD_LANDING_TOOL,
} from "../src/runtime-tools.ts";
import {
	parseDeveloperId,
	parseSha256Digest,
	type DeveloperId,
} from "../src/runtime-protocol.ts";
import { runtimeFrameState } from "../src/runtime-transition.ts";

const id = (value: string) => parseDeveloperId(value);
const sha = (character: string) => parseSha256Digest(character.repeat(64));

function hasAdapterFault(code: DeveloperRuntimeAdapterErrorCode) {
	return (error: unknown) =>
		isDeveloperRuntimeAdapterFault(error) && error.code === code;
}

function createUnchecked(value: unknown): unknown {
	return Reflect.apply(createDeveloperRuntimeAdapterCheckpoint, undefined, [
		value,
	]);
}

function obligation(input: {
	readonly obligationId: string;
	readonly statement?: string;
}) {
	return {
		obligationId: id(input.obligationId),
		statement: input.statement ?? `Settle ${input.obligationId}`,
	};
}

function skillCandidate(input: {
	readonly skillCapabilityId: string;
	readonly skillName?: string;
	readonly skillLocation?: string;
	readonly revisionCharacter?: string;
	readonly sourceOperation?:
		| typeof OPEN_JUDGMENT_TOOL
		| typeof OPEN_CONTEXT_SOURCES_TOOL;
	readonly targetObligationIds: readonly DeveloperId[];
}): DeveloperRuntimeSkillCandidateInput {
	return {
		skillCapabilityId: id(input.skillCapabilityId),
		skillName: input.skillName ?? input.skillCapabilityId,
		skillLocation:
			input.skillLocation ?? `/skills/${input.skillCapabilityId}/SKILL.md`,
		skillRevisionSha256: sha(input.revisionCharacter ?? "a"),
		sourceOperation: input.sourceOperation ?? OPEN_CONTEXT_SOURCES_TOOL,
		targetObligationIds: input.targetObligationIds,
	};
}

function checkpointInput(input: {
	readonly suffix: string;
	readonly routeDefinitionId?: DeveloperId;
	readonly obligations?: CreateDeveloperRuntimeAdapterCheckpointInput["obligations"];
	readonly skillCandidates?: CreateDeveloperRuntimeAdapterCheckpointInput["skillCandidates"];
	readonly exactQuestion?: string;
}): CreateDeveloperRuntimeAdapterCheckpointInput {
	return {
		workScopeId: id(`scope:adapter-${input.suffix}`),
		frameId: id(`frame:adapter-${input.suffix}`),
		routeDefinitionId:
			input.routeDefinitionId ?? id("route:implementation-shaping"),
		exactQuestion:
			input.exactQuestion ?? "What implementable boundary should exist?",
		obligations:
			input.obligations ??
			Object.freeze([
				obligation({ obligationId: `obligation:${input.suffix}-a` }),
			]),
		skillCandidates: input.skillCandidates ?? Object.freeze([]),
	};
}

test("the stable route catalog contains eight Skill-independent signs and senses", () => {
	assert.deepEqual(
		DEVELOPER_RUNTIME_ROUTE_DEFINITIONS.map(
			(definition) => definition.routeDefinitionId,
		),
		[
			"route:meaning-settlement",
			"route:condition-settlement",
			"route:implementation-shaping",
			"route:structural-pressure-observation",
			"route:name-sense-judgment",
			"route:candidate-reliability",
			"route:change-timing",
			"route:claim-evidence-assessment",
		],
	);
	assert.deepEqual(
		DEVELOPER_RUNTIME_ROUTE_DEFINITIONS.map((definition) => definition.sign),
		[
			"meaning settlement",
			"condition settlement",
			"implementation shaping",
			"structural-pressure observation",
			"name–sense judgment",
			"candidate reliability",
			"change timing",
			"claim–evidence assessment",
		],
	);
	assert.equal(
		new Set(
			DEVELOPER_RUNTIME_ROUTE_DEFINITIONS.map(
				(definition) => definition.revisionSha256,
			),
		).size,
		8,
	);
	for (const definition of DEVELOPER_RUNTIME_ROUTE_DEFINITIONS) {
		assert.equal(Object.isFrozen(definition), true);
		assert.equal(definition.sense.length > definition.sign.length, true);
		assert.equal(
			developerRuntimeRouteDefinition(definition.routeDefinitionId),
			definition,
		);
	}
	assert.equal(
		DEVELOPER_RUNTIME_ADAPTER_REVISION_SHA256,
		"c8c7f2378a29ed4f3912b1dd0c74781886163743a0a43c432c6bcb70c046a478",
	);
	assert.throws(
		() => developerRuntimeRouteDefinition(id("route:unknown")),
		hasAdapterFault("unknown-route"),
	);
});

test("the adapter maps activation and exactly the five runtime operations without executing them", () => {
	assert.deepEqual(
		DEVELOPER_RUNTIME_OPERATION_MAPPINGS.map(
			(mapping) => mapping.sourceOperation,
		),
		["/developer on", ...DEVELOPER_PROTOCOL_TOOLS],
	);
	assert.deepEqual(DEVELOPER_RUNTIME_OPERATION_MAPPINGS, [
		{
			sourceOperation: "/developer on",
			frameEffect: "none",
			skillEffect: "none",
			rootEffect: "establish-work-scope",
			performsTransition: false,
		},
		{
			sourceOperation: OPEN_JUDGMENT_TOOL,
			frameEffect: "open-explicit-frame",
			skillEffect: "candidate-only-0..N",
			rootEffect: "observe-only",
			performsTransition: false,
		},
		{
			sourceOperation: OPEN_CONTEXT_SOURCES_TOOL,
			frameEffect: "preserve-open-frame",
			skillEffect: "candidate-only-0..N",
			rootEffect: "observe-only",
			performsTransition: false,
		},
		{
			sourceOperation: CONCLUDE_JUDGMENT_TOOL,
			frameEffect: "propose-guarded-conclusion",
			skillEffect: "candidate-support-only",
			rootEffect: "observe-only",
			performsTransition: false,
		},
		{
			sourceOperation: AUTHORIZE_CHANGE_TOOL,
			frameEffect: "require-concluded-frame",
			skillEffect: "none",
			rootEffect: "authorize-separately",
			performsTransition: false,
		},
		{
			sourceOperation: RECORD_LANDING_TOOL,
			frameEffect: "declare-reroute-and-verification-debt",
			skillEffect: "none",
			rootEffect: "record-landing-only",
			performsTransition: false,
		},
	]);
	for (const mapping of DEVELOPER_RUNTIME_OPERATION_MAPPINGS) {
		assert.equal(
			developerRuntimeOperationMapping(mapping.sourceOperation),
			mapping,
		);
		assert.equal(Object.isFrozen(mapping), true);
	}
	assert.throws(
		() => developerRuntimeOperationMapping("developer_infer_route"),
		hasAdapterFault("unknown-operation"),
	);
});

test("zero Skill candidates open one real v8 root frame without assignment authority", () => {
	const checkpoint = createDeveloperRuntimeAdapterCheckpoint(
		checkpointInput({ suffix: "zero" }),
	);
	assert.equal(verifyDeveloperRuntimeAdapterCheckpoint(checkpoint), checkpoint);
	assert.equal(checkpoint.frame.parentFrameId, null);
	assert.equal(checkpoint.frame.frameRevision, 0);
	assert.equal(checkpoint.skillCandidates.length, 0);
	assert.equal(checkpoint.workScopeState.frames.length, 1);
	assert.equal(checkpoint.workScopeState.assignments.length, 0);
	assert.equal(checkpoint.workScopeState.activeInvocation, null);
	const frameState = runtimeFrameState(
		checkpoint.workScopeState,
		checkpoint.frame.frameId,
	);
	assert.ok(frameState);
	assert.equal(frameState.routing, null);
	assert.equal(frameState.contributions.length, 0);
	assert.equal(frameState.discharges.length, 0);
	assert.equal(frameState.conclusion, null);
	assert.equal(Object.isFrozen(checkpoint), true);
	assert.equal(Object.isFrozen(checkpoint.obligations), true);
});

test("open plans preserve zero-Skill completion and one-owner invocation ordering", () => {
	const zero = createDeveloperRuntimeAdapterCheckpoint(
		checkpointInput({ suffix: "plan-zero" }),
	);
	const zeroPlan = createDeveloperRuntimeOpenPlan({
		checkpoint: zero,
		frameCausalRefs: [],
		owner: null,
	});
	assert.deepEqual(
		zeroPlan.events.map((event) => event.kind),
		["route-frame-opened"],
	);
	const target = id("obligation:plan-owner-a");
	const ownerCheckpoint = createDeveloperRuntimeAdapterCheckpoint(
		checkpointInput({
			suffix: "plan-owner",
			obligations: [obligation({ obligationId: target })],
			skillCandidates: [
				skillCandidate({
					skillCapabilityId: "skill:plan-owner",
					sourceOperation: OPEN_JUDGMENT_TOOL,
					targetObligationIds: [target],
				}),
				skillCandidate({
					skillCapabilityId: "skill:plan-context",
					revisionCharacter: "b",
					targetObligationIds: [target],
				}),
			],
		}),
	);
	const ownerPlan = createDeveloperRuntimeOpenPlan({
		checkpoint: ownerCheckpoint,
		frameCausalRefs: [],
		owner: {
			snapshotId: id("snapshot:plan-owner"),
			basisId: id("basis:plan-owner"),
			assignmentId: id("assignment:plan-owner"),
			invocationId: id("invocation:plan-owner"),
			policy: { kind: "absent" },
			subquestion: "What contribution serves this obligation?",
			expectedContribution: "A bounded contribution with limits.",
			limitations: ["Contribution-only authority."],
		},
	});
	assert.equal(verifyDeveloperRuntimeOpenPlan(ownerPlan), ownerPlan);
	assert.deepEqual(
		ownerPlan.events.map((event) => event.kind),
		[
			"route-frame-opened",
			"routing-snapshot-opened",
			"routing-page-accounted",
			"routing-coverage-completed",
			"can-serve-basis-created",
			"ready-assignment-recorded",
			"skill-invocation-started",
		],
	);
	assert.equal(ownerPlan.ownerAssignmentId, id("assignment:plan-owner"));
	assert.equal(ownerPlan.ownerInvocationId, id("invocation:plan-owner"));
	assert.throws(
		() => verifyDeveloperRuntimeOpenPlan(structuredClone(ownerPlan)),
		hasAdapterFault("invalid-checkpoint"),
	);
});

test("same-name Skills remain distinct 0..N candidates and never prove route service", () => {
	const firstObligationId = id("obligation:many-a");
	const secondObligationId = id("obligation:many-b");
	const checkpoint = createDeveloperRuntimeAdapterCheckpoint(
		checkpointInput({
			suffix: "many",
			obligations: [
				obligation({ obligationId: firstObligationId }),
				obligation({ obligationId: secondObligationId }),
			],
			skillCandidates: [
				skillCandidate({
					skillCapabilityId: "skill:shaping-owner",
					skillName: "implementation shaping",
					sourceOperation: OPEN_JUDGMENT_TOOL,
					targetObligationIds: [firstObligationId],
				}),
				skillCandidate({
					skillCapabilityId: "skill:shaping-context",
					skillName: "implementation shaping",
					revisionCharacter: "b",
					targetObligationIds: [secondObligationId],
				}),
			],
		}),
	);
	assert.equal(checkpoint.routeDefinition.sign, "implementation shaping");
	assert.equal(checkpoint.skillCandidates.length, 2);
	assert.deepEqual(
		checkpoint.skillCandidates.map((candidate) => candidate.skillName),
		["implementation shaping", "implementation shaping"],
	);
	assert.deepEqual(
		checkpoint.skillCandidates.map((candidate) => candidate.authority),
		["candidate-only", "candidate-only"],
	);
	assert.notEqual(
		checkpoint.skillCandidates[0]?.skillCapabilityId,
		checkpoint.routeDefinition.routeDefinitionId,
	);
	assert.notEqual(
		checkpoint.skillCandidates[0]?.candidateSha256,
		checkpoint.skillCandidates[1]?.candidateSha256,
	);
	assert.equal(checkpoint.workScopeState.assignments.length, 0);
	const frameState = runtimeFrameState(
		checkpoint.workScopeState,
		checkpoint.frame.frameId,
	);
	assert.ok(frameState);
	assert.equal(frameState.routing, null);
	assert.equal(frameState.contributions.length, 0);
});

test("obligations stay canonical while Skill target sets accept natural order", () => {
	const first = obligation({ obligationId: "obligation:constraints-a" });
	const second = obligation({ obligationId: "obligation:constraints-b" });
	assert.throws(
		() =>
			createDeveloperRuntimeAdapterCheckpoint(
				checkpointInput({
					suffix: "noncanonical-obligations",
					obligations: [second, first],
				}),
			),
		hasAdapterFault("noncanonical-obligations"),
	);
	assert.throws(
		() =>
			createDeveloperRuntimeAdapterCheckpoint(
				checkpointInput({
					suffix: "duplicate-obligations",
					obligations: [first, first],
				}),
			),
		hasAdapterFault("duplicate-obligation"),
	);
	assert.throws(
		() =>
			createDeveloperRuntimeAdapterCheckpoint(
				checkpointInput({ suffix: "empty-obligations", obligations: [] }),
			),
		hasAdapterFault("invalid-input"),
	);
	assert.throws(
		() =>
			createDeveloperRuntimeAdapterCheckpoint(
				checkpointInput({
					suffix: "unknown-target",
					obligations: [first],
					skillCandidates: [
						skillCandidate({
							skillCapabilityId: "skill:unknown-target",
							targetObligationIds: [id("obligation:not-in-frame")],
						}),
					],
				}),
			),
		hasAdapterFault("invalid-target"),
	);
	const naturalOrder = createDeveloperRuntimeAdapterCheckpoint(
		checkpointInput({
			suffix: "natural-target-order",
			obligations: [first, second],
			skillCandidates: [
				skillCandidate({
					skillCapabilityId: "skill:natural-target-order",
					targetObligationIds: [second.obligationId, first.obligationId],
				}),
			],
		}),
	);
	assert.deepEqual(naturalOrder.skillCandidates[0]?.targetObligationIds, [
		first.obligationId,
		second.obligationId,
	]);
	assert.throws(
		() =>
			createDeveloperRuntimeAdapterCheckpoint(
				checkpointInput({
					suffix: "duplicate-targets",
					obligations: [first, second],
					skillCandidates: [
						skillCandidate({
							skillCapabilityId: "skill:duplicate-targets",
							targetObligationIds: [first.obligationId, first.obligationId],
						}),
					],
				}),
			),
		hasAdapterFault("invalid-target"),
	);
});

test("adapter faults are ordinary Errors with actionable messages", () => {
	assert.throws(
		() =>
			createDeveloperRuntimeAdapterCheckpoint(
				checkpointInput({ suffix: "formatted-error", obligations: [] }),
			),
		(error: unknown) => {
			assert.equal(error instanceof Error, true);
			assert.equal(isDeveloperRuntimeAdapterFault(error), true);
			assert.match(
				String(error),
				/adapter obligations require 1\.\.100 entries/u,
			);
			assert.notEqual(String(error), "[object Object]");
			return true;
		},
	);
});

test("duplicate capability identity and multiple owning Skills fail before frame authority", () => {
	const target = id("obligation:candidates-a");
	const owner = skillCandidate({
		skillCapabilityId: "skill:duplicate",
		sourceOperation: OPEN_JUDGMENT_TOOL,
		targetObligationIds: [target],
	});
	assert.throws(
		() =>
			createDeveloperRuntimeAdapterCheckpoint(
				checkpointInput({
					suffix: "duplicate-capability",
					obligations: [obligation({ obligationId: target })],
					skillCandidates: [
						owner,
						{
							...owner,
							sourceOperation: OPEN_CONTEXT_SOURCES_TOOL,
						},
					],
				}),
			),
		hasAdapterFault("duplicate-skill-candidate"),
	);
	assert.throws(
		() =>
			createDeveloperRuntimeAdapterCheckpoint(
				checkpointInput({
					suffix: "two-owners",
					obligations: [obligation({ obligationId: target })],
					skillCandidates: [
						owner,
						skillCandidate({
							skillCapabilityId: "skill:second-owner",
							sourceOperation: OPEN_JUDGMENT_TOOL,
							targetObligationIds: [target],
						}),
					],
				}),
			),
		hasAdapterFault("invalid-skill-candidate"),
	);
});

test("raw malformed candidate fields fail before a checkpoint can be created", () => {
	const target = id("obligation:raw-a");
	const base = checkpointInput({
		suffix: "raw",
		obligations: [obligation({ obligationId: target })],
	});
	const candidate = skillCandidate({
		skillCapabilityId: "skill:raw",
		targetObligationIds: [target],
	});
	assert.throws(
		() => createUnchecked({ ...base, workScopeId: "not an identifier" }),
		hasAdapterFault("invalid-input"),
	);
	assert.throws(
		() =>
			createUnchecked({
				...base,
				obligations: [{ ...base.obligations[0], statement: " " }],
			}),
		hasAdapterFault("invalid-input"),
	);
	assert.throws(
		() =>
			createUnchecked({
				...base,
				skillCandidates: [{ ...candidate, skillName: " " }],
			}),
		hasAdapterFault("invalid-input"),
	);
	assert.throws(
		() =>
			createUnchecked({
				...base,
				skillCandidates: [
					{ ...candidate, skillRevisionSha256: "not-a-sha256" },
				],
			}),
		hasAdapterFault("invalid-input"),
	);
	assert.throws(
		() =>
			createUnchecked({
				...base,
				skillCandidates: [
					{ ...candidate, sourceOperation: "developer_unknown" },
				],
			}),
		hasAdapterFault("invalid-skill-candidate"),
	);
	assert.throws(
		() =>
			createUnchecked({
				...base,
				skillCandidates: [
					{ ...candidate, targetObligationIds: [target, target] },
				],
			}),
		hasAdapterFault("invalid-target"),
	);
	assert.throws(
		() =>
			createUnchecked({
				...base,
				skillCandidates: [{ ...candidate, targetObligationIds: [] }],
			}),
		hasAdapterFault("invalid-input"),
	);
	assert.throws(
		() =>
			createUnchecked({
				...base,
				skillCandidates: Array.from({ length: 101 }, () => candidate),
			}),
		hasAdapterFault("invalid-input"),
	);
});

test("checkpoint content is deterministic while authority remains process-local", () => {
	const input = checkpointInput({ suffix: "identity" });
	const first = createDeveloperRuntimeAdapterCheckpoint(input);
	const second = createDeveloperRuntimeAdapterCheckpoint(input);
	assert.notEqual(first, second);
	assert.notEqual(first.workScopeState, second.workScopeState);
	assert.equal(first.checkpointSha256, second.checkpointSha256);
	assert.equal(first.routeDefinition, second.routeDefinition);
	assert.throws(
		() => verifyDeveloperRuntimeAdapterCheckpoint(structuredClone(first)),
		hasAdapterFault("invalid-checkpoint"),
	);
	assert.throws(
		() =>
			createDeveloperRuntimeAdapterCheckpoint(
				checkpointInput({
					suffix: "unknown-route",
					routeDefinitionId: id("route:not-registered"),
				}),
			),
		hasAdapterFault("unknown-route"),
	);
	assert.throws(
		() =>
			createDeveloperRuntimeAdapterCheckpoint(
				checkpointInput({ suffix: "blank-question", exactQuestion: " " }),
			),
		hasAdapterFault("invalid-input"),
	);
});
