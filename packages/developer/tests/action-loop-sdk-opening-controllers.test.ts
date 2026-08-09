import assert from "node:assert/strict";
import test from "node:test";

import type { SdkDecisionRequest } from "../src/action-loop/sdk/decision-controller.ts";
import { openJudgmentWithSdk } from "../src/action-loop/sdk/judgment-controller.ts";
import { openWorkCaseWithSdk } from "../src/action-loop/sdk/work-case-controller.ts";
import { scriptedSdkRunner } from "./fixtures/scripted-sdk-runner.ts";

const request =
	"Determine whether a retryable payment authorization model is complete and evidence-backed.";

function workCaseProposal(): Record<string, unknown> {
	return {
		statement:
			"A complete retryable payment authorization model is available for review.",
		acceptance_conditions_json: JSON.stringify([
			"Lifecycle states and transitions are explicit.",
			"Stale, duplicate, and reordered responses are distinguished.",
		]),
		constraints_json: JSON.stringify([
			"Do not modify workspace files.",
			"Do not invent unsettled product policy.",
		]),
		basis_json: JSON.stringify([
			"The delegated request explicitly asks for this bounded model.",
		]),
	};
}

function judgmentProposal(): Record<string, unknown> {
	return {
		category: "Consequence Integrity",
		subject: "Retryable payment authorization lifecycle",
		question:
			"Which state and time rules are required for safe and progressing authorization?",
		requirements_json: JSON.stringify([
			{
				statement:
					"The model distinguishes every consequential lifecycle and response-order case.",
				contribution_needs: [
					"A condition model of state, retry, identity, and temporal behavior",
				],
			},
		]),
		basis_json: JSON.stringify([
			"The Outcome depends on explicit consequences and forbidden transitions.",
		]),
	};
}

test("SDK opening pipeline refines text proposals into one Work Case and Judgment", async () => {
	const runner = scriptedSdkRunner([
		{
			proposals: [
				{
					...workCaseProposal(),
					acceptance_conditions_json: "not-json",
				},
				workCaseProposal(),
			],
		},
		{ proposals: [judgmentProposal()] },
	]);
	const opened = await openWorkCaseWithSdk({ request, runner });
	assert.equal(opened.status, "opened");
	if (opened.status !== "opened") return;
	assert.match(opened.workCase.workCaseId, /^work_case_[a-f0-9]{64}$/);
	assert.equal(opened.decision.toolCalls, 2);
	assert.equal(opened.decision.toolErrors, 1);
	assert.deepEqual(opened.workCase.outcome.acceptanceConditions, [
		"Lifecycle states and transitions are explicit.",
		"Stale, duplicate, and reordered responses are distinguished.",
	]);

	const judgment = await openJudgmentWithSdk({
		request,
		workCase: opened.workCase,
		contextRevisionId: opened.workCase.revisionId,
		runner,
	});
	assert.equal(judgment.status, "opened");
	if (judgment.status !== "opened") return;
	assert.match(judgment.judgment.judgmentId, /^open_judgment_[a-f0-9]{64}$/);
	assert.equal(judgment.workCase.openJudgments.length, 1);
	assert.equal(judgment.judgment.contributionNeeds.length, 1);
	assert.equal(
		judgment.judgment.contributionNeeds[0]?.function,
		"A condition model of state, retry, identity, and temporal behavior",
	);
	assert.equal(judgment.decision.toolCalls, 1);
});

