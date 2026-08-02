import { Type, type Static, type TProperties, type TSchema } from "typebox";
import { Errors, Parse } from "typebox/value";

import type { DynamicJudgmentQuestion } from "./question.ts";
import { JudgmentParseError } from "./errors.ts";
import { canonicalJson, sha256, type JsonValue } from "./json.ts";
import {
	IdentifierSchema,
	NonEmptyTextSchema,
	Sha256Schema,
} from "./schema.ts";

function exactObject<const T extends TProperties>(properties: T) {
	return Type.Object(properties, { additionalProperties: false });
}

const ContextProvenanceDataSchema = exactObject({
	source: Type.String({ minLength: 1, maxLength: 1_000, pattern: "\\S" }),
	scope: Type.Union([
		Type.Literal("user"),
		Type.Literal("project"),
		Type.Literal("temporary"),
	]),
	origin: Type.Union([
		Type.Literal("package"),
		Type.Literal("top-level"),
		Type.Literal("session"),
	]),
	path: Type.Optional(
		Type.String({ minLength: 1, maxLength: 2_000, pattern: "\\S" }),
	),
});
const SourceBase = {
	id: IdentifierSchema,
	title: Type.String({ minLength: 1, maxLength: 500, pattern: "\\S" }),
	description: Type.String({ minLength: 1, maxLength: 2_000, pattern: "\\S" }),
	provenance: ContextProvenanceDataSchema,
};
const PreparedReferenceDescriptorDataSchema = exactObject({
	...SourceBase,
	kind: Type.Literal("prepared-reference"),
	path: Type.String({ minLength: 1, maxLength: 1_024, pattern: "\\S" }),
	when: Type.Array(NonEmptyTextSchema, {
		minItems: 1,
		maxItems: 64,
		uniqueItems: true,
	}),
	policySha256: Sha256Schema,
});
const PiSkillDescriptorDataSchema = exactObject({
	...SourceBase,
	kind: Type.Literal("pi-skill"),
	policyPath: Type.Optional(
		Type.String({ minLength: 1, maxLength: 2_000, pattern: "\\S" }),
	),
});
const PiContextFileDescriptorDataSchema = exactObject({
	...SourceBase,
	kind: Type.Literal("pi-context-file"),
	path: Type.String({ minLength: 1, maxLength: 2_000, pattern: "\\S" }),
	contentSha256: Sha256Schema,
});
export const ContextSourceDescriptorDataSchema = Type.Union([
	PreparedReferenceDescriptorDataSchema,
	PiSkillDescriptorDataSchema,
	PiContextFileDescriptorDataSchema,
]);
export const CapabilityDescriptorDataSchema = exactObject({
	id: IdentifierSchema,
	kind: Type.Literal("pi-tool"),
	name: Type.String({ minLength: 1, maxLength: 128, pattern: "\\S" }),
	description: Type.String({ minLength: 1, maxLength: 2_000, pattern: "\\S" }),
	active: Type.Boolean(),
	provenance: ContextProvenanceDataSchema,
});
export const ContextInventoryDataSchema = exactObject({
	sources: Type.Array(ContextSourceDescriptorDataSchema, { maxItems: 2_000 }),
	capabilities: Type.Array(CapabilityDescriptorDataSchema, { maxItems: 1_000 }),
});

