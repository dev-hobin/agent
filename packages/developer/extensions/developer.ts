import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { StringEnum } from "@earendil-works/pi-ai";
import {
	DEFAULT_MAX_BYTES,
	DEFAULT_MAX_LINES,
	getMarkdownTheme,
	keyHint,
	type ExtensionAPI,
	type ExtensionCommandContext,
	type ExtensionContext,
	type Skill,
	type Theme,
	type ThemeColor,
} from "@earendil-works/pi-coding-agent";
import { Container, Markdown, Text } from "@earendil-works/pi-tui";
import { Type, type Static } from "typebox";

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
	availablePackageSkills,
	isWithinRoot,
	loadSkillReference,
	loadSkillReferencePolicy,
	renderSkillMethod,
	skillReferencePaths,
} from "./skills.ts";
import {
	ACTIVATION_ENTRY,
	FOCUS_ENTRY,
	JUDGMENT_TOOL,
	MAX_RESPONSE_FIELDS,
	MAX_RESPONSE_IDENTIFIER_CHARS,
	MAX_RESPONSE_OPTIONS,
	MAX_RESPONSE_TEXT_CHARS,
	PROTOCOL,
	REFERENCE_TOOL,
	ROUTE_TOOL,
	applyDeveloperEvent,
	canApplyDeveloperEvent,
	developerSnapshot,
	formatInvariantHandling,
	initialState,
	normalizeDeveloperEvent,
	parseChoiceResponseSpec,
	protocolState,
	reconstructState,
	type ActivationEvent,
	type ChoiceResponseSpec,
	type DeveloperState,
	type ImplementationProfile,
	type InvariantHandling,
	type FocusEvent,
	type JudgmentEvent,
	type PendingQuestion,
	type PendingQuestionStatus,
	type QuestionGate,
	type QuestionResolutionOwner,
	type QuestionUpdate,
	type QuestionUpdateStatus,
	type ReferenceBasis,
	type ReferenceExemption,
	type ReferenceLoadEvent,
	type ReferencePolicyExemption,
	type ReferencePolicyRoute,
	type RouteAlternative,
	type RouteEvent,
} from "./state.ts";
import {
	TOOL_POLICY_LIFECYCLE_ENTRY,
	builtinControlledToolCapabilities,
	isControlledToolAllowed,
	reconcileProtocolTools,
	reloadSafeToolPolicyMarker,
	toolPolicyReloadRequiresRestart,
	type ProtocolToolAccess,
	type ToolPolicyMemory,
} from "./tool-policy.ts";
import {
	DeveloperWidget,
	developerHistoryEntries,
	editQuestionResolutionRequest,
	promptImmediateUserQuestion,
	renderDeveloperFooter,
	showDeveloperHistoryDetail,
	showDeveloperHistorySelector,
	showDeveloperSettings,
	showDeveloperStatus,
	showPendingQuestionSelector,
	type ImmediateQuestionDisposition,
} from "./tui.ts";

const PROTOCOL_TOOLS = [ROUTE_TOOL, REFERENCE_TOOL, JUDGMENT_TOOL] as const;
const extensionRoot = dirname(fileURLToPath(import.meta.url));
const skillsRoot = resolve(extensionRoot, "..", "skills");
const structuralChangeMethodPath = resolve(
	extensionRoot,
	"references",
	"behavior-preserving-structural-change.md",
);
const MAX_PENDING_QUESTIONS = 20;
const MAX_QUESTION_CHARS = 2_000;
const MAX_QUESTION_CONTEXT_CHARS = 8_000;
const MAX_EVIDENCE_CHARS = 2_000;
const MAX_RESULT_CHARS = 12_000;
const MAX_ARTIFACT_CHARS = 4_096;
const DEVELOPER_COMMAND_ACTIONS = ["on", "status", "questions", "off"] as const;
const TOOL_POLICY_RESTART_MESSAGE =
	"Developer detected an in-process package reload from a version without reload-safe tool handoff. Restart the Pi process before enabling Developer; /reload and /develop off/on cannot safely reconstruct the prior built-in tool selection.";

function textResult<T>(text: string, details: T) {
	return {
		content: [{ type: "text" as const, text }],
		details,
	};
}

function resultText(result: {
	content: Array<{ type: string; text?: string }>;
}): string {
	return result.content
		.filter((item) => item.type === "text" && item.text)
		.map((item) => item.text)
		.join("\n");
}

function reusableText(content: string, lastComponent: unknown): Text {
	const component =
		lastComponent instanceof Text ? lastComponent : new Text("", 0, 0);
	component.setText(content);
	return component;
}

function ensureSafeToolText(text: string, label: string): void {
	const bytes = Buffer.byteLength(text, "utf8");
	const lines = text.split(/\r?\n/).length;
	if (bytes > DEFAULT_MAX_BYTES || lines > DEFAULT_MAX_LINES) {
		fail(
			`${label} exceeds Pi's tool-output limit (${bytes} bytes, ${lines} lines). Narrow the routed question or evidence.`,
		);
	}
}

function fail(message: string): never {
	throw new Error(message);
}

function sameToolSet(left: string[], right: string[]): boolean {
	if (left.length !== right.length) return false;
	const rightSet = new Set(right);
	return left.every((tool) => rightSet.has(tool));
}

function compactLine(value: string, maxChars = 160): string {
	const line = value.replace(/\s+/g, " ").trim();
	return line.length <= maxChars ? line : `${line.slice(0, maxChars - 1)}…`;
}

function referenceRouteSummary(route: ReferencePolicyRoute): string {
	return `${route.id}: question=${route.question} | trigger=${route.trigger} | refines=${route.methodStep} | references=${route.references.join(" + ")} (read order: ${route.readOrder}) | produces=${route.artifacts.join("; ")} | stop=${route.stop} | separate when=${route.separateWhen}`;
}

function referencePolicyLines(
	routes: ReferencePolicyRoute[],
	exemption: ReferencePolicyExemption | undefined,
): string[] {
	if (routes.length === 0) return [];
	return [
		"Reference routes (each route extends one named judgment step and answers one narrower question; its references are one co-required set, while read order is declared separately):",
		...routes.map((route) => `- ${referenceRouteSummary(route)}`),
		...(exemption
			? [
					`Reference exemption applies only when: ${exemption.when}`,
					`Exemption evidence: ${exemption.evidence.join(" | ")}`,
				]
			: []),
	];
}

function normalizedQuestion(value: string): string {
	return value
		.toLocaleLowerCase()
		.replace(/[^\p{L}\p{N}]+/gu, " ")
		.trim();
}

interface ChoiceResponseOptionInput {
	value: string;
	label: string;
	description?: string;
	detail_prompt?: string;
}

interface ChoiceResponseFieldInput {
	id: string;
	prompt: string;
	description?: string;
	options: ChoiceResponseOptionInput[];
}

interface ChoiceResponseSpecInput {
	kind: "choice-form";
	fields: ChoiceResponseFieldInput[];
}

type InvariantHandlingInput =
	| {
			kind: "not-applicable";
			reason: string;
	  }
	| {
			kind: "evidence-preserving-boundary";
			raw_representation: string;
			refined_representation: string;
			producer: string;
			failure: string;
			first_effect: string;
	  }
	| {
			kind: "trusted-compiler-gap";
			assertion: string;
			established_by: string;
			limitation: string;
			containment: string;
			verification: string;
	  };

function invariantHandlingFromInput(
	input: InvariantHandlingInput | undefined,
): InvariantHandling {
	if (!input) {
		return {
			kind: "not-applicable",
			reason:
				"Legacy direct tool execution omitted the now-required invariant-handling declaration.",
		};
	}
	if (input.kind === "not-applicable") return input;
	if (input.kind === "evidence-preserving-boundary") {
		return {
			kind: input.kind,
			rawRepresentation: input.raw_representation,
			refinedRepresentation: input.refined_representation,
			producer: input.producer,
			failure: input.failure,
			firstEffect: input.first_effect,
		};
	}
	return {
		kind: input.kind,
		assertion: input.assertion,
		establishedBy: input.established_by,
		limitation: input.limitation,
		containment: input.containment,
		verification: input.verification,
	};
}

interface OpenQuestionInput {
	question: string;
	context?: string;
	response_spec?: ChoiceResponseSpecInput;
	status: PendingQuestionStatus;
	resolution_owner: Exclude<QuestionResolutionOwner, "unknown">;
	gate: QuestionGate;
	resolution_criteria: string;
}

interface QuestionUpdateInput {
	question_id: string;
	status: QuestionUpdateStatus;
	result: string;
	basis: string[];
}

function legacyOpenQuestion(
	question: string,
	judgmentStatus?: string,
): OpenQuestionInput {
	if (judgmentStatus === "blocked") {
		return {
			question,
			status: "blocked",
			resolution_owner: "environment",
			gate: "before-completion",
			resolution_criteria: `Obtain evidence that settles: ${question}`,
		};
	}
	return {
		question,
		status: "open",
		resolution_owner: "agent",
		gate: "none",
		resolution_criteria: `Obtain evidence that settles: ${question}`,
	};
}

function buildChoiceResponseSpec(
	input: ChoiceResponseSpecInput | undefined,
	owner: OpenQuestionInput["resolution_owner"],
): ChoiceResponseSpec | undefined {
	if (!input) return undefined;
	if (owner !== "user") {
		fail("response_spec is valid only for user-owned questions.");
	}
	const responseSpec = parseChoiceResponseSpec({
		kind: input.kind,
		fields: input.fields.map((field) => ({
			id: field.id,
			prompt: field.prompt,
			description: field.description,
			options: field.options.map((option) => ({
				value: option.value,
				label: option.label,
				description: option.description,
				detailPrompt: option.detail_prompt,
			})),
		})),
	});
	if (!responseSpec) {
		fail(
			"response_spec must use unique field IDs and unique option values with non-whitespace text.",
		);
	}
	return responseSpec;
}

function buildOpenedQuestions(
	input: OpenQuestionInput[],
	state: DeveloperState,
	routeId: string,
): PendingQuestion[] {
	const questionIds = new Map(
		state.pendingQuestions.map((question) => [
			normalizedQuestion(question.question),
			question.id,
		]),
	);
	const openedQuestions: PendingQuestion[] = [];
	for (const [index, item] of input.entries()) {
		const question = item.question.trim();
		const context = item.context?.trim() || undefined;
		const responseSpec = buildChoiceResponseSpec(
			item.response_spec,
			item.resolution_owner,
		);
		const resolutionCriteria = item.resolution_criteria.trim();
		if (!question || !resolutionCriteria) {
			fail(
				"Each open question requires non-whitespace question and resolution_criteria text.",
			);
		}
		if (item.resolution_owner === "user" && item.gate !== "none" && !context) {
			fail(
				"User-owned questions with a before-implementation or before-completion gate require non-whitespace context that explains the decision before asking for an answer.",
			);
		}
		const questionKey = normalizedQuestion(question);
		const questionId =
			questionIds.get(questionKey) ?? `question:${routeId}:open:${index + 1}`;
		questionIds.set(questionKey, questionId);
		const pendingQuestion: PendingQuestion = {
			id: questionId,
			question,
			context,
			responseSpec,
			status: item.status,
			resolutionOwner: item.resolution_owner,
			gate: item.gate,
			resolutionCriteria,
			sourceRouteId: routeId,
		};
		const duplicateIndex = openedQuestions.findIndex(
			(candidate) => candidate.id === questionId,
		);
		if (duplicateIndex === -1) openedQuestions.push(pendingQuestion);
		else openedQuestions[duplicateIndex] = pendingQuestion;
	}
	return openedQuestions;
}

