import type {
	ExtensionAPI,
	ExtensionContext,
	Skill,
} from "@earendil-works/pi-coding-agent";
import {
	ContextAttempt,
	buildPiContextInventory,
	resolveObservedContext,
	type PiBranchEntryInput,
	type PiContextInventoryInput,
	type ObservedContextNominationData,
	type PreparedContextProviderInput,
} from "@hobin/judgment/pi-context";
import {
	canonicalJson,
	contextContentSha256,
	decodeContextApplicabilityData,
	jsonValueFromUnknown,
	parseContextApplicability,
	sha256,
	type CompiledJudgmentPolicy,
	type ContextApplicability,
	type ContextInventory,
	type ContextSourceDescriptor,
	type ContextUse,
} from "@hobin/judgment";
import {
	createNodeLocalReferenceReader,
	MAX_SEALED_MEMBER_BYTES,
	type AcquiredContextData,
	type ContextAcquisition,
} from "@hobin/judgment/node";

import { contextBasisFromJudgment } from "../src/context-basis.ts";
import type {
	DeveloperContextBasis,
	OpenedContextSource,
} from "../src/context-result.ts";

export interface DeveloperInventorySnapshot {
	readonly input: Omit<PiContextInventoryInput, "preparedProviders">;
	readonly loadedSkills: readonly Skill[];
	readonly contextFileContent: ReadonlyMap<string, string>;
}
export type DeveloperContextNomination =
	| {
			readonly nominationId: string;
			readonly kind: "inventory-source";
			readonly inventorySourceId?: string;
			readonly provenanceSource?: string;
			readonly provenancePath?: string;
			readonly contentSha256?: string;
	  }
	| {
			readonly nominationId: string;
			readonly kind: "tool-result";
			readonly toolCallId: string;
			readonly inventorySourceId?: string;
	  }
	| {
			readonly nominationId: string;
			readonly kind: "user-decision";
			readonly userEventId: string;
	  };

type DeveloperContributionAuthority =
	| { readonly assurance: "agent-asserted" }
	| {
			readonly assurance: "domain-verified";
			readonly evaluator: Readonly<{ id: string; version: string }>;
			readonly evidenceNominationIds: readonly string[];
	  }
	| { readonly assurance: "user-accepted"; readonly userEventId: string };
export interface DeveloperCoverageProposal {
	readonly status: "sufficient" | "needs-evidence";
	readonly contributions: readonly (DeveloperContributionAuthority & {
		readonly nominationId: string;
		readonly useAs: ContextUse;
		readonly contribution: string;
	})[];
	readonly conflicts: readonly {
		readonly nominationIds: readonly string[];
		readonly description: string;
	}[];
	readonly limitations: readonly {
		readonly nominationIds: readonly string[];
		readonly description: string;
	}[];
}
interface DeveloperCitationIntent {
	readonly contributionIndex: number;
	readonly locator?: string;
	readonly artifactEffect: string;
}
export type DeveloperOutcomeProposal =
	| {
			readonly kind: "contextual-judgment";
			readonly citedUses: readonly DeveloperCitationIntent[];
			readonly rationale: string;
			readonly artifact: string;
			readonly stopEvidence: readonly string[];
	  }
	| {
			readonly kind: "needs-evidence";
			readonly evidenceNeeded: readonly string[];
			readonly resolutionOwner: "agent" | "user" | "environment" | "unknown";
			readonly artifact?: string;
	  }
	| {
			readonly kind: "emergent-question";
			readonly question: string;
			readonly reason: string;
			readonly artifact: string;
			readonly stopEvidence: readonly string[];
	  };
