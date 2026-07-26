import Ajv2020, { type ErrorObject } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { parseDocument } from "yaml";
import recordSchema from "../schemas/observer-record.v1.schema.json" with {
	type: "json",
};

export const OBSERVER_RECORD_SCHEMA: "observer-record/v1" =
	"observer-record/v1";
export const MAX_OBSERVER_DIAGNOSTICS = 100;

export type ObserverRecordType = "source" | "inquiry" | "memo" | "zettel";
export type ObserverRecordId = `${ObserverRecordType}-${string}`;
export type SourceKind = "external-material" | "direct-observation";
export type SourceInfluenceRole =
	| "supports"
	| "challenges"
	| "context"
	| "example";
export type LineageType =
	| "derived_from"
	| "promoted_from"
	| "merged_from"
	| "split_from"
	| "supersedes";
export type SemanticRelationType =
	| "supports"
	| "contradicts"
	| "refines"
	| "extends"
	| "applies_to"
	| "distinguishes"
	| "alternative_to"
	| "related";

export interface SourceRef {
	readonly record: `source-${string}`;
	readonly locator?: string;
	readonly role: SourceInfluenceRole;
}

export interface LineageRef {
	readonly type: LineageType;
	readonly target: ObserverRecordId;
}

export interface SemanticRelation {
	readonly type: SemanticRelationType;
	readonly target: ObserverRecordId;
}

interface CommonObserverRecord<
	Type extends ObserverRecordType,
	Status extends string,
> {
	readonly observer_schema: typeof OBSERVER_RECORD_SCHEMA;
	readonly observer_type: Type;
	readonly observer_status: Status;
	readonly id: `${Type}-${string}`;
	readonly title: string;
	readonly lang: string;
	readonly created: string;
	readonly modified: string;
	readonly tags: readonly string[];
	readonly aliases: readonly string[];
	readonly sources: readonly SourceRef[];
	readonly lineage: readonly LineageRef[];
	readonly relations: readonly SemanticRelation[];
}

interface ExternalMaterialFacts {
	readonly uri?: string;
	readonly revision?: string;
	readonly content_hash?: string;
	readonly retrieval_context?: string;
}

interface DirectObservationFacts {
	readonly observed_at: string;
	readonly observed_by: string;
	readonly fact: string;
	readonly conditions: string;
	readonly interpretation_boundary: string;
}

export type SourceRecord =
	| (CommonObserverRecord<
			"source",
			"available" | "unavailable" | "superseded"
	  > & {
			readonly source_kind: "external-material";
			readonly external: ExternalMaterialFacts;
	  })
	| (CommonObserverRecord<
			"source",
			"available" | "unavailable" | "superseded"
	  > & {
			readonly source_kind: "direct-observation";
			readonly observation: DirectObservationFacts;
	  });

export interface InquiryFacts {
	readonly origin: "user" | "observer";
	readonly original: string;
	readonly current: string;
	readonly revision_reason?: string;
}

export type InquiryRecord = CommonObserverRecord<
	"inquiry",
	"open" | "dormant" | "resolved" | "retired"
> & {
	readonly inquiry: InquiryFacts;
};

export type MemoRecord = CommonObserverRecord<
	"memo",
	"incubating" | "promoted" | "superseded" | "retired"
>;

export type ZettelRecord = CommonObserverRecord<
	"zettel",
	"mature" | "superseded" | "retired"
>;

export type ObserverRecord =
	| SourceRecord
	| InquiryRecord
	| MemoRecord
	| ZettelRecord;

export interface MarkdownInput {
	readonly path: string;
	readonly content: string;
}

export interface DecodedObserverDocument {
	readonly path: string;
	readonly record: ObserverRecord;
	readonly frontmatter: Readonly<Record<string, unknown>>;
	readonly h1: string;
	readonly body: string;
}

export type ObserverValidationPhase =
	| "markdown"
	| "schema"
	| "record"
	| "graph";

