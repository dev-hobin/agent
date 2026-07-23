import { assign, setup, transition, type StateValue } from "xstate";

import type {
	ActivationEvent,
	DeveloperEvent,
	DeveloperState,
	FocusEvent,
	JudgmentEvent,
	PendingQuestion,
	RouteEvent,
} from "./state.ts";

type DeveloperMachineEvent =
	| { type: "ACTIVATION"; event: ActivationEvent }
	| { type: "FOCUS"; event: FocusEvent }
	| { type: "ROUTE"; event: RouteEvent }
	| { type: "JUDGMENT"; event: JudgmentEvent };

export type DeveloperMachineTag =
	| "execute"
	| "mutate"
	| "blocks-implementation"
	| "blocks-completion"
	| "reroute-required"
	| "framing-required"
	| "verification-required";

export const initialState = (): DeveloperState => ({
	enabled: false,
	activeRoute: undefined,
	lastRoute: undefined,
	lastJudgment: undefined,
	routeHistory: [],
	judgmentHistory: [],
	pendingQuestions: [],
	focusedQuestionId: undefined,
	rerouteRequired: false,
	implementationFramingRequired: false,
	verificationRequired: false,
});

function normalizedQuestion(value: string): string {
	return value
		.toLocaleLowerCase()
		.replace(/[^\p{L}\p{N}]+/gu, " ")
		.trim();
}

function upsertQuestion(
	questions: PendingQuestion[],
	next: PendingQuestion,
): PendingQuestion[] {
	const nextKey = normalizedQuestion(next.question);
	const existingIndex = questions.findIndex(
		(question) =>
			question.id === next.id ||
			normalizedQuestion(question.question) === nextKey,
	);
	if (existingIndex === -1) return [...questions, next];

	const existing = questions[existingIndex];
	if (!existing) return [...questions, next];
	const updated = [...questions];
	updated[existingIndex] = { ...next, id: existing.id };
	return updated;
}

function applyRouteContext(
	state: DeveloperState,
	event: RouteEvent,
): DeveloperState {
	return {
		...state,
		activeRoute: event,
		lastRoute: event,
		routeHistory: [...state.routeHistory, event],
		rerouteRequired: false,
		focusedQuestionId:
			event.targetQuestionId === state.focusedQuestionId
				? undefined
				: state.focusedQuestionId,
	};
}

function questionsAfterJudgment(
	state: DeveloperState,
	route: RouteEvent,
	event: JudgmentEvent,
): PendingQuestion[] {
	let pending = [...state.pendingQuestions];
	const remainsOpen =
		event.status === "needs-evidence" || event.status === "blocked";
	if (
		!route.targetQuestionId &&
		remainsOpen &&
		event.openedQuestions.length === 0
	) {
		pending = upsertQuestion(pending, {
			id: `question:${route.routeId}`,
			question: route.question,
			status: event.status === "blocked" ? "blocked" : "open",
			resolutionOwner: "unknown",
			gate: event.status === "blocked" ? "before-completion" : "none",
			resolutionCriteria: `Obtain evidence that settles: ${route.question}`,
			sourceRouteId: route.routeId,
		});
	}

	for (const question of event.openedQuestions)
		pending = upsertQuestion(pending, question);
	for (const update of event.questionUpdates) {
		if (update.status === "resolved" || update.status === "not-applicable") {
			pending = pending.filter((question) => question.id !== update.questionId);
			continue;
		}
		const existing = pending.find(
			(question) => question.id === update.questionId,
		);
		if (!existing) continue;
		pending = upsertQuestion(pending, {
			...existing,
			status: update.status,
			sourceRouteId: route.routeId,
		});
	}
	return pending;
}

function framingAfterJudgment(
	state: DeveloperState,
	route: RouteEvent,
	event: JudgmentEvent,
): boolean {
	if (route.target === "model" && event.status === "resolved") return true;
	const closesGate =
		(route.target === "sketch" || route.target === "signal") &&
		(event.status === "resolved" || event.status === "not-applicable");
	return closesGate ? false : state.implementationFramingRequired;
}

function verificationAfterJudgment(
	state: DeveloperState,
	route: RouteEvent,
	event: JudgmentEvent,
	pending: PendingQuestion[],
): boolean {
	if (route.target === "implementation" && event.changedArtifacts) return true;
	const completionQuestionRemains = pending.some(
		(question) =>
			question.gate === "before-completion" ||
			question.gate === "before-implementation",
	);
	if (
		route.target === "verify" &&
		event.status === "resolved" &&
		!completionQuestionRemains
	) {
		return false;
	}
	return state.verificationRequired;
}

