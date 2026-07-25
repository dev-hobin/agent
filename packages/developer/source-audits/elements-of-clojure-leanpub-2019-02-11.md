# Source Audit: *Elements of Clojure* — Leanpub 2019-02-11

## Status

**Complete — faithful after repair.** The provided 121-page Leanpub PDF and all
120 physical pages of the authorized first-printing manuscript were read and
visually inspected. Cross-version comparison, integrated package repair, and
verification are complete. Fidelity is claim-relative to the source exclusions
and Developer adaptations recorded below.

> Integration note: this audit's post-repair hashes attest its fidelity snapshot.
> Current environment/interface, process, and candidate-review ownership was
> later reorganized in
> [`cross-source-judgment-integration-2026-07-24.md`](cross-source-judgment-integration-2026-07-24.md).

## Audit Question

Does `@hobin/developer` preserve the book's useful design judgments without:

- turning Clojure idioms into language-independent laws;
- treating a current referent as the stable sense of a name;
- treating internal self-consistency as proof of environmental usefulness;
- adding indirection without independent change pressure;
- confusing a returned value with the execution, data, waiting, and failure shape
  of a process;
- copying source defects or its deliberately broad philosophical claims; or
- attributing modern production protocols to a book that explicitly leaves
  system-level protocol design out of scope?

## Source Identity And Authorized Targets

### Provided audit input

- Path: `/Users/boostree/Desktop/elementsofclojure.pdf`
- Title: *Elements of Clojure*
- Author: Zachary Tellman
- Leanpub publication date embedded in the PDF: 2019-02-11
- Leanpub page count: 121 physical pages, printed pages 1-117
- PDF metadata creator: LaTeX with `hyperref`
- PDF metadata producer: XeTeX 0.99999
- File size: approximately 2.2 MiB
- SHA-256:
  `e82f22d9d42ae9c622bd6a7efb95857c8919a9a8627eb3d6ea6599a9c7f755a7`

