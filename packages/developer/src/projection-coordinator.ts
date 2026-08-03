import {
	canonicalValueSha256,
	parseDeveloperId,
	parseSha256Digest,
	type DeveloperId,
	type Sha256Digest,
} from "./runtime-protocol.ts";
import {
	verifyReceiptProjection,
	type ReceiptProjection,
	type ReceiptProjectionReadTarget,
} from "./receipt-projection.ts";

export type ProjectionCoordinatorErrorCode =
	| "invalid-input"
	| "invalid-state"
	| "invalid-ticket"
	| "invalid-publication"
	| "invalid-projection"
	| "coordinator-already-initialized"
	| "sequence-exhausted"
	| "foreign-ticket"
	| "stale-ticket"
	| "projection-unavailable"
	| "stale-publication";

const COORDINATOR_ERROR_CODES: ReadonlySet<string> = new Set([
	"invalid-input",
	"invalid-state",
	"invalid-ticket",
	"invalid-publication",
	"invalid-projection",
	"coordinator-already-initialized",
	"sequence-exhausted",
	"foreign-ticket",
	"stale-ticket",
	"projection-unavailable",
	"stale-publication",
] satisfies readonly ProjectionCoordinatorErrorCode[]);

export interface ProjectionCoordinatorFault {
	readonly projectionCoordinatorFault: true;
	readonly code: ProjectionCoordinatorErrorCode;
	readonly message: string;
}

export function isProjectionCoordinatorFault(
	value: unknown,
): value is ProjectionCoordinatorFault {
	return (
		typeof value === "object" &&
		value !== null &&
		"projectionCoordinatorFault" in value &&
		value.projectionCoordinatorFault === true &&
		"code" in value &&
		typeof value.code === "string" &&
		COORDINATOR_ERROR_CODES.has(value.code) &&
		"message" in value &&
		typeof value.message === "string"
	);
}

const ticketBrand: unique symbol = Symbol("ProjectionRefreshTicket");

export interface ProjectionRefreshTicket {
	readonly coordinatorId: DeveloperId;
	readonly requestSequence: number;
	readonly requestedRevisionSha256: Sha256Digest;
	readonly priorProjectionSha256: Sha256Digest | null;
	readonly ticketSha256: Sha256Digest;
	readonly [ticketBrand]: true;
}

const publicationBrand: unique symbol = Symbol("ProjectionPublication");

export interface ProjectionPublication {
	readonly coordinatorId: DeveloperId;
	readonly requestSequence: number;
	readonly requestedRevisionSha256: Sha256Digest;
	readonly projectionSha256: Sha256Digest;
	readonly publicationSha256: Sha256Digest;
	readonly [publicationBrand]: true;
}

export type ProjectionCoordinatorAvailability =
	| Readonly<{
			kind: "unavailable";
			reason: "not-yet-projected" | "refresh-failed";
			lastRequestedRevisionSha256: Sha256Digest | null;
	  }>
	| Readonly<{
			kind: "refreshing";
			ticket: ProjectionRefreshTicket;
			requestedRevisionSha256: Sha256Digest;
			priorProjectionSha256: Sha256Digest | null;
	  }>
	| Readonly<{
			kind: "current";
			publication: ProjectionPublication;
			projection: ReceiptProjection;
	  }>;

const stateBrand: unique symbol = Symbol("ProjectionCoordinatorState");

export interface ProjectionCoordinatorState {
	readonly coordinatorId: DeveloperId;
	readonly transitionSequence: number;
	readonly lastRequestSequence: number;
	readonly availability: ProjectionCoordinatorAvailability;
	readonly stateSha256: Sha256Digest;
	readonly [stateBrand]: true;
}

export interface ProjectionCoordinatorTransitionError {
	readonly code: "stale-state" | "foreign-ticket" | "stale-ticket";
	readonly message: string;
}

export type ProjectionCoordinatorTransition<Value> =
	| Readonly<{
			ok: true;
			state: ProjectionCoordinatorState;
			value: Value;
	  }>
	| Readonly<{
			ok: false;
			state: ProjectionCoordinatorState;
			error: ProjectionCoordinatorTransitionError;
	  }>;

export interface ProjectionCoordinatorTargetError {
	readonly code: "stale-state" | "projection-unavailable" | "stale-publication";
	readonly message: string;
}

export type ProjectionCoordinatorTargetResult =
	| Readonly<{
			ok: true;
			target: ReceiptProjectionReadTarget;
	  }>
	| Readonly<{
			ok: false;
			error: ProjectionCoordinatorTargetError;
	  }>;

export interface BeginProjectionRefreshInput {
	readonly state: ProjectionCoordinatorState;
	readonly requestedRevisionSha256: Sha256Digest;
}

