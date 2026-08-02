import {
	developerNextOperations,
	developerProtocolState,
	type CompletedJudgment,
	type CompletedLanding,
	type DeveloperState,
	type PendingQuestion,
} from "../src/index.ts";

export type DeveloperWorkbenchSectionId =
	| "overview"
	| "work"
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
	readonly protocol: ReturnType<typeof developerProtocolState>;
	readonly authority: string;
	readonly activeTarget: string;
	readonly nextAction: string;
	readonly restartIssue?: string;
	readonly sections: readonly DeveloperWorkbenchSection[];
}

function lines(values: readonly string[]): readonly string[] {
	return values.length > 0 ? values : ["None"];
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
	return {
		id: question.id,
		label: question.id,
		title: question.question,
		summary: `${question.resolutionOwner} · ${question.gate}`,
		state: question.status,
		questionAction: questionAction(question),
		blocks: [
			{
				heading: "Resolution",
				lines: [
					`Owner: ${question.resolutionOwner}`,
					`Gate: ${question.gate}`,
					`Criteria: ${question.resolutionCriteria}`,
					`Source work: ${question.sourceWorkId}`,
				],
			},
			...(question.context
				? [{ heading: "Context", lines: [question.context] }]
				: []),
			...(question.responseSpec
				? [
						{
							heading: "Response fields",
							lines: question.responseSpec.fields.map(
								(field) =>
									`${field.id}: ${field.prompt} (${field.options.map((option) => option.label).join(" | ")})`,
							),
						},
					]
				: []),
		],
	};
}

function judgmentItem(entry: CompletedJudgment): DeveloperWorkbenchItem {
	const conclusion = entry.conclusion;
	const artifact =
		conclusion.kind === "contextual-judgment" ||
		conclusion.kind === "emergent-question"
			? conclusion.artifact
			: conclusion.kind === "needs-evidence"
				? (conclusion.artifact ?? conclusion.evidenceNeeded.join("; "))
				: conclusion.reason;
	const contextLines =
		conclusion.kind === "judgment-not-applicable"
			? [
					"No dynamic context closure was required for this applicability result.",
				]
			: [
					`Judgment: ${conclusion.contextBasis.judgmentId}`,
					`Policy: ${conclusion.contextBasis.policySha256 ?? "absent"}`,
					`Question: ${conclusion.contextBasis.questionSha256}`,
					`Selection: ${conclusion.contextBasis.selectionSha256}`,
					`Coverage: ${conclusion.contextBasis.coverageSha256}`,
					`Outcome: ${conclusion.contextBasis.outcomeSha256}`,
					`Contributions: ${conclusion.contextBasis.contributions.map((contribution) => `${contribution.useAs}/${contribution.assurance}`).join(", ") || "none"}`,
				];
	return {
		id: entry.judgment.judgmentId,
		label: entry.judgment.skill.name,
		title: entry.judgment.question,
		summary: artifact,
		state: conclusion.kind,
		blocks: [
			{
				heading: "Method",
				lines: [
					`Skill: ${entry.judgment.skill.name}`,
					`Reason: ${entry.judgment.reason}`,
					`Known evidence: ${lines(entry.judgment.knownEvidence).join(" | ")}`,
				],
			},
			{ heading: "Context basis", lines: contextLines },
			{
				heading: "Artifacts and questions",
				lines: [
					`Produced: ${lines(conclusion.producedArtifacts).join(" | ")}`,
					`Opened: ${lines(conclusion.openedQuestions.map((question) => question.id)).join(" | ")}`,
					`Updated: ${lines(conclusion.questionUpdates.map((update) => `${update.questionId}/${update.status}`)).join(" | ")}`,
				],
			},
		],
	};
}

function landingItem(
	entry: CompletedLanding,
	verificationRequired: boolean,
): DeveloperWorkbenchItem {
	return {
		id: entry.change.authorizationId,
		label: "landing",
		title: entry.change.contract.stableLanding,
		summary: entry.landing.result,
		state: verificationRequired ? "verification required" : "verified",
		blocks: [
			{
				heading: "Authorization",
				lines: [
					`Movement: ${entry.change.contract.movement}`,
					`Stable landing: ${entry.change.contract.stableLanding}`,
					`Verification target: ${entry.change.contract.verificationTarget}`,
				],
			},
			{
				heading: "Landing evidence",
				lines: [
					`Changed paths: ${entry.landing.changedPaths.join(", ")}`,
					`Result: ${entry.landing.result}`,
					`Verification: ${lines(entry.landing.verification).join(" | ")}`,
				],
			},
		],
	};
}

