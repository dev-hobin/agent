# Source-to-Capability Trace

Developer is organized around questions the agent must answer, not around books.
This maintainer document records how source material is decomposed across leaf
skills and the implementation path. It is not a Pi runtime resource or a required
workflow.

## Ownership Rule

A source idea belongs where its observable job is performed:

- scope-bound existing-code diagnosis and consultation synthesis go to `doctor`, while each underlying judgment remains with its focused owner;
- product meaning and change pressure go to `specify`;
- cases, rules, contracts, and transitions go to `model`;
- implementable boundaries and collaborations go to `sketch`;
- visible structural movement goes to `signal`;
- candidate stability goes to `abstraction-review`;
- timing goes to `schedule`;
- names go to `naming-judgment`;
- claim-to-evidence judgment goes to `verify`;
- already-justified mutation goes through a bounded `AuthorizedChange`.

No source implies a mandatory judgment order. Several leaves may use different
parts of the same source because they answer different questions. Doctor does
not become a new source owner: it dispositions those questions inside one claim
boundary, hands triggered consultations to their existing owners, and
synthesizes the resulting evidence without copying another skill's guidance.

## Runtime Context Quality

`SKILL.md` owns discovery, the core question, always-on method, output,
completion, missing-evidence behavior, and capability boundary. `judgment.json`
separately owns bounded Context Questions, Needs, Sources, applicability, missing
policy, assurance, sufficiency, and closure expectations. Every conditional
reference must be usable without reopening the original source, reconstructing
unstated steps, or assuming another reference was read first.

Match detail to the reference's job:

- a concept or design reference needs the core insight, input, derivation rule,
  completed example, counterexample or failure diagnosis, output, and boundary;
- a recipe card needs a trigger, input artifact, construction rule, output
  artifact, observable stop, and repair direction;
- a diagnostic table needs a symptom, evidence path, repair artifact, and
  re-check;
- a worked-example file needs enough context to show why the decision follows,
  not only a polished final answer;
- a mutation protocol needs an entry contract, safe intermediate states,
  evidence rhythm, reroute conditions, and a stable landing.

Split a reference when independent questions would otherwise make it expensive
to load. Keep enough central insight and one complete case in each independently
selectable document for its promised job. Splitting by chapter title or merely
to shorten a file is not a capability boundary.

Do not assign global `primary` and `companion` ranks or semantic read order.
Policy and reference `when` statements express possible relevance, never
obligation or authority. Selected material is sealed atomically, ordered
canonically only for identity and rendering, related through exact contributions,
and cited only when it actually informs an outcome. Guidance-free questions need
no artificial context. See
[Developer Judgment Policies](./JUDGMENT_POLICIES.md).

## Runtime Use Versus Source Fidelity

Developer records optional policy and dynamic-question identities, stable
nominations, derived binding identities, selected and sealed material identities,
contribution coverage, cited uses, and outcome. This proves exact runtime exposure and makes application claims
auditable. It does **not** prove that guidance faithfully reconstructs the
original source or that the resulting judgment is true.

Source audits are repository-maintainer workpapers, not agent instructions or
runtime resources. They answer four maintenance questions:

1. Which exact edition, file, page range, anchor, code sample, or figure was
   inspected?
2. Was the source read completely enough to support the imported claim?
3. Which defects, overclaims, and source-specific idioms were excluded or
   narrowed?
4. How can a future maintainer reproduce the fidelity decision after a source or
   runtime reference changes?

For those purposes, audit source fidelity separately against an authorized
original using:

```text
reference path + content SHA-256
source title + edition/version
chapter/section + page range when stable
reference claim, recipe step, example, or boundary under review
source passage or figure that supports, narrows, or contradicts it
fidelity decision + required repair
```

Do not publish copyrighted source files or audit workpapers with the package. A
local PDF or book copy may be used as audit evidence. The published package
retains only bibliographic provenance, derived capability text, optional Judgment
policies, and runtime checks. `SOURCES.md` and `source-audits/` remain Git-tracked,
repository-only maintenance evidence.

