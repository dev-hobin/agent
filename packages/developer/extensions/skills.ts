import { createHash } from "node:crypto";
import { realpathSync, type Dirent } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";

import {
	DEFAULT_MAX_BYTES,
	DEFAULT_MAX_LINES,
	stripFrontmatter,
	type Skill,
} from "@earendil-works/pi-coding-agent";

const METHOD_OUTPUT_OVERHEAD_BYTES = 4096;
const METHOD_OUTPUT_OVERHEAD_LINES = 20;
const REFERENCE_PATH_PATTERN = /^references\/[^/]+\.md$/u;

export interface LoadedSkillReference {
	path: string;
	filePath: string;
	content: string;
	contentSha256: string;
	sourceTrace: string;
}

export interface SkillReferenceRoute {
	id: string;
	question: string;
	trigger: string;
	methodStep: string;
	references: string[];
	readOrder: "any" | "listed";
	artifacts: string[];
	stop: string;
	separateWhen: string;
}

export interface SkillReferenceExemption {
	when: string;
	evidence: string[];
}

export interface SkillReferencePolicy {
	routes: SkillReferenceRoute[];
	exemption?: SkillReferenceExemption;
	contentSha256?: string;
}

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
	return (
		relation === "" || (!relation.startsWith("..") && !isAbsolute(relation))
	);
}

export function availablePackageSkills(
	loadedSkills: Skill[],
	skillsRoot: string,
): Map<string, Skill> {
	const available = new Map<string, Skill>();

	for (const skill of loadedSkills) {
		if (skill.disableModelInvocation) continue;
		if (!isWithinRoot(skillsRoot, skill.filePath)) continue;
		if (available.has(skill.name))
			throw new Error(
				`Duplicate Pi-loaded Developer skill name: ${skill.name}`,
			);
		available.set(skill.name, skill);
	}

	return available;
}

export async function skillReferencePaths(skill: Skill): Promise<string[]> {
	const referencesRoot = resolve(skill.baseDir, "references");
	let entries: Dirent[];
	try {
		entries = await readdir(referencesRoot, { withFileTypes: true });
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
		throw error;
	}

	const paths: string[] = [];
	for (const entry of entries) {
		if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
		if (!isWithinRoot(referencesRoot, resolve(referencesRoot, entry.name)))
			continue;
		paths.push(`references/${entry.name}`);
	}
	return paths.sort((left, right) => left.localeCompare(right));
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseNonEmptyStrings(value: unknown, label: string): string[] {
	if (
		!Array.isArray(value) ||
		value.length === 0 ||
		!value.every((item) => typeof item === "string" && item.trim().length > 0)
	) {
		throw new Error(`${label} must be a non-empty string array.`);
	}
	const strings = value.map((item) => item.trim());
	if (new Set(strings).size !== strings.length) {
		throw new Error(`${label} must not contain duplicates.`);
	}
	return strings;
}

function parseReferenceRoutes(
	skill: Skill,
	value: unknown,
	catalog: string[],
): SkillReferenceRoute[] {
	if (!Array.isArray(value) || value.length === 0) {
		throw new Error(
			`Reference policy for ${skill.name} must contain at least one route.`,
		);
	}
	const routes: SkillReferenceRoute[] = value.map((candidate, index) => {
		if (
			!isRecord(candidate) ||
			typeof candidate.id !== "string" ||
			!/^[a-z][a-z0-9-]*$/u.test(candidate.id) ||
			typeof candidate.question !== "string" ||
			candidate.question.trim().length === 0 ||
			typeof candidate.trigger !== "string" ||
			candidate.trigger.trim().length === 0 ||
			typeof candidate.method_step !== "string" ||
			candidate.method_step.trim().length === 0 ||
			typeof candidate.stop !== "string" ||
			candidate.stop.trim().length === 0 ||
			typeof candidate.separate_when !== "string" ||
			candidate.separate_when.trim().length === 0 ||
			(candidate.read_order !== undefined &&
				candidate.read_order !== "any" &&
				candidate.read_order !== "listed")
		) {
			throw new Error(
				`Reference policy for ${skill.name} has an invalid route at index ${index}.`,
			);
		}
		const references = parseNonEmptyStrings(
			candidate.references,
			`Reference route ${candidate.id} references`,
		);
		if (
			references.some(
				(path) => !REFERENCE_PATH_PATTERN.test(path) || !catalog.includes(path),
			)
		) {
			throw new Error(
				`Reference route ${candidate.id} for ${skill.name} names an unavailable reference.`,
			);
		}
		return {
			id: candidate.id,
			question: candidate.question.trim(),
			trigger: candidate.trigger.trim(),
			methodStep: candidate.method_step.trim(),
			references,
			readOrder: candidate.read_order === "listed" ? "listed" : "any",
			artifacts: parseNonEmptyStrings(
				candidate.artifacts,
				`Reference route ${candidate.id} artifacts`,
			),
			stop: candidate.stop.trim(),
			separateWhen: candidate.separate_when.trim(),
		};
	});
	if (new Set(routes.map((route) => route.id)).size !== routes.length) {
		throw new Error(
			`Reference policy for ${skill.name} must use unique route IDs.`,
		);
	}
	const covered = new Set(routes.flatMap((route) => route.references));
	const unmapped = catalog.filter((path) => !covered.has(path));
	if (unmapped.length > 0) {
		throw new Error(
			`Reference policy for ${skill.name} leaves references unrouted: ${unmapped.join(", ")}.`,
		);
	}
	return routes;
}

function parseReferencePolicy(
	skill: Skill,
	source: string,
	catalog: string[],
): Omit<SkillReferencePolicy, "contentSha256"> {
	let parsed: unknown;
	try {
		parsed = JSON.parse(source);
	} catch (error) {
		throw new Error(`Invalid reference policy JSON for ${skill.name}.`, {
			cause: error,
		});
	}
	if (
		!isRecord(parsed) ||
		parsed.version !== 2 ||
		!isRecord(parsed.exemption) ||
		typeof parsed.exemption.when !== "string" ||
		parsed.exemption.when.trim().length === 0
	) {
		throw new Error(
			`Reference policy for ${skill.name} must declare version 2, judgment-integrated routes, and exemption criteria.`,
		);
	}
	return {
		routes: parseReferenceRoutes(skill, parsed.routes, catalog),
		exemption: {
			when: parsed.exemption.when.trim(),
			evidence: parseNonEmptyStrings(
				parsed.exemption.evidence,
				`Reference policy ${skill.name} exemption evidence`,
			),
		},
	};
}

export async function loadSkillReferencePolicy(
	skill: Skill,
	availableReferences?: string[],
): Promise<SkillReferencePolicy> {
	let catalog = availableReferences;
	if (!catalog) catalog = await skillReferencePaths(skill);
	const policyPath = resolve(skill.baseDir, "reference-policy.json");
	let source: string;
	try {
		source = await readFile(policyPath, "utf8");
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			if (catalog.length > 0) {
				throw new Error(
					`Developer skill ${skill.name} has references but no reference-policy.json.`,
				);
			}
			return { routes: [] };
		}
		throw error;
	}

	return {
		...parseReferencePolicy(skill, source, catalog),
		contentSha256: createHash("sha256")
			.update(source.trim(), "utf8")
			.digest("hex"),
	};
}

