import { hashIdentity } from "../identity/hash-identity.ts";
import type { SealedSkillContext } from "../io/seal-skill-context.ts";
import type { CapabilityAssignment } from "../routing/accept-applicability.ts";

export const SKILL_CONTRIBUTION_VERSION = "developer-skill-contribution/v1";

const LOCAL_STATUSES: ReadonlySet<string> = new Set(["resolved", "partial"]);
const APPLICATION_STATUSES: ReadonlySet<string> = new Set([
	"applied",
	"limited",
]);
const RESIDUAL_NEED_KINDS: ReadonlySet<string> = new Set([
	"residual",
	"emergent",
]);
const PROVENANCE_KINDS: ReadonlySet<string> = new Set([
	"model",
	"human",
	"tool",
	"external",
]);

export type ContributionLocalStatus = "resolved" | "partial";
export type ReferenceApplicationStatus = "applied" | "limited";
export type ResidualNeedKind = "residual" | "emergent";
export type ContributionProvenanceKind =
	| "model"
	| "human"
	| "tool"
	| "external";

export interface ReferenceApplicationProposal {
	readonly path: string;
	readonly status: ReferenceApplicationStatus;
	readonly application: string;
}

export interface ResidualNeedProposal {
	readonly kind: ResidualNeedKind;
	readonly description: string;
	readonly basis: readonly string[];
}

export interface ContributionProposalProvenance {
	readonly kind: ContributionProvenanceKind;
	readonly source: string;
}

export interface SkillContributionProposal {
	readonly workCaseId: string;
	readonly judgmentId: string;
	readonly contributionNeedId: string;
	readonly assignmentId: string;
	readonly capabilityId: string;
	readonly capabilityRevisionId: string;
	readonly sealedContextId: string;
	readonly localStatus: ContributionLocalStatus;
	readonly result: string;
	readonly referenceApplications: readonly ReferenceApplicationProposal[];
	readonly limitations: readonly string[];
	readonly residualNeeds: readonly ResidualNeedProposal[];
	readonly provenance: ContributionProposalProvenance;
}

export interface ReferenceApplication {
	readonly path: string;
	readonly status: ReferenceApplicationStatus;
	readonly application: string;
}

export interface ResidualNeed {
	readonly kind: ResidualNeedKind;
	readonly description: string;
	readonly basis: readonly string[];
}

export interface SkillContribution {
	readonly contributionId: string;
	readonly workCaseId: string;
	readonly judgmentId: string;
	readonly contributionNeedId: string;
	readonly assignmentId: string;
	readonly capabilityId: string;
	readonly capabilityRevisionId: string;
	readonly sealedContextId: string;
	readonly localStatus: ContributionLocalStatus;
	readonly result: string;
	readonly referenceApplications: readonly ReferenceApplication[];
	readonly limitations: readonly string[];
	readonly residualNeeds: readonly ResidualNeed[];
	readonly provenance: ContributionProposalProvenance;
}

export type SkillContributionErrorCode =
	| "identity-mismatch"
	| "unsupported-local-status"
	| "empty-result"
	| "reference-accounting"
	| "unsupported-application-status"
	| "empty-application"
	| "invalid-limitation"
	| "invalid-residual-need"
	| "duplicate-value"
	| "partial-without-limitation"
	| "resolved-with-residual"
	| "invalid-provenance";

export interface SkillContributionError {
	readonly code: SkillContributionErrorCode;
	readonly path: string;
	readonly message: string;
}

export type SkillContributionAcceptanceResult =
	| { readonly status: "accepted"; readonly value: SkillContribution }
	| { readonly status: "invalid"; readonly error: SkillContributionError };

type CanonicalResult<T> =
	| { readonly ok: true; readonly value: T }
	| { readonly ok: false; readonly error: SkillContributionError };

function invalid(
	code: SkillContributionErrorCode,
	path: string,
	message: string,
): SkillContributionAcceptanceResult {
	return { status: "invalid", error: { code, path, message } };
}

function canonicalText(
	value: string,
	code: SkillContributionErrorCode,
	path: string,
): CanonicalResult<string> {
	const normalized = value.trim();
	if (normalized.length === 0) {
		return {
			ok: false,
			error: { code, path, message: "Expected a nonblank value" },
		};
	}
	return { ok: true, value: normalized };
}

function canonicalList(
	values: readonly string[],
	path: string,
	invalidCode: SkillContributionErrorCode,
): CanonicalResult<readonly string[]> {
	const normalized: string[] = [];
	const seen = new Set<string>();
	for (let index = 0; index < values.length; index += 1) {
		const item = canonicalText(
			values[index] ?? "",
			invalidCode,
			`${path}[${index}]`,
		);
		if (!item.ok) return item;
		if (seen.has(item.value)) {
			return {
				ok: false,
				error: {
					code: "duplicate-value",
					path: `${path}[${index}]`,
					message: "Value duplicates an earlier normalized value",
				},
			};
		}
		seen.add(item.value);
		normalized.push(item.value);
	}
	return { ok: true, value: Object.freeze(normalized) };
}

