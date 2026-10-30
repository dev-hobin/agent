# @hobin/review

English | [한국어](./README.ko.md)

Agent Skill for reviewing code changes and bounded scopes through focused perspectives, reporting only verified high-confidence defects.

## Skills

- `reviewing-code`

The Skills follow the [Agent Skills specification](https://agentskills.io/specification);
the package root `plugin.json` follows Agent Plugins 1.0.0 and declares `hobin-review`.
Each Skill directory is self-contained, including its `references/`, `scripts/`, and
`assets/`. `agents/openai.yaml`, where present, is Codex metadata and is ignored by
other hosts.

## Use

Install from the `hobin` marketplace (see the repository's
[installation guide](https://github.com/dev-hobin/agent/blob/main/docs/installation.md)),
then invoke it explicitly: `/hobin-review:reviewing-code` in Claude Code, `$hobin-review:reviewing-code` in Codex.

## License

MIT
