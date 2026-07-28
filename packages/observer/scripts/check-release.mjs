import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const EXPECTED_FILES = [
	"LICENSE",
	"README.md",
	"docs/implementation-plan-v0.1.ko.md",
	"docs/product-spec-v0.1.ko.md",
	"extensions/memo-tool-schema.ts",
	"extensions/observer.ts",
	"extensions/material-review-runtime.ts",
	"extensions/tui.ts",
	"package.json",
	"schemas/observer-record.v1.schema.json",
	"src/atomic-file.ts",
	"src/content-hash.ts",
	"src/lifecycle-machine.ts",
	"src/lifecycle.ts",
	"src/markdown-profile.ts",
	"src/memo-instruction.ts",
	"src/memo-profile.ts",
	"src/memo-reconciliation.ts",
	"src/memo-session.ts",
	"src/memo-trigger.ts",
	"src/notebook-selection-store.ts",
	"src/notebook-service.ts",
	"src/notebook-validation.ts",
	"src/notebook.ts",
	"src/observation-action.ts",
	"src/observation-controller.ts",
	"src/observation-profile.ts",
	"src/observation-session.ts",
	"src/observer-command.ts",
	"src/observer-controller.ts",
	"src/observer-prompt.ts",
	"src/observer-status.ts",
	"src/material-review-command.ts",
	"src/material-review-trigger.ts",
	"src/pi-session.ts",
	"src/standing-index.ts",
	"src/save-acknowledgment.ts",
	"src/notebook-publication-preflight.ts",
	"src/notebook-publication-service.ts",
	"src/save-profile.ts",
	"src/save-service.ts",
	"src/notebook-publication-transaction.ts",
	"src/save-trigger.ts",
];

function failure(message) {
	return new Error(`Observer release check failed: ${message}`);
}

function isRecord(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function decodePackFile(value, index) {
	if (!isRecord(value) || typeof value.path !== "string" || !value.path) {
		throw failure(`npm pack file ${index} has no nonempty path.`);
	}
	return value.path;
}

function decodePackReport(raw) {
	let value;
	try {
		value = JSON.parse(raw);
	} catch (error) {
		throw failure(
			`npm pack did not return JSON: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
	if (!Array.isArray(value) || value.length !== 1 || !isRecord(value[0])) {
		throw failure("npm pack must return exactly one package report.");
	}
	const report = value[0];
	if (typeof report.filename !== "string" || !report.filename) {
		throw failure("npm pack report has no nonempty filename.");
	}
	if (!Array.isArray(report.files)) {
		throw failure("npm pack report has no files array.");
	}
	return {
		filename: report.filename,
		paths: report.files.map(decodePackFile),
	};
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
	const { stdout } = await run(
		"npm",
		["pack", "--dry-run", "--ignore-scripts", "--json"],
		{
			cwd: root,
			encoding: "utf8",
			maxBuffer: 10 * 1024 * 1024,
		},
	);
	return decodePackReport(stdout);
}

await requireCleanRepository();
const report = await inspectPack();
assert.equal(report.filename, "hobin-observer-0.1.0.tgz");
assert.deepEqual(report.paths.toSorted(), EXPECTED_FILES.toSorted());

process.stdout.write(
	`${JSON.stringify({
		ok: true,
		filename: report.filename,
		fileCount: report.paths.length,
	})}\n`,
);
