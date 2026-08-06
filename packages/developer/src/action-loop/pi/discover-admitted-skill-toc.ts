import {
	discoverTocDescriptor,
	type DiscoveredTocDescriptor,
	type TocDiscoveryError,
} from "../io/discover-skill-toc.ts";
import type { AdaptedPiSkillDescriptor } from "./adapt-skill-catalog.ts";

export type UnstructuredAdaptedSkillReason =
	| "unsupported-skill-material"
	| "descriptor-absent";

export type AdaptedSkillTocDiscoveryResult =
	| {
			readonly status: "structured";
			readonly candidate: AdaptedPiSkillDescriptor;
			readonly descriptor: DiscoveredTocDescriptor;
	  }
	| {
			readonly status: "unstructured";
			readonly reason: UnstructuredAdaptedSkillReason;
			readonly candidate: AdaptedPiSkillDescriptor;
	  }
	| {
			readonly status: "failed";
			readonly candidate: AdaptedPiSkillDescriptor;
			readonly error: TocDiscoveryError;
	  };

/**
 * Discovers a TOC only for one directory-shaped Skill already admitted and
 * refined from Pi's loaded catalog. Direct-file Skills never expose their
 * containing directory as a TOC discovery root.
 */
export async function discoverAdaptedSkillToc(
	candidate: AdaptedPiSkillDescriptor,
): Promise<AdaptedSkillTocDiscoveryResult> {
	if (!candidate.supportsStructuredToc) {
		return Object.freeze({
			status: "unstructured",
			reason: "unsupported-skill-material",
			candidate,
		});
	}

	const discovered = await discoverTocDescriptor(candidate.skillRootPath);
	if (discovered.status === "structured") {
		return Object.freeze({
			status: "structured",
			candidate,
			descriptor: discovered.descriptor,
		});
	}
	if (discovered.status === "failed") {
		return Object.freeze({
			status: "failed",
			candidate,
			error: discovered.error,
		});
	}
	return Object.freeze({
		status: "unstructured",
		reason: "descriptor-absent",
		candidate,
	});
}
