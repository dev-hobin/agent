import assertModule from "node:assert";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
	assertAgentBeforeImplementationResolution,
	validateExecutionTrace,
} from "../scripts/eval-assertions.mjs";

const assert: typeof assertModule.strict = assertModule.strict;
const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const fixture = {
	id: "agent-gate",
	requiresJudgmentBashEvidence: true,
};

const trace = [
	{
		toolName: "developer_record_judgment",
		args: {
			status: "needs-evidence",
			open_questions: [
				{ resolution_owner: "agent", gate: "before-implementation" },
			],
		},
	},
	{ toolName: "developer_route_question", args: { target: "signal" } },
	{ toolName: "bash", args: { command: "test -f src/contracts.ts" } },
	{
		toolName: "developer_record_judgment",
		args: {
			question_updates: [{ question_id: "question:1", status: "resolved" }],
		},
	},
	{ toolName: "developer_route_question", args: { target: "implementation" } },
];

test("agent before-implementation trace requires evidence routing, bash, explicit resolution, then implementation", () => {
	assert.doesNotThrow(() =>
		assertAgentBeforeImplementationResolution(fixture, trace),
	);
	assert.throws(
		() =>
			assertAgentBeforeImplementationResolution(
				fixture,
				trace.filter((event) => event.toolName !== "bash"),
			),
		/did not run bash/,
	);
	assert.throws(
		() =>
			assertAgentBeforeImplementationResolution(fixture, trace.slice(0, -1)),
		/no implementation route followed/,
	);
});

const implementationTrace = [
	{
		type: "tool_execution_start",
		toolCallId: "route:1",
		toolName: "developer_route_question",
		args: { target: "implementation" },
	},
	{
		type: "tool_execution_end",
		toolCallId: "route:1",
		toolName: "developer_route_question",
		isError: false,
		result: { content: [{ type: "text", text: "implementation route" }] },
	},
	{
		type: "tool_execution_start",
		toolCallId: "judgment:1",
		toolName: "developer_record_judgment",
		args: {
			status: "resolved",
			result: "Marker change reached a stable landing.",
		},
	},
	{
		type: "tool_execution_end",
		toolCallId: "judgment:1",
		toolName: "developer_record_judgment",
		isError: false,
		result: { content: [{ type: "text", text: "recorded" }] },
	},
];

const structuralFixture = {
	id: "structural",
	admissibleFirstTargets: ["implementation"],
	preferredFirstTargets: ["signal"],
	requiredJudgmentTerms: ["Marker", "stable landing"],
	requiredJudgmentConcepts: [["change", "movement"]],
	mustRecordJudgment: true,
};

test("reference expectations require a successful auditable load and applied judgment basis", async () => {
	const source = await readFile(
		join(packageRoot, "skills", "sketch", "SKILL.md"),
		"utf8",
	);
	const body = source.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "").trim();
	const events = [
		{
			type: "tool_execution_start",
			toolCallId: "route:reference",
			toolName: "developer_route_question",
			args: { target: "sketch" },
		},
		{
			type: "tool_execution_end",
			toolCallId: "route:reference",
			toolName: "developer_route_question",
			isError: false,
			result: {
				content: [
					{
						type: "text",
						text: `<developer-method name="sketch" location="/skills/sketch/SKILL.md" base-dir="/skills/sketch">\n${body}\n</developer-method>\nResolve relative references from /skills/sketch.`,
					},
				],
			},
		},
		{
			type: "tool_execution_start",
			toolCallId: "reference:1",
			toolName: "developer_load_reference",
			args: {
				reference_route: "data-driven-design",
				path: "references/data-driven-design.md",
			},
		},
		{
			type: "tool_execution_end",
			toolCallId: "reference:1",
			toolName: "developer_load_reference",
			isError: false,
			result: { content: [{ type: "text", text: "loaded" }] },
		},
		{
			type: "tool_execution_start",
			toolCallId: "judgment:reference",
			toolName: "developer_record_judgment",
			args: {
				status: "resolved",
				result: "The data clauses derive the template.",
				reference_basis: [
					{
						path: "references/data-driven-design.md",
						trigger: "The variants determine branches.",
						applied_rule: "One clause produces one branch.",
						artifact: "A case-derived template.",
					},
				],
			},
		},
		{
			type: "tool_execution_end",
			toolCallId: "judgment:reference",
			toolName: "developer_record_judgment",
			isError: false,
			result: { content: [{ type: "text", text: "recorded" }] },
		},
	];
	const referenceFixture = {
		id: "reference-contract",
		admissibleFirstTargets: ["sketch"],
		preferredFirstTargets: ["sketch"],
		mustRecordJudgment: true,
		expectedReferenceRoutes: ["data-driven-design"],
		expectedReferenceReads: ["skills/sketch/references/data-driven-design.md"],
	};

	await assert.doesNotReject(
		validateExecutionTrace(referenceFixture, events, packageRoot),
	);
	const withoutApplication = structuredClone(events);
	const judgmentStart = withoutApplication.find(
		(event) =>
			event.toolCallId === "judgment:reference" &&
			event.type === "tool_execution_start",
	);
	assert.ok(judgmentStart);
	assert.ok(judgmentStart.args);
	assert.ok("reference_basis" in judgmentStart.args);
	judgmentStart.args.reference_basis = [];
	await assert.rejects(
		validateExecutionTrace(referenceFixture, withoutApplication, packageRoot),
		/judgment did not apply loaded reference/,
	);
	const withoutRouteSelection = structuredClone(events);
	const routeLoadStart = withoutRouteSelection.find(
		(event) =>
			event.toolCallId === "reference:1" &&
			event.type === "tool_execution_start",
	);
	assert.ok(routeLoadStart?.args);
	delete routeLoadStart.args.reference_route;
	await assert.rejects(
		validateExecutionTrace(
			referenceFixture,
			withoutRouteSelection,
			packageRoot,
		),
		/did not select policy route/,
	);
	const failedLoad = structuredClone(events);
	const referenceEnd = failedLoad.find(
		(event) =>
			event.toolCallId === "reference:1" && event.type === "tool_execution_end",
	);
	assert.ok(referenceEnd && "isError" in referenceEnd);
	referenceEnd.isError = true;
	await assert.rejects(
		validateExecutionTrace(referenceFixture, failedLoad, packageRoot),
		/reference route selection failed/,
	);
});

test("structural admissibility is hard while preferred routing remains a score", async () => {
	const summary = await validateExecutionTrace(
		structuralFixture,
		implementationTrace,
		".",
	);
	assert.deepEqual(summary, {
		firstTarget: "implementation",
		preferredFirstTarget: false,
		routeCount: 1,
		toolCallCount: 2,
	});

	await assert.rejects(
		validateExecutionTrace(
			{ ...structuralFixture, admissibleFirstTargets: ["signal"] },
			implementationTrace,
			".",
		),
		/structurally inadmissible first route/,
	);
	await assert.rejects(
		validateExecutionTrace(
			{
				...structuralFixture,
				requiredJudgmentTerms: ["unrelated-required-term"],
			},
			implementationTrace,
			".",
		),
		/omitted required semantic term/,
	);
	await assert.rejects(
		validateExecutionTrace(
			{
				...structuralFixture,
				requiredJudgmentConcepts: [["unrelated", "irrelevant"]],
			},
			implementationTrace,
			".",
		),
		/omitted required semantic concept/,
	);
});
