import { isSha256 } from "./content-hash.ts";
import { decodeInquiryId, type InquiryId } from "./memo-profile.ts";
import {
	decodeCandidateId,
	decodeHydrationId,
	decodeMemoRequestId,
	decodeSourceReadId,
	type CandidateId,
	type HydrationId,
	type MemoRequestId,
	type ObservationMovement,
	type ObservationStance,
	type SourceClaim,
	type SourceReadId,
} from "./observation-profile.ts";

export const OBSERVER_SIDECAR_ACTION_PROTOCOL: "observer-sidecar/v1" =
	"observer-sidecar/v1";

const OBSERVATION_ACTION_MARKER = Symbol("observer.sidecar-action");
const BCP47 = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/u;
const MAX_TEXT = 20_000;
const MAX_ITEMS = 1_000;

export type WorkingSourceDraft =
	| {
			readonly kind: "external-material";
			readonly title: string;
			readonly lang: string;
			readonly uri: string | null;
			readonly revision: string | null;
			readonly contentHash: string | null;
			readonly retrievalContext: string | null;
	  }
	| {
			readonly kind: "direct-observation";
			readonly title: string;
			readonly lang: string;
			readonly observedAt: string;
			readonly observedBy: string;
			readonly fact: string;
			readonly conditions: string;
			readonly interpretationBoundary: string;
	  };

interface SidecarActionBase {
	readonly [OBSERVATION_ACTION_MARKER]: true;
	readonly protocol: typeof OBSERVER_SIDECAR_ACTION_PROTOCOL;
}

export interface SourceReadAction extends SidecarActionBase {
	readonly action: "source-read";
	readonly candidateIds: readonly CandidateId[];
	readonly source: WorkingSourceDraft;
	readonly faithfulSummary: string;
	readonly claims: readonly SourceClaim[];
}

export interface HydrateAction extends SidecarActionBase {
	readonly action: "hydrate";
	readonly readId: SourceReadId;
	readonly indexDigest: string;
	readonly inquiryIds: readonly InquiryId[];
}

export interface RecordObservationAction extends SidecarActionBase {
	readonly action: "record";
	readonly readId: SourceReadId;
	readonly hydrationId: HydrationId | null;
	readonly relatedInquiryIds: readonly InquiryId[];
	readonly stance: ObservationStance;
	readonly movement: ObservationMovement;
	readonly rationale: string;
	readonly observerHypothesis: string | null;
}

export interface RegisterUserHypothesisAction extends SidecarActionBase {
	readonly action: "user-hypothesis";
	readonly candidateId: CandidateId;
	readonly existingInquiryId: InquiryId | null;
	readonly original: string;
	readonly context: string;
}

export interface MemoScopeAction extends SidecarActionBase {
	readonly action: "memo-scope";
	readonly requestId: MemoRequestId;
}

export interface MemoSemanticSubmission {
	readonly evidence: readonly unknown[];
	readonly hypothesisOutcomes: readonly unknown[];
	readonly memoOutcomes: readonly unknown[];
	readonly dispositions: readonly unknown[];
}

type ModelMemoOutcome =
	| { readonly kind: "keep-incubating"; readonly memoId: unknown }
	| {
			readonly kind: "revise-incubating";
			readonly memoId: unknown;
			readonly revision: unknown;
	  }
	| {
			readonly kind: "revise-promotion-candidate";
			readonly memoId: unknown;
			readonly revision: unknown;
	  }
	| {
			readonly kind: "mark-promotion-candidate";
			readonly memoId: unknown;
			readonly reason: unknown;
			readonly evidenceIds: unknown;
	  }
	| {
			readonly kind: "merge";
			readonly sourceIds: unknown;
			readonly target: unknown;
	  }
	| { readonly kind: "create"; readonly memo: unknown };

export interface MemoPrepareAction extends SidecarActionBase {
	readonly action: "memo-prepare";
	readonly requestId: MemoRequestId;
	readonly submission: MemoSemanticSubmission;
}

export type ObservationAction =
	| SourceReadAction
	| HydrateAction
	| RecordObservationAction
	| RegisterUserHypothesisAction
	| MemoScopeAction
	| MemoPrepareAction;

export interface ObservationActionIssue {
	readonly code: "observation-action.object" | "observation-action.shape";
	readonly path: string;
	readonly message: string;
}

