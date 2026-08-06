import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
	acceptSkillContribution,
	type SkillContributionProposal,
} from "../src/action-loop/contribution/accept-skill-contribution.ts";
import {
	closeJudgment,
	type JudgmentCategory,
	type JudgmentClosureContract,
	type JudgmentClosureProposal,
} from "../src/action-loop/judgment/close-judgment.ts";
import {
	sealSkillContext,
	type SealedSkillContext,
} from "../src/action-loop/io/seal-skill-context.ts";
import {
	assessNeedCoverage,
	type NeedCoverageProposal,
	type NeedCoverageTarget,
} from "../src/action-loop/need-coverage/assess-need-coverage.ts";
import {
	acceptCapabilityApplicability,
	type ApplicabilityTarget,
	type CapabilityApplicabilityProposal,
	type CapabilityAssignment,
} from "../src/action-loop/routing/accept-applicability.ts";
import {
	bindCapability,
	type BoundCapability,
	type CapabilitySource,
} from "../src/action-loop/routing/bind-capability.ts";
import { bindReferenceSelection } from "../src/action-loop/routing/bind-reference-selection.ts";
import { parseTocBytes } from "../src/action-loop/routing/parse-toc.ts";
import {
	selectDeclaredReferences,
	type ReferenceDisposition,
} from "../src/action-loop/routing/reference-selection.ts";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

interface SelectedApplication {
	readonly path: string;
	readonly application: string;
}

interface PilotScenario {
	readonly name: string;
	readonly skillRootPath: string;
	readonly tocFilename: string;
	readonly source: CapabilitySource;
	readonly category: JudgmentCategory;
	readonly rootWhen: string;
	readonly rootBasis: string;
	readonly selectedApplications: readonly SelectedApplication[];
	readonly result: string;
	readonly subject: string;
}

interface PilotEvaluator {
	readonly provenanceSource: string;
	applicability(
		target: ApplicabilityTarget,
		scenario: PilotScenario,
	): CapabilityApplicabilityProposal;
	references(
		capability: BoundCapability,
		scenario: PilotScenario,
	): readonly ReferenceDisposition[];
	contribution(
		assignment: CapabilityAssignment,
		context: SealedSkillContext,
		scenario: PilotScenario,
	): SkillContributionProposal;
	coverage(
		target: NeedCoverageTarget,
		contributionId: string,
	): NeedCoverageProposal;
	closure(
		contract: JudgmentClosureContract,
		coverageId: string,
	): JudgmentClosureProposal;
}

interface PilotResult {
	readonly capabilityId: string;
	readonly capabilityRevisionId: string;
	readonly assignmentId: string;
	readonly selectionId: string;
	readonly sealedContextId: string;
	readonly contributionId: string;
	readonly coverageId: string;
	readonly conclusionId: string;
	readonly selectedPaths: readonly string[];
	readonly contributionProvenance: string;
	readonly coverageProvenance: string;
	readonly conclusionProvenance: string;
}

function selectedApplication(
	scenario: PilotScenario,
	path: string,
): SelectedApplication | undefined {
	return scenario.selectedApplications.find(
		(application) => application.path === path,
	);
}

function referenceBasis(selected: boolean): string {
	return selected
		? "This material adds a consequential distinction to the assigned Need."
		: "The Skill core is sufficient without this specialized material.";
}

function contributionProposal(
	assignment: CapabilityAssignment,
	context: SealedSkillContext,
	result: string,
	applications: readonly SelectedApplication[],
	provenanceSource: string,
): SkillContributionProposal {
	return {
		workCaseId: assignment.workCaseId,
		judgmentId: assignment.judgmentId,
		contributionNeedId: assignment.contributionNeedId,
		assignmentId: assignment.assignmentId,
		capabilityId: assignment.capabilityId,
		capabilityRevisionId: assignment.capabilityRevisionId,
		sealedContextId: context.sealedContextId,
		localStatus: "resolved",
		result,
		referenceApplications: applications.map((application) => ({
			path: application.path,
			status: "applied" as const,
			application: application.application,
		})),
		limitations: [],
		residualNeeds: [],
		provenance: { kind: "model", source: provenanceSource },
	};
}

function coverageProposal(
	target: NeedCoverageTarget,
	contributionId: string,
	provenanceSource: string,
): NeedCoverageProposal {
	return {
		...target,
		status: "covered",
		dispositions: [
			{
				contributionId,
				status: "supports",
				basis: ["The accepted Contribution directly supplies this Need."],
			},
		],
		conflicts: [],
		basis: ["Current support is sufficient to evaluate the Requirement."],
		provenance: { kind: "model", source: provenanceSource },
	};
}

