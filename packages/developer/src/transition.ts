import {
	AUTHORIZE_CHANGE_TOOL,
	CONCLUDE_JUDGMENT_TOOL,
	OPEN_JUDGMENT_TOOL,
	RECORD_LANDING_TOOL,
	type ActiveJudgment,
	type AuthorizedChange,
	type DeveloperEvent,
	type ImplementationLanding,
	type JudgmentConclusion,
	type PendingQuestion,
	type QuestionUpdate,
} from "./protocol.ts";

export type ActiveDeveloperWork = ActiveJudgment | AuthorizedChange;

export interface DeveloperObligations {
	readonly rerouteRequired: boolean;
	readonly implementationFramingRequired: boolean;
	readonly verificationRequired: boolean;
}

export interface CompletedJudgment {
	readonly judgment: ActiveJudgment;
	readonly conclusion: JudgmentConclusion;
}

export interface CompletedLanding {
	readonly change: AuthorizedChange;
	readonly landing: ImplementationLanding;
}

export interface DeveloperState {
	readonly enabled: boolean;
	readonly activeWork?: ActiveDeveloperWork;
	readonly judgments: readonly CompletedJudgment[];
	readonly landings: readonly CompletedLanding[];
	readonly pendingQuestions: readonly PendingQuestion[];
	readonly focusedQuestionId?: string;
	readonly obligations: DeveloperObligations;
}

export type DeveloperTransitionErrorCode =
	| "developer.disabled"
	| "developer.work-overlap"
	| "developer.wrong-work-id"
	| "developer.duplicate-work-id"
	| "developer.question-missing"
	| "developer.question-duplicate"
	| "developer.question-update-duplicate"
	| "developer.question-update-missing"
	| "developer.question-source-mismatch"
	| "developer.context-basis-mismatch"
	| "developer.implementation-blocked"
	| "developer.implementation-framing-required"
	| "developer.conclusion-incomplete";

export interface DeveloperTransitionError {
	readonly code: DeveloperTransitionErrorCode;
	readonly message: string;
}

export type DeveloperTransitionResult =
	| { readonly ok: true; readonly state: DeveloperState }
	| { readonly ok: false; readonly error: DeveloperTransitionError };

const clearObligations = (): DeveloperObligations =>
	Object.freeze({
		rerouteRequired: false,
		implementationFramingRequired: false,
		verificationRequired: false,
	});

export function initialDeveloperState(): DeveloperState {
	return Object.freeze({
		enabled: false,
		judgments: Object.freeze([]),
		landings: Object.freeze([]),
		pendingQuestions: Object.freeze([]),
		obligations: clearObligations(),
	});
}

function immutableState(state: DeveloperState): DeveloperState {
	return Object.freeze({
		...state,
		judgments: Object.freeze([...state.judgments]),
		landings: Object.freeze([...state.landings]),
		pendingQuestions: Object.freeze([...state.pendingQuestions]),
		obligations: Object.freeze({ ...state.obligations }),
	});
}

function rejected(
	code: DeveloperTransitionErrorCode,
	message: string,
): DeveloperTransitionResult {
	return { ok: false, error: Object.freeze({ code, message }) };
}

function accepted(state: DeveloperState): DeveloperTransitionResult {
	return { ok: true, state: immutableState(state) };
}

function workId(work: ActiveDeveloperWork): string {
	return work.kind === "active-judgment"
		? work.judgmentId
		: work.authorizationId;
}

function knownWorkId(state: DeveloperState, id: string): boolean {
	return (
		(state.activeWork ? workId(state.activeWork) === id : false) ||
		state.judgments.some((entry) => entry.judgment.judgmentId === id) ||
		state.landings.some((entry) => entry.change.authorizationId === id)
	);
}

function openOrBlocked(question: PendingQuestion): boolean {
	return question.status === "open" || question.status === "blocked";
}

export function blocksImplementation(state: DeveloperState): boolean {
	return state.pendingQuestions.some(
		(question) =>
			openOrBlocked(question) && question.gate === "before-implementation",
	);
}

export function blocksCompletion(state: DeveloperState): boolean {
	return state.pendingQuestions.some(
		(question) => openOrBlocked(question) && question.gate !== "none",
	);
}

function hasQuestion(state: DeveloperState, questionId: string): boolean {
	return state.pendingQuestions.some((question) => question.id === questionId);
}

