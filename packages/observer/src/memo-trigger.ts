import type { NotebookInventoryEntry } from "./notebook.ts";
import {
	describeMemoReconciliationCoverage,
	hydrateMemoScope,
	type MemoReconciliationCoverage,
	type MemoScopeSnapshot,
	type WorkingSourceBasis,
} from "./memo-reconciliation.ts";
import type { MemoSessionSnapshot } from "./memo-session.ts";
import {
	decodeMemoPassId,
	type InquiryId,
	type MemoPassId,
} from "./memo-profile.ts";
import {
	observationMemoRequestDigest,
	prepareObservationEvent,
	type MemoRequestId,
	type MemoRequestObservation,
	type ObservationMemoRequestedEvent,
	type SemanticObservationRecordedEvent,
	type SourceClaim,
} from "./observation-profile.ts";
import type { ObservationSessionSnapshot } from "./observation-session.ts";

const OBSERVATION_MEMO_CONTEXT_MARKER = Symbol("observer.memo-context");

export type MemoRequestPlan =
	| { readonly kind: "none" }
	| {
			readonly kind: "resume";
			readonly request: ObservationMemoRequestedEvent;
	  }
	| {
			readonly kind: "append";
			readonly request: ObservationMemoRequestedEvent;
	  };

export type MemoTriggerIssueCode =
	| "memo-trigger.history"
	| "memo-trigger.scope"
	| "memo-trigger.stale";

export interface MemoTriggerIssue {
	readonly code: MemoTriggerIssueCode;
	readonly message: string;
	readonly relatedId?: string;
}

type MemoTriggerFailure = {
	readonly ok: false;
	readonly issue: MemoTriggerIssue;
};

export type MemoRequestPlanResult =
	| { readonly ok: true; readonly value: MemoRequestPlan }
	| MemoTriggerFailure;

export interface ObservationMemoContext {
	readonly [OBSERVATION_MEMO_CONTEXT_MARKER]: true;
	readonly request: ObservationMemoRequestedEvent;
	readonly observations: readonly MemoRequestObservation[];
	readonly memoScope: MemoScopeSnapshot;
}

export type ObservationMemoContextResult =
	| { readonly ok: true; readonly value: ObservationMemoContext }
	| { readonly ok: false; readonly issue: MemoTriggerIssue };

export interface MemoPreparationEvidenceSource {
	readonly source_id: string;
	readonly title: string;
	readonly faithful_summary: string;
	readonly claims: readonly SourceClaim[];
}

export interface MemoPreparationGuide {
	readonly protocol: "observer.memo-preparation/v1";
	readonly request: {
		readonly request_id: MemoRequestId;
		readonly request_digest: string;
		readonly observation_ids: readonly string[];
	};
	readonly required_coverage: MemoReconciliationCoverage;
	readonly evidence_sources: readonly MemoPreparationEvidenceSource[];
	readonly instruction_seed: {
		readonly observer_memo_instruction: "observer.memo-instruction/v1";
		readonly request_id: MemoRequestId;
		readonly request_digest: string;
		readonly pass: {
			readonly observer_memo_pass: "observer.prepared-memo-pass/v1";
			readonly pass_id: MemoPassId;
			readonly episode_id: string;
			readonly base_revision_id: string | null;
			readonly basis_digest: string;
			readonly related_inquiry_ids: readonly InquiryId[];
			readonly instruction_id: MemoRequestId;
			readonly evidence: readonly [];
			readonly hypothesis_outcomes: readonly [];
			readonly memo_outcomes: readonly [];
		};
		readonly dispositions: readonly [];
	};
}

export type MemoPreparationGuideResult =
	| { readonly ok: true; readonly value: MemoPreparationGuide }
	| { readonly ok: false; readonly issue: MemoTriggerIssue };

