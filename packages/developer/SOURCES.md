# Source-to-Capability Trace

Developer is organized around questions the agent must answer, not around books.
This maintainer document records how source material is decomposed across leaf
skills and the direct execution path. It is not a Pi runtime resource or a
required workflow.

## Ownership Rule

A source idea belongs where its observable job is performed:

- product meaning and change pressure go to `specify`;
- cases, rules, contracts, and transitions go to `model`;
- implementable boundaries and collaborations go to `sketch`;
- visible structural movement goes to `signal`;
- candidate stability goes to `abstraction-review`;
- timing goes to `schedule`;
- names go to `naming-judgment`;
- claim-to-evidence judgment goes to `verify`;
- already-justified mutation goes to the `direct` route.

No source implies a mandatory route order. Several leaves may use different
parts of the same source because they answer different questions.

## Runtime Reference Quality

`SKILL.md` owns discovery, the core question, output, completion, and conditional
routing. A reference loaded through that route must be usable without reopening
the original source or reconstructing unstated steps.

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
to load, but keep the central insight and one complete example in the primary
reference. Splitting by chapter title or merely to shorten a file is not a
capability boundary.

## Capability Matrix

| Source | Capability extracted | Primary owner | Supporting owner or execution path |
| --- | --- | --- | --- |
| *99 Bottles of OOP*, ch. 1-2 | simple concrete baseline, Shameless Green, cost-effective and intention-revealing tests | `verify` | `signal`, `schedule` |
| *99 Bottles of OOP*, ch. 3-4 | real change pressure, point of attack, closest pair, smallest difference, horizontal movement | `signal` | `direct` behavior-preserving protocol |
| *99 Bottles of OOP*, ch. 4-5 | stable landings, responsibility-derived names, argument and data movement | `abstraction-review`, `naming-judgment` | `direct` behavior-preserving protocol |
| *99 Bottles of OOP*, ch. 5-8 | responsibility separation, messages, type transitions, polymorphism, dependency direction, object creation at the edge, factory tradeoffs | `sketch`, `abstraction-review` | `model`, `schedule` |
| *99 Bottles of OOP*, ch. 9 | unit boundaries, context independence, role verification, obsolete-test removal | `verify` | `sketch` |
| *How to Design Programs* | information analysis, data definitions, examples, templates, structural and generative recursion, accumulators, iterative refinement | `sketch` | `model`, `verify`, `signal`, `abstraction-review` |
| *Structure and Interpretation of Computer Programs*, ch. 1-2 | procedural abstraction, process shape, higher-order composition, data abstraction, closure, conventional interfaces, multiple representations | `sketch`, `abstraction-review` | `model` |
| *Structure and Interpretation of Computer Programs*, ch. 3 | state, identity, history, concurrency, streams, constraint propagation | `model`, `sketch` | `abstraction-review`, `verify` |
| *Structure and Interpretation of Computer Programs*, ch. 4-5 | language/evaluator boundaries and explicit execution machinery | `sketch`, `abstraction-review` | imported only when a real DSL, interpreter, compiler, or runtime boundary exists |
| *Logic for Programmers*, ch. 2-3 | predicates, sets, quantifiers, logical refactoring, runtime-semantic caveats | `model` | `verify` |
| *Logic for Programmers*, ch. 4-6 | partial specifications, properties, contracts, replacement, proof limits | `model`, `verify` | `abstraction-review` |
| *Logic for Programmers*, ch. 7-12 | relational constraints, decision tables, domain/time/system models, solvers, logic programming | `model` | `verify` |
| *Elements of Clojure*: Names | narrow and consistent sense, honest effects and scope crossing | `naming-judgment` | `model` |
| *Elements of Clojure*: Idioms | language-specific conventions and explicit operational semantics | project conventions or `direct` | generalized only when the semantic lesson survives the language |
| *Elements of Clojure*: Indirection | abstraction cost, module environment/model/interface/assumptions, principled versus adaptable systems | `sketch`, `abstraction-review` | `schedule` |
| *Elements of Clojure*: Composition | units of computation and pull-transform-push process boundaries | `sketch` | `naming-judgment`, `verify` |
| *Tidy First?* | separate behavior from structure, small tidyings, optionality, reversibility, first/after/later/never | `schedule` | `direct` behavior-preserving protocol, `signal` |

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
  pedagogical comments, signatures, or templates to production code.

These exclusions prevent a respected source from becoming a framework-shaped
answer imposed on unrelated product work.

## Reassembly Check

When adding or revising a source-derived reference, record:

```text
Source location: book, edition/version, chapter or section
Capability: the question or action the idea improves
Owner: one leaf or the direct path
Boundary: what the owner must not absorb
Observable effect: the artifact, decision, or safer execution behavior expected
```

Create a new leaf only when a recurring question has a distinct input, output,
completion condition, and boundary that no existing owner can express. A new
source, technique, or vocabulary is not by itself evidence for a new leaf.
