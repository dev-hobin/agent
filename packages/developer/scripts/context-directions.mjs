import {
	judgmentPolicyDirections,
	parseJudgmentAuthoringPolicyJson,
} from "@hobin/judgment";

const SECTION_HEADING = "## Context Directions";
const GENERATED_NOTICE =
	"This section is generated from [judgment.json](judgment.json). The owning skill method remains complete without reading a prepared reference. Root `unless` exclusions win. Each reference is an independent candidate, not a requirement or authority.";

export function renderDeveloperContextDirections(policy) {
	const body = judgmentPolicyDirections(policy).markdown.replace(
		/^## Context Directions\n\n/u,
		"",
	);
	return [SECTION_HEADING, "", GENERATED_NOTICE, "", body].join("\n").trimEnd();
}

export function parseDeveloperJudgmentPolicy(source) {
	return parseJudgmentAuthoringPolicyJson(source);
}

function sectionRange(markdown) {
	const start = markdown.indexOf(`${SECTION_HEADING}\n`);
	if (start < 0) return undefined;
	const next = markdown.indexOf("\n## ", start + SECTION_HEADING.length + 1);
	return { start, end: next < 0 ? markdown.length : next + 1 };
}

export function extractDeveloperContextDirections(markdown) {
	const range = sectionRange(markdown);
	return range ? markdown.slice(range.start, range.end).trimEnd() : undefined;
}

export function replaceDeveloperContextDirections(markdown, section) {
	const current = sectionRange(markdown);
	if (!current) return `${markdown.trimEnd()}\n\n${section}\n`;
	const suffix = markdown.slice(current.end);
	return suffix
		? `${markdown.slice(0, current.start)}${section}\n\n${suffix}`
		: `${markdown.slice(0, current.start)}${section}\n`;
}

export function removeDeveloperContextDirections(markdown) {
	const current = sectionRange(markdown);
	if (!current) return markdown;
	return `${markdown.slice(0, current.start).trimEnd()}\n${markdown.slice(current.end)}`;
}
