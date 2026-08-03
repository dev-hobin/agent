import type { ContextUse } from "@hobin/judgment";

import {
	MAX_RUNTIME_ARRAY_LENGTH,
	MAX_RUNTIME_TEXT_LENGTH,
	canonicalValueSha256,
	obligationSetSha256,
	parseDeveloperId,
	parseObligation,
	parseSha256Digest,
	parseSnapshotBasis,
	parseSnapshotSealManifest,
	snapshotBasisSha256,
	type ContributionTargetUse,
	type DeveloperId,
	type Obligation,
	type Sha256Digest,
	type SnapshotBasis,
	type SnapshotSealManifest,
	type SourceRevisionRef,
} from "./runtime-protocol.ts";

export const MAX_ROUTING_PAGE_SIZE = 100;

const CONTEXT_USES = new Set<ContextUse>([
	"constraint",
	"evidence",
	"decision",
	"method",
	"guidance",
]);

function fail(message: string): never {
	throw new Error(`Developer routing context: ${message}`);
}

function text(value: string, name: string): string {
	if (
		typeof value !== "string" ||
		value !== value.trim() ||
		value.length === 0 ||
		value.length > MAX_RUNTIME_TEXT_LENGTH
	) {
		fail(`${name} must be normalized non-blank bounded text`);
	}
	return value;
}

function exactKeys(
	value: object,
	allowed: readonly string[],
	name: string,
): void {
	const keys = Object.keys(value);
	if (
		keys.length !== allowed.length ||
		keys.some((key) => !allowed.includes(key))
	) {
		fail(`${name} has an invalid representation`);
	}
}

function canonicalIds(
	values: readonly DeveloperId[],
	name: string,
	options: { readonly nonEmpty?: boolean } = {},
): readonly DeveloperId[] {
	if (
		(options.nonEmpty && values.length === 0) ||
		values.length > MAX_RUNTIME_ARRAY_LENGTH
	) {
		fail(`${name} has an invalid length`);
	}
	const parsed = values.map((value, index) =>
		parseDeveloperId(value, `${name}[${index}]`),
	);
	for (let index = 1; index < parsed.length; index += 1) {
		if ((parsed[index - 1] ?? "") >= (parsed[index] ?? "")) {
			fail(`${name} must be unique and in canonical order`);
		}
	}
	return Object.freeze(parsed);
}

function boundedTexts(
	values: readonly string[],
	name: string,
	options: { readonly nonEmpty?: boolean; readonly max?: number } = {},
): readonly string[] {
	if (
		(options.nonEmpty && values.length === 0) ||
		values.length > (options.max ?? MAX_RUNTIME_ARRAY_LENGTH)
	) {
		fail(`${name} has an invalid length`);
	}
	return Object.freeze(
		values.map((value, index) => text(value, `${name}[${index}]`)),
	);
}

function sourceRevision(value: SourceRevisionRef): SourceRevisionRef {
	exactKeys(value, ["sourceId", "revision"], "source");
	return Object.freeze({
		sourceId: parseDeveloperId(value.sourceId, "source.sourceId"),
		revision: text(value.revision, "source.revision"),
	});
}

export interface RefinementProvenance {
	readonly producerId: DeveloperId;
	readonly producerRevisionSha256: Sha256Digest;
	readonly basisSha256: Sha256Digest;
}

function refinementProvenance(
	value: RefinementProvenance,
): RefinementProvenance {
	exactKeys(
		value,
		["producerId", "producerRevisionSha256", "basisSha256"],
		"refinement",
	);
	return Object.freeze({
		producerId: parseDeveloperId(value.producerId, "refinement.producerId"),
		producerRevisionSha256: parseSha256Digest(
			value.producerRevisionSha256,
			"refinement.producerRevisionSha256",
		),
		basisSha256: parseSha256Digest(value.basisSha256, "refinement.basisSha256"),
	});
}

interface CandidateCommonBody {
	readonly candidateId: DeveloperId;
	readonly source: SourceRevisionRef;
	readonly subjectId: DeveloperId;
	readonly subjectRevisionSha256: Sha256Digest;
}

export type RoutingCandidateDescriptorBody =
	| (CandidateCommonBody & {
			readonly kind: "capability";
			readonly registryRevisionSha256: Sha256Digest;
	  })
	| (CandidateCommonBody & {
			readonly kind: "tool";
			readonly schemaSha256: Sha256Digest;
	  })
	| (CandidateCommonBody & {
			readonly kind: "material";
			readonly contentDescriptorSha256: Sha256Digest;
	  })
	| (CandidateCommonBody & {
			readonly kind: "constraint" | "evidence" | "decision";
			readonly refinement: RefinementProvenance;
	  });

