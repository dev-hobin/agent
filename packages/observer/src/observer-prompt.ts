import { reconstructObservationSession } from "./observation-session.ts";
import type { PiBranchEntryLike } from "./pi-session.ts";

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
	const pendingMemo = session.pendingMemoRequest;
	const memoContext = pendingMemo
		? [
				"<observer-memo-request>",
				`request_id=${pendingMemo.requestId}`,
				`observation_ids=${pendingMemo.observationIds.join(",")}`,
				"Call observer_sidecar action memo-scope with this exact request ID.",
				"The memo-scope result includes producer-owned locked fields and memo_preparation.submission_seed.",
				"Call memo-prepare with the same request ID and one submission containing only evidence, hypothesis_outcomes, memo_outcomes, and dispositions; never resend or nest locked fields.",
				"Give every required_coverage hypothesis and Memo exactly one matching outcome, every requested Observation one disposition, and use only listed evidence_sources; only completion may claim application.",
				"For a Memo content revision choose exactly one explicit kind: revise-incubating or revise-promotion-candidate. Never combine any revise kind with keep-incubating for the same memo_id.",
				"</observer-memo-request>",
			].join("\n")
		: null;
	if (session.lifecycle.mode !== "on") return memoContext;
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
		...(memoContext ? [memoContext, ""] : []),
		"<observer-sidecar>",
		"Observer Mode is ON for the current OPEN episode.",
		"Use the sequential observer_sidecar tool only for the staged protocol below.",
		"1. Reconstruct source meaning faithfully before seeing any Standing Inquiry content.",
		"2. Call source-read with completed candidate IDs and faithful Source facts/claims; it then returns only the compact StandingIndex.",
		"3. If related IDs are plausible, call hydrate for only those IDs; it returns selected full context.",
		"4. Call record with explicit stance, movement, rationale, and matching hydration, or user-hypothesis for an explicit user proposal.",
		"5. User hypotheses are not evidence for their own truth. Do not observe Observer tool/control output.",
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
