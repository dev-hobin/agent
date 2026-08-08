import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { type TestContext } from "node:test";
import {
	acceptLivePiActionCandidate,
	assessLiveActionClearance,
	clearedLivePiToolNames,
	matchingLiveActionClearance,
} from "../extensions/action-loop-action.ts";
import { assessLiveCapabilityApplicability } from "../extensions/action-loop-applicability.ts";
import {
	loadLiveSelectedReference,
	selectAndSealLiveStructuredCapability,
} from "../extensions/action-loop-context.ts";
import { acceptLiveSkillContribution } from "../extensions/action-loop-contribution.ts";
import { assessLiveNeedCoverage } from "../extensions/action-loop-coverage.ts";
import {
	beginLiveActionEffect,
	currentLiveEffectAssessmentId,
	observeLivePiToolResult,
	observeLivePiToolResultForEffect,
	settleLiveEffect,
} from "../extensions/action-loop-effect.ts";
import { closeLiveJudgment } from "../extensions/action-loop-conclusion.ts";
import { openLiveJudgment } from "../extensions/action-loop-judgment.ts";
import { openLiveWorkCase } from "../extensions/action-loop-work-case.ts";
import { bindCapability } from "../src/action-loop/routing/bind-capability.ts";
import {
	parseTocBytes,
	SKILL_TOC_SCHEMA_URI,
} from "../src/action-loop/routing/parse-toc.ts";

const encoder = new TextEncoder();
const declaredWhen = "A concrete Claim requires evidence.";
const skillText = "---\nname: verify\n---\n# Verify exactly\n";
const relevantPath = "references/relevant.md";
const unnecessaryPath = "references/unnecessary.md";

async function fixture(t: TestContext) {
	const root = await mkdtemp(join(tmpdir(), "developer-live-structured-"));
	t.after(async () => rm(root, { recursive: true, force: true }));
	await mkdir(join(root, "references"));
	await writeFile(join(root, "SKILL.md"), skillText);
	await writeFile(join(root, relevantPath), "Relevant verifier rule.\n");
	await writeFile(join(root, unnecessaryPath), "Unnecessary branch rule.\n");
	const parsed = parseTocBytes(
		encoder.encode(
			JSON.stringify({
				$schema: SKILL_TOC_SCHEMA_URI,
				when: [declaredWhen],
				unless: ["There is no concrete Claim to assess."],
				references: [
					{ path: relevantPath, when: ["Verifier relevance is unresolved."] },
					{ path: unnecessaryPath, when: ["A separate risk is present."] },
				],
			}),
		),
	);
	if (!parsed.ok) throw new Error(parsed.error.message);
	const bound = bindCapability(
		{
			kind: "project",
			locator: "project:live-structured-fixture",
			skillRoot: "skills/verify",
		},
		parsed.value,
		encoder.encode(skillText),
	);
	if (!bound.ok) throw new Error(bound.error.message);
	const work = openLiveWorkCase(undefined, {
		outcome: {
			statement: "The Claim uses one exact selected verifier Reference.",
			acceptanceConditions: ["Every declared Reference is dispositioned."],
			constraints: ["No partial selected material is exposed."],
		},
		basis: ["The delegated Outcome requires a structured verifier."],
		provenance: { kind: "model", source: "test-evaluator" },
	});
	if (work.status !== "opened") throw new Error("Work Case did not open");
	const judgment = openLiveJudgment(work.value, {
		category: "Claim Assurance",
		subject: "The current bounded Claim.",
		question: "Which verifier material is needed?",
		requirements: [
			{
				statement: "Verifier material has complete accounting.",
				contributionNeeds: ["claim-relevant verifier"],
			},
		],
		basis: ["The Claim requires selected evidence guidance."],
		provenance: { kind: "model", source: "test-evaluator" },
	});
	if (judgment.status !== "opened") throw new Error("Judgment did not open");
	const entry = {
		candidate: { skillRootPath: root },
		capability: bound.value,
	};
	const assessed = assessLiveCapabilityApplicability(judgment.state, entry, {
		status: "applicable",
		matchedWhen: [declaredWhen],
		matchedUnless: [],
		basis: ["The current Need asks for a Claim verifier."],
		missingContext: [],
	});
	if (assessed.status !== "assessed" || !assessed.assignment) {
		throw new Error("Capability was not assigned");
	}
	return { entry, state: assessed.state, assignment: assessed.assignment };
}

const readyDispositions = [
	{
		path: relevantPath,
		status: "selected" as const,
		basis: ["Verifier relevance is unresolved for the current Claim."],
	},
	{
		path: unnecessaryPath,
		status: "not-needed" as const,
		basis: ["The separate risk is absent from the bounded Claim."],
	},
];

