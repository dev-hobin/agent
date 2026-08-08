import assertModule from "node:assert";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const assert: typeof assertModule.strict = assertModule.strict;
const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

test("probabilistic SDK evaluation aggregates isolated trials instead of treating one sample as a test", async () => {
	const directory = await mkdtemp(
		join(tmpdir(), "developer-probability-test-"),
	);
	const reportPath = join(directory, "report.json");
	try {
		const run = spawnSync(
			process.execPath,
			[join(packageRoot, "scripts", "eval-live.mjs")],
			{
				cwd: packageRoot,
				encoding: "utf8",
				env: {
					...process.env,
					DEVELOPER_SDK_PI_ROOT: directory,
					DEVELOPER_SDK_MODEL: "test/model",
					DEVELOPER_EVAL_FIXTURE: "vague-product-request",
					DEVELOPER_EVAL_TRIALS: "2",
					DEVELOPER_EVAL_RUNNER: join(
						packageRoot,
						"tests",
						"fixtures",
						"fake-eval-runner.mjs",
					),
					DEVELOPER_EVAL_REPORT: reportPath,
				},
			},
		);
		assert.equal(run.status, 0, run.stderr);
		const report = JSON.parse(await readFile(reportPath, "utf8"));
		assert.equal(report.fixtures[0].accepted, 2);
		assert.equal(report.fixtures[0].preferred, 1);
		assert.equal(report.fixtures[0].admissibleNonPreferred, 1);
		assert.match(run.stdout, /accepted 2\/2/);
		assert.match(run.stdout, /preferred 1\/2/);

		const inadmissibleReportPath = join(directory, "inadmissible-report.json");
		const inadmissibleRun = spawnSync(
			process.execPath,
			[join(packageRoot, "scripts", "eval-live.mjs")],
			{
				cwd: packageRoot,
				encoding: "utf8",
				env: {
					...process.env,
					DEVELOPER_SDK_PI_ROOT: directory,
					DEVELOPER_SDK_MODEL: "test/model",
					DEVELOPER_FAKE_SELECTED_TARGETS_JSON: '["model"]',
					DEVELOPER_EVAL_FIXTURE: "self-referential-design-template",
					DEVELOPER_EVAL_TRIALS: "1",
					DEVELOPER_EVAL_RUNNER: join(
						packageRoot,
						"tests",
						"fixtures",
						"fake-eval-runner.mjs",
					),
					DEVELOPER_EVAL_REPORT: inadmissibleReportPath,
				},
			},
		);
		assert.equal(inadmissibleRun.status, 1, inadmissibleRun.stderr);
		const inadmissibleReport = JSON.parse(
			await readFile(inadmissibleReportPath, "utf8"),
		);
		assert.equal(inadmissibleReport.fixtures[0].accepted, 0);
		assert.equal(inadmissibleReport.fixtures[0].inadmissible, 1);

		const boundedReportPath = join(directory, "bounded-report.json");
		const boundedRun = spawnSync(
			process.execPath,
			[join(packageRoot, "scripts", "eval-live.mjs")],
			{
				cwd: packageRoot,
				encoding: "utf8",
				env: {
					...process.env,
					DEVELOPER_SDK_PI_ROOT: directory,
					DEVELOPER_SDK_MODEL: "test/model",
					DEVELOPER_EVAL_FIXTURE: "vague-product-request",
					DEVELOPER_EVAL_TRIALS: "1",
					DEVELOPER_EVAL_RUNNER: join(
						packageRoot,
						"tests",
						"fixtures",
						"fake-eval-runner.mjs",
					),
					DEVELOPER_EVAL_REPORT: boundedReportPath,
					DEVELOPER_FAKE_TRIAL_OUTCOME: "bounded-stop",
				},
			},
		);
		assert.equal(boundedRun.status, 0, boundedRun.stderr);
		const boundedReport = JSON.parse(await readFile(boundedReportPath, "utf8"));
		assert.equal(boundedReport.fixtures[0].accepted, 0);
		assert.equal(boundedReport.fixtures[0].boundedStops, 1);
		assert.equal(boundedReport.fixtures[0].medianToolCallAttempts, 2);
		assert.match(boundedRun.stdout, /bounded 1/);

		const sdkReportPath = join(directory, "sdk-report.json");
		const sdkRun = spawnSync(
			process.execPath,
			[join(packageRoot, "scripts", "eval-live.mjs")],
			{
				cwd: packageRoot,
				encoding: "utf8",
				env: {
					...process.env,
					DEVELOPER_SDK_PI_ROOT: directory,
					DEVELOPER_SDK_MODEL: "test/model",
					DEVELOPER_FAKE_SELECTED_TARGETS_JSON: '["model","sketch"]',
					DEVELOPER_EVAL_FIXTURE: "specialized-temporal-model",
					DEVELOPER_EVAL_TRIALS: "1",
					DEVELOPER_EVAL_RUNNER: join(
						packageRoot,
						"tests",
						"fixtures",
						"fake-eval-runner.mjs",
					),
					DEVELOPER_EVAL_REPORT: sdkReportPath,
				},
			},
		);
		assert.equal(sdkRun.status, 0, sdkRun.stderr);
		const sdkReport = JSON.parse(await readFile(sdkReportPath, "utf8"));
		assert.equal(sdkReport.transport, "sdk");
		assert.equal(sdkReport.fixtures[0].accepted, 1);
		assert.equal(sdkReport.fixtures[0].medianControllerDecisions, 2);
		assert.equal(sdkReport.fixtures[0].medianRouteAttempts, null);
		assert.equal(sdkReport.fixtures[0].medianSelectedTargets, 2);
		assert.equal(sdkReport.fixtures[0].medianExtraTargets, 1);
		assert.equal(sdkReport.fixtures[0].medianTimeBudgetStops, 0);
		assert.match(sdkRun.stdout, /decisions\/retries\/recoveries/);
		assert.match(sdkRun.stdout, /targets\/extra\/wall-ms\/time-stops/);
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});
