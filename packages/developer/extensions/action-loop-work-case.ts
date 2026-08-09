import type { ActionCandidateProvenance } from "../src/action-loop/action/accept-action-candidate.ts";
import type { EffectObservation } from "../src/action-loop/effect/effect-observation.ts";
import type { ActionLoopState } from "../src/action-loop/work/action-loop-state.ts";
import type { BlockedWorkCase } from "../src/action-loop/work/block-work-case.ts";
import type { PausedWorkCase } from "../src/action-loop/work/pause-work-case.ts";
import type { WaitingWorkCase } from "../src/action-loop/work/wait-work-case.ts";
import {
	openWorkCase,
	type OutcomeProposal,
} from "../src/action-loop/work/work-case.ts";

export const MAX_LIVE_OUTCOME_TEXT = 4_096;
export const MAX_LIVE_OUTCOME_ITEMS = 32;
export const MAX_LIVE_BASIS_ITEMS = 16;

export interface LiveWorkCaseProposal {
	readonly outcome: OutcomeProposal;
	readonly basis: readonly string[];
	readonly provenance: ActionCandidateProvenance;
}

export interface LivePiActionProposal {
	readonly actionCandidateId: string;
	readonly toolName: "bash" | "edit" | "write";
	readonly toolInput: Readonly<Record<string, unknown>>;
}

export interface LiveWorkCaseState extends ActionLoopState {
	readonly openingBasis: readonly string[];
	readonly piActionProposals: readonly LivePiActionProposal[];
	readonly effectObservations: readonly EffectObservation[];
}

export type LivePausedWorkCaseState = Omit<LiveWorkCaseState, "workCase"> & {
	readonly workCase: PausedWorkCase;
};

export type LiveWaitingWorkCaseState = Omit<LiveWorkCaseState, "workCase"> & {
	readonly workCase: WaitingWorkCase;
};

export type LiveBlockedWorkCaseState = Omit<LiveWorkCaseState, "workCase"> & {
	readonly workCase: BlockedWorkCase;
};

export type LiveHeldWorkCaseState =
	| LivePausedWorkCaseState
	| LiveWaitingWorkCaseState
	| LiveBlockedWorkCaseState;

export type LiveWorkCaseOwnership = LiveWorkCaseState | LiveHeldWorkCaseState;

export function isLivePausedWorkCaseState(
	state: LiveHeldWorkCaseState,
): state is LivePausedWorkCaseState {
	return state.workCase.status === "paused";
}

export function isLiveWaitingWorkCaseState(
	state: LiveHeldWorkCaseState,
): state is LiveWaitingWorkCaseState {
	return state.workCase.status === "waiting";
}

export function isLiveBlockedWorkCaseState(
	state: LiveHeldWorkCaseState,
): state is LiveBlockedWorkCaseState {
	return state.workCase.status === "blocked";
}

export type LiveWorkCaseOpeningResult =
	| { readonly status: "opened"; readonly value: LiveWorkCaseState }
	| { readonly status: "unchanged"; readonly value: LiveWorkCaseState }
	| { readonly status: "invalid"; readonly message: string }
	| { readonly status: "active-work-case-exists"; readonly message: string };

function boundedText(value: unknown): value is string {
	return (
		typeof value === "string" &&
		value.trim().length > 0 &&
		value.trim().length <= MAX_LIVE_OUTCOME_TEXT
	);
}

function boundedList(
	values: readonly string[],
	maximumItems: number,
	allowEmpty: boolean,
): readonly string[] | undefined {
	if (
		!Array.isArray(values) ||
		values.length > maximumItems ||
		(!allowEmpty && values.length === 0)
	) {
		return undefined;
	}
	const normalized: string[] = [];
	const seen = new Set<string>();
	for (const value of values) {
		if (!boundedText(value)) return undefined;
		const text = value.trim();
		if (seen.has(text)) return undefined;
		seen.add(text);
		normalized.push(text);
	}
	normalized.sort((left, right) => left.localeCompare(right));
	return Object.freeze(normalized);
}

