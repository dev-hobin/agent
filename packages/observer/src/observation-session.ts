import { sha256Text } from "./content-hash.ts";
import {
	applyObserverEvent,
	initialObserverState,
	normalizeObserverEvent,
	type ObserverState,
} from "./lifecycle.ts";
import { reconstructMemoSession } from "./memo-session.ts";
import type { WorkingSourceBasis } from "./memo-reconciliation.ts";
import type { InquiryId } from "./memo-profile.ts";
import {
	decodeObservationEvent,
	encodeObservationEvent,
	observationMemoRequestDigest,
	OBSERVER_OBSERVATION_ENTRY,
	type CandidateCapturedEvent,
	type CandidateId,
	type InquiryHydratedEvent,
	type MemoRequestId,
	type ObservationEvent,
	type ObservationId,
	type ObservationMemoRequestedEvent,
	type SemanticObservationRecordedEvent,
	type SourceReadId,
	type SourceReadRecordedEvent,
	type UserHypothesisRecordedEvent,
} from "./observation-profile.ts";
import {
	OBSERVER_LIFECYCLE_ENTRY,
	type PiBranchEntryLike,
} from "./pi-session.ts";

export type ObservationSessionIssueCode =
	| "observation-session.conflict"
	| "observation-session.lifecycle"
	| "observation-session.malformed"
	| "observation-session.order"
	| "observation-session.scope";

export interface ObservationSessionIssue {
	readonly index: number;
	readonly code: ObservationSessionIssueCode;
	readonly message: string;
	readonly relatedId?: string;
}

export interface PendingObservationHypothesis {
	readonly inquiryId: InquiryId;
	readonly observationId: ObservationId;
	readonly origin: "user" | "observer";
	readonly original: string;
	readonly current: string;
	readonly context: string;
	readonly sourceReadId: SourceReadId | null;
}

export interface ObservationSessionSnapshot {
	readonly lifecycle: ObserverState;
	readonly candidates: readonly CandidateCapturedEvent[];
	readonly sourceReads: readonly SourceReadRecordedEvent[];
	readonly hydrations: readonly InquiryHydratedEvent[];
	readonly observations: readonly SemanticObservationRecordedEvent[];
	readonly userHypotheses: readonly UserHypothesisRecordedEvent[];
	readonly memoRequests: readonly ObservationMemoRequestedEvent[];
	readonly pendingMemoRequest: ObservationMemoRequestedEvent | null;
	readonly pendingHypotheses: readonly PendingObservationHypothesis[];
	readonly consumedObservationIds: readonly ObservationId[];
	readonly unconsumedObservationIds: readonly ObservationId[];
	readonly workingSourceBases: readonly WorkingSourceBasis[];
	readonly issues: readonly ObservationSessionIssue[];
}

function assertNever(value: never): never {
	throw new Error(`Unhandled observation session event: ${String(value)}`);
}

function issue(
	issues: ObservationSessionIssue[],
	index: number,
	code: ObservationSessionIssueCode,
	message: string,
): void {
	issues.push({ index, code, message });
}

function eventIdentity(event: ObservationEvent): string {
	switch (event.kind) {
		case "candidate-captured":
			return event.candidateId;
		case "source-read-recorded":
			return event.readId;
		case "inquiry-hydrated":
			return event.hydrationId;
		case "semantic-observation-recorded":
		case "user-hypothesis-recorded":
			return event.observationId;
		case "memo-requested":
			return event.requestId;
		default:
			return assertNever(event);
	}
}

function sameStrings(
	left: readonly string[],
	right: readonly string[],
): boolean {
	return (
		left.length === right.length &&
		left.every((value, index) => value === right[index])
	);
}

export function observationCandidateDigest(
	candidates: readonly CandidateCapturedEvent[],
): string {
	return sha256Text(
		JSON.stringify(
			candidates.map((candidate) => ({
				candidateId: candidate.candidateId,
				contentHash: candidate.contentHash,
			})),
		),
	);
}

function requiresActiveObservation(event: ObservationEvent): boolean {
	return event.kind !== "memo-requested";
}

