import assert from "node:assert/strict";
import test from "node:test";

import {
	PROTOCOL,
	type DeveloperState,
	type JudgmentEvent,
	type PendingQuestion,
	type RouteEvent,
} from "../extensions/state.ts";
import { inspectDeveloperWorkbench } from "../extensions/developer-workbench.ts";

const question: PendingQuestion = {
	id: "question:verify-browser",
	question: "Does the browser preserve the selected state?",
	context: "Inspect both the DOM and the rendered selection before answering.",
	responseSpec: {
		kind: "choice-form",
		fields: [
			{
				id: "result",
				prompt: "Record the browser result",
				options: [
					{ value: "pass", label: "Pass" },
					{ value: "fail", label: "Fail" },
				],
			},
		],
	},
	status: "open",
	resolutionOwner: "user",
	gate: "before-completion",
	resolutionCriteria: "The product owner records pass or fail.",
	sourceRouteId: "route:implementation",
};

const implementationRoute: RouteEvent = {
	protocol: PROTOCOL,
	kind: "route",
	routeId: "route:implementation",
	question: "Apply the bounded selection fix",
	target: "implementation",
	reason: "The behavior and implementation surface are settled.",
	knownEvidence: ["The focused regression test fails before the change."],
	consideredAlternatives: [
		{ target: "model", reason: "The condition space is already settled." },
	],
	availableReferences: [],
	referenceRoutes: [],
	loadedReferences: [],
	executionProfile: "behavior-preserving-structure",
	implementationStep: {
		movement: "Preserve selection while replacing the rendered list",
		stopCondition: "The focused test is green and the branch is reviewable",
		verification: "Run the focused test and inspect the browser",
		invariantHandling: {
			kind: "not-applicable",
			reason: "No broader input crosses a domain boundary in this movement",
		},
	},
};

const implementationJudgment: JudgmentEvent = {
	protocol: PROTOCOL,
	kind: "judgment",
	routeId: implementationRoute.routeId,
	question: implementationRoute.question,
	target: "implementation",
	status: "resolved",
	result: "The selection fix landed and the focused test passes.",
	basis: ["Focused test passed."],
	referenceBasis: [],
	openedQuestions: [question],
	questionUpdates: [],
	artifacts: ["src/list.ts", "tests/list.test.ts"],
	changedArtifacts: true,
};

const verifyRoute: RouteEvent = {
	...implementationRoute,
	routeId: "route:verify",
	question: "What does the current evidence prove?",
	target: "verify",
	reason: "The browser observation is still missing.",
	implementationStep: undefined,
	executionProfile: undefined,
};

function richState(): DeveloperState {
	return {
		enabled: true,
		activeRoute: verifyRoute,
		lastRoute: verifyRoute,
		lastJudgment: implementationJudgment,
		routeHistory: [implementationRoute, verifyRoute],
		judgmentHistory: [implementationJudgment],
		pendingQuestions: [question],
		rerouteRequired: false,
		implementationFramingRequired: false,
		verificationRequired: true,
	};
}

test("Developer workbench projects current obligations and complete domain details without mutation", () => {
	const state = richState();
	const before = structuredClone(state);
	const snapshot = inspectDeveloperWorkbench(state, {
		activeTools: ["read", "bash", "developer_route_question"],
		availableSkills: ["verify", "specify"],
	});

	assert.deepEqual(state, before);
	assert.deepEqual(
		snapshot.sections.map((section) => section.id),
		["overview", "route", "questions", "judgments", "landings", "settings"],
	);
	assert.equal(snapshot.protocol, "needs-judgment");
	assert.equal(snapshot.authority, "Inspection and evidence only");
	assert.match(snapshot.nextAction, /active verify judgment/);

	const route = snapshot.sections.find((section) => section.id === "route");
	assert.equal(route?.items.length, 1);
	assert.match(
		route?.items[0]?.blocks.flatMap((block) => block.lines).join("\n") ?? "",
		/browser observation is still missing/i,
	);

	const projectedQuestion = snapshot.sections.find(
		(section) => section.id === "questions",
	)?.items[0];
	assert.equal(projectedQuestion?.questionAction, "answer");
	assert.match(
		projectedQuestion?.blocks.flatMap((block) => block.lines).join("\n") ?? "",
		/Inspect both the DOM/,
	);
	assert.match(
		projectedQuestion?.blocks.flatMap((block) => block.lines).join("\n") ?? "",
		/result: Record the browser result/,
	);

	const judgment = snapshot.sections.find(
		(section) => section.id === "judgments",
	)?.items[0];
	assert.match(judgment?.summary ?? "", /selection fix landed/);
	assert.match(
		judgment?.blocks.flatMap((block) => block.lines).join("\n") ?? "",
		/Focused test passed/,
	);
});

test("Developer workbench indexes implementation landings without inventing per-landing verification", () => {
	const snapshot = inspectDeveloperWorkbench(richState(), {
		activeTools: [],
		availableSkills: [],
	});
	const landing = snapshot.sections.find((section) => section.id === "landings")
		?.items[0];
	const detail =
		landing?.blocks.flatMap((block) => block.lines).join("\n") ?? "";

	assert.equal(landing?.state, "changed");
	assert.match(detail, /Preserve selection while replacing/);
	assert.match(detail, /Current branch verification debt: required/);
	assert.match(detail, /no per-landing Verified claim is inferred/);
	assert.doesNotMatch(landing?.state ?? "", /verified/i);
});

test("Developer workbench surfaces restart recovery before ordinary routing", () => {
	const restartIssue = "Restart Pi before enabling Developer again.";
	const snapshot = inspectDeveloperWorkbench(richState(), {
		activeTools: [],
		availableSkills: [],
		restartIssue,
	});

	assert.equal(snapshot.authority, "Blocked until Pi restarts");
	assert.equal(snapshot.nextAction, restartIssue);
	assert.equal(snapshot.restartIssue, restartIssue);
	assert.match(
		snapshot.sections[0]?.items[0]?.blocks
			.flatMap((block) => block.lines)
			.join("\n") ?? "",
		/Restart Pi/,
	);
});
