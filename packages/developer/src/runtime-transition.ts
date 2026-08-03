import {
	canonicalValueSha256,
	obligationSetSha256,
	parseDeveloperId,
	parseFrameConclusionProposal,
	parseInvocationSettlement,
	parseObligation,
	parseReadySkillAssignment,
	parseRouteFrame,
	parseSha256Digest,
	type DeveloperId,
	type FrameConclusionProposal,
	type InvocationSettlement,
	type Obligation,
	type ReadySkillAssignment,
	type RouteFrame,
	type Sha256Digest,
} from "./runtime-protocol.ts";
import {
	verifyCanServeRoutingBasis,
	verifyCompletedRoutingCoverage,
	verifyProposedFrameContribution,
	type CanServeRoutingBasis,
	type CompletedRoutingCoverage,
	type ProposedFrameContribution,
} from "./routing-context.ts";

export type RuntimeTransitionErrorCode =
	| "invalid-input"
	| "duplicate-identity"
	| "unknown-frame"
	| "stale-frame"
	| "frame-concluded"
	| "parent-dependency-invalid"
	| "routing-not-current"
	| "assignment-not-ready"
	| "invocation-already-active"
	| "invocation-not-active"
	| "settlement-mismatch"
	| "contribution-not-admissible"
	| "blocker-not-found"
	| "obligation-not-actionable"
	| "discharge-not-supported"
	| "conclusion-not-ready"
	| "replacement-not-ready";

export interface RuntimeTransitionError {
	readonly code: RuntimeTransitionErrorCode;
	readonly message: string;
}

export type RuntimeTransitionResult =
	| Readonly<{ ok: true; state: DeveloperWorkScopeState }>
	| Readonly<{ ok: false; error: RuntimeTransitionError }>;

interface RuntimeFault {
	readonly runtimeFault: true;
	readonly code: RuntimeTransitionErrorCode;
	readonly message: string;
}

const RUNTIME_ERROR_CODES = new Set<string>([
	"invalid-input",
	"duplicate-identity",
	"unknown-frame",
	"stale-frame",
	"frame-concluded",
	"parent-dependency-invalid",
	"routing-not-current",
	"assignment-not-ready",
	"invocation-already-active",
	"invocation-not-active",
	"settlement-mismatch",
	"contribution-not-admissible",
	"blocker-not-found",
	"obligation-not-actionable",
	"discharge-not-supported",
	"conclusion-not-ready",
	"replacement-not-ready",
]);

function isRuntimeFault(value: unknown): value is RuntimeFault {
	return (
		typeof value === "object" &&
		value !== null &&
		"runtimeFault" in value &&
		value.runtimeFault === true &&
		"code" in value &&
		typeof value.code === "string" &&
		RUNTIME_ERROR_CODES.has(value.code) &&
		"message" in value &&
		typeof value.message === "string"
	);
}

function stop(code: RuntimeTransitionErrorCode, message: string): never {
	throw Object.freeze({
		runtimeFault: true,
		code,
		message,
	} satisfies RuntimeFault);
}

function attempt(
	state: DeveloperWorkScopeState,
	operation: () => DeveloperWorkScopeState,
): RuntimeTransitionResult {
	try {
		assertKnownWorkScopeState(state);
		return Object.freeze({ ok: true, state: operation() });
	} catch (error) {
		if (isRuntimeFault(error)) {
			return Object.freeze({
				ok: false,
				error: Object.freeze({
					code: error.code,
					message: error.message,
				}),
			});
		}
		return Object.freeze({
			ok: false,
			error: Object.freeze({
				code: "invalid-input" as const,
				message:
					error instanceof Error ? error.message : "invalid runtime input",
			}),
		});
	}
}

function normalizedText(value: string, name: string): string {
	if (
		typeof value !== "string" ||
		value !== value.trim() ||
		value.length === 0 ||
		value.length > 4_000
	) {
		stop("invalid-input", `${name} must be normalized bounded text`);
	}
	return value;
}

function canonicalIds(
	values: readonly DeveloperId[],
	name: string,
	options: { readonly nonEmpty?: boolean } = {},
): readonly DeveloperId[] {
	if ((options.nonEmpty && values.length === 0) || values.length > 100) {
		stop("invalid-input", `${name} has an invalid length`);
	}
	const parsed = values.map((value, index) =>
		parseDeveloperId(value, `${name}[${index}]`),
	);
	for (let index = 1; index < parsed.length; index += 1) {
		if ((parsed[index - 1] ?? "") >= (parsed[index] ?? "")) {
			stop("invalid-input", `${name} must be unique and in canonical order`);
		}
	}
	return Object.freeze(parsed);
}

function sameIds(
	left: readonly DeveloperId[],
	right: readonly DeveloperId[],
): boolean {
	return (
		left.length === right.length &&
		left.every((value, index) => value === right[index])
	);
}