function hasLiveEpisode(
	lifecycle: ObserverState,
	episodeId: string,
	modeRequired: boolean,
): boolean {
	return (
		lifecycle.episode.status === "open" &&
		lifecycle.episode.core.episodeId === episodeId &&
		(!modeRequired || lifecycle.mode === "on")
	);
}

function applyCandidate(input: {
	readonly event: CandidateCapturedEvent;
	readonly index: number;
	readonly lifecycle: ObserverState;
	readonly candidates: Map<CandidateId, CandidateCapturedEvent>;
	readonly issues: ObservationSessionIssue[];
}): void {
	if (!hasLiveEpisode(input.lifecycle, input.event.episodeId, true)) {
		issue(
			input.issues,
			input.index,
			"observation-session.scope",
			"Candidate capture requires the current active episode.",
		);
		return;
	}
	input.candidates.set(input.event.candidateId, input.event);
}

function applySourceRead(input: {
	readonly event: SourceReadRecordedEvent;
	readonly index: number;
	readonly lifecycle: ObserverState;
	readonly candidates: ReadonlyMap<CandidateId, CandidateCapturedEvent>;
	readonly usedCandidateIds: Set<CandidateId>;
	readonly sourceReads: Map<SourceReadId, SourceReadRecordedEvent>;
	readonly issues: ObservationSessionIssue[];
}): void {
	if (!hasLiveEpisode(input.lifecycle, input.event.episodeId, true)) {
		issue(
			input.issues,
			input.index,
			"observation-session.scope",
			"Source read requires the current active episode.",
		);
		return;
	}
	const candidates = input.event.candidateIds.flatMap((id) => {
		const candidate = input.candidates.get(id);
		return candidate ? [candidate] : [];
	});
	if (
		candidates.length !== input.event.candidateIds.length ||
		candidates.some(
			(candidate) =>
				candidate.episodeId !== input.event.episodeId ||
				input.usedCandidateIds.has(candidate.candidateId),
		) ||
		observationCandidateDigest(candidates) !== input.event.candidateDigest
	) {
		issue(
			input.issues,
			input.index,
			"observation-session.order",
			"Source read has missing, reused, or mismatched candidates.",
		);
		return;
	}
	for (const candidate of candidates)
		input.usedCandidateIds.add(candidate.candidateId);
	input.sourceReads.set(input.event.readId, input.event);
}

function applyHydration(input: {
	readonly event: InquiryHydratedEvent;
	readonly index: number;
	readonly lifecycle: ObserverState;
	readonly sourceReads: ReadonlyMap<SourceReadId, SourceReadRecordedEvent>;
	readonly hydrations: Map<string, InquiryHydratedEvent>;
	readonly issues: ObservationSessionIssue[];
}): void {
	const read = input.sourceReads.get(input.event.readId);
	if (
		!hasLiveEpisode(input.lifecycle, input.event.episodeId, true) ||
		!read ||
		read.episodeId !== input.event.episodeId ||
		read.indexDigest !== input.event.indexDigest ||
		input.event.inquiryIds.some((id) => !read.indexInquiryIds.includes(id))
	) {
		issue(
			input.issues,
			input.index,
			"observation-session.order",
			"Hydration does not match a source read and its standing index.",
		);
		return;
	}
	input.hydrations.set(input.event.hydrationId, input.event);
}

function applySemanticObservation(input: {
	readonly event: SemanticObservationRecordedEvent;
	readonly index: number;
	readonly lifecycle: ObserverState;
	readonly sourceReads: ReadonlyMap<SourceReadId, SourceReadRecordedEvent>;
	readonly hydrations: ReadonlyMap<string, InquiryHydratedEvent>;
	readonly observations: Map<ObservationId, SemanticObservationRecordedEvent>;
	readonly observedReadIds: Set<SourceReadId>;
	readonly issues: ObservationSessionIssue[];
}): void {
	const read = input.sourceReads.get(input.event.readId);
	const hydration = input.event.hydrationId
		? input.hydrations.get(input.event.hydrationId)
		: null;
	let hydrationMatches: boolean;
	if (input.event.relatedInquiryIds.length === 0) {
		hydrationMatches = hydration === null;
	} else if (!hydration) {
		hydrationMatches = false;
	} else {
		hydrationMatches =
			hydration.readId === input.event.readId &&
			sameStrings(hydration.inquiryIds, input.event.relatedInquiryIds);
	}
	if (
		!hasLiveEpisode(input.lifecycle, input.event.episodeId, true) ||
		!read ||
		read.episodeId !== input.event.episodeId ||
		!hydrationMatches ||
		input.observedReadIds.has(input.event.readId)
	) {
		issue(
			input.issues,
			input.index,
			"observation-session.order",
			"Semantic observation does not match its read/hydration history.",
		);
		return;
	}
	input.observedReadIds.add(input.event.readId);
	input.observations.set(input.event.observationId, input.event);
}

