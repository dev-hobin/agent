import { isSha256, sha256Text } from "./content-hash.ts";

export const OBSERVER_PREPARED_MEMO_PASS_PROTOCOL: "observer.prepared-memo-pass/v1" =
	"observer.prepared-memo-pass/v1";

const PREPARED_MEMO_PASS_MARKER = Symbol("observer.prepared-memo-pass");
const UUID_V4 =
	/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const MAX_ID_LENGTH = 200;
const MAX_TEXT_LENGTH = 20_000;
const MAX_SUMMARY_LENGTH = 4_000;
const MAX_ITEMS = 1_000;

export type MemoId = `memo-${string}`;
export type InquiryId = `inquiry-${string}`;
export type SourceId = `source-${string}`;
export type EvidenceId = `evidence-${string}`;
export type MemoPassId = `memo-pass-${string}`;
export type MemoRevisionId = `memo-revision-${string}`;
export type MemoDisposition = "incubating" | "promotion-candidate";

export interface EvidenceItem {
	readonly evidenceId: EvidenceId;
	readonly kind: "source-claim" | "direct-observation" | "counterexample";
	readonly sourceId: SourceId | null;
	readonly summary: string;
}

export interface WorkingHypothesisDraft {
	readonly inquiryId: InquiryId;
	readonly episodeId: string;
	readonly origin: "user" | "observer";
	readonly original: string;
	readonly current: string;
	readonly revisionReason: string | null;
	readonly evidenceIds: readonly EvidenceId[];
}

export interface WorkingMemoDraft {
	readonly memoId: MemoId;
	readonly episodeId: string;
	readonly title: string;
	readonly lang: "ko" | "en";
	readonly content: string;
	readonly inquiryIds: readonly InquiryId[];
	readonly hypothesisId: InquiryId | null;
	readonly evidenceIds: readonly EvidenceId[];
	readonly reason: string;
}

export interface MemoRevisionDraft {
	readonly revisionId: MemoRevisionId;
	readonly title: string;
	readonly content: string;
	readonly evidenceIds: readonly EvidenceId[];
	readonly reason: string;
}

export type HypothesisOutcome =
	| { readonly kind: "keep"; readonly inquiryId: InquiryId }
	| { readonly kind: "create"; readonly hypothesis: WorkingHypothesisDraft }
	| {
			readonly kind: "revise";
			readonly inquiryId: InquiryId;
			readonly current: string;
			readonly revisionReason: string;
			readonly evidenceIds: readonly EvidenceId[];
	  };

export type MemoOutcome =
	| { readonly kind: "keep-incubating"; readonly memoId: MemoId }
	| {
			readonly kind: "revise";
			readonly memoId: MemoId;
			readonly revision: MemoRevisionDraft;
			readonly disposition: MemoDisposition;
	  }
	| {
			readonly kind: "mark-promotion-candidate";
			readonly memoId: MemoId;
			readonly reason: string;
			readonly evidenceIds: readonly EvidenceId[];
	  }
	| {
			readonly kind: "merge";
			readonly sourceIds: readonly MemoId[];
			readonly target: WorkingMemoDraft;
	  }
	| { readonly kind: "create"; readonly memo: WorkingMemoDraft };

export interface PreparedMemoPass {
	readonly [PREPARED_MEMO_PASS_MARKER]: true;
	readonly protocol: typeof OBSERVER_PREPARED_MEMO_PASS_PROTOCOL;
	readonly passId: MemoPassId;
	readonly episodeId: string;
	readonly baseRevisionId: string | null;
	readonly basisDigest: string;
	readonly relatedInquiryIds: readonly InquiryId[];
	readonly instructionId: string | null;
	readonly evidence: readonly EvidenceItem[];
	readonly hypothesisOutcomes: readonly HypothesisOutcome[];
	readonly memoOutcomes: readonly MemoOutcome[];
	readonly digest: string;
}

export type MemoProfileIssueCode =
	| "memo-profile.duplicate"
	| "memo-profile.object"
	| "memo-profile.shape"
	| "memo-profile.unsupported";

export interface MemoProfileIssue {
	readonly code: MemoProfileIssueCode;
	readonly path: string;
	readonly message: string;
}

export type MemoProfileResult =
	| { readonly ok: true; readonly value: PreparedMemoPass }
	| { readonly ok: false; readonly issue: MemoProfileIssue };

type DecodeResult<Value> =
	| { readonly ok: true; readonly value: Value }
	| { readonly ok: false; readonly issue: MemoProfileIssue };

