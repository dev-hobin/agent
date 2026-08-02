import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { sha256Text } from "../src/content-hash.ts";
import { reconstructMaterialReviewSession } from "../src/material-review-trigger.ts";
import {
	reconstructMemoSession,
	type MemoSessionSnapshot,
} from "../src/memo-session.ts";
import {
	observationMemoRequestDigest,
	prepareObservationEvent,
	type ObservationEvent,
} from "../src/observation-profile.ts";
import {
	reconstructObservationSession,
	type ObservationSessionSnapshot,
} from "../src/observation-session.ts";
import type { ObserverStatusView } from "../src/observer-status.ts";
import {
	observerWorkbenchView,
	type ObserverWorkbenchProposalInspection,
} from "../src/observer-workbench.ts";
import type { SaveRequestSession } from "../src/save-trigger.ts";
import { observationContextBasisFixture } from "./fixtures/context-basis.ts";

const EPISODE_ID = "episode-workbench";
const CANDIDATE_ID = "candidate-00000000-0000-4000-8000-000000000101";
const READ_ID = "source-read-00000000-0000-4000-8000-000000000102";
const SOURCE_ID = "source-00000000-0000-4000-8000-000000000103";
const OBSERVATION_ID = "observation-00000000-0000-4000-8000-000000000104";
const INQUIRY_ID = "inquiry-00000000-0000-4000-8000-000000000105";
const MEMO_ID = "memo-00000000-0000-4000-8000-000000000106";
const SAVE_REQUEST_ID = "save-request-00000000-0000-4000-8000-000000000107";
const PROPOSAL_ID = "proposal-00000000-0000-4000-8000-000000000108";
const MEMO_REQUEST_ID = "memo-request-00000000-0000-4000-8000-000000000109";
const WORKBENCH_CONTEXT_BASIS = await observationContextBasisFixture({
	sourceReading: {
		readingId: READ_ID,
		episodeId: EPISODE_ID,
		sourceId: SOURCE_ID,
		faithfulSummary: "Working meaning remains visible before publication.",
		claims: [
			{
				text: "Inspection and persistence are separate boundaries.",
				locator: "section 2",
			},
		],
	},
	inquiryContext: null,
	relatedInquiryIds: [],
});

function requireEvent(value: unknown): ObservationEvent {
	const result = prepareObservationEvent(value);
	if (!result.ok) assert.fail(JSON.stringify(result.issue));
	return result.value;
}

function status(
	overrides: Partial<ObserverStatusView> = {},
): ObserverStatusView {
	return {
		control: {
			mode: "on",
			episode: "open",
			notebook: "ready",
			notebookRoot: "/tmp/notebook",
			notebookDefaultLanguage: "en",
			canChangeNotebook: false,
			canMemo: true,
			canReview: true,
			canSave: false,
		},
		mode: "On",
		episode: "Open",
		notebook: "/tmp/notebook",
		outputLanguage: "en",
		notebookHealth: "Healthy",
		replayHealth: "Healthy",
		sessionPersistence: "Persistent session",
		preparedSave: "None",
		preparedMemo: "None",
		pendingMemos: "1",
		pendingObservations: 1,
		memoItems: [],
		pendingHypothesisReviews: 0,
		openInquiries: "1",
		inquiryItems: [],
		zettelCandidates: "0",
		processingMode: "Piggyback",
		processingDetail: "No additional model request",
		...overrides,
	};
}

