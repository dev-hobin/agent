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
import type { LatestUserMessage } from "../src/material-review-trigger.ts";

export type ObserverMaterialReviewIds = MaterialReviewCommandIds;

export interface ObserverTurnState {
	toolUsed: boolean;
	latestUser: LatestUserMessage | null;
	scriptedMaterialRequest: string | null;
	blockedRequestId: string | null;
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
	return { result, text: materialReviewCommandText(result) };
}

export function observerTurnContext(input: {
	readonly turnState: ObserverTurnState;
	readonly entries: readonly PiBranchEntryLike[];
}): string | null {
	const guidance = [
		materialReviewContext({
			latestUser: input.turnState.latestUser,
			entries: input.entries,
		}),
		input.turnState.blockedRequestId
			? null
			: observerSidecarContext(input.entries),
	]
		.filter((item) => item !== null)
		.join("\n\n");
	return guidance.length > 0 ? guidance : null;
}
