import { constants, type BigIntStats } from "node:fs";
import { open, realpath, stat, type FileHandle } from "node:fs/promises";
import { basename, dirname, isAbsolute, relative, resolve } from "node:path";
import { hashIdentity, sha256Bytes } from "../identity/hash-identity.ts";
import type { CapabilityAssignment } from "../routing/accept-applicability.ts";
import type {
	BoundCapability,
	BoundUnstructuredCapability,
	CapabilitySource,
} from "../routing/bind-capability.ts";
import type { BoundReferenceSelection } from "../routing/bind-reference-selection.ts";

export const SEALED_SKILL_CONTEXT_VERSION = "developer-sealed-skill-context/v1";
export const SEALED_UNSTRUCTURED_SKILL_CONTEXT_VERSION =
	"developer-sealed-unstructured-skill-context/v1";
export const MAX_SEALED_MATERIAL_BYTES = 256 * 1024;
export const MAX_SEALED_CONTEXT_BYTES = 1024 * 1024;

export interface SkillContextSealRequest {
	readonly skillRootPath: string;
	readonly capability: BoundCapability;
	readonly assignment: CapabilityAssignment;
	readonly selection: BoundReferenceSelection;
	readonly expectedSealedContextId?: string;
}

export interface SealedSkillMaterial {
	readonly kind: "skill" | "reference";
	readonly path: string;
	readonly locator: string;
	readonly byteLength: number;
	readonly hash: string;
	readonly bytesBase64: string;
	readonly content: string;
}

export interface SealedSkillContext {
	readonly sealedContextId: string;
	readonly workCaseId: string;
	readonly judgmentId: string;
	readonly contributionNeedId: string;
	readonly assignmentId: string;
	readonly selectionId: string;
	readonly capabilityId: string;
	readonly capabilityRevisionId: string;
	readonly source: CapabilitySource;
	readonly skillRootLocator: string;
	readonly selectedPaths: readonly string[];
	readonly materials: readonly SealedSkillMaterial[];
}

export interface UnstructuredSkillContextSealRequest {
	readonly skillFilePath: string;
	readonly capability: BoundUnstructuredCapability;
	readonly assignment: CapabilityAssignment;
	readonly expectedSealedContextId?: string;
}

export interface SealedUnstructuredSkillContext {
	readonly routing: "unstructured";
	readonly sealedContextId: string;
	readonly workCaseId: string;
	readonly judgmentId: string;
	readonly contributionNeedId: string;
	readonly assignmentId: string;
	readonly capabilityId: string;
	readonly capabilityRevisionId: string;
	readonly source: CapabilitySource;
	readonly skillLocator: string;
	readonly selectedPaths: readonly [];
	readonly materials: readonly [SealedSkillMaterial];
}

export type SkillContextSealErrorCode =
	| "selection-not-ready"
	| "identity-mismatch"
	| "invalid-root"
	| "invalid-skill-file"
	| "path-escape"
	| "material-missing"
	| "material-unreadable"
	| "material-not-regular"
	| "material-too-large"
	| "context-too-large"
	| "invalid-utf8"
	| "material-changed"
	| "skill-drift"
	| "context-drift";

export interface SkillContextSealError {
	readonly code: SkillContextSealErrorCode;
	readonly path: string;
	readonly message: string;
}

type SkillContextSealFailure = {
	readonly ok: false;
	readonly error: SkillContextSealError;
};

export type SkillContextSealResult =
	| { readonly ok: true; readonly value: SealedSkillContext }
	| SkillContextSealFailure;

export type UnstructuredSkillContextSealResult =
	| { readonly ok: true; readonly value: SealedUnstructuredSkillContext }
	| SkillContextSealFailure;

type MaterialResult =
	| { readonly ok: true; readonly value: SealedSkillMaterial }
	| { readonly ok: false; readonly error: SkillContextSealError };

function failure(
	code: SkillContextSealErrorCode,
	path: string,
	message: string,
): SkillContextSealFailure {
	return { ok: false, error: { code, path, message } };
}

function materialFailure(
	code: SkillContextSealErrorCode,
	path: string,
	message: string,
): MaterialResult {
	return { ok: false, error: { code, path, message } };
}

