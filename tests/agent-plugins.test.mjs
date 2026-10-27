import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
	assertMarketplaceCatalogs,
	assertPluginIdentity,
	assertPluginManifest,
	checkPluginPackage,
	checkPortablePlugin,
	loadPluginSchema,
	packageNames,
	pluginSchemaId,
	readJson,
	repositoryRoot,
} from "../scripts/check-agent-plugins.mjs";

const minimal = { $schema: pluginSchemaId, name: "fixture" };
const upstreamRoot = join(repositoryRoot, "schemas/upstream/agent-plugins/1.0.0");

async function temporaryDirectory(t) {
	const directory = await mkdtemp(join(tmpdir(), "agent-plugins-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	return realpath(directory);
}

async function pluginFixture(t) {
	const directory = await temporaryDirectory(t);
	await writeFile(join(directory, "plugin.json"), JSON.stringify(minimal));
	return directory;
}

function identities() {
	const pkg = { name: "@hobin/developer", version: "0.2.2", description: "Fixture",
		author: { name: "Fixture author" }, license: "MIT", files: ["plugin.json", ".claude-plugin", "skills"] };
	const claude = { name: "hobin-developer", version: pkg.version, description: pkg.description, author: pkg.author };
	return { pkg, claude, plugin: { $schema: pluginSchemaId, ...claude, license: pkg.license } };
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

test("repository policy aligns npm, portable and legacy identities and exported metadata", () => {
	const { pkg, plugin, claude } = identities();
	const seen = new Set();
	assertPluginIdentity(pkg, plugin, claude, seen);
	assert.throws(() => assertPluginIdentity(pkg, plugin, claude, seen), /Duplicate package-owned/);
	assert.throws(() => assertPluginIdentity({ ...pkg, name: "developer" }, plugin, claude), /scoped npm/);
	for (const changed of [{ name: "model" }, { version: "0.2.0" }, { hooks: "./hooks.json" }]) {
		assert.throws(() => assertPluginIdentity(pkg, { ...plugin, ...changed }, claude), /Repository policy/);
	}
	assert.throws(() => assertPluginIdentity(pkg, plugin, { ...claude, name: "other" }), /Claude compatibility/);
	for (const excluded of ["plugin.json", ".claude-plugin", "skills"]) {
		assert.throws(() => assertPluginIdentity({ ...pkg, files: pkg.files.filter((path) => path !== excluded) }, plugin, claude), /npm files must include/);
	}
});

test("our two source packages own disjoint portable identities and unchanged immediate catalogs", async () => {
	const seen = new Set();
	for (const [index, name] of packageNames.entries()) {
		const { pkg, skills } = await checkPluginPackage(join(repositoryRoot, "packages", name), seen);
		assert.equal(pkg.name, `@hobin/${name}`);
		assert.equal(skills.length, [17, 5][index]);
	}
	assert.deepEqual([...seen], ["hobin-developer", "hobin-learning"]);
});

test("host catalogs expose the same canonical roots without component overrides", async () => {
	const claude = await readJson(join(repositoryRoot, ".claude-plugin/marketplace.json"));
	const codex = await readJson(join(repositoryRoot, ".agents/plugins/marketplace.json"));
	const entries = [];
	for (const name of packageNames) {
		const plugin = await readJson(join(repositoryRoot, "packages", name, "plugin.json"));
		entries.push({ name: plugin.name, source: `./packages/${name}` });
	}
	assertMarketplaceCatalogs(claude, codex, entries);
	for (const change of [{ source: "../outside" }, { name: "model" }, { hooks: "./hooks.json" }]) {
		const changed = structuredClone(claude);
		Object.assign(changed.plugins[0], change);
		assert.throws(() => assertMarketplaceCatalogs(changed, codex, entries), /canonical package roots/);
	}
	const changed = structuredClone(codex);
	delete changed.plugins[0].policy;
	assert.throws(() => assertMarketplaceCatalogs(claude, changed, entries), /explicit host policy/);
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

test("adding an MCP component cannot silently widen our checked skills-only profile", async (t) => {
	const directory = await pluginFixture(t);
	const { pkg, plugin, claude } = identities();
	await writeFile(join(directory, "plugin.json"), JSON.stringify(plugin));
	await writeFile(join(directory, "package.json"), JSON.stringify(pkg));
	await mkdir(join(directory, ".claude-plugin"));
	await writeFile(join(directory, ".claude-plugin/plugin.json"), JSON.stringify(claude));
	await writeFile(join(directory, "mcp.json"), "{}");
	await assert.rejects(checkPluginPackage(directory), /adding MCP requires an explicit/);
});
