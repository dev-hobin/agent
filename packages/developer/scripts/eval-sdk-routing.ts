import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
	routeStructuredCapabilityWithSdk,
	type SdkCapabilityRoutingResult,
} from "../src/action-loop/sdk/capability-routing-controller.ts";
import { createPiSdkDecisionRunner } from "../src/action-loop/sdk/decision-controller.ts";
import type { ApplicabilityTarget } from "../src/action-loop/routing/accept-applicability.ts";
import {
	bindCapability,
	type BoundCapability,
} from "../src/action-loop/routing/bind-capability.ts";
import {
	parseTocBytes,
	type ParsedToc,
} from "../src/action-loop/routing/parse-toc.ts";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
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

const request =
	process.env.DEVELOPER_SDK_REQUEST ??
	"파일을 수정하지 말고 재시도 가능한 결제 승인 모델을 완성해라. Created, Authorizing(attempt, requestId), Authorized(paymentId), Failed 상태와 stale, duplicate, reordered approval을 구분하고 safety/progress 가정, 금지 반례, 검증 대상을 제시해라.";
const modelSpec = process.env.DEVELOPER_SDK_MODEL ?? "openai-codex/gpt-5.6-sol";
const maxRuns = Number(process.env.DEVELOPER_SDK_MAX_RUNS ?? 2);
const maxToolErrorsPerRun = Number(
	process.env.DEVELOPER_SDK_MAX_TOOL_ERRORS ?? 3,
);

async function loadTarget(): Promise<{
	readonly target: ApplicabilityTarget & {
		readonly capability: BoundCapability;
	};
	readonly toc: ParsedToc;
}> {
	const skillPath = join(packageRoot, "skills", "model", "SKILL.md");
	const tocPath = join(packageRoot, "skills", "model", "toc.json");
	const [skillBytes, tocBytes] = await Promise.all([
		readFile(skillPath),
		readFile(tocPath),
	]);
	const parsed = parseTocBytes(tocBytes);
	if (!parsed.ok) throw new Error(parsed.error.message);
	const bound = bindCapability(
		{
			kind: "package",
			locator: "npm:@hobin/developer",
			skillRoot: "skills/model",
		},
		parsed.value,
		skillBytes,
	);
	if (!bound.ok) throw new Error(bound.error.message);
	return {
		toc: parsed.value,
		target: {
			workCaseId: "sdk-routing-controller-work-case",
			judgmentId: "sdk-routing-controller-judgment",
			contributionNeedId: "sdk-routing-controller-need",
			capability: bound.value,
		},
	};
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

function resultSummary(result: SdkCapabilityRoutingResult): object {
	if (result.status === "routed") {
		return {
			outcome: result.status,
			applicability: {
				status: result.applicability.status,
				basis: result.applicability.assessment.basis,
			},
			references: result.selection.dispositions,
			selection: {
				status: result.selection.status,
				selectedPaths: result.selection.selectedPaths,
				unresolvedPaths: result.selection.unresolved.map(({ path }) => path),
			},
			decisions: result.decisions,
		};
	}
	if (result.status === "not-assigned") {
		return {
			outcome: result.status,
			applicability: {
				status: result.applicability.status,
				basis: result.applicability.assessment.basis,
			},
			references: [],
			selection: "not-assigned",
			decisions: result.decisions,
		};
	}
	return {
		outcome: result.status,
		stage: result.stage,
		...(result.status === "bounded-stop" ? { reason: result.reason } : {}),
		...(result.status === "runtime-failure" ? { message: result.message } : {}),
		...(result.status === "invariant-failure"
			? { code: result.code, message: result.message }
			: {}),
		decisions: result.decisions,
	};
}

function trialOutcomeForResult(result: SdkCapabilityRoutingResult): string {
	switch (result.status) {
		case "routed":
			return result.selection.status === "ready" ? "routing-completed" : "held";
		case "bounded-stop":
			return "bounded-stop";
		case "runtime-failure":
			return "provider-blocked";
		case "not-assigned":
			return "not-assigned";
		case "invariant-failure":
			return "invariant-failure";
		default: {
			const exhaustive: never = result;
			return exhaustive;
		}
	}
}

function evaluatorResult(result: SdkCapabilityRoutingResult): object {
	const toolCallAttemptCount = result.decisions.reduce(
		(total, decision) => total + decision.metrics.toolCalls,
		0,
	);
	const toolErrorCount = result.decisions.reduce(
		(total, decision) => total + decision.metrics.toolErrors,
		0,
	);
	const runtimeFailureCount = result.decisions.reduce(
		(total, decision) => total + decision.metrics.runtimeFailures,
		0,
	);
	const decisionRetryCount = result.decisions.reduce(
		(total, decision) => total + Math.max(0, decision.metrics.runs - 1),
		0,
	);
	const completedRouting = result.status === "routed";
	return {
		fixtureId: process.env.DEVELOPER_EVAL_FIXTURE ?? "sdk-routing",
		structuralValid: result.status !== "invariant-failure",
		trialOutcome: trialOutcomeForResult(result),
		firstTarget: completedRouting ? "model" : "none",
		toolCallAttemptCount,
		toolErrorCount,
		controllerDecisionCount: result.decisions.length,
		decisionRetryCount,
		recoveryCount: completedRouting ? toolErrorCount + runtimeFailureCount : 0,
		model: modelSpec,
		piVersion: sdkPackage.version,
	};
}

const modelRuntime = await sdk.ModelRuntime.create();
const { provider, modelId } = parseModelSpec(modelSpec);
const model = modelRuntime.getModel(provider, modelId);
if (!model) throw new Error(`Model is not registered: ${modelSpec}`);

const { target, toc } = await loadTarget();
const runner = createPiSdkDecisionRunner({
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
	maxRuns,
	maxToolErrorsPerRun,
	thinkingLevel: "medium",
});
const result = await routeStructuredCapabilityWithSdk({
	request,
	target,
	toc,
	runner,
});

const artifact = {
	protocol: "developer-sdk-routing-controller/v1",
	piVersion: sdkPackage.version,
	model: modelSpec,
	...resultSummary(result),
};
process.stdout.write(`${JSON.stringify(artifact)}\n`);
if (process.env.DEVELOPER_EVAL_MODE === "sdk") {
	process.stdout.write(
		`DEVELOPER_EVAL_RESULT ${JSON.stringify(evaluatorResult(result))}\n`,
	);
}
if (result.status === "invariant-failure") process.exitCode = 1;
