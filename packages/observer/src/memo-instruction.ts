import { isSha256, sha256Text } from "./content-hash.ts";
import {
	decodeEvidenceId,
	decodeInquiryId,
	decodeMemoId,
	decodePreparedMemoPass,
	encodePreparedMemoPass,
	isPreparedMemoPass,
	type EvidenceId,
	type InquiryId,
	type MemoId,
	type PreparedMemoPass,
} from "./memo-profile.ts";
import { reconstructMemoSession } from "./memo-session.ts";
import {
	decodeMemoRequestId,
	decodeObservationId,
	type MemoRequestId,
	type ObservationId,
	type ObservationMemoRequestedEvent,
} from "./observation-profile.ts";
import { reconstructObservationSession } from "./observation-session.ts";
import {
	isObservationMemoContext,
	type ObservationMemoContext,
} from "./memo-trigger.ts";
import {
	decodeContextBasisData,
	encodeContextBasisData,
	memoContextInputSha256,
	type ContextBasisData,
} from "./observer-context.ts";
import type { PiBranchEntryLike } from "./pi-session.ts";

export const OBSERVER_MEMO_INSTRUCTION_PROTOCOL: "observer.memo-instruction/v1" =
	"observer.memo-instruction/v1";
export const OBSERVER_MEMO_INSTRUCTION_ENTRY = "observer.memo-instruction";

const STORED_MEMO_INSTRUCTION_MARKER = Symbol(
	"observer.stored-memo-instruction",
);
const PREPARED_MEMO_INSTRUCTION_MARKER = Symbol(
	"observer.prepared-memo-instruction",
);
const MAX_ITEMS = 1_000;
const MAX_TEXT = 20_000;

export interface ObservationDisposition {
	readonly observationId: ObservationId;
	readonly decision: "integrated" | "kept";
	readonly hypothesisInquiryIds: readonly InquiryId[];
	readonly memoIds: readonly MemoId[];
	readonly evidenceIds: readonly EvidenceId[];
	readonly rationale: string;
}

export interface StoredObservationMemoInstruction {
	readonly [STORED_MEMO_INSTRUCTION_MARKER]: true;
	readonly protocol: typeof OBSERVER_MEMO_INSTRUCTION_PROTOCOL;
	readonly requestId: MemoRequestId;
	readonly requestDigest: string;
	readonly pass: PreparedMemoPass;
	readonly dispositions: readonly ObservationDisposition[];
	readonly contextBasis: ContextBasisData;
	readonly digest: string;
}

export interface PreparedObservationMemoInstruction
	extends StoredObservationMemoInstruction {
	readonly [PREPARED_MEMO_INSTRUCTION_MARKER]: true;
}

export type MemoInstructionIssueCode =
	| "memo-instruction.object"
	| "memo-instruction.shape"
	| "memo-instruction.coverage"
	| "memo-instruction.reference"
	| "memo-instruction.context"
	| "memo-instruction.digest";

export interface MemoInstructionIssue {
	readonly code: MemoInstructionIssueCode;
	readonly path: string;
	readonly message: string;
	readonly relatedId?: string;
}

type InstructionFailure = {
	readonly ok: false;
	readonly issue: MemoInstructionIssue;
};

export type StoredMemoInstructionResult =
	| { readonly ok: true; readonly value: StoredObservationMemoInstruction }
	| InstructionFailure;

export type PreparedMemoInstructionResult =
	| { readonly ok: true; readonly value: PreparedObservationMemoInstruction }
	| InstructionFailure;

export type MemoInstructionSessionIssueCode =
	| "memo-instruction-session.malformed"
	| "memo-instruction-session.order"
	| "memo-instruction-session.conflict"
	| "memo-instruction-session.history";

export interface MemoInstructionSessionIssue {
	readonly index: number;
	readonly code: MemoInstructionSessionIssueCode;
	readonly message: string;
}

export interface MemoInstructionSessionSnapshot {
	readonly instructions: readonly StoredObservationMemoInstruction[];
	readonly pendingInstall: StoredObservationMemoInstruction | null;
	readonly issues: readonly MemoInstructionSessionIssue[];
}

