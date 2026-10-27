# @hobin/developer

English | [한국어](./README.ko.md)

Engineering judgment methods following the
[Agent Skills specification](https://agentskills.io/specification), with
conditional supporting references and optional host integrations.

## Why

Experienced developers rarely recall every design rule at once. They keep a
small set of judgment frames in mind—what kind of problem this is and what
should happen next—then consult detailed material when the concrete situation
calls for it.

`@hobin/developer` brings that working intuition into reviewable Skills and
References. A Skill keeps the core judgment method available. Its References
hold details that matter only under particular conditions, so the model can
bring in the parts that fit the current problem instead of carrying a large
engineering textbook into every task.

This is progressive context, not a fixed workflow. A task may need no supporting
Reference, one Reference, or several at the same time.

## Portable Skills

The canonical resources are the 17 directories under `skills/`. Install or expose
each **whole directory**, including `references.json` and `references/` when
present, through your Agent Skills host's discovery mechanism. Reading these
instruction-only bundles does not require Pi or Node.js.

The root `plugin.json` follows Agent Plugins 1.0.0 and declares `hobin-developer`.
Prefer the native plugin installation below for persistent, package-qualified
Skills in Claude or Codex. Individual flat Skill installation remains optional;
it does not apply plugin namespaces. Host paths and invocation syntax are not
part of the Skill format. No per-host method copies or custom loader are needed.

Developer does not provide an agent loop, on/off mode, phase state, custom Tool,
runtime verifier, workflow protocol, or persistence layer. The host or user
selects a Skill; its `SKILL.md` owns its method, boundaries, result, and stop
condition. Skills are independent judgments, not mandatory phases of a pipeline.

## Use

Ask your agent normally. It can select a matching Skill from its catalog:

```text
Clarify what must remain true before implementing this requirement.
Model the unresolved conditions and forbidden states behind this bug.
Shape an implementable design before writing the code.
Decide whether this repeated structure is ready to become an abstraction.
Verify which completion claims the current evidence actually supports.
```

Explicit invocation is host-specific: for example, `/hobin-developer:specify`
in Claude plugin mode, `$hobin-developer:specify` in Codex plugin mode, or
`/skill:specify` in Pi.

## Native plugin installation

Use a checkout containing the prepared 0.2.2 manifests and catalogs; this version
is not yet published. Register the **resource checkout** from any directory, not
a selected work project.

Claude Code, for your user across projects:

```sh
claude plugin marketplace add /absolute/path/to/agent --scope user
claude plugin install hobin-developer@hobin-agent --scope user
```

Codex, using its native user installation:

```sh
codex plugin marketplace add /absolute/path/to/agent
codex plugin add hobin-developer@hobin-agent
```

Start a new session. Use `/hobin-developer:model` in Claude or
`$hobin-developer:model` in Codex instead of an unqualified Skill name.
`.claude-plugin/plugin.json` is synchronized legacy Claude metadata, not the
portable source of truth. Both routes use the same `skills/` directory.

`claude --plugin-dir /absolute/path/to/agent/packages/developer` is a session-only
development shortcut, not persistent installation. Ordinary flat `skills add`
does not apply plugin namespaces or remove existing copies. See
[installation and exercised evidence](https://github.com/dev-hobin/agent/blob/main/docs/installation.md)
and [Claude collision boundaries](https://github.com/dev-hobin/agent/blob/main/docs/claude-plugins.md).

## Conditional supporting material

A Skill's core method is complete without prepared references. For Skills that
have `references.json`, the instructions tell the agent to inspect that sibling
file unless the host already supplied bounded metadata for the invocation.
Exclusions win, and the agent reads only references that materially apply.
Relative paths start at the Skill directory, not the task's working directory.

`references.json` and its `when`/`unless` meaning are our own convention, not an
Agent Skills feature that hosts must natively interpret. See the repository's
[standards register](https://github.com/dev-hobin/agent/blob/main/docs/standards.md)
and [reference contract](https://github.com/dev-hobin/agent/blob/main/docs/skill-references.md).
Our packaged metadata is checked against the retained JSON Schema during
authoring; selection remains model behavior rather than enforced access control.

## Optional Pi adapter

Existing installation remains supported. This adapter requires Pi and Node.js
22.19 or newer:

```sh
pi install npm:@hobin/developer
# Or try for one run:
pi -e npm:@hobin/developer
```

`adapters/pi/skill-references/index.js` passively discloses reference metadata.
For a Skill already discovered by Pi, from any package or trusted Skill location,
it checks the exact sibling `references.json` after either:

- a successful `read` of `SKILL.md`; or
- `/skill:name` expansion before the agent starts.

Syntactically valid JSON no larger than 32 KiB is supplied as non-displayed
selection metadata. The native read result and TUI rendering are unchanged. The
adapter does not validate external metadata against our schema, select a
reference, or read its body. Missing, malformed, oversized, or unreadable files
are silent no-ops.

The normal Skill-directed file-reading path works without this adapter.
Package-based installation is unchanged; manually configured source paths must
change from `extensions/skill-references/index.js` to
`adapters/pi/skill-references/index.js`.

### Pi resource control

Disable the adapter while retaining Skills:

```json
{
  "packages": [
    { "source": "npm:@hobin/developer", "extensions": [] }
  ]
}
```

Disable the Skills while retaining generic metadata disclosure:

```json
{
  "packages": [
    { "source": "npm:@hobin/developer", "skills": [] }
  ]
}
```

## Development checks

From the repository root, after the root README's authoring setup:

```sh
pnpm check:portable
pnpm --filter @hobin/developer check:pi
# Optional, with Claude Code installed:
pnpm check:claude
```

Portable checks cover both upstream formats, our metadata/catalog conventions,
and actual packed/relocated bundles without a host executable. The optional
`pnpm check:install -- claude` or `pnpm check:install -- codex` uses temporary
HOME/config and real native installation without a model call. Pi checks retain
native discovery and passive disclosure. None proves live-model selection quality.

## License

[MIT](./LICENSE)