export type RoutingCandidateDescriptor = RoutingCandidateDescriptorBody & {
	readonly descriptorSha256: Sha256Digest;
};

function candidateBody(
	value: RoutingCandidateDescriptorBody,
): RoutingCandidateDescriptorBody {
	const common = {
		candidateId: parseDeveloperId(value.candidateId, "candidateId"),
		source: sourceRevision(value.source),
		subjectId: parseDeveloperId(value.subjectId, "subjectId"),
		subjectRevisionSha256: parseSha256Digest(
			value.subjectRevisionSha256,
			"subjectRevisionSha256",
		),
	};
	if (value.kind === "capability") {
		exactKeys(
			value,
			[
				"candidateId",
				"kind",
				"source",
				"subjectId",
				"subjectRevisionSha256",
				"registryRevisionSha256",
			],
			"capability candidate",
		);
		return Object.freeze({
			...common,
			kind: value.kind,
			registryRevisionSha256: parseSha256Digest(
				value.registryRevisionSha256,
				"registryRevisionSha256",
			),
		});
	}
	if (value.kind === "tool") {
		exactKeys(
			value,
			[
				"candidateId",
				"kind",
				"source",
				"subjectId",
				"subjectRevisionSha256",
				"schemaSha256",
			],
			"tool candidate",
		);
		return Object.freeze({
			...common,
			kind: value.kind,
			schemaSha256: parseSha256Digest(value.schemaSha256, "schemaSha256"),
		});
	}
	if (value.kind === "material") {
		exactKeys(
			value,
			[
				"candidateId",
				"kind",
				"source",
				"subjectId",
				"subjectRevisionSha256",
				"contentDescriptorSha256",
			],
			"material candidate",
		);
		return Object.freeze({
			...common,
			kind: value.kind,
			contentDescriptorSha256: parseSha256Digest(
				value.contentDescriptorSha256,
				"contentDescriptorSha256",
			),
		});
	}
	if (
		value.kind !== "constraint" &&
		value.kind !== "evidence" &&
		value.kind !== "decision"
	) {
		return fail("unknown routing candidate kind");
	}
	exactKeys(
		value,
		[
			"candidateId",
			"kind",
			"source",
			"subjectId",
			"subjectRevisionSha256",
			"refinement",
		],
		`${value.kind} candidate`,
	);
	return Object.freeze({
		...common,
		kind: value.kind,
		refinement: refinementProvenance(value.refinement),
	});
}

export function routingCandidateDescriptorSha256(
	value: RoutingCandidateDescriptorBody,
): Sha256Digest {
	return canonicalValueSha256({
		domain: "developer/v8/routing-candidate",
		candidate: candidateBody(value),
	});
}

export function createRoutingCandidateDescriptor(
	value: RoutingCandidateDescriptorBody,
): RoutingCandidateDescriptor {
	const body = candidateBody(value);
	const descriptor: RoutingCandidateDescriptor = {
		...body,
		descriptorSha256: routingCandidateDescriptorSha256(body),
	};
	return Object.freeze(descriptor);
}

function recreateCandidate(
	value: RoutingCandidateDescriptor,
): RoutingCandidateDescriptor {
	const common = {
		candidateId: value.candidateId,
		source: value.source,
		subjectId: value.subjectId,
		subjectRevisionSha256: value.subjectRevisionSha256,
	};
	if (value.kind === "capability") {
		exactKeys(
			value,
			[
				"candidateId",
				"kind",
				"source",
				"subjectId",
				"subjectRevisionSha256",
				"registryRevisionSha256",
				"descriptorSha256",
			],
			"capability descriptor",
		);
		return createRoutingCandidateDescriptor({
			...common,
			kind: value.kind,
			registryRevisionSha256: value.registryRevisionSha256,
		});
	}
	if (value.kind === "tool") {
		exactKeys(
			value,
			[
				"candidateId",
				"kind",
				"source",
				"subjectId",
				"subjectRevisionSha256",
				"schemaSha256",
				"descriptorSha256",
			],
			"tool descriptor",
		);
		return createRoutingCandidateDescriptor({
			...common,
			kind: value.kind,
			schemaSha256: value.schemaSha256,
		});
	}
	if (value.kind === "material") {
		exactKeys(
			value,
			[
				"candidateId",
				"kind",
				"source",
				"subjectId",
				"subjectRevisionSha256",
				"contentDescriptorSha256",
				"descriptorSha256",
			],
			"material descriptor",
		);
		return createRoutingCandidateDescriptor({
			...common,
			kind: value.kind,
			contentDescriptorSha256: value.contentDescriptorSha256,
		});
	}
	if (
		value.kind !== "constraint" &&
		value.kind !== "evidence" &&
		value.kind !== "decision"
	) {
		return fail("unknown routing candidate descriptor kind");
	}
	exactKeys(
		value,
		[
			"candidateId",
			"kind",
			"source",
			"subjectId",
			"subjectRevisionSha256",
			"refinement",
			"descriptorSha256",
		],
		`${value.kind} descriptor`,
	);
	return createRoutingCandidateDescriptor({
		...common,
		kind: value.kind,
		refinement: value.refinement,
	});
}

