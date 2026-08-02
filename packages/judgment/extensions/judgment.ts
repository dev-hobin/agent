import { dirname, resolve } from "node:path";

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type, type Static } from "typebox";

import {
	decodePolicyOwnerData,
	parsePolicyOwner,
	type CompiledJudgmentPolicy,
	type PolicyOwner,
} from "../src/compiled-policy.ts";
import type {
	ContextInventory,
	ContextSourceDescriptor,
} from "../src/context.ts";
import { ContextCoverageProposalDataSchema } from "../src/coverage.ts";
import { judgmentPolicyDirections } from "../src/directions.ts";
import { JudgmentTransitionError } from "../src/errors.ts";
import { jsonValueFromUnknown, sha256 } from "../src/json.ts";
import { ContextApplicabilityDataSchema } from "../src/lifecycle.ts";
import {
	createNodeLocalReferenceReader,
	loadOptionalJudgmentPolicyFile,
	type AcquiredContextData,
	type LoadedJudgmentPolicy,
} from "../src/node/seal-context.ts";
import { JudgmentProposalDataSchema } from "../src/outcome.ts";
import { contextContentSha256 } from "../src/sealed-context.ts";
import { ContextAttempt } from "./context-attempt.ts";
import {
	buildPiContextInventory,
	type PiContextInventoryInput,
	type PiSkillInventoryInput,
} from "./inventory.ts";
import {
	resolveObservedContext,
	type PiBranchEntryInput,
	type ResolvedObservedContext,
} from "./observed-context.ts";
import {
	decodeJudgmentSessionRecordData,
	JUDGMENT_SESSION_PROTOCOL,
	normalizeSelectionBasis,
	type JudgmentSessionRecordData,
	type ObservedContextNominationData,
} from "./session.ts";

const MAX_OUTPUT_CHARS = 24_000;
const Identifier = Type.String({
	minLength: 1,
	maxLength: 160,
	pattern: "^[A-Za-z][A-Za-z0-9._:/-]*$",
});
const Text = Type.String({ minLength: 1, maxLength: 4_000 });
const OpenParams = Type.Object(
	{
		skillName: Identifier,
		question: Text,
		basisMaterialIds: Type.Optional(
			Type.Array(Type.String({ minLength: 1, maxLength: 300 }), {
				maxItems: 128,
				uniqueItems: true,
			}),
		),
	},
	{ additionalProperties: false },
);
const ApplicabilityParams = Type.Object(
	{ judgmentId: Identifier, applicability: ContextApplicabilityDataSchema },
	{ additionalProperties: false },
);
const InventoryNomination = Type.Object(
	{ kind: Type.Literal("inventory-source"), inventorySourceId: Identifier },
	{ additionalProperties: false },
);
const ToolNomination = Type.Object(
	{
		kind: Type.Literal("tool-result"),
		toolCallId: Type.String({ minLength: 1, maxLength: 300 }),
		inventorySourceId: Type.Optional(Identifier),
	},
	{ additionalProperties: false },
);
const UserNomination = Type.Object(
	{
		kind: Type.Literal("user-decision"),
		userEventId: Type.String({ minLength: 1, maxLength: 300 }),
	},
	{ additionalProperties: false },
);
const Nomination = Type.Union([
	InventoryNomination,
	ToolNomination,
	UserNomination,
]);
const SelectParams = Type.Object(
	{
		judgmentId: Identifier,
		nominations: Type.Array(Nomination, { maxItems: 256 }),
		selectionBasis: Type.Optional(
			Type.Array(Text, { maxItems: 32, uniqueItems: true }),
		),
	},
	{ additionalProperties: false },
);
const CoverageParams = Type.Object(
	{ judgmentId: Identifier, proposal: ContextCoverageProposalDataSchema },
	{ additionalProperties: false },
);
const OutcomeParams = Type.Object(
	{ judgmentId: Identifier, proposal: JudgmentProposalDataSchema },
	{ additionalProperties: false },
);
type SelectToolParams = Static<typeof SelectParams>;