function firstImmediateUserQuestion(
	previous: readonly PendingQuestion[],
	opened: readonly PendingQuestion[],
): PendingQuestion | undefined {
	const previousIds = new Set(previous.map((question) => question.id));
	return opened.find(
		(question) =>
			!previousIds.has(question.id) &&
			question.status === "open" &&
			question.resolutionOwner === "user" &&
			question.gate === "before-implementation",
	);
}

function immediateQuestionMessage(
	question: PendingQuestion | undefined,
	disposition: ImmediateQuestionDisposition | undefined,
): string {
	if (!question) return "";
	if (disposition?.kind === "answer") {
		return [
			"",
			`Immediate user answer for ${question.id}:`,
			disposition.request,
			"",
			`Route this exact question with open_question_id=${question.id}, use the answer as new evidence, and close it only through question_updates.`,
		].join("\n");
	}
	return `\nThe user left ${question.id} open for later.`;
}

function buildQuestionUpdates(
	input: QuestionUpdateInput[],
	state: DeveloperState,
): QuestionUpdate[] {
	const questionUpdates = input.map((update) => ({
		questionId: update.question_id.trim(),
		status: update.status,
		result: update.result.trim(),
		basis: update.basis.map((item) => item.trim()).filter(Boolean),
	}));
	const knownQuestionIds = new Set(
		state.pendingQuestions.map((question) => question.id),
	);
	const updatedIds = new Set<string>();
	for (const update of questionUpdates) {
		if (!knownQuestionIds.has(update.questionId))
			fail(`Unknown pending question ID: ${update.questionId}`);
		if (updatedIds.has(update.questionId))
			fail(`Question ${update.questionId} was updated more than once.`);
		updatedIds.add(update.questionId);
		if (!update.result)
			fail(`Question update ${update.questionId} requires a non-empty result.`);
		if (
			(update.status === "resolved" ||
				update.status === "not-applicable" ||
				update.status === "blocked") &&
			update.basis.length === 0
		) {
			fail(
				`Question update ${update.questionId} with status ${update.status} requires concrete basis.`,
			);
		}
	}
	return questionUpdates;
}

function judgmentNextMessage(
	event: JudgmentEvent,
	nextState: DeveloperState,
): string {
	if (event.target === "implementation") {
		if (nextState.verificationRequired) {
			return "Stable landing recorded. Route again from the new evidence; verify is required before claiming completion.";
		}
		return "Stable landing recorded. Route again from the new evidence before selecting another movement.";
	}
	const next = protocolState(nextState);
	if (next === "idle") {
		return "Developer protocol is idle. This is routing state only and does not prove task completion.";
	}
	return `Developer protocol is ${next}. Address the current routing obligation before handoff.`;
}

function inferredQuestionId(
	state: DeveloperState,
	question: string,
	explicitQuestionId?: string,
): string | undefined {
	if (explicitQuestionId) return explicitQuestionId;
	if (state.focusedQuestionId) return state.focusedQuestionId;
	const normalized = normalizedQuestion(question);
	const exact = state.pendingQuestions.filter(
		(pending) => normalizedQuestion(pending.question) === normalized,
	);
	return exact.length === 1 ? exact[0]?.id : undefined;
}

function protocolToolAccess(state: DeveloperState): ProtocolToolAccess {
	const snapshot = developerSnapshot(state);
	return {
		allowsShell: snapshot.hasTag("execute"),
		allowsArtifactTools: snapshot.hasTag("mutate"),
		hasBeforeImplementationGate: snapshot.hasTag("blocks-implementation"),
	};
}

function summarizeState(state: DeveloperState): string {
	if (!state.enabled) return "developer: off";
	const target = state.activeRoute ? state.activeRoute.target : "none";
	return `developer: on · target: ${target} · ${protocolState(state)}`;
}

function protocolPrompt(
	state: DeveloperState,
	availableSkillNames: string[],
): string {
	const lines = [
		"",
		"Developer protocol is active.",
		"- Use the default topology as a conditional backbone, not a rigid lifecycle: clarify meaning when needed -> model consequential cases -> sketch the first implementation surface for new behavior or signal the smallest structural movement in existing code -> execute one implementation step -> verify current claims.",
		"- Adapt away from that topology when evidence makes a stage not applicable, but never jump directly from a resolved model to mutation: use sketch for feature implementation or signal for existing-code structural movement first.",
		"- Route doctor only for an explicitly requested scope-bound diagnosis and improvement plan across several judgment kinds; it is not a mandatory prelude, pull-request review, environment check, or synonym for ordinary implementation.",
		"- A thorough Doctor review is broad and shallow before it is narrow and deep: establish requested, inspected, and claim scope; disposition every other available Developer skill with evidence; close Doctor triage; route every triggered distinct consultation to its owning skill; let that owner select and apply every triggered policy route and co-required reference; then return to Doctor to synthesize diagnosis and treatment order. Doctor must not load sibling references or flatten their methods into one checklist.",
		"- While Doctor consultations remain, keep one agent-owned before-completion synthesis question and update its remaining consultation evidence after each owner judgment; do not open one pending question per lens. Resolve it only in the final Doctor synthesis route.",
		"- Route by the requested work product, not keywords: use sketch to create an original caller-facing interface, representation boundary, ownership map, or collaboration; use abstraction-review only when a concrete candidate surface already exists to keep/revise/split/reject/defer; use model first only when unresolved cases, rules, or policy can materially change that surface.",
		`- Call ${ROUTE_TOOL} for exactly one concrete judgment or one green-to-green implementation movement.`,
		"- Use target=implementation only when the next local movement, stable landing, narrow verification, and invariant handling are already justified; otherwise choose the focused skill whose scope fits the current question.",
		"- Invariant gate: an unchecked assertion, cast, non-null claim, ignored conversion result, or typed deserialization target is not evidence that broader, external, persisted, legacy, or otherwise less-trusted input satisfies a domain invariant. Parse or construct a refined value whose success carries the learned information before dependent effects; validation followed by narrowing does not satisfy this gate.",
		"- Every implementation route must classify invariant handling as not applicable, an evidence-preserving boundary, or a trusted compiler gap. A trusted compiler gap is valid only after a complete check or trusted contract already established the fact, the language cannot retain it, the unsafe operation is isolated to one owner, and a falsifier is named. Encountering a missing boundary requires sketch, not an implementation assertion.",
		"- An implementation step has one observable difference and one structural or behavioral purpose. Stop when its failure is locally explainable and the repository is green, pausable, and reviewable.",
		"- For implementation structural work intended to preserve behavior, set execution_profile=behavior-preserving-structure; omit the field for other implementation actions and every skill route.",
		`- Follow the routed method, then close the route with ${JUDGMENT_TOOL}. After every implementation stable landing, route again from the new evidence before selecting another movement.`,
		`- During a reference-bearing skill route, select every policy route whose observable trigger addresses a distinct unresolved question. Each selected route must refine its declared skill-method step, produce its declared artifact, satisfy its stop condition, and hand off instead of absorbing work covered by separate_when. Load every reference in each route's co-required set with ${REFERENCE_TOOL} in its explicit order. Do not select a broad fallback route when a narrower selected route already includes its work. A resolved judgment must apply every loaded reference in reference_basis, or use reference_exemption only when no route trigger applies.`,
		"- Consecutive implementation routes are valid when the new evidence still justifies implementation action. On a reroute after implementation, explicitly reconsider the most plausible skill routes and record why they are not needed; do not choose implementation by momentum.",
		"- Do not carry a predetermined implementation queue through multiple implementation steps. Re-observe after each stable landing and reroute to a skill whenever meaning, cases, design, structural direction, timing, naming, or evidence becomes uncertain.",
		"- Protocol state is routing bookkeeping. Idle never proves product completion, user acceptance, or current verification.",
		"- Preserve each skill's inspectable output surface in judgment result Markdown: keep its tables, diagrams, matrices, timelines, or code blocks instead of flattening them into prose.",
		`- On every ${JUDGMENT_TOOL} call, re-check all pending questions against the new evidence. Use question_updates to resolve questions naturally even when the current route did not focus them.`,
		"- question_updates accepts only question IDs that were already listed as pending before the current route. Never use route_id or an ID for a new open_questions entry; use an empty array or omit question_updates when no pending question exists.",
		"- A focused question always requires an explicit question_updates entry. Resolve or dismiss it with concrete basis, retain it as open/blocked, or explicitly replace the broad question while opening narrower children.",
		"- Pending questions declare who can resolve them, what they block, and observable resolution criteria. User-owned before-implementation or before-completion questions require context that explains the decision before asking for an answer. For finite required user choices, also provide a choice-form response_spec with one field per decision; do not rely on parsing Markdown into controls. Never guess a user-owned answer or bypass a before-implementation gate.",
		"- Use before-implementation only when the missing answer can change whether or what artifact mutation is valid. An agent-owned before-implementation question must be resolvable through a non-implementation skill route using observation or evidence execution; it must never require the mutation it blocks.",
		"- Product files are changed with Pi implementation tools. Developer protocol tools only route and record judgments.",
		"- Developer withholds Pi built-in bash while idle, restores bash for a routed skill judgment so it can inspect or run evidence checks, and restores edit/write only for an implementation route. It does not classify or sandbox other extensions' tools.",
		"- Use a skill judgment route, not an implementation route, when repository discovery or verifier execution is the unresolved work. Implementation remains the artifact-mutation lane.",
	];

	if (state.implementationFramingRequired) {
		lines.push(
			"Implementation gate: the latest resolved model exposed implementation work. Before implementation mutation, route sketch for new feature shape or signal for existing-code structural movement; other judgments may still be routed first.",
		);
	}
	if (state.verificationRequired) {
		lines.push(
			"Verification debt: an implementation route changed artifacts after the last resolved verify judgment. Route verify before claiming completion or handing off as done.",
		);
	}
	const completionGates = state.pendingQuestions.filter(
		(question) =>
			question.gate === "before-completion" ||
			question.gate === "before-implementation",
	);
	if (completionGates.length > 0) {
		lines.push(
			`Completion gate: ${completionGates.map((question) => question.id).join(", ")} must be resolved before a completion claim.`,
		);
	}
	if (!state.activeRoute && state.rerouteRequired) {
		lines.push(
			"Rerouting checkpoint: use the previous implementation landing as known_evidence. If implementation is still right, include alternatives_considered for the plausible available skills and explain why each adds no useful judgment now.",
		);
	}

	if (state.activeRoute) {
		lines.push(
			`Active route: ${state.activeRoute.routeId} · ${state.activeRoute.target} · ${state.activeRoute.question}`,
		);
		if (state.activeRoute.implementationStep) {
			lines.push(
				`Active invariant handling: ${formatInvariantHandling(state.activeRoute.implementationStep.invariantHandling)}. Stop and route sketch instead of mutating if this declaration is contradicted by the code.`,
			);
		}
		if (state.activeRoute.methodLocation) {
			lines.push(
				`Active skill location: ${state.activeRoute.methodLocation}. Read it again if compaction or a later turn no longer contains the full instructions.`,
				`Available routed references: ${state.activeRoute.availableReferences.join(", ") || "none"}.`,
				`Reference routes: ${state.activeRoute.referenceRoutes.map((route) => `${route.id}[${route.references.join("+")}; order=${route.readOrder}]`).join(" | ") || "none"}. Re-read the skill's reference-policy.json if trigger or artifact details were compacted.`,
				`Loaded routed references: ${state.activeRoute.loadedReferences.map((reference) => `${reference.path}@${reference.contentSha256.slice(0, 12)}[${reference.referenceRouteIds.join(",") || "legacy"}]`).join(", ") || "none"}.`,
			);
		}
	}
	if (state.pendingQuestions.length > 0) {
		lines.push("Pending Developer questions:");
		for (const question of state.pendingQuestions) {
			lines.push(
				`- ${question.id} · ${question.status} · owner=${question.resolutionOwner} · gate=${question.gate} · ${question.question} · resolves when: ${question.resolutionCriteria}`,
			);
		}
		lines.push(
			"- Revisit questions naturally. Developer associates an explicitly focused or exactly matching pending question; open_question_id is an internal disambiguator when wording is intentionally changed or several questions remain.",
			"- question_updates may resolve any pending ID from implementation, test, inspection, user, or environment evidence; each resolved update requires concrete basis.",
		);
	}
	lines.push(
		`Available Developer skills: ${availableSkillNames.length > 0 ? availableSkillNames.join(", ") : "none; use implementation only"}.`,
	);
	return lines.join("\n");
}