function verifiedCandidate(
	value: RoutingCandidateDescriptor,
): RoutingCandidateDescriptor {
	const expected = recreateCandidate(value);
	if (expected.descriptorSha256 !== value.descriptorSha256) {
		fail("candidate descriptor hash does not match its body");
	}
	return value;
}

export interface RoutingCandidatePage {
	readonly snapshotId: DeveloperId;
	readonly pageIndex: number;
	readonly candidates: readonly RoutingCandidateDescriptor[];
	readonly pageSha256: Sha256Digest;
}

function routingCandidatePageSha256(
	snapshotId: DeveloperId,
	pageIndex: number,
	candidates: readonly RoutingCandidateDescriptor[],
): Sha256Digest {
	return canonicalValueSha256({
		domain: "developer/v8/routing-candidate-page",
		snapshotId,
		pageIndex,
		candidates,
	});
}

export function createRoutingCandidatePages(
	snapshotIdInput: DeveloperId,
	orderedCandidates: readonly RoutingCandidateDescriptor[],
	pageSize: number,
): readonly RoutingCandidatePage[] {
	const snapshotId = parseDeveloperId(snapshotIdInput, "snapshotId");
	if (
		!Number.isInteger(pageSize) ||
		pageSize < 1 ||
		pageSize > MAX_ROUTING_PAGE_SIZE
	) {
		fail("pageSize must be an integer between 1 and 100");
	}
	const seen = new Set<string>();
	const candidates = orderedCandidates.map((candidate) => {
		const verified = verifiedCandidate(candidate);
		if (seen.has(verified.candidateId)) fail("candidate IDs must be unique");
		seen.add(verified.candidateId);
		return verified;
	});
	const pages: RoutingCandidatePage[] = [];
	for (let offset = 0; offset < candidates.length; offset += pageSize) {
		const pageCandidates = Object.freeze(
			candidates.slice(offset, offset + pageSize),
		);
		const pageIndex = pages.length;
		pages.push(
			Object.freeze({
				snapshotId,
				pageIndex,
				candidates: pageCandidates,
				pageSha256: routingCandidatePageSha256(
					snapshotId,
					pageIndex,
					pageCandidates,
				),
			}),
		);
	}
	return Object.freeze(pages);
}

function verifiedPage(page: RoutingCandidatePage): RoutingCandidatePage {
	exactKeys(
		page,
		["snapshotId", "pageIndex", "candidates", "pageSha256"],
		"routing candidate page",
	);
	if (
		!Number.isInteger(page.pageIndex) ||
		page.pageIndex < 0 ||
		page.candidates.length === 0 ||
		page.candidates.length > MAX_ROUTING_PAGE_SIZE
	) {
		fail("candidate page has an invalid index or size");
	}
	const snapshotId = parseDeveloperId(page.snapshotId, "page.snapshotId");
	const candidates = page.candidates.map(verifiedCandidate);
	const expected = routingCandidatePageSha256(
		snapshotId,
		page.pageIndex,
		candidates,
	);
	if (expected !== page.pageSha256) fail("candidate page hash mismatch");
	return page;
}

function pageChainSeed(
	snapshotId: DeveloperId,
	basisSha256: Sha256Digest,
): Sha256Digest {
	return canonicalValueSha256({
		domain: "developer/v8/routing-page-chain/seed",
		snapshotId,
		basisSha256,
	});
}

function nextPageChainSha256(
	current: Sha256Digest,
	page: RoutingCandidatePage,
): Sha256Digest {
	return canonicalValueSha256({
		domain: "developer/v8/routing-page-chain/link",
		previousSha256: current,
		pageIndex: page.pageIndex,
		pageSha256: page.pageSha256,
	});
}

