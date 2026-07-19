import { readFile } from "node:fs/promises";
import { extname, isAbsolute, resolve } from "node:path";

import {
  DEFAULT_MAX_BYTES,
  DEFAULT_MAX_LINES,
  keyHint,
  truncateHead,
  type ExtensionAPI,
} from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";

import {
  validateLearningArtifact,
  type ArtifactValidation,
  type ValidationIssue,
} from "./artifact-validator.ts";
import {
  LEARNING_ROUTES,
  isLearningAction,
  prepareLearningAction,
  showLearningActionSelector,
} from "./tui.ts";

const TRUNCATION_NOTICE_BYTES = 160;
const TRUNCATION_NOTICE_LINES = 2;

export function boundToolText(text: string) {
  const truncation = truncateHead(text, {
    maxBytes: DEFAULT_MAX_BYTES - TRUNCATION_NOTICE_BYTES,
    maxLines: DEFAULT_MAX_LINES - TRUNCATION_NOTICE_LINES,
  });
  return {
    text: truncation.truncated
      ? `${truncation.content}\n\n[Output truncated to Pi's ${DEFAULT_MAX_BYTES}-byte/${DEFAULT_MAX_LINES}-line limit.]`
      : truncation.content,
    truncated: truncation.truncated,
  };
}

function textResult(text: string, details: Record<string, unknown> = {}) {
  const bounded = boundToolText(text);
  return {
    content: [{ type: "text" as const, text: bounded.text }],
    details: { ...details, outputTruncated: bounded.truncated },
  };
}

function normalizePath(path: string): string {
  const trimmed = path.trim();
  return trimmed.startsWith("@") ? trimmed.slice(1) : trimmed;
}

