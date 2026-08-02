import { createHash } from "node:crypto";

export type JsonValue =
	| null
	| boolean
	| number
	| string
	| readonly JsonValue[]
	| { readonly [key: string]: JsonValue };

export class JsonValueError extends Error {
	readonly path: string;

	constructor(message: string, path: string, options?: ErrorOptions) {
		super(message, options);
		this.name = "JsonValueError";
		this.path = path;
	}
}

export function jsonValueFromUnknown(value: unknown, path = "/"): JsonValue {
	if (value === null || typeof value === "string" || typeof value === "boolean")
		return value;
	if (typeof value === "number" && Number.isFinite(value)) return value;
	if (Array.isArray(value)) {
		return value.map((entry, index) =>
			jsonValueFromUnknown(entry, `${path}${index}/`),
		);
	}
	if (typeof value === "object") {
		return Object.fromEntries(
			Object.entries(value).map(([key, entry]) => [
				key,
				jsonValueFromUnknown(entry, `${path}${key}/`),
			]),
		);
	}
	throw new JsonValueError(`Unsupported JSON value at ${path}.`, path);
}

export function decodeJsonValue(source: string): JsonValue {
	let parsed: unknown;
	try {
		parsed = JSON.parse(source);
	} catch (error) {
		throw new JsonValueError("Source is not valid JSON.", "/", {
			cause: error,
		});
	}
	return jsonValueFromUnknown(parsed);
}

export function canonicalJson(value: JsonValue): string {
	if (value === null || typeof value !== "object") return JSON.stringify(value);
	if (Array.isArray(value)) {
		return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
	}
	return `{${Object.entries(value)
		.sort(([left], [right]) => left.localeCompare(right))
		.map(
			([key, entryValue]) =>
				`${JSON.stringify(key)}:${canonicalJson(entryValue)}`,
		)
		.join(",")}}`;
}

export function sha256(value: string | Uint8Array): string {
	return createHash("sha256").update(value).digest("hex");
}
