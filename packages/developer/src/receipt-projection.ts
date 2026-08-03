import {
	canonicalValueSha256,
	type DeveloperEventRef,
	type DeveloperId,
	type Sha256Digest,
} from "./runtime-protocol.ts";
import {
	verifyAcceptedDeveloperEvent,
	type AcceptedDeveloperEvent,
	type RuntimeReplayEvent,
	type RuntimeReplayEventKind,
} from "./runtime-replay.ts";

export const MAX_RECEIPT_PAGE_SIZE = 100 as const;

const RECEIPT_KIND_COVERAGE = Object.freeze({
	"work-scope-opened": true,
	"work-scope-closed": true,
	"change-authorized": true,
	"implementation-landing-recorded": true,
	"route-frame-opened": true,
	"route-frame-replaced": true,
	"routing-snapshot-opened": true,
	"routing-page-accounted": true,
	"routing-coverage-completed": true,
	"can-serve-basis-created": true,
	"ready-assignment-recorded": true,
	"skill-invocation-started": true,
	"invocation-settled": true,
	"support-observed": true,
	"frame-contribution-admitted": true,
	"frame-blocker-resolved": true,
	"obligation-discharged": true,
	"route-frame-concluded": true,
} satisfies Readonly<Record<RuntimeReplayEventKind, true>>);

export type ReceiptProjectionErrorCode =
	| "invalid-input"
	| "unaccepted-event"
	| "noncanonical-event-order"
	| "duplicate-event-id"
	| "invalid-projection"
	| "projection-refreshing"
	| "invalid-cursor"
	| "stale-cursor"
	| "invalid-page"
	| "stale-page";

const RECEIPT_PROJECTION_ERROR_CODES: ReadonlySet<string> = new Set([
	"invalid-input",
	"unaccepted-event",
	"noncanonical-event-order",
	"duplicate-event-id",
	"invalid-projection",
	"projection-refreshing",
	"invalid-cursor",
	"stale-cursor",
	"invalid-page",
	"stale-page",
] satisfies readonly ReceiptProjectionErrorCode[]);

export interface ReceiptProjectionError {
	readonly projectionError: true;
	readonly code: ReceiptProjectionErrorCode;
	readonly message: string;
}

export function isReceiptProjectionError(
	value: unknown,
): value is ReceiptProjectionError {
	return (
		typeof value === "object" &&
		value !== null &&
		"projectionError" in value &&
		value.projectionError === true &&
		"code" in value &&
		typeof value.code === "string" &&
		RECEIPT_PROJECTION_ERROR_CODES.has(value.code) &&
		"message" in value &&
		typeof value.message === "string"
	);
}

interface ReceiptEventFields {
	readonly eventRef: DeveloperEventRef;
	readonly storedIndex: number;
	readonly scopeSequence: number;
}

interface WorkScopeOpenedReceiptBody {
	readonly kind: "work-scope-opened";
	readonly workScopeId: DeveloperId;
}

interface WorkScopeClosedReceiptBody {
	readonly kind: "work-scope-closed";
	readonly workScopeId: DeveloperId;
	readonly reasonSha256: Sha256Digest;
}

interface ChangeAuthorizedReceiptBody {
	readonly kind: "change-authorized";
	readonly authorizationId: DeveloperId;
	readonly frameId: DeveloperId;
	readonly frameRevision: number;
	readonly conclusionSha256: Sha256Digest;
	readonly authorizationSha256: Sha256Digest;
}

interface ImplementationLandingRecordedReceiptBody {
	readonly kind: "implementation-landing-recorded";
	readonly landingId: DeveloperId;
	readonly authorizationId: DeveloperId;
	readonly changedPathCount: number;
	readonly changedPathsSha256: Sha256Digest;
	readonly verificationCount: number;
	readonly verificationSha256: Sha256Digest;
	readonly rerouteFrameId: DeveloperId;
	readonly verificationFrameId: DeveloperId;
	readonly landingSha256: Sha256Digest;
}

interface RouteFrameReceiptBody {
	readonly kind: "route-frame-opened" | "route-frame-replaced";
	readonly frameId: DeveloperId;
	readonly frameRevision: number;
	readonly parentFrameId: DeveloperId | null;
	readonly routeDefinitionId: DeveloperId;
	readonly obligationCount: number;
	readonly obligationSetSha256: Sha256Digest;
}

