import { Type, type Static } from "typebox";
import { Check } from "typebox/value";

import type { CompletedWorkCase } from "../src/action-loop/work/complete-work-case.ts";
import {
	openLiveWorkCase,
	type LiveWorkCaseProposal,
	type LiveWorkCaseState,
} from "./action-loop-work-case.ts";

export const ACTION_LOOP_SESSION_PROTOCOL =
	"developer-action-loop/session-event/v1";
export const ACTION_LOOP_SESSION_ENTRY = "developer.action-loop.session-event";

const ProvenanceSchema = Type.Object(
	{
		kind: Type.Union([
			Type.Literal("model"),
			Type.Literal("human"),
			Type.Literal("tool"),
			Type.Literal("external"),
		]),
		source: Type.String({ minLength: 1, maxLength: 2_000 }),
	},
	{ additionalProperties: false },
);

const WorkCaseOpenedEventSchema = Type.Object(
	{
		protocol: Type.Literal(ACTION_LOOP_SESSION_PROTOCOL),
		kind: Type.Literal("work-case-opened"),
		transitionId: Type.String({ minLength: 1, maxLength: 512 }),
		proposal: Type.Object(
			{
				outcome: Type.Object(
					{
						statement: Type.String({ minLength: 1, maxLength: 2_000 }),
						acceptanceConditions: Type.Array(
							Type.String({ minLength: 1, maxLength: 2_000 }),
							{ minItems: 1, maxItems: 32 },
						),
						constraints: Type.Array(
							Type.String({ minLength: 1, maxLength: 2_000 }),
							{ maxItems: 32 },
						),
					},
					{ additionalProperties: false },
				),
				basis: Type.Array(Type.String({ minLength: 1, maxLength: 2_000 }), {
					minItems: 1,
					maxItems: 32,
				}),
				provenance: ProvenanceSchema,
			},
			{ additionalProperties: false },
		),
		expected: Type.Object(
			{
				workCaseId: Type.String({ minLength: 1, maxLength: 512 }),
				revisionId: Type.String({ minLength: 1, maxLength: 512 }),
			},
			{ additionalProperties: false },
		),
	},
	{ additionalProperties: false },
);

export type ActionLoopWorkCaseOpenedEvent = Static<
	typeof WorkCaseOpenedEventSchema
>;
export type ActionLoopSessionEvent = ActionLoopWorkCaseOpenedEvent;

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

function claimedReplayEvent(entry: ActionLoopSessionBranchEntry): unknown {
	if (entry.customType === ACTION_LOOP_SESSION_ENTRY) return entry.data;
	const details = entry.message?.details;
	return isRecord(details) && "replayEvent" in details
		? details.replayEvent
		: undefined;
}

function extractReplayEvent(entry: ActionLoopSessionBranchEntry): ExtractedEvent {
	const candidate = claimedReplayEvent(entry);
	if (candidate === undefined) return { status: "absent" };
	if (!Check(WorkCaseOpenedEventSchema, candidate)) {
		return { status: "invalid" };
	}
	return { status: "event", event: candidate };
}

export async function replayActionLoopSession(
	entries: readonly ActionLoopSessionBranchEntry[],
): Promise<ActionLoopSessionReplayResult> {
	let activeWorkCase: LiveWorkCaseState | undefined;
	let completedWorkCase: CompletedWorkCase | undefined;
	let appliedTransitions = 0;

	for (const [entryIndex, entry] of entries.entries()) {
		const extracted = extractReplayEvent(entry);
		if (extracted.status === "absent") continue;
		if (extracted.status === "invalid") {
			return {
				status: "unavailable",
				entryIndex,
				message: "Claimed Action Loop session event is malformed or unsupported.",
			};
		}
		const { event } = extracted;
		const opened = openLiveWorkCase(activeWorkCase, event.proposal);
		if (
			(opened.status !== "opened" && opened.status !== "unchanged") ||
			opened.value.workCase.workCaseId !== event.expected.workCaseId ||
			opened.value.workCase.revisionId !== event.expected.revisionId ||
			event.transitionId !== event.expected.workCaseId
		) {
			return {
				status: "unavailable",
				entryIndex,
				message:
					"Persisted Work Case opening does not reproduce its exact canonical identity.",
			};
		}
		activeWorkCase = opened.value;
		completedWorkCase = undefined;
		appliedTransitions += 1;
	}

	return {
		status: "ready",
		...(activeWorkCase ? { activeWorkCase } : {}),
		...(completedWorkCase ? { completedWorkCase } : {}),
		appliedTransitions,
	};
}
