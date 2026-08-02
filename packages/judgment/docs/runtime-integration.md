# Runtime Integration

`@hobin/judgment` provides a complete engine without registering Pi resources.
Each consumer owns only the integration depth it needs.

| Consumer | Owned integration |
| --- | --- |
| Stateful Pi adapter | tools, dynamic question, external source admission, replay, UI, and domain authority |
| Build-time consumer | parse policy and generate deterministic directions |
| Typed sidecar | typed domain relations whose exact results may become observed context |
| Future adapter | its own tools, persistence, UI, and authority over the common engine |

## Engine sequence

```text
optional CompiledJudgmentPolicy
+ zero or more admitted external Skill policies
→ DynamicJudgmentQuestion
→ ContextInventory + ObservedContext
→ ContextSelection
→ SealedContext
→ ContextCoverage
→ optional outcome
```

### Open the owning question

The adapter supplies exact owner, current question, branch anchor, and known
basis. A Skill without policy remains complete; it simply contributes no
prepared references.

### Discover context candidates

Pi supplies loaded Skill descriptors, ambient context files, and tool metadata.
Judgment does not search or rank them. The agent nominates exact candidate IDs.

### Open context Skills

For each nominated Skill, the adapter performs a bounded `SKILL.md` read and
optional contained `judgment.json` load. The parser returns either a refined
compiled policy, normal absence, or a fail-closed diagnostic. Policy prose is
visible before source applicability is submitted.

Several context Skills may be opened for one question. Their methods and
applicable references enter the same selection; they do not create child
Judgment workflows.

### Inventory

A compiled provider policy contributes only prepared-reference descriptors.
Only sources assessed `applicable` may contribute positive method/reference
material. `not-applicable` and `needs-context` remain explicit adapter basis or
limitations.

Inventory creation does not read reference content. Selection resolves exact
source identity. Observed tool and user context resolves only from the active
branch.

### Selection and sealing

Selection commits:

- dynamic question identity;
- owning policy identity when present;
- admitted external policy identities;
- selected descriptor identity;
- selected expected content identity when available;
- current branch; and
- explicit selection basis.

Unrelated inventory additions do not invalidate selected work. Selected source,
policy, question, or content drift does.

Each prepared reference is acquired through a reader bound to its own policy
root. Acquisition checks lexical and real-path containment, file type, fatal
UTF-8, cancellation, member bytes, aggregate bytes, and error/truncation state.
A failed acquisition commits neither selection nor seal.

### Coverage and outcome

Every selected usable material must have one exact current-question
contribution:

```text
materialId + useAs + contribution + bounded assurance
```

A contextual outcome requires sufficient coverage and cites contribution IDs.
A needs-evidence outcome accounts for exact conflict/limitation IDs. An emergent
question must differ from the current question.

## Parse, do not validate

Adapters pass raw tool and persisted inputs through engine or adapter parsers.
Successful parsing returns immutable values carrying owner, policy, descriptor,
content, and lifecycle invariants. No adapter may validate a raw object and then
recover the refined representation through an assertion.

Batch context-source opening follows the same rule:

```text
raw source IDs
→ exact Pi descriptors
→ bounded method reads
→ optional policy parsing/compilation
→ immutable opened-source values
→ one state transition
```

No dependent state update occurs before every source in the accepted batch has
been refined.

## Stateful adapter boundary

A stateful adapter may expose one operation to open the owning question, an
operation to open zero or more batches of context sources, and a conclusion
operation. Domain authorization, mutation, landing, and verification remain
outside the engine and inside that adapter.

An active engine judgment permits evidence work only. An adapter-owned
authorization value may permit bounded mutation. Landing still does not prove
completion.

## Common mistakes

- synthesizing an empty policy when `judgment.json` is absent;
- treating a malformed present policy as absent;
- crawling every Pi-visible Skill policy before nomination;
- creating a second Judgment lifecycle for an external context Skill;
- using policy membership as relevance, authority, or completion;
- assigning one permanent role to a Skill rather than a question-specific contribution;
- selecting an errored, truncated, excluded, or unresolved source positively;
- validating persisted data and then casting it;
- using one policy-root reader for references owned by another Skill;
- treating landing as verification.
