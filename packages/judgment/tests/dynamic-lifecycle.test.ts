import assert from "node:assert/strict";
import test from "node:test";

import {
	applicabilityRecorded,
	assessContextCoverage,
	concludeJudgment,
	contextContentSha256,
	coverageRecorded,
	decodeContextCoverageProposalData,
	decodeContextInventoryData,
	decodeContextSelectionProposalData,
	decodeDynamicJudgmentQuestionData,
	decodeJudgmentProposalData,
	decodeObservedContextData,
	decodePolicyOwnerData,
	decodeSealedContextProposalData,
	jsonValueFromUnknown,
	outcomeRecorded,
	parseContextApplicability,
	parseContextCoverageProposal,
	parseContextInventory,
	parseContextSelectionProposal,
	parseDynamicJudgmentQuestion,
	parseJudgmentProposal,
	parseObservedContext,
	parsePolicyOwner,
	parseSealedContext,
	selectContext,
	selectionRecorded,
	sealedContextRecorded,
	sha256,
	startJudgment,
	transitionJudgment,
	type ContextContentPart,
} from "../src/index.ts";

function fixture(error = false) {
	const owner = parsePolicyOwner(
		decodePolicyOwnerData(
			jsonValueFromUnknown({
				kind: "adapter-capability",
				namespace: "test",
				name: "verify",
				provenance: {
					source: "test",
					scope: "temporary",
					origin: "session",
				},
			}),
		),
	);
	const question = parseDynamicJudgmentQuestion(
		decodeDynamicJudgmentQuestionData(
			jsonValueFromUnknown({
				judgmentId: "judgment-1",
				owner: {
					kind: owner.kind,
					namespace: owner.namespace,
					name: owner.name,
					provenance: owner.provenance,
				},
				question: "What claim does this exact verifier result support?",
				basisMaterialIds: [],
				branchRef: "branch-1",
			}),
		),
	);
	const inventory = parseContextInventory(
		decodeContextInventoryData(
			jsonValueFromUnknown({ sources: [], capabilities: [] }),
		),
	);
	const parts: readonly ContextContentPart[] = [
		{ kind: "text", text: "one relevant verifier observation" },
	];
	const observed = parseObservedContext(
		decodeObservedContextData(
			jsonValueFromUnknown({
				branchRef: "branch-1",
				entries: [
					{
						id: "result-1",
						kind: "tool-result",
						contentSha256: contextContentSha256(parts),
						isError: error,
						truncated: false,
						sequence: 1,
						provenance: {
							source: "test",
							scope: "temporary",
							origin: "session",
						},
						toolCallId: "call-1",
						toolName: "test",
						argumentsSha256: sha256("args"),
					},
				],
			}),
		),
	);
	return { question, inventory, observed, parts };
}
function selectionFor(value = fixture()) {
	const entry = value.observed.entries[0];
	assert.ok(entry);
	const proposal = parseContextSelectionProposal(
		decodeContextSelectionProposalData(
			jsonValueFromUnknown({
				questionSha256: value.question.questionSha256,
				nominations: [
					{
						kind: "observed-context",
						observedContextId: entry.id,
						descriptorSha256: entry.descriptorSha256,
					},
				],
				selectionBasis: [
					"The verifier result directly constrains the dynamic question.",
				],
			}),
		),
	);
	return selectContext({
		question: value.question,
		inventory: value.inventory,
		observedContext: value.observed,
		proposal,
	});
}
function sealedFor(value = fixture()) {
	const selection = selectionFor(value);
	const binding = selection.bindings[0];
	assert.ok(binding);
	const sealed = parseSealedContext(
		decodeSealedContextProposalData(
			jsonValueFromUnknown({
				selectionSha256: selection.selectionSha256,
				members: [
					{
						bindingId: binding.bindingId,
						contentSha256: contextContentSha256(value.parts),
						isError: false,
						truncated: false,
						parts: value.parts,
					},
				],
			}),
		),
		selection,
	);
	return { ...value, selection, sealed };
}