interface RoutingSnapshotOpenedReceiptBody {
	readonly kind: "routing-snapshot-opened";
	readonly snapshotId: DeveloperId;
	readonly frameId: DeveloperId;
	readonly frameRevision: number;
	readonly candidateCount: number;
	readonly pageCount: number;
	readonly orderedPagesRootSha256: Sha256Digest;
	readonly replacesSnapshotId: DeveloperId | null;
}

interface RoutingPageAccountedReceiptBody {
	readonly kind: "routing-page-accounted";
	readonly snapshotId: DeveloperId;
	readonly pageIndex: number;
	readonly candidateCount: number;
	readonly dispositionCount: number;
	readonly pageSha256: Sha256Digest;
}

interface RoutingCoverageCompletedReceiptBody {
	readonly kind: "routing-coverage-completed";
	readonly snapshotId: DeveloperId;
	readonly coverageSha256: Sha256Digest;
}

interface CanServeBasisCreatedReceiptBody {
	readonly kind: "can-serve-basis-created";
	readonly snapshotId: DeveloperId;
	readonly basisId: DeveloperId;
	readonly candidateId: DeveloperId;
	readonly targetCount: number;
	readonly basisSha256: Sha256Digest;
}

interface ReadyAssignmentRecordedReceiptBody {
	readonly kind: "ready-assignment-recorded";
	readonly assignmentId: DeveloperId;
	readonly basisId: DeveloperId;
	readonly skillCapabilityId: DeveloperId;
	readonly parentFrameId: DeveloperId;
	readonly targetCount: number;
	readonly assignmentRevisionSha256: Sha256Digest;
}

interface SkillInvocationStartedReceiptBody {
	readonly kind: "skill-invocation-started";
	readonly invocationId: DeveloperId;
	readonly assignmentId: DeveloperId;
}

export type InvocationReceiptOutcome =
	| "returned-contribution"
	| "returned-dependency"
	| "returned-not-applicable"
	| "returned-needs-context"
	| "returned-abort"
	| "capability-resolver-error"
	| "capability-invalid-or-silent-return"
	| "capability-timeout"
	| "lifecycle-cancelled"
	| "lifecycle-superseded"
	| "lifecycle-stale";

interface InvocationSettledReceiptBody {
	readonly kind: "invocation-settled";
	readonly invocationId: DeveloperId;
	readonly assignmentId: DeveloperId;
	readonly outcome: InvocationReceiptOutcome;
}

interface SupportObservedReceiptBody {
	readonly kind: "support-observed";
	readonly supportId: DeveloperId;
	readonly sourceKind: string;
	readonly sourceId: DeveloperId;
	readonly sourceRevisionSha256: Sha256Digest;
	readonly supportSha256: Sha256Digest;
}

interface FrameContributionAdmittedReceiptBody {
	readonly kind: "frame-contribution-admitted";
	readonly contributionId: DeveloperId;
	readonly frameId: DeveloperId;
	readonly frameRevision: number;
	readonly sourceKind: string;
	readonly sourceId: DeveloperId;
	readonly sourceRevisionSha256: Sha256Digest;
	readonly targetCount: number;
	readonly proposalSha256: Sha256Digest;
	readonly admissionBasisSha256: Sha256Digest;
}

interface FrameBlockerResolvedReceiptBody {
	readonly kind: "frame-blocker-resolved";
	readonly frameId: DeveloperId;
	readonly blockerId: DeveloperId;
	readonly resolutionBasisSha256: Sha256Digest;
}

interface ObligationDischargedReceiptBody {
	readonly kind: "obligation-discharged";
	readonly dischargeId: DeveloperId;
	readonly frameId: DeveloperId;
	readonly frameRevision: number;
	readonly obligationId: DeveloperId;
	readonly contributionCount: number;
}

interface RouteFrameConcludedReceiptBody {
	readonly kind: "route-frame-concluded";
	readonly frameId: DeveloperId;
	readonly frameRevision: number;
	readonly dischargeCount: number;
	readonly blockerSetSha256: Sha256Digest;
	readonly conclusionSha256: Sha256Digest;
}

