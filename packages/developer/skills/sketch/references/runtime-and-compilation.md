# Runtime And Compilation

Use this reference when an accepted language must be interpreted, lowered,
compiled, optimized, or mixed across execution modes. It is self-contained and
does not require another language or boundary reference.

## Accepted Boundary Context

Supply the source-language primitives and observers, evaluator result and error
contract, representative nested call, state/effects visible across execution,
allocation identity and release assumptions, and any interpreted/compiled or
old/new interoperation requirement. If language meaning is unsettled, return that
gap rather than selecting a runtime convention.

This member contributes the calling/result convention, control and live-state
ownership, effect summaries, optimization guards and fallback, tail-space
obligation, root/release model, interoperation adapter, and falsifying trace.

## Execution Convention

```text
inputs and result location
control/continuation owner
state modified and state live across nested work
error/cancellation transfer
allocation roots, identity, and release
interpreted/compiled or old/new interoperation
```

A language contract does not implement this convention; the runtime must preserve
its declared observers.

## Effect Summaries

Attach conservative summaries to generated fragments:

```text
needs | modifies | allocates | performs | may-fail
```

A composition may omit a save, lookup, or check only when the summary proves it
unneeded. Missing an effect can produce pass-but-wrong execution;
over-approximating usually loses optimization.

## Optimization Guard

```text
assumption:
proof or runtime guard:
fallback:
observers preserved:
```

Lexical addressing, primitive inlining, or direct transfer must preserve scope,
rebinding, evaluation order, errors, effects, and tail-space promises. Tail calls
require direct control transfer without a frame retained solely for return.

Mixed execution requires a shared calling convention or an explicit adapter.
State the complete root set, object identity across movement, external handles,
capacity, release, and out-of-memory behavior.

## Artifact

```text
Source language observers:
Calling and result convention:
Control, live state, save/restore, error, and cancellation:
Effect summaries:
Optimization assumptions, guards, and fallback:
Tail-space obligation:
Roots, identity, capacity, handles, and release:
Interoperation adapter:
Trace or generated-fragment check:
```

## Stop And Separation

Stop when a representative nested call and optimized fragment preserve the
accepted language observers under explicit guards, and roots/release/interoperation
are complete enough to falsify runtime claims.

Return to `language-semantics` when program meaning remains unsettled. Use
`process-shape-and-resources` for ordinary non-language process boundaries.

## Source Trace

- Harold Abelson and Gerald Jay Sussman with Julie Sussman, *Structure and
  Interpretation of Computer Programs*, Second Edition:
  Section 5.1,
  Section 5.3,
  Section 5.4,
  and Section 5.5
  for calling conventions, explicit control, effect/liveness summaries, roots,
  tail calls, compilation guards, and mixed execution.
- Validation taxonomies, migrations, production capacity, and rollout protocols
  are Developer adaptations, not SICP claims.
