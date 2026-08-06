import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	MAX_TOC_BYTES,
	parseTocBytes,
	SKILL_TOC_SCHEMA_URI,
} from "../src/action-loop/routing/parse-toc.ts";

const encoder = new TextEncoder();

function validToc(): Record<string, unknown> {
	return {
		$schema: SKILL_TOC_SCHEMA_URI,
		when: ["A concrete claim must be assessed."],
		unless: ["There is no concrete claim to assess."],
		references: [
			{
				path: "references/verifier-selection.md",
				when: ["A green check may not exercise accepted meaning."],
			},
		],
	};
}

function parseJson(value: unknown) {
	return parseTocBytes(encoder.encode(JSON.stringify(value)));
}

test("valid bytes become a normalized immutable Parsed TOC", () => {
	const toc = validToc();
	toc.when = ["  A concrete claim must be assessed.  "];
	const result = parseJson(toc);

	assert.equal(result.ok, true);
	if (!result.ok) return;
	assert.deepEqual(result.value, {
		schema: SKILL_TOC_SCHEMA_URI,
		when: ["A concrete claim must be assessed."],
		unless: ["There is no concrete claim to assess."],
		references: [
			{
				path: "references/verifier-selection.md",
				when: ["A green check may not exercise accepted meaning."],
			},
		],
	});
	assert.equal(Object.isFrozen(result.value), true);
	assert.equal(Object.isFrozen(result.value.when), true);
	assert.equal(Object.isFrozen(result.value.references), true);
	assert.equal(Object.isFrozen(result.value.references[0]), true);
	assert.equal(Object.isFrozen(result.value.references[0]?.when), true);
	assert.throws(() => (result.value.when as string[]).push("mutate"));
});

test("Reference-free Skills parse without a synthetic route", () => {
	const toc = validToc();
	toc.references = [];
	const result = parseJson(toc);

	assert.equal(result.ok, true);
	if (!result.ok) return;
	assert.deepEqual(result.value.references, []);
});

test("oversized, non-UTF-8, and malformed JSON fail before shape checks", () => {
	assert.deepEqual(parseTocBytes(new Uint8Array(MAX_TOC_BYTES + 1)), {
		ok: false,
		error: {
			code: "too-large",
			path: "$",
			message: `TOC exceeds ${MAX_TOC_BYTES} bytes`,
		},
	});
	assert.equal(parseTocBytes(Uint8Array.of(0xc3, 0x28)).ok, false);
	assert.deepEqual(parseTocBytes(encoder.encode("{")), {
		ok: false,
		error: {
			code: "invalid-json",
			path: "$",
			message: "TOC must be valid JSON",
		},
	});
});

test("the canonical schema is required and unsupported versions fail", () => {
	const missing = validToc();
	delete missing.$schema;
	assert.deepEqual(parseJson(missing), {
		ok: false,
		error: {
			code: "missing-field",
			path: "$.$schema",
			message: "Missing required field $schema",
		},
	});

	const unsupported = validToc();
	unsupported.$schema = `${SKILL_TOC_SCHEMA_URI}?version=2`;
	const result = parseJson(unsupported);
	assert.equal(result.ok, false);
	if (result.ok) return;
	assert.equal(result.error.code, "schema-mismatch");
	assert.equal(result.error.path, "$.$schema");
});

test("root and Reference objects reject unknown fields", () => {
	const root = validToc();
	root.owner = "self-declared";
	assert.deepEqual(parseJson(root), {
		ok: false,
		error: {
			code: "unknown-field",
			path: "$.owner",
			message: "Unknown field owner",
		},
	});

	const nested = validToc();
	(nested.references as Array<Record<string, unknown>>)[0]!.stop = "done";
	const result = parseJson(nested);
	assert.equal(result.ok, false);
	if (result.ok) return;
	assert.equal(result.error.code, "unknown-field");
	assert.equal(result.error.path, "$.references[0].stop");
});

test("condition lists must be nonempty, nonblank, typed, and unique after normalization", () => {
	for (const [value, code] of [
		[[], "empty-list"],
		[["   "], "empty-string"],
		[[42], "expected-string"],
		[["same", " same "], "duplicate-value"],
	] as const) {
		const toc = validToc();
		toc.when = value;
		const result = parseJson(toc);
		assert.equal(result.ok, false);
		if (result.ok) continue;
		assert.equal(result.error.code, code);
		assert.match(result.error.path, /^\$\.when/);
	}
});

test("Reference conditions use the same condition contract", () => {
	const toc = validToc();
	(nestedReference(toc).when as unknown[]) = [];
	const result = parseJson(toc);

	assert.equal(result.ok, false);
	if (result.ok) return;
	assert.equal(result.error.code, "empty-list");
	assert.equal(result.error.path, "$.references[0].when");
});

function nestedReference(toc: Record<string, unknown>): Record<string, unknown> {
	return (toc.references as Array<Record<string, unknown>>)[0]!;
}

test("Reference paths must be normalized relative POSIX paths", () => {
	for (const path of [
		"",
		" /references/a.md",
		"/references/a.md",
		"C:/references/a.md",
		"references\\a.md",
		"references//a.md",
		"references/./a.md",
		"references/../a.md",
		"references/a.md/",
	]) {
		const toc = validToc();
		nestedReference(toc).path = path;
		const result = parseJson(toc);
		assert.equal(result.ok, false, path);
		if (result.ok) continue;
		assert.equal(result.error.code, "invalid-reference-path", path);
		assert.equal(result.error.path, "$.references[0].path");
	}
});

test("duplicate normalized Reference paths fail", () => {
	const toc = validToc();
	(toc.references as unknown[]).push({
		path: "references/verifier-selection.md",
		when: ["Another condition"],
	});
	const result = parseJson(toc);

	assert.equal(result.ok, false);
	if (result.ok) return;
	assert.equal(result.error.code, "duplicate-reference");
	assert.equal(result.error.path, "$.references[1].path");
});

test("the checked-in schema identifies the same closed authoring contract", async () => {
	const schema = JSON.parse(
		await readFile(
			new URL("../schemas/skill-toc-v0.1.schema.json", import.meta.url),
			"utf8",
		),
	) as {
		$id: string;
		additionalProperties: boolean;
		required: string[];
		properties: Record<string, unknown>;
		$defs: {
			reference: { properties: { path: { pattern: string } } };
		};
	};

	assert.equal(schema.$id, SKILL_TOC_SCHEMA_URI);
	assert.equal(schema.additionalProperties, false);
	assert.deepEqual(schema.required, ["$schema", "when", "unless", "references"]);
	assert.deepEqual(Object.keys(schema.properties), [
		"$schema",
		"when",
		"unless",
		"references",
	]);
	const pathPattern = new RegExp(
		schema.$defs.reference.properties.path.pattern,
	);
	assert.equal(pathPattern.test("references/a.md"), true);
	for (const invalid of [
		" /references/a.md",
		"references/a.md ",
		"/references/a.md",
		"C:/references/a.md",
		"references\\a.md",
		"references//a.md",
		"references/./a.md",
		"references/../a.md",
		"references/a.md/",
	]) {
		assert.equal(pathPattern.test(invalid), false, invalid);
	}
});