export type DeveloperReceiptBody =
	| WorkScopeOpenedReceiptBody
	| WorkScopeClosedReceiptBody
	| ChangeAuthorizedReceiptBody
	| ImplementationLandingRecordedReceiptBody
	| RouteFrameReceiptBody
	| RoutingSnapshotOpenedReceiptBody
	| RoutingPageAccountedReceiptBody
	| RoutingCoverageCompletedReceiptBody
	| CanServeBasisCreatedReceiptBody
	| ReadyAssignmentRecordedReceiptBody
	| SkillInvocationStartedReceiptBody
	| InvocationSettledReceiptBody
	| SupportObservedReceiptBody
	| FrameContributionAdmittedReceiptBody
	| FrameBlockerResolvedReceiptBody
	| ObligationDischargedReceiptBody
	| RouteFrameConcludedReceiptBody;

const receiptBrand: unique symbol = Symbol("DeveloperReceipt");

export type DeveloperReceipt = Readonly<
	DeveloperReceiptBody &
		ReceiptEventFields & {
			readonly receiptSha256: Sha256Digest;
			readonly [receiptBrand]: true;
		}
>;

const projectionBrand: unique symbol = Symbol("ReceiptProjection");

export interface ReceiptProjection {
	readonly projectionSha256: Sha256Digest;
	readonly orderedReceiptRootSha256: Sha256Digest;
	readonly receiptCount: number;
	readonly firstEventRef: DeveloperEventRef | null;
	readonly lastEventRef: DeveloperEventRef | null;
	readonly [projectionBrand]: true;
}

const projectionRefBrand: unique symbol = Symbol("ReceiptProjectionRef");

export interface ReceiptProjectionRef {
	readonly projectionSha256: Sha256Digest;
	readonly ordinal: number;
	readonly eventRef: DeveloperEventRef;
	readonly receiptSha256: Sha256Digest;
	readonly refSha256: Sha256Digest;
	readonly [projectionRefBrand]: true;
}

export interface ProjectedReceipt {
	readonly ref: ReceiptProjectionRef;
	readonly receipt: DeveloperReceipt;
}

const cursorBrand: unique symbol = Symbol("ReceiptPageCursor");

export interface ReceiptPageCursor {
	readonly projectionSha256: Sha256Digest;
	readonly nextOrdinal: number;
	readonly cursorSha256: Sha256Digest;
	readonly [cursorBrand]: true;
}

const pageBrand: unique symbol = Symbol("ReceiptPage");

export interface ReceiptPage {
	readonly projectionSha256: Sha256Digest;
	readonly startOrdinal: number;
	readonly entries: readonly ProjectedReceipt[];
	readonly nextCursor: ReceiptPageCursor | null;
	readonly pageSha256: Sha256Digest;
	readonly [pageBrand]: true;
}

export type ReceiptProjectionReadTarget =
	| Readonly<{
			kind: "current";
			projection: ReceiptProjection;
	  }>
	| Readonly<{
			kind: "refreshing";
			requestedRevisionSha256: Sha256Digest;
			priorProjectionSha256: Sha256Digest | null;
	  }>;

export interface ReceiptPageRequest {
	readonly cursor: ReceiptPageCursor | null;
	readonly pageSize: number;
}

const receiptValues = new WeakSet<object>();
const projectionValues = new WeakSet<object>();
const projectionEntries = new WeakMap<
	ReceiptProjection,
	readonly ProjectedReceipt[]
>();
const cursorValues = new WeakSet<object>();
const pageValues = new WeakSet<object>();

function stop(
	...input: readonly [code: ReceiptProjectionErrorCode, message: string]
): never {
	const [code, message] = input;
	throw Object.freeze({
		projectionError: true,
		code,
		message,
	} satisfies ReceiptProjectionError);
}

function eventRef(event: AcceptedDeveloperEvent): DeveloperEventRef {
	return Object.freeze({
		workScopeId: event.envelope.workScopeId,
		eventId: event.envelope.eventId,
		eventSha256: event.envelope.eventSha256,
	});
}

function invocationOutcome(
	event: Extract<RuntimeReplayEvent, { readonly kind: "invocation-settled" }>,
): InvocationReceiptOutcome {
	const settlement = event.settlement;
	if (settlement.kind === "returned") {
		if (settlement.value.kind === "contribution")
			return "returned-contribution";
		if (settlement.value.kind === "dependency") return "returned-dependency";
		if (settlement.value.kind === "not-applicable")
			return "returned-not-applicable";
		if (settlement.value.kind === "needs-context")
			return "returned-needs-context";
		return "returned-abort";
	}
	if (settlement.kind === "capability-failed") {
		if (settlement.failure.kind === "resolver-error") {
			return "capability-resolver-error";
		}
		if (settlement.failure.kind === "invalid-or-silent-return") {
			return "capability-invalid-or-silent-return";
		}
		return "capability-timeout";
	}
	if (settlement.lifecycle.kind === "cancelled") return "lifecycle-cancelled";
	if (settlement.lifecycle.kind === "superseded") return "lifecycle-superseded";
	return "lifecycle-stale";
}