function checkIdentity(
	assignment: CapabilityAssignment,
	context: SealedSkillContext,
	proposal: SkillContributionProposal,
): SkillContributionAcceptanceResult | undefined {
	for (const [path, actual, expected] of [
		["context.workCaseId", context.workCaseId, assignment.workCaseId],
		["context.judgmentId", context.judgmentId, assignment.judgmentId],
		[
			"context.contributionNeedId",
			context.contributionNeedId,
			assignment.contributionNeedId,
		],
		["context.assignmentId", context.assignmentId, assignment.assignmentId],
		["context.capabilityId", context.capabilityId, assignment.capabilityId],
		[
			"context.capabilityRevisionId",
			context.capabilityRevisionId,
			assignment.capabilityRevisionId,
		],
		["proposal.workCaseId", proposal.workCaseId, assignment.workCaseId],
		["proposal.judgmentId", proposal.judgmentId, assignment.judgmentId],
		[
			"proposal.contributionNeedId",
			proposal.contributionNeedId,
			assignment.contributionNeedId,
		],
		["proposal.assignmentId", proposal.assignmentId, assignment.assignmentId],
		["proposal.capabilityId", proposal.capabilityId, assignment.capabilityId],
		[
			"proposal.capabilityRevisionId",
			proposal.capabilityRevisionId,
			assignment.capabilityRevisionId,
		],
		[
			"proposal.sealedContextId",
			proposal.sealedContextId,
			context.sealedContextId,
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

function canonicalApplications(
	selectedPaths: readonly string[],
	proposals: readonly ReferenceApplicationProposal[],
): CanonicalResult<readonly ReferenceApplication[]> {
	const selected = new Set(selectedPaths);
	const byPath = new Map<string, ReferenceApplication>();
	for (const [index, proposal] of proposals.entries()) {
		if (!selected.has(proposal.path) || byPath.has(proposal.path)) {
			return {
				ok: false,
				error: {
					code: "reference-accounting",
					path: `proposal.referenceApplications[${index}].path`,
					message: "Reference must be selected and accounted exactly once",
				},
			};
		}
		if (!APPLICATION_STATUSES.has(proposal.status)) {
			return {
				ok: false,
				error: {
					code: "unsupported-application-status",
					path: `proposal.referenceApplications[${index}].status`,
					message: `Unsupported application status ${proposal.status}`,
				},
			};
		}
		const application = canonicalText(
			proposal.application,
			"empty-application",
			`proposal.referenceApplications[${index}].application`,
		);
		if (!application.ok) return application;
		byPath.set(
			proposal.path,
			Object.freeze({
				path: proposal.path,
				status: proposal.status,
				application: application.value,
			}),
		);
	}
	if (byPath.size !== selectedPaths.length) {
		return {
			ok: false,
			error: {
				code: "reference-accounting",
				path: "proposal.referenceApplications",
				message: "Every selected Reference requires one application",
			},
		};
	}
	const ordered: ReferenceApplication[] = [];
	for (const path of selectedPaths) {
		const application = byPath.get(path);
		if (application === undefined) {
			return {
				ok: false,
				error: {
					code: "reference-accounting",
					path: "proposal.referenceApplications",
					message: `Selected Reference has no application: ${path}`,
				},
			};
		}
		ordered.push(application);
	}
	return { ok: true, value: Object.freeze(ordered) };
}

function canonicalResidualNeeds(
	proposals: readonly ResidualNeedProposal[],
): CanonicalResult<readonly ResidualNeed[]> {
	const needs: ResidualNeed[] = [];
	const descriptions = new Set<string>();
	for (const [index, proposal] of proposals.entries()) {
		if (!RESIDUAL_NEED_KINDS.has(proposal.kind)) {
			return {
				ok: false,
				error: {
					code: "invalid-residual-need",
					path: `proposal.residualNeeds[${index}].kind`,
					message: `Unsupported residual Need kind ${proposal.kind}`,
				},
			};
		}
		const description = canonicalText(
			proposal.description,
			"invalid-residual-need",
			`proposal.residualNeeds[${index}].description`,
		);
		if (!description.ok) return description;
		if (descriptions.has(description.value)) {
			return {
				ok: false,
				error: {
					code: "duplicate-value",
					path: `proposal.residualNeeds[${index}].description`,
					message: "Residual Need duplicates an earlier description",
				},
			};
		}
		const basis = canonicalList(
			proposal.basis,
			`proposal.residualNeeds[${index}].basis`,
			"invalid-residual-need",
		);
		if (!basis.ok) return basis;
		if (basis.value.length === 0) {
			return {
				ok: false,
				error: {
					code: "invalid-residual-need",
					path: `proposal.residualNeeds[${index}].basis`,
					message: "Residual Need requires explicit basis",
				},
			};
		}
		descriptions.add(description.value);
		needs.push(
			Object.freeze({
				kind: proposal.kind,
				description: description.value,
				basis: basis.value,
			}),
		);
	}
	return { ok: true, value: Object.freeze(needs) };
}

function canonicalProvenance(
	proposal: ContributionProposalProvenance,
): CanonicalResult<ContributionProposalProvenance> {
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
	const source = canonicalText(
		proposal.source,
		"invalid-provenance",
		"proposal.provenance.source",
	);
	if (!source.ok) return source;
	return {
		ok: true,
		value: Object.freeze({ kind: proposal.kind, source: source.value }),
	};
}

interface ContributionIdentityInput {
	readonly assignmentId: string;
	readonly sealedContextId: string;
	readonly localStatus: ContributionLocalStatus;
	readonly result: string;
	readonly applications: readonly ReferenceApplication[];
	readonly limitations: readonly string[];
	readonly residualNeeds: readonly ResidualNeed[];
}

function identityParts(input: ContributionIdentityInput): string[] {
	const parts = [
		input.assignmentId,
		input.sealedContextId,
		input.localStatus,
		input.result,
		"applications",
		String(input.applications.length),
	];
	for (const application of input.applications) {
		parts.push(application.path, application.status, application.application);
	}
	parts.push(
		"limitations",
		String(input.limitations.length),
		...input.limitations,
	);
	parts.push("residual-needs", String(input.residualNeeds.length));
	for (const need of input.residualNeeds) {
		parts.push(
			need.kind,
			need.description,
			String(need.basis.length),
			...need.basis,
		);
	}
	return parts;
}

/** Accepts one Skill-local result without granting Coverage or Conclusion. */
export function acceptSkillContribution(
	assignment: CapabilityAssignment,
	context: SealedSkillContext,
	proposal: SkillContributionProposal,
): SkillContributionAcceptanceResult {
	const identityFailure = checkIdentity(assignment, context, proposal);
	if (identityFailure !== undefined) return identityFailure;
	if (!LOCAL_STATUSES.has(proposal.localStatus)) {
		return invalid(
			"unsupported-local-status",
			"proposal.localStatus",
			`Unsupported local status ${proposal.localStatus}`,
		);
	}
	const result = canonicalText(
		proposal.result,
		"empty-result",
		"proposal.result",
	);
	if (!result.ok) return { status: "invalid", error: result.error };
	const applications = canonicalApplications(
		context.selectedPaths,
		proposal.referenceApplications,
	);
	if (!applications.ok) return { status: "invalid", error: applications.error };
	const limitations = canonicalList(
		proposal.limitations,
		"proposal.limitations",
		"invalid-limitation",
	);
	if (!limitations.ok) return { status: "invalid", error: limitations.error };
	const residualNeeds = canonicalResidualNeeds(proposal.residualNeeds);
	if (!residualNeeds.ok) {
		return { status: "invalid", error: residualNeeds.error };
	}
	const provenance = canonicalProvenance(proposal.provenance);
	if (!provenance.ok) return { status: "invalid", error: provenance.error };

	const residual = residualNeeds.value.some((need) => need.kind === "residual");
	const limitedApplication = applications.value.some(
		(application) => application.status === "limited",
	);
	if (
		proposal.localStatus === "partial" &&
		limitations.value.length === 0 &&
		!residual &&
		!limitedApplication
	) {
		return invalid(
			"partial-without-limitation",
			"proposal.localStatus",
			"Partial Contribution requires a limitation or residual Need",
		);
	}
	if (proposal.localStatus === "resolved" && residual) {
		return invalid(
			"resolved-with-residual",
			"proposal.localStatus",
			"Resolved local status cannot retain a residual local Need",
		);
	}

	const contributionId = hashIdentity(
		"contribution",
		SKILL_CONTRIBUTION_VERSION,
		identityParts({
			assignmentId: assignment.assignmentId,
			sealedContextId: context.sealedContextId,
			localStatus: proposal.localStatus,
			result: result.value,
			applications: applications.value,
			limitations: limitations.value,
			residualNeeds: residualNeeds.value,
		}),
	);
	return {
		status: "accepted",
		value: Object.freeze({
			contributionId,
			workCaseId: assignment.workCaseId,
			judgmentId: assignment.judgmentId,
			contributionNeedId: assignment.contributionNeedId,
			assignmentId: assignment.assignmentId,
			capabilityId: assignment.capabilityId,
			capabilityRevisionId: assignment.capabilityRevisionId,
			sealedContextId: context.sealedContextId,
			localStatus: proposal.localStatus,
			result: result.value,
			referenceApplications: applications.value,
			limitations: limitations.value,
			residualNeeds: residualNeeds.value,
			provenance: provenance.value,
		}),
	};
}
