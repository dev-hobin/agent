import {
	canonicalJson,
	jsonValueFromUnknown,
	sha256,
	type CompiledJudgmentPolicy,
	type ContextUse,
} from "@hobin/judgment";

export type DeveloperAssurance =
	| "agent-asserted"
	| "domain-verified"
	| "user-accepted";

export interface DeveloperSkillRef {
	readonly name: string;
	readonly location: string;
}

export interface OpenedContextSource {
	readonly inventorySourceId: string;
	readonly descriptorSha256: string;
	readonly toolCallId: string;
	readonly skill: DeveloperSkillRef;
	readonly methodContentSha256: string;
	readonly policy?: CompiledJudgmentPolicy;
}

export interface ContextBasisMember {
	readonly materialId: string;
	readonly memberId: string;
	readonly contentSha256: string;
}

export interface ContextSourceBasis {
	readonly inventorySourceId: string;
	readonly descriptorSha256: string;
	readonly policySha256?: string;
	readonly applicability?: "applicable" | "not-applicable" | "needs-context";
	readonly applicabilitySha256?: string;
}

export interface ContributionBasis {
	readonly contributionId: string;
	readonly materialId: string;
	readonly useAs: ContextUse;
	readonly assurance: DeveloperAssurance;
	readonly evaluator?: Readonly<{ id: string; version: string }>;
	readonly userEventId?: string;
}

export interface DeveloperContextBasis {
	readonly judgmentId: string;
	readonly policySha256?: string;
	readonly questionSha256: string;
	readonly selectionSha256: string;
	readonly sealedContextSha256: string;
	readonly coverageSha256: string;
	readonly outcomeSha256: string;
	readonly contextSources: readonly ContextSourceBasis[];
	readonly members: readonly ContextBasisMember[];
	readonly contributions: readonly ContributionBasis[];
	readonly conflictIds: readonly string[];
	readonly limitationIds: readonly string[];
	readonly contextBasisSha256: string;
}

export class DeveloperContextResultParseError extends Error {
	readonly code = "developer.context-result.invalid";

	constructor(message: string) {
		super(message);
		this.name = "DeveloperContextResultParseError";
	}
}

type ObjectValue = Record<string, unknown>;
type ValueParser<Value> = (input: {
	readonly value: unknown;
	readonly path: string;
}) => Value;

function fail(input: {
	readonly path: string;
	readonly message: string;
}): never {
	throw new DeveloperContextResultParseError(`${input.path}: ${input.message}`);
}

function objectAt(input: {
	readonly value: unknown;
	readonly path: string;
}): ObjectValue {
	if (
		typeof input.value !== "object" ||
		input.value === null ||
		Array.isArray(input.value)
	) {
		return fail({ path: input.path, message: "expected an object" });
	}
	return input.value as ObjectValue;
}

function exactKeys(input: {
	readonly value: ObjectValue;
	readonly path: string;
	readonly required: readonly string[];
	readonly optional?: readonly string[];
}): void {
	const allowed = new Set([...input.required, ...(input.optional ?? [])]);
	for (const key of input.required) {
		if (!Object.hasOwn(input.value, key)) {
			fail({ path: `${input.path}.${key}`, message: "is required" });
		}
	}
	for (const key of Object.keys(input.value)) {
		if (!allowed.has(key)) {
			fail({ path: `${input.path}.${key}`, message: "is not allowed" });
		}
	}
}

function textAt(input: {
	readonly value: unknown;
	readonly path: string;
	readonly max?: number;
	readonly pattern?: RegExp;
}): string {
	if (typeof input.value !== "string" || input.value.trim().length === 0) {
		return fail({ path: input.path, message: "expected non-blank text" });
	}
	const text = input.value.trim();
	if (text.length > (input.max ?? 8_000)) {
		fail({ path: input.path, message: "text is too long" });
	}
	if (input.pattern && !input.pattern.test(text)) {
		fail({ path: input.path, message: "text has an invalid representation" });
	}
	return text;
}

function idAt(input: {
	readonly value: unknown;
	readonly path: string;
}): string {
	return textAt({
		...input,
		max: 160,
		pattern: /^[A-Za-z][A-Za-z0-9._:/-]*$/u,
	});
}

function shaAt(input: {
	readonly value: unknown;
	readonly path: string;
}): string {
	return textAt({ ...input, max: 64, pattern: /^[a-f0-9]{64}$/u });
}

