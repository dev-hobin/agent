import { createRequire } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { createPiSdkDecisionRunner } from "../src/action-loop/sdk/decision-controller.ts";

export interface SdkEvalRuntime {
	readonly sdk: typeof import("@earendil-works/pi-coding-agent");
	readonly piVersion: string;
	readonly modelSpec: string;
	readonly runner: ReturnType<typeof createPiSdkDecisionRunner>;
}

function parseModelSpec(value: string): {
	readonly provider: string;
	readonly modelId: string;
} {
	const separator = value.indexOf("/");
	if (separator <= 0 || separator === value.length - 1) {
		throw new Error(`Expected provider/model, received ${value}`);
	}
	return {
		provider: value.slice(0, separator),
		modelId: value.slice(separator + 1),
	};
}

/** Loads one exact Pi SDK runtime for an isolated evaluation process. */
export async function createSdkEvalRuntime(
	packageRoot: string,
): Promise<SdkEvalRuntime> {
	const sdkPackageRoot = process.env.DEVELOPER_SDK_PI_ROOT;
	if (!sdkPackageRoot) {
		throw new Error(
			"DEVELOPER_SDK_PI_ROOT must identify the exact @earendil-works/pi-coding-agent package under test",
		);
	}
	const sdkRequire = createRequire(join(sdkPackageRoot, "package.json"));
	const sdk = (await import(
		pathToFileURL(join(sdkPackageRoot, "dist", "index.js")).href
	)) as typeof import("@earendil-works/pi-coding-agent");
	const sdkPackage = sdkRequire("./package.json") as {
		readonly version?: string;
	};
	if (!sdkPackage.version) throw new Error("SDK package version is unavailable");
	const modelSpec =
		process.env.DEVELOPER_SDK_MODEL ?? "openai-codex/gpt-5.6-sol";
	const { provider, modelId } = parseModelSpec(modelSpec);
	const modelRuntime = await sdk.ModelRuntime.create();
	const model = modelRuntime.getModel(provider, modelId);
	if (!model) throw new Error(`Model is not registered: ${modelSpec}`);
	return {
		sdk,
		piVersion: sdkPackage.version,
		modelSpec,
		runner: createPiSdkDecisionRunner({
			bindings: {
				createAgentSession: sdk.createAgentSession,
				createExtensionRuntime: sdk.createExtensionRuntime,
				defineTool: sdk.defineTool,
				SessionManager: sdk.SessionManager,
				SettingsManager: sdk.SettingsManager,
			},
			modelRuntime,
			model,
			cwd: packageRoot,
			maxRuns: Number(process.env.DEVELOPER_SDK_MAX_RUNS ?? 2),
			maxToolErrorsPerRun: Number(
				process.env.DEVELOPER_SDK_MAX_TOOL_ERRORS ?? 3,
			),
			maxRunMs: Number(process.env.DEVELOPER_SDK_MAX_RUN_MS ?? 120_000),
			thinkingLevel: "medium",
		}),
	};
}
