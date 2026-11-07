// Opt-in live check of hobin-feature's Stop gate on a real host: it calls a model (small cost) and
// is not part of `pnpm check`. It is the one check of the gate on both hosts with the plugin's hooks
// really running: Codex plugin-eval never installs the plugin, so it measures the skill only.
//   pnpm check:live -- claude
//       claude -p --plugin-dir (the repository's plugin; the installed hobin-feature is disabled for
//       the run and ~/.claude is not changed), the account you are logged in with
//       (`claude auth status`); warns when ANTHROPIC_API_KEY is set. The run grants Bash only for
//       `node <plugin scripts>/scenarios.mjs *` and `cd *`.
//   pnpm check:live -- codex --codex-home <dir>      (or HOBIN_LIVE_CODEX_HOME=<dir>)
//       codex exec with a dedicated CODEX_HOME that you logged in to with ChatGPT; the plugin is
//       installed there from a marketplace copy of this repository (codex plugin marketplace add,
//       codex plugin add), workspace-write sandbox, approval policy never. ~/.codex is never read
//       or copied.
// On each host, in a fresh git project where the plugin's SessionStart hook creates the session
// registry: a session that runs `scenarios.mjs init` for a record in the project and for one in
// another directory (absolute paths) is sent back by Stop for those incomplete records; a session
// that registers a complete record with `register` may finish; a session that runs `init` after
// `cd` away from its start directory is refused with the "no registry" message and creates nothing.
//
// Preparing the dedicated Codex home (once; ChatGPT login keeps subscription billing):
//   mkdir -m 700 ~/.cache/hobin-live-codex
//   touch ~/.cache/hobin-live-codex/.hobin-live-codex-home
//   printf 'cli_auth_credentials_store = "file"\n' > ~/.cache/hobin-live-codex/config.toml
//   CODEX_HOME=~/.cache/hobin-live-codex codex login      # add --device-auth without a browser
// That directory holds a credential as sensitive as a password: keep it out of any repository and
// do not share it. The marker file says the directory is dedicated to this check: the run clears
// everything in it but auth.json, so a home without the marker (another Codex profile) is refused.
// Following Codex's CI/CD auth guide, the run uses that home in place (Codex
// writes refreshed tokens back to its auth.json), never a copy, one run at a time (a lock file), and
// clears everything else in it first (plugins, caches, plugin data, hook state, sessions) so runs
// are independent. CODEX_API_KEY and OPENAI_API_KEY are removed from the child environment so a
// stray key never switches the run to API billing. A precondition that does not hold skips the run
// (exit 2, reported as skipped, never as passed) and prints the preparation commands.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { repositoryRoot } from "./check-agent-plugins.mjs";

export const CREDENTIALS_STORE_LINE = 'cli_auth_credentials_store = "file"';
const CREDENTIALS_STORE = /^\s*cli_auth_credentials_store\s*=\s*"file"\s*$/m;
export const LOCK = ".hobin-live.lock";
export const MARKER = ".hobin-live-codex-home";
const KEEP = new Set(["auth.json", "config.toml", LOCK, MARKER]);
const API_KEY_ENV = ["CODEX_API_KEY", "OPENAI_API_KEY"];

export const preparation = (dir = "~/.cache/hobin-live-codex") => [
	`mkdir -m 700 ${dir}`,
	`touch ${dir}/${MARKER}`,
	`printf '${CREDENTIALS_STORE_LINE}\\n' > ${dir}/config.toml`,
	`CODEX_HOME=${dir} codex login      # add --device-auth without a browser`,
].join("\n");

const real = (path) => { try { return realpathSync(path); } catch { return resolve(path); } };
const mode = (path) => statSync(path).mode & 0o777;

