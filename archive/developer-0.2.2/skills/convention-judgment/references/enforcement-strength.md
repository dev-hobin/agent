# Enforcement Strength

Use this reference when a concrete expectation may remain conventional or may
need stronger ownership. It supplies an enforcement ladder, proportionality
check, complete case, and stop. It does not require another reference.

## Accepted Judgment Context

Supply the expectation, intended audience and scope, one compliant example, one
plausible violation, its consequence and observer, current enforcement, and any
known constraints on stronger mechanisms.

## State The Mapping

Write the expectation without naming an enforcement mechanism:

```text
When readers see <code shape>, they may rely on <meaning> within <scope>.
```

Then state the negative case:

```text
A violation occurs when <shape or construction path> permits <contrary meaning>
without <audience or system> being able to detect it in time.
```

Formatting preference alone is not a semantic convention. A convention becomes
consequential when code shape is carrying effect, state, validity, order,
resource, security, or product meaning.

## Enforcement Ladder

Compare the smallest credible levels rather than jumping from prose to maximal
machinery:

| Strength | Mechanism | What it can own | Common escape |
| --- | --- | --- | --- |
| shared convention | examples, review, vocabulary | predictable reading for a cohesive audience | forgotten or conflicting local practice |
| explicit signal | names, visible wrappers, annotations | surprise and scope crossing | caller ignores or bypasses signal |
| localization | one module or construction point | consistency inside a bounded owner | alternate entry or mutation path |
| automated static check | formatter, lint, type restriction | detectable source or representation pattern | dynamic input, suppression, unchecked boundary |
| restricted construction | parser, constructor, capability | admitted-value or operation guarantee | raw construction, deserialization, mutation |
| runtime rejection | boundary check, database constraint | observed invalid operation or persisted state | check-result loss, race, partial effect |
| atomic ownership | transaction or single transition owner | invariant across coordinated change | external system or unsupported failure mode |

Stronger is not automatically better. Record complexity, compatibility,
migration, runtime, operational, and learning cost. Choose the weakest level that
makes the accepted violation visible and bounded.

## Worked Case: Approved Currency

Expectation:

```text
Every posted invoice uses the account's approved currency.
```

Evidence:

- one import path accepts external invoice rows;
- three internal callers construct invoices only through that importer;
- a currency mismatch can produce an irreversible incorrect ledger entry;
- a comment and field name do not stop a new caller from constructing a mismatch.

Ladder judgment:

```text
shared convention: failure is silent and remote
explicit signal: improves review but does not own construction
restricted construction: importer returns an admitted invoice or explicit error
runtime rejection: posting also rejects mismatched legacy records
atomic ownership: unnecessary while account currency cannot change during posting
```

Decision:

```text
enforce
owner: import admission plus posting boundary for legacy inputs
stop: every ordinary construction path either returns an admitted invoice or an
      explicit mismatch; a forged legacy record is rejected before ledger effect
```

The result does not prescribe a language type, class, decorator, or schema
library. It owns a guarantee and escape audit.

## Counterexample: Local Sorting Style

Expectation:

```text
Small local lists are sorted before display.
```

If all callers already observe sorted output, a violation is immediately visible,
cheap to repair, and has no persisted or external effect, a restricted constructor
may cost more than the failure. Keep the expectation local or conventional unless
new evidence raises the consequence.

## Artifact

```text
Expectation and audience:
Compliant example:
Violation and observer:
Consequence and reversibility:
Current level and escape paths:
Candidate levels and costs:
Decision and owner:
Violation test:
```

## Stop And Separation

Stop when one compliant case and one violation demonstrate that the selected
level is proportional and every consequential bypass is visible. When consequence
or construction paths are unknown, the comparison remains inconclusive. When the
accepted invariant is absent, enforcement strength cannot be judged.

This document does not invent the invariant, choose a concrete API, or implement
an enforcement mechanism.

## Source Trace

- Zachary Tellman, *Elements of Clojure*, Leanpub 2019-02-11:
  Idioms, public-manuscript pp. 30-61, for predictable syntax-to-intent mappings,
  visible operational surprise, narrow access, atomic state boundaries, and
  bounded absence. Language-specific calling and state conventions are not
  imported as universal rules.
- Alexis King, “Parse, don’t validate,” published November 5, 2019, for the
  distinction between a check that discards evidence and a transition whose
  result carries the established guarantee. Specific type-system techniques are
  not required by this reference.
