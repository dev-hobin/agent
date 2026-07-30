import type { ObservationController } from "../src/observation-controller.ts";
import type { ObserverController } from "../src/observer-controller.ts";
import {
	executeMaterialReviewFinish,
	executeMaterialReviewStart,
	materialReviewCommandAction,
	materialReviewCommandText,
	materialReviewContext,
	requireMaterialReviewCommandSuccess,
	type MaterialReviewCommandIds,
	type MaterialReviewCommandPort,
	type MaterialReviewCommandResult,
} from "../src/material-review-command.ts";
import type { PiBranchEntryLike } from "../src/pi-session.ts";
import type {
	LatestUserMessage,
	MaterialReviewMaterial,
	MaterialReviewRequestId,
} from "../src/material-review-trigger.ts";

export type ObserverMaterialReviewIds = MaterialReviewCommandIds;

interface MaterialReviewRun {
	readonly agentRunId: number;
	readonly requestId: MaterialReviewRequestId;
	readonly material: MaterialReviewMaterial;
}

export interface NominatableToolResult {
	readonly toolCallId: string;
	readonly toolName: string;
	readonly isError: boolean;
	readonly capturedAt: string;
	readonly input?: Readonly<Record<string, unknown>>;
	readonly content?: readonly unknown[];
}

export interface ResolvedToolResultNomination extends NominatableToolResult {
	readonly text: string;
	readonly reason: string;
}

export type ToolResultNominationResolution =
	| {
			readonly ok: true;
			readonly results: readonly ResolvedToolResultNomination[];
	  }
	| { readonly ok: false; readonly message: string };

export interface ObserverTurnState {
	toolUsed: boolean;
	latestUser: LatestUserMessage | null;
	scriptedMaterialRequest: string | null;
	blockedRequestId: string | null;
	backgroundIssue?: string | null;
	agentRunSequence: number;
	activeAgentRunId: number | null;
	materialReviewRun: MaterialReviewRun | null;
	nominatableToolResults: Map<string, NominatableToolResult>;
	stagedMaterialReviewRetry: {
		readonly requestId: MaterialReviewRequestId;
		readonly material: MaterialReviewMaterial;
	} | null;
}

export function beginObserverAgentRun(turnState: ObserverTurnState): void {
	turnState.nominatableToolResults.clear();
	turnState.agentRunSequence += 1;
	turnState.activeAgentRunId = turnState.agentRunSequence;
	const staged = turnState.stagedMaterialReviewRetry;
	turnState.materialReviewRun = staged
		? { ...staged, agentRunId: turnState.agentRunSequence }
		: null;
	turnState.stagedMaterialReviewRetry = null;
}

export function endObserverAgentRun(turnState: ObserverTurnState): void {
	turnState.activeAgentRunId = null;
	turnState.materialReviewRun = null;
	turnState.nominatableToolResults.clear();
}

export function settleObserverAgentRun(turnState: ObserverTurnState): void {
	endObserverAgentRun(turnState);
	turnState.stagedMaterialReviewRetry = null;
}

export function suspendMaterialReviewRun(turnState: ObserverTurnState): void {
	turnState.materialReviewRun = null;
}

export function clearToolResultNominations(turnState: ObserverTurnState): void {
	turnState.nominatableToolResults.clear();
}

export function stageNominatableToolResult(input: {
	readonly turnState: ObserverTurnState;
	readonly result: NominatableToolResult;
}): boolean {
	if (input.turnState.activeAgentRunId === null) return false;
	input.turnState.nominatableToolResults.delete(input.result.toolCallId);
	input.turnState.nominatableToolResults.set(
		input.result.toolCallId,
		input.result,
	);
	while (input.turnState.nominatableToolResults.size > 24) {
		const oldest = input.turnState.nominatableToolResults.keys().next().value;
		if (typeof oldest !== "string") break;
		input.turnState.nominatableToolResults.delete(oldest);
	}
	return true;
}

function toolResultText(value: unknown): string {
	if (!Array.isArray(value)) return "";
	return value
		.flatMap((item) => {
			if (typeof item === "string") return [item];
			if (!item || typeof item !== "object") return [];
			return Reflect.get(item, "type") === "text" &&
				typeof Reflect.get(item, "text") === "string"
				? [String(Reflect.get(item, "text"))]
				: [];
		})
		.join("\n")
		.trim();
}

function branchToolResult(
	entries: readonly PiBranchEntryLike[],
	metadata: NominatableToolResult,
): { readonly text: string } | null {
	for (const entry of entries.toReversed()) {
		if (entry.type !== "message") continue;
		const message = Reflect.get(entry, "message");
		if (!message || typeof message !== "object") continue;
		if (
			Reflect.get(message, "role") !== "toolResult" ||
			Reflect.get(message, "toolCallId") !== metadata.toolCallId ||
			Reflect.get(message, "toolName") !== metadata.toolName
		)
			continue;
		const text = toolResultText(Reflect.get(message, "content"));
		return text ? { text } : null;
	}
	return null;
}

interface ToolResultNominationSelection {
	readonly toolCallId: string;
	readonly reason: string;
}

function decodeToolResultNominationSelections(
	value: unknown,
): readonly ToolResultNominationSelection[] | string {
	if (!Array.isArray(value) || value.length === 0 || value.length > 12) {
		return "Nominate between 1 and 12 tool results.";
	}
	const selectedIds = new Set<string>();
	const selections: ToolResultNominationSelection[] = [];
	for (const item of value) {
		if (!item || typeof item !== "object") {
			return "Each nomination must be an object.";
		}
		const toolCallId = Reflect.get(item, "tool_call_id");
		const reasonValue = Reflect.get(item, "reason");
		const reason = typeof reasonValue === "string" ? reasonValue.trim() : "";
		if (
			typeof toolCallId !== "string" ||
			toolCallId.length === 0 ||
			toolCallId.length > 300 ||
			selectedIds.has(toolCallId)
		) {
			return "Tool-result nominations require unique valid tool_call_ids.";
		}
		if (!reason || reason.length > 4_000) {
			return "Each nomination requires a reason of at most 4000 characters.";
		}
		selectedIds.add(toolCallId);
		selections.push({ toolCallId, reason });
	}
	return selections;
}

