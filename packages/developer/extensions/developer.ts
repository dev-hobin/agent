import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { StringEnum } from "@earendil-works/pi-ai";
import {
  DEFAULT_MAX_BYTES,
  DEFAULT_MAX_LINES,
  keyHint,
  type ExtensionAPI,
  type ExtensionCommandContext,
  type ExtensionContext,
  type Skill,
} from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";

import {
  availablePackageSkills,
  loadCandidateSkills,
  renderSkillMethod,
} from "./skills.ts";
import {
  JUDGMENT_TOOL,
  MODE_ENTRY,
  PROTOCOL,
  ROUTE_TOOL,
  applyDeveloperEvent,
  initialState,
  normalizeDeveloperEvent,
  protocolState,
  reconstructState,
  type DeveloperMode,
  type DeveloperState,
  type JudgmentEvent,
  type ModeEvent,
  type RouteEvent,
} from "./state.ts";
import {
  builtinMutationToolNames,
  reconcileProtocolTools,
  type ToolPolicyMemory,
} from "./tool-policy.ts";
import {
  DeveloperWidget,
  prepareQuestionPrompt,
  renderDeveloperFooter,
  showDeveloperActionSelector,
  showDeveloperStatus,
  showPendingQuestionSelector,
} from "./tui.ts";

const PROTOCOL_TOOLS = [ROUTE_TOOL, JUDGMENT_TOOL] as const;
const skillsRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "skills");
const MAX_PENDING_QUESTIONS = 20;
const MAX_QUESTION_CHARS = 2_000;
const MAX_EVIDENCE_CHARS = 2_000;
const MAX_RESULT_CHARS = 4_000;
const MAX_ARTIFACT_CHARS = 4_096;
const DEVELOPER_COMMAND_ACTIONS = ["on", "strict", "status", "questions", "off"] as const;

function textResult<T>(text: string, details: T) {
  return {
    content: [{ type: "text" as const, text }],
    details,
  };
}

function resultText(result: { content: Array<{ type: string; text?: string }> }): string {
  return result.content
    .filter((item) => item.type === "text" && item.text)
    .map((item) => item.text)
    .join("\n");
}

function reusableText(content: string, lastComponent: unknown): Text {
  const component = lastComponent instanceof Text ? lastComponent : new Text("", 0, 0);
  component.setText(content);
  return component;
}

function ensureSafeToolText(text: string, label: string): void {
  const bytes = Buffer.byteLength(text, "utf8");
  const lines = text.split(/\r?\n/).length;
  if (bytes > DEFAULT_MAX_BYTES || lines > DEFAULT_MAX_LINES) {
    fail(
      `${label} exceeds Pi's tool-output limit (${bytes} bytes, ${lines} lines). Narrow the routed question or evidence.`,
    );
  }
}

function fail(message: string): never {
  throw new Error(message);
}

function sameToolSet(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  const rightSet = new Set(right);
  return left.every((tool) => rightSet.has(tool));
}

function compactLine(value: string, maxChars = 160): string {
  const line = value.replace(/\s+/g, " ").trim();
  return line.length <= maxChars ? line : `${line.slice(0, maxChars - 1)}…`;
}

function summarizeState(state: DeveloperState): string {
  if (state.mode === "off") return "developer: off";
  const target = state.activeRoute ? state.activeRoute.owner : "none";
  return `developer: ${state.mode} · target: ${target} · ${protocolState(state)}`;
}

function protocolPrompt(state: DeveloperState, availableSkillNames: string[]): string {
  const lines = [
    "",
    `Developer protocol (${state.mode}) is active.`,
    "- Treat the protocol as adaptive routing, never as a fixed sequence of skills.",
    `- Call ${ROUTE_TOOL} only when one concrete development question needs focused judgment or direct action.`,
    "- Use owner=direct when the next local action is already justified; otherwise set owner to the available skill whose scope best fits the question.",
    `- Follow the skill instructions returned by ${ROUTE_TOOL}, then close that route with ${JUDGMENT_TOOL}.`,
    "- Keep a direct route open through implementation and evidence collection; record its judgment afterward.",
    "- Protocol state is routing bookkeeping. Idle never proves product completion, user acceptance, or current verification.",
    "- Product files are changed with Pi implementation tools. Developer protocol tools only route and record judgments.",
  ];

  if (state.mode === "strict") {
    lines.push(
      "- Strict mode withholds active Pi built-in edit, write, and bash tools unless the active route target is direct. It does not classify or sandbox other extensions' tools.",
    );
  }

  if (state.activeRoute) {
    lines.push(
      `Active route: ${state.activeRoute.routeId} · ${state.activeRoute.owner} · ${state.activeRoute.question}`,
    );
    if (state.activeRoute.methodLocation) {
      lines.push(
        `Active skill location: ${state.activeRoute.methodLocation}. Read it again if compaction or a later turn no longer contains the full instructions.`,
      );
    }
  }
  if (state.pendingQuestions.length > 0) {
    lines.push("Pending Developer questions:");
    for (const question of state.pendingQuestions) {
      lines.push(`- ${question.id} · ${question.status} · ${question.question}`);
    }
    lines.push(
      `- To revisit one, pass its exact ID as open_question_id to ${ROUTE_TOOL}. Report any question that remains open at handoff.`,
    );
  }
  lines.push(
    `Available Developer skills: ${availableSkillNames.length > 0 ? availableSkillNames.join(", ") : "none; use direct only"}.`,
  );
  return lines.join("\n");
}

