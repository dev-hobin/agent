import type {
	SkillContribution,
	SkillContributionContext,
} from "../contribution/accept-skill-contribution.ts";
import type {
	ContributionNeed,
	OpenJudgment,
} from "../judgment/open-judgment.ts";
import type { NeedCoverage } from "../need-coverage/assess-need-coverage.ts";
import type {
	AcceptedApplicabilityAssessment,
	CapabilityAssignment,
} from "../routing/accept-applicability.ts";
import type { BoundReferenceSelection } from "../routing/bind-reference-selection.ts";
import { recordWorkCaseConclusion } from "../work/record-work-case-conclusion.ts";
import type { ActiveWorkCase } from "../work/work-case.ts";
import {
	assessCapabilityInventoryDeterministically,
	assessCapabilityInventoryWithSdk,
	type SdkCapabilityInventoryResult,
	type SdkNamedCapability,
} from "./capability-inventory-controller.ts";
import {
	sealCapabilityContextWithSdk,
	type SdkCapabilityContextResult,
} from "./context-sealing-controller.ts";
import {
	concludeJudgmentWithSdk,
	type SdkJudgmentConclusionResult,
} from "./conclusion-controller.ts";
import {
	contributeSkillWithSdk,
	type SdkSkillContributionResult,
} from "./contribution-controller.ts";
import { inspectContributionProgress } from "./contribution-progress.ts";
import {
	assessNeedCoverageWithSdk,
	type SdkNeedCoverageResult,
} from "./coverage-controller.ts";
import type { SdkActionLoopState } from "./action-loop-state.ts";
import type {
	SdkDecisionRunner,
	SdkDecisionStopReason,
} from "./decision-controller.ts";
import {
	buildSdkJudgmentEvidenceOperations,
	selectSdkJudgmentEvidenceOperation,
} from "./judgment-evidence-operation.ts";

type AssessedInventory = Extract<
	SdkCapabilityInventoryResult,
	{ readonly status: "assessed" }
>;
type PreparedContext = Extract<
	SdkCapabilityContextResult,
	{ readonly status: "sealed" | "needs-context" }
>;
type AcceptedContribution = Extract<
	SdkSkillContributionResult,
	{ readonly status: "accepted" }
>;
type AssessedCoverage = Extract<
	SdkNeedCoverageResult,
	{ readonly status: "assessed" }
>;
type ConcludedJudgment = Extract<
	SdkJudgmentConclusionResult,
	{ readonly status: "concluded" }
>;

export type SdkJudgmentCheckpoint =
	| {
			readonly kind: "capability-inventory-assessed";
			readonly contributionNeedId: string;
			readonly result: AssessedInventory;
	  }
	| {
			readonly kind: "capability-context-prepared";
			readonly skillName: string;
			readonly assignment: CapabilityAssignment;
			readonly result: PreparedContext;
	  }
	| {
			readonly kind: "contribution-accepted";
			readonly skillName: string;
			readonly result: AcceptedContribution;
	  }
	| {
			readonly kind: "coverage-assessed";
			readonly result: AssessedCoverage;
	  }
	| {
			readonly kind: "judgment-concluded";
			readonly result: ConcludedJudgment;
			readonly workCase: ActiveWorkCase;
	  };

export interface SdkJudgmentProgressionInput {
	readonly request: string;
	readonly state: SdkActionLoopState;
	readonly capabilities: readonly SdkNamedCapability[];
	readonly availableEvidenceFunctions?: readonly string[];
	readonly runner: SdkDecisionRunner;
	readonly maxSteps: number;
	readonly checkpoint: (
		checkpoint: SdkJudgmentCheckpoint,
	) => Promise<void> | void;
}

export type SdkJudgmentProgressionStage =
	| "inventory"
	| "context"
	| "contribution"
	| "coverage"
	| "conclusion";

export type SdkJudgmentProgressionStopReason =
	| SdkDecisionStopReason
	| "progression-step-budget";

interface ProgressResultBase {
	readonly state: SdkActionLoopState;
	readonly steps: number;
	readonly checkpoints: number;
}

