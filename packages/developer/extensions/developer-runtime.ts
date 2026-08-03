import {
	AUTHORIZE_CHANGE_TOOL,
	CONCLUDE_JUDGMENT_TOOL,
	OPEN_CONTEXT_SOURCES_TOOL,
	OPEN_JUDGMENT_TOOL,
	RECORD_LANDING_TOOL,
} from "../src/runtime-tools.ts";
import {
	accountRoutingPage,
	beginRoutingCoverage,
	completeRoutingCoverage,
	createCandidateDisposition,
	createCanServeRoutingBasis,
	createRoutingCandidateDescriptor,
	createRoutingCandidatePages,
	createRoutingSnapshotManifest,
	type SkillPolicyRevision,
} from "../src/routing-context.ts";
import {
	DEVELOPER_SKILL_RETURN_CONTRACT,
	MAX_RUNTIME_ARRAY_LENGTH,
	MAX_RUNTIME_TEXT_LENGTH,
	canonicalValueSha256,
	createReadySkillAssignment,
	createRouteDefinition,
	obligationSetSha256,
	parseDeveloperId,
	parseObligation,
	parseRouteFrame,
	parseSha256Digest,
	parseSnapshotBasis,
	type CausalEventRef,
	type DeveloperId,
	type Obligation,
	type RouteDefinition,
	type RouteFrame,
	type Sha256Digest,
} from "../src/runtime-protocol.ts";
import {
	initialDeveloperWorkScopeState,
	openRouteFrame,
	type DeveloperWorkScopeState,
} from "../src/runtime-transition.ts";

export type DeveloperRuntimeAdapterErrorCode =
	| "invalid-input"
	| "unknown-route"
	| "unknown-operation"
	| "duplicate-obligation"
	| "noncanonical-obligations"
	| "duplicate-skill-candidate"
	| "invalid-skill-candidate"
	| "invalid-target"
	| "transition-rejected"
	| "invalid-checkpoint";

const ADAPTER_ERROR_CODES: ReadonlySet<string> = new Set([
	"invalid-input",
	"unknown-route",
	"unknown-operation",
	"duplicate-obligation",
	"noncanonical-obligations",
	"duplicate-skill-candidate",
	"invalid-skill-candidate",
	"invalid-target",
	"transition-rejected",
	"invalid-checkpoint",
] satisfies readonly DeveloperRuntimeAdapterErrorCode[]);

export interface DeveloperRuntimeAdapterFault {
	readonly developerRuntimeAdapterFault: true;
	readonly code: DeveloperRuntimeAdapterErrorCode;
	readonly message: string;
}

export function isDeveloperRuntimeAdapterFault(
	value: unknown,
): value is DeveloperRuntimeAdapterFault {
	return (
		typeof value === "object" &&
		value !== null &&
		"developerRuntimeAdapterFault" in value &&
		value.developerRuntimeAdapterFault === true &&
		"code" in value &&
		typeof value.code === "string" &&
		ADAPTER_ERROR_CODES.has(value.code) &&
		"message" in value &&
		typeof value.message === "string"
	);
}