function applyJudgmentContext(
	state: DeveloperState,
	event: JudgmentEvent,
): DeveloperState {
	const route = state.activeRoute;
	if (!route) return state;
	const judgment = { ...event, question: route.question, target: route.target };
	const pending = questionsAfterJudgment(state, route, event);
	return {
		...state,
		activeRoute: undefined,
		lastJudgment: judgment,
		judgmentHistory: [...state.judgmentHistory, judgment],
		pendingQuestions: pending,
		focusedQuestionId: pending.some(
			(question) => question.id === state.focusedQuestionId,
		)
			? state.focusedQuestionId
			: undefined,
		rerouteRequired: route.target === "implementation",
		implementationFramingRequired: framingAfterJudgment(state, route, event),
		verificationRequired: verificationAfterJudgment(
			state,
			route,
			event,
			pending,
		),
	};
}

function assertNever(value: never): never {
	throw new Error(
		`Unexpected Developer machine event: ${JSON.stringify(value)}`,
	);
}

function reduceDeveloperContext(
	state: DeveloperState,
	event: DeveloperEvent,
): DeveloperState {
	switch (event.kind) {
		case "activation":
			return event.enabled ? { ...state, enabled: true } : initialState();
		case "focus":
			return { ...state, focusedQuestionId: event.questionId };
		case "route":
			return applyRouteContext(state, event);
		case "judgment":
			return applyJudgmentContext(state, event);
		default:
			return assertNever(event);
	}
}

function machineEvent(event: DeveloperEvent): DeveloperMachineEvent {
	switch (event.kind) {
		case "activation":
			return { type: "ACTIVATION", event };
		case "focus":
			return { type: "FOCUS", event };
		case "route":
			return { type: "ROUTE", event };
		case "judgment":
			return { type: "JUDGMENT", event };
		default:
			return assertNever(event);
	}
}

function canApplyEvent(
	context: DeveloperState,
	event: DeveloperMachineEvent,
): boolean {
	switch (event.type) {
		case "ACTIVATION":
			return true;
		case "FOCUS":
			return (
				context.enabled &&
				context.pendingQuestions.some(
					(question) => question.id === event.event.questionId,
				)
			);
		case "ROUTE":
			return (
				context.enabled &&
				!context.activeRoute &&
				(event.event.target !== "implementation" ||
					!context.pendingQuestions.some(
						(question) => question.gate === "before-implementation",
					))
			);
		case "JUDGMENT":
			return (
				context.enabled && context.activeRoute?.routeId === event.event.routeId
			);
		default:
			return assertNever(event);
	}
}

const machineSetup = setup({
	types: {
		context: {} as DeveloperState,
		events: {} as DeveloperMachineEvent,
		tags: {} as DeveloperMachineTag,
	},
	actions: {
		applyEvent: assign(({ context, event }) =>
			reduceDeveloperContext(context, event.event),
		),
	},
	guards: {
		eventAllowed: ({ context, event }) => canApplyEvent(context, event),
		activationDisabled: ({ context }) => !context.enabled,
		activationEnabled: ({ context }) => context.enabled,
		routeIdle: ({ context }) => !context.activeRoute,
		routeJudgment: ({ context }) =>
			Boolean(
				context.activeRoute && context.activeRoute.target !== "implementation",
			),
		routeImplementation: ({ context }) =>
			context.activeRoute?.target === "implementation",
		questionsClear: ({ context }) => context.pendingQuestions.length === 0,
		questionsOpen: ({ context }) => context.pendingQuestions.length > 0,
		implementationGateClear: ({ context }) =>
			!context.pendingQuestions.some(
				(question) => question.gate === "before-implementation",
			),
		implementationGateBlocked: ({ context }) =>
			context.pendingQuestions.some(
				(question) => question.gate === "before-implementation",
			),
		completionGateClear: ({ context }) =>
			!context.pendingQuestions.some(
				(question) =>
					question.gate === "before-implementation" ||
					question.gate === "before-completion",
			),
		completionGateBlocked: ({ context }) =>
			context.pendingQuestions.some(
				(question) =>
					question.gate === "before-implementation" ||
					question.gate === "before-completion",
			),
		checkpointReady: ({ context }) => !context.rerouteRequired,
		checkpointRequired: ({ context }) => context.rerouteRequired,
		framingClear: ({ context }) => !context.implementationFramingRequired,
		framingRequired: ({ context }) => context.implementationFramingRequired,
		verificationCurrent: ({ context }) => !context.verificationRequired,
		verificationRequired: ({ context }) => context.verificationRequired,
	},
});

