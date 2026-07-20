import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const ROUTE_TOOL = "developer_route_question";
const JUDGMENT_TOOL = "developer_record_judgment";

function resultText(event) {
  const content = event?.result?.content;
  if (!Array.isArray(content)) return "";
  return content
    .filter((item) => item && item.type === "text")
    .map((item) => item.text)
    .join("\n");
}

async function skillBody(root, owner) {
  const source = await readFile(join(root, "skills", owner, "SKILL.md"), "utf8");
  return source.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "").trim();
}

export function assertAgentBeforeDirectResolution(fixture, executions) {
  const openingIndex = executions.findIndex(
    (event) =>
      event.toolName === JUDGMENT_TOOL &&
      event.args.status === "needs-evidence" &&
      event.args.open_questions?.some(
        (question) => question.resolution_owner === "agent" && question.gate === "before-direct",
      ),
  );
  assert.ok(openingIndex >= 0, fixture.id + ": no agent-owned before-direct question was opened");

  const evidenceRouteOffset = executions.slice(openingIndex + 1).findIndex(
    (event) => event.toolName === ROUTE_TOOL && event.args.owner !== "direct",
  );
  assert.ok(evidenceRouteOffset >= 0, fixture.id + ": no non-direct evidence route followed the gate");
  const evidenceRouteIndex = openingIndex + 1 + evidenceRouteOffset;
  const resolutionOffset = executions.slice(evidenceRouteIndex + 1).findIndex(
    (event) =>
      event.toolName === JUDGMENT_TOOL &&
      event.args.question_updates?.some(
        (update) => update.status === "resolved" || update.status === "not-applicable",
      ),
  );
  assert.ok(resolutionOffset >= 0, fixture.id + ": the agent-owned question was not explicitly resolved");
  const resolutionIndex = evidenceRouteIndex + 1 + resolutionOffset;

  if (fixture.requiresJudgmentBashEvidence) {
    assert.ok(
      executions
        .slice(evidenceRouteIndex + 1, resolutionIndex)
        .some((event) => event.toolName === "bash"),
      fixture.id + ": the non-direct evidence route did not run bash",
    );
  }
  assert.ok(
    executions
      .slice(resolutionIndex + 1)
      .some((event) => event.toolName === ROUTE_TOOL && event.args.owner === "direct"),
    fixture.id + ": no direct route followed explicit gate resolution",
  );
}

