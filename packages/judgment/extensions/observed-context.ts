import {
	decodeObservedContextData,
	parseObservedContext,
	type ObservedContext,
	type ObservedContextEntry,
} from "../src/context.ts";
import { JudgmentParseError } from "../src/errors.ts";
import { canonicalJson, jsonValueFromUnknown, sha256 } from "../src/json.ts";
import type { AcquiredContextData } from "../src/node/seal-context.ts";
import type { ContextContentPartData } from "../src/sealed-context.ts";

export interface PiBranchEntryInput {
	readonly id?: string;
	readonly type: string;
	readonly message?: unknown;
}
export interface ToolResultNominationInput {
	readonly toolCallId: string;
	readonly inventorySourceId?: string;
}
export interface UserDecisionNominationInput {
	readonly userEventId: string;
}
export interface ResolvedObservedContext {
	readonly observedContext: ObservedContext;
	acquireObservedContext(
		entry: ObservedContextEntry,
	): Promise<AcquiredContextData>;
}
interface ToolCallRecord {
	readonly id: string;
	readonly name: string;
	readonly argumentsSha256: string;
}
interface ToolResultRecord {
	readonly sequence: number;
	readonly toolCallId: string;
	readonly toolName: string;
	readonly isError: boolean;
	readonly parts: readonly ContextContentPartData[];
}
export interface ActiveBranchToolResultIdentity {
	readonly toolCallId: string;
	readonly toolName: string;
	readonly isError: boolean;
}

