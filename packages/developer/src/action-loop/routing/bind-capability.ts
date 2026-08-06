import { hashIdentity, sha256Bytes } from "../identity/hash-identity.ts";
import type { ParsedToc } from "./parse-toc.ts";

export const CAPABILITY_ID_VERSION = "developer-capability/v1";
export const CAPABILITY_REVISION_VERSION = "developer-capability-revision/v1";
export const UNSTRUCTURED_CAPABILITY_MARKER =
	"developer-capability-routing/unstructured-no-toc/v1";

export type CapabilitySourceKind =
	| "package"
	| "global"
	| "project"
	| "settings"
	| "cli";

export interface CapabilitySource {
	readonly kind: CapabilitySourceKind;
	readonly locator: string;
	readonly skillRoot: string;
}

export interface BoundCapability {
	readonly capabilityId: string;
	readonly capabilityRevisionId: string;
	readonly skillHash: string;
	readonly tocHash: string;
	readonly source: CapabilitySource;
	readonly toc: ParsedToc;
}

export interface BoundUnstructuredCapability {
	readonly routing: "unstructured";
	readonly capabilityId: string;
	readonly capabilityRevisionId: string;
	readonly skillHash: string;
	readonly source: CapabilitySource;
}

export type CapabilityBindingErrorCode =
	| "unsupported-source-kind"
	| "invalid-source-locator"
	| "invalid-skill-root";

export interface CapabilityBindingError {
	readonly code: CapabilityBindingErrorCode;
	readonly path: "source.kind" | "source.locator" | "source.skillRoot";
	readonly message: string;
}

type CapabilityBindingFailure = {
	readonly ok: false;
	readonly error: CapabilityBindingError;
};

export type CapabilityBindingResult =
	| { readonly ok: true; readonly value: BoundCapability }
	| CapabilityBindingFailure;

export type UnstructuredCapabilityBindingResult =
	| { readonly ok: true; readonly value: BoundUnstructuredCapability }
	| CapabilityBindingFailure;

type BoundSourceIdentity = {
	readonly source: CapabilitySource;
	readonly capabilityId: string;
};

type SourceIdentityResult =
	| { readonly ok: true; readonly value: BoundSourceIdentity }
	| CapabilityBindingFailure;

const SOURCE_KINDS: ReadonlySet<string> = new Set([
	"package",
	"global",
	"project",
	"settings",
	"cli",
]);

function failure(
	code: CapabilityBindingErrorCode,
	path: CapabilityBindingError["path"],
	message: string,
): CapabilityBindingFailure {
	return { ok: false, error: { code, path, message } };
}

function isCanonicalLocator(locator: string): boolean {
	return (
		locator.length > 0 && locator === locator.trim() && !locator.includes("\0")
	);
}

function isNormalizedSkillRoot(root: string): boolean {
	if (root === ".") return true;
	if (
		root.length === 0 ||
		root !== root.trim() ||
		root.startsWith("/") ||
		/^[A-Za-z]:/.test(root) ||
		root.includes("\\") ||
		root.includes("\0")
	) {
		return false;
	}
	return root
		.split("/")
		.every(
			(segment) => segment.length > 0 && segment !== "." && segment !== "..",
		);
}

function bindSourceIdentity(source: CapabilitySource): SourceIdentityResult {
	if (!SOURCE_KINDS.has(source.kind)) {
		return failure(
			"unsupported-source-kind",
			"source.kind",
			`Unsupported Capability source kind ${source.kind}`,
		);
	}
	if (!isCanonicalLocator(source.locator)) {
		return failure(
			"invalid-source-locator",
			"source.locator",
			"Capability source locator must be a nonblank canonical value",
		);
	}
	if (!isNormalizedSkillRoot(source.skillRoot)) {
		return failure(
			"invalid-skill-root",
			"source.skillRoot",
			"Skill root must be '.' or a normalized relative POSIX path",
		);
	}
	const boundSource = Object.freeze({
		kind: source.kind,
		locator: source.locator,
		skillRoot: source.skillRoot,
	});
	return {
		ok: true,
		value: {
			source: boundSource,
			capabilityId: hashIdentity("cap", CAPABILITY_ID_VERSION, [
				boundSource.kind,
				boundSource.locator,
				boundSource.skillRoot,
			]),
		},
	};
}

function canonicalTocBytes(toc: ParsedToc): Uint8Array {
	return Buffer.from(
		JSON.stringify({
			schema: toc.schema,
			when: toc.when,
			unless: toc.unless,
			references: toc.references.map((reference) => ({
				path: reference.path,
				when: reference.when,
			})),
		}),
		"utf8",
	);
}

/**
 * Binds a refined TOC to adapter-supplied source provenance. Human Skill names,
 * model identity, provider metadata, and Reference bodies are intentionally not
 * part of either identity.
 */
export function bindCapability(
	source: CapabilitySource,
	toc: ParsedToc,
	skillBytes: Uint8Array,
): CapabilityBindingResult {
	const sourceIdentity = bindSourceIdentity(source);
	if (!sourceIdentity.ok) return sourceIdentity;
	const { capabilityId, source: boundSource } = sourceIdentity.value;
	const skillHash = sha256Bytes(skillBytes);
	const tocHash = sha256Bytes(canonicalTocBytes(toc));
	const capabilityRevisionId = hashIdentity(
		"caprev",
		CAPABILITY_REVISION_VERSION,
		[capabilityId, skillHash, tocHash],
	);

	return {
		ok: true,
		value: Object.freeze({
			capabilityId,
			capabilityRevisionId,
			skillHash,
			tocHash,
			source: boundSource,
			toc,
		}),
	};
}

/**
 * Binds a Pi-admitted Skill without a recognized TOC to source and exact Skill
 * bytes. The explicit no-TOC marker prevents absence from becoming a synthetic
 * structured routing contract.
 */
export function bindUnstructuredCapability(
	source: CapabilitySource,
	skillBytes: Uint8Array,
): UnstructuredCapabilityBindingResult {
	const sourceIdentity = bindSourceIdentity(source);
	if (!sourceIdentity.ok) return sourceIdentity;
	const { capabilityId, source: boundSource } = sourceIdentity.value;
	const skillHash = sha256Bytes(skillBytes);
	const capabilityRevisionId = hashIdentity(
		"caprev",
		CAPABILITY_REVISION_VERSION,
		[capabilityId, skillHash, UNSTRUCTURED_CAPABILITY_MARKER],
	);
	return {
		ok: true,
		value: Object.freeze({
			routing: "unstructured",
			capabilityId,
			capabilityRevisionId,
			skillHash,
			source: boundSource,
		}),
	};
}
