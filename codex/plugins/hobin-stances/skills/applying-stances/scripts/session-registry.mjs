// A session registry: the files an agent session made or ran, so that a plugin's hooks can check
// exactly those. It is a JSON-lines file, <start dir>/<name>/sessions/<session id>.jsonl, one line
// {"file": "<absolute path>", "at": "<time>"} per registration, append only. <name> is the caller's
// folder (for example ".my-plugin"); <name>/.gitignore holds `*` so the work tree shows nothing.
//
// A hook creates the registry where the session started (ensureRegistry) and reads it
// (registered). A script run in the session's shell finds it from its working directory upward
// with the session id the host gives shell commands (sessionId, registryFor) and appends to it
// (register). The host-specific part is only the session variable: CLAUDE_CODE_SESSION_ID on Claude
// Code and CODEX_SESSION_ID on Codex, each equal to the session_id the host gives its hooks.
import { accessSync, appendFileSync, constants, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";

export const SESSION_ENV = ["CLAUDE_CODE_SESSION_ID", "CODEX_SESSION_ID"];

// The agent session ids in a shell command's environment. Usually one; more when one host was
// started from the other's shell (Codex run in a Claude Code terminal inherits
// CLAUDE_CODE_SESSION_ID), so callers look for the registry of each.
export function sessionIds(env = process.env) {
	return [...new Set(SESSION_ENV.map((name) => env[name]).filter((id) => typeof id === "string" && id.trim()).map((id) => id.trim()))];
}

const safe = (value) => String(value ?? "").replace(/[^\w-]/g, "");
export const registryPath = ({ name, sessionId, startDir }) => join(startDir, name, "sessions", `${safe(sessionId)}.jsonl`);

// Creates the registry if it is missing (never truncates one) and returns its path.
export function ensureRegistry({ name, sessionId, startDir }) {
	const path = registryPath({ name, sessionId, startDir });
	mkdirSync(dirname(path), { recursive: true });
	const ignore = join(startDir, name, ".gitignore");
	if (!existsSync(ignore)) writeFileSync(ignore, "*\n");
	writeFileSync(path, "", { flag: "a" });
	return path;
}

// The writable registry of `sessionId` in `cwd` or the nearest parent holding one, or undefined.
export function registryFor({ name, sessionId, cwd = process.cwd() }) {
	for (let dir = resolve(cwd); ; dir = dirname(dir)) {
		const path = registryPath({ name, sessionId, startDir: dir });
		if (existsSync(path)) {
			try { accessSync(path, constants.W_OK); return path; } catch { return undefined; }
		}
		if (dir === dirname(dir)) return undefined;
	}
}

// Appends `file` (made absolute) to the registry.
export function register(path, file, at = new Date().toISOString()) {
	appendFileSync(path, `${JSON.stringify({ file: resolve(file), at })}\n`);
}

// The distinct absolute paths the registry lists, in first-registered order.
export function registered(path) {
	let text;
	try { text = readFileSync(path, "utf8"); } catch { return []; }
	const files = text.split("\n").flatMap((line) => {
		try { const { file } = JSON.parse(line); return typeof file === "string" && isAbsolute(file) ? [file] : []; } catch { return []; }
	});
	return [...new Set(files)];
}

export function removeRegistry({ name, sessionId, startDir }) {
	rmSync(registryPath({ name, sessionId, startDir }), { force: true });
}

// Removes registries in `startDir` not written for `maxAgeMs` (sessions that never ended cleanly).
export function pruneRegistries({ name, startDir, maxAgeMs = 7 * 24 * 60 * 60 * 1000, now = Date.now() }) {
	const dir = join(startDir, name, "sessions");
	let names;
	try { names = readdirSync(dir); } catch { return; }
	for (const file of names) {
		try { if (now - statSync(join(dir, file)).mtimeMs > maxAgeMs) rmSync(join(dir, file), { force: true }); } catch {}
	}
}