function scopeFrameReceiptBody(
	event: RuntimeReplayEvent,
	accepted: AcceptedDeveloperEvent,
): DeveloperReceiptBody | undefined {
	if (event.kind === "work-scope-opened") {
		return Object.freeze({
			kind: "work-scope-opened",
			workScopeId: accepted.envelope.workScopeId,
		});
	}
	if (event.kind === "work-scope-closed") {
		return Object.freeze({
			kind: "work-scope-closed",
			workScopeId: accepted.envelope.workScopeId,
			reasonSha256: event.closure.reasonSha256,
		});
	}
	if (event.kind === "change-authorized") {
		return Object.freeze({
			kind: "change-authorized",
			authorizationId: event.authorization.authorizationId,
			frameId: event.authorization.frameId,
			frameRevision: event.authorization.frameRevision,
			conclusionSha256: event.authorization.conclusionSha256,
			authorizationSha256: event.authorization.authorizationSha256,
		});
	}
	if (event.kind === "implementation-landing-recorded") {
		return Object.freeze({
			kind: "implementation-landing-recorded",
			landingId: event.landing.landingId,
			authorizationId: event.landing.authorizationId,
			changedPathCount: event.landing.changedPaths.length,
			changedPathsSha256: event.landing.changedPathsSha256,
			verificationCount: event.landing.verification.length,
			verificationSha256: event.landing.verificationSha256,
			rerouteFrameId: event.landing.rerouteFrameId,
			verificationFrameId: event.landing.verificationFrameId,
			landingSha256: event.landing.landingSha256,
		});
	}
	if (event.kind === "route-frame-opened") {
		return Object.freeze({
			kind: "route-frame-opened",
			frameId: event.frame.frameId,
			frameRevision: event.frame.frameRevision,
			parentFrameId: event.frame.parentFrameId,
			routeDefinitionId: event.frame.routeDefinitionId,
			obligationCount: event.obligations.length,
			obligationSetSha256: event.frame.obligationSetSha256,
		});
	}
	if (event.kind === "route-frame-replaced") {
		return Object.freeze({
			kind: "route-frame-replaced",
			frameId: event.frame.frameId,
			frameRevision: event.frame.frameRevision,
			parentFrameId: event.frame.parentFrameId,
			routeDefinitionId: event.frame.routeDefinitionId,
			obligationCount: event.obligations.length,
			obligationSetSha256: event.frame.obligationSetSha256,
		});
	}
	return undefined;
}

function routingReceiptBody(
	event: RuntimeReplayEvent,
): DeveloperReceiptBody | undefined {
	if (event.kind === "routing-snapshot-opened") {
		return Object.freeze({
			kind: "routing-snapshot-opened",
			snapshotId: event.manifest.snapshotId,
			frameId: event.basis.frameId,
			frameRevision: event.basis.frameRevision,
			candidateCount: event.manifest.candidateCount,
			pageCount: event.manifest.pageCount,
			orderedPagesRootSha256: event.manifest.orderedPageRootSha256,
			replacesSnapshotId: event.replacesSnapshotId,
		});
	}
	if (event.kind === "routing-page-accounted") {
		return Object.freeze({
			kind: "routing-page-accounted",
			snapshotId: event.page.snapshotId,
			pageIndex: event.page.pageIndex,
			candidateCount: event.page.candidates.length,
			dispositionCount: event.dispositions.length,
			pageSha256: event.page.pageSha256,
		});
	}
	if (event.kind === "routing-coverage-completed") {
		return Object.freeze({
			kind: "routing-coverage-completed",
			snapshotId: event.snapshotId,
			coverageSha256: event.expectedCoverageSha256,
		});
	}
	if (event.kind === "can-serve-basis-created") {
		return Object.freeze({
			kind: "can-serve-basis-created",
			snapshotId: event.snapshotId,
			basisId: event.body.basisId,
			candidateId: event.body.candidateId,
			targetCount: event.body.targetObligationIds.length,
			basisSha256: event.expectedBasisSha256,
		});
	}
	return undefined;
}

