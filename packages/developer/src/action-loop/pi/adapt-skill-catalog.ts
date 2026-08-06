import { realpath, stat } from "node:fs/promises";
import {
	basename,
	dirname,
	isAbsolute,
	relative,
	resolve,
	sep,
} from "node:path";
import { pathToFileURL } from "node:url";
import type { Skill } from "@earendil-works/pi-coding-agent";
import type {
	CapabilitySource,
	CapabilitySourceKind,
} from "../routing/bind-capability.ts";

const SOURCE_SCOPES: ReadonlySet<string> = new Set([
	"user",
	"project",
	"temporary",
]);
const SOURCE_ORIGINS: ReadonlySet<string> = new Set(["package", "top-level"]);

export interface AdaptedPiSkillDescriptor {
	readonly label: string;
	readonly description: string;
	readonly skillFilePath: string;
	readonly skillRootPath: string;
	readonly skillMaterialPath: string;
	readonly supportsStructuredToc: boolean;
	readonly source: CapabilitySource;
}

export interface PiSkillCatalogExclusion {
	readonly label: string;
	readonly skillFilePath: string;
	readonly reason: "model-invocation-disabled";
}

export type PiSkillCatalogErrorCode =
	| "invalid-skill"
	| "invalid-source-provenance"
	| "invalid-skill-path"
	| "invalid-source-root"
	| "source-path-mismatch"
	| "skill-root-mismatch"
	| "source-root-escape"
	| "skill-material-not-regular"
	| "duplicate-occurrence";

export interface PiSkillCatalogError {
	readonly code: PiSkillCatalogErrorCode;
	readonly index: number;
	readonly path: string;
	readonly message: string;
}

export type PiSkillCatalogAdaptationResult =
	| {
			readonly ok: true;
			readonly inventory: readonly AdaptedPiSkillDescriptor[];
			readonly excluded: readonly PiSkillCatalogExclusion[];
	  }
	| { readonly ok: false; readonly error: PiSkillCatalogError };

type AdapterFailure = {
	readonly ok: false;
	readonly error: PiSkillCatalogError;
};

type DescriptorResult =
	| { readonly ok: true; readonly value: AdaptedPiSkillDescriptor }
	| AdapterFailure;

function failure(
	code: PiSkillCatalogErrorCode,
	index: number,
	path: string,
	message: string,
): PiSkillCatalogAdaptationResult {
	return Object.freeze({
		ok: false,
		error: Object.freeze({ code, index, path, message }),
	});
}

function descriptorFailure(
	code: PiSkillCatalogErrorCode,
	index: number,
	path: string,
	message: string,
): AdapterFailure {
	return {
		ok: false,
		error: { code, index, path, message },
	};
}

function nodeErrorCode(error: unknown): string | undefined {
	if (typeof error !== "object" || error === null || !("code" in error)) {
		return undefined;
	}
	return typeof error.code === "string" ? error.code : undefined;
}

function canonicalText(value: unknown): string | undefined {
	if (typeof value !== "string") return undefined;
	const normalized = value.trim();
	return normalized.length > 0 && !normalized.includes("\0")
		? normalized
		: undefined;
}

function isContained(root: string, candidate: string): boolean {
	const remainder = relative(root, candidate);
	return (
		remainder === "" || (!remainder.startsWith("..") && !isAbsolute(remainder))
	);
}

function toPosixPath(path: string): string {
	return path.split(sep).join("/");
}

function sourceKind(skill: Skill): CapabilitySourceKind | undefined {
	const { origin, scope } = skill.sourceInfo;
	if (!SOURCE_ORIGINS.has(origin) || !SOURCE_SCOPES.has(scope)) {
		return undefined;
	}
	if (origin === "package") return "package";
	if (scope === "user") return "global";
	if (scope === "project") return "project";
	return "cli";
}

async function canonicalFile(
	path: string,
	index: number,
	field: string,
): Promise<
	| { readonly ok: true; readonly value: string }
	| { readonly ok: false; readonly error: PiSkillCatalogError }
