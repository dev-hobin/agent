import assert from "node:assert/strict";
import test from "node:test";

import {
	sdkContributionAcceptedEvent,
	sdkJudgmentConcludedEvent,
	sdkNeedCoverageAssessedEvent,
} from "../extensions/action-loop-sdk-session.ts";
import type { SealedUnstructuredSkillContext } from "../src/action-loop/io/seal-skill-context.ts";
import type { CapabilityAssignment } from "../src/action-loop/routing/accept-applicability.ts";
import { concludeJudgmentWithSdk } from "../src/action-loop/sdk/conclusion-controller.ts";
import { contributeSkillWithSdk } from "../src/action-loop/sdk/contribution-controller.ts";
import type { SdkDecisionRequest } from "../src/action-loop/sdk/decision-controller.ts";
import { inspectContributionProgress } from "../src/action-loop/sdk/contribution-progress.ts";
import {
	assessNeedCoverageWithSdk,
	type SdkCoverageContribution,
} from "../src/action-loop/sdk/coverage-controller.ts";
import { inspectCoverageProgress } from "../src/action-loop/sdk/coverage-progress.ts";
import { scriptedSdkRunner } from "./fixtures/scripted-sdk-runner.ts";

const assignment: CapabilityAssignment = Object.freeze({
	assignmentId: "assignment-sdk-contribution",
	workCaseId: "work-sdk-contribution",
	judgmentId: "judgment-sdk-contribution",
	contributionNeedId: "need-sdk-contribution",
	capabilityId: "capability-sdk-contribution",
	capabilityRevisionId: "capability-revision-sdk-contribution",
	applicabilityBasis: Object.freeze([
		"The source-bound method directly addresses the Need.",
	]),
	matchedWhen: Object.freeze([]),
});

const context: SealedUnstructuredSkillContext = Object.freeze({
	routing: "unstructured",
	sealedContextId: "sealed-sdk-contribution",
	workCaseId: assignment.workCaseId,
	judgmentId: assignment.judgmentId,
	contributionNeedId: assignment.contributionNeedId,
	assignmentId: assignment.assignmentId,
	capabilityId: assignment.capabilityId,
	capabilityRevisionId: assignment.capabilityRevisionId,
	source: Object.freeze({
		kind: "cli",
		locator: "file:///virtual/direct.md",
		skillRoot: ".",
	}),
	skillLocator: "/virtual/direct.md",
	selectedPaths: Object.freeze([] as const),
	materials: Object.freeze([
		Object.freeze({
			kind: "skill",
			path: "direct.md",
			locator: "/virtual/direct.md",
			byteLength: 59,
			hash: "a".repeat(64),
			bytesBase64: "IyBEaXJlY3Q=",
			content:
				"# Direct method\nPreserve one terminal approval across retries.",
		}),
	] as const),
});

const request =
	"Determine how retries preserve one terminal approval without stale replacement.";
const contributionNeed = "A source-bound retry and terminal-state analysis";

