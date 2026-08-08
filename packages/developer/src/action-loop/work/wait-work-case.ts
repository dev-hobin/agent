import { hashIdentity } from "../identity/hash-identity.ts";
import {
	canonicalContinuityBasis,
	canonicalContinuityText,
} from "./canonical-continuity-input.ts";
import {
	deriveWorkCaseRevisionId,
	workCaseInventoryIssue,
	type ActiveWorkCase,
} from "./work-case.ts";

export const WORK_CASE_WAIT_VERSION = "developer-work-case-wait/v1";

export interface WaitObservationProposal {
	readonly kind: string;
	readonly observationId: string;
	readonly source: string;
	readonly basis: readonly string[];
}

export interface WaitWorkCaseProposal {
	readonly workCaseId: string;
	readonly expectedRevisionId: string;
	readonly externalCondition: string;
	readonly resumePredicate: string;
	readonly observation: WaitObservationProposal;
}

export interface WorkCaseWait {
	readonly workCaseWaitId: string;
	readonly externalCondition: string;
	readonly resumePredicate: string;
	readonly observation: {
		readonly kind: "human" | "tool" | "external";
		readonly observationId: string;
		readonly source: string;
		readonly basis: readonly string[];
	};
}

export interface WaitingWorkCase
	extends Omit<ActiveWorkCase, "status" | "revisionId"> {
	readonly status: "waiting";
	readonly revisionId: string;
	readonly priorRevisionId: string;
	readonly wait: WorkCaseWait;
}

export type WaitWorkCaseResult =
	| { readonly status: "waiting"; readonly value: WaitingWorkCase }
	| {
			readonly status: "invalid";
			readonly error: {
				readonly code:
					| "stale-work-case"
					| "invalid-work-case-inventory"
					| "identity-mismatch"
					| "observation-required"
					| "invalid-wait-condition";
				readonly path: string;
				readonly message: string;
			};
	  };

function invalid(
	code: Extract<WaitWorkCaseResult, { status: "invalid" }>["error"]["code"],
	path: string,
	message: string,
): WaitWorkCaseResult {
	return { status: "invalid", error: { code, path, message } };
}

/** Waits only on an observed external condition with an observable resume rule. */
export function waitWorkCase(
	workCase: ActiveWorkCase,
	proposal: WaitWorkCaseProposal,
): WaitWorkCaseResult {
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
			"Wait proposal does not bind the current Work Case revision",
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
			"Waiting requires a human, tool, or external Observation",
		);
	}
	const externalCondition = canonicalContinuityText(proposal.externalCondition);
	const resumePredicate = canonicalContinuityText(proposal.resumePredicate);
	const observationId = canonicalContinuityText(
		proposal.observation.observationId,
	);
	const source = canonicalContinuityText(proposal.observation.source);
	const basis = canonicalContinuityBasis(proposal.observation.basis);
	if (
		externalCondition === undefined ||
		resumePredicate === undefined ||
		observationId === undefined ||
		source === undefined ||
		basis === undefined
	) {
		return invalid(
			"invalid-wait-condition",
			"proposal",
			"External condition, resume predicate, and Observation must be explicit",
		);
	}
	const observation = Object.freeze({
		kind: proposal.observation.kind,
		observationId,
		source,
		basis,
	});
	const workCaseWaitId = hashIdentity(
		"work_case_wait",
		WORK_CASE_WAIT_VERSION,
		[
			workCase.workCaseId,
			workCase.revisionId,
			externalCondition,
			resumePredicate,
			observation.kind,
			observationId,
			source,
			...basis,
		],
	);
	return {
		status: "waiting",
		value: Object.freeze({
			...workCase,
			status: "waiting",
			priorRevisionId: workCase.revisionId,
			revisionId: hashIdentity(
				"work_case_wait_revision",
				WORK_CASE_WAIT_VERSION,
				[workCase.revisionId, workCaseWaitId],
			),
			wait: Object.freeze({
				workCaseWaitId,
				externalCondition,
				resumePredicate,
				observation,
			}),
		}),
	};
}
