import assert from "node:assert/strict";
import test from "node:test";

import {
  JUDGMENT_TOOL,
  LEGACY_JUDGMENT_TOOL,
  LEGACY_PROTOCOL,
  LEGACY_ROUTE_TOOL,
  MODE_ENTRY,
  PROTOCOL,
  ROUTE_TOOL,
  applyDeveloperEvent,
  initialState,
  protocolState,
  reconstructState,
  type JudgmentEvent,
  type RouteEvent,
} from "../extensions/state.ts";

const route: RouteEvent = {
  protocol: PROTOCOL,
  kind: "route",
  routeId: "route:1",
  question: "Where should schedule conversion live?",
  owner: "sketch",
  reason: "The behavior is known but the boundary is not.",
  knownEvidence: ["The form and domain model use different shapes."],
};

const resolved = (active: RouteEvent, result = "Use a pure boundary conversion."): JudgmentEvent => ({
  protocol: PROTOCOL,
  kind: "judgment",
  routeId: active.routeId,
  question: active.question,
  owner: active.owner,
  status: "resolved",
  result,
  basis: ["Representative cases agree."],
  openedQuestions: [],
  artifacts: ["tests/schedule.test.ts"],
});

const toolEntry = (toolName: string, details: unknown) => ({
  type: "message",
  message: { role: "toolResult", toolName, details },
});

test("idle means no routed or pending question, not task completion", () => {
  const state = applyDeveloperEvent(initialState(), {
    protocol: PROTOCOL,
    kind: "mode",
    mode: "on",
  });
  assert.equal(protocolState(state), "idle");
  assert.equal(state.lastJudgment, undefined);
});

test("reconstructs mode and protocol state from the active branch", () => {
  const entries = [
    {
      type: "custom",
      customType: MODE_ENTRY,
      data: { protocol: PROTOCOL, kind: "mode", mode: "on" },
    },
    toolEntry(ROUTE_TOOL, route),
    toolEntry(JUDGMENT_TOOL, resolved(route)),
  ];

  const state = reconstructState(entries);
  assert.equal(state.mode, "on");
  assert.equal(state.activeRoute, undefined);
  assert.equal(protocolState(state), "idle");
  assert.equal(state.lastJudgment?.result, "Use a pure boundary conversion.");
  assert.deepEqual(state.pendingQuestions, []);
});

test("branch reconstruction ignores events from another branch", () => {
  const base = {
    type: "custom",
    customType: MODE_ENTRY,
    data: { protocol: PROTOCOL, kind: "mode", mode: "strict" },
  };
  const firstBranch = reconstructState([base, toolEntry(ROUTE_TOOL, route)]);
  const otherRoute = { ...route, routeId: "route:2", question: "Is this only a naming problem?", owner: "naming-judgment" };
  const secondBranch = reconstructState([base, toolEntry(ROUTE_TOOL, otherRoute)]);

  assert.equal(firstBranch.activeRoute?.routeId, "route:1");
  assert.equal(secondBranch.activeRoute?.routeId, "route:2");
});

test("needs-evidence closes the route and creates structured pending questions", () => {
  let state = applyDeveloperEvent(initialState(), { protocol: PROTOCOL, kind: "mode", mode: "on" });
  state = applyDeveloperEvent(state, route);
  state = applyDeveloperEvent(state, {
    ...resolved(route),
    status: "needs-evidence",
    result: "The current test does not distinguish the two boundaries.",
    basis: [],
    openedQuestions: [
      {
        id: "question:route:1:open:1",
        question: "What happens for an empty schedule?",
        status: "needs-evidence",
        sourceRouteId: route.routeId,
      },
    ],
  });

  assert.equal(protocolState(state), "needs-evidence");
  assert.deepEqual(state.pendingQuestions.map((question) => question.id), [
    "question:route:1",
    "question:route:1:open:1",
  ]);
});

