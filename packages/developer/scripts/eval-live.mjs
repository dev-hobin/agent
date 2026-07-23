import { spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
	classifyLiveFailure,
	parseEvalResult,
	summarizeTrialObservations,
} from "./eval-probability.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const transportArg = process.argv.indexOf("--transport");
const transport = transportArg >= 0 ? process.argv[transportArg + 1] : "rpc";
if (transport !== "rpc" && transport !== "json") {
	throw new Error("Live eval transport must be rpc or json");
}
if (!process.env.PI_CODING_AGENT_DIR) {
	throw new Error("Probabilistic live eval requires PI_CODING_AGENT_DIR");
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

function positiveInteger(value, label) {
	const number = Number(value);
	if (!Number.isInteger(number) || number < 1)
		throw new Error(`${label} must be a positive integer`);
	return number;
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

const trials = positiveInteger(
	process.env.DEVELOPER_EVAL_TRIALS || "3",
	"DEVELOPER_EVAL_TRIALS",
);
const runner =
	process.env.DEVELOPER_EVAL_RUNNER ||
	join(root, "scripts", transport === "rpc" ? "eval-rpc.mjs" : "eval-json.mjs");
const trialTimeoutMs = Number(
	process.env.DEVELOPER_EVAL_TRIAL_TIMEOUT_MS || 300000,
);
const report = {
	protocol: "developer/probabilistic-eval-v1",
	transport,
	modelProfile: process.env.PI_CODING_AGENT_DIR,
	trialsPerFixture: trials,
	createdAt: new Date().toISOString(),
	fixtures: [],
};

for (const fixture of fixtures) {
	const observations = [];
	for (let trial = 1; trial <= trials; trial += 1) {
		const child = spawnSync(process.execPath, [runner], {
			cwd: root,
			encoding: "utf8",
			timeout: trialTimeoutMs,
			maxBuffer: 10 * 1024 * 1024,
			env: {
				...process.env,
				DEVELOPER_EVAL_FIXTURE: fixture.id,
				DEVELOPER_EVAL_TRIAL_INDEX: String(trial),
				...(transport === "rpc" ? { DEVELOPER_EVAL_LIVE: "1" } : {}),
			},
		});
		const output = `${child.stdout || ""}\n${child.stderr || ""}`;
		const result = child.status === 0 ? parseEvalResult(output) : undefined;
		if (
			result?.structuralValid &&
			fixture.admissibleFirstTargets.includes(result.firstTarget)
		) {
			const preferredFirstTarget = fixture.preferredFirstTargets.includes(
				result.firstTarget,
			);
			observations.push({
				trial,
				...result,
				preferredFirstTarget,
				classification: preferredFirstTarget
					? "preferred"
					: "admissible-non-preferred",
			});
		} else if (result?.structuralValid) {
			observations.push({
				trial,
				...result,
				classification: "inadmissible-result",
				evidence: `Runner accepted inadmissible first target ${result.firstTarget}`,
			});
		} else {
			observations.push({
				trial,
				classification: classifyLiveFailure(output),
				exitCode: child.status,
				signal: child.signal,
				evidence: output.trim().slice(0, 2_000),
			});
		}
	}

	report.fixtures.push(summarizeTrialObservations(fixture.id, observations));
}

const reportPath =
	process.env.DEVELOPER_EVAL_REPORT ||
	join(
		tmpdir(),
		`developer-probabilistic-eval-${transport}-${Date.now()}.json`,
	);
await writeFile(reportPath, JSON.stringify(report, null, 2));
for (const fixture of report.fixtures) {
	const percent = (value) => `${(value * 100).toFixed(1)}%`;
	console.log(
		`${fixture.fixtureId}: accepted ${fixture.accepted}/${fixture.trials} (${percent(fixture.acceptanceRate)}), ` +
			`preferred ${fixture.preferred}/${fixture.accepted || 0} (${percent(fixture.preferredRateAmongAccepted)}), ` +
			`inadmissible ${fixture.inadmissible}`,
	);
}
console.log(`Probabilistic eval report: ${reportPath}`);

if (report.fixtures.some((fixture) => fixture.inadmissible > 0))
	process.exitCode = 1;

const minimum = process.env.DEVELOPER_EVAL_MIN_ACCEPTANCE_RATE;
if (minimum !== undefined) {
	const threshold = Number(minimum);
	if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) {
		throw new Error(
			"DEVELOPER_EVAL_MIN_ACCEPTANCE_RATE must be between 0 and 1",
		);
	}
	if (report.fixtures.some((fixture) => fixture.acceptanceRate < threshold))
		process.exitCode = 1;
}
