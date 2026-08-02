import { posix } from "node:path";

import { Errors, Parse } from "typebox/value";

import { JudgmentParseError } from "./errors.ts";
import {
	canonicalJson,
	decodeJsonValue,
	sha256,
	type JsonValue,
} from "./json.ts";
import {
	JudgmentAuthoringPolicyDataSchema,
	type JudgmentAuthoringPolicyData,
	type PreparedReferencePolicyData,
} from "./schema.ts";

const authoringPolicyBrand: unique symbol = Symbol("JudgmentAuthoringPolicy");

export interface PreparedReferencePolicy {
	readonly path: string;
	readonly when: readonly string[];
}

export interface JudgmentAuthoringPolicy {
	readonly [authoringPolicyBrand]: true;
	readonly specVersion: "0.1";
	readonly when: readonly string[];
	readonly unless: readonly string[];
	readonly references: readonly PreparedReferencePolicy[];
	readonly authoringSha256: string;
}

function schemaIssues(value: JsonValue) {
	return [...Errors(JudgmentAuthoringPolicyDataSchema, value)].map((issue) => ({
		path: issue.instancePath || "/",
		message: issue.message,
		keyword: issue.keyword,
	}));
}

export function decodeJudgmentAuthoringPolicyData(
	value: JsonValue,
): JudgmentAuthoringPolicyData {
	try {
		return Parse(JudgmentAuthoringPolicyDataSchema, value);
	} catch (error) {
		throw new JudgmentParseError(
			"Judgment authoring policy does not match specVersion 0.1.",
			{ issues: schemaIssues(value) },
			{ cause: error },
		);
	}
}

function statementKey(value: string): string {
	return value.toLocaleLowerCase().replace(/\s+/gu, " ").trim();
}

function statements(
	values: readonly string[],
	path: string,
): readonly string[] {
	const normalized = values.map((value, index) => {
		if (value !== value.trim()) {
			throw new JudgmentParseError(
				`Statement contains surrounding whitespace at ${path}/${index}.`,
				{ path: `${path}/${index}` },
			);
		}
		const result = value.replace(/\s+/gu, " ");
		if (!result) {
			throw new JudgmentParseError(
				`Expected non-blank text at ${path}/${index}.`,
			);
		}
		return result;
	});
	const seen = new Set<string>();
	for (const value of normalized) {
		const key = statementKey(value);
		if (seen.has(key)) {
			throw new JudgmentParseError(
				`Semantic duplicate statement at ${path}: ${value}.`,
			);
		}
		seen.add(key);
	}
	return Object.freeze(
		normalized.toSorted((left, right) => left.localeCompare(right)),
	);
}

export function parsePreparedReferencePath(
	value: string,
	path: string,
): string {
	if (
		value !== value.trim() ||
		value.includes("\\") ||
		value.includes("\0") ||
		posix.isAbsolute(value)
	) {
		throw new JudgmentParseError(
			`Reference path must be a relative POSIX path at ${path}.`,
			{
				path,
				value,
			},
		);
	}
	const segments = value.split("/");
	if (
		segments.length === 0 ||
		segments.some(
			(segment) => segment.length === 0 || segment === "." || segment === "..",
		) ||
		posix.normalize(value) !== value
	) {
		throw new JudgmentParseError(
			`Reference path is not directly normalized at ${path}.`,
			{
				path,
				value,
			},
		);
	}
	return value;
}

function reference(
	data: PreparedReferencePolicyData,
	index: number,
): PreparedReferencePolicy {
	return Object.freeze({
		path: parsePreparedReferencePath(data.path, `/references/${index}/path`),
		when: statements(data.when, `/references/${index}/when`),
	});
}

function policyIdentity(input: {
	readonly when: readonly string[];
	readonly unless: readonly string[];
	readonly references: readonly PreparedReferencePolicy[];
}): JsonValue {
	return {
		specVersion: "0.1",
		when: input.when,
		unless: input.unless,
		references: input.references.map((item) => ({
			path: item.path,
			when: item.when,
		})),
	};
}

export function parseJudgmentAuthoringPolicy(
	data: JudgmentAuthoringPolicyData,
): JudgmentAuthoringPolicy {
	const when = statements(data.when, "/when");
	const unless = statements(data.unless, "/unless");
	const references = data.references
		.map(reference)
		.toSorted((left, right) => left.path.localeCompare(right.path));
	const paths = new Set<string>();
	for (const item of references) {
		if (paths.has(item.path)) {
			throw new JudgmentParseError(
				`Duplicate prepared reference path: ${item.path}.`,
				{
					path: item.path,
				},
			);
		}
		paths.add(item.path);
	}
	const frozenReferences = Object.freeze(references);
	const authoringSha256 = sha256(
		canonicalJson(
			policyIdentity({ when, unless, references: frozenReferences }),
		),
	);
	const policy: JudgmentAuthoringPolicy = {
		[authoringPolicyBrand]: true,
		specVersion: "0.1",
		when,
		unless,
		references: frozenReferences,
		authoringSha256,
	};
	return Object.freeze(policy);
}

export function parseJudgmentAuthoringPolicyJson(
	source: string,
): JudgmentAuthoringPolicy {
	try {
		return parseJudgmentAuthoringPolicy(
			decodeJudgmentAuthoringPolicyData(decodeJsonValue(source)),
		);
	} catch (error) {
		if (error instanceof JudgmentParseError) throw error;
		throw new JudgmentParseError(
			"Judgment authoring policy is not valid JSON.",
			{},
			{ cause: error },
		);
	}
}

export function canonicalJudgmentAuthoringPolicy(
	policy: JudgmentAuthoringPolicy,
): string {
	return canonicalJson(
		policyIdentity({
			when: policy.when,
			unless: policy.unless,
			references: policy.references,
		}),
	);
}
