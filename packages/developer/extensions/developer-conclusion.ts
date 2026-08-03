import { StringEnum } from "@earendil-works/pi-ai";
import { Type, type Static } from "typebox";
import { ContextApplicabilityDataSchema, sha256 } from "@hobin/judgment";
import {
	activeBranchToolResultIdentities,
	type PiBranchEntryInput,
} from "@hobin/judgment/pi-context";

import type { DeveloperContextNomination } from "./developer-context.ts";

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
		userEventId: Type.String({ minLength: 1, maxLength: 300 }),
	},
	{ additionalProperties: false },
);
const ContextNominationParam = Type.Union([
	InventoryNominationParam,
	ToolNominationParam,
	UserNominationParam,
]);
const ContextSourceAssessmentParam = Type.Object(
	{
		inventorySourceId: Identifier,
		applicability: ContextApplicabilityDataSchema,
	},
	{ additionalProperties: false },
);

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
		userEventId: Type.String({ minLength: 1, maxLength: 300 }),
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
		judgment_id: Identifier,
		disposition: StringEnum(["judgment", "not-applicable"] as const),
		applicability: Type.Optional(ContextApplicabilityDataSchema),
		context_source_assessments: Type.Optional(
			Type.Array(ContextSourceAssessmentParam, {
				maxItems: 32,
				uniqueItems: true,
			}),
		),
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
		produced_artifacts: Type.Optional(
			Type.Array(Type.String({ minLength: 1, maxLength: MAX_PATH }), {
				maxItems: 100,
				uniqueItems: true,
			}),
		),
	},
	{ additionalProperties: false },
);

export type ConcludeJudgmentData = Static<typeof ConcludeJudgmentParams>;

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
	if (!params.outcome) fail("disposition=judgment requires outcome.");
	if (
		params.not_applicable_reason !== undefined ||
		params.not_applicable_basis !== undefined
	) {
		fail("disposition=judgment cannot carry not-applicable fields.");
	}
	return {
		applicability: params.applicability,
		contextSourceAssessments: params.context_source_assessments ?? [],
		nominations: params.nominations ?? [],
		selectionBasis: params.selection_basis,
		coverage: params.coverage,
		outcome: params.outcome,
	};
}

function branchResultId(toolCallId: string): string {
	return `branch-result-${sha256(toolCallId).slice(0, 16)}`;
}

export function resolveModelContextNominations(input: {
	readonly nominations: readonly ModelContextNomination[];
	readonly branch: readonly PiBranchEntryInput[];
}): DeveloperContextNomination[] {
	const results = activeBranchToolResultIdentities(input.branch);
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
			return {
				nominationId: nomination.nominationId,
				kind: nomination.kind,
				userEventId: nomination.userEventId,
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

export function contextFailureWithBranchIdentities(input: {
	readonly error: unknown;
	readonly branch: readonly PiBranchEntryInput[];
}): string {
	const message =
		input.error instanceof Error ? input.error.message : String(input.error);
	const identities = activeBranchToolResultIdentities(input.branch)
		.slice(-20)
		.map(
			(result) =>
				`- ${branchResultId(result.toolCallId)} · ${result.toolName} · ${result.isError ? "error" : "success"}`,
		);
	return `${message}\nAvailable exact branchResultId values:\n${identities.join("\n") || "- none"}`;
}