function assertNever(value: never): never {
	throw new Error(`Unhandled Memo outcome: ${String(value)}`);
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

function failure<Value>(
	code: MemoProfileIssueCode,
	path: string,
	message: string,
): DecodeResult<Value> {
	return { ok: false, issue: { code, path, message } };
}

function boundedText(value: unknown, maximum = MAX_TEXT_LENGTH): string | null {
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

function optionalIdentifier(value: unknown): string | null | undefined {
	if (value === null) return null;
	return boundedText(value, MAX_ID_LENGTH) ?? undefined;
}

function typedUuid<Prefix extends string>(
	value: unknown,
	prefix: Prefix,
): `${Prefix}${string}` | null {
	if (typeof value !== "string" || !value.startsWith(prefix)) return null;
	const suffix = value.slice(prefix.length);
	return UUID_V4.test(suffix) ? `${prefix}${suffix}` : null;
}

function memoId(value: unknown): MemoId | null {
	return typedUuid(value, "memo-");
}

export function decodeMemoId(value: unknown): MemoId | null {
	return memoId(value);
}

function inquiryId(value: unknown): InquiryId | null {
	return typedUuid(value, "inquiry-");
}

export function decodeInquiryId(value: unknown): InquiryId | null {
	return inquiryId(value);
}

function sourceId(value: unknown): SourceId | null {
	return typedUuid(value, "source-");
}

export function decodeSourceId(value: unknown): SourceId | null {
	return sourceId(value);
}

function evidenceId(value: unknown): EvidenceId | null {
	return typedUuid(value, "evidence-");
}

export function decodeEvidenceId(value: unknown): EvidenceId | null {
	return evidenceId(value);
}

function passId(value: unknown): MemoPassId | null {
	return typedUuid(value, "memo-pass-");
}

export function decodeMemoPassId(value: unknown): MemoPassId | null {
	return passId(value);
}

function revisionId(value: unknown): MemoRevisionId | null {
	return typedUuid(value, "memo-revision-");
}

export function decodeMemoRevisionId(value: unknown): MemoRevisionId | null {
	return revisionId(value);
}

function parseIdArray<Id extends string>(
	value: unknown,
	decoder: (candidate: unknown) => Id | null,
): readonly Id[] | null {
	if (!Array.isArray(value) || value.length > MAX_ITEMS) return null;
	const result: Id[] = [];
	for (const candidate of value) {
		const decoded = decoder(candidate);
		if (!decoded || result.includes(decoded)) return null;
		result.push(decoded);
	}
	return result.toSorted((left, right) => left.localeCompare(right));
}

function parseEvidence(
	value: unknown,
	index: number,
): DecodeResult<EvidenceItem> {
	const path = `/evidence/${index}`;
	if (!isObject(value)) {
		return failure("memo-profile.object", path, "Evidence must be an object.");
	}
	if (!hasExactKeys(value, ["evidence_id", "kind", "source_id", "summary"])) {
		return failure("memo-profile.shape", path, "Evidence has invalid fields.");
	}
	const id = evidenceId(value.evidence_id);
	const source = value.source_id === null ? null : sourceId(value.source_id);
	const summary = boundedText(value.summary, MAX_SUMMARY_LENGTH);
	if (
		!id ||
		(value.kind !== "source-claim" &&
			value.kind !== "direct-observation" &&
			value.kind !== "counterexample") ||
		(value.source_id !== null && !source) ||
		!summary
	) {
		return failure("memo-profile.shape", path, "Evidence has invalid values.");
	}
	return {
		ok: true,
		value: { evidenceId: id, kind: value.kind, sourceId: source, summary },
	};
}

function parseHypothesisDraft(
	value: unknown,
	path: string,
): DecodeResult<WorkingHypothesisDraft> {
	if (!isObject(value)) {
		return failure(
			"memo-profile.object",
			path,
			"Hypothesis must be an object.",
		);
	}
	if (
		!hasExactKeys(value, [
			"inquiry_id",
			"episode_id",
			"origin",
			"original",
			"current",
			"revision_reason",
			"evidence_ids",
		])
	) {
		return failure(
			"memo-profile.shape",
			path,
			"Hypothesis has invalid fields.",
		);
	}
	const id = inquiryId(value.inquiry_id);
	const episode = boundedText(value.episode_id, MAX_ID_LENGTH);
	const original = boundedText(value.original);
	const current = boundedText(value.current);
	const reason =
		value.revision_reason === null ? null : boundedText(value.revision_reason);
	const evidenceIds = parseIdArray(value.evidence_ids, evidenceId);
	if (
		!id ||
		!episode ||
		(value.origin !== "user" && value.origin !== "observer") ||
		!original ||
		!current ||
		(value.revision_reason !== null && !reason) ||
		current !== original ||
		reason !== null ||
		!evidenceIds
	) {
		return failure(
			"memo-profile.shape",
			path,
			"Hypothesis has invalid values.",
		);
	}
	return {
		ok: true,
		value: {
			inquiryId: id,
			episodeId: episode,
			origin: value.origin,
			original,
			current,
			revisionReason: null,
			evidenceIds,
		},
	};
}

function parseMemoDraft(
	value: unknown,
	path: string,
): DecodeResult<WorkingMemoDraft> {
	if (!isObject(value)) {
		return failure(
			"memo-profile.object",
			path,
			"Memo draft must be an object.",
		);
	}
	if (
		!hasExactKeys(value, [
			"memo_id",
			"episode_id",
			"title",
			"lang",
			"content",
			"inquiry_ids",
			"hypothesis_id",
			"evidence_ids",
			"reason",
		])
	) {
		return failure(
			"memo-profile.shape",
			path,
			"Memo draft has invalid fields.",
		);
	}
	const id = memoId(value.memo_id);
	const episode = boundedText(value.episode_id, MAX_ID_LENGTH);
	const title = boundedText(value.title, MAX_SUMMARY_LENGTH);
	const content = boundedText(value.content);
	const inquiries = parseIdArray(value.inquiry_ids, inquiryId);
	const hypothesis =
		value.hypothesis_id === null ? null : inquiryId(value.hypothesis_id);
	const evidenceIds = parseIdArray(value.evidence_ids, evidenceId);
	const reason = boundedText(value.reason, MAX_SUMMARY_LENGTH);
	if (
		!id ||
		!episode ||
		!title ||
		(value.lang !== "ko" && value.lang !== "en") ||
		!content ||
		!inquiries ||
		(value.hypothesis_id !== null && !hypothesis) ||
		!evidenceIds ||
		!reason
	) {
		return failure(
			"memo-profile.shape",
			path,
			"Memo draft has invalid values.",
		);
	}
	return {
		ok: true,
		value: {
			memoId: id,
			episodeId: episode,
			title,
			lang: value.lang,
			content,
			inquiryIds: inquiries,
			hypothesisId: hypothesis,
			evidenceIds,
			reason,
		},
	};
}

function parseRevisionDraft(
	value: unknown,
	path: string,
): DecodeResult<MemoRevisionDraft> {
	if (!isObject(value)) {
		return failure(
			"memo-profile.object",
			path,
			"Memo revision must be an object.",
		);
	}
	if (
		!hasExactKeys(value, [
			"revision_id",
			"title",
			"content",
			"evidence_ids",
			"reason",
		])
	) {
		return failure(
			"memo-profile.shape",
			path,
			"Memo revision has invalid fields.",
		);
	}
	const id = revisionId(value.revision_id);
	const title = boundedText(value.title, MAX_SUMMARY_LENGTH);
	const content = boundedText(value.content);
	const evidenceIds = parseIdArray(value.evidence_ids, evidenceId);
	const reason = boundedText(value.reason, MAX_SUMMARY_LENGTH);
	if (!id || !title || !content || !evidenceIds || !reason) {
		return failure(
			"memo-profile.shape",
			path,
			"Memo revision has invalid values.",
		);
	}
	return {
		ok: true,
		value: { revisionId: id, title, content, evidenceIds, reason },
	};
}

function parseHypothesisOutcome(
	value: unknown,
	index: number,
): DecodeResult<HypothesisOutcome> {
	const path = `/hypothesis_outcomes/${index}`;
	if (!isObject(value)) {
		return failure(
			"memo-profile.object",
			path,
			"Hypothesis outcome must be an object.",
		);
	}
	if (value.kind === "keep") {
		const id = inquiryId(value.inquiry_id);
		return hasExactKeys(value, ["kind", "inquiry_id"]) && id
			? { ok: true, value: { kind: "keep", inquiryId: id } }
			: failure("memo-profile.shape", path, "Keep outcome is invalid.");
	}
	if (value.kind === "create") {
		const hypothesis = parseHypothesisDraft(
			value.hypothesis,
			`${path}/hypothesis`,
		);
		if (!hypothesis.ok) return hypothesis;
		if (!hasExactKeys(value, ["kind", "hypothesis"])) {
			return failure("memo-profile.shape", path, "Create outcome is invalid.");
		}
		return {
			ok: true,
			value: { kind: "create", hypothesis: hypothesis.value },
		};
	}
	if (value.kind === "revise") {
		const id = inquiryId(value.inquiry_id);
		const current = boundedText(value.current);
		const reason = boundedText(value.revision_reason, MAX_SUMMARY_LENGTH);
		const evidenceIds = parseIdArray(value.evidence_ids, evidenceId);
		if (
			!hasExactKeys(value, [
				"kind",
				"inquiry_id",
				"current",
				"revision_reason",
				"evidence_ids",
			]) ||
			!id ||
			!current ||
			!reason ||
			!evidenceIds
		) {
			return failure("memo-profile.shape", path, "Revise outcome is invalid.");
		}
		return {
			ok: true,
			value: {
				kind: "revise",
				inquiryId: id,
				current,
				revisionReason: reason,
				evidenceIds,
			},
		};
	}
	return failure(
		"memo-profile.shape",
		`${path}/kind`,
		"Unknown hypothesis outcome.",
	);
}

function parseMemoOutcome(
	value: unknown,
	index: number,
): DecodeResult<MemoOutcome> {
	const path = `/memo_outcomes/${index}`;
	if (!isObject(value)) {
		return failure(
			"memo-profile.object",
			path,
			"Memo outcome must be an object.",
		);
	}
	if (value.kind === "keep-incubating") {
		const id = memoId(value.memo_id);
		return hasExactKeys(value, ["kind", "memo_id"]) && id
			? { ok: true, value: { kind: "keep-incubating", memoId: id } }
			: failure("memo-profile.shape", path, "Keep Memo outcome is invalid.");
	}
	if (value.kind === "revise") {
		const id = memoId(value.memo_id);
		const revision = parseRevisionDraft(value.revision, `${path}/revision`);
		if (
			!hasExactKeys(value, ["kind", "memo_id", "revision", "disposition"]) ||
			!id ||
			!revision.ok ||
			(value.disposition !== "incubating" &&
				value.disposition !== "promotion-candidate")
		) {
			return revision.ok
				? failure("memo-profile.shape", path, "Revise Memo outcome is invalid.")
				: revision;
		}
		return {
			ok: true,
			value: {
				kind: "revise",
				memoId: id,
				revision: revision.value,
				disposition: value.disposition,
			},
		};
	}
	if (value.kind === "mark-promotion-candidate") {
		const id = memoId(value.memo_id);
		const reason = boundedText(value.reason, MAX_SUMMARY_LENGTH);
		const evidenceIds = parseIdArray(value.evidence_ids, evidenceId);
		if (
			!hasExactKeys(value, ["kind", "memo_id", "reason", "evidence_ids"]) ||
			!id ||
			!reason ||
			!evidenceIds
		) {
			return failure(
				"memo-profile.shape",
				path,
				"Candidate outcome is invalid.",
			);
		}
		return {
			ok: true,
			value: {
				kind: "mark-promotion-candidate",
				memoId: id,
				reason,
				evidenceIds,
			},
		};
	}
	if (value.kind === "merge") {
		const sourceIds = parseIdArray(value.source_ids, memoId);
		const target = parseMemoDraft(value.target, `${path}/target`);
		if (
			!hasExactKeys(value, ["kind", "source_ids", "target"]) ||
			!sourceIds ||
			sourceIds.length < 2 ||
			!target.ok
		) {
			return target.ok
				? failure("memo-profile.shape", path, "Merge outcome is invalid.")
				: target;
		}
		return {
			ok: true,
			value: { kind: "merge", sourceIds, target: target.value },
		};
	}
	if (value.kind === "create") {
		const memo = parseMemoDraft(value.memo, `${path}/memo`);
		if (!memo.ok) return memo;
		if (!hasExactKeys(value, ["kind", "memo"])) {
			return failure(
				"memo-profile.shape",
				path,
				"Create Memo outcome is invalid.",
			);
		}
		return { ok: true, value: { kind: "create", memo: memo.value } };
	}
	return failure("memo-profile.shape", `${path}/kind`, "Unknown Memo outcome.");
}

function decodeArray<Value>(
	value: unknown,
	decoder: (candidate: unknown, index: number) => DecodeResult<Value>,
	path: string,
): DecodeResult<readonly Value[]> {
	if (!Array.isArray(value) || value.length > MAX_ITEMS) {
		return failure("memo-profile.shape", path, "Expected a bounded array.");
	}
	const result: Value[] = [];
	for (const [index, candidate] of value.entries()) {
		const decoded = decoder(candidate, index);
		if (!decoded.ok) return decoded;
		result.push(decoded.value);
	}
	return { ok: true, value: result };
}

function hypothesisOutcomeKey(outcome: HypothesisOutcome): string {
	return outcome.kind === "create"
		? `create:${outcome.hypothesis.inquiryId}`
		: `${outcome.kind}:${outcome.inquiryId}`;
}

function memoOutcomeKey(outcome: MemoOutcome): string {
	switch (outcome.kind) {
		case "keep-incubating":
		case "revise":
		case "mark-promotion-candidate":
			return `${outcome.kind}:${outcome.memoId}`;
		case "merge":
			return `merge:${outcome.target.memoId}`;
		case "create":
			return `create:${outcome.memo.memoId}`;
		default:
			return assertNever(outcome);
	}
}

function hasDuplicate<Value>(
	values: readonly Value[],
	key: (value: Value) => string,
): boolean {
	const keys = values.map(key);
	return new Set(keys).size !== keys.length;
}

export function isPreparedMemoPass(value: unknown): value is PreparedMemoPass {
	return (
		isObject(value) && Reflect.get(value, PREPARED_MEMO_PASS_MARKER) === true
	);
}

export function decodePreparedMemoPass(value: unknown): MemoProfileResult {
	if (!isObject(value)) {
		return failure(
			"memo-profile.object",
			"/",
			"Prepared Memo pass must be an object.",
		);
	}
	if (value.observer_memo_pass !== OBSERVER_PREPARED_MEMO_PASS_PROTOCOL) {
		return failure(
			typeof value.observer_memo_pass === "string"
				? "memo-profile.unsupported"
				: "memo-profile.shape",
			"/observer_memo_pass",
			"Prepared Memo pass has an unsupported protocol.",
		);
	}
	if (
		!hasExactKeys(value, [
			"observer_memo_pass",
			"pass_id",
			"episode_id",
			"base_revision_id",
			"basis_digest",
			"related_inquiry_ids",
			"instruction_id",
			"evidence",
			"hypothesis_outcomes",
			"memo_outcomes",
		])
	) {
		return failure(
			"memo-profile.shape",
			"/",
			"Prepared Memo pass has invalid fields.",
		);
	}
	const id = passId(value.pass_id);
	const episode = boundedText(value.episode_id, MAX_ID_LENGTH);
	const base = optionalIdentifier(value.base_revision_id);
	const basisDigest = isSha256(value.basis_digest) ? value.basis_digest : null;
	const related = parseIdArray(value.related_inquiry_ids, inquiryId);
	const instruction = optionalIdentifier(value.instruction_id);
	const evidence = decodeArray(value.evidence, parseEvidence, "/evidence");
	const hypotheses = decodeArray(
		value.hypothesis_outcomes,
		parseHypothesisOutcome,
		"/hypothesis_outcomes",
	);
	const memos = decodeArray(
		value.memo_outcomes,
		parseMemoOutcome,
		"/memo_outcomes",
	);
	if (
		!id ||
		!episode ||
		base === undefined ||
		!basisDigest ||
		!related ||
		instruction === undefined ||
		!evidence.ok ||
		!hypotheses.ok ||
		!memos.ok
	) {
		return failure(
			"memo-profile.shape",
			"/",
			"Prepared Memo pass has invalid values.",
		);
	}
	const normalizedEvidence = evidence.value.toSorted((left, right) =>
		left.evidenceId.localeCompare(right.evidenceId),
	);
	const normalizedHypotheses = hypotheses.value.toSorted((left, right) =>
		hypothesisOutcomeKey(left).localeCompare(hypothesisOutcomeKey(right)),
	);
	const normalizedMemos = memos.value.toSorted((left, right) =>
		memoOutcomeKey(left).localeCompare(memoOutcomeKey(right)),
	);
	if (
		hasDuplicate(normalizedEvidence, (item) => item.evidenceId) ||
		hasDuplicate(normalizedHypotheses, hypothesisOutcomeKey) ||
		hasDuplicate(normalizedMemos, memoOutcomeKey)
	) {
		return failure(
			"memo-profile.duplicate",
			"/",
			"Prepared Memo pass repeats an identity.",
		);
	}
	const normalized = {
		protocol: OBSERVER_PREPARED_MEMO_PASS_PROTOCOL,
		passId: id,
		episodeId: episode,
		baseRevisionId: base,
		basisDigest,
		relatedInquiryIds: related,
		instructionId: instruction,
		evidence: normalizedEvidence,
		hypothesisOutcomes: normalizedHypotheses,
		memoOutcomes: normalizedMemos,
	};
	const digest = sha256Text(
		JSON.stringify({
			episodeId: normalized.episodeId,
			baseRevisionId: normalized.baseRevisionId,
			basisDigest: normalized.basisDigest,
			relatedInquiryIds: normalized.relatedInquiryIds,
			instructionId: normalized.instructionId,
			evidence: normalized.evidence,
			hypothesisOutcomes: normalized.hypothesisOutcomes,
			memoOutcomes: normalized.memoOutcomes,
		}),
	);
	return {
		ok: true,
		value: { ...normalized, digest, [PREPARED_MEMO_PASS_MARKER]: true },
	};
}

function encodeEvidence(item: EvidenceItem): unknown {
	return {
		evidence_id: item.evidenceId,
		kind: item.kind,
		source_id: item.sourceId,
		summary: item.summary,
	};
}

function encodeHypothesisDraft(hypothesis: WorkingHypothesisDraft): unknown {
	return {
		inquiry_id: hypothesis.inquiryId,
		episode_id: hypothesis.episodeId,
		origin: hypothesis.origin,
		original: hypothesis.original,
		current: hypothesis.current,
		revision_reason: hypothesis.revisionReason,
		evidence_ids: hypothesis.evidenceIds,
	};
}

function encodeMemoDraft(memo: WorkingMemoDraft): unknown {
	return {
		memo_id: memo.memoId,
		episode_id: memo.episodeId,
		title: memo.title,
		lang: memo.lang,
		content: memo.content,
		inquiry_ids: memo.inquiryIds,
		hypothesis_id: memo.hypothesisId,
		evidence_ids: memo.evidenceIds,
		reason: memo.reason,
	};
}

function encodeHypothesisOutcome(outcome: HypothesisOutcome): unknown {
	switch (outcome.kind) {
		case "keep":
			return { kind: outcome.kind, inquiry_id: outcome.inquiryId };
		case "create":
			return {
				kind: outcome.kind,
				hypothesis: encodeHypothesisDraft(outcome.hypothesis),
			};
		case "revise":
			return {
				kind: outcome.kind,
				inquiry_id: outcome.inquiryId,
				current: outcome.current,
				revision_reason: outcome.revisionReason,
				evidence_ids: outcome.evidenceIds,
			};
		default:
			return assertNever(outcome);
	}
}

function encodeMemoOutcome(outcome: MemoOutcome): unknown {
	switch (outcome.kind) {
		case "keep-incubating":
			return { kind: outcome.kind, memo_id: outcome.memoId };
		case "revise":
			return {
				kind: outcome.kind,
				memo_id: outcome.memoId,
				disposition: outcome.disposition,
				revision: {
					revision_id: outcome.revision.revisionId,
					title: outcome.revision.title,
					content: outcome.revision.content,
					evidence_ids: outcome.revision.evidenceIds,
					reason: outcome.revision.reason,
				},
			};
		case "mark-promotion-candidate":
			return {
				kind: outcome.kind,
				memo_id: outcome.memoId,
				reason: outcome.reason,
				evidence_ids: outcome.evidenceIds,
			};
		case "merge":
			return {
				kind: outcome.kind,
				source_ids: outcome.sourceIds,
				target: encodeMemoDraft(outcome.target),
			};
		case "create":
			return { kind: outcome.kind, memo: encodeMemoDraft(outcome.memo) };
		default:
			return assertNever(outcome);
	}
}

export function encodePreparedMemoPass(pass: PreparedMemoPass): unknown {
	if (!isPreparedMemoPass(pass)) {
		throw new Error(
			"Prepared Memo pass must come from decodePreparedMemoPass().",
		);
	}
	return {
		observer_memo_pass: pass.protocol,
		pass_id: pass.passId,
		episode_id: pass.episodeId,
		base_revision_id: pass.baseRevisionId,
		basis_digest: pass.basisDigest,
		related_inquiry_ids: pass.relatedInquiryIds,
		instruction_id: pass.instructionId,
		evidence: pass.evidence.map(encodeEvidence),
		hypothesis_outcomes: pass.hypothesisOutcomes.map(encodeHypothesisOutcome),
		memo_outcomes: pass.memoOutcomes.map(encodeMemoOutcome),
	};
}
