import { hashIdentity } from "../identity/hash-identity.ts";
import type {
	BoundCapability,
	BoundUnstructuredCapability,
} from "./bind-capability.ts";

export const CAPABILITY_ASSIGNMENT_VERSION =
	"developer-capability-assignment/v1";

const APPLICABILITY_STATUSES: ReadonlySet<string> = new Set([
	"applicable",
	"not-applicable",
	"needs-context",
]);

export type CapabilityApplicabilityStatus =
	| "applicable"
	| "not-applicable"
	| "needs-context";

export interface ApplicabilityTarget {
	readonly workCaseId: string;
	readonly judgmentId: string;
	readonly contributionNeedId: string;
	readonly capability: BoundCapability | BoundUnstructuredCapability;
}

export interface CapabilityApplicabilityProposal {
	readonly workCaseId: string;
	readonly judgmentId: string;
	readonly contributionNeedId: string;
	readonly capabilityRevisionId: string;
	readonly status: CapabilityApplicabilityStatus;
	readonly matchedWhen: readonly string[];
	readonly matchedUnless: readonly string[];
	readonly basis: readonly string[];
	readonly missingContext: readonly string[];
}

export interface AcceptedApplicabilityAssessment {
	readonly workCaseId: string;
	readonly judgmentId: string;
	readonly contributionNeedId: string;
	readonly capabilityId: string;
	readonly capabilityRevisionId: string;
	readonly status: CapabilityApplicabilityStatus;
	readonly matchedWhen: readonly string[];
	readonly matchedUnless: readonly string[];
	readonly basis: readonly string[];
	readonly missingContext: readonly string[];
}

export interface CapabilityAssignment {
	readonly assignmentId: string;
	readonly workCaseId: string;
	readonly judgmentId: string;
	readonly contributionNeedId: string;
	readonly capabilityId: string;
	readonly capabilityRevisionId: string;
	readonly applicabilityBasis: readonly string[];
	readonly matchedWhen: readonly string[];
}

export type ApplicabilityAcceptanceErrorCode =
	| "invalid-target-id"
	| "unsupported-status"
	| "identity-mismatch"
	| "empty-basis"
	| "empty-context-item"
	| "duplicate-value"
	| "undeclared-condition"
	| "applicable-without-when"
	| "excluded-by-unless"
	| "not-applicable-with-positive-match"
	| "missing-context-required"
	| "decisive-unless-cannot-wait"
	| "unexpected-missing-context";

export interface ApplicabilityAcceptanceError {
	readonly code: ApplicabilityAcceptanceErrorCode;
	readonly path: string;
	readonly message: string;
}

export type ApplicabilityAcceptanceResult =
	| {
			readonly status: "assigned";
			readonly assessment: AcceptedApplicabilityAssessment;
			readonly assignment: CapabilityAssignment;
	  }
	| {
			readonly status: "not-applicable" | "needs-context";
			readonly assessment: AcceptedApplicabilityAssessment;
	  }
	| {
			readonly status: "invalid";
			readonly error: ApplicabilityAcceptanceError;
	  };

type CanonicalListResult =
	| { readonly ok: true; readonly value: readonly string[] }
	| {
			readonly ok: false;
			readonly error: ApplicabilityAcceptanceError;
	  };

function invalid(
	code: ApplicabilityAcceptanceErrorCode,
	path: string,
	message: string,
): ApplicabilityAcceptanceResult {
	return { status: "invalid", error: { code, path, message } };
}

function validId(id: string): boolean {
	return id.length > 0 && id === id.trim() && !id.includes("\0");
}

function normalizeList(
	values: readonly string[],
	path: string,
	emptyCode: "empty-basis" | "empty-context-item",
): CanonicalListResult {
	const normalized: string[] = [];
	const seen = new Set<string>();
	for (let index = 0; index < values.length; index += 1) {
		const value = values[index]?.trim() ?? "";
		if (value.length === 0) {
			return {
				ok: false,
				error: {
					code: emptyCode,
					path: `${path}[${index}]`,
					message: "Expected a nonblank value",
				},
			};
		}
		if (seen.has(value)) {
			return {
				ok: false,
				error: {
					code: "duplicate-value",
					path: `${path}[${index}]`,
					message: "Value duplicates an earlier normalized value",
				},
			};
		}
		seen.add(value);
		normalized.push(value);
	}
	return { ok: true, value: Object.freeze(normalized) };
}

