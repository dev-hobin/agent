import { hashIdentity } from "../identity/hash-identity.ts";

export const NEED_COVERAGE_VERSION = "developer-need-coverage/v1";

const COVERAGE_STATUSES: ReadonlySet<string> = new Set([
	"covered",
	"partially-covered",
	"conflicted",
	"missing",
]);
const DISPOSITION_STATUSES: ReadonlySet<string> = new Set([
	"supports",
	"limited-support",
	"not-relied-on",
]);
const PROVENANCE_KINDS: ReadonlySet<string> = new Set([
	"model",
	"human",
	"tool",
	"external",
]);

export type NeedCoverageStatus =
	| "covered"
	| "partially-covered"
	| "conflicted"
	| "missing";

export type CoverageContributionDispositionStatus =
	| "supports"
	| "limited-support"
	| "not-relied-on";

export interface NeedCoverageTarget {
	readonly workCaseId: string;
	readonly judgmentId: string;
	readonly contributionNeedId: string;
}

/** Minimal open-world Contribution projection required by Coverage assessment. */
export interface CoverageInputContribution extends NeedCoverageTarget {
	readonly contributionId: string;
	readonly localStatus: "resolved" | "partial";
}

export interface CoverageContributionDispositionProposal {
	readonly contributionId: string;
	readonly status: CoverageContributionDispositionStatus;
	readonly basis: readonly string[];
}

export interface CoverageConflictProposal {
	readonly leftContributionId: string;
	readonly rightContributionId: string;
	readonly basis: readonly string[];
}

export interface CoverageProposalProvenance {
	readonly kind: "model" | "human" | "tool" | "external";
	readonly source: string;
}

export interface NeedCoverageProposal extends NeedCoverageTarget {
	readonly status: NeedCoverageStatus;
	readonly dispositions: readonly CoverageContributionDispositionProposal[];
	readonly conflicts: readonly CoverageConflictProposal[];
	readonly basis: readonly string[];
	readonly provenance: CoverageProposalProvenance;
}

export interface CoverageContributionDisposition {
	readonly contributionId: string;
	readonly status: CoverageContributionDispositionStatus;
	readonly basis: readonly string[];
}

export interface CoverageConflict {
	readonly leftContributionId: string;
	readonly rightContributionId: string;
	readonly basis: readonly string[];
}

export interface NeedCoverage extends NeedCoverageTarget {
	readonly coverageId: string;
	readonly status: NeedCoverageStatus;
	readonly dispositions: readonly CoverageContributionDisposition[];
	readonly conflicts: readonly CoverageConflict[];
	readonly basis: readonly string[];
	readonly provenance: CoverageProposalProvenance;
}

export type NeedCoverageErrorCode =
	| "invalid-target-id"
	| "identity-mismatch"
	| "duplicate-contribution"
	| "contribution-accounting"
	| "unsupported-disposition-status"
	| "empty-basis"
	| "duplicate-value"
	| "partial-as-full-support"
	| "invalid-conflict"
	| "unsupported-coverage-status"
	| "status-mismatch"
	| "invalid-provenance";

export interface NeedCoverageError {
	readonly code: NeedCoverageErrorCode;
	readonly path: string;
	readonly message: string;
}

export type NeedCoverageAssessmentResult =
	| { readonly status: "accepted"; readonly value: NeedCoverage }
	| { readonly status: "invalid"; readonly error: NeedCoverageError };

type CanonicalResult<T> =
	| { readonly ok: true; readonly value: T }
	| { readonly ok: false; readonly error: NeedCoverageError };

interface ContributionInventory {
	readonly ordered: readonly CoverageInputContribution[];
	readonly byId: ReadonlyMap<string, CoverageInputContribution>;
	readonly positions: ReadonlyMap<string, number>;
}

function invalid(
	code: NeedCoverageErrorCode,
	path: string,
	message: string,
): NeedCoverageAssessmentResult {
	return { status: "invalid", error: { code, path, message } };
}

function validId(id: string): boolean {
	return id.length > 0 && id === id.trim() && !id.includes("\0");
}

function canonicalList(
	values: readonly string[],
	path: string,
): CanonicalResult<readonly string[]> {
	const normalized: string[] = [];
	const seen = new Set<string>();
	for (let index = 0; index < values.length; index += 1) {
		const value = values[index]?.trim() ?? "";
		if (value.length === 0) {
			return {
				ok: false,
				error: {
					code: "empty-basis",
					path: `${path}[${index}]`,
					message: "Expected a nonblank basis",
				},
			};
		}
		if (seen.has(value)) {
			return {
				ok: false,
				error: {
					code: "duplicate-value",
					path: `${path}[${index}]`,
					message: "Basis duplicates an earlier normalized value",
				},
			};
		}
		seen.add(value);
		normalized.push(value);
	}
	return { ok: true, value: Object.freeze(normalized) };
}