function routeRenderText(event: RouteEvent | undefined): string {
	if (!event) return "Route unavailable";
	const target = event.targetQuestionId
		? ` · revisits ${event.targetQuestionId}`
		: "";
	const profile = event.executionProfile ? `/${event.executionProfile}` : "";
	return `${event.target}${profile} · ${compactLine(event.question)}${target}`;
}

function compactJudgmentResult(result: string, maxChars = 160): string {
	const firstContentLine = result
		.split(/\r?\n/)
		.map((line) => line.trim())
		.find((line) => line && !line.startsWith("```"));
	return compactLine(firstContentLine ?? result, maxChars);
}

function judgmentRenderText(event: JudgmentEvent | undefined): string {
	if (!event) return "Judgment unavailable";
	return `${event.status} · ${compactJudgmentResult(event.result)}`;
}

function detailLine(
	theme: Theme,
	label: string,
	value: string,
	valueColor: ThemeColor = "muted",
): string {
	return `${theme.fg("dim", `${label} · `)}${theme.fg(valueColor, value)}`;
}

function expandedJudgment(
	event: JudgmentEvent,
	statusText: string,
	theme: Theme,
): Container {
	const container = new Container();
	const header = [
		statusText,
		detailLine(theme, "route", event.routeId, "text"),
		detailLine(theme, "target", event.target, "accent"),
		detailLine(theme, "question", event.question, "text"),
	];
	container.addChild(new Text(header.join("\n"), 0, 0));
	container.addChild(new Markdown(event.result, 0, 0, getMarkdownTheme()));

	const evidence = [
		...event.basis.map((basis) => detailLine(theme, "basis", basis)),
		...(event.referenceBasis ?? []).flatMap((reference) => [
			detailLine(
				theme,
				"reference",
				`${reference.path}@${reference.contentSha256.slice(0, 12)} [${reference.referenceRouteIds.join(", ") || "legacy"}] — trigger: ${reference.trigger}`,
				"accent",
			),
			detailLine(theme, "applied rule", reference.appliedRule, "text"),
			detailLine(theme, "resulting artifact", reference.artifact, "text"),
		]),
		...(event.referenceExemption
			? [
					detailLine(
						theme,
						"reference exemption",
						`${event.referenceExemption.reason} — ${event.referenceExemption.evidence.join(" | ")}`,
						"warning",
					),
				]
			: []),
		...event.artifacts.map((artifact) =>
			detailLine(theme, "artifact", artifact),
		),
		...event.openedQuestions.map((question) =>
			detailLine(
				theme,
				`opened ${question.resolutionOwner}/${question.gate}`,
				`${question.question} — resolves when: ${question.resolutionCriteria}`,
				"warning",
			),
		),
		...(event.questionUpdates ?? []).map((update) =>
			detailLine(
				theme,
				`question ${update.status}`,
				`${update.questionId} — ${update.result}`,
				"accent",
			),
		),
	];
	if (evidence.length > 0)
		container.addChild(new Text(evidence.join("\n"), 0, 0));
	return container;
}