export function createRoutingSnapshotManifest(
	snapshotIdInput: DeveloperId,
	basisInput: SnapshotBasis,
	pages: readonly RoutingCandidatePage[],
): SnapshotSealManifest {
	const snapshotId = parseDeveloperId(snapshotIdInput, "snapshotId");
	const basis = parseSnapshotBasis(basisInput);
	const basisSha256 = snapshotBasisSha256(basis);
	let root = pageChainSeed(snapshotId, basisSha256);
	let candidateCount = 0;
	const seen = new Set<string>();
	for (const [index, unchecked] of pages.entries()) {
		const page = verifiedPage(unchecked);
		if (page.snapshotId !== snapshotId || page.pageIndex !== index) {
			fail("candidate pages must match the snapshot and retain frozen order");
		}
		for (const candidate of page.candidates) {
			if (seen.has(candidate.candidateId)) fail("candidate IDs must be unique");
			seen.add(candidate.candidateId);
		}
		candidateCount += page.candidates.length;
		root = nextPageChainSha256(root, page);
	}
	return parseSnapshotSealManifest({
		snapshotId,
		snapshotBasisSha256: basisSha256,
		pageCount: pages.length,
		candidateCount,
		orderedPageRootSha256: root,
	});
}

export type CandidateDispositionKind =
	| "selected-for-material"
	| "not-applicable"
	| "excluded-by-root-unless"
	| "considered-not-selected"
	| "needs-context"
	| "invalid/unavailable";

export type CandidateTargetEffectKind =
	| "selected"
	| "cleared"
	| "blocked"
	| "optional-limitation";

export interface CandidateTargetEffect {
	readonly obligationId: DeveloperId;
	readonly effect: CandidateTargetEffectKind;
}

export interface CandidateDisposition {
	readonly candidateId: DeveloperId;
	readonly descriptorSha256: Sha256Digest;
	readonly kind: CandidateDispositionKind;
	readonly targetEffects: readonly CandidateTargetEffect[];
	readonly rationale: string;
}

const EFFECTS_BY_DISPOSITION: Readonly<
	Record<CandidateDispositionKind, ReadonlySet<CandidateTargetEffectKind>>
> = Object.freeze({
	"selected-for-material": new Set<CandidateTargetEffectKind>([
		"selected",
		"cleared",
		"optional-limitation",
	]),
	"not-applicable": new Set<CandidateTargetEffectKind>([
		"cleared",
		"optional-limitation",
	]),
	"excluded-by-root-unless": new Set<CandidateTargetEffectKind>([
		"cleared",
		"optional-limitation",
	]),
	"considered-not-selected": new Set<CandidateTargetEffectKind>([
		"cleared",
		"optional-limitation",
	]),
	"needs-context": new Set<CandidateTargetEffectKind>([
		"blocked",
		"optional-limitation",
	]),
	"invalid/unavailable": new Set<CandidateTargetEffectKind>([
		"blocked",
		"optional-limitation",
	]),
});

export function createCandidateDisposition(
	value: CandidateDisposition,
): CandidateDisposition {
	exactKeys(
		value,
		["candidateId", "descriptorSha256", "kind", "targetEffects", "rationale"],
		"candidate disposition",
	);
	const allowedEffects = EFFECTS_BY_DISPOSITION[value.kind];
	if (allowedEffects === undefined) fail("unknown candidate disposition kind");
	const targetEffects = value.targetEffects.map((target, index) => {
		exactKeys(target, ["obligationId", "effect"], `targetEffects[${index}]`);
		if (!allowedEffects.has(target.effect)) {
			fail(`${value.kind} cannot produce ${target.effect}`);
		}
		return Object.freeze({
			obligationId: parseDeveloperId(
				target.obligationId,
				`targetEffects[${index}].obligationId`,
			),
			effect: target.effect,
		});
	});
	canonicalIds(
		targetEffects.map((target) => target.obligationId),
		"targetEffects",
	);
	return Object.freeze({
		candidateId: parseDeveloperId(value.candidateId, "candidateId"),
		descriptorSha256: parseSha256Digest(
			value.descriptorSha256,
			"descriptorSha256",
		),
		kind: value.kind,
		targetEffects: Object.freeze(targetEffects),
		rationale: text(value.rationale, "rationale"),
	});
}

export interface RoutingTargetSummary {
	readonly obligationId: DeveloperId;
	readonly selectedCount: number;
	readonly clearedCount: number;
	readonly blockedCount: number;
	readonly optionalLimitationCount: number;
}

