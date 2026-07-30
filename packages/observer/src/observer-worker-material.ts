import type { NominatableToolResult } from "../extensions/material-review-runtime.ts";
import { reconstructObservationSession } from "./observation-session.ts";
import type { PiBranchEntryLike } from "./pi-session.ts";

const MAX_ITEM_TEXT = 24_000;
const MAX_TOTAL_TEXT = 96_000;
const MAX_IMAGES = 8;
const MAX_IMAGE_DATA = 24_000_000;

export interface ObserverWorkerImage {
	readonly type: "image";
	readonly data: string;
	readonly mimeType: string;
}

export interface ObserverWorkerMaterial {
	readonly text: string;
	readonly images: readonly ObserverWorkerImage[];
}

function bounded(value: string, remaining: number): string {
	const maximum = Math.max(0, Math.min(MAX_ITEM_TEXT, remaining));
	if (value.length <= maximum) return value;
	const marker = "\n[material truncated]";
	if (maximum <= marker.length) return marker.slice(0, maximum);
	return `${value.slice(0, maximum - marker.length)}${marker}`;
}

function textContent(content: readonly unknown[] | undefined): string {
	if (!content) return "";
	return content
		.flatMap((item) => {
			if (!item || typeof item !== "object") return [];
			return Reflect.get(item, "type") === "text" &&
				typeof Reflect.get(item, "text") === "string"
				? [String(Reflect.get(item, "text"))]
				: [];
		})
		.join("\n")
		.trim();
}

function imageContent(value: unknown): ObserverWorkerImage | null {
	if (!value || typeof value !== "object") return null;
	const data = Reflect.get(value, "data");
	const mimeType = Reflect.get(value, "mimeType");
	return Reflect.get(value, "type") === "image" &&
		typeof data === "string" &&
		typeof mimeType === "string"
		? { type: "image", data, mimeType }
		: null;
}

export function observerWorkerMaterial(input: {
	readonly entries: readonly PiBranchEntryLike[];
	readonly nominatableToolResults: readonly NominatableToolResult[];
}): ObserverWorkerMaterial {
	const session = reconstructObservationSession(input.entries);
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
	const lines = [
		"<observer-worker-material>",
		"This material is visible only to the isolated Observer worker.",
	];
	const images: ObserverWorkerImage[] = [];
	let total = lines.join("\n").length;
	let imageData = 0;

	function append(label: string, value: string): void {
		if (total >= MAX_TOTAL_TEXT) return;
		const renderedLabel = bounded(label, MAX_TOTAL_TEXT - total);
		const remaining = Math.max(
			0,
			MAX_TOTAL_TEXT - total - renderedLabel.length - 1,
		);
		const renderedValue = bounded(value, remaining);
		const rendered = `${renderedLabel}\n${renderedValue}`;
		lines.push(rendered);
		total += rendered.length;
	}

	for (const candidate of pendingCandidates) {
		append(
			`candidate_id=${candidate.candidateId} origin=${JSON.stringify(candidate.origin)}`,
			candidate.text,
		);
	}
	for (const read of pendingReads) {
		append(
			`pending_read_id=${read.readId}`,
			JSON.stringify({
				source: read.source,
				faithful_summary: read.faithfulSummary,
				claims: read.claims,
			}),
		);
	}
	for (const result of input.nominatableToolResults) {
		const attachmentIndexes: number[] = [];
		for (const item of result.content ?? []) {
			const image = imageContent(item);
			if (
				!image ||
				images.length >= MAX_IMAGES ||
				imageData + image.data.length > MAX_IMAGE_DATA
			) {
				continue;
			}
			attachmentIndexes.push(images.length);
			images.push(image);
			imageData += image.data.length;
		}
		append(
			[
				`eligible_tool_call_id=${result.toolCallId}`,
				`tool=${JSON.stringify(result.toolName)}`,
				`status=${result.isError ? "error" : "success"}`,
				`input=${JSON.stringify(result.input ?? {})}`,
				`attached_image_indexes=${JSON.stringify(attachmentIndexes)}`,
			].join(" "),
			textContent(result.content),
		);
	}
	lines.push("</observer-worker-material>");
	return { text: lines.join("\n"), images };
}