export type SdkJudgmentProgressionResult =
	| (ProgressResultBase & {
			readonly status: "concluded";
			readonly conclusionId: string;
	  })
	| (ProgressResultBase & {
			readonly status: "needs-context";
			readonly assignmentId: string;
	  })
	| (ProgressResultBase & {
			readonly status: "refused";
			readonly refusal: Extract<
				SdkJudgmentConclusionResult,
				{ readonly status: "refused" }
			>["refusal"];
	  })
	| (ProgressResultBase & {
			readonly status: "bounded-stop";
			readonly stage: SdkJudgmentProgressionStage;
			readonly reason: SdkJudgmentProgressionStopReason;
	  })
	| (ProgressResultBase & {
			readonly status: "runtime-failure";
			readonly stage: SdkJudgmentProgressionStage;
			readonly message: string;
	  })
	| (ProgressResultBase & {
			readonly status: "invariant-failure";
			readonly stage: SdkJudgmentProgressionStage;
			readonly code: string;
			readonly message: string;
	  })
	| (ProgressResultBase & {
			readonly status: "checkpoint-failure";
			readonly stage: SdkJudgmentProgressionStage;
			readonly message: string;
			readonly pendingCheckpoint: SdkJudgmentCheckpoint;
	  });

interface MutableProgress {
	workCase: ActiveWorkCase;
	applicabilityAssessments: AcceptedApplicabilityAssessment[];
	assignments: CapabilityAssignment[];
	selections: BoundReferenceSelection[];
	contexts: SkillContributionContext[];
	contributions: SdkActionLoopState["contributions"][number][];
	coverages: NeedCoverage[];
	steps: number;
	checkpoints: number;
}

interface ProgressionRuntime {
	readonly input: SdkJudgmentProgressionInput;
	readonly progress: MutableProgress;
	readonly maximumSteps: number;
	readonly judgment: OpenJudgment;
}

type StageProgress = Promise<SdkJudgmentProgressionResult | undefined>;

function positiveInteger(value: number, label: string): number {
	if (!Number.isSafeInteger(value) || value < 1) {
		throw new RangeError(`${label} must be a positive safe integer`);
	}
	return value;
}

function compactError(error: unknown): string {
	return (error instanceof Error ? error.message : String(error)).slice(
		0,
		2_048,
	);
}

function snapshot(progress: MutableProgress): SdkActionLoopState {
	return Object.freeze({
		workCase: progress.workCase,
		applicabilityAssessments: Object.freeze([
			...progress.applicabilityAssessments,
		]),
		assignments: Object.freeze([...progress.assignments]),
		selections: Object.freeze([...progress.selections]),
		contexts: Object.freeze([...progress.contexts]),
		contributions: Object.freeze([...progress.contributions]),
		coverages: Object.freeze([...progress.coverages]),
	});
}

function base(progress: MutableProgress): ProgressResultBase {
	return {
		state: snapshot(progress),
		steps: progress.steps,
		checkpoints: progress.checkpoints,
	};
}

function invariantFailure(
	progress: MutableProgress,
	stage: SdkJudgmentProgressionStage,
	code: string,
	message: string,
): SdkJudgmentProgressionResult {
	return {
		status: "invariant-failure",
		stage,
		code,
		message,
		...base(progress),
	};
}

function capabilityByRevision(
	capabilities: readonly SdkNamedCapability[],
	capabilityRevisionId: string,
): SdkNamedCapability | undefined {
	return capabilities.find(
		(candidate) =>
			candidate.entry.capability.capabilityRevisionId === capabilityRevisionId,
	);
}

function currentNeedAssessments(
	progress: MutableProgress,
	judgmentId: string,
	contributionNeedId: string,
): AcceptedApplicabilityAssessment[] {
	return progress.applicabilityAssessments.filter(
		(assessment) =>
			assessment.workCaseId === progress.workCase.workCaseId &&
			assessment.judgmentId === judgmentId &&
			assessment.contributionNeedId === contributionNeedId,
	);
}

