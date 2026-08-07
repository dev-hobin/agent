import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { type TestContext } from "node:test";
import { pathToFileURL } from "node:url";

import type { LiveCapabilityInventoryResult } from "../extensions/action-loop-capability-inventory.ts";
import { openLiveJudgment } from "../extensions/action-loop-judgment.ts";
import {
	sdkCapabilityContextEvent,
	sdkCapabilityInventoryAssessedEvent,
} from "../extensions/action-loop-sdk-session.ts";
import {
	ACTION_LOOP_SESSION_ENTRY,
	actionLoopCapabilityInventoryAssessedEvent,
	actionLoopJudgmentOpenedEvent,
	actionLoopWorkCaseOpenedEvent,
	replayActionLoopSession,
} from "../extensions/action-loop-session.ts";
import { openLiveWorkCase } from "../extensions/action-loop-work-case.ts";
import {
	assessCapabilityInventoryWithSdk,
	type SdkNamedCapability,
} from "../src/action-loop/sdk/capability-inventory-controller.ts";
import { inspectCapabilityContextProgress } from "../src/action-loop/sdk/context-progress.ts";
import { sealCapabilityContextWithSdk } from "../src/action-loop/sdk/context-sealing-controller.ts";
import {
	bindCapability,
	bindUnstructuredCapability,
} from "../src/action-loop/routing/bind-capability.ts";
import {
	parseTocBytes,
	SKILL_TOC_SCHEMA_URI,
} from "../src/action-loop/routing/parse-toc.ts";
import { scriptedSdkRunner } from "./fixtures/scripted-sdk-runner.ts";

const encoder = new TextEncoder();
const structuredWhen = "A state and time contract remains unresolved.";
const structuredUnless = "No state or time behavior is consequential.";
const referencePath = "references/temporal.md";
const request =
	"Model retry, stale, duplicate, and reordered approval behavior.";

async function capabilityFixture(t: TestContext): Promise<{
	readonly capabilities: readonly SdkNamedCapability[];
}> {
	const root = await mkdtemp(join(tmpdir(), "developer-sdk-inventory-"));
	t.after(async () => rm(root, { recursive: true, force: true }));
	const structuredRoot = join(root, "model");
	await mkdir(join(structuredRoot, "references"), { recursive: true });
	const structuredSkill = "---\nname: model\n---\n# Model\n";
	await writeFile(join(structuredRoot, "SKILL.md"), structuredSkill);
	await writeFile(
		join(structuredRoot, referencePath),
		"Temporal retry and stale-response distinctions.\n",
	);
	const tocDocument = {
		$schema: SKILL_TOC_SCHEMA_URI,
		when: [structuredWhen],
		unless: [structuredUnless],
		references: [
			{
				path: referencePath,
				when: ["Retry or stale event ordering is consequential."],
			},
		],
	};
	const tocBytes = encoder.encode(JSON.stringify(tocDocument));
	await writeFile(join(structuredRoot, "toc.json"), tocBytes);
	const parsed = parseTocBytes(tocBytes);
	if (!parsed.ok) throw new Error(parsed.error.message);
	const structuredSource = {
		kind: "project" as const,
		locator: pathToFileURL(structuredRoot).href,
		skillRoot: "model",
	};
	const structured = bindCapability(
		structuredSource,
		parsed.value,
		encoder.encode(structuredSkill),
	);
	if (!structured.ok) throw new Error(structured.error.message);

	const directPath = join(root, "direct.md");
	const directSkill =
		"---\nname: direct\ndescription: Direct method\n---\n# Direct\n";
	await writeFile(directPath, directSkill);
	const directSource = {
		kind: "cli" as const,
		locator: pathToFileURL(directPath).href,
		skillRoot: ".",
	};
	const direct = bindUnstructuredCapability(
		directSource,
		encoder.encode(directSkill),
	);
	if (!direct.ok) throw new Error(direct.error.message);

	return {
		capabilities: [
			{
				name: "model",
				entry: {
					status: "bound",
					routing: "structured",
					candidate: {
						label: "model",
						description: "Model unresolved conditions.",
						skillFilePath: join(structuredRoot, "SKILL.md"),
						skillRootPath: structuredRoot,
						skillMaterialPath: join(structuredRoot, "SKILL.md"),
						supportsStructuredToc: true,
						source: structuredSource,
					},
					descriptor: {
						name: "toc.json",
						locator: pathToFileURL(join(structuredRoot, "toc.json")).href,
						byteLength: tocBytes.byteLength,
						toc: parsed.value,
					},
					capability: structured.value,
				},
			},
			{
				name: "direct",
				entry: {
					status: "bound",
					routing: "unstructured",
					reason: "unsupported-skill-material",
					candidate: {
						label: "direct",
						description: "Direct admitted method.",
						skillFilePath: directPath,
						skillRootPath: root,
						skillMaterialPath: directPath,
						supportsStructuredToc: false,
						source: directSource,
					},
					capability: direct.value,
				},
			},
		],
	};
}

