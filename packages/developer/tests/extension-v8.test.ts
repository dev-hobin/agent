import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
	initTheme,
	loadSkillsFromDir,
	type ExtensionAPI,
} from "@earendil-works/pi-coding-agent";
import { sha256 } from "@hobin/judgment";

import {
	contextFailureWithBranchIdentities,
	developerErrorMessage,
	normalizeConcludeJudgmentData,
	requiredContextFields,
	resolveModelContextNominations,
	type ConcludeJudgmentData,
} from "../extensions/developer-conclusion.ts";
import developerV8 from "../extensions/developer.ts";
import {
	DEVELOPER_RUNTIME_ENTRY,
	reconstructDeveloperRuntimeBranch,
} from "../extensions/developer-runtime-state.ts";
import {
	AUTHORIZE_CHANGE_TOOL,
	CONCLUDE_JUDGMENT_TOOL,
	OPEN_CONTEXT_SOURCES_TOOL,
	OPEN_JUDGMENT_TOOL,
	RECORD_LANDING_TOOL,
} from "../src/runtime-tools.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const bundledSkills = loadSkillsFromDir({
	dir: join(root, "skills"),
	source: "@hobin/developer",
}).skills;
const externalRoot = join(root, "tests", "fixtures", "external-context-plain");
const externalSkill = {
	name: "project-domain-language",
	description: "Preserve project domain language.",
	filePath: join(externalRoot, "SKILL.md"),
	baseDir: externalRoot,
	disableModelInvocation: false,
	sourceInfo: {
		path: externalRoot,
		source: "project-fixtures",
		scope: "project" as const,
		origin: "top-level" as const,
	},
};
const skills = [...bundledSkills, externalSkill];
const theme = initTheme(undefined, false);

function harness(initialBranch: readonly unknown[] = []) {
	const handlers = new Map<string, Array<(...args: unknown[]) => unknown>>();
	const tools = new Map<string, any>();
	const commands = new Map<string, any>();
	const entries: any[] = [];
	let activeTools = ["read", "edit", "write", "bash"];
	let runtimeAppendsBeforeFailure: number | null = null;
	const branch: any[] = JSON.parse(JSON.stringify(initialBranch));
	const api = {
		on(...args: [name: string, handler: (...args: unknown[]) => unknown]) {
			const [name, handler] = args;
			handlers.set(name, [...(handlers.get(name) ?? []), handler]);
		},
		registerTool(tool: any) {
			tools.set(tool.name, tool);
			activeTools.push(tool.name);
		},
		registerCommand(...args: [name: string, command: any]) {
			const [name, command] = args;
			commands.set(name, command);
		},
		registerFlag() {},
		getFlag() {
			return false;
		},
		appendEntry(...args: [customType: string, data: unknown]) {
			const [customType, data] = args;
			if (
				customType === DEVELOPER_RUNTIME_ENTRY &&
				runtimeAppendsBeforeFailure !== null
			) {
				if (runtimeAppendsBeforeFailure === 0) {
					runtimeAppendsBeforeFailure = null;
					throw new Error("simulated runtime append interruption");
				}
				runtimeAppendsBeforeFailure -= 1;
			}
			const entry = { type: "custom", customType, data };
			entries.push(entry);
			branch.push(entry);
		},
		sendUserMessage() {},
		getActiveTools() {
			return [...activeTools];
		},
		setActiveTools(names: string[]) {
			activeTools = [...names];
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
			const registered = [...tools.values()].map((tool) => ({
				name: tool.name,
				description: tool.description,
				parameters: tool.parameters,
				sourceInfo: {
					path: "/developer-v8.ts",
					source: "@hobin/developer",
					scope: "temporary",
					origin: "package",
				},
			}));
			return [...builtins, ...registered];
		},
	} as unknown as ExtensionAPI;
	const notifications: string[] = [];
	const statuses: Array<{ key: string; value: string | undefined }> = [];
	const widgets: Array<{ key: string; value: unknown }> = [];
	let customCalls = 0;
	let mode: "print" | "tui" = "print";
	const ui = {
		theme,
		setStatus(...args: [key: string, value: string | undefined]) {
			const [key, value] = args;
			statuses.push({ key, value });
		},
		setWidget(...args: [key: string, value: unknown]) {
			const [key, value] = args;
			widgets.push({ key, value });
		},
		notify(message: string) {
			notifications.push(message);
		},
		confirm: async () => true,
		setEditorText() {},
		getEditorText: () => "",
		custom: async () => {
			customCalls += 1;
			return undefined;
		},
		editor: async () => undefined,
	};
	const ctx = {
		cwd: root,
		get mode() {
			return mode;
		},
		ui,
		isIdle: () => true,
		getSystemPromptOptions: () => ({ skills, contextFiles: [] }),
		sessionManager: {
			getBranch: () => [...branch],
			getLeafId: () => "branch-v8",
			getSessionId: () => "session-v8",
		},
	};
	return {
		api,
		ctx,
		tools,
		commands,
		entries,
		notifications,
		statuses,
		widgets,
		customCalls: () => customCalls,
		setMode(value: "print" | "tui") {
			mode = value;
		},
		activeTools: () => [...activeTools],
		branch: () => [...branch],
		addBranchEntry(value: unknown) {
			branch.push(value);
		},
		failRuntimeAppendAfter(count: number) {
			runtimeAppendsBeforeFailure = count;
		},
		async emit(...args: [name: string, event?: unknown]) {
			const [name, event = {}] = args;
			let result: unknown;
			for (const handler of handlers.get(name) ?? []) {
				result = await handler(event, ctx);
			}
			return result;
		},
	};
}