function invocationReceiptBody(
	event: RuntimeReplayEvent,
): DeveloperReceiptBody | undefined {
	if (event.kind === "ready-assignment-recorded") {
		return Object.freeze({
			kind: "ready-assignment-recorded",
			assignmentId: event.assignment.assignmentId,
			basisId: event.basisId,
			skillCapabilityId: event.assignment.skillCapabilityId,
			parentFrameId: event.assignment.parentFrameId,
			targetCount: event.assignment.targetObligationIds.length,
			assignmentRevisionSha256: event.assignment.assignmentRevisionSha256,
		});
	}
	if (event.kind === "skill-invocation-started") {
		return Object.freeze({
			kind: "skill-invocation-started",
			invocationId: event.invocationId,
			assignmentId: event.assignmentId,
		});
	}
	if (event.kind === "invocation-settled") {
		return Object.freeze({
			kind: "invocation-settled",
			invocationId: event.settlement.invocationId,
			assignmentId: event.settlement.assignmentId,
			outcome: invocationOutcome(event),
		});
	}
	return undefined;
}

function supportOutcomeReceiptBody(
	event: RuntimeReplayEvent,
): DeveloperReceiptBody | undefined {
	if (event.kind === "support-observed") {
		return Object.freeze({
			kind: "support-observed",
			supportId: event.support.supportId,
			sourceKind: event.support.sourceKind,
			sourceId: event.support.sourceId,
			sourceRevisionSha256: event.support.sourceRevisionSha256,
			supportSha256: event.support.supportSha256,
		});
	}
	if (event.kind === "frame-contribution-admitted") {
		return Object.freeze({
			kind: "frame-contribution-admitted",
			contributionId: event.contributionId,
			frameId: event.proposal.frameId,
			frameRevision: event.proposal.frameRevision,
			sourceKind: event.proposal.source.kind,
			sourceId: event.proposal.source.sourceId,
			sourceRevisionSha256: event.proposal.source.sourceRevisionSha256,
			targetCount: event.proposal.targetUses.length,
			proposalSha256: event.expectedProposalSha256,
			admissionBasisSha256: event.admissionBasisSha256,
		});
	}
	if (event.kind === "frame-blocker-resolved") {
		return Object.freeze({
			kind: "frame-blocker-resolved",
			frameId: event.frameId,
			blockerId: event.blockerId,
			resolutionBasisSha256: event.resolutionBasisSha256,
		});
	}
	if (event.kind === "obligation-discharged") {
		return Object.freeze({
			kind: "obligation-discharged",
			dischargeId: event.discharge.dischargeId,
			frameId: event.discharge.frameId,
			frameRevision: event.discharge.expectedFrameRevision,
			obligationId: event.discharge.obligationId,
			contributionCount: event.discharge.contributionIds.length,
		});
	}
	if (event.kind === "route-frame-concluded") {
		return Object.freeze({
			kind: "route-frame-concluded",
			frameId: event.proposal.frameId,
			frameRevision: event.proposal.expectedFrameRevision,
			dischargeCount: event.proposal.dischargeIds.length,
			blockerSetSha256: event.proposal.expectedBlockerSetSha256,
			conclusionSha256: canonicalValueSha256({
				domain: "developer/v8/route-frame-conclusion",
				proposal: event.proposal,
			}),
		});
	}
	return undefined;
}

function receiptBodyFromAccepted(
	accepted: AcceptedDeveloperEvent,
): DeveloperReceiptBody {
	const event = accepted.semanticEvent;
	if (RECEIPT_KIND_COVERAGE[event.kind] !== true) {
		return stop("invalid-input", "receipt event kind is not supported");
	}
	const body =
		scopeFrameReceiptBody(event, accepted) ??
		routingReceiptBody(event) ??
		invocationReceiptBody(event) ??
		supportOutcomeReceiptBody(event);
	if (body === undefined) {
		return stop(
			"invalid-input",
			`receipt mapping is missing for event kind: ${event.kind}`,
		);
	}
	return body;
}