function extractSourceTrace(content: string): string {
	const lines = content.split(/\r?\n/);
	const start = lines.findIndex((line) => line.trim() === "## Source Trace");
	if (start === -1) return "";
	const end = lines.findIndex(
		(line, index) => index > start && /^##\s+/u.test(line),
	);
	return lines
		.slice(start + 1, end === -1 ? undefined : end)
		.join("\n")
		.trim();
}

export async function loadSkillReference(
	skill: Skill,
	requestedPath: string,
): Promise<LoadedSkillReference> {
	const path = requestedPath.replaceAll("\\", "/").replace(/^\.\/+/, "");
	if (!REFERENCE_PATH_PATTERN.test(path)) {
		throw new Error(
			`Developer references must use a direct skill-relative path such as references/example.md: ${requestedPath}`,
		);
	}

	const available = await skillReferencePaths(skill);
	if (!available.includes(path)) {
		throw new Error(
			`Reference ${path} is unavailable for ${skill.name}. Available references: ${available.join(", ") || "none"}.`,
		);
	}

	const filePath = resolve(skill.baseDir, path);
	if (!isWithinRoot(resolve(skill.baseDir, "references"), filePath)) {
		throw new Error(
			`Reference path escapes the ${skill.name} references directory.`,
		);
	}
	const source = await readFile(filePath, "utf8");
	const content = source.trim();
	const contentBytes = Buffer.byteLength(content, "utf8");
	const contentLines = content.split(/\r?\n/).length;
	if (
		contentBytes > DEFAULT_MAX_BYTES - METHOD_OUTPUT_OVERHEAD_BYTES ||
		contentLines > DEFAULT_MAX_LINES - METHOD_OUTPUT_OVERHEAD_LINES
	) {
		throw new Error(
			`Developer reference ${path} is too large for safe forced loading. Split it into focused direct references.`,
		);
	}

	return {
		path,
		filePath,
		content,
		contentSha256: createHash("sha256").update(content, "utf8").digest("hex"),
		sourceTrace: extractSourceTrace(content),
	};
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
