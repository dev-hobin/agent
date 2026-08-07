import type { ResourceLoader } from "@earendil-works/pi-coding-agent";
import type { TSchema } from "typebox";

type PiSdkModule = typeof import("@earendil-works/pi-coding-agent");

export type PiSdkModelRuntime = Awaited<
	ReturnType<PiSdkModule["ModelRuntime"]["create"]>
>;

export type PiSdkModel = NonNullable<ReturnType<PiSdkModelRuntime["getModel"]>>;

type PiSdkAgentSession = Awaited<
	ReturnType<PiSdkModule["createAgentSession"]>
>["session"];

export interface PiSdkControllerBindings {
	readonly createAgentSession: PiSdkModule["createAgentSession"];
	readonly createExtensionRuntime: PiSdkModule["createExtensionRuntime"];
	readonly defineTool: PiSdkModule["defineTool"];
	readonly SessionManager: PiSdkModule["SessionManager"];
	readonly SettingsManager: PiSdkModule["SettingsManager"];
}

export interface SdkProposalAcceptance<T> {
	readonly status: "accepted";
	readonly value: T;
	readonly message: string;
	readonly resultStatus: string;
}

export interface SdkProposalRejection {
	readonly status: "rejected";
	readonly code: string;
	readonly message: string;
}

export type SdkProposalAdmission<T> =
	| SdkProposalAcceptance<T>
	| SdkProposalRejection;

export interface SdkProposalTool<T> {
	readonly name: string;
	readonly label: string;
	readonly description: string;
	readonly parameters: TSchema;
	readonly execute: (raw: unknown) => Promise<SdkProposalAdmission<T>>;
}

export interface SdkDecisionRequest<T> {
	readonly systemPrompt: string;
	readonly prompt: string;
	readonly tool: SdkProposalTool<T>;
}

export interface SdkDecisionMetrics {
	readonly runs: number;
	readonly toolCalls: number;
	readonly toolErrors: number;
	readonly runtimeFailures: number;
	readonly errorMessages: readonly string[];
}

export type SdkDecisionResult<T> =
	| {
			readonly status: "accepted";
			readonly value: T;
			readonly metrics: SdkDecisionMetrics;
	  }
	| {
			readonly status: "bounded-stop";
			readonly reason: "decision-run-budget";
			readonly metrics: SdkDecisionMetrics;
	  }
	| {
			readonly status: "runtime-failure";
			readonly message: string;
			readonly metrics: SdkDecisionMetrics;
	  };

export interface SdkDecisionRunner {
	run<T>(request: SdkDecisionRequest<T>): Promise<SdkDecisionResult<T>>;
}

export interface PiSdkDecisionControllerOptions {
	readonly bindings: PiSdkControllerBindings;
	readonly modelRuntime: PiSdkModelRuntime;
	readonly model: PiSdkModel;
	readonly cwd: string;
	readonly maxRuns: number;
	readonly maxToolErrorsPerRun: number;
	readonly thinkingLevel?:
		| "off"
		| "minimal"
		| "low"
		| "medium"
		| "high"
		| "xhigh";
}

interface DecisionCounters {
	runs: number;
	toolCalls: number;
	toolErrors: number;
	runtimeFailures: number;
	nonRuntimeRuns: number;
	readonly errorMessages: string[];
}

interface AttemptObservation {
	toolErrors: number;
}

type DecisionAttemptResult<T> =
	| { readonly status: "accepted"; readonly value: T }
	| { readonly status: "not-accepted" }
	| { readonly status: "runtime-failure"; readonly message: string };

function positiveInteger(value: number, label: string): number {
	if (!Number.isSafeInteger(value) || value < 1) {
		throw new RangeError(`${label} must be a positive safe integer`);
	}
	return value;
}

function compactError(error: unknown): string {
	const message = error instanceof Error ? error.message : String(error);
	return (
		message.replace(/\s+/g, " ").trim().slice(0, 320) || "Unknown SDK error"
	);
}

