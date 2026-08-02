import { isSha256 } from "./content-hash.ts";
import {
	decodeInquiryId,
	decodeSourceId,
	type InquiryId,
	type SourceId,
} from "./memo-profile.ts";
import {
	decodeCandidateId,
	decodeHydrationId,
	decodeMemoRequestId,
	decodeObservationId,
	decodeSourceReadId,
	type CandidateId,
	type HypothesisReviewAssessment,
	type HydrationId,
	type MemoRequestId,
	type ObservationId,
	type ObservationMovement,
	type ObservationStance,
	type SourceClaim,
	type SourceReadId,
} from "./observation-profile.ts";
import { decodeSaveRequestId, type SaveRequestId } from "./save-trigger.ts";

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
	readonly action: "record-source-reading";
	readonly candidateIds: readonly CandidateId[];
	readonly source: WorkingSourceDraft;
	readonly faithfulSummary: string;
	readonly claims: readonly SourceClaim[];
}

export interface HydrateAction extends SidecarActionBase {
	readonly action: "load-inquiry-context";
	readonly readId: SourceReadId;
	readonly indexDigest: string;
	readonly inquiryIds: readonly InquiryId[];
}

export interface RecordObservationAction extends SidecarActionBase {
	readonly action: "record-observation";
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

export interface HypothesisContextReviewAction extends SidecarActionBase {
	readonly action: "hypothesis-context-review";
	readonly hypothesisObservationId: ObservationId;
	readonly assessment: HypothesisReviewAssessment;
	readonly supportingClues: readonly string[];
	readonly challengingClues: readonly string[];
	readonly missingInformation: readonly string[];
	readonly sourceIds: readonly SourceId[];
	readonly interpretationBoundary: string;
}

export interface LoadMemoContextAction extends SidecarActionBase {
	readonly action: "load-memo-context";
	readonly requestId: MemoRequestId;
}

export interface LoadSaveContextAction extends SidecarActionBase {
	readonly action: "load-save-context";
	readonly requestId: SaveRequestId;
}

export interface PrepareSaveProposalAction extends SidecarActionBase {
	readonly action: "prepare-save-proposal";
	readonly requestId: SaveRequestId;
	readonly summary: string;
	readonly records: readonly unknown[];
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

export interface ReconcileMemoAction extends SidecarActionBase {
	readonly action: "reconcile-memo";
	readonly requestId: MemoRequestId;
	readonly submission: MemoSemanticSubmission;
}

export type ObservationAction =
	| SourceReadAction
	| HydrateAction
	| RecordObservationAction
	| RegisterUserHypothesisAction
	| HypothesisContextReviewAction
	| LoadMemoContextAction
	| ReconcileMemoAction
	| LoadSaveContextAction
	| PrepareSaveProposalAction;

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

function markHypothesisContextReview(
	value: Omit<HypothesisContextReviewAction, typeof OBSERVATION_ACTION_MARKER>,
): HypothesisContextReviewAction {
	return { ...value, [OBSERVATION_ACTION_MARKER]: true };
}

function markLoadMemoContext(
	value: Omit<LoadMemoContextAction, typeof OBSERVATION_ACTION_MARKER>,
): LoadMemoContextAction {
	return { ...value, [OBSERVATION_ACTION_MARKER]: true };
}

function markLoadSaveContext(
	value: Omit<LoadSaveContextAction, typeof OBSERVATION_ACTION_MARKER>,
): LoadSaveContextAction {
	return { ...value, [OBSERVATION_ACTION_MARKER]: true };
}

function markPrepareSaveProposal(
	value: Omit<PrepareSaveProposalAction, typeof OBSERVATION_ACTION_MARKER>,
): PrepareSaveProposalAction {
	return { ...value, [OBSERVATION_ACTION_MARKER]: true };
}

function markReconcileMemo(
	value: Omit<ReconcileMemoAction, typeof OBSERVATION_ACTION_MARKER>,
): ReconcileMemoAction {
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
			action: "record-source-reading",
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
			action: "load-inquiry-context",
			readId,
			indexDigest: value.index_digest,
			inquiryIds,
		}),
	};
}

