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
import type { SdkControlledActionAdapter } from "../src/action-loop/sdk/action-controller.ts";
import {
	prepareLiveCapabilityInventory,
	type LiveCapabilityInventoryResult,
} from "./action-loop-capability-inventory.ts";
import {
	ACTION_LOOP_PROGRESS_ACTION_LOOP_TOOL,
	progressLiveActionLoopWithSdk,
	sdkActionLoopProgressionFailure,
	sdkActionLoopProgressionSummary,
} from "./action-loop-sdk-progression.ts";
import { createPiExtensionSdkRunner } from "./action-loop-sdk-runner.ts";
import {
	clearedLivePiToolNames,
	matchingLiveActionClearance,
} from "./action-loop-action.ts";
import {
	beginLiveActionEffect,
	observeLivePiToolResult,
} from "./action-loop-effect.ts";
import {
	liveCompletedWorkCasePrompt,
	prepareLiveWorkCaseClosure,
} from "./action-loop-completion.ts";
import {
	ACTION_LOOP_ACCEPT_HOST_CONTRIBUTION_TOOL,
	acceptLiveHostContribution,
} from "./action-loop-host-contribution.ts";
import {
	ACTION_LOOP_SESSION_ENTRY,
	ACTION_LOOP_SESSION_PROTOCOL,
	MAX_ACTION_LOOP_BLOCKER_DISPOSITIONS,
	actionLoopBlockedWorkCaseResumedEvent,
	actionLoopHostContributionAcceptedEvent,
	actionLoopEffectBegunEvent,
	actionLoopEffectObservedEvent,
	actionLoopPausedWorkCaseResumedEvent,
	actionLoopWorkCaseBlockedEvent,
	actionLoopWaitingWorkCaseResumedEvent,
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
import { bindPiControlledAction } from "./action-loop-pi-action.ts";
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
	MAX_LIVE_BASIS_ITEMS,
	isLiveBlockedWorkCaseState,
	isLivePausedWorkCaseState,
	isLiveWaitingWorkCaseState,
	liveWorkCasePrompt,
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
const PRIMARY_PROTOCOL_TOOLS = [
	ACTION_LOOP_PROGRESS_ACTION_LOOP_TOOL,
	ACTION_LOOP_ACCEPT_HOST_CONTRIBUTION_TOOL,
	ACTION_LOOP_PAUSE_WORK_CASE_TOOL,
	ACTION_LOOP_WAIT_WORK_CASE_TOOL,
	ACTION_LOOP_BLOCK_WORK_CASE_TOOL,
	ACTION_LOOP_RESUME_WORK_CASE_TOOL,
] as const;
const RETIRED_PROTOCOL_TOOLS = [
	"developer_open_work_case",
	"developer_open_judgment",
	"developer_progress_judgment_with_sdk",
	"developer_assess_capability",
	"developer_select_references",
	"developer_load_selected_reference",
	"developer_accept_contribution",
	"developer_assess_coverage",
	"developer_close_judgment",
	"developer_propose_action",
	"developer_settle_effect",
	"developer_record_effect_remediation",
	"developer_prepare_closure",
	"developer_complete_work_case",
] as const;
const PROTOCOL_TOOLS = [
	...PRIMARY_PROTOCOL_TOOLS,
	...RETIRED_PROTOCOL_TOOLS,
] as const;
const extensionRoot = dirname(fileURLToPath(import.meta.url));
const skillsRoot = resolve(extensionRoot, "..", "skills");
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
		"Developer Action Loop is active. Its canonical Work Case owns Outcome continuity through completion.",
		`Use ${ACTION_LOOP_PROGRESS_ACTION_LOOP_TOOL} for bounded progression and call it again after any exact cleared host Action returns. A bounded stop preserves acknowledged Pi branch checkpoints.`,
		`Evidence is not automatically truth. Use ${ACTION_LOOP_ACCEPT_HOST_CONTRIBUTION_TOOL} only for exact admitted host evidence that directly answers a current Need; adverse Effect remediation remains explicit.`,
		"The SDK controller owns opening, routing, sequential Judgment, Action proposal, Effect settlement, and revision-revalidated Completion. Do not reproduce these transitions with lower-level tools.",
		"Never infer permission, Effect success, or completion. Never expose internal IDs, revisions, hashes, fingerprints, or transition identities to the user.",
		`Pi-admitted Developer Skills: ${availableSkillNames.length > 0 ? availableSkillNames.join(", ") : "none"}. Never rediscover excluded Skills.`,
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
			case ACTION_LOOP_PROGRESS_ACTION_LOOP_TOOL:
				return { title: "Progress canonical work" };
			case ACTION_LOOP_ACCEPT_HOST_CONTRIBUTION_TOOL:
				return { title: "Use observed evidence" };
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
			protocolTools: PRIMARY_PROTOCOL_TOOLS,
			memory: toolPolicyMemory,
		});
		const nextActive = new Set(next.activeTools);
		for (const toolName of RETIRED_PROTOCOL_TOOLS) {
			nextActive.delete(toolName);
		}
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

	const piSdkControlledActions = (): readonly SdkControlledActionAdapter[] => {
		const descriptions = new Map(
			pi.getAllTools().map((tool) => [tool.name, tool.description]),
		);
		return (["bash", "edit", "write"] as const).map((name) => ({
			name,
			description:
				descriptions.get(name) ??
				`Execute one exact controlled Pi ${name} Action.`,
			bind(input: Readonly<Record<string, unknown>>) {
				const bound = bindPiControlledAction(name, input);
				if (bound.status === "invalid") return bound;
				return {
					status: "bound" as const,
					value: {
						controlledAction: bound.value,
						canonicalInput: bound.canonicalInput,
					},
				};
			},
		}));
	};

	registerActionLoopTool({
		name: ACTION_LOOP_PROGRESS_ACTION_LOOP_TOOL,
		label: "Developer Progress Action Loop",
		description:
			"Run the bounded SDK controller from missing Work Case ownership through Judgment, exact host Action Clearance, Effect settlement, and revision-revalidated Completion. Every accepted transition is durably checkpointed before dependent work.",
		promptSnippet: "Progress canonical work with the SDK controller",
		promptGuidelines: [
			`Use ${ACTION_LOOP_PROGRESS_ACTION_LOOP_TOOL} as the primary Developer entry point and call it again after the exact cleared host Action returns.`,
			"A bounded stop preserves acknowledged branch checkpoints. Do not replace replay-unavailable or held ownership, infer Effect success from a tool return, or bypass complete closure revalidation.",
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
					"SDK Action Loop progression requires a durable Pi session branch for accepted checkpoints.",
				);
			}
			if (pendingActionLoopBranch || actionLoopReplayFailure) {
				fail(
					pendingActionLoopBranch
						? "Developer must replay the current Pi session branch before SDK progression."
						: `Developer Action Loop session replay is unavailable: ${actionLoopReplayFailure}`,
				);
			}
			if (heldWorkCase) {
				fail(
					`Developer cannot progress while canonical work is ${heldWorkCase.workCase.status}.`,
				);
			}
			if (completedWorkCase) {
				fail("The current canonical Work Case is already completed.");
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
			const hadActiveWorkCase = activeWorkCase !== undefined;
			const progressed = await progressLiveActionLoopWithSdk({
				request: currentActionLoopRequest,
				...(activeWorkCase ? { state: activeWorkCase } : {}),
				inventory: liveCapabilityInventory.value,
				runner: prepared.runner,
				complete: true,
				actions: piSdkControlledActions(),
				authorizeAction(action) {
					return {
						actionCandidateId: action.candidate.actionCandidateId,
						status: "granted",
						source: "pi:default-permission-policy",
						basis: [
							"The Pi Extension host adapter inherits Pi's current default permission policy without accepting model-authored authority.",
						],
					};
				},
				maxSteps: 34,
				appendCheckpoint(event) {
					pi.appendEntry(ACTION_LOOP_SESSION_ENTRY, event);
				},
			});
			activeWorkCase = progressed.state;
			if (!hadActiveWorkCase && activeWorkCase) {
				bindPendingHostObservations(activeWorkCase.workCase.workCaseId);
			}
			pendingActionLoopBranch = undefined;
			completedWorkCase = progressed.completedWorkCase;
			syncProtocolTools();
			refreshUI(ctx);
			const result = progressed.result;
			const failure = sdkActionLoopProgressionFailure(result);
			if (failure) fail(failure);
			const pendingHostAction =
				result.status === "ready-for-host-action"
					? activeWorkCase?.piActionProposals.find(
							(proposal) =>
								proposal.actionCandidateId === result.actionCandidateId,
						)
					: undefined;
			const summary = pendingHostAction
				? `${sdkActionLoopProgressionSummary(result)} Execute ${pendingHostAction.toolName} with exactly this input: ${JSON.stringify(pendingHostAction.toolInput)}`
				: sdkActionLoopProgressionSummary(result);
			return textResult(summary, {
				protocol: "developer-action-loop/sdk-action-loop-progression/v1",
				kind: "sdk-action-loop-progression",
				status: result.status,
				steps: result.steps,
				checkpoints: result.checkpoints,
				...("stage" in result ? { stage: result.stage } : {}),
				...("reason" in result ? { reason: result.reason } : {}),
				...(result.status === "judgment-refused"
					? {
							blockerCodes: [
								...new Set(
									result.refusal.blockers.map((blocker) => blocker.code),
								),
							],
						}
					: {}),
				...(pendingHostAction
					? {
							hostAction: {
								toolName: pendingHostAction.toolName,
								toolInput: pendingHostAction.toolInput,
							},
						}
					: {}),
			});
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
		const inventoryPrompt =
			inventory.status === "ready"
				? `\nDeveloper Capability inventory: ${inventory.value.summary.bound} admitted by Pi.`
				: `\nDeveloper Capability inventory is unavailable (${inventory.error.code}).`;
		return {
			systemPrompt:
				event.systemPrompt +
				actionLoopProtocolPrompt([...availableSkills.keys()]) +
				inventoryPrompt +
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