async function start(h: ReturnType<typeof harness>) {
	await developerV8(h.api);
	await h.emit("session_start", { reason: "new" });
	await h.emit("before_agent_start", {
		systemPrompt: "base",
		systemPromptOptions: { skills, contextFiles: [] },
	});
	await h.commands.get("developer").handler("on", h.ctx);
}

function currentRuntime(h: ReturnType<typeof harness>) {
	return reconstructDeveloperRuntimeBranch(h.branch());
}

test("the default extension cuts activation and zero-Skill work over to v8-only persistence", async () => {
	const h = harness();
	await start(h);
	assert.equal(h.entries.length, 1);
	assert.equal(h.entries[0]?.customType, DEVELOPER_RUNTIME_ENTRY);
	assert.equal(h.entries[0]?.data.protocolVersion, "developer/v8");
	assert.equal(h.activeTools().includes(OPEN_JUDGMENT_TOOL), true);
	assert.equal(h.activeTools().includes("bash"), false);
	assert.equal(h.activeTools().includes("edit"), false);
	assert.equal(h.statuses.at(-1)?.value, "Developer · Deciding");
	assert.match(
		JSON.stringify(h.widgets.at(-1)?.value),
		/Open a decision for the current question/u,
	);
	assert.doesNotMatch(JSON.stringify(h.widgets.at(-1)?.value), /[a-f0-9]{64}/u);
	const beforeStatus = h.entries.length;
	await h.commands.get("developer").handler("status", h.ctx);
	assert.match(
		h.notifications.at(-1) ?? "",
		/Next: Open a decision for the current question/u,
	);
	assert.equal(h.entries.length, beforeStatus);

	const beforeOldCall = h.entries.length;
	await assert.rejects(() =>
		h.tools.get(OPEN_JUDGMENT_TOOL).execute(
			"call-legacy-shape",
			{
				skill_name: "sketch",
				question: "This old shape lacks an explicit Route.",
				reason: "It must fail closed.",
			},
			undefined,
			undefined,
			h.ctx,
		),
	);
	assert.equal(h.entries.length, beforeOldCall);

	const opened = await h.tools.get(OPEN_JUDGMENT_TOOL).execute(
		"call-zero-open",
		{
			purpose: "work-decision",
			route_definition_id: "route:implementation-shaping",
			question: "What exact zero-Skill change should be shaped?",
			obligations: [
				{
					obligation_id: "obligation:zero-v8",
					statement: "The zero-Skill result has current support.",
				},
			],
		},
		undefined,
		undefined,
		h.ctx,
	);
	assert.match(opened.content[0].text, /No owning Skill was invoked/u);
	assert.deepEqual(opened.details.runtime, {
		state: "frame",
		reroutePending: false,
		verificationPending: false,
	});
	assert.equal(h.activeTools().includes("bash"), false);
	assert.equal(h.activeTools().includes("edit"), false);
	assert.equal(h.activeTools().includes(CONCLUDE_JUDGMENT_TOOL), true);

	const frameId = currentRuntime(h).activeScope?.state.frames[0]?.frame.frameId;
	assert.ok(frameId);
	const conclusionResult = await h.tools.get(CONCLUDE_JUDGMENT_TOOL).execute(
		"call-zero-conclude",
		{
			disposition: "not-applicable",
			not_applicable_reason:
				"The exact negative result resolves this bounded frame.",
			not_applicable_basis: ["The explicit current requirement is sufficient."],
		},
		undefined,
		undefined,
		h.ctx,
	);
	const concluded = currentRuntime(h);
	const frame = concluded.activeScope?.state.frames[0];
	assert.ok(frame?.conclusion);
	assert.equal(conclusionResult.details.nextAction, AUTHORIZE_CHANGE_TOOL);
	assert.equal(
		conclusionResult.content[0].text.includes(
			frame.conclusion.conclusionSha256,
		),
		false,
	);
	assert.equal(h.activeTools().includes(AUTHORIZE_CHANGE_TOOL), true);
	const authorized = await h.tools.get(AUTHORIZE_CHANGE_TOOL).execute(
		"call-zero-authorize",
		{
			movement: "Apply the bounded zero-Skill change.",
			stable_landing: "The bounded files remain stable.",
			verification_target: "Focused checks pass.",
		},
		undefined,
		undefined,
		h.ctx,
	);
	assert.equal(
		authorized.content[0].text,
		"Change authorized. Built-in mutation tools are available for this bounded landing.",
	);
	assert.equal(authorized.details.nextAction, RECORD_LANDING_TOOL);
	assert.deepEqual(authorized.details.runtime, {
		state: "authorized",
		reroutePending: false,
		verificationPending: false,
	});
	assert.equal(h.activeTools().includes("edit"), true);
	const active = currentRuntime(h).activeScope?.root.activeAuthorization;
	assert.ok(active);
	const landingResult = await h.tools.get(RECORD_LANDING_TOOL).execute(
		"call-zero-landing",
		{
			changed_paths: ["packages/developer/zero.ts"],
			result: "The zero-Skill change landed.",
			verification: ["focused check passed"],
		},
		undefined,
		undefined,
		h.ctx,
	);
	assert.deepEqual(landingResult.details.runtime, {
		state: "idle",
		reroutePending: true,
		verificationPending: true,
	});
	const landed = currentRuntime(h);
	assert.equal(landed.activeScope?.root.landings.length, 1);
	assert.equal(landed.activeScope?.root.debts[0]?.reroutePending, true);
	assert.equal(h.activeTools().includes(AUTHORIZE_CHANGE_TOOL), false);
	assert.equal(h.activeTools().includes("edit"), false);

	const rerouteDebt = landed.activeScope?.root.debts[0];
	assert.ok(rerouteDebt);
	await h.tools.get(OPEN_JUDGMENT_TOOL).execute(
		"call-reroute-open",
		{
			purpose: "reroute-decision",
			route_definition_id: "route:change-timing",
			question: "What work belongs next after the landing?",
			obligations: [
				{
					obligation_id: "obligation:reroute-v8",
					statement: "The next route is explicit.",
				},
			],
		},
		undefined,
		undefined,
		h.ctx,
	);
	let debtRuntime = currentRuntime(h);
	assert.equal(
		debtRuntime.activeScope?.state.frames.at(-1)?.frame.frameId,
		rerouteDebt.rerouteFrameId,
	);
	const rerouteResult = await h.tools.get(CONCLUDE_JUDGMENT_TOOL).execute(
		"call-reroute-conclude",
		{
			disposition: "not-applicable",
			not_applicable_reason: "No additional implementation route is required.",
			not_applicable_basis: ["The landing is already bounded."],
		},
		undefined,
		undefined,
		h.ctx,
	);
	assert.deepEqual(rerouteResult.details.runtime, {
		state: "idle",
		reroutePending: false,
		verificationPending: true,
	});
	debtRuntime = currentRuntime(h);
	assert.equal(debtRuntime.activeScope?.root.debts[0]?.reroutePending, false);
	await h.tools.get(OPEN_JUDGMENT_TOOL).execute(
		"call-verification-open",
		{
			purpose: "verification-decision",
			route_definition_id: "route:claim-evidence-assessment",
			question: "What does the landing evidence support?",
			obligations: [
				{
					obligation_id: "obligation:verification-v8",
					statement: "The landing claim is evidence-bounded.",
				},
			],
		},
		undefined,
		undefined,
		h.ctx,
	);
	const verificationResult = await h.tools.get(CONCLUDE_JUDGMENT_TOOL).execute(
		"call-verification-conclude",
		{
			disposition: "not-applicable",
			not_applicable_reason: "The focused landing evidence is sufficient.",
			not_applicable_basis: ["The recorded focused check is current."],
		},
		undefined,
		undefined,
		h.ctx,
	);
	assert.deepEqual(verificationResult.details.runtime, {
		state: "idle",
		reroutePending: false,
		verificationPending: false,
	});
	debtRuntime = currentRuntime(h);
	assert.equal(
		debtRuntime.activeScope?.root.debts[0]?.verificationPending,
		false,
	);
	assert.equal(h.activeTools().includes(AUTHORIZE_CHANGE_TOOL), true);
	assert.equal(
		h.entries
			.filter((entry) => entry.customType?.startsWith("developer."))
			.every((entry) => entry.customType === DEVELOPER_RUNTIME_ENTRY),
		true,
	);
});

