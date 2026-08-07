import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
	validateExecutionSafetyTrace,
	validateExecutionTrace,
} from "./eval-assertions.mjs";
import { createEvalEventMonitor } from "./eval-event-monitor.mjs";
import {
	diffWorkspaceSnapshots,
	snapshotWorkspace,
} from "./eval-filesystem.mjs";
import {
	assertAllowedOutcome,
	classifyEvalOutcome,
	classifyTrialDisposition,
	parseDeveloperStatus,
	statusFromDeveloperEvents,
} from "./eval-outcome.mjs";
import { createEvalWorkspace } from "./eval-workspace.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const extension = join(root, "extensions", "developer.ts");
const observerExtension = join(root, "scripts", "eval-observer.ts");
const skills = join(root, "skills");
const piBin = process.env.PI_BIN || "pi";
const profile = process.env.PI_CODING_AGENT_DIR;
const thinking = process.env.DEVELOPER_EVAL_THINKING || "medium";
const fixtureTimeoutMs = Number(
	process.env.DEVELOPER_EVAL_TIMEOUT_MS || 150000,
);
const noProgressTimeoutMs = Number(
	process.env.DEVELOPER_EVAL_NO_PROGRESS_MS || 60000,
);

if (!profile) {
	throw new Error(
		"JSON eval requires PI_CODING_AGENT_DIR pointing to a configured Pi profile.",
	);
}

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
	fixtures.map((fixture) => fixture.id),
);

function runFixture(fixture) {
	const cwd = join(workspace, fixture.id);
	return new Promise((resolve, reject) => {
		const child = spawn(
			piBin,
			[
				"--mode",
				"json",
				"--print",
				"--offline",
				"--no-session",
				"--thinking",
				thinking,
				"--no-extensions",
				"--no-skills",
				"--extension",
				extension,
				"--extension",
				observerExtension,
				"--skill",
				skills,
				fixture.request,
				"--developer",
			],
			{
				cwd,
				env: {
					...process.env,
					PI_CODING_AGENT_DIR: profile,
					DEVELOPER_EVAL_WORKSPACE: cwd,
				},
				stdio: ["ignore", "pipe", "pipe"],
			},
		);
		let stderr = "";
		let finished = false;
		let budgetTimer;
		let monitor;

		const finish = (result, error) => {
			if (finished) return;
			finished = true;
			if (budgetTimer) clearInterval(budgetTimer);
			if (!error) {
				resolve(result);
				return;
			}
			child.kill("SIGTERM");
			if (!error.evalEvents) {
				Object.defineProperty(error, "evalEvents", {
					value: [...monitor.events],
					enumerable: false,
				});
			}
			reject(error);
		};
		monitor = createEvalEventMonitor({
			fixture,
			fixtureTimeoutMs,
			noProgressTimeoutMs,
			onStop(budgetStop) {
				child.kill("SIGTERM");
				finish({ events: [...monitor.events], budgetStop });
			},
			onFailure(error) {
				if (stderr) error.message += `\n${stderr}`;
				finish(undefined, error);
			},
		});

		child.stdout.setEncoding("utf8");
		child.stderr.setEncoding("utf8");
		child.stdout.on("data", (chunk) => monitor.push(chunk));
		child.stdout.on("end", () => monitor.end());
		child.stderr.on("data", (chunk) => {
			stderr += chunk;
		});
		budgetTimer = setInterval(() => monitor.check(), 50);
		child.on("error", (error) => finish(undefined, error));
		child.on("close", (code) => {
			if (finished) return;
			if (code !== 0) {
				finish(
					undefined,
					new Error(fixture.id + ": Pi exited " + code + "\n" + stderr),
				);
				return;
			}
			finish({ events: [...monitor.events] });
		});
	});
}

for (const fixture of fixtures) {
	const casePath = join(workspace, fixture.id);
	const before = await snapshotWorkspace(casePath);
	let events = [];
	try {
		const run = await runFixture(fixture);
		events = run.events;
		if (!run.budgetStop) {
			assert.ok(
				events.some((event) => event.type === "agent_settled"),
				fixture.id + ": no agent_settled event",
			);
		}
		const statusEvent = events
			.toReversed()
			.find(
				(event) =>
					event.type === "extension_ui_request" &&
					event.method === "setStatus" &&
					String(event.statusText).startsWith("developer"),
			);
		const status = statusEvent
			? parseDeveloperStatus(statusEvent.statusText)
			: statusFromDeveloperEvents(events);
		const changes = diffWorkspaceSnapshots(
			before,
			await snapshotWorkspace(casePath),
		);
		const trialOutcome = classifyTrialDisposition({
			status,
			budgetStop: run.budgetStop,
		});
		if (trialOutcome === "protocol-unavailable") {
			throw new Error(`${fixture.id}: canonical protocol became unavailable`);
		}
		const terminal = trialOutcome === "completed" || trialOutcome === "held";
		const traceSummary = terminal
			? await validateExecutionTrace(fixture, events, root, casePath)
			: validateExecutionSafetyTrace(fixture, events);
		const outcome = classifyEvalOutcome({ changes, status });
		if (terminal) assertAllowedOutcome(fixture, outcome);
		let tracePath;
		if (!terminal) {
			tracePath = join(
				tmpdir(),
				`developer-eval-${fixture.id}-${Date.now()}.json`,
			);
			await writeFile(tracePath, JSON.stringify(events, null, 2));
		}
		console.log(
			"DEVELOPER_EVAL_RESULT " +
				JSON.stringify({
					fixtureId: fixture.id,
					structuralValid: true,
					trialOutcome,
					outcome,
					status: status.protocol,
					...(run.budgetStop ? { budgetStop: run.budgetStop } : {}),
					...(tracePath ? { tracePath } : {}),
					...traceSummary,
				}),
		);
		console.log(
			`JSON eval observed: ${fixture.id} (${trialOutcome}; ${outcome})`,
		);
	} catch (error) {
		const failure = error instanceof Error ? error : new Error(String(error));
		const tracePath = join(tmpdir(), `developer-eval-${fixture.id}.json`);
		await writeFile(
			tracePath,
			JSON.stringify(failure.evalEvents ?? events, null, 2),
		);
		failure.message += `\nTrace: ${tracePath}`;
		throw failure;
	}
}
