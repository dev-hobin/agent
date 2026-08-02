import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const packageUnderTest = process.env.JUDGMENT_EVAL_PACKAGE_PATH || root;
const probe = join(root, "scripts", "eval-probe.ts");
const live = process.env.JUDGMENT_EVAL_LIVE === "1";
const liveThinking = process.env.JUDGMENT_EVAL_THINKING || "medium";
const liveTimeoutMs = Number(process.env.JUDGMENT_EVAL_TIMEOUT_MS || 180_000);
const piBin = process.env.PI_BIN
	? resolve(process.env.PI_BIN)
	: join(root, "node_modules", ".bin", "pi");
const version = spawnSync(piBin, ["--version"], { encoding: "utf8" });
if (version.status !== 0) {
	throw new Error(`Could not resolve Pi version: ${version.stderr}`);
}
const piVersion = version.stdout.trim();
if (live && !process.env.PI_CODING_AGENT_DIR) {
	throw new Error(
		"Live Judgment eval requires PI_CODING_AGENT_DIR pointing to a configured Pi profile.",
	);
}
const temporaryConfigDir = live
	? undefined
	: await mkdtemp(join(tmpdir(), "judgment-pi-rpc-"));
const configDir = process.env.PI_CODING_AGENT_DIR || temporaryConfigDir;
const workspace = await mkdtemp(join(tmpdir(), "judgment-workspace-"));
if (temporaryConfigDir) {
	await writeFile(
		join(temporaryConfigDir, "settings.json"),
		JSON.stringify({ packages: [packageUnderTest] }, null, 2),
	);
}
if (!configDir) throw new Error("Judgment eval configuration is unavailable.");
const decisionUnit = join(workspace, "decision");
if (live) {
	await mkdir(decisionUnit, { recursive: true });
	await Promise.all([
		writeFile(
			join(decisionUnit, "SKILL.md"),
			"---\nname: rpc-live-decision\ndescription: Decide one omitted-versus-empty boundary through exact context.\n---\n\n# RPC Live Decision\n\nPreserve only distinctions supported by exact current context.\n",
		),
		writeFile(
			join(decisionUnit, "guide.md"),
			"# Boundary guide\n\nTreat an omitted value and an explicitly empty value as distinct unless the product contract says otherwise.\n",
		),
		writeFile(
			join(decisionUnit, "alternative.md"),
			"# Alternative boundary guide\n\nKeep the distinction explicit at serialization and comparison boundaries.\n",
		),
		writeFile(
			join(decisionUnit, "abort.md"),
			`# Cancellation probe\n\n${"bounded cancellation content\n".repeat(600_000)}`,
		),
		writeFile(
			join(decisionUnit, "judgment.json"),
			JSON.stringify(
				{
					specVersion: "0.1",
					when: [
						"Omitted and explicitly empty input may carry different product meaning.",
					],
					unless: [
						"Accepted product evidence already proves omitted and explicitly empty input are identical.",
					],
					references: [
						{
							path: "guide.md",
							when: [
								"An omitted-versus-empty decision needs explicit default, serialization, and comparison distinctions.",
							],
						},
						{
							path: "alternative.md",
							when: [
								"A selection-revision probe needs an alternative exact boundary distinction.",
							],
						},
						{
							path: "abort.md",
							when: [
								"A cancellation probe needs oversized bounded content to exercise interrupted acquisition.",
							],
						},
					],
				},
				null,
				2,
			),
		),
	]);
}
const resourceArgs = live
	? [
			"--no-extensions",
			"--no-skills",
			"--extension",
			join(packageUnderTest, "extensions", "judgment.ts"),
			"--skill",
			join(packageUnderTest, "skills"),
			"--skill",
			decisionUnit,
		]
	: [];

const child = spawn(
	piBin,
	[
		"--mode",
		"rpc",
		"--offline",
		"--no-session",
		"--no-context-files",
		"--no-prompt-templates",
		...resourceArgs,
		"--extension",
		probe,
		...(live ? ["--thinking", liveThinking] : []),
	],
	{
		cwd: workspace,
		env: { ...process.env, PI_CODING_AGENT_DIR: configDir },
		stdio: ["pipe", "pipe", "pipe"],
	},
);

let stderr = "";
let buffer = "";
let nextId = 1;
const events = [];
const responses = new Map();
const waiters = new Map();
let abortOnNextSelection = false;
let pendingAbort;

