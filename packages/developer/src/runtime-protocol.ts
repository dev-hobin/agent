import {
	jsonValueFromUnknown,
	sha256,
	type ContextUse,
	type JsonValue,
} from "@hobin/judgment";

export const DEVELOPER_RUNTIME_PROTOCOL = "developer/v8" as const;
export const DEVELOPER_SKILL_RETURN_CONTRACT =
	"developer-skill-return/v1" as const;
export const MAX_RUNTIME_TEXT_LENGTH = 4_000;
export const MAX_RUNTIME_ARRAY_LENGTH = 100;
export const MAX_EVENT_PAYLOAD_BYTES = 64_000;

const IDENTIFIER = /^[A-Za-z][A-Za-z0-9._:/-]*$/u;
const SHA256 = /^[a-f0-9]{64}$/u;
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const encoder = new TextEncoder();

declare const developerIdBrand: unique symbol;
declare const sha256DigestBrand: unique symbol;

export type DeveloperId = string & {
	readonly [developerIdBrand]: "DeveloperId";
};
export type Sha256Digest = string & {
	readonly [sha256DigestBrand]: "Sha256Digest";
};

export class DeveloperRuntimeProtocolParseError extends Error {
	readonly code = "developer.runtime-protocol.invalid";

	constructor(message: string) {
		super(message);
		this.name = "DeveloperRuntimeProtocolParseError";
	}
}

type ObjectValue = Record<string, unknown>;

function fail(path: string, message: string): never {
	throw new DeveloperRuntimeProtocolParseError(`${path}: ${message}`);
}

function objectAt(value: unknown, path: string): ObjectValue {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		return fail(path, "expected an object");
	}
	return value as ObjectValue;
}

function exactKeys(
	value: ObjectValue,
	path: string,
	required: readonly string[],
	optional: readonly string[] = [],
): void {
	const allowed = new Set([...required, ...optional]);
	for (const key of required) {
		if (!Object.hasOwn(value, key)) fail(`${path}.${key}`, "is required");
	}
	for (const key of Object.keys(value)) {
		if (!allowed.has(key)) fail(`${path}.${key}`, "is not allowed");
	}
}

function textAt(
	value: unknown,
	path: string,
	options: { readonly max?: number; readonly pattern?: RegExp } = {},
): string {
	if (typeof value !== "string" || value.trim().length === 0) {
		return fail(path, "expected non-blank text");
	}
	if (value !== value.trim())
		fail(path, "must not contain surrounding whitespace");
	if (value.length > (options.max ?? MAX_RUNTIME_TEXT_LENGTH)) {
		fail(path, "text is too long");
	}
	if (options.pattern && !options.pattern.test(value)) {
		fail(path, "text has an invalid representation");
	}
	return value;
}

function integerAt(
	value: unknown,
	path: string,
	options: { readonly min?: number; readonly max?: number } = {},
): number {
	if (!Number.isSafeInteger(value))
		return fail(path, "expected a safe integer");
	const number = value as number;
	if (number < (options.min ?? 0)) fail(path, "integer is too small");
	if (number > (options.max ?? Number.MAX_SAFE_INTEGER)) {
		fail(path, "integer is too large");
	}
	return number;
}

function literalAt<const T extends string>(
	value: unknown,
	path: string,
	allowed: readonly T[],
): T {
	if (typeof value !== "string" || !allowed.includes(value as T)) {
		return fail(path, `expected one of ${allowed.join(", ")}`);
	}
	return value as T;
}

function arrayAt<T>(
	value: unknown,
	path: string,
	parse: (entry: unknown, entryPath: string) => T,
	options: {
		readonly nonEmpty?: boolean;
		readonly max?: number;
	} = {},
): readonly T[] {
	if (!Array.isArray(value)) return fail(path, "expected an array");
	if (options.nonEmpty && value.length === 0) fail(path, "must not be empty");
	if (value.length > (options.max ?? MAX_RUNTIME_ARRAY_LENGTH)) {
		fail(path, "has too many items");
	}
	return Object.freeze(
		value.map((entry, index) => parse(entry, `${path}[${index}]`)),
	);
}

function uniqueBy<T>(
	values: readonly T[],
	path: string,
	identity: (value: T) => string,
): readonly T[] {
	const seen = new Set<string>();
	for (const value of values) {
		const id = identity(value);
		if (seen.has(id)) fail(path, "contains duplicates");
		seen.add(id);
	}
	return values;
}

