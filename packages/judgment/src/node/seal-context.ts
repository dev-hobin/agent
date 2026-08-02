import { readFile, realpath, stat } from "node:fs/promises";

export {
	MAX_JUDGMENT_POLICY_BYTES,
	loadOptionalJudgmentPolicyFile,
	readJudgmentPolicyFile,
	type LoadedJudgmentPolicy,
	type OptionalJudgmentPolicyLoad,
} from "./read-judgment-policy.ts";
import { relative, resolve } from "node:path";

import type {
	ContextSelection,
	ContextSourceDescriptor,
	ObservedContextEntry,
} from "../context.ts";
import { ContextSealError } from "../errors.ts";
import { canonicalJson, jsonValueFromUnknown } from "../json.ts";
import {
	contextContentSha256,
	decodeSealedContextProposalData,
	parseSealedContext,
	type ContextContentPartData,
	type SealedContext,
} from "../sealed-context.ts";

export const MAX_SEALED_MEMBER_BYTES = 48_000;
export const MAX_SEALED_CONTEXT_BYTES = 256_000;

export interface LocalReferenceReadOptions {
	readonly maxBytes: number;
	readonly signal?: AbortSignal;
}

export interface LocalReferenceReader {
	read(
		source: Extract<ContextSourceDescriptor, { kind: "prepared-reference" }>,
		options: LocalReferenceReadOptions,
	): Promise<string>;
}

export interface AcquiredContextData {
	readonly parts: readonly ContextContentPartData[];
	readonly isError: boolean;
	readonly truncated: boolean;
}

export interface ContextAcquisition {
	readonly acquirePreparedReference: (
		source: Extract<ContextSourceDescriptor, { kind: "prepared-reference" }>,
		signal?: AbortSignal,
	) => Promise<AcquiredContextData>;
	readonly acquireSkill?: (
		source: Extract<ContextSourceDescriptor, { kind: "pi-skill" }>,
		signal?: AbortSignal,
	) => Promise<AcquiredContextData>;
	readonly acquireContextFile?: (
		source: Extract<ContextSourceDescriptor, { kind: "pi-context-file" }>,
		signal?: AbortSignal,
	) => Promise<AcquiredContextData>;
	readonly acquireObservedContext?: (
		entry: ObservedContextEntry,
		signal?: AbortSignal,
	) => Promise<AcquiredContextData>;
}

function isContained(root: string, candidate: string): boolean {
	const path = relative(root, candidate);
	return path === "" || (!path.startsWith("..") && !path.startsWith("/"));
}

export function createNodeLocalReferenceReader(
	policyRoot: string,
): LocalReferenceReader {
	const lexicalRoot = resolve(policyRoot);
	let resolvedRoot: Promise<string> | undefined;
	const root = () => (resolvedRoot ??= realpath(lexicalRoot));
	return {
		async read(source, options): Promise<string> {
			const lexicalTarget = resolve(lexicalRoot, source.path);
			if (!isContained(lexicalRoot, lexicalTarget)) {
				throw new ContextSealError(
					`Prepared reference escapes its policy root: ${source.path}.`,
					{ path: source.path },
				);
			}
			try {
				const [realRoot, realTarget] = await Promise.all([
					root(),
					realpath(lexicalTarget),
				]);
				if (!isContained(realRoot, realTarget)) {
					throw new ContextSealError(
						`Prepared reference symlink escapes its policy root: ${source.path}.`,
						{ path: source.path },
					);
				}
				const metadata = await stat(realTarget);
				if (!metadata.isFile()) {
					throw new ContextSealError(
						`Local reference is not a regular file: ${source.path}.`,
						{ path: source.path },
					);
				}
				if (metadata.size > options.maxBytes) {
					throw new ContextSealError(
						`Local reference exceeds its byte limit: ${source.path}.`,
						{
							path: source.path,
							bytes: metadata.size,
							limit: options.maxBytes,
						},
					);
				}
				const bytes = await readFile(
					realTarget,
					options.signal ? { signal: options.signal } : undefined,
				);
				if (bytes.byteLength > options.maxBytes) {
					throw new ContextSealError(
						`Local reference grew beyond its byte limit: ${source.path}.`,
						{
							path: source.path,
							bytes: bytes.byteLength,
							limit: options.maxBytes,
						},
					);
				}
				try {
					return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
				} catch (error) {
					throw new ContextSealError(
						`Local reference is not valid UTF-8: ${source.path}.`,
						{ path: source.path },
						{ cause: error },
					);
				}
			} catch (error) {
				if (error instanceof ContextSealError) throw error;
				throw new ContextSealError(
					`Unable to read local reference: ${source.path}.`,
					{ path: source.path },
					{ cause: error },
				);
			}
		},
	};
}

