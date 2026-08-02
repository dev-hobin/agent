import {
	canonicalJson,
	compiledJudgmentPolicyData,
	decodeCompiledJudgmentPolicyData,
	jsonValueFromUnknown,
	parseCompiledJudgmentPolicy,
	sha256,
	type CompiledJudgmentPolicy,
	type ContextUse,
} from "@hobin/judgment";

export const DEVELOPER_PROTOCOL = "developer/v7" as const;
export const DEVELOPER_EVENT_ENTRY = "developer.event" as const;
export const DEVELOPER_ACTIVATION_ENTRY = "developer.activation" as const;
export const DEVELOPER_FOCUS_ENTRY = "developer.question-focus" as const;

export const OPEN_JUDGMENT_TOOL = "developer_open_judgment" as const;
export const OPEN_CONTEXT_SOURCES_TOOL =
	"developer_open_context_sources" as const;
export const CONCLUDE_JUDGMENT_TOOL = "developer_conclude_judgment" as const;
export const AUTHORIZE_CHANGE_TOOL = "developer_authorize_change" as const;
export const RECORD_LANDING_TOOL = "developer_record_landing" as const;

export const DEVELOPER_PROTOCOL_TOOLS = Object.freeze([
	OPEN_JUDGMENT_TOOL,
	OPEN_CONTEXT_SOURCES_TOOL,
	CONCLUDE_JUDGMENT_TOOL,
	AUTHORIZE_CHANGE_TOOL,
	RECORD_LANDING_TOOL,
] as const);

const eventBrand: unique symbol = Symbol("DeveloperEvent");
const activeJudgmentBrand: unique symbol = Symbol("ActiveJudgment");
const authorizedChangeBrand: unique symbol = Symbol("AuthorizedChange");
const conclusionBrand: unique symbol = Symbol("JudgmentConclusion");
const landingBrand: unique symbol = Symbol("ImplementationLanding");

export type QuestionResolutionOwner =
	| "agent"
	| "user"
	| "environment"
	| "unknown";
export type QuestionGate =
	| "none"
	| "before-implementation"
	| "before-completion";
export type PendingQuestionStatus = "open" | "blocked";
export type QuestionUpdateStatus =
	| "resolved"
	| "not-applicable"
	| "open"
	| "blocked";
export type DeveloperAssurance =
	| "agent-asserted"
	| "domain-verified"
	| "user-accepted";

export interface ChoiceResponseOption {
	readonly value: string;
	readonly label: string;
	readonly description?: string;
	readonly detailPrompt?: string;
}

export interface ChoiceResponseField {
	readonly id: string;
	readonly prompt: string;
	readonly description?: string;
	readonly options: readonly ChoiceResponseOption[];
}

export interface ChoiceResponseSpec {
	readonly kind: "choice-form";
	readonly fields: readonly ChoiceResponseField[];
}

export interface DeveloperSkillRef {
	readonly name: string;
	readonly location: string;
}

export interface MethodAlternative {
	readonly skillName: string;
	readonly reason: string;
}

export interface OpenedContextSource {
	readonly inventorySourceId: string;
	readonly descriptorSha256: string;
	readonly toolCallId: string;
	readonly skill: DeveloperSkillRef;
	readonly methodContentSha256: string;
	readonly policy?: CompiledJudgmentPolicy;
}

export interface PendingQuestion {
	readonly id: string;
	readonly question: string;
	readonly context?: string;
	readonly responseSpec?: ChoiceResponseSpec;
	readonly status: PendingQuestionStatus;
	readonly resolutionOwner: QuestionResolutionOwner;
	readonly gate: QuestionGate;
	readonly resolutionCriteria: string;
	readonly sourceWorkId: string;
}

