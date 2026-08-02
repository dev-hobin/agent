import assert from "node:assert/strict";
import test from "node:test";

import {
	compileJudgmentPolicy,
	decodeContextInventoryData,
	decodeContextSelectionProposalData,
	decodeDynamicJudgmentQuestionData,
	decodeObservedContextData,
	decodePolicyOwnerData,
	jsonValueFromUnknown,
	parseContextInventory,
	parseContextSelectionProposal,
	parseDynamicJudgmentQuestion,
	parseJudgmentAuthoringPolicyJson,
	parseObservedContext,
	parsePolicyOwner,
	selectContext,
} from "../src/index.ts";
import { ContextAttempt } from "../src/pi-context/context-attempt.ts";
import { buildPiContextInventory } from "../src/pi-context/inventory.ts";
import { resolveObservedContext } from "../src/pi-context/observed-context.ts";

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

test("external prepared references require explicit policy admission", () => {
	const owner = parsePolicyOwner(
		decodePolicyOwnerData(
			jsonValueFromUnknown({
				kind: "pi-skill",
				namespace: "project-skills",
				name: "api-policy",
				provenance: {
					source: "project-skills",
					scope: "project",
					origin: "top-level",
					path: "/project/api-policy/SKILL.md",
				},
			}),
		),
	);
	const policy = compileJudgmentPolicy({
		owner,
		policy: parseJudgmentAuthoringPolicyJson(
			JSON.stringify({
				specVersion: "0.1",
				when: ["A public API may change."],
				unless: ["The change is internal-only."],
				references: [
					{
						path: "references/errors.md",
						when: ["A public error contract needs its exact distinctions."],
					},
				],
			}),
		),
	});
	const inventory = buildPiContextInventory({
		preparedProviders: [{ policy, policyRoot: "/project/api-policy" }],
		skills: [],
		contextFiles: [],
		tools: [],
		activeToolNames: [],
	});
	const reference = inventory.sources[0];
	assert.equal(reference?.kind, "prepared-reference");
	if (!reference || reference.kind !== "prepared-reference") return;
	const dynamicQuestion = parseDynamicJudgmentQuestion(
		decodeDynamicJudgmentQuestionData(jsonValueFromUnknown(question)),
	);
	const observed = parseObservedContext(
		decodeObservedContextData(
			jsonValueFromUnknown({ branchRef: "open-call", entries: [] }),
		),
	);
	const proposal = parseContextSelectionProposal(
		decodeContextSelectionProposalData(
			jsonValueFromUnknown({
				questionSha256: dynamicQuestion.questionSha256,
				nominations: [
					{
						kind: "inventory-source",
						inventorySourceId: reference.id,
						descriptorSha256: reference.descriptorSha256,
						contentSha256: "a".repeat(64),
					},
				],
				selectionBasis: ["The admitted project policy constrains the API."],
			}),
		),
	);
	assert.throws(
		() =>
			selectContext({
				question: dynamicQuestion,
				inventory,
				observedContext: observed,
				proposal,
			}),
		/unadmitted policy/u,
	);
	const selected = selectContext({
		question: dynamicQuestion,
		inventory,
		observedContext: observed,
		proposal,
		admittedPolicySha256s: [policy.policySha256],
	});
	assert.equal(selected.selectedSources[0]?.id, reference.id);
});

test("selection and sealing commit atomically after successful acquisition only", async () => {
	const opened = ContextAttempt.open({
		question: jsonValueFromUnknown(question),
	});
	assert.equal(opened.value.state.status, "started");
	assert.deepEqual(opened.events, []);
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
			acquisition: {
				async acquirePreparedReference() {
					throw new Error("unused");
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
		acquisition: {
			async acquirePreparedReference() {
				throw new Error("unused");
			},
			acquireObservedContext: resolved.acquireObservedContext,
		},
	});
	assert.equal(committed.value.status, "sealed");
	assert.deepEqual(
		committed.events.map((event) => event.kind),
		["selection-recorded", "sealed-context-recorded"],
	);
});
