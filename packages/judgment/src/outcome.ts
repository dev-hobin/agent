import { Type, type Static, type TProperties } from "typebox";
import { Errors, Parse } from "typebox/value";

import type {
	ContextCoverage,
	ContextContribution,
	ContextLimitation,
} from "./coverage.ts";
import { JudgmentParseError } from "./errors.ts";
import { canonicalJson, sha256, type JsonValue } from "./json.ts";
import type { DynamicJudgmentQuestion } from "./question.ts";
import { NonEmptyTextSchema, Sha256Schema } from "./schema.ts";
import type { SealedContext } from "./sealed-context.ts";

function exactObject<const T extends TProperties>(properties: T) {
	return Type.Object(properties, { additionalProperties: false });
}
const Citation = exactObject({
	contributionId: Type.String({ minLength: 1, maxLength: 300, pattern: "\\S" }),
	locator: Type.Optional(
		Type.String({ minLength: 1, maxLength: 1_000, pattern: "\\S" }),
	),
	artifactEffect: NonEmptyTextSchema,
});
const Base = {
	selectionSha256: Sha256Schema,
	sealedContextSha256: Sha256Schema,
	coverageSha256: Sha256Schema,
};
const Contextual = exactObject({
	...Base,
	kind: Type.Literal("contextual-judgment"),
	citedUses: Type.Array(Citation, { maxItems: 256 }),
	rationale: NonEmptyTextSchema,
	artifact: NonEmptyTextSchema,
	stopEvidence: Type.Array(NonEmptyTextSchema, {
		minItems: 1,
		maxItems: 32,
		uniqueItems: true,
	}),
});
const NeedsEvidence = exactObject({
	...Base,
	kind: Type.Literal("needs-evidence"),
	unresolvedIds: Type.Array(
		Type.String({ minLength: 1, maxLength: 300, pattern: "\\S" }),
		{ minItems: 1, maxItems: 256, uniqueItems: true },
	),
	evidenceNeeded: Type.Array(NonEmptyTextSchema, {
		minItems: 1,
		maxItems: 32,
		uniqueItems: true,
	}),
	resolutionOwner: Type.Union([
		Type.Literal("agent"),
		Type.Literal("user"),
		Type.Literal("environment"),
		Type.Literal("unknown"),
	]),
	artifact: Type.Optional(NonEmptyTextSchema),
});
const Emergent = exactObject({
	...Base,
	kind: Type.Literal("emergent-question"),
	question: NonEmptyTextSchema,
	reason: NonEmptyTextSchema,
	artifact: NonEmptyTextSchema,
	stopEvidence: Type.Array(NonEmptyTextSchema, {
		minItems: 1,
		maxItems: 32,
		uniqueItems: true,
	}),
});
export const JudgmentProposalDataSchema = Type.Union([
	Contextual,
	NeedsEvidence,
	Emergent,
]);
export type JudgmentProposalData = Static<typeof JudgmentProposalDataSchema>;

const proposalBrand: unique symbol = Symbol("JudgmentProposal");
export interface ContextCitation {
	readonly contributionId: string;
	readonly locator?: string;
	readonly artifactEffect: string;
}
interface ProposalBase {
	readonly [proposalBrand]: true;
	readonly selectionSha256: string;
	readonly sealedContextSha256: string;
	readonly coverageSha256: string;
}
export type JudgmentProposal =
	| (ProposalBase & {
			readonly kind: "contextual-judgment";
			readonly citedUses: readonly ContextCitation[];
			readonly rationale: string;
			readonly artifact: string;
			readonly stopEvidence: readonly string[];
	  })
	| (ProposalBase & {
			readonly kind: "needs-evidence";
			readonly unresolvedIds: readonly string[];
			readonly evidenceNeeded: readonly string[];
			readonly resolutionOwner: "agent" | "user" | "environment" | "unknown";
			readonly artifact?: string;
	  })
	| (ProposalBase & {
			readonly kind: "emergent-question";
			readonly question: string;
			readonly reason: string;
			readonly artifact: string;
			readonly stopEvidence: readonly string[];
	  });

interface OutcomeBase {
	readonly judgmentId: string;
	readonly questionSha256: string;
	readonly selectionSha256: string;
	readonly sealedContextSha256: string;
	readonly coverageSha256: string;
	readonly outcomeSha256: string;
}
export type ContextualJudgment = OutcomeBase & {
	readonly kind: "contextual-judgment";
	readonly citedUses: readonly ContextCitation[];
	readonly contributions: readonly ContextContribution[];
	readonly rationale: string;
	readonly artifact: string;
	readonly stopEvidence: readonly string[];
	readonly limitations: readonly ContextLimitation[];
};
export type NeedsEvidence = OutcomeBase & {
	readonly kind: "needs-evidence";
	readonly unresolvedIds: readonly string[];
	readonly evidenceNeeded: readonly string[];
	readonly resolutionOwner: "agent" | "user" | "environment" | "unknown";
	readonly artifact?: string;
};
export type EmergentQuestion = OutcomeBase & {
	readonly kind: "emergent-question";
	readonly question: string;
	readonly reason: string;
	readonly artifact: string;
	readonly stopEvidence: readonly string[];
};
export type JudgmentOutcome =
	| ContextualJudgment
	| NeedsEvidence
	| EmergentQuestion;

