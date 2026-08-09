import { hashIdentity } from "../identity/hash-identity.ts";
import type {
	NeedCoverage,
	NeedCoverageStatus,
} from "../need-coverage/assess-need-coverage.ts";

export const JUDGMENT_CONCLUSION_VERSION = "developer-judgment-conclusion/v2";
export const JUDGMENT_REFUSAL_VERSION = "developer-judgment-refusal/v1";

const JUDGMENT_CATEGORIES: ReadonlySet<string> = new Set([
	"Contextual Adequacy",
	"Proportionate Intervention",
	"Consequence Integrity",
	"Claim Assurance",
]);
const REQUIREMENT_STATUSES: ReadonlySet<string> = new Set([
	"satisfied",
	"not-satisfied",
	"needs-context",
]);
const CLOSURE_OUTCOMES: ReadonlySet<string> = new Set(["conclude", "refuse"]);
const PROVENANCE_KINDS: ReadonlySet<string> = new Set([
	"model",
	"human",
	"tool",
	"external",
]);

export type JudgmentCategory =
	| "Contextual Adequacy"
	| "Proportionate Intervention"
	| "Consequence Integrity"
	| "Claim Assurance";

export type ClosureRequirementStatus =
	| "satisfied"
	| "not-satisfied"
	| "needs-context";

export type InterventionDisposition = "action-required" | "no-action";
export type NoActionDisposition = "outcome-attained" | "blocked" | "waiting";

export interface ClosureRequirement {
	readonly requirementId: string;
	readonly statement: string;
	readonly contributionNeedIds: readonly string[];
}

export interface JudgmentClosureContract {
	readonly workCaseId: string;
	readonly judgmentId: string;
	readonly category: JudgmentCategory;
	readonly subject: string;
	readonly contextRevisionId: string;
	readonly requirements: readonly ClosureRequirement[];
}

export interface ClosureRequirementDispositionProposal {
	readonly requirementId: string;
	readonly status: ClosureRequirementStatus;
	readonly coverageIds: readonly string[];
	readonly basis: readonly string[];
}

export interface ClosureProposalProvenance {
	readonly kind: "model" | "human" | "tool" | "external";
	readonly source: string;
}

export interface JudgmentClosureProposal {
	readonly workCaseId: string;
	readonly judgmentId: string;
	readonly category: JudgmentCategory;
	readonly contextRevisionId: string;
	readonly outcome: "conclude" | "refuse";
	readonly answer?: string;
	readonly interventionDisposition?: InterventionDisposition;
	readonly noActionDisposition?: NoActionDisposition;
	readonly refusalReasons: readonly string[];
	readonly requirementDispositions: readonly ClosureRequirementDispositionProposal[];
	readonly basis: readonly string[];
	readonly provenance: ClosureProposalProvenance;
}

export interface ClosureRequirementDisposition {
	readonly requirementId: string;
	readonly status: ClosureRequirementStatus;
	readonly coverageIds: readonly string[];
	readonly basis: readonly string[];
}

export type JudgmentClosureBlocker =
	| {
			readonly code: "requirement-unmet";
			readonly requirementId: string;
			readonly requirementStatus: Exclude<
				ClosureRequirementStatus,
				"satisfied"
			>;
	  }
	| {
			readonly code: "coverage-missing";
			readonly requirementId: string;
			readonly contributionNeedId: string;
	  }
	| {
			readonly code: "coverage-not-covered";
			readonly requirementId: string;
			readonly contributionNeedId: string;
			readonly coverageId: string;
			readonly coverageStatus: Exclude<NeedCoverageStatus, "covered">;
	  }
	| {
			readonly code: "evaluator-refused";
			readonly reason: string;
	  };

interface ClosureArtifactBase {
	readonly workCaseId: string;
	readonly judgmentId: string;
	readonly category: JudgmentCategory;
	readonly subject: string;
	readonly contextRevisionId: string;
	readonly requirementDispositions: readonly ClosureRequirementDisposition[];
	readonly coverageIds: readonly string[];
	readonly basis: readonly string[];
	readonly provenance: ClosureProposalProvenance;
}

