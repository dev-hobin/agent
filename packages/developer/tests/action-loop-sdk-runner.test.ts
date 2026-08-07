import assert from "node:assert/strict";
import test from "node:test";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

import { createPiExtensionSdkRunner } from "../extensions/action-loop-sdk-runner.ts";

test("Pi Extension SDK runner requires the host's active model", () => {
	const result = createPiExtensionSdkRunner({
		cwd: process.cwd(),
		model: undefined,
	});

	assert.deepEqual(result, {
		status: "unavailable",
		reason: "no-active-model",
	});
});

test("Pi Extension SDK runner preserves a pre-aborted host stop without opening a nested session", async () => {
	const controller = new AbortController();
	controller.abort();
	const prepared = createPiExtensionSdkRunner(
		{
			cwd: process.cwd(),
			model: {} as NonNullable<ExtensionContext["model"]>,
		},
		{ signal: controller.signal, maxRuns: 1, maxRunMs: 1_000 },
	);
	assert.equal(prepared.status, "ready");
	if (prepared.status !== "ready") return;

	const result = await prepared.runner.run({
		systemPrompt: "Submit one proposal.",
		prompt: "Submit accepted true.",
		tool: {
			name: "submit_extension_abort_probe",
			label: "Submit Extension abort probe",
			description: "Submit one Extension abort probe.",
			parameters: Type.Object(
				{ accepted: Type.Boolean() },
				{ additionalProperties: false },
			),
			execute: async () => ({
				status: "accepted",
				value: true,
				message: "accepted",
				resultStatus: "accepted",
			}),
		},
	});

	assert.equal(result.status, "bounded-stop");
	if (result.status !== "bounded-stop") return;
	assert.equal(result.reason, "host-abort");
	assert.equal(result.metrics.runtimeFailures, 0);
});
