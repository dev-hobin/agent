import { jsonValueFromUnknown } from "@hobin/judgment";

import {
	createReceiptProjection,
	type ReceiptProjection,
} from "../src/receipt-projection.ts";
import {
	replayDeveloperRuntime,
	type RuntimeReplayResult,
	type RuntimeReplayScope,
} from "../src/runtime-replay.ts";
import {
	DEVELOPER_RUNTIME_PROTOCOL,
	canonicalValueSha256,
	createDeveloperEventEnvelope,
	parseDeveloperId,
	type CausalEventRef,
	type DeveloperEventEnvelope,
	type DeveloperId,
	type Sha256Digest,
} from "../src/runtime-protocol.ts";

export const DEVELOPER_RUNTIME_ENTRY = "developer.runtime" as const;

export type DeveloperRuntimeHistoryMode =
	| "empty"
	| "v8-active"
	| "v8-closed"
	| "blocked";

export interface DeveloperRuntimeBranchEntry {
	readonly type?: string;
	readonly customType?: string;
	readonly data?: unknown;
	readonly message?: {
		readonly role?: string;
		readonly toolName?: string;
		readonly details?: unknown;
	};
}

const reconstructionBrand: unique symbol = Symbol(
	"DeveloperRuntimeBranchReconstruction",
);

export interface DeveloperRuntimeBranchReconstruction {
	readonly historyMode: DeveloperRuntimeHistoryMode;
	readonly runtimeEnvelopes: readonly unknown[];
	readonly replay: RuntimeReplayResult;
	readonly activeScope: RuntimeReplayScope | null;
	readonly projection: ReceiptProjection;
	readonly projectionRevisionSha256: Sha256Digest;
	readonly blockedReason: string | null;
	readonly [reconstructionBrand]: true;
}

export interface DeveloperRuntimeEventDraftInput {
	readonly eventId: DeveloperId;
	readonly kind: DeveloperId;
	readonly payload: unknown;
	readonly causalRefs?: readonly CausalEventRef[];
	readonly causalEventIds?: readonly DeveloperId[];
	readonly occurredAt: string;
}

export interface PrepareDeveloperRuntimeBatchInput {
	readonly reconstruction: DeveloperRuntimeBranchReconstruction;
	readonly workScopeId?: DeveloperId;
	readonly drafts: readonly DeveloperRuntimeEventDraftInput[];
}

const batchBrand: unique symbol = Symbol("PreflightedDeveloperRuntimeBatch");

export interface PreflightedDeveloperRuntimeBatch {
	readonly workScopeId: DeveloperId;
	readonly envelopes: readonly DeveloperEventEnvelope[];
	readonly replay: RuntimeReplayResult;
	readonly projection: ReceiptProjection;
	readonly projectionRevisionSha256: Sha256Digest;
	readonly [batchBrand]: true;
}

export type DeveloperRuntimeStateErrorCode =
	| "invalid-reconstruction"
	| "blocked-history"
	| "invalid-batch"
	| "scope-mismatch"
	| "preflight-rejected"
	| "invalid-preflight";

export interface DeveloperRuntimeStateFault {
	readonly developerRuntimeStateFault: true;
	readonly code: DeveloperRuntimeStateErrorCode;
	readonly message: string;
}

const reconstructionValues = new WeakSet<object>();
const batchValues = new WeakSet<object>();

function stop(
	...input: readonly [code: DeveloperRuntimeStateErrorCode, message: string]
): never {
	const [code, message] = input;
	throw Object.freeze({
		developerRuntimeStateFault: true,
		code,
		message,
	} satisfies DeveloperRuntimeStateFault);
}

export function isDeveloperRuntimeStateFault(
	value: unknown,
): value is DeveloperRuntimeStateFault {
	return (
		typeof value === "object" &&
		value !== null &&
		"developerRuntimeStateFault" in value &&
		value.developerRuntimeStateFault === true &&
		"code" in value &&
		typeof value.code === "string" &&
		"message" in value &&
		typeof value.message === "string"
	);
}

function runtimeEntry(entry: DeveloperRuntimeBranchEntry): unknown | undefined {
	return entry.type === "custom" && entry.customType === DEVELOPER_RUNTIME_ENTRY
		? entry.data
		: undefined;
}

