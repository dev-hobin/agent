import {
	canonicalJson,
	jsonValueFromUnknown,
	sha256,
	type JsonValue,
} from "@hobin/judgment";

export interface SourceReading {
	readonly readingId: string;
	readonly episodeId: string;
	readonly sourceId: string;
	readonly faithfulSummary: string;
	readonly claims: readonly {
		readonly text: string;
		readonly locator: string | null;
	}[];
}
export interface InquiryContext {
	readonly inquiryContextId: string;
	readonly readingId: string;
	readonly inquiryIds: readonly string[];
	readonly contextDigest: string;
}
export interface MemoContextEvidence {
	readonly scopeId: string;
	readonly episodeId: string;
	readonly basisDigest: string;
	readonly relatedInquiryIds: readonly string[];
	readonly knownEvidenceIds: readonly string[];
	readonly passDigest: string;
	readonly outcomeCount: number;
	readonly dispositionCount: number;
}

export const OBSERVER_CONTEXT_BASIS_PROTOCOL = "observer-context-basis/v1";
interface Evaluator {
	readonly id: string;
	readonly version: string;
}
export type ObserverCoverageRelation =
	| {
			readonly needId: string;
			readonly assurance: "agent-asserted";
			readonly basisIds: readonly string[];
	  }
	| {
			readonly needId: string;
			readonly assurance: "domain-verified";
			readonly basisIds: readonly string[];
			readonly evaluator: Evaluator;
			readonly evidenceIds: readonly string[];
	  }
	| {
			readonly needId: string;
			readonly assurance: "user-accepted";
			readonly basisIds: readonly string[];
			readonly userEventId: string;
	  };
export type ObserverNeedApplicability = ObserverCoverageRelation & {
	readonly status: "required" | "not-required";
	readonly rationale: string;
};
export interface ObserverCoverageConflict {
	readonly needId: string;
	readonly basisIds: readonly string[];
	readonly description: string;
}
export interface ContextCoverageBasisData {
	readonly questionId: string;
	readonly sealedContextSha256: string;
	readonly needApplicability: readonly ObserverNeedApplicability[];
	readonly claims: readonly ObserverCoverageRelation[];
	readonly missing: readonly string[];
	readonly conflicts: readonly ObserverCoverageConflict[];
	readonly coverageSha256: string;
}
export interface ContextBasisData {
	readonly observerContextBasis: typeof OBSERVER_CONTEXT_BASIS_PROTOCOL;
	readonly contractSha256: string;
	readonly questionId: string;
	readonly selectionSha256: string;
	readonly inputSha256: string;
	readonly selectedSourceIds: readonly string[];
	readonly coverage: ContextCoverageBasisData;
	readonly basisSha256: string;
}
export interface ObserverSelectedContext {
	readonly questionId: string;
	readonly members: readonly {
		readonly sourceId: string;
		readonly contentSha256: string;
		readonly content: string;
	}[];
	readonly sealedContextSha256: string;
}
export type ContextBasisDecodeResult =
	| { readonly ok: true; readonly value: ContextBasisData }
	| { readonly ok: false; readonly message: string };
export type ObserverContextAssessment =
	| {
			readonly ok: true;
			readonly basis: ContextBasisData;
			readonly selectedContext: ObserverSelectedContext;
	  }
	| {
			readonly ok: false;
			readonly message: string;
			readonly missing: readonly string[];
			readonly conflicts: readonly string[];
	  };