test("current successful evidence handles are injected silently before every model continuation", async () => {
	const h = harness();
	await start(h);
	const toolCallId = "call-current-evidence-read";
	h.addBranchEntry({
		id: "assistant-current-evidence",
		type: "message",
		message: {
			role: "assistant",
			content: [
				{
					type: "toolCall",
					id: toolCallId,
					name: "read",
					arguments: { path: "src/order-total.js" },
				},
			],
		},
	});
	h.addBranchEntry({
		id: "result-current-evidence",
		type: "message",
		message: {
			role: "toolResult",
			toolCallId,
			toolName: "read",
			isError: false,
			content: [{ type: "text", text: "current source" }],
		},
	});
	const projected = (await h.emit("context", { messages: [] })) as {
		messages: Array<Record<string, unknown>>;
	};
	const control = projected.messages.at(-1);
	assert.equal(control?.customType, "developer.model-control");
	assert.equal(control?.display, false);
	assert.match(
		JSON.stringify(control),
		new RegExp(`branch-result-${sha256(toolCallId).slice(0, 16)}`, "u"),
	);
	assert.match(JSON.stringify(control), /Never make a failing probe/u);
});

test("the bare TUI command opens only the current receipt overlay", async () => {
	const h = harness();
	await start(h);
	h.setMode("tui");
	const before = h.entries.length;
	await h.commands.get("developer").handler("", h.ctx);
	assert.equal(h.customCalls(), 1);
	assert.equal(h.entries.length, before);
	assert.equal(
		h.entries.every((entry) => entry.customType === DEVELOPER_RUNTIME_ENTRY),
		true,
	);
});

