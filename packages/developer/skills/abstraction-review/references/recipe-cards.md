# Abstraction Review Recipe Cards

Use this deck when the review needs a construction rule, not only a layer name.
Each card must produce an artifact and a stop check.

Read [the worked examples](worked-examples.md) when a card's compact rule is not
enough to calibrate a real candidate. When a stop check fails, use
[the repair table](repair-table.md) instead of polishing the same surface.

## Contents

- Pocket Deck
- Procedure -> Process Reality Check
- Movement Pattern Extraction
- Responsibility Boundary
- Invariant Iteration
- Data Abstraction Boundary
- Closure Composition Unit
- Dispatch Registration
- Meaning-Preserving Path
- Notation As Data
- History Placement
- Event Order Protection

## Pocket Deck

| Card | Trigger | Fill first | Derive | Stop | Repair if fails |
| --- | --- | --- | --- | --- | --- |
| Procedure -> Process Reality Check | Result is plausible but process shape is unclear | procedure text, sample input, expected result | trace deferred work, state updates, duplicated work, cost | result, shape, and cost are all explainable | move to Law or Time |
| Movement Pattern Extraction | Similar cases move together but differ in stable roles | concrete cases side by side, common movement, varying roles | keep common movement as body; lift stable variation roles to parameters, callbacks, or strategies | old cases become simple calls and new case is expressible | split, inline, or return to Language |
| Responsibility Boundary | Knowledge and behavior appear owned by the wrong unit | current owners, messages, data, callers, change reasons | group knowledge with behavior and state the smallest role contract | representative change becomes local without context leaks | split, inline, or return to Model |
| Invariant Iteration | Recursion or state should become a stable transition | original meaning, state variables, transition candidate | write `processed meaning + remaining meaning = original meaning` using the domain operation | initial, step, and final checks pass | return to Run trace or reduce state variables |
| Data Abstraction Boundary | Caller knows raw representation | domain value, operations, representation candidates | create constructor, selector, predicate, and operation vocabulary | caller code stops touching raw representation | move to Unit or Engine |
| Closure Composition Unit | Operation results cannot feed later operations | candidate unit, operation list, preserved meaning | mark closed operations vs observers/finalizers | closed operations build larger values of the same unit | move final effect outside the unit |
| Dispatch Registration | New type/provider/case changes old branches | variant axis, operation axis, current branches | turn each branch into `(variant, operation) -> method` | fake variant is added by registration only | choose axes again or use Meaning-Preserving Path |
| Meaning-Preserving Path | Mixed worlds need operation without hidden loss | source worlds, operation, candidate paths | draw direct/coerce/canonicalize/reject graph | legal path, loss, and unsupported cases are explicit | narrow preserved meaning or reject |
| Notation As Data | String/index manipulation stands in for semantic rules | expression cases, parts, transformations | make predicate/selector/constructor vocabulary | rewrite rule ignores raw layout | move to Boundary or Engine |
| History Placement | Same call depends on history | behavior, required history, interaction model | choose pure, local state, or stream/log placement | hidden summary or explicit history matches contract | move to Event Order or Boundary |
| Event Order Protection | Interleaving changes correctness | events, shared meaning, possible interleavings | state order law and protected region or merge policy | forbidden interleaving is blocked for a stated reason | narrow order law or return to History |

## Card Details

### Procedure -> Process Reality Check

Use when code is textually simple but execution may grow the wrong process.

Output artifact:

```text
process trace:
  input -> stage -> stage -> result
shape:
  recursive / iterative / tree / delayed / stateful
cost note:
  time, space, duplicated work, hidden order
```

Promote only if the abstraction promise includes the real process shape, not
just the returned value.

### Movement Pattern Extraction

Use when abstraction pressure comes from repeated movement, not from a single
interface wish.

Input artifact:

```text
cases:
  two or more concrete functions, workflows, tests, or traces
common movement:
  steps that move together across cases
variation roles:
  stable differences such as predicate, term, next, combine, strategy, policy
```

Derivation:

```text
body:
  keep the common movement
parameters:
  lift stable variation roles
name:
  describe the concept, not the implementation trick
```

Output artifact:

```text
abstraction candidate:
  name, signature, body skeleton
role table:
  case -> variation role values
process note:
  whether the generated process/cost changes
```

Stop check: each old case is a simple call, and at least one realistic new case
can be expressed without adding a new option that exposes internals.

Reject if the cases only look textually similar but carry different
responsibilities. Split if variation roles are not stable.

### Responsibility Boundary

Use when repeated arguments, data clumps, feature envy, conditional behavior, or
several change reasons suggest that knowledge and behavior have the wrong owner.

Input artifact:

```text
current owners:
  unit -> knowledge, behavior, coordination, creation
messages:
  callers -> requests -> receivers
pressure:
  representative accepted change and affected path
candidate:
  knowledge and behavior proposed to move together
```

