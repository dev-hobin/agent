# Runtime Integration

Judgment consumers use only the depth they own.

| Consumer | Owned depth |
| --- | --- |
| Learning | parse policy and generate deterministic model-visible directions |
| Observer | typed domain relations and mutation gate; no authoring policy without packaged references |
| Developer | dynamic question, exact context, replay, separate mutation authorization and landing |
| Generic Judgment | complete Pi lifecycle |

## Lifecycle

```text
optional CompiledJudgmentPolicy
→ DynamicJudgmentQuestion
→ ContextInventory + ObservedContext
→ ContextSelection
→ SealedContext
→ ContextCoverage
→ optional outcome
```

### Open

The caller supplies current question text and exact basis. Runtime supplies owner,
branch anchor, generated `judgmentId`, optional policy identity, and
`questionSha256`.

For Pi skills, co-located policy discovery has three exact results:

```text
absent  → normal skill
loaded  → compiled policy and prepared references
invalid → fail closed for that selected policy
```

### Inventory

Pi supplies loaded skill metadata, ambient context files, and tool capability
metadata. A compiled policy contributes only its prepared-reference descriptors.
Neither source catalog is a required set.

Startup inventory does not read prepared-reference content. Selection resolves
explicit source identity. Observed tool and user context resolves only from the
active branch.

### Selection and sealing

Selection commits:

- dynamic question identity;
- optional policy identity;
- selected descriptor identity;
- selected expected content identity when available;
- current branch;
- explicit selection basis.

Unrelated inventory additions do not invalidate selected work. Selected
descriptor, policy, question, observed result, or content drift does.

Physical acquisition then checks lexical and real-path containment, file type,
UTF-8, cancellation, member bytes, aggregate bytes, exact ordered content, and
error/truncation state. A failed acquisition records neither selection nor seal.

### Coverage

Coverage accepts current-question contribution relations, not authored static
needs.

```text
materialId
+ useAs
+ concrete contribution
+ assurance
```

Every selected usable material must contribute. Domain assurance requires one
selected typed evaluator observation with the declared evaluator identity. User
assurance requires the exact selected user event. Agent prose can assert only
`agent-asserted`.

Conflict and limitation identities are derived. `sufficient` rejects conflicts;
`needs-evidence` requires at least one conflict or limitation.

### Outcome

- `contextual-judgment`: sufficient coverage and valid contribution citations
- `needs-evidence`: exact conflict/limitation accounting and next evidence
- `emergent-question`: a genuinely distinct next question

Selection, sealed context, coverage, and outcome hashes must describe one
question and one branch basis.

## Generic Pi tools

### `judgment_open_context`

```json
{
  "skillName": "sketch",
  "question": "Which interface preserves the callers' observable behavior?",
  "basisMaterialIds": ["request:current"]
}
```

Runtime resolves the selected Pi skill, derives owner identity, loads its
optional policy, and returns generated judgment identity plus bounded inventory.
This is the first point where a project skill's exact policy becomes model-visible.

### `judgment_assess_applicability`

```json
{
  "judgmentId": "judgment-…",
  "applicability": {
    "kind": "applicable",
    "basis": ["Caller-facing shape remains unresolved and no exclusion matches."]
  }
}
```

Applicability is recorded only after the policy is visible. A matching root
`unless` requires `not-applicable`; ambiguous evidence uses `needs-context`.

### `judgment_select_context`

```json
{
  "judgmentId": "judgment-…",
  "nominations": [
    { "kind": "inventory-source", "inventorySourceId": "reference-…" },
    { "kind": "tool-result", "toolCallId": "call-…" },
    { "kind": "user-decision", "userEventId": "event-…" }
  ],
  "selectionBasis": ["Each item can change the dynamic judgment."]
}
```

### `judgment_assess_coverage`

```json
{
  "judgmentId": "judgment-…",
  "proposal": {
    "status": "sufficient",
    "contributions": [
      {
        "materialId": "observed-context:result-…",
        "useAs": "evidence",
        "contribution": "The exact result falsifies the stale-content assumption.",
        "assurance": "agent-asserted"
      }
    ],
    "conflicts": [],
    "limitations": []
  }
}
```

### `judgment_conclude`

A contextual proposal cites `contributionId`, not inventory membership. A
needs-evidence proposal names the exact derived unresolved IDs.

## Replay

Each accepted transition is persisted as `judgment-session/v1` containing a
`judgment-event/v1` event. Replay reparses the dynamic question, reloads and
recompiles a present policy, rebuilds current inventory, reacquires selected
content, reruns coverage and outcome parsers, and compares every derived hash.

Old static-contract candidate history is not reinterpreted. It receives an
explicit restart diagnostic.

## Consumer boundaries

### Learning

Learning uses authoring parser plus deterministic directions during package
build/check. Its package remains stateless and does not bundle the Judgment
runtime.

### Observer

Observer's source-reading and memo requirements are adapter-owned typed domain
relations. Because Observer has no conditional packaged references, it owns no
`judgment.json`. Its basis remains exact and replayable; generic prose cannot
forge domain or user authority.

### Developer

Developer derives optional policy owner from the bundled Pi skill. A skill with
no policy still opens a dynamic judgment. Project skills remain normal Pi peers
and can contribute observed method or guidance context; they do not become
Developer-owned methods.

`ActiveJudgment` permits evidence work. Only `AuthorizedChange` permits bounded
mutation. Landing records changed paths and evidence but does not prove
completion.

## Common mistakes

- synthesizing an empty policy when `judgment.json` is absent;
- treating a malformed present policy as absent;
- using policy membership as relevance, authority, or completion;
- asking authors to write runtime question IDs or coverage graphs;
- assigning permanent semantic role to a source rather than a contribution;
- accepting selected error/truncated output as positive evidence;
- validating a stored hash and then casting instead of reconstructing the
  invariant-carrying value;
- broadening a project skill into a consumer's private owner catalog;
- treating landing as verification.