function validateTargetQuestion(
	state: DeveloperState,
	targetQuestionId: string | undefined,
): DeveloperTransitionResult | undefined {
	if (targetQuestionId && !hasQuestion(state, targetQuestionId)) {
		return rejected(
			"developer.question-missing",
			`Target question ${targetQuestionId} is not pending.`,
		);
	}
	return undefined;
}

function validateQuestionChanges(
	state: DeveloperState,
	conclusion: JudgmentConclusion,
): DeveloperTransitionResult | undefined {
	const openedIds = conclusion.openedQuestions.map((question) => question.id);
	if (new Set(openedIds).size !== openedIds.length) {
		return rejected(
			"developer.question-duplicate",
			"A conclusion cannot open the same question identity twice.",
		);
	}
	for (const question of conclusion.openedQuestions) {
		if (question.sourceWorkId !== conclusion.judgmentId) {
			return rejected(
				"developer.question-source-mismatch",
				`Question ${question.id} does not identify the concluding judgment as its source.`,
			);
		}
		if (hasQuestion(state, question.id)) {
			return rejected(
				"developer.question-duplicate",
				`Question ${question.id} is already pending; update it instead of reopening it.`,
			);
		}
	}
	const updatedIds = conclusion.questionUpdates.map(
		(update) => update.questionId,
	);
	if (new Set(updatedIds).size !== updatedIds.length) {
		return rejected(
			"developer.question-update-duplicate",
			"A conclusion cannot update the same question identity twice.",
		);
	}
	for (const questionId of updatedIds) {
		if (!hasQuestion(state, questionId)) {
			return rejected(
				"developer.question-update-missing",
				`Question ${questionId} is not pending.`,
			);
		}
	}
	if (
		conclusion.kind === "needs-evidence" &&
		conclusion.openedQuestions.length === 0 &&
		!conclusion.questionUpdates.some(
			(update) => update.status === "open" || update.status === "blocked",
		)
	) {
		return rejected(
			"developer.conclusion-incomplete",
			"A needs-evidence conclusion must leave an explicit pending question.",
		);
	}
	if (
		conclusion.kind === "emergent-question" &&
		conclusion.openedQuestions.length === 0
	) {
		return rejected(
			"developer.conclusion-incomplete",
			"An emergent-question conclusion must open its explicit pending question.",
		);
	}
	return undefined;
}

function contextBasisMatches(
	judgment: ActiveJudgment,
	conclusion: JudgmentConclusion,
): boolean {
	if (conclusion.kind === "judgment-not-applicable") return true;
	const basis = conclusion.contextBasis;
	return (
		basis.judgmentId === judgment.judgmentId &&
		basis.policySha256 === judgment.policy?.policySha256
	);
}

function updateQuestion(
	question: PendingQuestion,
	update: QuestionUpdate,
	workId: string,
): PendingQuestion | undefined {
	if (update.status === "resolved" || update.status === "not-applicable") {
		return undefined;
	}
	return Object.freeze({
		...question,
		status: update.status,
		sourceWorkId: workId,
	});
}

function questionsAfterConclusion(
	state: DeveloperState,
	conclusion: JudgmentConclusion,
): readonly PendingQuestion[] {
	const updates = new Map(
		conclusion.questionUpdates.map((update) => [update.questionId, update]),
	);
	const retained: PendingQuestion[] = [];
	for (const question of state.pendingQuestions) {
		const update = updates.get(question.id);
		if (!update) {
			retained.push(question);
			continue;
		}
		const next = updateQuestion(question, update, conclusion.judgmentId);
		if (next) retained.push(next);
	}
	return Object.freeze([...retained, ...conclusion.openedQuestions]);
}

function obligationsAfterConclusion(
	state: DeveloperState,
	judgment: ActiveJudgment,
	conclusion: JudgmentConclusion,
	pendingQuestions: readonly PendingQuestion[],
): DeveloperObligations {
	let implementationFramingRequired =
		state.obligations.implementationFramingRequired;
	let verificationRequired = state.obligations.verificationRequired;
	const completesMethod =
		conclusion.kind === "contextual-judgment" ||
		conclusion.kind === "judgment-not-applicable";
	if (
		judgment.skill.name === "model" &&
		conclusion.kind === "contextual-judgment"
	) {
		implementationFramingRequired = true;
	}
	if (
		(judgment.skill.name === "sketch" || judgment.skill.name === "signal") &&
		completesMethod
	) {
		implementationFramingRequired = false;
	}
	if (
		judgment.skill.name === "verify" &&
		conclusion.kind === "contextual-judgment" &&
		!pendingQuestions.some(
			(question) => openOrBlocked(question) && question.gate !== "none",
		)
	) {
		verificationRequired = false;
	}
	return Object.freeze({
		rerouteRequired: false,
		implementationFramingRequired,
		verificationRequired,
	});
}

