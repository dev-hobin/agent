import { readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type {
	AgentToolResult,
	ExtensionAPI,
	ExtensionCommandContext,
	ExtensionContext,
	Skill,
	Theme,
	ToolRenderResultOptions,
} from "@earendil-works/pi-coding-agent";
import { Text as TuiText } from "@earendil-works/pi-tui";
import { Type, type Static } from "typebox";
import type { PiBranchEntryInput } from "@hobin/judgment/pi-context";

import {
	COMPACTION_LANGUAGE_ENTRY,
	applyCompactionLanguageEvent,
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
	resolveContextSkill,
	snapshotDeveloperInventory,
	type DeveloperContextConclusion,
	type DeveloperCoverageProposal,
	type DeveloperInventorySnapshot,
	type DeveloperPreparedContextSource,
} from "./developer-context.ts";
import {
	developerProgressMessage,
	developerProgressStatus,
	developerProgressWidgetLines,
	showDeveloperReceiptTui,
	type DeveloperProgressPhase,
	type DeveloperProgressView,
	type DeveloperReceiptTuiRead,
} from "./developer-receipt-tui.ts";
import {
	DEVELOPER_RUNTIME_ROUTE_DEFINITIONS,
	createDeveloperRuntimeAdapterCheckpoint,
	createDeveloperRuntimeOpenPlan,
	developerRuntimeRouteDefinition,
	type DeveloperRuntimeSkillCandidateInput,
} from "./developer-runtime.ts";
import {
	DEVELOPER_RUNTIME_ENTRY,
	prepareDeveloperRuntimeBatch,
	reconstructDeveloperRuntimeBranch,
	type DeveloperRuntimeBranchEntry,
	type DeveloperRuntimeBranchReconstruction,
	type DeveloperRuntimeEventDraftInput,
	type PreflightedDeveloperRuntimeBatch,
} from "./developer-runtime-state.ts";
import {
	ConcludeJudgmentParams,
	activeDeveloperEvidenceHandles,
	bindUserAcceptedCoverage,
	contextFailureWithBranchIdentities,
	developerErrorMessage,
	normalizeConcludeJudgmentData,
	requiredContextFields,
	resolveModelContextNominations,
	type ConcludeJudgmentData,
} from "./developer-conclusion.ts";
import {
	availableDeveloperSkills,
	loadOptionalSkillPolicy,
	openSkillContext,
	renderDeveloperMethod,
} from "./skill-catalog.ts";
import {
	captureWorkspaceSnapshot,
	compareWorkspaceSnapshots,
	type WorkspaceSnapshot,
} from "./workspace-observation.ts";
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
	AUTHORIZE_CHANGE_TOOL,
	CONCLUDE_JUDGMENT_TOOL,
	DEVELOPER_PROTOCOL_TOOLS,
	OPEN_CONTEXT_SOURCES_TOOL,
	OPEN_JUDGMENT_TOOL,
	RECORD_LANDING_TOOL,
} from "../src/runtime-tools.ts";
import {
	beginProjectionRefresh,
	completeProjectionRefresh,
	failProjectionRefresh,
	initialProjectionCoordinatorState,
	type ProjectionCoordinatorState,
} from "../src/projection-coordinator.ts";
import { createProposedFrameContribution } from "../src/routing-context.ts";
import {
	createRuntimeChangeAuthorization,
	createRuntimeImplementationLanding,
	createRuntimeScopeClosure,
	type RuntimeImplementationBoundary,
} from "../src/runtime-root.ts";
import {
	proposeReloadReconciliation,
	type AcceptedDeveloperEvent,
	type RuntimeReplayScope,
} from "../src/runtime-replay.ts";
import {
	DEVELOPER_RUNTIME_PROTOCOL,
	canonicalValueSha256,
	parseDeveloperId,
	parseFrameConclusionProposal,
	parseInvocationSettlement,
	parseSha256Digest,
	type CausalEventRef,
	type DeveloperId,
	type InvocationSettlement,
	type Sha256Digest,
} from "../src/runtime-protocol.ts";
import {
	runtimeBlockerSetSha256,
	skillReturnSupportSha256,
	type RuntimeAssignmentState,
	type RuntimeFrameState,
} from "../src/runtime-transition.ts";

const extensionRoot = dirname(fileURLToPath(import.meta.url));
const skillsRoot = resolve(extensionRoot, "..", "skills");
const MAX_OUTPUT_CHARS = 64_000;
const MAX_TEXT = 4_000;
const MAX_PATH = 4_096;
const TOOL_POLICY_RESTART_MESSAGE =
	"Developer detected an in-process package reload without a v8-safe tool handoff. Restart Pi before enabling Developer.";

const Identifier = Type.String({
	minLength: 1,
	maxLength: 160,
	pattern: "^[A-Za-z][A-Za-z0-9._:/-]*$",
});
const Text = Type.String({ minLength: 1, maxLength: MAX_TEXT });
const ObligationParam = Type.Object(
	{ obligation_id: Identifier, statement: Text },
	{ additionalProperties: false },
);
const OwnerSkillParam = Type.Object(
	{
		skill_name: Type.String({
			minLength: 1,
			maxLength: 64,
			pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
		}),
		target_obligation_ids: Type.Optional(
			Type.Array(Identifier, {
				minItems: 1,
				maxItems: 100,
				uniqueItems: true,
			}),
		),
		subquestion: Text,
		expected_contribution: Text,
		limitations: Type.Optional(
			Type.Array(Text, { maxItems: 32, uniqueItems: true }),
		),
	},
	{ additionalProperties: false },
);
const OpenRouteParams = Type.Object(
	{
		purpose: Type.Union([
			Type.Literal("work-decision"),
			Type.Literal("reroute-decision"),
			Type.Literal("verification-decision"),
		]),
		route_definition_id: Identifier,
		question: Text,
		obligations: Type.Array(ObligationParam, {
			minItems: 1,
			maxItems: 100,
		}),
		owner_skill: Type.Optional(OwnerSkillParam),
	},
	{ additionalProperties: false },
);
const OpenContextParams = Type.Object(
	{
		inventory_source_ids: Type.Array(Identifier, {
			minItems: 1,
			maxItems: 4,
			uniqueItems: true,
		}),
	},
	{ additionalProperties: false },
);
const RefinementBoundaryParam = Type.Object(
	{
		kind: Type.Literal("refinement-boundary"),
		raw_representation: Text,
		refined_representation: Text,
		producer: Text,
		failure: Text,
		first_effect: Text,
	},
	{ additionalProperties: false },
);
const TrustedCompilerGapParam = Type.Object(
	{
		kind: Type.Literal("trusted-compiler-gap"),
		assertion: Text,
		established_by: Text,
		limitation: Text,
		containment: Text,
		verification: Text,
	},
	{ additionalProperties: false },
);
const AuthorizeParams = Type.Object(
	{
		movement: Text,
		stable_landing: Text,
		verification_target: Text,
		boundary: Type.Optional(
			Type.Union([RefinementBoundaryParam, TrustedCompilerGapParam]),
		),
	},
	{ additionalProperties: false },
);
const RecordLandingParams = Type.Object(
	{
		changed_paths: Type.Optional(
			Type.Array(Type.String({ minLength: 1, maxLength: MAX_PATH }), {
				minItems: 1,
				maxItems: 200,
				uniqueItems: true,
			}),
		),
		result: Text,
		verification: Type.Optional(
			Type.Array(Text, { maxItems: 100, uniqueItems: true }),
		),
	},
	{ additionalProperties: false },
);

type OpenRouteData = Static<typeof OpenRouteParams>;
type OpenContextData = Static<typeof OpenContextParams>;
type AuthorizeData = Static<typeof AuthorizeParams>;
type RecordLandingData = Static<typeof RecordLandingParams>;
type PlannedRuntimeDraft = Omit<
	DeveloperRuntimeEventDraftInput,
	"eventId" | "occurredAt"
> & {
	readonly eventId?: DeveloperId;
};

type RuntimeContext = ExtensionContext | ExtensionCommandContext;

interface RuntimeWorkspaceObservation {
	readonly workScopeId: DeveloperId;
	readonly scopeBaseline: WorkspaceSnapshot;
	readonly authorizationBaseline: WorkspaceSnapshot | null;
}

function captureRuntimeWorkspace(ctx: RuntimeContext): WorkspaceSnapshot {
	if (typeof ctx.isProjectTrusted !== "function") {
		return Object.freeze({
			kind: "unavailable",
			reason: "Host workspace observation is unavailable.",
		});
	}
	return captureWorkspaceSnapshot(ctx.cwd);
}

function samePaths(input: {
	readonly left: readonly string[];
	readonly right: readonly string[];
}): boolean {
	if (input.left.length !== input.right.length) return false;
	for (let index = 0; index < input.left.length; index += 1) {
		if (input.left[index] !== input.right[index]) return false;
	}
	return true;
}

function fail(message: string): never {
	throw new Error(message);
}

function boundedOutput(text: string): string {
	if (text.length <= MAX_OUTPUT_CHARS) return text;
	return `${text.slice(0, MAX_OUTPUT_CHARS - 80)}\n[Developer v8 output truncated at ${MAX_OUTPUT_CHARS} characters]`;
}

interface DeveloperToolResultDetails {
	readonly protocol?: string;
	readonly nextAction?: string | null;
}

function humanResultText(result: AgentToolResult<unknown>): string {
	const text = result.content.find((item) => item.type === "text");
	if (!text || text.type !== "text") return "";
	return text.text.replace(/\b[a-f0-9]{64}\b/gu, "[internal digest]");
}

