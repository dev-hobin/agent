import {
	createAgentSession,
	createExtensionRuntime,
	defineTool,
	SessionManager,
	SettingsManager,
	type ExtensionContext,
} from "@earendil-works/pi-coding-agent";

import {
	createPiSdkDecisionRunner,
	type PiSdkModelRuntime,
	type PiSdkThinkingLevel,
	type SdkDecisionRunner,
} from "../src/action-loop/sdk/decision-controller.ts";

const DEFAULT_MAX_RUNS = 2;
const DEFAULT_MAX_TOOL_ERRORS_PER_RUN = 3;
const DEFAULT_MAX_RUN_MS = 120_000;

export interface PiExtensionSdkRunnerOptions {
	readonly signal?: AbortSignal;
	readonly modelRuntime?: PiSdkModelRuntime;
	readonly maxRuns?: number;
	readonly maxToolErrorsPerRun?: number;
	readonly maxRunMs?: number;
	readonly thinkingLevel?: PiSdkThinkingLevel;
}

export type PiExtensionSdkRunnerResult =
	| { readonly status: "ready"; readonly runner: SdkDecisionRunner }
	| { readonly status: "unavailable"; readonly reason: "no-active-model" };

/**
 * Binds one stock Pi Extension context to an in-memory SDK decision runner.
 * The active Pi branch remains the only durable store; nested sessions persist
 * nothing and inherit cancellation only through the explicit host signal.
 */
export function createPiExtensionSdkRunner(
	ctx: Pick<ExtensionContext, "cwd" | "model">,
	options: PiExtensionSdkRunnerOptions = {},
): PiExtensionSdkRunnerResult {
	if (ctx.model === undefined) {
		return { status: "unavailable", reason: "no-active-model" };
	}
	return {
		status: "ready",
		runner: createPiSdkDecisionRunner({
			bindings: {
				createAgentSession,
				createExtensionRuntime,
				defineTool,
				SessionManager,
				SettingsManager,
			},
			...(options.modelRuntime ? { modelRuntime: options.modelRuntime } : {}),
			model: ctx.model,
			cwd: ctx.cwd,
			maxRuns: options.maxRuns ?? DEFAULT_MAX_RUNS,
			maxToolErrorsPerRun:
				options.maxToolErrorsPerRun ?? DEFAULT_MAX_TOOL_ERRORS_PER_RUN,
			maxRunMs: options.maxRunMs ?? DEFAULT_MAX_RUN_MS,
			...(options.signal ? { signal: options.signal } : {}),
			...(options.thinkingLevel
				? { thinkingLevel: options.thinkingLevel }
				: {}),
		}),
	};
}
