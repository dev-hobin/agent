import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
	initTheme,
	loadSkillsFromDir,
	type ExtensionAPI,
	type Skill,
} from "@earendil-works/pi-coding-agent";

import { openLiveJudgment } from "../extensions/action-loop-judgment.ts";
import {
	MODEL_FACING_ACTION_LOOP_TOOLS,
	actionLoopModelProtocolPrompt,
} from "../extensions/action-loop-model-tools.ts";
import { ACTION_LOOP_SESSION_ENTRY } from "../extensions/action-loop-session.ts";
import {
	actionLoopJudgmentOpenedEvent,
	actionLoopWorkCaseOpenedEvent,
} from "../extensions/action-loop-session-event.ts";
import { openLiveWorkCase } from "../extensions/action-loop-work-case.ts";
import developer from "../extensions/developer.ts";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const loadedLeaves = loadSkillsFromDir({
	dir: join(packageRoot, "skills"),
	source: "@hobin/developer",
}).skills;

initTheme(undefined, false);

const FULL_SCREEN_SURFACE_OPTIONS = {
	overlay: true,
	overlayOptions: {
		anchor: "top-center",
		width: "100%",
		maxHeight: "100%",
	},
} as const;

const MODEL_FACING_TOOL_NAMES = [...MODEL_FACING_ACTION_LOOP_TOOLS].sort();

interface HarnessBranchEntry {
	type?: string;
	customType?: string;
	data?: unknown;
	message?: {
		role?: string;
		toolName?: string;
		details?: unknown;
	};
}

function createHarness(commandSkills: Skill[] = loadedLeaves) {
	const handlers = new Map<string, Array<(event: any, ctx: any) => any>>();
	const tools = new Map<string, any>();
	const commands = new Map<string, any>();
	const flags = new Map<string, any>();
	const flagValues = new Map<string, unknown>();
	const entries: Array<{ customType: string; data: unknown }> = [];
	const statuses: Array<{ key: string; value: unknown }> = [];
	const widgets: Array<{ key: string; value: unknown; options?: unknown }> = [];
	const notifications: Array<{ message: string; level: string }> = [];
	const confirmations: Array<{ title: string; message: string }> = [];
	const sentUserMessages: Array<{ content: string; options?: unknown }> = [];
	let customResult: unknown;
	let customResults: unknown[] = [];
	let editorResult: string | undefined;
	let editorResults: Array<string | undefined> = [];
	let inputResult: string | undefined;
	let inputResults: Array<string | undefined> = [];
	let sessionFile: string | undefined = "/tmp/developer-test-session.jsonl";
	let confirmResult = true;
	let customCalls = 0;
	const customOptions: unknown[] = [];
	let editorText = "";
	let activeTools = ["read", "edit", "write", "bash"];
	let branchEntries: HarnessBranchEntry[] = [];
	const api = {
		on(name: string, handler: (event: any, ctx: any) => any) {
			handlers.set(name, [...(handlers.get(name) ?? []), handler]);
		},
		registerTool(tool: any) {
			tools.set(tool.name, tool);
			activeTools.push(tool.name);
		},
		registerCommand(name: string, command: any) {
			commands.set(name, command);
		},
		registerFlag(name: string, flag: any) {
			flags.set(name, flag);
		},
		getFlag(name: string) {
			return flagValues.get(name);
		},
		getThinkingLevel() {
			return "medium";
		},
		appendEntry(customType: string, data: unknown) {
			entries.push({ customType, data });
		},
		sendUserMessage(content: string, options?: unknown) {
			sentUserMessages.push({ content, options });
		},
		getActiveTools() {
			return [...activeTools];
		},
		getAllTools() {
			const builtins = ["read", "edit", "write", "bash"].map((name) => ({
				name,
				description: name,
				parameters: {},
				sourceInfo: {
					path: `<builtin:${name}>`,
					source: "builtin",
					scope: "temporary",
					origin: "top-level",
				},
			}));
			const extensionTools = [...tools.values()].map((tool) => ({
				name: tool.name,
				description: tool.description,
				parameters: tool.parameters,
				sourceInfo: {
					path: "/developer.ts",
					source: "/developer.ts",
					scope: "temporary",
					origin: "top-level",
				},
			}));
			return [...builtins, ...extensionTools];
		},
		setActiveTools(names: string[]) {
			activeTools = [...names];
		},
	} as unknown as ExtensionAPI;

	const ui = {
		theme,
		setStatus(key: string, value: unknown) {
			statuses.push({ key, value });
		},
		setWidget(key: string, value: unknown, options?: unknown) {
			widgets.push({ key, value, options });
		},
		notify(message: string, level: string) {
			notifications.push({ message, level });
		},
		async confirm(title: string, message: string) {
			confirmations.push({ title, message });
			return confirmResult;
		},
		async custom(_factory: unknown, options: unknown) {
			customCalls += 1;
			customOptions.push(options);
			return customResults.length > 0 ? customResults.shift() : customResult;
		},
		async editor() {
			return editorResults.length > 0 ? editorResults.shift() : editorResult;
		},
		async input() {
			return inputResults.length > 0 ? inputResults.shift() : inputResult;
		},
		async select(_title: string, options: string[]) {
			return options[0];
		},
		getEditorText() {
			return editorText;
		},
		setEditorText(value: string) {
			editorText = value;
		},
	};
	const ctx = {
		mode: "print",
		hasUI: true,
		ui,
		isIdle: () => true,
		getSystemPromptOptions: () => ({
			cwd: packageRoot,
			skills: commandSkills,
		}),
		sessionManager: {
			getBranch: () => [...branchEntries],
			getSessionFile: () => sessionFile,
		},
	};

	return {
		api,
		tools,
		commands,
		flags,
		entries,
		ctx,
		statuses,
		widgets,
		notifications,
		confirmations,
		sentUserMessages,
		setConfirmResult(value: boolean) {
			confirmResult = value;
		},
		setCustomResult(value: unknown) {
			customResult = value;
			customResults = [];
		},
		setCustomResults(values: unknown[]) {
			customResults = [...values];
		},
		setEditorResult(value: string | undefined) {
			editorResult = value;
			editorResults = [];
		},
		setEditorResults(values: Array<string | undefined>) {
			editorResults = [...values];
		},
		setInputResult(value: string | undefined) {
			inputResult = value;
			inputResults = [];
		},
		setInputResults(values: Array<string | undefined>) {
			inputResults = [...values];
		},
		setSessionFile(value: string | undefined) {
			sessionFile = value;
		},
		customCalls: () => customCalls,
		customOptions,
		editorText: () => editorText,
		activeTools: () => [...activeTools],
		setActiveTools(names: string[]) {
			activeTools = [...names];
		},
		setFlag(name: string, value: unknown) {
			flagValues.set(name, value);
		},
		setBranch(entries: HarnessBranchEntry[]) {
			branchEntries = [...entries];
		},
		async emit(name: string, event: any) {
			let result: any;
			for (const handler of handlers.get(name) ?? [])
				result = await handler(event, ctx);
			return result;
		},
	};
}