function failure(
	code: MemoTriggerIssueCode,
	message: string,
	relatedId?: string,
): MemoTriggerFailure {
	return {
		ok: false,
		issue: relatedId ? { code, message, relatedId } : { code, message },
	};
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

function requestObservations(input: {
	readonly observation: ObservationSessionSnapshot;
	readonly request: ObservationMemoRequestedEvent;
}): readonly MemoRequestObservation[] | null {
	const available = new Map<string, MemoRequestObservation>([
		...input.observation.observations.map(
			(value): readonly [string, MemoRequestObservation] => [
				value.observationId,
				value,
			],
		),
		...input.observation.userHypotheses.map(
			(value): readonly [string, MemoRequestObservation] => [
				value.observationId,
				value,
			],
		),
	]);
	const result = input.request.observationIds.flatMap((id) => {
		const observation = available.get(id);
		return observation ? [observation] : [];
	});
	return result.length === input.request.observationIds.length ? result : null;
}

function validateHistory(input: {
	readonly observation: ObservationSessionSnapshot;
	readonly memo: MemoSessionSnapshot;
}): MemoTriggerFailure | null {
	const issue = input.observation.issues[0] ?? input.memo.issues[0];
	if (issue) {
		return failure(
			"memo-trigger.history",
			`Memo trigger requires healthy branch replay: ${issue.code}.`,
		);
	}
	if (input.observation.lifecycle.episode.status !== "open") {
		return failure(
			"memo-trigger.scope",
			"Memo trigger requires an open Episode.",
		);
	}
	return null;
}

export function planObservationMemoRequest(input: {
	readonly observation: ObservationSessionSnapshot;
	readonly memo: MemoSessionSnapshot;
	readonly requestId: MemoRequestId;
}): MemoRequestPlanResult {
	const historyFailure = validateHistory(input);
	if (historyFailure) return historyFailure;
	if (input.memo.prepared || input.memo.pendingAcknowledgment) {
		return failure(
			"memo-trigger.history",
			"An existing prepared or applied Memo pass must finish first.",
		);
	}
	const pending = input.observation.pendingMemoRequest;
	if (pending) {
		if (pending.baseMemoRevisionId !== input.memo.state.revisionId) {
			return failure(
				"memo-trigger.stale",
				"Pending Memo request has a stale Memo revision.",
				pending.requestId,
			);
		}
		return { ok: true, value: { kind: "resume", request: pending } };
	}
	const eligibleIds = input.observation.unconsumedObservationIds.toSorted(
		(left, right) => left.localeCompare(right),
	);
	if (eligibleIds.length === 0) return { ok: true, value: { kind: "none" } };
	const available = new Map<string, MemoRequestObservation>([
		...input.observation.observations.map(
			(value): readonly [string, MemoRequestObservation] => [
				value.observationId,
				value,
			],
		),
		...input.observation.userHypotheses.map(
			(value): readonly [string, MemoRequestObservation] => [
				value.observationId,
				value,
			],
		),
	]);
	const observations = eligibleIds.flatMap((id) => {
		const observation = available.get(id);
		return observation ? [observation] : [];
	});
	if (observations.length !== eligibleIds.length) {
		return failure(
			"memo-trigger.history",
			"Eligible Observation IDs do not resolve to current branch events.",
		);
	}
	const episode = input.observation.lifecycle.episode;
	if (episode.status !== "open") {
		return failure(
			"memo-trigger.scope",
			"Memo request planning lost its open Episode.",
		);
	}
	const episodeId = episode.core.episodeId;
	const baseMemoRevisionId = input.memo.state.revisionId;
	const prepared = prepareObservationEvent({
		observer_observation: "observer-observation/v1",
		kind: "memo-requested",
		episode_id: episodeId,
		request_id: input.requestId,
		base_memo_revision_id: baseMemoRevisionId,
		observation_ids: eligibleIds,
		request_digest: observationMemoRequestDigest({
			episodeId,
			baseMemoRevisionId,
			observations,
		}),
	});
	if (!prepared.ok || prepared.value.kind !== "memo-requested") {
		return failure(
			"memo-trigger.scope",
			prepared.ok
				? "Memo request refinement produced an unexpected event."
				: prepared.issue.message,
		);
	}
	return { ok: true, value: { kind: "append", request: prepared.value } };
}

function standingInquiryIds(
	inventory: readonly NotebookInventoryEntry[],
): ReadonlySet<InquiryId> {
	return new Set(
		inventory.flatMap((entry) => {
			const record = entry.document.record;
			return record.observer_type === "inquiry" &&
				(record.observer_status === "open" ||
					record.observer_status === "dormant")
				? [record.id]
				: [];
		}),
	);
}

function relatedInquiryIds(input: {
	readonly observations: readonly MemoRequestObservation[];
	readonly inventory: readonly NotebookInventoryEntry[];
	readonly memo: MemoSessionSnapshot;
	readonly episodeId: string;
}): readonly InquiryId[] {
	const durable = standingInquiryIds(input.inventory);
	const working = new Set(
		input.memo.state.hypotheses.flatMap((hypothesis) =>
			hypothesis.episodeId === input.episodeId ? [hypothesis.inquiryId] : [],
		),
	);
	const related = input.observations.flatMap((observation) => {
		if (observation.kind === "semantic-observation-recorded") {
			return observation.relatedInquiryIds;
		}
		return durable.has(observation.inquiryId) ||
			working.has(observation.inquiryId)
			? [observation.inquiryId]
			: [];
	});
	return [...new Set(related)].toSorted((left, right) =>
		left.localeCompare(right),
	);
}

function requestWorkingSourceBases(
	observation: ObservationSessionSnapshot,
	observations: readonly MemoRequestObservation[],
): readonly WorkingSourceBasis[] | MemoTriggerIssue {
	const reads = new Map(
		observation.sourceReads.map(
			(read): readonly [string, (typeof observation.sourceReads)[number]] => [
				read.readId,
				read,
			],
		),
	);
	const bases = new Map<string, WorkingSourceBasis>();
	for (const item of observations) {
		if (item.kind !== "semantic-observation-recorded") continue;
		const read = reads.get(item.readId);
		if (!read) {
			return {
				code: "memo-trigger.history",
				message: "Requested semantic Observation has no SourceRead.",
				relatedId: item.observationId,
			};
		}
		const basis: WorkingSourceBasis = {
			sourceId: read.source.sourceId,
			path: `session:observer/${read.readId}`,
			sha256: read.digest,
		};
		const prior = bases.get(basis.sourceId);
		if (prior && (prior.path !== basis.path || prior.sha256 !== basis.sha256)) {
			return {
				code: "memo-trigger.scope",
				message: "One Source ID resolves to conflicting request bases.",
				relatedId: basis.sourceId,
			};
		}
		bases.set(basis.sourceId, basis);
	}
	return [...bases.values()].toSorted((left, right) =>
		left.sourceId.localeCompare(right.sourceId),
	);
}

function isIssue(
	value: readonly WorkingSourceBasis[] | MemoTriggerIssue,
): value is MemoTriggerIssue {
	return !Array.isArray(value);
}

export function hydrateObservationMemoContext(input: {
	readonly observation: ObservationSessionSnapshot;
	readonly memo: MemoSessionSnapshot;
	readonly inventory: readonly NotebookInventoryEntry[];
	readonly requestId: MemoRequestId;
}): ObservationMemoContextResult {
	const historyFailure = validateHistory(input);
	if (historyFailure) return historyFailure;
	const request = input.observation.pendingMemoRequest;
	if (!request || request.requestId !== input.requestId) {
		return failure(
			"memo-trigger.scope",
			"Memo context requires the exact pending request.",
			input.requestId,
		);
	}
	if (request.baseMemoRevisionId !== input.memo.state.revisionId) {
		return failure(
			"memo-trigger.stale",
			"Memo request base revision is stale.",
			request.requestId,
		);
	}
	const observations = requestObservations({
		observation: input.observation,
		request,
	});
	if (!observations) {
		return failure(
			"memo-trigger.history",
			"Memo request observations are unavailable.",
			request.requestId,
		);
	}
	if (
		request.requestDigest !==
		observationMemoRequestDigest({
			episodeId: request.episodeId,
			baseMemoRevisionId: request.baseMemoRevisionId,
			observations,
		})
	) {
		return failure(
			"memo-trigger.stale",
			"Memo request digest does not match its Observation events.",
			request.requestId,
		);
	}
	const workingSourceBases = requestWorkingSourceBases(
		input.observation,
		observations,
	);
	if (isIssue(workingSourceBases))
		return { ok: false, issue: workingSourceBases };
	const related = relatedInquiryIds({
		observations,
		inventory: input.inventory,
		memo: input.memo,
		episodeId: request.episodeId,
	});
	const scope = hydrateMemoScope({
		lifecycle: input.observation.lifecycle,
		working: input.memo.state,
		inventory: input.inventory,
		relatedInquiryIds: related,
		workingSourceBases,
	});
	if (!scope.ok) {
		return failure(
			"memo-trigger.scope",
			`Memo request scope failed: ${scope.issue.message}`,
			scope.issue.relatedId,
		);
	}
	if (!sameStrings(scope.value.relatedInquiryIds, related)) {
		return failure(
			"memo-trigger.scope",
			"Memo request scope changed its related Inquiry set.",
		);
	}
	return {
		ok: true,
		value: {
			request,
			observations,
			memoScope: scope.value,
			[OBSERVATION_MEMO_CONTEXT_MARKER]: true,
		},
	};
}

function memoPassIdForRequest(requestId: MemoRequestId): MemoPassId | null {
	const suffix = requestId.slice("memo-request-".length);
	return decodeMemoPassId(`memo-pass-${suffix}`);
}

export function buildObservationMemoPreparationGuide(input: {
	readonly context: ObservationMemoContext;
	readonly observation: ObservationSessionSnapshot;
	readonly memo: MemoSessionSnapshot;
}): MemoPreparationGuideResult {
	const passId = memoPassIdForRequest(input.context.request.requestId);
	if (!passId) {
		return failure(
			"memo-trigger.scope",
			"Memo request identity cannot produce a Memo pass identity.",
			input.context.request.requestId,
		);
	}
	const sourceReadsById = new Map(
		input.observation.sourceReads.map((read) => [read.readId, read]),
	);
	const sources = new Map<string, MemoPreparationEvidenceSource>();
	for (const observation of input.context.observations) {
		if (observation.kind !== "semantic-observation-recorded") continue;
		const read = sourceReadsById.get(observation.readId);
		if (!read || read.episodeId !== input.context.request.episodeId) {
			return failure(
				"memo-trigger.scope",
				"Requested Observation is missing its SourceRead context.",
				observation.observationId,
			);
		}
		sources.set(read.source.sourceId, {
			source_id: read.source.sourceId,
			title: read.source.title,
			faithful_summary: read.faithfulSummary,
			claims: read.claims,
		});
	}
	const request = input.context.request;
	const scope = input.context.memoScope;
	return {
		ok: true,
		value: {
			protocol: "observer.memo-preparation/v1",
			request: {
				request_id: request.requestId,
				request_digest: request.requestDigest,
				observation_ids: request.observationIds,
			},
			required_coverage: describeMemoReconciliationCoverage(
				input.memo.state,
				scope,
			),
			evidence_sources: [...sources.values()].toSorted((left, right) =>
				left.source_id.localeCompare(right.source_id),
			),
			instruction_seed: {
				observer_memo_instruction: "observer.memo-instruction/v1",
				request_id: request.requestId,
				request_digest: request.requestDigest,
				pass: {
					observer_memo_pass: "observer.prepared-memo-pass/v1",
					pass_id: passId,
					episode_id: request.episodeId,
					base_revision_id: request.baseMemoRevisionId,
					basis_digest: scope.basisDigest,
					related_inquiry_ids: scope.relatedInquiryIds,
					instruction_id: request.requestId,
					evidence: [],
					hypothesis_outcomes: [],
					memo_outcomes: [],
				},
				dispositions: [],
			},
		},
	};
}

export function isObservationMemoContext(
	value: unknown,
): value is ObservationMemoContext {
	return (
		typeof value === "object" &&
		value !== null &&
		Reflect.get(value, OBSERVATION_MEMO_CONTEXT_MARKER) === true
	);
}

export function semanticRequestObservations(
	context: ObservationMemoContext,
): readonly SemanticObservationRecordedEvent[] {
	return context.observations.flatMap((observation) =>
		observation.kind === "semantic-observation-recorded" ? [observation] : [],
	);
}
