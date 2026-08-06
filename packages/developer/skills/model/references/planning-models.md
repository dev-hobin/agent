# Planning Models

Use this reference when the unresolved model is a legal sequence of actions from
an initial state to a goal, optionally ranked by cost. It is self-contained and
does not require another modeling reference.

## Accepted Modeling Context

Supply the bounded goal question, admitted state and action domains, initial and
goal facts, known invariants, environmental assumptions, at least one invalid
sequence, and any preference that may become an objective.

This member contributes action preconditions and transitions, checked
intermediate states, valid and invalid plans, objective/equivalence semantics,
search-completeness limits, and no-plan meaning.

## Planning Contract

```text
initial state
goal predicate
legal actions and preconditions
transition result
state invariant
optional action cost
plan equivalence
```

Show every intermediate state. A plan is valid only when every action is enabled
and every intermediate state preserves the invariant.

## Valid Is Not Preferred

A shortest plan under action count may not minimize risk, downtime, or version
skew. State the encoded objective and acceptable equal optima. Changing the cost
model can legitimately change the preferred plan without changing validity.

Failure to find a plan proves impossibility only when a complete search terminates
conclusively. Timeout, pruning, divergence, finite depth, or an omitted action
produce unknown or model gaps.

## Worked Shape

```text
state: servers with online/version
initial: all online at version 1
goal: all online at version 3
invariant: at least one server online
actions: takeOffline, upgrade, bringOnline
cost: action count plus optional version-skew penalty
```

The artifact lists each intermediate state and checks the invariant before
comparing costs.

## Artifact

```text
Initial state and goal:
Actions, guards, and transitions:
State invariant:
Representative plan with intermediate states:
Invalid action or invariant-breaking plan:
Cost/objective and equivalent optima:
Search completeness and no-plan meaning:
Omitted actions or environmental assumptions:
```

## Stop And Separation

Stop when one valid and one invalid sequence are distinguishable, every
intermediate state is checked, and preferred/no-plan claims are relative to the
encoded objective and search completeness.

Use `temporal-behavior-models` when the question is all allowed histories rather
than one goal-directed sequence, `logic-query-semantics` for relational answer
semantics, and `solver-result-boundaries` for proven optimal or unsatisfiable
status.

## Source Trace

- Hillel Wayne, *Logic for Programmers*, v0.14.0:
  Chapters 11-12, pp. 139-168, for constraint planning, action sequences,
  objective functions, and result boundaries. Recorded beta defects are excluded.
- The production rolling-upgrade example and operational risk objectives are
  Developer adaptations; the source supplies the planning and search distinctions.
