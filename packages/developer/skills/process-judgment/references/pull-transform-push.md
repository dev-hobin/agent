# Pull, Transform, And Push

Use this reference when acquisition, domain transformation, and environmental
effects are mixed or their failures and resources have no clear owner. It
provides phase contracts, an effectful-input check, a worked case, and stop.

## Accepted Judgment Context

Supply the trigger, input source, external validity and availability behavior,
domain transformation, output effect, resources, failures, retry boundaries, and
one partial-input or partial-effect case.

## Phase Contracts

```text
pull:
  acquire external information
  bound size, time, and demand
  decode and validate input shape
  own unavailable, malformed, partial, and resource behavior

transform:
  compute domain meaning from bounded context-light data
  accrete, reduce, and reshape deliberately
  return a domain result or effect intent

push:
  interpret effect intent
  own destination validity, idempotency scope, partial failure, and reporting

apex:
  compose phases at the last responsible moment
  own the whole outcome without absorbing each phase's local mechanism
```

Use this split only when failures and ownership actually separate. One atomic
transaction or shared invariant may be the more truthful boundary.

## Effectful Input Ownership

A pull boundary is incomplete if it returns a lazy or deferred producer whose
consumer unexpectedly owns:

```text
I/O and decoding failures
resource closure
retry and truncation
demand and repeated evaluation
partial consumption
source lifetime
```

The mechanism need not be eager or callback-based. The operational requirement is
that the pull owner encloses acquisition and consumption obligations or exposes
them honestly in its result contract.

## Worked Case: Partner Catalog Import

```text
pull:
  open partner stream
  cap bytes and record count
  decode records
  reject malformed or unsupported rows explicitly
  close stream on success, failure, timeout, and early stop

transform:
  map admitted rows to product facts
  derive category and normalized units
  return accepted products plus explicit rejected-row evidence

push:
  persist one import batch
  report conflicts and partial failure
  emit completion only after the accepted transaction boundary

apex:
  run one import and produce the whole import outcome
```

Partial-input case:

```text
record 1 is valid; record 2 is malformed; network stops during record 3
```

The pull contract decides whether partial records are returned, discarded, or
reported. The transform must not discover that reading record 3 performs network
I/O after product computation has begun.

Partial-effect case:

```text
products persist but completion notification fails
```

The push contract distinguishes persisted outcome from failed notification. A
single `success` boolean would erase the partial result.

## Counterexample: Forced Phase Split

An operation checks inventory and decrements it under one atomic consistency
boundary. Pulling the check into one phase and pushing the decrement later may
create a race. Reject pull-transform-push when separating phases breaks the real
invariant owner.

## Artifact

```text
Trigger and whole outcome:
Pull input, bounds, validation, failures, and release:
Transform input, domain result, and information changes:
Push effect, partial failure, and reporting:
Apex ownership:
Effectful-input escape audit:
Atomicity counterexample:
Decision:
```

## Stop And Separation

Stop when each phase has bounded inputs, outputs, failures, and resources; the
pull owner encloses effectful consumption; the push owner exposes partial effects;
and one atomicity counterexample confirms that the split is truthful.

This reference does not require three functions, invent domain meaning, prescribe
an effect library, or route missing process or protocol work.

## Source Trace

- Zachary Tellman, *Elements of Clojure*, Leanpub 2019-02-11:
  Composition, public-manuscript pp. 104-112, for pull-transform-push ownership,
  bounding and validating input, effectful lazy acquisition, transformation,
  effect descriptions, and late composition. The source's file example omits
  resource closure; complete lifetime ownership is required here.