Derivation:

1. group behavior with the knowledge needed to answer its messages;
2. separate domain responsibility from coordination and object creation;
3. state the smallest caller-visible role contract;
4. identify old context callers should stop knowing;
5. test a representative change against old and candidate ownership.

Output artifact:

```text
responsibility: name and reason to change
knowledge: data or history it owns
messages: minimal protocol
hidden context: mechanics removed from callers
creation boundary: who selects or constructs it
rejected alternatives: inline, split, or different owner
```

Stop check: the representative change is local to a coherent owner, callers use
messages rather than extracting its knowledge, and the candidate does not need
unrelated context from the old host. Reject or split when the candidate is only
a bag of moved methods, a generic service, or a pattern-shaped destination.

### Invariant Iteration

Use when state variables or accumulators need meaning.

Output artifact:

```text
invariant:
  what state variables preserve
initial:
  why the invariant starts true
transition:
  why one step keeps it true
final:
  why termination exposes the answer
```

If the invariant is hard to state, decide `revise-model`. If it is true but
expensive, review representation or operation placement.

### Data Abstraction Boundary

Use when callers know too much.

Output artifact:

```text
public handles:
  constructors / selectors / predicates / generic operations
representation law:
  what callers may trust
hidden freedom:
  internal details that may change
creation policy:
  validation / normalization / simplification location
```

If no detail is hidden, reject or inline. If policy is hidden in consumers,
decide `revise-surface`.

### Closure Composition Unit

Use when the goal is an algebra of reusable pieces.

Output artifact:

```text
unit predicate:
  what belongs to the world
closed operations:
  unit -> unit, unit x unit -> unit
observers/finalizers:
  unit -> outside
illegal move:
  operation that leaks or breaks the unit
```

Do not make everything chainable. Preserve the central unit and move final
effects to an explicit boundary.

### Dispatch Registration

Use when variation should be additive.

Output artifact:

```text
table:
  variants x operations
registration:
  register(variant, operation, method)
lookup:
  applyGeneric(operation, value...)
unsupported:
  explicit missing capability policy
```

Stop check: add a fake variant. Existing callers and existing variant packages
should not know its representation.

### Meaning-Preserving Path

Use when values cross worlds.

Output artifact:

```text
conversion graph:
  source -> target paths
preserved meaning:
  what must survive conversion
policy:
  direct / raise / canonicalize / reject
loss note:
  precision, identity, ordering, capability
```

Unsupported is a legitimate boundary, not a failure, when meaning cannot be
preserved.

### Notation As Data

Use when a language, expression, query, or formula must be inspected or
rewritten.

Output artifact:

```text
expression boundary:
  predicates / selectors / constructors
transform rules:
  algorithms written against the boundary
render/evaluate boundary:
  where data becomes displayed or executable again
```

If transformation rules depend on indexes or string layout, the boundary is not
real yet.

### History Placement

Use when current behavior cannot be understood from current input alone.

Output artifact:

```text
placement:
  pure / local state / stream-log
state contract:
  what hidden state summarizes
stream contract:
  what each time-indexed value means
order risk:
  where histories merge or conflict
```

Local state hides history for API simplicity. Stream/log exposes history for
composition, replay, audit, and merge reasoning.

### Event Order Protection

Use when order is part of meaning.

Output artifact:

```text
order law:
  required happens-before relation
protected region:
  steps that must appear atomic
mechanism:
  lock / transaction / queue / serializer / merge policy
cost:
  waiting, reduced parallelism, fairness tradeoff
```

If everything must be serialized, the order law is probably too broad.

## Source Trace

- Harold Abelson and Gerald Jay Sussman with Julie Sussman, *Structure and
  Interpretation of Computer Programs*, Second Edition, MIT Press, 1996:
  procedure/process distinction, data abstraction, closure, generic dispatch,
  state/history, and metalinguistic boundaries.
- Matthias Felleisen, Robert Bruce Findler, Matthew Flatt, and Shriram
  Krishnamurthi, *How to Design Programs, Second Edition*, MIT Press, 2018:
  templates, abstraction from concrete examples, generative recursion, and
  accumulator invariants.
- Sandi Metz, Katrina Owen, and TJ Stankus, *99 Bottles of OOP*, Second
  Edition, version 2.2.2, 2024: movement patterns, responsibility extraction,
  messages, substitution, polymorphic roles, type transitions, and factory
  tradeoffs.
- Hillel Wayne, *Logic for Programmers*, version 0.14.0, May 4, 2026:
  contracts, safe replacement, invariants, and meaning-preserving model changes.
- Zachary Tellman, *Elements of Clojure*, 2019: indirection cost, module
  assumptions, principled components, adaptable interfaces, and composition.