test("SDK Contribution remains local and Coverage separately owns synthesis", async () => {
	const contribution = await contributeSkillWithSdk({
		request,
		contributionNeed,
		assignment,
		context,
		runner: scriptedSdkRunner([
			{
				proposals: [
					{
						local_status: "partial",
						result: "Retries should preserve the accepted terminal state.",
						limitations_json: "[]",
						residual_needs_json: "[]",
					},
					{
						local_status: "resolved",
						result:
							"Accept the first terminal approval and classify later stale responses without replacing it.",
						limitations_json: "[]",
						residual_needs_json: "[]",
					},
				],
			},
		]),
	});
	assert.equal(contribution.status, "accepted");
	if (contribution.status !== "accepted") return;
	assert.equal(contribution.contribution.localStatus, "resolved");
	assert.equal(contribution.contribution.assignmentId, assignment.assignmentId);
	assert.equal(contribution.decision.toolCalls, 2);
	assert.equal(contribution.decision.toolErrors, 1);
	assert.equal("coverageId" in contribution.contribution, false);
	const contributionProgress = inspectContributionProgress({
		workCaseId: assignment.workCaseId,
		judgmentId: assignment.judgmentId,
		contexts: [context],
		contributions: [contribution.contribution],
	});
	assert.equal(contributionProgress.status, "complete");
	const contributionEvent = sdkContributionAcceptedEvent({
		skillName: "direct",
		result: contribution,
	});
	assert.equal(contributionEvent.kind, "contribution-accepted");
	assert.equal(
		contributionEvent.expected.contributionId,
		contribution.contribution.contributionId,
	);

	const coverage = await assessNeedCoverageWithSdk({
		request,
		contributionNeed,
		target: {
			workCaseId: assignment.workCaseId,
			judgmentId: assignment.judgmentId,
			contributionNeedId: assignment.contributionNeedId,
		},
		contributions: [contribution.contribution],
		runner: scriptedSdkRunner([
			{
				proposals: [
					{
						status: "missing",
						disposition_status_0: "supports",
						disposition_basis_0:
							"The Contribution directly resolves terminal retry behavior.",
						conflicts_json: "[]",
						basis_json:
							'["The current Contribution is source-bound and locally resolved."]',
					},
					{
						status: "covered",
						disposition_status_0: "supports",
						disposition_basis_0:
							"The Contribution directly resolves terminal retry behavior.",
						conflicts_json: "[]",
						basis_json:
							'["The current Contribution is source-bound and locally resolved."]',
					},
				],
			},
		]),
	});
	assert.equal(coverage.status, "assessed");
	if (coverage.status !== "assessed") return;
	assert.equal(coverage.coverage.status, "covered");
	assert.deepEqual(
		coverage.coverage.dispositions.map(({ contributionId }) => contributionId),
		[contribution.contribution.contributionId],
	);
	assert.equal(coverage.decision.toolCalls, 2);
	assert.equal(coverage.decision.toolErrors, 1);
	const coverageProgress = inspectCoverageProgress({
		workCaseId: assignment.workCaseId,
		judgmentId: assignment.judgmentId,
		contributionNeeds: [
			{
				contributionNeedId: assignment.contributionNeedId,
				requirementId: "requirement-sdk-contribution",
				function: contributionNeed,
			},
		],
		coverages: [coverage.coverage],
	});
	assert.equal(coverageProgress.status, "complete");
	const coverageEvent = sdkNeedCoverageAssessedEvent(coverage);
	assert.equal(coverageEvent.kind, "coverage-assessed");
	assert.equal(coverageEvent.expected.coverageId, coverage.coverage.coverageId);

	const conclusion = await concludeJudgmentWithSdk({
		request,
		contract: {
			workCaseId: assignment.workCaseId,
			judgmentId: assignment.judgmentId,
			category: "Consequence Integrity",
			subject: "Terminal approval retry behavior",
			contextRevisionId: "context-sdk-contribution",
			requirements: [
				{
					requirementId: "requirement-sdk-contribution",
					statement: "Retry behavior preserves one terminal approval.",
					contributionNeedIds: [assignment.contributionNeedId],
				},
			],
		},
		coverages: [coverage.coverage],
		runner: scriptedSdkRunner([
			{
				proposals: [
					{
						outcome: "conclude",
						answer:
							"Accept the first terminal approval and retain later stale responses only as observations.",
						refusal_reasons_json: "[]",
						basis_json:
							'["Current Need Coverage is complete and conflict-free."]',
						requirement_status_0: "satisfied",
						requirement_basis_0:
							"The current covered Need directly satisfies the requirement.",
					},
				],
			},
		]),
	});
	assert.equal(conclusion.status, "concluded");
	if (conclusion.status !== "concluded") return;
	assert.deepEqual(conclusion.conclusion.coverageIds, [
		coverage.coverage.coverageId,
	]);
	const conclusionEvent = sdkJudgmentConcludedEvent({
		result: conclusion,
		revisionId: "revision-after-conclusion",
	});
	assert.equal(conclusionEvent.kind, "judgment-concluded");
	assert.equal(
		conclusionEvent.expected.conclusionId,
		conclusion.conclusion.conclusionId,
	);

	const intervention = await concludeJudgmentWithSdk({
		request,
		contract: {
			workCaseId: assignment.workCaseId,
			judgmentId: assignment.judgmentId,
			category: "Proportionate Intervention",
			subject: "Whether current state requires a host Action",
			contextRevisionId: "context-sdk-contribution",
			requirements: [
				{
					requirementId: "requirement-sdk-contribution",
					statement: "The proportionate intervention is explicit.",
					contributionNeedIds: [assignment.contributionNeedId],
				},
			],
		},
		coverages: [coverage.coverage],
		runner: scriptedSdkRunner([
			{
				proposals: [
					{
						outcome: "conclude",
						answer: "Current state should remain unchanged.",
						intervention_disposition: "no-action",
						refusal_reasons_json: "[]",
						basis_json:
							'["Current Need Coverage supports preserving current state."]',
						requirement_status_0: "satisfied",
						requirement_basis_0:
							"The current covered Need supports no host Action.",
					},
				],
			},
		]),
	});
	assert.equal(intervention.status, "concluded");
	if (intervention.status !== "concluded") return;
	assert.equal(intervention.conclusion.interventionDisposition, "no-action");
});

