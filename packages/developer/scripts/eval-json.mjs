import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { validateExecutionTrace } from "./eval-assertions.mjs";
import { createEvalEventMonitor } from "./eval-event-monitor.mjs";
import { diffWorkspaceSnapshots, snapshotWorkspace } from "./eval-filesystem.mjs";
import {
  assertAllowedOutcome,
  classifyEvalOutcome,
  parseDeveloperStatus,
  statusFromDeveloperEvents,
} from "./eval-outcome.mjs";
import { createEvalWorkspace } from "./eval-workspace.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const extension = join(root, "extensions", "developer.ts");
const observerExtension = join(root, "scripts", "eval-observer.ts");
const skills = join(root, "skills");
const piBin = process.env.PI_BIN || "pi";
const profile = process.env.PI_CODING_AGENT_DIR;
const thinking = process.env.DEVELOPER_EVAL_THINKING || "medium";
const fixtureTimeoutMs = Number(process.env.DEVELOPER_EVAL_TIMEOUT_MS || 150000);
const noProgressTimeoutMs = Number(process.env.DEVELOPER_EVAL_NO_PROGRESS_MS || 60000);

if (!profile) {
  throw new Error("JSON eval requires PI_CODING_AGENT_DIR pointing to a configured Pi profile.");
}

function parseJson(value, label) {
  try {
    return JSON.parse(value);
  } catch (error) {
    throw new Error(`${label}: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
  }
}

const allFixtures = parseJson(
  await readFile(join(root, "evals", "fixtures.json"), "utf8"),
  "Invalid eval fixtures",
);
const fixtureFilter = process.env.DEVELOPER_EVAL_FIXTURE;
const fixtures = fixtureFilter
  ? allFixtures.filter((fixture) => fixture.id === fixtureFilter)
  : allFixtures;
if (fixtureFilter && fixtures.length !== 1) {
  throw new Error("Unknown DEVELOPER_EVAL_FIXTURE: " + fixtureFilter);
}
const workspace = await createEvalWorkspace(root, fixtures.map((fixture) => fixture.id));

function runFixture(fixture) {
  const cwd = join(workspace, fixture.id);
  return new Promise((resolve, reject) => {
    const child = spawn(
      piBin,
      [
        "--mode",
        "json",
        "--print",
        "--offline",
        "--no-session",
        "--thinking",
        thinking,
        "--no-extensions",
        "--no-skills",
        "--extension",
        extension,
        "--extension",
        observerExtension,
        "--skill",
        skills,
        "--develop-mode",
        fixture.mode,
        fixture.request,
      ],
      {
        cwd,
        env: {
          ...process.env,
          PI_CODING_AGENT_DIR: profile,
          DEVELOPER_EVAL_WORKSPACE: cwd,
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let stderr = "";
    let finished = false;
    let budgetTimer;
    let monitor;

    const finish = (error) => {
      if (finished) return;
      finished = true;
      if (budgetTimer) clearInterval(budgetTimer);
      if (!error) {
        resolve(monitor.events);
        return;
      }
      child.kill("SIGTERM");
      if (!error.evalEvents) {
        Object.defineProperty(error, "evalEvents", {
          value: [...monitor.events],
          enumerable: false,
        });
      }
      reject(error);
    };
    monitor = createEvalEventMonitor({
      fixture,
      fixtureTimeoutMs,
      noProgressTimeoutMs,
      onFailure(error) {
        if (stderr) error.message += `\n${stderr}`;
        finish(error);
      },
    });

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => monitor.push(chunk));
    child.stdout.on("end", () => monitor.end());
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    budgetTimer = setInterval(() => monitor.check(), 50);
    child.on("error", (error) => finish(error));
    child.on("close", (code) => {
      if (finished) return;
      if (code !== 0) {
        finish(new Error(fixture.id + ": Pi exited " + code + "\n" + stderr));
        return;
      }
      finish();
    });
  });
}

for (const fixture of fixtures) {
  const casePath = join(workspace, fixture.id);
  const before = await snapshotWorkspace(casePath);
  let events = [];
  try {
    events = await runFixture(fixture);
    assert.ok(events.some((event) => event.type === "agent_settled"), fixture.id + ": no agent_settled event");
    const traceSummary = await validateExecutionTrace(fixture, events, root, casePath);
    const statusEvent = events
      .toReversed()
      .find(
        (event) =>
          event.type === "extension_ui_request" &&
          event.method === "setStatus" &&
          String(event.statusText).startsWith("developer:"),
      );
    const status = statusEvent
      ? parseDeveloperStatus(statusEvent.statusText)
      : statusFromDeveloperEvents(events, fixture.mode);
    const changes = diffWorkspaceSnapshots(before, await snapshotWorkspace(casePath));
    const outcome = classifyEvalOutcome({ changes, status });
    assertAllowedOutcome(fixture, outcome);
    console.log(
      "DEVELOPER_EVAL_RESULT " +
        JSON.stringify({
          fixtureId: fixture.id,
          structuralValid: true,
          outcome,
          ...traceSummary,
        }),
    );
    console.log(`JSON eval passed: ${fixture.id} (${outcome})`);
  } catch (error) {
    const failure = error instanceof Error ? error : new Error(String(error));
    const tracePath = join(tmpdir(), `developer-eval-${fixture.id}.json`);
    await writeFile(tracePath, JSON.stringify(failure.evalEvents ?? events, null, 2));
    failure.message += `\nTrace: ${tracePath}`;
    throw failure;
  }
}
