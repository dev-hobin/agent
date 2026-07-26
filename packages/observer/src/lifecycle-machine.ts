import { setup, transition, type StateValue } from "xstate";

import {
	applyObserverEvent,
	canApplyObserverEvent,
	initialObserverState,
	type ObserverEvent,
	type ObserverState,
} from "./lifecycle.ts";

export interface ObserverMachineEvent {
	readonly type: "OBSERVER_EVENT";
	readonly event: ObserverEvent;
}

export type ObserverMachineTag =
	| "episode-open"
	| "observer-on"
	| "reviewing-wrap"
	| "settled";

function machineEvent(event: ObserverEvent): ObserverMachineEvent {
	return { type: "OBSERVER_EVENT", event };
}

function nextContext(
	state: ObserverState,
	event: ObserverEvent,
): ObserverState {
	const application = applyObserverEvent(state, event);
	return application.applied ? application.state : state;
}

const machineSetup = setup<ObserverState, ObserverMachineEvent>({});

export const observerMachine = machineSetup.createMachine({
	id: "observer",
	type: "parallel",
	context: initialObserverState(),
	on: {
		OBSERVER_EVENT: {
			guard: ({ context, event }) =>
				canApplyObserverEvent(context, event.event),
			actions: machineSetup.assign(({ context, event }) =>
				nextContext(context, event.event),
			),
		},
	},
	states: {
		mode: {
			initial: "off",
			states: {
				off: {
					always: {
						guard: ({ context }) => context.mode === "on",
						target: "on",
					},
				},
				on: {
					tags: "observer-on",
					always: {
						guard: ({ context }) => context.mode === "off",
						target: "off",
					},
				},
			},
		},
		episode: {
			initial: "empty",
			states: {
				empty: {
					always: [
						{
							guard: ({ context }) => context.episode.status === "open",
							target: "open",
						},
						{
							guard: ({ context }) =>
								context.episode.status === "reviewing-wrap",
							target: "reviewing-wrap",
						},
						{
							guard: ({ context }) => context.episode.status === "settled",
							target: "settled",
						},
					],
				},
				open: {
					tags: "episode-open",
					always: [
						{
							guard: ({ context }) => context.episode.status === "empty",
							target: "empty",
						},
						{
							guard: ({ context }) =>
								context.episode.status === "reviewing-wrap",
							target: "reviewing-wrap",
						},
						{
							guard: ({ context }) => context.episode.status === "settled",
							target: "settled",
						},
					],
				},
				"reviewing-wrap": {
					tags: "reviewing-wrap",
					always: [
						{
							guard: ({ context }) => context.episode.status === "empty",
							target: "empty",
						},
						{
							guard: ({ context }) => context.episode.status === "open",
							target: "open",
						},
						{
							guard: ({ context }) => context.episode.status === "settled",
							target: "settled",
						},
					],
				},
				settled: {
					tags: "settled",
					always: [
						{
							guard: ({ context }) => context.episode.status === "empty",
							target: "empty",
						},
						{
							guard: ({ context }) => context.episode.status === "open",
							target: "open",
						},
						{
							guard: ({ context }) =>
								context.episode.status === "reviewing-wrap",
							target: "reviewing-wrap",
						},
					],
				},
			},
		},
	},
});

function machineValue(state: ObserverState): StateValue {
	return {
		mode: state.mode,
		episode: state.episode.status,
	};
}

export function observerSnapshot(state: ObserverState) {
	return observerMachine.resolveState({
		value: machineValue(state),
		context: state,
	});
}

export function applyObserverMachineEvent(
	state: ObserverState,
	event: ObserverEvent,
): ObserverState {
	const [snapshot] = transition(
		observerMachine,
		observerSnapshot(state),
		machineEvent(event),
	);
	return snapshot.context;
}
