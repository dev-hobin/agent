import type { ContextUse } from "@hobin/judgment";

import {
	accountRoutingPage,
	beginRoutingCoverage,
	completeRoutingCoverage,
	createCandidateDisposition,
	createCanServeRoutingBasis,
	createProposedFrameContribution,
	createRoutingCandidateDescriptor,
	type CanServeRoutingBasis,
	type CanServeRoutingBasisBody,
	type CandidateDisposition,
	type CandidateDispositionKind,
	type CandidateTargetEffectKind,
	type CompletedRoutingCoverage,
	type FrameContributionSourceKind,
	type ProposedFrameContributionBody,
	type RefinementProvenance,
	type RoutingCandidateDescriptor,
	type RoutingCandidatePage,
	type RoutingCoverageState,
} from "./routing-context.ts";
import {
	DEVELOPER_RUNTIME_PROTOCOL,
	canonicalValueSha256,
	parseDeveloperEventEnvelope,
	parseDeveloperId,
	parseFrameConclusionProposal,
	parseInvocationSettlement,
	parseObligation,
	parseReadySkillAssignment,
	parseRouteFrame,
	parseSha256Digest,
	parseSnapshotBasis,
	parseSnapshotSealManifest,
	type ContributionTargetUse,
	type DeveloperEventEnvelope,
	type DeveloperEventRef,
	type DeveloperId,
	type FrameConclusionProposal,
	type InvocationSettlement,
	type Obligation,
	type ReadySkillAssignment,
	type RouteFrame,
	type Sha256Digest,
	type SnapshotBasis,
	type SnapshotSealManifest,
	type SourceRevisionRef,
} from "./runtime-protocol.ts";
import {
	authorizeRuntimeChange,
	closeRuntimeScope,
	initialRuntimeRootState,
	parseRuntimeChangeAuthorization,
	parseRuntimeImplementationLanding,
	parseRuntimeScopeClosure,
	observeRuntimeFrameConcluded,
	observeRuntimeFrameOpened,
	recordRuntimeLanding,
	type RuntimeChangeAuthorization,
	type RuntimeImplementationLanding,
	type RuntimeRootState,
	type RuntimeRootTransitionResult,
	type RuntimeScopeClosure,
} from "./runtime-root.ts";
import {
	admitFrameContribution,
	attachRoutingCoverage,
	concludeRouteFrame,
	dischargeObligation,
	initialDeveloperWorkScopeState,
	openRouteFrame,
	recordReadyAssignment,
	replaceRouteFrame,
	resolveFrameBlocker,
	runtimeFrameState,
	settleSkillInvocation,
	skillReturnSupportSha256,
	startSkillInvocation,
	type DeveloperWorkScopeState,
	type ObligationDischargeBody,
	type ParentFrameDependency,
	type RuntimeTransitionResult,
} from "./runtime-transition.ts";

export const RUNTIME_REPLAY_EVENT_KINDS = Object.freeze([
	"work-scope-opened",
	"work-scope-closed",
	"change-authorized",
	"implementation-landing-recorded",
	"route-frame-opened",
	"route-frame-replaced",
	"routing-snapshot-opened",
	"routing-page-accounted",
	"routing-coverage-completed",
	"can-serve-basis-created",
	"ready-assignment-recorded",
	"skill-invocation-started",
	"invocation-settled",
	"support-observed",
	"frame-contribution-admitted",
	"frame-blocker-resolved",
	"obligation-discharged",
	"route-frame-concluded",
] as const);

export type RuntimeReplayEventKind =
	(typeof RUNTIME_REPLAY_EVENT_KINDS)[number];

type ExternalSupportKind = Exclude<
	FrameContributionSourceKind,
	"skill-return" | "child-frame"
>;

interface WorkScopeOpenedEvent {
	readonly kind: "work-scope-opened";
}

interface WorkScopeClosedEvent {
	readonly kind: "work-scope-closed";
	readonly closure: RuntimeScopeClosure;
}

interface ChangeAuthorizedEvent {
	readonly kind: "change-authorized";
	readonly authorization: RuntimeChangeAuthorization;
}

interface ImplementationLandingRecordedEvent {
	readonly kind: "implementation-landing-recorded";
	readonly landing: RuntimeImplementationLanding;
}

interface RouteFrameOpenedEvent {
	readonly kind: "route-frame-opened";
	readonly frame: RouteFrame;
	readonly obligations: readonly Obligation[];
	readonly parentDependency: ParentFrameDependency | undefined;
}

interface RouteFrameReplacedEvent {
	readonly kind: "route-frame-replaced";
	readonly frame: RouteFrame;
	readonly obligations: readonly Obligation[];
}

interface RoutingSnapshotOpenedEvent {
	readonly kind: "routing-snapshot-opened";
	readonly basis: SnapshotBasis;
	readonly manifest: SnapshotSealManifest;
	readonly replacesSnapshotId: DeveloperId | null;
}

interface RoutingPageAccountedEvent {
	readonly kind: "routing-page-accounted";
	readonly page: RoutingCandidatePage;
	readonly dispositions: readonly CandidateDisposition[];
}

interface RoutingCoverageCompletedEvent {
	readonly kind: "routing-coverage-completed";
	readonly snapshotId: DeveloperId;
	readonly expectedCoverageSha256: Sha256Digest;
}

interface CanServeBasisCreatedEvent {
	readonly kind: "can-serve-basis-created";
	readonly snapshotId: DeveloperId;
	readonly body: CanServeRoutingBasisBody;
	readonly expectedBasisSha256: Sha256Digest;
}

interface ReadyAssignmentRecordedEvent {
	readonly kind: "ready-assignment-recorded";
	readonly assignment: ReadySkillAssignment;
	readonly basisId: DeveloperId;
}

interface SkillInvocationStartedEvent {
	readonly kind: "skill-invocation-started";
	readonly invocationId: DeveloperId;
	readonly assignmentId: DeveloperId;
}

interface InvocationSettledEvent {
	readonly kind: "invocation-settled";
	readonly settlement: InvocationSettlement;
}

export interface ObservedSupport {
	readonly supportId: DeveloperId;
	readonly sourceKind: ExternalSupportKind;
	readonly sourceId: DeveloperId;
	readonly sourceRevisionSha256: Sha256Digest;
	readonly supportSha256: Sha256Digest;
}

interface SupportObservedEvent {
	readonly kind: "support-observed";
	readonly support: ObservedSupport;
}

interface FrameContributionAdmittedEvent {
	readonly kind: "frame-contribution-admitted";
	readonly proposal: ProposedFrameContributionBody;
	readonly expectedProposalSha256: Sha256Digest;
	readonly contributionId: DeveloperId;
	readonly admissionBasisSha256: Sha256Digest;
}

interface FrameBlockerResolvedEvent {
	readonly kind: "frame-blocker-resolved";
	readonly frameId: DeveloperId;
	readonly blockerId: DeveloperId;
	readonly resolutionBasisSha256: Sha256Digest;
}

interface ObligationDischargedEvent {
	readonly kind: "obligation-discharged";
	readonly discharge: ObligationDischargeBody;
}

interface RouteFrameConcludedEvent {
	readonly kind: "route-frame-concluded";
	readonly proposal: FrameConclusionProposal;
}

export type RuntimeReplayEvent =
	| WorkScopeOpenedEvent
	| WorkScopeClosedEvent
	| ChangeAuthorizedEvent
	| ImplementationLandingRecordedEvent
	| RouteFrameOpenedEvent
	| RouteFrameReplacedEvent
	| RoutingSnapshotOpenedEvent
	| RoutingPageAccountedEvent
	| RoutingCoverageCompletedEvent
	| CanServeBasisCreatedEvent
	| ReadyAssignmentRecordedEvent
	| SkillInvocationStartedEvent
	| InvocationSettledEvent
	| SupportObservedEvent
	| FrameContributionAdmittedEvent
	| FrameBlockerResolvedEvent
	| ObligationDischargedEvent
	| RouteFrameConcludedEvent;

export type RuntimeReplayFaultCode =
	| "unsupported-protocol"
	| "invalid-envelope"
	| "duplicate-event-id"
	| "scope-not-open"
	| "scope-already-open"
	| "scope-sequence-mismatch"
	| "scope-chain-mismatch"
	| "unresolved-causal-ref"
	| "unknown-event-kind"
	| "invalid-payload"
	| "routing-state-missing"
	| "basis-missing"
	| "source-causality-missing"
	| "semantic-transition-rejected";