const theme = {
	bold: (text: string) => text,
	fg: (color: string, text: string) => `<${color}>${text}</${color}>`,
};

function resultText(result: {
	content: Array<{ type: string; text?: string }>;
}): string {
	return result.content
		.filter((item) => item.type === "text")
		.map((item) => item.text ?? "")
		.join("\n");
}

function renderedText(component: { render(width: number): string[] }): string {
	return component.render(10_000).join("\n");
}

function entryKind(entry: { data: unknown }): string | undefined {
	if (
		typeof entry.data !== "object" ||
		entry.data === null ||
		!("kind" in entry.data)
	)
		return undefined;
	return typeof entry.data.kind === "string" ? entry.data.kind : undefined;
}

function entryEnabled(entry: { data: unknown }): boolean | undefined {
	if (
		typeof entry.data !== "object" ||
		entry.data === null ||
		!("enabled" in entry.data)
	)
		return undefined;
	return typeof entry.data.enabled === "boolean"
		? entry.data.enabled
		: undefined;
}

async function openTestWorkCase(
	harness: ReturnType<typeof createHarness>,
	label = "default",
	withJudgment = true,
): Promise<void> {
	const openingProposal = {
		outcome: {
			statement: `The ${label} test Work Case reaches its bounded Outcome.`,
			acceptanceConditions: [
				`The ${label} test observes the accepted protocol behavior.`,
			],
			constraints: ["No unrelated test behavior changes."],
		},
		basis: ["The current test delegates this bounded Outcome."],
		provenance: { kind: "model" as const, source: "pi:tool-call" },
	};
	const opened = openLiveWorkCase(undefined, openingProposal);
	if ("message" in opened) throw new Error(opened.message);
	const branch: HarnessBranchEntry[] = [
		...harness.entries.map((entry) => ({
			customType: entry.customType,
			data: entry.data,
		})),
		{
			customType: ACTION_LOOP_SESSION_ENTRY,
			data: actionLoopWorkCaseOpenedEvent(openingProposal, opened.value),
		},
	];
	if (withJudgment) {
		const judgmentProposal = {
			category: "Contextual Adequacy" as const,
			subject: `The ${label} test route.`,
			question: `Which Contribution serves the ${label} test route?`,
			requirements: [
				{
					statement: `The ${label} route is supported by a relevant Contribution.`,
					contributionNeeds: ["test-selected routing contribution"],
				},
			],
			basis: ["The route requires one explicit functional Need."],
			provenance: { kind: "model" as const, source: "pi:tool-call" },
		};
		const judgment = openLiveJudgment(opened.value, judgmentProposal);
		if (judgment.status === "invalid") throw new Error(judgment.message);
		branch.push({
			customType: ACTION_LOOP_SESSION_ENTRY,
			data: actionLoopJudgmentOpenedEvent(
				judgmentProposal,
				judgment.judgment.judgmentId,
				judgment.state.workCase.revisionId,
			),
		});
	}
	harness.setBranch(branch);
	await harness.emit("session_tree", { type: "session_tree" });
}

