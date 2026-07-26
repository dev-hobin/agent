import {
	decodeObserverMarkdown,
	sortAndBoundObserverDiagnostics,
	type DecodedObserverDocument,
	type LineageRef,
	type LineageType,
	type MarkdownInput,
	type ObserverDiagnostic,
	type ObserverDiagnosticCode,
} from "./markdown-profile.ts";

export type ObserverNotebookValidation =
	| {
			readonly ok: true;
			readonly graphEvaluated: true;
			readonly records: readonly DecodedObserverDocument[];
			readonly diagnostics: readonly [];
	  }
	| {
			readonly ok: false;
			readonly graphEvaluated: false;
			readonly phase: "record";
			readonly diagnostics: readonly ObserverDiagnostic[];
	  }
	| {
			readonly ok: false;
			readonly graphEvaluated: true;
			readonly phase: "graph";
			readonly diagnostics: readonly ObserverDiagnostic[];
	  };

interface IndexedDocuments {
	readonly ordered: readonly DecodedObserverDocument[];
	readonly byId: ReadonlyMap<string, DecodedObserverDocument>;
	readonly diagnostics: readonly ObserverDiagnostic[];
}

interface GraphDiagnosticInput {
	readonly document: DecodedObserverDocument;
	readonly code: ObserverDiagnosticCode;
	readonly message: string;
	readonly pointer?: string;
	readonly relatedId?: string;
}

const SAME_TYPE_LINEAGE: ReadonlySet<LineageType> = new Set([
	"merged_from",
	"split_from",
	"supersedes",
]);

function graphDiagnostic({
	document,
	code,
	message,
	pointer,
	relatedId,
}: GraphDiagnosticInput): ObserverDiagnostic {
	return {
		phase: "graph",
		code,
		path: document.path,
		recordId: document.record.id,
		pointer,
		relatedId,
		message,
	};
}

function indexDocuments(
	documents: readonly DecodedObserverDocument[],
): IndexedDocuments {
	const ordered = [...documents].sort((left, right) =>
		left.path.localeCompare(right.path),
	);
	const byId = new Map<string, DecodedObserverDocument>();
	const diagnostics: ObserverDiagnostic[] = [];
	for (const document of ordered) {
		const existing = byId.get(document.record.id);
		if (existing) {
			diagnostics.push(
				graphDiagnostic({
					document,
					code: "graph.id.duplicate",
					message: `Record ID duplicates ${existing.path}.`,
					relatedId: document.record.id,
					pointer: "/id",
				}),
			);
			continue;
		}
		byId.set(document.record.id, document);
	}
	return { ordered, byId, diagnostics };
}

function sourceReferenceDiagnostics(
	document: DecodedObserverDocument,
	byId: ReadonlyMap<string, DecodedObserverDocument>,
): ObserverDiagnostic[] {
	const diagnostics: ObserverDiagnostic[] = [];
	for (const [position, source] of document.record.sources.entries()) {
		const pointer = `/sources/${position}/record`;
		if (source.record === document.record.id) {
			diagnostics.push(
				graphDiagnostic({
					document,
					code: "graph.edge.self",
					message: "A source reference cannot target its owning record.",
					pointer,
					relatedId: source.record,
				}),
			);
		}
		if (!byId.has(source.record)) {
			diagnostics.push(
				graphDiagnostic({
					document,
					code: "graph.target.missing",
					message: `Source target ${source.record} does not exist.`,
					pointer,
					relatedId: source.record,
				}),
			);
		}
	}
	return diagnostics;
}

function lineageTypeViolation(
	document: DecodedObserverDocument,
	lineage: LineageRef,
	target: DecodedObserverDocument,
): { readonly code: ObserverDiagnosticCode; readonly message: string } | null {
	if (lineage.type === "promoted_from") {
		if (
			document.record.observer_type !== "zettel" ||
			target.record.observer_type !== "memo" ||
			target.record.observer_status !== "promoted"
		) {
			return {
				code: "graph.promotion.mismatch",
				message:
					"promoted_from must connect a Zettel to a promoted Memo.",
			};
		}
		return null;
	}
	if (
		SAME_TYPE_LINEAGE.has(lineage.type) &&
		document.record.observer_type !== target.record.observer_type
	) {
		return {
			code: "graph.lineage.type-mismatch",
			message: `${lineage.type} must target a record with the owner's type.`,
		};
	}
	return null;
}

