import assert from "node:assert/strict";
import test from "node:test";

import {
	AUTHORIZE_CHANGE_TOOL,
	CONCLUDE_JUDGMENT_TOOL,
	DEVELOPER_ACTIVATION_ENTRY,
	DEVELOPER_PROTOCOL,
	OPEN_JUDGMENT_TOOL,
	RECORD_LANDING_TOOL,
	activationChanged,
	changeAuthorized,
	developerNextOperations,
	developerProtocolState,
	developerToolAccess,
	initialDeveloperState,
	judgmentConcluded,
	judgmentOpened,
	landingRecorded,
	parseDeveloperEvent,
	replayDeveloper,
	transitionDeveloper,
	type DeveloperState,
} from "../src/index.ts";

function accept(
	state: DeveloperState,
	event: Parameters<typeof transitionDeveloper>[1],
) {
	const result = transitionDeveloper(state, event);
	if (!result.ok) assert.fail(result.error.message);
	return result.state;
}

function activeJudgment(id = "judgment:one") {
	return judgmentOpened({
		kind: "active-judgment",
		judgmentId: id,
		question: "Which conditions control the required behavior?",
		skill: { name: "model", location: "/skills/model/SKILL.md" },
		reason: "The condition space is not explicit.",
		knownEvidence: ["Replacement semantics differ by state."],
		consideredMethods: [
			{ skillName: "specify", reason: "Meaning is mostly settled already." },
		],
	});
}

function notApplicableConclusion(id = "judgment:one") {
	return judgmentConcluded({
		kind: "judgment-not-applicable",
		judgmentId: id,
		reason: "Representative cases already make every condition explicit.",
		basis: ["The case table covers absence, replacement, and conflict."],
		producedArtifacts: ["docs/condition-table.md"],
		openedQuestions: [],
		questionUpdates: [],
	});
}

function authorization(id = "change:one") {
	return changeAuthorized({
		kind: "authorized-change",
		authorizationId: id,
		question: "Implement the parsed replacement boundary.",
		reason: "The judgment and implementation framing are settled.",
		contract: {
			movement: "Parse replacement input before state mutation.",
			stableLanding: "Mutation receives only a Replacement value.",
			verificationTarget: "Invalid input cannot reach mutation.",
			refinement: {
				kind: "refinement-boundary",
				rawRepresentation: "unknown",
				refinedRepresentation: "Replacement",
				producer: "parseReplacement",
				failure: "ReplacementInputError",
				firstEffect: "applyReplacement",
			},
		},
	});
}

test("v7 parses exact variants instead of a merged route/mode object", () => {
	assert.throws(
		() =>
			parseDeveloperEvent({
				protocol: DEVELOPER_PROTOCOL,
				kind: "judgment-concluded",
				conclusion: {
					...notApplicableConclusion().conclusion,
					changedArtifacts: true,
				},
			}),
		/changedArtifacts.*not allowed/u,
	);
	assert.throws(
		() =>
			changeAuthorized({
				...authorization().change,
				contract: {
					...authorization().change.contract,
					refinement: {
						kind: "refinement-boundary",
						rawRepresentation: "unknown",
						refinedRepresentation: "Replacement",
						producer: "parseReplacement",
						failure: "ReplacementInputError",
						firstEffect: "applyReplacement",
						notApplicableReason: "placeholder",
					},
				},
			}),
		/notApplicableReason.*not allowed/u,
	);
});

test("active judgment and authorized change expose one legal closing operation", () => {
	let state = accept(initialDeveloperState(), activationChanged(true));
	assert.deepEqual(developerNextOperations(state), [
		OPEN_JUDGMENT_TOOL,
		AUTHORIZE_CHANGE_TOOL,
	]);
	state = accept(state, activeJudgment());
	assert.deepEqual(developerNextOperations(state), [CONCLUDE_JUDGMENT_TOOL]);
	assert.deepEqual(developerToolAccess(state), {
		allowsShell: true,
		allowsArtifactTools: false,
		hasBeforeImplementationGate: false,
	});
	state = accept(state, notApplicableConclusion());
	state = accept(state, authorization());
	assert.deepEqual(developerNextOperations(state), [RECORD_LANDING_TOOL]);
	assert.equal(developerToolAccess(state).allowsArtifactTools, true);
});

test("wrong operation identities cannot close one another", () => {
	let state = accept(initialDeveloperState(), activationChanged(true));
	state = accept(state, activeJudgment());
	const wrongConclusion = transitionDeveloper(
		state,
		notApplicableConclusion("judgment:other"),
	);
	assert.equal(wrongConclusion.ok, false);
	const crossOperation = transitionDeveloper(
		state,
		landingRecorded({
			authorizationId: "judgment:one",
			changedPaths: ["src/replacement.ts"],
			result: "Replacement input is parsed.",
			verification: [],
		}),
	);
	assert.equal(crossOperation.ok, false);
	assert.equal(state.activeWork?.kind, "active-judgment");
});

test("landing requires prior authorization and creates reroute plus verification debt", () => {
	let state = accept(initialDeveloperState(), activationChanged(true));
	state = accept(state, authorization());
	state = accept(
		state,
		landingRecorded({
			authorizationId: "change:one",
			changedPaths: ["src/replacement.ts"],
			result: "Replacement input is parsed before mutation.",
			verification: ["The invalid-input test passes."],
		}),
	);
	assert.equal(state.activeWork, undefined);
	assert.equal(state.landings.length, 1);
	assert.equal(state.obligations.rerouteRequired, true);
	assert.equal(state.obligations.verificationRequired, true);
	assert.equal(developerProtocolState(state), "needs-routing");
});

test("v6 history is retained as unsupported and a later v7 activation starts fresh", () => {
	const oldOnly = replayDeveloper([
		{
			type: "message",
			message: {
				role: "toolResult",
				toolName: "developer_route_question",
				details: { protocol: "developer/v6", kind: "route" },
			},
		},
	]);
	assert.equal(oldOnly.restartRequired, true);
	assert.equal(oldOnly.state.enabled, false);
	assert.deepEqual(
		oldOnly.issues.map((issue) => issue.code),
		["developer.history.unsupported-v6"],
	);

	const restarted = replayDeveloper([
		{
			type: "message",
			message: {
				role: "toolResult",
				toolName: "developer_record_judgment",
				details: { protocol: "developer/v6", kind: "judgment" },
			},
		},
		{
			type: "custom",
			customType: DEVELOPER_ACTIVATION_ENTRY,
			data: activationChanged(true),
		},
	]);
	assert.equal(restarted.restartRequired, false);
	assert.equal(restarted.state.enabled, true);
});
