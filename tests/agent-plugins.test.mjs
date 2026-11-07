import assert from "node:assert/strict";
import { cp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

import {
	assertMarketplaceCatalogs,
	assertPluginManifest,
	checkCodexPlugin,
	checkPortablePlugin,
	loadPluginSchema,
	pluginSchemaId,
	readCatalogs,
	readJson,
	repositoryRoot,
} from "../scripts/check-agent-plugins.mjs";
import { tempRoot } from "./temp-root.mjs";

const temp = tempRoot(import.meta.url);
const minimal = { $schema: pluginSchemaId, name: "fixture" };
const upstreamRoot = join(repositoryRoot, "schemas/upstream/agent-plugins/1.0.0");

async function temporaryDirectory(t) {
	return temp.dir("agent-plugins");
}

async function pluginFixture(t) {
	const directory = await temporaryDirectory(t);
	await writeFile(join(directory, "plugin.json"), JSON.stringify(minimal));
	return directory;
}

test("the schema and its license retain exact pinned upstream bytes and documented provenance", async () => {
	const { source, schema } = await loadPluginSchema();
	assert.equal(source.project, "https://github.com/agentplugins/agent-plugins-spec");
	assert.equal(source.commit, "bd383552095128f6effe895b9257cfd580a6d179");
	assert.equal(source.version, "1.0.0");
	assert.equal(source.tag, "v1.0.0");
	assert.equal(source.license, "Apache-2.0");
	assert.equal(schema.$id, pluginSchemaId);
	assert.ok((await readFile(join(repositoryRoot, "docs/standards.md"), "utf8")).includes(source.commit));
});

for (const name of ["plugin.schema.json", "LICENSE"]) {
	test(`unreviewed changes to upstream ${name} cannot pass`, async (t) => {
		const directory = await temporaryDirectory(t);
		await cp(upstreamRoot, directory, { recursive: true });
		await writeFile(join(directory, name), "changed\n");
		await assert.rejects(loadPluginSchema(directory), /differs from its pinned SHA-256/);
	});
}

test("upstream accepts the minimal manifest and does not require our release conventions", () => {
	assertPluginManifest(minimal);
	assertPluginManifest({ ...minimal, name: "acme.tools", version: "nightly",
		license: "custom license", homepage: "not a URL", author: { email: "not an email" } });
	assertPluginManifest({ ...minimal, extensions: { "com.example.client": { arbitrary: true } } });
});

test("missing, unknown, wrongly typed and unsupported-version manifest fields fail authoring", () => {
	for (const manifest of [null, [], {}, { name: "fixture" }, { $schema: pluginSchemaId },
		{ ...minimal, $schema: "https://example.com/other-schema" },
		{ ...minimal, version: 2 }, { ...minimal, skills: ["./other"] },
		{ ...minimal, hooks: "./hooks.json" }, { ...minimal, author: { extra: "value" } },
		{ ...minimal, extensions: [] }, { ...minimal, keywords: [3] }]) {
		assert.throws(() => assertPluginManifest(manifest), /Invalid Agent Plugins manifest/);
	}
});

test("upstream plugin name constraints include periods but reject invalid boundaries", () => {
	for (const name of ["a", "acme.tools", "lint3r", "a".repeat(64)]) assertPluginManifest({ ...minimal, name });
	for (const name of ["", "Upper", "-start", "end-", ".start", "end.", "has--double", "has..dots", "a/b", "a".repeat(65)]) {
		assert.throws(() => assertPluginManifest({ ...minimal, name }), /Invalid Agent Plugins manifest/);
	}
});

test("both host catalogs list the same plugins at their host implementation directories", async () => {
	const { claude, codex } = await readCatalogs();
	assertMarketplaceCatalogs(claude, codex);
	for (const entry of codex.plugins) {
		const { plugin, skills } = await checkCodexPlugin(join(repositoryRoot, entry.source));
		assert.equal(plugin.name, entry.name);
		assert.ok(skills.length > 0, `${entry.name}: at least one skill`);
		assert.equal((await readJson(join(repositoryRoot, `claude/plugins/${entry.name}/.claude-plugin/plugin.json`))).name, entry.name);
	}
	for (const change of [{ source: "../outside" }, { name: "model" }, { hooks: "./hooks.json" }]) {
		const changed = structuredClone(claude);
		Object.assign(changed.plugins[0], change);
		assert.throws(() => assertMarketplaceCatalogs(changed, codex));
	}
	const changed = structuredClone(codex);
	delete changed.plugins[0].policy;
	assert.throws(() => assertMarketplaceCatalogs(claude, changed), /explicit host policy/);
});

test("a missing optional skills directory is valid, but a missing portable manifest is not", async (t) => {
	const directory = await pluginFixture(t);
	assert.deepEqual((await checkPortablePlugin(directory)).skills, []);
	await rm(join(directory, "plugin.json"));
	await assert.rejects(checkPortablePlugin(directory), /ENOENT/);
});

test("portable Skill discovery is immediate-child only, not recursive", async (t) => {
	const directory = await pluginFixture(t);
	await mkdir(join(directory, "skills/direct"), { recursive: true });
	await mkdir(join(directory, "skills/group/nested"), { recursive: true });
	await writeFile(join(directory, "skills/direct/SKILL.md"), "direct\n");
	await writeFile(join(directory, "skills/group/nested/SKILL.md"), "nested\n");
	assert.deepEqual((await checkPortablePlugin(directory)).skills, [join(directory, "skills/direct")]);
});

test("a present non-directory or dangling skills location cannot pass", async (t) => {
	const directory = await pluginFixture(t);
	await writeFile(join(directory, "skills"), "not a directory\n");
	await assert.rejects(checkPortablePlugin(directory), /skills must be a directory/);
	await rm(join(directory, "skills"));
	await symlink(join(directory, "missing"), join(directory, "skills"));
	await assert.rejects(checkPortablePlugin(directory), /ENOENT/);
});

test("contained symlinks are allowed by the portable path rule", async (t) => {
	const directory = await pluginFixture(t);
	await mkdir(join(directory, "skills/direct"), { recursive: true });
	await writeFile(join(directory, "skills/direct/body.md"), "body\n");
	await symlink("body.md", join(directory, "skills/direct/SKILL.md"));
	assert.equal((await checkPortablePlugin(directory)).skills.length, 1);
});

for (const target of ["plugin.json", "skills", "skills/direct/escape.md"]) {
	test(`an escaping ${target} cannot pass the package containment check`, async (t) => {
		const directory = await pluginFixture(t);
		const outside = await temporaryDirectory(t);
		await mkdir(join(directory, "skills/direct"), { recursive: true });
		await writeFile(join(directory, "skills/direct/SKILL.md"), "body\n");
		const destination = target === "skills" ? outside : join(outside, "file");
		if (target !== "skills") await writeFile(destination, JSON.stringify(minimal));
		await rm(join(directory, target), { recursive: true, force: true });
		await symlink(destination, join(directory, target));
		await assert.rejects(checkPortablePlugin(directory), /escapes plugin root/);
	});
}

test("a Codex implementation ships only .codex-plugin/plugin.json, so Codex loads its hooks", async (t) => {
	const directory = await temporaryDirectory(t);
	await cp(join(repositoryRoot, "codex/plugins/hobin-review"), directory, { recursive: true });
	assert.equal((await checkCodexPlugin(directory)).plugin.name, "hobin-review");
	await writeFile(join(directory, "plugin.json"), JSON.stringify(minimal));
	await assert.rejects(checkCodexPlugin(directory), /hides the plugin's hooks/);
	await rm(join(directory, "plugin.json"));
	const manifest = await readJson(join(directory, ".codex-plugin/plugin.json"));
	delete manifest.hooks;
	await writeFile(join(directory, ".codex-plugin/plugin.json"), JSON.stringify(manifest));
	await assert.rejects(checkCodexPlugin(directory), /declare hooks\/hooks\.json/);
});
