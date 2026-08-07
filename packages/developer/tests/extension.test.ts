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

import developer from "../extensions/developer.ts";
import { DEVELOPER_MODE_ENTRY } from "../extensions/developer-mode.ts";

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

const TEST_CAPABILITY_REFERENCES: Readonly<Record<string, readonly string[]>> =
	{
		model: [
			"references/problem-modeling.md",
			"references/contract-and-replacement-models.md",
			"references/relational-constraint-models.md",
			"references/temporal-behavior-models.md",
			"references/proof-obligations.md",
			"references/solver-result-boundaries.md",
			"references/logic-query-semantics.md",
			"references/planning-models.md",
		],
		verify: ["references/verifier-selection-and-pass-but-wrong.md"],
	};

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

function createHarness() {
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
			let result;
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
	await harness.tools
		.get("developer_open_work_case")
		.execute("work-case-fixture", {
			statement: `The ${label} test Work Case reaches its bounded Outcome.`,
			acceptance_conditions: [
				`The ${label} test observes the accepted protocol behavior.`,
			],
			constraints: ["No unrelated test behavior changes."],
			basis: ["The current test delegates this bounded Outcome."],
		});
	if (!withJudgment) return;
	await harness.tools
		.get("developer_open_judgment")
		.execute("judgment-fixture", {
			category: "Contextual Adequacy",
			subject: `The ${label} test route.`,
			question: `Which Contribution serves the ${label} test route?`,
			requirements: [
				{
					statement: `The ${label} route is supported by a relevant Contribution.`,
					contribution_needs: ["test-selected routing contribution"],
				},
			],
			basis: ["The route requires one explicit functional Need."],
		});
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

	assert.match(result.systemPrompt, /Pi-admitted Developer Skills: specify\./);
	assert.match(
		result.systemPrompt,
		/Action Loop capability inventory: 1 bound \(0 unavailable, 0 excluded\)\./,
	);
	assert.match(result.systemPrompt, /Observe → Judge → Act → Settle/);
	assert.match(
		result.systemPrompt,
		/developer_accept_observation_contribution/,
	);
	assert.match(result.systemPrompt, /Evidence is not automatically truth/);
	assert.match(result.systemPrompt, /exact one-use input/);
	assert.doesNotMatch(result.systemPrompt, /developer_route_question/);
	assert.doesNotMatch(result.systemPrompt, /developer_record_judgment/);
	assert.doesNotMatch(
		result.systemPrompt,
		/Pi-admitted Developer Skills:.*model/,
	);
});

test("structured Capability inventory separates applicability from Reference selection conditions", async () => {
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
		/Capability applicability conditions for matched_when:/,
	);
	assert.match(
		result.systemPrompt,
		/Reference-only selection condition[\s\S]*never use in matched_when or matched_unless/,
	);
});

test("a live Work Case opens once and projects across agent turns", async () => {
	const harness = createHarness();
	await developer(harness.api);
	await harness.emit("session_start", {
		type: "session_start",
		reason: "startup",
	});
	await harness.commands.get("developer").handler("on", harness.ctx);
	const opening = harness.tools.get("developer_open_work_case");
	assert.ok(opening);
	const opened = await opening.execute("tool-open-work-case", {
		statement: "The package exposes one live bounded Work Case.",
		acceptance_conditions: [
			"The accepted Work Case is projected into the next agent turn.",
		],
		constraints: ["No second Outcome replaces active work."],
		basis: ["The current delegated request requires this bounded Outcome."],
	});
	assert.match(resultText(opened), /Work Case opened/);

	const next = await harness.emit("before_agent_start", {
		type: "before_agent_start",
		prompt: "continue",
		systemPrompt: "base",
		systemPromptOptions: { cwd: packageRoot, skills: loadedLeaves },
	});
	assert.match(next.systemPrompt, /Active Action Loop Work Case:/);
	assert.match(
		next.systemPrompt,
		/The package exposes one live bounded Work Case\./,
	);
	await assert.rejects(
		harness.tools
			.get("developer_assess_capability")
			.execute("assess-without-judgment", {
				capability: "specify",
				status: "applicable",
				matched_when: [],
				matched_unless: [],
				basis: ["No current Judgment has supplied a functional Need."],
				missing_context: [],
			}),
		/open Judgment/i,
	);
	await assert.rejects(
		opening.execute("tool-replace-work-case", {
			statement: "Replace the active Outcome.",
			acceptance_conditions: ["The replacement wins."],
			constraints: [],
			basis: ["A model proposed replacement without closure."],
		}),
		/active Work Case/i,
	);
	harness.ctx.mode = "tui";
	harness.setConfirmResult(false);
	await harness.commands.get("developer").handler("off", harness.ctx);
	const afterDecline = await harness.emit("before_agent_start", {
		type: "before_agent_start",
		prompt: "continue",
		systemPrompt: "base",
		systemPromptOptions: { cwd: packageRoot, skills: [] },
	});
	assert.match(afterDecline.systemPrompt, /Active Action Loop Work Case:/);
	harness.ctx.mode = "print";
	await harness.commands.get("developer").handler("off", harness.ctx);
	await harness.commands.get("developer").handler("on", harness.ctx);
	const afterReset = await harness.emit("before_agent_start", {
		type: "before_agent_start",
		prompt: "new work",
		systemPrompt: "base",
		systemPromptOptions: { cwd: packageRoot, skills: [] },
	});
	assert.match(afterReset.systemPrompt, /No active Action Loop Work Case/);
});

