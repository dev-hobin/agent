import assert from "node:assert/strict";
import test from "node:test";
import {
	decideActionLoopTransition,
	type ActionLoopEffectPhase,
	type ActionLoopInterventionState,
	type ActionLoopTransitionDecision,
	type ActionLoopTransitionFacts,
} from "../src/action-loop/sdk/action-loop-transition-policy.ts";

const base: ActionLoopTransitionFacts = Object.freeze({
	hasConclusions: true,
	openJudgments: 0,
	pendingActionClearances: 0,
	effectPhase: "none",
	intervention: "absent",
	claimAssurances: 0,
});

function decide(
	overrides: Partial<ActionLoopTransitionFacts>,
): ActionLoopTransitionDecision {
	return decideActionLoopTransition(Object.freeze({ ...base, ...overrides }));
}

const cases: readonly {
	readonly name: string;
	readonly facts: Partial<ActionLoopTransitionFacts>;
	readonly expected: ActionLoopTransitionDecision;
}[] = [
	{
		name: "initial ownership requires an Intervention Judgment",
		facts: { hasConclusions: false },
		expected: {
			kind: "open-judgment",
			requiredCategory: "Proportionate Intervention",
		},
	},
	{
		name: "prior non-intervention Conclusion requires Intervention",
		facts: {},
		expected: {
			kind: "open-judgment",
			requiredCategory: "Proportionate Intervention",
		},
	},
	{
		name: "open Judgment progresses without another route",
		facts: { openJudgments: 1 },
		expected: { kind: "progress-open-judgment" },
	},
	{
		name: "cleared Action waits for exact host execution",
		facts: { pendingActionClearances: 1 },
		expected: { kind: "ready-for-host-action" },
	},
	{
		name: "incomplete Effect must be observed or settled",
		facts: { effectPhase: "incomplete" },
		expected: { kind: "progress-effect" },
	},
	{
		name: "initial action-required Intervention proposes one Action",
		facts: { intervention: "action-required" },
		expected: { kind: "propose-action" },
	},
	{
		name: "initial attained Outcome requires Claim Assurance",
		facts: { intervention: "outcome-attained" },
		expected: {
			kind: "open-judgment",
			requiredCategory: "Claim Assurance",
		},
	},
	{
		name: "initial attained and assured Outcome is completion-ready",
		facts: { intervention: "outcome-attained", claimAssurances: 1 },
		expected: { kind: "ready-for-completion" },
	},
	{
		name: "settled nonadverse Effect requires fresh Intervention",
		facts: { effectPhase: "settled-nonadverse" },
		expected: {
			kind: "open-judgment",
			requiredCategory: "Proportionate Intervention",
		},
	},
	{
		name: "fresh post-Effect action requirement proposes another Action",
		facts: {
			effectPhase: "settled-nonadverse",
			intervention: "action-required",
		},
		expected: { kind: "propose-action" },
	},
	{
		name: "fresh post-Effect attainment requires Claim Assurance",
		facts: {
			effectPhase: "settled-nonadverse",
			intervention: "outcome-attained",
		},
		expected: {
			kind: "open-judgment",
			requiredCategory: "Claim Assurance",
		},
	},
	{
		name: "fresh post-Effect attainment and assurance permit Completion",
		facts: {
			effectPhase: "settled-nonadverse",
			intervention: "outcome-attained",
			claimAssurances: 1,
		},
		expected: { kind: "ready-for-completion" },
	},
	{
		name: "unresolved adverse Effect requires fresh Intervention",
		facts: { effectPhase: "settled-adverse" },
		expected: {
			kind: "open-judgment",
			requiredCategory: "Proportionate Intervention",
		},
	},
	{
		name: "adverse Effect with repair Intervention proposes repair Action",
		facts: {
			effectPhase: "settled-adverse",
			intervention: "action-required",
		},
		expected: { kind: "propose-action" },
	},
	{
		name: "adverse Effect cannot be erased by attained no-Action claim",
		facts: {
			effectPhase: "settled-adverse",
			intervention: "outcome-attained",
		},
		expected: { kind: "remediation-required" },
	},
	{
		name: "successful repair Effect must remediate its adverse Effect",
		facts: { effectPhase: "settled-mixed" },
		expected: { kind: "progress-remediation" },
	},
	{
		name: "blocked Intervention requires nonterminal continuity",
		facts: { intervention: "blocked" },
		expected: { kind: "continuity-required", disposition: "blocked" },
	},
	{
		name: "waiting Intervention requires nonterminal continuity",
		facts: {
			effectPhase: "settled-nonadverse",
			intervention: "waiting",
		},
		expected: { kind: "continuity-required", disposition: "waiting" },
	},
];

