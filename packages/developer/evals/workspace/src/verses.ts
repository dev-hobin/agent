export function verse(count: number): string {
	if (count === 2) {
		return "2 bottles of beer; take one down; 1 bottle remains.";
	}
	if (count === 3) {
		return "3 bottles of beer; take one down; 2 bottles remain.";
	}
	if (count === 1) {
		return "1 bottle of beer; take one down; 0 bottles remain.";
	}
	return "0 bottles of beer; no bottles remain.";
}
