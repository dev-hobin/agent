import { randomUUID } from "node:crypto";
import { join } from "node:path";

import {
	getAgentDir,
	type ExtensionAPI,
	type ExtensionContext,
	type Theme,
} from "@earendil-works/pi-coding-agent";
import { Container, Text, type Component } from "@earendil-works/pi-tui";
import type { Static } from "typebox";
import { Value } from "typebox/value";
import {
	completeObserverArgs,
	createObserverController,
	type ObserverCommandPort,
	type ObserverControllerIds,
} from "../src/observer-controller.ts";
import {
	createObservationController,
	type MemoRequestControllerResult,
	type MaterialReviewCancelControllerResult,
	type MaterialReviewRetryControllerResult,
	type ObservationCommandPort,
	type ObservationControllerIds,
	type ObservationControllerResult,
	type TrackUserHypothesisResult,
	type SaveRequestControllerResult,
} from "../src/observation-controller.ts";
import { sha256Text } from "../src/content-hash.ts";
import type { PreparedObservationMemoInstruction } from "../src/memo-instruction.ts";
import { encodePreparedMemoPass } from "../src/memo-profile.ts";
import { reconstructObservationSession } from "../src/observation-session.ts";
import type { ObservationMemoRequestedEvent } from "../src/observation-profile.ts";
import { observerSidecarContext } from "../src/observer-prompt.ts";
import {
	reconstructObserverPiState,
	type PiBranchEntryLike,
	type PreparedSaveHandoff,
} from "../src/pi-session.ts";
import { parseObserverCommand } from "../src/observer-command.ts";
import type { ObserverStatusView } from "../src/observer-status.ts";
import { renderSaveProposalReview } from "../src/save-review.ts";
import { fileNotebookSelectionStore } from "../src/notebook-selection-store.ts";
import {
	notebookPathKindLabel,
	resolveNotebookPath,
} from "../src/notebook-path.ts";
import {
	DEFAULT_OBSERVER_PROCESSING_POLICY,
	fileObserverProcessingPolicyStore,
	isLocalObserverModel,
	modelsInObserverSessionScope,
	observerLocalModelRef,
	processingPolicy,
	type ObserverModelIdentity,
	type ObserverProcessingPolicy,
	type ObserverProcessingPolicyStore,
} from "../src/observer-processing-policy.ts";
import {
	reconstructSaveRequestSession,
	type SaveRequestEvent,
} from "../src/save-trigger.ts";
import {
	createObserverBackgroundQueue,
	type ObserverBackgroundQueue,
} from "../src/observer-background-queue.ts";
import { observerWorkerMaterial } from "../src/observer-worker-material.ts";
import {
	observerCommitActionSchema,
	observerRequestSidecarParameters,
	observerRoutineSidecarParameters,
	observerRuntimeSidecarParameters,
} from "./memo-tool-schema.ts";
import {
	runObserverAgentBackgroundJob,
	type ObserverAgentBackgroundJob,
	type ObserverBackgroundToolResult,
} from "./observer-background.ts";
import {
	acceptScriptedMaterialInput,
	activeMaterialReviewCaptureRequestId,
	activeMaterialReviewRequestId,
	beginObserverAgentRun,
	clearToolResultNominations,
	consumeToolResultNominations,
	endObserverAgentRun,
	observerTurnContext,
	resolveToolResultNomination,
	routeMaterialReviewTool,
	settleObserverAgentRun,
	stageMaterialReviewRetry,
	stageNominatableToolResult,
	suspendMaterialReviewRun,
	type ObserverMaterialReviewIds,
	type ObserverTurnState,
} from "./material-review-runtime.ts";
import {
	OBSERVER_HYPOTHESIS_DRAFT,
	OBSERVER_OBSERVE_MATERIAL_DRAFT,
	type ObserverControlAction,
	ObserverWidget,
	renderObserverChromeStatus,
	shouldShowObserverWidget,
	showObserverControl,
	showObserverStatus,
} from "./tui.ts";
import {
	showObserverWorkbench,
	type ObserverWorkbenchAction,
} from "./observer-workbench-tui.ts";
import { showSaveProposalReview } from "./save-proposal-tui.ts";

const OBSERVER_STATUS_KEY = "observer";
const OBSERVER_TOOL_NAME = "observer_sidecar";

export { observerSidecarParameters } from "./memo-tool-schema.ts";

function systemIds(): ObserverControllerIds {
	return {
		episodeId() {
			return `episode-${randomUUID()}`;
		},
		attemptId() {
			return `attempt-${randomUUID()}`;
		},
		receiptId(): `receipt-${string}` {
			return `receipt-${randomUUID()}`;
		},
		memoRevisionId() {
			return `memo-working-revision-${randomUUID()}`;
		},
		memoReceiptId(): `memo-receipt-${string}` {
			return `memo-receipt-${randomUUID()}`;
		},
	};
}

function systemMaterialReviewIds(): ObserverMaterialReviewIds {
	return {
		requestId(): `material-review-${string}` {
			return `material-review-${randomUUID()}`;
		},
	};
}

function systemObservationIds(): ObservationControllerIds {
	return {
		candidateId(): `candidate-${string}` {
			return `candidate-${randomUUID()}`;
		},
		sourceReadId(): `source-read-${string}` {
			return `source-read-${randomUUID()}`;
		},
		hydrationId(): `hydration-${string}` {
			return `hydration-${randomUUID()}`;
		},
		observationId(): `observation-${string}` {
			return `observation-${randomUUID()}`;
		},
		sourceId(): `source-${string}` {
			return `source-${randomUUID()}`;
		},
		inquiryId(): `inquiry-${string}` {
			return `inquiry-${randomUUID()}`;
		},
		memoRequestId(): `memo-request-${string}` {
			return `memo-request-${randomUUID()}`;
		},
		saveRequestId(): `save-request-${string}` {
			return `save-request-${randomUUID()}`;
		},
		saveProposalId(): `proposal-${string}` {
			return `proposal-${randomUUID()}`;
		},
	};
}

function commandPort(
	pi: ExtensionAPI,
	ctx: ExtensionContext,
): ObserverCommandPort {
	const sessionManager = ctx.sessionManager;
	const ui = ctx.ui;
	return {
		cwd: ctx.cwd,
		branchEntries: sessionManager.getBranch.bind(sessionManager),
		sessionFile: sessionManager.getSessionFile.bind(sessionManager),
		appendEntry: pi.appendEntry.bind(pi),
		input: ui.input.bind(ui),
		select: ui.select.bind(ui),
		async reviewSaveProposal(review) {
			if (ctx.mode === "tui") return showSaveProposalReview(ctx, review);
			const choice = await ui.select(renderSaveProposalReview(review), [
				"Go back · keep proposal ready",
				"Return to Review · discard proposal",
				`Save all ${review.records.length} records`,
			]);
			if (choice?.startsWith("Save all")) return "approve";
			if (choice?.startsWith("Return to Review")) return "reject";
			return "back";
		},
		notify: ui.notify.bind(ui),
		setStatus(text) {
			ui.setStatus(OBSERVER_STATUS_KEY, text);
		},
	};
}

function backgroundCommandPort(
	port: ObserverCommandPort,
	signal: AbortSignal,
	mode: "routine" | "requests",
): {
	readonly port: ObserverCommandPort;
	flush(success: boolean): void;
} {
	const pending: Array<{
		readonly message: string;
		readonly type?: "info" | "warning" | "error";
	}> = [];
	return {
		port: {
			...port,
			appendEntry(customType, data) {
				if (signal.aborted) {
					throw new Error(
						"Observer background commit was cancelled by foreground activity.",
					);
				}
				port.appendEntry(customType, data);
			},
			notify(message, type) {
				if (signal.aborted) return;
				if (mode === "routine") pending.push({ message, type });
				else port.notify(message, type);
			},
		},
		flush(success) {
			if (!success || signal.aborted) return;
			for (const notification of pending) {
				port.notify(notification.message, notification.type);
			}
		},
	};
}

