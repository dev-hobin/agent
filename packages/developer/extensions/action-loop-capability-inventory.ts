import { realpath } from "node:fs/promises";
import { resolve } from "node:path";
import type {
	BeforeAgentStartEvent,
	Skill,
} from "@earendil-works/pi-coding-agent";
import {
	bindPiCapabilityInventory,
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

	const boundSkillPaths = new Set<string>();
	let bound = 0;
	for (const entry of inventory.entries) {
		if (entry.status !== "bound") continue;
		bound += 1;
		boundSkillPaths.add(entry.candidate.skillFilePath);
	}
	const admittedPackageSkills = new Map<string, Skill>();
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
		if (!boundSkillPaths.has(canonicalPath) || ambiguousNames.has(skill.name)) {
			continue;
		}
		if (admittedPackageSkills.has(skill.name)) {
			admittedPackageSkills.delete(skill.name);
			ambiguousNames.add(skill.name);
			continue;
		}
		admittedPackageSkills.set(skill.name, skill);
	}
	return Object.freeze({
		status: "ready",
		value: Object.freeze({
			inventory,
			availablePackageSkills: admittedPackageSkills,
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
	return `Action Loop capability inventory: ${bound} bound (${unavailable} unavailable, ${excluded} excluded).`;
}