function activate(
	state: DeveloperState,
	enabled: boolean,
): DeveloperTransitionResult {
	if (!enabled) return accepted(initialDeveloperState());
	if (state.enabled) return accepted(state);
	return accepted({ ...initialDeveloperState(), enabled: true });
}

function focusQuestion(
	state: DeveloperState,
	questionId: string,
): DeveloperTransitionResult {
	if (!state.enabled)
		return rejected("developer.disabled", "Developer is disabled.");
	if (!hasQuestion(state, questionId)) {
		return rejected(
			"developer.question-missing",
			`Question ${questionId} is not pending.`,
		);
	}
	return accepted({ ...state, focusedQuestionId: questionId });
}

function openJudgment(
	state: DeveloperState,
	judgment: ActiveJudgment,
): DeveloperTransitionResult {
	if (!state.enabled)
		return rejected("developer.disabled", "Developer is disabled.");
	if (state.activeWork) {
		return rejected(
			"developer.work-overlap",
			`Developer already has active work ${workId(state.activeWork)}.`,
		);
	}
	if (knownWorkId(state, judgment.judgmentId)) {
		return rejected(
			"developer.duplicate-work-id",
			`Judgment identity ${judgment.judgmentId} was already used.`,
		);
	}
	const targetError = validateTargetQuestion(state, judgment.targetQuestionId);
	if (targetError) return targetError;
	return accepted({
		...state,
		activeWork: judgment,
		focusedQuestionId:
			judgment.targetQuestionId === state.focusedQuestionId
				? undefined
				: state.focusedQuestionId,
		obligations: Object.freeze({
			...state.obligations,
			rerouteRequired: false,
		}),
	});
}

function authorizeChange(
	state: DeveloperState,
	change: AuthorizedChange,
): DeveloperTransitionResult {
	if (!state.enabled)
		return rejected("developer.disabled", "Developer is disabled.");
	if (state.activeWork) {
		return rejected(
			"developer.work-overlap",
			`Developer already has active work ${workId(state.activeWork)}.`,
		);
	}
	if (knownWorkId(state, change.authorizationId)) {
		return rejected(
			"developer.duplicate-work-id",
			`Authorization identity ${change.authorizationId} was already used.`,
		);
	}
	const targetError = validateTargetQuestion(state, change.targetQuestionId);
	if (targetError) return targetError;
	if (blocksImplementation(state)) {
		return rejected(
			"developer.implementation-blocked",
			"A before-implementation question is unresolved.",
		);
	}
	if (state.obligations.implementationFramingRequired) {
		return rejected(
			"developer.implementation-framing-required",
			"Implementation framing through sketch or signal is required before mutation.",
		);
	}
	return accepted({
		...state,
		activeWork: change,
		focusedQuestionId:
			change.targetQuestionId === state.focusedQuestionId
				? undefined
				: state.focusedQuestionId,
		obligations: Object.freeze({
			...state.obligations,
			rerouteRequired: false,
		}),
	});
}

function concludeJudgment(
	state: DeveloperState,
	conclusion: JudgmentConclusion,
): DeveloperTransitionResult {
	const active = state.activeWork;
	if (!active || active.kind !== "active-judgment") {
		return rejected(
			"developer.wrong-work-id",
			"No Developer judgment is active.",
		);
	}
	if (active.judgmentId !== conclusion.judgmentId) {
		return rejected(
			"developer.wrong-work-id",
			`Conclusion ${conclusion.judgmentId} does not close ${active.judgmentId}.`,
		);
	}
	if (!contextBasisMatches(active, conclusion)) {
		return rejected(
			"developer.context-basis-mismatch",
			"The conclusion context basis does not match the active judgment contract.",
		);
	}
	const questionError = validateQuestionChanges(state, conclusion);
	if (questionError) return questionError;
	const pendingQuestions = questionsAfterConclusion(state, conclusion);
	return accepted({
		...state,
		activeWork: undefined,
		judgments: Object.freeze([
			...state.judgments,
			Object.freeze({ judgment: active, conclusion }),
		]),
		pendingQuestions,
		focusedQuestionId: pendingQuestions.some(
			(question) => question.id === state.focusedQuestionId,
		)
			? state.focusedQuestionId
			: undefined,
		obligations: obligationsAfterConclusion(
			state,
			active,
			conclusion,
			pendingQuestions,
		),
	});
}