async function startHarness(loadedSkills: Skill[] = loadedLeaves) {
	const harness = createHarness();
	await developer(harness.api);
	await harness.emit("session_start", {
		type: "session_start",
		reason: "startup",
	});
	await harness.commands.get("developer").handler("on", harness.ctx);
	await openTestWorkCase(harness);
	await harness.emit("before_agent_start", {
		type: "before_agent_start",
		prompt: "test",
		systemPrompt: "base",
		systemPromptOptions: { cwd: packageRoot, skills: loadedSkills },
	});
	return harness;
}
test("the canonical prompt uses only Pi-admitted Skills and Action Loop tools", async () => {
	const specify = loadedLeaves.find((skill) => skill.name === "specify")!;
	const harness = createHarness();
	await developer(harness.api);
	await harness.emit("session_start", {
		type: "session_start",
		reason: "startup",
	});
	await harness.commands.get("developer").handler("on", harness.ctx);
	const result = await harness.emit("before_agent_start", {
		type: "before_agent_start",
		prompt: "test",
		systemPrompt: "base",
		systemPromptOptions: { cwd: packageRoot, skills: [specify] },
	});

	assert.match(result.systemPrompt, /admitted_skills: specify;/);
	assert.match(
		result.systemPrompt,
		/Developer Capability inventory: 1 admitted by Pi\./,
	);
	assert.match(result.systemPrompt, /developer_progress_action_loop/);
	assert.match(
		result.systemPrompt,
		/developer_accept_observation_contribution/,
	);
	assert.match(
		result.systemPrompt,
		/model_authority: proposal-only; evidence is not truth/,
	);
	assert.match(result.systemPrompt, /exact cleared host Action/);
	assert.doesNotMatch(result.systemPrompt, /After a Judgment refusal/);
	assert.ok(actionLoopModelProtocolPrompt(["specify"]).length <= 700);
	const progressGuidelines = harness.tools
		.get("developer_progress_action_loop")
		.promptGuidelines.join("\n");
	assert.match(
		progressGuidelines,
		/judgment-refused requires developer_accept_observation_contribution/,
	);
	assert.match(progressGuidelines, /end the response/);
	const observedContributionSchema = harness.tools.get(
		"developer_accept_observation_contribution",
	).parameters as { readonly properties?: Readonly<Record<string, unknown>> };
	assert.ok(observedContributionSchema.properties?.contribution_need);
	assert.equal(
		observedContributionSchema.properties?.contribution_need_id,
		undefined,
	);
	assert.deepEqual(
		harness
			.activeTools()
			.filter((toolName) => toolName.startsWith("developer_"))
			.sort(),
		MODEL_FACING_TOOL_NAMES,
	);
	assert.doesNotMatch(
		result.systemPrompt,
		/admitted_skills:.*model/,
	);
});

test("a new branch becomes ready without claiming recovery work", async () => {
	const harness = createHarness();
	await developer(harness.api);
	await harness.emit("session_start", {
		type: "session_start",
		reason: "startup",
	});
	await harness.commands.get("developer").handler("on", harness.ctx);
	await harness.commands.get("developer").handler("status", harness.ctx);

	const message = harness.notifications.at(-1)?.message ?? "";
	assert.match(message, /developer · Ready/);
	assert.match(message, /Overview · Capabilities:/);
	assert.doesNotMatch(message, /Recovery pending|awaits inventory-bound recovery/);
});

test("activation failure preserves built-in tools and does not record enabled mode", async () => {
	const base = loadedLeaves[0];
	if (!base) throw new Error("Expected one Developer Skill fixture");
	const malformed: Skill = {
		...base,
		sourceInfo: {
			...base.sourceInfo,
			baseDir: join(packageRoot, "dist"),
		},
	};
	const harness = createHarness([malformed]);
	await developer(harness.api);
	await harness.emit("session_start", {
		type: "session_start",
		reason: "startup",
	});
	await harness.commands.get("developer").handler("on", harness.ctx);

	assert.match(
		harness.notifications.at(-1)?.message ?? "",
		/Developer was not enabled because Capability readiness failed/,
	);
	assert.deepEqual(
		new Set(
			harness
				.activeTools()
				.filter((name) => ["bash", "edit", "write"].includes(name)),
		),
		new Set(["bash", "edit", "write"]),
	);
	assert.equal(
		harness.entries.some(
			(entry) =>
				entry.customType === "developer.mode" && entryEnabled(entry) === true,
		),
		false,
	);
});

