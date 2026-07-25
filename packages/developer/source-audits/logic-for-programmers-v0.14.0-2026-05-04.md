<!-- markdownlint-disable MD013 -->

# Source Audit — *Logic for Programmers* v0.14.0

## Status

**Complete — faithful after repair.** All 204 PDF pages were read in order and
visually audited. Front matter, Chapters 1-13, Appendices A-D, exercise answers,
and index are complete. The integrated repair queue is applied and package
verification is green. Fidelity is claim-relative to the beta-source exclusions and
Developer adaptations recorded below.
be read in order before package repair or a fidelity verdict.

> Integration note: this audit's post-repair hashes attest its fidelity snapshot.
> Current model and verification references were later reorganized by contract,
> relation, time, proof/solver, and logic/search judgment in
> [`cross-source-judgment-integration-2026-07-24.md`](cross-source-judgment-integration-2026-07-24.md).

## Audit Question

Do the `@hobin/developer` references derived from *Logic for Programmers*
preserve the source's practical logic methods, semantic boundaries, examples,
and ability-guarantee tradeoffs without overstating tests, contracts, proofs,
models, solvers, or logic-programming tools?

## Source Identity

- Title: *Logic for Programmers*
- Author: Hillel Wayne
- PDF version: `0.14.0`
- PDF date: `2026-05-04`
- PDF source supplied for this audit:
  `/Users/boostree/Desktop/logic.pdf`
- PDF SHA-256:
  `2f9d0447f2d0581df87a56d8c8ead1677263c091a03f27e31224a291448e5b60`
- PDF physical pages: `204`
- PDF producer: `MiKTeX-dvipdfmx (20260113)`
- PDF creation timestamp: `2026-05-04 21:14:47 +0000`
- Extracted page-labeled text:
  `/tmp/logic-audit-2f9d0447/book.txt`
- Extracted text size: `6,827` lines, `308,327` bytes
- Extracted text SHA-256:
  `eb7260d3d72ca940780c262dd13640ffbbdd709200a9d2691c811536a757c296`
- Rendering tool: `/tmp/logic-audit-2f9d0447/render.swift` using PDFKit
- Official companion repository:
  <https://github.com/logicforprogrammers/book-assets>
