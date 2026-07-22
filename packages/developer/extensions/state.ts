import { applyDeveloperEvent, developerSnapshot, initialState } from "./machine.ts";

export {
  applyDeveloperEvent,
  canApplyDeveloperEvent,
  developerMachine,
  developerSnapshot,
  initialState,
} from "./machine.ts";

export const PROTOCOL = "developer/v4" as const;
export const PREVIOUS_PROTOCOL = "developer/v3" as const;
export const OLDER_PROTOCOL = "developer/v2" as const;
export const LEGACY_PROTOCOL = "developer/v1" as const;
export const MODE_ENTRY = "developer.mode" as const;
export const FOCUS_ENTRY = "developer.question-focus" as const;
export const ROUTE_TOOL = "developer_route_question" as const;
export const JUDGMENT_TOOL = "developer_record_judgment" as const;
export const LEGACY_ROUTE_TOOL = "route_question" as const;
export const LEGACY_JUDGMENT_TOOL = "record_judgment" as const;
export const MAX_RESPONSE_FIELDS = 20;
export const MAX_RESPONSE_OPTIONS = 20;
export const MAX_RESPONSE_IDENTIFIER_CHARS = 64;
export const MAX_RESPONSE_TEXT_CHARS = 2_000;

export type DeveloperMode = "off" | "on" | "strict";
export type JudgmentStatus = "resolved" | "needs-evidence" | "not-applicable" | "blocked";
export type PendingQuestionStatus = "open" | "blocked";
export type QuestionResolutionOwner = "agent" | "user" | "environment" | "unknown";
export type QuestionGate = "none" | "before-direct" | "before-completion";
export type QuestionUpdateStatus = "resolved" | "not-applicable" | "open" | "blocked";
export type DirectExecutionProfile = "ordinary" | "behavior-preserving-structure";

export interface ModeEvent {
  protocol: typeof PROTOCOL;
  kind: "mode";
  mode: DeveloperMode;
}

export interface FocusEvent {
  protocol: typeof PROTOCOL;
  kind: "focus";
  questionId: string;
}

export interface DirectStepContract {
  movement: string;
  stopCondition: string;
  verification: string;
}

export interface RouteAlternative {
  owner: string;
  reason: string;
}

export interface RouteEvent {
  protocol: typeof PROTOCOL;
  kind: "route";
  routeId: string;
  question: string;
  owner: string;
  reason: string;
  knownEvidence: string[];
  consideredAlternatives: RouteAlternative[];
  targetQuestionId?: string;
  methodLocation?: string;
  executionProfile?: DirectExecutionProfile;
  directStep?: DirectStepContract;
}

export interface ChoiceResponseOption {
  value: string;
  label: string;
  description?: string;
  detailPrompt?: string;
}

export interface ChoiceResponseField {
  id: string;
  prompt: string;
  description?: string;
  options: ChoiceResponseOption[];
}

export interface ChoiceResponseSpec {
  kind: "choice-form";
  fields: ChoiceResponseField[];
}

export interface PendingQuestion {
  id: string;
  question: string;
  context?: string;
  responseSpec?: ChoiceResponseSpec;
  status: PendingQuestionStatus;
  resolutionOwner: QuestionResolutionOwner;
  gate: QuestionGate;
  resolutionCriteria: string;
  sourceRouteId: string;
}

export interface QuestionUpdate {
  questionId: string;
  status: QuestionUpdateStatus;
  result: string;
  basis: string[];
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
  questionUpdates: QuestionUpdate[];
  artifacts: string[];
  changedArtifacts: boolean;
}

export type DeveloperEvent = ModeEvent | FocusEvent | RouteEvent | JudgmentEvent;

export interface DeveloperState {
  mode: DeveloperMode;
  activeRoute?: RouteEvent;
  lastRoute?: RouteEvent;
  lastJudgment?: JudgmentEvent;
  routeHistory: RouteEvent[];
  judgmentHistory: JudgmentEvent[];
  pendingQuestions: PendingQuestion[];
  focusedQuestionId?: string;
  rerouteRequired: boolean;
  implementationFramingRequired: boolean;
  verificationRequired: boolean;
}

export type ProtocolState =
  | "idle"
  | "needs-judgment"
  | "needs-evidence"
  | "needs-answer"
  | "needs-routing"
  | "needs-verification"
  | "blocked";

export function protocolState(state: DeveloperState): ProtocolState {
  const snapshot = developerSnapshot(state);
  if (!snapshot.matches({ route: "idle" })) return "needs-judgment";
  if (
    snapshot.hasTag("blocks-direct") ||
    state.pendingQuestions.some((question) => question.status === "blocked")
  )
    return "blocked";
  if (state.pendingQuestions.some((question) => question.resolutionOwner === "user"))
    return "needs-answer";
  if (snapshot.matches({ questions: "open" })) return "needs-evidence";
  if (snapshot.hasTag("reroute-required")) return "needs-routing";
  if (snapshot.hasTag("verification-required")) return "needs-verification";
  return "idle";
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
  return (
    value === "resolved" ||
    value === "needs-evidence" ||
    value === "not-applicable" ||
    value === "blocked"
  );
}

