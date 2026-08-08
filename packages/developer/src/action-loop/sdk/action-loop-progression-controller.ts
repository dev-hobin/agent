import type { PermissionDecision } from "../action/action-clearance.ts";
import type { EffectObservation } from "../effect/effect-observation.ts";
import type { EffectSettlement } from "../effect/effect-settlement.ts";
import { recordWorkCaseActionCandidate } from "../work/record-work-case-action-candidate.ts";
import { recordWorkCaseActionClearance } from "../work/record-work-case-action-clearance.ts";
import { recordWorkCaseEffectAssessment } from "../work/record-work-case-effect-assessment.ts";
import { recordWorkCaseEffectRemediation } from "../work/record-work-case-effect-remediation.ts";
import {
	clearActionWithHostPermission,
	proposeActionWithSdk,
	type SdkActionCandidateResult,
	type SdkActionClearanceResult,
	type SdkControlledActionAdapter,
} from "./action-controller.ts";
import type { SdkNamedCapability } from "./capability-inventory-controller.ts";
import {
	completeWorkCaseWithSdk,
	type SdkWorkCaseCompletionResult,
} from "./completion-controller.ts";
import {
	settleEffectWithSdk,
	type SdkEffectSettlementResult,
} from "./effect-controller.ts";
import {
	resolveEffectRemediationWithSdk,
	type SdkEffectRemediationResult,
} from "./effect-remediation-controller.ts";
import type { SdkActionLoopState } from "./action-loop-state.ts";
import type { SdkDecisionRunner } from "./decision-controller.ts";
import {
	openJudgmentWithSdk,
	type SdkJudgmentCategory,
	type SdkJudgmentOpeningResult,
} from "./judgment-controller.ts";
import {
	progressJudgmentWithSdk,
	type SdkJudgmentCheckpoint,
	type SdkJudgmentProgressionResult,
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
	| "conclusion"
	| "action"
	| "effect"
	| "remediation"
	| "completion";

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
	| {
			readonly kind: "work-case-completed";
			readonly result: Extract<
				SdkWorkCaseCompletionResult,
				{ readonly status: "completed" }
			>;
	  }
	| {
			readonly kind: "effect-settled";
			readonly result: Extract<
				SdkEffectSettlementResult,
				{ readonly status: "settled" | "unsettled" }
			>;
			readonly expectedCurrentAssessmentId?: string;
			readonly workCase: SdkActionLoopState["workCase"];
	  }
	| {
			readonly kind: "effect-remediated";
			readonly result: Extract<
				SdkEffectRemediationResult,
				{ readonly status: "remediated" }
			>;
			readonly workCase: SdkActionLoopState["workCase"];
	  }
	| {
			readonly kind: "action-cleared";
			readonly action: Extract<
				SdkActionCandidateResult,
				{ readonly status: "accepted" }
			>;
			readonly clearance: Extract<
				SdkActionClearanceResult,
				{ readonly status: "cleared" }
			>;
			readonly workCase: SdkActionLoopState["workCase"];
	  }
	| SdkJudgmentCheckpoint;

interface ProgressResultBase {
	readonly state?: SdkActionLoopState;
	readonly steps: number;
	readonly checkpoints: number;
}

export type SdkActionLoopProgressionResult =
	| (ProgressResultBase & {
			readonly status: "ready-for-action";
			readonly conclusionIds: readonly string[];
	  })
	| (ProgressResultBase & {
			readonly status: "ready-for-host-action";
			readonly actionCandidateId: string;
			readonly actionClearanceId: string;
			readonly toolName?: string;
			readonly toolInput?: Readonly<Record<string, unknown>>;
	  })
	| (ProgressResultBase & {
			readonly status: "effect-pending";
			readonly effectIds: readonly string[];
	  })
	| (ProgressResultBase & {
			readonly status: "effect-settled";
			readonly outcome: string;
	  })
	| (ProgressResultBase & {
			readonly status: "effect-unsettled";
			readonly outcome: string;
	  })
	| (ProgressResultBase & {
			readonly status: "effect-remediated";
			readonly adverseEffectId: string;
			readonly remediationEffectId: string;
	  })
	| (ProgressResultBase & {
			readonly status: "remediation-required";
			readonly adverseEffectIds: readonly string[];
			readonly refusalReasons?: readonly string[];
	  })
	| (ProgressResultBase & {
			readonly status: "ready-for-completion";
			readonly effectAssessmentIds: readonly string[];
	  })
	| (ProgressResultBase & {
			readonly status: "completion-not-ready";
			readonly blockerCodes: readonly string[];
	  })
	| (ProgressResultBase & {
			readonly status: "completed";
			readonly completedWorkCase: Extract<
				SdkWorkCaseCompletionResult,
				{ readonly status: "completed" }
			>["workCase"];
	  })
	| (ProgressResultBase & {
			readonly status: "action-not-cleared";
			readonly blockerCodes: readonly string[];
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
	readonly state?: SdkActionLoopState;
	readonly capabilities: readonly SdkNamedCapability[];
	readonly effectObservations?: readonly EffectObservation[];
	readonly complete?: boolean;
	readonly actions?: readonly SdkControlledActionAdapter[];
	readonly authorizeAction?: (
		action: Extract<SdkActionCandidateResult, { readonly status: "accepted" }>,
	) => Promise<PermissionDecision> | PermissionDecision;
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
): SdkActionLoopState {
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
	state: SdkActionLoopState,
	result: Extract<
		SdkJudgmentOpeningResult,
		{ readonly status: "opened" | "unchanged" }
	>,
): SdkActionLoopState {
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
			return {
				...common,
				status: result.status,
				stage: result.stage,
				reason: result.reason,
			};
		case "runtime-failure":
			return {
				...common,
				status: result.status,
				stage: result.stage,
				message: result.message,
			};
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

function currentAssessmentId(
	assessment: SdkActionLoopState["workCase"]["currentEffectAssessments"][number],
): string {
	return "effectSettlementId" in assessment
		? assessment.effectSettlementId
		: assessment.effectAssessmentId;
}

function currentEffectSettlements(
	state: SdkActionLoopState,
): readonly EffectSettlement[] {
	return state.workCase.currentEffectAssessments.flatMap((assessment) =>
		"effectSettlementId" in assessment ? [assessment] : [],
	);
}

function unresolvedAdverseSettlements(
	state: SdkActionLoopState,
): readonly EffectSettlement[] {
	const remediated = new Set(
		state.workCase.effectRemediations.map(
			({ adverseEffectId }) => adverseEffectId,
		),
	);
	return currentEffectSettlements(state).filter(
		(settlement) =>
			(settlement.outcome === "failed" ||
				settlement.outcome === "partially-applied") &&
			!remediated.has(settlement.effectId),
	);
}

function successfulEffectSettlements(
	state: SdkActionLoopState,
): readonly EffectSettlement[] {
	return currentEffectSettlements(state).filter(
		({ outcome }) => outcome === "observed-success",
	);
}

function consumedConclusionIds(state: SdkActionLoopState): ReadonlySet<string> {
	return new Set(
		state.workCase.actionCandidates.flatMap(
			({ requiredConclusionIds }) => requiredConclusionIds,
		),
	);
}

function pendingRemediationIntervention(
	state: SdkActionLoopState,
): SdkActionLoopState["workCase"]["conclusions"][number] | undefined {
	const consumed = consumedConclusionIds(state);
	return state.workCase.conclusions.find(
		(conclusion) =>
			conclusion.category === "Proportionate Intervention" &&
			!consumed.has(conclusion.conclusionId),
	);
}

async function progressCompletion(input: {
	readonly request: string;
	readonly state: SdkActionLoopState;
	readonly runner: SdkDecisionRunner;
	readonly checkpoint: SdkActionLoopProgressionInput["checkpoint"];
	readonly maxSteps: number;
	readonly steps: number;
	readonly checkpoints: number;
}): Promise<SdkActionLoopProgressionResult> {
	if (input.steps >= input.maxSteps) {
		return {
			status: "bounded-stop",
			stage: "completion",
			reason: "progression-step-budget",
			state: input.state,
			steps: input.steps,
			checkpoints: input.checkpoints,
		};
	}
	const result = await completeWorkCaseWithSdk({
		request: input.request,
		workCase: input.state.workCase,
		runner: input.runner,
	});
	const steps = input.steps + 1;
	if (result.status === "not-ready") {
		return {
			status: "completion-not-ready",
			blockerCodes: result.blockers.map((blocker) => blocker.code),
			state: input.state,
			steps,
			checkpoints: input.checkpoints,
		};
	}
	if (result.status === "bounded-stop") {
		return {
			status: "bounded-stop",
			stage: "completion",
			reason: result.reason,
			state: input.state,
			steps,
			checkpoints: input.checkpoints,
		};
	}
	if (result.status === "runtime-failure") {
		return {
			status: "runtime-failure",
			stage: "completion",
			message: result.message,
			state: input.state,
			steps,
			checkpoints: input.checkpoints,
		};
	}
	if (result.status === "invariant-failure") {
		return {
			status: "invariant-failure",
			stage: "completion",
			code: result.code,
			message: result.message,
			state: input.state,
			steps,
			checkpoints: input.checkpoints,
		};
	}
	const checkpoint: SdkActionLoopCheckpoint = {
		kind: "work-case-completed",
		result,
	};
	try {
		await input.checkpoint(checkpoint);
	} catch (error) {
		return {
			status: "checkpoint-failure",
			stage: "completion",
			message: compactError(error),
			pendingCheckpoint: checkpoint,
			state: input.state,
			steps,
			checkpoints: input.checkpoints,
		};
	}
	return {
		status: "completed",
		completedWorkCase: result.workCase,
		steps,
		checkpoints: input.checkpoints + 1,
	};
}

async function progressEffect(input: {
	readonly request: string;
	readonly state: SdkActionLoopState;
	readonly observations: readonly EffectObservation[];
	readonly runner: SdkDecisionRunner;
	readonly checkpoint: SdkActionLoopProgressionInput["checkpoint"];
	readonly maxSteps: number;
	readonly steps: number;
	readonly checkpoints: number;
}): Promise<SdkActionLoopProgressionResult> {
	const assessments = new Map(
		input.state.workCase.currentEffectAssessments.map((assessment) => [
			assessment.effectId,
			assessment,
		]),
	);
	const effect = input.state.workCase.effects.find((candidate) => {
		const current = assessments.get(candidate.effectId);
		if (!current) return true;
		if ("effectSettlementId" in current) return false;
		const accounted = new Set(
			current.observationDispositions.map(
				(disposition) => disposition.effectObservationId,
			),
		);
		return input.observations.some(
			(observation) =>
				observation.effectId === candidate.effectId &&
				!accounted.has(observation.effectObservationId),
		);
	});
	if (!effect) {
		const unsettled = input.state.workCase.currentEffectAssessments.find(
			(assessment) => "effectAssessmentId" in assessment,
		);
		if (unsettled) {
			return {
				status: "effect-unsettled",
				outcome: unsettled.outcome,
				state: input.state,
				steps: input.steps,
				checkpoints: input.checkpoints,
			};
		}
		return {
			status: "ready-for-completion",
			effectAssessmentIds:
				input.state.workCase.currentEffectAssessments.map(currentAssessmentId),
			state: input.state,
			steps: input.steps,
			checkpoints: input.checkpoints,
		};
	}
	const observations = input.observations.filter(
		(observation) => observation.effectId === effect.effectId,
	);
	if (observations.length === 0) {
		return {
			status: "effect-pending",
			effectIds: [effect.effectId],
			state: input.state,
			steps: input.steps,
			checkpoints: input.checkpoints,
		};
	}
	if (input.steps >= input.maxSteps) {
		return {
			status: "bounded-stop",
			stage: "effect",
			reason: "progression-step-budget",
			state: input.state,
			steps: input.steps,
			checkpoints: input.checkpoints,
		};
	}
	const result = await settleEffectWithSdk({
		request: input.request,
		effect,
		observations,
		runner: input.runner,
	});
	const steps = input.steps + 1;
	if (result.status === "bounded-stop") {
		return {
			status: "bounded-stop",
			stage: "effect",
			reason: result.reason,
			state: input.state,
			steps,
			checkpoints: input.checkpoints,
		};
	}
	if (result.status === "runtime-failure") {
		return {
			status: "runtime-failure",
			stage: "effect",
			message: result.message,
			state: input.state,
			steps,
			checkpoints: input.checkpoints,
		};
	}
	if (result.status === "invariant-failure") {
		return {
			status: "invariant-failure",
			stage: "effect",
			code: result.code,
			message: result.message,
			state: input.state,
			steps,
			checkpoints: input.checkpoints,
		};
	}
	const current = assessments.get(effect.effectId);
	const expectedCurrentAssessmentId = current
		? currentAssessmentId(current)
		: undefined;
	const assessment =
		result.status === "settled" ? result.settlement : result.assessment;
	const recorded = recordWorkCaseEffectAssessment(
		input.state.workCase,
		assessment,
		expectedCurrentAssessmentId ?? null,
	);
	if (recorded.status === "invalid") {
		return {
			status: "invariant-failure",
			stage: "effect",
			code: recorded.error.code,
			message: recorded.error.message,
			state: input.state,
			steps,
			checkpoints: input.checkpoints,
		};
	}
	const nextState = Object.freeze({
		...input.state,
		workCase: recorded.value,
	});
	const checkpoint: SdkActionLoopCheckpoint = {
		kind: "effect-settled",
		result,
		...(expectedCurrentAssessmentId ? { expectedCurrentAssessmentId } : {}),
		workCase: recorded.value,
	};
	try {
		await input.checkpoint(checkpoint);
	} catch (error) {
		return {
			status: "checkpoint-failure",
			stage: "effect",
			message: compactError(error),
			pendingCheckpoint: checkpoint,
			state: input.state,
			steps,
			checkpoints: input.checkpoints,
		};
	}
	return {
		status: result.status === "settled" ? "effect-settled" : "effect-unsettled",
		outcome: assessment.outcome,
		state: nextState,
		steps,
		checkpoints: input.checkpoints + 1,
	};
}

async function progressRemediation(input: {
	readonly request: string;
	readonly state: SdkActionLoopState;
	readonly adverseSettlements: readonly EffectSettlement[];
	readonly successfulSettlements: readonly EffectSettlement[];
	readonly runner: SdkDecisionRunner;
	readonly checkpoint: SdkActionLoopProgressionInput["checkpoint"];
	readonly maxSteps: number;
	readonly steps: number;
	readonly checkpoints: number;
}): Promise<SdkActionLoopProgressionResult> {
	if (input.steps >= input.maxSteps) {
		return {
			status: "bounded-stop",
			stage: "remediation",
			reason: "progression-step-budget",
			state: input.state,
			steps: input.steps,
			checkpoints: input.checkpoints,
		};
	}
	const result = await resolveEffectRemediationWithSdk({
		request: input.request,
		workCaseId: input.state.workCase.workCaseId,
		adverseSettlements: input.adverseSettlements,
		successfulSettlements: input.successfulSettlements,
		runner: input.runner,
	});
	const steps = input.steps + 1;
	if (result.status === "bounded-stop") {
		return {
			status: "bounded-stop",
			stage: "remediation",
			reason: result.reason,
			state: input.state,
			steps,
			checkpoints: input.checkpoints,
		};
	}
	if (result.status === "runtime-failure") {
		return {
			status: "runtime-failure",
			stage: "remediation",
			message: result.message,
			state: input.state,
			steps,
			checkpoints: input.checkpoints,
		};
	}
	if (result.status === "invariant-failure") {
		return {
			status: "invariant-failure",
			stage: "remediation",
			code: result.code,
			message: result.message,
			state: input.state,
			steps,
			checkpoints: input.checkpoints,
		};
	}
	if (result.status === "refused") {
		return {
			status: "remediation-required",
			adverseEffectIds: input.adverseSettlements.map(
				({ effectId }) => effectId,
			),
			refusalReasons: result.refusalReasons,
			state: input.state,
			steps,
			checkpoints: input.checkpoints,
		};
	}
	const recorded = recordWorkCaseEffectRemediation(
		input.state.workCase,
		result.remediation,
	);
	if (recorded.status === "invalid") {
		return {
			status: "invariant-failure",
			stage: "remediation",
			code: recorded.error.code,
			message: recorded.error.message,
			state: input.state,
			steps,
			checkpoints: input.checkpoints,
		};
	}
	const nextState = Object.freeze({
		...input.state,
		workCase: recorded.value,
	});
	const checkpoint: SdkActionLoopCheckpoint = {
		kind: "effect-remediated",
		result,
		workCase: recorded.value,
	};
	try {
		await input.checkpoint(checkpoint);
	} catch (error) {
		return {
			status: "checkpoint-failure",
			stage: "remediation",
			message: compactError(error),
			pendingCheckpoint: checkpoint,
			state: input.state,
			steps,
			checkpoints: input.checkpoints,
		};
	}
	return {
		status: "effect-remediated",
		adverseEffectId: result.remediation.adverseEffectId,
		remediationEffectId: result.remediation.remediationEffectId,
		state: nextState,
		steps,
		checkpoints: input.checkpoints + 1,
	};
}

function nextRequiredJudgmentCategory(
	state: SdkActionLoopState,
): SdkJudgmentCategory | undefined {
	if (state.workCase.conclusions.length === 0) return undefined;
	const categories = new Set(
		state.workCase.conclusions.map((conclusion) => conclusion.category),
	);
	if (state.workCase.effects.length > 0) {
		const settledEffectIds = new Set(
			state.workCase.currentEffectAssessments.flatMap((assessment) =>
				"effectSettlementId" in assessment ? [assessment.effectId] : [],
			),
		);
		if (
			!state.workCase.effects.every((effect) =>
				settledEffectIds.has(effect.effectId),
			)
		) {
			return undefined;
		}
		const adverse = unresolvedAdverseSettlements(state);
		if (adverse.length > 0) {
			if (successfulEffectSettlements(state).length > 0) return undefined;
			return pendingRemediationIntervention(state) === undefined
				? "Proportionate Intervention"
				: undefined;
		}
		return !categories.has("Claim Assurance") ? "Claim Assurance" : undefined;
	}
	if (
		!categories.has("Proportionate Intervention") &&
		!categories.has("Claim Assurance")
	) {
		return "Proportionate Intervention";
	}
	const intervention = state.workCase.conclusions.find(
		(conclusion) => conclusion.category === "Proportionate Intervention",
	);
	if (
		intervention?.interventionDisposition === "no-action" &&
		!categories.has("Claim Assurance")
	) {
		return "Claim Assurance";
	}
	return undefined;
}

async function progressAction(input: {
	readonly request: string;
	readonly state: SdkActionLoopState;
	readonly observations: readonly EffectObservation[];
	readonly complete: boolean;
	readonly actions?: readonly SdkControlledActionAdapter[];
	readonly authorizeAction?: SdkActionLoopProgressionInput["authorizeAction"];
	readonly runner: SdkDecisionRunner;
	readonly checkpoint: SdkActionLoopProgressionInput["checkpoint"];
	readonly maxSteps: number;
	readonly steps: number;
	readonly checkpoints: number;
}): Promise<SdkActionLoopProgressionResult> {
	const { workCase } = input.state;
	let actionConclusions = workCase.conclusions;
	const pendingClearance = workCase.actionClearances.find(
		(clearance) =>
			!workCase.effects.some(
				(effect) => effect.actionClearanceId === clearance.actionClearanceId,
			),
	);
	if (pendingClearance) {
		return {
			status: "ready-for-host-action",
			actionCandidateId: pendingClearance.actionCandidateId,
			actionClearanceId: pendingClearance.actionClearanceId,
			state: input.state,
			steps: input.steps,
			checkpoints: input.checkpoints,
		};
	}
	if (workCase.effects.length > 0) {
		const progressed = await progressEffect({
			request: input.request,
			state: input.state,
			observations: input.observations,
			runner: input.runner,
			checkpoint: input.checkpoint,
			maxSteps: input.maxSteps,
			steps: input.steps,
			checkpoints: input.checkpoints,
		});
		if (progressed.status !== "ready-for-completion") return progressed;
		const adverse = unresolvedAdverseSettlements(input.state);
		if (adverse.length > 0) {
			const successful = successfulEffectSettlements(input.state);
			if (successful.length > 0) {
				return progressRemediation({
					request: input.request,
					state: input.state,
					adverseSettlements: adverse,
					successfulSettlements: successful,
					runner: input.runner,
					checkpoint: input.checkpoint,
					maxSteps: input.maxSteps,
					steps: progressed.steps,
					checkpoints: progressed.checkpoints,
				});
			}
			const intervention = pendingRemediationIntervention(input.state);
			if (
				intervention === undefined ||
				intervention.interventionDisposition !== "action-required"
			) {
				return {
					status: "remediation-required",
					adverseEffectIds: adverse.map(({ effectId }) => effectId),
					state: input.state,
					steps: progressed.steps,
					checkpoints: progressed.checkpoints,
				};
			}
			actionConclusions = [intervention];
		} else {
			if (!input.complete) return progressed;
			if (!progressed.state) {
				return {
					status: "invariant-failure",
					stage: "completion",
					code: "missing-active-work-case",
					message: "Completion progression lost the active Work Case.",
					steps: progressed.steps,
					checkpoints: progressed.checkpoints,
				};
			}
			return progressCompletion({
				request: input.request,
				state: progressed.state,
				runner: input.runner,
				checkpoint: input.checkpoint,
				maxSteps: input.maxSteps,
				steps: progressed.steps,
				checkpoints: progressed.checkpoints,
			});
		}
	}
	const categories = new Set(
		workCase.conclusions.map((conclusion) => conclusion.category),
	);
	const intervention = workCase.conclusions.find(
		(conclusion) => conclusion.category === "Proportionate Intervention",
	);
	if (intervention && intervention.interventionDisposition === undefined) {
		return {
			status: "invariant-failure",
			stage: "action",
			code: "missing-intervention-disposition",
			message:
				"Proportionate Intervention Conclusion has no canonical intervention disposition.",
			state: input.state,
			steps: input.steps,
			checkpoints: input.checkpoints,
		};
	}
	const noActionCompletion =
		categories.has("Claim Assurance") &&
		(intervention?.interventionDisposition === "no-action" || !intervention);
	if (noActionCompletion && !input.complete) {
		return {
			status: "ready-for-completion",
			effectAssessmentIds: [],
			state: input.state,
			steps: input.steps,
			checkpoints: input.checkpoints,
		};
	}
	if (noActionCompletion) {
		return progressCompletion({
			request: input.request,
			state: input.state,
			runner: input.runner,
			checkpoint: input.checkpoint,
			maxSteps: input.maxSteps,
			steps: input.steps,
			checkpoints: input.checkpoints,
		});
	}
	if (!input.actions || !input.authorizeAction) {
		return {
			status: "ready-for-action",
			conclusionIds: actionConclusions.map(
				(conclusion) => conclusion.conclusionId,
			),
			state: input.state,
			steps: input.steps,
			checkpoints: input.checkpoints,
		};
	}
	if (input.steps >= input.maxSteps) {
		return {
			status: "bounded-stop",
			stage: "action",
			reason: "progression-step-budget",
			state: input.state,
			steps: input.steps,
			checkpoints: input.checkpoints,
		};
	}
	const action = await proposeActionWithSdk({
		request: input.request,
		workCaseId: workCase.workCaseId,
		conclusions: actionConclusions,
		actions: input.actions,
		runner: input.runner,
	});
	const steps = input.steps + 1;
	if (action.status === "bounded-stop") {
		return {
			status: "bounded-stop",
			stage: "action",
			reason: action.reason,
			state: input.state,
			steps,
			checkpoints: input.checkpoints,
		};
	}
	if (action.status === "runtime-failure") {
		return {
			status: "runtime-failure",
			stage: "action",
			message: action.message,
			state: input.state,
			steps,
			checkpoints: input.checkpoints,
		};
	}
	if (action.status === "invariant-failure") {
		return {
			status: "invariant-failure",
			stage: "action",
			code: action.code,
			message: action.message,
			state: input.state,
			steps,
			checkpoints: input.checkpoints,
		};
	}
	let permission: PermissionDecision;
	try {
		permission = await input.authorizeAction(action);
	} catch (error) {
		return {
			status: "runtime-failure",
			stage: "action",
			message: compactError(error),
			state: input.state,
			steps,
			checkpoints: input.checkpoints,
		};
	}
	const clearance = clearActionWithHostPermission({
		candidate: action.candidate,
		conclusions: workCase.conclusions,
		permission,
	});
	if (clearance.status === "not-cleared") {
		return {
			status: "action-not-cleared",
			blockerCodes: clearance.blockers.map((blocker) => blocker.code),
			state: input.state,
			steps,
			checkpoints: input.checkpoints,
		};
	}
	if (clearance.status === "invariant-failure") {
		return {
			status: "invariant-failure",
			stage: "action",
			code: clearance.code,
			message: clearance.message,
			state: input.state,
			steps,
			checkpoints: input.checkpoints,
		};
	}
	const candidateRecord = recordWorkCaseActionCandidate(
		workCase,
		action.candidate,
	);
	if (candidateRecord.status === "invalid") {
		return {
			status: "invariant-failure",
			stage: "action",
			code: candidateRecord.error.code,
			message: candidateRecord.error.message,
			state: input.state,
			steps,
			checkpoints: input.checkpoints,
		};
	}
	const clearanceRecord = recordWorkCaseActionClearance(
		candidateRecord.value,
		clearance.clearance,
	);
	if (clearanceRecord.status === "invalid") {
		return {
			status: "invariant-failure",
			stage: "action",
			code: clearanceRecord.error.code,
			message: clearanceRecord.error.message,
			state: input.state,
			steps,
			checkpoints: input.checkpoints,
		};
	}
	const nextState = Object.freeze({
		...input.state,
		workCase: clearanceRecord.value,
	});
	const checkpoint: SdkActionLoopCheckpoint = {
		kind: "action-cleared",
		action,
		clearance,
		workCase: clearanceRecord.value,
	};
	try {
		await input.checkpoint(checkpoint);
	} catch (error) {
		return {
			status: "checkpoint-failure",
			stage: "action",
			message: compactError(error),
			pendingCheckpoint: checkpoint,
			state: input.state,
			steps,
			checkpoints: input.checkpoints,
		};
	}
	return {
		status: "ready-for-host-action",
		actionCandidateId: action.candidate.actionCandidateId,
		actionClearanceId: clearance.clearance.actionClearanceId,
		toolName: action.toolName,
		toolInput: action.toolInput,
		state: nextState,
		steps,
		checkpoints: input.checkpoints + 1,
	};
}

/**
 * Progresses canonical ownership from missing Work Case through Judgment,
 * exact host Action Clearance, Effect settlement, and Completion. Every
 * accepted transition is acknowledged before the controller mutates its
 * resumable projection or begins dependent work.
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

	const requiredCategory = nextRequiredJudgmentCategory(state);
	if (
		state.workCase.openJudgments.length === 0 &&
		state.workCase.conclusions.length > 0 &&
		requiredCategory === undefined
	) {
		return progressAction({
			request: input.request,
			state,
			observations: input.effectObservations ?? [],
			complete: input.complete ?? false,
			actions: input.actions,
			authorizeAction: input.authorizeAction,
			runner: input.runner,
			checkpoint: input.checkpoint,
			maxSteps,
			steps,
			checkpoints,
		});
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
			...(requiredCategory ? { requiredCategory } : {}),
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
