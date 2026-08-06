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

export type StructuredCataloguedPiSkillEntry = Extract<
	CataloguedPiSkillEntry,
	{ readonly status: "structured" }
>;

export type BeforeAgentStartSkillCatalogResult =
	| {
			readonly status: "catalogued";
			readonly entries: readonly CataloguedPiSkillEntry[];
			readonly excluded: readonly PiSkillCatalogExclusion[];
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
	const adapted = await adaptPiSkillCatalog(
		event.systemPromptOptions.skills ?? [],
	);
	if (!adapted.ok) {
		return Object.freeze({
			status: "rejected",
			error: adapted.error,
		});
	}

	const entries: CataloguedPiSkillEntry[] = [];
	for (const candidate of adapted.inventory) {
		entries.push(await discoverAdaptedSkillToc(candidate));
	}
	return Object.freeze({
		status: "catalogued",
		entries: Object.freeze(entries),
		excluded: adapted.excluded,
	});
}