function completeInventory(input: {
	readonly assessments: readonly AcceptedApplicabilityAssessment[];
	readonly capabilities: readonly SdkNamedCapability[];
}):
	| { readonly status: "complete" | "missing" }
	| {
			readonly status: "invalid";
			readonly code: string;
			readonly message: string;
	  } {
	if (input.assessments.length === 0) return { status: "missing" };
	const currentRevisions = new Set(
		input.capabilities.map(
			(capability) => capability.entry.capability.capabilityRevisionId,
		),
	);
	const assessedRevisions = new Set(
		input.assessments.map((assessment) => assessment.capabilityRevisionId),
	);
	if (
		assessedRevisions.size !== input.assessments.length ||
		input.assessments.some(
			(assessment) => !currentRevisions.has(assessment.capabilityRevisionId),
		)
	) {
		return {
			status: "invalid",
			code: "capability-inventory-mismatch",
			message:
				"Current applicability assessments contain duplicate or unavailable Capability revisions.",
		};
	}
	if (assessedRevisions.size !== currentRevisions.size) {
		return {
			status: "invalid",
			code: "partial-capability-inventory",
			message:
				"A current Contribution Need has a partial Capability inventory; progression requires one complete atomic inventory assessment.",
		};
	}
	return { status: "complete" };
}

async function commitCheckpoint(
	runtime: ProgressionRuntime,
	stage: SdkJudgmentProgressionStage,
	checkpoint: SdkJudgmentCheckpoint,
): StageProgress {
	try {
		await runtime.input.checkpoint(checkpoint);
		runtime.progress.checkpoints += 1;
		return undefined;
	} catch (error) {
		return {
			status: "checkpoint-failure",
			stage,
			message: compactError(error),
			pendingCheckpoint: checkpoint,
			...base(runtime.progress),
		};
	}
}

function consumeStep(
	runtime: ProgressionRuntime,
	stage: SdkJudgmentProgressionStage,
): SdkJudgmentProgressionResult | undefined {
	if (runtime.progress.steps >= runtime.maximumSteps) {
		return {
			status: "bounded-stop",
			stage,
			reason: "progression-step-budget",
			...base(runtime.progress),
		};
	}
	runtime.progress.steps += 1;
	return undefined;
}

function decisionFailure(
	progress: MutableProgress,
	stage: SdkJudgmentProgressionStage,
	result:
		| Exclude<SdkCapabilityInventoryResult, AssessedInventory>
		| Exclude<SdkCapabilityContextResult, PreparedContext>
		| Exclude<SdkSkillContributionResult, AcceptedContribution>
		| Exclude<SdkNeedCoverageResult, AssessedCoverage>,
): SdkJudgmentProgressionResult {
	if (result.status === "bounded-stop") {
		return {
			status: "bounded-stop",
			stage,
			reason: result.reason,
			...base(progress),
		};
	}
	if (result.status === "runtime-failure") {
		return {
			status: "runtime-failure",
			stage,
			message: result.message,
			...base(progress),
		};
	}
	return invariantFailure(
		progress,
		stage,
		"code" in result ? result.code : result.status,
		result.message,
	);
}

function skillContribution(
	contribution: SdkActionLoopState["contributions"][number],
): contribution is SkillContribution {
	return "assignmentId" in contribution && "sealedContextId" in contribution;
}

async function progressNeedInventory(
	runtime: ProgressionRuntime,
	need: ContributionNeed,
): StageProgress {
	const assessments = currentNeedAssessments(
		runtime.progress,
		runtime.judgment.judgmentId,
		need.contributionNeedId,
	);
	const inventory = completeInventory({
		assessments,
		capabilities: runtime.input.capabilities,
	});
	if (inventory.status === "invalid") {
		return invariantFailure(
			runtime.progress,
			"inventory",
			inventory.code,
			inventory.message,
		);
	}
	if (inventory.status === "complete") return undefined;
	const stopped = consumeStep(runtime, "inventory");
	if (stopped) return stopped;
	const operation = selectSdkJudgmentEvidenceOperation(
		buildSdkJudgmentEvidenceOperations({
			capabilities: runtime.input.capabilities,
			...(runtime.input.availableEvidenceFunctions
				? {
						availableEvidenceFunctions:
							runtime.input.availableEvidenceFunctions,
					}
				: {}),
		}),
		need.function,
	);
	const result = operation
		? assessCapabilityInventoryDeterministically({
				workCaseId: runtime.progress.workCase.workCaseId,
				judgmentId: runtime.judgment.judgmentId,
				contributionNeedId: need.contributionNeedId,
				capabilities: runtime.input.capabilities,
				operation,
			})
		: await assessCapabilityInventoryWithSdk({
				request: runtime.input.request,
				workCaseId: runtime.progress.workCase.workCaseId,
				judgmentId: runtime.judgment.judgmentId,
				contributionNeedId: need.contributionNeedId,
				contributionNeed: need.function,
				capabilities: runtime.input.capabilities,
				runner: runtime.input.runner,
			});
	if (result.status !== "assessed") {
		return decisionFailure(runtime.progress, "inventory", result);
	}
	const failed = await commitCheckpoint(runtime, "inventory", {
		kind: "capability-inventory-assessed",
		contributionNeedId: need.contributionNeedId,
		result,
	});
	if (failed) return failed;
	runtime.progress.applicabilityAssessments.push(
		...result.dispositions.map(({ assessment }) => assessment),
	);
	runtime.progress.assignments.push(...result.assignments);
	return undefined;
}