function renderDeveloperCall(theme: Theme, label: string): TuiText {
	return new TuiText(
		theme.fg("toolTitle", theme.bold(`Developer · ${label}`)),
		0,
		0,
	);
}

function renderDeveloperResult(input: {
	readonly result: AgentToolResult<unknown>;
	readonly options: ToolRenderResultOptions;
	readonly theme: Theme;
	readonly context: Readonly<{ isError: boolean }>;
	readonly success: string;
}): TuiText {
	const raw = humanResultText(input.result);
	if (input.context.isError) {
		return new TuiText(
			input.theme.fg("error", `× ${raw || "Developer operation failed"}`),
			0,
			0,
		);
	}
	const details = input.result.details as
		| DeveloperToolResultDetails
		| undefined;
	const next = details?.nextAction
		? `\n${input.theme.fg("muted", `→ Next: ${details.nextAction}`)}`
		: "";
	const expanded = input.options.expanded && raw.length > 0 ? `\n${raw}` : "";
	return new TuiText(
		`${input.theme.fg("success", `✓ ${input.success}`)}${next}${expanded}`,
		0,
		0,
	);
}

function runtimeResultSummary(
	reconstruction: DeveloperRuntimeBranchReconstruction,
) {
	const scope = reconstruction.activeScope;
	const debts = scope?.root.debts ?? [];
	const reroutePending = debts.some((debt) => debt.reroutePending);
	const verificationPending = debts.some((debt) => debt.verificationPending);
	let state: "inactive" | "blocked" | "idle" | "frame" | "authorized" =
		"inactive";
	if (reconstruction.blockedReason !== null) state = "blocked";
	else if (scope !== null && scope.root.activeAuthorization !== null)
		state = "authorized";
	else if (scope !== null && frameFor(scope) !== null) state = "frame";
	else if (scope !== null) state = "idle";
	return Object.freeze({ state, reroutePending, verificationPending });
}

function textResult(input: {
	readonly text: string;
	readonly batch: PreflightedDeveloperRuntimeBatch | null;
	readonly reconstruction: DeveloperRuntimeBranchReconstruction;
}) {
	return {
		content: [{ type: "text" as const, text: boundedOutput(input.text) }],
		details: {
			protocol: "developer/v8-result",
			workScopeId: input.batch?.workScopeId ?? null,
			eventIds: input.batch?.envelopes.map((event) => event.eventId) ?? [],
			runtime: runtimeResultSummary(input.reconstruction),
			nextAction: activeOperations(input.reconstruction)[0] ?? null,
		},
	};
}

function runtimeProgress(input: {
	readonly reconstruction: DeveloperRuntimeBranchReconstruction;
	readonly language?: string;
	readonly workspaceBlockedReason?: string | null;
}): DeveloperProgressView {
	const language = input.language?.toLowerCase().startsWith("ko") ? "ko" : "en";
	const translated =
		language === "ko"
			? {
					decision: "판단 완료",
					landing: "변경 기록 완료",
					reroute: "후속 계획 완료",
					verification: "검증 완료",
					restart: "Pi를 다시 시작하세요",
					open: "현재 질문의 판단을 여세요",
					conclude: "현재 판단을 마무리하세요",
					authorize: "변경 권한을 확정하세요",
					edit: "허용된 변경을 적용하고 기록하세요",
					openReroute: "변경 후 후속 계획을 여세요",
					openVerification: "변경 결과 검증을 여세요",
					finish: "남은 작업이 없습니다",
				}
			: {
					decision: "Decision concluded",
					landing: "Change recorded",
					reroute: "Follow-up settled",
					verification: "Verification complete",
					restart: "Restart Pi",
					open: "Open a decision for the current question",
					conclude: "Conclude the current decision",
					authorize: "Authorize the bounded change",
					edit: "Apply and record the authorized change",
					openReroute: "Open the post-change follow-up",
					openVerification: "Open verification for the change",
					finish: "No remaining work",
				};
	if (
		input.reconstruction.blockedReason !== null ||
		input.workspaceBlockedReason
	) {
		return Object.freeze({
			phase: "blocked",
			language,
			completed: Object.freeze([]),
			next: translated.restart,
		});
	}
	const scope = input.reconstruction.activeScope;
	if (scope === null) {
		return Object.freeze({
			phase: "inactive",
			language,
			completed: Object.freeze([]),
			next: null,
		});
	}
	const completed: string[] = [];
	if (scope.state.frames.some((frame) => frame.conclusion !== null)) {
		completed.push(translated.decision);
	}
	if (scope.root.landings.length > 0) completed.push(translated.landing);
	if (
		scope.root.debts.length > 0 &&
		scope.root.debts.every((debt) => !debt.reroutePending)
	) {
		completed.push(translated.reroute);
	}
	if (
		scope.root.debts.length > 0 &&
		scope.root.debts.every((debt) => !debt.verificationPending)
	) {
		completed.push(translated.verification);
	}
	if (scope.root.activeAuthorization !== null) {
		return Object.freeze({
			phase: "editing",
			language,
			completed: Object.freeze(completed),
			next: translated.edit,
		});
	}
	const activeFrame = frameFor(scope);
	if (activeFrame !== null) {
		const debt = scope.root.debts.find(
			(candidate) =>
				candidate.rerouteFrameId === activeFrame.frame.frameId ||
				candidate.verificationFrameId === activeFrame.frame.frameId,
		);
		let phase: DeveloperProgressPhase = "deciding";
		if (debt?.verificationFrameId === activeFrame.frame.frameId) {
			phase = "verifying";
		} else if (debt?.rerouteFrameId === activeFrame.frame.frameId) {
			phase = "rerouting";
		}
		return Object.freeze({
			phase,
			language,
			completed: Object.freeze(completed),
			next: translated.conclude,
		});
	}
	if (scope.root.debts.some((debt) => debt.reroutePending)) {
		return Object.freeze({
			phase: "rerouting",
			language,
			completed: Object.freeze(completed),
			next: translated.openReroute,
		});
	}
	if (scope.root.debts.some((debt) => debt.verificationPending)) {
		return Object.freeze({
			phase: "verifying",
			language,
			completed: Object.freeze(completed),
			next: translated.openVerification,
		});
	}
	if (scope.root.landings.length > 0) {
		return Object.freeze({
			phase: "done",
			language,
			completed: Object.freeze(completed),
			next: null,
		});
	}
	if (latestConcludedFrame(scope) !== null) {
		return Object.freeze({
			phase: "ready-to-edit",
			language,
			completed: Object.freeze(completed),
			next: translated.authorize,
		});
	}
	return Object.freeze({
		phase: "deciding",
		language,
		completed: Object.freeze(completed),
		next: translated.open,
	});
}

function runtimeIdentity(input: {
	readonly prefix: string;
	readonly seed: unknown;
}): DeveloperId {
	return parseDeveloperId(
		`${input.prefix}:${canonicalValueSha256(input.seed).slice(0, 24)}`,
	);
}

function eventRef(event: AcceptedDeveloperEvent): CausalEventRef {
	return Object.freeze({
		workScopeId: event.envelope.workScopeId,
		eventId: event.envelope.eventId,
		eventSha256: event.envelope.eventSha256,
	});
}

function sortedText(values: readonly string[]): readonly string[] {
	const sorted = [...values];
	for (let index = 1; index < sorted.length; index += 1) {
		let cursor = index;
		while (cursor > 0) {
			const previous = sorted[cursor - 1];
			const current = sorted[cursor];
			if (
				previous === undefined ||
				current === undefined ||
				previous <= current
			) {
				break;
			}
			sorted[cursor - 1] = current;
			sorted[cursor] = previous;
			cursor -= 1;
		}
	}
	return Object.freeze(sorted);
}

function implementationBoundary(
	value: AuthorizeData["boundary"],
): RuntimeImplementationBoundary | null {
	if (value === undefined) return null;
	if (value.kind === "refinement-boundary") {
		return Object.freeze({
			kind: value.kind,
			rawRepresentation: value.raw_representation,
			refinedRepresentation: value.refined_representation,
			producer: value.producer,
			failure: value.failure,
			firstEffect: value.first_effect,
		});
	}
	return Object.freeze({
		kind: value.kind,
		assertion: value.assertion,
		establishedBy: value.established_by,
		limitation: value.limitation,
		containment: value.containment,
		verification: value.verification,
	});
}

function frameFor(scope: RuntimeReplayScope): RuntimeFrameState | null {
	const open = scope.state.frames.filter((frame) => frame.conclusion === null);
	if (open.length > 1) {
		fail("Developer v8 has more than one open adapter frame.");
	}
	return open[0] ?? null;
}

function latestConcludedFrame(
	scope: RuntimeReplayScope,
): RuntimeFrameState | null {
	const concluded = scope.state.frames.filter(
		(frame) => frame.conclusion !== null,
	);
	return concluded.at(-1) ?? null;
}

function ownerAssignment(input: {
	readonly scope: RuntimeReplayScope;
	readonly frameId: DeveloperId;
}): RuntimeAssignmentState | null {
	const assignments = input.scope.state.assignments.filter(
		(candidate) => candidate.assignment.parentFrameId === input.frameId,
	);
	if (assignments.length > 1) {
		fail("Developer v8 frame has more than one owning Skill assignment.");
	}
	return assignments[0] ?? null;
}

function skillCapabilityId(skill: Skill): DeveloperId {
	return parseDeveloperId(`skill:${skill.name}`);
}

function skillForCapability(input: {
	readonly availableSkills: ReadonlyMap<string, Skill>;
	readonly capabilityId: DeveloperId;
}): Skill {
	for (const skill of input.availableSkills.values()) {
		if (skillCapabilityId(skill) === input.capabilityId) return skill;
	}
	return fail(`Current owning Skill is unavailable: ${input.capabilityId}`);
}

