import type { ActionCandidateProvenance } from "../src/action-loop/action/accept-action-candidate.ts";
import {
	openWorkCase,
	type ActiveWorkCase,
	type OutcomeProposal,
} from "../src/action-loop/work/work-case.ts";

export const ACTION_LOOP_OPEN_WORK_CASE_TOOL = "developer_open_work_case";
export const MAX_LIVE_OUTCOME_TEXT = 4_096;
export const MAX_LIVE_OUTCOME_ITEMS = 32;
export const MAX_LIVE_BASIS_ITEMS = 16;

export interface LiveWorkCaseProposal {
	readonly outcome: OutcomeProposal;
	readonly basis: readonly string[];
	readonly provenance: ActionCandidateProvenance;
}

export interface LiveWorkCaseState {
	readonly workCase: ActiveWorkCase;
	readonly contextRevisionId: string;
	readonly openingBasis: readonly string[];
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
			contextRevisionId: opened.value.revisionId,
			openingBasis: basis,
		}),
	};
}

export function liveWorkCasePrompt(
	state: LiveWorkCaseState | undefined,
): string {
	if (state === undefined) {
		return "No active Action Loop Work Case. Before consequential Developer routing or action, propose one bounded Outcome with developer_open_work_case; do not infer permission or completion from opening it.";
	}
	const { workCase, openingBasis } = state;
	const judgment = workCase.openJudgments[0];
	const judgmentLines =
		judgment === undefined
			? ["Open Judgment: none"]
			: [
					`Open Judgment: ${judgment.judgmentId} · ${judgment.category} · ${judgment.question}`,
					`Closure Requirements: ${judgment.requirements.map(({ statement }) => statement).join(" | ")}`,
					`Contribution Needs: ${judgment.contributionNeeds.map(({ contributionNeedId, function: needFunction }) => `${contributionNeedId}: ${needFunction}`).join(" | ")}`,
				];
	return [
		`Active Action Loop Work Case: ${workCase.workCaseId}@${workCase.revisionId}`,
		`Outcome: ${workCase.outcome.statement}`,
		`Context revision: ${state.contextRevisionId}`,
		`Acceptance conditions: ${workCase.outcome.acceptanceConditions.join(" | ")}`,
		`Constraints: ${workCase.outcome.constraints.join(" | ") || "none"}`,
		`Opening basis: ${openingBasis.join(" | ")}`,
		...judgmentLines,
		"This process-local projection preserves active Outcome continuity but does not imply Action Clearance or completion.",
	].join("\n");
}
