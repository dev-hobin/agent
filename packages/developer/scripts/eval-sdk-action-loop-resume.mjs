import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { resolve } from "node:path";

import { parseDeveloperStatus } from "./eval-outcome.mjs";
import { createJsonlDecoder } from "./jsonl.mjs";

const packageRoot = resolve(
	process.env.DEVELOPER_EVAL_PACKAGE_PATH ??
		(() => {
			throw new Error("DEVELOPER_EVAL_PACKAGE_PATH is required.");
		})(),
);
const sessionFile = resolve(
	process.env.DEVELOPER_EVAL_SESSION_FILE ??
		(() => {
			throw new Error("DEVELOPER_EVAL_SESSION_FILE is required.");
		})(),
);
const workspace = resolve(
	process.env.DEVELOPER_EVAL_WORKSPACE ??
		(() => {
			throw new Error("DEVELOPER_EVAL_WORKSPACE is required.");
		})(),
);
const configDir = resolve(
	process.env.PI_CODING_AGENT_DIR ??
		(() => {
			throw new Error("PI_CODING_AGENT_DIR is required.");
		})(),
);
const piBin = process.env.PI_BIN || "pi";
const model = process.env.DEVELOPER_EVAL_MODEL || "openai-codex/gpt-5.6-sol";
const thinking = process.env.DEVELOPER_EVAL_THINKING || "medium";
const maximumRuns = Number(process.env.DEVELOPER_EVAL_MAX_RUNS || 4);
const runTimeoutMs = Number(process.env.DEVELOPER_EVAL_TIMEOUT_MS || 360_000);
const noProgressTimeoutMs = Number(
	process.env.DEVELOPER_EVAL_NO_PROGRESS_MS || 180_000,
);
const continuationPrompt =
	process.env.DEVELOPER_EVAL_CONTINUATION_PROMPT ||
	"Resume the current canonical Action Loop from its acknowledged Pi branch checkpoints. Use developer_progress_action_loop_with_sdk only for protocol progression. Do not recompute completed transitions, use transitional lower-level protocol tools, or infer Effect success from a tool return.";
const sessionOperation = process.env.DEVELOPER_EVAL_SESSION_OPERATION || "none";
const compactBeforeResume = process.env.DEVELOPER_EVAL_COMPACT === "1";
const compactionPaddingBytes = Number(
	process.env.DEVELOPER_EVAL_COMPACTION_PADDING_BYTES || 0,
);

if (!Number.isInteger(maximumRuns) || maximumRuns < 1 || maximumRuns > 32) {
	throw new Error("DEVELOPER_EVAL_MAX_RUNS must be an integer from 1 through 32.");
}
if (!Number.isFinite(runTimeoutMs) || runTimeoutMs < 1_000) {
	throw new Error("DEVELOPER_EVAL_TIMEOUT_MS must be at least 1000.");
}
if (!Number.isFinite(noProgressTimeoutMs) || noProgressTimeoutMs < 1_000) {
	throw new Error("DEVELOPER_EVAL_NO_PROGRESS_MS must be at least 1000.");
}
if (!["none", "clone", "fork-latest"].includes(sessionOperation)) {
	throw new Error(
		"DEVELOPER_EVAL_SESSION_OPERATION must be none, clone, or fork-latest.",
	);
}
if (
	!Number.isInteger(compactionPaddingBytes) ||
	compactionPaddingBytes < 0 ||
	compactionPaddingBytes > 1_000_000
) {
	throw new Error(
		"DEVELOPER_EVAL_COMPACTION_PADDING_BYTES must be an integer from 0 through 1000000.",
	);
}

const piVersionResult = spawnSync(piBin, ["--version"], { encoding: "utf8" });
if (piVersionResult.status !== 0) {
	throw new Error(
		`Could not resolve Pi version: ${piVersionResult.stderr || "unknown error"}`,
	);
}
const piVersion = piVersionResult.stdout.trim();
const extension = resolve(packageRoot, "extensions", "developer.ts");
const skills = process.env.DEVELOPER_EVAL_SKILL_PATH
	? resolve(process.env.DEVELOPER_EVAL_SKILL_PATH)
	: resolve(packageRoot, "skills");
