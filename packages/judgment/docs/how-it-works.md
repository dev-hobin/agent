# How Judgment works

English | [한국어](./ko/how-it-works.md)

Judgment is not a model that decides on behalf of its caller. It gives the caller
a machine-checkable link between a question, the exact source content used to
answer it, and the resulting conclusion.

## Example: is a cache change complete?

Assume a Pi adapter needs to answer:

> Does the new cache preserve existing stored values and restart behavior?

Possible sources include a requirement file, a cache-review Skill, one of that
Skill's compatibility references, a test result from the current branch, and a
user-approved migration decision.

Judgment does not open all of them. The adapter exposes lightweight descriptors,
and content is read only after the model nominates exact IDs.

## 1. Open the question

`ContextAttempt.open()` creates the state for one attempt. The question is bound
to its owning capability, optional policy hash, current branch, and known basis
material.

```ts
const opened = ContextAttempt.open({
  question,
  applicability,
});
const attempt = opened.value;
```

The same text under a different owner or branch is a different question. Opening
the attempt establishes `questionSha256`.

`ContextAttempt` returns transition events with each state change. A host may
persist them inside its own protocol or keep only the final basis.

## 2. Describe what is available

The adapter builds a `ContextInventory`. It contains descriptors, not every
reference body: Skill identity and location, current context-file identity,
references from admitted policies, and branch-local tool/user events that can be
resolved again.

For an external Skill with a policy, the model must see the policy and assess its
applicability first. A provider assessed as `not-applicable` or `needs-context`
cannot contribute positive method or reference material.

## 3. Read and seal only nominated material

The model nominates exact source IDs. `selectAndSeal()` performs two operations
as one transaction:

1. resolve every ID against the current inventory and branch;
2. reacquire the content and bind its bytes, hash, and provenance.

```ts
const sealed = await attempt.selectAndSeal({
  inventory,
  observedContext,
  proposal,
  admittedPolicySha256s,
  acquisition,
});
```

The call produces no transition value if any selected item disappeared, changed,
belongs to another branch, is an error or truncated result, escapes its allowed
root, is invalid UTF-8, exceeds a byte limit, or is cancelled.

This prevents a selected-but-unsealed state. Either every selected member is
acquired and the sealed result is returned, or the caller keeps its previous
state.

## 4. Account for every selected item

Reading content is not enough. The proposal passed to `assessCoverage()` must
state what each usable item did:

| Relation | Meaning |
| --- | --- |
| `constraint` | Limits legal outcomes or execution |
| `evidence` | Supports or challenges a factual claim |
| `decision` | Records a choice within its owner's authority |
| `method` | Organizes the investigation |
| `guidance` | Adds a distinction, counterexample, or review criterion |

A useful contribution is concrete:

```text
Test result test-42 shows that an existing key can be read after restart.
It does not test whether TTL units written by the previous version are compatible.
```

Generic prose such as “this was useful” is rejected. Every usable selected
member needs at least one contribution.

## 5. Keep assurance within its provenance

| Assurance | What can establish it |
| --- | --- |
| `agent-asserted` | Model interpretation of exact selected content |
| `domain-verified` | A named evaluator that checked a specific relation |
| `user-accepted` | An exact user event on the current branch |

A model reading a test result does not make the result `domain-verified`. A user
decision can settle user-owned policy but cannot make a test pass.

## 6. Conclude within current coverage

`conclude()` may cite only contribution, conflict, and limitation IDs from the
current coverage. It can produce:

- a contextual judgment supported by the current material;
- a needs-evidence result naming the unresolved gap; or
- a distinct emergent question discovered during the attempt.

For the cache example, a valid result could say that restart compatibility is
supported but completion remains unproven because TTL-unit compatibility was not
tested.

## What the caller receives

A completed attempt contains:

```text
question
selection
sealedContext
coverage
outcome
```

Each value includes the identity of the preceding representation. Parsers
recompute hashes from payloads during replay, so a host cannot safely substitute
new content into an old conclusion by editing a stored hash string.

## What this does not prove

Judgment proves that one outcome is bound to one question and one accounted set
of exact material. It does not prove source honesty, model correctness, mutation
permission, or operating-system safety. The adapter must own those decisions.
