/** Narrows one untrusted model-tool payload to a non-array proposal object. */
export function isSdkProposalObject(
	value: unknown,
): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