interface RoutingCoverageFields {
	readonly basis: SnapshotBasis;
	readonly manifest: SnapshotSealManifest;
	readonly obligations: readonly Obligation[];
	readonly nextPageIndex: number;
	readonly observedCandidateCount: number;
	readonly pageChainSha256: Sha256Digest;
	readonly selectedCandidates: readonly RoutingCandidateDescriptor[];
	readonly targetSummaries: readonly RoutingTargetSummary[];
}

const routingCoverageBrand: unique symbol = Symbol("RoutingCoverageState");
const routingCoverageValues = new WeakSet<object>();
const completedRoutingCoverageValues = new WeakSet<object>();
const canServeRoutingBasisValues = new WeakSet<object>();

export type RoutingCoverageState = Readonly<RoutingCoverageFields> & {
	readonly [routingCoverageBrand]: true;
};

const completedRoutingCoverageBrand: unique symbol = Symbol(
	"CompletedRoutingCoverage",
);
export type CompletedRoutingCoverage = Readonly<RoutingCoverageFields> & {
	readonly coverageSha256: Sha256Digest;
	readonly [completedRoutingCoverageBrand]: true;
};

function freezeCoverage(fields: RoutingCoverageFields): RoutingCoverageState {
	const state: RoutingCoverageState = Object.freeze({
		...fields,
		[routingCoverageBrand]: true as const,
	});
	routingCoverageValues.add(state);
	return state;
}

export function beginRoutingCoverage(
	basisInput: SnapshotBasis,
	manifestInput: SnapshotSealManifest,
	obligationsInput: readonly Obligation[],
): RoutingCoverageState {
	const basis = parseSnapshotBasis(basisInput);
	const manifest = parseSnapshotSealManifest(manifestInput);
	if (manifest.snapshotBasisSha256 !== snapshotBasisSha256(basis)) {
		fail("snapshot manifest does not match its basis");
	}
	const obligations = Object.freeze(
		obligationsInput.map((obligation, index) =>
			parseObligation(obligation, `obligations[${index}]`),
		),
	);
	if (obligationSetSha256(obligations) !== basis.obligationSetSha256) {
		fail("snapshot basis does not match the current obligations");
	}
	for (const obligation of obligations) {
		if (obligation.frameId !== basis.frameId) {
			fail("every routing obligation must belong to the snapshot frame");
		}
	}
	canonicalIds(
		obligations.map((obligation) => obligation.obligationId),
		"obligations",
	);
	const targetSummaries = obligations.map((obligation) =>
		Object.freeze({
			obligationId: obligation.obligationId,
			selectedCount: 0,
			clearedCount: 0,
			blockedCount: 0,
			optionalLimitationCount: 0,
		}),
	);
	return freezeCoverage({
		basis,
		manifest,
		obligations,
		nextPageIndex: 0,
		observedCandidateCount: 0,
		pageChainSha256: pageChainSeed(
			manifest.snapshotId,
			manifest.snapshotBasisSha256,
		),
		selectedCandidates: Object.freeze([]),
		targetSummaries: Object.freeze(targetSummaries),
	});
}

function effectsMatchObligations(
	effects: readonly CandidateTargetEffect[],
	obligations: readonly Obligation[],
): boolean {
	return (
		effects.length === obligations.length &&
		effects.every(
			(effect, index) =>
				effect.obligationId === obligations[index]?.obligationId,
		)
	);
}

function incrementTargetSummary(
	summary: {
		selectedCount: number;
		clearedCount: number;
		blockedCount: number;
		optionalLimitationCount: number;
	},
	effect: CandidateTargetEffectKind,
): void {
	if (effect === "selected") summary.selectedCount += 1;
	else if (effect === "cleared") summary.clearedCount += 1;
	else if (effect === "blocked") summary.blockedCount += 1;
	else summary.optionalLimitationCount += 1;
}

