import { realpathSync } from "node:fs";
import { realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
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

function isWithinRoot(root: string, path: string): boolean {
	const canonical = (value: string) => {
		try {
			return realpathSync.native(value);
		} catch {
			return resolve(value);
		}
	};
	const relation = relative(canonical(root), canonical(path));
	return (
		relation === "" || (!relation.startsWith("..") && !isAbsolute(relation))
	);
}

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
 * Capabilities into the canonical Action Loop protocol.
 */
export async function prepareLiveCapabilityInventory(
	event: Pick<BeforeAgentStartEvent, "systemPromptOptions">,
	skillsRoot: string,
): Promise<LiveCapabilityInventoryResult> {
	const catalog = await catalogBeforeAgentStartSkills(event);
	if (catalog.status === "rejected") return catalog;
	const unavailablePackageSkill = catalog.unavailable.find((entry) =>
		isWithinRoot(skillsRoot, entry.skillFilePath),
	);
	if (unavailablePackageSkill) {
		return Object.freeze({
			status: "rejected" as const,
			error: unavailablePackageSkill.error,
		});
	}
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
				unavailable:
					inventory.entries.length - bound + inventory.unavailable.length,
				excluded: inventory.excluded.length,
			}),
		}),
	});
}
