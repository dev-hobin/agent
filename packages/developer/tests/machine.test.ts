import assertModule from "node:assert";
import test from "node:test";

const assert: typeof assertModule.strict = assertModule.strict;

import {
  PROTOCOL,
  applyDeveloperEvent,
  canApplyDeveloperEvent,
  developerSnapshot,
  initialState,
  type JudgmentEvent,
  type RouteEvent,
} from "../extensions/state.ts";

const route = (routeId: string, owner: string, question = "What evidence is required?"): RouteEvent => ({
  protocol: PROTOCOL,
  kind: "route",
  routeId,
  question,
  owner,
  reason: "The route matches the current evidence.",
  knownEvidence: [],
  consideredAlternatives: [],
});

const judgment = (
  active: RouteEvent,
  overrides: Partial<JudgmentEvent> = {},
): JudgmentEvent => ({
  protocol: PROTOCOL,
  kind: "judgment",
  routeId: active.routeId,
  question: active.question,
  owner: active.owner,
  status: "resolved",
  result: "The route reached its judgment.",
  basis: ["Observed evidence."],
  openedQuestions: [],
  questionUpdates: [],
  artifacts: [],
  changedArtifacts: false,
  ...overrides,
});

test("the machine exposes orthogonal mode, route, question, and completion regions", () => {
  let state = applyDeveloperEvent(initialState(), { protocol: PROTOCOL, kind: "mode", mode: "strict" });
  const inspection = route("route:inspection", "signal");
  state = applyDeveloperEvent(state, inspection);
  let snapshot = developerSnapshot(state);

  assert.equal(snapshot.matches({ mode: "strict", route: "judgment" }), true);
  assert.equal(snapshot.hasTag("execute"), true);
  assert.equal(snapshot.hasTag("mutate"), false);

  state = applyDeveloperEvent(state, {
    ...judgment(inspection),
    status: "needs-evidence",
    openedQuestions: [
      {
        id: "question:location",
        question: "Which source file owns the conversion?",
        status: "open",
        resolutionOwner: "agent",
        gate: "before-direct",
        resolutionCriteria: "Repository inspection identifies the owning source file.",
        sourceRouteId: inspection.routeId,
      },
    ],
  });
  snapshot = developerSnapshot(state);
  assert.equal(snapshot.matches({ route: "idle", questions: "open", directGate: "blocked" }), true);
  assert.equal(snapshot.hasTag("blocks-direct"), true);
  assert.equal(snapshot.hasTag("blocks-completion"), true);
});

test("a direct gate rejects direct transition while preserving a judgment resolution path", () => {
  let state = applyDeveloperEvent(initialState(), { protocol: PROTOCOL, kind: "mode", mode: "strict" });
  const first = route("route:first", "signal");
  state = applyDeveloperEvent(state, first);
  state = applyDeveloperEvent(state, {
    ...judgment(first),
    status: "needs-evidence",
    openedQuestions: [
      {
        id: "question:location",
        question: "Which file owns the conversion?",
        status: "open",
        resolutionOwner: "agent",
        gate: "before-direct",
        resolutionCriteria: "A repository search identifies the file.",
        sourceRouteId: first.routeId,
      },
    ],
  });

  const blockedDirect = route("route:blocked-direct", "direct", "Implement the conversion.");
  assert.equal(canApplyDeveloperEvent(state, blockedDirect), false);
  assert.equal(applyDeveloperEvent(state, blockedDirect), state);

  const resolution = {
    ...route("route:resolve-location", "signal", "Which file owns the conversion?"),
    targetQuestionId: "question:location",
  };
  assert.equal(canApplyDeveloperEvent(state, resolution), true);
  state = applyDeveloperEvent(state, resolution);
  assert.equal(developerSnapshot(state).hasTag("execute"), true);
  assert.equal(developerSnapshot(state).hasTag("mutate"), false);

  state = applyDeveloperEvent(state, {
    ...judgment(resolution),
    questionUpdates: [
      {
        questionId: "question:location",
        status: "resolved",
        result: "The conversion belongs in src/contracts.ts.",
        basis: ["Repository search result."],
      },
    ],
  });
  assert.equal(developerSnapshot(state).hasTag("blocks-direct"), false);
  assert.equal(canApplyDeveloperEvent(state, blockedDirect), true);
});

test("changed direct work and completion questions remain independent completion regions", () => {
  let state = applyDeveloperEvent(initialState(), { protocol: PROTOCOL, kind: "mode", mode: "on" });
  const acceptance = route("route:acceptance", "verify", "Does the user accept the rendered result?");
  state = applyDeveloperEvent(state, acceptance);
  state = applyDeveloperEvent(state, {
    ...judgment(acceptance),
    status: "needs-evidence",
    openedQuestions: [
      {
        id: "question:acceptance",
        question: "Does the user accept the rendered result?",
        status: "open",
        resolutionOwner: "user",
        gate: "before-completion",
        resolutionCriteria: "The user explicitly accepts it.",
        sourceRouteId: acceptance.routeId,
      },
    ],
  });
  const direct = route("route:changed", "direct", "Apply the local change.");
  state = applyDeveloperEvent(state, direct);
  state = applyDeveloperEvent(state, { ...judgment(direct), changedArtifacts: true });

  const snapshot = developerSnapshot(state);
  assert.equal(
    snapshot.matches({ verification: "required", completionGate: "blocked", checkpoint: "required" }),
    true,
  );
  assert.equal(snapshot.hasTag("reroute-required"), true);
  assert.equal(snapshot.hasTag("verification-required"), true);
  assert.equal(snapshot.hasTag("blocks-completion"), true);
  assert.equal(snapshot.hasTag("blocks-direct"), false);
});
