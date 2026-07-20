import assertModule from "node:assert";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const assert: typeof assertModule.strict = assertModule.strict;
const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

test("probabilistic live evaluation aggregates isolated trials instead of treating one sample as a test", async () => {
  const directory = await mkdtemp(join(tmpdir(), "developer-probability-test-"));
  const reportPath = join(directory, "report.json");
  try {
    const run = spawnSync(
      process.execPath,
      [join(packageRoot, "scripts", "eval-live.mjs"), "--transport", "rpc"],
      {
        cwd: packageRoot,
        encoding: "utf8",
        env: {
          ...process.env,
          PI_CODING_AGENT_DIR: directory,
          DEVELOPER_EVAL_FIXTURE: "vague-product-request",
          DEVELOPER_EVAL_TRIALS: "2",
          DEVELOPER_EVAL_RUNNER: join(packageRoot, "tests", "fixtures", "fake-eval-runner.mjs"),
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
      [join(packageRoot, "scripts", "eval-live.mjs"), "--transport", "rpc"],
      {
        cwd: packageRoot,
        encoding: "utf8",
        env: {
          ...process.env,
          PI_CODING_AGENT_DIR: directory,
          DEVELOPER_EVAL_FIXTURE: "self-referential-design-template",
          DEVELOPER_EVAL_TRIALS: "1",
          DEVELOPER_EVAL_RUNNER: join(packageRoot, "tests", "fixtures", "fake-eval-runner.mjs"),
          DEVELOPER_EVAL_REPORT: inadmissibleReportPath,
        },
      },
    );
    assert.equal(inadmissibleRun.status, 1, inadmissibleRun.stderr);
    const inadmissibleReport = JSON.parse(await readFile(inadmissibleReportPath, "utf8"));
    assert.equal(inadmissibleReport.fixtures[0].accepted, 0);
    assert.equal(inadmissibleReport.fixtures[0].inadmissible, 1);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
