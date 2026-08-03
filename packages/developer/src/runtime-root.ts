import {
	MAX_RUNTIME_ARRAY_LENGTH,
	MAX_RUNTIME_TEXT_LENGTH,
	canonicalValueSha256,
	parseDeveloperEventRef,
	parseDeveloperId,
	parseSha256Digest,
	type DeveloperEventRef,
	type DeveloperId,
	type Sha256Digest,
} from "./runtime-protocol.ts";
import {
	runtimeFrameState,
	type DeveloperWorkScopeState,
} from "./runtime-transition.ts";

export type RuntimeRootErrorCode =
	| "invalid-input"
	| "invalid-root-state"
	| "scope-closed"
	| "scope-close-blocked"
	| "authorization-blocked"
	| "authorization-stale"
	| "landing-blocked"
	| "landing-stale"
	| "debt-causality-mismatch"
	| "verification-route-mismatch";

export interface RuntimeRootError {
	readonly code: RuntimeRootErrorCode;
	readonly message: string;
}

export type RuntimeRootTransitionResult =
	| Readonly<{ ok: true; state: RuntimeRootState }>
	| Readonly<{
			ok: false;
			state: RuntimeRootState;
			error: RuntimeRootError;
	  }>;

export type RuntimeImplementationBoundary =
	| Readonly<{
			kind: "refinement-boundary";
			rawRepresentation: string;
			refinedRepresentation: string;
			producer: string;
			failure: string;
			firstEffect: string;
	  }>
	| Readonly<{
			kind: "trusted-compiler-gap";
			assertion: string;
			establishedBy: string;
			limitation: string;
			containment: string;
			verification: string;
	  }>;

const authorizationBrand: unique symbol = Symbol("RuntimeChangeAuthorization");

export interface RuntimeChangeAuthorization {
	readonly authorizationId: DeveloperId;
	readonly frameId: DeveloperId;
	readonly frameRevision: number;
	readonly conclusionSha256: Sha256Digest;
	readonly movement: string;
	readonly stableLanding: string;
	readonly verificationTarget: string;
	readonly boundary: RuntimeImplementationBoundary | null;
	readonly authorizationSha256: Sha256Digest;
	readonly [authorizationBrand]: true;
}

const landingBrand: unique symbol = Symbol("RuntimeImplementationLanding");

export interface RuntimeImplementationLanding {
	readonly landingId: DeveloperId;
	readonly authorizationId: DeveloperId;
	readonly changedPaths: readonly string[];
	readonly result: string;
	readonly verification: readonly string[];
	readonly rerouteFrameId: DeveloperId;
	readonly verificationFrameId: DeveloperId;
	readonly changedPathsSha256: Sha256Digest;
	readonly verificationSha256: Sha256Digest;
	readonly landingSha256: Sha256Digest;
	readonly [landingBrand]: true;
}

const closureBrand: unique symbol = Symbol("RuntimeScopeClosure");

export interface RuntimeScopeClosure {
	readonly reason: string;
	readonly reasonSha256: Sha256Digest;
	readonly [closureBrand]: true;
}

export interface RuntimeLandingDebt {
	readonly landingId: DeveloperId;
	readonly landingEventRef: DeveloperEventRef;
	readonly rerouteFrameId: DeveloperId;
	readonly verificationFrameId: DeveloperId;
	readonly reroutePending: boolean;
	readonly verificationPending: boolean;
}

const rootStateBrand: unique symbol = Symbol("RuntimeRootState");

export interface RuntimeRootState {
	readonly status: "open" | "closed";
	readonly closure: RuntimeScopeClosure | null;
	readonly activeAuthorization: RuntimeChangeAuthorization | null;
	readonly landings: readonly RuntimeImplementationLanding[];
	readonly debts: readonly RuntimeLandingDebt[];
	readonly stateSha256: Sha256Digest;
	readonly [rootStateBrand]: true;
}

export interface RuntimeScopeCloseInput {
	readonly root: RuntimeRootState;
	readonly scope: DeveloperWorkScopeState;
	readonly closure: RuntimeScopeClosure;
}

export interface RuntimeAuthorizeChangeInput {
	readonly root: RuntimeRootState;
	readonly scope: DeveloperWorkScopeState;
	readonly authorization: RuntimeChangeAuthorization;
}

export interface RuntimeRecordLandingInput {
	readonly root: RuntimeRootState;
	readonly scope: DeveloperWorkScopeState;
	readonly landing: RuntimeImplementationLanding;
	readonly landingEventRef: DeveloperEventRef;
}

