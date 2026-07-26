import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { describe, test } from "node:test";
import type {
	MarkdownInput,
	ObserverDiagnosticCode,
} from "../src/markdown-profile.ts";
import { validateObserverNotebook } from "../src/notebook-validation.ts";

const notebooksRoot = join(import.meta.dirname, "fixtures", "notebooks");
const baselineRoot = join(notebooksRoot, "valid", "baseline");

async function readMarkdownDirectory(root: string): Promise<MarkdownInput[]> {
	const entries = (await readdir(root, { withFileTypes: true }))
		.filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
		.sort((left, right) => left.name.localeCompare(right.name));
	return Promise.all(
		entries.map(async (entry) => {
			const path = join(root, entry.name);
			return { path, content: await readFile(path, "utf8") };
		}),
	);
}

async function invalidNotebook(name: string): Promise<MarkdownInput[]> {
	const [baseline, overrides] = await Promise.all([
		readMarkdownDirectory(baselineRoot),
		readMarkdownDirectory(join(notebooksRoot, "invalid", name)),
	]);
	const overrideByName = new Map(
		overrides.map((input) => [basename(input.path), input]),
	);
	for (const overrideName of overrideByName.keys()) {
		if (!baseline.some((input) => basename(input.path) === overrideName)) {
			throw new Error(`Unknown baseline override: ${overrideName}`);
		}
	}
	return baseline.map(
		(input) => overrideByName.get(basename(input.path)) ?? input,
	);
}

interface InvalidNotebookExpectation {
	readonly name: string;
	readonly code: ObserverDiagnosticCode;
}

const invalidNotebooks: readonly InvalidNotebookExpectation[] = [
	{ name: "duplicate-id", code: "graph.id.duplicate" },
	{ name: "dangling-source", code: "graph.target.missing" },
	{ name: "dangling-lineage", code: "graph.target.missing" },
	{ name: "dangling-relation", code: "graph.target.missing" },
	{ name: "self-edge", code: "graph.edge.self" },
	{ name: "duplicate-edge", code: "graph.edge.duplicate" },
	{ name: "orphan-memo", code: "graph.memo.orphan" },
	{ name: "source-less-zettel", code: "graph.zettel.source-required" },
	{ name: "promotion-status", code: "graph.promotion.mismatch" },
	{ name: "promoted-unlinked", code: "graph.promotion.mismatch" },
	{ name: "lineage-type-mismatch", code: "graph.lineage.type-mismatch" },
	{ name: "promotion-target-type", code: "graph.promotion.mismatch" },
];

describe("Observer notebook graph validation", () => {
	test("accepts the six-record baseline", async () => {
		const result = validateObserverNotebook(
			await readMarkdownDirectory(baselineRoot),
		);
		if (!result.ok) {
			assert.fail(
				`Expected valid baseline: ${JSON.stringify(result.diagnostics)}`,
			);
		}
		assert.equal(result.graphEvaluated, true);
		assert.equal(result.records.length, 6);
		assert.deepEqual(result.diagnostics, []);
	});

	for (const expectation of invalidNotebooks) {
		test(`rejects ${expectation.name} with ${expectation.code}`, async () => {
			const result = validateObserverNotebook(
				await invalidNotebook(expectation.name),
			);
			if (result.ok) {
				assert.fail(`Expected ${expectation.name} to be rejected`);
			}
			assert.equal(result.graphEvaluated, true);
			assert.equal(result.phase, "graph");
			assert.deepEqual(
				[...new Set(result.diagnostics.map((diagnostic) => diagnostic.code))],
				[expectation.code],
				JSON.stringify(result.diagnostics),
			);
		});
	}

	test("does not evaluate graph rules after a Phase A failure", async () => {
		const invalidPath = join(
			import.meta.dirname,
			"fixtures",
			"records",
			"invalid",
			"missing-frontmatter.md",
		);
		const inputs = [
			...(await readMarkdownDirectory(baselineRoot)),
			{ path: invalidPath, content: await readFile(invalidPath, "utf8") },
		];
		const result = validateObserverNotebook(inputs);
		if (result.ok) assert.fail("Expected Phase A failure");
		assert.equal(result.graphEvaluated, false);
		assert.equal(result.phase, "record");
		assert.deepEqual(
			result.diagnostics.map((diagnostic) => diagnostic.code),
			["markdown.frontmatter.missing"],
		);
	});

	test("keeps graph diagnostics independent of input order", async () => {
		const inputs = await invalidNotebook("dangling-relation");
		const forward = validateObserverNotebook(inputs);
		const reverse = validateObserverNotebook([...inputs].reverse());
		if (forward.ok || reverse.ok) {
			assert.fail("Expected both notebook permutations to be invalid");
		}
		assert.deepEqual(reverse.diagnostics, forward.diagnostics);
	});
});