interface InventorySnapshot {
	readonly input: Omit<PiContextInventoryInput, "policy" | "policyRoot">;
	readonly contextFileContent: ReadonlyMap<string, string>;
	readonly skills: readonly PiSkillInventoryInput[];
}
interface ActiveAttempt {
	readonly attempt: ContextAttempt;
	readonly inventory: ContextInventory;
	readonly policy?: LoadedJudgmentPolicy;
	readonly policyRoot: string;
	readonly snapshot: InventorySnapshot;
}
interface SessionEntry {
	readonly type: string;
	readonly customType?: string;
	readonly data?: unknown;
	readonly message?: unknown;
	readonly id?: string;
}

function output(text: string): string {
	if (text.length > MAX_OUTPUT_CHARS)
		throw new JudgmentTransitionError(
			`Judgment output exceeds ${MAX_OUTPUT_CHARS} characters.`,
		);
	return text;
}
function snapshotInventory(
	pi: ExtensionAPI,
	options: {
		readonly skills?: PiContextInventoryInput["skills"];
		readonly contextFiles?: PiContextInventoryInput["contextFiles"];
	},
): InventorySnapshot {
	const skills = options.skills ?? [];
	const contextFiles = options.contextFiles ?? [];
	const tools = pi.getAllTools().map((tool) => ({
		name: tool.name,
		description: tool.description,
		sourceInfo: tool.sourceInfo,
	}));
	return Object.freeze({
		input: {
			skills,
			contextFiles,
			tools,
			activeToolNames: pi.getActiveTools(),
		},
		contextFileContent: new Map(
			contextFiles.map((file) => [file.path, file.content]),
		),
		skills,
	});
}
function uniqueSkill(
	snapshot: InventorySnapshot,
	name: string,
): PiSkillInventoryInput {
	const matches = snapshot.skills.filter(
		(skill) => !skill.disableModelInvocation && skill.name === name,
	);
	if (matches.length !== 1)
		throw new JudgmentTransitionError(
			matches.length === 0
				? `Unknown Pi skill: ${name}.`
				: `Ambiguous Pi skill identity: ${name}.`,
		);
	return matches[0];
}
function ownerFor(skill: PiSkillInventoryInput): PolicyOwner {
	return parsePolicyOwner(
		decodePolicyOwnerData(
			jsonValueFromUnknown({
				kind: "pi-skill",
				namespace: skill.sourceInfo.source,
				name: skill.name,
				provenance: {
					source: skill.sourceInfo.source,
					scope: skill.sourceInfo.scope,
					origin: skill.sourceInfo.origin,
					path: skill.filePath,
				},
			}),
		),
	);
}
async function policyFor(
	skill: PiSkillInventoryInput,
): Promise<LoadedJudgmentPolicy | undefined> {
	const result = await loadOptionalJudgmentPolicyFile({
		path: resolve(dirname(skill.filePath), "judgment.json"),
		owner: ownerFor(skill),
		allowedRoot: dirname(skill.filePath),
	});
	if (result.kind === "invalid")
		throw new JudgmentTransitionError(
			`Invalid judgment.json for ${skill.name}: ${result.diagnostic}`,
		);
	return result.kind === "loaded" ? result.value : undefined;
}
function inventoryFor(
	snapshot: InventorySnapshot,
	policy: LoadedJudgmentPolicy | undefined,
): ContextInventory {
	return buildPiContextInventory({
		...snapshot.input,
		...(policy ? { policy: policy.policy, policyRoot: policy.root } : {}),
	});
}
function append(
	pi: ExtensionAPI,
	records: readonly JudgmentSessionRecordData[],
): void {
	for (const record of records)
		pi.appendEntry(JUDGMENT_SESSION_PROTOCOL, record);
}
function activeFor(
	attempts: ReadonlyMap<string, ActiveAttempt>,
	issues: ReadonlyMap<string, string>,
	judgmentId: string,
): ActiveAttempt {
	const issue = issues.get(judgmentId);
	if (issue) throw new JudgmentTransitionError(issue);
	const active = attempts.get(judgmentId);
	if (!active)
		throw new JudgmentTransitionError(
			`Unknown or inactive judgment: ${judgmentId}.`,
		);
	return active;
}
async function inventoryProposal(
	active: ActiveAttempt,
	nominations: readonly Extract<
		SelectToolParams["nominations"][number],
		{ kind: "inventory-source" }
	>[],
	signal?: AbortSignal,
) {
	const reader = createNodeLocalReferenceReader(active.policyRoot);
	const result = [];
	for (const nomination of nominations) {
		const source = active.inventory.sources.find(
			(candidate) => candidate.id === nomination.inventorySourceId,
		);
		if (!source)
			throw new JudgmentTransitionError(
				`Unknown inventory source: ${nomination.inventorySourceId}.`,
			);
		let contentSha256: string | undefined;
		if (source.kind === "prepared-reference") {
			const text = await reader.read(source, {
				maxBytes: 48_000,
				...(signal ? { signal } : {}),
			});
			contentSha256 = contextContentSha256([{ kind: "text", text }]);
		}
		result.push({
			kind: "inventory-source",
			inventorySourceId: source.id,
			descriptorSha256: source.descriptorSha256,
			...(contentSha256 ? { contentSha256 } : {}),
		});
	}
	return result;
}
function observedNominations(
	params: SelectToolParams,
): readonly ObservedContextNominationData[] {
	const result: ObservedContextNominationData[] = [];
	for (const nomination of params.nominations) {
		if (nomination.kind === "tool-result") {
			result.push({
				kind: "tool-result",
				toolCallId: nomination.toolCallId,
				...(nomination.inventorySourceId
					? { inventorySourceId: nomination.inventorySourceId }
					: {}),
			});
		} else if (nomination.kind === "user-decision") {
			result.push({
				kind: "user-decision",
				userEventId: nomination.userEventId,
			});
		}
	}
	return Object.freeze(result);
}
function resolveObserved(
	active: ActiveAttempt,
	nominations: readonly ObservedContextNominationData[],
	branch: readonly PiBranchEntryInput[],
): ResolvedObservedContext {
	return resolveObservedContext({
		branchRef: active.attempt.state.question.branchRef,
		branch,
		toolNominations: nominations.flatMap((nomination) => {
			if (nomination.kind !== "tool-result") return [];
			return [
				{
					toolCallId: nomination.toolCallId,
					...(nomination.inventorySourceId
						? { inventorySourceId: nomination.inventorySourceId }
						: {}),
				},
			];
		}),
		userDecisionNominations: nominations.flatMap((nomination) =>
			nomination.kind === "user-decision"
				? [{ userEventId: nomination.userEventId }]
				: [],
		),
	});
}
function observedProposal(resolved: ResolvedObservedContext) {
	return resolved.observedContext.entries.map((entry) => ({
		kind: "observed-context",
		observedContextId: entry.id,
		descriptorSha256: entry.descriptorSha256,
	}));
}
function acquisition(active: ActiveAttempt, observed: ResolvedObservedContext) {
	return {
		localReferenceReader: createNodeLocalReferenceReader(active.policyRoot),
		async acquireContextFile(
			source: Extract<ContextSourceDescriptor, { kind: "pi-context-file" }>,
		): Promise<AcquiredContextData> {
			const content = active.snapshot.contextFileContent.get(source.path);
			if (content === undefined)
				throw new JudgmentTransitionError(
					`Pi context file is no longer available: ${source.path}.`,
				);
			return {
				parts: [{ kind: "text", text: content }],
				isError: false,
				truncated: false,
			};
		},
		acquireObservedContext: observed.acquireObservedContext,
	};
}
function policyDirections(policy: CompiledJudgmentPolicy | undefined): string {
	return policy
		? judgmentPolicyDirections(policy).markdown
		: "No judgment.json is present. The selected skill remains a normal Pi skill; use exact observed external context when it can change the judgment.";
}

