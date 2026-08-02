# Policy authoring

English | [한국어](./ko/policy-authoring.md)

A `judgment.json` file answers two narrow questions for its owning capability:

1. When does this capability apply, and what explicit cases exclude it?
2. When can each packaged reference add something the capability method does not
   already provide?

It does not define runtime questions, routes, source rankings, assurance, or
mutation permission.

## Complete example

```json
{
  "$schema": "https://raw.githubusercontent.com/dev-hobin/agent/main/packages/judgment/schemas/judgment-authoring.schema.json",
  "specVersion": "0.1",
  "when": [
    "Caller-facing operations, ownership, data flow, or implementation shape still need to be invented."
  ],
  "unless": [
    "A concrete candidate already exists and only its stability must be reviewed.",
    "The unresolved issue is product meaning rather than implementation shape."
  ],
  "references": [
    {
      "path": "references/meaning-preserving-conversions.md",
      "when": [
        "A cross-representation design needs explicit preserved-observer, loss, ambiguity, cycle, or unsupported-path checks."
      ]
    },
    {
      "path": "references/design-levels-and-boundaries.md",
      "when": [
        "A design needs an explicit caller vocabulary, owner, hidden mechanism, or dependency direction."
      ]
    }
  ]
}
```

The machine-readable schema is available as `@hobin/judgment/schema` and at
[`../schemas/judgment-authoring.schema.json`](../schemas/judgment-authoring.schema.json).

## How applicability is decided

A capability is applicable when at least one root `when` statement materially
matches and no root `unless` statement matches. `unless` wins when both match.

If the current evidence is not enough to decide, the runtime result should be
`needs-context`. Do not turn uncertainty into an `unless` statement.

Examples:

```text
when:   Caller-facing data flow still needs a design.
unless: A concrete interface already exists and only needs review.
```

The first statement says what work the capability owns. The second sends an
already-shaped candidate to a different capability.

## Write references as independent choices

Each `references[]` entry is considered separately. A match makes the file
eligible; it does not make the file mandatory or authoritative.

A useful `references[].when` names both the visible pressure and the distinction
the file can add.

Too broad:

```text
When conversions are involved.
```

Useful:

```text
A cross-representation design needs explicit checks for preserved observers,
loss, ambiguity, cycles, and unsupported paths.
```

If the current specification or evidence already supplies that distinction, the
adapter may skip the packaged reference.

## Fields

| Field | Rule |
| --- | --- |
| `$schema` | Optional editor hint; excluded from semantic policy identity |
| `specVersion` | Required; currently exactly `"0.1"` |
| `when` | One or more positive applicability statements |
| `unless` | Explicit exclusions that override `when` |
| `references` | One or more independently selectable local files |
| `references[].path` | Normalized relative POSIX path from the policy directory |
| `references[].when` | One or more complete relevance statements for that file |

The policy has no owner field. The adapter derives the owner from the Skill or
supplies another typed capability identity, and the compiler binds it to the
policy.

## When no policy is needed

Do not create `judgment.json` merely to say that a Skill exists. If the Skill has
no conditional packaged references, its method can stand alone.

```text
file absent            -> normal capability, no prepared references
file present and valid -> compiled owner-bound policy
file present but invalid -> reject that source
```

Malformed presence must never be treated as absence.

## Path safety

A reference path must be relative, use `/`, contain no empty, `.` or `..`
segments, remain under the policy root after `realpath`, and identify a regular
file. The parser checks the path shape; Node acquisition checks the physical
filesystem before reading.

## Check a policy

```sh
judgment check skills/example/judgment.json
judgment explain skills/example/judgment.json
judgment compile skills/example/judgment.json
```

- `check` parses the file and prints its canonical authoring hash.
- `explain` shows the deterministic conditions a model will see.
- `compile` binds a CLI owner and emits canonical compiled JSON.

Package checks should also confirm that every reference exists and that generated
model-visible directions still match the policy.
