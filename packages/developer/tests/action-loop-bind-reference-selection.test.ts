import assert from "node:assert/strict";
import test from "node:test";
import {
	acceptCapabilityApplicability,
	type CapabilityAssignment,
} from "../src/action-loop/routing/accept-applicability.ts";
import {
	bindCapability,
	type BoundCapability,
} from "../src/action-loop/routing/bind-capability.ts";
import { bindReferenceSelection } from "../src/action-loop/routing/bind-reference-selection.ts";
import {
	parseTocBytes,
	SKILL_TOC_SCHEMA_URI,
} from "../src/action-loop/routing/parse-toc.ts";
import {
	selectDeclaredReferences,
	type ReferenceDisposition,
	type ReferenceSelection,
} from "../src/action-loop/routing/reference-selection.ts";

const encoder = new TextEncoder();
const claimWhen = "A concrete claim must be assessed.";
const references = [
	{ path: "references/verifier-selection.md", when: ["Verifier relevance"] },
	{ path: "references/pass-but-wrong.md", when: ["Pass-but-wrong risk"] },
] as const;

function capability(locator = "npm:@hobin/developer"): BoundCapability {
	const parsed = parseTocBytes(
		encoder.encode(
			JSON.stringify({
				$schema: SKILL_TOC_SCHEMA_URI,
				when: [claimWhen],
				unless: ["There is no concrete claim to assess."],
				references,
			}),
		),
	);
	if (!parsed.ok) throw new Error(parsed.error.message);
	const bound = bindCapability(
		{ kind: "package", locator, skillRoot: "skills/verify" },
		parsed.value,
		encoder.encode("---\nname: verify\n---\n"),
	);
	if (!bound.ok) throw new Error(bound.error.message);
	return bound.value;
}

function assignment(currentCapability: BoundCapability): CapabilityAssignment {
	const accepted = acceptCapabilityApplicability(
		{
			workCaseId: "work-1",
			judgmentId: "judgment-1",
			contributionNeedId: "need-1",
			capability: currentCapability,
		},
		{
			workCaseId: "work-1",
			judgmentId: "judgment-1",
			contributionNeedId: "need-1",
			capabilityRevisionId: currentCapability.capabilityRevisionId,
			status: "applicable",
			matchedWhen: [claimWhen],
			matchedUnless: [],
			basis: ["The Need requires claim assessment."],
			missingContext: [],
		},
	);
	if (accepted.status !== "assigned") {
		throw new Error(`Expected assignment, received ${accepted.status}`);
	}
	return accepted.assignment;
}

function disposition(
	path: string,
	status: ReferenceDisposition["status"],
	basis = [`${path} has a material disposition`],
): ReferenceDisposition {
	return { path, status, basis };
}

function readySelection(
	currentCapability: BoundCapability,
	secondBasis = "Pass-but-wrong risk is not material.",
): ReferenceSelection {
	return selectDeclaredReferences(currentCapability.toc.references, [
		disposition("references/pass-but-wrong.md", "not-needed", [secondBasis]),
		disposition("references/verifier-selection.md", "selected", [
			"Verifier relevance must be inspected.",
		]),
	]);
}

test("ready dispositions bind deterministically to one Assignment", () => {
	const currentCapability = capability();
	const currentAssignment = assignment(currentCapability);
	const selection = readySelection(currentCapability);
	const result = bindReferenceSelection(
		currentAssignment,
		currentCapability,
		selection,
	);
	const repeated = bindReferenceSelection(
		currentAssignment,
		currentCapability,
		selection,
	);

	assert.equal(result.ok, true);
	assert.equal(repeated.ok, true);
	if (!result.ok || !repeated.ok) return;
	assert.equal(result.value.status, "ready");
	assert.match(result.value.selectionId, /^selection_[a-f0-9]{64}$/);
	assert.equal(repeated.value.selectionId, result.value.selectionId);
	assert.deepEqual(result.value.selectedPaths, [
		"references/verifier-selection.md",
	]);
	assert.deepEqual(
		result.value.dispositions.map(({ path }) => path),
		references.map(({ path }) => path),
	);
	assert.equal(Object.isFrozen(result.value), true);
	assert.equal(Object.isFrozen(result.value.dispositions), true);
	assert.equal(Object.isFrozen(result.value.dispositions[0]?.basis), true);
});