function checkTarget(
	target: NeedCoverageTarget,
	proposal: NeedCoverageProposal,
): NeedCoverageAssessmentResult | undefined {
	for (const [path, id] of [
		["target.workCaseId", target.workCaseId],
		["target.judgmentId", target.judgmentId],
		["target.contributionNeedId", target.contributionNeedId],
	] as const) {
		if (!validId(id)) {
			return invalid(
				"invalid-target-id",
				path,
				"Expected a canonical target ID",
			);
		}
	}
	for (const [path, actual, expected] of [
		["proposal.workCaseId", proposal.workCaseId, target.workCaseId],
		["proposal.judgmentId", proposal.judgmentId, target.judgmentId],
		[
			"proposal.contributionNeedId",
			proposal.contributionNeedId,
			target.contributionNeedId,
		],
	] as const) {
		if (actual !== expected) {
			return invalid(
				"identity-mismatch",
				path,
				`Expected ${expected}, received ${actual}`,
			);
		}
	}
	return undefined;
}

function buildInventory(
	target: NeedCoverageTarget,
	contributions: readonly CoverageInputContribution[],
): CanonicalResult<ContributionInventory> {
	const byId = new Map<string, CoverageInputContribution>();
	for (const [index, contribution] of contributions.entries()) {
		for (const [path, actual, expected] of [
			[`contributions[${index}].workCaseId`, contribution.workCaseId, target.workCaseId],
			[`contributions[${index}].judgmentId`, contribution.judgmentId, target.judgmentId],
			[
				`contributions[${index}].contributionNeedId`,
				contribution.contributionNeedId,
				target.contributionNeedId,
			],
		] as const) {
			if (actual !== expected) {
				return {
					ok: false,
					error: {
						code: "identity-mismatch",
						path,
						message: `Expected ${expected}, received ${actual}`,
					},
				};
			}
		}
		if (byId.has(contribution.contributionId)) {
			return {
				ok: false,
				error: {
					code: "duplicate-contribution",
					path: `contributions[${index}].contributionId`,
					message: "Current Contribution inventory contains a duplicate ID",
				},
			};
		}
		byId.set(contribution.contributionId, contribution);
	}
	const ordered = Object.freeze(
		[...contributions].sort((left, right) => {
			if (left.contributionId < right.contributionId) return -1;
			if (left.contributionId > right.contributionId) return 1;
			return 0;
		}),
	);
	const positions = new Map(
		ordered.map((contribution, index) => [contribution.contributionId, index]),
	);
	return { ok: true, value: { ordered, byId, positions } };
}

function canonicalDispositions(
	inventory: ContributionInventory,
	proposals: readonly CoverageContributionDispositionProposal[],
): CanonicalResult<readonly CoverageContributionDisposition[]> {
	const byId = new Map<string, CoverageContributionDisposition>();
	for (const [index, proposal] of proposals.entries()) {
		const contribution = inventory.byId.get(proposal.contributionId);
		if (contribution === undefined || byId.has(proposal.contributionId)) {
			return {
				ok: false,
				error: {
					code: "contribution-accounting",
					path: `proposal.dispositions[${index}].contributionId`,
					message: "Contribution must be current and dispositioned exactly once",
				},
			};
		}
		if (!DISPOSITION_STATUSES.has(proposal.status)) {
			return {
				ok: false,
				error: {
					code: "unsupported-disposition-status",
					path: `proposal.dispositions[${index}].status`,
					message: `Unsupported disposition status ${proposal.status}`,
				},
			};
		}
		if (contribution.localStatus === "partial" && proposal.status === "supports") {
			return {
				ok: false,
				error: {
					code: "partial-as-full-support",
					path: `proposal.dispositions[${index}].status`,
					message: "A partial Skill result cannot become full support",
				},
			};
		}
		const basis = canonicalList(
			proposal.basis,
			`proposal.dispositions[${index}].basis`,
		);
		if (!basis.ok) return basis;
		if (basis.value.length === 0) {
			return {
				ok: false,
				error: {
					code: "empty-basis",
					path: `proposal.dispositions[${index}].basis`,
					message: "Contribution disposition requires explicit basis",
				},
			};
		}
		byId.set(
			proposal.contributionId,
			Object.freeze({
				contributionId: proposal.contributionId,
				status: proposal.status,
				basis: basis.value,
			}),
		);
	}
	if (byId.size !== inventory.ordered.length) {
		return {
			ok: false,
			error: {
				code: "contribution-accounting",
				path: "proposal.dispositions",
				message: "Every current Contribution requires one disposition",
			},
		};
	}
	const ordered: CoverageContributionDisposition[] = [];
	for (const contribution of inventory.ordered) {
		const disposition = byId.get(contribution.contributionId);
		if (disposition === undefined) {
			return {
				ok: false,
				error: {
					code: "contribution-accounting",
					path: "proposal.dispositions",
					message: `Contribution has no disposition: ${contribution.contributionId}`,
				},
			};
		}
		ordered.push(disposition);
	}
	return { ok: true, value: Object.freeze(ordered) };
}

