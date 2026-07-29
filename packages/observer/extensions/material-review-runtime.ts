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
import { observerSidecarContext } from "../src/observer-prompt.ts";
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

export interface ObserverTurnState {
	toolUsed: boolean;
	latestUser: LatestUserMessage | null;
	scriptedMaterialRequest: string | null;
	blockedRequestId: string | null;
	agentRunSequence: number;
	activeAgentRunId: number | null;
	materialReviewRun: MaterialReviewRun | null;
	stagedMaterialReviewRetry: {
		readonly requestId: MaterialReviewRequestId;
		readonly material: MaterialReviewMaterial;
	} | null;
}

export function beginObserverAgentRun(turnState: ObserverTurnState): void {
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
}

export function settleObserverAgentRun(turnState: ObserverTurnState): void {
	endObserverAgentRun(turnState);
	turnState.stagedMaterialReviewRetry = null;
}

export function suspendMaterialReviewRun(turnState: ObserverTurnState): void {
	turnState.materialReviewRun = null;
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
	const guidance = [
		materialReviewContext({
			latestUser: input.turnState.latestUser,
			activeRequestId,
			entries: input.entries,
		}),
		input.turnState.blockedRequestId || activeRequestId
			? null
			: observerSidecarContext(input.entries),
	]
		.filter((item) => item !== null)
		.join("\n\n");
	return guidance.length > 0 ? guidance : null;
}
