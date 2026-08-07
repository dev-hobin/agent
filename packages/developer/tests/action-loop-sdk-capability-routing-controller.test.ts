import assert from "node:assert/strict";
import test from "node:test";

import {
	routeStructuredCapabilityWithSdk,
	type SdkCapabilityRoutingInput,
} from "../src/action-loop/sdk/capability-routing-controller.ts";
import type { SdkDecisionRunner } from "../src/action-loop/sdk/decision-controller.ts";
import {
	bindCapability,
	type BoundCapability,
} from "../src/action-loop/routing/bind-capability.ts";
import {
	parseTocBytes,
	SKILL_TOC_SCHEMA_URI,
	type ParsedToc,
} from "../src/action-loop/routing/parse-toc.ts";
import {
	scriptedDecisionMetrics,
	scriptedSdkRunner,
} from "./fixtures/scripted-sdk-runner.ts";

const encoder = new TextEncoder();
const capabilityWhen = "A temporal state contract must be modeled.";
const capabilityUnless = "The request has no state or time behavior.";

function structuredCapability(): {
	readonly capability: BoundCapability;
	readonly toc: ParsedToc;
} {
	const parsed = parseTocBytes(
		encoder.encode(
			JSON.stringify({
				$schema: SKILL_TOC_SCHEMA_URI,
				when: [capabilityWhen],
				unless: [capabilityUnless],
				references: [
					{
						path: "references/problem-modeling.md",
						when: ["The general condition space remains unresolved."],
					},
					{
						path: "references/temporal-behavior-models.md",
						when: ["Ordering, retries, or stale events are consequential."],
					},
				],
			}),
		),
	);
	if (!parsed.ok) throw new Error(parsed.error.message);
	const bound = bindCapability(
		{
			kind: "package",
			locator: "npm:@hobin/developer",
			skillRoot: "skills/model",
		},
		parsed.value,
		encoder.encode("---\nname: model\n---\n"),
	);
	if (!bound.ok) throw new Error(bound.error.message);
	return { capability: bound.value, toc: parsed.value };
}

function routingInput(runner: SdkDecisionRunner): SdkCapabilityRoutingInput {
	const { capability, toc } = structuredCapability();
	return {
		request:
			"Model retries, stale approvals, duplicate approvals, and reordered approval events.",
		target: {
			workCaseId: "work-sdk-1",
			judgmentId: "judgment-sdk-1",
			contributionNeedId: "need-sdk-1",
			capability,
		},
		toc,
		runner,
	};
}

test("SDK routing retries rejected raw proposals before binding canonical identities", async () => {
	const result = await routeStructuredCapabilityWithSdk(
		routingInput(
			scriptedSdkRunner([
				{
					proposals: [
						{ status: "applicable", acceptance_conditions: [capabilityWhen] },
						{
							status: "applicable",
							matches_when: true,
							matches_unless: false,
							basis: "The request explicitly requires temporal state behavior.",
						},
					],
				},
				{
					proposals: [
						{
							status_0: "not-needed",
							basis_0:
								"The specialized temporal material is sufficient without a general model.",
							status_1: "selected",
							basis_1:
								"Retries, stale events, duplicates, and ordering are directly consequential.",
						},
					],
				},
			]),
		),
	);

	assert.equal(result.status, "routed");
	if (result.status !== "routed") return;
	assert.match(
		result.applicability.assignment.assignmentId,
		/^assign_[a-f0-9]{64}$/,
	);
	assert.deepEqual(result.applicability.assessment.matchedWhen, [
		capabilityWhen,
	]);
	assert.deepEqual(result.selection.selectedPaths, [
		"references/temporal-behavior-models.md",
	]);
	assert.equal(result.decisions[0]?.metrics.toolCalls, 2);
	assert.equal(result.decisions[0]?.metrics.toolErrors, 1);
	assert.equal(
		result.selection.assignmentId,
		result.applicability.assignment.assignmentId,
	);
});

test("SDK routing reports a Reference decision budget stop without partial binding", async () => {
	const result = await routeStructuredCapabilityWithSdk(
		routingInput(
			scriptedSdkRunner([
				{
					proposals: [
						{
							status: "applicable",
							matches_when: true,
							matches_unless: false,
							basis: "Temporal behavior is the unresolved Need.",
						},
					],
				},
				{ result: "bounded-stop" },
			]),
		),
	);

	assert.deepEqual(result, {
		status: "bounded-stop",
		stage: "references",
		reason: "decision-run-budget",
		decisions: [
			{
				stage: "applicability",
				metrics: scriptedDecisionMetrics({ toolCalls: 1 }),
			},
			{ stage: "references", metrics: scriptedDecisionMetrics() },
		],
	});
});

test("SDK routing preserves non-applicability as an accepted semantic outcome", async () => {
	const result = await routeStructuredCapabilityWithSdk(
		routingInput(
			scriptedSdkRunner([
				{
					proposals: [
						{
							status: "not-applicable",
							matches_when: false,
							matches_unless: false,
							basis: "No temporal state behavior is requested.",
						},
					],
				},
			]),
		),
	);

	assert.equal(result.status, "not-assigned");
	if (result.status !== "not-assigned") return;
	assert.equal(result.applicability.status, "not-applicable");
	assert.equal(result.decisions.length, 1);
});