// The problems with `dir` as the dedicated Codex home, found without running Codex and without
// reading ~/.codex (only its resolved path is compared). Empty when the static checks hold.
export function codexHomeProblems(dir, home = homedir()) {
	if (!dir) return ["no dedicated Codex home given: pass --codex-home <dir> or set HOBIN_LIVE_CODEX_HOME"];
	if (real(dir) === real(join(home, ".codex"))) return [`${dir} is your everyday ~/.codex; use a separate home logged in only for this check`];
	if (!existsSync(dir) || !statSync(dir).isDirectory()) return [`${dir} does not exist`];
	// The run clears this directory, so it must be one prepared for this check, not another Codex profile.
	if (!existsSync(join(dir, MARKER))) return [`${dir} has no ${MARKER} marker: the run clears everything in it but auth.json, so it must be a home made only for this check (touch ${join(dir, MARKER)} after checking that)`];
	const problems = [];
	if (mode(dir) !== 0o700) problems.push(`${dir} must be mode 700 (it is ${mode(dir).toString(8)}): chmod 700 ${dir}`);
	const auth = join(dir, "auth.json");
	if (!existsSync(auth)) problems.push(`${auth} is missing: log in with CODEX_HOME=${dir} codex login`);
	else if (mode(auth) !== 0o600) problems.push(`${auth} must be mode 600 (it is ${mode(auth).toString(8)}): chmod 600 ${auth}`);
	const config = join(dir, "config.toml");
	if (!existsSync(config) || !CREDENTIALS_STORE.test(readFileSync(config, "utf8"))) problems.push(`${config} must contain ${CREDENTIALS_STORE_LINE}`);
	return problems;
}

// The login kind `codex login status` reports, never the credential itself.
export function loginKind(statusText) {
	const text = String(statusText);
	if (/^Logged in using ChatGPT\s*$/m.test(text)) return "ChatGPT";
	if (/^API key configured/m.test(text)) return "API key";
	const other = /^Logged in using (workload identity|access token|personal access token)\s*$/m.exec(text);
	if (other) return other[1];
	if (/^Not logged in/m.test(text)) return "not logged in";
	return "unknown";
}

// The child environment for Codex: the dedicated home, temporary HOME and TMPDIR, no API keys.
export function codexEnv(dir, temporary, base = process.env) {
	const env = { ...base, HOME: join(temporary, "home"), CODEX_HOME: dir, TMPDIR: join(temporary, "tmp") };
	for (const name of API_KEY_ENV) delete env[name];
	return env;
}

const digest = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");

// Clears the dedicated home for an independent run: everything but auth.json, the marker and the lock goes,
// and config.toml is reset to the credentials-store line. auth.json is left byte for byte as it was.
export function resetCodexHome(dir) {
	const auth = join(dir, "auth.json");
	const before = existsSync(auth) ? digest(auth) : null;
	for (const name of readdirSync(dir)) if (!KEEP.has(name)) rmSync(join(dir, name), { recursive: true, force: true });
	writeFileSync(join(dir, "config.toml"), `${CREDENTIALS_STORE_LINE}\n`);
	assert.equal(existsSync(auth) ? digest(auth) : null, before, "resetting the dedicated Codex home must not touch auth.json");
}

// One run per dedicated home: auth.json is a single refresh stream.
export function lockCodexHome(dir) {
	const path = join(dir, LOCK);
	try { writeFileSync(path, `${process.pid}\n`, { flag: "wx" }); } catch (error) {
		if (error.code === "EEXIST") throw new Error(`${path} exists: another check:live run uses this Codex home. If none is running, remove the file.`);
		throw error;
	}
	return () => rmSync(path, { force: true });
}

const jsonLines = (text) => text.split("\n").flatMap((line) => { try { return [JSON.parse(line)]; } catch { return []; } });

