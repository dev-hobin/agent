import assert from "node:assert/strict";
import test from "node:test";

import {
	DeveloperContextResultParseError,
	developerContextBasisSha256,
	parseDeveloperContextBasis,
	type DeveloperContextBasis,
} from "../src/context-result.ts";
const GOLDEN_CONTEXT_BASIS_SHA256 =
	"d4f010fbf2f55e017a5676ecc7e1f79e9932bf85f9da37f348dcc25f845b057c";

const sha = (character: string) => character.repeat(64);

function basisBody(): Omit<DeveloperContextBasis, "contextBasisSha256"> {
	return {
		judgmentId: "judgment:context-result",
		policySha256: sha("a"),
		questionSha256: sha("b"),
		selectionSha256: sha("c"),
		sealedContextSha256: sha("d"),
		coverageSha256: sha("e"),
		outcomeSha256: sha("f"),
		contextSources: [
			{
				inventorySourceId: "source:context-result",
				descriptorSha256: sha("1"),
				policySha256: sha("2"),
				applicability: "applicable",
				applicabilitySha256: sha("3"),
			},
		],
		members: [
			{
				materialId: "material:agent",
				memberId: "member:agent",
				contentSha256: sha("4"),
			},
			{
				materialId: "material:domain",
				memberId: "member:domain",
				contentSha256: sha("5"),
			},
			{
				materialId: "material:user",
				memberId: "member:user",
				contentSha256: sha("6"),
			},
		],
		contributions: [
			{
				contributionId: "contribution:agent",
				materialId: "material:agent",
				useAs: "evidence",
				assurance: "agent-asserted",
			},
			{
				contributionId: "contribution:domain",
				materialId: "material:domain",
				useAs: "constraint",
				assurance: "domain-verified",
				evaluator: { id: "evaluator:context", version: "version:1" },
			},
			{
				contributionId: "contribution:user",
				materialId: "material:user",
				useAs: "decision",
				assurance: "user-accepted",
				userEventId: "event:user-context",
			},
		],
		conflictIds: ["conflict:context-result"],
		limitationIds: ["limitation:context-result"],
	};
}

function encodedBasis(): DeveloperContextBasis {
	const body = basisBody();
	return {
		...body,
		contextBasisSha256: developerContextBasisSha256(body),
	};
}

function clone<Value>(value: Value): Value {
	return JSON.parse(JSON.stringify(value)) as Value;
}

function hasContextFault(error: unknown): boolean {
	return error instanceof DeveloperContextResultParseError;
}

test("neutral context result preserves its canonical golden identity", () => {
	const value = encodedBasis();
	assert.equal(
		developerContextBasisSha256(basisBody()),
		GOLDEN_CONTEXT_BASIS_SHA256,
	);
	const current = parseDeveloperContextBasis(clone(value));
	assert.deepEqual(current, value);
	assert.equal(current.contextBasisSha256, GOLDEN_CONTEXT_BASIS_SHA256);
	assert.equal(Object.isFrozen(current), true);
	assert.equal(Object.isFrozen(current.members), true);
	assert.equal(Object.isFrozen(current.contributions), true);
});

test("neutral context result rejects malformed identity before use", () => {
	const unknownMaterial = clone(encodedBasis()) as unknown as Record<
		string,
		unknown
	>;
	const unknownContributions = clone(unknownMaterial.contributions) as Array<
		Record<string, unknown>
	>;
	unknownContributions[0] = {
		...unknownContributions[0],
		materialId: "material:missing",
	};
	unknownMaterial.contributions = unknownContributions;
	assert.throws(
		() => parseDeveloperContextBasis(unknownMaterial),
		hasContextFault,
	);

	const partialPolicy = clone(encodedBasis()) as unknown as Record<
		string,
		unknown
	>;
	const partialSources = clone(partialPolicy.contextSources) as Array<
		Record<string, unknown>
	>;
	delete partialSources[0]?.applicabilitySha256;
	partialPolicy.contextSources = partialSources;
	assert.throws(
		() => parseDeveloperContextBasis(partialPolicy),
		hasContextFault,
	);

	const wrongAuthority = clone(encodedBasis()) as unknown as Record<
		string,
		unknown
	>;
	const wrongContributions = clone(wrongAuthority.contributions) as Array<
		Record<string, unknown>
	>;
	wrongContributions[0] = {
		...wrongContributions[0],
		userEventId: "event:forged",
	};
	wrongAuthority.contributions = wrongContributions;
	assert.throws(
		() => parseDeveloperContextBasis(wrongAuthority),
		hasContextFault,
	);

	assert.throws(
		() =>
			parseDeveloperContextBasis({
				...encodedBasis(),
				contextBasisSha256: sha("0"),
			}),
		hasContextFault,
	);
	assert.throws(
		() => parseDeveloperContextBasis({ ...encodedBasis(), extra: true }),
		hasContextFault,
	);
});
