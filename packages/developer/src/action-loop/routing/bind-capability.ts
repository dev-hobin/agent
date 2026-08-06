import { createHash } from "node:crypto";
import type { ParsedToc } from "./parse-toc.ts";

export const CAPABILITY_ID_VERSION = "developer-capability/v1";
export const CAPABILITY_REVISION_VERSION = "developer-capability-revision/v1";

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

export type CapabilityBindingErrorCode =
	| "unsupported-source-kind"
	| "invalid-source-locator"
	| "invalid-skill-root";

export interface CapabilityBindingError {
	readonly code: CapabilityBindingErrorCode;
	readonly path: "source.kind" | "source.locator" | "source.skillRoot";
	readonly message: string;
}

export type CapabilityBindingResult =
	| { readonly ok: true; readonly value: BoundCapability }
	| { readonly ok: false; readonly error: CapabilityBindingError };

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
): CapabilityBindingResult {
	return { ok: false, error: { code, path, message } };
}

function isCanonicalLocator(locator: string): boolean {
	return (
		locator.length > 0 &&
		locator === locator.trim() &&
		!locator.includes("\0")
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

function hashParts(prefix: string, parts: readonly (string | Uint8Array)[]): string {
	const hash = createHash("sha256");
	for (const part of parts) {
		const bytes = typeof part === "string" ? Buffer.from(part, "utf8") : part;
		const length = Buffer.alloc(8);
		length.writeBigUInt64BE(BigInt(bytes.byteLength));
		hash.update(length);
		hash.update(bytes);
	}
	return `${prefix}_${hash.digest("hex")}`;
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
	const capabilityId = hashParts("cap", [
		CAPABILITY_ID_VERSION,
		boundSource.kind,
		boundSource.locator,
		boundSource.skillRoot,
	]);
	const skillHash = hashParts("sha256", [skillBytes]);
	const tocHash = hashParts("sha256", [canonicalTocBytes(toc)]);
	const capabilityRevisionId = hashParts("caprev", [
		CAPABILITY_REVISION_VERSION,
		capabilityId,
		skillHash,
		tocHash,
	]);

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