test("external-only selection tolerates unrelated inventory additions but binds selected descriptors", () => {
	const value = fixture();
	const selection = selectionFor(value);
	assert.equal(selection.bindings.length, 1);
	const entry = value.observed.entries[0];
	assert.ok(entry);
	assert.throws(
		() =>
			selectContext({
				question: value.question,
				inventory: value.inventory,
				observedContext: value.observed,
				proposal: parseContextSelectionProposal(
					decodeContextSelectionProposalData(
						jsonValueFromUnknown({
							questionSha256: value.question.questionSha256,
							nominations: [
								{
									kind: "observed-context",
									observedContextId: entry.id,
									descriptorSha256: sha256("forged"),
								},
							],
							selectionBasis: ["forged"],
						}),
					),
				),
			}),
		/changed/u,
	);
});

test("error or truncated material cannot be selected", () => {
	assert.throws(() => selectionFor(fixture(true)), /cannot be selected/u);
});

test("coverage requires every selected material contribution and rejects forged authority", () => {
	const { sealed } = sealedFor();
	const empty = parseContextCoverageProposal(
		decodeContextCoverageProposalData(
			jsonValueFromUnknown({
				status: "sufficient",
				contributions: [],
				conflicts: [],
				limitations: [],
			}),
		),
	);
	assert.throws(
		() => assessContextCoverage({ selectedContext: sealed, proposal: empty }),
		/no contribution/u,
	);
	const forged = parseContextCoverageProposal(
		decodeContextCoverageProposalData(
			jsonValueFromUnknown({
				status: "sufficient",
				contributions: [
					{
						materialId: sealed.members[0]?.materialId,
						useAs: "evidence",
						contribution: "The result establishes the bounded claim.",
						assurance: "user-accepted",
						userEventId: "user-1",
					},
				],
				conflicts: [],
				limitations: [],
			}),
		),
	);
	assert.throws(
		() => assessContextCoverage({ selectedContext: sealed, proposal: forged }),
		/matching selected user event/u,
	);
});

test("dynamic lifecycle reaches a replayable contextual outcome", () => {
	const value = sealedFor();
	const materialId = value.sealed.members[0]?.materialId;
	assert.ok(materialId);
	const coverage = assessContextCoverage({
		selectedContext: value.sealed,
		proposal: parseContextCoverageProposal(
			decodeContextCoverageProposalData(
				jsonValueFromUnknown({
					status: "sufficient",
					contributions: [
						{
							materialId,
							useAs: "evidence",
							contribution:
								"The exact result supports only this bounded verifier claim.",
							assurance: "agent-asserted",
						},
					],
					conflicts: [],
					limitations: [],
				}),
			),
		),
	});
	const contributionId = coverage.contributions[0]?.contributionId;
	assert.ok(contributionId);
	const outcome = concludeJudgment({
		question: value.question,
		selectedContext: value.sealed,
		coverage,
		proposal: parseJudgmentProposal(
			decodeJudgmentProposalData(
				jsonValueFromUnknown({
					kind: "contextual-judgment",
					selectionSha256: value.selection.selectionSha256,
					sealedContextSha256: value.sealed.sealedContextSha256,
					coverageSha256: coverage.coverageSha256,
					citedUses: [
						{
							contributionId,
							artifactEffect:
								"The artifact narrows its claim to the observed result.",
						},
					],
					rationale: "The exact evidence supports the bounded claim.",
					artifact: "bounded verifier judgment",
					stopEvidence: ["Every claim is bound to one exact result."],
				}),
			),
		),
	});
	let state = startJudgment(value.question);
	state = transitionJudgment(
		state,
		applicabilityRecorded({
			state,
			applicability: parseContextApplicability({
				kind: "applicable",
				basis: ["A verifier claim is requested."],
			}),
		}),
	);
	state = transitionJudgment(
		state,
		selectionRecorded({ state, selection: value.selection }),
	);
	state = transitionJudgment(
		state,
		sealedContextRecorded({ state, sealedContext: value.sealed }),
	);
	state = transitionJudgment(state, coverageRecorded({ state, coverage }));
	state = transitionJudgment(state, outcomeRecorded({ state, outcome }));
	assert.equal(state.status, "terminal-outcome");
	assert.equal(state.outcome?.kind, "contextual-judgment");
});