const ObservedBase = {
	id: IdentifierSchema,
	contentSha256: Sha256Schema,
	isError: Type.Boolean(),
	truncated: Type.Boolean(),
	sequence: Type.Integer({ minimum: 0, maximum: 1_000_000_000 }),
	provenance: ContextProvenanceDataSchema,
};
const ReadResultDataSchema = exactObject({
	...ObservedBase,
	kind: Type.Literal("read-result"),
	toolCallId: Type.String({ minLength: 1, maxLength: 300 }),
	toolName: Type.String({ minLength: 1, maxLength: 128 }),
	argumentsSha256: Sha256Schema,
	inventorySourceId: Type.Optional(IdentifierSchema),
});
const ToolResultDataSchema = exactObject({
	...ObservedBase,
	kind: Type.Literal("tool-result"),
	toolCallId: Type.String({ minLength: 1, maxLength: 300 }),
	toolName: Type.String({ minLength: 1, maxLength: 128 }),
	argumentsSha256: Sha256Schema,
});
const UserExplicitDataSchema = exactObject({
	...ObservedBase,
	kind: Type.Literal("user-explicit"),
	userEventId: Type.String({ minLength: 1, maxLength: 300 }),
});
const DomainEvidenceDataSchema = exactObject({
	...ObservedBase,
	kind: Type.Literal("domain-evidence"),
	domainRef: Type.String({ minLength: 1, maxLength: 300 }),
	domainType: IdentifierSchema,
	evaluator: exactObject({
		id: IdentifierSchema,
		version: Type.String({ minLength: 1, maxLength: 128, pattern: "\\S" }),
	}),
});
export const ObservedContextEntryDataSchema = Type.Union([
	ReadResultDataSchema,
	ToolResultDataSchema,
	UserExplicitDataSchema,
	DomainEvidenceDataSchema,
]);
export const ObservedContextDataSchema = exactObject({
	branchRef: Type.String({ minLength: 1, maxLength: 300, pattern: "\\S" }),
	entries: Type.Array(ObservedContextEntryDataSchema, { maxItems: 2_000 }),
});

const InventoryNominationDataSchema = exactObject({
	kind: Type.Literal("inventory-source"),
	inventorySourceId: IdentifierSchema,
	descriptorSha256: Sha256Schema,
	contentSha256: Type.Optional(Sha256Schema),
});
const ObservedNominationDataSchema = exactObject({
	kind: Type.Literal("observed-context"),
	observedContextId: IdentifierSchema,
	descriptorSha256: Sha256Schema,
});
export const ContextNominationDataSchema = Type.Union([
	InventoryNominationDataSchema,
	ObservedNominationDataSchema,
]);
export const ContextSelectionProposalDataSchema = exactObject({
	questionSha256: Sha256Schema,
	nominations: Type.Array(ContextNominationDataSchema, { maxItems: 256 }),
	selectionBasis: Type.Array(NonEmptyTextSchema, {
		minItems: 1,
		maxItems: 32,
		uniqueItems: true,
	}),
});

export type ContextProvenanceData = Static<typeof ContextProvenanceDataSchema>;
export type ContextSourceDescriptorData = Static<
	typeof ContextSourceDescriptorDataSchema
>;
export type CapabilityDescriptorData = Static<
	typeof CapabilityDescriptorDataSchema
>;
export type ContextInventoryData = Static<typeof ContextInventoryDataSchema>;
export type ObservedContextEntryData = Static<
	typeof ObservedContextEntryDataSchema
>;
export type ObservedContextData = Static<typeof ObservedContextDataSchema>;
export type ContextNominationData = Static<typeof ContextNominationDataSchema>;
export type ContextSelectionProposalData = Static<
	typeof ContextSelectionProposalDataSchema
>;

const inventoryBrand: unique symbol = Symbol("ContextInventory");
const observedBrand: unique symbol = Symbol("ObservedContext");
const proposalBrand: unique symbol = Symbol("ContextSelectionProposal");
const selectionBrand: unique symbol = Symbol("ContextSelection");

export interface ContextProvenance {
	readonly source: string;
	readonly scope: "user" | "project" | "temporary";
	readonly origin: "package" | "top-level" | "session";
	readonly path?: string;
}

interface SourceDescriptorBase {
	readonly id: string;
	readonly title: string;
	readonly description: string;
	readonly provenance: ContextProvenance;
	readonly descriptorSha256: string;
}
export type ContextSourceDescriptor =
	| (SourceDescriptorBase & {
			readonly kind: "prepared-reference";
			readonly path: string;
			readonly when: readonly string[];
			readonly policySha256: string;
	  })
	| (SourceDescriptorBase & {
			readonly kind: "pi-skill";
			readonly policyPath?: string;
	  })
	| (SourceDescriptorBase & {
			readonly kind: "pi-context-file";
			readonly path: string;
			readonly contentSha256: string;
	  });
