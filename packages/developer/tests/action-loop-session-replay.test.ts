import assert from "node:assert/strict";
import test from "node:test";

import {
	pauseLiveWorkCase,
	resumeLivePausedWorkCase,
	resumeLiveWaitingWorkCase,
	waitLiveWorkCase,
} from "../extensions/action-loop-continuity.ts";
import { closeLiveJudgment } from "../extensions/action-loop-conclusion.ts";
import { acceptLiveHostContribution } from "../extensions/action-loop-host-contribution.ts";
import { admitLiveUserPromptObservation } from "../extensions/action-loop-host-observation.ts";
import { assessLiveNeedCoverage } from "../extensions/action-loop-coverage.ts";
import { openLiveJudgment } from "../extensions/action-loop-judgment.ts";
import {
	ACTION_LOOP_SESSION_ENTRY,
	ACTION_LOOP_SESSION_PROTOCOL,
	MAX_ACTION_LOOP_SESSION_EVENT_BYTES,
	actionLoopPausedWorkCaseResumedEvent,
	actionLoopCoverageAssessedEvent,
	actionLoopHostContributionAcceptedEvent,
	actionLoopJudgmentConcludedEvent,
	actionLoopJudgmentOpenedEvent,
	actionLoopWaitingWorkCaseResumedEvent,
	actionLoopWorkCaseOpenedEvent,
	actionLoopWorkCasePausedEvent,
	actionLoopWorkCaseWaitingEvent,
	replayActionLoopSession,
	withActionLoopReplayEvent,
} from "../extensions/action-loop-session.ts";
import { openLiveWorkCase } from "../extensions/action-loop-work-case.ts";
import {
	DEVELOPER_MODE_ENTRY,
	developerModeEvent,
} from "../extensions/developer-mode.ts";

const proposal = {
	outcome: {
		statement: "The active Work Case survives Pi session resume.",
		acceptanceConditions: [
			"The current branch reconstructs the exact canonical Work Case.",
		],
		constraints: ["No separate Developer persistence store is introduced."],
	},
	basis: ["Pi persists the current branch as append-only session entries."],
	provenance: { kind: "model" as const, source: "pi:tool-call" },
};

test("a Pi tool-result replay event reconstructs one exact active Work Case", async () => {
	const opened = openLiveWorkCase(undefined, proposal);
	assert.equal(opened.status, "opened");
	if (opened.status !== "opened") return;
	const event = actionLoopWorkCaseOpenedEvent(proposal, opened.value);
	const details = withActionLoopReplayEvent(
		{ protocol: "developer-action-loop/v1", kind: "opened" },
		event,
	);

	const replayed = await replayActionLoopSession([
		{
			type: "message",
			message: {
				role: "toolResult",
				toolName: "developer_progress_action_loop_with_sdk",
				details,
			},
		},
	]);

	assert.equal(replayed.status, "ready");
	if (replayed.status !== "ready") return;
	assert.equal(
		replayed.activeWorkCase?.workCase.workCaseId,
		opened.value.workCase.workCaseId,
	);
	assert.equal(
		replayed.activeWorkCase?.workCase.revisionId,
		opened.value.workCase.revisionId,
	);
	assert.equal(replayed.appliedTransitions, 1);
});