export interface QuestionUpdate {
	readonly questionId: string;
	readonly status: QuestionUpdateStatus;
	readonly result: string;
	readonly basis: readonly string[];
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

export interface ActiveJudgment {
	readonly [activeJudgmentBrand]: true;
	readonly kind: "active-judgment";
	readonly judgmentId: string;
	readonly question: string;
	readonly skill: DeveloperSkillRef;
	readonly reason: string;
	readonly knownEvidence: readonly string[];
	readonly consideredMethods: readonly MethodAlternative[];
	readonly contextSources: readonly OpenedContextSource[];
	readonly targetQuestionId?: string;
	readonly policy?: CompiledJudgmentPolicy;
}

export interface RefinementBoundary {
	readonly kind: "refinement-boundary";
	readonly rawRepresentation: string;
	readonly refinedRepresentation: string;
	readonly producer: string;
	readonly failure: string;
	readonly firstEffect: string;
}

export interface TrustedCompilerGap {
	readonly kind: "trusted-compiler-gap";
	readonly assertion: string;
	readonly establishedBy: string;
	readonly limitation: string;
	readonly containment: string;
	readonly verification: string;
}

export interface ImplementationContract {
	readonly movement: string;
	readonly stableLanding: string;
	readonly verificationTarget: string;
	readonly refinement?: RefinementBoundary | TrustedCompilerGap;
}

export interface AuthorizedChange {
	readonly [authorizedChangeBrand]: true;
	readonly kind: "authorized-change";
	readonly authorizationId: string;
	readonly question: string;
	readonly reason: string;
	readonly contract: ImplementationContract;
	readonly targetQuestionId?: string;
}

interface JudgmentConclusionBase {
	readonly [conclusionBrand]: true;
	readonly judgmentId: string;
	readonly producedArtifacts: readonly string[];
	readonly openedQuestions: readonly PendingQuestion[];
	readonly questionUpdates: readonly QuestionUpdate[];
}

export type JudgmentConclusion =
	| (JudgmentConclusionBase & {
			readonly kind: "contextual-judgment";
			readonly contextBasis: DeveloperContextBasis;
			readonly rationale: string;
			readonly artifact: string;
			readonly stopEvidence: readonly string[];
	  })
	| (JudgmentConclusionBase & {
			readonly kind: "needs-evidence";
			readonly contextBasis: DeveloperContextBasis;
			readonly evidenceNeeded: readonly string[];
			readonly resolutionOwner: QuestionResolutionOwner;
			readonly artifact?: string;
	  })
	| (JudgmentConclusionBase & {
			readonly kind: "emergent-question";
			readonly contextBasis: DeveloperContextBasis;
			readonly question: string;
			readonly reason: string;
			readonly artifact: string;
			readonly stopEvidence: readonly string[];
	  })
	| (JudgmentConclusionBase & {
			readonly kind: "judgment-not-applicable";
			readonly reason: string;
			readonly basis: readonly string[];
	  });

export interface ImplementationLanding {
	readonly [landingBrand]: true;
	readonly authorizationId: string;
	readonly changedPaths: readonly string[];
	readonly result: string;
	readonly verification: readonly string[];
}

export interface ActivationChanged {
	readonly [eventBrand]: true;
	readonly protocol: typeof DEVELOPER_PROTOCOL;
	readonly kind: "activation-changed";
	readonly enabled: boolean;
}

export interface QuestionFocused {
	readonly [eventBrand]: true;
	readonly protocol: typeof DEVELOPER_PROTOCOL;
	readonly kind: "question-focused";
	readonly questionId: string;
}

export interface JudgmentOpened {
	readonly [eventBrand]: true;
	readonly protocol: typeof DEVELOPER_PROTOCOL;
	readonly kind: "judgment-opened";
	readonly judgment: ActiveJudgment;
}

export interface ContextSourcesOpened {
	readonly [eventBrand]: true;
	readonly protocol: typeof DEVELOPER_PROTOCOL;
	readonly kind: "context-sources-opened";
	readonly judgmentId: string;
	readonly sources: readonly OpenedContextSource[];
}

export interface ChangeAuthorized {
	readonly [eventBrand]: true;
	readonly protocol: typeof DEVELOPER_PROTOCOL;
	readonly kind: "change-authorized";
	readonly change: AuthorizedChange;
}

export interface JudgmentConcluded {
	readonly [eventBrand]: true;
	readonly protocol: typeof DEVELOPER_PROTOCOL;
	readonly kind: "judgment-concluded";
	readonly conclusion: JudgmentConclusion;
}

export interface LandingRecorded {
	readonly [eventBrand]: true;
	readonly protocol: typeof DEVELOPER_PROTOCOL;
	readonly kind: "landing-recorded";
	readonly landing: ImplementationLanding;
}

export type DeveloperEvent =
	| ActivationChanged
	| QuestionFocused
	| JudgmentOpened
	| ContextSourcesOpened
	| ChangeAuthorized
	| JudgmentConcluded
	| LandingRecorded;

export class DeveloperProtocolParseError extends Error {
	readonly code = "developer.protocol.invalid";

	constructor(message: string) {
		super(message);
		this.name = "DeveloperProtocolParseError";
	}
}

type ObjectValue = Record<string, unknown>;

function fail(path: string, message: string): never {
	throw new DeveloperProtocolParseError(`${path}: ${message}`);
}

function objectAt(value: unknown, path: string): ObjectValue {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		return fail(path, "expected an object");
	}
	return value as ObjectValue;
}

function exactKeys(
	value: ObjectValue,
	path: string,
	required: readonly string[],
	optional: readonly string[] = [],
): void {
	const allowed = new Set([...required, ...optional]);
	for (const key of required) {
		if (!Object.hasOwn(value, key)) fail(`${path}.${key}`, "is required");
	}
	for (const key of Object.keys(value)) {
		if (!allowed.has(key)) fail(`${path}.${key}`, "is not allowed");
	}
}

function textAt(
	value: unknown,
	path: string,
	options: { max?: number; pattern?: RegExp } = {},
): string {
	if (typeof value !== "string" || value.trim().length === 0) {
		return fail(path, "expected non-blank text");
	}
	const text = value.trim();
	if (text.length > (options.max ?? 8_000)) fail(path, "text is too long");
	if (options.pattern && !options.pattern.test(text)) {
		fail(path, "text has an invalid representation");
	}
	return text;
}

function idAt(value: unknown, path: string): string {
	return textAt(value, path, {
		max: 160,
		pattern: /^[A-Za-z][A-Za-z0-9._:/-]*$/u,
	});
}

