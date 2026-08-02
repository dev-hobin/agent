# Judgment operating principles

English | [한국어](./ko/how-it-works.md)

This document is about the engine mechanism, not CLI usage. It explains which
representations Judgment creates, what each transition proves structurally, and
where invalid conclusions are rejected.

Judgment never stores raw model prose directly as a conclusion. It turns the
question, exact source content, and stated use of that content into successively
stronger immutable values. Each stage accepts only the refined output of the
previous stage.

```text
raw policy
→ owner-bound compiled policy
→ current question identity
→ exact context selection
→ sealed context bound to source bytes
→ per-material contributions and assurance
→ outcome limited to current coverage
```

## 1. Produce checked values instead of remembering validation

A Judgment parser does not validate raw JSON and then return the original object.
It normalizes values, rejects unknown structure and semantic duplicates, and
constructs a new immutable representation that downstream code can trust.

That design removes ambiguous intermediate states such as:

- a policy that was “validated” but is still a raw object;
- selected source IDs whose content was never acquired;
- read material with no account of how it affected the answer; or
- an outcome that names old coverage while claiming newly added evidence.

An absent `judgment.json` is normal. A present malformed file fails for that
provider. The JSON cannot declare its own owner: the caller supplies a
`PolicyOwner`, so an authoring file cannot transfer domain ownership to itself.

## 2. A question includes its current decision conditions

A `DynamicJudgmentQuestion` binds more than question text. It includes the
owning capability, optional owner-policy identity, known basis material, current
Pi branch identity, and caller metadata needed to recover the question.

Identical prose under a different owner or branch is therefore a different
question. `questionSha256` is derived from that complete payload. The hash does
not prove the question true; it establishes whether later work still addresses
the same question.

## 3. Separate candidate discovery from content acquisition

A `ContextInventory` normally contains descriptors rather than every source
body: Skill identity, source ID, policy identity, reference path, or a
branch-local tool-call ID that can be resolved again.

The acquisition callback reads content only after the model nominates exact IDs.
The separation serves three purposes:

1. installed Skills and references do not all flood model context;
2. the host can record what was actually selected; and
3. the engine can compare the nominated descriptor with the bytes reacquired at
   sealing time.

When an external provider has a policy, the model first sees its method and
policy and assesses applicability. A matching root `unless` overrides `when`.
Only an `applicable` provider may contribute positive method or reference
material. `needs-context` is not guessed into applicability.

## 4. Selection and sealing are one atomic transition

`selectAndSeal()` does not append selection first and fetch files later. It
resolves exact IDs, checks the branch, reacquires content, computes hashes, and
binds provenance before returning the selection and sealed context together.

No transition value is returned if any selected member:

- has descriptor, policy, or content drift;
- belongs to another branch or agent run;
- is an error or truncated result;
- escapes its provider's lexical or physical filesystem root;
- reaches outside that root through a symlink;
- violates UTF-8 or byte limits; or
- is interrupted by batch cancellation.

Multiple providers keep separate policy identities and contained readers. A
reference path from one provider is never resolved under another provider's
root. Partial batch success cannot become a sealed context.

## 5. The identity chain determines staleness

Each identity canonicalizes the preceding representation together with the new
payload:

```text
owner + normalized policy                    → policySha256
owner + policy + question + basis + branch   → questionSha256
question + admitted policies + selected IDs  → selectionSha256
selection + exact acquired bytes             → sealedContextSha256
sealed members + contributions + gaps        → coverageSha256
question + coverage + cited relation IDs     → outcomeSha256
```

Adding an unrelated inventory candidate does not stale already sealed work.
Changing a selected descriptor, policy, source body, question, or branch does
stale every later representation that depends on it.

During replay, parsers recompute hashes from payloads. Editing only a stored hash
string or pairing an old outcome with new coverage does not reconstruct a valid
value.

## 6. Evidence is a relation, not a permanent source property

The same file can serve different purposes for different questions. Judgment
therefore does not classify a source as permanently “evidence” or “method.”
`assessCoverage()` requires a question-specific relation for every selected
usable material.

| `useAs` | Effect in the current question |
| --- | --- |
| `constraint` | Restricts legal outcomes or execution |
| `evidence` | Supports or challenges a factual claim |
| `decision` | Records a choice within the owner's authority |
| `method` | Organizes the investigation or comparison |
| `guidance` | Adds a missing distinction, counterexample, or check |

A contribution must state the difference the source made. “Restart test 42
reads an existing key, but does not check TTL units written by the previous
version” identifies both support and a boundary; “this was useful” does not.

A selected usable member with no contribution prevents complete coverage.
Conversely, a packaged prepared reference is never intrinsically required,
authoritative, or sufficient merely because it exists.

## 7. Assurance cannot exceed provenance

Judgment separates contribution content from how strongly that content may be
claimed.

| Assurance | What establishes it |
| --- | --- |
| `agent-asserted` | Model interpretation of exact sealed content |
| `domain-verified` | A named evaluator checked a specific relation |
| `user-accepted` | An exact current-branch user event carries a user-owned decision |

A model reading test output does not turn it into `domain-verified` evidence. A
user accepting product behavior cannot make a test pass. Errors, truncation,
unsealed prose, and stale results cannot create positive assurance.

## 8. An outcome cannot speak beyond current coverage

`conclude()` may cite only contribution, conflict, and limitation IDs from the
current coverage. To introduce a new source claim, the caller must rebuild the
selection and coverage first.

An outcome is normally one of:

- a contextual judgment supported by current coverage;
- `needs-evidence`, naming the unresolved material and why it matters; or
- a separate emergent question exposed by the investigation.

If a cache change seals only a restart test, it may support “existing keys can be
read after restart.” It cannot support “all previous storage formats remain
compatible” while TTL-unit compatibility remains an explicit limitation.

## 9. `ContextAttempt` is an ordered facade over these values

The core values and transitions can be used independently. `ContextAttempt`
wraps the legal order for adapters that want one convenience surface.

| Call | Representation produced |
| --- | --- |
| `open` | Question and start event |
| `recordApplicability` | Current owner/provider applicability |
| `selectAndSeal` | Exact selection and sealed context |
| `assessCoverage` | Contributions, conflicts, and limitations |
| `conclude` | Outcome bound to coverage |

Its `.events` are engine transition facts, not a generic Pi session protocol. A
host may embed them in its own protocol or persist only the identities required
by its domain record.

## 10. Engine and caller responsibilities stay separate

Judgment owns parsing, policy compilation, question identity, selection,
sealing, coverage, and outcome construction. The caller still owns:

- which candidates enter the inventory;
- UI, tools, and model or user interaction;
- persistence and replay protocol;
- what a named evaluator actually checks; and
- whether an outcome authorizes a domain decision or repository mutation.

The engine guarantees that an outcome is structurally bound to exact material
through explicit relations. It does not guarantee source honesty, model
correctness, or domain authority.
