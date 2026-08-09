import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import {
	cp,
	mkdir,
	readdir,
	readFile,
	rm,
	symlink,
	writeFile,
} from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
	DefaultResourceLoader,
	SessionManager,
} from "@earendil-works/pi-coding-agent";

import { ACTION_LOOP_LIVE_CASES } from "../evals/action-loop-live-cases.mjs";
import {
	MODEL_FACING_ACTION_LOOP_TOOLS,
	isModelFacingActionLoopTool,
} from "../extensions/action-loop-model-tools.ts";
import { parseDeveloperStatus } from "./developer-status-classification.mjs";
import { createJsonlDecoder } from "./jsonl.mjs";
import {
	classifySdkResumeRun,
	isSdkReplayRecoveryRequired,
	repeatedPrimaryResultWithoutCheckpoint,
	summarizeSdkResumeRun,
} from "./sdk-resume-classification.mjs";

const caseId = process.argv[2];
const fixture = ACTION_LOOP_LIVE_CASES.find((candidate) => candidate.id === caseId);
if (!fixture) throw new Error(`Unknown Action Loop live case: ${caseId}`);

const packageRoot = resolve(requiredEnv("DEVELOPER_EVAL_PACKAGE_PATH"));
const matrixRoot = resolve(requiredEnv("DEVELOPER_EVAL_MATRIX_ROOT"));
const configDir = resolve(requiredEnv("PI_CODING_AGENT_DIR"));
const workspace = join(matrixRoot, "workspaces", fixture.id);
const sessionDir = join(matrixRoot, "sessions", fixture.id);
const sessionFile = join(sessionDir, "session.jsonl");
const piBin = process.env.PI_BIN || "pi";
const model = process.env.DEVELOPER_EVAL_MODEL || "github-copilot/claude-sonnet-4.6";
const thinking = process.env.DEVELOPER_EVAL_THINKING || "medium";
const maximumRuns = boundedInteger("DEVELOPER_EVAL_MAX_RUNS", 4, 1, 12);
const runTimeoutMs = boundedInteger(
	"DEVELOPER_EVAL_TIMEOUT_MS",
	180_000,
	10_000,
	600_000,
);
const noProgressTimeoutMs = boundedInteger(
	"DEVELOPER_EVAL_NO_PROGRESS_MS",
	60_000,
	5_000,
	300_000,
);
const continuationPrompt =
	"Resume the current canonical Action Loop from acknowledged branch checkpoints. Use developer_progress_action_loop only for protocol progression. After a Judgment refusal, use an exact host Observation and copy an exact semantic contribution_need selector listed by progression; never guess an internal identity. Do not infer Effect success or completion from a tool return.";

function requiredEnv(name) {
	const value = process.env[name];
	if (!value) throw new Error(`${name} is required.`);
	return value;
}

function boundedInteger(name, fallback, minimum, maximum) {
	const value = Number(process.env[name] || fallback);
	if (!Number.isInteger(value) || value < minimum || value > maximum) {
		throw new Error(`${name} must be an integer from ${minimum} through ${maximum}.`);
	}
	return value;
}

async function writeFixtureFiles() {
	await rm(workspace, { recursive: true, force: true });
	await rm(sessionDir, { recursive: true, force: true });
	await mkdir(workspace, { recursive: true });
	await mkdir(sessionDir, { recursive: true });
	for (const [path, content] of Object.entries(fixture.files)) {
		const target = join(workspace, path);
		await mkdir(dirname(target), { recursive: true });
		await writeFile(target, content);
	}
}

async function snapshotFiles(root) {
	const files = new Map();
	async function visit(directory) {
		const entries = await readdir(directory, { withFileTypes: true });
		entries.sort((left, right) => left.name.localeCompare(right.name));
		for (const entry of entries) {
			if (entry.name === ".git") continue;
			const absolute = join(directory, entry.name);
			if (entry.isDirectory()) {
				await visit(absolute);
				continue;
			}
			if (!entry.isFile()) continue;
			files.set(relative(root, absolute), await readFile(absolute, "utf8"));
		}
	}
	await visit(root);
	return files;
}

