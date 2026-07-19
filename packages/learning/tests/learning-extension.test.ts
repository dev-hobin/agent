import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  DEFAULT_MAX_BYTES,
  DEFAULT_MAX_LINES,
  initTheme,
} from "@earendil-works/pi-coding-agent";

import learning, { boundToolText } from "../extensions/learning.ts";

initTheme(undefined, false);

function registerLearningTool() {
  let tool: any;
  learning({
    registerTool(definition: unknown) {
      tool = definition;
    },
    registerCommand() {},
  } as never);
  assert.equal(tool?.name, "validate_learning_artifact");
  return tool;
}

const theme = {
  bold: (text: string) => text,
  fg: (color: string, text: string) => `<${color}>${text}</${color}>`,
};

function renderedText(component: { render(width: number): string[] }): string {
  return component.render(500).join("\n");
}

test("registered Pi tool reads and validates an artifact relative to ctx.cwd", async () => {
  const root = await mkdtemp(join(tmpdir(), "learning-tool-"));
  const concepts = join(root, "concepts");
  await mkdir(concepts);
  await writeFile(
    join(concepts, "boundary.md"),
    `---
"@context": context.jsonld
id: concept/boundary
type:
  - Concept
  - Atomic
prefLabel: Boundary
inScheme: concept-scheme/learning
status: active
sourceIndependent: true
source: books/example.md
---
`,
  );

  const tool = registerLearningTool();
  const result = await tool.execute(
    "call-1",
    { path: "@concepts/boundary.md" },
    new AbortController().signal,
    () => {},
    { cwd: root },
  );

  assert.equal("isError" in result, false);
  assert.equal(result.details.valid, true);
  assert.equal(result.details.outputTruncated, false);
  assert.match(result.content[0].text, /structure is valid/);
});

test("registered Pi tool throws when an artifact cannot be read", async () => {
  const root = await mkdtemp(join(tmpdir(), "learning-tool-missing-"));
  const tool = registerLearningTool();
  await assert.rejects(
    tool.execute(
      "call-2",
      { path: "concepts/missing.md" },
      new AbortController().signal,
      () => {},
      { cwd: root },
    ),
    /Could not read learning artifact/,
  );
});

test("registered Pi tool returns structural invalidity as a successful validation result", async () => {
  const root = await mkdtemp(join(tmpdir(), "learning-tool-invalid-"));
  const path = join(root, "broken.md");
  await writeFile(path, "# Missing frontmatter\n");
  const tool = registerLearningTool();
  const result = await tool.execute(
    "call-3",
    { path },
    new AbortController().signal,
    () => {},
    { cwd: root },
  );

  assert.equal("isError" in result, false);
  assert.equal(result.details.valid, false);
  assert.match(result.content[0].text, /structure is invalid/);
});

test("registered Pi tool rejects non-Markdown paths", async () => {
  const root = await mkdtemp(join(tmpdir(), "learning-tool-extension-"));
  const tool = registerLearningTool();

  await assert.rejects(
    tool.execute(
      "call-4",
      { path: "concepts/artifact.yaml" },
      new AbortController().signal,
      () => {},
      { cwd: root },
    ),
    /Markdown \(\.md\) file/,
  );
});

test("registered Pi tool text stays inside Pi's output limits", () => {
  const result = boundToolText(`${"line\n".repeat(DEFAULT_MAX_LINES + 100)}${"x".repeat(DEFAULT_MAX_BYTES)}`);

  assert.equal(result.truncated, true);
  assert.ok(Buffer.byteLength(result.text, "utf8") <= DEFAULT_MAX_BYTES);
  assert.ok(result.text.split("\n").length <= DEFAULT_MAX_LINES);
  assert.match(result.text, /Output truncated/);
});

test("custom TUI rendering summarizes valid, warning, and invalid results", () => {
  const tool = registerLearningTool();
  const call = renderedText(tool.renderCall({ path: "concepts/boundary.md" }, theme, {}));
  assert.match(call, /validate_learning_artifact/);
  assert.match(call, /concepts\/boundary\.md/);

  const valid = renderedText(
    tool.renderResult(
      { content: [], details: { valid: true, errors: [], warnings: [] } },
      { expanded: false, isPartial: false, isError: false },
      theme,
      {},
    ),
  );
  assert.match(valid, /✓ valid · 0 errors · 0 warnings/);
  assert.match(valid, /details/);

  const warning = renderedText(
    tool.renderResult(
      {
        content: [],
        details: {
          valid: true,
          errors: [],
          warnings: [{ code: "context.shared", field: "@context", message: "Use the shared context." }],
          path: "/archive/concepts/boundary.md",
        },
      },
      { expanded: true, isPartial: false, isError: false },
      theme,
      {},
    ),
  );
  assert.match(warning, /⚠ valid · 0 errors · 1 warnings/);
  assert.match(warning, /Warnings[\s\S]*context\.shared · @context · Use the shared context/);
  assert.match(warning, /path · \/archive\/concepts\/boundary\.md/);

  const invalid = renderedText(
    tool.renderResult(
      {
        content: [],
        details: {
          valid: false,
          errors: [{ code: "frontmatter.missing", message: "Frontmatter is required." }],
          warnings: [],
        },
      },
      { expanded: true, isPartial: false, isError: false },
      theme,
      {},
    ),
  );
  assert.match(invalid, /✗ invalid · 1 errors · 0 warnings/);
  assert.match(invalid, /Errors[\s\S]*frontmatter\.missing · Frontmatter is required/);
});

test("custom TUI rendering reuses Pi's row-local Text component", () => {
  const tool = registerLearningTool();
  const firstContext: Record<string, unknown> = {};
  const first = tool.renderCall({ path: "concepts/first.md" }, theme, firstContext);
  const second = tool.renderCall(
    { path: "concepts/second.md" },
    theme,
    { lastComponent: first },
  );
  assert.equal(second, first);
  assert.match(renderedText(second), /concepts\/second\.md/);
});

test("custom TUI rendering distinguishes partial and actual tool failures", () => {
  const tool = registerLearningTool();
  const partial = renderedText(
    tool.renderResult(
      { content: [], details: undefined },
      { expanded: false, isPartial: true, isError: false },
      theme,
      {},
    ),
  );
  assert.match(partial, /validating learning artifact/);

  const failed = renderedText(
    tool.renderResult(
      { content: [{ type: "text", text: "Could not read artifact" }], details: undefined },
      { expanded: false, isPartial: false, isError: true },
      theme,
      {},
    ),
  );
  assert.match(failed, /Could not read artifact/);
});
