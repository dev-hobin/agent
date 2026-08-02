# @hobin/judgment

> **Development status:** first-public `0.1.0` remains private pending an
> explicitly approved publication from the real committed clean worktree.

`@hobin/judgment` gives Pi packages an exact, replayable boundary between a
small human-authored optional policy and task-specific runtime judgment.

```text
optional judgment.json
→ JudgmentAuthoringPolicy + externally supplied PolicyOwner
→ CompiledJudgmentPolicy
→ DynamicJudgmentQuestion
→ ContextInventory + ObservedContext
→ ContextSelection + SealedContext
→ ContextContribution + ContextCoverage
→ optional ContextualJudgment | NeedsEvidence | EmergentQuestion
```

Judgment owns exact parsing, policy identity, provenance, selection, sealing,
assurance, replay, and optional closure. It does not rank skills, crawl foreign
resources, infer policy from prose, activate hidden tools, choose a domain
method, authorize mutation, or manufacture evaluator/user authority.

## Documentation

- [Judgment Authoring Policy Schema 0.1](./docs/authoring-schema-v0.1.md)
- [Runtime Flow](./docs/runtime-flow.md)
- [Compiled Policy and Runtime](./docs/compiled-policy-and-runtime.md)
- [Runtime Integration](./docs/runtime-integration.md)
- [External Context Composition](./docs/external-context-composition.md)

## Authoring policy

A capability owns `judgment.json` only when it has conditional packaged
references.

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

Root `unless` wins. Each reference condition is independent and must combine an
observable pressure with the material distinction the reference can add.
Catalog membership never makes a reference mandatory or authoritative.

```text
judgment.json absent  → normal complete Pi skill
valid file             → policy-aware prepared-reference selection
present invalid file   → explicit fail-closed diagnostic
```

Owner identity comes from `SKILL.md`, adapter registration, or the compiler
caller. Authors do not write runtime questions, source graphs, roles,
assurances, coverage wiring, tool catalogs, or generated IDs/hashes.

## Pi-free core

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
      namespace: "example",
      name: "sketch",
      provenance: {
        source: "example",
        scope: "project",
        origin: "top-level",
        path: "/skills/sketch/SKILL.md",
      },
    }),
  ),
);
const compiled = compileJudgmentPolicy({ owner, policy });
```

External and persisted representations are decoded and parsed into immutable
invariant-carrying values. The core exposes no validate-then-cast construction
path.

Use `@hobin/judgment/node` for optional contained policy loading, physical
reference containment, fatal UTF-8 handling, byte bounds, and atomic context
sealing.

## Runtime guarantees

- `$schema` and representation-only array order do not alter semantic identity.
- Selected descriptor/content drift fails; unrelated inventory growth does not.
- Selection and sealing commit atomically.
- Active-branch tool observations retain arguments, result order, and content
  identity; cross-branch or absent results cannot be nominated.
- Error or truncated results cannot become selected positive context.
- Every usable selected material contributes to the dynamic question through
  `constraint`, `evidence`, `decision`, `method`, or `guidance`.
- `domain-verified` requires matching typed evaluator evidence.
- `user-accepted` requires a matching selected user event.
- Sufficient coverage cannot retain conflicts; needs-evidence coverage names
  explicit conflicts or limitations.
- Outcomes cite contribution identity rather than catalog membership.
- `judgment-event/v1` and `judgment-session/v1` replay exact accepted commands;
  unsupported history receives a restart diagnostic.

## Direct Pi package

The package registers one Agent Skill and five sequential tools:

- `judgment_open_context`
- `judgment_assess_applicability`
- `judgment_select_context`
- `judgment_assess_coverage`
- `judgment_conclude`

`judgment_open_context` resolves one Pi-visible skill and reveals its co-located
optional policy before `judgment_assess_applicability` records the semantic
applicability result. It generates runtime identity from the actual tool call and
current branch anchor. Startup inventories metadata only; prepared reference
content is read after explicit nomination.

Project skills remain normal Pi peers. A project skill is not promoted into a
consumer package's private owner catalog, and its policy cannot grant mutation
authority.

## Schema and command line

The public authoring schema is exported as `@hobin/judgment/schema` and committed
at `schemas/judgment-authoring.schema.json`.

```bash
judgment check path/to/judgment.json
judgment compile path/to/judgment.json
judgment explain path/to/judgment.json
```

`check` parses the exact policy and verifies contained packaged references.
`compile` emits owner-bound canonical data. `explain` shows applicability,
winning exclusions, prepared-reference conditions, and derived identity.

## Development

```bash
pnpm --filter @hobin/judgment check
pnpm --filter @hobin/judgment eval
pnpm pack --dry-run
```

Publication still requires explicit approval, a committed clean real worktree,
and deliberate removal of the package's private release guard.