function canonicalOrder<T>(
	values: readonly T[],
	path: string,
	identity: (value: T) => string,
): readonly T[] {
	for (let index = 1; index < values.length; index += 1) {
		const previous = values[index - 1];
		const current = values[index];
		if (
			previous !== undefined &&
			current !== undefined &&
			identity(previous) >= identity(current)
		) {
			fail(path, "must be unique and in canonical order");
		}
	}
	return values;
}

function isJsonArray(value: JsonValue): value is readonly JsonValue[] {
	return Array.isArray(value);
}

export function canonicalRuntimeJson(value: JsonValue): string {
	if (value === null || typeof value !== "object") return JSON.stringify(value);
	if (isJsonArray(value)) {
		return `[${value.map((entry) => canonicalRuntimeJson(entry)).join(",")}]`;
	}
	return `{${Object.keys(value)
		.sort()
		.map((key) => `${JSON.stringify(key)}:${canonicalRuntimeJson(value[key])}`)
		.join(",")}}`;
}

function freezeJson(value: JsonValue): JsonValue {
	if (Array.isArray(value)) {
		return Object.freeze(value.map((entry) => freezeJson(entry)));
	}
	if (value !== null && typeof value === "object") {
		return Object.freeze(
			Object.fromEntries(
				Object.entries(value).map(([key, entry]) => [key, freezeJson(entry)]),
			),
		);
	}
	return value;
}

function jsonAt(value: unknown, path: string): JsonValue {
	let json: JsonValue;
	try {
		json = jsonValueFromUnknown(value, `${path}/`);
	} catch (error) {
		return fail(
			path,
			error instanceof Error ? error.message : "expected a JSON value",
		);
	}
	if (
		encoder.encode(canonicalRuntimeJson(json)).byteLength >
		MAX_EVENT_PAYLOAD_BYTES
	) {
		fail(path, "JSON value exceeds its byte limit");
	}
	return freezeJson(json);
}

export function parseDeveloperId(
	value: unknown,
	path = "developerId",
): DeveloperId {
	return textAt(value, path, { max: 160, pattern: IDENTIFIER }) as DeveloperId;
}

export function parseSha256Digest(
	value: unknown,
	path = "sha256",
): Sha256Digest {
	return textAt(value, path, { max: 64, pattern: SHA256 }) as Sha256Digest;
}

export function canonicalValueSha256(value: unknown): Sha256Digest {
	return parseSha256Digest(
		sha256(canonicalRuntimeJson(jsonValueFromUnknown(value))),
		"canonicalValueSha256",
	);
}

function timestampAt(value: unknown, path: string): string {
	const timestamp = textAt(value, path, { max: 24, pattern: TIMESTAMP });
	if (new Date(timestamp).toISOString() !== timestamp) {
		fail(path, "expected a canonical UTC timestamp");
	}
	return timestamp;
}

function idArrayAt(
	value: unknown,
	path: string,
	options: { readonly nonEmpty?: boolean; readonly canonical?: boolean } = {},
): readonly DeveloperId[] {
	const ids = uniqueBy(
		arrayAt(value, path, parseDeveloperId, {
			nonEmpty: options.nonEmpty,
		}),
		path,
		(value) => value,
	);
	return options.canonical ? canonicalOrder(ids, path, (entry) => entry) : ids;
}

function textArrayAt(
	value: unknown,
	path: string,
	options: { readonly nonEmpty?: boolean; readonly max?: number } = {},
): readonly string[] {
	return uniqueBy(
		arrayAt(value, path, textAt, options),
		path,
		(entry) => entry,
	);
}

export interface RouteDefinition {
	readonly routeDefinitionId: DeveloperId;
	readonly sign: string;
	readonly sense: string;
	readonly revisionSha256: Sha256Digest;
}

export type RouteDefinitionBody = Omit<RouteDefinition, "revisionSha256">;

export function routeDefinitionSha256(
	value: RouteDefinitionBody,
): Sha256Digest {
	return canonicalValueSha256({
		domain: "developer.route-definition/v1",
		value,
	});
}

export function createRouteDefinition(
	value: RouteDefinitionBody,
): RouteDefinition {
	return parseRouteDefinition({
		...value,
		revisionSha256: routeDefinitionSha256(value),
	});
}

