// Portable implementation: a plain Agent Skills directory for hosts without a dedicated
// implementation. Only specification fields; delegation is described for any host and
// falls back to reviewing perspectives one after another.
import { fill, yamlString } from "../lib.mjs";

// How strongly this implementation meets each core guarantee (see capability.yaml).
export const conformance = {
	"explicit-invocation": { level: "unsupported", by: "no standard field; hosts may select the skill on their own" },
	"no-code-changes": { level: "instructed", by: "the skill writes only its report" },
	"verified-findings": { level: "instructed", by: "the procedure's verify step and fixed format" },
};

export function build(cap) {
	const out = {};
	const skill = `skills/${cap.id}`;
	out[`${skill}/SKILL.md`] = [
		"---",
		`name: ${cap.id}`,
		`description: ${yamlString(cap.description)}`,
		"metadata:",
		`  version: ${yamlString(cap.version)}`,
		"---",
		"",
		"",
	].join("\n") + fill(cap.skill, {
		context_command: `\`sh <this skill's directory>/${cap.scripts[0].file} ${cap.scripts[0].usage}\``,
		perspective_list: cap.perspectives.map((p) => `   - [${p.id}](references/perspectives/${p.id}.md): ${p.summary}`).join("\n"),
		delegate: "start one subagent per selected perspective if your host can, and give\n"
			+ "   each [references/reviewer.md](references/reviewer.md), its perspective file, the\n"
			+ "   review target, and the context from step 2.",
	});
	out[`${skill}/references/reviewer.md`] = cap.reviewer;
	for (const p of cap.perspectives) out[`${skill}/references/perspectives/${p.id}.md`] = p.body;
	for (const s of cap.scripts) out[`${skill}/${s.file}`] = { copy: `${cap.dir}/${s.file}`, mode: 0o755 };
	return out;
}