test("one owner is routed and invoked while additional Skills remain material context", async () => {
	const h = harness();
	await start(h);
	const opened = await h.tools.get(OPEN_JUDGMENT_TOOL).execute(
		"call-owner-open",
		{
			purpose: "work-decision",
			route_definition_id: "route:claim-evidence-assessment",
			question: "What claim does current owner evidence support?",
			obligations: [
				{
					obligation_id: "obligation:owner-v8-a",
					statement: "The claim is bounded by current evidence.",
				},
				{
					obligation_id: "obligation:owner-v8-b",
					statement: "Residual risk remains explicit.",
				},
				{
					obligation_id: "obligation:owner-v8-c",
					statement: "The root judgment retains an independent workflow constraint.",
				},
			],
			owner_skill: {
				skill_name: "verify",
				target_obligation_ids: [
					"obligation:owner-v8-b",
					"obligation:owner-v8-a",
				],
				subquestion: "What does the current evidence support?",
				expected_contribution: "A bounded claim and residual risk.",
				limitations: ["Contribution-only authority."],
			},
		},
		undefined,
		undefined,
		h.ctx,
	);
	assert.match(opened.content[0].text, /Verify/u);
	const runtime = currentRuntime(h);
	assert.equal(runtime.activeScope?.state.assignments.length, 1);
	assert.deepEqual(
		runtime.activeScope?.state.assignments[0]?.assignment.targetObligationIds,
		["obligation:owner-v8-a", "obligation:owner-v8-b"],
	);
	assert.ok(runtime.activeScope?.state.activeInvocation);
	const frameId = runtime.activeScope?.state.frames[0]?.frame.frameId;
	assert.ok(frameId);
	await h.tools.get(CONCLUDE_JUDGMENT_TOOL).execute(
		"call-owner-needs-context",
		{
			disposition: "judgment",
			applicability: {
				kind: "applicable",
				basis: ["The claim is consequential but not yet supported."],
			},
			nominations: [],
			selection_basis: ["No current material settles the owner claim."],
			coverage: {
				status: "needs-evidence",
				contributions: [],
				conflicts: [],
				limitations: [
					{
						nominationIds: [],
						description: "A current domain source is still required.",
					},
				],
			},
			outcome: {
				kind: "needs-evidence",
				evidenceNeeded: ["Open a current domain source."],
				resolutionOwner: "agent",
			},
		},
		undefined,
		undefined,
		h.ctx,
	);
	const waiting = currentRuntime(h);
	assert.equal(waiting.activeScope?.state.activeInvocation, null);
	assert.equal(waiting.activeScope?.state.frames[0]?.blockers.length, 1);
	const sourceLine = opened.content[0].text
		.split("\n")
		.find((line: string) => line.includes("project-domain-language"));
	assert.ok(sourceLine);
	const sourceId = sourceLine.match(/^- ([^ ]+) /u)?.[1];
	assert.ok(sourceId);
	await h.tools.get(OPEN_CONTEXT_SOURCES_TOOL).execute(
		"call-owner-context",
		{
			inventory_source_ids: [sourceId],
		},
		undefined,
		undefined,
		h.ctx,
	);
	const withContext = currentRuntime(h);
	assert.equal(
		withContext.activeScope?.supportRecords.some(
			(support) => support.sourceKind === "material",
		),
		true,
	);
	h.addBranchEntry({
		id: "019fc8cf-0c9e-7993-ae53-e5eee5fc3f31",
		type: "message",
		message: {
			role: "user",
			content: "The current evidence claim must remain bounded.",
		},
	});
	await h.tools.get(CONCLUDE_JUDGMENT_TOOL).execute(
		"call-owner-contextual",
		{
			disposition: "judgment",
			applicability: {
				kind: "applicable",
				basis: ["The explicit user event owns the evidence boundary."],
			},
			nominations: [
				{
					nominationId: "owner-evidence-boundary",
					kind: "user-decision",
				},
				{
					nominationId: "owner-evidence-boundary-alias",
					kind: "user-decision",
				},
			],
			selection_basis: ["The current user event bounds the claim."],
			coverage: {
				status: "sufficient",
				contributions: [
					{
						nominationId: "owner-evidence-boundary",
						useAs: "decision",
						contribution: "The claim must remain bounded by current evidence.",
						assurance: "user-accepted",
					},
				],
				conflicts: [],
				limitations: [],
			},
			outcome: {
				kind: "contextual-judgment",
				citedUses: [
					{
						contributionIndex: 0,
						artifactEffect:
							"The result states only the current supported claim.",
					},
				],
				rationale: "The explicit user decision bounds the claim.",
				artifact: "Current evidence supports only the bounded owner claim.",
				stopEvidence: ["The claim has an explicit evidence owner."],
			},
		},
		undefined,
		undefined,
		h.ctx,
	);
	const concluded = currentRuntime(h);
	assert.equal(concluded.activeScope?.state.activeInvocation, null);
	assert.ok(concluded.activeScope?.state.frames[0]?.conclusion);
	assert.equal(concluded.activeScope?.state.frames[0]?.blockers.length, 0);
	assert.equal(
		(concluded.activeScope?.state.frames[0]?.contributions.length ?? 0) >= 1,
		true,
	);
	assert.equal(concluded.replay.rejectedCount, 0);
});