function acceptLine(line) {
	if (!line) return;
	let value;
	try {
		value = JSON.parse(line);
	} catch (error) {
		stderr += `\nInvalid RPC JSON: ${error instanceof Error ? error.message : String(error)}\n${line}`;
		return;
	}
	events.push(value);
	if (
		abortOnNextSelection &&
		value.type === "tool_execution_start" &&
		value.toolName === "judgment_select_context"
	) {
		abortOnNextSelection = false;
		pendingAbort = send({ type: "abort" }, 5_000);
	}
	if (value.type !== "response" || !value.id) return;
	responses.set(value.id, value);
	const resolveResponse = waiters.get(value.id);
	if (resolveResponse) {
		waiters.delete(value.id);
		resolveResponse(value);
	}
}

child.stdout.setEncoding("utf8");
child.stdout.on("data", (chunk) => {
	buffer += chunk;
	for (;;) {
		const newline = buffer.indexOf("\n");
		if (newline < 0) break;
		const line = buffer.slice(0, newline).replace(/\r$/u, "");
		buffer = buffer.slice(newline + 1);
		acceptLine(line);
	}
});
child.stderr.setEncoding("utf8");
child.stderr.on("data", (chunk) => {
	stderr += chunk;
});
child.on("error", (error) => {
	for (const resolveResponse of waiters.values()) {
		resolveResponse({ success: false, error: error.message });
	}
	waiters.clear();
});

