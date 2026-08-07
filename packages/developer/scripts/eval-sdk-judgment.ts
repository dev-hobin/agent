import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { bindUnstructuredCapability } from "../src/action-loop/routing/bind-capability.ts";
import { acceptCapabilityApplicability } from "../src/action-loop/routing/accept-applicability.ts";
import { sealUnstructuredSkillContext } from "../src/action-loop/io/seal-skill-context.ts";
import { concludeJudgmentWithSdk } from "../src/action-loop/sdk/conclusion-controller.ts";
import { contributeSkillWithSdk } from "../src/action-loop/sdk/contribution-controller.ts";
import { assessNeedCoverageWithSdk } from "../src/action-loop/sdk/coverage-controller.ts";
import type { SdkDecisionMetrics } from "../src/action-loop/sdk/decision-controller.ts";
import { createSdkEvalRuntime } from "./sdk-eval-runtime.ts";

const packageRoot = new URL("..", import.meta.url).pathname;
const request =
	process.env.DEVELOPER_SDK_REQUEST ??
	"Design a retry-safe approval rule that preserves the first terminal decision and treats later stale responses as observations. Do not modify files.";
const contributionNeed =
	"A source-bound analysis of retry, identity, and terminal-state behavior";
const startedAt = Date.now();

interface DecisionObservation {
	readonly stage: string;
	readonly metrics: SdkDecisionMetrics;
}

function totals(decisions: readonly DecisionObservation[]) {
	return {
		toolCallAttemptCount: decisions.reduce(
			(total, decision) => total + decision.metrics.toolCalls,
			0,
		),
		toolErrorCount: decisions.reduce(
			(total, decision) => total + decision.metrics.toolErrors,
			0,
		),
		controllerDecisionCount: decisions.length,
		timeBudgetStopCount: decisions.reduce(
			(total, decision) => total + decision.metrics.timeBudgetStops,
			0,
		),
	};
}

const runtime = await createSdkEvalRuntime(packageRoot);
const decisions: DecisionObservation[] = [];
let outcome = "concluded";
let stage = "contribution";
let message: string | undefined;
let contributionStatus: string | undefined;
let coverageStatus: string | undefined;
let conclusionStatus: string | undefined;
const fixtureRoot = await mkdtemp(join(tmpdir(), "developer-sdk-judgment-"));

