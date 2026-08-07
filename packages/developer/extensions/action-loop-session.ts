import { Type, type Static } from "typebox";
import { Check } from "typebox/value";

import type { CompletedWorkCase } from "../src/action-loop/work/complete-work-case.ts";
import {
	assessLiveCapabilityApplicability,
	assignedLiveCapability,
} from "./action-loop-applicability.ts";
import type { LiveCapabilityInventoryResult } from "./action-loop-capability-inventory.ts";
import { closeLiveJudgment } from "./action-loop-conclusion.ts";
import { acceptLiveSkillContribution } from "./action-loop-contribution.ts";
import { assessLiveNeedCoverage } from "./action-loop-coverage.ts";
import {
	sealLiveUnstructuredCapability,
	selectAndSealLiveStructuredCapability,
} from "./action-loop-context.ts";
import { openLiveJudgment } from "./action-loop-judgment.ts";
import {
	openLiveWorkCase,
	type LiveWorkCaseProposal,
	type LiveWorkCaseState,
} from "./action-loop-work-case.ts";
import {
	ACTIVATION_ENTRY,
	normalizeDeveloperEvent,
} from "./state.ts";

export const ACTION_LOOP_SESSION_PROTOCOL =
	"developer-action-loop/session-event/v1";
export const ACTION_LOOP_SESSION_ENTRY = "developer.action-loop.session-event";

const IdSchema = Type.String({ minLength: 1, maxLength: 512 });
const ShortTextSchema = Type.String({ minLength: 1, maxLength: 2_000 });
const ResultTextSchema = Type.String({ minLength: 1, maxLength: 12_000 });
const PathSchema = Type.String({ minLength: 1, maxLength: 4_096 });
const BasisSchema = Type.Array(ShortTextSchema, { minItems: 1, maxItems: 32 });
const OptionalIdSchema = Type.Optional(IdSchema);
const ProvenanceSchema = Type.Object(
	{
		kind: Type.Union([
			Type.Literal("model"),
			Type.Literal("human"),
			Type.Literal("tool"),
			Type.Literal("external"),
		]),
		source: ShortTextSchema,
	},
	{ additionalProperties: false },
);
const EventHeaderSchema = {
	protocol: Type.Literal(ACTION_LOOP_SESSION_PROTOCOL),
	transitionId: IdSchema,
};

const WorkCaseProposalSchema = Type.Object(
	{
		outcome: Type.Object(
			{
				statement: ShortTextSchema,
				acceptanceConditions: Type.Array(ShortTextSchema, {
					minItems: 1,
					maxItems: 32,
				}),
				constraints: Type.Array(ShortTextSchema, { maxItems: 32 }),
			},
			{ additionalProperties: false },
		),
		basis: BasisSchema,
		provenance: ProvenanceSchema,
	},
	{ additionalProperties: false },
);
const WorkCaseOpenedEventSchema = Type.Object(
	{
		...EventHeaderSchema,
		kind: Type.Literal("work-case-opened"),
		proposal: WorkCaseProposalSchema,
		expected: Type.Object(
			{ workCaseId: IdSchema, revisionId: IdSchema },
			{ additionalProperties: false },
		),
	},
	{ additionalProperties: false },
);

const JudgmentProposalSchema = Type.Object(
	{
		category: Type.Union([
			Type.Literal("Contextual Adequacy"),
			Type.Literal("Proportionate Intervention"),
			Type.Literal("Consequence Integrity"),
			Type.Literal("Claim Assurance"),
		]),
		subject: ShortTextSchema,
		question: ShortTextSchema,
		requirements: Type.Array(
			Type.Object(
				{
					statement: ShortTextSchema,
					contributionNeeds: Type.Array(ShortTextSchema, {
						minItems: 1,
						maxItems: 8,
					}),
				},
				{ additionalProperties: false },
			),
			{ minItems: 1, maxItems: 8 },
		),
		basis: BasisSchema,
		provenance: ProvenanceSchema,
	},
	{ additionalProperties: false },
);
const JudgmentOpenedEventSchema = Type.Object(
	{
		...EventHeaderSchema,
		kind: Type.Literal("judgment-opened"),
		proposal: JudgmentProposalSchema,
		expected: Type.Object(
			{ judgmentId: IdSchema, revisionId: IdSchema },
			{ additionalProperties: false },
		),
	},
	{ additionalProperties: false },
);

