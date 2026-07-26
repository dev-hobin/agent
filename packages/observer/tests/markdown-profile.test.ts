import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
	decodeObserverMarkdown,
	type ObserverDiagnosticCode,
	type ObserverRecordType,
} from "../src/markdown-profile.ts";

const fixturesRoot = join(import.meta.dirname, "fixtures", "records");

async function decodeFixture(group: "valid" | "invalid", name: string) {
	const path = join(fixturesRoot, group, name);
	return decodeObserverMarkdown({
		path,
		content: await readFile(path, "utf8"),
	});
}

const validFixtures: readonly (readonly [string, ObserverRecordType])[] = [
	["external-source.md", "source"],
	["direct-observation-source.md", "source"],
	["inquiry.md", "inquiry"],
	["memo.md", "memo"],
	["zettel.md", "zettel"],
];

interface InvalidFixtureExpectation {
	readonly name: string;
	readonly code: ObserverDiagnosticCode;
}

const invalidFixtures: readonly InvalidFixtureExpectation[] = [
	{
		name: "missing-frontmatter.md",
		code: "markdown.frontmatter.missing",
	},
	{name: "invalid-yaml.md", code: "markdown.frontmatter.invalid"},
	{name: "missing-h1.md", code: "markdown.h1.missing"},
	{name: "multiple-h1.md", code: "markdown.h1.multiple"},
	{name: "empty-body.md", code: "markdown.body.empty"},
	{name: "unsupported-version.md", code: "schema.unsupported-version"},
	{name: "status-mismatch.md", code: "schema.invalid"},
	{
		name: "direct-observation-missing-condition.md",
		code: "schema.invalid",
	},
	{name: "id-prefix-mismatch.md", code: "record.id-prefix"},
	{name: "timestamp-order.md", code: "record.timestamp-order"},
	{
		name: "inquiry-missing-revision-reason.md",
		code: "record.inquiry-revision-reason",
	},
	{name: "invalid-lang.md", code: "schema.invalid"},
	{name: "unknown-observer-field.md", code: "schema.invalid"},
];

describe("Observer Markdown Profile v1 Phase A", () => {
	for (const [name, expectedType] of validFixtures) {
		test(`decodes ${name}`, async () => {
			const result = await decodeFixture("valid", name);
			if (!result.ok) {
				assert.fail(
					`Expected ${name} to decode: ${JSON.stringify(result.diagnostics)}`,
				);
			}
			assert.equal(result.value.record.observer_type, expectedType);
			assert.deepEqual(result.diagnostics, []);
			assert.notEqual(result.value.h1.trim(), "");
			assert.notEqual(result.value.body.trim(), "");
		});
	}

	test("preserves unprefixed custom frontmatter", async () => {
		const result = await decodeFixture("valid", "memo.md");
		if (!result.ok) assert.fail("Expected memo fixture to decode");
		assert.equal(
			result.value.frontmatter.editor_note,
			"preserved custom metadata",
		);
	});

	for (const expectation of invalidFixtures) {
		test(`rejects ${expectation.name} with ${expectation.code}`, async () => {
			const result = await decodeFixture("invalid", expectation.name);
			if (result.ok) {
				assert.fail(`Expected ${expectation.name} to be rejected`);
			}
			assert.equal(
				result.diagnostics.some(
					(diagnostic) => diagnostic.code === expectation.code,
				),
				true,
				JSON.stringify(result.diagnostics),
			);
		});
	}
});
