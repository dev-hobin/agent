// Opt-in native compatibility probe, never a consumer installer or live-model evaluation.
import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, isAbsolute, join, relative, sep } from "node:path";
import { promisify } from "node:util";

import { checkPluginPackage, packageNames, pluginSchemaId, readJson, repositoryRoot } from "./check-agent-plugins.mjs";

const exec = promisify(execFile);
const args = process.argv.slice(2).filter((argument) => argument !== "--");
const [host] = args;
assert.ok(args.length === 1 && (host === "claude" || host === "codex"), "Usage: pnpm check:install -- <claude|codex>");
const temporary = await realpath(await mkdtemp(join(tmpdir(), "hobin-plugin-install-")));
const home = join(temporary, "home");
const marketplace = join(temporary, "marketplace");
const projects = [join(temporary, "work-a"), join(temporary, "work-b")];
// An allowlist deliberately avoids inheriting credentials, host config overrides or git helpers.
const env = {
	PATH: process.env.PATH,
	HOME: home,
	CLAUDE_CONFIG_DIR: join(home, ".claude"),
	CODEX_HOME: join(home, ".codex"),
	XDG_CONFIG_HOME: join(home, ".config"),
	XDG_CACHE_HOME: join(home, ".cache"),
	XDG_DATA_HOME: join(home, ".local/share"),
	TMPDIR: join(temporary, "tmp"),
	npm_config_cache: join(temporary, "npm-cache"),
	npm_config_userconfig: join(temporary, "npmrc"),
	GIT_CONFIG_NOSYSTEM: "1",
	GIT_CONFIG_GLOBAL: join(temporary, "gitconfig"),
	GIT_TERMINAL_PROMPT: "0",
	CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
	DISABLE_TELEMETRY: "1",
	DO_NOT_TRACK: "1",
	NO_COLOR: "1",
	TERM: "dumb",
	LANG: "en_US.UTF-8",
};

async function run(command, args, cwd = projects[0]) {
	return exec(command, args, { cwd, env, timeout: 60_000, maxBuffer: 4 * 1024 * 1024 });
}

function assertInside(path, root) {
	const offset = relative(root, path);
	assert.ok(offset && offset !== ".." && !offset.startsWith(`..${sep}`) && !isAbsolute(offset),
		`Native installation escaped the temporary environment: ${path}`);
}

async function assertSameTree(source, installed) {
	const entries = await readdir(source, { withFileTypes: true });
	assert.deepEqual((await readdir(installed)).sort(), entries.map((entry) => entry.name).sort());
	for (const entry of entries) {
		const from = join(source, entry.name);
		const to = join(installed, entry.name);
		if (entry.isDirectory()) await assertSameTree(from, to);
		else assert.deepEqual(await readFile(to), await readFile(from), `Installed resource changed: ${to}`);
	}
}

// Only metadata methods are sent: no thread/start, turn/start, prompt, or model call.
async function codexSkills(cwd) {
	const child = spawn("codex", ["app-server", "--stdio"], { cwd, env, stdio: ["pipe", "pipe", "pipe"] });
	const pending = new Map();
	let nextId = 1;
	let buffer = "";
	let errors = "";
	child.stderr.on("data", (chunk) => { errors = (errors + chunk).slice(-8000); });
	child.stdout.on("data", (chunk) => {
		buffer += chunk;
		let newline;
		while ((newline = buffer.indexOf("\n")) !== -1) {
			const line = buffer.slice(0, newline);
			buffer = buffer.slice(newline + 1);
			if (!line.trim()) continue;
			let message;
			try { message = JSON.parse(line); } catch { continue; }
			const waiter = pending.get(message.id);
			if (!waiter) continue;
			pending.delete(message.id);
			if (message.error) waiter.reject(new Error(JSON.stringify(message.error)));
			else waiter.resolve(message.result);
		}
	});
	const fail = (error) => {
		for (const waiter of pending.values()) waiter.reject(error);
		pending.clear();
	};
	child.on("error", fail);
	child.stdin.on("error", fail);
	child.on("exit", (code) => fail(new Error(`Codex metadata server exited (${code}): ${errors}`)));
	function request(method, params) {
		const id = nextId++;
		return new Promise((resolve, reject) => {
			pending.set(id, { resolve, reject });
			child.stdin.write(`${JSON.stringify({ id, method, params })}\n`);
		});
	}
	const timer = setTimeout(() => {
		fail(new Error(`Codex metadata request timed out: ${errors}`));
		child.kill("SIGKILL");
	}, 30_000);
	try {
		await request("initialize", { clientInfo: { name: "hobin-plugin-check", version: "0.0.0" }, capabilities: { experimentalApi: true } });
		child.stdin.write(`${JSON.stringify({ method: "initialized", params: {} })}\n`);
		return await request("skills/list", { cwds: [cwd], forceReload: true });
	} finally {
		clearTimeout(timer);
		const closed = once(child, "close");
		child.stdin.end();
		child.kill("SIGTERM");
		const killTimer = setTimeout(() => child.kill("SIGKILL"), 2000);
		await closed;
		clearTimeout(killTimer);
	}
}

