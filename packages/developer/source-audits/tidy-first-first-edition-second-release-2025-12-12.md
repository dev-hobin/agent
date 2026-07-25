# *Tidy First?* — First Edition, Second Release Source Audit

## Status

**Complete — faithful after repair.** The provided 125-page PDF was read from
front cover through the final O'Reilly page in physical-page order and every page
was rendered for visual inspection. The 2023 first-release retail preview and
publisher errata were cross-checked. Package fidelity is claim-relative to the
source limitations and Developer adaptations recorded below.

> Integration note: this audit's post-repair hashes attest its fidelity snapshot.
> Current movement, timing, and observer-relative verification synthesis is
> tracked in
> [`cross-source-judgment-integration-2026-07-24.md`](cross-source-judgment-integration-2026-07-24.md).

## Audit Question

Does `@hobin/developer` preserve the durable decision method of *Tidy First?*—
small behavior-preserving movements, behavior/structure separation, timing,
batching, optionality, reversibility, and change-relative coupling/cohesion—
without turning its catalog, financial analogy, review workflow, directional
sketches, or admitted conjectures into universal laws?

## Source Identity

| Field | Evidence |
| --- | --- |
| Title | *Tidy First?: A Personal Exercise in Empirical Software Design* |
| Author | Kent Beck |
| Foreword | Larry Constantine |
| Publisher | O'Reilly Media, Inc. |
| Edition | First Edition |
| Release | Second Release, 2025-12-12 |
| First release | 2023-10-17 |
| Copyright line | Copyright © 2024 Kent Beck |
| PDF ISBN | 978-1-098-15124-9 |
| O'Reilly online ISBN | 9781098151232 |
| Printed body | front matter xi-xix and xxi-xxii; main text pp. 1-96; index pp. 97-99 |
| Physical PDF extent | 125 pages, including covers, blanks, author/colophon, and final O'Reilly page |
| Canonical catalog | <https://www.oreilly.com/library/view/tidy-first/9781098151232/> |
| Publisher errata | <https://www.oreilly.com/catalog/errata.csp?isbn=9781098151249> |

The PDF metadata creation timestamp is 2025-12-11, one day before the embedded
Second Release date. That is consistent with production generation preceding the
published revision date; the explicit revision-history line is the edition pin.

### Local Audit Inputs

| Artifact | SHA-256 | Extent |
| --- | --- | --- |
| `/Users/boostree/Desktop/Tidy First_.pdf` | `51563da994989ad874ad459818b52874cbdfe6180219202415b14b3666e4e29d` | 4,457,582 bytes; 125 physical pages |
| `/tmp/tidy-audit-51563da9/book.txt` | `f6e38b927338a507eaec19bb9540d1b259bce04ad21c8ab0df28886b6425c54d` | 2,926 lines; 146,077 bytes |
| authorized first-release retail preview | `174f0e46cc5b32eb394ae568c06a23a5ff44f7968443e110805a27060b3f7c6e` | 13 physical pages |
| publisher errata snapshot | `7d40175be7109cb79d95940233e66515c61bd82493bbbd8e1104e3d9a6a6c909` | 224,686 bytes |

The retail preview was retrieved from:

<https://api.pageplace.de/preview/DT0400.9781098151218_A49444600/preview-9781098151218_A49444600.pdf>

It carries the First Edition, First Release front matter. It is a cross-version
calibration source, not a substitute for the provided complete Second Release.

## Extraction And Visual Method

PDFKit extracted one physical page at a time with explicit page sentinels. The
complete text was read sequentially. PDFKit/AppKit rendered every physical page
at 1,400 pixels wide. Contact sheets were inspected for all pages, followed by
full-resolution inspection of pages carrying code layout, formulas, diagrams,
curves, captions, or tables.

