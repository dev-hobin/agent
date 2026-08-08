export function canonicalContinuityText(value: unknown): string | undefined {
	if (typeof value !== "string") return undefined;
	const normalized = value.trim();
	return normalized.length === 0 ? undefined : normalized;
}

export function canonicalContinuityBasis(
	values: unknown,
): readonly string[] | undefined {
	if (!Array.isArray(values) || values.length === 0) return undefined;
	const normalized: string[] = [];
	for (const value of values) {
		const text = canonicalContinuityText(value);
		if (text === undefined) return undefined;
		normalized.push(text);
	}
	if (new Set(normalized).size !== normalized.length) return undefined;
	return Object.freeze(
		normalized.sort((left, right) => left.localeCompare(right)),
	);
}
