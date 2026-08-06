import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { type TestContext } from "node:test";
import {
	discoverTocDescriptor,
	MAX_TOC_DISCOVERY_BYTES,
	MAX_TOC_DISCOVERY_JSON_FILES,
} from "../src/action-loop/io/discover-skill-toc.ts";
import {
	MAX_TOC_BYTES,
	SKILL_TOC_SCHEMA_URI,
} from "../src/action-loop/routing/parse-toc.ts";

const canonicalToc = {
	$schema: SKILL_TOC_SCHEMA_URI,
	when: ["A bounded judgment needs this Capability."],
	unless: ["Another explicit boundary owns the judgment."],
	references: [
		{
			path: "references/example.md",
			when: ["This material adds a consequential distinction."],
		},
	],
};

async function createWorkspace(t: TestContext): Promise<{
	readonly workspace: string;
	readonly skillRoot: string;
}> {
	const workspace = await mkdtemp(join(tmpdir(), "developer-toc-discovery-"));
	t.after(async () => rm(workspace, { recursive: true, force: true }));
	const skillRoot = join(workspace, "skill");
	await mkdir(skillRoot);
	return { workspace, skillRoot };
}

async function writeJson(
	skillRoot: string,
	name: string,
	value: unknown,
): Promise<void> {
	await writeFile(join(skillRoot, name), JSON.stringify(value));
}

test("discovers one direct-child descriptor by schema rather than filename", async (t) => {
	const { skillRoot } = await createWorkspace(t);
	await mkdir(join(skillRoot, "references"));
	await writeFile(join(skillRoot, "references", "example.md"), "Example\n");
	await writeJson(skillRoot, "routing.json", canonicalToc);
	await writeJson(skillRoot, "package.json", { private: true });

	const result = await discoverTocDescriptor(skillRoot);

	assert.equal(result.status, "structured");
	assert.equal(Object.isFrozen(result), true);
	if (result.status === "structured") {
		assert.equal(result.descriptor.name, "routing.json");
		assert.equal(result.descriptor.byteLength > 0, true);
		assert.deepEqual(result.descriptor.toc.references, [
			{
				path: "references/example.md",
				when: ["This material adds a consequential distinction."],
			},
		]);
		assert.equal(Object.isFrozen(result.descriptor), true);
		assert.equal(Object.isFrozen(result.descriptor.toc), true);
	}
});

test("does not descend, follow a direct-child symlink, or claim unrelated JSON", async (t) => {
	const { workspace, skillRoot } = await createWorkspace(t);
	await mkdir(join(skillRoot, "nested"));
	await writeJson(join(skillRoot, "nested"), "toc.json", canonicalToc);
	await writeJson(skillRoot, "malformed.json", "not a descriptor");
	await writeFile(join(skillRoot, "broken.json"), "{");
	await mkdir(join(skillRoot, "directory.json"));
	const outside = join(workspace, "outside.json");
	await writeFile(outside, JSON.stringify(canonicalToc));
	await symlink(outside, join(skillRoot, "linked.json"));

	const result = await discoverTocDescriptor(skillRoot);

	assert.deepEqual(result, { status: "unstructured" });
});

test("rejects multiple canonical descriptors without choosing by filename", async (t) => {
	const { skillRoot } = await createWorkspace(t);
	await writeJson(skillRoot, "z.json", canonicalToc);
	await writeJson(skillRoot, "a.json", canonicalToc);

	const result = await discoverTocDescriptor(skillRoot);

	assert.equal(result.status, "failed");
	if (result.status === "failed") {
		assert.equal(Object.isFrozen(result), true);
		assert.equal(Object.isFrozen(result.error), true);
		assert.equal(result.error.code, "ambiguous-descriptor");
		assert.deepEqual(result.error.descriptorNames, ["a.json", "z.json"]);
	}
});

