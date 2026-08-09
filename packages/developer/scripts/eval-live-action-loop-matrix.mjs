import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import { ACTION_LOOP_LIVE_CASES } from "../evals/action-loop-live-cases.mjs";

const packageRoot = resolve(requiredEnv("DEVELOPER_EVAL_PACKAGE_PATH"));
const matrixRoot = resolve(
	process.env.DEVELOPER_EVAL_MATRIX_ROOT ||
		`/tmp/developer-action-loop-live-matrix-${Date.now()}`,
);
const concurrency = boundedInteger("DEVELOPER_EVAL_CONCURRENCY", 4, 1, 12);
const selectedIds = process.env.DEVELOPER_EVAL_CASES
	? process.env.DEVELOPER_EVAL_CASES.split(",")
			.map((value) => value.trim())
			.filter(Boolean)
	: ACTION_LOOP_LIVE_CASES.map((fixture) => fixture.id);
const selectedCases = selectedIds.map((id) => {
	const fixture = ACTION_LOOP_LIVE_CASES.find((candidate) => candidate.id === id);
	if (!fixture) throw new Error(`Unknown Action Loop live case: ${id}`);
	return fixture;
});
const workerPath = resolve(
	import.meta.dirname,
	"eval-live-action-loop-case.mjs",
);

function requiredEnv(name) {
	const value = process.env[name];
	if (!value) throw new Error(`${name} is required.`);
	return value;
}

function boundedInteger(name, fallback, minimum, maximum) {
	const value = Number(process.env[name] || fallback);
	if (!Number.isInteger(value) || value < minimum || value > maximum) {
		throw new Error(`${name} must be an integer from ${minimum} through ${maximum}.`);
	}
	return value;
}

async function sha256(path) {
	return createHash("sha256").update(await readFile(path)).digest("hex");
}

async function readJson(path) {
	const source = await readFile(path, "utf8");
	try {
		return JSON.parse(source);
	} catch (error) {
		throw new Error(
			`Invalid JSON at ${path}: ${error instanceof Error ? error.message : String(error)}`,
			{ cause: error },
		);
	}
}

async function runCase(fixture) {
	const startedAt = Date.now();
	const child = spawn(process.execPath, [workerPath, fixture.id], {
		env: {
			...process.env,
			DEVELOPER_EVAL_PACKAGE_PATH: packageRoot,
			DEVELOPER_EVAL_MATRIX_ROOT: matrixRoot,
		},
		stdio: ["ignore", "pipe", "pipe"],
	});
	let stdout = "";
	let stderr = "";
	child.stdout.setEncoding("utf8");
	child.stderr.setEncoding("utf8");
	child.stdout.on("data", (chunk) => {
		stdout += chunk;
	});
	child.stderr.on("data", (chunk) => {
		stderr += chunk;
	});
	const exit = await new Promise((resolveExit) => {
		child.on("error", (error) =>
			resolveExit({ code: null, signal: null, error: error.message }),
		);
		child.on("close", (code, signal) => resolveExit({ code, signal }));
	});
	let report;
	try {
		const records = stdout.trim().split("\n").filter(Boolean);
		report = JSON.parse(records.at(-1) || "");
	} catch (error) {
		report = {
			protocol: "developer-action-loop-live-case/v1",
			case: { id: fixture.id, description: fixture.description },
			oracle: {
				classification: "blocked-environment",
				canonicalSafety: "fail",
				taskBehavior: "incomplete",
				canonicalViolations: [
					`Worker produced no parseable report: ${error instanceof Error ? error.message : String(error)}`,
				],
				taskViolations: [],
				livenessGaps: [],
			},
		};
	}
	report.worker = {
		exit,
		elapsedMs: Date.now() - startedAt,
		stderr: `${report.stderr || ""}\n${stderr}`.trim().slice(-4_000),
	};
	const reportPath = join(matrixRoot, "reports", `${fixture.id}.json`);
	await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
	return { ...report, reportPath };
}

async function runBoundedParallel(items, limit, operation) {
	const results = Array.from({ length: items.length });
	let next = 0;
	async function worker() {
		while (true) {
			const index = next;
			next += 1;
			if (index >= items.length) return;
			results[index] = await operation(items[index]);
		}
	}
	await Promise.all(
		Array.from({ length: Math.min(limit, items.length) }, () => worker()),
	);
	return results;
}

