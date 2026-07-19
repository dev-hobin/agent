export const PROTOCOL = "developer/v2" as const;
export const LEGACY_PROTOCOL = "developer/v1" as const;
export const MODE_ENTRY = "developer.mode" as const;
export const ROUTE_TOOL = "developer_route_question" as const;
export const JUDGMENT_TOOL = "developer_record_judgment" as const;
export const LEGACY_ROUTE_TOOL = "route_question" as const;
export const LEGACY_JUDGMENT_TOOL = "record_judgment" as const;

export type DeveloperMode = "off" | "on" | "strict";
export type JudgmentStatus = "resolved" | "needs-evidence" | "not-applicable" | "blocked";
export type PendingQuestionStatus = "needs-evidence" | "blocked";
export type DirectExecutionProfile = "ordinary" | "behavior-preserving-structure";

export interface ModeEvent {
  protocol: typeof PROTOCOL;
  kind: "mode";
  mode: DeveloperMode;
}

export interface RouteEvent {
  protocol: typeof PROTOCOL;
  kind: "route";
  routeId: string;
  question: string;
  owner: string;
  reason: string;
  knownEvidence: string[];
  targetQuestionId?: string;
  methodLocation?: string;
  executionProfile?: DirectExecutionProfile;
}

export interface PendingQuestion {
  id: string;
  question: string;
  status: PendingQuestionStatus;
  sourceRouteId: string;
}

export interface JudgmentEvent {
  protocol: typeof PROTOCOL;
  kind: "judgment";
  routeId: string;
  question: string;
  owner: string;
  status: JudgmentStatus;
  result: string;
  basis: string[];
  openedQuestions: PendingQuestion[];
  artifacts: string[];
}

export type DeveloperEvent = ModeEvent | RouteEvent | JudgmentEvent;

export interface DeveloperState {
  mode: DeveloperMode;
  activeRoute?: RouteEvent;
  lastRoute?: RouteEvent;
  lastJudgment?: JudgmentEvent;
  pendingQuestions: PendingQuestion[];
}

export const initialState = (): DeveloperState => ({
  mode: "off",
  pendingQuestions: [],
});

export type ProtocolState = "idle" | "needs-judgment" | "needs-evidence" | "blocked";

export function protocolState(state: DeveloperState): ProtocolState {
  if (state.activeRoute) return "needs-judgment";
  if (state.pendingQuestions.some((question) => question.status === "blocked")) return "blocked";
  if (state.pendingQuestions.length > 0) return "needs-evidence";
  return "idle";
}

function upsertQuestion(questions: PendingQuestion[], next: PendingQuestion): PendingQuestion[] {
  return [...questions.filter((question) => question.id !== next.id), next];
}