export function accountRoutingPage(
	state: RoutingCoverageState,
	uncheckedPage: RoutingCandidatePage,
	uncheckedDispositions: readonly CandidateDisposition[],
): RoutingCoverageState {
	if (!routingCoverageValues.has(state)) {
		fail("routing coverage was not created by this runtime");
	}
	if (state.nextPageIndex >= state.manifest.pageCount) {
		fail("routing snapshot has no remaining page");
	}
	const page = verifiedPage(uncheckedPage);
	if (
		page.snapshotId !== state.manifest.snapshotId ||
		page.pageIndex !== state.nextPageIndex
	) {
		fail("routing page is stale or out of order");
	}
	if (uncheckedDispositions.length !== page.candidates.length) {
		fail("every page candidate requires exactly one disposition");
	}
	const dispositions = uncheckedDispositions.map(createCandidateDisposition);
	const selected = [...state.selectedCandidates];
	const summaries = state.targetSummaries.map((summary) => ({ ...summary }));
	for (const [index, candidate] of page.candidates.entries()) {
		const disposition = dispositions[index];
		if (
			disposition === undefined ||
			disposition.candidateId !== candidate.candidateId ||
			disposition.descriptorSha256 !== candidate.descriptorSha256 ||
			!effectsMatchObligations(disposition.targetEffects, state.obligations)
		) {
			fail("candidate disposition does not match the frozen page and targets");
		}
		if (
			disposition.targetEffects.some((effect) => effect.effect === "selected")
		) {
			selected.push(candidate);
		}
		for (const [targetIndex, effect] of disposition.targetEffects.entries()) {
			const summary = summaries[targetIndex];
			if (summary === undefined) fail("missing routing target summary");
			incrementTargetSummary(summary, effect.effect);
		}
	}
	return freezeCoverage({
		...state,
		nextPageIndex: state.nextPageIndex + 1,
		observedCandidateCount:
			state.observedCandidateCount + page.candidates.length,
		pageChainSha256: nextPageChainSha256(state.pageChainSha256, page),
		selectedCandidates: Object.freeze(selected),
		targetSummaries: Object.freeze(
			summaries.map((summary) => Object.freeze(summary)),
		),
	});
}

function coverageFieldsComplete(state: RoutingCoverageFields): boolean {
	return (
		state.nextPageIndex === state.manifest.pageCount &&
		state.observedCandidateCount === state.manifest.candidateCount &&
		state.pageChainSha256 === state.manifest.orderedPageRootSha256 &&
		state.targetSummaries.every((summary) => summary.blockedCount === 0)
	);
}

export function routingCoverageComplete(state: RoutingCoverageState): boolean {
	return routingCoverageValues.has(state) && coverageFieldsComplete(state);
}

function completedCoverageSha256(state: RoutingCoverageFields): Sha256Digest {
	return canonicalValueSha256({
		domain: "developer/v8/completed-routing-coverage",
		basisSha256: state.manifest.snapshotBasisSha256,
		manifest: state.manifest,
		selectedCandidates: state.selectedCandidates.map((candidate) => ({
			candidateId: candidate.candidateId,
			descriptorSha256: candidate.descriptorSha256,
		})),
		targetSummaries: state.targetSummaries,
	});
}

export function completeRoutingCoverage(
	state: RoutingCoverageState,
): CompletedRoutingCoverage {
	if (!routingCoverageComplete(state)) {
		fail(
			"routing coverage is incomplete, blocked, unknown, or does not match its seal",
		);
	}
	const completed: CompletedRoutingCoverage = Object.freeze({
		...state,
		coverageSha256: completedCoverageSha256(state),
		[completedRoutingCoverageBrand]: true as const,
	});
	completedRoutingCoverageValues.add(completed);
	return completed;
}

export function verifyCompletedRoutingCoverage(
	value: CompletedRoutingCoverage,
): CompletedRoutingCoverage {
	if (
		!completedRoutingCoverageValues.has(value) ||
		!coverageFieldsComplete(value) ||
		completedCoverageSha256(value) !== value.coverageSha256
	) {
		return fail("completed routing coverage was not created by this runtime");
	}
	return value;
}

export type SkillPolicyRevision =
	| Readonly<{ kind: "absent" }>
	| Readonly<{ kind: "complete"; revisionSha256: Sha256Digest }>;

export interface CanServeRoutingBasisBody {
	readonly basisId: DeveloperId;
	readonly candidateId: DeveloperId;
	readonly targetObligationIds: readonly DeveloperId[];
	readonly methodRevisionSha256: Sha256Digest;
	readonly policy: SkillPolicyRevision;
	readonly rootApplicability: "applicable";
}

export interface CanServeRoutingBasis extends CanServeRoutingBasisBody {
	readonly kind: "can-serve";
	readonly snapshotId: DeveloperId;
	readonly frameId: DeveloperId;
	readonly frameRevision: number;
	readonly capabilityId: DeveloperId;
	readonly capabilityRevisionSha256: Sha256Digest;
	readonly descriptorSha256: Sha256Digest;
	readonly contextBasisSha256: Sha256Digest;
	readonly basisSha256: Sha256Digest;
}

