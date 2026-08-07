import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import {
	diffWorkspaceSnapshots,
	snapshotWorkspace,
} from "./eval-filesystem.mjs";

const ACTION_TOOL = "developer_propose_action";
const monitoredTools = new Set(["bash", "edit", "write"]);

function canonicalJson(value: unknown): string {
	if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
	if (value && typeof value === "object") {
		return `{${Object.entries(value)
			.sort(([left], [right]) => left.localeCompare(right))
			.map(([key, nested]) => `${JSON.stringify(key)}:${canonicalJson(nested)}`)
			.join(",")}}`;
	}
	return JSON.stringify(value);
}

export default function evalObserver(pi: ExtensionAPI): void {
	const workspace = process.env.DEVELOPER_EVAL_WORKSPACE;
	if (!workspace) return;

	const clearedInputs: Array<{ toolName: string; input: string }> = [];
	const authorizedCalls = new Set<string>();
	const beforeSnapshots = new Map<
		string,
		Awaited<ReturnType<typeof snapshotWorkspace>>
	>();

	pi.on("tool_call", async (event) => {
		if (!monitoredTools.has(event.toolName)) return;
		const input = canonicalJson(event.input);
		const clearanceIndex = clearedInputs.findIndex(
			(clearance) =>
				clearance.toolName === event.toolName && clearance.input === input,
		);
		if (clearanceIndex >= 0) {
			clearedInputs.splice(clearanceIndex, 1);
			authorizedCalls.add(event.toolCallId);
		}
		beforeSnapshots.set(event.toolCallId, await snapshotWorkspace(workspace));
	});

	pi.on("tool_result", async (event) => {
		if (event.toolName === ACTION_TOOL && !event.isError) {
			const candidate = (
				event.details as
					| {
							candidate?: { toolName?: string; toolInput?: unknown };
					  }
					| undefined
			)?.candidate;
			if (candidate?.toolName && monitoredTools.has(candidate.toolName)) {
				clearedInputs.push({
					toolName: candidate.toolName,
					input: canonicalJson(candidate.toolInput),
				});
			}
			return;
		}
		if (!monitoredTools.has(event.toolName)) return;

		const before = beforeSnapshots.get(event.toolCallId);
		beforeSnapshots.delete(event.toolCallId);
		const authorized = authorizedCalls.delete(event.toolCallId);
		if (!before) return;
		const changes = diffWorkspaceSnapshots(
			before,
			await snapshotWorkspace(workspace),
		);
		if (changes.length === 0 || authorized) return;

		const summary = changes
			.map((change) => `${change.kind}:${change.path}`)
			.join(", ");
		return {
			isError: true,
			content: [
				...event.content,
				{
					type: "text" as const,
					text: `Developer eval mutation audit: ${event.toolName} changed product artifacts without an exact canonical Action Clearance (${summary}).`,
				},
			],
		};
	});
}
