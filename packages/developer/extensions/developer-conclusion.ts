import { StringEnum } from "@earendil-works/pi-ai";
import { Type, type Static } from "typebox";
import { ContextApplicabilityDataSchema, sha256 } from "@hobin/judgment";
import {
	activeBranchToolResultIdentities,
	type PiBranchEntryInput,
} from "@hobin/judgment/pi-context";

import type {
	DeveloperContextNomination,
	DeveloperCoverageProposal,
} from "./developer-context.ts";

const MAX_TEXT = 8_000;
const MAX_SHORT_TEXT = 2_000;
const MAX_PATH = 4_096;

const Identifier = Type.String({
	minLength: 1,
	maxLength: 160,
	pattern: "^[A-Za-z][A-Za-z0-9._:/-]*$",
});
const ShortText = Type.String({ minLength: 1, maxLength: MAX_SHORT_TEXT });
const Text = Type.String({ minLength: 1, maxLength: MAX_TEXT });
const Sha256 = Type.String({ pattern: "^[a-f0-9]{64}$" });

const InventoryNominationParam = Type.Object(
	{
		nominationId: Identifier,
		kind: Type.Literal("inventory-source"),
		inventorySourceId: Type.Optional(Identifier),
		provenanceSource: Type.Optional(
			Type.String({ minLength: 1, maxLength: 1_000 }),
		),
		provenancePath: Type.Optional(
			Type.String({ minLength: 1, maxLength: MAX_PATH }),
		),
		contentSha256: Type.Optional(Sha256),
	},
	{ additionalProperties: false },
);
const ToolNominationParam = Type.Object(
	{
		nominationId: Identifier,
		kind: Type.Literal("tool-result"),
		branchResultId: Identifier,
		inventorySourceId: Type.Optional(Identifier),
	},
	{ additionalProperties: false },
);
const UserNominationParam = Type.Object(
	{
		nominationId: Identifier,
		kind: Type.Literal("user-decision"),
	},
	{ additionalProperties: false },
);
const ContextNominationParam = Type.Union([
	InventoryNominationParam,
	ToolNominationParam,
	UserNominationParam,
]);
const ContributionFields = {
	nominationId: Identifier,
	useAs: StringEnum([
		"constraint",
		"evidence",
		"decision",
		"method",
		"guidance",
	] as const),
	contribution: ShortText,
};
const AgentContributionParam = Type.Object(
	{
		...ContributionFields,
		assurance: Type.Literal("agent-asserted"),
	},
	{ additionalProperties: false },
);
const DomainContributionParam = Type.Object(
	{
		...ContributionFields,
		assurance: Type.Literal("domain-verified"),
		evaluator: Type.Object(
			{ id: Identifier, version: Identifier },
			{ additionalProperties: false },
		),
		evidenceNominationIds: Type.Array(Identifier, {
			minItems: 1,
			maxItems: 64,
			uniqueItems: true,
		}),
	},
	{ additionalProperties: false },
);
const UserContributionParam = Type.Object(
	{
		...ContributionFields,
		assurance: Type.Literal("user-accepted"),
	},
	{ additionalProperties: false },
);
const NominationIds = Type.Array(Identifier, {
	maxItems: 64,
	uniqueItems: true,
});
const DeveloperCoverageParam = Type.Object(
	{
		status: StringEnum(["sufficient", "needs-evidence"] as const),
		contributions: Type.Array(
			Type.Union([
				AgentContributionParam,
				DomainContributionParam,
				UserContributionParam,
			]),
			{ maxItems: 64 },
		),
		conflicts: Type.Array(
			Type.Object(
				{
					nominationIds: Type.Array(Identifier, {
						minItems: 2,
						maxItems: 64,
						uniqueItems: true,
					}),
					description: ShortText,
				},
				{ additionalProperties: false },
			),
			{ maxItems: 64 },
		),
		limitations: Type.Array(
			Type.Object(
				{ nominationIds: NominationIds, description: ShortText },
				{ additionalProperties: false },
			),
			{ maxItems: 64 },
		),
	},
	{ additionalProperties: false },
);
const CitationIntentParam = Type.Object(
	{
		contributionIndex: Type.Integer({ minimum: 0, maximum: 255 }),
		locator: Type.Optional(ShortText),
		artifactEffect: ShortText,
	},
	{ additionalProperties: false },
);
const ContextualOutcomeParam = Type.Object(
	{
		kind: Type.Literal("contextual-judgment"),
		citedUses: Type.Array(CitationIntentParam, { maxItems: 64 }),
		rationale: Text,
		artifact: Text,
		stopEvidence: Type.Array(ShortText, {
			minItems: 1,
			maxItems: 32,
			uniqueItems: true,
		}),
	},
	{ additionalProperties: false },
);
const NeedsEvidenceOutcomeParam = Type.Object(
	{
		kind: Type.Literal("needs-evidence"),
		evidenceNeeded: Type.Array(ShortText, {
			minItems: 1,
			maxItems: 32,
			uniqueItems: true,
		}),
		resolutionOwner: StringEnum([
			"agent",
			"user",
			"environment",
			"unknown",
		] as const),
		artifact: Type.Optional(Text),
	},
	{ additionalProperties: false },
);
const EmergentQuestionOutcomeParam = Type.Object(
	{
		kind: Type.Literal("emergent-question"),
		question: ShortText,
		reason: Text,
		artifact: Text,
		stopEvidence: Type.Array(ShortText, {
			minItems: 1,
			maxItems: 32,
			uniqueItems: true,
		}),
	},
	{ additionalProperties: false },
);
const DeveloperOutcomeParam = Type.Union([
	ContextualOutcomeParam,
	NeedsEvidenceOutcomeParam,
	EmergentQuestionOutcomeParam,
]);