function isDirectExecutionProfile(value: unknown): value is DirectExecutionProfile {
  return value === "ordinary" || value === "behavior-preserving-structure";
}

function parseDirectStep(value: unknown): DirectStepContract | undefined {
  if (!isObject(value)) return undefined;
  if (
    typeof value.movement !== "string" ||
    typeof value.stopCondition !== "string" ||
    typeof value.verification !== "string"
  ) {
    return undefined;
  }
  return {
    movement: value.movement,
    stopCondition: value.stopCondition,
    verification: value.verification,
  };
}

function parseRouteAlternative(value: unknown): RouteAlternative | undefined {
  if (!isObject(value) || typeof value.owner !== "string" || typeof value.reason !== "string") {
    return undefined;
  }
  return { owner: value.owner, reason: value.reason };
}

function isQuestionResolutionOwner(value: unknown): value is QuestionResolutionOwner {
  return value === "agent" || value === "user" || value === "environment" || value === "unknown";
}

function isQuestionGate(value: unknown): value is QuestionGate {
  return value === "none" || value === "before-direct" || value === "before-completion";
}

function isQuestionUpdateStatus(value: unknown): value is QuestionUpdateStatus {
  return (
    value === "resolved" || value === "not-applicable" || value === "open" || value === "blocked"
  );
}

const RESPONSE_IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

function requiredResponseText(value: unknown, maxChars: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const text = value.trim();
  return text && text.length <= maxChars ? text : undefined;
}

function optionalResponseText(value: unknown): string | undefined | null {
  if (value === undefined) return undefined;
  return requiredResponseText(value, MAX_RESPONSE_TEXT_CHARS) ?? null;
}

function parseChoiceResponseOption(
  value: unknown,
  seenValues: Set<string>,
): ChoiceResponseOption | undefined {
  if (!isObject(value)) return undefined;
  const optionValue = requiredResponseText(value.value, MAX_RESPONSE_IDENTIFIER_CHARS);
  const label = requiredResponseText(value.label, MAX_RESPONSE_TEXT_CHARS);
  const description = optionalResponseText(value.description);
  const detailPrompt = optionalResponseText(value.detailPrompt);
  if (!optionValue || !RESPONSE_IDENTIFIER.test(optionValue)) return undefined;
  if (seenValues.has(optionValue) || !label) return undefined;
  if (description === null || detailPrompt === null) return undefined;
  seenValues.add(optionValue);
  return { value: optionValue, label, description, detailPrompt };
}

function parseChoiceResponseField(
  value: unknown,
  seenIds: Set<string>,
): ChoiceResponseField | undefined {
  if (!isObject(value) || !Array.isArray(value.options)) return undefined;
  const id = requiredResponseText(value.id, MAX_RESPONSE_IDENTIFIER_CHARS);
  const prompt = requiredResponseText(value.prompt, MAX_RESPONSE_TEXT_CHARS);
  const description = optionalResponseText(value.description);
  if (!id || !RESPONSE_IDENTIFIER.test(id)) return undefined;
  if (seenIds.has(id) || !prompt || description === null) return undefined;
  if (value.options.length < 2 || value.options.length > MAX_RESPONSE_OPTIONS) return undefined;

  seenIds.add(id);
  const seenValues = new Set<string>();
  const options: ChoiceResponseOption[] = [];
  for (const rawOption of value.options) {
    const option = parseChoiceResponseOption(rawOption, seenValues);
    if (!option) return undefined;
    options.push(option);
  }
  return { id, prompt, description, options };
}

export function parseChoiceResponseSpec(value: unknown): ChoiceResponseSpec | undefined {
  if (!isObject(value) || value.kind !== "choice-form" || !Array.isArray(value.fields)) {
    return undefined;
  }
  if (value.fields.length === 0 || value.fields.length > MAX_RESPONSE_FIELDS) {
    return undefined;
  }
  const seenIds = new Set<string>();
  const fields: ChoiceResponseField[] = [];
  for (const rawField of value.fields) {
    const field = parseChoiceResponseField(rawField, seenIds);
    if (!field) return undefined;
    fields.push(field);
  }
  return { kind: "choice-form", fields };
}

function parsePendingQuestion(value: unknown): PendingQuestion | undefined {
  if (!isObject(value)) return undefined;
  if (
    typeof value.id !== "string" ||
    typeof value.question !== "string" ||
    (value.status !== "open" && value.status !== "blocked" && value.status !== "needs-evidence") ||
    typeof value.sourceRouteId !== "string"
  ) {
    return undefined;
  }
  const legacyBlocked = value.status === "blocked";
  let resolutionOwner: QuestionResolutionOwner = legacyBlocked ? "unknown" : "agent";
  if (isQuestionResolutionOwner(value.resolutionOwner)) resolutionOwner = value.resolutionOwner;
  let gate: QuestionGate = legacyBlocked ? "before-completion" : "none";
  if (isQuestionGate(value.gate)) gate = value.gate;
  const resolutionCriteria =
    typeof value.resolutionCriteria === "string"
      ? value.resolutionCriteria
      : `Obtain evidence that settles: ${value.question}`;
  const context = typeof value.context === "string" ? value.context.trim() || undefined : undefined;
  const responseSpec =
    resolutionOwner === "user" ? parseChoiceResponseSpec(value.responseSpec) : undefined;
  return {
    id: value.id,
    question: value.question,
    context,
    responseSpec,
    status: legacyBlocked ? "blocked" : "open",
    resolutionOwner,
    gate,
    resolutionCriteria,
    sourceRouteId: value.sourceRouteId,
  };
}

