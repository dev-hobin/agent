import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const OPEN_JUDGMENT_TOOL = "developer_open_judgment";
const CONCLUDE_JUDGMENT_TOOL = "developer_conclude_judgment";
const AUTHORIZE_CHANGE_TOOL = "developer_authorize_change";
const RECORD_LANDING_TOOL = "developer_record_landing";

function resultText(event) {
	const content = event?.result?.content;
	if (!Array.isArray(content)) return "";
	return content
		.filter((item) => item && item.type === "text")
		.map((item) => item.text)
		.join("\n");
}

async function skillBody(root, target) {
	const source = await readFile(
		join(root, "skills", target, "SKILL.md"),
		"utf8",
	);
	return source.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "").trim();
}

const routeDefaultTargets = new Map([
	["route:meaning-settlement", "specify"],
	["route:condition-settlement", "model"],
	["route:implementation-shaping", "sketch"],
	["route:structural-pressure-observation", "signal"],
	["route:name-sense-judgment", "naming-judgment"],
	["route:candidate-reliability", "abstraction-review"],
	["route:change-timing", "schedule"],
	["route:claim-evidence-assessment", "verify"],
]);

function openingSkillName(execution) {
	return execution.args.owner_skill?.skill_name;
}

function decisionTarget(execution) {
	if (execution.toolName === OPEN_JUDGMENT_TOOL) {
		return (
			openingSkillName(execution) ??
			routeDefaultTargets.get(execution.args.route_definition_id)
		);
	}
	if (execution.toolName === AUTHORIZE_CHANGE_TOOL) return "implementation";
	return undefined;
}

function conclusionText(conclusion) {
	return JSON.stringify({
		outcome: conclusion.args.outcome,
		reason: conclusion.args.not_applicable_reason,
		basis: conclusion.args.not_applicable_basis,
		artifacts: conclusion.args.produced_artifacts,
	});
}

export function assertAgentBeforeImplementationResolution(fixture, executions) {
	const needsEvidenceIndex = executions.findIndex(
		(event) =>
			event.toolName === CONCLUDE_JUDGMENT_TOOL &&
			event.args.outcome?.kind === "needs-evidence",
	);
	assert.ok(
		needsEvidenceIndex >= 0,
		fixture.id + ": no agent-owned needs-evidence frame was recorded",
	);
	const frameId = executions[needsEvidenceIndex].args.judgment_id;
	const resolutionOffset = executions
		.slice(needsEvidenceIndex + 1)
		.findIndex(
			(event) =>
				event.toolName === CONCLUDE_JUDGMENT_TOOL &&
				event.args.judgment_id === frameId &&
				(event.args.outcome?.kind === "contextual-judgment" ||
					event.args.disposition === "not-applicable"),
		);
	assert.ok(
		resolutionOffset >= 0,
		fixture.id + ": the needs-evidence frame was not explicitly resolved",
	);
	const resolutionIndex = needsEvidenceIndex + 1 + resolutionOffset;

	if (fixture.requiresJudgmentBashEvidence) {
		assert.ok(
			executions
				.slice(needsEvidenceIndex + 1, resolutionIndex)
				.some((event) => event.toolName === "bash"),
			fixture.id + ": the open evidence frame did not run bash",
		);
	}
	assert.ok(
		executions
			.slice(resolutionIndex + 1)
			.some((event) => event.toolName === AUTHORIZE_CHANGE_TOOL),
		fixture.id + ": no change authorization followed explicit frame resolution",
	);
}

async function preparedReferenceForPath(root, expectedPath) {
	const normalized = expectedPath.replaceAll("\\", "/");
	const parts = normalized.split("/");
	const skillIndex = parts.indexOf("skills");
	if (skillIndex < 0 || !parts[skillIndex + 1]) return undefined;
	const skillName = parts[skillIndex + 1];
	const relativePath = parts.slice(skillIndex + 2).join("/");
	const contractPath = join(root, "skills", skillName, "judgment.json");
	let policy;
	try {
		policy = JSON.parse(await readFile(contractPath, "utf8"));
	} catch (error) {
		throw new Error(`Invalid Judgment policy JSON at ${contractPath}.`, {
			cause: error,
		});
	}
	const reference = policy.references?.find(
		(candidate) => candidate.path === relativePath,
	);
	return reference ? { skillName, path: reference.path } : undefined;
}