const CapabilityApplicabilityProposalSchema = Type.Object(
	{
		contributionNeedId: OptionalIdSchema,
		status: Type.Union([
			Type.Literal("applicable"),
			Type.Literal("not-applicable"),
			Type.Literal("needs-context"),
		]),
		matchedWhen: Type.Array(ShortTextSchema, { maxItems: 32 }),
		matchedUnless: Type.Array(ShortTextSchema, { maxItems: 32 }),
		basis: BasisSchema,
		missingContext: Type.Array(ShortTextSchema, { maxItems: 16 }),
	},
	{ additionalProperties: false },
);
const CapabilityAssessedEventSchema = Type.Object(
	{
		...EventHeaderSchema,
		kind: Type.Literal("capability-assessed"),
		skillName: Type.String({ minLength: 1, maxLength: 128 }),
		capabilityRevisionId: IdSchema,
		proposal: CapabilityApplicabilityProposalSchema,
		expected: Type.Object(
			{
				contributionNeedId: IdSchema,
				status: Type.Union([
					Type.Literal("applicable"),
					Type.Literal("not-applicable"),
					Type.Literal("needs-context"),
				]),
				assignmentId: OptionalIdSchema,
			},
			{ additionalProperties: false },
		),
	},
	{ additionalProperties: false },
);

const ReferenceDispositionSchema = Type.Object(
	{
		path: PathSchema,
		status: Type.Union([
			Type.Literal("selected"),
			Type.Literal("not-needed"),
			Type.Literal("needs-context"),
		]),
		basis: BasisSchema,
	},
	{ additionalProperties: false },
);
const ReferencesSelectedEventSchema = Type.Object(
	{
		...EventHeaderSchema,
		kind: Type.Literal("references-selected"),
		skillName: Type.String({ minLength: 1, maxLength: 128 }),
		capabilityRevisionId: IdSchema,
		contributionNeedId: IdSchema,
		dispositions: Type.Array(ReferenceDispositionSchema, {
			minItems: 1,
			maxItems: 32,
		}),
		expected: Type.Object(
			{ selectionId: IdSchema, sealedContextId: OptionalIdSchema },
			{ additionalProperties: false },
		),
	},
	{ additionalProperties: false },
);
const UnstructuredContextSealedEventSchema = Type.Object(
	{
		...EventHeaderSchema,
		kind: Type.Literal("unstructured-context-sealed"),
		skillName: Type.String({ minLength: 1, maxLength: 128 }),
		capabilityRevisionId: IdSchema,
		assignmentId: IdSchema,
		expected: Type.Object(
			{ sealedContextId: IdSchema },
			{ additionalProperties: false },
		),
	},
	{ additionalProperties: false },
);

