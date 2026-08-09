# Design Levels And Boundaries

Use this reference when a sketch must decide which vocabulary a caller may use,
which owner controls a consequential choice, and which lower-level details may
change independently. It is the common kernel for representation, process,
state, generic-operation, and language routes; it does not contain their
specialized construction methods.

## Boundary Spine

```text
caller purpose and cases
-> wished operations in caller language
-> contract and admitted observers
-> owner of policy/invariant/history
-> hidden lower-level choice
-> alternate implementation or counterexample
```

A boundary is real only when it hides a consequential choice and leaves a
smaller truthful contract. A renamed mechanism is not a new level.

## Write Levels Explicitly

```text
product level:
  operations users or callers intend

domain/service level:
  concepts, laws, roles, and state transitions

mechanism level:
  storage fields, libraries, transport, threads, runtime instructions
```

Each level may depend on the vocabulary immediately below it. Higher levels must
not inspect the representation that a lower owner promises to hide. Add a level
only when it supplies meaningful primitives, combinations, or reusable laws.

## Contract Before Shape

For each wished operation state:

```text
caller-visible result and failure
normal, boundary, and forbidden examples
observers callers may rely on
owner of validation, normalization, state, or ordering
mechanism callers should stop knowing
smallest replacement or falsifying check
```

Do not invent public selectors merely because a representation has fields. Expose
only operations current caller purposes support. Conversely, a claimed boundary
is false when callers still need raw layout to complete their work.

## Environment And Assumptions

Every boundary models an environment:

```text
environment: real participants and change pressure
model: represented facets
ignored facts: deliberately outside the contract
interface: stable sense exposed to callers
assumptions: environmental facts required for usefulness
drift signal: evidence assumptions may no longer hold
```

Internal invariants can keep the model self-consistent; they cannot prevent the
environment from changing. Public boundaries calcify, so mature them locally when
participants co-evolve. Independent participants, purposes, deployment cycles, or
replacement pressure justify stronger interfaces.

## Keep Specialized Questions Separate

| Independently consequential question | Distinct artifact |
| --- | --- |
| representation independence and public laws | public operations and laws, two representations, caller rewrite, and leak check |
| closed composition or conventional interfaces | unit, closed operations, finalizers, and operational interface contract |
| generated work, control, waits, capacity, resources, or effects | process trace, bounds, phase and completion ownership |
| history, identity, mutation, state transition, event order, or logs | history owner, transition and order law, stale and duplicate policy |
| additive representations and operation dispatch | variant-operation matrix and conflict policy |
| cross-representation operation and semantic loss | conversion graph and preserved or lost observers |
| notation, grammar, evaluator, and language results | expression boundary and evaluator/result contract |
| interpreter/compiler lowering and optimization | execution convention, effects, guards, roots, and interoperation |
| knowledge and participant ownership | responsibility and collaboration map |
| shared caller roles across implementations | role and substitution contract |
| one domain type becoming another | source, event, target, and preserved-meaning contract |
| variant selection and construction | selection owner and least-powerful creation boundary |

Do not absorb one of these questions merely because it shares a boundary topic.
When it has its own artifact and stop, state the concrete unanswered question and
keep the current boundary judgment bounded.

## Artifact

```text
Caller purpose and representative cases:
Wished operations:
Levels and dependency direction:
Contract and observers:
Owner:
Hidden choice:
Environment, ignored facts, assumptions, and drift:
Alternate implementation or falsifier:
Open questions in caller language:
```

## Stop And Separation

Stop when every dependency arrow uses a truthful vocabulary, each guarantee has
one owner, and a lower-level choice can be varied or falsified without rewriting
unrelated callers.

Separate when the unresolved issue has its own output and stop check in the table
above. When admitted meaning is disputed, no boundary conclusion follows. This
document does not approve a candidate boundary.

## Source Trace

- Harold Abelson and Gerald Jay Sussman with Julie Sussman, *Structure and
  Interpretation of Computer Programs*, Second Edition:
  Section 1.1,
  Section 1.2,
  Section 1.3,
  and Section 2.1
  for wishful decomposition, levels of language, procedures as black boxes, data
  abstraction, and representation laws.
- Zachary Tellman, *Elements of Clojure*, Leanpub 2019-02-11:
  Indirection, public-manuscript pp. 70-95, for environment/model/interface/
  assumptions, participant pressure, interface collapse, and calcification.
- Hillel Wayne, *Logic for Programmers*, v0.14.0:
  Chapters 2-3 and 9-10 for ability/guarantee and observer-relative refinement.