function subsetOf(
	values: readonly DeveloperId[],
	allowed: readonly DeveloperId[],
): boolean {
	const allowedSet = new Set(allowed);
	return values.every((value) => allowedSet.has(value));
}

function compareIdentifiers(left: string, right: string): number {
	if (left < right) return -1;
	if (left > right) return 1;
	return 0;
}

export type RuntimeBlockerKind =
	| "child-frame"
	| "dependency"
	| "needs-context"
	| "capability-failure";

export interface RuntimeBlocker {
	readonly blockerId: DeveloperId;
	readonly frameId: DeveloperId;
	readonly kind: RuntimeBlockerKind;
	readonly sourceId: DeveloperId;
	readonly targetObligationIds: readonly DeveloperId[];
	readonly detailsSha256: Sha256Digest;
}

export interface ParentFrameDependency {
	readonly blockerId: DeveloperId;
	readonly targetObligationIds: readonly DeveloperId[];
	readonly reason: string;
}

export interface AdmittedContribution {
	readonly contributionId: DeveloperId;
	readonly proposal: ProposedFrameContribution;
	readonly admissionBasisSha256: Sha256Digest;
	readonly admissionSha256: Sha256Digest;
}

export interface ObligationDischargeBody {
	readonly dischargeId: DeveloperId;
	readonly frameId: DeveloperId;
	readonly expectedFrameRevision: number;
	readonly obligationId: DeveloperId;
	readonly contributionIds: readonly DeveloperId[];
	readonly stopEvidence: readonly string[];
	readonly conclusion: string;
}

export interface ObligationDischarge extends ObligationDischargeBody {
	readonly dischargeSha256: Sha256Digest;
}

export interface RuntimeFrameConclusion {
	readonly proposal: FrameConclusionProposal;
	readonly conclusionSha256: Sha256Digest;
}

export interface RuntimeFrameState {
	readonly frame: RouteFrame;
	readonly obligations: readonly Obligation[];
	readonly routing: CompletedRoutingCoverage | null;
	readonly contributions: readonly AdmittedContribution[];
	readonly discharges: readonly ObligationDischarge[];
	readonly blockers: readonly RuntimeBlocker[];
	readonly conclusion: RuntimeFrameConclusion | null;
}

export type RuntimeAssignmentState =
	| Readonly<{
			status: "ready";
			assignment: ReadySkillAssignment;
			basis: CanServeRoutingBasis;
	  }>
	| Readonly<{
			status: "active";
			assignment: ReadySkillAssignment;
			basis: CanServeRoutingBasis;
			invocationId: DeveloperId;
	  }>
	| Readonly<{
			status: "settled";
			assignment: ReadySkillAssignment;
			basis: CanServeRoutingBasis;
			invocationId: DeveloperId;
			settlement: InvocationSettlement;
	  }>;

export interface ActiveSkillInvocation {
	readonly invocationId: DeveloperId;
	readonly assignmentId: DeveloperId;
	readonly frameId: DeveloperId;
}

interface DeveloperWorkScopeFields {
	readonly workScopeId: DeveloperId;
	readonly frames: readonly RuntimeFrameState[];
	readonly assignments: readonly RuntimeAssignmentState[];
	readonly activeInvocation: ActiveSkillInvocation | null;
}

const workScopeStateBrand: unique symbol = Symbol("DeveloperWorkScopeState");
const workScopeStateValues = new WeakSet<object>();

export type DeveloperWorkScopeState = Readonly<DeveloperWorkScopeFields> & {
	readonly [workScopeStateBrand]: true;
};

function assertKnownWorkScopeState(state: DeveloperWorkScopeState): void {
	if (!workScopeStateValues.has(state)) {
		stop("invalid-input", "work-scope state was not created by this runtime");
	}
}

function freezeState(
	fields: DeveloperWorkScopeFields,
): DeveloperWorkScopeState {
	const state: DeveloperWorkScopeState = Object.freeze({
		...fields,
		[workScopeStateBrand]: true as const,
	});
	workScopeStateValues.add(state);
	return state;
}

export function initialDeveloperWorkScopeState(
	workScopeIdInput: DeveloperId,
): DeveloperWorkScopeState {
	return freezeState({
		workScopeId: parseDeveloperId(workScopeIdInput, "workScopeId"),
		frames: Object.freeze([]),
		assignments: Object.freeze([]),
		activeInvocation: null,
	});
}

export function runtimeFrameState(
	state: DeveloperWorkScopeState,
	frameId: DeveloperId,
): RuntimeFrameState | undefined {
	assertKnownWorkScopeState(state);
	return state.frames.find((entry) => entry.frame.frameId === frameId);
}

function requiredFrame(
	state: DeveloperWorkScopeState,
	frameId: DeveloperId,
): RuntimeFrameState {
	const frame = runtimeFrameState(state, frameId);
	if (frame === undefined) stop("unknown-frame", `Unknown frame: ${frameId}`);
	return frame;
}