function canonicalConflicts(
	inventory: ContributionInventory,
	dispositions: readonly CoverageContributionDisposition[],
	proposals: readonly CoverageConflictProposal[],
): CanonicalResult<readonly CoverageConflict[]> {
	const dispositionById = new Map(
		dispositions.map((disposition) => [disposition.contributionId, disposition]),
	);
	const conflicts: Array<CoverageConflict & { leftIndex: number; rightIndex: number }> = [];
	const seen = new Set<string>();
	for (const [index, proposal] of proposals.entries()) {
		const leftIndex = inventory.positions.get(proposal.leftContributionId);
		const rightIndex = inventory.positions.get(proposal.rightContributionId);
		if (
			leftIndex === undefined ||
			rightIndex === undefined ||
			leftIndex === rightIndex
		) {
			return {
				ok: false,
				error: {
					code: "invalid-conflict",
					path: `proposal.conflicts[${index}]`,
					message: "Conflict requires two distinct current Contributions",
				},
			};
		}
		const orderedLeft = Math.min(leftIndex, rightIndex);
		const orderedRight = Math.max(leftIndex, rightIndex);
		const leftContributionId = inventory.ordered[orderedLeft]?.contributionId;
		const rightContributionId = inventory.ordered[orderedRight]?.contributionId;
		if (leftContributionId === undefined || rightContributionId === undefined) {
			return {
				ok: false,
				error: {
					code: "invalid-conflict",
					path: `proposal.conflicts[${index}]`,
					message: "Conflict cannot resolve its current Contributions",
				},
			};
		}
		const key = `${leftContributionId}\0${rightContributionId}`;
		if (seen.has(key)) {
			return {
				ok: false,
				error: {
					code: "invalid-conflict",
					path: `proposal.conflicts[${index}]`,
					message: "Conflict duplicates an earlier relation",
				},
			};
		}
		if (
			dispositionById.get(leftContributionId)?.status === "not-relied-on" ||
			dispositionById.get(rightContributionId)?.status === "not-relied-on"
		) {
			return {
				ok: false,
				error: {
					code: "invalid-conflict",
					path: `proposal.conflicts[${index}]`,
					message: "Conflict endpoints must both be relied on",
				},
			};
		}
		const basis = canonicalList(
			proposal.basis,
			`proposal.conflicts[${index}].basis`,
		);
		if (!basis.ok) return basis;
		if (basis.value.length === 0) {
			return {
				ok: false,
				error: {
					code: "invalid-conflict",
					path: `proposal.conflicts[${index}].basis`,
					message: "Conflict requires explicit basis",
				},
			};
		}
		seen.add(key);
		conflicts.push(
			Object.freeze({
				leftContributionId,
				rightContributionId,
				basis: basis.value,
				leftIndex: orderedLeft,
				rightIndex: orderedRight,
			}),
		);
	}
	conflicts.sort(
		(left, right) =>
			left.leftIndex - right.leftIndex || left.rightIndex - right.rightIndex,
	);
	return {
		ok: true,
		value: Object.freeze(
			conflicts.map(({ leftContributionId, rightContributionId, basis }) =>
				Object.freeze({ leftContributionId, rightContributionId, basis }),
			),
		),
	};
}

