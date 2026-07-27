import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { SessionManager } from "@earendil-works/pi-coding-agent";

import observerExtension, {
	routeMemoCommand,
	textFromContent,
} from "../extensions/observer.ts";
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
