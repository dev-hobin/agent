import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { validateToolArguments } from "@earendil-works/pi-ai";
import {
	initTheme,
	loadSkillsFromDir,
	type ExtensionAPI,
	type Skill,
} from "@earendil-works/pi-coding-agent";

import developer from "../extensions/developer.ts";
import {
	ACTIVATION_ENTRY,
	JUDGMENT_TOOL,
	REFERENCE_TOOL,
	ROUTE_TOOL,
} from "../extensions/state.ts";
import { TOOL_POLICY_LIFECYCLE_ENTRY } from "../extensions/tool-policy.ts";

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

const TEST_CAPABILITY_WHEN: Readonly<Record<string, string>> = {
	model:
		"Consequential conditions, rules, contracts, histories, or proof boundaries must be modeled.",
	verify:
		"A concrete completion, correctness, compatibility, coverage, or evidence claim must be judged.",
};

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

const TEST_IMPLEMENTATION_CONTRACT = {
	movement: "Apply one bounded test movement",
	stop_condition: "The focused test is green and the route is reviewable",
	verification: "Run the focused test",
	invariant_handling: {
		kind: "not-applicable",
		reason:
			"The protocol behavior under test does not construct or narrow invariant-bearing domain data",
	},
} as const;

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
	const capabilityAssessmentPromises = new Map<string, Promise<unknown>>();
	const readyCapabilityAssessments = new Set<string>();
	const readyReferenceSelections = new Set<string>();

	const api = {
		on(name: string, handler: (event: any, ctx: any) => any) {
			handlers.set(name, [...(handlers.get(name) ?? []), handler]);
		},
		registerTool(tool: any) {
			// Direct harness calls bypass Pi's schema validation. Route fixtures
			// explicitly propose Capability applicability and receive the public
			// implementation contract unless a test overrides a field.
			const registeredTool =
				tool.name === "developer_assess_capability"
					? {
							...tool,
							async execute(
								toolCallId: string,
								params: Record<string, unknown>,
								...rest: unknown[]
							) {
								const capability = String(params.capability ?? "");
								const pending = Promise.resolve(
									tool.execute(toolCallId, params, ...rest),
								);
								if (capability)
									capabilityAssessmentPromises.set(capability, pending);
								try {
									const result = await pending;
									if (capability) readyCapabilityAssessments.add(capability);
									return result;
								} catch (error) {
									if (capability)
										capabilityAssessmentPromises.delete(capability);
									throw error;
								}
							},
						}
					: tool.name === ROUTE_TOOL
						? {
								...tool,
								async execute(
									toolCallId: string,
									params: Record<string, unknown>,
									...rest: unknown[]
								) {
									if (
										typeof params?.target === "string" &&
										params.target !== "implementation" &&
										!readyCapabilityAssessments.has(params.target)
									) {
										const assessment = tools.get("developer_assess_capability");
										const declaredWhen = TEST_CAPABILITY_WHEN[params.target];
										if (assessment) {
											let pending = capabilityAssessmentPromises.get(
												params.target,
											);
											if (!pending) {
												pending = Promise.resolve(
													assessment.execute("assess-route-fixture", {
														capability: params.target,
														status: "applicable",
														matched_when: declaredWhen ? [declaredWhen] : [],
														matched_unless: [],
														basis: [
															"The requested route fixture explicitly serves the current Contribution Need.",
														],
														missing_context: [],
													}),
												);
												capabilityAssessmentPromises.set(
													params.target,
													pending,
												);
											}
											try {
												await pending;
												readyCapabilityAssessments.add(params.target);
											} catch (error) {
												capabilityAssessmentPromises.delete(params.target);
												throw error;
											}
										}
									}
									if (typeof params?.target === "string") {
										const references =
											TEST_CAPABILITY_REFERENCES[params.target];
										if (
											references &&
											!readyReferenceSelections.has(params.target)
										) {
											const selection = tools.get(
												"developer_select_references",
											);
											if (selection) {
												await selection.execute("select-route-references", {
													capability: params.target,
													dispositions: references.map((path) => ({
														path,
														status: "selected",
														basis: [
															"The route fixture explicitly selects this canonical Reference.",
														],
													})),
												});
												readyReferenceSelections.add(params.target);
											}
										}
									}
									return tool.execute(
										toolCallId,
										params?.target === "implementation"
											? { ...TEST_IMPLEMENTATION_CONTRACT, ...params }
											: params,
										...rest,
									);
								},
							}
						: tool;
			tools.set(tool.name, registeredTool);
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

function agentOpenQuestion(question: string) {
	return {
		question,
		status: "open" as const,
		resolution_owner: "agent" as const,
		gate: "none" as const,
		resolution_criteria: `Obtain concrete evidence that settles: ${question}`,
	};
}

function referenceExemption(
	reason = "The test exercises protocol behavior that does not depend on the routed reference methods.",
) {
	return {
		reason,
		evidence: [
			"The asserted behavior is independent of reference-derived judgment.",
		],
	};
}

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

	await harness.commands.get("developer").handler("on", harness.ctx);
	await harness.emit("before_agent_start", {
		type: "before_agent_start",
		prompt: "test",
		systemPrompt: "base",
		systemPromptOptions: { cwd: packageRoot, skills: loadedLeaves },
	});
	await assert.rejects(
		route.execute(
			"without-work-case",
			{
				question: "Can routing bypass Outcome continuity?",
				target: "specify",
				reason: "No Work Case has been opened.",
			},
			undefined,
			undefined,
			harness.ctx,
		),
		/active Action Loop Work Case/i,
	);
	await openTestWorkCase(harness, "tool-contract");
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
	await harness.tools
		.get("developer_assess_capability")
		.execute("assess-before-concurrency", {
			capability: "specify",
			status: "applicable",
			matched_when: [],
			matched_unless: [],
			basis: [
				"The requested route fixture explicitly serves the current Contribution Need.",
			],
			missing_context: [],
		});
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
		/unavailable.*(?:disabled|excluded)/,
	);
});