const ROUTE_DEFINITION_BODIES = Object.freeze([
	Object.freeze({
		routeDefinitionId: parseDeveloperId("route:meaning-settlement"),
		sign: "meaning settlement",
		sense:
			"Settle product meaning, scope, invariants, constraints, and blocking unknowns before implementation.",
	}),
	Object.freeze({
		routeDefinitionId: parseDeveloperId("route:condition-settlement"),
		sign: "condition settlement",
		sense:
			"Settle condition space, rules, forbidden states, transitions, objectives, and guarantee placement for correctness.",
	}),
	Object.freeze({
		routeDefinitionId: parseDeveloperId("route:implementation-shaping"),
		sign: "implementation shaping",
		sense:
			"Shape implementable data, interfaces, responsibilities, collaborations, checks, and a bounded implementation queue from settled intent.",
	}),
	Object.freeze({
		routeDefinitionId: parseDeveloperId(
			"route:structural-pressure-observation",
		),
		sign: "structural-pressure observation",
		sense:
			"Determine whether observable structural movement warrants a bounded candidate without treating similarity as proof.",
	}),
	Object.freeze({
		routeDefinitionId: parseDeveloperId("route:name-sense-judgment"),
		sign: "name–sense judgment",
		sense:
			"Judge whether a code name preserves stable domain meaning, scope, distinctions, and visible effects.",
	}),
	Object.freeze({
		routeDefinitionId: parseDeveloperId("route:candidate-reliability"),
		sign: "candidate reliability",
		sense:
			"Judge whether a concrete interface, helper, API, workflow rule, boundary, or structure is reliable enough to keep, revise, split, reject, or defer.",
	}),
	Object.freeze({
		routeDefinitionId: parseDeveloperId("route:change-timing"),
		sign: "change timing",
		sense:
			"Decide whether a concrete change belongs now, after, or never under invariant pressure, evidence, reversibility, nested-work pressure, and delay cost.",
	}),
	Object.freeze({
		routeDefinitionId: parseDeveloperId("route:claim-evidence-assessment"),
		sign: "claim–evidence assessment",
		sense:
			"Determine the strongest scoped claim supported by current code, tests, observations, invariants, and source provenance.",
	}),
]);

export const DEVELOPER_RUNTIME_ROUTE_DEFINITIONS: readonly RouteDefinition[] =
	Object.freeze(
		ROUTE_DEFINITION_BODIES.map((definition) =>
			createRouteDefinition(definition),
		),
	);

const routeDefinitionsById = new Map(
	DEVELOPER_RUNTIME_ROUTE_DEFINITIONS.map((definition) => [
		definition.routeDefinitionId,
		definition,
	]),
);

export type DeveloperRuntimeSourceOperation =
	| "/developer on"
	| typeof OPEN_JUDGMENT_TOOL
	| typeof OPEN_CONTEXT_SOURCES_TOOL
	| typeof CONCLUDE_JUDGMENT_TOOL
	| typeof AUTHORIZE_CHANGE_TOOL
	| typeof RECORD_LANDING_TOOL;

export type DeveloperRuntimeFrameEffect =
	| "none"
	| "open-explicit-frame"
	| "preserve-open-frame"
	| "propose-guarded-conclusion"
	| "require-concluded-frame"
	| "declare-reroute-and-verification-debt";

export type DeveloperRuntimeSkillEffect =
	| "none"
	| "candidate-only-0..N"
	| "candidate-support-only";

export type DeveloperRuntimeRootEffect =
	| "establish-work-scope"
	| "observe-only"
	| "authorize-separately"
	| "record-landing-only";

export interface DeveloperRuntimeOperationMapping {
	readonly sourceOperation: DeveloperRuntimeSourceOperation;
	readonly frameEffect: DeveloperRuntimeFrameEffect;
	readonly skillEffect: DeveloperRuntimeSkillEffect;
	readonly rootEffect: DeveloperRuntimeRootEffect;
	readonly performsTransition: false;
}

export const DEVELOPER_RUNTIME_OPERATION_MAPPINGS: readonly DeveloperRuntimeOperationMapping[] =
	Object.freeze([
		Object.freeze({
			sourceOperation: "/developer on",
			frameEffect: "none",
			skillEffect: "none",
			rootEffect: "establish-work-scope",
			performsTransition: false as const,
		}),
		Object.freeze({
			sourceOperation: OPEN_JUDGMENT_TOOL,
			frameEffect: "open-explicit-frame",
			skillEffect: "candidate-only-0..N",
			rootEffect: "observe-only",
			performsTransition: false as const,
		}),
		Object.freeze({
			sourceOperation: OPEN_CONTEXT_SOURCES_TOOL,
			frameEffect: "preserve-open-frame",
			skillEffect: "candidate-only-0..N",
			rootEffect: "observe-only",
			performsTransition: false as const,
		}),
		Object.freeze({
			sourceOperation: CONCLUDE_JUDGMENT_TOOL,
			frameEffect: "propose-guarded-conclusion",
			skillEffect: "candidate-support-only",
			rootEffect: "observe-only",
			performsTransition: false as const,
		}),
		Object.freeze({
			sourceOperation: AUTHORIZE_CHANGE_TOOL,
			frameEffect: "require-concluded-frame",
			skillEffect: "none",
			rootEffect: "authorize-separately",
			performsTransition: false as const,
		}),
		Object.freeze({
			sourceOperation: RECORD_LANDING_TOOL,
			frameEffect: "declare-reroute-and-verification-debt",
			skillEffect: "none",
			rootEffect: "record-landing-only",
			performsTransition: false as const,
		}),
	]);

