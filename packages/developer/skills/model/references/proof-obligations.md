# Proof Obligations

Use this reference when the model must state what a proof establishes about an
implementation under explicit assumptions. It is self-contained and does not
require another modeling reference.

## Accepted Modeling Context

Supply the bounded claim, admitted input and runtime domains, pre/postconditions,
repeated-control candidate, arithmetic model, environmental assumptions, trusted
tool boundary, and observers intentionally outside the proof.

This member contributes initialization, preservation, conclusion, termination,
residual observers, and verification targets. It never treats specification
self-consistency as product usefulness.

## Specification Relative Proof

Write:

```text
preconditions
postconditions
invariant for repeated control
initialization
preservation
conclusion
termination argument when total correctness is claimed
arithmetic and runtime model
assumptions outside the model
trusted tool boundary
```

A proof can be valid while the specification omits product meaning, performance,
effects, or environmental assumptions. Keep partial correctness, termination, and
resource claims separate.

## Worked Shape

```text
qr(x, y) -> (q, r)
requires: x >= 0 && y > 0
ensures: q * y + r == x; 0 <= r < y

invariant: q * y + r == x
measure: r decreases by positive y
```

The argument assumes mathematical integers. Overflow or a missing performance
claim can invalidate the product judgment without invalidating this relation.

## Artifact

```text
Claim and specification:
Preconditions and admitted domain:
Invariant:
Initialization, preservation, and conclusion:
Termination argument:
Arithmetic/runtime assumptions:
Trusted boundary:
Observers outside the proof:
Residual and verification target:
```

## Stop And Separation

Stop when initialization, preservation, conclusion, and any termination argument
support exactly the stated specification and every omitted observer is explicit.

Use `solver-result-boundaries` for bounded model or optimization status. Hand off
to `verify` when execution, source/tool provenance, or relevance of proof evidence
must be judged.

## Source Trace

- Hillel Wayne, *Logic for Programmers*, v0.14.0:
  Chapter 6, pp. 61-72, for pre/postconditions, invariants, termination, and proof
  limits. Recorded arithmetic and exercise defects are excluded.
- Matthias Felleisen et al., *How to Design Programs*, living build 9.2.0.3,
  Chapter 28
  for numerical-method assumptions and progress obligations.
