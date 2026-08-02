import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
	initTheme,
	loadSkillsFromDir,
	type ExtensionAPI,
} from "@earendil-works/pi-coding-agent";

import developerV7 from "../extensions/developer.ts";
import {
	AUTHORIZE_CHANGE_TOOL,
	CONCLUDE_JUDGMENT_TOOL,
	OPEN_JUDGMENT_TOOL,
	RECORD_LANDING_TOOL,
} from "../src/protocol.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const skills = loadSkillsFromDir({
	dir: join(root, "skills"),
	source: "@hobin/developer",
}).skills;
const theme = initTheme(undefined, false);

function harness() {
	const handlers = new Map<string, Array<(event: any, ctx: any) => any>>();
	const tools = new Map<string, any>();
	const commands = new Map<string, any>();
	const entries: any[] = [];
	let activeTools = ["read", "edit", "write", "bash"];
	let branch: any[] = [];
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
		registerFlag() {},
		getFlag() {
			return false;
		},
		appendEntry(customType: string, data: unknown) {
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
					path: "/developer-v7.ts",
					source: "@hobin/developer",
					scope: "temporary",
					origin: "package",
				},
			}));
			return [...builtins, ...registered];
		},
	} as unknown as ExtensionAPI;
	const ui = {
		theme,
		setStatus() {},
		setWidget() {},
		notify() {},
		confirm: async () => true,
		setEditorText() {},
		getEditorText: () => "",
		custom: async () => undefined,
		editor: async () => undefined,
	};
	const ctx = {
		cwd: root,
		mode: "print",
		ui,
		isIdle: () => true,
		getSystemPromptOptions: () => ({ skills, contextFiles: [] }),
		sessionManager: {
			getBranch: () => [...branch],
			getLeafId: () => "branch-main",
			getSessionId: () => "session-main",
		},
	};
	return {
		api,
		ctx,
		tools,
		commands,
		entries,
		activeTools: () => [...activeTools],
		setBranch(value: any[]) {
			branch = [...value];
		},
		async emit(name: string, event: any = {}) {
			let result: unknown;
			for (const handler of handlers.get(name) ?? []) {
				result = await handler(event, ctx);
			}
			return result;
		},
	};
}

test("the largest complete method stays inside the bounded tool output", async () => {
	const h = harness();
	await developerV7(h.api);
	await h.emit("session_start", { reason: "new" });
	await h.emit("before_agent_start", {
		systemPrompt: "base",
		systemPromptOptions: { skills, contextFiles: [] },
	});
	await h.commands.get("developer").handler("on", h.ctx);
	const opened = await h.tools.get(OPEN_JUDGMENT_TOOL).execute(
		"call-open-sketch",
		{
			skill_name: "sketch",
			question: "What exact conversion surface should be implemented?",
			reason: "The data flow and caller shape need one implementable design.",
			known_evidence: ["The requested conversion is pure."],
		},
		undefined,
		undefined,
		h.ctx,
	);
	assert.ok(opened.content[0].text.length <= 64_000);
	assert.match(opened.content[0].text, /Judgment ID: judgment:/u);
});