test("human commands durably pause and resume one live Work Case", async () => {
	const harness = createHarness();
	await developer(harness.api);
	await harness.emit("session_start", {
		type: "session_start",
		reason: "startup",
	});
	await harness.commands.get("developer").handler("on", harness.ctx);
	const opening = harness.tools.get("developer_open_work_case");
	const opened = await opening.execute("open-before-pause", {
		statement: "The current Work Case can retain human-owned pause continuity.",
		acceptance_conditions: [
			"The exact paused revision survives until explicit human resume.",
		],
		constraints: ["Controlled Actions remain blocked while paused."],
		basis: ["The durable session boundary now owns nonterminal continuity."],
	});
	harness.setInputResult(
		"The delegating human needs to inspect the current result.",
	);
	await harness.commands.get("developer").handler("pause", harness.ctx);
	assert.equal(
		(harness.entries.at(-1)?.data as { kind?: string }).kind,
		"work-case-paused",
	);
	const pausedEntry = harness.entries.at(-1)!;
	const pausedTurn = await harness.emit("before_agent_start", {
		type: "before_agent_start",
		prompt: "continue",
		systemPrompt: "base",
		systemPromptOptions: { cwd: packageRoot, skills: loadedLeaves },
	});
	assert.match(pausedTurn.systemPrompt, /Paused Action Loop Work Case:/);
	assert.match(pausedTurn.systemPrompt, /\/developer resume/);
	const blockedAction = await harness.emit("tool_call", {
		type: "tool_call",
		toolName: "write",
		toolCallId: "write-while-paused",
		input: { path: "/tmp/paused", content: "blocked" },
	});
	assert.equal(blockedAction.block, true);
	assert.match(blockedAction.reason, /paused/);
	await assert.rejects(
		opening.execute("replace-paused", {
			statement: "Replace paused ownership.",
			acceptance_conditions: ["Replacement succeeds."],
			constraints: [],
			basis: ["A model attempted replacement."],
		}),
		/paused Action Loop Work Case/,
	);

	harness.setConfirmResult(true);
	await harness.commands.get("developer").handler("resume", harness.ctx);
	assert.equal(
		(harness.entries.at(-1)?.data as { kind?: string }).kind,
		"paused-work-case-resumed",
	);
	const resumedTurn = await harness.emit("before_agent_start", {
		type: "before_agent_start",
		prompt: "continue",
		systemPrompt: "base",
		systemPromptOptions: { cwd: packageRoot, skills: loadedLeaves },
	});
	assert.match(resumedTurn.systemPrompt, /Active Action Loop Work Case:/);
	assert.doesNotMatch(resumedTurn.systemPrompt, /Pause:/);

	const activationEntry = harness.entries.find(
		(entry) => entry.customType === DEVELOPER_MODE_ENTRY,
	)!;
	const activeBranch = [
		{ type: "custom", ...activationEntry },
		{
			type: "message",
			message: {
				role: "toolResult",
				toolName: "developer_open_work_case",
				details: opened.details,
			},
		},
	];
	const restored = createHarness();
	restored.setBranch([...activeBranch, { type: "custom", ...pausedEntry }]);
	await developer(restored.api);
	await restored.emit("session_start", {
		type: "session_start",
		reason: "resume",
	});
	const restoredPause = await restored.emit("before_agent_start", {
		type: "before_agent_start",
		prompt: "resume paused fork",
		systemPrompt: "base",
		systemPromptOptions: { cwd: packageRoot, skills: loadedLeaves },
	});
	assert.match(restoredPause.systemPrompt, /Paused Action Loop Work Case:/);

	restored.setBranch(activeBranch);
	await restored.emit("session_tree", { type: "session_tree" });
	const restoredActive = await restored.emit("before_agent_start", {
		type: "before_agent_start",
		prompt: "switch to active ancestor",
		systemPrompt: "base",
		systemPromptOptions: { cwd: packageRoot, skills: loadedLeaves },
	});
	assert.match(restoredActive.systemPrompt, /Active Action Loop Work Case:/);
	assert.doesNotMatch(restoredActive.systemPrompt, /Pause:/);
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
	const contribution = await harness.tools
		.get("developer_accept_observation_contribution")
		.execute("contribute-from-user-observation", {
			observation_id: observationId,
			local_status: "resolved",
			result: "Use strict compatibility and reject unknown values.",
			limitations: [],
			residual_needs: [],
			basis: [
				"The exact current human message directly answers the current functional Need.",
			],
		});
	assert.equal(contribution.details.kind, "accepted");
	assert.equal(contribution.details.result, contribution.details.result.trim());
	assert.doesNotMatch(resultText(contribution), /observation_[a-f0-9]+/);
	assert.equal(
		(contribution.details.replayEvent as { kind?: string }).kind,
		"host-contribution-accepted",
	);
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
			.get("developer_progress_action_loop_with_sdk")
			.execute("progress-action-loop-no-session", {}),
		/durable Pi session branch/,
	);
	await assert.rejects(
		harness.tools
			.get("developer_progress_judgment_with_sdk")
			.execute("progress-no-session", {}),
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

test("a live Judgment exposes Closure Requirements and Contribution Needs", async () => {
	const harness = createHarness();
	await developer(harness.api);
	await harness.emit("session_start", {
		type: "session_start",
		reason: "startup",
	});
	await harness.commands.get("developer").handler("on", harness.ctx);
	await openTestWorkCase(harness, "live-judgment", false);
	const opening = harness.tools.get("developer_open_judgment");
	const opened = await opening.execute("open-live-judgment", {
		category: "Claim Assurance",
		subject: "The current bounded completion Claim.",
		question: "What does current evidence support?",
		requirements: [
			{
				statement: "Every closure obligation has relevant evidence.",
				contribution_needs: ["claim-relevant verifier"],
			},
		],
		basis: ["The active Outcome is approaching a closure Claim."],
	});
	assert.match(resultText(opened), /Judgment opened/);
	assert.match(
		resultText(opened),
		new RegExp(opened.details.judgment.requirements[0].requirementId),
	);
	assert.match(
		resultText(opened),
		new RegExp(opened.details.judgment.contributionNeeds[0].contributionNeedId),
	);
	const next = await harness.emit("before_agent_start", {
		type: "before_agent_start",
		prompt: "continue",
		systemPrompt: "base",
		systemPromptOptions: { cwd: packageRoot, skills: loadedLeaves },
	});
	assert.match(next.systemPrompt, /Open Judgment: open_judgment_/);
	assert.match(next.systemPrompt, /Closure Requirements:/);
	assert.match(next.systemPrompt, /Contribution Needs:/);
	assert.match(
		next.systemPrompt,
		/Capability verify · caprev_.* · structured[\s\S]*A concrete completion, correctness, compatibility, coverage, or evidence claim must be judged\./,
	);
	const assessed = await harness.tools
		.get("developer_assess_capability")
		.execute("assess-live-verify", {
			capability: "verify",
			status: "applicable",
			matched_when: [
				"A concrete completion, correctness, compatibility, coverage, or evidence claim must be judged.",
			],
			matched_unless: [],
			basis: [
				"The requested route fixture explicitly serves the current Contribution Need.",
			],
			missing_context: [],
		});
	assert.match(resultText(assessed), /Capability verify: applicable · assign_/);
	const selected = await harness.tools
		.get("developer_select_references")
		.execute("select-live-verify-reference", {
			capability: "verify",
			dispositions: [
				{
					path: "references/verifier-selection-and-pass-but-wrong.md",
					status: "selected",
					basis: [
						"The route fixture explicitly selects this canonical Reference.",
					],
				},
			],
		});
	assert.match(resultText(selected), /Reference selection sealed: selection_/);
	assert.match(resultText(selected), /sealed_/);
	const loadedReference = await harness.tools
		.get("developer_load_selected_reference")
		.execute("load-live-verify-reference", {
			sealed_context_id: selected.details.sealedContextId,
			path: "references/verifier-selection-and-pass-but-wrong.md",
		});
	assert.match(resultText(loadedReference), /Selected Reference:/);
	assert.match(resultText(loadedReference), /SHA-256: sha256_[a-f0-9]{64}/);
	assert.match(resultText(loadedReference), /Pass-But-Wrong/);
	const afterAssessment = await harness.emit("before_agent_start", {
		type: "before_agent_start",
		prompt: "continue",
		systemPrompt: "base",
		systemPromptOptions: { cwd: packageRoot, skills: loadedLeaves },
	});
	assert.match(afterAssessment.systemPrompt, /Capability assignment: assign_/);
	assert.match(afterAssessment.systemPrompt, /Reference selection: selection_/);
	assert.match(afterAssessment.systemPrompt, /Sealed Skill context: sealed_/);
	await assert.rejects(
		opening.execute("open-second-judgment", {
			category: "Proportionate Intervention",
			subject: "Another independent intervention.",
			question: "Should another Judgment replace the current one?",
			requirements: [
				{
					statement: "The intervention is proportionate.",
					contribution_needs: ["cost and reversibility comparison"],
				},
			],
			basis: [
				"A second proposal attempted to bypass current Judgment closure.",
			],
		}),
		/already open/i,
	);
	const contributed = await harness.tools
		.get("developer_accept_contribution")
		.execute("accept-live-verify-contribution", {
			capability: "verify",
			local_status: "resolved",
			result: "The selected verifier method supports the current Claim.",
			reference_applications: [
				{
					path: "references/verifier-selection-and-pass-but-wrong.md",
					status: "applied",
					application:
						"Used the pass-but-wrong distinction to bound the supported Claim.",
				},
			],
			limitations: ["No unknown external Effect was inferred as successful."],
			residual_needs: [],
		});
	assert.match(
		resultText(contributed),
		/Skill Contribution accepted: contribution_/,
	);
	const coverage = await harness.tools
		.get("developer_assess_coverage")
		.execute("assess-live-verify-coverage", {
			status: "covered",
			dispositions: [
				{
					contribution_id: contributed.details.contribution.contributionId,
					status: "supports",
					basis: ["The accepted verifier Contribution fully serves the Need."],
				},
			],
			conflicts: [],
			basis: ["Every current Contribution has an explicit disposition."],
		});
	assert.match(resultText(coverage), /Need Coverage assessed: coverage_/);
	assert.match(resultText(coverage), /· covered/);
	const closed = await harness.tools
		.get("developer_close_judgment")
		.execute("close-live-claim-assurance", {
			outcome: "conclude",
			answer: "The selected verifier Contribution supports the current Claim.",
			refusal_reasons: [],
			requirement_dispositions: [
				{
					requirement_id: opened.details.judgment.requirements[0].requirementId,
					status: "satisfied",
					coverage_ids: [coverage.details.coverage.coverageId],
					basis: ["The only Requirement has complete covered evidence."],
				},
			],
			basis: ["Current Coverage and Requirement accounting is complete."],
		});
	assert.match(resultText(closed), /Judgment concluded: conclusion_/);
	const actionToolInput = {
		path: "/tmp/developer-live-action.txt",
		content: "bounded verified artifact",
	};
	const action = await harness.tools
		.get("developer_propose_action")
		.execute("propose-live-action", {
			tool_name: "write",
			tool_input: actionToolInput,
			summary: "Write one bounded verified artifact.",
			intended_effects: ["The bounded artifact is updated."],
			required_conclusion_ids: [closed.details.artifact.conclusionId],
		});
	assert.match(
		resultText(action),
		/Action Candidate accepted: action_candidate_/,
	);
	assert.match(
		resultText(action),
		/Action Clearance cleared: action_clearance_/,
	);
	assert.equal(action.details.permission.status, "granted");
	assert.equal(
		action.details.permission.source,
		"pi:default-permission-policy",
	);
	assert.match(
		action.details.clearance.actionClearanceId,
		/^action_clearance_/,
	);
	assert.equal(harness.activeTools().includes("write"), true);
	const mismatchedAction = await harness.emit("tool_call", {
		toolName: "write",
		input: { ...actionToolInput, content: "different artifact" },
		toolCallId: "write:mismatched-live-action",
	});
	assert.match(
		mismatchedAction.reason,
		/exact current unconsumed Action Clearance/,
	);
	assert.equal(
		await harness.emit("tool_call", {
			toolName: "write",
			input: actionToolInput,
			toolCallId: "write:cleared-live-action",
		}),
		undefined,
	);
	assert.equal(harness.activeTools().includes("write"), false);
	assert.equal(
		await harness.emit("tool_result", {
			toolName: "write",
			toolCallId: "write:cleared-live-action",
			input: actionToolInput,
			content: [{ type: "text", text: "Wrote file successfully" }],
			isError: false,
			details: undefined,
		}),
		undefined,
	);
	const effectProjection = await harness.emit("before_agent_start", {
		type: "before_agent_start",
		prompt: "account for effect",
		systemPrompt: "base",
		systemPromptOptions: { cwd: packageRoot, skills: loadedLeaves },
	});
	const effectId = /Effect: (effect_[a-f0-9]+)/.exec(
		effectProjection.systemPrompt,
	)?.[1];
	const effectObservationId =
		/Effect Observation: (effect_observation_[a-f0-9]+)/.exec(
			effectProjection.systemPrompt,
		)?.[1];
	assert.ok(effectId);
	assert.ok(effectObservationId);
	const effectSettlement = await harness.tools
		.get("developer_settle_effect")
		.execute("settle-live-effect", {
			effect_id: effectId,
			outcome: "unknown",
			observation_dispositions: [
				{
					effect_observation_id: effectObservationId,
					status: "relied-on",
					basis: ["The Pi result establishes occurrence only."],
				},
			],
			intended_effect_dispositions: [
				{
					intended_effect: "The bounded artifact is updated.",
					status: "unknown",
					observation_ids: [effectObservationId],
					basis: ["Artifact state has not been independently observed."],
				},
			],
			basis: ["Keep the Effect unsettled until artifact state is verified."],
		});
	assert.match(
		resultText(effectSettlement),
		/Effect unsettled: effect_assessment_/,
	);
	assert.match(resultText(effectSettlement), /· unknown/);
	const notReadyClosure = await harness.tools
		.get("developer_prepare_closure")
		.execute("prepare-unsettled-closure", {});
	assert.match(resultText(notReadyClosure), /unsettled-effect/);
	const successfulSettlement = await harness.tools
		.get("developer_settle_effect")
		.execute("settle-live-effect-success", {
			effect_id: effectId,
			outcome: "observed-success",
			observation_dispositions: [
				{
					effect_observation_id: effectObservationId,
					status: "relied-on",
					basis: ["The exact Pi write result is current occurrence evidence."],
				},
			],
			intended_effect_dispositions: [
				{
					intended_effect: "The bounded artifact is updated.",
					status: "observed",
					observation_ids: [effectObservationId],
					basis: [
						"The exact bounded Pi write reports that the requested artifact was written.",
					],
				},
			],
			basis: ["Explicit accounting now supports the bounded intended Effect."],
			expected_current_assessment_id: effectSettlement.details.assessmentId,
		});
	assert.match(
		resultText(successfulSettlement),
		/Effect settled: effect_settlement_.* · observed-success/,
	);
	await assert.rejects(
		harness.tools
			.get("developer_record_effect_remediation")
			.execute("reject-non-adverse-remediation", {
				adverse_effect_id: effectId,
				remediation_effect_id: effectId,
				basis: ["The same successful Effect cannot remediate itself."],
			}),
		/Only a failed or partially-applied Effect requires remediation/,
	);
	const repeatedAction = await harness.emit("tool_call", {
		toolName: "write",
		input: actionToolInput,
		toolCallId: "write:repeated-live-action",
	});
	assert.match(
		repeatedAction.reason,
		/exact current unconsumed Action Clearance/,
	);
	const readyClosure = await harness.tools
		.get("developer_prepare_closure")
		.execute("prepare-ready-closure", {});
	assert.match(
		resultText(readyClosure),
		/Closure Target ready: closure_target_/,
	);
	const closureTarget = readyClosure.details.artifact;
	assert.equal(closureTarget.obligations.length, 2);
	assert.equal(closureTarget.conclusionIds.length, 1);
	assert.equal(closureTarget.effectAssessmentIds.length, 1);
	const completed = await harness.tools
		.get("developer_complete_work_case")
		.execute("complete-live-work-case", {
			closure_target_id: closureTarget.closureTargetId,
			mode: "completed",
			obligation_dispositions: [
				{
					closure_obligation_id:
						closureTarget.obligations[0].closureObligationId,
					conclusion_ids: closureTarget.conclusionIds,
					effect_assessment_ids: [],
					effect_remediation_ids: [],
					basis: ["The Claim Assurance Conclusion supports this obligation."],
				},
				{
					closure_obligation_id:
						closureTarget.obligations[1].closureObligationId,
					conclusion_ids: [],
					effect_assessment_ids: closureTarget.effectAssessmentIds,
					effect_remediation_ids: [],
					basis: ["The observed-success Effect supports this obligation."],
				},
			],
			basis: [
				"Every current closure obligation and evidence item is accounted.",
			],
		});
	assert.match(resultText(completed), /Work Case completed: work_case_/);
	const afterContribution = await harness.emit("before_agent_start", {
		type: "before_agent_start",
		prompt: "continue",
		systemPrompt: "base",
		systemPromptOptions: { cwd: packageRoot, skills: loadedLeaves },
	});
	assert.match(
		afterContribution.systemPrompt,
		/No active Action Loop Work Case/,
	);
	assert.match(
		afterContribution.systemPrompt,
		/Completed Action Loop Work Case: work_case_/,
	);
	assert.match(
		afterContribution.systemPrompt,
		/Closure Target: closure_target_/,
	);
	assert.match(
		afterContribution.systemPrompt,
		/Closure Claim: closure_claim_.* · completed/,
	);
});

test("the current Pi branch restores a persisted Action Loop Work Case opening", async () => {
	const first = createHarness();
	await developer(first.api);
	await first.emit("session_start", {
		type: "session_start",
		reason: "startup",
	});
	await first.commands.get("developer").handler("on", first.ctx);
	const opened = await first.tools
		.get("developer_open_work_case")
		.execute("persisted-work-case", {
			statement: "The Pi session branch restores the active Work Case.",
			acceptance_conditions: [
				"The exact canonical Work Case identity is reconstructed.",
			],
			constraints: ["No separate persistence store is used."],
			basis: ["The user selected Pi session-backed replay."],
		});

	const second = createHarness();
	second.setBranch([
		...first.entries.map((entry) => ({ type: "custom", ...entry })),
		{
			type: "message",
			message: {
				role: "toolResult",
				toolName: "developer_open_work_case",
				details: opened.details,
			},
		},
	]);
	await developer(second.api);
	await second.emit("session_start", {
		type: "session_start",
		reason: "startup",
	});
	const resumed = await second.emit("before_agent_start", {
		type: "before_agent_start",
		prompt: "resume",
		systemPrompt: "base",
		systemPromptOptions: { cwd: packageRoot, skills: loadedLeaves },
	});

	assert.ok(
		resumed.systemPrompt.includes(
			`Active Action Loop Work Case: ${opened.details.workCase.workCaseId}`,
		),
	);
	assert.ok(resumed.systemPrompt.includes(opened.details.workCase.revisionId));
});

test("the current Pi branch restores Judgment routing through Conclusion", async () => {
	const first = createHarness();
	await developer(first.api);
	await first.emit("session_start", {
		type: "session_start",
		reason: "startup",
	});
	await first.commands.get("developer").handler("on", first.ctx);
	await first.emit("before_agent_start", {
		type: "before_agent_start",
		prompt: "start",
		systemPrompt: "base",
		systemPromptOptions: { cwd: packageRoot, skills: loadedLeaves },
	});
	const opened = await first.tools
		.get("developer_open_work_case")
		.execute("replay-routing-work-case", {
			statement: "The Pi session restores canonical Judgment routing.",
			acceptance_conditions: [
				"The current Conclusion remains bound to its exact Contribution evidence.",
			],
			constraints: [
				"Sealed bytes are reacquired only when their hash matches.",
			],
			basis: ["The selected replay design requires branch-exact continuity."],
		});
	const judgment = await first.tools
		.get("developer_open_judgment")
		.execute("replay-routing-judgment", {
			category: "Claim Assurance",
			subject: "The Action Loop replay boundary.",
			question: "Does the current session preserve exact routing evidence?",
			requirements: [
				{
					statement:
						"The replay boundary preserves one exact routed Contribution.",
					contribution_needs: ["session replay design evidence"],
				},
			],
			basis: ["Durable continuity is required before live nonterminal status."],
		});
	const contributionNeedId =
		judgment.details.judgment.contributionNeeds[0].contributionNeedId;
	const assessed = await first.tools
		.get("developer_assess_capability")
		.execute("replay-routing-assessment", {
			capability: "model",
			contribution_need_id: contributionNeedId,
			status: "applicable",
			matched_when: [
				"Consequential conditions, rules, contracts, histories, or proof boundaries must be modeled.",
			],
			matched_unless: [],
			basis: ["Replay ordering and drift behavior are consequential rules."],
			missing_context: [],
		});
	const selected = await first.tools
		.get("developer_select_references")
		.execute("replay-routing-selection", {
			capability: "model",
			contribution_need_id: contributionNeedId,
			dispositions: TEST_CAPABILITY_REFERENCES.model.map((path) => ({
				path,
				status: "not-needed",
				basis: ["The replay protocol cases are already explicit in this test."],
			})),
		});
	const contribution = await first.tools
		.get("developer_accept_contribution")
		.execute("replay-routing-contribution", {
			capability: "model",
			contribution_need_id: contributionNeedId,
			local_status: "resolved",
			result:
				"The branch event order and exact identity checks preserve routing evidence.",
			reference_applications: [],
			limitations: [],
			residual_needs: [],
		});
	const coverage = await first.tools
		.get("developer_assess_coverage")
		.execute("replay-routing-coverage", {
			contribution_need_id: contributionNeedId,
			status: "covered",
			dispositions: [
				{
					contribution_id: contribution.details.contribution.contributionId,
					status: "supports",
					basis: ["The accepted Contribution answers the replay design Need."],
				},
			],
			conflicts: [],
			basis: ["All current Contributions are accounted."],
		});
	const conclusion = await first.tools
		.get("developer_close_judgment")
		.execute("replay-routing-conclusion", {
			outcome: "conclude",
			answer: "Pi branch replay preserves the exact canonical routing chain.",
			refusal_reasons: [],
			requirement_dispositions: [
				{
					requirement_id:
						judgment.details.judgment.requirements[0].requirementId,
					status: "satisfied",
					coverage_ids: [coverage.details.coverage.coverageId],
					basis: ["The current Coverage satisfies the replay Requirement."],
				},
			],
			basis: ["Every current Requirement has exact Coverage."],
		});

	const activationEntries = first.entries.map((entry) => ({
		type: "custom",
		...entry,
	}));
	const routingResults = [
		opened,
		judgment,
		assessed,
		selected,
		contribution,
		coverage,
		conclusion,
	];
	const routingBranch = [
		...activationEntries,
		...routingResults.map((result) => ({
			type: "message",
			message: {
				role: "toolResult",
				toolName: "developer-action-loop-test",
				details: result.details,
			},
		})),
	];
	const second = createHarness();
	second.setBranch(routingBranch);
	await developer(second.api);
	await second.emit("session_start", {
		type: "session_start",
		reason: "startup",
	});
	const resumed = await second.emit("before_agent_start", {
		type: "before_agent_start",
		prompt: "resume",
		systemPrompt: "base",
		systemPromptOptions: { cwd: packageRoot, skills: loadedLeaves },
	});

	assert.ok(
		resumed.systemPrompt.includes(
			`Judgment Conclusion: ${conclusion.details.artifact.conclusionId}`,
		),
	);
	assert.ok(
		resumed.systemPrompt.includes(
			`Skill Contribution: ${contribution.details.contribution.contributionId}`,
		),
	);
	assert.ok(
		resumed.systemPrompt.includes(
			`Sealed Skill context: ${selected.details.sealedContextId}`,
		),
	);

	const excluded = createHarness();
	excluded.setBranch(routingBranch);
	await developer(excluded.api);
	await excluded.emit("session_start", {
		type: "session_start",
		reason: "startup",
	});
	const unavailable = await excluded.emit("before_agent_start", {
		type: "before_agent_start",
		prompt: "resume without model",
		systemPrompt: "base",
		systemPromptOptions: {
			cwd: packageRoot,
			skills: loadedLeaves.filter((skill) => skill.name !== "model"),
		},
	});
	assert.match(
		unavailable.systemPrompt,
		/Action Loop session replay unavailable/,
	);
	assert.match(unavailable.systemPrompt, /Capability model@caprev_/);
	await assert.rejects(
		excluded.tools.get("developer_open_work_case").execute("replace-replay", {
			statement: "Replacement work must not hide unavailable replay state.",
			acceptance_conditions: ["The unavailable state remains visible."],
			constraints: [],
			basis: ["Replay failed against the current Pi-admitted inventory."],
		}),
		/cannot replace unavailable Action Loop session state/,
	);
	const blockedMutation = await excluded.emit("tool_call", {
		toolName: "write",
		toolCallId: "write:blocked-replay",
		input: { path: "/tmp/blocked-replay", content: "blocked" },
	});
	assert.match(blockedMutation.reason, /session replay is unavailable/i);
	await excluded.commands.get("developer").handler("off", excluded.ctx);
	await excluded.commands.get("developer").handler("on", excluded.ctx);
	const resetOpening = await excluded.tools
		.get("developer_open_work_case")
		.execute("reset-replay", {
			statement: "An explicit Developer-off reset starts new bounded work.",
			acceptance_conditions: [
				"The old unavailable branch state is not reused.",
			],
			constraints: [],
			basis: [
				"The branch-local activation reset explicitly cleared ownership.",
			],
		});
	assert.match(resultText(resetOpening), /Work Case opened/);

	const toolInput = {
		path: "/tmp/developer-action-loop-session-replay.txt",
		content: "session replay",
	};
	const action = await first.tools
		.get("developer_propose_action")
		.execute("replay-action", {
			tool_name: "write",
			tool_input: toolInput,
			summary: "Write the bounded replay fixture.",
			intended_effects: ["The bounded replay fixture is written."],
			required_conclusion_ids: [conclusion.details.artifact.conclusionId],
		});
	await first.emit("tool_call", {
		toolName: "write",
		input: toolInput,
		toolCallId: "write:replay-action",
	});
	await first.emit("tool_result", {
		toolName: "write",
		toolCallId: "write:replay-action",
		isError: false,
		content: [{ type: "text", text: "Wrote replay fixture" }],
		details: { path: toolInput.path },
	});
	const actionLoopEntries = first.entries.filter(
		(entry) => entry.customType === "developer.action-loop.session-event",
	);
	const begunEvent = actionLoopEntries.find(
		(entry) => entryKind(entry) === "effect-begun",
	)?.data as any;
	const observedEvent = actionLoopEntries.find(
		(entry) => entryKind(entry) === "effect-observed",
	)?.data as any;
	assert.ok(begunEvent);
	assert.ok(observedEvent);
	const waited = await first.tools
		.get("developer_wait_work_case")
		.execute("wait-on-effect-observation", {
			observation_id: observedEvent.expected.effectObservationId,
			external_condition:
				"The write result exists but independent human verification is not yet observed.",
			resume_predicate:
				"The delegating human confirms the exact write result is available for settlement.",
			basis: [
				"The current Effect Observation establishes the write result while independent verification remains external.",
			],
		});
	assert.match(resultText(waited), /work is waiting/i);
	const waitingResumeTurn = await first.emit("before_agent_start", {
		type: "before_agent_start",
		prompt:
			"The delegating human confirms the exact write result is available for settlement.",
		systemPrompt: "base",
		systemPromptOptions: { cwd: packageRoot, skills: loadedLeaves },
	});
	const waitingResumeObservationId = waitingResumeTurn.systemPrompt.match(
		/- (observation_[a-f0-9]+) ·/,
	)?.[1];
	assert.ok(waitingResumeObservationId);
	const resumedWaiting = await first.tools
		.get("developer_resume_work_case")
		.execute("resume-waiting-from-observation", {
			observation_id: waitingResumeObservationId,
			basis: [
				"The exact current human Observation satisfies the stored resume predicate.",
			],
		});
	assert.equal(resumedWaiting.details.kind, "resumed-waiting");

	const blocked = await first.tools
		.get("developer_block_work_case")
		.execute("block-on-unsettled-effect", {
			claim_assurance_conclusion_id: conclusion.details.artifact.conclusionId,
			reason:
				"The current Effect cannot yet be settled from the available evidence.",
			basis: [
				"The current Claim Assurance Conclusion accounts the exact unsettled Effect blocker.",
			],
		});
	assert.match(resultText(blocked), /work is blocked/i);
	const blockedTurn = await first.emit("before_agent_start", {
		type: "before_agent_start",
		prompt:
			"The exact Effect Observation is now available for settlement, so settle the pending Effect from that Observation.",
		systemPrompt: "base",
		systemPromptOptions: { cwd: packageRoot, skills: loadedLeaves },
	});
	assert.match(blockedTurn.systemPrompt, /Blocked Action Loop Work Case:/);
	assert.match(blockedTurn.systemPrompt, /Claim Assurance:/);
	const blockedResumeObservationId = blockedTurn.systemPrompt.match(
		/- (observation_[a-f0-9]+) ·/,
	)?.[1];
	assert.ok(blockedResumeObservationId);
	const resumedBlocked = await first.tools
		.get("developer_resume_work_case")
		.execute("resume-blocked-from-observation", {
			observation_id: blockedResumeObservationId,
			observed_change:
				"The exact Effect Observation is now available for settlement.",
			continuation: "Settle the pending Effect from the current Observation.",
			basis: [
				"The current human Observation supplies the changed blocker state and bounded continuation.",
			],
		});
	assert.equal(resumedBlocked.details.kind, "resumed-blocked");
	const nonterminalEntries = [
		{
			type: "message",
			message: {
				role: "toolResult",
				toolName: "developer_wait_work_case",
				details: waited.details,
			},
		},
		{
			type: "message",
			message: {
				role: "toolResult",
				toolName: "developer_resume_work_case",
				details: resumedWaiting.details,
			},
		},
		{
			type: "message",
			message: {
				role: "toolResult",
				toolName: "developer_block_work_case",
				details: blocked.details,
			},
		},
		{
			type: "message",
			message: {
				role: "toolResult",
				toolName: "developer_resume_work_case",
				details: resumedBlocked.details,
			},
		},
	];
	const settlement = await first.tools
		.get("developer_settle_effect")
		.execute("replay-effect-settlement", {
			effect_id: begunEvent.expected.effectId,
			outcome: "observed-success",
			observation_dispositions: [
				{
					effect_observation_id: observedEvent.expected.effectObservationId,
					status: "relied-on",
					basis: ["The exact current Pi write result is occurrence evidence."],
				},
			],
			intended_effect_dispositions: [
				{
					intended_effect: "The bounded replay fixture is written.",
					status: "observed",
					observation_ids: [observedEvent.expected.effectObservationId],
					basis: ["The bounded Pi write returned without an execution error."],
				},
			],
			basis: ["Every intended Effect and Observation is explicitly accounted."],
		});
	const prepared = await first.tools
		.get("developer_prepare_closure")
		.execute("replay-closure-target", {});
	const closureTarget = prepared.details.artifact;
	const completed = await first.tools
		.get("developer_complete_work_case")
		.execute("replay-completion", {
			closure_target_id: closureTarget.closureTargetId,
			mode: "completed",
			obligation_dispositions: [
				{
					closure_obligation_id:
						closureTarget.obligations[0].closureObligationId,
					conclusion_ids: closureTarget.conclusionIds,
					effect_assessment_ids: [],
					effect_remediation_ids: [],
					basis: ["The Claim Assurance Conclusion supports this obligation."],
				},
				{
					closure_obligation_id:
						closureTarget.obligations[1].closureObligationId,
					conclusion_ids: [],
					effect_assessment_ids: closureTarget.effectAssessmentIds,
					effect_remediation_ids: [],
					basis: ["The observed-success Effect supports this obligation."],
				},
			],
			basis: [
				"Every current closure obligation and evidence item is accounted.",
			],
		});
	const completedBranch = [
		...routingBranch,
		{
			type: "message",
			message: {
				role: "toolResult",
				toolName: "developer_propose_action",
				details: action.details,
			},
		},
		...actionLoopEntries.map((entry) => ({ type: "custom", ...entry })),
		...nonterminalEntries,
		{
			type: "message",
			message: {
				role: "toolResult",
				toolName: "developer_settle_effect",
				details: settlement.details,
			},
		},
		{
			type: "message",
			message: {
				role: "toolResult",
				toolName: "developer_complete_work_case",
				details: completed.details,
			},
		},
	];
	const third = createHarness();
	third.setBranch(completedBranch);
	await developer(third.api);
	await third.emit("session_start", {
		type: "session_start",
		reason: "startup",
	});
	const completedResume = await third.emit("before_agent_start", {
		type: "before_agent_start",
		prompt: "resume completed",
		systemPrompt: "base",
		systemPromptOptions: { cwd: packageRoot, skills: loadedLeaves },
	});
	assert.ok(
		completedResume.systemPrompt.includes(
			`Completed Action Loop Work Case: ${completed.details.workCase.workCaseId}`,
		),
	);
	assert.ok(
		completedResume.systemPrompt.includes(
			`Closure Claim: ${completed.details.workCase.closureClaim.closureClaimId}`,
		),
	);
});

test("an unstructured Capability seals SKILL.md through an empty Reference disposition", async () => {
	const harness = createHarness();
	await developer(harness.api);
	await harness.emit("session_start", {
		type: "session_start",
		reason: "startup",
	});
	await harness.commands.get("developer").handler("on", harness.ctx);
	await openTestWorkCase(harness, "unstructured-capability", false);
	const opened = await harness.tools
		.get("developer_open_judgment")
		.execute("open-unstructured-judgment", {
			category: "Contextual Adequacy",
			subject: "A bounded product meaning",
			question: "What must the requested behavior mean?",
			requirements: [
				{
					statement: "The product meaning is explicit.",
					contribution_needs: ["A bounded product specification"],
				},
			],
			basis: ["The active Outcome contains an unresolved product meaning."],
		});
	const needId =
		opened.details.judgment.contributionNeeds[0].contributionNeedId;
	await harness.emit("before_agent_start", {
		type: "before_agent_start",
		prompt: "continue",
		systemPrompt: "base",
		systemPromptOptions: { cwd: packageRoot, skills: loadedLeaves },
	});
	const assessed = await harness.tools
		.get("developer_assess_capability")
		.execute("assess-unstructured", {
			capability: "specify",
			contribution_need_id: needId,
			status: "applicable",
			matched_when: [],
			matched_unless: [],
			basis: ["The current Need requires a bounded product specification."],
			missing_context: [],
		});
	assert.match(resultText(assessed), /Capability specify: applicable/);
	const sealed = await harness.tools
		.get("developer_select_references")
		.execute("seal-unstructured", {
			capability: "specify",
			contribution_need_id: needId,
			dispositions: [],
		});
	assert.match(
		resultText(sealed),
		/Unstructured Skill context sealed: sealed_/,
	);
	assert.equal(sealed.details.selectedPaths.length, 0);
	assert.equal(sealed.details.replayEvent.kind, "unstructured-context-sealed");
	const contributed = await harness.tools
		.get("developer_accept_contribution")
		.execute("contribute-unstructured", {
			capability: "specify",
			contribution_need_id: needId,
			local_status: "resolved",
			result: "The requested behavior has one explicit bounded meaning.",
			reference_applications: [],
			limitations: [],
			residual_needs: [],
		});
	assert.match(resultText(contributed), /Skill Contribution accepted/);
});

test("non-applicable Capability assessment cannot authorize Skill routing", async () => {
	const harness = createHarness();
	await developer(harness.api);
	await harness.emit("session_start", {
		type: "session_start",
		reason: "startup",
	});
	await harness.commands.get("developer").handler("on", harness.ctx);
	await openTestWorkCase(harness, "not-applicable-capability");
	await harness.emit("before_agent_start", {
		type: "before_agent_start",
		prompt: "continue",
		systemPrompt: "base",
		systemPromptOptions: { cwd: packageRoot, skills: loadedLeaves },
	});
	const assessed = await harness.tools
		.get("developer_assess_capability")
		.execute("assess-not-applicable", {
			capability: "specify",
			status: "not-applicable",
			matched_when: [],
			matched_unless: [],
			basis: ["The current Need is not a product-meaning clarification."],
			missing_context: [],
		});
	assert.match(resultText(assessed), /Capability specify: not-applicable/);
	await assert.rejects(
		harness.tools
			.get("developer_accept_contribution")
			.execute("contribute-without-assignment", {
				capability: "specify",
				local_status: "resolved",
				result: "This result must not be accepted.",
				reference_applications: [],
				limitations: [],
				residual_needs: [],
			}),
		/exact current Capability Assignment/i,
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
			.get("developer_progress_action_loop_with_sdk")
			.execute("progress-no-model", {}, undefined, undefined, harness.ctx),
		/no active model/,
	);
	assert.equal(harness.entries.length, entriesBefore);
});

test("canonical tool rows never expose internal Action Loop identities", async () => {
	const harness = createHarness();
	await developer(harness.api);
	const canonicalTools = [
		"developer_progress_action_loop_with_sdk",
		"developer_open_work_case",
		"developer_open_judgment",
		"developer_progress_judgment_with_sdk",
		"developer_assess_capability",
		"developer_select_references",
		"developer_load_selected_reference",
		"developer_accept_contribution",
		"developer_accept_observation_contribution",
		"developer_assess_coverage",
		"developer_close_judgment",
		"developer_propose_action",
		"developer_settle_effect",
		"developer_record_effect_remediation",
		"developer_pause_work_case",
		"developer_wait_work_case",
		"developer_block_work_case",
		"developer_resume_work_case",
		"developer_prepare_closure",
		"developer_complete_work_case",
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