function workingSnapshots(): {
	readonly observation: ObservationSessionSnapshot;
	readonly memo: MemoSessionSnapshot;
} {
	const sourceRead = requireEvent({
		observer_observation: "observer-observation/v1",
		kind: "source-read-recorded",
		episode_id: EPISODE_ID,
		read_id: READ_ID,
		candidate_ids: [CANDIDATE_ID],
		source: {
			kind: "external-material",
			source_id: SOURCE_ID,
			title: "Inspectable work",
			lang: "en",
			uri: "https://example.com/workbench",
			revision: "rev-1",
			content_hash: null,
			retrieval_context: "test fixture",
		},
		faithful_summary: "Working meaning remains visible before publication.",
		claims: [
			{
				text: "Inspection and persistence are separate boundaries.",
				locator: "section 2",
			},
		],
		candidate_digest: sha256Text("candidate"),
		index_digest: sha256Text("index"),
		index_inquiry_ids: [INQUIRY_ID],
	});
	const semantic = requireEvent({
		observer_observation: "observer-observation/v1",
		kind: "semantic-observation-recorded",
		episode_id: EPISODE_ID,
		observation_id: OBSERVATION_ID,
		read_id: READ_ID,
		hydration_id: null,
		related_inquiry_ids: [],
		stance: "supports",
		movement: "minor-refinement",
		rationale: "The source supports pull-based inspection.",
		observer_hypothesis: null,
		context_basis: WORKBENCH_CONTEXT_BASIS,
	});
	if (
		sourceRead.kind !== "source-read-recorded" ||
		semantic.kind !== "semantic-observation-recorded"
	)
		assert.fail("Expected SourceRead and semantic observation events");
	const observation = {
		...reconstructObservationSession([]),
		sourceReads: [sourceRead],
		observations: [semantic],
		unconsumedObservationIds: [semantic.observationId],
	};
	const memo = reconstructMemoSession([]);
	return {
		observation,
		memo: {
			...memo,
			state: {
				...memo.state,
				passes: 1,
				revisionId: "memo-working-revision-test",
				hypotheses: [
					{
						inquiryId: INQUIRY_ID,
						episodeId: EPISODE_ID,
						origin: "user" as const,
						original: "Can quiet work remain inspectable?",
						current: "Quiet work must remain pull-inspectable.",
						revisionReason: "The source separates quietness from opacity.",
						evidenceIds: ["evidence-test"],
					},
				],
				memos: [
					{
						memoId: MEMO_ID,
						episodeId: EPISODE_ID,
						title: "Quietness without opacity",
						lang: "en",
						content: "Working observations stay visible before Save.",
						inquiryIds: [INQUIRY_ID],
						hypothesisId: INQUIRY_ID,
						evidenceIds: ["evidence-test"],
						currentRevisionId: "memo-revision-test",
						disposition: "incubating" as const,
						supersededBy: null,
						durableBase: null,
					},
				],
			},
		},
	};
}

function saveRequests(
	overrides: Partial<SaveRequestSession> = {},
): SaveRequestSession {
	return {
		requests: [],
		consumedRequestIds: [],
		pendingRequest: null,
		issues: [],
		...overrides,
	};
}

function project(input: {
	readonly observationSnapshot?: ObservationSessionSnapshot;
	readonly proposalInspection?: ObserverWorkbenchProposalInspection;
	readonly saveRequestSession?: SaveRequestSession;
	readonly status?: ObserverStatusView;
}) {
	const snapshots = workingSnapshots();
	return observerWorkbenchView({
		status: input.status ?? status(),
		observationSnapshot: input.observationSnapshot ?? snapshots.observation,
		memoSnapshot: snapshots.memo,
		materialReviewSnapshot: reconstructMaterialReviewSession([]),
		saveRequestSession: input.saveRequestSession ?? saveRequests(),
		inventory: [],
		proposalInspection: input.proposalInspection ?? { kind: "none" },
	});
}

