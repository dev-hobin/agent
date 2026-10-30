# Topology, Resolution, And Routing

Use this reference when a task crosses several processes and the path depends on
fixed or dynamic participants, identity, resolution, discovery, or a router. It
provides a topology map, route-failure audit, complete case, and stop.

## Accepted Judgment Context

Supply the task identity and entry command, concrete participants and channels,
which participants are fixed or dynamic, destination identity, resolution and
discovery sources, router ownership, route changes, and one unavailable,
ambiguous, or stale-route case.

## Topology Before Router

Draw nodes and directed channels:

```text
initiator -> intake -> worker -> effect destination
                 \-> status owner
```

For every edge record:

```text
message or signal
sender and receiver identity
channel ownership
ordering and multiplicity assumptions
capacity or delivery boundary
route selection owner
failure visible to whom
```

A fixed topology may use anonymous channels when each endpoint is established by
construction. A dynamic topology needs enough identity and resolution to locate
or select an eligible participant. A router centralizes that decision; it does
not eliminate destination, staleness, conflict, or failure policy.

## Resolution Distinctions

```text
identity:
  stable name of a task or participant

resolution:
  mapping from identity or requirement to a current endpoint

discovery:
  observation of candidate endpoints and capabilities

routing:
  selection and forwarding policy for this message now
```

Do not collapse them into one lookup if their owners, validity windows, or failure
meanings differ.

## Worked Case: Regional Export Task

A submitted export must run in a worker for its data region.

Topology:

```text
client -> intake -> regional router -> worker -> object store
                     \-> outstanding-task owner
```

Route contract:

```text
task identity:
  assigned at intake and stable across retries
requirement:
  region and export kind
resolution:
  current eligible worker endpoints from a time-bounded worker view
routing:
  choose one eligible endpoint; preserve task identity
stale route:
  reject or re-resolve before ownership transfer
no route:
  task remains outstanding with explicit unavailable status
ambiguous route:
  deterministic policy or explicit conflict, never accidental iteration order
worker acceptance:
  distinct from export completion
```

Stale-route case:

```text
worker disappears after resolution but before acceptance
```

The router may retry another endpoint only while task ownership and duplicate
policy remain explicit. A transport timeout does not prove that the first worker
did not accept the task.

## Counterexample: Registry Called Discovery

A static process-local map is initialized once and never refreshed. It may be a
valid fixed registry, but it is not evidence of dynamic discovery or current
endpoint health. Name the actual validity boundary rather than inheriting a
stronger term.

## Artifact

```text
Task and entry command:
Topology diagram:
Node and channel table:
Fixed versus dynamic participants:
Identity:
Resolution source and validity window:
Discovery observations:
Routing and conflict policy:
Unavailable, ambiguous, and stale route behavior:
Ownership transfer point:
Decision:
```

## Stop And Separation

Stop when every route has a selection owner, identity survives rerouting where
required, stale and unavailable destinations have explicit outcomes, and one
route-failure trace preserves task ownership. A delivered message does not close
the task.

This reference does not invent topology, business completion, delivery
guarantees, or the capability that should resolve missing semantics or design.

## Source Trace

- Zachary Tellman, *Elements of Clojure*, Leanpub 2019-02-11:
  Composition, public-manuscript pp. 112-119, for static and dynamic process
  topologies, anonymous channels, identity, resolution, discovery, routers, and
  task flow. Complete distributed discovery and delivery protocols remain beyond
  the source's stated scope.
