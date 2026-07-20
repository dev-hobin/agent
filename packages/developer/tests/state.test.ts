import assert from "node:assert/strict";
import test from "node:test";

import {
  JUDGMENT_TOOL,
  LEGACY_JUDGMENT_TOOL,
  LEGACY_PROTOCOL,
  LEGACY_ROUTE_TOOL,
  MODE_ENTRY,
  PREVIOUS_PROTOCOL,
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
  consideredAlternatives: [],
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
  questionUpdates: [],
  artifacts: ["tests/schedule.test.ts"],
  changedArtifacts: false,
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
  assert.equal(state.routeHistory.length, 1);
  assert.equal(state.judgmentHistory.length, 1);
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

test("structured evidence questions replace the generic route question", () => {
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
        status: "open",
        resolutionOwner: "agent",
        gate: "none",
        resolutionCriteria: "Observe the empty-schedule result.",
        sourceRouteId: route.routeId,
      },
    ],
  });

  assert.equal(protocolState(state), "needs-evidence");
  assert.deepEqual(state.pendingQuestions.map((question) => question.id), [
    "question:route:1:open:1",
  ]);
});

test("a focused broad question is explicitly replaced by its actionable child", () => {
  let state = applyDeveloperEvent(initialState(), route);
  state = applyDeveloperEvent(state, {
    ...resolved(route),
    status: "needs-evidence",
    result: "The broad environment claim needs one concrete observation.",
    basis: [],
    openedQuestions: [
      {
        id: "question:broad",
        question: "Is the checkout environment correct?",
        status: "open",
        resolutionOwner: "agent",
        gate: "none",
        resolutionCriteria: "Identify the concrete missing environment observation.",
        sourceRouteId: route.routeId,
      },
    ],
  });
  const refinementRoute = {
    ...route,
    routeId: "route:refine-question",
    question: "Which concrete checkout observation is missing?",
    targetQuestionId: "question:broad",
  };
  state = applyDeveloperEvent(state, refinementRoute);
  state = applyDeveloperEvent(state, {
    ...resolved(refinementRoute),
    status: "needs-evidence",
    result: "Only the narrow viewport observation remains.",
    basis: ["Desktop checkout has already been observed."],
    openedQuestions: [
      {
        id: "question:narrow-viewport",
        question: "Does checkout remain usable at 320px?",
        status: "open",
        resolutionOwner: "agent",
        gate: "before-completion",
        resolutionCriteria: "Observe a successful checkout interaction at 320px.",
        sourceRouteId: refinementRoute.routeId,
      },
    ],
    questionUpdates: [
      {
        questionId: "question:broad",
        status: "not-applicable",
        result: "The broad question was decomposed into one observable child.",
        basis: ["Desktop behavior was already observed."],
      },
    ],
  });

  assert.deepEqual(state.pendingQuestions.map((question) => question.id), ["question:narrow-viewport"]);
});

test("duplicate open-question wording keeps one stable question identity", () => {
  let state = applyDeveloperEvent(initialState(), { protocol: PROTOCOL, kind: "mode", mode: "on" });
  state = applyDeveloperEvent(state, route);
  state = applyDeveloperEvent(state, {
    ...resolved(route),
    status: "needs-evidence",
    result: "The same evidence gap was reported twice.",
    basis: [],
    openedQuestions: [
      {
        id: "question:first",
        question: "What happens for an empty schedule?",
        status: "open",
        resolutionOwner: "agent",
        gate: "none",
        resolutionCriteria: "Observe the empty-schedule result.",
        sourceRouteId: route.routeId,
      },
      {
        id: "question:duplicate",
        question: "What happens for an empty schedule",
        status: "open",
        resolutionOwner: "agent",
        gate: "none",
        resolutionCriteria: "Observe the empty-schedule result.",
        sourceRouteId: route.routeId,
      },
    ],
  });

  assert.equal(state.pendingQuestions.length, 1);
  assert.equal(state.pendingQuestions[0]?.id, "question:first");
});

test("an unrelated implementation judgment can naturally resolve an existing agent question", () => {
  let state = applyDeveloperEvent(initialState(), { protocol: PROTOCOL, kind: "mode", mode: "on" });
  state = applyDeveloperEvent(state, route);
  state = applyDeveloperEvent(state, {
    ...resolved(route),
    status: "needs-evidence",
    result: "Implementation evidence is still needed.",
    basis: [],
    openedQuestions: [
      {
        id: "question:implementation-evidence",
        question: "Does the empty schedule preserve absence?",
        status: "open",
        resolutionOwner: "agent",
        gate: "none",
        resolutionCriteria: "The focused empty-schedule test observes absence.",
        sourceRouteId: route.routeId,
      },
    ],
  });

  const implementationRoute = {
    ...route,
    routeId: "route:implementation",
    question: "Implement the accepted local conversion.",
    owner: "direct",
  };
  state = applyDeveloperEvent(state, implementationRoute);
  state = applyDeveloperEvent(state, {
    ...resolved(implementationRoute),
    questionUpdates: [
      {
        questionId: "question:implementation-evidence",
        status: "resolved",
        result: "The empty schedule preserves absence.",
        basis: ["The focused empty-schedule test passes."],
      },
    ],
  });

  assert.deepEqual(state.pendingQuestions, []);
  assert.equal(state.rerouteRequired, true);
  assert.equal(protocolState(state), "needs-routing");
});