test("an exact host Contribution replays without Skill material", async () => {
	const opened = openLiveWorkCase(undefined, proposal);
	assert.equal(opened.status, "opened");
	if (opened.status !== "opened") return;
	const judgmentProposal = {
		category: "Contextual Adequacy" as const,
		subject: "Compatibility policy",
		question: "Which compatibility policy did the product owner choose?",
		requirements: [
			{
				statement: "The exact product decision is represented.",
				contributionNeeds: ["An exact product-owner decision"],
			},
		],
		basis: ["Implementation cannot choose product policy."],
		provenance: { kind: "model" as const, source: "pi:tool-call" },
	};
	const judgment = openLiveJudgment(opened.value, judgmentProposal);
	assert.equal(judgment.status, "opened");
	if (judgment.status !== "opened") return;
	const observation = admitLiveUserPromptObservation(
		"Use strict compatibility and reject unknown values.",
		opened.value.workCase.workCaseId,
	);
	assert.equal(observation.status, "admitted");
	if (observation.status !== "admitted") return;
	const hostProposal = {
		localStatus: "resolved" as const,
		result: "Use strict compatibility and reject unknown values.",
		limitations: [],
		residualNeeds: [],
		basis: ["The exact human Observation answers the current Need."],
	};
	const contribution = acceptLiveHostContribution(
		judgment.state,
		observation.observation,
		hostProposal,
	);
	assert.equal(contribution.status, "accepted");
	if (contribution.status !== "accepted") return;
	const replayed = await replayActionLoopSession([
		{
			type: "custom",
			customType: ACTION_LOOP_SESSION_ENTRY,
			data: actionLoopWorkCaseOpenedEvent(proposal, opened.value),
		},
		{
			type: "custom",
			customType: ACTION_LOOP_SESSION_ENTRY,
			data: actionLoopJudgmentOpenedEvent(
				judgmentProposal,
				judgment.judgment.judgmentId,
				judgment.state.workCase.revisionId,
			),
		},
		{
			type: "custom",
			customType: ACTION_LOOP_SESSION_ENTRY,
			data: actionLoopHostContributionAcceptedEvent(
				{
					observationId: observation.observation.observationId,
					kind: observation.observation.kind,
					source: observation.observation.source,
					statement: observation.observation.statement,
					evidenceFingerprint: observation.observation.evidenceFingerprint,
					basis: [...observation.observation.basis],
				},
				hostProposal,
				contribution.contribution.contributionId,
			),
		},
	]);
	assert.equal(replayed.status, "ready");
	if (replayed.status !== "ready") return;
	assert.equal(replayed.activeWorkCase?.contributions.length, 1);
	assert.equal(
		replayed.activeWorkCase?.contributions[0]?.contributionId,
		contribution.contribution.contributionId,
	);
	assert.equal(replayed.appliedTransitions, 3);
});