| Visual group | Physical pages | Contact-sheet SHA-256 |
| --- | --- | --- |
| front matter | 1-25 | `6d0232d9454d20f5a301cddd37c19f21a732a5b1c8963e33876c167b73e0fda8` |
| Part I | 26-56 | `2298a253916edeb7a0458758cd372bb08d2c457788596328d4e9ef4379835478` |
| Part II | 57-78 | `4d995e43e30d4b806cd3f27f1a789b4f1644b1d01461802a316b915d34d297db` |
| Part III | 79-116 | `85a7389319600384f5cd2d06639b60ab0d0a274a9e3855ab20627073a46b8dec` |
| back matter | 117-125 | `efc21f4ea3beeabae5d301d25841e55c5468ad63b31ecadc3075a9b23780a325` |

Focused visual checks included physical pages 19, 59-60, 67-70, 102, 106-107,
111, 113, and 116. These checks recovered the inscription image, behavior versus
structure sequences, batch-cost sketches, coupling formula/graph, cumulative and
per-time cost sketches, coupling/decoupling tradeoff, cohesion alternatives, and
the concluding scope tables.

The empty extracted pages are intentional blanks or part dividers, not failed OCR.
There is no executable companion source. Pseudocode and directional economic
figures were therefore audited as conceptual examples, not runtime evidence.

## Cross-Release And Errata Check

The first-release preview and Second Release agree on title, author, ISBN, chapter
structure, and the visible front-matter argument. Differences in the overlapping
pages are limited to layout/production material and small editorial changes:

- the Second Release adds its 2025-12-12 revision-history entry;
- the publisher address changed;
- the foreword no longer calls the volume “the first of a series”;
- a city-list title-page line differs by production layout.

The publisher lists three confirmed errata. All are corrected in the provided
Second Release:

1. `Yourdan` is corrected to `Yourdon` in Preface p. xix;
2. `changin` is corrected to `changing` in the affected Part III text;
3. Figure 16-2 now expands its caption with `(SB changes)`, making the later
   `SB diffs` table label traceable.

The corrected forms may be used as source evidence. The original errata are not
packaged as advice or examples.

## Complete Reading Ledger

### Front Matter

| Unit | Physical pages | Printed pages | Extracted lines | Status |
| --- | --- | --- | --- | --- |
| cover, praise, title, copyright, dedication, TOC | 1-12 | n/a, vii-ix | 3-233 | complete |
| Foreword | 13-14 | xi-xii | 234-301 | complete |
| Preface | 15-21 | xiii-xix | 302-535 | complete |
| Introduction | 23-24 | xxi-xxii | 536-602 | complete |

The preface defines the book as the first, individual-scale part of a larger
software-design program. Its method is cumulative: concrete catalog, workflow
management, then qualitative theory. The conclusion confirms the book's admitted
scope as one programmer, minutes to hours, tidyings, structure/behavior diffs,
and coupling/cohesion.

### Part I — Tidyings

| Chapter | Physical pages | Printed pages | Learning job | Status |
| --- | --- | --- | --- | --- |
| Part introduction | 25 | 1 | define tidyings as small refactorings | complete |
| 1 Guard Clauses | 27-28 | 3-4 | flatten one exact nested remainder | complete |
| 2 Dead Code | 29 | 5 | remove unused code with reversible evidence | complete |
| 3 Normalize Symmetries | 31-32 | 7-8 | make equal meaning visibly equal | complete |
| 4 New Interface, Old Implementation | 33 | 9 | create a forwarding seam before migration | complete |
| 5 Reading Order | 35 | 11 | order elements for the next reader | complete |
| 6 Cohesion Order | 37 | 13 | place change-related elements near each other | complete |
| 7 Move Declaration and Initialization Together | 39-40 | 15-16 | expose variable meaning while preserving dependencies | complete |
| 8 Explaining Variables | 41 | 17 | record understood subexpression intent | complete |
| 9 Explaining Constants | 43 | 19 | replace a literal with its actual meaning | complete |
| 10 Explicit Parameters | 45 | 21 | expose previously implicit input | complete |
| 11 Chunk Statements | 47 | 23 | reveal local phases with whitespace | complete |
| 12 Extract Helper | 49-50 | 25-26 | isolate a purpose or temporal sequence | complete |
| 13 One Pile | 51-52 | 27-28 | inline fragmentation until process shape is visible | complete |
| 14 Explaining Comments | 53 | 29 | preserve non-obvious context for a specific reader | complete |
| 15 Delete Redundant Comments | 55-56 | 31-32 | remove prose that only repeats code | complete |