export function resolveToolResultNomination(input: {
	readonly turnState: ObserverTurnState;
	readonly selections: unknown;
	readonly entries: readonly PiBranchEntryLike[];
}): ToolResultNominationResolution {
	if (input.turnState.activeAgentRunId === null) {
		return {
			ok: false,
			message: "Tool results may be nominated only in their active agent run.",
		};
	}
	const selections = decodeToolResultNominationSelections(input.selections);
	if (typeof selections === "string") {
		return { ok: false, message: selections };
	}
	const results: ResolvedToolResultNomination[] = [];
	for (const selection of selections) {
		const metadata = input.turnState.nominatableToolResults.get(
			selection.toolCallId,
		);
		if (!metadata) {
			return {
				ok: false,
				message: `Tool result ${selection.toolCallId} is not eligible in the current agent run.`,
			};
		}
		const result = branchToolResult(input.entries, metadata);
		if (!result) {
			return {
				ok: false,
				message: `Tool result ${selection.toolCallId} is unavailable on the current branch.`,
			};
		}
		results.push({ ...metadata, ...result, reason: selection.reason });
	}
	return { ok: true, results };
}

export function consumeToolResultNominations(
	turnState: ObserverTurnState,
	toolCallIds: readonly string[],
): void {
	for (const toolCallId of toolCallIds) {
		turnState.nominatableToolResults.delete(toolCallId);
	}
}

export function stageMaterialReviewRetry(
	turnState: ObserverTurnState,
	request: {
		readonly requestId: MaterialReviewRequestId;
		readonly material: MaterialReviewMaterial;
	},
): void {
	turnState.stagedMaterialReviewRetry = request;
}

export function activateMaterialReviewRun(
	turnState: ObserverTurnState,
	request: {
		readonly requestId: MaterialReviewRequestId;
		readonly material: MaterialReviewMaterial;
	},
): boolean {
	if (turnState.activeAgentRunId === null) return false;
	turnState.nominatableToolResults.clear();
	turnState.materialReviewRun = {
		...request,
		agentRunId: turnState.activeAgentRunId,
	};
	return true;
}

export function activeMaterialReviewRequestId(
	turnState: ObserverTurnState,
): MaterialReviewRequestId | null {
	const run = turnState.materialReviewRun;
	return run && run.agentRunId === turnState.activeAgentRunId
		? run.requestId
		: null;
}

export function activeMaterialReviewCaptureRequestId(
	turnState: ObserverTurnState,
): MaterialReviewRequestId | null {
	const run = turnState.materialReviewRun;
	return run &&
		run.agentRunId === turnState.activeAgentRunId &&
		run.material === "retrieved-tool-results"
		? run.requestId
		: null;
}

export function acceptScriptedMaterialInput(input: {
	readonly turnState: ObserverTurnState;
	readonly source: string;
	readonly text: string;
	readonly inputSource: LatestUserMessage["inputSource"];
}): boolean {
	if (
		input.source !== "extension" ||
		input.turnState.scriptedMaterialRequest !== input.text
	)
		return false;
	input.turnState.scriptedMaterialRequest = null;
	input.turnState.latestUser = {
		text: input.text,
		inputSource: input.inputSource,
	};
	return true;
}

type SuccessfulMaterialReviewCommand = Exclude<
	MaterialReviewCommandResult,
	{ readonly ok: false }
>;

export interface SuccessfulMaterialReviewTool {
	readonly result: SuccessfulMaterialReviewCommand;
	readonly text: string;
}

export async function routeMaterialReviewTool(input: {
	readonly value: unknown;
	readonly capturedAt: unknown;
	readonly port: MaterialReviewCommandPort;
	readonly lifecycle: ObserverController;
	readonly observation: ObservationController;
	readonly ids: MaterialReviewCommandIds;
	readonly turnState: ObserverTurnState;
}): Promise<SuccessfulMaterialReviewTool | null> {
	const action = materialReviewCommandAction(input.value);
	if (action === "material-review-start") {
		const result = requireMaterialReviewCommandSuccess(
			await executeMaterialReviewStart({
				value: input.value,
				latestUser: input.turnState.latestUser,
				capturedAt: input.capturedAt,
				port: input.port,
				lifecycle: input.lifecycle,
				observation: input.observation,
				ids: input.ids,
			}),
		);
		activateMaterialReviewRun(input.turnState, {
			requestId: result.requestId,
			material:
				result.status === "pending-retrieval"
					? "retrieved-tool-results"
					: "inline-user-message",
		});
		return { result, text: materialReviewCommandText(result) };
	}
	if (action !== "material-review-finish") return null;
	const result = requireMaterialReviewCommandSuccess(
		executeMaterialReviewFinish({
			value: input.value,
			port: input.port,
			observation: input.observation,
		}),
	);
	input.turnState.latestUser = null;
	suspendMaterialReviewRun(input.turnState);
	return { result, text: materialReviewCommandText(result) };
}

export function observerTurnContext(input: {
	readonly turnState: ObserverTurnState;
	readonly entries: readonly PiBranchEntryLike[];
}): string | null {
	const activeRequestId = activeMaterialReviewRequestId(input.turnState);
	return materialReviewContext({
		latestUser: input.turnState.latestUser,
		activeRequestId,
		entries: input.entries,
	});
}
