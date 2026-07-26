import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

async function readJson(relativePath) {
	const path = join(root, relativePath);
	try {
		return JSON.parse(await readFile(path, "utf8"));
	} catch (error) {
		throw new Error(
			`Failed to read JSON file ${path}: ${error instanceof Error ? error.message : String(error)}`,
			{ cause: error },
		);
	}
}

const manifest = await readJson("package.json");
assert.equal(manifest.name, "@hobin/observer");
assert.equal(manifest.version, "0.0.0");
assert.equal(manifest.private, true);
assert.deepEqual(manifest.files, [
	"src",
	"schemas",
	"docs",
	"README.md",
	"LICENSE",
]);
assert.equal(
	manifest.scripts.check,
	"node scripts/check-package.mjs && node --test tests/*.test.ts",
);
assert.deepEqual(manifest.dependencies, {
	ajv: "^8.17.1",
	"ajv-formats": "^3.0.1",
	xstate: "5.32.5",
	yaml: "^2.9.0",
});
assert.equal("pi" in manifest, false, "Slice 2 must not expose a Pi extension");

const schema = await readJson("schemas/observer-record.v1.schema.json");
assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
assert.equal(schema.$id, "urn:hobin:observer:record:v1");
assert.deepEqual(schema.properties.observer_schema, {
	const: "observer-record/v1",
});