function recordLanding(
	state: DeveloperState,
	landing: ImplementationLanding,
): DeveloperTransitionResult {
	const active = state.activeWork;
	if (!active || active.kind !== "authorized-change") {
		return rejected(
			"developer.wrong-work-id",
			"No Developer change authorization is active.",
		);
	}
	if (active.authorizationId !== landing.authorizationId) {
		return rejected(
			"developer.wrong-work-id",
			`Landing ${landing.authorizationId} does not close ${active.authorizationId}.`,
		);
	}
	return accepted({
		...state,
		activeWork: undefined,
		landings: Object.freeze([
			...state.landings,
			Object.freeze({ change: active, landing }),
		]),
		obligations: Object.freeze({
			...state.obligations,
			rerouteRequired: true,
			verificationRequired: true,
		}),
	});
}

export function transitionDeveloper(
	state: DeveloperState,
	event: DeveloperEvent,
): DeveloperTransitionResult {
	switch (event.kind) {
		case "activation-changed":
			return activate(state, event.enabled);
		case "question-focused":
			return focusQuestion(state, event.questionId);
		case "judgment-opened":
			return openJudgment(state, event.judgment);
		case "change-authorized":
			return authorizeChange(state, event.change);
		case "judgment-concluded":
			return concludeJudgment(state, event.conclusion);
		case "landing-recorded":
			return recordLanding(state, event.landing);
	}
}

export function applyDeveloperEvent(
	state: DeveloperState,
	event: DeveloperEvent,
): DeveloperState {
	const result = transitionDeveloper(state, event);
	return result.ok ? result.state : state;
}

export type DeveloperNextOperation =
	| typeof OPEN_JUDGMENT_TOOL
	| typeof CONCLUDE_JUDGMENT_TOOL
	| typeof AUTHORIZE_CHANGE_TOOL
	| typeof RECORD_LANDING_TOOL;

export function developerNextOperations(
	state: DeveloperState,
): readonly DeveloperNextOperation[] {
	if (!state.enabled) return Object.freeze([]);
	if (state.activeWork?.kind === "active-judgment") {
		return Object.freeze([CONCLUDE_JUDGMENT_TOOL]);
	}
	if (state.activeWork?.kind === "authorized-change") {
		return Object.freeze([RECORD_LANDING_TOOL]);
	}
	const operations: DeveloperNextOperation[] = [OPEN_JUDGMENT_TOOL];
	if (
		!blocksImplementation(state) &&
		!state.obligations.rerouteRequired &&
		!state.obligations.implementationFramingRequired
	) {
		operations.push(AUTHORIZE_CHANGE_TOOL);
	}
	return Object.freeze(operations);
}

export interface DeveloperToolAccess {
	readonly allowsShell: boolean;
	readonly allowsArtifactTools: boolean;
	readonly hasBeforeImplementationGate: boolean;
}

export function developerToolAccess(
	state: DeveloperState,
): DeveloperToolAccess {
	return Object.freeze({
		allowsShell: Boolean(state.activeWork),
		allowsArtifactTools: state.activeWork?.kind === "authorized-change",
		hasBeforeImplementationGate: blocksImplementation(state),
	});
}

export type DeveloperProtocolState =
	| "disabled"
	| "idle"
	| "needs-judgment-conclusion"
	| "authorized-change"
	| "needs-answer"
	| "needs-evidence"
	| "needs-routing"
	| "needs-verification"
	| "blocked";

export function developerProtocolState(
	state: DeveloperState,
): DeveloperProtocolState {
	if (!state.enabled) return "disabled";
	if (state.activeWork?.kind === "active-judgment") {
		return "needs-judgment-conclusion";
	}
	if (state.activeWork?.kind === "authorized-change") {
		return "authorized-change";
	}
	if (blocksImplementation(state)) return "blocked";
	if (
		state.pendingQuestions.some(
			(question) =>
				openOrBlocked(question) && question.resolutionOwner === "user",
		)
	) {
		return "needs-answer";
	}
	if (state.pendingQuestions.some(openOrBlocked)) return "needs-evidence";
	if (state.obligations.rerouteRequired) return "needs-routing";
	if (state.obligations.verificationRequired) return "needs-verification";
	return "idle";
}