export type ObserverDiagnosticCode =
	| "markdown.frontmatter.missing"
	| "markdown.frontmatter.invalid"
	| "markdown.h1.missing"
	| "markdown.h1.multiple"
	| "markdown.body.empty"
	| "schema.unsupported-version"
	| "schema.invalid"
	| "record.id-prefix"
	| "record.timestamp-order"
	| "record.inquiry-revision-reason"
	| "graph.id.duplicate"
	| "graph.target.missing"
	| "graph.edge.self"
	| "graph.edge.duplicate"
	| "graph.lineage.type-mismatch"
	| "graph.memo.orphan"
	| "graph.zettel.source-required"
	| "graph.promotion.mismatch";

export interface ObserverDiagnostic {
	readonly phase: ObserverValidationPhase;
	readonly code: ObserverDiagnosticCode;
	readonly path: string;
	readonly recordId?: string;
	readonly pointer?: string;
	readonly relatedId?: string;
	readonly message: string;
}

export type ObserverRecordDecodeResult =
	| {
			readonly ok: true;
			readonly value: DecodedObserverDocument;
			readonly diagnostics: readonly [];
	  }
	| {
			readonly ok: false;
			readonly diagnostics: readonly ObserverDiagnostic[];
	  };

type ObserverRecordDecodeFailure = Extract<
	ObserverRecordDecodeResult,
	{ readonly ok: false }
>;

type PhaseAResult<Value> =
	| { readonly ok: true; readonly value: Value }
	| ObserverRecordDecodeFailure;

interface MarkdownSections {
	readonly frontmatterText: string;
	readonly markdownLines: readonly string[];
}

interface MarkdownBody {
	readonly h1: string;
	readonly body: string;
}

interface MarkdownEnvelope extends MarkdownBody {
	readonly frontmatter: Record<string, unknown>;
}

const PHASE_ORDER: Record<ObserverValidationPhase, number> = {
	markdown: 0,
	schema: 1,
	record: 2,
	graph: 3,
};

function isBcp47(value: string): boolean {
	try {
		return Intl.getCanonicalLocales(value).length === 1;
	} catch {
		return false;
	}
}

const ajv = new Ajv2020({
	allErrors: true,
	strict: true,
	strictRequired: false,
});
addFormats(ajv);
ajv.addFormat("bcp47", { type: "string", validate: isBcp47 });
const validateFrontmatter = ajv.compile<ObserverRecord>(recordSchema);

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return (
		typeof value === "object" &&
		value !== null &&
		!Array.isArray(value) &&
		(Object.getPrototypeOf(value) === Object.prototype ||
			Object.getPrototypeOf(value) === null)
	);
}

interface ObserverDiagnosticInput {
	readonly input: MarkdownInput;
	readonly phase: ObserverValidationPhase;
	readonly code: ObserverDiagnosticCode;
	readonly message: string;
	readonly recordId?: string;
	readonly pointer?: string;
	readonly relatedId?: string;
}

function diagnostic({
	input,
	phase,
	code,
	message,
	recordId,
	pointer,
	relatedId,
}: ObserverDiagnosticInput): ObserverDiagnostic {
	return {
		phase,
		code,
		path: input.path,
		recordId,
		pointer,
		relatedId,
		message,
	};
}

export function sortAndBoundObserverDiagnostics(
	diagnostics: readonly ObserverDiagnostic[],
): readonly ObserverDiagnostic[] {
	return [...diagnostics]
		.sort(
			(left, right) =>
				left.path.localeCompare(right.path) ||
				PHASE_ORDER[left.phase] - PHASE_ORDER[right.phase] ||
				(left.pointer ?? "").localeCompare(right.pointer ?? "") ||
				left.code.localeCompare(right.code) ||
				(left.relatedId ?? "").localeCompare(right.relatedId ?? ""),
		)
		.slice(0, MAX_OBSERVER_DIAGNOSTICS);
}

function markdownFailure(
	input: MarkdownInput,
	code: ObserverDiagnosticCode,
	message: string,
): ObserverRecordDecodeFailure {
	return {
		ok: false,
		diagnostics: [diagnostic({ input, phase: "markdown", code, message })],
	};
}

