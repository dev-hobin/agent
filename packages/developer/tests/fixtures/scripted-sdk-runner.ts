import type {
	SdkDecisionMetrics,
	SdkDecisionRequest,
	SdkDecisionResult,
	SdkDecisionRunner,
} from "../../src/action-loop/sdk/decision-controller.ts";

export interface ScriptedSdkDecision {
	readonly proposals?: readonly unknown[];
	readonly result?: "bounded-stop" | "time-budget" | "runtime-failure";
}

export function scriptedDecisionMetrics(
	input: {
		readonly toolCalls?: number;
		readonly toolErrors?: number;
		readonly runtimeFailures?: number;
	} = {},
): SdkDecisionMetrics {
	return {
		runs: 1,
		toolCalls: input.toolCalls ?? 0,
		toolErrors: input.toolErrors ?? 0,
		runtimeFailures: input.runtimeFailures ?? 0,
		timeBudgetStops: 0,
		errorMessages: [],
	};
}

export function scriptedSdkRunner(
	scripts: readonly ScriptedSdkDecision[],
): SdkDecisionRunner {
	let next = 0;
	return {
		async run<T>(
			request: SdkDecisionRequest<T>,
		): Promise<SdkDecisionResult<T>> {
			const script = scripts[next];
			next += 1;
			if (script?.result === "runtime-failure") {
				return {
					status: "runtime-failure",
					message: "provider unavailable",
					metrics: scriptedDecisionMetrics({ runtimeFailures: 1 }),
				};
			}
			if (
				script?.result === "bounded-stop" ||
				script?.result === "time-budget"
			) {
				return {
					status: "bounded-stop",
					reason:
						script.result === "time-budget"
							? "decision-time-budget"
							: "decision-run-budget",
					metrics: scriptedDecisionMetrics(),
				};
			}

			let toolCalls = 0;
			let toolErrors = 0;
			for (const proposal of script?.proposals ?? []) {
				toolCalls += 1;
				const admission = await request.tool.execute(proposal);
				if (admission.status === "rejected") {
					toolErrors += 1;
					continue;
				}
				return {
					status: "accepted",
					value: admission.value,
					metrics: scriptedDecisionMetrics({ toolCalls, toolErrors }),
				};
			}
			return {
				status: "bounded-stop",
				reason: "decision-run-budget",
				metrics: scriptedDecisionMetrics({ toolCalls, toolErrors }),
			};
		},
	};
}
