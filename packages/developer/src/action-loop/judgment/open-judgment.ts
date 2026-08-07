import type { ActionCandidateProvenance } from "../action/accept-action-candidate.ts";
import { hashIdentity } from "../identity/hash-identity.ts";
import type {
	ClosureRequirement,
	JudgmentCategory,
	JudgmentClosureContract,
} from "./close-judgment.ts";

export const OPEN_JUDGMENT_VERSION = "developer-open-judgment/v1";

const CATEGORIES = new Set<JudgmentCategory>([
	"Contextual Adequacy",
	"Proportionate Intervention",
	"Consequence Integrity",
	"Claim Assurance",
]);
const PROVENANCE_KINDS = new Set(["model", "human", "tool", "external"]);
const MAX_TEXT_LENGTH = 4_096;
const MAX_REQUIREMENTS = 32;
const MAX_NEEDS_PER_REQUIREMENT = 32;
const MAX_BASIS_ITEMS = 16;

export interface JudgmentRequirementProposal {
	readonly statement: string;
	readonly contributionNeeds: readonly string[];
}

export interface JudgmentOpeningProposal {
	readonly workCaseId: string;
	readonly category: JudgmentCategory;
	readonly subject: string;
	readonly question: string;
	readonly contextRevisionId: string;
	readonly requirements: readonly JudgmentRequirementProposal[];
	readonly basis: readonly string[];
	readonly provenance: ActionCandidateProvenance;
}

export interface ContributionNeed {
	readonly contributionNeedId: string;
	readonly requirementId: string;
	readonly function: string;
}

export interface OpenJudgment extends JudgmentClosureContract {
	readonly question: string;
	readonly contributionNeeds: readonly ContributionNeed[];
	readonly basis: readonly string[];
	readonly provenance: ActionCandidateProvenance;
	readonly status: "open";
}

export type JudgmentOpeningErrorCode =
	| "invalid-id"
	| "unsupported-category"
	| "invalid-text"
	| "invalid-requirements"
	| "invalid-contribution-needs"
	| "duplicate-value"
	| "invalid-basis"
	| "invalid-provenance";

export interface JudgmentOpeningError {
	readonly code: JudgmentOpeningErrorCode;
	readonly path: string;
	readonly message: string;
}

export type JudgmentOpeningResult =
	| { readonly status: "opened"; readonly value: OpenJudgment }
	| { readonly status: "invalid"; readonly error: JudgmentOpeningError };

type CanonicalResult<T> =
	| { readonly ok: true; readonly value: T }
	| { readonly ok: false; readonly error: JudgmentOpeningError };

function invalid(
	code: JudgmentOpeningErrorCode,
	path: string,
	message: string,
): JudgmentOpeningResult {
	return { status: "invalid", error: { code, path, message } };
}

function validId(value: unknown): value is string {
	return (
		typeof value === "string" &&
		value.length > 0 &&
		value === value.trim() &&
		value.length <= MAX_TEXT_LENGTH &&
		!value.includes("\0")
	);
}

function canonicalText(value: unknown, path: string): CanonicalResult<string> {
	const text = typeof value === "string" ? value.trim() : "";
	if (text.length === 0 || text.length > MAX_TEXT_LENGTH) {
		return {
			ok: false,
			error: {
				code: "invalid-text",
				path,
				message: "Expected a bounded nonblank string",
			},
		};
	}
	return { ok: true, value: text };
}

function canonicalStrings(
	values: readonly string[],
	path: string,
	maximumItems: number,
	allowEmpty = false,
): CanonicalResult<readonly string[]> {
	if (
		!Array.isArray(values) ||
		values.length > maximumItems ||
		(!allowEmpty && values.length === 0)
	) {
		const code: JudgmentOpeningErrorCode =
			path === "proposal.basis"
				? "invalid-basis"
				: "invalid-contribution-needs";
		return {
			ok: false,
			error: {
				code,
				path,
				message: "Expected a bounded list of nonblank unique values",
			},
		};
	}
	const normalized: string[] = [];
	const seen = new Set<string>();
	for (let index = 0; index < values.length; index += 1) {
		const text = canonicalText(values[index], `${path}[${index}]`);
		if (!text.ok) return text;
		if (seen.has(text.value)) {
			return {
				ok: false,
				error: {
					code: "duplicate-value",
					path: `${path}[${index}]`,
					message: "Value duplicates an earlier normalized value",
				},
			};
		}
		seen.add(text.value);
		normalized.push(text.value);
	}
	normalized.sort((left, right) => left.localeCompare(right));
	return { ok: true, value: Object.freeze(normalized) };
}

interface CanonicalRequirement {
	readonly statement: string;
	readonly contributionNeeds: readonly string[];
}