function arrayAt<Value>(input: {
	readonly value: unknown;
	readonly path: string;
	readonly parse: ValueParser<Value>;
	readonly max?: number;
}): readonly Value[] {
	if (!Array.isArray(input.value)) {
		return fail({ path: input.path, message: "expected an array" });
	}
	if (input.value.length > (input.max ?? 100)) {
		return fail({ path: input.path, message: "has too many items" });
	}
	const parsed: Value[] = [];
	for (let index = 0; index < input.value.length; index += 1) {
		parsed.push(
			input.parse({
				value: input.value[index],
				path: `${input.path}[${index}]`,
			}),
		);
	}
	return Object.freeze(parsed);
}

function uniqueIds(input: {
	readonly value: unknown;
	readonly path: string;
}): readonly string[] {
	const parsed = arrayAt({ ...input, parse: idAt });
	if (new Set(parsed).size !== parsed.length) {
		fail({ path: input.path, message: "contains duplicates" });
	}
	return parsed;
}

function oneOf<Value extends string>(input: {
	readonly value: unknown;
	readonly path: string;
	readonly allowed: readonly Value[];
}): Value {
	if (
		typeof input.value !== "string" ||
		!input.allowed.includes(input.value as Value)
	) {
		return fail({
			path: input.path,
			message: `expected one of ${input.allowed.join(", ")}`,
		});
	}
	return input.value as Value;
}

function parseContextMember(input: {
	readonly value: unknown;
	readonly path: string;
}): ContextBasisMember {
	const data = objectAt(input);
	exactKeys({
		value: data,
		path: input.path,
		required: ["materialId", "memberId", "contentSha256"],
	});
	return Object.freeze({
		materialId: idAt({
			value: data.materialId,
			path: `${input.path}.materialId`,
		}),
		memberId: idAt({ value: data.memberId, path: `${input.path}.memberId` }),
		contentSha256: shaAt({
			value: data.contentSha256,
			path: `${input.path}.contentSha256`,
		}),
	});
}

function parseContextSourceBasis(input: {
	readonly value: unknown;
	readonly path: string;
}): ContextSourceBasis {
	const data = objectAt(input);
	exactKeys({
		value: data,
		path: input.path,
		required: ["inventorySourceId", "descriptorSha256"],
		optional: ["policySha256", "applicability", "applicabilitySha256"],
	});
	const policySha256 =
		data.policySha256 === undefined
			? undefined
			: shaAt({
					value: data.policySha256,
					path: `${input.path}.policySha256`,
				});
	const applicability =
		data.applicability === undefined
			? undefined
			: oneOf({
					value: data.applicability,
					path: `${input.path}.applicability`,
					allowed: ["applicable", "not-applicable", "needs-context"] as const,
				});
	const applicabilitySha256 =
		data.applicabilitySha256 === undefined
			? undefined
			: shaAt({
					value: data.applicabilitySha256,
					path: `${input.path}.applicabilitySha256`,
				});
	if (
		Boolean(policySha256) !== Boolean(applicability) ||
		Boolean(policySha256) !== Boolean(applicabilitySha256)
	) {
		fail({
			path: input.path,
			message:
				"policySha256, applicability, and applicabilitySha256 must appear together",
		});
	}
	return Object.freeze({
		inventorySourceId: idAt({
			value: data.inventorySourceId,
			path: `${input.path}.inventorySourceId`,
		}),
		descriptorSha256: shaAt({
			value: data.descriptorSha256,
			path: `${input.path}.descriptorSha256`,
		}),
		...(policySha256 ? { policySha256 } : {}),
		...(applicability ? { applicability } : {}),
		...(applicabilitySha256 ? { applicabilitySha256 } : {}),
	});
}

function parseContributionBasis(input: {
	readonly value: unknown;
	readonly path: string;
}): ContributionBasis {
	const data = objectAt(input);
	exactKeys({
		value: data,
		path: input.path,
		required: ["contributionId", "materialId", "useAs", "assurance"],
		optional: ["evaluator", "userEventId"],
	});
	const assurance = oneOf({
		value: data.assurance,
		path: `${input.path}.assurance`,
		allowed: ["agent-asserted", "domain-verified", "user-accepted"] as const,
	});
	let evaluator: Readonly<{ id: string; version: string }> | undefined;
	let userEventId: string | undefined;
	if (assurance === "domain-verified") {
		const raw = objectAt({
			value: data.evaluator,
			path: `${input.path}.evaluator`,
		});
		exactKeys({
			value: raw,
			path: `${input.path}.evaluator`,
			required: ["id", "version"],
		});
		evaluator = Object.freeze({
			id: idAt({ value: raw.id, path: `${input.path}.evaluator.id` }),
			version: idAt({
				value: raw.version,
				path: `${input.path}.evaluator.version`,
			}),
		});
		if (data.userEventId !== undefined) {
			fail({
				path: `${input.path}.userEventId`,
				message: "is not domain authority",
			});
		}
	} else if (assurance === "user-accepted") {
		userEventId = idAt({
			value: data.userEventId,
			path: `${input.path}.userEventId`,
		});
		if (data.evaluator !== undefined) {
			fail({
				path: `${input.path}.evaluator`,
				message: "is not user authority",
			});
		}
	} else if (data.evaluator !== undefined || data.userEventId !== undefined) {
		fail({
			path: input.path,
			message: "agent assurance cannot carry evaluator or user authority",
		});
	}
	return Object.freeze({
		contributionId: idAt({
			value: data.contributionId,
			path: `${input.path}.contributionId`,
		}),
		materialId: idAt({
			value: data.materialId,
			path: `${input.path}.materialId`,
		}),
		useAs: oneOf({
			value: data.useAs,
			path: `${input.path}.useAs`,
			allowed: [
				"method",
				"guidance",
				"constraint",
				"evidence",
				"decision",
			] as const,
		}) as ContextUse,
		assurance,
		...(evaluator ? { evaluator } : {}),
		...(userEventId ? { userEventId } : {}),
	});
}

