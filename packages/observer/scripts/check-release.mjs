import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const EXPECTED_FILES = [
	"LICENSE",
	"README.md",
	"docs/product-spec-v0.1.ko.md",
	"docs/runtime-flow.md",
	"extensions/memo-tool-schema.ts",
	"extensions/observer-background.ts",
	"extensions/observer-workbench-tui.ts",
	"extensions/observer.ts",
	"extensions/material-review-runtime.ts",
	"extensions/save-proposal-tui.ts",
	"extensions/tui.ts",
	"package.json",
	"schemas/observer-record.v1.schema.json",
	"src/atomic-file.ts",
	"src/content-hash.ts",
	"src/lifecycle-machine.ts",
	"src/lifecycle.ts",
	"src/line-diff.ts",
	"src/markdown-profile.ts",
	"src/memo-instruction.ts",
	"src/memo-profile.ts",
	"src/memo-reconciliation.ts",
	"src/memo-session.ts",
	"src/memo-trigger.ts",
	"src/notebook-selection-store.ts",
	"src/notebook-path.ts",
	"src/notebook-service.ts",
	"src/notebook-validation.ts",
	"src/notebook.ts",
	"src/observation-action.ts",
	"src/observation-controller.ts",
	"src/observer-context.ts",
	"src/observation-profile.ts",
	"src/observation-session.ts",
	"src/observer-background-queue.ts",
	"src/observer-command.ts",
	"src/observer-controller.ts",
	"src/observer-prompt.ts",
	"src/observer-processing-policy.ts",
	"src/observer-status.ts",
	"src/observer-worker-material.ts",
	"src/observer-workbench.ts",
	"src/material-review-command.ts",
	"src/material-review-trigger.ts",
	"src/pi-session.ts",
	"src/standing-index.ts",
	"src/save-acknowledgment.ts",
	"src/notebook-publication-preflight.ts",
	"src/notebook-publication-service.ts",
	"src/save-profile.ts",
	"src/save-review.ts",
	"src/save-service.ts",
	"src/notebook-publication-transaction.ts",
	"src/save-trigger.ts",
];

function failure(message) {
	return new Error(`Observer release check failed: ${message}`);
}

async function requireCleanRepository() {
	const { stdout } = await run("git", ["status", "--porcelain=v1"], {
		cwd: root,
		encoding: "utf8",
	});
	if (stdout.trim()) {
		throw failure("Git worktree must be clean before release verification.");
	}
}

async function inspectPack() {
	const destination = await mkdtemp(join(tmpdir(), "observer-release-pack-"));
	try {
		await run("pnpm", ["pack", "--pack-destination", destination], {
			cwd: root,
			encoding: "utf8",
			maxBuffer: 10 * 1024 * 1024,
		});
		const archives = (await readdir(destination)).filter((path) =>
			path.endsWith(".tgz"),
		);
		if (archives.length !== 1 || !archives[0]) {
			throw failure("pnpm pack must produce exactly one tarball.");
		}
		const filename = archives[0];
		const archive = join(destination, filename);
		const [{ stdout }, { stdout: manifestJson }] = await Promise.all([
			run("tar", ["-tzf", archive], {
				encoding: "utf8",
				maxBuffer: 10 * 1024 * 1024,
			}),
			run("tar", ["-xOf", archive, "package/package.json"], {
				encoding: "utf8",
				maxBuffer: 1024 * 1024,
			}),
		]);
		const paths = stdout
			.split("\n")
			.filter(Boolean)
			.map((path) => path.replace(/^package\//u, ""));
		if (paths.some((path) => path.startsWith("../"))) {
			throw failure(
				"packed dependency paths must not escape the package root.",
			);
		}
		let manifest;
		try {
			manifest = JSON.parse(manifestJson);
		} catch (error) {
			throw failure(
				`packed package.json is invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
		return { filename, paths, manifest };
	} finally {
		await rm(destination, { recursive: true, force: true });
	}
}

await requireCleanRepository();
const report = await inspectPack();
assert.equal(report.filename, "hobin-observer-0.1.6.tgz");
assert.equal(
	report.manifest.dependencies?.["@hobin/judgment"],
	"0.1.0",
	"pnpm pack must rewrite the workspace protocol to the public version.",
);
assert.deepEqual(report.manifest.bundledDependencies, ["@hobin/judgment"]);
const packagePaths = report.paths.filter(
	(path) => !path.startsWith("node_modules/"),
);
assert.deepEqual(packagePaths.toSorted(), EXPECTED_FILES.toSorted());
const judgmentPaths = report.paths.filter((path) =>
	path.startsWith("node_modules/@hobin/judgment/"),
);
assert.ok(
	judgmentPaths.includes("node_modules/@hobin/judgment/package.json"),
	"Observer pack must bundle the Judgment runtime dependency.",
);
assert.ok(
	judgmentPaths.includes("node_modules/@hobin/judgment/dist/index.mjs"),
	"Observer pack must bundle the executable Judgment public entry point.",
);

process.stdout.write(
	`${JSON.stringify({
		ok: true,
		filename: report.filename,
		fileCount: report.paths.length,
		packageFileCount: packagePaths.length,
		judgmentFileCount: judgmentPaths.length,
	})}\n`,
);