function lineageDiagnostics(
	document: DecodedObserverDocument,
	byId: ReadonlyMap<string, DecodedObserverDocument>,
): ObserverDiagnostic[] {
	const diagnostics: ObserverDiagnostic[] = [];
	for (const [position, lineage] of document.record.lineage.entries()) {
		const pointer = `/lineage/${position}/target`;
		if (lineage.target === document.record.id) {
			diagnostics.push(
				graphDiagnostic({
					document,
					code: "graph.edge.self",
					message: "A lineage edge cannot target its owning record.",
					pointer,
					relatedId: lineage.target,
				}),
			);
		}
		const target = byId.get(lineage.target);
		if (!target) {
			diagnostics.push(
				graphDiagnostic({
					document,
					code: "graph.target.missing",
					message: `Lineage target ${lineage.target} does not exist.`,
					pointer,
					relatedId: lineage.target,
				}),
			);
			continue;
		}
		const violation = lineageTypeViolation(document, lineage, target);
		if (violation) {
			diagnostics.push(
				graphDiagnostic({
					document,
					...violation,
					pointer,
					relatedId: lineage.target,
				}),
			);
		}
	}
	return diagnostics;
}

function semanticRelationDiagnostics(
	document: DecodedObserverDocument,
	byId: ReadonlyMap<string, DecodedObserverDocument>,
): ObserverDiagnostic[] {
	const diagnostics: ObserverDiagnostic[] = [];
	for (const [position, relation] of document.record.relations.entries()) {
		const pointer = `/relations/${position}/target`;
		if (relation.target === document.record.id) {
			diagnostics.push(
				graphDiagnostic({
					document,
					code: "graph.edge.self",
					message: "A semantic relation cannot target its owning record.",
					pointer,
					relatedId: relation.target,
				}),
			);
		}
		if (!byId.has(relation.target)) {
			diagnostics.push(
				graphDiagnostic({
					document,
					code: "graph.target.missing",
					message: `Relation target ${relation.target} does not exist.`,
					pointer,
					relatedId: relation.target,
				}),
			);
		}
	}
	return diagnostics;
}

function duplicateEdgeDiagnostics<Value>(
	document: DecodedObserverDocument,
	family: "sources" | "lineage" | "relations",
	values: readonly Value[],
	identity: (value: Value) => string,
): ObserverDiagnostic[] {
	const diagnostics: ObserverDiagnostic[] = [];
	const seen = new Set<string>();
	for (const [position, value] of values.entries()) {
		const key = identity(value);
		if (seen.has(key)) {
			diagnostics.push(
				graphDiagnostic({
					document,
					code: "graph.edge.duplicate",
					message: `Duplicate ${family} edge.`,
					pointer: `/${family}/${position}`,
				}),
			);
			continue;
		}
		seen.add(key);
	}
	return diagnostics;
}

function allDuplicateEdgeDiagnostics(
	document: DecodedObserverDocument,
): ObserverDiagnostic[] {
	return [
		...duplicateEdgeDiagnostics(
			document,
			"sources",
			document.record.sources,
			(source) =>
				JSON.stringify([source.record, source.role, source.locator ?? null]),
		),
		...duplicateEdgeDiagnostics(
			document,
			"lineage",
			document.record.lineage,
			(lineage) => JSON.stringify([lineage.type, lineage.target]),
		),
		...duplicateEdgeDiagnostics(
			document,
			"relations",
			document.record.relations,
			(relation) => JSON.stringify([relation.type, relation.target]),
		),
	];
}