type SourceDescriptorValue =
	| (Omit<SourceDescriptorBase, "descriptorSha256"> & {
			readonly kind: "prepared-reference";
			readonly path: string;
			readonly when: readonly string[];
			readonly policySha256: string;
	  })
	| (Omit<SourceDescriptorBase, "descriptorSha256"> & {
			readonly kind: "pi-skill";
			readonly policyPath?: string;
	  })
	| (Omit<SourceDescriptorBase, "descriptorSha256"> & {
			readonly kind: "pi-context-file";
			readonly path: string;
			readonly contentSha256: string;
	  });

export interface CapabilityDescriptor {
	readonly id: string;
	readonly kind: "pi-tool";
	readonly name: string;
	readonly description: string;
	readonly active: boolean;
	readonly provenance: ContextProvenance;
	readonly descriptorSha256: string;
}

export interface ContextInventory {
	readonly [inventoryBrand]: true;
	readonly sources: readonly ContextSourceDescriptor[];
	readonly capabilities: readonly CapabilityDescriptor[];
	readonly inventorySha256: string;
}

interface ObservedBase {
	readonly id: string;
	readonly contentSha256: string;
	readonly isError: boolean;
	readonly truncated: boolean;
	readonly sequence: number;
	readonly provenance: ContextProvenance;
	readonly descriptorSha256: string;
}
export type ObservedContextEntry =
	| (ObservedBase & {
			readonly kind: "read-result";
			readonly toolCallId: string;
			readonly toolName: string;
			readonly argumentsSha256: string;
			readonly inventorySourceId?: string;
	  })
	| (ObservedBase & {
			readonly kind: "tool-result";
			readonly toolCallId: string;
			readonly toolName: string;
			readonly argumentsSha256: string;
	  })
	| (ObservedBase & {
			readonly kind: "user-explicit";
			readonly userEventId: string;
	  })
	| (ObservedBase & {
			readonly kind: "domain-evidence";
			readonly domainRef: string;
			readonly domainType: string;
			readonly evaluator: Readonly<{ id: string; version: string }>;
	  });
type ObservedContextEntryValue =
	| (Omit<ObservedBase, "descriptorSha256"> & {
			readonly kind: "read-result";
			readonly toolCallId: string;
			readonly toolName: string;
			readonly argumentsSha256: string;
			readonly inventorySourceId?: string;
	  })
	| (Omit<ObservedBase, "descriptorSha256"> & {
			readonly kind: "tool-result";
			readonly toolCallId: string;
			readonly toolName: string;
			readonly argumentsSha256: string;
	  })
	| (Omit<ObservedBase, "descriptorSha256"> & {
			readonly kind: "user-explicit";
			readonly userEventId: string;
	  })
	| (Omit<ObservedBase, "descriptorSha256"> & {
			readonly kind: "domain-evidence";
			readonly domainRef: string;
			readonly domainType: string;
			readonly evaluator: Readonly<{ id: string; version: string }>;
	  });

export interface ObservedContext {
	readonly [observedBrand]: true;
	readonly branchRef: string;
	readonly entries: readonly ObservedContextEntry[];
	readonly observedContextSha256: string;
}

export type ContextNomination =
	| {
			readonly kind: "inventory-source";
			readonly inventorySourceId: string;
			readonly descriptorSha256: string;
			readonly contentSha256?: string;
	  }
	| {
			readonly kind: "observed-context";
			readonly observedContextId: string;
			readonly descriptorSha256: string;
	  };

export interface ContextSelectionProposal {
	readonly [proposalBrand]: true;
	readonly questionSha256: string;
	readonly nominations: readonly ContextNomination[];
	readonly selectionBasis: readonly string[];
}