function shaAt(value: unknown, path: string): string {
	return textAt(value, path, { max: 64, pattern: /^[a-f0-9]{64}$/u });
}

function boolAt(value: unknown, path: string): boolean {
	if (typeof value !== "boolean") return fail(path, "expected a boolean");
	return value;
}

function arrayAt<T>(
	value: unknown,
	path: string,
	parse: (item: unknown, itemPath: string) => T,
	options: { nonEmpty?: boolean; max?: number } = {},
): readonly T[] {
	if (!Array.isArray(value)) return fail(path, "expected an array");
	if (options.nonEmpty && value.length === 0)
		return fail(path, "must not be empty");
	if (value.length > (options.max ?? 100))
		return fail(path, "has too many items");
	return Object.freeze(
		value.map((item, index) => parse(item, `${path}[${index}]`)),
	);
}

function uniqueTextArray(
	value: unknown,
	path: string,
	options: { nonEmpty?: boolean; max?: number } = {},
): readonly string[] {
	const parsed = arrayAt(value, path, textAt, options);
	if (new Set(parsed).size !== parsed.length) fail(path, "contains duplicates");
	return parsed;
}

function uniqueIds(
	value: unknown,
	path: string,
	options: { nonEmpty?: boolean; max?: number } = {},
): readonly string[] {
	const parsed = arrayAt(value, path, idAt, options);
	if (new Set(parsed).size !== parsed.length) fail(path, "contains duplicates");
	return parsed;
}

function oneOf<T extends string>(
	value: unknown,
	path: string,
	allowed: readonly T[],
): T {
	if (typeof value !== "string" || !allowed.includes(value as T)) {
		return fail(path, `expected one of ${allowed.join(", ")}`);
	}
	return value as T;
}

function parseSkill(value: unknown, path: string): DeveloperSkillRef {
	const data = objectAt(value, path);
	exactKeys(data, path, ["name", "location"]);
	return Object.freeze({
		name: idAt(data.name, `${path}.name`),
		location: textAt(data.location, `${path}.location`, { max: 4_096 }),
	});
}

function parseAlternative(value: unknown, path: string): MethodAlternative {
	const data = objectAt(value, path);
	exactKeys(data, path, ["skillName", "reason"]);
	return Object.freeze({
		skillName: idAt(data.skillName, `${path}.skillName`),
		reason: textAt(data.reason, `${path}.reason`),
	});
}

function parseOpenedContextSource(
	value: unknown,
	path: string,
): OpenedContextSource {
	const data = objectAt(value, path);
	exactKeys(
		data,
		path,
		[
			"inventorySourceId",
			"descriptorSha256",
			"toolCallId",
			"skill",
			"methodContentSha256",
		],
		["policy"],
	);
	const skill = parseSkill(data.skill, `${path}.skill`);
	const policy =
		data.policy === undefined
			? undefined
			: parseCompiledPolicyValue(data.policy, `${path}.policy`);
	if (
		policy &&
		(policy.owner.name !== skill.name ||
			policy.owner.provenance.path !== skill.location)
	) {
		fail(`${path}.policy.owner`, "must identify the opened context Skill");
	}
	return Object.freeze({
		inventorySourceId: idAt(
			data.inventorySourceId,
			`${path}.inventorySourceId`,
		),
		descriptorSha256: shaAt(data.descriptorSha256, `${path}.descriptorSha256`),
		toolCallId: textAt(data.toolCallId, `${path}.toolCallId`, { max: 300 }),
		skill,
		methodContentSha256: shaAt(
			data.methodContentSha256,
			`${path}.methodContentSha256`,
		),
		...(policy ? { policy } : {}),
	});
}

function parseCompiledPolicyValue(
	value: unknown,
	path: string,
): CompiledJudgmentPolicy {
	try {
		return parseCompiledJudgmentPolicy(
			decodeCompiledJudgmentPolicyData(jsonValueFromUnknown(value)),
		);
	} catch (error) {
		return fail(
			path,
			error instanceof Error
				? error.message
				: "invalid compiled Judgment policy",
		);
	}
}

export function parseActiveJudgment(
	value: unknown,
	path = "activeJudgment",
): ActiveJudgment {
	const data = objectAt(value, path);
	exactKeys(
		data,
		path,
		[
			"kind",
			"judgmentId",
			"question",
			"skill",
			"reason",
			"knownEvidence",
			"consideredMethods",
			"contextSources",
		],
		["targetQuestionId", "policy"],
	);
	if (data.kind !== "active-judgment")
		fail(`${path}.kind`, "expected active-judgment");
	const skill = parseSkill(data.skill, `${path}.skill`);
	const policy =
		data.policy === undefined
			? undefined
			: parseCompiledPolicyValue(data.policy, `${path}.policy`);
	if (policy && policy.owner.name !== skill.name) {
		fail(`${path}.policy.owner.name`, "must match skill.name");
	}
	return Object.freeze({
		[activeJudgmentBrand]: true as const,
		kind: "active-judgment",
		judgmentId: idAt(data.judgmentId, `${path}.judgmentId`),
		question: textAt(data.question, `${path}.question`),
		skill,
		reason: textAt(data.reason, `${path}.reason`),
		knownEvidence: uniqueTextArray(data.knownEvidence, `${path}.knownEvidence`),
		consideredMethods: arrayAt(
			data.consideredMethods,
			`${path}.consideredMethods`,
			parseAlternative,
		),
		contextSources: arrayAt(
			data.contextSources,
			`${path}.contextSources`,
			parseOpenedContextSource,
		),
		...(data.targetQuestionId === undefined
			? {}
			: {
					targetQuestionId: idAt(
						data.targetQuestionId,
						`${path}.targetQuestionId`,
					),
				}),
		...(policy ? { policy } : {}),
	});
}