const SkillContributionProposalSchema = Type.Object(
	{
		contributionNeedId: OptionalIdSchema,
		localStatus: Type.Union([
			Type.Literal("resolved"),
			Type.Literal("partial"),
		]),
		result: ResultTextSchema,
		referenceApplications: Type.Array(
			Type.Object(
				{
					path: PathSchema,
					status: Type.Union([
						Type.Literal("applied"),
						Type.Literal("limited"),
					]),
					application: ShortTextSchema,
				},
				{ additionalProperties: false },
			),
			{ maxItems: 32 },
		),
		limitations: Type.Array(ShortTextSchema, { maxItems: 32 }),
		residualNeeds: Type.Array(
			Type.Object(
				{
					kind: Type.Union([
						Type.Literal("residual"),
						Type.Literal("emergent"),
					]),
					description: ShortTextSchema,
					basis: BasisSchema,
				},
				{ additionalProperties: false },
			),
			{ maxItems: 32 },
		),
		provenance: ProvenanceSchema,
	},
	{ additionalProperties: false },
);
const ContributionAcceptedEventSchema = Type.Object(
	{
		...EventHeaderSchema,
		kind: Type.Literal("contribution-accepted"),
		skillName: Type.String({ minLength: 1, maxLength: 128 }),
		capabilityRevisionId: IdSchema,
		proposal: SkillContributionProposalSchema,
		expected: Type.Object(
			{ contributionId: IdSchema },
			{ additionalProperties: false },
		),
	},
	{ additionalProperties: false },
);

const NeedCoverageProposalSchema = Type.Object(
	{
		contributionNeedId: OptionalIdSchema,
		status: Type.Union([
			Type.Literal("covered"),
			Type.Literal("partially-covered"),
			Type.Literal("conflicted"),
			Type.Literal("missing"),
		]),
		dispositions: Type.Array(
			Type.Object(
				{
					contributionId: IdSchema,
					status: Type.Union([
						Type.Literal("supports"),
						Type.Literal("limited-support"),
						Type.Literal("not-relied-on"),
					]),
					basis: BasisSchema,
				},
				{ additionalProperties: false },
			),
			{ maxItems: 64 },
		),
		conflicts: Type.Array(
			Type.Object(
				{
					leftContributionId: IdSchema,
					rightContributionId: IdSchema,
					basis: BasisSchema,
				},
				{ additionalProperties: false },
			),
			{ maxItems: 32 },
		),
		basis: BasisSchema,
		provenance: ProvenanceSchema,
	},
	{ additionalProperties: false },
);
const CoverageAssessedEventSchema = Type.Object(
	{
		...EventHeaderSchema,
		kind: Type.Literal("coverage-assessed"),
		proposal: NeedCoverageProposalSchema,
		expected: Type.Object(
			{ coverageId: IdSchema },
			{ additionalProperties: false },
		),
	},
	{ additionalProperties: false },
);

const JudgmentClosureProposalSchema = Type.Object(
	{
		outcome: Type.Union([
			Type.Literal("conclude"),
			Type.Literal("refuse"),
		]),
		answer: Type.Optional(ResultTextSchema),
		refusalReasons: Type.Array(ShortTextSchema, { maxItems: 32 }),
		requirementDispositions: Type.Array(
			Type.Object(
				{
					requirementId: IdSchema,
					status: Type.Union([
						Type.Literal("satisfied"),
						Type.Literal("not-satisfied"),
						Type.Literal("needs-context"),
					]),
					coverageIds: Type.Array(IdSchema, { maxItems: 32 }),
					basis: BasisSchema,
				},
				{ additionalProperties: false },
			),
			{ minItems: 1, maxItems: 32 },
		),
		basis: BasisSchema,
		provenance: ProvenanceSchema,
	},
	{ additionalProperties: false },
);
const JudgmentConcludedEventSchema = Type.Object(
	{
		...EventHeaderSchema,
		kind: Type.Literal("judgment-concluded"),
		proposal: JudgmentClosureProposalSchema,
		expected: Type.Object(
			{ conclusionId: IdSchema, revisionId: IdSchema },
			{ additionalProperties: false },
		),
	},
	{ additionalProperties: false },
);

const SessionEventSchema = Type.Union([
	WorkCaseOpenedEventSchema,
	JudgmentOpenedEventSchema,
	CapabilityAssessedEventSchema,
	ReferencesSelectedEventSchema,
	UnstructuredContextSealedEventSchema,
	ContributionAcceptedEventSchema,
	CoverageAssessedEventSchema,
	JudgmentConcludedEventSchema,
]);

