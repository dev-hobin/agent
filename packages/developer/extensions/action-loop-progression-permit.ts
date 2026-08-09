export interface ActionLoopProgressionPermitState {
	readonly current: number;
	readonly lastUsed: number;
}

export type ConsumeActionLoopProgressionPermitResult =
	| {
			readonly status: "accepted";
			readonly state: ActionLoopProgressionPermitState;
	  }
	| { readonly status: "refused" };

export function createActionLoopProgressionPermitState(): ActionLoopProgressionPermitState {
	return Object.freeze({ current: 0, lastUsed: -1 });
}

export function progressionResultOpensPermit(status: string): boolean {
	return status === "judgment-concluded" || status === "effect-settled";
}

/** Opens one new progression boundary after trusted external state changes. */
export function openActionLoopProgressionPermit(
	state: ActionLoopProgressionPermitState,
): ActionLoopProgressionPermitState {
	return Object.freeze({ current: state.current + 1, lastUsed: state.lastUsed });
}

/** Consumes at most one progression attempt at the current evidence boundary. */
export function consumeActionLoopProgressionPermit(
	state: ActionLoopProgressionPermitState,
): ConsumeActionLoopProgressionPermitResult {
	if (state.current === state.lastUsed) return { status: "refused" };
	return {
		status: "accepted",
		state: Object.freeze({ current: state.current, lastUsed: state.current }),
	};
}