export interface ContextBinding {
	readonly bindingId: string;
	readonly kind: "inventory-source" | "observed-context";
	readonly memberId: string;
	readonly descriptorSha256: string;
	readonly expectedContentSha256?: string;
}

export interface ContextSelection {
	readonly [selectionBrand]: true;
	readonly judgmentId: string;
	readonly questionSha256: string;
	readonly policySha256?: string;
	readonly observedInventorySha256: string;
	readonly observedContextSha256: string;
	readonly branchRef: string;
	readonly bindings: readonly ContextBinding[];
	readonly selectedSources: readonly ContextSourceDescriptor[];
	readonly selectedObservedContext: readonly ObservedContextEntry[];
	readonly selectionBasis: readonly string[];
	readonly selectionSha256: string;
}

function schemaIssues(schema: TSchema, value: JsonValue) {
	return [...Errors(schema, value)].map((issue) => ({
		path: issue.instancePath || "/",
		message: issue.message,
		keyword: issue.keyword,
	}));
}

export function decodeContextInventoryData(
	value: JsonValue,
): ContextInventoryData {
	try {
		return Parse(ContextInventoryDataSchema, value);
	} catch (error) {
		throw new JudgmentParseError(
			"Context inventory has an invalid representation.",
			{ issues: schemaIssues(ContextInventoryDataSchema, value) },
			{ cause: error },
		);
	}
}
export function decodeObservedContextData(
	value: JsonValue,
): ObservedContextData {
	try {
		return Parse(ObservedContextDataSchema, value);
	} catch (error) {
		throw new JudgmentParseError(
			"Observed context has an invalid representation.",
			{ issues: schemaIssues(ObservedContextDataSchema, value) },
			{ cause: error },
		);
	}
}
export function decodeContextSelectionProposalData(
	value: JsonValue,
): ContextSelectionProposalData {
	try {
		return Parse(ContextSelectionProposalDataSchema, value);
	} catch (error) {
		throw new JudgmentParseError(
			"Context selection proposal has an invalid representation.",
			{ issues: schemaIssues(ContextSelectionProposalDataSchema, value) },
			{ cause: error },
		);
	}
}

function text(value: string, path: string): string {
	if (value !== value.trim() || !value.trim())
		throw new JudgmentParseError(
			`Expected directly normalized non-blank text at ${path}.`,
		);
	return value.replace(/\s+/gu, " ");
}
function uniqueText(
	values: readonly string[],
	path: string,
): readonly string[] {
	const normalized = values.map((value, index) =>
		text(value, `${path}/${index}`),
	);
	const seen = new Set<string>();
	for (const value of normalized) {
		if (seen.has(value))
			throw new JudgmentParseError(`Duplicate value at ${path}: ${value}.`);
		seen.add(value);
	}
	return Object.freeze(
		normalized.toSorted((left, right) => left.localeCompare(right)),
	);
}
function provenance(
	data: ContextProvenanceData,
	path: string,
): ContextProvenance {
	return Object.freeze({
		source: text(data.source, `${path}/source`),
		scope: data.scope,
		origin: data.origin,
		...(data.path ? { path: text(data.path, `${path}/path`) } : {}),
	});
}
function provenanceIdentity(value: ContextProvenance): JsonValue {
	return {
		source: value.source,
		scope: value.scope,
		origin: value.origin,
		...(value.path ? { path: value.path } : {}),
	};
}

function sourceIdentity(
	source: SourceDescriptorValue | ContextSourceDescriptor,
): JsonValue {
	const base = {
		id: source.id,
		kind: source.kind,
		title: source.title,
		description: source.description,
		provenance: provenanceIdentity(source.provenance),
	};
	switch (source.kind) {
		case "prepared-reference":
			return {
				...base,
				path: source.path,
				when: source.when,
				policySha256: source.policySha256,
			};
		case "pi-skill":
			return {
				...base,
				...(source.policyPath ? { policyPath: source.policyPath } : {}),
			};
		case "pi-context-file":
			return {
				...base,
				path: source.path,
				contentSha256: source.contentSha256,
			};
		default:
			return assertNever(source);
	}
}

