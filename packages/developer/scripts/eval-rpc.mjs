import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
	validateExecutionSafetyTrace,
	validateExecutionTrace,
} from "./eval-assertions.mjs";
import { createFixtureBudgetMonitor } from "./eval-budget.mjs";
import {
	diffWorkspaceSnapshots,
	snapshotWorkspace,
} from "./eval-filesystem.mjs";
import {
	assertAllowedOutcome,
	classifyEvalOutcome,
	classifyTrialDisposition,
	parseDeveloperStatus,
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
const liveModel = process.env.DEVELOPER_EVAL_MODEL;
const liveThinking = process.env.DEVELOPER_EVAL_THINKING || "medium";
const durableSession = process.env.DEVELOPER_EVAL_DURABLE_SESSION === "1";
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
		...(durableSession ? [] : ["--no-session"]),
		...(liveModel ? ["--model", liveModel] : []),
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
		if (settled) return { status: "agent-settled" };

		budget.observe(events.slice(observed));
		observed = events.length;
		const budgetStop = budget.stop(trace);
		if (budgetStop) {
			return {
				status: "bounded-stop",
				budgetStop,
				recentEvents: recentEventTypes(start) || "none",
			};
		}
		await new Promise((resolve) => setTimeout(resolve, 50));
	}
}

async function command(message) {
	const response = await send({ type: "prompt", message });
	assert.equal(response.success, true, response.error);
}

async function currentDeveloperStatus() {
	const start = events.length;
	await command("/developer status");
	const notification = events
		.slice(start)
		.find(
			(event) =>
				event.type === "extension_ui_request" && event.method === "notify",
		);
	assert.ok(notification, "Expected /developer status notification");
	return parseDeveloperStatus(notification.message);
}

try {
	const stateResponse = await send({ type: "get_state" });
	assert.equal(stateResponse.success, true, stateResponse.error);
	const selectedModel = stateResponse.data.model
		? `${stateResponse.data.model.provider}/${stateResponse.data.model.id}`
		: "none";
	if (liveModel) {
		assert.equal(
			selectedModel,
			liveModel,
			`Pi selected ${selectedModel} instead of requested ${liveModel}`,
		);
	}
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
	assert.equal(packageSkills.length, 11);
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
					String(event.statusText).includes("developer · idle"),
			),
		"Expected /developer on to publish branch-visible status",
	);
	console.log(
		`RPC smoke: command, skills, and activation state are available on Pi ${piVersion} with ${selectedModel}`,
	);

	const enabledStatusStart = events.length;
	await command("/developer status");
	const enabledStatus = events
		.slice(enabledStatusStart)
		.find(
			(event) =>
				event.type === "extension_ui_request" &&
				event.method === "notify" &&
				String(event.message).includes("developer · Ready"),
		);
	assert.ok(enabledStatus, "Expected canonical enabled status output");
	assert.match(String(enabledStatus.message), /Outcome · No current work/);
	assert.doesNotMatch(
		String(enabledStatus.message),
		/developer_route_question|developer_load_reference|developer_record_judgment/,
	);
	await command("/developer off");
	const disabledStatusStart = events.length;
	await command("/developer status");
	const disabledStatus = events
		.slice(disabledStatusStart)
		.find(
			(event) =>
				event.type === "extension_ui_request" &&
				event.method === "notify" &&
				String(event.message).includes("developer · Off"),
		);
	assert.ok(disabledStatus, "Expected canonical disabled status output");
	await command("/developer on");
	console.log(
		`RPC smoke: canonical Action-Clearance tool gating is available on Pi ${piVersion} with ${selectedModel}`,
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
						". Work only in that directory.\n" +
						fixture.request,
				});
				assert.equal(response.success, true, response.error);
				const waitResult = await waitForFixtureSettled(start, fixture);
				if (waitResult.status === "bounded-stop") {
					const aborted = await send({ type: "abort" }, 5000);
					assert.equal(aborted.success, true, aborted.error);
				}

				const executionTrace = events.slice(start);
				const changes = diffWorkspaceSnapshots(
					workspaceBefore,
					await snapshotWorkspace(casePath),
				);
				const status = await currentDeveloperStatus();
				const trialOutcome = classifyTrialDisposition({
					status,
					budgetStop:
						waitResult.status === "bounded-stop"
							? waitResult.budgetStop
							: undefined,
				});
				if (trialOutcome === "protocol-unavailable") {
					throw new Error(
						`${fixture.id}: canonical protocol became unavailable`,
					);
				}
				const terminal =
					trialOutcome === "completed" || trialOutcome === "held";
				const traceSummary = terminal
					? await validateExecutionTrace(
							fixture,
							executionTrace,
							packageUnderTest,
							casePath,
						)
					: validateExecutionSafetyTrace(fixture, executionTrace);
				const outcome = classifyEvalOutcome({ changes, status });
				if (terminal) assertAllowedOutcome(fixture, outcome);

				let tracePath;
				if (!terminal) {
					const modelSlug = selectedModel.replace(/[^a-z0-9.-]+/gi, "-");
					tracePath = join(
						tmpdir(),
						`developer-eval-${fixture.id}-${modelSlug}-${Date.now()}.json`,
					);
					await writeFile(tracePath, JSON.stringify(executionTrace, null, 2));
				}
				console.log(
					"DEVELOPER_EVAL_RESULT " +
						JSON.stringify({
							fixtureId: fixture.id,
							model: selectedModel,
							structuralValid: true,
							trialOutcome,
							outcome,
							status: status.protocol,
							...(waitResult.status === "bounded-stop"
								? {
										budgetStop: waitResult.budgetStop,
										recentEvents: waitResult.recentEvents,
									}
								: {}),
							...(tracePath ? { tracePath } : {}),
							...traceSummary,
						}),
				);
				console.log(
					`Live eval observed: ${fixture.id} (${trialOutcome}; ${outcome})`,
				);
			} catch (error) {
				try {
					await send({ type: "abort" }, 5000);
				} catch {
					child.kill("SIGTERM");
				}
				const modelSlug = selectedModel.replace(/[^a-z0-9.-]+/gi, "-");
				const tracePath = join(
					tmpdir(),
					`developer-eval-${fixture.id}-${modelSlug}-${Date.now()}.json`,
				);
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
