// The live check's Codex preconditions, home reset and lock, without calling Codex or a model.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { repositoryRoot } from "../scripts/check-agent-plugins.mjs";
import { CREDENTIALS_STORE_LINE, LOCK, MARKER, codexEnv, codexHomeProblems, lockCodexHome, loginKind, resetCodexHome } from "../scripts/check-live.mjs";

const scratch = () => realpathSync(mkdtempSync(join(tmpdir(), "live-check-")));
// A prepared dedicated home with a fake credential (never a real one).
function preparedHome(t) {
	const dir = join(scratch(), "codex-home");
	mkdirSync(dir, { mode: 0o700 });
	chmodSync(dir, 0o700);
	writeFileSync(join(dir, "auth.json"), '{"auth_mode":"chatgpt","tokens":{"access_token":"fake"}}\n', { mode: 0o600 });
	chmodSync(join(dir, "auth.json"), 0o600);
	writeFileSync(join(dir, "config.toml"), `${CREDENTIALS_STORE_LINE}\n`);
	writeFileSync(join(dir, MARKER), "");
	t.after(() => rmSync(join(dir, ".."), { recursive: true, force: true }));
	return dir;
}

test("live codex: a prepared dedicated home passes the static checks", (t) => {
	assert.deepEqual(codexHomeProblems(preparedHome(t)), []);
});

test("live codex: no home, ~/.codex (directly or through a link), a missing directory, loose modes and a missing store line fail closed", (t) => {
	assert.match(codexHomeProblems(undefined)[0], /no dedicated Codex home given/);
	const fakeHome = scratch();
	t.after(() => rmSync(fakeHome, { recursive: true, force: true }));
	mkdirSync(join(fakeHome, ".codex"));
	assert.match(codexHomeProblems(join(fakeHome, ".codex"), fakeHome)[0], /is your everyday ~\/\.codex/);
	symlinkSync(join(fakeHome, ".codex"), join(fakeHome, "alias"));
	assert.match(codexHomeProblems(join(fakeHome, "alias"), fakeHome)[0], /is your everyday ~\/\.codex/);
	assert.match(codexHomeProblems(join(fakeHome, "missing"), fakeHome)[0], /does not exist/);

	// Another Codex profile that meets every other condition is refused without the marker, and
	// nothing in it is touched.
	const other = preparedHome(t);
	rmSync(join(other, MARKER));
	mkdirSync(join(other, "sessions"));
	writeFileSync(join(other, "sessions/history.jsonl"), "keep\n");
	assert.match(codexHomeProblems(other)[0], /has no \.hobin-live-codex-home marker/);
	assert.equal(readFileSync(join(other, "sessions/history.jsonl"), "utf8"), "keep\n");

	const dir = preparedHome(t);
	chmodSync(dir, 0o755);
	chmodSync(join(dir, "auth.json"), 0o644);
	writeFileSync(join(dir, "config.toml"), '# cli_auth_credentials_store = "file"\nmodel = "x"\n');
	const problems = codexHomeProblems(dir).join("\n");
	assert.match(problems, /must be mode 700 \(it is 755\)/);
	assert.match(problems, /auth\.json must be mode 600 \(it is 644\)/);
	assert.match(problems, /config\.toml must contain cli_auth_credentials_store = "file"/);
	rmSync(join(dir, "auth.json"));
	assert.match(codexHomeProblems(dir).join("\n"), /auth\.json is missing/);
});

test("live codex: the reset clears everything but auth.json and the lock, rewrites config.toml, and leaves auth.json byte for byte", (t) => {
	const dir = preparedHome(t);
	const auth = readFileSync(join(dir, "auth.json"));
	writeFileSync(join(dir, "config.toml"), `${CREDENTIALS_STORE_LINE}\n[marketplaces.hobin]\nsource = "/x"\n[plugins."hobin-feature@hobin"]\nenabled = true\n`);
	for (const path of ["plugins/cache/hobin/hobin-feature/0.6.0/x", "plugins/data/hobin-feature-hobin/ledger", "sessions/2026/x.jsonl", "hooks.state/x", "log/codex.log"]) {
		mkdirSync(join(dir, path, ".."), { recursive: true });
		writeFileSync(join(dir, path), "x");
	}
	writeFileSync(join(dir, LOCK), "1\n");
	resetCodexHome(dir);
	assert.deepEqual(spawnSync("ls", ["-A", dir], { encoding: "utf8" }).stdout.trim().split("\n").sort(), [LOCK, MARKER, "auth.json", "config.toml"].sort());
	assert.equal(readFileSync(join(dir, "config.toml"), "utf8"), `${CREDENTIALS_STORE_LINE}\n`);
	assert.deepEqual(readFileSync(join(dir, "auth.json")), auth);
});

test("live codex: one run per home; a second lock fails with a message, and release frees it", (t) => {
	const dir = preparedHome(t);
	const release = lockCodexHome(dir);
	assert.throws(() => lockCodexHome(dir), /another check:live run uses this Codex home/);
	release();
	assert.equal(existsSync(join(dir, LOCK)), false);
	lockCodexHome(dir)();
});

test("live codex: the login kind is named, never echoed, and API keys are removed from Codex's environment", () => {
	assert.equal(loginKind("Logged in using ChatGPT\n"), "ChatGPT");
	assert.equal(loginKind("API key configured - sk-proj-***abcd\nnotice\n"), "API key");
	assert.equal(loginKind("Not logged in\n"), "not logged in");
	assert.equal(loginKind("Logged in using access token\n"), "access token");
	assert.equal(loginKind("something else"), "unknown");
	const env = codexEnv("/dedicated", "/tmp/run", { PATH: "/bin", CODEX_API_KEY: "a", OPENAI_API_KEY: "b", CODEX_HOME: "/elsewhere" });
	assert.deepEqual(env, { PATH: "/bin", HOME: "/tmp/run/home", CODEX_HOME: "/dedicated", TMPDIR: "/tmp/run/tmp" });
});

test("live codex: without a usable home the command skips (exit 2, not a pass) and prints the preparation", () => {
	const script = join(repositoryRoot, "scripts/check-live.mjs");
	const env = { ...process.env };
	delete env.HOBIN_LIVE_CODEX_HOME;
	for (const args of [["codex"], ["codex", "--codex-home", join(homedir(), ".codex")]]) {
		const result = spawnSync("node", [script, ...args], { encoding: "utf8", env });
		assert.equal(result.status, 2, `${args.join(" ")}: ${result.stderr}`);
		assert.match(result.stdout, /SKIPPED \(not passed\)/);
		assert.match(result.stdout, /mkdir -m 700 ~\/\.cache\/hobin-live-codex/);
		assert.match(result.stdout, /touch ~\/\.cache\/hobin-live-codex\/\.hobin-live-codex-home/);
		assert.match(result.stdout, /CODEX_HOME=~\/\.cache\/hobin-live-codex codex login/);
		assert.doesNotMatch(result.stdout, /live checks passed/);
	}
});
