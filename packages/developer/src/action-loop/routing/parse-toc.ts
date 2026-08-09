export const SKILL_TOC_SCHEMA_URI =
	"https://raw.githubusercontent.com/dev-hobin/agent/main/schemas/skill-toc-v0.1.schema.json";

export const MAX_TOC_BYTES = 64 * 1024;

export interface ParsedTocReference {
	readonly path: string;
	readonly when: readonly string[];
}

export interface ParsedToc {
	readonly schema: typeof SKILL_TOC_SCHEMA_URI;
	readonly when: readonly string[];
	readonly unless: readonly string[];
	readonly references: readonly ParsedTocReference[];
}

export type TocParseErrorCode =
	| "too-large"
	| "invalid-utf8"
	| "invalid-json"
	| "expected-object"
	| "unknown-field"
	| "missing-field"
	| "schema-mismatch"
	| "expected-array"
	| "empty-list"
	| "expected-string"
	| "empty-string"
	| "duplicate-value"
	| "invalid-reference-path"
	| "duplicate-reference";

export interface TocParseError {
	readonly code: TocParseErrorCode;
	readonly path: string;
	readonly message: string;
}

export interface TocParseSuccess {
	readonly ok: true;
	readonly value: ParsedToc;
}

export interface TocParseFailure {
	readonly ok: false;
	readonly error: TocParseError;
}

export type TocParseResult = TocParseSuccess | TocParseFailure;

type ParseStep<T> = { readonly ok: true; readonly value: T } | TocParseFailure;
type JsonObject = Record<string, unknown>;

function failure(
	code: TocParseErrorCode,
	path: string,
	message: string,
): TocParseFailure {
	return { ok: false, error: { code, path, message } };
}

function isObject(value: unknown): value is JsonObject {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function checkFields(
	value: JsonObject,
	path: string,
	allowed: readonly string[],
	required: readonly string[],
): TocParseFailure | undefined {
	const allowedFields = new Set(allowed);
	for (const field of Object.keys(value)) {
		if (!allowedFields.has(field)) {
			return failure(
				"unknown-field",
				path === "$" ? `$.${field}` : `${path}.${field}`,
				`Unknown field ${field}`,
			);
		}
	}
	for (const field of required) {
		if (!Object.hasOwn(value, field)) {
			return failure(
				"missing-field",
				path === "$" ? `$.${field}` : `${path}.${field}`,
				`Missing required field ${field}`,
			);
		}
	}
	return undefined;
}

function parseConditions(
	value: unknown,
	path: string,
): ParseStep<readonly string[]> {
	if (!Array.isArray(value)) {
		return failure("expected-array", path, "Expected an array of conditions");
	}
	if (value.length === 0) {
		return failure("empty-list", path, "Expected at least one condition");
	}
	const conditions: string[] = [];
	const seen = new Set<string>();
	for (let index = 0; index < value.length; index += 1) {
		const condition = value[index];
		const conditionPath = `${path}[${index}]`;
		if (typeof condition !== "string") {
			return failure(
				"expected-string",
				conditionPath,
				"Expected a condition string",
			);
		}
		const normalized = condition.trim();
		if (normalized.length === 0) {
			return failure(
				"empty-string",
				conditionPath,
				"Condition must not be blank",
			);
		}
		if (seen.has(normalized)) {
			return failure(
				"duplicate-value",
				conditionPath,
				"Condition duplicates an earlier normalized value",
			);
		}
		seen.add(normalized);
		conditions.push(normalized);
	}
	return { ok: true, value: Object.freeze(conditions) };
}

function isNormalizedReferencePath(path: string): boolean {
	if (
		path.length === 0 ||
		path !== path.trim() ||
		path.startsWith("/") ||
		/^[A-Za-z]:/.test(path) ||
		path.includes("\\") ||
		path.includes("\0")
	) {
		return false;
	}
	const segments = path.split("/");
	return segments.every(
		(segment) => segment.length > 0 && segment !== "." && segment !== "..",
	);
}

function parseReference(
	value: unknown,
	index: number,
): ParseStep<ParsedTocReference> {
	const path = `$.references[${index}]`;
	if (!isObject(value)) {
		return failure("expected-object", path, "Expected a Reference object");
	}
	const fieldFailure = checkFields(
		value,
		path,
		["path", "when"],
		["path", "when"],
	);
	if (fieldFailure !== undefined) return fieldFailure;
	if (typeof value.path !== "string") {
		return failure(
			"expected-string",
			`${path}.path`,
			"Expected a Reference path string",
		);
	}
	if (!isNormalizedReferencePath(value.path)) {
		return failure(
			"invalid-reference-path",
			`${path}.path`,
			"Reference path must be a normalized relative POSIX path",
		);
	}
	const when = parseConditions(value.when, `${path}.when`);
	if (!when.ok) return when;
	return {
		ok: true,
		value: Object.freeze({ path: value.path, when: when.value }),
	};
}

function parseReferences(
	value: unknown,
): ParseStep<readonly ParsedTocReference[]> {
	if (!Array.isArray(value)) {
		return failure(
			"expected-array",
			"$.references",
			"Expected an array of References",
		);
	}
	const references: ParsedTocReference[] = [];
	const paths = new Set<string>();
	for (let index = 0; index < value.length; index += 1) {
		const reference = parseReference(value[index], index);
		if (!reference.ok) return reference;
		if (paths.has(reference.value.path)) {
			return failure(
				"duplicate-reference",
				`$.references[${index}].path`,
				"Reference path duplicates an earlier declaration",
			);
		}
		paths.add(reference.value.path);
		references.push(reference.value);
	}
	return { ok: true, value: Object.freeze(references) };
}

function parseRoot(value: unknown): TocParseResult {
	if (!isObject(value)) {
		return failure("expected-object", "$", "Expected a TOC object");
	}
	const fieldFailure = checkFields(
		value,
		"$",
		["$schema", "when", "unless", "references"],
		["when", "unless", "references"],
	);
	if (fieldFailure !== undefined) return fieldFailure;
	if (
		Object.hasOwn(value, "$schema") &&
		value.$schema !== SKILL_TOC_SCHEMA_URI
	) {
		return failure(
			"schema-mismatch",
			"$.$schema",
			`Expected schema ${SKILL_TOC_SCHEMA_URI}`,
		);
	}
	const when = parseConditions(value.when, "$.when");
	if (!when.ok) return when;
	const unless = parseConditions(value.unless, "$.unless");
	if (!unless.ok) return unless;
	const references = parseReferences(value.references);
	if (!references.ok) return references;
	return {
		ok: true,
		value: Object.freeze({
			schema: SKILL_TOC_SCHEMA_URI,
			when: when.value,
			unless: unless.value,
			references: references.value,
		}),
	};
}

/** Parses bounded UTF-8 JSON bytes into the only TOC shape accepted by v0.1. */
export function parseTocBytes(bytes: Uint8Array): TocParseResult {
	if (bytes.byteLength > MAX_TOC_BYTES) {
		return failure("too-large", "$", `TOC exceeds ${MAX_TOC_BYTES} bytes`);
	}
	let source: string;
	try {
		source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
	} catch {
		return failure("invalid-utf8", "$", "TOC must be valid UTF-8");
	}
	let value: unknown;
	try {
		value = JSON.parse(source);
	} catch {
		return failure("invalid-json", "$", "TOC must be valid JSON");
	}
	return parseRoot(value);
}
