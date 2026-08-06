import { hashIdentity } from "../identity/hash-identity.ts";
import {
	prepareClosureTarget,
	type ClosureTargetBlocker,
} from "./prepare-closure-target.ts";
import {
	deriveWorkCaseRevisionId,
	workCaseInventoryIssue,
	type ActiveWorkCase,
} from "./work-case.ts";

export const WORK_CASE_BLOCK_VERSION = "developer-work-case-block/v1";

export interface BlockerDispositionProposal {
	readonly code: string;
	readonly subjectId: string;
	readonly basis: readonly string[];
}

export interface BlockWorkCaseProposal {
	readonly workCaseId: string;
	readonly expectedRevisionId: string;
	readonly claimAssuranceConclusionId: string;
	readonly reason: string;
	readonly blockerDispositions: readonly BlockerDispositionProposal[];
}

export interface WorkCaseBlock {
	readonly workCaseBlockId: string;
	readonly claimAssuranceConclusionId: string;
	readonly reason: string;
	readonly blockerDispositions: readonly {
		readonly code: string;
		readonly subjectId: string;
		readonly basis: readonly string[];
	}[];
}

export interface BlockedWorkCase
	extends Omit<ActiveWorkCase, "status" | "revisionId"> {
	readonly status: "blocked";
	readonly revisionId: string;
	readonly priorRevisionId: string;
	readonly block: WorkCaseBlock;
}

export type BlockWorkCaseResult =
	| { readonly status: "blocked"; readonly value: BlockedWorkCase }
	| {
			readonly status: "invalid";
			readonly error: {
				readonly code:
					| "stale-work-case"
					| "invalid-work-case-inventory"
					| "identity-mismatch"
					| "claim-assurance-required"
					| "closure-still-ready"
					| "blocker-accounting"
					| "invalid-block-reason";
				readonly path: string;
				readonly message: string;
			};
	  };

function invalid(
	code: Extract<BlockWorkCaseResult, { status: "invalid" }>["error"]["code"],
	path: string,
	message: string,
): BlockWorkCaseResult {
	return { status: "invalid", error: { code, path, message } };
}

function canonicalText(value: string): string | undefined {
	if (typeof value !== "string") return undefined;
	const normalized = value.trim();
	return normalized.length === 0 ? undefined : normalized;
}

function canonicalBasis(
	values: readonly string[],
): readonly string[] | undefined {
	if (!Array.isArray(values) || values.length === 0) return undefined;
	const normalized: string[] = [];
	for (const value of values) {
		const text = canonicalText(value);
		if (text === undefined) return undefined;
		normalized.push(text);
	}
	if (new Set(normalized).size !== normalized.length) return undefined;
	return Object.freeze(
		normalized.sort((left, right) => left.localeCompare(right)),
	);
}

function blockerKey(code: string, subjectId: string): string {
	return `${code}\u0000${subjectId}`;
}

type BlockerDisposition = WorkCaseBlock["blockerDispositions"][number];

type CanonicalBlockerResult =
	| { readonly ok: true; readonly value: readonly BlockerDisposition[] }
	| { readonly ok: false; readonly result: BlockWorkCaseResult };

