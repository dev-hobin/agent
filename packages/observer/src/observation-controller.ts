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
import type { InquiryId, SourceId } from "./memo-profile.ts";
import { readNotebookInventory } from "./notebook.ts";
import {
	createNotebookService,
	type NotebookService,
} from "./notebook-service.ts";
import type { NotebookSelectionStore } from "./notebook-selection-store.ts";
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
	observationCandidateDigest,
	reconstructObservationSession,
	type ObservationSessionSnapshot,
} from "./observation-session.ts";
import {
	reconstructObserverPiState,
	type ObserverPiSnapshot,
	type PiBranchEntryLike,
} from "./pi-session.ts";
import {
	buildStandingIndex,
	hydrateStandingContext,
	type StandingContext,
	type StandingIndex,
} from "./standing-index.ts";

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
}

export type CandidateCaptureResult =
	| {
			readonly ok: true;
			readonly status: "captured" | "ignored";
			readonly candidate: CandidateCapturedEvent | null;
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
			readonly action: "memo-prepare";
			readonly status: "prepared" | "resumed";
			readonly message: string;
			readonly instruction: PreparedObservationMemoInstruction;
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
}

interface ControllerDependencies {
	readonly selectionStore: NotebookSelectionStore;
	readonly ids: ObservationControllerIds;
}

interface LiveWorkingBranch {
	readonly pi: ObserverPiSnapshot;
	readonly memo: ReturnType<typeof reconstructMemoSession>;
	readonly observation: ObservationSessionSnapshot;
}

function assertNever(value: never): never {
	throw new Error(`Unhandled observation action: ${String(value)}`);
}