function fullControlLoader(
	bindings: PiSdkControllerBindings,
	systemPrompt: string,
): ResourceLoader {
	return {
		getExtensions: () => ({
			extensions: [],
			errors: [],
			runtime: bindings.createExtensionRuntime(),
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

function currentMetrics(counters: DecisionCounters): SdkDecisionMetrics {
	return Object.freeze({
		runs: counters.runs,
		toolCalls: counters.toolCalls,
		toolErrors: counters.toolErrors,
		runtimeFailures: counters.runtimeFailures,
		errorMessages: Object.freeze([...counters.errorMessages]),
	});
}

function resultText(result: {
	readonly content: readonly {
		readonly type: string;
		readonly text?: string;
	}[];
}): string {
	return result.content
		.flatMap((item) =>
			item.type === "text" && typeof item.text === "string" ? [item.text] : [],
		)
		.join(" ");
}

function subscribeToAttempt(input: {
	readonly session: PiSdkAgentSession;
	readonly toolName: string;
	readonly maximumErrors: number;
	readonly counters: DecisionCounters;
	readonly observation: AttemptObservation;
}): () => void {
	return input.session.subscribe((event) => {
		if (
			event.type === "tool_execution_start" &&
			event.toolName === input.toolName
		) {
			input.counters.toolCalls += 1;
			return;
		}
		if (
			event.type !== "tool_execution_end" ||
			event.toolName !== input.toolName ||
			!event.isError
		) {
			return;
		}
		input.observation.toolErrors += 1;
		input.counters.toolErrors += 1;
		input.counters.errorMessages.push(
			`${event.toolName}: ${compactError(resultText(event.result))}`,
		);
		if (input.observation.toolErrors >= input.maximumErrors) {
			void input.session.abort();
		}
	});
}

async function createDecisionSession(
	options: PiSdkDecisionControllerOptions,
	request: SdkDecisionRequest<unknown>,
	tool: ReturnType<PiSdkControllerBindings["defineTool"]>,
): Promise<PiSdkAgentSession> {
	const created = await options.bindings.createAgentSession({
		cwd: options.cwd,
		model: options.model,
		thinkingLevel: options.thinkingLevel ?? "medium",
		modelRuntime: options.modelRuntime,
		resourceLoader: fullControlLoader(options.bindings, request.systemPrompt),
		customTools: [tool],
		tools: [tool.name],
		sessionManager: options.bindings.SessionManager.inMemory(options.cwd),
		settingsManager: options.bindings.SettingsManager.inMemory({
			compaction: { enabled: false },
			retry: { enabled: false },
		}),
	});
	return created.session;
}

async function runDecisionAttempt<T>(input: {
	readonly options: PiSdkDecisionControllerOptions;
	readonly request: SdkDecisionRequest<T>;
	readonly maximumErrors: number;
	readonly counters: DecisionCounters;
}): Promise<DecisionAttemptResult<T>> {
	let acceptedProposal: { readonly value: T } | undefined;
	const observation: AttemptObservation = { toolErrors: 0 };
	const tool = input.options.bindings.defineTool({
		name: input.request.tool.name,
		label: input.request.tool.label,
		description: input.request.tool.description,
		parameters: input.request.tool.parameters,
		execute: async (_toolCallId, raw) => {
			const admission = await input.request.tool.execute(raw);
			if (admission.status === "rejected") {
				return {
					content: [{ type: "text", text: admission.message }],
					details: {
						accepted: false,
						status: "rejected",
						reason: admission.code,
					},
					isError: true,
				};
			}
			if (acceptedProposal === undefined) {
				acceptedProposal = { value: admission.value };
			}
			return {
				content: [{ type: "text", text: admission.message }],
				details: {
					accepted: true,
					status: admission.resultStatus,
					reason: "",
				},
			};
		},
	});

	let session: PiSdkAgentSession | undefined;
	let unsubscribe: (() => void) | undefined;
	let runtimeError: string | undefined;
	try {
		session = await createDecisionSession(input.options, input.request, tool);
		unsubscribe = subscribeToAttempt({
			session,
			toolName: input.request.tool.name,
			maximumErrors: input.maximumErrors,
			counters: input.counters,
			observation,
		});
		await session.prompt(input.request.prompt);
		input.counters.nonRuntimeRuns += 1;
	} catch (error) {
		if (observation.toolErrors >= input.maximumErrors) {
			input.counters.nonRuntimeRuns += 1;
		} else {
			input.counters.runtimeFailures += 1;
			runtimeError = compactError(error);
			input.counters.errorMessages.push(`runtime: ${runtimeError}`);
		}
	} finally {
		unsubscribe?.();
		session?.dispose();
	}

	if (acceptedProposal !== undefined) {
		return { status: "accepted", value: acceptedProposal.value };
	}
	return runtimeError === undefined
		? { status: "not-accepted" }
		: { status: "runtime-failure", message: runtimeError };
}

async function runBoundedDecision<T>(
	options: PiSdkDecisionControllerOptions,
	request: SdkDecisionRequest<T>,
	maximumRuns: number,
	maximumErrors: number,
): Promise<SdkDecisionResult<T>> {
	const counters: DecisionCounters = {
		runs: 0,
		toolCalls: 0,
		toolErrors: 0,
		runtimeFailures: 0,
		nonRuntimeRuns: 0,
		errorMessages: [],
	};
	let lastRuntimeError: string | undefined;
	for (let run = 1; run <= maximumRuns; run += 1) {
		counters.runs = run;
		const attempt = await runDecisionAttempt({
			options,
			request,
			maximumErrors,
			counters,
		});
		if (attempt.status === "accepted") {
			return {
				status: "accepted",
				value: attempt.value,
				metrics: currentMetrics(counters),
			};
		}
		if (attempt.status === "runtime-failure") {
			lastRuntimeError = attempt.message;
		}
	}

	if (counters.nonRuntimeRuns === 0 && lastRuntimeError !== undefined) {
		return {
			status: "runtime-failure",
			message: lastRuntimeError,
			metrics: currentMetrics(counters),
		};
	}
	return {
		status: "bounded-stop",
		reason: "decision-run-budget",
		metrics: currentMetrics(counters),
	};
}

/**
 * Creates a controller-owned, in-memory SDK decision runner. Model output can
 * only reach the caller through the supplied proposal admission function.
 */
export function createPiSdkDecisionRunner(
	options: PiSdkDecisionControllerOptions,
): SdkDecisionRunner {
	const maximumRuns = positiveInteger(options.maxRuns, "maxRuns");
	const maximumErrors = positiveInteger(
		options.maxToolErrorsPerRun,
		"maxToolErrorsPerRun",
	);
	return Object.freeze({
		run: <T>(request: SdkDecisionRequest<T>) =>
			runBoundedDecision(options, request, maximumRuns, maximumErrors),
	});
}