function changedPaths(before, after) {
	const paths = new Set([...before.keys(), ...after.keys()]);
	return [...paths]
		.filter((path) => before.get(path) !== after.get(path))
		.sort((left, right) => left.localeCompare(right));
}

function piArguments(observerPath) {
	return [
		"--mode",
		"rpc",
		"--offline",
		"--session",
		sessionFile,
		"--model",
		model,
		"--thinking",
		thinking,
		"--no-extensions",
		"--no-skills",
		"--extension",
		resolve(packageRoot, "extensions", "developer.ts"),
		"--extension",
		observerPath,
		"--skill",
		resolve(packageRoot, "skills"),
		"--developer",
	];
}

function startPi() {
	const observerPath = resolve(import.meta.dirname, "eval-observer.ts");
	const child = spawn(piBin, piArguments(observerPath), {
		cwd: workspace,
		env: {
			...process.env,
			PI_CODING_AGENT_DIR: configDir,
			DEVELOPER_EVAL_WORKSPACE: workspace,
		},
		stdio: ["pipe", "pipe", "pipe"],
	});
	let stderr = "";
	let exited;
	const closed = new Promise((resolveClosed) => {
		child.once("close", (code, signal) => {
			exited = { code, signal };
			resolveClosed(exited);
		});
	});
	child.stderr.setEncoding("utf8");
	child.stderr.on("data", (chunk) => {
		stderr += chunk;
	});
	const events = [];
	const responses = new Map();
	const waiters = new Map();
	let nextId = 1;
	const decoder = createJsonlDecoder({
		onValue(value) {
			events.push(value);
			if (value.type !== "response" || !value.id) return;
			responses.set(value.id, value);
			const waiter = waiters.get(value.id);
			if (!waiter) return;
			waiters.delete(value.id);
			waiter(value);
		},
		onError(error, record) {
			stderr += `\nRPC JSONL parse error: ${error.message}\nRecord: ${record}`;
		},
	});
	child.stdout.on("data", (chunk) => decoder.push(chunk));
	child.stdout.on("end", () => decoder.end());
	child.on("error", (error) => {
		stderr += `\nPi spawn error: ${error.message}`;
		for (const waiter of waiters.values()) {
			waiter({ success: false, error: error.message });
		}
		waiters.clear();
	});

	function send(command, timeoutMs = 15_000) {
		const id = `developer-live-${fixture.id}-${nextId++}`;
		child.stdin.write(`${JSON.stringify({ ...command, id })}\n`);
		return new Promise((resolveResponse, reject) => {
			const existing = responses.get(id);
			if (existing) return resolveResponse(existing);
			const timer = setTimeout(() => {
				waiters.delete(id);
				reject(new Error(`RPC timeout for ${command.type}\n${stderr}`));
			}, timeoutMs);
			waiters.set(id, (response) => {
				clearTimeout(timer);
				resolveResponse(response);
			});
		});
	}

	async function stop() {
		if (child.exitCode === null && child.signalCode === null) {
			child.stdin.end();
			child.kill("SIGTERM");
			await Promise.race([
				closed,
				new Promise((resolveDelay) => setTimeout(resolveDelay, 5_000)),
			]);
			if (child.exitCode === null && child.signalCode === null) {
				child.kill("SIGKILL");
				await closed;
			}
		}
		return exited;
	}
	return { child, events, send, stop, stderr: () => stderr, exited: () => exited };
}

