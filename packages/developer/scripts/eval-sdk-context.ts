import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
	assessCapabilityInventoryWithSdk,
	type SdkNamedCapability,
} from "../src/action-loop/sdk/capability-inventory-controller.ts";
import { sealCapabilityContextWithSdk } from "../src/action-loop/sdk/context-sealing-controller.ts";
import type { SdkDecisionMetrics } from "../src/action-loop/sdk/decision-controller.ts";
import { openJudgmentWithSdk } from "../src/action-loop/sdk/judgment-controller.ts";
import { openWorkCaseWithSdk } from "../src/action-loop/sdk/work-case-controller.ts";
import { bindPiCapabilityInventory } from "../src/action-loop/pi/bind-pi-capability-inventory.ts";
import { catalogBeforeAgentStartSkills } from "../src/action-loop/pi/catalog-pi-loaded-skills.ts";
import { createSdkEvalRuntime } from "./sdk-eval-runtime.ts";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const request =
	process.env.DEVELOPER_SDK_REQUEST ??
	"파일을 수정하지 말고 재시도 가능한 결제 승인 모델을 완성해라. Created, Authorizing(attempt, requestId), Authorized(paymentId), Failed 상태와 stale, duplicate, reordered approval을 구분하고 safety/progress 가정, 금지 반례, 검증 대상을 제시해라.";

function positiveBudget(name: string, fallback: number): number {
	const value = Number(process.env[name] ?? fallback);
	if (!Number.isSafeInteger(value) || value < 1) {
		throw new Error(`${name} must be a positive safe integer`);
	}
	return value;
}

const maximumNeeds = positiveBudget("DEVELOPER_SDK_MAX_NEEDS", 4);
const maximumContexts = positiveBudget("DEVELOPER_SDK_MAX_CONTEXTS", 12);
const traceStartedAt = Date.now();

interface DecisionObservation {
	readonly stage: string;
	readonly metrics: SdkDecisionMetrics;
}

interface ContextObservation {
	readonly need: string;
	readonly capability: string;
	readonly status: string;
	readonly selectedPaths: readonly string[];
}

function trace(message: string): void {
	if (process.env.DEVELOPER_SDK_TRACE === "1") {
		process.stderr.write(
			`[developer-sdk-context +${Date.now() - traceStartedAt}ms] ${message}\n`,
		);
	}
}

function decisionTotals(decisions: readonly DecisionObservation[]) {
	return {
		toolCallAttemptCount: decisions.reduce(
			(total, decision) => total + decision.metrics.toolCalls,
			0,
		),
		toolErrorCount: decisions.reduce(
			(total, decision) => total + decision.metrics.toolErrors,
			0,
		),
		decisionRetryCount: decisions.reduce(
			(total, decision) =>
				total + Math.max(0, decision.metrics.runs - 1),
			0,
		),
		timeBudgetStopCount: decisions.reduce(
			(total, decision) => total + decision.metrics.timeBudgetStops,
			0,
		),
		controllerDecisionCount: decisions.length,
	};
}

async function loadCapabilities(
	runtime: Awaited<ReturnType<typeof createSdkEvalRuntime>>,
): Promise<readonly SdkNamedCapability[]> {
	const loaded = runtime.sdk.loadSkillsFromDir({
		dir: join(packageRoot, "skills"),
		source: "@hobin/developer",
	});
	if (loaded.diagnostics.length > 0) {
		throw new Error(
			`Pi Skill loading failed: ${loaded.diagnostics.map(({ message }) => message).join(" | ")}`,
		);
	}
	const catalog = await catalogBeforeAgentStartSkills({
		systemPromptOptions: { cwd: packageRoot, skills: loaded.skills },
	});
	const inventory = await bindPiCapabilityInventory(catalog);
	if (inventory.status === "rejected") throw new Error(inventory.error.message);
	return Object.freeze(
		inventory.entries.flatMap((entry) =>
			entry.status === "bound"
				? [{ name: entry.candidate.label, entry }]
				: [],
		),
	);
}

const runtime = await createSdkEvalRuntime(packageRoot);
trace(`runtime ready: ${runtime.piVersion} ${runtime.modelSpec}`);
const capabilities = await loadCapabilities(runtime);
trace(`Capability inventory ready: ${capabilities.length}`);
const decisions: DecisionObservation[] = [];
const contexts: ContextObservation[] = [];
const selectedTargets = new Set<string>();
let outcome = "context-ready";
let stage = "work-case";
let message: string | undefined;
let processedNeeds = 0;
let processedContexts = 0;