function applyUserHypothesis(input: {
	readonly event: UserHypothesisRecordedEvent;
	readonly index: number;
	readonly lifecycle: ObserverState;
	readonly candidates: ReadonlyMap<CandidateId, CandidateCapturedEvent>;
	readonly userHypotheses: Map<ObservationId, UserHypothesisRecordedEvent>;
	readonly issues: ObservationSessionIssue[];
}): void {
	const candidate = input.candidates.get(input.event.candidateId);
	if (
		!hasLiveEpisode(input.lifecycle, input.event.episodeId, true) ||
		!candidate ||
		candidate.episodeId !== input.event.episodeId ||
		candidate.origin.kind !== "user-input"
	) {
		issue(
			input.issues,
			input.index,
			"observation-session.order",
			"User hypothesis requires a current user-input candidate.",
		);
		return;
	}
	input.userHypotheses.set(input.event.observationId, input.event);
}

function applyMemoRequest(input: {
	readonly event: ObservationMemoRequestedEvent;
	readonly index: number;
	readonly lifecycle: ObserverState;
	readonly observations: ReadonlyMap<
		ObservationId,
		SemanticObservationRecordedEvent
	>;
	readonly userHypotheses: ReadonlyMap<
		ObservationId,
		UserHypothesisRecordedEvent
	>;
	readonly requestedObservationIds: ReadonlySet<ObservationId>;
	readonly currentMemoRevisionId: string | null;
	readonly memoRequests: Map<MemoRequestId, ObservationMemoRequestedEvent>;
	readonly issues: ObservationSessionIssue[];
}): void {
	const available = new Map<
		ObservationId,
		SemanticObservationRecordedEvent | UserHypothesisRecordedEvent
	>([...input.observations, ...input.userHypotheses]);
	const requestObservations = input.event.observationIds.flatMap((id) => {
		const observation = available.get(id);
		return observation ? [observation] : [];
	});
	const sortedIds = input.event.observationIds.toSorted((left, right) =>
		left.localeCompare(right),
	);
	const eligibleIds = [...available.keys()]
		.filter((id) => !input.requestedObservationIds.has(id))
		.toSorted((left, right) => left.localeCompare(right));
	if (
		!hasLiveEpisode(input.lifecycle, input.event.episodeId, false) ||
		input.event.baseMemoRevisionId !== input.currentMemoRevisionId ||
		requestObservations.length !== input.event.observationIds.length ||
		!sameStrings(input.event.observationIds, sortedIds) ||
		!sameStrings(input.event.observationIds, eligibleIds) ||
		input.event.observationIds.some((id) =>
			input.requestedObservationIds.has(id),
		) ||
		input.event.requestDigest !==
			observationMemoRequestDigest({
				episodeId: input.event.episodeId,
				baseMemoRevisionId: input.event.baseMemoRevisionId,
				observations: requestObservations,
			})
	) {
		issue(
			input.issues,
			input.index,
			"observation-session.order",
			"Memo request has stale, unavailable, reused, unsorted, or mismatched observations.",
		);
		return;
	}
	input.memoRequests.set(input.event.requestId, input.event);
}

function sortById<Value>(
	values: Iterable<Value>,
	id: (value: Value) => string,
): readonly Value[] {
	return [...values].toSorted((left, right) =>
		id(left).localeCompare(id(right)),
	);
}

