import { hashIdentity } from "../src/action-loop/identity/hash-identity.ts";
import { realpath } from "node:fs/promises";
import { resolve, sep } from "node:path";

import { fingerprintPiToolResult } from "./action-loop-pi-action.ts";

export const MAX_LIVE_HOST_OBSERVATION_STATEMENT_CHARS = 2_048;
export const MAX_LIVE_HOST_OBSERVATIONS = 32;

export interface LiveHostObservationSelector {
	readonly kind: LiveHostObservation["kind"];
	readonly source: string;
	readonly statement: string;
}

export interface LiveHostObservation {
	readonly observationId: string;
	readonly kind: "human" | "tool";
	readonly source: string;
	readonly statement: string;
	readonly evidenceFingerprint: string;
	readonly workCaseId?: string;
	readonly basis: readonly string[];
}

export type AdmitLiveHostObservationResult =
	| {
			readonly status: "admitted";
			readonly observation: LiveHostObservation;
	  }
	| {
			readonly status: "invalid";
			readonly message: string;
	  };

function compactStatement(value: string): string {
	const normalized = value.trim().replace(/\s+/g, " ");
	if (normalized.length <= MAX_LIVE_HOST_OBSERVATION_STATEMENT_CHARS)
		return normalized;
	return `${normalized.slice(0, MAX_LIVE_HOST_OBSERVATION_STATEMENT_CHARS - 1)}…`;
}

function observationIdentity(
	kind: LiveHostObservation["kind"],
	source: string,
	evidenceFingerprint: string,
): string {
	return hashIdentity("observation", "developer.live-host-observation/v1", [
		kind,
		source,
		evidenceFingerprint,
	]);
}

function semanticToolSource(
	toolName: string,
	result: Readonly<Record<string, unknown>>,
): string {
	const input = result.input;
	if (typeof input !== "object" || input === null || Array.isArray(input)) {
		return `pi:tool-result:${toolName}`;
	}
	const fields = input as Readonly<Record<string, unknown>>;
	const path = typeof fields.path === "string" ? fields.path.trim() : "";
	const pattern = typeof fields.pattern === "string" ? fields.pattern.trim() : "";
	if (toolName === "read" && path) return `read:${path}`;
	if ((toolName === "find" || toolName === "grep") && pattern) {
		return `${toolName}:${pattern}${path ? ` in ${path}` : ""}`;
	}
	if (toolName === "ls") return `ls:${path || "."}`;
	return `pi:tool-result:${toolName}`;
}

function readableToolStatement(
	toolName: string,
	result: Readonly<Record<string, unknown>>,
	canonicalResult: string,
): string {
	const content = result.content;
	if (Array.isArray(content)) {
		const textBlocks = content.flatMap((item) => {
			if (typeof item !== "object" || item === null || Array.isArray(item)) {
				return [];
			}
			const candidate = item as Readonly<Record<string, unknown>>;
			return candidate.type === "text" && typeof candidate.text === "string"
				? [candidate.text]
				: [];
		});
		if (textBlocks.length > 0) {
			return compactStatement(
				`${toolName} returned exact text blocks ${JSON.stringify(textBlocks)}`,
			);
		}
	}
	return compactStatement(`${toolName} finalized with result ${canonicalResult}`);
}

/** Admits the exact current user prompt as human evidence without interpreting it. */
export function admitLiveUserPromptObservation(
	prompt: string,
	workCaseId?: string,
): AdmitLiveHostObservationResult {
	const statement = compactStatement(prompt);
	if (!statement) {
		return { status: "invalid", message: "User prompt observation is blank" };
	}
	const evidenceFingerprint = hashIdentity(
		"prompt",
		"developer.live-user-prompt/v1",
		[prompt],
	);
	const source = "pi:user-prompt";
	const observationId = observationIdentity(
		"human",
		source,
		evidenceFingerprint,
	);
	return {
		status: "admitted",
		observation: Object.freeze({
			observationId,
			kind: "human",
			source,
			statement,
			evidenceFingerprint,
			...(workCaseId ? { workCaseId } : {}),
			basis: Object.freeze([
				`Pi admitted the exact current user prompt as human evidence (${evidenceFingerprint}).`,
			]),
		}),
	};
}

/** Admits an exact finalized Pi tool result without interpreting its meaning or success. */
function isWithinRoot(root: string, path: string): boolean {
	const canonicalRoot = resolve(root);
	const canonicalPath = resolve(path);
	return (
		canonicalPath === canonicalRoot ||
		canonicalPath.startsWith(`${canonicalRoot}${sep}`)
	);
}