Part I is a bidirectional observation catalog, not a “make everything smaller”
program. `Extract Helper` and `One Pile` deliberately point in opposite directions.
Likewise, cohesion order may precede decoupling when decoupling is not yet known,
affordable, or socially tolerable.

### Part II — Managing

| Chapter | Physical pages | Printed pages | Learning job | Status |
| --- | --- | --- | --- | --- |
| Part introduction | 57 | 33 | distinguish ability to tidy from reason to tidy | complete |
| 16 Separate Tidying | 59-61 | 35-37 | expose behavior and structure as different purposes | complete |
| 17 Chaining | 63-65 | 39-41 | show how one small move reveals another | complete |
| 18 Batch Sizes | 67-70 | 43-46 | trade fixed review cost against collision, interaction, and speculation | complete |
| 19 Rhythm | 71-72 | 47-48 | bound individual-scale tidying in minutes to roughly an hour | complete |
| 20 Getting Untangled | 73-74 | 49-50 | recover coherent history from mixed work | complete |
| 21 First, After, Later, Never | 75-78 | 51-54 | choose timing from immediate payoff, later value, cost, and confidence | complete |

The title's question mark matters. The source favors first only when the move
improves immediate comprehension or makes the accepted behavior change cheaper,
with scope proportional to the payoff. `After` captures fresh context, `later`
serves eventual payoff or learning, and `never` is reserved for code with no
credible future change or design learning.

### Part III — Theory

| Chapter | Physical pages | Printed pages | Learning job | Status |
| --- | --- | --- | --- | --- |
| Part introduction | 79-80 | 55-56 | use theory to sharpen judgment, not compel agreement | complete |
| 22 Beneficially Relating Elements | 81-83 | 57-59 | define design through elements, relations, and benefits | complete |
| 23 Structure and Behavior | 85-87 | 61-63 | distinguish current behavior value from future change value | complete |
| 24 Economics: Time Value and Optionality | 89-90 | 65-66 | introduce conflicting timing incentives | complete |
| 25 A Dollar Today > A Dollar Tomorrow | 91-92 | 67-68 | prefer earlier, more certain income and later expense | complete |
| 26 Options | 93-95 | 69-71 | model design as a premium for future change choices | complete |
| 27 Options Versus Cash Flows | 97-98 | 73-74 | balance immediate cash flow and future choice | complete |
| 28 Reversible Structure Changes | 99-100 | 75-76 | spend less deliberation on genuinely reversible decisions | complete |
| 29 Coupling | 101-103 | 77-79 | define coupling relative to one change delta | complete |
| 30 Constantine's Equivalence | 105-107 | 81-83 | connect cost rhetoric to cascading change | complete |
| 31 Coupling Versus Decoupling | 109-111 | 85-87 | compare present coupling cost with decoupling cost/options | complete |
| 32 Cohesion | 113-114 | 89-90 | group elements that must change together | complete |
| 33 Conclusion | 115-116 | 91-92 | return theory to the individual timing decision | complete |

Part III supplies qualitative calibration. It repeatedly acknowledges that exact
future costs are unknown and that several figures are not actual data. Its durable
artifact is a question set, not a quantitative valuation formula.

### Back Matter

| Unit | Physical pages | Printed pages | Status |
| --- | --- | --- | --- |
| Annotated Reading List and References | 117-120 | 93-96 | complete |
| Index | 121-123 | 97-99 | complete |
| About the Author and Colophon | 124 | n/a | complete |
| O'Reilly platform page | 125 | n/a | complete |

## Reconstructed Decision Model

### 1. Behavior Preservation Is Observer-Relative

The book's working distinction is useful but narrower than production behavior:

```text
behavior change:
  an admitted observer can distinguish before and after
structural change:
  arrangement changes while every admitted observer stays equivalent
```

A package protocol must name observers. Return values alone are insufficient when
order, effects, errors, resource use, persistence, compatibility, or timing belong
to the accepted claim. This is a Developer refinement supported by the book's own
emphasis on safe change, not a claim that the source enumerates all runtime
observers.

### 2. Small Means Cognitively Local