test("an interrupted batch reconstructs its accepted prefix before returning the append error", async () => {
	const h = harness();
	await start(h);
	const before = currentRuntime(h).replay.acceptedCount;
	h.failRuntimeAppendAfter(2);
	await assert.rejects(
		() =>
			h.tools.get(OPEN_JUDGMENT_TOOL).execute(
				"call-interrupted-open",
				{
					purpose: "work-decision",
					route_definition_id: "route:claim-evidence-assessment",
					question: "What prefix survives an interrupted append?",
					obligations: [
						{
							obligation_id: "obligation:interrupted-v8",
							statement: "Every persisted prefix remains replay-valid.",
						},
					],
					owner_skill: {
						skill_name: "verify",
						target_obligation_ids: ["obligation:interrupted-v8"],
						subquestion: "What does the persisted prefix establish?",
						expected_contribution: "A prefix-bounded replay result.",
					},
				},
				undefined,
				undefined,
				h.ctx,
			),
		/simulated runtime append interruption/u,
	);
	const prefix = currentRuntime(h);
	assert.equal(prefix.replay.acceptedCount, before + 2);
	assert.equal(prefix.replay.rejectedCount, 0);
	assert.ok(prefix.activeScope?.state.frames[0]);
	assert.equal(prefix.activeScope?.state.activeInvocation, null);
	assert.equal(prefix.projection.receiptCount, prefix.replay.acceptedCount);
});

