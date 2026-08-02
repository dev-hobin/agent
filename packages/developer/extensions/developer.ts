import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { StringEnum } from "@earendil-works/pi-ai";
import type {
	ExtensionAPI,
	ExtensionCommandContext,
	ExtensionContext,
	Skill,
} from "@earendil-works/pi-coding-agent";
import { Type, type Static } from "typebox";
import {
	ContextApplicabilityDataSchema,
	compiledJudgmentPolicyData,
	sha256,
} from "@hobin/judgment";
import {
	activeBranchToolResultIdentities,
	type PiBranchEntryInput,
} from "@hobin/judgment/pi-context";

import {
	COMPACTION_LANGUAGE_ENTRY,
	applyCompactionLanguageEvent,
	continuityConsumed,
	continuityPending,
	detectStrongUserLanguage,
	initialCompactionLanguageState,
	languageObserved,
	projectCompactionContinuity,
	reconstructCompactionLanguage,
	settlementContinuityEvent,
	type CompactionLanguageState,
} from "./compaction-language.ts";
import {
	completeDeveloperArgs,
	parseDeveloperCommand,
} from "./developer-command.ts";
import {
	concludeDeveloperContext,
	describeInventory,
	snapshotDeveloperInventory,
	type DeveloperContextNomination,
	type DeveloperInventorySnapshot,
} from "./developer-context.ts";
import { inspectDeveloperWorkbench } from "./developer-workbench.ts";
import {
	showDeveloperWorkbench,
	type DeveloperWorkbenchAction,
} from "./developer-workbench-tui.ts";
import {
	availableDeveloperSkills,
	loadOptionalSkillPolicy,
	renderDeveloperMethod,
} from "./skill-catalog.ts";
import {
	TOOL_POLICY_LIFECYCLE_ENTRY,
	builtinControlledToolCapabilities,
	isControlledToolAllowed,
	reconcileProtocolTools,
	reloadSafeToolPolicyMarker,
	toolPolicyReloadRequiresRestart,
	type ToolPolicyMemory,
} from "./tool-policy.ts";
import {
	DeveloperWidget,
	editQuestionResolutionRequest,
	renderDeveloperFooter,
	showDeveloperSettings,
	showPendingQuestionSelector,
} from "./tui.ts";
import {
	AUTHORIZE_CHANGE_TOOL,
	CONCLUDE_JUDGMENT_TOOL,
	DEVELOPER_ACTIVATION_ENTRY,
	DEVELOPER_FOCUS_ENTRY,
	DEVELOPER_PROTOCOL,
	DEVELOPER_PROTOCOL_TOOLS,
	RECORD_LANDING_TOOL,
	activationChanged,
	changeAuthorized,
	developerEventData,
	judgmentConcluded,
	judgmentOpened,
	landingRecorded,
	parseDeveloperEvent,
	type ChoiceResponseSpec,
	type DeveloperEvent,
	type PendingQuestion,
	type QuestionGate,
	type QuestionResolutionOwner,
	type QuestionUpdateStatus,
} from "../src/protocol.ts";
import {
	developerNextOperations,
	developerProtocolState,
	developerToolAccess,
	initialDeveloperState,
	transitionDeveloper,
	type DeveloperState,
} from "../src/transition.ts";
import { replayDeveloper } from "../src/replay.ts";

const extensionRoot = dirname(fileURLToPath(import.meta.url));
const skillsRoot = resolve(extensionRoot, "..", "skills");
const MAX_OUTPUT_CHARS = 64_000;
const MAX_TEXT = 8_000;
const MAX_SHORT_TEXT = 2_000;
const MAX_PATH = 4_096;
const TOOL_POLICY_RESTART_MESSAGE =
	"Developer detected an in-process package reload without a reload-safe tool handoff. Restart Pi before enabling Developer; prior built-in tool selection cannot be reconstructed safely.";

const Identifier = Type.String({
	minLength: 1,
	maxLength: 160,
	pattern: "^[A-Za-z][A-Za-z0-9._:/-]*$",
});
const ShortText = Type.String({ minLength: 1, maxLength: MAX_SHORT_TEXT });
const Text = Type.String({ minLength: 1, maxLength: MAX_TEXT });
const Sha256 = Type.String({ pattern: "^[a-f0-9]{64}$" });

const MethodAlternativeParam = Type.Object(
	{
		skill_name: Type.String({
			minLength: 1,
			maxLength: 64,
			pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
		}),
		reason: ShortText,
	},
	{ additionalProperties: false },
);

const OpenJudgmentParams = Type.Object(
	{
		skill_name: Type.String({
			minLength: 1,
			maxLength: 64,
			pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
		}),
		question: ShortText,
		reason: ShortText,
		known_evidence: Type.Optional(
			Type.Array(ShortText, { maxItems: 20, uniqueItems: true }),
		),
		considered_methods: Type.Optional(
			Type.Array(MethodAlternativeParam, {
				maxItems: 10,
			}),
		),
		pending_question_id: Type.Optional(
			Type.String({
				minLength: 1,
				maxLength: 160,
				pattern: "^[A-Za-z][A-Za-z0-9._:/-]*$",
				description:
					"Exact existing pending question ID shown by /developer status; omit for a new judgment and never substitute a runtime judgment or capability identifier.",
			}),
		),
	},
	{ additionalProperties: false },
);

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

