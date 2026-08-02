import { Type, type Static, type TProperties } from "typebox";

function exactObject<const T extends TProperties>(properties: T) {
	return Type.Object(properties, { additionalProperties: false });
}

export const NonEmptyTextSchema = Type.String({
	minLength: 1,
	maxLength: 4_000,
	pattern: "\\S",
});
export const IdentifierSchema = Type.String({
	minLength: 1,
	maxLength: 160,
	pattern: "^[A-Za-z][A-Za-z0-9._:/-]*$",
});
export const Sha256Schema = Type.String({ pattern: "^[a-f0-9]{64}$" });
export const ContextUseSchema = Type.Union([
	Type.Literal("constraint"),
	Type.Literal("evidence"),
	Type.Literal("decision"),
	Type.Literal("method"),
	Type.Literal("guidance"),
]);
export const AssuranceSchema = Type.Union([
	Type.Literal("agent-asserted"),
	Type.Literal("domain-verified"),
	Type.Literal("user-accepted"),
]);

const StatementsSchema = Type.Array(
	Type.String({ minLength: 1, maxLength: 2_000, pattern: "\\S" }),
	{ minItems: 1, maxItems: 64, uniqueItems: true },
);

export const PreparedReferencePolicyDataSchema = exactObject({
	path: Type.String({ minLength: 1, maxLength: 1_024, pattern: "\\S" }),
	when: StatementsSchema,
});

export const JudgmentAuthoringPolicyDataSchema = exactObject({
	$schema: Type.Optional(Type.String({ minLength: 1, maxLength: 2_000 })),
	specVersion: Type.Literal("0.1"),
	when: StatementsSchema,
	unless: StatementsSchema,
	references: Type.Array(PreparedReferencePolicyDataSchema, {
		minItems: 1,
		maxItems: 128,
	}),
});

export type ContextUse = Static<typeof ContextUseSchema>;
export type Assurance = Static<typeof AssuranceSchema>;
export type PreparedReferencePolicyData = Static<
	typeof PreparedReferencePolicyDataSchema
>;
export type JudgmentAuthoringPolicyData = Static<
	typeof JudgmentAuthoringPolicyDataSchema
>;
