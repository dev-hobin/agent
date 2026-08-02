import { Type, type Static, type TProperties } from "typebox";
import { Errors, Parse } from "typebox/value";

import type { ContextSelection } from "./context.ts";
import type { ContextCoverage } from "./coverage.ts";
import { JudgmentParseError, JudgmentTransitionError } from "./errors.ts";
import { canonicalJson, type JsonValue } from "./json.ts";
import type { JudgmentOutcome } from "./outcome.ts";
import type { DynamicJudgmentQuestion } from "./question.ts";
import { NonEmptyTextSchema } from "./schema.ts";
import type { SealedContext } from "./sealed-context.ts";

export const CONTEXT_JUDGMENT_EVENT_PROTOCOL: "judgment-event/v1" =
	"judgment-event/v1";
function exactObject<const T extends TProperties>(properties: T) {
	return Type.Object(properties, { additionalProperties: false });
}
const Basis = Type.Array(NonEmptyTextSchema, {
	minItems: 1,
	maxItems: 32,
	uniqueItems: true,
});
export const ContextApplicabilityDataSchema = Type.Union([
	exactObject({ kind: Type.Literal("applicable"), basis: Basis }),
	exactObject({
		kind: Type.Literal("not-applicable"),
		reason: NonEmptyTextSchema,
		evidence: Basis,
	}),
	exactObject({ kind: Type.Literal("needs-context"), missingContext: Basis }),
]);
export type ContextApplicabilityData = Static<
	typeof ContextApplicabilityDataSchema
>;
export type ContextApplicability =
	| { readonly kind: "applicable"; readonly basis: readonly string[] }
	| {
			readonly kind: "not-applicable";
			readonly reason: string;
			readonly evidence: readonly string[];
	  }
	| {
			readonly kind: "needs-context";
			readonly missingContext: readonly string[];
	  };

interface EventBase {
	readonly protocol: typeof CONTEXT_JUDGMENT_EVENT_PROTOCOL;
	readonly judgmentId: string;
}
export type ContextJudgmentEvent =
	| (EventBase & {
			readonly kind: "applicability-recorded";
			readonly applicability: ContextApplicability;
	  })
	| (EventBase & {
			readonly kind: "selection-recorded";
			readonly revision: number;
			readonly selection: ContextSelection;
	  })
	| (EventBase & {
			readonly kind: "sealed-context-recorded";
			readonly revision: number;
			readonly sealedContext: SealedContext;
	  })
	| (EventBase & {
			readonly kind: "coverage-recorded";
			readonly coverage: ContextCoverage;
	  })
	| (EventBase & {
			readonly kind: "outcome-recorded";
			readonly outcome: JudgmentOutcome;
	  });
export type ContextJudgmentStatus =
	| "started"
	| "selection-open"
	| "selected"
	| "sealed"
	| "covered"
	| "terminal-not-applicable"
	| "terminal-needs-context"
	| "terminal-outcome";