test("v7 registers four split tools and exposes only legal next operations", async () => {
	const h = harness();
	await developerV7(h.api);
	assert.deepEqual(
		[...h.tools.keys()].sort(),
		[
			AUTHORIZE_CHANGE_TOOL,
			CONCLUDE_JUDGMENT_TOOL,
			OPEN_JUDGMENT_TOOL,
			RECORD_LANDING_TOOL,
		].sort(),
	);
	await h.emit("session_start", { reason: "new" });
	await h.emit("before_agent_start", {
		systemPrompt: "base",
		systemPromptOptions: { skills, contextFiles: [] },
	});
	await h.commands.get("developer").handler("on", h.ctx);
	assert.equal(h.activeTools().includes(OPEN_JUDGMENT_TOOL), true);
	assert.equal(h.activeTools().includes(AUTHORIZE_CHANGE_TOOL), true);
	assert.equal(h.activeTools().includes(CONCLUDE_JUDGMENT_TOOL), false);
	assert.equal(h.activeTools().includes("edit"), false);

	const opened = await h.tools.get(OPEN_JUDGMENT_TOOL).execute(
		"call-open",
		{
			skill_name: "specify",
			question: "What compatibility behavior must remain?",
			reason: "The implementation request leaves compatibility ambiguous.",
			known_evidence: ["The old format remains persisted."],
		},
		undefined,
		undefined,
		h.ctx,
	);
	assert.match(opened.content[0].text, /Judgment ID: judgment:/u);
	assert.match(opened.content[0].text, /Dynamic question:/u);
	assert.match(
		opened.content[0].text,
		/Policy: absent \(normal complete skill\)/u,
	);
	assert.match(opened.content[0].text, /Pi-visible context inventory/u);
	assert.equal(opened.details.kind, "judgment-opened");
	const protocolTools = new Set<string>([
		OPEN_JUDGMENT_TOOL,
		CONCLUDE_JUDGMENT_TOOL,
		AUTHORIZE_CHANGE_TOOL,
		RECORD_LANDING_TOOL,
	]);
	assert.deepEqual(
		h.activeTools().filter((name) => protocolTools.has(name)),
		[CONCLUDE_JUDGMENT_TOOL],
	);
	assert.equal(h.activeTools().includes("bash"), true);
	assert.equal(h.activeTools().includes("edit"), false);

	const judgmentId = opened.details.judgment.judgmentId;
	const concluded = await h.tools.get(CONCLUDE_JUDGMENT_TOOL).execute(
		"call-conclude",
		{
			judgment_id: judgmentId,
			disposition: "not-applicable",
			not_applicable_reason:
				"The user request already states exact compatibility behavior.",
			not_applicable_basis: ["The request explicitly preserves old records."],
			produced_artifacts: [],
			opened_questions: [],
			question_updates: [],
		},
		undefined,
		undefined,
		h.ctx,
	);
	assert.equal(concluded.details.kind, "judgment-concluded");
	assert.equal(h.activeTools().includes(AUTHORIZE_CHANGE_TOOL), true);

	const authorized = await h.tools.get(AUTHORIZE_CHANGE_TOOL).execute(
		"call-change",
		{
			question: "Preserve old records while parsing the new format.",
			reason: "Meaning and implementation framing are settled.",
			movement: "Add one exact parser branch.",
			stable_landing: "Both persisted representations parse to one value.",
			verification_target: "Old and new fixtures produce the same value.",
		},
		undefined,
		undefined,
		h.ctx,
	);
	assert.equal(authorized.details.kind, "change-authorized");
	assert.equal(h.activeTools().includes(RECORD_LANDING_TOOL), true);
	assert.equal(h.activeTools().includes("edit"), true);
	assert.equal(h.activeTools().includes(OPEN_JUDGMENT_TOOL), false);

	const landing = await h.tools.get(RECORD_LANDING_TOOL).execute(
		"call-land",
		{
			authorization_id: authorized.details.change.authorizationId,
			changed_paths: ["src/parser.ts"],
			result: "Both formats parse to the same domain value.",
			verification: ["Focused parser fixtures pass."],
		},
		undefined,
		undefined,
		h.ctx,
	);
	assert.equal(landing.details.kind, "landing-recorded");
	assert.equal(h.activeTools().includes(OPEN_JUDGMENT_TOOL), true);
	assert.equal(h.activeTools().includes(AUTHORIZE_CHANGE_TOOL), false);
	assert.equal(h.activeTools().includes("edit"), false);
});

test("one conclusion maps nomination identities into sealed coverage and user authority", async () => {
	const h = harness();
	await developerV7(h.api);
	await h.emit("session_start", { reason: "new" });
	await h.emit("before_agent_start", {
		systemPrompt: "base",
		systemPromptOptions: { skills, contextFiles: [] },
	});
	await h.commands.get("developer").handler("on", h.ctx);
	const opened = await h.tools.get(OPEN_JUDGMENT_TOOL).execute(
		"call-context-open",
		{
			skill_name: "specify",
			question: "What compatibility behavior must remain?",
			reason: "The product contract needs an explicit owner decision.",
			known_evidence: [],
		},
		undefined,
		undefined,
		h.ctx,
	);
	h.setBranch([
		...h.entries,
		{
			id: "user-event-policy",
			type: "message",
			message: {
				role: "user",
				content: "Old persisted records must remain readable.",
			},
		},
	]);
	const conclusion = await h.tools.get(CONCLUDE_JUDGMENT_TOOL).execute(
		"call-context-conclude",
		{
			judgment_id: opened.details.judgment.judgmentId,
			disposition: "judgment",
			applicability: {
				kind: "applicable",
				basis: ["The user owns persisted compatibility policy."],
			},
			nominations: [
				{
					nominationId: "compatibility-decision",
					kind: "user-decision",
					userEventId: "user-event-policy",
				},
			],
			selection_basis: [
				"The explicit user event settles the compatibility decision.",
			],
			coverage: {
				status: "sufficient",
				contributions: [
					{
						nominationId: "compatibility-decision",
						useAs: "decision",
						contribution:
							"The user requires old persisted records to remain readable.",
						assurance: "user-accepted",
						userEventId: "user-event-policy",
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
						artifactEffect: "The contract requires reading old records.",
					},
				],
				rationale: "The explicit user decision controls compatibility.",
				artifact:
					"Old and new persisted records must parse to the same domain value.",
				stopEvidence: ["The compatibility obligation has an explicit owner."],
			},
			produced_artifacts: ["docs/compatibility-contract.md"],
			opened_questions: [],
			question_updates: [],
		},
		undefined,
		undefined,
		h.ctx,
	);
	assert.equal(conclusion.details.conclusion.kind, "contextual-judgment");
	assert.equal(
		conclusion.details.conclusion.contextBasis.contributions[0].assurance,
		"user-accepted",
	);
	assert.match(
		conclusion.details.conclusion.contextBasis.contextBasisSha256,
		/^[a-f0-9]{64}$/u,
	);
});

