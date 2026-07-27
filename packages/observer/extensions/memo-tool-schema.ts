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