Source fidelity is necessary but not sufficient. After individual audits, the
package must reorganize durable insights around source-independent judgment
spines, split independent questions, and remove shadow ownership. The base
synthesis and retired-document map are recorded in
[`source-audits/cross-source-judgment-integration-2026-07-24.md`](./source-audits/cross-source-judgment-integration-2026-07-24.md).
The later evidence-preserving-boundary addition and its integration decision are
recorded in
[`source-audits/parse-dont-validate-2019-11-05.md`](./source-audits/parse-dont-validate-2019-11-05.md).
Historical audit hashes attest their audited snapshots; each later integration
record attests only the document set and source addition it names.

## Audited Source Pins

| Source | Authorized target | Audit record | Packaging boundary |
| --- | --- | --- | --- |
| *How to Design Programs* | official living build 9.2.0.3, released 2026-05-28 10:37:57, [canonical index](https://htdp.org/2026-5-28/Book/index.html) | [`source-audits/how-to-design-programs-living-9.2.0.3-2026-05-28.md`](./source-audits/how-to-design-programs-living-9.2.0.3-2026-05-28.md), all top-level units read in order with unit hashes and visual inspection | runtime references retain derived methods and bibliographic chapter/section citations; exact HTML anchors remain in the source audit; recorded canonical defects are excluded; repository recovery, route ownership, machine-progress checks, and production compatibility surfaces are marked Developer adaptations |
| *99 Bottles of OOP* | Second Edition, version 2.2.2, 2024 | [`source-audits/99-bottles-of-oop-2e-v2.2.2.md`](./source-audits/99-bottles-of-oop-2e-v2.2.2.md) | references retain derived capability text and page ranges; local PDF is not packaged |
| *Structure and Interpretation of Computer Programs* | Second Edition, MIT Press, 1996; [official full text](https://mitp-content-server.mit.edu/books/content/sectbyfn/books_pres_0/6515/sicp.zip/full-text/book/book.html); audit input was unofficial Texinfo PDF `2.andresraba5.6`, 2016-02-02 | [`source-audits/structure-and-interpretation-of-computer-programs-2e-texinfo-2.andresraba5.6.md`](./source-audits/structure-and-interpretation-of-computer-programs-2e-texinfo-2.andresraba5.6.md), all 883 PDF pages read in order with official-HTML hashes and visual inspection | runtime references retain source-independent methods and bibliographic section citations; exact MIT Press anchors remain in the source audit; recorded Texinfo layout/extraction defects are excluded; production validation, compatibility, resource, and repository workflows are marked Developer adaptations; local PDF is not packaged |
| *Logic for Programmers* | version 0.14.0, 2026-05-04; [official Leanpub page](https://leanpub.com/logic); exact companion commit [`6ec1070`](https://github.com/logicforprogrammers/book-assets/commit/6ec1070d304fb92c537f5510f8d938054fb5899d) | [`source-audits/logic-for-programmers-v0.14.0-2026-05-04.md`](./source-audits/logic-for-programmers-v0.14.0-2026-05-04.md), all 204 PDF pages read in order with visual inspection and exact companion-source comparison | references retain source-independent artifacts and PDF chapter/page provenance; recorded beta markers, invalid laws, code/formula defects, and runtime mismatches are excluded; repository recovery, production migration, telemetry, rollout, replay, and resource protocols are Developer adaptations; local PDF is not packaged |
| *Elements of Clojure* | Leanpub edition published 2019-02-11, 121 physical pages; [official Leanpub page](https://leanpub.com/elementsofclojure); public [first-printing manuscript](https://elementsofclojure.com/manuscript/elements_of_clojure.pdf), January 2019, 120 physical pages | [`source-audits/elements-of-clojure-leanpub-2019-02-11.md`](./source-audits/elements-of-clojure-leanpub-2019-02-11.md), both authorized PDFs read in full and visually inspected; substantive prose equivalence checked across pagination and layout | references retain source-independent judgments and public-manuscript section/page provenance; confirmed Clojure examples, interval/domain defects, incomplete algebra, broad proof/model rhetoric, and system-protocol overreach are excluded or qualified; cancellation, idempotency, durable recovery, production capacity, telemetry, rollout, and migration protocols are Developer adaptations; local PDFs are not packaged |
| *Tidy First?* | First Edition, Second Release, 2025-12-12, ISBN 978-1-098-15124-9, 125 physical PDF pages; official [O'Reilly catalog](https://www.oreilly.com/library/view/tidy-first/9781098151232/) and [errata](https://www.oreilly.com/catalog/errata.csp?isbn=9781098151249) | [`source-audits/tidy-first-first-edition-second-release-2025-12-12.md`](./source-audits/tidy-first-first-edition-second-release-2025-12-12.md), all 125 pages read in order and visually inspected; authorized 13-page first-release retail preview and three corrected errata cross-checked | references retain source-independent observation, timing, and mutation artifacts with printed chapter/page provenance; option pricing, absolute safety, integration/deployment equivalence, universal clustering, Constantine's Equivalence, and unqualified reversibility/coupling claims are excluded or narrowed; production telemetry, migration, rollout, and recovery remain Developer adaptations; local PDFs are not packaged |
| “Parse, don’t validate” | canonical article by Alexis King, published 2019-11-05, [official page](https://lexi-lambda.github.io/blog/2019/11/05/parse-don-t-validate/) | [`source-audits/parse-dont-validate-2019-11-05.md`](./source-audits/parse-dont-validate-2019-11-05.md), canonical article read in full including footnotes; retrieved HTML hash and source qualifications recorded | runtime guidance retains the source-independent evidence-preserving-boundary method and ordinary bibliographic provenance; Haskell APIs, maximal type machinery, blanket cast bans, and unaudited secondary-source claims are excluded; construction-path, trusted-compiler-gap, effect-order, compatibility, and adversarial-evaluation surfaces are Developer adaptations |

A source pin is provenance, not a runtime requirement. `judgment.json` declares
which bounded Context Needs a source can inform; applicability, selection,
sealing, citation, and outcome remain separate decisions.

## Capability Matrix

<!-- markdownlint-disable MD013 -->

| Source | Capability extracted | Main capability owner | Other capability owner or execution path |
| --- | --- | --- | --- |
| *99 Bottles of OOP*, ch. 1 | simple concrete baseline, Shameless Green, and the present cost of premature abstraction | `signal` | `schedule`, `verify` |
| *99 Bottles of OOP*, ch. 2 | TDD as domain learning, independent examples, verifier relevance, and pass-but-wrong tests | `verify` | `signal` |
| *99 Bottles of OOP*, ch. 3-4 | real change pressure, point of attack, closest pair, smallest difference, horizontal movement | `signal` | behavior-preserving `AuthorizedChange` |
| *99 Bottles of OOP*, ch. 3-5 | green stable landings, parse-execute-use-delete replacement, temporary compatibility, and sender-by-sender movement | `signal` | behavior-preserving `AuthorizedChange` |
| *99 Bottles of OOP*, ch. 4-5 | responsibility-derived names, responsibility extraction, and argument and data movement | `sketch`, `naming-judgment` | `abstraction-review` only after a concrete candidate exists |
| *99 Bottles of OOP*, ch. 5-8 | responsibility separation, messages, type transitions, polymorphism, dependency direction, object creation at the edge, factory tradeoffs | `sketch` | `model`, `schedule`; `abstraction-review` judges shaped candidates |
| *99 Bottles of OOP*, ch. 9 | unit boundaries, context independence, role verification, obsolete-test removal | `verify` | `sketch` |
| *How to Design Programs*, living build 9.2.0.3 | information/data interpretation; function versus program recipes; structural template inventory; composition and model refinement; generated-problem preservation and progress; accumulator invariants and ownership; claim-relative examples, numeric/cost boundaries, and post-green design inspection | `sketch` | `model`, `verify`, `signal`; `abstraction-review` only reviews resulting candidates |
| “Parse, don’t validate,” 2019-11-05 | less-structured to more-structured parsing; refined values that preserve learned information; precise representations; early proof placement; parsing/execution separation; shotgun-parsing diagnosis; abstract-type and smart-constructor fallback | `sketch/evidence-preserving-boundary` | `model` owns admitted values and lost abilities; implementation declares invariant handling; `verify` audits construction, bypass, and effect order |
| *Structure and Interpretation of Computer Programs*, [ch. 1](https://mitp-content-server.mit.edu/books/content/sectbyfn/books_pres_0/6515/sicp.zip/full-text/book/book-Z-H-9.html#%_chap_1)-[2](https://mitp-content-server.mit.edu/books/content/sectbyfn/books_pres_0/6515/sicp.zip/full-text/book/book-Z-H-13.html#%_chap_2) | procedural abstraction, procedure/process shape, higher-order composition, data abstraction and laws, closure, conventional interfaces, multiple representations | `sketch` | `model`; `abstraction-review` judges existing boundary promises |
| *Structure and Interpretation of Computer Programs*, [ch. 3](https://mitp-content-server.mit.edu/books/content/sectbyfn/books_pres_0/6515/sicp.zip/full-text/book/book-Z-H-19.html#%_chap_3) | state, identity, aliasing, mutation graphs, concurrency histories, event order, streams, demand/memoization, constraint propagation | `model`, `sketch` | `verify`; candidate review is downstream |
| *Structure and Interpretation of Computer Programs*, [ch. 4](https://mitp-content-server.mit.edu/books/content/sectbyfn/books_pres_0/6515/sicp.zip/full-text/book/book-Z-H-25.html#%_chap_4)-[5](https://mitp-content-server.mit.edu/books/content/sectbyfn/books_pres_0/6515/sicp.zip/full-text/book/book-Z-H-30.html#%_chap_5) | language/evaluator boundaries; demand, search, multiplicity, negation, and rollback; control/continuation and tail-space guarantees; calling conventions, effect/liveness summaries, storage roots/identity, compilation assumptions, and interpreted/compiled compatibility | `model`, `sketch` | imported only when a real DSL, interpreter, compiler, search engine, or runtime boundary exists |
| *Logic for Programmers* v0.14.0, ch. 2-3, pp. 5-33 | abstract predicates versus computation; sets and scoped/nested quantifiers; implication, vacuous truth, ability-guarantee tradeoffs; logical refactoring with runtime-semantic caveats | `model` | `verify` |
| *Logic for Programmers* v0.14.0, ch. 4-6, pp. 34-72 | implication-relative test strength; sampled properties versus total specifications; contracts, invariants, replacement, proof assumptions, termination, and numeric/tool boundaries | `model`, `verify` | `abstraction-review` evaluates an existing candidate against the accepted contract |
| *Logic for Programmers* v0.14.0, ch. 7-12, pp. 73-168 | relational constraints and counterexample queries; finite decision partitions; bounded domain/temporal models; safety, liveness, fairness, and refinement; solver result protocols; logic-programming multiplicity, negation, search, planning, and answer sets | `model` | `verify`; specialized tools only when their uncertainty and cost justify them |
| *Elements of Clojure*, public manuscript Names, pp. 7-26 | narrow and consistent sense; sign/referent/sense; same referent with independent expected evolution; audience-aware natural/synthetic names; honest scope-crossing effects | `naming-judgment` | `model`; macro and punctuation advice remains Clojure-specific |
| *Elements of Clojure*, public manuscript Idioms, pp. 30-61 | syntax-to-intent conventions; purity, dynamic scope, laziness, atomic state, narrow access, and bounded absence as operational boundaries | project conventions or an `AuthorizedChange` | generalized only when the semantic lesson survives the language; recorded code/runtime defects are excluded |
| *Elements of Clojure*, public manuscript Indirection, pp. 64-95 | conditionals and registration conflict; module environment/model/interface/assumptions; internal invariant versus environmental drift; environment-relative model size; principled components and adaptable interfaces | `model`, `sketch`, `schedule` | `abstraction-review` evaluates an already-shaped interface; broad proof, induction, oracle, and dispatch claims are qualified |
| *Elements of Clojure*, public manuscript Composition, pp. 98-119 | partial data/execution isolation; execution models; pull-transform-push ownership; effectful-lazy acquisition; effect descriptors; topology, resolution, routing, task acknowledgment, and explicit system-protocol limits | `sketch` | `naming-judgment`, `verify`; cancellation, idempotency, durable recovery, and production protocols are Developer adaptations |
| *Tidy First?*, First Edition, Second Release, Part I, ch. 1-15, pp. 3-32 | guard/dead-code/symmetry/interface/order/name/parameter/chunk/extract/inline/comment moves as small observation experiments with semantic guards | `signal` | an `AuthorizedChange` only after one concrete movement is justified |
| *Tidy First?*, First Edition, Second Release, Part II, ch. 16-21, pp. 35-54 | behavior/structure separation, chaining, batch tradeoffs, rhythm, untangling, and first/after/later/never timing | `schedule` | behavior-preserving `AuthorizedChange`, `signal` |
| *Tidy First?*, First Edition, Second Release, Part III, ch. 22-33, pp. 57-92 | beneficial relations; immediate behavior value versus future change options; observer-relative reversibility; change-relative coupling, fanout/cascades, and cohesion | `schedule`, `signal` | bounded change authorization; finance and cost equations remain qualitative calibration only |

<!-- markdownlint-enable MD013 -->

## Intentionally Not Imported As Universal Rules

Source coverage does not mean copying every example or language idiom into every
task. The following remain contextual:

- Ruby class and factory shapes from *99 Bottles* are evidence about
  responsibility and variation, not a destination for every design.
- Scheme evaluators, register machines, and compiler details from SICP are used
  only for tasks that actually expose those runtime or language boundaries.
- Clojure-specific arities, option maps, atoms, macros, and interop idioms stay
  subordinate to the target project's language and conventions.
- Logic solvers, formal proof, TLA+, Prolog, and answer-set programming are
  selected only when the modeled uncertainty and risk justify their cost.
- HtDP recipes are adapted to existing repositories; they do not require adding
  pedagogical comments, signatures, or templates to production code. Existing
  schemas, fixtures, callers, persisted values, and tests are Developer evidence
  substitutions, not canonical HtDP recipe artifacts.
- Canonical HtDP typos, undefined identifiers, malformed signatures, and
  overbroad termination, numerical, or performance claims recorded in the audit
  are not derivation evidence.
- *Tidy First?* catalog moves are candidate experiments, not mandatory cleanup;
  its financial-option analogy, directional sketches, Pareto/power-law rhetoric,
  absolute-safety language, and cost equivalences do not establish quantitative
  production or business claims.
- “Parse, don’t validate” does not require Haskell-shaped APIs, maximal type
  machinery, one whole-program parsing pass, or a blanket token ban on every cast
  syntax. It requires an owned transition whose success preserves the learned
  invariant in the representation consumed by dependent code.

These exclusions prevent a respected source from becoming a framework-shaped
answer imposed on unrelated product work.

## Reassembly Check

When adding or revising a source-derived reference, record:

```text
Source location: book, edition/version, chapter or section
Judgment role: trigger | distinction | derivation | stop | separation
Owner: one skill method step or change-authorization boundary
Question: one unresolved question the insight helps answer
Artifact and stop: inspectable result and falsifier
Boundary: what this owner must not absorb
```

Keep the insight in `SKILL.md` when it is always required. Keep it as a
self-contained conditional reference when it can deepen one bounded Context
Need. Split the Context Question when applicability, artifact, stop, or handoff
is independently meaningful. Keep source sequence, examples, defects, and
comparisons in source audits rather than runtime guidance. A new source,
technique, or vocabulary is not by itself evidence for a new capability or
Context Question.