export function parseRouteDefinition(
	value: unknown,
	path = "routeDefinition",
): RouteDefinition {
	const data = objectAt(value, path);
	exactKeys(data, path, [
		"routeDefinitionId",
		"sign",
		"sense",
		"revisionSha256",
	]);
	const body = Object.freeze({
		routeDefinitionId: parseDeveloperId(
			data.routeDefinitionId,
			`${path}.routeDefinitionId`,
		),
		sign: textAt(data.sign, `${path}.sign`, { max: 500 }),
		sense: textAt(data.sense, `${path}.sense`),
	});
	const revisionSha256 = parseSha256Digest(
		data.revisionSha256,
		`${path}.revisionSha256`,
	);
	if (routeDefinitionSha256(body) !== revisionSha256) {
		fail(`${path}.revisionSha256`, "does not match the route definition");
	}
	return Object.freeze({ ...body, revisionSha256 });
}

export interface Obligation {
	readonly obligationId: DeveloperId;
	readonly frameId: DeveloperId;
	readonly statement: string;
}

export function parseObligation(
	value: unknown,
	path = "obligation",
): Obligation {
	const data = objectAt(value, path);
	exactKeys(data, path, ["obligationId", "frameId", "statement"]);
	return Object.freeze({
		obligationId: parseDeveloperId(data.obligationId, `${path}.obligationId`),
		frameId: parseDeveloperId(data.frameId, `${path}.frameId`),
		statement: textAt(data.statement, `${path}.statement`),
	});
}

export function obligationSetSha256(
	obligations: readonly Obligation[],
): Sha256Digest {
	const ordered = [...obligations].sort((left, right) => {
		if (left.obligationId < right.obligationId) return -1;
		if (left.obligationId > right.obligationId) return 1;
		return 0;
	});
	uniqueBy(ordered, "obligations", (entry) => entry.obligationId);
	return canonicalValueSha256(ordered);
}

export interface RouteFrame {
	readonly frameId: DeveloperId;
	readonly frameRevision: number;
	readonly workScopeId: DeveloperId;
	readonly parentFrameId: DeveloperId | null;
	readonly routeDefinitionId: DeveloperId;
	readonly routeDefinitionRevisionSha256: Sha256Digest;
	readonly exactQuestion: string;
	readonly obligationIds: readonly DeveloperId[];
	readonly obligationSetSha256: Sha256Digest;
}

export function parseRouteFrame(
	value: unknown,
	path = "routeFrame",
): RouteFrame {
	const data = objectAt(value, path);
	exactKeys(data, path, [
		"frameId",
		"frameRevision",
		"workScopeId",
		"parentFrameId",
		"routeDefinitionId",
		"routeDefinitionRevisionSha256",
		"exactQuestion",
		"obligationIds",
		"obligationSetSha256",
	]);
	return Object.freeze({
		frameId: parseDeveloperId(data.frameId, `${path}.frameId`),
		frameRevision: integerAt(data.frameRevision, `${path}.frameRevision`),
		workScopeId: parseDeveloperId(data.workScopeId, `${path}.workScopeId`),
		parentFrameId:
			data.parentFrameId === null
				? null
				: parseDeveloperId(data.parentFrameId, `${path}.parentFrameId`),
		routeDefinitionId: parseDeveloperId(
			data.routeDefinitionId,
			`${path}.routeDefinitionId`,
		),
		routeDefinitionRevisionSha256: parseSha256Digest(
			data.routeDefinitionRevisionSha256,
			`${path}.routeDefinitionRevisionSha256`,
		),
		exactQuestion: textAt(data.exactQuestion, `${path}.exactQuestion`),
		obligationIds: idArrayAt(data.obligationIds, `${path}.obligationIds`, {
			nonEmpty: true,
			canonical: true,
		}),
		obligationSetSha256: parseSha256Digest(
			data.obligationSetSha256,
			`${path}.obligationSetSha256`,
		),
	});
}

export interface ContentAddress {
	readonly algorithm: "sha256";
	readonly digest: Sha256Digest;
	readonly byteLength: number;
}

export function parseContentAddress(
	value: unknown,
	path = "contentAddress",
): ContentAddress {
	const data = objectAt(value, path);
	exactKeys(data, path, ["algorithm", "digest", "byteLength"]);
	return Object.freeze({
		algorithm: literalAt(data.algorithm, `${path}.algorithm`, ["sha256"]),
		digest: parseSha256Digest(data.digest, `${path}.digest`),
		byteLength: integerAt(data.byteLength, `${path}.byteLength`),
	});
}

export interface MaterialSealRef {
	readonly sealId: DeveloperId;
	readonly contentAddress: ContentAddress;
	readonly sourceRef: DeveloperId;
	readonly sourceRevision: string;
}

