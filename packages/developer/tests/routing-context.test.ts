import assert from "node:assert/strict";
import test from "node:test";

import {
	accountRoutingPage,
	beginRoutingCoverage,
	completeRoutingCoverage,
	createCandidateDisposition,
	createCanServeRoutingBasis,
	createProposedFrameContribution,
	createRoutingCandidateDescriptor,
	createRoutingCandidatePages,
	createRoutingSnapshotManifest,
	routingCoverageComplete,
	verifyCanServeRoutingBasis,
	verifyCompletedRoutingCoverage,
	verifyProposedFrameContribution,
	type CandidateDisposition,
	type CanServeRoutingBasis,
	type CompletedRoutingCoverage,
	type RoutingCandidateDescriptor,
	type RoutingCandidateDescriptorBody,
} from "../src/routing-context.ts";
import {
	obligationSetSha256,
	parseDeveloperId,
	parseObligation,
	parseSha256Digest,
	parseSnapshotBasis,
	type Obligation,
	type SnapshotBasis,
} from "../src/runtime-protocol.ts";

const id = (value: string) => parseDeveloperId(value);
const sha = (character: string) => parseSha256Digest(character.repeat(64));

function obligations(frameId = id("frame:one")): readonly Obligation[] {
	return [
		parseObligation({
			obligationId: "obligation:a",
			frameId,
			statement: "A current bounded claim exists.",
		}),
		parseObligation({
			obligationId: "obligation:b",
			frameId,
			statement: "Relevant counterexamples are accounted for.",
		}),
	];
}

function snapshotBasis(
	currentObligations = obligations(),
	frameRevision = 1,
): SnapshotBasis {
	return parseSnapshotBasis({
		frameId: currentObligations[0]?.frameId,
		frameRevision,
		obligationSetSha256: obligationSetSha256(currentObligations),
		admittedUniverseSha256: sha("a"),
		providerSourceRevisions: [
			{ sourceId: "source:catalog", revision: "catalog-rev-1" },
		],
		priorityStrategySha256: sha("b"),
	});
}

function commonCandidate(
	candidateId: string,
	subjectId: string,
): {
	readonly candidateId: ReturnType<typeof id>;
	readonly source: {
		readonly sourceId: ReturnType<typeof id>;
		readonly revision: string;
	};
	readonly subjectId: ReturnType<typeof id>;
	readonly subjectRevisionSha256: ReturnType<typeof sha>;
} {
	return {
		candidateId: id(candidateId),
		source: { sourceId: id("source:catalog"), revision: "catalog-rev-1" },
		subjectId: id(subjectId),
		subjectRevisionSha256: sha("c"),
	};
}

function capability(
	candidateId = "candidate:capability",
	subjectId = "skill:specify",
): RoutingCandidateDescriptor {
	return createRoutingCandidateDescriptor({
		...commonCandidate(candidateId, subjectId),
		kind: "capability",
		registryRevisionSha256: sha("d"),
	});
}

function tool(candidateId = "candidate:tool"): RoutingCandidateDescriptor {
	return createRoutingCandidateDescriptor({
		...commonCandidate(candidateId, "tool:search"),
		kind: "tool",
		schemaSha256: sha("e"),
	});
}

function material(
	candidateId = "candidate:material",
): RoutingCandidateDescriptor {
	return createRoutingCandidateDescriptor({
		...commonCandidate(candidateId, "material:requirements"),
		kind: "material",
		contentDescriptorSha256: sha("f"),
	});
}

function effectDisposition(
	candidate: RoutingCandidateDescriptor,
	kind: CandidateDisposition["kind"],
	effects: readonly [
		CandidateDisposition["targetEffects"][number]["effect"],
		CandidateDisposition["targetEffects"][number]["effect"],
	],
): CandidateDisposition {
	return createCandidateDisposition({
		candidateId: candidate.candidateId,
		descriptorSha256: candidate.descriptorSha256,
		kind,
		targetEffects: [
			{ obligationId: id("obligation:a"), effect: effects[0] },
			{ obligationId: id("obligation:b"), effect: effects[1] },
		],
		rationale: "Exact finite-snapshot disposition.",
	});
}

