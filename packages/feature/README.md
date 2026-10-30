# @hobin/feature

English | [한국어](./README.ko.md)

Agent Skill for developing features through acceptance scenarios, owner decisions, design, small verified slices, and independent verification.

## Skills

- `developing-features`

The Skills follow the [Agent Skills specification](https://agentskills.io/specification);
the package root `plugin.json` follows Agent Plugins 1.0.0 and declares `hobin-feature`.
Each Skill directory is self-contained, including its `references/`, `scripts/`, and
`assets/`. `agents/openai.yaml`, where present, is Codex metadata and is ignored by
other hosts.

## Use

Install from the `hobin` marketplace (see the repository's
[installation guide](https://github.com/dev-hobin/agent/blob/main/docs/installation.md)),
then invoke it explicitly: `/hobin-feature:developing-features` in Claude Code, `$hobin-feature:developing-features` in Codex.

## License

MIT