export function parseMaterialSealRef(
	value: unknown,
	path = "materialSealRef",
): MaterialSealRef {
	const data = objectAt(value, path);
	exactKeys(data, path, [
		"sealId",
		"contentAddress",
		"sourceRef",
		"sourceRevision",
	]);
	return Object.freeze({
		sealId: parseDeveloperId(data.sealId, `${path}.sealId`),
		contentAddress: parseContentAddress(
			data.contentAddress,
			`${path}.contentAddress`,
		),
		sourceRef: parseDeveloperId(data.sourceRef, `${path}.sourceRef`),
		sourceRevision: textAt(data.sourceRevision, `${path}.sourceRevision`, {
			max: 1_000,
		}),
	});
}

export interface SourceRevisionRef {
	readonly sourceId: DeveloperId;
	readonly revision: string;
}

function parseSourceRevisionRef(
	value: unknown,
	path: string,
): SourceRevisionRef {
	const data = objectAt(value, path);
	exactKeys(data, path, ["sourceId", "revision"]);
	return Object.freeze({
		sourceId: parseDeveloperId(data.sourceId, `${path}.sourceId`),
		revision: textAt(data.revision, `${path}.revision`, { max: 1_000 }),
	});
}

export interface SnapshotBasis {
	readonly frameId: DeveloperId;
	readonly frameRevision: number;
	readonly obligationSetSha256: Sha256Digest;
	readonly admittedUniverseSha256: Sha256Digest;
	readonly providerSourceRevisions: readonly SourceRevisionRef[];
	readonly priorityStrategySha256: Sha256Digest;
}

export function parseSnapshotBasis(
	value: unknown,
	path = "snapshotBasis",
): SnapshotBasis {
	const data = objectAt(value, path);
	exactKeys(data, path, [
		"frameId",
		"frameRevision",
		"obligationSetSha256",
		"admittedUniverseSha256",
		"providerSourceRevisions",
		"priorityStrategySha256",
	]);
	const revisions = arrayAt(
		data.providerSourceRevisions,
		`${path}.providerSourceRevisions`,
		parseSourceRevisionRef,
	);
	canonicalOrder(revisions, `${path}.providerSourceRevisions`, (entry) =>
		entry.sourceId.toString(),
	);
	return Object.freeze({
		frameId: parseDeveloperId(data.frameId, `${path}.frameId`),
		frameRevision: integerAt(data.frameRevision, `${path}.frameRevision`),
		obligationSetSha256: parseSha256Digest(
			data.obligationSetSha256,
			`${path}.obligationSetSha256`,
		),
		admittedUniverseSha256: parseSha256Digest(
			data.admittedUniverseSha256,
			`${path}.admittedUniverseSha256`,
		),
		providerSourceRevisions: revisions,
		priorityStrategySha256: parseSha256Digest(
			data.priorityStrategySha256,
			`${path}.priorityStrategySha256`,
		),
	});
}

export function snapshotBasisSha256(value: SnapshotBasis): Sha256Digest {
	return canonicalValueSha256({
		domain: "developer.snapshot-basis/v1",
		value,
	});
}

export interface SnapshotSealManifest {
	readonly snapshotId: DeveloperId;
	readonly snapshotBasisSha256: Sha256Digest;
	readonly pageCount: number;
	readonly candidateCount: number;
	readonly orderedPageRootSha256: Sha256Digest;
}

export function parseSnapshotSealManifest(
	value: unknown,
	path = "snapshotSealManifest",
): SnapshotSealManifest {
	const data = objectAt(value, path);
	exactKeys(data, path, [
		"snapshotId",
		"snapshotBasisSha256",
		"pageCount",
		"candidateCount",
		"orderedPageRootSha256",
	]);
	return Object.freeze({
		snapshotId: parseDeveloperId(data.snapshotId, `${path}.snapshotId`),
		snapshotBasisSha256: parseSha256Digest(
			data.snapshotBasisSha256,
			`${path}.snapshotBasisSha256`,
		),
		pageCount: integerAt(data.pageCount, `${path}.pageCount`),
		candidateCount: integerAt(data.candidateCount, `${path}.candidateCount`),
		orderedPageRootSha256: parseSha256Digest(
			data.orderedPageRootSha256,
			`${path}.orderedPageRootSha256`,
		),
	});
}