function canonicalRequirements(
	proposals: readonly JudgmentRequirementProposal[],
): CanonicalResult<readonly CanonicalRequirement[]> {
	if (
		!Array.isArray(proposals) ||
		proposals.length === 0 ||
		proposals.length > MAX_REQUIREMENTS
	) {
		return {
			ok: false,
			error: {
				code: "invalid-requirements",
				path: "proposal.requirements",
				message: "Expected at least one bounded Closure Requirement",
			},
		};
	}
	const requirements: CanonicalRequirement[] = [];
	const statements = new Set<string>();
	for (let index = 0; index < proposals.length; index += 1) {
		const proposal = proposals[index];
		if (proposal === undefined || typeof proposal !== "object") {
			return {
				ok: false,
				error: {
					code: "invalid-requirements",
					path: `proposal.requirements[${index}]`,
					message: "Expected a Closure Requirement proposal",
				},
			};
		}
		const statement = canonicalText(
			proposal.statement,
			`proposal.requirements[${index}].statement`,
		);
		if (!statement.ok) return statement;
		if (statements.has(statement.value)) {
			return {
				ok: false,
				error: {
					code: "duplicate-value",
					path: `proposal.requirements[${index}].statement`,
					message: "Closure Requirement duplicates an earlier statement",
				},
			};
		}
		const needs = canonicalStrings(
			proposal.contributionNeeds,
			`proposal.requirements[${index}].contributionNeeds`,
			MAX_NEEDS_PER_REQUIREMENT,
		);
		if (!needs.ok) return needs;
		statements.add(statement.value);
		requirements.push(
			Object.freeze({
				statement: statement.value,
				contributionNeeds: needs.value,
			}),
		);
	}
	requirements.sort((left, right) =>
		left.statement.localeCompare(right.statement),
	);
	return { ok: true, value: Object.freeze(requirements) };
}

/** Opens one Category-scoped Judgment without selecting a Capability. */
export function openJudgment(
	proposal: JudgmentOpeningProposal,
): JudgmentOpeningResult {
	if (!validId(proposal.workCaseId) || !validId(proposal.contextRevisionId)) {
		return invalid(
			"invalid-id",
			"proposal",
			"Expected canonical Work Case and Context revision IDs",
		);
	}
	if (!CATEGORIES.has(proposal.category)) {
		return invalid(
			"unsupported-category",
			"proposal.category",
			"Unsupported Judgment Category",
		);
	}
	const subject = canonicalText(proposal.subject, "proposal.subject");
	if (!subject.ok) return { status: "invalid", error: subject.error };
	const question = canonicalText(proposal.question, "proposal.question");
	if (!question.ok) return { status: "invalid", error: question.error };
	const canonical = canonicalRequirements(proposal.requirements);
	if (!canonical.ok) return { status: "invalid", error: canonical.error };
	const basis = canonicalStrings(
		proposal.basis,
		"proposal.basis",
		MAX_BASIS_ITEMS,
	);
	if (!basis.ok) return { status: "invalid", error: basis.error };
	if (
		typeof proposal.provenance !== "object" ||
		proposal.provenance === null ||
		!PROVENANCE_KINDS.has(proposal.provenance.kind) ||
		!validId(proposal.provenance.source)
	) {
		return invalid(
			"invalid-provenance",
			"proposal.provenance",
			"Expected bounded supported proposal provenance",
		);
	}
	const identityParts = [
		proposal.workCaseId,
		proposal.category,
		subject.value,
		question.value,
		proposal.contextRevisionId,
		"requirements",
		...canonical.value.flatMap(({ statement, contributionNeeds }) => [
			statement,
			"needs",
			String(contributionNeeds.length),
			...contributionNeeds,
		]),
	];
	const judgmentId = hashIdentity(
		"open_judgment",
		OPEN_JUDGMENT_VERSION,
		identityParts,
	);
	const contributionNeeds: ContributionNeed[] = [];
	const requirements: ClosureRequirement[] = canonical.value.map(
		({ statement, contributionNeeds: needFunctions }) => {
			const requirementId = hashIdentity(
				"closure_requirement",
				OPEN_JUDGMENT_VERSION,
				[judgmentId, statement],
			);
			const contributionNeedIds = needFunctions.map((needFunction) => {
				const contributionNeedId = hashIdentity(
					"contribution_need",
					OPEN_JUDGMENT_VERSION,
					[requirementId, needFunction],
				);
				contributionNeeds.push(
					Object.freeze({
						contributionNeedId,
						requirementId,
						function: needFunction,
					}),
				);
				return contributionNeedId;
			});
			contributionNeedIds.sort((left, right) => left.localeCompare(right));
			return Object.freeze({
				requirementId,
				statement,
				contributionNeedIds: Object.freeze(contributionNeedIds),
			});
		},
	);
	contributionNeeds.sort((left, right) =>
		left.contributionNeedId.localeCompare(right.contributionNeedId),
	);
	return {
		status: "opened",
		value: Object.freeze({
			workCaseId: proposal.workCaseId,
			judgmentId,
			category: proposal.category,
			subject: subject.value,
			question: question.value,
			contextRevisionId: proposal.contextRevisionId,
			requirements: Object.freeze(requirements),
			contributionNeeds: Object.freeze(contributionNeeds),
			basis: basis.value,
			provenance: Object.freeze({
				kind: proposal.provenance.kind,
				source: proposal.provenance.source,
			}),
			status: "open",
		}),
	};
}