function send(command, timeoutMs = 10_000) {
	const id = `judgment-eval-${nextId++}`;
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

async function waitForAgentSettled(start) {
	const deadline = Date.now() + liveTimeoutMs;
	while (Date.now() < deadline) {
		if (events.slice(start).some((event) => event.type === "agent_settled")) {
			return;
		}
		await new Promise((resolveWait) => setTimeout(resolveWait, 50));
	}
	throw new Error(`Judgment live RPC timed out.\n${stderr}`);
}

function parseProbe(message) {
	try {
		return JSON.parse(String(message));
	} catch (error) {
		throw new Error(
			`Invalid Judgment eval probe output: ${error instanceof Error ? error.message : String(error)}`,
			{ cause: error },
		);
	}
}

const expectedTools = [
	"judgment_assess_applicability",
	"judgment_assess_coverage",
	"judgment_conclude",
	"judgment_open_context",
	"judgment_select_context",
];

try {
	const state = await send({ type: "get_state" });
	assert.equal(state.success, true, state.error);
	assert.equal(state.data.isStreaming, false);

	const commands = await send({ type: "get_commands" });
	assert.equal(commands.success, true, commands.error);
	assert.equal(
		commands.data.commands.some(
			(command) =>
				command.name === "skill:judgment" && command.source === "skill",
		),
		true,
		"Judgment skill was not discovered from the package under test.",
	);
	assert.equal(
		commands.data.commands.some(
			(command) =>
				command.name === "judgment-eval-status" &&
				command.source === "extension",
		),
		true,
		"Judgment evaluation probe was not loaded.",
	);

	const start = events.length;
	const prompt = await send({
		type: "prompt",
		message: "/judgment-eval-status",
	});
	assert.equal(prompt.success, true, prompt.error);
	const notification = events
		.slice(start)
		.find(
			(event) =>
				event.type === "extension_ui_request" && event.method === "notify",
		);
	assert.ok(
		notification,
		"Judgment evaluation probe produced no notification.",
	);
	const report = parseProbe(notification.message);
	assert.deepEqual(report.activeTools, expectedTools);
	assert.deepEqual(
		report.tools.map((tool) => tool.name),
		expectedTools,
	);
	for (const tool of report.tools) {
		assert.ok(
			String(tool.path).startsWith(packageUnderTest) ||
				String(tool.source).includes(
					"packages/judgment/extensions/judgment.ts",
				) ||
				String(tool.source).startsWith(packageUnderTest),
			`Judgment tool provenance escaped the package under test: ${tool.source} · ${tool.path}`,
		);
	}
	assert.doesNotMatch(stderr, /failed to load|unknown command/iu);
	process.stdout.write(
		`Judgment RPC smoke: skill and five active tools loaded from the package under test on Pi ${piVersion}\n`,
	);

	if (live) {
		const liveStart = events.length;
		const livePrompt = await send(
			{
				type: "prompt",
				message: [
					"/skill:judgment Exercise the exact generic Judgment lifecycle for the rpc-live-decision skill.",
					"Open the dynamic question 'Should omitted and explicitly empty input remain distinct?'.",
					"After the returned policy is visible, assess it as applicable, then select and seal only guide.md by its exact inventory source ID.",
					"Assess sufficient coverage with one agent-asserted guidance contribution from the returned materialId.",
					"Conclude a contextual-judgment with the returned hashes; cite the exact contributionId and state that omitted and explicitly empty input remain distinct.",
					"Call each judgment tool exactly once, in lifecycle order, and use the generated judgmentId returned by open.",
				].join("\n"),
			},
			liveTimeoutMs,
		);
		assert.equal(livePrompt.success, true, livePrompt.error);
		await waitForAgentSettled(liveStart);
		const liveEvents = events.slice(liveStart);
		const operationCalls = liveEvents
			.filter(
				(event) =>
					event.type === "tool_execution_start" &&
					expectedTools.includes(event.toolName),
			)
			.map((event) => event.toolName);
		assert.deepEqual(operationCalls, [
			"judgment_open_context",
			"judgment_assess_applicability",
			"judgment_select_context",
			"judgment_assess_coverage",
			"judgment_conclude",
		]);
		const operationErrors = liveEvents
			.filter(
				(event) =>
					event.type === "tool_execution_end" &&
					expectedTools.includes(event.toolName) &&
					event.isError === true,
			)
			.map((event) => ({
				toolName: event.toolName,
				result: event.result,
			}));
		assert.deepEqual(
			operationErrors,
			[],
			`Judgment live operation returned a tool error: ${JSON.stringify(operationErrors)}`,
		);
		const finalText = liveEvents
			.filter(
				(event) =>
					event.type === "message_end" && event.message?.role === "assistant",
			)
			.flatMap((event) => event.message.content ?? [])
			.filter((content) => content.type === "text")
			.map((content) => content.text)
			.join("\n");
		assert.match(finalText, /omitted|생략/iu);
		assert.match(finalText, /empty|빈 값|명시적/iu);
		for (const event of liveEvents) {
			if (
				event.type !== "tool_execution_end" ||
				!expectedTools.includes(event.toolName)
			)
				continue;
			for (const content of event.result?.content ?? []) {
				if (content.type === "text") {
					assert.ok(
						content.text.length <= 24_000,
						`Judgment tool output exceeded its bound: ${event.toolName}`,
					);
				}
			}
		}
		process.stdout.write(
			`Judgment RPC live: open → applicability → select/seal → coverage → contextual outcome passed on Pi ${piVersion}\n`,
		);

		const revisionStart = events.length;
		const revisionPrompt = await send(
			{
				type: "prompt",
				message: [
					"Run a selection-revision transport probe for the rpc-live-decision skill.",
					"Open one dynamic question, assess it as applicable after seeing the policy, and keep the generated judgmentId.",
					"Select only guide.md, then call judgment_select_context again for the same judgment selecting only alternative.md.",
					"Stop immediately after the second atomic select-and-seal. Do not assess coverage or conclude this probe.",
				].join("\n"),
			},
			liveTimeoutMs,
		);
		assert.equal(revisionPrompt.success, true, revisionPrompt.error);
		await waitForAgentSettled(revisionStart);
		const revisionEvents = events.slice(revisionStart);
		assert.deepEqual(
			revisionEvents
				.filter(
					(event) =>
						event.type === "tool_execution_start" &&
						expectedTools.includes(event.toolName),
				)
				.map((event) => event.toolName),
			[
				"judgment_open_context",
				"judgment_assess_applicability",
				"judgment_select_context",
				"judgment_select_context",
			],
		);
		const revisionErrors = revisionEvents.filter(
			(event) =>
				event.type === "tool_execution_end" &&
				expectedTools.includes(event.toolName) &&
				event.isError === true,
		);
		assert.deepEqual(
			revisionErrors,
			[],
			`Judgment selection revision returned an error: ${JSON.stringify(revisionErrors)}`,
		);
		const revisionHashes = revisionEvents
			.filter(
				(event) =>
					event.type === "tool_execution_end" &&
					event.toolName === "judgment_select_context",
			)
			.map(
				(event) =>
					/Selection: ([a-f0-9]{64})/u.exec(
						String(event.result?.content?.[0]?.text ?? ""),
					)?.[1],
			);
		assert.equal(revisionHashes.length, 2);
		assert.ok(revisionHashes.every(Boolean));
		assert.notEqual(revisionHashes[0], revisionHashes[1]);
		process.stdout.write(
			`Judgment RPC live: atomic selection revision replaced identity on Pi ${piVersion}\n`,
		);

		const forkMessages = await send({ type: "get_fork_messages" });
		assert.equal(forkMessages.success, true, forkMessages.error);
		const lifecycleMessage = forkMessages.data.messages.find((message) =>
			String(message.text).includes(
				"Exercise the exact generic Judgment lifecycle",
			),
		);
		assert.ok(lifecycleMessage, "Judgment lifecycle message was not forkable.");
		const forked = await send({
			type: "fork",
			entryId: lifecycleMessage.entryId,
		});
		assert.equal(forked.success, true, forked.error);
		assert.equal(forked.data.cancelled, false);
		const branchProbeStart = events.length;
		const branchProbe = await send(
			{
				type: "prompt",
				message: [
					"Call judgment_assess_coverage exactly once for the stale judgmentId from the earlier lifecycle that is absent on this fork.",
					"Submit sufficient coverage with no contributions, conflicts, or limitations.",
					"Do not reopen the judgment and stop after reporting the tool result.",
				].join("\n"),
			},
			liveTimeoutMs,
		);
		assert.equal(branchProbe.success, true, branchProbe.error);
		await waitForAgentSettled(branchProbeStart);
		const branchProbeEvents = events.slice(branchProbeStart);
		assert.deepEqual(
			branchProbeEvents
				.filter(
					(event) =>
						event.type === "tool_execution_start" &&
						expectedTools.includes(event.toolName),
				)
				.map((event) => event.toolName),
			["judgment_assess_coverage"],
		);
		const staleAttemptResult = branchProbeEvents.find(
			(event) =>
				event.type === "tool_execution_end" &&
				event.toolName === "judgment_assess_coverage",
		);
		assert.equal(staleAttemptResult?.isError, true);
		assert.match(
			JSON.stringify(staleAttemptResult?.result),
			/judgment.*(?:not found|not active|unavailable)|unknown.*judgment/iu,
		);
		process.stdout.write(
			`Judgment RPC live: fork replay rejected cross-branch stale attempt state on Pi ${piVersion}\n`,
		);

		const cancellationStart = events.length;
		abortOnNextSelection = true;
		pendingAbort = undefined;
		const cancellationPrompt = await send(
			{
				type: "prompt",
				message: [
					"Run a cancellation transport probe for the rpc-live-decision skill.",
					"Open one dynamic question, assess it as applicable after seeing the policy, then select only abort.md from the returned inventory.",
					"Do not assess coverage or conclude.",
				].join("\n"),
			},
			liveTimeoutMs,
		);
		assert.equal(cancellationPrompt.success, true, cancellationPrompt.error);
		await waitForAgentSettled(cancellationStart);
		assert.ok(
			pendingAbort,
			"Cancellation hook did not observe selection start.",
		);
		const abortResponse = await pendingAbort;
		assert.equal(abortResponse.success, true, abortResponse.error);
		const cancellationEvents = events.slice(cancellationStart);
		assert.deepEqual(
			cancellationEvents
				.filter(
					(event) =>
						event.type === "tool_execution_start" &&
						expectedTools.includes(event.toolName),
				)
				.map((event) => event.toolName),
			[
				"judgment_open_context",
				"judgment_assess_applicability",
				"judgment_select_context",
			],
		);
		const cancelledSelection = cancellationEvents.find(
			(event) =>
				event.type === "tool_execution_end" &&
				event.toolName === "judgment_select_context",
		);
		assert.notEqual(cancelledSelection?.isError, false);
		assert.equal(
			cancellationEvents.some(
				(event) =>
					event.type === "tool_execution_end" &&
					event.toolName === "judgment_assess_coverage",
			),
			false,
		);
		process.stdout.write(
			`Judgment RPC live: abort interrupted select-and-seal before later transitions on Pi ${piVersion}\n`,
		);
	}
} finally {
	child.kill("SIGTERM");
	await Promise.all([
		...(temporaryConfigDir
			? [rm(temporaryConfigDir, { recursive: true, force: true })]
			: []),
		rm(workspace, { recursive: true, force: true }),
	]);
}