export interface ReadySkillAssignment {
	readonly assignmentId: DeveloperId;
	readonly skillCapabilityId: DeveloperId;
	readonly skillRevisionSha256: Sha256Digest;
	readonly parentFrameId: DeveloperId;
	readonly parentFrameRevision: number;
	readonly targetObligationIds: readonly DeveloperId[];
	readonly subquestion: string;
	readonly applicabilityBasisSha256: Sha256Digest;
	readonly expectedContribution: string;
	readonly limitations: readonly string[];
	readonly returnContract: typeof DEVELOPER_SKILL_RETURN_CONTRACT;
	readonly contextBasisSha256: Sha256Digest;
	readonly authority: "contribution-only";
	readonly assignmentRevisionSha256: Sha256Digest;
}

export type ReadySkillAssignmentBody = Omit<
	ReadySkillAssignment,
	"assignmentRevisionSha256"
>;

export function readySkillAssignmentSha256(
	value: ReadySkillAssignmentBody,
): Sha256Digest {
	return canonicalValueSha256({
		domain: "developer.ready-skill-assignment/v1",
		value,
	});
}

export function createReadySkillAssignment(
	value: ReadySkillAssignmentBody,
): ReadySkillAssignment {
	return parseReadySkillAssignment({
		...value,
		assignmentRevisionSha256: readySkillAssignmentSha256(value),
	});
}

export function parseReadySkillAssignment(
	value: unknown,
	path = "readySkillAssignment",
): ReadySkillAssignment {
	const data = objectAt(value, path);
	exactKeys(data, path, [
		"assignmentId",
		"skillCapabilityId",
		"skillRevisionSha256",
		"parentFrameId",
		"parentFrameRevision",
		"targetObligationIds",
		"subquestion",
		"applicabilityBasisSha256",
		"expectedContribution",
		"limitations",
		"returnContract",
		"contextBasisSha256",
		"authority",
		"assignmentRevisionSha256",
	]);
	const body = Object.freeze({
		assignmentId: parseDeveloperId(data.assignmentId, `${path}.assignmentId`),
		skillCapabilityId: parseDeveloperId(
			data.skillCapabilityId,
			`${path}.skillCapabilityId`,
		),
		skillRevisionSha256: parseSha256Digest(
			data.skillRevisionSha256,
			`${path}.skillRevisionSha256`,
		),
		parentFrameId: parseDeveloperId(
			data.parentFrameId,
			`${path}.parentFrameId`,
		),
		parentFrameRevision: integerAt(
			data.parentFrameRevision,
			`${path}.parentFrameRevision`,
		),
		targetObligationIds: idArrayAt(
			data.targetObligationIds,
			`${path}.targetObligationIds`,
			{ nonEmpty: true, canonical: true },
		),
		subquestion: textAt(data.subquestion, `${path}.subquestion`),
		applicabilityBasisSha256: parseSha256Digest(
			data.applicabilityBasisSha256,
			`${path}.applicabilityBasisSha256`,
		),
		expectedContribution: textAt(
			data.expectedContribution,
			`${path}.expectedContribution`,
		),
		limitations: textArrayAt(data.limitations, `${path}.limitations`, {
			max: 32,
		}),
		returnContract: literalAt(data.returnContract, `${path}.returnContract`, [
			DEVELOPER_SKILL_RETURN_CONTRACT,
		]),
		contextBasisSha256: parseSha256Digest(
			data.contextBasisSha256,
			`${path}.contextBasisSha256`,
		),
		authority: literalAt(data.authority, `${path}.authority`, [
			"contribution-only",
		]),
	});
	const assignmentRevisionSha256 = parseSha256Digest(
		data.assignmentRevisionSha256,
		`${path}.assignmentRevisionSha256`,
	);
	if (readySkillAssignmentSha256(body) !== assignmentRevisionSha256) {
		fail(`${path}.assignmentRevisionSha256`, "does not match the assignment");
	}
	return Object.freeze({ ...body, assignmentRevisionSha256 });
}

export interface ContributionTargetUse {
	readonly obligationId: DeveloperId;
	readonly useAs: ContextUse;
}

function contextUseAt(value: unknown, path: string): ContextUse {
	return literalAt(value, path, [
		"constraint",
		"evidence",
		"decision",
		"method",
		"guidance",
	]);
}

function parseContributionTargetUse(
	value: unknown,
	path: string,
): ContributionTargetUse {
	const data = objectAt(value, path);
	exactKeys(data, path, ["obligationId", "useAs"]);
	return Object.freeze({
		obligationId: parseDeveloperId(data.obligationId, `${path}.obligationId`),
		useAs: contextUseAt(data.useAs, `${path}.useAs`),
	});
}