test("Developer blocks alternate mutation surfaces without blocking observations", async () => {
	const harness = createHarness();
	await developer(harness.api);
	await harness.emit("session_start", {
		type: "session_start",
		reason: "startup",
	});
	await harness.commands.get("developer").handler("on", harness.ctx);

	assert.equal(
		await harness.emit("tool_call", {
			type: "tool_call",
			toolName: "read",
			toolCallId: "read-only",
			input: { path: "package.json" },
		}),
		undefined,
	);
	assert.equal(
		await harness.emit("tool_call", {
			type: "tool_call",
			toolName: "mcp",
			toolCallId: "mcp-search",
			input: { search: "read tools" },
		}),
		undefined,
	);
	const astMutation = await harness.emit("tool_call", {
		type: "tool_call",
		toolName: "ast_grep_replace",
		toolCallId: "ast-mutation",
		input: { pattern: "const $A = $B", rewrite: "const $A = $C", apply: true },
	});
	assert.equal(astMutation.block, true);
	assert.match(astMutation.reason, /workspace mutation without a Developer Action adapter/);
	const mcpCall = await harness.emit("tool_call", {
		type: "tool_call",
		toolName: "mcp",
		toolCallId: "mcp-call",
		input: { tool: "external_write", args: { value: "changed" } },
	});
	assert.equal(mcpCall.block, true);
	assert.match(mcpCall.reason, /may change external state/);
	const unknown = await harness.emit("tool_call", {
		type: "tool_call",
		toolName: "future_mutator",
		toolCallId: "unknown-action",
		input: {},
	});
	assert.equal(unknown.block, true);
	assert.match(unknown.reason, /no Developer observation or Action classification/);
});

test("status fails closed while a session branch awaits inventory-bound replay", async () => {
	const harness = createHarness();
	await developer(harness.api);
	await harness.emit("session_start", {
		type: "session_start",
		reason: "startup",
	});
	await harness.commands.get("developer").handler("on", harness.ctx);
	await openTestWorkCase(harness, "pending-replay");

	await harness.commands.get("developer").handler("status", harness.ctx);
	const message = harness.notifications.at(-1)?.message ?? "";
	assert.match(message, /developer · Recovery pending/);
	assert.match(message, /awaits inventory-bound recovery/);
	assert.doesNotMatch(message, /Outcome · No current work/);
});

test("structured Capability routing stays inside the primary SDK controller prompt boundary", async () => {
	const model = loadedLeaves.find((skill) => skill.name === "model")!;
	const harness = createHarness();
	await developer(harness.api);
	await harness.emit("session_start", {
		type: "session_start",
		reason: "startup",
	});
	await harness.commands.get("developer").handler("on", harness.ctx);
	const result = await harness.emit("before_agent_start", {
		type: "before_agent_start",
		prompt: "test",
		systemPrompt: "base",
		systemPromptOptions: { cwd: packageRoot, skills: [model] },
	});

	assert.match(
		result.systemPrompt,
		/Developer Capability inventory: 1 admitted/,
	);
	assert.doesNotMatch(result.systemPrompt, /matched_when/);
	assert.doesNotMatch(
		result.systemPrompt,
		/Reference-only selection condition/,
	);
	assert.doesNotMatch(result.systemPrompt, /caprev_/);
});

test("natural human decisions durably pause and resume without protocol commands", async () => {
	const harness = createHarness();
	await developer(harness.api);
	await harness.emit("session_start", {
		type: "session_start",
		reason: "startup",
	});
	await harness.commands.get("developer").handler("on", harness.ctx);
	await openTestWorkCase(harness, "natural-pause", false);
	const pauseTurn = await harness.emit("before_agent_start", {
		type: "before_agent_start",
		prompt: "Pause here while I inspect the current result.",
		systemPrompt: "base",
		systemPromptOptions: { cwd: packageRoot, skills: loadedLeaves },
	});
	const pauseObservationId = pauseTurn.systemPrompt.match(
		/- (observation_[a-f0-9]+) ·/,
	)?.[1];
	assert.ok(pauseObservationId);
	const paused = await harness.tools
		.get("developer_pause_work_case")
		.execute("pause-from-user-observation", {
			observation_id: pauseObservationId,
			reason: "The delegating human is inspecting the current result.",
			basis: ["The exact current human message explicitly requests pause."],
		});
	assert.equal(paused.details.kind, "paused");
	assert.doesNotMatch(resultText(paused), /observation_[a-f0-9]+/);
	const resumeTurn = await harness.emit("before_agent_start", {
		type: "before_agent_start",
		prompt: "Inspection is complete. Continue the work.",
		systemPrompt: "base",
		systemPromptOptions: { cwd: packageRoot, skills: loadedLeaves },
	});
	const resumeObservationId = resumeTurn.systemPrompt.match(
		/- (observation_[a-f0-9]+) ·/,
	)?.[1];
	assert.ok(resumeObservationId);
	const resumed = await harness.tools
		.get("developer_resume_work_case")
		.execute("resume-paused-from-user-observation", {
			observation_id: resumeObservationId,
			basis: [
				"The exact current human message explicitly requests continuation.",
			],
		});
	assert.equal(resumed.details.kind, "resumed-paused");
	assert.doesNotMatch(resultText(resumed), /observation_[a-f0-9]+/);
});

