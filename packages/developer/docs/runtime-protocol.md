# Developer runtime protocol

English | [한국어](./ko/runtime-protocol.md)

This document describes persisted `developer/v8` envelopes, the five
model-facing operations, pure replay, non-authoritative result summaries, and
receipt projection. User commands are described in the
[user guide](./user-guide.md).

## Ownership and values

Developer keeps these values distinct:

```text
DeveloperWorkScope  root lifetime and one active invocation limit
RouteDefinition     stable sign and strong stable sense
RouteFrame          exact revision, obligations, blockers, support, conclusion
Skill               optional replaceable collaborator
Judgment result     bounded candidate support
Authorization       one replay-current implementation capability
Landing             consumed authorization plus changed-path provenance
Receipt             read-only projection of one accepted event
```

No ID is interchangeable with another and no source type self-promotes.

## The five operations

| Operation | Accepted boundary | Runtime movement |
| --- | --- | --- |
| `developer_open_judgment` | Route definition, exact question, obligations, optional owner assignment | Opens a frame and optional routed Skill invocation |
| `developer_open_context_sources` | Current frame ID and exact Pi-visible descriptor IDs | Observes one atomic material-support batch |
| `developer_conclude_judgment` | Applicability, exact nominations, coverage, outcome, stop evidence | Settles the owner, admits support, discharges obligations, and concludes only when resolved |
| `developer_authorize_change` | Current concluded frame and conclusion hash, bounded movement, stable landing, verification target | Creates one process-local root authorization |
| `developer_record_landing` | Exact active authorization, non-empty changed paths, result and verification observations | Consumes authorization and creates reroute/verification debt |

The root exposes only operations legal for the replay-current scope. Opening a
context source or settling a Skill never grants file mutation.

## Envelope format

Only a Pi custom entry whose type is `developer.runtime` enters runtime replay.
Its data must be an exact canonical envelope:

```text
protocolVersion = developer/v8
eventId
workScopeId
scopeSequence
previousScopeEventSha256
causalRefs[] = { workScopeId, eventId, eventSha256 }
occurredAt
event = { kind, payload }
eventSha256
```

`scopeSequence` and the previous-event hash order one scope. `occurredAt` is
stored for audit only. Canonical JSON identity is locale-independent and rejects
unknown fields, unsafe numbers, oversized payloads, duplicate causal references,
and hash drift before transition effects.

## Event kinds

The closed v8 event union has 18 kinds.

| Group | Kinds |
| --- | --- |
| Scope/root | `work-scope-opened`, `work-scope-closed`, `change-authorized`, `implementation-landing-recorded` |
| Frame/routing | `route-frame-opened`, `route-frame-replaced`, `routing-snapshot-opened`, `routing-page-accounted`, `routing-coverage-completed`, `can-serve-basis-created` |
| Skill lifecycle | `ready-assignment-recorded`, `skill-invocation-started`, `invocation-settled` |
| Support/completion | `support-observed`, `frame-contribution-admitted`, `frame-blocker-resolved`, `obligation-discharged`, `route-frame-concluded` |

Every event is checked by the pure reducer. A semantically rejected envelope is
not accepted merely because its bytes were stored.

## Opening and routing a frame

Developer resolves the stable Route independently of Skills, freezes a bounded
ordered descriptor snapshot, and creates an exact frame revision. Routing pages
must account for every candidate in the admitted snapshot before coverage can be
complete.

An optional owner assignment binds capability ID, Skill revision, policy state,
target obligation IDs, limits, subquestion, expected contribution, and
`canServe` basis. There may be zero candidates or zero owner invocations. There
may never be two active invocations in one work scope.

## Context and Judgment

Context-source opening acquires only selected Pi-visible descriptors and method
content. A present malformed policy fails closed; absence is valid. Opening
material records support identity but does not admit a contribution.

At conclusion, every `branchResultId` is resolved to an exact current-branch
call/result before Judgment receives it. The optional owner settlement is parsed
as one closed return variant. Judgment output becomes candidate support; the
frame must still admit contributions and discharge obligations explicitly.

If the outcome needs more context or creates a dependency, the frame remains
open with current blocker identity. If it resolves, the conclusion proposal must
bind frame revision, discharge IDs, stop evidence, and the exact empty blocker
set.

## Authorization, landing, and debt

Authorization verifies the exact current frame conclusion and produces one
process-local value. Structural clones and serialized copies carry no mutation
authority.

Landing verifies that authorization, stores sorted changed paths and verification
observations, consumes mutation authority, and creates different reroute and
verification frame IDs. The corresponding Route conclusions clear those debts
separately. Scope closure is rejected while an authorization, invocation, frame,
or landing debt remains active.

## Replay and interruption

Replay examines only dedicated runtime entries in branch order:

```text
parse envelope
-> verify per-scope sequence/hash head and causal references
-> parse semantic event
-> apply root/frame transition to a candidate accumulator
-> accept the whole entry or retain the exact prior accumulator
```

Full-batch preflight predicts every event before append. Append is still
prefix-safe: if persistence stops midway, reconstruction runs in `finally` and
accepts the stored prefix without pretending the suffix exists.

## Tool-result summary for evaluators

Each successful model-facing operation returns opaque event IDs plus one bounded
plain summary:

```text
protocol: developer/v8-result
workScopeId: string | null
eventIds: string[]
runtime:
  state: inactive | blocked | idle | frame | authorized
  reroutePending: boolean
  verificationPending: boolean
```

This serialized summary is not replay input, a receipt, or authority. Evaluators
parse exact keys and may claim completion only for `idle` with both debt flags
false. Missing or malformed matching details fail before outcome publication.

## Receipts and latest-only publication

Only replay-accepted opaque events can produce the corresponding 18 receipt
kinds. Projection and page identities are canonical and process-local. Page size
is capped at 100; cursors are opaque and projection-bound.

The refresh coordinator publishes only the latest successful requested revision.
`Refreshing`, unavailable, failed-latest, stale publication, stale cursor, stale
page, and cloned values expose no prior-current data. The receipt TUI reads one
exact verified page and has no transition or persistence operation.

## Reload

Safe reload records only uncertain lifecycle cancellation for a current active
invocation. It never replays an effect or fabricates provider failure. Without a
safe lifecycle marker, Developer requests restart and writes nothing.

## Review checklist

- Is `developer.runtime` the only persistence entry point?
- Does every raw envelope and semantic variant reject unknown fields?
- Does scope sequence, not timestamp, determine order?
- Can a candidate affect obligations before frame-local admission? It must not.
- Can a child conclusion close its parent? It must not.
- Does replacement clear prior frame authority?
- Can landing bypass either debt? It must not.
- Can cloned reconstruction, authorization, projection, cursor, or page values be used? They must fail closed.
- Can the evaluator treat missing v8 result details as idle? It must not.
- Can the receipt observer route, mutate, or persist? It must not.