test("a user-owned before-direct question is visibly blocking", () => {
  let state = applyDeveloperEvent(initialState(), route);
  state = applyDeveloperEvent(state, {
    ...resolved(route),
    status: "blocked",
    result: "A product decision is required.",
    openedQuestions: [
      {
        id: "question:user-decision",
        question: "Should an empty schedule mean absent or cleared?",
        status: "open",
        resolutionOwner: "user",
        gate: "before-direct",
        resolutionCriteria: "The product owner chooses absent or cleared.",
        sourceRouteId: route.routeId,
      },
    ],
  });

  assert.equal(protocolState(state), "blocked");
  assert.equal(state.pendingQuestions[0]?.resolutionOwner, "user");
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
  state = applyDeveloperEvent(state, {
    ...resolved(retry),
    questionUpdates: [
      {
        questionId: "question:route:1",
        status: "resolved",
        result: "The product owner confirmed the boundary.",
        basis: ["Explicit product-owner confirmation."],
      },
    ],
  });

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

test("resolved model work requires sketch or signal framing before implementation", () => {
  const modelRoute = { ...route, owner: "model" };
  let state = applyDeveloperEvent(initialState(), modelRoute);
  state = applyDeveloperEvent(state, resolved(modelRoute));
  assert.equal(state.implementationFramingRequired, true);

  const sketchRoute = { ...route, routeId: "route:sketch", owner: "sketch" };
  state = applyDeveloperEvent(state, sketchRoute);
  state = applyDeveloperEvent(state, resolved(sketchRoute));
  assert.equal(state.implementationFramingRequired, false);
});

test("a changed direct landing requires a later resolved verify judgment", () => {
  const directRoute = { ...route, owner: "direct" };
  let state = applyDeveloperEvent(initialState(), directRoute);
  state = applyDeveloperEvent(state, { ...resolved(directRoute), changedArtifacts: true });
  assert.equal(state.verificationRequired, true);
  assert.equal(state.rerouteRequired, true);
  assert.equal(protocolState(state), "needs-routing");

  const verifyRoute = { ...route, routeId: "route:verify", owner: "verify" };
  state = applyDeveloperEvent(state, verifyRoute);
  assert.equal(state.rerouteRequired, false);
  state = applyDeveloperEvent(state, resolved(verifyRoute));
  assert.equal(state.verificationRequired, false);
  assert.equal(protocolState(state), "idle");
});

test("before-completion questions keep verification debt until their criteria are resolved", () => {
  const questionRoute = { ...route, routeId: "route:completion-question", owner: "specify" };
  let state = applyDeveloperEvent(initialState(), questionRoute);
  state = applyDeveloperEvent(state, {
    ...resolved(questionRoute),
    status: "needs-evidence",
    result: "User acceptance is still required.",
    basis: [],
    openedQuestions: [
      {
        id: "question:acceptance",
        question: "Does the user accept the rendered behavior?",
        status: "open",
        resolutionOwner: "user",
        gate: "before-completion",
        resolutionCriteria: "The user explicitly accepts the rendered behavior.",
        sourceRouteId: questionRoute.routeId,
      },
    ],
  });

  const directRoute = { ...route, routeId: "route:changed", owner: "direct" };
  state = applyDeveloperEvent(state, directRoute);
  state = applyDeveloperEvent(state, { ...resolved(directRoute), changedArtifacts: true });
  const firstVerify = { ...route, routeId: "route:verify-before-acceptance", owner: "verify" };
  state = applyDeveloperEvent(state, firstVerify);
  state = applyDeveloperEvent(state, resolved(firstVerify));
  assert.equal(state.verificationRequired, true);
  assert.equal(protocolState(state), "needs-answer");

  const finalVerify = { ...route, routeId: "route:verify-after-acceptance", owner: "verify" };
  state = applyDeveloperEvent(state, finalVerify);
  state = applyDeveloperEvent(state, {
    ...resolved(finalVerify),
    questionUpdates: [
      {
        questionId: "question:acceptance",
        status: "resolved",
        result: "The user accepted the rendered behavior.",
        basis: ["Explicit user acceptance."],
      },
    ],
  });
  assert.equal(state.verificationRequired, false);
  assert.equal(protocolState(state), "idle");
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

test("replays v3 pending questions with conservative owner and gate defaults", () => {
  const previousRoute = { ...route, protocol: PREVIOUS_PROTOCOL };
  const state = reconstructState([
    toolEntry(ROUTE_TOOL, previousRoute),
    toolEntry(JUDGMENT_TOOL, {
      ...resolved(route),
      protocol: PREVIOUS_PROTOCOL,
      status: "needs-evidence",
      openedQuestions: [
        {
          id: "question:v3",
          question: "What evidence is still missing?",
          status: "needs-evidence",
          sourceRouteId: route.routeId,
        },
      ],
      questionUpdates: undefined,
    }),
  ]);

  assert.equal(state.pendingQuestions[0]?.status, "open");
  assert.equal(state.pendingQuestions[0]?.resolutionOwner, "agent");
  assert.equal(state.pendingQuestions[0]?.gate, "none");
  assert.deepEqual(state.lastJudgment?.questionUpdates, []);
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

test("replays valid direct execution profiles and rejects malformed ones", () => {
  const directRoute: RouteEvent = {
    ...route,
    owner: "direct",
    executionProfile: "behavior-preserving-structure",
  };
  const valid = reconstructState([toolEntry(ROUTE_TOOL, directRoute)]);
  assert.equal(valid.activeRoute?.executionProfile, "behavior-preserving-structure");

  const invalid = reconstructState([
    toolEntry(ROUTE_TOOL, { ...directRoute, executionProfile: "invented-profile" }),
  ]);
  assert.equal(invalid.activeRoute, undefined);
});