function nodeErrorCode(error: unknown): string | undefined {
	if (typeof error !== "object" || error === null || !("code" in error)) {
		return undefined;
	}
	return typeof error.code === "string" ? error.code : undefined;
}

function isContained(root: string, candidate: string): boolean {
	const remainder = relative(root, candidate);
	return (
		remainder === "" || (!remainder.startsWith("..") && !isAbsolute(remainder))
	);
}

function sameFileState(before: BigIntStats, after: BigIntStats): boolean {
	return (
		before.dev === after.dev &&
		before.ino === after.ino &&
		before.size === after.size &&
		before.mtimeNs === after.mtimeNs &&
		before.ctimeNs === after.ctimeNs
	);
}

async function closeQuietly(handle: FileHandle | undefined): Promise<void> {
	if (handle === undefined) return;
	try {
		await handle.close();
	} catch {
		// Acquisition results must remain bounded even if descriptor cleanup fails.
	}
}

function validateIdentity(
	request: SkillContextSealRequest,
): SkillContextSealFailure | undefined {
	const { assignment, capability, selection } = request;
	if (selection.status !== "ready") {
		return failure(
			"selection-not-ready",
			"selection.status",
			"Only a ready Reference selection can be sealed",
		);
	}
	for (const [path, actual, expected] of [
		[
			"assignment.capabilityId",
			assignment.capabilityId,
			capability.capabilityId,
		],
		[
			"assignment.capabilityRevisionId",
			assignment.capabilityRevisionId,
			capability.capabilityRevisionId,
		],
		["selection.assignmentId", selection.assignmentId, assignment.assignmentId],
		[
			"selection.capabilityRevisionId",
			selection.capabilityRevisionId,
			capability.capabilityRevisionId,
		],
	] as const) {
		if (actual !== expected) {
			return failure(
				"identity-mismatch",
				path,
				`Expected ${expected}, received ${actual}`,
			);
		}
	}
	return undefined;
}

async function resolveSkillRoot(
	skillRootPath: string,
): Promise<
	| { readonly ok: true; readonly lexical: string; readonly physical: string }
	| { readonly ok: false; readonly error: SkillContextSealError }
> {
	if (!isAbsolute(skillRootPath)) {
		return {
			ok: false,
			error: {
				code: "invalid-root",
				path: "skillRootPath",
				message: "Skill root must be an absolute path",
			},
		};
	}
	const lexical = resolve(skillRootPath);
	try {
		const physical = await realpath(lexical);
		const rootStat = await stat(physical);
		if (!rootStat.isDirectory()) {
			return {
				ok: false,
				error: {
					code: "invalid-root",
					path: "skillRootPath",
					message: "Skill root must resolve to a directory",
				},
			};
		}
		return { ok: true, lexical, physical };
	} catch (error) {
		return {
			ok: false,
			error: {
				code: "invalid-root",
				path: "skillRootPath",
				message: `Skill root cannot be resolved (${nodeErrorCode(error) ?? "unknown"})`,
			},
		};
	}
}

async function resolveMaterialPath(
	root: { readonly lexical: string; readonly physical: string },
	path: string,
): Promise<
	| { readonly ok: true; readonly physical: string }
	| { readonly ok: false; readonly error: SkillContextSealError }
> {
	const lexical = resolve(root.lexical, ...path.split("/"));
	if (!isContained(root.lexical, lexical)) {
		return {
			ok: false,
			error: {
				code: "path-escape",
				path,
				message: "Material escapes the lexical Skill root",
			},
		};
	}
	try {
		const physical = await realpath(lexical);
		if (!isContained(root.physical, physical)) {
			return {
				ok: false,
				error: {
					code: "path-escape",
					path,
					message: "Material escapes the physical Skill root",
				},
			};
		}
		return { ok: true, physical };
	} catch (error) {
		const code = nodeErrorCode(error);
		return {
			ok: false,
			error: {
				code:
					code === "ENOENT" || code === "ENOTDIR"
						? "material-missing"
						: "material-unreadable",
				path,
				message: `Material cannot be resolved (${code ?? "unknown"})`,
			},
		};
	}
}

