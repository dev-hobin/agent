import type { CompletedWorkCase } from "../src/action-loop/work/complete-work-case.ts";
import {
	isLiveBlockedWorkCaseState,
	isLivePausedWorkCaseState,
	isLiveWaitingWorkCaseState,
	type LiveHeldWorkCaseState,
	type LiveWorkCaseState,
} from "./action-loop-work-case.ts";

export type ActionLoopWorkbenchStatus =
	| "off"
	| "idle"
	| "active"
	| "paused"
	| "waiting"
	| "blocked"
	| "completed"
	| "unavailable";

export type ActionLoopWorkbenchSectionId =
	| "overview"
	| "decisions"
	| "evidence"
	| "effects"
	| "history";

export interface ActionLoopWorkbenchDetail {
	readonly label: string;
	readonly lines: readonly string[];
}

export interface ActionLoopWorkbenchItem {
	readonly title: string;
	readonly summary: string;
	readonly tone: "normal" | "success" | "warning" | "error" | "muted";
	readonly details: readonly ActionLoopWorkbenchDetail[];
}

export interface ActionLoopWorkbenchSection {
	readonly id: ActionLoopWorkbenchSectionId;
	readonly label: string;
	readonly items: readonly ActionLoopWorkbenchItem[];
}

export interface ActionLoopWorkbenchSnapshot {
	readonly status: ActionLoopWorkbenchStatus;
	readonly statusLabel: string;
	readonly headline: string;
	readonly next: string;
	readonly sections: readonly ActionLoopWorkbenchSection[];
}

export interface ActionLoopWorkbenchRuntime {
	readonly enabled: boolean;
	readonly activeWorkCase?: LiveWorkCaseState;
	readonly heldWorkCase?: LiveHeldWorkCaseState;
	readonly completedWorkCase?: CompletedWorkCase;
	readonly replayUnavailable?: boolean;
}

function item(
	title: string,
	summary: string,
	tone: ActionLoopWorkbenchItem["tone"] = "normal",
	details: readonly ActionLoopWorkbenchDetail[] = [],
): ActionLoopWorkbenchItem {
	return Object.freeze({ title, summary, tone, details: Object.freeze(details) });
}

function detail(
	label: string,
	lines: readonly string[],
): ActionLoopWorkbenchDetail | undefined {
	const values = lines.map((line) => line.trim()).filter(Boolean);
	return values.length > 0
		? Object.freeze({ label, lines: Object.freeze(values) })
		: undefined;
}

function details(
	...values: Array<ActionLoopWorkbenchDetail | undefined>
): readonly ActionLoopWorkbenchDetail[] {
	return Object.freeze(values.filter((value) => value !== undefined));
}

function status(runtime: ActionLoopWorkbenchRuntime): {
	readonly value: ActionLoopWorkbenchStatus;
	readonly label: string;
	readonly next: string;
} {
	if (!runtime.enabled)
		return { value: "off", label: "Off", next: "Turn Developer on to begin." };
	if (runtime.replayUnavailable)
		return {
			value: "unavailable",
			label: "Recovery required",
			next: "Turn Developer off to discard unavailable branch ownership.",
		};
	if (runtime.heldWorkCase) {
		if (isLivePausedWorkCaseState(runtime.heldWorkCase))
			return {
				value: "paused",
				label: "Paused",
				next: "Send a normal message when you want to continue.",
			};
		if (isLiveWaitingWorkCaseState(runtime.heldWorkCase))
			return {
				value: "waiting",
				label: "Waiting",
				next: "Send a normal update when the external condition changes.",
			};
		return {
			value: "blocked",
			label: "Blocked",
			next: "Describe the observed blocker change and available next step.",
		};
	}
	if (runtime.activeWorkCase)
		return {
			value: "active",
			label: "Active",
			next: "Continue the current judgment, action, or evidence work.",
		};
	if (runtime.completedWorkCase)
		return {
			value: "completed",
			label: "Completed",
			next: "Start new work with a normal request when needed.",
		};
	return {
		value: "idle",
		label: "Ready",
		next: "Describe the outcome you want in a normal message.",
	};
}

