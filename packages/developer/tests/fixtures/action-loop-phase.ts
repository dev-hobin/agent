import type { JudgmentConclusion } from "../../src/action-loop/judgment/close-judgment.ts";
import type { OpenJudgment } from "../../src/action-loop/judgment/open-judgment.ts";
import {
	concludeActionLoopJudgment,
	initialActionLoopPhase,
	openActionLoopJudgment,
	type ActionLoopPhase,
} from "../../src/action-loop/work/action-loop-phase.ts";

function openedJudgmentFor(conclusion: JudgmentConclusion): OpenJudgment {
	return Object.freeze({
		workCaseId: conclusion.workCaseId,
		judgmentId: conclusion.judgmentId,
		category: conclusion.category,
		subject: conclusion.subject,
		contextRevisionId: conclusion.contextRevisionId,
		requirements: Object.freeze([]),
		question: `Test Judgment for ${conclusion.subject}`,
		contributionNeeds: Object.freeze([]),
		basis: Object.freeze(["The fixture follows the canonical phase path."]),
		provenance: Object.freeze({ kind: "model", source: "sdk:test" }),
		status: "open",
	});
}

export function advancePhaseWithConclusion(
	current: ActionLoopPhase,
	conclusion: JudgmentConclusion,
): ActionLoopPhase {
	const opened = openActionLoopJudgment(
		current,
		openedJudgmentFor(conclusion),
	);
	if (opened.status === "invalid") throw new Error(opened.error.message);
	const concluded = concludeActionLoopJudgment(opened.value, conclusion);
	if (concluded.status === "invalid") throw new Error(concluded.error.message);
	return concluded.value;
}

export function phaseAfterConclusions(
	workCaseId: string,
	conclusions: readonly JudgmentConclusion[],
): ActionLoopPhase {
	let current: ActionLoopPhase = initialActionLoopPhase(workCaseId);
	for (const conclusion of conclusions) {
		current = advancePhaseWithConclusion(current, conclusion);
	}
	return current;
}