export type ObservationActionResult =
	| { readonly ok: true; readonly value: ObservationAction }
	| { readonly ok: false; readonly issue: ObservationActionIssue };

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

function failure(path: string, message: string): ObservationActionResult {
	return {
		ok: false,
		issue: { code: "observation-action.shape", path, message },
	};
}

function parseModelMemoOutcome(value: unknown): ModelMemoOutcome | null {
	if (!isObject(value) || typeof value.kind !== "string") return null;
	switch (value.kind) {
		case "keep-incubating":
			return hasExactKeys(value, ["kind", "memo_id"])
				? { kind: value.kind, memoId: value.memo_id }
				: null;
		case "revise-incubating":
		case "revise-promotion-candidate":
			return hasExactKeys(value, ["kind", "memo_id", "revision"])
				? {
						kind: value.kind,
						memoId: value.memo_id,
						revision: value.revision,
					}
				: null;
		case "mark-promotion-candidate":
			return hasExactKeys(value, ["kind", "memo_id", "reason", "evidence_ids"])
				? {
						kind: value.kind,
						memoId: value.memo_id,
						reason: value.reason,
						evidenceIds: value.evidence_ids,
					}
				: null;
		case "merge":
			return hasExactKeys(value, ["kind", "source_ids", "target"])
				? {
						kind: value.kind,
						sourceIds: value.source_ids,
						target: value.target,
					}
				: null;
		case "create":
			return hasExactKeys(value, ["kind", "memo"])
				? { kind: value.kind, memo: value.memo }
				: null;
		default:
			return null;
	}
}

function lowerModelMemoOutcome(value: ModelMemoOutcome): unknown {
	switch (value.kind) {
		case "keep-incubating":
			return { kind: value.kind, memo_id: value.memoId };
		case "revise-incubating":
			return {
				kind: "revise",
				memo_id: value.memoId,
				revision: value.revision,
				disposition: "incubating",
			};
		case "revise-promotion-candidate":
			return {
				kind: "revise",
				memo_id: value.memoId,
				revision: value.revision,
				disposition: "promotion-candidate",
			};
		case "mark-promotion-candidate":
			return {
				kind: value.kind,
				memo_id: value.memoId,
				reason: value.reason,
				evidence_ids: value.evidenceIds,
			};
		case "merge":
			return {
				kind: value.kind,
				source_ids: value.sourceIds,
				target: value.target,
			};
		case "create":
			return { kind: value.kind, memo: value.memo };
		default:
			throw new Error("Unsupported model Memo outcome.");
	}
}