/** Projects canonical work into semantic TUI content without exposing identities. */
export function inspectActionLoopWorkbench(
	runtime: ActionLoopWorkbenchRuntime,
): ActionLoopWorkbenchSnapshot {
	const currentStatus = status(runtime);
	const ownership = runtime.activeWorkCase ?? runtime.heldWorkCase;
	const workCase = ownership?.workCase ?? runtime.completedWorkCase;
	const headline = workCase?.outcome.statement ?? "No current work";
	const overviewItems: ActionLoopWorkbenchItem[] = [
		item("Status", currentStatus.label, currentStatus.value === "blocked" || currentStatus.value === "unavailable" ? "error" : currentStatus.value === "waiting" ? "warning" : currentStatus.value === "completed" ? "success" : "normal"),
	];
	if (workCase) {
		overviewItems.push(
			item(
				"Outcome",
				workCase.outcome.statement,
				"normal",
				details(
					detail("Acceptance", workCase.outcome.acceptanceConditions),
					detail("Constraints", workCase.outcome.constraints),
				),
			),
		);
	}
	if (runtime.heldWorkCase) {
		if (isLivePausedWorkCaseState(runtime.heldWorkCase)) {
			overviewItems.push(
				item("Paused because", runtime.heldWorkCase.workCase.pause.reason, "muted"),
			);
		} else if (isLiveWaitingWorkCaseState(runtime.heldWorkCase)) {
			overviewItems.push(
				item(
					"Waiting for",
					runtime.heldWorkCase.workCase.wait.externalCondition,
					"warning",
					details(
						detail("Continue when", [runtime.heldWorkCase.workCase.wait.resumePredicate]),
					),
				),
			);
		} else if (isLiveBlockedWorkCaseState(runtime.heldWorkCase)) {
			overviewItems.push(
				item(
					"Blocked because",
					runtime.heldWorkCase.workCase.block.reason,
					"error",
					details(
						detail(
							"Current blockers",
							runtime.heldWorkCase.workCase.block.blockerDispositions.map(
								(blocker) => blocker.basis.join(" "),
							),
						),
					),
				),
			);
		}
	}

	const decisionItems = workCase
		? [
				...workCase.openJudgments.map((judgment) =>
					item(
						`${judgment.category} · open`,
						judgment.question,
						"warning",
						details(
							detail("Subject", [judgment.subject]),
							detail(
								"Needed contributions",
								judgment.contributionNeeds.map((need) => need.function),
							),
						),
					),
				),
				...workCase.conclusions.map((conclusion) =>
					item(
						`${conclusion.category} · concluded`,
						conclusion.answer,
						"success",
						details(
							detail("Subject", [conclusion.subject]),
							detail("Basis", conclusion.basis),
						),
					),
				),
			]
		: [];
	const evidenceItems = ownership
		? [
				...ownership.contributions.map((contribution) =>
					item(
						"Contribution",
						contribution.result,
						contribution.localStatus === "resolved" ? "success" : "warning",
						details(
							detail("Limitations", contribution.limitations),
							detail(
								"Remaining needs",
								contribution.residualNeeds.map((need) => need.description),
							),
						),
					),
				),
				...ownership.needCoverages.map((coverage) =>
					item(
						"Need coverage",
						coverage.status,
						coverage.status === "covered" ? "success" : "warning",
						details(detail("Basis", coverage.basis)),
					),
				),
			]
		: [];
	const effectItems = workCase
		? [
				...workCase.effects.map((effect) =>
					item(
						"Observed action effect",
						effect.intendedEffects.join("; "),
						"warning",
					),
				),
				...workCase.currentEffectAssessments.map((assessment) =>
					item(
						"Effect assessment",
						assessment.outcome,
						assessment.outcome === "observed-success"
							? "success"
							: assessment.outcome === "pending" || assessment.outcome === "unknown"
								? "warning"
								: "error",
						details(detail("Basis", assessment.basis)),
					),
				),
			]
		: [];
	const historyItems = workCase
		? [
				item(
					"Continuity",
					workCase.continuityIds.length === 0
						? "No pause, wait, block, or resume transition"
						: `${workCase.continuityIds.length} continuity transition${workCase.continuityIds.length === 1 ? "" : "s"}`,
					"muted",
				),
			]
		: [];

	const sections: readonly ActionLoopWorkbenchSection[] = Object.freeze([
		{ id: "overview", label: "Overview", items: Object.freeze(overviewItems) },
		{ id: "decisions", label: "Decisions", items: Object.freeze(decisionItems) },
		{ id: "evidence", label: "Evidence", items: Object.freeze(evidenceItems) },
		{ id: "effects", label: "Effects", items: Object.freeze(effectItems) },
		{ id: "history", label: "History", items: Object.freeze(historyItems) },
	]);
	return Object.freeze({
		status: currentStatus.value,
		statusLabel: currentStatus.label,
		headline,
		next: currentStatus.next,
		sections,
	});
}
