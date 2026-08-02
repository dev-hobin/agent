# Compiled Policy and Runtime

`judgment.json` is not the runtime contract. It is a small optional authoring
policy.

```text
JudgmentAuthoringPolicy
+ PolicyOwner
→ CompiledJudgmentPolicy
```

## Owner derivation

A Pi skill owner comes from loaded skill metadata and `SKILL.md`. An adapter
owner comes from typed capability registration. The policy file cannot override
its owner.

```ts
interface PolicyOwner {
  readonly kind: "pi-skill" | "adapter-capability";
  readonly namespace: string;
  readonly name: string;
  readonly provenance: {
    readonly source: string;
    readonly scope: "user" | "project" | "temporary";
    readonly origin: "package" | "top-level" | "session";
    readonly path?: string;
  };
}
```

The compiler normalizes prose and reference ordering, uses the normalized
relative path as reference identity, and computes `authoringSha256` and
owner-bound `policySha256`. A persisted compiled representation is parsed again
and both hashes are recomputed; stored hashes are never trusted as casts.

## Dynamic question

The current task, selected capability, branch, and known basis create one exact
runtime question.

```ts
interface DynamicJudgmentQuestion {
  readonly judgmentId: string;
  readonly owner: PolicyOwner;
  readonly policySha256?: string;
  readonly question: string;
  readonly basisMaterialIds: readonly string[];
  readonly branchRef: string;
  readonly questionSha256: string;
}
```

A skill without a policy still supports a dynamic question. It simply has no
prepared-reference inventory.

## Material identity

Runtime material is either prepared inventory or exact observed context.
Prepared references carry their policy identity and relevance conditions.
Observed tool results carry tool-call identity, arguments hash, ordered content
hash, sequence, error/truncation state, and active-branch provenance. User and
domain observations have distinct typed variants.

Selection nominations commit selected descriptor identity rather than the whole
catalog. Therefore unrelated inventory additions do not stale an existing
selection, while selected descriptor, policy, question, or content drift does.

## Contribution relation

Source kind does not permanently determine semantic role. The current relation
between exact material and the dynamic question does.

```ts
interface ContextContribution {
  readonly contributionId: string;
  readonly materialId: string;
  readonly useAs:
    | "constraint"
    | "evidence"
    | "decision"
    | "method"
    | "guidance";
  readonly contribution: string;
  readonly assurance:
    | "agent-asserted"
    | "domain-verified"
    | "user-accepted";
}
```

`contributionId` is derived from normalized relation content. Domain and user
assurance carry and verify their typed provenance. Generic prose cannot produce
either assurance.

## Coverage and closure

```text
usable selected material
→ at least one exact contribution
→ conflicts + limitations
→ sufficient | needs-evidence
```

Error and truncated observations cannot be selected as positive material.
Sufficient coverage cannot retain a conflict. Needs-evidence coverage requires
an explicit conflict or limitation.

A contextual outcome cites contribution identity and requires sufficient
coverage. A needs-evidence outcome exactly accounts for conflict and limitation
identities. An emergent question must be distinct from the current dynamic
question.

## Parse, don't validate

Every external transition produces the stronger value it learned:

```text
JSON text
→ JsonValue
→ exact data schema
→ immutable JudgmentAuthoringPolicy

persisted compiled data
→ exact data schema
→ recomputed authoring policy
→ recomputed CompiledJudgmentPolicy

selection proposal
→ exact nomination identities
→ ContextSelection
→ bounded physical acquisition
→ SealedContext
```

There is no public constructor that accepts raw fields after a check, and no
assertion that recovers a type discarded by validation.
