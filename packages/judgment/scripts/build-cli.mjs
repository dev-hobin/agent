import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const output = join(root, "bin/judgment.mjs");
const result = await build({
	absWorkingDir: root,
	entryPoints: [join(root, "scripts/judgment-cli.mjs")],
	bundle: true,
	format: "esm",
	platform: "node",
	target: "node22",
	write: false,
	legalComments: "none",
	minify: true,
	banner: {
		js: [
			"// pi-lens-ignore: throw-new-error-js",
			"// pi-lens-ignore: no-instanceof-builtins-js",
			"// pi-lens-ignore: unchecked-throwing-call-js",
		].join("\n"),
	},
});
const generated = result.outputFiles[0]?.contents;
if (!generated) throw new Error("Judgment CLI build produced no output.");
if (process.argv.includes("--check")) {
	const committed = await readFile(output);
	assert.equal(
		Buffer.compare(committed, Buffer.from(generated)),
		0,
		"bin/judgment.mjs is stale; run pnpm --filter @hobin/judgment cli:build",
	);
} else {
	await writeFile(output, generated);
}
