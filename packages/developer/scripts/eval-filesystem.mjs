import { createHash } from "node:crypto";
import { lstat, readFile, readdir, readlink } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";

const ignoredDirectoryNames = new Set([
  ".git",
  ".cache",
  ".next",
  "coverage",
  "dist",
  "node_modules",
]);

function isIgnored(relativePath) {
  const parts = relativePath.split(sep);
  return parts.some((part) => ignoredDirectoryNames.has(part)) || relativePath.endsWith(".log");
}

async function digest(path) {
  const stat = await lstat(path);
  if (stat.isSymbolicLink()) return `link:${await readlink(path)}`;
  if (!stat.isFile()) return undefined;
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

export async function snapshotWorkspace(root) {
  const absoluteRoot = resolve(root);
  const snapshot = new Map();

  async function visit(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const path = resolve(directory, entry.name);
      const relativePath = relative(absoluteRoot, path);
      if (isIgnored(relativePath)) continue;
      if (entry.isDirectory()) {
        await visit(path);
        continue;
      }
      const hash = await digest(path);
      if (hash) snapshot.set(relativePath, hash);
    }
  }

  await visit(absoluteRoot);
  return snapshot;
}

export function diffWorkspaceSnapshots(before, after) {
  const changed = [];
  for (const [path, hash] of before) {
    if (!after.has(path)) changed.push({ path, kind: "deleted" });
    else if (after.get(path) !== hash) changed.push({ path, kind: "modified" });
  }
  for (const path of after.keys()) {
    if (!before.has(path)) changed.push({ path, kind: "created" });
  }
  return changed.sort((left, right) => left.path.localeCompare(right.path));
}