async function waitForRun(runtime, start) {
	const startedAt = Date.now();
	let observed = start;
	let lastProgressAt = startedAt;
	while (true) {
		const trace = runtime.events.slice(start);
		const repeated = repeatedPrimaryResultWithoutCheckpoint(trace, 4);
		if (repeated) {
			return {
				status: "usability-stalled",
				reason: `repeated-primary-result:${repeated}`,
				elapsedMs: Date.now() - startedAt,
			};
		}
		const recoveryFailure = trace.find(
			(event) =>
				event.type === "tool_execution_end" &&
				event.isError &&
				isSdkReplayRecoveryRequired(
					(event.result?.content ?? [])
						.filter(
							(item) =>
								item.type === "text" && typeof item.text === "string",
						)
						.map((item) => item.text)
						.join("\n"),
				),
		);
		if (recoveryFailure) {
			return {
				status: "recovery-required",
				elapsedMs: Date.now() - startedAt,
			};
		}
		if (
			trace.some(
				(event) => event.type === "agent_settled" || event.type === "agent_end",
			)
		) {
			return { status: "settled", elapsedMs: Date.now() - startedAt };
		}
		if (runtime.exited()) {
			return {
				status: "bounded-stop",
				reason: `pi-exited:${JSON.stringify(runtime.exited())}`,
				elapsedMs: Date.now() - startedAt,
			};
		}
		if (runtime.events.length > observed) {
			const progress = runtime.events
				.slice(observed)
				.some((event) =>
					[
						"message_update",
						"message_end",
						"tool_execution_start",
						"tool_execution_update",
						"tool_execution_end",
						"entry_appended",
					].includes(event.type),
				);
			if (progress) lastProgressAt = Date.now();
			observed = runtime.events.length;
		}
		const now = Date.now();
		if (now - startedAt >= runTimeoutMs) {
			return {
				status: "bounded-stop",
				reason: "run-timeout",
				elapsedMs: now - startedAt,
			};
		}
		if (now - lastProgressAt >= noProgressTimeoutMs) {
			return {
				status: "bounded-stop",
				reason: "no-progress-timeout",
				elapsedMs: now - startedAt,
			};
		}
		await new Promise((resolveDelay) => setTimeout(resolveDelay, 50));
	}
}

async function currentStatus(runtime) {
	const start = runtime.events.length;
	const response = await runtime.send({ type: "prompt", message: "/developer status" });
	assert.equal(response.success, true, response.error);
	const notification = runtime.events
		.slice(start)
		.find(
			(event) =>
				event.type === "extension_ui_request" && event.method === "notify",
		);
	return notification
		? parseDeveloperStatus(notification.message)
		: parseDeveloperStatus("developer · unknown");
}

async function prepareReplayRuntime() {
	const runtimeRoot = join(matrixRoot, "replay-runtime", fixture.id, "developer");
	await rm(dirname(runtimeRoot), { recursive: true, force: true });
	await mkdir(dirname(runtimeRoot), { recursive: true });
	await cp(packageRoot, runtimeRoot, {
		recursive: true,
		filter: (source) => source !== resolve(packageRoot, "node_modules"),
	});
	const evaluatedNodeModules = resolve(packageRoot, "../..");
	await symlink(
		evaluatedNodeModules,
		join(runtimeRoot, "node_modules"),
		"dir",
	);
	return runtimeRoot;
}

async function deterministicReplay(activeSessionFile) {
	const skillsRoot = resolve(packageRoot, "skills");
	const replayRuntime = await prepareReplayRuntime();
	const targetInventoryModule = await import(
		pathToFileURL(
			resolve(
				replayRuntime,
				"extensions",
				"action-loop-capability-inventory.ts",
			),
		).href
	);
	const targetSessionModule = await import(
		pathToFileURL(
			resolve(replayRuntime, "extensions", "action-loop-session.ts"),
		).href
	);
	const loaderAgentDir = join(matrixRoot, "replay-agent-dir", fixture.id);
	await mkdir(loaderAgentDir, { recursive: true });
	const loader = new DefaultResourceLoader({
		cwd: workspace,
		agentDir: loaderAgentDir,
		additionalSkillPaths: [skillsRoot],
		noExtensions: true,
		noPromptTemplates: true,
		noThemes: true,
		noContextFiles: true,
	});
	await loader.reload();
	const loaded = loader.getSkills();
	if (loaded.diagnostics.length > 0) {
		return {
			status: "unavailable",
			message: `Skill diagnostics: ${JSON.stringify(loaded.diagnostics)}`,
		};
	}
	const inventory = await targetInventoryModule.prepareLiveCapabilityInventory(
		{ systemPromptOptions: { cwd: workspace, skills: loaded.skills } },
		skillsRoot,
	);
	if (inventory.status !== "ready") {
		return {
			status: "unavailable",
			message: `Capability inventory: ${inventory.error.code}`,
		};
	}
	const manager = SessionManager.open(
		activeSessionFile,
		dirname(activeSessionFile),
		workspace,
	);
	const branch = manager.getBranch();
	const eventKinds = [];
	const eventErrors = [];
	for (const entry of branch) {
		if (
			entry.type !== "custom" ||
			entry.customType !== targetSessionModule.ACTION_LOOP_SESSION_ENTRY
		) {
			continue;
		}
		try {
			targetSessionModule.assertPersistableActionLoopSessionEvent(entry.data);
			eventKinds.push(entry.data.kind);
		} catch (error) {
			eventErrors.push(error instanceof Error ? error.message : String(error));
		}
	}
	const replay = await targetSessionModule.replayActionLoopSession(
		branch,
		inventory,
	);
	if (replay.status !== "ready") {
		return {
			status: "unavailable",
			message: `entry ${replay.entryIndex}: ${replay.message}`,
			eventKinds,
			eventErrors,
		};
	}
	let replayStatus = "idle";
	if (replay.completedWorkCase) replayStatus = "completed";
	else if (replay.heldWorkCase)
		replayStatus = replay.heldWorkCase.workCase.status;
	else if (replay.activeWorkCase) replayStatus = "active";
	return {
		status: "ready",
		replayStatus,
		appliedTransitions: replay.appliedTransitions,
		eventKinds,
		eventErrors,
	};
}

