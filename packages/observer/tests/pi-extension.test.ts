import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { SessionManager } from "@earendil-works/pi-coding-agent";
import { Value } from "typebox/value";

import observerExtension, {
	observerSidecarParameters,
	requireMemoPreparationSuccess,
	requireObservationToolSuccess,
	routeAddHypothesisCommand,
	routeMaterialCommand,
	routeMemoCommand,
	routeReviewCommand,
	textFromContent,
} from "../extensions/observer.ts";
import { acceptScriptedMaterialInput } from "../extensions/material-review-runtime.ts";
import {
	hypothesisContextReviewActionSchema,
	hypothesisOutcomeSchema,
	memoOutcomeSchema,
	memoPrepareActionSchema,
	materialReviewFinishActionSchema,
	materialReviewStartActionSchema,
	savePrepareActionSchema,
	saveScopeActionSchema,
} from "../extensions/memo-tool-schema.ts";
import { OBSERVER_PROTOCOL, type ObserverEvent } from "../src/lifecycle.ts";
import { decodeObservationAction } from "../src/observation-action.ts";
import { requireMaterialReviewCommandSuccess } from "../src/material-review-command.ts";
import { prepareObservationEvent } from "../src/observation-profile.ts";
import {
	OBSERVER_LIFECYCLE_ENTRY,
	reconstructObserverPiState,
} from "../src/pi-session.ts";
import {
	decodeSaveRequestEvent,
	type SaveRequestEvent,
} from "../src/save-trigger.ts";

const notebookId = "notebook-22222222-2222-4222-8222-222222222222";

function selected(): ObserverEvent {
	return {
		protocol: OBSERVER_PROTOCOL,
		kind: "notebook-selected",
		notebookId,
	};
}

function opened(): ObserverEvent {
	return {
		protocol: OBSERVER_PROTOCOL,
		kind: "episode-opened",
		episodeId: "episode-pi-session",
		notebookId,
		lang: "ko",
	};
}

function activation(enabled: boolean): ObserverEvent {
	return {
		protocol: OBSERVER_PROTOCOL,
		kind: "activation-changed",
		enabled,
	};
}

function appendAssistantCheckpoint(
	manager: SessionManager,
	text: string,
): void {
	manager.appendMessage({
		role: "assistant",
		content: [{ type: "text", text }],
		api: "anthropic-messages",
		provider: "observer-test",
		model: "observer-test",
		usage: {
			input: 0,
			output: 0,
			cacheRead: 0,
			cacheWrite: 0,
			totalTokens: 0,
			cost: {
				input: 0,
				output: 0,
				cacheRead: 0,
				cacheWrite: 0,
				total: 0,
			},
		},
		stopReason: "stop",
		timestamp: Date.now(),
	});
}

async function withSandbox(
	run: (sandbox: string) => Promise<void>,
): Promise<void> {
	const sandbox = await mkdtemp(join(tmpdir(), "observer-pi-session-"));
	try {
		await run(sandbox);
	} finally {
		await rm(sandbox, { recursive: true, force: true });
	}
}

test("exports a loadable Pi extension factory", () => {
	assert.equal(typeof observerExtension, "function");
});