test("deactivation cancels an active owner, closes its scope, and re-enable opens a new scope", async () => {
	const h = harness();
	await start(h);
	const firstScopeId = currentRuntime(h).activeScope?.workScopeId;
	assert.ok(firstScopeId);
	await h.tools.get(OPEN_JUDGMENT_TOOL).execute(
		"call-off-open",
		{
			purpose: "work-decision",
			route_definition_id: "route:claim-evidence-assessment",
			question: "What must deactivation preserve?",
			obligations: [
				{
					obligation_id: "obligation:off-v8",
					statement: "Deactivation settles the active owner lifecycle.",
				},
			],
			owner_skill: {
				skill_name: "verify",
				target_obligation_ids: ["obligation:off-v8"],
				subquestion: "What lifecycle state remains after deactivation?",
				expected_contribution: "A cancellation-bounded lifecycle result.",
			},
		},
		undefined,
		undefined,
		h.ctx,
	);
	assert.ok(currentRuntime(h).activeScope?.state.activeInvocation);
	await h.commands.get("developer").handler("off", h.ctx);
	const closed = currentRuntime(h);
	assert.equal(closed.activeScope, null);
	assert.equal(closed.historyMode, "v8-closed");
	const firstScope = closed.replay.scopes.find(
		(scope) => scope.workScopeId === firstScopeId,
	);
	assert.equal(firstScope?.root.status, "closed");
	assert.equal(firstScope?.state.activeInvocation, null);
	await h.commands.get("developer").handler("on", h.ctx);
	const reopened = currentRuntime(h);
	assert.ok(reopened.activeScope);
	assert.notEqual(reopened.activeScope.workScopeId, firstScopeId);
});

test("zero-Skill conclusions reject unsupported summaries and admit nominated tool evidence", async () => {
	const h = harness();
	await start(h);
	await h.tools.get(OPEN_JUDGMENT_TOOL).execute(
		"call-zero-evidence-open",
		{
			purpose: "work-decision",
			route_definition_id: "route:claim-evidence-assessment",
			question: "What does the current check support?",
			obligations: [
				{
					obligation_id: "obligation:zero-evidence",
					statement: "The conclusion cites current evidence.",
				},
			],
		},
		undefined,
		undefined,
		h.ctx,
	);
	const unsupported = {
		disposition: "judgment",
		applicability: {
			kind: "applicable",
			basis: ["The current check is relevant."],
		},
		nominations: [],
		selection_basis: ["Use only current evidence."],
		coverage: {
			status: "sufficient",
			contributions: [],
			conflicts: [],
			limitations: [],
		},
		outcome: {
			kind: "contextual-judgment",
			citedUses: [],
			rationale: "The check is claimed to support the result.",
			artifact: "The check passed.",
			stopEvidence: ["A current check exists."],
		},
	};
	await assert.rejects(
		() =>
			h.tools
				.get(CONCLUDE_JUDGMENT_TOOL)
				.execute(
					"call-zero-evidence-unsupported",
					unsupported,
					undefined,
					undefined,
					h.ctx,
				),
		/sufficient coverage requires at least one admitted contribution/iu,
	);
	assert.equal(
		currentRuntime(h).activeScope?.state.frames.at(-1)?.conclusion,
		null,
	);

	const toolCallId = "call-zero-evidence-check";
	h.addBranchEntry({
		id: "assistant-zero-evidence-check",
		type: "message",
		message: {
			role: "assistant",
			content: [
				{
					type: "toolCall",
					id: toolCallId,
					name: "bash",
					arguments: { command: "npm test" },
				},
			],
		},
	});
	h.addBranchEntry({
		id: "result-zero-evidence-check",
		type: "message",
		message: {
			role: "toolResult",
			toolCallId,
			toolName: "bash",
			isError: false,
			content: [{ type: "text", text: "7 tests passed" }],
		},
	});
	const branchResultId = `branch-result-${sha256(toolCallId).slice(0, 16)}`;
	await h.tools.get(CONCLUDE_JUDGMENT_TOOL).execute(
		"call-zero-evidence-supported",
		{
			...unsupported,
			nominations: [
				{
					nominationId: "current-test-run",
					kind: "tool-result",
					branchResultId,
				},
			],
			coverage: {
				status: "sufficient",
				contributions: [
					{
						nominationId: "current-test-run",
						useAs: "evidence",
						contribution: "The focused suite reports seven passing tests.",
						assurance: "agent-asserted",
					},
				],
				conflicts: [],
				limitations: [],
			},
			outcome: {
				kind: "contextual-judgment",
				citedUses: [
					{
						contributionIndex: 0,
						artifactEffect: "The conclusion is limited to the focused suite.",
					},
				],
				rationale: "The nominated current run supports the bounded claim.",
				artifact: "The focused suite passes seven tests.",
				stopEvidence: ["The nominated current test run is admitted."],
			},
		},
		undefined,
		undefined,
		h.ctx,
	);
	const concluded = currentRuntime(h).activeScope?.state.frames.at(-1);
	assert.ok(concluded?.conclusion);
	assert.ok((concluded?.contributions.length ?? 0) >= 1);
});