function groupRecords(branch: readonly SessionEntry[]) {
	const grouped = new Map<string, JudgmentSessionRecordData[]>();
	const issues: string[] = [];
	for (const entry of branch) {
		if (entry.type !== "custom" || !entry.customType) continue;
		if (entry.customType !== JUDGMENT_SESSION_PROTOCOL) {
			if (entry.customType.startsWith("judgment-session/"))
				issues.push(
					`Unsupported ${entry.customType} history; restart under ${JUDGMENT_SESSION_PROTOCOL}.`,
				);
			continue;
		}
		try {
			const record = decodeJudgmentSessionRecordData(entry.data);
			const records = grouped.get(record.event.judgmentId) ?? [];
			records.push(record);
			grouped.set(record.event.judgmentId, records);
		} catch (error) {
			issues.push(
				error instanceof Error ? error.message : "Invalid Judgment history.",
			);
		}
	}
	return { grouped, issues };
}
async function replayOne(
	records: readonly JudgmentSessionRecordData[],
	snapshot: InventorySnapshot,
	branch: readonly SessionEntry[],
): Promise<ActiveAttempt> {
	const opened = records[0]?.event;
	if (!opened || opened.kind !== "attempt-opened")
		throw new JudgmentTransitionError(
			"Judgment history does not start with an open record.",
		);
	const applicability =
		records[1]?.event.kind === "applicability-recorded"
			? records[1].event
			: undefined;
	let policy: LoadedJudgmentPolicy | undefined;
	if (opened.policyPath) {
		const owner = parsePolicyOwner(
			decodePolicyOwnerData(jsonValueFromUnknown(opened.question.owner)),
		);
		const loaded = await loadOptionalJudgmentPolicyFile({
			path: opened.policyPath,
			owner,
			allowedRoot: dirname(opened.policyPath),
		});
		if (loaded.kind !== "loaded")
			throw new JudgmentTransitionError(
				loaded.kind === "invalid"
					? loaded.diagnostic
					: "Replayed judgment policy is missing.",
			);
		policy = loaded.value;
		if (opened.question.policySha256 !== policy.policy.policySha256)
			throw new JudgmentTransitionError(
				"Replayed judgment policy identity changed.",
			);
	}
	const start = ContextAttempt.open({
		...(opened.policyPath ? { policyPath: opened.policyPath } : {}),
		question: jsonValueFromUnknown(opened.question),
		...(applicability
			? {
					applicability: jsonValueFromUnknown(applicability.applicability),
				}
			: {}),
	});
	if (start.value.state.question.questionSha256 !== opened.questionSha256)
		throw new JudgmentTransitionError(
			"Replayed dynamic question identity changed.",
		);
	const active: ActiveAttempt = {
		attempt: start.value,
		inventory: inventoryFor(snapshot, policy),
		...(policy ? { policy } : {}),
		policyRoot:
			policy?.root ??
			dirname(opened.question.owner.provenance.path ?? process.cwd()),
		snapshot,
	};
	for (const record of records.slice(applicability ? 2 : 1)) {
		const event = record.event;
		if (event.kind === "selection-recorded") {
			const observed = resolveObserved(
				active,
				event.observedNominations,
				branch,
			);
			const transition = await active.attempt.selectAndSeal({
				inventory: active.inventory,
				observedContext: observed.observedContext,
				proposal: jsonValueFromUnknown(event.proposal),
				observedNominations: event.observedNominations,
				acquisition: acquisition(active, observed),
			});
			if (transition.value.selection?.selectionSha256 !== event.selectionSha256)
				throw new JudgmentTransitionError(
					"Replayed selection identity changed.",
				);
		} else if (event.kind === "sealed-context-recorded") {
			if (
				active.attempt.state.sealedContext?.sealedContextSha256 !==
				event.sealedContextSha256
			)
				throw new JudgmentTransitionError(
					"Replayed sealed context identity changed.",
				);
		} else if (event.kind === "coverage-recorded") {
			const transition = active.attempt.assessCoverage(
				jsonValueFromUnknown(event.proposal),
			);
			if (transition.value.coverage?.coverageSha256 !== event.coverageSha256)
				throw new JudgmentTransitionError(
					"Replayed coverage identity changed.",
				);
		} else if (event.kind === "outcome-recorded") {
			const transition = active.attempt.conclude(
				jsonValueFromUnknown(event.proposal),
			);
			if (transition.value.outcome?.outcomeSha256 !== event.outcomeSha256)
				throw new JudgmentTransitionError("Replayed outcome identity changed.");
		}
	}
	return active;
}