function openFrame(
	state: DeveloperWorkScopeState,
	frameId: DeveloperId,
): RuntimeFrameState {
	const frame = requiredFrame(state, frameId);
	if (frame.conclusion !== null) {
		stop("frame-concluded", `Frame is already concluded: ${frameId}`);
	}
	return frame;
}

function updateFrame(
	state: DeveloperWorkScopeState,
	frameId: DeveloperId,
	update: (frame: RuntimeFrameState) => RuntimeFrameState,
): DeveloperWorkScopeState {
	return freezeState({
		...state,
		frames: Object.freeze(
			state.frames.map((frame) =>
				frame.frame.frameId === frameId ? update(frame) : frame,
			),
		),
	});
}

function immutableFrame(
	frame: RouteFrame,
	obligations: readonly Obligation[],
): RuntimeFrameState {
	return Object.freeze({
		frame,
		obligations: Object.freeze(obligations),
		routing: null,
		contributions: Object.freeze([]),
		discharges: Object.freeze([]),
		blockers: Object.freeze([]),
		conclusion: null,
	});
}

function refinedFrameAndObligations(
	uncheckedFrame: RouteFrame,
	uncheckedObligations: readonly Obligation[],
): Readonly<{ frame: RouteFrame; obligations: readonly Obligation[] }> {
	const frame = parseRouteFrame(uncheckedFrame);
	const obligations = Object.freeze(
		uncheckedObligations.map((obligation, index) =>
			parseObligation(obligation, `obligations[${index}]`),
		),
	);
	if (
		obligationSetSha256(obligations) !== frame.obligationSetSha256 ||
		!sameIds(
			obligations.map((obligation) => obligation.obligationId),
			frame.obligationIds,
		) ||
		obligations.some((obligation) => obligation.frameId !== frame.frameId)
	) {
		stop("invalid-input", "frame obligations do not match the frame identity");
	}
	return Object.freeze({ frame, obligations });
}

interface RuntimeBlockerBody {
	readonly frameId: DeveloperId;
	readonly kind: RuntimeBlockerKind;
	readonly sourceId: DeveloperId;
	readonly blockerId: DeveloperId;
	readonly targetObligationIds: readonly DeveloperId[];
	readonly details: unknown;
}

function createRuntimeBlocker(value: RuntimeBlockerBody): RuntimeBlocker {
	return Object.freeze({
		blockerId: parseDeveloperId(value.blockerId, "blockerId"),
		frameId: value.frameId,
		kind: value.kind,
		sourceId: parseDeveloperId(value.sourceId, "blocker.sourceId"),
		targetObligationIds: canonicalIds(
			value.targetObligationIds,
			"blocker.targetObligationIds",
			{ nonEmpty: true },
		),
		detailsSha256: canonicalValueSha256({
			domain: "developer/v8/runtime-blocker",
			details: value.details,
		}),
	});
}

function addBlocker(
	frame: RuntimeFrameState,
	value: RuntimeBlocker,
): RuntimeFrameState {
	if (frame.blockers.some((entry) => entry.blockerId === value.blockerId)) {
		stop("duplicate-identity", `Duplicate blocker: ${value.blockerId}`);
	}
	if (
		!subsetOf(
			value.targetObligationIds,
			frame.obligations.map((obligation) => obligation.obligationId),
		)
	) {
		stop(
			"parent-dependency-invalid",
			"blocker targets are not current obligations",
		);
	}
	return Object.freeze({
		...frame,
		blockers: Object.freeze([...frame.blockers, value]),
	});
}

export function openRouteFrame(
	state: DeveloperWorkScopeState,
	uncheckedFrame: RouteFrame,
	uncheckedObligations: readonly Obligation[],
	parentDependency?: ParentFrameDependency,
): RuntimeTransitionResult {
	return attempt(state, () => {
		const { frame, obligations } = refinedFrameAndObligations(
			uncheckedFrame,
			uncheckedObligations,
		);
		if (frame.workScopeId !== state.workScopeId) {
			stop("stale-frame", "frame belongs to another work scope");
		}
		if (runtimeFrameState(state, frame.frameId) !== undefined) {
			stop("duplicate-identity", `Duplicate frame: ${frame.frameId}`);
		}
		let next = state;
		if (frame.parentFrameId === null) {
			if (parentDependency !== undefined) {
				stop(
					"parent-dependency-invalid",
					"root frame cannot have parent dependency",
				);
			}
		} else {
			if (parentDependency === undefined) {
				stop(
					"parent-dependency-invalid",
					"child frame requires parent dependency",
				);
			}
			const parent = openFrame(state, frame.parentFrameId);
			const targets = canonicalIds(
				parentDependency.targetObligationIds,
				"parentDependency.targetObligationIds",
				{ nonEmpty: true },
			);
			if (
				!subsetOf(targets, actionableObligationIds(state, parent.frame.frameId))
			) {
				stop(
					"parent-dependency-invalid",
					"child dependency must target actionable parent obligations",
				);
			}
			const existing = parent.blockers.find(
				(entry) => entry.blockerId === parentDependency.blockerId,
			);
			if (existing === undefined) {
				const parentBlocker = createRuntimeBlocker({
					frameId: parent.frame.frameId,
					kind: "child-frame",
					sourceId: frame.frameId,
					blockerId: parentDependency.blockerId,
					targetObligationIds: targets,
					details: {
						reason: normalizedText(parentDependency.reason, "reason"),
					},
				});
				next = updateFrame(state, parent.frame.frameId, (current) =>
					addBlocker(current, parentBlocker),
				);
			} else if (!sameIds(existing.targetObligationIds, targets)) {
				stop(
					"parent-dependency-invalid",
					"existing parent blocker targets differ",
				);
			}
		}
		return freezeState({
			...next,
			frames: Object.freeze([
				...next.frames,
				immutableFrame(frame, obligations),
			]),
		});
	});
}