export const ConcludeJudgmentParams = Type.Object(
	{
		disposition: StringEnum(["judgment", "not-applicable"] as const),
		applicability: Type.Optional(ContextApplicabilityDataSchema),
		nominations: Type.Optional(
			Type.Array(ContextNominationParam, { maxItems: 256 }),
		),
		selection_basis: Type.Optional(
			Type.Array(ShortText, {
				minItems: 1,
				maxItems: 32,
				uniqueItems: true,
			}),
		),
		coverage: Type.Optional(DeveloperCoverageParam),
		outcome: Type.Optional(DeveloperOutcomeParam),
		not_applicable_reason: Type.Optional(Text),
		not_applicable_basis: Type.Optional(
			Type.Array(ShortText, {
				minItems: 1,
				maxItems: 32,
				uniqueItems: true,
			}),
		),
	},
	{ additionalProperties: false },
);

export type ConcludeJudgmentData = Static<typeof ConcludeJudgmentParams>;

function normalizedText(value: string, fieldName: string): string {
	const normalized = value.trim();
	if (!normalized) fail(`${fieldName} must contain non-blank text.`);
	return normalized;
}

type ApplicabilityData = NonNullable<ConcludeJudgmentData["applicability"]>;
type CoverageData = NonNullable<ConcludeJudgmentData["coverage"]>;
type OutcomeData = NonNullable<ConcludeJudgmentData["outcome"]>;

function normalizeApplicability(applicability: ApplicabilityData): ApplicabilityData {
	if (applicability.kind === "applicable") {
		return {
			...applicability,
			basis: applicability.basis.map((value) =>
				normalizedText(value, "applicability basis"),
			),
		};
	}
	if (applicability.kind === "not-applicable") {
		return {
			...applicability,
			reason: normalizedText(applicability.reason, "applicability reason"),
			evidence: applicability.evidence.map((value) =>
				normalizedText(value, "applicability evidence"),
			),
		};
	}
	return {
		...applicability,
		missingContext: applicability.missingContext.map((value) =>
			normalizedText(value, "missing context"),
		),
	};
}

function normalizeCoverage(coverage: CoverageData): CoverageData {
	return {
		...coverage,
		contributions: coverage.contributions.map((contribution) => ({
			...contribution,
			contribution: normalizedText(
				contribution.contribution,
				"coverage contribution",
			),
		})),
		conflicts: coverage.conflicts.map((conflict) => ({
			...conflict,
			description: normalizedText(conflict.description, "coverage conflict"),
		})),
		limitations: coverage.limitations.map((limitation) => ({
			...limitation,
			description: normalizedText(
				limitation.description,
				"coverage limitation",
			),
		})),
	};
}

