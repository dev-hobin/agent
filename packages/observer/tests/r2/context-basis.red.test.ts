import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

function field(value: unknown, key: string): unknown {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		assert.fail(`Expected an object while reading ${key}.`);
	}
	return Reflect.get(value, key);
}

test("O1 red: the 0.2 action surface names source reading and inquiry context explicitly", async () => {
	const [schema, extension] = await Promise.all([
		readFile(join(root, "extensions/memo-tool-schema.ts"), "utf8"),
		readFile(join(root, "extensions/observer.ts"), "utf8"),
	]);
	const surface = `${schema}\n${extension}`;
	for (const action of [
		"record-source-reading",
		"load-inquiry-context",
		"record-observation",
	]) {
		assert.ok(
			surface.includes(action),
			`Missing Observer 0.2 action: ${action}`,
		);
	}
});

test("O1 red: Observer uses compact common context basis instead of copied generic history", async () => {
	const controller = await readFile(
		join(root, "src/observation-controller.ts"),
		"utf8",
	);
	for (const name of [
		"SourceReading",
		"InquiryContext",
		"ContextBasisData",
		"assessObservationContext",
		"assessMemoContext",
	]) {
		assert.ok(
			controller.includes(name),
			`Missing Observer context seam: ${name}`,
		);
	}
	assert.ok(
		!/ObserverJudgmentRecord|applyObserverJudgment|GuidanceSet/u.test(
			controller,
		),
		"Copied generic Judgment adapter remains in Observer",
	);
});

test("O1 red: observation coverage is established before semantic mutation", async () => {
	const controller = await readFile(
		join(root, "src/observation-controller.ts"),
		"utf8",
	);
	const assessment = controller.indexOf("assessObservationContext");
	const mutation = controller.indexOf("appendObservation", assessment + 1);
	assert.notEqual(assessment, -1, "Missing observation context assessment");
	assert.notEqual(mutation, -1, "Missing observation append after assessment");
	assert.ok(
		assessment < mutation,
		"Observation mutation precedes context coverage",
	);
	assert.ok(
		/missing|conflicts/u.test(controller.slice(assessment, mutation)),
		"Observation append is not guarded by missing/conflict coverage",
	);
});

test("O1 red: Observer contracts declare domain evidence and user decisions", async () => {
	for (const unit of ["observation-interpretation", "memo-reconciliation"]) {
		const source = await readFile(
			join(root, "guidance", unit, "judgment.json"),
			"utf8",
		);
		const contract: unknown = JSON.parse(source);
		const sources = field(contract, "sources");
		assert.ok(Array.isArray(sources), `${unit}: missing context sources`);
		const kinds = sources.map((entry) => field(entry, "kind"));
		assert.ok(
			kinds.includes("domain-evidence"),
			`${unit}: missing domain evidence`,
		);
		assert.ok(
			kinds.includes("user-decision"),
			`${unit}: missing user decision`,
		);
		assert.equal(
			field(contract, "routes"),
			undefined,
			`${unit}: legacy routes`,
		);
	}
});

test("O1 red: prose guidance is deleted only after its rules become executable", async () => {
	for (const relativePath of [
		"guidance/observation-interpretation/interpretation.md",
		"guidance/memo-reconciliation/reconciliation.md",
	]) {
		await assert.rejects(
			access(join(root, relativePath)),
			(error: unknown) =>
				typeof error === "object" &&
				error !== null &&
				Reflect.get(error, "code") === "ENOENT",
			relativePath,
		);
	}
});