export interface DeveloperContextSourceAssessmentInput {
	readonly inventorySourceId: string;
	readonly applicability: unknown;
}
export interface DeveloperPreparedContextSource {
	readonly source: OpenedContextSource;
	readonly policyRoot: string;
	readonly method: string;
}
export interface DeveloperContextConclusionInput {
	readonly judgmentId: string;
	readonly skill: Readonly<{ name: string; location: string }>;
	readonly policy?: CompiledJudgmentPolicy;
	readonly decisionUnitRoot: string;
	readonly question: string;
	readonly knownEvidence: readonly string[];
	readonly applicability: unknown;
	readonly contextSources: readonly DeveloperPreparedContextSource[];
	readonly contextSourceAssessments: readonly DeveloperContextSourceAssessmentInput[];
	readonly nominations: readonly DeveloperContextNomination[];
	readonly selectionBasis: readonly string[];
	readonly coverageProposal: DeveloperCoverageProposal;
	readonly outcomeProposal: DeveloperOutcomeProposal;
	readonly snapshot: DeveloperInventorySnapshot;
	readonly branchRef: string;
	readonly branch: readonly PiBranchEntryInput[];
	readonly signal?: AbortSignal;
}
export interface DeveloperContextConclusion {
	readonly basis: DeveloperContextBasis;
	readonly outcome: NonNullable<ContextAttempt["state"]["outcome"]>;
}

export function snapshotDeveloperInventory(input: {
	readonly pi: ExtensionAPI;
	readonly ctx: ExtensionContext;
	readonly skills: readonly Skill[];
	readonly contextFiles: readonly { path: string; content: string }[];
}): DeveloperInventorySnapshot {
	const tools = input.pi.getAllTools().map((tool) => ({
		name: tool.name,
		description: tool.description,
		sourceInfo: tool.sourceInfo,
	}));
	return Object.freeze({
		input: {
			skills: input.skills,
			contextFiles: input.contextFiles,
			tools,
			activeToolNames: input.pi.getActiveTools(),
		},
		loadedSkills: Object.freeze([...input.skills]),
		contextFileContent: new Map(
			input.contextFiles.map((file) => [file.path, file.content]),
		),
	});
}
interface ParsedContextSourceAssessment {
	readonly source: DeveloperPreparedContextSource;
	readonly applicability: ContextApplicability;
	readonly applicabilitySha256: string;
}

function parseContextSourceAssessments(input: {
	readonly sources: readonly DeveloperPreparedContextSource[];
	readonly assessments: readonly DeveloperContextSourceAssessmentInput[];
}): readonly ParsedContextSourceAssessment[] {
	const policySources = new Map(
		input.sources.flatMap((source) =>
			source.source.policy
				? [[source.source.inventorySourceId, source] as const]
				: [],
		),
	);
	const seen = new Set<string>();
	const parsed = input.assessments.map((assessment) => {
		if (seen.has(assessment.inventorySourceId)) {
			throw new Error(
				`Duplicate context source assessment: ${assessment.inventorySourceId}.`,
			);
		}
		seen.add(assessment.inventorySourceId);
		const source = policySources.get(assessment.inventorySourceId);
		if (!source) {
			throw new Error(
				`Context source assessment does not name an opened policy: ${assessment.inventorySourceId}.`,
			);
		}
		const applicabilityData = decodeContextApplicabilityData(
			jsonValueFromUnknown(assessment.applicability),
		);
		const applicability = parseContextApplicability(applicabilityData);
		return Object.freeze({
			source,
			applicability,
			applicabilitySha256: sha256(
				canonicalJson(jsonValueFromUnknown(applicabilityData)),
			),
		});
	});
	const missing = [...policySources.keys()].filter((id) => !seen.has(id));
	if (missing.length > 0) {
		throw new Error(
			`Opened context policies require applicability assessments: ${missing.join(", ")}.`,
		);
	}
	return Object.freeze(parsed);
}

