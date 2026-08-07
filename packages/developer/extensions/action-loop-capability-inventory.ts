import { realpath } from "node:fs/promises";
import { resolve } from "node:path";
import type {
	BeforeAgentStartEvent,
	Skill,
} from "@earendil-works/pi-coding-agent";
import {
	bindPiCapabilityInventory,
	type BoundPiCapabilityEntry,
	type PiCapabilityInventoryResult,
} from "../src/action-loop/pi/bind-pi-capability-inventory.ts";
import { catalogBeforeAgentStartSkills } from "../src/action-loop/pi/catalog-pi-loaded-skills.ts";
import { isWithinRoot } from "./skills.ts";

export interface LiveCapabilityInventory {
	readonly inventory: Extract<
		PiCapabilityInventoryResult,
		{ readonly status: "inventoried" }
	>;
	readonly availablePackageSkills: ReadonlyMap<string, Skill>;
	readonly boundCapabilitiesBySkillName: ReadonlyMap<
		string,
		BoundPiCapabilityEntry
	>;
	readonly summary: {
		readonly bound: number;
		readonly unavailable: number;
		readonly excluded: number;
	};
}

export type LiveCapabilityInventoryResult =
	| { readonly status: "ready"; readonly value: LiveCapabilityInventory }
	| Extract<PiCapabilityInventoryResult, { readonly status: "rejected" }>;

/**
 * Acquires only Pi-admitted Skill material and projects bound first-party
 * Capabilities into the preserved extension protocol.
 */
export async function prepareLiveCapabilityInventory(
	event: Pick<BeforeAgentStartEvent, "systemPromptOptions">,
	skillsRoot: string,
): Promise<LiveCapabilityInventoryResult> {
	const catalog = await catalogBeforeAgentStartSkills(event);
	const inventory = await bindPiCapabilityInventory(catalog);
	if (inventory.status === "rejected") return inventory;

	const boundCapabilitiesByPath = new Map<string, BoundPiCapabilityEntry>();
	let bound = 0;
	for (const entry of inventory.entries) {
		if (entry.status !== "bound") continue;
		bound += 1;
		boundCapabilitiesByPath.set(entry.candidate.skillFilePath, entry);
	}
	const admittedPackageSkills = new Map<string, Skill>();
	const admittedCapabilities = new Map<string, BoundPiCapabilityEntry>();
	const ambiguousNames = new Set<string>();
	for (const skill of event.systemPromptOptions.skills ?? []) {
		if (
			skill.disableModelInvocation ||
			!isWithinRoot(skillsRoot, skill.filePath)
		) {
			continue;
		}
		const canonicalPath = await realpath(skill.filePath).catch(() =>
			resolve(skill.filePath),
		);
		const boundCapability = boundCapabilitiesByPath.get(canonicalPath);
		if (boundCapability === undefined || ambiguousNames.has(skill.name))
			continue;
		if (admittedPackageSkills.has(skill.name)) {
			admittedPackageSkills.delete(skill.name);
			admittedCapabilities.delete(skill.name);
			ambiguousNames.add(skill.name);
			continue;
		}
		admittedPackageSkills.set(skill.name, skill);
		admittedCapabilities.set(skill.name, boundCapability);
	}
	return Object.freeze({
		status: "ready",
		value: Object.freeze({
			inventory,
			availablePackageSkills: admittedPackageSkills,
			boundCapabilitiesBySkillName: admittedCapabilities,
			summary: Object.freeze({
				bound,
				unavailable: inventory.entries.length - bound,
				excluded: inventory.excluded.length,
			}),
		}),
	});
}

export function liveCapabilityInventoryPrompt(
	result: LiveCapabilityInventoryResult,
): string {
	if (result.status === "rejected") {
		return `Action Loop capability inventory rejected (${result.error.code}); no Developer Skill is admitted.`;
	}
	const { bound, unavailable, excluded } = result.value.summary;
	const capabilityLines = [
		...result.value.boundCapabilitiesBySkillName.entries(),
	]
		.sort(([left], [right]) => left.localeCompare(right))
		.flatMap(([name, entry]) => {
			const capability = entry.capability;
			return "toc" in capability
				? [
						`Capability ${name} · ${capability.capabilityRevisionId} · structured`,
						`  when: ${capability.toc.when.join(" | ")}`,
						`  unless: ${capability.toc.unless.join(" | ") || "none"}`,
						...capability.toc.references.map(
							(reference) =>
								`  reference ${reference.path} when: ${reference.when.join(" | ")}`,
						),
					]
				: [
						`Capability ${name} · ${capability.capabilityRevisionId} · unstructured`,
						"  when/unless: none; matched_when and matched_unless must be empty",
					];
		});
	return [
		`Action Loop capability inventory: ${bound} bound (${unavailable} unavailable, ${excluded} excluded).`,
		...capabilityLines,
	].join("\n");
}