function closureProposal(
	contract: JudgmentClosureContract,
	coverageId: string,
	provenanceSource: string,
): JudgmentClosureProposal {
	return {
		workCaseId: contract.workCaseId,
		judgmentId: contract.judgmentId,
		category: contract.category,
		contextRevisionId: contract.contextRevisionId,
		outcome: "conclude",
		answer: `The ${contract.category} requirement is satisfied within the sealed pilot context.`,
		refusalReasons: [],
		requirementDispositions: [
			{
				requirementId: contract.requirements[0]?.requirementId ?? "",
				status: "satisfied",
				coverageIds: [coverageId],
				basis: ["The requirement cites one current covered Need."],
			},
		],
		basis: ["The current covered Need satisfies the bounded requirement."],
		provenance: { kind: "model", source: provenanceSource },
	};
}

function recordEvaluator(): PilotEvaluator {
	const provenanceSource = "record-provider/model-a";
	return {
		provenanceSource,
		applicability(target, scenario) {
			const raw = {
				verdict: "use",
				matched: { [scenario.rootWhen]: true },
				reason: scenario.rootBasis,
			};
			return {
				workCaseId: target.workCaseId,
				judgmentId: target.judgmentId,
				contributionNeedId: target.contributionNeedId,
				capabilityRevisionId: target.capability.capabilityRevisionId,
				status: raw.verdict === "use" ? "applicable" : "not-applicable",
				matchedWhen: Object.keys(raw.matched).filter(
					(condition) => raw.matched[condition],
				),
				matchedUnless: [],
				basis: [raw.reason],
				missingContext: [],
			};
		},
		references(capability, scenario) {
			const raw = Object.fromEntries(
				capability.toc.references.map((reference) => {
					const selected = selectedApplication(scenario, reference.path) !== undefined;
					return [
						reference.path,
						{ include: selected, reason: referenceBasis(selected) },
					];
				}),
			);
			return Object.entries(raw).map(([path, decision]) => ({
				path,
				status: decision.include ? "selected" : "not-needed",
				basis: [decision.reason],
			}));
		},
		contribution(assignment, context, scenario) {
			const raw = {
				complete: true,
				answer: scenario.result,
				uses: Object.fromEntries(
					scenario.selectedApplications.map((application) => [
						application.path,
						application.application,
					]),
				),
			};
			assert.equal(raw.complete, true);
			return contributionProposal(
				assignment,
				context,
				raw.answer,
				Object.entries(raw.uses).map(([path, application]) => ({
					path,
					application,
				})),
				provenanceSource,
			);
		},
		coverage(target, contributionId) {
			const raw = { judgment: "enough", contributionId };
			assert.equal(raw.judgment, "enough");
			return coverageProposal(target, raw.contributionId, provenanceSource);
		},
		closure(contract, coverageId) {
			const raw = { decision: "close", coverage: coverageId };
			assert.equal(raw.decision, "close");
			return closureProposal(contract, raw.coverage, provenanceSource);
		},
	};
}

function tupleEvaluator(): PilotEvaluator {
	const provenanceSource = "tuple-provider/model-b";
	return {
		provenanceSource,
		applicability(target, scenario) {
			const raw = ["Y", scenario.rootWhen, scenario.rootBasis] as const;
			return {
				workCaseId: target.workCaseId,
				judgmentId: target.judgmentId,
				contributionNeedId: target.contributionNeedId,
				capabilityRevisionId: target.capability.capabilityRevisionId,
				status: raw[0] === "Y" ? "applicable" : "not-applicable",
				matchedWhen: [raw[1]],
				matchedUnless: [],
				basis: [raw[2]],
				missingContext: [],
			};
		},
		references(capability, scenario) {
			const raw = capability.toc.references
				.map((reference) => {
					const selected = selectedApplication(scenario, reference.path) !== undefined;
					return [
						reference.path,
						selected ? "R" : "S",
						referenceBasis(selected),
					] as const;
				})
				.reverse();
			return raw.map(([path, disposition, basis]) => ({
				path,
				status: disposition === "R" ? "selected" : "not-needed",
				basis: [basis],
			}));
		},
		contribution(assignment, context, scenario) {
			const raw = [
				"resolved",
				scenario.result,
				scenario.selectedApplications.map(
					(application) =>
						[application.path, application.application] as const,
				),
			] as const;
			assert.equal(raw[0], "resolved");
			return contributionProposal(
				assignment,
				context,
				raw[1],
				raw[2]
					.map(([path, application]) => ({ path, application }))
					.reverse(),
				provenanceSource,
			);
		},
		coverage(target, contributionId) {
			const raw = ["C", contributionId] as const;
			assert.equal(raw[0], "C");
			return coverageProposal(target, raw[1], provenanceSource);
		},
		closure(contract, coverageId) {
			const raw = ["DONE", coverageId] as const;
			assert.equal(raw[0], "DONE");
			return closureProposal(contract, raw[1], provenanceSource);
		},
	};
}

