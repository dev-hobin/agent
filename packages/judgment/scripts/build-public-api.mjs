import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const output = join(root, "dist/index.mjs");
const result = await build({
	absWorkingDir: root,
	entryPoints: [join(root, "scripts/public-api.ts")],
	bundle: true,
	format: "esm",
	platform: "node",
	target: "node22",
	write: false,
	legalComments: "none",
	preserveSymlinks: true,
});
const generated = result.outputFiles[0]?.contents;
if (!generated)
	throw new Error("Judgment public API build produced no output.");
if (process.argv.includes("--check")) {
	const committed = await readFile(output);
	assert.equal(
		Buffer.compare(committed, Buffer.from(generated)),
		0,
		"dist/index.mjs is stale; run pnpm --filter @hobin/judgment api:build",
	);
} else {
	await mkdir(dirname(output), { recursive: true });
	await writeFile(output, generated);
}
