import { constants, type BigIntStats } from "node:fs";
import { open, type FileHandle } from "node:fs/promises";
import { MAX_SEALED_MATERIAL_BYTES } from "../io/seal-skill-context.ts";
import {
	bindCapability,
	type BoundCapability,
	type CapabilityBindingError,
} from "../routing/bind-capability.ts";
import type { PiSkillCatalogExclusion } from "./adapt-skill-catalog.ts";
import type {
	BeforeAgentStartSkillCatalogResult,
	CataloguedPiSkillEntry,
	StructuredCataloguedPiSkillEntry,
} from "./catalog-pi-loaded-skills.ts";

export const MAX_CAPABILITY_SKILL_BYTES = MAX_SEALED_MATERIAL_BYTES;

export type SkillByteAcquisitionErrorCode =
	| "skill-missing"
	| "skill-unreadable"
	| "skill-not-regular"
	| "skill-too-large"
	| "skill-changed"
	| "invalid-utf8";

export interface SkillByteAcquisitionError {
	readonly code: SkillByteAcquisitionErrorCode;
	readonly path: string;
	readonly message: string;
}

export interface BoundPiCapabilityEntry {
	readonly status: "bound";
	readonly candidate: StructuredCataloguedPiSkillEntry["candidate"];
	readonly descriptor: StructuredCataloguedPiSkillEntry["descriptor"];
	readonly capability: BoundCapability;
}

export type PiCapabilityBindingFailure =
	| {
			readonly status: "binding-failed";
			readonly stage: "skill-acquisition";
			readonly candidate: StructuredCataloguedPiSkillEntry["candidate"];
			readonly descriptor: StructuredCataloguedPiSkillEntry["descriptor"];
			readonly error: SkillByteAcquisitionError;
	  }
	| {
			readonly status: "binding-failed";
			readonly stage: "capability-binding";
			readonly candidate: StructuredCataloguedPiSkillEntry["candidate"];
			readonly descriptor: StructuredCataloguedPiSkillEntry["descriptor"];
			readonly error: CapabilityBindingError;
	  };

export type PiCapabilityInventoryEntry =
	| BoundPiCapabilityEntry
	| Exclude<CataloguedPiSkillEntry, { readonly status: "structured" }>
	| PiCapabilityBindingFailure;

export type PiCapabilityInventoryResult =
	| {
			readonly status: "inventoried";
			readonly entries: readonly PiCapabilityInventoryEntry[];
			readonly excluded: readonly PiSkillCatalogExclusion[];
	  }
	| Extract<
			BeforeAgentStartSkillCatalogResult,
			{ readonly status: "rejected" }
	  >;

type SkillBytesResult =
	| { readonly ok: true; readonly bytes: Uint8Array }
	| { readonly ok: false; readonly error: SkillByteAcquisitionError };

function nodeErrorCode(error: unknown): string | undefined {
	if (typeof error !== "object" || error === null || !("code" in error)) {
		return undefined;
	}
	return typeof error.code === "string" ? error.code : undefined;
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
		// The bounded acquisition result is already determined.
	}
}

function acquisitionFailure(
	code: SkillByteAcquisitionErrorCode,
	path: string,
	message: string,
): SkillBytesResult {
	return {
		ok: false,
		error: Object.freeze({ code, path, message }),
	};
}

async function readAtMost(
	handle: FileHandle,
	maximumBytes: number,
): Promise<Buffer> {
	const buffer = Buffer.alloc(maximumBytes + 1);
	let offset = 0;
	while (offset < buffer.byteLength) {
		const { bytesRead } = await handle.read(
			buffer,
			offset,
			buffer.byteLength - offset,
			null,
		);
		if (bytesRead === 0) break;
		offset += bytesRead;
	}
	return buffer.subarray(0, offset);
}

async function acquireSkillBytes(
	entry: StructuredCataloguedPiSkillEntry,
): Promise<SkillBytesResult> {
	const path = entry.candidate.skillFilePath;
	let handle: FileHandle | undefined;
	try {
		handle = await open(
			path,
			constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
		);
		const before = await handle.stat({ bigint: true });
		if (!before.isFile()) {
			return acquisitionFailure(
				"skill-not-regular",
				path,
				"Skill material must be a regular file",
			);
		}
		if (before.size > BigInt(MAX_CAPABILITY_SKILL_BYTES)) {
			return acquisitionFailure(
				"skill-too-large",
				path,
				`Skill material exceeds ${MAX_CAPABILITY_SKILL_BYTES} bytes`,
			);
		}
		const bytes = await readAtMost(handle, Number(before.size));
		const after = await handle.stat({ bigint: true });
		if (
			!sameFileState(before, after) ||
			BigInt(bytes.byteLength) !== before.size
		) {
			return acquisitionFailure(
				"skill-changed",
				path,
				"Skill material changed while it was being acquired",
			);
		}
		try {
			new TextDecoder("utf-8", { fatal: true }).decode(bytes);
		} catch {
			return acquisitionFailure(
				"invalid-utf8",
				path,
				"Skill material must contain valid UTF-8",
			);
		}
		return { ok: true, bytes };
	} catch (error) {
		const code = nodeErrorCode(error);
		return acquisitionFailure(
			code === "ENOENT" || code === "ENOTDIR"
				? "skill-missing"
				: "skill-unreadable",
			path,
			`Skill material cannot be read (${code ?? "unknown"})`,
		);
	} finally {
		await closeQuietly(handle);
	}
}

async function bindStructuredEntry(
	entry: StructuredCataloguedPiSkillEntry,
): Promise<BoundPiCapabilityEntry | PiCapabilityBindingFailure> {
	const acquired = await acquireSkillBytes(entry);
	if (!acquired.ok) {
		return Object.freeze({
			status: "binding-failed",
			stage: "skill-acquisition",
			candidate: entry.candidate,
			descriptor: entry.descriptor,
			error: acquired.error,
		});
	}
	const bound = bindCapability(
		entry.candidate.source,
		entry.descriptor.toc,
		acquired.bytes,
	);
	if (!bound.ok) {
		return Object.freeze({
			status: "binding-failed",
			stage: "capability-binding",
			candidate: entry.candidate,
			descriptor: entry.descriptor,
			error: Object.freeze({ ...bound.error }),
		});
	}
	return Object.freeze({
		status: "bound",
		candidate: entry.candidate,
		descriptor: entry.descriptor,
		capability: bound.value,
	});
}

/**
 * Binds every structured Pi-loaded Skill entry to exact bounded SKILL.md bytes.
 * Unstructured and TOC-failed entries pass through without filesystem access.
 */
export async function bindPiCapabilityInventory(
	catalog: BeforeAgentStartSkillCatalogResult,
): Promise<PiCapabilityInventoryResult> {
	if (catalog.status === "rejected") return catalog;
	const entries: PiCapabilityInventoryEntry[] = [];
	for (const entry of catalog.entries) {
		entries.push(
			entry.status === "structured" ? await bindStructuredEntry(entry) : entry,
		);
	}
	return Object.freeze({
		status: "inventoried",
		entries: Object.freeze(entries),
		excluded: catalog.excluded,
	});
}
