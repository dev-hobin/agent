import { sha256Text } from "./content-hash.ts";
import type {
	ObservationCommandPort,
	ObservationController,
} from "./observation-controller.ts";
import type {
	ObserverCommandPort,
	ObserverController,
} from "./observer-controller.ts";
import { reconstructObservationSession } from "./observation-session.ts";
import { reconstructObserverPiState } from "./pi-session.ts";
import {
	decodeMaterialReviewFinishAction,
	decodeMaterialReviewStartAction,
	reconstructMaterialReviewSession,
	refineMaterialReviewIntent,
	type LatestUserMessage,
	type MaterialReviewRequestId,
} from "./material-review-trigger.ts";

export interface MaterialReviewCommandPort
	extends ObserverCommandPort,
		ObservationCommandPort {}

export interface MaterialReviewCommandIds {
	requestId(): MaterialReviewRequestId;
}

export type MaterialReviewCommandAction =
	| "material-review-start"
	| "material-review-finish";

export type MaterialReviewCommandResult =
	| {
			readonly ok: true;
			readonly action: "material-review-start";
			readonly status:
				| "pending-retrieval"
				| "inline-captured"
				| "inline-resumed";
			readonly requestId: MaterialReviewRequestId;
			readonly candidateId: string | null;
	  }
	| {
			readonly ok: true;
			readonly action: "material-review-finish";
			readonly status: "completed" | "resumed";
			readonly requestId: MaterialReviewRequestId;
			readonly observationIds: readonly string[];
			readonly completionDigest: string;
	  }
	| { readonly ok: false; readonly message: string };

function failure(message: string): MaterialReviewCommandResult {
	return { ok: false, message };
}

export function materialReviewCommandAction(
	value: unknown,
): MaterialReviewCommandAction | null {
	if (typeof value !== "object" || value === null || Array.isArray(value))
		return null;
	const action = Reflect.get(value, "action");
	return action === "material-review-start" ||
		action === "material-review-finish"
		? action
		: null;
}

function pendingStartIssue(input: {
	readonly action: {
		readonly userMessageDigest: string;
		readonly material: "inline-user-message" | "retrieved-tool-results";
	};
	readonly pending: ReturnType<
		typeof reconstructMaterialReviewSession
	>["pendingRequest"];
	readonly pi: ReturnType<typeof reconstructObserverPiState>;
}): string | null {
	const pending = input.pending;
	if (!pending) return null;
	if (
		pending.userMessageDigest !== input.action.userMessageDigest ||
		pending.material !== input.action.material
	)
		return "Another material-review request is already pending.";
	const episode = input.pi.state.episode;
	return episode.status === "open" &&
		episode.core.episodeId === pending.episodeId
		? null
		: "Pending material-review history does not match its OPEN Episode.";
}

/** Starts or resumes the public Observe material command flow. */
export async function executeMaterialReviewStart(input: {
	readonly value: unknown;
	readonly latestUser: LatestUserMessage | null;
	readonly capturedAt: unknown;
	readonly port: MaterialReviewCommandPort;
	readonly lifecycle: ObserverController;
	readonly observation: ObservationController;
	readonly ids: MaterialReviewCommandIds;
}): Promise<MaterialReviewCommandResult> {
	const action = decodeMaterialReviewStartAction(input.value);
	if (!action.ok) return failure(action.issue.message);
	const materialReview = reconstructMaterialReviewSession(
		input.port.branchEntries(),
	);
	const pi = reconstructObserverPiState(input.port.branchEntries());
	const historyIssue = materialReview.issues[0] ?? pi.issues[0];
	if (historyIssue)
		return failure(
			`Material-review history must be repaired: ${historyIssue.code}.`,
		);
	const pendingIssue = pendingStartIssue({
		action: action.value,
		pending: materialReview.pendingRequest,
		pi,
	});
	if (pendingIssue) return failure(pendingIssue);
	const requestId =
		materialReview.pendingRequest?.requestId ?? input.ids.requestId();
	const intent = refineMaterialReviewIntent({
		value: input.value,
		latestUser: input.latestUser,
		requestId,
	});
	if (!intent.ok) return failure(intent.issue.message);
	const episode = await input.lifecycle.ensureMaterialReviewEpisode(
		intent.value,
		input.port,
	);
	if (!episode.ok) return failure(episode.message);
	const started = input.observation.startMaterialReview(
		{
			intent: intent.value,
			episode: episode.value,
			capturedAt: input.capturedAt,
		},
		input.port,
	);
	if (!started.ok) return failure(started.message);
	return {
		ok: true,
		action: "material-review-start",
		status: started.status,
		requestId: started.request.requestId,
		candidateId: "candidate" in started ? started.candidate.candidateId : null,
	};
}

