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
const OPEN = "developer_open_judgment";
const CONCLUDE = "developer_conclude_judgment";
const AUTHORIZE = "developer_authorize_change";
const LANDING = "developer_record_landing";

const fixture = {
	id: "agent-gate",
	requiresJudgmentBashEvidence: true,
};

const gateTrace = [
	{
		toolName: CONCLUDE,
		args: {
			opened_questions: [
				{ resolution_owner: "agent", gate: "before-implementation" },
			],
		},
	},
	{ toolName: OPEN, args: { skill_name: "signal" } },
	{ toolName: "bash", args: { command: "test -f src/contracts.ts" } },
	{
		toolName: CONCLUDE,
		args: {
			question_updates: [{ question_id: "question:1", status: "resolved" }],
		},
	},
	{ toolName: AUTHORIZE, args: { movement: "Add the marker." } },
];

test("agent before-implementation trace requires evidence judgment, bash, explicit resolution, then authorization", () => {
	assert.doesNotThrow(() =>
		assertAgentBeforeImplementationResolution(fixture, gateTrace),
	);
	assert.throws(
		() =>
			assertAgentBeforeImplementationResolution(
				fixture,
				gateTrace.filter((event) => event.toolName !== "bash"),
			),
		/did not run bash/iu,
	);
	assert.throws(
		() =>
			assertAgentBeforeImplementationResolution(
				fixture,
				gateTrace.slice(0, -1),
			),
		/no change authorization followed/iu,
	);
});

const implementationTrace = [
	{
		type: "tool_execution_start",
		toolCallId: "change:1",
		toolName: AUTHORIZE,
		args: {
			movement: "Apply one bounded marker change.",
			stable_landing: "Marker change reached a stable landing.",
			verification_target: "Run the focused check.",
		},
	},
	{
		type: "tool_execution_end",
		toolCallId: "change:1",
		toolName: AUTHORIZE,
		isError: false,
		result: { content: [{ type: "text", text: "authorized" }] },
	},
	{
		type: "tool_execution_start",
		toolCallId: "landing:1",
		toolName: LANDING,
		args: {
			authorization_id: "change:1",
			changed_paths: ["src/file.ts"],
			result: "Marker change reached a stable landing.",
			verification: [],
		},
	},
	{
		type: "tool_execution_end",
		toolCallId: "landing:1",
		toolName: LANDING,
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
	mustRecordLanding: true,
};

function completed(
	toolCallId: string,
	toolName: string,
	args: Record<string, unknown>,
	text = "ok",
) {
	return [
		{ type: "tool_execution_start", toolCallId, toolName, args },
		{
			type: "tool_execution_end",
			toolCallId,
			toolName,
			isError: false,
			result: { content: [{ type: "text", text }] },
		},
	];
}

async function methodText(name: string) {
	const source = await readFile(
		join(packageRoot, "skills", name, "SKILL.md"),
		"utf8",
	);
	const body = source.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "").trim();
	return `<developer-method name="${name}" location="/skills/${name}/SKILL.md" base-dir="/skills/${name}">\n${body}\n</developer-method>\nNominate only acquired current-branch context. Prepared references exist only when this method includes generated Context Directions.`;
}

test("context expectations require a selected prepared reference and cited contribution", async () => {
	const sketchMethod = await methodText("sketch");
	const events = [
		...completed(
			"open:reference",
			OPEN,
			{ skill_name: "sketch" },
			sketchMethod,
		),
		...completed("conclude:reference", CONCLUDE, {
			nominations: [
				{
					nominationId: "data-guidance",
					kind: "inventory-source",
					provenancePath: "/skills/sketch/references/data-driven-design.md",
				},
			],
			coverage: {
				contributions: [
					{
						nominationId: "data-guidance",
						useAs: "guidance",
					},
				],
			},
			outcome: {
				kind: "contextual-judgment",
				citedUses: [{ contributionIndex: 0 }],
				artifact: "The data clauses derive the template.",
			},
		}),
	];
	const contextFixture = {
		id: "context-contract",
		admissibleFirstTargets: ["sketch"],
		preferredFirstTargets: ["sketch"],
		mustRecordJudgment: true,
		expectedPreparedReferences: [
			"skills/sketch/references/data-driven-design.md",
		],
	};

	await assert.doesNotReject(
		validateExecutionTrace(contextFixture, events, packageRoot),
	);
	const withoutCitation = structuredClone(events);
	const conclusion = withoutCitation.find(
		(event) =>
			event.toolCallId === "conclude:reference" &&
			event.type === "tool_execution_start",
	);
	const outcome = conclusion?.args?.outcome;
	assert.ok(outcome && typeof outcome === "object");
	Reflect.set(outcome, "citedUses", []);
	await assert.rejects(
		validateExecutionTrace(contextFixture, withoutCitation, packageRoot),
		/did not select and cite prepared reference/iu,
	);
	const failedConclusion = structuredClone(events);
	const ending = failedConclusion.find(
		(event) =>
			event.toolCallId === "conclude:reference" &&
			event.type === "tool_execution_end",
	);
	assert.ok(ending && "isError" in ending);
	ending.isError = true;
	await assert.rejects(
		validateExecutionTrace(contextFixture, failedConclusion, packageRoot),
		/developer_conclude_judgment failed/iu,
	);
});

test("Doctor evaluation requires owner consultation and a final synthesis judgment", async () => {
	const doctorMethod = await methodText("doctor");
	const sketchMethod = await methodText("sketch");
	const events = [
		...completed("open:triage", OPEN, { skill_name: "doctor" }, doctorMethod),
		...completed("conclude:triage", CONCLUDE, {
			outcome: {
				kind: "needs-evidence",
				artifact: "Consultation plan remains open.",
			},
		}),
		...completed("open:owner", OPEN, { skill_name: "sketch" }, sketchMethod),
		...completed("conclude:owner", CONCLUDE, {
			outcome: {
				kind: "contextual-judgment",
				artifact: "The boundary owner is explicit.",
			},
		}),
		...completed(
			"open:synthesis",
			OPEN,
			{ skill_name: "doctor" },
			doctorMethod,
		),
		...completed("conclude:synthesis", CONCLUDE, {
			outcome: {
				kind: "contextual-judgment",
				artifact:
					"Consultation ledger integrated. Diagnosis is bounded. Treatment plan leaves speculative work alone.",
			},
		}),
	];
	const doctorFixture = {
		id: "doctor-synthesis",
		admissibleFirstTargets: ["doctor"],
		preferredFirstTargets: ["doctor"],
		mustRecordJudgment: true,
		requiresDoctorSynthesis: true,
	};

	await assert.doesNotReject(
		validateExecutionTrace(doctorFixture, events, packageRoot),
	);
	await assert.rejects(
		validateExecutionTrace(doctorFixture, events.slice(0, -4), packageRoot),
		/Doctor did not return for final synthesis|final judgment opening was not Doctor synthesis/iu,
	);
});

test("structural admissibility is hard while preferred selection remains a score", async () => {
	const summary = await validateExecutionTrace(
		structuralFixture,
		implementationTrace,
		".",
	);
	assert.deepEqual(summary, {
		firstTarget: "implementation",
		preferredFirstTarget: false,
		decisionCount: 1,
		toolCallCount: 2,
	});

	await assert.rejects(
		validateExecutionTrace(
			{ ...structuralFixture, admissibleFirstTargets: ["signal"] },
			implementationTrace,
			".",
		),
		/structurally inadmissible first target/iu,
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
		/omitted required semantic term/iu,
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
		/omitted required semantic concept/iu,
	);
});