const operationMappingsByName: ReadonlyMap<
	string,
	DeveloperRuntimeOperationMapping
> = new Map(
	DEVELOPER_RUNTIME_OPERATION_MAPPINGS.map((mapping) => [
		mapping.sourceOperation,
		mapping,
	]),
);

export const DEVELOPER_RUNTIME_ADAPTER_REVISION_SHA256 = canonicalValueSha256({
	domain: "developer/v8/runtime-adapter-checkpoint",
	routeDefinitions: DEVELOPER_RUNTIME_ROUTE_DEFINITIONS.map((definition) => ({
		routeDefinitionId: definition.routeDefinitionId,
		revisionSha256: definition.revisionSha256,
	})),
	operationMappings: DEVELOPER_RUNTIME_OPERATION_MAPPINGS,
});

export type DeveloperRuntimeSkillSourceOperation =
	| typeof OPEN_JUDGMENT_TOOL
	| typeof OPEN_CONTEXT_SOURCES_TOOL;

export interface DeveloperRuntimeSkillCandidateInput {
	readonly skillCapabilityId: DeveloperId;
	readonly skillName: string;
	readonly skillLocation: string;
	readonly skillRevisionSha256: Sha256Digest;
	readonly sourceOperation: DeveloperRuntimeSkillSourceOperation;
	readonly targetObligationIds: readonly DeveloperId[];
}

export interface DeveloperRuntimeSkillCandidate {
	readonly skillCapabilityId: DeveloperId;
	readonly skillName: string;
	readonly skillLocation: string;
	readonly skillRevisionSha256: Sha256Digest;
	readonly sourceOperation: DeveloperRuntimeSkillSourceOperation;
	readonly targetObligationIds: readonly DeveloperId[];
	readonly authority: "candidate-only";
	readonly candidateSha256: Sha256Digest;
}

export interface DeveloperRuntimeAdapterObligationInput {
	readonly obligationId: DeveloperId;
	readonly statement: string;
}

export interface CreateDeveloperRuntimeAdapterCheckpointInput {
	readonly workScopeId: DeveloperId;
	readonly frameId: DeveloperId;
	readonly routeDefinitionId: DeveloperId;
	readonly exactQuestion: string;
	readonly obligations: readonly DeveloperRuntimeAdapterObligationInput[];
	readonly skillCandidates: readonly DeveloperRuntimeSkillCandidateInput[];
}

const checkpointBrand: unique symbol = Symbol(
	"DeveloperRuntimeAdapterCheckpoint",
);

export interface DeveloperRuntimeAdapterCheckpoint {
	readonly adapterRevisionSha256: Sha256Digest;
	readonly routeDefinition: RouteDefinition;
	readonly frame: RouteFrame;
	readonly obligations: readonly Obligation[];
	readonly skillCandidates: readonly DeveloperRuntimeSkillCandidate[];
	readonly workScopeState: DeveloperWorkScopeState;
	readonly checkpointSha256: Sha256Digest;
	readonly [checkpointBrand]: true;
}

const checkpointValues = new WeakSet<object>();

function stop(
	...input: readonly [code: DeveloperRuntimeAdapterErrorCode, message: string]
): never {
	const [code, message] = input;
	throw Object.freeze({
		developerRuntimeAdapterFault: true,
		code,
		message,
	} satisfies DeveloperRuntimeAdapterFault);
}

