// Development-time checks; not a plugin loader, installer, or client conformance suite.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { lstat, readFile, readdir, realpath, stat } from "node:fs/promises";
import { isAbsolute, join, relative, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import Ajv2020 from "ajv/dist/2020.js";

export const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
export const packageNames = ["developer", "learning"];
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

// Repository conventions, deliberately separate from the upstream schema.
export function assertPluginIdentity(pkg, plugin, claude, seen = new Set()) {
	assert.match(pkg.name, /^@hobin\/[a-z0-9]+(?:-[a-z0-9]+)*$/u, "Expected a scoped npm package");
	const name = pkg.name.slice(1).replace("/", "-");
	assert.deepEqual(plugin, { $schema: pluginSchemaId, name, version: pkg.version,
		description: pkg.description, author: pkg.author, license: pkg.license },
		"Repository policy: portable identity must match the npm package and contain no executable configuration");
	assert.deepEqual(claude, { name: plugin.name, version: plugin.version,
		description: plugin.description, author: plugin.author },
		"Repository policy: Claude compatibility identity must match portable plugin.json");
	for (const path of ["plugin.json", ".claude-plugin", "skills"]) {
		assert.ok(pkg.files.includes(path), `Repository policy: npm files must include ${path}`);
	}
	assert.ok(!seen.has(name), `Duplicate package-owned plugin identity: ${name}`);
	seen.add(name);
}

export async function checkPluginPackage(packageRoot, seen = new Set()) {
	const result = await checkPortablePlugin(packageRoot);
	const pkg = await readJson(join(packageRoot, "package.json"));
	const claude = await readJson(join(packageRoot, ".claude-plugin/plugin.json"));
	assertPluginIdentity(pkg, result.plugin, claude, seen);
	await assert.rejects(lstat(join(packageRoot, "mcp.json")), { code: "ENOENT" },
		"Repository policy: adding MCP requires an explicit adoption/profile review");
	return { ...result, pkg };
}

export function assertMarketplaceCatalogs(claude, codex, entries) {
	assert.equal(claude.name, "hobin-agent");
	assert.equal(codex.name, claude.name);
	assert.equal(claude.owner.name, "dev-hobin");
	assert.equal(typeof claude.description, "string");
	assert.equal(codex.interface.displayName, "Hobin agent resources");
	assert.deepEqual(claude.plugins, entries.map((entry) => ({ ...entry, category: "Productivity" })),
		"Repository policy: Claude catalog must point only at the canonical package roots");
	assert.deepEqual(codex.plugins, entries.map((entry) => ({ ...entry,
		policy: { installation: "AVAILABLE", authentication: "ON_INSTALL" }, category: "Productivity" })),
		"Repository policy: Codex catalog must expose the same packages with explicit host policy");
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
	let count = 0;
	for (const name of packageNames) {
		const { skills } = await checkPortablePlugin(join(repositoryRoot, "packages", name));
		count += skills.length;
	}
	console.log(`Agent Plugins 1.0.0: ${packageNames.length} manifests and ${count} immediate Skill directories passed schema/path checks`);
}
