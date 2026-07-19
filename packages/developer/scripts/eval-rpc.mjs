import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { validateExecutionTrace } from "./eval-assertions.mjs";
import { createEvalWorkspace } from "./eval-workspace.mjs";
import { createJsonlDecoder } from "./jsonl.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const packageUnderTest = process.env.DEVELOPER_EVAL_PACKAGE_PATH || root;
const extension = join(packageUnderTest, "extensions", "developer.ts");
const skills = join(packageUnderTest, "skills");
const piBin = process.env.PI_BIN || "pi";
const live = process.env.DEVELOPER_EVAL_LIVE === "1";
const fixtures = JSON.parse(await readFile(join(root, "evals", "fixtures.json"), "utf8"));
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
const resourceArgs = loadAsPackage ? [] : ["--extension", extension, "--skill", skills];
const child = spawn(
  piBin,
  [
    "--mode",
    "rpc",
    "--offline",
    "--no-session",
    ...resourceArgs,
  ],
  {
    cwd: workspace,
    env: { ...process.env, PI_CODING_AGENT_DIR: configDir },
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

function waitForEventAfter(start, predicate, timeoutMs = 120000) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const poll = () => {
      const found = events.slice(start).find(predicate);
      if (found) return resolve(found);
      if (Date.now() - startedAt > timeoutMs) {
        return reject(new Error("Event timeout\n" + stderr));
      }
      setTimeout(poll, 25);
    };
    poll();
  });
}

async function command(message) {
  const response = await send({ type: "prompt", message });
  assert.equal(response.success, true, response.error);
}

try {
  const commandsResponse = await send({ type: "get_commands" });
  assert.equal(commandsResponse.success, true, commandsResponse.error);
  const commands = commandsResponse.data.commands;
  assert.ok(commands.some((entry) => entry.name === "develop" && entry.source === "extension"));

  const loadedSkills = commands.filter((entry) => entry.source === "skill").map((entry) => entry.name);
  assert.equal(loadedSkills.length, 10);
  assert.equal(loadedSkills.includes("develop"), false);
  for (const entry of commands.filter((command) => command.source === "skill")) {
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
      const response = await send({
        type: "prompt",
        message: "Evaluation workspace: " + casePath + ". Work only in that directory.\n" + fixture.request,
      });
      assert.equal(response.success, true, response.error);
      await waitForEventAfter(start, (event) => event.type === "agent_settled");

      await validateExecutionTrace(fixture, events.slice(start), packageUnderTest, casePath);
      console.log("Live eval passed: " + fixture.id);
    }
  }
} finally {
  child.kill("SIGTERM");
}
