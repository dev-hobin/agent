# Adapter guide

English | [한국어](./ko/adapter-guide.md)

Judgment owns context identity and evidence accounting. The adapter owns the
product: questions, source discovery, UI, persistence, domain authority, and any
mutation permission.

## Minimum integration

A stateful adapter normally does this:

1. derive the exact owner from the selected capability;
2. load and compile its optional `judgment.json`;
3. create one dynamic question for the current branch;
4. expose lightweight source descriptors;
5. let the model nominate exact sources;
6. reacquire and seal those sources;
7. require a contribution for every usable selected item;
8. conclude and store the resulting basis inside the adapter's own protocol.

The adapter should not expose a standalone generic Judgment workflow to users.
Judgment is the mechanism inside the owning workflow.

## A small host example

```ts
const opened = ContextAttempt.open({
  question: questionValue,
  applicability: applicabilityValue,
});

const sealed = await opened.value.selectAndSeal({
  inventory,
  observedContext,
  proposal: selectionProposal,
  admittedPolicySha256s,
  acquisition,
});

const covered = opened.value.assessCoverage(coverageProposal);
const concluded = opened.value.conclude(outcomeProposal);

persistAdapterEvent({
  questionId: concluded.value.question.judgmentId,
  outcome: concluded.value.outcome,
});
```

The host applies or persists a transition only after the whole call succeeds.

## Discover first, open later

For Pi Skills, descriptor discovery should remain cheap. Show the model names,
descriptions, provenance, and exact source IDs without reading every `SKILL.md`.

After nomination, open a bounded batch:

```text
exact source IDs
-> current descriptor resolution
-> bounded SKILL.md reads
-> optional co-located policy reads
-> owner-bound policy compilation
-> model-visible method and policy
-> source-specific applicability
```

The model must see a policy before claiming that its provider is applicable. A
malformed file rejects that batch; it must not erase providers opened by an
earlier successful batch.

## Keep providers separate

Each policy-bearing provider needs its own:

- `CompiledJudgmentPolicy`;
- physical policy root;
- contained reference reader; and
- set of references admitted for the current question.

Two Skills may both contain `references/checklist.md`. They are still different
sources because their owner, policy, root, and provenance differ. Never resolve
one provider's relative path under another provider's root.

## Reconstruct observed material from the host

Do not trust a model payload that claims a tool result or user decision exists.
Resolve it against current host state.

| Material | Resolve from |
| --- | --- |
| Tool result | Current branch call ID, arguments, sequence, status, and content hash |
| User decision | Exact branch-local user event |
| Context file | Current Pi descriptor and content identity |
| Domain evaluator result | Typed evaluator ID, declared relation, and exact basis |

An error or truncated result may explain missing evidence but cannot support a
positive contribution.

## Acquisition callbacks

`ContextAcquisition` lets the host reacquire content at sealing time:

- `acquirePreparedReference` reads a reference through the reader for its exact
  policy;
- `acquireSkill` rechecks a nominated Skill method;
- `acquireObservedContext` resolves branch-local material again.

The callback must return current content identity, not bytes cached before
selection.

## Contributions and assurance

Every selected item that the outcome uses needs a concrete relation to the
question. Keep assurance within the source that established it:

- model interpretation -> `agent-asserted`;
- matching typed evaluator relation -> `domain-verified`;
- matching user event -> `user-accepted`.

Do not upgrade assurance because a source sounds authoritative.

## Persistence and replay

Judgment events are not a Pi session format. Persist them inside your own
protocol, or store a compact basis that includes at least:

- owner, question, and branch identity;
- admitted provider descriptor, policy, and applicability identity;
- selection and sealed-content hashes;
- contribution, conflict, limitation, coverage, and outcome identities.

When replaying, parse payloads and recompute identities. A stored hash without
the value it identifies is not enough.

## Failure behavior the adapter must preserve

| Failure | Required behavior |
| --- | --- |
| Policy absent | Continue without prepared references |
| Present policy malformed or escaping its root | Reject that source batch |
| Provider not applicable | Exclude its positive method/reference material |
| Selected bytes changed | Reacquire and reassess |
| Unrelated descriptor added | Keep the existing selection valid |
| One selected read fails | Commit neither selection nor seal |
| Contribution missing | Reject coverage |
| Persistence fails | Do not advance adapter-owned domain state |

A contextual outcome is still not permission to edit files. If the adapter can
mutate artifacts, create a separate authorization value with its own checks.