export function replaceRouteFrame(
	state: DeveloperWorkScopeState,
	uncheckedReplacement: RouteFrame,
	uncheckedObligations: readonly Obligation[],
): RuntimeTransitionResult {
	return attempt(state, () => {
		const { frame: replacement, obligations } = refinedFrameAndObligations(
			uncheckedReplacement,
			uncheckedObligations,
		);
		const current = openFrame(state, replacement.frameId);
		if (
			replacement.workScopeId !== state.workScopeId ||
			replacement.parentFrameId !== current.frame.parentFrameId ||
			replacement.frameRevision <= current.frame.frameRevision
		) {
			stop(
				"replacement-not-ready",
				"replacement identity is not a fresh frame revision",
			);
		}
		if (state.activeInvocation?.frameId === replacement.frameId) {
			stop(
				"replacement-not-ready",
				"active invocation must settle before replacement",
			);
		}
		if (
			state.frames.some(
				(candidate) =>
					candidate.frame.parentFrameId === replacement.frameId &&
					candidate.conclusion === null,
			)
		) {
			stop(
				"replacement-not-ready",
				"open child frame must conclude before replacement",
			);
		}
		return freezeState({
			...state,
			frames: Object.freeze(
				state.frames.map((candidate) =>
					candidate.frame.frameId === replacement.frameId
						? immutableFrame(replacement, obligations)
						: candidate,
				),
			),
			assignments: Object.freeze(
				state.assignments.filter(
					(candidate) =>
						candidate.assignment.parentFrameId !== replacement.frameId,
				),
			),
		});
	});
}

export function attachRoutingCoverage(
	state: DeveloperWorkScopeState,
	frameId: DeveloperId,
	coverageInput: CompletedRoutingCoverage,
): RuntimeTransitionResult {
	return attempt(state, () => {
		const coverage = verifyCompletedRoutingCoverage(coverageInput);
		const frame = openFrame(state, frameId);
		if (frame.routing !== null) {
			stop("routing-not-current", "frame already has routing coverage");
		}
		if (
			coverage.basis.frameId !== frame.frame.frameId ||
			coverage.basis.frameRevision !== frame.frame.frameRevision ||
			coverage.basis.obligationSetSha256 !== frame.frame.obligationSetSha256 ||
			!sameIds(
				coverage.obligations.map((entry) => entry.obligationId),
				frame.frame.obligationIds,
			)
		) {
			stop("routing-not-current", "routing coverage is stale for this frame");
		}
		return updateFrame(state, frameId, (current) =>
			Object.freeze({ ...current, routing: coverage }),
		);
	});
}

function obligationBlocked(
	frame: RuntimeFrameState,
	obligationId: DeveloperId,
): boolean {
	return frame.blockers.some((entry) =>
		entry.targetObligationIds.includes(obligationId),
	);
}

function obligationDischarged(
	frame: RuntimeFrameState,
	obligationId: DeveloperId,
): boolean {
	return frame.discharges.some((entry) => entry.obligationId === obligationId);
}

export function actionableObligationIds(
	state: DeveloperWorkScopeState,
	frameId: DeveloperId,
): readonly DeveloperId[] {
	const frame = requiredFrame(state, frameId);
	if (frame.conclusion !== null) return Object.freeze([]);
	return Object.freeze(
		frame.obligations
			.map((obligation) => obligation.obligationId)
			.filter(
				(obligationId) =>
					!obligationBlocked(frame, obligationId) &&
					!obligationDischarged(frame, obligationId),
			),
	);
}