function createReceipt(accepted: AcceptedDeveloperEvent): DeveloperReceipt {
	const body = receiptBodyFromAccepted(accepted);
	const fields = Object.freeze({
		...body,
		eventRef: eventRef(accepted),
		storedIndex: accepted.storedIndex,
		scopeSequence: accepted.envelope.scopeSequence,
	});
	const receipt: DeveloperReceipt = Object.freeze({
		...fields,
		receiptSha256: canonicalValueSha256({
			domain: "developer/v8/receipt",
			fields,
		}),
		[receiptBrand]: true as const,
	});
	receiptValues.add(receipt);
	return receipt;
}

function verifyAcceptedForProjection(
	value: AcceptedDeveloperEvent,
): AcceptedDeveloperEvent {
	try {
		return verifyAcceptedDeveloperEvent(value);
	} catch {
		return stop(
			"unaccepted-event",
			"receipt source was not accepted by Developer replay",
		);
	}
}

export function verifyDeveloperReceipt(
	value: DeveloperReceipt,
): DeveloperReceipt {
	if (!receiptValues.has(value)) {
		return stop(
			"invalid-input",
			"receipt was not created by this projection module",
		);
	}
	return value;
}

function advanceReceiptRoot(
	previous: Sha256Digest,
	receipt: DeveloperReceipt,
	ordinal: number,
): Sha256Digest {
	return canonicalValueSha256({
		domain: "developer/v8/receipt-root-link",
		previous,
		ordinal,
		eventRef: receipt.eventRef,
		receiptSha256: receipt.receiptSha256,
	});
}

function createProjectionRef(
	projectionSha256: Sha256Digest,
	receipt: DeveloperReceipt,
	ordinal: number,
): ReceiptProjectionRef {
	const fields = Object.freeze({
		projectionSha256,
		ordinal,
		eventRef: receipt.eventRef,
		receiptSha256: receipt.receiptSha256,
	});
	return Object.freeze({
		...fields,
		refSha256: canonicalValueSha256({
			domain: "developer/v8/receipt-projection-ref",
			fields,
		}),
		[projectionRefBrand]: true as const,
	});
}

export function createReceiptProjection(
	values: readonly AcceptedDeveloperEvent[],
): ReceiptProjection {
	if (!Array.isArray(values)) {
		return stop("invalid-input", "receipt projection input must be an array");
	}
	const receipts: DeveloperReceipt[] = [];
	const eventIds = new Set<DeveloperId>();
	let previousStoredIndex: number | null = null;
	for (const value of values) {
		const accepted = verifyAcceptedForProjection(value);
		if (eventIds.has(accepted.envelope.eventId)) {
			return stop(
				"duplicate-event-id",
				"accepted event identity occurs more than once in projection input",
			);
		}
		if (
			!Number.isInteger(accepted.storedIndex) ||
			accepted.storedIndex < 0 ||
			(previousStoredIndex !== null &&
				accepted.storedIndex <= previousStoredIndex)
		) {
			return stop(
				"noncanonical-event-order",
				"accepted events must have strictly increasing stored indexes",
			);
		}
		eventIds.add(accepted.envelope.eventId);
		previousStoredIndex = accepted.storedIndex;
		receipts.push(createReceipt(accepted));
	}
	let orderedReceiptRootSha256 = canonicalValueSha256({
		domain: "developer/v8/receipt-root-empty",
	});
	for (const [ordinal, receipt] of receipts.entries()) {
		orderedReceiptRootSha256 = advanceReceiptRoot(
			orderedReceiptRootSha256,
			receipt,
			ordinal,
		);
	}
	const firstEventRef = receipts[0]?.eventRef ?? null;
	const lastEventRef = receipts.at(-1)?.eventRef ?? null;
	const projectionFields = Object.freeze({
		orderedReceiptRootSha256,
		receiptCount: receipts.length,
		firstEventRef,
		lastEventRef,
	});
	const projection: ReceiptProjection = Object.freeze({
		...projectionFields,
		projectionSha256: canonicalValueSha256({
			domain: "developer/v8/receipt-projection",
			fields: projectionFields,
		}),
		[projectionBrand]: true as const,
	});
	const entries = receipts.map((receipt, ordinal) =>
		Object.freeze({
			ref: createProjectionRef(projection.projectionSha256, receipt, ordinal),
			receipt,
		}),
	);
	projectionValues.add(projection);
	projectionEntries.set(projection, Object.freeze(entries));
	return projection;
}

export function verifyReceiptProjection(
	value: ReceiptProjection,
): ReceiptProjection {
	if (!projectionValues.has(value) || !projectionEntries.has(value)) {
		return stop(
			"invalid-projection",
			"receipt projection was not created by this projection module",
		);
	}
	return value;
}

