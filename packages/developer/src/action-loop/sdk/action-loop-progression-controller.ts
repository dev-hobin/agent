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
import {
	decideActionLoopTransition,
	type ActionLoopEffectPhase,
	type ActionLoopInterventionState,
	type ActionLoopTransitionDecision,
} from "./action-loop-transition-policy.ts";
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

type CanonicalConclusion =
	SdkActionLoopState["workCase"]["conclusions"][number];
type CanonicalActionClearance =
	SdkActionLoopState["workCase"]["actionClearances"][number];

interface CanonicalActionLoopTransition {
	readonly decision: ActionLoopTransitionDecision;
	readonly currentIntervention?: CanonicalConclusion;
	readonly pendingActionClearance?: CanonicalActionClearance;
	readonly adverseSettlements: readonly EffectSettlement[];
	readonly successfulSettlements: readonly EffectSettlement[];
}

function boundedCount(value: number): 0 | 1 | "many" {
	if (value === 0) return 0;
	return value === 1 ? 1 : "many";
}

function interventionState(
	interventions: readonly CanonicalConclusion[],
): ActionLoopInterventionState {
	if (interventions.length === 0) return "absent";
	if (interventions.length > 1) return "multiple";
	const [intervention] = interventions;
	if (!intervention) return "invalid";
	if (intervention.interventionDisposition === "action-required") {
		return "action-required";
	}
	if (intervention.interventionDisposition !== "no-action") return "invalid";
	return intervention.noActionDisposition ?? "outcome-attained";
}

function actionLoopEffectPhase(
	state: SdkActionLoopState,
	adverse: readonly EffectSettlement[],
	successful: readonly EffectSettlement[],
): ActionLoopEffectPhase {
	if (state.workCase.effects.length === 0) return "none";
	const settledEffectIds = new Set(
		currentEffectSettlements(state).map(({ effectId }) => effectId),
	);
	if (
		!state.workCase.effects.every(({ effectId }) =>
			settledEffectIds.has(effectId),
		)
	) {
		return "incomplete";
	}
	if (adverse.length > 0 && successful.length > 0) return "settled-mixed";
	return adverse.length > 0 ? "settled-adverse" : "settled-nonadverse";
}