test("natural user answers become exact Need-bound Contributions without a Skill route", async () => {
	const harness = createHarness();
	await developer(harness.api);
	await harness.emit("session_start", {
		type: "session_start",
		reason: "startup",
	});
	await harness.commands.get("developer").handler("on", harness.ctx);
	await openTestWorkCase(harness, "direct-answer", true);
	const answerTurn = await harness.emit("before_agent_start", {
		type: "before_agent_start",
		prompt: "Use strict compatibility and reject unknown values.",
		systemPrompt: "base",
		systemPromptOptions: { cwd: packageRoot, skills: loadedLeaves },
	});
	const observationId = answerTurn.systemPrompt.match(
		/- (observation_[a-f0-9]+) ·/,
	)?.[1];
	assert.ok(observationId);
	const directAnswerBasis = [
		"The exact current human message directly answers the current functional Need.",
	];
	const contribution = await harness.tools
		.get("developer_accept_observation_contribution")
		.execute("contribute-from-user-observation", {
			observation_id: observationId,
			local_status: "resolved",
			result: "Use strict compatibility and reject unknown values.",
			limitations: [],
			residual_needs: [],
			basis: directAnswerBasis,
		});
	assert.equal(contribution.details.kind, "accepted");
	assert.equal(contribution.details.result, contribution.details.result.trim());
	assert.doesNotMatch(
		resultText(contribution),
		/(?:observation|contribution)_[a-f0-9]+/,
	);
	const replayEvent = contribution.details.replayEvent as {
		readonly kind?: string;
		readonly proposal?: {
			readonly contributionNeedId?: string;
			readonly basis?: readonly string[];
		};
	};
	assert.equal(replayEvent.kind, "host-contribution-accepted");
	assert.match(replayEvent.proposal?.contributionNeedId ?? "", /^contribution_need_/);
	assert.deepEqual(replayEvent.proposal?.basis, directAnswerBasis);
});

test("natural user Observations durably wait and resume without protocol commands", async () => {
	const harness = createHarness();
	await developer(harness.api);
	await harness.emit("session_start", {
		type: "session_start",
		reason: "startup",
	});
	await harness.commands.get("developer").handler("on", harness.ctx);
	await openTestWorkCase(harness, "live-wait", false);
	const waitingPrompt = await harness.emit("before_agent_start", {
		type: "before_agent_start",
		prompt:
			"The external package registry is unavailable, so wait until a bounded probe succeeds.",
		systemPrompt: "base",
		systemPromptOptions: { cwd: packageRoot, skills: loadedLeaves },
	});
	const waitingObservationId = waitingPrompt.systemPrompt.match(
		/- (observation_[a-f0-9]+) ·/,
	)?.[1];
	assert.ok(waitingObservationId);
	const waited = await harness.tools
		.get("developer_wait_work_case")
		.execute("wait-from-user-observation", {
			observation_id: waitingObservationId,
			external_condition: "The external package registry is unavailable.",
			resume_predicate: "A bounded package registry probe succeeds.",
			basis: [
				"The exact current user message reports the external condition and desired resume boundary.",
			],
		});
	assert.equal(waited.details.kind, "waiting");
	assert.doesNotMatch(resultText(waited), /observation_[a-f0-9]+/);
	await harness.emit("agent_settled", { type: "agent_settled" });
	const waitingSurface = JSON.stringify({
		status: harness.statuses.at(-1)?.value,
		widget: harness.widgets.at(-1)?.value,
	});
	assert.match(waitingSurface, /developer · waiting/);
	assert.match(waitingSurface, /external package registry is unavailable/i);
	assert.match(waitingSurface, /bounded package registry probe succeeds/i);
	assert.doesNotMatch(
		waitingSurface,
		/(?:work_case|revision|observation|contribution|conclusion|assignment|sealed|transition)_[a-f0-9]+/i,
	);
	const blockedAction = await harness.emit("tool_call", {
		type: "tool_call",
		toolName: "bash",
		toolCallId: "bash-while-waiting",
		input: { command: "printf blocked" },
	});
	assert.equal(blockedAction.block, true);
	assert.match(blockedAction.reason, /waiting/);
	assert.doesNotMatch(blockedAction.reason, /\/developer resume/);

	const resumePrompt = await harness.emit("before_agent_start", {
		type: "before_agent_start",
		prompt:
			"The bounded package registry probe now succeeds. Continue the work.",
		systemPrompt: "base",
		systemPromptOptions: { cwd: packageRoot, skills: loadedLeaves },
	});
	assert.match(resumePrompt.systemPrompt, /Waiting Action Loop Work Case:/);
	assert.match(
		resumePrompt.systemPrompt,
		/Resume predicate: A bounded package registry probe succeeds\./,
	);
	const resumeObservationId = resumePrompt.systemPrompt.match(
		/- (observation_[a-f0-9]+) ·/,
	)?.[1];
	assert.ok(resumeObservationId);
	const resumed = await harness.tools
		.get("developer_resume_work_case")
		.execute("resume-from-user-observation", {
			observation_id: resumeObservationId,
			basis: [
				"The exact current user message reports that the stored predicate is now satisfied.",
			],
		});
	assert.equal(resumed.details.kind, "resumed-waiting");
	assert.doesNotMatch(resultText(resumed), /observation_[a-f0-9]+/);
	const resumedTurn = await harness.emit("before_agent_start", {
		type: "before_agent_start",
		prompt: "continue",
		systemPrompt: "base",
		systemPromptOptions: { cwd: packageRoot, skills: loadedLeaves },
	});
	assert.match(resumedTurn.systemPrompt, /Active Action Loop Work Case:/);
	assert.doesNotMatch(resumedTurn.systemPrompt, /Resume predicate:/);
});