function refinedId(input: {
	readonly value: DeveloperId;
	readonly label: string;
}): DeveloperId {
	try {
		return parseDeveloperId(input.value, input.label);
	} catch {
		return stop("invalid-input", `${input.label} is invalid`);
	}
}

function refinedSha256(input: {
	readonly value: Sha256Digest;
	readonly label: string;
}): Sha256Digest {
	try {
		return parseSha256Digest(input.value, input.label);
	} catch {
		return stop("invalid-input", `${input.label} is invalid`);
	}
}

function refinedText(input: {
	readonly value: string;
	readonly label: string;
}): string {
	if (
		typeof input.value !== "string" ||
		input.value.trim().length === 0 ||
		input.value !== input.value.trim() ||
		input.value.length > MAX_RUNTIME_TEXT_LENGTH
	) {
		return stop("invalid-input", `${input.label} must be non-blank exact text`);
	}
	return input.value;
}

function canonicalIds(input: {
	readonly values: readonly DeveloperId[];
	readonly label: string;
	readonly nonEmpty: boolean;
}): readonly DeveloperId[] {
	if (
		!Array.isArray(input.values) ||
		input.values.length > MAX_RUNTIME_ARRAY_LENGTH ||
		(input.nonEmpty && input.values.length === 0)
	) {
		return stop("invalid-input", `${input.label} has an invalid count`);
	}
	const refined: DeveloperId[] = [];
	for (const [index, value] of input.values.entries()) {
		refined.push(refinedId({ value, label: `${input.label}[${index}]` }));
	}
	for (let index = 1; index < refined.length; index += 1) {
		const previous = refined[index - 1];
		const current = refined[index];
		if (previous === current) {
			return stop("invalid-target", `${input.label} contains a duplicate`);
		}
		if (previous !== undefined && current !== undefined && previous > current) {
			return stop("invalid-target", `${input.label} is not canonical`);
		}
	}
	return Object.freeze(refined);
}

function refinedObligations(input: {
	readonly frameId: DeveloperId;
	readonly values: readonly DeveloperRuntimeAdapterObligationInput[];
}): readonly Obligation[] {
	if (
		!Array.isArray(input.values) ||
		input.values.length === 0 ||
		input.values.length > MAX_RUNTIME_ARRAY_LENGTH
	) {
		return stop("invalid-input", "adapter obligations require 1..100 entries");
	}
	const obligations: Obligation[] = [];
	for (const [index, value] of input.values.entries()) {
		try {
			obligations.push(
				parseObligation(
					{
						obligationId: value.obligationId,
						frameId: input.frameId,
						statement: value.statement,
					},
					`adapter.obligations[${index}]`,
				),
			);
		} catch {
			return stop("invalid-input", `adapter obligation ${index} is invalid`);
		}
	}
	for (let index = 1; index < obligations.length; index += 1) {
		const previous = obligations[index - 1];
		const current = obligations[index];
		if (previous?.obligationId === current?.obligationId) {
			return stop("duplicate-obligation", "adapter obligation is duplicated");
		}
		if (
			previous !== undefined &&
			current !== undefined &&
			previous.obligationId > current.obligationId
		) {
			return stop(
				"noncanonical-obligations",
				"adapter obligations are not in canonical identity order",
			);
		}
	}
	return Object.freeze(obligations);
}