test("every disposition, including not-needed basis, participates in identity", () => {
	const currentCapability = capability();
	const currentAssignment = assignment(currentCapability);
	const first = bindReferenceSelection(
		currentAssignment,
		currentCapability,
		readySelection(currentCapability, "Not material for the current claim."),
	);
	const second = bindReferenceSelection(
		currentAssignment,
		currentCapability,
		readySelection(currentCapability, "Already covered by direct evidence."),
	);

	assert.equal(first.ok, true);
	assert.equal(second.ok, true);
	if (!first.ok || !second.ok) return;
	assert.notEqual(second.value.selectionId, first.value.selectionId);
});

test("needs-context selection is bound without becoming ready", () => {
	const currentCapability = capability();
	const currentAssignment = assignment(currentCapability);
	const selection = selectDeclaredReferences(currentCapability.toc.references, [
		disposition("references/verifier-selection.md", "selected"),
		disposition("references/pass-but-wrong.md", "needs-context", [
			"The accepted claim scope is missing.",
		]),
	]);
	const result = bindReferenceSelection(
		currentAssignment,
		currentCapability,
		selection,
	);

	assert.equal(result.ok, true);
	if (!result.ok) return;
	assert.equal(result.value.status, "needs-context");
	assert.deepEqual(
		result.value.unresolved.map(({ path }) => path),
		["references/pass-but-wrong.md"],
	);
});

test("structurally invalid selection cannot be bound", () => {
	const currentCapability = capability();
	const currentAssignment = assignment(currentCapability);
	const invalid = selectDeclaredReferences(currentCapability.toc.references, [
		disposition("references/verifier-selection.md", "selected"),
	]);
	const result = bindReferenceSelection(
		currentAssignment,
		currentCapability,
		invalid,
	);

	assert.equal(result.ok, false);
	if (!result.ok) assert.equal(result.error.code, "invalid-selection");
});

test("Assignment cannot bind to another Capability or revision", () => {
	const firstCapability = capability();
	const otherCapability = capability("npm:@hobin/other");
	const result = bindReferenceSelection(
		assignment(firstCapability),
		otherCapability,
		readySelection(otherCapability),
	);

	assert.equal(result.ok, false);
	if (!result.ok) {
		assert.equal(result.error.code, "assignment-capability-mismatch");
	}
});

test("selection paths and order must match the bound TOC", () => {
	const currentCapability = capability();
	const currentAssignment = assignment(currentCapability);
	const fromAnotherInventory = selectDeclaredReferences(
		[{ path: "references/other.md" }],
		[disposition("references/other.md", "selected")],
	);
	const result = bindReferenceSelection(
		currentAssignment,
		currentCapability,
		fromAnotherInventory,
	);

	assert.equal(result.ok, false);
	if (!result.ok) assert.equal(result.error.code, "declaration-mismatch");
});

test("tampered derived state fails before selection identity is created", () => {
	const currentCapability = capability();
	const currentAssignment = assignment(currentCapability);
	const selection = readySelection(currentCapability);
	if (selection.status !== "ready") throw new Error("Expected ready selection");
	const tampered = {
		...selection,
		selectedPaths: ["references/pass-but-wrong.md"],
	} as ReferenceSelection;
	const result = bindReferenceSelection(
		currentAssignment,
		currentCapability,
		tampered,
	);

	assert.equal(result.ok, false);
	if (!result.ok) {
		assert.equal(result.error.code, "selection-invariant-failed");
	}
});
