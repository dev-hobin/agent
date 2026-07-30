import {
	formatInvariantHandling,
	protocolState,
	type DeveloperState,
	type JudgmentEvent,
	type PendingQuestion,
	type ReferenceBasis,
	type RouteEvent,
} from "./state.ts";

export type DeveloperWorkbenchSectionId =
	| "overview"
	| "route"
	| "questions"
	| "judgments"
	| "landings"
	| "settings";

export type DeveloperWorkbenchQuestionAction =
	| "answer"
	| "investigate"
	| "provide-evidence"
	| "classify";

export interface DeveloperWorkbenchDetailBlock {
	readonly heading: string;
	readonly lines: readonly string[];
}

export interface DeveloperWorkbenchItem {
	readonly id: string;
	readonly label: string;
	readonly title: string;
	readonly summary: string;
	readonly state?: string;
	readonly questionAction?: DeveloperWorkbenchQuestionAction;
	readonly blocks: readonly DeveloperWorkbenchDetailBlock[];
}

export interface DeveloperWorkbenchSection {
	readonly id: DeveloperWorkbenchSectionId;
	readonly label: string;
	readonly value: string;
	readonly items: readonly DeveloperWorkbenchItem[];
}

export interface DeveloperWorkbenchRuntime {
	readonly activeTools: readonly string[];
	readonly availableSkills: readonly string[];
	readonly restartIssue?: string;
}

export interface DeveloperWorkbenchSnapshot {
	readonly enabled: boolean;
	readonly protocol: ReturnType<typeof protocolState>;
	readonly authority: string;
	readonly activeTarget: string;
	readonly nextAction: string;
	readonly restartIssue?: string;
	readonly sections: readonly DeveloperWorkbenchSection[];
}

function listLines(values: readonly string[]): readonly string[] {
	return values.length > 0 ? values : ["None"];
}

function alternatives(route: RouteEvent): readonly string[] {
	return listLines(
		route.consideredAlternatives.map(
			(value) => `${value.target}: ${value.reason}`,
		),
	);
}

function loadedReferences(route: RouteEvent): readonly string[] {
	return listLines(
		route.loadedReferences.map(
			(value) =>
				`${value.path} · routes ${value.referenceRouteIds.join(", ") || "legacy"} · sha256 ${value.contentSha256}`,
		),
	);
}

function referenceRoutes(route: RouteEvent): readonly string[] {
	return listLines(
		route.referenceRoutes.map(
			(value) =>
				`${value.id}: ${value.question} · ${value.references.join(" + ")} · order ${value.readOrder}`,
		),
	);
}

function implementationContract(route: RouteEvent): readonly string[] {
	const step = route.implementationStep;
	if (!step) return ["None"];
	return [
		`Movement: ${step.movement}`,
		`Stop condition: ${step.stopCondition}`,
		`Verification: ${step.verification}`,
		`Invariant handling: ${formatInvariantHandling(step.invariantHandling)}`,
	];
}

function routeBlocks(
	route: RouteEvent,
): readonly DeveloperWorkbenchDetailBlock[] {
	return [
		{
			heading: "Route contract",
			lines: [
				`Route ID: ${route.routeId}`,
				`Target: ${route.target}`,
				`Question: ${route.question}`,
				`Reason: ${route.reason}`,
				`Method: ${route.methodLocation ?? "implementation action"}`,
				`Execution profile: ${route.executionProfile ?? "none"}`,
			],
		},
		{ heading: "Known evidence", lines: listLines(route.knownEvidence) },
		{ heading: "Considered alternatives", lines: alternatives(route) },
		{ heading: "Reference routes", lines: referenceRoutes(route) },
		{ heading: "Loaded references", lines: loadedReferences(route) },
		{ heading: "Implementation landing", lines: implementationContract(route) },
	];
}

function authority(
	state: DeveloperState,
	runtime: DeveloperWorkbenchRuntime,
): string {
	if (runtime.restartIssue) return "Blocked until Pi restarts";
	if (!state.enabled) return "Developer off";
	if (state.activeRoute?.target === "implementation")
		return "One bounded implementation movement";
	if (state.activeRoute) return "Inspection and evidence only";
	return "No Developer-owned mutation authority";
}

