import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { validateExecutionTrace } from "./eval-assertions.mjs";
import { createFixtureBudgetMonitor } from "./eval-budget.mjs";
import { diffWorkspaceSnapshots, snapshotWorkspace } from "./eval-filesystem.mjs";
import { assertAllowedOutcome, classifyEvalOutcome, parseDeveloperStatus } from "./eval-outcome.mjs";
import { createEvalWorkspace } from "./eval-workspace.mjs";
import { createJsonlDecoder } from "./jsonl.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const packageUnderTest = process.env.DEVELOPER_EVAL_PACKAGE_PATH || root;
const extension = join(packageUnderTest, "extensions", "developer.ts");
const observerExtension = join(root, "scripts", "eval-observer.ts");
const skills = join(packageUnderTest, "skills");
const piBin = process.env.PI_BIN || "pi";
const live = process.env.DEVELOPER_EVAL_LIVE === "1";
const liveThinking = process.env.DEVELOPER_EVAL_THINKING || "medium";
const fixtureTimeoutMs = Number(process.env.DEVELOPER_EVAL_TIMEOUT_MS || 150000);
const noProgressTimeoutMs = Number(process.env.DEVELOPER_EVAL_NO_PROGRESS_MS || 60000);

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
const workspace = await createEvalWorkspace(root, live ? fixtures.map((fixture) => fixture.id) : ["smoke"]);

if (live && !process.env.PI_CODING_AGENT_DIR) {
  throw new Error("Live eval requires PI_CODING_AGENT_DIR pointing to a configured Pi profile.");
}

const configDir =
  process.env.PI_CODING_AGENT_DIR || (await mkdtemp(join(tmpdir(), "developer-pi-rpc-")));
const loadAsPackage = !process.env.PI_CODING_AGENT_DIR;
if (loadAsPackage) {
  await writeFile(join(configDir, "settings.json"), JSON.stringify({ packages: [packageUnderTest] }, null, 2));
}
const resourceArgs = loadAsPackage
  ? []
  : [
      "--no-extensions",
      "--no-skills",
      "--extension",
      extension,
      "--extension",
      observerExtension,
      "--skill",
      skills,
    ];
const child = spawn(
  piBin,
  [
    "--mode",
    "rpc",
    "--offline",
    "--no-session",
    ...(live ? ["--thinking", liveThinking] : []),
    ...resourceArgs,
  ],
  {
    cwd: workspace,
    env: {
      ...process.env,
      PI_CODING_AGENT_DIR: configDir,
      DEVELOPER_EVAL_WORKSPACE: workspace,
    },
    stdio: ["pipe", "pipe", "pipe"],
  },
);

let stderr = "";
child.stderr.setEncoding("utf8");
child.stderr.on("data", (chunk) => {
  stderr += chunk;
});

const events = [];
const responses = new Map();
const waiters = new Map();
let nextId = 1;

const decoder = createJsonlDecoder({
  onValue(value) {
    events.push(value);
    if (value.type === "response" && value.id) {
      responses.set(value.id, value);
      const resolve = waiters.get(value.id);
      if (resolve) {
        waiters.delete(value.id);
        resolve(value);
      }
    }
  },
  onError(error, record) {
    stderr += `\nRPC JSONL parse error: ${error.message}\nRecord: ${record}`;
  },
});
child.stdout.setEncoding("utf8");
child.stdout.on("data", (chunk) => decoder.push(chunk));
child.stdout.on("end", () => decoder.end());

child.on("error", (error) => {
  for (const resolve of waiters.values()) {
    resolve({ success: false, error: error.message });
  }
  waiters.clear();
});

function send(command, timeoutMs = 10000) {
  const id = "developer-eval-" + nextId++;
  child.stdin.write(JSON.stringify({ ...command, id }) + "\n");
  return new Promise((resolve, reject) => {
    const existing = responses.get(id);
    if (existing) return resolve(existing);
    const timer = setTimeout(() => {
      waiters.delete(id);
      reject(new Error("RPC timeout for " + command.type + "\n" + stderr));
    }, timeoutMs);
    waiters.set(id, (response) => {
      clearTimeout(timer);
      resolve(response);
    });
  });
}

function recentEventTypes(start) {
  return events
    .slice(Math.max(start, events.length - 20))
    .map((event) => event.type)
    .join(", ");
}

