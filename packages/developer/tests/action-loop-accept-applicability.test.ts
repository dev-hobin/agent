import assert from "node:assert/strict";
import test from "node:test";
import {
	acceptCapabilityApplicability,
	type ApplicabilityTarget,
	type CapabilityApplicabilityProposal,
} from "../src/action-loop/routing/accept-applicability.ts";
import {
	bindCapability,
	type BoundCapability,
} from "../src/action-loop/routing/bind-capability.ts";
import {
	parseTocBytes,
	SKILL_TOC_SCHEMA_URI,
} from "../src/action-loop/routing/parse-toc.ts";

const encoder = new TextEncoder();
const claimWhen = "A concrete claim must be assessed.";
const compatibilityWhen = "Compatibility scope is consequential.";
const noClaimUnless = "There is no concrete claim to assess.";

function capability(): BoundCapability {
	const parsed = parseTocBytes(
		encoder.encode(
			JSON.stringify({
				$schema: SKILL_TOC_SCHEMA_URI,
				when: [claimWhen, compatibilityWhen],
				unless: [noClaimUnless],
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
	return bound.value;
}

function target(): ApplicabilityTarget {
	return {
		workCaseId: "work-1",
		judgmentId: "judgment-1",
		contributionNeedId: "need-1",
		capability: capability(),
	};
}

function proposal(
	currentTarget: ApplicabilityTarget,
	overrides: Partial<CapabilityApplicabilityProposal> = {},
): CapabilityApplicabilityProposal {
	return {
		workCaseId: currentTarget.workCaseId,
		judgmentId: currentTarget.judgmentId,
		contributionNeedId: currentTarget.contributionNeedId,
		capabilityRevisionId: currentTarget.capability.capabilityRevisionId,
		status: "applicable",
		matchedWhen: [claimWhen],
		matchedUnless: [],
		basis: ["The current Need asks for a concrete claim assessment."],
		missingContext: [],
		...overrides,
	};
}

test("applicable proposal creates one deterministic immutable assignment", () => {
	const currentTarget = target();
	const input = proposal(currentTarget, {
		matchedWhen: [compatibilityWhen, claimWhen],
		basis: ["  Both declared pressures materially apply.  "],
	});
	const result = acceptCapabilityApplicability(currentTarget, input);
	const repeated = acceptCapabilityApplicability(currentTarget, input);

	assert.equal(result.status, "assigned");
	assert.equal(repeated.status, "assigned");
	if (result.status !== "assigned" || repeated.status !== "assigned") return;
	assert.match(result.assignment.assignmentId, /^assign_[a-f0-9]{64}$/);
	assert.equal(
		repeated.assignment.assignmentId,
		result.assignment.assignmentId,
	);
	assert.deepEqual(result.assignment.matchedWhen, [
		claimWhen,
		compatibilityWhen,
	]);
	assert.deepEqual(result.assignment.applicabilityBasis, [
		"Both declared pressures materially apply.",
	]);
	assert.equal(Object.isFrozen(result.assessment), true);
	assert.equal(Object.isFrozen(result.assignment), true);
	assert.equal(Object.isFrozen(result.assignment.matchedWhen), true);
});

test("no when match is accepted as not-applicable without an assignment", () => {
	const currentTarget = target();
	const result = acceptCapabilityApplicability(
		currentTarget,
		proposal(currentTarget, {
			status: "not-applicable",
			matchedWhen: [],
			basis: ["The Need is unrelated to claim assurance."],
		}),
	);

	assert.equal(result.status, "not-applicable");
	if (result.status !== "not-applicable") return;
	assert.equal(result.assessment.status, "not-applicable");
});

test("matched unless overrides a positive when match", () => {
	const currentTarget = target();
	const excluded = proposal(currentTarget, {
		matchedUnless: [noClaimUnless],
	});
	const invalid = acceptCapabilityApplicability(currentTarget, excluded);
	const accepted = acceptCapabilityApplicability(currentTarget, {
		...excluded,
		status: "not-applicable",
		basis: ["The explicit exclusion overrides the broad positive condition."],
	});

	assert.equal(invalid.status, "invalid");
	if (invalid.status === "invalid") {
		assert.equal(invalid.error.code, "excluded-by-unless");
	}
	assert.equal(accepted.status, "not-applicable");
});

test("needs-context remains unresolved and creates no assignment", () => {
	const currentTarget = target();
	const result = acceptCapabilityApplicability(
		currentTarget,
		proposal(currentTarget, {
			status: "needs-context",
			matchedWhen: [claimWhen],
			basis: ["The Need may require claim assessment."],
			missingContext: ["The proposed completion claim is not yet stated."],
		}),
	);

	assert.equal(result.status, "needs-context");
	if (result.status !== "needs-context") return;
	assert.deepEqual(result.assessment.missingContext, [
		"The proposed completion claim is not yet stated.",
	]);
});

test("status semantics reject contradictory evidence shapes", () => {
	const currentTarget = target();
	const fixtures = [
		{
			overrides: { matchedWhen: [] },
			code: "applicable-without-when",
		},
		{
			overrides: {
				status: "not-applicable" as const,
				matchedWhen: [claimWhen],
			},
			code: "not-applicable-with-positive-match",
		},
		{
			overrides: {
				status: "needs-context" as const,
				matchedWhen: [],
				missingContext: [],
			},
			code: "missing-context-required",
		},
		{
			overrides: {
				status: "needs-context" as const,
				matchedUnless: [noClaimUnless],
				missingContext: ["More context"],
			},
			code: "decisive-unless-cannot-wait",
		},
		{
			overrides: { missingContext: ["Contradictory context"] },
			code: "unexpected-missing-context",
		},
	] as const;

	for (const fixture of fixtures) {
		const result = acceptCapabilityApplicability(
			currentTarget,
			proposal(currentTarget, fixture.overrides),
		);
		assert.equal(result.status, "invalid", fixture.code);
		if (result.status === "invalid") {
			assert.equal(result.error.code, fixture.code);
		}
	}
});

test("stale or cross-Need proposal identity is rejected", () => {
	const currentTarget = target();
	for (const overrides of [
		{ workCaseId: "work-other" },
		{ judgmentId: "judgment-other" },
		{ contributionNeedId: "need-other" },
		{ capabilityRevisionId: "caprev_stale" },
	]) {
		const result = acceptCapabilityApplicability(
			currentTarget,
			proposal(currentTarget, overrides),
		);
		assert.equal(result.status, "invalid");
		if (result.status === "invalid") {
			assert.equal(result.error.code, "identity-mismatch");
		}
	}
});

test("undeclared, duplicate, and basis-free evidence is rejected", () => {
	const currentTarget = target();
	const fixtures = [
		{
			overrides: { matchedWhen: ["An undeclared condition"] },
			code: "undeclared-condition",
		},
		{
			overrides: { matchedWhen: [claimWhen, claimWhen] },
			code: "duplicate-value",
		},
		{
			overrides: { basis: [] },
			code: "empty-basis",
		},
	] as const;

	for (const fixture of fixtures) {
		const result = acceptCapabilityApplicability(
			currentTarget,
			proposal(currentTarget, fixture.overrides),
		);
		assert.equal(result.status, "invalid");
		if (result.status === "invalid") {
			assert.equal(result.error.code, fixture.code);
		}
	}
});

test("invalid target identity and unsupported status fail explicitly", () => {
	const currentTarget = target();
	const invalidTarget = acceptCapabilityApplicability(
		{ ...currentTarget, contributionNeedId: "  " },
		proposal(currentTarget),
	);
	assert.equal(invalidTarget.status, "invalid");
	if (invalidTarget.status === "invalid") {
		assert.equal(invalidTarget.error.code, "invalid-target-id");
	}

	const invalidStatus = acceptCapabilityApplicability(
		currentTarget,
		proposal(currentTarget, {
			status: "maybe" as CapabilityApplicabilityProposal["status"],
			matchedWhen: [],
			missingContext: ["Unknown status"],
		}),
	);
	assert.equal(invalidStatus.status, "invalid");
	if (invalidStatus.status === "invalid") {
		assert.equal(invalidStatus.error.code, "unsupported-status");
	}
});