function projectionRevision(
	accepted: RuntimeReplayResult["acceptedEvents"],
): Sha256Digest {
	return canonicalValueSha256({
		domain: "developer/v8/runtime-branch-revision",
		events: accepted.map((event) => ({
			workScopeId: event.envelope.workScopeId,
			eventId: event.envelope.eventId,
			eventSha256: event.envelope.eventSha256,
		})),
	});
}

export function reconstructDeveloperRuntimeBranch(
	entries: readonly DeveloperRuntimeBranchEntry[],
): DeveloperRuntimeBranchReconstruction {
	const runtimeEnvelopes: unknown[] = [];
	for (const entry of entries) {
		const runtime = runtimeEntry(entry);
		if (runtime !== undefined) runtimeEnvelopes.push(runtime);
	}
	const replay = replayDeveloperRuntime(runtimeEnvelopes);
	const projection = createReceiptProjection(replay.acceptedEvents);
	const openScopes = replay.scopes.filter(
		(scope) => scope.root.status === "open",
	);
	let blockedReason: string | null = null;
	if (replay.rejectedCount > 0) {
		const rejected = replay.dispositions.find(
			(disposition) => disposition.kind === "rejected",
		);
		blockedReason =
			rejected?.kind === "rejected"
				? `Developer v8 replay rejected entry ${rejected.storedIndex}: ${rejected.fault.message}`
				: "Developer v8 replay rejected persisted history";
	} else if (openScopes.length > 1) {
		blockedReason = "Developer v8 history has multiple open adapter scopes";
	}
	let historyMode: DeveloperRuntimeHistoryMode = "empty";
	if (blockedReason !== null) {
		historyMode = "blocked";
	} else if (openScopes.length === 1) {
		historyMode = "v8-active";
	} else if (runtimeEnvelopes.length > 0) {
		historyMode = "v8-closed";
	}
	const reconstruction: DeveloperRuntimeBranchReconstruction = Object.freeze({
		historyMode,
		runtimeEnvelopes: Object.freeze(runtimeEnvelopes),
		replay,
		activeScope: blockedReason ? null : (openScopes[0] ?? null),
		projection,
		projectionRevisionSha256: projectionRevision(replay.acceptedEvents),
		blockedReason,
		[reconstructionBrand]: true as const,
	});
	reconstructionValues.add(reconstruction);
	return reconstruction;
}

export function verifyDeveloperRuntimeBranchReconstruction(
	value: DeveloperRuntimeBranchReconstruction,
): DeveloperRuntimeBranchReconstruction {
	if (!reconstructionValues.has(value)) {
		return stop(
			"invalid-reconstruction",
			"Developer runtime reconstruction is not process-local",
		);
	}
	return value;
}

function causalRefKey(value: CausalEventRef): string {
	return `${value.workScopeId}\u0000${value.eventId}\u0000${value.eventSha256}`;
}

function canonicalCausalRefs(
	values: readonly CausalEventRef[],
): readonly CausalEventRef[] {
	const sorted = [...values];
	for (let index = 1; index < sorted.length; index += 1) {
		let cursor = index;
		while (cursor > 0) {
			const previous = sorted[cursor - 1];
			const current = sorted[cursor];
			if (
				previous === undefined ||
				current === undefined ||
				causalRefKey(previous) <= causalRefKey(current)
			) {
				break;
			}
			sorted[cursor - 1] = current;
			sorted[cursor] = previous;
			cursor -= 1;
		}
	}
	return Object.freeze(sorted);
}

function workScopeForBatch(input: {
	readonly reconstruction: DeveloperRuntimeBranchReconstruction;
	readonly requested: DeveloperId | undefined;
	readonly firstKind: DeveloperId;
}): DeveloperId {
	const active = input.reconstruction.activeScope;
	if (active !== null) {
		if (
			input.requested !== undefined &&
			input.requested !== active.workScopeId
		) {
			return stop("scope-mismatch", "batch targets another open work scope");
		}
		if (input.firstKind === "work-scope-opened") {
			return stop("scope-mismatch", "an adapter work scope is already open");
		}
		return active.workScopeId;
	}
	if (input.requested === undefined) {
		return stop("scope-mismatch", "new runtime batch requires workScopeId");
	}
	if (input.firstKind !== "work-scope-opened") {
		return stop(
			"scope-mismatch",
			"new work scope must begin with work-scope-opened",
		);
	}
	return parseDeveloperId(input.requested, "workScopeId");
}