export type RoutingBasis = CanServeRoutingBasis;

function policyRevision(value: SkillPolicyRevision): SkillPolicyRevision {
	if (value.kind === "absent") {
		exactKeys(value, ["kind"], "policy");
		return Object.freeze({ kind: value.kind });
	}
	if (value.kind === "complete") {
		exactKeys(value, ["kind", "revisionSha256"], "policy");
		return Object.freeze({
			kind: value.kind,
			revisionSha256: parseSha256Digest(
				value.revisionSha256,
				"policy.revisionSha256",
			),
		});
	}
	return fail("unknown Skill policy revision kind");
}

export function createCanServeRoutingBasis(
	coverage: CompletedRoutingCoverage,
	value: CanServeRoutingBasisBody,
): CanServeRoutingBasis {
	verifyCompletedRoutingCoverage(coverage);
	exactKeys(
		value,
		[
			"basisId",
			"candidateId",
			"targetObligationIds",
			"methodRevisionSha256",
			"policy",
			"rootApplicability",
		],
		"can-serve basis",
	);
	if (value.rootApplicability !== "applicable") {
		fail("can-serve requires applicable root context");
	}
	const candidateId = parseDeveloperId(value.candidateId, "candidateId");
	const candidate = coverage.selectedCandidates.find(
		(entry) => entry.candidateId === candidateId,
	);
	if (candidate === undefined) fail("can-serve candidate was not selected");
	if (candidate.kind !== "capability") {
		fail("only a registered capability candidate can serve a Route");
	}
	const targetObligationIds = canonicalIds(
		value.targetObligationIds,
		"targetObligationIds",
		{ nonEmpty: true },
	);
	const knownTargets = new Set(
		coverage.obligations.map((obligation) => obligation.obligationId),
	);
	if (targetObligationIds.some((target) => !knownTargets.has(target))) {
		fail("can-serve targets must belong to the current frame");
	}
	const body = Object.freeze({
		basisId: parseDeveloperId(value.basisId, "basisId"),
		kind: "can-serve" as const,
		snapshotId: coverage.manifest.snapshotId,
		frameId: coverage.basis.frameId,
		frameRevision: coverage.basis.frameRevision,
		candidateId,
		capabilityId: candidate.subjectId,
		capabilityRevisionSha256: candidate.subjectRevisionSha256,
		descriptorSha256: candidate.descriptorSha256,
		targetObligationIds,
		methodRevisionSha256: parseSha256Digest(
			value.methodRevisionSha256,
			"methodRevisionSha256",
		),
		policy: policyRevision(value.policy),
		rootApplicability: value.rootApplicability,
		contextBasisSha256: coverage.coverageSha256,
	});
	const basis = Object.freeze({
		...body,
		basisSha256: canonicalValueSha256({
			domain: "developer/v8/can-serve-routing-basis",
			basis: body,
		}),
	});
	canServeRoutingBasisValues.add(basis);
	return basis;
}

function canServeBasisSha256(value: CanServeRoutingBasis): Sha256Digest {
	const { basisSha256: _basisSha256, ...body } = value;
	return canonicalValueSha256({
		domain: "developer/v8/can-serve-routing-basis",
		basis: body,
	});
}

export function verifyCanServeRoutingBasis(
	coverage: CompletedRoutingCoverage,
	value: CanServeRoutingBasis,
): CanServeRoutingBasis {
	verifyCompletedRoutingCoverage(coverage);
	if (
		!canServeRoutingBasisValues.has(value) ||
		canServeBasisSha256(value) !== value.basisSha256 ||
		value.snapshotId !== coverage.manifest.snapshotId ||
		value.frameId !== coverage.basis.frameId ||
		value.frameRevision !== coverage.basis.frameRevision ||
		value.contextBasisSha256 !== coverage.coverageSha256
	) {
		return fail("can-serve basis was not created for current routing coverage");
	}
	const candidate = coverage.selectedCandidates.find(
		(entry) => entry.candidateId === value.candidateId,
	);
	if (
		candidate === undefined ||
		candidate.kind !== "capability" ||
		candidate.subjectId !== value.capabilityId ||
		candidate.subjectRevisionSha256 !== value.capabilityRevisionSha256 ||
		candidate.descriptorSha256 !== value.descriptorSha256
	) {
		return fail("can-serve basis does not name the exact selected capability");
	}
	const currentTargets = new Set(
		coverage.obligations.map((obligation) => obligation.obligationId),
	);
	if (value.targetObligationIds.some((target) => !currentTargets.has(target))) {
		return fail("can-serve basis targets are not current routing obligations");
	}
	return value;
}