function inventoryFor(input: {
	readonly snapshot: DeveloperInventorySnapshot;
	readonly preparedProviders: readonly PreparedContextProviderInput[];
	readonly skillContentByPath?: ReadonlyMap<string, string>;
}): ContextInventory {
	return buildPiContextInventory({
		...input.snapshot.input,
		skills: input.snapshot.input.skills.map((skill) => ({
			...skill,
			...(input.skillContentByPath?.get(skill.filePath)
				? {
						contentSha256: input.skillContentByPath.get(skill.filePath),
					}
				: {}),
		})),
		preparedProviders: input.preparedProviders,
	});
}
function candidate(
	inventory: ContextInventory,
	nomination: Extract<DeveloperContextNomination, { kind: "inventory-source" }>,
): ContextSourceDescriptor {
	const matches = inventory.sources.filter((source) =>
		nomination.inventorySourceId
			? source.id === nomination.inventorySourceId
			: source.provenance.source === nomination.provenanceSource &&
				(!nomination.provenancePath ||
					source.provenance.path === nomination.provenancePath),
	);
	if (matches.length !== 1)
		throw new Error(
			matches.length === 0
				? `No inventory source matches nomination ${nomination.nominationId}.`
				: `Inventory nomination ${nomination.nominationId} is ambiguous.`,
		);
	return matches[0];
}
async function inventoryProposal(input: {
	readonly inventory: ContextInventory;
	readonly acquisition: ContextAcquisition;
	readonly nominations: readonly DeveloperContextNomination[];
	readonly signal?: AbortSignal;
}) {
	const proposal: object[] = [];
	const materialByNomination = new Map<string, string>();
	for (const nomination of input.nominations) {
		if (materialByNomination.has(nomination.nominationId))
			throw new Error(`Duplicate nomination ID: ${nomination.nominationId}.`);
		if (nomination.kind !== "inventory-source") continue;
		const source = candidate(input.inventory, nomination);
		let contentSha256: string | undefined;
		if (source.kind === "pi-skill" && !source.contentSha256) {
			throw new Error(
				`Pi Skill context must be opened before selection: ${source.id}.`,
			);
		}
		if (source.kind === "prepared-reference" || source.kind === "pi-skill") {
			const content =
				source.kind === "prepared-reference"
					? await input.acquisition.acquirePreparedReference(
							source,
							input.signal,
						)
					: await input.acquisition.acquireSkill?.(source, input.signal);
			if (!content || content.isError || content.truncated) {
				throw new Error(`Nominated context is not usable: ${source.id}.`);
			}
			contentSha256 = contextContentSha256(content.parts);
			if (
				nomination.contentSha256 &&
				nomination.contentSha256 !== contentSha256
			) {
				throw new Error(`Nominated context changed: ${source.id}.`);
			}
		}
		proposal.push({
			kind: "inventory-source",
			inventorySourceId: source.id,
			descriptorSha256: source.descriptorSha256,
			...(contentSha256 ? { contentSha256 } : {}),
		});
		materialByNomination.set(
			nomination.nominationId,
			`inventory-source:${source.id}`,
		);
	}
	return { proposal, materialByNomination };
}
function observedRecords(
	nominations: readonly DeveloperContextNomination[],
): readonly ObservedContextNominationData[] {
	return Object.freeze(
		nominations.flatMap((nomination): ObservedContextNominationData[] => {
			if (nomination.kind === "tool-result")
				return [
					{
						kind: "tool-result",
						toolCallId: nomination.toolCallId,
						...(nomination.inventorySourceId
							? { inventorySourceId: nomination.inventorySourceId }
							: {}),
					},
				];
			if (nomination.kind === "user-decision")
				return [{ kind: "user-decision", userEventId: nomination.userEventId }];
			return [];
		}),
	);
}
function acquisitionFor(input: {
	readonly preparedProviders: readonly PreparedContextProviderInput[];
	readonly contextSources: readonly DeveloperPreparedContextSource[];
	readonly snapshot: DeveloperInventorySnapshot;
	readonly observed: ReturnType<typeof resolveObservedContext>;
}): ContextAcquisition {
	const referenceReaders = new Map(
		input.preparedProviders.map((provider) => [
			provider.policy.policySha256,
			createNodeLocalReferenceReader(provider.policyRoot),
		]),
	);
	const contextSourceById = new Map(
		input.contextSources.map((source) => [
			source.source.inventorySourceId,
			source,
		]),
	);
	return {
		async acquirePreparedReference(source, signal) {
			const reader = referenceReaders.get(source.policySha256);
			if (!reader) {
				throw new Error(
					`Prepared reference policy is not admitted: ${source.policySha256}.`,
				);
			}
			return {
				parts: [
					{
						kind: "text",
						text: await reader.read(source, {
							maxBytes: MAX_SEALED_MEMBER_BYTES,
							...(signal ? { signal } : {}),
						}),
					},
				],
				isError: false,
				truncated: false,
			};
		},
		async acquireSkill(source) {
			const contextSource = contextSourceById.get(source.id);
			if (!contextSource) {
				throw new Error(`Pi Skill context is not admitted: ${source.id}.`);
			}
			return {
				parts: [{ kind: "text", text: contextSource.method }],
				isError: false,
				truncated: false,
			};
		},
		async acquireContextFile(
			source: Extract<ContextSourceDescriptor, { kind: "pi-context-file" }>,
		): Promise<AcquiredContextData> {
			const content = input.snapshot.contextFileContent.get(source.path);
			if (content === undefined)
				throw new Error(`Pi context file is unavailable: ${source.path}.`);
			return {
				parts: [{ kind: "text", text: content }],
				isError: false,
				truncated: false,
			};
		},
		acquireObservedContext: input.observed.acquireObservedContext,
	};
}
function materialIds(
	ids: readonly string[],
	map: ReadonlyMap<string, string>,
	path: string,
): readonly string[] {
	return Object.freeze(
		ids.map((id) => {
			const materialId = map.get(id);
			if (!materialId)
				throw new Error(`${path} names unknown nomination ${id}.`);
			return materialId;
		}),
	);
}
function coverageData(
	proposal: DeveloperCoverageProposal,
	map: ReadonlyMap<string, string>,
) {
	return {
		status: proposal.status,
		contributions: proposal.contributions.map((item, index) => {
			const materialId = materialIds(
				[item.nominationId],
				map,
				`contributions[${index}]`,
			)[0];
			const base = {
				materialId,
				useAs: item.useAs,
				contribution: item.contribution,
				assurance: item.assurance,
			};
			if (item.assurance === "domain-verified")
				return {
					...base,
					evaluator: item.evaluator,
					evidenceMaterialIds: materialIds(
						item.evidenceNominationIds,
						map,
						`contributions[${index}].evidenceNominationIds`,
					),
				};
			if (item.assurance === "user-accepted")
				return { ...base, userEventId: item.userEventId };
			return base;
		}),
		conflicts: proposal.conflicts.map((item, index) => ({
			materialIds: materialIds(item.nominationIds, map, `conflicts[${index}]`),
			description: item.description,
		})),
		limitations: proposal.limitations.map((item, index) => ({
			basisMaterialIds: materialIds(
				item.nominationIds,
				map,
				`limitations[${index}]`,
			),
			description: item.description,
		})),
	};
}
function outcomeData(input: {
	readonly proposal: DeveloperOutcomeProposal;
	readonly attempt: ContextAttempt;
}) {
	const state = input.attempt.state;
	const selection = state.selection;
	const sealed = state.sealedContext;
	const coverage = state.coverage;
	if (!selection || !sealed || !coverage)
		throw new Error(
			"Developer context outcome requires selection, sealing, and coverage.",
		);
	const base = {
		selectionSha256: selection.selectionSha256,
		sealedContextSha256: sealed.sealedContextSha256,
		coverageSha256: coverage.coverageSha256,
	};
	const proposal = input.proposal;
	if (proposal.kind === "contextual-judgment")
		return {
			...base,
			kind: proposal.kind,
			citedUses: proposal.citedUses.map((citation) => {
				const contribution = coverage.contributions[citation.contributionIndex];
				if (!contribution)
					throw new Error(
						`Citation names unknown contribution index ${citation.contributionIndex}.`,
					);
				return {
					contributionId: contribution.contributionId,
					...(citation.locator ? { locator: citation.locator } : {}),
					artifactEffect: citation.artifactEffect,
				};
			}),
			rationale: proposal.rationale,
			artifact: proposal.artifact,
			stopEvidence: proposal.stopEvidence,
		};
	if (proposal.kind === "needs-evidence")
		return {
			...base,
			kind: proposal.kind,
			unresolvedIds: [
				...coverage.conflicts.map((value) => value.conflictId),
				...coverage.limitations.map((value) => value.limitationId),
			].sort((left, right) => left.localeCompare(right)),
			evidenceNeeded: proposal.evidenceNeeded,
			resolutionOwner: proposal.resolutionOwner,
			...(proposal.artifact ? { artifact: proposal.artifact } : {}),
		};
	return {
		...base,
		kind: proposal.kind,
		question: proposal.question,
		reason: proposal.reason,
		artifact: proposal.artifact,
		stopEvidence: proposal.stopEvidence,
	};
}