export type ParsedSkillReturn =
	| Readonly<{
			kind: "contribution";
			claim: string;
			applicability: string;
			targetUses: readonly ContributionTargetUse[];
			limitations: readonly string[];
	  }>
	| Readonly<{
			kind: "dependency";
			dependencyId: DeveloperId;
			targetObligationIds: readonly DeveloperId[];
			question: string;
			reason: string;
	  }>
	| Readonly<{
			kind: "not-applicable";
			targetObligationIds: readonly DeveloperId[];
			reason: string;
	  }>
	| Readonly<{
			kind: "needs-context";
			targetObligationIds: readonly DeveloperId[];
			missingContext: readonly string[];
	  }>
	| Readonly<{ kind: "abort"; reason: string }>;

export function parseSkillReturn(
	value: unknown,
	path = "skillReturn",
): ParsedSkillReturn {
	const data = objectAt(value, path);
	const kind = literalAt(data.kind, `${path}.kind`, [
		"contribution",
		"dependency",
		"not-applicable",
		"needs-context",
		"abort",
	]);
	if (kind === "contribution") {
		exactKeys(data, path, [
			"kind",
			"claim",
			"applicability",
			"targetUses",
			"limitations",
		]);
		const targetUses = uniqueBy(
			arrayAt(
				data.targetUses,
				`${path}.targetUses`,
				parseContributionTargetUse,
				{ nonEmpty: true },
			),
			`${path}.targetUses`,
			(entry) => `${entry.obligationId}:${entry.useAs}`,
		);
		return Object.freeze({
			kind,
			claim: textAt(data.claim, `${path}.claim`),
			applicability: textAt(data.applicability, `${path}.applicability`),
			targetUses,
			limitations: textArrayAt(data.limitations, `${path}.limitations`, {
				max: 32,
			}),
		});
	}
	if (kind === "dependency") {
		exactKeys(data, path, [
			"kind",
			"dependencyId",
			"targetObligationIds",
			"question",
			"reason",
		]);
		return Object.freeze({
			kind,
			dependencyId: parseDeveloperId(data.dependencyId, `${path}.dependencyId`),
			targetObligationIds: idArrayAt(
				data.targetObligationIds,
				`${path}.targetObligationIds`,
				{ nonEmpty: true, canonical: true },
			),
			question: textAt(data.question, `${path}.question`),
			reason: textAt(data.reason, `${path}.reason`),
		});
	}
	if (kind === "not-applicable") {
		exactKeys(data, path, ["kind", "targetObligationIds", "reason"]);
		return Object.freeze({
			kind,
			targetObligationIds: idArrayAt(
				data.targetObligationIds,
				`${path}.targetObligationIds`,
				{ nonEmpty: true, canonical: true },
			),
			reason: textAt(data.reason, `${path}.reason`),
		});
	}
	if (kind === "needs-context") {
		exactKeys(data, path, ["kind", "targetObligationIds", "missingContext"]);
		return Object.freeze({
			kind,
			targetObligationIds: idArrayAt(
				data.targetObligationIds,
				`${path}.targetObligationIds`,
				{ nonEmpty: true, canonical: true },
			),
			missingContext: textArrayAt(
				data.missingContext,
				`${path}.missingContext`,
				{ nonEmpty: true, max: 32 },
			),
		});
	}
	exactKeys(data, path, ["kind", "reason"]);
	return Object.freeze({
		kind,
		reason: textAt(data.reason, `${path}.reason`),
	});
}

export type CapabilityFailure =
	| Readonly<{ kind: "resolver-error"; message: string }>
	| Readonly<{ kind: "invalid-or-silent-return"; reason: string }>
	| Readonly<{ kind: "timeout"; timeoutMs: number }>;

export type LifecycleSettlement = Readonly<{
	kind: "cancelled" | "superseded" | "stale";
	reason: string;
	executionUncertain: boolean;
}>;

export type InvocationSettlement =
	| Readonly<{
			kind: "returned";
			invocationId: DeveloperId;
			assignmentId: DeveloperId;
			value: ParsedSkillReturn;
	  }>
	| Readonly<{
			kind: "capability-failed";
			invocationId: DeveloperId;
			assignmentId: DeveloperId;
			failure: CapabilityFailure;
	  }>
	| Readonly<{
			kind: "lifecycle";
			invocationId: DeveloperId;
			assignmentId: DeveloperId;
			lifecycle: LifecycleSettlement;
	  }>;

