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
	type ObservationControllerResult,
} from "../src/observation-controller.ts";
import type { PreparedObservationMemoInstruction } from "../src/memo-instruction.ts";
import { encodePreparedMemoPass } from "../src/memo-profile.ts";
import { reconstructObservationSession } from "../src/observation-session.ts";
import type { ObservationMemoRequestedEvent } from "../src/observation-profile.ts";
import { observerSidecarContext } from "../src/observer-prompt.ts";
import { parseObserveCommand } from "../src/observer-command.ts";
import { fileNotebookSelectionStore } from "../src/notebook-selection-store.ts";

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
	Type.Object(
		{
			observer_action: Type.Literal("observer-sidecar/v1"),
			action: Type.Literal("memo-prepare"),
			request_id: Type.String(),
			instruction: Type.Object(
				{
					observer_memo_instruction: Type.Literal(
						"observer.memo-instruction/v1",
					),
					request_id: Type.String(),
					request_digest: Type.String(),
					pass: Type.Object(
						{
							observer_memo_pass: Type.Literal(
								"observer.prepared-memo-pass/v1",
							),
							pass_id: Type.String(),
							episode_id: Type.String(),
							base_revision_id: nullableString,
							basis_digest: Type.String(),
							related_inquiry_ids: Type.Array(Type.String()),
							instruction_id: nullableString,
							evidence: Type.Array(Type.Record(Type.String(), Type.Unknown())),
							hypothesis_outcomes: Type.Array(
								Type.Record(Type.String(), Type.Unknown()),
							),
							memo_outcomes: Type.Array(
								Type.Record(Type.String(), Type.Unknown()),
							),
						},
						{ additionalProperties: false },
					),
					dispositions: Type.Array(
						Type.Object(
							{
								observation_id: Type.String(),
								decision: Type.Union([
									Type.Literal("integrated"),
									Type.Literal("kept"),
								]),
								hypothesis_inquiry_ids: Type.Array(Type.String()),
								memo_ids: Type.Array(Type.String()),
								evidence_ids: Type.Array(Type.String()),
								rationale: Type.String(),
							},
							{ additionalProperties: false },
						),
					),
				},
				{ additionalProperties: false },
			),
		},
		{ additionalProperties: false },
	),
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
				observations: result.context.observations,
				memo_scope: result.context.memoScope,
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
			"Stage source-faithful Observer work. Use source-read before StandingIndex hydration, record semantic movement or a user hypothesis, and use memo-scope only for the exact pending /observe memo request.",
		promptSnippet:
			"Stage source-first Sidecar observations and hydrate exact pending Memo requests.",
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
		async handler(args, ctx) {
			const port = commandPort(pi, ctx);
			const handled = await routeMemoCommand(args, {
				request() {
					return observation.requestMemo(port);
				},
				delegate() {
					return controller.command(args, port);
				},
				trigger(request) {
					pi.sendMessage(
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
				notify: ctx.ui.notify.bind(ctx.ui),
			});
			if (!handled) await controller.command(args, port);
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
