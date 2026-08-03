import assert from "node:assert/strict";
import test from "node:test";

import { jsonValueFromUnknown } from "@hobin/judgment";

import {
	DEVELOPER_RUNTIME_ENTRY,
	isDeveloperRuntimeStateFault,
	prepareDeveloperRuntimeBatch,
	reconstructDeveloperRuntimeBranch,
	verifyDeveloperRuntimeBranchReconstruction,
	verifyPreflightedDeveloperRuntimeBatch,
	type DeveloperRuntimeBranchEntry,
	type DeveloperRuntimeStateErrorCode,
} from "../extensions/developer-runtime-state.ts";
import { createRuntimeScopeClosure } from "../src/runtime-root.ts";
import {
	DEVELOPER_RUNTIME_PROTOCOL,
	createDeveloperEventEnvelope,
	parseDeveloperId,
} from "../src/runtime-protocol.ts";

const id = (value: string) => parseDeveloperId(value);

function hasStateFault(code: DeveloperRuntimeStateErrorCode) {
	return (error: unknown) =>
		isDeveloperRuntimeStateFault(error) && error.code === code;
}

function custom(data: unknown): DeveloperRuntimeBranchEntry {
	return { type: "custom", customType: DEVELOPER_RUNTIME_ENTRY, data };
}

function persisted(entries: readonly DeveloperRuntimeBranchEntry[]) {
	return JSON.parse(JSON.stringify(entries)) as DeveloperRuntimeBranchEntry[];
}

function openBatch(input: {
	readonly reconstruction: ReturnType<typeof reconstructDeveloperRuntimeBranch>;
	readonly suffix: string;
}) {
	return prepareDeveloperRuntimeBatch({
		reconstruction: input.reconstruction,
		workScopeId: id(`scope:branch-${input.suffix}`),
		drafts: [
			{
				eventId: id(`event:branch-${input.suffix}-open`),
				kind: id("work-scope-opened"),
				payload: {},
				occurredAt: "2033-01-01T00:00:00.000Z",
			},
		],
	});
}

test("legacy custom and tool-result entries never become runtime authority", () => {
	const legacy: DeveloperRuntimeBranchEntry = {
		type: "custom",
		customType: "developer.activation",
		data: { protocol: "legacy", kind: "activation-changed", enabled: true },
	};
	const prefix = reconstructDeveloperRuntimeBranch([legacy]);
	assert.equal(prefix.historyMode, "empty");
	assert.equal(prefix.activeScope, null);
	const batch = openBatch({ reconstruction: prefix, suffix: "legacy-ignored" });
	const active = reconstructDeveloperRuntimeBranch(
		persisted([
			legacy,
			...batch.envelopes.map(custom),
			{
				type: "message",
				message: {
					role: "toolResult",
					toolName: "developer_open_judgment",
					details: { protocol: "legacy", kind: "judgment-opened" },
				},
			},
		]),
	);
	assert.equal(active.historyMode, "v8-active");
	assert.equal(active.activeScope?.workScopeId, batch.workScopeId);
	assert.equal(active.replay.acceptedCount, 1);
	assert.equal(active.blockedReason, null);
});

test("only dedicated custom entries become v8 replay authority", () => {
	const envelope = createDeveloperEventEnvelope({
		protocolVersion: DEVELOPER_RUNTIME_PROTOCOL,
		eventId: id("event:tool-result-only"),
		workScopeId: id("scope:tool-result-only"),
		scopeSequence: 0,
		previousScopeEventSha256: null,
		causalRefs: [],
		occurredAt: "2033-01-01T00:00:00.000Z",
		kind: id("work-scope-opened"),
		payload: jsonValueFromUnknown({}),
	});
	const ignored = reconstructDeveloperRuntimeBranch([
		{
			type: "message",
			message: {
				role: "toolResult",
				toolName: "developer_open_judgment",
				details: envelope,
			},
		},
	]);
	assert.equal(ignored.historyMode, "empty");
	assert.equal(ignored.replay.acceptedCount, 0);
	const admitted = reconstructDeveloperRuntimeBranch([custom(envelope)]);
	assert.equal(admitted.historyMode, "v8-active");
	assert.equal(admitted.replay.acceptedCount, 1);
});