function canonicalBlockerDispositions(
	blockers: readonly ClosureTargetBlocker[],
	proposals: readonly BlockerDispositionProposal[],
): CanonicalBlockerResult {
	if (!Array.isArray(proposals)) {
		return {
			ok: false,
			result: invalid(
				"blocker-accounting",
				"proposal.blockerDispositions",
				"Expected complete blocker accounting",
			),
		};
	}
	const expected = new Set(
		blockers.map((blocker) => blockerKey(blocker.code, blocker.subjectId)),
	);
	const accounted = new Map<string, BlockerDisposition>();
	for (let index = 0; index < proposals.length; index += 1) {
		const disposition = proposals[index];
		if (disposition === undefined) {
			return {
				ok: false,
				result: invalid(
					"blocker-accounting",
					`proposal.blockerDispositions[${index}]`,
					"Expected blocker disposition",
				),
			};
		}
		const key = blockerKey(disposition.code, disposition.subjectId);
		const basis = canonicalBasis(disposition.basis);
		if (!expected.has(key) || accounted.has(key) || basis === undefined) {
			return {
				ok: false,
				result: invalid(
					"blocker-accounting",
					`proposal.blockerDispositions[${index}]`,
					"Blocker must be current, unique, and explicitly supported",
				),
			};
		}
		accounted.set(
			key,
			Object.freeze({
				code: disposition.code,
				subjectId: disposition.subjectId,
				basis,
			}),
		);
	}
	if (accounted.size !== expected.size) {
		return {
			ok: false,
			result: invalid(
				"blocker-accounting",
				"proposal.blockerDispositions",
				"Every current closure blocker requires one disposition",
			),
		};
	}
	const ordered: BlockerDisposition[] = [];
	for (const blocker of blockers) {
		const disposition = accounted.get(
			blockerKey(blocker.code, blocker.subjectId),
		);
		if (disposition === undefined) {
			return {
				ok: false,
				result: invalid(
					"blocker-accounting",
					"proposal.blockerDispositions",
					`Missing current blocker: ${blocker.subjectId}`,
				),
			};
		}
		ordered.push(disposition);
	}
	return { ok: true, value: Object.freeze(ordered) };
}

/** Blocks only when Claim Assurance accounts every current closure blocker. */
export function blockWorkCase(
	workCase: ActiveWorkCase,
	proposal: BlockWorkCaseProposal,
): BlockWorkCaseResult {
	if (workCase.revisionId !== deriveWorkCaseRevisionId(workCase)) {
		return invalid(
			"stale-work-case",
			"workCase.revisionId",
			"Work Case revision does not match its closure inventory",
		);
	}
	const issue = workCaseInventoryIssue(workCase);
	if (issue !== undefined) {
		return invalid("invalid-work-case-inventory", issue.path, issue.message);
	}
	if (
		proposal.workCaseId !== workCase.workCaseId ||
		proposal.expectedRevisionId !== workCase.revisionId
	) {
		return invalid(
			"identity-mismatch",
			"proposal",
			"Block proposal does not bind the current Work Case revision",
		);
	}
	const assurance = workCase.conclusions.find(
		({ conclusionId }) => conclusionId === proposal.claimAssuranceConclusionId,
	);
	if (assurance === undefined || assurance.category !== "Claim Assurance") {
		return invalid(
			"claim-assurance-required",
			"proposal.claimAssuranceConclusionId",
			"Blocking requires a current Claim Assurance Conclusion",
		);
	}
	const closure = prepareClosureTarget(workCase);
	if (closure.status === "invalid") {
		return invalid(
			"invalid-work-case-inventory",
			closure.error.path,
			closure.error.message,
		);
	}
	if (closure.status === "ready") {
		return invalid(
			"closure-still-ready",
			"workCase",
			"A closure-ready Work Case cannot be declared blocked",
		);
	}
	const blockerDispositions = canonicalBlockerDispositions(
		closure.blockers,
		proposal.blockerDispositions,
	);
	if (!blockerDispositions.ok) return blockerDispositions.result;
	const reason = canonicalText(proposal.reason);
	if (reason === undefined) {
		return invalid(
			"invalid-block-reason",
			"proposal.reason",
			"Blocking requires an explicit bounded reason",
		);
	}
	const workCaseBlockId = hashIdentity(
		"work_case_block",
		WORK_CASE_BLOCK_VERSION,
		[
			workCase.workCaseId,
			workCase.revisionId,
			assurance.conclusionId,
			reason,
			...blockerDispositions.value.flatMap((disposition) => [
				disposition.code,
				disposition.subjectId,
				...disposition.basis,
			]),
		],
	);
	return {
		status: "blocked",
		value: Object.freeze({
			...workCase,
			status: "blocked",
			priorRevisionId: workCase.revisionId,
			revisionId: hashIdentity(
				"work_case_block_revision",
				WORK_CASE_BLOCK_VERSION,
				[workCase.revisionId, workCaseBlockId],
			),
			block: Object.freeze({
				workCaseBlockId,
				claimAssuranceConclusionId: assurance.conclusionId,
				reason,
				blockerDispositions: blockerDispositions.value,
			}),
		}),
	};
}
