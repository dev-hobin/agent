import type {
	ActiveJudgment,
	AuthorizedChange,
	DeveloperEvent,
} from "../src/protocol.ts";
import {
	applyDeveloperEvent,
	blocksCompletion,
	blocksImplementation,
	developerNextOperations,
	initialDeveloperState,
	transitionDeveloper,
	type DeveloperState,
} from "../src/transition.ts";

export type DeveloperMachineTag =
	| "execute"
	| "mutate"
	| "blocks-implementation"
	| "blocks-completion"
	| "reroute-required"
	| "framing-required"
	| "verification-required";

export interface DeveloperMachineValue {
	readonly activation: "enabled" | "disabled";
	readonly work: "idle" | "judgment" | "change";
	readonly questions: "clear" | "open";
	readonly implementationGate: "clear" | "blocked";
	readonly completionGate: "clear" | "blocked";
	readonly checkpoint: "ready" | "required";
	readonly framing: "clear" | "required";
	readonly verification: "current" | "required";
}

export interface DeveloperSnapshot {
	readonly context: DeveloperState;
	readonly value: DeveloperMachineValue;
	matches(expected: Partial<DeveloperMachineValue>): boolean;
	hasTag(tag: DeveloperMachineTag): boolean;
	can(event: DeveloperEvent): boolean;
}

export const initialState = initialDeveloperState;

// ActiveJudgment permits only developer_conclude_judgment.
// AuthorizedChange permits mutation and only developer_record_landing.
export function closingOperation(
	work: ActiveJudgment | AuthorizedChange,
): "developer_conclude_judgment" | "developer_record_landing" {
	return work.kind === "active-judgment"
		? "developer_conclude_judgment"
		: "developer_record_landing";
}

function machineValue(state: DeveloperState): DeveloperMachineValue {
	return Object.freeze({
		activation: state.enabled ? "enabled" : "disabled",
		work:
			state.activeWork?.kind === "active-judgment"
				? "judgment"
				: state.activeWork?.kind === "authorized-change"
					? "change"
					: "idle",
		questions: state.pendingQuestions.length > 0 ? "open" : "clear",
		implementationGate: blocksImplementation(state) ? "blocked" : "clear",
		completionGate: blocksCompletion(state) ? "blocked" : "clear",
		checkpoint: state.obligations.rerouteRequired ? "required" : "ready",
		framing: state.obligations.implementationFramingRequired
			? "required"
			: "clear",
		verification: state.obligations.verificationRequired
			? "required"
			: "current",
	});
}

export function developerSnapshot(state: DeveloperState): DeveloperSnapshot {
	const value = machineValue(state);
	const tags = new Set<DeveloperMachineTag>();
	if (state.activeWork) tags.add("execute");
	if (state.activeWork?.kind === "authorized-change") tags.add("mutate");
	if (blocksImplementation(state)) tags.add("blocks-implementation");
	if (blocksCompletion(state)) tags.add("blocks-completion");
	if (state.obligations.rerouteRequired) tags.add("reroute-required");
	if (state.obligations.implementationFramingRequired)
		tags.add("framing-required");
	if (state.obligations.verificationRequired) tags.add("verification-required");
	return Object.freeze({
		context: state,
		value,
		matches(expected: Partial<DeveloperMachineValue>): boolean {
			return Object.entries(expected).every(
				([key, expectedValue]) =>
					value[key as keyof DeveloperMachineValue] === expectedValue,
			);
		},
		hasTag(tag: DeveloperMachineTag): boolean {
			return tags.has(tag);
		},
		can(event: DeveloperEvent): boolean {
			return transitionDeveloper(state, event).ok;
		},
	});
}

export function canApplyDeveloperEvent(
	state: DeveloperState,
	event: DeveloperEvent,
): boolean {
	return transitionDeveloper(state, event).ok;
}

export { applyDeveloperEvent, developerNextOperations };
