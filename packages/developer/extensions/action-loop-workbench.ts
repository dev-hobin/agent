import type { CompletedWorkCase } from "../src/action-loop/work/complete-work-case.ts";
import type { LiveCapabilityInventoryResult } from "./action-loop-capability-inventory.ts";
import type { ActionLoopSessionEvent } from "./action-loop-session-event.ts";
import {
	isLiveBlockedWorkCaseState,
	isLivePausedWorkCaseState,
	isLiveWaitingWorkCaseState,
	type LiveHeldWorkCaseState,
	type LiveWorkCaseState,
} from "./action-loop-work-case.ts";

export type ActionLoopWorkbenchStatus =
	| "off"
	| "preparing"
	| "idle"
	| "active"
	| "paused"
	| "waiting"
	| "blocked"
	| "completed"
	| "unavailable";

export type ActionLoopWorkbenchSectionId =
	| "overview"
	| "judgments"
	| "evidence"
	| "actions"
	| "continuity"
	| "history"
	| "settings";

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
	readonly value: string;
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
	readonly capabilityInventory?: LiveCapabilityInventoryResult;
	readonly history?: readonly ActionLoopSessionEvent[];
	readonly replayPending?: boolean;
	readonly replayUnavailable?: boolean;
}

const INTERNAL_ID =
	/\b(?:action_candidate|action_clearance|assignment|capability|caprev|closure_claim|closure_target|conclusion|context|contribution|effect|judgment|observation|remediation|revision|sealed|selection|transition|work_case|work_case_block|work_case_pause|work_case_wait)_[a-z0-9]+\b/giu;
const INTERNAL_HASH = /\b[a-f0-9]{64}\b/giu;

function safeText(value: string): string {
	return value
		.replace(INTERNAL_ID, "[internal record]")
		.replace(INTERNAL_HASH, "[internal hash]");
}

function item(
	title: string,
	summary: string,
	tone: ActionLoopWorkbenchItem["tone"] = "normal",
	details: readonly ActionLoopWorkbenchDetail[] = [],
): ActionLoopWorkbenchItem {
	return Object.freeze({
		title: safeText(title),
		summary: safeText(summary),
		tone,
		details: Object.freeze(details),
	});
}

function detail(
	label: string,
	lines: readonly string[],
): ActionLoopWorkbenchDetail | undefined {
	const values = lines.map((line) => safeText(line.trim())).filter(Boolean);
	return values.length > 0
		? Object.freeze({ label, lines: Object.freeze(values) })
		: undefined;
}

function details(
	...values: Array<ActionLoopWorkbenchDetail | undefined>
): readonly ActionLoopWorkbenchDetail[] {
	return Object.freeze(values.filter((value) => value !== undefined));
}

function workbenchStatusTone(
	status: ActionLoopWorkbenchStatus,
): ActionLoopWorkbenchItem["tone"] {
	if (status === "blocked" || status === "unavailable") return "error";
	if (status === "waiting" || status === "preparing") return "warning";
	if (status === "completed") return "success";
	return "normal";
}