test("SDK inventory assessment is complete and Context sealing stays one Assignment at a time", async (t) => {
	const fixture = await capabilityFixture(t);
	const runner = scriptedSdkRunner([
		{
			proposals: [
				{
					status_0: "applicable",
					basis_0: "The direct method addresses the current Need.",
					status_1: "applicable",
					basis_1: "The temporal model conditions directly match the Need.",
					when_1_0: true,
					unless_1_0: false,
				},
			],
		},
		{
			proposals: [
				{
					status_0: "selected",
					basis_0: "Temporal ordering is central to the current Need.",
				},
			],
		},
	]);
	const assessed = await assessCapabilityInventoryWithSdk({
		request,
		workCaseId: "work-sdk-1",
		judgmentId: "judgment-sdk-1",
		contributionNeedId: "need-sdk-1",
		contributionNeed: "A state, retry, identity, and temporal behavior model",
		capabilities: fixture.capabilities,
		runner,
	});
	assert.equal(assessed.status, "assessed");
	if (assessed.status !== "assessed") return;
	assert.deepEqual(
		assessed.dispositions.map(({ name }) => name),
		["direct", "model"],
	);
	assert.equal(assessed.assignments.length, 2);
	assert.equal(assessed.decision?.toolCalls, 1);

	const direct = fixture.capabilities.find(({ name }) => name === "direct");
	const model = fixture.capabilities.find(({ name }) => name === "model");
	const directAssignment = assessed.dispositions.find(
		({ name }) => name === "direct",
	)?.assignment;
	const modelAssignment = assessed.dispositions.find(
		({ name }) => name === "model",
	)?.assignment;
	assert.ok(direct && model && directAssignment && modelAssignment);
	const directContext = await sealCapabilityContextWithSdk({
		request,
		entry: direct.entry,
		assignment: directAssignment,
		runner,
	});
	assert.equal(directContext.status, "sealed");
	if (directContext.status !== "sealed") return;
	assert.equal("routing" in directContext.context, true);
	assert.deepEqual(directContext.context.selectedPaths, []);
	assert.equal(directContext.decisions.length, 0);

	const modelContext = await sealCapabilityContextWithSdk({
		request,
		entry: model.entry,
		assignment: modelAssignment,
		runner,
	});
	assert.equal(modelContext.status, "sealed");
	if (modelContext.status !== "sealed") return;
	assert.deepEqual(modelContext.context.selectedPaths, [referencePath]);
	assert.deepEqual(
		modelContext.context.materials.map(({ path }) => path),
		["SKILL.md", referencePath],
	);
	assert.equal(modelContext.decisions.length, 1);
});

test("SDK inventory rejects duplicate ownership before any model decision", async (t) => {
	const fixture = await capabilityFixture(t);
	const duplicate = [fixture.capabilities[0], fixture.capabilities[0]].filter(
		(capability): capability is SdkNamedCapability => capability !== undefined,
	);
	const result = await assessCapabilityInventoryWithSdk({
		request,
		workCaseId: "work-sdk-1",
		judgmentId: "judgment-sdk-1",
		contributionNeedId: "need-sdk-1",
		contributionNeed: "A temporal model",
		capabilities: duplicate,
		runner: scriptedSdkRunner([]),
	});
	assert.equal(result.status, "invalid-inventory");
});