function needAssignments(
	runtime: ProgressionRuntime,
	need: ContributionNeed,
): CapabilityAssignment[] {
	return runtime.progress.assignments
		.filter(
			(assignment) =>
				assignment.workCaseId === runtime.progress.workCase.workCaseId &&
				assignment.judgmentId === runtime.judgment.judgmentId &&
				assignment.contributionNeedId === need.contributionNeedId,
		)
		.sort((left, right) => left.assignmentId.localeCompare(right.assignmentId));
}

async function prepareAssignmentContext(
	runtime: ProgressionRuntime,
	assignment: CapabilityAssignment,
): StageProgress {
	const existingContext = runtime.progress.contexts.find(
		(context) => context.assignmentId === assignment.assignmentId,
	);
	if (existingContext) return undefined;
	const unresolved = runtime.progress.selections.find(
		(selection) =>
			selection.assignmentId === assignment.assignmentId &&
			selection.status === "needs-context",
	);
	if (unresolved) {
		return {
			status: "needs-context",
			assignmentId: assignment.assignmentId,
			...base(runtime.progress),
		};
	}
	const capability = capabilityByRevision(
		runtime.input.capabilities,
		assignment.capabilityRevisionId,
	);
	if (!capability) {
		return invariantFailure(
			runtime.progress,
			"context",
			"assigned-capability-unavailable",
			"A current Assignment has no exact Pi-admitted Capability revision.",
		);
	}
	const stopped = consumeStep(runtime, "context");
	if (stopped) return stopped;
	const result = await sealCapabilityContextWithSdk({
		request: runtime.input.request,
		entry: capability.entry,
		assignment,
		runner: runtime.input.runner,
	});
	if (result.status !== "sealed" && result.status !== "needs-context") {
		return decisionFailure(runtime.progress, "context", result);
	}
	const failed = await commitCheckpoint(runtime, "context", {
		kind: "capability-context-prepared",
		skillName: capability.name,
		assignment,
		result,
	});
	if (failed) return failed;
	if (result.selection) runtime.progress.selections.push(result.selection);
	if (result.status === "needs-context") {
		return {
			status: "needs-context",
			assignmentId: assignment.assignmentId,
			...base(runtime.progress),
		};
	}
	runtime.progress.contexts.push(result.context);
	return undefined;
}

async function progressNeedContexts(
	runtime: ProgressionRuntime,
	need: ContributionNeed,
): StageProgress {
	for (const assignment of needAssignments(runtime, need)) {
		const stopped = await prepareAssignmentContext(runtime, assignment);
		if (stopped) return stopped;
	}
	return undefined;
}

function needContexts(
	runtime: ProgressionRuntime,
	need: ContributionNeed,
): SkillContributionContext[] {
	return runtime.progress.contexts
		.filter(
			(context) =>
				context.workCaseId === runtime.progress.workCase.workCaseId &&
				context.judgmentId === runtime.judgment.judgmentId &&
				context.contributionNeedId === need.contributionNeedId,
		)
		.sort((left, right) => left.assignmentId.localeCompare(right.assignmentId));
}

