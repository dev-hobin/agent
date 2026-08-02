import assert from "node:assert/strict";
import test from "node:test";

import {
	decodeContextInventoryData,
	jsonValueFromUnknown,
	parseContextInventory,
} from "../src/index.ts";
import { ContextAttempt } from "../extensions/context-attempt.ts";
import { resolveObservedContext } from "../extensions/observed-context.ts";

const question = {
	judgmentId: "judgment-adapter",
	owner: {
		kind: "pi-skill",
		namespace: "test",
		name: "verify",
		provenance: {
			source: "test",
			scope: "temporary",
			origin: "top-level",
			path: "/tmp/SKILL.md",
		},
	},
	question: "What does the active branch result support?",
	basisMaterialIds: [],
	branchRef: "open-call",
};
const branch = [
	{
		type: "message",
		message: {
			role: "assistant",
			content: [
				{
					type: "toolCall",
					id: "call-1",
					name: "read",
					arguments: { path: "a.ts" },
				},
			],
		},
	},
	{
		type: "message",
		message: {
			role: "toolResult",
			toolCallId: "call-1",
			toolName: "read",
			isError: false,
			content: [{ type: "text", text: "exact source" }],
		},
	},
];

test("active-branch resolver preserves exact call/result identity and rejects absent calls", () => {
	const resolved = resolveObservedContext({
		branchRef: "open-call",
		branch,
		toolNominations: [{ toolCallId: "call-1" }],
		userDecisionNominations: [],
	});
	assert.equal(resolved.observedContext.entries[0]?.kind, "read-result");
	assert.throws(
		() =>
			resolveObservedContext({
				branchRef: "open-call",
				branch: [],
				toolNominations: [{ toolCallId: "call-1" }],
				userDecisionNominations: [],
			}),
		/not present on the active branch/u,
	);
});

test("selection and sealing commit atomically after successful acquisition only", async () => {
	const opened = ContextAttempt.open({
		question: jsonValueFromUnknown(question),
	});
	assert.equal(opened.value.state.status, "started");
	assert.deepEqual(
		opened.records.map((record) => record.event.kind),
		["attempt-opened"],
	);
	const applicability = opened.value.recordApplicability(
		jsonValueFromUnknown({
			kind: "applicable",
			basis: ["The active result constrains the judgment."],
		}),
	);
	assert.equal(applicability.value.status, "selection-open");
	const inventory = parseContextInventory(
		decodeContextInventoryData(
			jsonValueFromUnknown({ sources: [], capabilities: [] }),
		),
	);
	const resolved = resolveObservedContext({
		branchRef: "open-call",
		branch,
		toolNominations: [{ toolCallId: "call-1" }],
		userDecisionNominations: [],
	});
	const entry = resolved.observedContext.entries[0];
	assert.ok(entry);
	const proposal = jsonValueFromUnknown({
		questionSha256: opened.value.state.question.questionSha256,
		nominations: [
			{
				kind: "observed-context",
				observedContextId: entry.id,
				descriptorSha256: entry.descriptorSha256,
			},
		],
		selectionBasis: ["Exact source content is material."],
	});
	await assert.rejects(
		opened.value.selectAndSeal({
			inventory,
			observedContext: resolved.observedContext,
			proposal,
			observedNominations: [{ kind: "tool-result", toolCallId: "call-1" }],
			acquisition: {
				localReferenceReader: {
					async read() {
						return "unused";
					},
				},
				async acquireObservedContext() {
					throw new Error("acquisition failed");
				},
			},
		}),
		/atomic result|acquisition failed/u,
	);
	assert.equal(opened.value.state.status, "selection-open");
	const committed = await opened.value.selectAndSeal({
		inventory,
		observedContext: resolved.observedContext,
		proposal,
		observedNominations: [{ kind: "tool-result", toolCallId: "call-1" }],
		acquisition: {
			localReferenceReader: {
				async read() {
					return "unused";
				},
			},
			acquireObservedContext: resolved.acquireObservedContext,
		},
	});
	assert.equal(committed.value.status, "sealed");
	assert.deepEqual(
		committed.records.map((record) => record.event.kind),
		["selection-recorded", "sealed-context-recorded"],
	);
});