The current [official Leanpub page](https://leanpub.com/elementsofclojure)
identifies the book as 100% complete, last updated 2019-02-11, and reports 121
pages. Its schema metadata gives the same publication date and page count as the
provided PDF.

### Public first-printing manuscript

- Official site: <https://elementsofclojure.com/>
- Authorized PDF:
  <https://elementsofclojure.com/manuscript/elements_of_clojure.pdf>
- Copyright page: first printing January 2019
- ISBN: `978-0-359-36058-1`
- PDF metadata creation: 2019-02-22
- PDF metadata producer: Adobe PDF Library 15.0
- Page count: 120 physical pages, printed pages 4-119
- Retrieval date: 2026-07-24
- SHA-256:
  `e67b7970dafbc5991bac1ca260fa9531bd2bea2c7a8266f43de12662df3e400a`

The public manuscript is professionally typeset and paginated differently from
the Leanpub PDF. Token and multiset comparison found the same substantive prose,
examples, footnotes, and chapter sequence. Differences are front matter,
pagination, running headers, side-note placement, line breaking, and extraction
order. No substantive revision was found. Public-manuscript printed pages are
therefore used for future source traces; the crosswalk below preserves the exact
provided-PDF scope.

### Web evidence hashes

- official site HTML:
  `c8fe5260888a1bc8895e70f761358627d678322463b99e181eb1e9c83c93b6ec`
- Leanpub page HTML:
  `d53f8ea72c257e4045acd822bb9a002aed0c4391391d0cff72293b155084f9e1`
- public-manuscript extracted text:
  `b212be63109ff18061758e39e3fa451fb51d0e8f73b44a32f7a19b295356b50d`
- normalized cross-version comparison artifact:
  `f50cd7aa6e0c99f3e5381a36430d4df39bdac2eaad3c34d4db884f5e7624e05c`

The local PDFs and extracted text remain audit evidence under `/tmp`; they are
not package artifacts.

## Ingestion And Visual Method

PDFKit extracted the provided PDF to:

- `/tmp/eoc-audit-e82f22d9/book.txt`
- 3,090 lines, 168,608 bytes
- SHA-256:
  `eb4eb21c5675e45b58f8d388e54c9d84d768f2e1870f416497201593f60b5e3c`

The public manuscript was extracted to:

- `/tmp/eoc-audit-e82f22d9/official-book.txt`
- 4,396 lines, 168,457 bytes
- SHA-256:
  `b212be63109ff18061758e39e3fa451fb51d0e8f73b44a32f7a19b295356b50d`

Every physical page of both PDFs was rendered at 1,400 pixels wide. Contact
sheets were inspected for cover/front matter, code layout, footnotes, chapter
transitions, the module diagram, principled/adaptable system diagrams, and blank
terminal pages. Focused full-page renders were used where code or interval
notation required exact reading.

The contact-sheet hash manifest is:
`4e3e0676b2ab8a4649b4f82e04e76f02b0c6222d3f9a30729fdabf83597b6f67`.

<!-- markdownlint-disable MD013 -->

| Visual unit | Physical pages | SHA-256 |
| --- | ---: | --- |
| provided front matter | 1-7 | `a3a3e7af259510d06bf6e2587f50050a3e1f6ecf0bab73a720a16c0551472a53` |
| provided Names | 8-27 | `214e9fc4027f2ea16e651d8439318426fa9a297e8e505a64f470d3521d263cbc` |
| provided Idioms A | 28-46 | `efd37ec222773c8000d44b6a7bd19799a87834a69de71516c0b78172c86ea749` |
| provided Idioms B | 47-65 | `c63e3858a37c277bc6fda4fc5bb6998f9f6fdcb666fe0686d4d086324e5d362d` |
| provided Indirection A | 66-82 | `6e83315e389fa5c394e74c731fe42f8be39796615bdbcc439f753ac5090f99ed` |
| provided Indirection B | 83-98 | `ae699ae92d28f11ced742b78d8b771811fef5b49a361ae1d3d7d034bdd53deed` |
| provided Composition A | 99-110 | `321d5c60494b532a8c5acecf78b1ac459b7548c3019ffef7f454430fee041cfd` |
| provided Composition B | 111-121 | `bcdb37c0b3bba2eec1bfec8ec50f934b6e9d74112aba6132deb9fa804c11018d` |
| public front matter | 1-7 | `fc426e2544855ae452c51843b9bec49f785bcda8c732df035a12a5c74e29a18f` |
| public Names A | 8-18 | `5922bf9a9d95dfbb3abbf4e1c388a297de98329c0cc2be325df266852abbc8cd` |
| public Names B | 19-29 | `9b5ee17371b7e00a2a4887bcad5ba72fc205a6c7f32b61c5ea9428b940ef4222` |
| public Idioms A | 30-46 | `99cd38017a5e778c6d0ecccf9758ece08190873b76b14217763d9d3f260431d3` |
| public Idioms B | 47-63 | `4787c67dbe96e502b85b5cb44932f9c97c24a2f1cbe27670a545a00948ae4c7f` |
| public Indirection A | 64-80 | `d08300d7907b4c81744e5c24e4c16669ed672415e2a349c05c822bb25c06adb5` |
| public Indirection B | 81-97 | `35c7074d85028a87ea9ded8aa4ff738c8fafc4c15ed2a0121a9973e3dec005c9` |
| public Composition A | 98-109 | `78718bab9d23c7235b0a37009698da310354de8313972a4e8ae91de27c5bad6e` |
| public Composition B | 110-120 | `67e74dedd7f710fbe61090c92586b9ebe5107e1a5d7de423d76173723225f9db` |

<!-- markdownlint-enable MD013 -->

## Scope Crosswalk And Reading Status

<!-- markdownlint-disable MD013 -->

| Unit | Provided physical / printed pages | Public physical / printed pages | Status |
| --- | --- | --- | --- |
| cover, publication, contents | 1-4 / unnumbered | 1-3 / unnumbered | complete |
| Introduction and Acknowledgements | 5-7 / 1-3 | 4-6 / 4-5 plus blank | complete |
| Names | 8-27 / 4-23 | 7-29 / divider plus 7-26 | complete |
| Idioms | 28-65 / 24-61 | 29-63 / divider plus 30-61 | complete |
| Indirection | 66-98 / 62-94 | 63-97 / divider plus 64-95 | complete |
| Composition | 99-121 / 95-117 | 97-120 / divider plus 98-119 and blank | complete |
| package cross-reference and repair | eight baseline targets including `SOURCES.md` | n/a | complete |

<!-- markdownlint-enable MD013 -->

## Continuity And Source Intent

The book is a cumulative design argument, not four independent essays:

```text
Names
  -> let readers stop at truthful semantic layers
Idioms
  -> make syntax-to-intent mappings predictable
Indirection
  -> define what a boundary hides, assumes, and costs
Composition
  -> assemble bounded models into whole processes and systems
```

The author explicitly rejects a closed-form design formula. The intended
capability is to articulate tacit judgments about boundaries, their audience,
the environment, and the consequences of hidden assumptions. A faithful package
must therefore preserve questions and tradeoffs rather than convert chapter
headings into universal rules.

## Chapter Audit: Introduction

### Reconstructed capability

Software design cannot make the problem domain, users, or physical world simple.
It can make design intuition discussable. Boundaries are judged in an environment,
not by an context-free formula.

### Package implication

- References should produce explicit environment and assumption artifacts.
- A respected source must not become a mandatory route or pattern destination.
- A fidelity verdict must remain claim-relative.

## Chapter Audit: Names

### Narrowness and consistency

A useful name balances two independent pressures:

- it is narrow enough to exclude unsupported senses;
- it is consistent with local code, domain language, ecosystem convention, and
  the reader's expectations.

Narrow does not mean implementation-specific. The current value or mechanism is
the referent; the stable properties and expected direction of change form the
sense. Equal referents can require different names when readers expect them to
diverge. Distinct names imply an intentional distinction even when values happen
to coincide today.

Natural names allow analogy and gradual participation but carry many inherited
senses. Synthetic names can be precise for an initiated audience but impose a
steep learning boundary. Audience and layer therefore affect naming judgment.

### Data, function, and macro names

Data names cannot enforce the invariants they imply. The source places most
validation at the system periphery, where external data enters. Let-bound names
can expose semantic layers only when hidden expressions are sufficiently pure;
effects force readers to reopen the implementation.

Function names should reveal scope crossing:

- pull functions name what enters the current scope;
- push functions name the effect or destination;
- transformations name the domain result or conversion;
- a genuinely combined operation needs an honest combined sense.

Macros are weak indirection when readers must mentally macroexpand them, and are
also weak indirection when their transformation semantics, exceptions, and
failure modes must be memorized. This Clojure-specific conclusion should not be
turned into a cross-language naming rule.

### Package judgment

`domain-naming.md` is substantially faithful. It already separates sign,
referent, and sense; makes effects visible; calibrates audience; and refuses to
redesign modules under naming authority. It needs exact source scope and one
explicit check for equal current referents with independent expected evolution.

## Chapter Audit: Idioms

### Durable capabilities

The chapter's durable lesson is not its individual Clojure recipes. Idioms create
predictable mappings from code shape to intent so readers can descend only when a
meaningful surprise requires it. Operationally unusual code should remain
visibly unusual.

Several examples transfer beyond Clojure:

- impurity, dynamic scope, laziness, and higher-order invocation can destroy a
  reader's ability to reason from returned values alone;
- a state representation should make atomicity and snapshot boundaries visible;
- accessors should reveal the intended data shape instead of merely exploiting a
  more generic host-language capability;
- absence must have bounded, interpreted meanings rather than accumulating
  ambiguity through a pipeline.

### Contextual rules not imported

The following remain Clojure-version and project-context specific:

- implementing accumulator functions at every arity;
- option-map calling conventions;
- dynamic vars, `binding`, `with-redefs`, atoms, refs, agents, and STM;
- explicit `do` formatting;
- `letfn`, Java interop syntax, `for`, and `nil` coercions.

### Package judgment

The package correctly keeps these idioms subordinate to target-language
conventions. It imports only the semantic boundaries: honest effects, narrow
access, absence, process shape, and explicit state ownership.

## Chapter Audit: Indirection

### References, conditionals, and dispatch

References convey a choice; conditionals decide among choices. Moving an ordered,
overlapping rule list into data does not make its decision ownership open. It
only relocates precedence. A registration table reduces this ambiguity only when
keys, conflict ownership, duplicate policy, and unsupported behavior are explicit.

The book's binary claim that an open mechanism must be unordered is useful as a
warning, not a universal theorem. Extensible ordered rules are possible when
priority and conflict semantics are part of the contract. Likewise, dispatch
openness and performance form a design tradeoff, not an invariant law across all
languages and runtimes.

### Modules as models

A module has four judgment surfaces:

```text
environment: users, world, and other software
model: represented facets and equivalences
interface: interaction boundary and public sense
assumptions: omitted facets required to stay fixed or irrelevant
```

Internal invariants can enforce self-consistency. They cannot permanently enforce
that the environment still matches the model. External validation establishes a
time-bound observation, not an eternal fact. Drift therefore needs an observation,
mitigation, or accepted failure boundary.

Abstraction treats some differences as equivalent. Including a facet says that
changes to it may invalidate prior understanding; omitting it creates an
assumption. A model that reflects more of its environment may be more robust but
is also harder to understand. Over-engineering is therefore relational: the
model assumes a broader environment than current and near-future use justifies.

### Principled and adaptable structure

A principled component shares assumptions and purpose internally. It can use
weaker indirection and remain locally comprehensible, but is shaped toward one
purpose and is more fragile when that purpose changes.

An adaptable system uses stronger boundaries between independently changing
components. This adds redundancy, navigation, and runtime cost. An interface
pulled by multiple independent participants or purposes can stabilize; an
interface serving one fixed purpose tends to collapse into implementation-shaped
indirection.

The durable synthesis is:

```text
short-lived, cohesive components
separated where necessary by longer-lived interfaces
```

Foundational/public interfaces calcify. Mature them under local control before
exposing them when possible. Co-locate modules with common assumptions and
separate modules whose assumptions or replacement pressure differ.

### Package judgment

The package captures the module tuple and principled/adaptable distinction but
understates drift, single-purpose-interface collapse, and public-interface
calcification. These need repair in `problem-modeling.md`, sketch references,
recipe cards, and timing judgment.

## Chapter Audit: Composition

### A unit of computation

For this book, a process is an author-defined reasoning unit with:

- bounded data scope or explicit shared references;
- sequential local execution;
- pull, transform, and push behavior sufficient for standalone usefulness;
- waiting dependencies where other processes can delay progress.

This is not a universal claim about every OS process, actor, callback, or runtime.
The package should use it as a process-inspection model.

Data isolation is partial because shared references create edges. Execution
isolation is partial because paused work depends on surrounding processes. A
queue offers signaling and thread safety but does not by itself bound waiting or
make two processes independently understandable.

An execution model states what happens when the environment supplies too much or
too little: ignore, queue, block, time out, retry, back off, fail, or report. The
book directly discusses timeouts, retries, exponential backoff, and queue
coupling. Cancellation, idempotency, production capacity budgets, and complete
distributed retry protocols remain Developer extensions.

### Pull, transform, and push

The phases have different responsibilities:

```text
pull:
  acquire external input
  bound and validate shape/size
  own invalid and unavailable behavior
transform:
  compute with context-light data
  accrete, reduce, or reshape deliberately
push:
  interpret an effect descriptor
  cross into the environment
apex:
  compose the phases at the last responsible moment
```

A robust pull boundary must retain control while effectful input is consumed.
Returning an effectful lazy sequence can invert ownership: decoding, I/O errors,
resource lifetime, retry, and truncation then leak into the transform. This does
not require callbacks in every language; it requires the operational owner to
enclose acquisition and consumption.

Reduction declares an equivalence relation by discarding distinctions. Reshaping
should be explicit because representation costs and abilities change. Converting
an inspectable effect descriptor into an opaque closure gains executable
semantics while losing inspectability and transformability, so interpretation
should be delayed.

### Process composition and tasks

Static topologies can use anonymous channels. Dynamic topologies need identity,
resolution/discovery, or routers. Commands often move through several processes
toward an effect. Acknowledgment lets some owner distinguish outstanding from
completed work.

The source suggests remembering incomplete tasks at one system edge so
intermediate processes can forget them, then explicitly says complete
system-level protocol design is outside its scope. Treat single-edge ownership as
a useful candidate, not a universal distributed-systems law. Full delivery,
deduplication, idempotency, cancellation, retry, recovery, and observability
protocols are Developer adaptations or require another authoritative source.

### Package judgment

`processes-state-and-time.md` has a strong process/state artifact but currently
understates partial process isolation, queue coupling, execution models,
effectful-lazy acquisition, and task acknowledgment ownership. Its adaptation
note also incorrectly classifies all retry and backpressure-like demand behavior
as Developer-only even though the book directly discusses timeout, retry,
backoff, waiting, and downstream capacity.

## Confirmed Source Defects And Quarantined Claims

The book is an essay and design vocabulary, not a language specification. The
following are not derivation evidence.

### D1 — malformed multi-arity function

Public printed p. 36, Leanpub printed p. 31: the first `pi` example omits a closing
parenthesis after the two-argument arity. The supplied form fails Clojure 1.10.1
with `EOF while reading`. Runtime check hash:
`81339a98225b8a4148c93ac8d86ce3e1b7f8034f27bf62373387dcea82094e80`.

### D2 — reversed `cons` example

Public p. 58, Leanpub p. 57 claims `(cons nil :callisto)` produces a one-element
list containing `:callisto`. Clojure 1.10.1 raises
`IllegalArgumentException` because the keyword is in the sequence position. The
intended example is equivalent to `(cons :callisto nil)`.

### D3 — overbroad `get` characterization

Public p. 59, Leanpub p. 58 says Clojure treats anything that is not a map as an
empty map for `get`. Clojure 1.10.1 returns indexed values for vectors and strings;
it returns `nil` for the shown unsupported scalar lookup. The actual boundary is
host lookup semantics, not map versus non-map. Runtime evidence hash:
`d464e1022a05b70b4df5e1470697c50aad330e8be9575ea3a8eebdba552052a9`.

### D4 — incomplete monoid definition

Public pp. 33-35, Leanpub pp. 27-30 discusses identity and same-type combination
but omits associativity from its informal monoid definition. The package does not
import “support every arity” as an algebraic or language-independent rule.

### D5 — unstated integer domain in interval explanation

Public p. 66, Leanpub p. 64 describes the residual intervals as `[11, 15]` and
`[0, 4]`. That is correct only when `n` is integral. Clojure comparisons accept
ratios and floating values, for which values such as `10.5` remain valid. The
package retains the precedence lesson and requires an explicit domain.

### D6 — dispatch statements are heuristics

Public pp. 66-69, Leanpub pp. 64-67 makes broad claims about unordered openness,
static dispatch, and efficiency being inversely proportional to openness. These
are useful design pressures but not portable runtime laws. The package keeps
conflict, precedence, extension, visibility, and cost as separate questions.

### D7 — proof and model philosophy is deliberately broad

Public pp. 70-80, Leanpub pp. 68-79 says proofs lack context and broadly contrasts
deductive and inductive software models. Proofs can explicitly model environment
assumptions, and software can mix deductive and inductive mechanisms. The package
uses the narrower claim: self-consistency under stated assumptions does not prove
product usefulness.

### D8 — oracle claims are not universal

Public p. 84, Leanpub p. 83 says machine-learning models can never be understood.
Interpretability depends on model class, observer, explanation standard, and
required claim. This rhetoric is not imported.

### D9 — effectful file sequence omits resource closure

Public pp. 109-110, Leanpub pp. 107-108 identifies size, encoding, and I/O failure
but the shown lazy file-line sequence does not close its reader. Resource lifetime
and cancellation remain required package process checks.

### D10 — edge-held task state is a bounded pattern

Public p. 118, Leanpub p. 116 recommends one edge owner for outstanding tasks,
while explicitly leaving system-level protocol design out of scope. The package
must not infer exactly-once delivery, deduplication, durable recovery, or safe
retry from this paragraph.

## Baseline Package Targets

<!-- markdownlint-disable MD013 -->

| Path | Pre-repair SHA-256 | Main source capability |
| --- | --- | --- |
| `SOURCES.md` | `6d940775f53caeacaba5b3c0484946d03e82b071c7c9ed1666830df041df9c3b` | source pin and capability matrix |
| `skills/naming-judgment/references/domain-naming.md` | `9a47d0a311457f5f699813349b41bed14ccdf87bf7d665202cbc02032b060dd2` | sign/referent/sense, audience, effects |
| `skills/model/references/problem-modeling.md` | `d7c118c836a2e01add2465da63fab89674d1dbe5a264f490415b5fa6f386e873` | absence, models, assumptions, drift |
| `skills/schedule/references/structural-change-timing.md` | `135929f315da4a0706e39bd3cf1ceeab7c2c1783ec089242456438fa08722daf` | environment-relative over-engineering and interface timing |
| `skills/sketch/references/abstraction-composition-and-state.md` | `d30669bc73f1df5624356b233596c03296e02ca798483d251486323c7aa00ea0` | module tuple, principled/adaptable structure, process phases |
| `skills/sketch/references/processes-state-and-time.md` | `8ad4cfbb9df24b23aa7bec7e90f17c1ffb45ae2b7b939fde628903679c159703` | process isolation, execution model, phase and task ownership |
| `skills/sketch/references/responsibility-and-variation.md` | `1422d5d133f8377e32fe5d4e36afc78c5739c6751fc49465b23671275e92cf66` | indirection, conditionals, dispatch, cohesive ownership |
| `skills/abstraction-review/references/recipe-cards.md` | `6be21ad843c895ba93a58ff86b2a667261592e76e4e801f48f3407072519703e` | candidate stability, process and interface stop checks |

<!-- markdownlint-enable MD013 -->

## Integrated Repair Queue

### E1 — pin both authorized forms

Add the Leanpub 2019-02-11 audit input and the public first-printing manuscript,
hashes, page counts, equivalence boundary, and audit link to `SOURCES.md`.

### E2 — make provenance exact

Replace all broad 2019 source traces with public-manuscript section/page scopes
and the audit link. Add the missing timing trace.

### E3 — preserve naming's evolution observer

Add the same-referent/different-expected-evolution check to `domain-naming.md`.
Keep Clojure macro and punctuation conventions contextual.

### E4 — distinguish internal invariant from environmental drift

Add self-consistency, time-bound external validation, drift signal, and mitigation
to `problem-modeling.md`.

### E5 — strengthen module and interface judgment

Add current/future environment, single-purpose interface collapse, independent
participant pressure, and public-interface maturation to
`abstraction-composition-and-state.md`.

### E6 — qualify conditionals and registration

In `responsibility-and-variation.md`, state that moving overlapping rules into
data does not remove precedence ownership. Registration must specify key,
duplicate, conflict, visibility, and order policies.

### E7 — complete the process contract

In `processes-state-and-time.md`, add partial data/execution isolation, active
versus paused dependencies, too-much/too-little execution policy, queue coupling,
effectful-lazy acquisition ownership, and acknowledgment/outstanding-task
ownership. Correct the adaptation boundary.

### E8 — improve recipe stop checks

Make process and responsibility cards reject hidden wait/failure ownership and
single-purpose interfaces without independent change pressure.

### E9 — repair timing provenance and criteria

Use environment-relative over-engineering, model growth, interface calcification,
and replacement cost in `structural-change-timing.md`, while leaving migration,
telemetry, rollout, and rollback protocols as Developer adaptations.

### E10 — quarantine defects without expanding routes

Record D1-D10 here, keep source-independent artifacts in package references, and
retain existing route ownership. No source-derived `reference-policy.json`
change is currently warranted.

## Repair Application

All ten repair items were applied without changing `reference-policy.json`:

- E1 pinned the Leanpub input and public first-printing manuscript;
- E2 replaced broad provenance with exact public-manuscript sections/pages and
  audit links across seven detailed references, and added the missing schedule
  trace;
- E3 added the expected-evolution observer to naming judgment;
- E4 separated internal invariants from time-bound environmental observation and
  drift;
- E5 added participant pressure, single-purpose boundary collapse, external
  calcification, and local interface maturation;
- E6 retained precedence, overlap, conflict, visibility, and unsupported-case
  ownership when conditionals move to registration;
- E7 completed process isolation, execution-model, effectful acquisition, and
  task-acknowledgment artifacts while correcting the adaptation boundary;
- E8 strengthened process and responsibility recipe stop checks;
- E9 added environment-relative timing, model growth, replacement cost, and
  interface exposure criteria; and
- E10 quarantined D1-D10 without expanding routes or copying source code.

### Post-Repair Package Target Hashes

<!-- markdownlint-disable MD013 -->

| Path | SHA-256 |
| --- | --- |
| `SOURCES.md` | `fbe0729acb7237046f2ec8c84d6b88996978a79a4d0ba96a03457d8b61fc74ff` |
| `skills/naming-judgment/references/domain-naming.md` | `456b66e1bd06d482b6e7287fd8b430470716f4827a290d3361f4bb075748c974` |
| `skills/model/references/problem-modeling.md` | `654d250d6cf71e599d54d131ee2eae127b74217782cea2a7ffe44474b8d67fe5` |
| `skills/schedule/references/structural-change-timing.md` | `016f36c9015d60620423e14e3ea45e3e8095299fde58ce709b730a43a364bb68` |
| `skills/sketch/references/abstraction-composition-and-state.md` | `8ee35183f1a8917090ba7c5369f114b1e082eeb295aaa064f6c41e79bd8d0539` |
| `skills/sketch/references/processes-state-and-time.md` | `d65f67332ff6cce34ef498a47154aadd90227b11c309a774dfd1b4d7ebb1836d` |
| `skills/sketch/references/responsibility-and-variation.md` | `87d740d3d967301bda6a794c0ef7f9b0bc711dbcc7c4ea80891479b721ca8f8c` |
| `skills/abstraction-review/references/recipe-cards.md` | `d5e6d505b49c79780c6d1311c60ac43b3f3a9e94017fb041fae5e162851a64ca` |

<!-- markdownlint-enable MD013 -->

## Verification Evidence

- Leanpub source SHA-256, publication metadata, and 121-page count were
  independently checked against the current official Leanpub page.
- The public first-printing manuscript was retrieved from the author's domain;
  its SHA-256, 120-page count, metadata, and visual layout were recorded.
- The complete provided text was read in physical-page order. Every physical page
  of both versions was rendered and inspected. Normalized section-level token
  comparison found no substantive prose difference.
- Clojure 1.10.1 reproduced the malformed option-map example failure and the
  `cons`/`get` runtime discrepancies; dependency and result hashes are recorded
  above.
- All 17 EoC package/audit Markdown links resolve to four unique targets; local
  audit links exist and both external canonical URLs returned HTTP 200.
- `npm run check`: package structure consistent; tests **139/139** passed.
- Full lens scan across all nine touched package/audit files: no findings. Eight
  files were LSP-confirmed; `SOURCES.md` did not complete within the Marksman
  budget, so no LSP-clean claim is made for that file.
- `git diff --check` across all nine touched files: clean.
- The eight post-repair hashes above were recomputed with zero mismatches.

## Fidelity Verdict

**Faithful after repair.** The package preserves the book's durable judgment
surfaces without turning its language idioms or rhetoric into universal rules:

- names expose a stable sense, audience, scope crossing, and expected evolution
  rather than the current referent alone;
- idioms remain project/language conventions while purity, absence, access, and
  state boundaries transfer independently;
- modules expose environment, model, interface, assumptions, internal
  consistency, and environmental drift;
- principled cohesion and adaptable indirection are selected by shared
  assumptions and independent change pressure, not by pattern prestige;
- process claims include data edges, active order, paused dependencies, waiting,
  overload, unavailable input, phase ownership, resources, acknowledgment, and
  residual protocol risk;
- public interfaces are allowed to mature before calcification, and
  over-engineering is judged relative to credible use rather than code shape.

This verdict does not endorse every source example or philosophical claim. The
malformed Clojure form, reversed `cons`, overbroad `get`, incomplete monoid,
unstated integer intervals, portable-dispatch overclaims, proof/model/oracle
rhetoric, omitted file closure, and bounded task-owner pattern remain excluded or
qualified. Full cancellation, idempotency, durable recovery, production capacity,
telemetry, migration, rollout, and delivery protocols remain Developer
adaptations. Existing route ownership is sufficient; no source-derived
`reference-policy.json` change was warranted.