function parseCapabilityFailure(
	value: unknown,
	path: string,
): CapabilityFailure {
	const data = objectAt(value, path);
	const kind = literalAt(data.kind, `${path}.kind`, [
		"resolver-error",
		"invalid-or-silent-return",
		"timeout",
	]);
	if (kind === "resolver-error") {
		exactKeys(data, path, ["kind", "message"]);
		return Object.freeze({
			kind,
			message: textAt(data.message, `${path}.message`),
		});
	}
	if (kind === "invalid-or-silent-return") {
		exactKeys(data, path, ["kind", "reason"]);
		return Object.freeze({
			kind,
			reason: textAt(data.reason, `${path}.reason`),
		});
	}
	exactKeys(data, path, ["kind", "timeoutMs"]);
	return Object.freeze({
		kind,
		timeoutMs: integerAt(data.timeoutMs, `${path}.timeoutMs`, { min: 1 }),
	});
}

function parseLifecycleSettlement(
	value: unknown,
	path: string,
): LifecycleSettlement {
	const data = objectAt(value, path);
	exactKeys(data, path, ["kind", "reason", "executionUncertain"]);
	return Object.freeze({
		kind: literalAt(data.kind, `${path}.kind`, [
			"cancelled",
			"superseded",
			"stale",
		]),
		reason: textAt(data.reason, `${path}.reason`),
		executionUncertain:
			typeof data.executionUncertain === "boolean"
				? data.executionUncertain
				: fail(`${path}.executionUncertain`, "expected a boolean"),
	});
}

export function parseInvocationSettlement(
	value: unknown,
	path = "invocationSettlement",
): InvocationSettlement {
	const data = objectAt(value, path);
	const kind = literalAt(data.kind, `${path}.kind`, [
		"returned",
		"capability-failed",
		"lifecycle",
	]);
	const invocationId = parseDeveloperId(
		data.invocationId,
		`${path}.invocationId`,
	);
	const assignmentId = parseDeveloperId(
		data.assignmentId,
		`${path}.assignmentId`,
	);
	if (kind === "returned") {
		exactKeys(data, path, ["kind", "invocationId", "assignmentId", "value"]);
		return Object.freeze({
			kind,
			invocationId,
			assignmentId,
			value: parseSkillReturn(data.value, `${path}.value`),
		});
	}
	if (kind === "capability-failed") {
		exactKeys(data, path, ["kind", "invocationId", "assignmentId", "failure"]);
		return Object.freeze({
			kind,
			invocationId,
			assignmentId,
			failure: parseCapabilityFailure(data.failure, `${path}.failure`),
		});
	}
	exactKeys(data, path, ["kind", "invocationId", "assignmentId", "lifecycle"]);
	return Object.freeze({
		kind,
		invocationId,
		assignmentId,
		lifecycle: parseLifecycleSettlement(data.lifecycle, `${path}.lifecycle`),
	});
}

export interface FrameConclusionProposal {
	readonly frameId: DeveloperId;
	readonly expectedFrameRevision: number;
	readonly dischargeIds: readonly DeveloperId[];
	readonly stopEvidence: readonly string[];
	readonly expectedBlockerSetSha256: Sha256Digest;
	readonly conclusion: string;
}

export function parseFrameConclusionProposal(
	value: unknown,
	path = "frameConclusionProposal",
): FrameConclusionProposal {
	const data = objectAt(value, path);
	exactKeys(data, path, [
		"frameId",
		"expectedFrameRevision",
		"dischargeIds",
		"stopEvidence",
		"expectedBlockerSetSha256",
		"conclusion",
	]);
	return Object.freeze({
		frameId: parseDeveloperId(data.frameId, `${path}.frameId`),
		expectedFrameRevision: integerAt(
			data.expectedFrameRevision,
			`${path}.expectedFrameRevision`,
		),
		dischargeIds: idArrayAt(data.dischargeIds, `${path}.dischargeIds`, {
			canonical: true,
		}),
		stopEvidence: textArrayAt(data.stopEvidence, `${path}.stopEvidence`, {
			nonEmpty: true,
			max: 32,
		}),
		expectedBlockerSetSha256: parseSha256Digest(
			data.expectedBlockerSetSha256,
			`${path}.expectedBlockerSetSha256`,
		),
		conclusion: textAt(data.conclusion, `${path}.conclusion`),
	});
}

export interface DeveloperEventRef {
	readonly workScopeId: DeveloperId;
	readonly eventId: DeveloperId;
	readonly eventSha256: Sha256Digest;
}

export type CausalEventRef = DeveloperEventRef;