export type ActionLoopWorkCaseOpenedEvent = Static<
	typeof WorkCaseOpenedEventSchema
>;
export type ActionLoopJudgmentOpenedEvent = Static<
	typeof JudgmentOpenedEventSchema
>;
export type ActionLoopCapabilityAssessedEvent = Static<
	typeof CapabilityAssessedEventSchema
>;
export type ActionLoopReferencesSelectedEvent = Static<
	typeof ReferencesSelectedEventSchema
>;
export type ActionLoopUnstructuredContextSealedEvent = Static<
	typeof UnstructuredContextSealedEventSchema
>;
export type ActionLoopContributionAcceptedEvent = Static<
	typeof ContributionAcceptedEventSchema
>;
export type ActionLoopCoverageAssessedEvent = Static<
	typeof CoverageAssessedEventSchema
>;
export type ActionLoopJudgmentConcludedEvent = Static<
	typeof JudgmentConcludedEventSchema
>;
export type ActionLoopSessionEvent = Static<typeof SessionEventSchema>;

type JudgmentProposal = Static<typeof JudgmentProposalSchema>;
type CapabilityProposal = Static<typeof CapabilityApplicabilityProposalSchema>;
type ReferenceDisposition = Static<typeof ReferenceDispositionSchema>;
type ContributionProposal = Static<typeof SkillContributionProposalSchema>;
type CoverageProposal = Static<typeof NeedCoverageProposalSchema>;
type ClosureProposal = Static<typeof JudgmentClosureProposalSchema>;

export interface ActionLoopSessionBranchEntry {
	readonly type?: string;
	readonly customType?: string;
	readonly data?: unknown;
	readonly message?: {
		readonly role?: string;
		readonly toolName?: string;
		readonly toolCallId?: string;
		readonly content?: unknown;
		readonly details?: unknown;
		readonly isError?: boolean;
	};
}

export type ActionLoopSessionReplayResult =
	| {
			readonly status: "ready";
			readonly activeWorkCase?: LiveWorkCaseState;
			readonly completedWorkCase?: CompletedWorkCase;
			readonly appliedTransitions: number;
	  }
	| {
			readonly status: "unavailable";
			readonly entryIndex: number;
			readonly message: string;
	  };

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function actionLoopWorkCaseOpenedEvent(
	proposal: LiveWorkCaseProposal,
	state: LiveWorkCaseState,
): ActionLoopWorkCaseOpenedEvent {
	return Object.freeze({
		protocol: ACTION_LOOP_SESSION_PROTOCOL,
		kind: "work-case-opened",
		transitionId: state.workCase.workCaseId,
		proposal: {
			outcome: {
				statement: proposal.outcome.statement,
				acceptanceConditions: [...proposal.outcome.acceptanceConditions],
				constraints: [...proposal.outcome.constraints],
			},
			basis: [...proposal.basis],
			provenance: { ...proposal.provenance },
		},
		expected: {
			workCaseId: state.workCase.workCaseId,
			revisionId: state.workCase.revisionId,
		},
	});
}

export function actionLoopJudgmentOpenedEvent(
	proposal: JudgmentProposal,
	judgmentId: string,
	revisionId: string,
): ActionLoopJudgmentOpenedEvent {
	return Object.freeze({
		protocol: ACTION_LOOP_SESSION_PROTOCOL,
		kind: "judgment-opened",
		transitionId: judgmentId,
		proposal,
		expected: { judgmentId, revisionId },
	});
}

