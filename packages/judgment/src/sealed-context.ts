import { Type, type Static, type TProperties } from "typebox";
import { Errors, Parse } from "typebox/value";

import type {
	ContextBinding,
	ContextSelection,
	ContextSourceDescriptor,
	ObservedContextEntry,
} from "./context.ts";
import { JudgmentParseError } from "./errors.ts";
import { canonicalJson, sha256, type JsonValue } from "./json.ts";
import { Sha256Schema } from "./schema.ts";

function exactObject<const T extends TProperties>(properties: T) {
	return Type.Object(properties, { additionalProperties: false });
}

export const ContextContentPartDataSchema = Type.Union([
	exactObject({
		kind: Type.Literal("text"),
		text: Type.String({ maxLength: 48_000 }),
	}),
	exactObject({
		kind: Type.Literal("image"),
		mediaType: Type.String({ minLength: 1, maxLength: 128 }),
		contentSha256: Sha256Schema,
	}),
]);
export const SealedContextMemberDataSchema = exactObject({
	bindingId: Type.String({ minLength: 1, maxLength: 300 }),
	contentSha256: Sha256Schema,
	isError: Type.Boolean(),
	truncated: Type.Boolean(),
	parts: Type.Array(ContextContentPartDataSchema, {
		minItems: 1,
		maxItems: 64,
	}),
});
export const SealedContextProposalDataSchema = exactObject({
	selectionSha256: Sha256Schema,
	members: Type.Array(SealedContextMemberDataSchema, { maxItems: 256 }),
});
export type ContextContentPartData = Static<
	typeof ContextContentPartDataSchema
>;
export type SealedContextMemberData = Static<
	typeof SealedContextMemberDataSchema
>;
export type SealedContextProposalData = Static<
	typeof SealedContextProposalDataSchema
>;

const sealedBrand: unique symbol = Symbol("SealedContext");

export type ContextContentPart =
	| { readonly kind: "text"; readonly text: string }
	| {
			readonly kind: "image";
			readonly mediaType: string;
			readonly contentSha256: string;
	  };
export type SelectedContextOrigin =
	| {
			readonly kind: "inventory-source";
			readonly source: ContextSourceDescriptor;
	  }
	| { readonly kind: "observed-context"; readonly entry: ObservedContextEntry };
export interface SelectedContextMember {
	readonly materialId: string;
	readonly memberId: string;
	readonly contentSha256: string;
	readonly isError: boolean;
	readonly truncated: boolean;
	readonly parts: readonly ContextContentPart[];
	readonly origin: SelectedContextOrigin;
}
export interface SealedContext {
	readonly [sealedBrand]: true;
	readonly judgmentId: string;
	readonly selectionSha256: string;
	readonly questionSha256: string;
	readonly branchRef: string;
	readonly members: readonly SelectedContextMember[];
	readonly sealedContextSha256: string;
}