function relationIdentity(
	value: ObserverCoverageRelation,
): Readonly<Record<string, JsonValue>> {
	const base = {
		needId: value.needId,
		basisIds: value.basisIds,
		assurance: value.assurance,
	};
	if (value.assurance === "domain-verified")
		return {
			...base,
			evaluator: { id: value.evaluator.id, version: value.evaluator.version },
			evidenceIds: value.evidenceIds,
		};
	if (value.assurance === "user-accepted")
		return { ...base, userEventId: value.userEventId };
	return base;
}
function applicabilityIdentity(value: ObserverNeedApplicability): JsonValue {
	return {
		...relationIdentity(value),
		status: value.status,
		rationale: value.rationale,
	};
}
function conflictIdentity(value: ObserverCoverageConflict): JsonValue {
	return {
		needId: value.needId,
		basisIds: value.basisIds,
		description: value.description,
	};
}
function coveragePayload(
	value: ContextCoverageBasisData,
): Readonly<Record<string, JsonValue>> {
	return {
		question_id: value.questionId,
		sealed_context_sha256: value.sealedContextSha256,
		need_applicability: value.needApplicability.map(applicabilityIdentity),
		claims: value.claims.map(relationIdentity),
		missing: value.missing,
		conflicts: value.conflicts.map(conflictIdentity),
		coverage_sha256: value.coverageSha256,
	};
}
function basisPayload(
	value: Omit<ContextBasisData, "basisSha256">,
): Readonly<Record<string, JsonValue>> {
	return {
		observer_context_basis: value.observerContextBasis,
		contract_sha256: value.contractSha256,
		question_id: value.questionId,
		selection_sha256: value.selectionSha256,
		input_sha256: value.inputSha256,
		selected_source_ids: value.selectedSourceIds,
		coverage: coveragePayload(value.coverage),
	};
}
function objectValue(
	value: unknown,
): Readonly<Record<string, unknown>> | undefined {
	return typeof value === "object" && value !== null && !Array.isArray(value)
		? Object.fromEntries(Object.entries(value))
		: undefined;
}
function exactKeys(
	value: Readonly<Record<string, unknown>>,
	keys: readonly string[],
): boolean {
	const actual = Object.keys(value).toSorted((left, right) =>
		left.localeCompare(right),
	);
	const expected = [...keys].toSorted((left, right) =>
		left.localeCompare(right),
	);
	return (
		actual.length === expected.length &&
		actual.every((key, index) => key === expected[index])
	);
}
function text(value: unknown): string | undefined {
	return typeof value === "string" && value.trim() === value && value.length > 0
		? value
		: undefined;
}
function sha(value: unknown): string | undefined {
	const result = text(value);
	return result && /^[a-f0-9]{64}$/u.test(result) ? result : undefined;
}
function ids(
	value: unknown,
	allowEmpty: boolean,
): readonly string[] | undefined {
	if (!Array.isArray(value) || (!allowEmpty && value.length === 0))
		return undefined;
	const parsed: string[] = [];
	for (const item of value) {
		const id = text(item);
		if (!id || parsed.includes(id)) return undefined;
		parsed.push(id);
	}
	return Object.freeze(parsed);
}
function evaluator(value: unknown): Evaluator | undefined {
	const data = objectValue(value);
	if (!data || !exactKeys(data, ["id", "version"])) return undefined;
	const id = text(data.id);
	const version = text(data.version);
	return id && version ? Object.freeze({ id, version }) : undefined;
}
function relation(
	value: unknown,
	applicability: boolean,
): ObserverCoverageRelation | ObserverNeedApplicability | undefined {
	const data = objectValue(value);
	if (!data) return undefined;
	const assurance = data.assurance;
	const needId = text(data.needId);
	const basisIds = ids(data.basisIds, true);
	if (
		!needId ||
		!basisIds ||
		!["agent-asserted", "domain-verified", "user-accepted"].includes(
			String(assurance),
		)
	)
		return undefined;
	let base: ObserverCoverageRelation;
	if (assurance === "domain-verified") {
		const parsedEvaluator = evaluator(data.evaluator);
		const evidenceIds = ids(data.evidenceIds, false);
		if (!parsedEvaluator || !evidenceIds) return undefined;
		base = Object.freeze({
			needId,
			basisIds,
			assurance,
			evaluator: parsedEvaluator,
			evidenceIds,
		});
	} else if (assurance === "user-accepted") {
		const userEventId = text(data.userEventId);
		if (!userEventId) return undefined;
		base = Object.freeze({ needId, basisIds, assurance, userEventId });
	} else if (assurance === "agent-asserted")
		base = Object.freeze({ needId, basisIds, assurance });
	else return undefined;
	if (!applicability) return base;
	const status = data.status;
	const rationale = text(data.rationale);
	if ((status !== "required" && status !== "not-required") || !rationale)
		return undefined;
	return Object.freeze({ ...base, status, rationale });
}
function conflict(value: unknown): ObserverCoverageConflict | undefined {
	const data = objectValue(value);
	if (!data || !exactKeys(data, ["needId", "basisIds", "description"]))
		return undefined;
	const needId = text(data.needId);
	const basisIds = ids(data.basisIds, false);
	const description = text(data.description);
	return needId && basisIds && description
		? Object.freeze({ needId, basisIds, description })
		: undefined;
}
function coverage(value: unknown): ContextCoverageBasisData | undefined {
	const data = objectValue(value);
	if (
		!data ||
		!exactKeys(data, [
			"question_id",
			"sealed_context_sha256",
			"need_applicability",
			"claims",
			"missing",
			"conflicts",
			"coverage_sha256",
		])
	)
		return undefined;
	if (
		!Array.isArray(data.need_applicability) ||
		!Array.isArray(data.claims) ||
		!Array.isArray(data.conflicts)
	)
		return undefined;
	const questionId = text(data.question_id);
	const sealedContextSha256 = sha(data.sealed_context_sha256);
	const coverageSha256 = sha(data.coverage_sha256);
	const missing = ids(data.missing, true);
	const needApplicability = data.need_applicability.map((item) =>
		relation(item, true),
	);
	const claims = data.claims.map((item) => relation(item, false));
	const conflicts = data.conflicts.map(conflict);
	if (
		!questionId ||
		!sealedContextSha256 ||
		!coverageSha256 ||
		!missing ||
		needApplicability.some((item) => !item) ||
		claims.some((item) => !item) ||
		conflicts.some((item) => !item)
	)
		return undefined;
	const applicabilityValues: ObserverNeedApplicability[] = [];
	for (const item of needApplicability)
		if (item && "status" in item) applicabilityValues.push(item);
	const claimValues: ObserverCoverageRelation[] = [];
	for (const item of claims)
		if (item && !("status" in item)) claimValues.push(item);
	const conflictValues: ObserverCoverageConflict[] = [];
	for (const item of conflicts) if (item) conflictValues.push(item);
	return Object.freeze({
		questionId,
		sealedContextSha256,
		needApplicability: Object.freeze(applicabilityValues),
		claims: Object.freeze(claimValues),
		missing,
		conflicts: Object.freeze(conflictValues),
		coverageSha256,
	});
}
export function decodeContextBasisData(
	value: unknown,
): ContextBasisDecodeResult {
	const data = objectValue(value);
	if (
		!data ||
		!exactKeys(data, [
			"observer_context_basis",
			"contract_sha256",
			"question_id",
			"selection_sha256",
			"input_sha256",
			"selected_source_ids",
			"coverage",
			"basis_sha256",
		])
	)
		return {
			ok: false,
			message: "Observer context basis has an invalid representation.",
		};
	if (data.observer_context_basis !== OBSERVER_CONTEXT_BASIS_PROTOCOL)
		return {
			ok: false,
			message: "Observer context basis protocol is unsupported.",
		};
	const contractSha256 = sha(data.contract_sha256);
	const questionId = text(data.question_id);
	const selectionSha256 = sha(data.selection_sha256);
	const inputSha256 = sha(data.input_sha256);
	const selectedSourceIds = ids(data.selected_source_ids, false);
	const parsedCoverage = coverage(data.coverage);
	const basisSha256 = sha(data.basis_sha256);
	if (
		!contractSha256 ||
		!questionId ||
		!selectionSha256 ||
		!inputSha256 ||
		!selectedSourceIds ||
		!parsedCoverage ||
		!basisSha256 ||
		parsedCoverage.questionId !== questionId
	)
		return { ok: false, message: "Observer context basis has invalid fields." };
	const candidate = Object.freeze({
		observerContextBasis: OBSERVER_CONTEXT_BASIS_PROTOCOL,
		contractSha256,
		questionId,
		selectionSha256,
		inputSha256,
		selectedSourceIds,
		coverage: parsedCoverage,
	});
	if (sha256(canonicalJson(basisPayload(candidate))) !== basisSha256)
		return {
			ok: false,
			message: "Observer context basis identity does not match its content.",
		};
	return { ok: true, value: Object.freeze({ ...candidate, basisSha256 }) };
}
export function encodeContextBasisData(value: ContextBasisData): unknown {
	const encoded = { ...basisPayload(value), basis_sha256: value.basisSha256 };
	const decoded = decodeContextBasisData(encoded);
	if (!decoded.ok) throw new Error(decoded.message);
	return encoded;
}