async function acquireMaterial(
	root: { readonly lexical: string; readonly physical: string },
	kind: SealedSkillMaterial["kind"],
	path: string,
): Promise<MaterialResult> {
	const resolved = await resolveMaterialPath(root, path);
	if (!resolved.ok) return { ok: false, error: resolved.error };

	let handle: FileHandle | undefined;
	try {
		handle = await open(
			resolved.physical,
			constants.O_RDONLY | constants.O_NOFOLLOW,
		);
		const before = await handle.stat({ bigint: true });
		if (!before.isFile()) {
			return materialFailure(
				"material-not-regular",
				path,
				"Material must be a regular file",
			);
		}
		if (before.size > BigInt(MAX_SEALED_MATERIAL_BYTES)) {
			return materialFailure(
				"material-too-large",
				path,
				`Material exceeds ${MAX_SEALED_MATERIAL_BYTES} bytes`,
			);
		}
		const bytes = await handle.readFile();
		const after = await handle.stat({ bigint: true });
		if (
			!sameFileState(before, after) ||
			BigInt(bytes.byteLength) !== before.size
		) {
			return materialFailure(
				"material-changed",
				path,
				"Material changed while it was being acquired",
			);
		}
		let content: string;
		try {
			content = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
		} catch {
			return materialFailure(
				"invalid-utf8",
				path,
				"Material must contain valid UTF-8",
			);
		}
		return {
			ok: true,
			value: Object.freeze({
				kind,
				path,
				locator: resolved.physical,
				byteLength: bytes.byteLength,
				hash: sha256Bytes(bytes),
				bytesBase64: bytes.toString("base64"),
				content,
			}),
		};
	} catch (error) {
		return materialFailure(
			"material-unreadable",
			path,
			`Material cannot be read (${nodeErrorCode(error) ?? "unknown"})`,
		);
	} finally {
		await closeQuietly(handle);
	}
}

function contextIdentityParts(
	selection: BoundReferenceSelection,
	materials: readonly SealedSkillMaterial[],
): string[] {
	const parts = [selection.selectionId, selection.capabilityRevisionId];
	for (const material of materials) {
		parts.push("material", material.kind, material.path, material.hash);
	}
	return parts;
}

function validateUnstructuredIdentity(
	request: UnstructuredSkillContextSealRequest,
): SkillContextSealFailure | undefined {
	for (const [path, actual, expected] of [
		[
			"assignment.capabilityId",
			request.assignment.capabilityId,
			request.capability.capabilityId,
		],
		[
			"assignment.capabilityRevisionId",
			request.assignment.capabilityRevisionId,
			request.capability.capabilityRevisionId,
		],
	] as const) {
		if (actual !== expected) {
			return failure(
				"identity-mismatch",
				path,
				`Expected ${expected}, received ${actual}`,
			);
		}
	}
	return undefined;
}

function unstructuredContextIdentityParts(
	request: UnstructuredSkillContextSealRequest,
	material: SealedSkillMaterial,
): string[] {
	return [
		request.assignment.assignmentId,
		request.capability.capabilityRevisionId,
		"routing",
		"unstructured",
		"material",
		material.kind,
		material.path,
		material.hash,
	];
}

