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
import type { OneShotEpisodeCapability } from "./observer-controller.ts";
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
	type MemoPrepareAction,
	type MemoScopeAction,
	type ObservationAction,
	type WrapScopeAction,
	type WrapPrepareAction,
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
	type PreparedWrapHandoff,
} from "./pi-session.ts";
import {
	encodeOneShotEvent,
	OBSERVER_ONE_SHOT_ENTRY,
	planOneShotRequest,
	reconstructOneShotSession,
	type OneShotIntent,
	type OneShotRequestedEvent,
} from "./one-shot-trigger.ts";
import {
	buildStandingIndex,
	hydrateStandingContext,
	type StandingContext,
	type StandingIndex,
} from "./standing-index.ts";
import {
	buildWrapPreparationGuide,
	encodeWrapRequestEvent,
	hydrateWrapPreparationContext,
	OBSERVER_WRAP_REQUEST_ENTRY,
	planWrapRequest,
	prepareWrapHandoff,
	reconstructWrapRequestSession,
	type WrapPreparationContext,
	type WrapPreparationGuide,
	type WrapRequestEvent,
	type WrapRequestId,
	type WrapProposalId,
} from "./wrap-trigger.ts";

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
	wrapRequestId(): WrapRequestId;
	wrapProposalId(): WrapProposalId;
}

export type CandidateCaptureResult =
	| {
			readonly ok: true;
			readonly status: "captured" | "ignored";
			readonly candidate: CandidateCapturedEvent | null;
	  }
	| { readonly ok: false; readonly message: string };

export type OneShotStartControllerResult =
	| {
			readonly ok: true;
			readonly status: "pending-retrieval";
			readonly request: OneShotRequestedEvent;
	  }
	| {
			readonly ok: true;
			readonly status: "inline-captured" | "inline-resumed";
			readonly request: OneShotRequestedEvent;
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
			readonly action: "memo-scope";
			readonly message: string;
			readonly context: ObservationMemoContext;
			readonly guide: MemoPreparationGuide;
	  }
	| {
			readonly ok: true;
			readonly action: "wrap-scope";
			readonly message: string;
			readonly context: WrapPreparationContext;
			readonly guide: WrapPreparationGuide;
	  }
	| {
			readonly ok: true;
			readonly action: "wrap-prepare";
			readonly message: string;
			readonly handoff: PreparedWrapHandoff;
	  }
	| {
			readonly ok: true;
			readonly action: "memo-prepare";
			readonly status: "prepared" | "resumed";
			readonly message: string;
			readonly instruction: PreparedObservationMemoInstruction;
	  }
	| { readonly ok: false; readonly message: string };

export type WrapRequestControllerResult =
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
			readonly request: WrapRequestEvent;
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
	startOneShot(
		value: {
			readonly intent: OneShotIntent;
			readonly episode: OneShotEpisodeCapability;
			readonly capturedAt: unknown;
		},
		port: ObservationCommandPort,
	): OneShotStartControllerResult;
	capture(
		value: {
			readonly origin: unknown;
			readonly text: unknown;
			readonly capturedAt: unknown;
		},
		port: ObservationCommandPort,
	): CandidateCaptureResult;
	execute(
		value: unknown,
		port: ObservationCommandPort,
	): Promise<ObservationControllerResult>;
	requestMemo(port: ObservationCommandPort): MemoRequestControllerResult;
	requestWrap(
		port: ObservationCommandPort,
	): Promise<WrapRequestControllerResult>;
}

interface ControllerDependencies {
	readonly selectionStore: NotebookSelectionStore;
	readonly ids: ObservationControllerIds;
}

interface LiveWorkingBranch {
	readonly pi: ObserverPiSnapshot;
	readonly memo: ReturnType<typeof reconstructMemoSession>;
	readonly observation: ObservationSessionSnapshot;
	readonly oneShot: ReturnType<typeof reconstructOneShotSession>;
}

function assertNever(value: never): never {
	throw new Error(`Unhandled observation action: ${String(value)}`);
}