test("neutral conclusion boundary preserves required fields and exact branch aliases", () => {
	const complete: ConcludeJudgmentData = {
		disposition: "judgment",
		applicability: {
			kind: "applicable",
			basis: ["The current branch evidence is consequential."],
		},
		nominations: [],
		selection_basis: ["Use exact active-branch identities."],
		coverage: {
			status: "needs-evidence",
			contributions: [],
			conflicts: [],
			limitations: [
				{
					nominationIds: [],
					description: "A branch result remains required.",
				},
			],
		},
		outcome: {
			kind: "needs-evidence",
			evidenceNeeded: ["Read the exact branch result."],
			resolutionOwner: "agent",
		},
	};
	const fields = requiredContextFields(complete);
	assert.equal(fields.applicability.kind, "applicable");
	const normalized = normalizeConcludeJudgmentData({
		...complete,
		selection_basis: ["Current evidence is sufficient. "],
		outcome: {
			kind: "needs-evidence",
			evidenceNeeded: ["Read the exact branch result. "],
			resolutionOwner: "agent",
		},
	});
	assert.deepEqual(normalized.selection_basis, ["Current evidence is sufficient."]);
	assert.deepEqual(
		normalized.outcome?.kind === "needs-evidence"
			? normalized.outcome.evidenceNeeded
			: [],
		["Read the exact branch result."],
	);
	assert.deepEqual(fields.nominations, []);
	assert.throws(
		() =>
			requiredContextFields({
				...complete,
				applicability: undefined,
			}),
		/requires applicability/u,
	);
	assert.throws(
		() =>
			requiredContextFields({
				...complete,
				not_applicable_reason: "misplaced",
			}),
		/cannot carry not-applicable/u,
	);

	const toolCallId = "call-neutral-conclusion-read";
	const branch = [
		{
			id: "event:user",
			type: "message",
			message: {
				role: "user",
				content: "Use the current branch evidence.",
			},
		},
		{
			id: "assistant-tool-call",
			type: "message",
			message: {
				role: "assistant",
				content: [
					{
						type: "toolCall",
						id: toolCallId,
						name: "read",
						arguments: { path: "src/contracts.ts" },
					},
				],
			},
		},
		{
			id: "tool-result",
			type: "message",
			message: {
				role: "toolResult",
				toolCallId,
				toolName: "read",
				isError: false,
				content: [{ type: "text", text: "Observed contract." }],
			},
		},
	];
	const branchResultId = `branch-result-${sha256(toolCallId).slice(0, 16)}`;
	const nominations = resolveModelContextNominations({
		nominations: [
			{
				nominationId: "inventory-nomination",
				kind: "inventory-source",
				inventorySourceId: "source:inventory",
				contentSha256: "a".repeat(64),
			},
			{
				nominationId: "user-nomination",
				kind: "user-decision",
			},
			{
				nominationId: "tool-nomination",
				kind: "tool-result",
				branchResultId,
			},
		],
		branch,
	});
	assert.deepEqual(
		nominations.map((nomination) => nomination.kind),
		["inventory-source", "user-decision", "tool-result"],
	);
	const toolNomination = nominations.find(
		(nomination) => nomination.kind === "tool-result",
	);
	assert.equal(toolNomination?.toolCallId, toolCallId);
	assert.throws(
		() =>
			resolveModelContextNominations({
				nominations: [
					{
						nominationId: "missing-tool",
						kind: "tool-result",
						branchResultId: "branch-result-deadbeefdeadbeef",
					},
				],
				branch,
			}),
		/Available branch result IDs/u,
	);
	assert.match(
		contextFailureWithBranchIdentities({
			error: new Error("context failed"),
			branch,
		}),
		new RegExp(`${branchResultId} · read`, "u"),
	);
	assert.equal(
		developerErrorMessage({ message: "structured context failure" }),
		"structured context failure",
	);
	assert.equal(
		developerErrorMessage({ code: "invalid-context" }),
		"Developer context failed (invalid-context).",
	);
	assert.notEqual(developerErrorMessage({}), "[object Object]");
});