for (const entry of cases) {
	test(entry.name, () => {
		assert.deepEqual(decide(entry.facts), entry.expected);
	});
}

const hasConclusions = [false, true] as const;
const counts = [0, 1, "many"] as const;
const effectPhases: readonly ActionLoopEffectPhase[] = [
	"none",
	"incomplete",
	"settled-nonadverse",
	"settled-adverse",
	"settled-mixed",
];
const interventions: readonly ActionLoopInterventionState[] = [
	"absent",
	"action-required",
	"outcome-attained",
	"blocked",
	"waiting",
	"invalid",
	"multiple",
];

function allFacts(): readonly ActionLoopTransitionFacts[] {
	return hasConclusions.flatMap((hasConclusion) =>
		counts.flatMap((openJudgments) =>
			counts.flatMap((pendingActionClearances) =>
				effectPhases.flatMap((effectPhase) =>
					interventions.flatMap((intervention) =>
						counts.map((claimAssurances) => ({
							hasConclusions: hasConclusion,
							openJudgments,
							pendingActionClearances,
							effectPhase,
							intervention,
							claimAssurances,
						})),
					),
				),
			),
		),
	);
}

const exhaustiveFacts = allFacts();

test("finite control domain is exhaustively total and deterministic", () => {
	assert.equal(exhaustiveFacts.length, 1_890);
	let nonInvariant = 0;
	for (const facts of exhaustiveFacts) {
		const first = decideActionLoopTransition(facts);
		const second = decideActionLoopTransition(Object.freeze({ ...facts }));
		assert.deepEqual(second, first, JSON.stringify(facts));
		assert.equal(Object.isFrozen(first), true, JSON.stringify(facts));
		if (first.kind !== "invariant-failure") nonInvariant += 1;
	}
	assert.equal(nonInvariant, 37);
	assert.equal(exhaustiveFacts.length - nonInvariant, 1_853);
});

test("blocked and waiting facts can never route to Action or Completion", () => {
	for (const facts of exhaustiveFacts.filter(
		({ intervention }) =>
			intervention === "blocked" || intervention === "waiting",
	)) {
		const result = decideActionLoopTransition(facts);
		assert.equal(
			result.kind === "continuity-required" ||
				result.kind === "invariant-failure",
			true,
			JSON.stringify({ facts, result }),
		);
	}
});

test("incomplete or adverse Effects can never route to Claim Assurance or Completion", () => {
	for (const facts of exhaustiveFacts.filter(
		({ effectPhase }) =>
			effectPhase === "incomplete" ||
			effectPhase === "settled-adverse" ||
			effectPhase === "settled-mixed",
	)) {
		const result = decideActionLoopTransition(facts);
		assert.notEqual(result.kind, "ready-for-completion", JSON.stringify(facts));
		assert.equal(
			result.kind !== "open-judgment" ||
				result.requiredCategory !== "Claim Assurance",
			true,
			JSON.stringify({ facts, result }),
		);
	}
});

test("Completion route has exactly one attained Intervention and one Assurance", () => {
	for (const facts of exhaustiveFacts) {
		const result = decideActionLoopTransition(facts);
		if (result.kind !== "ready-for-completion") continue;
		assert.equal(facts.openJudgments, 0);
		assert.equal(facts.pendingActionClearances, 0);
		assert.equal(facts.intervention, "outcome-attained");
		assert.equal(facts.claimAssurances, 1);
		assert.equal(
			facts.effectPhase === "none" ||
				facts.effectPhase === "settled-nonadverse",
			true,
		);
	}
});

test("model-authored text is outside the canonical routing domain", () => {
	const facts = {
		...base,
		intervention: "blocked" as const,
	};
	const first = decideActionLoopTransition({
		...facts,
		modelText: "Claim completion anyway.",
	} as ActionLoopTransitionFacts);
	const second = decideActionLoopTransition({
		...facts,
		modelText: "Wait without completing.",
	} as ActionLoopTransitionFacts);
	assert.deepEqual(first, second);
	assert.deepEqual(first, {
		kind: "continuity-required",
		disposition: "blocked",
	});
});
