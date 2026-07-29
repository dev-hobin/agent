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
assert.equal(manifest.version, "0.1.2");
assert.equal(manifest.private, undefined);
assert.deepEqual(manifest.publishConfig, { access: "public" });
assert.deepEqual(manifest.files, [
	"extensions",
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
assert.equal(manifest.scripts.eval, "node scripts/eval-rpc.mjs");
assert.equal(
	manifest.scripts["release:check"],
	"npm run check && node scripts/check-release.mjs",
);
assert.equal(manifest.scripts.prepublishOnly, "npm run release:check");
assert.deepEqual(manifest.dependencies, {
	ajv: "^8.17.1",
	"ajv-formats": "^3.0.1",
	xstate: "5.32.5",
	yaml: "^2.9.0",
});
assert.deepEqual(manifest.pi, {
	extensions: ["./extensions/observer.ts"],
});
assert.deepEqual(manifest.peerDependencies, {
	"@earendil-works/pi-coding-agent": ">=0.80.10 <0.83.0",
	"@earendil-works/pi-tui": ">=0.80.10 <0.83.0",
	typebox: "^1.3.6",
});

const schema = await readJson("schemas/observer-record.v1.schema.json");
assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
assert.equal(schema.$id, "urn:hobin:observer:record:v1");
assert.deepEqual(schema.properties.observer_schema, {
	const: "observer-record/v1",
});