export async function concludeDeveloperContext(
	input: DeveloperContextConclusionInput,
): Promise<DeveloperContextConclusion> {
	const owningSkill = input.snapshot.input.skills.find(
		(skill) =>
			skill.name === input.skill.name &&
			skill.filePath === input.skill.location,
	);
	if (!owningSkill)
		throw new Error(
			`Developer skill provenance is unavailable: ${input.skill.name}.`,
		);
	const contextSourceAssessments = parseContextSourceAssessments({
		sources: input.contextSources,
		assessments: input.contextSourceAssessments,
	});
	const assessmentBySourceId = new Map(
		contextSourceAssessments.map((assessment) => [
			assessment.source.source.inventorySourceId,
			assessment,
		]),
	);
	const admittedSources = input.contextSources.filter((source) => {
		if (!source.source.policy) return true;
		return (
			assessmentBySourceId.get(source.source.inventorySourceId)?.applicability
				.kind === "applicable"
		);
	});
	const preparedProviders: PreparedContextProviderInput[] = [
		...(input.policy
			? [{ policy: input.policy, policyRoot: input.decisionUnitRoot }]
			: []),
		...admittedSources.flatMap((source) =>
			source.source.policy
				? [{ policy: source.source.policy, policyRoot: source.policyRoot }]
				: [],
		),
	];
	const skillContentByPath = new Map(
		admittedSources.map((source) => [
			source.source.skill.location,
			source.source.methodContentSha256,
		]),
	);
	const inventory = inventoryFor({
		snapshot: input.snapshot,
		preparedProviders,
		skillContentByPath,
	});
	const opened = ContextAttempt.open({
		question: jsonValueFromUnknown({
			judgmentId: input.judgmentId,
			owner: input.policy?.owner ?? {
				kind: "pi-skill",
				namespace: "@hobin/developer",
				name: input.skill.name,
				provenance: {
					source: owningSkill.sourceInfo.source,
					scope: owningSkill.sourceInfo.scope,
					origin: owningSkill.sourceInfo.origin,
					path: input.skill.location,
				},
			},
			...(input.policy ? { policySha256: input.policy.policySha256 } : {}),
			question: input.question,
			basisMaterialIds: input.knownEvidence.map(
				(value) => `known-${sha256(value).slice(0, 24)}`,
			),
			branchRef: input.branchRef,
		}),
		applicability: jsonValueFromUnknown(input.applicability),
	});
	const records = observedRecords(input.nominations);
	const observed = resolveObservedContext({
		branchRef: input.branchRef,
		branch: input.branch,
		toolNominations: records.flatMap((record) => {
			if (record.kind !== "tool-result") return [];
			return [
				{
					toolCallId: record.toolCallId,
					...(record.inventorySourceId
						? { inventorySourceId: record.inventorySourceId }
						: {}),
				},
			];
		}),
		userDecisionNominations: records.flatMap((record) =>
			record.kind === "user-decision"
				? [{ userEventId: record.userEventId }]
				: [],
		),
	});
	const acquisition = acquisitionFor({
		preparedProviders,
		contextSources: admittedSources,
		snapshot: input.snapshot,
		observed,
	});
	const inventorySelection = await inventoryProposal({
		inventory,
		acquisition,
		nominations: input.nominations,
		...(input.signal ? { signal: input.signal } : {}),
	});
	const map = new Map(inventorySelection.materialByNomination);
	for (const nomination of input.nominations) {
		if (nomination.kind === "inventory-source") continue;
		const entry = observed.observedContext.entries.find((candidate) =>
			nomination.kind === "tool-result"
				? (candidate.kind === "read-result" ||
						candidate.kind === "tool-result") &&
					candidate.toolCallId === nomination.toolCallId
				: candidate.kind === "user-explicit" &&
					candidate.userEventId === nomination.userEventId,
		);
		if (!entry)
			throw new Error(
				`Observed nomination did not resolve: ${nomination.nominationId}.`,
			);
		if (map.has(nomination.nominationId))
			throw new Error(`Duplicate nomination ID: ${nomination.nominationId}.`);
		map.set(nomination.nominationId, `observed-context:${entry.id}`);
	}
	const transition = await opened.value.selectAndSeal({
		inventory,
		observedContext: observed.observedContext,
		proposal: jsonValueFromUnknown({
			questionSha256: opened.value.state.question.questionSha256,
			nominations: [
				...inventorySelection.proposal,
				...observed.observedContext.entries.map((entry) => ({
					kind: "observed-context",
					observedContextId: entry.id,
					descriptorSha256: entry.descriptorSha256,
				})),
			],
			selectionBasis: input.selectionBasis,
		}),
		admittedPolicySha256s: admittedSources.flatMap((source) =>
			source.source.policy ? [source.source.policy.policySha256] : [],
		),
		acquisition,
		...(input.signal ? { signal: input.signal } : {}),
	});
	transition.value;
	opened.value.assessCoverage(
		jsonValueFromUnknown(coverageData(input.coverageProposal, map)),
	);
	opened.value.conclude(
		jsonValueFromUnknown(
			outcomeData({ proposal: input.outcomeProposal, attempt: opened.value }),
		),
	);
	const state = opened.value.state;
	if (
		!state.selection ||
		!state.sealedContext ||
		!state.coverage ||
		!state.outcome
	)
		throw new Error("Developer context conclusion did not reach an outcome.");
	return Object.freeze({
		basis: contextBasisFromJudgment({
			selection: state.selection,
			sealedContext: state.sealedContext,
			coverage: state.coverage,
			outcome: state.outcome,
			contextSources: input.contextSources.map((source) => {
				const assessment = assessmentBySourceId.get(
					source.source.inventorySourceId,
				);
				return {
					inventorySourceId: source.source.inventorySourceId,
					descriptorSha256: source.source.descriptorSha256,
					...(source.source.policy && assessment
						? {
								policySha256: source.source.policy.policySha256,
								applicability: assessment.applicability.kind,
								applicabilitySha256: assessment.applicabilitySha256,
							}
						: {}),
				};
			}),
		}),
		outcome: state.outcome,
	});
}