function nextAction(
	state: DeveloperState,
	runtime: DeveloperWorkbenchRuntime,
): string {
	if (runtime.restartIssue)
		return "Restart Pi before enabling Developer again.";
	if (!state.enabled) return "Enable Developer before asking it to route work.";
	if (state.activeRoute)
		return `Complete the active ${state.activeRoute.target} judgment before opening another route.`;
	const blocked = state.pendingQuestions.find(
		(question) =>
			question.status === "blocked" ||
			question.gate === "before-implementation",
	);
	if (blocked) return `Resolve the blocking question: ${blocked.question}`;
	const userQuestion = state.pendingQuestions.find(
		(question) => question.resolutionOwner === "user",
	);
	if (userQuestion)
		return `Obtain the required user answer: ${userQuestion.question}`;
	if (state.pendingQuestions.length > 0)
		return `Collect evidence for ${state.pendingQuestions.length} open question(s).`;
	if (state.implementationFramingRequired)
		return "Frame the implementation movement before mutation.";
	if (state.rerouteRequired)
		return "Reobserve the latest landing and route from the new evidence.";
	if (state.verificationRequired)
		return "Verify the changed artifacts before claiming completion.";
	return "No Developer judgment is active; continue the product task normally.";
}

function questionAction(
	question: PendingQuestion,
): DeveloperWorkbenchQuestionAction {
	if (question.resolutionOwner === "user") return "answer";
	if (question.resolutionOwner === "agent") return "investigate";
	if (question.resolutionOwner === "environment") return "provide-evidence";
	return "classify";
}

function questionItem(question: PendingQuestion): DeveloperWorkbenchItem {
	const answerShape =
		question.responseSpec?.fields.flatMap((field) => [
			`${field.id}: ${field.prompt}`,
			...field.options.map(
				(option) =>
					`  ${option.value}: ${option.label}${option.detailPrompt ? ` · asks: ${option.detailPrompt}` : ""}`,
			),
		]) ?? [];
	return {
		id: question.id,
		label: question.resolutionOwner,
		title: question.question,
		summary: question.resolutionCriteria,
		state: `${question.status} · ${question.gate}`,
		questionAction: questionAction(question),
		blocks: [
			{
				heading: "Resolution contract",
				lines: [
					`Question ID: ${question.id}`,
					`Owner: ${question.resolutionOwner}`,
					`Status: ${question.status}`,
					`Gate: ${question.gate}`,
					`Source route: ${question.sourceRouteId}`,
					`Resolves when: ${question.resolutionCriteria}`,
				],
			},
			{
				heading: "Decision or evidence context",
				lines: question.context ? [question.context] : ["None recorded"],
			},
			{
				heading: "Answer shape",
				lines:
					answerShape.length > 0
						? answerShape
						: ["Free-form answer or evidence"],
			},
		],
	};
}

function referenceBasis(values: readonly ReferenceBasis[]): readonly string[] {
	return listLines(
		values.map(
			(value) =>
				`${value.path} · trigger: ${value.trigger} · rule: ${value.appliedRule} · artifact: ${value.artifact}`,
		),
	);
}

function judgmentItem(
	judgment: JudgmentEvent,
	route: RouteEvent | undefined,
): DeveloperWorkbenchItem {
	return {
		id: judgment.routeId,
		label: judgment.target,
		title: judgment.question,
		summary: judgment.result,
		state: judgment.status,
		blocks: [
			{
				heading: "Judgment",
				lines: [
					`Route ID: ${judgment.routeId}`,
					`Status: ${judgment.status}`,
					`Changed artifacts: ${judgment.changedArtifacts ? "yes" : "no"}`,
					judgment.result,
				],
			},
			{ heading: "Basis", lines: listLines(judgment.basis) },
			{ heading: "Artifacts", lines: listLines(judgment.artifacts) },
			{
				heading: "Reference basis",
				lines: referenceBasis(judgment.referenceBasis),
			},
			{
				heading: "Reference exemption",
				lines: judgment.referenceExemption
					? [
							judgment.referenceExemption.reason,
							...judgment.referenceExemption.evidence,
						]
					: ["None"],
			},
			{
				heading: "Question movement",
				lines: listLines([
					...judgment.openedQuestions.map(
						(question) => `opened ${question.id}: ${question.question}`,
					),
					...judgment.questionUpdates.map(
						(update) =>
							`${update.status} ${update.questionId}: ${update.result}`,
					),
				]),
			},
			...(route
				? [
						{
							heading: "Route rationale",
							lines: [route.reason, ...alternatives(route)],
						},
					]
				: []),
		],
	};
}

function landingItem(
	judgment: JudgmentEvent,
	route: RouteEvent | undefined,
	verificationRequired: boolean,
): DeveloperWorkbenchItem {
	return {
		id: judgment.routeId,
		label: "Implementation",
		title: route?.implementationStep?.movement ?? judgment.question,
		summary: judgment.result,
		state: judgment.changedArtifacts ? "changed" : "no change",
		blocks: [
			{
				heading: "Stable landing",
				lines: route ? implementationContract(route) : ["Contract unavailable"],
			},
			{
				heading: "Judgment",
				lines: [
					`Status: ${judgment.status}`,
					`Changed artifacts: ${judgment.changedArtifacts ? "yes" : "no"}`,
					judgment.result,
				],
			},
			{ heading: "Basis", lines: listLines(judgment.basis) },
			{
				heading: "Artifacts and verifier",
				lines: listLines(judgment.artifacts),
			},
			{
				heading: "Verification boundary",
				lines: [
					`Current branch verification debt: ${verificationRequired ? "required" : "clear"}`,
					"The current event schema does not link a specific verification judgment to this landing, so no per-landing Verified claim is inferred.",
				],
			},
		],
	};
}