function main(argv) {
	const args = argv.filter((arg) => arg !== "--");
	const host = args[0];
	assert.ok(host === "claude" || host === "codex", "Usage: pnpm check:live -- claude | codex --codex-home <dir>");
	const flag = args.indexOf("--codex-home");
	const given = flag >= 0 ? args[flag + 1] : process.env.HOBIN_LIVE_CODEX_HOME;
	const codexHome = given?.startsWith("~/") ? join(homedir(), given.slice(2)) : given;

	const results = [];
	const check = (name, ok, detail) => { results.push({ name, ok }); console.log(`${ok ? "pass" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`); };
	const skip = (problems) => {
		console.log(`SKIPPED (not passed): the Codex live check cannot run.\n${problems.map((p) => `- ${p}`).join("\n")}\nPrepare a dedicated home once:\n${preparation()}\nthen: pnpm check:live -- codex --codex-home ~/.cache/hobin-live-codex`);
		return 2;
	};

	let release = () => {};
	if (host === "codex") {
		const problems = codexHomeProblems(codexHome);
		if (problems.length) return skip(problems);
		release = lockCodexHome(codexHome);
	}
	const temporary = realpathSync(mkdtempSync(join(tmpdir(), "hobin-live-")));
	try {
		const project = join(temporary, "proj");
		mkdirSync(project);
		spawnSync("git", ["init", "-q"], { cwd: project });
		const complete = join(project, "acceptance-scenarios.json");
		copyFileSync(join(repositoryRoot, "core/developing-features/scenarios/quiet-hours-preferences/golden/acceptance-scenarios.json"), complete);
		const fresh = join(project, "docs/acceptance-scenarios-live.json");

		const STOPPED = "a record of this session is not complete";
		const REFUSED = "No hobin-feature registry for this agent session";
		const away = join(temporary, "tmp", "away");
		mkdirSync(away, { recursive: true });
		const other = join(away, "other-repo/docs/acceptance-scenarios-other.json");
		const refusedRecord = join(away, "acceptance-scenarios-refused.json");
		const tail = "Then reply DONE. If you are then told a record is not complete, reply only BLOCKED SEEN and do not edit or create any file.";
		const initPrompt = (scripts) => `Run exactly these two shell commands, one after the other: node ${scripts}/scenarios.mjs init ${fresh}\nnode ${scripts}/scenarios.mjs init ${other}\n${tail}`;
		const registerPrompt = (scripts) => `Run exactly this shell command once: node ${scripts}/scenarios.mjs register ${complete}\n${tail}`;
		const awayPrompt = (scripts) => `Run exactly this shell command once, even if it fails: cd ${away} && node ${scripts}/scenarios.mjs init ${refusedRecord}\nThen reply DONE and do nothing else.`;

		if (host === "claude") {
			let method = "unknown";
			try { method = JSON.parse(spawnSync("claude", ["auth", "status", "--json"], { encoding: "utf8" }).stdout).authMethod ?? "unknown"; } catch {}
			console.log(`Claude auth: ${method}`);
			if (process.env.ANTHROPIC_API_KEY) console.log("warning: ANTHROPIC_API_KEY is set; this run may be billed to that API key");
			const plugin = join(repositoryRoot, "claude/plugins/hobin-feature");
			const scripts = join(plugin, "skills/developing-features/scripts");
			const claude = (prompt) => {
				const result = spawnSync("claude", ["-p", "--model", "haiku", "--plugin-dir", plugin,
					"--settings", JSON.stringify({ enabledPlugins: { "hobin-feature@hobin": false } }),
					// Claude Code refuses `cd` outside the session's working directories, so the other
					// directory is added the way a user would (--add-dir); the script must still refuse
					// there, because the registry lives where the session started.
					"--add-dir", away,
					"--allowedTools", `Bash(node ${scripts}/scenarios.mjs *)`, "Bash(cd *)",
					"--output-format", "stream-json", "--verbose", "--max-turns", "8", prompt],
				{ cwd: project, encoding: "utf8", input: "", timeout: 240_000, maxBuffer: 64 * 1024 * 1024 });
				return result.stdout ?? "";
			};
			const created = claude(initPrompt(scripts));
			check("claude: init creates both records (the project's and another directory's)", existsSync(fresh) && existsSync(other));
			check("claude: Stop sends the model back for both registered incomplete records", created.includes(STOPPED) && created.includes(fresh) && created.includes(other));
			const registered = claude(registerPrompt(scripts));
			check("claude: Stop lets the session with a registered complete record finish", registered.includes("DONE") && !registered.includes(STOPPED) && !registered.includes("BLOCKED SEEN"));
			const refused = claude(awayPrompt(scripts));
			check("claude: init after cd away from the start directory is refused and creates nothing", refused.includes(REFUSED) && !existsSync(refusedRecord));
		} else {
			const env = codexEnv(codexHome, temporary);
			mkdirSync(env.HOME, { recursive: true });
			mkdirSync(env.TMPDIR, { recursive: true });
			const run = (args) => spawnSync("codex", args, { cwd: project, env, encoding: "utf8", input: "", timeout: 300_000, maxBuffer: 64 * 1024 * 1024 });
			const status = run(["login", "status"]);
			const kind = loginKind(`${status.stdout ?? ""}\n${status.stderr ?? ""}`);
			console.log(`Codex auth: ${kind}`);
			if (kind !== "ChatGPT") return skip([`CODEX_HOME=${codexHome} codex login status reports ${kind}, not a ChatGPT login`]);
			resetCodexHome(codexHome);

			// Install the plugin the normal way, from a marketplace copy of this repository that lists
			// only hobin-feature.
			const market = join(temporary, "market");
			cpSync(join(repositoryRoot, ".agents"), join(market, ".agents"), { recursive: true });
			cpSync(join(repositoryRoot, "codex/plugins/hobin-feature"), join(market, "codex/plugins/hobin-feature"), { recursive: true });
			const catalog = join(market, ".agents/plugins/marketplace.json");
			const listing = JSON.parse(readFileSync(catalog, "utf8"));
			writeFileSync(catalog, JSON.stringify({ ...listing, plugins: listing.plugins.filter((p) => p.name === "hobin-feature") }));
			run(["plugin", "marketplace", "add", market, "--json"]);
			run(["plugin", "add", "hobin-feature@hobin", "--json"]);
			const installed = spawnSync("find", [codexHome, "-path", "*/skills/developing-features/scripts/scenarios.mjs"], { encoding: "utf8" }).stdout.trim().split("\n").filter(Boolean);
			check("codex: the plugin is installed in the dedicated home", installed.length > 0, installed.join(", "));
			const scripts = installed.length ? dirname(installed[0]) : join(market, "codex/plugins/hobin-feature/skills/developing-features/scripts");
			// Hook trust is bypassed for this one invocation only: the home is the isolated dedicated
			// one, reset before the run, and the hooks it runs are this repository's own plugin files.
			// A user trusts them with /hooks (again after each update). The other directory lies under
			// the run's TMPDIR, which the workspace-write sandbox lets commands write.
			const codex = (prompt) => {
				const result = run(["exec", "--json", "--dangerously-bypass-hook-trust", "--sandbox", "workspace-write", "-c", "approval_policy=never", prompt]);
				const items = jsonLines(result.stdout ?? "").filter((e) => e.type === "item.completed").map((e) => e.item);
				const messages = items.filter((i) => i.type === "agent_message").map((i) => i.text ?? "");
				const done = messages.findIndex((text) => text.includes("DONE"));
				return { text: result.stdout ?? "", done, blocked: done >= 0 && messages.slice(done + 1).some((text) => text.includes("BLOCKED SEEN")) };
			};
			const created = codex(initPrompt(scripts));
			check("codex: init creates both records (the project's and another directory's)", existsSync(fresh) && existsSync(other));
			check("codex: Stop sends the model back for the registered incomplete records", created.blocked);
			const registered = codex(registerPrompt(scripts));
			check("codex: Stop lets the session with a registered complete record finish", registered.done >= 0 && !registered.blocked);
			const refused = codex(awayPrompt(scripts));
			check("codex: init after cd away from the start directory is refused and creates nothing", refused.text.includes(REFUSED) && !existsSync(refusedRecord));
		}
	} finally {
		rmSync(temporary, { recursive: true, force: true });
		release();
	}
	const failed = results.filter((r) => !r.ok);
	console.log(`${results.length - failed.length}/${results.length} live checks passed on ${host}`);
	return failed.length ? 1 : 0;
}

if (process.argv[1] && pathToFileURL(realpathSync(process.argv[1])).href === import.meta.url) process.exit(main(process.argv.slice(2)));
