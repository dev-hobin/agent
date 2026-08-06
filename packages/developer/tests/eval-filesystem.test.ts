import assertModule from "node:assert";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import evalObserver from "../scripts/eval-observer.ts";
import { diffWorkspaceSnapshots, snapshotWorkspace } from "../scripts/eval-filesystem.mjs";

const assert: typeof assertModule.strict = assertModule.strict;

test("workspace snapshots report product changes and ignore declared ephemeral output", async () => {
  const root = await mkdtemp(join(tmpdir(), "developer-eval-fs-"));
  try {
    await writeFile(join(root, "source.ts"), "before");
    await mkdir(join(root, "coverage"));
    const before = await snapshotWorkspace(root);
    await writeFile(join(root, "source.ts"), "after");
    await writeFile(join(root, "created.ts"), "created");
    await writeFile(join(root, "coverage", "report.json"), "ephemeral");
    const changes = diffWorkspaceSnapshots(before, await snapshotWorkspace(root));
    assert.deepEqual(changes, [
      { path: "created.ts", kind: "created" },
      { path: "source.ts", kind: "modified" },
    ]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("the eval observer rejects artifact changes outside implementation and permits implementation mutation", async () => {
  const root = await mkdtemp(join(tmpdir(), "developer-eval-observer-"));
  const previousWorkspace = process.env.DEVELOPER_EVAL_WORKSPACE;
  process.env.DEVELOPER_EVAL_WORKSPACE = root;
  try {
    const handlers = new Map<string, (event: any) => Promise<any> | any>();
    evalObserver({ on: (name: string, handler: (event: any) => any) => handlers.set(name, handler) } as never);
    const toolCall = handlers.get("tool_call");
    const toolResult = handlers.get("tool_result");
    assert.ok(toolCall);
    assert.ok(toolResult);

    await writeFile(join(root, "source.ts"), "initial");
    await toolResult({
      toolName: "developer_route_question",
      toolCallId: "route:signal",
      isError: false,
      details: { target: "signal",  },
      content: [],
    });
    await toolCall({ toolName: "bash", toolCallId: "bash:signal" });
    await writeFile(join(root, "source.ts"), "changed outside implementation");
    const violation = await toolResult({
      toolName: "bash",
      toolCallId: "bash:signal",
      isError: false,
      details: {},
      content: [],
    });
    assert.equal(violation?.isError, true);
    assert.match(violation?.content.at(-1)?.text ?? "", /outside an implementation route/);

    await toolResult({
      toolName: "developer_route_question",
      toolCallId: "route:implementation",
      isError: false,
      details: { target: "implementation",  },
      content: [],
    });
    await toolCall({ toolName: "edit", toolCallId: "edit:implementation" });
    await writeFile(join(root, "source.ts"), "changed inside implementation");
    const allowed = await toolResult({
      toolName: "edit",
      toolCallId: "edit:implementation",
      isError: false,
      details: {},
      content: [],
    });
    assert.equal(allowed, undefined);
  } finally {
    if (previousWorkspace === undefined) delete process.env.DEVELOPER_EVAL_WORKSPACE;
    else process.env.DEVELOPER_EVAL_WORKSPACE = previousWorkspace;
    await rm(root, { recursive: true, force: true });
  }
});
