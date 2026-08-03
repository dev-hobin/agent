# Developer operating principles

English | [한국어](./ko/how-it-works.md)

Developer is the root runtime for one bounded coding turn. It owns routing,
invocation order, support admission, obligation discharge, file-change
authorization, landing debt, replay, and frame conclusion. Judgment remains a
pure evidence/outcome engine, and Skills remain replaceable collaborators.

The central separation is:

```text
semantic lane: RouteDefinition -> RouteFrame -> admitted support -> conclusion
change lane: concluded frame -> authorization -> landing -> reroute + verification
observer lane: accepted event -> receipt -> exact-current bounded page
```

No value crosses lanes merely because it has a familiar name.

## 1. Stable Routes and dynamic frames are different values

A `RouteDefinition` contains a stable sign and strong stable sense. Its meaning
must remain valid without any same-named Skill. A `RouteFrame` is one exact
runtime realization with a revision, question, obligations, blockers,
contributions, discharges, and optional conclusion.

Any Route may be the entry or terminal movement. Developer does not force a
fixed phase pipeline. Replacing a frame creates a new revision and clears all
routing, assignment, invocation, admission, discharge, cursor, and conclusion
authority from the old revision.

## 2. Descriptor-first routing is finite and bounded

For an open frame, Developer freezes an immutable ordered candidate snapshot.
It accounts bounded pages and completes coverage only for that admitted
snapshot. Coverage proves what was considered; it cannot discharge an
obligation or conclude the frame.

A same-named Skill establishes no service relation. Service requires the exact
selected capability, current `canServe` basis, assignment targets, invocation,
returned value, frame-local admission, and explicit discharge.

Only one Skill invocation may be active in one work scope. Other Skills may be
opened as contextual material but do not become owners.

## 3. Skill returns are candidates, not authority

The Skill lifecycle is:

```text
canServe -> invoked -> returned -> conforming -> admitted -> discharged
```

A return is exactly one of `Contribution`, `Dependency`, `NotApplicable`,
`NeedsContext`, or `Abort`. Provider failure, lifecycle settlement, and a parsed
`Abort` are distinct facts. The first terminal settlement wins.

A returned contribution carries `useAs` on every contribution-to-obligation
edge. It cannot discharge anything until the current frame admits it against the
exact settlement cause. Child-frame results, materials, tools, and Judgment
outcomes follow the same candidate-support rule.

## 4. Frame completion is reducer-guarded

A frame can conclude only when:

- every current obligation has a current discharge;
- every discharge cites admitted support;
- stop evidence is non-empty and current;
- the proposed blocker-set identity matches the exact empty current set; and
- no invocation or unresolved blocker remains.

A negative judgment may satisfy those conditions. `resolved` means the bounded
question has an outcome; it does not mean approved, correct, or authorized.
Zero-Skill completion is valid when current admitted non-Skill support proves the
obligations.

## 5. Judgment supplies bounded context and outcomes

`@hobin/judgment` does not route or mutate. Developer supplies the exact Skill
owner, dynamic question, selected branch-local materials, compiled optional
policy, contribution coverage, and outcome proposal.

At the model boundary, `branchResultId` is only a compact alias. Before Judgment
uses it, Developer resolves the current-branch call, arguments, ordered result,
status, and content hash. Selected material is reacquired and sealed atomically.
Absent `judgment.json` is normal; malformed presence fails closed.

A `DeveloperContextBasis` binds the resulting policy, question, selection,
sealed content, coverage, outcome, sources, members, contributions, conflicts,
and limitations by canonical hash. It is support for the frame, not global
service or change authority.

## 6. Authorization and landing are root capabilities

Only a current concluded frame can create one bounded change authorization. The
value binds frame revision and conclusion hash to movement, stable landing,
verification target, and any evidence-preserving implementation boundary.

Recording a landing requires that exact active authorization and non-empty
changed paths. It consumes the authorization and creates two causal debts with
different frame identities:

```text
reroute debt       -> what belongs next?
verification debt  -> what does current evidence support?
```

Both must clear independently before another authorization is available. A
landing is provenance, not a verified flag.

## 7. Runtime history is one exact v8 chain

Developer persists only custom entries of type `developer.runtime`. Every
`developer/v8` envelope binds work-scope ID, scope sequence, previous event
hash, causal references, event kind, payload, and canonical event hash.
Timestamps are audit fields and never order a scope.

Replay is pure and atomic per entry. Rejected entries do not advance heads,
indexes, root state, or frame state. A persisted prefix of an interrupted batch
remains replayable. Multiple open work scopes, malformed envelopes, illegal
transitions, or broken causal identity block new writes.

Serialized or structurally cloned refined values retain no process authority.
This applies to routing bases, assignments, reconstruction values,
authorizations, landings, projections, publications, cursors, and pages.

## 8. Receipts are the only TUI data source

Only replay-created opaque accepted events may create receipts. Projection
creation verifies accepted-event provenance, canonical order, duplicate
identity, bounds, and content hash. Pages contain at most 100 receipts and never
silently truncate.

The projection coordinator publishes latest-only. A latest refresh failure does
not restore an older projection as current. Reads require exact coordinator,
publication, projection, cursor, and page identities. `Refreshing`, stale, and
cloned values fail closed.

The TUI receives only the exact current coordinator/publication target and one
bounded verified page. It cannot route, settle, admit, discharge, conclude,
authorize, enforce, persist, or publish.

## 9. Tool access follows replay-current root state

Developer controls only source-identified Pi built-ins. It withholds shell and
mutation capabilities according to the current frame and root authorization,
then restores only the exact tool delta it previously withheld. An unrelated
extension tool with the same display name is not classified as a Pi built-in.

This is not an operating-system sandbox. The guarantee is protocol ownership and
bounded tool projection, not path-level process isolation.

## 10. Reload never invents effects

A safe lifecycle marker permits reload reconciliation of an uncertain active
invocation as cancellation with `executionUncertain: true`. Replay never reruns
an effect or fabricates provider failure.

Without the marker, Developer requests restart, changes no tool ownership, and
writes no reconciliation event. That restart alert is operational and therefore
is not fabricated as a semantic receipt.
