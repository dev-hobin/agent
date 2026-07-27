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
const wrapRequestId = stableId("wrap-request");
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

export const wrapScopeActionSchema = Type.Object(
	{
		observer_action: Type.Literal("observer-sidecar/v1"),
		action: Type.Literal("wrap-scope"),
		request_id: wrapRequestId,
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

export const wrapPrepareActionSchema = Type.Object(
	{
		observer_action: Type.Literal("observer-sidecar/v1"),
		action: Type.Literal("wrap-prepare"),
		request_id: wrapRequestId,
		summary: Type.String(),
		records: Type.Array(preparedRecordSchema),
	},
	{ additionalProperties: false },
);

export const memoPrepareActionSchema = Type.Object(
	{
		observer_action: Type.Literal("observer-sidecar/v1"),
		action: Type.Literal("memo-prepare"),
		request_id: memoRequestId,
		submission: Type.Object(
			{
				evidence: Type.Array(memoEvidenceItemSchema),
				hypothesis_outcomes: Type.Array(hypothesisOutcomeSchema),
				memo_outcomes: Type.Array(memoOutcomeSchema),
				dispositions: Type.Array(observationDispositionSchema),
			},
			{ additionalProperties: false },
		),
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

export const observerSidecarParameters = Type.Union([
	Type.Object(
		{
			observer_action: Type.Literal("observer-sidecar/v1"),
			action: Type.Literal("source-read"),
			candidate_ids: Type.Array(Type.String()),
			source: sourceSchema,
			faithful_summary: Type.String(),
			claims: Type.Array(claimSchema),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			observer_action: Type.Literal("observer-sidecar/v1"),
			action: Type.Literal("hydrate"),
			read_id: Type.String(),
			index_digest: Type.String(),
			inquiry_ids: Type.Array(Type.String()),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			observer_action: Type.Literal("observer-sidecar/v1"),
			action: Type.Literal("record"),
			read_id: Type.String(),
			hydration_id: nullableString,
			related_inquiry_ids: Type.Array(Type.String()),
			stance: Type.Union([
				Type.Literal("supports"),
				Type.Literal("challenges"),
				Type.Literal("refines"),
				Type.Literal("boundary"),
				Type.Literal("uncertain"),
			]),
			movement: Type.Union([
				Type.Literal("repeated-support"),
				Type.Literal("minor-refinement"),
				Type.Literal("uncertain-association"),
				Type.Literal("material-boundary-change"),
				Type.Literal("core-counterexample"),
				Type.Literal("independent-new-hypothesis"),
				Type.Literal("major-direction-change"),
				Type.Literal("missed-important-mismatch"),
			]),
			rationale: Type.String(),
			observer_hypothesis: nullableString,
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			observer_action: Type.Literal("observer-sidecar/v1"),
			action: Type.Literal("user-hypothesis"),
			candidate_id: Type.String(),
			existing_inquiry_id: nullableString,
			original: Type.String(),
			context: Type.String(),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			observer_action: Type.Literal("observer-sidecar/v1"),
			action: Type.Literal("memo-scope"),
			request_id: Type.String(),
		},
		{ additionalProperties: false },
	),
	memoPrepareActionSchema,
	wrapScopeActionSchema,
	wrapPrepareActionSchema,
]);
