import type {
	ObservationController,
} from "../src/observation-controller.ts";
import type { ObserverController } from "../src/observer-controller.ts";
import {
	executeOneShotFinish,
	executeOneShotStart,
	oneShotCommandAction,
	oneShotCommandText,
	oneShotContext,
	requireOneShotCommandSuccess,
	type OneShotCommandIds,
	type OneShotCommandPort,
	type OneShotCommandResult,
} from "../src/one-shot-command.ts";
import { observerSidecarContext } from "../src/observer-prompt.ts";
import type { PiBranchEntryLike } from "../src/pi-session.ts";
import type { LatestUserMessage } from "../src/one-shot-trigger.ts";

export type ObserverOneShotIds = OneShotCommandIds;

export interface ObserverTurnState {
	toolUsed: boolean;
	latestUser: LatestUserMessage | null;
}

type SuccessfulOneShotCommand = Exclude<
	OneShotCommandResult,
	{ readonly ok: false }
>;

export interface SuccessfulOneShotTool {
	readonly result: SuccessfulOneShotCommand;
	readonly text: string;
}

export async function routeOneShotTool(input: {
	readonly value: unknown;
	readonly capturedAt: unknown;
	readonly port: OneShotCommandPort;
	readonly lifecycle: ObserverController;
	readonly observation: ObservationController;
	readonly ids: OneShotCommandIds;
	readonly turnState: ObserverTurnState;
}): Promise<SuccessfulOneShotTool | null> {
	const action = oneShotCommandAction(input.value);
	if (action === "one-shot-start") {
		const result = requireOneShotCommandSuccess(
			await executeOneShotStart({
				value: input.value,
				latestUser: input.turnState.latestUser,
				capturedAt: input.capturedAt,
				port: input.port,
				lifecycle: input.lifecycle,
				observation: input.observation,
				ids: input.ids,
			}),
		);
		return { result, text: oneShotCommandText(result) };
	}
	if (action !== "one-shot-finish") return null;
	const result = requireOneShotCommandSuccess(
		executeOneShotFinish({
			value: input.value,
			port: input.port,
			observation: input.observation,
		}),
	);
	input.turnState.latestUser = null;
	return { result, text: oneShotCommandText(result) };
}

export function observerTurnContext(input: {
	readonly turnState: ObserverTurnState;
	readonly entries: readonly PiBranchEntryLike[];
}): string | null {
	const guidance = [
		oneShotContext({
			latestUser: input.turnState.latestUser,
			entries: input.entries,
		}),
		observerSidecarContext(input.entries),
	]
		.filter((item) => item !== null)
		.join("\n\n");
	return guidance.length > 0 ? guidance : null;
}