export interface JudgmentConclusion extends ClosureArtifactBase {
	readonly conclusionId: string;
	readonly answer: string;
	readonly interventionDisposition?: InterventionDisposition;
	readonly noActionDisposition?: NoActionDisposition;
}

export interface JudgmentClosureRefusal extends ClosureArtifactBase {
	readonly refusalId: string;
	readonly proposedOutcome: "conclude" | "refuse";
	readonly blockers: readonly JudgmentClosureBlocker[];
}

export type JudgmentClosureErrorCode =
	| "invalid-contract"
	| "unsupported-category"
	| "identity-mismatch"
	| "duplicate-coverage"
	| "unmapped-coverage"
	| "requirement-accounting"
	| "unsupported-requirement-status"
	| "coverage-citation"
	| "unsupported-outcome"
	| "invalid-conclusion-answer"
	| "invalid-intervention-disposition"
	| "invalid-refusal"
	| "empty-basis"
	| "duplicate-value"
	| "invalid-provenance";

export interface JudgmentClosureError {
	readonly code: JudgmentClosureErrorCode;
	readonly path: string;
	readonly message: string;
}

export type JudgmentClosureResult =
	| { readonly status: "concluded"; readonly value: JudgmentConclusion }
	| { readonly status: "refused"; readonly value: JudgmentClosureRefusal }
	| { readonly status: "invalid"; readonly error: JudgmentClosureError };

type CanonicalResult<T> =
	| { readonly ok: true; readonly value: T }
	| { readonly ok: false; readonly error: JudgmentClosureError };

interface RequirementInventory {
	readonly ordered: readonly ClosureRequirement[];
	readonly byId: ReadonlyMap<string, ClosureRequirement>;
	readonly mappedNeedIds: ReadonlySet<string>;
}

interface CoverageInventory {
	readonly byId: ReadonlyMap<string, NeedCoverage>;
	readonly byNeedId: ReadonlyMap<string, NeedCoverage>;
}

function invalid(
	code: JudgmentClosureErrorCode,
	path: string,
	message: string,
): JudgmentClosureResult {
	return { status: "invalid", error: { code, path, message } };
}

function validId(id: string): boolean {
	return id.length > 0 && id === id.trim() && !id.includes("\0");
}

function canonicalText(
	value: string,
	code: JudgmentClosureErrorCode,
	path: string,
): CanonicalResult<string> {
	const normalized = value.trim();
	if (normalized.length === 0 || normalized.includes("\0")) {
		return {
			ok: false,
			error: { code, path, message: "Expected a nonblank canonical value" },
		};
	}
	return { ok: true, value: normalized };
}