export function applyDeveloperEvent(state: DeveloperState, event: DeveloperEvent): DeveloperState {
  if (event.kind === "mode") {
    if (event.mode === "off") return initialState();
    return { ...state, mode: event.mode };
  }

  if (event.kind === "route") {
    if (state.activeRoute) return state;
    return {
      ...state,
      activeRoute: event,
      lastRoute: event,
    };
  }

  if (!state.activeRoute || state.activeRoute.routeId !== event.routeId) return state;

  const route = state.activeRoute;
  const judgment = { ...event, question: route.question, owner: route.owner };
  let pending = [...state.pendingQuestions];
  const remainsOpen = event.status === "needs-evidence" || event.status === "blocked";

  if (route.targetQuestionId) {
    pending = pending.filter((question) => question.id !== route.targetQuestionId);
    if (remainsOpen) {
      pending = upsertQuestion(pending, {
        id: route.targetQuestionId,
        question: route.question,
        status: event.status,
        sourceRouteId: route.routeId,
      });
    }
  } else if (remainsOpen) {
    pending = upsertQuestion(pending, {
      id: `question:${route.routeId}`,
      question: route.question,
      status: event.status,
      sourceRouteId: route.routeId,
    });
  }

  for (const question of event.openedQuestions) pending = upsertQuestion(pending, question);

  return {
    ...state,
    activeRoute: undefined,
    lastJudgment: judgment,
    pendingQuestions: pending,
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isMode(value: unknown): value is DeveloperMode {
  return value === "off" || value === "on" || value === "strict";
}

function isJudgmentStatus(value: unknown): value is JudgmentStatus {
  return value === "resolved" || value === "needs-evidence" || value === "not-applicable" || value === "blocked";
}

function isDirectExecutionProfile(value: unknown): value is DirectExecutionProfile {
  return value === "ordinary" || value === "behavior-preserving-structure";
}

function parsePendingQuestion(value: unknown): PendingQuestion | undefined {
  if (!isObject(value)) return undefined;
  if (
    typeof value.id !== "string" ||
    typeof value.question !== "string" ||
    (value.status !== "needs-evidence" && value.status !== "blocked") ||
    typeof value.sourceRouteId !== "string"
  ) {
    return undefined;
  }
  return {
    id: value.id,
    question: value.question,
    status: value.status,
    sourceRouteId: value.sourceRouteId,
  };
}

export function normalizeDeveloperEvent(value: unknown): DeveloperEvent | undefined {
  if (!isObject(value)) return undefined;
  if (value.protocol !== PROTOCOL && value.protocol !== LEGACY_PROTOCOL) return undefined;

  if (value.kind === "mode") {
    if (!isMode(value.mode)) return undefined;
    return { protocol: PROTOCOL, kind: "mode", mode: value.mode };
  }

  if (value.kind === "route") {
    if (
      typeof value.routeId !== "string" ||
      typeof value.question !== "string" ||
      typeof value.owner !== "string" ||
      typeof value.reason !== "string" ||
      !isStringArray(value.knownEvidence) ||
      (value.targetQuestionId !== undefined && typeof value.targetQuestionId !== "string") ||
      (value.methodLocation !== undefined && typeof value.methodLocation !== "string") ||
      (value.executionProfile !== undefined && !isDirectExecutionProfile(value.executionProfile))
    ) {
      return undefined;
    }
    return {
      protocol: PROTOCOL,
      kind: "route",
      routeId: value.routeId,
      question: value.question,
      owner: value.owner,
      reason: value.reason,
      knownEvidence: value.knownEvidence,
      targetQuestionId: value.targetQuestionId,
      methodLocation: value.methodLocation,
      executionProfile: value.executionProfile,
    };
  }

  if (value.kind !== "judgment") return undefined;
  if (
    typeof value.routeId !== "string" ||
    typeof value.question !== "string" ||
    typeof value.owner !== "string" ||
    !isJudgmentStatus(value.status) ||
    typeof value.result !== "string" ||
    !isStringArray(value.basis) ||
    !isStringArray(value.artifacts)
  ) {
    return undefined;
  }

  if (value.protocol === LEGACY_PROTOCOL) {
    if (!isStringArray(value.openQuestions)) return undefined;
    return {
      protocol: PROTOCOL,
      kind: "judgment",
      routeId: value.routeId,
      question: value.question,
      owner: value.owner,
      status: value.status,
      result: value.result,
      basis: value.basis,
      openedQuestions: value.openQuestions.map((question, index) => ({
        id: `question:${value.routeId}:legacy:${index + 1}`,
        question,
        status: "needs-evidence",
        sourceRouteId: value.routeId,
      })),
      artifacts: value.artifacts,
    };
  }

  if (!Array.isArray(value.openedQuestions)) return undefined;
  const openedQuestions = value.openedQuestions.map(parsePendingQuestion);
  if (openedQuestions.some((question) => !question)) return undefined;
  return {
    protocol: PROTOCOL,
    kind: "judgment",
    routeId: value.routeId,
    question: value.question,
    owner: value.owner,
    status: value.status,
    result: value.result,
    basis: value.basis,
    openedQuestions: openedQuestions as PendingQuestion[],
    artifacts: value.artifacts,
  };
}

interface BranchEntryLike {
  type: string;
  customType?: string;
  data?: unknown;
  message?: { role?: string; toolName?: string; details?: unknown };
}

const DEVELOPER_TOOL_NAMES = new Set([
  ROUTE_TOOL,
  JUDGMENT_TOOL,
  LEGACY_ROUTE_TOOL,
  LEGACY_JUDGMENT_TOOL,
]);

export function eventFromBranchEntry(entry: BranchEntryLike): DeveloperEvent | undefined {
  if (entry.type === "custom" && entry.customType === MODE_ENTRY) {
    return normalizeDeveloperEvent(entry.data);
  }
  if (
    entry.type === "message" &&
    entry.message?.role === "toolResult" &&
    entry.message.toolName &&
    DEVELOPER_TOOL_NAMES.has(entry.message.toolName)
  ) {
    return normalizeDeveloperEvent(entry.message.details);
  }
  return undefined;
}

export function reconstructState(entries: ReadonlyArray<BranchEntryLike>): DeveloperState {
  return entries.reduce((state, entry) => {
    const event = eventFromBranchEntry(entry);
    return event ? applyDeveloperEvent(state, event) : state;
  }, initialState());
}