try {
	for (const path of [home, env.CLAUDE_CONFIG_DIR, env.CODEX_HOME, env.TMPDIR, join(marketplace, "packages"), ...projects]) {
		await mkdir(path, { recursive: true });
	}
	await writeFile(env.npm_config_userconfig, "");
	await writeFile(env.GIT_CONFIG_GLOBAL, "");
	const catalogRelative = host === "claude" ? ".claude-plugin/marketplace.json" : ".agents/plugins/marketplace.json";
	const catalog = await readJson(join(repositoryRoot, catalogRelative));
	const expected = [];
	for (const name of packageNames) {
		const packageRoot = join(repositoryRoot, "packages", name);
		const { stdout } = await run("npm", ["pack", "--json", "--ignore-scripts", "--pack-destination", temporary], packageRoot);
		const [pack] = JSON.parse(stdout);
		const destination = join(marketplace, "packages", name);
		await mkdir(destination);
		await run("tar", ["-xzf", join(temporary, pack.filename), "-C", destination, "--strip-components=1"]);
		const { plugin, skills } = await checkPluginPackage(destination);
		expected.push({ name: plugin.name, version: plugin.version, packageName: name,
			skillNames: skills.map((path) => basename(path)).sort() });
	}

	// A different publisher/plugin owns another `model`: installation must not overwrite ours.
	const peer = join(marketplace, "fixtures/peer");
	await mkdir(join(peer, "skills/model"), { recursive: true });
	const peerManifest = { name: "hobin-probe-peer", version: "0.0.0", description: "Native namespace probe" };
	await writeFile(join(peer, "plugin.json"), JSON.stringify({ $schema: pluginSchemaId, ...peerManifest }));
	if (host === "claude") {
		await mkdir(join(peer, ".claude-plugin"));
		await writeFile(join(peer, ".claude-plugin/plugin.json"), JSON.stringify(peerManifest));
	}
	await writeFile(join(peer, "skills/model/SKILL.md"), "---\nname: model\ndescription: A harmless native namespace probe.\n---\n\nReport that this is the peer fixture.\n");
	const peerEntry = { name: peerManifest.name, source: "./fixtures/peer", category: "Productivity" };
	if (host === "codex") peerEntry.policy = { installation: "AVAILABLE", authentication: "ON_INSTALL" };
	catalog.plugins.push(peerEntry);
	const catalogPath = join(marketplace, catalogRelative);
	await mkdir(join(catalogPath, ".."), { recursive: true });
	await writeFile(catalogPath, JSON.stringify(catalog));

	const version = (await run(host, ["--version"])).stdout.trim();
	await run(host, ["plugin", "marketplace", "add", marketplace, ...(host === "claude" ? ["--scope", "user"] : ["--json"])]);
	const installedPaths = new Map();
	for (const name of [...expected.map((plugin) => plugin.name), peerManifest.name]) {
		const result = await run(host, ["plugin", host === "claude" ? "install" : "add", `${name}@hobin-agent`,
			...(host === "claude" ? ["--scope", "user"] : ["--json"])]);
		if (host === "codex") installedPaths.set(name, JSON.parse(result.stdout).installedPath);
	}

	for (const cwd of projects) {
		const { stdout } = await run(host, ["plugin", "list", "--json"], cwd);
		const listed = JSON.parse(stdout);
		const installed = host === "claude" ? listed : listed.installed;
		for (const plugin of [...expected, peerManifest]) {
			const entry = installed.find((item) => (item.id ?? item.pluginId) === `${plugin.name}@hobin-agent`);
			assert.ok(entry, `Missing ${plugin.name} when starting from ${cwd}`);
			assert.equal(entry.enabled, true);
			assert.equal(entry.version, plugin.version);
			if (host === "claude") {
				assert.equal(entry.scope, "user");
				installedPaths.set(plugin.name, entry.installPath);
			}
		}
	}

	const peerExpected = { ...peerManifest, skillNames: ["model"] };
	if (host === "claude") {
		for (const plugin of [...expected, peerExpected]) {
			const { stdout } = await run("claude", ["plugin", "details", `${plugin.name}@hobin-agent`], projects[1]);
			assert.ok(stdout.includes(`Source: ${plugin.name}@hobin-agent`));
			const inventory = stdout.match(/Skills \((\d+)\)\s+([^\n]+)/u);
			assert.ok(inventory, `No native component inventory for ${plugin.name}`);
			assert.equal(Number(inventory[1]), plugin.skillNames.length);
			assert.deepEqual(inventory[2].trim().split(", ").sort(), plugin.skillNames);
		}
	} else {
		for (const cwd of projects) {
			const result = await codexSkills(cwd);
			const inventory = result.data.find((entry) => entry.cwd === cwd);
			assert.ok(inventory, "Codex did not return the requested workspace inventory");
			assert.deepEqual(inventory.errors, []);
			for (const plugin of [...expected, peerExpected]) {
				const skills = inventory.skills.filter((skill) => skill.pluginId === `${plugin.name}@hobin-agent`);
				assert.deepEqual(skills.map((skill) => skill.name).sort(), plugin.skillNames.map((name) => `${plugin.name}:${name}`));
				assert.ok(skills.every((skill) => skill.enabled && skill.scope === "user"));
				for (const skill of skills) assertInside(await realpath(skill.path), home);
			}
		}
	}
	assert.equal(new Set(installedPaths.values()).size, expected.length + 1);
	for (const plugin of [...expected, peerExpected]) {
		const installed = await realpath(installedPaths.get(plugin.name));
		assertInside(installed, home);
		const source = plugin.name === peerManifest.name ? peer : join(repositoryRoot, "packages", plugin.packageName);
		await assertSameTree(join(source, "skills"), join(installed, "skills"));
		if (plugin.name !== peerManifest.name) {
			const packed = await checkPluginPackage(installed);
			assert.equal(packed.plugin.name, plugin.name);
		}
	}
	console.log(JSON.stringify({ host, version, isolated: true,
		packedArtifacts: expected.map((plugin) => ({ name: plugin.name, version: plugin.version, skillCount: plugin.skillNames.length })),
		projects: projects.length, nativeInventoryChecked: true, installedResourcesMatchSource: true,
		peerWithSameSkillName: true, qualifiedCodexNamesChecked: host === "codex", modelCalls: false }));
} finally {
	await rm(temporary, { recursive: true, force: true });
}