test("batch preflight assigns one exact scope chain and rejects an invalid suffix", () => {
	const initial = reconstructDeveloperRuntimeBranch([]);
	const opened = openBatch({ reconstruction: initial, suffix: "chain" });
	assert.equal(verifyPreflightedDeveloperRuntimeBatch(opened), opened);
	assert.equal(opened.envelopes[0]?.scopeSequence, 0);
	assert.equal(opened.envelopes[0]?.previousScopeEventSha256, null);
	const active = reconstructDeveloperRuntimeBranch(
		persisted(opened.envelopes.map(custom)),
	);
	const support = prepareDeveloperRuntimeBatch({
		reconstruction: active,
		drafts: [
			{
				eventId: id("event:branch-chain-support"),
				kind: id("support-observed"),
				payload: {
					support: {
						supportId: "support:branch-chain",
						sourceKind: "material",
						sourceId: "material:branch-chain",
						sourceRevisionSha256: "a".repeat(64),
						supportSha256: "b".repeat(64),
					},
				},
				occurredAt: "2033-01-01T00:00:01.000Z",
			},
		],
	});
	assert.equal(support.envelopes[0]?.scopeSequence, 1);
	assert.equal(
		support.envelopes[0]?.previousScopeEventSha256,
		opened.envelopes[0]?.eventSha256,
	);
	assert.throws(
		() =>
			prepareDeveloperRuntimeBatch({
				reconstruction: active,
				drafts: [
					{
						eventId: id("event:branch-chain-invalid"),
						kind: id("unknown-runtime-event"),
						payload: {},
						occurredAt: "2033-01-01T00:00:01.000Z",
					},
				],
			}),
		hasStateFault("preflight-rejected"),
	);
});

test("a persisted prefix of a preflighted batch remains valid but incomplete", () => {
	const initial = reconstructDeveloperRuntimeBranch([]);
	const batch = prepareDeveloperRuntimeBatch({
		reconstruction: initial,
		workScopeId: id("scope:branch-prefix"),
		drafts: [
			{
				eventId: id("event:branch-prefix-open"),
				kind: id("work-scope-opened"),
				payload: {},
				occurredAt: "2033-01-01T00:00:00.000Z",
			},
			{
				eventId: id("event:branch-prefix-support"),
				kind: id("support-observed"),
				payload: {
					support: {
						supportId: "support:branch-prefix",
						sourceKind: "material",
						sourceId: "material:branch-prefix",
						sourceRevisionSha256: "c".repeat(64),
						supportSha256: "d".repeat(64),
					},
				},
				occurredAt: "2033-01-01T00:00:01.000Z",
			},
		],
	});
	const prefix = reconstructDeveloperRuntimeBranch(
		persisted([custom(batch.envelopes[0])]),
	);
	assert.equal(prefix.historyMode, "v8-active");
	assert.equal(prefix.replay.acceptedCount, 1);
	assert.equal(prefix.replay.rejectedCount, 0);
	assert.equal(prefix.projection.receiptCount, 1);
});

test("closed scopes can be followed by a new scope and clones carry no authority", () => {
	const initial = reconstructDeveloperRuntimeBranch([]);
	const opened = openBatch({ reconstruction: initial, suffix: "close" });
	const active = reconstructDeveloperRuntimeBranch(
		persisted(opened.envelopes.map(custom)),
	);
	const closedBatch = prepareDeveloperRuntimeBatch({
		reconstruction: active,
		drafts: [
			{
				eventId: id("event:branch-close"),
				kind: id("work-scope-closed"),
				payload: {
					closure: createRuntimeScopeClosure({
						reason: "Close the first adapter scope.",
					}),
				},
				occurredAt: "2033-01-01T00:00:01.000Z",
			},
		],
	});
	const closed = reconstructDeveloperRuntimeBranch(
		persisted([
			...opened.envelopes.map(custom),
			...closedBatch.envelopes.map(custom),
		]),
	);
	assert.equal(closed.historyMode, "v8-closed");
	const reopened = openBatch({ reconstruction: closed, suffix: "reopened" });
	assert.notEqual(reopened.workScopeId, opened.workScopeId);
	assert.throws(
		() => verifyDeveloperRuntimeBranchReconstruction(structuredClone(closed)),
		hasStateFault("invalid-reconstruction"),
	);
	assert.throws(
		() => verifyPreflightedDeveloperRuntimeBatch(structuredClone(reopened)),
		hasStateFault("invalid-preflight"),
	);
});

test("malformed runtime entries and multiple open adapter scopes block writes", () => {
	const malformed = reconstructDeveloperRuntimeBranch([
		custom({ protocolVersion: "developer/v8", kind: "work-scope-opened" }),
	]);
	assert.equal(malformed.historyMode, "blocked");
	const first = openBatch({
		reconstruction: reconstructDeveloperRuntimeBranch([]),
		suffix: "ambiguous-a",
	});
	const second = openBatch({
		reconstruction: reconstructDeveloperRuntimeBranch([]),
		suffix: "ambiguous-b",
	});
	const ambiguous = reconstructDeveloperRuntimeBranch(
		persisted([
			...first.envelopes.map(custom),
			...second.envelopes.map(custom),
		]),
	);
	assert.equal(ambiguous.historyMode, "blocked");
	assert.match(ambiguous.blockedReason ?? "", /multiple open/u);
});