export interface CompleteProjectionRefreshInput {
	readonly state: ProjectionCoordinatorState;
	readonly ticket: ProjectionRefreshTicket;
	readonly projection: ReceiptProjection;
}

export interface FailProjectionRefreshInput {
	readonly state: ProjectionCoordinatorState;
	readonly ticket: ProjectionRefreshTicket;
}

export interface ProjectionReadTargetInput {
	readonly state: ProjectionCoordinatorState;
	readonly publication: ProjectionPublication | null;
}

const stateValues = new WeakSet<object>();
const ticketValues = new WeakSet<object>();
const publicationValues = new WeakSet<object>();
const coordinatorHeads = new Map<DeveloperId, ProjectionCoordinatorState>();

function stop(
	...input: readonly [code: ProjectionCoordinatorErrorCode, message: string]
): never {
	const [code, message] = input;
	throw Object.freeze({
		projectionCoordinatorFault: true,
		code,
		message,
	} satisfies ProjectionCoordinatorFault);
}

function coordinatorId(value: DeveloperId): DeveloperId {
	try {
		return parseDeveloperId(value, "projectionCoordinator.coordinatorId");
	} catch {
		return stop("invalid-input", "projection coordinator identity is invalid");
	}
}

function revisionSha256(value: Sha256Digest): Sha256Digest {
	try {
		return parseSha256Digest(
			value,
			"projectionCoordinator.requestedRevisionSha256",
		);
	} catch {
		return stop("invalid-input", "projection requested revision is invalid");
	}
}

function nextSequence(value: number): number {
	if (
		!Number.isSafeInteger(value) ||
		value < 0 ||
		value >= Number.MAX_SAFE_INTEGER
	) {
		return stop(
			"sequence-exhausted",
			"projection coordinator sequence is exhausted",
		);
	}
	return value + 1;
}

function createTicket(input: {
	readonly coordinatorId: DeveloperId;
	readonly requestSequence: number;
	readonly requestedRevisionSha256: Sha256Digest;
	readonly priorProjectionSha256: Sha256Digest | null;
}): ProjectionRefreshTicket {
	const fields = Object.freeze({
		coordinatorId: input.coordinatorId,
		requestSequence: input.requestSequence,
		requestedRevisionSha256: input.requestedRevisionSha256,
		priorProjectionSha256: input.priorProjectionSha256,
	});
	const ticket: ProjectionRefreshTicket = Object.freeze({
		...fields,
		ticketSha256: canonicalValueSha256({
			domain: "developer/v8/projection-refresh-ticket",
			fields,
		}),
		[ticketBrand]: true as const,
	});
	ticketValues.add(ticket);
	return ticket;
}

function createPublication(input: {
	readonly ticket: ProjectionRefreshTicket;
	readonly projection: ReceiptProjection;
}): ProjectionPublication {
	const fields = Object.freeze({
		coordinatorId: input.ticket.coordinatorId,
		requestSequence: input.ticket.requestSequence,
		requestedRevisionSha256: input.ticket.requestedRevisionSha256,
		projectionSha256: input.projection.projectionSha256,
	});
	const publication: ProjectionPublication = Object.freeze({
		...fields,
		publicationSha256: canonicalValueSha256({
			domain: "developer/v8/projection-publication",
			fields,
		}),
		[publicationBrand]: true as const,
	});
	publicationValues.add(publication);
	return publication;
}

function availabilityCommitment(
	availability: ProjectionCoordinatorAvailability,
): Readonly<Record<string, unknown>> {
	if (availability.kind === "unavailable") {
		return Object.freeze({
			kind: availability.kind,
			reason: availability.reason,
			lastRequestedRevisionSha256: availability.lastRequestedRevisionSha256,
		});
	}
	if (availability.kind === "refreshing") {
		return Object.freeze({
			kind: availability.kind,
			ticketSha256: availability.ticket.ticketSha256,
			requestedRevisionSha256: availability.requestedRevisionSha256,
			priorProjectionSha256: availability.priorProjectionSha256,
		});
	}
	return Object.freeze({
		kind: availability.kind,
		publicationSha256: availability.publication.publicationSha256,
		projectionSha256: availability.projection.projectionSha256,
	});
}

function createState(input: {
	readonly coordinatorId: DeveloperId;
	readonly transitionSequence: number;
	readonly lastRequestSequence: number;
	readonly availability: ProjectionCoordinatorAvailability;
}): ProjectionCoordinatorState {
	const fields = Object.freeze({
		coordinatorId: input.coordinatorId,
		transitionSequence: input.transitionSequence,
		lastRequestSequence: input.lastRequestSequence,
		availability: availabilityCommitment(input.availability),
	});
	const state: ProjectionCoordinatorState = Object.freeze({
		coordinatorId: input.coordinatorId,
		transitionSequence: input.transitionSequence,
		lastRequestSequence: input.lastRequestSequence,
		availability: input.availability,
		stateSha256: canonicalValueSha256({
			domain: "developer/v8/projection-coordinator-state",
			fields,
		}),
		[stateBrand]: true as const,
	});
	stateValues.add(state);
	coordinatorHeads.set(state.coordinatorId, state);
	return state;
}

