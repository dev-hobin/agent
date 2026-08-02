import assert from "node:assert/strict";
import test from "node:test";

import {
	assessMemoContext,
	assessObservationContext,
	decodeContextBasisData,
	encodeContextBasisData,
	type SourceReading,
} from "../src/observer-context.ts";

const sourceReading: SourceReading = {
	readingId: "source-reading-01",
	episodeId: "episode-01",
	sourceId: "source-01",
	faithfulSummary: "The source distinguishes evidence from interpretation.",
	claims: [
		{
			text: "Evidence and interpretation remain separate.",
			locator: "section 2",
		},
	],
};

test("observation context preserves domain and agent assurance without inquiry ceremony", async () => {
	const result = await assessObservationContext({
		sourceReading,
		inquiryContext: null,
		relatedInquiryIds: [],
	});
	if (!result.ok) assert.fail(result.message);
	assert.deepEqual(result.basis.selectedSourceIds, ["source-reading-evidence"]);
	assert.equal(result.basis.coverage.missing.length, 0);
	assert.deepEqual(
		result.basis.coverage.claims.map((claim) => [
			claim.needId,
			claim.assurance,
		]),
		[
			["semantic-interpretation", "agent-asserted"],
			["source-reading-basis", "domain-verified"],
		],
	);
});

test("context basis codec rejects hash drift and extra keys", async () => {
	const result = await assessObservationContext({
		sourceReading,
		inquiryContext: null,
		relatedInquiryIds: [],
	});
	if (!result.ok) assert.fail(result.message);
	const encoded = encodeContextBasisData(result.basis);
	const decoded = decodeContextBasisData(encoded);
	if (!decoded.ok) assert.fail(decoded.message);
	assert.deepEqual(decoded.value, result.basis);

	const extra = structuredClone(encoded);
	assert.ok(typeof extra === "object" && extra !== null);
	Reflect.set(extra, "unexpected", true);
	assert.equal(decodeContextBasisData(extra).ok, false);

	const drifted = structuredClone(encoded);
	assert.ok(typeof drifted === "object" && drifted !== null);
	const coverage = Reflect.get(drifted, "coverage");
	assert.ok(typeof coverage === "object" && coverage !== null);
	Reflect.set(coverage, "coverage_sha256", "f".repeat(64));
	const drift = decodeContextBasisData(drifted);
	assert.equal(drift.ok, false);
	if (drift.ok) assert.fail("Expected coverage hash drift");
	assert.match(drift.message, /identity does not match/iu);
});

test("related inquiry context must match exactly before observation mutation", async () => {
	const missing = await assessObservationContext({
		sourceReading,
		inquiryContext: null,
		relatedInquiryIds: ["inquiry-01"],
	});
	assert.equal(missing.ok, false);
	if (missing.ok) assert.fail("Expected missing inquiry context");
	assert.deepEqual(missing.missing, [
		"inquiry-context-basis",
		"semantic-interpretation",
	]);

	const covered = await assessObservationContext({
		sourceReading,
		inquiryContext: {
			inquiryContextId: "inquiry-context-01",
			readingId: sourceReading.readingId,
			inquiryIds: ["inquiry-01"],
			contextDigest: "a".repeat(64),
		},
		relatedInquiryIds: ["inquiry-01"],
	});
	if (!covered.ok) assert.fail(covered.message);
	assert.deepEqual(covered.basis.selectedSourceIds, [
		"inquiry-context-evidence",
		"source-reading-evidence",
	]);
	assert.equal(covered.basis.coverage.missing.length, 0);
});

test("memo context uses one named domain evaluator for basis, closure, and accounting", async () => {
	const result = await assessMemoContext({
		scopeId: "memo-scope-01",
		episodeId: "episode-01",
		basisDigest: "b".repeat(64),
		relatedInquiryIds: ["inquiry-01"],
		knownEvidenceIds: ["evidence-01"],
		passDigest: "c".repeat(64),
		outcomeCount: 2,
		dispositionCount: 1,
	});
	if (!result.ok) assert.fail(result.message);
	assert.deepEqual(result.basis.selectedSourceIds, [
		"memo-pass-evidence",
		"memo-scope-evidence",
	]);
	assert.ok(
		result.basis.coverage.claims.every(
			(claim) => claim.assurance === "domain-verified",
		),
	);
});