test("declares exact Pi package discovery and peer surfaces", async () => {
	const manifest = JSON.parse(
		await readFile(join(import.meta.dirname, "..", "package.json"), "utf8"),
	);
	assert.deepEqual(manifest.pi, {
		extensions: ["./extensions/observer.ts"],
	});
	assert.deepEqual(manifest.peerDependencies, {
		"@earendil-works/pi-coding-agent": ">=0.80.10 <0.83.0",
		"@earendil-works/pi-tui": ">=0.80.10 <0.83.0",
		typebox: "^1.3.6",
	});
	assert.equal(manifest.files.includes("extensions"), true);
	const [source, schemaSource] = await Promise.all([
		readFile(
			join(import.meta.dirname, "..", "extensions", "observer.ts"),
			"utf8",
		),
		readFile(
			join(import.meta.dirname, "..", "extensions", "memo-tool-schema.ts"),
			"utf8",
		),
	]);
	assert.match(source, /name: OBSERVER_TOOL_NAME/u);
	assert.match(source, /executionMode: "sequential"/u);
	assert.match(source, /pi\.on\("tool_result"/u);
	assert.match(source, /event\.toolName === OBSERVER_TOOL_NAME/u);
	assert.match(schemaSource, /action: Type\.Literal\("memo-scope"\)/u);
	assert.match(
		schemaSource,
		/action: Type\.Literal\("hypothesis-context-review"\)/u,
	);
	assert.match(
		schemaSource,
		/action: Type\.Literal\("material-review-start"\)/u,
	);
	assert.match(
		schemaSource,
		/action: Type\.Literal\("material-review-finish"\)/u,
	);
	assert.match(source, /parsed\.command\.kind !== "memo"/u);
	assert.match(source, /parsed\.command\.kind !== "review"/u);
	assert.match(schemaSource, /saveScopeActionSchema/u);
	assert.match(schemaSource, /savePrepareActionSchema/u);
	assert.match(source, /pi\.on\("context"/u);
	const requestIndex = source.indexOf("observation.requestMemo(port)");
	const triggerIndex = source.indexOf("pi.sendMessage(", requestIndex);
	assert.equal(requestIndex >= 0, true);
	assert.equal(triggerIndex > requestIndex, true);
});

test("routes Memo request before trigger and delegates no-op without triggering", async () => {
	const prepared = prepareObservationEvent({
		observer_observation: "observer-observation/v1",
		kind: "memo-requested",
		episode_id: "episode-extension-memo",
		request_id: "memo-request-00000000-0000-4000-8000-000000000041",
		base_memo_revision_id: null,
		observation_ids: ["observation-00000000-0000-4000-8000-000000000042"],
		request_digest:
			"0000000000000000000000000000000000000000000000000000000000000043",
	});
	if (!prepared.ok || prepared.value.kind !== "memo-requested") {
		assert.fail("Expected Memo request event");
	}
	const request = prepared.value;
	const trace: string[] = [];
	const handled = await routeMemoCommand("memo", {
		request() {
			trace.push("request");
			return {
				ok: true,
				status: "requested",
				message: "requested",
				request,
			};
		},
		async delegate() {
			trace.push("delegate");
		},
		trigger() {
			trace.push("trigger");
		},
		notify(_message, type) {
			trace.push(`notify:${type}`);
		},
	});
	assert.equal(handled, true);
	assert.deepEqual(trace, ["request", "trigger", "notify:info"]);

	trace.length = 0;
	await routeMemoCommand("memo", {
		request() {
			trace.push("request");
			return {
				ok: true,
				status: "none",
				message: "none",
				request: null,
			};
		},
		async delegate() {
			trace.push("delegate");
		},
		trigger() {
			trace.push("trigger");
		},
		notify(_message, type) {
			trace.push(`notify:${type}`);
		},
	});
	assert.deepEqual(trace, ["request", "delegate"]);

	trace.length = 0;
	await routeMemoCommand("memo", {
		request() {
			trace.push("request");
			return {
				ok: true,
				status: "resumed",
				message: "resumed",
				request,
			};
		},
		async delegate() {
			trace.push("delegate");
		},
		trigger() {
			trace.push("trigger");
			throw new Error("injected trigger failure");
		},
		notify(_message, type) {
			trace.push(`notify:${type}`);
		},
	});
	assert.deepEqual(trace, ["request", "trigger", "notify:warning"]);
});

test("adds an explicit hypothesis and routes optional context into review", async () => {
	let received: {
		readonly original: string;
		readonly userContext: string | null;
	} | null = null;
	const notifications: string[] = [];
	const handled = await routeAddHypothesisCommand(
		"add-hypothesis 가설은 명시적으로 보존되어야 한다.\nContext: 사용자가 직접 이유를 제공했다.",
		{
			add(draft) {
				received = draft;
				return Promise.resolve({ ok: false, message: "injected" });
			},
			triggerReview() {
				assert.fail("A failed capture must not trigger context review");
			},
			notify(message, type) {
				notifications.push(`${type}:${message}`);
			},
		},
	);
	assert.equal(handled, true);
	assert.deepEqual(received, {
		original: "가설은 명시적으로 보존되어야 한다.",
		userContext: "사용자가 직접 이유를 제공했다.",
	});
	assert.deepEqual(notifications, ["error:injected"]);

	const missing: string[] = [];
	assert.equal(
		await routeAddHypothesisCommand("add-hypothesis", {
			add() {
				assert.fail("Missing text must not reach tracking effects");
			},
			triggerReview() {
				assert.fail("Missing text must not trigger context review");
			},
			notify(message, type) {
				missing.push(`${type}:${message}`);
			},
		}),
		true,
	);
	assert.match(missing[0] ?? "", /warning:.*add-hypothesis <text>/u);
});

test("routes a scriptable material command without changing Observer Mode", () => {
	const submitted: string[] = [];
	const notifications: string[] = [];
	assert.equal(
		routeMaterialCommand("material https://example.test/source", {
			submit(request) {
				submitted.push(request);
			},
			notify(message, type) {
				notifications.push(`${type}:${message}`);
			},
		}),
		true,
	);
	assert.deepEqual(submitted, ["https://example.test/source"]);
	assert.equal(notifications.length, 0);

	assert.equal(
		routeMaterialCommand("material", {
			submit() {
				assert.fail("Missing material must not be submitted");
			},
			notify(message, type) {
				notifications.push(`${type}:${message}`);
			},
		}),
		true,
	);
	assert.match(notifications.at(-1) ?? "", /warning:.*material <request>/u);
	assert.equal(
		routeMaterialCommand("status", {
			submit() {
				assert.fail("Unrelated commands must not be submitted");
			},
			notify() {},
		}),
		false,
	);

	const turnState = {
		toolUsed: false,
		latestUser: null,
		scriptedMaterialRequest: submitted[0] ?? null,
		blockedRequestId: null,
	};
	assert.equal(
		acceptScriptedMaterialInput({
			turnState,
			source: "extension",
			text: submitted[0] ?? "",
			inputSource: "rpc",
		}),
		true,
	);
	assert.deepEqual(turnState.latestUser, {
		text: "https://example.test/source",
		inputSource: "rpc",
	});
	assert.equal(turnState.scriptedMaterialRequest, null);
});

test("routes Review preparation before triggers and delegates an existing proposal", async () => {
	const decoded = decodeSaveRequestEvent({
		protocol: "observer.save-request/v1",
		kind: "save-requested",
		request_id: "save-request-00000000-0000-4000-8000-000000000044",
		proposal_id: "proposal-00000000-0000-4000-8000-000000000045",
		request_digest:
			"0000000000000000000000000000000000000000000000000000000000000046",
		episode_id: "episode-extension-save",
		notebook_id: notebookId,
		root: "/tmp/observer-extension-save",
		episode_language: "en",
		memo_revision_id: null,
		source_read_ids: [],
	});
	if (!decoded.ok) assert.fail(decoded.issue.message);
	const request: SaveRequestEvent = decoded.value;
	const finalMemoDecoded = prepareObservationEvent({
		observer_observation: "observer-observation/v1",
		kind: "memo-requested",
		episode_id: "episode-extension-save",
		request_id: "memo-request-00000000-0000-4000-8000-000000000048",
		base_memo_revision_id: null,
		observation_ids: ["observation-00000000-0000-4000-8000-000000000049"],
		request_digest:
			"0000000000000000000000000000000000000000000000000000000000000050",
	});
	if (!finalMemoDecoded.ok || finalMemoDecoded.value.kind !== "memo-requested")
		assert.fail("Expected final Memo request");
	const finalMemoRequest = finalMemoDecoded.value;
	const trace: string[] = [];
	const handled = await routeReviewCommand("review", {
		request() {
			trace.push("request");
			return Promise.resolve({
				ok: true,
				status: "requested",
				message: "requested",
				request,
			});
		},
		async delegateSave() {
			trace.push("delegate");
		},
		async delegateMemo() {
			trace.push("memo-delegate");
		},
		triggerSave() {
			trace.push("trigger");
		},
		triggerMemo() {
			trace.push("memo-trigger");
		},
		notify(_message, type) {
			trace.push(`notify:${type}`);
		},
	});
	assert.equal(handled, true);
	assert.deepEqual(trace, ["request", "trigger", "notify:info"]);

	trace.length = 0;
	await routeReviewCommand("review", {
		request() {
			trace.push("request");
			return Promise.resolve({
				ok: true,
				status: "memo-requested",
				message: "final memo",
				request: null,
				memoRequest: finalMemoRequest,
			});
		},
		async delegateSave() {
			trace.push("delegate");
		},
		async delegateMemo() {
			trace.push("memo-delegate");
		},
		triggerSave() {
			trace.push("trigger");
		},
		triggerMemo() {
			trace.push("memo-trigger");
		},
		notify(_message, type) {
			trace.push(`notify:${type}`);
		},
	});
	assert.deepEqual(trace, ["request", "memo-trigger", "notify:info"]);

	trace.length = 0;
	let finalMemoDelegated = false;
	await routeReviewCommand("review", {
		request() {
			trace.push("request");
			if (!finalMemoDelegated)
				return Promise.resolve({
					ok: true,
					status: "memo-delegate",
					message: "apply prepared Memo",
					request: null,
					memoRequest: null,
				});
			return Promise.resolve({
				ok: true,
				status: "requested",
				message: "requested",
				request,
			});
		},
		async delegateSave() {
			trace.push("delegate");
		},
		async delegateMemo() {
			trace.push("memo-delegate");
			finalMemoDelegated = true;
		},
		triggerSave() {
			trace.push("trigger");
		},
		triggerMemo() {
			trace.push("memo-trigger");
		},
		notify(_message, type) {
			trace.push(`notify:${type}`);
		},
	});
	assert.deepEqual(trace, [
		"request",
		"memo-delegate",
		"request",
		"trigger",
		"notify:info",
	]);

	trace.length = 0;
	await routeReviewCommand("review", {
		request() {
			trace.push("request");
			return Promise.resolve({
				ok: true,
				status: "delegate",
				message: "delegate",
				request: null,
			});
		},
		async delegateSave() {
			trace.push("delegate");
		},
		async delegateMemo() {
			trace.push("memo-delegate");
		},
		triggerSave() {
			trace.push("trigger");
		},
		triggerMemo() {
			trace.push("memo-trigger");
		},
		notify(_message, type) {
			trace.push(`notify:${type}`);
		},
	});
	assert.deepEqual(trace, ["request", "notify:info"]);

	const scope = {
		observer_action: "observer-sidecar/v1",
		action: "save-scope",
		request_id: request.requestId,
	};
	assert.equal(Value.Check(saveScopeActionSchema, scope), true);
	assert.equal(
		Value.Check(saveScopeActionSchema, { ...scope, extra: true }),
		false,
	);
	const prepare = {
		observer_action: "observer-sidecar/v1",
		action: "save-prepare",
		request_id: request.requestId,
		summary: "Prepare one required record.",
		records: [
			{
				operation: "create",
				record_id: "source-00000000-0000-4000-8000-000000000047",
				markdown: "draft",
			},
		],
	};
	assert.equal(Value.Check(savePrepareActionSchema, prepare), true);
	assert.equal(
		Value.Check(savePrepareActionSchema, {
			...prepare,
			proposal_id: request.proposalId,
		}),
		false,
	);
	assert.equal(decodeObservationAction(prepare).ok, true);
	assert.equal(
		decodeObservationAction({ ...prepare, root: request.root }).ok,
		false,
	);
});

test("validates a bounded hypothesis context review payload", () => {
	const review = {
		observer_action: "observer-sidecar/v1",
		action: "hypothesis-context-review",
		hypothesis_observation_id:
			"observation-00000000-0000-4000-8000-000000000089",
		assessment: "mixed",
		supporting_clues: ["The current conversation contains one supporting cue."],
		challenging_clues: ["The current conversation also contains one tension."],
		missing_information: ["No external comparison has been retrieved."],
		source_ids: [],
		interpretation_boundary: "Visible Pi context only.",
	};
	assert.equal(Value.Check(hypothesisContextReviewActionSchema, review), true);
	assert.equal(Value.Check(observerSidecarParameters, review), true);
	assert.equal(decodeObservationAction(review).ok, true);
	assert.equal(
		Value.Check(hypothesisContextReviewActionSchema, {
			...review,
			observer_interpretation_as_user_context: true,
		}),
		false,
	);
});

test("preserves explicit null through Pi 0.80.10 TypeBox conversion", () => {
	const value = {
		observer_action: "observer-sidecar/v1",
		action: "source-read",
		candidate_ids: ["candidate-00000000-0000-4000-8000-000000000091"],
		source: {
			kind: "direct-observation",
			title: "Runtime conversion fixture",
			lang: "en",
			observed_at: "2026-07-27T03:45:00.000Z",
			observed_by: "test",
			fact: "Explicit null must remain explicit null.",
			conditions: "Pi validates the registered TypeBox schema.",
			interpretation_boundary: "This tests representation only.",
		},
		faithful_summary: "Explicit absence survives validation.",
		claims: [{ text: "One claim.", locator: null }],
	};
	Value.Convert(observerSidecarParameters, value);
	assert.equal(value.claims[0]?.locator, null);
});

test("describes strict material review start and finish model payloads", () => {
	const start = {
		observer_action: "observer-sidecar/v1",
		action: "material-review-start",
		user_message_digest: "1".repeat(64),
		material: { kind: "inline-user-message" },
	};
	const finish = {
		observer_action: "observer-sidecar/v1",
		action: "material-review-finish",
		request_id: "material-review-00000000-0000-4000-8000-000000000092",
	};
	assert.equal(Value.Check(materialReviewStartActionSchema, start), true);
	assert.equal(
		Value.Check(materialReviewStartActionSchema, {
			...start,
			material: { kind: "inline-user-message", text: "not allowed" },
		}),
		false,
	);
	assert.equal(Value.Check(materialReviewFinishActionSchema, finish), true);
	assert.equal(
		Value.Check(materialReviewFinishActionSchema, {
			...finish,
			digest: "locked",
		}),
		false,
	);
	assert.equal(Value.Check(observerSidecarParameters, start), true);
	assert.equal(Value.Check(observerSidecarParameters, finish), true);
});

test("describes every Memo outcome and rejects locked-field injection", () => {
	const evidenceId = "evidence-00000000-0000-4000-8000-000000000093";
	const inquiryId = "inquiry-00000000-0000-4000-8000-000000000094";
	const memoId = "memo-00000000-0000-4000-8000-000000000095";
	const episodeId = "episode-schema";
	const hypothesis = {
		inquiry_id: inquiryId,
		episode_id: episodeId,
		origin: "user",
		original: "Original",
		current: "Original",
		revision_reason: null,
		evidence_ids: [],
	};
	const memo = {
		memo_id: "memo-00000000-0000-4000-8000-000000000097",
		episode_id: episodeId,
		title: "Schema Memo",
		lang: "en",
		content: "Schema content",
		inquiry_ids: [inquiryId],
		hypothesis_id: inquiryId,
		evidence_ids: [evidenceId],
		reason: "Schema fixture",
	};
	const hypothesisOutcomes = [
		{ kind: "keep", inquiry_id: inquiryId },
		{ kind: "create", hypothesis },
		{
			kind: "revise",
			inquiry_id: inquiryId,
			current: "Revised",
			revision_reason: "New evidence",
			evidence_ids: [evidenceId],
		},
	];
	const memoOutcomes = [
		{ kind: "keep-incubating", memo_id: memoId },
		{
			kind: "revise-incubating",
			memo_id: memoId,
			revision: {
				revision_id: "memo-revision-00000000-0000-4000-8000-000000000096",
				title: "Revised",
				content: "Revised content",
				evidence_ids: [evidenceId],
				reason: "New evidence",
			},
		},
		{
			kind: "revise-promotion-candidate",
			memo_id: memoId,
			revision: {
				revision_id: "memo-revision-00000000-0000-4000-8000-000000000099",
				title: "Promotion revision",
				content: "Promotion candidate content",
				evidence_ids: [evidenceId],
				reason: "Promotion evidence",
			},
		},
		{
			kind: "mark-promotion-candidate",
			memo_id: memoId,
			reason: "Enough evidence",
			evidence_ids: [evidenceId],
		},
		{
			kind: "merge",
			source_ids: [memoId, "memo-00000000-0000-4000-8000-000000000096"],
			target: memo,
		},
		{ kind: "create", memo },
	];
	for (const outcome of hypothesisOutcomes) {
		assert.equal(Value.Check(hypothesisOutcomeSchema, outcome), true);
	}
	for (const outcome of memoOutcomes) {
		assert.equal(Value.Check(memoOutcomeSchema, outcome), true);
	}
	const action = {
		observer_action: "observer-sidecar/v1",
		action: "memo-prepare",
		request_id: "memo-request-00000000-0000-4000-8000-000000000091",
		submission: {
			evidence: [
				{
					evidence_id: evidenceId,
					kind: "source-claim",
					source_id: null,
					summary: "Schema evidence",
				},
			],
			hypothesis_outcomes: hypothesisOutcomes,
			memo_outcomes: memoOutcomes,
			dispositions: [
				{
					observation_id: "observation-00000000-0000-4000-8000-000000000098",
					decision: "integrated",
					hypothesis_inquiry_ids: [inquiryId],
					memo_ids: [memoId],
					evidence_ids: [evidenceId],
					rationale: "Schema disposition",
				},
			],
		},
	};
	Value.Convert(memoPrepareActionSchema, action);
	assert.equal(Value.Check(memoPrepareActionSchema, action), true);
	assert.equal(action.submission.evidence[0]?.source_id, null);
	const decoded = decodeObservationAction(action);
	if (!decoded.ok || decoded.value.action !== "memo-prepare")
		assert.fail(decoded.ok ? "Expected Memo action" : decoded.issue.message);
	assert.deepEqual(decoded.value.submission.memoOutcomes[1], {
		kind: "revise",
		memo_id: memoId,
		revision: memoOutcomes[1]?.revision,
		disposition: "incubating",
	});
	assert.deepEqual(decoded.value.submission.memoOutcomes[2], {
		kind: "revise",
		memo_id: memoId,
		revision: memoOutcomes[2]?.revision,
		disposition: "promotion-candidate",
	});
	const legacyRevise = {
		...action,
		submission: {
			...action.submission,
			memo_outcomes: [
				{
					kind: "revise",
					memo_id: memoId,
					revision: memoOutcomes[1]?.revision,
					disposition: "incubating",
				},
			],
		},
	};
	assert.equal(Value.Check(memoPrepareActionSchema, legacyRevise), false);
	assert.equal(decodeObservationAction(legacyRevise).ok, false);
	const additionalField = {
		...action,
		submission: {
			...action.submission,
			memo_outcomes: [{ ...memoOutcomes[1], disposition: "incubating" }],
		},
	};
	assert.equal(Value.Check(memoPrepareActionSchema, additionalField), false);
	assert.equal(decodeObservationAction(additionalField).ok, false);
	const wrongRequest = structuredClone(action);
	wrongRequest.request_id = "request-00000000-0000-4000-8000-000000000091";
	assert.equal(Value.Check(memoPrepareActionSchema, wrongRequest), false);
	const lockedOverride = structuredClone(action);
	Reflect.set(lockedOverride, "instruction", {});
	assert.equal(Value.Check(memoPrepareActionSchema, lockedOverride), false);
});

test("maps domain and installation rejection to actual tool errors", () => {
	assert.throws(
		() =>
			requireMaterialReviewCommandSuccess({
				ok: false,
				message: "material-review failed",
			}),
		/material-review failed/u,
	);
	assert.throws(
		() =>
			requireObservationToolSuccess({ ok: false, message: "domain failed" }),
		/domain failed/u,
	);
	assert.throws(
		() =>
			requireMemoPreparationSuccess({
				ok: false,
				message: "install failed",
			}),
		/install failed/u,
	);
});

test("reads tool-result text without altering the original result", () => {
	const content = [
		{ type: "text", text: "first" },
		{ type: "image", data: "untouched", mimeType: "image/png" },
		{ type: "text", text: "second" },
	];
	const before = structuredClone(content);
	assert.equal(textFromContent(content), "first\nsecond");
	assert.deepEqual(content, before);
});

test("replays persisted restart, compaction, and extracted branch ancestry", async () => {
	await withSandbox(async (sandbox) => {
		const sessionDir = join(sandbox, "sessions");
		await mkdir(sessionDir, { recursive: true });
		const manager = SessionManager.create(sandbox, sessionDir);
		manager.appendCustomEntry(OBSERVER_LIFECYCLE_ENTRY, selected());
		manager.appendCustomEntry(OBSERVER_LIFECYCLE_ENTRY, opened());
		const onId = manager.appendCustomEntry(
			OBSERVER_LIFECYCLE_ENTRY,
			activation(true),
		);
		const compactionId = manager.appendCompaction(
			"Conversation summary that is not Observer state.",
			onId,
			25_000,
		);
		manager.appendCustomEntry(OBSERVER_LIFECYCLE_ENTRY, activation(false));
		appendAssistantCheckpoint(manager, "Persist original session checkpoint.");

		const sessionFile = manager.getSessionFile();
		if (!sessionFile) assert.fail("Expected persisted Pi session");
		const restarted = SessionManager.open(sessionFile, sessionDir);
		const restartedState = reconstructObserverPiState(restarted.getBranch());
		assert.equal(restartedState.state.mode, "off");
		assert.equal(restartedState.state.episode.status, "open");
		assert.deepEqual(restartedState.issues, []);

		const branchFile = restarted.createBranchedSession(compactionId);
		if (!branchFile) assert.fail("Expected extracted Pi branch session");
		appendAssistantCheckpoint(
			restarted,
			"Persist extracted branch checkpoint.",
		);
		const branch = SessionManager.open(branchFile, sessionDir);
		const branchState = reconstructObserverPiState(branch.getBranch());
		assert.equal(branchState.state.mode, "on");
		assert.equal(branchState.state.episode.status, "open");
		assert.deepEqual(branchState.issues, []);
		assert.equal(
			branch.getBranch().some((entry) => entry.type === "compaction"),
			true,
		);
	});
});