export function parseDeveloperEventRef(
	value: unknown,
	path = "eventRef",
): DeveloperEventRef {
	const data = objectAt(value, path);
	exactKeys(data, path, ["workScopeId", "eventId", "eventSha256"]);
	return Object.freeze({
		workScopeId: parseDeveloperId(data.workScopeId, `${path}.workScopeId`),
		eventId: parseDeveloperId(data.eventId, `${path}.eventId`),
		eventSha256: parseSha256Digest(data.eventSha256, `${path}.eventSha256`),
	});
}

export interface DeveloperEventDraft<Payload extends JsonValue = JsonValue> {
	readonly protocolVersion: typeof DEVELOPER_RUNTIME_PROTOCOL;
	readonly eventId: DeveloperId;
	readonly workScopeId: DeveloperId;
	readonly scopeSequence: number;
	readonly previousScopeEventSha256: Sha256Digest | null;
	readonly causalRefs: readonly CausalEventRef[];
	readonly occurredAt: string;
	readonly kind: DeveloperId;
	readonly payload: Payload;
}

export interface DeveloperEventEnvelope<Payload extends JsonValue = JsonValue>
	extends DeveloperEventDraft<Payload> {
	readonly eventSha256: Sha256Digest;
}

export function developerEventSha256(value: DeveloperEventDraft): Sha256Digest {
	return canonicalValueSha256({
		domain: "developer.event-envelope/v8",
		value,
	});
}

export function createDeveloperEventEnvelope<Payload extends JsonValue>(
	value: DeveloperEventDraft<Payload>,
): DeveloperEventEnvelope<Payload> {
	return parseDeveloperEventEnvelope({
		...value,
		eventSha256: developerEventSha256(value),
	}) as DeveloperEventEnvelope<Payload>;
}

export function parseDeveloperEventEnvelope(
	value: unknown,
	path = "developerEventEnvelope",
): DeveloperEventEnvelope {
	const data = objectAt(value, path);
	exactKeys(data, path, [
		"protocolVersion",
		"eventId",
		"workScopeId",
		"scopeSequence",
		"previousScopeEventSha256",
		"causalRefs",
		"occurredAt",
		"kind",
		"payload",
		"eventSha256",
	]);
	const scopeSequence = integerAt(data.scopeSequence, `${path}.scopeSequence`, {
		max: 1_000_000_000,
	});
	const previousScopeEventSha256 =
		data.previousScopeEventSha256 === null
			? null
			: parseSha256Digest(
					data.previousScopeEventSha256,
					`${path}.previousScopeEventSha256`,
				);
	if (scopeSequence === 0 && previousScopeEventSha256 !== null) {
		fail(
			`${path}.previousScopeEventSha256`,
			"must be null for the first scope event",
		);
	}
	if (scopeSequence > 0 && previousScopeEventSha256 === null) {
		fail(
			`${path}.previousScopeEventSha256`,
			"is required after the first scope event",
		);
	}
	const causalRefs = uniqueBy(
		arrayAt(data.causalRefs, `${path}.causalRefs`, parseDeveloperEventRef),
		`${path}.causalRefs`,
		(entry) => `${entry.workScopeId}:${entry.eventId}:${entry.eventSha256}`,
	);
	canonicalOrder(
		causalRefs,
		`${path}.causalRefs`,
		(entry) => `${entry.workScopeId}:${entry.eventId}:${entry.eventSha256}`,
	);
	const draft = Object.freeze({
		protocolVersion: literalAt(
			data.protocolVersion,
			`${path}.protocolVersion`,
			[DEVELOPER_RUNTIME_PROTOCOL],
		),
		eventId: parseDeveloperId(data.eventId, `${path}.eventId`),
		workScopeId: parseDeveloperId(data.workScopeId, `${path}.workScopeId`),
		scopeSequence,
		previousScopeEventSha256,
		causalRefs,
		occurredAt: timestampAt(data.occurredAt, `${path}.occurredAt`),
		kind: parseDeveloperId(data.kind, `${path}.kind`),
		payload: jsonAt(data.payload, `${path}.payload`),
	});
	const eventSha256 = parseSha256Digest(
		data.eventSha256,
		`${path}.eventSha256`,
	);
	if (developerEventSha256(draft) !== eventSha256) {
		fail(`${path}.eventSha256`, "does not match the canonical event body");
	}
	return Object.freeze({ ...draft, eventSha256 });
}

export function canonicalDeveloperEventJson(
	value: DeveloperEventEnvelope,
): string {
	return canonicalRuntimeJson(jsonValueFromUnknown(value));
}