test("rejects a known TOC schema family version that runtime does not support", async (t) => {
	const { skillRoot } = await createWorkspace(t);
	const unsupportedSchema = SKILL_TOC_SCHEMA_URI.replace("v0.1", "v9.9");
	await writeJson(skillRoot, "future.json", {
		...canonicalToc,
		$schema: unsupportedSchema,
	});

	const result = await discoverTocDescriptor(skillRoot);

	assert.equal(result.status, "failed");
	if (result.status === "failed") {
		assert.equal(result.error.code, "unsupported-version");
		assert.equal(result.error.path, "future.json");
		assert.equal(result.error.schemaUri, unsupportedSchema);
	}
});

test("recognized but invalid descriptor is not treated as absence", async (t) => {
	const { skillRoot } = await createWorkspace(t);
	await writeJson(skillRoot, "toc.json", { ...canonicalToc, when: [] });

	const result = await discoverTocDescriptor(skillRoot);

	assert.equal(result.status, "failed");
	if (result.status === "failed") {
		assert.equal(result.error.code, "invalid-descriptor");
		assert.equal(result.error.path, "toc.json");
		assert.equal(result.error.parseError?.code, "empty-list");
		assert.equal(result.error.parseError?.path, "$.when");
	}
});

test("bounds the number of direct-child JSON files before reading them", async (t) => {
	const { skillRoot } = await createWorkspace(t);
	await Promise.all(
		Array.from({ length: MAX_TOC_DISCOVERY_JSON_FILES + 1 }, (_, index) =>
			writeJson(
				skillRoot,
				`candidate-${String(index).padStart(2, "0")}.json`,
				{},
			),
		),
	);

	const result = await discoverTocDescriptor(skillRoot);

	assert.equal(result.status, "failed");
	if (result.status === "failed") {
		assert.equal(result.error.code, "too-many-json-files");
	}
});

test("bounds individual and aggregate discovery bytes", async (t) => {
	await t.test("individual file", async (subtest) => {
		const { skillRoot } = await createWorkspace(subtest);
		await writeFile(
			join(skillRoot, "large.json"),
			Buffer.alloc(MAX_TOC_BYTES + 1, 0x20),
		);

		const result = await discoverTocDescriptor(skillRoot);

		assert.equal(result.status, "failed");
		if (result.status === "failed") {
			assert.equal(result.error.code, "descriptor-too-large");
			assert.equal(result.error.path, "large.json");
		}
	});

	await t.test("aggregate files", async (subtest) => {
		const { skillRoot } = await createWorkspace(subtest);
		const payloadSize = Math.floor(MAX_TOC_DISCOVERY_BYTES / 5) + 1024;
		await Promise.all(
			Array.from({ length: 5 }, (_, index) =>
				writeJson(skillRoot, `data-${index}.json`, {
					padding: "x".repeat(payloadSize),
				}),
			),
		);

		const result = await discoverTocDescriptor(skillRoot);

		assert.equal(result.status, "failed");
		if (result.status === "failed") {
			assert.equal(result.error.code, "discovery-too-large");
		}
	});
});

test("rejects a relative, missing, or non-directory Skill root", async (t) => {
	const relative = await discoverTocDescriptor("relative/skill");
	assert.equal(relative.status, "failed");
	if (relative.status === "failed") {
		assert.equal(relative.error.code, "invalid-root");
	}

	const { workspace } = await createWorkspace(t);
	const missing = await discoverTocDescriptor(join(workspace, "missing"));
	assert.equal(missing.status, "failed");
	if (missing.status === "failed") {
		assert.equal(missing.error.code, "invalid-root");
	}

	const file = join(workspace, "SKILL.md");
	await writeFile(file, "not a directory");
	const nonDirectory = await discoverTocDescriptor(file);
	assert.equal(nonDirectory.status, "failed");
	if (nonDirectory.status === "failed") {
		assert.equal(nonDirectory.error.code, "invalid-root");
	}
});
