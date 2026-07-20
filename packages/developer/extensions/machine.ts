import { assign, setup, transition, type StateValue } from "xstate";

import type {
  DeveloperEvent,
  DeveloperState,
  FocusEvent,
  JudgmentEvent,
  ModeEvent,
  PendingQuestion,
  RouteEvent,
} from "./state.ts";

type DeveloperMachineEvent =
  | { type: "MODE"; event: ModeEvent }
  | { type: "FOCUS"; event: FocusEvent }
  | { type: "ROUTE"; event: RouteEvent }
  | { type: "JUDGMENT"; event: JudgmentEvent };

export type DeveloperMachineTag =
  | "execute"
  | "mutate"
  | "blocks-direct"
  | "blocks-completion"
  | "reroute-required"
  | "framing-required"
  | "verification-required";

export const initialState = (): DeveloperState => ({
  mode: "off",
  routeHistory: [],
  judgmentHistory: [],
  pendingQuestions: [],
  rerouteRequired: false,
  implementationFramingRequired: false,
  verificationRequired: false,
});

function normalizedQuestion(value: string): string {
  return value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function upsertQuestion(questions: PendingQuestion[], next: PendingQuestion): PendingQuestion[] {
  const nextKey = normalizedQuestion(next.question);
  const existingIndex = questions.findIndex(
    (question) => question.id === next.id || normalizedQuestion(question.question) === nextKey,
  );
  if (existingIndex === -1) return [...questions, next];

  const existing = questions[existingIndex];
  if (!existing) return [...questions, next];
  const updated = [...questions];
  updated[existingIndex] = { ...next, id: existing.id };
  return updated;
}

function applyRouteContext(state: DeveloperState, event: RouteEvent): DeveloperState {
  return {
    ...state,
    activeRoute: event,
    lastRoute: event,
    routeHistory: [...state.routeHistory, event],
    rerouteRequired: false,
    focusedQuestionId:
      event.targetQuestionId === state.focusedQuestionId ? undefined : state.focusedQuestionId,
  };
}

function questionsAfterJudgment(
  state: DeveloperState,
  route: RouteEvent,
  event: JudgmentEvent,
): PendingQuestion[] {
  let pending = [...state.pendingQuestions];
  const remainsOpen = event.status === "needs-evidence" || event.status === "blocked";
  if (!route.targetQuestionId && remainsOpen && event.openedQuestions.length === 0) {
    pending = upsertQuestion(pending, {
      id: `question:${route.routeId}`,
      question: route.question,
      status: event.status === "blocked" ? "blocked" : "open",
      resolutionOwner: "unknown",
      gate: event.status === "blocked" ? "before-completion" : "none",
      resolutionCriteria: `Obtain evidence that settles: ${route.question}`,
      sourceRouteId: route.routeId,
    });
  }

  for (const question of event.openedQuestions) pending = upsertQuestion(pending, question);
  for (const update of event.questionUpdates) {
    if (update.status === "resolved" || update.status === "not-applicable") {
      pending = pending.filter((question) => question.id !== update.questionId);
      continue;
    }
    const existing = pending.find((question) => question.id === update.questionId);
    if (!existing) continue;
    pending = upsertQuestion(pending, {
      ...existing,
      status: update.status,
      sourceRouteId: route.routeId,
    });
  }
  return pending;
}

function framingAfterJudgment(state: DeveloperState, route: RouteEvent, event: JudgmentEvent): boolean {
  if (route.owner === "model" && event.status === "resolved") return true;
  const closesGate =
    (route.owner === "sketch" || route.owner === "signal") &&
    (event.status === "resolved" || event.status === "not-applicable");
  return closesGate ? false : state.implementationFramingRequired;
}

function verificationAfterJudgment(
  state: DeveloperState,
  route: RouteEvent,
  event: JudgmentEvent,
  pending: PendingQuestion[],
): boolean {
  if (route.owner === "direct" && event.changedArtifacts) return true;
  const completionQuestionRemains = pending.some(
    (question) => question.gate === "before-completion" || question.gate === "before-direct",
  );
  if (route.owner === "verify" && event.status === "resolved" && !completionQuestionRemains) {
    return false;
  }
  return state.verificationRequired;
}

function applyJudgmentContext(state: DeveloperState, event: JudgmentEvent): DeveloperState {
  const route = state.activeRoute;
  if (!route) return state;
  const judgment = { ...event, question: route.question, owner: route.owner };
  const pending = questionsAfterJudgment(state, route, event);
  return {
    ...state,
    activeRoute: undefined,
    lastJudgment: judgment,
    judgmentHistory: [...state.judgmentHistory, judgment],
    pendingQuestions: pending,
    focusedQuestionId: pending.some((question) => question.id === state.focusedQuestionId)
      ? state.focusedQuestionId
      : undefined,
    rerouteRequired: route.owner === "direct",
    implementationFramingRequired: framingAfterJudgment(state, route, event),
    verificationRequired: verificationAfterJudgment(state, route, event, pending),
  };
}

function assertNever(value: never): never {
  throw new Error(`Unexpected Developer machine event: ${JSON.stringify(value)}`);
}

function reduceDeveloperContext(state: DeveloperState, event: DeveloperEvent): DeveloperState {
  switch (event.kind) {
    case "mode":
      return event.mode === "off" ? initialState() : { ...state, mode: event.mode };
    case "focus":
      return { ...state, focusedQuestionId: event.questionId };
    case "route":
      return applyRouteContext(state, event);
    case "judgment":
      return applyJudgmentContext(state, event);
    default:
      return assertNever(event);
  }
}

function machineEvent(event: DeveloperEvent): DeveloperMachineEvent {
  switch (event.kind) {
    case "mode":
      return { type: "MODE", event };
    case "focus":
      return { type: "FOCUS", event };
    case "route":
      return { type: "ROUTE", event };
    case "judgment":
      return { type: "JUDGMENT", event };
    default:
      return assertNever(event);
  }
}

function canApplyEvent(context: DeveloperState, event: DeveloperMachineEvent): boolean {
  switch (event.type) {
    case "MODE":
      return true;
    case "FOCUS":
      return context.pendingQuestions.some((question) => question.id === event.event.questionId);
    case "ROUTE":
      return (
        !context.activeRoute &&
        (event.event.owner !== "direct" ||
          !context.pendingQuestions.some((question) => question.gate === "before-direct"))
      );
    case "JUDGMENT":
      return context.activeRoute?.routeId === event.event.routeId;
    default:
      return assertNever(event);
  }
}

const machineSetup = setup({
  types: {
    context: {} as DeveloperState,
    events: {} as DeveloperMachineEvent,
    tags: {} as DeveloperMachineTag,
  },
  actions: {
    applyEvent: assign(({ context, event }) => reduceDeveloperContext(context, event.event)),
  },
  guards: {
    eventAllowed: ({ context, event }) => canApplyEvent(context, event),
    modeOff: ({ context }) => context.mode === "off",
    modeOn: ({ context }) => context.mode === "on",
    modeStrict: ({ context }) => context.mode === "strict",
    routeIdle: ({ context }) => !context.activeRoute,
    routeJudgment: ({ context }) => Boolean(context.activeRoute && context.activeRoute.owner !== "direct"),
    routeDirect: ({ context }) => context.activeRoute?.owner === "direct",
    questionsClear: ({ context }) => context.pendingQuestions.length === 0,
    questionsOpen: ({ context }) => context.pendingQuestions.length > 0,
    directGateClear: ({ context }) =>
      !context.pendingQuestions.some((question) => question.gate === "before-direct"),
    directGateBlocked: ({ context }) =>
      context.pendingQuestions.some((question) => question.gate === "before-direct"),
    completionGateClear: ({ context }) =>
      !context.pendingQuestions.some(
        (question) => question.gate === "before-direct" || question.gate === "before-completion",
      ),
    completionGateBlocked: ({ context }) =>
      context.pendingQuestions.some(
        (question) => question.gate === "before-direct" || question.gate === "before-completion",
      ),
    checkpointReady: ({ context }) => !context.rerouteRequired,
    checkpointRequired: ({ context }) => context.rerouteRequired,
    framingClear: ({ context }) => !context.implementationFramingRequired,
    framingRequired: ({ context }) => context.implementationFramingRequired,
    verificationCurrent: ({ context }) => !context.verificationRequired,
    verificationRequired: ({ context }) => context.verificationRequired,
  },
});

export const developerMachine = machineSetup.createMachine({
  id: "developer",
  type: "parallel",
  context: initialState(),
  on: {
    MODE: { guard: "eventAllowed", actions: "applyEvent" },
    FOCUS: { guard: "eventAllowed", actions: "applyEvent" },
    ROUTE: { guard: "eventAllowed", actions: "applyEvent" },
    JUDGMENT: { guard: "eventAllowed", actions: "applyEvent" },
  },
  states: {
    mode: {
      initial: "off",
      states: {
        off: { always: [{ guard: "modeOn", target: "on" }, { guard: "modeStrict", target: "strict" }] },
        on: { always: [{ guard: "modeOff", target: "off" }, { guard: "modeStrict", target: "strict" }] },
        strict: { always: [{ guard: "modeOff", target: "off" }, { guard: "modeOn", target: "on" }] },
      },
    },
    route: {
      initial: "idle",
      states: {
        idle: { always: [{ guard: "routeDirect", target: "direct" }, { guard: "routeJudgment", target: "judgment" }] },
        judgment: { tags: "execute", always: [{ guard: "routeIdle", target: "idle" }, { guard: "routeDirect", target: "direct" }] },
        direct: { tags: ["execute", "mutate"], always: [{ guard: "routeIdle", target: "idle" }, { guard: "routeJudgment", target: "judgment" }] },
      },
    },
    questions: {
      initial: "clear",
      states: {
        clear: { always: { guard: "questionsOpen", target: "open" } },
        open: { always: { guard: "questionsClear", target: "clear" } },
      },
    },
    directGate: {
      initial: "clear",
      states: {
        clear: { always: { guard: "directGateBlocked", target: "blocked" } },
        blocked: { tags: "blocks-direct", always: { guard: "directGateClear", target: "clear" } },
      },
    },
    completionGate: {
      initial: "clear",
      states: {
        clear: { always: { guard: "completionGateBlocked", target: "blocked" } },
        blocked: { tags: "blocks-completion", always: { guard: "completionGateClear", target: "clear" } },
      },
    },
    checkpoint: {
      initial: "ready",
      states: {
        ready: { always: { guard: "checkpointRequired", target: "required" } },
        required: { tags: "reroute-required", always: { guard: "checkpointReady", target: "ready" } },
      },
    },
    framing: {
      initial: "clear",
      states: {
        clear: { always: { guard: "framingRequired", target: "required" } },
        required: { tags: "framing-required", always: { guard: "framingClear", target: "clear" } },
      },
    },
    verification: {
      initial: "current",
      states: {
        current: { always: { guard: "verificationRequired", target: "required" } },
        required: { tags: "verification-required", always: { guard: "verificationCurrent", target: "current" } },
      },
    },
  },
});

function machineValue(state: DeveloperState): StateValue {
  let route = "idle";
  if (state.activeRoute?.owner === "direct") route = "direct";
  else if (state.activeRoute) route = "judgment";
  const directBlocked = state.pendingQuestions.some((question) => question.gate === "before-direct");
  const completionBlocked = state.pendingQuestions.some(
    (question) => question.gate === "before-direct" || question.gate === "before-completion",
  );
  return {
    mode: state.mode,
    route,
    questions: state.pendingQuestions.length > 0 ? "open" : "clear",
    directGate: directBlocked ? "blocked" : "clear",
    completionGate: completionBlocked ? "blocked" : "clear",
    checkpoint: state.rerouteRequired ? "required" : "ready",
    framing: state.implementationFramingRequired ? "required" : "clear",
    verification: state.verificationRequired ? "required" : "current",
  };
}

export function developerSnapshot(state: DeveloperState) {
  return developerMachine.resolveState({ value: machineValue(state), context: state });
}

export function canApplyDeveloperEvent(state: DeveloperState, event: DeveloperEvent): boolean {
  return developerSnapshot(state).can(machineEvent(event));
}

export function applyDeveloperEvent(state: DeveloperState, event: DeveloperEvent): DeveloperState {
  const [nextSnapshot] = transition(developerMachine, developerSnapshot(state), machineEvent(event));
  return nextSnapshot.context;
}