test("SDK Judgment opening rejects unadmitted contribution functions before canonical state", async () => {
	const openingRunner = scriptedSdkRunner([
		{ proposals: [workCaseProposal()] },
	]);
	const opened = await openWorkCaseWithSdk({ request, runner: openingRunner });
	assert.equal(opened.status, "opened");
	if (opened.status !== "opened") return;
	const admitted =
		"A condition model of state, retry, identity, and temporal behavior";
	const invalid = {
		...judgmentProposal(),
		requirements_json: JSON.stringify([
			{
				statement: "The contract must be re-proved before any Action.",
				contribution_needs: [
					"Invent a parallel proof of the trusted host Action contract",
				],
			},
		]),
	};
	const runner = scriptedSdkRunner([
		{ proposals: [invalid, judgmentProposal()] },
	]);
	const judgment = await openJudgmentWithSdk({
		request,
		workCase: opened.workCase,
		contextRevisionId: opened.workCase.revisionId,
		admissibleContributionFunctions: [admitted],
		runner,
	});
	assert.equal(judgment.status, "opened");
	if (judgment.status !== "opened") return;
	assert.equal(judgment.decision.toolCalls, 2);
	assert.equal(judgment.decision.toolErrors, 1);
	assert.deepEqual(
		judgment.judgment.contributionNeeds.map(({ function: value }) => value),
		[admitted],
	);
});

test("SDK Work Case opening keeps target and scope bounded to the delegation", async () => {
	let systemPrompt = "";
	const delegated = scriptedSdkRunner([{ proposals: [workCaseProposal()] }]);
	const runner = {
		async run<T>(decision: SdkDecisionRequest<T>) {
			systemPrompt = decision.systemPrompt;
			return delegated.run(decision);
		},
	};
	const opened = await openWorkCaseWithSdk({ request, runner });

	assert.equal(opened.status, "opened");
	assert.match(systemPrompt, /desired observable target, not a claim/);
	assert.match(systemPrompt, /success properties explicitly requested/);
	assert.match(systemPrompt, /Do not invent stronger atomicity, metadata/);
	assert.match(systemPrompt, /never promote them to post-Action evidence/);
});

test("SDK Judgment opening keeps sequential Warrant Gaps independently closable", async () => {
	const openingRunner = scriptedSdkRunner([
		{ proposals: [workCaseProposal()] },
	]);
	const opened = await openWorkCaseWithSdk({ request, runner: openingRunner });
	assert.equal(opened.status, "opened");
	if (opened.status !== "opened") return;

	let systemPrompt = "";
	let decisionPrompt = "";
	const delegated = scriptedSdkRunner([{ proposals: [judgmentProposal()] }]);
	const runner = {
		async run<T>(decision: SdkDecisionRequest<T>) {
			systemPrompt = decision.systemPrompt;
			decisionPrompt = decision.prompt;
			return delegated.run(decision);
		},
	};
	const judgment = await openJudgmentWithSdk({
		request,
		workCase: opened.workCase,
		contextRevisionId: opened.workCase.revisionId,
		availableEvidenceFunctions: [
			"Read exact text blocks for one known file path; directory enumeration is unavailable.",
		],
		admissibleContributionFunctions: [
			"A condition model of state, retry, identity, and temporal behavior",
		],
		runner,
	});
	assert.equal(judgment.status, "opened");
	assert.match(
		decisionPrompt,
		/available_pre_conclusion_evidence[\s\S]*directory enumeration is unavailable/,
	);
	assert.match(
		decisionPrompt,
		/admissible_contribution_functions[\s\S]*A condition model of state, retry, identity, and temporal behavior/,
	);
	assert.match(systemPrompt, /controller rejects every unlisted function/);
	assert.match(systemPrompt, /whole-workspace pre-Action baseline/i);
	assert.match(
		systemPrompt,
		/Controlled Action contracts are deliberately absent from the admitted evidence-operation domain/,
	);
	assert.match(
		systemPrompt,
		/external condition is unavailable[\s\S]*one aggregate Requirement with one Contribution Need/,
	);
	assert.match(
		systemPrompt,
		/Claim Assurance after a no-action Conclusion[\s\S]*one aggregate Requirement/,
	);
	assert.match(
		systemPrompt,
		/evidence available before this Judgment's Conclusion/,
	);
	assert.match(
		systemPrompt,
		/define the target specification, not evidence that the target is attained/,
	);
	assert.match(
		systemPrompt,
		/Treat explicit pre-Action facts in delegated_request as human-provenance evidence at their stated granularity/,
	);
	assert.match(
		systemPrompt,
		/they never establish later Action or Effect success/,
	);
	assert.match(
		systemPrompt,
		/assigned sealed Skill Context or an exact Host Observation/,
	);
	assert.match(
		systemPrompt,
		/Proportionate Intervention decides whether current evidence warrants a next Action/,
	);
	assert.match(
		systemPrompt,
		/Claim Assurance opens only when the trusted controller requires it/,
	);
});