export async function validateExecutionTrace(fixture, events, root, casePath) {
	const executions = events.filter(
		(event) => event.type === "tool_execution_start",
	);
	const endings = events.filter((event) => event.type === "tool_execution_end");
	const decisions = executions.filter(
		(event) =>
			event.toolName === OPEN_JUDGMENT_TOOL ||
			event.toolName === AUTHORIZE_CHANGE_TOOL,
	);
	const openings = executions.filter(
		(event) => event.toolName === OPEN_JUDGMENT_TOOL,
	);
	const conclusions = executions.filter(
		(event) => event.toolName === CONCLUDE_JUDGMENT_TOOL,
	);
	const authorizations = executions.filter(
		(event) => event.toolName === AUTHORIZE_CHANGE_TOOL,
	);
	const landings = executions.filter(
		(event) => event.toolName === RECORD_LANDING_TOOL,
	);

	assert.ok(
		decisions.length > 0,
		fixture.id + ": no Developer decision opened",
	);
	const firstTarget = decisionTarget(decisions[0]);
	assert.ok(
		fixture.admissibleFirstTargets.includes(firstTarget),
		fixture.id +
			": structurally inadmissible first target " +
			JSON.stringify(decisions[0].args),
	);
	if (fixture.maxDecisions !== undefined) {
		assert.ok(
			decisions.length <= fixture.maxDecisions,
			`${fixture.id}: opened ${decisions.length} decisions; expected at most ${fixture.maxDecisions}`,
		);
	}
	if (fixture.mustRecordJudgment) {
		assert.ok(
			conclusions.length > 0,
			fixture.id + ": " + CONCLUDE_JUDGMENT_TOOL + " was not called",
		);
	}
	if (fixture.mustRecordLanding) {
		assert.ok(
			landings.length > 0,
			fixture.id + ": " + RECORD_LANDING_TOOL + " was not called",
		);
	}

	for (const expectedSourcePath of fixture.expectedPreparedReferences ?? []) {
		const expected = await preparedReferenceForPath(root, expectedSourcePath);
		assert.ok(
			expected,
			`${fixture.id}: expected prepared reference is not declared: ${expectedSourcePath}`,
		);
		const application = conclusions.find((event) => {
			const nomination = event.args.nominations?.find(
				(candidate) =>
					candidate.kind === "inventory-source" &&
					(candidate.provenancePath?.endsWith(expected.path) ||
						candidate.provenancePath === expected.path),
			);
			const contributionIndex = event.args.coverage?.contributions?.findIndex(
				(contribution) =>
					contribution.nominationId === nomination?.nominationId,
			);
			return (
				nomination &&
				contributionIndex >= 0 &&
				event.args.outcome?.kind === "contextual-judgment" &&
				event.args.outcome.citedUses?.some(
					(citation) => citation.contributionIndex === contributionIndex,
				)
			);
		});
		assert.ok(
			application,
			`${fixture.id}: judgment did not select and cite prepared reference ${expectedSourcePath}`,
		);
	}

	for (const opening of openings) {
		const ending = endings.find(
			(event) =>
				event.toolName === OPEN_JUDGMENT_TOOL &&
				event.toolCallId === opening.toolCallId,
		);
		assert.ok(ending, fixture.id + ": open-judgment result was not observed");
		assert.equal(
			ending.isError,
			false,
			`${fixture.id}: open judgment failed for ${JSON.stringify(opening.args)}\n${resultText(ending)}`,
		);
		const skillName = openingSkillName(opening);
		if (skillName === undefined) {
			assert.match(resultText(ending), /No owning Skill was invoked/u);
			continue;
		}
		const expectedBody = await skillBody(root, skillName);
		assert.ok(
			resultText(ending).includes(expectedBody),
			`${fixture.id}: selected skill body was not loaded exactly for ${skillName}`,
		);
		assert.match(
			resultText(ending),
			/<developer-method name="[^"]+" location="[^"]+" base-dir="[^"]+">/u,
		);
		assert.match(
			resultText(ending),
			/Nominate only acquired current-branch context/u,
		);
	}

	for (const operation of [...conclusions, ...authorizations, ...landings]) {
		const ending = endings.find(
			(event) =>
				event.toolName === operation.toolName &&
				event.toolCallId === operation.toolCallId,
		);
		assert.ok(
			ending,
			`${fixture.id}: ${operation.toolName} result was not observed`,
		);
		assert.equal(
			ending.isError,
			false,
			`${fixture.id}: ${operation.toolName} failed for ${JSON.stringify(operation.args)}\n${resultText(ending)}`,
		);
	}

	const judgmentText = [
		...conclusions.map(conclusionText),
		...landings.map((landing) => JSON.stringify(landing.args)),
	].join("\n");
	const normalizedJudgment = judgmentText.toLocaleLowerCase();
	for (const term of fixture.requiredJudgmentTerms ?? []) {
		assert.ok(
			normalizedJudgment.includes(term.toLocaleLowerCase()),
			`${fixture.id}: judgment omitted required semantic term ${term}`,
		);
	}
	for (const alternatives of fixture.requiredJudgmentConcepts ?? []) {
		assert.ok(
			alternatives.some((term) =>
				normalizedJudgment.includes(term.toLocaleLowerCase()),
			),
			`${fixture.id}: judgment omitted required semantic concept (${alternatives.join(" | ")})`,
		);
	}

	if (fixture.requiresDoctorSynthesis) {
		const doctorOpenings = openings.filter(
			(event) => openingSkillName(event) === "doctor",
		);
		assert.ok(
			doctorOpenings.length >= 2,
			`${fixture.id}: Doctor did not return for final synthesis`,
		);
		const finalDecision = decisions.at(-1);
		assert.equal(
			decisionTarget(finalDecision),
			"doctor",
			`${fixture.id}: the final judgment opening was not Doctor synthesis`,
		);
		assert.ok(
			openings.some((event) => {
				const skillName = openingSkillName(event);
				return skillName !== "doctor" && skillName !== undefined;
			}),
			`${fixture.id}: Doctor did not delegate an owner-skill consultation`,
		);
		const finalIndex = executions.indexOf(finalDecision);
		const finalConclusion = executions
			.slice(finalIndex + 1)
			.find((event) => event.toolName === CONCLUDE_JUDGMENT_TOOL);
		assert.ok(
			finalConclusion,
			`${fixture.id}: final Doctor judgment has no conclusion`,
		);
		const synthesis = conclusionText(finalConclusion).toLocaleLowerCase();
		for (const [label, alternatives] of [
			["consultation ledger", ["consultation", "consult", "협진"]],
			["diagnosis", ["diagnos", "진단"]],
			["treatment plan", ["treat", "처방", "개선 계획"]],
		]) {
			assert.ok(
				alternatives.some((term) => synthesis.includes(term)),
				`${fixture.id}: final Doctor synthesis omitted ${label}`,
			);
		}
	}

	if (fixture.mutationRequiresAuthorization) {
		const mutationIndex = executions.findIndex((event) =>
			["edit", "write"].includes(event.toolName),
		);
		if (mutationIndex >= 0) {
			assert.ok(
				executions
					.slice(0, mutationIndex)
					.some((event) => event.toolName === AUTHORIZE_CHANGE_TOOL),
				fixture.id + ": mutation started before change authorization",
			);
		}
	}

	if (fixture.requiresAgentBeforeImplementationResolution) {
		assertAgentBeforeImplementationResolution(fixture, executions);
	}

	if (fixture.workspaceAssertion === "paused-marker") {
		assert.ok(casePath, fixture.id + ": missing evaluation workspace path");
		const source = await readFile(
			join(casePath, "src", "contracts.ts"),
			"utf8",
		);
		assert.match(
			source,
			/export const PAUSED_EVAL_MARKER\s*=\s*["']stable-landing["']/u,
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
			/export const AGENT_GATE_EVAL_MARKER\s*=\s*["']resolved["']/u,
		);
	}

	if (fixture.workspaceAssertion === "schedule-conversion") {
		assert.ok(casePath, fixture.id + ": missing evaluation workspace path");
		const moduleUrl = pathToFileURL(join(casePath, "src", "contracts.ts"));
		moduleUrl.searchParams.set("eval", String(Date.now()));
		const contracts = await import(moduleUrl.href);
		assert.equal(
			typeof contracts.toScheduleContent,
			"function",
			fixture.id + ": toScheduleContent was not exported",
		);
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
		assert.match(testSource, /toScheduleContent/u);
		assert.match(
			testSource,
			/for\s*\(|\.forEach\s*\(|\.map\s*\(|test\.each\s*\(/u,
		);
		const testRun = spawnSync(
			process.execPath,
			["--test", "test/contracts.test.ts"],
			{ cwd: casePath, encoding: "utf8" },
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
		decisionCount: decisions.length,
		toolCallCount: executions.length,
	};
}
