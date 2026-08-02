# @hobin/judgment

> **Development status:** first-public `0.1.0` remains private pending an
> explicitly approved publication from the real committed clean worktree.

`@hobin/judgment` is a side-effect-free engine for composing task-specific
judgment from exact internal and external context.

```text
optional judgment.json
→ externally supplied PolicyOwner
→ CompiledJudgmentPolicy
→ DynamicJudgmentQuestion
→ ContextInventory + ObservedContext
→ ContextSelection + SealedContext
→ ContextContribution + ContextCoverage
→ ContextualJudgment | NeedsEvidence | EmergentQuestion
```

The package registers no Pi Skill, extension, tool, prompt, command, or UI.
Domain adapters own those product surfaces and use this engine as an ordinary
dependency.

Judgment owns exact parsing, policy identity, provenance, selection, sealing,
coverage, and optional closure. It does not rank Skills, crawl foreign
resources, choose a domain method, authorize mutation, or manufacture evaluator
or user authority.

## Documentation

- [Judgment Authoring Policy Schema 0.1](./docs/authoring-schema-v0.1.md)
- [Runtime Flow](./docs/runtime-flow.md)
- [Compiled Policy and Runtime](./docs/compiled-policy-and-runtime.md)
- [Runtime Integration](./docs/runtime-integration.md)
- [External Context Composition](./docs/external-context-composition.md)

## Authoring policy

A capability uses `judgment.json` when conditional packaged references can
materially change a caller's dynamic judgment.

```json
{
  "$schema": "https://raw.githubusercontent.com/dev-hobin/agent/main/packages/judgment/schemas/judgment-authoring.schema.json",
  "specVersion": "0.1",
  "when": [
    "Caller-facing operations, ownership, or data flow still need an implementation shape."
  ],
  "unless": [
    "A concrete candidate already exists and only its stability must be reviewed."
  ],
  "references": [
    {
      "path": "references/boundaries.md",
      "when": [
        "A dependency boundary needs explicit caller, owner, hidden-mechanism, and direction distinctions."
      ]
    }
  ]
}
```

Root `unless` wins. References are independent candidates, never mandatory or
authoritative by catalog membership.

```text
judgment.json absent  → normal complete Skill or context source
valid file             → policy-aware prepared-reference selection
present invalid file   → explicit fail-closed diagnostic
```

The caller supplies exact owner provenance. Authors do not write runtime
questions, assurances, source graphs, tool catalogs, or generated identities.

## Engine API

```ts
import {
  compileJudgmentPolicy,
  decodePolicyOwnerData,
  jsonValueFromUnknown,
  parseJudgmentAuthoringPolicyJson,
  parsePolicyOwner,
} from "@hobin/judgment";

const policy = parseJudgmentAuthoringPolicyJson(source);
const owner = parsePolicyOwner(
  decodePolicyOwnerData(
    jsonValueFromUnknown({
      kind: "pi-skill",
      namespace: "project-skills",
      name: "api-conventions",
      provenance: {
        source: "project-skills",
        scope: "project",
        origin: "top-level",
        path: "/skills/api-conventions/SKILL.md",
      },
    }),
  ),
);
const compiled = compileJudgmentPolicy({ owner, policy });
```

External and persisted representations are parsed into immutable,
invariant-carrying values. A successful parse returns the stronger
representation; validation followed by an unchecked assertion is not an engine
boundary.

Use `@hobin/judgment/node` for optional contained policy loading, physical
reference containment, fatal UTF-8 handling, byte bounds, and atomic sealing.
Use `@hobin/judgment/pi-context` to adapt Pi-visible Skill descriptors, context
files, tools, and active-branch observations into engine inputs without
registering Pi resources.

## External Context Composition

One adapter-owned judgment may admit zero, one, or several nominated context
Skills.

```text
Pi-visible Skill descriptors
→ agent nominates relevant sources
→ adapter opens bounded SKILL.md and optional judgment.json
→ policy is visible before source applicability
→ applicable prepared references join one inventory
→ one exact selection/sealing/coverage/outcome
```

The engine does not scan every co-located policy. Adapters open only exact
nominated sources. A Skill may be a primary capability in one request and an
external method, constraint, evidence source, or guidance source in another.

## Guarantees

- `$schema` and representation-only array order do not alter semantic identity.
- Selected descriptor/content drift fails; unrelated inventory growth does not.
- Selection and sealing commit atomically.
- Active-branch observations retain call/result and content identity.
- Error or truncated results cannot become selected positive context.
- Every usable selected material contributes through `constraint`, `evidence`,
  `decision`, `method`, or `guidance`.
- `domain-verified` requires matching typed evaluator evidence.
- `user-accepted` requires a matching selected user event.
- Sufficient coverage cannot retain conflicts.
- Outcomes cite contribution identity rather than catalog membership.

## Schema and command line

The authoring schema is exported as `@hobin/judgment/schema`.

```bash
judgment check path/to/judgment.json
judgment compile path/to/judgment.json
judgment explain path/to/judgment.json
```

The CLI is author tooling and does not activate Pi behavior.

## Development

```bash
pnpm --filter @hobin/judgment check
pnpm pack --dry-run
```

Publication still requires explicit approval, a committed clean worktree, and
deliberate removal of the private release guard.
