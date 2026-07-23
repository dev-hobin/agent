import assertModule from "node:assert";
import test from "node:test";

import {
  assertAgentBeforeImplementationResolution,
  validateExecutionTrace,
} from "../scripts/eval-assertions.mjs";

const assert: typeof assertModule.strict = assertModule.strict;
const fixture = {
  id: "agent-gate",
  requiresJudgmentBashEvidence: true,
};

const trace = [
  {
    toolName: "developer_record_judgment",
    args: {
      status: "needs-evidence",
      open_questions: [{ resolution_owner: "agent", gate: "before-implementation" }],
    },
  },
  { toolName: "developer_route_question", args: { target: "signal",  } },
  { toolName: "bash", args: { command: "test -f src/contracts.ts" } },
  {
    toolName: "developer_record_judgment",
    args: { question_updates: [{ question_id: "question:1", status: "resolved" }] },
  },
  { toolName: "developer_route_question", args: { target: "implementation",  } },
];

test("agent before-implementation trace requires evidence routing, bash, explicit resolution, then implementation", () => {
  assert.doesNotThrow(() => assertAgentBeforeImplementationResolution(fixture, trace));
  assert.throws(
    () => assertAgentBeforeImplementationResolution(fixture, trace.filter((event) => event.toolName !== "bash")),
    /did not run bash/,
  );
  assert.throws(
    () => assertAgentBeforeImplementationResolution(fixture, trace.slice(0, -1)),
    /no implementation route followed/,
  );
});

const implementationTrace = [
  {
    type: "tool_execution_start",
    toolCallId: "route:1",
    toolName: "developer_route_question",
    args: { target: "implementation",  },
  },
  {
    type: "tool_execution_end",
    toolCallId: "route:1",
    toolName: "developer_route_question",
    isError: false,
    result: { content: [{ type: "text", text: "implementation route" }] },
  },
  {
    type: "tool_execution_start",
    toolCallId: "judgment:1",
    toolName: "developer_record_judgment",
    args: { status: "resolved", result: "Marker change reached a stable landing." },
  },
  {
    type: "tool_execution_end",
    toolCallId: "judgment:1",
    toolName: "developer_record_judgment",
    isError: false,
    result: { content: [{ type: "text", text: "recorded" }] },
  },
];

const structuralFixture = {
  id: "structural",
  admissibleFirstTargets: ["implementation"],
  preferredFirstTargets: ["signal"],
  requiredJudgmentTerms: ["Marker", "stable landing"],
  requiredJudgmentConcepts: [["change", "movement"]],
  mustRecordJudgment: true,
};

test("structural admissibility is hard while preferred routing remains a score", async () => {
  const summary = await validateExecutionTrace(structuralFixture, implementationTrace, ".");
  assert.deepEqual(summary, {
    firstTarget: "implementation",
    preferredFirstTarget: false,
    routeCount: 1,
    toolCallCount: 2,
  });

  await assert.rejects(
    validateExecutionTrace(
      { ...structuralFixture, admissibleFirstTargets: ["signal"] },
      implementationTrace,
      ".",
    ),
    /structurally inadmissible first route/,
  );
  await assert.rejects(
    validateExecutionTrace(
      { ...structuralFixture, requiredJudgmentTerms: ["unrelated-required-term"] },
      implementationTrace,
      ".",
    ),
    /omitted required semantic term/,
  );
  await assert.rejects(
    validateExecutionTrace(
      { ...structuralFixture, requiredJudgmentConcepts: [["unrelated", "irrelevant"]] },
      implementationTrace,
      ".",
    ),
    /omitted required semantic concept/,
  );
});
