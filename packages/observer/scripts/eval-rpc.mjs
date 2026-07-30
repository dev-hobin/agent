import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const piEntry = fileURLToPath(
	import.meta.resolve("@earendil-works/pi-coding-agent"),
);
const piCli = join(dirname(piEntry), "cli.js");
async function packageVersion(path) {
	try {
		const parsed = JSON.parse(await readFile(path, "utf8"));
		return typeof parsed?.version === "string" ? parsed.version : "unknown";
	} catch {
		return "unknown";
	}
}
const piVersion = await packageVersion(
	join(dirname(piEntry), "..", "package.json"),
);
const sandbox = await mkdtemp(join(tmpdir(), "observer-rpc-"));
const configDir = join(sandbox, "agent");
const workspace = join(sandbox, "workspace");
const home = join(sandbox, "home");
const notebook = join(home, "Observer Notes");
await Promise.all([
	mkdir(configDir, { recursive: true }),
	mkdir(workspace, { recursive: true }),
	mkdir(home, { recursive: true }),
]);
await writeFile(
	join(configDir, "settings.json"),
	JSON.stringify({ packages: [root] }, null, 2),
);

const child = spawn(
	process.execPath,
	[piCli, "--mode", "rpc", "--offline", "--no-session"],
	{
		cwd: workspace,
		env: { ...process.env, HOME: home, PI_CODING_AGENT_DIR: configDir },
		stdio: ["pipe", "pipe", "pipe"],
	},
);

let stderr = "";
let buffer = "";
let nextId = 1;
const events = [];
const waiters = new Map();

child.stderr.setEncoding("utf8");
child.stderr.on("data", (chunk) => {
	stderr += chunk;
});

function receive(value) {
	events.push(value);
	if (value.type !== "response" || !value.id) return;
	const waiter = waiters.get(value.id);
	if (!waiter) return;
	waiters.delete(value.id);
	waiter(value);
}

child.stdout.setEncoding("utf8");
child.stdout.on("data", (chunk) => {
	buffer += chunk;
	while (true) {
		const boundary = buffer.indexOf("\n");
		if (boundary === -1) return;
		const line = buffer.slice(0, boundary).trim();
		buffer = buffer.slice(boundary + 1);
		if (!line) continue;
		try {
			receive(JSON.parse(line));
		} catch (error) {
			stderr += `\nRPC JSONL parse error: ${error instanceof Error ? error.message : String(error)}\n`;
		}
	}
});

function send(command, timeoutMs = 10_000) {
	const id = `observer-rpc-${nextId++}`;
	child.stdin.write(`${JSON.stringify({ ...command, id })}\n`);
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => {
			waiters.delete(id);
			reject(new Error(`RPC timeout: ${command.type}\n${stderr}`));
		}, timeoutMs);
		waiters.set(id, (response) => {
			clearTimeout(timer);
			resolve(response);
		});
	});
}

async function prompt(message) {
	const response = await send({ type: "prompt", message });
	assert.equal(response.success, true, response.error);
}

try {
	const commands = await send({ type: "get_commands" });
	assert.equal(commands.success, true, commands.error);
	assert.ok(
		commands.data.commands.some(
			(command) =>
				command.name === "observer" && command.source === "extension",
		),
		"Pi did not discover /observer from the package",
	);
	assert.ok(
		commands.data.commands.every((command) => command.name !== "observe"),
		"The removed /observe compatibility command is still registered",
	);
	assert.ok(
		commands.data.commands.every(
			(command) => !command.name.startsWith("observer:"),
		),
		"A forbidden /observer:<action> command is registered",
	);

	await prompt("/observer setup en ~/Observer Notes");
	const manifest = JSON.parse(
		await readFile(join(notebook, ".observer", "notebook.json"), "utf8"),
	);
	assert.equal(manifest.default_language, "en");
	const selection = JSON.parse(
		await readFile(join(configDir, "observer", "selection.json"), "utf8"),
	);
	assert.equal(selection.notebook_id, manifest.notebook_id);

	await prompt("/observer processing off");
	let processing = JSON.parse(
		await readFile(join(configDir, "observer", "processing.json"), "utf8"),
	);
	assert.equal(processing.mode, "off");
	await prompt("/observer processing piggyback");
	processing = JSON.parse(
		await readFile(join(configDir, "observer", "processing.json"), "utf8"),
	);
	assert.equal(processing.mode, "piggyback");

	const onStart = events.length;
	await prompt("/observer on");
	assert.ok(
		events
			.slice(onStart)
			.some(
				(event) =>
					event.type === "extension_ui_request" &&
					event.method === "setStatus" &&
					String(event.statusText).includes("On · Open"),
			),
		"/observer on did not publish live status",
	);

	const statusStart = events.length;
	await prompt("/observer status");
	assert.ok(
		events
			.slice(statusStart)
			.some(
				(event) =>
					event.type === "extension_ui_request" &&
					event.method === "notify" &&
					String(event.message).includes("Observer mode: On") &&
					String(event.message).includes("Working Memos: Not counted yet"),
			),
		"/observer status did not expose honest Korean status",
	);

	const memoEntriesBefore = await send({ type: "get_entries" });
	assert.equal(memoEntriesBefore.success, true, memoEntriesBefore.error);
	const memoStart = events.length;
	await prompt("/observer memo");
	const memoEntriesAfter = await send({ type: "get_entries" });
	assert.equal(memoEntriesAfter.success, true, memoEntriesAfter.error);
	assert.equal(
		memoEntriesAfter.data.entries.length,
		memoEntriesBefore.data.entries.length,
		"/observer memo without a prepared pass appended a session entry",
	);
	assert.equal(memoEntriesAfter.data.leafId, memoEntriesBefore.data.leafId);
	assert.ok(
		events
			.slice(memoStart)
			.some(
				(event) =>
					event.type === "extension_ui_request" &&
					event.method === "notify" &&
					String(event.message).includes(
						"There is no new prepared reconciliation",
					),
			),
		"/observer memo did not report the append-free no-prepared result",
	);

	const offStart = events.length;
	await prompt("/observer off");
	assert.ok(
		events
			.slice(offStart)
			.some(
				(event) =>
					event.type === "extension_ui_request" &&
					event.method === "setStatus" &&
					String(event.statusText).includes("Off · Open"),
			),
		"/observer off did not preserve the open episode",
	);
	process.stdout.write(
		`Observer RPC smoke: package discovery, ~/ setup, processing policy, status, on, memo stutter, and off passed on Pi ${piVersion}\n`,
	);
} finally {
	child.kill("SIGTERM");
	await rm(sandbox, { recursive: true, force: true });
}