export type FrameContributionSourceKind =
	| "skill-return"
	| "tool-result"
	| "material"
	| "user-decision"
	| "judgment-result"
	| "child-frame";

export interface FrameContributionSourceRef {
	readonly kind: FrameContributionSourceKind;
	readonly sourceId: DeveloperId;
	readonly sourceRevisionSha256: Sha256Digest;
}

export interface ProposedFrameContributionBody {
	readonly proposalId: DeveloperId;
	readonly frameId: DeveloperId;
	readonly frameRevision: number;
	readonly source: FrameContributionSourceRef;
	readonly claim: string;
	readonly applicability: string;
	readonly targetUses: readonly ContributionTargetUse[];
	readonly limitations: readonly string[];
	readonly supportSha256: Sha256Digest;
}

export interface ProposedFrameContribution
	extends ProposedFrameContributionBody {
	readonly proposalSha256: Sha256Digest;
}

function contributionSource(
	value: FrameContributionSourceRef,
): FrameContributionSourceRef {
	exactKeys(
		value,
		["kind", "sourceId", "sourceRevisionSha256"],
		"contribution source",
	);
	const kinds = new Set<FrameContributionSourceKind>([
		"skill-return",
		"tool-result",
		"material",
		"user-decision",
		"judgment-result",
		"child-frame",
	]);
	if (!kinds.has(value.kind)) fail("unknown contribution source kind");
	return Object.freeze({
		kind: value.kind,
		sourceId: parseDeveloperId(value.sourceId, "source.sourceId"),
		sourceRevisionSha256: parseSha256Digest(
			value.sourceRevisionSha256,
			"source.sourceRevisionSha256",
		),
	});
}

function contributionTargetUses(
	values: readonly ContributionTargetUse[],
): readonly ContributionTargetUse[] {
	if (values.length === 0 || values.length > MAX_RUNTIME_ARRAY_LENGTH) {
		fail("targetUses has an invalid length");
	}
	const uses = values.map((value, index) => {
		exactKeys(value, ["obligationId", "useAs"], `targetUses[${index}]`);
		if (!CONTEXT_USES.has(value.useAs)) fail("unknown target use");
		return Object.freeze({
			obligationId: parseDeveloperId(
				value.obligationId,
				`targetUses[${index}].obligationId`,
			),
			useAs: value.useAs,
		});
	});
	canonicalIds(
		uses.map((use) => use.obligationId),
		"targetUses",
		{ nonEmpty: true },
	);
	return Object.freeze(uses);
}

function proposedContributionBody(
	value: ProposedFrameContributionBody,
): ProposedFrameContributionBody {
	exactKeys(
		value,
		[
			"proposalId",
			"frameId",
			"frameRevision",
			"source",
			"claim",
			"applicability",
			"targetUses",
			"limitations",
			"supportSha256",
		],
		"proposed frame contribution",
	);
	if (!Number.isInteger(value.frameRevision) || value.frameRevision < 0) {
		fail("frameRevision must be a non-negative integer");
	}
	return Object.freeze({
		proposalId: parseDeveloperId(value.proposalId, "proposalId"),
		frameId: parseDeveloperId(value.frameId, "frameId"),
		frameRevision: value.frameRevision,
		source: contributionSource(value.source),
		claim: text(value.claim, "claim"),
		applicability: text(value.applicability, "applicability"),
		targetUses: contributionTargetUses(value.targetUses),
		limitations: boundedTexts(value.limitations, "limitations", { max: 32 }),
		supportSha256: parseSha256Digest(value.supportSha256, "supportSha256"),
	});
}

export function proposedFrameContributionSha256(
	value: ProposedFrameContributionBody,
): Sha256Digest {
	return canonicalValueSha256({
		domain: "developer/v8/proposed-frame-contribution",
		contribution: proposedContributionBody(value),
	});
}

export function createProposedFrameContribution(
	value: ProposedFrameContributionBody,
): ProposedFrameContribution {
	const body = proposedContributionBody(value);
	return Object.freeze({
		...body,
		proposalSha256: proposedFrameContributionSha256(body),
	});
}

export function verifyProposedFrameContribution(
	value: ProposedFrameContribution,
): ProposedFrameContribution {
	const { proposalSha256, ...body } = value;
	if (proposedFrameContributionSha256(body) !== proposalSha256) {
		fail("proposed frame contribution hash mismatch");
	}
	return value;
}