const observer = resolve(
	import.meta.dirname,
	"eval-observer.ts",
);
const child = spawn(
	piBin,
	[
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
		extension,
		"--extension",
		observer,
		"--skill",
		skills,
	],
	{
		cwd: workspace,
		env: { ...process.env, PI_CODING_AGENT_DIR: configDir },
		stdio: ["pipe", "pipe", "pipe"],
	},
);

let stderr = "";
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
	for (const waiter of waiters.values()) {
		waiter({ success: false, error: error.message });
	}
	waiters.clear();
});

function send(command, timeoutMs = 15_000) {
	const id = `developer-sdk-resume-${nextId++}`;
	child.stdin.write(`${JSON.stringify({ ...command, id })}\n`);
	return new Promise((resolvePromise, reject) => {
		const existing = responses.get(id);
		if (existing) {
			resolvePromise(existing);
			return;
		}
		const timer = setTimeout(() => {
			waiters.delete(id);
			reject(new Error(`RPC timeout for ${command.type}\n${stderr}`));
		}, timeoutMs);
		waiters.set(id, (response) => {
			clearTimeout(timer);
			resolvePromise(response);
		});
	});
}

async function waitForRun(start) {
	const startedAt = Date.now();
	let observed = start;
	let lastProgressAt = startedAt;
	while (true) {
		const trace = events.slice(start);
		if (trace.some((event) => event.type === "agent_settled")) {
			return { status: "settled", elapsedMs: Date.now() - startedAt };
		}
		if (events.length > observed) {
			const progress = events.slice(observed).some((event) =>
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
			observed = events.length;
		}
		const now = Date.now();
		if (now - startedAt >= runTimeoutMs) {
			return { status: "bounded-stop", reason: "run-timeout", elapsedMs: now - startedAt };
		}
		if (now - lastProgressAt >= noProgressTimeoutMs) {
			return {
				status: "bounded-stop",
				reason: "no-progress-timeout",
				elapsedMs: now - startedAt,
			};
		}
		await new Promise((resolvePromise) => setTimeout(resolvePromise, 50));
	}
}

function textContent(result) {
	return (result?.content ?? [])
		.filter((item) => item.type === "text" && typeof item.text === "string")
		.map((item) => item.text)
		.join("\n");
}

function summarizeRun(index, trace, waitResult) {
	const toolCalls = trace
		.filter((event) => event.type === "tool_execution_start")
		.map((event) => event.toolName);
	const protocolEnds = trace
		.filter(
			(event) =>
				event.type === "tool_execution_end" &&
				event.toolName === "developer_progress_action_loop_with_sdk",
		)
		.map((event) => ({
			isError: event.isError,
			text: textContent(event.result).slice(0, 320),
			details: event.result?.details,
		}));
	const checkpointKinds = trace
		.filter((event) => event.type === "entry_appended")
		.map((event) => event.entry?.data?.kind)
		.filter(Boolean);
	return {
		index,
		wait: waitResult,
		toolCalls,
		protocolEnds,
		checkpointKinds,
	};
}

async function currentStatus() {
	const start = events.length;
	const response = await send({ type: "prompt", message: "/developer status" });
	assert.equal(response.success, true, response.error);
	const notification = events.slice(start).find(
		(event) =>
			event.type === "extension_ui_request" && event.method === "notify",
	);
	assert.ok(notification, "Expected /developer status notification.");
	return parseDeveloperStatus(notification.message);
}

const transitionalTools = new Set([
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
	"developer_prepare_closure",
	"developer_complete_work_case",
]);

const runs = [];
try {
	const state = await send({ type: "get_state" });
	assert.equal(state.success, true, state.error);
	assert.equal(resolve(state.data.sessionFile), sessionFile);
	assert.equal(
		`${state.data.model.provider}/${state.data.model.id}`,
		model,
		"Pi selected a different model.",
	);

	let forkedFromEntryId;
	if (sessionOperation === "clone") {
		const cloned = await send({ type: "clone" }, 30_000);
		assert.equal(cloned.success, true, cloned.error);
		assert.equal(cloned.data.cancelled, false, "Session clone was cancelled.");
	}
	if (sessionOperation === "fork-latest") {
		const available = await send({ type: "get_fork_messages" });
		assert.equal(available.success, true, available.error);
		const latest = available.data.messages.at(-1);
		assert.ok(latest, "Current session has no user message available to fork.");
		forkedFromEntryId = latest.entryId;
		const forked = await send(
			{ type: "fork", entryId: latest.entryId },
			30_000,
		);
		assert.equal(forked.success, true, forked.error);
		assert.equal(forked.data.cancelled, false, "Session fork was cancelled.");
	}
	const preparedState = await send({ type: "get_state" });
	assert.equal(preparedState.success, true, preparedState.error);
	const activeSessionFile = resolve(preparedState.data.sessionFile);
	if (sessionOperation !== "none") {
		assert.notEqual(
			activeSessionFile,
			sessionFile,
			`${sessionOperation} did not create a new Pi session file.`,
		);
	}

	let compaction;
	if (compactBeforeResume) {
		const compactCommand = {
			type: "compact",
			customInstructions:
				"Preserve the current Developer Action Loop goal and user-visible progress; canonical extension state remains in semantic branch entries.",
		};
		let compacted = await send(compactCommand, runTimeoutMs);
		if (
			!compacted.success &&
			compactionPaddingBytes > 0 &&
			String(compacted.error).includes("Nothing to compact")
		) {
			const firstChunkBytes = Math.ceil(compactionPaddingBytes / 2);
			const paddingChunks = [
				firstChunkBytes,
				compactionPaddingBytes - firstChunkBytes,
			].filter((bytes) => bytes > 0);
			for (const bytes of paddingChunks) {
				const padded = await send(
					{
						type: "bash",
						command: `node -e "process.stdout.write('x'.repeat(${bytes}))"`,
					},
					30_000,
				);
				assert.equal(padded.success, true, padded.error);
				assert.equal(
					padded.data.exitCode,
					0,
					"Compaction padding command failed.",
				);
			}
			compacted = await send(compactCommand, runTimeoutMs);
		}
		assert.equal(compacted.success, true, compacted.error);
		compaction = {
			firstKeptEntryId: compacted.data.firstKeptEntryId,
			tokensBefore: compacted.data.tokensBefore,
			estimatedTokensAfter: compacted.data.estimatedTokensAfter,
			paddingBytes: compactionPaddingBytes,
		};
	}

	for (let index = 1; index <= maximumRuns; index += 1) {
		const start = events.length;
		const response = await send({ type: "prompt", message: continuationPrompt });
		assert.equal(response.success, true, response.error);
		const waitResult = await waitForRun(start);
		if (waitResult.status === "bounded-stop") {
			const aborted = await send({ type: "abort" }, 5_000);
			assert.equal(aborted.success, true, aborted.error);
		}
		const run = summarizeRun(index, events.slice(start), waitResult);
		runs.push(run);
		const usedTransitional = run.toolCalls.filter((name) =>
			transitionalTools.has(name),
		);
		assert.deepEqual(
			usedTransitional,
			[],
			`Run ${index} used transitional protocol tools.`,
		);
		assert.ok(
			run.toolCalls.includes("developer_progress_action_loop_with_sdk"),
			`Run ${index} did not invoke the primary SDK controller.`,
		);
		if (
			run.protocolEnds.some(
				(end) => end.details?.status === "completed" && !end.isError,
			)
		) {
			break;
		}
		if (run.checkpointKinds.length === 0 && index === maximumRuns) break;
	}

	const status = await currentStatus();
	const allCheckpoints = runs.flatMap((run) => run.checkpointKinds);
	assert.ok(
		allCheckpoints.filter((kind) => kind === "work-case-opened").length <= 1,
		"Resume progression reopened canonical Work Case ownership.",
	);
	const report = {
		protocol: "developer-sdk-action-loop-resume-eval/v1",
		piVersion,
		model,
		packageRoot,
		sourceSessionFile: sessionFile,
		sessionFile: activeSessionFile,
		workspace,
		skills,
		sessionOperation,
		...(forkedFromEntryId ? { forkedFromEntryId } : {}),
		...(compaction ? { compaction } : {}),
		status: status.protocol,
		runs,
		totals: {
			runs: runs.length,
			checkpoints: allCheckpoints.length,
			primaryCalls: runs
				.flatMap((run) => run.toolCalls)
				.filter((name) => name === "developer_progress_action_loop_with_sdk")
				.length,
			transitionalCalls: runs
				.flatMap((run) => run.toolCalls)
				.filter((name) => transitionalTools.has(name)).length,
		},
	};
	process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} finally {
	child.stdin.end();
	child.kill("SIGTERM");
}