const ChoiceOptionParam = Type.Object(
	{
		value: Identifier,
		label: ShortText,
		description: Type.Optional(ShortText),
		detailPrompt: Type.Optional(ShortText),
	},
	{ additionalProperties: false },
);
const ChoiceFieldParam = Type.Object(
	{
		id: Identifier,
		prompt: ShortText,
		description: Type.Optional(ShortText),
		options: Type.Array(ChoiceOptionParam, { minItems: 2, maxItems: 20 }),
	},
	{ additionalProperties: false },
);
const ChoiceResponseParam = Type.Object(
	{
		kind: Type.Literal("choice-form"),
		fields: Type.Array(ChoiceFieldParam, { minItems: 1, maxItems: 20 }),
	},
	{ additionalProperties: false },
);
const OpenQuestionParam = Type.Object(
	{
		id: Identifier,
		question: ShortText,
		context: Type.Optional(Text),
		response_spec: Type.Optional(ChoiceResponseParam),
		status: StringEnum(["open", "blocked"] as const),
		resolution_owner: StringEnum([
			"agent",
			"user",
			"environment",
			"unknown",
		] as const),
		gate: StringEnum([
			"none",
			"before-implementation",
			"before-completion",
		] as const),
		resolution_criteria: ShortText,
	},
	{ additionalProperties: false },
);
const QuestionUpdateParam = Type.Object(
	{
		question_id: Identifier,
		status: StringEnum([
			"resolved",
			"not-applicable",
			"open",
			"blocked",
		] as const),
		result: Text,
		basis: Type.Array(ShortText, {
			minItems: 1,
			maxItems: 32,
			uniqueItems: true,
		}),
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

const ConcludeJudgmentParams = Type.Object(
	{
		judgment_id: Identifier,
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
		produced_artifacts: Type.Optional(
			Type.Array(Type.String({ minLength: 1, maxLength: MAX_PATH }), {
				maxItems: 100,
				uniqueItems: true,
			}),
		),
		opened_questions: Type.Optional(
			Type.Array(OpenQuestionParam, { maxItems: 20 }),
		),
		question_updates: Type.Optional(
			Type.Array(QuestionUpdateParam, { maxItems: 20 }),
		),
	},
	{ additionalProperties: false },
);

const RefinementParam = Type.Object(
	{
		kind: StringEnum(["refinement-boundary", "trusted-compiler-gap"] as const),
		raw_representation: Type.Optional(ShortText),
		refined_representation: Type.Optional(ShortText),
		producer: Type.Optional(ShortText),
		failure: Type.Optional(ShortText),
		first_effect: Type.Optional(ShortText),
		assertion: Type.Optional(ShortText),
		established_by: Type.Optional(ShortText),
		limitation: Type.Optional(ShortText),
		containment: Type.Optional(ShortText),
		verification: Type.Optional(ShortText),
	},
	{ additionalProperties: false },
);
const AuthorizeChangeParams = Type.Object(
	{
		question: ShortText,
		reason: ShortText,
		movement: ShortText,
		stable_landing: ShortText,
		verification_target: ShortText,
		refinement: Type.Optional(RefinementParam),
		pending_question_id: Type.Optional(
			Type.String({
				minLength: 1,
				maxLength: 160,
				pattern: "^[A-Za-z][A-Za-z0-9._:/-]*$",
				description:
					"Exact existing pending question ID shown by /developer status; omit for a new change and never substitute a runtime judgment or capability identifier.",
			}),
		),
	},
	{ additionalProperties: false },
);
const RecordLandingParams = Type.Object(
	{
		authorization_id: Identifier,
		changed_paths: Type.Array(
			Type.String({ minLength: 1, maxLength: MAX_PATH }),
			{ minItems: 1, maxItems: 200, uniqueItems: true },
		),
		result: Text,
		verification: Type.Optional(
			Type.Array(ShortText, { maxItems: 100, uniqueItems: true }),
		),
	},
	{ additionalProperties: false },
);

type OpenJudgmentData = Static<typeof OpenJudgmentParams>;
type ConcludeJudgmentData = Static<typeof ConcludeJudgmentParams>;
type AuthorizeChangeData = Static<typeof AuthorizeChangeParams>;
type RecordLandingData = Static<typeof RecordLandingParams>;

function fail(message: string): never {
	throw new Error(message);
}

function boundedOutput(text: string): string {
	if (text.length > MAX_OUTPUT_CHARS) {
		throw new Error(
			`Developer tool output exceeds ${MAX_OUTPUT_CHARS} characters.`,
		);
	}
	return text;
}

function textResult(text: string, event: DeveloperEvent) {
	return {
		content: [{ type: "text" as const, text: boundedOutput(text) }],
		details: developerEventData(event),
	};
}

function sameToolSet(left: readonly string[], right: readonly string[]) {
	return (
		left.length === right.length && left.every((value) => right.includes(value))
	);
}

function workIdentity(toolCallId: string, prefix: "judgment" | "change") {
	return `${prefix}:${sha256(toolCallId).slice(0, 24)}`;
}

function activeJudgment(state: DeveloperState) {
	return state.activeWork?.kind === "active-judgment"
		? state.activeWork
		: undefined;
}

function activeChange(state: DeveloperState) {
	return state.activeWork?.kind === "authorized-change"
		? state.activeWork
		: undefined;
}

function requireNoMisplaced(
	input: Record<string, unknown>,
	allowed: readonly string[],
	label: string,
) {
	const accepted = new Set(allowed);
	const misplaced = Object.entries(input)
		.filter(([key, value]) => value !== undefined && !accepted.has(key))
		.map(([key]) => key);
	if (misplaced.length > 0) {
		fail(`${label} does not accept: ${misplaced.join(", ")}.`);
	}
}

function refinementFrom(
	value: AuthorizeChangeData["refinement"],
): object | undefined {
	if (!value) return undefined;
	if (value.kind === "refinement-boundary") {
		requireNoMisplaced(
			value,
			[
				"kind",
				"raw_representation",
				"refined_representation",
				"producer",
				"failure",
				"first_effect",
			],
			"refinement-boundary",
		);
		for (const field of [
			"raw_representation",
			"refined_representation",
			"producer",
			"failure",
			"first_effect",
		] as const) {
			if (!value[field]?.trim()) fail(`refinement.${field} is required.`);
		}
		return {
			kind: value.kind,
			rawRepresentation: value.raw_representation,
			refinedRepresentation: value.refined_representation,
			producer: value.producer,
			failure: value.failure,
			firstEffect: value.first_effect,
		};
	}
	requireNoMisplaced(
		value,
		[
			"kind",
			"assertion",
			"established_by",
			"limitation",
			"containment",
			"verification",
		],
		"trusted-compiler-gap",
	);
	for (const field of [
		"assertion",
		"established_by",
		"limitation",
		"containment",
		"verification",
	] as const) {
		if (!value[field]?.trim()) fail(`refinement.${field} is required.`);
	}
	return {
		kind: value.kind,
		assertion: value.assertion,
		establishedBy: value.established_by,
		limitation: value.limitation,
		containment: value.containment,
		verification: value.verification,
	};
}

function responseSpec(
	value: Static<typeof ChoiceResponseParam> | undefined,
): ChoiceResponseSpec | undefined {
	return value
		? {
				kind: "choice-form",
				fields: value.fields.map((field) => ({
					id: field.id,
					prompt: field.prompt,
					...(field.description ? { description: field.description } : {}),
					options: field.options.map((option) => ({
						value: option.value,
						label: option.label,
						...(option.description ? { description: option.description } : {}),
						...(option.detailPrompt
							? { detailPrompt: option.detailPrompt }
							: {}),
					})),
				})),
			}
		: undefined;
}

function openedQuestions(
	input: ConcludeJudgmentData["opened_questions"],
	judgmentId: string,
) {
	return (input ?? []).map((question) => ({
		id: question.id,
		question: question.question,
		...(question.context ? { context: question.context } : {}),
		...(question.response_spec
			? { responseSpec: responseSpec(question.response_spec) }
			: {}),
		status: question.status,
		resolutionOwner: question.resolution_owner as QuestionResolutionOwner,
		gate: question.gate as QuestionGate,
		resolutionCriteria: question.resolution_criteria,
		sourceWorkId: judgmentId,
	}));
}

function questionUpdates(input: ConcludeJudgmentData["question_updates"]) {
	return (input ?? []).map((update) => ({
		questionId: update.question_id,
		status: update.status as QuestionUpdateStatus,
		result: update.result,
		basis: update.basis,
	}));
}

function requiredContextFields(params: ConcludeJudgmentData) {
	if (!params.applicability)
		fail("disposition=judgment requires applicability.");
	if (params.applicability.kind !== "applicable") {
		fail("disposition=judgment requires applicability.kind=applicable.");
	}
	if (!params.selection_basis)
		fail("disposition=judgment requires selection_basis.");
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
		nominations: params.nominations ?? [],
		selectionBasis: params.selection_basis,
		coverage: params.coverage,
		outcome: params.outcome,
	};
}

type ModelContextNomination = NonNullable<
	ConcludeJudgmentData["nominations"]
>[number];

function branchResultId(toolCallId: string): string {
	return `branch-result-${sha256(toolCallId).slice(0, 16)}`;
}

function resolveModelContextNominations(input: {
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
					([id, candidate]) =>
						`- ${id} · ${candidate.toolName} · ${candidate.isError ? "error" : "success"}`,
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

function activeBranchContextGuide(
	state: DeveloperState,
	branch: readonly PiBranchEntryInput[],
): string | null {
	const active = activeJudgment(state);
	if (!active) return null;
	const identities = activeBranchToolResultIdentities(branch).slice(-20);
	if (identities.length === 0) return null;
	return [
		"<developer-active-branch-context>",
		`judgment_id=${active.judgmentId}`,
		"Exact active-branch result aliases available as open-world observed context:",
		...identities.map(
			(result) =>
				`- ${branchResultId(result.toolCallId)} · ${result.toolName} · ${result.isError ? "error (cannot satisfy coverage)" : "success"}`,
		),
		"Use these exact compact values in tool-result nominations; runtime binds them to full active-branch tool provenance. Never substitute a tool name, package name, invented inventory ID, or similar-looking ID.",
		"</developer-active-branch-context>",
	].join("\n");
}

function contextFailureWithBranchIdentities(
	error: unknown,
	branch: readonly PiBranchEntryInput[],
): string {
	const message = error instanceof Error ? error.message : String(error);
	const identities = activeBranchToolResultIdentities(branch)
		.slice(-20)
		.map(
			(result) =>
				`- ${branchResultId(result.toolCallId)} · ${result.toolName} · ${result.isError ? "error" : "success"}`,
		);
	return `${message}\nAvailable exact branchResultId values:\n${identities.join("\n") || "- none"}`;
}

function conclusionSummary(
	event: ReturnType<typeof judgmentConcluded>,
): string {
	const conclusion = event.conclusion;
	if (conclusion.kind === "contextual-judgment") return conclusion.artifact;
	if (conclusion.kind === "needs-evidence") {
		return conclusion.evidenceNeeded.join("; ");
	}
	if (conclusion.kind === "emergent-question") return conclusion.question;
	return conclusion.reason;
}

function statusSummary(state: DeveloperState, restartIssue?: string) {
	const active = state.activeWork
		? `${state.activeWork.kind} · ${state.activeWork.question}`
		: "none";
	return [
		`developer ${state.enabled ? "on" : "off"} · ${developerProtocolState(state)}`,
		`active: ${active}`,
		`next operations: ${developerNextOperations(state).join(", ") || "none"}`,
		`pending questions: ${state.pendingQuestions.length}`,
		`reroute: ${state.obligations.rerouteRequired ? "required" : "clear"}`,
		`framing: ${state.obligations.implementationFramingRequired ? "required" : "clear"}`,
		`verification: ${state.obligations.verificationRequired ? "required" : "current"}`,
		...(restartIssue ? [`restart: ${restartIssue}`] : []),
		"protocol state is not a product-completion claim",
	].join("\n");
}

function protocolPrompt(
	state: DeveloperState,
	availableSkills: readonly string[],
	replayIssues: readonly string[],
) {
	const pending = state.pendingQuestions
		.slice(0, 20)
		.map(
			(question) =>
				`- ${question.id} · ${question.resolutionOwner}/${question.gate} · ${question.question} · resolves when ${question.resolutionCriteria}`,
		)
		.join("\n");
	return [
		"\n\n## Developer Dynamic Judgment Protocol",
		"Developer separates semantic judgment from mutation authorization. Use only currently active Developer operations; never manufacture evaluator or user authority from prose.",
		"While Developer is idle, read only exact paths already known from the request. If evidence location is unknown or repository exploration is required, open the owning judgment before browsing so its evidence lane becomes available.",
		"Unknown file or test location is an evidence-acquisition gap, not a product-meaning gap. When requested behavior and examples are already exact, do not open specify merely to locate repository evidence; choose the capability that owns the concrete helper shape, structural signal, abstraction pressure, or completion claim.",
		`State: ${developerProtocolState(state)}.`,
		`Available Developer skills: ${availableSkills.join(", ") || "none"}.`,
		`Legal operations: ${developerNextOperations(state).join(", ") || "none"}.`,
		state.activeWork?.kind === "active-judgment"
			? `ActiveJudgment ${state.activeWork.judgmentId} exposes only ${CONCLUDE_JUDGMENT_TOOL}. Nominate exact current-branch material, relate every selected material through a contribution, then record one outcome without mutation fields.`
			: "",
		state.activeWork?.kind === "authorized-change"
			? `AuthorizedChange ${state.activeWork.authorizationId} permits its bounded movement and exposes only ${RECORD_LANDING_TOOL}. Record non-empty changed paths; do not smuggle a semantic outcome into the landing.`
			: "",
		state.obligations.implementationFramingRequired
			? "Implementation remains blocked until sketch or signal supplies framing."
			: "",
		state.obligations.verificationRequired
			? "A stable landing still requires a separate verify judgment before completion."
			: "",
		pending ? `Pending questions:\n${pending}` : "",
		...replayIssues.map((issue) => `Replay diagnostic: ${issue}`),
	]
		.filter(Boolean)
		.join("\n");
}

export default async function developerV7(pi: ExtensionAPI) {
	let availableSkills = new Map<string, Skill>();
	let inventorySnapshot: DeveloperInventorySnapshot | undefined;
	let state = initialDeveloperState();
	let replayIssues: string[] = [];
	let compactionLanguage: CompactionLanguageState =
		initialCompactionLanguageState();
	let toolPolicyMemory: ToolPolicyMemory = { withheldBuiltins: new Set() };
	let toolPolicyRestartRequired = false;

	pi.registerFlag("developer", {
		description: "Start with Developer enabled",
		type: "boolean",
		default: false,
	});

	const syncProtocolTools = () => {
		const current = pi.getActiveTools();
		const next = reconcileProtocolTools({
			activeTools: current,
			allTools: pi.getAllTools(),
			enabled: state.enabled,
			access: developerToolAccess(state),
			protocolTools: DEVELOPER_PROTOCOL_TOOLS,
			activeProtocolTools: developerNextOperations(state),
			memory: toolPolicyMemory,
		});
		toolPolicyMemory = next.memory;
		if (!sameToolSet(current, next.activeTools)) {
			pi.setActiveTools(next.activeTools);
		}
	};

	const releaseProtocolTools = () => {
		const current = pi.getActiveTools();
		const next = reconcileProtocolTools({
			activeTools: current,
			allTools: pi.getAllTools(),
			enabled: false,
			access: developerToolAccess(state),
			protocolTools: DEVELOPER_PROTOCOL_TOOLS,
			memory: toolPolicyMemory,
		});
		toolPolicyMemory = next.memory;
		if (!sameToolSet(current, next.activeTools)) {
			pi.setActiveTools(next.activeTools);
		}
	};

	const refreshUI = (ctx: ExtensionContext) => {
		if (toolPolicyRestartRequired) {
			ctx.ui.setStatus("developer", "developer · restart required");
			ctx.ui.setWidget(
				"developer",
				["blocked · restart Pi to reset Developer tool access"],
				{ placement: "belowEditor" },
			);
			return;
		}
		if (!state.enabled) {
			ctx.ui.setStatus("developer", undefined);
			ctx.ui.setWidget("developer", undefined);
			return;
		}
		ctx.ui.setStatus(
			"developer",
			ctx.mode === "tui"
				? renderDeveloperFooter(state, ctx.ui.theme)
				: `developer · ${developerProtocolState(state)}`,
		);
		if (
			!state.activeWork &&
			state.pendingQuestions.length === 0 &&
			!state.obligations.rerouteRequired &&
			!state.obligations.implementationFramingRequired &&
			!state.obligations.verificationRequired
		) {
			ctx.ui.setWidget("developer", undefined);
			return;
		}
		if (ctx.mode === "tui") {
			const viewState = state;
			ctx.ui.setWidget(
				"developer",
				(_tui, theme) => new DeveloperWidget(viewState, theme),
				{ placement: "belowEditor" },
			);
			return;
		}
		ctx.ui.setWidget(
			"developer",
			statusSummary(state).split("\n").slice(1, 8),
			{
				placement: "belowEditor",
			},
		);
	};

	const reconstruct = (ctx: ExtensionContext) => {
		const replay = replayDeveloper(ctx.sessionManager.getBranch());
		state = toolPolicyRestartRequired ? initialDeveloperState() : replay.state;
		replayIssues = replay.issues.map((issue) => issue.message);
		compactionLanguage = reconstructCompactionLanguage(
			ctx.sessionManager.getBranch(),
		);
		syncProtocolTools();
		refreshUI(ctx);
	};

	const commitEvent = (
		event: DeveloperEvent,
		ctx: ExtensionContext,
		customType?: string,
	) => {
		const transition = transitionDeveloper(state, event);
		if (!transition.ok) fail(transition.error.message);
		if (customType) pi.appendEntry(customType, developerEventData(event));
		state = transition.state;
		syncProtocolTools();
		refreshUI(ctx);
	};

	const setEnabled = (enabled: boolean, ctx: ExtensionContext): boolean => {
		if (enabled && toolPolicyRestartRequired) {
			ctx.ui.notify(TOOL_POLICY_RESTART_MESSAGE, "error");
			return false;
		}
		commitEvent(activationChanged(enabled), ctx, DEVELOPER_ACTIVATION_ENTRY);
		if (!enabled && compactionLanguage.pending) {
			const consumed = continuityConsumed(
				compactionLanguage.pending.compactionId,
			);
			pi.appendEntry(COMPACTION_LANGUAGE_ENTRY, consumed);
			compactionLanguage = applyCompactionLanguageEvent(
				compactionLanguage,
				consumed,
			);
		}
		return true;
	};

	pi.registerTool({
		name: "developer_open_judgment",
		label: "Open Developer Judgment",
		description:
			"Choose one Pi-visible Developer capability, load its complete method, and compile its optional judgment.json policy.",
		promptSnippet: "Open one bounded Developer judgment",
		promptGuidelines: [
			"Use only when Developer is idle and a semantic development question needs one owning capability.",
			"Choose the narrowest available Developer skill supported by current evidence; do not use this operation to authorize mutation.",
		],
		parameters: OpenJudgmentParams,
		executionMode: "sequential",
		async execute(
			toolCallId,
			params: OpenJudgmentData,
			_signal,
			_onUpdate,
			ctx,
		) {
			if (!state.enabled) fail("Developer is off. Run /developer on first.");
			if (!inventorySnapshot)
				fail("Developer inventory is unavailable before before_agent_start.");
			const skill = availableSkills.get(params.skill_name);
			if (!skill)
				fail(`Developer skill is not Pi-visible: ${params.skill_name}.`);
			const [policy, method] = await Promise.all([
				loadOptionalSkillPolicy(skill),
				renderDeveloperMethod(skill),
			]);
			const event = judgmentOpened({
				kind: "active-judgment",
				judgmentId: workIdentity(toolCallId, "judgment"),
				question: params.question,
				skill: { name: skill.name, location: skill.filePath },
				reason: params.reason,
				knownEvidence: params.known_evidence ?? [],
				consideredMethods: (params.considered_methods ?? []).map(
					(alternative) => ({
						skillName: alternative.skill_name,
						reason: alternative.reason,
					}),
				),
				...(params.pending_question_id
					? { targetQuestionId: params.pending_question_id }
					: {}),
				...(policy ? { policy: compiledJudgmentPolicyData(policy) } : {}),
			});
			const transition = transitionDeveloper(state, event);
			if (!transition.ok) fail(transition.error.message);
			const inventory = describeInventory(
				policy,
				skill.baseDir,
				inventorySnapshot,
			);
			const output = boundedOutput(
				[
					method,
					"",
					`Judgment ID: ${event.judgment.judgmentId}`,
					`Dynamic question: ${event.judgment.question}`,
					`Policy: ${policy?.policySha256 ?? "absent (normal complete skill)"}`,
					"Pi-visible context inventory (availability is not obligation):",
					...inventory.map(
						(source) =>
							`- ${source.id} · ${source.kind} · descriptor=${source.descriptorSha256}${"path" in source ? ` · path=${source.path}` : ""}${source.when ? ` · when=${source.when.join(" | ")}` : ""}`,
					),
					"Nominate only exact material that can change this dynamic judgment. Use compact branchResultId aliases for active-branch results. Coverage relates each selected material through useAs plus a concrete contribution; conflicts and limitations remain explicit.",
				].join("\n"),
			);
			state = transition.state;
			syncProtocolTools();
			refreshUI(ctx);
			return textResult(output, event);
		},
	});

	pi.registerTool({
		name: "developer_conclude_judgment",
		label: "Conclude Developer Judgment",
		description:
			"Close the exact active semantic judgment with branch-local context selection, sealing, coverage, and outcome, or an explicit question-level not-applicable result.",
		promptSnippet: "Conclude the active Developer judgment",
		promptGuidelines: [
			"Nominate only exact inventory IDs, active-branch tool call IDs, or active-branch user event IDs.",
			"For disposition=judgment, applicability.kind must be applicable; represent unresolved context through required coverage and a needs-evidence outcome.",
			"Relate every selected material to the dynamic question with useAs and a concrete contribution; do not flatten source identity into prose.",
			"Use needs-evidence coverage only with an explicit conflict or limitation; sufficient coverage cannot retain conflicts.",
			"Citations reference the zero-based contributionIndex in the submitted coverage contribution array.",
			"Do not include changed paths, mutation claims, or implementation authorization.",
		],
		parameters: ConcludeJudgmentParams,
		executionMode: "sequential",
		async execute(
			_toolCallId,
			params: ConcludeJudgmentData,
			signal,
			_onUpdate,
			ctx,
		) {
			const active = activeJudgment(state);
			if (!active) fail("No Developer judgment is active.");
			if (params.judgment_id !== active.judgmentId) {
				fail(
					`Judgment ${params.judgment_id} cannot close ${active.judgmentId}.`,
				);
			}
			const common = {
				judgmentId: active.judgmentId,
				producedArtifacts: params.produced_artifacts ?? [],
				openedQuestions: openedQuestions(
					params.opened_questions,
					active.judgmentId,
				),
				questionUpdates: questionUpdates(params.question_updates),
			};
			let conclusion: object;
			if (params.disposition === "not-applicable") {
				requireNoMisplaced(
					params,
					[
						"judgment_id",
						"disposition",
						"not_applicable_reason",
						"not_applicable_basis",
						"produced_artifacts",
						"opened_questions",
						"question_updates",
					],
					"disposition=not-applicable",
				);
				if (!params.not_applicable_reason || !params.not_applicable_basis) {
					fail(
						"disposition=not-applicable requires reason and non-empty basis.",
					);
				}
				conclusion = {
					...common,
					kind: "judgment-not-applicable",
					reason: params.not_applicable_reason,
					basis: params.not_applicable_basis,
				};
			} else {
				if (!inventorySnapshot)
					fail("Developer inventory is unavailable before before_agent_start.");
				const fields = requiredContextFields(params);
				const skill = availableSkills.get(active.skill.name);
				if (!skill) {
					fail(
						`Active Developer skill is no longer visible: ${active.skill.name}.`,
					);
				}
				const branchRef = active.judgmentId;
				const snapshot: DeveloperInventorySnapshot = Object.freeze({
					...inventorySnapshot,
					input: {
						...inventorySnapshot.input,
						activeToolNames: pi.getActiveTools(),
						tools: pi.getAllTools().map((tool) => ({
							name: tool.name,
							description: tool.description,
							sourceInfo: tool.sourceInfo,
						})),
					},
				});
				const branch = ctx.sessionManager.getBranch();
				const nominations = resolveModelContextNominations({
					nominations: fields.nominations,
					branch,
				});
				const contextual = await concludeDeveloperContext({
					judgmentId: active.judgmentId,
					skill: active.skill,
					...(active.policy ? { policy: active.policy } : {}),
					decisionUnitRoot: skill.baseDir,
					question: active.question,
					knownEvidence: active.knownEvidence,
					applicability: fields.applicability,
					nominations,
					selectionBasis: fields.selectionBasis,
					coverageProposal: fields.coverage,
					outcomeProposal: fields.outcome,
					snapshot,
					branchRef,
					branch,
					...(signal ? { signal } : {}),
				}).catch((error: unknown) => {
					fail(contextFailureWithBranchIdentities(error, branch));
				});
				const outcome = contextual.outcome;
				if (outcome.kind === "contextual-judgment") {
					conclusion = {
						...common,
						kind: outcome.kind,
						contextBasis: contextual.basis,
						rationale: outcome.rationale,
						artifact: outcome.artifact,
						stopEvidence: outcome.stopEvidence,
					};
				} else if (outcome.kind === "needs-evidence") {
					conclusion = {
						...common,
						kind: outcome.kind,
						contextBasis: contextual.basis,
						evidenceNeeded: outcome.evidenceNeeded,
						resolutionOwner: outcome.resolutionOwner,
						...(outcome.artifact ? { artifact: outcome.artifact } : {}),
					};
				} else {
					conclusion = {
						...common,
						kind: outcome.kind,
						contextBasis: contextual.basis,
						question: outcome.question,
						reason: outcome.reason,
						artifact: outcome.artifact,
						stopEvidence: outcome.stopEvidence,
					};
				}
			}
			const event = judgmentConcluded(conclusion);
			const transition = transitionDeveloper(state, event);
			if (!transition.ok) fail(transition.error.message);
			const summary = conclusionSummary(event);
			const output = boundedOutput(
				`Judgment ${active.judgmentId} concluded as ${event.conclusion.kind}.\n${summary}`,
			);
			state = transition.state;
			syncProtocolTools();
			refreshUI(ctx);
			return textResult(output, event);
		},
	});

	pi.registerTool({
		name: "developer_authorize_change",
		label: "Authorize Developer Change",
		description:
			"Authorize one bounded implementation movement with a stable landing and verification target; this does not claim that mutation already occurred.",
		promptSnippet: "Authorize one bounded change",
		promptGuidelines: [
			"Use only when no before-implementation question or framing obligation remains.",
			"Declare a refinement boundary only when broader input actually becomes an invariant-carrying value; absence is not a generated not-applicable placeholder.",
		],
		parameters: AuthorizeChangeParams,
		executionMode: "sequential",
		async execute(
			toolCallId,
			params: AuthorizeChangeData,
			_signal,
			_onUpdate,
			ctx,
		) {
			const event = changeAuthorized({
				kind: "authorized-change",
				authorizationId: workIdentity(toolCallId, "change"),
				question: params.question,
				reason: params.reason,
				contract: {
					movement: params.movement,
					stableLanding: params.stable_landing,
					verificationTarget: params.verification_target,
					...(params.refinement
						? { refinement: refinementFrom(params.refinement) }
						: {}),
				},
				...(params.pending_question_id
					? { targetQuestionId: params.pending_question_id }
					: {}),
			});
			const transition = transitionDeveloper(state, event);
			if (!transition.ok) fail(transition.error.message);
			const output = boundedOutput(
				[
					`Authorization ID: ${event.change.authorizationId}`,
					`Movement: ${event.change.contract.movement}`,
					`Stable landing: ${event.change.contract.stableLanding}`,
					`Verification target: ${event.change.contract.verificationTarget}`,
					"Artifact mutation is now authorized only for this active work. Record the landing afterward with exact changed paths.",
				].join("\n"),
			);
			state = transition.state;
			syncProtocolTools();
			refreshUI(ctx);
			return textResult(output, event);
		},
	});

	pi.registerTool({
		name: "developer_record_landing",
		label: "Record Developer Landing",
		description:
			"Record the exact authorized change's non-empty changed paths, stable result, and current verification evidence, then create reroute and verification obligations.",
		promptSnippet: "Record the authorized stable landing",
		promptGuidelines: [
			"Use the exact active authorization ID and every changed product path.",
			"Verification evidence on the landing does not itself clear the separate verify judgment obligation.",
		],
		parameters: RecordLandingParams,
		executionMode: "sequential",
		async execute(
			_toolCallId,
			params: RecordLandingData,
			_signal,
			_onUpdate,
			ctx,
		) {
			const active = activeChange(state);
			if (!active) fail("No Developer change authorization is active.");
			if (params.authorization_id !== active.authorizationId) {
				fail(
					`Landing ${params.authorization_id} cannot close ${active.authorizationId}.`,
				);
			}
			const event = landingRecorded({
				authorizationId: params.authorization_id,
				changedPaths: params.changed_paths,
				result: params.result,
				verification: params.verification ?? [],
			});
			const transition = transitionDeveloper(state, event);
			if (!transition.ok) fail(transition.error.message);
			const output = boundedOutput(
				`Landing ${active.authorizationId} recorded for ${event.landing.changedPaths.join(", ")}. Reroute and a separate verify judgment are required.`,
			);
			state = transition.state;
			syncProtocolTools();
			refreshUI(ctx);
			return textResult(output, event);
		},
	});

	const refreshAvailableSkills = (ctx: ExtensionCommandContext) => {
		if (typeof ctx.getSystemPromptOptions !== "function") return;
		availableSkills = availableDeveloperSkills(
			ctx.getSystemPromptOptions().skills ?? [],
			skillsRoot,
		);
	};

	pi.registerCommand("developer", {
		description:
			"Open Developer's branch-aware judgment workbench or run a focused action",
		getArgumentCompletions: completeDeveloperArgs,
		handler: async (args: string, ctx: ExtensionCommandContext) => {
			const setAndNotify = (enabled: boolean) => {
				const changed = setEnabled(enabled, ctx);
				if (changed)
					ctx.ui.notify(`Developer: ${enabled ? "on" : "off"}`, "info");
				return changed;
			};
			const submitQuestion = async (question: PendingQuestion) => {
				const request = await editQuestionResolutionRequest(ctx, question);
				if (request === undefined) return false;
				const focus = parseDeveloperEvent({
					protocol: DEVELOPER_PROTOCOL,
					kind: "question-focused",
					questionId: question.id,
				});
				commitEvent(focus, ctx, DEVELOPER_FOCUS_ENTRY);
				ctx.ui.setEditorText("");
				if (ctx.isIdle()) pi.sendUserMessage(request);
				else pi.sendUserMessage(request, { deliverAs: "followUp" });
				return true;
			};
			const inspectSettings = async () => {
				await showDeveloperSettings(ctx, {
					read: () => state,
					commitActivation(enabled) {
						setAndNotify(enabled);
						return state;
					},
				});
			};
			const inspectWorkbench = async () => {
				while (true) {
					refreshAvailableSkills(ctx);
					const action: DeveloperWorkbenchAction | undefined =
						await showDeveloperWorkbench(
							ctx,
							inspectDeveloperWorkbench(state, {
								activeTools: pi.getActiveTools(),
								availableSkills: [...availableSkills.keys()],
								...(toolPolicyRestartRequired
									? { restartIssue: TOOL_POLICY_RESTART_MESSAGE }
									: {}),
							}),
						);
					if (!action) return;
					if (action.kind === "settings") {
						await inspectSettings();
						continue;
					}
					const question = state.pendingQuestions.find(
						(candidate) => candidate.id === action.questionId,
					);
					if (!question) {
						ctx.ui.notify(
							"That Developer question is no longer open.",
							"warning",
						);
						continue;
					}
					if (await submitQuestion(question)) return;
				}
			};
			const showQuestions = async () => {
				if (state.pendingQuestions.length === 0) {
					ctx.ui.notify("Developer has no open questions.", "info");
					return;
				}
				if (ctx.mode !== "tui") {
					ctx.ui.notify(
						state.pendingQuestions
							.map(
								(question) =>
									`${question.id} · ${question.resolutionOwner}/${question.gate} · ${question.question}`,
							)
							.join("\n"),
						"info",
					);
					return;
				}
				const questionId =
					state.pendingQuestions.length === 1
						? state.pendingQuestions[0]?.id
						: await showPendingQuestionSelector(ctx, state.pendingQuestions);
				const question = state.pendingQuestions.find(
					(candidate) => candidate.id === questionId,
				);
				if (question) await submitQuestion(question);
			};
			const parsed = parseDeveloperCommand(args);
			if (!parsed.ok) {
				ctx.ui.notify(
					"Usage: /developer [status | questions | settings | on | off]",
					"warning",
				);
				return;
			}
			const action = parsed.command.kind;
			if (action === "on") {
				setAndNotify(true);
				return;
			}
			if (action === "off") {
				if (
					ctx.mode === "tui" &&
					(state.activeWork || state.pendingQuestions.length > 0) &&
					!(await ctx.ui.confirm(
						"Turn off Developer?",
						"This clears active Developer work and questions from current v7 state. Session history remains.",
					))
				) {
					return;
				}
				setAndNotify(false);
				return;
			}
			if (action === "questions") {
				await showQuestions();
				return;
			}
			if (action === "settings") {
				if (ctx.mode === "tui") await inspectSettings();
				else
					ctx.ui.notify(
						`Developer settings: activation ${state.enabled ? "on" : "off"}`,
						"info",
					);
				return;
			}
			if (action === "workbench" && ctx.mode === "tui") {
				await inspectWorkbench();
				return;
			}
			refreshAvailableSkills(ctx);
			ctx.ui.notify(
				`${statusSummary(state, toolPolicyRestartRequired ? TOOL_POLICY_RESTART_MESSAGE : undefined)}\nactive tools: ${pi.getActiveTools().join(", ")}\navailable skills: ${[...availableSkills.keys()].join(", ") || "none"}`,
				toolPolicyRestartRequired ? "error" : "info",
			);
		},
	});

	pi.on("input", (event) => {
		if (!state.enabled) return;
		const tag = detectStrongUserLanguage(event.text, event.source);
		if (!tag || tag === compactionLanguage.language) return;
		const observed = languageObserved(tag);
		pi.appendEntry(COMPACTION_LANGUAGE_ENTRY, observed);
		compactionLanguage = applyCompactionLanguageEvent(
			compactionLanguage,
			observed,
		);
	});
	pi.on("session_compact", (event) => {
		if (!state.enabled || !compactionLanguage.language) return;
		const pending = continuityPending(
			event.compactionEntry.id,
			compactionLanguage.language,
		);
		const next = applyCompactionLanguageEvent(compactionLanguage, pending);
		if (next === compactionLanguage) return;
		pi.appendEntry(COMPACTION_LANGUAGE_ENTRY, pending);
		compactionLanguage = next;
	});
	pi.on("context", (event, ctx) => {
		if (!state.enabled) return;
		const projection = projectCompactionContinuity(
			event.messages,
			compactionLanguage,
		);
		let messages = event.messages;
		if (projection) {
			compactionLanguage = projection.state;
			messages = projection.messages as typeof event.messages;
		}
		const branchContext = activeBranchContextGuide(
			state,
			ctx.sessionManager.getBranch(),
		);
		if (!branchContext) {
			return projection ? { messages } : undefined;
		}
		return {
			messages: [
				...messages,
				{
					role: "custom",
					customType: "developer.active-branch-context",
					content: branchContext,
					display: false,
					timestamp: Date.now(),
				},
			] as typeof event.messages,
		};
	});
	pi.on("before_agent_start", (event, ctx) => {
		availableSkills = availableDeveloperSkills(
			event.systemPromptOptions.skills ?? [],
			skillsRoot,
		);
		inventorySnapshot = snapshotDeveloperInventory({
			pi,
			ctx,
			skills: event.systemPromptOptions.skills ?? [],
			contextFiles: event.systemPromptOptions.contextFiles ?? [],
		});
		if (!state.enabled) return;
		return {
			systemPrompt:
				event.systemPrompt +
				protocolPrompt(state, [...availableSkills.keys()], replayIssues),
		};
	});

	pi.on("tool_call", (event) => {
		const capability = builtinControlledToolCapabilities(pi.getAllTools()).get(
			event.toolName,
		);
		if (!capability) return;
		const access = developerToolAccess(state);
		if (
			isControlledToolAllowed({ enabled: state.enabled, capability, access })
		) {
			return;
		}
		const blockers = state.pendingQuestions.filter(
			(question) => question.gate === "before-implementation",
		);
		if (blockers.length > 0) {
			return {
				block: true,
				reason: `Developer blocks mutation until these questions resolve: ${blockers
					.map((question) => `${question.id} (${question.question})`)
					.join("; ")}.`,
			};
		}
		return {
			block: true,
			reason:
				capability === "shell"
					? "Developer requires active judgment or change work before built-in bash is available."
					: `Developer requires an active ${AUTHORIZE_CHANGE_TOOL} authorization before built-in edit or write.`,
		};
	});

	pi.on("session_start", (event, ctx) => {
		const branch = ctx.sessionManager.getBranch();
		toolPolicyRestartRequired =
			event.reason === "reload" &&
			toolPolicyReloadRequiresRestart({
				entries: branch,
				protocol: DEVELOPER_PROTOCOL,
				protocolTools: DEVELOPER_PROTOCOL_TOOLS,
			});
		reconstruct(ctx);
		if (toolPolicyRestartRequired) {
			ctx.ui.notify(TOOL_POLICY_RESTART_MESSAGE, "error");
			return;
		}
		if (pi.getFlag("developer") === true && !state.enabled) {
			setEnabled(true, ctx);
		}
	});
	pi.on("session_tree", (_event, ctx) => reconstruct(ctx));
	pi.on("agent_settled", (_event, ctx) => {
		const consumed = settlementContinuityEvent(compactionLanguage);
		if (consumed) {
			pi.appendEntry(COMPACTION_LANGUAGE_ENTRY, consumed);
			compactionLanguage = applyCompactionLanguageEvent(
				compactionLanguage,
				consumed,
			);
		}
		refreshUI(ctx);
	});
	pi.on("session_shutdown", (_event, ctx) => {
		releaseProtocolTools();
		if (!toolPolicyRestartRequired) {
			pi.appendEntry(
				TOOL_POLICY_LIFECYCLE_ENTRY,
				reloadSafeToolPolicyMarker(DEVELOPER_PROTOCOL),
			);
		}
		ctx.ui.setStatus("developer", undefined);
		ctx.ui.setWidget("developer", undefined);
	});
}