test("all six descriptor roles stay exact and refined roles require provenance", () => {
	const provenance = {
		producerId: id("judgment:one"),
		producerRevisionSha256: sha("1"),
		basisSha256: sha("2"),
	};
	const descriptors = [
		capability(),
		tool(),
		material(),
		createRoutingCandidateDescriptor({
			...commonCandidate("candidate:constraint", "constraint:one"),
			kind: "constraint",
			refinement: provenance,
		}),
		createRoutingCandidateDescriptor({
			...commonCandidate("candidate:evidence", "evidence:one"),
			kind: "evidence",
			refinement: provenance,
		}),
		createRoutingCandidateDescriptor({
			...commonCandidate("candidate:decision", "decision:one"),
			kind: "decision",
			refinement: provenance,
		}),
	];
	assert.deepEqual(
		descriptors.map((descriptor) => descriptor.kind),
		["capability", "tool", "material", "constraint", "evidence", "decision"],
	);
	assert.equal(
		new Set(descriptors.map((entry) => entry.descriptorSha256)).size,
		6,
	);
	const refinedConstraint = descriptors[3];
	assert.equal(refinedConstraint?.kind, "constraint");
	if (refinedConstraint?.kind !== "constraint")
		assert.fail("missing constraint");
	assert.equal(Object.isFrozen(refinedConstraint.refinement), true);
	assert.equal("refinement" in (descriptors[2] ?? {}), false);

	const invalid = {
		...commonCandidate("candidate:forged-evidence", "evidence:forged"),
		kind: "evidence",
		contentDescriptorSha256: sha("3"),
	};
	assert.throws(
		() =>
			createRoutingCandidateDescriptor(
				invalid as unknown as RoutingCandidateDescriptorBody,
			),
		/invalid representation/u,
	);
});

test("pages preserve frozen priority order and seal exact counts with a chained root", () => {
	const currentObligations = obligations();
	const basis = snapshotBasis(currentObligations);
	const descriptors = Array.from({ length: 101 }, (_, index) =>
		material(`candidate:material-${String(index).padStart(3, "0")}`),
	);
	const pages = createRoutingCandidatePages(
		id("snapshot:one"),
		descriptors,
		100,
	);
	assert.equal(pages.length, 2);
	assert.equal(pages[0]?.candidates.length, 100);
	assert.equal(pages[1]?.candidates.length, 1);
	const manifest = createRoutingSnapshotManifest(
		id("snapshot:one"),
		basis,
		pages,
	);
	assert.equal(manifest.pageCount, 2);
	assert.equal(manifest.candidateCount, 101);

	const reversedPages = createRoutingCandidatePages(
		id("snapshot:one"),
		[...descriptors].reverse(),
		100,
	);
	const reversedManifest = createRoutingSnapshotManifest(
		id("snapshot:one"),
		basis,
		reversedPages,
	);
	assert.notEqual(
		manifest.orderedPageRootSha256,
		reversedManifest.orderedPageRootSha256,
	);
	assert.throws(
		() => createRoutingCandidatePages(id("snapshot:one"), descriptors, 101),
		/between 1 and 100/u,
	);
	assert.throws(
		() =>
			createRoutingCandidatePages(
				id("snapshot:one"),
				[descriptors[0]!, descriptors[0]!],
				100,
			),
		/candidate IDs must be unique/u,
	);
});

test("page accounting is exhaustive and blockers remain obligation-local", () => {
	const currentObligations = obligations();
	const basis = snapshotBasis(currentObligations);
	const selectedCapability = capability();
	const missingMaterial = material();
	const pages = createRoutingCandidatePages(
		id("snapshot:blocked"),
		[selectedCapability, missingMaterial],
		100,
	);
	const manifest = createRoutingSnapshotManifest(
		id("snapshot:blocked"),
		basis,
		pages,
	);
	let coverage = beginRoutingCoverage(basis, manifest, currentObligations);
	assert.throws(
		() =>
			accountRoutingPage(coverage, pages[0]!, [
				effectDisposition(selectedCapability, "selected-for-material", [
					"selected",
					"cleared",
				]),
			]),
		/exactly one disposition/u,
	);
	coverage = accountRoutingPage(coverage, pages[0]!, [
		effectDisposition(selectedCapability, "selected-for-material", [
			"selected",
			"cleared",
		]),
		effectDisposition(missingMaterial, "needs-context", [
			"optional-limitation",
			"blocked",
		]),
	]);
	assert.equal(coverage.targetSummaries[0]?.blockedCount, 0);
	assert.equal(coverage.targetSummaries[1]?.blockedCount, 1);
	assert.equal(routingCoverageComplete(coverage), false);
	assert.throws(
		() => completeRoutingCoverage(coverage),
		/incomplete, blocked/u,
	);
});

