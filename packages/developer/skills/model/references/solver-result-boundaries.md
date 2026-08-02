# Solver Result Boundaries

Use this reference when the model must interpret bounded counterexample search,
satisfiability, feasibility, or optimization status. It is self-contained and
does not require another modeling reference.

## Accepted Modeling Context

Supply the bounded question, variables and admitted domains, hard constraints,
optional objective, solution equivalence, finite scope, encoding assumptions,
and product observers outside the encoding.

This member contributes the satisfiable witness, exact result vocabulary, bound
and reduction meaning, ability-guarantee exchange, residuals, and verification
targets.

## Encoding Before Status

Separate:

```text
variables and domains
hard constraints
optional objective or ranking
solution equivalence
finite scope and search reductions
encoding assumptions
```

A mathematically optimal solution can still be operationally wrong when the
objective encodes the wrong preference.

## Satisfiable Witness And Bound

A bounded result supports only its scope and configuration. Record one
satisfiable witness for the assumptions so an inconsistent model cannot make
implications pass vacuously.

```text
scope and bounds
property checked
valid witness
counterexample result
unknown or incomplete paths
```

Absence of a counterexample inside a bound is not an unbounded proof.

## Preserve Result States

Keep exposed statuses distinct:

```text
satisfiable | unsatisfiable | unknown | timeout | error
unbounded | feasible | proven-optimal
```

A feasible result is not an optimality proof. `unknown` is neither satisfaction
nor impossibility. Specialization trades modeling flexibility for runtime and
predictability; state that ability-guarantee exchange.

## Artifact

```text
Variables, domains, and hard constraints:
Objective and solution equivalence:
Scope, bounds, and reductions:
Encoding assumptions:
Satisfiable witness:
Exact result status and meaning:
Counterexample or solution:
Unmodeled product observers:
Residual and verification target:
```

## Stop And Separation

Stop when the reported claim is no broader than the encoded model, bound, witness,
and exact result status.

Use `proof-obligations` for deductive implementation conformance,
`logic-query-semantics` for answer enumeration/search semantics, and `verify` for
tool execution relevance.

## Source Trace

- Hillel Wayne, *Logic for Programmers*, v0.14.0:
  Chapters 9-11, pp. 100-155, for bounded models, solver encodings,
  satisfiability, feasibility, optimization, and result states. Recorded beta
  defects are excluded.
- Harold Abelson and Gerald Jay Sussman with Julie Sussman, *Structure and
  Interpretation of Computer Programs*, Second Edition,
  Section 3.3.5
  calibrates relation propagation and contradiction, not modern solver status.
