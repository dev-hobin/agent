import type { EpisodeLanguage } from "./lifecycle.ts";
import type {
	NotebookPublicationPlan,
	NotebookPublicationEntry,
} from "./notebook-publication-preflight.ts";
import type { PreparedSaveHandoff } from "./pi-session.ts";
import type { ObserverRecordType } from "./markdown-profile.ts";

export type SaveProposalReviewDecision = "back" | "reject" | "approve";

export interface SaveProposalReviewRecord {
	readonly operation: "create" | "update";
	readonly recordId: string;
	readonly recordType: ObserverRecordType;
	readonly title: string;
	readonly relativePath: string;
	readonly beforeMarkdown: string | null;
	readonly proposedMarkdown: string;
}

export interface SaveProposalReview {
	readonly proposalId: string;
	readonly summary: string;
	readonly notebookRoot: string;
	readonly outputLanguage: EpisodeLanguage;
	readonly records: readonly SaveProposalReviewRecord[];
}

function reviewRecord(
	entry: NotebookPublicationEntry,
): SaveProposalReviewRecord {
	return {
		operation: entry.operation,
		recordId: entry.recordId,
		recordType: entry.recordType,
		title: entry.title,
		relativePath: entry.relativePath,
		beforeMarkdown: entry.beforeContent,
		proposedMarkdown: entry.nextContent,
	};
}

/** Builds a presentation-only view from an already validated publication plan. */
export function saveProposalReview(
	handoff: PreparedSaveHandoff,
	plan: NotebookPublicationPlan,
): SaveProposalReview {
	return {
		proposalId: handoff.prepared.proposal_id,
		summary: handoff.summary,
		notebookRoot: handoff.prepared.root,
		outputLanguage: handoff.prepared.episode_language,
		records: plan.entries.map(reviewRecord),
	};
}

/** Text fallback for non-TUI Pi modes. TUI mode uses the bounded review surface. */
export function renderSaveProposalReview(review: SaveProposalReview): string {
	const operations = review.records.flatMap((record) => [
		`--- ${record.operation}: ${record.recordType} · ${record.relativePath} ---`,
		record.proposedMarkdown,
		"",
	]);
	return [
		review.summary,
		"",
		`Notebook: ${review.notebookRoot}`,
		`Output language: ${review.outputLanguage}`,
		`Records: ${review.records.length}`,
		"Validation: passed",
		"",
		...operations,
	].join("\n");
}
