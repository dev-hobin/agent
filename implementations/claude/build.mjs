// Claude Code implementation: renders a core capability as a native Claude Code plugin.
// Follows the host contract in HOST.md: an explicit-only skill (disable-model-invocation),
// one plugin subagent per perspective dispatched in parallel through the Agent tool,
// bundled scripts pre-approved through allowed-tools, and `claude plugin eval` cases.
import { expectationKind, fill, yamlString } from "../lib.mjs";

const author = { name: "dev-hobin", url: "https://github.com/dev-hobin" };

function agentName(perspective) {
	return `${perspective.id}-reviewer`;
}

function skillMarkdown(cap) {
	const agents = cap.perspectives.map((p) => `${cap.plugin}:${agentName(p)}`);
	const front = [
		"---",
		`name: ${cap.id}`,
		`description: ${yamlString(cap.description)}`,
		`argument-hint: ${yamlString(cap.argument)}`,
		...(cap.invocation === "explicit" ? ["disable-model-invocation: true"] : []),
		"allowed-tools:",
		...cap.scripts.map((s) => `  - ${yamlString(`Bash(\${CLAUDE_SKILL_DIR}/${s.file} *)`)}`),
		`  - ${yamlString(`Agent(${agents.join(", ")})`)}`,
		"---",
		"",
		"",
	].join("\n");
	const body = fill(cap.skill, {
		context_command: `\`\${CLAUDE_SKILL_DIR}/${cap.scripts[0].file} ${cap.scripts[0].usage}\``,
		perspective_list: cap.perspectives.map((p) => `   - **${p.id}** (\`${cap.plugin}:${agentName(p)}\`): ${p.summary}`).join("\n"),
		delegate: "In a single message, dispatch the reviewer agent of every selected perspective\n"
			+ "   with the Agent tool so they run in parallel. Give each the review target and the\n"
			+ "   context from step 2. The reviewers have read-only tools and return candidate\n"
			+ "   findings only.",
	});
	return front + body.replace("## Procedure\n", "## Procedure\n\nReview target: $ARGUMENTS\n");
}

function agentMarkdown(cap, p) {
	return [
		"---",
		`name: ${agentName(p)}`,
		`description: ${yamlString(`Reviews a code change from the ${p.id} perspective (${p.summary}) and returns candidate findings. Dispatched by the ${cap.id} skill; not for direct invocation.`)}`,
		"model: inherit",
		`tools: ${cap.delegation.read_only ? "Read, Grep, Glob, Bash" : "Read, Grep, Glob, Bash, Edit, Write"}`,
		"---",
		"",
		cap.reviewer.trim(),
		"",
		"## Perspective",
		"",
		p.body.trim().replace(/^# /, "### "),
		"",
	].join("\n");
}

// Contract cases become `claude plugin eval` cases with deterministic graders only.
function evalCase(cap, c) {
	const files = {};
	files["case.yaml"] = `schema_version: "1.1"\nname: ${c.id}\ncontext:\n  scaffold_script: scaffold.sh\n`;
	files["scaffold.sh"] = "#!/bin/bash\n# Seed the workspace with the contract fixture.\nset -euo pipefail\ncp -R \"$(cd \"$(dirname \"$0\")\" && pwd)/workspace/.\" .\n";
	const invoke = cap.invocation === "explicit" ? `/${cap.plugin}:${cap.id} ` : "";
	files["prompt.md"] = `---\ntags: [${(c.tags ?? []).join(", ")}]\nmax_turns: 60\ntimeout_seconds: 1200\nallowed_tools: [Read, Glob, Grep, Agent, Bash, Write]\n---\n\n${invoke}${c.request}\n`;
	const graders = {};
	for (const e of c.expect) {
		const kind = expectationKind(e), v = e[kind];
		const target = (path) => `target: { source: file, path: ${path} }`;
		if (kind === "file_exists") graders[e.id] = ["type: file_exists", `path: ${yamlString(v)}`];
		else if (kind === "file_matches" || kind === "file_lacks") graders[e.id] = ["type: regex", target(v.path), `pattern: ${yamlString(v.pattern)}`,
			...(v.flags ? [`flags: ${v.flags}`] : []), ...(kind === "file_lacks" ? ["match: not_contains"] : [])];
		else if (kind === "unchanged_except") {
			const allowed = v.map((path) => path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
			graders[e.id] = ["type: tool_used", "tool: Edit", "min: 0", "max: 0", "arm: both"];
			graders[`${e.id}-write`] = ["type: tool_used", "tool: Write", `input_match: ${yamlString(`"file_path"\\s*:\\s*"(?![^"]*/(${allowed})")`)}`, "min: 0", "max: 0", "arm: both"];
		}
		else if (kind === "ran_command") graders[e.id] = ["type: tool_used", "tool: Bash", `input_match: ${yamlString(v)}`];
	}
	graders["reviewers-dispatched"] = ["type: tool_used", "tool: Agent", `input_match: ${yamlString(`${cap.plugin}:`)}`, "arm: with-only"];
	for (const [name, lines] of Object.entries(graders)) files[`graders/${name}.md`] = `---\n${lines.join("\n")}\n---\n`;
	return files;
}

export function build(cap) {
	const out = {};
	const root = cap.plugin;
	out[`${root}/.claude-plugin/plugin.json`] = JSON.stringify({ name: cap.plugin, version: cap.version, description: cap.summary,
		author, homepage: "https://github.com/dev-hobin/agent", repository: "https://github.com/dev-hobin/agent", license: "MIT",
		keywords: ["code-review"] }, null, 2) + "\n";
	out[`${root}/skills/${cap.id}/SKILL.md`] = skillMarkdown(cap);
	for (const s of cap.scripts) out[`${root}/skills/${cap.id}/${s.file}`] = { copy: `${cap.dir}/${s.file}`, mode: 0o755 };
	for (const p of cap.perspectives) out[`${root}/agents/${agentName(p)}.md`] = agentMarkdown(cap, p);
	for (const c of cap.contract) {
		for (const [path, content] of Object.entries(evalCase(cap, c))) {
			out[`${root}/evals/${c.id}/${path}`] = path === "scaffold.sh" ? { text: content, mode: 0o755 } : content;
		}
		out[`${root}/evals/${c.id}/workspace`] = { copyDir: `${c.dir}/workspace` };
	}
	return out;
}
