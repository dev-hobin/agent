export const COMPACTION_LANGUAGE_PROTOCOL =
	"developer.compaction-language/v1" as const;
export const COMPACTION_LANGUAGE_ENTRY =
	"developer.compaction-language" as const;
export const COMPACTION_LANGUAGE_MESSAGE =
	"developer.compaction-language-continuity" as const;

export type LanguageTag = string;

export interface LanguageObserved {
	protocol: typeof COMPACTION_LANGUAGE_PROTOCOL;
	kind: "language-observed";
	tag: LanguageTag;
}

export interface ContinuityPending {
	protocol: typeof COMPACTION_LANGUAGE_PROTOCOL;
	kind: "continuity-pending";
	compactionId: string;
	tag: LanguageTag;
}

export interface ContinuityConsumed {
	protocol: typeof COMPACTION_LANGUAGE_PROTOCOL;
	kind: "continuity-consumed";
	compactionId: string;
}

export type CompactionLanguageEvent =
	| LanguageObserved
	| ContinuityPending
	| ContinuityConsumed;

export interface PendingContinuity {
	compactionId: string;
	tag: LanguageTag;
	injected: boolean;
}

export interface CompactionLanguageState {
	language?: LanguageTag;
	pending?: PendingContinuity;
	consumedCompactionIds: ReadonlySet<string>;
}

export interface ContinuityContextMessage {
	role: "custom";
	customType: typeof COMPACTION_LANGUAGE_MESSAGE;
	content: Array<{ type: "text"; text: string }>;
	display: false;
	details: {
		protocol: typeof COMPACTION_LANGUAGE_PROTOCOL;
		compactionId: string;
		tag: LanguageTag;
	};
	timestamp: number;
}

interface BranchEntryLike {
	type?: string;
	customType?: string;
	data?: unknown;
}

