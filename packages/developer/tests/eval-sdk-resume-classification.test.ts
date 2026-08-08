import assert from "node:assert/strict";
import test from "node:test";

import {
	classifySdkResumeRun,
	repeatedPrimaryResultWithoutCheckpoint,
	sdkResumeBudgetStop,
	summarizeSdkResumeRun,
} from "../scripts/sdk-resume-classification.mjs";

const wait = { status: "settled", elapsedMs: 20 };

function toolResult(text: string, details?: Record<string, unknown>) {
	return {
		content: [{ type: "text", text }],
		...(details ? { details } : {}),
	};
}

test("SDK resume evaluation classifies an outer agent runtime error as provider-blocked", () => {
	const run = summarizeSdkResumeRun(
		1,
		[
			{
				type: "message_end",
				message: {
					role: "assistant",
					stopReason: "error",
					errorMessage: "Codex error: usage limit reached",
				},
			},
		],
		wait,
	);
	assert.deepEqual(classifySdkResumeRun(run), {
		status: "provider-blocked",
		reason: "Codex error: usage limit reached",
	});
});

test("SDK resume evaluation prioritizes deterministic replay recovery over provider timeout", () => {
	const run = summarizeSdkResumeRun(
		1,
		[
			{
				type: "tool_execution_start",
				toolName: "developer_progress_action_loop",
			},
			{
				type: "tool_execution_end",
				toolName: "developer_progress_action_loop",
				isError: true,
				result: toolResult(
					"Developer Action Loop session replay is unavailable: persisted Conclusion does not reproduce.",
				),
			},
			{
				type: "message_end",
				message: {
					role: "assistant",
					stopReason: "error",
					errorMessage: "Request timed out.",
				},
			},
		],
		wait,
	);
	const classification = classifySdkResumeRun(run);
	assert.equal(classification.status, "recovery-required");
	assert.match(classification.reason, /session replay is unavailable/);
});

test("SDK resume evaluation compacts repeated flattened provider arguments", () => {
	const validation = [
		'Validation failed for tool "developer_accept_observation_contribution":',
		"  - limitations: must have required properties limitations",
		"",
		"Received arguments:",
		'{"limitations[0]":"not yet observed","basis[0]":"current prompt"}',
	].join("\n");
	const trace = [
		...Array.from({ length: 3 }, () => ({
			type: "tool_execution_start",
			toolName: "developer_accept_observation_contribution",
		})),
		...Array.from({ length: 3 }, () => ({
			type: "tool_execution_end",
			toolName: "developer_accept_observation_contribution",
			isError: true,
			result: toolResult(validation),
		})),
	];
	const run = summarizeSdkResumeRun(1, trace, wait);
	assert.equal(run.toolErrors.length, 1);
	assert.deepEqual(run.toolErrors[0], {
		toolName: "developer_accept_observation_contribution",
		text: [
			'Validation failed for tool "developer_accept_observation_contribution":',
			"  - limitations: must have required properties limitations",
		].join("\n"),
		count: 3,
		flattenedArguments: true,
	});
	const classification = classifySdkResumeRun(run);
	assert.equal(classification.status, "provider-blocked");
	assert.match(classification.reason, /\(3\)/);
	assert.doesNotMatch(classification.reason, /Received arguments/);
});

test("SDK resume evaluation separates generic tool rejection from provider serialization", () => {
	const run = summarizeSdkResumeRun(
		1,
		[
			{
				type: "tool_execution_start",
				toolName: "developer_accept_observation_contribution",
			},
			{
				type: "tool_execution_end",
				toolName: "developer_accept_observation_contribution",
				isError: true,
				result: toolResult("Validation failed: missing required field"),
			},
		],
		wait,
	);
	assert.deepEqual(classifySdkResumeRun(run), {
		status: "usability-stalled",
		reason: "tool-contract-rejected",
	});
});

test("SDK resume evaluation circuit-breaks repeated primary results without checkpoints", () => {
	const protocolResult = (status: string) => ({
		type: "tool_execution_end",
		toolName: "developer_progress_action_loop",
		isError: false,
		result: toolResult("No advancement.", { status }),
	});
	const repeated = Array.from({ length: 8 }, () =>
		protocolResult("effect-unsettled"),
	);
	assert.equal(
		repeatedPrimaryResultWithoutCheckpoint(repeated),
		"effect-unsettled",
	);
	assert.equal(
		repeatedPrimaryResultWithoutCheckpoint([
			...repeated.slice(0, 7),
			{
				type: "entry_appended",
				entry: { data: { kind: "effect-observed" } },
			},
			...repeated.slice(0, 7),
		]),
		undefined,
	);
	const run = summarizeSdkResumeRun(1, repeated, {
		status: "usability-stalled",
		reason: "repeated-primary-result:effect-unsettled",
		elapsedMs: 100,
	});
	assert.deepEqual(classifySdkResumeRun(run), {
		status: "usability-stalled",
		reason: "repeated-primary-result:effect-unsettled",
	});
	assert.equal(
		sdkResumeBudgetStop([run], 1),
		"evaluation-run-budget-exhausted",
	);
	assert.equal(
		sdkResumeBudgetStop(
			[
				{
					...run,
					protocolEnds: [{ isError: false, details: { status: "completed" } }],
				},
			],
			1,
		),
		undefined,
	);
});

test("SDK resume evaluation continues only after the primary controller is invoked", () => {
	const primary = summarizeSdkResumeRun(
		2,
		[
			{
				type: "tool_execution_start",
				toolName: "developer_progress_action_loop",
			},
			{
				type: "entry_appended",
				entry: { data: { kind: "coverage-assessed" } },
			},
			{
				type: "tool_execution_end",
				toolName: "developer_progress_action_loop",
				isError: false,
				result: toolResult("Checkpointed.", { status: "bounded-stop" }),
			},
		],
		wait,
	);
	assert.deepEqual(classifySdkResumeRun(primary), { status: "continue" });
	assert.deepEqual(primary.checkpointKinds, ["coverage-assessed"]);
	assert.equal(primary.protocolEnds[0]?.details.status, "bounded-stop");

	const absent = summarizeSdkResumeRun(3, [], wait);
	assert.deepEqual(classifySdkResumeRun(absent), {
		status: "usability-stalled",
		reason: "primary-controller-not-invoked",
	});
});
