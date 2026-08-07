import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import type { ResourceLoader } from "@earendil-works/pi-coding-agent";
import type { TSchema } from "typebox";

import {
	acceptCapabilityApplicability,
	type ApplicabilityAcceptanceResult,
	type ApplicabilityTarget,
} from "../src/action-loop/routing/accept-applicability.ts";
import {
	bindCapability,
	type BoundCapability,
} from "../src/action-loop/routing/bind-capability.ts";
import { bindReferenceSelection } from "../src/action-loop/routing/bind-reference-selection.ts";
import {
	parseTocBytes,
	type ParsedToc,
} from "../src/action-loop/routing/parse-toc.ts";
import {
	selectDeclaredReferences,
	type ReferenceDisposition,
} from "../src/action-loop/routing/reference-selection.ts";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const sdkPackageRoot = process.env.DEVELOPER_SDK_PI_ROOT;
if (!sdkPackageRoot) {
	throw new Error(
		"DEVELOPER_SDK_PI_ROOT must identify the exact @earendil-works/pi-coding-agent package under test",
	);
}
const sdkRequire = createRequire(join(sdkPackageRoot, "package.json"));
const sdk = (await import(
	pathToFileURL(join(sdkPackageRoot, "dist", "index.js")).href
)) as typeof import("@earendil-works/pi-coding-agent");
const ai = (await import(
	pathToFileURL(
		join(
			sdkPackageRoot,
			"node_modules",
			"@earendil-works",
			"pi-ai",
			"dist",
			"index.js",
		),
	).href
)) as typeof import("@earendil-works/pi-ai");
const typebox = (await import(
	pathToFileURL(
		join(sdkPackageRoot, "node_modules", "typebox", "build", "index.mjs"),
	).href
)) as typeof import("typebox");
const {
	createAgentSession,
	createExtensionRuntime,
	defineTool,
	ModelRuntime,
	SessionManager,
	SettingsManager,
} = sdk;
const { StringEnum } = ai;
const { Type } = typebox;
const sdkPackage = sdkRequire("./package.json") as {
	readonly version?: string;
};
if (!sdkPackage.version) throw new Error("SDK package version is unavailable");

const request =
	process.env.DEVELOPER_SDK_REQUEST ??
	"파일을 수정하지 말고 재시도 가능한 결제 승인 모델을 완성해라. Created, Authorizing(attempt, requestId), Authorized(paymentId), Failed 상태와 stale, duplicate, reordered approval을 구분하고 safety/progress 가정, 금지 반례, 검증 대상을 제시해라.";
const modelSpec = process.env.DEVELOPER_SDK_MODEL ?? "openai-codex/gpt-5.6-sol";
const maxDecisionRuns = Number(process.env.DEVELOPER_SDK_MAX_RUNS ?? 2);
const maxToolErrorsPerRun = Number(
	process.env.DEVELOPER_SDK_MAX_TOOL_ERRORS ?? 3,
);

type ModelRuntimeInstance = Awaited<ReturnType<typeof ModelRuntime.create>>;

interface DecisionRun<T> {
	readonly value: T;
	readonly runs: number;
	readonly toolErrors: number;
	readonly errorMessages: readonly string[];
}

interface ApplicabilityDecision {
	readonly result: Exclude<
		ApplicabilityAcceptanceResult,
		{ status: "invalid" }
	>;
	readonly basis: string;
}

interface ReferenceDecision {
	readonly dispositions: readonly ReferenceDisposition[];
}

function fullControlLoader(systemPrompt: string): ResourceLoader {
	return {
		getExtensions: () => ({
			extensions: [],
			errors: [],
			runtime: createExtensionRuntime(),
		}),
		getSkills: () => ({ skills: [], diagnostics: [] }),
		getPrompts: () => ({ prompts: [], diagnostics: [] }),
		getThemes: () => ({ themes: [], diagnostics: [] }),
		getAgentsFiles: () => ({ agentsFiles: [] }),
		getSystemPrompt: () => systemPrompt,
		getAppendSystemPrompt: () => [],
		extendResources: () => {},
		reload: async () => {},
	};
}

