import assert from "node:assert/strict";
import test from "node:test";
import {
	assessLiveCapabilityApplicability,
	assignedLiveCapability,
} from "../extensions/action-loop-applicability.ts";
import { openLiveJudgment } from "../extensions/action-loop-judgment.ts";
import { openLiveWorkCase } from "../extensions/action-loop-work-case.ts";
import {
	bindCapability,
	bindUnstructuredCapability,
} from "../src/action-loop/routing/bind-capability.ts";
import {
	parseTocBytes,
	SKILL_TOC_SCHEMA_URI,
} from "../src/action-loop/routing/parse-toc.ts";

const encoder = new TextEncoder();
const declaredWhen = "A concrete current Claim requires evidence.";

function structuredCapability() {
	const parsed = parseTocBytes(
		encoder.encode(
			JSON.stringify({
				$schema: SKILL_TOC_SCHEMA_URI,
				when: [declaredWhen],
				unless: ["No concrete current Claim exists."],
				references: [],
			}),
		),
	);
	if (!parsed.ok) throw new Error(parsed.error.message);
	const bound = bindCapability(
		{
			kind: "package",
			locator: "npm:@hobin/developer",
			skillRoot: "skills/verify",
		},
		parsed.value,
		encoder.encode("---\nname: verify\n---\n"),
	);
	if (!bound.ok) throw new Error(bound.error.message);
	return { capability: bound.value };
}

function unstructuredCapability() {
	const bound = bindUnstructuredCapability(
		{
			kind: "package",
			locator: "npm:@hobin/developer",
			skillRoot: "skills/specify",
		},
		encoder.encode("---\nname: specify\n---\n"),
	);
	if (!bound.ok) throw new Error(bound.error.message);
	return { capability: bound.value };
}

function liveState() {
	const work = openLiveWorkCase(undefined, {
		outcome: {
			statement: "The current Claim is assessed with admitted evidence.",
			acceptanceConditions: [
				"The selected Capability is explicitly applicable.",
			],
			constraints: ["Skill names do not derive Contribution Needs."],
		},
		basis: ["The delegated Outcome requires one upper Judgment."],
		provenance: { kind: "model", source: "test-evaluator" },
	});
	if (work.status !== "opened") throw new Error("Work Case did not open");
	const judgment = openLiveJudgment(work.value, {
		category: "Claim Assurance",
		subject: "The current completion Claim.",
		question: "What does current evidence support?",
		requirements: [
			{
				statement: "Claim-relevant evidence is available.",
				contributionNeeds: ["claim-relevant verifier"],
			},
		],
		basis: ["The Claim has not yet been assured."],
		provenance: { kind: "model", source: "test-evaluator" },
	});
	if (judgment.status !== "opened") throw new Error("Judgment did not open");
	return judgment;
}

test("applicable Capability creates one current live assignment", () => {
	const current = liveState();
	const entry = structuredCapability();
	const proposal = {
		status: "applicable" as const,
		matchedWhen: [declaredWhen],
		matchedUnless: [],
		basis: ["The current Claim needs an evidence-relevance judgment."],
		missingContext: [],
	};
	const result = assessLiveCapabilityApplicability(
		current.state,
		entry,
		proposal,
	);

	assert.equal(result.status, "assessed");
	if (result.status !== "assessed") return;
	assert.equal(result.assessment.status, "applicable");
	assert.match(result.assignment?.assignmentId ?? "", /^assign_[a-f0-9]{64}$/);
	assert.deepEqual(result.state.applicabilityAssessments, [result.assessment]);
	assert.deepEqual(result.state.assignments, [result.assignment]);
	assert.equal(
		assignedLiveCapability(result.state, entry, result.need.contributionNeedId)
			?.assignmentId,
		result.assignment?.assignmentId,
	);

	const repeated = assessLiveCapabilityApplicability(
		result.state,
		entry,
		proposal,
	);
	assert.equal(repeated.status, "unchanged");
	const conflict = assessLiveCapabilityApplicability(result.state, entry, {
		...proposal,
		basis: ["A conflicting reassessment attempted to replace accepted state."],
	});
	assert.equal(conflict.status, "invalid");
});

test("needs-context is recorded without creating an assignment", () => {
	const current = liveState();
	const result = assessLiveCapabilityApplicability(
		current.state,
		structuredCapability(),
		{
			status: "needs-context",
			matchedWhen: [],
			matchedUnless: [],
			basis: ["The verifier may apply after the artifact identity is known."],
			missingContext: ["exact artifact identity"],
		},
	);

	assert.equal(result.status, "assessed");
	if (result.status !== "assessed") return;
	assert.equal(result.assessment.status, "needs-context");
	assert.equal(result.assignment, undefined);
	assert.deepEqual(result.state.assignments, []);
});

test("unstructured Capability requires no synthetic condition", () => {
	const current = liveState();
	const entry = unstructuredCapability();
	const accepted = assessLiveCapabilityApplicability(current.state, entry, {
		status: "applicable",
		matchedWhen: [],
		matchedUnless: [],
		basis: ["The admitted method directly serves the current Need."],
		missingContext: [],
	});
	const synthetic = assessLiveCapabilityApplicability(current.state, entry, {
		status: "applicable",
		matchedWhen: ["A synthetic condition"],
		matchedUnless: [],
		basis: ["A synthetic predicate attempted to justify routing."],
		missingContext: [],
	});

	assert.equal(accepted.status, "assessed");
	assert.equal(synthetic.status, "invalid");
});