function routeRenderText(event: RouteEvent | undefined): string {
  if (!event) return "Route unavailable";
  const target = event.targetQuestionId ? ` · revisits ${event.targetQuestionId}` : "";
  return `${event.owner} · ${compactLine(event.question)}${target}`;
}

function judgmentRenderText(event: JudgmentEvent | undefined): string {
  if (!event) return "Judgment unavailable";
  return `${event.status} · ${compactLine(event.result)}`;
}

export default async function developer(pi: ExtensionAPI) {
  const candidates = loadCandidateSkills(skillsRoot);
  let availableSkills = new Map<string, Skill>();
  let state = initialState();
  let routeOpening = false;
  let toolPolicyMemory: ToolPolicyMemory = { withheldBuiltins: new Set() };

  pi.registerFlag("develop-mode", {
    description: "Start the Developer protocol in on or strict mode",
    type: "string",
  });

  const syncProtocolTools = () => {
    const current = pi.getActiveTools();
    const next = reconcileProtocolTools({
      activeTools: current,
      allTools: pi.getAllTools(),
      mode: state.mode,
      directRouteOpen: state.activeRoute?.owner === "direct",
      protocolTools: PROTOCOL_TOOLS,
      memory: toolPolicyMemory,
    });
    toolPolicyMemory = next.memory;
    if (!sameToolSet(current, next.activeTools)) pi.setActiveTools(next.activeTools);
  };

  const refreshUI = (ctx: ExtensionContext) => {
    if (state.mode === "off") {
      ctx.ui.setStatus("developer", undefined);
      ctx.ui.setWidget("developer", undefined);
      return;
    }

    ctx.ui.setStatus(
      "developer",
      ctx.mode === "tui" ? renderDeveloperFooter(state, ctx.ui.theme) : summarizeState(state),
    );
    if (!state.activeRoute && state.pendingQuestions.length === 0) {
      ctx.ui.setWidget("developer", undefined);
      return;
    }

    if (ctx.mode === "tui") {
      const viewState = state;
      ctx.ui.setWidget("developer", (_tui, theme) => new DeveloperWidget(viewState, theme), {
        placement: "belowEditor",
      });
      return;
    }

    const lines = [
      ...(state.activeRoute
        ? [`route · ${state.activeRoute.owner} · ${compactLine(state.activeRoute.question)}`]
        : []),
      ...state.pendingQuestions
        .slice(0, 3)
        .map((question) => `open · ${question.id} · ${compactLine(question.question)}`),
      ...(state.pendingQuestions.length > 3 ? [`open · +${state.pendingQuestions.length - 3} more`] : []),
    ];
    ctx.ui.setWidget("developer", lines, { placement: "belowEditor" });
  };

  const reconstruct = (ctx: ExtensionContext) => {
    state = reconstructState(ctx.sessionManager.getBranch());
    syncProtocolTools();
    refreshUI(ctx);
  };

  const setMode = (mode: DeveloperMode, ctx: ExtensionContext) => {
    const event: ModeEvent = { protocol: PROTOCOL, kind: "mode", mode };
    pi.appendEntry(MODE_ENTRY, event);
    state = applyDeveloperEvent(state, event);
    syncProtocolTools();
    refreshUI(ctx);
  };

  const RouteParams = Type.Object({
    question: Type.String({
      minLength: 1,
      maxLength: MAX_QUESTION_CHARS,
      description: "The single concrete judgment or action question to route",
    }),
    owner: Type.String({
      minLength: 1,
      maxLength: 64,
      description: "direct, or an exact skill name from the current Available Developer skills list",
    }),
    reason: Type.String({
      minLength: 1,
      maxLength: MAX_QUESTION_CHARS,
      description: "Why this route target fits the current evidence",
    }),
    known_evidence: Type.Optional(
      Type.Array(Type.String({ maxLength: MAX_EVIDENCE_CHARS }), {
        maxItems: 12,
        description: "Evidence already known before routing",
      }),
    ),
    open_question_id: Type.Optional(
      Type.String({ maxLength: 512, description: "Exact pending question ID when this route revisits one" }),
    ),
  });

  pi.registerTool({
    name: ROUTE_TOOL,
    label: "Developer Route Question",
    description:
      "Route one concrete development question to direct action or one currently available @hobin/developer skill. This is adaptive routing, not a workflow sequence.",
    promptSnippet: "Choose how to handle one development question",
    promptGuidelines: [
      `Call ${ROUTE_TOOL} only when there is no active Developer route.`,
      `Use ${ROUTE_TOOL} with the most focused skill supported by current evidence; use owner=direct for an already-justified local action.`,
    ],
    parameters: RouteParams,
    executionMode: "sequential",
    async execute(toolCallId, params, _signal, _onUpdate, ctx) {
      if (state.mode === "off") fail("Developer protocol is off. Run /develop on or /develop strict first.");
      if (state.activeRoute || routeOpening) {
        if (!state.activeRoute) fail("Another Developer route is currently opening. Wait for it to finish.");
        fail(`Route ${state.activeRoute.routeId} is still active. Record its judgment before routing another question.`);
      }
      routeOpening = true;

      try {
        const question = params.question.trim();
        const reason = params.reason.trim();
        if (!question || !reason) fail("Question and reason must contain non-whitespace text.");

        const targetQuestionId = params.open_question_id?.trim() || undefined;
        if (targetQuestionId && !state.pendingQuestions.some((item) => item.id === targetQuestionId)) {
          fail(`Unknown pending question ID: ${targetQuestionId}`);
        }

        const owner = params.owner;
        const skill = owner === "direct" ? undefined : availableSkills.get(owner);
        if (owner !== "direct" && !skill) {
          fail(`Developer skill ${owner} is unavailable or disabled in the current Pi resource configuration.`);
        }

        const method =
          owner === "direct"
            ? [
                "# Direct action",
                "",
                "The next local action is already justified. Keep this route open while using Pi implementation tools and collecting evidence.",
              ].join("\n")
            : await renderSkillMethod(skill!);

        const event: RouteEvent = {
          protocol: PROTOCOL,
          kind: "route",
          routeId: `route:${toolCallId}`,
          question,
          owner,
          reason,
          knownEvidence: (params.known_evidence ?? []).map((item) => item.trim()).filter(Boolean),
          targetQuestionId,
          methodLocation: skill?.filePath,
        };
        const response = [
          `Route ID: ${event.routeId}`,
          `Question: ${event.question}`,
          `Target: ${event.owner}`,
          skill ? `Skill location: ${skill.filePath}` : "Skill location: direct action; no skill file",
          `Reason: ${event.reason}`,
          `Known evidence: ${event.knownEvidence.length > 0 ? event.knownEvidence.join(" | ") : "none"}`,
          targetQuestionId ? `Revisits pending question: ${targetQuestionId}` : "Revisits pending question: none",
          `When this route has done its job, call ${JUDGMENT_TOOL} with this exact route ID.`,
          "",
          "---",
          "",
          method,
        ].join("\n");
        ensureSafeToolText(response, "Developer route result");

        state = applyDeveloperEvent(state, event);
        syncProtocolTools();
        refreshUI(ctx);
        return textResult(response, event);
      } finally {
        routeOpening = false;
      }
    },
    renderCall(args, theme, context) {
      const owner = typeof args.owner === "string" && args.owner.length > 0 ? args.owner : "…";
      const question =
        typeof args.question === "string" && args.question.length > 0 ? compactLine(args.question) : "…";
      return reusableText(
        `${theme.fg("toolTitle", theme.bold(ROUTE_TOOL))} ${theme.fg("accent", owner)} ${theme.fg("muted", question)}`,
        context.lastComponent,
      );
    },
    renderResult(result, { expanded, isPartial, isError }, theme, context) {
      if (isPartial) {
        return reusableText(theme.fg("warning", "routing development question…"), context.lastComponent);
      }
      if (isError) {
        return reusableText(
          theme.fg("error", resultText(result) || "Developer route failed"),
          context.lastComponent,
        );
      }
      const event = result.details as RouteEvent | undefined;
      let text = theme.fg("success", `routed ${routeRenderText(event)}`);
      if (expanded && event) {
        text += `\n${theme.fg("dim", `route · ${event.routeId}`)}`;
        text += `\n${theme.fg("dim", `question · ${event.question}`)}`;
        text += `\n${theme.fg("dim", `reason · ${event.reason}`)}`;
        if (event.knownEvidence.length > 0) {
          for (const evidence of event.knownEvidence) {
            text += `\n${theme.fg("dim", `evidence · ${evidence}`)}`;
          }
        } else {
          text += `\n${theme.fg("dim", "evidence · none recorded before routing")}`;
        }
        text += `\n${theme.fg("dim", `revisits · ${event.targetQuestionId ?? "none"}`)}`;
        text += `\n${theme.fg("dim", `skill · ${event.methodLocation ?? "direct action"}`)}`;
      }
      if (!expanded && event) text += ` · ${keyHint("app.tools.expand", "details")}`;
      return reusableText(text, context.lastComponent);
    },
  });

  const JudgmentParams = Type.Object({
    route_id: Type.String({ minLength: 1, maxLength: 512, description: `Exact route ID returned by ${ROUTE_TOOL}` }),
    status: StringEnum(["resolved", "needs-evidence", "not-applicable", "blocked"] as const),
    result: Type.String({
      minLength: 1,
      maxLength: MAX_RESULT_CHARS,
      description: "The resulting judgment in concrete terms",
    }),
    basis: Type.Array(Type.String({ maxLength: MAX_EVIDENCE_CHARS }), {
      maxItems: 20,
      description: "Evidence supporting the judgment or blocker",
    }),
    open_questions: Type.Optional(
      Type.Array(Type.String({ maxLength: MAX_QUESTION_CHARS }), {
        maxItems: 10,
        description: "New questions that remain unresolved",
      }),
    ),
    artifacts: Type.Optional(
      Type.Array(Type.String({ maxLength: MAX_ARTIFACT_CHARS }), {
        maxItems: 20,
        description: "Relevant paths, commands, tests, or outputs",
      }),
    ),
  });

  pi.registerTool({
    name: JUDGMENT_TOOL,
    label: "Developer Record Judgment",
    description:
      "Close the active Developer route with its result, evidence, newly opened questions, and relevant artifacts. This records a local judgment, not task completion.",
    promptSnippet: "Record evidence and close the active development route",
    promptGuidelines: [
      `Use ${JUDGMENT_TOOL} with the exact active Developer route ID.`,
      `Do not use ${JUDGMENT_TOOL} with resolved, not-applicable, or blocked status without at least one concrete basis.`,
    ],
    parameters: JudgmentParams,
    executionMode: "sequential",
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      if (state.mode === "off") fail("Developer protocol is off.");
      if (!state.activeRoute) fail("There is no active Developer route to close.");
      if (params.route_id !== state.activeRoute.routeId) {
        fail(`Route ID mismatch. Active route is ${state.activeRoute.routeId}.`);
      }

      const basis = params.basis.map((item) => item.trim()).filter(Boolean);
      const result = params.result.trim();
      if (!result) fail("A judgment result must contain non-whitespace text.");
      if (params.status !== "needs-evidence" && basis.length === 0) {
        fail(`${params.status} judgments require at least one concrete basis.`);
      }

      const openedQuestions = (params.open_questions ?? [])
        .map((item) => item.trim())
        .filter(Boolean)
        .map((question, index) => ({
          id: `question:${params.route_id}:open:${index + 1}`,
          question,
          status: "needs-evidence" as const,
          sourceRouteId: params.route_id,
        }));
      const event: JudgmentEvent = {
        protocol: PROTOCOL,
        kind: "judgment",
        routeId: params.route_id,
        question: state.activeRoute.question,
        owner: state.activeRoute.owner,
        status: params.status,
        result,
        basis,
        openedQuestions,
        artifacts: (params.artifacts ?? []).map((item) => item.trim()).filter(Boolean),
      };
      const nextState = applyDeveloperEvent(state, event);
      if (nextState.pendingQuestions.length > MAX_PENDING_QUESTIONS) {
        fail(
          `Developer protocol would retain ${nextState.pendingQuestions.length} pending questions; resolve or consolidate them before opening more.`,
        );
      }

      const next = protocolState(nextState);
      const nextMessage =
        next === "idle"
          ? "Developer protocol is idle. This is routing state only and does not prove task completion."
          : `Developer protocol is ${next}. Address or report the pending question before handoff.`;
      const response = `Recorded ${event.status} judgment for ${event.routeId}: ${event.result}\n${nextMessage}`;
      ensureSafeToolText(response, "Developer judgment result");

      state = nextState;
      syncProtocolTools();
      refreshUI(ctx);
      return textResult(response, event);
    },
    renderCall(args, theme, context) {
      const status = typeof args.status === "string" && args.status.length > 0 ? args.status : "…";
      const result =
        typeof args.result === "string" && args.result.length > 0 ? compactLine(args.result) : "…";
      const statusText =
        status === "resolved"
          ? theme.fg("success", status)
          : status === "needs-evidence"
            ? theme.fg("warning", status)
            : status === "blocked"
              ? theme.fg("error", status)
              : theme.fg("muted", status);
      return reusableText(
        `${theme.fg("toolTitle", theme.bold(JUDGMENT_TOOL))} ${statusText} ${theme.fg("muted", result)}`,
        context.lastComponent,
      );
    },
    renderResult(result, { expanded, isPartial, isError }, theme, context) {
      if (isPartial) {
        return reusableText(theme.fg("warning", "recording development judgment…"), context.lastComponent);
      }
      if (isError) {
        return reusableText(
          theme.fg("error", resultText(result) || "Developer judgment failed"),
          context.lastComponent,
        );
      }
      const event = result.details as JudgmentEvent | undefined;
      const summary = judgmentRenderText(event);
      let text =
        event?.status === "resolved"
          ? theme.fg("success", summary)
          : event?.status === "needs-evidence"
            ? theme.fg("warning", summary)
            : event?.status === "blocked"
              ? theme.fg("error", summary)
              : theme.fg("muted", summary);
      if (expanded && event) {
        text += `\n${theme.fg("dim", `route · ${event.routeId}`)}`;
        text += `\n${theme.fg("dim", `target · ${event.owner}`)}`;
        text += `\n${theme.fg("dim", `question · ${event.question}`)}`;
        text += `\n${theme.fg("dim", `result · ${event.result}`)}`;
        for (const basis of event.basis) text += `\n${theme.fg("dim", `basis · ${basis}`)}`;
        for (const artifact of event.artifacts) text += `\n${theme.fg("dim", `artifact · ${artifact}`)}`;
        for (const question of event.openedQuestions) {
          text += `\n${theme.fg("warning", `opened · ${question.id} · ${question.question}`)}`;
        }
      }
      if (!expanded && event) text += ` · ${keyHint("app.tools.expand", "details")}`;
      return reusableText(text, context.lastComponent);
    },
  });

  const refreshAvailableSkills = (ctx: ExtensionCommandContext) => {
    if (typeof ctx.getSystemPromptOptions !== "function") return;
    availableSkills = availablePackageSkills(
      ctx.getSystemPromptOptions().skills ?? [],
      candidates,
      skillsRoot,
    );
  };

  const statusMessage = () => {
    const active = state.activeRoute
      ? `${state.activeRoute.routeId} · ${state.activeRoute.owner} · ${state.activeRoute.question}`
      : "none";
    const pending =
      state.pendingQuestions.length > 0
        ? state.pendingQuestions
            .map((question) => `${question.id} · ${question.status} · ${question.question}`)
            .join(" | ")
        : "none";
    const last = state.lastJudgment
      ? `${state.lastJudgment.status} · ${state.lastJudgment.result}`
      : "none";
    const basis =
      state.lastJudgment && state.lastJudgment.basis.length > 0
        ? state.lastJudgment.basis.join(" | ")
        : "none";
    const artifacts =
      state.lastJudgment && state.lastJudgment.artifacts.length > 0
        ? state.lastJudgment.artifacts.join(" | ")
        : "none";
    return (
      `${summarizeState(state)}` +
      `\nactive: ${active}` +
      `\nlast: ${last}` +
      `\nbasis: ${basis}` +
      `\nartifacts: ${artifacts}` +
      `\nactive tools: ${pi.getActiveTools().join(", ")}` +
      `\navailable skills: ${[...availableSkills.keys()].join(", ") || "none"}` +
      `\npending: ${pending}` +
      "\nprotocol state is not a product-completion claim"
    );
  };

  pi.registerCommand("develop", {
    description: "Control or inspect Developer: /develop on | strict | status | questions | off",
    getArgumentCompletions(prefix) {
      const normalized = prefix.trim();
      const matches = DEVELOPER_COMMAND_ACTIONS.filter((action) => action.startsWith(normalized));
      return matches.length > 0
        ? matches.map((action) => ({ value: action, label: action }))
        : null;
    },
    handler: async (args, ctx) => {
      let action = args.trim();
      if (!action && ctx.mode === "tui") {
        refreshAvailableSkills(ctx);
        action = (await showDeveloperActionSelector(ctx, state)) ?? "";
        if (!action) return;
      }
      if (!action) action = "status";
      if (action === "on" || action === "strict" || action === "off") {
        if (
          action === "off" &&
          ctx.mode === "tui" &&
          (state.activeRoute || state.pendingQuestions.length > 0)
        ) {
          const work = [
            ...(state.activeRoute ? ["the active route"] : []),
            ...(state.pendingQuestions.length > 0
              ? [`${state.pendingQuestions.length} open question(s)`]
              : []),
          ].join(" and ");
          const confirmed = await ctx.ui.confirm(
            "Turn off Developer?",
            `This clears ${work} from the current protocol state. Existing session history remains.`,
          );
          if (!confirmed) return;
        }
        setMode(action, ctx);
        ctx.ui.notify(`Developer mode: ${action}`, "info");
        return;
      }
      if (action === "questions") {
        if (state.pendingQuestions.length === 0) {
          ctx.ui.notify("Developer has no open questions on the current branch.", "info");
          return;
        }
        if (ctx.mode === "tui") {
          const questionId = await showPendingQuestionSelector(ctx, state.pendingQuestions);
          if (!questionId) return;
          const question = state.pendingQuestions.find((item) => item.id === questionId);
          if (!question) return;
          prepareQuestionPrompt(ctx, question);
          ctx.ui.notify("Open question loaded into the editor for review.", "info");
          return;
        }
        ctx.ui.notify(
          state.pendingQuestions
            .map((question) => `${question.id} · ${question.status} · ${question.question}`)
            .join("\n"),
          "info",
        );
        return;
      }
      if (action === "status") {
        refreshAvailableSkills(ctx);
        if (ctx.mode === "tui") {
          await showDeveloperStatus(ctx, {
            state,
            activeTools: pi.getActiveTools(),
            availableSkills: [...availableSkills.keys()],
          });
        } else {
          ctx.ui.notify(statusMessage(), "info");
        }
        return;
      }
      ctx.ui.notify("Usage: /develop on | strict | status | questions | off", "warning");
    },
  });

  const entryRendererAPI = pi as ExtensionAPI & {
    registerEntryRenderer?: ExtensionAPI["registerEntryRenderer"];
  };
  entryRendererAPI.registerEntryRenderer?.(MODE_ENTRY, (entry, _options, theme) => {
    const event = normalizeDeveloperEvent(entry.data);
    if (!event || event.kind !== "mode") return undefined;
    return new Text(
      `${theme.fg("toolTitle", theme.bold("Developer mode"))} ${theme.fg("accent", event.mode)}`,
      0,
      0,
    );
  });

  pi.on("before_agent_start", (event) => {
    availableSkills = availablePackageSkills(event.systemPromptOptions.skills ?? [], candidates, skillsRoot);
    if (state.mode === "off") return;
    return { systemPrompt: event.systemPrompt + protocolPrompt(state, [...availableSkills.keys()]) };
  });

  pi.on("tool_call", (event) => {
    if (state.mode !== "strict") return;
    const mutationBuiltins = builtinMutationToolNames(pi.getAllTools());
    if (!mutationBuiltins.has(event.toolName)) return;
    if (state.activeRoute?.owner === "direct") return;
    return {
      block: true,
      reason: `Developer strict mode requires an active ${ROUTE_TOOL} targeting direct action (owner=direct) before Pi built-in edit, write, or bash.`,
    };
  });

  pi.on("session_start", (_event, ctx) => {
    reconstruct(ctx);
    const startupMode = pi.getFlag("develop-mode");
    if ((startupMode === "on" || startupMode === "strict") && state.mode !== startupMode) {
      setMode(startupMode, ctx);
    }
  });
  pi.on("session_tree", (_event, ctx) => reconstruct(ctx));
  pi.on("agent_settled", (_event, ctx) => refreshUI(ctx));
  pi.on("session_shutdown", (_event, ctx) => {
    ctx.ui.setStatus("developer", undefined);
    ctx.ui.setWidget("developer", undefined);
  });
}
