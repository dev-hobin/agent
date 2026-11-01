// Development-time checks; not a plugin loader, installer, or client conformance suite.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { lstat, readFile, readdir, realpath, stat } from "node:fs/promises";
import { isAbsolute, join, relative, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import Ajv2020 from "ajv/dist/2020.js";

export const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const upstreamRoot = fileURLToPath(new URL("../schemas/upstream/agent-plugins/1.0.0/", import.meta.url));

export async function readJson(path) {
	try {
		return JSON.parse(await readFile(path, "utf8"));
	} catch (error) {
		throw new Error(`Cannot read JSON metadata at ${path}`, { cause: error });
	}
}

export async function loadPluginSchema(directory = upstreamRoot) {
	const source = await readJson(join(directory, "source.json"));
	for (const [name, digest] of [["plugin.schema.json", source.schemaSha256], ["LICENSE", source.licenseSha256]]) {
		const bytes = await readFile(join(directory, name));
		assert.equal(createHash("sha256").update(bytes).digest("hex"), digest,
			`Upstream ${name} differs from its pinned SHA-256; review the source before updating`);
	}
	return { source, schema: await readJson(join(directory, "plugin.schema.json")) };
}

const { schema } = await loadPluginSchema();
export const pluginSchemaId = schema.$id;
const validateManifest = new Ajv2020({ allErrors: true, strict: true }).compile(schema);

// Upstream schema requirements only. Optional metadata is not made mandatory here.
export function assertPluginManifest(manifest) {
	assert.ok(validateManifest(manifest), `Invalid Agent Plugins manifest: ${JSON.stringify(validateManifest.errors)}`);
}

async function containedPath(root, path) {
	const resolved = await realpath(path);
	const offset = relative(root, resolved);
	assert.ok(offset !== ".." && !offset.startsWith(`..${sep}`) && !isAbsolute(offset),
		`Package path escapes plugin root: ${path}`);
	return resolved;
}

async function checkTree(root, directory, visited = new Set()) {
	const resolved = await containedPath(root, directory);
	if (visited.has(resolved)) return;
	visited.add(resolved);
	for (const entry of await readdir(resolved)) {
		const path = await containedPath(root, join(resolved, entry));
		const info = await stat(path);
		assert.ok(info.isDirectory() || info.isFile(), `Unsupported packaged file kind: ${path}`);
		if (info.isDirectory()) await checkTree(root, path, visited);
	}
}

// Applicable author obligations for our skills-only portable component, not runtime failure semantics.
export async function checkPortablePlugin(packageRoot) {
	const root = await realpath(packageRoot);
	const manifestPath = await containedPath(root, join(root, "plugin.json"));
	assert.ok((await stat(manifestPath)).isFile(), "plugin.json must be a regular file");
	const plugin = await readJson(manifestPath);
	assertPluginManifest(plugin);
	const skillsRoot = join(root, "skills");
	try {
		await lstat(skillsRoot);
	} catch (error) {
		if (error.code !== "ENOENT") throw error;
		return { plugin, skills: [] };
	}
	await containedPath(root, skillsRoot);
	assert.ok((await stat(skillsRoot)).isDirectory(), "skills must be a directory when present");
	await checkTree(root, skillsRoot);
	const skills = [];
	for (const name of await readdir(skillsRoot)) {
		const path = join(skillsRoot, name);
		if (!(await stat(path)).isDirectory()) continue;
		try {
			const entry = await containedPath(root, join(path, "SKILL.md"));
			if ((await stat(entry)).isFile()) skills.push(path);
		} catch (error) {
			if (error.code !== "ENOENT") throw error;
		}
	}
	return { plugin, skills: skills.sort() };
}

// A Codex implementation's manifest. Codex 0.166 loads a plugin's hooks only from
// `.codex-plugin/plugin.json` with no root `plugin.json` beside it (a root Agent Plugins manifest
// hides them, whatever its `extensions.com.openai.hooks` says), so Codex implementations ship that
// manifest alone. checkPortablePlugin stays for the day Codex reads hooks from the root manifest.
export async function checkCodexPlugin(packageRoot) {
	const root = await realpath(packageRoot);
	await assert.rejects(lstat(join(root, "plugin.json")), { code: "ENOENT" },
		"A root plugin.json hides the plugin's hooks from Codex; keep only .codex-plugin/plugin.json");
	const manifestPath = await containedPath(root, join(root, ".codex-plugin/plugin.json"));
	assert.ok((await stat(manifestPath)).isFile(), ".codex-plugin/plugin.json must be a regular file");
	const plugin = await readJson(manifestPath);
	for (const field of ["name", "version", "description"]) assert.equal(typeof plugin[field], "string", `${field} must be a string`);
	assert.match(plugin.version, /^\d+\.\d+\.\d+$/, "version must be semver");
	assert.equal(plugin.skills, "./skills/", "skills must be ./skills/");
	assert.equal(typeof plugin.interface?.displayName, "string", "interface.displayName must be a string");
	if (existsSync(join(root, "hooks/hooks.json"))) assert.equal(plugin.hooks, "./hooks/hooks.json", "declare hooks/hooks.json as hooks");
	else assert.equal(plugin.hooks, undefined, "hooks names a missing file");
	const skillsRoot = await containedPath(root, join(root, "skills"));
	await checkTree(root, skillsRoot);
	const skills = [];
	for (const name of await readdir(skillsRoot)) {
		if (existsSync(join(skillsRoot, name, "SKILL.md"))) skills.push(join(skillsRoot, name));
	}
	return { plugin, skills: skills.sort() };
}

// Repository conventions: both host catalogs list the same plugins, each pointing at
// that host's implementation directory.
export function assertMarketplaceCatalogs(claude, codex) {
	assert.equal(claude.name, "hobin");
	assert.equal(codex.name, claude.name);
	assert.equal(claude.owner.name, "dev-hobin");
	assert.equal(typeof claude.description, "string");
	assert.equal(codex.interface.displayName, "Hobin agent resources");
	assert.deepEqual(claude.plugins.map((p) => p.name), codex.plugins.map((p) => p.name),
		"Repository policy: both host catalogs list the same plugins");
	for (const entry of claude.plugins) {
		assert.deepEqual(entry, { name: entry.name, source: `./claude/plugins/${entry.name}`, category: "Productivity" },
			"Repository policy: Claude catalog entries point at claude/plugins/<name>");
	}
	for (const entry of codex.plugins) {
		assert.deepEqual(entry, { name: entry.name, source: `./codex/plugins/${entry.name}`,
			policy: { installation: "AVAILABLE", authentication: "ON_INSTALL" }, category: "Productivity" },
			"Repository policy: Codex catalog entries point at codex/plugins/<name> with explicit host policy");
	}
}

export async function readCatalogs(root = repositoryRoot) {
	return { claude: await readJson(join(root, ".claude-plugin/marketplace.json")),
		codex: await readJson(join(root, ".agents/plugins/marketplace.json")) };
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
	const { claude, codex } = await readCatalogs();
	assertMarketplaceCatalogs(claude, codex);
	let count = 0;
	for (const entry of codex.plugins) {
		const { plugin, skills } = await checkCodexPlugin(join(repositoryRoot, entry.source));
		assert.equal(plugin.name, entry.name);
		count += skills.length;
	}
	console.log(`Codex: ${codex.plugins.length} .codex-plugin manifests and ${count} immediate Skill directories passed manifest/path checks`);
}
