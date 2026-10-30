# Design Surface

Read this when the contract is accepted but the code shape is not: you do not
yet know which data definitions, operations, owners, or variation mechanism the
change needs, and starting to edit files would mean guessing. The output is a
filled template (data, caller code, interface table, queue) that makes the first
implementation step small enough to execute and check. If the shape is already
obvious from existing code, skip this and implement.

## Procedure

Work in this order; skipping ahead to helpers or patterns is the usual failure.

1. **Data first.** Write each definition with its interpretation, one example
   per clause, and the values it excludes. In an existing codebase recover this
   from schemas, types, fixtures, persisted samples, and UI states; keep any
   contradiction (a legacy shape the type omits, two same-shaped values with
   different meaning) visible instead of picking one.
2. **Raw versus refined.** When input is broader than the accepted domain
   (wire, form, storage, legacy, nullable), write both forms and one function
   `parse: Raw -> Result<Domain, Error>` that runs before the first effect.
   Its input is the narrowest type the caller already holds; do not widen to
   `unknown` just to re-check. A `validate(): boolean` followed by a cast is
   not a refinement.
3. **Template from shape.** Derive branches before writing bodies (table
   below). Purpose and examples decide which ingredients the body uses; record
   any field you deliberately ignore and why.
4. **Write the caller first.** Express the top-level result in product language
   using operations that do not exist yet. Each wished operation earns its
   place only if it solves a separately nameable domain problem, delegates to
   another data definition, or exposes an intermediate result someone needs.
   Length alone is not a reason. Adjacent steps must agree on ordering,
   effects, and failure; never split an atomic invariant for a neat pipeline.
5. **Assign owners.** Each decision, invariant, default, and piece of history
   gets exactly one owner that also holds the knowledge needed to answer it.
   Repeatedly pulling fields out of one unit so another can interpret them
   means the responsibility sits in the wrong place. A boundary is real only
   if it hides a consequential choice callers no longer need to know.
6. **Pick the least powerful variation mechanism** (ladder below).
7. **Name by stable sense** (rules below).
8. **Queue.** Order 2-5 items so the first is executable and checkable alone.
   List deferred abstractions explicitly instead of building them speculatively.

## Template From Data Shape

| Data shape | Template consequence |
| --- | --- |
| atomic / interval | parameter + domain constants; branch only at boundaries that change behavior, each with a boundary example |
| itemization (sum type) | one branch per clause; no catch-all unless every remaining value has one known meaning |
| record | selectors for the fields the purpose needs; say why the others cannot affect the result |
| self-reference | natural recursive call exactly on the self-referencing field; test at least two layers |
| reference to another definition | delegate to that definition's own function; one function per definition |
| two complex inputs | decide first: one controls (traverse it, carry the other), lockstep (state the same-shape invariant and the mismatch result), or independent (explicit cross-product / decision table) |
| complex output | output clauses constrain constructors; if several outputs are valid, that is unresolved policy |
| interactive / async UI | define `State` and `Event` first; handlers branch on both; write event traces including a stale response |

Two shapes that are not structural:

- **Generated subproblem** (recursing on a computed value, not a field): state
  trivial cases, how the next instance is generated, why its answer contributes,
  and a measure that decreases on every branch.
- **Accumulator** (extra parameter carrying knowledge): first write the
  invariant relating original input, remaining input, and accumulated value;
  it must hold initially, after every branch, and imply the result at the base.
  Without that it is hidden state. Wrap it if only one initialization is valid.

## Variation Ladder

Build the variant x operation matrix (mark unsupported cells), name who chooses,
then take the first rung that meets the obligations:

| Mechanism | Fits when | Adds |
| --- | --- | --- |
| direct use | one variant today | nothing |
| reference (pass the value/function) | a trusted caller already chose | caller owns choice |
| local exhaustive conditional | few closed cases, untrusted key, or meaningful order | one owner for cases and precedence |
| table / map | independent modules add named cases | key identity, duplicate, missing-key, load-time policy |
| dispatch / registration / role | variants repeatedly force edits to old owners and callers can stay ignorant of concrete types | startup, discovery, conflict, substitution obligations |

Moving overlapping predicates into a table relocates precedence; it does not
remove it. Check by adding one fake variant and one fake operation: code should
stay unchanged only along the axis the mechanism claims to open. Extract a
shared abstraction only after two completed, correct designs align under
roles with domain meaning (`sum` and `allReady` share base / project / combine
-> a `fold` candidate), and old call sites become simpler clients.

## Naming

- Before renaming, complete: `<old> says <X>, but callers rely on <Y>`. If you
  cannot state `<Y>`, the problem is a missing concept, not a word.
- Name data by role or invariant, not field inventory or storage format.
- Name pure transformations by their result (`toScheduleContent`), effects by
  action and destination (`saveScheduleContent`). `get`, `cached`, `effective`
  must not hide I/O, writes, or a default-precedence policy. An honest composite
  (`loadAndCachePrice`) beats a false pure name.
- Exclude meanings the value cannot support (`data`, `manager`, `handler` admit
  everything) without exposing a library or widget that may change. Keep
  external vocabulary intact at adapters.

## Output Template

```ts
// Purpose (product language):
// Cases: case | input | expected result | why it matters
// Data: clauses, interpretation, excluded values, raw -> refined
type Raw = ...;        // provenance:
type Domain = ...;     // invariant carried:
parse(raw: Raw): Result<Domain, ParseError>

// Wished top-level code, written before any helper body
function featureEntry(input) {
  const value = parse(input);   // fails before any effect
  ...
}
```

| Wished operation | Contract (in -> out, failure) | Owner | Hides from callers | Stop check |
| --- | --- | --- | --- | --- |

```text
Ownership: decision/invariant/history -> single owner
Variation: matrix, choice owner, chosen rung, rejected weaker rung and why
Renames: <old> says X, callers rely on Y -> <new>
Queue: 1. <smallest executable item + its check>  2. ...
Deferred: abstractions and policies not yet earned
```

## Sources

Distilled from `archive/developer-0.2.2/skills/`: `sketch/SKILL.md` and references
data-driven-design, data-shape-template-catalog, composition-by-wishes,
responsibility-and-collaboration, design-levels-and-boundaries,
representation-barriers, evidence-preserving-boundaries, variation-roles,
selection-and-creation, generic-dispatch-systems, earned-abstraction,
generative-recursion, accumulator-invariants; `variation-judgment` (SKILL.md,
reference-conditional-table); `naming-judgment` (SKILL.md, domain-naming);
`module-judgment/SKILL.md`.

- Matthias Felleisen, Robert Bruce Findler, Matthew Flatt, Shriram
  Krishnamurthi, *How to Design Programs*, official living build 9.2.0.3,
  released 2026-05-28: Preface, Ch. 3-6, 8-11, 14-16, 19, 23-34, Epilogue.
- Harold Abelson and Gerald Jay Sussman with Julie Sussman, *Structure and
  Interpretation of Computer Programs*, Second Edition, MIT Press, 1996:
  Sections 1.1-1.3, 2.1, 2.4-2.5, 3.1, 3.4.
- Sandi Metz, Katrina Owen, TJ Stankus, *99 Bottles of OOP*, Second Edition,
  v2.2.2, 2024: Chapters 1-9.
- Zachary Tellman, *Elements of Clojure*, Leanpub, 2019-02-11: Names pp. 7-26,
  Indirection pp. 64-95, Composition pp. 98-119.
- Alexis King, "Parse, don't validate," 2019-11-05.
- Hillel Wayne, *Logic for Programmers*, v0.14.0, 2026-05-04: Chapter 5.