function refinedSkillCandidates(input: {
	readonly values: readonly DeveloperRuntimeSkillCandidateInput[];
	readonly obligationIds: readonly DeveloperId[];
}): readonly DeveloperRuntimeSkillCandidate[] {
	if (
		!Array.isArray(input.values) ||
		input.values.length > MAX_RUNTIME_ARRAY_LENGTH
	) {
		return stop("invalid-input", "adapter Skill candidates exceed the bound");
	}
	const obligationSet = new Set(input.obligationIds);
	const capabilityIds = new Set<DeveloperId>();
	let owningCandidateCount = 0;
	const candidates: DeveloperRuntimeSkillCandidate[] = [];
	for (const [index, value] of input.values.entries()) {
		const skillCapabilityId = refinedId({
			value: value.skillCapabilityId,
			label: `adapter.skillCandidates[${index}].skillCapabilityId`,
		});
		if (capabilityIds.has(skillCapabilityId)) {
			return stop(
				"duplicate-skill-candidate",
				"adapter Skill capability is duplicated",
			);
		}
		capabilityIds.add(skillCapabilityId);
		const skillName = refinedText({
			value: value.skillName,
			label: `adapter.skillCandidates[${index}].skillName`,
		});
		const skillLocation = refinedText({
			value: value.skillLocation,
			label: `adapter.skillCandidates[${index}].skillLocation`,
		});
		const skillRevisionSha256 = refinedSha256({
			value: value.skillRevisionSha256,
			label: `adapter.skillCandidates[${index}].skillRevisionSha256`,
		});
		if (
			value.sourceOperation !== OPEN_JUDGMENT_TOOL &&
			value.sourceOperation !== OPEN_CONTEXT_SOURCES_TOOL
		) {
			return stop(
				"invalid-skill-candidate",
				"adapter Skill source operation is invalid",
			);
		}
		if (value.sourceOperation === OPEN_JUDGMENT_TOOL) {
			owningCandidateCount += 1;
			if (owningCandidateCount > 1) {
				return stop(
					"invalid-skill-candidate",
					"adapter accepts at most one owning Skill candidate",
				);
			}
		}
		const targetObligationIds = canonicalIds({
			values: value.targetObligationIds,
			label: `adapter.skillCandidates[${index}].targetObligationIds`,
			nonEmpty: true,
		});
		if (targetObligationIds.some((target) => !obligationSet.has(target))) {
			return stop(
				"invalid-target",
				"adapter Skill candidate targets an unknown obligation",
			);
		}
		const fields = Object.freeze({
			skillCapabilityId,
			skillName,
			skillLocation,
			skillRevisionSha256,
			sourceOperation: value.sourceOperation,
			targetObligationIds,
			authority: "candidate-only" as const,
		});
		candidates.push(
			Object.freeze({
				...fields,
				candidateSha256: canonicalValueSha256({
					domain: "developer/v8/runtime-skill-candidate",
					fields,
				}),
			}),
		);
	}
	return Object.freeze(candidates);
}

export function developerRuntimeRouteDefinition(
	routeDefinitionIdInput: DeveloperId,
): RouteDefinition {
	const routeDefinitionId = refinedId({
		value: routeDefinitionIdInput,
		label: "adapter.routeDefinitionId",
	});
	const definition = routeDefinitionsById.get(routeDefinitionId);
	if (definition === undefined) {
		return stop(
			"unknown-route",
			`unknown Developer route: ${routeDefinitionId}`,
		);
	}
	return definition;
}

export function developerRuntimeOperationMapping(
	operation: string,
): DeveloperRuntimeOperationMapping {
	const mapping = operationMappingsByName.get(operation);
	if (mapping === undefined) {
		return stop(
			"unknown-operation",
			`unknown Developer operation: ${operation}`,
		);
	}
	return mapping;
}