/** Accepts one bounded opening proposal without replacing canonical active work. */
export function openLiveWorkCase(
	current: LiveWorkCaseState | undefined,
	proposal: LiveWorkCaseProposal,
): LiveWorkCaseOpeningResult {
	if (!boundedText(proposal.outcome?.statement)) {
		return {
			status: "invalid",
			message: "Work Case Outcome statement must be bounded and nonblank",
		};
	}
	const acceptanceConditions = boundedList(
		proposal.outcome.acceptanceConditions,
		MAX_LIVE_OUTCOME_ITEMS,
		false,
	);
	if (acceptanceConditions === undefined) {
		return {
			status: "invalid",
			message:
				"Work Case requires unique bounded acceptance conditions within the item limit",
		};
	}
	const constraints = boundedList(
		proposal.outcome.constraints,
		MAX_LIVE_OUTCOME_ITEMS,
		true,
	);
	if (constraints === undefined) {
		return {
			status: "invalid",
			message:
				"Work Case constraints must be unique, bounded, and within the item limit",
		};
	}
	const basis = boundedList(proposal.basis, MAX_LIVE_BASIS_ITEMS, false);
	if (basis === undefined) {
		return {
			status: "invalid",
			message: "Work Case opening requires explicit unique bounded basis",
		};
	}
	const opened = openWorkCase({
		outcome: {
			statement: proposal.outcome.statement,
			acceptanceConditions,
			constraints,
		},
		provenance: proposal.provenance,
	});
	if (opened.status === "invalid") {
		return { status: "invalid", message: opened.error.message };
	}
	if (current !== undefined) {
		if (current.workCase.workCaseId === opened.value.workCaseId) {
			return { status: "unchanged", value: current };
		}
		return {
			status: "active-work-case-exists",
			message:
				"A different active Work Case already owns canonical work; complete, block, or pause it before opening another Outcome",
		};
	}
	return {
		status: "opened",
		value: Object.freeze({
			workCase: opened.value,
			openingBasis: basis,
			applicabilityAssessments: Object.freeze([]),
			assignments: Object.freeze([]),
			selections: Object.freeze([]),
			contexts: Object.freeze([]),
			contributions: Object.freeze([]),
			coverages: Object.freeze([]),
			piActionProposals: Object.freeze([]),
			effectObservations: Object.freeze([]),
		}),
	};
}

