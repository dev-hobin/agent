# Responsibility And Collaboration

Use this reference when a real accepted change exposes misplaced knowledge,
repeated arguments, data clumps, feature envy, navigation leaks, or uncertainty
about which participant should own a decision.

## Begin With Change Pressure

State the accepted change and where the current arrangement resists it. A smell
locates a point of attack; it does not select a class, service, or pattern.

Inventory what each current unit:

- knows;
- calculates or decides;
- coordinates;
- creates;
- sends to collaborators;
- changes for independent reasons.

Write wished messages in domain language. Repeatedly pulling data from one unit
so another can interpret it is evidence of misplaced responsibility.

## Candidate Owner

```text
responsibility and reason to change
knowledge or history required
minimal caller messages
hidden context callers stop knowing
creation/selection owner
representative accepted change
rejected old placement
```

A credible unit groups behavior with the knowledge needed to answer its messages.
Reject moved-method bags, generic services, and pass-through interfaces with no
independent participant or change pressure.

## Participant And Environment Boundary

```text
environment and participants
represented and ignored facts
interface sense
assumptions and drift signal
independent purposes/deployments/replacement cycles
```

A cohesive component may share assumptions internally. Strong interfaces belong
between independently evolving participants. Public boundaries calcify, so mature
them locally when both sides co-evolve.

## Navigation And Dependency

A message chain is problematic when intermediate results cross collaborator API
boundaries and expose structure. Chain length alone is not the criterion.
Forwarding can reduce direct coupling as an intermediate move, but a
structure-shaped forwarding name is not completed responsibility movement.

Depend on the stable role a caller actually uses. Do not inject unrelated objects
merely to make every unit configurable.

## Tests As Responsibility Evidence

Prefer focused evidence for stable public responsibility and integration evidence
for collaboration/creation. A tiny collaborator may be covered through its
owner only when it is simple, invisible elsewhere, and has no independent
context. Fakes preserve the role while removing irrelevant context; tests that
echo private calls inhibit redesign.

## Artifact

```text
Accepted change pressure:
Current responsibility inventory:
Point of attack:
Wished messages:
Candidate owner, knowledge, contract, and hidden context:
Participant environment, assumptions, and replacement cycles:
Navigation/dependency boundary:
Representative change and rejected placement:
Responsibility and collaboration checks:
```

## Stop And Separation

Stop when the representative change becomes local to one coherent owner and
callers use meaningful messages without unrelated context or participant leaks.

Use `variation-roles-and-transitions` when several implementations must share a
caller contract, and `selection-and-creation` when choosing or constructing a
variant is independently unresolved. Route a concrete candidate to
`abstraction-review`; do not approve it here.

## Source Trace

- Sandi Metz, Katrina Owen, and TJ Stankus, *99 Bottles of OOP*, Second Edition,
  v2.2.2, Chapters 3-5 and 8-9, pp. 51-154 and 188-268, for change pressure,
  responsibility extraction, messages, argument movement, dependency direction,
  API-aware Demeter judgment, forwarding, and responsibility-focused tests.
- Zachary Tellman, *Elements of Clojure*, Leanpub 2019-02-11:
  Indirection, public-manuscript pp. 70-95, for environment/model/interface/
  assumptions, principled components, participant pressure, and calcification.
- Harold Abelson and Gerald Jay Sussman with Julie Sussman, *Structure and
  Interpretation of Computer Programs*, Second Edition,
  Section 2.1
  calibrates hidden representation and operation ownership.