export function actionLoopCapabilityAssessedEvent(
	skillName: string,
	proposal: CapabilityProposal,
	assessment: {
		readonly capabilityRevisionId: string;
		readonly contributionNeedId: string;
		readonly status: CapabilityProposal["status"];
	},
	assignmentId?: string,
): ActionLoopCapabilityAssessedEvent {
	const transitionId =
		assignmentId ??
		`${assessment.capabilityRevisionId}:${assessment.contributionNeedId}:${assessment.status}`;
	return Object.freeze({
		protocol: ACTION_LOOP_SESSION_PROTOCOL,
		kind: "capability-assessed",
		transitionId,
		skillName,
		capabilityRevisionId: assessment.capabilityRevisionId,
		proposal,
		expected: {
			contributionNeedId: assessment.contributionNeedId,
			status: assessment.status,
			...(assignmentId ? { assignmentId } : {}),
		},
	});
}

export function actionLoopReferencesSelectedEvent(input: {
	readonly skillName: string;
	readonly capabilityRevisionId: string;
	readonly contributionNeedId: string;
	readonly dispositions: ReferenceDisposition[];
	readonly selectionId: string;
	readonly sealedContextId?: string;
}): ActionLoopReferencesSelectedEvent {
	return Object.freeze({
		protocol: ACTION_LOOP_SESSION_PROTOCOL,
		kind: "references-selected",
		transitionId: input.selectionId,
		skillName: input.skillName,
		capabilityRevisionId: input.capabilityRevisionId,
		contributionNeedId: input.contributionNeedId,
		dispositions: input.dispositions,
		expected: {
			selectionId: input.selectionId,
			...(input.sealedContextId
				? { sealedContextId: input.sealedContextId }
				: {}),
		},
	});
}

export function actionLoopUnstructuredContextSealedEvent(
	skillName: string,
	capabilityRevisionId: string,
	assignmentId: string,
	sealedContextId: string,
): ActionLoopUnstructuredContextSealedEvent {
	return Object.freeze({
		protocol: ACTION_LOOP_SESSION_PROTOCOL,
		kind: "unstructured-context-sealed",
		transitionId: sealedContextId,
		skillName,
		capabilityRevisionId,
		assignmentId,
		expected: { sealedContextId },
	});
}

export function actionLoopContributionAcceptedEvent(
	skillName: string,
	capabilityRevisionId: string,
	proposal: ContributionProposal,
	contributionId: string,
): ActionLoopContributionAcceptedEvent {
	return Object.freeze({
		protocol: ACTION_LOOP_SESSION_PROTOCOL,
		kind: "contribution-accepted",
		transitionId: contributionId,
		skillName,
		capabilityRevisionId,
		proposal,
		expected: { contributionId },
	});
}

export function actionLoopCoverageAssessedEvent(
	proposal: CoverageProposal,
	coverageId: string,
): ActionLoopCoverageAssessedEvent {
	return Object.freeze({
		protocol: ACTION_LOOP_SESSION_PROTOCOL,
		kind: "coverage-assessed",
		transitionId: coverageId,
		proposal,
		expected: { coverageId },
	});
}

export function actionLoopJudgmentConcludedEvent(
	proposal: ClosureProposal,
	conclusionId: string,
	revisionId: string,
): ActionLoopJudgmentConcludedEvent {
	return Object.freeze({
		protocol: ACTION_LOOP_SESSION_PROTOCOL,
		kind: "judgment-concluded",
		transitionId: conclusionId,
		proposal,
		expected: { conclusionId, revisionId },
	});
}

export function withActionLoopReplayEvent<T extends object>(
	details: T,
	replayEvent: ActionLoopSessionEvent,
): T & { readonly replayEvent: ActionLoopSessionEvent } {
	return Object.freeze({ ...details, replayEvent });
}

type ExtractedEvent =
	| { readonly status: "absent" }
	| { readonly status: "event"; readonly event: ActionLoopSessionEvent }
	| { readonly status: "invalid" };

function claimedReplayEvent(
	entry: ActionLoopSessionBranchEntry,
): { readonly claimed: boolean; readonly value?: unknown } {
	if (entry.customType === ACTION_LOOP_SESSION_ENTRY) {
		return { claimed: true, value: entry.data };
	}
	const details = entry.message?.details;
	if (
		isRecord(details) &&
		Object.hasOwn(details, "replayEvent")
	) {
		return { claimed: true, value: details.replayEvent };
	}
	return { claimed: false };
}

