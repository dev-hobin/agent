import assert from "node:assert/strict";
import test from "node:test";

import { inspectDeveloperWorkbench } from "../extensions/developer-workbench.ts";
import {
	activationChanged,
	changeAuthorized,
	landingRecorded,
} from "../src/protocol.ts";
import {
	applyDeveloperEvent,
	initialDeveloperState,
} from "../src/transition.ts";
import { createRichQaState } from "./fixtures/tui-visual.ts";

test("Developer workbench projects current obligations and v7 domain details without mutation", () => {
	const state = createRichQaState();
	const before = JSON.stringify(state);
	const snapshot = inspectDeveloperWorkbench(state, {
		activeTools: ["read", "bash", "developer_conclude_judgment"],
		availableSkills: ["verify", "specify"],
	});

	assert.equal(JSON.stringify(state), before);
	assert.deepEqual(
		snapshot.sections.map((section) => section.id),
		["overview", "work", "questions", "judgments", "landings", "settings"],
	);
	assert.equal(snapshot.protocol, "needs-judgment-conclusion");
	assert.match(snapshot.authority, /evidence tools only/i);
	assert.match(snapshot.nextAction, /developer_conclude_judgment/u);

	const work = snapshot.sections.find((section) => section.id === "work");
	assert.equal(work?.items.length, 1);
	assert.match(
		work?.items[0]?.blocks.flatMap((block) => block.lines).join("\n") ?? "",
		/Policy: absent/iu,
	);

	const projectedQuestion = snapshot.sections.find(
		(section) => section.id === "questions",
	)?.items[0];
	assert.equal(projectedQuestion?.questionAction, "answer");
	assert.match(
		projectedQuestion?.blocks.flatMap((block) => block.lines).join("\n") ?? "",
		/both interaction and provenance/iu,
	);
	assert.match(
		projectedQuestion?.blocks.flatMap((block) => block.lines).join("\n") ?? "",
		/ghostty-result: Record the Ghostty observation/iu,
	);

	const judgment = snapshot.sections.find(
		(section) => section.id === "judgments",
	)?.items[0];
	assert.equal(judgment?.state, "judgment-not-applicable");
	assert.match(judgment?.summary ?? "", /renderer-specific behavior/iu);
});

function landedState() {
	let state = applyDeveloperEvent(
		initialDeveloperState(),
		activationChanged(true),
	);
	state = applyDeveloperEvent(
		state,
		changeAuthorized({
			kind: "authorized-change",
			authorizationId: "change:selection-fix",
			question: "Apply the bounded selection fix.",
			reason: "Behavior and implementation framing are settled.",
			contract: {
				movement: "Preserve selection while replacing the rendered list.",
				stableLanding:
					"The focused test is green and the branch is reviewable.",
				verificationTarget: "Run the focused test and inspect the browser.",
			},
		}),
	);
	return applyDeveloperEvent(
		state,
		landingRecorded({
			authorizationId: "change:selection-fix",
			changedPaths: ["src/list.ts", "tests/list.test.ts"],
			result: "The selection fix landed and the focused test passes.",
			verification: ["Focused test passed."],
		}),
	);
}

test("Developer workbench indexes implementation landings without treating landing evidence as semantic verification", () => {
	const snapshot = inspectDeveloperWorkbench(landedState(), {
		activeTools: [],
		availableSkills: [],
	});
	const landing = snapshot.sections.find((section) => section.id === "landings")
		?.items[0];
	const detail =
		landing?.blocks.flatMap((block) => block.lines).join("\n") ?? "";

	assert.equal(landing?.state, "verification required");
	assert.match(detail, /Preserve selection while replacing/iu);
	assert.match(detail, /Focused test passed/iu);
	assert.doesNotMatch(landing?.state ?? "", /^verified$/iu);
});

test("Developer workbench surfaces restart recovery before ordinary operations", () => {
	const restartIssue = "Restart Pi before enabling Developer again.";
	const snapshot = inspectDeveloperWorkbench(createRichQaState(), {
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
		/Restart Pi/iu,
	);
});