test("Proportionate Intervention disposition survives semantic event replay", async () => {
	const opened = openLiveWorkCase(undefined, proposal);
	assert.equal(opened.status, "opened");
	if (opened.status !== "opened") return;
	const judgmentProposal = {
		category: "Proportionate Intervention" as const,
		subject: "Whether a bounded host Action is warranted",
		question: "Does current evidence warrant one bounded host Action?",
		requirements: [
			{
				statement: "The intervention disposition is evidence-backed.",
				contributionNeeds: ["An exact current intervention decision"],
			},
		],
		basis: ["The Action decision must remain distinct from its evidence."],
		provenance: { kind: "model" as const, source: "pi:sdk-action-loop" },
	};
	const judgment = openLiveJudgment(opened.value, judgmentProposal);
	assert.equal(judgment.status, "opened");
	if (judgment.status !== "opened") return;
	const need = judgment.judgment.contributionNeeds[0];
	const requirement = judgment.judgment.requirements[0];
	assert.ok(need);
	assert.ok(requirement);
	const observation = admitLiveUserPromptObservation(
		"Preserve the current state; no host Action is warranted.",
		opened.value.workCase.workCaseId,
	);
	assert.equal(observation.status, "admitted");
	if (observation.status !== "admitted") return;
	const hostProposal = {
		contributionNeedId: need.contributionNeedId,
		localStatus: "resolved" as const,
		result: "Current evidence warrants no host Action.",
		limitations: [],
		residualNeeds: [],
		basis: ["The exact human Observation answers the current Need."],
	};
	const contribution = acceptLiveHostContribution(
		judgment.state,
		observation.observation,
		hostProposal,
	);
	assert.equal(contribution.status, "accepted");
	if (contribution.status !== "accepted") return;
	const coverageProposal = {
		contributionNeedId: need.contributionNeedId,
		status: "covered" as const,
		dispositions: [
			{
				contributionId: contribution.contribution.contributionId,
				status: "supports" as const,
				basis: ["The exact current decision fully answers the Need."],
			},
		],
		conflicts: [],
		basis: ["Current relied-on evidence closes the Need."],
		provenance: { kind: "model" as const, source: "pi:sdk-action-loop" },
	};
	const coverage = assessLiveNeedCoverage(contribution.state, coverageProposal);
	assert.equal(coverage.status, "assessed");
	if (coverage.status !== "assessed") return;
	const conclusionProposal = {
		outcome: "conclude" as const,
		answer: "Preserve the current state without a host Action.",
		interventionDisposition: "no-action" as const,
		refusalReasons: [],
		requirementDispositions: [
			{
				requirementId: requirement.requirementId,
				status: "satisfied" as const,
				coverageIds: [coverage.coverage.coverageId],
				basis: ["The exact current decision satisfies the Requirement."],
			},
		],
		basis: ["All current Requirements are covered."],
		provenance: { kind: "model" as const, source: "pi:sdk-action-loop" },
	};
	const concluded = closeLiveJudgment(coverage.state, conclusionProposal);
	assert.equal(concluded.status, "concluded");
	if (concluded.status !== "concluded") return;
	const assuranceProposal = {
		category: "Claim Assurance" as const,
		subject: "Whether the no-change Outcome is currently assured",
		question: "Does current evidence warrant completion without an Action?",
		requirements: [
			{
				statement: "The no-change Outcome is supported by current evidence.",
				contributionNeeds: ["Current evidence for no-change completion"],
			},
		],
		basis: [
			"The prior Proportionate Intervention concluded no Action is needed.",
		],
		provenance: { kind: "model" as const, source: "pi:sdk-action-loop" },
	};
	const assurance = openLiveJudgment(concluded.state, assuranceProposal);
	assert.equal(assurance.status, "opened");
	if (assurance.status !== "opened") return;
	assert.equal(
		assurance.judgment.contextRevisionId,
		concluded.state.workCase.revisionId,
	);

	const replayed = await replayActionLoopSession([
		{
			type: "custom",
			customType: ACTION_LOOP_SESSION_ENTRY,
			data: actionLoopWorkCaseOpenedEvent(proposal, opened.value),
		},
		{
			type: "custom",
			customType: ACTION_LOOP_SESSION_ENTRY,
			data: actionLoopJudgmentOpenedEvent(
				judgmentProposal,
				judgment.judgment.judgmentId,
				judgment.state.workCase.revisionId,
			),
		},
		{
			type: "custom",
			customType: ACTION_LOOP_SESSION_ENTRY,
			data: actionLoopHostContributionAcceptedEvent(
				{
					observationId: observation.observation.observationId,
					kind: observation.observation.kind,
					source: observation.observation.source,
					statement: observation.observation.statement,
					evidenceFingerprint: observation.observation.evidenceFingerprint,
					basis: [...observation.observation.basis],
				},
				hostProposal,
				contribution.contribution.contributionId,
			),
		},
		{
			type: "custom",
			customType: ACTION_LOOP_SESSION_ENTRY,
			data: actionLoopCoverageAssessedEvent(
				coverageProposal,
				coverage.coverage.coverageId,
			),
		},
		{
			type: "custom",
			customType: ACTION_LOOP_SESSION_ENTRY,
			data: actionLoopJudgmentConcludedEvent(
				conclusionProposal,
				concluded.conclusion.conclusionId,
				concluded.state.workCase.revisionId,
			),
		},
		{
			type: "custom",
			customType: ACTION_LOOP_SESSION_ENTRY,
			data: actionLoopJudgmentOpenedEvent(
				assuranceProposal,
				assurance.judgment.judgmentId,
				assurance.state.workCase.revisionId,
			),
		},
	]);
	assert.equal(replayed.status, "ready");
	if (replayed.status !== "ready") return;
	assert.equal(replayed.appliedTransitions, 6);
	assert.equal(
		replayed.activeWorkCase?.workCase.conclusions[0]?.interventionDisposition,
		"no-action",
	);
	assert.equal(
		replayed.activeWorkCase?.workCase.openJudgments[0]?.judgmentId,
		assurance.judgment.judgmentId,
	);
});

