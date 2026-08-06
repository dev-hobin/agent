import assert from "node:assert/strict";
import test from "node:test";
import {
	selectDeclaredReferences,
	type ReferenceDisposition,
} from "../src/action-loop/routing/reference-selection.ts";

const declarations = [
	{ path: "references/problem-modeling.md" },
	{ path: "references/temporal-behavior-models.md" },
	{ path: "references/proof-obligations.md" },
] as const;

function proposal(
	path: string,
	status: ReferenceDisposition["status"],
	basis = [`${path} has a material disposition`],
): ReferenceDisposition {
	return { path, status, basis };
}

test("selected References follow declaration order rather than proposal order", () => {
	const result = selectDeclaredReferences(declarations, [
		proposal("references/proof-obligations.md", "selected"),
		proposal("references/temporal-behavior-models.md", "selected"),
		proposal("references/problem-modeling.md", "not-needed"),
	]);

	assert.equal(result.status, "ready");
	if (result.status !== "ready") return;
	assert.deepEqual(result.selectedPaths, [
		"references/temporal-behavior-models.md",
		"references/proof-obligations.md",
	]);
	assert.deepEqual(
		result.dispositions.map(({ path }) => path),
		declarations.map(({ path }) => path),
	);
});

test("zero selected References is a complete disposition result", () => {
	const result = selectDeclaredReferences(declarations, [
		proposal("references/problem-modeling.md", "not-needed"),
		proposal("references/temporal-behavior-models.md", "not-needed"),
		proposal("references/proof-obligations.md", "not-needed"),
	]);

	assert.equal(result.status, "ready");
	if (result.status !== "ready") return;
	assert.deepEqual(result.selectedPaths, []);
});

test("needs-context preserves selected work without pretending selection is ready", () => {
	const result = selectDeclaredReferences(declarations, [
		proposal("references/problem-modeling.md", "selected"),
		proposal("references/temporal-behavior-models.md", "needs-context", [
			"Retry behavior is not yet observed",
		]),
		proposal("references/proof-obligations.md", "not-needed"),
	]);

	assert.equal(result.status, "needs-context");
	if (result.status !== "needs-context") return;
	assert.deepEqual(result.selectedPaths, ["references/problem-modeling.md"]);
	assert.deepEqual(result.unresolved, [
		proposal("references/temporal-behavior-models.md", "needs-context", [
			"Retry behavior is not yet observed",
		]),
	]);
});

test("missing disposition fails instead of silently omitting a Reference", () => {
	const result = selectDeclaredReferences(declarations, [
		proposal("references/problem-modeling.md", "selected"),
		proposal("references/proof-obligations.md", "not-needed"),
	]);

	assert.deepEqual(result, {
		status: "invalid",
		issues: [
			{
				code: "missing-disposition",
				path: "references/temporal-behavior-models.md",
			},
		],
	});
});

test("undeclared and duplicate dispositions fail before selection", () => {
	const result = selectDeclaredReferences(declarations, [
		proposal("references/problem-modeling.md", "selected"),
		proposal("references/problem-modeling.md", "not-needed"),
		proposal("references/temporal-behavior-models.md", "not-needed"),
		proposal("references/proof-obligations.md", "not-needed"),
		proposal("references/unknown.md", "selected"),
	]);

	assert.equal(result.status, "invalid");
	if (result.status !== "invalid") return;
	assert.deepEqual(
		result.issues.map(({ code, path }) => `${code}:${path}`),
		[
			"duplicate-disposition:references/problem-modeling.md",
			"undeclared-disposition:references/unknown.md",
		],
	);
});

test("every disposition requires an explicit nonblank basis", () => {
	const result = selectDeclaredReferences(declarations, [
		proposal("references/problem-modeling.md", "selected", []),
		proposal("references/temporal-behavior-models.md", "not-needed", ["  "]),
		proposal("references/proof-obligations.md", "not-needed"),
	]);

	assert.equal(result.status, "invalid");
	if (result.status !== "invalid") return;
	assert.deepEqual(result.issues, [
		{ code: "empty-basis", path: "references/problem-modeling.md" },
		{
			code: "empty-basis",
			path: "references/temporal-behavior-models.md",
		},
	]);
});

test("duplicate declarations fail because selection would be ambiguous", () => {
	const result = selectDeclaredReferences(
		[
			{ path: "references/problem-modeling.md" },
			{ path: "references/problem-modeling.md" },
		],
		[proposal("references/problem-modeling.md", "selected")],
	);

	assert.deepEqual(result, {
		status: "invalid",
		issues: [
			{
				code: "duplicate-declaration",
				path: "references/problem-modeling.md",
			},
		],
	});
});

test("a Reference-free Skill needs no synthetic route or exemption here", () => {
	assert.deepEqual(selectDeclaredReferences([], []), {
		status: "ready",
		dispositions: [],
		selectedPaths: [],
	});
});