async function runBoundedDecision<T>(input: {
	readonly modelRuntime: ModelRuntimeInstance;
	readonly model: NonNullable<ReturnType<ModelRuntimeInstance["getModel"]>>;
	readonly systemPrompt: string;
	readonly prompt: string;
	readonly makeTool: (
		accept: (value: T) => void,
	) => ReturnType<typeof defineTool>;
}): Promise<DecisionRun<T>> {
	let totalErrors = 0;
	const errorMessages: string[] = [];
	for (let run = 1; run <= maxDecisionRuns; run += 1) {
		let accepted: T | undefined;
		let runErrors = 0;
		const tool = input.makeTool((value) => {
			if (accepted === undefined) accepted = value;
		});
		const settingsManager = SettingsManager.inMemory({
			compaction: { enabled: false },
			retry: { enabled: false },
		});
		const { session } = await createAgentSession({
			cwd: root,
			model: input.model,
			thinkingLevel: "medium",
			modelRuntime: input.modelRuntime,
			resourceLoader: fullControlLoader(input.systemPrompt),
			customTools: [tool],
			tools: [tool.name],
			sessionManager: SessionManager.inMemory(root),
			settingsManager,
		});
		const unsubscribe = session.subscribe((event) => {
			if (event.type !== "tool_execution_end" || !event.isError) return;
			runErrors += 1;
			totalErrors += 1;
			const message = event.result.content
				.filter((item) => item.type === "text")
				.map((item) => item.text)
				.join(" ")
				.replace(/\s+/g, " ")
				.slice(0, 320);
			errorMessages.push(`${event.toolName}: ${message}`);
			if (runErrors >= maxToolErrorsPerRun) void session.abort();
		});
		try {
			await session.prompt(input.prompt);
			if (accepted !== undefined) {
				return {
					value: accepted,
					runs: run,
					toolErrors: totalErrors,
					errorMessages,
				};
			}
		} finally {
			unsubscribe();
			session.dispose();
		}
	}
	throw new Error(
		`SDK controller exhausted ${maxDecisionRuns} bounded decision runs without an accepted proposal`,
	);
}

async function loadTarget(): Promise<{
	readonly target: ApplicabilityTarget;
	readonly capability: BoundCapability;
	readonly toc: ParsedToc;
}> {
	const skillPath = join(root, "skills", "model", "SKILL.md");
	const tocPath = join(root, "skills", "model", "toc.json");
	const [skillBytes, tocBytes] = await Promise.all([
		readFile(skillPath),
		readFile(tocPath),
	]);
	const parsed = parseTocBytes(tocBytes);
	if (!parsed.ok) throw new Error(parsed.error.message);
	const bound = bindCapability(
		{
			kind: "package",
			locator: "npm:@hobin/developer",
			skillRoot: "skills/model",
		},
		parsed.value,
		skillBytes,
	);
	if (!bound.ok) throw new Error(bound.error.message);
	return {
		capability: bound.value,
		toc: parsed.value,
		target: {
			workCaseId: "sdk-routing-spike-work-case",
			judgmentId: "sdk-routing-spike-judgment",
			contributionNeedId: "sdk-routing-spike-need",
			capability: bound.value,
		},
	};
}

const modelRuntime = await ModelRuntime.create();
const separator = modelSpec.indexOf("/");
if (separator <= 0 || separator === modelSpec.length - 1) {
	throw new Error(`Expected provider/model, received ${modelSpec}`);
}
const provider = modelSpec.slice(0, separator);
const modelId = modelSpec.slice(separator + 1);
const model = modelRuntime.getModel(provider, modelId);
if (!model) throw new Error(`Model is not registered: ${modelSpec}`);

const { target, capability, toc } = await loadTarget();
const applicability = await runBoundedDecision<ApplicabilityDecision>({
	modelRuntime,
	model,
	systemPrompt: [
		"You make one bounded semantic applicability proposal.",
		"Call the supplied decision tool exactly once. Do not copy condition text into tool arguments.",
		"The SDK controller owns all identities, exact conditions, validation, retry limits, and state transitions.",
	].join("\n"),
	prompt: [
		`User request: ${request}`,
		`Capability when: ${toc.when.join(" | ")}`,
		`Capability unless: ${toc.unless.join(" | ") || "none"}`,
		"Decide only whether the Capability applies to this request.",
	].join("\n"),
	makeTool: (accept) =>
		defineTool({
			name: "submit_capability_applicability",
			label: "Submit capability applicability",
			description:
				"Submit one semantic applicability decision; the SDK controller supplies exact canonical conditions.",
			parameters: Type.Object({
				status: StringEnum([
					"applicable",
					"not-applicable",
					"needs-context",
				] as const),
				matches_when: Type.Boolean(),
				matches_unless: Type.Boolean(),
				basis: Type.String({ minLength: 1, maxLength: 2_048 }),
				missing_context: Type.Optional(Type.String({ maxLength: 2_048 })),
			}),
			execute: async (_toolCallId, params) => {
				const result = acceptCapabilityApplicability(target, {
					workCaseId: target.workCaseId,
					judgmentId: target.judgmentId,
					contributionNeedId: target.contributionNeedId,
					capabilityRevisionId: target.capability.capabilityRevisionId,
					status: params.status,
					matchedWhen: params.matches_when ? toc.when : [],
					matchedUnless: params.matches_unless ? toc.unless : [],
					basis: [params.basis],
					missingContext:
						params.status === "needs-context" && params.missing_context?.trim()
							? [params.missing_context]
							: [],
				});
				if (result.status === "invalid") {
					const details: {
						accepted: boolean;
						status: string;
						reason: string;
					} = {
						accepted: false,
						status: "invalid",
						reason: result.error.code,
					};
					return {
						content: [{ type: "text", text: result.error.message }],
						details,
						isError: true,
					};
				}
				accept({ result, basis: params.basis });
				const details: {
					accepted: boolean;
					status: string;
					reason: string;
				} = {
					accepted: true,
					status: result.status,
					reason: "",
				};
				return {
					content: [
						{
							type: "text",
							text: `Applicability accepted as ${result.status}.`,
						},
					],
					details,
				};
			},
		}),
});