describe("Observer inquiry workbench projection", () => {
	test("makes SourceReads, Observations, Inquiries, and Memos inspectable", () => {
		const view = project({});
		assert.deepEqual(
			view.activity.map((item) => item.kind),
			["source-read", "observation"],
		);
		assert.match(view.activity[0]?.summary ?? "", /Working meaning/);
		assert.match(
			view.activity[0]?.blocks.flatMap((block) => block.lines).join("\n") ?? "",
			/section 2/,
		);
		assert.equal(view.activity[1]?.state, "Working");
		assert.equal(
			view.inquiries[0]?.title,
			"Quiet work must remain pull-inspectable.",
		);
		assert.match(view.memos[0]?.blocks[0]?.lines[0] ?? "", /before Save/);
		assert.deepEqual(view.proposal, {
			kind: "needs-reconciliation",
			observationCount: 1,
			memoCount: 1,
		});
	});

	test("shows Review's Memo stage as preparation before a proposal exists", () => {
		const snapshots = workingSnapshots();
		const semantic = snapshots.observation.observations[0];
		if (!semantic) assert.fail("Expected semantic observation");
		const request = requireEvent({
			observer_observation: "observer-observation/v1",
			kind: "memo-requested",
			episode_id: EPISODE_ID,
			request_id: MEMO_REQUEST_ID,
			base_memo_revision_id: "memo-revision-test",
			observation_ids: [semantic.observationId],
			request_digest: observationMemoRequestDigest({
				episodeId: EPISODE_ID,
				baseMemoRevisionId: "memo-revision-test",
				observations: [semantic],
			}),
		});
		const continuation = requireEvent({
			observer_observation: "observer-observation/v1",
			kind: "review-save-continuation-requested",
			episode_id: EPISODE_ID,
			memo_request_id: MEMO_REQUEST_ID,
			base_save_request_count: 0,
		});
		if (
			request.kind !== "memo-requested" ||
			continuation.kind !== "review-save-continuation-requested"
		)
			assert.fail("Expected Review continuation events");
		const view = project({
			observationSnapshot: {
				...snapshots.observation,
				memoRequests: [request],
				pendingMemoRequest: request,
				reviewSaveContinuations: [continuation],
			},
		});
		assert.deepEqual(view.proposal, {
			kind: "preparing",
			stage: "memo-reconciliation",
			requestId: MEMO_REQUEST_ID,
			proposalId: null,
			observationCount: 1,
			sourceReadCount: 0,
			hasMemoRevision: true,
		});
	});

	test("shows proposal preparation scope without presenting partial Markdown", () => {
		const view = project({
			saveRequestSession: saveRequests({
				pendingRequest: {
					protocol: "observer.save-request/v1",
					kind: "save-requested",
					requestId: SAVE_REQUEST_ID,
					proposalId: PROPOSAL_ID,
					requestDigest: sha256Text("save request"),
					episodeId: EPISODE_ID,
					notebookId: "notebook-workbench",
					root: "/tmp/notebook",
					episodeLanguage: "en",
					memoRevisionId: "memo-revision-test",
					sourceReadIds: [READ_ID],
				},
			}),
		});
		assert.deepEqual(view.proposal, {
			kind: "preparing",
			stage: "proposal",
			requestId: SAVE_REQUEST_ID,
			proposalId: PROPOSAL_ID,
			observationCount: 0,
			sourceReadCount: 1,
			hasMemoRevision: true,
		});
		assert.doesNotMatch(JSON.stringify(view.proposal), /markdown/i);
	});

	test("exposes Diff, proposed Markdown, and existing Markdown only for a ready proposal", () => {
		const view = project({
			status: status({
				control: {
					...status().control,
					episode: "reviewing-save",
					canReview: false,
					canSave: true,
				},
				episode: "Ready to save",
			}),
			proposalInspection: {
				kind: "ready",
				review: {
					proposalId: PROPOSAL_ID,
					summary: "Update one Memo",
					notebookRoot: "/tmp/notebook",
					outputLanguage: "en",
					records: [
						{
							operation: "update",
							recordId: MEMO_ID,
							recordType: "memo",
							title: "Quietness without opacity",
							relativePath: `records/${MEMO_ID}.md`,
							beforeMarkdown: "# Old\n\nBefore\n",
							proposedMarkdown: "# New\n\nAfter\n",
						},
					],
				},
			},
		});
		assert.equal(view.proposal.kind, "ready");
		if (view.proposal.kind !== "ready") assert.fail("Expected ready proposal");
		const headings = view.proposal.records[0]?.blocks.map(
			(block) => block.heading,
		);
		assert.deepEqual(headings, [
			"Target",
			"Diff",
			"Proposed Markdown",
			"Existing Markdown",
		]);
		assert.match(
			view.proposal.records[0]?.blocks[1]?.lines.join("\n") ?? "",
			/- # Old[\s\S]*\+ # New/,
		);
	});
});