test("a resumed active authorization fails closed without its process-local workspace baseline", async () => {
	const first = harness();
	await start(first);
	await first.tools.get(OPEN_JUDGMENT_TOOL).execute(
		"call-resume-authorization-open",
		{
			purpose: "work-decision",
			route_definition_id: "route:implementation-shaping",
			question: "What bounded change may be resumed?",
			obligations: [
				{
					obligation_id: "obligation:resume-authorization",
					statement: "The authorization remains restart-safe.",
				},
			],
		},
		undefined,
		undefined,
		first.ctx,
	);
	await first.tools.get(CONCLUDE_JUDGMENT_TOOL).execute(
		"call-resume-authorization-conclude",
		{
			disposition: "not-applicable",
			not_applicable_reason: "The bounded change is already explicit.",
			not_applicable_basis: ["The current requirement supplies the boundary."],
		},
		undefined,
		undefined,
		first.ctx,
	);
	await first.tools.get(AUTHORIZE_CHANGE_TOOL).execute(
		"call-resume-authorization-authorize",
		{
			movement: "Apply one bounded change.",
			stable_landing: "The bounded path is recorded.",
			verification_target: "The focused check passes.",
		},
		undefined,
		undefined,
		first.ctx,
	);
	assert.equal(first.activeTools().includes("edit"), true);

	const resumed = harness(first.branch());
	await developerV8(resumed.api);
	await resumed.emit("session_start", { reason: "resume" });
	assert.equal(resumed.statuses.at(-1)?.value, "Developer · Blocked");
	assert.equal(resumed.activeTools().includes("edit"), false);
	assert.equal(resumed.activeTools().includes("write"), false);
	assert.equal(resumed.activeTools().includes("bash"), false);
	await assert.rejects(
		() =>
			resumed.tools.get(RECORD_LANDING_TOOL).execute(
				"call-resume-authorization-landing",
				{
					changed_paths: ["src/resumed.ts"],
					result: "A resumed landing must fail closed.",
				},
				undefined,
				undefined,
				resumed.ctx,
			),
		/workspace baseline captured at authorization/iu,
	);
});

test("reload reconciliation requires a safe marker and records only lifecycle cancellation", async () => {
	const first = harness();
	await start(first);
	await first.tools.get(OPEN_JUDGMENT_TOOL).execute(
		"call-reload-open",
		{
			purpose: "work-decision",
			route_definition_id: "route:claim-evidence-assessment",
			question: "What survives reload?",
			obligations: [
				{
					obligation_id: "obligation:reload-v8",
					statement: "Reload never resumes provider effects.",
				},
			],
			owner_skill: {
				skill_name: "verify",
				target_obligation_ids: ["obligation:reload-v8"],
				subquestion: "What reload claim is supported?",
				expected_contribution: "A lifecycle-bounded claim.",
			},
		},
		undefined,
		undefined,
		first.ctx,
	);
	const second = harness(first.branch());
	await developerV8(second.api);
	const before = second.entries.length;
	await second.emit("session_start", { reason: "reload" });
	assert.equal(second.entries.length, before, JSON.stringify(second.entries));
	assert.equal(
		second.notifications.some((message) => /Restart Pi/u.test(message)),
		true,
	);

	await first.emit("session_shutdown", {});
	const safe = harness(first.branch());
	await developerV8(safe.api);
	await safe.emit("session_start", { reason: "reload" });
	assert.equal(
		safe.entries.filter((entry) => entry.customType === DEVELOPER_RUNTIME_ENTRY)
			.length,
		1,
	);
	const replayed = currentRuntime(safe);
	assert.equal(replayed.activeScope?.state.activeInvocation, null);
	const last = replayed.replay.acceptedEvents.at(-1)?.semanticEvent;
	assert.equal(last?.kind, "invocation-settled");
	if (last?.kind !== "invocation-settled") {
		assert.fail("reload lifecycle settlement is missing");
	}
	assert.equal(last.settlement.kind, "lifecycle");
	if (last.settlement.kind !== "lifecycle") {
		assert.fail("reload settlement must remain lifecycle");
	}
	assert.equal(last.settlement.lifecycle.kind, "cancelled");
	assert.equal(last.settlement.lifecycle.executionUncertain, true);
});
