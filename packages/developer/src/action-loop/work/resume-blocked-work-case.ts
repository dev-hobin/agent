import { hashIdentity } from "../identity/hash-identity.ts";
import {
	WORK_CASE_BLOCK_VERSION,
	type BlockedWorkCase,
} from "./block-work-case.ts";
import {
	deriveWorkCaseRevisionId,
	workCaseInventoryIssue,
	type ActiveWorkCase,
} from "./work-case.ts";

export const WORK_CASE_UNBLOCK_VERSION = "developer-work-case-unblock/v1";

export interface UnblockObservationProposal {
	readonly kind: string;
	readonly observationId: string;
	readonly source: string;
	readonly statement: string;
	readonly basis: readonly string[];
}

export interface ResumeBlockedWorkCaseProposal {
	readonly workCaseId: string;
	readonly expectedRevisionId: string;
	readonly continuation: string;
	readonly observation: UnblockObservationProposal;
}

export type ResumeBlockedWorkCaseResult =
	| { readonly status: "active"; readonly value: ActiveWorkCase }
	| {
			readonly status: "invalid";
			readonly error: {
				readonly code:
					| "stale-blocked-work-case"
					| "invalid-work-case-inventory"
					| "identity-mismatch"
					| "observation-required"
					| "invalid-unblock-basis";
				readonly path: string;
				readonly message: string;
			};
	  };

function invalid(
	code: Extract<
		ResumeBlockedWorkCaseResult,
		{ status: "invalid" }
	>["error"]["code"],
	path: string,
	message: string,
): ResumeBlockedWorkCaseResult {
	return { status: "invalid", error: { code, path, message } };
}

function canonicalText(value: string): string | undefined {
	if (typeof value !== "string") return undefined;
	const normalized = value.trim();
	return normalized.length === 0 ? undefined : normalized;
}

function canonicalBasis(values: readonly string[]): readonly string[] | undefined {
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

/** Resumes blocked work only after an observed change creates a continuation. */
export function resumeBlockedWorkCase(
	workCase: BlockedWorkCase,
	proposal: ResumeBlockedWorkCaseProposal,
): ResumeBlockedWorkCaseResult {
	const inventoryRevisionId = deriveWorkCaseRevisionId(workCase);
	const expectedBlockedRevisionId = hashIdentity(
		"work_case_block_revision",
		WORK_CASE_BLOCK_VERSION,
		[workCase.priorRevisionId, workCase.block.workCaseBlockId],
	);
	if (
		workCase.priorRevisionId !== inventoryRevisionId ||
		workCase.revisionId !== expectedBlockedRevisionId
	) {
		return invalid(
			"stale-blocked-work-case",
			"workCase.revisionId",
			"Blocked Work Case does not preserve its prior inventory revision",
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
			"Unblock proposal does not bind the blocked Work Case revision",
		);
	}
	if (
		proposal.observation?.kind !== "human" &&
		proposal.observation?.kind !== "tool" &&
		proposal.observation?.kind !== "external"
	) {
		return invalid(
			"observation-required",
			"proposal.observation.kind",
			"Unblocking requires a human, tool, or external Observation",
		);
	}
	const continuation = canonicalText(proposal.continuation);
	const observationId = canonicalText(proposal.observation.observationId);
	const source = canonicalText(proposal.observation.source);
	const statement = canonicalText(proposal.observation.statement);
	const basis = canonicalBasis(proposal.observation.basis);
	if (
		continuation === undefined ||
		observationId === undefined ||
		source === undefined ||
		statement === undefined ||
		basis === undefined
	) {
		return invalid(
			"invalid-unblock-basis",
			"proposal",
			"Observed change and concrete continuation must be explicit",
		);
	}
	const workCaseUnblockId = hashIdentity(
		"work_case_unblock",
		WORK_CASE_UNBLOCK_VERSION,
		[
			workCase.workCaseId,
			workCase.revisionId,
			continuation,
			proposal.observation.kind,
			observationId,
			source,
			statement,
			...basis,
		],
	);
	const continuityIds = Object.freeze([
		...workCase.continuityIds,
		workCase.block.workCaseBlockId,
		workCaseUnblockId,
	]);
	const {
		block: _block,
		priorRevisionId: _priorRevisionId,
		revisionId: _revisionId,
		status: _status,
		...preserved
	} = workCase;
	const nextState = { ...preserved, continuityIds };
	return {
		status: "active",
		value: Object.freeze({
			...nextState,
			status: "active",
			revisionId: deriveWorkCaseRevisionId(nextState),
		}),
	};
}