async function runPilot(
	scenario: PilotScenario,
	evaluator: PilotEvaluator,
): Promise<PilotResult> {
	const skillBytes = await readFile(join(scenario.skillRootPath, "SKILL.md"));
	const tocBytes = await readFile(
		join(scenario.skillRootPath, scenario.tocFilename),
	);
	const parsed = parseTocBytes(tocBytes);
	if (!parsed.ok) throw new Error(parsed.error.message);
	const bound = bindCapability(scenario.source, parsed.value, skillBytes);
	if (!bound.ok) throw new Error(bound.error.message);

	const target = {
		workCaseId: `work-pilot-${scenario.name}`,
		judgmentId: `judgment-pilot-${scenario.name}`,
		contributionNeedId: `need-pilot-${scenario.name}`,
		capability: bound.value,
	};
	const applicability = acceptCapabilityApplicability(
		target,
		evaluator.applicability(target, scenario),
	);
	if (applicability.status !== "assigned") {
		throw new Error(`Expected assignment, received ${applicability.status}`);
	}
	const selected = selectDeclaredReferences(
		bound.value.toc.references,
		evaluator.references(bound.value, scenario),
	);
	if (selected.status === "invalid") throw new Error("Invalid selection");
	const selection = bindReferenceSelection(
		applicability.assignment,
		bound.value,
		selected,
	);
	if (!selection.ok) throw new Error(selection.error.message);
	assert.equal(selection.value.status, "ready");
	const sealed = await sealSkillContext({
		skillRootPath: scenario.skillRootPath,
		capability: bound.value,
		assignment: applicability.assignment,
		selection: selection.value,
	});
	if (!sealed.ok) throw new Error(sealed.error.message);
	const contribution = acceptSkillContribution(
		applicability.assignment,
		sealed.value,
		evaluator.contribution(applicability.assignment, sealed.value, scenario),
	);
	if (contribution.status !== "accepted") {
		throw new Error(contribution.error.message);
	}

	const coverageTarget = {
		workCaseId: applicability.assignment.workCaseId,
		judgmentId: applicability.assignment.judgmentId,
		contributionNeedId: applicability.assignment.contributionNeedId,
	};
	const coverage = assessNeedCoverage(
		coverageTarget,
		[contribution.value],
		evaluator.coverage(coverageTarget, contribution.value.contributionId),
	);
	if (coverage.status !== "accepted") throw new Error(coverage.error.message);
	const requirementId = `requirement-pilot-${scenario.name}`;
	const contract = {
		workCaseId: coverageTarget.workCaseId,
		judgmentId: coverageTarget.judgmentId,
		category: scenario.category,
		subject: scenario.subject,
		contextRevisionId: `context-pilot-${scenario.name}`,
		requirements: [
			{
				requirementId,
				statement: `${scenario.category} is adequate for the pilot subject.`,
				contributionNeedIds: [coverageTarget.contributionNeedId],
			},
		],
	} satisfies JudgmentClosureContract;
	const closure = closeJudgment(
		contract,
		[coverage.value],
		evaluator.closure(contract, coverage.value.coverageId),
	);
	if (closure.status !== "concluded") {
		throw new Error(`Expected Conclusion, received ${closure.status}`);
	}

	return {
		capabilityId: bound.value.capabilityId,
		capabilityRevisionId: bound.value.capabilityRevisionId,
		assignmentId: applicability.assignment.assignmentId,
		selectionId: selection.value.selectionId,
		sealedContextId: sealed.value.sealedContextId,
		contributionId: contribution.value.contributionId,
		coverageId: coverage.value.coverageId,
		conclusionId: closure.value.conclusionId,
		selectedPaths: selection.value.selectedPaths,
		contributionProvenance: contribution.value.provenance.source,
		coverageProvenance: coverage.value.provenance.source,
		conclusionProvenance: closure.value.provenance.source,
	};
}

