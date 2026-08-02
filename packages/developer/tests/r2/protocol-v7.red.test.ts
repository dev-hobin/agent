import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

async function extensionSource(name: string): Promise<string> {
	return readFile(join(root, "extensions", name), "utf8");
}

test("D1 red: protocol v7 rejects rather than reinterprets Developer v6 history", async () => {
	const state = await extensionSource("state.ts");
	assert.ok(/developer\/v7/u.test(state), "Missing Developer protocol v7");
	assert.ok(!/developer\/v6/u.test(state), "Developer v6 is still active");
	assert.ok(
		/reroute|restart/iu.test(state),
		"Missing legacy restart diagnostic",
	);
});

test("D1 red: semantic judgment and change authorization use distinct tools", async () => {
	const extension = await extensionSource("developer.ts");
	for (const toolName of [
		"developer_open_judgment",
		"developer_conclude_judgment",
		"developer_authorize_change",
		"developer_record_landing",
	]) {
		assert.ok(
			extension.includes(`name: "${toolName}"`),
			`Missing distinct Developer tool registration: ${toolName}`,
		);
	}
	assert.ok(
		!/developer_route_question|developer_record_judgment|developer_load_guidance/u.test(
			extension,
		),
		"Legacy merged Developer tools remain",
	);
});

test("D1 red: state represents ActiveJudgment and AuthorizedChange without a mode boolean", async () => {
	const state = await extensionSource("state.ts");
	assert.ok(/ActiveJudgment/u.test(state), "Missing ActiveJudgment");
	assert.ok(/AuthorizedChange/u.test(state), "Missing AuthorizedChange");
	assert.ok(/JudgmentConcluded/u.test(state), "Missing JudgmentConcluded");
	assert.ok(/LandingRecorded/u.test(state), "Missing LandingRecorded");
	assert.ok(
		!/activeRoute|changedArtifacts/u.test(state),
		"Merged activeRoute/changedArtifacts state remains",
	);
});

test("D1 red: only the next operation for the active work variant is exposed", async () => {
	const [extension, machine] = await Promise.all([
		extensionSource("developer.ts"),
		extensionSource("machine.ts"),
	]);
	assert.ok(
		/ActiveJudgment[\s\S]*developer_conclude_judgment/u.test(machine),
		"ActiveJudgment does not expose only its conclusion operation",
	);
	assert.ok(
		/AuthorizedChange[\s\S]*developer_record_landing/u.test(machine),
		"AuthorizedChange does not expose only its landing operation",
	);
	assert.ok(
		!/target\s*===\s*["']implementation["']/u.test(machine),
		"Implementation still branches through a merged route target",
	);
	assert.ok(
		!/changedArtifacts/u.test(extension),
		"changedArtifacts boolean remains",
	);
});
