import { Type, type Static, type TProperties } from "typebox";
import { Errors, Parse } from "typebox/value";

import { ContextSelectionProposalDataSchema } from "../src/context.ts";
import { ContextCoverageProposalDataSchema } from "../src/coverage.ts";
import { JudgmentTransitionError } from "../src/errors.ts";
import {
	CONTEXT_JUDGMENT_EVENT_PROTOCOL,
	ContextApplicabilityDataSchema,
} from "../src/lifecycle.ts";
import { JudgmentProposalDataSchema } from "../src/outcome.ts";
import { DynamicJudgmentQuestionDataSchema } from "../src/question.ts";
import { IdentifierSchema, Sha256Schema } from "../src/schema.ts";

export const JUDGMENT_SESSION_PROTOCOL: "judgment-session/v1" =
	"judgment-session/v1";
function exactObject<const T extends TProperties>(properties: T) {
	return Type.Object(properties, { additionalProperties: false });
}
const Base = {
	protocol: Type.Literal(CONTEXT_JUDGMENT_EVENT_PROTOCOL),
	judgmentId: IdentifierSchema,
};
const AttemptOpened = exactObject({
	...Base,
	kind: Type.Literal("attempt-opened"),
	policyPath: Type.Optional(Type.String({ minLength: 1, maxLength: 2_000 })),
	question: DynamicJudgmentQuestionDataSchema,
	questionSha256: Sha256Schema,
});
const ApplicabilityRecorded = exactObject({
	...Base,
	kind: Type.Literal("applicability-recorded"),
	applicability: ContextApplicabilityDataSchema,
});
export const ObservedContextNominationDataSchema = Type.Union([
	exactObject({
		kind: Type.Literal("tool-result"),
		toolCallId: Type.String({ minLength: 1, maxLength: 300 }),
		inventorySourceId: Type.Optional(IdentifierSchema),
	}),
	exactObject({
		kind: Type.Literal("user-decision"),
		userEventId: Type.String({ minLength: 1, maxLength: 300 }),
	}),
]);
export type ObservedContextNominationData = Static<
	typeof ObservedContextNominationDataSchema
>;
const SelectionRecorded = exactObject({
	...Base,
	kind: Type.Literal("selection-recorded"),
	proposal: ContextSelectionProposalDataSchema,
	observedNominations: Type.Array(ObservedContextNominationDataSchema, {
		maxItems: 256,
	}),
	selectionSha256: Sha256Schema,
});
const SealedRecorded = exactObject({
	...Base,
	kind: Type.Literal("sealed-context-recorded"),
	selectionSha256: Sha256Schema,
	sealedContextSha256: Sha256Schema,
});
const CoverageRecorded = exactObject({
	...Base,
	kind: Type.Literal("coverage-recorded"),
	proposal: ContextCoverageProposalDataSchema,
	coverageSha256: Sha256Schema,
});
const OutcomeRecorded = exactObject({
	...Base,
	kind: Type.Literal("outcome-recorded"),
	proposal: JudgmentProposalDataSchema,
	outcomeSha256: Sha256Schema,
});
export const ContextSessionEventDataSchema = Type.Union([
	AttemptOpened,
	ApplicabilityRecorded,
	SelectionRecorded,
	SealedRecorded,
	CoverageRecorded,
	OutcomeRecorded,
]);
export type ContextSessionEventData = Static<
	typeof ContextSessionEventDataSchema
>;
export const JudgmentSessionRecordDataSchema = exactObject({
	protocol: Type.Literal(JUDGMENT_SESSION_PROTOCOL),
	event: ContextSessionEventDataSchema,
});
export type JudgmentSessionRecordData = Static<
	typeof JudgmentSessionRecordDataSchema
>;
function issues(value: unknown) {
	return [...Errors(JudgmentSessionRecordDataSchema, value)].map((issue) => ({
		path: issue.instancePath || "/",
		message: issue.message,
		keyword: issue.keyword,
	}));
}
export function decodeJudgmentSessionRecordData(
	value: unknown,
): JudgmentSessionRecordData {
	try {
		return Parse(JudgmentSessionRecordDataSchema, value);
	} catch (error) {
		throw new JudgmentTransitionError(
			"Stored judgment-session/v1 record has an invalid representation.",
			{ issues: issues(value) },
			{ cause: error },
		);
	}
}
export function judgmentSessionRecord(
	event: ContextSessionEventData,
): JudgmentSessionRecordData {
	return Object.freeze({ protocol: JUDGMENT_SESSION_PROTOCOL, event });
}
export function unsupportedJudgmentHistory(kind: string): never {
	throw new JudgmentTransitionError(
		`Unsupported Judgment history ${kind}; restart this judgment under ${JUDGMENT_SESSION_PROTOCOL}.`,
		{ kind, reroute: "restart-judgment" },
	);
}
export const SESSION_EVENT_SUMMARY_LIMIT = 4_000;
export function summarizeSessionEvent(event: ContextSessionEventData): string {
	const summary = `${event.kind} for ${event.judgmentId}`;
	if (summary.length > SESSION_EVENT_SUMMARY_LIMIT)
		throw new JudgmentTransitionError(
			"Judgment session event summary exceeds its output bound.",
		);
	return summary;
}
export const EMPTY_SELECTION_BASIS: readonly string[] = Object.freeze([
	"No context material was applicable to this dynamic question.",
]);
export function normalizeSelectionBasis(
	basis: readonly string[],
): readonly string[] {
	if (basis.length === 0) return EMPTY_SELECTION_BASIS;
	return Object.freeze(
		basis.map((entry, index) => {
			const normalized = entry.trim();
			if (!normalized)
				throw new JudgmentTransitionError(
					`Selection basis ${index} must be non-blank.`,
				);
			if (normalized.length > 2_000)
				throw new JudgmentTransitionError(
					`Selection basis ${index} exceeds its output bound.`,
				);
			return normalized;
		}),
	);
}
