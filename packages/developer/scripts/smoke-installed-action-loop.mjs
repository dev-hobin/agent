#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const DEFAULT_PROMPT =
	"Open one bounded canonical Work Case for inspecting this installed package composition. Do not mutate files. Use Developer progression and stop after the first durable checkpoint.";
function parseRequiredPackages(value) {
	return String(value ?? "")
		.split(",")
		.map((entry) => entry.trim())
		.filter(Boolean);
}

function parseArgs(argv) {
	const options = {
		cwd: process.cwd(),
		model: "github-copilot/claude-sonnet-4.6",
		thinking: "low",
		timeoutMs: 90_000,
		prompt: DEFAULT_PROMPT,
		requiredPackages: parseRequiredPackages(
			process.env.DEVELOPER_INSTALLED_SMOKE_REQUIRED_PACKAGES,
		),
	};
	for (let index = 0; index < argv.length; index += 1) {
		const name = argv[index];
		if (name === "--cwd") options.cwd = argv[++index];
		else if (name === "--model") options.model = argv[++index];
		else if (name === "--thinking") options.thinking = argv[++index];
		else if (name === "--timeout-ms")
			options.timeoutMs = Number(argv[++index]);
		else if (name === "--prompt") options.prompt = argv[++index];
		else if (name === "--session-dir") options.sessionDir = argv[++index];
		else if (name === "--output") options.output = argv[++index];
		else if (name === "--require-package")
			options.requiredPackages.push(argv[++index]);
		else throw new Error(`Unknown argument: ${name}`);
	}
	if (!Number.isInteger(options.timeoutMs) || options.timeoutMs < 1_000) {
		throw new Error("--timeout-ms must be an integer of at least 1000");
	}
	if (options.requiredPackages.length === 0) {
		throw new Error(
			"Declare the installed composition with --require-package or DEVELOPER_INSTALLED_SMOKE_REQUIRED_PACKAGES",
		);
	}
	options.cwd = resolve(options.cwd);
	options.sessionDir = resolve(
		options.sessionDir ?? `${options.cwd}/.developer-installed-smoke-sessions`,
	);
	if (options.output) options.output = resolve(options.output);
	return options;
}

function listInstalledResources(cwd) {
	const listed = spawnSync("pi", ["list", "--approve"], {
		cwd,
		encoding: "utf8",
	});
	if (listed.status !== 0) {
		throw new Error(
			`pi list failed (${listed.status}): ${listed.stderr || listed.stdout}`,
		);
	}
	return listed.stdout;
}

function assertInstalledComposition(listing, cwd, requiredPackages) {
	if (!listing.includes("Project packages:")) {
		throw new Error("The smoke workspace has no project-local Pi package");
	}
	if (!listing.includes("npm:@hobin/developer@0.1.20")) {
		throw new Error("The project-local @hobin/developer@0.1.20 is not admitted");
	}
	const projectRoot = resolve(cwd, ".pi/npm/node_modules/@hobin/developer");
	if (!listing.includes(projectRoot) && !listing.includes(projectRoot.replace("/tmp/", "/private/tmp/"))) {
		throw new Error("Pi did not resolve Developer from this workspace's project package");
	}
	for (const packageName of new Set(requiredPackages)) {
		if (!listing.includes(`npm:${packageName}`)) {
			throw new Error(`Required installed resource is absent: ${packageName}`);
		}
	}
}