async function acceptContextContribution(
	runtime: ProgressionRuntime,
	need: ContributionNeed,
	context: SkillContributionContext,
): StageProgress {
	const assignment = runtime.progress.assignments.find(
		(candidate) => candidate.assignmentId === context.assignmentId,
	);
	const capability = assignment
		? capabilityByRevision(
				runtime.input.capabilities,
				assignment.capabilityRevisionId,
			)
		: undefined;
	if (!assignment || !capability) {
		return invariantFailure(
			runtime.progress,
			"contribution",
			"context-assignment-unavailable",
			"A sealed Context has no exact current Assignment and Capability.",
		);
	}
	const stopped = consumeStep(runtime, "contribution");
	if (stopped) return stopped;
	const result = await contributeSkillWithSdk({
		request: runtime.input.request,
		contributionNeed: need.function,
		assignment,
		context,
		runner: runtime.input.runner,
	});
	if (result.status !== "accepted") {
		return decisionFailure(runtime.progress, "contribution", result);
	}
	const failed = await commitCheckpoint(runtime, "contribution", {
		kind: "contribution-accepted",
		skillName: capability.name,
		result,
	});
	if (failed) return failed;
	runtime.progress.contributions.push(result.contribution);
	return undefined;
}

async function progressNeedContributions(
	runtime: ProgressionRuntime,
	need: ContributionNeed,
): StageProgress {
	const contributionProgress = inspectContributionProgress({
		workCaseId: runtime.progress.workCase.workCaseId,
		judgmentId: runtime.judgment.judgmentId,
		contexts: needContexts(runtime, need),
		contributions: runtime.progress.contributions
			.filter(skillContribution)
			.filter(
				(contribution) =>
					contribution.contributionNeedId === need.contributionNeedId,
			),
	});
	if (contributionProgress.status === "invalid") {
		return invariantFailure(
			runtime.progress,
			"contribution",
			contributionProgress.code,
			contributionProgress.message,
		);
	}
	for (const context of contributionProgress.pendingContexts) {
		const stopped = await acceptContextContribution(runtime, need, context);
		if (stopped) return stopped;
	}
	return undefined;
}

function currentNeedCoverage(
	runtime: ProgressionRuntime,
	need: ContributionNeed,
): NeedCoverage | undefined {
	return runtime.progress.coverages.find(
		(coverage) =>
			coverage.workCaseId === runtime.progress.workCase.workCaseId &&
			coverage.judgmentId === runtime.judgment.judgmentId &&
			coverage.contributionNeedId === need.contributionNeedId,
	);
}

async function progressNeedCoverage(
	runtime: ProgressionRuntime,
	need: ContributionNeed,
): StageProgress {
	if (currentNeedCoverage(runtime, need)) return undefined;
	const stopped = consumeStep(runtime, "coverage");
	if (stopped) return stopped;
	const result = await assessNeedCoverageWithSdk({
		request: runtime.input.request,
		contributionNeed: need.function,
		target: {
			workCaseId: runtime.progress.workCase.workCaseId,
			judgmentId: runtime.judgment.judgmentId,
			contributionNeedId: need.contributionNeedId,
		},
		contributions: runtime.progress.contributions.filter(
			(contribution) =>
				contribution.workCaseId === runtime.progress.workCase.workCaseId &&
				contribution.judgmentId === runtime.judgment.judgmentId &&
				contribution.contributionNeedId === need.contributionNeedId,
		),
		runner: runtime.input.runner,
	});
	if (result.status !== "assessed") {
		return decisionFailure(runtime.progress, "coverage", result);
	}
	const failed = await commitCheckpoint(runtime, "coverage", {
		kind: "coverage-assessed",
		result,
	});
	if (failed) return failed;
	runtime.progress.coverages.push(result.coverage);
	return undefined;
}

async function progressNeed(
	runtime: ProgressionRuntime,
	need: ContributionNeed,
): StageProgress {
	const inventory = await progressNeedInventory(runtime, need);
	if (inventory) return inventory;
	const contexts = await progressNeedContexts(runtime, need);
	if (contexts) return contexts;
	const contributions = await progressNeedContributions(runtime, need);
	if (contributions) return contributions;
	return progressNeedCoverage(runtime, need);
}