function assertNever(value: never): never {
	throw new Error(`Unhandled Memo outcome: ${String(value)}`);
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(
	value: Readonly<Record<string, unknown>>,
	expected: readonly string[],
): boolean {
	const keys = Object.keys(value);
	return (
		keys.length === expected.length &&
		keys.every((key) => expected.includes(key))
	);
}

function failure(
	code: MemoInstructionIssueCode,
	path: string,
	message: string,
	relatedId?: string,
): InstructionFailure {
	return {
		ok: false,
		issue: relatedId
			? { code, path, message, relatedId }
			: { code, path, message },
	};
}

function boundedText(value: unknown): string | null {
	return typeof value === "string" &&
		value === value.trim() &&
		value.length > 0 &&
		value.length <= MAX_TEXT
		? value
		: null;
}

function parseIds<Id extends string>(
	value: unknown,
	decoder: (candidate: unknown) => Id | null,
): readonly Id[] | null {
	if (!Array.isArray(value) || value.length > MAX_ITEMS) return null;
	const result: Id[] = [];
	for (const candidate of value) {
		const id = decoder(candidate);
		if (!id || result.includes(id)) return null;
		result.push(id);
	}
	return result.toSorted((left, right) => left.localeCompare(right));
}

function parseDisposition(
	value: unknown,
	index: number,
): ObservationDisposition | InstructionFailure {
	const path = `/dispositions/${index}`;
	if (
		!isObject(value) ||
		!hasExactKeys(value, [
			"observation_id",
			"decision",
			"hypothesis_inquiry_ids",
			"memo_ids",
			"evidence_ids",
			"rationale",
		])
	) {
		return failure(
			"memo-instruction.shape",
			path,
			"Observation disposition has invalid fields.",
		);
	}
	const observationId = decodeObservationId(value.observation_id);
	const hypothesisInquiryIds = parseIds(
		value.hypothesis_inquiry_ids,
		decodeInquiryId,
	);
	const memoIds = parseIds(value.memo_ids, decodeMemoId);
	const evidenceIds = parseIds(value.evidence_ids, decodeEvidenceId);
	const rationale = boundedText(value.rationale);
	if (
		!observationId ||
		(value.decision !== "integrated" && value.decision !== "kept") ||
		!hypothesisInquiryIds ||
		!memoIds ||
		!evidenceIds ||
		!rationale
	) {
		return failure(
			"memo-instruction.shape",
			path,
			"Observation disposition has invalid values.",
		);
	}
	const references =
		hypothesisInquiryIds.length + memoIds.length + evidenceIds.length;
	if (
		(value.decision === "integrated" && references === 0) ||
		(value.decision === "kept" && references !== 0)
	) {
		return failure(
			"memo-instruction.shape",
			path,
			"Integrated dispositions require references; kept dispositions forbid them.",
			observationId,
		);
	}
	return {
		observationId,
		decision: value.decision,
		hypothesisInquiryIds,
		memoIds,
		evidenceIds,
		rationale,
	};
}

function isInstructionFailure(value: unknown): value is InstructionFailure {
	return (
		typeof value === "object" &&
		value !== null &&
		Reflect.get(value, "ok") === false
	);
}

function parseDispositions(
	value: unknown,
): readonly ObservationDisposition[] | InstructionFailure {
	if (!Array.isArray(value) || value.length === 0 || value.length > MAX_ITEMS) {
		return failure(
			"memo-instruction.shape",
			"/dispositions",
			"Memo instruction dispositions must be a nonempty bounded array.",
		);
	}
	const result: ObservationDisposition[] = [];
	for (const [index, candidate] of value.entries()) {
		const disposition = parseDisposition(candidate, index);
		if (isInstructionFailure(disposition)) return disposition;
		if (
			result.some((item) => item.observationId === disposition.observationId)
		) {
			return failure(
				"memo-instruction.coverage",
				`/dispositions/${index}/observation_id`,
				"Observation disposition IDs must be unique.",
				disposition.observationId,
			);
		}
		result.push(disposition);
	}
	return result.toSorted((left, right) =>
		left.observationId.localeCompare(right.observationId),
	);
}

function hypothesisIds(pass: PreparedMemoPass): ReadonlySet<InquiryId> {
	return new Set(
		pass.hypothesisOutcomes.map((outcome) =>
			outcome.kind === "create"
				? outcome.hypothesis.inquiryId
				: outcome.inquiryId,
		),
	);
}

function memoIds(pass: PreparedMemoPass): ReadonlySet<MemoId> {
	return new Set(
		pass.memoOutcomes.flatMap((outcome) => {
			switch (outcome.kind) {
				case "keep-incubating":
				case "revise":
				case "mark-promotion-candidate":
					return [outcome.memoId];
				case "merge":
					return [...outcome.sourceIds, outcome.target.memoId];
				case "create":
					return [outcome.memo.memoId];
				default:
					return assertNever(outcome);
			}
		}),
	);
}

function referenceFailure(input: {
	readonly pass: PreparedMemoPass;
	readonly dispositions: readonly ObservationDisposition[];
}): InstructionFailure | null {
	const availableHypotheses = hypothesisIds(input.pass);
	const availableMemos = memoIds(input.pass);
	const availableEvidence = new Set(
		input.pass.evidence.map((evidence) => evidence.evidenceId),
	);
	for (const [index, disposition] of input.dispositions.entries()) {
		if (
			disposition.hypothesisInquiryIds.some(
				(id) => !availableHypotheses.has(id),
			) ||
			disposition.memoIds.some((id) => !availableMemos.has(id)) ||
			disposition.evidenceIds.some((id) => !availableEvidence.has(id))
		) {
			return failure(
				"memo-instruction.reference",
				`/dispositions/${index}`,
				"Observation disposition references an outcome absent from the nested pass.",
				disposition.observationId,
			);
		}
	}
	return null;
}

function dispositionPayload(disposition: ObservationDisposition): unknown {
	return {
		observation_id: disposition.observationId,
		decision: disposition.decision,
		hypothesis_inquiry_ids: disposition.hypothesisInquiryIds,
		memo_ids: disposition.memoIds,
		evidence_ids: disposition.evidenceIds,
		rationale: disposition.rationale,
	};
}

function instructionPayload(input: {
	readonly requestId: MemoRequestId;
	readonly requestDigest: string;
	readonly pass: PreparedMemoPass;
	readonly dispositions: readonly ObservationDisposition[];
	readonly contextBasis: ContextBasisData;
}): Readonly<Record<string, unknown>> {
	return {
		observer_memo_instruction: OBSERVER_MEMO_INSTRUCTION_PROTOCOL,
		request_id: input.requestId,
		request_digest: input.requestDigest,
		pass: encodePreparedMemoPass(input.pass),
		dispositions: input.dispositions.map(dispositionPayload),
		context_basis: encodeContextBasisData(input.contextBasis),
	};
}

function finishStored(input: {
	readonly requestId: MemoRequestId;
	readonly requestDigest: string;
	readonly pass: PreparedMemoPass;
	readonly dispositions: readonly ObservationDisposition[];
	readonly contextBasis: ContextBasisData;
}): StoredObservationMemoInstruction {
	const digest = sha256Text(JSON.stringify(instructionPayload(input)));
	return {
		protocol: OBSERVER_MEMO_INSTRUCTION_PROTOCOL,
		requestId: input.requestId,
		requestDigest: input.requestDigest,
		pass: input.pass,
		dispositions: input.dispositions,
		contextBasis: input.contextBasis,
		digest,
		[STORED_MEMO_INSTRUCTION_MARKER]: true,
	};
}

function parseStored(
	value: unknown,
	persisted: boolean,
	providedContextBasis?: ContextBasisData,
): StoredMemoInstructionResult {
	if (!isObject(value)) {
		return failure(
			"memo-instruction.object",
			"/",
			"Memo instruction must be an object.",
		);
	}
	const expected = [
		"observer_memo_instruction",
		"request_id",
		"request_digest",
		"pass",
		"dispositions",
		...(persisted ? ["context_basis", "digest"] : []),
	];
	if (!hasExactKeys(value, expected)) {
		return failure(
			"memo-instruction.shape",
			"/",
			"Memo instruction has invalid fields.",
		);
	}
	if (value.observer_memo_instruction !== OBSERVER_MEMO_INSTRUCTION_PROTOCOL) {
		return failure(
			"memo-instruction.shape",
			"/observer_memo_instruction",
			"Memo instruction protocol is unsupported.",
		);
	}
	const requestId = decodeMemoRequestId(value.request_id);
	const pass = decodePreparedMemoPass(value.pass);
	const dispositions = parseDispositions(value.dispositions);
	const decodedContextBasis = persisted
		? decodeContextBasisData(value.context_basis)
		: providedContextBasis
			? { ok: true as const, value: providedContextBasis }
			: { ok: false as const, message: "Context basis is required." };
	if (!requestId) {
		return failure(
			"memo-instruction.shape",
			"/request_id",
			"Memo instruction request ID is invalid.",
		);
	}
	if (!isSha256(value.request_digest)) {
		return failure(
			"memo-instruction.shape",
			"/request_digest",
			"Memo instruction request digest is invalid.",
		);
	}
	if (!pass.ok) {
		return failure(
			"memo-instruction.shape",
			pass.issue.path === "/" ? "/pass" : `/pass${pass.issue.path}`,
			`Prepared Memo pass is invalid: ${pass.issue.message}`,
		);
	}
	if (isInstructionFailure(dispositions)) return dispositions;
	if (!decodedContextBasis.ok) {
		return failure(
			"memo-instruction.context",
			"/context_basis",
			decodedContextBasis.message,
		);
	}
	if (pass.value.instructionId !== requestId) {
		return failure(
			"memo-instruction.context",
			"/pass/instruction_id",
			"Nested Memo pass must name the instruction request.",
			requestId,
		);
	}
	const references = referenceFailure({
		pass: pass.value,
		dispositions,
	});
	if (references) return references;
	const stored = finishStored({
		requestId,
		requestDigest: value.request_digest,
		pass: pass.value,
		dispositions,
		contextBasis: decodedContextBasis.value,
	});
	if (persisted && value.digest !== stored.digest) {
		return failure(
			"memo-instruction.digest",
			"/digest",
			"Memo instruction digest does not match its normalized payload.",
		);
	}
	return { ok: true, value: stored };
}

function sameStrings(
	left: readonly string[],
	right: readonly string[],
): boolean {
	return (
		left.length === right.length &&
		left.every((value, index) => value === right[index])
	);
}

function contextualFailure(input: {
	readonly instruction: StoredObservationMemoInstruction;
	readonly context: ObservationMemoContext;
}): InstructionFailure | null {
	const request = input.context.request;
	const pass = input.instruction.pass;
	if (
		input.instruction.requestId !== request.requestId ||
		input.instruction.requestDigest !== request.requestDigest ||
		pass.instructionId !== request.requestId ||
		pass.episodeId !== request.episodeId ||
		pass.baseRevisionId !== request.baseMemoRevisionId ||
		pass.basisDigest !== input.context.memoScope.basisDigest ||
		!sameStrings(
			pass.relatedInquiryIds,
			input.context.memoScope.relatedInquiryIds,
		)
	) {
		return failure(
			"memo-instruction.context",
			"/",
			"Memo instruction does not match its request and hydrated scope.",
			request.requestId,
		);
	}
	const expectedInputSha256 = memoContextInputSha256({
		scopeId: request.requestId,
		episodeId: pass.episodeId,
		basisDigest: pass.basisDigest,
		relatedInquiryIds: pass.relatedInquiryIds,
		knownEvidenceIds: [
			...input.context.priorEvidenceIds,
			...pass.evidence.map((evidence) => evidence.evidenceId),
		].toSorted((left, right) => left.localeCompare(right)),
		passDigest: pass.digest,
		outcomeCount: pass.hypothesisOutcomes.length + pass.memoOutcomes.length,
		dispositionCount: input.instruction.dispositions.length,
	});
	if (
		input.instruction.contextBasis.questionId !== "reconcile-memo-pass" ||
		input.instruction.contextBasis.inputSha256 !== expectedInputSha256 ||
		input.instruction.contextBasis.coverage.missing.length > 0 ||
		input.instruction.contextBasis.coverage.conflicts.length > 0 ||
		!sameStrings(input.instruction.contextBasis.selectedSourceIds, [
			"memo-pass-evidence",
			"memo-scope-evidence",
		])
	) {
		return failure(
			"memo-instruction.context",
			"/context_basis",
			"Memo context basis does not match its current branch input.",
			request.requestId,
		);
	}
	const expectedIds = request.observationIds.toSorted((left, right) =>
		left.localeCompare(right),
	);
	const dispositionIds = input.instruction.dispositions.map(
		(disposition) => disposition.observationId,
	);
	if (!sameStrings(expectedIds, dispositionIds)) {
		return failure(
			"memo-instruction.coverage",
			"/dispositions",
			"Memo instruction must disposition every requested Observation exactly once.",
			request.requestId,
		);
	}
	const byId = new Map(
		input.instruction.dispositions.map(
			(disposition): readonly [ObservationId, ObservationDisposition] => [
				disposition.observationId,
				disposition,
			],
		),
	);
	for (const observation of input.context.observations) {
		const requiredInquiryId =
			observation.kind === "user-hypothesis-recorded"
				? observation.inquiryId
				: observation.observerHypothesis?.inquiryId;
		if (
			requiredInquiryId &&
			!byId
				.get(observation.observationId)
				?.hypothesisInquiryIds.includes(requiredInquiryId)
		) {
			return failure(
				"memo-instruction.coverage",
				"/dispositions",
				"Hypothesis Observation must reference its exact Inquiry outcome.",
				observation.observationId,
			);
		}
	}
	return null;
}

function prepareFromStored(
	instruction: StoredObservationMemoInstruction,
): PreparedObservationMemoInstruction {
	return {
		...instruction,
		[PREPARED_MEMO_INSTRUCTION_MARKER]: true,
	};
}

export function refineStoredObservationMemoInstruction(input: {
	readonly instruction: StoredObservationMemoInstruction;
	readonly context: ObservationMemoContext;
}): PreparedMemoInstructionResult {
	if (!isObservationMemoContext(input.context)) {
		return failure(
			"memo-instruction.context",
			"/",
			"Memo instruction refinement requires a parser-produced context.",
		);
	}
	const contextual = contextualFailure(input);
	return contextual
		? contextual
		: { ok: true, value: prepareFromStored(input.instruction) };
}

export function decodePreparedObservationMemoInstruction(input: {
	readonly value: unknown;
	readonly context: ObservationMemoContext;
	readonly contextBasis: ContextBasisData;
}): PreparedMemoInstructionResult {
	const stored = parseStored(input.value, false, input.contextBasis);
	if (!stored.ok) return stored;
	return refineStoredObservationMemoInstruction({
		instruction: stored.value,
		context: input.context,
	});
}

export function decodeStoredObservationMemoInstruction(
	value: unknown,
): StoredMemoInstructionResult {
	return parseStored(value, true);
}

export function encodeObservationMemoInstruction(
	instruction: PreparedObservationMemoInstruction,
): unknown {
	if (
		!isPreparedMemoPass(instruction.pass) ||
		instruction[PREPARED_MEMO_INSTRUCTION_MARKER] !== true
	) {
		throw new Error(
			"Memo instruction must come from contextual instruction refinement.",
		);
	}
	return {
		...instructionPayload(instruction),
		digest: instruction.digest,
	};
}

function requestMatchesInstruction(input: {
	readonly request: ObservationMemoRequestedEvent;
	readonly instruction: StoredObservationMemoInstruction;
	readonly observation: ReturnType<typeof reconstructObservationSession>;
}): boolean {
	if (
		input.instruction.requestId !== input.request.requestId ||
		input.instruction.requestDigest !== input.request.requestDigest ||
		input.instruction.pass.episodeId !== input.request.episodeId ||
		input.instruction.pass.baseRevisionId !== input.request.baseMemoRevisionId
	) {
		return false;
	}
	const dispositionIds = input.instruction.dispositions.map(
		(disposition) => disposition.observationId,
	);
	if (!sameStrings(input.request.observationIds, dispositionIds)) return false;
	const available = new Map(
		[
			...input.observation.observations,
			...input.observation.userHypotheses,
		].map((value): readonly [ObservationId, typeof value] => [
			value.observationId,
			value,
		]),
	);
	const dispositions = new Map(
		input.instruction.dispositions.map(
			(value): readonly [ObservationId, ObservationDisposition] => [
				value.observationId,
				value,
			],
		),
	);
	for (const observationId of input.request.observationIds) {
		const observation = available.get(observationId);
		const disposition = dispositions.get(observationId);
		if (!observation || !disposition) return false;
		const inquiryId =
			observation.kind === "user-hypothesis-recorded"
				? observation.inquiryId
				: observation.observerHypothesis?.inquiryId;
		if (inquiryId && !disposition.hypothesisInquiryIds.includes(inquiryId)) {
			return false;
		}
	}
	return true;
}

function sessionIssue(
	issues: MemoInstructionSessionIssue[],
	index: number,
	code: MemoInstructionSessionIssueCode,
	message: string,
): void {
	issues.push({ index, code, message });
}

export function reconstructMemoInstructionSession(
	entries: readonly PiBranchEntryLike[],
): MemoInstructionSessionSnapshot {
	const instructions = new Map<
		MemoRequestId,
		StoredObservationMemoInstruction
	>();
	const issues: MemoInstructionSessionIssue[] = [];
	for (const [index, entry] of entries.entries()) {
		if (
			entry.type !== "custom" ||
			entry.customType !== OBSERVER_MEMO_INSTRUCTION_ENTRY
		) {
			continue;
		}
		const decoded = decodeStoredObservationMemoInstruction(entry.data);
		if (!decoded.ok) {
			sessionIssue(
				issues,
				index,
				"memo-instruction-session.malformed",
				decoded.issue.message,
			);
			continue;
		}
		const prior = instructions.get(decoded.value.requestId);
		if (prior) {
			if (prior.digest !== decoded.value.digest) {
				sessionIssue(
					issues,
					index,
					"memo-instruction-session.conflict",
					"Memo instructions for one request conflict.",
				);
			}
			continue;
		}
		const observation = reconstructObservationSession(entries.slice(0, index));
		const request = observation.memoRequests.find(
			(item) => item.requestId === decoded.value.requestId,
		);
		if (
			observation.issues.length > 0 ||
			!request ||
			!requestMatchesInstruction({
				request,
				instruction: decoded.value,
				observation,
			})
		) {
			sessionIssue(
				issues,
				index,
				"memo-instruction-session.order",
				"Memo instruction does not match prior request history.",
			);
			continue;
		}
		instructions.set(decoded.value.requestId, decoded.value);
	}
	const memo = reconstructMemoSession(entries);
	if (memo.issues.length > 0) {
		sessionIssue(
			issues,
			entries.length,
			"memo-instruction-session.history",
			"Memo history is malformed while replaying instructions.",
		);
	}
	const installed = new Set(
		[
			memo.prepared?.instructionId,
			memo.pendingAcknowledgment?.instructionId,
			...memo.acknowledgedPasses.map((pass) => pass.instructionId),
		].flatMap((instructionId) => (instructionId ? [instructionId] : [])),
	);
	const values = [...instructions.values()].toSorted((left, right) =>
		left.requestId.localeCompare(right.requestId),
	);
	const pending = values.filter(
		(instruction) => !installed.has(instruction.requestId),
	);
	if (pending.length > 1) {
		sessionIssue(
			issues,
			entries.length,
			"memo-instruction-session.conflict",
			"Only one Memo instruction may await prepared-pass installation.",
		);
	}
	return {
		instructions: values,
		pendingInstall: pending[0] ?? null,
		issues,
	};
}