function issues(value: JsonValue) {
	return [...Errors(SealedContextProposalDataSchema, value)].map((issue) => ({
		path: issue.instancePath || "/",
		message: issue.message,
		keyword: issue.keyword,
	}));
}
export function decodeSealedContextProposalData(
	value: JsonValue,
): SealedContextProposalData {
	try {
		return Parse(SealedContextProposalDataSchema, value);
	} catch (error) {
		throw new JudgmentParseError(
			"Sealed context proposal has an invalid representation.",
			{ issues: issues(value) },
			{ cause: error },
		);
	}
}
function part(data: ContextContentPartData, path: string): ContextContentPart {
	if (data.kind === "text")
		return Object.freeze({ kind: "text", text: data.text });
	if (data.mediaType !== data.mediaType.trim() || !data.mediaType.trim())
		throw new JudgmentParseError(
			`Image media type must be directly normalized at ${path}/mediaType.`,
		);
	return Object.freeze({
		kind: "image",
		mediaType: data.mediaType,
		contentSha256: data.contentSha256,
	});
}
function partIdentity(value: ContextContentPart): JsonValue {
	return value.kind === "text"
		? { kind: "text", text: value.text }
		: {
				kind: "image",
				mediaType: value.mediaType,
				contentSha256: value.contentSha256,
			};
}
export function contextContentSha256(
	parts: readonly ContextContentPart[],
): string {
	return sha256(canonicalJson(parts.map(partIdentity)));
}
function origin(
	selection: ContextSelection,
	binding: ContextBinding,
): SelectedContextOrigin {
	if (binding.kind === "inventory-source") {
		const source = selection.selectedSources.find(
			(candidate) => candidate.id === binding.memberId,
		);
		if (!source)
			throw new JudgmentParseError(
				`Selection lost inventory member ${binding.memberId}.`,
			);
		return Object.freeze({ kind: "inventory-source", source });
	}
	const entry = selection.selectedObservedContext.find(
		(candidate) => candidate.id === binding.memberId,
	);
	if (!entry)
		throw new JudgmentParseError(
			`Selection lost observed member ${binding.memberId}.`,
		);
	return Object.freeze({ kind: "observed-context", entry });
}
function memberIdentity(member: SelectedContextMember): JsonValue {
	return {
		materialId: member.materialId,
		memberId: member.memberId,
		contentSha256: member.contentSha256,
		isError: member.isError,
		truncated: member.truncated,
		parts: member.parts.map(partIdentity),
	};
}
export function parseSealedContext(
	data: SealedContextProposalData,
	selection: ContextSelection,
): SealedContext {
	if (data.selectionSha256 !== selection.selectionSha256)
		throw new JudgmentParseError(
			"Sealed context proposal names a stale selection.",
		);
	const proposed = new Map<string, SealedContextMemberData>();
	for (const member of data.members) {
		if (proposed.has(member.bindingId))
			throw new JudgmentParseError(
				`Duplicate sealed context binding: ${member.bindingId}.`,
			);
		proposed.set(member.bindingId, member);
	}
	if (proposed.size !== selection.bindings.length)
		throw new JudgmentParseError(
			"Sealed context must account for exactly every selected binding.",
		);
	const members: SelectedContextMember[] = [];
	for (const binding of selection.bindings) {
		const dataMember = proposed.get(binding.bindingId);
		if (!dataMember)
			throw new JudgmentParseError(
				`Missing sealed context binding: ${binding.bindingId}.`,
			);
		const parts = Object.freeze(
			dataMember.parts.map((value, index) =>
				part(value, `/members/${binding.bindingId}/parts/${index}`),
			),
		);
		const actual = contextContentSha256(parts);
		if (actual !== dataMember.contentSha256)
			throw new JudgmentParseError(
				`Sealed content digest mismatch for ${binding.bindingId}.`,
			);
		if (
			binding.expectedContentSha256 &&
			binding.expectedContentSha256 !== actual
		)
			throw new JudgmentParseError(
				`Selected content changed before sealing: ${binding.bindingId}.`,
			);
		const selectedOrigin = origin(selection, binding);
		if (selectedOrigin.kind === "inventory-source") {
			if (dataMember.isError || dataMember.truncated)
				throw new JudgmentParseError(
					`Inventory source cannot seal as error or truncated: ${binding.bindingId}.`,
				);
		} else if (
			dataMember.isError !== selectedOrigin.entry.isError ||
			dataMember.truncated !== selectedOrigin.entry.truncated
		) {
			throw new JudgmentParseError(
				`Observed result state changed before sealing: ${binding.bindingId}.`,
			);
		}
		members.push(
			Object.freeze({
				materialId: binding.bindingId,
				memberId: binding.memberId,
				contentSha256: actual,
				isError: dataMember.isError,
				truncated: dataMember.truncated,
				parts,
				origin: selectedOrigin,
			}),
		);
	}
	const frozenMembers = Object.freeze(
		members.toSorted((left, right) =>
			left.materialId.localeCompare(right.materialId),
		),
	);
	const sealedContextSha256 = sha256(
		canonicalJson({
			judgmentId: selection.judgmentId,
			selectionSha256: selection.selectionSha256,
			questionSha256: selection.questionSha256,
			members: frozenMembers.map(memberIdentity),
		}),
	);
	const sealed: SealedContext = {
		[sealedBrand]: true,
		judgmentId: selection.judgmentId,
		selectionSha256: selection.selectionSha256,
		questionSha256: selection.questionSha256,
		branchRef: selection.branchRef,
		members: frozenMembers,
		sealedContextSha256,
	};
	return Object.freeze(sealed);
}