test("SDK Judgment opening rejects unsolicited initial Claim Assurance", async () => {
	const runner = scriptedSdkRunner([
		{ proposals: [workCaseProposal()] },
		{
			proposals: [
				{
					...judgmentProposal(),
					category: "Claim Assurance",
					question: "Does current evidence support the complete Outcome claim?",
				},
				judgmentProposal(),
			],
		},
	]);
	const opened = await openWorkCaseWithSdk({ request, runner });
	assert.equal(opened.status, "opened");
	if (opened.status !== "opened") return;
	const judgment = await openJudgmentWithSdk({
		request,
		workCase: opened.workCase,
		contextRevisionId: opened.workCase.revisionId,
		runner,
	});

	assert.equal(judgment.status, "opened");
	if (judgment.status !== "opened") return;
	assert.equal(judgment.judgment.category, "Consequence Integrity");
	assert.equal(judgment.decision.toolCalls, 2);
	assert.equal(judgment.decision.toolErrors, 1);
});

test("SDK Judgment opening enforces a controller-required Category", async () => {
	const runner = scriptedSdkRunner([
		{ proposals: [workCaseProposal()] },
		{
			proposals: [
				judgmentProposal(),
				{
					...judgmentProposal(),
					category: "Claim Assurance",
					question: "Does current evidence support the complete Outcome claim?",
				},
			],
		},
	]);
	const opened = await openWorkCaseWithSdk({ request, runner });
	assert.equal(opened.status, "opened");
	if (opened.status !== "opened") return;
	const judgment = await openJudgmentWithSdk({
		request,
		workCase: opened.workCase,
		contextRevisionId: opened.workCase.revisionId,
		requiredCategory: "Claim Assurance",
		runner,
	});
	assert.equal(judgment.status, "opened");
	if (judgment.status !== "opened") return;
	assert.equal(judgment.judgment.category, "Claim Assurance");
	assert.equal(judgment.decision.toolCalls, 2);
	assert.equal(judgment.decision.toolErrors, 1);
});

test("SDK Judgment opening refuses to replace current canonical ownership", async () => {
	const openingRunner = scriptedSdkRunner([
		{ proposals: [workCaseProposal()] },
		{ proposals: [judgmentProposal()] },
	]);
	const opened = await openWorkCaseWithSdk({
		request,
		runner: openingRunner,
	});
	assert.equal(opened.status, "opened");
	if (opened.status !== "opened") return;
	const first = await openJudgmentWithSdk({
		request,
		workCase: opened.workCase,
		contextRevisionId: opened.workCase.revisionId,
		runner: openingRunner,
	});
	assert.equal(first.status, "opened");
	if (first.status !== "opened") return;

	const replacement = await openJudgmentWithSdk({
		request: "Open a different Judgment.",
		workCase: first.workCase,
		contextRevisionId: first.workCase.revisionId,
		runner: scriptedSdkRunner([]),
	});
	assert.equal(replacement.status, "active-judgment-exists");
	if (replacement.status !== "active-judgment-exists") return;
	assert.equal(replacement.judgment.judgmentId, first.judgment.judgmentId);
});

test("SDK Work Case opening reports bounded stops without state", async () => {
	const runBudget = await openWorkCaseWithSdk({
		request,
		runner: scriptedSdkRunner([{ result: "bounded-stop" }]),
	});
	assert.equal(runBudget.status, "bounded-stop");
	assert.equal("workCase" in runBudget, false);

	const timeBudget = await openWorkCaseWithSdk({
		request,
		runner: scriptedSdkRunner([{ result: "time-budget" }]),
	});
	assert.equal(timeBudget.status, "bounded-stop");
	if (timeBudget.status !== "bounded-stop") return;
	assert.equal(timeBudget.reason, "decision-time-budget");
	assert.equal("workCase" in timeBudget, false);
});