if (applicability.value.result.status !== "assigned") {
	console.log(
		JSON.stringify({
			protocol: "developer-sdk-routing-spike/v1",
			piVersion: sdkPackage.version,
			model: modelSpec,
			applicability: {
				status: applicability.value.result.status,
				runs: applicability.runs,
				toolErrors: applicability.toolErrors,
				errorMessages: applicability.errorMessages,
			},
			references: [],
			selection: "not-applicable",
		}),
	);
	process.exit(0);
}

const referenceStatusValues = [
	"selected",
	"not-needed",
	"needs-context",
] as const;
const isReferenceStatus = (
	value: unknown,
): value is ReferenceDisposition["status"] =>
	typeof value === "string" &&
	(referenceStatusValues as readonly string[]).includes(value);
const referenceFields: Record<string, TSchema> = {};
for (const [index, reference] of toc.references.entries()) {
	referenceFields[`status_${index}`] = StringEnum(referenceStatusValues, {
		description: `${reference.path} — ${reference.when.join(" | ")}`,
	});
	referenceFields[`basis_${index}`] = Type.String({
		minLength: 1,
		maxLength: 2_048,
		description: `Why ${reference.path} is selected, not needed, or needs context relative to every other declared Reference.`,
	});
}
const referenceDecision = await runBoundedDecision<ReferenceDecision>({
	modelRuntime,
	model,
	systemPrompt: [
		"You make one comparative local Reference routing proposal.",
		"Call the supplied decision tool exactly once and disposition every declared Reference.",
		"Choose the smallest set whose conditions materially apply; adjacent subject matter alone is not enough.",
		"The SDK controller owns exact paths, complete inventory, validation, retry limits, and canonical binding.",
	].join("\n"),
	prompt: [
		`User request: ${request}`,
		"Compare all declared Reference conditions before deciding:",
		...toc.references.map(
			(reference, index) =>
				`[${index}] ${reference.path} — ${reference.when.join(" | ")}`,
		),
		"For every index, submit status_N and basis_N. Select only materially necessary References.",
	].join("\n"),
	makeTool: (accept) =>
		defineTool({
			name: "submit_reference_dispositions",
			label: "Submit comparative Reference dispositions",
			description:
				"Disposition every declared Reference in one comparative proposal; the SDK controller maps flat fields to canonical paths.",
			parameters: Type.Object(referenceFields, { additionalProperties: false }),
			execute: async (_toolCallId, params) => {
				const dispositions: ReferenceDisposition[] = [];
				for (const [index, reference] of toc.references.entries()) {
					const status = params[`status_${index}`];
					const basis = params[`basis_${index}`];
					if (!isReferenceStatus(status) || typeof basis !== "string") {
						return {
							content: [
								{
									type: "text",
									text: `Reference disposition ${index} is not canonical.`,
								},
							],
							details: { accepted: false, status: "invalid" },
							isError: true,
						};
					}
					dispositions.push({ path: reference.path, status, basis: [basis] });
				}
				const selected = selectDeclaredReferences(toc.references, dispositions);
				if (selected.status === "invalid") {
					return {
						content: [
							{
								type: "text",
								text: `Reference dispositions are invalid: ${selected.issues.map((issue) => `${issue.code}:${issue.path}`).join(" | ")}`,
							},
						],
						details: { accepted: false, status: "invalid" },
						isError: true,
					};
				}
				accept({ dispositions });
				return {
					content: [
						{
							type: "text",
							text: `Comparative Reference dispositions accepted as ${selected.status}.`,
						},
					],
					details: { accepted: true, status: selected.status },
				};
			},
		}),
});
const dispositions = [...referenceDecision.value.dispositions];
const referenceRuns = dispositions.map((disposition) => ({
	path: disposition.path,
	status: disposition.status,
	basis: disposition.basis,
	runs: referenceDecision.runs,
	toolErrors: referenceDecision.toolErrors,
	errorMessages: referenceDecision.errorMessages,
}));

const selection = selectDeclaredReferences(toc.references, dispositions);
if (selection.status === "invalid") {
	const issue = selection.issues[0];
	throw new Error(
		issue ? `${issue.code}: ${issue.path}` : "Invalid Reference selection",
	);
}
const bound = bindReferenceSelection(
	applicability.value.result.assignment,
	capability,
	selection,
);
if (!bound.ok) throw new Error(`${bound.error.code}: ${bound.error.message}`);

console.log(
	JSON.stringify({
		protocol: "developer-sdk-routing-spike/v1",
		piVersion: sdkPackage.version,
		model: modelSpec,
		applicability: {
			status: applicability.value.result.status,
			runs: applicability.runs,
			toolErrors: applicability.toolErrors,
			errorMessages: applicability.errorMessages,
		},
		references: referenceRuns,
		selection: {
			status: bound.value.status,
			selectedPaths: bound.value.selectedPaths,
		},
	}),
);
