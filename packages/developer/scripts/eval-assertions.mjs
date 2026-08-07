import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const LEGACY_TOOLS = new Set([
	"developer_route_question",
	"developer_load_reference",
	"developer_record_judgment",
]);
const CONTROLLED_TOOLS = new Set(["bash", "edit", "write"]);
const OPEN_WORK_CASE_TOOL = "developer_open_work_case";
const OPEN_JUDGMENT_TOOL = "developer_open_judgment";
const ASSESS_CAPABILITY_TOOL = "developer_assess_capability";
const LOAD_REFERENCE_TOOL = "developer_load_selected_reference";
const ACCEPT_HOST_CONTRIBUTION_TOOL =
	"developer_accept_observation_contribution";
const ACTION_TOOL = "developer_propose_action";
const SETTLE_EFFECT_TOOL = "developer_settle_effect";
const COMPLETE_TOOL = "developer_complete_work_case";

function resultText(event) {
	const content = event?.result?.content;
	if (!Array.isArray(content)) return "";
	return content
		.filter((item) => item && item.type === "text")
		.map((item) => item.text)
		.join("\n");
}

function canonicalJson(value) {
	if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
	if (value && typeof value === "object") {
		return `{${Object.entries(value)
			.sort(([left], [right]) => left.localeCompare(right))
			.map(([key, nested]) => `${JSON.stringify(key)}:${canonicalJson(nested)}`)
			.join(",")}}`;
	}
	return JSON.stringify(value);
}

function successfulExecutions(events) {
	const endings = new Map(
		events
			.filter((event) => event.type === "tool_execution_end")
			.map((event) => [event.toolCallId, event]),
	);
	return events
		.filter((event) => event.type === "tool_execution_start")
		.map((start) => ({ start, end: endings.get(start.toolCallId) }))
		.filter(({ end }) => end && end.isError === false);
}

function canonicalTraceText(executions) {
	return executions
		.map(({ start, end }) =>
			[
				start.toolName,
				canonicalJson(start.args),
				canonicalJson(end?.result?.details),
				resultText(end),
			].join("\n"),
		)
		.join("\n")
		.toLocaleLowerCase();
}

export function assertObservedEvidenceBeforeMutation(fixture, executions) {
	const bashIndex = executions.findIndex(
		({ start }) => start.toolName === "bash",
	);
	assert.ok(
		bashIndex >= 0,
		`${fixture.id}: no bounded bash evidence Action ran`,
	);
	const contributionIndex = executions.findIndex(
		({ start }, index) =>
			index > bashIndex && start.toolName === ACCEPT_HOST_CONTRIBUTION_TOOL,
	);
	assert.ok(
		contributionIndex > bashIndex,
		`${fixture.id}: finalized bash evidence was not admitted as a host Contribution`,
	);
	assert.ok(
		executions
			.slice(contributionIndex + 1)
			.some(
				({ start }) =>
					start.toolName === ACTION_TOOL &&
					["edit", "write"].includes(start.args?.tool_name),
			),
		`${fixture.id}: no mutation Action followed the admitted evidence`,
	);
}

function assertControlledActions(fixture, executions) {
	for (const [index, execution] of executions.entries()) {
		if (!CONTROLLED_TOOLS.has(execution.start.toolName)) continue;
		const expectedInput = canonicalJson(execution.start.args);
		const actionIndex = executions
			.slice(0, index)
			.findLastIndex(
				({ start }) =>
					start.toolName === ACTION_TOOL &&
					start.args?.tool_name === execution.start.toolName &&
					canonicalJson(start.args?.tool_input) === expectedInput,
			);
		assert.ok(
			actionIndex >= 0,
			`${fixture.id}: ${execution.start.toolName} ran without an exact prior Action proposal`,
		);
		assert.ok(
			executions
				.slice(index + 1)
				.some(({ start }) => start.toolName === SETTLE_EFFECT_TOOL),
			`${fixture.id}: ${execution.start.toolName} Effect was not settled`,
		);
	}
}