function fenceMarker(line: string): { character: "`" | "~"; size: number } | null {
	const match = /^ {0,3}(`{3,}|~{3,})/.exec(line);
	if (!match) return null;
	const marker = match[1];
	return {
		character: marker.startsWith("`") ? "`" : "~",
		size: marker.length,
	};
}

function closingFenceMarker(
	line: string,
): { character: "`" | "~"; size: number } | null {
	const match = /^ {0,3}(`{3,}|~{3,})\s*$/.exec(line);
	if (!match) return null;
	const marker = match[1];
	return {
		character: marker.startsWith("`") ? "`" : "~",
		size: marker.length,
	};
}

function splitMarkdownSections(
	input: MarkdownInput,
): PhaseAResult<MarkdownSections> {
	const lines = input.content.replace(/\r\n?/g, "\n").split("\n");
	if (lines[0] !== "---") {
		return markdownFailure(
			input,
			"markdown.frontmatter.missing",
			"Observer Markdown must start with a YAML frontmatter delimiter.",
		);
	}
	const closingIndex = lines.findIndex(
		(line, index) => index > 0 && line === "---",
	);
	if (closingIndex === -1) {
		return markdownFailure(
			input,
			"markdown.frontmatter.missing",
			"Observer Markdown is missing the closing YAML frontmatter delimiter.",
		);
	}
	return {
		ok: true,
		value: {
			frontmatterText: lines.slice(1, closingIndex).join("\n"),
			markdownLines: lines.slice(closingIndex + 1),
		},
	};
}

function parseYamlFrontmatter(
	input: MarkdownInput,
	frontmatterText: string,
): PhaseAResult<Record<string, unknown>> {
	let value: unknown;
	try {
		const yamlDocument = parseDocument(frontmatterText, {
			merge: false,
			prettyErrors: false,
			schema: "core",
			uniqueKeys: true,
		});
		if (yamlDocument.errors.length > 0) {
			return markdownFailure(
				input,
				"markdown.frontmatter.invalid",
				yamlDocument.errors[0]?.message ?? "Invalid YAML frontmatter.",
			);
		}
		value = yamlDocument.toJS({ maxAliasCount: 0 });
	} catch (error) {
		return markdownFailure(
			input,
			"markdown.frontmatter.invalid",
			error instanceof Error ? error.message : String(error),
		);
	}
	if (isPlainObject(value)) return { ok: true, value };
	return markdownFailure(
		input,
		"markdown.frontmatter.invalid",
		"YAML frontmatter must decode to one object.",
	);
}

function hasAdditionalDocumentH1(lines: readonly string[]): boolean {
	let openFence: { character: "`" | "~"; size: number } | null = null;
	for (const line of lines) {
		const marker = fenceMarker(line);
		if (!marker) {
			if (!openFence && /^#\s+\S/.test(line)) return true;
			continue;
		}
		if (!openFence) {
			openFence = marker;
			continue;
		}
		const closingMarker = closingFenceMarker(line);
		if (
			closingMarker?.character === openFence.character &&
			closingMarker.size >= openFence.size
		) {
			openFence = null;
		}
	}
	return false;
}

function parseMarkdownBody(
	input: MarkdownInput,
	markdownLines: readonly string[],
): PhaseAResult<MarkdownBody> {
	const firstContentIndex = markdownLines.findIndex((line) => line.trim() !== "");
	if (firstContentIndex === -1) {
		return markdownFailure(
			input,
			"markdown.h1.missing",
			"Observer Markdown requires an ATX H1 after frontmatter.",
		);
	}
	const h1Match = /^#\s+(.+?)\s*$/.exec(markdownLines[firstContentIndex]);
	if (!h1Match || h1Match[1].trim() === "") {
		return markdownFailure(
			input,
			"markdown.h1.missing",
			"The first non-blank Markdown line must be a non-empty ATX H1.",
		);
	}
	const bodyLines = markdownLines.slice(firstContentIndex + 1);
	if (hasAdditionalDocumentH1(bodyLines)) {
		return markdownFailure(
			input,
			"markdown.h1.multiple",
			"Observer Markdown permits exactly one ATX H1 outside fenced code.",
		);
	}
	const body = bodyLines.join("\n").trim();
	if (body === "") {
		return markdownFailure(
			input,
			"markdown.body.empty",
			"Observer Markdown requires non-empty content after its H1.",
		);
	}
	return { ok: true, value: { h1: h1Match[1].trim(), body } };
}

function parseMarkdownEnvelope(
	input: MarkdownInput,
): MarkdownEnvelope | ObserverRecordDecodeFailure {
	const sections = splitMarkdownSections(input);
	if (!sections.ok) return sections;
	const frontmatter = parseYamlFrontmatter(
		input,
		sections.value.frontmatterText,
	);
	if (!frontmatter.ok) return frontmatter;
	const markdownBody = parseMarkdownBody(input, sections.value.markdownLines);
	if (!markdownBody.ok) return markdownBody;
	return { frontmatter: frontmatter.value, ...markdownBody.value };
}

function ajvDiagnostic(
	input: MarkdownInput,
	error: ErrorObject,
	recordId: string | undefined,
): ObserverDiagnostic {
	const propertyName =
		"propertyName" in error.params &&
		typeof error.params.propertyName === "string"
			? error.params.propertyName
			: undefined;
	const pointer = propertyName
		? `${error.instancePath}/${propertyName}`
		: error.instancePath || undefined;
	return diagnostic({
		input,
		phase: "schema",
		code: "schema.invalid",
		message: `${pointer ?? "/"} ${error.message ?? "violates the v1 schema"}`,
		recordId,
		pointer,
	});
}

function localRecordDiagnostics(
	input: MarkdownInput,
	record: ObserverRecord,
): ObserverDiagnostic[] {
	const diagnostics: ObserverDiagnostic[] = [];
	if (!record.id.startsWith(`${record.observer_type}-`)) {
		diagnostics.push(
			diagnostic({
				input,
				phase: "record",
				code: "record.id-prefix",
				message: `Record ID must start with ${record.observer_type}-.`,
				recordId: record.id,
				pointer: "/id",
			}),
		);
	}

	const created = Date.parse(record.created);
	const modified = Date.parse(record.modified);
	if (created > modified) {
		diagnostics.push(
			diagnostic({
				input,
				phase: "record",
				code: "record.timestamp-order",
				message:
					"Record modified timestamp must not precede created timestamp.",
				recordId: record.id,
				pointer: "/modified",
			}),
		);
	}

	if (
		record.observer_type === "inquiry" &&
		record.inquiry.current !== record.inquiry.original &&
		(record.inquiry.revision_reason === undefined ||
			record.inquiry.revision_reason.trim() === "")
	) {
		diagnostics.push(
			diagnostic({
				input,
				phase: "record",
				code: "record.inquiry-revision-reason",
				message: "A changed inquiry hypothesis requires revision_reason.",
				recordId: record.id,
				pointer: "/inquiry/revision_reason",
			}),
		);
	}
	return diagnostics;
}

export function decodeObserverMarkdown(
	input: MarkdownInput,
): ObserverRecordDecodeResult {
	const envelope = parseMarkdownEnvelope(input);
	if ("ok" in envelope) return envelope;

	const { frontmatter } = envelope;
	const version = frontmatter.observer_schema;
	if (version !== undefined && version !== OBSERVER_RECORD_SCHEMA) {
		return {
			ok: false,
			diagnostics: [
				diagnostic({
					input,
					phase: "schema",
					code: "schema.unsupported-version",
					message: `Unsupported Observer schema: ${String(version)}.`,
					recordId:
						typeof frontmatter.id === "string"
							? frontmatter.id
							: undefined,
					pointer: "/observer_schema",
				}),
			],
		};
	}

	if (!validateFrontmatter(frontmatter)) {
		const recordId =
			typeof frontmatter.id === "string" ? frontmatter.id : undefined;
		return {
			ok: false,
			diagnostics: sortAndBoundObserverDiagnostics(
				(validateFrontmatter.errors ?? []).map((error: ErrorObject) =>
					ajvDiagnostic(input, error, recordId),
				),
			),
		};
	}

	const localDiagnostics = localRecordDiagnostics(input, frontmatter);
	if (localDiagnostics.length > 0) {
		return {
			ok: false,
			diagnostics: sortAndBoundObserverDiagnostics(localDiagnostics),
		};
	}

	const frozenFrontmatter = Object.freeze(frontmatter);
	return {
		ok: true,
		value: {
			path: input.path,
			record: frozenFrontmatter,
			frontmatter: frozenFrontmatter,
			h1: envelope.h1,
			body: envelope.body,
		},
		diagnostics: [],
	};
}