test("ready structured selection seals Skill and selected References atomically", async (t) => {
	const current = await fixture(t);
	const result = await selectAndSealLiveStructuredCapability(
		current.state,
		current.entry,
		current.assignment,
		readyDispositions,
	);

	assert.equal(result.status, "sealed");
	if (result.status !== "sealed" || !result.context) return;
	assert.match(result.selectionId, /^selection_[a-f0-9]{64}$/);
	assert.deepEqual(result.context.selectedPaths, [relevantPath]);
	assert.deepEqual(
		result.context.materials.map(({ path }) => path),
		["SKILL.md", relevantPath],
	);
	assert.deepEqual(
		result.state.referenceSelections.map(({ status }) => status),
		["ready"],
	);
	const loaded = loadLiveSelectedReference(
		result.state,
		result.context.sealedContextId,
		relevantPath,
	);
	assert.equal(loaded.status, "loaded");
	if (loaded.status === "loaded") {
		assert.equal(loaded.content, "Relevant verifier rule.\n");
		assert.match(loaded.hash, /^sha256_[a-f0-9]{64}$/);
	}
	assert.equal(
		loadLiveSelectedReference(
			result.state,
			result.context.sealedContextId,
			unnecessaryPath,
		).status,
		"invalid",
	);
	const contributed = acceptLiveSkillContribution(result.state, current.entry, {
		localStatus: "resolved",
		result: "The selected verifier rule supports the current Claim.",
		referenceApplications: [
			{
				path: relevantPath,
				status: "applied",
				application: "Used the relevance rule to choose the verifier.",
			},
		],
		limitations: ["The separate risk was explicitly outside this Claim."],
		residualNeeds: [],
		provenance: { kind: "model", source: "test-evaluator" },
	});
	assert.equal(contributed.status, "accepted");
	if (contributed.status === "accepted") {
		assert.deepEqual(
			contributed.contribution.referenceApplications.map(({ path }) => path),
			[relevantPath],
		);
		const coverage = assessLiveNeedCoverage(contributed.state, {
			status: "covered",
			dispositions: [
				{
					contributionId: contributed.contribution.contributionId,
					status: "supports",
					basis: ["The selected verifier result fully serves the Need."],
				},
			],
			conflicts: [],
			basis: ["Every current Contribution has complete disposition."],
			provenance: { kind: "model", source: "test-evaluator" },
		});
		assert.equal(coverage.status, "assessed");
		if (coverage.status === "assessed") {
			assert.equal(coverage.coverage.status, "covered");
			assert.deepEqual(coverage.state.needCoverages, [coverage.coverage]);
			const requirement =
				coverage.state.workCase.openJudgments[0].requirements[0];
			const closed = closeLiveJudgment(coverage.state, {
				outcome: "conclude",
				answer: "The selected verifier Contribution supports the Claim.",
				refusalReasons: [],
				requirementDispositions: [
					{
						requirementId: requirement.requirementId,
						status: "satisfied",
						coverageIds: [coverage.coverage.coverageId],
						basis: ["The only Requirement has complete covered evidence."],
					},
				],
				basis: ["All current Coverage and Requirement accounting is complete."],
				provenance: { kind: "model", source: "test-evaluator" },
			});
			assert.equal(closed.status, "concluded");
			if (closed.status === "concluded") {
				assert.deepEqual(closed.state.workCase.openJudgments, []);
				assert.deepEqual(closed.state.workCase.conclusions, [
					closed.conclusion,
				]);
				const toolInput = {
					path: "/tmp/bounded-artifact.txt",
					content: "verified content",
				};
				const action = acceptLivePiActionCandidate(closed.state, {
					toolName: "write",
					toolInput,
					summary: "Write one bounded verified artifact.",
					intendedEffects: ["The bounded artifact is updated."],
					requiredConclusionIds: [closed.conclusion.conclusionId],
				});
				assert.equal(action.status, "accepted");
				if (action.status === "accepted") {
					assert.deepEqual(action.state.workCase.actionCandidates, [
						action.candidate,
					]);
					assert.deepEqual(action.state.workCase.actionClearances, []);
					const hostClearance = assessLiveActionClearance(
						action.state,
						action.candidate.actionCandidateId,
						{
							actionCandidateId: action.candidate.actionCandidateId,
							status: "granted",
							source: "pi:default-permission-policy",
							basis: [
								"The live adapter inherits Pi's default permission policy.",
							],
						},
					);
					assert.equal(hostClearance.status, "cleared");
					if (hostClearance.status === "cleared") {
						assert.deepEqual(clearedLivePiToolNames(hostClearance.state), [
							"write",
						]);
						assert.deepEqual(hostClearance.state.workCase.actionClearances, [
							hostClearance.clearance,
						]);
						assert.deepEqual(
							matchingLiveActionClearance(
								hostClearance.state,
								"write",
								toolInput,
							),
							hostClearance.clearance,
						);
						assert.equal(
							matchingLiveActionClearance(hostClearance.state, "write", {
								...toolInput,
								content: "different content",
							}),
							undefined,
						);
						const effect = beginLiveActionEffect(
							hostClearance.state,
							hostClearance.clearance,
							"pi-tool-call:write:1",
						);
						assert.equal(effect.status, "begun");
						if (effect.status === "begun") {
							assert.deepEqual(effect.state.workCase.effects, [effect.effect]);
							assert.equal(effect.effect.status, "pending");
							assert.deepEqual(clearedLivePiToolNames(effect.state), []);
							assert.equal(
								matchingLiveActionClearance(effect.state, "write", toolInput),
								undefined,
							);
							const observed = observeLivePiToolResult(
								effect.state,
								"write",
								"pi-tool-call:write:1",
								{
									isError: false,
									content: [{ type: "text", text: "wrote file" }],
									details: null,
								},
							);
							assert.equal(observed.status, "observed");
							if (observed.status === "observed") {
								assert.deepEqual(observed.state.effectObservations, [
									observed.observation,
								]);
								assert.equal(
									observed.state.workCase.effects[0]?.status,
									"pending",
								);
								assert.match(
									observed.observation.statement,
									/"text":"wrote file"/,
								);
								assert.match(
									observed.observation.limitations[0] ?? "",
									/not implicit Effect success/,
								);
								const settlement = settleLiveEffect(
									observed.state,
									effect.effect.effectId,
									{
										outcome: "unknown",
										observationDispositions: [
											{
												effectObservationId:
													observed.observation.effectObservationId,
												status: "relied-on",
												basis: [
													"The Pi tool result proves occurrence but not artifact state.",
												],
											},
										],
										intendedEffectDispositions: [
											{
												intendedEffect: "The bounded artifact is updated.",
												status: "unknown",
												observationIds: [
													observed.observation.effectObservationId,
												],
												basis: [
													"No artifact-state verifier has observed the intended Effect.",
												],
											},
										],
										basis: [
											"Keep the Effect unsettled until artifact state is observed.",
										],
									},
								);
								assert.equal(settlement.status, "unsettled");
								if (settlement.status === "unsettled") {
									assert.equal(settlement.assessment.outcome, "unknown");
									assert.equal(
										currentLiveEffectAssessmentId(
											settlement.state,
											effect.effect.effectId,
										),
										settlement.assessment.effectAssessmentId,
									);
									const verified = observeLivePiToolResultForEffect(
										settlement.state,
										{
											effectId: effect.effect.effectId,
											toolName: "read",
											toolCallId: "pi-tool-call:read:1",
											result: {
												isError: false,
												content: [
													{
														type: "text",
														text: "verified content",
													},
												],
												details: null,
											},
										},
									);
									assert.equal(verified.status, "observed");
									if (verified.status === "observed") {
										assert.equal(verified.state.effectObservations.length, 2);
										const resettled = settleLiveEffect(
											verified.state,
											effect.effect.effectId,
											{
												expectedCurrentAssessmentId:
													settlement.assessment.effectAssessmentId,
												outcome: "observed-success",
												observationDispositions: [
													{
														effectObservationId:
															observed.observation.effectObservationId,
														status: "not-relied-on",
														basis: [
															"The write receipt does not verify artifact bytes.",
														],
													},
													{
														effectObservationId:
															verified.observation.effectObservationId,
														status: "relied-on",
														basis: [
															"The read result directly verifies the artifact content.",
														],
													},
												],
												intendedEffectDispositions: [
													{
														intendedEffect: "The bounded artifact is updated.",
														status: "observed",
														observationIds: [
															verified.observation.effectObservationId,
														],
														basis: [
															"The exact read result matches the intended artifact.",
														],
													},
												],
												basis: [
													"Every current Observation is dispositioned and the intended Effect is observed.",
												],
											},
										);
										assert.equal(resettled.status, "settled");
									}
								}
							}
						}
					}
				}
			}
		}
		assert.equal(
			assessLiveNeedCoverage(contributed.state, {
				status: "covered",
				dispositions: [],
				conflicts: [],
				basis: ["A Contribution was omitted."],
				provenance: { kind: "model", source: "test-evaluator" },
			}).status,
			"invalid",
		);
	}
	const repeated = await selectAndSealLiveStructuredCapability(
		result.state,
		current.entry,
		current.assignment,
		readyDispositions,
	);
	assert.equal(repeated.status, "unchanged");
});

test("needs-context remains unsealed and incomplete accounting fails closed", async (t) => {
	const current = await fixture(t);
	const unresolved = await selectAndSealLiveStructuredCapability(
		current.state,
		current.entry,
		current.assignment,
		[
			readyDispositions[0],
			{
				path: unnecessaryPath,
				status: "needs-context",
				basis: ["Whether the separate risk exists is not yet observed."],
			},
		],
	);
	const incomplete = await selectAndSealLiveStructuredCapability(
		current.state,
		current.entry,
		current.assignment,
		[readyDispositions[0]],
	);

	assert.equal(unresolved.status, "selected");
	if (unresolved.status === "selected") {
		assert.equal(unresolved.context, undefined);
		assert.deepEqual(unresolved.state.sealedSkillContexts, []);
		assert.deepEqual(
			unresolved.state.referenceSelections.map(({ status }) => status),
			["needs-context"],
		);
	}
	assert.equal(incomplete.status, "invalid");
});