function canonicalMatches(
	proposed: readonly string[],
	declared: readonly string[],
	path: string,
	referenceOnly: readonly string[] = [],
): CanonicalListResult {
	const normalized = normalizeList(proposed, path, "empty-context-item");
	if (!normalized.ok) return normalized;
	const proposedSet = new Set(normalized.value);
	for (const condition of proposedSet) {
		if (!declared.includes(condition)) {
			const exactConditions =
				declared.length > 0 ? declared.join(" | ") : "none";
			const message = referenceOnly.includes(condition)
				? `Condition belongs to Reference selection, not Capability applicability: ${condition}. Use it only when selecting References. Exact Capability conditions for ${path}: ${exactConditions}`
				: `Condition is not declared by the Capability: ${condition}. Exact Capability conditions for ${path}: ${exactConditions}`;
			return {
				ok: false,
				error: {
					code: "undeclared-condition",
					path,
					message,
				},
			};
		}
	}
	return {
		ok: true,
		value: Object.freeze(
			declared.filter((condition) => proposedSet.has(condition)),
		),
	};
}

function isStructuredCapability(
	capability: BoundCapability | BoundUnstructuredCapability,
): capability is BoundCapability {
	return "toc" in capability;
}

function checkTarget(
	target: ApplicabilityTarget,
): ApplicabilityAcceptanceResult | undefined {
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
	return undefined;
}