async function waitForFixtureSettled(start, fixture) {
  const budget = createFixtureBudgetMonitor({
    fixture,
    fixtureTimeoutMs,
    noProgressTimeoutMs,
  });
  let observed = start;
  while (true) {
    const trace = events.slice(start);
    const settled = trace.find((event) => event.type === "agent_settled");
    if (settled) return settled;

    budget.observe(events.slice(observed));
    observed = events.length;
    const budgetFailure = budget.failure(trace);
    if (budgetFailure) {
      throw new Error(
        `${fixture.id}: ${budgetFailure}; recent events: ${recentEventTypes(start) || "none"}\n${stderr}`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

async function command(message) {
  const response = await send({ type: "prompt", message });
  assert.equal(response.success, true, response.error);
}

async function currentDeveloperStatus() {
  const start = events.length;
  await command("/develop status");
  const notification = events.slice(start).find(
    (event) => event.type === "extension_ui_request" && event.method === "notify",
  );
  assert.ok(notification, "Expected /develop status notification");
  return parseDeveloperStatus(notification.message);
}

try {
  const commandsResponse = await send({ type: "get_commands" });
  assert.equal(commandsResponse.success, true, commandsResponse.error);
  const commands = commandsResponse.data.commands;
  assert.ok(commands.some((entry) => entry.name === "develop" && entry.source === "extension"));

  const allLoadedSkills = commands.filter((entry) => entry.source === "skill");
  const packageSkills = allLoadedSkills.filter((entry) =>
    String(entry.sourceInfo?.path ?? "").startsWith(skills),
  );
  assert.equal(packageSkills.length, 10);
  assert.equal(packageSkills.some((entry) => entry.name === "develop"), false);
  for (const entry of packageSkills) {
    assert.ok(
      String(entry.sourceInfo.path).startsWith(skills),
      "Package skill provenance escaped @hobin/developer: " + entry.sourceInfo.path,
    );
  }

  const eventStart = events.length;
  await command("/develop on");
  assert.ok(
    events
      .slice(eventStart)
      .some(
        (event) =>
          event.type === "extension_ui_request" &&
          event.method === "setStatus" &&
          String(event.statusText).includes("developer: on"),
      ),
    "Expected /develop on to publish branch-visible status",
  );
  console.log("RPC smoke: command, skills, and mode state are available");

  await command("/develop strict");
  const strictStatusStart = events.length;
  await command("/develop status");
  const strictStatus = events.slice(strictStatusStart).find(
    (event) =>
      event.type === "extension_ui_request" &&
      event.method === "notify" &&
      String(event.message).includes("developer: strict"),
  );
  assert.ok(strictStatus, "Expected strict status output");
  for (const leaf of ["specify", "model", "sketch", "verify", "adversarial-eval"]) {
    assert.ok(
      String(strictStatus.message).includes(leaf),
      "Strict status did not report the Pi-loaded leaf " + leaf,
    );
  }
  const activeToolsLine = String(strictStatus.message)
    .split("\n")
    .find((line) => line.startsWith("active tools: "));
  assert.ok(activeToolsLine, "Strict status did not include active tools");
  const activeTools = new Set(activeToolsLine.slice("active tools: ".length).split(", "));
  for (const tool of ["read", "developer_route_question", "developer_record_judgment"]) {
    assert.ok(activeTools.has(tool), "Strict mode did not expose " + tool);
  }
  for (const tool of ["grep", "find", "ls"]) {
    assert.equal(activeTools.has(tool), false, "Strict mode force-enabled user-disabled tool " + tool);
  }
  for (const tool of ["edit", "write", "bash"]) {
    assert.equal(activeTools.has(tool), false, "Strict mode exposed mutation tool " + tool + " without a direct route");
  }
  await command("/develop on");
  const restoredStatusStart = events.length;
  await command("/develop status");
  const restoredStatus = events.slice(restoredStatusStart).find(
    (event) =>
      event.type === "extension_ui_request" &&
      event.method === "notify" &&
      String(event.message).includes("developer: on"),
  );
  assert.ok(restoredStatus, "Expected on-mode status after leaving strict");
  const restoredLine = String(restoredStatus.message)
    .split("\n")
    .find((line) => line.startsWith("active tools: "));
  assert.ok(restoredLine, "On-mode status did not include active tools");
  const restoredTools = new Set(restoredLine.slice("active tools: ".length).split(", "));
  for (const tool of ["bash", "edit", "write"]) {
    assert.ok(restoredTools.has(tool), "Leaving strict did not restore " + tool);
  }
  console.log("RPC smoke: strict active-tool gating is available");

  if (live) {
    for (const fixture of fixtures) {
      await command("/develop off");
      await command("/develop " + fixture.mode);
      const start = events.length;
      const casePath = join(workspace, fixture.id);
      const workspaceBefore = await snapshotWorkspace(casePath);
      try {
        const response = await send({
          type: "prompt",
          message: "Evaluation workspace: " + casePath + ". Work only in that directory.\n" + fixture.request,
        });
        assert.equal(response.success, true, response.error);
        await waitForFixtureSettled(start, fixture);

        const executionTrace = events.slice(start);
        const traceSummary = await validateExecutionTrace(
          fixture,
          executionTrace,
          packageUnderTest,
          casePath,
        );
        const changes = diffWorkspaceSnapshots(workspaceBefore, await snapshotWorkspace(casePath));
        const status = await currentDeveloperStatus();
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
        console.log(`Live eval passed: ${fixture.id} (${outcome})`);
      } catch (error) {
        try {
          await send({ type: "abort" }, 5000);
        } catch {
          child.kill("SIGTERM");
        }
        const tracePath = join(tmpdir(), `developer-eval-${fixture.id}.json`);
        await writeFile(tracePath, JSON.stringify(events.slice(start), null, 2));
        error.message += `\nTrace: ${tracePath}`;
        throw error;
      }
    }
  }
} finally {
  child.kill("SIGTERM");
}
