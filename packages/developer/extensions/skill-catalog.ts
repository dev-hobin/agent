import { realpathSync, type Dirent } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";

import {
	DEFAULT_MAX_BYTES,
	DEFAULT_MAX_LINES,
	stripFrontmatter,
	type Skill,
} from "@earendil-works/pi-coding-agent";
import {
	decodePolicyOwnerData,
	jsonValueFromUnknown,
	parsePolicyOwner,
	type CompiledJudgmentPolicy,
} from "@hobin/judgment";
import { loadOptionalJudgmentPolicyFile } from "@hobin/judgment/node";

const METHOD_OUTPUT_OVERHEAD_BYTES = 4_096;
const METHOD_OUTPUT_OVERHEAD_LINES = 20;
const REFERENCE_PATH_PATTERN = /^references\/[^/]+\.md$/u;

function escapeAttribute(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll('"', "&quot;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;");
}

export function isWithinSkillRoot(root: string, path: string): boolean {
	const canonical = (value: string) => {
		try {
			return realpathSync.native(value);
		} catch {
			return resolve(value);
		}
	};
	const relation = relative(canonical(root), canonical(path));
	return (
		relation === "" || (!relation.startsWith("..") && !isAbsolute(relation))
	);
}

export function availableDeveloperSkills(
	loadedSkills: Skill[],
	skillsRoot: string,
): Map<string, Skill> {
	const available = new Map<string, Skill>();
	for (const skill of loadedSkills) {
		if (skill.disableModelInvocation) continue;
		if (!isWithinSkillRoot(skillsRoot, skill.filePath)) continue;
		if (available.has(skill.name)) {
			throw new Error(
				`Duplicate Pi-loaded Developer skill name: ${skill.name}`,
			);
		}
		available.set(skill.name, skill);
	}
	return available;
}

function hasErrorCode(error: unknown, code: string): boolean {
	return (
		typeof error === "object" &&
		error !== null &&
		"code" in error &&
		error.code === code
	);
}

export async function skillReferencePaths(skill: Skill): Promise<string[]> {
	const referencesRoot = resolve(skill.baseDir, "references");
	let entries: Dirent[];
	try {
		entries = await readdir(referencesRoot, { withFileTypes: true });
	} catch (error) {
		if (hasErrorCode(error, "ENOENT")) return [];
		throw error;
	}
	const paths: string[] = [];
	for (const entry of entries) {
		if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
		const path = resolve(referencesRoot, entry.name);
		if (!isWithinSkillRoot(referencesRoot, path)) continue;
		paths.push(`references/${entry.name}`);
	}
	return paths.sort((left, right) => left.localeCompare(right));
}

export async function loadOptionalSkillPolicy(
	skill: Skill,
): Promise<CompiledJudgmentPolicy | undefined> {
	const owner = parsePolicyOwner(
		decodePolicyOwnerData(
			jsonValueFromUnknown({
				kind: "pi-skill",
				namespace: "@hobin/developer",
				name: skill.name,
				provenance: {
					source: skill.sourceInfo.source,
					scope: skill.sourceInfo.scope,
					origin: skill.sourceInfo.origin,
					path: skill.filePath,
				},
			}),
		),
	);
	const loaded = await loadOptionalJudgmentPolicyFile({
		path: resolve(skill.baseDir, "judgment.json"),
		owner,
		allowedRoot: skill.baseDir,
	});
	if (loaded.kind === "invalid") {
		throw new Error(
			`Invalid judgment.json for Developer skill ${skill.name}: ${loaded.diagnostic}`,
		);
	}
	const catalog = await skillReferencePaths(skill);
	if (loaded.kind === "absent") {
		if (catalog.length > 0) {
			throw new Error(
				`Developer skill ${skill.name} has packaged references but no judgment.json.`,
			);
		}
		return undefined;
	}
	const declared = new Set<string>();
	for (const reference of loaded.value.policy.references) {
		if (
			!REFERENCE_PATH_PATTERN.test(reference.path) ||
			!catalog.includes(reference.path)
		) {
			throw new Error(
				`Judgment policy for ${skill.name} names unavailable reference ${reference.path}.`,
			);
		}
		declared.add(reference.path);
	}
	const ungoverned = catalog.filter((path) => !declared.has(path));
	if (ungoverned.length > 0) {
		throw new Error(
			`Judgment policy for ${skill.name} leaves references ungoverned: ${ungoverned.join(", ")}.`,
		);
	}
	return loaded.value.policy;
}

export async function renderDeveloperMethod(skill: Skill): Promise<string> {
	const source = await readFile(skill.filePath, "utf8");
	const body = stripFrontmatter(source).trim();
	const bodyBytes = Buffer.byteLength(body, "utf8");
	const bodyLines = body.split(/\r?\n/u).length;
	if (
		bodyBytes > DEFAULT_MAX_BYTES - METHOD_OUTPUT_OVERHEAD_BYTES ||
		bodyLines > DEFAULT_MAX_LINES - METHOD_OUTPUT_OVERHEAD_LINES
	) {
		throw new Error(
			`Developer skill ${skill.name} is too large for safe loading. Move conditional detail into references before opening it.`,
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
		`Nominate only acquired current-branch context. Prepared references exist only when this method includes generated Context Directions.`,
	].join("\n");
}