async function canonicalFilePath(path: string): Promise<string> {
	try {
		return await realpath(path);
	} catch {
		return resolve(path);
	}
}

/** Prevents generic read evidence from bypassing canonical Skill Context sealing. */
export async function isDirectSkillMaterialRead(
	toolName: string,
	input: Readonly<Record<string, unknown>>,
	skillsRoot: string,
): Promise<boolean> {
	if (toolName !== "read" || typeof input.path !== "string") return false;
	const [canonicalRoot, canonicalPath] = await Promise.all([
		canonicalFilePath(skillsRoot),
		canonicalFilePath(input.path),
	]);
	return isWithinRoot(canonicalRoot, canonicalPath);
}

export function admitLiveToolResultObservation(
	toolName: string,
	toolCallId: string,
	result: Readonly<Record<string, unknown>>,
	workCaseId?: string,
): AdmitLiveHostObservationResult {
	const canonicalToolName = toolName.trim();
	const canonicalToolCallId = toolCallId.trim();
	if (!canonicalToolName || !canonicalToolCallId) {
		return {
			status: "invalid",
			message: "Tool observation requires tool and call identity",
		};
	}
	const fingerprinted = fingerprintPiToolResult(canonicalToolName, result);
	if (fingerprinted.status === "invalid") return fingerprinted;
	const source = semanticToolSource(canonicalToolName, result);
	const observationId = observationIdentity(
		"tool",
		source,
		fingerprinted.fingerprint,
	);
	return {
		status: "admitted",
		observation: Object.freeze({
			observationId,
			kind: "tool",
			source,
			statement: readableToolStatement(
				canonicalToolName,
				result,
				fingerprinted.canonicalResult,
			),
			evidenceFingerprint: fingerprinted.fingerprint,
			...(workCaseId ? { workCaseId } : {}),
			basis: Object.freeze([
				`Pi finalized ${canonicalToolName} evidence from ${source}.`,
				"The readable statement is bounded; trusted state remains bound to the complete exact result.",
				"Receipt records evidence only; canonical Judgment or Effect settlement must determine what the result warrants.",
			]),
		}),
	};
}

/** Binds an observation admitted before Work Case opening to that newly opened Work Case. */
export function bindLiveHostObservation(
	observation: LiveHostObservation,
	workCaseId: string,
): LiveHostObservation | undefined {
	const canonicalWorkCaseId = workCaseId.trim();
	if (!canonicalWorkCaseId) return undefined;
	if (
		observation.workCaseId !== undefined &&
		observation.workCaseId !== canonicalWorkCaseId
	)
		return undefined;
	if (observation.workCaseId === canonicalWorkCaseId) return observation;
	return Object.freeze({ ...observation, workCaseId: canonicalWorkCaseId });
}

export function matchingLiveHostObservation(
	observations: readonly LiveHostObservation[],
	observationId: string,
	workCaseId: string,
): LiveHostObservation | undefined {
	return observations.find(
		(observation) =>
			observation.observationId === observationId &&
			observation.workCaseId === workCaseId,
	);
}

export function sameLiveHostObservationMeaning(
	observation: LiveHostObservation,
	selector: LiveHostObservationSelector,
): boolean {
	return (
		observation.kind === selector.kind &&
		observation.source === selector.source.trim() &&
		observation.statement === selector.statement.trim()
	);
}

export function selectLiveHostObservation(
	observations: readonly LiveHostObservation[],
	selector: LiveHostObservationSelector,
	workCaseId: string,
):
	| { readonly status: "selected"; readonly observation: LiveHostObservation }
	| { readonly status: "unavailable" | "ambiguous" } {
	const matches = observations.filter(
		(observation) =>
			observation.workCaseId === workCaseId &&
			sameLiveHostObservationMeaning(observation, selector),
	);
	const selected = matches[0];
	if (selected === undefined) return { status: "unavailable" };
	if (matches.length > 1) return { status: "ambiguous" };
	return { status: "selected", observation: selected };
}

export function liveHostObservationSelectorJson(
	observation: LiveHostObservation,
): string {
	return JSON.stringify({
		kind: observation.kind,
		source: observation.source,
		statement: observation.statement,
	});
}

export function liveHostObservationPrompt(
	observations: readonly LiveHostObservation[],
): string {
	if (observations.length === 0) return "Host-admitted observations: none.";
	return [
		"Host-admitted observations are evidence, not conclusions. Use one exact semantic observation selector when recording a direct observed Contribution or proposing pause, waiting, or resume:",
		...observations
			.slice(-MAX_LIVE_HOST_OBSERVATIONS)
			.map(
				(observation) => `- ${liveHostObservationSelectorJson(observation)}`,
			),
	].join("\n");
}