function skillMetadata(
	source: Extract<ContextSourceDescriptor, { kind: "pi-skill" }>,
): AcquiredContextData {
	return {
		parts: [
			{
				kind: "text",
				text: `Pi skill metadata\nTitle: ${source.title}\nDescription: ${source.description}`,
			},
		],
		isError: false,
		truncated: false,
	};
}

async function acquireInventorySource(
	source: ContextSourceDescriptor,
	acquisition: ContextAcquisition,
	signal?: AbortSignal,
): Promise<AcquiredContextData> {
	switch (source.kind) {
		case "prepared-reference":
			return acquisition.acquirePreparedReference(source, signal);
		case "pi-skill":
			if (source.contentSha256) {
				if (!acquisition.acquireSkill) {
					throw new ContextSealError(
						`No Pi skill acquisition is available for ${source.id}.`,
						{ sourceId: source.id },
					);
				}
				return acquisition.acquireSkill(source, signal);
			}
			return skillMetadata(source);
		case "pi-context-file":
			if (!acquisition.acquireContextFile) {
				throw new ContextSealError(
					`No Pi context-file acquisition is available for ${source.id}.`,
					{ sourceId: source.id },
				);
			}
			return acquisition.acquireContextFile(source, signal);
		default:
			return assertNever(source);
	}
}

function acquisitionBytes(value: AcquiredContextData): number {
	return new TextEncoder().encode(
		canonicalJson(jsonValueFromUnknown(value.parts)),
	).byteLength;
}

function acquiredMember(input: {
	readonly bindingId: string;
	readonly content: AcquiredContextData;
}) {
	const bytes = acquisitionBytes(input.content);
	if (bytes > MAX_SEALED_MEMBER_BYTES) {
		throw new ContextSealError(
			`Acquired context exceeds its member limit: ${input.bindingId}.`,
			{
				bindingId: input.bindingId,
				bytes,
				limit: MAX_SEALED_MEMBER_BYTES,
			},
		);
	}
	return {
		bindingId: input.bindingId,
		contentSha256: contextContentSha256(input.content.parts),
		isError: input.content.isError,
		truncated: input.content.truncated,
		parts: input.content.parts,
		bytes,
	};
}

export async function sealContext(
	selection: ContextSelection,
	acquisition: ContextAcquisition,
	options: { readonly signal?: AbortSignal } = {},
): Promise<SealedContext> {
	if (options.signal?.aborted) {
		throw new ContextSealError(
			"Context sealing was aborted before acquisition.",
		);
	}
	try {
		const acquired = await Promise.all(
			selection.bindings.map(async (binding) => {
				if (options.signal?.aborted) {
					throw new ContextSealError("Context sealing was aborted.");
				}
				if (binding.kind === "inventory-source") {
					const source = selection.selectedSources.find(
						(candidate) => candidate.id === binding.memberId,
					);
					if (!source) {
						throw new ContextSealError(
							`Selection lost inventory source ${binding.memberId}.`,
							{ bindingId: binding.bindingId },
						);
					}
					return acquiredMember({
						bindingId: binding.bindingId,
						content: await acquireInventorySource(
							source,
							acquisition,
							options.signal,
						),
					});
				}
				const entry = selection.selectedObservedContext.find(
					(candidate) => candidate.id === binding.memberId,
				);
				if (!entry) {
					throw new ContextSealError(
						`Selection lost observed context ${binding.memberId}.`,
						{ bindingId: binding.bindingId },
					);
				}
				if (!acquisition.acquireObservedContext) {
					throw new ContextSealError(
						`No current-branch acquisition is available for ${entry.id}.`,
						{ observedContextId: entry.id },
					);
				}
				return acquiredMember({
					bindingId: binding.bindingId,
					content: await acquisition.acquireObservedContext(
						entry,
						options.signal,
					),
				});
			}),
		);
		const totalBytes = acquired.reduce(
			(total, member) => total + member.bytes,
			0,
		);
		if (totalBytes > MAX_SEALED_CONTEXT_BYTES) {
			throw new ContextSealError(
				"Acquired context exceeds the aggregate byte limit.",
				{ bytes: totalBytes, limit: MAX_SEALED_CONTEXT_BYTES },
			);
		}
		return parseSealedContext(
			decodeSealedContextProposalData(
				jsonValueFromUnknown({
					selectionSha256: selection.selectionSha256,
					members: acquired.map(({ bytes: _bytes, ...member }) => member),
				}),
			),
			selection,
		);
	} catch (error) {
		if (error instanceof ContextSealError) throw error;
		throw new ContextSealError(
			"Context sealing failed before an atomic result was produced.",
			{},
			{ cause: error },
		);
	}
}

function assertNever(value: never): never {
	throw new ContextSealError(
		`Unsupported context acquisition variant: ${JSON.stringify(value)}.`,
	);
}