function normalizeOutcome(outcome: OutcomeData): OutcomeData {
	if (outcome.kind === "contextual-judgment") {
		return {
			...outcome,
			citedUses: outcome.citedUses.map((citation) => {
				const normalizedCitation = {
					...citation,
					artifactEffect: normalizedText(
						citation.artifactEffect,
						"citation artifact effect",
					),
				};
				if (!citation.locator) return normalizedCitation;
				return {
					...normalizedCitation,
					locator: normalizedText(citation.locator, "citation locator"),
				};
			}),
			rationale: normalizedText(outcome.rationale, "outcome rationale"),
			artifact: normalizedText(outcome.artifact, "outcome artifact"),
			stopEvidence: outcome.stopEvidence.map((value) =>
				normalizedText(value, "stop evidence"),
			),
		};
	}
	if (outcome.kind === "needs-evidence") {
		const normalizedOutcome = {
			...outcome,
			evidenceNeeded: outcome.evidenceNeeded.map((value) =>
				normalizedText(value, "evidence needed"),
			),
		};
		if (!outcome.artifact) return normalizedOutcome;
		return {
			...normalizedOutcome,
			artifact: normalizedText(outcome.artifact, "outcome artifact"),
		};
	}
	return {
		...outcome,
		question: normalizedText(outcome.question, "emergent question"),
		reason: normalizedText(outcome.reason, "emergent reason"),
		artifact: normalizedText(outcome.artifact, "outcome artifact"),
		stopEvidence: outcome.stopEvidence.map((value) =>
			normalizedText(value, "stop evidence"),
		),
	};
}

export function normalizeConcludeJudgmentData(
	params: ConcludeJudgmentData,
): ConcludeJudgmentData {
	const result: ConcludeJudgmentData = { ...params };
	if (params.applicability) {
		result.applicability = normalizeApplicability(params.applicability);
	}
	if (params.selection_basis) {
		result.selection_basis = params.selection_basis.map((value) =>
			normalizedText(value, "selection basis"),
		);
	}
	if (params.coverage) result.coverage = normalizeCoverage(params.coverage);
	if (params.outcome) result.outcome = normalizeOutcome(params.outcome);
	if (params.not_applicable_reason) {
		result.not_applicable_reason = normalizedText(
			params.not_applicable_reason,
			"not-applicable reason",
		);
	}
	if (params.not_applicable_basis) {
		result.not_applicable_basis = params.not_applicable_basis.map((value) =>
			normalizedText(value, "not-applicable basis"),
		);
	}
	return result;
}

type ModelContextNomination = NonNullable<
	ConcludeJudgmentData["nominations"]
>[number];

function fail(message: string): never {
	throw new Error(message);
}

export function requiredContextFields(params: ConcludeJudgmentData) {
	if (!params.applicability) {
		fail("disposition=judgment requires applicability.");
	}
	if (params.applicability.kind !== "applicable") {
		fail("disposition=judgment requires applicability.kind=applicable.");
	}
	if (!params.selection_basis) {
		fail("disposition=judgment requires selection_basis.");
	}
	if (!params.coverage) fail("disposition=judgment requires coverage.");
	if (
		params.coverage.status === "sufficient" &&
		params.coverage.contributions.length === 0
	) {
		fail("Sufficient coverage requires at least one admitted contribution.");
	}
	if (!params.outcome) fail("disposition=judgment requires outcome.");
	if (
		params.not_applicable_reason !== undefined ||
		params.not_applicable_basis !== undefined
	) {
		fail("disposition=judgment cannot carry not-applicable fields.");
	}
	return {
		applicability: params.applicability,
		contextSourceAssessments: [],
		nominations: params.nominations ?? [],
		selectionBasis: params.selection_basis,
		coverage: params.coverage,
		outcome: params.outcome,
	};
}

function branchResultId(toolCallId: string): string {
	return `branch-result-${sha256(toolCallId).slice(0, 16)}`;
}

export function latestDeveloperUserEventId(
	branch: readonly PiBranchEntryInput[],
): string | null {
	for (let index = branch.length - 1; index >= 0; index -= 1) {
		const entry = branch[index];
		if (
			entry?.type === "message" &&
			typeof entry.message === "object" &&
			entry.message !== null &&
			"role" in entry.message &&
			entry.message.role === "user" &&
			typeof entry.id === "string"
		) {
			return entry.id;
		}
	}
	return null;
}