function unavailable(input: {
	readonly reason: "not-yet-projected" | "refresh-failed";
	readonly lastRequestedRevisionSha256: Sha256Digest | null;
}): ProjectionCoordinatorAvailability {
	return Object.freeze({
		kind: "unavailable",
		reason: input.reason,
		lastRequestedRevisionSha256: input.lastRequestedRevisionSha256,
	});
}

function refreshing(input: {
	readonly ticket: ProjectionRefreshTicket;
}): ProjectionCoordinatorAvailability {
	return Object.freeze({
		kind: "refreshing",
		ticket: input.ticket,
		requestedRevisionSha256: input.ticket.requestedRevisionSha256,
		priorProjectionSha256: input.ticket.priorProjectionSha256,
	});
}

function current(input: {
	readonly publication: ProjectionPublication;
	readonly projection: ReceiptProjection;
}): ProjectionCoordinatorAvailability {
	return Object.freeze({
		kind: "current",
		publication: input.publication,
		projection: input.projection,
	});
}

function success<Value>(input: {
	readonly state: ProjectionCoordinatorState;
	readonly value: Value;
}): ProjectionCoordinatorTransition<Value> {
	return Object.freeze({ ok: true, state: input.state, value: input.value });
}

function transitionError(input: {
	readonly state: ProjectionCoordinatorState;
	readonly code: "stale-state" | "foreign-ticket" | "stale-ticket";
	readonly message: string;
}): ProjectionCoordinatorTransition<never> {
	return Object.freeze({
		ok: false,
		state: input.state,
		error: Object.freeze({ code: input.code, message: input.message }),
	});
}

function targetError(input: {
	readonly code: "stale-state" | "projection-unavailable" | "stale-publication";
	readonly message: string;
}): ProjectionCoordinatorTargetResult {
	return Object.freeze({
		ok: false,
		error: Object.freeze({ code: input.code, message: input.message }),
	});
}

export function initialProjectionCoordinatorState(
	coordinatorIdInput: DeveloperId,
): ProjectionCoordinatorState {
	const refinedCoordinatorId = coordinatorId(coordinatorIdInput);
	if (coordinatorHeads.has(refinedCoordinatorId)) {
		return stop(
			"coordinator-already-initialized",
			"projection coordinator identity already has a process-local head",
		);
	}
	return createState({
		coordinatorId: refinedCoordinatorId,
		transitionSequence: 0,
		lastRequestSequence: 0,
		availability: unavailable({
			reason: "not-yet-projected",
			lastRequestedRevisionSha256: null,
		}),
	});
}

export function verifyProjectionCoordinatorState(
	value: ProjectionCoordinatorState,
): ProjectionCoordinatorState {
	if (!stateValues.has(value)) {
		return stop(
			"invalid-state",
			"projection coordinator state is not process-local",
		);
	}
	return value;
}

export function verifyProjectionRefreshTicket(
	value: ProjectionRefreshTicket,
): ProjectionRefreshTicket {
	if (!ticketValues.has(value)) {
		return stop(
			"invalid-ticket",
			"projection refresh ticket is not process-local",
		);
	}
	return value;
}

export function verifyProjectionPublication(
	value: ProjectionPublication,
): ProjectionPublication {
	if (!publicationValues.has(value)) {
		return stop(
			"invalid-publication",
			"projection publication is not process-local",
		);
	}
	return value;
}

function verifiedProjection(value: ReceiptProjection): ReceiptProjection {
	try {
		return verifyReceiptProjection(value);
	} catch {
		return stop(
			"invalid-projection",
			"completed receipt projection is not process-local",
		);
	}
}

function staleStateTransition(
	state: ProjectionCoordinatorState,
): ProjectionCoordinatorTransition<never> | null {
	const head = coordinatorHeads.get(state.coordinatorId);
	if (head === undefined) {
		return stop("invalid-state", "projection coordinator head is unavailable");
	}
	if (head !== state) {
		return transitionError({
			state: head,
			code: "stale-state",
			message: "projection coordinator state is not the current head",
		});
	}
	return null;
}

function staleStateTarget(
	state: ProjectionCoordinatorState,
): ProjectionCoordinatorTargetResult | null {
	const head = coordinatorHeads.get(state.coordinatorId);
	if (head === undefined) {
		return stop("invalid-state", "projection coordinator head is unavailable");
	}
	if (head !== state) {
		return targetError({
			code: "stale-state",
			message: "projection coordinator state is not the current head",
		});
	}
	return null;
}

