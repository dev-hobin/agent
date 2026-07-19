import { realpathSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";

import {
  DEFAULT_MAX_BYTES,
  DEFAULT_MAX_LINES,
  stripFrontmatter,
  type Skill,
} from "@earendil-works/pi-coding-agent";

const METHOD_OUTPUT_OVERHEAD_BYTES = 4096;
const METHOD_OUTPUT_OVERHEAD_LINES = 20;

function escapeAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function isWithinRoot(root: string, path: string): boolean {
  const canonical = (value: string) => {
    try {
      return realpathSync.native(value);
    } catch {
      return resolve(value);
    }
  };
  const relation = relative(canonical(root), canonical(path));
  return relation === "" || (!relation.startsWith("..") && !isAbsolute(relation));
}

export function availablePackageSkills(
  loadedSkills: Skill[],
  skillsRoot: string,
): Map<string, Skill> {
  const available = new Map<string, Skill>();

  for (const skill of loadedSkills) {
    if (skill.disableModelInvocation) continue;
    if (!isWithinRoot(skillsRoot, skill.filePath)) continue;
    if (available.has(skill.name)) throw new Error(`Duplicate Pi-loaded Developer skill name: ${skill.name}`);
    available.set(skill.name, skill);
  }

  return available;
}

export async function renderSkillMethod(skill: Skill): Promise<string> {
  const source = await readFile(skill.filePath, "utf8");
  const body = stripFrontmatter(source).trim();
  const bodyBytes = Buffer.byteLength(body, "utf8");
  const bodyLines = body.split(/\r?\n/).length;
  if (
    bodyBytes > DEFAULT_MAX_BYTES - METHOD_OUTPUT_OVERHEAD_BYTES ||
    bodyLines > DEFAULT_MAX_LINES - METHOD_OUTPUT_OVERHEAD_LINES
  ) {
    throw new Error(
      `Developer skill ${skill.name} is too large for safe forced loading. Move detail into relative references before routing it.`,
    );
  }
  const name = escapeAttribute(skill.name);
  const location = escapeAttribute(skill.filePath);
  const baseDir = escapeAttribute(skill.baseDir);
  return [
    `<developer-method name="${name}" location="${location}" base-dir="${baseDir}">`,
    body,
    "</developer-method>",
    "",
    `Resolve relative references from ${skill.baseDir}.`,
  ].join("\n");
}
