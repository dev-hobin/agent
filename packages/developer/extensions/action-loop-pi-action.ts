import { createHash } from "node:crypto";

import type { ControlledActionIdentity } from "../src/action-loop/action/accept-action-candidate.ts";

export const PI_CONTROLLED_ACTION_VERSION =
	"developer-pi-controlled-action/v1";
export const MAX_PI_CONTROLLED_ACTION_INPUT_CHARS = 131_072;
const MAX_CANONICAL_DEPTH = 32;
const CONTROLLED_PI_TOOLS: ReadonlySet<string> = new Set([
	"bash",
	"edit",
	"write",
]);

export type ControlledPiToolName = "bash" | "edit" | "write";

export type PiControlledActionBindingResult =
	| {
			readonly status: "bound";
			readonly value: ControlledActionIdentity;
			readonly canonicalInput: string;
	  }
	| { readonly status: "invalid"; readonly message: string };

function canonicalJson(value: unknown, depth: number): string | undefined {
	if (depth > MAX_CANONICAL_DEPTH) return undefined;
	if (value === null) return "null";
	if (typeof value === "string" || typeof value === "boolean") {
		return JSON.stringify(value);
	}
	if (typeof value === "number") {
		return Number.isFinite(value) ? JSON.stringify(value) : undefined;
	}
	if (Array.isArray(value)) {
		const items: string[] = [];
		for (const item of value) {
			const canonical = canonicalJson(item, depth + 1);
			if (canonical === undefined) return undefined;
			items.push(canonical);
		}
		return `[${items.join(",")}]`;
	}
	if (typeof value !== "object") return undefined;
	const object = value as Record<string, unknown>;
	const prototype = Object.getPrototypeOf(object);
	if (prototype !== Object.prototype && prototype !== null) return undefined;
	const fields: string[] = [];
	for (const key of Object.keys(object).sort()) {
		const canonical = canonicalJson(object[key], depth + 1);
		if (canonical === undefined) return undefined;
		fields.push(`${JSON.stringify(key)}:${canonical}`);
	}
	return `{${fields.join(",")}}`;
}

/** Binds one exact Pi built-in tool input to an order-independent Action identity. */
export function bindPiControlledAction(
	toolName: string,
	input: unknown,
): PiControlledActionBindingResult {
	if (!CONTROLLED_PI_TOOLS.has(toolName)) {
		return {
			status: "invalid",
			message: `Unsupported controlled Pi tool: ${toolName}`,
		};
	}
	const canonicalInput = canonicalJson(input, 0);
	if (canonicalInput === undefined) {
		return {
			status: "invalid",
			message: "Pi controlled Action input is not canonical JSON data",
		};
	}
	if (canonicalInput.length > MAX_PI_CONTROLLED_ACTION_INPUT_CHARS) {
		return {
			status: "invalid",
			message: `Pi controlled Action input exceeds ${MAX_PI_CONTROLLED_ACTION_INPUT_CHARS} canonical characters`,
		};
	}
	const fingerprint = createHash("sha256")
		.update(PI_CONTROLLED_ACTION_VERSION, "utf8")
		.update("\0", "utf8")
		.update(toolName, "utf8")
		.update("\0", "utf8")
		.update(canonicalInput, "utf8")
		.digest("hex");
	return {
		status: "bound",
		value: Object.freeze({
			kind: `pi-tool-call:${toolName}`,
			fingerprint,
		}),
		canonicalInput,
	};
}