function canonicalProvenance(
	proposal: CoverageProposalProvenance,
): CanonicalResult<CoverageProposalProvenance> {
	if (!PROVENANCE_KINDS.has(proposal.kind)) {
		return {
			ok: false,
			error: {
				code: "invalid-provenance",
				path: "proposal.provenance.kind",
				message: `Unsupported provenance kind ${proposal.kind}`,
			},
		};
	}
	const source = proposal.source.trim();
	if (source.length === 0) {
		return {
			ok: false,
			error: {
				code: "invalid-provenance",
				path: "proposal.provenance.source",
				message: "Coverage provenance requires a nonblank source",
			},
		};
	}
	return {
		ok: true,
		value: Object.freeze({ kind: proposal.kind, source }),
	};
}

function deriveStatus(
	dispositions: readonly CoverageContributionDisposition[],
	conflicts: readonly CoverageConflict[],
): NeedCoverageStatus {
	if (conflicts.length > 0) return "conflicted";
	if (dispositions.some(({ status }) => status === "limited-support")) {
		return "partially-covered";
	}
	if (dispositions.some(({ status }) => status === "supports")) {
		return "covered";
	}
	return "missing";
}

interface CoverageIdentityInput {
	readonly target: NeedCoverageTarget;
	readonly status: NeedCoverageStatus;
	readonly dispositions: readonly CoverageContributionDisposition[];
	readonly conflicts: readonly CoverageConflict[];
	readonly basis: readonly string[];
}

function identityParts(input: CoverageIdentityInput): string[] {
	const parts = [
		input.target.workCaseId,
		input.target.judgmentId,
		input.target.contributionNeedId,
		input.status,
		"dispositions",
		String(input.dispositions.length),
	];
	for (const disposition of input.dispositions) {
		parts.push(
			disposition.contributionId,
			disposition.status,
			String(disposition.basis.length),
			...disposition.basis,
		);
	}
	parts.push("conflicts", String(input.conflicts.length));
	for (const conflict of input.conflicts) {
		parts.push(
			conflict.leftContributionId,
			conflict.rightContributionId,
			String(conflict.basis.length),
			...conflict.basis,
		);
	}
	parts.push("basis", String(input.basis.length), ...input.basis);
	return parts;
}

/** Assesses all current Contributions for one Need without creating a Conclusion. */
export function assessNeedCoverage(
	target: NeedCoverageTarget,
	contributions: readonly CoverageInputContribution[],
	proposal: NeedCoverageProposal,
): NeedCoverageAssessmentResult {
	const targetFailure = checkTarget(target, proposal);
	if (targetFailure !== undefined) return targetFailure;
	if (!COVERAGE_STATUSES.has(proposal.status)) {
		return invalid(
			"unsupported-coverage-status",
			"proposal.status",
			`Unsupported Coverage status ${proposal.status}`,
		);
	}
	const inventory = buildInventory(target, contributions);
	if (!inventory.ok) return { status: "invalid", error: inventory.error };
	const dispositions = canonicalDispositions(
		inventory.value,
		proposal.dispositions,
	);
	if (!dispositions.ok) {
		return { status: "invalid", error: dispositions.error };
	}
	const conflicts = canonicalConflicts(
		inventory.value,
		dispositions.value,
		proposal.conflicts,
	);
	if (!conflicts.ok) return { status: "invalid", error: conflicts.error };
	const basis = canonicalList(proposal.basis, "proposal.basis");
	if (!basis.ok) return { status: "invalid", error: basis.error };
	if (basis.value.length === 0) {
		return invalid(
			"empty-basis",
			"proposal.basis",
			"Need Coverage requires explicit basis",
		);
	}
	const provenance = canonicalProvenance(proposal.provenance);
	if (!provenance.ok) return { status: "invalid", error: provenance.error };

	const derivedStatus = deriveStatus(dispositions.value, conflicts.value);
	if (proposal.status !== derivedStatus) {
		return invalid(
			"status-mismatch",
			"proposal.status",
			`Coverage evidence derives ${derivedStatus}, not ${proposal.status}`,
		);
	}
	const coverageId = hashIdentity(
		"coverage",
		NEED_COVERAGE_VERSION,
		identityParts({
			target,
			status: derivedStatus,
			dispositions: dispositions.value,
			conflicts: conflicts.value,
			basis: basis.value,
		}),
	);
	return {
		status: "accepted",
		value: Object.freeze({
			coverageId,
			workCaseId: target.workCaseId,
			judgmentId: target.judgmentId,
			contributionNeedId: target.contributionNeedId,
			status: derivedStatus,
			dispositions: dispositions.value,
			conflicts: conflicts.value,
			basis: basis.value,
			provenance: provenance.value,
		}),
	};
}