const KOREAN_SCRIPT = /[\u3131-\u318e\uac00-\ud7a3]/u;
const ENGLISH_WORD = /[A-Za-z]+(?:'[A-Za-z]+)?/g;
const COMMAND_ONLY =
	/^(?:npm|pnpm|yarn|node|npx|git|rg|grep|find|cd|ls|cat|sed|bash)\b(?:\s+[-\w./:@]+)*$/u;
const WEAK_ENGLISH_INPUTS = new Set([
	"continue",
	"done",
	"go on",
	"next",
	"no",
	"ok",
	"okay",
	"proceed",
	"retry",
	"yes",
]);

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function proseCandidate(text: string): string {
	return text
		.replace(/```[\s\S]*?```/gu, " ")
		.replace(/`[^`\n]*`/gu, " ")
		.replace(/https?:\/\/\S+/gu, " ")
		.replace(/(?:^|\s)(?:\.{0,2}\/|\/)\S+/gu, " ")
		.replace(/\b[\w.-]+\.[A-Za-z0-9]{1,8}\b/gu, " ")
		.replace(/\b(?:route:\S+|[A-Za-z][A-Za-z0-9]*_[A-Za-z0-9_]+)\b/gu, " ")
		.replace(/\s+/gu, " ")
		.trim();
}

export function canonicalLanguageTag(value: string): LanguageTag | undefined {
	try {
		return Intl.getCanonicalLocales(value.trim())[0];
	} catch {
		return undefined;
	}
}

/** Conservatively observes direct user prose; weak input preserves prior state. */
export function detectStrongUserLanguage(
	text: string,
	source: string,
): LanguageTag | undefined {
	if (source !== "interactive" && source !== "rpc") return undefined;
	const normalized = text.trim();
	if (!normalized) return undefined;
	if (KOREAN_SCRIPT.test(normalized)) return "ko";

	const lower = normalized.toLowerCase().replace(/\s+/gu, " ");
	if (WEAK_ENGLISH_INPUTS.has(lower) || COMMAND_ONLY.test(normalized)) {
		return undefined;
	}
	const words = proseCandidate(normalized).match(ENGLISH_WORD) ?? [];
	const letterCount = words.reduce((count, word) => count + word.length, 0);
	return words.length >= 2 && letterCount >= 8 ? "en" : undefined;
}

export function languageObserved(tag: LanguageTag): LanguageObserved {
	const canonical = canonicalLanguageTag(tag);
	if (!canonical) throw new Error(`Invalid language tag: ${tag}`);
	return {
		protocol: COMPACTION_LANGUAGE_PROTOCOL,
		kind: "language-observed",
		tag: canonical,
	};
}

export function continuityPending(
	compactionId: string,
	tag: LanguageTag,
): ContinuityPending {
	const canonical = canonicalLanguageTag(tag);
	if (!canonical) throw new Error(`Invalid language tag: ${tag}`);
	if (!compactionId.trim()) throw new Error("Compaction ID must not be empty.");
	return {
		protocol: COMPACTION_LANGUAGE_PROTOCOL,
		kind: "continuity-pending",
		compactionId,
		tag: canonical,
	};
}

export function continuityConsumed(compactionId: string): ContinuityConsumed {
	if (!compactionId.trim()) throw new Error("Compaction ID must not be empty.");
	return {
		protocol: COMPACTION_LANGUAGE_PROTOCOL,
		kind: "continuity-consumed",
		compactionId,
	};
}

export function normalizeCompactionLanguageEvent(
	value: unknown,
): CompactionLanguageEvent | undefined {
	if (!isObject(value) || value.protocol !== COMPACTION_LANGUAGE_PROTOCOL) {
		return undefined;
	}
	if (value.kind === "language-observed" && typeof value.tag === "string") {
		const tag = canonicalLanguageTag(value.tag);
		return tag ? languageObserved(tag) : undefined;
	}
	if (
		value.kind === "continuity-pending" &&
		typeof value.compactionId === "string" &&
		value.compactionId.trim() &&
		typeof value.tag === "string"
	) {
		const tag = canonicalLanguageTag(value.tag);
		return tag ? continuityPending(value.compactionId, tag) : undefined;
	}
	if (
		value.kind === "continuity-consumed" &&
		typeof value.compactionId === "string" &&
		value.compactionId.trim()
	) {
		return continuityConsumed(value.compactionId);
	}
	return undefined;
}

export function initialCompactionLanguageState(): CompactionLanguageState {
	return { consumedCompactionIds: new Set() };
}

export function applyCompactionLanguageEvent(
	state: CompactionLanguageState,
	event: CompactionLanguageEvent,
): CompactionLanguageState {
	switch (event.kind) {
		case "language-observed":
			return {
				...state,
				language: event.tag,
				pending: state.pending
					? { ...state.pending, tag: event.tag }
					: undefined,
			};
		case "continuity-pending":
			if (
				state.consumedCompactionIds.has(event.compactionId) ||
				state.pending?.compactionId === event.compactionId
			) {
				return state;
			}
			return {
				...state,
				pending: {
					compactionId: event.compactionId,
					tag: event.tag,
					injected: false,
				},
			};
		case "continuity-consumed": {
			if (state.consumedCompactionIds.has(event.compactionId)) return state;
			const consumedCompactionIds = new Set(state.consumedCompactionIds);
			consumedCompactionIds.add(event.compactionId);
			return {
				...state,
				pending:
					state.pending?.compactionId === event.compactionId
						? undefined
						: state.pending,
				consumedCompactionIds,
			};
		}
	}
}

export function markContinuityInjected(
	state: CompactionLanguageState,
): CompactionLanguageState {
	if (!state.pending || state.pending.injected) return state;
	return { ...state, pending: { ...state.pending, injected: true } };
}

export function settlementContinuityEvent(
	state: CompactionLanguageState,
): ContinuityConsumed | undefined {
	return state.pending?.injected
		? continuityConsumed(state.pending.compactionId)
		: undefined;
}

export function reconstructCompactionLanguage(
	entries: ReadonlyArray<BranchEntryLike>,
): CompactionLanguageState {
	return entries.reduce((state, entry) => {
		if (
			entry.type !== "custom" ||
			entry.customType !== COMPACTION_LANGUAGE_ENTRY
		) {
			return state;
		}
		const event = normalizeCompactionLanguageEvent(entry.data);
		return event ? applyCompactionLanguageEvent(state, event) : state;
	}, initialCompactionLanguageState());
}

export function continuityMarkerText(tag: LanguageTag): string {
	return `Silent control: do not acknowledge or quote this marker; continue the current task. User-visible prose language=${tag}; explicit user language requests win.`;
}

export function continuityContextMessage(
	pending: PendingContinuity,
	timestamp = Date.now(),
): ContinuityContextMessage {
	return {
		role: "custom",
		customType: COMPACTION_LANGUAGE_MESSAGE,
		content: [{ type: "text", text: continuityMarkerText(pending.tag) }],
		display: false,
		details: {
			protocol: COMPACTION_LANGUAGE_PROTOCOL,
			compactionId: pending.compactionId,
			tag: pending.tag,
		},
		timestamp,
	};
}

export function projectCompactionContinuity<T>(
	messages: ReadonlyArray<T>,
	state: CompactionLanguageState,
	timestamp = Date.now(),
):
	| {
			messages: Array<T | ContinuityContextMessage>;
			state: CompactionLanguageState;
	  }
	| undefined {
	if (!state.pending || state.pending.injected) return undefined;
	// Pi presents custom messages to the model as user messages. Prepend this
	// one-shot control so the retained task remains the latest request.
	return {
		messages: [continuityContextMessage(state.pending, timestamp), ...messages],
		state: markContinuityInjected(state),
	};
}