function parseRefinement(
	value: unknown,
	path: string,
): RefinementBoundary | TrustedCompilerGap {
	const data = objectAt(value, path);
	const kind = oneOf(data.kind, `${path}.kind`, [
		"refinement-boundary",
		"trusted-compiler-gap",
	] as const);
	if (kind === "refinement-boundary") {
		exactKeys(data, path, [
			"kind",
			"rawRepresentation",
			"refinedRepresentation",
			"producer",
			"failure",
			"firstEffect",
		]);
		return Object.freeze({
			kind,
			rawRepresentation: textAt(
				data.rawRepresentation,
				`${path}.rawRepresentation`,
			),
			refinedRepresentation: textAt(
				data.refinedRepresentation,
				`${path}.refinedRepresentation`,
			),
			producer: textAt(data.producer, `${path}.producer`),
			failure: textAt(data.failure, `${path}.failure`),
			firstEffect: textAt(data.firstEffect, `${path}.firstEffect`),
		});
	}
	exactKeys(data, path, [
		"kind",
		"assertion",
		"establishedBy",
		"limitation",
		"containment",
		"verification",
	]);
	return Object.freeze({
		kind,
		assertion: textAt(data.assertion, `${path}.assertion`),
		establishedBy: textAt(data.establishedBy, `${path}.establishedBy`),
		limitation: textAt(data.limitation, `${path}.limitation`),
		containment: textAt(data.containment, `${path}.containment`),
		verification: textAt(data.verification, `${path}.verification`),
	});
}

function parseImplementationContract(
	value: unknown,
	path: string,
): ImplementationContract {
	const data = objectAt(value, path);
	exactKeys(
		data,
		path,
		["movement", "stableLanding", "verificationTarget"],
		["refinement"],
	);
	return Object.freeze({
		movement: textAt(data.movement, `${path}.movement`),
		stableLanding: textAt(data.stableLanding, `${path}.stableLanding`),
		verificationTarget: textAt(
			data.verificationTarget,
			`${path}.verificationTarget`,
		),
		...(data.refinement === undefined
			? {}
			: { refinement: parseRefinement(data.refinement, `${path}.refinement`) }),
	});
}

export function parseAuthorizedChange(
	value: unknown,
	path = "authorizedChange",
): AuthorizedChange {
	const data = objectAt(value, path);
	exactKeys(
		data,
		path,
		["kind", "authorizationId", "question", "reason", "contract"],
		["targetQuestionId"],
	);
	if (data.kind !== "authorized-change")
		fail(`${path}.kind`, "expected authorized-change");
	return Object.freeze({
		[authorizedChangeBrand]: true as const,
		kind: "authorized-change",
		authorizationId: idAt(data.authorizationId, `${path}.authorizationId`),
		question: textAt(data.question, `${path}.question`),
		reason: textAt(data.reason, `${path}.reason`),
		contract: parseImplementationContract(data.contract, `${path}.contract`),
		...(data.targetQuestionId === undefined
			? {}
			: {
					targetQuestionId: idAt(
						data.targetQuestionId,
						`${path}.targetQuestionId`,
					),
				}),
	});
}

function parseChoiceOption(value: unknown, path: string): ChoiceResponseOption {
	const data = objectAt(value, path);
	exactKeys(data, path, ["value", "label"], ["description", "detailPrompt"]);
	return Object.freeze({
		value: idAt(data.value, `${path}.value`),
		label: textAt(data.label, `${path}.label`, { max: 2_000 }),
		...(data.description === undefined
			? {}
			: {
					description: textAt(data.description, `${path}.description`, {
						max: 2_000,
					}),
				}),
		...(data.detailPrompt === undefined
			? {}
			: {
					detailPrompt: textAt(data.detailPrompt, `${path}.detailPrompt`, {
						max: 2_000,
					}),
				}),
	});
}

