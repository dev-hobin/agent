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
assert.equal(manifest.version, "0.1.6");
assert.equal(manifest.private, true);
assert.deepEqual(manifest.publishConfig, { access: "public" });
assert.deepEqual(manifest.files, [
	"extensions",
	"src",
	"schemas",
	"docs/product-spec-v0.1.ko.md",
	"docs/runtime-flow.md",
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
	"pnpm run check && node scripts/check-release.mjs",
);
assert.equal(manifest.scripts.prepublishOnly, "pnpm run release:check");
assert.deepEqual(manifest.dependencies, {
	"@hobin/judgment": "workspace:0.1.0",
	ajv: "^8.17.1",
	"ajv-formats": "^3.0.1",
	xstate: "5.32.5",
	yaml: "^2.9.0",
});
assert.deepEqual(manifest.bundledDependencies, ["@hobin/judgment"]);
assert.deepEqual(manifest.pi, {
	extensions: ["./extensions/observer.ts"],
});
assert.deepEqual(manifest.peerDependencies, {
	"@earendil-works/pi-coding-agent": ">=0.80.10 <0.84.0",
	"@earendil-works/pi-tui": ">=0.80.10 <0.84.0",
	typebox: "^1.3.6",
});

const observerContext = await readFile(
	join(root, "src/observer-context.ts"),
	"utf8",
);
assert.match(observerContext, /observer-context-basis\/v1/u);
assert.match(observerContext, /observer-source-reading/u);
assert.match(observerContext, /observer-memo-reconciliation/u);
assert.doesNotMatch(observerContext, /guidance\/.+judgment\.json/u);

const schema = await readJson("schemas/observer-record.v1.schema.json");
assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
assert.equal(schema.$id, "urn:hobin:observer:record:v1");
assert.deepEqual(schema.properties.observer_schema, {
	const: "observer-record/v1",
});