function parseSource(
	data: ContextSourceDescriptorData,
	index: number,
): ContextSourceDescriptor {
	const path = `/sources/${index}`;
	const base = {
		id: data.id,
		title: text(data.title, `${path}/title`),
		description: text(data.description, `${path}/description`),
		provenance: provenance(data.provenance, `${path}/provenance`),
	};
	let source: SourceDescriptorValue;
	switch (data.kind) {
		case "prepared-reference":
			source = Object.freeze({
				...base,
				kind: data.kind,
				path: text(data.path, `${path}/path`),
				when: uniqueText(data.when, `${path}/when`),
				policySha256: data.policySha256,
			});
			break;
		case "pi-skill":
			source = Object.freeze({
				...base,
				kind: data.kind,
				...(data.policyPath
					? { policyPath: text(data.policyPath, `${path}/policyPath`) }
					: {}),
			});
			break;
		case "pi-context-file":
			source = Object.freeze({
				...base,
				kind: data.kind,
				path: text(data.path, `${path}/path`),
				contentSha256: data.contentSha256,
			});
			break;
		default:
			return assertNever(data);
	}
	const descriptor: ContextSourceDescriptor = {
		...source,
		descriptorSha256: sha256(canonicalJson(sourceIdentity(source))),
	};
	return Object.freeze(descriptor);
}

function capabilityIdentity(
	capability: Omit<CapabilityDescriptor, "descriptorSha256">,
): JsonValue {
	return {
		id: capability.id,
		kind: capability.kind,
		name: capability.name,
		description: capability.description,
		active: capability.active,
		provenance: provenanceIdentity(capability.provenance),
	};
}
function parseCapability(
	data: CapabilityDescriptorData,
	index: number,
): CapabilityDescriptor {
	const value: Omit<CapabilityDescriptor, "descriptorSha256"> = Object.freeze({
		id: data.id,
		kind: "pi-tool",
		name: text(data.name, `/capabilities/${index}/name`),
		description: text(data.description, `/capabilities/${index}/description`),
		active: data.active,
		provenance: provenance(
			data.provenance,
			`/capabilities/${index}/provenance`,
		),
	});
	return Object.freeze({
		...value,
		descriptorSha256: sha256(canonicalJson(capabilityIdentity(value))),
	});
}

export function parseContextInventory(
	data: ContextInventoryData,
): ContextInventory {
	const sources = data.sources
		.map(parseSource)
		.toSorted((left, right) => left.id.localeCompare(right.id));
	const capabilities = data.capabilities
		.map(parseCapability)
		.toSorted((left, right) => left.id.localeCompare(right.id));
	const ids = new Set<string>();
	const physical = new Set<string>();
	for (const source of sources) {
		if (ids.has(source.id))
			throw new JudgmentParseError(
				`Duplicate inventory source ID: ${source.id}.`,
			);
		ids.add(source.id);
		const location =
			source.kind === "pi-skill"
				? (source.provenance.path ?? source.id)
				: source.path;
		const key = `${source.kind}:${source.provenance.source}:${location}`;
		if (physical.has(key))
			throw new JudgmentParseError(
				`Duplicate inventory source provenance: ${key}.`,
			);
		physical.add(key);
	}
	const capabilityIds = new Set<string>();
	for (const capability of capabilities) {
		if (capabilityIds.has(capability.id))
			throw new JudgmentParseError(
				`Duplicate capability ID: ${capability.id}.`,
			);
		capabilityIds.add(capability.id);
	}
	const frozenSources = Object.freeze(sources);
	const frozenCapabilities = Object.freeze(capabilities);
	const inventory: ContextInventory = {
		[inventoryBrand]: true,
		sources: frozenSources,
		capabilities: frozenCapabilities,
		inventorySha256: sha256(
			canonicalJson({
				sources: frozenSources.map((source) => sourceIdentity(source)),
				capabilities: frozenCapabilities.map((capability) =>
					capabilityIdentity(capability),
				),
			}),
		),
	};
	return Object.freeze(inventory);
}

