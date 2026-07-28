import { sha256Text } from "./content-hash.ts";
import {
	decodePreparedObservationMemoInstruction,
	encodeObservationMemoInstruction,
	OBSERVER_MEMO_INSTRUCTION_ENTRY,
	reconstructMemoInstructionSession,
	type MemoInstructionSessionSnapshot,
	type PreparedObservationMemoInstruction,
} from "./memo-instruction.ts";
import { reconstructMemoSession } from "./memo-session.ts";
import { reconcileMemoPass } from "./memo-reconciliation.ts";
import type { InquiryId, SourceId } from "./memo-profile.ts";
import {
	readNotebookInventory,
	type NotebookHandle,
	type NotebookInventoryEntry,
} from "./notebook.ts";
import {
	createNotebookService,
	type NotebookService,
} from "./notebook-service.ts";
import type { NotebookSelectionStore } from "./notebook-selection-store.ts";
import type {
	MaterialReviewEpisodeCapability,
	UserHypothesisEpisodeCapability,
} from "./observer-controller.ts";
import {
	buildObservationMemoPreparationGuide,
	hydrateObservationMemoContext,
	planObservationMemoRequest,
	type MemoPreparationGuide,
	type ObservationMemoContext,
} from "./memo-trigger.ts";
import {
	decodeObservationAction,
	type HydrateAction,
	type HypothesisContextReviewAction,
	type MemoPrepareAction,
	type MemoScopeAction,
	type ObservationAction,
	type SaveScopeAction,
	type SavePrepareAction,
	type RecordObservationAction,
	type RegisterUserHypothesisAction,
	type SourceReadAction,
	type WorkingSourceDraft,
} from "./observation-action.ts";
import {
	encodeObservationEvent,
	prepareObservationEvent,
	OBSERVER_OBSERVATION_ENTRY,
	type CandidateCapturedEvent,
	type HypothesisContextReviewedEvent,
	type InquiryHydratedEvent,
	type ObservationEvent,
	type ObservationMemoRequestedEvent,
	type SemanticObservationRecordedEvent,
	type SourceReadRecordedEvent,
	type UserHypothesisRecordedEvent,
} from "./observation-profile.ts";
import {
	deriveReadAncestry,
	observationCandidateDigest,
	reconstructObservationSession,
	type ObservationSessionSnapshot,
} from "./observation-session.ts";
import {
	reconstructObserverPiState,
	type ObserverPiSnapshot,
	type PiBranchEntryLike,
	type PreparedSaveHandoff,
} from "./pi-session.ts";
import {
	encodeMaterialReviewEvent,
	OBSERVER_MATERIAL_REVIEW_ENTRY,
	planMaterialReviewCompletion,
	planMaterialReviewRequest,
	reconstructMaterialReviewSession,
	type MaterialReviewCompletedEvent,
	type MaterialReviewFinishAction,
	type MaterialReviewIntent,
	type MaterialReviewRequestedEvent,
} from "./material-review-trigger.ts";
import {
	buildStandingIndex,
	hydrateStandingContext,
	type StandingContext,
	type StandingIndex,
} from "./standing-index.ts";
import {
	buildSavePreparationGuide,
	encodeSaveRequestEvent,
	hydrateSavePreparationContext,
	OBSERVER_SAVE_REQUEST_ENTRY,
	planSaveRequest,
	prepareSaveHandoff,
	reconstructSaveRequestSession,
	type SavePreparationContext,
	type SavePreparationGuide,
	type SaveRequestEvent,
	type SaveRequestId,
	type SaveProposalId,
} from "./save-trigger.ts";

export interface ObservationCommandPort {
	branchEntries(): readonly PiBranchEntryLike[];
	appendEntry(customType: string, data: unknown): void;
	notify(message: string, type?: "info" | "warning" | "error"): void;
}

export interface ObservationControllerIds {
	candidateId(): `candidate-${string}`;
	sourceReadId(): `source-read-${string}`;
	hydrationId(): `hydration-${string}`;
	observationId(): `observation-${string}`;
	sourceId(): SourceId;
	inquiryId(): InquiryId;
	memoRequestId(): `memo-request-${string}`;
	saveRequestId(): SaveRequestId;
	saveProposalId(): SaveProposalId;
}

export type CandidateCaptureResult =
	| {
			readonly ok: true;
			readonly status: "captured" | "ignored";
			readonly candidate: CandidateCapturedEvent | null;
	  }
	| { readonly ok: false; readonly message: string };

export type TrackUserHypothesisResult =
	| {
			readonly ok: true;
			readonly status: "recorded" | "resumed";
			readonly reviewPending: boolean;
			readonly candidate: CandidateCapturedEvent;
			readonly hypothesis: UserHypothesisRecordedEvent;
	  }
	| { readonly ok: false; readonly message: string };

export type MaterialReviewFinishControllerResult =
	| {
			readonly ok: true;
			readonly status: "completed" | "resumed";
			readonly completion: MaterialReviewCompletedEvent;
	  }
	| { readonly ok: false; readonly message: string };

export type MaterialReviewStartControllerResult =
	| {
			readonly ok: true;
			readonly status: "pending-retrieval";
			readonly request: MaterialReviewRequestedEvent;
	  }
	| {
			readonly ok: true;
			readonly status: "inline-captured" | "inline-resumed";
			readonly request: MaterialReviewRequestedEvent;
			readonly candidate: CandidateCapturedEvent;
	  }
	| { readonly ok: false; readonly message: string };

export type ObservationControllerResult =
	| {
			readonly ok: true;
			readonly action: "source-read";
			readonly message: string;
			readonly read: SourceReadRecordedEvent;
			readonly index: StandingIndex;
	  }
	| {
			readonly ok: true;
			readonly action: "hydrate";
			readonly message: string;
			readonly hydration: InquiryHydratedEvent;
			readonly context: StandingContext;
	  }
	| {
			readonly ok: true;
			readonly action: "record";
			readonly message: string;
			readonly observation: SemanticObservationRecordedEvent;
	  }
	| {
			readonly ok: true;
			readonly action: "user-hypothesis";
			readonly message: string;
			readonly hypothesis: UserHypothesisRecordedEvent;
	  }
	| {
			readonly ok: true;
			readonly action: "hypothesis-context-review";
			readonly message: string;
			readonly review: HypothesisContextReviewedEvent;
	  }
	| {
			readonly ok: true;
			readonly action: "memo-scope";
			readonly message: string;
			readonly context: ObservationMemoContext;
			readonly guide: MemoPreparationGuide;
	  }
	| {
			readonly ok: true;
			readonly action: "save-scope";
			readonly message: string;
			readonly context: SavePreparationContext;
			readonly guide: SavePreparationGuide;
	  }
	| {
			readonly ok: true;
			readonly action: "save-prepare";
			readonly message: string;
			readonly handoff: PreparedSaveHandoff;
	  }
	| {
			readonly ok: true;
			readonly action: "memo-prepare";
			readonly status: "prepared" | "resumed";
			readonly message: string;
			readonly instruction: PreparedObservationMemoInstruction;
	  }
	| { readonly ok: false; readonly message: string };

export type SaveRequestControllerResult =
	| {
			readonly ok: true;
			readonly status: "delegate";
			readonly message: string;
			readonly request: null;
	  }
	| {
			readonly ok: true;
			readonly status: "requested" | "resumed";
			readonly message: string;
			readonly request: SaveRequestEvent;
	  }
	| { readonly ok: false; readonly message: string };

export type MemoRequestControllerResult =
	| {
			readonly ok: true;
			readonly status: "delegate" | "none";
			readonly message: string;
			readonly request: null;
	  }
	| {
			readonly ok: true;
			readonly status: "requested" | "resumed";
			readonly message: string;
			readonly request: ObservationMemoRequestedEvent;
	  }
	| { readonly ok: false; readonly message: string };

