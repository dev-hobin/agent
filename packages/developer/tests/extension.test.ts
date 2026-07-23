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
import { JUDGMENT_TOOL, ROUTE_TOOL } from "../extensions/state.ts";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const loadedLeaves = loadSkillsFromDir({
	dir: join(packageRoot, "skills"),
	source: "@hobin/developer",
}).skills;

initTheme(undefined, false);

function createHarness() {
	const handlers = new Map<string, Array<(event: any, ctx: any) => any>>();
	const tools = new Map<string, any>();
	const commands = new Map<string, any>();
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
	let confirmResult = true;
	let customCalls = 0;
	const customOptions: unknown[] = [];
	let editorText = "";
	let activeTools = ["read", "edit", "write", "bash"];

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
			return undefined;
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
		getEditorText() {
			return editorText;
		},
		setEditorText(value: string) {
			editorText = value;
		},
	};
	const ctx = {
		mode: "print",
		ui,
		isIdle: () => true,
		sessionManager: { getBranch: () => [] },
	};

	return {
		api,
		tools,
		commands,
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
		customCalls: () => customCalls,
		customOptions,
		editorText: () => editorText,
		activeTools: () => [...activeTools],
		setActiveTools(names: string[]) {
			activeTools = [...names];
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

function agentOpenQuestion(question: string) {
	return {
		question,
		status: "open" as const,
		resolution_owner: "agent" as const,
		gate: "none" as const,
		resolution_criteria: `Obtain concrete evidence that settles: ${question}`,
	};
}

function renderedText(component: { render(width: number): string[] }): string {
	return component.render(10_000).join("\n");
}

async function startHarness(loadedSkills: Skill[] = loadedLeaves) {
	const harness = createHarness();
	await developer(harness.api);
	await harness.emit("session_start", {
		type: "session_start",
		reason: "startup",
	});
	await harness.commands.get("develop").handler("on", harness.ctx);
	await harness.emit("before_agent_start", {
		type: "before_agent_start",
		prompt: "test",
		systemPrompt: "base",
		systemPromptOptions: { cwd: packageRoot, skills: loadedSkills },
	});
	return harness;
}

test("tool contract failures throw so Pi records them as errors", async () => {
	const harness = createHarness();
	await developer(harness.api);
	await harness.emit("session_start", {
		type: "session_start",
		reason: "startup",
	});
	const route = harness.tools.get(ROUTE_TOOL);

	await assert.rejects(
		route.execute(
			"off",
			{ question: "Q", target: "implementation", reason: "R" },
			undefined,
			undefined,
			harness.ctx,
		),
		/protocol is off/,
	);

	await harness.commands.get("develop").handler("on", harness.ctx);
	await harness.emit("before_agent_start", {
		type: "before_agent_start",
		prompt: "test",
		systemPrompt: "base",
		systemPromptOptions: { cwd: packageRoot, skills: loadedLeaves },
	});
	const opened = await route.execute(
		"valid",
		{
			question: "What must be true?",
			target: "specify",
			reason: "Product meaning is unclear",
		},
		undefined,
		undefined,
		harness.ctx,
	);
	assert.match(opened.content[0].text.slice(0, 2_000), /Route ID: route:valid/);
	assert.match(
		opened.content[0].text.slice(0, 2_000),
		/developer_record_judgment/,
	);
	assert.match(
		opened.content[0].text,
		/<developer-method name="specify" location="[^"]+" base-dir="[^"]+">/,
	);
	await assert.rejects(
		route.execute(
			"overlap",
			{
				question: "Can another route start?",
				target: "implementation",
				reason: "Testing route ownership",
			},
			undefined,
			undefined,
			harness.ctx,
		),
		/is still active/,
	);

	const judgment = harness.tools.get(JUDGMENT_TOOL);
	await assert.rejects(
		judgment.execute(
			"wrong",
			{
				route_id: "route:wrong",
				status: "resolved",
				result: "Done",
				basis: ["Evidence"],
			},
			undefined,
			undefined,
			harness.ctx,
		),
		/Route ID mismatch/,
	);
});

test("concurrent route attempts cannot overwrite a route that is still opening", async () => {
	const harness = await startHarness();
	const route = harness.tools.get(ROUTE_TOOL);
	const opening = route.execute(
		"opening",
		{
			question: "What must be true?",
			target: "specify",
			reason: "Product meaning is unclear",
		},
		undefined,
		undefined,
		harness.ctx,
	);
	await assert.rejects(
		route.execute(
			"overlap",
			{
				question: "Can implementation work start too?",
				target: "implementation",
				reason: "Testing concurrent ownership",
			},
			undefined,
			undefined,
			harness.ctx,
		),
		/currently opening|still active/,
	);
	const opened = await opening;
	assert.equal(opened.details.routeId, "route:opening");
});

test("oversized route output fails before protocol state is mutated", async () => {
	const harness = await startHarness();
	const route = harness.tools.get(ROUTE_TOOL);
	await assert.rejects(
		route.execute(
			"oversized",
			{
				question: "x".repeat(60_000),
				target: "implementation",
				reason: "The action is otherwise justified",
			},
			undefined,
			undefined,
			harness.ctx,
		),
		/exceeds Pi's tool-output limit/,
	);

	const opened = await route.execute(
		"after-oversized",
		{
			question: "Can a valid route still open?",
			target: "implementation",
			reason: "The failed result was atomic",
		},
		undefined,
		undefined,
		harness.ctx,
	);
	assert.equal(opened.details.routeId, "route:after-oversized");
});

test("oversized judgment output leaves the active route available for a valid retry", async () => {
	const harness = await startHarness();
	const route = await harness.tools.get(ROUTE_TOOL).execute(
		"judgment-output",
		{
			question: "Record a bounded result",
			target: "implementation",
			reason: "The local action is justified",
		},
		undefined,
		undefined,
		harness.ctx,
	);
	const judgment = harness.tools.get(JUDGMENT_TOOL);
	await assert.rejects(
		judgment.execute(
			"oversized-judgment",
			{
				route_id: route.details.routeId,
				status: "resolved",
				result: "x".repeat(60_000),
				basis: ["Observed evidence"],
			},
			undefined,
			undefined,
			harness.ctx,
		),
		/exceeds Pi's tool-output limit/,
	);

	const recorded = await judgment.execute(
		"bounded-judgment",
		{
			route_id: route.details.routeId,
			status: "resolved",
			result: "The bounded result is recorded.",
			basis: ["Observed evidence"],
		},
		undefined,
		undefined,
		harness.ctx,
	);
	assert.equal(recorded.details.status, "resolved");
});

test("a judgment cannot commit an unbounded pending-question set", async () => {
	const harness = await startHarness();
	const route = await harness.tools.get(ROUTE_TOOL).execute(
		"pending-limit",
		{
			question: "Which questions remain?",
			target: "implementation",
			reason: "The evidence has been inspected",
		},
		undefined,
		undefined,
		harness.ctx,
	);
	const judgment = harness.tools.get(JUDGMENT_TOOL);
	await assert.rejects(
		judgment.execute(
			"too-many-pending",
			{
				route_id: route.details.routeId,
				status: "needs-evidence",
				result: "Too many separate questions were proposed.",
				basis: [],
				open_questions: Array.from({ length: 21 }, (_, index) =>
					agentOpenQuestion(`Question ${index + 1}`),
				),
			},
			undefined,
			undefined,
			harness.ctx,
		),
		/pending questions; resolve or consolidate/,
	);

	const recorded = await judgment.execute(
		"bounded-pending",
		{
			route_id: route.details.routeId,
			status: "needs-evidence",
			result: "One question remains.",
			basis: [],
			open_questions: [agentOpenQuestion("What evidence is missing?")],
		},
		undefined,
		undefined,
		harness.ctx,
	);
	assert.equal(recorded.details.openedQuestions.length, 1);
});

test("a Pi-filtered leaf cannot be routed even though it exists in the package", async () => {
	const harness = await startHarness([]);
	await assert.rejects(
		harness.tools.get(ROUTE_TOOL).execute(
			"filtered",
			{
				question: "What must be true?",
				target: "specify",
				reason: "Need a contract",
			},
			undefined,
			undefined,
			harness.ctx,
		),
		/unavailable or disabled/,
	);
});

test("implementation profiles load only the protocol selected for that action", async () => {
	const ordinaryHarness = await startHarness();
	const ordinary = await ordinaryHarness.tools.get(ROUTE_TOOL).execute(
		"ordinary-implementation",
		{
			question: "Apply the already-justified generated-file update",
			target: "implementation",
			reason: "The output and verifier are already fixed",
		},
		undefined,
		undefined,
		ordinaryHarness.ctx,
	);
	assert.equal(ordinary.details.executionProfile, "ordinary");
	assert.doesNotMatch(
		ordinary.content[0].text,
		/Smallest Green Transformation/,
	);

	const structuralHarness = await startHarness();
	const structural = await structuralHarness.tools.get(ROUTE_TOOL).execute(
		"structural-implementation",
		{
			question: "Move the accepted responsibility without changing behavior",
			target: "implementation",
			reason:
				"Signal and abstraction review already justified one structural move",
			execution_profile: "behavior-preserving-structure",
		},
		undefined,
		undefined,
		structuralHarness.ctx,
	);
	assert.equal(
		structural.details.executionProfile,
		"behavior-preserving-structure",
	);
	assert.match(
		structural.content[0].text,
		/<developer-implementation-profile name="behavior-preserving-structure">/,
	);
	assert.match(structural.content[0].text, /## Smallest Green Transformation/);
	assert.match(structural.content[0].text, /## Stable Landing/);
	assert.match(structural.content[0].text, /99 Bottles of OOP/);
});

test("route schema exposes execution profiles only on the implementation branch", async () => {
	const harness = createHarness();
	await developer(harness.api);
	const schema = harness.tools.get(ROUTE_TOOL).parameters;
	assert.equal(schema.anyOf.length, 2);

	const skillBranch = schema.anyOf.find(
		(branch: any) => branch.properties.target.pattern,
	);
	const implementationBranch = schema.anyOf.find(
		(branch: any) => branch.properties.target.const === "implementation",
	);
	assert.ok(skillBranch);
	assert.ok(implementationBranch);
	assert.equal(skillBranch.additionalProperties, false);
	assert.equal(skillBranch.properties.execution_profile, undefined);
	assert.equal(implementationBranch.additionalProperties, false);
	assert.ok(implementationBranch.required.includes("movement"));
	assert.ok(implementationBranch.required.includes("stop_condition"));
	assert.ok(implementationBranch.required.includes("verification"));
	assert.ok(implementationBranch.properties.alternatives_considered);
	assert.equal(skillBranch.properties.alternatives_considered, undefined);
	assert.equal(
		implementationBranch.properties.execution_profile.const,
		"behavior-preserving-structure",
	);
});

test("judgment schema classifies open questions and supports cross-route question updates", async () => {
	const harness = createHarness();
	await developer(harness.api);
	const schema = harness.tools.get(JUDGMENT_TOOL).parameters;
	const openQuestion = schema.properties.open_questions.items;
	assert.ok(openQuestion.required.includes("resolution_owner"));
	assert.ok(openQuestion.required.includes("gate"));
	assert.ok(openQuestion.required.includes("resolution_criteria"));
	assert.equal(openQuestion.required.includes("context"), false);
	assert.equal(openQuestion.properties.context.maxLength, 8_000);
	assert.equal(openQuestion.required.includes("response_spec"), false);
	assert.match(
		openQuestion.properties.response_spec.description,
		/finite user-owned decisions/,
	);
	assert.equal(
		openQuestion.properties.response_spec.properties.kind.const,
		"choice-form",
	);
	assert.equal(
		openQuestion.properties.response_spec.properties.fields.minItems,
		1,
	);
	assert.equal(
		openQuestion.properties.response_spec.properties.fields.maxItems,
		20,
	);
	assert.equal(
		openQuestion.properties.response_spec.properties.fields.items.properties
			.options.minItems,
		2,
	);
	assert.deepEqual(openQuestion.properties.resolution_owner.enum, [
		"agent",
		"user",
		"environment",
	]);
	assert.deepEqual(openQuestion.properties.gate.enum, [
		"none",
		"before-implementation",
		"before-completion",
	]);
	assert.ok(
		schema.properties.question_updates.items.required.includes("question_id"),
	);
	assert.match(
		harness.tools.get(JUDGMENT_TOOL).promptGuidelines.join("\n"),
		/choice-form response_spec with one field per decision/,
	);
});

test("choice response specs are canonicalized and invalid producer contracts do not mutate judgment state", async () => {
	const harness = await startHarness();
	const route = await harness.tools.get(ROUTE_TOOL).execute(
		"choice-response-route",
		{
			question: "Which empty-state policy applies?",
			target: "specify",
			reason: "The product owner must choose one explicit policy",
		},
		undefined,
		undefined,
		harness.ctx,
	);
	const openQuestion = {
		question: "Should empty mean absent or explicitly cleared?",
		context:
			"Choose absent to omit the field, or explicitly cleared to preserve a user reset.",
		status: "open" as const,
		resolution_owner: "user" as const,
		gate: "before-implementation" as const,
		resolution_criteria: "The product owner selects one policy.",
		response_spec: {
			kind: "choice-form" as const,
			fields: [
				{
					id: "A",
					prompt: "Choose the empty-state policy",
					options: [
						{ value: "A1", label: "Absent" },
						{
							value: "A2",
							label: "Explicitly cleared",
							detail_prompt: "Describe the clearing signal.",
						},
					],
				},
			],
		},
	};
	const recorded = await harness.tools.get(JUDGMENT_TOOL).execute(
		"choice-response-judgment",
		{
			route_id: route.details.routeId,
			status: "needs-evidence",
			result: "An explicit product decision is required.",
			basis: [],
			open_questions: [openQuestion],
		},
		undefined,
		undefined,
		harness.ctx,
	);

	assert.deepEqual(recorded.details.openedQuestions[0].responseSpec, {
		kind: "choice-form",
		fields: [
			{
				id: "A",
				prompt: "Choose the empty-state policy",
				description: undefined,
				options: [
					{
						value: "A1",
						label: "Absent",
						description: undefined,
						detailPrompt: undefined,
					},
					{
						value: "A2",
						label: "Explicitly cleared",
						description: undefined,
						detailPrompt: "Describe the clearing signal.",
					},
				],
			},
		],
	});

	const invalidHarness = await startHarness();
	const invalidRoute = await invalidHarness.tools.get(ROUTE_TOOL).execute(
		"invalid-choice-response-route",
		{
			question: "Can this structured question be recorded?",
			target: "specify",
			reason: "The question contract must be validated before persistence",
		},
		undefined,
		undefined,
		invalidHarness.ctx,
	);
	const invalidParams = {
		route_id: invalidRoute.details.routeId,
		status: "needs-evidence",
		result: "A user answer is required.",
		basis: [],
		open_questions: [
			{
				...openQuestion,
				response_spec: {
					...openQuestion.response_spec,
					fields: [
						{
							...openQuestion.response_spec.fields[0],
							options: [
								{ value: "same", label: "First" },
								{ value: "same", label: "Second" },
							],
						},
					],
				},
			},
		],
	};
	await assert.rejects(
		invalidHarness.tools
			.get(JUDGMENT_TOOL)
			.execute(
				"invalid-duplicate-values",
				invalidParams,
				undefined,
				undefined,
				invalidHarness.ctx,
			),
		/unique field IDs and unique option values/,
	);
	await assert.rejects(
		invalidHarness.tools.get(JUDGMENT_TOOL).execute(
			"invalid-non-user-spec",
			{
				...invalidParams,
				open_questions: [
					{
						...openQuestion,
						resolution_owner: "agent",
					},
				],
			},
			undefined,
			undefined,
			invalidHarness.ctx,
		),
		/valid only for user-owned questions/,
	);
	await assert.rejects(
		invalidHarness.tools.get(JUDGMENT_TOOL).execute(
			"invalid-missing-decision-context",
			{
				...invalidParams,
				open_questions: [{ ...openQuestion, context: "   " }],
			},
			undefined,
			undefined,
			invalidHarness.ctx,
		),
		/require non-whitespace context that explains the decision/,
	);
	assert.equal(
		invalidHarness.entries.filter((entry) => entry.customType === JUDGMENT_TOOL)
			.length,
		0,
	);
});

test("resolved and not-applicable judgments can preserve distinct follow-up questions", async () => {
	const resolvedHarness = await startHarness();
	const resolvedRoute = await resolvedHarness.tools.get(ROUTE_TOOL).execute(
		"resolved-follow-up",
		{
			question: "Is the current conversion contract settled?",
			target: "specify",
			reason:
				"The current contract and later migration work are separate judgments",
		},
		undefined,
		undefined,
		resolvedHarness.ctx,
	);
	const resolvedJudgment = await resolvedHarness.tools
		.get(JUDGMENT_TOOL)
		.execute(
			"resolved-follow-up-close",
			{
				route_id: resolvedRoute.details.routeId,
				status: "resolved",
				result: "The current conversion contract is settled.",
				basis: ["Current callers agree on the contract."],
				open_questions: [
					agentOpenQuestion("Which legacy migration should happen later?"),
				],
			},
			undefined,
			undefined,
			resolvedHarness.ctx,
		);

	const notApplicableHarness = await startHarness();
	const notApplicableRoute = await notApplicableHarness.tools
		.get(ROUTE_TOOL)
		.execute(
			"not-applicable-follow-up",
			{
				question: "Does the current conversion require a compatibility shim?",
				target: "specify",
				reason:
					"The current shim and later migration work are separate judgments",
			},
			undefined,
			undefined,
			notApplicableHarness.ctx,
		);
	const notApplicableJudgment = await notApplicableHarness.tools
		.get(JUDGMENT_TOOL)
		.execute(
			"not-applicable-follow-up-close",
			{
				route_id: notApplicableRoute.details.routeId,
				status: "not-applicable",
				result: "The current conversion does not require a compatibility shim.",
				basis: ["Current callers already use the accepted representation."],
				open_questions: [
					agentOpenQuestion("Which legacy migration should happen later?"),
				],
			},
			undefined,
			undefined,
			notApplicableHarness.ctx,
		);

	assert.equal(resolvedJudgment.details.status, "resolved");
	assert.equal(notApplicableJudgment.details.status, "not-applicable");
	assert.equal(
		resolvedJudgment.details.openedQuestions[0].question,
		"Which legacy migration should happen later?",
	);
	assert.equal(
		notApplicableJudgment.details.openedQuestions[0].question,
		"Which legacy migration should happen later?",
	);
});

test("a resolved judgment cannot reopen its own question", async () => {
	const harness = await startHarness();
	const routed = await harness.tools.get(ROUTE_TOOL).execute(
		"self-reopen",
		{
			question: "Can this conversion contract ship?",
			target: "verify",
			reason: "The shipping claim is under review",
		},
		undefined,
		undefined,
		harness.ctx,
	);

	await assert.rejects(
		harness.tools.get(JUDGMENT_TOOL).execute(
			"self-reopen-close",
			{
				route_id: routed.details.routeId,
				status: "resolved",
				result: "The conversion contract can ship.",
				basis: ["The contract tests pass."],
				open_questions: [
					agentOpenQuestion("CAN this conversion contract ship?"),
				],
			},
			undefined,
			undefined,
			harness.ctx,
		),
		/cannot reopen its own question/,
	);
});

test("skill routes reject implementation profiles", async () => {
	const harness = await startHarness();
	await assert.rejects(
		harness.tools.get(ROUTE_TOOL).execute(
			"profile-on-skill",
			{
				question: "What must be true?",
				target: "specify",
				reason: "Product meaning is unclear",
				execution_profile: "behavior-preserving-structure",
			},
			undefined,
			undefined,
			harness.ctx,
		),
		/execution_profile is valid only when target=implementation/,
	);
});

test("the protocol prompt lists only skills Pi made available", async () => {
	const specify = loadedLeaves.find((skill) => skill.name === "specify")!;
	const harness = createHarness();
	await developer(harness.api);
	await harness.emit("session_start", {
		type: "session_start",
		reason: "startup",
	});
	await harness.commands.get("develop").handler("on", harness.ctx);
	const result = await harness.emit("before_agent_start", {
		type: "before_agent_start",
		prompt: "test",
		systemPrompt: "base",
		systemPromptOptions: { cwd: packageRoot, skills: [specify] },
	});

	assert.match(result.systemPrompt, /Available Developer skills: specify\./);
	assert.match(
		result.systemPrompt,
		/choice-form response_spec with one field per decision/,
	);
	assert.doesNotMatch(
		result.systemPrompt,
		/Available Developer skills:.*model/,
	);
});

test("a later turn can recover the active leaf method from its canonical location", async () => {
	const harness = await startHarness();
	await harness.tools.get(ROUTE_TOOL).execute(
		"recoverable",
		{
			question: "What must be true?",
			target: "specify",
			reason: "Product meaning is unclear",
		},
		undefined,
		undefined,
		harness.ctx,
	);
	const result = await harness.emit("before_agent_start", {
		type: "before_agent_start",
		prompt: "continue",
		systemPrompt: "base",
		systemPromptOptions: { cwd: packageRoot, skills: loadedLeaves },
	});

	assert.match(
		result.systemPrompt,
		/Active skill location: .*specify\/SKILL\.md/,
	);
	assert.match(result.systemPrompt, /Read it again if compaction/);
});

test("leaf routing remains adaptive rather than enforcing a phase order", async () => {
	const harness = await startHarness();
	const route = harness.tools.get(ROUTE_TOOL);
	const judgment = harness.tools.get(JUDGMENT_TOOL);
	const verifyFirst = await route.execute(
		"verify-first",
		{
			question: "Does current evidence support the claim?",
			target: "verify",
			reason: "A claim already exists",
		},
		undefined,
		undefined,
		harness.ctx,
	);
	await judgment.execute(
		"verify-close",
		{
			route_id: verifyFirst.details.routeId,
			status: "resolved",
			result: "The claim is supported.",
			basis: ["Observed test output"],
		},
		undefined,
		undefined,
		harness.ctx,
	);
	const modelSecond = await route.execute(
		"model-second",
		{
			question: "Which condition distinguishes absence from empty?",
			target: "model",
			reason: "A new state question appeared",
		},
		undefined,
		undefined,
		harness.ctx,
	);

	assert.equal(verifyFirst.details.target, "verify");
	assert.equal(modelSecond.details.target, "model");
});

test("resolved model work must pass through sketch or signal before implementation mutation", async () => {
	const harness = await startHarness();
	const route = harness.tools.get(ROUTE_TOOL);
	const judgment = harness.tools.get(JUDGMENT_TOOL);
	const modeled = await route.execute(
		"model-feature",
		{
			question: "Which feature cases must the implementation support?",
			target: "model",
			reason: "The feature has consequential variants",
		},
		undefined,
		undefined,
		harness.ctx,
	);
	await judgment.execute(
		"model-feature-close",
		{
			route_id: modeled.details.routeId,
			status: "resolved",
			result: "The implementation cases are explicit.",
			basis: ["A representative case table was derived."],
		},
		undefined,
		undefined,
		harness.ctx,
	);
	const framingWidget = harness.widgets.at(-1)?.value as string[];
	assert.ok(
		framingWidget.includes(
			"gate · frame implementation before mutation (sketch or signal)",
		),
	);
	assert.equal(
		framingWidget.some((line) => line.startsWith("next · sketch")),
		false,
	);
	const framingPrompt = await harness.emit("before_agent_start", {
		type: "before_agent_start",
		prompt: "test",
		systemPrompt: "base",
		systemPromptOptions: { cwd: packageRoot, skills: loadedLeaves },
	});
	assert.match(framingPrompt.systemPrompt, /Implementation gate:/);
	assert.doesNotMatch(framingPrompt.systemPrompt, /Required next framing/);

	await assert.rejects(
		route.execute(
			"premature-implementation",
			{
				question: "Implement the feature",
				target: "implementation",
				reason: "The cases are known",
				movement: "Add the first feature path",
				stop_condition: "The first path is green and reviewable",
				verification: "Run its focused test",
			},
			undefined,
			undefined,
			harness.ctx,
		),
		/requires implementation framing/,
	);

	const sketched = await route.execute(
		"feature-sketch",
		{
			question: "What is the first implementable feature surface?",
			target: "sketch",
			reason: "New behavior needs an initial implementation shape",
		},
		undefined,
		undefined,
		harness.ctx,
	);
	await judgment.execute(
		"feature-sketch-close",
		{
			route_id: sketched.details.routeId,
			status: "resolved",
			result: "The first interface and check are explicit.",
			basis: ["The sketch derives from the modeled cases."],
		},
		undefined,
		undefined,
		harness.ctx,
	);
	const implementation = await route.execute(
		"framed-implementation",
		{
			question: "Implement the first sketched item",
			target: "implementation",
			reason: "Its movement and stop check are now explicit",
			movement: "Add the first wished interface implementation",
			stop_condition: "The focused case is green and the diff has one purpose",
			verification: "Run the focused representative-case test",
		},
		undefined,
		undefined,
		harness.ctx,
	);
	assert.equal(
		implementation.details.implementationStep.movement,
		"Add the first wished interface implementation",
	);
});

test("a changed implementation landing creates verification debt", async () => {
	const harness = await startHarness();
	const implementation = await harness.tools.get(ROUTE_TOOL).execute(
		"changed-implementation",
		{
			question: "Apply one local change",
			target: "implementation",
			reason: "The step is justified",
			movement: "Change one caller",
			stop_condition: "The caller is green and reviewable",
			verification: "Run the caller test",
		},
		undefined,
		undefined,
		harness.ctx,
	);
	await harness.emit("tool_call", {
		toolName: "edit",
		input: {},
		toolCallId: "edit:1",
	});
	const recorded = await harness.tools.get(JUDGMENT_TOOL).execute(
		"changed-implementation-close",
		{
			route_id: implementation.details.routeId,
			status: "resolved",
			result: "The caller reached its stable landing.",
			basis: ["The focused caller test passes."],
		},
		undefined,
		undefined,
		harness.ctx,
	);
	assert.equal(recorded.details.changedArtifacts, true);
	assert.match(
		recorded.content[0].text,
		/verify is required before claiming completion/,
	);
	await harness.commands.get("develop").handler("status", harness.ctx);
	const status = harness.notifications.at(-1)?.message ?? "";
	assert.match(status, /developer: on · target: none · needs-routing/);
	assert.match(status, /checkpoint: reroute required/);
	assert.match(status, /verification: required/);
});

test("implementation evidence can resolve an unfocused agent question through question_updates", async () => {
	const harness = await startHarness();
	const route = harness.tools.get(ROUTE_TOOL);
	const judgment = harness.tools.get(JUDGMENT_TOOL);
	const evidenceRoute = await route.execute(
		"evidence-question",
		{
			question: "Does the empty schedule preserve absence?",
			target: "verify",
			reason: "No focused implementation evidence exists yet",
		},
		undefined,
		undefined,
		harness.ctx,
	);
	const opened = await judgment.execute(
		"evidence-open",
		{
			route_id: evidenceRoute.details.routeId,
			status: "needs-evidence",
			result: "A focused implementation test is still needed.",
			basis: [],
			open_questions: [
				agentOpenQuestion("Does the empty schedule preserve absence?"),
			],
		},
		undefined,
		undefined,
		harness.ctx,
	);
	const questionId = opened.details.openedQuestions[0].id;

	const implementationRoute = await route.execute(
		"implementation-route",
		{
			question: "Implement the accepted schedule conversion",
			target: "implementation",
			reason: "The conversion contract is already explicit",
			movement: "Add the empty-schedule conversion",
			stop_condition: "The focused conversion test is green",
			verification: "Run the focused conversion test",
		},
		undefined,
		undefined,
		harness.ctx,
	);
	const implemented = await judgment.execute(
		"implementation-close",
		{
			route_id: implementationRoute.details.routeId,
			status: "resolved",
			result: "The conversion is implemented and its focused test passes.",
			basis: ["The focused conversion test passes."],
			question_updates: [
				{
					question_id: questionId,
					status: "resolved",
					result: "The empty schedule preserves absence.",
					basis: ["The focused conversion test observes absence."],
				},
			],
		},
		undefined,
		undefined,
		harness.ctx,
	);

	assert.equal(implemented.details.questionUpdates[0].questionId, questionId);
	harness.ctx.mode = "tui";
	await harness.commands.get("develop").handler("questions", harness.ctx);
	assert.equal(
		harness.notifications.at(-1)?.message,
		"Developer has no open questions on the current branch.",
	);
});

test("consecutive implementation routing records prior evidence and reconsidered skill routes without banning implementation", async () => {
	const harness = await startHarness();
	const route = harness.tools.get(ROUTE_TOOL);
	const judgment = harness.tools.get(JUDGMENT_TOOL);
	const first = await route.execute(
		"first-implementation",
		{
			question: "Implement the first justified movement",
			target: "implementation",
			reason: "The current design makes the movement explicit",
			movement: "Add the first boundary",
			stop_condition: "The boundary test is green",
			verification: "Run the boundary test",
		},
		undefined,
		undefined,
		harness.ctx,
	);
	await judgment.execute(
		"first-implementation-close",
		{
			route_id: first.details.routeId,
			status: "resolved",
			result: "The first boundary is green.",
			basis: ["The boundary test passes."],
		},
		undefined,
		undefined,
		harness.ctx,
	);

	const secondParams = {
		question: "Implement the next justified movement",
		target: "implementation",
		reason: "The first landing exposes one local caller update",
		movement: "Update the local caller",
		stop_condition: "The caller test is green",
		verification: "Run the caller test",
	};
	await assert.rejects(
		route.execute(
			"second-without-evidence",
			secondParams,
			undefined,
			undefined,
			harness.ctx,
		),
		/cite evidence from the previous implementation landing/,
	);
	await assert.rejects(
		route.execute(
			"second-without-alternatives",
			{ ...secondParams, known_evidence: ["The first boundary test passes."] },
			undefined,
			undefined,
			harness.ctx,
		),
		/must record the plausible available skill routes/,
	);

	const second = await route.execute(
		"second-implementation",
		{
			...secondParams,
			known_evidence: [
				"The first boundary test passes and exposes one unchanged caller.",
			],
			alternatives_considered: [
				{
					target: "verify",
					reason:
						"The narrow boundary check already settled the current landing claim.",
				},
				{
					target: "signal",
					reason:
						"No new structural direction appeared; the caller update was already exposed.",
				},
			],
		},
		undefined,
		undefined,
		harness.ctx,
	);
	assert.equal(second.details.target, "implementation");
	assert.deepEqual(
		second.details.consideredAlternatives.map(
			(item: { target: string }) => item.target,
		),
		["verify", "signal"],
	);
});

test("an immediate user decision accepts a custom answer outside the proposed options", async () => {
	const harness = await startHarness();
	const route = harness.tools.get(ROUTE_TOOL);
	const judgment = harness.tools.get(JUDGMENT_TOOL);
	const decisionRoute = await route.execute(
		"custom-decision-route",
		{
			question: "Which status placement should Developer use?",
			target: "specify",
			reason: "The product owner may reject the proposed placements",
		},
		undefined,
		undefined,
		harness.ctx,
	);
	harness.ctx.mode = "tui";
	harness.setCustomResults(["continue", "__custom__", "submit"]);
	harness.setEditorResult("Keep status visible before pending questions.");

	const blocked = await judgment.execute(
		"custom-decision-blocked",
		{
			route_id: decisionRoute.details.routeId,
			status: "blocked",
			result: "The product owner must choose the status placement.",
			basis: ["No accepted placement exists."],
			open_questions: [
				{
					question: "Where should Inspect status appear?",
					context:
						"Compare placing status before or after pending questions, or provide a better placement.",
					response_spec: {
						kind: "choice-form",
						fields: [
							{
								id: "placement",
								prompt: "Choose the status placement",
								options: [
									{ value: "top", label: "Place it first" },
									{ value: "bottom", label: "Place it last" },
								],
							},
						],
					},
					status: "open",
					resolution_owner: "user",
					gate: "before-implementation",
					resolution_criteria: "The product owner chooses the placement.",
				},
			],
		},
		undefined,
		undefined,
		harness.ctx,
	);

	assert.match(blocked.content[0].text, /Structured answer:/);
	assert.match(
		blocked.content[0].text,
		/- placement: custom — user wrote: Keep status visible before pending questions\./,
	);
	assert.doesNotMatch(blocked.content[0].text, /__custom__/);
});

test("a user-owned before-implementation question blocks routes and built-in mutation until resolved", async () => {
	const harness = await startHarness();
	const route = harness.tools.get(ROUTE_TOOL);
	const judgment = harness.tools.get(JUDGMENT_TOOL);
	const decisionRoute = await route.execute(
		"decision-route",
		{
			question: "What should an empty schedule mean?",
			target: "specify",
			reason: "The product meaning is human-owned",
		},
		undefined,
		undefined,
		harness.ctx,
	);
	harness.ctx.mode = "tui";
	harness.setCustomResults(["continue", "absent", "submit"]);
	const customCallsBeforeQuestion = harness.customCalls();
	const entriesBeforeQuestion = harness.entries.length;
	const blocked = await judgment.execute(
		"decision-blocked",
		{
			route_id: decisionRoute.details.routeId,
			status: "blocked",
			result: "The product owner must choose the empty-schedule meaning.",
			basis: ["No accepted product policy exists."],
			open_questions: [
				{
					question:
						"Should an empty schedule mean absent or explicitly cleared?",
					context:
						"Choose one:\n- absent: omit the value\n- cleared: persist an explicit empty value",
					response_spec: {
						kind: "choice-form",
						fields: [
							{
								id: "A",
								prompt: "Choose the empty-schedule meaning",
								options: [
									{ value: "absent", label: "Omit the value" },
									{
										value: "cleared",
										label: "Persist an explicit empty value",
									},
								],
							},
						],
					},
					status: "open",
					resolution_owner: "user",
					gate: "before-implementation",
					resolution_criteria:
						"The product owner chooses absent or explicitly cleared.",
				},
			],
		},
		undefined,
		undefined,
		harness.ctx,
	);
	const questionId = blocked.details.openedQuestions[0].id;
	assert.match(
		blocked.details.openedQuestions[0].context,
		/persist an explicit empty value/,
	);
	assert.equal(harness.customCalls(), customCallsBeforeQuestion + 3);
	assert.equal(harness.entries.length, entriesBeforeQuestion);
	assert.ok(
		blocked.content[0].text.includes(`Immediate user answer for ${questionId}`),
	);
	assert.match(blocked.content[0].text, /Structured answer:/);
	assert.match(blocked.content[0].text, /- A: absent — Omit the value/);
	assert.ok(blocked.content[0].text.includes(`open_question_id=${questionId}`));

	await assert.rejects(
		route.execute(
			"blocked-implementation",
			{
				question: "Implement the empty-schedule behavior",
				target: "implementation",
				reason: "Attempt mutation before the decision",
				movement: "Change empty-schedule storage",
				stop_condition: "The storage test passes",
				verification: "Run the storage test",
			},
			undefined,
			undefined,
			harness.ctx,
		),
		/Implementation work is blocked/,
	);
	const mutationGate = await harness.emit("tool_call", {
		toolName: "edit",
		input: {},
		toolCallId: "edit:blocked",
	});
	assert.match(mutationGate.reason, /question gate blocks artifact mutation/);

	const answerRoute = await route.execute(
		"answer-route",
		{
			question: "Should an empty schedule mean absent or explicitly cleared?",
			target: "specify",
			reason: "The product owner answered the focused decision",
			known_evidence: ["The product owner chose absent."],
			open_question_id: questionId,
		},
		undefined,
		undefined,
		harness.ctx,
	);
	await assert.rejects(
		judgment.execute(
			"answer-without-question-review",
			{
				route_id: answerRoute.details.routeId,
				status: "resolved",
				result: "An empty schedule means absent.",
				basis: ["The product owner explicitly chose absent."],
			},
			undefined,
			undefined,
			harness.ctx,
		),
		/Include question_updates/,
	);
	await assert.rejects(
		judgment.execute(
			"answer-without-explicit-resolution",
			{
				route_id: answerRoute.details.routeId,
				status: "resolved",
				result: "An empty schedule means absent.",
				basis: ["The product owner explicitly chose absent."],
				question_updates: [],
			},
			undefined,
			undefined,
			harness.ctx,
		),
		/requires an explicit question_updates entry/,
	);
	await judgment.execute(
		"answer-resolved",
		{
			route_id: answerRoute.details.routeId,
			status: "resolved",
			result: "An empty schedule means absent.",
			basis: ["The product owner explicitly chose absent."],
			question_updates: [
				{
					question_id: questionId,
					status: "resolved",
					result: "The product owner chose absent.",
					basis: ["Explicit product-owner answer."],
				},
			],
		},
		undefined,
		undefined,
		harness.ctx,
	);

	const implementation = await route.execute(
		"unblocked-implementation",
		{
			question: "Implement the accepted empty-schedule meaning",
			target: "implementation",
			reason: "The blocking product decision is resolved",
			movement: "Store an empty schedule as absent",
			stop_condition: "The storage test is green",
			verification: "Run the storage test",
		},
		undefined,
		undefined,
		harness.ctx,
	);
	assert.equal(implementation.details.target, "implementation");
});

test("an agent before-implementation question keeps the judgment evidence lane reachable", async () => {
	const harness = await startHarness();
	const route = harness.tools.get(ROUTE_TOOL);
	const judgment = harness.tools.get(JUDGMENT_TOOL);
	assert.equal(harness.activeTools().includes("bash"), false);

	const discovery = await route.execute(
		"guard-discovery",
		{
			question: "Which source file owns the schedule conversion?",
			target: "signal",
			reason: "Repository evidence is required before mutation",
		},
		undefined,
		undefined,
		harness.ctx,
	);
	assert.equal(harness.activeTools().includes("bash"), true);
	assert.equal(harness.activeTools().includes("edit"), false);
	const opened = await judgment.execute(
		"guard-discovery-open",
		{
			route_id: discovery.details.routeId,
			status: "needs-evidence",
			result: "A repository search is still required.",
			basis: [],
			open_questions: [
				{
					question: "Which source file owns the schedule conversion?",
					status: "open",
					resolution_owner: "agent",
					gate: "before-implementation",
					resolution_criteria:
						"Repository search identifies the owning source file.",
				},
			],
		},
		undefined,
		undefined,
		harness.ctx,
	);
	const questionId = opened.details.openedQuestions[0].id;
	assert.equal(harness.activeTools().includes("bash"), false);

	await assert.rejects(
		route.execute(
			"guard-blocked-implementation",
			{
				question: "Implement the schedule conversion",
				target: "implementation",
				reason: "Attempt implementation before locating the owner",
				movement: "Add the conversion",
				stop_condition: "The conversion test passes",
				verification: "Run the conversion test",
			},
			undefined,
			undefined,
			harness.ctx,
		),
		/Implementation work is blocked/,
	);

	const resolution = await route.execute(
		"guard-resolve-evidence",
		{
			question: "Which source file owns the schedule conversion?",
			target: "signal",
			reason:
				"The pending agent question is resolved through repository evidence",
			open_question_id: questionId,
		},
		undefined,
		undefined,
		harness.ctx,
	);
	assert.equal(harness.activeTools().includes("bash"), true);
	assert.equal(harness.activeTools().includes("edit"), false);
	assert.equal(
		await harness.emit("tool_call", {
			toolName: "bash",
			input: { command: "find . -type f" },
			toolCallId: "bash:evidence",
		}),
		undefined,
	);
	const blockedEdit = await harness.emit("tool_call", {
		toolName: "edit",
		input: {},
		toolCallId: "edit:evidence",
	});
	assert.match(blockedEdit.reason, /blocks artifact mutation/);

	await judgment.execute(
		"guard-resolve-evidence-close",
		{
			route_id: resolution.details.routeId,
			status: "resolved",
			result: "src/contracts.ts owns the conversion.",
			basis: ["Repository search result."],
			question_updates: [
				{
					question_id: questionId,
					status: "resolved",
					result: "The owning source file is src/contracts.ts.",
					basis: ["Repository search result."],
				},
			],
		},
		undefined,
		undefined,
		harness.ctx,
	);

	const implementation = await route.execute(
		"guard-unblocked-implementation",
		{
			question: "Implement the schedule conversion",
			target: "implementation",
			reason: "The owning file and local movement are now known",
			movement: "Add the pure conversion in src/contracts.ts",
			stop_condition: "The focused conversion test passes",
			verification: "Run the conversion test",
		},
		undefined,
		undefined,
		harness.ctx,
	);
	assert.equal(implementation.details.target, "implementation");
	assert.equal(harness.activeTools().includes("edit"), true);
	assert.equal(harness.activeTools().includes("bash"), true);
});

test("a before-completion question allows implementation work but keeps completion evidence unresolved", async () => {
	const harness = await startHarness();
	const route = harness.tools.get(ROUTE_TOOL);
	const judgment = harness.tools.get(JUDGMENT_TOOL);
	const acceptanceRoute = await route.execute(
		"acceptance-question",
		{
			question: "Has the user accepted the rendered checkout behavior?",
			target: "verify",
			reason: "Acceptance is separate from implementation evidence",
		},
		undefined,
		undefined,
		harness.ctx,
	);
	const customCallsBeforeAcceptance = harness.customCalls();
	const opened = await judgment.execute(
		"acceptance-open",
		{
			route_id: acceptanceRoute.details.routeId,
			status: "needs-evidence",
			result:
				"Implementation may continue, but user acceptance is still missing.",
			basis: [],
			open_questions: [
				{
					question: "Does the user accept the rendered checkout behavior?",
					context:
						"Review the rendered checkout flow and report acceptance or a reproducible mismatch.",
					status: "open",
					resolution_owner: "user",
					gate: "before-completion",
					resolution_criteria:
						"The user explicitly accepts the rendered checkout behavior.",
				},
			],
		},
		undefined,
		undefined,
		harness.ctx,
	);
	assert.equal(opened.details.openedQuestions[0].gate, "before-completion");
	assert.equal(harness.customCalls(), customCallsBeforeAcceptance);

	const implementation = await route.execute(
		"allowed-before-completion",
		{
			question: "Implement the already accepted checkout layout",
			target: "implementation",
			reason: "The remaining question gates completion, not implementation",
			movement: "Apply the local checkout layout change",
			stop_condition: "The focused checkout test is green",
			verification: "Run the focused checkout test",
		},
		undefined,
		undefined,
		harness.ctx,
	);
	const mutationGate = await harness.emit("tool_call", {
		toolName: "edit",
		input: {},
		toolCallId: "edit:before-completion",
	});
	assert.equal(mutationGate, undefined);
	await judgment.execute(
		"allowed-before-completion-close",
		{
			route_id: implementation.details.routeId,
			status: "resolved",
			result: "The local checkout change reached a stable landing.",
			basis: ["The focused checkout test passes."],
			question_updates: [],
		},
		undefined,
		undefined,
		harness.ctx,
	);

	const verifyRoute = await route.execute(
		"verify-before-acceptance",
		{
			question:
				"Does current implementation evidence support the checkout claim?",
			target: "verify",
			reason: "The changed landing requires current verification",
			known_evidence: ["The focused checkout test passes."],
		},
		undefined,
		undefined,
		harness.ctx,
	);
	await judgment.execute(
		"verify-before-acceptance-close",
		{
			route_id: verifyRoute.details.routeId,
			status: "resolved",
			result: "Implementation evidence is current, but acceptance is not.",
			basis: ["The focused checkout test passes."],
			question_updates: [],
		},
		undefined,
		undefined,
		harness.ctx,
	);
	await harness.commands.get("develop").handler("status", harness.ctx);
	const status = harness.notifications.at(-1)?.message ?? "";
	assert.match(status, /needs-answer/);
	assert.match(status, /verification: required/);
});

test("a sole unrelated pending question is not implicitly focused or resolved", async () => {
	const harness = await startHarness();
	const route = harness.tools.get(ROUTE_TOOL);
	const judgment = harness.tools.get(JUDGMENT_TOOL);
	const evidenceRoute = await route.execute(
		"sole-question",
		{
			question: "What does the narrow checkout viewport show?",
			target: "verify",
			reason: "A rendered observation is missing",
		},
		undefined,
		undefined,
		harness.ctx,
	);
	const opened = await judgment.execute(
		"sole-question-open",
		{
			route_id: evidenceRoute.details.routeId,
			status: "needs-evidence",
			result: "The viewport observation is still missing.",
			basis: [],
			open_questions: [
				agentOpenQuestion("What does the narrow checkout viewport show?"),
			],
		},
		undefined,
		undefined,
		harness.ctx,
	);
	const questionId = opened.details.openedQuestions[0].id;

	const unrelated = await route.execute(
		"unrelated-route",
		{
			question: "Are the schedule conversion tests current?",
			target: "verify",
			reason: "This is independent evidence",
		},
		undefined,
		undefined,
		harness.ctx,
	);
	assert.equal(unrelated.details.targetQuestionId, undefined);
	await judgment.execute(
		"unrelated-route-close",
		{
			route_id: unrelated.details.routeId,
			status: "resolved",
			result: "The schedule conversion tests are current.",
			basis: ["The focused schedule test passes."],
			question_updates: [],
		},
		undefined,
		undefined,
		harness.ctx,
	);
	await harness.commands.get("develop").handler("questions", harness.ctx);
	assert.ok((harness.notifications.at(-1)?.message ?? "").includes(questionId));
});

test("implementation routing uses additive built-in activation and preserves unrelated tools", async () => {
	const harness = createHarness();
	await developer(harness.api);
	await harness.emit("session_start", {
		type: "session_start",
		reason: "startup",
	});
	await harness.commands.get("develop").handler("on", harness.ctx);
	assert.equal(harness.activeTools().includes("edit"), false);

	const beforeImplementation = [
		...harness.activeTools(),
		"other_extension_tool",
	];
	harness.setActiveTools(beforeImplementation);
	const route = harness.tools.get(ROUTE_TOOL);
	const opened = await route.execute(
		"implementation",
		{
			question: "Apply the justified local change",
			target: "implementation",
			reason: "The contract is explicit",
		},
		undefined,
		undefined,
		harness.ctx,
	);
	assert.ok(harness.activeTools().includes("edit"));
	assert.ok(harness.activeTools().includes("write"));
	assert.ok(harness.activeTools().includes("bash"));
	assert.ok(harness.activeTools().includes("other_extension_tool"));

	await harness.tools.get(JUDGMENT_TOOL).execute(
		"close",
		{
			route_id: opened.details.routeId,
			status: "resolved",
			result: "The local change is implemented.",
			basis: ["Relevant test passes"],
		},
		undefined,
		undefined,
		harness.ctx,
	);
	assert.equal(harness.activeTools().includes("edit"), false);
	assert.ok(harness.activeTools().includes("other_extension_tool"));
});

test("persistent TUI state stays compact and disappears when routing is idle", async () => {
	const harness = await startHarness();
	assert.equal(harness.widgets.at(-1)?.value, undefined);

	const route = await harness.tools.get(ROUTE_TOOL).execute(
		"widget-route",
		{
			question: `${"A long active route question ".repeat(12)}?`,
			target: "implementation",
			reason: "The local action is justified",
		},
		undefined,
		undefined,
		harness.ctx,
	);
	const activeWidget = harness.widgets.at(-1)?.value as string[];
	assert.equal(activeWidget.length, 1);
	assert.match(activeWidget[0], /^route · implementation ·/);
	assert.ok(activeWidget[0].length < 190);

	await harness.tools.get(JUDGMENT_TOOL).execute(
		"widget-close",
		{
			route_id: route.details.routeId,
			status: "resolved",
			result: "The action is complete.",
			basis: ["The focused test passes."],
		},
		undefined,
		undefined,
		harness.ctx,
	);
	assert.equal(harness.widgets.at(-1)?.value, undefined);
});

test("the no-argument command uses a non-overlay settings surface only in TUI mode", async () => {
	const harness = createHarness();
	await developer(harness.api);
	await harness.emit("session_start", {
		type: "session_start",
		reason: "startup",
	});

	await harness.commands.get("develop").handler("", harness.ctx);
	assert.equal(harness.customCalls(), 0);
	assert.match(harness.notifications.at(-1)?.message ?? "", /developer: off/);

	harness.ctx.mode = "tui";
	harness.setCustomResult(undefined);
	await harness.commands.get("develop").handler("", harness.ctx);
	assert.equal(harness.customCalls(), 1);
	assert.equal(harness.customOptions.at(-1), undefined);
	assert.equal(harness.entries.length, 0);

	await harness.commands.get("develop").handler("on", harness.ctx);
	assert.equal(
		(harness.entries.at(-1)?.data as { enabled: boolean }).enabled,
		true,
	);
	assert.equal(harness.activeTools().includes("edit"), false);
});

test("the no-argument command returns from status to Developer control before closing", async () => {
	const harness = await startHarness();
	harness.ctx.mode = "tui";
	const customCallsBeforeStatus = harness.customCalls();
	harness.setCustomResults([{ kind: "status" }, undefined, undefined]);

	await harness.commands.get("develop").handler("", harness.ctx);

	assert.equal(harness.customCalls(), customCallsBeforeStatus + 3);
	assert.deepEqual(harness.customOptions.slice(-3), [
		undefined,
		undefined,
		undefined,
	]);
});

test("the no-argument command returns from history detail to the same list and then Settings", async () => {
	const harness = await startHarness();
	harness.ctx.mode = "tui";
	const route = await harness.tools.get(ROUTE_TOOL).execute(
		"history-route",
		{
			question: "Is history inspection ready?",
			target: "verify",
			reason: "The rendered detail requires inspection.",
		},
		undefined,
		undefined,
		harness.ctx,
	);
	await harness.tools.get(JUDGMENT_TOOL).execute(
		"history-judgment",
		{
			route_id: route.details.routeId,
			status: "resolved",
			result: "History inspection is ready.",
			basis: ["The detail contract is exercised."],
		},
		undefined,
		undefined,
		harness.ctx,
	);
	const entriesBeforeInspection = harness.entries.length;
	const customCallsBeforeInspection = harness.customCalls();
	harness.setCustomResults([
		{ kind: "history" },
		route.details.routeId,
		undefined,
		undefined,
		undefined,
	]);

	await harness.commands.get("develop").handler("", harness.ctx);

	assert.equal(harness.customCalls(), customCallsBeforeInspection + 5);
	assert.deepEqual(harness.customOptions.slice(-5), [
		undefined,
		undefined,
		undefined,
		undefined,
		undefined,
	]);
	assert.equal(harness.entries.length, entriesBeforeInspection);
});

test("/develop completes actions and confirms before discarding active TUI state", async () => {
	const harness = await startHarness();
	const command = harness.commands.get("develop");
	assert.deepEqual(command.getArgumentCompletions("st"), [
		{ value: "status", label: "status" },
	]);
	assert.equal(command.getArgumentCompletions("unknown"), null);

	await harness.tools.get(ROUTE_TOOL).execute(
		"off-confirmation",
		{
			question: "Should the active work be discarded?",
			target: "implementation",
			reason: "The next action was already justified",
		},
		undefined,
		undefined,
		harness.ctx,
	);
	harness.ctx.mode = "tui";
	const entryCount = harness.entries.length;

	harness.setConfirmResult(false);
	await command.handler("off", harness.ctx);
	assert.equal(harness.entries.length, entryCount);
	assert.deepEqual(harness.confirmations.at(-1), {
		title: "Turn off Developer?",
		message:
			"This clears the active route from the current protocol state. Existing session history remains.",
	});

	harness.setConfirmResult(true);
	await command.handler("off", harness.ctx);
	assert.equal(
		(harness.entries.at(-1)?.data as { enabled: boolean }).enabled,
		false,
	);
});

test("TUI question selection focuses the pending question and the next route associates it automatically", async () => {
	const harness = await startHarness();
	const route = await harness.tools.get(ROUTE_TOOL).execute(
		"question-picker",
		{
			question: "Which browser observation remains?",
			target: "implementation",
			reason: "The implementation evidence has been inspected",
		},
		undefined,
		undefined,
		harness.ctx,
	);
	const judgment = await harness.tools.get(JUDGMENT_TOOL).execute(
		"question-picker-close",
		{
			route_id: route.details.routeId,
			status: "needs-evidence",
			result: "A rendered-state observation is missing.",
			basis: ["Pure-function tests pass."],
			open_questions: [agentOpenQuestion("Which browser observation remains?")],
		},
		undefined,
		undefined,
		harness.ctx,
	);
	const questionId = judgment.details.openedQuestions[0].id;
	assert.equal(judgment.details.status, "needs-evidence");

	harness.ctx.mode = "tui";
	harness.setCustomResult(undefined);
	await harness.commands.get("develop").handler("status", harness.ctx);
	assert.equal(harness.customOptions.at(-1), undefined);

	const customCallsBeforeImplementationQuestion = harness.customCalls();
	harness.setCustomResults([{ kind: "questions" }, "defer", undefined]);
	harness.setEditorResult(undefined);
	await harness.commands.get("develop").handler("", harness.ctx);
	assert.equal(
		harness.customCalls(),
		customCallsBeforeImplementationQuestion + 3,
	);
	assert.equal(harness.sentUserMessages.length, 0);

	const customCallsBeforeSingleQuestionCancel = harness.customCalls();
	harness.setCustomResults(["continue", "defer"]);
	harness.setEditorResult(undefined);
	await harness.commands.get("develop").handler("questions", harness.ctx);
	assert.equal(
		harness.customCalls(),
		customCallsBeforeSingleQuestionCancel + 2,
	);
	assert.equal(harness.sentUserMessages.length, 0);

	const customCallsBeforeSingleQuestionCommand = harness.customCalls();
	harness.setCustomResults(["continue"]);
	harness.setEditorResult(
		"Resolve this open Developer question.\n\nQuestion: Which browser observation remains?\n\nAnswer/evidence: the value remains visible.",
	);
	await harness.commands.get("develop").handler("questions", harness.ctx);
	assert.equal(
		harness.customCalls(),
		customCallsBeforeSingleQuestionCommand + 1,
	);
	assert.equal(harness.editorText(), "");
	assert.match(
		harness.sentUserMessages.at(-1)?.content ?? "",
		/Which browser observation remains/,
	);
	assert.match(
		harness.sentUserMessages.at(-1)?.content ?? "",
		/value remains visible/,
	);
	assert.doesNotMatch(
		harness.sentUserMessages.at(-1)?.content ?? "",
		/question:route:/,
	);
	assert.equal(harness.entries.at(-1)?.customType, "developer.question-focus");

	const revisited = await harness.tools.get(ROUTE_TOOL).execute(
		"question-picker-revisit",
		{
			question: "What does the browser now show?",
			target: "verify",
			reason: "The focused observation is now available",
		},
		undefined,
		undefined,
		harness.ctx,
	);
	assert.equal(revisited.details.targetQuestionId, questionId);
	await harness.tools.get(JUDGMENT_TOOL).execute(
		"question-picker-resolved",
		{
			route_id: revisited.details.routeId,
			status: "resolved",
			result: "The rendered state now supports the claim.",
			basis: ["The focused browser observation was recorded."],
			question_updates: [
				{
					question_id: questionId,
					status: "resolved",
					result: "The browser observation now supports the claim.",
					basis: ["Recorded focused browser observation."],
				},
			],
		},
		undefined,
		undefined,
		harness.ctx,
	);
	await harness.commands.get("develop").handler("questions", harness.ctx);
	assert.equal(
		harness.notifications.at(-1)?.message,
		"Developer has no open questions on the current branch.",
	);
});

test("a multi-question editor cancel returns to the question selector", async () => {
	const harness = await startHarness();
	const routed = await harness.tools.get(ROUTE_TOOL).execute(
		"multi-question-picker",
		{
			question: "Which rendered observations remain?",
			target: "verify",
			reason: "Two independent rendered states still need evidence",
		},
		undefined,
		undefined,
		harness.ctx,
	);
	const judgment = await harness.tools.get(JUDGMENT_TOOL).execute(
		"multi-question-picker-close",
		{
			route_id: routed.details.routeId,
			status: "needs-evidence",
			result: "Two rendered observations remain.",
			basis: [],
			open_questions: [
				agentOpenQuestion("What does the narrow viewport show?"),
				agentOpenQuestion("What does the wide viewport show?"),
			],
		},
		undefined,
		undefined,
		harness.ctx,
	);
	const [narrowQuestion, wideQuestion] = judgment.details.openedQuestions;
	harness.ctx.mode = "tui";
	harness.setCustomResults([
		narrowQuestion.id,
		"continue",
		"defer",
		wideQuestion.id,
		"continue",
	]);
	harness.setEditorResults([
		undefined,
		"The wide viewport preserves the selected value.",
	]);
	const customCallsBeforeQuestions = harness.customCalls();

	await harness.commands.get("develop").handler("questions", harness.ctx);

	assert.equal(harness.customCalls(), customCallsBeforeQuestions + 5);
	assert.deepEqual(harness.customOptions.slice(-5), [
		undefined,
		undefined,
		undefined,
		undefined,
		undefined,
	]);
	assert.match(
		harness.sentUserMessages.at(-1)?.content ?? "",
		/wide viewport preserves/,
	);
	assert.equal(
		(harness.entries.at(-1)?.data as { questionId?: string } | undefined)
			?.questionId,
		wideQuestion.id,
	);

	const customCallsBeforeSelectorCancel = harness.customCalls();
	harness.setCustomResults([{ kind: "questions" }, undefined, undefined]);
	await harness.commands.get("develop").handler("", harness.ctx);
	assert.equal(harness.customCalls(), customCallsBeforeSelectorCancel + 3);
	assert.deepEqual(harness.customOptions.slice(-3), [
		undefined,
		undefined,
		undefined,
	]);
});

test("tool renderers are partial-safe and expose routing evidence when expanded", async () => {
	const harness = createHarness();
	await developer(harness.api);
	const route = harness.tools.get(ROUTE_TOOL);
	assert.equal(route.renderShell, "self");
	const callComponent = route.renderCall({}, theme, {});
	const partialCall = renderedText(callComponent);
	assert.match(partialCall, /…/);
	assert.equal(
		route.renderCall({ target: "implementation", question: "Q" }, theme, {
			lastComponent: callComponent,
		}),
		callComponent,
	);
	const partialResult = renderedText(
		route.renderResult(
			{ content: [], details: undefined },
			{ expanded: false, isPartial: true, isError: false },
			theme,
			{},
		),
	);
	assert.match(partialResult, /routing development question/);

	const expanded = renderedText(
		route.renderResult(
			{
				content: [],
				details: {
					protocol: "developer/v5",
					kind: "route",
					routeId: "route:render",
					question: "What should own this change?",
					target: "specify",
					reason: "The invariant is unclear",
					knownEvidence: ["The current behavior differs across callers"],
					consideredAlternatives: [],
					targetQuestionId: "question:earlier",
					methodLocation: "/skills/specify/SKILL.md",
					executionProfile: undefined,
				},
			},
			{ expanded: true, isPartial: false, isError: false },
			theme,
			{},
		),
	);
	assert.match(
		expanded,
		/<dim>reason · <\/dim><muted>The invariant is unclear<\/muted>/,
	);
	assert.match(
		expanded,
		/evidence · <\/dim><muted>The current behavior differs across callers/,
	);
	assert.match(
		expanded,
		/<dim>revisits · <\/dim><muted>question:earlier<\/muted>/,
	);
	assert.match(expanded, /skill · <\/dim><muted>\/skills\/specify\/SKILL\.md/);
});

test("judgment renderers use status semantics and show opened questions", async () => {
	const harness = createHarness();
	await developer(harness.api);
	const judgment = harness.tools.get(JUDGMENT_TOOL);
	const expanded = renderedText(
		judgment.renderResult(
			{
				content: [],
				details: {
					protocol: "developer/v5",
					kind: "judgment",
					routeId: "route:render",
					question: "Is the evidence sufficient?",
					target: "verify",
					status: "needs-evidence",
					result: "A browser observation is still missing.",
					basis: ["Unit tests cover only the pure function."],
					artifacts: ["pnpm test"],
					openedQuestions: [
						{
							id: "question:route:render:open:1",
							question: "What does the rendered UI show?",
							status: "open",
							resolutionOwner: "agent",
							gate: "none",
							resolutionCriteria: "Observe the rendered UI.",
							sourceRouteId: "route:render",
						},
					],
					questionUpdates: [],
				},
			},
			{ expanded: true, isPartial: false, isError: false },
			theme,
			{},
		),
	);
	assert.match(expanded, /<warning>needs-evidence/);
	assert.match(expanded, /A browser observation is still missing\./);
	assert.match(
		expanded,
		/basis · <\/dim><muted>Unit tests cover only the pure function/,
	);
	assert.match(expanded, /artifact · <\/dim><muted>pnpm test/);
	assert.match(
		expanded,
		/opened agent\/none · <\/dim><warning>What does the rendered UI show\?/,
	);

	const markdownSurface = judgment.renderResult(
		{
			content: [],
			details: {
				protocol: "developer/v5",
				kind: "judgment",
				routeId: "route:markdown",
				question: "Which claims are supported?",
				target: "verify",
				status: "resolved",
				result:
					"## Evidence matrix\n\n| Claim | Evidence | Status |\n| --- | --- | --- |\n| UI state | Browser observation | supported |",
				basis: ["Observed in browser"],
				artifacts: [],
				openedQuestions: [],
				changedArtifacts: false,
			},
		},
		{ expanded: true, isPartial: false, isError: false },
		theme,
		{},
	);
	const markdownOutput = markdownSurface.render(100).join("\n");
	assert.match(markdownOutput, /Evidence matrix/);
	assert.match(markdownOutput, /Claim/);
	assert.match(markdownOutput, /Browser observation/);

	assert.equal(judgment.renderShell, "self");
	const blockedCall = renderedText(
		judgment.renderCall(
			{ status: "blocked", result: "External access is unavailable." },
			theme,
			{},
		),
	);
	assert.match(blockedCall, /<error>blocked<\/error>/);
});