function activeOperations(
	reconstruction: DeveloperRuntimeBranchReconstruction,
): readonly string[] {
	const scope = reconstruction.activeScope;
	if (scope === null || reconstruction.blockedReason !== null) return [];
	if (scope.root.activeAuthorization !== null) return [RECORD_LANDING_TOOL];
	if (frameFor(scope) !== null) {
		return [OPEN_CONTEXT_SOURCES_TOOL, CONCLUDE_JUDGMENT_TOOL];
	}
	const operations: string[] = [];
	const concluded = latestConcludedFrame(scope);
	const hasDebt = scope.root.debts.some(
		(debt) => debt.reroutePending || debt.verificationPending,
	);
	if (concluded !== null && !hasDebt) operations.push(AUTHORIZE_CHANGE_TOOL);
	operations.push(OPEN_JUDGMENT_TOOL);
	return operations;
}

function runtimeAccess(reconstruction: DeveloperRuntimeBranchReconstruction) {
	const scope = reconstruction.activeScope;
	return {
		allowsShell: scope?.root.activeAuthorization !== null,
		allowsArtifactTools: scope?.root.activeAuthorization !== null,
		hasBeforeImplementationGate:
			scope?.root.debts.some(
				(debt) => debt.reroutePending || debt.verificationPending,
			) ?? false,
	};
}

function runtimeStatus(
	reconstruction: DeveloperRuntimeBranchReconstruction,
): string {
	if (reconstruction.blockedReason) {
		return `developer v8 · blocked · ${reconstruction.blockedReason}`;
	}
	const scope = reconstruction.activeScope;
	if (scope === null) return `developer v8 · ${reconstruction.historyMode}`;
	if (scope.root.activeAuthorization) return "developer · ready to edit";
	const frame = frameFor(scope);
	if (frame) return `developer · deciding · ${frame.frame.routeDefinitionId}`;
	const pendingDebt = scope.root.debts.filter(
		(debt) => debt.reroutePending || debt.verificationPending,
	).length;
	return pendingDebt > 0
		? `developer · follow-up · ${pendingDebt} pending`
		: "developer · ready";
}

function protocolPrompt(input: {
	readonly reconstruction: DeveloperRuntimeBranchReconstruction;
	readonly skillNames: readonly string[];
	readonly evidenceHandles: readonly string[];
	readonly workspaceEntries: readonly string[];
}): string {
	return [
		"",
		"## Developer",
		`State: ${runtimeStatus(input.reconstruction)}.`,
		`Next legal operations: ${activeOperations(input.reconstruction).join(", ") || "none"}.`,
		`Required decision purpose: ${requiredDecisionPurpose(input.reconstruction)}.`,
		`Routes: ${DEVELOPER_RUNTIME_ROUTE_DEFINITIONS.map((route) => `${route.routeDefinitionId} (${route.sign})`).join(", ")}.`,
		`Owning Skills: ${input.skillNames.join(", ") || "none"}.`,
		`Workspace entries (orientation only, not admitted evidence): ${input.workspaceEntries.join(", ") || "unavailable"}.`,
		...(input.evidenceHandles.length > 0
			? [
					"Current successful evidence handles:",
					...input.evidenceHandles.map((handle) => `- ${handle}`),
				]
			: []),
		"Open only the current semantic decision. Do not put later implementation, landing, verification, or scope closure into the same frame.",
		"Use project files named by the workspace entries, repository metadata, or observed imports. The read tool requires a file path, never a directory. Do not probe guessed config paths.",
		"Do not inspect Developer package internals or session files to recover protocol state; use the current operation and evidence handles supplied here.",
		"An owning Skill method returned by developer_open_judgment is already loaded. Follow it without rereading or nominating it as inventory-source.",
		"Choose Route by question sense, not Skill name. Evidence must be admitted before discharge. Landing and verification remain separate.",
	].join("\n");
}

function currentLandingCause(input: {
	readonly reconstruction: DeveloperRuntimeBranchReconstruction;
	readonly frameId: DeveloperId;
}): CausalEventRef[] {
	const scope = input.reconstruction.activeScope;
	if (scope === null) return [];
	const debt = scope.root.debts.find(
		(candidate) =>
			(candidate.reroutePending &&
				candidate.rerouteFrameId === input.frameId) ||
			(candidate.verificationPending &&
				candidate.verificationFrameId === input.frameId),
	);
	return debt ? [debt.landingEventRef] : [];
}

type DeveloperDecisionPurpose = OpenRouteData["purpose"];

function requiredDecisionPurpose(
	reconstruction: DeveloperRuntimeBranchReconstruction,
): DeveloperDecisionPurpose {
	const scope = reconstruction.activeScope;
	if (scope?.root.debts.some((debt) => debt.reroutePending)) {
		return "reroute-decision";
	}
	if (scope?.root.debts.some((debt) => debt.verificationPending)) {
		return "verification-decision";
	}
	return "work-decision";
}

function selectedFrameIdentity(input: {
	readonly reconstruction: DeveloperRuntimeBranchReconstruction;
	readonly purpose: DeveloperDecisionPurpose;
	readonly seed: unknown;
}): DeveloperId {
	const scope = input.reconstruction.activeScope;
	if (scope === null) return fail("Developer v8 is disabled.");
	if (input.purpose === "reroute-decision") {
		const debt = scope.root.debts.find((candidate) => candidate.reroutePending);
		if (debt) return debt.rerouteFrameId;
	}
	if (input.purpose === "verification-decision") {
		const debt = scope.root.debts.find(
			(candidate) => candidate.verificationPending,
		);
		if (debt) return debt.verificationFrameId;
	}
	return runtimeIdentity({ prefix: "frame", seed: input.seed });
}

function branchEntries(
	ctx: RuntimeContext,
): readonly DeveloperRuntimeBranchEntry[] {
	return ctx.sessionManager.getBranch();
}

function branchInput(ctx: RuntimeContext): readonly PiBranchEntryInput[] {
	return ctx.sessionManager.getBranch();
}

function hasReloadSafeMarker(
	entries: readonly DeveloperRuntimeBranchEntry[],
): boolean {
	return entries.some((entry) => {
		if (
			entry.type !== "custom" ||
			entry.customType !== TOOL_POLICY_LIFECYCLE_ENTRY ||
			typeof entry.data !== "object" ||
			entry.data === null ||
			Array.isArray(entry.data)
		) {
			return false;
		}
		return (
			"protocol" in entry.data &&
			entry.data.protocol === DEVELOPER_RUNTIME_PROTOCOL &&
			"kind" in entry.data &&
			entry.data.kind === "tool-policy-lifecycle"
		);
	});
}