function observedIdentity(
	entry: ObservedContextEntryValue | ObservedContextEntry,
): JsonValue {
	const base = {
		id: entry.id,
		kind: entry.kind,
		contentSha256: entry.contentSha256,
		isError: entry.isError,
		truncated: entry.truncated,
		sequence: entry.sequence,
		provenance: provenanceIdentity(entry.provenance),
	};
	switch (entry.kind) {
		case "read-result":
			return {
				...base,
				toolCallId: entry.toolCallId,
				toolName: entry.toolName,
				argumentsSha256: entry.argumentsSha256,
				...(entry.inventorySourceId
					? { inventorySourceId: entry.inventorySourceId }
					: {}),
			};
		case "tool-result":
			return {
				...base,
				toolCallId: entry.toolCallId,
				toolName: entry.toolName,
				argumentsSha256: entry.argumentsSha256,
			};
		case "user-explicit":
			return { ...base, userEventId: entry.userEventId };
		case "domain-evidence":
			return {
				...base,
				domainRef: entry.domainRef,
				domainType: entry.domainType,
				evaluator: entry.evaluator,
			};
		default:
			return assertNever(entry);
	}
}
function parseObserved(
	data: ObservedContextEntryData,
	index: number,
): ObservedContextEntry {
	const path = `/entries/${index}`;
	const base = {
		id: data.id,
		contentSha256: data.contentSha256,
		isError: data.isError,
		truncated: data.truncated,
		sequence: data.sequence,
		provenance: provenance(data.provenance, `${path}/provenance`),
	};
	let entry: ObservedContextEntryValue;
	switch (data.kind) {
		case "read-result":
			entry = Object.freeze({
				...base,
				kind: data.kind,
				toolCallId: text(data.toolCallId, `${path}/toolCallId`),
				toolName: text(data.toolName, `${path}/toolName`),
				argumentsSha256: data.argumentsSha256,
				...(data.inventorySourceId
					? { inventorySourceId: data.inventorySourceId }
					: {}),
			});
			break;
		case "tool-result":
			entry = Object.freeze({
				...base,
				kind: data.kind,
				toolCallId: text(data.toolCallId, `${path}/toolCallId`),
				toolName: text(data.toolName, `${path}/toolName`),
				argumentsSha256: data.argumentsSha256,
			});
			break;
		case "user-explicit":
			entry = Object.freeze({
				...base,
				kind: data.kind,
				userEventId: text(data.userEventId, `${path}/userEventId`),
			});
			break;
		case "domain-evidence":
			entry = Object.freeze({
				...base,
				kind: data.kind,
				domainRef: text(data.domainRef, `${path}/domainRef`),
				domainType: data.domainType,
				evaluator: Object.freeze({
					id: data.evaluator.id,
					version: text(data.evaluator.version, `${path}/evaluator/version`),
				}),
			});
			break;
		default:
			return assertNever(data);
	}
	const descriptor: ObservedContextEntry = {
		...entry,
		descriptorSha256: sha256(canonicalJson(observedIdentity(entry))),
	};
	return Object.freeze(descriptor);
}
function observedProvenanceKey(entry: ObservedContextEntry): string {
	switch (entry.kind) {
		case "read-result":
		case "tool-result":
			return `tool:${entry.toolCallId}`;
		case "user-explicit":
			return `user:${entry.userEventId}`;
		case "domain-evidence":
			return `domain:${entry.domainRef}`;
		default:
			return assertNever(entry);
	}
}
export function parseObservedContext(
	data: ObservedContextData,
): ObservedContext {
	const entries = data.entries
		.map(parseObserved)
		.toSorted(
			(left, right) =>
				left.sequence - right.sequence || left.id.localeCompare(right.id),
		);
	const ids = new Set<string>();
	const provenanceKeys = new Set<string>();
	const sequences = new Set<number>();
	for (const entry of entries) {
		if (ids.has(entry.id))
			throw new JudgmentParseError(
				`Duplicate observed context ID: ${entry.id}.`,
			);
		if (sequences.has(entry.sequence))
			throw new JudgmentParseError(
				`Duplicate observed context sequence: ${entry.sequence}.`,
			);
		const key = observedProvenanceKey(entry);
		if (provenanceKeys.has(key))
			throw new JudgmentParseError(
				`Duplicate observed context provenance: ${key}.`,
			);
		ids.add(entry.id);
		sequences.add(entry.sequence);
		provenanceKeys.add(key);
	}
	const frozenEntries = Object.freeze(entries);
	const branchRef = text(data.branchRef, "/branchRef");
	const observed: ObservedContext = {
		[observedBrand]: true,
		branchRef,
		entries: frozenEntries,
		observedContextSha256: sha256(
			canonicalJson({
				branchRef,
				entries: frozenEntries.map((entry) => observedIdentity(entry)),
			}),
		),
	};
	return Object.freeze(observed);
}