test("zero candidates complete and selected registered capabilities create exact can-serve bases", () => {
	const currentObligations = obligations();
	const basis = snapshotBasis(currentObligations);
	const zeroPages = createRoutingCandidatePages(id("snapshot:zero"), [], 100);
	const zeroManifest = createRoutingSnapshotManifest(
		id("snapshot:zero"),
		basis,
		zeroPages,
	);
	const zero = beginRoutingCoverage(basis, zeroManifest, currentObligations);
	assert.equal(routingCoverageComplete(zero), true);
	assert.equal(completeRoutingCoverage(zero).selectedCandidates.length, 0);

	const selected = capability();
	const selectedTool = tool();
	const pages = createRoutingCandidatePages(
		id("snapshot:selected"),
		[selected, selectedTool],
		100,
	);
	const manifest = createRoutingSnapshotManifest(
		id("snapshot:selected"),
		basis,
		pages,
	);
	const accounted = accountRoutingPage(
		beginRoutingCoverage(basis, manifest, currentObligations),
		pages[0]!,
		[
			effectDisposition(selected, "selected-for-material", [
				"selected",
				"cleared",
			]),
			effectDisposition(selectedTool, "selected-for-material", [
				"cleared",
				"selected",
			]),
		],
	);
	const completed = completeRoutingCoverage(accounted);
	const canServe = createCanServeRoutingBasis(completed, {
		basisId: id("basis:can-serve"),
		candidateId: selected.candidateId,
		targetObligationIds: [id("obligation:a")],
		methodRevisionSha256: sha("4"),
		policy: { kind: "absent" },
		rootApplicability: "applicable",
	});
	assert.equal(canServe.capabilityId, id("skill:specify"));
	assert.equal(canServe.contextBasisSha256, completed.coverageSha256);
	assert.throws(
		() =>
			verifyCompletedRoutingCoverage({
				...completed,
			} as CompletedRoutingCoverage),
		/not created by this runtime/u,
	);
	assert.throws(
		() =>
			verifyCanServeRoutingBasis(completed, {
				...canServe,
			} as CanServeRoutingBasis),
		/not created for current routing coverage/u,
	);
	assert.throws(
		() =>
			createCanServeRoutingBasis(completed, {
				basisId: id("basis:tool"),
				candidateId: selectedTool.candidateId,
				targetObligationIds: [id("obligation:b")],
				methodRevisionSha256: sha("4"),
				policy: { kind: "absent" },
				rootApplicability: "applicable",
			}),
		/registered capability/u,
	);
	assert.throws(
		() =>
			createCanServeRoutingBasis(completed, {
				basisId: id("basis:unselected"),
				candidateId: id("candidate:not-visible"),
				targetObligationIds: [id("obligation:a")],
				methodRevisionSha256: sha("4"),
				policy: { kind: "complete", revisionSha256: sha("5") },
				rootApplicability: "applicable",
			}),
		/was not selected/u,
	);
});

test("proposed contributions remain content-bound candidates without admission authority", () => {
	const proposal = createProposedFrameContribution({
		proposalId: id("proposal:one"),
		frameId: id("frame:one"),
		frameRevision: 1,
		source: {
			kind: "judgment-result",
			sourceId: id("judgment:one"),
			sourceRevisionSha256: sha("6"),
		},
		claim: "The bounded meaning is settled negatively.",
		applicability: "The claim applies to the current exact question.",
		targetUses: [{ obligationId: id("obligation:a"), useAs: "evidence" }],
		limitations: ["No mutation authority."],
		supportSha256: sha("7"),
	});
	assert.equal(verifyProposedFrameContribution(proposal), proposal);
	assert.equal("admitted" in proposal, false);
	assert.throws(
		() =>
			verifyProposedFrameContribution({
				...proposal,
				claim: "Representation drift.",
			}),
		/hash mismatch/u,
	);
});
