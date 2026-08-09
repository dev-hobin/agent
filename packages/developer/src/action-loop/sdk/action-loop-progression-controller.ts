import type { PermissionDecision } from "../action/action-clearance.ts";
import type { EffectObservation } from "../effect/effect-observation.ts";
import { recordWorkCaseActionCandidate } from "../work/record-work-case-action-candidate.ts";
import { recordWorkCaseActionClearance } from "../work/record-work-case-action-clearance.ts";
import { recordWorkCaseEffectAssessment } from "../work/record-work-case-effect-assessment.ts";
import { recordWorkCaseEffectRemediation } from "../work/record-work-case-effect-remediation.ts";
import {
	clearActionLoopAction,
	initialActionLoopPhase,
	openActionLoopJudgment,
	remediateActionLoopEffect,
	requiredActionLoopJudgmentCategory,
	settleActionLoopEffect,
	type ActionLoopActionProposalPhase,
	type ActionLoopEffectAssessmentPhase,
	type ActionLoopEffectRemediationPhase,
	type ActionLoopJudgmentActivePhase,
	type ActionLoopPhase,
} from "../work/action-loop-phase.ts";
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
	type SdkJudgmentOpeningResult,
} from "./judgment-controller.ts";
import { buildSdkJudgmentEvidenceOperations } from "./judgment-evidence-operation.ts";
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
			readonly status: "continuity-required";
			readonly disposition: "blocked" | "waiting";
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
	readonly availableEvidenceFunctions?: readonly string[];
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
		phase: initialActionLoopPhase(result.workCase.workCaseId),
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
	phase: ActionLoopJudgmentActivePhase,
): SdkActionLoopState {
	return Object.freeze({ ...state, phase, workCase: result.workCase });
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
	readonly phase: ActionLoopEffectAssessmentPhase;
	readonly observations: readonly EffectObservation[];
	readonly runner: SdkDecisionRunner;
	readonly checkpoint: SdkActionLoopProgressionInput["checkpoint"];
	readonly maxSteps: number;
	readonly steps: number;
	readonly checkpoints: number;
}): Promise<SdkActionLoopProgressionResult> {
	const effect = input.phase.effect;
	const current = input.state.workCase.currentEffectAssessments.find(
		(assessment) => assessment.effectId === effect.effectId,
	);
	if (current && "effectSettlementId" in current) {
		return {
			status: "invariant-failure",
			stage: "effect",
			code: "phase-ledger-effect-mismatch",
			message: "The phase-owned Effect is already settled in the ledger.",
			state: input.state,
			steps: input.steps,
			checkpoints: input.checkpoints,
		};
	}
	const observations = input.observations.filter(
		(observation) => observation.effectId === effect.effectId,
	);
	if (observations.length === 0) {
		if (current) {
			return {
				status: "effect-unsettled",
				outcome: current.outcome,
				state: input.state,
				steps: input.steps,
				checkpoints: input.checkpoints,
			};
		}
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
	const transitioned = settleActionLoopEffect(input.phase, assessment);
	if (transitioned.status === "invalid") {
		return {
			status: "invariant-failure",
			stage: "effect",
			code: transitioned.error.code,
			message: transitioned.error.message,
			state: input.state,
			steps,
			checkpoints: input.checkpoints,
		};
	}
	const nextState = Object.freeze({
		...input.state,
		phase: transitioned.value,
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
	readonly phase: ActionLoopEffectRemediationPhase;
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
		adverseSettlements: input.phase.adverseSettlements,
		successfulSettlements: input.phase.successfulSettlements,
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
			adverseEffectIds: input.phase.adverseSettlements.map(
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
	const transitioned = remediateActionLoopEffect(
		input.phase,
		result.remediation,
	);
	if (transitioned.status === "invalid") {
		return {
			status: "invariant-failure",
			stage: "remediation",
			code: transitioned.error.code,
			message: transitioned.error.message,
			state: input.state,
			steps,
			checkpoints: input.checkpoints,
		};
	}
	const nextState = Object.freeze({
		...input.state,
		phase: transitioned.value,
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

function trustedClaimAssuranceRequest(
	request: string,
	state: SdkActionLoopState,
): string {
	const judgment =
		state.phase.kind === "judgment-active" ? state.phase.judgment : undefined;
	if (judgment?.category !== "Claim Assurance") return request;
	const conclusions = state.workCase.conclusions.map(
		(conclusion) => `${conclusion.category}: ${conclusion.answer}`,
	);
	return [
		request,
		"Trusted current Work Case facts for Claim Assurance:",
		...(conclusions.length > 0 ? conclusions : ["Conclusions: none"]),
		`Controlled Actions recorded: ${state.workCase.actionClearances.length}.`,
		`Controlled Effects recorded: ${state.workCase.effects.length}.`,
		"These trusted facts may satisfy a Claim Assurance Need directly; do not demand a repeated Host Observation merely to restate them.",
	].join("\n");
}

type ActionProgressionPhase = Exclude<
	ActionLoopPhase,
	{ readonly kind: "judgment-opening" | "judgment-active" }
>;

interface ActionProgressionInput {
	readonly request: string;
	readonly state: SdkActionLoopState;
	readonly phase: ActionProgressionPhase;
	readonly observations: readonly EffectObservation[];
	readonly complete: boolean;
	readonly actions?: readonly SdkControlledActionAdapter[];
	readonly authorizeAction?: SdkActionLoopProgressionInput["authorizeAction"];
	readonly runner: SdkDecisionRunner;
	readonly checkpoint: SdkActionLoopProgressionInput["checkpoint"];
	readonly maxSteps: number;
	readonly steps: number;
	readonly checkpoints: number;
}

type RoutedActionProgression =
	| {
			readonly status: "action-proposal";
			readonly phase: ActionLoopActionProposalPhase;
	  }
	| {
			readonly status: "settled";
			readonly result: SdkActionLoopProgressionResult;
	  };

async function routeActionProgression(
	input: ActionProgressionInput,
): Promise<RoutedActionProgression> {
	const { phase } = input;
	switch (phase.kind) {
		case "action-proposal":
			return { status: "action-proposal", phase };
		case "host-action-pending":
			return {
				status: "settled",
				result: {
					status: "ready-for-host-action",
					actionCandidateId: phase.actionCandidate.actionCandidateId,
					actionClearanceId: phase.actionClearance.actionClearanceId,
					state: input.state,
					steps: input.steps,
					checkpoints: input.checkpoints,
				},
			};
		case "effect-assessment":
			return {
				status: "settled",
				result: await progressEffect({
					request: input.request,
					state: input.state,
					phase,
					observations: input.observations,
					runner: input.runner,
					checkpoint: input.checkpoint,
					maxSteps: input.maxSteps,
					steps: input.steps,
					checkpoints: input.checkpoints,
				}),
			};
		case "effect-remediation":
			return {
				status: "settled",
				result: await progressRemediation({
					request: input.request,
					state: input.state,
					phase,
					runner: input.runner,
					checkpoint: input.checkpoint,
					maxSteps: input.maxSteps,
					steps: input.steps,
					checkpoints: input.checkpoints,
				}),
			};
		case "effect-remediation-required":
			return {
				status: "settled",
				result: {
					status: "remediation-required",
					adverseEffectIds: phase.adverseSettlements.map(
						({ effectId }) => effectId,
					),
					state: input.state,
					steps: input.steps,
					checkpoints: input.checkpoints,
				},
			};
		case "continuity":
			return {
				status: "settled",
				result: {
					status: "continuity-required",
					disposition: phase.disposition,
					state: input.state,
					steps: input.steps,
					checkpoints: input.checkpoints,
				},
			};
		case "completion-ready":
			return {
				status: "settled",
				result: input.complete
					? await progressCompletion({
							request: input.request,
							state: input.state,
							runner: input.runner,
							checkpoint: input.checkpoint,
							maxSteps: input.maxSteps,
							steps: input.steps,
							checkpoints: input.checkpoints,
						})
					: {
							status: "ready-for-completion",
							effectAssessmentIds:
								input.state.workCase.currentEffectAssessments.map(
									currentAssessmentId,
								),
							state: input.state,
							steps: input.steps,
							checkpoints: input.checkpoints,
						},
			};
		default:
			return phase satisfies never;
	}
}

async function progressAcceptedAction(input: {
	readonly progression: ActionProgressionInput;
	readonly phase: ActionLoopActionProposalPhase;
	readonly action: Extract<
		SdkActionCandidateResult,
		{ readonly status: "accepted" }
	>;
	readonly authorizeAction: NonNullable<
		SdkActionLoopProgressionInput["authorizeAction"]
	>;
	readonly steps: number;
}): Promise<SdkActionLoopProgressionResult> {
	const { progression, phase, action, steps } = input;
	const { workCase } = progression.state;
	let permission: PermissionDecision;
	try {
		permission = await input.authorizeAction(action);
	} catch (error) {
		return {
			status: "runtime-failure",
			stage: "action",
			message: compactError(error),
			state: progression.state,
			steps,
			checkpoints: progression.checkpoints,
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
			state: progression.state,
			steps,
			checkpoints: progression.checkpoints,
		};
	}
	if (clearance.status === "invariant-failure") {
		return {
			status: "invariant-failure",
			stage: "action",
			code: clearance.code,
			message: clearance.message,
			state: progression.state,
			steps,
			checkpoints: progression.checkpoints,
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
			state: progression.state,
			steps,
			checkpoints: progression.checkpoints,
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
			state: progression.state,
			steps,
			checkpoints: progression.checkpoints,
		};
	}
	const transitioned = clearActionLoopAction(
		phase,
		action.candidate,
		clearance.clearance,
	);
	if (transitioned.status === "invalid") {
		return {
			status: "invariant-failure",
			stage: "action",
			code: transitioned.error.code,
			message: transitioned.error.message,
			state: progression.state,
			steps,
			checkpoints: progression.checkpoints,
		};
	}
	const nextState = Object.freeze({
		...progression.state,
		phase: transitioned.value,
		workCase: clearanceRecord.value,
	});
	const checkpoint: SdkActionLoopCheckpoint = {
		kind: "action-cleared",
		action,
		clearance,
		workCase: clearanceRecord.value,
	};
	try {
		await progression.checkpoint(checkpoint);
	} catch (error) {
		return {
			status: "checkpoint-failure",
			stage: "action",
			message: compactError(error),
			pendingCheckpoint: checkpoint,
			state: progression.state,
			steps,
			checkpoints: progression.checkpoints,
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
		checkpoints: progression.checkpoints + 1,
	};
}

async function progressAction(
	input: ActionProgressionInput,
): Promise<SdkActionLoopProgressionResult> {
	const { workCase } = input.state;
	const { phase } = input;
	if (phase.workCaseId !== workCase.workCaseId) {
		return {
			status: "invariant-failure",
			stage: "action",
			code: "phase-work-case-mismatch",
			message: "Canonical phase ownership does not match the Work Case ledger.",
			state: input.state,
			steps: input.steps,
			checkpoints: input.checkpoints,
		};
	}
	const routed = await routeActionProgression(input);
	if (routed.status === "settled") return routed.result;
	const { phase: actionPhase } = routed;
	const actionConclusions = [actionPhase.intervention];
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
	return progressAcceptedAction({
		progression: input,
		phase: actionPhase,
		action,
		authorizeAction: input.authorizeAction,
		steps,
	});
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

	if (state.phase.workCaseId !== state.workCase.workCaseId) {
		return {
			status: "invariant-failure",
			stage: "judgment",
			code: "phase-work-case-mismatch",
			message: "Canonical phase ownership does not match the Work Case ledger.",
			state,
			steps,
			checkpoints,
		};
	}
	if (
		state.phase.kind !== "judgment-opening" &&
		state.phase.kind !== "judgment-active"
	) {
		return progressAction({
			request: input.request,
			state,
			phase: state.phase,
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
	const requiredCategory =
		state.phase.kind === "judgment-opening"
			? requiredActionLoopJudgmentCategory(state.phase)
			: undefined;
	if (state.phase.kind === "judgment-opening") {
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
		const evidenceOperations = buildSdkJudgmentEvidenceOperations({
			capabilities: input.capabilities,
			...(input.availableEvidenceFunctions
				? { availableEvidenceFunctions: input.availableEvidenceFunctions }
				: {}),
		});
		const opened = await openJudgmentWithSdk({
			request: input.request,
			workCase: state.workCase,
			contextRevisionId: state.workCase.revisionId,
			admissibleContributionFunctions: evidenceOperations.map(
				(operation) => operation.function,
			),
			...(requiredCategory ? { requiredCategory } : {}),
			...(input.availableEvidenceFunctions
				? { availableEvidenceFunctions: input.availableEvidenceFunctions }
				: {}),
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
		const transitioned = openActionLoopJudgment(state.phase, opened.judgment);
		if (transitioned.status === "invalid") {
			return {
				status: "invariant-failure",
				stage: "judgment",
				code: transitioned.error.code,
				message: transitioned.error.message,
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
		state = withJudgment(state, opened, transitioned.value);
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
		request: trustedClaimAssuranceRequest(input.request, state),
		state,
		capabilities: input.capabilities,
		...(input.availableEvidenceFunctions
			? { availableEvidenceFunctions: input.availableEvidenceFunctions }
			: {}),
		runner: input.runner,
		maxSteps: maxSteps - steps,
		checkpoint: input.checkpoint,
	});
	return mapJudgmentResult(progressed, steps, checkpoints);
}