test("finalized tool evidence reaches the model without exposing internal IDs in tool output", async () => {
	const harness = await startHarness();
	await harness.emit("before_agent_start", {
		type: "before_agent_start",
		prompt: "Check the package registry and wait if it is unavailable.",
		systemPrompt: "base",
		systemPromptOptions: { cwd: packageRoot, skills: loadedLeaves },
	});
	const originalResult = {
		type: "tool_result",
		toolName: "registry_status",
		toolCallId: "registry-status-1",
		isError: false,
		content: [{ type: "text", text: "registry status: unavailable" }],
		details: { status: "unavailable" },
	};
	const resultPatch = await harness.emit("tool_result", originalResult);
	assert.equal(resultPatch, undefined);
	assert.doesNotMatch(
		originalResult.content.map((item) => item.text).join("\n"),
		/observation_[a-f0-9]+/,
	);
	const context = await harness.emit("context", {
		type: "context",
		messages: [],
	});
	const internal = context.messages.at(-1);
	assert.equal(internal.role, "custom");
	assert.equal(internal.display, false);
	assert.match(String(internal.content), /registry status: unavailable/);
	const observationId = String(internal.content).match(
		/- (observation_[a-f0-9]+) ·/,
	)?.[1];
	assert.ok(observationId);
	const waited = await harness.tools
		.get("developer_wait_work_case")
		.execute("wait-from-tool-observation", {
			observation_id: observationId,
			external_condition: "The package registry is unavailable.",
			resume_predicate: "A finalized registry probe reports available.",
			basis: [
				"The exact finalized registry tool result reports the external condition.",
			],
		});
	assert.equal(waited.details.kind, "waiting");
	assert.doesNotMatch(resultText(waited), /observation_[a-f0-9]+/);
});

test("direct Skill material reads cannot bypass canonical Context sealing as host evidence", async () => {
	const harness = await startHarness();
	const before = await harness.emit("context", {
		type: "context",
		messages: [],
	});
	const beforeContent = String(before.messages.at(-1)?.content);
	const resultPatch = await harness.emit("tool_result", {
		type: "tool_result",
		toolName: "read",
		toolCallId: "direct-skill-reference-read",
		input: {
			path: join(
				packageRoot,
				"skills/model/references/temporal-behavior-models.md",
			),
		},
		isError: false,
		content: [{ type: "text", text: "direct Skill material" }],
		details: {},
	});
	assert.equal(resultPatch, undefined);
	const after = await harness.emit("context", {
		type: "context",
		messages: [],
	});
	const afterContent = String(after.messages.at(-1)?.content);
	assert.equal(afterContent, beforeContent);
	assert.doesNotMatch(afterContent, /direct-skill-reference-read/);
});

