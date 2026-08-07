import type { ActionClearance } from "../src/action-loop/action/action-clearance.ts";
import {
	beginEffect,
	type PendingEffect,
} from "../src/action-loop/effect/begin-effect.ts";
import { recordWorkCaseEffect } from "../src/action-loop/work/record-work-case-effect.ts";
import type { LiveWorkCaseState } from "./action-loop-work-case.ts";

export type LiveEffectBeginningResult =
	| {
			readonly status: "begun" | "unchanged";
			readonly state: LiveWorkCaseState;
			readonly effect: PendingEffect;
	  }
	| { readonly status: "invalid"; readonly message: string };

/** Begins one pending Effect only for an exact cleared Pi host occurrence. */
export function beginLiveActionEffect(
	state: LiveWorkCaseState,
	clearance: ActionClearance,
	occurrenceId: string,
): LiveEffectBeginningResult {
	const begun = beginEffect(clearance, {
		actionClearanceId: clearance.actionClearanceId,
		occurrenceId,
		controlledAction: clearance.controlledAction,
		source: "pi:tool-call",
	});
	if (begun.status === "invalid") {
		return { status: "invalid", message: begun.error.message };
	}
	const recorded = recordWorkCaseEffect(state.workCase, begun.value);
	if (recorded.status === "invalid") {
		return { status: "invalid", message: recorded.error.message };
	}
	return {
		status: recorded.status === "recorded" ? "begun" : "unchanged",
		state:
			recorded.status === "recorded"
				? Object.freeze({ ...state, workCase: recorded.value })
				: state,
		effect: begun.value,
	};
}