export function createDeveloperRuntimeAdapterCheckpoint(
	input: CreateDeveloperRuntimeAdapterCheckpointInput,
): DeveloperRuntimeAdapterCheckpoint {
	const workScopeId = refinedId({
		value: input.workScopeId,
		label: "adapter.workScopeId",
	});
	const frameId = refinedId({
		value: input.frameId,
		label: "adapter.frameId",
	});
	const routeDefinition = developerRuntimeRouteDefinition(
		input.routeDefinitionId,
	);
	const obligations = refinedObligations({
		frameId,
		values: input.obligations,
	});
	const obligationIds = Object.freeze(
		obligations.map((obligation) => obligation.obligationId),
	);
	let frame: RouteFrame;
	try {
		frame = parseRouteFrame({
			frameId,
			frameRevision: 0,
			workScopeId,
			parentFrameId: null,
			routeDefinitionId: routeDefinition.routeDefinitionId,
			routeDefinitionRevisionSha256: routeDefinition.revisionSha256,
			exactQuestion: input.exactQuestion,
			obligationIds,
			obligationSetSha256: obligationSetSha256(obligations),
		});
	} catch {
		return stop("invalid-input", "adapter RouteFrame input is invalid");
	}
	const skillCandidates = refinedSkillCandidates({
		values: input.skillCandidates,
		obligationIds,
	});
	const initialState = initialDeveloperWorkScopeState(workScopeId);
	const opened = openRouteFrame(initialState, frame, obligations);
	if (!opened.ok) {
		return stop(
			"transition-rejected",
			`adapter frame transition rejected: ${opened.error.message}`,
		);
	}
	const fields = Object.freeze({
		adapterRevisionSha256: DEVELOPER_RUNTIME_ADAPTER_REVISION_SHA256,
		routeDefinitionRevisionSha256: routeDefinition.revisionSha256,
		frame,
		obligations,
		skillCandidates,
	});
	const checkpoint: DeveloperRuntimeAdapterCheckpoint = Object.freeze({
		adapterRevisionSha256: DEVELOPER_RUNTIME_ADAPTER_REVISION_SHA256,
		routeDefinition,
		frame,
		obligations,
		skillCandidates,
		workScopeState: opened.state,
		checkpointSha256: canonicalValueSha256({
			domain: "developer/v8/runtime-adapter-checkpoint/value",
			fields,
		}),
		[checkpointBrand]: true as const,
	});
	checkpointValues.add(checkpoint);
	return checkpoint;
}

export function verifyDeveloperRuntimeAdapterCheckpoint(
	value: DeveloperRuntimeAdapterCheckpoint,
): DeveloperRuntimeAdapterCheckpoint {
	if (!checkpointValues.has(value)) {
		return stop(
			"invalid-checkpoint",
			"Developer runtime adapter checkpoint is not process-local",
		);
	}
	return value;
}

export interface DeveloperRuntimeOwnerPlanInput {
	readonly snapshotId: DeveloperId;
	readonly basisId: DeveloperId;
	readonly assignmentId: DeveloperId;
	readonly invocationId: DeveloperId;
	readonly policy: SkillPolicyRevision;
	readonly subquestion: string;
	readonly expectedContribution: string;
	readonly limitations: readonly string[];
}

export interface DeveloperRuntimeOpenPlanInput {
	readonly checkpoint: DeveloperRuntimeAdapterCheckpoint;
	readonly frameCausalRefs: readonly CausalEventRef[];
	readonly owner: DeveloperRuntimeOwnerPlanInput | null;
}

export interface DeveloperRuntimePlannedEvent {
	readonly kind: DeveloperId;
	readonly payload: Readonly<Record<string, unknown>>;
	readonly causalRefs: readonly CausalEventRef[];
}

const openPlanBrand: unique symbol = Symbol("DeveloperRuntimeOpenPlan");

export interface DeveloperRuntimeOpenPlan {
	readonly events: readonly DeveloperRuntimePlannedEvent[];
	readonly ownerAssignmentId: DeveloperId | null;
	readonly ownerInvocationId: DeveloperId | null;
	readonly planSha256: Sha256Digest;
	readonly [openPlanBrand]: true;
}

const openPlanValues = new WeakSet<object>();

function sortedSkillCandidates(
	values: readonly DeveloperRuntimeSkillCandidate[],
): readonly DeveloperRuntimeSkillCandidate[] {
	const sorted = [...values];
	for (let index = 1; index < sorted.length; index += 1) {
		let cursor = index;
		while (cursor > 0) {
			const previous = sorted[cursor - 1];
			const current = sorted[cursor];
			if (
				previous === undefined ||
				current === undefined ||
				previous.skillCapabilityId <= current.skillCapabilityId
			) {
				break;
			}
			sorted[cursor - 1] = current;
			sorted[cursor] = previous;
			cursor -= 1;
		}
	}
	return Object.freeze(sorted);
}

