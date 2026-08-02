import { Type, type Static, type TProperties } from "typebox";
import { Errors, Parse } from "typebox/value";

import { JudgmentParseError } from "./errors.ts";
import { canonicalJson, sha256, type JsonValue } from "./json.ts";
import {
	AssuranceSchema,
	ContextUseSchema,
	IdentifierSchema,
	NonEmptyTextSchema,
} from "./schema.ts";
import type { Assurance, ContextUse } from "./schema.ts";
import type { SealedContext, SelectedContextMember } from "./sealed-context.ts";

function exactObject<const T extends TProperties>(properties: T) {
	return Type.Object(properties, { additionalProperties: false });
}
const MaterialIds = Type.Array(
	Type.String({ minLength: 1, maxLength: 300, pattern: "\\S" }),
	{ minItems: 1, maxItems: 256, uniqueItems: true },
);
const OptionalMaterialIds = Type.Array(
	Type.String({ minLength: 1, maxLength: 300, pattern: "\\S" }),
	{ maxItems: 256, uniqueItems: true },
);
const Evaluator = exactObject({
	id: IdentifierSchema,
	version: Type.String({ minLength: 1, maxLength: 128, pattern: "\\S" }),
});
const ContributionBase = {
	materialId: Type.String({ minLength: 1, maxLength: 300, pattern: "\\S" }),
	useAs: ContextUseSchema,
	contribution: NonEmptyTextSchema,
};
const AgentContribution = exactObject({
	...ContributionBase,
	assurance: Type.Literal("agent-asserted"),
});
const DomainContribution = exactObject({
	...ContributionBase,
	assurance: Type.Literal("domain-verified"),
	evaluator: Evaluator,
	evidenceMaterialIds: MaterialIds,
});
const UserContribution = exactObject({
	...ContributionBase,
	assurance: Type.Literal("user-accepted"),
	userEventId: Type.String({ minLength: 1, maxLength: 300, pattern: "\\S" }),
});
export const ContextContributionDataSchema = Type.Union([
	AgentContribution,
	DomainContribution,
	UserContribution,
]);
export const ContextConflictDataSchema = exactObject({
	materialIds: Type.Array(
		Type.String({ minLength: 1, maxLength: 300, pattern: "\\S" }),
		{ minItems: 2, maxItems: 256, uniqueItems: true },
	),
	description: NonEmptyTextSchema,
});
export const ContextLimitationDataSchema = exactObject({
	basisMaterialIds: OptionalMaterialIds,
	description: NonEmptyTextSchema,
});
export const ContextCoverageProposalDataSchema = exactObject({
	status: Type.Union([
		Type.Literal("sufficient"),
		Type.Literal("needs-evidence"),
	]),
	contributions: Type.Array(ContextContributionDataSchema, { maxItems: 256 }),
	conflicts: Type.Array(ContextConflictDataSchema, { maxItems: 128 }),
	limitations: Type.Array(ContextLimitationDataSchema, { maxItems: 128 }),
});
export type ContextContributionData = Static<
	typeof ContextContributionDataSchema
>;
export type ContextConflictData = Static<typeof ContextConflictDataSchema>;
export type ContextLimitationData = Static<typeof ContextLimitationDataSchema>;
export type ContextCoverageProposalData = Static<
	typeof ContextCoverageProposalDataSchema
>;

const proposalBrand: unique symbol = Symbol("ContextCoverageProposal");
const coverageBrand: unique symbol = Symbol("ContextCoverage");

interface ContributionBaseValue {
	readonly contributionId: string;
	readonly materialId: string;
	readonly useAs: ContextUse;
	readonly contribution: string;
	readonly assurance: Assurance;
}
export type ContextContribution =
	| (ContributionBaseValue & { readonly assurance: "agent-asserted" })
	| (ContributionBaseValue & {
			readonly assurance: "domain-verified";
			readonly evaluator: Readonly<{ id: string; version: string }>;
			readonly evidenceMaterialIds: readonly string[];
	  })
	| (ContributionBaseValue & {
			readonly assurance: "user-accepted";
			readonly userEventId: string;
	  });