export default async function developerV8(pi: ExtensionAPI) {
	let availableSkills = new Map<string, Skill>();
	let inventorySnapshot: DeveloperInventorySnapshot | undefined;
	let workspaceEntries: readonly string[] = [];
	let reconstruction = reconstructDeveloperRuntimeBranch([]);
	let projectionCoordinator: ProjectionCoordinatorState =
		initialProjectionCoordinatorState(
			runtimeIdentity({
				prefix: "coordinator",
				seed: { createdAt: Date.now(), random: Math.random() },
			}),
		);
	let compactionLanguage: CompactionLanguageState =
		initialCompactionLanguageState();
	let toolPolicyMemory: ToolPolicyMemory = { withheldBuiltins: new Set() };
	let reloadBlocked = false;
	let workspaceBlockedReason: string | null = null;
	let workspaceObservation: RuntimeWorkspaceObservation | null = null;
	let commandSequence = 0;

	pi.registerFlag("developer", {
		description: "Start with Developer v8 enabled",
		type: "boolean",
		default: false,
	});

	const readReceipts: DeveloperReceiptTuiRead = () => ({
		state: projectionCoordinator,
		publication:
			projectionCoordinator.availability.kind === "current"
				? projectionCoordinator.availability.publication
				: null,
	});

	const currentProgress = () =>
		runtimeProgress({
			reconstruction,
			language: compactionLanguage.language,
			workspaceBlockedReason,
		});

	const publishProjection = () => {
		const started = beginProjectionRefresh({
			state: projectionCoordinator,
			requestedRevisionSha256: reconstruction.projectionRevisionSha256,
		});
		if (!started.ok) fail(started.error.message);
		if (reconstruction.blockedReason !== null) {
			const failed = failProjectionRefresh({
				state: started.state,
				ticket: started.value,
			});
			if (!failed.ok) fail(failed.error.message);
			projectionCoordinator = failed.state;
			return;
		}
		const completed = completeProjectionRefresh({
			state: started.state,
			ticket: started.value,
			projection: reconstruction.projection,
		});
		if (!completed.ok) fail(completed.error.message);
		projectionCoordinator = completed.state;
	};

	const syncProtocolTools = () => {
		const current = pi.getActiveTools();
		const runtimeBlocked =
			reconstruction.blockedReason !== null ||
			workspaceBlockedReason !== null ||
			reloadBlocked;
		const next = reconcileProtocolTools({
			activeTools: current,
			allTools: pi.getAllTools(),
			enabled: reconstruction.activeScope !== null,
			access: runtimeBlocked
				? {
						allowsShell: false,
						allowsArtifactTools: false,
						hasBeforeImplementationGate: true,
					}
				: runtimeAccess(reconstruction),
			protocolTools: DEVELOPER_PROTOCOL_TOOLS,
			activeProtocolTools: runtimeBlocked
				? []
				: activeOperations(reconstruction),
			memory: toolPolicyMemory,
		});
		toolPolicyMemory = next.memory;
		const same =
			current.length === next.activeTools.length &&
			current.every((name) => next.activeTools.includes(name));
		if (!same) pi.setActiveTools(next.activeTools);
	};

	const refreshUI = (ctx: RuntimeContext) => {
		if (reloadBlocked) {
			ctx.ui.setStatus("developer", "developer v8 · restart required");
			ctx.ui.setWidget("developer", undefined);
			return;
		}
		const progress = currentProgress();
		ctx.ui.setStatus("developer", developerProgressStatus(progress));
		const lines = developerProgressWidgetLines({ progress, maxLines: 3 });
		if (lines.length === 0) {
			ctx.ui.setWidget("developer", undefined);
			return;
		}
		ctx.ui.setWidget("developer", [...lines], { placement: "belowEditor" });
	};

	const reconstruct = (ctx: RuntimeContext) => {
		reconstruction = reconstructDeveloperRuntimeBranch(branchEntries(ctx));
		compactionLanguage = reconstructCompactionLanguage(
			ctx.sessionManager.getBranch(),
		);
		const scope = reconstruction.activeScope;
		if (scope === null) {
			workspaceObservation = null;
			workspaceBlockedReason = null;
		} else if (workspaceObservation?.workScopeId !== scope.workScopeId) {
			const baseline = captureRuntimeWorkspace(ctx);
			workspaceObservation = Object.freeze({
				workScopeId: scope.workScopeId,
				scopeBaseline: baseline,
				authorizationBaseline: null,
			});
			workspaceBlockedReason =
				scope.root.activeAuthorization === null
					? null
					: "An active authorization was resumed without its process-local workspace baseline.";
			if (baseline.kind === "git" && baseline.dirtyPaths.length > 0) {
				ctx.ui.notify(
					`Developer recorded ${baseline.dirtyPaths.length} pre-existing workspace change${baseline.dirtyPaths.length === 1 ? "" : "s"}.`,
					"warning",
				);
			} else if (baseline.kind === "unavailable") {
				ctx.ui.notify(
					"Developer workspace delta observation is unavailable; landing paths will remain declarative.",
					"warning",
				);
			}
		}
		publishProjection();
		syncProtocolTools();
		refreshUI(ctx);
	};

	const appendBatch = (input: {
		readonly ctx: RuntimeContext;
		readonly batch: PreflightedDeveloperRuntimeBatch;
	}) => {
		try {
			for (const envelope of input.batch.envelopes) {
				pi.appendEntry(DEVELOPER_RUNTIME_ENTRY, envelope);
			}
		} finally {
			reconstruct(input.ctx);
		}
		if (
			reconstruction.replay.acceptedCount !==
				input.batch.replay.acceptedCount ||
			reconstruction.projection.projectionSha256 !==
				input.batch.projection.projectionSha256
		) {
			fail("Developer v8 persisted branch differs from the preflighted batch.");
		}
	};

	const preparePlanBatch = (input: {
		readonly ctx: RuntimeContext;
		readonly seed: unknown;
		readonly events: readonly {
			readonly kind: DeveloperId;
			readonly payload: Readonly<Record<string, unknown>>;
			readonly causalRefs: readonly CausalEventRef[];
		}[];
	}): PreflightedDeveloperRuntimeBatch => {
		const drafts: DeveloperRuntimeEventDraftInput[] = [];
		for (const [index, event] of input.events.entries()) {
			drafts.push({
				eventId: runtimeIdentity({
					prefix: "event",
					seed: { seed: input.seed, index, kind: event.kind },
				}),
				kind: event.kind,
				payload: event.payload,
				causalRefs: event.causalRefs,
				occurredAt: new Date().toISOString(),
			});
		}
		return prepareDeveloperRuntimeBatch({ reconstruction, drafts });
	};

	const appendDrafts = (input: {
		readonly ctx: RuntimeContext;
		readonly seed: unknown;
		readonly drafts: readonly PlannedRuntimeDraft[];
	}): PreflightedDeveloperRuntimeBatch => {
		const drafts: DeveloperRuntimeEventDraftInput[] = [];
		for (const [index, draft] of input.drafts.entries()) {
			drafts.push({
				...draft,
				eventId:
					draft.eventId ??
					runtimeIdentity({
						prefix: "event",
						seed: { seed: input.seed, index, kind: draft.kind },
					}),
				occurredAt: new Date().toISOString(),
			});
		}
		const batch = prepareDeveloperRuntimeBatch({ reconstruction, drafts });
		appendBatch({ ctx: input.ctx, batch });
		return batch;
	};

	const activate = (ctx: RuntimeContext) => {
		if (reloadBlocked) return fail(TOOL_POLICY_RESTART_MESSAGE);
		if (reconstruction.blockedReason) return fail(reconstruction.blockedReason);
		if (reconstruction.activeScope !== null) return null;
		commandSequence += 1;
		const workScopeId = runtimeIdentity({
			prefix: "scope",
			seed: {
				sessionId: ctx.sessionManager.getSessionId(),
				leafId: ctx.sessionManager.getLeafId(),
				commandSequence,
			},
		});
		const batch = prepareDeveloperRuntimeBatch({
			reconstruction,
			workScopeId,
			drafts: [
				{
					eventId: runtimeIdentity({
						prefix: "event",
						seed: { workScopeId, kind: "work-scope-opened" },
					}),
					kind: parseDeveloperId("work-scope-opened"),
					payload: {},
					occurredAt: new Date().toISOString(),
				},
			],
		});
		appendBatch({ ctx, batch });
		return batch;
	};

	pi.registerTool({
		name: OPEN_JUDGMENT_TOOL,
		label: "Open Developer v8 RouteFrame",
		description:
			"Open one explicit Developer RouteFrame with canonical obligations and an optional owning Skill.",
		promptSnippet: "Open one explicit Developer v8 RouteFrame",
		promptGuidelines: [
			"Set purpose to the exact currently required work-decision, reroute-decision, or verification-decision shown by Developer.",
			"Choose route_definition_id from the current Developer route catalog; Skill name is independent.",
			"Use owner_skill only when current finite routing evidence supports that exact Skill.",
			"Keep this frame to one current semantic decision; later implementation, landing, reroute, verification, and closure belong to later runtime states.",
		],
		parameters: OpenRouteParams,
		renderCall(_args, theme) {
			return renderDeveloperCall(theme, "Open decision");
		},
		renderResult(result, options, theme, context) {
			return renderDeveloperResult({
				result,
				options,
				theme,
				context,
				success: "Decision opened",
			});
		},
		executionMode: "sequential",
		async execute(
			...args: [
				string,
				OpenRouteData,
				AbortSignal | undefined,
				unknown,
				ExtensionContext,
			]
		) {
			const [toolCallId, params, , , ctx] = args;
			const scope = reconstruction.activeScope;
			if (scope === null) fail("Developer is off. Run /developer on first.");
			if (scope.root.activeAuthorization !== null || frameFor(scope) !== null) {
				fail("Developer v8 already has active root work.");
			}
			const expectedPurpose = requiredDecisionPurpose(reconstruction);
			if (params.purpose !== expectedPurpose) {
				fail(
					`Current Developer decision purpose is ${expectedPurpose}; received ${params.purpose}.`,
				);
			}
			const route = developerRuntimeRouteDefinition(
				parseDeveloperId(params.route_definition_id),
			);
			const frameId = selectedFrameIdentity({
				reconstruction,
				purpose: params.purpose,
				seed: { toolCallId, question: params.question },
			});
			const obligations = [...params.obligations];
			for (let index = 1; index < obligations.length; index += 1) {
				let cursor = index;
				while (cursor > 0) {
					const previous = obligations[cursor - 1];
					const current = obligations[cursor];
					if (
						previous === undefined ||
						current === undefined ||
						previous.obligation_id <= current.obligation_id
					) {
						break;
					}
					obligations[cursor - 1] = current;
					obligations[cursor] = previous;
					cursor -= 1;
				}
			}
			let ownerMethod: string | null = null;
			let ownerContext: Awaited<ReturnType<typeof openSkillContext>> | null =
				null;
			let ownerPolicy: Awaited<ReturnType<typeof loadOptionalSkillPolicy>>;
			let ownerSkill: Skill | null = null;
			if (params.owner_skill) {
				ownerSkill = availableSkills.get(params.owner_skill.skill_name) ?? null;
				if (ownerSkill === null) {
					fail(
						`Owning Skill is not available: ${params.owner_skill.skill_name}`,
					);
				}
				[ownerMethod, ownerContext, ownerPolicy] = await Promise.all([
					renderDeveloperMethod(ownerSkill),
					openSkillContext(ownerSkill),
					loadOptionalSkillPolicy(ownerSkill),
				]);
			}
			const candidates: DeveloperRuntimeSkillCandidateInput[] = [];
			for (const skill of availableSkills.values()) {
				const capabilityId = skillCapabilityId(skill);
				const isOwner = ownerSkill?.name === skill.name;
				const revision = isOwner
					? parseSha256Digest(ownerContext?.methodContentSha256)
					: canonicalValueSha256({
							name: skill.name,
							description: skill.description,
							filePath: skill.filePath,
							sourceInfo: skill.sourceInfo,
						});
				candidates.push({
					skillCapabilityId: capabilityId,
					skillName: skill.name,
					skillLocation: skill.filePath,
					skillRevisionSha256: revision,
					sourceOperation: isOwner
						? OPEN_JUDGMENT_TOOL
						: OPEN_CONTEXT_SOURCES_TOOL,
					targetObligationIds: isOwner
						? (
								params.owner_skill?.target_obligation_ids ??
								obligations.map((obligation) => obligation.obligation_id)
							).map((value) => parseDeveloperId(value))
						: obligations.map((obligation) =>
								parseDeveloperId(obligation.obligation_id),
							),
				});
			}
			const checkpoint = createDeveloperRuntimeAdapterCheckpoint({
				workScopeId: scope.workScopeId,
				frameId,
				routeDefinitionId: route.routeDefinitionId,
				exactQuestion: params.question,
				obligations: obligations.map((obligation) => ({
					obligationId: parseDeveloperId(obligation.obligation_id),
					statement: obligation.statement,
				})),
				skillCandidates: candidates,
			});
			const frameCausalRefs = currentLandingCause({
				reconstruction,
				frameId,
			});
			let owner: Parameters<typeof createDeveloperRuntimeOpenPlan>[0]["owner"] =
				null;
			if (params.owner_skill) {
				const policy = ownerPolicy
					? {
							kind: "complete" as const,
							revisionSha256: parseSha256Digest(ownerPolicy.policySha256),
						}
					: { kind: "absent" as const };
				owner = {
					snapshotId: runtimeIdentity({
						prefix: "snapshot",
						seed: toolCallId,
					}),
					basisId: runtimeIdentity({ prefix: "basis", seed: toolCallId }),
					assignmentId: runtimeIdentity({
						prefix: "assignment",
						seed: toolCallId,
					}),
					invocationId: runtimeIdentity({
						prefix: "invocation",
						seed: toolCallId,
					}),
					policy,
					subquestion: params.owner_skill.subquestion,
					expectedContribution: params.owner_skill.expected_contribution,
					limitations: params.owner_skill.limitations ?? [],
				};
			}
			const plan = createDeveloperRuntimeOpenPlan({
				checkpoint,
				frameCausalRefs,
				owner,
			});
			const batch = preparePlanBatch({
				ctx,
				seed: toolCallId,
				events: plan.events,
			});
			appendBatch({ ctx, batch });
			const inventory = inventorySnapshot
				? describeInventory(
						ownerPolicy,
						ownerSkill?.baseDir ?? skillsRoot,
						inventorySnapshot,
					)
				: [];
			const optionalSkillSources = inventory.filter(
				(source) =>
					source.kind === "pi-skill" &&
					source.provenance.path !== ownerSkill?.filePath,
			);
			const preparedReferences = inventory.filter(
				(source) => source.kind === "prepared-reference",
			);
			return textResult({
				batch,
				reconstruction,
				text: [
					ownerMethod ??
						"No owning Skill was invoked. Developer retains this decision.",
					"",
					`Route opened: ${route.sign}.`,
					params.owner_skill
						? `Owner ready: ${params.owner_skill.skill_name}.`
						: "Owner: Developer.",
					"Optional Skill context (open only these IDs with developer_open_context_sources):",
					...(optionalSkillSources.length > 0
						? optionalSkillSources.map(
								(source) => `- ${source.id} · ${source.title}`,
							)
						: ["- none"]),
					"Prepared references (nominate by provenancePath in the conclusion; do not open them as Skills):",
					...(preparedReferences.length > 0
						? preparedReferences.map(
								(source) => `- ${source.path} · ${source.title}`,
							)
						: ["- none"]),
				].join("\n"),
			});
		},
	});

	pi.registerTool({
		name: OPEN_CONTEXT_SOURCES_TOOL,
		label: "Open Developer v8 Context Sources",
		description:
			"Acquire exact Pi-visible Skill methods as material support for the open RouteFrame.",
		promptSnippet:
			"Open an additional Skill method only when the current owner identifies a specific missing method",
		promptGuidelines: [
			"Do not reopen the owning Skill or prepared references. Normally conclude with current evidence instead of accumulating optional Skills.",
		],
		parameters: OpenContextParams,
		renderCall(_args, theme) {
			return renderDeveloperCall(theme, "Review context");
		},
		renderResult(result, options, theme, context) {
			return renderDeveloperResult({
				result,
				options,
				theme,
				context,
				success: "Context ready",
			});
		},
		executionMode: "sequential",
		async execute(
			...args: [
				string,
				OpenContextData,
				AbortSignal | undefined,
				unknown,
				ExtensionContext,
			]
		) {
			const [toolCallId, params, , , ctx] = args;
			const scope = reconstruction.activeScope;
			const frame = scope ? frameFor(scope) : null;
			if (scope === null || frame === null)
				fail("No Developer v8 frame is open.");
			if (!inventorySnapshot) fail("Developer v8 inventory is unavailable.");
			const existing = new Set<DeveloperId>();
			for (const support of scope.supportRecords) {
				if (support.sourceKind === "material") existing.add(support.sourceId);
			}
			const assignment = ownerAssignment({
				scope,
				frameId: frame.frame.frameId,
			});
			const owningSkill = assignment
				? skillForCapability({
						availableSkills,
						capabilityId: assignment.assignment.skillCapabilityId,
					})
				: null;
			const alreadyAvailable: string[] = [];
			const opened: Array<{
				readonly sourceId: DeveloperId;
				readonly descriptorSha256: Sha256Digest;
				readonly context: Awaited<ReturnType<typeof openSkillContext>>;
				readonly skill: Skill;
				readonly supportSha256: Sha256Digest;
			}> = [];
			for (const sourceId of params.inventory_source_ids) {
				const refinedSourceId = parseDeveloperId(sourceId);
				if (existing.has(refinedSourceId)) {
					alreadyAvailable.push(sourceId);
					continue;
				}
				const initial = resolveContextSkill(inventorySnapshot, sourceId);
				if (initial.skill.name === owningSkill?.name) {
					alreadyAvailable.push(sourceId);
					continue;
				}
				const context = await openSkillContext(initial.skill);
				const refined = resolveContextSkill(
					inventorySnapshot,
					sourceId,
					context.methodContentSha256,
				);
				const supportSha256 = canonicalValueSha256({
					descriptorSha256: refined.source.descriptorSha256,
					methodContentSha256: context.methodContentSha256,
					policySha256: context.policy?.policySha256 ?? null,
				});
				opened.push({
					sourceId: refinedSourceId,
					descriptorSha256: parseSha256Digest(refined.source.descriptorSha256),
					context,
					skill: refined.skill,
					supportSha256,
				});
			}
			if (opened.length === 0) {
				let duplicateSummary = "";
				if (alreadyAvailable.length > 0) {
					const noun = alreadyAvailable.length === 1 ? "request" : "requests";
					duplicateSummary = ` (${alreadyAvailable.length} duplicate ${noun} ignored.)`;
				}
				return textResult({
					batch: null,
					reconstruction,
					text: `Context is already available. No new Skill source was opened.${duplicateSummary}`,
				});
			}
			const drafts = opened.map((entry) => ({
				kind: parseDeveloperId("support-observed"),
				payload: {
					support: {
						supportId: runtimeIdentity({
							prefix: "support",
							seed: { toolCallId, sourceId: entry.sourceId },
						}),
						sourceKind: "material",
						sourceId: entry.sourceId,
						sourceRevisionSha256: parseSha256Digest(
							entry.context.methodContentSha256,
						),
						supportSha256: entry.supportSha256,
					},
				},
			}));
			const batch = appendDrafts({ ctx, seed: toolCallId, drafts });
			return textResult({
				batch,
				reconstruction,
				text: opened
					.flatMap((entry) => [
						`Context source: ${entry.skill.name}`,
						entry.context.method,
						"",
					])
					.join("\n"),
			});
		},
	});

	async function preparedContextSources(
		scope: RuntimeReplayScope,
	): Promise<readonly DeveloperPreparedContextSource[]> {
		if (!inventorySnapshot) fail("Developer v8 inventory is unavailable.");
		const prepared: DeveloperPreparedContextSource[] = [];
		for (const support of scope.supportRecords) {
			if (support.sourceKind !== "material") continue;
			const candidate = resolveContextSkill(
				inventorySnapshot,
				support.sourceId,
				support.sourceRevisionSha256,
			);
			const context = await openSkillContext(candidate.skill);
			const supportSha256 = canonicalValueSha256({
				descriptorSha256: candidate.source.descriptorSha256,
				methodContentSha256: context.methodContentSha256,
				policySha256: context.policy?.policySha256 ?? null,
			});
			if (
				context.methodContentSha256 !== support.sourceRevisionSha256 ||
				supportSha256 !== support.supportSha256
			) {
				fail(`Context source changed after opening: ${support.sourceId}.`);
			}
			prepared.push({
				source: {
					inventorySourceId: support.sourceId,
					descriptorSha256: candidate.source.descriptorSha256,
					toolCallId: support.supportId,
					skill: {
						name: candidate.skill.name,
						location: candidate.skill.filePath,
					},
					methodContentSha256: context.methodContentSha256,
					...(context.policy ? { policy: context.policy } : {}),
				},
				policyRoot: candidate.skill.baseDir,
				method: context.method,
			});
		}
		return Object.freeze(prepared);
	}

	pi.registerTool({
		name: CONCLUDE_JUDGMENT_TOOL,
		label: "Conclude Developer v8 RouteFrame",
		description:
			"Settle the optional owner, integrate the Judgment result, admit support, discharge obligations, and conclude the exact frame when resolved.",
		promptSnippet: "Conclude the active Developer v8 RouteFrame",
		parameters: ConcludeJudgmentParams,
		renderCall(_args, theme) {
			return renderDeveloperCall(theme, "Conclude decision");
		},
		renderResult(result, options, theme, context) {
			return renderDeveloperResult({
				result,
				options,
				theme,
				context,
				success: "Decision updated",
			});
		},
		executionMode: "sequential",
		async execute(
			...args: [
				string,
				ConcludeJudgmentData,
				AbortSignal | undefined,
				unknown,
				ExtensionContext,
			]
		) {
			const [toolCallId, rawParams, signal, , ctx] = args;
			try {
			const params = normalizeConcludeJudgmentData(rawParams);
			const scope = reconstruction.activeScope;
				const frame = scope ? frameFor(scope) : null;
				if (scope === null || frame === null)
					fail("No Developer v8 frame is open.");
				const assignmentState = ownerAssignment({
					scope,
					frameId: frame.frame.frameId,
				});
				const activeAssignment =
					assignmentState?.status === "active" ? assignmentState : null;
				let contextual: DeveloperContextConclusion | null = null;
				let directOutcome:
					| DeveloperContextConclusion["outcome"]
					| NonNullable<ConcludeJudgmentData["outcome"]>
					| null = null;
				let directCoverage: DeveloperCoverageProposal | null = null;
				let contextBasisSha256: Sha256Digest;
				if (params.disposition === "judgment") {
					const fields = requiredContextFields(params);
					const branch = branchInput(ctx);
					const coverage = bindUserAcceptedCoverage({
						coverage: fields.coverage,
						branch,
					});
					directOutcome = fields.outcome;
					directCoverage = coverage;
					if (assignmentState !== null) {
						if (!inventorySnapshot)
							fail("Developer v8 inventory is unavailable.");
						const skill = skillForCapability({
							availableSkills,
							capabilityId: assignmentState.assignment.skillCapabilityId,
						});
						const [methodContext, policy, contextSources] = await Promise.all([
							openSkillContext(skill),
							loadOptionalSkillPolicy(skill),
							preparedContextSources(scope),
						]);
						if (
							methodContext.methodContentSha256 !==
								assignmentState.assignment.skillRevisionSha256 ||
							(assignmentState.basis.policy.kind === "complete"
								? policy?.policySha256 !==
									assignmentState.basis.policy.revisionSha256
								: policy !== undefined)
						) {
							fail("Owning Skill method or policy changed during the frame.");
						}
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
						contextual = await concludeDeveloperContext({
							judgmentId: frame.frame.frameId,
							skill: { name: skill.name, location: skill.filePath },
							...(policy ? { policy } : {}),
							decisionUnitRoot: skill.baseDir,
							question: frame.frame.exactQuestion,
							knownEvidence: [],
							applicability: fields.applicability,
							contextSources,
							contextSourceAssessments: fields.contextSourceAssessments,
							nominations: resolveModelContextNominations({
								nominations: fields.nominations,
								branch,
							}),
							selectionBasis: fields.selectionBasis,
							coverageProposal: coverage,
							outcomeProposal: fields.outcome,
							snapshot,
							branchRef: frame.frame.frameId,
							branch,
							...(signal ? { signal } : {}),
						}).catch((error: unknown) =>
							fail(contextFailureWithBranchIdentities({ error, branch })),
						);
						contextBasisSha256 = parseSha256Digest(
							contextual.basis.contextBasisSha256,
						);
						directOutcome = contextual.outcome;
					} else {
						const contextSources = await preparedContextSources(scope);
						if (!inventorySnapshot) {
							fail("Developer v8 inventory is unavailable.");
						}
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
						contextual = await concludeDeveloperContext({
							judgmentId: frame.frame.frameId,
							skill: null,
							decisionUnitRoot: skillsRoot,
							question: frame.frame.exactQuestion,
							knownEvidence: [],
							applicability: fields.applicability,
							contextSources,
							contextSourceAssessments: fields.contextSourceAssessments,
							nominations: resolveModelContextNominations({
								nominations: fields.nominations,
								branch,
							}),
							selectionBasis: fields.selectionBasis,
							coverageProposal: coverage,
							outcomeProposal: fields.outcome,
							snapshot,
							branchRef: frame.frame.frameId,
							branch,
							...(signal ? { signal } : {}),
						}).catch((error: unknown) =>
							fail(contextFailureWithBranchIdentities({ error, branch })),
						);
						contextBasisSha256 = parseSha256Digest(
							contextual.basis.contextBasisSha256,
						);
						directOutcome = contextual.outcome;
					}
				} else {
					if (!params.not_applicable_reason || !params.not_applicable_basis) {
						fail("not-applicable requires reason and basis.");
					}
					contextBasisSha256 = canonicalValueSha256({
						domain: "developer/v8/not-applicable-judgment-basis",
						frame: frame.frame,
						reason: params.not_applicable_reason,
						basis: params.not_applicable_basis,
					});
				}
				const outcome = directOutcome;
				const resolved =
					params.disposition === "not-applicable" ||
					outcome?.kind === "contextual-judgment";
				const drafts: PlannedRuntimeDraft[] = [];
				let settlement: InvocationSettlement | null = null;
				let settlementEventId: DeveloperId | null = null;
				if (activeAssignment !== null) {
					let value: unknown;
					if (params.disposition === "not-applicable") {
						value = {
							kind: "not-applicable",
							targetObligationIds:
								activeAssignment.assignment.targetObligationIds,
							reason: params.not_applicable_reason,
						};
					} else if (outcome?.kind === "contextual-judgment") {
						value = {
							kind: "contribution",
							claim: outcome.artifact,
							applicability: outcome.rationale,
							targetUses: activeAssignment.assignment.targetObligationIds.map(
								(obligationId) => ({ obligationId, useAs: "evidence" }),
							),
							limitations:
								directCoverage?.limitations.map(
									(limitation) => limitation.description,
								) ?? [],
						};
					} else if (outcome?.kind === "needs-evidence") {
						value = {
							kind: "needs-context",
							targetObligationIds:
								activeAssignment.assignment.targetObligationIds,
							missingContext: outcome.evidenceNeeded,
						};
					} else if (outcome?.kind === "emergent-question") {
						value = {
							kind: "dependency",
							dependencyId: runtimeIdentity({
								prefix: "dependency",
								seed: { toolCallId, question: outcome.question },
							}),
							targetObligationIds:
								activeAssignment.assignment.targetObligationIds,
							question: outcome.question,
							reason: outcome.reason,
						};
					} else {
						value = {
							kind: "abort",
							reason: "Route outcome was not resolved.",
						};
					}
					settlement = parseInvocationSettlement({
						kind: "returned",
						invocationId: activeAssignment.invocationId,
						assignmentId: activeAssignment.assignment.assignmentId,
						value,
					});
					settlementEventId = runtimeIdentity({
						prefix: "event",
						seed: { toolCallId, kind: "invocation-settled" },
					});
					drafts.push({
						eventId: settlementEventId,
						kind: parseDeveloperId("invocation-settled"),
						payload: { settlement },
					});
				}
				if (resolved) {
					const sourceId = runtimeIdentity({
						prefix: "judgment",
						seed: frame.frame.frameId,
					});
					const supportSha256 = canonicalValueSha256({
						domain: "developer/v8/judgment-result-support",
						frame: frame.frame,
						contextBasisSha256,
						outcome:
							params.disposition === "not-applicable"
								? {
										reason: params.not_applicable_reason,
										basis: params.not_applicable_basis,
									}
								: outcome,
					});
					const supportEventId = runtimeIdentity({
						prefix: "event",
						seed: { toolCallId, kind: "support-observed" },
					});
					drafts.push({
						eventId: supportEventId,
						kind: parseDeveloperId("support-observed"),
						payload: {
							support: {
								supportId: runtimeIdentity({
									prefix: "support",
									seed: toolCallId,
								}),
								sourceKind: "judgment-result",
								sourceId,
								sourceRevisionSha256: contextBasisSha256,
								supportSha256,
							},
						},
					});
					for (const blockerId of sortedText(
						frame.blockers.map((blocker) => blocker.blockerId),
					)) {
						drafts.push({
							kind: parseDeveloperId("frame-blocker-resolved"),
							payload: {
								frameId: frame.frame.frameId,
								blockerId: parseDeveloperId(blockerId),
								resolutionBasisSha256: supportSha256,
							},
							causalEventIds: [supportEventId],
						});
					}
					const contributionIds: DeveloperId[] = [];
					const contributionTargets = new Map<
						DeveloperId,
						ReadonlySet<DeveloperId>
					>();
					if (
						settlement?.kind === "returned" &&
						settlement.value.kind === "contribution" &&
						settlementEventId !== null
					) {
						const skillSupportSha256 = skillReturnSupportSha256(settlement);
						const body = {
							proposalId: runtimeIdentity({
								prefix: "proposal",
								seed: { toolCallId, source: "skill" },
							}),
							frameId: frame.frame.frameId,
							frameRevision: frame.frame.frameRevision,
							source: {
								kind: "skill-return" as const,
								sourceId: settlement.invocationId,
								sourceRevisionSha256: skillSupportSha256,
							},
							claim: settlement.value.claim,
							applicability: settlement.value.applicability,
							targetUses: settlement.value.targetUses,
							limitations: settlement.value.limitations,
							supportSha256: skillSupportSha256,
						};
						const proposal = createProposedFrameContribution(body);
						const contributionId = runtimeIdentity({
							prefix: "contribution",
							seed: { toolCallId, source: "skill" },
						});
						contributionIds.push(contributionId);
						contributionTargets.set(
							contributionId,
							new Set(
								settlement.value.targetUses.map((target) => target.obligationId),
							),
						);
						drafts.push({
							kind: parseDeveloperId("frame-contribution-admitted"),
							payload: {
								proposal: body,
								expectedProposalSha256: proposal.proposalSha256,
								contributionId,
								admissionBasisSha256: contextBasisSha256,
							},
							causalEventIds: [settlementEventId],
						});
					}
					let judgmentClaim = "Resolved route judgment.";
					let judgmentApplicability = "Current frame.";
					let routeStopEvidence: readonly string[] = [
						"All obligations are discharged.",
					];
					if (params.disposition === "not-applicable") {
						judgmentClaim = params.not_applicable_reason ?? "Not applicable.";
						judgmentApplicability =
							"The negative judgment applies to the current frame.";
						routeStopEvidence = params.not_applicable_basis ?? [
							"Negative resolution is explicit.",
						];
					} else if (outcome?.kind === "contextual-judgment") {
						judgmentClaim = outcome.artifact;
						judgmentApplicability = outcome.rationale;
						routeStopEvidence = outcome.stopEvidence;
					}
					const judgmentBody = {
						proposalId: runtimeIdentity({
							prefix: "proposal",
							seed: { toolCallId, source: "judgment" },
						}),
						frameId: frame.frame.frameId,
						frameRevision: frame.frame.frameRevision,
						source: {
							kind: "judgment-result" as const,
							sourceId,
							sourceRevisionSha256: contextBasisSha256,
						},
						claim: judgmentClaim,
						applicability: judgmentApplicability,
						targetUses: frame.obligations.map((obligation) => ({
							obligationId: obligation.obligationId,
							useAs: "evidence" as const,
						})),
						limitations:
							directCoverage?.limitations.map(
								(limitation) => limitation.description,
							) ?? [],
						supportSha256,
					};
					const judgmentProposal =
						createProposedFrameContribution(judgmentBody);
					const judgmentContributionId = runtimeIdentity({
						prefix: "contribution",
						seed: { toolCallId, source: "judgment" },
					});
					contributionIds.push(judgmentContributionId);
					contributionTargets.set(
						judgmentContributionId,
						new Set(frame.obligations.map((obligation) => obligation.obligationId)),
					);
					drafts.push({
						kind: parseDeveloperId("frame-contribution-admitted"),
						payload: {
							proposal: judgmentBody,
							expectedProposalSha256: judgmentProposal.proposalSha256,
							contributionId: judgmentContributionId,
							admissionBasisSha256: contextBasisSha256,
						},
						causalEventIds: [supportEventId],
					});
					const dischargeIds: DeveloperId[] = [];
					for (const [index, obligation] of frame.obligations.entries()) {
						const targetedContributionIds = sortedText(
							contributionIds.filter((contributionId) =>
								contributionTargets
									.get(contributionId)
									?.has(obligation.obligationId),
							),
						).map((value) => parseDeveloperId(value));
						const dischargeId = runtimeIdentity({
							prefix: "discharge",
							seed: { toolCallId, obligationId: obligation.obligationId },
						});
						dischargeIds.push(dischargeId);
						drafts.push({
							kind: parseDeveloperId("obligation-discharged"),
							payload: {
								discharge: {
									dischargeId,
									frameId: frame.frame.frameId,
									expectedFrameRevision: frame.frame.frameRevision,
									obligationId: obligation.obligationId,
									contributionIds: targetedContributionIds,
									stopEvidence: routeStopEvidence,
									conclusion: `Resolved obligation ${index}.`,
								},
							},
						});
					}
					const proposal = parseFrameConclusionProposal({
						frameId: frame.frame.frameId,
						expectedFrameRevision: frame.frame.frameRevision,
						dischargeIds: sortedText(dischargeIds),
						stopEvidence: routeStopEvidence,
						expectedBlockerSetSha256: runtimeBlockerSetSha256([]),
						conclusion: judgmentClaim,
					});
					drafts.push({
						kind: parseDeveloperId("route-frame-concluded"),
						payload: { proposal },
						causalRefs: currentLandingCause({
							reconstruction,
							frameId: frame.frame.frameId,
						}),
					});
				}
				const batch = appendDrafts({ ctx, seed: toolCallId, drafts });
				return textResult({
					batch,
					reconstruction,
					text: resolved
						? "Decision concluded. The next legal operation is ready."
						: "Decision remains open because more evidence is required.",
				});
			} catch (error: unknown) {
				fail(developerErrorMessage(error));
			}
		},
	});

	pi.registerTool({
		name: AUTHORIZE_CHANGE_TOOL,
		label: "Authorize Developer v8 Change",
		description:
			"Create one replay-current mutation authorization from an exact concluded RouteFrame.",
		promptSnippet: "Authorize one v8 change from a concluded frame",
		parameters: AuthorizeParams,
		renderCall(_args, theme) {
			return renderDeveloperCall(theme, "Authorize change");
		},
		renderResult(result, options, theme, context) {
			return renderDeveloperResult({
				result,
				options,
				theme,
				context,
				success: "Change authorized",
			});
		},
		executionMode: "sequential",
		async execute(
			...args: [
				string,
				AuthorizeData,
				AbortSignal | undefined,
				unknown,
				ExtensionContext,
			]
		) {
			const [toolCallId, params, , , ctx] = args;
			const scope = reconstruction.activeScope;
			if (scope === null) fail("Developer v8 is disabled.");
			const frame = latestConcludedFrame(scope);
			if (frame?.conclusion === null || frame === null) {
				fail("Authorization requires a current concluded decision.");
			}
			const observation = workspaceObservation;
			if (observation?.workScopeId !== scope.workScopeId) {
				fail("Authorization requires a current workspace baseline.");
			}
			const authorizationBaseline = captureRuntimeWorkspace(ctx);
			const preAuthorizationDelta = compareWorkspaceSnapshots({
				baseline: observation.scopeBaseline,
				current: authorizationBaseline,
			});
			if (observation.scopeBaseline.kind === "git") {
				if (preAuthorizationDelta.kind !== "observed") {
					fail(
						preAuthorizationDelta.reason ??
							"Workspace identity changed before authorization.",
					);
				}
				if (preAuthorizationDelta.changedPaths.length > 0) {
					fail(
						`Workspace changed before authorization: ${preAuthorizationDelta.changedPaths.slice(0, 10).join(", ")}. Start a new Developer scope after settling those changes.`,
					);
				}
			}
			const authorization = createRuntimeChangeAuthorization({
				authorizationId: runtimeIdentity({
					prefix: "change",
					seed: toolCallId,
				}),
				frameId: frame.frame.frameId,
				frameRevision: frame.frame.frameRevision,
				conclusionSha256: frame.conclusion.conclusionSha256,
				movement: params.movement,
				stableLanding: params.stable_landing,
				verificationTarget: params.verification_target,
				boundary: implementationBoundary(params.boundary),
			});
			const conclusionEvent = reconstruction.replay.acceptedEvents.find(
				(event) =>
					event.semanticEvent.kind === "route-frame-concluded" &&
					event.semanticEvent.proposal.frameId === frame.frame.frameId &&
					canonicalValueSha256({
						domain: "developer/v8/route-frame-conclusion",
						proposal: event.semanticEvent.proposal,
					}) === authorization.conclusionSha256,
			);
			if (!conclusionEvent)
				fail("Authorization conclusion event is unavailable.");
			const batch = appendDrafts({
				ctx,
				seed: toolCallId,
				drafts: [
					{
						kind: parseDeveloperId("change-authorized"),
						payload: { authorization },
						causalRefs: [eventRef(conclusionEvent)],
					},
				],
			});
			workspaceObservation = Object.freeze({
				workScopeId: scope.workScopeId,
				scopeBaseline: observation.scopeBaseline,
				authorizationBaseline,
			});
			return textResult({
				batch,
				reconstruction,
				text: "Change authorized. Built-in mutation tools are available for this bounded landing.",
			});
		},
	});

	pi.registerTool({
		name: RECORD_LANDING_TOOL,
		label: "Record Developer v8 Landing",
		description:
			"Record the exact active authorization landing and create causal reroute and verification debt.",
		promptSnippet: "Record the authorized v8 landing",
		parameters: RecordLandingParams,
		renderCall(_args, theme) {
			return renderDeveloperCall(theme, "Record change");
		},
		renderResult(result, options, theme, context) {
			return renderDeveloperResult({
				result,
				options,
				theme,
				context,
				success: "Change recorded",
			});
		},
		executionMode: "sequential",
		async execute(
			...args: [
				string,
				RecordLandingData,
				AbortSignal | undefined,
				unknown,
				ExtensionContext,
			]
		) {
			const [toolCallId, params, , , ctx] = args;
			const scope = reconstruction.activeScope;
			const active = scope?.root.activeAuthorization;
			if (!scope || !active) fail("No Developer v8 authorization is active.");
			const observation = workspaceObservation;
			if (
				observation?.workScopeId !== scope.workScopeId ||
				observation.authorizationBaseline === null
			) {
				fail(
					"Landing requires the workspace baseline captured at authorization.",
				);
			}
			const currentWorkspace = captureRuntimeWorkspace(ctx);
			const workspaceDelta = compareWorkspaceSnapshots({
				baseline: observation.authorizationBaseline,
				current: currentWorkspace,
			});
			let changedPaths: readonly string[];
			let pathsWereObserved = false;
			if (observation.authorizationBaseline.kind === "git") {
				if (workspaceDelta.kind !== "observed") {
					fail(
						workspaceDelta.reason ??
							"Workspace identity changed before landing.",
					);
				}
				if (workspaceDelta.changedPaths.length === 0) {
					fail("Landing requires at least one observed workspace change.");
				}
				changedPaths = workspaceDelta.changedPaths;
				pathsWereObserved = true;
				if (params.changed_paths !== undefined) {
					const declaredPaths = sortedText(params.changed_paths);
					if (!samePaths({ left: declaredPaths, right: changedPaths })) {
						fail(
							`Landing paths do not match the observed workspace delta. Observed: ${changedPaths.join(", ")}.`,
						);
					}
				}
			} else {
				if (params.changed_paths === undefined) {
					fail(
						"changed_paths is required when workspace observation is unavailable.",
					);
				}
				changedPaths = sortedText(params.changed_paths);
			}
			const landing = createRuntimeImplementationLanding({
				landingId: runtimeIdentity({ prefix: "landing", seed: toolCallId }),
				authorizationId: active.authorizationId,
				changedPaths,
				result: params.result,
				verification: sortedText(params.verification ?? []),
				rerouteFrameId: runtimeIdentity({
					prefix: "frame",
					seed: { toolCallId, debt: "reroute" },
				}),
				verificationFrameId: runtimeIdentity({
					prefix: "frame",
					seed: { toolCallId, debt: "verification" },
				}),
			});
			const authorizationEvent = reconstruction.replay.acceptedEvents.find(
				(event) =>
					event.semanticEvent.kind === "change-authorized" &&
					event.semanticEvent.authorization.authorizationId ===
						active.authorizationId,
			);
			if (!authorizationEvent) fail("Authorization event is unavailable.");
			const batch = appendDrafts({
				ctx,
				seed: toolCallId,
				drafts: [
					{
						kind: parseDeveloperId("implementation-landing-recorded"),
						payload: { landing },
						causalRefs: [eventRef(authorizationEvent)],
					},
				],
			});
			workspaceObservation = Object.freeze({
				workScopeId: scope.workScopeId,
				scopeBaseline: currentWorkspace,
				authorizationBaseline: null,
			});
			return textResult({
				batch,
				reconstruction,
				text: `Change recorded for ${landing.changedPaths.length} ${pathsWereObserved ? "observed " : "declared "}path${landing.changedPaths.length === 1 ? "" : "s"}. Reroute and verification are now pending.`,
			});
		},
	});

	pi.registerCommand("developer", {
		description: "Inspect or control the Developer v8 root runtime",
		getArgumentCompletions: completeDeveloperArgs,
		async handler(...args: [string, ExtensionCommandContext]) {
			const [rawArgs, ctx] = args;
			const parsed = parseDeveloperCommand(rawArgs);
			if (!parsed.ok) {
				ctx.ui.notify(
					"Usage: /developer [status | questions | settings | on | off]",
					"warning",
				);
				return;
			}
			const action = parsed.command.kind;
			if (action === "on") {
				const batch = activate(ctx);
				if (batch) ctx.ui.notify("Developer v8: on", "info");
				return;
			}
			if (action === "off") {
				const scope = reconstruction.activeScope;
				if (scope === null) return;
				if (scope.root.activeAuthorization !== null) {
					ctx.ui.notify(
						"Record or abandon the active authorization before disabling Developer.",
						"error",
					);
					return;
				}
				const drafts: PlannedRuntimeDraft[] = [];
				if (scope.state.activeInvocation !== null) {
					const assignment = scope.state.assignments.find(
						(candidate) =>
							candidate.assignment.assignmentId ===
							scope.state.activeInvocation?.assignmentId,
					);
					if (!assignment) fail("Active invocation assignment is unavailable.");
					drafts.push({
						kind: parseDeveloperId("invocation-settled"),
						payload: {
							settlement: parseInvocationSettlement({
								kind: "lifecycle",
								invocationId: scope.state.activeInvocation.invocationId,
								assignmentId: assignment.assignment.assignmentId,
								lifecycle: {
									kind: "cancelled",
									reason: "Developer was disabled.",
									executionUncertain: true,
								},
							}),
						},
					});
				}
				drafts.push({
					kind: parseDeveloperId("work-scope-closed"),
					payload: {
						closure: createRuntimeScopeClosure({
							reason: "User disabled Developer.",
						}),
					},
				});
				appendDrafts({
					ctx,
					seed: { command: "off", commandSequence: ++commandSequence },
					drafts,
				});
				ctx.ui.notify("Developer v8: off", "info");
				return;
			}
			if (action === "workbench" && ctx.mode === "tui") {
				await showDeveloperReceiptTui({
					ctx,
					readCurrent: readReceipts,
					readProgress: currentProgress,
				});
				return;
			}
			ctx.ui.notify(developerProgressMessage(currentProgress()), "info");
		},
	});

	pi.on("input", (event) => {
		if (reconstruction.activeScope === null) return;
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
		if (reconstruction.activeScope === null || !compactionLanguage.language)
			return;
		const pending = continuityPending(
			event.compactionEntry.id,
			compactionLanguage.language,
		);
		const next = applyCompactionLanguageEvent(compactionLanguage, pending);
		if (next === compactionLanguage) return;
		pi.appendEntry(COMPACTION_LANGUAGE_ENTRY, pending);
		compactionLanguage = next;
	});
	pi.on("context", (...args) => {
		const [event, ctx] = args;
		if (reconstruction.activeScope === null) return;
		const projection = projectCompactionContinuity(
			event.messages,
			compactionLanguage,
		);
		if (projection) compactionLanguage = projection.state;
		const evidenceHandles = activeDeveloperEvidenceHandles(branchInput(ctx));
		const messages = projection?.messages ?? event.messages;
		return {
			messages: [
				...messages,
				{
					role: "custom" as const,
					customType: "developer.model-control",
					content: [
						{
							type: "text" as const,
							text: [
								`Current Developer state: ${runtimeStatus(reconstruction)}.`,
								`Required decision purpose: ${requiredDecisionPurpose(reconstruction)}.`,
								`Next legal operations: ${activeOperations(reconstruction).join(", ") || "none"}.`,
								...(evidenceHandles.length > 0
									? [
											"Current exact successful evidence handles:",
											...evidenceHandles.map((handle) => `- ${handle}`),
											"Use these exact handles for tool-result nominations. Never make a failing probe to discover handles.",
										]
									: []),
							].join("\n"),
						},
					],
					display: false,
				},
			] as typeof event.messages,
		};
	});
	pi.on("before_agent_start", (...args) => {
		const [event, ctx] = args;
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
		try {
			workspaceEntries = Object.freeze(
				sortedText(
					readdirSync(ctx.cwd, { withFileTypes: true })
						.map((entry) => `${entry.name}${entry.isDirectory() ? "/" : ""}`)
						.filter((entry) => entry !== ".git/" && entry !== ".pi/"),
				).slice(0, 50),
			);
		} catch {
			workspaceEntries = [];
		}
		if (reconstruction.activeScope === null || reloadBlocked) return;
		return {
			systemPrompt:
				event.systemPrompt +
				protocolPrompt({
					reconstruction,
					skillNames: [...availableSkills.keys()],
					evidenceHandles: activeDeveloperEvidenceHandles(branchInput(ctx)),
					workspaceEntries,
				}),
		};
	});
	pi.on("tool_call", (event) => {
		const capability = builtinControlledToolCapabilities(pi.getAllTools()).get(
			event.toolName,
		);
		if (!capability) return;
		const enabled = reconstruction.activeScope !== null;
		const runtimeBlocked =
			reconstruction.blockedReason !== null ||
			workspaceBlockedReason !== null ||
			reloadBlocked;
		const access = runtimeBlocked
			? {
					allowsShell: false,
					allowsArtifactTools: false,
					hasBeforeImplementationGate: true,
				}
			: runtimeAccess(reconstruction);
		if (isControlledToolAllowed({ enabled, capability, access })) return;
		return {
			block: true,
			reason:
				capability === "shell"
					? "Developer requires a replay-current change authorization before built-in bash is available."
					: `Developer v8 requires a replay-current ${AUTHORIZE_CHANGE_TOOL} event before built-in mutation.`,
		};
	});
	pi.on("session_start", (...args) => {
		const [event, ctx] = args;
		const branch = ctx.sessionManager.getBranch();
		reloadBlocked =
			event.reason === "reload" &&
			(!hasReloadSafeMarker(branch) ||
				toolPolicyReloadRequiresRestart({
					entries: branch,
					protocol: DEVELOPER_RUNTIME_PROTOCOL,
					protocolTools: DEVELOPER_PROTOCOL_TOOLS,
				}));
		reconstruct(ctx);
		if (reloadBlocked) {
			ctx.ui.notify(TOOL_POLICY_RESTART_MESSAGE, "error");
			return;
		}
		const proposals = proposeReloadReconciliation(reconstruction.replay).filter(
			(proposal) =>
				proposal.workScopeId === reconstruction.activeScope?.workScopeId,
		);
		if (proposals.length > 0) {
			const drafts = proposals.map((proposal) => ({
				kind: parseDeveloperId(proposal.kind),
				payload: { settlement: proposal.settlement },
				causalRefs: proposal.causalRefs,
			}));
			appendDrafts({ ctx, seed: { reason: "reload", proposals }, drafts });
		}
		if (
			pi.getFlag("developer") === true &&
			reconstruction.activeScope === null
		) {
			activate(ctx);
		}
	});
	pi.on("session_tree", (...args) => {
		const [, ctx] = args;
		reconstruct(ctx);
	});
	pi.on("agent_settled", (...args) => {
		const [, ctx] = args;
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
	pi.on("session_shutdown", (...args) => {
		const [, ctx] = args;
		const current = pi.getActiveTools();
		const next = reconcileProtocolTools({
			activeTools: current,
			allTools: pi.getAllTools(),
			enabled: false,
			access: runtimeAccess(reconstruction),
			protocolTools: DEVELOPER_PROTOCOL_TOOLS,
			memory: toolPolicyMemory,
		});
		toolPolicyMemory = next.memory;
		pi.setActiveTools(next.activeTools);
		if (!reloadBlocked) {
			pi.appendEntry(
				TOOL_POLICY_LIFECYCLE_ENTRY,
				reloadSafeToolPolicyMarker(DEVELOPER_RUNTIME_PROTOCOL),
			);
		}
		ctx.ui.setStatus("developer", undefined);
		ctx.ui.setWidget("developer", undefined);
	});
}