function canonicalActionLoopTransition(
	state: SdkActionLoopState,
): CanonicalActionLoopTransition {
	const consumed = consumedConclusionIds(state);
	const currentInterventions = state.workCase.conclusions.filter(
		(conclusion) =>
			conclusion.category === "Proportionate Intervention" &&
			!consumed.has(conclusion.conclusionId),
	);
	const pendingActionClearances = state.workCase.actionClearances.filter(
		(clearance) =>
			!state.workCase.effects.some(
				(effect) =>
					effect.actionClearanceId === clearance.actionClearanceId,
			),
	);
	const adverseSettlements = unresolvedAdverseSettlements(state);
	const successfulSettlements = successfulEffectSettlements(state);
	const decision = decideActionLoopTransition({
		hasConclusions: state.workCase.conclusions.length > 0,
		openJudgments: boundedCount(state.workCase.openJudgments.length),
		pendingActionClearances: boundedCount(pendingActionClearances.length),
		effectPhase: actionLoopEffectPhase(
			state,
			adverseSettlements,
			successfulSettlements,
		),
		intervention: interventionState(currentInterventions),
		claimAssurances: boundedCount(
			state.workCase.conclusions.filter(
				({ category }) => category === "Claim Assurance",
			).length,
		),
	});
	return Object.freeze({
		decision,
		...(currentInterventions.length === 1
			? { currentIntervention: currentInterventions[0] }
			: {}),
		...(pendingActionClearances.length === 1
			? { pendingActionClearance: pendingActionClearances[0] }
			: {}),
		adverseSettlements: Object.freeze([...adverseSettlements]),
		successfulSettlements: Object.freeze([...successfulSettlements]),
	});
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

function trustedClaimAssuranceRequest(
	request: string,
	state: SdkActionLoopState,
): string {
	const judgment = state.workCase.openJudgments[0];
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
	const transition = canonicalActionLoopTransition(input.state);
	const { decision } = transition;
	if (decision.kind === "invariant-failure") {
		return {
			status: "invariant-failure",
			stage: "action",
			code: decision.code,
			message: `Canonical Action Loop control state is incoherent: ${decision.code}.`,
			state: input.state,
			steps: input.steps,
			checkpoints: input.checkpoints,
		};
	}
	if (decision.kind === "ready-for-host-action") {
		const pendingClearance = transition.pendingActionClearance;
		if (!pendingClearance) {
			return {
				status: "invariant-failure",
				stage: "action",
				code: "missing-pending-action-clearance",
				message: "The route requires one pending Action Clearance.",
				state: input.state,
				steps: input.steps,
				checkpoints: input.checkpoints,
			};
		}
		return {
			status: "ready-for-host-action",
			actionCandidateId: pendingClearance.actionCandidateId,
			actionClearanceId: pendingClearance.actionClearanceId,
			state: input.state,
			steps: input.steps,
			checkpoints: input.checkpoints,
		};
	}
	if (decision.kind === "progress-effect") {
		return progressEffect({
			request: input.request,
			state: input.state,
			observations: input.observations,
			runner: input.runner,
			checkpoint: input.checkpoint,
			maxSteps: input.maxSteps,
			steps: input.steps,
			checkpoints: input.checkpoints,
		});
	}
	if (decision.kind === "progress-remediation") {
		return progressRemediation({
			request: input.request,
			state: input.state,
			adverseSettlements: transition.adverseSettlements,
			successfulSettlements: transition.successfulSettlements,
			runner: input.runner,
			checkpoint: input.checkpoint,
			maxSteps: input.maxSteps,
			steps: input.steps,
			checkpoints: input.checkpoints,
		});
	}
	if (decision.kind === "remediation-required") {
		return {
			status: "remediation-required",
			adverseEffectIds: transition.adverseSettlements.map(
				({ effectId }) => effectId,
			),
			state: input.state,
			steps: input.steps,
			checkpoints: input.checkpoints,
		};
	}
	if (decision.kind === "continuity-required") {
		return {
			status: "continuity-required",
			disposition: decision.disposition,
			state: input.state,
			steps: input.steps,
			checkpoints: input.checkpoints,
		};
	}
	if (decision.kind === "ready-for-completion") {
		if (!input.complete) {
			return {
				status: "ready-for-completion",
				effectAssessmentIds:
					workCase.currentEffectAssessments.map(currentAssessmentId),
				state: input.state,
				steps: input.steps,
				checkpoints: input.checkpoints,
			};
		}
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
	if (decision.kind !== "propose-action") {
		return {
			status: "invariant-failure",
			stage: "action",
			code: "misrouted-control-state",
			message: `Judgment route ${decision.kind} reached Action progression.`,
			state: input.state,
			steps: input.steps,
			checkpoints: input.checkpoints,
		};
	}
	const intervention = transition.currentIntervention;
	if (
		!intervention ||
		intervention.interventionDisposition !== "action-required"
	) {
		return {
			status: "invariant-failure",
			stage: "action",
			code: "missing-action-intervention",
			message:
				"An Action route requires one current action-required Intervention.",
			state: input.state,
			steps: input.steps,
			checkpoints: input.checkpoints,
		};
	}
	const actionConclusions = [intervention];
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

	const transition = canonicalActionLoopTransition(state);
	if (transition.decision.kind === "invariant-failure") {
		return {
			status: "invariant-failure",
			stage: "judgment",
			code: transition.decision.code,
			message: `Canonical Action Loop control state is incoherent: ${transition.decision.code}.`,
			state,
			steps,
			checkpoints,
		};
	}
	if (
		transition.decision.kind !== "open-judgment" &&
		transition.decision.kind !== "progress-open-judgment"
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
	const requiredCategory =
		transition.decision.kind === "open-judgment"
			? transition.decision.requiredCategory
			: undefined;
	if (transition.decision.kind === "open-judgment") {
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
