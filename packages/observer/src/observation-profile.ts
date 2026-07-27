import { isSha256, sha256Text } from "./content-hash.ts";
import {
	decodeInquiryId,
	decodeSourceId,
	type InquiryId,
	type SourceId,
} from "./memo-profile.ts";

export const OBSERVER_OBSERVATION_PROTOCOL: "observer-observation/v1" =
	"observer-observation/v1";
export const OBSERVER_OBSERVATION_ENTRY = "observer.observation";

const OBSERVATION_EVENT_MARKER = Symbol("observer.observation-event");
const UUID_V4 =
	/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const BCP47 = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/u;
const MAX_TEXT = 20_000;
const MAX_ITEMS = 1_000;

export type CandidateId = `candidate-${string}`;
export type SourceReadId = `source-read-${string}`;
export type HydrationId = `hydration-${string}`;
export type ObservationId = `observation-${string}`;
export type MemoRequestId = `memo-request-${string}`;

export type CandidateOrigin =
	| { readonly kind: "user-input"; readonly inputSource: "interactive" | "rpc" }
	| {
			readonly kind: "tool-result";
			readonly toolCallId: string;
			readonly toolName: string;
	  }
	| { readonly kind: "assistant-result"; readonly turnIndex: number };

export interface ExternalWorkingSource {
	readonly kind: "external-material";
	readonly sourceId: SourceId;
	readonly title: string;
	readonly lang: string;
	readonly uri: string | null;
	readonly revision: string | null;
	readonly contentHash: string | null;
	readonly retrievalContext: string | null;
}

export interface DirectWorkingSource {
	readonly kind: "direct-observation";
	readonly sourceId: SourceId;
	readonly title: string;
	readonly lang: string;
	readonly observedAt: string;
	readonly observedBy: string;
	readonly fact: string;
	readonly conditions: string;
	readonly interpretationBoundary: string;
}

export type WorkingSource = ExternalWorkingSource | DirectWorkingSource;

export interface SourceClaim {
	readonly text: string;
	readonly locator: string | null;
}

export type ObservationMovement =
	| "repeated-support"
	| "minor-refinement"
	| "uncertain-association"
	| "material-boundary-change"
	| "core-counterexample"
	| "independent-new-hypothesis"
	| "major-direction-change"
	| "missed-important-mismatch";

export type ObservationStance =
	| "supports"
	| "challenges"
	| "refines"
	| "boundary"
	| "uncertain";

export type ObservationVisibility = "silent" | "alert";

interface ObservationEventBase {
	readonly [OBSERVATION_EVENT_MARKER]: true;
	readonly protocol: typeof OBSERVER_OBSERVATION_PROTOCOL;
	readonly episodeId: string;
	readonly digest: string;
}

export interface CandidateCapturedEvent extends ObservationEventBase {
	readonly kind: "candidate-captured";
	readonly candidateId: CandidateId;
	readonly origin: CandidateOrigin;
	readonly text: string;
	readonly contentHash: string;
	readonly capturedAt: string;
}

export interface SourceReadRecordedEvent extends ObservationEventBase {
	readonly kind: "source-read-recorded";
	readonly readId: SourceReadId;
	readonly candidateIds: readonly CandidateId[];
	readonly source: WorkingSource;
	readonly faithfulSummary: string;
	readonly claims: readonly SourceClaim[];
	readonly candidateDigest: string;
	readonly indexDigest: string;
	readonly indexInquiryIds: readonly InquiryId[];
}

export interface InquiryHydratedEvent extends ObservationEventBase {
	readonly kind: "inquiry-hydrated";
	readonly hydrationId: HydrationId;
	readonly readId: SourceReadId;
	readonly indexDigest: string;
	readonly inquiryIds: readonly InquiryId[];
	readonly contextDigest: string;
}

export interface ObserverHypothesisCandidate {
	readonly inquiryId: InquiryId;
	readonly original: string;
}

export interface SemanticObservationRecordedEvent extends ObservationEventBase {
	readonly kind: "semantic-observation-recorded";
	readonly observationId: ObservationId;
	readonly readId: SourceReadId;
	readonly hydrationId: HydrationId | null;
	readonly relatedInquiryIds: readonly InquiryId[];
	readonly stance: ObservationStance;
	readonly movement: ObservationMovement;
	readonly rationale: string;
	readonly observerHypothesis: ObserverHypothesisCandidate | null;
	readonly visibility: ObservationVisibility;
}

