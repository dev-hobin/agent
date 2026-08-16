# @hobin/developer

Composable engineering method Skills for Pi.

## Install

```sh
pi install npm:@hobin/developer
```

## What it provides

- 17 progressively disclosed engineering method Skills and their References
- one passive Skill References disclosure Extension

Developer does not replace Pi's agent loop and has no on/off mode, phase state, custom Tool, workflow protocol, verifier, or persistence layer. Installed Skills appear in Pi's normal Skill catalog and are loaded only when the model or user selects them.

## Skill References disclosure

For any Skill already discovered by Pi—whether supplied by this package, another package, a global Skill directory, or a trusted project—the Extension checks the exact sibling `references.json` after either:

- a successful `read` of that Skill's `SKILL.md`; or
- `/skill:name` expansion before the agent starts.

A syntactically valid file no larger than 32 KiB is delivered to the model as non-displayed selection metadata. The original Skill read result and Pi's native TUI rendering remain unchanged. The Extension does not validate external Skill References against Developer's schema, select individual References, or read Reference bodies; any Reference the model actually reads appears through Pi's ordinary `read` Tool UI. Missing, malformed, oversized, or unreadable files are silent no-ops and never affect a successful Skill read.

Developer's own `references.json` files are separately validated against the repository's retained schema during package checks.

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
