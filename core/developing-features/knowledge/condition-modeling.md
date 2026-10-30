# Condition Modeling

Read this when correctness depends on how conditions combine (role x status x
flag), on absence or defaults, on order or retries, or on facts across records,
and a few examples no longer show every case. Build the lightest table that
makes each case decidable, give each guarantee an owner, and turn rows into
acceptance scenarios. Model only the unresolved dimension.

## Pick The Lightest Artifact

| Uncertainty | Artifact |
| --- | --- |
| finite roles, statuses, flags, defaults | decision table over finite, disjoint, exhaustive partitions |
| order, retries, stale or duplicate events, lifecycle | state-transition table + forbidden traces |
| policy or invariant ("must", "never", "only if") | rules + forbidden-state table |
| facts across records (uniqueness, overlap, references) | quantified rule + identity, endpoint convention (half-open is not SQL `BETWEEN`), `NULL` logic, set vs. bag, every write path that could violate it |
| replacing existing behavior | the same table with old/new result columns |

## Lower Prose Into Rules

1. Judgments become predicates (`canEdit`, `isActive`); state their domain.
2. "all / each / any" become scoped quantifiers. If "all qualifying items"
   must not pass on an empty set, add the existence condition explicitly.
3. "if P then Q" becomes `P => Q`; its forbidden row is `P && !Q`. Keep
   preferences out of hard rules; a product-owned choice is an `owner decision`.
4. A logically equivalent rewrite can still change behavior through
   short-circuit order, null/false-like coercion, effects, or numeric range.

## Enumerate Absence

For every value whose absence a caller can observe, write one row per state
(missing key, `undefined`, `null`, empty `""`/`[]`/`{}`, false-like `0`/`false`,
defaulted, legacy stored form, invalid) with columns `How it arrives | Meaning |
Survives normalization? | Owner of default`.

Missing, empty, and malformed external responses are different states; folding
them into an empty-but-valid result accepts invalid input, so reject or surface
them unless an owner decided otherwise. An observable fallback (`?? 0`, `|| []`)
is product policy with exactly one owner; write a counterexample where applying
it in a second layer changes meaning.

## Templates

Decision table (check each dimension is finite, disjoint, exhaustive first):

| Role | Target status | Flag | Result | Source |
| --- | --- | --- | --- | --- |
| A | closed | any | deny | rule `closed => !edit` |
| B | open | off | ? | owner decision |

State-transition table (every row states what stays unchanged):

| State | Event | Guard | Next state | Unchanged | Stale / duplicate / invalid |
| --- | --- | --- | --- | --- | --- |
| Saving(draft, req=7) | Saved(req=7) | ids match | Idle(draft) | draft | Saved(req=6) -> ignore |

Add `safety:` (histories that must never occur) and `progress:` (what must
eventually happen, under which assumption, e.g. finite retries). List stale,
duplicate, reordered, retried, and concurrent traces separately.

## Place Each Guarantee

| Guarantee owner | Use for |
| --- | --- |
| type / abstract representation | unrepresentable states, only if every construction path enforces it |
| parser / smart constructor | broader or hostile input; returns the refined value or a failure |
| DB constraint, transaction, or transition owner | persisted cross-row facts; history-sensitive rules |
| example, integration, or property test | concrete rows; rules over a generatable domain |
| owner decision | policy rows the code must not guess |

A `boolean` validator, cast, non-null assertion, or typed deserialization target
owns nothing. Note the ability each restriction removes (a narrower enum rejects
stored legacy values) and whether that loss is accepted. Replacing behavior must
satisfy `old.requires => new.requires` and `new.ensures => old.ensures`,
including errors and stored forms.

## Rows Become Acceptance Scenarios

- Decision row, or absence row with distinct meaning -> given <values>, when
  <action>, then <result>.
- Forbidden state -> negative scenario: rejected or unrepresentable.
- Transition and each stale/duplicate/retry trace -> one ordered scenario.
- `owner decision` row -> an open question, not a scenario.

Done when any plausible counterexample lands in exactly one row that has an
owner and a check.

## Sources

Distilled from `archive/developer-0.2.2/skills/model/` (SKILL.md, problem-modeling,
contract-and-replacement, temporal-behavior, relational-constraint models).

- Hillel Wayne, *Logic for Programmers*, v0.14.0, 2026-05-04: Ch. 2-5, 7, 9-10.
- Alexis King, "Parse, don't validate," 2019-11-05.
- Matthias Felleisen, Robert Bruce Findler, Matthew Flatt, Shriram
  Krishnamurthi, *How to Design Programs*, living build 9.2.0.3: Preface,
  Ch. 19-20, Intermezzo 4.
- Harold Abelson and Gerald Jay Sussman with Julie Sussman, *Structure and
  Interpretation of Computer Programs*, Second Edition, MIT Press, 1996:
  Sections 2.1, 3.1, 3.3.5, 3.4.