A tidying is small when a reviewer can state its one purpose, relevant semantics,
evidence, and rollback. Line count is not the measure. Deleting one directory may
be one cognitive move; changing a one-line public format may be large because its
observers and rollback are diffuse.

A chain resets the question after each green landing. The fact that move A reveals
move B does not make B part of the original obligation.

### 3. Catalog Moves Are Falsifiable Experiments

The catalog can be generalized without copying its pseudocode:

```text
prompt:
  one visible obstacle to comprehension or accepted change
movement:
  one reversible alignment, exposure, reorder, extraction, or inlining
semantic guard:
  dependency/order/effect/failure/resource meaning that must not drift
relevant check:
  evidence that could catch the likely break
revealing result:
  what becomes easier to compare or decide
stop:
  next locally explainable green state
```

This keeps guard clauses, dead-code deletion, symmetry normalization, forwarding
interfaces, reading/cohesion order, explaining names, explicit parameters,
chunking, extraction, one-pile inlining, and comments subordinate to evidence.

### 4. First, After, Later, Never Preserve Different Reasons

```text
first / now:
  immediate comprehension or accepted-change cost falls enough to pay now
after, immediate:
  fresh context makes a small follow-up cheaper and likely reusable
later, evidence-triggered:
  eventual payoff exists but does not justify delaying accepted behavior
never, admitted environment:
  no credible change pressure or learning value remains
```

The package's three outcomes remain `now | after | never`, but `after` records
whether it means immediate follow-up or later reopening. That preserves the
book's distinction without changing the skill API.

### 5. Batch Size Is A Local Tradeoff

Small batches reduce collision delay, interaction ambiguity, and speculative
scope. They can increase fixed review, integration, and deployment cost. Those
costs belong to the repository and organization being changed. Separate PRs and
unreviewed tidyings are possible workflow choices, not source-independent rules.
Integration and deployment must remain distinct unless the actual delivery system
makes them one event.

### 6. Optionality Is A Qualitative Claim

A useful structural option needs more than “future flexibility”:

```text
credible future behavior portfolio:
structural choices preserved:
exercise path and cost:
useful lifetime or expiry:
present investment or premium:
uncertainty and evidence:
```

The source's finance analogy explains why future choices can have current value.
It does not provide a pricing model for software design. Greater uncertainty does
not automatically justify investment; the option must be exercisable, relevant,
and cheaper than its credible alternatives.

### 7. Reversibility Belongs To An Observer And Time

A source edit may be locally reversible while its consequences are not. Audit:

```text
code rollback:
persisted data and generated artifacts:
public consumers and accidental contracts:
external effects already emitted:
deployment order and coexistence window:
recovery evidence:
```

A helper extraction often is easy to reverse. A propagated type, schema, service,
or message can become expensive to reverse even if its initiating diff was small.

### 8. Coupling Is Relative To A Change

The book's most durable theoretical contribution is the missing argument in many
coupling claims:

```text
coupling(source, dependent, delta)
```

State which change to the source necessitates which change to the dependent, in
which direction, and under which compatibility rule. Invocation, import, or
proximity alone does not establish costly coupling. Commit co-change is a signal
that may be explained by batching, formatting, generated code, or ownership.
Runtime capacity and deployment order can create coupling invisible in source.

### 9. Cohesion Concentrates A Change Set

Moving change-related elements adjacent can make the delta legible before anyone
knows how to decouple it. That is horizontal movement, not elimination of
coupling. A stable containing unit becomes a vertical candidate only when repeated
accepted changes reveal a common purpose, policy, invariant, or owner. Transitive
relationships do not justify one giant container.

## Claim And Boundary Matrix