export interface RuntimeReplayFault {
	readonly code: RuntimeReplayFaultCode;
	readonly message: string;
}

export interface ObservedReplayIdentity {
	readonly protocolVersion?: string;
	readonly eventId?: string;
	readonly workScopeId?: string;
	readonly eventSha256?: string;
}

export interface RejectedDeveloperEntry {
	readonly kind: "rejected";
	readonly storedIndex: number;
	readonly observedIdentity: ObservedReplayIdentity;
	readonly fault: RuntimeReplayFault;
}

const acceptedEventBrand: unique symbol = Symbol("AcceptedDeveloperEvent");
const acceptedEventValues = new WeakSet<object>();
const replayResultValues = new WeakSet<object>();

export type AcceptedDeveloperEvent = Readonly<{
	storedIndex: number;
	envelope: DeveloperEventEnvelope;
	semanticEvent: RuntimeReplayEvent;
	readonly [acceptedEventBrand]: true;
}>;

export type RuntimeReplayDisposition =
	| Readonly<{
			kind: "accepted";
			storedIndex: number;
			event: AcceptedDeveloperEvent;
	  }>
	| RejectedDeveloperEntry;

export type ReplayRoutingSnapshot =
	| Readonly<{
			status: "collecting";
			snapshotId: DeveloperId;
			frameId: DeveloperId;
			frameRevision: number;
			coverage: RoutingCoverageState;
	  }>
	| Readonly<{
			status: "completed";
			snapshotId: DeveloperId;
			frameId: DeveloperId;
			frameRevision: number;
			coverage: CompletedRoutingCoverage;
	  }>;

export interface ReplaySupportRecord extends ObservedSupport {
	readonly eventRef: DeveloperEventRef;
}

export interface RuntimeReplayScope {
	readonly workScopeId: DeveloperId;
	readonly head: Readonly<{
		scopeSequence: number;
		eventRef: DeveloperEventRef;
	}>;
	readonly state: DeveloperWorkScopeState;
	readonly root: RuntimeRootState;
	readonly routingSnapshots: readonly ReplayRoutingSnapshot[];
	readonly canServeBases: readonly CanServeRoutingBasis[];
	readonly supportRecords: readonly ReplaySupportRecord[];
}

export interface RuntimeReplayResult {
	readonly scopes: readonly RuntimeReplayScope[];
	readonly acceptedEvents: readonly AcceptedDeveloperEvent[];
	readonly dispositions: readonly RuntimeReplayDisposition[];
	readonly acceptedCount: number;
	readonly rejectedCount: number;
}

export interface ReloadReconciliationProposal {
	readonly workScopeId: DeveloperId;
	readonly expectedScopeSequence: number;
	readonly previousScopeEventSha256: Sha256Digest;
	readonly causalRefs: readonly DeveloperEventRef[];
	readonly kind: "invocation-settled";
	readonly settlement: InvocationSettlement;
}

interface ReplayFaultSignal {
	readonly replayFault: true;
	readonly code: RuntimeReplayFaultCode;
	readonly message: string;
}

function stop(code: RuntimeReplayFaultCode, message: string): never {
	throw Object.freeze({
		replayFault: true,
		code,
		message,
	} satisfies ReplayFaultSignal);
}