function backgroundTurnState(turnState: ObserverTurnState): ObserverTurnState {
	return {
		toolUsed: false,
		latestUser: null,
		scriptedMaterialRequest: null,
		blockedRequestId: null,
		backgroundIssue: null,
		agentRunSequence: turnState.agentRunSequence,
		activeAgentRunId: turnState.activeAgentRunId ?? turnState.agentRunSequence,
		materialReviewRun: null,
		nominatableToolResults: new Map(turnState.nominatableToolResults),
		stagedMaterialReviewRetry: null,
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function createObserverAgentBackgroundJob(input: {
	readonly id: string;
	readonly mode: "routine" | "requests";
	readonly model: NonNullable<ExtensionContext["model"]>;
	readonly ctx: ExtensionContext;
	readonly pi: ExtensionAPI;
	readonly controller: ReturnType<typeof createObserverController>;
	readonly observation: ReturnType<typeof createObservationController>;
	readonly materialReviewIds: ObserverMaterialReviewIds;
	readonly turnState: ObserverTurnState;
	readonly refresh: () => Promise<void>;
}): ObserverAgentBackgroundJob {
	const port = commandPort(input.pi, input.ctx);
	const nominationEntries = [...input.ctx.sessionManager.getBranch()];
	const workerState = backgroundTurnState(input.turnState);
	return {
		id: input.id,
		mode: input.mode,
		cwd: input.ctx.cwd,
		model: input.model,
		parameters:
			input.mode === "routine"
				? observerRoutineSidecarParameters
				: observerRequestSidecarParameters,
		material() {
			const entries = port.branchEntries();
			const nominations = [...workerState.nominatableToolResults.values()];
			const guidance = observerSidecarContext(entries, nominations, {
				includeRoutine: input.mode === "routine",
				includeRequests: input.mode === "requests",
			});
			if (!guidance) return null;
			const workerGuidance = guidance.replaceAll(
				"observer_sidecar",
				"observer_background_sidecar",
			);
			const material =
				input.mode === "routine"
					? observerWorkerMaterial({
							entries,
							nominatableToolResults: nominations,
						})
					: { text: "", images: [] };
			return {
				text: [workerGuidance, material.text].filter(Boolean).join("\n\n"),
				images: material.images,
			};
		},
		async execute(value, signal) {
			if (!isRecord(value)) {
				return {
					content: [
						{
							type: "text",
							text: "Observer background action must be an object.",
						},
					],
					details: {
						ok: false,
						message: "Observer background action must be an object.",
					},
					terminate: true,
				};
			}
			const command = backgroundCommandPort(port, signal, input.mode);
			const result = await executeObserverSidecarAction({
				params: value,
				port: command.port,
				nominationEntries,
				controller: input.controller,
				observation: input.observation,
				materialReviewIds: input.materialReviewIds,
				turnState: workerState,
				background: true,
				allowForegroundRoutine: false,
			});
			const succeeded =
				!isRecord(result.details) ||
				Reflect.get(result.details, "ok") !== false;
			command.flush(succeeded);
			return result;
		},
		refresh: input.refresh,
		notifyDeferred() {
			input.ctx.ui.notify(
				"Observer could not complete the requested background work. Open /observer → Status and health to inspect or retry.",
				"warning",
			);
		},
	};
}

function observerToolErrorSummary(value: unknown): string {
	const text = textFromContent(value)
		.replaceAll(/\s+/gu, " ")
		.replaceAll(/[\u0000-\u001f\u007f-\u009f]/gu, "")
		.trim();
	return text.length > 240 ? `${text.slice(0, 239)}…` : text;
}

export function observerSidecarCallComponent(): Component {
	return new Container();
}

export function observerSidecarResultComponent(
	input: {
		readonly action: unknown;
		readonly content: unknown;
		readonly isError: boolean;
	},
	theme: Theme,
): Component {
	if (!input.isError) return new Container();
	const action =
		typeof input.action === "string" && /^[a-z][a-z-]*$/u.test(input.action)
			? input.action
			: "operation";
	const summary = observerToolErrorSummary(input.content);
	return new Text(
		[
			theme.fg("error", `! Observer ${action} failed`),
			...(summary ? [theme.fg("dim", `  ${summary}`)] : []),
			theme.fg("dim", "  Open /observer status for recovery."),
		].join("\n"),
		0,
		0,
	);
}

export function textFromContent(value: unknown): string {
	if (typeof value === "string") return value.trim();
	if (!Array.isArray(value)) return "";
	return value
		.flatMap((item) => {
			if (
				typeof item === "object" &&
				item !== null &&
				Reflect.get(item, "type") === "text" &&
				typeof Reflect.get(item, "text") === "string"
			) {
				return [Reflect.get(item, "text")];
			}
			return [];
		})
		.join("\n")
		.trim();
}

function assertNever(value: never): never {
	throw new Error(`Unhandled Observer result: ${String(value)}`);
}

export function observationToolText(
	result: ObservationControllerResult,
): string {
	if (!result.ok) {
		return JSON.stringify({ ok: false, message: result.message });
	}
	switch (result.action) {
		case "source-read":
			return JSON.stringify({
				ok: true,
				message: result.message,
				read_id: result.read.readId,
				standing_index: result.index,
			});
		case "hydrate":
			return JSON.stringify({
				ok: true,
				message: result.message,
				hydration_id: result.hydration.hydrationId,
				standing_context: result.context,
			});
		case "record":
			return JSON.stringify({
				ok: true,
				message: result.message,
				observation_id: result.observation.observationId,
				visibility: result.observation.visibility,
			});
		case "user-hypothesis":
			return JSON.stringify({
				ok: true,
				message: result.message,
				observation_id: result.hypothesis.observationId,
				inquiry_id: result.hypothesis.inquiryId,
			});
		case "hypothesis-context-review":
			return JSON.stringify({
				ok: true,
				message: result.message,
				hypothesis_observation_id: result.review.hypothesisObservationId,
				assessment: result.review.assessment,
			});
		case "memo-scope":
			return JSON.stringify({
				ok: true,
				message: result.message,
				request_id: result.context.request.requestId,
				request_digest: result.context.request.requestDigest,
				observations: result.context.observations,
				memo_scope: result.context.memoScope,
				memo_preparation: result.guide,
			});
		case "save-scope":
			return JSON.stringify({
				ok: true,
				message: result.message,
				next_action: {
					action: "save-prepare",
					request_id: result.context.request.requestId,
					submit_only: ["request_id", "summary", "records"],
					do_not_repeat: "save-scope",
				},
				request_id: result.context.request.requestId,
				request_digest: result.context.request.requestDigest,
				save_preparation: result.guide,
			});
		case "save-prepare":
			return JSON.stringify({
				ok: true,
				message: result.message,
				proposal_id: result.handoff.prepared.proposal_id,
			});
		case "memo-prepare":
			return JSON.stringify({
				ok: true,
				message: result.message,
				request_id: result.instruction.requestId,
				instruction_digest: result.instruction.digest,
				status: result.status,
			});
		default:
			return assertNever(result);
	}
}

function reportCaptureFailure(
	result: ReturnType<ReturnType<typeof createObservationController>["capture"]>,
	ctx: ExtensionContext,
): void {
	if (!result.ok) ctx.ui.notify(result.message, "error");
}

export type MemoPreparationCompletion =
	| {
			readonly ok: true;
			readonly status: "completed" | "recovery-required";
			readonly message: string;
	  }
	| { readonly ok: false; readonly message: string };

export interface MemoPreparationEffects {
	install(value: unknown): Promise<boolean>;
	apply(): Promise<void>;
	completed(requestId: string): boolean;
}

export async function completeMemoPreparation(
	instruction: PreparedObservationMemoInstruction,
	effects: MemoPreparationEffects,
): Promise<MemoPreparationCompletion> {
	try {
		const installed = await effects.install(
			encodePreparedMemoPass(instruction.pass),
		);
		if (!installed) {
			return {
				ok: false,
				message:
					"Memo instruction은 기록됐지만 prepared pass 설치에 실패했습니다.",
			};
		}
		await effects.apply();
		return effects.completed(instruction.requestId)
			? {
					ok: true,
					status: "completed",
					message: "Memo request를 적용하고 acknowledgment까지 확인했습니다.",
				}
			: {
					ok: true,
					status: "recovery-required",
					message:
						"Memo 적용이 완료되지 않았습니다. Observer를 열어 상태를 확인하고 다시 시도할 수 있습니다.",
				};
	} catch (error) {
		return {
			ok: true,
			status: "recovery-required",
			message: `Memo 적용 중단: ${error instanceof Error ? error.message : String(error)}. Observer를 열어 상태를 확인할 수 있습니다.`,
		};
	}
}

export type SavePreparationCompletion =
	| {
			readonly ok: true;
			readonly status: "prepared" | "recovery-required";
			readonly proposalId: string;
			readonly message: string;
	  }
	| { readonly ok: false; readonly message: string };

export interface SavePreparationEffects {
	install(value: PreparedSaveHandoff): Promise<boolean>;
}

export async function completeSavePreparation(
	handoff: PreparedSaveHandoff,
	effects: SavePreparationEffects,
): Promise<SavePreparationCompletion> {
	const proposalId = handoff.prepared.proposal_id;
	try {
		const installed = await effects.install(handoff);
		if (!installed)
			return {
				ok: false,
				message: "Could not install the prepared save proposal.",
			};
		return {
			ok: true,
			status: "prepared",
			proposalId,
			message:
				"Review is complete. Open the Observer workbench (/observer) and choose Review prepared proposal. Nothing is written until you approve it.",
		};
	} catch (error) {
		return {
			ok: true,
			status: "recovery-required",
			proposalId,
			message: `Review preparation was interrupted: ${error instanceof Error ? error.message : String(error)}. Open Observer to inspect and retry.`,
		};
	}
}

export function requireSavePreparationSuccess(
	completion: SavePreparationCompletion,
): Exclude<SavePreparationCompletion, { readonly ok: false }> {
	if (!completion.ok) throw new Error(completion.message);
	return completion;
}

type SuccessfulObservationControllerResult = Exclude<
	ObservationControllerResult,
	{ readonly ok: false }
>;

export function requireObservationToolSuccess(
	result: ObservationControllerResult,
): SuccessfulObservationControllerResult {
	if (!result.ok) throw new Error(result.message);
	return result;
}

export function requireMemoPreparationSuccess(
	completion: MemoPreparationCompletion,
): Exclude<MemoPreparationCompletion, { readonly ok: false }> {
	if (!completion.ok) throw new Error(completion.message);
	return completion;
}

export interface MemoCommandEffects {
	request(): MemoRequestControllerResult;
	delegate(): Promise<void>;
	trigger(request: ObservationMemoRequestedEvent): void;
	notify(message: string, type: "info" | "warning" | "error"): void;
}

export interface AddHypothesisCommandEffects {
	add(input: {
		readonly original: string;
		readonly userContext: string | null;
	}): Promise<TrackUserHypothesisResult>;
	triggerReview(
		result: Extract<TrackUserHypothesisResult, { readonly ok: true }>,
	): void;
	notify(message: string, type: "info" | "warning" | "error"): void;
}

function hypothesisDraft(body: string): {
	readonly original: string;
	readonly userContext: string | null;
} | null {
	const contextMarker = /\nContext(?: \(optional\))?:\s*/iu.exec(body);
	const hypothesisPart = contextMarker
		? body.slice(0, contextMarker.index)
		: body;
	const original = hypothesisPart.replace(/^Hypothesis:\s*/iu, "").trim();
	if (!original) return null;
	const userContext = contextMarker
		? body.slice((contextMarker.index ?? 0) + contextMarker[0].length).trim()
		: "";
	return { original, userContext: userContext || null };
}

export async function routeAddHypothesisCommand(
	args: string,
	effects: AddHypothesisCommandEffects,
): Promise<boolean> {
	const normalized = args.trim();
	const boundary = normalized.search(/\s/u);
	const action = boundary === -1 ? normalized : normalized.slice(0, boundary);
	if (action !== "add-hypothesis") return false;
	const draft = hypothesisDraft(
		boundary === -1 ? "" : normalized.slice(boundary).trim(),
	);
	if (!draft) {
		effects.notify(
			"Add the hypothesis after the command: /observer add-hypothesis <text>",
			"warning",
		);
		return true;
	}
	const result = await effects.add(draft);
	if (!result.ok) effects.notify(result.message, "error");
	else {
		if (result.status === "resumed")
			effects.notify("This hypothesis is already being tracked.", "info");
		try {
			if (result.reviewPending) effects.triggerReview(result);
		} catch (error) {
			effects.notify(
				`The hypothesis is preserved, but its context review could not start: ${error instanceof Error ? error.message : String(error)}`,
				"warning",
			);
		}
	}
	return true;
}

export interface MaterialCommandEffects {
	submit(materialRequest: string): void;
	retry(): MaterialReviewRetryControllerResult;
	cancel(): MaterialReviewCancelControllerResult;
	triggerRetry(
		request: Extract<
			MaterialReviewRetryControllerResult,
			{ readonly ok: true }
		>["request"],
	): void;
	notify(message: string, type: "info" | "warning" | "error"): void;
}

export function routeMaterialCommand(
	args: string,
	effects: MaterialCommandEffects,
): boolean {
	const normalized = args.trim();
	const boundary = normalized.search(/\s/u);
	const action = boundary === -1 ? normalized : normalized.slice(0, boundary);
	if (action !== "material") return false;
	const materialRequest =
		boundary === -1 ? "" : normalized.slice(boundary).trim();
	if (!materialRequest) {
		effects.notify(
			"Add material or a retrieval request after the command: /observer material <request>",
			"warning",
		);
		return true;
	}
	if (materialRequest === "retry") {
		const retried = effects.retry();
		if (!retried.ok) {
			effects.notify(retried.message, "warning");
			return true;
		}
		try {
			effects.triggerRetry(retried.request);
			effects.notify(
				`Material review retry started for ${retried.request.requestId}.`,
				"info",
			);
		} catch (error) {
			effects.notify(
				`Material review retry could not start: ${error instanceof Error ? error.message : String(error)}`,
				"error",
			);
		}
		return true;
	}
	if (materialRequest === "cancel") {
		const cancelled = effects.cancel();
		effects.notify(
			cancelled.ok
				? `Material review cancelled: ${cancelled.cancellation.requestId}`
				: cancelled.message,
			cancelled.ok ? "info" : "warning",
		);
		return true;
	}
	try {
		effects.submit(materialRequest);
	} catch (error) {
		effects.notify(
			`Observe material could not start: ${error instanceof Error ? error.message : String(error)}`,
			"error",
		);
	}
	return true;
}

export interface ReviewCommandEffects {
	request(): Promise<SaveRequestControllerResult>;
	delegateSave(): Promise<void>;
	delegateMemo(): Promise<void>;
	triggerSave(request: SaveRequestEvent): void;
	triggerMemo(request: ObservationMemoRequestedEvent): void;
	notify(message: string, type: "info" | "warning" | "error"): void;
}

export async function routeReviewCommand(
	args: string,
	effects: ReviewCommandEffects,
): Promise<boolean> {
	const parsed = parseObserverCommand(args);
	if (!parsed.ok || parsed.command.kind !== "review") return false;
	let requested = await effects.request();
	if (!requested.ok) {
		effects.notify(requested.message, "error");
		return true;
	}
	if (requested.status === "memo-delegate") {
		await effects.delegateMemo();
		requested = await effects.request();
		if (!requested.ok) {
			effects.notify(requested.message, "error");
			return true;
		}
	}
	if (requested.status === "delegate") {
		await effects.delegateSave();
		return true;
	}
	if (
		requested.status === "memo-requested" ||
		requested.status === "memo-resumed"
	) {
		try {
			effects.triggerMemo(requested.memoRequest);
			effects.notify(requested.message, "info");
		} catch (error) {
			effects.notify(
				`The final Review Memo request was preserved, but Observer processing could not start: ${error instanceof Error ? error.message : String(error)}`,
				"warning",
			);
		}
		return true;
	}
	if (requested.status === "memo-delegate" || !requested.request) {
		effects.notify(
			"Could not complete the final Memo reconciliation.",
			"error",
		);
		return true;
	}
	try {
		effects.triggerSave(requested.request);
		effects.notify(requested.message, "info");
	} catch (error) {
		effects.notify(
			`The Review request was preserved, but Observer processing could not start: ${error instanceof Error ? error.message : String(error)}`,
			"warning",
		);
	}
	return true;
}

export async function routeMemoCommand(
	args: string,
	effects: MemoCommandEffects,
): Promise<boolean> {
	const parsed = parseObserverCommand(args);
	if (!parsed.ok || parsed.command.kind !== "memo") return false;
	const requested = effects.request();
	if (!requested.ok) {
		effects.notify(requested.message, "error");
		return true;
	}
	if (requested.status === "delegate" || requested.status === "none") {
		await effects.delegate();
		return true;
	}
	if (!requested.request) {
		effects.notify("Memo request identity를 확인할 수 없습니다.", "error");
		return true;
	}
	try {
		effects.trigger(requested.request);
		effects.notify(requested.message, "info");
	} catch (error) {
		effects.notify(
			`Memo request는 보존됐지만 Observer 처리를 시작하지 못했습니다: ${error instanceof Error ? error.message : String(error)}`,
			"warning",
		);
	}
	return true;
}

type ObserverAgentBackgroundQueue =
	ObserverBackgroundQueue<ObserverAgentBackgroundJob>;

interface ObserverProcessingRuntime {
	policy: ObserverProcessingPolicy;
	issue: string | null;
}

interface ObserverCommandInput {
	readonly args: string;
	readonly ctx: ExtensionContext;
	readonly pi: ExtensionAPI;
	readonly controller: ReturnType<typeof createObserverController>;
	readonly observation: ReturnType<typeof createObservationController>;
	readonly materialReviewIds: ObserverMaterialReviewIds;
	readonly turnState: ObserverTurnState;
	readonly background: ObserverAgentBackgroundQueue;
	readonly processing: ObserverProcessingRuntime;
	readonly processingStore: ObserverProcessingPolicyStore;
}

function sessionScopedModels(
	ctx: ExtensionContext,
): readonly ObserverModelIdentity[] | undefined {
	const scoped = Reflect.get(ctx, "scopedModels");
	if (!Array.isArray(scoped)) return undefined;
	return scoped.map((entry) =>
		Reflect.get(entry as object, "model"),
	) as ObserverModelIdentity[];
}

function sessionAvailableModels(ctx: ExtensionContext) {
	return modelsInObserverSessionScope(
		ctx.modelRegistry.getAvailable(),
		sessionScopedModels(ctx),
	);
}

function localProcessingModel(
	processing: ObserverProcessingRuntime,
	ctx: ExtensionContext,
) {
	const selected = processing.policy.local_model;
	if (!selected) return undefined;
	const model = sessionAvailableModels(ctx).find(
		(candidate) =>
			candidate.provider === selected.provider &&
			candidate.id === selected.model_id,
	);
	return model && isLocalObserverModel(model) ? model : undefined;
}

function processingModeNotification(
	mode: "off" | "piggyback" | "local",
): string {
	switch (mode) {
		case "piggyback":
			return "Observer processing: Piggyback. No separate model request is started.";
		case "local":
			return "Observer processing: Local background. Only the selected loopback model may run.";
		case "off":
			return "Observer model processing is Off; local candidate staging remains available.";
	}
}

async function updateProcessingMode(
	input: ObserverCommandInput,
	mode: "off" | "piggyback" | "local",
): Promise<boolean> {
	let next: ObserverProcessingPolicy;
	if (mode === "local") {
		await input.ctx.modelRegistry.refresh();
		const models = sessionAvailableModels(input.ctx).filter(isLocalObserverModel);
		if (models.length === 0) {
			input.ctx.ui.notify(
				"No loopback Pi model is available. Configure llama.cpp, Ollama, LM Studio, or vLLM first; the current processing selection is unchanged.",
				"warning",
			);
			return false;
		}
		const labels = models.map(
			(model) => `${model.provider}/${model.id} · ${model.name}`,
		);
		const choice = await input.ctx.ui.select(
			"Local background model · only loopback endpoints are eligible",
			["Go back · keep current processing", ...labels],
		);
		const index = choice ? labels.indexOf(choice) : -1;
		const model = index >= 0 ? models[index] : undefined;
		if (!model) return false;
		next = processingPolicy("local", observerLocalModelRef(model));
	} else {
		next = processingPolicy(mode);
	}
	await input.processingStore.save(next);
	input.processing.policy = next;
	input.processing.issue = null;
	input.turnState.backgroundIssue = null;
	input.background.reset();
	if (mode === "local") input.background.resume();
	else input.background.pause();
	input.ctx.ui.notify(processingModeNotification(mode), "info");
	return true;
}

function enqueueObserverRequest(
	input: ObserverCommandInput,
	jobId: string,
): boolean {
	if (input.processing.policy.mode === "off") return false;
	input.turnState.blockedRequestId = null;
	input.turnState.backgroundIssue = null;
	if (input.processing.policy.mode === "piggyback") {
		input.pi.sendMessage(
			{
				customType: "observer.piggyback-request",
				content: [
					"Complete the exact pending Observer request in this user-requested foreground turn.",
					"Use the locally precomputed current-branch scope from hidden Observer context.",
					"Make at most one Observer sidecar call and make it the final tool call; it terminates without a follow-up model request.",
				].join("\n"),
				display: false,
				details: { jobId },
			},
			{ deliverAs: "followUp", triggerTurn: true },
		);
		return true;
	}
	const model = localProcessingModel(input.processing, input.ctx);
	if (!model) return false;
	const job = createObserverAgentBackgroundJob({
		id: `request-${jobId}`,
		mode: "requests",
		model,
		ctx: input.ctx,
		pi: input.pi,
		controller: input.controller,
		observation: input.observation,
		materialReviewIds: input.materialReviewIds,
		turnState: input.turnState,
		refresh() {
			return refreshObserverChrome(input);
		},
	});
	input.background.enqueue(job);
	input.background.resume();
	return true;
}

export type ObserverCommandPresentation = "control" | "status" | "command";

export function observerCommandPresentation(
	args: string,
	mode: ExtensionContext["mode"],
): ObserverCommandPresentation {
	if (mode !== "tui") return "command";
	const normalized = args.trim();
	if (!normalized || normalized === "settings") return "control";
	if (normalized === "status") return "status";
	return "command";
}

function processingStatus(policy: ObserverProcessingPolicy): {
	readonly mode: ObserverStatusView["processingMode"];
	readonly detail: string;
} {
	switch (policy.mode) {
		case "off":
			return { mode: "Off", detail: "No model-backed interpretation" };
		case "piggyback":
			return { mode: "Piggyback", detail: "No additional model request" };
		case "local":
			return {
				mode: "Local background",
				detail: policy.local_model
					? `${policy.local_model.provider}/${policy.local_model.model_id} · loopback only`
					: "Local model not configured",
			};
	}
}

function withTurnState(
	view: ObserverStatusView,
	turnState: ObserverTurnState | undefined,
	background?: ObserverAgentBackgroundQueue,
	processing?: ObserverProcessingRuntime,
): ObserverStatusView {
	const activeRequestId = turnState
		? activeMaterialReviewRequestId(turnState)
		: null;
	let pendingMaterialReview = view.pendingMaterialReview;
	if (pendingMaterialReview) {
		const runState =
			activeRequestId === pendingMaterialReview.requestId
				? ("Active in current agent run" as const)
				: ("Suspended" as const);
		pendingMaterialReview = { ...pendingMaterialReview, runState };
	}
	const backgroundSnapshot = background?.snapshot();
	let backgroundWork: ObserverStatusView["backgroundWork"];
	if (backgroundSnapshot?.activeJobId) {
		backgroundWork = {
			state: "Running",
			queued: backgroundSnapshot.queued,
		};
	} else if (backgroundSnapshot && backgroundSnapshot.queued > 0) {
		backgroundWork = {
			state: "Queued",
			queued: backgroundSnapshot.queued,
		};
	} else if (turnState?.backgroundIssue) {
		backgroundWork = { state: "Deferred", queued: 0 };
	}
	const automaticProcessingPause = turnState?.blockedRequestId
		? `Request ${turnState.blockedRequestId} failed. Open Observer to retry.`
		: undefined;
	const policy = processing?.policy ?? DEFAULT_OBSERVER_PROCESSING_POLICY;
	const processingView = processingStatus(policy);
	return {
		...view,
		processingMode: processingView.mode,
		processingDetail: processingView.detail,
		...(processing?.issue ? { processingIssue: processing.issue } : {}),
		...(pendingMaterialReview ? { pendingMaterialReview } : {}),
		...(backgroundWork ? { backgroundWork } : {}),
		...(turnState?.backgroundIssue
			? { backgroundIssue: turnState.backgroundIssue }
			: {}),
		...(automaticProcessingPause ? { automaticProcessingPause } : {}),
	};
}

async function refreshObserverChrome(input: {
	readonly ctx: ExtensionContext;
	readonly pi: ExtensionAPI;
	readonly controller: ReturnType<typeof createObserverController>;
	readonly turnState?: ObserverTurnState;
	readonly background?: ObserverAgentBackgroundQueue;
	readonly processing?: ObserverProcessingRuntime;
}): Promise<void> {
	const port = commandPort(input.pi, input.ctx);
	if (input.ctx.mode !== "tui") {
		await input.controller.refresh(port);
		return;
	}
	const view = withTurnState(
		await input.controller.inspect(port),
		input.turnState,
		input.background,
		input.processing,
	);
	input.ctx.ui.setStatus(
		OBSERVER_STATUS_KEY,
		renderObserverChromeStatus(view, input.ctx.ui.theme),
	);
	input.ctx.ui.setWidget(
		OBSERVER_STATUS_KEY,
		shouldShowObserverWidget(view)
			? (_tui, theme) => new ObserverWidget(view, theme)
			: undefined,
		{ placement: "belowEditor" },
	);
}

async function routeProcessingCommand(
	input: ObserverCommandInput,
): Promise<boolean> {
	const normalized = input.args.trim().replaceAll(/\s+/gu, " ");
	if (normalized === "processing") {
		input.ctx.ui.notify(
			`Observer model processing: ${input.processing.policy.mode}. Piggyback starts no separate model request; Local background uses only a selected loopback model.`,
			"info",
		);
		return true;
	}
	if (!normalized.startsWith("processing ")) return false;
	const value = normalized.slice("processing ".length);
	if (value !== "off" && value !== "piggyback" && value !== "local") {
		input.ctx.ui.notify(
			"Usage: /observer processing <off|piggyback|local>",
			"warning",
		);
		return true;
	}
	await updateProcessingMode(input, value);
	return true;
}

async function runObserverCommand(input: ObserverCommandInput): Promise<void> {
	const port = commandPort(input.pi, input.ctx);
	if (await routeProcessingCommand(input)) {
		await refreshObserverChrome(input);
		return;
	}
	const hypothesisHandled = await routeAddHypothesisCommand(input.args, {
		async add(draft) {
			const episode = await input.controller.ensureUserHypothesisEpisode(port);
			if (!episode.ok) return episode;
			return input.observation.trackUserHypothesis(
				{
					episode: episode.value,
					original: draft.original,
					context:
						draft.userContext ?? "No user-provided context was supplied.",
					capturedAt: new Date().toISOString(),
					inputSource: input.ctx.mode === "rpc" ? "rpc" : "interactive",
				},
				port,
			);
		},
		triggerReview(result) {
			if (!enqueueObserverRequest(input, result.hypothesis.observationId)) {
				throw new Error(
					"Observer model processing is Off or the selected local model is unavailable.",
				);
			}
		},
		notify: input.ctx.ui.notify.bind(input.ctx.ui),
	});
	if (hypothesisHandled) {
		await refreshObserverChrome(input);
		return;
	}
	const materialHandled = routeMaterialCommand(input.args, {
		retry() {
			return input.observation.retryMaterialReview(port);
		},
		cancel() {
			const result = input.observation.cancelMaterialReview(port);
			if (result.ok) {
				suspendMaterialReviewRun(input.turnState);
				input.turnState.stagedMaterialReviewRetry = null;
			}
			return result;
		},
		triggerRetry(request) {
			stageMaterialReviewRetry(input.turnState, request);
			try {
				input.pi.sendMessage(
					{
						customType: "observer.material-retry",
						content: [
							"Retry the exact pending Observer material-review request in this agent run.",
							`request_id=${request.requestId}`,
							`material=${request.material}`,
							request.material === "retrieved-tool-results"
								? "Its retrieval capture window is open only for this agent run. Retrieve the requested source, then complete source-read, optional hydrate, record, and material-review-finish."
								: "Use the existing inline candidate to complete source-read, optional hydrate, record, and material-review-finish.",
						].join("\n"),
						display: false,
						details: { requestId: request.requestId },
					},
					{ deliverAs: "followUp", triggerTurn: true },
				);
			} catch (error) {
				input.turnState.stagedMaterialReviewRetry = null;
				throw error;
			}
		},
		submit(materialRequest) {
			input.pi.sendMessage(
				{
					customType: "observer.material-command",
					content: [
						"The next user message is an explicit Observe material request.",
						"Observe material is independent of continuous Observer Mode; do not change Mode.",
						"Classify the exact latest user message and call observer_sidecar with action material-review-start.",
						"Use inline-user-message only when that exact text is evidence; use retrieved-tool-results when paths, URLs, or tools must provide the evidence.",
					].join("\n"),
					display: false,
					details: { command: "material" },
				},
				{ triggerTurn: false },
			);
			input.turnState.scriptedMaterialRequest = materialRequest;
			try {
				input.pi.sendUserMessage(materialRequest);
			} catch (error) {
				input.turnState.scriptedMaterialRequest = null;
				throw error;
			}
		},
		notify: input.ctx.ui.notify.bind(input.ctx.ui),
	});
	if (materialHandled) {
		await refreshObserverChrome(input);
		return;
	}
	const memoHandled = await routeMemoCommand(input.args, {
		request() {
			input.turnState.blockedRequestId = null;
			return input.observation.requestMemo(port);
		},
		delegate() {
			return input.controller.command(input.args, port);
		},
		trigger(request) {
			if (!enqueueObserverRequest(input, request.requestId)) {
				throw new Error(
					"Observer model processing is Off or the selected local model is unavailable.",
				);
			}
		},
		notify: input.ctx.ui.notify.bind(input.ctx.ui),
	});
	if (memoHandled) {
		await refreshObserverChrome(input);
		return;
	}
	const reviewHandled = await routeReviewCommand(input.args, {
		request() {
			input.turnState.blockedRequestId = null;
			return input.observation.requestReviewSave(port);
		},
		delegateSave() {
			return input.controller.command("save", port);
		},
		delegateMemo() {
			return input.controller.command("memo", port);
		},
		triggerMemo(request) {
			if (!enqueueObserverRequest(input, request.requestId)) {
				throw new Error(
					"Observer model processing is Off or the selected local model is unavailable.",
				);
			}
		},
		triggerSave(request) {
			if (!enqueueObserverRequest(input, request.requestId)) {
				throw new Error(
					"Observer model processing is Off or the selected local model is unavailable.",
				);
			}
		},
		notify: input.ctx.ui.notify.bind(input.ctx.ui),
	});
	if (!reviewHandled) await input.controller.command(input.args, port);
	await refreshObserverChrome(input);
}

async function setObserverDraft(
	ctx: ExtensionContext,
	input: {
		readonly label: string;
		readonly draft: string;
		readonly instruction: string;
	},
): Promise<boolean> {
	const current = ctx.ui.getEditorText();
	if (current.trim()) {
		const replacement = `Replace editor with ${input.label} draft`;
		const choice = await ctx.ui.select(
			"The editor already contains text. Choose whether to keep it or replace it.",
			["Keep current editor text", replacement],
		);
		if (choice !== replacement) return false;
	}
	ctx.ui.setEditorText(input.draft);
	ctx.ui.notify(input.instruction, "info");
	return true;
}

async function setupNotebookFromControl(
	input: ObserverCommandInput,
	port: ObserverCommandPort,
	language: "ko" | "en",
): Promise<boolean> {
	const root = await input.ctx.ui.input(
		"Observer Notebook path",
		`Absolute, ~/… from home, or relative to ${input.ctx.cwd}`,
	);
	if (root === undefined) return false;
	if (!root.trim()) {
		input.ctx.ui.notify("Enter a Notebook path.", "warning");
		return false;
	}
	const resolved = resolveNotebookPath(root, input.ctx.cwd);
	if (!resolved.ok) {
		input.ctx.ui.notify(resolved.message, "warning");
		return false;
	}
	const setup = `Set up ${resolved.path} · default output ${language}`;
	const choice = await input.ctx.ui.select(
		[
			"Review Observer Notebook setup",
			`Input kind: ${notebookPathKindLabel(resolved.kind)}`,
			`Resolved path: ${resolved.path}`,
			`Default Memo/Zettel language: ${language}`,
			"A new Notebook is initialized; an existing folder is adopted without rewriting unrelated files.",
		].join("\n"),
		["Go back · make no changes", setup],
	);
	if (choice !== setup) return false;
	await input.controller.command(`setup ${language} ${resolved.path}`, port);
	const view = await input.controller.inspect(port);
	return view.control.notebook === "ready";
}

async function showObserverSettings(input: {
	readonly command: ObserverCommandInput;
	readonly port: ObserverCommandPort;
	readonly view: ObserverStatusView;
	readonly pendingLanguage: "ko" | "en";
}): Promise<{
	readonly action: ObserverControlAction | undefined;
	readonly pendingLanguage: "ko" | "en";
}> {
	let pendingLanguage = input.pendingLanguage;
	const action = await showObserverControl(
		input.command.ctx,
		input.view,
		pendingLanguage,
		{
			async applyActivation(enabled) {
				await input.command.controller.command(
					enabled ? "on" : "off",
					input.port,
				);
				await refreshObserverChrome(input.command);
				return withTurnState(
					await input.command.controller.inspect(input.port),
					input.command.turnState,
					input.command.background,
					input.command.processing,
				);
			},
			async applyLanguage(language) {
				const current = withTurnState(
					await input.command.controller.inspect(input.port),
					input.command.turnState,
					input.command.background,
					input.command.processing,
				);
				let applied = true;
				if (current.control.notebook === "ready") {
					applied = await input.command.controller.updateDefaultLanguage(
						language,
						input.port,
					);
				}
				if (applied) pendingLanguage = language;
				await refreshObserverChrome(input.command);
				return withTurnState(
					await input.command.controller.inspect(input.port),
					input.command.turnState,
					input.command.background,
					input.command.processing,
				);
			},
			onError(error) {
				input.command.ctx.ui.notify(
					`Observer setting failed: ${error instanceof Error ? error.message : String(error)}`,
					"error",
				);
			},
		},
	);
	return { action, pendingLanguage };
}

async function showObserverControlFlow(
	input: ObserverCommandInput,
	startInSettings = false,
): Promise<void> {
	const port = commandPort(input.pi, input.ctx);
	let pendingLanguage: "ko" | "en" = "en";
	let openSettings = startInSettings;
	while (true) {
		let view: ObserverStatusView;
		let workbenchAction: ObserverWorkbenchAction | undefined;
		if (openSettings) {
			openSettings = false;
			view = withTurnState(
				await input.controller.inspect(port),
				input.turnState,
				input.background,
				input.processing,
			);
			workbenchAction = { kind: "settings" };
		} else {
			const projected = await input.controller.inspectWorkbench(port);
			view = withTurnState(
				projected.status,
				input.turnState,
				input.background,
				input.processing,
			);
			workbenchAction = await showObserverWorkbench(input.ctx, {
				...projected,
				status: view,
			});
			if (!workbenchAction) return;
		}
		if (view.control.notebookDefaultLanguage)
			pendingLanguage = view.control.notebookDefaultLanguage;
		let action: ObserverControlAction | undefined;
		if (workbenchAction.kind === "settings") {
			const settings = await showObserverSettings({
				command: input,
				port,
				view,
				pendingLanguage,
			});
			pendingLanguage = settings.pendingLanguage;
			action = settings.action;
		} else action = workbenchAction;
		if (!action) continue;
		switch (action.kind) {
			case "activation": {
				if (action.enabled && view.control.notebook !== "ready") {
					if (await setupNotebookFromControl(input, port, pendingLanguage))
						await input.controller.command("on", port);
				} else {
					await input.controller.command(action.enabled ? "on" : "off", port);
				}
				await refreshObserverChrome(input);
				break;
			}
			case "setup": {
				await setupNotebookFromControl(input, port, pendingLanguage);
				await refreshObserverChrome(input);
				break;
			}
			case "language": {
				pendingLanguage = action.language;
				if (view.control.notebook === "ready")
					await input.controller.updateDefaultLanguage(action.language, port);
				await refreshObserverChrome(input);
				break;
			}
			case "processing":
				await updateProcessingMode(input, action.mode);
				await refreshObserverChrome(input);
				break;
			case "status":
				await showObserverStatus(
					input.ctx,
					withTurnState(
						await input.controller.inspect(port),
						input.turnState,
						input.background,
						input.processing,
					),
				);
				break;
			case "memo":
				await runObserverCommand({ ...input, args: "memo" });
				return;
			case "review":
				await runObserverCommand({ ...input, args: "review" });
				return;
			case "save":
				await runObserverCommand({ ...input, args: "save" });
				return;
			case "add-hypothesis":
				if (
					await setObserverDraft(input.ctx, {
						label: "hypothesis",
						draft: OBSERVER_HYPOTHESIS_DRAFT,
						instruction:
							"Write the hypothesis after the command. Optionally add `Context:` on a new line, then send it.",
					})
				)
					return;
				break;
			case "observe-material":
				if (
					await setObserverDraft(input.ctx, {
						label: "material observation",
						draft: OBSERVER_OBSERVE_MATERIAL_DRAFT,
						instruction:
							"Paste the material or question below the draft, then send it.",
					})
				)
					return;
				break;
			case "retry-material":
				await runObserverCommand({ ...input, args: "material retry" });
				return;
			case "cancel-material": {
				const cancel = "Cancel pending material review";
				const choice = await input.ctx.ui.select(
					[
						"Cancel the pending material review?",
						"Observer Mode and the open Episode are preserved.",
						"Request-linked candidates that were not completed will not be reused.",
					].join("\n"),
					["Go back · keep pending request", cancel],
				);
				if (choice === cancel) {
					await runObserverCommand({ ...input, args: "material cancel" });
					return;
				}
				break;
			}
			default:
				assertNever(action);
		}
	}
}

async function handleObserverCommand(
	input: ObserverCommandInput,
): Promise<void> {
	const presentation = observerCommandPresentation(input.args, input.ctx.mode);
	if (presentation === "control") {
		await showObserverControlFlow(input, input.args.trim() === "settings");
		return;
	}
	if (presentation === "status") {
		const view = withTurnState(
			await input.controller.inspect(commandPort(input.pi, input.ctx)),
			input.turnState,
			input.background,
			input.processing,
		);
		await refreshObserverChrome(input);
		await showObserverStatus(input.ctx, view);
		return;
	}
	await runObserverCommand(input);
}

function memoPreparationCompleted(
	entries: Parameters<typeof reconstructObservationSession>[0],
	requestId: string,
): boolean {
	const snapshot = reconstructObservationSession(entries);
	const request = snapshot.memoRequests.find(
		(item) => item.requestId === requestId,
	);
	return (
		snapshot.issues.length === 0 &&
		request !== undefined &&
		request.observationIds.every((id) =>
			snapshot.consumedObservationIds.includes(id),
		)
	);
}

function executeToolResultNomination(input: {
	readonly selections: unknown;
	readonly entries: readonly PiBranchEntryLike[];
	readonly turnState: ObserverTurnState;
	readonly observation: ReturnType<typeof createObservationController>;
	readonly port: ObservationCommandPort;
}): {
	content: { type: "text"; text: string }[];
	details: unknown;
} {
	const resolution = resolveToolResultNomination({
		turnState: input.turnState,
		selections: input.selections,
		entries: input.entries,
	});
	if (!resolution.ok) throw new Error(resolution.message);
	const nominations = [];
	for (const result of resolution.results) {
		const captured = input.observation.capture(
			{
				origin: {
					kind: "tool-result",
					tool_call_id: result.toolCallId,
					tool_name: result.toolName,
				},
				text: result.text,
				capturedAt: result.capturedAt,
				nominationReason: result.reason,
			},
			input.port,
		);
		if (!captured.ok) throw new Error(captured.message);
		if (captured.status === "ignored") {
			throw new Error(
				`Tool result ${result.toolCallId} is no longer eligible for Observer capture.`,
			);
		}
		nominations.push({
			tool_call_id: result.toolCallId,
			candidate_ids: captured.candidates.map(
				(candidate) => candidate.candidateId,
			),
		});
	}
	consumeToolResultNominations(
		input.turnState,
		resolution.results.map((result) => result.toolCallId),
	);
	const payload = {
		action: "nominate-tool-results" as const,
		nominations,
		next: "Call source-read only for the returned candidate_ids after faithfully reconstructing their source meaning.",
	};
	return {
		content: [{ type: "text", text: JSON.stringify(payload) }],
		details: payload,
	};
}

type ObserverCommitAction = Static<typeof observerCommitActionSchema>;

function observerBranchFingerprint(
	entries: readonly PiBranchEntryLike[],
): string {
	return sha256Text(
		JSON.stringify(
			entries.filter(
				(entry) =>
					typeof entry.customType === "string" &&
					entry.customType.startsWith("observer."),
			),
		),
	);
}

export function stagedObserverCommandPort(port: ObserverCommandPort): {
	readonly port: ObserverCommandPort;
	commit():
		| { readonly ok: true }
		| { readonly ok: false; readonly message: string };
} {
	const baseEntries = [...port.branchEntries()];
	const baseFingerprint = observerBranchFingerprint(baseEntries);
	const stagedEntries: Array<{
		readonly customType: string;
		readonly data: unknown;
	}> = [];
	const notifications: Array<{
		readonly message: string;
		readonly type?: "info" | "warning" | "error";
	}> = [];
	let status: string | undefined;
	return {
		port: {
			...port,
			branchEntries() {
				return [
					...baseEntries,
					...stagedEntries.map((entry) => ({
						type: "custom" as const,
						customType: entry.customType,
						data: entry.data,
					})),
				];
			},
			appendEntry(customType, data) {
				stagedEntries.push({ customType, data });
			},
			notify(message, type) {
				notifications.push({ message, type });
			},
			setStatus(text) {
				status = text;
			},
		},
		commit() {
			if (observerBranchFingerprint(port.branchEntries()) !== baseFingerprint) {
				return {
					ok: false,
					message:
						"Observer branch changed while the Piggyback proposal was being validated.",
				};
			}
			for (const entry of stagedEntries) {
				port.appendEntry(entry.customType, entry.data);
			}
			for (const notification of notifications) {
				port.notify(notification.message, notification.type);
			}
			if (status !== undefined) port.setStatus(status);
			return { ok: true };
		},
	};
}

function commitFailure(message: string): ObserverBackgroundToolResult {
	return {
		content: [
			{
				type: "text",
				text: JSON.stringify({
					ok: false,
					message,
					retry: false,
					next: "Keep the work pending for a later ordinary user turn.",
				}),
			},
		],
		details: { ok: false, message },
		terminate: true,
	};
}

function observerRequestResultIssue(value: unknown): string | null {
	if (!isRecord(value)) return null;
	if (Reflect.get(value, "ok") === false) {
		const message = Reflect.get(value, "message");
		return typeof message === "string" ? message : "Observer request failed.";
	}
	const completion = Reflect.get(value, "completion");
	if (
		isRecord(completion) &&
		Reflect.get(completion, "status") === "recovery-required"
	) {
		const message = Reflect.get(completion, "message");
		return typeof message === "string"
			? message
			: "Observer request requires recovery.";
	}
	return null;
}

function nominatedCandidateIds(value: unknown): Map<string, readonly string[]> {
	const result = new Map<string, readonly string[]>();
	if (!isRecord(value)) return result;
	const nominations = Reflect.get(value, "nominations");
	if (!Array.isArray(nominations)) return result;
	for (const nomination of nominations) {
		if (!isRecord(nomination)) continue;
		const toolCallId = Reflect.get(nomination, "tool_call_id");
		const candidateIds = Reflect.get(nomination, "candidate_ids");
		if (
			typeof toolCallId === "string" &&
			Array.isArray(candidateIds) &&
			candidateIds.every((candidateId) => typeof candidateId === "string")
		) {
			result.set(toolCallId, candidateIds);
		}
	}
	return result;
}

export async function executeObserverCommit(input: {
	readonly params: unknown;
	readonly port: ObserverCommandPort;
	readonly nominationEntries: readonly PiBranchEntryLike[];
	readonly controller: ReturnType<typeof createObserverController>;
	readonly observation: ReturnType<typeof createObservationController>;
	readonly materialReviewIds: ObserverMaterialReviewIds;
	readonly turnState: ObserverTurnState;
}): Promise<ObserverBackgroundToolResult> {
	if (!Value.Check(observerCommitActionSchema, input.params)) {
		return commitFailure("Observer Piggyback proposal has an invalid shape.");
	}
	const action = input.params as ObserverCommitAction;
	if (
		action.observations.length === 0 &&
		action.hypothesis_context_reviews.length === 0 &&
		!action.memo &&
		!action.save
	) {
		return commitFailure("Observer Piggyback proposal contains no work.");
	}
	if (action.memo && action.save) {
		return commitFailure(
			"Memo and Save preparation cannot share one Piggyback commit because Save scope depends on the completed Memo.",
		);
	}
	const initial = reconstructObserverPiState(input.port.branchEntries());
	if (
		initial.issues.length > 0 ||
		initial.state.episode.status !== "open" ||
		initial.state.episode.core.episodeId !== action.episode_id
	) {
		return commitFailure(
			"Observer Piggyback proposal is stale for the current Episode.",
		);
	}
	const staged = stagedObserverCommandPort(input.port);
	try {
		const selections = action.observations.flatMap(
			(observation) => observation.nominations,
		);
		if (
			new Set(selections.map((selection) => selection.tool_call_id)).size !==
			selections.length
		) {
			return commitFailure(
				"A tool result may appear only once in one Observer Piggyback commit.",
			);
		}
		let nominated = new Map<string, readonly string[]>();
		if (selections.length > 0) {
			const result = executeToolResultNomination({
				selections,
				entries: input.nominationEntries,
				turnState: input.turnState,
				observation: input.observation,
				port: staged.port,
			});
			nominated = nominatedCandidateIds(result.details);
		}
		const observationIds: string[] = [];
		const usedCandidateIds = new Set<string>();
		for (const proposal of action.observations) {
			const candidateIds = [
				...proposal.candidate_ids,
				...proposal.nominations.flatMap(
					(nomination) => nominated.get(nomination.tool_call_id) ?? [],
				),
			];
			if (
				candidateIds.length === 0 ||
				new Set(candidateIds).size !== candidateIds.length ||
				candidateIds.some((candidateId) => usedCandidateIds.has(candidateId))
			) {
				return commitFailure(
					"Each Piggyback observation needs a nonempty, disjoint candidate set.",
				);
			}
			for (const candidateId of candidateIds) usedCandidateIds.add(candidateId);
			const read = await input.observation.execute(
				{
					observer_action: "observer-sidecar/v1",
					action: "source-read",
					candidate_ids: candidateIds,
					source: proposal.source,
					faithful_summary: proposal.faithful_summary,
					claims: proposal.claims,
				},
				staged.port,
			);
			if (!read.ok || read.action !== "source-read") {
				return commitFailure(read.message);
			}
			let hydrationId: string | null = null;
			if (proposal.related_inquiry_ids.length > 0) {
				const hydration = await input.observation.execute(
					{
						observer_action: "observer-sidecar/v1",
						action: "hydrate",
						read_id: read.read.readId,
						index_digest: read.index.digest,
						inquiry_ids: proposal.related_inquiry_ids,
					},
					staged.port,
				);
				if (!hydration.ok || hydration.action !== "hydrate") {
					return commitFailure(hydration.message);
				}
				hydrationId = hydration.hydration.hydrationId;
			}
			const recordValue =
				proposal.record.kind === "observation"
					? {
							observer_action: "observer-sidecar/v1",
							action: "record",
							read_id: read.read.readId,
							hydration_id: hydrationId,
							related_inquiry_ids: proposal.related_inquiry_ids,
							stance: proposal.stance,
							movement: proposal.record.movement,
							rationale: proposal.record.rationale,
							observer_hypothesis: null,
						}
					: {
							observer_action: "observer-sidecar/v1",
							action: "record-new-hypothesis",
							read_id: read.read.readId,
							hydration_id: hydrationId,
							related_inquiry_ids: proposal.related_inquiry_ids,
							stance: proposal.stance,
							rationale: proposal.record.rationale,
							observer_hypothesis: proposal.record.observer_hypothesis,
						};
			const recorded = await input.observation.execute(
				recordValue,
				staged.port,
			);
			if (!recorded.ok || recorded.action !== "record") {
				return commitFailure(recorded.message);
			}
			observationIds.push(recorded.observation.observationId);
		}
		for (const review of action.hypothesis_context_reviews) {
			const reviewed = await input.observation.execute(
				{
					observer_action: "observer-sidecar/v1",
					action: "hypothesis-context-review",
					...review,
				},
				staged.port,
			);
			if (!reviewed.ok || reviewed.action !== "hypothesis-context-review") {
				return commitFailure(reviewed.message);
			}
		}
		let requestResult: ObserverBackgroundToolResult | null = null;
		if (action.memo) {
			requestResult = await executeObserverSidecarAction({
				params: {
					observer_action: "observer-sidecar/v1",
					action: "memo-prepare",
					request_id: action.memo.request_id,
					submission: action.memo.submission,
				},
				port: staged.port,
				nominationEntries: input.nominationEntries,
				controller: input.controller,
				observation: input.observation,
				materialReviewIds: input.materialReviewIds,
				turnState: input.turnState,
				background: false,
				allowForegroundRoutine: true,
			});
		}
		if (action.save) {
			requestResult = await executeObserverSidecarAction({
				params: {
					observer_action: "observer-sidecar/v1",
					action: "save-prepare",
					request_id: action.save.request_id,
					summary: action.save.summary,
					records: action.save.records,
				},
				port: staged.port,
				nominationEntries: input.nominationEntries,
				controller: input.controller,
				observation: input.observation,
				materialReviewIds: input.materialReviewIds,
				turnState: input.turnState,
				background: false,
				allowForegroundRoutine: true,
			});
		}
		const requestIssue = requestResult
			? observerRequestResultIssue(requestResult.details)
			: null;
		if (requestIssue) return commitFailure(requestIssue);
		const committed = staged.commit();
		if (!committed.ok) return commitFailure(committed.message);
		return {
			content: [
				{
					type: "text",
					text: JSON.stringify({
						ok: true,
						action: "observer-commit",
						observation_ids: observationIds,
						hypothesis_reviews: action.hypothesis_context_reviews.length,
						memo_prepared: Boolean(action.memo),
						save_prepared: Boolean(action.save),
					}),
				},
			],
			details: {
				ok: true,
				action: "observer-commit",
				observationIds,
			},
			terminate: true,
		};
	} catch (error) {
		return commitFailure(
			error instanceof Error ? error.message : String(error),
		);
	}
}

async function executeObserverSidecarAction(input: {
	readonly params: Readonly<Record<string, unknown>>;
	readonly port: ObserverCommandPort;
	readonly nominationEntries: readonly PiBranchEntryLike[];
	readonly controller: ReturnType<typeof createObserverController>;
	readonly observation: ReturnType<typeof createObservationController>;
	readonly materialReviewIds: ObserverMaterialReviewIds;
	readonly turnState: ObserverTurnState;
	readonly background: boolean;
	readonly allowForegroundRoutine?: boolean;
}): Promise<ObserverBackgroundToolResult> {
	const materialReview = await routeMaterialReviewTool({
		value: input.params,
		capturedAt: new Date().toISOString(),
		port: input.port,
		lifecycle: input.controller,
		observation: input.observation,
		ids: input.materialReviewIds,
		turnState: input.turnState,
	});
	if (materialReview) {
		return {
			content: [{ type: "text", text: materialReview.text }],
			details: materialReview.result,
		};
	}
	if (
		!input.background &&
		!input.allowForegroundRoutine &&
		!activeMaterialReviewRequestId(input.turnState)
	) {
		return {
			content: [
				{
					type: "text",
					text: "Foreground Observer action is not authorized by the current processing policy.",
				},
			],
			details: { ok: false, message: "Observer action not authorized." },
			terminate: true,
		};
	}
	if (input.params.action === "nominate-tool-results") {
		return executeToolResultNomination({
			selections: input.params.selections,
			entries: input.nominationEntries,
			turnState: input.turnState,
			observation: input.observation,
			port: input.port,
		});
	}
	const executionResult = await input.observation.execute(
		input.params,
		input.port,
	);
	if (!executionResult.ok) {
		const requestId = input.params.request_id;
		const requestAction =
			input.params.action === "memo-scope" ||
			input.params.action === "memo-prepare" ||
			input.params.action === "save-scope" ||
			input.params.action === "save-prepare";
		if (!requestAction || typeof requestId !== "string") {
			if (!input.background && !input.allowForegroundRoutine) {
				return {
					content: [{ type: "text", text: executionResult.message }],
					details: executionResult,
					terminate: true,
				};
			}
			return {
				content: [
					{
						type: "text",
						text: JSON.stringify({
							ok: false,
							message: executionResult.message,
							retry: false,
							next: input.background
								? "Defer Observer and stop this local background run."
								: "Defer Observer until a later ordinary user turn.",
						}),
					},
				],
				details: executionResult,
				terminate: true,
			};
		}
		input.turnState.blockedRequestId = requestId;
		const failure = {
			ok: false,
			message: executionResult.message,
			retry: false,
			automatic_observer_request_paused: true,
			next: input.background
				? "Stop this background run. The request remains recoverable."
				: "Continue the user's requested task. Open Observer to inspect and retry when convenient.",
		};
		return {
			content: [{ type: "text", text: JSON.stringify(failure) }],
			details: executionResult,
			...(input.background ? { terminate: true } : {}),
		};
	}
	input.turnState.blockedRequestId = null;
	const result = executionResult;
	if (result.action === "save-prepare") {
		const completion = requireSavePreparationSuccess(
			await completeSavePreparation(result.handoff, {
				install(value) {
					return input.controller.installPrepared(value, input.port);
				},
			}),
		);
		return {
			content: [{ type: "text", text: JSON.stringify(completion) }],
			details: { preparation: result, completion },
		};
	}
	if (result.action === "memo-prepare") {
		const completion = requireMemoPreparationSuccess(
			await completeMemoPreparation(result.instruction, {
				install(value) {
					return input.controller.installPreparedMemo(value, input.port);
				},
				apply() {
					return input.controller.command("memo", input.port);
				},
				completed(requestId) {
					return memoPreparationCompleted(
						input.port.branchEntries(),
						requestId,
					);
				},
			}),
		);
		const continuation =
			completion.status === "completed"
				? await input.observation.continueReviewSaveAfterMemo(
						result.instruction.requestId,
						input.port,
					)
				: null;
		let next:
			| { readonly action: "save-scope"; readonly request_id: string }
			| { readonly action: "review-existing-save" }
			| null = null;
		if (continuation?.ok && continuation.request) {
			next = {
				action: "save-scope",
				request_id: continuation.request.requestId,
			};
		} else if (continuation?.ok && continuation.status === "delegate") {
			next = { action: "review-existing-save" };
		}
		const payload = {
			completion,
			...(continuation ? { continuation } : {}),
			...(next ? { next_action: next } : {}),
		};
		return {
			content: [{ type: "text", text: JSON.stringify(payload) }],
			details: { preparation: result, ...payload },
		};
	}
	return {
		content: [{ type: "text", text: observationToolText(result) }],
		details: result,
	};
}

function registerObserverSidecarTool(input: {
	readonly pi: ExtensionAPI;
	readonly controller: ReturnType<typeof createObserverController>;
	readonly observation: ReturnType<typeof createObservationController>;
	readonly materialReviewIds: ObserverMaterialReviewIds;
	readonly turnState: ObserverTurnState;
	readonly processing: ObserverProcessingRuntime;
}): void {
	input.pi.registerTool({
		name: OBSERVER_TOOL_NAME,
		label: "Observer Sidecar",
		description:
			"Execute the exact hidden Observer material-review or Piggyback action. Under Piggyback, finish the user's task first and call this at most once as the final tool; the result terminates without another model request.",
		promptSnippet:
			"Use only for exact hidden Observer guidance. Piggyback actions are final, single, non-retrying tool calls; material review follows its exact active request.",
		parameters: observerRuntimeSidecarParameters,
		executionMode: "sequential",
		renderShell: "self",
		renderCall() {
			return observerSidecarCallComponent();
		},
		renderResult(result, _options, theme, context) {
			return observerSidecarResultComponent(
				{
					action: Reflect.get(context.args, "action"),
					content: result.content,
					isError: context.isError,
				},
				theme,
			);
		},
		async execute(...execution) {
			const [, params, , , ctx] = execution;
			input.turnState.toolUsed = true;
			const port = commandPort(input.pi, ctx);
			const action = Reflect.get(params, "action");
			if (action === "observer-commit") {
				if (input.processing.policy.mode !== "piggyback") {
					return commitFailure(
						"observer-commit is available only under the Piggyback processing policy.",
					);
				}
				return executeObserverCommit({
					params,
					port,
					nominationEntries: ctx.sessionManager.getBranch(),
					controller: input.controller,
					observation: input.observation,
					materialReviewIds: input.materialReviewIds,
					turnState: input.turnState,
				});
			}
			const materialAction =
				action === "material-review-start" ||
				action === "material-review-finish" ||
				Boolean(activeMaterialReviewRequestId(input.turnState));
			const piggyback =
				!materialAction && input.processing.policy.mode === "piggyback";
			const result = await executeObserverSidecarAction({
				params,
				port,
				nominationEntries: ctx.sessionManager.getBranch(),
				controller: input.controller,
				observation: input.observation,
				materialReviewIds: input.materialReviewIds,
				turnState: input.turnState,
				background: false,
				allowForegroundRoutine: piggyback,
			});
			return piggyback ? { ...result, terminate: true } : result;
		},
	});
}

export function captureOrStageToolResult(input: {
	readonly toolCallId: string;
	readonly toolName: string;
	readonly text: string;
	readonly isError: boolean;
	readonly toolInput?: Readonly<Record<string, unknown>>;
	readonly toolContent?: readonly unknown[];
	readonly capturedAt: string;
	readonly entries: readonly PiBranchEntryLike[];
	readonly port: ObservationCommandPort;
	readonly observation: ReturnType<typeof createObservationController>;
	readonly turnState: ObserverTurnState;
}) {
	const materialReviewRequestId = activeMaterialReviewCaptureRequestId(
		input.turnState,
	);
	if (materialReviewRequestId) {
		if (input.isError) return null;
		return input.observation.capture(
			{
				origin: {
					kind: "tool-result",
					tool_call_id: input.toolCallId,
					tool_name: input.toolName,
				},
				text: input.text,
				capturedAt: input.capturedAt,
				materialReviewRequestId,
			},
			input.port,
		);
	}
	const session = reconstructObservationSession(input.entries);
	if (
		session.issues.length > 0 ||
		session.lifecycle.mode !== "on" ||
		session.lifecycle.episode.status !== "open"
	)
		return null;
	stageNominatableToolResult({
		turnState: input.turnState,
		result: {
			toolCallId: input.toolCallId,
			toolName: input.toolName,
			isError: input.isError,
			capturedAt: input.capturedAt,
			...(input.toolInput ? { input: input.toolInput } : {}),
			...(input.toolContent ? { content: input.toolContent } : {}),
		},
	});
	return null;
}

async function piggybackSidecarContext(input: {
	readonly ctx: ExtensionContext;
	readonly pi: ExtensionAPI;
	readonly observation: ReturnType<typeof createObservationController>;
	readonly turnState: ObserverTurnState;
}): Promise<string | null> {
	const entries = input.ctx.sessionManager.getBranch();
	const observationSession = reconstructObservationSession(entries);
	const saveSession = reconstructSaveRequestSession(entries);
	if (observationSession.issues.length > 0 || saveSession.issues.length > 0) {
		return null;
	}
	const port = commandPort(input.pi, input.ctx);
	let memoScope: string | null = null;
	if (observationSession.pendingMemoRequest) {
		const scoped = await input.observation.execute(
			{
				observer_action: "observer-sidecar/v1",
				action: "memo-scope",
				request_id: observationSession.pendingMemoRequest.requestId,
			},
			port,
		);
		if (scoped.ok && scoped.action === "memo-scope") {
			memoScope = observationToolText(scoped);
		}
	}
	let saveScope: string | null = null;
	if (saveSession.pendingRequest) {
		const scoped = await input.observation.execute(
			{
				observer_action: "observer-sidecar/v1",
				action: "save-scope",
				request_id: saveSession.pendingRequest.requestId,
			},
			port,
		);
		if (scoped.ok && scoped.action === "save-scope") {
			saveScope = observationToolText(scoped);
		}
	}
	const nominations = [...input.turnState.nominatableToolResults.values()];
	const options = {
		piggyback: true,
		memoScope,
		saveScope,
	} as const;
	const preliminary = observerSidecarContext(entries, nominations, options);
	if (!preliminary) return null;
	const standing = await input.observation.inspectStandingIndex(port);
	return standing.ok
		? observerSidecarContext(entries, nominations, {
				...options,
				standingIndex: JSON.stringify(standing.index),
			})
		: preliminary;
}

function registerObserverEvents(input: {
	readonly pi: ExtensionAPI;
	readonly controller: ReturnType<typeof createObserverController>;
	readonly observation: ReturnType<typeof createObservationController>;
	readonly materialReviewIds: ObserverMaterialReviewIds;
	readonly turnState: ObserverTurnState;
	readonly background: ObserverAgentBackgroundQueue;
	readonly processing: ObserverProcessingRuntime;
	readonly processingStore: ObserverProcessingPolicyStore;
}): void {
	input.pi.on("input", (event, ctx) => {
		input.background.pause();
		clearToolResultNominations(input.turnState);
		if (
			acceptScriptedMaterialInput({
				turnState: input.turnState,
				source: event.source,
				text: event.text,
				inputSource: ctx.mode === "rpc" ? "rpc" : "interactive",
			})
		)
			return;
		suspendMaterialReviewRun(input.turnState);
		input.turnState.stagedMaterialReviewRetry = null;
		if (
			event.source === "extension" ||
			event.text.trim().length === 0 ||
			event.text.trimStart().startsWith("/observer")
		) {
			input.turnState.scriptedMaterialRequest = null;
			input.turnState.latestUser = null;
			return;
		}
		input.turnState.latestUser = {
			text: event.text,
			inputSource: event.source,
		};
		reportCaptureFailure(
			input.observation.capture(
				{
					origin: { kind: "user-input", input_source: event.source },
					text: event.text,
					capturedAt: new Date().toISOString(),
				},
				commandPort(input.pi, ctx),
			),
			ctx,
		);
	});
	input.pi.on("tool_result", (event, ctx) => {
		if (event.toolName === OBSERVER_TOOL_NAME) return;
		const text = textFromContent(event.content);
		if (!text) return;
		const capture = captureOrStageToolResult({
			toolCallId: event.toolCallId,
			toolName: event.toolName,
			text,
			isError: event.isError,
			toolInput: event.input,
			toolContent: event.content,
			capturedAt: new Date().toISOString(),
			entries: ctx.sessionManager.getBranch(),
			port: commandPort(input.pi, ctx),
			observation: input.observation,
			turnState: input.turnState,
		});
		if (capture) reportCaptureFailure(capture, ctx);
	});
	input.pi.on("agent_start", () => {
		input.background.pause();
		beginObserverAgentRun(input.turnState);
	});
	input.pi.on("agent_end", (_event, ctx) => {
		const model = localProcessingModel(input.processing, ctx);
		if (
			input.processing.policy.mode === "local" &&
			model &&
			!activeMaterialReviewRequestId(input.turnState)
		) {
			const runId = input.turnState.activeAgentRunId;
			input.background.enqueue(
				createObserverAgentBackgroundJob({
					id: `routine-${runId ?? input.turnState.agentRunSequence}`,
					mode: "routine",
					model,
					ctx,
					pi: input.pi,
					controller: input.controller,
					observation: input.observation,
					materialReviewIds: input.materialReviewIds,
					turnState: input.turnState,
					refresh() {
						return refreshObserverChrome({ ...input, ctx });
					},
				}),
			);
		}
		endObserverAgentRun(input.turnState);
	});
	input.pi.on("agent_settled", async (_event, ctx) => {
		settleObserverAgentRun(input.turnState);
		if (input.processing.policy.mode === "local") input.background.resume();
		else input.background.pause();
		await refreshObserverChrome({ ...input, ctx });
	});
	input.pi.on("turn_start", () => {
		input.turnState.toolUsed = false;
	});
	input.pi.on("turn_end", (event, ctx) => {
		const toolUsed = input.turnState.toolUsed;
		input.turnState.latestUser = null;
		input.turnState.scriptedMaterialRequest = null;
		if (toolUsed) return;
		const text = textFromContent(Reflect.get(event.message, "content"));
		if (!text) return;
		reportCaptureFailure(
			input.observation.capture(
				{
					origin: {
						kind: "assistant-result",
						turn_index: event.turnIndex,
					},
					text,
					capturedAt: new Date().toISOString(),
				},
				commandPort(input.pi, ctx),
			),
			ctx,
		);
	});
	input.pi.on("context", async (event, ctx) => {
		const materialGuidance = observerTurnContext({
			turnState: input.turnState,
			entries: ctx.sessionManager.getBranch(),
		});
		const piggybackGuidance =
			input.processing.policy.mode === "piggyback"
				? await piggybackSidecarContext({
						ctx,
						pi: input.pi,
						observation: input.observation,
						turnState: input.turnState,
					})
				: null;
		const guidance = [materialGuidance, piggybackGuidance]
			.filter((value): value is string => Boolean(value))
			.join("\n\n");
		if (!guidance) return;
		return {
			messages: [
				...event.messages,
				{
					role: "custom",
					customType: "observer.sidecar-context",
					content: guidance,
					display: false,
					timestamp: Date.now(),
				},
			],
		};
	});
	input.pi.on("session_start", async (_event, ctx) => {
		input.background.reset();
		const loaded = await input.processingStore.load();
		input.processing.policy = loaded.policy;
		input.processing.issue = loaded.ok ? null : loaded.message;
		if (
			loaded.policy.mode === "local" &&
			!localProcessingModel(input.processing, ctx)
		) {
			input.processing.issue =
				"The selected local model is unavailable; no background inference was started.";
		}
		settleObserverAgentRun(input.turnState);
		await input.controller.bind(commandPort(input.pi, ctx));
		await refreshObserverChrome({ ...input, ctx });
	});
	input.pi.on("session_tree", async (_event, ctx) => {
		input.background.reset();
		settleObserverAgentRun(input.turnState);
		await input.controller.bind(commandPort(input.pi, ctx));
		await refreshObserverChrome({ ...input, ctx });
	});
	input.pi.on("session_compact", async (_event, ctx) => {
		input.background.reset();
		await refreshObserverChrome({ ...input, ctx });
	});
	input.pi.on("tool_execution_end", async (event, ctx) => {
		if (event.toolName === OBSERVER_TOOL_NAME)
			await refreshObserverChrome({ ...input, ctx });
	});
	input.pi.on("session_shutdown", (_event, ctx) => {
		input.background.dispose();
		settleObserverAgentRun(input.turnState);
		input.controller.unbind();
		ctx.ui.setStatus(OBSERVER_STATUS_KEY, undefined);
		ctx.ui.setWidget(OBSERVER_STATUS_KEY, undefined);
	});
}

export default function observerExtension(pi: ExtensionAPI): void {
	const selectionStore = fileNotebookSelectionStore(
		join(getAgentDir(), "observer", "selection.json"),
	);
	const controller = createObserverController({
		selectionStore,
		ids: systemIds(),
	});
	const observation = createObservationController({
		selectionStore,
		ids: systemObservationIds(),
	});
	const turnState: ObserverTurnState = {
		toolUsed: false,
		latestUser: null,
		scriptedMaterialRequest: null,
		blockedRequestId: null,
		backgroundIssue: null,
		agentRunSequence: 0,
		activeAgentRunId: null,
		materialReviewRun: null,
		nominatableToolResults: new Map(),
		stagedMaterialReviewRetry: null,
	};
	const materialReviewIds = systemMaterialReviewIds();
	const processingStore = fileObserverProcessingPolicyStore(
		join(getAgentDir(), "observer", "processing.json"),
	);
	const processing: ObserverProcessingRuntime = {
		policy: DEFAULT_OBSERVER_PROCESSING_POLICY,
		issue: null,
	};
	const background = createObserverBackgroundQueue<ObserverAgentBackgroundJob>({
		run: runObserverAgentBackgroundJob,
		async settled(job, result) {
			if (result.status === "deferred") {
				turnState.backgroundIssue = result.message.slice(0, 500);
			} else if (result.status === "completed") {
				turnState.backgroundIssue = null;
			}
			if (result.status === "deferred" && job.mode === "requests") {
				job.notifyDeferred();
			}
			try {
				await job.refresh();
			} catch {
				// The captured UI context may have been invalidated by session replacement.
			}
		},
	});

	registerObserverSidecarTool({
		pi,
		controller,
		observation,
		materialReviewIds,
		turnState,
		processing,
	});

	pi.registerCommand("observer", {
		description:
			"Open the Observer inquiry workbench or run an Observer action",
		getArgumentCompletions: completeObserverArgs,
		async handler(args, ctx) {
			try {
				await handleObserverCommand({
					args,
					ctx,
					pi,
					controller,
					observation,
					materialReviewIds,
					turnState,
					background,
					processing,
					processingStore,
				});
			} finally {
				if (processing.policy.mode === "local") background.resume();
				else background.pause();
				await refreshObserverChrome({
					ctx,
					pi,
					controller,
					turnState,
					background,
					processing,
				});
			}
		},
	});

	registerObserverEvents({
		pi,
		controller,
		observation,
		materialReviewIds,
		turnState,
		background,
		processing,
		processingStore,
	});
}
