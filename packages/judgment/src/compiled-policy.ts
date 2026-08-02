import { Type, type Static, type TProperties } from "typebox";
import { Errors, Parse } from "typebox/value";

import {
	parseJudgmentAuthoringPolicy,
	type JudgmentAuthoringPolicy,
} from "./authoring.ts";
import { JudgmentParseError } from "./errors.ts";
import { canonicalJson, sha256, type JsonValue } from "./json.ts";

function exactObject<const T extends TProperties>(properties: T) {
	return Type.Object(properties, { additionalProperties: false });
}

export const PolicyOwnerDataSchema = exactObject({
	kind: Type.Union([
		Type.Literal("pi-skill"),
		Type.Literal("adapter-capability"),
	]),
	namespace: Type.String({ minLength: 1, maxLength: 300, pattern: "\\S" }),
	name: Type.String({
		minLength: 1,
		maxLength: 160,
		pattern: "^[A-Za-z][A-Za-z0-9._:/-]*$",
	}),
	provenance: exactObject({
		source: Type.String({ minLength: 1, maxLength: 1_000, pattern: "\\S" }),
		scope: Type.Union([
			Type.Literal("user"),
			Type.Literal("project"),
			Type.Literal("temporary"),
		]),
		origin: Type.Union([
			Type.Literal("package"),
			Type.Literal("top-level"),
			Type.Literal("session"),
		]),
		path: Type.Optional(
			Type.String({ minLength: 1, maxLength: 2_000, pattern: "\\S" }),
		),
	}),
});

export type PolicyOwnerData = Static<typeof PolicyOwnerDataSchema>;

const StatementsDataSchema = Type.Array(
	Type.String({ minLength: 1, maxLength: 2_000, pattern: "\\S" }),
	{ minItems: 1, maxItems: 64, uniqueItems: true },
);
export const CompiledJudgmentPolicyDataSchema = exactObject({
	specVersion: Type.Literal("0.1"),
	owner: PolicyOwnerDataSchema,
	when: StatementsDataSchema,
	unless: StatementsDataSchema,
	references: Type.Array(
		exactObject({
			path: Type.String({ minLength: 1, maxLength: 1_024, pattern: "\\S" }),
			when: StatementsDataSchema,
		}),
		{ minItems: 1, maxItems: 128 },
	),
	authoringSha256: Type.String({ pattern: "^[a-f0-9]{64}$" }),
	policySha256: Type.String({ pattern: "^[a-f0-9]{64}$" }),
});
export type CompiledJudgmentPolicyData = Static<
	typeof CompiledJudgmentPolicyDataSchema
>;

const policyOwnerBrand: unique symbol = Symbol("PolicyOwner");
const compiledPolicyBrand: unique symbol = Symbol("CompiledJudgmentPolicy");

export interface PolicyOwner {
	readonly [policyOwnerBrand]: true;
	readonly kind: "pi-skill" | "adapter-capability";
	readonly namespace: string;
	readonly name: string;
	readonly provenance: Readonly<{
		source: string;
		scope: "user" | "project" | "temporary";
		origin: "package" | "top-level" | "session";
		path?: string;
	}>;
}

export interface CompiledPreparedReference {
	readonly path: string;
	readonly when: readonly string[];
	readonly referenceId: string;
}

export interface CompiledJudgmentPolicy {
	readonly [compiledPolicyBrand]: true;
	readonly specVersion: "0.1";
	readonly owner: PolicyOwner;
	readonly when: readonly string[];
	readonly unless: readonly string[];
	readonly references: readonly CompiledPreparedReference[];
	readonly authoringSha256: string;
	readonly policySha256: string;
}

function issues(value: JsonValue) {
	return [...Errors(PolicyOwnerDataSchema, value)].map((issue) => ({
		path: issue.instancePath || "/",
		message: issue.message,
		keyword: issue.keyword,
	}));
}

function nonBlank(value: string, path: string): string {
	if (value !== value.trim() || !value.trim()) {
		throw new JudgmentParseError(
			`Expected directly normalized non-blank text at ${path}.`,
		);
	}
	return value;
}

export function decodePolicyOwnerData(value: JsonValue): PolicyOwnerData {
	try {
		return Parse(PolicyOwnerDataSchema, value);
	} catch (error) {
		throw new JudgmentParseError(
			"Policy owner has an invalid representation.",
			{ issues: issues(value) },
			{ cause: error },
		);
	}
}

