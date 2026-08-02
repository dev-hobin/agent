# How Developer works

English | [한국어](./ko/how-it-works.md)

Developer does more than advise the model to think before editing. It records an
explicit state in the Pi session and uses that state to control the built-in
tools and protocol operations available next.

## Example: a payment choice disappears after returning to checkout

Assume the user asks:

```text
/developer on
The selected payment method disappears after navigating back to checkout.
Find the cause and fix it, but do not guess at missing product behavior.
```

### 1. Reconstruct the current branch

When Developer is enabled, it replays `developer/v7` events from the current Pi
branch. This recovers any active judgment, unresolved question, change
authorization, or landing.

| State | Meaning |
| --- | --- |
| Idle | No judgment or authorization is active |
| ActiveJudgment | One question is being investigated |
| AuthorizedChange | One bounded file change is permitted |
| NeedsRouting | A landing needs its next judgment or verification |

Malformed events or impossible ordering produce replay diagnostics instead of a
guessed state.

### 2. Give one Skill ownership of the question

The first uncertainty might be product policy—should the selection persist?—or
it might be an evidence question—where does an already-required value disappear?

Developer opens one `ActiveJudgment` with the Skill that owns the current
question:

```text
developer_open_judgment
- skill: specify
- question: Should checkout restore the selected payment method when reopened?
- known evidence: current requirement and reproduction steps
```

The Skill supplies the method for answering that question. Selecting a Skill is
not itself a conclusion.

### 3. Gather evidence without editing

While an `ActiveJudgment` is open, `bash` is available for repository and runtime
inspection, but built-in `edit` and `write` are withheld. The model can locate
code, inspect tests, and reproduce behavior without silently fixing the code
before the question is settled.

Tool results are nominated by exact call ID. Developer rechecks the call,
arguments, result order, status, branch, and content hash, so a result from a
sibling branch or earlier run cannot be substituted.

If another installed Skill can help, `developer_open_context_sources` opens only
its nominated source ID. That Skill contributes a method or distinction; it does
not become the question owner.

### 4. Close the judgment with its evidence

`developer_conclude_judgment` requires more than a summary. It includes:

- applicability for each external provider;
- exact selected files, Skill methods, tool results, and user events;
- what each selected item contributed;
- conflicts and missing evidence;
- the outcome supported by current coverage; and
- any created or resolved `PendingQuestion`.

The Judgment engine reacquires and hashes selected content before Developer
appends the conclusion event. A stale source or missing contribution rejects the
whole conclusion.

If product policy is still missing, a user-owned `PendingQuestion` remains. The
model cannot answer it on the user's behalf.

### 5. Authorize one bounded change

After all before-implementation questions are closed and the implementation
shape is known, `developer_authorize_change` can create:

```text
movement:
  Restore persisted paymentMethodId into checkout form state.
stable landing:
  A valid prior choice is visible; an invalid saved value follows the existing fallback.
verification target:
  Cover the return-to-checkout path and an invalid saved value.
```

This creates `AuthorizedChange` and restores built-in `edit` and `write`. The
authorization applies to the stated movement, not arbitrary cleanup.

When the requirement, location, and checks are already exact, Developer may
create this authorization without opening an unnecessary judgment first.

### 6. Record the landing and end mutation authority

After editing, `developer_record_landing` receives the active authorization ID
and actual changed paths, for example:

```text
packages/checkout/src/payment-state.ts
packages/checkout/tests/payment-return.test.ts
```

The transition clears `AuthorizedChange` and creates two obligations:

- `rerouteRequired`: decide what work comes next;
- `verificationRequired`: completion is not yet supported.

Mutation tools are withheld again after the landing.

### 7. Verify the completion claim separately

A new judgment owned by `verify` asks what the tests and observed behavior
actually prove. Passing tests may still leave pass-but-wrong risk around invalid
saved values, source compatibility, sibling branches, or a construction path the
test never reaches.

Developer can support completion only after the verification target is covered
and all completion gates are closed.

## Who resolves a PendingQuestion?

| Owner | Resolution source |
| --- | --- |
| `user` | Explicit product decision or acceptance |
| `agent` | Repository, test, runtime, or documentation evidence |
| `environment` | Credentials, external system state, or access |

A `before implementation` gate blocks authorization. A `before completion` gate
allows a landing but blocks completion. A `non-blocking` question remains visible
without stopping current movement.

## Branch and tool ownership

Developer reconstructs state only from the current Pi branch. Sibling-branch
evidence is unavailable to the active judgment.

It records and restores only the built-in tool delta it owns. It does not replace
unrelated extension tools or re-enable tools the user had disabled. If a hot
reload cannot establish the previous tool state safely, Developer asks for a Pi
restart instead of guessing.