function liveBranch(port: ObservationCommandPort): LiveWorkingBranch | string {
	const entries = port.branchEntries();
	const pi = reconstructObserverPiState(entries);
	const memo = reconstructMemoSession(entries);
	const observation = reconstructObservationSession(entries);
	const oneShot = reconstructOneShotSession(entries);
	const firstIssue =
		pi.issues[0]?.code ??
		memo.issues[0]?.code ??
		observation.issues[0]?.code ??
		oneShot.issues[0]?.code;
	return firstIssue
		? `Observer working history를 확인해야 합니다: ${firstIssue}.`
		: { pi, memo, observation, oneShot };
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
	if (!read.oneShotRequestId) return activeEpisode(branch);
	return (
		branch.pi.state.episode.status === "open" &&
		branch.pi.state.episode.core.episodeId === read.episodeId &&
		branch.oneShot.pendingRequest?.requestId === read.oneShotRequestId &&
		branch.oneShot.pendingRequest.episodeId === read.episodeId
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

function appendOneShotRequest(
	port: ObservationCommandPort,
	request: OneShotRequestedEvent,
): OneShotRequestedEvent | string {
	try {
		port.appendEntry(OBSERVER_ONE_SHOT_ENTRY, encodeOneShotEvent(request));
	} catch (error) {
		return `One-shot request 기록 실패: ${error instanceof Error ? error.message : String(error)}`;
	}
	const replayed = reconstructOneShotSession(port.branchEntries());
	const issue = replayed.issues[0];
	if (issue) return `One-shot request replay 실패: ${issue.code}.`;
	const confirmed = replayed.requests.find(
		(event) => event.requestId === request.requestId,
	);
	return confirmed &&
		JSON.stringify(encodeOneShotEvent(confirmed)) ===
			JSON.stringify(encodeOneShotEvent(request))
		? confirmed
		: "One-shot request가 replay에서 확인되지 않았습니다.";
}

function oneShotAttemptIssue(input: {
	readonly intent: OneShotIntent;
	readonly episode: OneShotEpisodeCapability;
	readonly branch: LiveWorkingBranch;
}): string | null {
	if (
		input.episode.requestId !== input.intent.requestId ||
		input.episode.userMessageDigest !== input.intent.userMessageDigest ||
		input.episode.material !== input.intent.material ||
		input.episode.inputSource !== input.intent.inputSource
	)
		return "One-shot intent와 Episode capability가 일치하지 않습니다.";
	const lifecycle = input.branch.pi.state;
	if (
		lifecycle.mode !== "off" ||
		lifecycle.episode.status !== "open" ||
		lifecycle.episode.core.episodeId !== input.episode.episodeId ||
		lifecycle.episode.core.notebookId !== input.episode.notebookId ||
		lifecycle.episode.core.lang !== input.episode.lang
	)
		return "One-shot Episode capability가 현재 OPEN/OFF lifecycle과 일치하지 않습니다.";
	return null;
}

function existingInlineCandidate(input: {
	readonly request: OneShotRequestedEvent;
	readonly intent: OneShotIntent;
	readonly observation: ObservationSessionSnapshot;
}): CandidateCapturedEvent | string | null {
	const linked = input.observation.candidates.filter(
		(candidate) => candidate.oneShotRequestId === input.request.requestId,
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
		return "One-shot inline candidate history가 exact intent와 충돌합니다.";
	return candidate;
}

function startOneShot(input: {
	readonly value: {
		readonly intent: OneShotIntent;
		readonly episode: OneShotEpisodeCapability;
		readonly capturedAt: unknown;
	};
	readonly port: ObservationCommandPort;
	readonly ids: ObservationControllerIds;
}): OneShotStartControllerResult {
	const branch = liveBranch(input.port);
	if (!isLiveBranch(branch)) return { ok: false, message: branch };
	const attemptIssue = oneShotAttemptIssue({
		intent: input.value.intent,
		episode: input.value.episode,
		branch,
	});
	if (attemptIssue) return { ok: false, message: attemptIssue };
	const plan = planOneShotRequest({
		intent: input.value.intent,
		episodeId: input.value.episode.episodeId,
		session: reconstructOneShotSession(input.port.branchEntries()),
	});
	if (!plan.ok) return { ok: false, message: plan.issue.message };
	const request =
		plan.value.kind === "new"
			? appendOneShotRequest(input.port, plan.value.request)
			: plan.value.request;
	if (typeof request === "string") return { ok: false, message: request };
	if (input.value.intent.material === "retrieved-tool-results")
		return { ok: true, status: "pending-retrieval", request };
	const observation = reconstructObservationSession(input.port.branchEntries());
	const observationIssue = observation.issues[0];
	if (observationIssue)
		return {
			ok: false,
			message: `One-shot candidate replay 실패: ${observationIssue.code}.`,
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
		return { ok: false, message: "One-shot candidate refinement failed." };
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
			...(input.ancestry.kind === "one-shot"
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
	const ancestry = deriveReadAncestry({
		candidates,
		pendingRequest: branch.oneShot.pendingRequest,
		episodeId: episode.core.episodeId,
	});
	if (ancestry.kind === "invalid")
		return {
			ok: false,
			message: "Source-read candidate의 One-shot ancestry가 일치하지 않습니다.",
		};
	if (!activeEpisode(branch) && ancestry.kind !== "one-shot")
		return {
			ok: false,
			message: "Source-read에는 Mode ON 또는 exact One-shot ancestry가 필요합니다.",
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
		return { ok: false, message: "Inquiry hydration에는 open Episode가 필요합니다." };
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
			message: "Hydration에는 Mode ON 또는 exact One-shot read ancestry가 필요합니다.",
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
		return { ok: false, message: "Observation 기록에는 open Episode가 필요합니다." };
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
				"Observation에는 Mode ON 또는 exact One-shot read ancestry가 필요합니다.",
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

async function userHypothesis(input: {
	readonly action: RegisterUserHypothesisAction;
	readonly port: ObservationCommandPort;
	readonly notebooks: NotebookService;
	readonly ids: ObservationControllerIds;
}): Promise<ObservationControllerResult> {
	const branch = liveBranch(input.port);
	if (!isLiveBranch(branch)) return { ok: false, message: branch };
	if (!activeEpisode(branch) || branch.pi.state.episode.status !== "open") {
		return {
			ok: false,
			message: "사용자 가설 등록에는 활성화된 open Episode가 필요합니다.",
		};
	}
	const candidate = branch.observation.candidates.find(
		(item) => item.candidateId === input.action.candidateId,
	);
	if (!candidate || candidate.origin.kind !== "user-input") {
		return {
			ok: false,
			message: "사용자 가설에는 current user-input candidate가 필요합니다.",
		};
	}
	const duplicate = branch.observation.userHypotheses.find(
		(item) =>
			item.candidateId === input.action.candidateId &&
			item.original === input.action.original &&
			item.context === input.action.context &&
			(input.action.existingInquiryId === null ||
				item.inquiryId === input.action.existingInquiryId),
	);
	if (duplicate) {
		return {
			ok: true,
			action: "user-hypothesis",
			message: "이미 등록된 사용자 가설입니다.",
			hypothesis: duplicate,
		};
	}
	if (input.action.existingInquiryId) {
		const inventory = await inventoryFor(branch, input.notebooks);
		if (!isInventory(inventory)) return { ok: false, message: inventory };
		const index = currentIndex({ branch, inventory });
		if (
			!index.inquiries.some(
				(item) => item.inquiryId === input.action.existingInquiryId,
			)
		) {
			return {
				ok: false,
				message: "지정한 existing Inquiry가 standing index에 없습니다.",
			};
		}
	}
	const prepared = refinedEvent(
		{
			observer_observation: "observer-observation/v1",
			kind: "user-hypothesis-recorded",
			episode_id: branch.pi.state.episode.core.episodeId,
			observation_id: input.ids.observationId(),
			candidate_id: input.action.candidateId,
			inquiry_id: input.action.existingInquiryId ?? input.ids.inquiryId(),
			original: input.action.original,
			context: input.action.context,
		},
		"user-hypothesis-recorded",
	);
	if (typeof prepared === "string") return { ok: false, message: prepared };
	if (prepared.kind !== "user-hypothesis-recorded") {
		return { ok: false, message: "User hypothesis refinement failed." };
	}
	const appended = appendEvent(input.port, prepared);
	if (typeof appended === "string") return { ok: false, message: appended };
	input.port.notify(`사용자 가설을 추적합니다: ${prepared.original}`, "info");
	return {
		ok: true,
		action: "user-hypothesis",
		message: "사용자 가설을 working state에 등록했습니다.",
		hypothesis: prepared,
	};
}

function requestMemo(input: {
	readonly port: ObservationCommandPort;
	readonly ids: ObservationControllerIds;
}): MemoRequestControllerResult {
	const branch = liveBranch(input.port);
	if (!isLiveBranch(branch)) return { ok: false, message: branch };
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

async function requestWrap(input: {
	readonly port: ObservationCommandPort;
	readonly notebooks: NotebookService;
	readonly ids: ObservationControllerIds;
}): Promise<WrapRequestControllerResult> {
	const branch = liveBranch(input.port);
	if (!isLiveBranch(branch)) return { ok: false, message: branch };
	if (
		branch.pi.prepared ||
		branch.pi.state.episode.status === "reviewing-wrap"
	) {
		return {
			ok: true,
			status: "delegate",
			message: "기존 Wrap proposal을 검토하거나 복구합니다.",
			request: null,
		};
	}
	const workingSet = await notebookWorkingSetFor(branch, input.notebooks);
	if (typeof workingSet === "string") return { ok: false, message: workingSet };
	const requestSession = reconstructWrapRequestSession(
		input.port.branchEntries(),
	);
	const planned = planWrapRequest({
		observation: branch.observation,
		memo: branch.memo,
		requestSession,
		inventory: workingSet.inventory,
		notebook: workingSet.notebook,
		requestId: input.ids.wrapRequestId(),
		proposalId: input.ids.wrapProposalId(),
	});
	if (!planned.ok) return { ok: false, message: planned.issue.message };
	if (planned.value.kind === "resume") {
		return {
			ok: true,
			status: "resumed",
			message: `기존 Wrap request를 재개합니다: ${planned.value.request.requestId}`,
			request: planned.value.request,
		};
	}
	try {
		input.port.appendEntry(
			OBSERVER_WRAP_REQUEST_ENTRY,
			encodeWrapRequestEvent(planned.value.request),
		);
	} catch (error) {
		return {
			ok: false,
			message: `Wrap request 기록 실패: ${error instanceof Error ? error.message : String(error)}`,
		};
	}
	const replayed = reconstructWrapRequestSession(input.port.branchEntries());
	const confirmed = replayed.pendingRequest;
	if (
		replayed.issues.length > 0 ||
		confirmed?.requestId !== planned.value.request.requestId ||
		confirmed.requestDigest !== planned.value.request.requestDigest
	) {
		return {
			ok: false,
			message: replayed.issues[0]
				? `Wrap request replay 실패: ${replayed.issues[0].code}.`
				: "Wrap request가 replay에서 확인되지 않았습니다.",
		};
	}
	return {
		ok: true,
		status: "requested",
		message: `Wrap request를 기록했습니다: ${confirmed.requestId}`,
		request: confirmed,
	};
}

async function wrapContext(input: {
	readonly requestId: WrapRequestId;
	readonly port: ObservationCommandPort;
	readonly notebooks: NotebookService;
}): Promise<
	| { readonly ok: true; readonly value: WrapPreparationContext }
	| { readonly ok: false; readonly message: string }
> {
	const branch = liveBranch(input.port);
	if (!isLiveBranch(branch)) return { ok: false, message: branch };
	const workingSet = await notebookWorkingSetFor(branch, input.notebooks);
	if (typeof workingSet === "string") return { ok: false, message: workingSet };
	const requestSession = reconstructWrapRequestSession(
		input.port.branchEntries(),
	);
	const request = requestSession.pendingRequest;
	if (!request || request.requestId !== input.requestId)
		return {
			ok: false,
			message: "Wrap action에는 exact pending request가 필요합니다.",
		};
	const context = hydrateWrapPreparationContext({
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

async function wrapScope(input: {
	readonly action: WrapScopeAction;
	readonly port: ObservationCommandPort;
	readonly notebooks: NotebookService;
}): Promise<ObservationControllerResult> {
	const context = await wrapContext({
		requestId: input.action.requestId,
		port: input.port,
		notebooks: input.notebooks,
	});
	if (!context.ok) return context;
	return {
		ok: true,
		action: "wrap-scope",
		message: `Wrap request scope 활성화: ${input.action.requestId}`,
		context: context.value,
		guide: buildWrapPreparationGuide(context.value),
	};
}

async function wrapPrepare(input: {
	readonly action: WrapPrepareAction;
	readonly port: ObservationCommandPort;
	readonly notebooks: NotebookService;
}): Promise<ObservationControllerResult> {
	const context = await wrapContext({
		requestId: input.action.requestId,
		port: input.port,
		notebooks: input.notebooks,
	});
	if (!context.ok) return context;
	const prepared = prepareWrapHandoff({
		context: context.value,
		summary: input.action.summary,
		records: input.action.records,
	});
	if (!prepared.ok) return { ok: false, message: prepared.issue.message };
	return {
		ok: true,
		action: "wrap-prepare",
		message: `Wrap proposal 준비 완료: ${prepared.value.prepared.proposal_id}`,
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
}): OneShotRequestedEvent | string | null {
	if (
		input.branch.pi.state.mode !== "off" ||
		input.branch.pi.state.episode.status !== "open"
	)
		return null;
	const pending = input.branch.oneShot.pendingRequest;
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
	const oneShotRequest = sidecarActive
		? null
		: pendingRetrievedCaptureRequest({ branch, port: input.port });
	if (typeof oneShotRequest === "string")
		return { ok: false, message: oneShotRequest };
	if (!sidecarActive && !oneShotRequest)
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
			...(oneShotRequest
				? { one_shot_request_id: oneShotRequest.requestId }
				: {}),
		},
		"candidate-captured",
	);
	if (typeof prepared === "string") return { ok: false, message: prepared };
	if (prepared.kind !== "candidate-captured") {
		return { ok: false, message: "Candidate refinement failed." };
	}
	if (oneShotRequest && prepared.origin.kind !== "tool-result")
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
		case "wrap-scope":
			return wrapScope({
				action: input.action,
				port: input.port,
				notebooks: input.notebooks,
			});
		case "wrap-prepare":
			return wrapPrepare({
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
		startOneShot(value, port) {
			return startOneShot({ value, port, ids: dependencies.ids });
		},
		requestWrap(port) {
			return requestWrap({ port, notebooks, ids: dependencies.ids });
		},
		requestMemo(port) {
			return requestMemo({ port, ids: dependencies.ids });
		},
		capture(value, port) {
			return captureCandidate({ value, port, ids: dependencies.ids });
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