export interface ObservationController {
	finishMaterialReview(
		action: MaterialReviewFinishAction,
		port: ObservationCommandPort,
	): MaterialReviewFinishControllerResult;
	startMaterialReview(
		value: {
			readonly intent: MaterialReviewIntent;
			readonly episode: MaterialReviewEpisodeCapability;
			readonly capturedAt: unknown;
		},
		port: ObservationCommandPort,
	): MaterialReviewStartControllerResult;
	capture(
		value: {
			readonly origin: unknown;
			readonly text: unknown;
			readonly capturedAt: unknown;
		},
		port: ObservationCommandPort,
	): CandidateCaptureResult;
	trackUserHypothesis(
		value: {
			readonly episode: UserHypothesisEpisodeCapability;
			readonly original: string;
			readonly context: string;
			readonly capturedAt: string;
			readonly inputSource: "interactive" | "rpc";
		},
		port: ObservationCommandPort,
	): Promise<TrackUserHypothesisResult>;
	execute(
		value: unknown,
		port: ObservationCommandPort,
	): Promise<ObservationControllerResult>;
	requestMemo(port: ObservationCommandPort): MemoRequestControllerResult;
	requestSave(
		port: ObservationCommandPort,
	): Promise<SaveRequestControllerResult>;
}

interface ControllerDependencies {
	readonly selectionStore: NotebookSelectionStore;
	readonly ids: ObservationControllerIds;
}

interface LiveWorkingBranch {
	readonly pi: ObserverPiSnapshot;
	readonly memo: ReturnType<typeof reconstructMemoSession>;
	readonly observation: ObservationSessionSnapshot;
	readonly materialReview: ReturnType<typeof reconstructMaterialReviewSession>;
}

function assertNever(value: never): never {
	throw new Error(`Unhandled observation action: ${String(value)}`);
}

function liveBranch(port: ObservationCommandPort): LiveWorkingBranch | string {
	const entries = port.branchEntries();
	const pi = reconstructObserverPiState(entries);
	const memo = reconstructMemoSession(entries);
	const observation = reconstructObservationSession(entries);
	const materialReview = reconstructMaterialReviewSession(entries);
	const firstIssue =
		pi.issues[0]?.code ??
		memo.issues[0]?.code ??
		observation.issues[0]?.code ??
		materialReview.issues[0]?.code;
	return firstIssue
		? `Observer working history를 확인해야 합니다: ${firstIssue}.`
		: { pi, memo, observation, materialReview };
}

function isLiveBranch(
	value: LiveWorkingBranch | string,
): value is LiveWorkingBranch {
	return typeof value !== "string";
}

function activeEpisode(branch: LiveWorkingBranch): boolean {
	return (
		branch.pi.state.mode === "on" && branch.pi.state.episode.status === "open"
	);
}

function branchReadAuthorized(
	branch: LiveWorkingBranch,
	read: SourceReadRecordedEvent,
): boolean {
	if (!read.materialReviewRequestId) return activeEpisode(branch);
	return (
		branch.pi.state.episode.status === "open" &&
		branch.pi.state.episode.core.episodeId === read.episodeId &&
		branch.materialReview.pendingRequest?.requestId ===
			read.materialReviewRequestId &&
		branch.materialReview.pendingRequest.episodeId === read.episodeId
	);
}

function refinedEvent(
	value: unknown,
	kind: ObservationEvent["kind"],
): ObservationEvent | string {
	const prepared = prepareObservationEvent(value);
	if (!prepared.ok) return prepared.issue.message;
	return prepared.value.kind === kind
		? prepared.value
		: `Observer event kind mismatch: expected ${kind}.`;
}

function replayedEvent(
	snapshot: ObservationSessionSnapshot,
	event: ObservationEvent,
): ObservationEvent | null {
	switch (event.kind) {
		case "candidate-captured":
			return (
				snapshot.candidates.find(
					(item) => item.candidateId === event.candidateId,
				) ?? null
			);
		case "source-read-recorded":
			return (
				snapshot.sourceReads.find((item) => item.readId === event.readId) ??
				null
			);
		case "inquiry-hydrated":
			return (
				snapshot.hydrations.find(
					(item) => item.hydrationId === event.hydrationId,
				) ?? null
			);
		case "semantic-observation-recorded":
			return (
				snapshot.observations.find(
					(item) => item.observationId === event.observationId,
				) ?? null
			);
		case "user-hypothesis-recorded":
			return (
				snapshot.userHypotheses.find(
					(item) => item.observationId === event.observationId,
				) ?? null
			);
		case "hypothesis-context-reviewed":
			return (
				snapshot.hypothesisReviews.find(
					(item) =>
						item.hypothesisObservationId === event.hypothesisObservationId,
				) ?? null
			);
		case "memo-requested":
			return (
				snapshot.memoRequests.find(
					(item) => item.requestId === event.requestId,
				) ?? null
			);
		default:
			return assertNever(event);
	}
}

function appendEvent(
	port: ObservationCommandPort,
	event: ObservationEvent,
): ObservationSessionSnapshot | string {
	try {
		port.appendEntry(OBSERVER_OBSERVATION_ENTRY, encodeObservationEvent(event));
	} catch (error) {
		return `Observer working entry 기록 실패: ${error instanceof Error ? error.message : String(error)}`;
	}
	const replayed = reconstructObservationSession(port.branchEntries());
	const first = replayed.issues[0];
	if (first) return `Observer working entry replay 실패: ${first.code}.`;
	const confirmed = replayedEvent(replayed, event);
	return confirmed &&
		JSON.stringify(encodeObservationEvent(confirmed)) ===
			JSON.stringify(encodeObservationEvent(event))
		? replayed
		: "Observer working entry가 replay에서 확인되지 않았습니다.";
}

function appendMaterialReviewRequest(
	port: ObservationCommandPort,
	request: MaterialReviewRequestedEvent,
): MaterialReviewRequestedEvent | string {
	try {
		port.appendEntry(
			OBSERVER_MATERIAL_REVIEW_ENTRY,
			encodeMaterialReviewEvent(request),
		);
	} catch (error) {
		return `Material review request 기록 실패: ${error instanceof Error ? error.message : String(error)}`;
	}
	const replayed = reconstructMaterialReviewSession(port.branchEntries());
	const issue = replayed.issues[0];
	if (issue) return `Material review request replay 실패: ${issue.code}.`;
	const confirmed = replayed.requests.find(
		(event) => event.requestId === request.requestId,
	);
	return confirmed &&
		JSON.stringify(encodeMaterialReviewEvent(confirmed)) ===
			JSON.stringify(encodeMaterialReviewEvent(request))
		? confirmed
		: "Material review request가 replay에서 확인되지 않았습니다.";
}

function appendMaterialReviewCompletion(
	port: ObservationCommandPort,
	completion: MaterialReviewCompletedEvent,
): MaterialReviewCompletedEvent | string {
	try {
		port.appendEntry(
			OBSERVER_MATERIAL_REVIEW_ENTRY,
			encodeMaterialReviewEvent(completion),
		);
	} catch (error) {
		return `Material review completion 기록 실패: ${error instanceof Error ? error.message : String(error)}`;
	}
	const replayed = reconstructMaterialReviewSession(port.branchEntries());
	const issue = replayed.issues[0];
	if (issue) return `Material review completion replay 실패: ${issue.code}.`;
	const confirmed = replayed.completions.find(
		(event) => event.requestId === completion.requestId,
	);
	return confirmed &&
		JSON.stringify(encodeMaterialReviewEvent(confirmed)) ===
			JSON.stringify(encodeMaterialReviewEvent(completion))
		? confirmed
		: "Material review completion이 replay에서 확인되지 않았습니다.";
}