export const developerMachine = machineSetup.createMachine({
	id: "developer",
	type: "parallel",
	context: initialState(),
	on: {
		ACTIVATION: { guard: "eventAllowed", actions: "applyEvent" },
		FOCUS: { guard: "eventAllowed", actions: "applyEvent" },
		ROUTE: { guard: "eventAllowed", actions: "applyEvent" },
		JUDGMENT: { guard: "eventAllowed", actions: "applyEvent" },
	},
	states: {
		activation: {
			initial: "disabled",
			states: {
				disabled: { always: { guard: "activationEnabled", target: "enabled" } },
				enabled: {
					always: { guard: "activationDisabled", target: "disabled" },
				},
			},
		},
		route: {
			initial: "idle",
			states: {
				idle: {
					always: [
						{ guard: "routeImplementation", target: "implementation" },
						{ guard: "routeJudgment", target: "judgment" },
					],
				},
				judgment: {
					tags: "execute",
					always: [
						{ guard: "routeIdle", target: "idle" },
						{ guard: "routeImplementation", target: "implementation" },
					],
				},
				implementation: {
					tags: ["execute", "mutate"],
					always: [
						{ guard: "routeIdle", target: "idle" },
						{ guard: "routeJudgment", target: "judgment" },
					],
				},
			},
		},
		questions: {
			initial: "clear",
			states: {
				clear: { always: { guard: "questionsOpen", target: "open" } },
				open: { always: { guard: "questionsClear", target: "clear" } },
			},
		},
		implementationGate: {
			initial: "clear",
			states: {
				clear: {
					always: { guard: "implementationGateBlocked", target: "blocked" },
				},
				blocked: {
					tags: "blocks-implementation",
					always: { guard: "implementationGateClear", target: "clear" },
				},
			},
		},
		completionGate: {
			initial: "clear",
			states: {
				clear: {
					always: { guard: "completionGateBlocked", target: "blocked" },
				},
				blocked: {
					tags: "blocks-completion",
					always: { guard: "completionGateClear", target: "clear" },
				},
			},
		},
		checkpoint: {
			initial: "ready",
			states: {
				ready: { always: { guard: "checkpointRequired", target: "required" } },
				required: {
					tags: "reroute-required",
					always: { guard: "checkpointReady", target: "ready" },
				},
			},
		},
		framing: {
			initial: "clear",
			states: {
				clear: { always: { guard: "framingRequired", target: "required" } },
				required: {
					tags: "framing-required",
					always: { guard: "framingClear", target: "clear" },
				},
			},
		},
		verification: {
			initial: "current",
			states: {
				current: {
					always: { guard: "verificationRequired", target: "required" },
				},
				required: {
					tags: "verification-required",
					always: { guard: "verificationCurrent", target: "current" },
				},
			},
		},
	},
});

function machineValue(state: DeveloperState): StateValue {
	let route = "idle";
	if (state.activeRoute?.target === "implementation") route = "implementation";
	else if (state.activeRoute) route = "judgment";
	const implementationBlocked = state.pendingQuestions.some(
		(question) => question.gate === "before-implementation",
	);
	const completionBlocked = state.pendingQuestions.some(
		(question) =>
			question.gate === "before-implementation" ||
			question.gate === "before-completion",
	);
	return {
		activation: state.enabled ? "enabled" : "disabled",
		route,
		questions: state.pendingQuestions.length > 0 ? "open" : "clear",
		implementationGate: implementationBlocked ? "blocked" : "clear",
		completionGate: completionBlocked ? "blocked" : "clear",
		checkpoint: state.rerouteRequired ? "required" : "ready",
		framing: state.implementationFramingRequired ? "required" : "clear",
		verification: state.verificationRequired ? "required" : "current",
	};
}

export function developerSnapshot(state: DeveloperState) {
	return developerMachine.resolveState({
		value: machineValue(state),
		context: state,
	});
}

export function canApplyDeveloperEvent(
	state: DeveloperState,
	event: DeveloperEvent,
): boolean {
	return developerSnapshot(state).can(machineEvent(event));
}

export function applyDeveloperEvent(
	state: DeveloperState,
	event: DeveloperEvent,
): DeveloperState {
	const [nextSnapshot] = transition(
		developerMachine,
		developerSnapshot(state),
		machineEvent(event),
	);
	return nextSnapshot.context;
}