export function liveWorkCasePrompt(
	state: LiveWorkCaseOwnership | undefined,
): string {
	if (state === undefined) {
		return "No active Action Loop Work Case. Use developer_progress_action_loop as the primary entry point; it must checkpoint bounded ownership before consequential routing or action.";
	}
	const { workCase, openingBasis } = state;
	const judgment = workCase.openJudgments[0];
	const actionLines = [
		...state.piActionProposals.map(
			(proposal) =>
				`Cleared Pi Action input: ${proposal.toolName} ${JSON.stringify(proposal.toolInput)}`,
		),
		...workCase.actionCandidates.map(
			(candidate) =>
				`Action Candidate: ${candidate.summary} · ${candidate.controlledAction.kind} · intended ${candidate.intendedEffects.join(" | ")} · clearance not implied`,
		),
		...workCase.actionClearances.map(
			(clearance) =>
				`Action Clearance: ${clearance.controlledAction.kind} · intended ${clearance.intendedEffects.join(" | ")}`,
		),
		...workCase.effects.map(
			(effect) =>
				`Effect: ${effect.status} · ${effect.controlledAction.kind} · intended ${effect.intendedEffects.join(" | ")}`,
		),
		...state.effectObservations.map(
			(observation) =>
				`Effect Observation: ${observation.evidence.kind} · ${observation.statement} · settlement not implied`,
		),
		...workCase.currentEffectAssessments.map(
			(assessment) => `Effect Assessment: ${assessment.outcome}`,
		),
		...workCase.effectRemediations.map(
			(remediation) =>
				`Effect Remediation: observed successful remediation · ${remediation.basis.join(" | ")}`,
		),
	];
	if (actionLines.length === 0) actionLines.push("Actions: none");
	const judgmentLines =
		judgment === undefined
			? ["Open Judgment: none"]
			: [
					`Open Judgment: ${judgment.category} · ${judgment.question}`,
					`Closure Requirements: ${judgment.requirements.map(({ statement }) => statement).join(" | ")}`,
					`Contribution Needs: ${judgment.requirements
						.flatMap((requirement) =>
							requirement.contributionNeedIds.flatMap((contributionNeedId) => {
								const need = judgment.contributionNeeds.find(
									(candidate) =>
										candidate.contributionNeedId === contributionNeedId,
								);
								return need
									? [
											JSON.stringify({
												requirement: requirement.statement,
												function: need.function,
											}),
										]
									: [];
							}),
						)
						.join(" | ")}`,
				];
	const conclusionLines =
		workCase.conclusions.length === 0
			? ["Judgment Conclusions: none"]
			: workCase.conclusions.map(
					(conclusion) =>
						`Judgment Conclusion: ${JSON.stringify({ category: conclusion.category, subject: conclusion.subject, answer: conclusion.answer })}`,
				);
	const applicabilityLines =
		state.applicabilityAssessments.length === 0
			? ["Capability applicability: none assessed"]
			: state.applicabilityAssessments.map(
					(assessment) =>
						`Capability applicability for a current Need: ${assessment.status}`,
				);
	const assignmentLines =
		state.assignments.length === 0
			? ["Capability assignments: none"]
			: state.assignments.map(
					() => "Capability assignment: bound to one current Need",
				);
	const selectionLines =
		state.selections.length === 0
			? ["Reference selections: none"]
			: state.selections.map(
					(selection) =>
						`Reference selection: ${selection.status} · selected=${selection.selectedPaths.join(", ") || "none"}`,
				);
	const contextLines =
		state.contexts.length === 0
			? ["Sealed Skill contexts: none"]
			: state.contexts.map((context) => {
					let routing = "structured";
					if ("routing" in context) routing = context.routing;
					return `Sealed Skill context: ${routing}`;
				});
	const contributionLines =
		state.contributions.length === 0
			? ["Skill Contributions: none"]
			: state.contributions.map(
					(contribution) =>
						`Contribution for a current Need: ${contribution.localStatus}`,
				);
	const coverageLines =
		state.coverages.length === 0
			? ["Need Coverage: none"]
			: state.coverages.map(
					(coverage) => `Need Coverage for a current Need: ${coverage.status}`,
				);
	let continuityLines: string[] = [];
	if (workCase.status === "paused") {
		continuityLines = [
			`Pause: ${workCase.pause.reason}`,
			"Resume requires an explicit current human decision on this durable Pi session branch.",
		];
	} else if (workCase.status === "waiting") {
		continuityLines = [
			`Wait: ${workCase.wait.externalCondition}`,
			`Resume predicate: ${workCase.wait.resumePredicate}`,
			"Resume requires a current Observation that satisfies this exact predicate.",
		];
	} else if (workCase.status === "blocked") {
		continuityLines = [
			`Block: ${workCase.block.reason}`,
			`Accounted blockers: ${workCase.block.blockerDispositions.map(({ code, basis }) => `${code} · ${basis.join(" ")}`).join(" | ")}`,
			"Resume requires an observed change and concrete continuation.",
		];
	}
	const statusLabel =
		workCase.status === "active"
			? "Active"
			: workCase.status === "paused"
				? "Paused"
				: workCase.status === "waiting"
					? "Waiting"
					: "Blocked";
	return [
		`${statusLabel} Action Loop Work Case:`,
		`Outcome: ${workCase.outcome.statement}`,
		`Acceptance conditions: ${workCase.outcome.acceptanceConditions.join(" | ")}`,
		`Constraints: ${workCase.outcome.constraints.join(" | ") || "none"}`,
		`Opening basis: ${openingBasis.join(" | ")}`,
		...judgmentLines,
		...conclusionLines,
		...applicabilityLines,
		...assignmentLines,
		...selectionLines,
		...contextLines,
		...contributionLines,
		...coverageLines,
		...actionLines,
		...continuityLines,
		"This current Pi session-branch projection preserves Outcome continuity but does not imply Action Clearance or completion.",
	].join("\n");
}
