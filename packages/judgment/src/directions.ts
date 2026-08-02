import type { JudgmentAuthoringPolicy } from "./authoring.ts";
import type { CompiledJudgmentPolicy } from "./compiled-policy.ts";

export interface JudgmentPolicyDirections {
	readonly markdown: string;
}

function list(items: readonly string[]): string {
	return items.map((item) => `- ${item}`).join("\n");
}

export function judgmentPolicyDirections(
	policy: JudgmentAuthoringPolicy | CompiledJudgmentPolicy,
): JudgmentPolicyDirections {
	const references = policy.references.flatMap((reference) => [
		`### \`${reference.path}\``,
		"",
		list(reference.when),
		"",
	]);
	const markdown = [
		"## Context Directions",
		"",
		"Use the owning capability when at least one condition applies:",
		"",
		list(policy.when),
		"",
		"Do not use it when any exclusion applies; these exclusions win:",
		"",
		list(policy.unless),
		"",
		"Prepared references are independent candidates, never requirements or authority:",
		"",
		...references,
	]
		.join("\n")
		.trimEnd();
	return Object.freeze({ markdown });
}