export function bindUserAcceptedCoverage(input: {
	readonly coverage: NonNullable<ConcludeJudgmentData["coverage"]>;
	readonly branch: readonly PiBranchEntryInput[];
}): DeveloperCoverageProposal {
	const hasUserAccepted = input.coverage.contributions.some(
		(contribution) => contribution.assurance === "user-accepted",
	);
	const userEventId = hasUserAccepted
		? latestDeveloperUserEventId(input.branch)
		: null;
	if (hasUserAccepted && userEventId === null) {
		fail("The active branch has no user decision for user-accepted coverage.");
	}
	return {
		...input.coverage,
		contributions: input.coverage.contributions.map((contribution) =>
			contribution.assurance === "user-accepted"
				? { ...contribution, userEventId: userEventId as string }
				: contribution,
		),
	};
}

export function resolveModelContextNominations(input: {
	readonly nominations: readonly ModelContextNomination[];
	readonly branch: readonly PiBranchEntryInput[];
}): DeveloperContextNomination[] {
	const results = activeBranchToolResultIdentities(input.branch);
	const latestUserEventId = latestDeveloperUserEventId(input.branch);
	const resultById = new Map<string, (typeof results)[number]>();
	for (const result of results) {
		const id = branchResultId(result.toolCallId);
		const existing = resultById.get(id);
		if (existing && existing.toolCallId !== result.toolCallId) {
			fail(`Active-branch result alias collision: ${id}.`);
		}
		resultById.set(id, result);
	}
	return input.nominations.map((nomination) => {
		if (nomination.kind === "inventory-source") {
			return {
				nominationId: nomination.nominationId,
				kind: nomination.kind,
				...(nomination.inventorySourceId
					? { inventorySourceId: nomination.inventorySourceId }
					: {}),
				...(nomination.provenanceSource
					? { provenanceSource: nomination.provenanceSource }
					: {}),
				...(nomination.provenancePath
					? { provenancePath: nomination.provenancePath }
					: {}),
				...(nomination.contentSha256
					? { contentSha256: nomination.contentSha256 }
					: {}),
			};
		}
		if (nomination.kind === "user-decision") {
			if (latestUserEventId === null) {
				fail("The active branch has no user decision to nominate.");
			}
			return {
				nominationId: nomination.nominationId,
				kind: nomination.kind,
				userEventId: latestUserEventId,
			};
		}
		const result = resultById.get(nomination.branchResultId);
		if (!result) {
			const available = [...resultById]
				.slice(-20)
				.map(
					(entry) =>
						`- ${entry[0]} · ${entry[1].toolName} · ${entry[1].isError ? "error" : "success"}`,
				);
			fail(
				`Unknown or ineligible branchResultId: ${nomination.branchResultId}.\nAvailable branch result IDs:\n${available.join("\n") || "- none"}`,
			);
		}
		return {
			nominationId: nomination.nominationId,
			kind: nomination.kind,
			toolCallId: result.toolCallId,
			...(nomination.inventorySourceId
				? { inventorySourceId: nomination.inventorySourceId }
				: {}),
		};
	});
}

export function developerErrorMessage(error: unknown): string {
	if (error instanceof Error) return error.message;
	if (typeof error === "object" && error !== null) {
		if (
			"message" in error &&
			typeof error.message === "string" &&
			error.message.trim().length > 0
		) {
			return error.message;
		}
		if ("code" in error && typeof error.code === "string") {
			return `Developer context failed (${error.code}).`;
		}
		try {
			const serialized = JSON.stringify(error);
			if (serialized && serialized !== "{}") return serialized.slice(0, 2_000);
		} catch {
			return "Developer context failed with a non-serializable error.";
		}
		return "Developer context failed with an unstructured error.";
	}
	return String(error);
}

export function activeDeveloperEvidenceHandles(
	branch: readonly PiBranchEntryInput[],
): readonly string[] {
	return Object.freeze(
		activeBranchToolResultIdentities(branch)
			.filter(
				(result) =>
					!result.isError && !result.toolName.startsWith("developer_"),
			)
			.slice(-12)
			.map(
				(result) => `${branchResultId(result.toolCallId)} · ${result.toolName}`,
			),
	);
}

export function contextFailureWithBranchIdentities(input: {
	readonly error: unknown;
	readonly branch: readonly PiBranchEntryInput[];
}): string {
	const identities = activeDeveloperEvidenceHandles(input.branch);
	const suffix =
		identities.length > 0
			? `\nEligible evidence handles:\n${identities.map((identity) => `- ${identity}`).join("\n")}`
			: "";
	return `${developerErrorMessage(input.error)}${suffix}`;
}