function materialReviewAttemptIssue(input: {
	readonly intent: MaterialReviewIntent;
	readonly episode: MaterialReviewEpisodeCapability;
	readonly branch: LiveWorkingBranch;
}): string | null {
	if (
		input.episode.requestId !== input.intent.requestId ||
		input.episode.userMessageDigest !== input.intent.userMessageDigest ||
		input.episode.material !== input.intent.material ||
		input.episode.inputSource !== input.intent.inputSource
	)
		return "Material review intent와 Episode capability가 일치하지 않습니다.";
	const lifecycle = input.branch.pi.state;
	if (
		lifecycle.episode.status !== "open" ||
		lifecycle.episode.core.episodeId !== input.episode.episodeId ||
		lifecycle.episode.core.notebookId !== input.episode.notebookId ||
		lifecycle.episode.core.lang !== input.episode.lang
	)
		return "Material review Episode capability가 현재 OPEN lifecycle과 일치하지 않습니다.";
	return null;
}

function existingInlineCandidate(input: {
	readonly request: MaterialReviewRequestedEvent;
	readonly intent: MaterialReviewIntent;
	readonly observation: ObservationSessionSnapshot;
}): CandidateCapturedEvent | string | null {
	const linked = input.observation.candidates.filter(
		(candidate) =>
			candidate.materialReviewRequestId === input.request.requestId,
	);
	if (linked.length === 0) return null;
	const candidate = linked[0];
	if (
		linked.length !== 1 ||
		!candidate ||
		candidate.episodeId !== input.request.episodeId ||
		candidate.text !== input.intent.exactUserText ||
		candidate.contentHash !== input.intent.userMessageDigest ||
		candidate.origin.kind !== "user-input" ||
		candidate.origin.inputSource !== input.intent.inputSource
	)
		return "Material review inline candidate history가 exact intent와 충돌합니다.";
	return candidate;
}

function startMaterialReview(input: {
	readonly value: {
		readonly intent: MaterialReviewIntent;
		readonly episode: MaterialReviewEpisodeCapability;
		readonly capturedAt: unknown;
	};
	readonly port: ObservationCommandPort;
	readonly ids: ObservationControllerIds;
}): MaterialReviewStartControllerResult {
	const branch = liveBranch(input.port);
	if (!isLiveBranch(branch)) return { ok: false, message: branch };
	const attemptIssue = materialReviewAttemptIssue({
		intent: input.value.intent,
		episode: input.value.episode,
		branch,
	});
	if (attemptIssue) return { ok: false, message: attemptIssue };
	const plan = planMaterialReviewRequest({
		intent: input.value.intent,
		episodeId: input.value.episode.episodeId,
		session: reconstructMaterialReviewSession(input.port.branchEntries()),
	});
	if (!plan.ok) return { ok: false, message: plan.issue.message };
	const request =
		plan.value.kind === "new"
			? appendMaterialReviewRequest(input.port, plan.value.request)
			: plan.value.request;
	if (typeof request === "string") return { ok: false, message: request };
	if (input.value.intent.material === "retrieved-tool-results")
		return { ok: true, status: "pending-retrieval", request };
	const observation = reconstructObservationSession(input.port.branchEntries());
	const observationIssue = observation.issues[0];
	if (observationIssue)
		return {
			ok: false,
			message: `Material review candidate replay 실패: ${observationIssue.code}.`,
		};
	const existing = existingInlineCandidate({
		request,
		intent: input.value.intent,
		observation,
	});
	if (typeof existing === "string") return { ok: false, message: existing };
	if (existing)
		return {
			ok: true,
			status: "inline-resumed",
			request,
			candidate: existing,
		};
	const prepared = refinedEvent(
		{
			observer_observation: "observer-observation/v1",
			kind: "candidate-captured",
			episode_id: request.episodeId,
			candidate_id: input.ids.candidateId(),
			origin: {
				kind: "user-input",
				input_source: input.value.intent.inputSource,
			},
			text: input.value.intent.exactUserText,
			content_hash: input.value.intent.userMessageDigest,
			captured_at: input.value.capturedAt,
			one_shot_request_id: request.requestId,
		},
		"candidate-captured",
	);
	if (typeof prepared === "string") return { ok: false, message: prepared };
	if (prepared.kind !== "candidate-captured")
		return {
			ok: false,
			message: "Material review candidate refinement failed.",
		};
	const appended = appendEvent(input.port, prepared);
	return typeof appended === "string"
		? { ok: false, message: appended }
		: {
				ok: true,
				status: "inline-captured",
				request,
				candidate: prepared,
			};
}

function finishMaterialReview(input: {
	readonly action: MaterialReviewFinishAction;
	readonly port: ObservationCommandPort;
}): MaterialReviewFinishControllerResult {
	const branch = liveBranch(input.port);
	if (!isLiveBranch(branch)) return { ok: false, message: branch };
	const episode = branch.pi.state.episode;
	if (episode.status !== "open")
		return {
			ok: false,
			message:
				"Material review completion requires an OPEN Episode without Review & Save review.",
		};
	const candidates = branch.observation.candidates.flatMap((candidate) =>
		candidate.materialReviewRequestId === input.action.requestId
			? [{ candidateId: candidate.candidateId }]
			: [],
	);
	const sourceReads = branch.observation.sourceReads.flatMap((read) =>
		read.materialReviewRequestId === input.action.requestId
			? [{ readId: read.readId, candidateIds: read.candidateIds }]
			: [],
	);
	const observations = branch.observation.observations.map((observation) => ({
		observationId: observation.observationId,
		readId: observation.readId,
	}));
	const planned = planMaterialReviewCompletion({
		requestId: input.action.requestId,
		episodeId: episode.core.episodeId,
		session: branch.materialReview,
		candidates,
		sourceReads,
		observations,
	});
	if (!planned.ok) return { ok: false, message: planned.issue.message };
	const persisted = branch.materialReview.completions.find(
		(completion) => completion.requestId === input.action.requestId,
	);
	if (persisted)
		return { ok: true, status: "resumed", completion: planned.value };
	const appended = appendMaterialReviewCompletion(input.port, planned.value);
	return typeof appended === "string"
		? { ok: false, message: appended }
		: { ok: true, status: "completed", completion: appended };
}

function encodeOrigin(origin: unknown): unknown {
	return origin;
}

