import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const output = join(root, "dist/sdk.mjs");
const result = await build({
	absWorkingDir: root,
	entryPoints: [join(root, "src/action-loop/sdk/index.ts")],
	bundle: true,
	format: "esm",
	platform: "node",
	target: "node22",
	write: false,
	legalComments: "none",
	preserveSymlinks: true,
	external: [
		"@earendil-works/pi-ai",
		"@earendil-works/pi-coding-agent",
		"typebox",
	],
});
const generated = result.outputFiles[0]?.contents;
if (!generated) {
	throw new Error("Developer SDK public API build produced no output.");
}
if (process.argv.includes("--check")) {
	const committed = await readFile(output);
	assert.equal(
		Buffer.compare(committed, Buffer.from(generated)),
		0,
		"dist/sdk.mjs is stale; run pnpm --filter @hobin/developer sdk:build",
	);
} else {
	await mkdir(dirname(output), { recursive: true });
	await writeFile(output, generated);
}