function issues(value: JsonValue) {
	return [...Errors(JudgmentProposalDataSchema, value)].map((issue) => ({
		path: issue.instancePath || "/",
		message: issue.message,
		keyword: issue.keyword,
	}));
}
export function decodeJudgmentProposalData(
	value: JsonValue,
): JudgmentProposalData {
	try {
		return Parse(JudgmentProposalDataSchema, value);
	} catch (error) {
		throw new JudgmentParseError(
			"Judgment proposal has an invalid representation.",
			{ issues: issues(value) },
			{ cause: error },
		);
	}
}
function text(value: string, path: string): string {
	if (value !== value.trim() || !value.trim())
		throw new JudgmentParseError(
			`Expected directly normalized non-blank text at ${path}.`,
		);
	return value.replace(/\s+/gu, " ");
}
function unique(values: readonly string[], path: string): readonly string[] {
	const normalized = values.map((value, index) =>
		text(value, `${path}/${index}`),
	);
	const seen = new Set<string>();
	for (const value of normalized) {
		if (seen.has(value))
			throw new JudgmentParseError(`Duplicate value at ${path}: ${value}.`);
		seen.add(value);
	}
	return Object.freeze(
		normalized.toSorted((left, right) => left.localeCompare(right)),
	);
}
export function parseJudgmentProposal(
	data: JudgmentProposalData,
): JudgmentProposal {
	const base: ProposalBase = {
		[proposalBrand]: true,
		selectionSha256: data.selectionSha256,
		sealedContextSha256: data.sealedContextSha256,
		coverageSha256: data.coverageSha256,
	};
	switch (data.kind) {
		case "contextual-judgment": {
			const citedUses = Object.freeze(
				data.citedUses
					.map((citation, index) =>
						Object.freeze({
							contributionId: text(
								citation.contributionId,
								`/citedUses/${index}/contributionId`,
							),
							...(citation.locator
								? {
										locator: text(
											citation.locator,
											`/citedUses/${index}/locator`,
										),
									}
								: {}),
							artifactEffect: text(
								citation.artifactEffect,
								`/citedUses/${index}/artifactEffect`,
							),
						}),
					)
					.toSorted((left, right) =>
						left.contributionId.localeCompare(right.contributionId),
					),
			);
			const ids = new Set<string>();
			for (const citation of citedUses) {
				if (ids.has(citation.contributionId))
					throw new JudgmentParseError(
						`Duplicate contribution citation: ${citation.contributionId}.`,
					);
				ids.add(citation.contributionId);
			}
			return Object.freeze({
				...base,
				kind: data.kind,
				citedUses,
				rationale: text(data.rationale, "/rationale"),
				artifact: text(data.artifact, "/artifact"),
				stopEvidence: unique(data.stopEvidence, "/stopEvidence"),
			});
		}
		case "needs-evidence":
			return Object.freeze({
				...base,
				kind: data.kind,
				unresolvedIds: unique(data.unresolvedIds, "/unresolvedIds"),
				evidenceNeeded: unique(data.evidenceNeeded, "/evidenceNeeded"),
				resolutionOwner: data.resolutionOwner,
				...(data.artifact
					? { artifact: text(data.artifact, "/artifact") }
					: {}),
			});
		case "emergent-question":
			return Object.freeze({
				...base,
				kind: data.kind,
				question: text(data.question, "/question"),
				reason: text(data.reason, "/reason"),
				artifact: text(data.artifact, "/artifact"),
				stopEvidence: unique(data.stopEvidence, "/stopEvidence"),
			});
		default:
			return assertNever(data);
	}
}
function common(input: {
	question: DynamicJudgmentQuestion;
	selectedContext: SealedContext;
	coverage: ContextCoverage;
	proposal: JudgmentProposal;
}): void {
	const { question, selectedContext, coverage, proposal } = input;
	if (
		question.judgmentId !== selectedContext.judgmentId ||
		question.questionSha256 !== selectedContext.questionSha256
	)
		throw new JudgmentParseError(
			"Question and sealed context do not describe one judgment.",
		);
	if (proposal.selectionSha256 !== selectedContext.selectionSha256)
		throw new JudgmentParseError("Judgment proposal names a stale selection.");
	if (proposal.sealedContextSha256 !== selectedContext.sealedContextSha256)
		throw new JudgmentParseError(
			"Judgment proposal names stale sealed context.",
		);
	if (proposal.coverageSha256 !== coverage.coverageSha256)
		throw new JudgmentParseError("Judgment proposal names stale coverage.");
	if (
		coverage.sealedContextSha256 !== selectedContext.sealedContextSha256 ||
		coverage.questionSha256 !== question.questionSha256
	)
		throw new JudgmentParseError(
			"Coverage and sealed context do not describe one judgment.",
		);
}
function unresolved(coverage: ContextCoverage): readonly string[] {
	return Object.freeze(
		[
			...coverage.conflicts.map((value) => value.conflictId),
			...coverage.limitations.map((value) => value.limitationId),
		].toSorted((left, right) => left.localeCompare(right)),
	);
}
function identity(
	question: DynamicJudgmentQuestion,
	proposal: JudgmentProposal,
): JsonValue {
	const base = {
		kind: proposal.kind,
		judgmentId: question.judgmentId,
		questionSha256: question.questionSha256,
		selectionSha256: proposal.selectionSha256,
		sealedContextSha256: proposal.sealedContextSha256,
		coverageSha256: proposal.coverageSha256,
	};
	switch (proposal.kind) {
		case "contextual-judgment":
			return {
				...base,
				citedUses: proposal.citedUses.map((citation) => ({
					contributionId: citation.contributionId,
					...(citation.locator ? { locator: citation.locator } : {}),
					artifactEffect: citation.artifactEffect,
				})),
				rationale: proposal.rationale,
				artifact: proposal.artifact,
				stopEvidence: proposal.stopEvidence,
			};
		case "needs-evidence":
			return {
				...base,
				unresolvedIds: proposal.unresolvedIds,
				evidenceNeeded: proposal.evidenceNeeded,
				resolutionOwner: proposal.resolutionOwner,
				...(proposal.artifact ? { artifact: proposal.artifact } : {}),
			};
		case "emergent-question":
			return {
				...base,
				question: proposal.question,
				reason: proposal.reason,
				artifact: proposal.artifact,
				stopEvidence: proposal.stopEvidence,
			};
		default:
			return assertNever(proposal);
	}
}
export function concludeJudgment(input: {
	readonly question: DynamicJudgmentQuestion;
	readonly selectedContext: SealedContext;
	readonly coverage: ContextCoverage;
	readonly proposal: JudgmentProposal;
}): JudgmentOutcome {
	common(input);
	const { question, coverage, proposal } = input;
	const outcomeSha256 = sha256(canonicalJson(identity(question, proposal)));
	const base: OutcomeBase = {
		judgmentId: question.judgmentId,
		questionSha256: question.questionSha256,
		selectionSha256: proposal.selectionSha256,
		sealedContextSha256: proposal.sealedContextSha256,
		coverageSha256: proposal.coverageSha256,
		outcomeSha256,
	};
	switch (proposal.kind) {
		case "contextual-judgment": {
			if (coverage.status !== "sufficient")
				throw new JudgmentParseError(
					"Contextual judgment requires sufficient coverage.",
				);
			const contributionIds = new Set(
				coverage.contributions.map((value) => value.contributionId),
			);
			for (const citation of proposal.citedUses)
				if (!contributionIds.has(citation.contributionId))
					throw new JudgmentParseError(
						`Citation names an unknown contribution: ${citation.contributionId}.`,
					);
			return Object.freeze({
				...base,
				kind: proposal.kind,
				citedUses: proposal.citedUses,
				contributions: coverage.contributions,
				rationale: proposal.rationale,
				artifact: proposal.artifact,
				stopEvidence: proposal.stopEvidence,
				limitations: coverage.limitations,
			});
		}
		case "needs-evidence": {
			if (coverage.status !== "needs-evidence")
				throw new JudgmentParseError(
					"NeedsEvidence requires needs-evidence coverage.",
				);
			const actual = unresolved(coverage);
			if (actual.join("\0") !== proposal.unresolvedIds.join("\0"))
				throw new JudgmentParseError(
					"NeedsEvidence must exactly account for coverage conflicts and limitations.",
				);
			return Object.freeze({
				...base,
				kind: proposal.kind,
				unresolvedIds: proposal.unresolvedIds,
				evidenceNeeded: proposal.evidenceNeeded,
				resolutionOwner: proposal.resolutionOwner,
				...(proposal.artifact ? { artifact: proposal.artifact } : {}),
			});
		}
		case "emergent-question": {
			if (
				question.question.toLocaleLowerCase().replace(/\s+/gu, " ") ===
				proposal.question.toLocaleLowerCase().replace(/\s+/gu, " ")
			)
				throw new JudgmentParseError(
					"Emergent question must be distinct from the current question.",
				);
			return Object.freeze({
				...base,
				kind: proposal.kind,
				question: proposal.question,
				reason: proposal.reason,
				artifact: proposal.artifact,
				stopEvidence: proposal.stopEvidence,
			});
		}
		default:
			return assertNever(proposal);
	}
}
function assertNever(value: never): never {
	throw new JudgmentParseError(
		`Unsupported Judgment outcome variant: ${JSON.stringify(value)}.`,
	);
}
