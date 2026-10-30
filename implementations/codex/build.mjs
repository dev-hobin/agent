// Codex implementation: renders a core capability as a native Codex plugin.
// Follows the host contract in HOST.md: a root Agent Plugins plugin.json with
// extensions.com.openai, a skill with only the fields Codex reads plus agents/openai.yaml
// for interface and invocation policy, delegation written as subagent instructions
// (plugins cannot ship agents), and plugin-eval benchmark configs for the contract.
import { expectationKind, fill, presentChangeAsDiff, presentChangeSentence, yamlString } from "../lib.mjs";

// How strongly this implementation meets each core guarantee (see capability.yaml).
export const conformance = {
	"explicit-invocation": { level: "enforced", by: "agents/openai.yaml policy.allow_implicit_invocation: false" },
	"no-code-changes": { level: "instructed", by: "the skill writes only its report and tells subagents not to edit; checked by the contract" },
	"verified-findings": { level: "instructed", by: "the procedure's verify step and fixed format; checked by the contract" },
};

const author = { name: "dev-hobin", url: "https://github.com/dev-hobin" };

function skillMarkdown(cap) {
	const front = [
		"---",
		`name: ${cap.id}`,
		`description: ${yamlString(cap.description)}`,
		"metadata:",
		`  short-description: ${yamlString(cap.short)}`,
		"---",
		"",
		"",
	].join("\n");
	return front + fill(cap.skill, {
		context_command: `\`sh <this skill's directory>/${cap.scripts[0].file} ${cap.scripts[0].usage}\``,
		perspective_list: cap.perspectives.map((p) => `   - [${p.id}](references/perspectives/${p.id}.md): ${p.summary}`).join("\n"),
		delegate: "spawn one subagent per selected perspective and wait for all of them. Give\n"
			+ "   each the instructions in [references/reviewer.md](references/reviewer.md), the path\n"
			+ "   of its perspective file, the review target, and the context from step 2. Subagents\n"
			+ "   share your sandbox, so tell each one not to edit files.",
	});
}

function openaiYaml(cap) {
	return [
		"interface:",
		`  display_name: ${yamlString(cap.title)}`,
		`  short_description: ${yamlString(cap.short)}`,
		`  default_prompt: ${yamlString(`Use $${cap.plugin}:${cap.id} to review this branch against main.`)}`,
		"policy:",
		`  allow_implicit_invocation: ${cap.invocation === "explicit" ? "false" : "true"}`,
		"",
	].join("\n");
}

// plugin-eval runs each verifier command in the workspace after the run; the core contract
// checker evaluates the file-based expectations. Trace-based expectations have no verifier
// hook in plugin-eval, so they are listed as notes instead of being silently dropped.
function benchmark(cap, c) {
	const caseFile = `core/${cap.dir.split("/").pop()}/contract/${c.id}/case.yaml`;
	const presented = `dist/codex/evals/${cap.plugin}/${c.id}/workspace`;
	const traceOnly = c.expect.filter((e) => expectationKind(e) === "ran_command").map((e) => e.id);
	return JSON.stringify({
		kind: "plugin-eval-benchmark",
		targetKind: "plugin",
		targetName: cap.plugin,
		runner: { type: "codex-cli", model: "gpt-5.4", sandbox: "workspace-write", approvalPolicy: "never", extraArgs: [] },
		workspace: { sourcePath: presented, setupMode: "copy", preserve: "on-failure" },
		targetProvisioning: { mode: "workspace-plugin-marketplace" },
		verifiers: { commands: [`node "$HOBIN_AGENT_ROOT/scripts/contract-check.mjs" "$HOBIN_AGENT_ROOT/${caseFile}" "$HOBIN_AGENT_ROOT/${presented}" .`] },
		notes: [
			"Run from the repository root with HOBIN_AGENT_ROOT set to it; pass -m to choose the model.",
			...(traceOnly.length ? [`Not checked by plugin-eval (needs the run trace): ${traceOnly.join(", ")}`] : []),
		],
		scenarios: [{ id: c.id, title: c.id, purpose: "Contract test from core", userInput: `${cap.invocation === "explicit" ? `$${cap.plugin}:${cap.id} ` : ""}${presentChangeSentence}${c.request}`,
			successChecklist: c.expect.map((e) => e.id) }],
	}, null, 2) + "\n";
}

export function build(cap) {
	const out = {};
	const root = cap.plugin;
	out[`${root}/plugin.json`] = JSON.stringify({
		$schema: "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
		name: cap.plugin, version: cap.version, description: cap.summary, author, license: "MIT",
		homepage: "https://github.com/dev-hobin/agent", repository: "https://github.com/dev-hobin/agent", keywords: ["code-review"],
		extensions: { "com.openai": { interface: { displayName: cap.title, shortDescription: cap.short, developerName: "dev-hobin",
			defaultPrompt: [`Use $${cap.plugin}:${cap.id} to review this branch against main.`] } } },
	}, null, 2) + "\n";
	const skill = `${root}/skills/${cap.id}`;
	out[`${skill}/SKILL.md`] = skillMarkdown(cap);
	out[`${skill}/agents/openai.yaml`] = openaiYaml(cap);
	out[`${skill}/references/reviewer.md`] = cap.reviewer;
	for (const p of cap.perspectives) out[`${skill}/references/perspectives/${p.id}.md`] = p.body;
	for (const s of cap.scripts) out[`${skill}/${s.file}`] = { copy: `${cap.dir}/${s.file}`, mode: 0o755 };
	for (const c of cap.contract) {
		out[`evals/${cap.plugin}/${c.id}/benchmark.json`] = benchmark(cap, c);
		out[`evals/${cap.plugin}/${c.id}/workspace`] = presentChangeAsDiff(c);
	}
	return out;
}
