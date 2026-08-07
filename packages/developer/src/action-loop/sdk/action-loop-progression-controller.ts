import type { SdkNamedCapability } from "./capability-inventory-controller.ts";
import type { SdkDecisionRunner } from "./decision-controller.ts";
import {
	openJudgmentWithSdk,
	type SdkJudgmentOpeningResult,
} from "./judgment-controller.ts";
import {
	progressJudgmentWithSdk,
	type SdkJudgmentCheckpoint,
	type SdkJudgmentProgressionResult,
	type SdkJudgmentProgressState,
} from "./judgment-progression-controller.ts";
import {
	openWorkCaseWithSdk,
	type SdkWorkCaseOpeningResult,
} from "./work-case-controller.ts";

export type SdkActionLoopProgressionStage =
	| "work-case"
	| "judgment"
	| "inventory"
	| "context"
	| "contribution"
	| "coverage"
	| "conclusion";

export type SdkActionLoopCheckpoint =
	| {
			readonly kind: "work-case-opened";
			readonly result: Extract<
				SdkWorkCaseOpeningResult,
				{ readonly status: "opened" }
			>;
	  }
	| {
			readonly kind: "judgment-opened";
			readonly result: Extract<
				SdkJudgmentOpeningResult,
				{ readonly status: "opened" | "unchanged" }
			>;
	  }
	| SdkJudgmentCheckpoint;

interface ProgressResultBase {
	readonly state?: SdkJudgmentProgressState;
	readonly steps: number;
	readonly checkpoints: number;
}

export type SdkActionLoopProgressionResult =
	| (ProgressResultBase & {
			readonly status: "ready-for-action";
			readonly conclusionIds: readonly string[];
	  })
	| (ProgressResultBase & {
			readonly status: "judgment-concluded";
			readonly conclusionId: string;
	  })
	| (ProgressResultBase & {
			readonly status: "needs-context";
			readonly assignmentId: string;
	  })
	| (ProgressResultBase & {
			readonly status: "judgment-refused";
			readonly refusal: Extract<
				SdkJudgmentProgressionResult,
				{ readonly status: "refused" }
			>["refusal"];
	  })
	| (ProgressResultBase & {
			readonly status: "bounded-stop";
			readonly stage: SdkActionLoopProgressionStage;
			readonly reason: string;
	  })
	| (ProgressResultBase & {
			readonly status: "runtime-failure";
			readonly stage: SdkActionLoopProgressionStage;
			readonly message: string;
	  })
	| (ProgressResultBase & {
			readonly status: "invariant-failure";
			readonly stage: SdkActionLoopProgressionStage;
			readonly code: string;
			readonly message: string;
	  })
	| (ProgressResultBase & {
			readonly status: "checkpoint-failure";
			readonly stage: SdkActionLoopProgressionStage;
			readonly message: string;
			readonly pendingCheckpoint: SdkActionLoopCheckpoint;
	  });

export interface SdkActionLoopProgressionInput {
	readonly request: string;
	readonly state?: SdkJudgmentProgressState;
	readonly capabilities: readonly SdkNamedCapability[];
	readonly runner: SdkDecisionRunner;
	readonly maxSteps: number;
	readonly checkpoint: (
		checkpoint: SdkActionLoopCheckpoint,
	) => Promise<void> | void;
}

function positiveInteger(value: number, label: string): number {
	if (!Number.isSafeInteger(value) || value <= 0) {
		throw new Error(`${label} must be a positive safe integer.`);
	}
	return value;
}

function compactError(error: unknown): string {
	return (error instanceof Error ? error.message : String(error)).slice(
		0,
		2_048,
	);
}

function emptyProgressState(
	result: Extract<SdkWorkCaseOpeningResult, { readonly status: "opened" }>,
): SdkJudgmentProgressState {
	return Object.freeze({
		workCase: result.workCase,
		applicabilityAssessments: Object.freeze([]),
		assignments: Object.freeze([]),
		selections: Object.freeze([]),
		contexts: Object.freeze([]),
		contributions: Object.freeze([]),
		coverages: Object.freeze([]),
	});
}

function withJudgment(
	state: SdkJudgmentProgressState,
	result: Extract<
		SdkJudgmentOpeningResult,
		{ readonly status: "opened" | "unchanged" }
	>,
): SdkJudgmentProgressState {
	return Object.freeze({ ...state, workCase: result.workCase });
}