test("human pause and resume replay as branch-local ownership transitions", async () => {
	const opened = openLiveWorkCase(undefined, proposal);
	assert.equal(opened.status, "opened");
	if (opened.status !== "opened") return;
	const pauseProposal = {
		workCaseId: opened.value.workCase.workCaseId,
		expectedRevisionId: opened.value.workCase.revisionId,
		reason: "The delegating human requested a bounded pause.",
		decision: {
			kind: "human",
			decisionId: "pi-command-pause-test",
			source: "pi:/developer pause",
			basis: ["The human explicitly invoked the pause command."],
		},
	};
	const paused = pauseLiveWorkCase(opened.value, pauseProposal);
	assert.equal(paused.status, "paused");
	if (paused.status !== "paused") return;
	const openingEntry = {
		type: "message",
		message: {
			role: "toolResult",
			toolName: "developer_progress_action_loop_with_sdk",
			details: withActionLoopReplayEvent(
				{ protocol: "developer-action-loop/v1", kind: "opened" },
				actionLoopWorkCaseOpenedEvent(proposal, opened.value),
			),
		},
	};
	const pauseEntry = {
		type: "custom",
		customType: ACTION_LOOP_SESSION_ENTRY,
		data: actionLoopWorkCasePausedEvent(pauseProposal, paused.state),
	};
	const pausedReplay = await replayActionLoopSession([
		openingEntry,
		pauseEntry,
	]);
	assert.equal(pausedReplay.status, "ready");
	if (pausedReplay.status !== "ready") return;
	assert.equal(pausedReplay.activeWorkCase, undefined);
	assert.equal(
		pausedReplay.heldWorkCase?.workCase.revisionId,
		paused.state.workCase.revisionId,
	);

	const resumeProposal = {
		workCaseId: paused.state.workCase.workCaseId,
		expectedRevisionId: paused.state.workCase.revisionId,
		decision: {
			kind: "human",
			decisionId: "pi-command-resume-test",
			source: "pi:/developer resume",
			basis: ["The human explicitly confirmed the resume command."],
		},
	};
	const resumed = resumeLivePausedWorkCase(paused.state, resumeProposal);
	assert.equal(resumed.status, "active");
	if (resumed.status !== "active") return;
	const resumedReplay = await replayActionLoopSession([
		openingEntry,
		pauseEntry,
		{
			type: "custom",
			customType: ACTION_LOOP_SESSION_ENTRY,
			data: actionLoopPausedWorkCaseResumedEvent(resumeProposal, resumed.state),
		},
	]);
	assert.equal(resumedReplay.status, "ready");
	if (resumedReplay.status !== "ready") return;
	assert.equal(resumedReplay.heldWorkCase, undefined);
	assert.equal(
		resumedReplay.activeWorkCase?.workCase.revisionId,
		resumed.state.workCase.revisionId,
	);
	assert.equal(resumedReplay.appliedTransitions, 3);
});

