import { Type, type Static, type TProperties } from "typebox";
import { Errors, Parse } from "typebox/value";

import {
	PolicyOwnerDataSchema,
	decodePolicyOwnerData,
	parsePolicyOwner,
	policyOwnerIdentity,
	type PolicyOwner,
} from "./compiled-policy.ts";
import { JudgmentParseError } from "./errors.ts";
import { canonicalJson, sha256, type JsonValue } from "./json.ts";
import { IdentifierSchema, Sha256Schema } from "./schema.ts";

function exactObject<const T extends TProperties>(properties: T) {
	return Type.Object(properties, { additionalProperties: false });
}

export const DynamicJudgmentQuestionDataSchema = exactObject({
	judgmentId: IdentifierSchema,
	owner: PolicyOwnerDataSchema,
	policySha256: Type.Optional(Sha256Schema),
	question: Type.String({ minLength: 1, maxLength: 4_000, pattern: "\\S" }),
	basisMaterialIds: Type.Array(
		Type.String({ minLength: 1, maxLength: 300, pattern: "\\S" }),
		{
			maxItems: 128,
			uniqueItems: true,
		},
	),
	branchRef: Type.String({ minLength: 1, maxLength: 300, pattern: "\\S" }),
});

export type DynamicJudgmentQuestionData = Static<
	typeof DynamicJudgmentQuestionDataSchema
>;

const dynamicQuestionBrand: unique symbol = Symbol("DynamicJudgmentQuestion");

export interface DynamicJudgmentQuestion {
	readonly [dynamicQuestionBrand]: true;
	readonly judgmentId: string;
	readonly owner: PolicyOwner;
	readonly policySha256?: string;
	readonly question: string;
	readonly basisMaterialIds: readonly string[];
	readonly branchRef: string;
	readonly questionSha256: string;
}

function issues(value: JsonValue) {
	return [...Errors(DynamicJudgmentQuestionDataSchema, value)].map((issue) => ({
		path: issue.instancePath || "/",
		message: issue.message,
		keyword: issue.keyword,
	}));
}

function normalizedText(value: string, path: string): string {
	if (value !== value.trim() || !value.trim()) {
		throw new JudgmentParseError(
			`Expected directly normalized non-blank text at ${path}.`,
		);
	}
	return value.replace(/\s+/gu, " ");
}

function sortedIds(values: readonly string[]): readonly string[] {
	const normalized = values.map((value, index) =>
		normalizedText(value, `/basisMaterialIds/${index}`),
	);
	const seen = new Set<string>();
	for (const value of normalized) {
		if (seen.has(value)) {
			throw new JudgmentParseError(
				`Duplicate dynamic-question basis material: ${value}.`,
			);
		}
		seen.add(value);
	}
	return Object.freeze(
		normalized.toSorted((left, right) => left.localeCompare(right)),
	);
}

export function decodeDynamicJudgmentQuestionData(
	value: JsonValue,
): DynamicJudgmentQuestionData {
	try {
		return Parse(DynamicJudgmentQuestionDataSchema, value);
	} catch (error) {
		throw new JudgmentParseError(
			"Dynamic judgment question has an invalid representation.",
			{ issues: issues(value) },
			{ cause: error },
		);
	}
}

export function parseDynamicJudgmentQuestion(
	data: DynamicJudgmentQuestionData,
): DynamicJudgmentQuestion {
	const owner = parsePolicyOwner(decodePolicyOwnerData(data.owner));
	const question = normalizedText(data.question, "/question");
	const branchRef = normalizedText(data.branchRef, "/branchRef");
	const basisMaterialIds = sortedIds(data.basisMaterialIds);
	const identity: JsonValue = {
		judgmentId: data.judgmentId,
		owner: policyOwnerIdentity(owner),
		...(data.policySha256 ? { policySha256: data.policySha256 } : {}),
		question,
		basisMaterialIds,
		branchRef,
	};
	const dynamicQuestion: DynamicJudgmentQuestion = {
		[dynamicQuestionBrand]: true,
		judgmentId: data.judgmentId,
		owner,
		...(data.policySha256 ? { policySha256: data.policySha256 } : {}),
		question,
		basisMaterialIds,
		branchRef,
		questionSha256: sha256(canonicalJson(identity)),
	};
	return Object.freeze(dynamicQuestion);
}