function objectValue(
	value: unknown,
): Readonly<Record<string, unknown>> | undefined {
	return typeof value === "object" && value !== null && !Array.isArray(value)
		? Object.fromEntries(Object.entries(value))
		: undefined;
}
function toolCalls(
	entries: readonly PiBranchEntryInput[],
): Map<string, ToolCallRecord> {
	const calls = new Map<string, ToolCallRecord>();
	for (const entry of entries) {
		if (entry.type !== "message") continue;
		const message = objectValue(entry.message);
		if (message?.role !== "assistant" || !Array.isArray(message.content))
			continue;
		for (const raw of message.content) {
			const part = objectValue(raw);
			if (
				part?.type !== "toolCall" ||
				typeof part.id !== "string" ||
				typeof part.name !== "string"
			)
				continue;
			if (calls.has(part.id))
				throw new JudgmentParseError(
					`Duplicate tool call ID on the active branch: ${part.id}.`,
				);
			calls.set(part.id, {
				id: part.id,
				name: part.name,
				argumentsSha256: sha256(
					canonicalJson(jsonValueFromUnknown(part.arguments ?? {})),
				),
			});
		}
	}
	return calls;
}
function contentParts(value: unknown): readonly ContextContentPartData[] {
	if (!Array.isArray(value))
		throw new JudgmentParseError("Tool result content is not an array.");
	const parts: ContextContentPartData[] = [];
	for (const [index, raw] of value.entries()) {
		const part = objectValue(raw);
		if (part?.type === "text" && typeof part.text === "string") {
			parts.push({ kind: "text", text: part.text });
			continue;
		}
		if (
			part?.type === "image" &&
			typeof part.data === "string" &&
			typeof part.mimeType === "string"
		) {
			parts.push({
				kind: "image",
				mediaType: part.mimeType,
				contentSha256: sha256(Buffer.from(part.data, "base64")),
			});
			continue;
		}
		throw new JudgmentParseError(
			`Unsupported tool-result content part at index ${index}.`,
		);
	}
	return Object.freeze(parts.length > 0 ? parts : [{ kind: "text", text: "" }]);
}
function toolResults(
	entries: readonly PiBranchEntryInput[],
): Map<string, ToolResultRecord> {
	const results = new Map<string, ToolResultRecord>();
	for (const [sequence, entry] of entries.entries()) {
		if (entry.type !== "message") continue;
		const message = objectValue(entry.message);
		if (
			message?.role !== "toolResult" ||
			typeof message.toolCallId !== "string" ||
			typeof message.toolName !== "string" ||
			typeof message.isError !== "boolean"
		)
			continue;
		if (results.has(message.toolCallId))
			throw new JudgmentParseError(
				`Duplicate tool result ID on the active branch: ${message.toolCallId}.`,
			);
		results.set(message.toolCallId, {
			sequence,
			toolCallId: message.toolCallId,
			toolName: message.toolName,
			isError: message.isError,
			parts: contentParts(message.content),
		});
	}
	return results;
}
export function activeBranchToolResultIdentities(
	entries: readonly PiBranchEntryInput[],
): readonly ActiveBranchToolResultIdentity[] {
	const calls = toolCalls(entries);
	const results = toolResults(entries);
	return Object.freeze(
		[...results.values()].flatMap((result) => {
			const call = calls.get(result.toolCallId);
			return call && call.name === result.toolName
				? [
						Object.freeze({
							toolCallId: result.toolCallId,
							toolName: result.toolName,
							isError: result.isError,
						}),
					]
				: [];
		}),
	);
}
interface UserDecisionRecord {
	readonly sequence: number;
	readonly userEventId: string;
	readonly parts: readonly ContextContentPartData[];
}
function userDecisions(
	entries: readonly PiBranchEntryInput[],
): Map<string, UserDecisionRecord> {
	const decisions = new Map<string, UserDecisionRecord>();
	for (const [sequence, entry] of entries.entries()) {
		if (entry.type !== "message" || !entry.id) continue;
		const message = objectValue(entry.message);
		if (message?.role !== "user") continue;
		const parts: readonly ContextContentPartData[] =
			typeof message.content === "string"
				? Object.freeze([{ kind: "text", text: message.content }])
				: contentParts(message.content);
		if (decisions.has(entry.id))
			throw new JudgmentParseError(
				`Duplicate user event ID on the active branch: ${entry.id}.`,
			);
		decisions.set(entry.id, { sequence, userEventId: entry.id, parts });
	}
	return decisions;
}
export function resolveObservedContext(input: {
	readonly branchRef: string;
	readonly branch: readonly PiBranchEntryInput[];
	readonly toolNominations: readonly ToolResultNominationInput[];
	readonly userDecisionNominations: readonly UserDecisionNominationInput[];
}): ResolvedObservedContext {
	const calls = toolCalls(input.branch);
	const results = toolResults(input.branch);
	const decisions = userDecisions(input.branch);
	const content = new Map<string, AcquiredContextData>();
	const entries: object[] = [];
	for (const nomination of input.toolNominations) {
		const call = calls.get(nomination.toolCallId);
		const result = results.get(nomination.toolCallId);
		if (!call || !result)
			throw new JudgmentParseError(
				`Tool call/result pair is not present on the active branch: ${nomination.toolCallId}.`,
			);
		if (call.name !== result.toolName)
			throw new JudgmentParseError(
				`Tool call/result names differ for ${nomination.toolCallId}.`,
			);
		const observedId = `result-${sha256(nomination.toolCallId).slice(0, 24)}`;
		const contentSha256 = sha256(
			canonicalJson(jsonValueFromUnknown(result.parts)),
		);
		content.set(observedId, {
			parts: result.parts,
			isError: result.isError,
			truncated: false,
		});
		entries.push({
			id: observedId,
			kind: result.toolName === "read" ? "read-result" : "tool-result",
			contentSha256,
			isError: result.isError,
			truncated: false,
			sequence: result.sequence,
			provenance: {
				source: result.toolName,
				scope: "temporary",
				origin: "session",
			},
			toolCallId: result.toolCallId,
			toolName: result.toolName,
			argumentsSha256: call.argumentsSha256,
			...(result.toolName === "read" && nomination.inventorySourceId
				? { inventorySourceId: nomination.inventorySourceId }
				: {}),
		});
	}
	for (const nomination of input.userDecisionNominations) {
		const decision = decisions.get(nomination.userEventId);
		if (!decision)
			throw new JudgmentParseError(
				`User decision is not present on the active branch: ${nomination.userEventId}.`,
			);
		const observedId = `user-${sha256(nomination.userEventId).slice(0, 24)}`;
		const contentSha256 = sha256(
			canonicalJson(jsonValueFromUnknown(decision.parts)),
		);
		content.set(observedId, {
			parts: decision.parts,
			isError: false,
			truncated: false,
		});
		entries.push({
			id: observedId,
			kind: "user-explicit",
			contentSha256,
			isError: false,
			truncated: false,
			sequence: decision.sequence,
			provenance: { source: "user", scope: "temporary", origin: "session" },
			userEventId: decision.userEventId,
		});
	}
	const observedContext = parseObservedContext(
		decodeObservedContextData(
			jsonValueFromUnknown({ branchRef: input.branchRef, entries }),
		),
	);
	return Object.freeze({
		observedContext,
		async acquireObservedContext(
			entry: ObservedContextEntry,
		): Promise<AcquiredContextData> {
			const acquired = content.get(entry.id);
			if (!acquired)
				throw new JudgmentParseError(
					`Observed content is unavailable on the active branch: ${entry.id}.`,
				);
			return acquired;
		},
	});
}
export function resolveObservedToolContext(input: {
	readonly branchRef: string;
	readonly branch: readonly PiBranchEntryInput[];
	readonly nominations: readonly ToolResultNominationInput[];
}): ResolvedObservedContext {
	return resolveObservedContext({
		branchRef: input.branchRef,
		branch: input.branch,
		toolNominations: input.nominations,
		userDecisionNominations: [],
	});
}