export function parseChoiceResponseSpec(
	value: unknown,
	path = "responseSpec",
): ChoiceResponseSpec {
	const data = objectAt(value, path);
	exactKeys(data, path, ["kind", "fields"]);
	if (data.kind !== "choice-form") fail(`${path}.kind`, "expected choice-form");
	const fields = arrayAt(
		data.fields,
		`${path}.fields`,
		(rawField, fieldPath) => {
			const field = objectAt(rawField, fieldPath);
			exactKeys(field, fieldPath, ["id", "prompt", "options"], ["description"]);
			const options = arrayAt(
				field.options,
				`${fieldPath}.options`,
				parseChoiceOption,
				{ nonEmpty: true, max: 20 },
			);
			if (options.length < 2)
				fail(`${fieldPath}.options`, "requires at least two options");
			const values = options.map((option) => option.value);
			if (new Set(values).size !== values.length)
				fail(`${fieldPath}.options`, "contains duplicate values");
			return Object.freeze({
				id: idAt(field.id, `${fieldPath}.id`),
				prompt: textAt(field.prompt, `${fieldPath}.prompt`, { max: 2_000 }),
				...(field.description === undefined
					? {}
					: {
							description: textAt(
								field.description,
								`${fieldPath}.description`,
								{ max: 2_000 },
							),
						}),
				options,
			});
		},
		{ nonEmpty: true, max: 20 },
	);
	const fieldIds = fields.map((field) => field.id);
	if (new Set(fieldIds).size !== fieldIds.length)
		fail(`${path}.fields`, "contains duplicate IDs");
	return Object.freeze({ kind: "choice-form", fields });
}

function parsePendingQuestion(value: unknown, path: string): PendingQuestion {
	const data = objectAt(value, path);
	exactKeys(
		data,
		path,
		[
			"id",
			"question",
			"status",
			"resolutionOwner",
			"gate",
			"resolutionCriteria",
			"sourceWorkId",
		],
		["context", "responseSpec"],
	);
	const resolutionOwner = oneOf(
		data.resolutionOwner,
		`${path}.resolutionOwner`,
		["agent", "user", "environment", "unknown"] as const,
	);
	if (data.responseSpec !== undefined && resolutionOwner !== "user") {
		fail(`${path}.responseSpec`, "is allowed only for a user-owned question");
	}
	return Object.freeze({
		id: idAt(data.id, `${path}.id`),
		question: textAt(data.question, `${path}.question`),
		...(data.context === undefined
			? {}
			: { context: textAt(data.context, `${path}.context`) }),
		...(data.responseSpec === undefined
			? {}
			: {
					responseSpec: parseChoiceResponseSpec(
						data.responseSpec,
						`${path}.responseSpec`,
					),
				}),
		status: oneOf(data.status, `${path}.status`, ["open", "blocked"] as const),
		resolutionOwner,
		gate: oneOf(data.gate, `${path}.gate`, [
			"none",
			"before-implementation",
			"before-completion",
		] as const),
		resolutionCriteria: textAt(
			data.resolutionCriteria,
			`${path}.resolutionCriteria`,
		),
		sourceWorkId: idAt(data.sourceWorkId, `${path}.sourceWorkId`),
	});
}

function parseQuestionUpdate(value: unknown, path: string): QuestionUpdate {
	const data = objectAt(value, path);
	exactKeys(data, path, ["questionId", "status", "result", "basis"]);
	return Object.freeze({
		questionId: idAt(data.questionId, `${path}.questionId`),
		status: oneOf(data.status, `${path}.status`, [
			"resolved",
			"not-applicable",
			"open",
			"blocked",
		] as const),
		result: textAt(data.result, `${path}.result`),
		basis: uniqueTextArray(data.basis, `${path}.basis`, { nonEmpty: true }),
	});
}

const CONTEXT_USES = [
	"method",
	"guidance",
	"constraint",
	"evidence",
	"decision",
] as const;

function parseContextMember(value: unknown, path: string): ContextBasisMember {
	const data = objectAt(value, path);
	exactKeys(data, path, ["materialId", "memberId", "contentSha256"]);
	return Object.freeze({
		materialId: idAt(data.materialId, `${path}.materialId`),
		memberId: idAt(data.memberId, `${path}.memberId`),
		contentSha256: shaAt(data.contentSha256, `${path}.contentSha256`),
	});
}

function parseContextSourceBasis(
	value: unknown,
	path: string,
): ContextSourceBasis {
	const data = objectAt(value, path);
	exactKeys(
		data,
		path,
		["inventorySourceId", "descriptorSha256"],
		["policySha256", "applicability", "applicabilitySha256"],
	);
	const policySha256 =
		data.policySha256 === undefined
			? undefined
			: shaAt(data.policySha256, `${path}.policySha256`);
	const applicability =
		data.applicability === undefined
			? undefined
			: oneOf(data.applicability, `${path}.applicability`, [
					"applicable",
					"not-applicable",
					"needs-context",
				] as const);
	const applicabilitySha256 =
		data.applicabilitySha256 === undefined
			? undefined
			: shaAt(data.applicabilitySha256, `${path}.applicabilitySha256`);
	if (
		Boolean(policySha256) !== Boolean(applicability) ||
		Boolean(policySha256) !== Boolean(applicabilitySha256)
	) {
		fail(
			path,
			"policySha256, applicability, and applicabilitySha256 must appear together",
		);
	}
	return Object.freeze({
		inventorySourceId: idAt(
			data.inventorySourceId,
			`${path}.inventorySourceId`,
		),
		descriptorSha256: shaAt(data.descriptorSha256, `${path}.descriptorSha256`),
		...(policySha256 ? { policySha256 } : {}),
		...(applicability ? { applicability } : {}),
		...(applicabilitySha256 ? { applicabilitySha256 } : {}),
	});
}