function projectionEntriesFor(
	projection: ReceiptProjection,
): readonly ProjectedReceipt[] {
	verifyReceiptProjection(projection);
	const entries = projectionEntries.get(projection);
	if (entries === undefined) {
		return stop(
			"invalid-projection",
			"receipt projection entries are unavailable",
		);
	}
	return entries;
}

function createCursor(
	projectionSha256: Sha256Digest,
	nextOrdinal: number,
): ReceiptPageCursor {
	const fields = Object.freeze({ projectionSha256, nextOrdinal });
	const cursor: ReceiptPageCursor = Object.freeze({
		...fields,
		cursorSha256: canonicalValueSha256({
			domain: "developer/v8/receipt-page-cursor",
			fields,
		}),
		[cursorBrand]: true as const,
	});
	cursorValues.add(cursor);
	return cursor;
}

function startOrdinal(
	projection: ReceiptProjection,
	cursor: ReceiptPageCursor | null,
): number {
	if (cursor === null) return 0;
	if (!cursorValues.has(cursor)) {
		return stop(
			"invalid-cursor",
			"receipt cursor was not created by this module",
		);
	}
	if (cursor.projectionSha256 !== projection.projectionSha256) {
		return stop("stale-cursor", "receipt cursor belongs to another projection");
	}
	if (
		!Number.isInteger(cursor.nextOrdinal) ||
		cursor.nextOrdinal <= 0 ||
		cursor.nextOrdinal >= projection.receiptCount
	) {
		return stop("invalid-cursor", "receipt cursor ordinal is not pageable");
	}
	return cursor.nextOrdinal;
}

function pageSize(value: number): number {
	if (!Number.isInteger(value) || value < 1 || value > MAX_RECEIPT_PAGE_SIZE) {
		return stop(
			"invalid-input",
			`receipt page size must be an integer from 1 to ${MAX_RECEIPT_PAGE_SIZE}`,
		);
	}
	return value;
}

export function readCurrentReceiptPage(
	target: ReceiptProjectionReadTarget,
	request: ReceiptPageRequest,
): ReceiptPage {
	if (typeof target !== "object" || target === null) {
		return stop("invalid-input", "receipt projection target is invalid");
	}
	if (typeof request !== "object" || request === null) {
		return stop("invalid-input", "receipt page request is invalid");
	}
	if (target.kind === "refreshing") {
		return stop(
			"projection-refreshing",
			"current receipt projection is refreshing",
		);
	}
	if (target.kind !== "current") {
		return stop("invalid-input", "receipt projection target kind is invalid");
	}
	const projection = verifyReceiptProjection(target.projection);
	const entries = projectionEntriesFor(projection);
	const start = startOrdinal(projection, request.cursor);
	const size = pageSize(request.pageSize);
	const end = Math.min(start + size, entries.length);
	const pageEntries = Object.freeze(entries.slice(start, end));
	const nextCursor =
		end < entries.length
			? createCursor(projection.projectionSha256, end)
			: null;
	const pageFields = Object.freeze({
		projectionSha256: projection.projectionSha256,
		startOrdinal: start,
		entryRefSha256s: Object.freeze(
			pageEntries.map((entry) => entry.ref.refSha256),
		),
		nextCursorSha256: nextCursor?.cursorSha256 ?? null,
	});
	const page: ReceiptPage = Object.freeze({
		projectionSha256: projection.projectionSha256,
		startOrdinal: start,
		entries: pageEntries,
		nextCursor,
		pageSha256: canonicalValueSha256({
			domain: "developer/v8/receipt-page",
			fields: pageFields,
		}),
		[pageBrand]: true as const,
	});
	pageValues.add(page);
	return page;
}

export function verifyReceiptPage(
	projectionInput: ReceiptProjection,
	page: ReceiptPage,
): ReceiptPage {
	const projection = verifyReceiptProjection(projectionInput);
	if (!pageValues.has(page)) {
		return stop("invalid-page", "receipt page was not created by this module");
	}
	if (page.projectionSha256 !== projection.projectionSha256) {
		return stop("stale-page", "receipt page belongs to another projection");
	}
	return page;
}

export function receiptKind(receipt: DeveloperReceipt): RuntimeReplayEventKind {
	return verifyDeveloperReceipt(receipt).kind;
}