function isReplayFault(value: unknown): value is ReplayFaultSignal {
	return (
		typeof value === "object" &&
		value !== null &&
		"replayFault" in value &&
		value.replayFault === true &&
		"code" in value &&
		typeof value.code === "string" &&
		"message" in value &&
		typeof value.message === "string"
	);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function recordAt(value: unknown, path: string): Record<string, unknown> {
	if (!isRecord(value)) stop("invalid-payload", `${path} must be an object`);
	return value;
}

function exactKeys(
	value: Record<string, unknown>,
	path: string,
	required: readonly string[],
): void {
	const keys = Object.keys(value);
	if (
		keys.length !== required.length ||
		required.some((key) => !(key in value)) ||
		keys.some((key) => !required.includes(key))
	) {
		stop("invalid-payload", `${path} has an invalid representation`);
	}
}

function stringAt(value: unknown, path: string): string {
	if (
		typeof value !== "string" ||
		value !== value.trim() ||
		value.length === 0 ||
		value.length > 4_000
	) {
		stop("invalid-payload", `${path} must be normalized bounded text`);
	}
	return value;
}

function integerAt(value: unknown, path: string): number {
	if (!Number.isInteger(value) || typeof value !== "number" || value < 0) {
		stop("invalid-payload", `${path} must be a non-negative integer`);
	}
	return value;
}

function arrayAt(value: unknown, path: string): readonly unknown[] {
	if (!Array.isArray(value) || value.length > 100) {
		stop("invalid-payload", `${path} must be a bounded array`);
	}
	return value;
}

function idAt(value: unknown, path: string): DeveloperId {
	try {
		return parseDeveloperId(value, path);
	} catch (error) {
		return stop(
			"invalid-payload",
			error instanceof Error ? error.message : `${path} is not an identifier`,
		);
	}
}

function shaAt(value: unknown, path: string): Sha256Digest {
	try {
		return parseSha256Digest(value, path);
	} catch (error) {
		return stop(
			"invalid-payload",
			error instanceof Error ? error.message : `${path} is not a SHA-256`,
		);
	}
}

function idsAt(value: unknown, path: string): readonly DeveloperId[] {
	return Object.freeze(
		arrayAt(value, path).map((entry, index) =>
			idAt(entry, `${path}[${index}]`),
		),
	);
}

function stringsAt(value: unknown, path: string): readonly string[] {
	return Object.freeze(
		arrayAt(value, path).map((entry, index) =>
			stringAt(entry, `${path}[${index}]`),
		),
	);
}

function observedIdentity(value: unknown): ObservedReplayIdentity {
	if (!isRecord(value)) return Object.freeze({});
	const identity: {
		protocolVersion?: string;
		eventId?: string;
		workScopeId?: string;
		eventSha256?: string;
	} = {};
	if (typeof value.protocolVersion === "string") {
		identity.protocolVersion = value.protocolVersion.slice(0, 160);
	}
	if (typeof value.eventId === "string")
		identity.eventId = value.eventId.slice(0, 160);
	if (typeof value.workScopeId === "string") {
		identity.workScopeId = value.workScopeId.slice(0, 160);
	}
	if (typeof value.eventSha256 === "string") {
		identity.eventSha256 = value.eventSha256.slice(0, 64);
	}
	return Object.freeze(identity);
}

function sourceRevisionAt(value: unknown, path: string): SourceRevisionRef {
	const record = recordAt(value, path);
	exactKeys(record, path, ["sourceId", "revision"]);
	return Object.freeze({
		sourceId: idAt(record.sourceId, `${path}.sourceId`),
		revision: stringAt(record.revision, `${path}.revision`),
	});
}

function refinementAt(value: unknown, path: string): RefinementProvenance {
	const record = recordAt(value, path);
	exactKeys(record, path, [
		"producerId",
		"producerRevisionSha256",
		"basisSha256",
	]);
	return Object.freeze({
		producerId: idAt(record.producerId, `${path}.producerId`),
		producerRevisionSha256: shaAt(
			record.producerRevisionSha256,
			`${path}.producerRevisionSha256`,
		),
		basisSha256: shaAt(record.basisSha256, `${path}.basisSha256`),
	});
}

function candidateDescriptorAt(
	value: unknown,
	path: string,
): RoutingCandidateDescriptor {
	const record = recordAt(value, path);
	const kind = stringAt(record.kind, `${path}.kind`);
	const common = {
		candidateId: idAt(record.candidateId, `${path}.candidateId`),
		source: sourceRevisionAt(record.source, `${path}.source`),
		subjectId: idAt(record.subjectId, `${path}.subjectId`),
		subjectRevisionSha256: shaAt(
			record.subjectRevisionSha256,
			`${path}.subjectRevisionSha256`,
		),
	};
	const expected = shaAt(record.descriptorSha256, `${path}.descriptorSha256`);
	let descriptor: RoutingCandidateDescriptor;
	if (kind === "capability") {
		exactKeys(record, path, [
			"candidateId",
			"kind",
			"source",
			"subjectId",
			"subjectRevisionSha256",
			"registryRevisionSha256",
			"descriptorSha256",
		]);
		descriptor = createRoutingCandidateDescriptor({
			...common,
			kind,
			registryRevisionSha256: shaAt(
				record.registryRevisionSha256,
				`${path}.registryRevisionSha256`,
			),
		});
	} else if (kind === "tool") {
		exactKeys(record, path, [
			"candidateId",
			"kind",
			"source",
			"subjectId",
			"subjectRevisionSha256",
			"schemaSha256",
			"descriptorSha256",
		]);
		descriptor = createRoutingCandidateDescriptor({
			...common,
			kind,
			schemaSha256: shaAt(record.schemaSha256, `${path}.schemaSha256`),
		});
	} else if (kind === "material") {
		exactKeys(record, path, [
			"candidateId",
			"kind",
			"source",
			"subjectId",
			"subjectRevisionSha256",
			"contentDescriptorSha256",
			"descriptorSha256",
		]);
		descriptor = createRoutingCandidateDescriptor({
			...common,
			kind,
			contentDescriptorSha256: shaAt(
				record.contentDescriptorSha256,
				`${path}.contentDescriptorSha256`,
			),
		});
	} else if (
		kind === "constraint" ||
		kind === "evidence" ||
		kind === "decision"
	) {
		exactKeys(record, path, [
			"candidateId",
			"kind",
			"source",
			"subjectId",
			"subjectRevisionSha256",
			"refinement",
			"descriptorSha256",
		]);
		descriptor = createRoutingCandidateDescriptor({
			...common,
			kind,
			refinement: refinementAt(record.refinement, `${path}.refinement`),
		});
	} else {
		return stop("invalid-payload", `${path}.kind is unknown`);
	}
	if (descriptor.descriptorSha256 !== expected) {
		stop("invalid-payload", `${path}.descriptorSha256 does not match`);
	}
	return descriptor;
}

function dispositionKindAt(
	value: unknown,
	path: string,
): CandidateDispositionKind {
	const kind = stringAt(value, path);
	if (
		kind === "selected-for-material" ||
		kind === "not-applicable" ||
		kind === "excluded-by-root-unless" ||
		kind === "considered-not-selected" ||
		kind === "needs-context" ||
		kind === "invalid/unavailable"
	) {
		return kind;
	}
	return stop("invalid-payload", `${path} is an unknown disposition`);
}

function targetEffectKindAt(
	value: unknown,
	path: string,
): CandidateTargetEffectKind {
	const effect = stringAt(value, path);
	if (
		effect === "selected" ||
		effect === "cleared" ||
		effect === "blocked" ||
		effect === "optional-limitation"
	) {
		return effect;
	}
	return stop("invalid-payload", `${path} is an unknown target effect`);
}

function dispositionAt(value: unknown, path: string): CandidateDisposition {
	const record = recordAt(value, path);
	exactKeys(record, path, [
		"candidateId",
		"descriptorSha256",
		"kind",
		"targetEffects",
		"rationale",
	]);
	return createCandidateDisposition({
		candidateId: idAt(record.candidateId, `${path}.candidateId`),
		descriptorSha256: shaAt(
			record.descriptorSha256,
			`${path}.descriptorSha256`,
		),
		kind: dispositionKindAt(record.kind, `${path}.kind`),
		targetEffects: arrayAt(record.targetEffects, `${path}.targetEffects`).map(
			(entry, index) => {
				const targetPath = `${path}.targetEffects[${index}]`;
				const target = recordAt(entry, targetPath);
				exactKeys(target, targetPath, ["obligationId", "effect"]);
				return Object.freeze({
					obligationId: idAt(target.obligationId, `${targetPath}.obligationId`),
					effect: targetEffectKindAt(target.effect, `${targetPath}.effect`),
				});
			},
		),
		rationale: stringAt(record.rationale, `${path}.rationale`),
	});
}

function pageAt(value: unknown, path: string): RoutingCandidatePage {
	const record = recordAt(value, path);
	exactKeys(record, path, [
		"snapshotId",
		"pageIndex",
		"candidates",
		"pageSha256",
	]);
	return Object.freeze({
		snapshotId: idAt(record.snapshotId, `${path}.snapshotId`),
		pageIndex: integerAt(record.pageIndex, `${path}.pageIndex`),
		candidates: Object.freeze(
			arrayAt(record.candidates, `${path}.candidates`).map((entry, index) =>
				candidateDescriptorAt(entry, `${path}.candidates[${index}]`),
			),
		),
		pageSha256: shaAt(record.pageSha256, `${path}.pageSha256`),
	});
}

function parentDependencyAt(
	value: unknown,
	path: string,
): ParentFrameDependency {
	const record = recordAt(value, path);
	exactKeys(record, path, ["blockerId", "targetObligationIds", "reason"]);
	return Object.freeze({
		blockerId: idAt(record.blockerId, `${path}.blockerId`),
		targetObligationIds: idsAt(
			record.targetObligationIds,
			`${path}.targetObligationIds`,
		),
		reason: stringAt(record.reason, `${path}.reason`),
	});
}

function contextUseAt(value: unknown, path: string): ContextUse {
	const useAs = stringAt(value, path);
	if (
		useAs === "constraint" ||
		useAs === "evidence" ||
		useAs === "decision" ||
		useAs === "method" ||
		useAs === "guidance"
	) {
		return useAs;
	}
	return stop("invalid-payload", `${path} is an unknown context use`);
}

function targetUsesAt(
	value: unknown,
	path: string,
): readonly ContributionTargetUse[] {
	return Object.freeze(
		arrayAt(value, path).map((entry, index) => {
			const targetPath = `${path}[${index}]`;
			const target = recordAt(entry, targetPath);
			exactKeys(target, targetPath, ["obligationId", "useAs"]);
			return Object.freeze({
				obligationId: idAt(target.obligationId, `${targetPath}.obligationId`),
				useAs: contextUseAt(target.useAs, `${targetPath}.useAs`),
			});
		}),
	);
}

function contributionSourceKindAt(
	value: unknown,
	path: string,
): FrameContributionSourceKind {
	const kind = stringAt(value, path);
	if (
		kind === "skill-return" ||
		kind === "tool-result" ||
		kind === "material" ||
		kind === "user-decision" ||
		kind === "judgment-result" ||
		kind === "child-frame"
	) {
		return kind;
	}
	return stop("invalid-payload", `${path} is an unknown contribution source`);
}

function proposalBodyAt(
	value: unknown,
	path: string,
): ProposedFrameContributionBody {
	const record = recordAt(value, path);
	exactKeys(record, path, [
		"proposalId",
		"frameId",
		"frameRevision",
		"source",
		"claim",
		"applicability",
		"targetUses",
		"limitations",
		"supportSha256",
	]);
	const sourcePath = `${path}.source`;
	const source = recordAt(record.source, sourcePath);
	exactKeys(source, sourcePath, ["kind", "sourceId", "sourceRevisionSha256"]);
	return Object.freeze({
		proposalId: idAt(record.proposalId, `${path}.proposalId`),
		frameId: idAt(record.frameId, `${path}.frameId`),
		frameRevision: integerAt(record.frameRevision, `${path}.frameRevision`),
		source: Object.freeze({
			kind: contributionSourceKindAt(source.kind, `${sourcePath}.kind`),
			sourceId: idAt(source.sourceId, `${sourcePath}.sourceId`),
			sourceRevisionSha256: shaAt(
				source.sourceRevisionSha256,
				`${sourcePath}.sourceRevisionSha256`,
			),
		}),
		claim: stringAt(record.claim, `${path}.claim`),
		applicability: stringAt(record.applicability, `${path}.applicability`),
		targetUses: targetUsesAt(record.targetUses, `${path}.targetUses`),
		limitations: stringsAt(record.limitations, `${path}.limitations`),
		supportSha256: shaAt(record.supportSha256, `${path}.supportSha256`),
	});
}

function policyAt(
	value: unknown,
	path: string,
): CanServeRoutingBasisBody["policy"] {
	const record = recordAt(value, path);
	const kind = stringAt(record.kind, `${path}.kind`);
	if (kind === "absent") {
		exactKeys(record, path, ["kind"]);
		return Object.freeze({ kind });
	}
	if (kind === "complete") {
		exactKeys(record, path, ["kind", "revisionSha256"]);
		return Object.freeze({
			kind,
			revisionSha256: shaAt(record.revisionSha256, `${path}.revisionSha256`),
		});
	}
	return stop("invalid-payload", `${path}.kind is unknown`);
}

function canServeBodyAt(
	value: unknown,
	path: string,
): CanServeRoutingBasisBody {
	const record = recordAt(value, path);
	exactKeys(record, path, [
		"basisId",
		"candidateId",
		"targetObligationIds",
		"methodRevisionSha256",
		"policy",
		"rootApplicability",
	]);
	if (record.rootApplicability !== "applicable") {
		stop("invalid-payload", `${path}.rootApplicability must be applicable`);
	}
	return Object.freeze({
		basisId: idAt(record.basisId, `${path}.basisId`),
		candidateId: idAt(record.candidateId, `${path}.candidateId`),
		targetObligationIds: idsAt(
			record.targetObligationIds,
			`${path}.targetObligationIds`,
		),
		methodRevisionSha256: shaAt(
			record.methodRevisionSha256,
			`${path}.methodRevisionSha256`,
		),
		policy: policyAt(record.policy, `${path}.policy`),
		rootApplicability: "applicable",
	});
}

function externalSupportKindAt(
	value: unknown,
	path: string,
): ExternalSupportKind {
	const kind = stringAt(value, path);
	if (
		kind === "tool-result" ||
		kind === "material" ||
		kind === "user-decision" ||
		kind === "judgment-result"
	) {
		return kind;
	}
	return stop("invalid-payload", `${path} is not external support`);
}

function supportAt(value: unknown, path: string): ObservedSupport {
	const record = recordAt(value, path);
	exactKeys(record, path, [
		"supportId",
		"sourceKind",
		"sourceId",
		"sourceRevisionSha256",
		"supportSha256",
	]);
	return Object.freeze({
		supportId: idAt(record.supportId, `${path}.supportId`),
		sourceKind: externalSupportKindAt(record.sourceKind, `${path}.sourceKind`),
		sourceId: idAt(record.sourceId, `${path}.sourceId`),
		sourceRevisionSha256: shaAt(
			record.sourceRevisionSha256,
			`${path}.sourceRevisionSha256`,
		),
		supportSha256: shaAt(record.supportSha256, `${path}.supportSha256`),
	});
}

function dischargeAt(value: unknown, path: string): ObligationDischargeBody {
	const record = recordAt(value, path);
	exactKeys(record, path, [
		"dischargeId",
		"frameId",
		"expectedFrameRevision",
		"obligationId",
		"contributionIds",
		"stopEvidence",
		"conclusion",
	]);
	return Object.freeze({
		dischargeId: idAt(record.dischargeId, `${path}.dischargeId`),
		frameId: idAt(record.frameId, `${path}.frameId`),
		expectedFrameRevision: integerAt(
			record.expectedFrameRevision,
			`${path}.expectedFrameRevision`,
		),
		obligationId: idAt(record.obligationId, `${path}.obligationId`),
		contributionIds: idsAt(record.contributionIds, `${path}.contributionIds`),
		stopEvidence: stringsAt(record.stopEvidence, `${path}.stopEvidence`),
		conclusion: stringAt(record.conclusion, `${path}.conclusion`),
	});
}

function parseScopeFrameReplayEvent(
	kind: string,
	payload: Record<string, unknown>,
	path: string,
): RuntimeReplayEvent | undefined {
	if (kind === "work-scope-opened") {
		exactKeys(payload, path, []);
		return Object.freeze({ kind: "work-scope-opened" });
	}
	if (kind === "work-scope-closed") {
		exactKeys(payload, path, ["closure"]);
		return Object.freeze({
			kind: "work-scope-closed",
			closure: parseRuntimeScopeClosure(payload.closure),
		});
	}
	if (kind === "change-authorized") {
		exactKeys(payload, path, ["authorization"]);
		return Object.freeze({
			kind: "change-authorized",
			authorization: parseRuntimeChangeAuthorization(payload.authorization),
		});
	}
	if (kind === "implementation-landing-recorded") {
		exactKeys(payload, path, ["landing"]);
		return Object.freeze({
			kind: "implementation-landing-recorded",
			landing: parseRuntimeImplementationLanding(payload.landing),
		});
	}
	if (kind === "route-frame-opened") {
		exactKeys(payload, path, ["frame", "obligations", "parentDependency"]);
		return Object.freeze({
			kind: "route-frame-opened",
			frame: parseRouteFrame(payload.frame),
			obligations: Object.freeze(
				arrayAt(payload.obligations, `${path}.obligations`).map(
					(entry, index) =>
						parseObligation(entry, `${path}.obligations[${index}]`),
				),
			),
			parentDependency:
				payload.parentDependency === null
					? undefined
					: parentDependencyAt(
							payload.parentDependency,
							`${path}.parentDependency`,
						),
		});
	}
	if (kind === "route-frame-replaced") {
		exactKeys(payload, path, ["frame", "obligations"]);
		return Object.freeze({
			kind: "route-frame-replaced",
			frame: parseRouteFrame(payload.frame),
			obligations: Object.freeze(
				arrayAt(payload.obligations, `${path}.obligations`).map(
					(entry, index) =>
						parseObligation(entry, `${path}.obligations[${index}]`),
				),
			),
		});
	}
	return undefined;
}

function parseRoutingReplayEvent(
	kind: string,
	payload: Record<string, unknown>,
	path: string,
): RuntimeReplayEvent | undefined {
	if (kind === "routing-snapshot-opened") {
		exactKeys(payload, path, ["basis", "manifest", "replacesSnapshotId"]);
		return Object.freeze({
			kind: "routing-snapshot-opened",
			basis: parseSnapshotBasis(payload.basis),
			manifest: parseSnapshotSealManifest(payload.manifest),
			replacesSnapshotId:
				payload.replacesSnapshotId === null
					? null
					: idAt(payload.replacesSnapshotId, `${path}.replacesSnapshotId`),
		});
	}
	if (kind === "routing-page-accounted") {
		exactKeys(payload, path, ["page", "dispositions"]);
		return Object.freeze({
			kind: "routing-page-accounted",
			page: pageAt(payload.page, `${path}.page`),
			dispositions: Object.freeze(
				arrayAt(payload.dispositions, `${path}.dispositions`).map(
					(entry, index) =>
						dispositionAt(entry, `${path}.dispositions[${index}]`),
				),
			),
		});
	}
	if (kind === "routing-coverage-completed") {
		exactKeys(payload, path, ["snapshotId", "expectedCoverageSha256"]);
		return Object.freeze({
			kind: "routing-coverage-completed",
			snapshotId: idAt(payload.snapshotId, `${path}.snapshotId`),
			expectedCoverageSha256: shaAt(
				payload.expectedCoverageSha256,
				`${path}.expectedCoverageSha256`,
			),
		});
	}
	if (kind === "can-serve-basis-created") {
		exactKeys(payload, path, ["snapshotId", "body", "expectedBasisSha256"]);
		return Object.freeze({
			kind: "can-serve-basis-created",
			snapshotId: idAt(payload.snapshotId, `${path}.snapshotId`),
			body: canServeBodyAt(payload.body, `${path}.body`),
			expectedBasisSha256: shaAt(
				payload.expectedBasisSha256,
				`${path}.expectedBasisSha256`,
			),
		});
	}
	return undefined;
}

function parseInvocationReplayEvent(
	kind: string,
	payload: Record<string, unknown>,
	path: string,
): RuntimeReplayEvent | undefined {
	if (kind === "ready-assignment-recorded") {
		exactKeys(payload, path, ["assignment", "basisId"]);
		return Object.freeze({
			kind: "ready-assignment-recorded",
			assignment: parseReadySkillAssignment(payload.assignment),
			basisId: idAt(payload.basisId, `${path}.basisId`),
		});
	}
	if (kind === "skill-invocation-started") {
		exactKeys(payload, path, ["invocationId", "assignmentId"]);
		return Object.freeze({
			kind: "skill-invocation-started",
			invocationId: idAt(payload.invocationId, `${path}.invocationId`),
			assignmentId: idAt(payload.assignmentId, `${path}.assignmentId`),
		});
	}
	if (kind === "invocation-settled") {
		exactKeys(payload, path, ["settlement"]);
		return Object.freeze({
			kind: "invocation-settled",
			settlement: parseInvocationSettlement(payload.settlement),
		});
	}
	return undefined;
}

function parseSupportOutcomeReplayEvent(
	kind: string,
	payload: Record<string, unknown>,
	path: string,
): RuntimeReplayEvent | undefined {
	if (kind === "support-observed") {
		exactKeys(payload, path, ["support"]);
		return Object.freeze({
			kind: "support-observed",
			support: supportAt(payload.support, `${path}.support`),
		});
	}
	if (kind === "frame-contribution-admitted") {
		exactKeys(payload, path, [
			"proposal",
			"expectedProposalSha256",
			"contributionId",
			"admissionBasisSha256",
		]);
		return Object.freeze({
			kind: "frame-contribution-admitted",
			proposal: proposalBodyAt(payload.proposal, `${path}.proposal`),
			expectedProposalSha256: shaAt(
				payload.expectedProposalSha256,
				`${path}.expectedProposalSha256`,
			),
			contributionId: idAt(payload.contributionId, `${path}.contributionId`),
			admissionBasisSha256: shaAt(
				payload.admissionBasisSha256,
				`${path}.admissionBasisSha256`,
			),
		});
	}
	if (kind === "frame-blocker-resolved") {
		exactKeys(payload, path, ["frameId", "blockerId", "resolutionBasisSha256"]);
		return Object.freeze({
			kind: "frame-blocker-resolved",
			frameId: idAt(payload.frameId, `${path}.frameId`),
			blockerId: idAt(payload.blockerId, `${path}.blockerId`),
			resolutionBasisSha256: shaAt(
				payload.resolutionBasisSha256,
				`${path}.resolutionBasisSha256`,
			),
		});
	}
	if (kind === "obligation-discharged") {
		exactKeys(payload, path, ["discharge"]);
		return Object.freeze({
			kind: "obligation-discharged",
			discharge: dischargeAt(payload.discharge, `${path}.discharge`),
		});
	}
	if (kind === "route-frame-concluded") {
		exactKeys(payload, path, ["proposal"]);
		return Object.freeze({
			kind: "route-frame-concluded",
			proposal: parseFrameConclusionProposal(payload.proposal),
		});
	}
	return undefined;
}

function parseRuntimeReplayEvent(
	envelope: DeveloperEventEnvelope,
): RuntimeReplayEvent {
	const path = `${envelope.kind}.payload`;
	const payload = recordAt(envelope.payload, path);
	const parsed =
		parseScopeFrameReplayEvent(envelope.kind, payload, path) ??
		parseRoutingReplayEvent(envelope.kind, payload, path) ??
		parseInvocationReplayEvent(envelope.kind, payload, path) ??
		parseSupportOutcomeReplayEvent(envelope.kind, payload, path);
	if (parsed === undefined) {
		return stop(
			"unknown-event-kind",
			`Unknown Developer v8 event kind: ${envelope.kind}`,
		);
	}
	return parsed;
}

interface MutableScope {
	readonly workScopeId: DeveloperId;
	readonly head: Readonly<{
		scopeSequence: number;
		eventRef: DeveloperEventRef;
	}>;
	readonly state: DeveloperWorkScopeState;
	readonly root: RuntimeRootState;
	readonly snapshots: ReadonlyMap<DeveloperId, ReplayRoutingSnapshot>;
	readonly bases: ReadonlyMap<DeveloperId, CanServeRoutingBasis>;
	readonly supports: ReadonlyMap<DeveloperId, ReplaySupportRecord>;
}

function eventRef(envelope: DeveloperEventEnvelope): DeveloperEventRef {
	return Object.freeze({
		workScopeId: envelope.workScopeId,
		eventId: envelope.eventId,
		eventSha256: envelope.eventSha256,
	});
}

function causalKey(ref: DeveloperEventRef): string {
	return `${ref.workScopeId}\u0000${ref.eventId}\u0000${ref.eventSha256}`;
}

function transitionState(
	result: RuntimeTransitionResult,
): DeveloperWorkScopeState {
	if (!result.ok) {
		stop(
			"semantic-transition-rejected",
			`${result.error.code}: ${result.error.message}`,
		);
	}
	return result.state;
}

function rootTransitionState(
	result: RuntimeRootTransitionResult,
): RuntimeRootState {
	if (!result.ok) {
		stop(
			"semantic-transition-rejected",
			`${result.error.code}: ${result.error.message}`,
		);
	}
	return result.state;
}

function cloneScope(scope: MutableScope): MutableScope {
	return {
		...scope,
		snapshots: new Map(scope.snapshots),
		bases: new Map(scope.bases),
		supports: new Map(scope.supports),
	};
}

function withState(
	scope: MutableScope,
	state: DeveloperWorkScopeState,
): MutableScope {
	return { ...scope, state };
}

function causalEvents(
	envelope: DeveloperEventEnvelope,
	acceptedIndex: ReadonlyMap<string, AcceptedDeveloperEvent>,
): readonly AcceptedDeveloperEvent[] {
	return envelope.causalRefs.map((ref) => {
		const accepted = acceptedIndex.get(causalKey(ref));
		if (accepted === undefined) {
			stop(
				"unresolved-causal-ref",
				`Causal ref is not already accepted: ${ref.workScopeId}/${ref.eventId}`,
			);
		}
		return accepted;
	});
}

function causeSupportsSha256(
	cause: AcceptedDeveloperEvent,
	sha256: Sha256Digest,
): boolean {
	if (cause.envelope.eventSha256 === sha256) return true;
	const semantic = cause.semanticEvent;
	if (semantic.kind === "support-observed") {
		return semantic.support.supportSha256 === sha256;
	}
	if (semantic.kind === "invocation-settled") {
		return skillReturnSupportSha256(semantic.settlement) === sha256;
	}
	if (semantic.kind === "route-frame-concluded") {
		return (
			canonicalValueSha256({
				domain: "developer/v8/route-frame-conclusion",
				proposal: semantic.proposal,
			}) === sha256
		);
	}
	return false;
}

function skillCauseMatches(
	event: FrameContributionAdmittedEvent,
	cause: AcceptedDeveloperEvent,
): boolean {
	const source = event.proposal.source;
	const semantic = cause.semanticEvent;
	return (
		source.kind === "skill-return" &&
		semantic.kind === "invocation-settled" &&
		semantic.settlement.invocationId === source.sourceId &&
		skillReturnSupportSha256(semantic.settlement) ===
			source.sourceRevisionSha256 &&
		event.proposal.supportSha256 === source.sourceRevisionSha256
	);
}

function childCauseMatches(
	event: FrameContributionAdmittedEvent,
	cause: AcceptedDeveloperEvent,
): boolean {
	const source = event.proposal.source;
	const semantic = cause.semanticEvent;
	if (
		source.kind !== "child-frame" ||
		semantic.kind !== "route-frame-concluded" ||
		semantic.proposal.frameId !== source.sourceId
	) {
		return false;
	}
	const conclusionSha256 = canonicalValueSha256({
		domain: "developer/v8/route-frame-conclusion",
		proposal: semantic.proposal,
	});
	return (
		conclusionSha256 === source.sourceRevisionSha256 &&
		event.proposal.supportSha256 === conclusionSha256
	);
}

function externalCauseMatches(
	event: FrameContributionAdmittedEvent,
	cause: AcceptedDeveloperEvent,
): boolean {
	const source = event.proposal.source;
	const semantic = cause.semanticEvent;
	return (
		source.kind !== "skill-return" &&
		source.kind !== "child-frame" &&
		semantic.kind === "support-observed" &&
		semantic.support.sourceKind === source.kind &&
		semantic.support.sourceId === source.sourceId &&
		semantic.support.sourceRevisionSha256 === source.sourceRevisionSha256 &&
		semantic.support.supportSha256 === event.proposal.supportSha256
	);
}

function requireContributionCausality(
	event: FrameContributionAdmittedEvent,
	causes: readonly AcceptedDeveloperEvent[],
): void {
	const sourceKind = event.proposal.source.kind;
	if (sourceKind === "skill-return") {
		if (!causes.some((cause) => skillCauseMatches(event, cause))) {
			stop(
				"source-causality-missing",
				"Skill contribution lacks its settlement causal ref",
			);
		}
		return;
	}
	if (sourceKind === "child-frame") {
		if (!causes.some((cause) => childCauseMatches(event, cause))) {
			stop(
				"source-causality-missing",
				"Child contribution lacks its conclusion causal ref",
			);
		}
		return;
	}
	if (!causes.some((cause) => externalCauseMatches(event, cause))) {
		stop(
			"source-causality-missing",
			"External contribution lacks its support causal ref",
		);
	}
}

function authorizationCauseMatches(input: {
	readonly event: ChangeAuthorizedEvent;
	readonly cause: AcceptedDeveloperEvent;
	readonly workScopeId: DeveloperId;
}): boolean {
	const semantic = input.cause.semanticEvent;
	return (
		input.cause.envelope.workScopeId === input.workScopeId &&
		semantic.kind === "route-frame-concluded" &&
		semantic.proposal.frameId === input.event.authorization.frameId &&
		canonicalValueSha256({
			domain: "developer/v8/route-frame-conclusion",
			proposal: semantic.proposal,
		}) === input.event.authorization.conclusionSha256
	);
}

function landingCauseMatches(input: {
	readonly event: ImplementationLandingRecordedEvent;
	readonly cause: AcceptedDeveloperEvent;
	readonly workScopeId: DeveloperId;
}): boolean {
	const semantic = input.cause.semanticEvent;
	return (
		input.cause.envelope.workScopeId === input.workScopeId &&
		semantic.kind === "change-authorized" &&
		semantic.authorization.authorizationId ===
			input.event.landing.authorizationId
	);
}

function applyRootReplayEvent(input: {
	readonly scope: MutableScope;
	readonly event: RuntimeReplayEvent;
	readonly envelope: DeveloperEventEnvelope;
	readonly causes: readonly AcceptedDeveloperEvent[];
}): MutableScope | undefined {
	if (input.event.kind === "work-scope-closed") {
		return {
			...input.scope,
			root: rootTransitionState(
				closeRuntimeScope({
					root: input.scope.root,
					scope: input.scope.state,
					closure: input.event.closure,
				}),
			),
		};
	}
	if (input.event.kind === "change-authorized") {
		const event = input.event;
		if (
			!input.causes.some((cause) =>
				authorizationCauseMatches({
					event,
					cause,
					workScopeId: input.envelope.workScopeId,
				}),
			)
		) {
			return stop(
				"source-causality-missing",
				"Runtime authorization lacks its exact frame conclusion cause",
			);
		}
		return {
			...input.scope,
			root: rootTransitionState(
				authorizeRuntimeChange({
					root: input.scope.root,
					scope: input.scope.state,
					authorization: event.authorization,
				}),
			),
		};
	}
	if (input.event.kind === "implementation-landing-recorded") {
		const event = input.event;
		if (
			!input.causes.some((cause) =>
				landingCauseMatches({
					event,
					cause,
					workScopeId: input.envelope.workScopeId,
				}),
			)
		) {
			return stop(
				"source-causality-missing",
				"Runtime landing lacks its exact authorization cause",
			);
		}
		return {
			...input.scope,
			root: rootTransitionState(
				recordRuntimeLanding({
					root: input.scope.root,
					scope: input.scope.state,
					landing: event.landing,
					landingEventRef: eventRef(input.envelope),
				}),
			),
		};
	}
	return undefined;
}

function applyFrameReplayEvent(
	scope: MutableScope,
	event: RuntimeReplayEvent,
): MutableScope | undefined {
	if (event.kind === "work-scope-opened") {
		return stop("scope-already-open", "work scope is already open");
	}
	if (event.kind === "route-frame-opened") {
		return withState(
			scope,
			transitionState(
				openRouteFrame(
					scope.state,
					event.frame,
					event.obligations,
					event.parentDependency,
				),
			),
		);
	}
	if (event.kind !== "route-frame-replaced") return undefined;
	const state = transitionState(
		replaceRouteFrame(scope.state, event.frame, event.obligations),
	);
	const snapshots = new Map(scope.snapshots);
	for (const [snapshotId, snapshot] of snapshots) {
		if (snapshot.frameId === event.frame.frameId) snapshots.delete(snapshotId);
	}
	const bases = new Map(scope.bases);
	for (const [basisId, basis] of bases) {
		if (basis.frameId === event.frame.frameId) bases.delete(basisId);
	}
	return { ...scope, state, snapshots, bases };
}

function applySnapshotOpened(
	scope: MutableScope,
	event: RoutingSnapshotOpenedEvent,
): MutableScope {
	const frame = runtimeFrameState(scope.state, event.basis.frameId);
	if (
		frame === undefined ||
		frame.frame.frameRevision !== event.basis.frameRevision ||
		frame.conclusion !== null
	) {
		stop(
			"routing-state-missing",
			"routing snapshot frame is not current and open",
		);
	}
	const snapshots = new Map(scope.snapshots);
	if (event.replacesSnapshotId === null) {
		const alreadyCurrent = [...snapshots.values()].some(
			(snapshot) =>
				snapshot.frameId === event.basis.frameId &&
				snapshot.frameRevision === event.basis.frameRevision,
		);
		if (alreadyCurrent) {
			stop(
				"routing-state-missing",
				"current frame already has a routing snapshot",
			);
		}
	} else {
		const replaced = snapshots.get(event.replacesSnapshotId);
		if (
			replaced === undefined ||
			replaced.status !== "collecting" ||
			replaced.frameId !== event.basis.frameId ||
			replaced.frameRevision !== event.basis.frameRevision
		) {
			stop(
				"routing-state-missing",
				"replacement snapshot is absent, completed, or stale",
			);
		}
		snapshots.delete(event.replacesSnapshotId);
	}
	if (snapshots.has(event.manifest.snapshotId)) {
		stop("routing-state-missing", "routing snapshot identity already exists");
	}
	const coverage = beginRoutingCoverage(
		event.basis,
		event.manifest,
		frame.obligations,
	);
	snapshots.set(
		event.manifest.snapshotId,
		Object.freeze({
			status: "collecting",
			snapshotId: event.manifest.snapshotId,
			frameId: event.basis.frameId,
			frameRevision: event.basis.frameRevision,
			coverage,
		}),
	);
	return { ...scope, snapshots };
}

function applyRoutingPage(
	scope: MutableScope,
	event: RoutingPageAccountedEvent,
): MutableScope {
	const snapshot = scope.snapshots.get(event.page.snapshotId);
	if (snapshot === undefined || snapshot.status !== "collecting") {
		return stop(
			"routing-state-missing",
			"routing page snapshot is absent or completed",
		);
	}
	const coverage = accountRoutingPage(
		snapshot.coverage,
		event.page,
		event.dispositions,
	);
	const snapshots = new Map(scope.snapshots);
	snapshots.set(snapshot.snapshotId, Object.freeze({ ...snapshot, coverage }));
	return { ...scope, snapshots };
}

function applyRoutingCompletion(
	scope: MutableScope,
	event: RoutingCoverageCompletedEvent,
): MutableScope {
	const snapshot = scope.snapshots.get(event.snapshotId);
	if (snapshot === undefined || snapshot.status !== "collecting") {
		return stop(
			"routing-state-missing",
			"routing coverage snapshot is absent or completed",
		);
	}
	const coverage = completeRoutingCoverage(snapshot.coverage);
	if (coverage.coverageSha256 !== event.expectedCoverageSha256) {
		stop("routing-state-missing", "completed routing coverage hash mismatch");
	}
	const state = transitionState(
		attachRoutingCoverage(scope.state, snapshot.frameId, coverage),
	);
	const snapshots = new Map(scope.snapshots);
	snapshots.set(
		snapshot.snapshotId,
		Object.freeze({ ...snapshot, status: "completed", coverage }),
	);
	return { ...scope, state, snapshots };
}

function applyCanServeBasis(
	scope: MutableScope,
	event: CanServeBasisCreatedEvent,
): MutableScope {
	const snapshot = scope.snapshots.get(event.snapshotId);
	if (snapshot === undefined || snapshot.status !== "completed") {
		return stop(
			"routing-state-missing",
			"can-serve snapshot is absent or incomplete",
		);
	}
	const basis = createCanServeRoutingBasis(snapshot.coverage, event.body);
	if (basis.basisSha256 !== event.expectedBasisSha256) {
		stop("basis-missing", "can-serve basis hash mismatch");
	}
	if (scope.bases.has(basis.basisId)) {
		stop("basis-missing", "basis identity already exists");
	}
	const bases = new Map(scope.bases);
	bases.set(basis.basisId, basis);
	return { ...scope, bases };
}

function applyRoutingReplayEvent(
	scope: MutableScope,
	event: RuntimeReplayEvent,
): MutableScope | undefined {
	if (event.kind === "routing-snapshot-opened") {
		return applySnapshotOpened(scope, event);
	}
	if (event.kind === "routing-page-accounted") {
		return applyRoutingPage(scope, event);
	}
	if (event.kind === "routing-coverage-completed") {
		return applyRoutingCompletion(scope, event);
	}
	if (event.kind === "can-serve-basis-created") {
		return applyCanServeBasis(scope, event);
	}
	return undefined;
}

function applyInvocationReplayEvent(
	scope: MutableScope,
	event: RuntimeReplayEvent,
): MutableScope | undefined {
	if (event.kind === "ready-assignment-recorded") {
		const basis = scope.bases.get(event.basisId);
		if (basis === undefined) {
			return stop("basis-missing", "ready assignment basis is absent");
		}
		return withState(
			scope,
			transitionState(
				recordReadyAssignment(scope.state, event.assignment, basis),
			),
		);
	}
	if (event.kind === "skill-invocation-started") {
		return withState(
			scope,
			transitionState(
				startSkillInvocation(
					scope.state,
					event.invocationId,
					event.assignmentId,
				),
			),
		);
	}
	if (event.kind === "invocation-settled") {
		return withState(
			scope,
			transitionState(settleSkillInvocation(scope.state, event.settlement)),
		);
	}
	return undefined;
}

function applyObservedSupport(
	scope: MutableScope,
	event: SupportObservedEvent,
	envelope: DeveloperEventEnvelope,
): MutableScope {
	if (scope.supports.has(event.support.supportId)) {
		return stop("source-causality-missing", "support identity already exists");
	}
	const supports = new Map(scope.supports);
	supports.set(
		event.support.supportId,
		Object.freeze({ ...event.support, eventRef: eventRef(envelope) }),
	);
	return { ...scope, supports };
}

function applyContributionAdmission(
	scope: MutableScope,
	event: FrameContributionAdmittedEvent,
	causes: readonly AcceptedDeveloperEvent[],
): MutableScope {
	if (event.proposal.source.kind === "child-frame") {
		const child = runtimeFrameState(
			scope.state,
			event.proposal.source.sourceId,
		);
		if (
			child === undefined ||
			child.frame.parentFrameId !== event.proposal.frameId ||
			child.conclusion === null
		) {
			stop(
				"source-causality-missing",
				"child support source is not a concluded child of the target frame",
			);
		}
	}
	requireContributionCausality(event, causes);
	const proposal = createProposedFrameContribution(event.proposal);
	if (proposal.proposalSha256 !== event.expectedProposalSha256) {
		stop("source-causality-missing", "proposed contribution hash mismatch");
	}
	return withState(
		scope,
		transitionState(
			admitFrameContribution(
				scope.state,
				proposal,
				event.contributionId,
				event.admissionBasisSha256,
			),
		),
	);
}

function applyBlockerResolution(
	scope: MutableScope,
	event: FrameBlockerResolvedEvent,
	causes: readonly AcceptedDeveloperEvent[],
): MutableScope {
	if (
		!causes.some((cause) =>
			causeSupportsSha256(cause, event.resolutionBasisSha256),
		)
	) {
		stop(
			"source-causality-missing",
			"blocker resolution lacks an exact prior support causal ref",
		);
	}
	return withState(
		scope,
		transitionState(
			resolveFrameBlocker(
				scope.state,
				event.frameId,
				event.blockerId,
				event.resolutionBasisSha256,
			),
		),
	);
}

function applySupportOutcomeReplayEvent(
	scope: MutableScope,
	event: RuntimeReplayEvent,
	envelope: DeveloperEventEnvelope,
	causes: readonly AcceptedDeveloperEvent[],
): MutableScope | undefined {
	if (event.kind === "support-observed") {
		return applyObservedSupport(scope, event, envelope);
	}
	if (event.kind === "frame-contribution-admitted") {
		return applyContributionAdmission(scope, event, causes);
	}
	if (event.kind === "frame-blocker-resolved") {
		return applyBlockerResolution(scope, event, causes);
	}
	if (event.kind === "obligation-discharged") {
		return withState(
			scope,
			transitionState(dischargeObligation(scope.state, event.discharge)),
		);
	}
	if (event.kind === "route-frame-concluded") {
		return withState(
			scope,
			transitionState(concludeRouteFrame(scope.state, event.proposal)),
		);
	}
	return undefined;
}

function applyEvent(
	scopeInput: MutableScope,
	event: RuntimeReplayEvent,
	envelope: DeveloperEventEnvelope,
	causes: readonly AcceptedDeveloperEvent[],
): MutableScope {
	const scope = cloneScope(scopeInput);
	if (scope.root.status === "closed") {
		return stop("semantic-transition-rejected", "Runtime work scope is closed");
	}
	let next =
		applyRootReplayEvent({ scope, event, envelope, causes }) ??
		applyFrameReplayEvent(scope, event) ??
		applyRoutingReplayEvent(scope, event) ??
		applyInvocationReplayEvent(scope, event) ??
		applySupportOutcomeReplayEvent(scope, event, envelope, causes);
	if (next === undefined) {
		return stop(
			"unknown-event-kind",
			`Unhandled replay event kind: ${event.kind}`,
		);
	}
	if (event.kind === "route-frame-opened") {
		next = {
			...next,
			root: rootTransitionState(
				observeRuntimeFrameOpened({
					root: next.root,
					scope: next.state,
					frameId: event.frame.frameId,
					causalRefs: envelope.causalRefs,
				}),
			),
		};
	}
	if (event.kind === "route-frame-concluded") {
		next = {
			...next,
			root: rootTransitionState(
				observeRuntimeFrameConcluded({
					root: next.root,
					scope: next.state,
					frameId: event.proposal.frameId,
					causalRefs: envelope.causalRefs,
				}),
			),
		};
	}
	return next;
}

function openedScope(envelope: DeveloperEventEnvelope): MutableScope {
	if (
		envelope.scopeSequence !== 0 ||
		envelope.previousScopeEventSha256 !== null
	) {
		stop(
			"scope-sequence-mismatch",
			"work-scope-opened must be scope sequence zero",
		);
	}
	if (envelope.causalRefs.length !== 0) {
		stop("unresolved-causal-ref", "work-scope-opened cannot have causal refs");
	}
	return {
		workScopeId: envelope.workScopeId,
		head: Object.freeze({
			scopeSequence: envelope.scopeSequence,
			eventRef: eventRef(envelope),
		}),
		state: initialDeveloperWorkScopeState(envelope.workScopeId),
		root: initialRuntimeRootState(),
		snapshots: new Map(),
		bases: new Map(),
		supports: new Map(),
	};
}

function requireScopeHead(
	scope: MutableScope,
	envelope: DeveloperEventEnvelope,
): void {
	if (envelope.scopeSequence !== scope.head.scopeSequence + 1) {
		stop(
			"scope-sequence-mismatch",
			"scope sequence does not follow the accepted head",
		);
	}
	if (envelope.previousScopeEventSha256 !== scope.head.eventRef.eventSha256) {
		stop(
			"scope-chain-mismatch",
			"previous scope hash does not match the accepted head",
		);
	}
}

function acceptedEvent(
	storedIndex: number,
	envelope: DeveloperEventEnvelope,
	semanticEvent: RuntimeReplayEvent,
): AcceptedDeveloperEvent {
	const accepted: AcceptedDeveloperEvent = Object.freeze({
		storedIndex,
		envelope,
		semanticEvent,
		[acceptedEventBrand]: true as const,
	});
	acceptedEventValues.add(accepted);
	return accepted;
}

export function verifyAcceptedDeveloperEvent(
	value: AcceptedDeveloperEvent,
): AcceptedDeveloperEvent {
	if (!acceptedEventValues.has(value)) {
		return stop("invalid-envelope", "accepted event was not created by replay");
	}
	return value;
}

function compareIdentifiers(left: string, right: string): number {
	if (left < right) return -1;
	if (left > right) return 1;
	return 0;
}

function immutableScope(scope: MutableScope): RuntimeReplayScope {
	return Object.freeze({
		workScopeId: scope.workScopeId,
		head: scope.head,
		state: scope.state,
		root: scope.root,
		routingSnapshots: Object.freeze(
			[...scope.snapshots.values()].sort((left, right) =>
				compareIdentifiers(left.snapshotId, right.snapshotId),
			),
		),
		canServeBases: Object.freeze(
			[...scope.bases.values()].sort((left, right) =>
				compareIdentifiers(left.basisId, right.basisId),
			),
		),
		supportRecords: Object.freeze(
			[...scope.supports.values()].sort((left, right) =>
				compareIdentifiers(left.supportId, right.supportId),
			),
		),
	});
}

function protocolOf(value: unknown): string | undefined {
	if (!isRecord(value) || typeof value.protocolVersion !== "string")
		return undefined;
	return value.protocolVersion;
}

function rejection(
	storedIndex: number,
	raw: unknown,
	error: unknown,
): RejectedDeveloperEntry {
	let fault: RuntimeReplayFault;
	if (isReplayFault(error)) {
		fault = Object.freeze({
			code: error.code,
			message: error.message.slice(0, 1_000),
		});
	} else {
		fault = Object.freeze({
			code: "invalid-payload",
			message: (error instanceof Error
				? error.message
				: "invalid replay entry"
			).slice(0, 1_000),
		});
	}
	return Object.freeze({
		kind: "rejected",
		storedIndex,
		observedIdentity: observedIdentity(raw),
		fault,
	});
}

interface ReplayAccumulator {
	readonly scopes: Map<DeveloperId, MutableScope>;
	readonly acceptedByCausalRef: Map<string, AcceptedDeveloperEvent>;
	readonly acceptedByEventId: Map<DeveloperId, AcceptedDeveloperEvent>;
	readonly acceptedEvents: AcceptedDeveloperEvent[];
	readonly dispositions: RuntimeReplayDisposition[];
}

function newReplayAccumulator(): ReplayAccumulator {
	return {
		scopes: new Map(),
		acceptedByCausalRef: new Map(),
		acceptedByEventId: new Map(),
		acceptedEvents: [],
		dispositions: [],
	};
}

function parseStoredEnvelope(raw: unknown): DeveloperEventEnvelope {
	const protocol = protocolOf(raw);
	if (protocol !== undefined && protocol !== DEVELOPER_RUNTIME_PROTOCOL) {
		return stop(
			"unsupported-protocol",
			`Unsupported Developer protocol: ${protocol}`,
		);
	}
	try {
		return parseDeveloperEventEnvelope(raw);
	} catch (error) {
		return stop(
			"invalid-envelope",
			error instanceof Error ? error.message : "invalid Developer envelope",
		);
	}
}

function advanceReplayScope(
	accumulator: ReplayAccumulator,
	envelope: DeveloperEventEnvelope,
	semantic: RuntimeReplayEvent,
): MutableScope {
	const current = accumulator.scopes.get(envelope.workScopeId);
	const causes = causalEvents(envelope, accumulator.acceptedByCausalRef);
	if (current === undefined) {
		if (semantic.kind !== "work-scope-opened") {
			return stop(
				"scope-not-open",
				"first accepted scope event must open the scope",
			);
		}
		return openedScope(envelope);
	}
	requireScopeHead(current, envelope);
	const next = applyEvent(current, semantic, envelope, causes);
	return {
		...next,
		head: Object.freeze({
			scopeSequence: envelope.scopeSequence,
			eventRef: eventRef(envelope),
		}),
	};
}

interface AcceptedReplayEntryInput {
	readonly storedIndex: number;
	readonly envelope: DeveloperEventEnvelope;
	readonly semantic: RuntimeReplayEvent;
	readonly next: MutableScope;
}

function recordAcceptedEntry(
	accumulator: ReplayAccumulator,
	input: AcceptedReplayEntryInput,
): void {
	const accepted = acceptedEvent(
		input.storedIndex,
		input.envelope,
		input.semantic,
	);
	accumulator.scopes.set(input.envelope.workScopeId, input.next);
	accumulator.acceptedByEventId.set(input.envelope.eventId, accepted);
	accumulator.acceptedByCausalRef.set(
		causalKey(eventRef(input.envelope)),
		accepted,
	);
	accumulator.acceptedEvents.push(accepted);
	accumulator.dispositions.push(
		Object.freeze({
			kind: "accepted",
			storedIndex: input.storedIndex,
			event: accepted,
		}),
	);
}

function replayStoredEntry(
	accumulator: ReplayAccumulator,
	storedIndex: number,
	raw: unknown,
): void {
	try {
		const envelope = parseStoredEnvelope(raw);
		if (accumulator.acceptedByEventId.has(envelope.eventId)) {
			stop(
				"duplicate-event-id",
				`Duplicate accepted event ID: ${envelope.eventId}`,
			);
		}
		const semantic = parseRuntimeReplayEvent(envelope);
		const next = advanceReplayScope(accumulator, envelope, semantic);
		recordAcceptedEntry(accumulator, {
			storedIndex,
			envelope,
			semantic,
			next,
		});
	} catch (error) {
		accumulator.dispositions.push(rejection(storedIndex, raw, error));
	}
}

function finishReplay(accumulator: ReplayAccumulator): RuntimeReplayResult {
	const immutableScopes = [...accumulator.scopes.values()]
		.sort((left, right) =>
			compareIdentifiers(left.workScopeId, right.workScopeId),
		)
		.map(immutableScope);
	const result: RuntimeReplayResult = Object.freeze({
		scopes: Object.freeze(immutableScopes),
		acceptedEvents: Object.freeze(accumulator.acceptedEvents),
		dispositions: Object.freeze(accumulator.dispositions),
		acceptedCount: accumulator.acceptedEvents.length,
		rejectedCount:
			accumulator.dispositions.length - accumulator.acceptedEvents.length,
	});
	replayResultValues.add(result);
	return result;
}

export function replayDeveloperRuntime(
	entries: readonly unknown[],
): RuntimeReplayResult {
	const accumulator = newReplayAccumulator();
	for (const [storedIndex, raw] of entries.entries()) {
		replayStoredEntry(accumulator, storedIndex, raw);
	}
	return finishReplay(accumulator);
}

export function proposeReloadReconciliation(
	replay: RuntimeReplayResult,
): readonly ReloadReconciliationProposal[] {
	if (!replayResultValues.has(replay)) {
		return stop(
			"invalid-envelope",
			"replay result was not created by this runtime",
		);
	}
	const proposals: ReloadReconciliationProposal[] = [];
	for (const scope of replay.scopes) {
		const active = scope.state.activeInvocation;
		if (active === null) continue;
		const start = replay.acceptedEvents
			.toReversed()
			.find(
				(event) =>
					event.envelope.workScopeId === scope.workScopeId &&
					event.semanticEvent.kind === "skill-invocation-started" &&
					event.semanticEvent.invocationId === active.invocationId &&
					event.semanticEvent.assignmentId === active.assignmentId,
			);
		if (start === undefined) {
			stop(
				"semantic-transition-rejected",
				"active invocation has no accepted start event",
			);
		}
		proposals.push(
			Object.freeze({
				workScopeId: scope.workScopeId,
				expectedScopeSequence: scope.head.scopeSequence + 1,
				previousScopeEventSha256: scope.head.eventRef.eventSha256,
				causalRefs: Object.freeze([eventRef(start.envelope)]),
				kind: "invocation-settled",
				settlement: parseInvocationSettlement({
					kind: "lifecycle",
					invocationId: active.invocationId,
					assignmentId: active.assignmentId,
					lifecycle: {
						kind: "cancelled",
						reason: "Active runtime lease was unavailable after reload.",
						executionUncertain: true,
					},
				}),
			}),
		);
	}
	return Object.freeze(proposals);
}
