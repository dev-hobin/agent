import { randomUUID } from "node:crypto";
import { join } from "node:path";

import {
	getAgentDir,
	type ExtensionAPI,
	type ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

import {
	completeObserveArgs,
	createObserverController,
	type ObserverCommandPort,
	type ObserverControllerIds,
} from "../src/observer-controller.ts";
import {
	createObservationController,
	type MemoRequestControllerResult,
	type ObservationControllerIds,
	type WrapRequestControllerResult,
	type ObservationControllerResult,
} from "../src/observation-controller.ts";
import type { PreparedObservationMemoInstruction } from "../src/memo-instruction.ts";
import { encodePreparedMemoPass } from "../src/memo-profile.ts";
import { reconstructObservationSession } from "../src/observation-session.ts";
import type { ObservationMemoRequestedEvent } from "../src/observation-profile.ts";
import { observerSidecarContext } from "../src/observer-prompt.ts";
import { parseObserveCommand } from "../src/observer-command.ts";
import { fileNotebookSelectionStore } from "../src/notebook-selection-store.ts";
import type { WrapRequestEvent } from "../src/wrap-trigger.ts";
import {
	memoPrepareActionSchema,
	wrapScopeActionSchema,
} from "./memo-tool-schema.ts";

const OBSERVER_STATUS_KEY = "observer";
const OBSERVER_TOOL_NAME = "observer_sidecar";

const nullableString = Type.Union([Type.Null(), Type.String()]);
const sourceSchema = Type.Union([
	Type.Object(
		{
			kind: Type.Literal("external-material"),
			title: Type.String(),
			lang: Type.String(),
			uri: nullableString,
			revision: nullableString,
			content_hash: nullableString,
			retrieval_context: nullableString,
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			kind: Type.Literal("direct-observation"),
			title: Type.String(),
			lang: Type.String(),
			observed_at: Type.String(),
			observed_by: Type.String(),
			fact: Type.String(),
			conditions: Type.String(),
			interpretation_boundary: Type.String(),
		},
		{ additionalProperties: false },
	),
]);
const claimSchema = Type.Object(
	{
		text: Type.String(),
		locator: nullableString,
	},
	{ additionalProperties: false },
);
export const observerSidecarParameters = Type.Union([
	Type.Object(
		{
			observer_action: Type.Literal("observer-sidecar/v1"),
			action: Type.Literal("source-read"),
			candidate_ids: Type.Array(Type.String()),
			source: sourceSchema,
			faithful_summary: Type.String(),
			claims: Type.Array(claimSchema),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			observer_action: Type.Literal("observer-sidecar/v1"),
			action: Type.Literal("hydrate"),
			read_id: Type.String(),
			index_digest: Type.String(),
			inquiry_ids: Type.Array(Type.String()),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			observer_action: Type.Literal("observer-sidecar/v1"),
			action: Type.Literal("record"),
			read_id: Type.String(),
			hydration_id: nullableString,
			related_inquiry_ids: Type.Array(Type.String()),
			stance: Type.Union([
				Type.Literal("supports"),
				Type.Literal("challenges"),
				Type.Literal("refines"),
				Type.Literal("boundary"),
				Type.Literal("uncertain"),
			]),
			movement: Type.Union([
				Type.Literal("repeated-support"),
				Type.Literal("minor-refinement"),
				Type.Literal("uncertain-association"),
				Type.Literal("material-boundary-change"),
				Type.Literal("core-counterexample"),
				Type.Literal("independent-new-hypothesis"),
				Type.Literal("major-direction-change"),
				Type.Literal("missed-important-mismatch"),
			]),
			rationale: Type.String(),
			observer_hypothesis: nullableString,
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			observer_action: Type.Literal("observer-sidecar/v1"),
			action: Type.Literal("user-hypothesis"),
			candidate_id: Type.String(),
			existing_inquiry_id: nullableString,
			original: Type.String(),
			context: Type.String(),
		},
		{ additionalProperties: false },
	),
	Type.Object(
		{
			observer_action: Type.Literal("observer-sidecar/v1"),
			action: Type.Literal("memo-scope"),
			request_id: Type.String(),
		},
		{ additionalProperties: false },
	),
	memoPrepareActionSchema,
	wrapScopeActionSchema,
]);

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
		wrapRequestId(): `wrap-request-${string}` {
			return `wrap-request-${randomUUID()}`;
		},
		wrapProposalId(): `proposal-${string}` {
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
		branchEntries: sessionManager.getBranch.bind(sessionManager),
		sessionFile: sessionManager.getSessionFile.bind(sessionManager),
		appendEntry: pi.appendEntry.bind(pi),
		input: ui.input.bind(ui),
		select: ui.select.bind(ui),
		confirm: ui.confirm.bind(ui),
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
		case "wrap-scope":
			return JSON.stringify({
				ok: true,
				message: result.message,
				request_id: result.context.request.requestId,
				request_digest: result.context.request.requestDigest,
				wrap_preparation: result.guide,
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

export interface WrapCommandEffects {
	request(): Promise<WrapRequestControllerResult>;
	delegate(): Promise<void>;
	trigger(request: WrapRequestEvent): void;
	notify(message: string, type: "info" | "warning" | "error"): void;
}

export async function routeWrapCommand(
	args: string,
	effects: WrapCommandEffects,
): Promise<boolean> {
	const parsed = parseObserveCommand(args);
	if (!parsed.ok || parsed.command.kind !== "wrap") return false;
	const requested = await effects.request();
	if (!requested.ok) {
		effects.notify(requested.message, "error");
		return true;
	}
	if (requested.status === "delegate") {
		await effects.delegate();
		return true;
	}
	if (!requested.request) {
		effects.notify("Wrap request identity를 확인할 수 없습니다.", "error");
		return true;
	}
	try {
		effects.trigger(requested.request);
		effects.notify(requested.message, "info");
	} catch (error) {
		effects.notify(
			`Wrap request는 기록됐지만 agent trigger에 실패했습니다: ${error instanceof Error ? error.message : String(error)}`,
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

async function handleObserveCommand(input: {
	readonly args: string;
	readonly ctx: ExtensionContext;
	readonly pi: ExtensionAPI;
	readonly controller: ReturnType<typeof createObserverController>;
	readonly observation: ReturnType<typeof createObservationController>;
}): Promise<void> {
	const port = commandPort(input.pi, input.ctx);
	const memoHandled = await routeMemoCommand(input.args, {
		request() {
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
	if (memoHandled) return;
	const wrapHandled = await routeWrapCommand(input.args, {
		request() {
			return input.observation.requestWrap(port);
		},
		delegate() {
			return input.controller.command(input.args, port);
		},
		trigger(request) {
			input.pi.sendMessage(
				{
					customType: "observer.wrap-trigger",
					content: [
						"Observer Wrap request is pending.",
						`request_id=${request.requestId}`,
						"Call observer_sidecar with action wrap-scope for this request.",
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
	if (!wrapHandled) await input.controller.command(input.args, port);
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
	let observerToolUsedInTurn = false;

	pi.registerTool({
		name: OBSERVER_TOOL_NAME,
		label: "Observer Sidecar",
		description:
			"Stage source-faithful Observer work. Use source-read before StandingIndex hydration, record semantic movement or a user hypothesis, then use memo-scope and its locked preparation seed before memo-prepare for the exact pending request.",
		promptSnippet:
			"Stage source-first Sidecar observations and complete exact pending Memo requests from their preparation seed.",
		parameters: observerSidecarParameters,
		executionMode: "sequential",
		async execute(...execution) {
			const [, params, , , ctx] = execution;
			observerToolUsedInTurn = true;
			const port = commandPort(pi, ctx);
			const result = requireObservationToolSuccess(
				await observation.execute(params, port),
			);
			if (result.action === "memo-prepare") {
				const completion = requireMemoPreparationSuccess(
					await completeMemoPreparation(result.instruction, {
						install(value) {
							return controller.installPreparedMemo(value, port);
						},
						apply() {
							return controller.command("memo", port);
						},
						completed(requestId) {
							const snapshot = reconstructObservationSession(
								ctx.sessionManager.getBranch(),
							);
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
						},
					}),
				);
				return {
					content: [{ type: "text", text: JSON.stringify(completion) }],
					details: { preparation: result, completion },
				};
			}
			return {
				content: [{ type: "text", text: observationToolText(result) }],
				details: result,
			};
		},
	});

	pi.registerCommand("observe", {
		description: "Observer 설정, 상태, on/off, memo, wrap lifecycle 제어",
		getArgumentCompletions: completeObserveArgs,
		handler(args, ctx) {
			return handleObserveCommand({ args, ctx, pi, controller, observation });
		},
	});

	pi.on("input", (event, ctx) => {
		if (
			event.source === "extension" ||
			event.text.trim().length === 0 ||
			event.text.trimStart().startsWith("/observe")
		) {
			return;
		}
		reportCaptureFailure(
			observation.capture(
				{
					origin: { kind: "user-input", input_source: event.source },
					text: event.text,
					capturedAt: new Date().toISOString(),
				},
				commandPort(pi, ctx),
			),
			ctx,
		);
	});

	pi.on("tool_result", (event, ctx) => {
		if (event.toolName === OBSERVER_TOOL_NAME) return;
		const text = textFromContent(event.content);
		if (!text) return;
		reportCaptureFailure(
			observation.capture(
				{
					origin: {
						kind: "tool-result",
						tool_call_id: event.toolCallId,
						tool_name: event.toolName,
					},
					text,
					capturedAt: new Date().toISOString(),
				},
				commandPort(pi, ctx),
			),
			ctx,
		);
	});

	pi.on("turn_start", () => {
		observerToolUsedInTurn = false;
	});

	pi.on("turn_end", (event, ctx) => {
		if (observerToolUsedInTurn) return;
		const text = textFromContent(Reflect.get(event.message, "content"));
		if (!text) return;
		reportCaptureFailure(
			observation.capture(
				{
					origin: {
						kind: "assistant-result",
						turn_index: event.turnIndex,
					},
					text,
					capturedAt: new Date().toISOString(),
				},
				commandPort(pi, ctx),
			),
			ctx,
		);
	});

	pi.on("context", (event, ctx) => {
		const guidance = observerSidecarContext(ctx.sessionManager.getBranch());
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

	pi.on("session_start", async (_event, ctx) => {
		await controller.bind(commandPort(pi, ctx));
	});
	pi.on("session_tree", async (_event, ctx) => {
		await controller.bind(commandPort(pi, ctx));
	});
	pi.on("session_compact", async (_event, ctx) => {
		await controller.refresh(commandPort(pi, ctx));
	});
	pi.on("session_shutdown", (_event, ctx) => {
		controller.unbind();
		ctx.ui.setStatus(OBSERVER_STATUS_KEY, undefined);
	});
}