function authority(state: DeveloperState): string {
	if (!state.enabled) return "Developer is off; Pi owns the ordinary tool set.";
	if (state.activeWork?.kind === "authorized-change") {
		return `Mutation authorized by ${state.activeWork.authorizationId}.`;
	}
	if (state.activeWork?.kind === "active-judgment") {
		return `Evidence tools only for ${state.activeWork.judgmentId}; artifact mutation is withheld.`;
	}
	return "No change is authorized; controlled shell and artifact tools are withheld.";
}

function nextAction(state: DeveloperState, restartIssue?: string): string {
	if (restartIssue) return restartIssue;
	if (!state.enabled)
		return "Turn Developer on to open judgment or authorize change.";
	const operations = developerNextOperations(state);
	if (operations.length > 0) return operations.join(" or ");
	return "No Developer operation is currently legal.";
}

function overviewItem(
	state: DeveloperState,
	runtime: DeveloperWorkbenchRuntime,
): DeveloperWorkbenchItem {
	return {
		id: "developer-overview",
		label: "protocol",
		title: developerProtocolState(state),
		summary: nextAction(state, runtime.restartIssue),
		state: state.enabled ? "on" : "off",
		blocks: [
			{
				heading: "Authority",
				lines: runtime.restartIssue
					? ["Blocked until Pi restarts.", runtime.restartIssue]
					: [authority(state)],
			},
			{
				heading: "Obligations",
				lines: [
					`Reroute: ${state.obligations.rerouteRequired ? "required" : "clear"}`,
					`Implementation framing: ${state.obligations.implementationFramingRequired ? "required" : "clear"}`,
					`Verification: ${state.obligations.verificationRequired ? "required" : "current"}`,
				],
			},
			{
				heading: "Runtime",
				lines: [
					`Active tools: ${lines(runtime.activeTools).join(", ")}`,
					`Available skills: ${lines(runtime.availableSkills).join(", ")}`,
				],
			},
		],
	};
}

export function inspectDeveloperWorkbench(
	state: DeveloperState,
	runtime: DeveloperWorkbenchRuntime,
): DeveloperWorkbenchSnapshot {
	const active = state.activeWork;
	const activeItem: DeveloperWorkbenchItem[] = active
		? [
				active.kind === "active-judgment"
					? {
							id: active.judgmentId,
							label: "judgment",
							title: active.question,
							summary: `${active.skill.name} · ${active.reason}`,
							state: "active",
							blocks: [
								{
									heading: "Dynamic judgment",
									lines: [
										`Skill: ${active.skill.name}`,
										`Policy: ${active.policy?.policySha256 ?? "absent"}`,
										`Prepared references: ${active.policy?.references.length ?? 0}`,
									],
								},
							],
						}
					: {
							id: active.authorizationId,
							label: "authorized change",
							title: active.question,
							summary: active.contract.movement,
							state: "mutation authorized",
							blocks: [
								{
									heading: "Implementation contract",
									lines: [
										`Stable landing: ${active.contract.stableLanding}`,
										`Verification target: ${active.contract.verificationTarget}`,
									],
								},
							],
						},
			]
		: [];
	const sections: readonly DeveloperWorkbenchSection[] = [
		{
			id: "overview",
			label: "Overview",
			value: developerProtocolState(state),
			items: [overviewItem(state, runtime)],
		},
		{
			id: "work",
			label: "Active work",
			value: active ? "1" : "0",
			items: activeItem,
		},
		{
			id: "questions",
			label: "Questions",
			value: String(state.pendingQuestions.length),
			items: state.pendingQuestions.map(questionItem),
		},
		{
			id: "judgments",
			label: "Judgments",
			value: String(state.judgments.length),
			items: state.judgments.toReversed().map(judgmentItem),
		},
		{
			id: "landings",
			label: "Landings",
			value: String(state.landings.length),
			items: state.landings
				.toReversed()
				.map((entry) =>
					landingItem(entry, state.obligations.verificationRequired),
				),
		},
		{
			id: "settings",
			label: "Settings",
			value: state.enabled ? "on" : "off",
			items: [],
		},
	];
	return Object.freeze({
		enabled: state.enabled,
		protocol: developerProtocolState(state),
		authority: runtime.restartIssue
			? "Blocked until Pi restarts"
			: authority(state),
		activeTarget:
			active?.kind === "active-judgment"
				? active.skill.name
				: active?.kind === "authorized-change"
					? "implementation"
					: "none",
		nextAction: nextAction(state, runtime.restartIssue),
		...(runtime.restartIssue ? { restartIssue: runtime.restartIssue } : {}),
		sections,
	});
}