export default function judgmentExtension(pi: ExtensionAPI) {
	let snapshot: InventorySnapshot | undefined;
	const attempts = new Map<string, ActiveAttempt>();
	const replayIssues = new Map<string, string>();
	pi.on("before_agent_start", async (event, ctx) => {
		snapshot = snapshotInventory(pi, {
			skills: event.systemPromptOptions.skills ?? [],
			contextFiles: event.systemPromptOptions.contextFiles ?? [],
		});
		attempts.clear();
		replayIssues.clear();
		const grouped = groupRecords(ctx.sessionManager.getBranch());
		for (const issue of grouped.issues)
			replayIssues.set(`history-${replayIssues.size + 1}`, issue);
		for (const [judgmentId, records] of grouped.grouped) {
			try {
				attempts.set(
					judgmentId,
					await replayOne(records, snapshot, ctx.sessionManager.getBranch()),
				);
			} catch (error) {
				replayIssues.set(
					judgmentId,
					error instanceof Error ? error.message : "Judgment replay failed.",
				);
			}
		}
		return {
			systemPrompt: `${event.systemPrompt}\n\n## Dynamic Context Judgment Protocol\nA Pi skill without judgment.json remains fully usable. When a selected skill has a co-located policy, judgment_open_context loads it exactly; invalid present policy fails closed. Runtime questions and contribution relations are task-specific. Prepared references are candidates, never obligations or authority. Selection, sealing, coverage, conclusion, and mutation authorization remain distinct.${replayIssues.size ? `\nReplay issues: ${[...replayIssues.values()].join(" | ")}` : ""}`,
		};
	});
	pi.on("session_start", async () => {
		attempts.clear();
		replayIssues.clear();
	});
	pi.on("session_tree", async () => {
		attempts.clear();
		replayIssues.clear();
	});

	pi.registerTool({
		name: "judgment_open_context",
		label: "Open Dynamic Context Judgment",
		description:
			"Open a runtime-generated question for one Pi skill; co-located judgment.json is optional but invalid policy fails closed.",
		parameters: OpenParams,
		executionMode: "sequential",
		async execute(toolCallId, params) {
			if (!snapshot)
				throw new JudgmentTransitionError(
					"Pi inventory is unavailable before before_agent_start.",
				);
			const skill = uniqueSkill(snapshot, params.skillName);
			const policy = await policyFor(skill);
			const judgmentId = `judgment-${sha256(toolCallId).slice(0, 24)}`;
			if (attempts.has(judgmentId))
				throw new JudgmentTransitionError(
					`Judgment already exists: ${judgmentId}.`,
				);
			const question = {
				judgmentId,
				owner: {
					kind: "pi-skill",
					namespace: skill.sourceInfo.source,
					name: skill.name,
					provenance: {
						source: skill.sourceInfo.source,
						scope: skill.sourceInfo.scope,
						origin: skill.sourceInfo.origin,
						path: skill.filePath,
					},
				},
				...(policy ? { policySha256: policy.policy.policySha256 } : {}),
				question: params.question,
				basisMaterialIds: params.basisMaterialIds ?? [],
				branchRef: toolCallId,
			};
			const opened = ContextAttempt.open({
				...(policy ? { policyPath: policy.path } : {}),
				question: jsonValueFromUnknown(question),
			});
			const inventory = inventoryFor(snapshot, policy);
			const active: ActiveAttempt = {
				attempt: opened.value,
				inventory,
				...(policy ? { policy } : {}),
				policyRoot: policy?.root ?? dirname(skill.filePath),
				snapshot,
			};
			attempts.set(judgmentId, active);
			append(pi, opened.records);
			const candidates = inventory.sources.map(
				(source) =>
					`- ${source.id} · ${source.kind} · descriptor=${source.descriptorSha256}${source.kind === "prepared-reference" ? ` · when=${source.when.join(" | ")}` : ""}`,
			);
			return {
				content: [
					{
						type: "text",
						text: output(
							`${policyDirections(policy?.policy)}\n\nJudgment: ${judgmentId}\nQuestion: ${opened.value.state.question.question}\nState: ${opened.value.state.status}\nInventory: ${inventory.inventorySha256}\n${candidates.join("\n") || "- no prepared or ambient inventory material"}`,
						),
					},
				],
				details: { records: opened.records },
			};
		},
	});

	pi.registerTool({
		name: "judgment_assess_applicability",
		label: "Assess Judgment Applicability",
		description:
			"After opening reveals the optional policy, record whether the capability applies; a matching root unless excludes it.",
		parameters: ApplicabilityParams,
		executionMode: "sequential",
		async execute(_toolCallId, params) {
			const active = activeFor(attempts, replayIssues, params.judgmentId);
			const transition = active.attempt.recordApplicability(
				jsonValueFromUnknown(params.applicability),
			);
			append(pi, transition.records);
			return {
				content: [
					{
						type: "text",
						text: output(
							`Judgment: ${params.judgmentId}\nState: ${transition.value.status}`,
						),
					},
				],
				details: { records: transition.records },
			};
		},
	});

	pi.registerTool({
		name: "judgment_select_context",
		label: "Select and Seal Context",
		description:
			"Select exact prepared or active-branch material and atomically seal its content.",
		parameters: SelectParams,
		executionMode: "sequential",
		async execute(_toolCallId, params, signal, _onUpdate, ctx) {
			const active = activeFor(attempts, replayIssues, params.judgmentId);
			const observedRecords = observedNominations(params);
			const observed = resolveObserved(
				active,
				observedRecords,
				ctx.sessionManager.getBranch(),
			);
			const inventory = await inventoryProposal(
				active,
				params.nominations.filter(
					(nomination) => nomination.kind === "inventory-source",
				),
				signal,
			);
			const proposal = {
				questionSha256: active.attempt.state.question.questionSha256,
				nominations: [...inventory, ...observedProposal(observed)],
				selectionBasis: normalizeSelectionBasis(params.selectionBasis ?? []),
			};
			const transition = await active.attempt.selectAndSeal({
				inventory: active.inventory,
				observedContext: observed.observedContext,
				proposal: jsonValueFromUnknown(proposal),
				observedNominations: observedRecords,
				acquisition: acquisition(active, observed),
				...(signal ? { signal } : {}),
			});
			append(pi, transition.records);
			const selection = transition.value.selection;
			const sealed = transition.value.sealedContext;
			if (!selection || !sealed)
				throw new JudgmentTransitionError(
					"Selection and sealing did not produce an atomic result.",
				);
			return {
				content: [
					{
						type: "text",
						text: output(
							`Selection: ${selection.selectionSha256}\nSealed context: ${sealed.sealedContextSha256}\nMaterials:\n${sealed.members.map((member) => `- ${member.materialId} · member=${member.memberId} · content=${member.contentSha256}`).join("\n") || "- none"}`,
						),
					},
				],
				details: { records: transition.records },
			};
		},
	});
	pi.registerTool({
		name: "judgment_assess_coverage",
		label: "Assess Contribution Coverage",
		description:
			"Relate every selected material to the dynamic question through exact contributions, conflicts, limitations, and sufficiency.",
		parameters: CoverageParams,
		executionMode: "sequential",
		async execute(_toolCallId, params) {
			const active = activeFor(attempts, replayIssues, params.judgmentId);
			const transition = active.attempt.assessCoverage(
				jsonValueFromUnknown(params.proposal),
			);
			append(pi, transition.records);
			const coverage = transition.value.coverage;
			if (!coverage)
				throw new JudgmentTransitionError("Coverage result is missing.");
			return {
				content: [
					{
						type: "text",
						text: output(
							`Coverage: ${coverage.coverageSha256}\nStatus: ${coverage.status}\nContributions: ${coverage.contributions.length}\nConflicts: ${coverage.conflicts.length}\nLimitations: ${coverage.limitations.length}`,
						),
					},
				],
				details: { records: transition.records },
			};
		},
	});
	pi.registerTool({
		name: "judgment_conclude",
		label: "Conclude Dynamic Judgment",
		description:
			"Conclude with contextual judgment, needs evidence, or a distinct emergent question.",
		parameters: OutcomeParams,
		executionMode: "sequential",
		async execute(_toolCallId, params) {
			const active = activeFor(attempts, replayIssues, params.judgmentId);
			const transition = active.attempt.conclude(
				jsonValueFromUnknown(params.proposal),
			);
			append(pi, transition.records);
			const outcome = transition.value.outcome;
			if (!outcome)
				throw new JudgmentTransitionError("Judgment outcome is missing.");
			return {
				content: [
					{
						type: "text",
						text: output(
							`Outcome: ${outcome.kind}\nOutcome identity: ${outcome.outcomeSha256}`,
						),
					},
				],
				details: { records: transition.records },
			};
		},
	});
}