trace("opening Work Case");
const workCase = await openWorkCaseWithSdk({ request, runner: runtime.runner });
trace(`Work Case stage: ${workCase.status}`);
if ("decision" in workCase) {
	decisions.push({ stage: "work-case", metrics: workCase.decision });
}
if (workCase.status !== "opened") {
	if (workCase.status === "runtime-failure") {
		outcome = "provider-blocked";
		message = workCase.message;
	} else {
		outcome = "bounded-stop";
		message = workCase.reason;
	}
} else {
	stage = "judgment";
	trace("opening Judgment");
	const judgment = await openJudgmentWithSdk({
		request,
		workCase: workCase.workCase,
		contextRevisionId: workCase.workCase.revisionId,
		runner: runtime.runner,
	});
	trace(`Judgment stage: ${judgment.status}`);
	if ("decision" in judgment) {
		decisions.push({ stage: "judgment", metrics: judgment.decision });
	}
	if (judgment.status !== "opened" && judgment.status !== "unchanged") {
		if (judgment.status === "runtime-failure") {
			outcome = "provider-blocked";
			message = judgment.message;
		} else if (judgment.status === "bounded-stop") {
			outcome = "bounded-stop";
			message = judgment.reason;
		} else {
			outcome = "invariant-failure";
			message = "A different Judgment already owns the Work Case.";
		}
	} else {
		for (const need of judgment.judgment.contributionNeeds) {
			if (processedNeeds >= maximumNeeds) {
				outcome = "bounded-stop";
				stage = "need-batch";
				message = `Need batch budget ${processedNeeds}/${maximumNeeds}`;
				break;
			}
			processedNeeds += 1;
			stage = "capability-inventory";
			trace(`assessing Capability inventory for Need: ${need.function}`);
			const assessed = await assessCapabilityInventoryWithSdk({
				request,
				workCaseId: judgment.workCase.workCaseId,
				judgmentId: judgment.judgment.judgmentId,
				contributionNeedId: need.contributionNeedId,
				contributionNeed: need.function,
				capabilities,
				runner: runtime.runner,
			});
			trace(`Capability inventory stage: ${assessed.status}`);
			if ("decision" in assessed && assessed.decision !== undefined) {
				decisions.push({
					stage: `capability-inventory:${need.function}`,
					metrics: assessed.decision,
				});
			}
			if (assessed.status !== "assessed") {
				if (assessed.status === "runtime-failure") {
					outcome = "provider-blocked";
					message = assessed.message;
				} else if (assessed.status === "bounded-stop") {
					outcome = "bounded-stop";
					message = assessed.reason;
				} else {
					outcome = "invariant-failure";
					message = assessed.message;
				}
				break;
			}
			if (assessed.assignments.length === 0) {
				outcome = "context-incomplete";
				message = `No admitted Capability was assigned to Need: ${need.function}`;
				break;
			}
			for (const disposition of assessed.dispositions) {
				if (disposition.assignment === undefined) continue;
				if (processedContexts >= maximumContexts) {
					outcome = "bounded-stop";
					stage = "context-batch";
					message = `Context batch budget ${processedContexts}/${maximumContexts}`;
					break;
				}
				processedContexts += 1;
				selectedTargets.add(disposition.name);
				const capability = capabilities.find(
					({ name }) => name === disposition.name,
				);
				if (capability === undefined) {
					outcome = "invariant-failure";
					message = `Accepted Capability disappeared: ${disposition.name}`;
					break;
				}
				stage = `context:${disposition.name}`;
				trace(`sealing Context: ${disposition.name}`);
				const sealed = await sealCapabilityContextWithSdk({
					request,
					entry: capability.entry,
					assignment: disposition.assignment,
					runner: runtime.runner,
				});
				trace(`Context stage ${disposition.name}: ${sealed.status}`);
				for (const decision of sealed.decisions) {
					decisions.push({
						stage: `${stage}:${decision.stage}`,
						metrics: decision.metrics,
					});
				}
				let selectedPaths: readonly string[] = [];
				if (sealed.status === "sealed") {
					selectedPaths = sealed.context.selectedPaths;
				} else if (sealed.status === "needs-context") {
					selectedPaths = sealed.selection.selectedPaths;
				}
				contexts.push({
					need: need.function,
					capability: disposition.name,
					status: sealed.status,
					selectedPaths,
				});
				if (sealed.status !== "sealed") {
					if (sealed.status === "runtime-failure") {
						outcome = "provider-blocked";
					} else if (sealed.status === "bounded-stop") {
						outcome = "bounded-stop";
					} else if (sealed.status === "needs-context") {
						outcome = "held";
					} else {
						outcome = "invariant-failure";
					}
					message = "message" in sealed ? sealed.message : sealed.status;
					break;
				}
			}
			if (outcome !== "context-ready") break;
		}
	}
}

const artifact = {
	protocol: "developer-sdk-context-pipeline/v1",
	piVersion: runtime.piVersion,
	model: runtime.modelSpec,
	outcome,
	stage,
	...(message ? { message } : {}),
	selectedTargets: [...selectedTargets].sort((left, right) =>
		left.localeCompare(right),
	),
	contexts,
	processedNeeds,
	processedContexts,
	budgets: { maximumNeeds, maximumContexts },
	decisions,
	wallTimeMs: Date.now() - traceStartedAt,
	...decisionTotals(decisions),
};
process.stdout.write(`${JSON.stringify(artifact)}\n`);
if (process.env.DEVELOPER_EVAL_MODE === "sdk") {
	process.stdout.write(
		`DEVELOPER_EVAL_RESULT ${JSON.stringify({
			fixtureId: process.env.DEVELOPER_EVAL_FIXTURE ?? "sdk-context",
			structuralValid: outcome !== "invariant-failure",
			trialOutcome: outcome,
			firstTarget: artifact.selectedTargets[0] ?? "none",
			selectedTargets: artifact.selectedTargets,
			wallTimeMs: artifact.wallTimeMs,
			...decisionTotals(decisions),
			model: runtime.modelSpec,
			piVersion: runtime.piVersion,
		})}\n`,
	);
}
if (outcome === "invariant-failure") process.exitCode = 1;