test("observed wait and predicate-bound resume replay branch-locally", async () => {
	const opened = openLiveWorkCase(undefined, proposal);
	assert.equal(opened.status, "opened");
	if (opened.status !== "opened") return;
	const waitProposal = {
		workCaseId: opened.value.workCase.workCaseId,
		expectedRevisionId: opened.value.workCase.revisionId,
		externalCondition: "The external registry is currently unavailable.",
		resumePredicate: "A bounded registry probe succeeds.",
		observation: {
			kind: "human" as const,
			observationId: "pi-command-wait-test",
			source: "pi:/developer wait",
			basis: [
				"The human observed and reported the current external condition.",
			],
		},
	};
	const waiting = waitLiveWorkCase(opened.value, waitProposal);
	assert.equal(waiting.status, "waiting");
	if (waiting.status !== "waiting") return;
	const openingEntry = {
		type: "message",
		message: {
			role: "toolResult",
			toolName: "developer_progress_action_loop_with_sdk",
			details: withActionLoopReplayEvent(
				{ protocol: "developer-action-loop/v1", kind: "opened" },
				actionLoopWorkCaseOpenedEvent(proposal, opened.value),
			),
		},
	};
	const waitEntry = {
		type: "custom",
		customType: ACTION_LOOP_SESSION_ENTRY,
		data: actionLoopWorkCaseWaitingEvent(waitProposal, waiting.state),
	};
	const waitingReplay = await replayActionLoopSession([
		openingEntry,
		waitEntry,
	]);
	assert.equal(waitingReplay.status, "ready");
	if (waitingReplay.status !== "ready") return;
	assert.equal(waitingReplay.heldWorkCase?.workCase.status, "waiting");
	assert.equal(
		waitingReplay.heldWorkCase?.workCase.revisionId,
		waiting.state.workCase.revisionId,
	);

	const resumeProposal = {
		workCaseId: waiting.state.workCase.workCaseId,
		expectedRevisionId: waiting.state.workCase.revisionId,
		assessment: {
			resumePredicate: waiting.state.workCase.wait.resumePredicate,
			status: "satisfied" as const,
			observationKind: "human" as const,
			observationId: "pi-command-wait-resume-test",
			source: "pi:/developer resume",
			basis: ["The human observed that the exact predicate is now satisfied."],
		},
	};
	const resumed = resumeLiveWaitingWorkCase(waiting.state, resumeProposal);
	assert.equal(resumed.status, "active");
	if (resumed.status !== "active") return;
	const resumedReplay = await replayActionLoopSession([
		openingEntry,
		waitEntry,
		{
			type: "custom",
			customType: ACTION_LOOP_SESSION_ENTRY,
			data: actionLoopWaitingWorkCaseResumedEvent(
				resumeProposal,
				resumed.state,
			),
		},
	]);
	assert.equal(resumedReplay.status, "ready");
	if (resumedReplay.status !== "ready") return;
	assert.equal(resumedReplay.heldWorkCase, undefined);
	assert.equal(
		resumedReplay.activeWorkCase?.workCase.revisionId,
		resumed.state.workCase.revisionId,
	);
	assert.equal(resumedReplay.appliedTransitions, 3);
});

test("duplicate and stale nonterminal transitions fail closed", async () => {
	const opened = openLiveWorkCase(undefined, proposal);
	assert.equal(opened.status, "opened");
	if (opened.status !== "opened") return;
	const pauseProposal = {
		workCaseId: opened.value.workCase.workCaseId,
		expectedRevisionId: opened.value.workCase.revisionId,
		reason: "Pause for adversarial replay checks.",
		decision: {
			kind: "human",
			decisionId: "pi-command-pause-adversarial",
			source: "pi:/developer pause",
			basis: ["The human explicitly invoked the pause command."],
		},
	};
	const paused = pauseLiveWorkCase(opened.value, pauseProposal);
	assert.equal(paused.status, "paused");
	if (paused.status !== "paused") return;
	const openingEntry = {
		type: "message",
		message: {
			role: "toolResult",
			toolName: "developer_progress_action_loop_with_sdk",
			details: withActionLoopReplayEvent(
				{ protocol: "developer-action-loop/v1", kind: "opened" },
				actionLoopWorkCaseOpenedEvent(proposal, opened.value),
			),
		},
	};
	const pauseEvent = actionLoopWorkCasePausedEvent(pauseProposal, paused.state);
	const pauseEntry = {
		type: "custom",
		customType: ACTION_LOOP_SESSION_ENTRY,
		data: pauseEvent,
	};
	const duplicate = await replayActionLoopSession([
		openingEntry,
		pauseEntry,
		pauseEntry,
	]);
	assert.equal(duplicate.status, "unavailable");
	if (duplicate.status === "unavailable") {
		assert.equal(duplicate.entryIndex, 2);
		assert.match(duplicate.message, /cannot mutate paused branch ownership/);
	}

	const resumeProposal = {
		workCaseId: paused.state.workCase.workCaseId,
		expectedRevisionId: paused.state.workCase.revisionId,
		decision: {
			kind: "human",
			decisionId: "pi-command-resume-adversarial",
			source: "pi:/developer resume",
			basis: ["The human explicitly confirmed the resume command."],
		},
	};
	const resumed = resumeLivePausedWorkCase(paused.state, resumeProposal);
	assert.equal(resumed.status, "active");
	if (resumed.status !== "active") return;
	const resumeEvent = actionLoopPausedWorkCaseResumedEvent(
		resumeProposal,
		resumed.state,
	);
	const stale = await replayActionLoopSession([
		openingEntry,
		pauseEntry,
		{
			type: "custom",
			customType: ACTION_LOOP_SESSION_ENTRY,
			data: {
				...resumeEvent,
				proposal: {
					...resumeEvent.proposal,
					expectedRevisionId: "work_case_revision_stale",
				},
			},
		},
	]);
	assert.equal(stale.status, "unavailable");
	if (stale.status === "unavailable") {
		assert.equal(stale.entryIndex, 2);
		assert.match(stale.message, /does not reproduce/);
	}
});