export function parsePolicyOwner(data: PolicyOwnerData): PolicyOwner {
	const owner: PolicyOwner = {
		[policyOwnerBrand]: true,
		kind: data.kind,
		namespace: nonBlank(data.namespace, "/namespace"),
		name: data.name,
		provenance: Object.freeze({
			source: nonBlank(data.provenance.source, "/provenance/source"),
			scope: data.provenance.scope,
			origin: data.provenance.origin,
			...(data.provenance.path
				? { path: nonBlank(data.provenance.path, "/provenance/path") }
				: {}),
		}),
	};
	return Object.freeze(owner);
}

export function policyOwnerIdentity(owner: PolicyOwner): JsonValue {
	return {
		kind: owner.kind,
		namespace: owner.namespace,
		name: owner.name,
		provenance: {
			source: owner.provenance.source,
			scope: owner.provenance.scope,
			origin: owner.provenance.origin,
			...(owner.provenance.path ? { path: owner.provenance.path } : {}),
		},
	};
}

function compiledIdentity(input: {
	readonly owner: PolicyOwner;
	readonly policy: JudgmentAuthoringPolicy;
}): JsonValue {
	return {
		specVersion: "0.1",
		owner: policyOwnerIdentity(input.owner),
		when: input.policy.when,
		unless: input.policy.unless,
		references: input.policy.references.map((reference) => ({
			path: reference.path,
			when: reference.when,
		})),
		authoringSha256: input.policy.authoringSha256,
	};
}

export function compileJudgmentPolicy(input: {
	readonly owner: PolicyOwner;
	readonly policy: JudgmentAuthoringPolicy;
}): CompiledJudgmentPolicy {
	const policySha256 = sha256(canonicalJson(compiledIdentity(input)));
	const references = Object.freeze(
		input.policy.references.map((reference) =>
			Object.freeze({
				path: reference.path,
				when: reference.when,
				referenceId: reference.path,
			}),
		),
	);
	const policy: CompiledJudgmentPolicy = {
		[compiledPolicyBrand]: true,
		specVersion: "0.1",
		owner: input.owner,
		when: input.policy.when,
		unless: input.policy.unless,
		references,
		authoringSha256: input.policy.authoringSha256,
		policySha256,
	};
	return Object.freeze(policy);
}

export function compiledJudgmentPolicyData(
	policy: CompiledJudgmentPolicy,
): CompiledJudgmentPolicyData {
	return Object.freeze({
		specVersion: "0.1",
		owner: {
			kind: policy.owner.kind,
			namespace: policy.owner.namespace,
			name: policy.owner.name,
			provenance: {
				source: policy.owner.provenance.source,
				scope: policy.owner.provenance.scope,
				origin: policy.owner.provenance.origin,
				...(policy.owner.provenance.path
					? { path: policy.owner.provenance.path }
					: {}),
			},
		},
		when: [...policy.when],
		unless: [...policy.unless],
		references: policy.references.map((reference) => ({
			path: reference.path,
			when: [...reference.when],
		})),
		authoringSha256: policy.authoringSha256,
		policySha256: policy.policySha256,
	});
}

export function decodeCompiledJudgmentPolicyData(
	value: JsonValue,
): CompiledJudgmentPolicyData {
	try {
		return Parse(CompiledJudgmentPolicyDataSchema, value);
	} catch (error) {
		throw new JudgmentParseError(
			"Compiled Judgment policy has an invalid representation.",
			{
				issues: [...Errors(CompiledJudgmentPolicyDataSchema, value)].map(
					(issue) => ({
						path: issue.instancePath || "/",
						message: issue.message,
						keyword: issue.keyword,
					}),
				),
			},
			{ cause: error },
		);
	}
}

export function parseCompiledJudgmentPolicy(
	data: CompiledJudgmentPolicyData,
): CompiledJudgmentPolicy {
	const owner = parsePolicyOwner(data.owner);
	const authoring = parseJudgmentAuthoringPolicy({
		specVersion: "0.1",
		when: data.when,
		unless: data.unless,
		references: data.references,
	});
	if (authoring.authoringSha256 !== data.authoringSha256)
		throw new JudgmentParseError(
			"Compiled policy authoring identity does not match its content.",
		);
	const compiled = compileJudgmentPolicy({ owner, policy: authoring });
	if (compiled.policySha256 !== data.policySha256)
		throw new JudgmentParseError(
			"Compiled policy identity does not match its content.",
		);
	return compiled;
}

export function canonicalCompiledJudgmentPolicy(
	policy: CompiledJudgmentPolicy,
): string {
	return canonicalJson({
		specVersion: policy.specVersion,
		owner: policyOwnerIdentity(policy.owner),
		when: policy.when,
		unless: policy.unless,
		references: policy.references.map((reference) => ({
			path: reference.path,
			when: reference.when,
		})),
		authoringSha256: policy.authoringSha256,
	});
}
