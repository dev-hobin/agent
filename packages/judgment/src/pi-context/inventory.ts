import type { CompiledJudgmentPolicy } from "../compiled-policy.ts";
import {
	decodeContextInventoryData,
	parseContextInventory,
	type ContextInventory,
} from "../context.ts";
import { canonicalJson, jsonValueFromUnknown, sha256 } from "../json.ts";

export interface PiSourceInfoInput {
	readonly path: string;
	readonly source: string;
	readonly scope: "user" | "project" | "temporary";
	readonly origin: "package" | "top-level";
	readonly baseDir?: string;
}
export interface PiSkillInventoryInput {
	readonly name: string;
	readonly description: string;
	readonly filePath: string;
	readonly disableModelInvocation: boolean;
	readonly policyPath?: string;
	readonly contentSha256?: string;
	readonly sourceInfo: PiSourceInfoInput;
}
export interface PiContextFileInventoryInput {
	readonly path: string;
	readonly content: string;
}
export interface PiToolInventoryInput {
	readonly name: string;
	readonly description: string;
	readonly sourceInfo: PiSourceInfoInput;
}
export interface PreparedContextProviderInput {
	readonly policyRoot: string;
	readonly policy: CompiledJudgmentPolicy;
}
export interface PiContextInventoryInput {
	readonly preparedProviders: readonly PreparedContextProviderInput[];
	readonly skills: readonly PiSkillInventoryInput[];
	readonly contextFiles: readonly PiContextFileInventoryInput[];
	readonly tools: readonly PiToolInventoryInput[];
	readonly activeToolNames: readonly string[];
}
function descriptorId(prefix: string, identity: object): string {
	return `${prefix}-${sha256(canonicalJson(jsonValueFromUnknown(identity))).slice(0, 24)}`;
}
function provenance(sourceInfo: PiSourceInfoInput) {
	return {
		source: sourceInfo.source,
		scope: sourceInfo.scope,
		origin: sourceInfo.origin,
		path: sourceInfo.path,
	};
}
function preparedReferences(input: PiContextInventoryInput) {
	return input.preparedProviders.flatMap(({ policy, policyRoot }) =>
		policy.references.map((reference) => ({
			id: descriptorId("reference", {
				policySha256: policy.policySha256,
				path: reference.path,
			}),
			kind: "prepared-reference",
			title: reference.path,
			description: `Prepared reference for ${policy.owner.name}.`,
			provenance: {
				source: policy.owner.provenance.source,
				scope: policy.owner.provenance.scope,
				origin: policy.owner.provenance.origin,
				path: `${policyRoot}/${reference.path}`,
			},
			path: reference.path,
			when: reference.when,
			policySha256: policy.policySha256,
		})),
	);
}
function skills(values: readonly PiSkillInventoryInput[]) {
	return values.flatMap((skill) => {
		const skillProvenance = {
			...provenance(skill.sourceInfo),
			path: skill.filePath,
		};
		if (skill.disableModelInvocation) return [];
		return [
			{
				id: descriptorId("skill", {
					name: skill.name,
					filePath: skill.filePath,
					provenance: skillProvenance,
				}),
				kind: "pi-skill",
				title: skill.name,
				description: skill.description,
				provenance: skillProvenance,
				...(skill.policyPath ? { policyPath: skill.policyPath } : {}),
				...(skill.contentSha256 ? { contentSha256: skill.contentSha256 } : {}),
			},
		];
	});
}
function contextFiles(values: readonly PiContextFileInventoryInput[]) {
	return values.map((contextFile) => ({
		id: descriptorId("context", { path: contextFile.path }),
		kind: "pi-context-file",
		title: contextFile.path,
		description: "Pi-loaded ambient context file.",
		provenance: {
			source: contextFile.path,
			scope: "project",
			origin: "top-level",
			path: contextFile.path,
		},
		path: contextFile.path,
		contentSha256: sha256(
			canonicalJson(
				jsonValueFromUnknown([{ kind: "text", text: contextFile.content }]),
			),
		),
	}));
}
function capabilities(
	tools: readonly PiToolInventoryInput[],
	activeToolNames: readonly string[],
) {
	const active = new Set(activeToolNames);
	return tools.map((tool) => ({
		id: descriptorId("tool", {
			name: tool.name,
			provenance: provenance(tool.sourceInfo),
		}),
		kind: "pi-tool",
		name: tool.name,
		description: tool.description,
		active: active.has(tool.name),
		provenance: provenance(tool.sourceInfo),
	}));
}
export function buildPiContextInventory(
	input: PiContextInventoryInput,
): ContextInventory {
	return parseContextInventory(
		decodeContextInventoryData(
			jsonValueFromUnknown({
				sources: [
					...preparedReferences(input),
					...skills(input.skills),
					...contextFiles(input.contextFiles),
				],
				capabilities: capabilities(input.tools, input.activeToolNames),
			}),
		),
	);
}
