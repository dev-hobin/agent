# @hobin/stances

English | [한국어](./README.ko.md)

Agent Skills for installing short engineering stances into agent instructions and promoting repeatedly broken conventions into automatic checks.

## Skills

- `applying-stances`
- `enforcing-conventions`

The Skills follow the [Agent Skills specification](https://agentskills.io/specification);
the package root `plugin.json` follows Agent Plugins 1.0.0 and declares `hobin-stances`.
Each Skill directory is self-contained, including its `references/`, `scripts/`, and
`assets/`. `agents/openai.yaml`, where present, is Codex metadata and is ignored by
other hosts.

## Use

Install from the `hobin` marketplace (see the repository's
[installation guide](https://github.com/dev-hobin/agent/blob/main/docs/installation.md)),
then invoke it explicitly: `/hobin-stances:applying-stances` in Claude Code, `$hobin-stances:applying-stances` in Codex.

## License

MIT
