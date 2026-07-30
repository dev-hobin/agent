import {
	createAgentSession,
	DefaultResourceLoader,
	defineTool,
	getAgentDir,
	SessionManager,
	SettingsManager,
	type ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { Type, type TSchema } from "typebox";
import { Value } from "typebox/value";

import type {
	ObserverBackgroundJob,
	ObserverBackgroundJobResult,
} from "../src/observer-background-queue.ts";
import { decodeObservationAction } from "../src/observation-action.ts";
import type {
	ObserverWorkerImage,
	ObserverWorkerMaterial,
} from "../src/observer-worker-material.ts";

const WORKER_TOOL_NAME = "observer_background_sidecar";
const MAX_TOOL_CALLS = 20;
const WORKER_TIMEOUT_MS = 120_000;

const WORKER_SYSTEM_PROMPT = [
	"You are the isolated background worker for @hobin/observer.",
	"The user's foreground Pi response must never wait for your work.",
	"Use only observer_background_sidecar and only the actions requested by the supplied Observer guidance.",
	"Reconstruct source meaning before hydration. Ignore routine navigation and control output.",
	"For ordinary records observer_hypothesis must be null. Use record-new-hypothesis only for an independent Observer hypothesis.",
	"Never retry a failed tool action. A failure defers the job to a later explicit retry.",
	"Do not address the user or summarize the foreground task. End when the staged Observer work is complete or irrelevant.",
].join("\n");

export interface ObserverBackgroundToolResult {
	content: Array<{ type: "text"; text: string }>;
	details: unknown;
	terminate?: boolean;
}

export interface ObserverAgentBackgroundJob extends ObserverBackgroundJob {
	readonly mode: "routine" | "requests";
	readonly cwd: string;
	readonly model: NonNullable<ExtensionContext["model"]>;
	readonly parameters: TSchema;
	material(): ObserverWorkerMaterial | null;
	execute(
		value: unknown,
		signal: AbortSignal,
	): Promise<ObserverBackgroundToolResult>;
	refresh(): Promise<void>;
	notifyDeferred(): void;
}

function failureMessage(value: unknown): string | null {
	if (!value || typeof value !== "object" || Reflect.get(value, "ok") !== false)
		return null;
	const message = Reflect.get(value, "message");
	return typeof message === "string" && message.trim()
		? message.trim()
		: "Observer background action was deferred.";
}

function promptImages(
	images: readonly ObserverWorkerImage[],
): Array<{ type: "image"; data: string; mimeType: string }> {
	return images.map((image) => ({ ...image }));
}

export async function runObserverAgentBackgroundJob(
	job: ObserverAgentBackgroundJob,
	parentSignal: AbortSignal,
): Promise<ObserverBackgroundJobResult> {
	if (parentSignal.aborted) return { status: "aborted" };
	const material = job.material();
	if (!material) return { status: "skipped" };
	const settingsManager = SettingsManager.inMemory({
		compaction: { enabled: false },
		retry: { enabled: false, maxRetries: 0 },
	});
	const loader = new DefaultResourceLoader({
		cwd: job.cwd,
		agentDir: getAgentDir(),
		settingsManager,
		noExtensions: true,
		noSkills: true,
		noPromptTemplates: true,
		noThemes: true,
		noContextFiles: true,
		systemPrompt: WORKER_SYSTEM_PROMPT,
		appendSystemPrompt: [],
	});
	await loader.reload();
	if (parentSignal.aborted) return { status: "aborted" };
	let calls = 0;
	let deferred: string | null = null;
	const workerTool = defineTool({
		name: WORKER_TOOL_NAME,
		label: "Observer Background Sidecar",
		description:
			"Execute only the staged Observer action named by the isolated worker guidance. Failures are deferred and must not be retried in this run.",
		// Decode inside execute so a schema mismatch terminates this run instead
		// of being surfaced by Pi as a repairable tool-call validation error.
		parameters: Type.Unknown(),
		executionMode: "sequential",
		async execute(_toolCallId, params, signal) {
			if (deferred) {
				return {
					content: [
						{
							type: "text",
							text: "Observer already deferred this run; no retry was executed.",
						},
					],
					details: { ok: false, message: deferred },
					terminate: true,
				};
			}
			calls += 1;
			if (!Value.Check(job.parameters, params)) {
				const decoded = decodeObservationAction(params);
				deferred = decoded.ok
					? "Observer background proposal is not allowed in this worker lane."
					: `${decoded.issue.code}${decoded.issue.path}: ${decoded.issue.message}`;
				return {
					content: [
						{
							type: "text",
							text: `${deferred} Defer without retrying.`,
						},
					],
					details: { ok: false, message: deferred },
					terminate: true,
				};
			}
			if (calls > MAX_TOOL_CALLS) {
				deferred = `Observer background tool budget exceeded ${MAX_TOOL_CALLS} calls.`;
				return {
					content: [{ type: "text", text: deferred }],
					details: { ok: false, message: deferred },
					terminate: true,
				};
			}
			if (parentSignal.aborted || signal?.aborted) {
				return {
					content: [{ type: "text", text: "Observer background job aborted." }],
					details: { ok: false, message: "Observer background job aborted." },
					terminate: true,
				};
			}
			try {
				const actionSignal = signal
					? AbortSignal.any([parentSignal, signal])
					: parentSignal;
				const result = await job.execute(params, actionSignal);
				const message = failureMessage(result.details);
				if (message) deferred = message;
				return message ? { ...result, terminate: true } : result;
			} catch (error) {
				deferred = error instanceof Error ? error.message : String(error);
				return {
					content: [
						{
							type: "text",
							text: JSON.stringify({
								ok: false,
								message: deferred,
								retry: false,
							}),
						},
					],
					details: { ok: false, message: deferred },
					terminate: true,
				};
			}
		},
	});
	const { session } = await createAgentSession({
		cwd: job.cwd,
		model: job.model,
		thinkingLevel: "low",
		tools: [WORKER_TOOL_NAME],
		customTools: [workerTool],
		resourceLoader: loader,
		sessionManager: SessionManager.inMemory(job.cwd),
		settingsManager,
	});
	if (parentSignal.aborted) {
		session.dispose();
		return { status: "aborted" };
	}
	let timedOut = false;
	const abort = () => {
		void session.abort();
	};
	parentSignal.addEventListener("abort", abort, { once: true });
	const timeout = setTimeout(() => {
		timedOut = true;
		void session.abort();
	}, WORKER_TIMEOUT_MS);
	try {
		await session.prompt(material.text, {
			expandPromptTemplates: false,
			images: promptImages(material.images),
		});
		if (parentSignal.aborted) return { status: "aborted" };
		if (timedOut) {
			return {
				status: "deferred",
				message: "Observer background job exceeded its two-minute budget.",
			};
		}
		return deferred
			? { status: "deferred", message: deferred }
			: { status: "completed" };
	} finally {
		clearTimeout(timeout);
		parentSignal.removeEventListener("abort", abort);
		session.dispose();
	}
}