| Derived claim | Source scope | Decision |
| --- | --- | --- |
| Separate behavior and structural purpose before judging timing. | Chapters 16-18, pp. 35-46 | directly supported; behavior observer widened by Developer |
| Keep one movement cognitively local and pause green. | Part I; Chapters 17-20, pp. 39-50 | directly supported |
| A wished interface over an old implementation can stage caller migration. | Chapter 4, p. 9 | directly supported as temporary seam; durable abstraction not implied |
| A one-pile move can be better than further extraction. | Chapter 13, pp. 27-28 | directly supported |
| Separate PRs are always required. | Chapter 16, pp. 35-37 | rejected as universal; repository workflow decides |
| Unreviewed tidyings can become economical after earned trust. | Chapters 16 and 18, pp. 37, 45-46 | conditional pressure only; “absolute safety” excluded |
| `first`, `after`, `later`, and `never` encode different payoff timing. | Chapter 21, pp. 51-54 | directly supported |
| Structure creates future-change options. | Chapters 23-27, pp. 61-74 | useful qualitative model; not quantitative pricing evidence |
| Most structure changes are easy to reverse. | Chapter 28, pp. 75-76 | narrowed to observer, propagation, and time |
| Coupling must name the change delta. | Chapter 29, pp. 77-79 | directly supported |
| Commit co-change proves coupling. | Chapter 29, p. 77 | rejected; clue only |
| Automated fanout makes one and one thousand callers the same cost. | Chapter 29, p. 78 | rejected as exact claim; edit mechanics may flatten while review/deploy risk remains |
| Software cost is approximately coupling. | Chapter 30, pp. 81-83 | source rhetoric/conjecture, not imported as law |
| Reducing one class of coupling increases another. | Chapter 31, p. 86 | admitted unproved intuition; retained only as tradeoff question |
| Coupled elements always belong inside one container. | Chapter 32, pp. 89-90 | narrowed to repeated change-set evidence and bounded ownership |

## Source Limitations And Quarantine

### D1 — Malformed Cohesion-Order Cost Comparison

Chapter 6, p. 13 compares:

```text
cost(decoupling) + cost(change) < cost(coupling) + cost(change)
```

Using the same `cost(change)` term on both sides cancels the term and fails to
represent the intended difference between change after decoupling and change
under current coupling. The package keeps the qualitative tradeoff and requires
separately named scenarios; it does not copy this equation.

### D2 — “Absolute Safety”

Chapter 16, p. 37 uses absolute-safety language while proposing experiments with
unreviewed tidying PRs. Small steps, tests, tools, trust, and recovery can reduce
risk; they cannot establish absolute safety. The package requires relevant
evidence and earned review policy.

### D3 — Integration Equals Deployment

Chapter 18, p. 45 rhetorically equates integrating and deploying. Many systems
have build, merge, release, migration, rollout, and activation as separate events.
The package keeps them separate unless repository evidence says otherwise.

### D4 — Universal 80/20 And Exact Clustering

Chapter 19, p. 48 invokes Pareto's 80/20 ratio and says tidyings cluster exactly
where behavior changes do. These are useful attention heuristics, not established
universal distributions. The package requires repository history and current
pressure.

### D5 — Narrow Behavior And Misapplied Physics Analogy

Chapter 23, p. 62 invokes Heisenberg's uncertainty principle for changing desires
and says structure does not matter to behavior. The first is at most an observer
analogy, not the physical principle. The second holds only for a narrow output
observer; structure can change timing, effects, failure, resources, and
compatibility. Neither broad claim is imported.

### D6 — Scaling And Options Overreach

Chapter 23, p. 62 says scaling notifications by two orders of magnitude is almost
certain with work. Chapter 26's option primer omits enough pricing variables and
market assumptions that it cannot support quantitative valuation. The package
uses only the qualitative conflict between immediate cash flow and future choice.

### D7 — Reversibility Overgeneralization

Chapter 28 correctly identifies local helper extraction as easy to undo, then
generalizes that most design decisions are easily reversible. Public contracts,
persisted data, deployed messages, generated artifacts, and emitted effects can
make a structural decision costly or impossible to reverse. The package makes
reversibility observer- and time-relative.

### D8 — Dead-Code Telemetry Cannot Prove Absence

Chapter 2 recommends logging suspected dead code and waiting until confident.
That can reduce uncertainty but misses rare jobs, reflection, configuration,
seasonality, and external entry points. The package requires a scoped observation
window, static/runtime evidence, and residual risk.

### D9 — Constant Fanout-Cost Claim