export interface ContextJudgmentState {
	readonly question: DynamicJudgmentQuestion;
	readonly status: ContextJudgmentStatus;
	readonly applicability?: ContextApplicability;
	readonly revision: number;
	readonly selection?: ContextSelection;
	readonly sealedContext?: SealedContext;
	readonly coverage?: ContextCoverage;
	readonly outcome?: JudgmentOutcome;
}
function issues(value: JsonValue) {
	return [...Errors(ContextApplicabilityDataSchema, value)].map((issue) => ({
		path: issue.instancePath || "/",
		message: issue.message,
		keyword: issue.keyword,
	}));
}
export function decodeContextApplicabilityData(
	value: JsonValue,
): ContextApplicabilityData {
	try {
		return Parse(ContextApplicabilityDataSchema, value);
	} catch (error) {
		throw new JudgmentParseError(
			"Context applicability has an invalid representation.",
			{ issues: issues(value) },
			{ cause: error },
		);
	}
}
function text(value: string, path: string): string {
	if (value !== value.trim() || !value.trim())
		throw new JudgmentParseError(
			`Expected directly normalized non-blank text at ${path}.`,
		);
	return value.replace(/\s+/gu, " ");
}
function unique(values: readonly string[], path: string): readonly string[] {
	const normalized = values.map((value, index) =>
		text(value, `${path}/${index}`),
	);
	const seen = new Set<string>();
	for (const value of normalized) {
		if (seen.has(value))
			throw new JudgmentParseError(`Duplicate value at ${path}: ${value}.`);
		seen.add(value);
	}
	return Object.freeze(
		normalized.toSorted((left, right) => left.localeCompare(right)),
	);
}
export function parseContextApplicability(
	data: ContextApplicabilityData,
): ContextApplicability {
	switch (data.kind) {
		case "applicable":
			return Object.freeze({
				kind: data.kind,
				basis: unique(data.basis, "/basis"),
			});
		case "not-applicable":
			return Object.freeze({
				kind: data.kind,
				reason: text(data.reason, "/reason"),
				evidence: unique(data.evidence, "/evidence"),
			});
		case "needs-context":
			return Object.freeze({
				kind: data.kind,
				missingContext: unique(data.missingContext, "/missingContext"),
			});
		default:
			return assertNever(data);
	}
}
export function startJudgment(
	question: DynamicJudgmentQuestion,
): ContextJudgmentState {
	return Object.freeze({ question, status: "started", revision: 0 });
}
export function applicabilityRecorded(input: {
	readonly state: ContextJudgmentState;
	readonly applicability: ContextApplicability;
}): ContextJudgmentEvent {
	return Object.freeze({
		protocol: CONTEXT_JUDGMENT_EVENT_PROTOCOL,
		judgmentId: input.state.question.judgmentId,
		kind: "applicability-recorded",
		applicability: input.applicability,
	});
}
export function selectionRecorded(input: {
	readonly state: ContextJudgmentState;
	readonly selection: ContextSelection;
}): ContextJudgmentEvent {
	return Object.freeze({
		protocol: CONTEXT_JUDGMENT_EVENT_PROTOCOL,
		judgmentId: input.state.question.judgmentId,
		kind: "selection-recorded",
		revision: input.state.revision + 1,
		selection: input.selection,
	});
}
export function sealedContextRecorded(input: {
	readonly state: ContextJudgmentState;
	readonly sealedContext: SealedContext;
}): ContextJudgmentEvent {
	return Object.freeze({
		protocol: CONTEXT_JUDGMENT_EVENT_PROTOCOL,
		judgmentId: input.state.question.judgmentId,
		kind: "sealed-context-recorded",
		revision: input.state.revision,
		sealedContext: input.sealedContext,
	});
}
export function coverageRecorded(input: {
	readonly state: ContextJudgmentState;
	readonly coverage: ContextCoverage;
}): ContextJudgmentEvent {
	return Object.freeze({
		protocol: CONTEXT_JUDGMENT_EVENT_PROTOCOL,
		judgmentId: input.state.question.judgmentId,
		kind: "coverage-recorded",
		coverage: input.coverage,
	});
}
export function outcomeRecorded(input: {
	readonly state: ContextJudgmentState;
	readonly outcome: JudgmentOutcome;
}): ContextJudgmentEvent {
	return Object.freeze({
		protocol: CONTEXT_JUDGMENT_EVENT_PROTOCOL,
		judgmentId: input.state.question.judgmentId,
		kind: "outcome-recorded",
		outcome: input.outcome,
	});
}
function applicabilityIdentity(value: ContextApplicability): JsonValue {
	switch (value.kind) {
		case "applicable":
			return { kind: value.kind, basis: value.basis };
		case "not-applicable":
			return {
				kind: value.kind,
				reason: value.reason,
				evidence: value.evidence,
			};
		case "needs-context":
			return { kind: value.kind, missingContext: value.missingContext };
		default:
			return assertNever(value);
	}
}
function sameEvent(
	state: ContextJudgmentState,
	event: ContextJudgmentEvent,
): boolean {
	switch (event.kind) {
		case "applicability-recorded":
			return Boolean(
				state.applicability &&
					canonicalJson(applicabilityIdentity(state.applicability)) ===
						canonicalJson(applicabilityIdentity(event.applicability)),
			);
		case "selection-recorded":
			return (
				state.revision === event.revision &&
				state.selection?.selectionSha256 === event.selection.selectionSha256
			);
		case "sealed-context-recorded":
			return (
				state.revision === event.revision &&
				state.sealedContext?.sealedContextSha256 ===
					event.sealedContext.sealedContextSha256
			);
		case "coverage-recorded":
			return state.coverage?.coverageSha256 === event.coverage.coverageSha256;
		case "outcome-recorded":
			return state.outcome?.outcomeSha256 === event.outcome.outcomeSha256;
		default:
			return assertNever(event);
	}
}
function assertEvent(
	state: ContextJudgmentState,
	event: ContextJudgmentEvent,
): void {
	if (event.protocol !== CONTEXT_JUDGMENT_EVENT_PROTOCOL)
		throw new JudgmentTransitionError(
			`Unsupported Judgment event protocol: ${event.protocol}.`,
		);
	if (event.judgmentId !== state.question.judgmentId)
		throw new JudgmentTransitionError(
			`Judgment event belongs to another judgment: ${event.judgmentId}.`,
		);
}
export function transitionJudgment(
	state: ContextJudgmentState,
	event: ContextJudgmentEvent,
): ContextJudgmentState {
	assertEvent(state, event);
	if (sameEvent(state, event)) return state;
	if (state.status.startsWith("terminal-"))
		throw new JudgmentTransitionError(
			`Terminal Judgment state cannot accept ${event.kind}.`,
		);
	switch (event.kind) {
		case "applicability-recorded": {
			if (state.status !== "started")
				throw new JudgmentTransitionError(
					"Context applicability can be recorded only once at start.",
				);
			let status: ContextJudgmentStatus = "terminal-needs-context";
			if (event.applicability.kind === "applicable") status = "selection-open";
			else if (event.applicability.kind === "not-applicable")
				status = "terminal-not-applicable";
			return Object.freeze({
				...state,
				status,
				applicability: event.applicability,
			});
		}
		case "selection-recorded": {
			if (
				!["selection-open", "selected", "sealed", "covered"].includes(
					state.status,
				)
			)
				throw new JudgmentTransitionError(
					`Selection cannot be recorded from ${state.status}.`,
				);
			if (event.revision !== state.revision + 1)
				throw new JudgmentTransitionError(
					`Selection revision ${event.revision} does not follow ${state.revision}.`,
				);
			if (
				event.selection.judgmentId !== state.question.judgmentId ||
				event.selection.questionSha256 !== state.question.questionSha256
			)
				throw new JudgmentTransitionError(
					"Selection belongs to another dynamic question.",
				);
			return Object.freeze({
				...state,
				status: "selected",
				revision: event.revision,
				selection: event.selection,
				sealedContext: undefined,
				coverage: undefined,
				outcome: undefined,
			});
		}
		case "sealed-context-recorded": {
			if (state.status !== "selected" || !state.selection)
				throw new JudgmentTransitionError(
					`Sealed context cannot be recorded from ${state.status}.`,
				);
			if (
				event.revision !== state.revision ||
				event.sealedContext.selectionSha256 !== state.selection.selectionSha256
			)
				throw new JudgmentTransitionError(
					"Sealed context belongs to a stale selection revision.",
				);
			return Object.freeze({
				...state,
				status: "sealed",
				sealedContext: event.sealedContext,
			});
		}
		case "coverage-recorded": {
			if (state.status !== "sealed" || !state.sealedContext)
				throw new JudgmentTransitionError(
					`Coverage cannot be recorded from ${state.status}.`,
				);
			if (
				event.coverage.sealedContextSha256 !==
				state.sealedContext.sealedContextSha256
			)
				throw new JudgmentTransitionError(
					"Coverage belongs to stale sealed context.",
				);
			return Object.freeze({
				...state,
				status: "covered",
				coverage: event.coverage,
			});
		}
		case "outcome-recorded": {
			if (state.status !== "covered" || !state.sealedContext || !state.coverage)
				throw new JudgmentTransitionError(
					`Outcome cannot be recorded from ${state.status}.`,
				);
			if (
				event.outcome.sealedContextSha256 !==
					state.sealedContext.sealedContextSha256 ||
				event.outcome.coverageSha256 !== state.coverage.coverageSha256
			)
				throw new JudgmentTransitionError(
					"Outcome belongs to stale coverage or sealed context.",
				);
			return Object.freeze({
				...state,
				status: "terminal-outcome",
				outcome: event.outcome,
			});
		}
		default:
			return assertNever(event);
	}
}
export function replayJudgmentEvents(
	initial: ContextJudgmentState,
	events: readonly ContextJudgmentEvent[],
): ContextJudgmentState {
	return events.reduce(
		(state, event) => transitionJudgment(state, event),
		initial,
	);
}
function assertNever(value: never): never {
	throw new JudgmentTransitionError(
		`Unsupported context Judgment variant: ${JSON.stringify(value)}.`,
	);
}
