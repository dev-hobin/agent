import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { validateExecutionTrace } from "./eval-assertions.mjs";
import { createFixtureBudgetMonitor } from "./eval-budget.mjs";
import {
	diffWorkspaceSnapshots,
	snapshotWorkspace,
} from "./eval-filesystem.mjs";
import {
	assertAllowedOutcome,
	classifyEvalOutcome,
	statusFromDeveloperEvents,
} from "./eval-outcome.mjs";
import { createEvalWorkspace } from "./eval-workspace.mjs";
import { createJsonlDecoder } from "./jsonl.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const packageUnderTest = process.env.DEVELOPER_EVAL_PACKAGE_PATH || root;
const extension = join(packageUnderTest, "extensions", "developer.ts");
const observerExtension = join(root, "scripts", "eval-observer.ts");
const skills = join(packageUnderTest, "skills");
const piBin = process.env.PI_BIN || "pi";
const piVersionResult = spawnSync(piBin, ["--version"], {
	encoding: "utf8",
});
if (piVersionResult.status !== 0) {
	throw new Error(
		`Could not resolve Pi version from ${piBin}: ${piVersionResult.stderr || "unknown error"}`,
	);
}
const piVersion = piVersionResult.stdout.trim();
if (!piVersion) throw new Error(`Pi ${piBin} returned an empty version.`);
const live = process.env.DEVELOPER_EVAL_LIVE === "1";
const liveThinking = process.env.DEVELOPER_EVAL_THINKING || "medium";
const fixtureTimeoutMs = Number(
	process.env.DEVELOPER_EVAL_TIMEOUT_MS || 150000,
);
const noProgressTimeoutMs = Number(
	process.env.DEVELOPER_EVAL_NO_PROGRESS_MS || 60000,
);

function parseJson(value, label) {
	try {
		return JSON.parse(value);
	} catch (error) {
		throw new Error(
			`${label}: ${error instanceof Error ? error.message : String(error)}`,
			{ cause: error },
		);
	}
}

const allFixtures = parseJson(
	await readFile(join(root, "evals", "fixtures.json"), "utf8"),
	"Invalid eval fixtures",
);
const fixtureFilter = process.env.DEVELOPER_EVAL_FIXTURE;
const fixtures = fixtureFilter
	? allFixtures.filter((fixture) => fixture.id === fixtureFilter)
	: allFixtures;
if (fixtureFilter && fixtures.length !== 1) {
	throw new Error("Unknown DEVELOPER_EVAL_FIXTURE: " + fixtureFilter);
}
const workspace = await createEvalWorkspace(
	root,
	live ? fixtures.map((fixture) => fixture.id) : ["smoke"],
);

if (live && !process.env.PI_CODING_AGENT_DIR) {
	throw new Error(
		"Live eval requires PI_CODING_AGENT_DIR pointing to a configured Pi profile.",
	);
}

const configDir =
	process.env.PI_CODING_AGENT_DIR ||
	(await mkdtemp(join(tmpdir(), "developer-pi-rpc-")));
const loadAsPackage = !process.env.PI_CODING_AGENT_DIR;
if (loadAsPackage) {
	await writeFile(
		join(configDir, "settings.json"),
		JSON.stringify({ packages: [packageUnderTest] }, null, 2),
	);
}
const resourceArgs = loadAsPackage
	? []
	: [
			"--no-extensions",
			"--no-skills",
			"--extension",
			extension,
			"--extension",
			observerExtension,
			"--skill",
			skills,
		];
const child = spawn(
	piBin,
	[
		"--mode",
		"rpc",
		"--offline",
		"--no-session",
		...(live ? ["--thinking", liveThinking] : []),
		...resourceArgs,
	],
	{
		cwd: workspace,
		env: {
			...process.env,
			PI_CODING_AGENT_DIR: configDir,
			DEVELOPER_EVAL_WORKSPACE: workspace,
		},
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
		// Streaming updates repeat the cumulative partial message and can make a
		// long, multi-consultation Doctor trace grow quadratically. Final message
		// and tool events retain the evidence needed by assertions and diagnostics.
		if (value.type !== "message_update") events.push(value);
		if (value.type === "response" && value.id) {
			responses.set(value.id, value);
			const resolve = waiters.get(value.id);
			if (resolve) {
				waiters.delete(value.id);
				resolve(value);
			}
		}
	},
	onError(error, record) {
		stderr += `\nRPC JSONL parse error: ${error.message}\nRecord: ${record}`;
	},
});
child.stdout.setEncoding("utf8");
child.stdout.on("data", (chunk) => decoder.push(chunk));
child.stdout.on("end", () => decoder.end());

child.on("error", (error) => {
	for (const resolve of waiters.values()) {
		resolve({ success: false, error: error.message });
	}
	waiters.clear();
});

function send(command, timeoutMs = 10000) {
	const id = "developer-eval-" + nextId++;
	child.stdin.write(JSON.stringify({ ...command, id }) + "\n");
	return new Promise((resolve, reject) => {
		const existing = responses.get(id);
		if (existing) return resolve(existing);
		const timer = setTimeout(() => {
			waiters.delete(id);
			reject(new Error("RPC timeout for " + command.type + "\n" + stderr));
		}, timeoutMs);
		waiters.set(id, (response) => {
			clearTimeout(timer);
			resolve(response);
		});
	});
}

function recentEventTypes(start) {
	return events
		.slice(Math.max(start, events.length - 20))
		.map((event) => event.type)
		.join(", ");
}