test("a later route resolves a pending question by ID instead of text matching", () => {
  let state = applyDeveloperEvent(initialState(), { protocol: PROTOCOL, kind: "mode", mode: "on" });
  state = applyDeveloperEvent(state, route);
  state = applyDeveloperEvent(state, {
    ...resolved(route),
    status: "blocked",
    result: "Product policy is missing.",
    openedQuestions: [],
  });
  const retry = {
    ...route,
    routeId: "route:retry",
    question: "The product owner confirmed the boundary; what follows?",
    targetQuestionId: "question:route:1",
  };
  state = applyDeveloperEvent(state, retry);
  state = applyDeveloperEvent(state, resolved(retry));

  assert.equal(protocolState(state), "idle");
  assert.deepEqual(state.pendingQuestions, []);
});

test("an unrelated resolved route cannot hide an existing blocker", () => {
  let state = applyDeveloperEvent(initialState(), { protocol: PROTOCOL, kind: "mode", mode: "on" });
  state = applyDeveloperEvent(state, route);
  state = applyDeveloperEvent(state, {
    ...resolved(route),
    status: "blocked",
    result: "Product policy is missing.",
    openedQuestions: [],
  });
  const unrelated = { ...route, routeId: "route:unrelated", question: "Is this variable named well?", owner: "naming-judgment" };
  state = applyDeveloperEvent(state, unrelated);
  state = applyDeveloperEvent(state, resolved(unrelated, "The name preserves domain meaning."));

  assert.equal(protocolState(state), "blocked");
  assert.equal(state.pendingQuestions[0]?.status, "blocked");
});

test("stale judgments cannot close a different active route", () => {
  const state = applyDeveloperEvent(applyDeveloperEvent(initialState(), route), {
    ...resolved(route),
    routeId: "route:stale",
  });
  assert.equal(state.activeRoute?.routeId, route.routeId);
  assert.equal(state.lastJudgment, undefined);
});

test("a second route event cannot overwrite an active route during replay", () => {
  const first = applyDeveloperEvent(initialState(), route);
  const second = applyDeveloperEvent(first, {
    ...route,
    routeId: "route:overlap",
    question: "Should this overwrite the first route?",
  });

  assert.equal(second.activeRoute?.routeId, route.routeId);
  assert.equal(second.lastRoute?.routeId, route.routeId);
});

test("reconstructs legacy v1 entries without reviving accepted or verified claims", () => {
  const legacyRoute = { ...route, protocol: LEGACY_PROTOCOL };
  const state = reconstructState([
    { type: "custom", customType: MODE_ENTRY, data: { protocol: LEGACY_PROTOCOL, kind: "mode", mode: "on" } },
    toolEntry(LEGACY_ROUTE_TOOL, legacyRoute),
    toolEntry(LEGACY_JUDGMENT_TOOL, {
      protocol: LEGACY_PROTOCOL,
      kind: "judgment",
      routeId: route.routeId,
      question: route.question,
      owner: "specify",
      status: "resolved",
      result: "A specified contract, not an accepted one.",
      basis: ["Repository evidence"],
      openQuestions: ["Who accepts the contract?"],
      artifacts: [],
    }),
  ]);

  assert.equal(state.lastJudgment?.result, "A specified contract, not an accepted one.");
  assert.equal(state.pendingQuestions[0]?.question, "Who accepts the contract?");
  assert.equal("acceptedContract" in state, false);
  assert.equal("verifiedClaims" in state, false);
});

test("ignores matching-looking details emitted by another tool", () => {
  const state = reconstructState([toolEntry("other_extension_tool", route)]);
  assert.equal(state.activeRoute, undefined);
});

test("ignores malformed Developer events instead of crashing branch replay", () => {
  const state = reconstructState([
    toolEntry(ROUTE_TOOL, { protocol: PROTOCOL, kind: "route", routeId: "broken" }),
    toolEntry(JUDGMENT_TOOL, { protocol: PROTOCOL, kind: "judgment", openedQuestions: "not-an-array" }),
  ]);
  assert.equal(state.activeRoute, undefined);
  assert.equal(state.lastJudgment, undefined);
});