export async function validateExecutionTrace(fixture, events, root, casePath) {
  const executions = events.filter((event) => event.type === "tool_execution_start");
  const endings = events.filter((event) => event.type === "tool_execution_end");
  const routes = executions.filter((event) => event.toolName === ROUTE_TOOL);
  const judgments = executions.filter((event) => event.toolName === JUDGMENT_TOOL);

  assert.ok(routes.length > 0, fixture.id + ": " + ROUTE_TOOL + " was not called");
  const firstOwner = routes[0].args.owner;
  assert.ok(
    fixture.admissibleFirstOwners.includes(firstOwner),
    fixture.id + ": structurally inadmissible first route " + JSON.stringify(routes[0].args),
  );
  if (fixture.maxRoutes !== undefined) {
    assert.ok(
      routes.length <= fixture.maxRoutes,
      fixture.id + ": routed " + routes.length + " times; expected at most " + fixture.maxRoutes,
    );
  }
  if (fixture.mustRecordJudgment) {
    assert.ok(judgments.length > 0, fixture.id + ": " + JUDGMENT_TOOL + " was not called");
  }

  for (const expectedReference of fixture.expectedReferenceReads ?? []) {
    assert.ok(
      executions.some(
        (event) =>
          event.toolName === "read" &&
          String(event.args?.path ?? event.args?.file_path ?? "")
            .replaceAll("\\", "/")
            .endsWith(expectedReference),
      ),
      fixture.id + ": Pi read did not load " + expectedReference,
    );
  }

  for (const route of routes) {
    const ending = endings.find(
      (event) => event.toolName === ROUTE_TOOL && event.toolCallId === route.toolCallId,
    );
    assert.ok(ending, fixture.id + ": route result was not observed");
    assert.equal(
      ending.isError,
      false,
      fixture.id +
        ": route result was an error for " +
        JSON.stringify(route.args) +
        "\n" +
        resultText(ending),
    );
    if (route.args.owner !== "direct") {
      const expectedBody = await skillBody(root, route.args.owner);
      assert.ok(
        resultText(ending).includes(expectedBody),
        fixture.id + ": selected leaf body was not loaded exactly for " + route.args.owner,
      );
      assert.match(resultText(ending), /<developer-method name="[^"]+" location="[^"]+" base-dir="[^"]+">/);
      assert.match(resultText(ending), /Resolve relative references from /);
    }
  }

  for (const judgment of judgments) {
    const ending = endings.find(
      (event) => event.toolName === JUDGMENT_TOOL && event.toolCallId === judgment.toolCallId,
    );
    assert.ok(ending, fixture.id + ": judgment result was not observed");
    assert.equal(
      ending.isError,
      false,
      fixture.id +
        ": judgment result was an error for " +
        JSON.stringify(judgment.args) +
        "\n" +
        resultText(ending),
    );
  }
  const judgmentText = judgments.map((judgment) => String(judgment.args.result ?? "")).join("\n");
  const normalizedJudgment = judgmentText.toLocaleLowerCase();
  for (const term of fixture.requiredJudgmentTerms ?? []) {
    assert.ok(
      normalizedJudgment.includes(term.toLocaleLowerCase()),
      `${fixture.id}: judgment omitted required semantic term ${term}`,
    );
  }
  for (const alternatives of fixture.requiredJudgmentConcepts ?? []) {
    assert.ok(
      alternatives.some((term) => normalizedJudgment.includes(term.toLocaleLowerCase())),
      `${fixture.id}: judgment omitted required semantic concept (${alternatives.join(" | ")})`,
    );
  }

  if (fixture.mutationRequiresDirectRoute) {
    const mutationIndex = executions.findIndex((event) =>
      ["edit", "write"].includes(event.toolName),
    );
    if (mutationIndex >= 0) {
      assert.ok(
        executions
          .slice(0, mutationIndex)
          .some((event) => event.toolName === ROUTE_TOOL && event.args.owner === "direct"),
        fixture.id + ": mutation started before a direct route",
      );
    }
  }

  if (fixture.requiresAgentBeforeDirectResolution) {
    assertAgentBeforeDirectResolution(fixture, executions);
  }

  if (fixture.workspaceAssertion === "paused-marker") {
    assert.ok(casePath, fixture.id + ": missing evaluation workspace path");
    const source = await readFile(join(casePath, "src", "contracts.ts"), "utf8");
    assert.match(source, /export const PAUSED_EVAL_MARKER\s*=\s*["']stable-landing["']/);
  }

  if (fixture.workspaceAssertion === "agent-gate-marker") {
    assert.ok(casePath, fixture.id + ": missing evaluation workspace path");
    const source = await readFile(join(casePath, "src", "contracts.ts"), "utf8");
    assert.match(source, /export const AGENT_GATE_EVAL_MARKER\s*=\s*["']resolved["']/);
  }

  if (fixture.workspaceAssertion === "schedule-conversion") {
    assert.ok(casePath, fixture.id + ": missing evaluation workspace path");
    const moduleUrl = pathToFileURL(join(casePath, "src", "contracts.ts"));
    moduleUrl.searchParams.set("eval", String(Date.now()));
    const contracts = await import(moduleUrl.href);
    assert.equal(typeof contracts.toScheduleContent, "function", fixture.id + ": toScheduleContent was not exported");
    assert.deepEqual(contracts.toScheduleContent({}), { startsAt: null, endsAt: null });
    assert.deepEqual(contracts.toScheduleContent({ startDate: "2026-07-19", endDate: null }), {
      startsAt: "2026-07-19",
      endsAt: null,
    });
    const testSource = await readFile(join(casePath, "test", "contracts.test.ts"), "utf8");
    assert.match(testSource, /toScheduleContent/, fixture.id + ": tests do not exercise toScheduleContent");
    assert.match(
      testSource,
      /for\s*\(|\.forEach\s*\(|\.map\s*\(|test\.each\s*\(/,
      fixture.id + ": toScheduleContent cases are not table-driven",
    );
    const testRun = spawnSync(process.execPath, ["--test", "test/contracts.test.ts"], {
      cwd: casePath,
      encoding: "utf8",
    });
    assert.equal(testRun.status, 0, fixture.id + ": workspace tests failed\n" + testRun.stdout + testRun.stderr);
  }

  return {
    firstOwner,
    preferredFirstOwner: fixture.preferredFirstOwners.includes(firstOwner),
    routeCount: routes.length,
    toolCallCount: executions.length,
  };
}