> {
	if (!isAbsolute(path)) {
		return {
			ok: false,
			error: {
				code: "invalid-skill-path",
				index,
				path: `skills[${index}].${field}`,
				message: "Pi Skill file paths must be absolute",
			},
		};
	}
	try {
		const physical = await realpath(resolve(path));
		const fileStat = await stat(physical);
		if (!fileStat.isFile()) {
			return {
				ok: false,
				error: {
					code: "skill-material-not-regular",
					index,
					path: `skills[${index}].${field}`,
					message: "Pi Skill material must resolve to a regular file",
				},
			};
		}
		return { ok: true, value: physical };
	} catch (error) {
		return {
			ok: false,
			error: {
				code: "invalid-skill-path",
				index,
				path: `skills[${index}].${field}`,
				message: `Pi Skill material cannot be resolved (${nodeErrorCode(error) ?? "unknown"})`,
			},
		};
	}
}

async function canonicalDirectory(
	path: string,
	index: number,
	field: string,
): Promise<
	| { readonly ok: true; readonly value: string }
	| { readonly ok: false; readonly error: PiSkillCatalogError }
> {
	if (!isAbsolute(path)) {
		return {
			ok: false,
			error: {
				code: "invalid-source-root",
				index,
				path: `skills[${index}].${field}`,
				message: "Pi Skill root paths must be absolute",
			},
		};
	}
	try {
		const physical = await realpath(resolve(path));
		const directoryStat = await stat(physical);
		if (!directoryStat.isDirectory()) {
			return {
				ok: false,
				error: {
					code: "invalid-source-root",
					index,
					path: `skills[${index}].${field}`,
					message: "Pi Skill root must resolve to a directory",
				},
			};
		}
		return { ok: true, value: physical };
	} catch (error) {
		return {
			ok: false,
			error: {
				code: "invalid-source-root",
				index,
				path: `skills[${index}].${field}`,
				message: `Pi Skill root cannot be resolved (${nodeErrorCode(error) ?? "unknown"})`,
			},
		};
	}
}

interface DescriptorMetadata {
	readonly label: string;
	readonly description: string;
	readonly kind: CapabilitySourceKind;
	readonly sourceName: string;
	readonly sourceBaseDir: string;
}

type DescriptorMetadataResult =
	| { readonly ok: true; readonly value: DescriptorMetadata }
	| { readonly ok: false; readonly error: PiSkillCatalogError };

interface DescriptorPaths {
	readonly skillFile: string;
	readonly skillRoot: string;
	readonly sourceRoot: string;
}

type DescriptorPathsResult =
	| { readonly ok: true; readonly value: DescriptorPaths }
	| { readonly ok: false; readonly error: PiSkillCatalogError };

function validateDescriptorMetadata(
	skill: Skill,
	index: number,
): DescriptorMetadataResult {
	const label = canonicalText(skill.name);
	const description = canonicalText(skill.description);
	if (label === undefined || description === undefined) {
		return descriptorFailure(
			"invalid-skill",
			index,
			`skills[${index}]`,
			"Pi Skill requires a nonblank name and description",
		);
	}
	const kind = sourceKind(skill);
	const sourceName = canonicalText(skill.sourceInfo.source);
	if (kind === undefined || sourceName === undefined) {
		return descriptorFailure(
			"invalid-source-provenance",
			index,
			kind === undefined
				? `skills[${index}].sourceInfo.scope`
				: `skills[${index}].sourceInfo.source`,
			"Pi Skill source provenance is incomplete or unsupported",
		);
	}
	if (skill.sourceInfo.baseDir === undefined) {
		return descriptorFailure(
			"invalid-source-provenance",
			index,
			`skills[${index}].sourceInfo.baseDir`,
			"Pi Skill source provenance requires its resource base directory",
		);
	}
	return {
		ok: true,
		value: {
			label,
			description,
			kind,
			sourceName,
			sourceBaseDir: skill.sourceInfo.baseDir,
		},
	};
}