function checkIdentity(
	target: ApplicabilityTarget,
	proposal: CapabilityApplicabilityProposal,
): ApplicabilityAcceptanceResult | undefined {
	for (const [path, actual, expected] of [
		["proposal.workCaseId", proposal.workCaseId, target.workCaseId],
		["proposal.judgmentId", proposal.judgmentId, target.judgmentId],
		[
			"proposal.contributionNeedId",
			proposal.contributionNeedId,
			target.contributionNeedId,
		],
		[
			"proposal.capabilityRevisionId",
			proposal.capabilityRevisionId,
			target.capability.capabilityRevisionId,
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

function assessStatus(
	proposal: CapabilityApplicabilityProposal,
	matchedWhen: readonly string[],
	matchedUnless: readonly string[],
	missingContext: readonly string[],
	requiresWhenMatch: boolean,
): ApplicabilityAcceptanceResult | undefined {
	if (!APPLICABILITY_STATUSES.has(proposal.status)) {
		return invalid(
			"unsupported-status",
			"proposal.status",
			`Unsupported applicability status ${proposal.status}`,
		);
	}
	if (proposal.status !== "needs-context" && missingContext.length > 0) {
		return invalid(
			"unexpected-missing-context",
			"proposal.missingContext",
			"Only needs-context may carry missing context",
		);
	}
	if (proposal.status === "applicable") {
		if (requiresWhenMatch && matchedWhen.length === 0) {
			return invalid(
				"applicable-without-when",
				"proposal.matchedWhen",
				"Structured applicability requires at least one declared when match",
			);
		}
		if (matchedUnless.length > 0) {
			return invalid(
				"excluded-by-unless",
				"proposal.matchedUnless",
				"A matched unless condition overrides applicability",
			);
		}
		return undefined;
	}
	if (proposal.status === "not-applicable") {
		if (matchedWhen.length > 0 && matchedUnless.length === 0) {
			return invalid(
				"not-applicable-with-positive-match",
				"proposal.status",
				"A positive when match requires an excluding unless match",
			);
		}
		return undefined;
	}
	if (matchedUnless.length > 0) {
		return invalid(
			"decisive-unless-cannot-wait",
			"proposal.matchedUnless",
			"A matched unless condition is already not-applicable",
		);
	}
	if (missingContext.length === 0) {
		return invalid(
			"missing-context-required",
			"proposal.missingContext",
			"Needs-context requires at least one missing context item",
		);
	}
	return undefined;
}

interface AssessmentEvidence {
	readonly matchedWhen: readonly string[];
	readonly matchedUnless: readonly string[];
	readonly basis: readonly string[];
	readonly missingContext: readonly string[];
}

function makeAssessment(
	target: ApplicabilityTarget,
	proposal: CapabilityApplicabilityProposal,
	evidence: AssessmentEvidence,
): AcceptedApplicabilityAssessment {
	return Object.freeze({
		workCaseId: target.workCaseId,
		judgmentId: target.judgmentId,
		contributionNeedId: target.contributionNeedId,
		capabilityId: target.capability.capabilityId,
		capabilityRevisionId: target.capability.capabilityRevisionId,
		status: proposal.status,
		...evidence,
	});
}

function makeAssignment(
	assessment: AcceptedApplicabilityAssessment,
): CapabilityAssignment {
	const assignmentId = hashIdentity("assign", CAPABILITY_ASSIGNMENT_VERSION, [
		assessment.workCaseId,
		assessment.judgmentId,
		assessment.contributionNeedId,
		assessment.capabilityRevisionId,
		...assessment.matchedWhen,
		...assessment.basis,
	]);
	return Object.freeze({
		assignmentId,
		workCaseId: assessment.workCaseId,
		judgmentId: assessment.judgmentId,
		contributionNeedId: assessment.contributionNeedId,
		capabilityId: assessment.capabilityId,
		capabilityRevisionId: assessment.capabilityRevisionId,
		applicabilityBasis: assessment.basis,
		matchedWhen: assessment.matchedWhen,
	});
}

/** Accepts one refined model-neutral applicability proposal for one target. */
export function acceptCapabilityApplicability(
	target: ApplicabilityTarget,
	proposal: CapabilityApplicabilityProposal,
): ApplicabilityAcceptanceResult {
	const targetFailure = checkTarget(target);
	if (targetFailure !== undefined) return targetFailure;
	const identityFailure = checkIdentity(target, proposal);
	if (identityFailure !== undefined) return identityFailure;

	const structured = isStructuredCapability(target.capability);
	const referenceOnlyConditions = structured
		? target.capability.toc.references.flatMap((reference) => reference.when)
		: [];
	const matchedWhen = canonicalMatches(
		proposal.matchedWhen,
		structured ? target.capability.toc.when : [],
		"proposal.matchedWhen",
		referenceOnlyConditions,
	);
	if (!matchedWhen.ok) return { status: "invalid", error: matchedWhen.error };
	const matchedUnless = canonicalMatches(
		proposal.matchedUnless,
		structured ? target.capability.toc.unless : [],
		"proposal.matchedUnless",
		referenceOnlyConditions,
	);
	if (!matchedUnless.ok)
		return { status: "invalid", error: matchedUnless.error };
	const basis = normalizeList(proposal.basis, "proposal.basis", "empty-basis");
	if (!basis.ok) return { status: "invalid", error: basis.error };
	if (basis.value.length === 0) {
		return invalid(
			"empty-basis",
			"proposal.basis",
			"Applicability assessment requires explicit basis",
		);
	}
	const missingContext = normalizeList(
		proposal.missingContext,
		"proposal.missingContext",
		"empty-context-item",
	);
	if (!missingContext.ok) {
		return { status: "invalid", error: missingContext.error };
	}
	const statusFailure = assessStatus(
		proposal,
		matchedWhen.value,
		matchedUnless.value,
		missingContext.value,
		structured,
	);
	if (statusFailure !== undefined) return statusFailure;

	const assessment = makeAssessment(target, proposal, {
		matchedWhen: matchedWhen.value,
		matchedUnless: matchedUnless.value,
		basis: basis.value,
		missingContext: missingContext.value,
	});
	if (assessment.status === "applicable") {
		return {
			status: "assigned",
			assessment,
			assignment: makeAssignment(assessment),
		};
	}
	return { status: assessment.status, assessment };
}