async function waitForFixtureSettled(start, fixture) {
	const budget = createFixtureBudgetMonitor({
		fixture,
		fixtureTimeoutMs,
		noProgressTimeoutMs,
	});
	let observed = start;
	while (true) {
		const trace = events.slice(start);
		const settled = trace.find((event) => event.type === "agent_settled");
		if (settled) return settled;

		budget.observe(events.slice(observed));
		observed = events.length;
		const budgetFailure = budget.failure(trace);
		if (budgetFailure) {
			throw new Error(
				`${fixture.id}: ${budgetFailure}; recent events: ${recentEventTypes(start) || "none"}\n${stderr}`,
			);
		}
		await new Promise((resolve) => setTimeout(resolve, 50));
	}
}

async function command(message) {
	const response = await send({ type: "prompt", message });
	assert.equal(response.success, true, response.error);
}

try {
	const commandsResponse = await send({ type: "get_commands" });
	assert.equal(commandsResponse.success, true, commandsResponse.error);
	const commands = commandsResponse.data.commands;
	assert.ok(
		commands.some(
			(entry) => entry.name === "developer" && entry.source === "extension",
		),
		"Expected canonical /developer extension command",
	);
	assert.equal(
		commands.some((entry) => entry.name === "develop"),
		false,
		"Removed /develop command must not remain registered",
	);
	assert.equal(
		commands.some((entry) => String(entry.name).startsWith("developer:")),
		false,
		"Developer actions must use normal command arguments, not colon commands",
	);

	const allLoadedSkills = commands.filter((entry) => entry.source === "skill");
	const packageSkills = allLoadedSkills.filter((entry) =>
		String(entry.sourceInfo?.path ?? "").startsWith(skills),
	);
	assert.equal(packageSkills.length, 10);
	assert.equal(
		packageSkills.some((entry) => entry.name === "skill:doctor"),
		true,
	);
	assert.equal(
		packageSkills.some((entry) => entry.name === "developer"),
		false,
	);
	for (const entry of packageSkills) {
		assert.ok(
			String(entry.sourceInfo.path).startsWith(skills),
			"Package skill provenance escaped @hobin/developer: " +
				entry.sourceInfo.path,
		);
	}

	const eventStart = events.length;
	await command("/developer on");
	assert.ok(
		events
			.slice(eventStart)
			.some(
				(event) =>
					event.type === "extension_ui_request" &&
					event.method === "setStatus" &&
					event.statusKey === "developer" &&
					String(event.statusText).includes("developer v8 · receipts 1"),
			),
		"Expected /developer on to publish receipt-derived status",
	);
	process.stdout.write(
		`RPC smoke: command, skills, and v8 activation are available on Pi ${piVersion}\n`,
	);

	const enabledStatusStart = events.length;
	await command("/developer status");
	const enabledStatus = events
		.slice(enabledStatusStart)
		.find(
			(event) =>
				event.type === "extension_ui_request" &&
				event.method === "notify" &&
				String(event.message).includes("Developer v8 receipts 1-1 of 1"),
		);
	assert.ok(enabledStatus, "Expected exact-current receipt status output");
	assert.match(String(enabledStatus.message), /projection [a-f0-9]{64}/u);

	const disabledStart = events.length;
	await command("/developer off");
	assert.ok(
		events
			.slice(disabledStart)
			.some(
				(event) =>
					event.type === "extension_ui_request" &&
					event.method === "notify" &&
					String(event.message).includes("Developer v8: off"),
			),
		"Expected Developer v8 scope closure output",
	);
	const closedStatusStart = events.length;
	await command("/developer status");
	const closedStatus = events
		.slice(closedStatusStart)
		.find(
			(event) =>
				event.type === "extension_ui_request" &&
				event.method === "notify" &&
				String(event.message).includes("Developer v8 receipts 1-2 of 2"),
		);
	assert.ok(closedStatus, "Expected closed-scope receipt status output");
	await command("/developer on");
	process.stdout.write(
		`RPC smoke: v8 scope closure and receipt observation are available on Pi ${piVersion}\n`,
	);

	if (live) {
		for (const fixture of fixtures) {
			await command("/developer off");
			await command("/developer on");
			const start = events.length;
			const casePath = join(workspace, fixture.id);
			const workspaceBefore = await snapshotWorkspace(casePath);
			try {
				const response = await send({
					type: "prompt",
					message:
						"Evaluation workspace: " +
						casePath +
						". Work only in that directory. Run project commands by changing into this exact directory. The fixture may not be a Git repository, so verify through direct file reads and declared project commands rather than git.\n" +
						fixture.request,
				});
				assert.equal(response.success, true, response.error);
				await waitForFixtureSettled(start, fixture);

				const executionTrace = events.slice(start);
				const traceSummary = await validateExecutionTrace(
					fixture,
					executionTrace,
					packageUnderTest,
					casePath,
				);
				const changes = diffWorkspaceSnapshots(
					workspaceBefore,
					await snapshotWorkspace(casePath),
				);
				const status = statusFromDeveloperEvents(executionTrace);
				const outcome = classifyEvalOutcome({ changes, status });
				assertAllowedOutcome(fixture, outcome);
				process.stdout.write(
					"DEVELOPER_EVAL_RESULT " +
						JSON.stringify({
							fixtureId: fixture.id,
							structuralValid: true,
							outcome,
							...traceSummary,
						}) +
						"\n",
				);
				process.stdout.write(`Live eval passed: ${fixture.id} (${outcome})\n`);
			} catch (error) {
				try {
					await send({ type: "abort" }, 5000);
				} catch {
					child.kill("SIGTERM");
				}
				const tracePath = join(tmpdir(), `developer-eval-${fixture.id}.json`);
				await writeFile(
					tracePath,
					JSON.stringify(events.slice(start), null, 2),
				);
				error.message += `\nTrace: ${tracePath}`;
				throw error;
			}
		}
	}
} finally {
	child.kill("SIGTERM");
}