function status(runtime: ActionLoopWorkbenchRuntime): {
	readonly value: ActionLoopWorkbenchStatus;
	readonly label: string;
	readonly next: string;
} {
	if (!runtime.enabled)
		return { value: "off", label: "Off", next: "Turn Developer on to begin." };
	if (runtime.replayPending)
		return {
			value: "unavailable",
			label: "Recovery pending",
			next: "Bind the current Skill inventory and replay the existing Work Case before new work.",
		};
	if (runtime.replayUnavailable)
		return {
			value: "unavailable",
			label: "Recovery required",
			next: "Turn Developer off only if you intend to discard unavailable branch ownership.",
		};
	if (runtime.capabilityInventory === undefined)
		return {
			value: "preparing",
			label: "Preparing",
			next: "Prepare the current Pi Skill inventory before starting work.",
		};
	if (runtime.capabilityInventory.status === "rejected")
		return {
			value: "unavailable",
			label: "Capability unavailable",
			next: `Resolve ${runtime.capabilityInventory.error.code}: ${runtime.capabilityInventory.error.message}`,
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

function capabilityItem(
	inventory: LiveCapabilityInventoryResult,
): ActionLoopWorkbenchItem {
	if (inventory.status === "rejected") {
		return item(
			"Capability readiness",
			`${inventory.error.code}: ${inventory.error.message}`,
			"error",
			details(detail("Source", [inventory.error.path])),
		);
	}
	const summary = inventory.value.summary;
	return item(
		"Capabilities",
		`${summary.bound} bound · ${summary.unavailable} unavailable · ${summary.excluded} excluded`,
		summary.unavailable > 0 ? "warning" : "success",
		details(
			detail(
				"Unavailable",
				inventory.value.inventory.unavailable.map(
					(entry) =>
						`${entry.label}: ${entry.error.code} · ${entry.error.message}`,
				),
			),
		),
	);
}

function heldItem(
	held: LiveHeldWorkCaseState,
): ActionLoopWorkbenchItem | undefined {
	if (isLivePausedWorkCaseState(held)) {
		return item("Paused because", held.workCase.pause.reason, "warning");
	}
	if (isLiveWaitingWorkCaseState(held)) {
		return item(
			"Waiting for",
			held.workCase.wait.externalCondition,
			"warning",
			details(detail("Continue when", [held.workCase.wait.resumePredicate])),
		);
	}
	if (isLiveBlockedWorkCaseState(held)) {
		return item(
			"Blocked because",
			held.workCase.block.reason,
			"error",
			details(
				detail(
					"Current blockers",
					held.workCase.block.blockerDispositions.map(
						(blocker) => `${blocker.code} · ${blocker.basis.join(" ")}`,
					),
				),
			),
		);
	}
	return undefined;
}

const HISTORY_TITLES: Readonly<Record<ActionLoopSessionEvent["kind"], string>> = {
	"work-case-opened": "Work Case opened",
	"judgment-opened": "Judgment opened",
	"capability-inventory-assessed": "Capabilities assessed",
	"references-selected": "References selected",
	"unstructured-context-sealed": "Context sealed",
	"contribution-accepted": "Skill contribution accepted",
	"host-contribution-accepted": "Observed contribution accepted",
	"coverage-assessed": "Need coverage assessed",
	"judgment-concluded": "Judgment concluded",
	"action-cleared": "Action cleared",
	"effect-begun": "Effect accounting begun",
	"effect-observed": "Effect observed",
	"effect-settled": "Effect settled",
	"effect-remediated": "Effect remediated",
	"work-case-completed": "Work Case completed",
	"work-case-paused": "Work Case paused",
	"paused-work-case-resumed": "Paused work resumed",
	"work-case-waiting": "Work Case waiting",
	"waiting-work-case-resumed": "Waiting work resumed",
	"work-case-blocked": "Work Case blocked",
	"blocked-work-case-resumed": "Blocked work resumed",
};

function historyTone(
	kind: ActionLoopSessionEvent["kind"],
): ActionLoopWorkbenchItem["tone"] {
	if (kind === "work-case-blocked") return "error";
	if (kind === "work-case-paused" || kind === "work-case-waiting") {
		return "warning";
	}
	if (
		kind === "work-case-completed" ||
		kind === "judgment-concluded" ||
		kind === "effect-settled" ||
		kind === "effect-remediated"
	) {
		return "success";
	}
	return "normal";
}

/** Projects canonical work into semantic TUI content without exposing identities. */
export function inspectActionLoopWorkbench(
	runtime: ActionLoopWorkbenchRuntime,
): ActionLoopWorkbenchSnapshot {
	const currentStatus = status(runtime);
	const ownership = runtime.activeWorkCase ?? runtime.heldWorkCase;
	const workCase = ownership?.workCase ?? runtime.completedWorkCase;
	let headline = "No current work";
	if (workCase) headline = workCase.outcome.statement;
	else if (runtime.replayPending) {
		headline = "Current branch ownership awaits inventory-bound recovery.";
	} else if (runtime.capabilityInventory?.status === "rejected") {
		headline = `Capability readiness failed: ${runtime.capabilityInventory.error.code}`;
	}

	const overviewItems: ActionLoopWorkbenchItem[] = [
		item("Status", currentStatus.label, workbenchStatusTone(currentStatus.value)),
	];
	if (runtime.capabilityInventory) {
		overviewItems.push(capabilityItem(runtime.capabilityInventory));
	}
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
		const held = heldItem(runtime.heldWorkCase);
		if (held) overviewItems.push(held);
	}

	const judgmentItems = workCase
		? [
				...workCase.openJudgments.map((judgment) =>
					item(
						`${judgment.category} · open`,
						judgment.question,
						"warning",
						details(
							detail("Subject", [judgment.subject]),
							detail(
								"Requirements",
								judgment.requirements.map(
									(requirement) => requirement.statement,
								),
							),
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
				...ownership.selections.map((selection) =>
					item(
						"Reference selection",
						selection.status,
						selection.status === "ready" ? "success" : "warning",
						details(detail("Selected", selection.selectedPaths)),
					),
				),
				...ownership.contexts.map((context) =>
					item(
						"Sealed Skill context",
						"routing" in context ? context.routing : "structured",
						"success",
					),
				),
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
				...ownership.coverages.map((coverage) =>
					item(
						"Need coverage",
						coverage.status,
						coverage.status === "covered" ? "success" : "warning",
						details(detail("Basis", coverage.basis)),
					),
				),
			]
		: [];

	const actionItems = workCase
		? [
				...workCase.actionCandidates.map((candidate) =>
					item(
						"Action candidate",
						candidate.summary,
						"warning",
						details(detail("Intended effects", candidate.intendedEffects)),
					),
				),
				...workCase.actionClearances.map((clearance) =>
					item(
						"Action clearance",
						`${clearance.controlledAction.kind} · one exact use`,
						"success",
						details(detail("Intended effects", clearance.intendedEffects)),
					),
				),
				...workCase.effects.map((effect) =>
					item(
						"Pending effect",
						effect.controlledAction.kind,
						"warning",
						details(detail("Intended effects", effect.intendedEffects)),
					),
				),
				...workCase.currentEffectAssessments.map((assessment) =>
					item(
						"Effect assessment",
						assessment.outcome,
						assessment.outcome === "observed-success"
							? "success"
							: assessment.outcome === "pending" ||
									assessment.outcome === "unknown"
								? "warning"
								: "error",
						details(detail("Basis", assessment.basis)),
					),
				),
				...workCase.effectRemediations.map((remediation) =>
					item(
						"Effect remediation",
						"Observed-success remediation accepted",
						"success",
						details(detail("Basis", remediation.basis)),
					),
				),
			]
		: [];

	const continuityItems: ActionLoopWorkbenchItem[] = [];
	if (runtime.heldWorkCase) {
		const held = heldItem(runtime.heldWorkCase);
		if (held) continuityItems.push(held);
	}
	if (workCase) {
		continuityItems.push(
			item(
				"Continuity",
				workCase.continuityIds.length === 0
					? "No pause, wait, block, or resume transition"
					: `${workCase.continuityIds.length} continuity transition${workCase.continuityIds.length === 1 ? "" : "s"}`,
				"muted",
			),
		);
	}

	const historyItems = (runtime.history ?? []).map((event) =>
		item(
			HISTORY_TITLES[event.kind],
			"Durably accepted canonical checkpoint",
			historyTone(event.kind),
		),
	);
	const sections: readonly ActionLoopWorkbenchSection[] = Object.freeze([
		{
			id: "overview",
			label: "Overview",
			value: currentStatus.label,
			items: Object.freeze(overviewItems),
		},
		{
			id: "judgments",
			label: "Judgments",
			value: String(judgmentItems.length),
			items: Object.freeze(judgmentItems),
		},
		{
			id: "evidence",
			label: "Evidence",
			value: String(evidenceItems.length),
			items: Object.freeze(evidenceItems),
		},
		{
			id: "actions",
			label: "Actions & Effects",
			value: String(actionItems.length),
			items: Object.freeze(actionItems),
		},
		{
			id: "continuity",
			label: "Continuity",
			value: String(continuityItems.length),
			items: Object.freeze(continuityItems),
		},
		{
			id: "history",
			label: "History",
			value: String(historyItems.length),
			items: Object.freeze(historyItems),
		},
		{
			id: "settings",
			label: "Settings",
			value: runtime.enabled ? "On" : "Off",
			items: Object.freeze([
				item(
					"Activation",
					runtime.enabled ? "Developer is on" : "Developer is off",
					runtime.enabled ? "success" : "muted",
					details(
						detail("Change", [
							"Use /developer on or /developer off. Turning off discards current protocol ownership only after confirmation.",
						]),
					),
				),
			]),
		},
	]);
	return Object.freeze({
		status: currentStatus.value,
		statusLabel: currentStatus.label,
		headline: safeText(headline),
		next: safeText(currentStatus.next),
		sections,
	});
}
