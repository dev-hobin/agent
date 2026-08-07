import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { StringEnum } from "@earendil-works/pi-ai";
import {
	DEFAULT_MAX_BYTES,
	DEFAULT_MAX_LINES,
	getMarkdownTheme,
	type ExtensionAPI,
	type ExtensionCommandContext,
	type ExtensionContext,
	type Skill,
	type ToolDefinition,
} from "@earendil-works/pi-coding-agent";
import { Container, Text } from "@earendil-works/pi-tui";
import { Type, type TSchema } from "typebox";

import type { CompletedWorkCase } from "../src/action-loop/work/complete-work-case.ts";
import {
	liveCapabilityInventoryPrompt,
	prepareLiveCapabilityInventory,
	type LiveCapabilityInventoryResult,
} from "./action-loop-capability-inventory.ts";
import {
	ACTION_LOOP_PROGRESS_JUDGMENT_TOOL,
	progressLiveJudgmentWithSdk,
	sdkJudgmentProgressionFailure,
	sdkJudgmentProgressionSummary,
} from "./action-loop-sdk-progression.ts";
import { createPiExtensionSdkRunner } from "./action-loop-sdk-runner.ts";
import {
	ACTION_LOOP_PROPOSE_ACTION_TOOL,
	acceptLivePiActionCandidate,
	assessLiveActionClearance,
	clearedLivePiToolNames,
	matchingLiveActionClearance,
} from "./action-loop-action.ts";
import {
	ACTION_LOOP_RECORD_REMEDIATION_TOOL,
	ACTION_LOOP_SETTLE_EFFECT_TOOL,
	beginLiveActionEffect,
	currentLiveEffectAssessmentId,
	observeLivePiToolResult,
	recordLiveEffectRemediation,
	settleLiveEffect,
} from "./action-loop-effect.ts";
import {
	ACTION_LOOP_ASSESS_CAPABILITY_TOOL,
	assessLiveCapabilityApplicability,
	assignedLiveCapability,
} from "./action-loop-applicability.ts";
import {
	ACTION_LOOP_CLOSE_JUDGMENT_TOOL,
	closeLiveJudgment,
} from "./action-loop-conclusion.ts";
import {
	ACTION_LOOP_COMPLETE_WORK_CASE_TOOL,
	ACTION_LOOP_PREPARE_CLOSURE_TOOL,
	completeLiveWorkCase,
	liveCompletedWorkCasePrompt,
	prepareLiveWorkCaseClosure,
} from "./action-loop-completion.ts";
import {
	ACTION_LOOP_ACCEPT_CONTRIBUTION_TOOL,
	acceptLiveSkillContribution,
} from "./action-loop-contribution.ts";
import {
	ACTION_LOOP_ACCEPT_HOST_CONTRIBUTION_TOOL,
	acceptLiveHostContribution,
} from "./action-loop-host-contribution.ts";
import {
	ACTION_LOOP_ASSESS_COVERAGE_TOOL,
	assessLiveNeedCoverage,
} from "./action-loop-coverage.ts";
import {
	ACTION_LOOP_LOAD_SELECTED_REFERENCE_TOOL,
	ACTION_LOOP_SELECT_REFERENCES_TOOL,
	loadLiveSelectedReference,
	sealLiveUnstructuredCapability,
	selectAndSealLiveStructuredCapability,
} from "./action-loop-context.ts";
import {
	ACTION_LOOP_OPEN_JUDGMENT_TOOL,
	openLiveJudgment,
	selectLiveContributionNeed,
} from "./action-loop-judgment.ts";
import {
	ACTION_LOOP_SESSION_ENTRY,
	ACTION_LOOP_SESSION_PROTOCOL,
	MAX_ACTION_LOOP_BLOCKER_DISPOSITIONS,
	actionLoopActionClearedEvent,
	actionLoopBlockedWorkCaseResumedEvent,
	actionLoopCapabilityAssessedEvent,
	actionLoopContributionAcceptedEvent,
	actionLoopHostContributionAcceptedEvent,
	actionLoopCoverageAssessedEvent,
	actionLoopEffectBegunEvent,
	actionLoopEffectObservedEvent,
	actionLoopEffectRemediatedEvent,
	actionLoopEffectSettledEvent,
	actionLoopJudgmentConcludedEvent,
	actionLoopJudgmentOpenedEvent,
	actionLoopPausedWorkCaseResumedEvent,
	actionLoopReferencesSelectedEvent,
	actionLoopUnstructuredContextSealedEvent,
	actionLoopWorkCaseBlockedEvent,
	actionLoopWorkCaseCompletedEvent,
	actionLoopWaitingWorkCaseResumedEvent,
	actionLoopWorkCaseOpenedEvent,
	actionLoopWorkCasePausedEvent,
	actionLoopWorkCaseWaitingEvent,
	replayActionLoopSession,
	withActionLoopReplayEvent,
	type ActionLoopSessionBranchEntry,
} from "./action-loop-session.ts";
import {
	ACTION_LOOP_BLOCK_WORK_CASE_TOOL,
	ACTION_LOOP_PAUSE_WORK_CASE_TOOL,
	ACTION_LOOP_RESUME_WORK_CASE_TOOL,
	ACTION_LOOP_WAIT_WORK_CASE_TOOL,
	MAX_LIVE_CONTINUITY_TEXT,
	blockLiveWorkCase,
	pauseLiveWorkCase,
	resumeLiveBlockedWorkCase,
	resumeLivePausedWorkCase,
	resumeLiveWaitingWorkCase,
	waitLiveWorkCase,
} from "./action-loop-continuity.ts";
import {
	MAX_LIVE_HOST_OBSERVATIONS,
	admitLiveToolResultObservation,
	admitLiveUserPromptObservation,
	bindLiveHostObservation,
	isDirectSkillMaterialRead,
	liveHostObservationPrompt,
	matchingLiveHostObservation,
	type LiveHostObservation,
} from "./action-loop-host-observation.ts";
import {
	ACTION_LOOP_OPEN_WORK_CASE_TOOL,
	MAX_LIVE_BASIS_ITEMS,
	MAX_LIVE_OUTCOME_ITEMS,
	MAX_LIVE_OUTCOME_TEXT,
	isLiveBlockedWorkCaseState,
	isLivePausedWorkCaseState,
	isLiveWaitingWorkCaseState,
	liveWorkCasePrompt,
	openLiveWorkCase,
	type LiveHeldWorkCaseState,
	type LiveWorkCaseState,
} from "./action-loop-work-case.ts";
import {
	completeDeveloperArgs,
	parseDeveloperCommand,
} from "./developer-command.ts";
import {
	DEVELOPER_MODE_ENTRY,
	decodeDeveloperModeEvent,
	developerModeEvent,
	reconstructDeveloperMode,
} from "./developer-mode.ts";
import { showActionLoopWorkbench } from "./action-loop-workbench-tui.ts";
import { inspectActionLoopWorkbench } from "./action-loop-workbench.ts";
import {
	TOOL_POLICY_LIFECYCLE_ENTRY,
	builtinControlledToolCapabilities,
	reconcileProtocolTools,
	reloadSafeToolPolicyMarker,
	toolPolicyReloadRequiresRestart,
	type ToolPolicyMemory,
} from "./tool-policy.ts";

const TOOL_POLICY_PROTOCOL = "developer-action-loop/tool-policy/v1";
const PROTOCOL_TOOLS = [
	ACTION_LOOP_OPEN_WORK_CASE_TOOL,
	ACTION_LOOP_OPEN_JUDGMENT_TOOL,
	ACTION_LOOP_PROGRESS_JUDGMENT_TOOL,
	ACTION_LOOP_ASSESS_CAPABILITY_TOOL,
	ACTION_LOOP_SELECT_REFERENCES_TOOL,
	ACTION_LOOP_LOAD_SELECTED_REFERENCE_TOOL,
	ACTION_LOOP_ACCEPT_CONTRIBUTION_TOOL,
	ACTION_LOOP_ACCEPT_HOST_CONTRIBUTION_TOOL,
	ACTION_LOOP_ASSESS_COVERAGE_TOOL,
	ACTION_LOOP_CLOSE_JUDGMENT_TOOL,
	ACTION_LOOP_PROPOSE_ACTION_TOOL,
	ACTION_LOOP_SETTLE_EFFECT_TOOL,
	ACTION_LOOP_RECORD_REMEDIATION_TOOL,
	ACTION_LOOP_PAUSE_WORK_CASE_TOOL,
	ACTION_LOOP_WAIT_WORK_CASE_TOOL,
	ACTION_LOOP_BLOCK_WORK_CASE_TOOL,
	ACTION_LOOP_RESUME_WORK_CASE_TOOL,
	ACTION_LOOP_PREPARE_CLOSURE_TOOL,
	ACTION_LOOP_COMPLETE_WORK_CASE_TOOL,
] as const;
const extensionRoot = dirname(fileURLToPath(import.meta.url));
const skillsRoot = resolve(extensionRoot, "..", "skills");
const MAX_QUESTION_CHARS = 2_000;
const MAX_EVIDENCE_CHARS = 2_000;
const MAX_RESULT_CHARS = 12_000;
const TOOL_POLICY_RESTART_MESSAGE =
	"Developer detected an in-process package reload from a version without reload-safe tool handoff. Restart the Pi process before enabling Developer; /reload and /developer off/on cannot safely reconstruct the prior built-in tool selection.";

function isStringEnumValue<T extends string>(
	value: unknown,
	values: readonly T[],
): value is T {
	return typeof value === "string" && values.some((item) => item === value);
}

function textResult<T>(text: string, details: T) {
	return {
		content: [{ type: "text" as const, text }],
		details,
	};
}

function resultText(result: {
	content: Array<{ type: string; text?: string }>;
}): string {
	return result.content
		.filter((item) => item.type === "text" && item.text)
		.map((item) => item.text)
		.join("\n");
}

function reusableText(content: string, lastComponent: unknown): Text {
	const component =
		lastComponent instanceof Text ? lastComponent : new Text("", 0, 0);
	component.setText(content);
	return component;
}

function ensureSafeToolText(text: string, label: string): void {
	const bytes = Buffer.byteLength(text, "utf8");
	const lines = text.split(/\r?\n/).length;
	if (bytes > DEFAULT_MAX_BYTES || lines > DEFAULT_MAX_LINES) {
		fail(
			`${label} exceeds Pi's tool-output limit (${bytes} bytes, ${lines} lines). Narrow the routed question or evidence.`,
		);
	}
}

function fail(message: string): never {
	throw new Error(message);
}

function sameToolSet(left: string[], right: string[]): boolean {
	if (left.length !== right.length) return false;
	const rightSet = new Set(right);
	return left.every((tool) => rightSet.has(tool));
}

function compactLine(value: string, maxChars = 160): string {
	const line = value.replace(/\s+/g, " ").trim();
	return line.length <= maxChars ? line : `${line.slice(0, maxChars - 1)}…`;
}

function actionLoopProtocolPrompt(
	availableSkillNames: readonly string[],
): string {
	return [
		"",
		"Developer Action Loop is active. The canonical Work Case is the sole owner of Outcome continuity, Judgments, Contributions, Coverage, Conclusions, Actions, Effects, and completion.",
		"Operate Observe → Judge → Act → Settle until Complete, Block, or Pause. These are semantic responsibilities, not a mandatory phase order; revisit Judgment whenever evidence changes.",
		`Open one bounded Outcome with ${ACTION_LOOP_OPEN_WORK_CASE_TOOL} when no Work Case exists. Never replace unavailable replay state or infer completion.`,
		`Open consequential Warrant Gaps with ${ACTION_LOOP_OPEN_JUDGMENT_TOOL}. Route each current Contribution Need through the admitted Capability inventory; Categories describe gaps and never hard-code Skill names.`,
		`After one Judgment is open, use ${ACTION_LOOP_PROGRESS_JUDGMENT_TOOL} as the primary bounded controller through Conclusion; its accepted checkpoints persist before dependent work continues. The lower-level routing tools are transitional fallback controls. Every applicable Assignment still requires sealed source-bound Context, and a local Contribution never grants upper Coverage.`,
		`Use ${ACTION_LOOP_ACCEPT_HOST_CONTRIBUTION_TOOL} only when exact host-admitted evidence directly contributes to a current Need without Skill interpretation. Evidence is not automatically truth.`,
		`Before any controlled bash, edit, or write, use ${ACTION_LOOP_PROPOSE_ACTION_TOOL} for the exact one-use input. A tool return records an Observation, not Effect success; settle every Effect with ${ACTION_LOOP_SETTLE_EFFECT_TOOL} and remediate adverse Effects explicitly.`,
		`Use ${ACTION_LOOP_PAUSE_WORK_CASE_TOOL}, ${ACTION_LOOP_WAIT_WORK_CASE_TOOL}, ${ACTION_LOOP_BLOCK_WORK_CASE_TOOL}, and ${ACTION_LOOP_RESUME_WORK_CASE_TOOL} only with their required current evidence. Routine pause, wait, and resume are driven by normal user messages, not dialogs.`,
		`Use ${ACTION_LOOP_PREPARE_CLOSURE_TOOL} and ${ACTION_LOOP_COMPLETE_WORK_CASE_TOOL} only after revalidating the complete current Work Case revision. Never select a convenient subset of Conclusions or Effects.`,
		"Internal IDs shown in model context are exact protocol arguments. Never repeat IDs, revisions, hashes, fingerprints, or transition identities to the user.",
		`Pi-admitted Developer Skills: ${availableSkillNames.length > 0 ? availableSkillNames.join(", ") : "none"}. Never rediscover excluded Skills or bypass the admitted inventory.`,
	].join("\n");
}