export function developerContextBasisSha256(
	value: Omit<DeveloperContextBasis, "contextBasisSha256">,
): string {
	return sha256(canonicalJson(jsonValueFromUnknown(value)));
}

export function parseDeveloperContextBasis(
	value: unknown,
): DeveloperContextBasis {
	const path = "contextBasis";
	const data = objectAt({ value, path });
	exactKeys({
		value: data,
		path,
		required: [
			"judgmentId",
			"questionSha256",
			"selectionSha256",
			"sealedContextSha256",
			"coverageSha256",
			"outcomeSha256",
			"contextSources",
			"members",
			"contributions",
			"conflictIds",
			"limitationIds",
			"contextBasisSha256",
		],
		optional: ["policySha256"],
	});
	const contextSources = arrayAt({
		value: data.contextSources,
		path: `${path}.contextSources`,
		parse: parseContextSourceBasis,
	});
	const contextSourceIds = contextSources.map(
		(source) => source.inventorySourceId,
	);
	if (new Set(contextSourceIds).size !== contextSourceIds.length) {
		fail({
			path: `${path}.contextSources`,
			message: "duplicate inventorySourceId",
		});
	}
	const members = arrayAt({
		value: data.members,
		path: `${path}.members`,
		parse: parseContextMember,
	});
	const materialIds = members.map((member) => member.materialId);
	if (new Set(materialIds).size !== materialIds.length) {
		fail({ path: `${path}.members`, message: "duplicate materialId" });
	}
	const contributions = arrayAt({
		value: data.contributions,
		path: `${path}.contributions`,
		parse: parseContributionBasis,
	});
	const contributionIds = contributions.map(
		(contribution) => contribution.contributionId,
	);
	if (new Set(contributionIds).size !== contributionIds.length) {
		fail({
			path: `${path}.contributions`,
			message: "duplicate contributionId",
		});
	}
	for (const contribution of contributions) {
		if (!materialIds.includes(contribution.materialId)) {
			fail({
				path: `${path}.contributions`,
				message: `unknown materialId ${contribution.materialId}`,
			});
		}
	}
	const parsed = {
		judgmentId: idAt({ value: data.judgmentId, path: `${path}.judgmentId` }),
		...(data.policySha256 === undefined
			? {}
			: {
					policySha256: shaAt({
						value: data.policySha256,
						path: `${path}.policySha256`,
					}),
				}),
		questionSha256: shaAt({
			value: data.questionSha256,
			path: `${path}.questionSha256`,
		}),
		selectionSha256: shaAt({
			value: data.selectionSha256,
			path: `${path}.selectionSha256`,
		}),
		sealedContextSha256: shaAt({
			value: data.sealedContextSha256,
			path: `${path}.sealedContextSha256`,
		}),
		coverageSha256: shaAt({
			value: data.coverageSha256,
			path: `${path}.coverageSha256`,
		}),
		outcomeSha256: shaAt({
			value: data.outcomeSha256,
			path: `${path}.outcomeSha256`,
		}),
		contextSources,
		members,
		contributions,
		conflictIds: uniqueIds({
			value: data.conflictIds,
			path: `${path}.conflictIds`,
		}),
		limitationIds: uniqueIds({
			value: data.limitationIds,
			path: `${path}.limitationIds`,
		}),
	};
	const contextBasisSha256 = shaAt({
		value: data.contextBasisSha256,
		path: `${path}.contextBasisSha256`,
	});
	if (developerContextBasisSha256(parsed) !== contextBasisSha256) {
		fail({
			path: `${path}.contextBasisSha256`,
			message: "does not match the context basis",
		});
	}
	return Object.freeze({ ...parsed, contextBasisSha256 });
}