function compactLine(value: string, maxChars = 180): string {
  const line = value.replace(/\s+/g, " ").trim();
  return line.length <= maxChars ? line : `${line.slice(0, maxChars - 1)}…`;
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

function validationDetails(result: { details?: unknown }) {
  const details = result.details as
    | (ArtifactValidation & { path?: string; outputTruncated?: boolean })
    | undefined;
  return {
    valid: details?.valid === true,
    errors: Array.isArray(details?.errors) ? details.errors : [],
    warnings: Array.isArray(details?.warnings) ? details.warnings : [],
    path: typeof details?.path === "string" ? details.path : undefined,
    artifact: details?.artifact,
    outputTruncated: details?.outputTruncated === true,
  };
}

function renderIssue(issue: ValidationIssue): string {
  const field = issue.field ? ` · ${issue.field}` : "";
  return `${issue.code}${field} · ${issue.message}`;
}

export default function learning(pi: ExtensionAPI) {
  pi.registerCommand("learning", {
    description: "Choose a Learning approach or prepare artifact validation",
    getArgumentCompletions(prefix) {
      const actions = [...LEARNING_ROUTES, "validate"];
      const matches = actions.filter((action) => action.startsWith(prefix.trim()));
      return matches.length > 0
        ? matches.map((action) => ({ value: action, label: action }))
        : null;
    },
    handler: async (args, ctx) => {
      let action = args.trim();
      if (!action && ctx.mode === "tui") {
        action = (await showLearningActionSelector(ctx)) ?? "";
        if (!action) return;
      }
      if (!isLearningAction(action)) {
        ctx.ui.notify(
          `Usage: /learning ${[...LEARNING_ROUTES, "validate"].join(" | ")}`,
          action ? "warning" : "info",
        );
        return;
      }

      prepareLearningAction(ctx, action);
      ctx.ui.notify(
        action === "validate"
          ? "Artifact validation prompt prepared in the editor."
          : `${action} prepared in the editor.`,
        "info",
      );
    },
  });

  pi.registerTool({
    name: "validate_learning_artifact",
    label: "Validate Learning Artifact",
    description:
      "Validate one Markdown concept, concept update, concept scheme, or pattern against @hobin/learning graph frontmatter and relation conventions. This is read-only, checks structure rather than semantic truth, and truncates output to Pi's 50KB/2000-line limit.",
    promptSnippet: "Validate a saved graph-shaped learning artifact",
    promptGuidelines: [
      "Use validate_learning_artifact after writing or revising a graph-shaped concept, concept update, concept scheme, or pattern artifact.",
      "Repair structural errors before claiming the artifact is captured; present warnings as judgment items rather than automatic failures.",
      "Treat a valid result as structural evidence only. Source quality, conceptual atomicity, transfer evidence, and status still require human or model judgment.",
    ],
    parameters: Type.Object({
      path: Type.String({
        minLength: 1,
        maxLength: 4096,
        description: "Markdown artifact path, absolute or relative to Pi's current working directory",
      }),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      signal.throwIfAborted();
      const input = normalizePath(params.path);
      if (!input) throw new Error("Artifact path must contain non-whitespace text.");

      const path = isAbsolute(input) ? input : resolve(ctx.cwd, input);
      if (extname(path).toLowerCase() !== ".md") {
        throw new Error("Learning artifact path must identify a Markdown (.md) file.");
      }
      let source: string;
      try {
        source = await readFile(path, "utf8");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Could not read learning artifact at ${path}: ${message}`);
      }

      const result = validateLearningArtifact(source, path);
      const lines = [
        result.valid ? "Learning artifact structure is valid." : "Learning artifact structure is invalid.",
        `Path: ${path}`,
        `Errors: ${result.errors.length}`,
        `Warnings: ${result.warnings.length}`,
      ];
      for (const error of result.errors) lines.push(`ERROR ${error.code}: ${error.message}`);
      for (const warning of result.warnings) lines.push(`WARNING ${warning.code}: ${warning.message}`);

      return textResult(lines.join("\n"), { path, ...result });
    },
    renderCall(args, theme, context) {
      const path = typeof args.path === "string" && args.path.length > 0 ? compactLine(args.path) : "…";
      return reusableText(
        `${theme.fg("toolTitle", theme.bold("validate_learning_artifact"))} ${theme.fg("muted", path)}`,
        context.lastComponent,
      );
    },
    renderResult(result, { expanded, isPartial, isError }, theme, context) {
      if (isPartial) {
        return reusableText(theme.fg("warning", "validating learning artifact…"), context.lastComponent);
      }
      if (isError) {
        return reusableText(
          theme.fg("error", resultText(result) || "Learning artifact validation failed"),
          context.lastComponent,
        );
      }

      const details = validationDetails(result);
      const errorCount = details.errors.length;
      const warningCount = details.warnings.length;
      const summary = details.valid
        ? warningCount > 0
          ? `⚠ valid · ${errorCount} errors · ${warningCount} warnings`
          : `✓ valid · ${errorCount} errors · ${warningCount} warnings`
        : `✗ invalid · ${errorCount} errors · ${warningCount} warnings`;
      const color = details.valid ? (warningCount > 0 ? "warning" : "success") : "error";
      let text = theme.fg(color, summary);

      if (expanded) {
        if (details.path) text += `\n${theme.fg("dim", `path · ${details.path}`)}`;
        if (details.artifact) {
          const identity = [details.artifact.family, details.artifact.id, details.artifact.status]
            .filter(Boolean)
            .join(" · ");
          if (identity) text += `\n${theme.fg("dim", `artifact · ${identity}`)}`;
        }
        if (details.errors.length > 0) text += `\n${theme.fg("error", theme.bold("Errors"))}`;
        for (const issue of details.errors) {
          text += `\n  ${theme.fg("error", "✗")} ${theme.fg("muted", renderIssue(issue))}`;
        }
        if (details.warnings.length > 0) text += `\n${theme.fg("warning", theme.bold("Warnings"))}`;
        for (const issue of details.warnings) {
          text += `\n  ${theme.fg("warning", "!")} ${theme.fg("muted", renderIssue(issue))}`;
        }
        if (details.outputTruncated) {
          text += `\n${theme.fg("warning", "text output was truncated to Pi's tool-output limit")}`;
        }
      } else {
        text += ` · ${keyHint("app.tools.expand", "details")}`;
      }
      return reusableText(text, context.lastComponent);
    },
  });
}