function startRpc(options) {
	const child = spawn(
		"pi",
		[
			"--mode",
			"rpc",
			"--offline",
			"--approve",
			"--model",
			options.model,
			"--thinking",
			options.thinking,
			"--session-dir",
			options.sessionDir,
		],
		{ cwd: options.cwd, stdio: ["pipe", "pipe", "pipe"] },
	);
	let buffer = "";
	let stderr = "";
	let nextId = 1;
	let exited;
	const events = [];
	const waiters = new Map();
	child.stderr.setEncoding("utf8");
	child.stderr.on("data", (chunk) => {
		stderr += chunk;
	});
	child.stdout.setEncoding("utf8");
	child.stdout.on("data", (chunk) => {
		buffer += chunk;
		for (;;) {
			const boundary = buffer.indexOf("\n");
			if (boundary < 0) break;
			const record = buffer.slice(0, boundary);
			buffer = buffer.slice(boundary + 1);
			if (!record) continue;
			let event;
			try {
				event = JSON.parse(record);
			} catch (error) {
				stderr += `\nRPC JSONL parse error: ${error instanceof Error ? error.message : String(error)}\nRecord: ${record}`;
				continue;
			}
			events.push(event);
			if (event.type !== "response" || !event.id) continue;
			const waiter = waiters.get(event.id);
			if (!waiter) continue;
			waiters.delete(event.id);
			waiter(event);
		}
	});
	const closed = new Promise((resolveClosed) => {
		child.once("close", (code, signal) => {
			exited = { code, signal };
			for (const waiter of waiters.values()) {
				waiter({ success: false, error: `Pi closed: ${code}/${signal}` });
			}
			waiters.clear();
			resolveClosed(exited);
		});
	});
	function send(command, timeoutMs = 20_000) {
		const id = `installed-smoke-${nextId++}`;
		child.stdin.write(`${JSON.stringify({ ...command, id })}\n`);
		return new Promise((resolveResponse, reject) => {
			const timer = setTimeout(() => {
				waiters.delete(id);
				reject(new Error(`RPC response timeout for ${command.type}`));
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
	return { events, send, stop, stderr: () => stderr };
}

function notificationMessages(events, start = 0) {
	return events
		.slice(start)
		.filter(
			(event) =>
				event.type === "extension_ui_request" && event.method === "notify",
		)
		.map((event) => String(event.message));
}

function rpcHasWorkCaseOpened(events) {
	return events.some(
		(event) =>
			event.type === "entry_appended" &&
			event.entry?.customType === "developer.action-loop.session-event" &&
			event.entry?.data?.kind === "work-case-opened",
	);
}

async function sessionHasWorkCaseOpened(sessionDir) {
	let names;
	try {
		names = await readdir(sessionDir);
	} catch {
		return false;
	}
	for (const name of names.filter((candidate) => candidate.endsWith(".jsonl"))) {
		const records = (await readFile(resolve(sessionDir, name), "utf8")).split("\n");
		for (const record of records) {
			if (!record) continue;
			let entry;
			try {
				entry = JSON.parse(record);
			} catch {
				continue;
			}
			if (
				entry.type === "custom" &&
				entry.customType === "developer.action-loop.session-event" &&
				entry.data?.kind === "work-case-opened"
			) {
				return true;
			}
		}
	}
	return false;
}

async function waitForWorkCase(runtime, sessionDir, timeoutMs) {
	const startedAt = Date.now();
	while (Date.now() - startedAt < timeoutMs) {
		if (
			rpcHasWorkCaseOpened(runtime.events) ||
			(await sessionHasWorkCaseOpened(sessionDir))
		) {
			return Date.now() - startedAt;
		}
		await new Promise((resolveDelay) => setTimeout(resolveDelay, 100));
	}
	throw new Error(`No durable work-case-opened checkpoint within ${timeoutMs}ms`);
}

const options = parseArgs(process.argv.slice(2));
await mkdir(options.sessionDir, { recursive: true });
const listing = listInstalledResources(options.cwd);
assertInstalledComposition(listing, options.cwd, options.requiredPackages);
const runtime = startRpc(options);
let report;
try {
	const activationStart = runtime.events.length;
	const activation = await runtime.send({ type: "prompt", message: "/developer on" });
	if (!activation.success) throw new Error(activation.error || "Activation failed");
	const activationNotifications = notificationMessages(
		runtime.events,
		activationStart,
	);
	if (!activationNotifications.includes("Developer: on")) {
		throw new Error("Developer activation notification is absent");
	}
	const statusStart = runtime.events.length;
	const status = await runtime.send({
		type: "prompt",
		message: "/developer status",
	});
	if (!status.success) throw new Error(status.error || "Status failed");
	const statusNotifications = notificationMessages(runtime.events, statusStart);
	const statusMessage = statusNotifications.at(-1) ?? "";
	if (!/developer · Ready/.test(statusMessage)) {
		throw new Error(`Developer did not become ready:\n${statusMessage}`);
	}
	if (/Recovery pending|Capability readiness failed/.test(statusMessage)) {
		throw new Error(`Developer reported false readiness:\n${statusMessage}`);
	}
	const promptStart = runtime.events.length;
	const prompt = await runtime.send({ type: "prompt", message: options.prompt });
	if (!prompt.success) throw new Error(prompt.error || "Normal prompt failed");
	const checkpointElapsedMs = await waitForWorkCase(
		runtime,
		options.sessionDir,
		options.timeoutMs,
	);
	const toolCalls = runtime.events
		.slice(promptStart)
		.filter((event) => event.type === "tool_execution_start")
		.map((event) => event.toolName);
	report = {
		status: "passed",
		model: options.model,
		thinking: options.thinking,
		checkpointElapsedMs,
		capabilityStatus: statusMessage
			.split("\n")
			.find((line) => line.startsWith("Overview · Capabilities:")),
		requiredInstalledPackages: [...new Set(options.requiredPackages)],
		projectDeveloper: "0.1.20",
		workCaseOpened: true,
		toolCallsBeforeCheckpoint: toolCalls,
	};
} finally {
	const exit = await runtime.stop();
	if (report) report.piExit = exit;
}
if (runtime.stderr().trim()) report.stderr = runtime.stderr().trim();
const rendered = `${JSON.stringify(report, null, 2)}\n`;
if (options.output) await writeFile(options.output, rendered);
process.stdout.write(rendered);