test("Pi --no-session mode refuses live nonterminal ownership", async () => {
	const harness = createHarness();
	harness.setSessionFile(undefined);
	await developer(harness.api);
	await harness.emit("session_start", {
		type: "session_start",
		reason: "startup",
	});
	await harness.commands.get("developer").handler("on", harness.ctx);
	await openTestWorkCase(harness, "no-session-pause", false);
	harness.setInputResult("This must not become a process-local pause.");
	const entriesBefore = harness.entries.length;
	await harness.commands.get("developer").handler("pause", harness.ctx);
	assert.equal(harness.entries.length, entriesBefore);
	assert.match(harness.notifications.at(-1)?.message ?? "", /--no-session/);
	harness.setInputResults([
		"This must not become a process-local wait.",
		"A durable predicate becomes satisfied.",
	]);
	await harness.commands.get("developer").handler("wait", harness.ctx);
	assert.equal(harness.entries.length, entriesBefore);
	assert.match(harness.notifications.at(-1)?.message ?? "", /--no-session/);
	await harness.commands.get("developer").handler("block", harness.ctx);
	assert.equal(harness.entries.length, entriesBefore);
	assert.match(harness.notifications.at(-1)?.message ?? "", /--no-session/);
	await assert.rejects(
		harness.tools
			.get("developer_progress_action_loop")
			.execute("progress-action-loop-no-session", {}),
		/durable Pi session branch/,
	);
	await assert.rejects(
		harness.tools.get("developer_pause_work_case").execute("pause-no-session", {
			observation_id: "observation_missing",
			reason: "This must not become a process-local pause.",
			basis: ["This must fail before process-local ownership is retained."],
		}),
		/--no-session/,
	);
	await assert.rejects(
		harness.tools.get("developer_wait_work_case").execute("wait-no-session", {
			observation_id: "observation_missing",
			external_condition: "An external condition is observed.",
			resume_predicate: "The external condition changes.",
			basis: ["This must fail before process-local ownership is retained."],
		}),
		/--no-session/,
	);
	await assert.rejects(
		harness.tools.get("developer_block_work_case").execute("block-no-session", {
			claim_assurance_conclusion_id: "conclusion_missing",
			reason: "No continuation exists.",
			basis: ["This must fail before process-local ownership is retained."],
		}),
		/--no-session/,
	);
	await assert.rejects(
		harness.tools
			.get("developer_resume_work_case")
			.execute("resume-no-session", {
				observation_id: "observation_missing",
				basis: ["This must fail before a process-local resume is accepted."],
			}),
		/--no-session/,
	);
});

test("a released tool delta is claimed safely by the reloaded extension instance", async () => {
	const first = createHarness();
	await developer(first.api);
	await first.emit("session_start", {
		type: "session_start",
		reason: "startup",
	});
	await first.commands.get("developer").handler("on", first.ctx);
	await first.emit("session_shutdown", {
		type: "session_shutdown",
		reason: "reload",
	});

	const second = createHarness();
	second.setActiveTools(first.activeTools());
	second.setBranch(
		first.entries.map((entry) => ({
			type: "custom",
			customType: entry.customType,
			data: entry.data,
		})),
	);
	await developer(second.api);
	await second.emit("session_start", {
		type: "session_start",
		reason: "reload",
	});

	assert.equal(second.activeTools().includes("edit"), false);
	assert.equal(second.activeTools().includes("write"), false);
	assert.equal(second.activeTools().includes("bash"), false);
	assert.equal(
		second.notifications.some((notification) =>
			/restart the Pi process/i.test(notification.message),
		),
		false,
	);
});

test("an unrecognized Developer tool makes in-process reload fail closed", async () => {
	const harness = createHarness();
	harness.api.registerTool({
		name: "developer_unrecognized_protocol_tool",
		description: "Simulates a tool registration from another package revision.",
		parameters: {},
		execute: async () => ({ content: [] }),
	} as never);
	await developer(harness.api);
	await harness.emit("session_start", {
		type: "session_start",
		reason: "reload",
	});

	assert.deepEqual(
		harness
			.activeTools()
			.filter((toolName) => toolName.startsWith("developer_")),
		[],
	);
	assert.equal(
		harness.notifications.some((notification) =>
			/restart the Pi process/i.test(notification.message),
		),
		true,
	);
});

test("shutdown restores only built-ins that Developer actually withheld", async () => {
	const harness = createHarness();
	harness.setActiveTools(["read", "edit", "write"]);
	await developer(harness.api);
	await harness.emit("session_start", {
		type: "session_start",
		reason: "startup",
	});
	await harness.commands.get("developer").handler("on", harness.ctx);
	await harness.emit("session_shutdown", {
		type: "session_shutdown",
		reason: "reload",
	});

	assert.ok(harness.activeTools().includes("edit"));
	assert.ok(harness.activeTools().includes("write"));
	assert.equal(harness.activeTools().includes("bash"), false);
});
test("the canonical command and startup flag replace the old public names", async () => {
	const harness = createHarness();
	await developer(harness.api);

	assert.equal(harness.commands.has("developer"), true);
	assert.equal(harness.commands.has("develop"), false);
	assert.equal(harness.flags.has("developer"), true);
	assert.equal(harness.flags.has("develop"), false);
});

test("the canonical startup flag enables Developer", async () => {
	const harness = createHarness();
	harness.setFlag("developer", true);
	await developer(harness.api);
	await harness.emit("session_start", {
		type: "session_start",
		reason: "startup",
	});

	assert.equal(
		harness.entries.some(
			(entry) => entryKind(entry) === "activation" && entryEnabled(entry),
		),
		true,
	);
	assert.match(harness.statuses.at(-1)?.value as string, /developer/);
});

