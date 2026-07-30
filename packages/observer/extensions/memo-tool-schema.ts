import { Type } from "typebox";

const UUID_V4 =
	"[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
function stableId(prefix: string) {
	return Type.String({ pattern: `^${prefix}-${UUID_V4}$` });
}

const nullableString = Type.Union([Type.Null(), Type.String()]);
const nullableSourceId = Type.Union([Type.Null(), stableId("source")]);
const nullableInquiryId = Type.Union([Type.Null(), stableId("inquiry")]);
const evidenceId = stableId("evidence");
const inquiryId = stableId("inquiry");
const memoId = stableId("memo");
const memoRequestId = stableId("memo-request");
const saveRequestId = stableId("save-request");
const materialReviewRequestId = stableId("material-review");
const memoRevisionId = stableId("memo-revision");

export const memoEvidenceItemSchema = Type.Object(
	{
		evidence_id: evidenceId,
		kind: Type.Union([
			Type.Literal("source-claim"),
			Type.Literal("direct-observation"),
			Type.Literal("counterexample"),
		]),
		source_id: nullableSourceId,
		summary: Type.String(),
	},
	{ additionalProperties: false },
);

const workingHypothesisDraftSchema = Type.Object(
	{
		inquiry_id: inquiryId,
		episode_id: Type.String(),
		origin: Type.Union([Type.Literal("user"), Type.Literal("observer")]),
		original: Type.String(),
		current: Type.String(),
		revision_reason: nullableString,
		evidence_ids: Type.Array(evidenceId),
	},
	{ additionalProperties: false },
);

const workingMemoDraftSchema = Type.Object(
	{
		memo_id: memoId,
		episode_id: Type.String(),
		title: Type.String(),
		lang: Type.Union([Type.Literal("ko"), Type.Literal("en")]),
		content: Type.String(),
		inquiry_ids: Type.Array(inquiryId),
		hypothesis_id: nullableInquiryId,
		evidence_ids: Type.Array(evidenceId),
		reason: Type.String(),
	},
	{ additionalProperties: false },
);

const memoRevisionDraftSchema = Type.Object(
	{
		revision_id: memoRevisionId,
		title: Type.String(),
		content: Type.String(),
		evidence_ids: Type.Array(evidenceId),
		reason: Type.String(),
	},
	{ additionalProperties: false },
);

export const hypothesisOutcomeSchema = Type.Union([
	Type.Object(
		{ kind: Type.Literal("keep"), inquiry_id: inquiryId },
		{ additionalProperties: false },
	),
	Type.Object(
		{
			kind: Type.Literal("create"),
			hypothesis: workingHypothesisDraftSchema,
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			kind: Type.Literal("revise"),
			inquiry_id: inquiryId,
			current: Type.String(),
			revision_reason: Type.String(),
			evidence_ids: Type.Array(evidenceId),
		},
		{ additionalProperties: false },
	),
]);