type ContextContributionValue =
	| (Omit<ContributionBaseValue, "contributionId"> & {
			readonly assurance: "agent-asserted";
	  })
	| (Omit<ContributionBaseValue, "contributionId"> & {
			readonly assurance: "domain-verified";
			readonly evaluator: Readonly<{ id: string; version: string }>;
			readonly evidenceMaterialIds: readonly string[];
	  })
	| (Omit<ContributionBaseValue, "contributionId"> & {
			readonly assurance: "user-accepted";
			readonly userEventId: string;
	  });
export interface ContextConflict {
	readonly conflictId: string;
	readonly materialIds: readonly string[];
	readonly description: string;
}
export interface ContextLimitation {
	readonly limitationId: string;
	readonly basisMaterialIds: readonly string[];
	readonly description: string;
}
export interface ContextCoverageProposal {
	readonly [proposalBrand]: true;
	readonly status: "sufficient" | "needs-evidence";
	readonly contributions: readonly ContextContribution[];
	readonly conflicts: readonly ContextConflict[];
	readonly limitations: readonly ContextLimitation[];
}
export interface ContextCoverage {
	readonly [coverageBrand]: true;
	readonly judgmentId: string;
	readonly questionSha256: string;
	readonly sealedContextSha256: string;
	readonly status: "sufficient" | "needs-evidence";
	readonly contributions: readonly ContextContribution[];
	readonly conflicts: readonly ContextConflict[];
	readonly limitations: readonly ContextLimitation[];
	readonly coverageSha256: string;
}

