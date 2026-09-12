# @hobin/developer

English | [한국어](./README.ko.md)

Engineering judgment Skills and conditional References for Pi.

## Why

Experienced developers rarely recall every design rule at once. They keep a small set of judgment frames in mind—what kind of problem this is and what should happen next—then consult detailed material when the concrete situation calls for it.

`@hobin/developer` brings that working intuition into Pi as reviewable Skills and References. A Skill keeps the core judgment method available. Its References hold details that matter only under particular conditions, so the model can bring in the parts that fit the current problem instead of carrying a large engineering textbook into every task.

This is progressive context, not a fixed workflow. A task may need no supporting Reference, one Reference, or several at the same time.

## Install

Requires [Pi](https://pi.dev) and Node.js 22.19 or newer.

```sh
pi install npm:@hobin/developer
```

Try it for one run:

```sh
pi -e npm:@hobin/developer
```

## Use

Ask Pi normally. It can select a matching Skill from its standard Skill catalog.

```text
Clarify what must remain true before implementing this requirement.
Model the unresolved conditions and forbidden states behind this bug.
Shape an implementable design before writing the code.
Decide whether this repeated structure is ready to become an abstraction.
Verify which completion claims the current evidence actually supports.
```

You can also invoke a Skill directly with `/skill:<name>`.

## What it provides

- 17 independent engineering judgment Skills
- detailed References associated with the conditions where they matter
- one passive Skill References disclosure Extension

The Skills cover different kinds of engineering judgment. They are not mandatory phases and do not form one pipeline. Use the one that matches the decision in front of you, and stop when its result is sufficient.

## How context stays focused

1. Pi discovers Skill names and descriptions through its normal Skill system.
2. The model or user selects a Skill, and Pi loads its `SKILL.md` as the working method.
3. The Extension discloses that Skill's sibling `references.json` as hidden selection metadata.
4. The model interprets the conditions in the context of the selected Skill.
5. It reads only the materially applicable Reference bodies through Pi's normal `read` Tool. More than one Reference may apply, and none may be needed.

The Extension does **not** choose References, read Reference bodies, or replace Pi's Skill selection. It only makes the selected Skill's reference metadata available to the model.

## Skill References disclosure

For any Skill already discovered by Pi—whether supplied by this package, another package, a global Skill directory, or a trusted project—the Extension checks the exact sibling `references.json` after either:

- a successful `read` of that Skill's `SKILL.md`; or
- `/skill:name` expansion before the agent starts.

A syntactically valid file no larger than 32 KiB is delivered to the model as non-displayed selection metadata. The original Skill read result and Pi's native TUI rendering remain unchanged. Any Reference the model actually reads appears through Pi's ordinary `read` Tool UI. Missing, malformed, oversized, or unreadable files are silent no-ops and never affect a successful Skill read.

Developer's own `references.json` files are separately validated against the repository's retained schema during package checks.

## Boundaries

Developer does not replace Pi's agent loop and has no on/off mode, phase state, custom Tool, fixed workflow protocol, verifier, or persistence layer. Installed Skills use Pi's normal discovery and progressive disclosure behavior.

## Resource control

Use Pi's package configuration to enable or filter package resources.

Disable the Extension while keeping the Skills:

```json
{
  "packages": [
    {
      "source": "npm:@hobin/developer",
      "extensions": []
    }
  ]
}
```

Disable the Skills while keeping generic Skill References disclosure:

```json
{
  "packages": [
    {
      "source": "npm:@hobin/developer",
      "skills": []
    }
  ]
}
```

## Checks

```sh
pnpm install --frozen-lockfile
pnpm check
```

The checks are provider-free. They cover Skill discovery, static Skill References validation, runtime disclosure behavior, and packed package contents.

## License

[MIT](./LICENSE)