function sourceDraft(source: WorkingSourceDraft, sourceId: SourceId): unknown {
	switch (source.kind) {
		case "external-material":
			return {
				kind: source.kind,
				source_id: sourceId,
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
				source_id: sourceId,
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

interface NotebookWorkingSet {
	readonly notebook: NotebookHandle;
	readonly inventory: readonly NotebookInventoryEntry[];
}

async function notebookWorkingSetFor(
	branch: LiveWorkingBranch,
	notebooks: NotebookService,
): Promise<NotebookWorkingSet | string> {
	const recovered = await notebooks.recover(branch.pi.state);
	if (!recovered.ok) return `Notebook 복구 실패: ${recovered.issue.message}`;
	const inventory = await readNotebookInventory(recovered.value.notebook);
	return inventory.ok
		? { notebook: recovered.value.notebook, inventory: inventory.value }
		: `Notebook 읽기 실패: ${inventory.issue.message}`;
}

async function inventoryFor(
	branch: LiveWorkingBranch,
	notebooks: NotebookService,
): Promise<readonly NotebookInventoryEntry[] | string> {
	const workingSet = await notebookWorkingSetFor(branch, notebooks);
	return typeof workingSet === "string" ? workingSet : workingSet.inventory;
}

function isInventory(
	value: readonly NotebookInventoryEntry[] | string,
): value is readonly NotebookInventoryEntry[] {
	return typeof value !== "string";
}

function currentIndex(input: {
	readonly branch: LiveWorkingBranch;
	readonly inventory: readonly import("./notebook.ts").NotebookInventoryEntry[];
}): StandingIndex {
	return buildStandingIndex({
		inventory: input.inventory,
		memo: input.branch.memo.state,
		observation: input.branch.observation,
	});
}

function prepareSourceRead(input: {
	readonly action: SourceReadAction;
	readonly ids: ObservationControllerIds;
	readonly candidates: readonly CandidateCapturedEvent[];
	readonly index: StandingIndex;
	readonly episodeId: string;
	readonly ancestry: ReturnType<typeof deriveReadAncestry>;
}): SourceReadRecordedEvent | string {
	const prepared = refinedEvent(
		{
			observer_observation: "observer-observation/v1",
			kind: "source-read-recorded",
			episode_id: input.episodeId,
			read_id: input.ids.sourceReadId(),
			candidate_ids: input.action.candidateIds,
			source: sourceDraft(input.action.source, input.ids.sourceId()),
			faithful_summary: input.action.faithfulSummary,
			claims: input.action.claims.map((claim) => ({
				text: claim.text,
				locator: claim.locator,
			})),
			candidate_digest: observationCandidateDigest(input.candidates),
			index_digest: input.index.digest,
			index_inquiry_ids: input.index.inquiries.map(
				(inquiry) => inquiry.inquiryId,
			),
			...(input.ancestry.kind === "material-review"
				? { one_shot_request_id: input.ancestry.requestId }
				: {}),
		},
		"source-read-recorded",
	);
	if (typeof prepared === "string") return prepared;
	return prepared.kind === "source-read-recorded"
		? prepared
		: "Source-read event refinement failed.";
}

async function sourceRead(input: {
	readonly action: SourceReadAction;
	readonly port: ObservationCommandPort;
	readonly notebooks: NotebookService;
	readonly ids: ObservationControllerIds;
}): Promise<ObservationControllerResult> {
	const branch = liveBranch(input.port);
	if (!isLiveBranch(branch)) return { ok: false, message: branch };
	const episode = branch.pi.state.episode;
	if (episode.status !== "open") {
		return { ok: false, message: "Source-read에는 open Episode가 필요합니다." };
	}
	const candidates = input.action.candidateIds.flatMap((candidateId) => {
		const candidate = branch.observation.candidates.find(
			(item) => item.candidateId === candidateId,
		);
		return candidate ? [candidate] : [];
	});
	if (candidates.length !== input.action.candidateIds.length) {
		return {
			ok: false,
			message: "Source-read candidate를 current branch에서 찾지 못했습니다.",
		};
	}
	if (
		candidates.some(
			(candidate) => candidate.origin.kind === "explicit-user-hypothesis",
		)
	)
		return {
			ok: false,
			message: "A user hypothesis is not Source evidence.",
		};
	const ancestry = deriveReadAncestry({
		candidates,
		pendingRequest: branch.materialReview.pendingRequest,
		episodeId: episode.core.episodeId,
	});
	if (ancestry.kind === "invalid")
		return {
			ok: false,
			message:
				"Source-read candidate의 Material review ancestry가 일치하지 않습니다.",
		};
	if (!activeEpisode(branch) && ancestry.kind !== "material-review")
		return {
			ok: false,
			message:
				"Source-read에는 Mode ON 또는 exact Material review ancestry가 필요합니다.",
		};
	const usedCandidateIds = new Set(
		branch.observation.sourceReads.flatMap((read) => read.candidateIds),
	);
	if (
		candidates.some((candidate) => usedCandidateIds.has(candidate.candidateId))
	) {
		return { ok: false, message: "이미 SourceRead에 사용된 candidate입니다." };
	}
	const inventory = await inventoryFor(branch, input.notebooks);
	if (!isInventory(inventory)) return { ok: false, message: inventory };
	const index = currentIndex({ branch, inventory });
	const prepared = prepareSourceRead({
		action: input.action,
		ids: input.ids,
		candidates,
		index,
		episodeId: episode.core.episodeId,
		ancestry,
	});
	if (typeof prepared === "string") return { ok: false, message: prepared };
	const appended = appendEvent(input.port, prepared);
	if (typeof appended === "string") return { ok: false, message: appended };
	return {
		ok: true,
		action: "source-read",
		message: `Source-first reading 기록 완료: ${prepared.readId}`,
		read: prepared,
		index,
	};
}

async function hydrate(input: {
	readonly action: HydrateAction;
	readonly port: ObservationCommandPort;
	readonly notebooks: NotebookService;
	readonly ids: ObservationControllerIds;
}): Promise<ObservationControllerResult> {
	const branch = liveBranch(input.port);
	if (!isLiveBranch(branch)) return { ok: false, message: branch };
	const episode = branch.pi.state.episode;
	if (episode.status !== "open")
		return {
			ok: false,
			message: "Inquiry hydration에는 open Episode가 필요합니다.",
		};
	const read = branch.observation.sourceReads.find(
		(item) => item.readId === input.action.readId,
	);
	if (!read || read.indexDigest !== input.action.indexDigest) {
		return {
			ok: false,
			message: "Hydration target SourceRead/index가 현재 branch와 다릅니다.",
		};
	}
	if (!branchReadAuthorized(branch, read))
		return {
			ok: false,
			message:
				"Hydration에는 Mode ON 또는 exact Material review read ancestry가 필요합니다.",
		};
	const inventory = await inventoryFor(branch, input.notebooks);
	if (!isInventory(inventory)) return { ok: false, message: inventory };
	const index = currentIndex({ branch, inventory });
	if (index.digest !== input.action.indexDigest) {
		return {
			ok: false,
			message: "Standing index가 source-read 이후 변경되었습니다.",
		};
	}
	const context = hydrateStandingContext({
		index,
		requestedInquiryIds: input.action.inquiryIds,
		inventory,
		memo: branch.memo.state,
		observation: branch.observation,
		episodeLanguage: episode.core.lang,
	});
	if (!context.ok) return { ok: false, message: context.issue.message };
	const existing = branch.observation.hydrations.find(
		(item) =>
			item.readId === input.action.readId &&
			item.indexDigest === input.action.indexDigest &&
			item.inquiryIds.length === input.action.inquiryIds.length &&
			item.inquiryIds.every(
				(id, position) => id === input.action.inquiryIds[position],
			),
	);
	if (existing) {
		return {
			ok: true,
			action: "hydrate",
			message: `이미 활성화된 Standing Inquiry context: ${existing.inquiryIds.length}개`,
			hydration: existing,
			context: context.value,
		};
	}
	const prepared = refinedEvent(
		{
			observer_observation: "observer-observation/v1",
			kind: "inquiry-hydrated",
			episode_id: episode.core.episodeId,
			hydration_id: input.ids.hydrationId(),
			read_id: input.action.readId,
			index_digest: input.action.indexDigest,
			inquiry_ids: input.action.inquiryIds,
			context_digest: context.value.digest,
		},
		"inquiry-hydrated",
	);
	if (typeof prepared === "string") return { ok: false, message: prepared };
	if (prepared.kind !== "inquiry-hydrated") {
		return { ok: false, message: "Hydration event refinement failed." };
	}
	const appended = appendEvent(input.port, prepared);
	if (typeof appended === "string") return { ok: false, message: appended };
	return {
		ok: true,
		action: "hydrate",
		message: `Standing Inquiry context 활성화: ${prepared.inquiryIds.length}개`,
		hydration: prepared,
		context: context.value,
	};
}

function renderHybridAlert(event: SemanticObservationRecordedEvent): string {
	return `Observer 중요 변화 (${event.movement}): ${event.rationale}`;
}

async function record(input: {
	readonly action: RecordObservationAction;
	readonly port: ObservationCommandPort;
	readonly ids: ObservationControllerIds;
}): Promise<ObservationControllerResult> {
	const branch = liveBranch(input.port);
	if (!isLiveBranch(branch)) return { ok: false, message: branch };
	const episode = branch.pi.state.episode;
	if (episode.status !== "open")
		return {
			ok: false,
			message: "Observation 기록에는 open Episode가 필요합니다.",
		};
	const read = branch.observation.sourceReads.find(
		(item) => item.readId === input.action.readId,
	);
	if (!read) {
		return {
			ok: false,
			message: "Observation SourceRead를 current branch에서 찾지 못했습니다.",
		};
	}
	if (!branchReadAuthorized(branch, read))
		return {
			ok: false,
			message:
				"Observation에는 Mode ON 또는 exact Material review read ancestry가 필요합니다.",
		};
	if (
		branch.observation.observations.some(
			(item) => item.readId === input.action.readId,
		)
	) {
		return {
			ok: false,
			message: "해당 SourceRead에는 이미 Observation이 있습니다.",
		};
	}
	if (input.action.hydrationId) {
		const hydration = branch.observation.hydrations.find(
			(item) => item.hydrationId === input.action.hydrationId,
		);
		if (
			!hydration ||
			hydration.readId !== input.action.readId ||
			hydration.inquiryIds.length !== input.action.relatedInquiryIds.length ||
			!hydration.inquiryIds.every(
				(id, position) => id === input.action.relatedInquiryIds[position],
			)
		) {
			return {
				ok: false,
				message: "Observation hydration이 SourceRead/Inquiry scope와 다릅니다.",
			};
		}
	}
	const prepared = refinedEvent(
		{
			observer_observation: "observer-observation/v1",
			kind: "semantic-observation-recorded",
			episode_id: episode.core.episodeId,
			observation_id: input.ids.observationId(),
			read_id: input.action.readId,
			hydration_id: input.action.hydrationId,
			related_inquiry_ids: input.action.relatedInquiryIds,
			stance: input.action.stance,
			movement: input.action.movement,
			rationale: input.action.rationale,
			observer_hypothesis: input.action.observerHypothesis
				? {
						inquiry_id: input.ids.inquiryId(),
						original: input.action.observerHypothesis,
					}
				: null,
		},
		"semantic-observation-recorded",
	);
	if (typeof prepared === "string") return { ok: false, message: prepared };
	if (prepared.kind !== "semantic-observation-recorded") {
		return { ok: false, message: "Semantic observation refinement failed." };
	}
	const appended = appendEvent(input.port, prepared);
	if (typeof appended === "string") return { ok: false, message: appended };
	if (prepared.visibility === "alert") {
		input.port.notify(renderHybridAlert(prepared), "warning");
	}
	return {
		ok: true,
		action: "record",
		message:
			prepared.visibility === "alert"
				? "중요 변화를 기록하고 알렸습니다."
				: "관찰을 조용히 working ledger에 누적했습니다.",
		observation: prepared,
	};
}

type UserHypothesisRegistrationResult =
	| Extract<ObservationControllerResult, { readonly action: "user-hypothesis" }>
	| { readonly ok: false; readonly message: string };

async function registerUserHypothesis(input: {
	readonly branch: LiveWorkingBranch;
	readonly candidate: CandidateCapturedEvent;
	readonly existingInquiryId: InquiryId | null;
	readonly original: string;
	readonly context: string;
	readonly port: ObservationCommandPort;
	readonly notebooks: NotebookService;
	readonly ids: ObservationControllerIds;
}): Promise<UserHypothesisRegistrationResult> {
	const duplicate = input.branch.observation.userHypotheses.find(
		(item) =>
			item.candidateId === input.candidate.candidateId &&
			item.original === input.original &&
			item.context === input.context &&
			(input.existingInquiryId === null ||
				item.inquiryId === input.existingInquiryId),
	);
	if (duplicate) {
		return {
			ok: true,
			action: "user-hypothesis",
			message: "This user hypothesis is already being tracked.",
			hypothesis: duplicate,
		};
	}
	if (input.existingInquiryId) {
		const inventory = await inventoryFor(input.branch, input.notebooks);
		if (!isInventory(inventory)) return { ok: false, message: inventory };
		const index = currentIndex({ branch: input.branch, inventory });
		if (
			!index.inquiries.some(
				(item) => item.inquiryId === input.existingInquiryId,
			)
		) {
			return {
				ok: false,
				message: "The selected Inquiry is not in the current standing index.",
			};
		}
	}
	const episode = input.branch.pi.state.episode;
	if (episode.status !== "open")
		return {
			ok: false,
			message: "Hypothesis tracking requires an open Episode.",
		};
	const prepared = refinedEvent(
		{
			observer_observation: "observer-observation/v1",
			kind: "user-hypothesis-recorded",
			episode_id: episode.core.episodeId,
			observation_id: input.ids.observationId(),
			candidate_id: input.candidate.candidateId,
			inquiry_id: input.existingInquiryId ?? input.ids.inquiryId(),
			original: input.original,
			context: input.context,
		},
		"user-hypothesis-recorded",
	);
	if (typeof prepared === "string") return { ok: false, message: prepared };
	if (prepared.kind !== "user-hypothesis-recorded")
		return { ok: false, message: "User hypothesis refinement failed." };
	const appended = appendEvent(input.port, prepared);
	if (typeof appended === "string") return { ok: false, message: appended };
	input.port.notify(`Tracking hypothesis: ${prepared.original}`, "info");
	return {
		ok: true,
		action: "user-hypothesis",
		message: "The user hypothesis was added to the working state.",
		hypothesis: prepared,
	};
}

async function userHypothesis(input: {
	readonly action: RegisterUserHypothesisAction;
	readonly port: ObservationCommandPort;
	readonly notebooks: NotebookService;
	readonly ids: ObservationControllerIds;
}): Promise<ObservationControllerResult> {
	const branch = liveBranch(input.port);
	if (!isLiveBranch(branch)) return { ok: false, message: branch };
	if (!activeEpisode(branch) || branch.pi.state.episode.status !== "open")
		return {
			ok: false,
			message:
				"User hypothesis registration requires Mode ON and an open Episode.",
		};
	const candidate = branch.observation.candidates.find(
		(item) => item.candidateId === input.action.candidateId,
	);
	if (!candidate || candidate.origin.kind !== "user-input")
		return {
			ok: false,
			message: "A current user-input candidate is required.",
		};
	return registerUserHypothesis({
		branch,
		candidate,
		existingInquiryId: input.action.existingInquiryId,
		original: input.action.original,
		context: input.action.context,
		port: input.port,
		notebooks: input.notebooks,
		ids: input.ids,
	});
}

function trackedHypothesisEpisodeIssue(input: {
	readonly branch: LiveWorkingBranch;
	readonly capability: UserHypothesisEpisodeCapability;
}): string | null {
	const episode = input.branch.pi.state.episode;
	return episode.status === "open" &&
		episode.core.episodeId === input.capability.episodeId &&
		episode.core.notebookId === input.capability.notebookId &&
		episode.core.lang === input.capability.lang &&
		input.branch.pi.state.mode === input.capability.mode
		? null
		: "The hypothesis Episode capability no longer matches the current branch.";
}

async function trackUserHypothesis(input: {
	readonly value: {
		readonly episode: UserHypothesisEpisodeCapability;
		readonly original: string;
		readonly context: string;
		readonly capturedAt: string;
		readonly inputSource: "interactive" | "rpc";
	};
	readonly port: ObservationCommandPort;
	readonly notebooks: NotebookService;
	readonly ids: ObservationControllerIds;
}): Promise<TrackUserHypothesisResult> {
	let branch = liveBranch(input.port);
	if (!isLiveBranch(branch)) return { ok: false, message: branch };
	const initialBranch = branch;
	const episodeIssue = trackedHypothesisEpisodeIssue({
		branch: initialBranch,
		capability: input.value.episode,
	});
	if (episodeIssue) return { ok: false, message: episodeIssue };
	const preparedCandidate = refinedEvent(
		{
			observer_observation: "observer-observation/v1",
			kind: "candidate-captured",
			episode_id: input.value.episode.episodeId,
			candidate_id: input.ids.candidateId(),
			origin: {
				kind: "explicit-user-hypothesis",
				input_source: input.value.inputSource,
			},
			text: input.value.original,
			content_hash: sha256Text(input.value.original),
			captured_at: input.value.capturedAt,
		},
		"candidate-captured",
	);
	if (typeof preparedCandidate === "string")
		return { ok: false, message: preparedCandidate };
	if (preparedCandidate.kind !== "candidate-captured")
		return { ok: false, message: "Hypothesis candidate refinement failed." };
	const existingHypothesis = initialBranch.observation.userHypotheses.find(
		(hypothesis) => {
			if (
				hypothesis.original !== input.value.original ||
				hypothesis.context !== input.value.context
			)
				return false;
			const candidate = initialBranch.observation.candidates.find(
				(item) => item.candidateId === hypothesis.candidateId,
			);
			return (
				candidate?.episodeId === input.value.episode.episodeId &&
				candidate.origin.kind === "explicit-user-hypothesis" &&
				candidate.text === preparedCandidate.text &&
				!candidate.materialReviewRequestId
			);
		},
	);
	let candidate = existingHypothesis
		? initialBranch.observation.candidates.find(
				(item) => item.candidateId === existingHypothesis.candidateId,
			)
		: initialBranch.observation.candidates.findLast(
				(item) =>
					item.episodeId === input.value.episode.episodeId &&
					item.origin.kind === "explicit-user-hypothesis" &&
					item.text === preparedCandidate.text &&
					!item.materialReviewRequestId,
			);
	if (!candidate) {
		const appended = appendEvent(input.port, preparedCandidate);
		if (typeof appended === "string") return { ok: false, message: appended };
		candidate = preparedCandidate;
		const replayed = liveBranch(input.port);
		if (!isLiveBranch(replayed)) return { ok: false, message: replayed };
		branch = replayed;
	}
	const registered = await registerUserHypothesis({
		branch,
		candidate,
		existingInquiryId: null,
		original: preparedCandidate.text,
		context: input.value.context,
		port: input.port,
		notebooks: input.notebooks,
		ids: input.ids,
	});
	if (!registered.ok) return registered;
	return {
		ok: true,
		status: existingHypothesis ? "resumed" : "recorded",
		reviewPending: !branch.observation.hypothesisReviews.some(
			(review) =>
				review.hypothesisObservationId === registered.hypothesis.observationId,
		),
		candidate,
		hypothesis: registered.hypothesis,
	};
}

function hypothesisReviewHasRequiredClues(
	action: HypothesisContextReviewAction,
): boolean {
	switch (action.assessment) {
		case "supports":
			return action.supportingClues.length > 0;
		case "challenges":
			return action.challengingClues.length > 0;
		case "mixed":
			return (
				action.supportingClues.length > 0 && action.challengingClues.length > 0
			);
		case "insufficient-context":
			return action.missingInformation.length > 0;
		default:
			return assertNever(action.assessment);
	}
}

async function hypothesisContextReview(input: {
	readonly action: HypothesisContextReviewAction;
	readonly port: ObservationCommandPort;
	readonly notebooks: NotebookService;
}): Promise<ObservationControllerResult> {
	const branch = liveBranch(input.port);
	if (!isLiveBranch(branch)) return { ok: false, message: branch };
	const episode = branch.pi.state.episode;
	if (episode.status !== "open")
		return {
			ok: false,
			message: "Hypothesis context review requires an open Episode.",
		};
	const hypothesis = branch.observation.userHypotheses.find(
		(item) => item.observationId === input.action.hypothesisObservationId,
	);
	if (!hypothesis || hypothesis.episodeId !== episode.core.episodeId)
		return {
			ok: false,
			message: "The hypothesis is not pending in the current Episode.",
		};
	const existing = branch.observation.hypothesisReviews.find(
		(item) => item.hypothesisObservationId === hypothesis.observationId,
	);
	if (existing)
		return {
			ok: true,
			action: "hypothesis-context-review",
			message: "The current-context review is already recorded.",
			review: existing,
		};
	if (!hypothesisReviewHasRequiredClues(input.action))
		return {
			ok: false,
			message:
				"The assessment must include matching clues, or missing information when context is insufficient.",
		};
	if (input.action.sourceIds.length > 0) {
		const inventory = await inventoryFor(branch, input.notebooks);
		if (!isInventory(inventory)) return { ok: false, message: inventory };
		const availableSourceIds = new Set([
			...inventory.flatMap((entry) =>
				entry.document.record.observer_type === "source"
					? [entry.document.record.id]
					: [],
			),
			...branch.observation.sourceReads.map((read) => read.source.sourceId),
		]);
		if (input.action.sourceIds.some((id) => !availableSourceIds.has(id)))
			return {
				ok: false,
				message:
					"A context-review Source reference is not available in the current Episode or Notebook.",
			};
	}
	const prepared = refinedEvent(
		{
			observer_observation: "observer-observation/v1",
			kind: "hypothesis-context-reviewed",
			episode_id: episode.core.episodeId,
			hypothesis_observation_id: hypothesis.observationId,
			assessment: input.action.assessment,
			supporting_clues: input.action.supportingClues,
			challenging_clues: input.action.challengingClues,
			missing_information: input.action.missingInformation,
			source_ids: input.action.sourceIds,
			interpretation_boundary: input.action.interpretationBoundary,
		},
		"hypothesis-context-reviewed",
	);
	if (typeof prepared === "string") return { ok: false, message: prepared };
	if (prepared.kind !== "hypothesis-context-reviewed")
		return {
			ok: false,
			message: "Hypothesis context review refinement failed.",
		};
	const appended = appendEvent(input.port, prepared);
	return typeof appended === "string"
		? { ok: false, message: appended }
		: {
				ok: true,
				action: "hypothesis-context-review",
				message: `Reviewed current context through the hypothesis: ${prepared.assessment}`,
				review: prepared,
			};
}

function requestMemo(input: {
	readonly port: ObservationCommandPort;
	readonly ids: ObservationControllerIds;
}): MemoRequestControllerResult {
	const branch = liveBranch(input.port);
	if (!isLiveBranch(branch)) return { ok: false, message: branch };
	if (branch.observation.pendingHypothesisReviews.length > 0)
		return {
			ok: false,
			message:
				"Finish the pending hypothesis context review before Memo reconciliation.",
		};
	if (branch.memo.prepared || branch.memo.pendingAcknowledgment) {
		const pendingRequestId = branch.observation.pendingMemoRequest?.requestId;
		const instructionId =
			branch.memo.prepared?.instructionId ??
			branch.memo.pendingAcknowledgment?.instructionId;
		if (pendingRequestId && instructionId !== pendingRequestId) {
			return {
				ok: false,
				message:
					"Pending Observation request와 다른 Memo pass는 적용할 수 없습니다.",
			};
		}
		return {
			ok: true,
			status: "delegate",
			message: "기존 Memo pass를 적용하거나 복구합니다.",
			request: null,
		};
	}
	const planned = planObservationMemoRequest({
		observation: branch.observation,
		memo: branch.memo,
		requestId: input.ids.memoRequestId(),
	});
	if (!planned.ok) return { ok: false, message: planned.issue.message };
	switch (planned.value.kind) {
		case "none":
			return {
				ok: true,
				status: "none",
				message: "새 prepared reconciliation이 없습니다.",
				request: null,
			};
		case "resume":
			return {
				ok: true,
				status: "resumed",
				message: `기존 Memo request를 재개합니다: ${planned.value.request.requestId}`,
				request: planned.value.request,
			};
		case "append": {
			const appended = appendEvent(input.port, planned.value.request);
			return typeof appended === "string"
				? { ok: false, message: appended }
				: {
						ok: true,
						status: "requested",
						message: `Memo request를 기록했습니다: ${planned.value.request.requestId}`,
						request: planned.value.request,
					};
		}
		default:
			return assertNever(planned.value);
	}
}

async function requestSave(input: {
	readonly port: ObservationCommandPort;
	readonly notebooks: NotebookService;
	readonly ids: ObservationControllerIds;
}): Promise<SaveRequestControllerResult> {
	const branch = liveBranch(input.port);
	if (!isLiveBranch(branch)) return { ok: false, message: branch };
	if (
		branch.pi.prepared ||
		branch.pi.state.episode.status === "reviewing-save"
	) {
		return {
			ok: true,
			status: "delegate",
			message: "Review or recover the existing save proposal.",
			request: null,
		};
	}
	const workingSet = await notebookWorkingSetFor(branch, input.notebooks);
	if (typeof workingSet === "string") return { ok: false, message: workingSet };
	const requestSession = reconstructSaveRequestSession(
		input.port.branchEntries(),
	);
	const planned = planSaveRequest({
		observation: branch.observation,
		memo: branch.memo,
		requestSession,
		inventory: workingSet.inventory,
		notebook: workingSet.notebook,
		requestId: input.ids.saveRequestId(),
		proposalId: input.ids.saveProposalId(),
	});
	if (!planned.ok) return { ok: false, message: planned.issue.message };
	if (planned.value.kind === "resume") {
		return {
			ok: true,
			status: "resumed",
			message: `Resuming the existing save request: ${planned.value.request.requestId}`,
			request: planned.value.request,
		};
	}
	try {
		input.port.appendEntry(
			OBSERVER_SAVE_REQUEST_ENTRY,
			encodeSaveRequestEvent(planned.value.request),
		);
	} catch (error) {
		return {
			ok: false,
			message: `Could not record the save request: ${error instanceof Error ? error.message : String(error)}`,
		};
	}
	const replayed = reconstructSaveRequestSession(input.port.branchEntries());
	const confirmed = replayed.pendingRequest;
	if (
		replayed.issues.length > 0 ||
		confirmed?.requestId !== planned.value.request.requestId ||
		confirmed.requestDigest !== planned.value.request.requestDigest
	) {
		return {
			ok: false,
			message: replayed.issues[0]
				? `Save request replay failed: ${replayed.issues[0].code}.`
				: "The save request was not confirmed by replay.",
		};
	}
	return {
		ok: true,
		status: "requested",
		message: `Save request recorded: ${confirmed.requestId}`,
		request: confirmed,
	};
}

async function saveContext(input: {
	readonly requestId: SaveRequestId;
	readonly port: ObservationCommandPort;
	readonly notebooks: NotebookService;
}): Promise<
	| { readonly ok: true; readonly value: SavePreparationContext }
	| { readonly ok: false; readonly message: string }
> {
	const branch = liveBranch(input.port);
	if (!isLiveBranch(branch)) return { ok: false, message: branch };
	const workingSet = await notebookWorkingSetFor(branch, input.notebooks);
	if (typeof workingSet === "string") return { ok: false, message: workingSet };
	const requestSession = reconstructSaveRequestSession(
		input.port.branchEntries(),
	);
	const request = requestSession.pendingRequest;
	if (!request || request.requestId !== input.requestId)
		return {
			ok: false,
			message: "Review & Save action에는 exact pending request가 필요합니다.",
		};
	const context = hydrateSavePreparationContext({
		request,
		observation: branch.observation,
		memo: branch.memo,
		requestSession,
		inventory: workingSet.inventory,
		notebook: workingSet.notebook,
	});
	return context.ok
		? { ok: true, value: context.value }
		: { ok: false, message: context.issue.message };
}

async function saveScope(input: {
	readonly action: SaveScopeAction;
	readonly port: ObservationCommandPort;
	readonly notebooks: NotebookService;
}): Promise<ObservationControllerResult> {
	const context = await saveContext({
		requestId: input.action.requestId,
		port: input.port,
		notebooks: input.notebooks,
	});
	if (!context.ok) return context;
	return {
		ok: true,
		action: "save-scope",
		message: `Save request scope activated: ${input.action.requestId}`,
		context: context.value,
		guide: buildSavePreparationGuide(context.value),
	};
}

async function savePrepare(input: {
	readonly action: SavePrepareAction;
	readonly port: ObservationCommandPort;
	readonly notebooks: NotebookService;
}): Promise<ObservationControllerResult> {
	const context = await saveContext({
		requestId: input.action.requestId,
		port: input.port,
		notebooks: input.notebooks,
	});
	if (!context.ok) return context;
	const prepared = prepareSaveHandoff({
		context: context.value,
		summary: input.action.summary,
		records: input.action.records,
	});
	if (!prepared.ok) return { ok: false, message: prepared.issue.message };
	return {
		ok: true,
		action: "save-prepare",
		message: `Save proposal prepared: ${prepared.value.prepared.proposal_id}`,
		handoff: prepared.value,
	};
}

async function memoScope(input: {
	readonly action: MemoScopeAction;
	readonly port: ObservationCommandPort;
	readonly notebooks: NotebookService;
}): Promise<ObservationControllerResult> {
	const branch = liveBranch(input.port);
	if (!isLiveBranch(branch)) return { ok: false, message: branch };
	if (branch.pi.state.episode.status !== "open") {
		return { ok: false, message: "Memo scope에는 열린 Episode가 필요합니다." };
	}
	const inventory = await inventoryFor(branch, input.notebooks);
	if (!isInventory(inventory)) return { ok: false, message: inventory };
	const context = hydrateObservationMemoContext({
		observation: branch.observation,
		memo: branch.memo,
		inventory,
		requestId: input.action.requestId,
	});
	if (!context.ok) return { ok: false, message: context.issue.message };
	const guide = buildObservationMemoPreparationGuide({
		context: context.value,
		observation: branch.observation,
		memo: branch.memo,
	});
	return guide.ok
		? {
				ok: true,
				action: "memo-scope",
				message: `Memo request scope 활성화: ${context.value.request.requestId}`,
				context: context.value,
				guide: guide.value,
			}
		: { ok: false, message: guide.issue.message };
}

interface DecodedMemoPreparation {
	readonly instruction: PreparedObservationMemoInstruction;
	readonly priorSession: MemoInstructionSessionSnapshot;
}

async function decodeMemoPreparation(input: {
	readonly action: MemoPrepareAction;
	readonly port: ObservationCommandPort;
	readonly notebooks: NotebookService;
}): Promise<DecodedMemoPreparation | string> {
	const branch = liveBranch(input.port);
	if (!isLiveBranch(branch)) return branch;
	if (branch.pi.state.episode.status !== "open") {
		return "Memo preparation에는 열린 Episode가 필요합니다.";
	}
	const priorSession = reconstructMemoInstructionSession(
		input.port.branchEntries(),
	);
	if (priorSession.issues.length > 0) {
		return `Memo instruction history를 확인해야 합니다: ${priorSession.issues[0]?.code}.`;
	}
	const inventory = await inventoryFor(branch, input.notebooks);
	if (!isInventory(inventory)) return inventory;
	const context = hydrateObservationMemoContext({
		observation: branch.observation,
		memo: branch.memo,
		inventory,
		requestId: input.action.requestId,
	});
	if (!context.ok) return context.issue.message;
	const guide = buildObservationMemoPreparationGuide({
		context: context.value,
		observation: branch.observation,
		memo: branch.memo,
	});
	if (!guide.ok) return guide.issue.message;
	const seed = guide.value.instruction_seed;
	const decoded = decodePreparedObservationMemoInstruction({
		value: {
			...seed,
			pass: {
				...seed.pass,
				evidence: input.action.submission.evidence,
				hypothesis_outcomes: input.action.submission.hypothesisOutcomes,
				memo_outcomes: input.action.submission.memoOutcomes,
			},
			dispositions: input.action.submission.dispositions,
		},
		context: context.value,
	});
	if (!decoded.ok) return decoded.issue.message;
	const reconciled = reconcileMemoPass({
		state: branch.memo.state,
		scope: context.value.memoScope,
		pass: decoded.value.pass,
		ids: {
			revisionId() {
				return "memo-working-revision-00000000-0000-4000-8000-000000000000";
			},
			receiptId(): `memo-receipt-${string}` {
				return "memo-receipt-00000000-0000-4000-8000-000000000000";
			},
		},
	});
	return reconciled.ok
		? { instruction: decoded.value, priorSession }
		: `Memo instruction domain validation failed: ${reconciled.issue.message}`;
}

async function memoPrepare(input: {
	readonly action: MemoPrepareAction;
	readonly port: ObservationCommandPort;
	readonly notebooks: NotebookService;
}): Promise<ObservationControllerResult> {
	const decoded = await decodeMemoPreparation(input);
	if (typeof decoded === "string") return { ok: false, message: decoded };
	const existing = decoded.priorSession.instructions.find(
		(instruction) => instruction.requestId === input.action.requestId,
	);
	if (existing) {
		return existing.digest === decoded.instruction.digest
			? {
					ok: true,
					action: "memo-prepare",
					status: "resumed",
					message: `기존 Memo instruction을 재개합니다: ${existing.requestId}`,
					instruction: decoded.instruction,
				}
			: {
					ok: false,
					message: "같은 Memo request의 instruction이 충돌합니다.",
				};
	}
	try {
		input.port.appendEntry(
			OBSERVER_MEMO_INSTRUCTION_ENTRY,
			encodeObservationMemoInstruction(decoded.instruction),
		);
	} catch (error) {
		return {
			ok: false,
			message: `Memo instruction 기록 실패: ${error instanceof Error ? error.message : String(error)}`,
		};
	}
	const replayed = reconstructMemoInstructionSession(
		input.port.branchEntries(),
	);
	const confirmed = replayed.instructions.find(
		(instruction) => instruction.requestId === input.action.requestId,
	);
	if (
		replayed.issues.length > 0 ||
		!confirmed ||
		confirmed.digest !== decoded.instruction.digest
	) {
		return {
			ok: false,
			message: replayed.issues[0]
				? `Memo instruction replay 실패: ${replayed.issues[0].code}.`
				: "Memo instruction이 replay에서 확인되지 않았습니다.",
		};
	}
	return {
		ok: true,
		action: "memo-prepare",
		status: "prepared",
		message: `Memo instruction을 기록했습니다: ${confirmed.requestId}`,
		instruction: decoded.instruction,
	};
}

type MemoSidecarAction = MemoScopeAction | MemoPrepareAction;

function isMemoSidecarAction(
	action: ObservationAction,
): action is MemoSidecarAction {
	return action.action === "memo-scope" || action.action === "memo-prepare";
}

function executeMemoSidecarAction(input: {
	readonly action: MemoSidecarAction;
	readonly port: ObservationCommandPort;
	readonly notebooks: NotebookService;
}): Promise<ObservationControllerResult> {
	const { action, port, notebooks } = input;
	return action.action === "memo-scope"
		? memoScope({ action, port, notebooks })
		: memoPrepare({ action, port, notebooks });
}

function pendingRetrievedCaptureRequest(input: {
	readonly branch: LiveWorkingBranch;
	readonly port: ObservationCommandPort;
}): MaterialReviewRequestedEvent | string | null {
	if (
		input.branch.pi.state.mode !== "off" ||
		input.branch.pi.state.episode.status !== "open"
	)
		return null;
	const pending = input.branch.materialReview.pendingRequest;
	return pending?.material === "retrieved-tool-results" &&
		pending.episodeId === input.branch.pi.state.episode.core.episodeId
		? pending
		: null;
}

function captureCandidate(input: {
	readonly value: {
		readonly origin: unknown;
		readonly text: unknown;
		readonly capturedAt: unknown;
	};
	readonly port: ObservationCommandPort;
	readonly ids: ObservationControllerIds;
}): CandidateCaptureResult {
	const branch = liveBranch(input.port);
	if (!isLiveBranch(branch)) return { ok: false, message: branch };
	const sidecarActive = activeEpisode(branch);
	const materialReviewRequest = sidecarActive
		? null
		: pendingRetrievedCaptureRequest({ branch, port: input.port });
	if (typeof materialReviewRequest === "string")
		return { ok: false, message: materialReviewRequest };
	if (!sidecarActive && !materialReviewRequest)
		return { ok: true, status: "ignored", candidate: null };
	if (branch.pi.state.episode.status !== "open")
		return { ok: true, status: "ignored", candidate: null };
	const prepared = refinedEvent(
		{
			observer_observation: "observer-observation/v1",
			kind: "candidate-captured",
			episode_id: branch.pi.state.episode.core.episodeId,
			candidate_id: input.ids.candidateId(),
			origin: encodeOrigin(input.value.origin),
			text: input.value.text,
			content_hash:
				typeof input.value.text === "string"
					? sha256Text(input.value.text)
					: "",
			captured_at: input.value.capturedAt,
			...(materialReviewRequest
				? { one_shot_request_id: materialReviewRequest.requestId }
				: {}),
		},
		"candidate-captured",
	);
	if (typeof prepared === "string") return { ok: false, message: prepared };
	if (prepared.kind !== "candidate-captured") {
		return { ok: false, message: "Candidate refinement failed." };
	}
	if (materialReviewRequest && prepared.origin.kind !== "tool-result")
		return { ok: true, status: "ignored", candidate: null };
	const appended = appendEvent(input.port, prepared);
	return typeof appended === "string"
		? { ok: false, message: appended }
		: { ok: true, status: "captured", candidate: prepared };
}

function executeObservationAction(input: {
	readonly action: ObservationAction;
	readonly port: ObservationCommandPort;
	readonly notebooks: NotebookService;
	readonly ids: ObservationControllerIds;
}): Promise<ObservationControllerResult> {
	if (isMemoSidecarAction(input.action)) {
		return executeMemoSidecarAction({
			action: input.action,
			port: input.port,
			notebooks: input.notebooks,
		});
	}
	switch (input.action.action) {
		case "source-read":
			return sourceRead({
				action: input.action,
				port: input.port,
				notebooks: input.notebooks,
				ids: input.ids,
			});
		case "hydrate":
			return hydrate({
				action: input.action,
				port: input.port,
				notebooks: input.notebooks,
				ids: input.ids,
			});
		case "record":
			return record({
				action: input.action,
				port: input.port,
				ids: input.ids,
			});
		case "user-hypothesis":
			return userHypothesis({
				action: input.action,
				port: input.port,
				notebooks: input.notebooks,
				ids: input.ids,
			});
		case "hypothesis-context-review":
			return hypothesisContextReview({
				action: input.action,
				port: input.port,
				notebooks: input.notebooks,
			});
		case "save-scope":
			return saveScope({
				action: input.action,
				port: input.port,
				notebooks: input.notebooks,
			});
		case "save-prepare":
			return savePrepare({
				action: input.action,
				port: input.port,
				notebooks: input.notebooks,
			});
		default:
			return Promise.resolve(assertNever(input.action));
	}
}

export function createObservationController(
	dependencies: ControllerDependencies,
): ObservationController {
	const notebooks = createNotebookService({
		selectionStore: dependencies.selectionStore,
	});
	return {
		finishMaterialReview(action, port) {
			return finishMaterialReview({ action, port });
		},
		startMaterialReview(value, port) {
			return startMaterialReview({ value, port, ids: dependencies.ids });
		},
		requestSave(port) {
			return requestSave({ port, notebooks, ids: dependencies.ids });
		},
		requestMemo(port) {
			return requestMemo({ port, ids: dependencies.ids });
		},
		capture(value, port) {
			return captureCandidate({ value, port, ids: dependencies.ids });
		},
		trackUserHypothesis(value, port) {
			return trackUserHypothesis({
				value,
				port,
				notebooks,
				ids: dependencies.ids,
			});
		},
		execute(value, port) {
			const decoded = decodeObservationAction(value);
			return decoded.ok
				? executeObservationAction({
						action: decoded.value,
						port,
						notebooks,
						ids: dependencies.ids,
					})
				: Promise.resolve({ ok: false, message: decoded.issue.message });
		},
	};
}