test("SDK Contribution bounded stop admits no canonical Contribution", async () => {
	const result = await contributeSkillWithSdk({
		request,
		contributionNeed,
		assignment,
		context,
		runner: scriptedSdkRunner([{ result: "time-budget" }]),
	});
	assert.equal(result.status, "bounded-stop");
	if (result.status !== "bounded-stop") return;
	assert.equal(result.reason, "decision-time-budget");
	assert.equal("contribution" in result, false);
});

test("SDK Coverage can canonically report a missing Need with no Contributions", async () => {
	const result = await assessNeedCoverageWithSdk({
		request,
		contributionNeed,
		target: {
			workCaseId: assignment.workCaseId,
			judgmentId: assignment.judgmentId,
			contributionNeedId: assignment.contributionNeedId,
		},
		contributions: [],
		runner: scriptedSdkRunner([
			{
				proposals: [
					{
						status: "missing",
						conflicts_json: "[]",
						basis_json:
							'["No current Contribution addresses the requested function."]',
					},
				],
			},
		]),
	});
	assert.equal(result.status, "assessed");
	if (result.status !== "assessed") return;
	assert.equal(result.coverage.status, "missing");
	assert.deepEqual(result.coverage.dispositions, []);

	const refusal = await concludeJudgmentWithSdk({
		request,
		contract: {
			workCaseId: assignment.workCaseId,
			judgmentId: assignment.judgmentId,
			category: "Proportionate Intervention",
			subject: "Whether retry behavior warrants an intervention",
			contextRevisionId: "context-sdk-contribution",
			requirements: [
				{
					requirementId: "requirement-sdk-contribution",
					statement: "Retry behavior warrants a proportionate intervention.",
					contributionNeedIds: [assignment.contributionNeedId],
				},
			],
		},
		coverages: [result.coverage],
		runner: scriptedSdkRunner([
			{
				proposals: [
					{
						outcome: "refuse",
						refusal_reasons_json:
							'["No current Contribution supports the required retry behavior."]',
						basis_json: '["Current Need Coverage is explicitly missing."]',
						requirement_status_0: "not-satisfied",
						requirement_basis_0: "The mapped Need has missing Coverage.",
					},
				],
			},
		]),
	});
	assert.equal(refusal.status, "refused");
	if (refusal.status !== "refused") return;
	assert.ok(refusal.refusal.blockers.length > 0);
	assert.equal("conclusion" in refusal, false);
});

test("SDK Coverage synthesis is not capped by its weakest Contribution", async () => {
	const target = {
		workCaseId: assignment.workCaseId,
		judgmentId: assignment.judgmentId,
		contributionNeedId: assignment.contributionNeedId,
	};
	const contributions: SdkCoverageContribution[] = [
		{
			...target,
			contributionId: "contribution-strong",
			localStatus: "resolved",
			result: "Current runtime evidence fully establishes the bounded Need.",
			limitations: [],
		},
		{
			...target,
			contributionId: "contribution-weak",
			localStatus: "partial",
			result: "Earlier path-string evidence omitted runtime resolution.",
			limitations: ["It cannot resolve symbolic links."],
		},
	];
	let systemPrompt = "";
	const delegated = scriptedSdkRunner([
		{
			proposals: [
				{
					status: "covered",
					disposition_status_0: "supports",
					disposition_basis_0:
						"The current runtime evidence fully answers the Need.",
					disposition_status_1: "not-relied-on",
					disposition_basis_1:
						"The earlier weaker evidence is superseded for this synthesis.",
					conflicts_json: "[]",
					basis_json:
						'["The relied-on current evidence closes the Need without depending on the weaker Contribution."]',
				},
			],
		},
	]);
	const runner = {
		async run<T>(decision: SdkDecisionRequest<T>) {
			systemPrompt = decision.systemPrompt;
			return delegated.run(decision);
		},
	};
	const result = await assessNeedCoverageWithSdk({
		request,
		contributionNeed,
		target,
		contributions,
		runner,
	});
	assert.equal(result.status, "assessed");
	if (result.status !== "assessed") return;
	assert.equal(result.coverage.status, "covered");
	assert.deepEqual(
		result.coverage.dispositions.map(({ status }) => status),
		["supports", "not-relied-on"],
	);
	assert.match(systemPrompt, /not from the weakest individual Contribution/);
	assert.match(systemPrompt, /does not cap Coverage/);
});