interface MaterialInput {
	readonly sourceId: string;
	readonly evaluatorId: string;
	readonly value: object;
}
function domainRelation(
	needId: string,
	basisIds: readonly string[],
	evaluatorId: string,
): ObserverCoverageRelation {
	return Object.freeze({
		needId,
		assurance: "domain-verified",
		basisIds: Object.freeze([...basisIds]),
		evaluator: Object.freeze({ id: evaluatorId, version: "1" }),
		evidenceIds: Object.freeze([...basisIds]),
	});
}
function applicability(input: {
	readonly needId: string;
	readonly status: "required" | "not-required";
	readonly rationale: string;
	readonly assurance: "agent-asserted" | "domain-verified";
	readonly basisIds: readonly string[];
	readonly evaluatorId?: string;
}): ObserverNeedApplicability {
	if (input.assurance === "domain-verified" && input.evaluatorId)
		return Object.freeze({
			...domainRelation(input.needId, input.basisIds, input.evaluatorId),
			status: input.status,
			rationale: input.rationale,
		});
	return Object.freeze({
		needId: input.needId,
		assurance: "agent-asserted",
		basisIds: Object.freeze([...input.basisIds]),
		status: input.status,
		rationale: input.rationale,
	});
}
function selectedContext(
	questionId: string,
	materials: readonly MaterialInput[],
): ObserverSelectedContext {
	const members = Object.freeze(
		materials
			.map((material) => {
				const content = canonicalJson(jsonValueFromUnknown(material.value));
				return Object.freeze({
					sourceId: material.sourceId,
					contentSha256: sha256(content),
					content,
				});
			})
			.toSorted((left, right) => left.sourceId.localeCompare(right.sourceId)),
	);
	return Object.freeze({
		questionId,
		members,
		sealedContextSha256: sha256(
			canonicalJson(jsonValueFromUnknown({ questionId, members })),
		),
	});
}
function completeAssessment(input: {
	readonly questionId: string;
	readonly contractRules: readonly string[];
	readonly inputSha256: string;
	readonly materials: readonly MaterialInput[];
	readonly needApplicability: readonly ObserverNeedApplicability[];
	readonly claims: readonly ObserverCoverageRelation[];
}): ObserverContextAssessment {
	const selected = selectedContext(input.questionId, input.materials);
	const selectedSourceIds = Object.freeze(
		input.materials
			.map((material) => material.sourceId)
			.toSorted((left, right) => left.localeCompare(right)),
	);
	const contractSha256 = sha256(
		canonicalJson(
			jsonValueFromUnknown({
				questionId: input.questionId,
				rules: input.contractRules,
			}),
		),
	);
	const selectionSha256 = sha256(
		canonicalJson(
			jsonValueFromUnknown({
				questionId: input.questionId,
				selectedSourceIds,
				members: selected.members.map((member) => ({
					sourceId: member.sourceId,
					contentSha256: member.contentSha256,
				})),
			}),
		),
	);
	const needApplicability = Object.freeze(
		[...input.needApplicability].toSorted((left, right) =>
			left.needId.localeCompare(right.needId),
		),
	);
	const claims = Object.freeze(
		[...input.claims].toSorted((left, right) =>
			left.needId.localeCompare(right.needId),
		),
	);
	const coverageIdentity = {
		questionId: input.questionId,
		sealedContextSha256: selected.sealedContextSha256,
		needApplicability: needApplicability.map(applicabilityIdentity),
		claims: claims.map(relationIdentity),
		missing: [],
		conflicts: [],
	};
	const coverageValue: ContextCoverageBasisData = Object.freeze({
		questionId: input.questionId,
		sealedContextSha256: selected.sealedContextSha256,
		needApplicability,
		claims,
		missing: Object.freeze([]),
		conflicts: Object.freeze([]),
		coverageSha256: sha256(
			canonicalJson(jsonValueFromUnknown(coverageIdentity)),
		),
	});
	const candidate = Object.freeze({
		observerContextBasis: OBSERVER_CONTEXT_BASIS_PROTOCOL,
		contractSha256,
		questionId: input.questionId,
		selectionSha256,
		inputSha256: input.inputSha256,
		selectedSourceIds,
		coverage: coverageValue,
	});
	const basis = Object.freeze({
		...candidate,
		basisSha256: sha256(canonicalJson(basisPayload(candidate))),
	});
	return { ok: true, basis, selectedContext: selected };
}
export function observationContextInputSha256(input: {
	readonly sourceReading: SourceReading;
	readonly inquiryContext: InquiryContext | null;
	readonly relatedInquiryIds: readonly string[];
}): string {
	return sha256(canonicalJson(jsonValueFromUnknown(input)));
}
export function memoContextInputSha256(input: MemoContextEvidence): string {
	return sha256(canonicalJson(jsonValueFromUnknown(input)));
}