try {
	const skillPath = join(fixtureRoot, "SKILL.md");
	const skillContent = [
		"---",
		"name: retry-terminal-analysis",
		"description: Analyze retry-safe terminal decisions.",
		"---",
		"# Retry-safe terminal decisions",
		"Treat request identity, attempt identity, and terminal decision identity separately.",
		"The first accepted terminal decision is monotonic. Later duplicate or stale responses remain observations and cannot replace it.",
		"State assumptions, counterexamples, and verification targets explicitly.",
	].join("\n");
	await writeFile(skillPath, skillContent, "utf8");
	const source = {
		kind: "cli" as const,
		locator: pathToFileURL(skillPath).href,
		skillRoot: ".",
	};
	const capability = bindUnstructuredCapability(
		source,
		new TextEncoder().encode(skillContent),
	);
	if (!capability.ok) throw new Error(capability.error.message);
	const applicability = acceptCapabilityApplicability(
		{
			workCaseId: "work-sdk-live-judgment",
			judgmentId: "judgment-sdk-live-judgment",
			contributionNeedId: "need-sdk-live-judgment",
			capability: capability.value,
		},
		{
			workCaseId: "work-sdk-live-judgment",
			judgmentId: "judgment-sdk-live-judgment",
			contributionNeedId: "need-sdk-live-judgment",
			capabilityRevisionId: capability.value.capabilityRevisionId,
			status: "applicable",
			matchedWhen: [],
			matchedUnless: [],
			basis: ["The direct method addresses retry-safe terminal behavior."],
			missingContext: [],
		},
	);
	if (applicability.status !== "assigned") {
		throw new Error(
			applicability.status === "invalid"
				? applicability.error.message
				: "Capability was not assigned",
		);
	}
	const sealed = await sealUnstructuredSkillContext({
		skillFilePath: skillPath,
		capability: capability.value,
		assignment: applicability.assignment,
	});
	if (!sealed.ok) throw new Error(sealed.error.message);

	const contribution = await contributeSkillWithSdk({
		request,
		contributionNeed,
		assignment: applicability.assignment,
		context: sealed.value,
		runner: runtime.runner,
	});
	contributionStatus = contribution.status;
	if ("decision" in contribution) {
		decisions.push({ stage: "contribution", metrics: contribution.decision });
	}
	if (contribution.status !== "accepted") {
		if (contribution.status === "bounded-stop") {
			outcome = contribution.status;
			message = contribution.reason;
		} else if (contribution.status === "runtime-failure") {
			outcome = "provider-blocked";
			message = contribution.message;
		} else {
			outcome = contribution.status;
			message = contribution.message;
		}
	} else {
		stage = "coverage";
		const coverage = await assessNeedCoverageWithSdk({
			request,
			contributionNeed,
			target: {
				workCaseId: applicability.assignment.workCaseId,
				judgmentId: applicability.assignment.judgmentId,
				contributionNeedId: applicability.assignment.contributionNeedId,
			},
			contributions: [contribution.contribution],
			runner: runtime.runner,
		});
		coverageStatus = coverage.status;
		if ("decision" in coverage) {
			decisions.push({ stage: "coverage", metrics: coverage.decision });
		}
		if (coverage.status !== "assessed") {
			if (coverage.status === "bounded-stop") {
				outcome = coverage.status;
				message = coverage.reason;
			} else if (coverage.status === "runtime-failure") {
				outcome = "provider-blocked";
				message = coverage.message;
			} else {
				outcome = coverage.status;
				message = coverage.message;
			}
		} else {
			stage = "conclusion";
			const conclusion = await concludeJudgmentWithSdk({
				request,
				contract: {
					workCaseId: applicability.assignment.workCaseId,
					judgmentId: applicability.assignment.judgmentId,
					category: "Consequence Integrity",
					subject: "Retry-safe terminal approval behavior",
					contextRevisionId: "context-sdk-live-judgment",
					requirements: [
						{
							requirementId: "requirement-sdk-live-judgment",
							statement:
								"The terminal decision remains monotonic across duplicate, stale, and reordered responses.",
							contributionNeedIds: [
								applicability.assignment.contributionNeedId,
							],
						},
					],
				},
				coverages: [coverage.coverage],
				runner: runtime.runner,
			});
			conclusionStatus = conclusion.status;
			if ("decision" in conclusion) {
				decisions.push({ stage: "conclusion", metrics: conclusion.decision });
			}
			if (conclusion.status !== "concluded") {
				if (conclusion.status === "bounded-stop") {
					outcome = conclusion.status;
					message = conclusion.reason;
				} else if (conclusion.status === "runtime-failure") {
					outcome = "provider-blocked";
					message = conclusion.message;
				} else if (conclusion.status === "invariant-failure") {
					outcome = conclusion.status;
					message = conclusion.message;
				} else {
					outcome = conclusion.status;
					message = "Canonical Judgment closure refusal.";
				}
			}
		}
	}
} finally {
	await rm(fixtureRoot, { recursive: true, force: true });
}

const artifact = {
	protocol: "developer-sdk-judgment-pipeline/v1",
	piVersion: runtime.piVersion,
	model: runtime.modelSpec,
	outcome,
	stage,
	...(message ? { message } : {}),
	contributionStatus,
	coverageStatus,
	conclusionStatus,
	decisions,
	wallTimeMs: Date.now() - startedAt,
	...totals(decisions),
};
process.stdout.write(`${JSON.stringify(artifact)}\n`);
if (outcome === "invariant-failure") process.exitCode = 1;