export interface UserHypothesisRecordedEvent extends ObservationEventBase {
	readonly kind: "user-hypothesis-recorded";
	readonly observationId: ObservationId;
	readonly candidateId: CandidateId;
	readonly inquiryId: InquiryId;
	readonly original: string;
	readonly context: string;
}

export interface ObservationMemoRequestedEvent extends ObservationEventBase {
	readonly kind: "memo-requested";
	readonly requestId: MemoRequestId;
	readonly baseMemoRevisionId: string | null;
	readonly observationIds: readonly ObservationId[];
	readonly requestDigest: string;
}

export type MemoRequestObservation =
	| SemanticObservationRecordedEvent
	| UserHypothesisRecordedEvent;

export function observationMemoRequestDigest(input: {
	readonly episodeId: string;
	readonly baseMemoRevisionId: string | null;
	readonly observations: readonly MemoRequestObservation[];
}): string {
	const observations = input.observations
		.map((observation) => ({
			observation_id: observation.observationId,
			event_digest: observation.digest,
		}))
		.toSorted((left, right) =>
			left.observation_id.localeCompare(right.observation_id),
		);
	return sha256Text(
		JSON.stringify({
			episode_id: input.episodeId,
			base_memo_revision_id: input.baseMemoRevisionId,
			observations,
		}),
	);
}

export type ObservationEvent =
	| CandidateCapturedEvent
	| SourceReadRecordedEvent
	| InquiryHydratedEvent
	| SemanticObservationRecordedEvent
	| UserHypothesisRecordedEvent
	| ObservationMemoRequestedEvent;

export type ObservationProfileIssueCode =
	| "observation-profile.digest"
	| "observation-profile.object"
	| "observation-profile.shape"
	| "observation-profile.unsupported";

export interface ObservationProfileIssue {
	readonly code: ObservationProfileIssueCode;
	readonly path: string;
	readonly message: string;
}

export type ObservationProfileResult =
	| { readonly ok: true; readonly value: ObservationEvent }
	| { readonly ok: false; readonly issue: ObservationProfileIssue };

type EventResult<Event extends ObservationEvent = ObservationEvent> =
	| { readonly ok: true; readonly value: Event }
	| { readonly ok: false; readonly issue: ObservationProfileIssue };

