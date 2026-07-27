import { sha256Text } from "./content-hash.ts";
import type {
	ObservationCommandPort,
	ObservationController,
} from "./observation-controller.ts";
import type {
	ObserverCommandPort,
	ObserverController,
} from "./observer-controller.ts";
import { reconstructObserverPiState } from "./pi-session.ts";
import {
	decodeOneShotFinishAction,
	decodeOneShotStartAction,
	reconstructOneShotSession,
	refineOneShotIntent,
	type LatestUserMessage,
	type OneShotRequestId,
} from "./one-shot-trigger.ts";

export interface OneShotCommandPort
	extends ObserverCommandPort,
		ObservationCommandPort {}

export interface OneShotCommandIds {
	requestId(): OneShotRequestId;
}

export type OneShotCommandAction = "one-shot-start" | "one-shot-finish";

export type OneShotCommandResult =
	| {
			readonly ok: true;
			readonly action: "one-shot-start";
			readonly status:
				| "pending-retrieval"
				| "inline-captured"
				| "inline-resumed";
			readonly requestId: OneShotRequestId;
			readonly candidateId: string | null;
	  }
	| {
			readonly ok: true;
			readonly action: "one-shot-finish";
			readonly status: "completed" | "resumed";
			readonly requestId: OneShotRequestId;
			readonly observationIds: readonly string[];
			readonly completionDigest: string;
	  }
	| { readonly ok: false; readonly message: string };

function failure(message: string): OneShotCommandResult {
	return { ok: false, message };
}

export function oneShotCommandAction(
	value: unknown,
): OneShotCommandAction | null {
	if (typeof value !== "object" || value === null || Array.isArray(value))
		return null;
	const action = Reflect.get(value, "action");
	return action === "one-shot-start" || action === "one-shot-finish"
		? action
		: null;
}

function pendingStartIssue(input: {
	readonly action: {
		readonly userMessageDigest: string;
		readonly material: "inline-user-message" | "retrieved-tool-results";
	};
	readonly pending: ReturnType<
		typeof reconstructOneShotSession
	>["pendingRequest"];
	readonly pi: ReturnType<typeof reconstructObserverPiState>;
}): string | null {
	const pending = input.pending;
	if (!pending) return null;
	if (
		pending.userMessageDigest !== input.action.userMessageDigest ||
		pending.material !== input.action.material
	)
		return "Another One-shot request is already pending.";
	const episode = input.pi.state.episode;
	return input.pi.state.mode === "off" &&
		episode.status === "open" &&
		episode.core.episodeId === pending.episodeId
		? null
		: "Pending One-shot history does not match an OFF OPEN Episode.";
}

export async function executeOneShotStart(input: {
	readonly value: unknown;
	readonly latestUser: LatestUserMessage | null;
	readonly capturedAt: unknown;
	readonly port: OneShotCommandPort;
	readonly lifecycle: ObserverController;
	readonly observation: ObservationController;
	readonly ids: OneShotCommandIds;
}): Promise<OneShotCommandResult> {
	const action = decodeOneShotStartAction(input.value);
	if (!action.ok) return failure(action.issue.message);
	const oneShot = reconstructOneShotSession(input.port.branchEntries());
	const pi = reconstructObserverPiState(input.port.branchEntries());
	const historyIssue = oneShot.issues[0] ?? pi.issues[0];
	if (historyIssue)
		return failure(`One-shot history must be repaired: ${historyIssue.code}.`);
	const pendingIssue = pendingStartIssue({
		action: action.value,
		pending: oneShot.pendingRequest,
		pi,
	});
	if (pendingIssue) return failure(pendingIssue);
	const requestId = oneShot.pendingRequest?.requestId ?? input.ids.requestId();
	const intent = refineOneShotIntent({
		value: input.value,
		latestUser: input.latestUser,
		requestId,
	});
	if (!intent.ok) return failure(intent.issue.message);
	const episode = await input.lifecycle.ensureOneShotEpisode(
		intent.value,
		input.port,
	);
	if (!episode.ok) return failure(episode.message);
	const started = input.observation.startOneShot(
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
		action: "one-shot-start",
		status: started.status,
		requestId: started.request.requestId,
		candidateId: "candidate" in started ? started.candidate.candidateId : null,
	};
}

export function executeOneShotFinish(input: {
	readonly value: unknown;
	readonly port: OneShotCommandPort;
	readonly observation: ObservationController;
}): OneShotCommandResult {
	const action = decodeOneShotFinishAction(input.value);
	if (!action.ok) return failure(action.issue.message);
	const finished = input.observation.finishOneShot(action.value, input.port);
	if (!finished.ok) return failure(finished.message);
	return {
		ok: true,
		action: "one-shot-finish",
		status: finished.status,
		requestId: finished.completion.requestId,
		observationIds: finished.completion.observationIds,
		completionDigest: finished.completion.digest,
	};
}

export function requireOneShotCommandSuccess(
	result: OneShotCommandResult,
): Exclude<OneShotCommandResult, { readonly ok: false }> {
	if (!result.ok) throw new Error(result.message);
	return result;
}

export function oneShotCommandText(
	result: Exclude<OneShotCommandResult, { readonly ok: false }>,
): string {
	if (result.action === "one-shot-start") {
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
		lifecycle: { mode: "off", episode: "open" },
	});
}

export function oneShotContext(input: {
	readonly latestUser: LatestUserMessage | null;
	readonly entries: readonly Parameters<
		typeof reconstructOneShotSession
	>[0][number][];
}): string | null {
	const session = reconstructOneShotSession(input.entries);
	const issue = session.issues[0];
	if (issue)
		return `Observer One-shot history issue: ${issue.code}. Do not start or finish One-shot work until repaired.`;
	const pending = session.pendingRequest;
	if (pending)
		return [
			"Observer One-shot request is pending.",
			`request_id: ${pending.requestId}`,
			`material: ${pending.material}`,
			"Do not call one-shot-start again unless retrying the exact failed start.",
			"Call source-read for the request-linked candidate; it returns a compact StandingIndex and index digest.",
			"If record will use any related_inquiry_ids, first call hydrate for those IDs with this read_id and index_digest, then pass the returned exact hydration_id to record.",
			"If no hydration is needed, record must use hydration_id=null and related_inquiry_ids=[].",
			"After exactly one semantic Observation covers each request-linked SourceRead, call one-shot-finish with only this request_id.",
		].join("\n");
	if (!input.latestUser) return null;
	return [
		"Observer One-shot classification is model-owned; do not start automatically.",
		"If and only if the latest user asks for one bounded Observer observation, call observer_sidecar one-shot-start.",
		`exact_latest_user_sha256: ${sha256Text(input.latestUser.text)}`,
		"Choose material.kind as inline-user-message only when the exact user text itself is evidence; choose retrieved-tool-results when requested paths, URLs, or tools must provide the evidence.",
		"The instruction, path, or URL is not Source evidence.",
	].join("\n");
}