test("failed context nomination reports exact compact branch result IDs", async () => {
	const h = harness();
	await developerV7(h.api);
	await h.emit("session_start", { reason: "new" });
	await h.emit("before_agent_start", {
		systemPrompt: "base",
		systemPromptOptions: { skills, contextFiles: [] },
	});
	await h.commands.get("developer").handler("on", h.ctx);
	const opened = await h.tools.get(OPEN_JUDGMENT_TOOL).execute(
		"call-context-list-open",
		{
			skill_name: "specify",
			question: "What compatibility behavior must remain?",
			reason: "Repository evidence is required.",
		},
		undefined,
		undefined,
		h.ctx,
	);
	h.setBranch([
		...h.entries,
		{
			id: "assistant-tool-call",
			type: "message",
			message: {
				role: "assistant",
				content: [
					{
						type: "toolCall",
						id: "call-exact-read",
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
				toolCallId: "call-exact-read",
				toolName: "read",
				isError: false,
				content: [{ type: "text", text: "Observed contract." }],
			},
		},
	]);
	const projected = await h.emit("context", { messages: [] });
	if (typeof projected !== "object" || projected === null) {
		assert.fail("Expected projected Developer context");
	}
	const projectedMessages = Reflect.get(projected, "messages");
	assert.ok(Array.isArray(projectedMessages));
	assert.match(
		String(Reflect.get(projectedMessages[0], "content")),
		/branch-result-[a-f0-9]{16} · read · success/u,
	);
	await assert.rejects(
		() =>
			h.tools.get(CONCLUDE_JUDGMENT_TOOL).execute(
				"call-context-list-conclude",
				{
					judgment_id: opened.details.judgment.judgmentId,
					disposition: "judgment",
					applicability: {
						kind: "applicable",
						basis: ["Repository evidence is consequential."],
					},
					nominations: [
						{
							nominationId: "missing-read",
							kind: "tool-result",
							branchResultId: "branch-result-deadbeefdeadbeef",
						},
					],
					selection_basis: ["Use the inspected contract."],
					coverage: {
						status: "needs-evidence",
						contributions: [
							{
								nominationId: "missing-read",
								useAs: "evidence",
								contribution: "The exact read would constrain compatibility.",
								assurance: "agent-asserted",
							},
						],
						conflicts: [],
						limitations: [
							{
								nominationIds: [],
								description: "The exact read result is not selected.",
							},
						],
					},
					outcome: {
						kind: "needs-evidence",
						evidenceNeeded: ["Use the exact read result."],
						resolutionOwner: "agent",
					},
				},
				undefined,
				undefined,
				h.ctx,
			),
		/Available branch result IDs:[^]*branch-result-[a-f0-9]{16} · read · success/u,
	);
});

test("v6 branch history is diagnosed and never reconstructed as v7 work", async () => {
	const h = harness();
	h.setBranch([
		{
			type: "message",
			message: {
				role: "toolResult",
				toolName: "developer_route_question",
				details: { protocol: "developer/v6", kind: "route" },
			},
		},
	]);
	await developerV7(h.api);
	await h.emit("session_start", { reason: "resume" });
	const before = (await h.emit("before_agent_start", {
		systemPrompt: "base",
		systemPromptOptions: { skills, contextFiles: [] },
	})) as { systemPrompt?: string } | undefined;
	assert.equal(before, undefined, "unsupported v6 history must not enable v7");
	await h.commands.get("developer").handler("on", h.ctx);
	const injected = (await h.emit("before_agent_start", {
		systemPrompt: "base",
		systemPromptOptions: { skills, contextFiles: [] },
	})) as { systemPrompt: string };
	assert.match(
		injected.systemPrompt,
		/unsupported.*v6|v6 history is unsupported/iu,
	);
});