function assertAssignmentReady(
	state: DeveloperWorkScopeState,
	frame: RuntimeFrameState,
	assignment: ReadySkillAssignment,
	basis: CanServeRoutingBasis,
): void {
	const routing = frame.routing;
	if (routing === null) {
		stop(
			"assignment-not-ready",
			"assignment requires current routing coverage",
		);
	}
	verifyCanServeRoutingBasis(routing, basis);
	if (
		assignment.parentFrameRevision !== frame.frame.frameRevision ||
		basis.frameId !== frame.frame.frameId ||
		basis.frameRevision !== frame.frame.frameRevision ||
		basis.snapshotId !== routing.manifest.snapshotId
	) {
		stop("assignment-not-ready", "assignment frame or snapshot basis is stale");
	}
	if (
		basis.contextBasisSha256 !== routing.coverageSha256 ||
		assignment.contextBasisSha256 !== routing.coverageSha256 ||
		assignment.applicabilityBasisSha256 !== basis.basisSha256
	) {
		stop(
			"assignment-not-ready",
			"assignment context or applicability basis is stale",
		);
	}
	if (
		assignment.skillCapabilityId !== basis.capabilityId ||
		assignment.skillRevisionSha256 !== basis.capabilityRevisionSha256 ||
		!sameIds(assignment.targetObligationIds, basis.targetObligationIds) ||
		!subsetOf(
			assignment.targetObligationIds,
			actionableObligationIds(state, frame.frame.frameId),
		)
	) {
		stop(
			"assignment-not-ready",
			"assignment capability or targets are not current",
		);
	}
}

export function recordReadyAssignment(
	state: DeveloperWorkScopeState,
	uncheckedAssignment: ReadySkillAssignment,
	basis: CanServeRoutingBasis,
): RuntimeTransitionResult {
	return attempt(state, () => {
		const assignment = parseReadySkillAssignment(uncheckedAssignment);
		if (
			state.assignments.some(
				(entry) => entry.assignment.assignmentId === assignment.assignmentId,
			)
		) {
			stop(
				"duplicate-identity",
				`Duplicate assignment: ${assignment.assignmentId}`,
			);
		}
		const frame = openFrame(state, assignment.parentFrameId);
		assertAssignmentReady(state, frame, assignment, basis);
		const ready: RuntimeAssignmentState = Object.freeze({
			status: "ready",
			assignment,
			basis,
		});
		return freezeState({
			...state,
			assignments: Object.freeze([...state.assignments, ready]),
		});
	});
}

function requiredAssignment(
	state: DeveloperWorkScopeState,
	assignmentId: DeveloperId,
): RuntimeAssignmentState {
	const assignment = state.assignments.find(
		(entry) => entry.assignment.assignmentId === assignmentId,
	);
	if (assignment === undefined) {
		stop("assignment-not-ready", `Unknown assignment: ${assignmentId}`);
	}
	return assignment;
}

export function startSkillInvocation(
	state: DeveloperWorkScopeState,
	invocationIdInput: DeveloperId,
	assignmentIdInput: DeveloperId,
): RuntimeTransitionResult {
	return attempt(state, () => {
		const invocationId = parseDeveloperId(invocationIdInput, "invocationId");
		const assignmentId = parseDeveloperId(assignmentIdInput, "assignmentId");
		if (state.activeInvocation !== null) {
			stop(
				"invocation-already-active",
				"work scope already has an active invocation",
			);
		}
		if (
			state.assignments.some(
				(entry) =>
					"invocationId" in entry && entry.invocationId === invocationId,
			)
		) {
			stop("duplicate-identity", `Duplicate invocation: ${invocationId}`);
		}
		const current = requiredAssignment(state, assignmentId);
		if (current.status !== "ready") {
			stop("assignment-not-ready", "assignment is not ready");
		}
		const frame = openFrame(state, current.assignment.parentFrameId);
		if (
			!subsetOf(
				current.assignment.targetObligationIds,
				actionableObligationIds(state, frame.frame.frameId),
			)
		) {
			stop(
				"assignment-not-ready",
				"assignment targets are no longer actionable",
			);
		}
		const active: RuntimeAssignmentState = Object.freeze({
			...current,
			status: "active",
			invocationId,
		});
		return freezeState({
			...state,
			assignments: Object.freeze(
				state.assignments.map((entry) =>
					entry.assignment.assignmentId === assignmentId ? active : entry,
				),
			),
			activeInvocation: Object.freeze({
				invocationId,
				assignmentId,
				frameId: frame.frame.frameId,
			}),
		});
	});
}

function settlementTargets(
	settlement: InvocationSettlement,
	assignment: ReadySkillAssignment,
): readonly DeveloperId[] {
	if (settlement.kind === "capability-failed") {
		return assignment.targetObligationIds;
	}
	if (settlement.kind === "lifecycle" || settlement.value.kind === "abort") {
		return Object.freeze([]);
	}
	if (settlement.value.kind === "contribution") {
		return Object.freeze(
			settlement.value.targetUses.map((target) => target.obligationId),
		);
	}
	return settlement.value.targetObligationIds;
}