function recordIntegrityDiagnostics(
	document: DecodedObserverDocument,
	byId: ReadonlyMap<string, DecodedObserverDocument>,
): ObserverDiagnostic[] {
	const { record } = document;
	if (record.observer_type === "memo") {
		const hasInquiryLineage = record.lineage.some(
			(lineage) =>
				byId.get(lineage.target)?.record.observer_type === "inquiry",
		);
		if (record.sources.length === 0 && !hasInquiryLineage) {
			return [
				graphDiagnostic({
					document,
					code: "graph.memo.orphan",
					message:
						"A Memo requires a Source reference or lineage to an Inquiry.",
				}),
			];
		}
	}
	if (record.observer_type === "zettel") {
		const hasDirectSource = record.sources.some(
			(source) =>
				byId.get(source.record)?.record.observer_type === "source",
		);
		if (!hasDirectSource) {
			return [
				graphDiagnostic({
					document,
					code: "graph.zettel.source-required",
					message: "A Zettel requires a direct Source reference.",
				}),
			];
		}
	}
	return [];
}

function promotedMemoBacklinkDiagnostics(
	documents: readonly DecodedObserverDocument[],
): ObserverDiagnostic[] {
	const diagnostics: ObserverDiagnostic[] = [];
	for (const document of documents) {
		if (
			document.record.observer_type !== "memo" ||
			document.record.observer_status !== "promoted"
		) {
			continue;
		}
		const hasPromotedZettel = documents.some(
			(candidate) =>
				candidate.record.observer_type === "zettel" &&
				candidate.record.lineage.some(
					(lineage) =>
						lineage.type === "promoted_from" &&
						lineage.target === document.record.id,
				),
		);
		if (!hasPromotedZettel) {
			diagnostics.push(
				graphDiagnostic({
					document,
					code: "graph.promotion.mismatch",
					message: "A promoted Memo requires a Zettel promoted from it.",
				}),
			);
		}
	}
	return diagnostics;
}

function graphFailure(
	diagnostics: readonly ObserverDiagnostic[],
): ObserverNotebookValidation {
	return {
		ok: false,
		graphEvaluated: true,
		phase: "graph",
		diagnostics: sortAndBoundObserverDiagnostics(diagnostics),
	};
}

/** Validate graph invariants after every document has passed Phase A. */
export function validateObserverGraph(
	documents: readonly DecodedObserverDocument[],
): ObserverNotebookValidation {
	const indexed = indexDocuments(documents);
	if (indexed.diagnostics.length > 0) {
		return graphFailure(indexed.diagnostics);
	}

	const diagnostics: ObserverDiagnostic[] = [];
	for (const document of indexed.ordered) {
		diagnostics.push(
			...sourceReferenceDiagnostics(document, indexed.byId),
			...lineageDiagnostics(document, indexed.byId),
			...semanticRelationDiagnostics(document, indexed.byId),
			...allDuplicateEdgeDiagnostics(document),
			...recordIntegrityDiagnostics(document, indexed.byId),
		);
	}
	diagnostics.push(...promotedMemoBacklinkDiagnostics(indexed.ordered));
	if (diagnostics.length > 0) return graphFailure(diagnostics);
	return {
		ok: true,
		graphEvaluated: true,
		records: indexed.ordered,
		diagnostics: [],
	};
}

/** Decode hostile Markdown inputs before evaluating notebook graph invariants. */
export function validateObserverNotebook(
	inputs: readonly MarkdownInput[],
): ObserverNotebookValidation {
	const records: DecodedObserverDocument[] = [];
	const diagnostics: ObserverDiagnostic[] = [];
	for (const input of inputs) {
		const result = decodeObserverMarkdown(input);
		if (result.ok) records.push(result.value);
		else diagnostics.push(...result.diagnostics);
	}
	if (diagnostics.length > 0) {
		return {
			ok: false,
			graphEvaluated: false,
			phase: "record",
			diagnostics: sortAndBoundObserverDiagnostics(diagnostics),
		};
	}
	return validateObserverGraph(records);
}