test("a later Developer-off entry clears replayed Action Loop ownership", async () => {
	const opened = openLiveWorkCase(undefined, proposal);
	assert.equal(opened.status, "opened");
	if (opened.status !== "opened") return;
	const replayed = await replayActionLoopSession([
		{
			type: "message",
			message: {
				role: "toolResult",
				toolName: "developer_progress_action_loop_with_sdk",
				details: withActionLoopReplayEvent(
					{ protocol: "developer-action-loop/v1", kind: "opened" },
					actionLoopWorkCaseOpenedEvent(proposal, opened.value),
				),
			},
		},
		{
			type: "custom",
			customType: DEVELOPER_MODE_ENTRY,
			data: developerModeEvent(false),
		},
	]);

	assert.equal(replayed.status, "ready");
	if (replayed.status !== "ready") return;
	assert.equal(replayed.activeWorkCase, undefined);
});

test("an oversized claimed replay event fails before domain replay", async () => {
	const replayed = await replayActionLoopSession([
		{
			type: "custom",
			customType: ACTION_LOOP_SESSION_ENTRY,
			data: {
				protocol: ACTION_LOOP_SESSION_PROTOCOL,
				kind: "action-cleared",
				transitionId: "clearance-oversized",
				proposal: {
					toolName: "write",
					toolInput: {
						content: "x".repeat(MAX_ACTION_LOOP_SESSION_EVENT_BYTES),
					},
					summary: "Oversized session event",
					intendedEffects: ["The event is rejected."],
					requiredConclusionIds: ["conclusion-1"],
				},
				expected: {
					actionCandidateId: "candidate-1",
					actionClearanceId: "clearance-oversized",
					revisionId: "revision-1",
				},
			},
		},
	]);

	assert.equal(replayed.status, "unavailable");
	if (replayed.status !== "unavailable") return;
	assert.match(replayed.message, /malformed or unsupported/i);
});

test("a malformed claimed replay event fails closed instead of becoming absence", async () => {
	const replayed = await replayActionLoopSession([
		{
			type: "message",
			message: {
				role: "toolResult",
				toolName: "developer_progress_action_loop_with_sdk",
				details: {
					replayEvent: {
						protocol: "developer-action-loop/session-event/v1",
						kind: "work-case-opened",
					},
				},
			},
		},
	]);

	assert.equal(replayed.status, "unavailable");
	if (replayed.status !== "unavailable") return;
	assert.equal(replayed.entryIndex, 0);
	assert.match(replayed.message, /malformed/i);
});