function extractReplayEvent(entry: ActionLoopSessionBranchEntry): ExtractedEvent {
	const candidate = claimedReplayEvent(entry);
	if (!candidate.claimed) return { status: "absent" };
	if (!Check(SessionEventSchema, candidate.value)) {
		return { status: "invalid" };
	}
	return { status: "event", event: candidate.value };
}

function unavailable(
	entryIndex: number,
	message: string,
): ActionLoopSessionReplayResult {
	return { status: "unavailable", entryIndex, message };
}

function currentCapability(
	inventory: LiveCapabilityInventoryResult | undefined,
	skillName: string,
	capabilityRevisionId: string,
) {
	if (!inventory || inventory.status !== "ready") return undefined;
	const entry = inventory.value.boundCapabilitiesBySkillName.get(skillName);
	return entry?.capability.capabilityRevisionId === capabilityRevisionId
		? entry
		: undefined;
}

interface ReplayProjection {
	readonly activeWorkCase?: LiveWorkCaseState;
	readonly completedWorkCase?: CompletedWorkCase;
}

type AppliedEventResult =
	| { readonly status: "applied"; readonly projection: ReplayProjection }
	| { readonly status: "unavailable"; readonly message: string };

function applied(
	activeWorkCase: LiveWorkCaseState,
	completedWorkCase?: CompletedWorkCase,
): AppliedEventResult {
	return {
		status: "applied",
		projection: {
			activeWorkCase,
			...(completedWorkCase ? { completedWorkCase } : {}),
		},
	};
}

function eventUnavailable(message: string): AppliedEventResult {
	return { status: "unavailable", message };
}

function unreachableSessionEvent(value: never): never {
	throw new Error(`Unsupported Action Loop session event: ${String(value)}`);
}

function replayWorkCaseOpening(
	projection: ReplayProjection,
	event: ActionLoopWorkCaseOpenedEvent,
): AppliedEventResult {
	const opened = openLiveWorkCase(projection.activeWorkCase, event.proposal);
	if (
		(opened.status !== "opened" && opened.status !== "unchanged") ||
		opened.value.workCase.workCaseId !== event.expected.workCaseId ||
		opened.value.workCase.revisionId !== event.expected.revisionId ||
		event.transitionId !== event.expected.workCaseId
	) {
		return eventUnavailable(
			"Persisted Work Case opening does not reproduce its exact canonical identity.",
		);
	}
	return applied(opened.value);
}

function replayJudgmentOpening(
	state: LiveWorkCaseState,
	event: ActionLoopJudgmentOpenedEvent,
): AppliedEventResult {
	const opened = openLiveJudgment(state, event.proposal);
	if (
		opened.status === "invalid" ||
		opened.judgment.judgmentId !== event.expected.judgmentId ||
		opened.state.workCase.revisionId !== event.expected.revisionId ||
		event.transitionId !== event.expected.judgmentId
	) {
		return eventUnavailable(
			"Persisted Judgment opening does not reproduce its exact canonical identity.",
		);
	}
	return applied(opened.state);
}