/** Finishes the exact pending Observe material request. */
export function executeMaterialReviewFinish(input: {
	readonly value: unknown;
	readonly port: MaterialReviewCommandPort;
	readonly observation: ObservationController;
}): MaterialReviewCommandResult {
	const action = decodeMaterialReviewFinishAction(input.value);
	if (!action.ok) return failure(action.issue.message);
	const finished = input.observation.finishMaterialReview(
		action.value,
		input.port,
	);
	if (!finished.ok) return failure(finished.message);
	return {
		ok: true,
		action: "material-review-finish",
		status: finished.status,
		requestId: finished.completion.requestId,
		observationIds: finished.completion.observationIds,
		completionDigest: finished.completion.digest,
	};
}

export function requireMaterialReviewCommandSuccess(
	result: MaterialReviewCommandResult,
): Exclude<MaterialReviewCommandResult, { readonly ok: false }> {
	if (!result.ok) throw new Error(result.message);
	return result;
}

export function materialReviewCommandText(
	result: Exclude<MaterialReviewCommandResult, { readonly ok: false }>,
): string {
	if (result.action === "material-review-start") {
		const nextAction =
			result.status === "pending-retrieval"
				? "retrieve-source-material"
				: "source-read";
		return JSON.stringify({
			ok: true,
			action: result.action,
			status: result.status,
			request_id: result.requestId,
			candidate_id: result.candidateId,
			next_action: nextAction,
		});
	}
	return JSON.stringify({
		ok: true,
		action: result.action,
		status: result.status,
		request_id: result.requestId,
		observation_ids: result.observationIds,
		completion_digest: result.completionDigest,
		lifecycle: { mode: "unchanged", episode: "open" },
	});
}

export function materialReviewContext(input: {
	readonly latestUser: LatestUserMessage | null;
	readonly activeRequestId?: MaterialReviewRequestId | null;
	readonly entries: readonly Parameters<
		typeof reconstructMaterialReviewSession
	>[0][number][];
}): string | null {
	const session = reconstructMaterialReviewSession(input.entries);
	const issue = session.issues[0];
	if (issue)
		return `Observer material-review history issue: ${issue.code}. Do not start or finish material review until repaired.`;
	const pending = session.pendingRequest;
	if (pending && input.activeRequestId !== pending.requestId)
		return [
			"Observer material-review is suspended outside its explicit run.",
			`request_id: ${pending.requestId}`,
			"Do not attach this turn's tool results to that request and do not resume it automatically.",
			"Continue the user's current task normally. The user can run /observer material retry or /observer material cancel.",
		].join("\n");
	if (pending) {
		const observation = reconstructObservationSession(input.entries);
		const candidates = observation.candidates.filter(
			(candidate) => candidate.materialReviewRequestId === pending.requestId,
		);
		const reads = observation.sourceReads.filter(
			(read) => read.materialReviewRequestId === pending.requestId,
		);
		const observedReadIds = new Set(
			observation.observations.map((item) => item.readId),
		);
		return [
			"Observer material-review request is active for this explicit run.",
			`request_id: ${pending.requestId}`,
			`material: ${pending.material}`,
			`request_linked_candidate_ids: ${candidates.map((candidate) => candidate.candidateId).join(",") || "none"}`,
			`request_linked_reads: ${reads.map((read) => `${read.readId}:${observedReadIds.has(read.readId) ? "observed" : "needs-observation"}`).join(",") || "none"}`,
			"Do not call material-review-start again.",
			"For retrieved material with no request-linked candidate yet, retrieve it only during this run; unrelated later tool results are outside this request.",
			"Call source-read for uncovered request-linked candidate IDs; keep ordered contiguous segments from one tool result together in one SourceRead. It returns a compact StandingIndex and index digest.",
			"If record will use any related_inquiry_ids, first call hydrate for those IDs with this read_id and index_digest, then pass the returned exact hydration_id to record.",
			"If no hydration is needed, record must use hydration_id=null and related_inquiry_ids=[].",
			"After exactly one semantic Observation covers each request-linked SourceRead, call material-review-finish with only this request_id.",
		].join("\n");
	}
	if (!input.latestUser) return null;
	return [
		"Observer material-review classification is model-owned; do not start automatically.",
		"If and only if the latest user explicitly asks to Observe material, call observer_sidecar material-review-start without changing Observer Mode.",
		`exact_latest_user_sha256: ${sha256Text(input.latestUser.text)}`,
		"Choose material.kind as inline-user-message only when the exact user text itself is evidence; choose retrieved-tool-results when requested paths, URLs, or tools must provide the evidence.",
		"The instruction, path, or URL is not Source evidence.",
	].join("\n");
}