const scenarios: readonly PilotScenario[] = [
	{
		name: "verify",
		skillRootPath: join(packageRoot, "skills", "verify"),
		tocFilename: "toc.json",
		source: {
			kind: "package",
			locator: "npm:@hobin/developer@pilot",
			skillRoot: "skills/verify",
		},
		category: "Claim Assurance",
		rootWhen:
			"A concrete completion, correctness, compatibility, coverage, or evidence claim must be judged.",
		rootBasis: "The delegated Need asks which integration claim current evidence supports.",
		selectedApplications: [
			{
				path: "references/verifier-selection-and-pass-but-wrong.md",
				application:
					"The verifier matrix distinguishes execution from relevance and exposes a plausible pass-but-wrong package boundary.",
			},
		],
		result:
			"The package-level check supports the bounded integration claim, subject to the named observer and source revision.",
		subject: "The package integration claim is supported by relevant evidence.",
	},
	{
		name: "model",
		skillRootPath: join(packageRoot, "skills", "model"),
		tocFilename: "toc.json",
		source: {
			kind: "package",
			locator: "npm:@hobin/developer@pilot",
			skillRoot: "skills/model",
		},
		category: "Contextual Adequacy",
		rootWhen:
			"Consequential conditions, rules, contracts, histories, or proof boundaries must be modeled.",
		rootBasis: "Retry and duplicate histories remain unresolved and materially affect correctness.",
		selectedApplications: [
			{
				path: "references/problem-modeling.md",
				application:
					"The admitted domain separates current, stale, duplicate, and acknowledged event states.",
			},
			{
				path: "references/temporal-behavior-models.md",
				application:
					"Allowed-history and progress distinctions expose the missing duplicate frame condition.",
			},
		],
		result:
			"The condition model forbids duplicate effects while permitting repeated observations and requires eventual acknowledgment for progress.",
		subject: "The retry and duplicate condition space is adequately modeled.",
	},
	{
		name: "deployment-check",
		skillRootPath: join(
			packageRoot,
			"tests",
			"fixtures",
			"action-loop-external-skill",
		),
		tocFilename: "routing.json",
		source: {
			kind: "project",
			locator: "project:/fixture-workspace",
			skillRoot: ".pi/skills/deployment-check",
		},
		category: "Consequence Integrity",
		rootWhen:
			"A deployment change requires a bounded rollback consequence assessment.",
		rootBasis: "The current deployment can mutate durable state before success is observable.",
		selectedApplications: [
			{
				path: "references/rollback-surface.md",
				application:
					"The rollback surface identifies the durable write that cannot be reversed automatically.",
			},
		],
		result:
			"The deployment is consequence-safe only when the irreversible write is delayed until the rollback checkpoint.",
		subject: "The deployment preserves an acceptable rollback boundary.",
	},
];

test("verify, model, and project Skill preserve semantic identity across evaluator adapters", async () => {
	const capabilityIds = new Set<string>();
	for (const scenario of scenarios) {
		const record = await runPilot(scenario, recordEvaluator());
		const tuple = await runPilot(scenario, tupleEvaluator());
		assert.deepEqual(record.selectedPaths, scenario.selectedApplications.map(({ path }) => path));
		assert.deepEqual(tuple.selectedPaths, record.selectedPaths);
		assert.deepEqual(
			{
				capabilityId: tuple.capabilityId,
				capabilityRevisionId: tuple.capabilityRevisionId,
				assignmentId: tuple.assignmentId,
				selectionId: tuple.selectionId,
				sealedContextId: tuple.sealedContextId,
				contributionId: tuple.contributionId,
				coverageId: tuple.coverageId,
				conclusionId: tuple.conclusionId,
			},
			{
				capabilityId: record.capabilityId,
				capabilityRevisionId: record.capabilityRevisionId,
				assignmentId: record.assignmentId,
				selectionId: record.selectionId,
				sealedContextId: record.sealedContextId,
				contributionId: record.contributionId,
				coverageId: record.coverageId,
				conclusionId: record.conclusionId,
			},
		);
		assert.deepEqual(
			[
				tuple.contributionProvenance,
				tuple.coverageProvenance,
				tuple.conclusionProvenance,
			],
			Array(3).fill(tupleEvaluator().provenanceSource),
		);
		assert.notEqual(tuple.contributionProvenance, record.contributionProvenance);
		capabilityIds.add(record.capabilityId);
	}
	assert.equal(capabilityIds.size, scenarios.length);
});