function assertNever(value: never): never {
	throw new Error(`Unhandled observation event: ${String(value)}`);
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(
	value: Readonly<Record<string, unknown>>,
	expected: readonly string[],
): boolean {
	const keys = Object.keys(value);
	return (
		keys.length === expected.length &&
		keys.every((key) => expected.includes(key))
	);
}

function failure<Event extends ObservationEvent>(
	code: ObservationProfileIssueCode,
	path: string,
	message: string,
): EventResult<Event> {
	return { ok: false, issue: { code, path, message } };
}

function boundedText(value: unknown, maximum = MAX_TEXT): string | null {
	if (
		typeof value !== "string" ||
		value !== value.trim() ||
		value.length === 0 ||
		value.length > maximum
	) {
		return null;
	}
	return value;
}

function nullableText(
	value: unknown,
	maximum = MAX_TEXT,
): string | null | undefined {
	if (value === null) return null;
	return boundedText(value, maximum) ?? undefined;
}

function typedUuid<Prefix extends string>(
	value: unknown,
	prefix: Prefix,
): `${Prefix}${string}` | null {
	if (typeof value !== "string" || !value.startsWith(prefix)) return null;
	const suffix = value.slice(prefix.length);
	return UUID_V4.test(suffix) ? `${prefix}${suffix}` : null;
}

export function decodeCandidateId(value: unknown): CandidateId | null {
	return typedUuid(value, "candidate-");
}

export function decodeSourceReadId(value: unknown): SourceReadId | null {
	return typedUuid(value, "source-read-");
}

export function decodeHydrationId(value: unknown): HydrationId | null {
	return typedUuid(value, "hydration-");
}

export function decodeObservationId(value: unknown): ObservationId | null {
	return typedUuid(value, "observation-");
}

export function decodeMemoRequestId(value: unknown): MemoRequestId | null {
	return typedUuid(value, "memo-request-");
}

function isTimestamp(value: unknown): value is string {
	if (typeof value !== "string" || value.length === 0) return false;
	const time = Date.parse(value);
	return Number.isFinite(time) && new Date(time).toISOString() === value;
}

function parseIds<Id extends string>(
	value: unknown,
	decoder: (candidate: unknown) => Id | null,
	options: { readonly nonempty: boolean; readonly sort: boolean },
): readonly Id[] | null {
	if (
		!Array.isArray(value) ||
		value.length > MAX_ITEMS ||
		(options.nonempty && value.length === 0)
	) {
		return null;
	}
	const result: Id[] = [];
	for (const candidate of value) {
		const id = decoder(candidate);
		if (!id || result.includes(id)) return null;
		result.push(id);
	}
	return options.sort
		? result.toSorted((left, right) => left.localeCompare(right))
		: result;
}

function parseCandidateOrigin(value: unknown): CandidateOrigin | null {
	if (!isObject(value) || typeof value.kind !== "string") return null;
	if (value.kind === "user-input") {
		return hasExactKeys(value, ["kind", "input_source"]) &&
			(value.input_source === "interactive" || value.input_source === "rpc")
			? { kind: "user-input", inputSource: value.input_source }
			: null;
	}
	if (value.kind === "tool-result") {
		const toolCallId = boundedText(value.tool_call_id, 300);
		const toolName = boundedText(value.tool_name, 300);
		return hasExactKeys(value, ["kind", "tool_call_id", "tool_name"]) &&
			toolCallId &&
			toolName &&
			toolName !== "observer_sidecar"
			? { kind: "tool-result", toolCallId, toolName }
			: null;
	}
	if (value.kind === "assistant-result") {
		return hasExactKeys(value, ["kind", "turn_index"]) &&
			typeof value.turn_index === "number" &&
			Number.isSafeInteger(value.turn_index) &&
			value.turn_index >= 0
			? { kind: "assistant-result", turnIndex: value.turn_index }
			: null;
	}
	return null;
}

function parseWorkingSource(value: unknown): WorkingSource | null {
	if (!isObject(value) || typeof value.kind !== "string") return null;
	const sourceId = decodeSourceId(value.source_id);
	const title = boundedText(value.title, 4_000);
	const lang =
		typeof value.lang === "string" && BCP47.test(value.lang)
			? value.lang
			: null;
	if (!sourceId || !title || !lang) return null;
	if (value.kind === "external-material") {
		if (
			!hasExactKeys(value, [
				"kind",
				"source_id",
				"title",
				"lang",
				"uri",
				"revision",
				"content_hash",
				"retrieval_context",
			])
		) {
			return null;
		}
		const uri = nullableText(value.uri, 8_000);
		const revision = nullableText(value.revision, 4_000);
		let contentHash: string | null | undefined;
		if (value.content_hash === null) {
			contentHash = null;
		} else {
			contentHash = isSha256(value.content_hash)
				? value.content_hash
				: undefined;
		}
		const retrievalContext = nullableText(value.retrieval_context, 8_000);
		if (
			uri === undefined ||
			revision === undefined ||
			contentHash === undefined ||
			retrievalContext === undefined ||
			(uri === null &&
				revision === null &&
				contentHash === null &&
				retrievalContext === null)
		) {
			return null;
		}
		return {
			kind: "external-material",
			sourceId,
			title,
			lang,
			uri,
			revision,
			contentHash,
			retrievalContext,
		};
	}
	if (value.kind === "direct-observation") {
		if (
			!hasExactKeys(value, [
				"kind",
				"source_id",
				"title",
				"lang",
				"observed_at",
				"observed_by",
				"fact",
				"conditions",
				"interpretation_boundary",
			])
		) {
			return null;
		}
		const observedBy = boundedText(value.observed_by, 4_000);
		const fact = boundedText(value.fact);
		const conditions = boundedText(value.conditions);
		const interpretationBoundary = boundedText(value.interpretation_boundary);
		if (
			!isTimestamp(value.observed_at) ||
			!observedBy ||
			!fact ||
			!conditions ||
			!interpretationBoundary
		) {
			return null;
		}
		return {
			kind: "direct-observation",
			sourceId,
			title,
			lang,
			observedAt: value.observed_at,
			observedBy,
			fact,
			conditions,
			interpretationBoundary,
		};
	}
	return null;
}

function parseClaims(value: unknown): readonly SourceClaim[] | null {
	if (!Array.isArray(value) || value.length === 0 || value.length > MAX_ITEMS)
		return null;
	const claims: SourceClaim[] = [];
	for (const candidate of value) {
		if (!isObject(candidate) || !hasExactKeys(candidate, ["text", "locator"]))
			return null;
		const text = boundedText(candidate.text);
		const locator = nullableText(candidate.locator, 4_000);
		if (!text || locator === undefined) return null;
		claims.push({ text, locator });
	}
	return claims;
}

function isMovement(value: unknown): value is ObservationMovement {
	return (
		value === "repeated-support" ||
		value === "minor-refinement" ||
		value === "uncertain-association" ||
		value === "material-boundary-change" ||
		value === "core-counterexample" ||
		value === "independent-new-hypothesis" ||
		value === "major-direction-change" ||
		value === "missed-important-mismatch"
	);
}

function isStance(value: unknown): value is ObservationStance {
	return (
		value === "supports" ||
		value === "challenges" ||
		value === "refines" ||
		value === "boundary" ||
		value === "uncertain"
	);
}

function visibilityFor(movement: ObservationMovement): ObservationVisibility {
	return movement === "core-counterexample" ||
		movement === "independent-new-hypothesis" ||
		movement === "major-direction-change" ||
		movement === "missed-important-mismatch"
		? "alert"
		: "silent";
}

function parseObserverHypothesis(
	value: unknown,
): ObserverHypothesisCandidate | null | undefined {
	if (value === null) return null;
	if (!isObject(value) || !hasExactKeys(value, ["inquiry_id", "original"]))
		return undefined;
	const inquiryId = decodeInquiryId(value.inquiry_id);
	const original = boundedText(value.original);
	return inquiryId && original ? { inquiryId, original } : undefined;
}

function baseKeys(
	kindKeys: readonly string[],
	persisted: boolean,
): readonly string[] {
	return [
		"observer_observation",
		"kind",
		"episode_id",
		...kindKeys,
		...(persisted ? ["event_digest"] : []),
	];
}

function finishCandidate(
	value: Omit<
		CandidateCapturedEvent,
		typeof OBSERVATION_EVENT_MARKER | "digest"
	>,
): EventResult<CandidateCapturedEvent> {
	const temporary: CandidateCapturedEvent = {
		...value,
		digest: "",
		[OBSERVATION_EVENT_MARKER]: true,
	};
	return {
		ok: true,
		value: {
			...temporary,
			digest: sha256Text(JSON.stringify(eventPayload(temporary))),
		},
	};
}

function finishSourceRead(
	value: Omit<
		SourceReadRecordedEvent,
		typeof OBSERVATION_EVENT_MARKER | "digest"
	>,
): EventResult<SourceReadRecordedEvent> {
	const temporary: SourceReadRecordedEvent = {
		...value,
		digest: "",
		[OBSERVATION_EVENT_MARKER]: true,
	};
	return {
		ok: true,
		value: {
			...temporary,
			digest: sha256Text(JSON.stringify(eventPayload(temporary))),
		},
	};
}

function finishHydration(
	value: Omit<InquiryHydratedEvent, typeof OBSERVATION_EVENT_MARKER | "digest">,
): EventResult<InquiryHydratedEvent> {
	const temporary: InquiryHydratedEvent = {
		...value,
		digest: "",
		[OBSERVATION_EVENT_MARKER]: true,
	};
	return {
		ok: true,
		value: {
			...temporary,
			digest: sha256Text(JSON.stringify(eventPayload(temporary))),
		},
	};
}

function finishSemanticObservation(
	value: Omit<
		SemanticObservationRecordedEvent,
		typeof OBSERVATION_EVENT_MARKER | "digest"
	>,
): EventResult<SemanticObservationRecordedEvent> {
	const temporary: SemanticObservationRecordedEvent = {
		...value,
		digest: "",
		[OBSERVATION_EVENT_MARKER]: true,
	};
	return {
		ok: true,
		value: {
			...temporary,
			digest: sha256Text(JSON.stringify(eventPayload(temporary))),
		},
	};
}

function finishUserHypothesis(
	value: Omit<
		UserHypothesisRecordedEvent,
		typeof OBSERVATION_EVENT_MARKER | "digest"
	>,
): EventResult<UserHypothesisRecordedEvent> {
	const temporary: UserHypothesisRecordedEvent = {
		...value,
		digest: "",
		[OBSERVATION_EVENT_MARKER]: true,
	};
	return {
		ok: true,
		value: {
			...temporary,
			digest: sha256Text(JSON.stringify(eventPayload(temporary))),
		},
	};
}

function finishMemoRequest(
	value: Omit<
		ObservationMemoRequestedEvent,
		typeof OBSERVATION_EVENT_MARKER | "digest"
	>,
): EventResult<ObservationMemoRequestedEvent> {
	const temporary: ObservationMemoRequestedEvent = {
		...value,
		digest: "",
		[OBSERVATION_EVENT_MARKER]: true,
	};
	return {
		ok: true,
		value: {
			...temporary,
			digest: sha256Text(JSON.stringify(eventPayload(temporary))),
		},
	};
}

function parseCandidate(
	value: Readonly<Record<string, unknown>>,
	persisted: boolean,
): EventResult<CandidateCapturedEvent> {
	if (
		!hasExactKeys(
			value,
			baseKeys(
				["candidate_id", "origin", "text", "content_hash", "captured_at"],
				persisted,
			),
		)
	) {
		return failure(
			"observation-profile.shape",
			"/",
			"Candidate event has invalid fields.",
		);
	}
	const candidateId = decodeCandidateId(value.candidate_id);
	const episodeId = boundedText(value.episode_id, 300);
	const origin = parseCandidateOrigin(value.origin);
	const text = boundedText(value.text);
	if (
		!candidateId ||
		!episodeId ||
		!origin ||
		!text ||
		!isSha256(value.content_hash) ||
		value.content_hash !== sha256Text(text) ||
		!isTimestamp(value.captured_at)
	) {
		return failure(
			"observation-profile.shape",
			"/",
			"Candidate event has invalid values.",
		);
	}
	return finishCandidate({
		protocol: OBSERVER_OBSERVATION_PROTOCOL,
		kind: "candidate-captured",
		episodeId,
		candidateId,
		origin,
		text,
		contentHash: value.content_hash,
		capturedAt: value.captured_at,
	});
}

function parseSourceRead(
	value: Readonly<Record<string, unknown>>,
	persisted: boolean,
): EventResult<SourceReadRecordedEvent> {
	if (
		!hasExactKeys(
			value,
			baseKeys(
				[
					"read_id",
					"candidate_ids",
					"source",
					"faithful_summary",
					"claims",
					"candidate_digest",
					"index_digest",
					"index_inquiry_ids",
				],
				persisted,
			),
		)
	) {
		return failure(
			"observation-profile.shape",
			"/",
			"Source-read event has invalid fields.",
		);
	}
	const readId = decodeSourceReadId(value.read_id);
	const episodeId = boundedText(value.episode_id, 300);
	const candidateIds = parseIds(value.candidate_ids, decodeCandidateId, {
		nonempty: true,
		sort: false,
	});
	const source = parseWorkingSource(value.source);
	const faithfulSummary = boundedText(value.faithful_summary);
	const claims = parseClaims(value.claims);
	const indexInquiryIds = parseIds(value.index_inquiry_ids, decodeInquiryId, {
		nonempty: false,
		sort: true,
	});
	if (
		!readId ||
		!episodeId ||
		!candidateIds ||
		!source ||
		!faithfulSummary ||
		!claims ||
		!isSha256(value.candidate_digest) ||
		!isSha256(value.index_digest) ||
		!indexInquiryIds
	) {
		return failure(
			"observation-profile.shape",
			"/",
			"Source-read event has invalid values.",
		);
	}
	return finishSourceRead({
		protocol: OBSERVER_OBSERVATION_PROTOCOL,
		kind: "source-read-recorded",
		episodeId,
		readId,
		candidateIds,
		source,
		faithfulSummary,
		claims,
		candidateDigest: value.candidate_digest,
		indexDigest: value.index_digest,
		indexInquiryIds,
	});
}

function parseHydration(
	value: Readonly<Record<string, unknown>>,
	persisted: boolean,
): EventResult<InquiryHydratedEvent> {
	if (
		!hasExactKeys(
			value,
			baseKeys(
				[
					"hydration_id",
					"read_id",
					"index_digest",
					"inquiry_ids",
					"context_digest",
				],
				persisted,
			),
		)
	) {
		return failure(
			"observation-profile.shape",
			"/",
			"Hydration event has invalid fields.",
		);
	}
	const hydrationId = decodeHydrationId(value.hydration_id);
	const readId = decodeSourceReadId(value.read_id);
	const episodeId = boundedText(value.episode_id, 300);
	const inquiryIds = parseIds(value.inquiry_ids, decodeInquiryId, {
		nonempty: true,
		sort: true,
	});
	if (
		!hydrationId ||
		!readId ||
		!episodeId ||
		!inquiryIds ||
		!isSha256(value.index_digest) ||
		!isSha256(value.context_digest)
	) {
		return failure(
			"observation-profile.shape",
			"/",
			"Hydration event has invalid values.",
		);
	}
	return finishHydration({
		protocol: OBSERVER_OBSERVATION_PROTOCOL,
		kind: "inquiry-hydrated",
		episodeId,
		hydrationId,
		readId,
		indexDigest: value.index_digest,
		inquiryIds,
		contextDigest: value.context_digest,
	});
}

function parseSemanticObservation(
	value: Readonly<Record<string, unknown>>,
	persisted: boolean,
): EventResult<SemanticObservationRecordedEvent> {
	if (
		!hasExactKeys(
			value,
			baseKeys(
				[
					"observation_id",
					"read_id",
					"hydration_id",
					"related_inquiry_ids",
					"stance",
					"movement",
					"rationale",
					"observer_hypothesis",
				],
				persisted,
			),
		)
	) {
		return failure(
			"observation-profile.shape",
			"/",
			"Semantic observation has invalid fields.",
		);
	}
	const observationId = decodeObservationId(value.observation_id);
	const readId = decodeSourceReadId(value.read_id);
	const episodeId = boundedText(value.episode_id, 300);
	const hydrationId =
		value.hydration_id === null ? null : decodeHydrationId(value.hydration_id);
	const relatedInquiryIds = parseIds(
		value.related_inquiry_ids,
		decodeInquiryId,
		{ nonempty: false, sort: true },
	);
	const rationale = boundedText(value.rationale);
	const observerHypothesis = parseObserverHypothesis(value.observer_hypothesis);
	if (
		!observationId ||
		!readId ||
		!episodeId ||
		(value.hydration_id !== null && !hydrationId) ||
		!relatedInquiryIds ||
		!isStance(value.stance) ||
		!isMovement(value.movement) ||
		!rationale ||
		observerHypothesis === undefined ||
		relatedInquiryIds.length > 0 !== (hydrationId !== null) ||
		(value.movement === "independent-new-hypothesis") !==
			(observerHypothesis !== null)
	) {
		return failure(
			"observation-profile.shape",
			"/",
			"Semantic observation has invalid values.",
		);
	}
	return finishSemanticObservation({
		protocol: OBSERVER_OBSERVATION_PROTOCOL,
		kind: "semantic-observation-recorded",
		episodeId,
		observationId,
		readId,
		hydrationId,
		relatedInquiryIds,
		stance: value.stance,
		movement: value.movement,
		rationale,
		observerHypothesis,
		visibility: visibilityFor(value.movement),
	});
}

function parseUserHypothesis(
	value: Readonly<Record<string, unknown>>,
	persisted: boolean,
): EventResult<UserHypothesisRecordedEvent> {
	if (
		!hasExactKeys(
			value,
			baseKeys(
				["observation_id", "candidate_id", "inquiry_id", "original", "context"],
				persisted,
			),
		)
	) {
		return failure(
			"observation-profile.shape",
			"/",
			"User hypothesis has invalid fields.",
		);
	}
	const observationId = decodeObservationId(value.observation_id);
	const candidateId = decodeCandidateId(value.candidate_id);
	const inquiryId = decodeInquiryId(value.inquiry_id);
	const episodeId = boundedText(value.episode_id, 300);
	const original = boundedText(value.original);
	const context = boundedText(value.context);
	if (
		!observationId ||
		!candidateId ||
		!inquiryId ||
		!episodeId ||
		!original ||
		!context
	) {
		return failure(
			"observation-profile.shape",
			"/",
			"User hypothesis has invalid values.",
		);
	}
	return finishUserHypothesis({
		protocol: OBSERVER_OBSERVATION_PROTOCOL,
		kind: "user-hypothesis-recorded",
		episodeId,
		observationId,
		candidateId,
		inquiryId,
		original,
		context,
	});
}

function parseMemoRequest(
	value: Readonly<Record<string, unknown>>,
	persisted: boolean,
): EventResult<ObservationMemoRequestedEvent> {
	if (
		!hasExactKeys(
			value,
			baseKeys(
				[
					"request_id",
					"base_memo_revision_id",
					"observation_ids",
					"request_digest",
				],
				persisted,
			),
		)
	) {
		return failure(
			"observation-profile.shape",
			"/",
			"Memo request has invalid fields.",
		);
	}
	const requestId = decodeMemoRequestId(value.request_id);
	const episodeId = boundedText(value.episode_id, 300);
	const baseMemoRevisionId =
		value.base_memo_revision_id === null
			? null
			: boundedText(value.base_memo_revision_id, 300);
	const observationIds = parseIds(value.observation_ids, decodeObservationId, {
		nonempty: true,
		sort: false,
	});
	if (
		!requestId ||
		!episodeId ||
		(value.base_memo_revision_id !== null && !baseMemoRevisionId) ||
		!observationIds ||
		!isSha256(value.request_digest)
	) {
		return failure(
			"observation-profile.shape",
			"/",
			"Memo request has invalid values.",
		);
	}
	return finishMemoRequest({
		protocol: OBSERVER_OBSERVATION_PROTOCOL,
		kind: "memo-requested",
		episodeId,
		requestId,
		baseMemoRevisionId,
		observationIds,
		requestDigest: value.request_digest,
	});
}

function parseEvent(
	value: unknown,
	persisted: boolean,
): ObservationProfileResult {
	if (!isObject(value))
		return failure(
			"observation-profile.object",
			"/",
			"Observation event must be an object.",
		);
	if (value.observer_observation !== OBSERVER_OBSERVATION_PROTOCOL) {
		return failure(
			typeof value.observer_observation === "string"
				? "observation-profile.unsupported"
				: "observation-profile.shape",
			"/observer_observation",
			"Observation protocol is unsupported.",
		);
	}
	let parsed: ObservationProfileResult;
	switch (value.kind) {
		case "candidate-captured":
			parsed = parseCandidate(value, persisted);
			break;
		case "source-read-recorded":
			parsed = parseSourceRead(value, persisted);
			break;
		case "inquiry-hydrated":
			parsed = parseHydration(value, persisted);
			break;
		case "semantic-observation-recorded":
			parsed = parseSemanticObservation(value, persisted);
			break;
		case "user-hypothesis-recorded":
			parsed = parseUserHypothesis(value, persisted);
			break;
		case "memo-requested":
			parsed = parseMemoRequest(value, persisted);
			break;
		default:
			return failure(
				"observation-profile.shape",
				"/kind",
				"Observation kind is unknown.",
			);
	}
	if (!parsed.ok || !persisted) return parsed;
	return isSha256(value.event_digest) &&
		value.event_digest === parsed.value.digest
		? parsed
		: failure(
				"observation-profile.digest",
				"/event_digest",
				"Observation event digest does not match.",
			);
}

function encodeOrigin(origin: CandidateOrigin): unknown {
	switch (origin.kind) {
		case "user-input":
			return { kind: origin.kind, input_source: origin.inputSource };
		case "tool-result":
			return {
				kind: origin.kind,
				tool_call_id: origin.toolCallId,
				tool_name: origin.toolName,
			};
		case "assistant-result":
			return { kind: origin.kind, turn_index: origin.turnIndex };
		default:
			return assertNever(origin);
	}
}

function encodeSource(source: WorkingSource): unknown {
	switch (source.kind) {
		case "external-material":
			return {
				kind: source.kind,
				source_id: source.sourceId,
				title: source.title,
				lang: source.lang,
				uri: source.uri,
				revision: source.revision,
				content_hash: source.contentHash,
				retrieval_context: source.retrievalContext,
			};
		case "direct-observation":
			return {
				kind: source.kind,
				source_id: source.sourceId,
				title: source.title,
				lang: source.lang,
				observed_at: source.observedAt,
				observed_by: source.observedBy,
				fact: source.fact,
				conditions: source.conditions,
				interpretation_boundary: source.interpretationBoundary,
			};
		default:
			return assertNever(source);
	}
}

function eventPayload(event: ObservationEvent): Record<string, unknown> {
	switch (event.kind) {
		case "candidate-captured":
			return {
				observer_observation: event.protocol,
				kind: event.kind,
				episode_id: event.episodeId,
				candidate_id: event.candidateId,
				origin: encodeOrigin(event.origin),
				text: event.text,
				content_hash: event.contentHash,
				captured_at: event.capturedAt,
			};
		case "source-read-recorded":
			return {
				observer_observation: event.protocol,
				kind: event.kind,
				episode_id: event.episodeId,
				read_id: event.readId,
				candidate_ids: event.candidateIds,
				source: encodeSource(event.source),
				faithful_summary: event.faithfulSummary,
				claims: event.claims.map((claim) => ({
					text: claim.text,
					locator: claim.locator,
				})),
				candidate_digest: event.candidateDigest,
				index_digest: event.indexDigest,
				index_inquiry_ids: event.indexInquiryIds,
			};
		case "inquiry-hydrated":
			return {
				observer_observation: event.protocol,
				kind: event.kind,
				episode_id: event.episodeId,
				hydration_id: event.hydrationId,
				read_id: event.readId,
				index_digest: event.indexDigest,
				inquiry_ids: event.inquiryIds,
				context_digest: event.contextDigest,
			};
		case "semantic-observation-recorded":
			return {
				observer_observation: event.protocol,
				kind: event.kind,
				episode_id: event.episodeId,
				observation_id: event.observationId,
				read_id: event.readId,
				hydration_id: event.hydrationId,
				related_inquiry_ids: event.relatedInquiryIds,
				stance: event.stance,
				movement: event.movement,
				rationale: event.rationale,
				observer_hypothesis: event.observerHypothesis
					? {
							inquiry_id: event.observerHypothesis.inquiryId,
							original: event.observerHypothesis.original,
						}
					: null,
			};
		case "user-hypothesis-recorded":
			return {
				observer_observation: event.protocol,
				kind: event.kind,
				episode_id: event.episodeId,
				observation_id: event.observationId,
				candidate_id: event.candidateId,
				inquiry_id: event.inquiryId,
				original: event.original,
				context: event.context,
			};
		case "memo-requested":
			return {
				observer_observation: event.protocol,
				kind: event.kind,
				episode_id: event.episodeId,
				request_id: event.requestId,
				base_memo_revision_id: event.baseMemoRevisionId,
				observation_ids: event.observationIds,
				request_digest: event.requestDigest,
			};
		default:
			return assertNever(event);
	}
}

export function isObservationEvent(value: unknown): value is ObservationEvent {
	return (
		isObject(value) && Reflect.get(value, OBSERVATION_EVENT_MARKER) === true
	);
}

export function prepareObservationEvent(
	value: unknown,
): ObservationProfileResult {
	return parseEvent(value, false);
}

export function decodeObservationEvent(
	value: unknown,
): ObservationProfileResult {
	return parseEvent(value, true);
}

export function encodeObservationEvent(event: ObservationEvent): unknown {
	if (!isObservationEvent(event)) {
		throw new Error("Observation event must come from its parser.");
	}
	return { ...eventPayload(event), event_digest: event.digest };
}