async function resolveDescriptorPaths(
	skill: Skill,
	index: number,
	sourceBaseDir: string,
): Promise<DescriptorPathsResult> {
	const skillFile = await canonicalFile(skill.filePath, index, "filePath");
	if (!skillFile.ok) return skillFile;
	const sourceFile = await canonicalFile(
		skill.sourceInfo.path,
		index,
		"sourceInfo.path",
	);
	if (!sourceFile.ok) return sourceFile;
	if (sourceFile.value !== skillFile.value) {
		return descriptorFailure(
			"source-path-mismatch",
			index,
			`skills[${index}].sourceInfo.path`,
			"Pi Skill sourceInfo.path must identify the same material as filePath",
		);
	}
	const skillRoot = await canonicalDirectory(skill.baseDir, index, "baseDir");
	if (!skillRoot.ok) return skillRoot;
	if (dirname(skillFile.value) !== skillRoot.value) {
		return descriptorFailure(
			"skill-root-mismatch",
			index,
			`skills[${index}].baseDir`,
			"Pi Skill baseDir must be the direct parent of its material",
		);
	}
	const sourceRoot = await canonicalDirectory(
		sourceBaseDir,
		index,
		"sourceInfo.baseDir",
	);
	if (!sourceRoot.ok) return sourceRoot;
	if (!isContained(sourceRoot.value, skillFile.value)) {
		return descriptorFailure(
			"source-root-escape",
			index,
			`skills[${index}].sourceInfo.baseDir`,
			"Pi Skill material escapes its declared source root",
		);
	}
	return {
		ok: true,
		value: {
			skillFile: skillFile.value,
			skillRoot: skillRoot.value,
			sourceRoot: sourceRoot.value,
		},
	};
}

async function adaptDescriptor(
	skill: Skill,
	index: number,
): Promise<DescriptorResult> {
	const metadata = validateDescriptorMetadata(skill, index);
	if (!metadata.ok) return metadata;
	const paths = await resolveDescriptorPaths(
		skill,
		index,
		metadata.value.sourceBaseDir,
	);
	if (!paths.ok) return paths;

	const skillMaterialPath = basename(paths.value.skillFile);
	const supportsStructuredToc = skillMaterialPath === "SKILL.md";
	const identityTarget = supportsStructuredToc
		? paths.value.skillRoot
		: paths.value.skillFile;
	const relativeRoot = relative(paths.value.sourceRoot, identityTarget);
	const source = Object.freeze({
		kind: metadata.value.kind,
		locator:
			metadata.value.kind === "package"
				? metadata.value.sourceName
				: pathToFileURL(paths.value.sourceRoot).href,
		skillRoot: relativeRoot.length === 0 ? "." : toPosixPath(relativeRoot),
	});
	return {
		ok: true,
		value: Object.freeze({
			label: metadata.value.label,
			description: metadata.value.description,
			skillFilePath: paths.value.skillFile,
			skillRootPath: paths.value.skillRoot,
			skillMaterialPath,
			supportsStructuredToc,
			source,
		}),
	};
}

function occurrenceKey(descriptor: AdaptedPiSkillDescriptor): string {
	return [
		descriptor.source.kind,
		descriptor.source.locator,
		descriptor.source.skillRoot,
	].join("\0");
}

/**
 * Refines only the trust-filtered, deduplicated Skill catalog supplied by Pi.
 * It performs no sibling discovery and does not infer identity from Skill names.
 */
export async function adaptPiSkillCatalog(
	skills: readonly Skill[],
): Promise<PiSkillCatalogAdaptationResult> {
	const inventory: AdaptedPiSkillDescriptor[] = [];
	const excluded: PiSkillCatalogExclusion[] = [];
	const occurrences = new Set<string>();
	for (let index = 0; index < skills.length; index += 1) {
		const skill = skills[index];
		if (skill === undefined) {
			return failure(
				"invalid-skill",
				index,
				`skills[${index}]`,
				"Pi Skill catalog contains an empty entry",
			);
		}
		if (skill.disableModelInvocation) {
			excluded.push(
				Object.freeze({
					label: skill.name,
					skillFilePath: skill.filePath,
					reason: "model-invocation-disabled" as const,
				}),
			);
			continue;
		}
		const adapted = await adaptDescriptor(skill, index);
		if (!adapted.ok) {
			return Object.freeze({
				ok: false,
				error: Object.freeze(adapted.error),
			});
		}
		const key = occurrenceKey(adapted.value);
		if (occurrences.has(key)) {
			return failure(
				"duplicate-occurrence",
				index,
				`skills[${index}]`,
				"Pi Skill catalog repeats one source-bound occurrence",
			);
		}
		occurrences.add(key);
		inventory.push(adapted.value);
	}
	return Object.freeze({
		ok: true,
		inventory: Object.freeze(inventory),
		excluded: Object.freeze(excluded),
	});
}
