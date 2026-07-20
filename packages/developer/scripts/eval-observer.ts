import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import { diffWorkspaceSnapshots, snapshotWorkspace } from "./eval-filesystem.mjs";

const ROUTE_TOOL = "developer_route_question";
const JUDGMENT_TOOL = "developer_record_judgment";
const monitoredTools = new Set(["bash", "edit", "write"]);

export default function evalObserver(pi: ExtensionAPI): void {
  const workspace = process.env.DEVELOPER_EVAL_WORKSPACE;
  if (!workspace) return;

  let activeOwner: string | undefined;
  const beforeSnapshots = new Map<string, Awaited<ReturnType<typeof snapshotWorkspace>>>();

  pi.on("tool_call", async (event) => {
    if (!monitoredTools.has(event.toolName)) return;
    beforeSnapshots.set(event.toolCallId, await snapshotWorkspace(workspace));
  });

  pi.on("tool_result", async (event) => {
    if (event.toolName === ROUTE_TOOL && !event.isError) {
      activeOwner = (event.details as { owner?: string } | undefined)?.owner;
      return;
    }
    if (event.toolName === JUDGMENT_TOOL && !event.isError) {
      activeOwner = undefined;
      return;
    }
    if (!monitoredTools.has(event.toolName)) return;

    const before = beforeSnapshots.get(event.toolCallId);
    beforeSnapshots.delete(event.toolCallId);
    if (!before) return;
    const changes = diffWorkspaceSnapshots(before, await snapshotWorkspace(workspace));
    if (changes.length === 0 || activeOwner === "direct") return;

    const summary = changes.map((change) => `${change.kind}:${change.path}`).join(", ");
    return {
      isError: true,
      content: [
        ...event.content,
        {
          type: "text" as const,
          text: `Developer eval mutation audit: ${event.toolName} changed product artifacts outside a direct route (${summary}).`,
        },
      ],
    };
  });
}