export async function validateExecutionTrace(fixture, events, _root, casePath) {
	const executions = successfulExecutions(events);
	assert.equal(
		executions.some(({ start }) => LEGACY_TOOLS.has(start.toolName)),
		false,
		`${fixture.id}: trace used a removed compatibility tool`,
	);
	const workCaseIndex = executions.findIndex(
		({ start }) => start.toolName === OPEN_WORK_CASE_TOOL,
	);
	assert.ok(
		workCaseIndex >= 0,
		`${fixture.id}: no canonical Work Case was opened`,
	);
	const judgmentIndex = executions.findIndex(
		({ start }) => start.toolName === OPEN_JUDGMENT_TOOL,
	);
	if (fixture.mustRecordJudgment) {
		assert.ok(
			judgmentIndex > workCaseIndex,
			`${fixture.id}: no canonical Judgment followed Work Case opening`,
		);
	}

	const capabilityAssessments = executions.filter(
		({ start }) =>
			start.toolName === ASSESS_CAPABILITY_TOOL &&
			start.args?.status === "applicable",
	);
	const firstTarget = capabilityAssessments[0]?.start.args?.capability;
	assert.ok(
		firstTarget,
		`${fixture.id}: no applicable Capability was assessed`,
	);
	assert.ok(
		fixture.admissibleFirstTargets.includes(firstTarget),
		`${fixture.id}: structurally inadmissible first Capability ${firstTarget}`,
	);
	if (fixture.maxRoutes !== undefined) {
		assert.ok(
			capabilityAssessments.length <= fixture.maxRoutes,
			`${fixture.id}: assessed ${capabilityAssessments.length} applicable Capabilities; expected at most ${fixture.maxRoutes}`,
		);
	}

	for (const expectedReference of fixture.expectedReferenceReads ?? []) {
		const routedPath = expectedReference.split("/").slice(-2).join("/");
		assert.ok(
			executions.some(
				({ start }) =>
					start.toolName === LOAD_REFERENCE_TOOL &&
					String(start.args?.path ?? "")
						.replaceAll("\\", "/")
						.endsWith(routedPath),
			),
			`${fixture.id}: canonical sealed Reference was not loaded: ${expectedReference}`,
		);
	}

	assertControlledActions(fixture, executions);
	if (fixture.mutationRequiresActionClearance) {
		const mutationIndex = executions.findIndex(({ start }) =>
			["edit", "write"].includes(start.toolName),
		);
		if (mutationIndex >= 0) {
			assert.ok(
				executions
					.slice(0, mutationIndex)
					.some(
						({ start }) =>
							start.toolName === ACTION_TOOL &&
							["edit", "write"].includes(start.args?.tool_name),
					),
				`${fixture.id}: mutation started before canonical Action Clearance`,
			);
		}
	}
	if (fixture.requiresObservedEvidenceBeforeMutation) {
		assertObservedEvidenceBeforeMutation(fixture, executions);
	}

	const traceText = canonicalTraceText(executions);
	for (const term of fixture.requiredJudgmentTerms ?? []) {
		assert.ok(
			traceText.includes(term.toLocaleLowerCase()),
			`${fixture.id}: canonical trace omitted required semantic term ${term}`,
		);
	}
	for (const alternatives of fixture.requiredJudgmentConcepts ?? []) {
		assert.ok(
			alternatives.some((term) => traceText.includes(term.toLocaleLowerCase())),
			`${fixture.id}: canonical trace omitted required concept (${alternatives.join(" | ")})`,
		);
	}
	if (fixture.requiresDoctorSynthesis) {
		assert.ok(
			capabilityAssessments.some(
				({ start }) => start.args?.capability === "doctor",
			),
			`${fixture.id}: Doctor Capability was not assessed`,
		);
		for (const term of ["consult", "diagnos", "treat-now", "leave-alone"]) {
			assert.ok(
				traceText.includes(term),
				`${fixture.id}: Doctor synthesis omitted ${term}`,
			);
		}
	}

	if (fixture.workspaceAssertion === "paused-marker") {
		assert.ok(casePath, fixture.id + ": missing evaluation workspace path");
		const source = await readFile(
			join(casePath, "src", "contracts.ts"),
			"utf8",
		);
		assert.match(
			source,
			/export const PAUSED_EVAL_MARKER\s*=\s*["']stable-landing["']/,
		);
		assert.equal(
			executions.some(({ start }) => start.toolName === COMPLETE_TOOL),
			false,
			`${fixture.id}: paused handoff was incorrectly completed`,
		);
	}

	if (fixture.workspaceAssertion === "agent-gate-marker") {
		assert.ok(casePath, fixture.id + ": missing evaluation workspace path");
		const source = await readFile(
			join(casePath, "src", "contracts.ts"),
			"utf8",
		);
		assert.match(
			source,
			/export const AGENT_GATE_EVAL_MARKER\s*=\s*["']resolved["']/,
		);
	}

	if (fixture.workspaceAssertion === "schedule-conversion") {
		assert.ok(casePath, fixture.id + ": missing evaluation workspace path");
		const moduleUrl = pathToFileURL(join(casePath, "src", "contracts.ts"));
		moduleUrl.searchParams.set("eval", String(Date.now()));
		const contracts = await import(moduleUrl.href);
		assert.equal(typeof contracts.toScheduleContent, "function");
		assert.deepEqual(contracts.toScheduleContent({}), {
			startsAt: null,
			endsAt: null,
		});
		assert.deepEqual(
			contracts.toScheduleContent({ startDate: "2026-07-19", endDate: null }),
			{ startsAt: "2026-07-19", endsAt: null },
		);
		const testSource = await readFile(
			join(casePath, "test", "contracts.test.ts"),
			"utf8",
		);
		assert.match(testSource, /toScheduleContent/);
		assert.match(
			testSource,
			/for\s*\(|\.forEach\s*\(|\.map\s*\(|test\.each\s*\(/,
		);
		const testRun = spawnSync(
			process.execPath,
			["--test", "test/contracts.test.ts"],
			{
				cwd: casePath,
				encoding: "utf8",
			},
		);
		assert.equal(
			testRun.status,
			0,
			`${fixture.id}: workspace tests failed\n${testRun.stdout}${testRun.stderr}`,
		);
	}

	return {
		firstTarget,
		preferredFirstTarget: fixture.preferredFirstTargets.includes(firstTarget),
		routeCount: capabilityAssessments.length,
		toolCallCount: executions.length,
	};
}