function evaluateOracle({
	before,
	after,
	replay,
	runs,
	providerBlock,
	usabilityStop,
}) {
	const canonicalViolations = [];
	const taskViolations = [];
	const livenessGaps = [];
	const verifierGaps = [];
	if (replay.status !== "ready") {
		if (replay.verifierError) verifierGaps.push(replay.message);
		else canonicalViolations.push(replay.message);
	}
	if (replay.eventErrors?.length > 0) canonicalViolations.push(...replay.eventErrors);
	const developerCalls = runs
		.flatMap((run) => run.toolCalls)
		.filter((name) => name.startsWith("developer_"));
	const unrecognizedDeveloperCalls = developerCalls.filter(
		(name) => !isModelFacingActionLoopTool(name),
	);
	if (unrecognizedDeveloperCalls.length > 0) {
		taskViolations.push(
			`Unrecognized Developer calls: ${unrecognizedDeveloperCalls.join(", ")}`,
		);
	}
	const changed = changedPaths(before, after);
	const allowedChanges = new Set(fixture.allowedChangedPaths ?? []);
	for (const path of changed) {
		if (!allowedChanges.has(path)) {
			taskViolations.push(`Unexpected workspace mutation: ${path}`);
		}
	}
	for (const [path, expected] of Object.entries(fixture.expectedFiles ?? {})) {
		const actual = after.has(path) ? after.get(path) : null;
		if (actual === expected) continue;
		const initial = before.has(path) ? before.get(path) : null;
		const message = `File oracle mismatch for ${path}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`;
		if (
			fixture.completion === "required" &&
			replay.replayStatus !== "completed" &&
			actual === initial
		) {
			livenessGaps.push(message);
		} else {
			taskViolations.push(message);
		}
	}
	const replayStatus = replay.replayStatus ?? "unavailable";
	if (fixture.completion === "forbidden" && replayStatus === "completed") {
		taskViolations.push("Completion was accepted for a fixture that forbids it.");
	}
	if (fixture.completion === "required" && replayStatus !== "completed") {
		livenessGaps.push(`Required completion was not reached (${replayStatus}).`);
	}
	if (!(fixture.allowedReplayStatuses ?? []).includes(replayStatus)) {
		livenessGaps.push(
			`Replay status ${replayStatus} is outside ${fixture.allowedReplayStatuses.join(", ")}.`,
		);
	}
	const actionClearances = (replay.eventKinds ?? []).filter(
		(kind) => kind === "action-cleared",
	).length;
	if (
		fixture.maximumActionClearances !== undefined &&
		actionClearances > fixture.maximumActionClearances
	) {
		taskViolations.push(
			`Observed ${actionClearances} Action Clearances; maximum is ${fixture.maximumActionClearances}.`,
		);
	}
	for (const requiredKind of fixture.requiredEventKinds ?? []) {
		if (!(replay.eventKinds ?? []).includes(requiredKind)) {
			const message = `Required semantic event is absent: ${requiredKind}`;
			if (replayStatus === "completed") canonicalViolations.push(message);
			else livenessGaps.push(message);
		}
	}
	let classification = "pass";
	if (canonicalViolations.length > 0) classification = "implementation-fail";
	else if (taskViolations.length > 0) classification = "model-or-spec-fail";
	else if (verifierGaps.length > 0) classification = "verifier-gap";
	else if (providerBlock) classification = "blocked-environment";
	else if (livenessGaps.length > 0) classification = "pass-but-wrong-risk";
	let taskBehavior = "pass";
	if (taskViolations.length > 0) taskBehavior = "fail";
	else if (livenessGaps.length > 0) taskBehavior = "incomplete";
	return {
		classification,
		canonicalSafety: canonicalViolations.length === 0 ? "pass" : "fail",
		taskBehavior,
		replayStatus,
		changedPaths: changed,
		actionClearances,
		developerCalls,
		unrecognizedDeveloperCalls,
		canonicalViolations,
		taskViolations,
		verifierGaps,
		livenessGaps,
		...(providerBlock ? { providerBlock } : {}),
		...(usabilityStop ? { usabilityStop } : {}),
	};
}