function replayCapabilityAssessment(
	state: LiveWorkCaseState,
	event: ActionLoopCapabilityAssessedEvent,
	inventory: LiveCapabilityInventoryResult | undefined,
): AppliedEventResult {
	const capability = currentCapability(
		inventory,
		event.skillName,
		event.capabilityRevisionId,
	);
	if (!capability) {
		return eventUnavailable(
			`Capability ${event.skillName}@${event.capabilityRevisionId} is not in the current Pi-admitted inventory.`,
		);
	}
	const assessed = assessLiveCapabilityApplicability(
		state,
		capability,
		event.proposal,
	);
	const expectedTransitionId =
		event.expected.assignmentId ??
		`${event.capabilityRevisionId}:${event.expected.contributionNeedId}:${event.expected.status}`;
	if (
		assessed.status === "invalid" ||
		assessed.assessment.contributionNeedId !==
			event.expected.contributionNeedId ||
		assessed.assessment.status !== event.expected.status ||
		assessed.assignment?.assignmentId !== event.expected.assignmentId ||
		event.transitionId !== expectedTransitionId
	) {
		return eventUnavailable(
			"Persisted Capability assessment does not reproduce its exact Assignment.",
		);
	}
	return applied(assessed.state);
}

async function replayReferenceSelection(
	state: LiveWorkCaseState,
	event: ActionLoopReferencesSelectedEvent,
	inventory: LiveCapabilityInventoryResult | undefined,
): Promise<AppliedEventResult> {
	const capability = currentCapability(
		inventory,
		event.skillName,
		event.capabilityRevisionId,
	);
	if (!capability || capability.routing !== "structured") {
		return eventUnavailable(
			`Structured Capability ${event.skillName}@${event.capabilityRevisionId} is unavailable for exact Reference reacquisition.`,
		);
	}
	const assignment = assignedLiveCapability(
		state,
		capability,
		event.contributionNeedId,
	);
	if (!assignment) {
		return eventUnavailable(
			"Persisted Reference selection has no exact current Capability Assignment.",
		);
	}
	const selected = await selectAndSealLiveStructuredCapability(
		state,
		capability,
		assignment,
		event.dispositions,
	);
	if (
		selected.status === "invalid" ||
		selected.selectionId !== event.expected.selectionId ||
		selected.context?.sealedContextId !== event.expected.sealedContextId ||
		event.transitionId !== event.expected.selectionId
	) {
		return eventUnavailable(
			"Persisted Reference selection or sealed bytes drifted from its exact identity.",
		);
	}
	return applied(selected.state);
}

async function replayUnstructuredContext(
	state: LiveWorkCaseState,
	event: ActionLoopUnstructuredContextSealedEvent,
	inventory: LiveCapabilityInventoryResult | undefined,
): Promise<AppliedEventResult> {
	const capability = currentCapability(
		inventory,
		event.skillName,
		event.capabilityRevisionId,
	);
	const assignment = state.capabilityAssignments.find(
		(candidate) => candidate.assignmentId === event.assignmentId,
	);
	if (!capability || capability.routing !== "unstructured" || !assignment) {
		return eventUnavailable(
			`Unstructured Capability ${event.skillName}@${event.capabilityRevisionId} is unavailable for exact Skill reacquisition.`,
		);
	}
	const sealed = await sealLiveUnstructuredCapability(
		state,
		capability,
		assignment,
	);
	if (
		sealed.status === "invalid" ||
		sealed.context.sealedContextId !== event.expected.sealedContextId ||
		event.transitionId !== event.expected.sealedContextId
	) {
		return eventUnavailable(
			"Persisted unstructured Skill bytes drifted from their exact sealed identity.",
		);
	}
	return applied(sealed.state);
}

function replayContribution(
	state: LiveWorkCaseState,
	event: ActionLoopContributionAcceptedEvent,
	inventory: LiveCapabilityInventoryResult | undefined,
): AppliedEventResult {
	const capability = currentCapability(
		inventory,
		event.skillName,
		event.capabilityRevisionId,
	);
	if (!capability) {
		return eventUnavailable(
			`Contribution Capability ${event.skillName}@${event.capabilityRevisionId} is unavailable.`,
		);
	}
	const accepted = acceptLiveSkillContribution(
		state,
		capability,
		event.proposal,
	);
	if (
		accepted.status === "invalid" ||
		accepted.contribution.contributionId !== event.expected.contributionId ||
		event.transitionId !== event.expected.contributionId
	) {
		return eventUnavailable(
			"Persisted Skill Contribution does not reproduce its exact canonical identity.",
		);
	}
	return applied(accepted.state);
}

