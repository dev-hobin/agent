import { Type, type Static } from "typebox";
import { Check } from "typebox/value";

import type { EffectObservation } from "../src/action-loop/effect/effect-observation.ts";
import type { CompletedWorkCase } from "../src/action-loop/work/complete-work-case.ts";
import {
	acceptLivePiActionCandidate,
	assessLiveActionClearance,
} from "./action-loop-action.ts";
import {
	assessLiveCapabilityApplicability,
	assignedLiveCapability,
} from "./action-loop-applicability.ts";
import type { LiveCapabilityInventoryResult } from "./action-loop-capability-inventory.ts";
import { completeLiveWorkCase } from "./action-loop-completion.ts";
import { closeLiveJudgment } from "./action-loop-conclusion.ts";
import { acceptLiveSkillContribution } from "./action-loop-contribution.ts";
import { assessLiveNeedCoverage } from "./action-loop-coverage.ts";
import {
	sealLiveUnstructuredCapability,
	selectAndSealLiveStructuredCapability,
} from "./action-loop-context.ts";
import {
	acceptLiveEffectObservation,
	beginLiveActionEffect,
	currentLiveEffectAssessmentId,
	recordLiveEffectRemediation,
	settleLiveEffect,
} from "./action-loop-effect.ts";
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

const PiActionProposalSchema = Type.Object(
	{
		toolName: Type.Union([
			Type.Literal("bash"),
			Type.Literal("edit"),
			Type.Literal("write"),
		]),
		toolInput: Type.Record(Type.String(), Type.Unknown()),
		summary: ShortTextSchema,
		intendedEffects: Type.Array(ShortTextSchema, {
			minItems: 1,
			maxItems: 32,
		}),
		requiredConclusionIds: Type.Array(IdSchema, {
			minItems: 1,
			maxItems: 32,
		}),
	},
	{ additionalProperties: false },
);
const ActionClearedEventSchema = Type.Object(
	{
		...EventHeaderSchema,
		kind: Type.Literal("action-cleared"),
		proposal: PiActionProposalSchema,
		expected: Type.Object(
			{
				actionCandidateId: IdSchema,
				actionClearanceId: IdSchema,
				revisionId: IdSchema,
			},
			{ additionalProperties: false },
		),
	},
	{ additionalProperties: false },
);
const EffectBegunEventSchema = Type.Object(
	{
		...EventHeaderSchema,
		kind: Type.Literal("effect-begun"),
		actionClearanceId: IdSchema,
		occurrenceId: IdSchema,
		expected: Type.Object(
			{ effectId: IdSchema, revisionId: IdSchema },
			{ additionalProperties: false },
		),
	},
	{ additionalProperties: false },
);
const EffectObservationProposalSchema = Type.Object(
	{
		effectId: IdSchema,
		occurrenceId: IdSchema,
		evidence: Type.Object(
			{
				kind: Type.Literal("tool-result"),
				locator: ShortTextSchema,
				fingerprint: IdSchema,
			},
			{ additionalProperties: false },
		),
		statement: ShortTextSchema,
		limitations: Type.Array(ShortTextSchema, { maxItems: 32 }),
		provenance: ProvenanceSchema,
	},
	{ additionalProperties: false },
);
const EffectObservedEventSchema = Type.Object(
	{
		...EventHeaderSchema,
		kind: Type.Literal("effect-observed"),
		proposal: EffectObservationProposalSchema,
		expected: Type.Object(
			{ effectObservationId: IdSchema },
			{ additionalProperties: false },
		),
	},
	{ additionalProperties: false },
);
const EffectSettlementProposalSchema = Type.Object(
	{
		outcome: Type.Union([
			Type.Literal("observed-success"),
			Type.Literal("observed-no-effect"),
			Type.Literal("failed"),
			Type.Literal("partially-applied"),
			Type.Literal("pending"),
			Type.Literal("unknown"),
		]),
		observationDispositions: Type.Array(
			Type.Object(
				{
					effectObservationId: IdSchema,
					status: Type.Union([
						Type.Literal("relied-on"),
						Type.Literal("not-relied-on"),
					]),
					basis: BasisSchema,
				},
				{ additionalProperties: false },
			),
			{ maxItems: 32 },
		),
		intendedEffectDispositions: Type.Array(
			Type.Object(
				{
					intendedEffect: ShortTextSchema,
					status: Type.Union([
						Type.Literal("observed"),
						Type.Literal("not-observed"),
						Type.Literal("failed"),
						Type.Literal("partially-observed"),
						Type.Literal("unknown"),
					]),
					observationIds: Type.Array(IdSchema, { maxItems: 32 }),
					basis: BasisSchema,
				},
				{ additionalProperties: false },
			),
			{ minItems: 1, maxItems: 32 },
		),
		basis: BasisSchema,
		expectedCurrentAssessmentId: OptionalIdSchema,
	},
	{ additionalProperties: false },
);
const EffectSettledEventSchema = Type.Object(
	{
		...EventHeaderSchema,
		kind: Type.Literal("effect-settled"),
		effectId: IdSchema,
		proposal: EffectSettlementProposalSchema,
		expected: Type.Object(
			{ assessmentId: IdSchema, revisionId: IdSchema },
			{ additionalProperties: false },
		),
	},
	{ additionalProperties: false },
);
const EffectRemediatedEventSchema = Type.Object(
	{
		...EventHeaderSchema,
		kind: Type.Literal("effect-remediated"),
		adverseEffectId: IdSchema,
		remediationEffectId: IdSchema,
		basis: BasisSchema,
		expected: Type.Object(
			{ remediationId: IdSchema, revisionId: IdSchema },
			{ additionalProperties: false },
		),
	},
	{ additionalProperties: false },
);
const CompletionProposalSchema = Type.Object(
	{
		closureTargetId: IdSchema,
		mode: Type.Union([
			Type.Literal("completed"),
			Type.Literal("no-change"),
		]),
		obligationDispositions: Type.Array(
			Type.Object(
				{
					closureObligationId: IdSchema,
					conclusionIds: Type.Array(IdSchema, { maxItems: 32 }),
					effectAssessmentIds: Type.Array(IdSchema, { maxItems: 32 }),
					effectRemediationIds: Type.Array(IdSchema, { maxItems: 32 }),
					basis: BasisSchema,
				},
				{ additionalProperties: false },
			),
			{ minItems: 1, maxItems: 64 },
		),
		basis: BasisSchema,
	},
	{ additionalProperties: false },
);
const WorkCaseCompletedEventSchema = Type.Object(
	{
		...EventHeaderSchema,
		kind: Type.Literal("work-case-completed"),
		proposal: CompletionProposalSchema,
		expected: Type.Object(
			{
				workCaseId: IdSchema,
				revisionId: IdSchema,
				closureTargetId: IdSchema,
				closureClaimId: IdSchema,
			},
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
	ActionClearedEventSchema,
	EffectBegunEventSchema,
	EffectObservedEventSchema,
	EffectSettledEventSchema,
	EffectRemediatedEventSchema,
	WorkCaseCompletedEventSchema,
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
export type ActionLoopActionClearedEvent = Static<typeof ActionClearedEventSchema>;
export type ActionLoopEffectBegunEvent = Static<typeof EffectBegunEventSchema>;
export type ActionLoopEffectObservedEvent = Static<
	typeof EffectObservedEventSchema
>;
export type ActionLoopEffectSettledEvent = Static<typeof EffectSettledEventSchema>;
export type ActionLoopEffectRemediatedEvent = Static<
	typeof EffectRemediatedEventSchema
>;
export type ActionLoopWorkCaseCompletedEvent = Static<
	typeof WorkCaseCompletedEventSchema
>;
export type ActionLoopSessionEvent = Static<typeof SessionEventSchema>;

type JudgmentProposal = Static<typeof JudgmentProposalSchema>;
type CapabilityProposal = Static<typeof CapabilityApplicabilityProposalSchema>;
type ReferenceDisposition = Static<typeof ReferenceDispositionSchema>;
type ContributionProposal = Static<typeof SkillContributionProposalSchema>;
type CoverageProposal = Static<typeof NeedCoverageProposalSchema>;
type ClosureProposal = Static<typeof JudgmentClosureProposalSchema>;
type PiActionProposal = Static<typeof PiActionProposalSchema>;
type EffectObservationProposal = Static<
	typeof EffectObservationProposalSchema
>;
type EffectSettlementSessionProposal = Static<
	typeof EffectSettlementProposalSchema
>;
type CompletionProposal = Static<typeof CompletionProposalSchema>;

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

export function actionLoopActionClearedEvent(
	proposal: PiActionProposal,
	actionCandidateId: string,
	actionClearanceId: string,
	revisionId: string,
): ActionLoopActionClearedEvent {
	return Object.freeze({
		protocol: ACTION_LOOP_SESSION_PROTOCOL,
		kind: "action-cleared",
		transitionId: actionClearanceId,
		proposal,
		expected: { actionCandidateId, actionClearanceId, revisionId },
	});
}

export function actionLoopEffectBegunEvent(
	actionClearanceId: string,
	occurrenceId: string,
	effectId: string,
	revisionId: string,
): ActionLoopEffectBegunEvent {
	return Object.freeze({
		protocol: ACTION_LOOP_SESSION_PROTOCOL,
		kind: "effect-begun",
		transitionId: effectId,
		actionClearanceId,
		occurrenceId,
		expected: { effectId, revisionId },
	});
}

export function actionLoopEffectObservedEvent(
	observation: EffectObservation,
): ActionLoopEffectObservedEvent {
	const proposal: EffectObservationProposal = {
		effectId: observation.effectId,
		occurrenceId: observation.occurrenceId,
		evidence: {
			kind: "tool-result",
			locator: observation.evidence.locator,
			fingerprint: observation.evidence.fingerprint,
		},
		statement: observation.statement,
		limitations: [...observation.limitations],
		provenance: { ...observation.provenance },
	};
	return Object.freeze({
		protocol: ACTION_LOOP_SESSION_PROTOCOL,
		kind: "effect-observed",
		transitionId: observation.effectObservationId,
		proposal,
		expected: { effectObservationId: observation.effectObservationId },
	});
}

export function actionLoopEffectSettledEvent(
	effectId: string,
	proposal: EffectSettlementSessionProposal,
	assessmentId: string,
	revisionId: string,
): ActionLoopEffectSettledEvent {
	return Object.freeze({
		protocol: ACTION_LOOP_SESSION_PROTOCOL,
		kind: "effect-settled",
		transitionId: assessmentId,
		effectId,
		proposal,
		expected: { assessmentId, revisionId },
	});
}

export function actionLoopEffectRemediatedEvent(
	adverseEffectId: string,
	remediationEffectId: string,
	basis: string[],
	remediationId: string,
	revisionId: string,
): ActionLoopEffectRemediatedEvent {
	return Object.freeze({
		protocol: ACTION_LOOP_SESSION_PROTOCOL,
		kind: "effect-remediated",
		transitionId: remediationId,
		adverseEffectId,
		remediationEffectId,
		basis,
		expected: { remediationId, revisionId },
	});
}

export function actionLoopWorkCaseCompletedEvent(
	proposal: CompletionProposal,
	completed: CompletedWorkCase,
): ActionLoopWorkCaseCompletedEvent {
	return Object.freeze({
		protocol: ACTION_LOOP_SESSION_PROTOCOL,
		kind: "work-case-completed",
		transitionId: completed.closureClaim.closureClaimId,
		proposal,
		expected: {
			workCaseId: completed.workCaseId,
			revisionId: completed.revisionId,
			closureTargetId: completed.closureTarget.closureTargetId,
			closureClaimId: completed.closureClaim.closureClaimId,
		},
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

function replayActionClearance(
	state: LiveWorkCaseState,
	event: ActionLoopActionClearedEvent,
): AppliedEventResult {
	const accepted = acceptLivePiActionCandidate(state, event.proposal);
	if (
		accepted.status === "invalid" ||
		accepted.candidate.actionCandidateId !== event.expected.actionCandidateId
	) {
		return eventUnavailable(
			"Persisted Action Candidate does not reproduce its exact canonical identity.",
		);
	}
	const clearance = assessLiveActionClearance(
		accepted.state,
		accepted.candidate.actionCandidateId,
		{
			actionCandidateId: accepted.candidate.actionCandidateId,
			status: "granted",
			source: "pi:default-permission-policy",
			basis: [
				"The live adapter inherits Pi's default permission policy without adding a separate approval step.",
			],
		},
	);
	if (
		clearance.status !== "cleared" ||
		clearance.clearance.actionClearanceId !==
			event.expected.actionClearanceId ||
		clearance.state.workCase.revisionId !== event.expected.revisionId ||
		event.transitionId !== event.expected.actionClearanceId
	) {
		return eventUnavailable(
			"Persisted Action Clearance does not reproduce its exact canonical identity.",
		);
	}
	return applied(clearance.state);
}

function replayEffectBeginning(
	state: LiveWorkCaseState,
	event: ActionLoopEffectBegunEvent,
): AppliedEventResult {
	const clearance = state.workCase.actionClearances.find(
		(candidate) => candidate.actionClearanceId === event.actionClearanceId,
	);
	if (!clearance) {
		return eventUnavailable(
			"Persisted Effect beginning has no exact Action Clearance.",
		);
	}
	const begun = beginLiveActionEffect(state, clearance, event.occurrenceId);
	if (
		begun.status === "invalid" ||
		begun.effect.effectId !== event.expected.effectId ||
		begun.state.workCase.revisionId !== event.expected.revisionId ||
		event.transitionId !== event.expected.effectId
	) {
		return eventUnavailable(
			"Persisted Effect beginning does not reproduce its exact canonical identity.",
		);
	}
	return applied(begun.state);
}

function replayEffectObservation(
	state: LiveWorkCaseState,
	event: ActionLoopEffectObservedEvent,
): AppliedEventResult {
	const observed = acceptLiveEffectObservation(state, event.proposal);
	if (
		observed.status === "invalid" ||
		observed.observation.effectObservationId !==
			event.expected.effectObservationId ||
		event.transitionId !== event.expected.effectObservationId
	) {
		return eventUnavailable(
			"Persisted Effect Observation does not reproduce its exact canonical identity.",
		);
	}
	return applied(observed.state);
}

function replayEffectSettlement(
	state: LiveWorkCaseState,
	event: ActionLoopEffectSettledEvent,
): AppliedEventResult {
	const settled = settleLiveEffect(state, event.effectId, event.proposal);
	const assessmentId =
		settled.status === "invalid"
			? undefined
			: currentLiveEffectAssessmentId(settled.state, event.effectId);
	if (
		settled.status === "invalid" ||
		assessmentId !== event.expected.assessmentId ||
		settled.state.workCase.revisionId !== event.expected.revisionId ||
		event.transitionId !== event.expected.assessmentId
	) {
		return eventUnavailable(
			"Persisted Effect settlement does not reproduce its exact current assessment.",
		);
	}
	return applied(settled.state);
}

function replayEffectRemediation(
	state: LiveWorkCaseState,
	event: ActionLoopEffectRemediatedEvent,
): AppliedEventResult {
	const remediated = recordLiveEffectRemediation(
		state,
		event.adverseEffectId,
		event.remediationEffectId,
		event.basis,
	);
	if (
		remediated.status === "invalid" ||
		remediated.remediationId !== event.expected.remediationId ||
		remediated.state.workCase.revisionId !== event.expected.revisionId ||
		event.transitionId !== event.expected.remediationId
	) {
		return eventUnavailable(
			"Persisted Effect remediation does not reproduce its exact canonical identity.",
		);
	}
	return applied(remediated.state);
}

function replayWorkCaseCompletion(
	state: LiveWorkCaseState,
	event: ActionLoopWorkCaseCompletedEvent,
): AppliedEventResult {
	const completed = completeLiveWorkCase(state, event.proposal);
	if (
		completed.status !== "completed" ||
		completed.value.workCaseId !== event.expected.workCaseId ||
		completed.value.revisionId !== event.expected.revisionId ||
		completed.value.closureTarget.closureTargetId !==
			event.expected.closureTargetId ||
		completed.value.closureClaim.closureClaimId !==
			event.expected.closureClaimId ||
		event.transitionId !== event.expected.closureClaimId
	) {
		return eventUnavailable(
			"Persisted Work Case completion does not reproduce its exact revision-bound closure.",
		);
	}
	return {
		status: "applied",
		projection: { completedWorkCase: completed.value },
	};
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
		case "action-cleared":
			return replayActionClearance(state, event);
		case "effect-begun":
			return replayEffectBeginning(state, event);
		case "effect-observed":
			return replayEffectObservation(state, event);
		case "effect-settled":
			return replayEffectSettlement(state, event);
		case "effect-remediated":
			return replayEffectRemediation(state, event);
		case "work-case-completed":
			return replayWorkCaseCompletion(state, event);
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