function plannedEvent(input: {
	readonly kind: string;
	readonly payload: Readonly<Record<string, unknown>>;
	readonly causalRefs?: readonly CausalEventRef[];
}): DeveloperRuntimePlannedEvent {
	return Object.freeze({
		kind: parseDeveloperId(input.kind, "plannedEvent.kind"),
		payload: input.payload,
		causalRefs: Object.freeze([...(input.causalRefs ?? [])]),
	});
}

export function createDeveloperRuntimeOpenPlan(
	input: DeveloperRuntimeOpenPlanInput,
): DeveloperRuntimeOpenPlan {
	const checkpoint = verifyDeveloperRuntimeAdapterCheckpoint(input.checkpoint);
	const ownerCandidate = checkpoint.skillCandidates.find(
		(candidate) => candidate.sourceOperation === OPEN_JUDGMENT_TOOL,
	);
	if ((ownerCandidate === undefined) !== (input.owner === null)) {
		return stop(
			"invalid-skill-candidate",
			"open plan owner must exactly match the owning Skill candidate",
		);
	}
	const events: DeveloperRuntimePlannedEvent[] = [
		plannedEvent({
			kind: "route-frame-opened",
			payload: Object.freeze({
				frame: checkpoint.frame,
				obligations: checkpoint.obligations,
				parentDependency: null,
			}),
			causalRefs: input.frameCausalRefs,
		}),
	];
	if (ownerCandidate !== undefined && input.owner !== null) {
		const orderedCandidates = sortedSkillCandidates(checkpoint.skillCandidates);
		const descriptors = orderedCandidates.map((candidate) =>
			createRoutingCandidateDescriptor({
				candidateId: parseDeveloperId(
					`candidate:${candidate.skillCapabilityId}`,
				),
				kind: "capability",
				source: {
					sourceId: parseDeveloperId(`source:${candidate.skillCapabilityId}`),
					revision: candidate.skillRevisionSha256,
				},
				subjectId: candidate.skillCapabilityId,
				subjectRevisionSha256: candidate.skillRevisionSha256,
				registryRevisionSha256: DEVELOPER_RUNTIME_ADAPTER_REVISION_SHA256,
			}),
		);
		const admittedUniverseSha256 = canonicalValueSha256({
			domain: "developer/v8/adapter-admitted-universe",
			descriptors,
		});
		const snapshotBasis = parseSnapshotBasis({
			frameId: checkpoint.frame.frameId,
			frameRevision: checkpoint.frame.frameRevision,
			obligationSetSha256: checkpoint.frame.obligationSetSha256,
			admittedUniverseSha256,
			providerSourceRevisions: descriptors.map(
				(descriptor) => descriptor.source,
			),
			priorityStrategySha256: DEVELOPER_RUNTIME_ADAPTER_REVISION_SHA256,
		});
		const pages = createRoutingCandidatePages(
			input.owner.snapshotId,
			descriptors,
			100,
		);
		const manifest = createRoutingSnapshotManifest(
			input.owner.snapshotId,
			snapshotBasis,
			pages,
		);
		let coverage = beginRoutingCoverage(
			snapshotBasis,
			manifest,
			checkpoint.obligations,
		);
		for (const page of pages) {
			const dispositions = page.candidates.map((descriptor) => {
				const selected =
					descriptor.subjectId === ownerCandidate.skillCapabilityId;
				return createCandidateDisposition({
					candidateId: descriptor.candidateId,
					descriptorSha256: descriptor.descriptorSha256,
					kind: selected ? "selected-for-material" : "considered-not-selected",
					targetEffects: checkpoint.obligations.map((obligation) => ({
						obligationId: obligation.obligationId,
						effect:
							selected &&
							ownerCandidate.targetObligationIds.includes(
								obligation.obligationId,
							)
								? "selected"
								: "cleared",
					})),
					rationale: selected
						? "The explicit owning Skill candidate is selected."
						: "The capability was considered but not selected for this frame.",
				});
			});
			coverage = accountRoutingPage(coverage, page, dispositions);
			events.push(
				plannedEvent({
					kind: "routing-page-accounted",
					payload: Object.freeze({ page, dispositions }),
				}),
			);
		}
		const completed = completeRoutingCoverage(coverage);
		const ownerDescriptor = descriptors.find(
			(descriptor) => descriptor.subjectId === ownerCandidate.skillCapabilityId,
		);
		if (ownerDescriptor === undefined) {
			return stop("invalid-skill-candidate", "owner descriptor is absent");
		}
		const basis = createCanServeRoutingBasis(completed, {
			basisId: input.owner.basisId,
			candidateId: ownerDescriptor.candidateId,
			targetObligationIds: ownerCandidate.targetObligationIds,
			methodRevisionSha256: ownerCandidate.skillRevisionSha256,
			policy: input.owner.policy,
			rootApplicability: "applicable",
		});
		const assignment = createReadySkillAssignment({
			assignmentId: input.owner.assignmentId,
			skillCapabilityId: basis.capabilityId,
			skillRevisionSha256: basis.capabilityRevisionSha256,
			parentFrameId: checkpoint.frame.frameId,
			parentFrameRevision: checkpoint.frame.frameRevision,
			targetObligationIds: ownerCandidate.targetObligationIds,
			subquestion: refinedText({
				value: input.owner.subquestion,
				label: "owner.subquestion",
			}),
			applicabilityBasisSha256: basis.basisSha256,
			expectedContribution: refinedText({
				value: input.owner.expectedContribution,
				label: "owner.expectedContribution",
			}),
			limitations: input.owner.limitations,
			returnContract: DEVELOPER_SKILL_RETURN_CONTRACT,
			contextBasisSha256: completed.coverageSha256,
			authority: "contribution-only",
		});
		events.splice(
			1,
			0,
			plannedEvent({
				kind: "routing-snapshot-opened",
				payload: Object.freeze({
					basis: snapshotBasis,
					manifest,
					replacesSnapshotId: null,
				}),
			}),
		);
		events.push(
			plannedEvent({
				kind: "routing-coverage-completed",
				payload: Object.freeze({
					snapshotId: manifest.snapshotId,
					expectedCoverageSha256: completed.coverageSha256,
				}),
			}),
			plannedEvent({
				kind: "can-serve-basis-created",
				payload: Object.freeze({
					snapshotId: manifest.snapshotId,
					body: {
						basisId: input.owner.basisId,
						candidateId: ownerDescriptor.candidateId,
						targetObligationIds: ownerCandidate.targetObligationIds,
						methodRevisionSha256: ownerCandidate.skillRevisionSha256,
						policy: input.owner.policy,
						rootApplicability: "applicable",
					},
					expectedBasisSha256: basis.basisSha256,
				}),
			}),
			plannedEvent({
				kind: "ready-assignment-recorded",
				payload: Object.freeze({
					assignment,
					basisId: basis.basisId,
				}),
			}),
			plannedEvent({
				kind: "skill-invocation-started",
				payload: Object.freeze({
					invocationId: input.owner.invocationId,
					assignmentId: assignment.assignmentId,
				}),
			}),
		);
	}
	const plan: DeveloperRuntimeOpenPlan = Object.freeze({
		events: Object.freeze(events),
		ownerAssignmentId: input.owner?.assignmentId ?? null,
		ownerInvocationId: input.owner?.invocationId ?? null,
		planSha256: canonicalValueSha256({
			domain: "developer/v8/runtime-open-plan",
			events,
		}),
		[openPlanBrand]: true as const,
	});
	openPlanValues.add(plan);
	return plan;
}

export function verifyDeveloperRuntimeOpenPlan(
	value: DeveloperRuntimeOpenPlan,
): DeveloperRuntimeOpenPlan {
	if (!openPlanValues.has(value)) {
		return stop(
			"invalid-checkpoint",
			"Developer runtime open plan is not process-local",
		);
	}
	return value;
}