await mkdir(join(matrixRoot, "reports"), { recursive: true });
const manifestPath = resolve(packageRoot, "package.json");
const manifest = await readJson(manifestPath);
const startedAt = Date.now();
const cases = await runBoundedParallel(selectedCases, concurrency, runCase);
const classifications = Object.fromEntries(
	[
		"pass",
		"implementation-fail",
		"model-or-spec-fail",
		"verifier-gap",
		"blocked-environment",
		"pass-but-wrong-risk",
		"structural-degradation",
	].map((classification) => [
		classification,
		cases.filter(
			(report) => report.oracle?.classification === classification,
		).length,
	]),
);
const canonicalUnsafe = cases.filter(
	(report) => report.oracle?.canonicalSafety !== "pass",
);
const behaviorFailures = cases.filter(
	(report) => report.oracle?.taskBehavior === "fail",
);
const livenessResiduals = cases.filter(
	(report) => report.oracle?.taskBehavior === "incomplete",
);
let stopDecision = "finite-matrix-complete";
if (canonicalUnsafe.length > 0 || behaviorFailures.length > 0) {
	stopDecision = "stop-and-diagnose";
} else if (livenessResiduals.length > 0) {
	stopDecision = "safety-claim-supported-liveness-residual";
}
const report = {
	protocol: "developer-action-loop-live-matrix/v1",
	target: {
		packageRoot,
		name: manifest.name,
		version: manifest.version,
		manifestSha256: await sha256(manifestPath),
		artifactPath: process.env.DEVELOPER_EVAL_ARTIFACT_PATH,
		artifactSha256: process.env.DEVELOPER_EVAL_ARTIFACT_SHA256,
		sourceHead: process.env.DEVELOPER_EVAL_SOURCE_HEAD,
		model:
			process.env.DEVELOPER_EVAL_MODEL ||
			"github-copilot/claude-sonnet-4.6",
	},
	claim:
		"Across the finite matrix, accepted Developer events replay into one canonical state and no completion or mutation contradicts the fixture oracle.",
	riskModel: [
		"same-turn multi-Need evidence recovery",
		"unsupported no-action completion",
		"false precondition mutation",
		"missing-input creation",
		"contradictory completion",
		"non-durable external waiting",
		"collateral workspace mutation",
	],
	escalation:
		"smoke → visible exact mutation → hidden no-action/precondition/missing input → adversarial conflict/wait/collateral → stop",
	budgets: {
		concurrency,
		maximumRunsPerCase: Number(process.env.DEVELOPER_EVAL_MAX_RUNS || 4),
		runTimeoutMs: Number(process.env.DEVELOPER_EVAL_TIMEOUT_MS || 180_000),
		noProgressTimeoutMs: Number(
			process.env.DEVELOPER_EVAL_NO_PROGRESS_MS || 60_000,
		),
	},
	elapsedMs: Date.now() - startedAt,
	classifications,
	stopDecision,
	cases: cases.map((caseReport) => ({
		id: caseReport.case.id,
		description: caseReport.case.description,
		classification: caseReport.oracle.classification,
		canonicalSafety: caseReport.oracle.canonicalSafety,
		taskBehavior: caseReport.oracle.taskBehavior,
		replayStatus: caseReport.oracle.replayStatus,
		changedPaths: caseReport.oracle.changedPaths,
		canonicalViolations: caseReport.oracle.canonicalViolations,
		taskViolations: caseReport.oracle.taskViolations,
		verifierGaps: caseReport.oracle.verifierGaps,
		livenessGaps: caseReport.oracle.livenessGaps,
		providerBlock: caseReport.oracle.providerBlock,
		usabilityStop: caseReport.oracle.usabilityStop,
		runs: caseReport.runs?.length ?? 0,
		eventKinds: caseReport.replay?.eventKinds ?? [],
		reportPath: caseReport.reportPath,
		elapsedMs: caseReport.worker.elapsedMs,
	})),
};
const matrixPath = join(matrixRoot, "matrix-report.json");
await writeFile(matrixPath, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ ...report, matrixPath }, null, 2)}\n`);
if (canonicalUnsafe.length > 0 || behaviorFailures.length > 0) {
	process.exitCode = 1;
}