export async function assessObservationContext(input: {
	readonly sourceReading: SourceReading;
	readonly inquiryContext: InquiryContext | null;
	readonly relatedInquiryIds: readonly string[];
}): Promise<ObserverContextAssessment> {
	const related = [...input.relatedInquiryIds];
	const inquiryRequired = related.length > 0;
	const inquiryMatches =
		!inquiryRequired ||
		Boolean(
			input.inquiryContext &&
				input.inquiryContext.readingId === input.sourceReading.readingId &&
				input.inquiryContext.inquiryIds.length === related.length &&
				input.inquiryContext.inquiryIds.every(
					(id, index) => id === related[index],
				),
		);
	if (!inquiryMatches)
		return {
			ok: false,
			message:
				"Observer context coverage is incomplete; semantic mutation is blocked.",
			missing: Object.freeze([
				"inquiry-context-basis",
				"semantic-interpretation",
			]),
			conflicts: Object.freeze([]),
		};
	const materials: MaterialInput[] = [
		{
			sourceId: "source-reading-evidence",
			evaluatorId: "observer-source-reading",
			value: input.sourceReading,
		},
	];
	if (inquiryRequired && input.inquiryContext)
		materials.push({
			sourceId: "inquiry-context-evidence",
			evaluatorId: "observer-inquiry-context",
			value: input.inquiryContext,
		});
	const sourceBasis = ["source-reading-evidence"];
	const semanticBasis = materials.map((material) => material.sourceId);
	const applicabilityValues: ObserverNeedApplicability[] = [
		applicability({
			needId: "source-reading-basis",
			status: "required",
			rationale: "A semantic observation requires its exact source reading.",
			assurance: "domain-verified",
			basisIds: sourceBasis,
			evaluatorId: "observer-source-reading",
		}),
		applicability({
			needId: "inquiry-context-basis",
			status: inquiryRequired ? "required" : "not-required",
			rationale: inquiryRequired
				? "Related inquiries require exact current inquiry context."
				: "No related inquiry was proposed.",
			assurance: inquiryRequired ? "domain-verified" : "agent-asserted",
			basisIds: inquiryRequired ? ["inquiry-context-evidence"] : [],
			...(inquiryRequired ? { evaluatorId: "observer-inquiry-context" } : {}),
		}),
		applicability({
			needId: "semantic-interpretation",
			status: "required",
			rationale:
				"The agent interprets stance and movement from selected evidence.",
			assurance: "agent-asserted",
			basisIds: semanticBasis,
		}),
		applicability({
			needId: "user-owned-interpretation",
			status: "not-required",
			rationale:
				"This evidence relation does not choose among user-owned policies.",
			assurance: "agent-asserted",
			basisIds: [],
		}),
	];
	const claims: ObserverCoverageRelation[] = [
		domainRelation(
			"source-reading-basis",
			sourceBasis,
			"observer-source-reading",
		),
		...(inquiryRequired
			? [
					domainRelation(
						"inquiry-context-basis",
						["inquiry-context-evidence"],
						"observer-inquiry-context",
					),
				]
			: []),
		Object.freeze({
			needId: "semantic-interpretation",
			assurance: "agent-asserted",
			basisIds: Object.freeze(semanticBasis),
		}),
	];
	return completeAssessment({
		questionId: "interpret-source-reading",
		contractRules: [
			"exact source reading",
			"matching inquiry context when related",
			"agent-owned semantic interpretation",
			"no user authority forgery",
		],
		inputSha256: observationContextInputSha256(input),
		materials,
		needApplicability: applicabilityValues,
		claims,
	});
}

