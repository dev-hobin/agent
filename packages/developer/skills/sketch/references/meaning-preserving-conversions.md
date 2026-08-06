# Meaning-Preserving Conversions

Use this reference when values from different representation worlds must
participate in one operation without silently losing domain meaning. It is
self-contained and does not require another boundary reference.

## Accepted Boundary Context

Supply the source representation worlds, target operation, domain observers that
must survive, known precision/identity/order/metadata/capability differences,
unsupported combinations, and any explicit conversion context.

This member contributes the conversion graph, preserved and lost observers,
ambiguous-path and cycle policy, direct/canonical/context/reject decision, and
round-trip checks.

## Draw Paths

```text
Integer -> Rational -> Decimal
Money(USD) -X-> Money(EUR) without exchange context
```

For each edge state:

```text
source and target meaning
operation that requires the path
precision, identity, order, metadata, or capability preserved
ability lost
ambiguous alternate paths
cycle and termination policy
unsupported result
```

A path through representations is not evidence that the conversion is meaningful.
Choose direct operation, coercion, canonical form, explicit context, or rejection.

## Path Selection

Prefer a path only when:

- every edge preserves the observer required by the operation;
- alternate paths do not produce ambiguous meaning;
- repeated conversion terminates and does not accumulate hidden loss beyond the
  contract;
- unsupported combinations fail visibly;
- the canonical form, if any, does not erase a needed source distinction.

## Artifact

```text
Source worlds and target operation:
Conversion graph:
Preserved observer by edge:
Lost ability by edge:
Ambiguous paths and precedence:
Cycle/termination policy:
Direct/canonical/context/reject decision:
Unsupported and round-trip checks:
```

## Stop And Separation

Stop when every legal path has an explicit preserved observer and loss note, and
unsupported or ambiguous paths are rejected or owned by policy.

Return to `model/contract-replacement` when preserved meaning itself is disputed.
Use `generic-dispatch-systems` when additive operation selection is independently
required.

## Source Trace

- Harold Abelson and Gerald Jay Sussman with Julie Sussman, *Structure and
  Interpretation of Computer Programs*, Second Edition,
  Section 2.5
  for coercion, type towers, ambiguity, and representation interactions.
- Hillel Wayne, *Logic for Programmers*, v0.14.0, Chapter 5, pp. 47-60,
  calibrates observer-relative replacement; conversion-graph and production
  compatibility artifacts are Developer synthesis.