function replayCoverage(
	state: LiveWorkCaseState,
	event: ActionLoopCoverageAssessedEvent,
): AppliedEventResult {
	const assessed = assessLiveNeedCoverage(state, event.proposal);
	if (
		assessed.status === "invalid" ||
		assessed.coverage.coverageId !== event.expected.coverageId ||
		event.transitionId !== event.expected.coverageId
	) {
		return eventUnavailable(
			"Persisted Need Coverage does not reproduce its exact canonical identity.",
		);
	}
	return applied(assessed.state);
}

function replayConclusion(
	state: LiveWorkCaseState,
	event: ActionLoopJudgmentConcludedEvent,
): AppliedEventResult {
	const closed = closeLiveJudgment(state, event.proposal);
	if (
		closed.status !== "concluded" ||
		closed.conclusion.conclusionId !== event.expected.conclusionId ||
		closed.state.workCase.revisionId !== event.expected.revisionId ||
		event.transitionId !== event.expected.conclusionId
	) {
		return eventUnavailable(
			"Persisted Judgment Conclusion does not reproduce its exact canonical identity.",
		);
	}
	return applied(closed.state);
}

async function replayOwnedEvent(
	state: LiveWorkCaseState,
	event: Exclude<ActionLoopSessionEvent, ActionLoopWorkCaseOpenedEvent>,
	inventory: LiveCapabilityInventoryResult | undefined,
): Promise<AppliedEventResult> {
	switch (event.kind) {
		case "judgment-opened":
			return replayJudgmentOpening(state, event);
		case "capability-assessed":
			return replayCapabilityAssessment(state, event, inventory);
		case "references-selected":
			return replayReferenceSelection(state, event, inventory);
		case "unstructured-context-sealed":
			return replayUnstructuredContext(state, event, inventory);
		case "contribution-accepted":
			return replayContribution(state, event, inventory);
		case "coverage-assessed":
			return replayCoverage(state, event);
		case "judgment-concluded":
			return replayConclusion(state, event);
		default:
			return unreachableSessionEvent(event);
	}
}

async function replaySessionEvent(
	projection: ReplayProjection,
	event: ActionLoopSessionEvent,
	inventory: LiveCapabilityInventoryResult | undefined,
): Promise<AppliedEventResult> {
	if (event.kind === "work-case-opened") {
		return replayWorkCaseOpening(projection, event);
	}
	if (!projection.activeWorkCase) {
		return eventUnavailable(
			`Persisted ${event.kind} transition has no active Work Case owner.`,
		);
	}
	return replayOwnedEvent(projection.activeWorkCase, event, inventory);
}

export async function replayActionLoopSession(
	entries: readonly ActionLoopSessionBranchEntry[],
	inventory?: LiveCapabilityInventoryResult,
): Promise<ActionLoopSessionReplayResult> {
	let projection: ReplayProjection = {};
	let appliedTransitions = 0;

	for (const [entryIndex, entry] of entries.entries()) {
		if (entry.customType === ACTIVATION_ENTRY) {
			const event = normalizeDeveloperEvent(entry.data);
			if (event?.kind === "activation" && !event.enabled) projection = {};
		}
		const extracted = extractReplayEvent(entry);
		if (extracted.status === "absent") continue;
		if (extracted.status === "invalid") {
			return unavailable(
				entryIndex,
				"Claimed Action Loop session event is malformed or unsupported.",
			);
		}
		const replayed = await replaySessionEvent(
			projection,
			extracted.event,
			inventory,
		);
		if (replayed.status === "unavailable") {
			return unavailable(entryIndex, replayed.message);
		}
		projection = replayed.projection;
		appliedTransitions += 1;
	}

	return {
		status: "ready",
		...projection,
		appliedTransitions,
	};
}