export function parseContextSelectionProposal(
	data: ContextSelectionProposalData,
): ContextSelectionProposal {
	const nominations = data.nominations
		.map((nomination) => Object.freeze({ ...nomination }))
		.toSorted((left, right) => {
			const leftId =
				left.kind === "inventory-source"
					? left.inventorySourceId
					: left.observedContextId;
			const rightId =
				right.kind === "inventory-source"
					? right.inventorySourceId
					: right.observedContextId;
			return `${left.kind}:${leftId}`.localeCompare(`${right.kind}:${rightId}`);
		});
	const selected = new Set<string>();
	for (const nomination of nominations) {
		const id =
			nomination.kind === "inventory-source"
				? `inventory:${nomination.inventorySourceId}`
				: `observed:${nomination.observedContextId}`;
		if (selected.has(id))
			throw new JudgmentParseError(
				`Context member nominated more than once: ${id}.`,
			);
		selected.add(id);
	}
	const proposal: ContextSelectionProposal = {
		[proposalBrand]: true,
		questionSha256: data.questionSha256,
		nominations: Object.freeze(nominations),
		selectionBasis: uniqueText(data.selectionBasis, "/selectionBasis"),
	};
	return Object.freeze(proposal);
}

function bindingIdentity(binding: ContextBinding): JsonValue {
	return {
		bindingId: binding.bindingId,
		kind: binding.kind,
		memberId: binding.memberId,
		descriptorSha256: binding.descriptorSha256,
		...(binding.expectedContentSha256
			? { expectedContentSha256: binding.expectedContentSha256 }
			: {}),
	};
}

