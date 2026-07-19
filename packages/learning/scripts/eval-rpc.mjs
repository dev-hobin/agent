import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createJsonlDecoder } from "./jsonl.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const packageUnderTest = process.env.LEARNING_EVAL_PACKAGE_PATH || root;
const piBin = process.env.PI_BIN
  ? resolve(process.env.PI_BIN)
  : join(root, "node_modules", ".bin", "pi");
const configDir =
  process.env.PI_CODING_AGENT_DIR || (await mkdtemp(join(tmpdir(), "learning-pi-rpc-")));
const workspace = await mkdtemp(join(tmpdir(), "learning-workspace-"));
const loadAsPackage = !process.env.PI_CODING_AGENT_DIR;
if (loadAsPackage) {
  await writeFile(
    join(configDir, "settings.json"),
    JSON.stringify({ packages: [packageUnderTest] }, null, 2),
  );
}

const child = spawn(
  piBin,
  [
    "--mode",
    "rpc",
    "--offline",
    "--no-session",
    "--no-context-files",
    "--no-prompt-templates",
    "--tools",
    "validate_learning_artifact",
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

const responses = new Map();
const waiters = new Map();
let nextId = 1;

const decoder = createJsonlDecoder({
  onValue(value) {
    if (value.type !== "response" || !value.id) return;
    responses.set(value.id, value);
    const resolve = waiters.get(value.id);
    if (resolve) {
      waiters.delete(value.id);
      resolve(value);
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
  for (const resolve of waiters.values()) resolve({ success: false, error: error.message });
  waiters.clear();
});

function send(command, timeoutMs = 10000) {
  const id = `learning-eval-${nextId++}`;
  child.stdin.write(JSON.stringify({ ...command, id }) + "\n");
  return new Promise((resolve, reject) => {
    const existing = responses.get(id);
    if (existing) return resolve(existing);
    const timer = setTimeout(() => {
      waiters.delete(id);
      reject(new Error(`RPC timeout for ${command.type}\n${stderr}`));
    }, timeoutMs);
    waiters.set(id, (response) => {
      clearTimeout(timer);
      resolve(response);
    });
  });
}

try {
  const state = await send({ type: "get_state" });
  assert.equal(state.success, true, state.error);
  assert.equal(state.data.isStreaming, false);

  const response = await send({ type: "get_commands" });
  assert.equal(response.success, true, response.error);
  const learningCommand = response.data.commands.find((entry) => entry.name === "learning");
  assert.equal(learningCommand?.source, "extension");
  assert.match(learningCommand?.description ?? "", /Learning approach/);
  const skillCommands = response.data.commands.filter((entry) => entry.source === "skill");
  assert.deepEqual(
    skillCommands.map((entry) => entry.name).sort(),
    [
      "skill:conceptualize",
      "skill:exercise",
      "skill:opensource-reading",
      "skill:patternize",
      "skill:technical-reading",
    ],
  );
  for (const command of skillCommands) {
    assert.equal(typeof command.description, "string");
    assert.doesNotMatch(command.description, /\bskip\b/i);
    assert.ok(
      String(command.sourceInfo.path).startsWith(join(packageUnderTest, "skills")),
      `Learning skill provenance escaped the package under test: ${command.sourceInfo.path}`,
    );
  }

  assert.doesNotMatch(stderr, /failed to load|unknown tool|validate_learning_artifact.*not found/i);
  console.log("Pi RPC smoke: learning package loaded its chooser, validator, and five skill commands");
} finally {
  child.kill("SIGTERM");
}