Chapter 29 says automated rename cost is the same for one and one thousand
callers. Tool mechanics can reduce editing effort, but review surface, generated
artifacts, build time, integration, ownership, and deployment risk still scale.
The exact claim is excluded.

### D10 — Constantine's Equivalence Is Not Measured Evidence

Chapter 30 explicitly labels its graphs as non-data, then derives approximate
cost equivalences through power-law rhetoric. This is a memorable theory of
change propagation, not a measured equation for a repository. The package keeps
change-relative coupling and cascading-risk questions while excluding the
cost identity.

### D11 — Coupling/Connascence Identity And Conservation Conjecture

Chapter 29 says coupling and connascence have exactly the same definition.
Chapter 31 states, while admitting it cannot prove or adequately explain it, that
reducing coupling for one change class increases coupling for others. These
statements are not needed for the package method. The package asks which change
class improves and what costs move elsewhere.

### D12 — Cohesion By Universal Collocation

Chapter 32's “coupled elements should share a container” is a useful local move,
but unbounded transitive application creates giant modules and ignores protocol,
organizational, deployment, or resource boundaries. The package requires
repeated accepted deltas and a bounded owner.

## Pass-But-Wrong Calibration Cases

1. Return-value tests stay green while reordering changes exception timing.
2. A one-line schema edit is called small because the diff is small.
3. A separate PR is labeled structural while it silently changes default policy.
4. Dead-code telemetry shows no hits because the rare monthly job did not run.
5. Symmetry normalization merges two branches whose failure policies differ.
6. A forwarding interface is promoted publicly before independent participants
   or purposes exist.
7. Files co-change because one pull request batches unrelated formatting.
8. Elements are moved adjacent and the team claims the coupling disappeared.
9. Automated rename updates one thousand callers but misses reflection and
   generated consumers.
10. A “future flexibility” claim names no future behavior, exercise path, or
    expiry.
11. A reversible commit has already emitted externally visible side effects.
12. Unreviewed tidying passes a broad suite whose fixtures never reach the moved
    branch.
13. A cost curve or Constantine equation is presented as measured project data.
14. Integration evidence is reported as production deployment evidence.

## Package Baseline Before Repair

The package already had the right high-level ownership:

- `schedule/references/structural-change-timing.md` owned timing, optionality,
  reversibility, nested work, and `now | after | never`;
- `signal/references/structural-movement.md` owned behavior-preserving observation
  and horizontal/vertical classification;
- `extensions/references/behavior-preserving-structural-change.md` owned one
  justified green-to-green mutation;
- `SOURCES.md` mapped the book to those three paths.

The baseline was directionally faithful but under-specified:

- provenance said only O'Reilly 2023 and omitted Second Release/errata/pages;
- the four source timing outcomes were folded without recording immediate versus
  later `after` mode;
- optionality lacked a named exercise path and lifetime;
- reversibility lacked explicit observer and propagation checks;
- PR/review/integration/deployment advice was too easy to read as universal;
- the Part I catalog and change-relative coupling/cohesion were mostly absent
  from the `signal` reference;
- dead-code telemetry and behavior-observer limitations were absent from the
  implementation protocol.

## Repair Queue And Application

### T1 — Pin The Second Release

**Applied.** `SOURCES.md` now records First Edition, Second Release, date, ISBN,
physical extent, canonical catalog, errata, complete audit, and packaging
boundary.

### T2 — Replace Broad Provenance

**Applied.** All three runtime references now cite the audit and exact printed
chapter/page ranges.

### T3 — Preserve First/After/Later/Never Meaning

**Applied.** `schedule` keeps its public three-outcome vocabulary while requiring
`after mode: immediate follow-up | evidence-triggered later` and a real reopen
condition for later work.

### T4 — Bound Optionality

**Applied.** `schedule` now requires a credible behavior portfolio, preserved
choice, exercise cost, useful period, present premium, and evidence. It rejects
unspecified flexibility and quantitative option-pricing claims.

### T5 — Make Reversibility Observer-Relative

**Applied.** `schedule` now checks code rollback, persistence, public consumers,
external effects, generated artifacts, deployment order, and coexistence time.

### T6 — Make Batch And Review Advice Conditional

