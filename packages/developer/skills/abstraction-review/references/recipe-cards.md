# Abstraction Review Recipe Cards

Use this deck when the review needs a construction rule, not only a layer name.
Each card must produce an artifact and a stop check.

## Contents

- Pocket Deck
- Procedure -> Process Reality Check
- Movement Pattern Extraction
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
