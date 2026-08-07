export type SdkProposalJsonResult =
	| { readonly ok: true; readonly value: unknown }
	| { readonly ok: false; readonly message: string };

export const MAX_SDK_PROPOSAL_JSON_CHARS = 32_768;

/** Decodes one bounded JSON text field without narrowing its domain meaning. */
export function decodeSdkProposalJson(
	value: unknown,
	label: string,
): SdkProposalJsonResult {
	if (
		typeof value !== "string" ||
		value.length === 0 ||
		value.length > MAX_SDK_PROPOSAL_JSON_CHARS
	) {
		return {
			ok: false,
			message: `${label} must be non-empty JSON text within ${MAX_SDK_PROPOSAL_JSON_CHARS} characters.`,
		};
	}
	try {
		return { ok: true, value: JSON.parse(value) };
	} catch (error) {
		return {
			ok: false,
			message: `${label} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
		};
	}
}

export function decodeSdkStringList(input: {
	readonly value: unknown;
	readonly label: string;
	readonly allowEmpty: boolean;
	readonly maximumItems: number;
}):
	| { readonly ok: true; readonly value: readonly string[] }
	| { readonly ok: false; readonly message: string } {
	const decoded = decodeSdkProposalJson(input.value, input.label);
	if (!decoded.ok) return decoded;
	if (
		!Array.isArray(decoded.value) ||
		decoded.value.length > input.maximumItems ||
		(!input.allowEmpty && decoded.value.length === 0) ||
		decoded.value.some((item) => typeof item !== "string")
	) {
		return {
			ok: false,
			message: `${input.label} must encode ${input.allowEmpty ? "zero or more" : "one or more"} strings and at most ${input.maximumItems} items.`,
		};
	}
	return { ok: true, value: decoded.value };
}