function derivedBlockerId(
	invocationId: DeveloperId,
	kind: RuntimeBlockerKind,
): DeveloperId {
	const digest = canonicalValueSha256({
		domain: "developer/v8/settlement-blocker-id",
		invocationId,
		kind,
	});
	return parseDeveloperId(`blocker:${digest.slice(0, 40)}`, "blockerId");
}

function blockerFromSettlement(
	frame: RuntimeFrameState,
	assignment: ReadySkillAssignment,
	settlement: InvocationSettlement,
): RuntimeBlocker | null {
	if (settlement.kind === "capability-failed") {
		return createRuntimeBlocker({
			frameId: frame.frame.frameId,
			kind: "capability-failure",
			sourceId: settlement.invocationId,
			blockerId: derivedBlockerId(
				settlement.invocationId,
				"capability-failure",
			),
			targetObligationIds: assignment.targetObligationIds,
			details: settlement.failure,
		});
	}
	if (settlement.kind !== "returned") return null;
	if (settlement.value.kind === "dependency") {
		return createRuntimeBlocker({
			frameId: frame.frame.frameId,
			kind: "dependency",
			sourceId: settlement.value.dependencyId,
			blockerId: derivedBlockerId(settlement.invocationId, "dependency"),
			targetObligationIds: settlement.value.targetObligationIds,
			details: settlement.value,
		});
	}
	if (settlement.value.kind === "needs-context") {
		return createRuntimeBlocker({
			frameId: frame.frame.frameId,
			kind: "needs-context",
			sourceId: settlement.invocationId,
			blockerId: derivedBlockerId(settlement.invocationId, "needs-context"),
			targetObligationIds: settlement.value.targetObligationIds,
			details: settlement.value,
		});
	}
	return null;
}

export function settleSkillInvocation(
	state: DeveloperWorkScopeState,
	uncheckedSettlement: InvocationSettlement,
): RuntimeTransitionResult {
	return attempt(state, () => {
		const settlement = parseInvocationSettlement(uncheckedSettlement);
		const active = state.activeInvocation;
		if (active === null) {
			stop("invocation-not-active", "work scope has no active invocation");
		}
		if (
			active.invocationId !== settlement.invocationId ||
			active.assignmentId !== settlement.assignmentId
		) {
			stop(
				"settlement-mismatch",
				"settlement does not match the active invocation",
			);
		}
		const assignmentState = requiredAssignment(state, active.assignmentId);
		if (
			assignmentState.status !== "active" ||
			assignmentState.invocationId !== active.invocationId
		) {
			stop("settlement-mismatch", "active assignment identity is inconsistent");
		}
		const targets = settlementTargets(settlement, assignmentState.assignment);
		if (!subsetOf(targets, assignmentState.assignment.targetObligationIds)) {
			stop(
				"settlement-mismatch",
				"settlement targets exceed assignment authority",
			);
		}
		let next = state;
		const frame = openFrame(state, active.frameId);
		const newBlocker = blockerFromSettlement(
			frame,
			assignmentState.assignment,
			settlement,
		);
		if (newBlocker !== null) {
			next = updateFrame(next, frame.frame.frameId, (current) =>
				addBlocker(current, newBlocker),
			);
		}
		const settled: RuntimeAssignmentState = Object.freeze({
			status: "settled",
			assignment: assignmentState.assignment,
			basis: assignmentState.basis,
			invocationId: active.invocationId,
			settlement,
		});
		return freezeState({
			...next,
			assignments: Object.freeze(
				next.assignments.map((entry) =>
					entry.assignment.assignmentId === active.assignmentId
						? settled
						: entry,
				),
			),
			activeInvocation: null,
		});
	});
}

export function resolveFrameBlocker(
	state: DeveloperWorkScopeState,
	frameIdInput: DeveloperId,
	blockerIdInput: DeveloperId,
	resolutionBasisSha256Input: Sha256Digest,
): RuntimeTransitionResult {
	return attempt(state, () => {
		const frameId = parseDeveloperId(frameIdInput, "frameId");
		const blockerId = parseDeveloperId(blockerIdInput, "blockerId");
		parseSha256Digest(resolutionBasisSha256Input, "resolutionBasisSha256");
		const frame = openFrame(state, frameId);
		if (!frame.blockers.some((entry) => entry.blockerId === blockerId)) {
			stop("blocker-not-found", `Unknown blocker: ${blockerId}`);
		}
		return updateFrame(state, frameId, (current) =>
			Object.freeze({
				...current,
				blockers: Object.freeze(
					current.blockers.filter((entry) => entry.blockerId !== blockerId),
				),
			}),
		);
	});
}

export function skillReturnSupportSha256(
	settlement: InvocationSettlement,
): Sha256Digest {
	return canonicalValueSha256({
		domain: "developer/v8/skill-return-support",
		settlement,
	});
}