export function resolveContextSkill(
	snapshot: DeveloperInventorySnapshot,
	inventorySourceId: string,
	methodContentSha256?: string,
): Readonly<{ source: ContextSourceDescriptor; skill: Skill }> {
	const initialInventory = inventoryFor({
		snapshot,
		preparedProviders: [],
	});
	const initialSource = initialInventory.sources.find(
		(candidate) => candidate.id === inventorySourceId,
	);
	if (!initialSource || initialSource.kind !== "pi-skill") {
		throw new Error(
			`Pi-visible context Skill is unavailable: ${inventorySourceId}.`,
		);
	}
	const matches = snapshot.loadedSkills.filter(
		(skill) =>
			skill.filePath === initialSource.provenance.path &&
			skill.sourceInfo.source === initialSource.provenance.source &&
			skill.sourceInfo.scope === initialSource.provenance.scope &&
			skill.sourceInfo.origin === initialSource.provenance.origin,
	);
	if (matches.length !== 1) {
		throw new Error(
			`Pi-visible context Skill identity is ${matches.length === 0 ? "missing" : "ambiguous"}: ${inventorySourceId}.`,
		);
	}
	const skill = matches[0];
	const inventory = inventoryFor({
		snapshot,
		preparedProviders: [],
		...(methodContentSha256
			? {
					skillContentByPath: new Map([[skill.filePath, methodContentSha256]]),
				}
			: {}),
	});
	const source = inventory.sources.find(
		(candidate) => candidate.id === inventorySourceId,
	);
	if (!source || source.kind !== "pi-skill") {
		throw new Error(
			`Pi-visible context Skill is unavailable: ${inventorySourceId}.`,
		);
	}
	return Object.freeze({ source, skill });
}

export function describeInventory(
	policy: CompiledJudgmentPolicy | undefined,
	decisionUnitRoot: string,
	snapshot: DeveloperInventorySnapshot,
) {
	return inventoryFor({
		snapshot,
		preparedProviders: policy ? [{ policy, policyRoot: decisionUnitRoot }] : [],
	}).sources.map((source) => ({
		id: source.id,
		kind: source.kind,
		title: source.title,
		description: source.description,
		provenance: source.provenance,
		descriptorSha256: source.descriptorSha256,
		...(source.kind === "prepared-reference"
			? { path: source.path, when: source.when }
			: {}),
	}));
}