export default async function developer(pi: ExtensionAPI) {
	let availableSkills = new Map<string, Skill>();
	let state = initialState();
	let compactionLanguage: CompactionLanguageState =
		initialCompactionLanguageState();
	let routeOpening = false;
	const routesWithMutation = new Set<string>();
	let toolPolicyMemory: ToolPolicyMemory = { withheldBuiltins: new Set() };
	let toolPolicyRestartRequired = false;

	pi.registerFlag("develop", {
		description: "Start with the Developer protocol enabled",
		type: "boolean",
		default: false,
	});

	const syncProtocolTools = () => {
		const current = pi.getActiveTools();
		const next = reconcileProtocolTools({
			activeTools: current,
			allTools: pi.getAllTools(),
			enabled: state.enabled,
			access: protocolToolAccess(state),
			protocolTools: PROTOCOL_TOOLS,
			memory: toolPolicyMemory,
		});
		toolPolicyMemory = next.memory;
		if (!sameToolSet(current, next.activeTools))
			pi.setActiveTools(next.activeTools);
	};

	const releaseProtocolTools = () => {
		const current = pi.getActiveTools();
		const next = reconcileProtocolTools({
			activeTools: current,
			allTools: pi.getAllTools(),
			enabled: false,
			access: protocolToolAccess(state),
			protocolTools: PROTOCOL_TOOLS,
			memory: toolPolicyMemory,
		});
		toolPolicyMemory = next.memory;
		if (!sameToolSet(current, next.activeTools))
			pi.setActiveTools(next.activeTools);
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
				: summarizeState(state),
		);
		if (
			!state.activeRoute &&
			state.pendingQuestions.length === 0 &&
			!state.implementationFramingRequired &&
			!state.verificationRequired
		) {
			ctx.ui.setWidget("developer", undefined);
			return;
		}

		if (ctx.mode === "tui") {
			const viewState = state;
			ctx.ui.setWidget(
				"developer",
				(_tui, theme) => new DeveloperWidget(viewState, theme),
				{
					placement: "belowEditor",
				},
			);
			return;
		}

		const lines = [
			...(state.activeRoute
				? [
						`route · ${state.activeRoute.target} · ${compactLine(state.activeRoute.question)}`,
					]
				: []),
			...state.pendingQuestions
				.slice(0, 3)
				.map(
					(question) =>
						`open · ${question.id} · ${compactLine(question.question)}`,
				),
			...(state.pendingQuestions.length > 3
				? [`open · +${state.pendingQuestions.length - 3} more`]
				: []),
			...(state.implementationFramingRequired
				? ["gate · frame implementation before mutation (sketch or signal)"]
				: []),
			...(state.verificationRequired
				? ["next · verify changed artifacts before completion"]
				: []),
		];
		ctx.ui.setWidget("developer", lines, { placement: "belowEditor" });
	};

	const reconstruct = (ctx: ExtensionContext) => {
		const branch = ctx.sessionManager.getBranch();
		state = toolPolicyRestartRequired
			? initialState()
			: reconstructState(branch);
		compactionLanguage = reconstructCompactionLanguage(branch);
		syncProtocolTools();
		refreshUI(ctx);
	};

	const setEnabled = (enabled: boolean, ctx: ExtensionContext): boolean => {
		if (enabled && toolPolicyRestartRequired) {
			ctx.ui.notify(TOOL_POLICY_RESTART_MESSAGE, "error");
			refreshUI(ctx);
			return false;
		}
		const event: ActivationEvent = {
			protocol: PROTOCOL,
			kind: "activation",
			enabled,
		};
		pi.appendEntry(ACTIVATION_ENTRY, event);
		state = applyDeveloperEvent(state, event);
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
		syncProtocolTools();
		refreshUI(ctx);
		return true;
	};

	const SharedRouteParams = {
		question: Type.String({
			minLength: 1,
			maxLength: MAX_QUESTION_CHARS,
			description: "The single concrete judgment or action question to route",
		}),
		reason: Type.String({
			minLength: 1,
			maxLength: MAX_QUESTION_CHARS,
			description: "Why this route target fits the current evidence",
		}),
		known_evidence: Type.Optional(
			Type.Array(Type.String({ maxLength: MAX_EVIDENCE_CHARS }), {
				maxItems: 12,
				description: "Evidence already known before routing",
			}),
		),
		open_question_id: Type.Optional(
			Type.String({
				maxLength: 512,
				description: "Exact pending question ID when this route revisits one",
			}),
		),
	};
	const RouteAlternativeParam = Type.Object(
		{
			target: Type.String({
				minLength: 1,
				maxLength: 64,
				description:
					"Exact available Developer skill name that was reconsidered",
			}),
			reason: Type.String({
				minLength: 1,
				maxLength: MAX_EVIDENCE_CHARS,
				description:
					"Why this skill would add no useful judgment before the proposed implementation movement",
			}),
		},
		{ additionalProperties: false },
	);
	const InvariantHandlingParam = Type.Union([
		Type.Object(
			{
				kind: Type.Literal("not-applicable"),
				reason: Type.String({
					minLength: 1,
					maxLength: MAX_EVIDENCE_CHARS,
					description:
						"Why this movement neither creates nor narrows broader or less-trusted data into an invariant-carrying value",
				}),
			},
			{ additionalProperties: false },
		),
		Type.Object(
			{
				kind: Type.Literal("evidence-preserving-boundary"),
				raw_representation: Type.String({
					minLength: 1,
					maxLength: MAX_EVIDENCE_CHARS,
				}),
				refined_representation: Type.String({
					minLength: 1,
					maxLength: MAX_EVIDENCE_CHARS,
				}),
				producer: Type.String({
					minLength: 1,
					maxLength: MAX_EVIDENCE_CHARS,
					description:
						"Parser, refinement function, or smart constructor whose success returns the refined value",
				}),
				failure: Type.String({
					minLength: 1,
					maxLength: MAX_EVIDENCE_CHARS,
				}),
				first_effect: Type.String({
					minLength: 1,
					maxLength: MAX_EVIDENCE_CHARS,
					description:
						"First dependent domain effect allowed only after successful refinement",
				}),
			},
			{ additionalProperties: false },
		),
		Type.Object(
			{
				kind: Type.Literal("trusted-compiler-gap"),
				assertion: Type.String({
					minLength: 1,
					maxLength: MAX_EVIDENCE_CHARS,
				}),
				established_by: Type.String({
					minLength: 1,
					maxLength: MAX_EVIDENCE_CHARS,
					description:
						"Complete check or trusted runtime contract that already established the asserted fact",
				}),
				limitation: Type.String({
					minLength: 1,
					maxLength: MAX_EVIDENCE_CHARS,
					description:
						"Why ordinary language narrowing cannot retain the established fact",
				}),
				containment: Type.String({
					minLength: 1,
					maxLength: MAX_EVIDENCE_CHARS,
					description: "Single parser or constructor owner containing the gap",
				}),
				verification: Type.String({
					minLength: 1,
					maxLength: MAX_EVIDENCE_CHARS,
					description:
						"Falsifier for the claimed prior evidence and containment",
				}),
			},
			{ additionalProperties: false },
		),
	]);
	const RouteParams = Type.Union([
		Type.Object(
			{
				...SharedRouteParams,
				target: Type.String({
					minLength: 1,
					maxLength: 64,
					pattern: "^(?!implementation$)[a-z0-9]+(?:-[a-z0-9]+)*$",
					description:
						"Exact skill name from the current Available Developer skills list",
				}),
			},
			{
				additionalProperties: false,
				description: "Route one question to a Developer skill",
			},
		),
		Type.Object(
			{
				...SharedRouteParams,
				target: Type.Literal("implementation", {
					description:
						"Use Pi implementation tools for an already-justified action",
				}),
				movement: Type.String({
					minLength: 1,
					maxLength: MAX_QUESTION_CHARS,
					description:
						"One locally explainable behavioral or structural movement; not a multi-step implementation queue",
				}),
				stop_condition: Type.String({
					minLength: 1,
					maxLength: MAX_QUESTION_CHARS,
					description:
						"The green, pausable, reviewable stable landing that ends this implementation route",
				}),
				verification: Type.String({
					minLength: 1,
					maxLength: MAX_EVIDENCE_CHARS,
					description:
						"The narrowest check that can catch the likely break in this movement",
				}),
				invariant_handling: InvariantHandlingParam,
				alternatives_considered: Type.Optional(
					Type.Array(RouteAlternativeParam, {
						maxItems: 6,
						description:
							"On a reroute after implementation, the plausible skill routes reconsidered and why each is unnecessary now",
					}),
				),
				execution_profile: Type.Optional(
					Type.Literal("behavior-preserving-structure", {
						description:
							"Load the focused structural-mutation protocol; omit for ordinary implementation action",
					}),
				),
			},
			{
				additionalProperties: false,
				description: "Route one already-justified implementation action",
			},
		),
	]);

	pi.registerTool({
		name: ROUTE_TOOL,
		label: "Developer Route Question",
		description:
			"Route one concrete judgment or one green-to-green implementation movement. Route by work product: doctor coordinates an explicitly requested scope-bound existing-code diagnosis, sketch creates an original design surface, abstraction-review judges an already-shaped candidate, and model settles unresolved conditions before design. Implementation must declare how invariant-bearing values are constructed without unchecked narrowing. Then use stable landings and verify before completion.",
		promptSnippet: "Choose how to handle one development question",
		promptGuidelines: [
			`Call ${ROUTE_TOOL} only when there is no active Developer route.`,
			`Use ${ROUTE_TOOL} with the most focused skill supported by current evidence; choose doctor only for an explicit scope-bound existing-code diagnosis and improvement plan, choose sketch for an original interface or boundary, abstraction-review only for an already-shaped candidate, and model only for unresolved condition space. target=implementation requires one movement, one stable landing, one narrow verification, and a truthful invariant_handling declaration. Validation followed by an assertion is not an evidence-preserving boundary.`,
			`When ${ROUTE_TOOL} follows an implementation judgment with another implementation route, cite the previous landing in known_evidence and record plausible skill routes in alternatives_considered instead of selecting implementation by momentum.`,
			`After a resolved model, use sketch for first feature implementation framing or signal for existing-code structural movement before implementation mutation.`,
		],
		parameters: RouteParams,
		executionMode: "sequential",
		renderShell: "self",
		async execute(toolCallId, params, _signal, _onUpdate, ctx) {
			if (!state.enabled)
				fail("Developer protocol is off. Run /develop on first.");
			if (state.activeRoute || routeOpening) {
				if (!state.activeRoute)
					fail(
						"Another Developer route is currently opening. Wait for it to finish.",
					);
				fail(
					`Route ${state.activeRoute.routeId} is still active. Record its judgment before routing another question.`,
				);
			}
			routeOpening = true;

			try {
				const question = params.question.trim();
				const reason = params.reason.trim();
				if (!question || !reason)
					fail("Question and reason must contain non-whitespace text.");

				const explicitQuestionId = params.open_question_id?.trim() || undefined;
				const targetQuestionId = inferredQuestionId(
					state,
					question,
					explicitQuestionId,
				);
				if (
					targetQuestionId &&
					!state.pendingQuestions.some((item) => item.id === targetQuestionId)
				) {
					fail(`Unknown pending question ID: ${targetQuestionId}`);
				}

				const target = params.target;
				const implementationBlockers = state.pendingQuestions.filter(
					(pending) => pending.gate === "before-implementation",
				);
				if (target === "implementation" && implementationBlockers.length > 0) {
					fail(
						`Implementation work is blocked by ${implementationBlockers
							.map(
								(pending) =>
									`${pending.id} (${pending.resolutionOwner}: ${pending.question})`,
							)
							.join("; ")}. Resolve those questions first.`,
					);
				}
				const knownEvidence = (params.known_evidence ?? [])
					.map((item) => item.trim())
					.filter(Boolean);
				const consideredAlternatives: RouteAlternative[] =
					target === "implementation" && "alternatives_considered" in params
						? (params.alternatives_considered ?? []).map((alternative) => ({
								target: alternative.target.trim(),
								reason: alternative.reason.trim(),
							}))
						: [];
				for (const alternative of consideredAlternatives) {
					if (!availableSkills.has(alternative.target)) {
						fail(
							`Considered alternative ${alternative.target} is unavailable or disabled.`,
						);
					}
				}
				if (
					new Set(
						consideredAlternatives.map((alternative) => alternative.target),
					).size !== consideredAlternatives.length
				) {
					fail(
						"Each considered alternative must name a different available Developer skill.",
					);
				}
				if (
					target === "implementation" &&
					state.lastJudgment?.target === "implementation"
				) {
					if (knownEvidence.length === 0) {
						fail(
							"A consecutive implementation route must cite evidence from the previous implementation landing in known_evidence.",
						);
					}
					if (availableSkills.size > 0 && consideredAlternatives.length === 0) {
						fail(
							"A consecutive implementation route must record the plausible available skill routes in alternatives_considered and explain why they are not needed now.",
						);
					}
				}
				if (
					target === "implementation" &&
					state.implementationFramingRequired &&
					(availableSkills.has("sketch") || availableSkills.has("signal"))
				) {
					fail(
						"The latest resolved model requires implementation framing before implementation work. Route sketch for new feature shape or signal for existing-code structural movement.",
					);
				}
				const skill =
					target === "implementation" ? undefined : availableSkills.get(target);
				if (target !== "implementation" && !skill) {
					fail(
						`Developer skill ${target} is unavailable or disabled in the current Pi resource configuration.`,
					);
				}
				const requestedExecutionProfile =
					"execution_profile" in params ? params.execution_profile : undefined;
				if (
					target !== "implementation" &&
					requestedExecutionProfile !== undefined
				) {
					fail("execution_profile is valid only when target=implementation.");
				}
				const executionProfile: ImplementationProfile | undefined =
					target === "implementation"
						? (requestedExecutionProfile ?? "ordinary")
						: undefined;

				const availableReferences = skill
					? await skillReferencePaths(skill)
					: [];
				const referencePolicy = skill
					? await loadSkillReferencePolicy(skill, availableReferences)
					: { routes: [] };
				let method: string;
				if (skill) {
					method = await renderSkillMethod(skill);
				} else if (executionProfile === "behavior-preserving-structure") {
					const profile = await readFile(structuralChangeMethodPath, "utf8");
					method = [
						'<developer-implementation-profile name="behavior-preserving-structure">',
						profile.trim(),
						"</developer-implementation-profile>",
					].join("\n");
				} else {
					method = [
						"# Implementation action",
						"",
						"The next local action is already justified. Keep this route open while using Pi implementation tools and collecting evidence.",
						"",
						"## Invariant gate",
						"",
						"Follow the route's invariant-handling declaration. Broader or less-trusted input must become an invariant-carrying value through a parser, refinement function, or smart constructor before dependent effects. Validation followed by an assertion, cast, non-null claim, ignored conversion result, or typed decode is not evidence. If the declared handling is incomplete, stop without mutation and route sketch. Keep any trusted compiler gap isolated to its declared owner and verify its prior evidence and containment.",
					].join("\n");
				}

				const implementationStep =
					target === "implementation"
						? {
								movement: ("movement" in params
									? params.movement
									: question
								).trim(),
								stopCondition: ("stop_condition" in params
									? params.stop_condition
									: "Reach a green, pausable, reviewable stable landing."
								).trim(),
								verification: ("verification" in params
									? params.verification
									: "Run the narrowest relevant check and inspect the resulting diff or output."
								).trim(),
								invariantHandling: invariantHandlingFromInput(
									"invariant_handling" in params
										? params.invariant_handling
										: undefined,
								),
							}
						: undefined;

				const event: RouteEvent = {
					protocol: PROTOCOL,
					kind: "route",
					routeId: `route:${toolCallId}`,
					question,
					target,
					reason,
					knownEvidence,
					consideredAlternatives,
					availableReferences,
					referenceRoutes: referencePolicy.routes,
					referenceExemptionCriteria: referencePolicy.exemption,
					referencePolicySha256: referencePolicy.contentSha256,
					loadedReferences: [],
					targetQuestionId,
					methodLocation: skill?.filePath,
					executionProfile,
					implementationStep,
				};
				const response = [
					`Route ID: ${event.routeId}`,
					`Question: ${event.question}`,
					`Target: ${event.target}`,
					skill
						? `Skill location: ${skill.filePath}`
						: "Skill location: implementation action; no skill file",
					executionProfile
						? `Execution profile: ${executionProfile}`
						: "Execution profile: skill judgment",
					...(implementationStep
						? [
								`Movement: ${implementationStep.movement}`,
								`Stable landing: ${implementationStep.stopCondition}`,
								`Narrow verification: ${implementationStep.verification}`,
								`Invariant handling: ${formatInvariantHandling(implementationStep.invariantHandling)}`,
								"Stop this implementation route at that landing, record the evidence, and route again before another movement.",
							]
						: []),
					`Reason: ${event.reason}`,
					`Available references: ${event.availableReferences.join(" | ") || "none"}`,
					...referencePolicyLines(
						event.referenceRoutes,
						event.referenceExemptionCriteria,
					),
					`Reference policy SHA-256: ${event.referencePolicySha256 ?? "none"}`,
					...(skill && event.availableReferences.length > 0
						? [
								`Reference contract: choose policy routes by observable trigger, use ${REFERENCE_TOOL} for every reference in each selected route's co-required set, and provide reference_basis for every loaded path; use reference_exemption only when no policy route applies.`,
							]
						: []),
					...(skill && event.availableReferences.length === 0
						? [
								"Reference contract: this skill has no packaged references; omit both reference_basis and reference_exemption from its judgment.",
							]
						: []),
					`Known evidence: ${event.knownEvidence.length > 0 ? event.knownEvidence.join(" | ") : "none"}`,
					`Alternatives reconsidered: ${
						event.consideredAlternatives.length > 0
							? event.consideredAlternatives
									.map(
										(alternative) =>
											`${alternative.target} — ${alternative.reason}`,
									)
									.join(" | ")
							: "none"
					}`,
					targetQuestionId
						? `Revisits pending question: ${targetQuestionId}`
						: "Revisits pending question: none",
					`When this route has done its job, call ${JUDGMENT_TOOL} with this exact route ID.`,
					"",
					"---",
					"",
					method,
				].join("\n");
				ensureSafeToolText(response, "Developer route result");
				if (!canApplyDeveloperEvent(state, event)) {
					fail(
						"Developer machine guard rejected the route transition from the current branch state.",
					);
				}

				state = applyDeveloperEvent(state, event);
				syncProtocolTools();
				refreshUI(ctx);
				return textResult(response, event);
			} finally {
				routeOpening = false;
			}
		},
		renderCall(args, theme, context) {
			const target =
				typeof args.target === "string" && args.target.length > 0
					? args.target
					: "…";
			const question =
				typeof args.question === "string" && args.question.length > 0
					? compactLine(args.question)
					: "…";
			return reusableText(
				`${theme.fg("toolTitle", theme.bold(ROUTE_TOOL))} ${theme.fg("accent", target)} ${theme.fg("muted", question)}`,
				context.lastComponent,
			);
		},
		renderResult(result, { expanded, isPartial }, theme, context) {
			if (isPartial) {
				return reusableText(
					theme.fg("warning", "routing development question…"),
					context.lastComponent,
				);
			}
			if (context.isError) {
				return reusableText(
					theme.fg("error", resultText(result) || "Developer route failed"),
					context.lastComponent,
				);
			}
			const normalized = normalizeDeveloperEvent(result.details);
			const event = normalized?.kind === "route" ? normalized : undefined;
			let text = theme.fg("success", `routed ${routeRenderText(event)}`);
			if (expanded && event) {
				text += `\n${detailLine(theme, "route", event.routeId, "text")}`;
				text += `\n${detailLine(theme, "question", event.question, "text")}`;
				text += `\n${detailLine(theme, "reason", event.reason)}`;
				if (event.knownEvidence.length > 0) {
					for (const evidence of event.knownEvidence) {
						text += `\n${detailLine(theme, "evidence", evidence)}`;
					}
				} else {
					text += `\n${detailLine(theme, "evidence", "none recorded before routing", "warning")}`;
				}
				for (const alternative of event.consideredAlternatives ?? []) {
					text += `\n${detailLine(theme, `considered ${alternative.target}`, alternative.reason)}`;
				}
				text += `\n${detailLine(theme, "revisits", event.targetQuestionId ?? "none")}`;
				text += `\n${detailLine(theme, "skill", event.methodLocation ?? "implementation action")}`;
				if ((event.availableReferences ?? []).length > 0) {
					text += `\n${detailLine(theme, "references", event.availableReferences.join(", "))}`;
				}
				for (const route of event.referenceRoutes ?? []) {
					text += `\n${detailLine(theme, `reference route ${route.id}`, `${route.question} · ${route.trigger} → ${route.references.join(" + ")} · step=${route.methodStep} · stop=${route.stop} · separate=${route.separateWhen}`)}`;
				}
				if (event.referencePolicySha256) {
					text += `\n${detailLine(theme, "reference policy", event.referencePolicySha256)}`;
				}
				if (event.executionProfile) {
					text += `\n${detailLine(theme, "profile", event.executionProfile)}`;
				}
				if (event.implementationStep) {
					text += `\n${detailLine(theme, "movement", event.implementationStep.movement, "text")}`;
					text += `\n${detailLine(theme, "landing", event.implementationStep.stopCondition)}`;
					text += `\n${detailLine(theme, "verify", event.implementationStep.verification)}`;
					text += `\n${detailLine(theme, "invariant", formatInvariantHandling(event.implementationStep.invariantHandling))}`;
				}
			}
			if (!expanded && event)
				text += ` · ${keyHint("app.tools.expand", "details")}`;
			return reusableText(text, context.lastComponent);
		},
	});

	const ReferenceParams = Type.Object(
		{
			reference_route: Type.String({
				minLength: 1,
				maxLength: 128,
				description:
					"Exact reference route ID listed by the active Developer skill policy",
			}),
			path: Type.String({
				minLength: 1,
				maxLength: MAX_ARTIFACT_CHARS,
				description:
					"Exact direct skill-relative reference path listed by the active route, such as references/data-driven-design.md",
			}),
			reason: Type.String({
				minLength: 1,
				maxLength: MAX_EVIDENCE_CHARS,
				description:
					"Observable task evidence that makes this reference relevant now",
			}),
		},
		{ additionalProperties: false },
	);

	pi.registerTool({
		name: REFERENCE_TOOL,
		label: "Developer Load Reference",
		description:
			"Select one active policy route while loading one reference from its co-required set, recording route ID, exact path, content SHA-256, Source Trace, and trigger evidence.",
		promptSnippet: "Load an active Developer skill reference with provenance",
		promptGuidelines: [
			`Use ${REFERENCE_TOOL}, not an ordinary read, for any reference that supports an active Developer skill judgment.`,
			`Call ${REFERENCE_TOOL} with a policy reference_route and one not-yet-loaded path from that route's co-required set; state the observable trigger and apply it only at the declared method step. One successful load satisfies an overlapping path for every selected route, so never reload a shared path and provide only one reference_basis entry per distinct path.`,
		],
		parameters: ReferenceParams,
		executionMode: "sequential",
		renderShell: "self",
		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			if (!state.enabled) fail("Developer protocol is off.");
			const activeRoute = state.activeRoute;
			if (!activeRoute) fail("There is no active Developer skill route.");
			if (activeRoute.target === "implementation") {
				fail("Implementation routes do not load skill references.");
			}
			const referenceRouteId = params.reference_route.trim();
			const path = params.path.trim().replaceAll("\\", "/");
			const reason = params.reason.trim();
			if (!referenceRouteId || !path || !reason) {
				fail(
					"Reference route, path, and reason must contain non-whitespace text.",
				);
			}
			const skill = availableSkills.get(activeRoute.target);
			if (!skill || skill.filePath !== activeRoute.methodLocation) {
				fail(
					"The active skill source is no longer available at the route's canonical location. Route again against the current Pi resources.",
				);
			}
			const availableReferences =
				activeRoute.availableReferences.length > 0
					? activeRoute.availableReferences
					: await skillReferencePaths(skill);
			let referenceRoutes = activeRoute.referenceRoutes;
			if (referenceRoutes.length === 0) {
				const policy = await loadSkillReferencePolicy(
					skill,
					availableReferences,
				);
				referenceRoutes = policy.routes;
			}
			const policyRoute = referenceRoutes.find(
				(candidate) => candidate.id === referenceRouteId,
			);
			if (!policyRoute) {
				fail(
					`Unknown reference route ${referenceRouteId}. Available routes: ${referenceRoutes.map((route) => route.id).join(", ") || "none"}.`,
				);
			}
			if (!policyRoute.references.includes(path)) {
				fail(
					`Reference ${path} is not part of route ${policyRoute.id}. Co-required route references: ${policyRoute.references.join(", ")}.`,
				);
			}
			const loadedPaths = new Set(
				activeRoute.loadedReferences.map((reference) => reference.path),
			);
			if (loadedPaths.has(path)) {
				fail(
					`Reference ${path} is already loaded. One successful load satisfies overlapping route membership; select ${policyRoute.id} by loading one of its not-yet-loaded paths and keep one reference_basis entry per distinct path.`,
				);
			}
			if (policyRoute.readOrder === "listed") {
				const pathIndex = policyRoute.references.indexOf(path);
				const missingEarlierReferences = policyRoute.references
					.slice(0, pathIndex)
					.filter((reference) => !loadedPaths.has(reference));
				if (missingEarlierReferences.length > 0) {
					fail(
						`Reference route ${policyRoute.id} declares listed read order. Load these earlier route references first: ${missingEarlierReferences.join(", ")}.`,
					);
				}
			}
			const reference = await loadSkillReference(skill, path);
			const event: ReferenceLoadEvent = {
				protocol: PROTOCOL,
				kind: "reference-load",
				routeId: activeRoute.routeId,
				target: activeRoute.target,
				path: reference.path,
				reason,
				contentSha256: reference.contentSha256,
				sourceTrace: reference.sourceTrace,
				referenceRouteIds: [policyRoute.id],
			};
			if (!canApplyDeveloperEvent(state, event)) {
				fail(
					"Developer machine guard rejected the reference load for the current active route.",
				);
			}
			const response = [
				`Route ID: ${event.routeId}`,
				`Target: ${event.target}`,
				`Reference policy route: ${policyRoute.id}`,
				`Route question: ${policyRoute.question}`,
				`Route trigger: ${policyRoute.trigger}`,
				`Skill method step refined: ${policyRoute.methodStep}`,
				`Co-required references: ${policyRoute.references.join(" + ")}`,
				`Read order: ${policyRoute.readOrder}`,
				`Expected application artifacts: ${policyRoute.artifacts.join(" | ")}`,
				`Route stop: ${policyRoute.stop}`,
				`Separate or hand off when: ${policyRoute.separateWhen}`,
				`Reference: ${event.path}`,
				`Reference SHA-256: ${event.contentSha256}`,
				`Source Trace: ${event.sourceTrace ? "present in loaded content and recorded in tool details" : "not declared by this reference"}`,
				`Trigger evidence: ${event.reason}`,
				"",
				"<developer-reference>",
				reference.content,
				"</developer-reference>",
			].join("\n");
			ensureSafeToolText(response, "Developer reference result");
			state = applyDeveloperEvent(state, event);
			syncProtocolTools();
			refreshUI(ctx);
			return textResult(response, event);
		},
		renderCall(args, theme, context) {
			const path =
				typeof args.path === "string" && args.path.length > 0 ? args.path : "…";
			return reusableText(
				`${theme.fg("toolTitle", theme.bold(REFERENCE_TOOL))} ${theme.fg("accent", path)}`,
				context.lastComponent,
			);
		},
		renderResult(result, { expanded, isPartial }, theme, context) {
			if (isPartial) {
				return reusableText(
					theme.fg("warning", "loading Developer reference…"),
					context.lastComponent,
				);
			}
			if (context.isError) {
				return reusableText(
					theme.fg("error", resultText(result) || "Developer reference failed"),
					context.lastComponent,
				);
			}
			const normalized = normalizeDeveloperEvent(result.details);
			const event =
				normalized?.kind === "reference-load" ? normalized : undefined;
			let text = theme.fg(
				"success",
				`loaded ${event?.path ?? "Developer reference"}`,
			);
			if (expanded && event) {
				text += `\n${detailLine(theme, "route", event.routeId, "text")}`;
				text += `\n${detailLine(theme, "target", event.target, "accent")}`;
				text += `\n${detailLine(theme, "reference route", event.referenceRouteIds.join(", ") || "legacy", "accent")}`;
				text += `\n${detailLine(theme, "sha256", event.contentSha256)}`;
				text += `\n${detailLine(theme, "trigger", event.reason, "text")}`;
				text += `\n${detailLine(theme, "source trace", event.sourceTrace || "not declared", event.sourceTrace ? "muted" : "warning")}`;
			}
			if (!expanded && event)
				text += ` · ${keyHint("app.tools.expand", "provenance")}`;
			return reusableText(text, context.lastComponent);
		},
	});

	const ChoiceResponseOptionParam = Type.Object(
		{
			value: Type.String({
				minLength: 1,
				maxLength: MAX_RESPONSE_IDENTIFIER_CHARS,
				pattern: "^[A-Za-z0-9][A-Za-z0-9._-]*$",
			}),
			label: Type.String({ minLength: 1, maxLength: MAX_RESPONSE_TEXT_CHARS }),
			description: Type.Optional(
				Type.String({ minLength: 1, maxLength: MAX_RESPONSE_TEXT_CHARS }),
			),
			detail_prompt: Type.Optional(
				Type.String({
					minLength: 1,
					maxLength: MAX_RESPONSE_TEXT_CHARS,
					description: "Required non-empty detail when this option is selected",
				}),
			),
		},
		{ additionalProperties: false },
	);
	const ChoiceResponseFieldParam = Type.Object(
		{
			id: Type.String({
				minLength: 1,
				maxLength: MAX_RESPONSE_IDENTIFIER_CHARS,
				pattern: "^[A-Za-z0-9][A-Za-z0-9._-]*$",
			}),
			prompt: Type.String({ minLength: 1, maxLength: MAX_RESPONSE_TEXT_CHARS }),
			description: Type.Optional(
				Type.String({ minLength: 1, maxLength: MAX_RESPONSE_TEXT_CHARS }),
			),
			options: Type.Array(ChoiceResponseOptionParam, {
				minItems: 2,
				maxItems: MAX_RESPONSE_OPTIONS,
			}),
		},
		{ additionalProperties: false },
	);
	const ChoiceResponseSpecParam = Type.Object(
		{
			kind: Type.Literal("choice-form"),
			fields: Type.Array(ChoiceResponseFieldParam, {
				minItems: 1,
				maxItems: MAX_RESPONSE_FIELDS,
			}),
		},
		{
			additionalProperties: false,
			description:
				"Explicit controls for finite user-owned decisions; use one required single-choice field per decision instead of expecting the TUI to parse Markdown context",
		},
	);
	const OpenQuestionParam = Type.Object(
		{
			question: Type.String({ minLength: 1, maxLength: MAX_QUESTION_CHARS }),
			context: Type.Optional(
				Type.String({
					maxLength: MAX_QUESTION_CONTEXT_CHARS,
					description:
						"Explanation shown before answer controls; required for user-owned before-implementation or before-completion questions",
				}),
			),
			response_spec: Type.Optional(ChoiceResponseSpecParam),
			status: StringEnum(["open", "blocked"] as const, {
				description:
					"Whether the required evidence or answer is currently obtainable",
			}),
			resolution_owner: StringEnum(["agent", "user", "environment"] as const, {
				description:
					"Who can provide the evidence or decision that resolves this question",
			}),
			gate: StringEnum(
				["none", "before-implementation", "before-completion"] as const,
				{
					description:
						"What work this question blocks; an agent before-implementation question must be resolvable through a non-implementation evidence route",
				},
			),
			resolution_criteria: Type.String({
				minLength: 1,
				maxLength: MAX_EVIDENCE_CHARS,
				description:
					"Observable evidence or answer that will settle the question",
			}),
		},
		{ additionalProperties: false },
	);
	const QuestionUpdateParam = Type.Object(
		{
			question_id: Type.String({
				minLength: 1,
				maxLength: 512,
				description:
					"Exact ID of a question that was pending before this route; never route_id or a newly opened question ID",
			}),
			status: StringEnum([
				"resolved",
				"not-applicable",
				"open",
				"blocked",
			] as const),
			result: Type.String({ minLength: 1, maxLength: MAX_RESULT_CHARS }),
			basis: Type.Array(Type.String({ maxLength: MAX_EVIDENCE_CHARS }), {
				maxItems: 20,
			}),
		},
		{ additionalProperties: false },
	);
	const ReferenceBasisParam = Type.Object(
		{
			path: Type.String({
				minLength: 1,
				maxLength: MAX_ARTIFACT_CHARS,
				description: `A reference path successfully loaded through ${REFERENCE_TOOL} during this route`,
			}),
			trigger: Type.String({
				minLength: 1,
				maxLength: MAX_EVIDENCE_CHARS,
				description:
					"Observable input, code, state, or requirement condition that made the reference applicable",
			}),
			applied_rule: Type.String({
				minLength: 1,
				maxLength: MAX_EVIDENCE_CHARS,
				description:
					"The concrete derivation, diagnostic, or decision rule taken from the loaded reference",
			}),
			artifact: Type.String({
				minLength: 1,
				maxLength: MAX_ARTIFACT_CHARS,
				description:
					"The result table, model, interface, trace, decision, or check produced by applying that rule",
			}),
		},
		{ additionalProperties: false },
	);
	const ReferenceExemptionParam = Type.Object(
		{
			reason: Type.String({
				minLength: 1,
				maxLength: MAX_EVIDENCE_CHARS,
				description:
					"Why none of the active skill's available references can add useful judgment for this resolved local question",
			}),
			evidence: Type.Array(
				Type.String({ minLength: 1, maxLength: MAX_EVIDENCE_CHARS }),
				{
					minItems: 1,
					maxItems: 8,
					description:
						"Concrete facts supporting the exemption rather than a convenience claim",
				},
			),
		},
		{ additionalProperties: false },
	);
	const JudgmentParams = Type.Object({
		route_id: Type.String({
			minLength: 1,
			maxLength: 512,
			description: `Exact route ID returned by ${ROUTE_TOOL}`,
		}),
		status: StringEnum([
			"resolved",
			"needs-evidence",
			"not-applicable",
			"blocked",
		] as const),
		result: Type.String({
			minLength: 1,
			maxLength: MAX_RESULT_CHARS,
			description:
				"The resulting judgment in Markdown; preserve the routed skill's inspectable tables, diagrams, matrices, timelines, or code blocks",
		}),
		basis: Type.Array(Type.String({ maxLength: MAX_EVIDENCE_CHARS }), {
			maxItems: 20,
			description: "Evidence supporting the judgment or blocker",
		}),
		reference_basis: Type.Optional(
			Type.Array(ReferenceBasisParam, {
				maxItems: 12,
				description:
					"Loaded references linked to their trigger, applied rule, and resulting judgment artifact",
			}),
		),
		reference_exemption: Type.Optional(ReferenceExemptionParam),
		open_questions: Type.Optional(
			Type.Array(OpenQuestionParam, {
				maxItems: 10,
				description:
					"New unresolved questions with explicit resolution target, gate, and observable resolution criteria",
			}),
		),
		question_updates: Type.Optional(
			Type.Array(QuestionUpdateParam, {
				maxItems: 20,
				description:
					"Updates to questions already pending before this route; use [] when none exist, and never put route_id or newly opened questions here",
			}),
		),
		artifacts: Type.Optional(
			Type.Array(Type.String({ maxLength: MAX_ARTIFACT_CHARS }), {
				maxItems: 20,
				description: "Relevant paths, commands, tests, or outputs",
			}),
		),
	});

	pi.registerTool({
		name: JUDGMENT_TOOL,
		label: "Developer Record Judgment",
		description:
			"Close the active Developer route with its result, evidence, newly opened questions, and relevant artifacts. This records a local judgment, not task completion.",
		promptSnippet: "Record evidence and close the active development route",
		promptGuidelines: [
			`Use ${JUDGMENT_TOOL} with the exact active Developer route ID.`,
			`Use ${JUDGMENT_TOOL} result as Markdown and preserve the routed skill's inspectable tables, diagrams, matrices, timelines, and code blocks instead of reducing them to prose.`,
			`For a resolved skill route with available references, use ${JUDGMENT_TOOL} reference_basis to connect each relied-on ${REFERENCE_TOOL} load to its trigger, applied rule, and resulting artifact, or use reference_exemption when no reference is relevant. Never provide both. For a skill with no packaged references, omit both fields.`,
			`Use ${JUDGMENT_TOOL} open_questions with resolution_owner, gate, and resolution_criteria. User-owned gated questions require explanatory context before controls; for finite required decisions, add a choice-form response_spec with one field per decision. Use question_updates whenever current evidence settles or changes any existing pending question.`,
			`Do not use ${JUDGMENT_TOOL} with resolved, not-applicable, or blocked status without at least one concrete basis.`,
		],
		parameters: JudgmentParams,
		executionMode: "sequential",
		renderShell: "self",
		prepareArguments(args): Static<typeof JudgmentParams> {
			const input = args as Static<typeof JudgmentParams> & {
				status?: string;
				open_questions?: unknown[];
			};
			if (
				!input ||
				typeof input !== "object" ||
				!Array.isArray(input.open_questions)
			) {
				return args as Static<typeof JudgmentParams>;
			}
			return {
				...input,
				open_questions: input.open_questions.map((question) =>
					typeof question === "string"
						? legacyOpenQuestion(question, input.status)
						: question,
				) as Static<typeof JudgmentParams>["open_questions"],
			};
		},
		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			if (!state.enabled) fail("Developer protocol is off.");
			const activeRoute = state.activeRoute;
			if (!activeRoute) fail("There is no active Developer route to close.");
			if (params.route_id !== activeRoute.routeId) {
				fail(`Route ID mismatch. Active route is ${activeRoute.routeId}.`);
			}
			const activeSkill =
				activeRoute.target === "implementation"
					? undefined
					: availableSkills.get(activeRoute.target);
			let availableReferences: string[] = [];
			if (activeRoute.target !== "implementation") {
				if (activeRoute.availableReferences.length > 0) {
					availableReferences = activeRoute.availableReferences;
				} else if (
					activeSkill &&
					activeSkill.filePath === activeRoute.methodLocation
				) {
					availableReferences = await skillReferencePaths(activeSkill);
				}
			}
			let referenceRoutes = activeRoute.referenceRoutes;
			if (
				activeRoute.target !== "implementation" &&
				referenceRoutes.length === 0 &&
				activeSkill &&
				activeSkill.filePath === activeRoute.methodLocation
			) {
				const policy = await loadSkillReferencePolicy(
					activeSkill,
					availableReferences,
				);
				referenceRoutes = policy.routes;
			}

			const basis = params.basis.map((item) => item.trim()).filter(Boolean);
			const result = params.result.trim();
			if (!result) fail("A judgment result must contain non-whitespace text.");
			if (params.status !== "needs-evidence" && basis.length === 0) {
				fail(`${params.status} judgments require at least one concrete basis.`);
			}

			const referenceBasisInput = (params.reference_basis ?? []).map(
				(item) => ({
					path: item.path.trim().replaceAll("\\", "/"),
					trigger: item.trigger.trim(),
					appliedRule: item.applied_rule.trim(),
					artifact: item.artifact.trim(),
				}),
			);
			const referenceExemptionInput = params.reference_exemption
				? {
						reason: params.reference_exemption.reason.trim(),
						evidence: params.reference_exemption.evidence
							.map((item) => item.trim())
							.filter(Boolean),
					}
				: undefined;
			if (referenceBasisInput.length > 0 && referenceExemptionInput) {
				fail("Use reference_basis or reference_exemption, never both.");
			}
			if (
				new Set(referenceBasisInput.map((item) => item.path)).size !==
				referenceBasisInput.length
			) {
				fail("Each reference_basis path must be unique within a judgment.");
			}
			if (
				activeRoute.target === "implementation" &&
				(referenceBasisInput.length > 0 || referenceExemptionInput)
			) {
				fail(
					"Implementation judgments do not accept skill reference evidence.",
				);
			}
			if (referenceExemptionInput && params.status !== "resolved") {
				fail(
					"reference_exemption is valid only for a resolved skill judgment.",
				);
			}
			if (referenceExemptionInput && availableReferences.length === 0) {
				fail(
					"reference_exemption is unnecessary because the active skill has no available references.",
				);
			}
			if (referenceExemptionInput && activeRoute.loadedReferences.length > 0) {
				fail(
					"reference_exemption is valid only when no routed reference was loaded during this route.",
				);
			}
			if (
				params.status === "resolved" &&
				availableReferences.length > 0 &&
				referenceBasisInput.length === 0 &&
				!referenceExemptionInput
			) {
				fail(
					`A resolved ${activeRoute.target} judgment must provide reference_basis for references loaded through ${REFERENCE_TOOL}, or a concrete reference_exemption.`,
				);
			}
			const referenceBasisPaths = new Set(
				referenceBasisInput.map((item) => item.path),
			);
			const loadedReferences = new Map(
				activeRoute.loadedReferences.map((reference) => [
					reference.path,
					reference,
				]),
			);
			const loadedPaths = new Set(loadedReferences.keys());
			const basisMissingForLoaded = [...loadedPaths].filter(
				(path) => !referenceBasisPaths.has(path),
			);
			if (basisMissingForLoaded.length > 0) {
				fail(
					`Every loaded reference must have a reference_basis entry: ${basisMissingForLoaded.join(", ")}.`,
				);
			}
			const selectedReferenceRouteIds = new Set(
				activeRoute.loadedReferences.flatMap(
					(reference) => reference.referenceRouteIds,
				),
			);
			for (const referenceRouteId of selectedReferenceRouteIds) {
				const route = referenceRoutes.find(
					(candidate) => candidate.id === referenceRouteId,
				);
				if (!route) {
					fail(
						`Loaded reference selected unknown policy route ${referenceRouteId}; route again against the current skill policy.`,
					);
				}
				const missingRouteReferences = route.references.filter(
					(path) => !loadedPaths.has(path),
				);
				if (missingRouteReferences.length > 0) {
					fail(
						`Reference route ${route.id} is incomplete. Load its co-required references before judgment: ${missingRouteReferences.join(", ")}.`,
					);
				}
			}
			for (const loaded of activeRoute.loadedReferences) {
				for (const referenceRouteId of loaded.referenceRouteIds) {
					const route = referenceRoutes.find(
						(candidate) => candidate.id === referenceRouteId,
					);
					if (route && !route.references.includes(loaded.path)) {
						fail(
							`Reference ${loaded.path} is not part of its recorded policy route ${route.id}.`,
						);
					}
				}
			}
			const referenceBasis: ReferenceBasis[] = referenceBasisInput.map(
				(item) => {
					const loaded = loadedReferences.get(item.path);
					if (!loaded) {
						fail(
							`reference_basis path ${item.path} was not successfully loaded through ${REFERENCE_TOOL} during this route.`,
						);
					}
					return { ...loaded, ...item };
				},
			);
			const referenceExemption: ReferenceExemption | undefined =
				referenceExemptionInput;

			const openedQuestions = buildOpenedQuestions(
				params.open_questions ?? [],
				state,
				params.route_id,
			);
			if (
				availableSkills.size === 0 &&
				openedQuestions.some(
					(question) =>
						question.resolutionOwner === "agent" &&
						question.gate === "before-implementation",
				)
			) {
				fail(
					"An agent-owned before-implementation question requires an available non-implementation skill resolution path.",
				);
			}
			const remainsOpen =
				params.status === "needs-evidence" || params.status === "blocked";
			if (
				remainsOpen &&
				!activeRoute.targetQuestionId &&
				openedQuestions.length === 0
			) {
				fail(
					"A needs-evidence or blocked judgment for a new question must include at least one structured open_questions entry.",
				);
			}

			if (
				state.pendingQuestions.length > 0 &&
				params.question_updates === undefined
			) {
				fail(
					"Pending questions exist. Include question_updates (an empty array is valid) after rechecking them against this route's evidence.",
				);
			}
			const questionUpdates = buildQuestionUpdates(
				params.question_updates ?? [],
				state,
			);
			const updatedQuestionIds = new Set(
				questionUpdates.map((update) => update.questionId),
			);
			if (
				openedQuestions.some((question) => updatedQuestionIds.has(question.id))
			) {
				fail("A question cannot be opened and updated in the same judgment.");
			}
			const reopensCurrentQuestion = openedQuestions.some(
				(question) =>
					normalizedQuestion(question.question) ===
					normalizedQuestion(activeRoute.question),
			);
			if (!remainsOpen && reopensCurrentQuestion) {
				fail(
					"A resolved or not-applicable judgment cannot reopen its own question.",
				);
			}
			const targetQuestionId = activeRoute.targetQuestionId;
			const targetUpdate = targetQuestionId
				? questionUpdates.find(
						(update) => update.questionId === targetQuestionId,
					)
				: undefined;
			if (targetQuestionId && !targetUpdate) {
				fail(
					`Focused question ${targetQuestionId} requires an explicit question_updates entry.`,
				);
			}
			if (targetUpdate) {
				const closesTarget =
					targetUpdate.status === "resolved" ||
					targetUpdate.status === "not-applicable";
				if (!remainsOpen && !closesTarget) {
					fail(
						"A resolved focused judgment must explicitly resolve or dismiss its question.",
					);
				}
				if (remainsOpen && openedQuestions.length === 0 && closesTarget) {
					fail(
						"A focused question cannot close while its judgment reports no replacement evidence question.",
					);
				}
				if (remainsOpen && openedQuestions.length > 0 && !closesTarget) {
					fail(
						"Replacement questions require explicitly resolving or dismissing the broader focused question.",
					);
				}
			}

			const event: JudgmentEvent = {
				protocol: PROTOCOL,
				kind: "judgment",
				routeId: params.route_id,
				question: activeRoute.question,
				target: activeRoute.target,
				status: params.status,
				result,
				basis,
				referenceBasis,
				referenceExemption,
				openedQuestions,
				questionUpdates,
				artifacts: (params.artifacts ?? [])
					.map((item) => item.trim())
					.filter(Boolean),
				changedArtifacts: routesWithMutation.has(params.route_id),
			};
			if (!canApplyDeveloperEvent(state, event)) {
				fail(
					"Developer machine guard rejected the judgment transition from the current active route.",
				);
			}
			const nextState = applyDeveloperEvent(state, event);
			if (nextState.pendingQuestions.length > MAX_PENDING_QUESTIONS) {
				fail(
					`Developer protocol would retain ${nextState.pendingQuestions.length} pending questions; resolve or consolidate them before opening more.`,
				);
			}

			const immediateQuestion =
				ctx.mode === "tui"
					? firstImmediateUserQuestion(
							state.pendingQuestions,
							event.openedQuestions,
						)
					: undefined;
			let immediateDisposition: ImmediateQuestionDisposition | undefined;
			if (immediateQuestion) {
				try {
					immediateDisposition = await promptImmediateUserQuestion(
						ctx,
						immediateQuestion,
					);
				} catch {
					ctx.ui.notify(
						"Could not open the Developer decision prompt; the question remains open.",
						"warning",
					);
				}
			}

			const nextMessage = judgmentNextMessage(event, nextState);
			const resolvedQuestionCount = event.questionUpdates.filter(
				(update) =>
					update.status === "resolved" || update.status === "not-applicable",
			).length;
			const response =
				`Recorded ${event.status} judgment for ${event.routeId}: ${event.result}\n` +
				`Question updates: ${resolvedQuestionCount} resolved, ${event.questionUpdates.length - resolvedQuestionCount} retained or blocked.\n` +
				nextMessage +
				immediateQuestionMessage(immediateQuestion, immediateDisposition);
			ensureSafeToolText(response, "Developer judgment result");

			routesWithMutation.delete(params.route_id);
			state = nextState;
			syncProtocolTools();
			refreshUI(ctx);
			return textResult(response, event);
		},
		renderCall(args, theme, context) {
			const status =
				typeof args.status === "string" && args.status.length > 0
					? args.status
					: "…";
			const result =
				typeof args.result === "string" && args.result.length > 0
					? compactJudgmentResult(args.result)
					: "…";
			const statusText =
				status === "resolved"
					? theme.fg("success", status)
					: status === "needs-evidence"
						? theme.fg("warning", status)
						: status === "blocked"
							? theme.fg("error", status)
							: theme.fg("muted", status);
			return reusableText(
				`${theme.fg("toolTitle", theme.bold(JUDGMENT_TOOL))} ${statusText} ${theme.fg("muted", result)}`,
				context.lastComponent,
			);
		},
		renderResult(result, { expanded, isPartial }, theme, context) {
			if (isPartial) {
				return reusableText(
					theme.fg("warning", "recording development judgment…"),
					context.lastComponent,
				);
			}
			if (context.isError) {
				return reusableText(
					theme.fg("error", resultText(result) || "Developer judgment failed"),
					context.lastComponent,
				);
			}
			const normalized = normalizeDeveloperEvent(result.details);
			const event = normalized?.kind === "judgment" ? normalized : undefined;
			const summary = judgmentRenderText(event);
			let text =
				event?.status === "resolved"
					? theme.fg("success", summary)
					: event?.status === "needs-evidence"
						? theme.fg("warning", summary)
						: event?.status === "blocked"
							? theme.fg("error", summary)
							: theme.fg("muted", summary);
			if (expanded && event) return expandedJudgment(event, text, theme);
			if (event) text += ` · ${keyHint("app.tools.expand", "details")}`;
			return reusableText(text, context.lastComponent);
		},
	});

	const refreshAvailableSkills = (ctx: ExtensionCommandContext) => {
		if (typeof ctx.getSystemPromptOptions !== "function") return;
		availableSkills = availablePackageSkills(
			ctx.getSystemPromptOptions().skills ?? [],
			skillsRoot,
		);
	};

	const statusMessage = () => {
		const active = state.activeRoute
			? `${state.activeRoute.routeId} · ${state.activeRoute.target} · ${state.activeRoute.question}`
			: "none";
		const pending =
			state.pendingQuestions.length > 0
				? state.pendingQuestions
						.map(
							(question) =>
								`${question.id} · ${question.status} · ${question.resolutionOwner}/${question.gate} · ${question.question} · resolves when: ${question.resolutionCriteria}`,
						)
						.join(" | ")
				: "none";
		const last = state.lastJudgment
			? `${state.lastJudgment.status} · ${state.lastJudgment.result}`
			: "none";
		const basis =
			state.lastJudgment && state.lastJudgment.basis.length > 0
				? state.lastJudgment.basis.join(" | ")
				: "none";
		const artifacts =
			state.lastJudgment && state.lastJudgment.artifacts.length > 0
				? state.lastJudgment.artifacts.join(" | ")
				: "none";
		const history =
			state.judgmentHistory.length > 0
				? state.judgmentHistory
						.slice(-10)
						.map((judgment) => {
							const route = state.routeHistory.find(
								(candidate) => candidate.routeId === judgment.routeId,
							);
							const alternatives = (route?.consideredAlternatives ?? [])
								.map(
									(alternative) =>
										`${alternative.target}: ${alternative.reason}`,
								)
								.join("; ");
							return `${judgment.target} · ${judgment.status} · ${judgment.result}${
								alternatives ? ` · considered ${alternatives}` : ""
							}`;
						})
						.join("\n")
				: "none";
		return (
			`${summarizeState(state)}` +
			`\nactive: ${active}` +
			`\nlast: ${last}` +
			`\nbasis: ${basis}` +
			`\nartifacts: ${artifacts}` +
			`\nimplementation framing: ${state.implementationFramingRequired ? "required" : "clear"}` +
			`\ncheckpoint: ${state.rerouteRequired ? "reroute required" : "ready"}` +
			`\nverification: ${state.verificationRequired ? "required" : "current"}` +
			`\nhistory:\n${history}` +
			`\nactive tools: ${pi.getActiveTools().join(", ")}` +
			`\navailable skills: ${[...availableSkills.keys()].join(", ") || "none"}` +
			`\npending: ${pending}` +
			"\nprotocol state is not a product-completion claim"
		);
	};

	pi.registerCommand("develop", {
		description:
			"Control or inspect Developer: /develop on | status | questions | off",
		getArgumentCompletions(prefix) {
			const normalized = prefix.trim();
			const matches = DEVELOPER_COMMAND_ACTIONS.filter((action) =>
				action.startsWith(normalized),
			);
			return matches.length > 0
				? matches.map((action) => ({ value: action, label: action }))
				: null;
		},
		handler: async (args, ctx) => {
			const submitQuestionResolution = async (
				question: PendingQuestion,
			): Promise<boolean> => {
				const request = await editQuestionResolutionRequest(ctx, question);
				if (request === undefined) return false;
				const focusEvent: FocusEvent = {
					protocol: PROTOCOL,
					kind: "focus",
					questionId: question.id,
				};
				pi.appendEntry(FOCUS_ENTRY, focusEvent);
				state = applyDeveloperEvent(state, focusEvent);
				refreshUI(ctx);
				ctx.ui.setEditorText("");
				ctx.ui.notify(
					"Question response submitted. It remains open until Developer records a resolved or not-applicable judgment.",
					"info",
				);
				if (ctx.isIdle()) pi.sendUserMessage(request);
				else pi.sendUserMessage(request, { deliverAs: "followUp" });
				return true;
			};

			const setAndNotifyEnabled = (enabled: boolean): boolean => {
				if (!setEnabled(enabled, ctx)) return false;
				ctx.ui.notify(`Developer: ${enabled ? "on" : "off"}`, "info");
				return true;
			};

			const turnOff = async (): Promise<boolean> => {
				if (
					ctx.mode === "tui" &&
					(state.activeRoute || state.pendingQuestions.length > 0)
				) {
					const work = [
						...(state.activeRoute ? ["the active route"] : []),
						...(state.pendingQuestions.length > 0
							? [`${state.pendingQuestions.length} open question(s)`]
							: []),
					].join(" and ");
					const confirmed = await ctx.ui.confirm(
						"Turn off Developer?",
						`This clears ${work} from the current protocol state. Existing session history remains.`,
					);
					if (!confirmed) return false;
				}
				setAndNotifyEnabled(false);
				return true;
			};

			const inspectStatus = async () => {
				if (toolPolicyRestartRequired) {
					ctx.ui.notify(TOOL_POLICY_RESTART_MESSAGE, "error");
					refreshUI(ctx);
					return;
				}
				refreshAvailableSkills(ctx);
				if (ctx.mode === "tui") {
					await showDeveloperStatus(ctx, {
						state,
						activeTools: pi.getActiveTools(),
						availableSkills: [...availableSkills.keys()],
					});
				} else {
					ctx.ui.notify(statusMessage(), "info");
				}
			};

			const inspectHistory = async (): Promise<void> => {
				if (state.judgmentHistory.length === 0) {
					ctx.ui.notify(
						"Developer has no judgment history on this branch.",
						"info",
					);
					return;
				}
				let selectedRouteId: string | undefined;
				while (true) {
					const routeId = await showDeveloperHistorySelector(
						ctx,
						state,
						selectedRouteId,
					);
					if (!routeId) return;
					selectedRouteId = routeId;
					const entry = developerHistoryEntries(state).find(
						(candidate) => candidate.id === routeId,
					);
					if (!entry) continue;
					await showDeveloperHistoryDetail(ctx, entry);
				}
			};

			const answerPendingQuestion = async (): Promise<boolean> => {
				if (state.pendingQuestions.length === 0) {
					ctx.ui.notify(
						"Developer has no open questions on the current branch.",
						"info",
					);
					return false;
				}
				if (ctx.mode === "tui") {
					const soleQuestion =
						state.pendingQuestions.length === 1
							? state.pendingQuestions[0]
							: undefined;
					if (soleQuestion) return submitQuestionResolution(soleQuestion);
					while (true) {
						const questionId = await showPendingQuestionSelector(
							ctx,
							state.pendingQuestions,
						);
						if (!questionId) return false;
						const question = state.pendingQuestions.find(
							(item) => item.id === questionId,
						);
						if (!question) return false;
						if (await submitQuestionResolution(question)) return true;
					}
				}
				ctx.ui.notify(
					state.pendingQuestions
						.map(
							(question) =>
								`${question.id} · ${question.status} · ${question.resolutionOwner}/${question.gate} · ${question.question}\n  resolves when: ${question.resolutionCriteria}`,
						)
						.join("\n"),
					"info",
				);
				return false;
			};

			const action = args.trim();
			if (!action && ctx.mode === "tui") {
				refreshAvailableSkills(ctx);
				while (true) {
					const selection = await showDeveloperSettings(ctx, {
						read: () => state,
						commitActivation(enabled) {
							setAndNotifyEnabled(enabled);
							return state;
						},
					});
					if (!selection) return;
					if (selection.kind === "questions") {
						if (await answerPendingQuestion()) return;
						continue;
					}
					if (selection.kind === "history") {
						await inspectHistory();
						continue;
					}
					await inspectStatus();
				}
			}

			if (!action || action === "status") {
				await inspectStatus();
				return;
			}
			if (action === "on") {
				setAndNotifyEnabled(true);
				return;
			}
			if (action === "off") {
				await turnOff();
				return;
			}
			if (action === "questions") {
				await answerPendingQuestion();
				return;
			}
			ctx.ui.notify("Usage: /develop on | status | questions | off", "warning");
		},
	});

	const entryRendererAPI = pi as ExtensionAPI & {
		registerEntryRenderer?: ExtensionAPI["registerEntryRenderer"];
	};
	entryRendererAPI.registerEntryRenderer?.(
		ACTIVATION_ENTRY,
		(entry, _options, theme) => {
			const event = normalizeDeveloperEvent(entry.data);
			if (!event || event.kind !== "activation") return undefined;
			return new Text(
				`${theme.fg("toolTitle", theme.bold("Developer"))} ${theme.fg("accent", event.enabled ? "on" : "off")}`,
				0,
				0,
			);
		},
	);

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

	pi.on("context", (event) => {
		if (!state.enabled) return;
		const projection = projectCompactionContinuity(
			event.messages,
			compactionLanguage,
		);
		if (!projection) return;
		compactionLanguage = projection.state;
		return { messages: projection.messages as typeof event.messages };
	});

	pi.on("before_agent_start", (event) => {
		availableSkills = availablePackageSkills(
			event.systemPromptOptions.skills ?? [],
			skillsRoot,
		);
		if (!state.enabled) return;
		return {
			systemPrompt:
				event.systemPrompt + protocolPrompt(state, [...availableSkills.keys()]),
		};
	});

	pi.on("tool_call", (event) => {
		if (
			state.enabled &&
			event.toolName === "read" &&
			state.activeRoute?.target !== "implementation"
		) {
			const activeSkill = state.activeRoute
				? availableSkills.get(state.activeRoute.target)
				: undefined;
			const requestedPath = event.input.path;
			if (
				activeSkill &&
				typeof requestedPath === "string" &&
				isWithinRoot(
					resolve(activeSkill.baseDir, "references"),
					resolve(requestedPath),
				)
			) {
				return {
					block: true,
					reason: `Developer skill references must be loaded through ${REFERENCE_TOOL} with a policy route so provenance and application remain auditable.`,
				};
			}
		}

		const capability = builtinControlledToolCapabilities(pi.getAllTools()).get(
			event.toolName,
		);
		if (!capability) return;

		const access = protocolToolAccess(state);
		if (
			isControlledToolAllowed({ enabled: state.enabled, capability, access })
		) {
			if (access.allowsArtifactTools && state.activeRoute)
				routesWithMutation.add(state.activeRoute.routeId);
			return;
		}

		const implementationBlockers = state.pendingQuestions.filter(
			(question) => question.gate === "before-implementation",
		);
		if (implementationBlockers.length > 0) {
			const blockedAction =
				capability === "shell"
					? "unrouted shell execution"
					: "artifact mutation";
			return {
				block: true,
				reason: `Developer question gate blocks ${blockedAction} until resolved: ${implementationBlockers
					.map(
						(question) =>
							`${question.id} (${question.resolutionOwner}: ${question.question})`,
					)
					.join(
						"; ",
					)}. A non-implementation judgment route may still use bash to obtain evidence.`,
			};
		}

		return {
			block: true,
			reason:
				capability === "shell"
					? "Developer requires an active judgment or implementation route before Pi built-in bash can execute evidence checks."
					: `Developer requires an active ${ROUTE_TOOL} targeting implementation (target=implementation) before Pi built-in edit or write.`,
		};
	});

	pi.on("session_start", (event, ctx) => {
		const branch = ctx.sessionManager.getBranch();
		toolPolicyRestartRequired =
			event.reason === "reload" &&
			toolPolicyReloadRequiresRestart({
				entries: branch,
				protocol: PROTOCOL,
				protocolTools: PROTOCOL_TOOLS,
			});
		reconstruct(ctx);
		if (toolPolicyRestartRequired) {
			ctx.ui.notify(TOOL_POLICY_RESTART_MESSAGE, "error");
			return;
		}
		const startEnabled = pi.getFlag("develop");
		if (startEnabled === true && !state.enabled) setEnabled(true, ctx);
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
				reloadSafeToolPolicyMarker(PROTOCOL),
			);
		}
		ctx.ui.setStatus("developer", undefined);
		ctx.ui.setWidget("developer", undefined);
	});
}