function equalSkillContribution(
	proposal: ProposedFrameContribution,
	settlement: InvocationSettlement,
): boolean {
	if (
		settlement.kind !== "returned" ||
		settlement.value.kind !== "contribution"
	) {
		return false;
	}
	return (
		proposal.claim === settlement.value.claim &&
		proposal.applicability === settlement.value.applicability &&
		canonicalValueSha256(proposal.targetUses) ===
			canonicalValueSha256(settlement.value.targetUses) &&
		canonicalValueSha256(proposal.limitations) ===
			canonicalValueSha256(settlement.value.limitations)
	);
}

function assertSkillProposalCurrent(
	state: DeveloperWorkScopeState,
	frame: RuntimeFrameState,
	proposal: ProposedFrameContribution,
): void {
	const assignment = state.assignments.find(
		(entry) =>
			"invocationId" in entry &&
			entry.invocationId === proposal.source.sourceId,
	);
	if (assignment === undefined || assignment.status !== "settled") {
		stop(
			"contribution-not-admissible",
			"Skill proposal has no settled invocation source",
		);
	}
	if (
		assignment.assignment.parentFrameId !== frame.frame.frameId ||
		assignment.assignment.parentFrameRevision !== frame.frame.frameRevision ||
		frame.routing === null ||
		assignment.assignment.contextBasisSha256 !== frame.routing.coverageSha256
	) {
		stop("contribution-not-admissible", "Skill proposal source is stale");
	}
	if (
		proposal.source.sourceRevisionSha256 !==
			skillReturnSupportSha256(assignment.settlement) ||
		proposal.supportSha256 !== proposal.source.sourceRevisionSha256 ||
		!equalSkillContribution(proposal, assignment.settlement)
	) {
		stop(
			"contribution-not-admissible",
			"Skill proposal does not match its settled Contribution",
		);
	}
}

export function admitFrameContribution(
	state: DeveloperWorkScopeState,
	uncheckedProposal: ProposedFrameContribution,
	contributionIdInput: DeveloperId,
	admissionBasisSha256Input: Sha256Digest,
): RuntimeTransitionResult {
	return attempt(state, () => {
		const proposal = verifyProposedFrameContribution(uncheckedProposal);
		const contributionId = parseDeveloperId(
			contributionIdInput,
			"contributionId",
		);
		const admissionBasisSha256 = parseSha256Digest(
			admissionBasisSha256Input,
			"admissionBasisSha256",
		);
		const frame = openFrame(state, proposal.frameId);
		if (proposal.frameRevision !== frame.frame.frameRevision) {
			stop("contribution-not-admissible", "contribution targets a stale frame");
		}
		if (
			frame.contributions.some(
				(contribution) => contribution.contributionId === contributionId,
			)
		) {
			stop("duplicate-identity", `Duplicate contribution: ${contributionId}`);
		}
		const targetIds = proposal.targetUses.map((target) => target.obligationId);
		if (
			!subsetOf(targetIds, actionableObligationIds(state, frame.frame.frameId))
		) {
			stop(
				"contribution-not-admissible",
				"contribution targets are not actionable",
			);
		}
		if (proposal.source.kind === "skill-return") {
			assertSkillProposalCurrent(state, frame, proposal);
		}
		const admissionBody = Object.freeze({
			contributionId,
			proposal,
			admissionBasisSha256,
		});
		const contribution: AdmittedContribution = Object.freeze({
			...admissionBody,
			admissionSha256: canonicalValueSha256({
				domain: "developer/v8/admitted-frame-contribution",
				admission: admissionBody,
			}),
		});
		return updateFrame(state, frame.frame.frameId, (current) =>
			Object.freeze({
				...current,
				contributions: Object.freeze([...current.contributions, contribution]),
			}),
		);
	});
}

function supportingUse(useAs: string): boolean {
	return useAs === "constraint" || useAs === "evidence" || useAs === "decision";
}

function refineDischargeBody(
	unchecked: ObligationDischargeBody,
): ObligationDischargeBody {
	if (
		!Number.isInteger(unchecked.expectedFrameRevision) ||
		unchecked.expectedFrameRevision < 0
	) {
		stop(
			"invalid-input",
			"expectedFrameRevision must be a non-negative integer",
		);
	}
	const stopEvidence = Object.freeze(
		unchecked.stopEvidence.map((entry, index) =>
			normalizedText(entry, `stopEvidence[${index}]`),
		),
	);
	if (stopEvidence.length === 0 || stopEvidence.length > 100) {
		stop("invalid-input", "stopEvidence has an invalid length");
	}
	return Object.freeze({
		dischargeId: parseDeveloperId(unchecked.dischargeId, "dischargeId"),
		frameId: parseDeveloperId(unchecked.frameId, "frameId"),
		expectedFrameRevision: unchecked.expectedFrameRevision,
		obligationId: parseDeveloperId(unchecked.obligationId, "obligationId"),
		contributionIds: canonicalIds(
			unchecked.contributionIds,
			"contributionIds",
			{ nonEmpty: true },
		),
		stopEvidence,
		conclusion: normalizedText(unchecked.conclusion, "conclusion"),
	});
}