function issues(value: JsonValue) {
	return [...Errors(ContextCoverageProposalDataSchema, value)].map((issue) => ({
		path: issue.instancePath || "/",
		message: issue.message,
		keyword: issue.keyword,
	}));
}
export function decodeContextCoverageProposalData(
	value: JsonValue,
): ContextCoverageProposalData {
	try {
		return Parse(ContextCoverageProposalDataSchema, value);
	} catch (error) {
		throw new JudgmentParseError(
			"Context coverage proposal has an invalid representation.",
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
function ids(values: readonly string[], path: string): readonly string[] {
	const normalized = values.map((value, index) =>
		text(value, `${path}/${index}`),
	);
	const seen = new Set<string>();
	for (const value of normalized) {
		if (seen.has(value))
			throw new JudgmentParseError(
				`Duplicate material ID at ${path}: ${value}.`,
			);
		seen.add(value);
	}
	return Object.freeze(
		normalized.toSorted((left, right) => left.localeCompare(right)),
	);
}
function contributionBody(
	data: ContextContributionData,
	index: number,
): ContextContributionValue {
	const base = {
		materialId: text(data.materialId, `/contributions/${index}/materialId`),
		useAs: data.useAs,
		contribution: text(
			data.contribution,
			`/contributions/${index}/contribution`,
		),
	};
	switch (data.assurance) {
		case "agent-asserted":
			return Object.freeze({ ...base, assurance: data.assurance });
		case "domain-verified":
			return Object.freeze({
				...base,
				assurance: data.assurance,
				evaluator: Object.freeze({
					id: data.evaluator.id,
					version: text(
						data.evaluator.version,
						`/contributions/${index}/evaluator/version`,
					),
				}),
				evidenceMaterialIds: ids(
					data.evidenceMaterialIds,
					`/contributions/${index}/evidenceMaterialIds`,
				),
			});
		case "user-accepted":
			return Object.freeze({
				...base,
				assurance: data.assurance,
				userEventId: text(
					data.userEventId,
					`/contributions/${index}/userEventId`,
				),
			});
		default:
			return assertNever(data);
	}
}
function contributionIdentity(
	value: ContextContributionValue | ContextContribution,
): JsonValue {
	const base = {
		materialId: value.materialId,
		useAs: value.useAs,
		contribution: value.contribution,
		assurance: value.assurance,
	};
	switch (value.assurance) {
		case "agent-asserted":
			return base;
		case "domain-verified":
			return {
				...base,
				evaluator: value.evaluator,
				evidenceMaterialIds: value.evidenceMaterialIds,
			};
		case "user-accepted":
			return { ...base, userEventId: value.userEventId };
		default:
			return assertNever(value);
	}
}
function parseContribution(
	data: ContextContributionData,
	index: number,
): ContextContribution {
	const body = contributionBody(data, index);
	const contributionId = `contribution:${sha256(canonicalJson(contributionIdentity(body))).slice(0, 32)}`;
	switch (body.assurance) {
		case "agent-asserted":
			return Object.freeze({ ...body, contributionId });
		case "domain-verified":
			return Object.freeze({ ...body, contributionId });
		case "user-accepted":
			return Object.freeze({ ...body, contributionId });
		default:
			return assertNever(body);
	}
}
function parseConflict(
	data: ContextConflictData,
	index: number,
): ContextConflict {
	const body = {
		materialIds: ids(data.materialIds, `/conflicts/${index}/materialIds`),
		description: text(data.description, `/conflicts/${index}/description`),
	};
	return Object.freeze({
		...body,
		conflictId: `conflict:${sha256(canonicalJson(body)).slice(0, 32)}`,
	});
}
function parseLimitation(
	data: ContextLimitationData,
	index: number,
): ContextLimitation {
	const body = {
		basisMaterialIds: ids(
			data.basisMaterialIds,
			`/limitations/${index}/basisMaterialIds`,
		),
		description: text(data.description, `/limitations/${index}/description`),
	};
	return Object.freeze({
		...body,
		limitationId: `limitation:${sha256(canonicalJson(body)).slice(0, 32)}`,
	});
}
export function parseContextCoverageProposal(
	data: ContextCoverageProposalData,
): ContextCoverageProposal {
	const contributions = Object.freeze(
		data.contributions
			.map(parseContribution)
			.toSorted((left, right) =>
				left.contributionId.localeCompare(right.contributionId),
			),
	);
	const contributionIds = new Set<string>();
	for (const contribution of contributions) {
		if (contributionIds.has(contribution.contributionId))
			throw new JudgmentParseError(
				`Duplicate context contribution: ${contribution.contributionId}.`,
			);
		contributionIds.add(contribution.contributionId);
	}
	const conflicts = Object.freeze(
		data.conflicts
			.map(parseConflict)
			.toSorted((left, right) =>
				left.conflictId.localeCompare(right.conflictId),
			),
	);
	const conflictIds = new Set<string>();
	for (const conflict of conflicts) {
		if (conflictIds.has(conflict.conflictId))
			throw new JudgmentParseError(
				`Duplicate context conflict: ${conflict.conflictId}.`,
			);
		conflictIds.add(conflict.conflictId);
	}
	const limitations = Object.freeze(
		data.limitations
			.map(parseLimitation)
			.toSorted((left, right) =>
				left.limitationId.localeCompare(right.limitationId),
			),
	);
	const limitationIds = new Set<string>();
	for (const limitation of limitations) {
		if (limitationIds.has(limitation.limitationId))
			throw new JudgmentParseError(
				`Duplicate context limitation: ${limitation.limitationId}.`,
			);
		limitationIds.add(limitation.limitationId);
	}
	const proposal: ContextCoverageProposal = {
		[proposalBrand]: true,
		status: data.status,
		contributions,
		conflicts,
		limitations,
	};
	return Object.freeze(proposal);
}
function material(sealed: SealedContext, id: string): SelectedContextMember {
	const member = sealed.members.find(
		(candidate) => candidate.materialId === id,
	);
	if (!member)
		throw new JudgmentParseError(`Unknown contribution material: ${id}.`);
	return member;
}
function verifyAssurance(
	value: ContextContribution,
	sealed: SealedContext,
): void {
	if (value.assurance === "agent-asserted") return;
	if (value.assurance === "domain-verified") {
		const evidence = value.evidenceMaterialIds.map((id) =>
			material(sealed, id),
		);
		const matches = evidence.some(
			(member) =>
				member.origin.kind === "observed-context" &&
				member.origin.entry.kind === "domain-evidence" &&
				member.origin.entry.evaluator.id === value.evaluator.id &&
				member.origin.entry.evaluator.version === value.evaluator.version,
		);
		if (!matches)
			throw new JudgmentParseError(
				"Domain-verified contribution has no matching selected evaluator evidence.",
			);
		return;
	}
	const matches = sealed.members.some(
		(member) =>
			member.origin.kind === "observed-context" &&
			member.origin.entry.kind === "user-explicit" &&
			member.origin.entry.userEventId === value.userEventId,
	);
	if (!matches)
		throw new JudgmentParseError(
			"User-accepted contribution has no matching selected user event.",
		);
}
export function assessContextCoverage(input: {
	readonly selectedContext: SealedContext;
	readonly proposal: ContextCoverageProposal;
}): ContextCoverage {
	const { selectedContext, proposal } = input;
	const contributed = new Set<string>();
	for (const contribution of proposal.contributions) {
		const member = material(selectedContext, contribution.materialId);
		if (member.isError || member.truncated)
			throw new JudgmentParseError(
				`Error or truncated material cannot contribute: ${member.materialId}.`,
			);
		contributed.add(member.materialId);
		verifyAssurance(contribution, selectedContext);
	}
	for (const member of selectedContext.members) {
		if (!contributed.has(member.materialId))
			throw new JudgmentParseError(
				`Selected material has no contribution: ${member.materialId}.`,
			);
	}
	for (const conflict of proposal.conflicts)
		for (const materialId of conflict.materialIds)
			material(selectedContext, materialId);
	for (const limitation of proposal.limitations)
		for (const materialId of limitation.basisMaterialIds)
			material(selectedContext, materialId);
	if (proposal.status === "sufficient" && proposal.conflicts.length > 0)
		throw new JudgmentParseError(
			"Sufficient coverage cannot retain conflicts.",
		);
	if (
		proposal.status === "needs-evidence" &&
		proposal.conflicts.length === 0 &&
		proposal.limitations.length === 0
	)
		throw new JudgmentParseError(
			"Needs-evidence coverage requires a conflict or limitation.",
		);
	const coverageSha256 = sha256(
		canonicalJson({
			judgmentId: selectedContext.judgmentId,
			questionSha256: selectedContext.questionSha256,
			sealedContextSha256: selectedContext.sealedContextSha256,
			status: proposal.status,
			contributions: proposal.contributions.map((value) => ({
				contributionId: value.contributionId,
				value: contributionIdentity(value),
			})),
			conflicts: proposal.conflicts.map((value) => ({
				conflictId: value.conflictId,
				materialIds: value.materialIds,
				description: value.description,
			})),
			limitations: proposal.limitations.map((value) => ({
				limitationId: value.limitationId,
				basisMaterialIds: value.basisMaterialIds,
				description: value.description,
			})),
		}),
	);
	const coverage: ContextCoverage = {
		[coverageBrand]: true,
		judgmentId: selectedContext.judgmentId,
		questionSha256: selectedContext.questionSha256,
		sealedContextSha256: selectedContext.sealedContextSha256,
		status: proposal.status,
		contributions: proposal.contributions,
		conflicts: proposal.conflicts,
		limitations: proposal.limitations,
		coverageSha256,
	};
	return Object.freeze(coverage);
}

function assertNever(value: never): never {
	throw new JudgmentParseError(
		`Unsupported context-coverage variant: ${JSON.stringify(value)}.`,
	);
}
