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
	routeMemoCommand,
	textFromContent,
} from "../extensions/observer.ts";
import {
	hypothesisOutcomeSchema,
	memoOutcomeSchema,
	memoPrepareActionSchema,
} from "../extensions/memo-tool-schema.ts";
import { OBSERVER_PROTOCOL, type ObserverEvent } from "../src/lifecycle.ts";
import { prepareObservationEvent } from "../src/observation-profile.ts";
import {
	OBSERVER_LIFECYCLE_ENTRY,
	reconstructObserverPiState,
} from "../src/pi-session.ts";

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
		"@earendil-works/pi-coding-agent": "*",
		typebox: "*",
	});
	assert.equal(manifest.files.includes("extensions"), true);
	const source = await readFile(
		join(import.meta.dirname, "..", "extensions", "observer.ts"),
		"utf8",
	);
	assert.match(source, /name: OBSERVER_TOOL_NAME/u);
	assert.match(source, /executionMode: "sequential"/u);
	assert.match(source, /pi\.on\("tool_result"/u);
	assert.match(source, /event\.toolName === OBSERVER_TOOL_NAME/u);
	assert.match(source, /action: Type\.Literal\("memo-scope"\)/u);
	assert.match(source, /parsed\.command\.kind !== "memo"/u);
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
			kind: "revise",
			memo_id: memoId,
			revision: {
				revision_id: "memo-revision-00000000-0000-4000-8000-000000000096",
				title: "Revised",
				content: "Revised content",
				evidence_ids: [evidenceId],
				reason: "New evidence",
			},
			disposition: "incubating",
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
