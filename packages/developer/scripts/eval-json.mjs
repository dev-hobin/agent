import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { validateExecutionTrace } from "./eval-assertions.mjs";
import { createEvalWorkspace } from "./eval-workspace.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const extension = join(root, "extensions", "developer.ts");
const skills = join(root, "skills");
const piBin = process.env.PI_BIN || "pi";
const profile = process.env.PI_CODING_AGENT_DIR;

if (!profile) {
  throw new Error("JSON eval requires PI_CODING_AGENT_DIR pointing to a configured Pi profile.");
}

const fixtures = JSON.parse(await readFile(join(root, "evals", "fixtures.json"), "utf8"));
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
        "--extension",
        extension,
        "--skill",
        skills,
        "--develop-mode",
        fixture.mode,
        fixture.request,
      ],
      {
        cwd,
        env: { ...process.env, PI_CODING_AGENT_DIR: profile },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
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
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(fixture.id + ": timed out"));
    }, 180000);
    child.on("error", reject);
    child.on("exit", (code) => {
      clearTimeout(timeout);
      if (code !== 0) return reject(new Error(fixture.id + ": Pi exited " + code + "\n" + stderr));
      const events = stdout
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line) => JSON.parse(line));
      resolve(events);
    });
  });
}

for (const fixture of fixtures) {
  const events = await runFixture(fixture);
  assert.ok(events.some((event) => event.type === "agent_settled"), fixture.id + ": no agent_settled event");
  await validateExecutionTrace(fixture, events, root, join(workspace, fixture.id));
  console.log("JSON eval passed: " + fixture.id);
}
