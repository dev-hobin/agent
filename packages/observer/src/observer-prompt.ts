import { reconstructObservationSession } from "./observation-session.ts";
import type { PiBranchEntryLike } from "./pi-session.ts";
import { reconstructSaveRequestSession } from "./save-trigger.ts";

const MAX_CONTEXT_CANDIDATES = 20;
const MAX_EXCERPT = 500;

function excerpt(text: string): string {
	return text.length <= MAX_EXCERPT ? text : `${text.slice(0, MAX_EXCERPT)}…`;
}

export function observerSidecarContext(
	entries: readonly PiBranchEntryLike[],
): string | null {
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
	const memoContext = pendingMemo
		? [
				"<observer-memo-request>",
				`request_id=${pendingMemo.requestId}`,
				`observation_ids=${pendingMemo.observationIds.join(",")}`,
				...(reviewSaveMemoRequestIds.has(pendingMemo.requestId)
					? [
							"This is the final Memo reconciliation for Review; successful completion continues to the proposal preparation without saving.",
						]
					: []),
				"Call observer_sidecar action memo-scope with this exact request ID.",
				"The memo-scope result includes producer-owned locked fields and memo_preparation.submission_seed.",
				"Call memo-prepare with the same request ID and one submission containing only evidence, hypothesis_outcomes, memo_outcomes, and dispositions; never resend or nest locked fields.",
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
				"Call observer_sidecar action save-scope with this exact request ID exactly once unless it returns an error.",
				"The successful save-scope result is read-only and returns next_action=save-prepare plus required records and the producer-owned locked target.",
				"After a successful scope, do not call save-scope again. Follow next_action and submit only request_id, summary, and records.",
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
					"Call observer_sidecar action hypothesis-context-review once per hypothesis. Include supporting clues, challenging clues, missing information, genuine Source IDs when available, and an explicit interpretation boundary.",
					"Insufficient context is a valid assessment and never removes the hypothesis.",
					"</observer-hypothesis-context-review>",
				].join("\n")
			: null;
	const requestContexts = [
		memoContext,
		saveContext,
		hypothesisReviewContext,
	].filter((value): value is string => value !== null);
	if (session.lifecycle.mode !== "on")
		return requestContexts.length > 0 ? requestContexts.join("\n\n") : null;
	const usedCandidateIds = new Set(
		session.sourceReads.flatMap((read) => read.candidateIds),
	);
	for (const hypothesis of session.userHypotheses) {
		usedCandidateIds.add(hypothesis.candidateId);
	}
	const pendingCandidates = session.candidates.filter(
		(candidate) => !usedCandidateIds.has(candidate.candidateId),
	);
	const observedReadIds = new Set(
		session.observations.map((observation) => observation.readId),
	);
	const pendingReads = session.sourceReads.filter(
		(read) => !observedReadIds.has(read.readId),
	);
	const candidateLines = pendingCandidates
		.slice(0, MAX_CONTEXT_CANDIDATES)
		.map(
			(candidate) =>
				`- ${candidate.candidateId} [${candidate.origin.kind}] ${JSON.stringify(excerpt(candidate.text))}`,
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
		...(requestContexts.length > 0 ? [requestContexts.join("\n\n"), ""] : []),
		"<observer-sidecar>",
		"Observer Mode is ON for the current OPEN episode.",
		"Use the sequential observer_sidecar tool only for the staged protocol below.",
		"1. Reconstruct source meaning faithfully before seeing any Standing Inquiry content.",
		"2. Call source-read with completed candidate IDs and faithful Source facts/claims; it then returns only the compact StandingIndex.",
		"3. If related IDs are plausible, call hydrate for only those IDs; it returns selected full context.",
		"4. Call record with explicit stance, movement, rationale, and matching hydration, or user-hypothesis for an explicit user proposal.",
		"5. After user-hypothesis succeeds, use its returned observation_id to call hypothesis-context-review after re-reading the visible context through that hypothesis as a lens.",
		"6. User hypotheses are not evidence for their own truth. Preserve user context separately from Observer interpretation. Do not observe Observer tool/control output.",
		"Minor/support/uncertain observations stay quiet. The tool itself alerts only after a Major event is appended.",
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