- v0.14 companion commit:
  [`6ec1070d304fb92c537f5510f8d938054fb5899d`](https://github.com/logicforprogrammers/book-assets/commit/6ec1070d304fb92c537f5510f8d938054fb5899d)
- Local v0.14 companion snapshot:
  `/tmp/logic-audit-2f9d0447/book-assets-v0.14`
- Companion manifest: `60` files; manifest SHA-256
  `d13c011c0e54cf29117dbdd22097ceb9f00ec708186f99857d2f71424b3e4b5f`
- Official sales/source page: <https://leanpub.com/logic>
- Author's v0.14 announcement:
  <https://buttondown.com/hillelwayne/archive/new-logic-for-programmers-and-the-future-of-this/>

The supplied PDF and companion commit agree on the v0.14 changes: major
copyediting and technical editing, SMT `unknown` handling, rewritten system
refinement, the term “ability-guarantee tradeoff,” replacement terminology, and
layout fixes. This remains explicitly beta text: Chapter 1 says structural
revision is complete but error correction, copyediting, and formatting remain,
and `[[double braces]]` mark author uncertainty. Later versions are not silently
used to repair v0.14 claims.

## Method

1. Read all `204` PDF pages in physical order, including acknowledgements,
   contents, exercises, appendices, answers, and index.
2. Use the page-labeled extraction for continuous prose and search only as a
   navigation aid.
3. Render every chapter and inspect code, truth/decision tables, formulas,
   figures, captions, sidebars, diffs, and layout where extraction can change
   meaning.
4. Compare runnable examples with the exact v0.14 companion commit, not current
   `master`.
5. Record direct support, qualification, contradiction, omission, beta defects,
   and Developer adaptation separately.
6. Defer package repair and the final fidelity verdict until the complete book
   has been read.

## Book Continuity

The author specifies a weakly cumulative structure:

1. Chapter 2 is the required logic foundation.
2. Chapters 3-12 are mostly independent technique chapters with explicit
   backreferences where needed.
3. Chapters 3-8 apply logic to everyday software work.
4. Chapters 9-12 introduce specialized logic-based tools for harder problems.
5. Appendices provide notation, rewrite laws, logic boundaries, and exercise
   answers.

This audit still reads the book linearly so later qualifications can constrain
claims derived from earlier chapters.

## Reading Progress

| Unit | Extracted text | PDF labels | Physical pages | Status |
| --- | --- | --- | --- | --- |
| cover, title, acknowledgements, contents | `book.txt:1-148` | cover, `1`, `i-iv` | 1-6 | complete |
| Chapter 1 — Intro: How to Ride a Bike | `book.txt:149-270` | 1-4 | 7-10 | complete |
| Chapter 2 — A Crash Course in Logic | `book.txt:271-857` | 5-22 | 11-28 | complete |
| Chapter 3 — Refactoring Code | `book.txt:858-1216` | 23-33 | 29-39 | complete |
| Chapter 4 — Writing Better Tests | `book.txt:1217-1667` | 34-46 | 40-52 | complete |
| Chapter 5 — Composing Code Correctly | `book.txt:1668-2189` | 47-60 | 53-66 | complete |
| Chapter 6 — Proving Code Correct | `book.txt:2190-2615` | 61-72 | 67-78 | complete |
| Chapter 7 — Working with Data | `book.txt:2616-3172` | 73-88 | 79-94 | complete |
| Chapter 8 — Decoding Decisions | `book.txt:3173-3523` | 89-99 | 95-105 | complete |
| Chapter 9 — Modeling Domains | `book.txt:3524-3981` | 100-114 | 106-120 | complete |
| Chapter 10 — Designing Systems | `book.txt:3982-4793` | 115-138 | 121-144 | complete |
| Chapter 11 — Solving Math Problems | `book.txt:4794-5402` | 139-155 | 145-161 | complete |
| Chapter 12 — Logic Programming | `book.txt:5403-5873` | 156-168 | 162-174 | complete |
| Chapter 13 — Coda | `book.txt:5874-5894` | 169 | 175 | complete |
| Appendix A — Math Notation | `book.txt:5895-5964` | 170-172 | 176-178 | complete |
| Appendix B — Useful Rules | `book.txt:5965-6101` | 173-177 | 179-183 | complete |
| Appendix C — Beyond Logic | `book.txt:6102-6221` | 178-181 | 184-187 | complete |
| Appendix D — Answers to Exercises | `book.txt:6222-6691` | 182-196 | 188-202 | complete |
| Index | `book.txt:6692-6827` | 197-198 | 203-204 | complete |
| package cross-reference and repair | eight targets below | n/a | n/a | complete |

## Before-Audit Package Targets

| Path | SHA-256 before this audit |
| --- | --- |
| `SOURCES.md` | `72797e2f638028d8bac8e088d856bc3c23195b478738efa6ba9dc8de3c93e101` |
| `skills/abstraction-review/references/recipe-cards.md` | `9be44e2c1cfa89ae7db45e3fff1d4c6306ebccc24dde381981d87ec71430db16` |
| `skills/model/references/problem-modeling.md` | `666b3aa504bb4c3c490e12ceb092996329e558bac11352706cdd543e6cecc9c2` |
| `skills/model/references/worked-models-and-specialized-techniques.md` | `f298c0f1db142829744464195f800740393d37ac9a98103e32a55e018517463b` |
| `skills/schedule/references/structural-change-timing.md` | `78d580400c6950407297f2bd13a8740ea1cc38442e9551d53175b3e72ee6bae6` |
| `skills/sketch/references/abstraction-composition-and-state.md` | `a57dd36af318b0e9ecea82a048a11a253eae3833bd767df56539c056d0d26127` |
| `skills/sketch/references/generic-operations-and-languages.md` | `ccbcfd44d22d1285c9053a2fa3aad4c49b3c1fd928686a5cc96c4431c0f0cc09` |
| `skills/verify/references/verifier-selection-and-pass-but-wrong.md` | `f821c0e4d1f87abedb1fb78621abf7ab68f53369b2944a254cbb82f0bccebc54` |

## Front Matter And Chapter 1 Findings

### Source Intent

The book is a practical technical how-to for programmers without formal-math
training. Its “ride a bicycle, not build one” metaphor rejects theory-first
coverage: readers should manipulate logical expressions and apply them to
requirements, refactoring, tests, contracts, data, decisions, models, solvers,
and logic programs. Accessibility and ease of use are explicitly preferred over
full precision or rigor.

This constrains package use. The source can calibrate practical artifacts and
boundary questions, but it cannot by itself justify claiming theorem-textbook
coverage, production completeness, or tool-level expertise.

### Notation And Representation Boundary

- Predicates are written `TitleCase`; ordinary functions use `snake_case`.
- Programming operators such as `&&`, `||`, `!`, and `=>` replace conventional
  mathematical glyphs where possible.
- Quantifiers use English-like `all` and `some` notation.
- Indexing defaults to zero unless the demonstrated tool uses one-based indexing.
- Abstract predicate bodies are later marked with backticks; this is a local book
  convention, not standard mathematical syntax.
- Pseudocode and Python are teaching representations. Tool chapters may use their
  own native syntax and indexing.

The notation lowers entry cost but must not be mistaken for host-language
runtime semantics. Chapter 1 explicitly points readers to language-specific
idioms after understanding the general example.

### Continuity And Capability Boundary

The first six technique chapters are everyday practices; the last four are
specialized tools. The author says each field could fill a book and that only its
most basic applications appear here. Therefore package references should route
specialized models or solvers only when the problem has that shape and should
not present one introductory example as a universal workflow.

### Visual And Extraction Evidence

- Physical page 1 contains an image-only cover; text extraction correctly reports
  no extractable text.
- Physical pages 4-6 show a correctly aligned contents table. The line-based
  extraction interleaves section titles and page numbers on physical page 5, so
  its apparent ordering defects are extraction artifacts.
- Physical page 9 preserves Python indentation and typographic emphasis that the
  extracted text loses.
- Front render hashes are recorded under
  `/tmp/logic-audit-2f9d0447/front/`; representative hashes include cover
  `f9fe2cd7a1282e24d66f531b3a0a8f6cae219f0a6f5dd83440c0a13974f415f6`,
  contents page 5
  `ff2f316fb334974993fe431e64009d155788c72afd98c600d4c9e8d4fa0eaec8`,
  and code-layout page 9
  `9c43cc2dd2f2110509a7fc69dc6db4e13124b6b7d5c10a104d8b01b32527dcf8`.

### Initial Package Comparison

The package's source label (`0.14.0`, May 4, 2026) matches the supplied PDF.
The broad capability matrix also matches the author-declared chapter grouping.
The existing references still use broad chapter descriptions rather than exact
page/section provenance; whether their claims are complete or overbroad remains
open until Chapters 2-12 and the appendices are read.

## Chapter 2 — A Crash Course in Logic

### Intended Reader Change

The chapter installs a small first-order-logic vocabulary that later technique
chapters reuse. The main move is from informal requirements to manipulable
predicates over explicit sets, connected by Boolean operators, implication, and
scoped quantifiers. Logic is presented as a communication and transformation
tool, not only as executable code.

### Predicate Versus Program

A predicate states a Boolean relationship; a program function includes a method
for computing it on a particular platform. This permits intentionally abstract
predicates such as `CanRunProgram(c)` before thresholds or implementation
mechanisms are known. Concretization is a modeling step: replace informal bodies
with smaller predicates and logical structure without pretending unspecified
terms are executable.

This directly supports separating facts and decisions in `problem-modeling.md`.
It also qualifies that support: a mathematically meaningful predicate may be
noncomputable, underspecified, or operationally expensive. A specification is not
an implementation or verifier merely because it has predicate syntax.

### Ambiguity Becomes Distinguishing Cases

The RAM/CPU/GPU requirement demonstrates that natural-language grouping can
hide two formulas. A complete three-variable truth table finds exactly the rows
where they differ. The durable method is:

```text
ambiguous sentence
-> named subpredicates
-> candidate formulas
-> distinguishing assignments
-> stakeholder decision
```

Formalization does not infer which interpretation the stakeholder intended. It
makes the unresolved choice observable. This is stronger than merely rewriting
one plausible reading.

### Implication Is A Conditional Obligation

`P => Q` is defined as `!P || Q`: require `Q` only when `P` holds. It supports
conditional requirements and statement-strength comparisons, and is transitive.
Its major review hazard is vacuous truth. An implication says nothing about `Q`
when `P` is false; a quantified approval policy can be true when nobody reviewed
anything unless existence is stated separately.

This yields a package-level boundary: implication is suitable for scope and
preconditions, but green evaluation dominated by false antecedents is weak
evidence for the consequential branch.

### Sets, Types, And Quantifiers

Sets supply explicit domains and support union, intersection, difference,
subset, map/filter comprehensions, and quantifier scope. The text compares a
subset to a subtype but defers actual substitutability to the contracts chapter;
membership alone must not be promoted into a complete Liskov claim.

The two quantifiers have separate evidence obligations:

- `some x in S: P(x)` requires one witness;
- `all x in S: P(x)` requires every member and is true on the empty set;
- nested quantifier order changes the claim—one reviewer per PR is not one
  reviewer for every PR;
- `all` plus implication filters the members under obligation;
- existence may need to be conjoined explicitly to avoid vacuous success.

### Ability-Guarantee Tradeoff

If one language, permission set, representation, or tool admits more possible
behaviors, it generally supports fewer universal guarantees. Restricted formulae
can always receive finite truth tables; arbitrary quantified formulae cannot.
Read-only access excludes destructive behavior that full access permits. ASCII's
restricted character set gives byte-width guarantees that Unicode does not.

The book presents this as a recurring design axis, not a proof that restriction
is always preferable. Unicode, write access, and quantifiers provide necessary
abilities. A structural decision must name both the gained ability and the lost
guarantee rather than treating “more expressive” or “more constrained” as an
unconditional good.

### Rewrite Rules And Proof Boundary

Logical refactoring relies on equivalences such as De Morgan, distribution,
identity, implication expansion, contrapositive, quantifier duality, and selected
quantifier distribution/extraction. The chapter distinguishes equivalence from
plausible but invalid distribution and demonstrates two proof styles for
contrapositive: equational rewriting and exhaustive truth tables.

A rewrite is behavior-preserving only under its logical interpretation. The next
chapter explicitly audits where program execution diverges from mathematical
logic, so package use must not yet equate a theorem with a safe source-code
rewrite.

### Notation As A Defined Interface

The text permits local notation when it is consistent and explained. Range syntax
must define descending/empty behavior; conjunction lists must define indentation,
numbering, and `||` grouping. Concision without edge semantics recreates the
ambiguity notation was meant to remove.

### Visual And Beta Evidence

- All physical pages 11-28 were rendered. Chapter contact sheet SHA-256:
  `b5389086187283b87c14f261b3ea7b5df5fdda91eea20ca0bd14bf838eaa87d6`.
- Truth tables, rewrite tables, code indentation, conjunction-list nesting, and
  formulas are visually intact.
- Physical page 20 contains a real annotated quantifier diagram but also visibly
  retains the beta marker `[[Temporary diagram]]`. The marker is a source defect,
  not derivation evidence.
- Physical page 24 retains `[[Exercise 17]]` although the relevant invalid
  distribution exercise is numbered 14 in this PDF. This is a beta cross-reference
  defect and is excluded from source claims.

### Chapter 2 Package Comparison

The current `problem-modeling.md` source summary is directionally faithful but
understates four reusable boundaries: abstract predicate versus computation,
distinguishing cases versus inferred intent, vacuous truth/existence, and nested
quantifier order. `structural-change-timing.md` correctly names the
ability-guarantee tradeoff but will need exact Chapter 2 provenance and explicit
bidirectionality: gaining guarantees can cost needed abilities.

## Chapter 3 — Refactoring Code

### Intended Reader Change

The chapter turns Chapter 2's laws into source-code refactoring moves:
normalize conditions, use enclosing branch facts, replace search loops with
quantifiers, merge or dualize quantifiers, expose hidden constants, and choose
sets when uniqueness and unorderedness are the real data contract.

### Derive, Rewrite, Return To Code

The proposed loop is bidirectional rather than “translate once”:

```text
program
-> logical formula
-> one justified rewrite at a time
-> program
-> inspect language and readability effects
-> repeat if useful
```

Explicit intermediate steps and named laws provide review evidence when a
rewrite is not obvious. Enclosing branches contribute facts: inside `if P`, `P`
is true; in its `else`, `P` is false. Those facts can remove redundant nested
checks.

### Quantifier Refactoring

Loops that search for one matching item or reject on the first failure often map
to `any`/`some` and `all`. Duality and distribution may collapse two traversals
into one. Predicate bodies should then be reopened: a term independent of the
quantified variable belongs outside, and negated comparisons may have a clearer
positive operator or domain name.

The source correctly separates logical simplicity from reader simplicity. It
explicitly allows stopping before flipping normal and exceptional branches when
the shorter formula would mislead maintainers.

### Pass-But-Wrong Boundary Missing From The Source

The chapter says a law-preserving formula rewrite preserves program behavior,
but its two-pass-to-one-pass examples preserve only extensional Boolean results
under pure, total, stable predicates over the same finite collection. They can
change:

- predicate call count and order;
- short-circuit demand;
- exceptions or divergence;
- mutation, logging, I/O, and other effects;
- observations of a concurrently changing collection;
- latency and resource behavior.

Chapter 3's “Programs are not math” section warns about collection identity,
truthiness, and missing operators but does not state this evaluation/effect
boundary. “Thoroughly tested” in the summary is not a substitute for naming the
preserved observers. Package references must qualify these rewrites rather than
copying the chapter's broad behavior-preservation wording.

### Sets As Guarantee-Bearing Representations

A set can move uniqueness enforcement from repeated procedural checks into the
representation. It also communicates that order and multiplicity do not matter.
The tradeoff is real: sets cannot represent duplicate/order semantics, host
languages differ on equality and hashability, and JavaScript object identity can
make two visually equal arrays distinct members.

The companion benchmark is claim-relative, not a universal complexity proof.
For its generated workload (`m=1000`, `k=60`) on this audit host, 100 runs took
approximately `0.807s` with lists, `0.0035s` with prebuilt sets, and `0.102s` with
set conversion. The fixture uses unseeded random sampling, compares results only
as sets, drops the bidirectional-graph premise for the benchmark, and does not
preserve output order. It supports “can be much faster for this workload,” not
“set conversion is always faster.”

### Visual And Companion Evidence

- All physical pages 29-39 were rendered. Chapter contact sheet SHA-256:
  `65e6ac45710c1fab8ac2927252d22df91dc9b1eda3886a3797513b7777836482`.
- Formula-step tables, nested branches, generators, multiline source changes,
  and set examples are visually intact.
- Exact v0.14 benchmark source SHA-256:
  `193f599e1a44de179924d063ee067a82b7756581cf796eea48158154748835fc`.

### Chapter 3 Package Comparison

The current package correctly warns that programs are not math and requires
runtime-aware verification in its broader references. The direct Logic source
trace is too broad, though: it does not expose purity, totality, demand, effects,
or observer-relative preservation at the place where logical refactoring is
claimed. This is a likely qualification repair for `problem-modeling.md`,
`recipe-cards.md`, and `verifier-selection-and-pass-but-wrong.md` after full-book
review.

## Chapter 4 — Writing Better Tests

### Intended Reader Change

The chapter reframes tests as predicates over implementations and specifications
as predicates relating valid inputs to outputs. This makes test strength,
property-based testing, partial specifications, structural properties, oracles,
and metamorphic relations comparable without pretending that generated examples
are exhaustive proof.

### Strength Is An Implication Relation

A test/specification `P` is at least as strong as `Q` when no candidate
implementation can pass `P` and fail `Q`, written `P => Q`. Strength can increase
by widening the covered input domain or making a more specific output claim.
Different tests can be incomparable, so implication forms a partial order rather
than one universal coverage score.

The book also exposes a crucial trap: logical `false` implies every property, but
a test that always fails is not useful correctness evidence. Test evidence requires
both a meaningful obligation and an implementation that satisfies it.

### Total And Partial Specifications

A total specification is true exactly for correct implementations over a stated
input domain. The `max` derivation requires both membership in the input and no
larger element; “output is sorted” alone similarly cannot specify sorting without
preservation of input elements and multiplicity.

Most practical properties are partial. Their value is not only lower-cost checking:
separate partial clauses localize which obligation failed. The chapter's useful
tradeoff is:

- a stronger passing property supports a broader correctness claim;
- a narrower failing property can diagnose the violated responsibility more
  precisely.

This is claim-relative evidence, not a rule to prefer weak tests generally.

### Property-Based Testing Is Sampling, Not Quantification

PBT turns the logical input domain into a generator and the output relation into
assertions. Hypothesis adds pathological examples and counterexample shrinking.
The text explicitly says a few hundred generated lists are not `TotalSpec` and
are not even logically stronger than one fixed example they might never generate.
They can nevertheless provide much more practical confidence.

Generator domain, filtering, distribution, shrink behavior, run count, seed, and
oracle/property strength are therefore part of the supported claim. Green random
runs do not prove an unbounded universal statement.

### Structural Properties Need Domain And Observer Definitions

Fuzz/no-crash, idempotence, round-trip, oracle equivalence, symmetry, and
metamorphic relations are reusable property shapes, not ready-made truths:

- idempotent purchasing needs an operation key, effect boundary, and time window;
- `join(split(x)) == x` depends on delimiter/escaping and normalization contracts;
- old/new oracle equality must define outputs, errors, effects, and resources to
  preserve;
- image transformations preserve labels only inside a justified tolerance/domain;
- `--verbose` can preserve functional output while intentionally changing a
  diagnostic channel;
- search-result subset relations assume the advertised semantics of `AND` and
  `OR` and stable underlying data.

The source hints at some of these through examples but does not always state the
observer explicitly. Package adaptations should.

### Confirmed v0.14 Source Defect

The refactoring oracle example on PDF label 43 and exact v0.14 companion file
`test-refactoring.py` implements:

```python
all(P(x) and not Q(x) for x in l)
```

The Chapter 3 derivation requires `all(P(x) and Q(x) for x in l)`. A singleton
list containing a value for which both `P` and `Q` are true makes the v0.14 old
and refactored functions disagree. Companion commit `f7d3c982f602d6a29277c87b829010b0aa7edb36`
for v0.15 changes `and not Q(x)` to `and Q(x)`, independently confirming the
v0.14 error. This later fix is defect corroboration only; v0.15 content is not
used as v0.14 derivation evidence.

The defect is pedagogically apt but unintentional: the displayed property test
would find the broken refactor. Package references do not reproduce this formula,
so no current contradiction follows.

### Visual And Companion Evidence

- All physical pages 40-52 were rendered. Chapter contact sheet SHA-256:
  `29befb71252c4c2d459fc043bff8db2c5028a722de3d5ce5a325a0dcb4c1e5af`.
- Physical page 42's property-strength lattice is legible but retains
  `[[Temporary Diagram]]`, another explicit beta marker.
- Formula layout, continued specifications, Hypothesis decorators/assertions,
  shrunk counterexamples, and metamorphic subset relations are visually intact.
- Exact v0.14 companion hashes: `test-max-pbt.py`
  `6287b10550d2b4816529c6ab830e2f1073b05d162afd1bdc583ffd225c64ae28`;
  `test-refactoring.py`
  `bfec6a0dc53ec4c8bcf0126baee6937aa8f756365c96600e555ee46a7c1e2d8b`.

### Chapter 4 Package Comparison

`verifier-selection-and-pass-but-wrong.md` already preserves the central
claim-relative distinction and warns that random sampling, no-crash, round-trip,
and metamorphic greens support only their own properties. Final repair should add
exact Chapter 4 provenance and inspect whether test strength is consistently
scoped to candidate implementation, input domain, observer, and generator.

## Chapter 5 — Composing Code Correctly

### Intended Reader Change

The chapter moves from isolated function specifications to compositional
obligations. A correct callee can still be used incorrectly; callers must establish
its preconditions and may rely only on its guaranteed postconditions. Contracts
then become a common language for assertions, type invariants, replacement,
subtyping, API evolution, and schema/model evolution.

### Contracts Propagate Across Call Boundaries

A contract packages requirements and guarantees:

```text
caller facts => callee.Pre
callee.Pre => callee.Post
callee.Post + remaining caller work => caller.Post
```

The `max_avail_price` example derives a caller precondition—at least one available
item—from `max` requiring a nonempty list. The key insight is not merely to add an
assertion; it is to move each guarantee to an owner that can establish it and to
make the missing implication visible.

### Assertions Are Checks, Not The Contract Itself

Assertions can fail close to the violated assumption and help localize whether a
caller broke a precondition or a callee broke a postcondition. But:

- language flags may disable them;
- they must not perform required mutation or cleanup;
- postconditions and metamorphic relations may be too expensive or recursively
  self-invoking;
- hostile/user input validation is not automatically a programmer-bug assertion;
- a comment can remain useful reasoning evidence even when runtime checking is
  impossible.

The companion `do_nothing` exercise correctly exposes the pass-under-debug,
wrong-in-production failure caused by placing `pop()` inside an assertion.

### Types, Invariants, And Representation

Types are treated as contracts with broadly cheaper/static checking and contracts
as more expressive but harder to check. The source presents this as a rough rule,
not a universal type-theory theorem. Refinement/dependent systems can move the
boundary, and dynamic annotations may not enforce even the advertised base type.
The v0.14 Python MISU companion intentionally constructs an invalid string-valued
`Status`, noting that a type checker can report it while Python still executes it.

A type invariant needs an ownership boundary for every construction and update.
Replacing two Booleans with one enum eliminates one invalid combination but does
not establish unrelated price, transition, persistence, or concurrency rules.
Private mutation paths and public-boundary restoration are part of the invariant
contract.

### Replacement Is Contravariant/Covariant By Obligation

For `new` to replace `old` for existing callers:

```text
old.Pre  => new.Pre
new.Post => old.Post
```

The replacement may require no more and guarantee no less. For types, all old
methods need compatible replacements and every new value must satisfy old
invariants; mutable methods also need change/frame/history conditions. This is
broader than inheritance and applies to versions, APIs, schemas, and models.

The package must retain two qualifications:

1. passing the property tests written for `old` is sufficient only when those
   tests are accepted as the complete observer/specification; an ordinary partial
   suite cannot establish universal substitutability;
2. adding an object field is safe only under an “at least these fields” contract.
   Closed schemas, signatures, strict decoders, key merges, reflection, size, or
   enumeration can observe the addition.

### Guaranteed Versus Merely Observed Behavior

A postcondition is what the provider promises, not everything currently true.
Hyrum's Law supplies the social counterpressure: at scale, consumers depend on
observable accidents and even bugs. Logical replacement is therefore necessary
but may not be operationally sufficient. Compatibility evidence must identify the
actual observer population, known usage, telemetry, migration, and rollback.
Those production practices are Developer adaptations; the source supplies the
logical core and warns of social messiness.

### Source Overstatement

The chapter opens by saying that passing the Chapter 4 property tests means `max`
is correct. Chapter 4 explicitly established that randomized PBT samples are not
the total specification and may miss a fixed input. Read charitably, the sentence
means “assume an implementation satisfying the specification”; literally, it
contradicts the prior evidence boundary. Package references must preserve the
Chapter 4 qualification and not derive proof from green generated tests.

### Visual And Companion Evidence

- All physical pages 53-66 were rendered. Chapter contact sheet SHA-256:
  `7de6f1792b9456993617db22c21f6ebe21ddfa79ff342487a40d1ec6a5415b4a`.
- Contract indentation, the quadratic formula, replacement implications, type
  definitions, and postcondition examples are visually intact.
- Physical page 58's call-chain diagram retains `[[temporary diagram]]`; its
  “subset” caption is illustrative, not a formal subset proof.
- Exact v0.14 companion hashes: `avail_price.py`
  `2e8288c65cdedb29fae9489bb1f21a5b3bddece2f26e5fcf3851efbbd250f58c`;
  `max-contracts.py`
  `d65deeb0f13367fbabdf10970a3d11e840dc7db932f496dc190fea6434fb69ba`;
  `misu.py`
  `bbfe4971d18c2f000f0bd022b645957794eac1248736024bdc73ccf571a5da86`.

### Chapter 5 Package Comparison

The package's replacement rules are directly supported and already include
behavioral observers beyond return values. Final repair should add exact Chapter
5 provenance, qualify “all old tests pass” as specification-relative, keep runtime
validation separate from assertions, and mark migration/telemetry/rollback as
Developer adaptation rather than source doctrine.

## Chapter 6 — Proving Code Correct

### Intended Reader Change

The chapter distinguishes confidence from deductive assurance. A proof starts
from explicit assumptions, tracks facts through each step, and establishes that
postconditions follow. Formal verification makes proof obligations mechanically
checkable but remains specification-, model-, toolchain-, and assumption-relative.

### Correctness Is Specification-Relative

“Proven correct” means conforming to the stated specification, not doing whatever
users actually wanted. Missing postconditions, false environment assumptions,
unstated performance requirements, concurrent mutation, numeric representation,
and compiler/runtime defects remain outside the proved claim unless modeled.

This boundary is central to `verifier-selection-and-pass-but-wrong.md`: stronger
machinery does not rescue the wrong theorem.

### Loop Invariants Need Initiation, Preservation, Exit, And Progress

The quotient/remainder loop shows three separate proof obligations:

1. initialization establishes `q*y + r == x` and non-negativity;
2. one loop body preserves them;
3. invariant plus negated guard establishes `0 <= r < y` on exit.

A variant/decreases measure supplies a fourth obligation, termination. The
informal proof initially omits this; Dafny's inferred `decreases r - y` makes the
omission visible. Partial correctness without progress is not total correctness.

For iterating collections, “best so far” must name the exact processed prefix and
its boundary. The v0.14 prose proof for `max` contains off-by-one narration:
`l[:0]` is empty before the first body, and Python's `l[:n+1]` excludes index
`n+1`. The displayed Dafny invariant later uses the correct half-open processed
range `0 <= j < i`. Package references do not reproduce the faulty indices and
should retain the general initiation/preservation/exit method only.

### Numeric Model Defect In The Informal Proof

The Python-like `qr_long` proof assumes exact division when asserting
`tmp1 * y == x` after `tmp1 = x / y`. Host floating-point division does not
preserve that equation for arbitrary integers and can round before `floor`. The
proof is valid over an exact real/rational model with the stated floor laws, not
unqualified Python numeric semantics. The later Dafny version uses mathematical
integers and Euclidean division, a different model. This is another concrete
example of a mathematically valid derivation becoming wrong when representation
observers are omitted.

### Formal Verification Workflow And Limits

The verifier may prove obligations automatically or require invariants, lemmas,
or proof steps. Failure to verify indicates an unresolved obligation, missing fact,
tool limit, timeout, or unsupported model—not automatically a code bug. Success
supports only the exact source/specification/toolchain configuration.

The source appropriately stresses cost: the cited IronFleet effort required about
3.7 person-years for 5,114 lines of implementation. Selective verification of a
small high-severity core can be rational while surrounding code uses types,
contracts, tests, and review.

Two broad claims need qualification:

- generated code does not “always” remain reliable independent of compiler,
  runtime, foreign code, or violated assumptions;
- safe-Rust checking establishes memory-safety properties only within its defined
  language/unsafe/toolchain boundary, not the absence of all memory-related
  operational failures.

### Visual And Companion Evidence

- All physical pages 67-78 were rendered. Chapter contact sheet SHA-256:
  `a65a3a90b81b6e93cd5559f0c0fefdf270c2ce5ea3a53d75f61349c83833efc9`.
- Algebra tables, loop invariants, induction layout, Dafny source, VSCode failure
  screenshot, inferred termination popup, and generated Python are visually
  intact.
- Exact v0.14 companion hashes are recorded for `dafny-max.dfy`, both valid and
  invalid loop variants, `qr.dfy`, and generated `qr-python.py`; no Dafny runtime
  is installed on the audit host, so these artifacts were source-compared but not
  reverified locally.

### Chapter 6 Package Comparison

The current package correctly treats proof as specification-relative and keeps
proof/model checks distinct from tests. Final repair should add exact Chapter 6
provenance and ensure proof evidence always names assumptions, arithmetic model,
termination, trusted toolchain, and unmodeled observers. The source's off-by-one,
floating-model, and “always reliable” defects must be excluded from derivation.

## Chapter 7 — Working with Data

### Intended Reader Change

The chapter uses a deliberately simplified relational model to connect `some`
with queries, `all` with integrity constraints, joins with filtered Cartesian
products, invariant duality with counterexample queries, and schema replacement
with abstraction/refinement mappings.

### Logical Model Versus SQL Runtime

Treating tables as sets of typed records is a reasoning model, not literal SQL
semantics. SQL commonly has bag multiplicity, `NULL` and three-valued logic,
collations, engine-specific dates/types, ordering/limits, aggregation/windows,
transaction isolation, and optimizer behavior. A `SELECT 1 ...` query produces
zero or more rows; application code interprets nonemptiness as existential truth.

The model is useful precisely when the translation boundary remains visible.

### Queries, Joins, And Quantifier Duality

- projection/filter maps naturally to set comprehension;
- an inner join is a filter over a Cartesian product;
- an outer join combines matches with unmatched left records extended by nulls;
- `all x: P(x)` can become `not exists x: !P(x)`;
- helper predicates may be compiled into views/CTEs/subqueries when SQL cannot
  name them directly.

Join and `NULL` translations need engine-specific checking. A mathematical
`dm.id == null` is not SQL equality; SQL requires `IS NULL`. Predicates in a
`WHERE` after an outer join also differ from predicates in `ON` because filtering
null-extended rows can turn an outer join into an inner one.

### Confirmed Interval Translation Defect

The logical management interval is half-open:

```text
start_at <= date < end_at
```

The displayed and companion SQLite queries use:

```sql
date BETWEEN start_at AND end_at
```

SQL `BETWEEN` is inclusive at both ends, so a record ending at date 20 matches
the SQL query on date 20 but fails the logical predicate. This is a real v0.14
semantic contradiction, not extraction damage. Package references do not copy
the query and must derive half-open interval policy only from the explicit logical
formula, with endpoint behavior named.

The prose also asks for managers “after date 26” while the query uses date `6`;
this is a beta typo without conceptual impact.

### Constraints Are Empty Counterexample Sets

`CHECK`, `UNIQUE`, and foreign keys correspond to different quantified shapes.
More general invariants can be dualized into queries for violating rows; integrity
holds when the counterexample query is empty. This gives a strong reusable
verification artifact: preserve both the universal rule and the executable witness
query.

Enforcement completeness is event-relative. The v0.14 trigger companion checks
`dep_managers` insert/update but intentionally demonstrates that changing
`employees.hired_at` can still violate `NoTimeTravel`. Trigger correctness needs
all mutation paths, multirow/bulk behavior, transaction isolation, rollback, and
external writers—not just one green insert fixture.

External facts such as URL reachability cannot be maintained solely by database
writes. Periodic diagnostics can find violations but do not make the property an
always-preserved database invariant.

### Change Constraints And State Machines

Prime notation relates old and new values and can express monotonic timestamps,
non-null-after-set, and allowed state transitions. The relation should include
stuttering only when no-op updates are legal and should distinguish legal edge,
source state, target state, actor, and transaction scope.

The displayed v0.14 state-machine formula is malformed: the `READY` source
string lacks a closing quote, and the heading uses `==` where surrounding
notation uses `=` for definition. It is excluded from derivation; the intended
allowed transitions remain clear from prose.

### Schema Replacement Is A Mapping Plus Preserved Laws

A view from the new schema into the old representation witnesses replacement
only if it is total and functional for all valid new data and preserves old
invariants, change rules, and externally observed operations. The source correctly
adds uniqueness, existence, and `NoTimeTravel` obligations after first showing
the view.

Mappings compose transitively, allowing v3-to-v2 and v2-to-v1 reasoning. But a
read view alone does not prove writable compatibility, migration completeness,
identity preservation, performance, concurrency, rollback, or all client queries.
Those are production adaptations beyond the chapter's logical mapping.

### Visual And Companion Evidence

- All physical pages 79-94 were rendered. Chapter contact sheet SHA-256:
  `bff7bc86b181ab5ae6d80ae0e65e22e7388a1394038ed8abf34a32178a6b94cc`.
- Physical page 81 retains `[[Temporary Diagram]]`, page 83 retains
  `[[Does this need a diagram, too?]]`, and page 91 retains an unfinished
  double-brace editorial note. These are beta markers.
- Exact v0.14 SQL companion files were read and run with SQLite. `queries.sql`
  produced the advertised sample rows but does not exercise the inclusive-end
  mismatch. `trigger_invariants.sql` produced the three intended failures and
  then visibly retained the invalid state created through the unguarded employee
  update. `view.sql` produced matching sample projections while its comments
  acknowledge missing compatibility invariants.

### Chapter 7 Package Comparison

`problem-modeling.md` directly reflects counterexample queries, change
constraints, and model mappings, but broad provenance hides the SQL/runtime
boundary. Final repair should add exact Chapter 7 provenance and require endpoint,
`NULL`, multiplicity, mutation-event, transaction, and operation-preservation
checks before treating a logical model as an executable database guarantee.

## Chapter 8 — Decoding Decisions

### Intended Reader Change

The chapter turns finite rule combinations into inspectable decision tables.
Tables reveal missing cases, contradictory overlaps, misunderstood priorities,
impossible states, and irrelevant inputs, while giving technical and nontechnical
stakeholders one concrete artifact to correct.

### Validity Is Not Correctness

A table is complete when every valid input combination is covered and sound when
no combination receives contradictory outcomes. Exact expanded row count is a
quick necessary check only after every input column has a valid finite partition.
A table can have the expected count while one case is duplicated and another is
missing.

Validity does not establish fidelity to requirements, and fidelity to stated
requirements does not establish that stakeholders need the right policy. A table
finds structural gaps; it does not choose the business rule for overlapping
discounts. That choice remains stakeholder-owned.

### Buckets And Compaction Carry Proof Obligations

Each column's buckets must be finite, pairwise disjoint, and cover its admitted
domain. An `any`/dash compacts rows only when the omitted input cannot affect the
output under that prefix. Naively overlapping dashes can assign contradictory
outputs.

The advice never to put `any` left of a fixed value is a conservative formatting
rule for the book's table convention, not a semantic theorem about every decision
table engine. Ordered-first-match rule tables need a separate execution contract.

### Impossible, Irrelevant, And Unavailable Are Different

- `-` means the input exists but is irrelevant to the decision;
- `/` means the input should not be available in that state;
- `ERROR` marks a combination forbidden by model assumptions.

They may expand to similar Boolean rows for counting, but they imply different
production checks. Observing `/` or `ERROR` means either upstream state is wrong
or the table's model is incomplete; it must not be silently treated as an ordinary
false case.

### Reduction Can Hide States

Dropping irrelevant columns, combining dependent inputs, and splitting outputs
can improve readability. Each transformation needs a mapping back to the original
space. Combining `started?` and `submitted?` into one status is wrong if
submitted-without-started can occur—even if that state “should be impossible.”
A smaller table is not stronger evidence unless the representation invariant is
separately established.

Tables fit independent, finite, immediate input-to-output decisions. Loops,
recursion, histories, extensive side effects, dependent inputs, and infinite or
complex domains need predicates, state machines, temporal models, or other
artifacts. One old/new row can describe a transition relation, but repeated
transitions already exceed a one-step decision table.

### Confirmed v0.14 Table Defects

The discount prose says registrations 101-200 receive `8%`; Table 8.1 prints
`3%`, while completed Table 8.2 returns to `8%`. This is a source typo, not a
legitimate ambiguity. Also, “first 100 registrations” is bucketed as inclusive
`0-100`, which contains 101 integers. The domain's indexing convention must be
resolved as `1-100`, `0-99`, or an explicitly noninteger/other range before row
count can support completeness.

### Visual Evidence

- All physical pages 95-105 were rendered. Chapter contact sheet SHA-256:
  `a1d5c3acb331ac00cc46d119190c6d1204608b5ec58a1ce1fe51ba6266ef4f17`.
- Discount, screensharing, overlap, mutation, impossible-input, and MFA tables
  were inspected at full resolution. The `3%` and `0-100` defects are present in
  the rendered PDF, not extraction artifacts.

### Chapter 8 Package Comparison

`problem-modeling.md` and its worked examples already use partitions, forbidden
states, and decision tables. Final repair should add exact Chapter 8 provenance
and make valid-partition/domain/indexing evidence explicit before an expected row
count is accepted as completeness evidence.

## Chapter 9 — Modeling Domains

### Intended Reader Change

The chapter expands from one decision to a domain model: selected entities,
relations, assumptions, decisions, and desired properties define a set of valid
instances. A formal specification tool can generate witnesses and bounded
counterexamples before implementation choices obscure the domain.

### Relations Are Not Owned Fields

Alloy treats `User -> Policy` as a relation that can be traversed in either
direction rather than privileging one object's attribute layout. This removes
synchronization duplication from the mathematical model, but implementation still
must choose indexes, ownership, persistence, and update consistency. A
bidirectional logical relation is not evidence that two mutable object fields will
stay synchronized.

### Runs, Checks, Assumptions, And Decisions Have Different Jobs

- `run P` asks for a witness instance;
- `check P` asks for a counterexample to a desired property;
- `pre` constrains instances considered well-formed;
- `can_access` is a decision that legitimately varies by user/resource;
- a failed property indicates a model/design gap only relative to satisfiable
  assumptions and the bounded scope.

When a new ability invalidates an old guarantee that nobody actually requires,
the chapter converts the old check into a run. This preserves understanding
without mislabeling intentional expressiveness as a defect.

A passing `pre => prop` can be vacuous if `pre` has no instances. Witness runs for
well-formed examples are therefore companion evidence, not optional decoration.

### Scope-Bounded Evidence

Alloy's `for N` limits entity scope, and temporal analysis also uses bounded trace
semantics/settings. “All instances” in the prose always means all instances under
the selected scope and solver semantics. A successful bounded check is powerful
counterexample-search evidence, not an unbounded theorem unless a separate
small-scope/completeness argument applies.

Generated witnesses are not canonical: another satisfying instance may differ.
The value is that every witness obeys the model and can be inspected with the
in-model evaluator.

### Extension Reveals Policy Precedence

Adding group policies increases representable access paths and invalidates the
shortcut “no direct policies means no access.” Adding denials reveals a quantifier
scope bug: “some policy allows and does not deny” is weaker than “some policy
allows and no applicable policy denies.” The fix separates witness for allowance
from universal absence of denial.

The unusual direct-allow/group-deny instance then surfaces an actual stakeholder
question: global deny precedence versus specificity. Solver output makes the
choice visible but does not choose it.

### Time Changes The Model Kind

A static model answers snapshot questions. Marking a relation variable introduces
a sequence of states and permits `eventually`/`always` properties. The
`eventually P && eventually !P` example establishes that both permission states
occur somewhere from the evaluation point; it does not specify their order,
transition cause, fairness, or bounded response.

The extracted text appears to declare `groups` twice, but the full-resolution PDF
strikes out the old immutable field before adding `var groups`; the exact v0.14
companion contains only the variable declaration. This is a formatting/extraction
artifact, not a source defect.

### Visual And Companion Evidence

- All physical pages 106-120 were rendered. Chapter contact sheet SHA-256:
  `82bb3e721881c3a69a1fb1b2c11901b472a351316b86c8b117beb8da01f70c92`.
- Alloy instance diagrams, denial counterexample, unusual edge case, and temporal
  two-state screenshot were inspected.
- Five exact v0.14 Alloy companions were read: base, groups, buggy denial, fixed
  denial/precondition, and temporal variants. No Alloy runtime is installed, so
  solver results were source- and screenshot-compared but not rerun.

### Chapter 9 Package Comparison

The package's model references faithfully distinguish facts, assumptions,
decisions, properties, witnesses, and counterexamples. Final repair should add
exact Chapter 9 provenance and explicitly attach scope, satisfiable-precondition
witnesses, solver result, and temporal bound to every Alloy-like evidence claim.

## Chapter 10 — Designing Systems

### Intended Reader Change

The chapter makes system correctness a predicate over behaviors rather than
snapshots. It derives temporal actions, stuttering, invariants, liveness, fairness,
concurrency races, frame conditions, refinement, and refinement mappings before
showing their TLA+ forms.

### Behaviors, Actions, And Stuttering

A behavior is an infinite sequence of states; real time between steps is abstract.
`Init` constrains the first state, `Next` constrains adjacent states, and stuttering
permits no visible change. Stuttering embeds finite termination in an infinite
behavior and prevents a spec from accidentally requiring useful work forever.

Removing zero-value wire steps without adding stutter makes the finite-money
system eventually have no successor, so no infinite behavior satisfies the spec.
This is a model satisfiability failure, not a liveness counterexample.

Prime notation means next-state value, and a temporal action must constrain every
variable. The three-person `BadWire` example intentionally leaves Carol's balance
unconstrained, allowing arbitrary corruption. Whole-record `EXCEPT` updates or
explicit `UNCHANGED` clauses are frame-condition evidence, not cosmetic syntax.

### Safety, Liveness, And Fairness Are Separate Claims

- safety excludes finite bad prefixes such as a negative balance;
- liveness requires a good condition eventually on every behavior;
- stuttering and scheduler choice can violate liveness while preserving safety;
- weak fairness prevents an action from being postponed forever only when it
  remains continuously enabled, not merely because it is enabled once.

The source's prose gloss of `WF_vars(P)` as “if P can happen” is intentionally
introductory but too weak for package use. Cancellation, intermittent enablement,
crash, retry, and fairness scope must be explicit.

### Concurrency Exposes Check-Then-Act Races

Two workers can each observe Alice's balance before either deducts, accept two
full-balance wires, and later overdraw. Moving deduction to reservation/start
closes `NoOverdrafts` for the modeled transitions. It does not automatically prove
money conservation, eventual deposit, crash recovery, exactly-once effects, or
customer-visible semantics. Each requires its own property and failure model.

### State Space And Model-Checking Evidence

TLC explores the configured finite state graph; the displayed two-person model
has 21 distinct states, three people 496, and four over 12,000. Green output is
relative to constants, state constraints, symmetry/fingerprint settings, fairness,
and checked properties. A counterexample is one behavior witness; its particular
ordering is not necessarily unique.

The PDF's deliberate error edit is mislabeled. It changes `BobToAlice` to permit
amounts `1..6`, but the shown trace performs `AliceToBob` twice and overdrafts
Alice. To produce that trace, the edit must be in `AliceToBob`. The screenshot and
prose agree with each other and contradict the displayed action name. This v0.14
source defect is excluded from derivation.

### Refinement Is Observer-Relative Behavior Inclusion

The multi-step implementation does not directly refine the atomic wire spec:
a sender can observe deduction before the receiver observes deposit. Introducing
`shown_balance` and mapping abstract `balance` to it makes the intended external
observer atomic while `true_balance` retains implementation progress.

A refinement mapping must cover initial states, steps including stutter, hidden
state, and every abstract observer. It can transfer already-proved abstract
properties by implication, but only under the mapping and model-checking bounds.
It does not prove that production code implements the concrete spec. The chapter
explicitly leaves code/spec conformance as the harder follow-on problem and cites
test generation as one emerging bridge.

### Visual And Companion Evidence

- All physical pages 121-144 were rendered. Chapter contact sheet SHA-256:
  `bb9be07025ef8414ea7e5b92ef8be83418b97568eefbb1fd3c79cd11eb377907`.
- TLA+ indentation, strikethrough diffs, model-check status, invariant trace,
  concurrency fix, liveness trace, refinement trace, and mapping edits were
  inspected at full resolution. Extracted duplicate lines are mostly old
  strikethrough plus replacement, not live syntax.
- Exact v0.14 TLA+ and config companions for wire versions 1-4, liveness, and
  refinement were read. No TLC runtime is installed, so source/config/screenshots
  were compared but models were not rerun.
- Physical page 121's counting-orderings URL remains in `[[double braces]]`, an
  explicit beta marker; the stated count `9!/(3!^3) = 1680` is independently
  consistent.

### Chapter 10 Package Comparison

The package already separates snapshot invariants, transitions, safety, progress,
and refinement. Final repair should add exact Chapter 10 provenance and strengthen
fairness, satisfiability, frame-condition, model-bound, and abstract-observer
fields. Production retry, cancellation, telemetry, replay, and rollout remain
Developer adaptations, not TLA+ claims from this chapter.

## Chapter 11 — Solving Math Problems

### Intended Reader Change

The chapter teaches solver selection as modeling: distinguish satisfaction from
optimization, declare variables/domains/constraints/objective, choose a solver
whose supported theory and performance fit, interpret `sat`/`unsat`/`unknown`,
and compare general encoding cost with a bespoke algorithm.

### Satisfaction, Optimization, And Objective Evidence

A satisfying assignment is a witness, not necessarily preferred or unique. An
optimization result additionally needs objective direction, units, bounds, tie
policy, solver optimality status, and all business constraints. Different optimal
models may be equally valid.

The server example shows the benefit of declarative change: storage and per-class
limits can be added without writing a new search algorithm. It also shows why
fixture output alone is insufficient—omitting a capacity, availability, redundancy,
or demand-distribution constraint can make a mathematically optimal plan
operationally wrong.

### Representation Changes Introduce New Invariants

Translating bin assignment from one bin-valued variable per item to a 0-1 matrix
makes multi-bin assignment representable, so a new exactly-one constraint is
required. Auxiliary `bin_used` variables and symmetry-breaking constraints must
preserve at least one representative of every objective-relevant solution class.
A faster encoding that removes a legitimate optimum is wrong.

Encoding size is part of the model: the presented linking relation adds
`#Items * #Bins` inequalities. Runtime claims need problem size, solver/engine,
encoding, hardware, timeout, and result status.

### SMT Result Protocol

Counterexample proving uses duality:

```text
assumptions + not(theorem)
sat     -> concrete counterexample
unsat   -> theorem holds in the encoded theory/domain
unknown -> neither witness nor proof
```

`unknown` must not be collapsed into `unsat`, retry, or success. Bit-vector versus
integer/real domains can reverse a theorem through overflow and signed
interpretation. The source's 8-bit example correctly demonstrates that an
arithmetic proof does not transfer silently to machine integers.

An optimizer also needs an explicit branch for `unknown`/timeout and possibly
unbounded objectives. “No overlapping string” is not the correct generic message
for every non-`sat` optimizer result.

### Decidability Is Not A Runtime Guarantee

The chapter contrasts decidable MiniZinc/ILP-shaped problems with more expressive
SMT theories. The theoretical distinction is useful, but the statement that a
decidable solver will definitely return a solution or impossibility is too broad
for production: finite resources, timeout, numeric approximation, unsupported
features, incomplete engines, unbounded objectives, and tool errors can still
prevent an answer. Package result protocols must retain `unknown`, timeout,
error, infeasible, unbounded, feasible-not-proven-optimal, and optimal as separate
states where the tool supports them.

### Solver Selection Is An Economic Tradeoff

Start expressive for rapid modeling, then lower to ILP or a specialized solver
when measured scale demands it. A bespoke algorithm can win when constraints are
stable and an exploitable structure is known, but the source's “consistently beat”
claim is not universal. The v0.14 annual-deposit binary search ran in roughly
`0.029 ms` on this audit host and returned `373`; this does not form a controlled
cross-tool benchmark against the book's `132 ms` MiniZinc run on another
configuration.

Development time, model change rate, explainability, licensing, correctness
risk, warm starts, operational integration, and runtime all belong in selection.

### Source And Presentation Boundaries

- The low-level Gecode sketch shown for the quadratic equation uses a linear
  relation and is explicitly approximate/partial (“roughly,” setup hidden); it is
  not executable evidence for solving `x*x + 6*x = 9`.
- The MiniZinc float example uses bounded approximate floating variables and
  reported roots; exact real-algebra claims require a different theory.
- Physical page 154 retains `[[Temporary diagram]]` for the bin matrix.

### Visual And Companion Evidence

- All physical pages 145-161 were rendered. Chapter contact sheet SHA-256:
  `715400c41d8e00d8100428f68c093a1ef0d9f356d4b838953c1fcdbe425cf151`.
- MiniZinc notation/output, 0-1 matrix, bin-use diagram, Z3 source, bit-vector
  edits, and result branches were visually inspected.
- Ten exact v0.14 Chapter 11 companions were read. MiniZinc and z3py are not
  installed on the audit host, so solver examples were not rerun; the pure-Python
  comparison benchmark was run as stated.

### Chapter 11 Package Comparison

`problem-modeling.md` already distinguishes variables, hard constraints,
objective, assumptions, and `unknown`. Final repair should add exact Chapter 11
provenance and broaden solver outcomes to include timeout/error/unbounded and
feasible-versus-proven-optimal. `worked-models-and-specialized-techniques.md`
should make symmetry, encoding size, and result status visible in solver artifacts.

## Chapter 12 — Logic Programming

### Intended Reader Change

The chapter separates several logic-programming result models: Prolog derives
zero/one/many substitutions by ordered backtracking; deductive databases trade
expressiveness for terminating query fragments; planners search action paths and
costs; answer-set programs generate multiple worlds satisfying constraints and
objectives.

### Prolog Is An Operational Search Language

Facts and rules define predicates, while variables are unified to produce answers.
Multiple clauses and recursive rules make relations concise, but observable
behavior includes clause/goal order, depth-first search, duplicate derivations,
backtracking, stack use, and termination. Logical equivalence alone does not
preserve those observers.

Prolog `\+ Goal` is negation as failure, not classical negation. It succeeds when
the current search cannot prove `Goal`, so groundness, goal order, closed-world
assumptions, and termination matter. The merge example is safe because both
parents are bound before inequality is negated; moving the negation earlier would
change meaning.

### Confirmed Prolog Query Defect

The PDF asks for “ancestors of `a5` that are not ancestors of `b3`” but prints:

```prolog
ancestor(a5, X), \+ ancestor(b3, X).
```

Given the declared relation `ancestor(Ancestor, Commit)`, the correct query is:

```prolog
ancestor(X, a5), \+ ancestor(X, b3).
```

The exact v0.14 companion uses the correct query. The PDF's printed outputs
`a4`, `a3`, `a2` correspond to the companion, not the displayed query. This is a
source defect confirmed visually, not an extraction artifact.

### Deductive Databases Trade Ability For Termination

Rules can compose data and inference more directly than generated SQL, but full
Prolog admits infinite answer spaces and nonterminating recursion. Datalog's
termination guarantee depends on the restricted/safe finite variant in use;
extensions with function symbols, aggregates, negation, or external predicates
need their own contract.

Answer multiplicity also matters. Prolog can return the same logical value through
multiple proof paths; `setof` deduplicates/sorts but fails when no solution exists
rather than necessarily returning an empty list. A package artifact must specify
proof identity, answer identity, duplicate policy, and zero-answer protocol.

### Planning And Model Checking Are Conditional Duals

A planner searches for a path from start to goal, optionally minimizing a stated
cost. Failure to find a path proves unreachability only for a complete search over
the encoded finite state/action space with a conclusive result—not for timeout,
divergence, pruning, or a missing action. Likewise a model-check counterexample
can witness reachability but does not optimize a plan unless the tool supports the
objective.

The Picat toggle comments are reversed relative to action names and replacements:
`off(server)` changes on to off, while `on(server)` changes off to on. The executable
intent and printed plans remain understandable; comments are excluded from the
derived transition contract.

### Answer Sets Are Possible Worlds, Not One Query Stream

ASP choice rules declare optional facts, integrity constraints remove worlds,
cardinality rules constrain multiplicity, and optimization ranks remaining answer
sets. Evidence must record all/one/optimal model mode, optimization status, ties,
projection (`#show`), and duplicate-world semantics. “Minimum 12” is relative to
the task times, grouping/conflict rules, workers, and max-load objective encoded.

### Visual And Companion Evidence

- All physical pages 162-174 were rendered. Chapter contact sheet SHA-256:
  `068061b6b83527d3daa7338510b51ef18b0951c3e0d6aed1d8e58bed51137da2`.
- Commit graph, Prolog clauses/queries, Picat actions/plans, ASP choice rules,
  aggregates, and optimization were visually inspected.
- Five exact v0.14 companions were read. SWI-Prolog, Picat, and clingo are not
  installed on the audit host, so they were not executed.

### Chapter 12 Package Comparison

The package's model references already distinguish facts, rules, inference,
closed-world negation, proof/answer identity, duplicates, search, fairness, and
divergence—several qualifications that the chapter only introduces briefly. Final
repair should add exact Chapter 12 provenance and keep these operational clauses
visible rather than reducing logic programming to declarative predicates alone.

## Coda And Back Matter

### Coda: Transfer, Not Exhaustion

The coda explicitly limits the book to techniques the author has used and is
comfortable teaching. The intended transfer is not “these are all applications of
logic,” but “reuse the recurring moves—ability versus guarantee, duality,
implication, abstraction, and precise logical expression—in your own specialty.”
This supports package adaptation while requiring adaptations to be labeled rather
than attributed to omitted source domains.

### Appendix A: Notation Is A Translation Layer

The notation table maps the book's programmer-oriented syntax to conventional
logic/set/temporal symbols and distinguishes object-language implication from
proof/metalanguage notation. Package artifacts should preserve semantic meaning,
not copy a glyph convention. `=>`, `->`, and `⇒` can mean different things in host
languages, tools, and proofs.

### Appendix B Contains Material Rule Defects

The “Useful Rules” appendix cannot be treated as a trusted rewrite catalog in
v0.14. Full-resolution inspection confirms these printed defects:

1. `p => !p` is listed as always false. It is true when `p` is false and false when
   `p` is true.
2. Both set-distribution rows have the wrong operators on the right. Correct laws
   are:

   ```text
   A | (B & C) == (A | B) & (A | C)
   A & (B | C) == (A & B) | (A & C)
   ```

3. `p => (p => q)` is listed as a universal strength implication. It is false when
   `p` is true and `q` is false.
4. Prenex movement rules omit the required side condition that the moved
   variable is not free in the unquantified expression, plus ordinary variable
   renaming/capture precautions.

The appendix also has malformed parentheses in the commutativity table. These
are canonical beta defects, not extraction damage. None may be used to justify
package transformations. Chapter-level rules independently demonstrated with
valid truth-table/duality examples remain usable.

### Appendix C Is Explicitly Non-Authoritative

The appendix opens with: “EVERYTHING in the section needs to be thoroughly
checked against a mathematician” and may be removed. Its sketches of Russell's
paradox, higher-order logic, constructive logic, and modal logic are orientation
only. The package currently derives no detailed capability from this appendix and
should not begin doing so during repair.

### Exercise Answers Reveal Additional Defects And Boundaries

The answers reinforce useful lessons—vacuous truth, quantifier order, total versus
partial specs, side effects outside assertions, MISU tradeoffs, symmetry breaking,
and duplicate Prolog proofs—but also contain errors excluded from derivation:

- `IsDivisibleBy` quantifies `1..=num` without a domain policy for zero, negative
  numbers, or zero divisor.
- the sort answer changes `IsSorted` from one argument to two while discussing
  permutation preservation;
- the quadratic postcondition prints `a*a*out + b*out + c == 0` instead of
  `a*out*out + b*out + c == 0`;
- the quotient proof says `x / y > 0` although `x` may be zero; only `>= 0` follows;
- `ValidTransitions(task, ...)` refers to undeclared `t`;
- one relation-composition explanation uses a reversed pair inconsistently;
- the Alloy duality derivation labels implication expansion as contrapositive;
- the invalid-wire answer compares `bob[2]` to `bob[2] + 1` rather than the prior
  state;
- `WireBobToAlice` repeats the Alice-to-Bob updates even though the following
  contradiction uses the correct reverse direction;
- the `<>[]` expansion mixes `t`, `t1`, and `t2`.

These defects do not appear in the package's current examples, but they reinforce
that source fidelity requires claim-level verification rather than trusting the
appendix wholesale.

### Index And Theme Check

The index confirms the package's selected themes: ability-guarantee tradeoff,
replacement/refinement, implication across tests/contracts/specs, duality,
safety/liveness, models, solver classes, and logic-programming modes. It does not
introduce new claims. Its organization supports the existing route distribution:
core modeling and worked specialized techniques, bounded verifier selection,
structural timing, and abstraction/language calibration.

### Visual Evidence

- All physical pages 175-204 were rendered. Back-matter contact sheet SHA-256:
  `8dab64c659a085d24f66ccd40d1afb222794bb25151e0f89f4320fc3f0a0849c`.
- Coda, notation/rule tables, Appendix C warning, all 57 exercise solutions, and
  both index pages were inspected.

## Integrated Repair Queue

Apply only after the complete source comparison:

- **L1 — source pin:** add the audited PDF, exact v0.14 companion commit, all-page
  status, beta boundary, and audit link to `SOURCES.md`.
- **L2 — exact provenance:** replace broad book summaries in all seven detailed
  references with chapter/page ranges or exact section anchors where an official
  stable web anchor exists. The Leanpub PDF has no public section-anchor corpus,
  so page labels and the audit document are the stable local provenance.
- **L3 — predicate/quantifier boundaries:** add abstract-predicate versus
  computation, distinguishing cases versus inferred intent, vacuous truth,
  existence, nested quantifier order, and finite-partition requirements to model
  guidance where absent.
- **L4 — preservation boundary:** make logical refactoring observer-relative;
  purity, totality, evaluation order, effects, errors, and resource behavior must
  be preserved separately.
- **L5 — evidence protocols:** keep sampled PBT distinct from total specs and
  proofs; add bounded-model scope/satisfiability and solver result states including
  timeout, error, unbounded, feasible, and optimal.
- **L6 — state/time:** add frame conditions, stuttering/satisfiability, weak
  fairness's continuous-enablement condition, safety versus liveness, and
  abstract-observer refinement where absent.
- **L7 — data and replacement:** require SQL endpoint/`NULL`/multiplicity/event
  checks and qualify “all old tests pass” as sufficient only for a complete chosen
  observer/specification.
- **L8 — logic-programming result shape:** retain goal order, negation-as-failure,
  proof versus answer identity, duplicates, zero/one/many results, search,
  termination, and optimization status.
- **L9 — defect quarantine:** record and exclude the v0.14 refactor formula,
  half-open/`BETWEEN` mismatch, table ranges/discount, proof arithmetic/indexing,
  TLA action label, Prolog argument order, Appendix B laws, and exercise-answer
  defects listed above.
- **L10 — adaptation boundary:** repository recovery, production migrations,
  telemetry, rollout/rollback, retry/cancellation, distributed replay, and resource
  budgets remain Developer adaptations unless another audited source owns them.
- **L11 — routing:** keep current route ownership. The book's specialized tools
  already map to `problem-modeling`, worked specialized techniques, verifier
  selection, structural timing, and language/runtime references; no new route or
  `reference-policy.json` change is justified.

No repair should import the book's code or notation wholesale. The package should
retain source-independent decision artifacts and bounded examples.

## Repair Application

All eleven repair items were applied without changing `reference-policy.json`:

- source identity now pins the 204-page v0.14 PDF audit and exact companion
  commit;
- all seven detailed source traces now name chapter/page scopes and the audit;
- predicate/computation, vacuous truth, quantifier order, and finite partitions
  are explicit;
- logical refactoring is observer-relative;
- sampled PBT, proof, bounded-model, and solver-result protocols remain distinct;
- stuttering, satisfiability, fairness scope, frame conditions, and refinement
  observers are explicit;
- SQL/runtime and replacement qualifications are retained;
- logic-programming answer/proof/search/negation boundaries remain visible;
- recorded beta defects are quarantined rather than copied;
- production workflow additions are marked Developer adaptations;
- existing route ownership remains sufficient.

### Post-Repair Package Target Hashes

| Path | SHA-256 |
| --- | --- |
| `SOURCES.md` | `6d940775f53caeacaba5b3c0484946d03e82b071c7c9ed1666830df041df9c3b` |
| `skills/abstraction-review/references/recipe-cards.md` | `6be21ad843c895ba93a58ff86b2a667261592e76e4e801f48f3407072519703e` |
| `skills/model/references/problem-modeling.md` | `d7c118c836a2e01add2465da63fab89674d1dbe5a264f490415b5fa6f386e873` |
| `skills/model/references/worked-models-and-specialized-techniques.md` | `a5b643a1ea38618f1cc2d2f51dca3cc7ebd19e5d45cf940f5d3ee12e8c32d109` |
| `skills/schedule/references/structural-change-timing.md` | `135929f315da4a0706e39bd3cf1ceeab7c2c1783ec089242456438fa08722daf` |
| `skills/sketch/references/abstraction-composition-and-state.md` | `d30669bc73f1df5624356b233596c03296e02ca798483d251486323c7aa00ea0` |
| `skills/sketch/references/generic-operations-and-languages.md` | `c27d4f1c54b2935417994396779ad2221d4e3fc86c73082331548ee5fb1d47e9` |
| `skills/verify/references/verifier-selection-and-pass-but-wrong.md` | `fac4dafff280c9752bd585d8cb26838f25f22114de4457bf869ad2a7bb52b3ea` |

### Verification Evidence

- PDF SHA-256, 204-page count, page-labeled extraction hash, exact v0.14
  companion commit, and 60-file companion manifest are recorded above.
- Every page was rendered by chapter; all contact-sheet hashes are recorded in
  the relevant sections.
- Exact companion Python/SQL examples that could run locally were executed;
  unavailable Dafny, Alloy, TLC, MiniZinc, Z3, Prolog, Picat, and clingo runtimes
  are explicitly not represented as rerun evidence.
- `npm run check`: package structure consistent; tests **139/139** passed.
- Full lens scan of all nine touched package/audit files: no findings. Eight files
  were LSP-confirmed; `SOURCES.md` timed out under Marksman, so no LSP-clean claim
  is made for that file.
- `git diff --check` on all nine touched files: clean.
- Post-repair hashes above were recomputed after all reference edits.

## Fidelity Verdict

**Faithful after repair.** The package preserves the book's durable practical
capabilities while strengthening, rather than erasing, its stated boundaries:

- predicates can precede computation, but do not become implementations by
  notation;
- implication, quantifiers, finite partitions, and counterexamples expose choices
  without inventing stakeholder intent;
- test strength is claim-relative and randomized properties remain sampling;
- contracts and replacement preserve pre/post obligations while observed social
  compatibility remains wider;
- proofs and model checks remain specification-, assumption-, arithmetic-, scope-,
  and tool-relative;
- relational and temporal models retain runtime translation, frame, safety,
  liveness, fairness, stuttering, and refinement obligations;
- solvers retain conclusive and inconclusive result states and objective status;
- logic programming retains multiplicity, proof identity, negation-as-failure,
  search order, termination, planning, and answer-set semantics.

The verdict does not endorse every formula in this beta source. The confirmed
v0.14 refactor, SQL interval, decision-table, proof, TLA+, Prolog, Appendix B, and
exercise-answer defects are excluded from derivation. Appendix C is explicitly
non-authoritative. No source-derived routing defect was found, and no
`reference-policy.json` change was warranted.