test("the no-argument command opens a read-only Workbench only in TUI mode", async () => {
	const harness = createHarness();
	await developer(harness.api);
	await harness.emit("session_start", {
		type: "session_start",
		reason: "startup",
	});

	await harness.commands.get("developer").handler("", harness.ctx);
	assert.equal(harness.customCalls(), 0);
	assert.match(harness.notifications.at(-1)?.message ?? "", /developer · Off/);

	harness.ctx.mode = "tui";
	harness.setCustomResult(undefined);
	const entriesBeforeInspection = harness.entries.length;
	await harness.commands.get("developer").handler("", harness.ctx);
	assert.equal(harness.customCalls(), 1);
	assert.deepEqual(harness.customOptions.at(-1), FULL_SCREEN_SURFACE_OPTIONS);
	assert.equal(harness.entries.length, entriesBeforeInspection);

	await harness.commands.get("developer").handler("on", harness.ctx);
	const latestEntry = harness.entries.at(-1);
	assert.equal(latestEntry ? entryEnabled(latestEntry) : undefined, true);
	assert.equal(harness.activeTools().includes("edit"), false);
});

test("Settings is a read-only activation hint without hidden state changes", async () => {
	const harness = await startHarness();
	harness.ctx.mode = "tui";
	const entriesBeforeInspection = harness.entries.length;
	const callsBefore = harness.customCalls();

	await harness.commands.get("developer").handler("settings", harness.ctx);

	assert.equal(harness.customCalls(), callsBefore);
	assert.match(
		harness.notifications.at(-1)?.message ?? "",
		/activation on.*\/developer on.*\/developer off/,
	);
	assert.equal(harness.entries.length, entriesBeforeInspection);
});

test("/developer completes actions and confirms before discarding active canonical work", async () => {
	const harness = await startHarness();
	const command = harness.commands.get("developer");
	assert.deepEqual(command.getArgumentCompletions("st"), [
		{ value: "status", label: "status" },
	]);
	assert.equal(command.getArgumentCompletions("unknown"), null);

	harness.ctx.mode = "tui";
	const entryCount = harness.entries.length;

	harness.setConfirmResult(false);
	await command.handler("off", harness.ctx);
	assert.equal(harness.entries.length, entryCount);
	assert.deepEqual(harness.confirmations.at(-1), {
		title: "Turn off Developer?",
		message:
			"This clears the active Action Loop Work Case from the current protocol state. Existing session history remains.",
	});

	harness.setConfirmResult(true);
	await command.handler("off", harness.ctx);
	assert.equal(
		(harness.entries.at(-1)?.data as { enabled: boolean }).enabled,
		false,
	);
});

test("primary SDK progression refuses to create ownership without an active model", async () => {
	const harness = createHarness();
	await developer(harness.api);
	await harness.emit("session_start", {
		type: "session_start",
		reason: "startup",
	});
	await harness.commands.get("developer").handler("on", harness.ctx);
	await harness.emit("before_agent_start", {
		type: "before_agent_start",
		prompt: "Open and progress canonical work.",
		systemPrompt: "base",
		systemPromptOptions: { cwd: packageRoot, skills: loadedLeaves },
	});

	const entriesBefore = harness.entries.length;
	await assert.rejects(
		harness.tools
			.get("developer_progress_action_loop")
			.execute("progress-no-model", {}, undefined, undefined, harness.ctx),
		/no active model/,
	);
	assert.equal(harness.entries.length, entriesBefore);
});

test("canonical tool rows never expose internal Action Loop identities", async () => {
	const harness = createHarness();
	await developer(harness.api);
	const canonicalTools = [
		"developer_progress_action_loop",
		"developer_accept_observation_contribution",
		"developer_pause_work_case",
		"developer_wait_work_case",
		"developer_block_work_case",
		"developer_resume_work_case",
	];
	const internalId = "observation_aaaaaaaaaaaaaaaa";
	for (const toolName of canonicalTools) {
		const tool = harness.tools.get(toolName);
		assert.ok(tool, toolName);
		assert.equal(tool.renderShell, "self");
		const args = {
			observation_id: internalId,
			work_case_id: "work_case_bbbbbbbbbbbbbbbb",
			revision_id: "revision_cccccccccccccccc",
			reason: "An external decision is pending.",
		};
		const call = renderedText(tool.renderCall(args, theme, { args }));
		const result = renderedText(
			tool.renderResult(
				{
					content: [{ type: "text", text: `internal ${internalId}` }],
					details: { observationId: internalId },
				},
				{ expanded: true, isPartial: false },
				theme,
				{ args, isError: false },
			),
		);
		assert.match(call, /Developer/);
		assert.doesNotMatch(call, /(?:observation|work_case|revision)_[a-f0-9]+/);
		assert.doesNotMatch(result, /(?:observation|work_case|revision)_[a-f0-9]+/);
	}
});