function overviewItem(
	state: DeveloperState,
	runtime: DeveloperWorkbenchRuntime,
): DeveloperWorkbenchItem {
	const currentProtocol = protocolState(state);
	return {
		id: "current-branch",
		label: "Current branch",
		title: state.activeRoute?.question ?? "No active judgment route",
		summary: nextAction(state, runtime),
		state: currentProtocol,
		blocks: [
			{
				heading: "Current obligation",
				lines: [
					`Developer: ${state.enabled ? "on" : "off"}`,
					`Protocol: ${currentProtocol}`,
					`Authority: ${authority(state, runtime)}`,
					`Active target: ${state.activeRoute?.target ?? "none"}`,
					`Open questions: ${state.pendingQuestions.length}`,
					`Recorded judgments: ${state.judgmentHistory.length}`,
				],
			},
			{
				heading: "Gates",
				lines: [
					`Implementation framing: ${state.implementationFramingRequired ? "required" : "clear"}`,
					`Reroute checkpoint: ${state.rerouteRequired ? "required" : "clear"}`,
					`Verification: ${state.verificationRequired ? "required" : "current"}`,
				],
			},
			{ heading: "Next", lines: [nextAction(state, runtime)] },
			...(runtime.restartIssue
				? [{ heading: "Runtime recovery", lines: [runtime.restartIssue] }]
				: []),
			{
				heading: "Runtime resources",
				lines: [
					`Active tools (${runtime.activeTools.length}): ${[...runtime.activeTools].sort().join(", ") || "none"}`,
					`Available skills (${runtime.availableSkills.length}): ${[...runtime.availableSkills].sort().join(", ") || "none"}`,
				],
			},
			{
				heading: "Interpretation boundary",
				lines: [
					"Developer protocol state is routing bookkeeping, not a product-completion claim.",
				],
			},
		],
	};
}

export function inspectDeveloperWorkbench(
	state: DeveloperState,
	runtime: DeveloperWorkbenchRuntime,
): DeveloperWorkbenchSnapshot {
	const currentProtocol = protocolState(state);
	const activeRoute = state.activeRoute;
	const questions = state.pendingQuestions.map(questionItem);
	const judgments = state.judgmentHistory.toReversed().map((judgment) =>
		judgmentItem(
			judgment,
			state.routeHistory.find((route) => route.routeId === judgment.routeId),
		),
	);
	const landings = state.judgmentHistory
		.filter((judgment) => judgment.target === "implementation")
		.toReversed()
		.map((judgment) =>
			landingItem(
				judgment,
				state.routeHistory.find((route) => route.routeId === judgment.routeId),
				state.verificationRequired,
			),
		);
	const settings: DeveloperWorkbenchItem = {
		id: "settings",
		label: "Activation",
		title: state.enabled ? "On" : "Off",
		summary:
			"Settings changes activation; current branch work is inspected elsewhere in this workbench.",
		blocks: [
			{
				heading: "Developer activation",
				lines: [
					`Current value: ${state.enabled ? "On" : "Off"}`,
					"Turning Developer off with active work requires confirmation in interactive mode.",
				],
			},
		],
	};
	return {
		enabled: state.enabled,
		protocol: currentProtocol,
		authority: authority(state, runtime),
		activeTarget: activeRoute?.target ?? "none",
		nextAction: nextAction(state, runtime),
		restartIssue: runtime.restartIssue,
		sections: [
			{
				id: "overview",
				label: "Overview",
				value: currentProtocol,
				items: [overviewItem(state, runtime)],
			},
			{
				id: "route",
				label: "Active route",
				value: activeRoute?.target ?? "None",
				items: activeRoute
					? [
							{
								id: activeRoute.routeId,
								label: activeRoute.target,
								title: activeRoute.question,
								summary: activeRoute.reason,
								state: "active",
								blocks: routeBlocks(activeRoute),
							},
						]
					: [],
			},
			{
				id: "questions",
				label: "Questions",
				value: String(questions.length),
				items: questions,
			},
			{
				id: "judgments",
				label: "Judgments",
				value: String(judgments.length),
				items: judgments,
			},
			{
				id: "landings",
				label: "Landings",
				value: String(landings.length),
				items: landings,
			},
			{
				id: "settings",
				label: "Settings",
				value: "",
				items: [settings],
			},
		],
	};
}