function parseRecord(
	value: Readonly<Record<string, unknown>>,
	allowIndependentHypothesis = false,
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
	if (!readId) return failure("/read_id", "Record SourceRead ID is invalid.");
	if (value.hydration_id !== null && !hydrationId) {
		return failure("/hydration_id", "Record hydration ID is invalid.");
	}
	if (!relatedInquiryIds) {
		return failure(
			"/related_inquiry_ids",
			"Record related Inquiry IDs are invalid.",
		);
	}
	if (!isStance(value.stance)) {
		return failure("/stance", "Record stance is invalid.");
	}
	if (!isMovement(value.movement)) {
		return failure("/movement", "Record movement is invalid.");
	}
	if (!rationale) return failure("/rationale", "Record rationale is invalid.");
	if (value.observer_hypothesis !== null && !observerHypothesis) {
		return failure(
			"/observer_hypothesis",
			"Record Observer hypothesis is invalid.",
		);
	}
	if (relatedInquiryIds.length > 0 !== (hydrationId !== null)) {
		return failure(
			"/hydration_id",
			"Record hydration must be present exactly when related Inquiry IDs are present.",
		);
	}
	if (
		value.movement === "independent-new-hypothesis" &&
		!allowIndependentHypothesis
	) {
		return failure(
			"/movement",
			"Independent Observer hypotheses require action record-new-hypothesis.",
		);
	}
	if (
		value.movement === "independent-new-hypothesis" &&
		observerHypothesis === null
	) {
		return failure(
			"/observer_hypothesis",
			"Independent-new-hypothesis movement requires an Observer hypothesis.",
		);
	}
	if (
		value.movement !== "independent-new-hypothesis" &&
		observerHypothesis !== null
	) {
		return failure(
			"/observer_hypothesis",
			"Observer hypothesis is allowed only for independent-new-hypothesis movement; use record-new-hypothesis.",
		);
	}
	return {
		ok: true,
		value: markRecord({
			protocol: OBSERVER_SIDECAR_ACTION_PROTOCOL,
			action: "record-observation",
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

function parseRecordNewHypothesis(
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
			"rationale",
			"observer_hypothesis",
		])
	) {
		return failure("/", "Record-new-hypothesis action has invalid fields.");
	}
	return parseRecord(
		{
			...value,
			action: "record-observation",
			movement: "independent-new-hypothesis",
		},
		true,
	);
}

function parseLoadMemoContext(
	value: Readonly<Record<string, unknown>>,
): ObservationActionResult {
	if (!hasExactKeys(value, ["observer_action", "action", "request_id"])) {
		return failure("/", "Memo-scope action has invalid fields.");
	}
	const requestId = decodeMemoRequestId(value.request_id);
	return requestId
		? {
				ok: true,
				value: markLoadMemoContext({
					protocol: OBSERVER_SIDECAR_ACTION_PROTOCOL,
					action: "load-memo-context",
					requestId,
				}),
			}
		: failure("/request_id", "Memo-scope request ID is invalid.");
}

function parseLoadSaveContext(
	value: Readonly<Record<string, unknown>>,
): ObservationActionResult {
	if (!hasExactKeys(value, ["observer_action", "action", "request_id"])) {
		return failure("/", "Save-scope action has invalid fields.");
	}
	const requestId = decodeSaveRequestId(value.request_id);
	return requestId
		? {
				ok: true,
				value: markLoadSaveContext({
					protocol: OBSERVER_SIDECAR_ACTION_PROTOCOL,
					action: "load-save-context",
					requestId,
				}),
			}
		: failure("/request_id", "Save-scope request ID is invalid.");
}

function parsePrepareSaveProposal(
	value: Readonly<Record<string, unknown>>,
): ObservationActionResult {
	if (
		!hasExactKeys(value, [
			"observer_action",
			"action",
			"request_id",
			"summary",
			"records",
		])
	)
		return failure("/", "Save-prepare action has invalid fields.");
	const requestId = decodeSaveRequestId(value.request_id);
	const summary = boundedText(value.summary, 4_000);
	if (
		!requestId ||
		!summary ||
		!Array.isArray(value.records) ||
		value.records.length > MAX_ITEMS
	)
		return failure("/", "Save-prepare action has invalid values.");
	return {
		ok: true,
		value: markPrepareSaveProposal({
			protocol: OBSERVER_SIDECAR_ACTION_PROTOCOL,
			action: "prepare-save-proposal",
			requestId,
			summary,
			records: value.records,
		}),
	};
}

function parseReconcileMemo(
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
		value: markReconcileMemo({
			protocol: OBSERVER_SIDECAR_ACTION_PROTOCOL,
			action: "reconcile-memo",
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

function parseTextItems(value: unknown): readonly string[] | null {
	if (!Array.isArray(value) || value.length > MAX_ITEMS) return null;
	const items = value.map((item) => boundedText(item));
	return items.every((item): item is string => item !== null) ? items : null;
}

function isHypothesisReviewAssessment(
	value: unknown,
): value is HypothesisReviewAssessment {
	return (
		value === "supports" ||
		value === "challenges" ||
		value === "mixed" ||
		value === "insufficient-context"
	);
}

function parseHypothesisContextReview(
	value: Readonly<Record<string, unknown>>,
): ObservationActionResult {
	if (
		!hasExactKeys(value, [
			"observer_action",
			"action",
			"hypothesis_observation_id",
			"assessment",
			"supporting_clues",
			"challenging_clues",
			"missing_information",
			"source_ids",
			"interpretation_boundary",
		])
	)
		return failure("/", "Hypothesis context review has invalid fields.");
	const hypothesisObservationId = decodeObservationId(
		value.hypothesis_observation_id,
	);
	const supportingClues = parseTextItems(value.supporting_clues);
	const challengingClues = parseTextItems(value.challenging_clues);
	const missingInformation = parseTextItems(value.missing_information);
	const sourceIds = parseIds(value.source_ids, decodeSourceId, {
		nonempty: false,
		sort: true,
	});
	const interpretationBoundary = boundedText(value.interpretation_boundary);
	if (
		!hypothesisObservationId ||
		!isHypothesisReviewAssessment(value.assessment) ||
		!supportingClues ||
		!challengingClues ||
		!missingInformation ||
		!sourceIds ||
		!interpretationBoundary
	)
		return failure("/", "Hypothesis context review has invalid values.");
	return {
		ok: true,
		value: markHypothesisContextReview({
			protocol: OBSERVER_SIDECAR_ACTION_PROTOCOL,
			action: "hypothesis-context-review",
			hypothesisObservationId,
			assessment: value.assessment,
			supportingClues,
			challengingClues,
			missingInformation,
			sourceIds,
			interpretationBoundary,
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
		case "record-source-reading":
			return parseSourceRead(value);
		case "load-inquiry-context":
			return parseHydrate(value);
		case "record-observation":
			return parseRecord(value);
		case "record-new-hypothesis":
			return parseRecordNewHypothesis(value);
		case "user-hypothesis":
			return parseUserHypothesis(value);
		case "hypothesis-context-review":
			return parseHypothesisContextReview(value);
		case "load-memo-context":
			return parseLoadMemoContext(value);
		case "reconcile-memo":
			return parseReconcileMemo(value);
		case "load-save-context":
			return parseLoadSaveContext(value);
		case "prepare-save-proposal":
			return parsePrepareSaveProposal(value);
		default:
			return failure("/action", "Observer Sidecar action is unknown.");
	}
}