function workingSourceBases(input: {
	readonly sourceReads: ReadonlyMap<SourceReadId, SourceReadRecordedEvent>;
	readonly observations: readonly SemanticObservationRecordedEvent[];
	readonly unconsumed: ReadonlySet<ObservationId>;
}): readonly WorkingSourceBasis[] {
	const usedReadIds = new Set(
		input.observations.flatMap((observation) =>
			input.unconsumed.has(observation.observationId)
				? [observation.readId]
				: [],
		),
	);
	return [...usedReadIds]
		.flatMap((readId) => {
			const read = input.sourceReads.get(readId);
			return read
				? [
						{
							sourceId: read.source.sourceId,
							path: `session:observer/${read.readId}`,
							sha256: read.digest,
						},
					]
				: [];
		})
		.toSorted((left, right) => left.sourceId.localeCompare(right.sourceId));
}

export function reconstructObservationSession(
	entries: readonly PiBranchEntryLike[],
): ObservationSessionSnapshot {
	let lifecycle = initialObserverState();
	const issues: ObservationSessionIssue[] = [];
	const signatures = new Map<string, string>();
	const candidates = new Map<CandidateId, CandidateCapturedEvent>();
	const sourceReads = new Map<SourceReadId, SourceReadRecordedEvent>();
	const hydrations = new Map<string, InquiryHydratedEvent>();
	const observations = new Map<
		ObservationId,
		SemanticObservationRecordedEvent
	>();
	const userHypotheses = new Map<ObservationId, UserHypothesisRecordedEvent>();
	const memoRequests = new Map<MemoRequestId, ObservationMemoRequestedEvent>();
	const requestIndices = new Map<MemoRequestId, number>();
	const usedCandidateIds = new Set<CandidateId>();
	const observedReadIds = new Set<SourceReadId>();

	for (const [index, entry] of entries.entries()) {
		if (entry.type !== "custom") continue;
		if (entry.customType === OBSERVER_LIFECYCLE_ENTRY) {
			const decoded = normalizeObserverEvent(entry.data);
			if (!decoded.ok) {
				issue(
					issues,
					index,
					"observation-session.lifecycle",
					"Lifecycle entry is malformed.",
				);
				continue;
			}
			const applied = applyObserverEvent(lifecycle, decoded.event);
			if (!applied.applied) {
				issue(
					issues,
					index,
					"observation-session.lifecycle",
					`Lifecycle entry was rejected: ${applied.reason}.`,
				);
				continue;
			}
			lifecycle = applied.state;
			continue;
		}
		if (entry.customType !== OBSERVER_OBSERVATION_ENTRY) continue;
		const decoded = decodeObservationEvent(entry.data);
		if (!decoded.ok) {
			issue(
				issues,
				index,
				"observation-session.malformed",
				decoded.issue.message,
			);
			continue;
		}
		const identity = eventIdentity(decoded.value);
		const signature = JSON.stringify(encodeObservationEvent(decoded.value));
		const prior = signatures.get(identity);
		if (prior) {
			if (prior !== signature) {
				issue(
					issues,
					index,
					"observation-session.conflict",
					`Observation event identity conflicts: ${identity}.`,
				);
			}
			continue;
		}
		if (
			!hasLiveEpisode(
				lifecycle,
				decoded.value.episodeId,
				requiresActiveObservation(decoded.value),
			)
		) {
			issue(
				issues,
				index,
				"observation-session.scope",
				`Observation event targets an inactive or different episode: ${identity}.`,
			);
			continue;
		}
		const requestedObservationIds = new Set(
			[...memoRequests.values()].flatMap((request) => request.observationIds),
		);
		switch (decoded.value.kind) {
			case "candidate-captured":
				applyCandidate({
					event: decoded.value,
					index,
					lifecycle,
					candidates,
					issues,
				});
				break;
			case "source-read-recorded":
				applySourceRead({
					event: decoded.value,
					index,
					lifecycle,
					candidates,
					usedCandidateIds,
					sourceReads,
					issues,
				});
				break;
			case "inquiry-hydrated":
				applyHydration({
					event: decoded.value,
					index,
					lifecycle,
					sourceReads,
					hydrations,
					issues,
				});
				break;
			case "semantic-observation-recorded":
				applySemanticObservation({
					event: decoded.value,
					index,
					lifecycle,
					sourceReads,
					hydrations,
					observations,
					observedReadIds,
					issues,
				});
				break;
			case "user-hypothesis-recorded":
				applyUserHypothesis({
					event: decoded.value,
					index,
					lifecycle,
					candidates,
					userHypotheses,
					issues,
				});
				break;
			case "memo-requested":
				applyMemoRequest({
					event: decoded.value,
					index,
					lifecycle,
					observations,
					userHypotheses,
					requestedObservationIds,
					currentMemoRevisionId: reconstructMemoSession(entries.slice(0, index))
						.state.revisionId,
					memoRequests,
					issues,
				});
				break;
			default:
				assertNever(decoded.value);
		}
		if (issues.at(-1)?.index !== index) {
			signatures.set(identity, signature);
			if (decoded.value.kind === "memo-requested") {
				requestIndices.set(decoded.value.requestId, index);
			}
		}
	}

	const memo = reconstructMemoSession(entries);
	const consumedRequestIds = new Set(
		memo.acknowledgedPasses.flatMap((pass) =>
			pass.instructionId ? [pass.instructionId] : [],
		),
	);
	const pendingMemoRequests = [...memoRequests.values()]
		.filter((request) => !consumedRequestIds.has(request.requestId))
		.toSorted((left, right) => left.requestId.localeCompare(right.requestId));
	if (pendingMemoRequests.length > 1) {
		const conflicting = pendingMemoRequests[1];
		issue(
			issues,
			conflicting
				? (requestIndices.get(conflicting.requestId) ?? entries.length)
				: entries.length,
			"observation-session.conflict",
			"Only one unacknowledged Memo request may exist.",
		);
	}
	const consumedObservationIds = new Set<ObservationId>(
		[...memoRequests.values()].flatMap((request) =>
			consumedRequestIds.has(request.requestId) ? request.observationIds : [],
		),
	);
	const allObservationIds = [
		...observations.keys(),
		...userHypotheses.keys(),
	].toSorted((left, right) => left.localeCompare(right));
	const unconsumedObservationIds = allObservationIds.filter(
		(id) => !consumedObservationIds.has(id),
	);
	const unconsumed = new Set(unconsumedObservationIds);
	const observationValues = sortById(
		observations.values(),
		(value) => value.observationId,
	);
	const userValues = sortById(
		userHypotheses.values(),
		(value) => value.observationId,
	);
	const pendingHypotheses: PendingObservationHypothesis[] = [
		...userValues.flatMap((event): PendingObservationHypothesis[] =>
			unconsumed.has(event.observationId)
				? [
						{
							inquiryId: event.inquiryId,
							observationId: event.observationId,
							origin: "user",
							original: event.original,
							current: event.original,
							context: event.context,
							sourceReadId: null,
						},
					]
				: [],
		),
		...observationValues.flatMap((event): PendingObservationHypothesis[] =>
			unconsumed.has(event.observationId) && event.observerHypothesis
				? [
						{
							inquiryId: event.observerHypothesis.inquiryId,
							observationId: event.observationId,
							origin: "observer",
							original: event.observerHypothesis.original,
							current: event.observerHypothesis.original,
							context: event.rationale,
							sourceReadId: event.readId,
						},
					]
				: [],
		),
	].toSorted((left, right) => left.inquiryId.localeCompare(right.inquiryId));

	return {
		lifecycle,
		candidates: sortById(candidates.values(), (value) => value.candidateId),
		sourceReads: sortById(sourceReads.values(), (value) => value.readId),
		hydrations: sortById(hydrations.values(), (value) => value.hydrationId),
		observations: observationValues,
		userHypotheses: userValues,
		memoRequests: sortById(memoRequests.values(), (value) => value.requestId),
		pendingMemoRequest: pendingMemoRequests[0] ?? null,
		pendingHypotheses,
		consumedObservationIds: [...consumedObservationIds].toSorted(
			(left, right) => left.localeCompare(right),
		),
		unconsumedObservationIds,
		workingSourceBases: workingSourceBases({
			sourceReads,
			observations: observationValues,
			unconsumed,
		}),
		issues,
	};
}