export function selectContext(input: {
	readonly question: DynamicJudgmentQuestion;
	readonly inventory: ContextInventory;
	readonly observedContext: ObservedContext;
	readonly proposal: ContextSelectionProposal;
}): ContextSelection {
	const { question, inventory, observedContext, proposal } = input;
	if (proposal.questionSha256 !== question.questionSha256)
		throw new JudgmentParseError(
			"Context selection proposal names another dynamic question.",
		);
	if (observedContext.branchRef !== question.branchRef)
		throw new JudgmentParseError("Observed context belongs to another branch.");
	const inventoryById = new Map(
		inventory.sources.map((source) => [source.id, source]),
	);
	const observedById = new Map(
		observedContext.entries.map((entry) => [entry.id, entry]),
	);
	const bindings: ContextBinding[] = [];
	const selectedSources: ContextSourceDescriptor[] = [];
	const selectedObserved: ObservedContextEntry[] = [];
	for (const nomination of proposal.nominations) {
		if (nomination.kind === "inventory-source") {
			const source = inventoryById.get(nomination.inventorySourceId);
			if (!source)
				throw new JudgmentParseError(
					`Unknown inventory source: ${nomination.inventorySourceId}.`,
				);
			if (source.descriptorSha256 !== nomination.descriptorSha256)
				throw new JudgmentParseError(
					`Selected inventory source changed: ${source.id}.`,
				);
			if (
				source.kind === "prepared-reference" &&
				source.policySha256 !== question.policySha256
			)
				throw new JudgmentParseError(
					`Prepared reference belongs to another policy: ${source.id}.`,
				);
			let expectedContentSha256: string | undefined;
			if (source.kind === "prepared-reference") {
				if (!nomination.contentSha256)
					throw new JudgmentParseError(
						`Selected prepared reference requires a content digest: ${source.id}.`,
					);
				expectedContentSha256 = nomination.contentSha256;
			} else if (source.kind === "pi-context-file") {
				if (
					nomination.contentSha256 &&
					nomination.contentSha256 !== source.contentSha256
				)
					throw new JudgmentParseError(
						`Pi context-file nomination has a conflicting content digest: ${source.id}.`,
					);
				expectedContentSha256 = source.contentSha256;
			} else if (nomination.contentSha256)
				throw new JudgmentParseError(
					`Pi skill metadata nomination cannot claim loaded content: ${source.id}.`,
				);
			selectedSources.push(source);
			bindings.push(
				Object.freeze({
					bindingId: `inventory-source:${source.id}`,
					kind: "inventory-source",
					memberId: source.id,
					descriptorSha256: source.descriptorSha256,
					...(expectedContentSha256 ? { expectedContentSha256 } : {}),
				}),
			);
			continue;
		}
		const entry = observedById.get(nomination.observedContextId);
		if (!entry)
			throw new JudgmentParseError(
				`Unknown observed context: ${nomination.observedContextId}.`,
			);
		if (entry.descriptorSha256 !== nomination.descriptorSha256)
			throw new JudgmentParseError(
				`Selected observed context changed: ${entry.id}.`,
			);
		if (entry.isError || entry.truncated)
			throw new JudgmentParseError(
				`Error or truncated context cannot be selected: ${entry.id}.`,
			);
		selectedObserved.push(entry);
		bindings.push(
			Object.freeze({
				bindingId: `observed-context:${entry.id}`,
				kind: "observed-context",
				memberId: entry.id,
				descriptorSha256: entry.descriptorSha256,
				expectedContentSha256: entry.contentSha256,
			}),
		);
	}
	bindings.sort((left, right) => left.bindingId.localeCompare(right.bindingId));
	selectedSources.sort((left, right) => left.id.localeCompare(right.id));
	selectedObserved.sort((left, right) => left.id.localeCompare(right.id));
	const frozenBindings = Object.freeze(bindings);
	const frozenSources = Object.freeze(selectedSources);
	const frozenObserved = Object.freeze(selectedObserved);
	const selectionSha256 = sha256(
		canonicalJson({
			judgmentId: question.judgmentId,
			questionSha256: question.questionSha256,
			...(question.policySha256 ? { policySha256: question.policySha256 } : {}),
			bindings: frozenBindings.map(bindingIdentity),
			selectedSources: frozenSources.map((source) => sourceIdentity(source)),
			selectedObservedContext: frozenObserved.map((entry) =>
				observedIdentity(entry),
			),
			selectionBasis: proposal.selectionBasis,
		}),
	);
	const selection: ContextSelection = {
		[selectionBrand]: true,
		judgmentId: question.judgmentId,
		questionSha256: question.questionSha256,
		...(question.policySha256 ? { policySha256: question.policySha256 } : {}),
		observedInventorySha256: inventory.inventorySha256,
		observedContextSha256: observedContext.observedContextSha256,
		branchRef: observedContext.branchRef,
		bindings: frozenBindings,
		selectedSources: frozenSources,
		selectedObservedContext: frozenObserved,
		selectionBasis: proposal.selectionBasis,
		selectionSha256,
	};
	return Object.freeze(selection);
}

function assertNever(value: never): never {
	throw new JudgmentParseError(
		`Unsupported context variant: ${JSON.stringify(value)}.`,
	);
}
