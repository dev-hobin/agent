import {
	AUTHORIZE_CHANGE_TOOL,
	CONCLUDE_JUDGMENT_TOOL,
	DEVELOPER_ACTIVATION_ENTRY,
	DEVELOPER_EVENT_ENTRY,
	DEVELOPER_FOCUS_ENTRY,
	DEVELOPER_PROTOCOL,
	OPEN_JUDGMENT_TOOL,
	RECORD_LANDING_TOOL,
	parseDeveloperEvent,
	type DeveloperEvent,
} from "./protocol.ts";
import {
	initialDeveloperState,
	transitionDeveloper,
	type DeveloperState,
} from "./transition.ts";

export interface DeveloperBranchEntry {
	readonly type?: string;
	readonly customType?: string;
	readonly data?: unknown;
	readonly message?: {
		readonly role?: string;
		readonly toolName?: string;
		readonly details?: unknown;
	};
}

export type DeveloperReplayIssueCode =
	| "developer.history.unsupported-v6"
	| "developer.history.malformed-v7"
	| "developer.history.illegal-transition";

export interface DeveloperReplayIssue {
	readonly code: DeveloperReplayIssueCode;
	readonly index: number;
	readonly message: string;
}

export interface DeveloperReplayResult {
	readonly state: DeveloperState;
	readonly issues: readonly DeveloperReplayIssue[];
	readonly restartRequired: boolean;
}

const toolKinds = new Map<string, DeveloperEvent["kind"]>([
	[OPEN_JUDGMENT_TOOL, "judgment-opened"],
	[CONCLUDE_JUDGMENT_TOOL, "judgment-concluded"],
	[AUTHORIZE_CHANGE_TOOL, "change-authorized"],
	[RECORD_LANDING_TOOL, "landing-recorded"],
]);

const legacyToolNames = new Set([
	"developer_route_question",
	"developer_load_guidance",
	"developer_record_judgment",
]);

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function protocolOf(value: unknown): string | undefined {
	return isObject(value) && typeof value.protocol === "string"
		? value.protocol
		: undefined;
}

function ownedV7Data(entry: DeveloperBranchEntry): unknown | undefined {
	if (entry.type === "custom") {
		if (
			entry.customType === DEVELOPER_ACTIVATION_ENTRY ||
			entry.customType === DEVELOPER_FOCUS_ENTRY ||
			entry.customType === DEVELOPER_EVENT_ENTRY
		) {
			return entry.data;
		}
		return undefined;
	}
	if (
		entry.type === "message" &&
		entry.message?.role === "toolResult" &&
		entry.message.toolName &&
		toolKinds.has(entry.message.toolName)
	) {
		return entry.message.details;
	}
	return undefined;
}

function legacyEntry(entry: DeveloperBranchEntry): boolean {
	if (
		entry.type === "message" &&
		entry.message?.role === "toolResult" &&
		entry.message.toolName &&
		legacyToolNames.has(entry.message.toolName)
	) {
		return true;
	}
	if (
		entry.type === "custom" &&
		entry.customType?.startsWith("developer.") &&
		protocolOf(entry.data) === "developer/v6"
	) {
		return true;
	}
	return protocolOf(entry.message?.details) === "developer/v6";
}

function expectedToolKind(
	entry: DeveloperBranchEntry,
): DeveloperEvent["kind"] | undefined {
	if (
		entry.type !== "message" ||
		entry.message?.role !== "toolResult" ||
		!entry.message.toolName
	) {
		return undefined;
	}
	return toolKinds.get(entry.message.toolName);
}

export function eventFromDeveloperBranchEntry(
	entry: DeveloperBranchEntry,
): DeveloperEvent | undefined {
	const data = ownedV7Data(entry);
	if (data === undefined) return undefined;
	const event = parseDeveloperEvent(data);
	const expected = expectedToolKind(entry);
	if (expected && event.kind !== expected) {
		throw new Error(
			`Developer tool ${entry.message?.toolName ?? "unknown"} cannot record ${event.kind}.`,
		);
	}
	return event;
}

export function replayDeveloper(
	entries: readonly DeveloperBranchEntry[],
): DeveloperReplayResult {
	let state = initialDeveloperState();
	const issues: DeveloperReplayIssue[] = [];
	let lastLegacyIndex = -1;
	let lastFreshActivationIndex = -1;
	let unsupportedRecorded = false;
	let stopped = false;

	for (let index = 0; index < entries.length; index += 1) {
		const entry = entries[index];
		if (!entry) continue;
		if (legacyEntry(entry)) {
			lastLegacyIndex = index;
			if (!unsupportedRecorded) {
				issues.push(
					Object.freeze({
						code: "developer.history.unsupported-v6",
						index,
						message:
							"Developer protocol v6 history is unsupported. Restart or use /developer on to begin a fresh v7 state; old entries are retained but never reinterpreted.",
					}),
				);
				unsupportedRecorded = true;
			}
			continue;
		}
		if (stopped) continue;
		let event: DeveloperEvent | undefined;
		try {
			event = eventFromDeveloperBranchEntry(entry);
		} catch (error) {
			if (ownedV7Data(entry) !== undefined) {
				issues.push(
					Object.freeze({
						code: "developer.history.malformed-v7",
						index,
						message:
							error instanceof Error
								? error.message
								: "Malformed Developer v7 history.",
					}),
				);
				stopped = true;
			}
			continue;
		}
		if (!event) continue;
		const transition = transitionDeveloper(state, event);
		if (!transition.ok) {
			issues.push(
				Object.freeze({
					code: "developer.history.illegal-transition",
					index,
					message: transition.error.message,
				}),
			);
			stopped = true;
			continue;
		}
		state = transition.state;
		if (event.kind === "activation-changed" && event.enabled) {
			lastFreshActivationIndex = index;
		}
	}

	return Object.freeze({
		state,
		issues: Object.freeze(issues),
		restartRequired:
			lastLegacyIndex >= 0 && lastFreshActivationIndex <= lastLegacyIndex,
	});
}

export function isDeveloperV7(value: unknown): boolean {
	return protocolOf(value) === DEVELOPER_PROTOCOL;
}
