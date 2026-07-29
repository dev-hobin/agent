import { randomUUID } from "node:crypto";
import { join, resolve } from "node:path";

import {
	getAgentDir,
	type ExtensionAPI,
	type ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import {
	completeObserveArgs,
	createObserverController,
	type ObserverCommandPort,
	type ObserverControllerIds,
} from "../src/observer-controller.ts";
import {
	createObservationController,
	type MemoRequestControllerResult,
	type MaterialReviewCancelControllerResult,
	type MaterialReviewRetryControllerResult,
	type ObservationControllerIds,
	type ObservationControllerResult,
	type TrackUserHypothesisResult,
	type SaveRequestControllerResult,
} from "../src/observation-controller.ts";
import type { PreparedObservationMemoInstruction } from "../src/memo-instruction.ts";
import { encodePreparedMemoPass } from "../src/memo-profile.ts";
import { reconstructObservationSession } from "../src/observation-session.ts";
import type { ObservationMemoRequestedEvent } from "../src/observation-profile.ts";
import type { PreparedSaveHandoff } from "../src/pi-session.ts";
import { parseObserveCommand } from "../src/observer-command.ts";
import type { ObserverStatusView } from "../src/observer-status.ts";
import { renderSaveProposalReview } from "../src/save-review.ts";
import { fileNotebookSelectionStore } from "../src/notebook-selection-store.ts";
import type { SaveRequestEvent } from "../src/save-trigger.ts";
import { observerSidecarParameters } from "./memo-tool-schema.ts";
import {
	acceptScriptedMaterialInput,
	activeMaterialReviewCaptureRequestId,
	activeMaterialReviewRequestId,
	beginObserverAgentRun,
	endObserverAgentRun,
	observerTurnContext,
	routeMaterialReviewTool,
	settleObserverAgentRun,
	stageMaterialReviewRetry,
	suspendMaterialReviewRun,
	type ObserverMaterialReviewIds,
	type ObserverTurnState,
} from "./material-review-runtime.ts";
import {
	OBSERVER_HYPOTHESIS_DRAFT,
	OBSERVER_OBSERVE_MATERIAL_DRAFT,
	ObserverWidget,
	renderObserverChromeStatus,
	shouldShowObserverWidget,
	showObserverControl,
	showObserverStatus,
} from "./tui.ts";
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
						"Memo 적용이 완료되지 않았습니다. /observe memo로 복구할 수 있습니다.",
				};
	} catch (error) {
		return {
			ok: true,
			status: "recovery-required",
			message: `Memo 적용 중단: ${error instanceof Error ? error.message : String(error)}. /observe memo로 복구할 수 있습니다.`,
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
				"Review is complete. The proposal is ready; run /observe save to inspect and approve it.",
		};
	} catch (error) {
		return {
			ok: true,
			status: "recovery-required",
			proposalId,
			message: `Review preparation was interrupted: ${error instanceof Error ? error.message : String(error)}. Run /observe review to recover.`,
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
			"Add the hypothesis after the command: /observe add-hypothesis <text>",
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
			"Add material or a retrieval request after the command: /observe material <request>",
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
	const parsed = parseObserveCommand(args);
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
		effects.notify(
			`${requested.message} Run /observe save to inspect and approve it.`,
			"info",
		);
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
				`The final Review Memo request was recorded, but the agent trigger failed: ${error instanceof Error ? error.message : String(error)}`,
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
			`The Review request was recorded, but the agent trigger failed: ${error instanceof Error ? error.message : String(error)}`,
			"warning",
		);
	}
	return true;
}

export async function routeMemoCommand(
	args: string,
	effects: MemoCommandEffects,
): Promise<boolean> {
	const parsed = parseObserveCommand(args);
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
			`Memo request는 기록됐지만 agent trigger에 실패했습니다: ${error instanceof Error ? error.message : String(error)}`,
			"warning",
		);
	}
	return true;
}

