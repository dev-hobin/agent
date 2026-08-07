import { Type, type Static } from "typebox";
import { Check } from "typebox/value";

import type { EffectObservation } from "../src/action-loop/effect/effect-observation.ts";
import type { CompletedWorkCase } from "../src/action-loop/work/complete-work-case.ts";
import type { PauseWorkCaseProposal } from "../src/action-loop/work/pause-work-case.ts";
import type { ResumePausedWorkCaseProposal } from "../src/action-loop/work/resume-paused-work-case.ts";
import type { ResumeWaitingWorkCaseProposal } from "../src/action-loop/work/resume-waiting-work-case.ts";
import type { WaitWorkCaseProposal } from "../src/action-loop/work/wait-work-case.ts";
import type {
	LivePausedWorkCaseState,
	LiveWaitingWorkCaseState,
	LiveWorkCaseProposal,
	LiveWorkCaseState,
} from "./action-loop-work-case.ts";

export const ACTION_LOOP_SESSION_PROTOCOL =
	"developer-action-loop/session-event/v1";
export const ACTION_LOOP_SESSION_ENTRY = "developer.action-loop.session-event";
export const MAX_ACTION_LOOP_SESSION_EVENT_BYTES = 2_097_152;

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
const PauseWorkCaseProposalSchema = Type.Object(
	{
		workCaseId: IdSchema,
		expectedRevisionId: IdSchema,
		reason: ShortTextSchema,
		decision: Type.Object(
			{
				kind: Type.Literal("human"),
				decisionId: IdSchema,
				source: ShortTextSchema,
				basis: BasisSchema,
			},
			{ additionalProperties: false },
		),
	},
	{ additionalProperties: false },
);
const WorkCasePausedEventSchema = Type.Object(
	{
		...EventHeaderSchema,
		kind: Type.Literal("work-case-paused"),
		proposal: PauseWorkCaseProposalSchema,
		expected: Type.Object(
			{ workCasePauseId: IdSchema, revisionId: IdSchema },
			{ additionalProperties: false },
		),
	},
	{ additionalProperties: false },
);
const ResumePausedWorkCaseProposalSchema = Type.Object(
	{
		workCaseId: IdSchema,
		expectedRevisionId: IdSchema,
		decision: Type.Object(
			{
				kind: Type.Literal("human"),
				decisionId: IdSchema,
				source: ShortTextSchema,
				basis: BasisSchema,
			},
			{ additionalProperties: false },
		),
	},
	{ additionalProperties: false },
);
const PausedWorkCaseResumedEventSchema = Type.Object(
	{
		...EventHeaderSchema,
		kind: Type.Literal("paused-work-case-resumed"),
		proposal: ResumePausedWorkCaseProposalSchema,
		expected: Type.Object(
			{ workCaseResumeId: IdSchema, revisionId: IdSchema },
			{ additionalProperties: false },
		),
	},
	{ additionalProperties: false },
);
const ObservationKindSchema = Type.Union([
	Type.Literal("human"),
	Type.Literal("tool"),
	Type.Literal("external"),
]);
const WaitWorkCaseProposalSchema = Type.Object(
	{
		workCaseId: IdSchema,
		expectedRevisionId: IdSchema,
		externalCondition: ShortTextSchema,
		resumePredicate: ShortTextSchema,
		observation: Type.Object(
			{
				kind: ObservationKindSchema,
				observationId: IdSchema,
				source: ShortTextSchema,
				basis: BasisSchema,
			},
			{ additionalProperties: false },
		),
	},
	{ additionalProperties: false },
);
const WorkCaseWaitingEventSchema = Type.Object(
	{
		...EventHeaderSchema,
		kind: Type.Literal("work-case-waiting"),
		proposal: WaitWorkCaseProposalSchema,
		expected: Type.Object(
			{ workCaseWaitId: IdSchema, revisionId: IdSchema },
			{ additionalProperties: false },
		),
	},
	{ additionalProperties: false },
);
const ResumeWaitingWorkCaseProposalSchema = Type.Object(
	{
		workCaseId: IdSchema,
		expectedRevisionId: IdSchema,
		assessment: Type.Object(
			{
				resumePredicate: ShortTextSchema,
				status: Type.Literal("satisfied"),
				observationKind: ObservationKindSchema,
				observationId: IdSchema,
				source: ShortTextSchema,
				basis: BasisSchema,
			},
			{ additionalProperties: false },
		),
	},
	{ additionalProperties: false },
);
const WaitingWorkCaseResumedEventSchema = Type.Object(
	{
		...EventHeaderSchema,
		kind: Type.Literal("waiting-work-case-resumed"),
		proposal: ResumeWaitingWorkCaseProposalSchema,
		expected: Type.Object(
			{ workCaseWaitResumeId: IdSchema, revisionId: IdSchema },
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
		outcome: Type.Union([Type.Literal("conclude"), Type.Literal("refuse")]),
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
		mode: Type.Union([Type.Literal("completed"), Type.Literal("no-change")]),
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
	WorkCasePausedEventSchema,
	PausedWorkCaseResumedEventSchema,
	WorkCaseWaitingEventSchema,
	WaitingWorkCaseResumedEventSchema,
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
export type ActionLoopWorkCasePausedEvent = Static<
	typeof WorkCasePausedEventSchema
>;
export type ActionLoopPausedWorkCaseResumedEvent = Static<
	typeof PausedWorkCaseResumedEventSchema
>;
export type ActionLoopWorkCaseWaitingEvent = Static<
	typeof WorkCaseWaitingEventSchema
>;
export type ActionLoopWaitingWorkCaseResumedEvent = Static<
	typeof WaitingWorkCaseResumedEventSchema
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
export type ActionLoopActionClearedEvent = Static<
	typeof ActionClearedEventSchema
>;
export type ActionLoopEffectBegunEvent = Static<typeof EffectBegunEventSchema>;
export type ActionLoopEffectObservedEvent = Static<
	typeof EffectObservedEventSchema
>;
export type ActionLoopEffectSettledEvent = Static<
	typeof EffectSettledEventSchema
>;
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
type EffectObservationProposal = Static<typeof EffectObservationProposalSchema>;
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

export function actionLoopWorkCasePausedEvent(
	proposal: PauseWorkCaseProposal,
	state: LivePausedWorkCaseState,
): ActionLoopWorkCasePausedEvent {
	return Object.freeze({
		protocol: ACTION_LOOP_SESSION_PROTOCOL,
		kind: "work-case-paused",
		transitionId: state.workCase.pause.workCasePauseId,
		proposal: {
			workCaseId: proposal.workCaseId,
			expectedRevisionId: proposal.expectedRevisionId,
			reason: proposal.reason,
			decision: {
				kind: "human" as const,
				decisionId: proposal.decision.decisionId,
				source: proposal.decision.source,
				basis: [...proposal.decision.basis],
			},
		},
		expected: {
			workCasePauseId: state.workCase.pause.workCasePauseId,
			revisionId: state.workCase.revisionId,
		},
	});
}

export function actionLoopPausedWorkCaseResumedEvent(
	proposal: ResumePausedWorkCaseProposal,
	state: LiveWorkCaseState,
): ActionLoopPausedWorkCaseResumedEvent {
	const workCaseResumeId = state.workCase.continuityIds.at(-1);
	if (workCaseResumeId === undefined) {
		throw new Error("Resumed Work Case has no continuity transition ID");
	}
	return Object.freeze({
		protocol: ACTION_LOOP_SESSION_PROTOCOL,
		kind: "paused-work-case-resumed",
		transitionId: workCaseResumeId,
		proposal: {
			workCaseId: proposal.workCaseId,
			expectedRevisionId: proposal.expectedRevisionId,
			decision: {
				kind: "human" as const,
				decisionId: proposal.decision.decisionId,
				source: proposal.decision.source,
				basis: [...proposal.decision.basis],
			},
		},
		expected: {
			workCaseResumeId,
			revisionId: state.workCase.revisionId,
		},
	});
}

export function actionLoopWorkCaseWaitingEvent(
	proposal: WaitWorkCaseProposal & {
		readonly observation: WaitWorkCaseProposal["observation"] & {
			readonly kind: "human" | "tool" | "external";
		};
	},
	state: LiveWaitingWorkCaseState,
): ActionLoopWorkCaseWaitingEvent {
	return Object.freeze({
		protocol: ACTION_LOOP_SESSION_PROTOCOL,
		kind: "work-case-waiting",
		transitionId: state.workCase.wait.workCaseWaitId,
		proposal: {
			workCaseId: proposal.workCaseId,
			expectedRevisionId: proposal.expectedRevisionId,
			externalCondition: proposal.externalCondition,
			resumePredicate: proposal.resumePredicate,
			observation: {
				kind: proposal.observation.kind,
				observationId: proposal.observation.observationId,
				source: proposal.observation.source,
				basis: [...proposal.observation.basis],
			},
		},
		expected: {
			workCaseWaitId: state.workCase.wait.workCaseWaitId,
			revisionId: state.workCase.revisionId,
		},
	});
}

export function actionLoopWaitingWorkCaseResumedEvent(
	proposal: ResumeWaitingWorkCaseProposal & {
		readonly assessment: ResumeWaitingWorkCaseProposal["assessment"] & {
			readonly status: "satisfied";
			readonly observationKind: "human" | "tool" | "external";
		};
	},
	state: LiveWorkCaseState,
): ActionLoopWaitingWorkCaseResumedEvent {
	const workCaseWaitResumeId = state.workCase.continuityIds.at(-1);
	if (workCaseWaitResumeId === undefined) {
		throw new Error("Resumed waiting Work Case has no continuity transition ID");
	}
	return Object.freeze({
		protocol: ACTION_LOOP_SESSION_PROTOCOL,
		kind: "waiting-work-case-resumed",
		transitionId: workCaseWaitResumeId,
		proposal: {
			workCaseId: proposal.workCaseId,
			expectedRevisionId: proposal.expectedRevisionId,
			assessment: {
				resumePredicate: proposal.assessment.resumePredicate,
				status: "satisfied" as const,
				observationKind: proposal.assessment.observationKind,
				observationId: proposal.assessment.observationId,
				source: proposal.assessment.source,
				basis: [...proposal.assessment.basis],
			},
		},
		expected: {
			workCaseWaitResumeId,
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

export function actionLoopEffectRemediatedEvent(input: {
	readonly adverseEffectId: string;
	readonly remediationEffectId: string;
	readonly basis: string[];
	readonly remediationId: string;
	readonly revisionId: string;
}): ActionLoopEffectRemediatedEvent {
	return Object.freeze({
		protocol: ACTION_LOOP_SESSION_PROTOCOL,
		kind: "effect-remediated",
		transitionId: input.remediationId,
		adverseEffectId: input.adverseEffectId,
		remediationEffectId: input.remediationEffectId,
		basis: input.basis,
		expected: {
			remediationId: input.remediationId,
			revisionId: input.revisionId,
		},
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

function claimedReplayEvent(entry: ActionLoopSessionBranchEntry): {
	readonly claimed: boolean;
	readonly value?: unknown;
} {
	if (entry.customType === ACTION_LOOP_SESSION_ENTRY) {
		return { claimed: true, value: entry.data };
	}
	const details = entry.message?.details;
	if (isRecord(details) && Object.hasOwn(details, "replayEvent")) {
		return { claimed: true, value: details.replayEvent };
	}
	return { claimed: false };
}

function sessionEventByteLength(value: unknown): number | undefined {
	try {
		const serialized = JSON.stringify(value);
		return serialized === undefined
			? undefined
			: new TextEncoder().encode(serialized).byteLength;
	} catch {
		return undefined;
	}
}

export function extractReplayEvent(
	entry: ActionLoopSessionBranchEntry,
): ExtractedEvent {
	const candidate = claimedReplayEvent(entry);
	if (!candidate.claimed) return { status: "absent" };
	const byteLength = sessionEventByteLength(candidate.value);
	if (
		byteLength === undefined ||
		byteLength > MAX_ACTION_LOOP_SESSION_EVENT_BYTES ||
		!Check(SessionEventSchema, candidate.value)
	) {
		return { status: "invalid" };
	}
	return { status: "event", event: candidate.value };
}