export const memoOutcomeSchema = Type.Union([
	Type.Object(
		{ kind: Type.Literal("keep-incubating"), memo_id: memoId },
		{ additionalProperties: false },
	),
	Type.Object(
		{
			kind: Type.Literal("revise-incubating"),
			memo_id: memoId,
			revision: memoRevisionDraftSchema,
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			kind: Type.Literal("revise-promotion-candidate"),
			memo_id: memoId,
			revision: memoRevisionDraftSchema,
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			kind: Type.Literal("mark-promotion-candidate"),
			memo_id: memoId,
			reason: Type.String(),
			evidence_ids: Type.Array(evidenceId),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			kind: Type.Literal("merge"),
			source_ids: Type.Array(memoId, { minItems: 2 }),
			target: workingMemoDraftSchema,
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{ kind: Type.Literal("create"), memo: workingMemoDraftSchema },
		{ additionalProperties: false },
	),
]);

const observationDispositionSchema = Type.Object(
	{
		observation_id: stableId("observation"),
		decision: Type.Union([Type.Literal("integrated"), Type.Literal("kept")]),
		hypothesis_inquiry_ids: Type.Array(inquiryId),
		memo_ids: Type.Array(memoId),
		evidence_ids: Type.Array(evidenceId),
		rationale: Type.String(),
	},
	{ additionalProperties: false },
);

export const saveScopeActionSchema = Type.Object(
	{
		observer_action: Type.Literal("observer-sidecar/v1"),
		action: Type.Literal("save-scope"),
		request_id: saveRequestId,
	},
	{ additionalProperties: false },
);

const preparedRecordSchema = Type.Union([
	Type.Object(
		{
			operation: Type.Literal("create"),
			record_id: Type.String(),
			markdown: Type.String(),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			operation: Type.Literal("update"),
			record_id: Type.String(),
			expected_sha256: Type.String({ pattern: "^[0-9a-f]{64}$" }),
			markdown: Type.String(),
		},
		{ additionalProperties: false },
	),
]);

export const savePrepareActionSchema = Type.Object(
	{
		observer_action: Type.Literal("observer-sidecar/v1"),
		action: Type.Literal("save-prepare"),
		request_id: saveRequestId,
		summary: Type.String(),
		records: Type.Array(preparedRecordSchema),
	},
	{ additionalProperties: false },
);

export const memoSubmissionSchema = Type.Object(
	{
		evidence: Type.Array(memoEvidenceItemSchema),
		hypothesis_outcomes: Type.Array(hypothesisOutcomeSchema),
		memo_outcomes: Type.Array(memoOutcomeSchema),
		dispositions: Type.Array(observationDispositionSchema),
	},
	{ additionalProperties: false },
);

export const memoPrepareActionSchema = Type.Object(
	{
		observer_action: Type.Literal("observer-sidecar/v1"),
		action: Type.Literal("memo-prepare"),
		request_id: memoRequestId,
		submission: memoSubmissionSchema,
	},
	{ additionalProperties: false },
);

const sourceSchema = Type.Union([
	Type.Object(
		{
			kind: Type.Literal("external-material"),
			title: Type.String(),
			lang: Type.String(),
			uri: nullableString,
			revision: nullableString,
			content_hash: nullableString,
			retrieval_context: nullableString,
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			kind: Type.Literal("direct-observation"),
			title: Type.String(),
			lang: Type.String(),
			observed_at: Type.String(),
			observed_by: Type.String(),
			fact: Type.String(),
			conditions: Type.String(),
			interpretation_boundary: Type.String(),
		},
		{ additionalProperties: false },
	),
]);

const claimSchema = Type.Object(
	{ text: Type.String(), locator: nullableString },
	{ additionalProperties: false },
);

export const materialReviewStartActionSchema = Type.Object(
	{
		observer_action: Type.Literal("observer-sidecar/v1"),
		action: Type.Literal("material-review-start"),
		user_message_digest: Type.String({ pattern: "^[0-9a-f]{64}$" }),
		material: Type.Union([
			Type.Object(
				{ kind: Type.Literal("inline-user-message") },
				{ additionalProperties: false },
			),
			Type.Object(
				{ kind: Type.Literal("retrieved-tool-results") },
				{ additionalProperties: false },
			),
		]),
	},
	{ additionalProperties: false },
);

export const materialReviewFinishActionSchema = Type.Object(
	{
		observer_action: Type.Literal("observer-sidecar/v1"),
		action: Type.Literal("material-review-finish"),
		request_id: materialReviewRequestId,
	},
	{ additionalProperties: false },
);

export const hypothesisContextReviewActionSchema = Type.Object(
	{
		observer_action: Type.Literal("observer-sidecar/v1"),
		action: Type.Literal("hypothesis-context-review"),
		hypothesis_observation_id: stableId("observation"),
		assessment: Type.Union([
			Type.Literal("supports"),
			Type.Literal("challenges"),
			Type.Literal("mixed"),
			Type.Literal("insufficient-context"),
		]),
		supporting_clues: Type.Array(Type.String()),
		challenging_clues: Type.Array(Type.String()),
		missing_information: Type.Array(Type.String()),
		source_ids: Type.Array(stableId("source")),
		interpretation_boundary: Type.String(),
	},
	{ additionalProperties: false },
);

export const nominateToolResultsActionSchema = Type.Object(
	{
		observer_action: Type.Literal("observer-sidecar/v1"),
		action: Type.Literal("nominate-tool-results"),
		selections: Type.Array(
			Type.Object(
				{
					tool_call_id: Type.String({ minLength: 1, maxLength: 300 }),
					reason: Type.String({ minLength: 1, maxLength: 4_000 }),
				},
				{ additionalProperties: false },
			),
			{ minItems: 1, maxItems: 12 },
		),
	},
	{ additionalProperties: false },
);

export const sourceReadActionSchema = Type.Object(
	{
		observer_action: Type.Literal("observer-sidecar/v1"),
		action: Type.Literal("source-read"),
		candidate_ids: Type.Array(Type.String()),
		source: sourceSchema,
		faithful_summary: Type.String(),
		claims: Type.Array(claimSchema),
	},
	{ additionalProperties: false },
);

export const hydrateActionSchema = Type.Object(
	{
		observer_action: Type.Literal("observer-sidecar/v1"),
		action: Type.Literal("hydrate"),
		read_id: Type.String(),
		index_digest: Type.String(),
		inquiry_ids: Type.Array(Type.String()),
	},
	{ additionalProperties: false },
);

const observationStanceSchema = Type.Union([
	Type.Literal("supports"),
	Type.Literal("challenges"),
	Type.Literal("refines"),
	Type.Literal("boundary"),
	Type.Literal("uncertain"),
]);

export const recordObservationActionSchema = Type.Object(
	{
		observer_action: Type.Literal("observer-sidecar/v1"),
		action: Type.Literal("record"),
		read_id: Type.String(),
		hydration_id: nullableString,
		related_inquiry_ids: Type.Array(Type.String()),
		stance: observationStanceSchema,
		movement: Type.Union([
			Type.Literal("repeated-support"),
			Type.Literal("minor-refinement"),
			Type.Literal("uncertain-association"),
			Type.Literal("material-boundary-change"),
			Type.Literal("core-counterexample"),
			Type.Literal("major-direction-change"),
			Type.Literal("missed-important-mismatch"),
		]),
		rationale: Type.String(),
		observer_hypothesis: Type.Null({
			description:
				"Must be null for record. Use record-new-hypothesis for an independent Observer hypothesis.",
		}),
	},
	{ additionalProperties: false },
);

export const recordNewHypothesisActionSchema = Type.Object(
	{
		observer_action: Type.Literal("observer-sidecar/v1"),
		action: Type.Literal("record-new-hypothesis"),
		read_id: Type.String(),
		hydration_id: nullableString,
		related_inquiry_ids: Type.Array(Type.String()),
		stance: observationStanceSchema,
		rationale: Type.String(),
		observer_hypothesis: Type.String({ minLength: 1, maxLength: 20_000 }),
	},
	{ additionalProperties: false },
);

export const userHypothesisActionSchema = Type.Object(
	{
		observer_action: Type.Literal("observer-sidecar/v1"),
		action: Type.Literal("user-hypothesis"),
		candidate_id: Type.String(),
		existing_inquiry_id: nullableString,
		original: Type.String(),
		context: Type.String(),
	},
	{ additionalProperties: false },
);

const memoScopeActionSchema = Type.Object(
	{
		observer_action: Type.Literal("observer-sidecar/v1"),
		action: Type.Literal("memo-scope"),
		request_id: Type.String(),
	},
	{ additionalProperties: false },
);

const piggybackNominationSchema = Type.Object(
	{
		tool_call_id: Type.String({ minLength: 1, maxLength: 300 }),
		reason: Type.String({ minLength: 1, maxLength: 4_000 }),
	},
	{ additionalProperties: false },
);

const piggybackObservationSchema = Type.Object(
	{
		candidate_ids: Type.Array(Type.String(), { maxItems: 16 }),
		nominations: Type.Array(piggybackNominationSchema, { maxItems: 8 }),
		source: sourceSchema,
		faithful_summary: Type.String(),
		claims: Type.Array(claimSchema),
		related_inquiry_ids: Type.Array(Type.String(), { maxItems: 8 }),
		stance: observationStanceSchema,
		record: Type.Union([
			Type.Object(
				{
					kind: Type.Literal("observation"),
					movement: Type.Union([
						Type.Literal("repeated-support"),
						Type.Literal("minor-refinement"),
						Type.Literal("uncertain-association"),
						Type.Literal("material-boundary-change"),
						Type.Literal("core-counterexample"),
						Type.Literal("major-direction-change"),
						Type.Literal("missed-important-mismatch"),
					]),
					rationale: Type.String(),
				},
				{ additionalProperties: false },
			),
			Type.Object(
				{
					kind: Type.Literal("new-hypothesis"),
					rationale: Type.String(),
					observer_hypothesis: Type.String({
						minLength: 1,
						maxLength: 20_000,
					}),
				},
				{ additionalProperties: false },
			),
		]),
	},
	{ additionalProperties: false },
);

const piggybackHypothesisReviewSchema = Type.Object(
	{
		hypothesis_observation_id: stableId("observation"),
		assessment: Type.Union([
			Type.Literal("supports"),
			Type.Literal("challenges"),
			Type.Literal("mixed"),
			Type.Literal("insufficient-context"),
		]),
		supporting_clues: Type.Array(Type.String()),
		challenging_clues: Type.Array(Type.String()),
		missing_information: Type.Array(Type.String()),
		source_ids: Type.Array(stableId("source")),
		interpretation_boundary: Type.String(),
	},
	{ additionalProperties: false },
);

export const observerCommitActionSchema = Type.Object(
	{
		observer_action: Type.Literal("observer-sidecar/v1"),
		action: Type.Literal("observer-commit"),
		episode_id: Type.String({ minLength: 1, maxLength: 300 }),
		observations: Type.Array(piggybackObservationSchema, { maxItems: 4 }),
		hypothesis_context_reviews: Type.Array(piggybackHypothesisReviewSchema, {
			maxItems: 8,
		}),
		memo: Type.Union([
			Type.Null(),
			Type.Object(
				{
					request_id: memoRequestId,
					submission: memoSubmissionSchema,
				},
				{ additionalProperties: false },
			),
		]),
		save: Type.Union([
			Type.Null(),
			Type.Object(
				{
					request_id: saveRequestId,
					summary: Type.String(),
					records: Type.Array(preparedRecordSchema),
				},
				{ additionalProperties: false },
			),
		]),
	},
	{ additionalProperties: false },
);

export const observerMaterialSidecarParameters = Type.Union([
	materialReviewStartActionSchema,
	materialReviewFinishActionSchema,
	sourceReadActionSchema,
	hydrateActionSchema,
	recordObservationActionSchema,
	recordNewHypothesisActionSchema,
]);

export const observerRoutineSidecarParameters = Type.Union([
	nominateToolResultsActionSchema,
	sourceReadActionSchema,
	hydrateActionSchema,
	recordObservationActionSchema,
	recordNewHypothesisActionSchema,
	userHypothesisActionSchema,
	hypothesisContextReviewActionSchema,
]);

export const observerRequestSidecarParameters = Type.Union([
	hypothesisContextReviewActionSchema,
	memoScopeActionSchema,
	memoPrepareActionSchema,
	saveScopeActionSchema,
	savePrepareActionSchema,
]);

export const observerSidecarParameters = Type.Union([
	materialReviewStartActionSchema,
	materialReviewFinishActionSchema,
	nominateToolResultsActionSchema,
	sourceReadActionSchema,
	hydrateActionSchema,
	recordObservationActionSchema,
	recordNewHypothesisActionSchema,
	userHypothesisActionSchema,
	hypothesisContextReviewActionSchema,
	memoScopeActionSchema,
	memoPrepareActionSchema,
	saveScopeActionSchema,
	savePrepareActionSchema,
	observerCommitActionSchema,
]);

/**
 * Pi validates this permissive envelope before execute. Domain decoding remains
 * strict inside the tool so malformed model output can terminate quietly
 * instead of triggering a paid repair turn.
 */
export const observerRuntimeSidecarParameters = Type.Union([
	observerSidecarParameters,
	Type.Record(Type.String(), Type.Unknown()),
]);