**Applied.** `schedule` and the implementation protocol compare fixed and growing
batch costs, distinguish integration from deployment, and reject absolute safety
or automatic unreviewed tidying.

### T7 — Recover The Catalog As Observation Moves

**Applied.** `signal` now includes semantic guards for guard clauses, dead code,
symmetry, forwarding seams, reorder, explaining names/parameters,
chunk/extract/inline, and comments without turning the catalog into commands.

### T8 — Recover Change-Relative Coupling And Cohesion

**Applied.** `signal` now records delta, direction, necessity, fanout/cascade,
evidence, counterevidence, co-change limits, horizontal cohesion movement, and
the stop before vertical promotion.

### T9 — Strengthen The Mutation Boundary

**Applied.** The implementation protocol now states observer-relative behavior,
qualifies forwarding seams and dead-code telemetry, distinguishes local evidence
from deployment, and keeps batch/review policy repository-relative.

### T10 — Quarantine D1-D12 And Review Routing

**Applied.** `SOURCES.md` explicitly excludes the financial/cost rhetoric and
universal workflow claims. Existing route ownership remains sufficient;
`reference-policy.json` was not changed.

## Post-Repair Package Target Hashes

<!-- markdownlint-disable MD013 -->

| Path | SHA-256 |
| --- | --- |
| `SOURCES.md` | `6aef177dded328147612cff09203956898aa5c95bcd7d3f34beb5e9d82431a4f` |
| `skills/schedule/references/structural-change-timing.md` | `9e05f113834e9ef76e63d4da4b8fa78fb468ef4324642806d63c566557ac01bd` |
| `skills/signal/references/structural-movement.md` | `0dd113d89bf2a8fd1c92419af5808cd87c33e8423ef422108195283f4f00e943` |
| `extensions/references/behavior-preserving-structural-change.md` | `2ea93f99fd51691ed585a442b855846802d6ea5b7357d9839d9e4e3b29c869ae` |

<!-- markdownlint-enable MD013 -->

## Verification Evidence

- The O'Reilly catalog search result confirms title, author, October 2023 First
  Edition, online ISBN, 124-page catalog extent, and canonical chapter paths.
  Direct catalog retrieval is anti-bot blocked with HTTP 403, so it is not
  represented as a successful page fetch.
- The publisher errata page was successfully retrieved before later anti-bot
  throttling; its snapshot and hash record all three confirmed corrections and
  their correction dates. The complete Second Release contains each correction.
- The complete local PDF reports 125 physical pages because it includes the final
  2025 O'Reilly platform page beyond the catalog's 124-page book extent.
- All six package Tidy/audit Markdown links resolve to five unique URL strings;
  every local audit target exists. External identity is supported by the catalog
  search and saved publisher-errata evidence rather than a broad HTTP-200 claim.
- `npm run check`: package structure consistent; tests **139/139** passed.
- Full lens scan across all five touched package/audit files: no findings. Four
  files were LSP-confirmed; `SOURCES.md` did not complete within the Marksman
  budget, so no LSP-clean claim is made for that file. Standalone Markdown LSP
  requests also timed out and are not counted as confirmation.
- `git diff --check` on the four tracked targets plus `git diff --no-index
  --check` on the untracked audit document: clean.
- The four post-repair hashes above were recomputed with zero mismatches.
- No `reference-policy.json` file changed in this audit.

## Fidelity Verdict

**Faithful after repair.** The package now preserves the source's practical arc:
observe one concrete obstacle, make one semantically guarded movement, pause at a
locally explainable landing, choose first/after/later/never from present payoff and
credible future value, and inspect coupling only relative to an actual change.

The package is intentionally stricter than the prose where production claims are
at stake. “Behavior” names an observer; “small” is cognitive and operational;
“reversible” names affected surfaces and time; “option” names an exercisable
future choice; co-change is a clue; cohesion is bounded ownership; review,
integration, and deployment remain distinct evidence surfaces.

This verdict does not endorse every equation, metaphor, distribution, review
recommendation, or theory claim. D1-D12 remain excluded or qualified. Production
migration, feature-flag lifecycle, telemetry coverage, rollout, rollback, durable
recovery, and organization-wide review policy remain Developer adaptations.