function mapJudgmentResult(
	result: SdkJudgmentProgressionResult,
	baseSteps: number,
	baseCheckpoints: number,
): SdkActionLoopProgressionResult {
	const common = {
		state: result.state,
		steps: baseSteps + result.steps,
		checkpoints: baseCheckpoints + result.checkpoints,
	};
	switch (result.status) {
		case "concluded":
			return {
				...common,
				status: "judgment-concluded",
				conclusionId: result.conclusionId,
			};
		case "needs-context":
			return {
				...common,
				status: "needs-context",
				assignmentId: result.assignmentId,
			};
		case "refused":
			return {
				...common,
				status: "judgment-refused",
				refusal: result.refusal,
			};
		case "bounded-stop":
			return { ...common, status: result.status, stage: result.stage, reason: result.reason };
		case "runtime-failure":
			return { ...common, status: result.status, stage: result.stage, message: result.message };
		case "invariant-failure":
			return {
				...common,
				status: result.status,
				stage: result.stage,
				code: result.code,
				message: result.message,
			};
		case "checkpoint-failure":
			return {
				...common,
				status: result.status,
				stage: result.stage,
				message: result.message,
				pendingCheckpoint: result.pendingCheckpoint,
			};
		default:
			return result satisfies never;
	}
}

/**
 * Opens missing canonical ownership and then progresses one upper Judgment.
 * Every accepted opening or Judgment transition is acknowledged before the
 * controller mutates its resumable projection or begins dependent work.
 */
export async function progressActionLoopWithSdk(
	input: SdkActionLoopProgressionInput,
): Promise<SdkActionLoopProgressionResult> {
	const maxSteps = positiveInteger(input.maxSteps, "maxSteps");
	let state = input.state;
	let steps = 0;
	let checkpoints = 0;

	if (!state) {
		const opened = await openWorkCaseWithSdk({
			request: input.request,
			runner: input.runner,
		});
		steps += 1;
		if (opened.status === "bounded-stop") {
			return {
				status: "bounded-stop",
				stage: "work-case",
				reason: opened.reason,
				steps,
				checkpoints,
			};
		}
		if (opened.status === "runtime-failure") {
			return {
				status: "runtime-failure",
				stage: "work-case",
				message: opened.message,
				steps,
				checkpoints,
			};
		}
		const checkpoint: SdkActionLoopCheckpoint = {
			kind: "work-case-opened",
			result: opened,
		};
		try {
			await input.checkpoint(checkpoint);
		} catch (error) {
			return {
				status: "checkpoint-failure",
				stage: "work-case",
				message: compactError(error),
				pendingCheckpoint: checkpoint,
				steps,
				checkpoints,
			};
		}
		state = emptyProgressState(opened);
		checkpoints += 1;
	}

	if (
		state.workCase.openJudgments.length === 0 &&
		state.workCase.conclusions.length > 0
	) {
		return {
			status: "ready-for-action",
			conclusionIds: state.workCase.conclusions.map(
				(conclusion) => conclusion.conclusionId,
			),
			state,
			steps,
			checkpoints,
		};
	}
	if (state.workCase.openJudgments.length > 1) {
		return {
			status: "invariant-failure",
			stage: "judgment",
			code: "multiple-open-judgments",
			message: "SDK progression requires at most one open Judgment.",
			state,
			steps,
			checkpoints,
		};
	}
	if (state.workCase.openJudgments.length === 0) {
		if (steps >= maxSteps) {
			return {
				status: "bounded-stop",
				stage: "judgment",
				reason: "progression-step-budget",
				state,
				steps,
				checkpoints,
			};
		}
		const opened = await openJudgmentWithSdk({
			request: input.request,
			workCase: state.workCase,
			contextRevisionId: state.workCase.revisionId,
			runner: input.runner,
		});
		steps += 1;
		if (opened.status === "active-judgment-exists") {
			return {
				status: "invariant-failure",
				stage: "judgment",
				code: "active-judgment-exists",
				message: "Judgment opening raced with another current Judgment.",
				state,
				steps,
				checkpoints,
			};
		}
		if (opened.status === "bounded-stop") {
			return {
				status: "bounded-stop",
				stage: "judgment",
				reason: opened.reason,
				state,
				steps,
				checkpoints,
			};
		}
		if (opened.status === "runtime-failure") {
			return {
				status: "runtime-failure",
				stage: "judgment",
				message: opened.message,
				state,
				steps,
				checkpoints,
			};
		}
		const checkpoint: SdkActionLoopCheckpoint = {
			kind: "judgment-opened",
			result: opened,
		};
		try {
			await input.checkpoint(checkpoint);
		} catch (error) {
			return {
				status: "checkpoint-failure",
				stage: "judgment",
				message: compactError(error),
				pendingCheckpoint: checkpoint,
				state,
				steps,
				checkpoints,
			};
		}
		state = withJudgment(state, opened);
		checkpoints += 1;
	}

	if (steps >= maxSteps) {
		return {
			status: "bounded-stop",
			stage: "inventory",
			reason: "progression-step-budget",
			state,
			steps,
			checkpoints,
		};
	}
	const progressed = await progressJudgmentWithSdk({
		request: input.request,
		state,
		capabilities: input.capabilities,
		runner: input.runner,
		maxSteps: maxSteps - steps,
		checkpoint: input.checkpoint,
	});
	return mapJudgmentResult(progressed, steps, checkpoints);
}