function canonicalList(
	values: readonly string[],
	path: string,
	invalidCode: JudgmentClosureErrorCode,
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

function buildRequirementInventory(
	contract: JudgmentClosureContract,
): CanonicalResult<RequirementInventory> {
	for (const [path, id] of [
		["contract.workCaseId", contract.workCaseId],
		["contract.judgmentId", contract.judgmentId],
		["contract.contextRevisionId", contract.contextRevisionId],
	] as const) {
		if (!validId(id)) {
			return {
				ok: false,
				error: {
					code: "invalid-contract",
					path,
					message: "Expected a canonical contract ID",
				},
			};
		}
	}
	if (!JUDGMENT_CATEGORIES.has(contract.category)) {
		return {
			ok: false,
			error: {
				code: "unsupported-category",
				path: "contract.category",
				message: `Unsupported Judgment Category ${contract.category}`,
			},
		};
	}
	const subject = canonicalText(
		contract.subject,
		"invalid-contract",
		"contract.subject",
	);
	if (!subject.ok) return subject;
	if (contract.requirements.length === 0) {
		return {
			ok: false,
			error: {
				code: "invalid-contract",
				path: "contract.requirements",
				message: "Judgment closure requires at least one Closure Requirement",
			},
		};
	}

	const ordered: ClosureRequirement[] = [];
	const byId = new Map<string, ClosureRequirement>();
	const mappedNeedIds = new Set<string>();
	for (const [index, requirement] of contract.requirements.entries()) {
		if (
			!validId(requirement.requirementId) ||
			byId.has(requirement.requirementId)
		) {
			return {
				ok: false,
				error: {
					code: "invalid-contract",
					path: `contract.requirements[${index}].requirementId`,
					message: "Closure Requirement ID must be canonical and unique",
				},
			};
		}
		const statement = canonicalText(
			requirement.statement,
			"invalid-contract",
			`contract.requirements[${index}].statement`,
		);
		if (!statement.ok) return statement;
		const needIds: string[] = [];
		const localNeeds = new Set<string>();
		for (const [
			needIndex,
			needId,
		] of requirement.contributionNeedIds.entries()) {
			if (!validId(needId) || localNeeds.has(needId)) {
				return {
					ok: false,
					error: {
						code: "invalid-contract",
						path: `contract.requirements[${index}].contributionNeedIds[${needIndex}]`,
						message:
							"Contribution Need ID must be canonical and unique per Requirement",
					},
				};
			}
			localNeeds.add(needId);
			mappedNeedIds.add(needId);
			needIds.push(needId);
		}
		const canonical = Object.freeze({
			requirementId: requirement.requirementId,
			statement: statement.value,
			contributionNeedIds: Object.freeze(needIds),
		});
		ordered.push(canonical);
		byId.set(canonical.requirementId, canonical);
	}
	return {
		ok: true,
		value: {
			ordered: Object.freeze(ordered),
			byId,
			mappedNeedIds,
		},
	};
}

function checkProposalIdentity(
	contract: JudgmentClosureContract,
	proposal: JudgmentClosureProposal,
): JudgmentClosureResult | undefined {
	for (const [path, actual, expected] of [
		["proposal.workCaseId", proposal.workCaseId, contract.workCaseId],
		["proposal.judgmentId", proposal.judgmentId, contract.judgmentId],
		["proposal.category", proposal.category, contract.category],
		[
			"proposal.contextRevisionId",
			proposal.contextRevisionId,
			contract.contextRevisionId,
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

function buildCoverageInventory(
	contract: JudgmentClosureContract,
	requirements: RequirementInventory,
	coverages: readonly NeedCoverage[],
): CanonicalResult<CoverageInventory> {
	const byId = new Map<string, NeedCoverage>();
	const byNeedId = new Map<string, NeedCoverage>();
	for (const [index, coverage] of coverages.entries()) {
		for (const [path, actual, expected] of [
			[
				`coverages[${index}].workCaseId`,
				coverage.workCaseId,
				contract.workCaseId,
			],
			[
				`coverages[${index}].judgmentId`,
				coverage.judgmentId,
				contract.judgmentId,
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
		if (
			byId.has(coverage.coverageId) ||
			byNeedId.has(coverage.contributionNeedId)
		) {
			return {
				ok: false,
				error: {
					code: "duplicate-coverage",
					path: `coverages[${index}]`,
					message: "Current Coverage inventory contains a duplicate ID or Need",
				},
			};
		}
		if (!requirements.mappedNeedIds.has(coverage.contributionNeedId)) {
			return {
				ok: false,
				error: {
					code: "unmapped-coverage",
					path: `coverages[${index}].contributionNeedId`,
					message: "Coverage does not belong to a current Closure Requirement",
				},
			};
		}
		byId.set(coverage.coverageId, coverage);
		byNeedId.set(coverage.contributionNeedId, coverage);
	}
	return { ok: true, value: { byId, byNeedId } };
}

function expectedCoverageIds(
	requirement: ClosureRequirement,
	coverages: CoverageInventory,
): readonly string[] {
	return Object.freeze(
		requirement.contributionNeedIds.flatMap((needId) => {
			const coverage = coverages.byNeedId.get(needId);
			return coverage === undefined ? [] : [coverage.coverageId];
		}),
	);
}

function canonicalCoverageCitations(
	requirement: ClosureRequirement,
	coverages: CoverageInventory,
	coverageIds: readonly string[],
	path: string,
): CanonicalResult<readonly string[]> {
	const expected = expectedCoverageIds(requirement, coverages);
	const seen = new Set<string>();
	for (const coverageId of coverageIds) {
		const coverage = coverages.byId.get(coverageId);
		if (
			coverage === undefined ||
			seen.has(coverageId) ||
			!requirement.contributionNeedIds.includes(coverage.contributionNeedId)
		) {
			return {
				ok: false,
				error: {
					code: "coverage-citation",
					path,
					message:
						"Coverage citation must be current, unique, and Requirement-bounded",
				},
			};
		}
		seen.add(coverageId);
	}
	if (
		coverageIds.length !== expected.length ||
		expected.some((coverageId) => !seen.has(coverageId))
	) {
		return {
			ok: false,
			error: {
				code: "coverage-citation",
				path,
				message:
					"Requirement must cite every current mapped Coverage exactly once",
			},
		};
	}
	return { ok: true, value: expected };
}

function canonicalRequirementDisposition(
	requirement: ClosureRequirement,
	coverages: CoverageInventory,
	proposal: ClosureRequirementDispositionProposal,
	index: number,
): CanonicalResult<ClosureRequirementDisposition> {
	if (!REQUIREMENT_STATUSES.has(proposal.status)) {
		return {
			ok: false,
			error: {
				code: "unsupported-requirement-status",
				path: `proposal.requirementDispositions[${index}].status`,
				message: `Unsupported Requirement status ${proposal.status}`,
			},
		};
	}
	const coverageIds = canonicalCoverageCitations(
		requirement,
		coverages,
		proposal.coverageIds,
		`proposal.requirementDispositions[${index}].coverageIds`,
	);
	if (!coverageIds.ok) return coverageIds;
	const basisPath = `proposal.requirementDispositions[${index}].basis`;
	const basis = canonicalList(proposal.basis, basisPath, "empty-basis");
	if (!basis.ok) return basis;
	if (basis.value.length === 0) {
		return {
			ok: false,
			error: {
				code: "empty-basis",
				path: basisPath,
				message: "Requirement disposition requires explicit basis",
			},
		};
	}
	return {
		ok: true,
		value: Object.freeze({
			requirementId: proposal.requirementId,
			status: proposal.status,
			coverageIds: coverageIds.value,
			basis: basis.value,
		}),
	};
}

function canonicalRequirementDispositions(
	requirements: RequirementInventory,
	coverages: CoverageInventory,
	proposals: readonly ClosureRequirementDispositionProposal[],
): CanonicalResult<readonly ClosureRequirementDisposition[]> {
	const byId = new Map<string, ClosureRequirementDisposition>();
	for (const [index, proposal] of proposals.entries()) {
		const requirement = requirements.byId.get(proposal.requirementId);
		if (requirement === undefined || byId.has(proposal.requirementId)) {
			return {
				ok: false,
				error: {
					code: "requirement-accounting",
					path: `proposal.requirementDispositions[${index}].requirementId`,
					message: "Requirement must be current and dispositioned exactly once",
				},
			};
		}
		const disposition = canonicalRequirementDisposition(
			requirement,
			coverages,
			proposal,
			index,
		);
		if (!disposition.ok) return disposition;
		byId.set(proposal.requirementId, disposition.value);
	}
	if (byId.size !== requirements.ordered.length) {
		return {
			ok: false,
			error: {
				code: "requirement-accounting",
				path: "proposal.requirementDispositions",
				message: "Every current Closure Requirement requires one disposition",
			},
		};
	}
	const ordered: ClosureRequirementDisposition[] = [];
	for (const requirement of requirements.ordered) {
		const disposition = byId.get(requirement.requirementId);
		if (disposition === undefined) {
			return {
				ok: false,
				error: {
					code: "requirement-accounting",
					path: "proposal.requirementDispositions",
					message: `Requirement has no disposition: ${requirement.requirementId}`,
				},
			};
		}
		ordered.push(disposition);
	}
	return { ok: true, value: Object.freeze(ordered) };
}

function canonicalProvenance(
	proposal: ClosureProposalProvenance,
): CanonicalResult<ClosureProposalProvenance> {
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

function structuralBlockers(
	requirements: RequirementInventory,
	coverages: CoverageInventory,
	dispositions: readonly ClosureRequirementDisposition[],
): readonly JudgmentClosureBlocker[] {
	const dispositionById = new Map(
		dispositions.map((disposition) => [disposition.requirementId, disposition]),
	);
	const blockers: JudgmentClosureBlocker[] = [];
	for (const requirement of requirements.ordered) {
		const disposition = dispositionById.get(requirement.requirementId);
		if (disposition === undefined) continue;
		if (disposition.status !== "satisfied") {
			blockers.push(
				Object.freeze({
					code: "requirement-unmet",
					requirementId: requirement.requirementId,
					requirementStatus: disposition.status,
				}),
			);
		}
		for (const contributionNeedId of requirement.contributionNeedIds) {
			const coverage = coverages.byNeedId.get(contributionNeedId);
			if (coverage === undefined) {
				blockers.push(
					Object.freeze({
						code: "coverage-missing",
						requirementId: requirement.requirementId,
						contributionNeedId,
					}),
				);
			} else if (coverage.status !== "covered") {
				blockers.push(
					Object.freeze({
						code: "coverage-not-covered",
						requirementId: requirement.requirementId,
						contributionNeedId,
						coverageId: coverage.coverageId,
						coverageStatus: coverage.status,
					}),
				);
			}
		}
	}
	return Object.freeze(blockers);
}

function uniqueCoverageIds(
	dispositions: readonly ClosureRequirementDisposition[],
): readonly string[] {
	const ids: string[] = [];
	const seen = new Set<string>();
	for (const disposition of dispositions) {
		for (const coverageId of disposition.coverageIds) {
			if (!seen.has(coverageId)) {
				seen.add(coverageId);
				ids.push(coverageId);
			}
		}
	}
	return Object.freeze(ids);
}

function contractIdentityParts(
	contract: JudgmentClosureContract,
	requirements: readonly ClosureRequirement[],
): string[] {
	const parts = [
		contract.workCaseId,
		contract.judgmentId,
		contract.category,
		contract.subject.trim(),
		contract.contextRevisionId,
		"requirements",
		String(requirements.length),
	];
	for (const requirement of requirements) {
		parts.push(
			requirement.requirementId,
			requirement.statement,
			String(requirement.contributionNeedIds.length),
			...requirement.contributionNeedIds,
		);
	}
	return parts;
}

function dispositionIdentityParts(
	dispositions: readonly ClosureRequirementDisposition[],
): string[] {
	const parts: string[] = [];
	for (const disposition of dispositions) {
		parts.push(
			disposition.requirementId,
			disposition.status,
			String(disposition.coverageIds.length),
			...disposition.coverageIds,
			String(disposition.basis.length),
			...disposition.basis,
		);
	}
	return parts;
}

function blockerIdentityParts(
	blockers: readonly JudgmentClosureBlocker[],
): string[] {
	const parts: string[] = [];
	for (const blocker of blockers) {
		parts.push(blocker.code);
		if (blocker.code === "requirement-unmet") {
			parts.push(blocker.requirementId, blocker.requirementStatus);
		} else if (blocker.code === "coverage-missing") {
			parts.push(blocker.requirementId, blocker.contributionNeedId);
		} else if (blocker.code === "coverage-not-covered") {
			parts.push(
				blocker.requirementId,
				blocker.contributionNeedId,
				blocker.coverageId,
				blocker.coverageStatus,
			);
		} else {
			parts.push(blocker.reason);
		}
	}
	return parts;
}

interface ValidatedClosureInput {
	readonly requirements: RequirementInventory;
	readonly coverages: CoverageInventory;
	readonly dispositions: readonly ClosureRequirementDisposition[];
	readonly basis: readonly string[];
	readonly provenance: ClosureProposalProvenance;
	readonly answer?: string;
	readonly interventionDisposition?: InterventionDisposition;
	readonly noActionDisposition?: NoActionDisposition;
	readonly refusalReasons: readonly string[];
}

interface ValidatedClosureOutcome {
	readonly answer?: string;
	readonly interventionDisposition?: InterventionDisposition;
	readonly noActionDisposition?: NoActionDisposition;
	readonly refusalReasons: readonly string[];
}

function validateClosureOutcome(
	proposal: JudgmentClosureProposal,
): CanonicalResult<ValidatedClosureOutcome> {
	if (!CLOSURE_OUTCOMES.has(proposal.outcome)) {
		return {
			ok: false,
			error: {
				code: "unsupported-outcome",
				path: "proposal.outcome",
				message: `Unsupported closure outcome ${proposal.outcome}`,
			},
		};
	}
	const refusalReasons = canonicalList(
		proposal.refusalReasons,
		"proposal.refusalReasons",
		"invalid-refusal",
	);
	if (!refusalReasons.ok) return refusalReasons;
	if (proposal.outcome === "conclude") {
		const answer = canonicalText(
			proposal.answer ?? "",
			"invalid-conclusion-answer",
			"proposal.answer",
		);
		if (!answer.ok) return answer;
		if (refusalReasons.value.length > 0) {
			return {
				ok: false,
				error: {
					code: "invalid-refusal",
					path: "proposal.refusalReasons",
					message: "Conclude outcome cannot also carry refusal reasons",
				},
			};
		}
		if (proposal.category === "Proportionate Intervention") {
			if (
				proposal.interventionDisposition !== "action-required" &&
				proposal.interventionDisposition !== "no-action"
			) {
				return {
					ok: false,
					error: {
						code: "invalid-intervention-disposition",
						path: "proposal.interventionDisposition",
						message:
							"Proportionate Intervention Conclusion requires action-required or no-action",
					},
				};
			}
			if (
				(proposal.interventionDisposition === "no-action" &&
					(proposal.noActionDisposition === undefined ||
						!(["outcome-attained", "blocked", "waiting"] as const).includes(
							proposal.noActionDisposition,
						))) ||
				(proposal.interventionDisposition === "action-required" &&
					proposal.noActionDisposition !== undefined)
			) {
				return {
					ok: false,
					error: {
						code: "invalid-intervention-disposition",
						path: "proposal.noActionDisposition",
						message:
							"no-action requires outcome-attained, blocked, or waiting; action-required cannot carry a no-Action disposition",
					},
				};
			}
			return {
				ok: true,
				value: {
					answer: answer.value,
					interventionDisposition: proposal.interventionDisposition,
					...(proposal.noActionDisposition
						? { noActionDisposition: proposal.noActionDisposition }
						: {}),
					refusalReasons: [],
				},
			};
		}
		if (
			proposal.interventionDisposition !== undefined ||
			proposal.noActionDisposition !== undefined
		) {
			return {
				ok: false,
				error: {
					code: "invalid-intervention-disposition",
					path: "proposal.interventionDisposition",
					message:
						"Only a Proportionate Intervention Conclusion may carry an intervention disposition",
				},
			};
		}
		return { ok: true, value: { answer: answer.value, refusalReasons: [] } };
	}
	if (
		proposal.answer !== undefined ||
		proposal.interventionDisposition !== undefined ||
		proposal.noActionDisposition !== undefined ||
		refusalReasons.value.length === 0
	) {
		return {
			ok: false,
			error: {
				code: "invalid-refusal",
				path: "proposal",
				message: "Refuse outcome requires reasons and cannot carry an answer",
			},
		};
	}
	return { ok: true, value: { refusalReasons: refusalReasons.value } };
}

function validateClosureInput(
	contract: JudgmentClosureContract,
	coverages: readonly NeedCoverage[],
	proposal: JudgmentClosureProposal,
): CanonicalResult<ValidatedClosureInput> {
	const requirements = buildRequirementInventory(contract);
	if (!requirements.ok) return requirements;
	const identityFailure = checkProposalIdentity(contract, proposal);
	if (identityFailure?.status === "invalid") {
		return { ok: false, error: identityFailure.error };
	}
	const outcome = validateClosureOutcome(proposal);
	if (!outcome.ok) return outcome;
	const coverageInventory = buildCoverageInventory(
		contract,
		requirements.value,
		coverages,
	);
	if (!coverageInventory.ok) return coverageInventory;
	const dispositions = canonicalRequirementDispositions(
		requirements.value,
		coverageInventory.value,
		proposal.requirementDispositions,
	);
	if (!dispositions.ok) return dispositions;
	const basis = canonicalList(proposal.basis, "proposal.basis", "empty-basis");
	if (!basis.ok) return basis;
	if (basis.value.length === 0) {
		return {
			ok: false,
			error: {
				code: "empty-basis",
				path: "proposal.basis",
				message: "Judgment closure requires explicit basis",
			},
		};
	}
	const provenance = canonicalProvenance(proposal.provenance);
	if (!provenance.ok) return provenance;
	return {
		ok: true,
		value: {
			requirements: requirements.value,
			coverages: coverageInventory.value,
			dispositions: dispositions.value,
			basis: basis.value,
			provenance: provenance.value,
			answer: outcome.value.answer,
			interventionDisposition: outcome.value.interventionDisposition,
			noActionDisposition: outcome.value.noActionDisposition,
			refusalReasons: outcome.value.refusalReasons,
		},
	};
}

function conclusionResult(
	contract: JudgmentClosureContract,
	validated: ValidatedClosureInput & { readonly answer: string },
): JudgmentClosureResult {
	const coverageIds = uniqueCoverageIds(validated.dispositions);
	const conclusionId = hashIdentity("conclusion", JUDGMENT_CONCLUSION_VERSION, [
		...contractIdentityParts(contract, validated.requirements.ordered),
		...dispositionIdentityParts(validated.dispositions),
		validated.answer,
		validated.interventionDisposition ?? "no-intervention-disposition",
		...(validated.noActionDisposition ? [validated.noActionDisposition] : []),
		String(validated.basis.length),
		...validated.basis,
	]);
	return {
		status: "concluded",
		value: Object.freeze({
			conclusionId,
			workCaseId: contract.workCaseId,
			judgmentId: contract.judgmentId,
			category: contract.category,
			subject: contract.subject.trim(),
			contextRevisionId: contract.contextRevisionId,
			answer: validated.answer,
			...(validated.interventionDisposition
				? { interventionDisposition: validated.interventionDisposition }
				: {}),
			...(validated.noActionDisposition
				? { noActionDisposition: validated.noActionDisposition }
				: {}),
			requirementDispositions: validated.dispositions,
			coverageIds,
			basis: validated.basis,
			provenance: validated.provenance,
		}),
	};
}

function refusalResult(
	contract: JudgmentClosureContract,
	proposal: JudgmentClosureProposal,
	validated: ValidatedClosureInput,
	blockers: readonly JudgmentClosureBlocker[],
): JudgmentClosureResult {
	const coverageIds = uniqueCoverageIds(validated.dispositions);
	const refusalId = hashIdentity("refusal", JUDGMENT_REFUSAL_VERSION, [
		...contractIdentityParts(contract, validated.requirements.ordered),
		proposal.outcome,
		...dispositionIdentityParts(validated.dispositions),
		...blockerIdentityParts(blockers),
		String(validated.basis.length),
		...validated.basis,
	]);
	return {
		status: "refused",
		value: Object.freeze({
			refusalId,
			workCaseId: contract.workCaseId,
			judgmentId: contract.judgmentId,
			category: contract.category,
			subject: contract.subject.trim(),
			contextRevisionId: contract.contextRevisionId,
			proposedOutcome: proposal.outcome,
			requirementDispositions: validated.dispositions,
			coverageIds,
			blockers,
			basis: validated.basis,
			provenance: validated.provenance,
		}),
	};
}

/** Produces one category-scoped Conclusion or an explicit bounded refusal. */
export function closeJudgment(
	contract: JudgmentClosureContract,
	coverages: readonly NeedCoverage[],
	proposal: JudgmentClosureProposal,
): JudgmentClosureResult {
	const validated = validateClosureInput(contract, coverages, proposal);
	if (!validated.ok) return { status: "invalid", error: validated.error };
	const structural = structuralBlockers(
		validated.value.requirements,
		validated.value.coverages,
		validated.value.dispositions,
	);
	const evaluatorBlockers = validated.value.refusalReasons.map((reason) =>
		Object.freeze({ code: "evaluator-refused" as const, reason }),
	);
	const blockers = Object.freeze([...structural, ...evaluatorBlockers]);
	if (
		proposal.outcome === "conclude" &&
		blockers.length === 0 &&
		validated.value.answer !== undefined
	) {
		return conclusionResult(contract, {
			...validated.value,
			answer: validated.value.answer,
		});
	}
	return refusalResult(contract, proposal, validated.value, blockers);
}