export default async function developer(pi: ExtensionAPI) {
	let availableSkills = new Map<string, Skill>();
	let liveCapabilityInventory: LiveCapabilityInventoryResult | undefined;
	let activeWorkCase: LiveWorkCaseState | undefined;
	let heldWorkCase: LiveHeldWorkCaseState | undefined;
	let completedWorkCase: CompletedWorkCase | undefined;
	let pendingActionLoopBranch:
		| readonly ActionLoopSessionBranchEntry[]
		| undefined;
	let actionLoopReplayFailure: string | undefined;
	let actionLoopSessionDurable = false;
	let liveHostObservations: LiveHostObservation[] = [];
	let currentActionLoopRequest: string | undefined;
	let developerEnabled = false;
	let toolPolicyMemory: ToolPolicyMemory = { withheldBuiltins: new Set() };
	let toolPolicyRestartRequired = false;

	const rememberHostObservation = (observation: LiveHostObservation) => {
		liveHostObservations = [
			...liveHostObservations.filter(
				(current) => current.observationId !== observation.observationId,
			),
			observation,
		].slice(-MAX_LIVE_HOST_OBSERVATIONS);
	};

	const bindPendingHostObservations = (workCaseId: string) => {
		liveHostObservations = liveHostObservations.flatMap((observation) => {
			const bound = bindLiveHostObservation(observation, workCaseId);
			return bound ? [bound] : [];
		});
	};

	const actionLoopToolPresentation = (
		toolName: string,
		args: Readonly<Record<string, unknown>>,
	): { readonly title: string; readonly detail?: string } => {
		const text = (key: string) =>
			typeof args[key] === "string" ? String(args[key]).trim() : undefined;
		switch (toolName) {
			case ACTION_LOOP_OPEN_WORK_CASE_TOOL:
				return { title: "Define work", detail: text("statement") };
			case ACTION_LOOP_OPEN_JUDGMENT_TOOL:
				return { title: "Examine a decision", detail: text("question") };
			case ACTION_LOOP_PROGRESS_JUDGMENT_TOOL:
				return { title: "Progress the current decision" };
			case ACTION_LOOP_ASSESS_CAPABILITY_TOOL:
				return {
					title: "Assess an available method",
					detail: text("capability"),
				};
			case ACTION_LOOP_SELECT_REFERENCES_TOOL:
				return {
					title: "Select relevant guidance",
					detail: text("capability"),
				};
			case ACTION_LOOP_LOAD_SELECTED_REFERENCE_TOOL:
				return { title: "Review selected guidance", detail: text("path") };
			case ACTION_LOOP_ACCEPT_CONTRIBUTION_TOOL:
				return { title: "Record a contribution", detail: text("capability") };
			case ACTION_LOOP_ACCEPT_HOST_CONTRIBUTION_TOOL:
				return { title: "Use observed evidence" };
			case ACTION_LOOP_ASSESS_COVERAGE_TOOL:
				return { title: "Assess evidence coverage" };
			case ACTION_LOOP_CLOSE_JUDGMENT_TOOL:
				return { title: "Conclude the current decision" };
			case ACTION_LOOP_PROPOSE_ACTION_TOOL:
				return { title: "Prepare an exact action", detail: text("summary") };
			case ACTION_LOOP_SETTLE_EFFECT_TOOL:
				return { title: "Assess the observed effect", detail: text("outcome") };
			case ACTION_LOOP_RECORD_REMEDIATION_TOOL:
				return { title: "Record effect remediation" };
			case ACTION_LOOP_PAUSE_WORK_CASE_TOOL:
				return { title: "Pause work", detail: text("reason") };
			case ACTION_LOOP_WAIT_WORK_CASE_TOOL:
				return {
					title: "Wait for an external condition",
					detail: text("external_condition"),
				};
			case ACTION_LOOP_BLOCK_WORK_CASE_TOOL:
				return { title: "Record blocked work", detail: text("reason") };
			case ACTION_LOOP_RESUME_WORK_CASE_TOOL:
				return {
					title: "Resume held work",
					detail: text("observed_change") ?? text("continuation"),
				};
			case ACTION_LOOP_PREPARE_CLOSURE_TOOL:
				return { title: "Review completion readiness" };
			case ACTION_LOOP_COMPLETE_WORK_CASE_TOOL:
				return { title: "Complete current work", detail: text("mode") };
			default:
				return { title: "Update current work" };
		}
	};

	const registerActionLoopTool = <
		TParams extends TSchema,
		TDetails = unknown,
		TState = unknown,
	>(
		tool: ToolDefinition<TParams, TDetails, TState>,
	) => {
		pi.registerTool({
			...tool,
			renderShell: "self",
			renderCall(args, theme) {
				const presentation = actionLoopToolPresentation(
					tool.name,
					args as Readonly<Record<string, unknown>>,
				);
				return new Text(
					`${theme.fg("toolTitle", theme.bold("Developer"))} ${theme.fg("accent", presentation.title)}${presentation.detail ? `\n${theme.fg("muted", compactLine(presentation.detail))}` : ""}`,
					0,
					0,
				);
			},
			renderResult(_result, options, theme, context) {
				const presentation = actionLoopToolPresentation(
					tool.name,
					context.args as Readonly<Record<string, unknown>>,
				);
				const status = options.isPartial
					? theme.fg("muted", "…")
					: context.isError
						? theme.fg("error", "not accepted")
						: theme.fg("success", "accepted");
				return new Text(`${status} · ${presentation.title}`, 0, 0);
			},
		});
	};

	const currentHostObservation = (
		observationId: string,
		workCase: LiveWorkCaseState | LiveHeldWorkCaseState,
	): LiveHostObservation | undefined => {
		const admitted = matchingLiveHostObservation(
			liveHostObservations,
			observationId,
			workCase.workCase.workCaseId,
		);
		if (admitted) return admitted;
		if (!("effectObservations" in workCase)) return undefined;
		const effectObservation = workCase.effectObservations.find(
			(candidate) => candidate.effectObservationId === observationId,
		);
		if (!effectObservation) return undefined;
		return Object.freeze({
			observationId: effectObservation.effectObservationId,
			kind: "tool" as const,
			source: effectObservation.provenance.source,
			statement: effectObservation.statement,
			evidenceFingerprint: effectObservation.evidence.fingerprint,
			workCaseId: effectObservation.workCaseId,
			basis: Object.freeze([
				`Current Effect Observation ${effectObservation.effectObservationId} binds exact host evidence ${effectObservation.evidence.locator} (${effectObservation.evidence.fingerprint}).`,
			]),
		});
	};

	pi.registerFlag("developer", {
		description: "Start with Developer enabled",
		type: "boolean",
		default: false,
	});

	const syncProtocolTools = () => {
		const current = pi.getActiveTools();
		const next = reconcileProtocolTools({
			activeTools: current,
			allTools: pi.getAllTools(),
			enabled: developerEnabled,
			protocolTools: PROTOCOL_TOOLS,
			memory: toolPolicyMemory,
		});
		const nextActive = new Set(next.activeTools);
		const nextWithheld = new Set(next.memory.withheldBuiltins);
		for (const toolName of clearedLivePiToolNames(activeWorkCase)) {
			nextActive.add(toolName);
			nextWithheld.delete(toolName);
		}
		const nextActiveTools = [...nextActive];
		toolPolicyMemory = { withheldBuiltins: nextWithheld };
		if (!sameToolSet(current, nextActiveTools))
			pi.setActiveTools(nextActiveTools);
	};

	const releaseProtocolTools = () => {
		const current = pi.getActiveTools();
		const next = reconcileProtocolTools({
			activeTools: current,
			allTools: pi.getAllTools(),
			enabled: false,
			protocolTools: PROTOCOL_TOOLS,
			memory: toolPolicyMemory,
		});
		toolPolicyMemory = next.memory;
		if (!sameToolSet(current, next.activeTools))
			pi.setActiveTools(next.activeTools);
	};

	const refreshUI = (ctx: ExtensionContext) => {
		if (toolPolicyRestartRequired) {
			ctx.ui.setStatus("developer", "developer · restart required");
			ctx.ui.setWidget(
				"developer",
				["blocked · restart Pi to reset Developer tool access"],
				{ placement: "belowEditor" },
			);
			return;
		}
		if (!developerEnabled) {
			ctx.ui.setStatus("developer", undefined);
			ctx.ui.setWidget("developer", undefined);
			return;
		}
		const view = inspectActionLoopWorkbench({
			enabled: developerEnabled,
			activeWorkCase,
			heldWorkCase,
			completedWorkCase,
			replayUnavailable: actionLoopReplayFailure !== undefined,
		});
		ctx.ui.setStatus("developer", `developer · ${view.status}`);
		if (view.status === "idle") {
			ctx.ui.setWidget("developer", undefined);
			return;
		}
		const overview = view.sections.find((section) => section.id === "overview");
		const overviewLines = (overview?.items ?? []).flatMap((item) => [
			`${item.title.toLowerCase()} · ${compactLine(item.summary)}`,
			...item.details.flatMap((detail) =>
				detail.lines.map(
					(line) => `${detail.label.toLowerCase()} · ${compactLine(line)}`,
				),
			),
		]);
		ctx.ui.setWidget(
			"developer",
			[...overviewLines, `next · ${compactLine(view.next)}`].slice(0, 6),
			{ placement: "belowEditor" },
		);
	};

	const reconstruct = (ctx: ExtensionContext) => {
		const branch = ctx.sessionManager.getBranch();
		actionLoopSessionDurable =
			ctx.sessionManager.getSessionFile() !== undefined;
		activeWorkCase = undefined;
		heldWorkCase = undefined;
		completedWorkCase = undefined;
		liveHostObservations = [];
		currentActionLoopRequest = undefined;
		pendingActionLoopBranch = toolPolicyRestartRequired ? undefined : branch;
		actionLoopReplayFailure = undefined;
		developerEnabled = toolPolicyRestartRequired
			? false
			: reconstructDeveloperMode(branch);
		syncProtocolTools();
		refreshUI(ctx);
	};

	const setEnabled = (enabled: boolean, ctx: ExtensionContext): boolean => {
		if (enabled && toolPolicyRestartRequired) {
			ctx.ui.notify(TOOL_POLICY_RESTART_MESSAGE, "error");
			refreshUI(ctx);
			return false;
		}
		const event = developerModeEvent(enabled);
		pi.appendEntry(DEVELOPER_MODE_ENTRY, event);
		developerEnabled = enabled;
		if (!enabled) {
			activeWorkCase = undefined;
			heldWorkCase = undefined;
			completedWorkCase = undefined;
			liveHostObservations = [];
			currentActionLoopRequest = undefined;
			pendingActionLoopBranch = undefined;
			actionLoopReplayFailure = undefined;
		}
		syncProtocolTools();
		refreshUI(ctx);
		return true;
	};

	registerActionLoopTool({
		name: ACTION_LOOP_OPEN_WORK_CASE_TOOL,
		label: "Developer Open Work Case",
		description:
			"Propose one bounded Outcome as the current Pi session branch's canonical Action Loop Work Case. Opening preserves continuity but grants no Action Clearance and makes no completion claim.",
		promptSnippet: "Open one bounded Action Loop Work Case",
		promptGuidelines: [
			`Call ${ACTION_LOOP_OPEN_WORK_CASE_TOOL} before consequential Developer routing when no Work Case is active.`,
			"Derive the Outcome, acceptance conditions, constraints, and basis from the current delegated request and observed context. Do not invent unresolved product policy.",
		],
		parameters: Type.Object(
			{
				statement: Type.String({
					minLength: 1,
					maxLength: MAX_LIVE_OUTCOME_TEXT,
				}),
				acceptance_conditions: Type.Array(
					Type.String({ minLength: 1, maxLength: MAX_LIVE_OUTCOME_TEXT }),
					{ minItems: 1, maxItems: MAX_LIVE_OUTCOME_ITEMS },
				),
				constraints: Type.Array(
					Type.String({ minLength: 1, maxLength: MAX_LIVE_OUTCOME_TEXT }),
					{ maxItems: MAX_LIVE_OUTCOME_ITEMS },
				),
				basis: Type.Array(
					Type.String({ minLength: 1, maxLength: MAX_LIVE_OUTCOME_TEXT }),
					{ minItems: 1, maxItems: MAX_LIVE_BASIS_ITEMS },
				),
			},
			{ additionalProperties: false },
		),
		executionMode: "sequential",
		renderShell: "self",
		async execute(_toolCallId, params) {
			if (!developerEnabled) {
				fail("Developer protocol is off. Run /developer on first.");
			}
			if (actionLoopReplayFailure) {
				fail(
					`Developer cannot replace unavailable Action Loop session state: ${actionLoopReplayFailure}`,
				);
			}
			if (heldWorkCase) {
				fail(
					`Developer cannot replace a ${heldWorkCase.workCase.status} Action Loop Work Case. Use /developer resume or /developer off.`,
				);
			}
			const proposal = {
				outcome: {
					statement: params.statement,
					acceptanceConditions: params.acceptance_conditions,
					constraints: params.constraints,
				},
				basis: params.basis,
				provenance: { kind: "model" as const, source: "pi:tool-call" },
			};
			const result = openLiveWorkCase(activeWorkCase, proposal);
			if (
				result.status === "invalid" ||
				result.status === "active-work-case-exists"
			) {
				fail(result.message);
			}
			pendingActionLoopBranch = undefined;
			activeWorkCase = result.value;
			bindPendingHostObservations(result.value.workCase.workCaseId);
			completedWorkCase = undefined;
			return textResult(
				result.status === "opened"
					? `Work Case opened: ${result.value.workCase.workCaseId}`
					: `Work Case already active: ${result.value.workCase.workCaseId}`,
				withActionLoopReplayEvent(
					{
						protocol: "developer-action-loop/v1",
						kind: result.status,
						workCase: result.value.workCase,
						openingBasis: result.value.openingBasis,
					},
					actionLoopWorkCaseOpenedEvent(proposal, result.value),
				),
			);
		},
	});

	registerActionLoopTool({
		name: ACTION_LOOP_OPEN_JUDGMENT_TOOL,
		label: "Developer Open Judgment",
		description:
			"Propose one Category-scoped Judgment for the active Work Case, with explicit Closure Requirements and functional Contribution Needs. It does not select a Skill or grant permission.",
		promptSnippet: "Open one bounded Action Loop Judgment",
		promptGuidelines: [
			`Use ${ACTION_LOOP_OPEN_JUDGMENT_TOOL} only for a consequential unresolved Warrant Gap with an independent stop.`,
			"Choose Category from the gap, never from a Skill name. Contribution Needs describe missing input functions, not Capabilities.",
		],
		parameters: Type.Object(
			{
				category: StringEnum([
					"Contextual Adequacy",
					"Proportionate Intervention",
					"Consequence Integrity",
					"Claim Assurance",
				] as const),
				subject: Type.String({ minLength: 1, maxLength: MAX_QUESTION_CHARS }),
				question: Type.String({ minLength: 1, maxLength: MAX_QUESTION_CHARS }),
				requirements: Type.Array(
					Type.Object(
						{
							statement: Type.String({
								minLength: 1,
								maxLength: MAX_QUESTION_CHARS,
							}),
							contribution_needs: Type.Array(
								Type.String({
									minLength: 1,
									maxLength: MAX_EVIDENCE_CHARS,
								}),
								{ minItems: 1, maxItems: 8 },
							),
						},
						{ additionalProperties: false },
					),
					{ minItems: 1, maxItems: 8 },
				),
				basis: Type.Array(
					Type.String({ minLength: 1, maxLength: MAX_EVIDENCE_CHARS }),
					{ minItems: 1, maxItems: MAX_LIVE_BASIS_ITEMS },
				),
			},
			{ additionalProperties: false },
		),
		executionMode: "sequential",
		renderShell: "self",
		async execute(_toolCallId, params) {
			if (!developerEnabled) {
				fail("Developer protocol is off. Run /developer on first.");
			}
			if (!activeWorkCase) {
				fail(
					`No active Action Loop Work Case. Open one with ${ACTION_LOOP_OPEN_WORK_CASE_TOOL} before opening a Judgment.`,
				);
			}
			const proposal = {
				category: params.category,
				subject: params.subject,
				question: params.question,
				requirements: params.requirements.map((requirement) => ({
					statement: requirement.statement,
					contributionNeeds: requirement.contribution_needs,
				})),
				basis: params.basis,
				provenance: { kind: "model" as const, source: "pi:tool-call" },
			};
			const result = openLiveJudgment(activeWorkCase, proposal);
			if (result.status === "invalid") fail(result.message);
			activeWorkCase = result.state;
			const judgmentInventoryLines: string[] = [];
			for (const requirement of result.judgment.requirements) {
				judgmentInventoryLines.push(
					`- Requirement ${requirement.requirementId}: ${requirement.statement}`,
				);
				for (const need of result.judgment.contributionNeeds) {
					if (need.requirementId === requirement.requirementId) {
						judgmentInventoryLines.push(
							`  - Contribution Need ${need.contributionNeedId}: ${need.function}`,
						);
					}
				}
			}
			const transitionText = [
				result.status === "opened"
					? `Judgment opened: ${result.judgment.judgmentId}`
					: `Judgment already open: ${result.judgment.judgmentId}`,
				`Current Work Case revision: ${result.state.workCase.revisionId}`,
				"Use these exact Closure Requirement and Contribution Need IDs for later Action Loop transitions:",
				...judgmentInventoryLines,
			].join("\n");
			return textResult(
				transitionText,
				withActionLoopReplayEvent(
					{
						protocol: "developer-action-loop/v1",
						kind: result.status,
						judgment: result.judgment,
						workCaseRevisionId: result.state.workCase.revisionId,
					},
					actionLoopJudgmentOpenedEvent(
						proposal,
						result.judgment.judgmentId,
						result.state.workCase.revisionId,
					),
				),
			);
		},
	});

	registerActionLoopTool({
		name: ACTION_LOOP_PROGRESS_JUDGMENT_TOOL,
		label: "Developer Progress Judgment",
		description:
			"Run the bounded SDK controller for the current open Judgment. It owns complete Capability inventory assessment, Context sealing, local Contributions, Need Coverage, retries, checkpoints, and upper Conclusion.",
		promptSnippet: "Progress the current Judgment with the SDK controller",
		promptGuidelines: [
			`Use ${ACTION_LOOP_PROGRESS_JUDGMENT_TOOL} after opening one Judgment instead of manually driving its lower-level routing tools.`,
			"A bounded stop preserves every acknowledged Pi branch checkpoint and resumes from the next unfinished transition.",
		],
		parameters: Type.Object({}, { additionalProperties: false }),
		executionMode: "sequential",
		renderShell: "self",
		async execute(_toolCallId, _params, signal, _onUpdate, ctx) {
			if (!developerEnabled) {
				fail("Developer protocol is off. Run /developer on first.");
			}
			if (!actionLoopSessionDurable) {
				fail(
					"SDK Judgment progression requires a durable Pi session branch for accepted checkpoints.",
				);
			}
			if (pendingActionLoopBranch || actionLoopReplayFailure) {
				fail(
					pendingActionLoopBranch
						? "Developer must replay the current Pi session branch before SDK progression."
						: `Developer Action Loop session replay is unavailable: ${actionLoopReplayFailure}`,
				);
			}
			if (!activeWorkCase) {
				fail(
					`No active Action Loop Work Case. Open one with ${ACTION_LOOP_OPEN_WORK_CASE_TOOL} first.`,
				);
			}
			if (activeWorkCase.workCase.openJudgments.length !== 1) {
				fail(
					`SDK progression requires exactly one open Judgment. Use ${ACTION_LOOP_OPEN_JUDGMENT_TOOL} first.`,
				);
			}
			if (!currentActionLoopRequest) {
				fail(
					"The current delegated request is unavailable for SDK progression.",
				);
			}
			if (liveCapabilityInventory?.status !== "ready") {
				fail(
					"The complete current Pi-admitted Capability inventory is unavailable.",
				);
			}
			const prepared = createPiExtensionSdkRunner(ctx, {
				...(signal ? { signal } : {}),
				thinkingLevel: pi.getThinkingLevel(),
			});
			if (prepared.status !== "ready") {
				fail("The current Pi session has no active model for SDK progression.");
			}
			const progressed = await progressLiveJudgmentWithSdk({
				request: currentActionLoopRequest,
				state: activeWorkCase,
				inventory: liveCapabilityInventory.value,
				runner: prepared.runner,
				maxSteps: 32,
				appendCheckpoint(event) {
					pi.appendEntry(ACTION_LOOP_SESSION_ENTRY, event);
				},
			});
			activeWorkCase = progressed.state;
			syncProtocolTools();
			refreshUI(ctx);
			const result = progressed.result;
			const failure = sdkJudgmentProgressionFailure(result);
			if (failure) fail(failure);
			return textResult(sdkJudgmentProgressionSummary(result), {
				protocol: "developer-action-loop/sdk-progression/v1",
				kind: "sdk-judgment-progression",
				status: result.status,
				steps: result.steps,
				checkpoints: result.checkpoints,
				...("stage" in result ? { stage: result.stage } : {}),
				...("reason" in result ? { reason: result.reason } : {}),
			});
		},
	});

	registerActionLoopTool({
		name: ACTION_LOOP_ASSESS_CAPABILITY_TOOL,
		label: "Developer Assess Capability",
		description:
			"Propose applicability of one Pi-admitted, source-bound Capability for one current Contribution Need. This does not select References or accept a Contribution.",
		promptSnippet: "Assess one Capability for a current Contribution Need",
		promptGuidelines: [
			`Use ${ACTION_LOOP_ASSESS_CAPABILITY_TOOL} before routing a Skill. Copy only exact declared when/unless conditions projected by the Capability; unstructured Capabilities require empty condition arrays.`,
			"Use needs-context rather than guessing. A Skill name never creates or implies a Contribution Need.",
		],
		parameters: Type.Object(
			{
				capability: Type.String({
					minLength: 1,
					maxLength: 64,
					description: "Exact available Developer Skill name",
				}),
				contribution_need_id: Type.Optional(
					Type.String({ minLength: 1, maxLength: 512 }),
				),
				status: StringEnum([
					"applicable",
					"not-applicable",
					"needs-context",
				] as const),
				matched_when: Type.Array(
					Type.String({ minLength: 1, maxLength: MAX_EVIDENCE_CHARS }),
					{ maxItems: 32 },
				),
				matched_unless: Type.Array(
					Type.String({ minLength: 1, maxLength: MAX_EVIDENCE_CHARS }),
					{ maxItems: 32 },
				),
				basis: Type.Array(
					Type.String({ minLength: 1, maxLength: MAX_EVIDENCE_CHARS }),
					{ minItems: 1, maxItems: MAX_LIVE_BASIS_ITEMS },
				),
				missing_context: Type.Array(
					Type.String({ minLength: 1, maxLength: MAX_EVIDENCE_CHARS }),
					{ maxItems: 16 },
				),
			},
			{ additionalProperties: false },
		),
		executionMode: "sequential",
		renderShell: "self",
		async execute(_toolCallId, params) {
			if (!developerEnabled) {
				fail("Developer protocol is off. Run /developer on first.");
			}
			if (!activeWorkCase) {
				fail(
					`No active Action Loop Work Case. Open one with ${ACTION_LOOP_OPEN_WORK_CASE_TOOL} first.`,
				);
			}
			if (
				!liveCapabilityInventory ||
				liveCapabilityInventory.status !== "ready"
			) {
				fail("No current accepted Pi Capability inventory is available.");
			}
			const entry =
				liveCapabilityInventory.value.boundCapabilitiesBySkillName.get(
					params.capability,
				);
			if (entry === undefined) {
				fail(
					`Capability ${params.capability} is unavailable, excluded, ambiguous, or unbound.`,
				);
			}
			if (
				!isStringEnumValue(params.status, [
					"applicable",
					"not-applicable",
					"needs-context",
				] as const)
			) {
				fail("Capability status is outside the closed applicability domain.");
			}
			const proposal = {
				contributionNeedId: params.contribution_need_id,
				status: params.status,
				matchedWhen: params.matched_when,
				matchedUnless: params.matched_unless,
				basis: params.basis,
				missingContext: params.missing_context,
			};
			const result = assessLiveCapabilityApplicability(
				activeWorkCase,
				entry,
				proposal,
			);
			if (result.status === "invalid") fail(result.message);
			activeWorkCase = result.state;
			return textResult(
				`Capability ${params.capability}: ${result.assessment.status}${result.assignment ? ` · ${result.assignment.assignmentId}` : ""}`,
				withActionLoopReplayEvent(
					{
						protocol: "developer-action-loop/v1",
						kind: result.status,
						capability: params.capability,
						assessment: result.assessment,
						assignment: result.assignment,
					},
					actionLoopCapabilityAssessedEvent(
						params.capability,
						proposal,
						result.assessment,
						result.assignment?.assignmentId,
					),
				),
			);
		},
	});

	registerActionLoopTool({
		name: ACTION_LOOP_SELECT_REFERENCES_TOOL,
		label: "Developer Select References",
		description:
			"Seal one assigned Skill Context: disposition every declared Reference for a structured Capability, or provide no dispositions for an unstructured Capability.",
		promptSnippet: "Select References and seal the assigned Skill Context",
		promptGuidelines: [
			`Use ${ACTION_LOOP_SELECT_REFERENCES_TOOL} only after an applicable Capability Assignment. For a structured Capability, account for every projected Reference exactly once as selected, not-needed, or needs-context. For an unstructured Capability, submit an empty dispositions array to seal SKILL.md alone.`,
			"Use needs-context instead of guessing. Any needs-context disposition leaves a structured selection unsealed and cannot authorize Skill routing.",
		],
		parameters: Type.Object(
			{
				capability: Type.String({ minLength: 1, maxLength: 64 }),
				contribution_need_id: Type.Optional(
					Type.String({ minLength: 1, maxLength: 512 }),
				),
				dispositions: Type.Array(
					Type.Object(
						{
							path: Type.String({ minLength: 1, maxLength: 512 }),
							status: StringEnum([
								"selected",
								"not-needed",
								"needs-context",
							] as const),
							basis: Type.Array(
								Type.String({
									minLength: 1,
									maxLength: MAX_EVIDENCE_CHARS,
								}),
								{ minItems: 1, maxItems: MAX_LIVE_BASIS_ITEMS },
							),
						},
						{ additionalProperties: false },
					),
					{ maxItems: 32 },
				),
			},
			{ additionalProperties: false },
		),
		executionMode: "sequential",
		renderShell: "self",
		async execute(_toolCallId, params) {
			if (!developerEnabled) {
				fail("Developer protocol is off. Run /developer on first.");
			}
			if (!activeWorkCase) {
				fail(
					`No active Action Loop Work Case. Open one with ${ACTION_LOOP_OPEN_WORK_CASE_TOOL} first.`,
				);
			}
			if (
				!liveCapabilityInventory ||
				liveCapabilityInventory.status !== "ready"
			) {
				fail("No current accepted Pi Capability inventory is available.");
			}
			const entry =
				liveCapabilityInventory.value.boundCapabilitiesBySkillName.get(
					params.capability,
				);
			if (entry === undefined) {
				fail(`Capability ${params.capability} is unavailable or unbound.`);
			}
			const need = selectLiveContributionNeed(
				activeWorkCase,
				params.contribution_need_id,
			);
			if (need.status === "invalid") fail(need.message);
			const assignment = assignedLiveCapability(
				activeWorkCase,
				entry,
				need.value.contributionNeedId,
			);
			if (assignment === undefined) {
				fail(
					`Capability ${params.capability} has no current applicable Assignment for ${need.value.contributionNeedId}.`,
				);
			}
			if (entry.routing !== "structured") {
				if (params.dispositions.length > 0) {
					fail(
						`Capability ${params.capability} is unstructured; dispositions must be empty.`,
					);
				}
				const sealed = await sealLiveUnstructuredCapability(
					activeWorkCase,
					entry,
					assignment,
				);
				if (sealed.status === "invalid") fail(sealed.message);
				activeWorkCase = sealed.state;
				return textResult(
					`Unstructured Skill context ${sealed.status}: ${sealed.context.sealedContextId}`,
					withActionLoopReplayEvent(
						{
							protocol: "developer-action-loop/v1",
							kind: "selected" as "selected" | "sealed" | "unchanged",
							capability: params.capability,
							selectionId: sealed.context.sealedContextId,
							sealedContextId: sealed.context.sealedContextId as
								| string
								| undefined,
							selectedPaths: [] as readonly string[],
						},
						actionLoopUnstructuredContextSealedEvent(
							params.capability,
							entry.capability.capabilityRevisionId,
							assignment.assignmentId,
							sealed.context.sealedContextId,
						),
					),
				);
			}
			const dispositions = params.dispositions.map((disposition) => {
				if (
					!isStringEnumValue(disposition.status, [
						"selected",
						"not-needed",
						"needs-context",
					] as const)
				) {
					fail("Reference status is outside the closed disposition domain.");
				}
				return {
					path: disposition.path,
					status: disposition.status,
					basis: [...disposition.basis],
				};
			});
			const result = await selectAndSealLiveStructuredCapability(
				activeWorkCase,
				entry,
				assignment,
				dispositions,
			);
			if (result.status === "invalid") fail(result.message);
			activeWorkCase = result.state;
			return textResult(
				result.context
					? `Reference selection sealed: ${result.selectionId} · ${result.context.sealedContextId}`
					: `Reference selection unresolved: ${result.selectionId}`,
				withActionLoopReplayEvent(
					{
						protocol: "developer-action-loop/v1",
						kind: result.status,
						capability: params.capability,
						selectionId: result.selectionId,
						sealedContextId: result.context?.sealedContextId,
						selectedPaths: result.context?.selectedPaths ?? [],
					},
					actionLoopReferencesSelectedEvent({
						skillName: params.capability,
						capabilityRevisionId: entry.capability.capabilityRevisionId,
						contributionNeedId: need.value.contributionNeedId,
						dispositions,
						selectionId: result.selectionId,
						sealedContextId: result.context?.sealedContextId,
					}),
				),
			);
		},
	});

	registerActionLoopTool({
		name: ACTION_LOOP_LOAD_SELECTED_REFERENCE_TOOL,
		label: "Developer Load Selected Reference",
		description:
			"Load one exact Reference already selected and sealed for the current structured Skill context. No filesystem reacquisition occurs.",
		promptSnippet: "Load one sealed selected Reference",
		promptGuidelines: [
			`Use ${ACTION_LOOP_LOAD_SELECTED_REFERENCE_TOOL} only with an exact sealed Context ID and selected path returned by ${ACTION_LOOP_SELECT_REFERENCES_TOOL}.`,
			"Ordinary file reads are not canonical structured-Reference evidence.",
		],
		parameters: Type.Object(
			{
				sealed_context_id: Type.String({ minLength: 1, maxLength: 512 }),
				path: Type.String({ minLength: 1, maxLength: 512 }),
			},
			{ additionalProperties: false },
		),
		executionMode: "sequential",
		renderShell: "self",
		async execute(_toolCallId, params) {
			if (!developerEnabled) {
				fail("Developer protocol is off. Run /developer on first.");
			}
			if (!activeWorkCase) {
				fail("No active Action Loop Work Case.");
			}
			const loaded = loadLiveSelectedReference(
				activeWorkCase,
				params.sealed_context_id,
				params.path,
			);
			if (loaded.status === "invalid") fail(loaded.message);
			const response = [
				`Selected Reference: ${loaded.path}`,
				`Sealed Context: ${loaded.sealedContextId}`,
				`SHA-256: ${loaded.hash}`,
				"",
				loaded.content,
			].join("\n");
			ensureSafeToolText(response, "Developer selected Reference result");
			return textResult(response, {
				protocol: "developer-action-loop/v1",
				kind: "selected-reference",
				sealedContextId: loaded.sealedContextId,
				path: loaded.path,
				hash: loaded.hash,
				byteLength: loaded.byteLength,
			});
		},
	});

	registerActionLoopTool({
		name: ACTION_LOOP_ACCEPT_CONTRIBUTION_TOOL,
		label: "Developer Accept Contribution",
		description:
			"Accept one Skill-local result from an exact Capability Assignment and sealed Skill context. This does not grant Need Coverage or close Judgment.",
		promptSnippet: "Accept one sealed Skill Contribution",
		promptGuidelines: [
			`Use ${ACTION_LOOP_ACCEPT_CONTRIBUTION_TOOL} after the assigned Skill has produced its bounded result. Account exactly once for every selected Reference.`,
			"Return residual Needs that remain local and emergent Needs that must be routed upward. Do not claim Coverage or Conclusion here.",
		],
		parameters: Type.Object(
			{
				capability: Type.String({ minLength: 1, maxLength: 64 }),
				contribution_need_id: Type.Optional(
					Type.String({ minLength: 1, maxLength: 512 }),
				),
				local_status: StringEnum(["resolved", "partial"] as const),
				result: Type.String({ minLength: 1, maxLength: MAX_RESULT_CHARS }),
				reference_applications: Type.Array(
					Type.Object(
						{
							path: Type.String({ minLength: 1, maxLength: 512 }),
							status: StringEnum(["applied", "limited"] as const),
							application: Type.String({
								minLength: 1,
								maxLength: MAX_EVIDENCE_CHARS,
							}),
						},
						{ additionalProperties: false },
					),
					{ maxItems: 32 },
				),
				limitations: Type.Array(
					Type.String({ minLength: 1, maxLength: MAX_EVIDENCE_CHARS }),
					{ maxItems: 32 },
				),
				residual_needs: Type.Array(
					Type.Object(
						{
							kind: StringEnum(["residual", "emergent"] as const),
							description: Type.String({
								minLength: 1,
								maxLength: MAX_EVIDENCE_CHARS,
							}),
							basis: Type.Array(
								Type.String({
									minLength: 1,
									maxLength: MAX_EVIDENCE_CHARS,
								}),
								{ minItems: 1, maxItems: MAX_LIVE_BASIS_ITEMS },
							),
						},
						{ additionalProperties: false },
					),
					{ maxItems: 32 },
				),
			},
			{ additionalProperties: false },
		),
		executionMode: "sequential",
		renderShell: "self",
		async execute(_toolCallId, params) {
			if (!developerEnabled) {
				fail("Developer protocol is off. Run /developer on first.");
			}
			if (!activeWorkCase) fail("No active Action Loop Work Case.");
			if (
				!liveCapabilityInventory ||
				liveCapabilityInventory.status !== "ready"
			) {
				fail("No current accepted Pi Capability inventory is available.");
			}
			const entry =
				liveCapabilityInventory.value.boundCapabilitiesBySkillName.get(
					params.capability,
				);
			if (entry === undefined) {
				fail(`Capability ${params.capability} is unavailable or unbound.`);
			}
			const proposal = {
				contributionNeedId: params.contribution_need_id,
				localStatus: params.local_status,
				result: params.result,
				referenceApplications: params.reference_applications,
				limitations: params.limitations,
				residualNeeds: params.residual_needs,
				provenance: { kind: "model" as const, source: "pi:tool-call" },
			};
			const accepted = acceptLiveSkillContribution(
				activeWorkCase,
				entry,
				proposal,
			);
			if (accepted.status === "invalid") fail(accepted.message);
			activeWorkCase = accepted.state;
			return textResult(
				`Skill Contribution ${accepted.status}: ${accepted.contribution.contributionId}`,
				withActionLoopReplayEvent(
					{
						protocol: "developer-action-loop/v1",
						kind: accepted.status,
						capability: params.capability,
						contribution: accepted.contribution,
					},
					actionLoopContributionAcceptedEvent(
						params.capability,
						entry.capability.capabilityRevisionId,
						proposal,
						accepted.contribution.contributionId,
					),
				),
			);
		},
	});

	registerActionLoopTool({
		name: ACTION_LOOP_ACCEPT_HOST_CONTRIBUTION_TOOL,
		label: "Developer Accept Observed Contribution",
		description:
			"Accept one exact host-admitted human prompt or finalized tool result as a Need-bound Contribution. Observation is evidence, not Conclusion; Coverage remains separate.",
		promptSnippet: "Use exact observed evidence for one current Need",
		promptGuidelines: [
			`Use ${ACTION_LOOP_ACCEPT_HOST_CONTRIBUTION_TOOL} when an exact host-admitted Observation directly contributes to a current Need without Skill interpretation.`,
			"Use only an Observation ID listed in model-only host context. State limitations and residual Needs explicitly; do not infer Coverage or Conclusion.",
		],
		parameters: Type.Object(
			{
				observation_id: Type.String({ minLength: 1, maxLength: 512 }),
				contribution_need_id: Type.Optional(
					Type.String({ minLength: 1, maxLength: 512 }),
				),
				local_status: StringEnum(["resolved", "partial"] as const),
				result: Type.String({ minLength: 1, maxLength: MAX_RESULT_CHARS }),
				limitations: Type.Array(
					Type.String({ minLength: 1, maxLength: MAX_EVIDENCE_CHARS }),
					{ maxItems: 32 },
				),
				residual_needs: Type.Array(
					Type.Object(
						{
							kind: StringEnum(["residual", "emergent"] as const),
							description: Type.String({
								minLength: 1,
								maxLength: MAX_EVIDENCE_CHARS,
							}),
							basis: Type.Array(
								Type.String({
									minLength: 1,
									maxLength: MAX_EVIDENCE_CHARS,
								}),
								{ minItems: 1, maxItems: MAX_LIVE_BASIS_ITEMS },
							),
						},
						{ additionalProperties: false },
					),
					{ maxItems: 32 },
				),
				basis: Type.Array(
					Type.String({ minLength: 1, maxLength: MAX_EVIDENCE_CHARS }),
					{ minItems: 1, maxItems: MAX_LIVE_BASIS_ITEMS },
				),
			},
			{ additionalProperties: false },
		),
		executionMode: "sequential",
		renderShell: "self",
		async execute(_toolCallId, params) {
			if (!developerEnabled) {
				fail("Developer protocol is off. Run /developer on first.");
			}
			if (!activeWorkCase) fail("No active Action Loop Work Case.");
			const observation = currentHostObservation(
				params.observation_id,
				activeWorkCase,
			);
			if (!observation) {
				fail(
					"Observation is unavailable, stale, or belongs to another Work Case.",
				);
			}
			const proposal = {
				contributionNeedId: params.contribution_need_id,
				localStatus: params.local_status,
				result: params.result,
				limitations: params.limitations,
				residualNeeds: params.residual_needs,
				basis: params.basis,
			};
			const accepted = acceptLiveHostContribution(
				activeWorkCase,
				observation,
				proposal,
			);
			if (accepted.status === "invalid") fail(accepted.message);
			activeWorkCase = accepted.state;
			return textResult(
				`Observed contribution ${accepted.status}: ${accepted.contribution.contributionId}`,
				withActionLoopReplayEvent(
					{
						protocol: "developer-action-loop/v1",
						kind: accepted.status,
						result: accepted.contribution.result,
						limitations: accepted.contribution.limitations,
						residualNeeds: accepted.contribution.residualNeeds,
					},
					actionLoopHostContributionAcceptedEvent(
						{
							observationId: observation.observationId,
							kind: observation.kind,
							source: observation.source,
							statement: observation.statement,
							evidenceFingerprint: observation.evidenceFingerprint,
							basis: [...observation.basis],
						},
						proposal,
						accepted.contribution.contributionId,
					),
				),
			);
		},
	});

	registerActionLoopTool({
		name: ACTION_LOOP_ASSESS_COVERAGE_TOOL,
		label: "Developer Assess Coverage",
		description:
			"Assess every current Contribution for one upper Judgment Need. Coverage remains separate from Skill-local resolution and does not close Judgment.",
		promptSnippet: "Assess current Contribution Need Coverage",
		promptGuidelines: [
			`Use ${ACTION_LOOP_ASSESS_COVERAGE_TOOL} only after current Contributions are accepted. Disposition every current Contribution exactly once.`,
			"A partial Contribution cannot provide full support. Record material conflicts explicitly; do not infer Conclusion from Coverage.",
		],
		parameters: Type.Object(
			{
				contribution_need_id: Type.Optional(
					Type.String({ minLength: 1, maxLength: 512 }),
				),
				status: StringEnum([
					"covered",
					"partially-covered",
					"conflicted",
					"missing",
				] as const),
				dispositions: Type.Array(
					Type.Object(
						{
							contribution_id: Type.String({ minLength: 1, maxLength: 512 }),
							status: StringEnum([
								"supports",
								"limited-support",
								"not-relied-on",
							] as const),
							basis: Type.Array(
								Type.String({
									minLength: 1,
									maxLength: MAX_EVIDENCE_CHARS,
								}),
								{ minItems: 1, maxItems: MAX_LIVE_BASIS_ITEMS },
							),
						},
						{ additionalProperties: false },
					),
					{ maxItems: 64 },
				),
				conflicts: Type.Array(
					Type.Object(
						{
							left_contribution_id: Type.String({
								minLength: 1,
								maxLength: 512,
							}),
							right_contribution_id: Type.String({
								minLength: 1,
								maxLength: 512,
							}),
							basis: Type.Array(
								Type.String({
									minLength: 1,
									maxLength: MAX_EVIDENCE_CHARS,
								}),
								{ minItems: 1, maxItems: MAX_LIVE_BASIS_ITEMS },
							),
						},
						{ additionalProperties: false },
					),
					{ maxItems: 32 },
				),
				basis: Type.Array(
					Type.String({ minLength: 1, maxLength: MAX_EVIDENCE_CHARS }),
					{ minItems: 1, maxItems: MAX_LIVE_BASIS_ITEMS },
				),
			},
			{ additionalProperties: false },
		),
		executionMode: "sequential",
		renderShell: "self",
		async execute(_toolCallId, params) {
			if (!developerEnabled) {
				fail("Developer protocol is off. Run /developer on first.");
			}
			if (!activeWorkCase) fail("No active Action Loop Work Case.");
			if (
				!isStringEnumValue(params.status, [
					"covered",
					"partially-covered",
					"conflicted",
					"missing",
				] as const)
			) {
				fail("Coverage status is outside the closed Coverage domain.");
			}
			const dispositions = params.dispositions.map((disposition) => {
				if (
					!isStringEnumValue(disposition.status, [
						"supports",
						"limited-support",
						"not-relied-on",
					] as const)
				) {
					fail("Contribution status is outside the closed Coverage domain.");
				}
				return {
					contributionId: disposition.contribution_id,
					status: disposition.status,
					basis: [...disposition.basis],
				};
			});
			const proposal = {
				contributionNeedId: params.contribution_need_id,
				status: params.status,
				dispositions,
				conflicts: params.conflicts.map((conflict) => ({
					leftContributionId: conflict.left_contribution_id,
					rightContributionId: conflict.right_contribution_id,
					basis: conflict.basis,
				})),
				basis: params.basis,
				provenance: { kind: "model" as const, source: "pi:tool-call" },
			};
			const assessed = assessLiveNeedCoverage(activeWorkCase, proposal);
			if (assessed.status === "invalid") fail(assessed.message);
			activeWorkCase = assessed.state;
			return textResult(
				`Need Coverage ${assessed.status}: ${assessed.coverage.coverageId} · ${assessed.coverage.status}`,
				withActionLoopReplayEvent(
					{
						protocol: "developer-action-loop/v1",
						kind: assessed.status,
						coverage: assessed.coverage,
					},
					actionLoopCoverageAssessedEvent(
						proposal,
						assessed.coverage.coverageId,
					),
				),
			);
		},
	});

	registerActionLoopTool({
		name: ACTION_LOOP_CLOSE_JUDGMENT_TOOL,
		label: "Developer Close Judgment",
		description:
			"Synthesize current Need Coverage against every Closure Requirement. A Conclusion is recorded in the canonical Work Case only when all structural obligations close.",
		promptSnippet: "Conclude or explicitly refuse the current Judgment",
		promptGuidelines: [
			`Use ${ACTION_LOOP_CLOSE_JUDGMENT_TOOL} only after current Need Coverage is assessed. Cite exactly the Coverage IDs that serve each Requirement.`,
			"Use refuse when evidence, Coverage, Context, or evaluator confidence is insufficient. A refusal leaves the Judgment open.",
		],
		parameters: Type.Object(
			{
				outcome: StringEnum(["conclude", "refuse"] as const),
				answer: Type.Optional(
					Type.String({ minLength: 1, maxLength: MAX_RESULT_CHARS }),
				),
				refusal_reasons: Type.Array(
					Type.String({ minLength: 1, maxLength: MAX_EVIDENCE_CHARS }),
					{ maxItems: 32 },
				),
				requirement_dispositions: Type.Array(
					Type.Object(
						{
							requirement_id: Type.String({ minLength: 1, maxLength: 512 }),
							status: StringEnum([
								"satisfied",
								"not-satisfied",
								"needs-context",
							] as const),
							coverage_ids: Type.Array(
								Type.String({ minLength: 1, maxLength: 512 }),
								{ maxItems: 32 },
							),
							basis: Type.Array(
								Type.String({
									minLength: 1,
									maxLength: MAX_EVIDENCE_CHARS,
								}),
								{ minItems: 1, maxItems: MAX_LIVE_BASIS_ITEMS },
							),
						},
						{ additionalProperties: false },
					),
					{ minItems: 1, maxItems: 32 },
				),
				basis: Type.Array(
					Type.String({ minLength: 1, maxLength: MAX_EVIDENCE_CHARS }),
					{ minItems: 1, maxItems: MAX_LIVE_BASIS_ITEMS },
				),
			},
			{ additionalProperties: false },
		),
		executionMode: "sequential",
		renderShell: "self",
		async execute(_toolCallId, params) {
			if (!developerEnabled) {
				fail("Developer protocol is off. Run /developer on first.");
			}
			if (!activeWorkCase) fail("No active Action Loop Work Case.");
			if (!isStringEnumValue(params.outcome, ["conclude", "refuse"] as const)) {
				fail("Judgment outcome is outside the closed closure domain.");
			}
			const requirementDispositions = params.requirement_dispositions.map(
				(disposition) => {
					if (
						!isStringEnumValue(disposition.status, [
							"satisfied",
							"not-satisfied",
							"needs-context",
						] as const)
					) {
						fail("Requirement status is outside the closed closure domain.");
					}
					return {
						requirementId: disposition.requirement_id,
						status: disposition.status,
						coverageIds: [...disposition.coverage_ids],
						basis: [...disposition.basis],
					};
				},
			);
			const proposal = {
				outcome: params.outcome,
				answer: params.answer,
				refusalReasons: params.refusal_reasons,
				requirementDispositions,
				basis: params.basis,
				provenance: { kind: "model" as const, source: "pi:tool-call" },
			};
			const closed = closeLiveJudgment(activeWorkCase, proposal);
			if (closed.status === "invalid") fail(closed.message);
			if (closed.status === "refused") {
				return textResult(
					`Judgment closure refused: ${closed.refusal.refusalId}`,
					{
						protocol: "developer-action-loop/v1",
						kind: "closure",
						artifactKind: "refusal",
						artifact: closed.refusal as unknown,
						workCaseRevisionId: activeWorkCase.workCase.revisionId,
					},
				);
			}
			activeWorkCase = closed.state;
			return textResult(
				`Judgment concluded: ${closed.conclusion.conclusionId}`,
				withActionLoopReplayEvent(
					{
						protocol: "developer-action-loop/v1",
						kind: "closure",
						artifactKind: "conclusion",
						artifact: closed.conclusion as unknown,
						workCaseRevisionId: closed.state.workCase.revisionId,
					},
					actionLoopJudgmentConcludedEvent(
						proposal,
						closed.conclusion.conclusionId,
						closed.state.workCase.revisionId,
					),
				),
			);
		},
	});

	registerActionLoopTool({
		name: ACTION_LOOP_PROPOSE_ACTION_TOOL,
		label: "Developer Propose Action",
		description:
			"Record one exact controlled Action Candidate warranted by current Conclusions, then assess one matching Clearance under Pi's default permission policy.",
		promptSnippet: "Propose one exact controlled Action",
		promptGuidelines: [
			`Use ${ACTION_LOOP_PROPOSE_ACTION_TOOL} only after the required Judgment Conclusions are canonical. Supply the exact next Pi built-in tool name and input; the adapter derives the controlled Action fingerprint.`,
			"The adapter records matching Action Clearance automatically only when the current Work Case inventory is coherent and all required Conclusions are present.",
		],
		parameters: Type.Object(
			{
				tool_name: StringEnum(["bash", "edit", "write"] as const),
				tool_input: Type.Record(Type.String(), Type.Unknown()),
				summary: Type.String({ minLength: 1, maxLength: MAX_QUESTION_CHARS }),
				intended_effects: Type.Array(
					Type.String({ minLength: 1, maxLength: MAX_EVIDENCE_CHARS }),
					{ minItems: 1, maxItems: 32 },
				),
				required_conclusion_ids: Type.Array(
					Type.String({ minLength: 1, maxLength: 512 }),
					{ minItems: 1, maxItems: 32 },
				),
			},
			{ additionalProperties: false },
		),
		executionMode: "sequential",
		renderShell: "self",
		async execute(_toolCallId, params) {
			if (!developerEnabled) {
				fail("Developer protocol is off. Run /developer on first.");
			}
			if (!activeWorkCase) fail("No active Action Loop Work Case.");
			const proposal = {
				toolName: params.tool_name,
				toolInput: params.tool_input,
				summary: params.summary,
				intendedEffects: params.intended_effects,
				requiredConclusionIds: params.required_conclusion_ids,
			};
			const accepted = acceptLivePiActionCandidate(activeWorkCase, proposal);
			if (accepted.status === "invalid") fail(accepted.message);
			const clearance = assessLiveActionClearance(
				accepted.state,
				accepted.candidate.actionCandidateId,
				{
					actionCandidateId: accepted.candidate.actionCandidateId,
					status: "granted",
					source: "pi:default-permission-policy",
					basis: [
						"The live adapter inherits Pi's default permission policy without adding a separate approval step.",
					],
				},
			);
			if (clearance.status === "invalid") fail(clearance.message);
			if (clearance.status === "not-cleared") {
				fail(
					`Pi host permission did not clear the Action: ${clearance.blockers.map((blocker) => blocker.code).join(", ")}`,
				);
			}
			activeWorkCase = clearance.state;
			syncProtocolTools();
			return textResult(
				`Action Candidate ${accepted.status}: ${accepted.candidate.actionCandidateId} · Action Clearance ${clearance.status}: ${clearance.clearance.actionClearanceId}`,
				withActionLoopReplayEvent(
					{
						protocol: "developer-action-loop/v1",
						kind: clearance.status,
						candidate: accepted.candidate,
						permission: clearance.clearance.permission,
						clearance: clearance.clearance,
					},
					actionLoopActionClearedEvent(
						proposal,
						accepted.candidate.actionCandidateId,
						clearance.clearance.actionClearanceId,
						clearance.state.workCase.revisionId,
					),
				),
			);
		},
	});

	registerActionLoopTool({
		name: ACTION_LOOP_SETTLE_EFFECT_TOOL,
		label: "Developer Settle Effect",
		description:
			"Propose complete accounting for one current Effect. Tool occurrence and tool-result evidence do not imply success.",
		promptSnippet: "Account for one current Action Effect",
		promptGuidelines: [
			`Use ${ACTION_LOOP_SETTLE_EFFECT_TOOL} only after accounting for every current Effect Observation and every intended Effect exactly once.`,
			"Derive the outcome from evidence. Use pending or unknown when the current observations do not establish intended Effect success.",
		],
		parameters: Type.Object(
			{
				effect_id: Type.String({ minLength: 1, maxLength: 512 }),
				outcome: StringEnum([
					"observed-success",
					"observed-no-effect",
					"failed",
					"partially-applied",
					"pending",
					"unknown",
				] as const),
				observation_dispositions: Type.Array(
					Type.Object(
						{
							effect_observation_id: Type.String({
								minLength: 1,
								maxLength: 512,
							}),
							status: StringEnum(["relied-on", "not-relied-on"] as const),
							basis: Type.Array(
								Type.String({ minLength: 1, maxLength: MAX_EVIDENCE_CHARS }),
								{ minItems: 1, maxItems: 16 },
							),
						},
						{ additionalProperties: false },
					),
					{ maxItems: 32 },
				),
				intended_effect_dispositions: Type.Array(
					Type.Object(
						{
							intended_effect: Type.String({
								minLength: 1,
								maxLength: MAX_EVIDENCE_CHARS,
							}),
							status: StringEnum([
								"observed",
								"not-observed",
								"failed",
								"partially-observed",
								"unknown",
							] as const),
							observation_ids: Type.Array(
								Type.String({ minLength: 1, maxLength: 512 }),
								{ maxItems: 32 },
							),
							basis: Type.Array(
								Type.String({ minLength: 1, maxLength: MAX_EVIDENCE_CHARS }),
								{ minItems: 1, maxItems: 16 },
							),
						},
						{ additionalProperties: false },
					),
					{ minItems: 1, maxItems: 32 },
				),
				basis: Type.Array(
					Type.String({ minLength: 1, maxLength: MAX_EVIDENCE_CHARS }),
					{ minItems: 1, maxItems: 16 },
				),
				expected_current_assessment_id: Type.Optional(
					Type.String({ minLength: 1, maxLength: 512 }),
				),
			},
			{ additionalProperties: false },
		),
		executionMode: "sequential",
		renderShell: "self",
		async execute(_toolCallId, params) {
			if (!developerEnabled) {
				fail("Developer protocol is off. Run /developer on first.");
			}
			if (!activeWorkCase) fail("No active Action Loop Work Case.");
			if (
				!isStringEnumValue(params.outcome, [
					"observed-success",
					"observed-no-effect",
					"failed",
					"partially-applied",
					"pending",
					"unknown",
				] as const)
			) {
				fail("Effect outcome is outside the closed settlement domain.");
			}
			const observationDispositions = params.observation_dispositions.map(
				(disposition) => {
					if (
						!isStringEnumValue(disposition.status, [
							"relied-on",
							"not-relied-on",
						] as const)
					) {
						fail("Observation status is outside the closed settlement domain.");
					}
					return {
						effectObservationId: disposition.effect_observation_id,
						status: disposition.status,
						basis: [...disposition.basis],
					};
				},
			);
			const intendedEffectDispositions =
				params.intended_effect_dispositions.map((disposition) => {
					if (
						!isStringEnumValue(disposition.status, [
							"observed",
							"not-observed",
							"failed",
							"partially-observed",
							"unknown",
						] as const)
					) {
						fail(
							"Intended Effect status is outside the closed settlement domain.",
						);
					}
					return {
						intendedEffect: disposition.intended_effect,
						status: disposition.status,
						observationIds: [...disposition.observation_ids],
						basis: [...disposition.basis],
					};
				});
			const proposal = {
				outcome: params.outcome,
				observationDispositions,
				intendedEffectDispositions,
				basis: params.basis,
				expectedCurrentAssessmentId: params.expected_current_assessment_id,
			};
			const settled = settleLiveEffect(
				activeWorkCase,
				params.effect_id,
				proposal,
			);
			if (settled.status === "invalid") fail(settled.message);
			activeWorkCase = settled.state;
			const assessmentId = currentLiveEffectAssessmentId(
				settled.state,
				params.effect_id,
			);
			if (!assessmentId)
				fail("Effect settlement has no current assessment ID.");
			return textResult(
				`Effect ${settled.status}: ${assessmentId} · ${settled.assessment.outcome}`,
				withActionLoopReplayEvent(
					{
						protocol: "developer-action-loop/v1",
						kind: settled.status,
						assessment: settled.assessment as unknown,
						assessmentId,
					},
					actionLoopEffectSettledEvent(
						params.effect_id,
						proposal,
						assessmentId,
						settled.state.workCase.revisionId,
					),
				),
			);
		},
	});

	registerActionLoopTool({
		name: ACTION_LOOP_RECORD_REMEDIATION_TOOL,
		label: "Developer Record Effect Remediation",
		description:
			"Bind one current failed or partially-applied Effect settlement to a distinct current observed-success repair settlement.",
		promptSnippet: "Record exact adverse Effect remediation",
		promptGuidelines: [
			`Use ${ACTION_LOOP_RECORD_REMEDIATION_TOOL} only after both the adverse Effect and distinct repair Effect have current settled assessments.`,
			"Never rewrite adverse history as success. Account for both Effect settlements and the remediation relation during closure.",
		],
		parameters: Type.Object(
			{
				adverse_effect_id: Type.String({ minLength: 1, maxLength: 512 }),
				remediation_effect_id: Type.String({ minLength: 1, maxLength: 512 }),
				basis: Type.Array(
					Type.String({ minLength: 1, maxLength: MAX_EVIDENCE_CHARS }),
					{ minItems: 1, maxItems: 16 },
				),
			},
			{ additionalProperties: false },
		),
		executionMode: "sequential",
		renderShell: "self",
		async execute(_toolCallId, params) {
			if (!developerEnabled) {
				fail("Developer protocol is off. Run /developer on first.");
			}
			if (!activeWorkCase) fail("No active Action Loop Work Case.");
			const remediation = recordLiveEffectRemediation(
				activeWorkCase,
				params.adverse_effect_id,
				params.remediation_effect_id,
				params.basis,
			);
			if (remediation.status === "invalid") fail(remediation.message);
			activeWorkCase = remediation.state;
			return textResult(
				`Effect remediation ${remediation.status}: ${remediation.remediationId}`,
				withActionLoopReplayEvent(
					{
						protocol: "developer-action-loop/v1",
						kind: remediation.status,
						remediationId: remediation.remediationId,
						adverseEffectId: params.adverse_effect_id,
						remediationEffectId: params.remediation_effect_id,
					},
					actionLoopEffectRemediatedEvent({
						adverseEffectId: params.adverse_effect_id,
						remediationEffectId: params.remediation_effect_id,
						basis: params.basis,
						remediationId: remediation.remediationId,
						revisionId: remediation.state.workCase.revisionId,
					}),
				),
			);
		},
	});

	registerActionLoopTool({
		name: ACTION_LOOP_PAUSE_WORK_CASE_TOOL,
		label: "Developer Pause Work Case",
		description:
			"Pause the current Work Case only from an exact host-admitted human prompt that explicitly delegates suspension.",
		promptSnippet: "Pause current work from an exact human decision",
		promptGuidelines: [
			`Use ${ACTION_LOOP_PAUSE_WORK_CASE_TOOL} when the exact current user prompt explicitly asks to pause; the user should not need to invoke a protocol command.`,
			"Do not infer a human pause from model uncertainty, external waiting, or an ordinary end of turn.",
		],
		parameters: Type.Object(
			{
				observation_id: Type.String({ minLength: 1, maxLength: 512 }),
				reason: Type.String({
					minLength: 1,
					maxLength: MAX_LIVE_CONTINUITY_TEXT,
				}),
				basis: Type.Array(
					Type.String({ minLength: 1, maxLength: MAX_EVIDENCE_CHARS }),
					{ minItems: 1, maxItems: 16 },
				),
			},
			{ additionalProperties: false },
		),
		executionMode: "sequential",
		renderShell: "self",
		async execute(_toolCallId, params) {
			if (!developerEnabled) {
				fail("Developer protocol is off. Run /developer on first.");
			}
			if (!actionLoopSessionDurable) {
				fail(
					"Developer cannot retain paused ownership in Pi --no-session mode.",
				);
			}
			if (actionLoopReplayFailure) {
				fail(
					`Developer cannot pause unavailable Action Loop state: ${actionLoopReplayFailure}`,
				);
			}
			if (!activeWorkCase) fail("No active Action Loop Work Case.");
			const observation = currentHostObservation(
				params.observation_id,
				activeWorkCase,
			);
			if (!observation || observation.kind !== "human") {
				fail("Pausing requires an exact current human-origin Observation.");
			}
			const proposal = {
				workCaseId: activeWorkCase.workCase.workCaseId,
				expectedRevisionId: activeWorkCase.workCase.revisionId,
				reason: params.reason,
				decision: {
					kind: "human" as const,
					decisionId: observation.observationId,
					source: observation.source,
					basis: [...observation.basis, ...params.basis],
				},
			};
			const result = pauseLiveWorkCase(activeWorkCase, proposal);
			if (result.status === "invalid") fail(result.message);
			activeWorkCase = undefined;
			heldWorkCase = result.state;
			liveHostObservations = [];
			completedWorkCase = undefined;
			syncProtocolTools();
			return textResult(
				"Work paused by the current human decision.",
				withActionLoopReplayEvent(
					{
						protocol: "developer-action-loop/v1",
						kind: "paused",
						workCasePauseId: result.state.workCase.pause.workCasePauseId,
						revisionId: result.state.workCase.revisionId,
					},
					actionLoopWorkCasePausedEvent(proposal, result.state),
				),
			);
		},
	});

	registerActionLoopTool({
		name: ACTION_LOOP_WAIT_WORK_CASE_TOOL,
		label: "Developer Wait Work Case",
		description:
			"Retain durable waiting ownership from one exact host-admitted user prompt, finalized tool result, or current Effect Observation plus an observable resume predicate.",
		promptSnippet: "Wait on an observed external condition",
		promptGuidelines: [
			`Use ${ACTION_LOOP_WAIT_WORK_CASE_TOOL} when an exact host-admitted observation evidences an external condition that prevents continuation; the user should not need to invoke a wait command.`,
			"State one exact observable resume predicate. Waiting blocks controlled Actions and replacement work until observation-bound resume or Developer-off reset.",
		],
		parameters: Type.Object(
			{
				observation_id: Type.String({ minLength: 1, maxLength: 512 }),
				external_condition: Type.String({
					minLength: 1,
					maxLength: MAX_LIVE_CONTINUITY_TEXT,
				}),
				resume_predicate: Type.String({
					minLength: 1,
					maxLength: MAX_LIVE_CONTINUITY_TEXT,
				}),
				basis: Type.Array(
					Type.String({ minLength: 1, maxLength: MAX_EVIDENCE_CHARS }),
					{ minItems: 1, maxItems: 16 },
				),
			},
			{ additionalProperties: false },
		),
		executionMode: "sequential",
		renderShell: "self",
		async execute(_toolCallId, params) {
			if (!developerEnabled) {
				fail("Developer protocol is off. Run /developer on first.");
			}
			if (!actionLoopSessionDurable) {
				fail(
					"Developer cannot retain waiting ownership in Pi --no-session mode.",
				);
			}
			if (actionLoopReplayFailure) {
				fail(
					`Developer cannot wait unavailable Action Loop state: ${actionLoopReplayFailure}`,
				);
			}
			if (!activeWorkCase) fail("No active Action Loop Work Case.");
			const observation = currentHostObservation(
				params.observation_id,
				activeWorkCase,
			);
			if (!observation) {
				fail("Waiting requires an exact current host-admitted Observation.");
			}
			const proposal = {
				workCaseId: activeWorkCase.workCase.workCaseId,
				expectedRevisionId: activeWorkCase.workCase.revisionId,
				externalCondition: params.external_condition,
				resumePredicate: params.resume_predicate,
				observation: {
					kind: observation.kind,
					observationId: observation.observationId,
					source: observation.source,
					basis: [...observation.basis, ...params.basis],
				},
			};
			const result = waitLiveWorkCase(activeWorkCase, proposal);
			if (result.status === "invalid") fail(result.message);
			activeWorkCase = undefined;
			heldWorkCase = result.state;
			liveHostObservations = [];
			completedWorkCase = undefined;
			syncProtocolTools();
			return textResult(
				"Work is waiting on the observed external condition.",
				withActionLoopReplayEvent(
					{
						protocol: "developer-action-loop/v1",
						kind: "waiting",
						workCaseWaitId: result.state.workCase.wait.workCaseWaitId,
						revisionId: result.state.workCase.revisionId,
					},
					actionLoopWorkCaseWaitingEvent(proposal, result.state),
				),
			);
		},
	});

	registerActionLoopTool({
		name: ACTION_LOOP_BLOCK_WORK_CASE_TOOL,
		label: "Developer Block Work Case",
		description:
			"Retain durable blocked ownership only when one exact current Claim Assurance Conclusion accounts every current closure blocker.",
		promptSnippet: "Block with complete Claim Assurance",
		promptGuidelines: [
			`Use ${ACTION_LOOP_BLOCK_WORK_CASE_TOOL} only when there is no current continuation or closure path and a current Claim Assurance Conclusion accounts every blocker.`,
			"Developer derives the complete blocker inventory. Do not omit blockers or use blocked as a synonym for waiting, failure, or incomplete work.",
		],
		parameters: Type.Object(
			{
				claim_assurance_conclusion_id: Type.String({
					minLength: 1,
					maxLength: 512,
				}),
				reason: Type.String({
					minLength: 1,
					maxLength: MAX_LIVE_CONTINUITY_TEXT,
				}),
				basis: Type.Array(
					Type.String({ minLength: 1, maxLength: MAX_EVIDENCE_CHARS }),
					{ minItems: 1, maxItems: 16 },
				),
			},
			{ additionalProperties: false },
		),
		executionMode: "sequential",
		renderShell: "self",
		async execute(_toolCallId, params) {
			if (!developerEnabled) {
				fail("Developer protocol is off. Run /developer on first.");
			}
			if (!actionLoopSessionDurable) {
				fail(
					"Developer cannot retain blocked ownership in Pi --no-session mode.",
				);
			}
			if (actionLoopReplayFailure) {
				fail(
					`Developer cannot block unavailable Action Loop state: ${actionLoopReplayFailure}`,
				);
			}
			if (!activeWorkCase) fail("No active Action Loop Work Case.");
			const assurance = activeWorkCase.workCase.conclusions.find(
				(conclusion) =>
					conclusion.conclusionId === params.claim_assurance_conclusion_id &&
					conclusion.category === "Claim Assurance",
			);
			if (!assurance) {
				fail(
					"Blocking requires the exact ID of a current Claim Assurance Conclusion.",
				);
			}
			const prepared = prepareLiveWorkCaseClosure(activeWorkCase);
			if (prepared.status === "invalid") fail(prepared.message);
			if (prepared.status === "ready") {
				fail("A closure-ready Work Case cannot be declared blocked.");
			}
			if (prepared.blockers.length > MAX_ACTION_LOOP_BLOCKER_DISPOSITIONS) {
				fail(
					`Current blocker accounting exceeds the durable limit of ${MAX_ACTION_LOOP_BLOCKER_DISPOSITIONS}.`,
				);
			}
			const proposal = {
				workCaseId: activeWorkCase.workCase.workCaseId,
				expectedRevisionId: activeWorkCase.workCase.revisionId,
				claimAssuranceConclusionId: assurance.conclusionId,
				reason: params.reason,
				blockerDispositions: prepared.blockers.map((blocker) => ({
					code: blocker.code,
					subjectId: blocker.subjectId,
					basis: params.basis,
				})),
			};
			const result = blockLiveWorkCase(activeWorkCase, proposal);
			if (result.status === "invalid") fail(result.message);
			activeWorkCase = undefined;
			heldWorkCase = result.state;
			liveHostObservations = [];
			completedWorkCase = undefined;
			syncProtocolTools();
			return textResult(
				"Work is blocked with complete Claim Assurance.",
				withActionLoopReplayEvent(
					{
						protocol: "developer-action-loop/v1",
						kind: "blocked",
						workCaseBlockId: result.state.workCase.block.workCaseBlockId,
						revisionId: result.state.workCase.revisionId,
					},
					actionLoopWorkCaseBlockedEvent(proposal, result.state),
				),
			);
		},
	});

	registerActionLoopTool({
		name: ACTION_LOOP_RESUME_WORK_CASE_TOOL,
		label: "Developer Resume Work Case",
		description:
			"Resume the current paused, waiting, or blocked Work Case from one exact host-admitted Observation. Waiting requires evidence satisfying its exact predicate; blocked requires an observed change and bounded continuation; paused requires a human prompt decision.",
		promptSnippet: "Resume held Action Loop work from exact host evidence",
		promptGuidelines: [
			`Use ${ACTION_LOOP_RESUME_WORK_CASE_TOOL} when the current user prompt or a finalized tool result supplies exact evidence that held work may continue; the user should not need to invoke a resume command.`,
			"Never resume waiting without evidence satisfying the stored predicate, blocked without an observed change and concrete continuation, or paused without a human-origin Observation.",
		],
		parameters: Type.Object(
			{
				observation_id: Type.String({ minLength: 1, maxLength: 512 }),
				observed_change: Type.Optional(
					Type.String({ minLength: 1, maxLength: MAX_LIVE_CONTINUITY_TEXT }),
				),
				continuation: Type.Optional(
					Type.String({ minLength: 1, maxLength: MAX_LIVE_CONTINUITY_TEXT }),
				),
				basis: Type.Array(
					Type.String({ minLength: 1, maxLength: MAX_EVIDENCE_CHARS }),
					{ minItems: 1, maxItems: 16 },
				),
			},
			{ additionalProperties: false },
		),
		executionMode: "sequential",
		renderShell: "self",
		async execute(_toolCallId, params) {
			if (!developerEnabled) {
				fail("Developer protocol is off. Run /developer on first.");
			}
			if (!actionLoopSessionDurable) {
				fail(
					"Developer cannot resume durable ownership in Pi --no-session mode.",
				);
			}
			if (actionLoopReplayFailure) {
				fail(
					`Developer cannot resume unavailable Action Loop state: ${actionLoopReplayFailure}`,
				);
			}
			if (!heldWorkCase) {
				fail("No paused, waiting, or blocked Action Loop Work Case.");
			}
			const observation = currentHostObservation(
				params.observation_id,
				heldWorkCase,
			);
			if (!observation) {
				fail("Resume requires an exact current host-admitted Observation.");
			}
			const basis = [...observation.basis, ...params.basis];
			if (isLivePausedWorkCaseState(heldWorkCase)) {
				if (observation.kind !== "human") {
					fail("Paused work requires a human-origin resume decision.");
				}
				const proposal = {
					workCaseId: heldWorkCase.workCase.workCaseId,
					expectedRevisionId: heldWorkCase.workCase.revisionId,
					decision: {
						kind: "human",
						decisionId: observation.observationId,
						source: observation.source,
						basis,
					},
				};
				const result = resumeLivePausedWorkCase(heldWorkCase, proposal);
				if (result.status === "invalid") fail(result.message);
				heldWorkCase = undefined;
				activeWorkCase = result.state;
				liveHostObservations = [];
				syncProtocolTools();
				return textResult(
					"Paused work resumed from the current human decision.",
					withActionLoopReplayEvent(
						{
							protocol: "developer-action-loop/v1",
							kind: "resumed-paused",
							revisionId: result.state.workCase.revisionId,
						},
						actionLoopPausedWorkCaseResumedEvent(proposal, result.state),
					),
				);
			}
			if (isLiveWaitingWorkCaseState(heldWorkCase)) {
				const proposal = {
					workCaseId: heldWorkCase.workCase.workCaseId,
					expectedRevisionId: heldWorkCase.workCase.revisionId,
					assessment: {
						resumePredicate: heldWorkCase.workCase.wait.resumePredicate,
						status: "satisfied" as const,
						observationKind: observation.kind,
						observationId: observation.observationId,
						source: observation.source,
						basis,
					},
				};
				const result = resumeLiveWaitingWorkCase(heldWorkCase, proposal);
				if (result.status !== "active") {
					fail(
						result.status === "invalid"
							? result.message
							: "The exact waiting resume predicate remains unsatisfied.",
					);
				}
				heldWorkCase = undefined;
				activeWorkCase = result.state;
				liveHostObservations = [];
				syncProtocolTools();
				return textResult(
					"Waiting work resumed from current evidence.",
					withActionLoopReplayEvent(
						{
							protocol: "developer-action-loop/v1",
							kind: "resumed-waiting",
							revisionId: result.state.workCase.revisionId,
						},
						actionLoopWaitingWorkCaseResumedEvent(proposal, result.state),
					),
				);
			}
			if (!isLiveBlockedWorkCaseState(heldWorkCase)) {
				fail("Unsupported held Work Case status.");
			}
			const observedChange = params.observed_change?.trim();
			const continuation = params.continuation?.trim();
			if (!observedChange || !continuation) {
				fail(
					"Blocked work requires an observed_change and concrete continuation.",
				);
			}
			const proposal = {
				workCaseId: heldWorkCase.workCase.workCaseId,
				expectedRevisionId: heldWorkCase.workCase.revisionId,
				continuation,
				observation: {
					kind: observation.kind,
					observationId: observation.observationId,
					source: observation.source,
					statement: observedChange,
					basis,
				},
			};
			const result = resumeLiveBlockedWorkCase(heldWorkCase, proposal);
			if (result.status === "invalid") fail(result.message);
			heldWorkCase = undefined;
			activeWorkCase = result.state;
			liveHostObservations = [];
			syncProtocolTools();
			return textResult(
				"Blocked work resumed from the observed change and bounded continuation.",
				withActionLoopReplayEvent(
					{
						protocol: "developer-action-loop/v1",
						kind: "resumed-blocked",
						revisionId: result.state.workCase.revisionId,
					},
					actionLoopBlockedWorkCaseResumedEvent(proposal, result.state),
				),
			);
		},
	});

	registerActionLoopTool({
		name: ACTION_LOOP_PREPARE_CLOSURE_TOOL,
		label: "Developer Prepare Closure",
		description:
			"Prepare a revision-bound Closure Target from the complete canonical Work Case inventory.",
		promptSnippet: "Prepare current Work Case closure",
		promptGuidelines: [
			`Use ${ACTION_LOOP_PREPARE_CLOSURE_TOOL} before proposing completion. Do not select Conclusion or Effect subsets.`,
			"Resolve every returned blocker before making a Closure Claim.",
		],
		parameters: Type.Object({}, { additionalProperties: false }),
		executionMode: "sequential",
		renderShell: "self",
		async execute() {
			if (!developerEnabled) {
				fail("Developer protocol is off. Run /developer on first.");
			}
			if (!activeWorkCase) fail("No active Action Loop Work Case.");
			const prepared = prepareLiveWorkCaseClosure(activeWorkCase);
			if (prepared.status === "invalid") fail(prepared.message);
			if (prepared.status === "not-ready") {
				return textResult(
					`Work Case closure not ready: ${prepared.blockers.map((blocker) => blocker.code).join(", ")}`,
					{
						protocol: "developer-action-loop/v1",
						kind: "closure-preparation",
						status: "not-ready",
						artifact: prepared.blockers as unknown,
					},
				);
			}
			return textResult(
				`Closure Target ready: ${prepared.target.closureTargetId}`,
				{
					protocol: "developer-action-loop/v1",
					kind: "closure-preparation",
					status: "ready",
					artifact: prepared.target as unknown,
				},
			);
		},
	});

	registerActionLoopTool({
		name: ACTION_LOOP_COMPLETE_WORK_CASE_TOOL,
		label: "Developer Complete Work Case",
		description:
			"Accept complete Closure Claim accounting and atomically revalidate the current Work Case before completion.",
		promptSnippet: "Complete the current Work Case",
		promptGuidelines: [
			`Use ${ACTION_LOOP_COMPLETE_WORK_CASE_TOOL} only with the exact current Closure Target returned by ${ACTION_LOOP_PREPARE_CLOSURE_TOOL}.`,
			"Account for every Closure Obligation and apply every current Conclusion, Effect assessment, and remediation exactly once.",
		],
		parameters: Type.Object(
			{
				closure_target_id: Type.String({ minLength: 1, maxLength: 512 }),
				mode: StringEnum(["completed", "no-change"] as const),
				obligation_dispositions: Type.Array(
					Type.Object(
						{
							closure_obligation_id: Type.String({
								minLength: 1,
								maxLength: 512,
							}),
							conclusion_ids: Type.Array(
								Type.String({ minLength: 1, maxLength: 512 }),
								{ maxItems: 32 },
							),
							effect_assessment_ids: Type.Array(
								Type.String({ minLength: 1, maxLength: 512 }),
								{ maxItems: 32 },
							),
							effect_remediation_ids: Type.Array(
								Type.String({ minLength: 1, maxLength: 512 }),
								{ maxItems: 32 },
							),
							basis: Type.Array(
								Type.String({ minLength: 1, maxLength: MAX_EVIDENCE_CHARS }),
								{ minItems: 1, maxItems: 16 },
							),
						},
						{ additionalProperties: false },
					),
					{ minItems: 1, maxItems: 64 },
				),
				basis: Type.Array(
					Type.String({ minLength: 1, maxLength: MAX_EVIDENCE_CHARS }),
					{ minItems: 1, maxItems: 16 },
				),
			},
			{ additionalProperties: false },
		),
		executionMode: "sequential",
		renderShell: "self",
		async execute(_toolCallId, params) {
			if (!developerEnabled) {
				fail("Developer protocol is off. Run /developer on first.");
			}
			if (!activeWorkCase) fail("No active Action Loop Work Case.");
			const proposal = {
				closureTargetId: params.closure_target_id,
				mode: params.mode,
				obligationDispositions: params.obligation_dispositions.map(
					(disposition) => ({
						closureObligationId: disposition.closure_obligation_id,
						conclusionIds: disposition.conclusion_ids,
						effectAssessmentIds: disposition.effect_assessment_ids,
						effectRemediationIds: disposition.effect_remediation_ids,
						basis: disposition.basis,
					}),
				),
				basis: params.basis,
			};
			const completed = completeLiveWorkCase(activeWorkCase, proposal);
			if (completed.status === "invalid") fail(completed.message);
			completedWorkCase = completed.value;
			activeWorkCase = undefined;
			syncProtocolTools();
			return textResult(
				`Work Case completed: ${completed.value.workCaseId} · ${completed.value.revisionId}`,
				withActionLoopReplayEvent(
					{
						protocol: "developer-action-loop/v1",
						kind: "completed",
						workCase: completed.value,
					},
					actionLoopWorkCaseCompletedEvent(proposal, completed.value),
				),
			);
		},
	});

	const applyLiveCapabilityInventory = (
		result: LiveCapabilityInventoryResult,
	) => {
		liveCapabilityInventory = result;
		availableSkills =
			result.status === "ready"
				? new Map(result.value.availablePackageSkills)
				: new Map();
	};

	const refreshAvailableSkills = async (ctx: ExtensionCommandContext) => {
		if (typeof ctx.getSystemPromptOptions !== "function") return;
		applyLiveCapabilityInventory(
			await prepareLiveCapabilityInventory(
				{ systemPromptOptions: ctx.getSystemPromptOptions() },
				skillsRoot,
			),
		);
	};

	const statusMessage = () => {
		const view = inspectActionLoopWorkbench({
			enabled: developerEnabled,
			activeWorkCase,
			heldWorkCase,
			completedWorkCase,
			replayUnavailable:
				toolPolicyRestartRequired || actionLoopReplayFailure !== undefined,
		});
		const visibleItems = view.sections.flatMap((section) =>
			section.items.map(
				(item) => `${section.label} · ${item.title}: ${item.summary}`,
			),
		);
		return [
			`developer · ${view.statusLabel}`,
			`Outcome · ${view.headline}`,
			`Next · ${view.next}`,
			...visibleItems,
		].join("\n");
	};

	const developerCommand = {
		description:
			"Inspect the canonical Action Loop Workbench or run a focused continuity action",
		getArgumentCompletions: completeDeveloperArgs,
		handler: async (args: string, ctx: ExtensionCommandContext) => {
			const setAndNotifyEnabled = (enabled: boolean): boolean => {
				if (!setEnabled(enabled, ctx)) return false;
				ctx.ui.notify(`Developer: ${enabled ? "on" : "off"}`, "info");
				return true;
			};

			const turnOff = async (): Promise<boolean> => {
				if (ctx.mode === "tui" && (activeWorkCase || heldWorkCase)) {
					const status = activeWorkCase
						? "active"
						: heldWorkCase?.workCase.status;
					const confirmed = await ctx.ui.confirm(
						"Turn off Developer?",
						`This clears the ${status} Action Loop Work Case from the current protocol state. Existing session history remains.`,
					);
					if (!confirmed) return false;
				}
				setAndNotifyEnabled(false);
				return true;
			};

			const pauseCurrentWorkCase = async (): Promise<boolean> => {
				if (!developerEnabled) {
					ctx.ui.notify(
						"Developer is off. Run /developer on first.",
						"warning",
					);
					return false;
				}
				if (ctx.sessionManager.getSessionFile() === undefined) {
					ctx.ui.notify(
						"Developer cannot pause in Pi --no-session mode because restart continuity would be unavailable.",
						"error",
					);
					return false;
				}
				if (actionLoopReplayFailure) {
					ctx.ui.notify(
						`Developer cannot pause unavailable Action Loop state: ${actionLoopReplayFailure}`,
						"error",
					);
					return false;
				}
				if (heldWorkCase) {
					ctx.ui.notify(
						`The current Action Loop Work Case is already ${heldWorkCase.workCase.status}.`,
						"info",
					);
					return false;
				}
				if (!activeWorkCase) {
					ctx.ui.notify(
						"Developer has no active Action Loop Work Case to pause.",
						"warning",
					);
					return false;
				}
				if (!ctx.hasUI) {
					ctx.ui.notify(
						"Pausing requires dialog-capable human input.",
						"error",
					);
					return false;
				}
				const enteredReason = await ctx.ui.input(
					"Pause Action Loop Work Case",
					"Why should this work remain paused?",
				);
				const reason = enteredReason?.trim();
				if (!reason) return false;
				if (reason.length > MAX_LIVE_CONTINUITY_TEXT) {
					ctx.ui.notify(
						`Pause reason exceeds ${MAX_LIVE_CONTINUITY_TEXT} characters.`,
						"warning",
					);
					return false;
				}
				const proposal = {
					workCaseId: activeWorkCase.workCase.workCaseId,
					expectedRevisionId: activeWorkCase.workCase.revisionId,
					reason,
					decision: {
						kind: "human",
						decisionId: `pi-command-pause:${activeWorkCase.workCase.revisionId}`,
						source: "pi:/developer pause",
						basis: [
							"The delegating human explicitly invoked /developer pause and supplied the current reason.",
						],
					},
				};
				const result = pauseLiveWorkCase(activeWorkCase, proposal);
				if (result.status === "invalid") {
					ctx.ui.notify(result.message, "error");
					return false;
				}
				pi.appendEntry(
					ACTION_LOOP_SESSION_ENTRY,
					actionLoopWorkCasePausedEvent(proposal, result.state),
				);
				activeWorkCase = undefined;
				heldWorkCase = result.state;
				completedWorkCase = undefined;
				syncProtocolTools();
				refreshUI(ctx);
				ctx.ui.notify("Developer Action Loop Work Case paused.", "info");
				return true;
			};

			const waitCurrentWorkCase = async (): Promise<boolean> => {
				if (!developerEnabled) {
					ctx.ui.notify(
						"Developer is off. Run /developer on first.",
						"warning",
					);
					return false;
				}
				if (ctx.sessionManager.getSessionFile() === undefined) {
					ctx.ui.notify(
						"Developer cannot wait in Pi --no-session mode because restart continuity would be unavailable.",
						"error",
					);
					return false;
				}
				if (actionLoopReplayFailure) {
					ctx.ui.notify(
						`Developer cannot wait unavailable Action Loop state: ${actionLoopReplayFailure}`,
						"error",
					);
					return false;
				}
				if (heldWorkCase) {
					ctx.ui.notify(
						`The current Action Loop Work Case is already ${heldWorkCase.workCase.status}.`,
						"info",
					);
					return false;
				}
				if (!activeWorkCase) {
					ctx.ui.notify(
						"Developer has no active Action Loop Work Case to wait.",
						"warning",
					);
					return false;
				}
				if (!ctx.hasUI) {
					ctx.ui.notify(
						"Waiting requires dialog-capable human Observation.",
						"error",
					);
					return false;
				}
				const enteredCondition = await ctx.ui.input(
					"Wait on external condition",
					"What observed external condition prevents continuation?",
				);
				const externalCondition = enteredCondition?.trim();
				if (!externalCondition) return false;
				const enteredPredicate = await ctx.ui.input(
					"Observable resume predicate",
					"What exact observable condition permits resume?",
				);
				const resumePredicate = enteredPredicate?.trim();
				if (!resumePredicate) return false;
				if (
					externalCondition.length > MAX_LIVE_CONTINUITY_TEXT ||
					resumePredicate.length > MAX_LIVE_CONTINUITY_TEXT
				) {
					ctx.ui.notify(
						`Wait condition and resume predicate must each be at most ${MAX_LIVE_CONTINUITY_TEXT} characters.`,
						"warning",
					);
					return false;
				}
				const proposal = {
					workCaseId: activeWorkCase.workCase.workCaseId,
					expectedRevisionId: activeWorkCase.workCase.revisionId,
					externalCondition,
					resumePredicate,
					observation: {
						kind: "human" as const,
						observationId: `pi-command-wait:${activeWorkCase.workCase.revisionId}`,
						source: "pi:/developer wait",
						basis: [
							"The delegating human explicitly invoked /developer wait and supplied the observed condition and resume predicate.",
						],
					},
				};
				const result = waitLiveWorkCase(activeWorkCase, proposal);
				if (result.status === "invalid") {
					ctx.ui.notify(result.message, "error");
					return false;
				}
				pi.appendEntry(
					ACTION_LOOP_SESSION_ENTRY,
					actionLoopWorkCaseWaitingEvent(proposal, result.state),
				);
				activeWorkCase = undefined;
				heldWorkCase = result.state;
				completedWorkCase = undefined;
				syncProtocolTools();
				refreshUI(ctx);
				ctx.ui.notify("Developer Action Loop Work Case is waiting.", "info");
				return true;
			};

			const blockCurrentWorkCase = async (): Promise<boolean> => {
				if (!developerEnabled) {
					ctx.ui.notify(
						"Developer is off. Run /developer on first.",
						"warning",
					);
					return false;
				}
				if (ctx.sessionManager.getSessionFile() === undefined) {
					ctx.ui.notify(
						"Developer cannot block in Pi --no-session mode because restart continuity would be unavailable.",
						"error",
					);
					return false;
				}
				if (actionLoopReplayFailure) {
					ctx.ui.notify(
						`Developer cannot block unavailable Action Loop state: ${actionLoopReplayFailure}`,
						"error",
					);
					return false;
				}
				if (heldWorkCase) {
					ctx.ui.notify(
						`The current Action Loop Work Case is already ${heldWorkCase.workCase.status}.`,
						"info",
					);
					return false;
				}
				if (!activeWorkCase) {
					ctx.ui.notify(
						"Developer has no active Action Loop Work Case to block.",
						"warning",
					);
					return false;
				}
				if (!ctx.hasUI) {
					ctx.ui.notify(
						"Blocking requires dialog-capable human input.",
						"error",
					);
					return false;
				}
				const prepared = prepareLiveWorkCaseClosure(activeWorkCase);
				if (prepared.status === "invalid") {
					ctx.ui.notify(prepared.message, "error");
					return false;
				}
				if (prepared.status === "ready") {
					ctx.ui.notify(
						"The current Work Case is closure-ready and cannot be declared blocked.",
						"warning",
					);
					return false;
				}
				if (prepared.blockers.length > MAX_ACTION_LOOP_BLOCKER_DISPOSITIONS) {
					ctx.ui.notify(
						`Current blocker accounting exceeds the durable limit of ${MAX_ACTION_LOOP_BLOCKER_DISPOSITIONS}.`,
						"error",
					);
					return false;
				}
				const assurances = activeWorkCase.workCase.conclusions.filter(
					(conclusion) => conclusion.category === "Claim Assurance",
				);
				if (assurances.length === 0) {
					ctx.ui.notify(
						"Blocking requires a current Claim Assurance Conclusion.",
						"warning",
					);
					return false;
				}
				let assurance = assurances[0];
				if (assurances.length > 1) {
					const options = assurances.map(
						(conclusion) =>
							`${conclusion.conclusionId} · ${compactLine(conclusion.answer, 120)}`,
					);
					const selected = await ctx.ui.select(
						"Select current Claim Assurance",
						options,
					);
					if (!selected) return false;
					assurance = assurances[options.indexOf(selected)];
				}
				if (!assurance) return false;
				const reason = (
					await ctx.ui.input(
						"Block Action Loop Work Case",
						"Why is no current continuation or closure path available?",
					)
				)?.trim();
				if (!reason) return false;
				if (reason.length > MAX_LIVE_CONTINUITY_TEXT) {
					ctx.ui.notify(
						`Block reason exceeds ${MAX_LIVE_CONTINUITY_TEXT} characters.`,
						"warning",
					);
					return false;
				}
				const proposal = {
					workCaseId: activeWorkCase.workCase.workCaseId,
					expectedRevisionId: activeWorkCase.workCase.revisionId,
					claimAssuranceConclusionId: assurance.conclusionId,
					reason,
					blockerDispositions: prepared.blockers.map((blocker) => ({
						code: blocker.code,
						subjectId: blocker.subjectId,
						basis: [
							"The selected current Claim Assurance and explicit /developer block decision account for this exact blocker.",
						],
					})),
				};
				const result = blockLiveWorkCase(activeWorkCase, proposal);
				if (result.status === "invalid") {
					ctx.ui.notify(result.message, "error");
					return false;
				}
				pi.appendEntry(
					ACTION_LOOP_SESSION_ENTRY,
					actionLoopWorkCaseBlockedEvent(proposal, result.state),
				);
				activeWorkCase = undefined;
				heldWorkCase = result.state;
				completedWorkCase = undefined;
				syncProtocolTools();
				refreshUI(ctx);
				ctx.ui.notify("Developer Action Loop Work Case is blocked.", "info");
				return true;
			};

			const resumeHeldWork = async (): Promise<boolean> => {
				if (!developerEnabled) {
					ctx.ui.notify(
						"Developer is off. Run /developer on first.",
						"warning",
					);
					return false;
				}
				if (ctx.sessionManager.getSessionFile() === undefined) {
					ctx.ui.notify(
						"Developer cannot resume durable Action Loop ownership in Pi --no-session mode.",
						"error",
					);
					return false;
				}
				if (!heldWorkCase) {
					ctx.ui.notify(
						"Developer has no paused, waiting, or blocked Action Loop Work Case.",
						"warning",
					);
					return false;
				}
				if (!ctx.hasUI) {
					ctx.ui.notify(
						"Resuming requires dialog-capable human input.",
						"error",
					);
					return false;
				}
				if (isLivePausedWorkCaseState(heldWorkCase)) {
					const confirmed = await ctx.ui.confirm(
						"Resume Action Loop Work Case?",
						`Resume the current human-owned pause?\n\n${heldWorkCase.workCase.pause.reason}`,
					);
					if (!confirmed) return false;
					const proposal = {
						workCaseId: heldWorkCase.workCase.workCaseId,
						expectedRevisionId: heldWorkCase.workCase.revisionId,
						decision: {
							kind: "human",
							decisionId: `pi-command-resume:${heldWorkCase.workCase.revisionId}`,
							source: "pi:/developer resume",
							basis: [
								"The delegating human explicitly invoked and confirmed /developer resume for the current pause.",
							],
						},
					};
					const result = resumeLivePausedWorkCase(heldWorkCase, proposal);
					if (result.status === "invalid") {
						ctx.ui.notify(result.message, "error");
						return false;
					}
					pi.appendEntry(
						ACTION_LOOP_SESSION_ENTRY,
						actionLoopPausedWorkCaseResumedEvent(proposal, result.state),
					);
					heldWorkCase = undefined;
					activeWorkCase = result.state;
					syncProtocolTools();
					refreshUI(ctx);
					ctx.ui.notify("Developer Action Loop Work Case resumed.", "info");
					return true;
				}
				if (isLiveWaitingWorkCaseState(heldWorkCase)) {
					const confirmed = await ctx.ui.confirm(
						"Resume waiting Action Loop Work Case?",
						`Confirm that the exact resume predicate is now observed as satisfied:\n\n${heldWorkCase.workCase.wait.resumePredicate}`,
					);
					if (!confirmed) return false;
					const proposal = {
						workCaseId: heldWorkCase.workCase.workCaseId,
						expectedRevisionId: heldWorkCase.workCase.revisionId,
						assessment: {
							resumePredicate: heldWorkCase.workCase.wait.resumePredicate,
							status: "satisfied" as const,
							observationKind: "human" as const,
							observationId: `pi-command-wait-resume:${heldWorkCase.workCase.revisionId}`,
							source: "pi:/developer resume",
							basis: [
								"The delegating human explicitly confirmed that the current observed condition satisfies the exact waiting resume predicate.",
							],
						},
					};
					const result = resumeLiveWaitingWorkCase(heldWorkCase, proposal);
					if (result.status !== "active") {
						ctx.ui.notify(
							result.status === "invalid"
								? result.message
								: "The resume predicate is not satisfied.",
							result.status === "invalid" ? "error" : "info",
						);
						return false;
					}
					pi.appendEntry(
						ACTION_LOOP_SESSION_ENTRY,
						actionLoopWaitingWorkCaseResumedEvent(proposal, result.state),
					);
					heldWorkCase = undefined;
					activeWorkCase = result.state;
					syncProtocolTools();
					refreshUI(ctx);
					ctx.ui.notify("Developer Action Loop Work Case resumed.", "info");
					return true;
				}
				if (!isLiveBlockedWorkCaseState(heldWorkCase)) return false;
				const observedStatement = (
					await ctx.ui.input(
						"Observed blocker change",
						"What exact observed change makes continuation possible?",
					)
				)?.trim();
				if (!observedStatement) return false;
				const continuation = (
					await ctx.ui.input(
						"Concrete continuation",
						"What bounded continuation is now available?",
					)
				)?.trim();
				if (!continuation) return false;
				if (
					observedStatement.length > MAX_LIVE_CONTINUITY_TEXT ||
					continuation.length > MAX_LIVE_CONTINUITY_TEXT
				) {
					ctx.ui.notify(
						`Observed change and continuation must each be at most ${MAX_LIVE_CONTINUITY_TEXT} characters.`,
						"warning",
					);
					return false;
				}
				const proposal = {
					workCaseId: heldWorkCase.workCase.workCaseId,
					expectedRevisionId: heldWorkCase.workCase.revisionId,
					continuation,
					observation: {
						kind: "human" as const,
						observationId: `pi-command-unblock:${heldWorkCase.workCase.revisionId}`,
						source: "pi:/developer resume",
						statement: observedStatement,
						basis: [
							"The delegating human explicitly supplied the observed blocker change and concrete continuation.",
						],
					},
				};
				const result = resumeLiveBlockedWorkCase(heldWorkCase, proposal);
				if (result.status === "invalid") {
					ctx.ui.notify(result.message, "error");
					return false;
				}
				pi.appendEntry(
					ACTION_LOOP_SESSION_ENTRY,
					actionLoopBlockedWorkCaseResumedEvent(proposal, result.state),
				);
				heldWorkCase = undefined;
				activeWorkCase = result.state;
				syncProtocolTools();
				refreshUI(ctx);
				ctx.ui.notify("Developer Action Loop Work Case resumed.", "info");
				return true;
			};

			const inspectWorkbench = async (
				initialSection: "overview" = "overview",
			): Promise<void> => {
				await refreshAvailableSkills(ctx);
				await showActionLoopWorkbench(
					ctx,
					inspectActionLoopWorkbench({
						enabled: developerEnabled,
						activeWorkCase,
						heldWorkCase,
						completedWorkCase,
						replayUnavailable:
							toolPolicyRestartRequired ||
							actionLoopReplayFailure !== undefined,
					}),
					initialSection,
				);
			};

			const inspectStatus = async (): Promise<void> => {
				await refreshAvailableSkills(ctx);
				if (ctx.mode === "tui") {
					await inspectWorkbench("overview");
					return;
				}
				ctx.ui.notify(
					toolPolicyRestartRequired
						? `${TOOL_POLICY_RESTART_MESSAGE}\n${statusMessage()}`
						: statusMessage(),
					toolPolicyRestartRequired ? "error" : "info",
				);
			};

			const parsed = parseDeveloperCommand(args);
			if (!parsed.ok) {
				ctx.ui.notify(
					"Usage: /developer [status | settings | pause | wait | block | resume | on | off]",
					"warning",
				);
				return;
			}
			const action = parsed.command.kind;
			if (action === "workbench") {
				if (ctx.mode === "tui") await inspectWorkbench();
				else await inspectStatus();
				return;
			}
			if (action === "status") {
				await inspectStatus();
				return;
			}
			if (action === "settings") {
				ctx.ui.notify(
					`Developer settings: activation ${developerEnabled ? "on" : "off"}. Use /developer on or /developer off to change it.`,
					"info",
				);
				return;
			}
			if (action === "pause") {
				await pauseCurrentWorkCase();
				return;
			}
			if (action === "wait") {
				await waitCurrentWorkCase();
				return;
			}
			if (action === "block") {
				await blockCurrentWorkCase();
				return;
			}
			if (action === "resume") {
				await resumeHeldWork();
				return;
			}
			if (action === "on") {
				setAndNotifyEnabled(true);
				return;
			}
			if (action === "off") await turnOff();
		},
	};
	pi.registerCommand("developer", developerCommand);

	const entryRendererAPI = pi as ExtensionAPI & {
		registerEntryRenderer?: ExtensionAPI["registerEntryRenderer"];
	};
	entryRendererAPI.registerEntryRenderer?.(
		DEVELOPER_MODE_ENTRY,
		(entry, _options, theme) => {
			const event = decodeDeveloperModeEvent(entry.data);
			if (!event || event.kind !== "activation") return undefined;
			return new Text(
				`${theme.fg("toolTitle", theme.bold("Developer"))} ${theme.fg("accent", event.enabled ? "on" : "off")}`,
				0,
				0,
			);
		},
	);

	pi.on("before_agent_start", async (event) => {
		const inventory = await prepareLiveCapabilityInventory(event, skillsRoot);
		applyLiveCapabilityInventory(inventory);
		if (pendingActionLoopBranch) {
			const replayed = await replayActionLoopSession(
				pendingActionLoopBranch,
				inventory,
			);
			pendingActionLoopBranch = undefined;
			if (replayed.status === "ready") {
				activeWorkCase = replayed.activeWorkCase;
				heldWorkCase = replayed.heldWorkCase;
				completedWorkCase = replayed.completedWorkCase;
				actionLoopReplayFailure = undefined;
			} else {
				activeWorkCase = undefined;
				heldWorkCase = undefined;
				completedWorkCase = undefined;
				actionLoopReplayFailure = `entry ${replayed.entryIndex}: ${replayed.message}`;
			}
			syncProtocolTools();
		}
		if (!developerEnabled) return;
		currentActionLoopRequest = event.prompt;
		liveHostObservations = [];
		const ownership = activeWorkCase ?? heldWorkCase;
		const admittedPrompt = admitLiveUserPromptObservation(
			event.prompt,
			ownership?.workCase.workCaseId,
		);
		if (admittedPrompt.status === "admitted") {
			rememberHostObservation(admittedPrompt.observation);
		}
		return {
			systemPrompt:
				event.systemPrompt +
				actionLoopProtocolPrompt([...availableSkills.keys()]) +
				`\n${liveCapabilityInventoryPrompt(inventory)}` +
				(actionLoopReplayFailure
					? `\nAction Loop session replay unavailable (${ACTION_LOOP_SESSION_PROTOCOL}): ${actionLoopReplayFailure}. Do not open replacement work or infer completion.`
					: `\n${liveWorkCasePrompt(activeWorkCase ?? heldWorkCase)}\n${liveCompletedWorkCasePrompt(completedWorkCase)}\n${liveHostObservationPrompt(liveHostObservations)}`),
		};
	});

	pi.on("context", (event) => {
		if (!developerEnabled || liveHostObservations.length === 0) return;
		return {
			messages: [
				...event.messages,
				{
					role: "custom" as const,
					customType: "developer.host-observations",
					content: liveHostObservationPrompt(liveHostObservations),
					display: false,
					timestamp: Date.now(),
				},
			],
		};
	});

	pi.on("tool_call", (event) => {
		if (!developerEnabled) return;
		const capability = builtinControlledToolCapabilities(pi.getAllTools()).get(
			event.toolName,
		);
		if (!capability) return;
		if (heldWorkCase) {
			return {
				block: true,
				reason: `Developer blocks controlled Actions while work is ${heldWorkCase.workCase.status}. Supply current evidence in a normal message so Developer can resume, or turn Developer off to discard ownership.`,
			};
		}
		if (pendingActionLoopBranch || actionLoopReplayFailure) {
			return {
				block: true,
				reason: pendingActionLoopBranch
					? "Developer must replay the current Pi session branch before controlled tool execution."
					: `Developer Action Loop session replay is unavailable: ${actionLoopReplayFailure}`,
			};
		}
		if (!activeWorkCase) {
			return {
				block: true,
				reason:
					"Developer requires one active canonical Work Case and an exact one-use Action Clearance before controlled tool execution.",
			};
		}
		const clearance = matchingLiveActionClearance(
			activeWorkCase,
			event.toolName,
			event.input as unknown as Readonly<Record<string, unknown>>,
		);
		if (!clearance) {
			return {
				block: true,
				reason:
					"Developer requires the exact current unconsumed Action Clearance for this controlled Pi tool input.",
			};
		}
		const effect = beginLiveActionEffect(
			activeWorkCase,
			clearance,
			event.toolCallId,
		);
		if (effect.status === "invalid") {
			return {
				block: true,
				reason: `Developer could not begin Effect accounting for the cleared Action: ${effect.message}`,
			};
		}
		pi.appendEntry(
			ACTION_LOOP_SESSION_ENTRY,
			actionLoopEffectBegunEvent(
				clearance.actionClearanceId,
				event.toolCallId,
				effect.effect.effectId,
				effect.state.workCase.revisionId,
			),
		);
		activeWorkCase = effect.state;
		syncProtocolTools();
	});

	pi.on("tool_result", async (event) => {
		if (!developerEnabled) return;
		if ((PROTOCOL_TOOLS as readonly string[]).includes(event.toolName)) return;
		if (
			await isDirectSkillMaterialRead(
				event.toolName,
				event.input as Readonly<Record<string, unknown>>,
				skillsRoot,
			)
		) {
			return;
		}
		if (activeWorkCase) {
			const effect = activeWorkCase.workCase.effects.find(
				(current) => current.occurrenceId === event.toolCallId,
			);
			if (effect !== undefined) {
				const observed = observeLivePiToolResult(
					activeWorkCase,
					event.toolName,
					event.toolCallId,
					{
						isError: event.isError,
						content: event.content,
						details: event.details,
					},
				);
				if (observed.status === "invalid") {
					return {
						content: [
							...event.content,
							{
								type: "text" as const,
								text: `Developer could not record Effect Observation: ${observed.message}`,
							},
						],
					};
				}
				pi.appendEntry(
					ACTION_LOOP_SESSION_ENTRY,
					actionLoopEffectObservedEvent(observed.observation),
				);
				activeWorkCase = observed.state;
				const admittedEffect = currentHostObservation(
					observed.observation.effectObservationId,
					observed.state,
				);
				if (admittedEffect) rememberHostObservation(admittedEffect);
				return;
			}
		}
		const ownership = activeWorkCase ?? heldWorkCase;
		const admitted = admitLiveToolResultObservation(
			event.toolName,
			event.toolCallId,
			{
				isError: event.isError,
				content: event.content,
				details: event.details,
			},
			ownership?.workCase.workCaseId,
		);
		if (admitted.status === "admitted") {
			rememberHostObservation(admitted.observation);
		}
	});

	pi.on("session_start", (event, ctx) => {
		const branch = ctx.sessionManager.getBranch();
		toolPolicyRestartRequired =
			event.reason === "reload" &&
			toolPolicyReloadRequiresRestart({
				entries: branch,
				protocol: TOOL_POLICY_PROTOCOL,
				protocolTools: PROTOCOL_TOOLS,
			});
		reconstruct(ctx);
		if (toolPolicyRestartRequired) {
			ctx.ui.notify(TOOL_POLICY_RESTART_MESSAGE, "error");
			return;
		}
		const startEnabled = pi.getFlag("developer");
		if (startEnabled === true && !developerEnabled) setEnabled(true, ctx);
	});
	pi.on("session_tree", (_event, ctx) => reconstruct(ctx));
	pi.on("agent_settled", (_event, ctx) => refreshUI(ctx));
	pi.on("session_shutdown", (_event, ctx) => {
		releaseProtocolTools();
		if (!toolPolicyRestartRequired) {
			pi.appendEntry(
				TOOL_POLICY_LIFECYCLE_ENTRY,
				reloadSafeToolPolicyMarker(TOOL_POLICY_PROTOCOL),
			);
		}
		ctx.ui.setStatus("developer", undefined);
		ctx.ui.setWidget("developer", undefined);
	});
}
