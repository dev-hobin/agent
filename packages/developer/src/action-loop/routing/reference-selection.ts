export interface DeclaredReference {
	readonly path: string;
}

export type ReferenceDispositionStatus =
	| "selected"
	| "not-needed"
	| "needs-context";

export interface ReferenceDisposition {
	readonly path: string;
	readonly status: ReferenceDispositionStatus;
	readonly basis: readonly string[];
}

export type ReferenceSelectionIssueCode =
	| "duplicate-declaration"
	| "duplicate-disposition"
	| "missing-disposition"
	| "undeclared-disposition"
	| "empty-basis";

export interface ReferenceSelectionIssue {
	readonly code: ReferenceSelectionIssueCode;
	readonly path: string;
}

export interface ReadyReferenceSelection {
	readonly status: "ready";
	readonly dispositions: readonly ReferenceDisposition[];
	readonly selectedPaths: readonly string[];
}

export interface UnresolvedReferenceSelection {
	readonly status: "needs-context";
	readonly dispositions: readonly ReferenceDisposition[];
	readonly selectedPaths: readonly string[];
	readonly unresolved: readonly ReferenceDisposition[];
}

export interface InvalidReferenceSelection {
	readonly status: "invalid";
	readonly issues: readonly ReferenceSelectionIssue[];
}

export type ReferenceSelection =
	| ReadyReferenceSelection
	| UnresolvedReferenceSelection
	| InvalidReferenceSelection;

function hasBasis(disposition: ReferenceDisposition): boolean {
	return (
		disposition.basis.length > 0 &&
		disposition.basis.every((entry) => entry.trim().length > 0)
	);
}

function indexDeclarations(declarations: readonly DeclaredReference[]): {
	readonly paths: Set<string>;
	readonly issues: readonly ReferenceSelectionIssue[];
} {
	const paths = new Set<string>();
	const issues: ReferenceSelectionIssue[] = [];
	for (const declaration of declarations) {
		if (paths.has(declaration.path)) {
			issues.push({ code: "duplicate-declaration", path: declaration.path });
		} else {
			paths.add(declaration.path);
		}
	}
	return { paths, issues };
}

function indexProposals(
	declaredPaths: ReadonlySet<string>,
	proposals: readonly ReferenceDisposition[],
): {
	readonly byPath: ReadonlyMap<string, ReferenceDisposition>;
	readonly issues: readonly ReferenceSelectionIssue[];
} {
	const byPath = new Map<string, ReferenceDisposition>();
	const issues: ReferenceSelectionIssue[] = [];
	for (const proposal of proposals) {
		if (!declaredPaths.has(proposal.path)) {
			issues.push({ code: "undeclared-disposition", path: proposal.path });
		}
		if (byPath.has(proposal.path)) {
			issues.push({ code: "duplicate-disposition", path: proposal.path });
		} else {
			byPath.set(proposal.path, proposal);
		}
		if (!hasBasis(proposal)) {
			issues.push({ code: "empty-basis", path: proposal.path });
		}
	}
	return { byPath, issues };
}

function findMissingDispositions(
	declaredPaths: ReadonlySet<string>,
	proposalsByPath: ReadonlyMap<string, ReferenceDisposition>,
): ReferenceSelectionIssue[] {
	const issues: ReferenceSelectionIssue[] = [];
	for (const path of declaredPaths) {
		if (!proposalsByPath.has(path)) {
			issues.push({ code: "missing-disposition", path });
		}
	}
	return issues;
}

function orderDispositions(
	declarations: readonly DeclaredReference[],
	proposalsByPath: ReadonlyMap<string, ReferenceDisposition>,
): ReferenceDisposition[] {
	return declarations.map((declaration) => {
		const disposition = proposalsByPath.get(declaration.path);
		if (disposition === undefined) {
			throw new Error(
				`Reference disposition invariant failed for ${declaration.path}`,
			);
		}
		return {
			path: disposition.path,
			status: disposition.status,
			basis: [...disposition.basis],
		};
	});
}

function classifySelection(
	dispositions: readonly ReferenceDisposition[],
): ReadyReferenceSelection | UnresolvedReferenceSelection {
	const selectedPaths: string[] = [];
	const unresolved: ReferenceDisposition[] = [];
	for (const disposition of dispositions) {
		if (disposition.status === "selected") {
			selectedPaths.push(disposition.path);
		} else if (disposition.status === "needs-context") {
			unresolved.push(disposition);
		}
	}
	if (unresolved.length > 0) {
		return {
			status: "needs-context",
			dispositions,
			selectedPaths,
			unresolved,
		};
	}
	return { status: "ready", dispositions, selectedPaths };
}

/**
 * Accepts model-neutral Reference dispositions only when every declared
 * Reference is dispositioned exactly once with an explicit basis.
 */
export function selectDeclaredReferences(
	declarations: readonly DeclaredReference[],
	proposals: readonly ReferenceDisposition[],
): ReferenceSelection {
	const declarationIndex = indexDeclarations(declarations);
	const proposalIndex = indexProposals(declarationIndex.paths, proposals);
	const issues = [
		...declarationIndex.issues,
		...proposalIndex.issues,
		...findMissingDispositions(declarationIndex.paths, proposalIndex.byPath),
	];
	if (issues.length > 0) {
		return { status: "invalid", issues };
	}
	return classifySelection(
		orderDispositions(declarations, proposalIndex.byPath),
	);
}