/** Atomically returns one exact selected Skill context or one bounded failure. */
export async function sealSkillContext(
	request: SkillContextSealRequest,
): Promise<SkillContextSealResult> {
	const identityFailure = validateIdentity(request);
	if (identityFailure !== undefined) return identityFailure;
	const root = await resolveSkillRoot(request.skillRootPath);
	if (!root.ok) return { ok: false, error: root.error };

	const requested = [
		{ kind: "skill" as const, path: "SKILL.md" },
		...request.selection.selectedPaths.map((path) => ({
			kind: "reference" as const,
			path,
		})),
	];
	const materials: SealedSkillMaterial[] = [];
	let totalBytes = 0;
	for (const materialRequest of requested) {
		const acquired = await acquireMaterial(
			root,
			materialRequest.kind,
			materialRequest.path,
		);
		if (!acquired.ok) return { ok: false, error: acquired.error };
		totalBytes += acquired.value.byteLength;
		if (totalBytes > MAX_SEALED_CONTEXT_BYTES) {
			return failure(
				"context-too-large",
				materialRequest.path,
				`Selected context exceeds ${MAX_SEALED_CONTEXT_BYTES} bytes`,
			);
		}
		materials.push(acquired.value);
	}
	if (materials[0]?.hash !== request.capability.skillHash) {
		return failure(
			"skill-drift",
			"SKILL.md",
			"SKILL.md no longer matches the bound Capability revision",
		);
	}

	const sealedContextId = hashIdentity(
		"sealed",
		SEALED_SKILL_CONTEXT_VERSION,
		contextIdentityParts(request.selection, materials),
	);
	if (
		request.expectedSealedContextId !== undefined &&
		request.expectedSealedContextId !== sealedContextId
	) {
		return failure(
			"context-drift",
			"expectedSealedContextId",
			"Selected material no longer matches the expected sealed context",
		);
	}

	const source = Object.freeze({ ...request.capability.source });
	return {
		ok: true,
		value: Object.freeze({
			sealedContextId,
			workCaseId: request.assignment.workCaseId,
			judgmentId: request.assignment.judgmentId,
			contributionNeedId: request.assignment.contributionNeedId,
			assignmentId: request.assignment.assignmentId,
			selectionId: request.selection.selectionId,
			capabilityId: request.capability.capabilityId,
			capabilityRevisionId: request.capability.capabilityRevisionId,
			source,
			skillRootLocator: root.physical,
			selectedPaths: Object.freeze([...request.selection.selectedPaths]),
			materials: Object.freeze(materials),
		}),
	};
}

/** Seals one exact unstructured Skill file without synthesizing a selection. */
export async function sealUnstructuredSkillContext(
	request: UnstructuredSkillContextSealRequest,
): Promise<UnstructuredSkillContextSealResult> {
	const identityFailure = validateUnstructuredIdentity(request);
	if (identityFailure !== undefined) return identityFailure;
	if (!isAbsolute(request.skillFilePath)) {
		return failure(
			"invalid-skill-file",
			"skillFilePath",
			"Skill file must be an absolute path",
		);
	}

	const lexicalSkillFile = resolve(request.skillFilePath);
	const root = await resolveSkillRoot(dirname(lexicalSkillFile));
	if (!root.ok) {
		return failure(
			"invalid-skill-file",
			"skillFilePath",
			`Skill file parent is invalid: ${root.error.message}`,
		);
	}
	const acquired = await acquireMaterial(
		root,
		"skill",
		basename(lexicalSkillFile),
	);
	if (!acquired.ok) return { ok: false, error: acquired.error };
	if (acquired.value.hash !== request.capability.skillHash) {
		return failure(
			"skill-drift",
			acquired.value.path,
			"Skill material no longer matches the bound Capability revision",
		);
	}

	const sealedContextId = hashIdentity(
		"sealed",
		SEALED_UNSTRUCTURED_SKILL_CONTEXT_VERSION,
		unstructuredContextIdentityParts(request, acquired.value),
	);
	if (
		request.expectedSealedContextId !== undefined &&
		request.expectedSealedContextId !== sealedContextId
	) {
		return failure(
			"context-drift",
			"expectedSealedContextId",
			"Skill material no longer matches the expected sealed context",
		);
	}

	const selectedPaths = Object.freeze([] as const);
	const materials = Object.freeze([acquired.value] as const);
	return {
		ok: true,
		value: Object.freeze({
			routing: "unstructured",
			sealedContextId,
			workCaseId: request.assignment.workCaseId,
			judgmentId: request.assignment.judgmentId,
			contributionNeedId: request.assignment.contributionNeedId,
			assignmentId: request.assignment.assignmentId,
			capabilityId: request.capability.capabilityId,
			capabilityRevisionId: request.capability.capabilityRevisionId,
			source: Object.freeze({ ...request.capability.source }),
			skillLocator: acquired.value.locator,
			selectedPaths,
			materials,
		}),
	};
}