test("Pi branch events resume the next unsealed SDK Context without a parallel checkpoint", async (t) => {
	const fixture = await capabilityFixture(t);
	const workCaseProposal = {
		outcome: {
			statement: "Approval retries preserve one terminal decision.",
			acceptanceConditions: [
				"Every admitted Capability is assessed for the temporal Need.",
			],
			constraints: ["Pi branch events are the only durable boundary."],
		},
		basis: ["The delegated request contains consequential temporal behavior."],
		provenance: { kind: "model" as const, source: "sdk:test" },
	};
	const opened = openLiveWorkCase(undefined, workCaseProposal);
	assert.equal(opened.status, "opened");
	if (opened.status !== "opened") return;
	const judgmentProposal = {
		category: "Consequence Integrity" as const,
		subject: "Approval retry behavior",
		question: "Which state and time behavior preserves one terminal decision?",
		requirements: [
			{
				statement: "Retry and stale-response behavior is explicit.",
				contributionNeeds: ["A temporal behavior model"],
			},
		],
		basis: ["The behavior crosses retry and ordering boundaries."],
		provenance: { kind: "model" as const, source: "sdk:test" },
	};
	const judgment = openLiveJudgment(opened.value, judgmentProposal);
	assert.equal(judgment.status, "opened");
	if (judgment.status !== "opened") return;
	const need = judgment.judgment.contributionNeeds[0];
	assert.ok(need);

	const runner = scriptedSdkRunner([
		{
			proposals: [
				{
					status_0: "applicable",
					basis_0: "The direct method contributes to the current Need.",
					status_1: "applicable",
					basis_1: "Temporal conditions match the current Need.",
					when_1_0: true,
					unless_1_0: false,
				},
			],
		},
		{
			proposals: [
				{
					status_0: "selected",
					basis_0: "Retry ordering requires the declared temporal Reference.",
				},
			],
		},
	]);
	const assessed = await assessCapabilityInventoryWithSdk({
		request,
		workCaseId: opened.value.workCase.workCaseId,
		judgmentId: judgment.judgment.judgmentId,
		contributionNeedId: need.contributionNeedId,
		contributionNeed: need.function,
		capabilities: fixture.capabilities,
		runner,
	});
	assert.equal(assessed.status, "assessed");
	if (assessed.status !== "assessed") return;
	const direct = fixture.capabilities.find(({ name }) => name === "direct");
	const model = fixture.capabilities.find(({ name }) => name === "model");
	const directAssignment = assessed.dispositions.find(
		({ name }) => name === "direct",
	)?.assignment;
	const modelAssignment = assessed.dispositions.find(
		({ name }) => name === "model",
	)?.assignment;
	assert.ok(direct && model && directAssignment && modelAssignment);
	const directContext = await sealCapabilityContextWithSdk({
		request,
		entry: direct.entry,
		assignment: directAssignment,
		runner,
	});
	assert.equal(directContext.status, "sealed");
	if (directContext.status !== "sealed") return;
	const modelContext = await sealCapabilityContextWithSdk({
		request,
		entry: model.entry,
		assignment: modelAssignment,
		runner,
	});
	assert.equal(modelContext.status, "sealed");
	if (modelContext.status !== "sealed") return;

	const inventory = {
		status: "ready",
		value: {
			inventory: {
				status: "inventoried",
				entries: fixture.capabilities.map(({ entry }) => entry),
				excluded: [],
			},
			availablePackageSkills: new Map(),
			boundCapabilitiesBySkillName: new Map(
				fixture.capabilities.map(({ name, entry }) => [name, entry]),
			),
			summary: { bound: 2, unavailable: 0, excluded: 0 },
		},
	} satisfies LiveCapabilityInventoryResult;
	const workCaseEntry = {
		type: "custom",
		customType: ACTION_LOOP_SESSION_ENTRY,
		data: actionLoopWorkCaseOpenedEvent(workCaseProposal, opened.value),
	};
	const judgmentEntry = {
		type: "custom",
		customType: ACTION_LOOP_SESSION_ENTRY,
		data: actionLoopJudgmentOpenedEvent(
			judgmentProposal,
			judgment.judgment.judgmentId,
			judgment.state.workCase.revisionId,
		),
	};
	const inventoryEvent = sdkCapabilityInventoryAssessedEvent(assessed);
	const openingEntries = [
		workCaseEntry,
		judgmentEntry,
		{
			type: "custom",
			customType: ACTION_LOOP_SESSION_ENTRY,
			data: inventoryEvent,
		},
	];
	const tamperedAssessments = inventoryEvent.assessments.map(
		(assessment, index) =>
			index === inventoryEvent.assessments.length - 1
				? {
						...assessment,
						expected: {
							...assessment.expected,
							assignmentId: "wrong-assignment",
						},
					}
				: assessment,
	);
	const rejectedBatch = await replayActionLoopSession(
		[
			workCaseEntry,
			judgmentEntry,
			{
				type: "custom",
				customType: ACTION_LOOP_SESSION_ENTRY,
				data: actionLoopCapabilityInventoryAssessedEvent({
					contributionNeedId: need.contributionNeedId,
					assessments: tamperedAssessments,
				}),
			},
		],
		inventory,
	);
	assert.equal(rejectedBatch.status, "unavailable");
	if (rejectedBatch.status === "unavailable") {
		assert.equal(rejectedBatch.entryIndex, 2);
	}
	const firstContextEntry = {
		type: "custom",
		customType: ACTION_LOOP_SESSION_ENTRY,
		data: sdkCapabilityContextEvent({
			skillName: "direct",
			assignment: directAssignment,
			result: directContext,
		}),
	};
	const partial = await replayActionLoopSession(
		[...openingEntries, firstContextEntry],
		inventory,
	);
	assert.equal(partial.status, "ready");
	if (partial.status !== "ready" || !partial.activeWorkCase) return;
	const pending = inspectCapabilityContextProgress({
		workCaseId: partial.activeWorkCase.workCase.workCaseId,
		judgmentId: judgment.judgment.judgmentId,
		contributionNeedId: need.contributionNeedId,
		assignments: partial.activeWorkCase.capabilityAssignments,
		selections: partial.activeWorkCase.referenceSelections,
		contexts: partial.activeWorkCase.sealedSkillContexts,
	});
	assert.equal(pending.status, "pending");
	if (pending.status !== "pending") return;
	assert.deepEqual(
		pending.pendingAssignments.map(({ assignmentId }) => assignmentId),
		[modelAssignment.assignmentId],
	);
	assert.deepEqual(pending.completedAssignmentIds, [
		directAssignment.assignmentId,
	]);

	const complete = await replayActionLoopSession(
		[
			...openingEntries,
			firstContextEntry,
			{
				type: "custom",
				customType: ACTION_LOOP_SESSION_ENTRY,
				data: sdkCapabilityContextEvent({
					skillName: "model",
					assignment: modelAssignment,
					result: modelContext,
				}),
			},
		],
		inventory,
	);
	assert.equal(complete.status, "ready");
	if (complete.status !== "ready" || !complete.activeWorkCase) return;
	const progress = inspectCapabilityContextProgress({
		workCaseId: complete.activeWorkCase.workCase.workCaseId,
		judgmentId: judgment.judgment.judgmentId,
		contributionNeedId: need.contributionNeedId,
		assignments: complete.activeWorkCase.capabilityAssignments,
		selections: complete.activeWorkCase.referenceSelections,
		contexts: complete.activeWorkCase.sealedSkillContexts,
	});
	assert.equal(progress.status, "complete");
	assert.equal(complete.appliedTransitions, 5);
});
