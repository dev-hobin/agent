import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { createSdkEvalRuntime } from "./sdk-eval-runtime.ts";

const packageRoot = resolve(
	process.env.DEVELOPER_EVAL_PACKAGE_PATH ??
		new URL("..", import.meta.url).pathname,
);
const sdk = (await import(
	pathToFileURL(resolve(packageRoot, "dist", "sdk.mjs")).href
)) as {
	resolveEffectRemediationWithSdk(input: unknown): Promise<{
		readonly status: string;
		readonly remediation?: {
			readonly adverseEffectId: string;
			readonly remediationEffectId: string;
		};
		readonly refusalReasons?: readonly string[];
		readonly reason?: string;
		readonly message?: string;
		readonly decision?: unknown;
	}>;
};
const runtime = await createSdkEvalRuntime(packageRoot);
const startedAt = Date.now();
const fixture = process.env.DEVELOPER_SDK_REMEDIATION_CASE || "bind";
if (fixture !== "bind" && fixture !== "refusal") {
	throw new Error("DEVELOPER_SDK_REMEDIATION_CASE must be bind or refusal.");
}
const workCaseId = "work-sdk-live-remediation";
const settlement = (
	effectId: string,
	outcome: "partially-applied" | "observed-success",
	basis: string,
) =>
	Object.freeze({
		effectSettlementId: `settlement-${effectId}`,
		workCaseId,
		effectId,
		actionClearanceId: `clearance-${effectId}`,
		occurrenceId: `occurrence-${effectId}`,
		outcome,
		observationDispositions: Object.freeze([]),
		intendedEffectDispositions: Object.freeze([]),
		basis: Object.freeze([basis]),
		provenance: Object.freeze({ kind: "model", source: "sdk:eval" }),
	});
const adverse = settlement(
	"effect-partial-config",
	"partially-applied",
	"The first controlled write updated only part of the bounded configuration and left the accepted state incomplete.",
);
const successful = settlement(
	fixture === "bind" ? "effect-repair-config" : "effect-unrelated-report",
	"observed-success",
	fixture === "bind"
		? "The later bounded repair restored the exact configuration left partial by the first write, and current verification observes the accepted final state."
		: "The later successful Effect generated an unrelated diagnostic report and did not change or verify the partially applied configuration.",
);
const result = await sdk.resolveEffectRemediationWithSdk({
	request:
		fixture === "bind"
			? "Preserve the partially applied Effect history and bind it to the distinct successful repair only when current evidence supports that exact relation."
			: "Do not claim that an unrelated successful report repairs the partially applied configuration. Refuse the remediation relation when current evidence does not support it.",
	workCaseId,
	adverseSettlements: [adverse],
	successfulSettlements: [successful],
	runner: runtime.runner,
});
const artifact = {
	protocol: "developer-sdk-remediation-eval/v1",
	piVersion: runtime.piVersion,
	model: runtime.modelSpec,
	packageRoot,
	fixture,
	status: result.status,
	...(result.status === "remediated" && result.remediation
		? {
				adverseEffectId: result.remediation.adverseEffectId,
				remediationEffectId: result.remediation.remediationEffectId,
			}
		: {}),
	...(result.refusalReasons ? { refusalReasons: result.refusalReasons } : {}),
	...("reason" in result && result.reason ? { reason: result.reason } : {}),
	...("message" in result && result.message ? { message: result.message } : {}),
	...(result.decision ? { decision: result.decision } : {}),
	wallTimeMs: Date.now() - startedAt,
};
process.stdout.write(`${JSON.stringify(artifact)}\n`);
if (fixture === "bind" && result.status !== "remediated") {
	process.exitCode = result.status === "invariant-failure" ? 1 : 2;
}
if (fixture === "refusal" && result.status !== "refused") {
	process.exitCode = result.status === "invariant-failure" ? 1 : 2;
}
if (result.status === "invariant-failure") process.exitCode = 1;
