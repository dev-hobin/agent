import { reconstructObservationSession } from "./observation-session.ts";
import type { PiBranchEntryLike } from "./pi-session.ts";
import { reconstructSaveRequestSession } from "./save-trigger.ts";

const MAX_CONTEXT_CANDIDATES = 20;
const MAX_EXCERPT = 500;

function excerpt(text: string): string {
	return text.length <= MAX_EXCERPT ? text : `${text.slice(0, MAX_EXCERPT)}…`;
}

export interface ObserverNominatableToolResult {
	readonly toolCallId: string;
	readonly toolName: string;
	readonly isError: boolean;
}

export interface ObserverSidecarContextOptions {
	readonly includeRoutine?: boolean;
	readonly includeRequests?: boolean;
	readonly piggyback?: boolean;
	readonly memoScope?: string | null;
	readonly saveScope?: string | null;
	readonly standingIndex?: string | null;
}

export function observerSidecarContext(
	entries: readonly PiBranchEntryLike[],
	nominatableToolResults: readonly ObserverNominatableToolResult[] = [],
	options: ObserverSidecarContextOptions = {},
): string | null {
	const includeRoutine = options.includeRoutine ?? true;
	const includeRequests = options.includeRequests ?? true;
	const session = reconstructObservationSession(entries);
	if (
		session.issues.length > 0 ||
		session.lifecycle.episode.status !== "open"
	) {
		return null;
	}
	const saveSession = reconstructSaveRequestSession(entries);
	if (saveSession.issues.length > 0) return null;
	const pendingMemo = session.pendingMemoRequest;
	const reviewSaveMemoRequestIds = new Set(
		session.reviewSaveContinuations.map(
			(continuation) => continuation.memoRequestId,
		),
	);
	const reviewContinuation =
		pendingMemo && reviewSaveMemoRequestIds.has(pendingMemo.requestId)
			? [
					"This is the final Memo reconciliation for Review; successful completion continues to the proposal preparation without saving.",
				]
			: [];
	const memoContext = pendingMemo
		? [
				"<observer-memo-request>",
				`request_id=${pendingMemo.requestId}`,
				`observation_ids=${pendingMemo.observationIds.join(",")}`,
				...reviewContinuation,
				...(options.piggyback && options.memoScope
					? [
							"The extension computed memo-scope locally from the current branch. Do not call memo-scope.",
							"Set observer-commit.memo to this exact request_id and the submission described by the locked scope below; do not call memo-scope or memo-prepare separately.",
							`locked_memo_scope=${options.memoScope}`,
						]
					: [
							"Call observer_sidecar action memo-scope with this exact request ID.",
							"The memo-scope result includes producer-owned locked fields and memo_preparation.submission_seed.",
							"Call memo-prepare with the same request ID and one submission containing only evidence, hypothesis_outcomes, memo_outcomes, and dispositions; never resend or nest locked fields.",
						]),
				"Give every required_coverage hypothesis and Memo exactly one matching outcome, every requested Observation one disposition, and use only listed evidence_sources; only completion may claim application.",
				"For a Memo content revision choose exactly one explicit kind: revise-incubating or revise-promotion-candidate. Never combine any revise kind with keep-incubating for the same memo_id.",
				"</observer-memo-request>",
			].join("\n")
		: null;
	const pendingSave = saveSession.pendingRequest;
	const saveContext = pendingSave
		? [
				"<observer-save-request>",
				`request_id=${pendingSave.requestId}`,
				...(options.piggyback && options.saveScope
					? [
							"The extension computed save-scope locally from the current branch. Do not call save-scope.",
							"Set observer-commit.save to only request_id, summary, and records from the locked scope below; do not call save-scope or save-prepare separately.",
							`locked_save_scope=${options.saveScope}`,
						]
					: [
							"Call observer_sidecar action save-scope with this exact request ID exactly once unless it returns an error.",
							"The successful save-scope result is read-only and returns next_action=save-prepare plus required records and the producer-owned locked target.",
							"After a successful scope, do not call save-scope again. Follow next_action and submit only request_id, summary, and records.",
						]),
				"Do not invent or resend notebook root, notebook ID, episode language, proposal ID, or request digest.",
				"Only save-prepare completion may claim that Review produced a proposal. It must not claim approval, file writes, or Episode settlement.",
				"</observer-save-request>",
			].join("\n")
		: null;
	const hypothesisReviewContext =
		session.pendingHypothesisReviews.length > 0
			? [
					"<observer-hypothesis-context-review>",
					...session.pendingHypothesisReviews.flatMap((hypothesis) => [
						`hypothesis_observation_id=${hypothesis.observationId}`,
						`hypothesis=${JSON.stringify(hypothesis.original)}`,
						`user_context=${JSON.stringify(hypothesis.context)}`,
					]),
					"Re-read the visible Pi context and current Observer working state through each hypothesis as a lens.",
					"Keep user-provided context separate from Observer interpretation.",
					options.piggyback
						? "Include one item per hypothesis in observer-commit.hypothesis_context_reviews. Include supporting clues, challenging clues, missing information, genuine Source IDs when available, and an explicit interpretation boundary."
						: "Call observer_sidecar action hypothesis-context-review once per hypothesis. Include supporting clues, challenging clues, missing information, genuine Source IDs when available, and an explicit interpretation boundary.",
					"Insufficient context is a valid assessment and never removes the hypothesis.",
					"</observer-hypothesis-context-review>",
				].join("\n")
			: null;
	const requestContexts = includeRequests
		? [memoContext, saveContext, hypothesisReviewContext].filter(
				(value): value is string => value !== null,
			)
		: [];
	const piggybackGuidance = options.piggyback
		? [
				"<observer-piggyback-policy>",
				`episode_id=${session.lifecycle.episode.core.episodeId}`,
				"Finish the user's requested task first.",
				"Make at most one observer_sidecar call with action=observer-commit, only as the final tool call, and never in a batch with another tool.",
				"observer-commit contains episode_id, observations, hypothesis_context_reviews, memo, and save. Use [] or null for lanes with no work.",
				...(options.standingIndex
					? [`current_standing_index=${options.standingIndex}`]
					: []),
				"Each observations item combines existing candidate_ids and/or current-run nominations with source, faithful_summary, claims, related_inquiry_ids, stance, and one record choice. The extension performs source-read, optional hydration, and record behind one validated boundary.",
				"That commit terminates this agent run without a follow-up model request. Do not retry a rejected commit in the same run.",
				"Memo and Save cannot share one commit because Save scope depends on completed Memo. Leave the later Save stage pending for a later ordinary user turn.",
				"</observer-piggyback-policy>",
			].join("\n")
		: null;
	if (!includeRoutine || session.lifecycle.mode !== "on") {
		if (requestContexts.length === 0) return null;
		const contexts = [piggybackGuidance, ...requestContexts].filter(
			(value): value is string => value !== null,
		);
		return contexts.join("\n\n");
	}
	const usedCandidateIds = new Set(
		session.sourceReads.flatMap((read) => read.candidateIds),
	);
	for (const hypothesis of session.userHypotheses) {
		usedCandidateIds.add(hypothesis.candidateId);
	}
	const pendingCandidates = session.candidates.filter(
		(candidate) =>
			!candidate.materialReviewRequestId &&
			!usedCandidateIds.has(candidate.candidateId),
	);
	const observedReadIds = new Set(
		session.observations.map((observation) => observation.readId),
	);
	const pendingReads = session.sourceReads.filter(
		(read) =>
			!read.materialReviewRequestId && !observedReadIds.has(read.readId),
	);
	const candidateLines = pendingCandidates
		.slice(0, MAX_CONTEXT_CANDIDATES)
		.map((candidate) => {
			const selection =
				candidate.origin.kind === "tool-result" &&
				candidate.origin.nominationReason
					? ` selected=${JSON.stringify(excerpt(candidate.origin.nominationReason))}`
					: "";
			return `- ${candidate.candidateId} [${candidate.origin.kind}]${selection} ${JSON.stringify(excerpt(candidate.text))}`;
		});
	const nominatableLines = nominatableToolResults.map(
		(result) =>
			`- ${result.toolCallId} tool=${JSON.stringify(result.toolName)} status=${result.isError ? "error" : "success"}`,
	);
	const readLines = pendingReads.map((read) => {
		const hydration = session.hydrations.find(
			(item) => item.readId === read.readId,
		);
		return hydration
			? `- ${read.readId}: hydrated=${hydration.hydrationId} inquiries=${hydration.inquiryIds.join(",")}`
			: `- ${read.readId}: source-read complete; StandingIndex digest=${read.indexDigest}`;
	});
	return [
		...(piggybackGuidance ? [piggybackGuidance, ""] : []),
		...(requestContexts.length > 0 ? [requestContexts.join("\n\n"), ""] : []),
		"<observer-sidecar>",
		"Observer Mode is ON for the current OPEN episode.",
		"Use the sequential observer_sidecar tool only for the staged protocol below.",
		"1. A tool execution is not an Observation. Do not select routine navigation, listing, write acknowledgements, repeated reads, or diagnostics merely because they ran.",
		...(options.piggyback
			? [
					"2. Put only meaning-bearing current-run tool results in an observation item's nominations with exact tool_call_id and a specific reason.",
					"3. Reconstruct nominated or already-pending source meaning faithfully, then describe source, faithful_summary, and claims in the same observation item.",
					"4. related_inquiry_ids may contain only IDs justified by visible context; [] means no hydration. The extension uses the current StandingIndex digest internally.",
					"5. Choose record.kind=observation with a non-independent movement, or record.kind=new-hypothesis with observer_hypothesis.",
					"6. User hypotheses are not evidence for their own truth. Preserve user context separately from Observer interpretation. Do not observe Observer tool/control output.",
				]
			: [
					"2. When a listed tool result contributes source evidence, a counterexample, a boundary, or an Inquiry/Memo-relevant finding, call nominate-tool-results with its exact tool_call_id and a specific reason. If none is meaningful, make no Observer call.",
					"3. Reconstruct nominated or already-pending source meaning faithfully before seeing any Standing Inquiry content.",
					"4. Call source-read with the candidate IDs returned by nomination or listed below and faithful Source facts/claims; it then returns only the compact StandingIndex.",
					"5. If related IDs are plausible, call hydrate for only those IDs; it returns selected full context.",
					"6. Call record with observer_hypothesis=null for an ordinary observation. Call record-new-hypothesis only for an independent new Observer hypothesis. Use user-hypothesis for an explicit user proposal.",
					"7. After user-hypothesis succeeds, use its returned observation_id to call hypothesis-context-review after re-reading the visible context through that hypothesis as a lens.",
					"8. User hypotheses are not evidence for their own truth. Preserve user context separately from Observer interpretation. Do not observe Observer tool/control output.",
				]),
		"Minor/support/uncertain observations stay quiet. The tool itself alerts only after a Major event is appended.",
		"",
		`Tool results eligible for meaning-based nomination in this agent run (${nominatableToolResults.length}):`,
		...(nominatableLines.length > 0 ? nominatableLines : ["- none"]),
		"These are references to visible Pi tool results, not captured Observer candidates.",
		"",
		`Pending candidates (${pendingCandidates.length}):`,
		...(candidateLines.length > 0 ? candidateLines : ["- none"]),
		...(pendingCandidates.length > MAX_CONTEXT_CANDIDATES
			? [`- … ${pendingCandidates.length - MAX_CONTEXT_CANDIDATES} more`]
			: []),
		"",
		`Pending staged reads (${pendingReads.length}):`,
		...(readLines.length > 0 ? readLines : ["- none"]),
		"</observer-sidecar>",
	].join("\n");
}