export interface RuntimeObserveFrameInput {
	readonly root: RuntimeRootState;
	readonly scope: DeveloperWorkScopeState;
	readonly frameId: DeveloperId;
	readonly causalRefs: readonly DeveloperEventRef[];
}

const authorizationValues = new WeakSet<object>();
const landingValues = new WeakSet<object>();
const closureValues = new WeakSet<object>();
const rootStateValues = new WeakSet<object>();

function strictText(input: {
	readonly value: unknown;
	readonly label: string;
	readonly max?: number;
}): string {
	const max = input.max ?? MAX_RUNTIME_TEXT_LENGTH;
	if (
		typeof input.value !== "string" ||
		input.value.trim().length === 0 ||
		input.value !== input.value.trim() ||
		input.value.length > max
	) {
		throw new Error(`${input.label} must be non-blank exact bounded text`);
	}
	return input.value;
}

function exactKeys(input: {
	readonly value: Record<string, unknown>;
	readonly required: readonly string[];
	readonly label: string;
}): void {
	const actual = Object.keys(input.value).sort();
	const expected = [...input.required].sort();
	if (actual.length !== expected.length) {
		throw new Error(`${input.label} has an invalid representation`);
	}
	for (const [index, key] of actual.entries()) {
		if (key !== expected[index]) {
			throw new Error(`${input.label} has an invalid representation`);
		}
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function objectValue(input: {
	readonly value: unknown;
	readonly label: string;
}): Record<string, unknown> {
	if (!isRecord(input.value)) {
		throw new Error(`${input.label} must be an object`);
	}
	return input.value;
}

function integer(input: {
	readonly value: unknown;
	readonly label: string;
}): number {
	if (!Number.isSafeInteger(input.value) || Number(input.value) < 0) {
		throw new Error(`${input.label} must be a non-negative safe integer`);
	}
	return Number(input.value);
}

function boundary(value: unknown): RuntimeImplementationBoundary | null {
	if (value === null) return null;
	const data = objectValue({ value, label: "authorization.boundary" });
	const kind = data.kind;
	if (kind === "refinement-boundary") {
		exactKeys({
			value: data,
			required: [
				"kind",
				"rawRepresentation",
				"refinedRepresentation",
				"producer",
				"failure",
				"firstEffect",
			],
			label: "authorization.boundary",
		});
		return Object.freeze({
			kind,
			rawRepresentation: strictText({
				value: data.rawRepresentation,
				label: "authorization.boundary.rawRepresentation",
			}),
			refinedRepresentation: strictText({
				value: data.refinedRepresentation,
				label: "authorization.boundary.refinedRepresentation",
			}),
			producer: strictText({
				value: data.producer,
				label: "authorization.boundary.producer",
			}),
			failure: strictText({
				value: data.failure,
				label: "authorization.boundary.failure",
			}),
			firstEffect: strictText({
				value: data.firstEffect,
				label: "authorization.boundary.firstEffect",
			}),
		});
	}
	if (kind !== "trusted-compiler-gap") {
		throw new Error("authorization.boundary kind is invalid");
	}
	exactKeys({
		value: data,
		required: [
			"kind",
			"assertion",
			"establishedBy",
			"limitation",
			"containment",
			"verification",
		],
		label: "authorization.boundary",
	});
	return Object.freeze({
		kind,
		assertion: strictText({
			value: data.assertion,
			label: "authorization.boundary.assertion",
		}),
		establishedBy: strictText({
			value: data.establishedBy,
			label: "authorization.boundary.establishedBy",
		}),
		limitation: strictText({
			value: data.limitation,
			label: "authorization.boundary.limitation",
		}),
		containment: strictText({
			value: data.containment,
			label: "authorization.boundary.containment",
		}),
		verification: strictText({
			value: data.verification,
			label: "authorization.boundary.verification",
		}),
	});
}

function canonicalTextArray(input: {
	readonly value: unknown;
	readonly label: string;
	readonly maxItems: number;
	readonly maxText: number;
	readonly nonEmpty: boolean;
}): readonly string[] {
	if (
		!Array.isArray(input.value) ||
		input.value.length > input.maxItems ||
		(input.nonEmpty && input.value.length === 0)
	) {
		throw new Error(`${input.label} has an invalid count`);
	}
	const values: string[] = [];
	for (const [index, raw] of input.value.entries()) {
		values.push(
			strictText({
				value: raw,
				label: `${input.label}[${index}]`,
				max: input.maxText,
			}),
		);
	}
	for (let index = 1; index < values.length; index += 1) {
		const previous = values[index - 1];
		const current = values[index];
		if (
			previous === current ||
			(previous !== undefined && current !== undefined && previous > current)
		) {
			throw new Error(`${input.label} must be canonical and unique`);
		}
	}
	return Object.freeze(values);
}

export function createRuntimeChangeAuthorization(
	value: unknown,
): RuntimeChangeAuthorization {
	const data = objectValue({ value, label: "authorization" });
	exactKeys({
		value: data,
		required: [
			"authorizationId",
			"frameId",
			"frameRevision",
			"conclusionSha256",
			"movement",
			"stableLanding",
			"verificationTarget",
			"boundary",
		],
		label: "authorization",
	});
	const fields = Object.freeze({
		authorizationId: parseDeveloperId(
			data.authorizationId,
			"authorization.authorizationId",
		),
		frameId: parseDeveloperId(data.frameId, "authorization.frameId"),
		frameRevision: integer({
			value: data.frameRevision,
			label: "authorization.frameRevision",
		}),
		conclusionSha256: parseSha256Digest(
			data.conclusionSha256,
			"authorization.conclusionSha256",
		),
		movement: strictText({
			value: data.movement,
			label: "authorization.movement",
		}),
		stableLanding: strictText({
			value: data.stableLanding,
			label: "authorization.stableLanding",
		}),
		verificationTarget: strictText({
			value: data.verificationTarget,
			label: "authorization.verificationTarget",
		}),
		boundary: boundary(data.boundary),
	});
	const authorization: RuntimeChangeAuthorization = Object.freeze({
		...fields,
		authorizationSha256: canonicalValueSha256({
			domain: "developer/v8/change-authorization",
			fields,
		}),
		[authorizationBrand]: true as const,
	});
	authorizationValues.add(authorization);
	return authorization;
}

export function parseRuntimeChangeAuthorization(
	value: unknown,
): RuntimeChangeAuthorization {
	const data = objectValue({ value, label: "authorization" });
	exactKeys({
		value: data,
		required: [
			"authorizationId",
			"frameId",
			"frameRevision",
			"conclusionSha256",
			"movement",
			"stableLanding",
			"verificationTarget",
			"boundary",
			"authorizationSha256",
		],
		label: "authorization",
	});
	const parsed = createRuntimeChangeAuthorization({
		authorizationId: data.authorizationId,
		frameId: data.frameId,
		frameRevision: data.frameRevision,
		conclusionSha256: data.conclusionSha256,
		movement: data.movement,
		stableLanding: data.stableLanding,
		verificationTarget: data.verificationTarget,
		boundary: data.boundary,
	});
	if (
		parsed.authorizationSha256 !==
		parseSha256Digest(
			data.authorizationSha256,
			"authorization.authorizationSha256",
		)
	) {
		throw new Error("authorization hash mismatch");
	}
	return parsed;
}

export function verifyRuntimeChangeAuthorization(
	value: RuntimeChangeAuthorization,
): RuntimeChangeAuthorization {
	if (!authorizationValues.has(value)) {
		throw new Error("Runtime change authorization is not process-local");
	}
	return value;
}

export function createRuntimeImplementationLanding(
	value: unknown,
): RuntimeImplementationLanding {
	const data = objectValue({ value, label: "landing" });
	exactKeys({
		value: data,
		required: [
			"landingId",
			"authorizationId",
			"changedPaths",
			"result",
			"verification",
			"rerouteFrameId",
			"verificationFrameId",
		],
		label: "landing",
	});
	const changedPaths = canonicalTextArray({
		value: data.changedPaths,
		label: "landing.changedPaths",
		maxItems: 200,
		maxText: 4_096,
		nonEmpty: true,
	});
	const verification = canonicalTextArray({
		value: data.verification,
		label: "landing.verification",
		maxItems: MAX_RUNTIME_ARRAY_LENGTH,
		maxText: MAX_RUNTIME_TEXT_LENGTH,
		nonEmpty: false,
	});
	const fields = Object.freeze({
		landingId: parseDeveloperId(data.landingId, "landing.landingId"),
		authorizationId: parseDeveloperId(
			data.authorizationId,
			"landing.authorizationId",
		),
		changedPaths,
		result: strictText({ value: data.result, label: "landing.result" }),
		verification,
		rerouteFrameId: parseDeveloperId(
			data.rerouteFrameId,
			"landing.rerouteFrameId",
		),
		verificationFrameId: parseDeveloperId(
			data.verificationFrameId,
			"landing.verificationFrameId",
		),
	});
	if (fields.rerouteFrameId === fields.verificationFrameId) {
		throw new Error("landing debt frame identities must differ");
	}
	const changedPathsSha256 = canonicalValueSha256({
		domain: "developer/v8/landing-changed-paths",
		changedPaths,
	});
	const verificationSha256 = canonicalValueSha256({
		domain: "developer/v8/landing-verification",
		verification,
	});
	const landing: RuntimeImplementationLanding = Object.freeze({
		...fields,
		changedPathsSha256,
		verificationSha256,
		landingSha256: canonicalValueSha256({
			domain: "developer/v8/implementation-landing",
			fields,
			changedPathsSha256,
			verificationSha256,
		}),
		[landingBrand]: true as const,
	});
	landingValues.add(landing);
	return landing;
}

export function parseRuntimeImplementationLanding(
	value: unknown,
): RuntimeImplementationLanding {
	const data = objectValue({ value, label: "landing" });
	exactKeys({
		value: data,
		required: [
			"landingId",
			"authorizationId",
			"changedPaths",
			"result",
			"verification",
			"rerouteFrameId",
			"verificationFrameId",
			"changedPathsSha256",
			"verificationSha256",
			"landingSha256",
		],
		label: "landing",
	});
	const parsed = createRuntimeImplementationLanding({
		landingId: data.landingId,
		authorizationId: data.authorizationId,
		changedPaths: data.changedPaths,
		result: data.result,
		verification: data.verification,
		rerouteFrameId: data.rerouteFrameId,
		verificationFrameId: data.verificationFrameId,
	});
	if (
		parsed.changedPathsSha256 !==
			parseSha256Digest(
				data.changedPathsSha256,
				"landing.changedPathsSha256",
			) ||
		parsed.verificationSha256 !==
			parseSha256Digest(
				data.verificationSha256,
				"landing.verificationSha256",
			) ||
		parsed.landingSha256 !==
			parseSha256Digest(data.landingSha256, "landing.landingSha256")
	) {
		throw new Error("landing hash mismatch");
	}
	return parsed;
}

export function verifyRuntimeImplementationLanding(
	value: RuntimeImplementationLanding,
): RuntimeImplementationLanding {
	if (!landingValues.has(value)) {
		throw new Error("Runtime implementation landing is not process-local");
	}
	return value;
}

export function createRuntimeScopeClosure(value: unknown): RuntimeScopeClosure {
	const data = objectValue({ value, label: "closure" });
	exactKeys({ value: data, required: ["reason"], label: "closure" });
	const reason = strictText({ value: data.reason, label: "closure.reason" });
	const closure: RuntimeScopeClosure = Object.freeze({
		reason,
		reasonSha256: canonicalValueSha256({
			domain: "developer/v8/scope-closure",
			reason,
		}),
		[closureBrand]: true as const,
	});
	closureValues.add(closure);
	return closure;
}

export function parseRuntimeScopeClosure(value: unknown): RuntimeScopeClosure {
	const data = objectValue({ value, label: "closure" });
	exactKeys({
		value: data,
		required: ["reason", "reasonSha256"],
		label: "closure",
	});
	const parsed = createRuntimeScopeClosure({ reason: data.reason });
	if (
		parsed.reasonSha256 !==
		parseSha256Digest(data.reasonSha256, "closure.reasonSha256")
	) {
		throw new Error("closure hash mismatch");
	}
	return parsed;
}

export function verifyRuntimeScopeClosure(
	value: RuntimeScopeClosure,
): RuntimeScopeClosure {
	if (!closureValues.has(value)) {
		throw new Error("Runtime scope closure is not process-local");
	}
	return value;
}

function rootCommitment(
	state: Omit<RuntimeRootState, "stateSha256" | typeof rootStateBrand>,
): object {
	return {
		status: state.status,
		closureSha256: state.closure?.reasonSha256 ?? null,
		authorizationSha256: state.activeAuthorization?.authorizationSha256 ?? null,
		landingSha256s: state.landings.map((landing) => landing.landingSha256),
		debts: state.debts.map((debt) => ({
			landingId: debt.landingId,
			landingEventRef: debt.landingEventRef,
			rerouteFrameId: debt.rerouteFrameId,
			verificationFrameId: debt.verificationFrameId,
			reroutePending: debt.reroutePending,
			verificationPending: debt.verificationPending,
		})),
	};
}

function createRootState(input: {
	readonly status: "open" | "closed";
	readonly closure: RuntimeScopeClosure | null;
	readonly activeAuthorization: RuntimeChangeAuthorization | null;
	readonly landings: readonly RuntimeImplementationLanding[];
	readonly debts: readonly RuntimeLandingDebt[];
}): RuntimeRootState {
	const fields = Object.freeze({
		status: input.status,
		closure: input.closure,
		activeAuthorization: input.activeAuthorization,
		landings: Object.freeze([...input.landings]),
		debts: Object.freeze([...input.debts]),
	});
	const state: RuntimeRootState = Object.freeze({
		...fields,
		stateSha256: canonicalValueSha256({
			domain: "developer/v8/runtime-root-state",
			state: rootCommitment(fields),
		}),
		[rootStateBrand]: true as const,
	});
	rootStateValues.add(state);
	return state;
}

export function initialRuntimeRootState(): RuntimeRootState {
	return createRootState({
		status: "open",
		closure: null,
		activeAuthorization: null,
		landings: [],
		debts: [],
	});
}

export function verifyRuntimeRootState(
	value: RuntimeRootState,
): RuntimeRootState {
	if (!rootStateValues.has(value)) {
		throw new Error("Runtime root state is not process-local");
	}
	return value;
}

function rejected(input: {
	readonly state: RuntimeRootState;
	readonly code: RuntimeRootErrorCode;
	readonly message: string;
}): RuntimeRootTransitionResult {
	return Object.freeze({
		ok: false,
		state: input.state,
		error: Object.freeze({ code: input.code, message: input.message }),
	});
}

function accepted(state: RuntimeRootState): RuntimeRootTransitionResult {
	return Object.freeze({ ok: true, state });
}

function requireOpen(
	root: RuntimeRootState,
): RuntimeRootTransitionResult | null {
	if (root.status === "closed") {
		return rejected({
			state: root,
			code: "scope-closed",
			message: "Runtime work scope is closed",
		});
	}
	return null;
}

export function closeRuntimeScope(
	input: RuntimeScopeCloseInput,
): RuntimeRootTransitionResult {
	const root = verifyRuntimeRootState(input.root);
	const closure = verifyRuntimeScopeClosure(input.closure);
	const closed = requireOpen(root);
	if (closed !== null) return closed;
	if (
		root.activeAuthorization !== null ||
		input.scope.activeInvocation !== null
	) {
		return rejected({
			state: root,
			code: "scope-close-blocked",
			message:
				"Runtime scope cannot close with active authorization or invocation",
		});
	}
	return accepted(
		createRootState({
			status: "closed",
			closure,
			activeAuthorization: null,
			landings: root.landings,
			debts: root.debts,
		}),
	);
}

export function authorizeRuntimeChange(
	input: RuntimeAuthorizeChangeInput,
): RuntimeRootTransitionResult {
	const root = verifyRuntimeRootState(input.root);
	const authorization = verifyRuntimeChangeAuthorization(input.authorization);
	const closed = requireOpen(root);
	if (closed !== null) return closed;
	if (
		root.activeAuthorization !== null ||
		root.landings.some(
			(landing) => landing.authorizationId === authorization.authorizationId,
		) ||
		root.debts.some(
			(debt) => debt.reroutePending || debt.verificationPending,
		) ||
		input.scope.activeInvocation !== null ||
		input.scope.frames.some((frame) => frame.conclusion === null)
	) {
		return rejected({
			state: root,
			code: "authorization-blocked",
			message:
				"Runtime authorization requires settled frames, invocation, and landing debt",
		});
	}
	const frame = runtimeFrameState(input.scope, authorization.frameId);
	if (
		frame === undefined ||
		frame.frame.frameRevision !== authorization.frameRevision ||
		frame.conclusion?.conclusionSha256 !== authorization.conclusionSha256
	) {
		return rejected({
			state: root,
			code: "authorization-stale",
			message:
				"Runtime authorization does not match a current frame conclusion",
		});
	}
	return accepted(
		createRootState({
			status: "open",
			closure: null,
			activeAuthorization: authorization,
			landings: root.landings,
			debts: root.debts,
		}),
	);
}

export function recordRuntimeLanding(
	input: RuntimeRecordLandingInput,
): RuntimeRootTransitionResult {
	const root = verifyRuntimeRootState(input.root);
	const landing = verifyRuntimeImplementationLanding(input.landing);
	const landingEventRef = parseDeveloperEventRef(
		input.landingEventRef,
		"landingEventRef",
	);
	const closed = requireOpen(root);
	if (closed !== null) return closed;
	if (root.activeAuthorization === null) {
		return rejected({
			state: root,
			code: "landing-blocked",
			message: "Runtime landing requires an active authorization",
		});
	}
	if (
		root.activeAuthorization.authorizationId !== landing.authorizationId ||
		input.scope.frames.some(
			(frame) =>
				frame.frame.frameId === landing.rerouteFrameId ||
				frame.frame.frameId === landing.verificationFrameId,
		)
	) {
		return rejected({
			state: root,
			code: "landing-stale",
			message:
				"Runtime landing does not match current authorization or debt identities",
		});
	}
	const debt: RuntimeLandingDebt = Object.freeze({
		landingId: landing.landingId,
		landingEventRef,
		rerouteFrameId: landing.rerouteFrameId,
		verificationFrameId: landing.verificationFrameId,
		reroutePending: true,
		verificationPending: true,
	});
	return accepted(
		createRootState({
			status: "open",
			closure: null,
			activeAuthorization: null,
			landings: [...root.landings, landing],
			debts: [...root.debts, debt],
		}),
	);
}

function sameEventRef(input: {
	readonly left: DeveloperEventRef;
	readonly right: DeveloperEventRef;
}): boolean {
	return (
		input.left.workScopeId === input.right.workScopeId &&
		input.left.eventId === input.right.eventId &&
		input.left.eventSha256 === input.right.eventSha256
	);
}

function hasCause(input: {
	readonly causes: readonly DeveloperEventRef[];
	readonly required: DeveloperEventRef;
}): boolean {
	return input.causes.some((cause) =>
		sameEventRef({ left: cause, right: input.required }),
	);
}

export function observeRuntimeFrameOpened(
	input: RuntimeObserveFrameInput,
): RuntimeRootTransitionResult {
	const root = verifyRuntimeRootState(input.root);
	const closed = requireOpen(root);
	if (closed !== null) return closed;
	const frameId = parseDeveloperId(input.frameId, "frameId");
	const debts: RuntimeLandingDebt[] = [];
	for (const debt of root.debts) {
		if (!debt.reroutePending || debt.rerouteFrameId !== frameId) {
			debts.push(debt);
			continue;
		}
		if (
			!hasCause({ causes: input.causalRefs, required: debt.landingEventRef })
		) {
			return rejected({
				state: root,
				code: "debt-causality-mismatch",
				message: "Reroute frame lacks the exact landing cause",
			});
		}
		debts.push(Object.freeze({ ...debt, reroutePending: false }));
	}
	return accepted(
		createRootState({
			status: "open",
			closure: null,
			activeAuthorization: root.activeAuthorization,
			landings: root.landings,
			debts,
		}),
	);
}

export function observeRuntimeFrameConcluded(
	input: RuntimeObserveFrameInput,
): RuntimeRootTransitionResult {
	const root = verifyRuntimeRootState(input.root);
	const closed = requireOpen(root);
	if (closed !== null) return closed;
	const frameId = parseDeveloperId(input.frameId, "frameId");
	const frame = runtimeFrameState(input.scope, frameId);
	if (frame === undefined || frame.conclusion === null) {
		return rejected({
			state: root,
			code: "invalid-input",
			message: "Verification debt requires a concluded frame",
		});
	}
	const debts: RuntimeLandingDebt[] = [];
	for (const debt of root.debts) {
		if (!debt.verificationPending || debt.verificationFrameId !== frameId) {
			debts.push(debt);
			continue;
		}
		if (frame.frame.routeDefinitionId !== "route:claim-evidence-assessment") {
			return rejected({
				state: root,
				code: "verification-route-mismatch",
				message: "Verification debt requires claim-evidence assessment Route",
			});
		}
		if (
			!hasCause({ causes: input.causalRefs, required: debt.landingEventRef })
		) {
			return rejected({
				state: root,
				code: "debt-causality-mismatch",
				message: "Verification conclusion lacks the exact landing cause",
			});
		}
		debts.push(Object.freeze({ ...debt, verificationPending: false }));
	}
	return accepted(
		createRootState({
			status: "open",
			closure: null,
			activeAuthorization: root.activeAuthorization,
			landings: root.landings,
			debts,
		}),
	);
}
