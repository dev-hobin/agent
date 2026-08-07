import { hashIdentity, type IdentityPart } from "../identity/hash-identity.ts";
import type {
	ContributionLocalStatus,
	ContributionProposalProvenance,
	ResidualNeed,
	ResidualNeedProposal,
} from "./accept-skill-contribution.ts";

const MAX_HOST_CONTRIBUTION_TEXT = 20_000;
const MAX_HOST_CONTRIBUTION_ITEMS = 32;

export interface HostContributionTarget {
	readonly workCaseId: string;
	readonly judgmentId: string;
	readonly contributionNeedId: string;
}

export interface HostContributionObservation {
	readonly observationId: string;
	readonly kind: "human" | "tool";
	readonly source: string;
	readonly statement: string;
	readonly evidenceFingerprint: string;
	readonly basis: readonly string[];
}

export interface HostContributionProposal extends HostContributionTarget {
	readonly localStatus: ContributionLocalStatus;
	readonly result: string;
	readonly limitations: readonly string[];
	readonly residualNeeds: readonly ResidualNeedProposal[];
	readonly basis: readonly string[];
	readonly provenance: ContributionProposalProvenance;
}

export interface HostContribution extends HostContributionTarget {
	readonly contributionId: string;
	readonly observationId: string;
	readonly observationKind: "human" | "tool";
	readonly observationSource: string;
	readonly evidenceFingerprint: string;
	readonly localStatus: ContributionLocalStatus;
	readonly result: string;
	readonly limitations: readonly string[];
	readonly residualNeeds: readonly ResidualNeed[];
	readonly basis: readonly string[];
	readonly provenance: ContributionProposalProvenance;
}

export type HostContributionAcceptanceResult =
	| { readonly status: "accepted"; readonly value: HostContribution }
	| { readonly status: "invalid"; readonly message: string };

function text(value: string): string | undefined {
	const canonical = value.trim();
	return canonical && canonical.length <= MAX_HOST_CONTRIBUTION_TEXT
		? canonical
		: undefined;
}

function list(
	values: readonly string[],
	allowEmpty: boolean,
): readonly string[] | undefined {
	if (values.length > MAX_HOST_CONTRIBUTION_ITEMS) return undefined;
	const canonical = values.map(text);
	if (canonical.some((value) => value === undefined)) return undefined;
	const result = canonical as string[];
	if (!allowEmpty && result.length === 0) return undefined;
	if (new Set(result).size !== result.length) return undefined;
	return Object.freeze(
		[...result].sort((left, right) => left.localeCompare(right)),
	);
}

function residualNeeds(
	values: readonly ResidualNeedProposal[],
): readonly ResidualNeed[] | undefined {
	if (values.length > MAX_HOST_CONTRIBUTION_ITEMS) return undefined;
	const accepted: ResidualNeed[] = [];
	for (const value of values) {
		const description = text(value.description);
		const basis = list(value.basis, false);
		if (
			(value.kind !== "residual" && value.kind !== "emergent") ||
			!description ||
			!basis
		)
			return undefined;
		accepted.push(Object.freeze({ kind: value.kind, description, basis }));
	}
	const keys = accepted.map((value) => `${value.kind}\0${value.description}`);
	if (new Set(keys).size !== keys.length) return undefined;
	return Object.freeze(
		accepted.sort((left, right) =>
			`${left.kind}\0${left.description}`.localeCompare(
				`${right.kind}\0${right.description}`,
			),
		),
	);
}

interface CanonicalHostObservation {
	readonly statement: string;
	readonly basis: readonly string[];
}

function canonicalObservation(
	observation: HostContributionObservation,
): CanonicalHostObservation | undefined {
	if (observation.kind !== "human" && observation.kind !== "tool")
		return undefined;
	if (
		!text(observation.observationId) ||
		!text(observation.source) ||
		!text(observation.evidenceFingerprint)
	)
		return undefined;
	const statement = text(observation.statement);
	const basis = list(observation.basis, false);
	return statement && basis ? { statement, basis } : undefined;
}

interface CanonicalHostContent {
	readonly result: string;
	readonly limitations: readonly string[];
	readonly residualNeeds: readonly ResidualNeed[];
	readonly basis: readonly string[];
}

function canonicalContent(
	proposal: HostContributionProposal,
): CanonicalHostContent | undefined {
	if (proposal.localStatus !== "resolved" && proposal.localStatus !== "partial")
		return undefined;
	const result = text(proposal.result);
	const limitations = list(proposal.limitations, true);
	const acceptedResidualNeeds = residualNeeds(proposal.residualNeeds);
	const basis = list(proposal.basis, false);
	if (!result || !limitations || !acceptedResidualNeeds || !basis)
		return undefined;
	if (
		proposal.localStatus === "resolved" &&
		acceptedResidualNeeds.some((need) => need.kind === "residual")
	)
		return undefined;
	return { result, limitations, residualNeeds: acceptedResidualNeeds, basis };
}

function contributionIdentityParts(
	target: HostContributionTarget,
	observation: HostContributionObservation,
	canonicalObservationValue: CanonicalHostObservation,
	proposal: HostContributionProposal,
	content: CanonicalHostContent,
	basis: readonly string[],
): IdentityPart[] {
	return [
		target.workCaseId,
		target.judgmentId,
		target.contributionNeedId,
		observation.observationId,
		observation.kind,
		observation.source,
		observation.evidenceFingerprint,
		canonicalObservationValue.statement,
		proposal.localStatus,
		content.result,
		...content.limitations,
		...content.residualNeeds.flatMap((need) => [
			need.kind,
			need.description,
			...need.basis,
		]),
		...basis,
	];
}

/** Accepts a host-observed Contribution without granting Coverage or Conclusion. */
export function acceptHostContribution(
	target: HostContributionTarget,
	observation: HostContributionObservation,
	proposal: HostContributionProposal,
): HostContributionAcceptanceResult {
	if (
		proposal.workCaseId !== target.workCaseId ||
		proposal.judgmentId !== target.judgmentId ||
		proposal.contributionNeedId !== target.contributionNeedId
	) {
		return {
			status: "invalid",
			message: "Host Contribution target is stale or cross-boundary",
		};
	}
	const acceptedObservation = canonicalObservation(observation);
	const content = canonicalContent(proposal);
	if (!acceptedObservation || !content) {
		return {
			status: "invalid",
			message:
				"Host Contribution content is malformed, inconsistent, or unbounded",
		};
	}
	const basis = list([...acceptedObservation.basis, ...content.basis], false);
	if (!basis)
		return { status: "invalid", message: "Host Contribution basis is invalid" };
	return {
		status: "accepted",
		value: Object.freeze({
			...target,
			contributionId: hashIdentity(
				"contribution",
				"developer.host-contribution/v1",
				contributionIdentityParts(
					target,
					observation,
					acceptedObservation,
					proposal,
					content,
					basis,
				),
			),
			observationId: observation.observationId,
			observationKind: observation.kind,
			observationSource: observation.source,
			evidenceFingerprint: observation.evidenceFingerprint,
			localStatus: proposal.localStatus,
			result: content.result,
			limitations: content.limitations,
			residualNeeds: content.residualNeeds,
			basis,
			provenance: Object.freeze({ ...proposal.provenance }),
		}),
	};
}