function conclusionFailure(
	progress: MutableProgress,
	conclusion: Exclude<SdkJudgmentConclusionResult, ConcludedJudgment>,
): SdkJudgmentProgressionResult {
	if (conclusion.status === "refused") {
		return {
			status: "refused",
			refusal: conclusion.refusal,
			...base(progress),
		};
	}
	if (conclusion.status === "bounded-stop") {
		return {
			status: "bounded-stop",
			stage: "conclusion",
			reason: conclusion.reason,
			...base(progress),
		};
	}
	if (conclusion.status === "runtime-failure") {
		return {
			status: "runtime-failure",
			stage: "conclusion",
			message: conclusion.message,
			...base(progress),
		};
	}
	return invariantFailure(
		progress,
		"conclusion",
		conclusion.code,
		conclusion.message,
	);
}

async function progressConclusion(
	runtime: ProgressionRuntime,
): Promise<SdkJudgmentProgressionResult> {
	const stopped = consumeStep(runtime, "conclusion");
	if (stopped) return stopped;
	const conclusion = await concludeJudgmentWithSdk({
		request: runtime.input.request,
		contract: runtime.judgment,
		coverages: runtime.progress.coverages.filter(
			(coverage) => coverage.judgmentId === runtime.judgment.judgmentId,
		),
		runner: runtime.input.runner,
	});
	if (conclusion.status !== "concluded") {
		return conclusionFailure(runtime.progress, conclusion);
	}
	const recorded = recordWorkCaseConclusion(
		runtime.progress.workCase,
		conclusion.conclusion,
	);
	if (recorded.status === "invalid") {
		return invariantFailure(
			runtime.progress,
			"conclusion",
			recorded.error.code,
			recorded.error.message,
		);
	}
	const checkpoint: SdkJudgmentCheckpoint = {
		kind: "judgment-concluded",
		result: conclusion,
		workCase: recorded.value,
	};
	const failed = await commitCheckpoint(runtime, "conclusion", checkpoint);
	if (failed) return failed;
	runtime.progress.workCase = recorded.value;
	return {
		status: "concluded",
		conclusionId: conclusion.conclusion.conclusionId,
		...base(runtime.progress),
	};
}

function initializeRuntime(
	input: SdkJudgmentProgressionInput,
): ProgressionRuntime | SdkJudgmentProgressionResult {
	const maximumSteps = positiveInteger(input.maxSteps, "maxSteps");
	const progress: MutableProgress = {
		workCase: input.state.workCase,
		applicabilityAssessments: [...input.state.applicabilityAssessments],
		assignments: [...input.state.assignments],
		selections: [...input.state.selections],
		contexts: [...input.state.contexts],
		contributions: [...input.state.contributions],
		coverages: [...input.state.coverages],
		steps: 0,
		checkpoints: 0,
	};
	if (input.capabilities.length === 0) {
		return invariantFailure(
			progress,
			"inventory",
			"empty-capability-inventory",
			"Judgment progression requires the complete Pi-admitted Capability inventory.",
		);
	}
	const capabilityNames = new Set(input.capabilities.map(({ name }) => name));
	const capabilityRevisions = new Set(
		input.capabilities.map(
			({ entry }) => entry.capability.capabilityRevisionId,
		),
	);
	if (
		capabilityNames.size !== input.capabilities.length ||
		capabilityRevisions.size !== input.capabilities.length
	) {
		return invariantFailure(
			progress,
			"inventory",
			"duplicate-capability-inventory",
			"Pi-admitted Capability names and revisions must be unique.",
		);
	}
	if (progress.workCase.openJudgments.length !== 1) {
		return invariantFailure(
			progress,
			"inventory",
			"single-open-judgment-required",
			"Judgment progression requires exactly one current open Judgment.",
		);
	}
	const judgment = progress.workCase.openJudgments[0];
	if (judgment === undefined) {
		throw new Error("unreachable open Judgment state");
	}
	return { input, progress, maximumSteps, judgment };
}

/**
 * Progresses one already-open canonical Judgment through its complete admitted
 * Capability inventory, sealed Contexts, local Contributions, Need Coverage,
 * and upper Conclusion. Every accepted transition is acknowledged by the host
 * checkpoint before dependent work begins.
 */
export async function progressJudgmentWithSdk(
	input: SdkJudgmentProgressionInput,
): Promise<SdkJudgmentProgressionResult> {
	const initialized = initializeRuntime(input);
	if (!("judgment" in initialized)) return initialized;
	for (const need of initialized.judgment.contributionNeeds) {
		const stopped = await progressNeed(initialized, need);
		if (stopped) return stopped;
	}
	return progressConclusion(initialized);
}