export function prepareDeveloperRuntimeBatch(
	input: PrepareDeveloperRuntimeBatchInput,
): PreflightedDeveloperRuntimeBatch {
	const reconstruction = verifyDeveloperRuntimeBranchReconstruction(
		input.reconstruction,
	);
	if (reconstruction.blockedReason !== null) {
		return stop("blocked-history", reconstruction.blockedReason);
	}
	if (!Array.isArray(input.drafts) || input.drafts.length === 0) {
		return stop("invalid-batch", "runtime batch requires at least one draft");
	}
	const first = input.drafts[0];
	if (first === undefined) {
		return stop("invalid-batch", "runtime batch has no first draft");
	}
	const workScopeId = workScopeForBatch({
		reconstruction,
		requested: input.workScopeId,
		firstKind: first.kind,
	});
	let sequence =
		reconstruction.activeScope === null
			? 0
			: reconstruction.activeScope.head.scopeSequence + 1;
	let previousScopeEventSha256 =
		reconstruction.activeScope?.head.eventRef.eventSha256 ?? null;
	const envelopes: DeveloperEventEnvelope[] = [];
	const localRefs = new Map<DeveloperId, CausalEventRef>();
	for (const draft of input.drafts) {
		const causalRefs = [...(draft.causalRefs ?? [])];
		for (const causalEventId of draft.causalEventIds ?? []) {
			const local = localRefs.get(causalEventId);
			if (local === undefined) {
				return stop(
					"invalid-batch",
					`causal draft event is not an earlier batch member: ${causalEventId}`,
				);
			}
			causalRefs.push(local);
		}
		const envelope = createDeveloperEventEnvelope({
			protocolVersion: DEVELOPER_RUNTIME_PROTOCOL,
			eventId: parseDeveloperId(draft.eventId, "draft.eventId"),
			workScopeId,
			scopeSequence: sequence,
			previousScopeEventSha256,
			causalRefs: canonicalCausalRefs(causalRefs),
			occurredAt: draft.occurredAt,
			kind: parseDeveloperId(draft.kind, "draft.kind"),
			payload: jsonValueFromUnknown(draft.payload),
		});
		envelopes.push(envelope);
		localRefs.set(
			envelope.eventId,
			Object.freeze({
				workScopeId: envelope.workScopeId,
				eventId: envelope.eventId,
				eventSha256: envelope.eventSha256,
			}),
		);
		sequence += 1;
		previousScopeEventSha256 = envelope.eventSha256;
	}
	const replay = replayDeveloperRuntime([
		...reconstruction.runtimeEnvelopes,
		...envelopes,
	]);
	if (
		replay.rejectedCount !== 0 ||
		replay.acceptedCount !==
			reconstruction.replay.acceptedCount + envelopes.length
	) {
		const rejected = replay.dispositions.find(
			(disposition) => disposition.kind === "rejected",
		);
		return stop(
			"preflight-rejected",
			rejected?.kind === "rejected"
				? rejected.fault.message
				: "runtime batch was not accepted as one complete suffix",
		);
	}
	const projection = createReceiptProjection(replay.acceptedEvents);
	const batch: PreflightedDeveloperRuntimeBatch = Object.freeze({
		workScopeId,
		envelopes: Object.freeze(envelopes),
		replay,
		projection,
		projectionRevisionSha256: projectionRevision(replay.acceptedEvents),
		[batchBrand]: true as const,
	});
	batchValues.add(batch);
	return batch;
}

export function verifyPreflightedDeveloperRuntimeBatch(
	value: PreflightedDeveloperRuntimeBatch,
): PreflightedDeveloperRuntimeBatch {
	if (!batchValues.has(value)) {
		return stop(
			"invalid-preflight",
			"Developer runtime batch was not preflighted in this process",
		);
	}
	return value;
}