test("reference-free skill routes explicitly omit reference evidence fields", async () => {
	const harness = await startHarness();
	const routed = await harness.tools.get(ROUTE_TOOL).execute(
		"reference-free",
		{
			question: "Which product meaning is established?",
			target: "specify",
			reason: "The bounded contract needs clarification",
		},
		undefined,
		undefined,
		harness.ctx,
	);

	assert.deepEqual(routed.details.availableReferences, []);
	assert.match(
		resultText(routed),
		/has no packaged references; omit both reference_basis and reference_exemption/,
	);
});

test("resolved skill judgments require auditable reference application or a concrete exemption", async () => {
	const harness = await startHarness();
	const routeTool = harness.tools.get(ROUTE_TOOL);
	const referenceTool = harness.tools.get(REFERENCE_TOOL);
	const judgmentTool = harness.tools.get(JUDGMENT_TOOL);
	const routed = await routeTool.execute(
		"reference-contract",
		{
			question: "How should totalEstimate follow the recursive Tasks shape?",
			target: "sketch",
			reason: "The data definition must determine the implementation skeleton",
		},
		undefined,
		undefined,
		harness.ctx,
	);
	assert.ok(
		routed.details.availableReferences.includes(
			"references/data-driven-design.md",
		),
	);
	assert.deepEqual(
		routed.details.referenceRoutes.find(
			(route: { id: string }) => route.id === "data-shape-template",
		)?.references,
		[
			"references/data-driven-design.md",
			"references/data-shape-template-catalog.md",
		],
	);
	const blockedDirectReferenceRead = await harness.emit("tool_call", {
		toolName: "read",
		input: {
			path: join(
				packageRoot,
				"skills",
				"sketch",
				"references",
				"data-driven-design.md",
			),
		},
		toolCallId: "direct-reference-read",
	});
	assert.equal(blockedDirectReferenceRead.block, true);
	assert.match(blockedDirectReferenceRead.reason, /developer_load_reference/);
	await assert.rejects(
		judgmentTool.execute(
			"reference-contract-missing",
			{
				route_id: routed.details.routeId,
				status: "resolved",
				result: "The recursive skeleton is ready.",
				basis: ["Tasks has Empty and Node clauses."],
			},
			undefined,
			undefined,
			harness.ctx,
		),
		/must provide reference_basis.*reference_exemption/,
	);

	await assert.rejects(
		referenceTool.execute(
			"reference-catalog-before-listed-order",
			{
				reference_route: "data-shape-template",
				path: "references/data-shape-template-catalog.md",
				reason:
					"Tasks is self-referential and needs an exact recursive template.",
			},
			undefined,
			undefined,
			harness.ctx,
		),
		/listed read order.*data-driven-design\.md/,
	);
	const loadedBase = await referenceTool.execute(
		"reference-base-first",
		{
			reference_route: "data-shape-template",
			path: "references/data-driven-design.md",
			reason:
				"The recursive template route starts with the six-artifact derivation.",
		},
		undefined,
		undefined,
		harness.ctx,
	);
	assert.equal(loadedBase.details.contentSha256.length, 64);
	assert.match(loadedBase.details.sourceTrace, /How to Design Programs/);
	assert.match(resultText(loadedBase), /The Six-Artifact Recipe/);
	await assert.rejects(
		referenceTool.execute(
			"reference-base-duplicate",
			{
				reference_route: "data-shape-template",
				path: "references/data-driven-design.md",
				reason: "A second selected route shares the base method.",
			},
			undefined,
			undefined,
			harness.ctx,
		),
		/already loaded.*overlapping route membership.*one reference_basis entry/,
	);
	await assert.rejects(
		judgmentTool.execute(
			"reference-contract-incomplete-route",
			{
				route_id: routed.details.routeId,
				status: "resolved",
				result: "The recursive skeleton is ready.",
				basis: ["Tasks has Empty and Node clauses."],
				reference_basis: [
					{
						path: "references/data-driven-design.md",
						trigger: "Tasks variants determine the function cases.",
						applied_rule: "One data clause produces one function branch.",
						artifact: "Empty and Node branches.",
					},
				],
			},
			undefined,
			undefined,
			harness.ctx,
		),
		/route data-shape-template is incomplete.*data-shape-template-catalog\.md/,
	);
	const loadedCatalog = await referenceTool.execute(
		"reference-catalog-second",
		{
			reference_route: "data-shape-template",
			path: "references/data-shape-template-catalog.md",
			reason:
				"Tasks is self-referential and needs an exact recursive template.",
		},
		undefined,
		undefined,
		harness.ctx,
	);
	assert.deepEqual(loadedCatalog.details.referenceRouteIds, [
		"data-shape-template",
	]);
	await assert.rejects(
		judgmentTool.execute(
			"reference-contract-missing-loaded-basis",
			{
				route_id: routed.details.routeId,
				status: "resolved",
				result: "The recursive skeleton is ready.",
				basis: ["Tasks has Empty and Node clauses."],
				reference_basis: [
					{
						path: "references/data-shape-template-catalog.md",
						trigger: "Tasks is self-referential.",
						applied_rule: "Recurse at the exact self-reference position.",
						artifact: "totalEstimate(rest)",
					},
				],
			},
			undefined,
			undefined,
			harness.ctx,
		),
		/Every loaded reference must have a reference_basis entry.*data-driven-design\.md/,
	);
	const recorded = await judgmentTool.execute(
		"reference-contract-close",
		{
			route_id: routed.details.routeId,
			status: "resolved",
			result: "The recursive skeleton follows the Tasks clauses.",
			basis: ["Tasks has Empty and Node clauses."],
			reference_basis: [
				{
					path: "references/data-driven-design.md",
					trigger: "Tasks variants determine the function cases.",
					applied_rule: "One data clause produces one function branch.",
					artifact: "Empty and Node branches in the totalEstimate template.",
				},
				{
					path: "references/data-shape-template-catalog.md",
					trigger: "Tasks is self-referential.",
					applied_rule: "Recurse at the exact self-reference position.",
					artifact: "totalEstimate(rest)",
				},
			],
		},
		undefined,
		undefined,
		harness.ctx,
	);
	assert.equal(
		recorded.details.referenceBasis[0].path,
		loadedBase.details.path,
	);
	assert.equal(
		recorded.details.referenceBasis[0].contentSha256,
		loadedBase.details.contentSha256,
	);
	assert.equal(
		recorded.details.referenceBasis[1].contentSha256,
		loadedCatalog.details.contentSha256,
	);
	assert.deepEqual(recorded.details.referenceBasis[1].referenceRouteIds, [
		"data-shape-template",
	]);

	const direct = await routeTool.execute(
		"reference-exemption",
		{
			question: "Which already-accepted local helper signature is first?",
			target: "sketch",
			reason: "Only the protocol exemption behavior remains under test",
		},
		undefined,
		undefined,
		harness.ctx,
	);
	const exempted = await judgmentTool.execute(
		"reference-exemption-close",
		{
			route_id: direct.details.routeId,
			status: "resolved",
			result: "The accepted local signature is the first item.",
			basis: [
				"Purpose, cases, data flow, and first item are already explicit.",
			],
			reference_exemption: referenceExemption(
				"No ownership, data-shape, state, recursion, or variation question remains.",
			),
		},
		undefined,
		undefined,
		harness.ctx,
	);
	assert.match(exempted.details.referenceExemption.reason, /No ownership/);
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

test("route schema exposes provider-compatible object properties without union-only fields", async () => {
	const harness = createHarness();
	await developer(harness.api);
	const route = harness.tools.get(ROUTE_TOOL);
	const schema = route.parameters;
	assert.equal(schema.type, "object");
	assert.equal(schema.additionalProperties, false);
	assert.equal(schema.anyOf, undefined);
	assert.deepEqual(schema.required.sort(), ["question", "reason", "target"]);

	const invariantHandling = schema.properties.invariant_handling;
	assert.equal(invariantHandling.type, "object");
	assert.equal(invariantHandling.anyOf, undefined);
	assert.deepEqual(invariantHandling.properties.kind.enum, [
		"not-applicable",
		"evidence-preserving-boundary",
		"trusted-compiler-gap",
	]);
	assert.ok(invariantHandling.required.includes("kind"));
	assert.ok(invariantHandling.properties.reason);
	assert.ok(invariantHandling.properties.raw_representation);
	assert.ok(invariantHandling.properties.assertion);
	assert.deepEqual(schema.properties.execution_profile.enum, [
		"behavior-preserving-structure",
	]);

	const incompatibleKeywords: string[] = [];
	const inspect = (value: unknown, path = "parameters") => {
		if (!value || typeof value !== "object") return;
		for (const [key, nested] of Object.entries(value)) {
			if (key === "anyOf" || key === "oneOf" || key === "const") {
				incompatibleKeywords.push(`${path}.${key}`);
			}
			inspect(nested, `${path}.${key}`);
		}
	};
	inspect(schema);
	assert.deepEqual(incompatibleKeywords, []);

	const objectArguments = {
		...TEST_IMPLEMENTATION_CONTRACT,
		question: "Apply the justified local change",
		target: "implementation",
		reason: "The movement is explicit",
	};
	const validated = validateToolArguments(route, {
		type: "toolCall",
		id: "object-invariant",
		name: ROUTE_TOOL,
		arguments: objectArguments,
	});
	assert.deepEqual(
		validated.invariant_handling,
		TEST_IMPLEMENTATION_CONTRACT.invariant_handling,
	);
	assert.throws(
		() =>
			validateToolArguments(route, {
				type: "toolCall",
				id: "string-invariant",
				name: ROUTE_TOOL,
				arguments: {
					...objectArguments,
					invariant_handling: JSON.stringify(
						TEST_IMPLEMENTATION_CONTRACT.invariant_handling,
					),
				},
			}),
		/invariant_handling/,
	);
});

test("route runtime enforces target-specific fields after flattening the public schema", async () => {
	const harness = await startHarness();
	const route = harness.tools.get(ROUTE_TOOL);
	await assert.rejects(
		route.execute(
			"missing-invariant",
			{
				...TEST_IMPLEMENTATION_CONTRACT,
				question: "Apply the justified local change",
				target: "implementation",
				reason: "The movement is explicit",
				invariant_handling: undefined,
			},
			undefined,
			undefined,
			harness.ctx,
		),
		/requires an invariant_handling object/,
	);
	await assert.rejects(
		route.execute(
			"incomplete-invariant",
			{
				...TEST_IMPLEMENTATION_CONTRACT,
				question: "Apply the justified local change",
				target: "implementation",
				reason: "The movement is explicit",
				invariant_handling: { kind: "not-applicable" },
			},
			undefined,
			undefined,
			harness.ctx,
		),
		/invariant_handling\.reason is required/,
	);
	await assert.rejects(
		route.execute(
			"skill-with-implementation-fields",
			{
				question: "What does the product require?",
				target: "specify",
				reason: "Meaning remains unresolved",
				movement: "Change the product code",
			},
			undefined,
			undefined,
			harness.ctx,
		),
		/movement is valid only when target=implementation/,
	);
	const accepted = await route.execute(
		"object-invariant",
		{
			...TEST_IMPLEMENTATION_CONTRACT,
			question: "Apply the justified local change",
			target: "implementation",
			reason: "The movement is explicit",
		},
		undefined,
		undefined,
		harness.ctx,
	);
	assert.deepEqual(
		accepted.details.implementationStep.invariantHandling,
		TEST_IMPLEMENTATION_CONTRACT.invariant_handling,
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
	assert.ok(schema.properties.reference_basis.items.required.includes("path"));
	assert.ok(
		schema.properties.reference_basis.items.required.includes("applied_rule"),
	);
	assert.equal(
		schema.properties.reference_exemption.required.includes("reason"),
		true,
	);
	assert.equal(
		schema.properties.reference_exemption.properties.evidence.minItems,
		1,
	);
	assert.deepEqual(harness.tools.get(REFERENCE_TOOL).parameters.required, [
		"reference_route",
		"path",
		"reason",
	]);
	assert.match(
		harness.tools.get(JUDGMENT_TOOL).promptGuidelines.join("\n"),
		/choice-form response_spec with one field per decision/,
	);
	assert.match(
		harness.tools.get(ROUTE_TOOL).description,
		/sketch creates an original design surface, abstraction-review judges an already-shaped candidate/,
	);
	assert.match(
		harness.tools.get(ROUTE_TOOL).promptGuidelines.join("\n"),
		/choose sketch for an original interface or boundary/,
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
				reference_exemption: referenceExemption(),
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
	await harness.commands.get("developer").handler("on", harness.ctx);
	const result = await harness.emit("before_agent_start", {
		type: "before_agent_start",
		prompt: "test",
		systemPrompt: "base",
		systemPromptOptions: { cwd: packageRoot, skills: [specify] },
	});

	assert.match(result.systemPrompt, /Available Developer skills: specify\./);
	assert.match(
		result.systemPrompt,
		/Action Loop capability inventory: 1 bound \(0 unavailable, 0 excluded\)\./,
	);
	assert.match(
		result.systemPrompt,
		/Route by the requested work product, not keywords/,
	);
	assert.match(
		result.systemPrompt,
		/Route doctor only for an explicitly requested scope-bound diagnosis/,
	);
	assert.match(
		result.systemPrompt,
		/disposition every other available Developer skill[\s\S]*owning skill[\s\S]*return to Doctor/,
	);
	assert.match(
		result.systemPrompt,
		/one agent-owned before-completion synthesis question/,
	);
	assert.match(
		result.systemPrompt,
		/choice-form response_spec with one field per decision/,
	);
	assert.match(result.systemPrompt, /Invariant gate:/);
	assert.match(result.systemPrompt, /unchecked assertion.*is not evidence/i);
	assert.doesNotMatch(
		result.systemPrompt,
		/Available Developer skills:.*model/,
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
		harness.tools.get(ROUTE_TOOL).execute("route-without-judgment", {
			question: "Can routing bypass the upper Judgment?",
			target: "specify",
			reason: "No Judgment has supplied a Contribution Need.",
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
	harness.setInputResult("The delegating human needs to inspect the current result.");
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
		(entry) => entry.customType === ACTIVATION_ENTRY,
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
	restored.setBranch([
		...activeBranch,
		{ type: "custom", ...pausedEntry },
	]);
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

test("human Observation durably waits and resumes on an exact predicate", async () => {
	const harness = createHarness();
	await developer(harness.api);
	await harness.emit("session_start", {
		type: "session_start",
		reason: "startup",
	});
	await harness.commands.get("developer").handler("on", harness.ctx);
	await openTestWorkCase(harness, "live-wait", false);
	harness.setInputResults([
		"The external package registry is unavailable.",
		"A bounded package registry probe succeeds.",
	]);
	await harness.commands.get("developer").handler("wait", harness.ctx);
	assert.equal(
		(harness.entries.at(-1)?.data as { kind?: string }).kind,
		"work-case-waiting",
	);
	const waitingTurn = await harness.emit("before_agent_start", {
		type: "before_agent_start",
		prompt: "continue",
		systemPrompt: "base",
		systemPromptOptions: { cwd: packageRoot, skills: loadedLeaves },
	});
	assert.match(waitingTurn.systemPrompt, /Waiting Action Loop Work Case:/);
	assert.match(
		waitingTurn.systemPrompt,
		/Resume predicate: A bounded package registry probe succeeds\./,
	);
	const blockedAction = await harness.emit("tool_call", {
		type: "tool_call",
		toolName: "bash",
		toolCallId: "bash-while-waiting",
		input: { command: "printf blocked" },
	});
	assert.equal(blockedAction.block, true);
	assert.match(blockedAction.reason, /waiting/);

	harness.setConfirmResult(true);
	await harness.commands.get("developer").handler("resume", harness.ctx);
	assert.equal(
		(harness.entries.at(-1)?.data as { kind?: string }).kind,
		"waiting-work-case-resumed",
	);
	const resumedTurn = await harness.emit("before_agent_start", {
		type: "before_agent_start",
		prompt: "continue",
		systemPrompt: "base",
		systemPromptOptions: { cwd: packageRoot, skills: loadedLeaves },
	});
	assert.match(resumedTurn.systemPrompt, /Active Action Loop Work Case:/);
	assert.doesNotMatch(resumedTurn.systemPrompt, /Resume predicate:/);
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
	const routed = await harness.tools.get(ROUTE_TOOL).execute(
		"route-one-need",
		{
			question: "What evidence supports the current completion Claim?",
			target: "verify",
			reason: "The sole current Contribution Need asks for a verifier.",
		},
		undefined,
		undefined,
		harness.ctx,
	);
	assert.match(resultText(routed), /Contribution Need: contribution_need_/);
	assert.match(resultText(routed), /claim-relevant verifier/);
	assert.match(resultText(routed), /Canonical selected Reference contract:/);
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
	assert.equal(contributed.details.compatibilityRouteClosed, true);
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
	first.setInputResult(
		"The current Effect cannot yet be settled from the available evidence.",
	);
	await first.commands.get("developer").handler("block", first.ctx);
	const blockedEntry = first.entries.find(
		(entry) => entryKind(entry) === "work-case-blocked",
	);
	assert.ok(blockedEntry);
	const blockedTurn = await first.emit("before_agent_start", {
		type: "before_agent_start",
		prompt: "inspect blocked",
		systemPrompt: "base",
		systemPromptOptions: { cwd: packageRoot, skills: loadedLeaves },
	});
	assert.match(blockedTurn.systemPrompt, /Blocked Action Loop Work Case:/);
	assert.match(blockedTurn.systemPrompt, /Claim Assurance:/);
	first.setInputResults([
		"The exact Effect Observation is now available for settlement.",
		"Settle the pending Effect from the current Observation.",
	]);
	await first.commands.get("developer").handler("resume", first.ctx);
	const resumedBlockedEntry = first.entries.find(
		(entry) => entryKind(entry) === "blocked-work-case-resumed",
	);
	assert.ok(resumedBlockedEntry);
	const blockContinuityEntries = [blockedEntry, resumedBlockedEntry].map(
		(entry) => ({ type: "custom", ...entry }),
	);
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
		...blockContinuityEntries,
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
		harness.tools.get(ROUTE_TOOL).execute(
			"route-not-applicable",
			{
				question: "Can a non-applicable Capability still be routed?",
				target: "specify",
				reason: "This route must fail without an assignment.",
			},
			undefined,
			undefined,
			harness.ctx,
		),
		/no current applicable assignment/i,
	);
});

test("a later turn can recover the active leaf method from its canonical location", async () => {
	const harness = await startHarness();
	const routed = await harness.tools.get(ROUTE_TOOL).execute(
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
	assert.match(resultText(routed), /Sealed Skill context: sealed_/);
	assert.match(resultText(routed), /exactly one Skill file · no References/);
	assert.match(String(routed.details.sealedContextId), /^sealed_[a-f0-9]{64}$/);
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
			reference_exemption: referenceExemption(),
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
			reference_exemption: referenceExemption(),
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
			reference_exemption: referenceExemption(),
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
			invariant_handling: {
				kind: "evidence-preserving-boundary",
				raw_representation: "ScheduleFormValues",
				refined_representation: "ScheduleContent",
				producer: "toScheduleContent",
				failure: "Invalid form result",
				first_effect: "Persist ScheduleContent",
			},
		},
		undefined,
		undefined,
		harness.ctx,
	);
	assert.equal(
		implementation.details.implementationStep.movement,
		"Add the first wished interface implementation",
	);
	assert.deepEqual(
		implementation.details.implementationStep.invariantHandling,
		{
			kind: "evidence-preserving-boundary",
			rawRepresentation: "ScheduleFormValues",
			refinedRepresentation: "ScheduleContent",
			producer: "toScheduleContent",
			failure: "Invalid form result",
			firstEffect: "Persist ScheduleContent",
		},
	);
	assert.match(implementation.content[0].text, /Invariant handling:/);
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
	await harness.commands.get("developer").handler("status", harness.ctx);
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
	await harness.commands.get("developer").handler("questions", harness.ctx);
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
			reference_exemption: referenceExemption(),
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
			reference_exemption: referenceExemption(),
			question_updates: [],
		},
		undefined,
		undefined,
		harness.ctx,
	);
	await harness.commands.get("developer").handler("status", harness.ctx);
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
			reference_exemption: referenceExemption(),
			question_updates: [],
		},
		undefined,
		undefined,
		harness.ctx,
	);
	await harness.commands.get("developer").handler("questions", harness.ctx);
	assert.ok((harness.notifications.at(-1)?.message ?? "").includes(questionId));
});

test("an unsafe in-process upgrade requires restart instead of silently stranding tools", async () => {
	const legacyEntry = {
		type: "custom",
		customType: "developer.mode",
		data: {
			protocol: "developer/v4",
			kind: "mode",
			mode: "strict",
		},
	};
	const harness = createHarness();
	harness.setActiveTools(["read"]);
	harness.setBranch([legacyEntry]);
	await developer(harness.api);
	await harness.emit("session_start", {
		type: "session_start",
		reason: "reload",
	});

	assert.deepEqual(harness.activeTools(), ["read"]);
	assert.match(
		harness.notifications.at(-1)?.message ?? "",
		/restart the Pi process/i,
	);
	assert.equal(
		harness.entries.some(
			(entry) => entry.customType === TOOL_POLICY_LIFECYCLE_ENTRY,
		),
		false,
	);

	await harness.commands.get("developer").handler("on", harness.ctx);
	assert.deepEqual(harness.activeTools(), ["read"]);
	assert.equal(
		harness.entries.some((entry) => entryKind(entry) === "activation"),
		false,
	);
	await harness.emit("session_shutdown", {
		type: "session_shutdown",
		reason: "reload",
	});
	assert.equal(
		harness.entries.some(
			(entry) => entry.customType === TOOL_POLICY_LIFECYCLE_ENTRY,
		),
		false,
	);
});

test("a fresh Pi startup accepts an older branch and establishes reload-safe ownership", async () => {
	const harness = createHarness();
	harness.setBranch([
		{
			type: "custom",
			customType: "developer.mode",
			data: {
				protocol: "developer/v4",
				kind: "mode",
				mode: "strict",
			},
		},
	]);
	await developer(harness.api);
	await harness.emit("session_start", {
		type: "session_start",
		reason: "startup",
	});

	assert.equal(
		harness.entries.some(
			(entry) => entry.customType === TOOL_POLICY_LIFECYCLE_ENTRY,
		),
		false,
	);
	await harness.commands.get("developer").handler("on", harness.ctx);
	assert.equal(harness.activeTools().includes("edit"), false);

	await harness.emit("session_shutdown", {
		type: "session_shutdown",
		reason: "reload",
	});
	assert.ok(harness.activeTools().includes("edit"));
	assert.ok(harness.activeTools().includes("write"));
	assert.ok(harness.activeTools().includes("bash"));
	assert.ok(
		harness.entries.some(
			(entry) => entry.customType === TOOL_POLICY_LIFECYCLE_ENTRY,
		),
	);
	assert.equal(harness.activeTools().includes(ROUTE_TOOL), false);
	assert.equal(harness.activeTools().includes(JUDGMENT_TOOL), false);
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

test("implementation routing uses additive built-in activation and preserves unrelated tools", async () => {
	const harness = createHarness();
	await developer(harness.api);
	await harness.emit("session_start", {
		type: "session_start",
		reason: "startup",
	});
	await harness.commands.get("developer").handler("on", harness.ctx);
	await openTestWorkCase(harness, "implementation-tools");
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
	assert.match(harness.notifications.at(-1)?.message ?? "", /developer: off/);

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

test("Settings is secondary and returns to the Workbench without hidden state changes", async () => {
	const harness = await startHarness();
	harness.ctx.mode = "tui";
	const entriesBeforeInspection = harness.entries.length;
	const callsBefore = harness.customCalls();
	harness.setCustomResults([undefined, undefined]);

	await harness.commands.get("developer").handler("settings", harness.ctx);

	assert.equal(harness.customCalls(), callsBefore + 2);
	assert.deepEqual(harness.customOptions.slice(-2), [
		undefined,
		FULL_SCREEN_SURFACE_OPTIONS,
	]);
	assert.equal(harness.entries.length, entriesBeforeInspection);
});

test("Workbench history inspection is read-only", async () => {
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
			reference_exemption: referenceExemption(),
		},
		undefined,
		undefined,
		harness.ctx,
	);
	const entriesBeforeInspection = harness.entries.length;
	const customCallsBeforeInspection = harness.customCalls();
	harness.setCustomResult(undefined);

	await harness.commands.get("developer").handler("", harness.ctx);

	assert.equal(harness.customCalls(), customCallsBeforeInspection + 1);
	assert.equal(harness.entries.length, entriesBeforeInspection);
});

test("Workbench rejects a stale Question action without branch mutation", async () => {
	const harness = await startHarness();
	harness.ctx.mode = "tui";
	const entriesBefore = harness.entries.length;
	const callsBefore = harness.customCalls();
	harness.setCustomResults([
		{ kind: "question", questionId: "question:stale" },
		undefined,
	]);

	await harness.commands.get("developer").handler("", harness.ctx);

	assert.equal(harness.customCalls(), callsBefore + 2);
	assert.equal(harness.entries.length, entriesBefore);
	assert.equal(
		harness.notifications.at(-1)?.message,
		"That Developer question is no longer open on the current branch.",
	);
});

test("/developer completes actions and confirms before discarding active TUI state", async () => {
	const harness = await startHarness();
	const command = harness.commands.get("developer");
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
			"This clears the active Action Loop Work Case and the active route from the current protocol state. Existing session history remains.",
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
	await harness.commands.get("developer").handler("status", harness.ctx);
	assert.deepEqual(harness.customOptions.at(-1), FULL_SCREEN_SURFACE_OPTIONS);

	const customCallsBeforeImplementationQuestion = harness.customCalls();
	harness.setCustomResults([
		{ kind: "question", questionId },
		"defer",
		undefined,
	]);
	harness.setEditorResult(undefined);
	await harness.commands.get("developer").handler("", harness.ctx);
	assert.equal(
		harness.customCalls(),
		customCallsBeforeImplementationQuestion + 3,
	);
	assert.equal(harness.sentUserMessages.length, 0);

	const customCallsBeforeSingleQuestionCancel = harness.customCalls();
	harness.setCustomResults(["continue", "defer"]);
	harness.setEditorResult(undefined);
	await harness.commands.get("developer").handler("questions", harness.ctx);
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
	await harness.commands.get("developer").handler("questions", harness.ctx);
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
			reference_exemption: referenceExemption(),
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
	await harness.commands.get("developer").handler("questions", harness.ctx);
	assert.equal(
		harness.notifications.at(-1)?.message,
		"Developer has no open questions on the current branch.",
	);
});

test("a multi-question editor cancel returns to the Workbench", async () => {
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

	await harness.commands.get("developer").handler("questions", harness.ctx);

	assert.equal(harness.customCalls(), customCallsBeforeQuestions + 5);
	const questionFlowOptions = harness.customOptions.slice(-5);
	assert.deepEqual(questionFlowOptions[0], FULL_SCREEN_SURFACE_OPTIONS);
	assert.equal(
		(questionFlowOptions[1] as { overlay?: boolean } | undefined)?.overlay,
		true,
	);
	assert.equal(
		(questionFlowOptions[2] as { overlay?: boolean } | undefined)?.overlay,
		true,
	);
	assert.deepEqual(questionFlowOptions[3], FULL_SCREEN_SURFACE_OPTIONS);
	assert.equal(
		(questionFlowOptions[4] as { overlay?: boolean } | undefined)?.overlay,
		true,
	);
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
	harness.setCustomResults([
		{ kind: "question", questionId: narrowQuestion.id },
		undefined,
		undefined,
	]);
	await harness.commands.get("developer").handler("", harness.ctx);
	assert.equal(harness.customCalls(), customCallsBeforeSelectorCancel + 3);
	const workbenchQuestionOptions = harness.customOptions.slice(-3);
	assert.deepEqual(workbenchQuestionOptions[0], FULL_SCREEN_SURFACE_OPTIONS);
	assert.equal(
		(workbenchQuestionOptions[1] as { overlay?: boolean } | undefined)?.overlay,
		true,
	);
	assert.deepEqual(workbenchQuestionOptions[2], FULL_SCREEN_SURFACE_OPTIONS);
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
