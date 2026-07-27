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
	type ObservationControllerIds,
	type ObservationControllerResult,
} from "../src/observation-controller.ts";
import { observerSidecarContext } from "../src/observer-prompt.ts";
import { fileNotebookSelectionStore } from "../src/notebook-selection-store.ts";

const OBSERVER_STATUS_KEY = "observer";
const OBSERVER_TOOL_NAME = "observer_sidecar";

const nullableString = Type.Union([Type.String(), Type.Null()]);
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
const observerSidecarParameters = Type.Union([
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

export function observationToolText(result: ObservationControllerResult): string {
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
			"Stage source-faithful Observer work. Use source-read before seeing the compact StandingIndex, hydrate only related Inquiry IDs, then record; use user-hypothesis for an explicit user proposal.",
		promptSnippet:
			"Stage source-first Sidecar observations when Observer context says Mode is ON.",
		parameters: observerSidecarParameters,
		executionMode: "sequential",
		async execute(...execution) {
			const [, params, , , ctx] = execution;
			observerToolUsedInTurn = true;
			const result = await observation.execute(params, commandPort(pi, ctx));
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
			await controller.command(args, commandPort(pi, ctx));
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