function activeInvocationTargets(
	state: DeveloperWorkScopeState,
	frame: RuntimeFrameState,
	obligationId: DeveloperId,
): boolean {
	const active = state.activeInvocation;
	if (active === null || active.frameId !== frame.frame.frameId) return false;
	return requiredAssignment(
		state,
		active.assignmentId,
	).assignment.targetObligationIds.includes(obligationId);
}

function assertDischargeTargetActionable(
	state: DeveloperWorkScopeState,
	frame: RuntimeFrameState,
	body: ObligationDischargeBody,
): void {
	if (body.expectedFrameRevision !== frame.frame.frameRevision) {
		stop("stale-frame", "discharge targets a stale frame revision");
	}
	if (!frame.frame.obligationIds.includes(body.obligationId)) {
		stop("obligation-not-actionable", "unknown frame obligation");
	}
	if (
		obligationBlocked(frame, body.obligationId) ||
		obligationDischarged(frame, body.obligationId) ||
		activeInvocationTargets(state, frame, body.obligationId)
	) {
		stop(
			"obligation-not-actionable",
			"obligation is blocked, active, or discharged",
		);
	}
}

function assertDischargeSupport(
	frame: RuntimeFrameState,
	body: ObligationDischargeBody,
): void {
	for (const contributionId of body.contributionIds) {
		const contribution = frame.contributions.find(
			(entry) => entry.contributionId === contributionId,
		);
		const supportsTarget = contribution?.proposal.targetUses.some(
			(target) =>
				target.obligationId === body.obligationId &&
				supportingUse(target.useAs),
		);
		if (supportsTarget !== true) {
			stop(
				"discharge-not-supported",
				"discharge lacks current admitted targeting support",
			);
		}
	}
}

export function dischargeObligation(
	state: DeveloperWorkScopeState,
	unchecked: ObligationDischargeBody,
): RuntimeTransitionResult {
	return attempt(state, () => {
		const body = refineDischargeBody(unchecked);
		const frame = openFrame(state, body.frameId);
		assertDischargeTargetActionable(state, frame, body);
		assertDischargeSupport(frame, body);
		if (
			frame.discharges.some((entry) => entry.dischargeId === body.dischargeId)
		) {
			stop("duplicate-identity", `Duplicate discharge: ${body.dischargeId}`);
		}
		const discharge: ObligationDischarge = Object.freeze({
			...body,
			dischargeSha256: canonicalValueSha256({
				domain: "developer/v8/obligation-discharge",
				discharge: body,
			}),
		});
		return updateFrame(state, frame.frame.frameId, (current) =>
			Object.freeze({
				...current,
				discharges: Object.freeze([...current.discharges, discharge]),
			}),
		);
	});
}

export function runtimeBlockerSetSha256(
	blockers: readonly RuntimeBlocker[],
): Sha256Digest {
	return canonicalValueSha256({
		domain: "developer/v8/runtime-blocker-set",
		blockers: [...blockers].sort((left, right) =>
			compareIdentifiers(left.blockerId, right.blockerId),
		),
	});
}

export function concludeRouteFrame(
	state: DeveloperWorkScopeState,
	uncheckedProposal: FrameConclusionProposal,
): RuntimeTransitionResult {
	return attempt(state, () => {
		const proposal = parseFrameConclusionProposal(uncheckedProposal);
		const frame = openFrame(state, proposal.frameId);
		if (proposal.expectedFrameRevision !== frame.frame.frameRevision) {
			stop("stale-frame", "conclusion targets a stale frame revision");
		}
		if (
			proposal.expectedBlockerSetSha256 !==
				runtimeBlockerSetSha256(frame.blockers) ||
			frame.blockers.length !== 0
		) {
			stop(
				"conclusion-not-ready",
				"conclusion blocker basis is not empty and current",
			);
		}
		if (state.activeInvocation?.frameId === frame.frame.frameId) {
			stop("conclusion-not-ready", "frame has an active invocation");
		}
		const currentDischargeIds = [...frame.discharges]
			.sort((left, right) =>
				compareIdentifiers(left.dischargeId, right.dischargeId),
			)
			.map((entry) => entry.dischargeId);
		if (
			frame.discharges.length !== frame.obligations.length ||
			!sameIds(proposal.dischargeIds, currentDischargeIds)
		) {
			stop(
				"conclusion-not-ready",
				"conclusion requires every current discharge",
			);
		}
		const conclusion: RuntimeFrameConclusion = Object.freeze({
			proposal,
			conclusionSha256: canonicalValueSha256({
				domain: "developer/v8/route-frame-conclusion",
				proposal,
			}),
		});
		return updateFrame(state, frame.frame.frameId, (current) =>
			Object.freeze({ ...current, conclusion }),
		);
	});
}