function priorProjectionSha256(
	state: ProjectionCoordinatorState,
): Sha256Digest | null {
	if (state.availability.kind === "current") {
		return state.availability.projection.projectionSha256;
	}
	if (state.availability.kind === "refreshing") {
		return state.availability.priorProjectionSha256;
	}
	return null;
}

export function beginProjectionRefresh(
	input: BeginProjectionRefreshInput,
): ProjectionCoordinatorTransition<ProjectionRefreshTicket> {
	const state = verifyProjectionCoordinatorState(input.state);
	const stale = staleStateTransition(state);
	if (stale !== null) return stale;
	const requestSequence = nextSequence(state.lastRequestSequence);
	const transitionSequence = nextSequence(state.transitionSequence);
	const ticket = createTicket({
		coordinatorId: state.coordinatorId,
		requestSequence,
		requestedRevisionSha256: revisionSha256(input.requestedRevisionSha256),
		priorProjectionSha256: priorProjectionSha256(state),
	});
	return success({
		state: createState({
			coordinatorId: state.coordinatorId,
			transitionSequence,
			lastRequestSequence: requestSequence,
			availability: refreshing({ ticket }),
		}),
		value: ticket,
	});
}

function activeTicketError(input: {
	readonly state: ProjectionCoordinatorState;
	readonly ticket: ProjectionRefreshTicket;
}): ProjectionCoordinatorTransition<never> | null {
	if (input.ticket.coordinatorId !== input.state.coordinatorId) {
		return transitionError({
			state: input.state,
			code: "foreign-ticket",
			message: "projection refresh ticket belongs to another coordinator",
		});
	}
	if (
		input.state.availability.kind !== "refreshing" ||
		input.state.availability.ticket !== input.ticket
	) {
		return transitionError({
			state: input.state,
			code: "stale-ticket",
			message: "projection refresh ticket is not the active latest ticket",
		});
	}
	return null;
}

export function completeProjectionRefresh(
	input: CompleteProjectionRefreshInput,
): ProjectionCoordinatorTransition<ProjectionPublication> {
	const state = verifyProjectionCoordinatorState(input.state);
	const stale = staleStateTransition(state);
	if (stale !== null) return stale;
	const ticket = verifyProjectionRefreshTicket(input.ticket);
	const projection = verifiedProjection(input.projection);
	const inactive = activeTicketError({ state, ticket });
	if (inactive !== null) return inactive;
	const publication = createPublication({ ticket, projection });
	return success({
		state: createState({
			coordinatorId: state.coordinatorId,
			transitionSequence: nextSequence(state.transitionSequence),
			lastRequestSequence: state.lastRequestSequence,
			availability: current({ publication, projection }),
		}),
		value: publication,
	});
}

export function failProjectionRefresh(
	input: FailProjectionRefreshInput,
): ProjectionCoordinatorTransition<null> {
	const state = verifyProjectionCoordinatorState(input.state);
	const stale = staleStateTransition(state);
	if (stale !== null) return stale;
	const ticket = verifyProjectionRefreshTicket(input.ticket);
	const inactive = activeTicketError({ state, ticket });
	if (inactive !== null) return inactive;
	return success({
		state: createState({
			coordinatorId: state.coordinatorId,
			transitionSequence: nextSequence(state.transitionSequence),
			lastRequestSequence: state.lastRequestSequence,
			availability: unavailable({
				reason: "refresh-failed",
				lastRequestedRevisionSha256: ticket.requestedRevisionSha256,
			}),
		}),
		value: null,
	});
}

export function projectionReadTarget(
	input: ProjectionReadTargetInput,
): ProjectionCoordinatorTargetResult {
	const state = verifyProjectionCoordinatorState(input.state);
	const stale = staleStateTarget(state);
	if (stale !== null) return stale;
	if (state.availability.kind === "unavailable") {
		return targetError({
			code: "projection-unavailable",
			message: "projection coordinator has no current projection",
		});
	}
	if (state.availability.kind === "refreshing") {
		return Object.freeze({
			ok: true,
			target: Object.freeze({
				kind: "refreshing",
				requestedRevisionSha256: state.availability.requestedRevisionSha256,
				priorProjectionSha256: state.availability.priorProjectionSha256,
			}),
		});
	}
	if (input.publication === null) {
		return targetError({
			code: "stale-publication",
			message: "current projection requires its exact publication",
		});
	}
	const publication = verifyProjectionPublication(input.publication);
	if (publication !== state.availability.publication) {
		return targetError({
			code: "stale-publication",
			message: "projection publication is not current",
		});
	}
	return Object.freeze({
		ok: true,
		target: Object.freeze({
			kind: "current",
			projection: state.availability.projection,
		}),
	});
}