interface ObserveCommandInput {
	readonly args: string;
	readonly ctx: ExtensionContext;
	readonly pi: ExtensionAPI;
	readonly controller: ReturnType<typeof createObserverController>;
	readonly observation: ReturnType<typeof createObservationController>;
	readonly turnState: ObserverTurnState;
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

function withTurnState(
	view: ObserverStatusView,
	turnState: ObserverTurnState | undefined,
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
	return {
		...view,
		...(pendingMaterialReview ? { pendingMaterialReview } : {}),
		...(turnState?.blockedRequestId
			? {
					automaticProcessingPause: `Request ${turnState.blockedRequestId} failed. Run Memo or Review explicitly to retry.`,
				}
			: {}),
	};
}

async function refreshObserverChrome(input: {
	readonly ctx: ExtensionContext;
	readonly pi: ExtensionAPI;
	readonly controller: ReturnType<typeof createObserverController>;
	readonly turnState?: ObserverTurnState;
}): Promise<void> {
	const port = commandPort(input.pi, input.ctx);
	if (input.ctx.mode !== "tui") {
		await input.controller.refresh(port);
		return;
	}
	const view = withTurnState(
		await input.controller.inspect(port),
		input.turnState,
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

async function runObserverCommand(input: ObserveCommandInput): Promise<void> {
	const port = commandPort(input.pi, input.ctx);
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
			input.pi.sendMessage(
				{
					customType: "observer.hypothesis-context-review-trigger",
					content: [
						"A user hypothesis needs its initial current-context review.",
						`hypothesis_observation_id=${result.hypothesis.observationId}`,
						`hypothesis=${result.hypothesis.original}`,
						`user_context=${result.hypothesis.context}`,
						"Re-read the visible Pi context and current Observer working state through this hypothesis as a lens.",
						"Preserve user-provided context separately from your interpretation.",
						"Call observer_sidecar with action hypothesis-context-review. Record supporting clues, challenging clues, missing information, genuine Source IDs when available, and the interpretation boundary.",
					].join("\n"),
					display: false,
					details: {
						hypothesisObservationId: result.hypothesis.observationId,
					},
				},
				{ deliverAs: "followUp", triggerTurn: true },
			);
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
			input.pi.sendMessage(
				{
					customType: "observer.memo-trigger",
					content: [
						"Observer Memo request is pending.",
						`request_id=${request.requestId}`,
						"Call observer_sidecar with action memo-scope for this request.",
					].join("\n"),
					display: false,
					details: {
						requestId: request.requestId,
						requestDigest: request.requestDigest,
					},
				},
				{ deliverAs: "followUp", triggerTurn: true },
			);
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
			return input.controller.command(input.args, port);
		},
		delegateMemo() {
			return input.controller.command("memo", port);
		},
		triggerMemo(request) {
			input.pi.sendMessage(
				{
					customType: "observer.final-memo-trigger",
					content: [
						"Review requires one final Memo reconciliation.",
						`request_id=${request.requestId}`,
						"Call observer_sidecar with action memo-scope for this request. Successful completion continues to an inspectable save proposal without writing files.",
					].join("\n"),
					display: false,
					details: {
						requestId: request.requestId,
						requestDigest: request.requestDigest,
						continuation: "review-save",
					},
				},
				{ deliverAs: "followUp", triggerTurn: true },
			);
		},
		triggerSave(request) {
			input.pi.sendMessage(
				{
					customType: "observer.save-trigger",
					content: [
						"Observer Review request is pending.",
						`request_id=${request.requestId}`,
						"Call observer_sidecar with action save-scope for this request. Prepare the proposal only; do not approve or save it.",
					].join("\n"),
					display: false,
					details: {
						requestId: request.requestId,
						requestDigest: request.requestDigest,
					},
				},
				{ deliverAs: "followUp", triggerTurn: true },
			);
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
	input: ObserveCommandInput,
	port: ObserverCommandPort,
	language: "ko" | "en",
): Promise<boolean> {
	const root = await input.ctx.ui.input(
		"Observer Notebook path",
		`Absolute, or relative to ${input.ctx.cwd}`,
	);
	if (root === undefined) return false;
	if (!root.trim()) {
		input.ctx.ui.notify("Enter a Notebook path.", "warning");
		return false;
	}
	const resolvedRoot = resolve(input.ctx.cwd, root.trim());
	const setup = `Set up ${resolvedRoot} · default output ${language}`;
	const choice = await input.ctx.ui.select(
		[
			"Review Observer Notebook setup",
			`Resolved path: ${resolvedRoot}`,
			`Default Memo/Zettel language: ${language}`,
			"A new Notebook is initialized; an existing folder is adopted without rewriting unrelated files.",
		].join("\n"),
		["Go back · make no changes", setup],
	);
	if (choice !== setup) return false;
	await input.controller.command(`setup ${language} ${resolvedRoot}`, port);
	const view = await input.controller.inspect(port);
	return view.control.notebook === "ready";
}

async function showObserverControlFlow(
	input: ObserveCommandInput,
): Promise<void> {
	const port = commandPort(input.pi, input.ctx);
	let pendingLanguage: "ko" | "en" = "en";
	while (true) {
		const view = withTurnState(
			await input.controller.inspect(port),
			input.turnState,
		);
		if (view.control.notebookDefaultLanguage)
			pendingLanguage = view.control.notebookDefaultLanguage;
		const action = await showObserverControl(input.ctx, view, pendingLanguage, {
			async applyActivation(enabled) {
				await input.controller.command(enabled ? "on" : "off", port);
				await refreshObserverChrome(input);
				return withTurnState(
					await input.controller.inspect(port),
					input.turnState,
				);
			},
			async applyLanguage(language) {
				const current = withTurnState(
					await input.controller.inspect(port),
					input.turnState,
				);
				const applied =
					current.control.notebook === "ready"
						? await input.controller.updateDefaultLanguage(language, port)
						: true;
				if (applied) pendingLanguage = language;
				await refreshObserverChrome(input);
				return withTurnState(
					await input.controller.inspect(port),
					input.turnState,
				);
			},
			onError(error) {
				input.ctx.ui.notify(
					`Observer setting failed: ${error instanceof Error ? error.message : String(error)}`,
					"error",
				);
			},
		});
		if (!action) return;
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
			case "status":
				await showObserverStatus(
					input.ctx,
					withTurnState(await input.controller.inspect(port), input.turnState),
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

async function handleObserveCommand(input: ObserveCommandInput): Promise<void> {
	const presentation = observerCommandPresentation(input.args, input.ctx.mode);
	if (presentation === "control") {
		await showObserverControlFlow(input);
		return;
	}
	if (presentation === "status") {
		const view = withTurnState(
			await input.controller.inspect(commandPort(input.pi, input.ctx)),
			input.turnState,
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

function registerObserverSidecarTool(input: {
	readonly pi: ExtensionAPI;
	readonly controller: ReturnType<typeof createObserverController>;
	readonly observation: ReturnType<typeof createObservationController>;
	readonly materialReviewIds: ObserverMaterialReviewIds;
	readonly turnState: ObserverTurnState;
}): void {
	input.pi.registerTool({
		name: OBSERVER_TOOL_NAME,
		label: "Observer Sidecar",
		description:
			"Start or finish an exact material review, review current context through a user hypothesis, or stage source-faithful Observer work. Use source-read before StandingIndex hydration, record semantic movement, then complete exact Memo and Review proposal requests from their locked scope.",
		promptSnippet:
			"Use model-owned material-review classification only with the exact hidden digest; complete pending hypothesis-context, Memo, and save reviews from their exact current scope.",
		parameters: observerSidecarParameters,
		executionMode: "sequential",
		async execute(...execution) {
			const [, params, , , ctx] = execution;
			input.turnState.toolUsed = true;
			const port = commandPort(input.pi, ctx);
			const materialReview = await routeMaterialReviewTool({
				value: params,
				capturedAt: new Date().toISOString(),
				port,
				lifecycle: input.controller,
				observation: input.observation,
				ids: input.materialReviewIds,
				turnState: input.turnState,
			});
			if (materialReview)
				return {
					content: [{ type: "text", text: materialReview.text }],
					details: materialReview.result,
				};
			const executionResult = await input.observation.execute(params, port);
			if (!executionResult.ok) {
				const action = Reflect.get(params, "action");
				const requestId = Reflect.get(params, "request_id");
				const requestAction =
					action === "memo-scope" ||
					action === "memo-prepare" ||
					action === "save-scope" ||
					action === "save-prepare";
				if (!requestAction || typeof requestId !== "string") {
					throw new Error(executionResult.message);
				}
				input.turnState.blockedRequestId = requestId;
				const failure = {
					ok: false,
					message: executionResult.message,
					retry: false,
					automatic_observer_request_paused: true,
					next: "Continue the user's requested task. Retry Observer explicitly with /observe memo or /observe review.",
				};
				return {
					content: [{ type: "text", text: JSON.stringify(failure) }],
					details: executionResult,
				};
			}
			input.turnState.blockedRequestId = null;
			const result = executionResult;
			if (result.action === "save-prepare") {
				const completion = requireSavePreparationSuccess(
					await completeSavePreparation(result.handoff, {
						install(value) {
							return input.controller.installPrepared(value, port);
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
							return input.controller.installPreparedMemo(value, port);
						},
						apply() {
							return input.controller.command("memo", port);
						},
						completed(requestId) {
							return memoPreparationCompleted(
								ctx.sessionManager.getBranch(),
								requestId,
							);
						},
					}),
				);
				const continuation =
					completion.status === "completed"
						? await input.observation.continueReviewSaveAfterMemo(
								result.instruction.requestId,
								port,
							)
						: null;
				const next =
					continuation?.ok && continuation.request
						? {
								action: "save-scope" as const,
								request_id: continuation.request.requestId,
							}
						: continuation?.ok && continuation.status === "delegate"
							? { action: "review-existing-save" as const }
							: null;
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
		},
	});
}

function registerObserverEvents(input: {
	readonly pi: ExtensionAPI;
	readonly controller: ReturnType<typeof createObserverController>;
	readonly observation: ReturnType<typeof createObservationController>;
	readonly turnState: ObserverTurnState;
}): void {
	input.pi.on("input", (event, ctx) => {
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
			event.text.trimStart().startsWith("/observe")
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
		const materialReviewRequestId = activeMaterialReviewCaptureRequestId(
			input.turnState,
		);
		if (materialReviewRequestId && event.isError) return;
		reportCaptureFailure(
			input.observation.capture(
				{
					origin: {
						kind: "tool-result",
						tool_call_id: event.toolCallId,
						tool_name: event.toolName,
					},
					text,
					capturedAt: new Date().toISOString(),
					...(materialReviewRequestId ? { materialReviewRequestId } : {}),
				},
				commandPort(input.pi, ctx),
			),
			ctx,
		);
	});
	input.pi.on("agent_start", () => {
		beginObserverAgentRun(input.turnState);
	});
	input.pi.on("agent_end", () => {
		endObserverAgentRun(input.turnState);
	});
	input.pi.on("agent_settled", async (_event, ctx) => {
		settleObserverAgentRun(input.turnState);
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
	input.pi.on("context", (event, ctx) => {
		const guidance = observerTurnContext({
			turnState: input.turnState,
			entries: ctx.sessionManager.getBranch(),
		});
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
		settleObserverAgentRun(input.turnState);
		await input.controller.bind(commandPort(input.pi, ctx));
		await refreshObserverChrome({ ...input, ctx });
	});
	input.pi.on("session_tree", async (_event, ctx) => {
		settleObserverAgentRun(input.turnState);
		await input.controller.bind(commandPort(input.pi, ctx));
		await refreshObserverChrome({ ...input, ctx });
	});
	input.pi.on("session_compact", async (_event, ctx) => {
		await refreshObserverChrome({ ...input, ctx });
	});
	input.pi.on("tool_execution_end", async (event, ctx) => {
		if (event.toolName === OBSERVER_TOOL_NAME)
			await refreshObserverChrome({ ...input, ctx });
	});
	input.pi.on("session_shutdown", (_event, ctx) => {
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
		agentRunSequence: 0,
		activeAgentRunId: null,
		materialReviewRun: null,
		stagedMaterialReviewRetry: null,
	};

	registerObserverSidecarTool({
		pi,
		controller,
		observation,
		materialReviewIds: systemMaterialReviewIds(),
		turnState,
	});

	pi.registerCommand("observe", {
		description:
			"Configure Observer, reconcile Memo, Review proposed changes, and Save separately",
		getArgumentCompletions: completeObserveArgs,
		handler(args, ctx) {
			return handleObserveCommand({
				args,
				ctx,
				pi,
				controller,
				observation,
				turnState,
			});
		},
	});

	registerObserverEvents({ pi, controller, observation, turnState });
}
