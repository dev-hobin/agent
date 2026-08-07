import assert from "node:assert/strict";
import test from "node:test";

import { sdkActionClearedEvent } from "../extensions/action-loop-sdk-session.ts";
import {
	ACTION_LOOP_SESSION_ENTRY,
	extractReplayEvent,
} from "../extensions/action-loop-session-event.ts";
import type { JudgmentConclusion } from "../src/action-loop/judgment/close-judgment.ts";
import {
	clearActionWithHostPermission,
	proposeActionWithSdk,
	type SdkControlledActionAdapter,
} from "../src/action-loop/sdk/action-controller.ts";
import { scriptedSdkRunner } from "./fixtures/scripted-sdk-runner.ts";

const conclusion: JudgmentConclusion = Object.freeze({
	conclusionId: "conclusion-sdk-action",
	workCaseId: "work-sdk-action",
	judgmentId: "judgment-sdk-action",
	category: "Proportionate Intervention",
	subject: "The smallest warranted change",
	contextRevisionId: "context-sdk-action",
	requirementDispositions: Object.freeze([]),
	coverageIds: Object.freeze([]),
	basis: Object.freeze(["The bounded implementation change is warranted."]),
	provenance: Object.freeze({ kind: "model", source: "sdk:test" }),
	answer: "Write only the exact bounded target file.",
});

const writeAction: SdkControlledActionAdapter = {
	name: "write",
	description: "Write exact content to one target file.",
	bind(input) {
		if (typeof input.path !== "string" || typeof input.content !== "string") {
			return {
				status: "invalid",
				message: "write requires exact path and content strings.",
			};
		}
		const canonicalInput = JSON.stringify({
			content: input.content,
			path: input.path,
		});
		return {
			status: "bound",
			value: {
				controlledAction: {
					kind: "pi-tool-call:write",
					fingerprint: "b".repeat(64),
				},
				canonicalInput,
			},
		};
	},
};

test("SDK Action proposal cannot grant its own host permission", async () => {
	const result = await proposeActionWithSdk({
		request: "Write the accepted bounded configuration.",
		workCaseId: conclusion.workCaseId,
		conclusions: [conclusion],
		actions: [writeAction],
		runner: scriptedSdkRunner([
			{
				proposals: [
					{
						tool_name: "write",
						tool_input_json:
							'{"path":"config.json","content":"{\\n  \\"enabled\\": true\\n}\\n"}',
						summary: "Write the accepted bounded configuration.",
						intended_effects_json:
							'["config.json contains the accepted enabled value."]',
						requires_conclusion_0: false,
					},
					{
						tool_name: "write",
						tool_input_json:
							'{"path":"config.json","content":"{\\n  \\"enabled\\": true\\n}\\n"}',
						summary: "Write the accepted bounded configuration.",
						intended_effects_json:
							'["config.json contains the accepted enabled value."]',
						requires_conclusion_0: true,
					},
				],
			},
		]),
	});
	assert.equal(result.status, "accepted");
	if (result.status !== "accepted") return;
	assert.equal(result.toolName, "write");
	assert.deepEqual(result.toolInput, {
		path: "config.json",
		content: '{\n  "enabled": true\n}\n',
	});
	assert.deepEqual(result.candidate.requiredConclusionIds, [
		conclusion.conclusionId,
	]);
	assert.equal(result.decision.toolCalls, 2);
	assert.equal(result.decision.toolErrors, 1);
	assert.equal("permission" in result.candidate, false);
	assert.equal("clearance" in result, false);

	const unknown = clearActionWithHostPermission({
		candidate: result.candidate,
		conclusions: [conclusion],
		permission: {
			actionCandidateId: result.candidate.actionCandidateId,
			status: "unknown",
			source: "pi:host-permission",
			basis: ["The host has not granted this exact Action."],
		},
	});
	assert.equal(unknown.status, "not-cleared");

	const cleared = clearActionWithHostPermission({
		candidate: result.candidate,
		conclusions: [conclusion],
		permission: {
			actionCandidateId: result.candidate.actionCandidateId,
			status: "granted",
			source: "pi:host-permission",
			basis: ["The current host delegation grants this exact write input."],
		},
	});
	assert.equal(cleared.status, "cleared");
	if (cleared.status !== "cleared") return;
	assert.equal(
		cleared.clearance.controlledAction.fingerprint,
		result.candidate.controlledAction.fingerprint,
	);
	const event = sdkActionClearedEvent({
		action: result,
		clearance: cleared,
		revisionId: "revision-after-clearance",
	});
	assert.equal(event.kind, "action-cleared");
	assert.equal(event.permission?.source, "pi:host-permission");
	assert.equal(
		extractReplayEvent({
			type: "custom",
			customType: ACTION_LOOP_SESSION_ENTRY,
			data: event,
		}).status,
		"event",
	);
});

test("SDK Action proposal fails before a model session without Conclusions or adapters", async () => {
	const missingConclusions = await proposeActionWithSdk({
		request: "Write a file.",
		workCaseId: "work-sdk-action",
		conclusions: [],
		actions: [writeAction],
		runner: scriptedSdkRunner([]),
	});
	assert.equal(missingConclusions.status, "invariant-failure");

	const missingActions = await proposeActionWithSdk({
		request: "Write a file.",
		workCaseId: "work-sdk-action",
		conclusions: [conclusion],
		actions: [],
		runner: scriptedSdkRunner([]),
	});
	assert.equal(missingActions.status, "invariant-failure");
});
