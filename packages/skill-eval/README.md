# @hobin/skill-eval

English | [한국어](./README.ko.md)

Agent Skill for trigger and outcome evaluations of Agent Skills with with-skill, without-skill, and length-matched control comparisons.

## Skills

- `evaluating-skills`

The Skills follow the [Agent Skills specification](https://agentskills.io/specification);
the package root `plugin.json` follows Agent Plugins 1.0.0 and declares `hobin-skill-eval`.
Each Skill directory is self-contained, including its `references/`, `scripts/`, and
`assets/`. `agents/openai.yaml`, where present, is Codex metadata and is ignored by
other hosts.

## Use

Install from the `hobin` marketplace (see the repository's
[installation guide](https://github.com/dev-hobin/agent/blob/main/docs/installation.md)),
then invoke it explicitly: `/hobin-skill-eval:evaluating-skills` in Claude Code, `$hobin-skill-eval:evaluating-skills` in Codex.

## License

MIT
