import {
	judgmentPolicyDirections,
	parseJudgmentAuthoringPolicyJson,
} from "@hobin/judgment";

const SECTION_HEADING = "## Context Directions";
const GENERATED_NOTICE =
	"This section is generated from [judgment.json](judgment.json). The skill's core method remains complete without a prepared reference. Root `unless` exclusions win. Read zero, one, or several references only when their independent conditions can materially change the learning result.";

export function renderLearningContextDirections(policy) {
	const body = judgmentPolicyDirections(policy).markdown.replace(
		/^## Context Directions\n\n/u,
		"",
	);
	return [SECTION_HEADING, "", GENERATED_NOTICE, "", body].join("\n").trimEnd();
}

export function parseLearningJudgmentPolicy(source) {
	return parseJudgmentAuthoringPolicyJson(source);
}

function sectionRange(markdown) {
	const start = markdown.indexOf(`${SECTION_HEADING}\n`);
	if (start < 0) return undefined;
	const next = markdown.indexOf("\n## ", start + SECTION_HEADING.length + 1);
	return { start, end: next < 0 ? markdown.length : next + 1 };
}
export function extractLearningContextDirections(markdown) {
	const range = sectionRange(markdown);
	return range ? markdown.slice(range.start, range.end).trimEnd() : undefined;
}
export function replaceLearningContextDirections(markdown, section) {
	const current = sectionRange(markdown);
	if (!current) throw new Error("SKILL.md has no Context Directions section.");
	return `${markdown.slice(0, current.start)}${section}\n\n${markdown.slice(current.end)}`;
}
