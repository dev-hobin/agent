export type LineDiffKind = "context" | "added" | "removed";

export interface LineDiffEntry {
	readonly kind: LineDiffKind;
	readonly text: string;
}

const MAX_EXACT_DIFF_LINES = 2_000;
const NEGATIVE_INFINITY = Number.NEGATIVE_INFINITY;

function lines(value: string): string[] {
	return value.replaceAll("\r\n", "\n").split("\n");
}

function replacementDiff(
	before: readonly string[],
	after: readonly string[],
): readonly LineDiffEntry[] {
	let prefix = 0;
	while (
		prefix < before.length &&
		prefix < after.length &&
		before[prefix] === after[prefix]
	)
		prefix += 1;

	let suffix = 0;
	while (
		suffix < before.length - prefix &&
		suffix < after.length - prefix &&
		before[before.length - suffix - 1] === after[after.length - suffix - 1]
	)
		suffix += 1;

	return [
		...before.slice(0, prefix).map((text) => ({
			kind: "context" as const,
			text,
		})),
		...before.slice(prefix, before.length - suffix).map((text) => ({
			kind: "removed" as const,
			text,
		})),
		...after.slice(prefix, after.length - suffix).map((text) => ({
			kind: "added" as const,
			text,
		})),
		...before.slice(before.length - suffix).map((text) => ({
			kind: "context" as const,
			text,
		})),
	];
}

function previousX(
	frontier: ReadonlyMap<number, number>,
	diagonal: number,
): number {
	return frontier.get(diagonal) ?? NEGATIVE_INFINITY;
}

function backtrack(
	trace: readonly ReadonlyMap<number, number>[],
	before: readonly string[],
	after: readonly string[],
): readonly LineDiffEntry[] {
	let x = before.length;
	let y = after.length;
	const result: LineDiffEntry[] = [];

	for (let depth = trace.length - 1; depth >= 0; depth -= 1) {
		const frontier = trace[depth];
		if (!frontier) continue;
		const diagonal = x - y;
		const previousDiagonal =
			diagonal === -depth ||
			(diagonal !== depth &&
				previousX(frontier, diagonal - 1) < previousX(frontier, diagonal + 1))
				? diagonal + 1
				: diagonal - 1;
		const previousHorizontal = frontier.get(previousDiagonal) ?? 0;
		const previousVertical = previousHorizontal - previousDiagonal;

		while (x > previousHorizontal && y > previousVertical) {
			result.push({ kind: "context", text: before[x - 1] ?? "" });
			x -= 1;
			y -= 1;
		}
		if (depth === 0) break;
		if (x === previousHorizontal) {
			result.push({ kind: "added", text: after[y - 1] ?? "" });
			y -= 1;
		} else {
			result.push({ kind: "removed", text: before[x - 1] ?? "" });
			x -= 1;
		}
	}
	return result.toReversed();
}

/**
 * Produces an exact Myers line diff for normal documents. Very large complete
 * rewrites fall back to a bounded prefix/suffix comparison while retaining all
 * proposed and removed lines.
 */
export function diffLines(
	beforeValue: string,
	afterValue: string,
): readonly LineDiffEntry[] {
	const before = lines(beforeValue);
	const after = lines(afterValue);
	if (before.length + after.length > MAX_EXACT_DIFF_LINES)
		return replacementDiff(before, after);

	const maximumDepth = before.length + after.length;
	const frontier = new Map<number, number>([[1, 0]]);
	const trace: ReadonlyMap<number, number>[] = [];
	for (let depth = 0; depth <= maximumDepth; depth += 1) {
		trace.push(new Map(frontier));
		for (let diagonal = -depth; diagonal <= depth; diagonal += 2) {
			const moveDown =
				diagonal === -depth ||
				(diagonal !== depth &&
					previousX(frontier, diagonal - 1) <
						previousX(frontier, diagonal + 1));
			let x = moveDown
				? (frontier.get(diagonal + 1) ?? 0)
				: (frontier.get(diagonal - 1) ?? 0) + 1;
			let y = x - diagonal;
			while (x < before.length && y < after.length && before[x] === after[y]) {
				x += 1;
				y += 1;
			}
			frontier.set(diagonal, x);
			if (x >= before.length && y >= after.length)
				return backtrack(trace, before, after);
		}
	}
	return replacementDiff(before, after);
}