function liveBranch(port: ObservationCommandPort): LiveWorkingBranch | string {
	const entries = port.branchEntries();
	const pi = reconstructObserverPiState(entries);
	const memo = reconstructMemoSession(entries);
	const observation = reconstructObservationSession(entries);
	const firstIssue =
		pi.issues[0]?.code ?? memo.issues[0]?.code ?? observation.issues[0]?.code;
	return firstIssue
		? `Observer working history를 확인해야 합니다: ${firstIssue}.`
		: { pi, memo, observation };
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

async function inventoryFor(
	branch: LiveWorkingBranch,
	notebooks: NotebookService,
): Promise<readonly import("./notebook.ts").NotebookInventoryEntry[] | string> {
	const recovered = await notebooks.recover(branch.pi.state);
	if (!recovered.ok) return `Notebook 복구 실패: ${recovered.issue.message}`;
	const inventory = await readNotebookInventory(recovered.value.notebook);
	return inventory.ok
		? inventory.value
		: `Notebook 읽기 실패: ${inventory.issue.message}`;
}

function isInventory(
	value: readonly import("./notebook.ts").NotebookInventoryEntry[] | string,
): value is readonly import("./notebook.ts").NotebookInventoryEntry[] {
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

async function sourceRead(input: {
	readonly action: SourceReadAction;
	readonly port: ObservationCommandPort;
	readonly notebooks: NotebookService;
	readonly ids: ObservationControllerIds;
}): Promise<ObservationControllerResult> {
	const branch = liveBranch(input.port);
	if (!isLiveBranch(branch)) return { ok: false, message: branch };
	if (!activeEpisode(branch) || branch.pi.state.episode.status !== "open") {
		return {
			ok: false,
			message: "Source-read에는 활성화된 open Episode가 필요합니다.",
		};
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
	const prepared = refinedEvent(
		{
			observer_observation: "observer-observation/v1",
			kind: "source-read-recorded",
			episode_id: branch.pi.state.episode.core.episodeId,
			read_id: input.ids.sourceReadId(),
			candidate_ids: input.action.candidateIds,
			source: sourceDraft(input.action.source, input.ids.sourceId()),
			faithful_summary: input.action.faithfulSummary,
			claims: input.action.claims.map((claim) => ({
				text: claim.text,
				locator: claim.locator,
			})),
			candidate_digest: observationCandidateDigest(candidates),
			index_digest: index.digest,
			index_inquiry_ids: index.inquiries.map((inquiry) => inquiry.inquiryId),
		},
		"source-read-recorded",
	);
	if (typeof prepared === "string") return { ok: false, message: prepared };
	if (prepared.kind !== "source-read-recorded") {
		return { ok: false, message: "Source-read event refinement failed." };
	}
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
	if (!activeEpisode(branch) || branch.pi.state.episode.status !== "open") {
		return {
			ok: false,
			message: "Inquiry hydration에는 활성화된 open Episode가 필요합니다.",
		};
	}
	const read = branch.observation.sourceReads.find(
		(item) => item.readId === input.action.readId,
	);
	if (!read || read.indexDigest !== input.action.indexDigest) {
		return {
			ok: false,
			message: "Hydration target SourceRead/index가 현재 branch와 다릅니다.",
		};
	}
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
		episodeLanguage: branch.pi.state.episode.core.lang,
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
			episode_id: branch.pi.state.episode.core.episodeId,
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
	if (!activeEpisode(branch) || branch.pi.state.episode.status !== "open") {
		return {
			ok: false,
			message: "Observation 기록에는 활성화된 open Episode가 필요합니다.",
		};
	}
	const read = branch.observation.sourceReads.find(
		(item) => item.readId === input.action.readId,
	);
	if (!read) {
		return {
			ok: false,
			message: "Observation SourceRead를 current branch에서 찾지 못했습니다.",
		};
	}
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
			episode_id: branch.pi.state.episode.core.episodeId,
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
	const decoded = decodePreparedObservationMemoInstruction({
		value: input.action.instruction,
		context: context.value,
	});
	return decoded.ok
		? { instruction: decoded.value, priorSession }
		: decoded.issue.message;
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

export function createObservationController(
	dependencies: ControllerDependencies,
): ObservationController {
	const notebooks = createNotebookService({
		selectionStore: dependencies.selectionStore,
	});
	return {
		requestMemo(port) {
			return requestMemo({ port, ids: dependencies.ids });
		},
		capture(value, port) {
			const branch = liveBranch(port);
			if (!isLiveBranch(branch)) return { ok: false, message: branch };
			if (!activeEpisode(branch) || branch.pi.state.episode.status !== "open") {
				return { ok: true, status: "ignored", candidate: null };
			}
			const prepared = refinedEvent(
				{
					observer_observation: "observer-observation/v1",
					kind: "candidate-captured",
					episode_id: branch.pi.state.episode.core.episodeId,
					candidate_id: dependencies.ids.candidateId(),
					origin: encodeOrigin(value.origin),
					text: value.text,
					content_hash:
						typeof value.text === "string" ? sha256Text(value.text) : "",
					captured_at: value.capturedAt,
				},
				"candidate-captured",
			);
			if (typeof prepared === "string") return { ok: false, message: prepared };
			if (prepared.kind !== "candidate-captured") {
				return { ok: false, message: "Candidate refinement failed." };
			}
			const appended = appendEvent(port, prepared);
			return typeof appended === "string"
				? { ok: false, message: appended }
				: { ok: true, status: "captured", candidate: prepared };
		},
		execute(value, port) {
			const decoded = decodeObservationAction(value);
			if (!decoded.ok) {
				return Promise.resolve({ ok: false, message: decoded.issue.message });
			}
			if (isMemoSidecarAction(decoded.value)) {
				return executeMemoSidecarAction({
					action: decoded.value,
					port,
					notebooks,
				});
			}
			switch (decoded.value.action) {
				case "source-read":
					return sourceRead({
						action: decoded.value,
						port,
						notebooks,
						ids: dependencies.ids,
					});
				case "hydrate":
					return hydrate({
						action: decoded.value,
						port,
						notebooks,
						ids: dependencies.ids,
					});
				case "record":
					return record({ action: decoded.value, port, ids: dependencies.ids });
				case "user-hypothesis":
					return userHypothesis({
						action: decoded.value,
						port,
						notebooks,
						ids: dependencies.ids,
					});
				default:
					return Promise.resolve(assertNever(decoded.value));
			}
		},
	};
}
