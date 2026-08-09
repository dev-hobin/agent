import type { BeforeAgentStartEvent } from "@earendil-works/pi-coding-agent";
import {
	adaptPiSkillCatalog,
	type PiSkillCatalogError,
	type PiSkillCatalogExclusion,
} from "./adapt-skill-catalog.ts";
import {
	discoverAdaptedSkillToc,
	type AdaptedSkillTocDiscoveryResult,
} from "./discover-admitted-skill-toc.ts";

export type CataloguedPiSkillEntry = AdaptedSkillTocDiscoveryResult;

export interface UnavailablePiSkillEntry {
	readonly label: string;
	readonly skillFilePath: string;
	readonly error: PiSkillCatalogError;
}

export type StructuredCataloguedPiSkillEntry = Extract<
	CataloguedPiSkillEntry,
	{ readonly status: "structured" }
>;

export type BeforeAgentStartSkillCatalogResult =
	| {
			readonly status: "catalogued";
			readonly entries: readonly CataloguedPiSkillEntry[];
			readonly excluded: readonly PiSkillCatalogExclusion[];
			readonly unavailable: readonly UnavailablePiSkillEntry[];
	  }
	| {
			readonly status: "rejected";
			readonly error: PiSkillCatalogError;
	  };

/**
 * Translates only Pi's current before_agent_start Skill catalog into
 * source-bound discovery outcomes. It does not inspect cwd or modify the host
 * event, system prompt, session, or tools.
 */
export async function catalogBeforeAgentStartSkills(
	event: Pick<BeforeAgentStartEvent, "systemPromptOptions">,
): Promise<BeforeAgentStartSkillCatalogResult> {
	const candidates: Array<{
		readonly index: number;
		readonly candidate: Parameters<typeof discoverAdaptedSkillToc>[0];
	}> = [];
	const excluded: PiSkillCatalogExclusion[] = [];
	const unavailable: UnavailablePiSkillEntry[] = [];
	const skills = event.systemPromptOptions.skills ?? [];
	for (let index = 0; index < skills.length; index += 1) {
		const skill = skills[index];
		if (skill === undefined) {
			return Object.freeze({
				status: "rejected",
				error: Object.freeze({
					code: "invalid-skill",
					index,
					path: `skills[${index}]`,
					message: "Pi Skill catalog contains an empty entry",
				}),
			});
		}
		const adapted = await adaptPiSkillCatalog([skill]);
		if (!adapted.ok) {
			unavailable.push(
				Object.freeze({
					label: skill.name,
					skillFilePath: skill.filePath,
					error: Object.freeze({
						...adapted.error,
						index,
						path: adapted.error.path.replace("skills[0]", `skills[${index}]`),
					}),
				}),
			);
			continue;
		}
		excluded.push(...adapted.excluded);
		const candidate = adapted.inventory[0];
		if (candidate) candidates.push({ index, candidate });
	}

	const occurrences = new Map<string, typeof candidates>();
	for (const current of candidates) {
		const key = [
			current.candidate.source.kind,
			current.candidate.source.locator,
			current.candidate.source.skillRoot,
		].join("\0");
		occurrences.set(key, [...(occurrences.get(key) ?? []), current]);
	}
	const uniqueCandidates: typeof candidates = [];
	for (const occurrence of occurrences.values()) {
		const first = occurrence[0];
		if (occurrence.length === 1 && first !== undefined) {
			uniqueCandidates.push(first);
			continue;
		}
		for (const duplicate of occurrence) {
			unavailable.push(
				Object.freeze({
					label: duplicate.candidate.label,
					skillFilePath: duplicate.candidate.skillFilePath,
					error: Object.freeze({
						code: "duplicate-occurrence",
						index: duplicate.index,
						path: `skills[${duplicate.index}]`,
						message: "Pi Skill catalog repeats one source-bound occurrence",
					}),
				}),
			);
		}
	}

	const entries: CataloguedPiSkillEntry[] = [];
	for (const { candidate } of uniqueCandidates.sort(
		(left, right) => left.index - right.index,
	)) {
		entries.push(await discoverAdaptedSkillToc(candidate));
	}
	return Object.freeze({
		status: "catalogued",
		entries: Object.freeze(entries),
		excluded: Object.freeze(excluded),
		unavailable: Object.freeze(
			unavailable.sort((left, right) => left.error.index - right.error.index),
		),
	});
}
