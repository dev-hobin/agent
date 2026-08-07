import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { createSdkEvalRuntime } from "./sdk-eval-runtime.ts";

const packageRoot = resolve(
	process.env.DEVELOPER_EVAL_PACKAGE_PATH ?? new URL("..", import.meta.url).pathname,
);
const sdk = (await import(
	pathToFileURL(resolve(packageRoot, "dist", "sdk.mjs")).href
)) as {
	concludeJudgmentWithSdk(input: unknown): Promise<{
		readonly status: string;
		readonly conclusion?: {
			readonly interventionDisposition?: "action-required" | "no-action";
		};
		readonly reason?: string;
		readonly message?: string;
		readonly decision?: unknown;
	}>;
};
const runtime = await createSdkEvalRuntime(packageRoot);
const startedAt = Date.now();
const fixture = process.env.DEVELOPER_SDK_INTERVENTION_CASE || "no-action";
if (fixture !== "no-action" && fixture !== "refusal") {
	throw new Error(
		"DEVELOPER_SDK_INTERVENTION_CASE must be no-action or refusal.",
	);
}
const request =
	process.env.DEVELOPER_SDK_REQUEST ??
	(fixture === "no-action"
		? "Do not modify files. The requested analysis is already complete and the current workspace must remain unchanged. Decide whether any host Action is proportionate; current evidence supports no Action."
		: "Do not modify files. Current evidence does not establish whether any host Action is proportionate. Refuse the Proportionate Intervention Conclusion and preserve the missing-evidence blocker.");
const workCaseId = "work-sdk-live-intervention";
const judgmentId = "judgment-sdk-live-intervention";
const contributionNeedId = "need-sdk-live-intervention";
const coverage = Object.freeze({
	coverageId: "coverage-sdk-live-intervention",
	workCaseId,
	judgmentId,
	contributionNeedId,
	status: fixture === "no-action" ? ("covered" as const) : ("missing" as const),
	dispositions: Object.freeze([]),
	conflicts: Object.freeze([]),
	basis: Object.freeze([
		fixture === "no-action"
			? "The delegated request explicitly forbids mutation and states that current evidence supports preserving workspace state."
			: "No current Contribution establishes whether an intervention is warranted.",
	]),
	provenance: Object.freeze({ kind: "human" as const, source: "sdk:eval" }),
});
const result = await sdk.concludeJudgmentWithSdk({
	request,
	contract: {
		workCaseId,
		judgmentId,
		category: "Proportionate Intervention",
		subject: "Whether any controlled host Action is warranted",
		contextRevisionId: "context-sdk-live-intervention",
		requirements: [
			{
				requirementId: "requirement-sdk-live-intervention",
				statement:
					"The proportionate action or no-action decision preserves the explicit no-mutation constraint.",
				contributionNeedIds: [contributionNeedId],
			},
		],
	},
	coverages: [coverage],
	runner: runtime.runner,
});
const artifact = {
	protocol: "developer-sdk-intervention-eval/v1",
	piVersion: runtime.piVersion,
	model: runtime.modelSpec,
	packageRoot,
	fixture,
	status: result.status,
	...(result.status === "concluded" && result.conclusion
		? { interventionDisposition: result.conclusion.interventionDisposition }
		: {}),
	...("reason" in result && result.reason ? { reason: result.reason } : {}),
	...("message" in result && result.message ? { message: result.message } : {}),
	...(result.decision ? { decision: result.decision } : {}),
	wallTimeMs: Date.now() - startedAt,
};
process.stdout.write(`${JSON.stringify(artifact)}\n`);
if (
	fixture === "no-action" &&
	result.status === "concluded" &&
	result.conclusion?.interventionDisposition !== "no-action"
) {
	process.exitCode = 2;
}
if (fixture === "refusal" && result.status !== "refused") {
	process.exitCode = result.status === "invariant-failure" ? 1 : 2;
}
if (result.status === "invariant-failure") process.exitCode = 1;
