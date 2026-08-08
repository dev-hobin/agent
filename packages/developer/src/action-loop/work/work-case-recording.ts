import {
	deriveWorkCaseRevisionId,
	type ActiveWorkCase,
	workCaseInventoryIssue,
	type WorkCaseInventoryIssue,
} from "./work-case.ts";

export interface WorkCaseRecordingIssue {
	readonly code: "stale-work-case" | "invalid-work-case-inventory";
	readonly path: string;
	readonly message: string;
}

/** Rejects stale revisions and relationally incoherent aggregate inventories. */
export function currentWorkCaseRecordingIssue(
	workCase: ActiveWorkCase,
): WorkCaseRecordingIssue | undefined {
	if (workCase.revisionId !== deriveWorkCaseRevisionId(workCase)) {
		return {
			code: "stale-work-case",
			path: "workCase.revisionId",
			message: "Work Case revision does not match its closure inventory",
		};
	}
	const inventoryIssue = workCaseInventoryIssue(workCase);
	return inventoryIssue
		? {
				code: "invalid-work-case-inventory",
				path: inventoryIssue.path,
				message: inventoryIssue.message,
			}
		: undefined;
}

export type WorkCaseRevisionSealResult =
	| { readonly status: "sealed"; readonly value: ActiveWorkCase }
	| { readonly status: "invalid"; readonly issue: WorkCaseInventoryIssue };

/** Validates the next complete inventory before deriving its canonical revision. */
export function sealWorkCaseRevision(
	nextState: ActiveWorkCase,
): WorkCaseRevisionSealResult {
	const issue = workCaseInventoryIssue(nextState);
	if (issue) return { status: "invalid", issue };
	return {
		status: "sealed",
		value: Object.freeze({
			...nextState,
			revisionId: deriveWorkCaseRevisionId(nextState),
		}),
	};
}
