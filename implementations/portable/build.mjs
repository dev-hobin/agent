// Portable implementation: a plain Agent Skills directory for hosts without a dedicated
// implementation. Only specification fields; delegation is described for any host and
// falls back to reviewing perspectives one after another.
import { fill, yamlString } from "../lib.mjs";

export function build(cap) {
	const out = {};
	const skill = cap.id;
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
		delegate: "If your host can start subagents, start one per selected perspective in\n"
			+ "   parallel and give each [references/reviewer.md](references/reviewer.md), its\n"
			+ "   perspective file, the review target, and the context from step 2. Otherwise review\n"
			+ "   the perspectives one after another, following references/reviewer.md for each.",
	});
	out[`${skill}/references/reviewer.md`] = cap.reviewer;
	for (const p of cap.perspectives) out[`${skill}/references/perspectives/${p.id}.md`] = p.body;
	for (const s of cap.scripts) out[`${skill}/${s.file}`] = { copy: `${cap.dir}/${s.file}`, mode: 0o755 };
	return out;
}
