# Type Transitions

Use this reference when an accepted event or operation transforms one domain type
into another and the design must preserve meaning across the boundary.

## Transition Contract

```text
source type
triggering operation or event
target type
preconditions
meaning preserved
source facts consumed or retained
boundary or terminal behavior
failure result
who selects or constructs the target
```

A transition that does not preserve a common role may require an explicit result
type rather than inheritance. The target should not select itself when the needed
selection knowledge belongs to a caller or creation boundary.

## Artifact

```text
Source and target types:
Event/operation and preconditions:
Preserved meaning:
Consumed, retained, and newly created facts:
Terminal/boundary behavior:
Failure and unsupported transitions:
Selection/construction owner:
Transition examples and checks:
```

## Stop And Separation

Stop when every accepted source state has one explicit target/failure meaning and
preserved facts can be checked without relying on representation coincidence.

Use `variation-roles` when several implementations share one protocol,
`selection-and-creation` when target selection is independently unresolved, and
`model/temporal-behavior` when order among transitions remains product policy.

## Source Trace

- Sandi Metz, Katrina Owen, and TJ Stankus, *99 Bottles of OOP*, Second Edition,
  v2.2.2, Chapters 6-7, pp. 155-187, for type transitions, target selection, and
  the boundary between polymorphic role and a changed type.
- Harold Abelson and Gerald Jay Sussman with Julie Sussman, *Structure and
  Interpretation of Computer Programs*, Second Edition,
  Section 2.5
  calibrates operations whose results move between representation systems.