function parseModelMemoOutcomes(value: unknown): readonly unknown[] | null {
	if (!Array.isArray(value)) return null;
	const outcomes: unknown[] = [];
	for (const candidate of value) {
		const parsed = parseModelMemoOutcome(candidate);
		if (!parsed) return null;
		outcomes.push(lowerModelMemoOutcome(parsed));
	}
	return outcomes;
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

function parseSource(value: unknown): WorkingSourceDraft | null {
	if (!isObject(value) || typeof value.kind !== "string") return null;
	const title = boundedText(value.title, 4_000);
	const lang =
		typeof value.lang === "string" && BCP47.test(value.lang)
			? value.lang
			: null;
	if (!title || !lang) return null;
	if (value.kind === "external-material") {
		if (
			!hasExactKeys(value, [
				"kind",
				"title",
				"lang",
				"uri",
				"revision",
				"content_hash",
				"retrieval_context",
			])
		)
			return null;
		const uri = nullableText(value.uri, 8_000);
		const revision = nullableText(value.revision, 4_000);
		let contentHash: string | null | undefined;
		if (value.content_hash === null) contentHash = null;
		else
			contentHash = isSha256(value.content_hash)
				? value.content_hash
				: undefined;
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
		)
			return null;
		return {
			kind: "external-material",
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
				"title",
				"lang",
				"observed_at",
				"observed_by",
				"fact",
				"conditions",
				"interpretation_boundary",
			])
		)
			return null;
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
		)
			return null;
		return {
			kind: "direct-observation",
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

function isStance(value: unknown): value is ObservationStance {
	return (
		value === "supports" ||
		value === "challenges" ||
		value === "refines" ||
		value === "boundary" ||
		value === "uncertain"
	);
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

function markSourceRead(
	value: Omit<SourceReadAction, typeof OBSERVATION_ACTION_MARKER>,
): SourceReadAction {
	return { ...value, [OBSERVATION_ACTION_MARKER]: true };
}

function markHydrate(
	value: Omit<HydrateAction, typeof OBSERVATION_ACTION_MARKER>,
): HydrateAction {
	return { ...value, [OBSERVATION_ACTION_MARKER]: true };
}

function markRecord(
	value: Omit<RecordObservationAction, typeof OBSERVATION_ACTION_MARKER>,
): RecordObservationAction {
	return { ...value, [OBSERVATION_ACTION_MARKER]: true };
}

function markUserHypothesis(
	value: Omit<RegisterUserHypothesisAction, typeof OBSERVATION_ACTION_MARKER>,
): RegisterUserHypothesisAction {
	return { ...value, [OBSERVATION_ACTION_MARKER]: true };
}

function markMemoScope(
	value: Omit<MemoScopeAction, typeof OBSERVATION_ACTION_MARKER>,
): MemoScopeAction {
	return { ...value, [OBSERVATION_ACTION_MARKER]: true };
}

function markMemoPrepare(
	value: Omit<MemoPrepareAction, typeof OBSERVATION_ACTION_MARKER>,
): MemoPrepareAction {
	return { ...value, [OBSERVATION_ACTION_MARKER]: true };
}

function parseSourceRead(
	value: Readonly<Record<string, unknown>>,
): ObservationActionResult {
	if (
		!hasExactKeys(value, [
			"observer_action",
			"action",
			"candidate_ids",
			"source",
			"faithful_summary",
			"claims",
		])
	)
		return failure("/", "Source-read action has invalid fields.");
	const candidateIds = parseIds(value.candidate_ids, decodeCandidateId, {
		nonempty: true,
		sort: false,
	});
	const source = parseSource(value.source);
	const faithfulSummary = boundedText(value.faithful_summary);
	const claims = parseClaims(value.claims);
	if (!candidateIds || !source || !faithfulSummary || !claims)
		return failure("/", "Source-read action has invalid values.");
	return {
		ok: true,
		value: markSourceRead({
			protocol: OBSERVER_SIDECAR_ACTION_PROTOCOL,
			action: "source-read",
			candidateIds,
			source,
			faithfulSummary,
			claims,
		}),
	};
}

function parseHydrate(
	value: Readonly<Record<string, unknown>>,
): ObservationActionResult {
	if (
		!hasExactKeys(value, [
			"observer_action",
			"action",
			"read_id",
			"index_digest",
			"inquiry_ids",
		])
	)
		return failure("/", "Hydrate action has invalid fields.");
	const readId = decodeSourceReadId(value.read_id);
	const inquiryIds = parseIds(value.inquiry_ids, decodeInquiryId, {
		nonempty: true,
		sort: true,
	});
	if (!readId || !isSha256(value.index_digest) || !inquiryIds)
		return failure("/", "Hydrate action has invalid values.");
	return {
		ok: true,
		value: markHydrate({
			protocol: OBSERVER_SIDECAR_ACTION_PROTOCOL,
			action: "hydrate",
			readId,
			indexDigest: value.index_digest,
			inquiryIds,
		}),
	};
}

function parseRecord(
	value: Readonly<Record<string, unknown>>,
): ObservationActionResult {
	if (
		!hasExactKeys(value, [
			"observer_action",
			"action",
			"read_id",
			"hydration_id",
			"related_inquiry_ids",
			"stance",
			"movement",
			"rationale",
			"observer_hypothesis",
		])
	)
		return failure("/", "Record action has invalid fields.");
	const readId = decodeSourceReadId(value.read_id);
	const hydrationId =
		value.hydration_id === null ? null : decodeHydrationId(value.hydration_id);
	const relatedInquiryIds = parseIds(
		value.related_inquiry_ids,
		decodeInquiryId,
		{ nonempty: false, sort: true },
	);
	const rationale = boundedText(value.rationale);
	const observerHypothesis =
		value.observer_hypothesis === null
			? null
			: boundedText(value.observer_hypothesis);
	if (
		!readId ||
		(value.hydration_id !== null && !hydrationId) ||
		!relatedInquiryIds ||
		!isStance(value.stance) ||
		!isMovement(value.movement) ||
		!rationale ||
		(value.observer_hypothesis !== null && !observerHypothesis) ||
		relatedInquiryIds.length > 0 !== (hydrationId !== null) ||
		(value.movement === "independent-new-hypothesis") !==
			(observerHypothesis !== null)
	)
		return failure("/", "Record action has invalid values.");
	return {
		ok: true,
		value: markRecord({
			protocol: OBSERVER_SIDECAR_ACTION_PROTOCOL,
			action: "record",
			readId,
			hydrationId,
			relatedInquiryIds,
			stance: value.stance,
			movement: value.movement,
			rationale,
			observerHypothesis,
		}),
	};
}

function parseMemoScope(
	value: Readonly<Record<string, unknown>>,
): ObservationActionResult {
	if (!hasExactKeys(value, ["observer_action", "action", "request_id"])) {
		return failure("/", "Memo-scope action has invalid fields.");
	}
	const requestId = decodeMemoRequestId(value.request_id);
	return requestId
		? {
				ok: true,
				value: markMemoScope({
					protocol: OBSERVER_SIDECAR_ACTION_PROTOCOL,
					action: "memo-scope",
					requestId,
				}),
			}
		: failure("/request_id", "Memo-scope request ID is invalid.");
}

function parseMemoPrepare(
	value: Readonly<Record<string, unknown>>,
): ObservationActionResult {
	if (
		!hasExactKeys(value, [
			"observer_action",
			"action",
			"request_id",
			"submission",
		]) ||
		!isObject(value.submission) ||
		!hasExactKeys(value.submission, [
			"evidence",
			"hypothesis_outcomes",
			"memo_outcomes",
			"dispositions",
		])
	) {
		return failure("/", "Memo-prepare action has invalid fields.");
	}
	const requestId = decodeMemoRequestId(value.request_id);
	const memoOutcomes = parseModelMemoOutcomes(value.submission.memo_outcomes);
	if (
		!requestId ||
		!Array.isArray(value.submission.evidence) ||
		!Array.isArray(value.submission.hypothesis_outcomes) ||
		!memoOutcomes ||
		!Array.isArray(value.submission.dispositions)
	) {
		return failure("/", "Memo-prepare action has invalid values.");
	}
	return {
		ok: true,
		value: markMemoPrepare({
			protocol: OBSERVER_SIDECAR_ACTION_PROTOCOL,
			action: "memo-prepare",
			requestId,
			submission: {
				evidence: value.submission.evidence,
				hypothesisOutcomes: value.submission.hypothesis_outcomes,
				memoOutcomes,
				dispositions: value.submission.dispositions,
			},
		}),
	};
}

function parseUserHypothesis(
	value: Readonly<Record<string, unknown>>,
): ObservationActionResult {
	if (
		!hasExactKeys(value, [
			"observer_action",
			"action",
			"candidate_id",
			"existing_inquiry_id",
			"original",
			"context",
		])
	)
		return failure("/", "User-hypothesis action has invalid fields.");
	const candidateId = decodeCandidateId(value.candidate_id);
	const existingInquiryId =
		value.existing_inquiry_id === null
			? null
			: decodeInquiryId(value.existing_inquiry_id);
	const original = boundedText(value.original);
	const context = boundedText(value.context);
	if (
		!candidateId ||
		(value.existing_inquiry_id !== null && !existingInquiryId) ||
		!original ||
		!context
	) {
		return failure("/", "User-hypothesis action has invalid values.");
	}
	return {
		ok: true,
		value: markUserHypothesis({
			protocol: OBSERVER_SIDECAR_ACTION_PROTOCOL,
			action: "user-hypothesis",
			candidateId,
			existingInquiryId,
			original,
			context,
		}),
	};
}

export function decodeObservationAction(
	value: unknown,
): ObservationActionResult {
	if (!isObject(value)) {
		return {
			ok: false,
			issue: {
				code: "observation-action.object",
				path: "/",
				message: "Observer Sidecar action must be an object.",
			},
		};
	}
	if (value.observer_action !== OBSERVER_SIDECAR_ACTION_PROTOCOL) {
		return failure(
			"/observer_action",
			"Observer Sidecar action protocol is unsupported.",
		);
	}
	switch (value.action) {
		case "source-read":
			return parseSourceRead(value);
		case "hydrate":
			return parseHydrate(value);
		case "record":
			return parseRecord(value);
		case "user-hypothesis":
			return parseUserHypothesis(value);
		case "memo-scope":
			return parseMemoScope(value);
		case "memo-prepare":
			return parseMemoPrepare(value);
		default:
			return failure("/action", "Observer Sidecar action is unknown.");
	}
}