export async function assessMemoContext(
	input: MemoContextEvidence,
): Promise<ObserverContextAssessment> {
	const materials: MaterialInput[] = [
		{
			sourceId: "memo-scope-evidence",
			evaluatorId: "observer-memo-reconciliation",
			value: {
				scopeId: input.scopeId,
				episodeId: input.episodeId,
				basisDigest: input.basisDigest,
				relatedInquiryIds: input.relatedInquiryIds,
				knownEvidenceIds: input.knownEvidenceIds,
			},
		},
		{
			sourceId: "memo-pass-evidence",
			evaluatorId: "observer-memo-reconciliation",
			value: {
				passDigest: input.passDigest,
				outcomeCount: input.outcomeCount,
				dispositionCount: input.dispositionCount,
			},
		},
	];
	const evaluatorId = "observer-memo-reconciliation";
	const scope = ["memo-scope-evidence"];
	const pass = ["memo-pass-evidence"];
	const combined = [...scope, ...pass];
	const applicabilityValues: ObserverNeedApplicability[] = [
		applicability({
			needId: "exact-memo-basis",
			status: "required",
			rationale: "A parsed memo pass requires its exact scope basis.",
			assurance: "domain-verified",
			basisIds: scope,
			evaluatorId,
		}),
		applicability({
			needId: "evidence-closure",
			status: "required",
			rationale: "A parsed memo pass requires exact evidence closure.",
			assurance: "domain-verified",
			basisIds: pass,
			evaluatorId,
		}),
		applicability({
			needId: "outcome-accounting",
			status: "required",
			rationale:
				"A parsed memo pass requires exact outcome and disposition accounting.",
			assurance: "domain-verified",
			basisIds: pass,
			evaluatorId,
		}),
		applicability({
			needId: "user-owned-memo-policy",
			status: "not-required",
			rationale:
				"The parsed pass contains no unresolved user-owned promotion policy.",
			assurance: "agent-asserted",
			basisIds: [],
		}),
	];
	const claims = [
		domainRelation("exact-memo-basis", scope, evaluatorId),
		domainRelation("evidence-closure", combined, evaluatorId),
		domainRelation("outcome-accounting", pass, evaluatorId),
	];
	return completeAssessment({
		questionId: "reconcile-memo-pass",
		contractRules: [
			"exact memo scope",
			"exact reconciliation pass",
			"complete outcome accounting",
			"no user policy forgery",
		],
		inputSha256: memoContextInputSha256(input),
		materials,
		needApplicability: applicabilityValues,
		claims,
	});
}