function parseQuestionUpdate(value: unknown): QuestionUpdate | undefined {
  if (
    !isObject(value) ||
    typeof value.questionId !== "string" ||
    !isQuestionUpdateStatus(value.status) ||
    typeof value.result !== "string" ||
    !isStringArray(value.basis)
  ) {
    return undefined;
  }
  return {
    questionId: value.questionId,
    status: value.status,
    result: value.result,
    basis: value.basis,
  };
}

export function normalizeDeveloperEvent(value: unknown): DeveloperEvent | undefined {
  if (!isObject(value)) return undefined;
  if (
    value.protocol !== PROTOCOL &&
    value.protocol !== PREVIOUS_PROTOCOL &&
    value.protocol !== OLDER_PROTOCOL &&
    value.protocol !== LEGACY_PROTOCOL
  )
    return undefined;

  if (value.kind === "mode") {
    if (!isMode(value.mode)) return undefined;
    return { protocol: PROTOCOL, kind: "mode", mode: value.mode };
  }

  if (value.kind === "focus") {
    if (
      (value.protocol !== PROTOCOL && value.protocol !== PREVIOUS_PROTOCOL) ||
      typeof value.questionId !== "string"
    )
      return undefined;
    return { protocol: PROTOCOL, kind: "focus", questionId: value.questionId };
  }

  if (value.kind === "route") {
    if (
      typeof value.routeId !== "string" ||
      typeof value.question !== "string" ||
      typeof value.owner !== "string" ||
      typeof value.reason !== "string" ||
      !isStringArray(value.knownEvidence) ||
      (value.consideredAlternatives !== undefined &&
        !Array.isArray(value.consideredAlternatives)) ||
      (value.targetQuestionId !== undefined && typeof value.targetQuestionId !== "string") ||
      (value.methodLocation !== undefined && typeof value.methodLocation !== "string") ||
      (value.executionProfile !== undefined && !isDirectExecutionProfile(value.executionProfile)) ||
      (value.directStep !== undefined && !parseDirectStep(value.directStep))
    ) {
      return undefined;
    }
    const consideredAlternatives = Array.isArray(value.consideredAlternatives)
      ? value.consideredAlternatives.map(parseRouteAlternative)
      : [];
    if (consideredAlternatives.some((alternative) => !alternative)) return undefined;
    return {
      protocol: PROTOCOL,
      kind: "route",
      routeId: value.routeId,
      question: value.question,
      owner: value.owner,
      reason: value.reason,
      knownEvidence: value.knownEvidence,
      consideredAlternatives: consideredAlternatives as RouteAlternative[],
      targetQuestionId: value.targetQuestionId,
      methodLocation: value.methodLocation,
      executionProfile: value.executionProfile,
      directStep: value.directStep === undefined ? undefined : parseDirectStep(value.directStep),
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
        status: "open",
        resolutionOwner: "agent",
        gate: "none",
        resolutionCriteria: `Obtain evidence that settles: ${question}`,
        sourceRouteId: String(value.routeId),
      })),
      questionUpdates: [],
      artifacts: value.artifacts,
      changedArtifacts: false,
    };
  }

  if (!Array.isArray(value.openedQuestions)) return undefined;
  const openedQuestions = value.openedQuestions.map(parsePendingQuestion);
  if (openedQuestions.some((question) => !question)) return undefined;
  if (value.questionUpdates !== undefined && !Array.isArray(value.questionUpdates))
    return undefined;
  const questionUpdates = Array.isArray(value.questionUpdates)
    ? value.questionUpdates.map(parseQuestionUpdate)
    : [];
  if (questionUpdates.some((update) => !update)) return undefined;
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
    questionUpdates: questionUpdates as QuestionUpdate[],
    artifacts: value.artifacts,
    changedArtifacts: typeof value.changedArtifacts === "boolean" ? value.changedArtifacts : false,
  };
}

interface BranchEntryLike {
  type: string;
  customType?: string;
  data?: unknown;
  message?: { role?: string; toolName?: string; details?: unknown };
}

const DEVELOPER_TOOL_NAMES = new Set<string>([
  ROUTE_TOOL,
  JUDGMENT_TOOL,
  LEGACY_ROUTE_TOOL,
  LEGACY_JUDGMENT_TOOL,
]);

export function eventFromBranchEntry(entry: BranchEntryLike): DeveloperEvent | undefined {
  if (
    entry.type === "custom" &&
    (entry.customType === MODE_ENTRY || entry.customType === FOCUS_ENTRY)
  ) {
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
