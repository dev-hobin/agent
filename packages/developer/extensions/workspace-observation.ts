import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
	existsSync,
	lstatSync,
	readFileSync,
	readlinkSync,
	realpathSync,
} from "node:fs";
import { join, relative, resolve } from "node:path";

const GIT_TIMEOUT_MS = 5_000;
const GIT_MAX_BUFFER = 16 * 1024 * 1024;

export interface GitWorkspaceSnapshot {
	readonly kind: "git";
	readonly root: string;
	readonly cwd: string;
	readonly headSha: string;
	readonly dirtyPaths: readonly string[];
	readonly identities: Readonly<Record<string, string>>;
	readonly snapshotSha256: string;
}

export interface UnavailableWorkspaceSnapshot {
	readonly kind: "unavailable";
	readonly reason: string;
}

export type WorkspaceSnapshot =
	| GitWorkspaceSnapshot
	| UnavailableWorkspaceSnapshot;

export interface WorkspaceDelta {
	readonly kind: "observed" | "unavailable";
	readonly changedPaths: readonly string[];
	readonly reason: string | null;
}

function git(input: {
	readonly cwd: string;
	readonly args: readonly string[];
}): Buffer {
	return execFileSync("git", ["-C", input.cwd, ...input.args], {
		encoding: "buffer",
		stdio: ["ignore", "pipe", "pipe"],
		timeout: GIT_TIMEOUT_MS,
		maxBuffer: GIT_MAX_BUFFER,
	});
}

function nulPaths(value: Buffer): string[] {
	return value
		.toString("utf8")
		.split("\0")
		.filter((path) => path.length > 0);
}

function compareText(...input: readonly [left: string, right: string]): number {
	const [left, right] = input;
	if (left < right) return -1;
	if (left > right) return 1;
	return 0;
}

function fileIdentity(path: string): string {
	if (!existsSync(path)) return "absent";
	const stat = lstatSync(path);
	if (stat.isSymbolicLink()) {
		return `symlink:${createHash("sha256").update(readlinkSync(path)).digest("hex")}`;
	}
	if (stat.isFile()) {
		return `file:${createHash("sha256").update(readFileSync(path)).digest("hex")}`;
	}
	if (stat.isDirectory()) return "directory";
	return `other:${stat.mode}:${stat.size}`;
}

function snapshotIdentity(input: {
	readonly root: string;
	readonly cwd: string;
	readonly headSha: string;
	readonly paths: readonly string[];
	readonly identities: Readonly<Record<string, string>>;
}): string {
	const hash = createHash("sha256");
	hash.update(input.root);
	hash.update("\0");
	hash.update(input.cwd);
	hash.update("\0");
	hash.update(input.headSha);
	for (const path of input.paths) {
		hash.update("\0");
		hash.update(path);
		hash.update("\0");
		hash.update(input.identities[path] ?? "absent");
	}
	return hash.digest("hex");
}

export function captureWorkspaceSnapshot(cwdInput: string): WorkspaceSnapshot {
	const cwd = realpathSync(resolve(cwdInput));
	try {
		const root = git({
			cwd,
			args: ["rev-parse", "--show-toplevel"],
		})
			.toString("utf8")
			.trim();
		if (!root) {
			return Object.freeze({
				kind: "unavailable",
				reason: "Git workspace root is unavailable.",
			});
		}
		const headSha = git({ cwd, args: ["rev-parse", "HEAD"] })
			.toString("utf8")
			.trim();
		const tracked = nulPaths(
			git({
				cwd,
				args: [
					"-c",
					"diff.renames=false",
					"diff",
					"--name-only",
					"-z",
					"HEAD",
					"--",
				],
			}),
		);
		const untracked = nulPaths(
			git({
				cwd,
				args: ["ls-files", "--others", "--exclude-standard", "-z"],
			}),
		);
		const repoPaths = [...new Set([...tracked, ...untracked])].sort(
			compareText,
		);
		const dirtyPaths = repoPaths.map((path) => {
			const fromCwd = relative(cwd, join(root, path));
			return fromCwd.length === 0 ? "." : fromCwd;
		});
		const identities: Record<string, string> = {};
		for (let index = 0; index < repoPaths.length; index += 1) {
			const repoPath = repoPaths[index];
			const displayPath = dirtyPaths[index];
			if (repoPath === undefined || displayPath === undefined) continue;
			identities[displayPath] = fileIdentity(join(root, repoPath));
		}
		return Object.freeze({
			kind: "git",
			root,
			cwd,
			headSha,
			dirtyPaths: Object.freeze(dirtyPaths),
			identities: Object.freeze(identities),
			snapshotSha256: snapshotIdentity({
				root,
				cwd,
				headSha,
				paths: dirtyPaths,
				identities,
			}),
		});
	} catch (error: unknown) {
		return Object.freeze({
			kind: "unavailable",
			reason: `Workspace observation unavailable: ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`,
		});
	}
}

export function compareWorkspaceSnapshots(input: {
	readonly baseline: WorkspaceSnapshot;
	readonly current: WorkspaceSnapshot;
}): WorkspaceDelta {
	const { baseline, current } = input;
	if (baseline.kind !== "git" || current.kind !== "git") {
		let reason = "Workspace observation unavailable.";
		if (baseline.kind === "unavailable") reason = baseline.reason;
		else if (current.kind === "unavailable") reason = current.reason;
		return Object.freeze({
			kind: "unavailable",
			changedPaths: Object.freeze([]),
			reason,
		});
	}
	if (baseline.root !== current.root || baseline.cwd !== current.cwd) {
		return Object.freeze({
			kind: "unavailable",
			changedPaths: Object.freeze([]),
			reason: "Workspace identity changed during the Developer scope.",
		});
	}
	if (baseline.headSha !== current.headSha) {
		return Object.freeze({
			kind: "unavailable",
			changedPaths: Object.freeze([]),
			reason: "Git HEAD changed during the Developer scope.",
		});
	}
	const paths = new Set([...baseline.dirtyPaths, ...current.dirtyPaths]);
	const changedPaths = [...paths]
		.filter((path) => baseline.identities[path] !== current.identities[path])
		.sort(compareText);
	return Object.freeze({
		kind: "observed",
		changedPaths: Object.freeze(changedPaths),
		reason: null,
	});
}