await writeFixtureFiles();
const before = await snapshotFiles(workspace);
const piVersionResult = spawnSync(piBin, ["--version"], { encoding: "utf8" });
if (piVersionResult.status !== 0) {
	throw new Error(`Could not resolve Pi version: ${piVersionResult.stderr}`);
}
const runtime = startPi();
const runs = [];
let status = parseDeveloperStatus("developer · unknown");
let providerBlock;
let usabilityStop;
let activeSessionFile = sessionFile;
try {
	const state = await runtime.send({ type: "get_state" });
	assert.equal(state.success, true, state.error);
	assert.equal(`${state.data.model.provider}/${state.data.model.id}`, model);
	activeSessionFile = resolve(state.data.sessionFile);
	for (let index = 1; index <= maximumRuns; index += 1) {
		const start = runtime.events.length;
		const response = await runtime.send({
			type: "prompt",
			message: index === 1 ? fixture.prompt : continuationPrompt,
		});
		assert.equal(response.success, true, response.error);
		const wait = await waitForRun(runtime, start);
		if (
			wait.status === "bounded-stop" ||
			wait.status === "recovery-required" ||
			wait.status === "usability-stalled"
		) {
			const aborted = await runtime.send({ type: "abort" }, 5_000);
			assert.equal(aborted.success, true, aborted.error);
		}
		const run = summarizeSdkResumeRun(index, runtime.events.slice(start), wait);
		runs.push(run);
		status = await currentStatus(runtime);
		if (["completed", "paused", "waiting", "blocked"].includes(status.protocol)) {
			break;
		}
		const classified = classifySdkResumeRun(run);
		if (classified.status === "provider-blocked") {
			providerBlock = classified.reason;
			break;
		}
		if (
			classified.status === "recovery-required" ||
			classified.status === "usability-stalled"
		) {
			usabilityStop = classified.reason;
			break;
		}
	}
} catch (error) {
	providerBlock = error instanceof Error ? error.message : String(error);
} finally {
	await runtime.stop();
}
const after = await snapshotFiles(workspace);
let replay;
try {
	replay = await deterministicReplay(activeSessionFile);
} catch (error) {
	replay = {
		status: "unavailable",
		verifierError: true,
		message: error instanceof Error ? error.message : String(error),
	};
}
const oracle = evaluateOracle({
	before,
	after,
	replay,
	runs,
	providerBlock,
	usabilityStop,
});
const report = {
	protocol: "developer-action-loop-live-case/v1",
	case: {
		id: fixture.id,
		description: fixture.description,
		prompt: fixture.prompt,
	},
	target: {
		packageRoot,
		model,
		piVersion: piVersionResult.stdout.trim(),
		workspace,
		sessionFile: activeSessionFile,
	},
	budgets: { maximumRuns, runTimeoutMs, noProgressTimeoutMs },
	runs,
	status,
	replay,
	oracle,
	stderr: runtime.stderr().slice(-2_000),
	modelToolSurface: MODEL_FACING_ACTION_LOOP_TOOLS,
};
process.stdout.write(`${JSON.stringify(report)}\n`);
