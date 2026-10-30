<!-- Generated from sources/lenses/contract.md. Edit the source and run node scripts/sync-sources.mjs. -->
# Contract

Catches: an implementation that runs correctly but is wrong about what must be true: absence states folded together, a default with no owner, an invariant that some construction path never establishes, or an old-data decision made silently.
Applies when: a change adds or changes a rule, reads external, persisted, legacy, or user-supplied input, introduces a default or fallback, narrows a type, enum, or schema, replaces behavior that existing callers or stored data depend on, or encodes a rule over combinations of records.
Skip when: the change preserves every caller-visible observer (values, errors, order, effects, persisted form), adds no input boundary or default, and touches no stored data.

## Gotchas
- A request about new behavior often leaves open what happens to data already stored under the old behavior. Keep, migrate, or scrub is an owner decision; record it as an open question instead of resolving it silently in code.
- Missing, empty, and malformed external responses are separate states. Folding them into an empty-but-valid result (`?? []`, `catch -> []`, default envelope) accepts invalid input; reject or surface them unless an owner has decided otherwise.
- Validation that returns only success, `bool`, or `void`, followed by a cast, type assertion, non-null assertion, or typed deserialization target, does not establish the invariant. The typecheck passes because the declaration was asserted, not proved. The exception: the language narrows the checked value itself in the scope that consumes it, or one unchecked step is isolated inside the single parser right after a complete check.
- A claimed invariant is only as strong as its weakest construction path. ORM hydration, raw constructors, object literals, deserializers, test factories, and legacy adapters often bypass the parser that the happy path uses.
- Narrowing an enum, schema, required field, or result type is a breaking change for old callers and stored values even when it is described as "validation".
- A fallback that callers can observe is product policy. Applying the same default in a second layer, or in a different layer than its owner, changes meaning for some input.
- A query or check that reads correctly does not enforce a rule on create, update, or delete paths it never observes. SQL `NULL` uses three-valued logic, joins and bags keep duplicates, and `BETWEEN` is closed on both ends, so a storage rule can differ from the intended relation.

## Distinctions
- **Absence states**: missing, undefined, null, empty, defaulted, legacy, and invalid/malformed. Each may need its own meaning; normalization decides which survive.
- **Owner decision**: a choice only the product or data owner can make (precedence, accepted equivalence, retention, what happens to old data). Code may not settle it by guessing.
- **Parse vs validate**: parse returns the refined value or an explicit failure. Validate returns only pass/fail and leaves the caller holding the raw value.
- **Guarantee owner**: where a rule is enforced: type or opaque representation, parser or smart constructor, database constraint, state-transition owner, test or property check, or human decision.
- **Replacement relation**: for existing callers, `old.requires => new.requires` and `new.ensures => old.ensures`, applied to errors and every observer too.
- **Observer**: anything a caller can rely on: value, error type and timing, order, effects, persisted or serialized form.
- **Invariant vs assumption**: an invariant is a rule the owner enforces on every transition. An assumption is an external fact observed at some time; a startup check does not keep it true.

## Questions
| Before building, decide | After building, find |
| --- | --- |
| For each new or changed rule, what must be true, and which input violates it? | Find a rule in the diff that no test, type, or constraint would reject for a violating input, and name the input. |
| Which absence states can reach this code, and what does each one mean? | Find branches where missing, null, empty, and malformed external or persisted values reach the same default or empty result, and name the invalid state that is now accepted as valid. |
| Who owns each default, and in which single layer is it applied? | Find the same fallback applied in more than one layer, or a caller-visible default chosen without a stated decision. |
| What happens to data stored under the old behavior: keep, migrate, or scrub? Who decides? | Find stored records the change now reads, reinterprets, rejects, or rewrites, and check whether the decision is stated anywhere. If it is not, flag the silent choice. |
| Where is each invariant guaranteed: type, parser, constructor, database constraint, transition owner, or test? | Find a validation that returns no refined value followed by `as`, `!`, a cast, or a typed decode into the domain type. |
| What are all the ways this domain value can be constructed? | Find construction paths that skip the parser: exported raw constructors, object literals, ORM hydration, deserializers, test factories, and legacy adapters. |
| Is invalid input rejected before the first domain effect? | Find a write, send, or mutation that runs before parsing of the same input completes, so malformed or partially valid input leaves a partial effect. |
| Does the new version require more from, or promise less to, existing callers and stored data? | Find narrowed enums, schemas, or required fields and changed error types or timing, and list the existing callers or stored values they now reject. |
| For "all", "none", "at most one", or overlap rules: what are the domain, the empty case, the endpoints, `NULL`, and duplicates? | Find `every`/`all` checks that pass on empty input, interval checks with a mismatched endpoint convention, `NULL` comparisons, and mutation paths that the constraint does not cover. |
| Which facts are evidence, which are provisional assumptions, and which are owner decisions? | Find a branch that commits to a product choice the requirement does not state (precedence, equivalence, accepted error), and report it as an open decision. |

## Report a finding only when
- You can name a concrete input or stored state (for example a response with no envelope, `{}`, a null field, or a legacy row) and the wrong outcome it produces at `file:line`.
- A silently resolved owner decision counts only when the code commits to one option with an observable consequence. Report it as an open decision with the options, not as a bug.
- These do NOT count: a missing type or comment where no reachable input violates the rule; "could validate more" without an input that wrongly passes; callers that do not exist in the repository; style.

## Sources
- `archive/developer-0.2.2/skills/specify/SKILL.md` (gotcha on old stored data; scope, invariant, counterexample, owner decisions).
- `archive/developer-0.2.2/skills/model/SKILL.md` (gotcha on missing/empty/malformed; absence semantics; guarantee placement).
- `archive/developer-0.2.2/skills/model/references/problem-modeling.md` (absence partition, default owner, ability vs guarantee, guarantee owners, internal invariant vs external relation, empty-set quantifiers).
- `archive/developer-0.2.2/skills/model/references/contract-and-replacement-models.md` (requires/ensures, replacement relation, breaking change hidden as validation).
- `archive/developer-0.2.2/skills/model/references/relational-constraint-models.md` (quantified integrity, `NULL`/bag/endpoint translation, unobserved mutation paths).
- `archive/developer-0.2.2/skills/sketch/references/evidence-preserving-boundaries.md` (parse vs validate, construction and escape audit, trusted compiler gaps, parse before first effect).
- Alexis King, "Parse, don't validate," November 5, 2019.
- Hillel Wayne, *Logic for Programmers*, v0.14.0, 2026-05-04: Chapters 2-5, pp. 5-60 (predicates, ability/guarantee, contracts, replacement); Chapter 7, pp. 73-88 (relational integrity, SQL translation).
- Harold Abelson and Gerald Jay Sussman with Julie Sussman, *Structure and Interpretation of Computer Programs*, Second Edition: Sections 2.1, 3.1, 3.3.5.
- Matthias Felleisen, Robert Bruce Findler, Matthew Flatt, and Shriram Krishnamurthi, *How to Design Programs*, living build 9.2.0.3: Preface, Chapters 19-20, Intermezzo 4.
- Zachary Tellman, *Elements of Clojure*, Leanpub 2019-02-11: Indirection, public-manuscript pp. 70-89 (model, environment, assumptions, drift).
- Replay experiment, 2026-10-29 (two gotchas above, recorded in `docs/plans/2026-10-30-restructure.md`).