function parseContributionBasis(
	value: unknown,
	path: string,
): ContributionBasis {
	const data = objectAt(value, path);
	exactKeys(
		data,
		path,
		["contributionId", "materialId", "useAs", "assurance"],
		["evaluator", "userEventId"],
	);
	const assurance = oneOf(data.assurance, `${path}.assurance`, [
		"agent-asserted",
		"domain-verified",
		"user-accepted",
	] as const);
	let evaluator: Readonly<{ id: string; version: string }> | undefined;
	let userEventId: string | undefined;
	if (assurance === "domain-verified") {
		const rawEvaluator = objectAt(data.evaluator, `${path}.evaluator`);
		exactKeys(rawEvaluator, `${path}.evaluator`, ["id", "version"]);
		evaluator = Object.freeze({
			id: idAt(rawEvaluator.id, `${path}.evaluator.id`),
			version: idAt(rawEvaluator.version, `${path}.evaluator.version`),
		});
		if (data.userEventId !== undefined)
			fail(`${path}.userEventId`, "is not domain authority");
	} else if (assurance === "user-accepted") {
		userEventId = idAt(data.userEventId, `${path}.userEventId`);
		if (data.evaluator !== undefined)
			fail(`${path}.evaluator`, "is not user authority");
	} else if (data.evaluator !== undefined || data.userEventId !== undefined) {
		fail(path, "agent assurance cannot carry evaluator or user authority");
	}
	return Object.freeze({
		contributionId: idAt(data.contributionId, `${path}.contributionId`),
		materialId: idAt(data.materialId, `${path}.materialId`),
		useAs: oneOf(data.useAs, `${path}.useAs`, CONTEXT_USES),
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
	path = "contextBasis",
): DeveloperContextBasis {
	const data = objectAt(value, path);
	exactKeys(
		data,
		path,
		[
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
		["policySha256"],
	);
	const contextSources = arrayAt(
		data.contextSources,
		`${path}.contextSources`,
		parseContextSourceBasis,
	);
	const contextSourceIds = contextSources.map(
		(source) => source.inventorySourceId,
	);
	if (new Set(contextSourceIds).size !== contextSourceIds.length) {
		fail(`${path}.contextSources`, "duplicate inventorySourceId");
	}
	const members = arrayAt(data.members, `${path}.members`, parseContextMember);
	const materialIds = members.map((member) => member.materialId);
	if (new Set(materialIds).size !== materialIds.length)
		fail(`${path}.members`, "duplicate materialId");
	const contributions = arrayAt(
		data.contributions,
		`${path}.contributions`,
		parseContributionBasis,
	);
	const contributionIds = contributions.map(
		(contribution) => contribution.contributionId,
	);
	if (new Set(contributionIds).size !== contributionIds.length)
		fail(`${path}.contributions`, "duplicate contributionId");
	for (const contribution of contributions) {
		if (!materialIds.includes(contribution.materialId))
			fail(
				`${path}.contributions`,
				`unknown materialId ${contribution.materialId}`,
			);
	}
	const parsed = {
		judgmentId: idAt(data.judgmentId, `${path}.judgmentId`),
		...(data.policySha256 === undefined
			? {}
			: { policySha256: shaAt(data.policySha256, `${path}.policySha256`) }),
		questionSha256: shaAt(data.questionSha256, `${path}.questionSha256`),
		selectionSha256: shaAt(data.selectionSha256, `${path}.selectionSha256`),
		sealedContextSha256: shaAt(
			data.sealedContextSha256,
			`${path}.sealedContextSha256`,
		),
		coverageSha256: shaAt(data.coverageSha256, `${path}.coverageSha256`),
		outcomeSha256: shaAt(data.outcomeSha256, `${path}.outcomeSha256`),
		contextSources,
		members,
		contributions,
		conflictIds: uniqueIds(data.conflictIds, `${path}.conflictIds`),
		limitationIds: uniqueIds(data.limitationIds, `${path}.limitationIds`),
	};
	const contextBasisSha256 = shaAt(
		data.contextBasisSha256,
		`${path}.contextBasisSha256`,
	);
	if (developerContextBasisSha256(parsed) !== contextBasisSha256) {
		fail(`${path}.contextBasisSha256`, "does not match the context basis");
	}
	return Object.freeze({ ...parsed, contextBasisSha256 });
}

function conclusionBase(data: ObjectValue, path: string) {
	return {
		[conclusionBrand]: true as const,
		judgmentId: idAt(data.judgmentId, `${path}.judgmentId`),
		producedArtifacts: uniqueTextArray(
			data.producedArtifacts,
			`${path}.producedArtifacts`,
			{ max: 100 },
		),
		openedQuestions: arrayAt(
			data.openedQuestions,
			`${path}.openedQuestions`,
			parsePendingQuestion,
			{ max: 20 },
		),
		questionUpdates: arrayAt(
			data.questionUpdates,
			`${path}.questionUpdates`,
			parseQuestionUpdate,
			{ max: 20 },
		),
	};
}

export function parseJudgmentConclusion(
	value: unknown,
	path = "judgmentConclusion",
): JudgmentConclusion {
	const data = objectAt(value, path);
	const common = [
		"kind",
		"judgmentId",
		"producedArtifacts",
		"openedQuestions",
		"questionUpdates",
	] as const;
	const kind = oneOf(data.kind, `${path}.kind`, [
		"contextual-judgment",
		"needs-evidence",
		"emergent-question",
		"judgment-not-applicable",
	] as const);
	if (kind === "contextual-judgment") {
		exactKeys(data, path, [
			...common,
			"contextBasis",
			"rationale",
			"artifact",
			"stopEvidence",
		]);
		return Object.freeze({
			...conclusionBase(data, path),
			kind,
			contextBasis: parseDeveloperContextBasis(
				data.contextBasis,
				`${path}.contextBasis`,
			),
			rationale: textAt(data.rationale, `${path}.rationale`),
			artifact: textAt(data.artifact, `${path}.artifact`),
			stopEvidence: uniqueTextArray(data.stopEvidence, `${path}.stopEvidence`, {
				nonEmpty: true,
			}),
		});
	}
	if (kind === "needs-evidence") {
		exactKeys(
			data,
			path,
			[...common, "contextBasis", "evidenceNeeded", "resolutionOwner"],
			["artifact"],
		);
		return Object.freeze({
			...conclusionBase(data, path),
			kind,
			contextBasis: parseDeveloperContextBasis(
				data.contextBasis,
				`${path}.contextBasis`,
			),
			evidenceNeeded: uniqueTextArray(
				data.evidenceNeeded,
				`${path}.evidenceNeeded`,
				{ nonEmpty: true },
			),
			resolutionOwner: oneOf(data.resolutionOwner, `${path}.resolutionOwner`, [
				"agent",
				"user",
				"environment",
				"unknown",
			] as const),
			...(data.artifact === undefined
				? {}
				: { artifact: textAt(data.artifact, `${path}.artifact`) }),
		});
	}
	if (kind === "emergent-question") {
		exactKeys(data, path, [
			...common,
			"contextBasis",
			"question",
			"reason",
			"artifact",
			"stopEvidence",
		]);
		return Object.freeze({
			...conclusionBase(data, path),
			kind,
			contextBasis: parseDeveloperContextBasis(
				data.contextBasis,
				`${path}.contextBasis`,
			),
			question: textAt(data.question, `${path}.question`),
			reason: textAt(data.reason, `${path}.reason`),
			artifact: textAt(data.artifact, `${path}.artifact`),
			stopEvidence: uniqueTextArray(data.stopEvidence, `${path}.stopEvidence`, {
				nonEmpty: true,
			}),
		});
	}
	exactKeys(data, path, [...common, "reason", "basis"]);
	return Object.freeze({
		...conclusionBase(data, path),
		kind,
		reason: textAt(data.reason, `${path}.reason`),
		basis: uniqueTextArray(data.basis, `${path}.basis`, { nonEmpty: true }),
	});
}

export function parseImplementationLanding(
	value: unknown,
	path = "implementationLanding",
): ImplementationLanding {
	const data = objectAt(value, path);
	exactKeys(data, path, [
		"authorizationId",
		"changedPaths",
		"result",
		"verification",
	]);
	return Object.freeze({
		[landingBrand]: true as const,
		authorizationId: idAt(data.authorizationId, `${path}.authorizationId`),
		changedPaths: uniqueTextArray(data.changedPaths, `${path}.changedPaths`, {
			nonEmpty: true,
			max: 200,
		}),
		result: textAt(data.result, `${path}.result`),
		verification: uniqueTextArray(data.verification, `${path}.verification`, {
			max: 100,
		}),
	});
}

export function parseDeveloperEvent(value: unknown): DeveloperEvent {
	const data = objectAt(value, "event");
	if (data.protocol !== DEVELOPER_PROTOCOL) {
		fail("event.protocol", `expected ${DEVELOPER_PROTOCOL}`);
	}
	const kind = oneOf(data.kind, "event.kind", [
		"activation-changed",
		"question-focused",
		"judgment-opened",
		"context-sources-opened",
		"change-authorized",
		"judgment-concluded",
		"landing-recorded",
	] as const);
	if (kind === "activation-changed") {
		exactKeys(data, "event", ["protocol", "kind", "enabled"]);
		return Object.freeze({
			[eventBrand]: true as const,
			protocol: DEVELOPER_PROTOCOL,
			kind,
			enabled: boolAt(data.enabled, "event.enabled"),
		});
	}
	if (kind === "question-focused") {
		exactKeys(data, "event", ["protocol", "kind", "questionId"]);
		return Object.freeze({
			[eventBrand]: true as const,
			protocol: DEVELOPER_PROTOCOL,
			kind,
			questionId: idAt(data.questionId, "event.questionId"),
		});
	}
	if (kind === "judgment-opened") {
		exactKeys(data, "event", ["protocol", "kind", "judgment"]);
		return Object.freeze({
			[eventBrand]: true as const,
			protocol: DEVELOPER_PROTOCOL,
			kind,
			judgment: parseActiveJudgment(data.judgment, "event.judgment"),
		});
	}
	if (kind === "context-sources-opened") {
		exactKeys(data, "event", ["protocol", "kind", "judgmentId", "sources"]);
		return Object.freeze({
			[eventBrand]: true as const,
			protocol: DEVELOPER_PROTOCOL,
			kind,
			judgmentId: idAt(data.judgmentId, "event.judgmentId"),
			sources: arrayAt(
				data.sources,
				"event.sources",
				parseOpenedContextSource,
				{ nonEmpty: true, max: 32 },
			),
		});
	}
	if (kind === "change-authorized") {
		exactKeys(data, "event", ["protocol", "kind", "change"]);
		return Object.freeze({
			[eventBrand]: true as const,
			protocol: DEVELOPER_PROTOCOL,
			kind,
			change: parseAuthorizedChange(data.change, "event.change"),
		});
	}
	if (kind === "judgment-concluded") {
		exactKeys(data, "event", ["protocol", "kind", "conclusion"]);
		return Object.freeze({
			[eventBrand]: true as const,
			protocol: DEVELOPER_PROTOCOL,
			kind,
			conclusion: parseJudgmentConclusion(data.conclusion, "event.conclusion"),
		});
	}
	exactKeys(data, "event", ["protocol", "kind", "landing"]);
	return Object.freeze({
		[eventBrand]: true as const,
		protocol: DEVELOPER_PROTOCOL,
		kind,
		landing: parseImplementationLanding(data.landing, "event.landing"),
	});
}

function activeJudgmentData(
	judgment: ActiveJudgment,
): Readonly<Record<string, unknown>> {
	return Object.freeze({
		kind: judgment.kind,
		judgmentId: judgment.judgmentId,
		question: judgment.question,
		skill: judgment.skill,
		reason: judgment.reason,
		knownEvidence: judgment.knownEvidence,
		consideredMethods: judgment.consideredMethods,
		contextSources: judgment.contextSources.map((source) => ({
			...source,
			...(source.policy
				? { policy: compiledJudgmentPolicyData(source.policy) }
				: {}),
		})),
		...(judgment.targetQuestionId
			? { targetQuestionId: judgment.targetQuestionId }
			: {}),
		...(judgment.policy
			? { policy: compiledJudgmentPolicyData(judgment.policy) }
			: {}),
	});
}

export function developerEventData(
	event: DeveloperEvent,
): Readonly<Record<string, unknown>> {
	switch (event.kind) {
		case "activation-changed":
			return Object.freeze({
				protocol: event.protocol,
				kind: event.kind,
				enabled: event.enabled,
			});
		case "question-focused":
			return Object.freeze({
				protocol: event.protocol,
				kind: event.kind,
				questionId: event.questionId,
			});
		case "judgment-opened":
			return Object.freeze({
				protocol: event.protocol,
				kind: event.kind,
				judgment: activeJudgmentData(event.judgment),
			});
		case "context-sources-opened":
			return Object.freeze({
				protocol: event.protocol,
				kind: event.kind,
				judgmentId: event.judgmentId,
				sources: event.sources.map((source) => ({
					...source,
					...(source.policy
						? { policy: compiledJudgmentPolicyData(source.policy) }
						: {}),
				})),
			});
		case "change-authorized":
			return Object.freeze({
				protocol: event.protocol,
				kind: event.kind,
				change: event.change,
			});
		case "judgment-concluded":
			return Object.freeze({
				protocol: event.protocol,
				kind: event.kind,
				conclusion: event.conclusion,
			});
		case "landing-recorded":
			return Object.freeze({
				protocol: event.protocol,
				kind: event.kind,
				landing: event.landing,
			});
	}
}

export function activationChanged(enabled: boolean): ActivationChanged {
	return parseDeveloperEvent({
		protocol: DEVELOPER_PROTOCOL,
		kind: "activation-changed",
		enabled,
	}) as ActivationChanged;
}

export function judgmentOpened(value: unknown): JudgmentOpened {
	return parseDeveloperEvent({
		protocol: DEVELOPER_PROTOCOL,
		kind: "judgment-opened",
		judgment: value,
	}) as JudgmentOpened;
}

export function contextSourcesOpened(value: unknown): ContextSourcesOpened {
	return parseDeveloperEvent({
		protocol: DEVELOPER_PROTOCOL,
		kind: "context-sources-opened",
		...objectAt(value, "contextSourcesOpened"),
	}) as ContextSourcesOpened;
}

export function changeAuthorized(value: unknown): ChangeAuthorized {
	return parseDeveloperEvent({
		protocol: DEVELOPER_PROTOCOL,
		kind: "change-authorized",
		change: value,
	}) as ChangeAuthorized;
}

export function judgmentConcluded(value: unknown): JudgmentConcluded {
	return parseDeveloperEvent({
		protocol: DEVELOPER_PROTOCOL,
		kind: "judgment-concluded",
		conclusion: value,
	}) as JudgmentConcluded;
}

export function landingRecorded(value: unknown): LandingRecorded {
	return parseDeveloperEvent({
		protocol: DEVELOPER_PROTOCOL,
		kind: "landing-recorded",
		landing: value,
	}) as LandingRecorded;
}
