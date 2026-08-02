# Developer runtime protocol

English | [한국어](./ko/runtime-protocol.md)

This document is for maintainers who change persisted `developer/v7` events or
the five model-facing operations. User commands are described in the
[user guide](./user-guide.md).

## Why the protocol is split

Developer keeps semantic judgment, mutation permission, and landing records as
different values. A model cannot put changed paths into a judgment conclusion or
use a judgment ID where an authorization ID is required.

## The five operations

| Operation | What it accepts | State change |
| --- | --- | --- |
| `developer_open_judgment` | One bundled Skill, one dynamic question, optional target PendingQuestion | Creates `ActiveJudgment` |
| `developer_open_context_sources` | Active judgment ID and 1–16 exact Pi-visible Skill source IDs | Adds one atomic source batch to that judgment |
| `developer_conclude_judgment` | Applicability, nominations, contributions, coverage, outcome, question updates | Records a completed judgment and clears it |
| `developer_authorize_change` | Bounded movement, stable landing, verification target, optional boundary | Creates `AuthorizedChange` |
| `developer_record_landing` | Active authorization ID and non-empty changed paths | Records the landing and creates reroute/verification obligations |

The pure state exposes only operations that are legal now:

| Active state | Legal operation |
| --- | --- |
| Disabled | Activation command only |
| Idle | Open a judgment; authorize only when implementation gates are closed |
| ActiveJudgment | Open context sources or conclude |
| AuthorizedChange | Record landing |
| After landing | Open the next judgment; no new mutation authority until obligations permit it |

`developerNextOperations` and `developerToolAccess` derive this projection from
state. The extension does not maintain a second mutable registry.

## Opening a judgment

The extension resolves the selected Skill from the current Pi inventory, reads
its method, and compiles its optional policy. The event binds:

```text
judgmentId
Skill name and exact location
question text
optional target PendingQuestion
optional compiled policy
current branch identity
known evidence
```

A Skill without `judgment.json` is valid and simply has no prepared references.

## Opening external context sources

This operation may be repeated while the same judgment is active. For every
source ID, the extension:

1. resolves the current Pi descriptor;
2. reads `SKILL.md` within the byte limit;
3. loads a co-located policy if it exists;
4. compiles that policy with the source's actual owner and root;
5. computes descriptor and method-content identities.

All sources in one call succeed together. A duplicate, stale descriptor, unsafe
path, oversized method, or malformed present policy rejects the whole call. A
successful batch from an earlier call remains open.

Opening a source does not claim that it applies. The model must first see the
method and policy, then provide exactly one applicability assessment for every
policy-bearing source during conclusion.

## Concluding a judgment

At the model boundary, `branchResultId` is a compact reference to one current-
branch Pi tool call. The extension resolves it to the exact call, arguments,
result order, status, and content hash before the Judgment engine sees it.

The conclusion path is:

```text
parse raw conclusion fields
-> recheck owning and external Skill descriptors
-> recheck policies and branch results
-> admit only applicable external providers
-> select and seal nominated content atomically
-> check a contribution for every usable member
-> create coverage and outcome
-> build DeveloperContextBasis
-> preview the pure Developer transition
-> append JudgmentConcluded
```

Nothing is appended if acquisition, sealing, coverage, outcome parsing, or the
pure transition fails.

A conclusion may resolve, defer, supersede, or create `PendingQuestion` values.
Question owner, gate, and resolution criteria must match current state. A
user-owned resolution that claims `user-accepted` assurance requires the exact
branch-local user event.

## Authorizing a change

`developer_authorize_change` is accepted only when:

- Developer is enabled and no work is active;
- any target PendingQuestion exists;
- no before-implementation question is unresolved;
- rerouting and implementation-framing obligations are closed;
- movement, stable landing, and verification target are non-empty; and
- optional refinement or trusted-compiler boundaries parse as exact variants.

The trusted-compiler boundary is a bounded evidence gap, not permission to cast
arbitrary values.

## Recording a landing

`developer_record_landing` must reference the exact active authorization and at
least one changed path. The transition stores the authorization and landing
together, clears mutation authority, and sets:

```text
rerouteRequired = true
verificationRequired = true
```

There is deliberately no `verified` flag on a landing.

## Replay and append order

Developer rebuilds state from current-branch custom entries:

```text
identify Developer-owned entry
-> parse its exact event variant
-> apply the pure transition
-> keep accepted state or report a bounded replay issue
```

The runtime follows parse -> derive evidence -> build event -> preview transition
-> append entry -> project tools/UI. It never publishes state before the session
append succeeds.

### Unsupported v6 history

`developer/v6` entries are recognized only so the extension can report them.
They are not translated into v7 because old route, guidance, judgment, mutation,
and landing values do not map one-to-one to the current authorities.

## Review checklist

- Does each raw variant reject unknown fields?
- Can only currently legal operations be called?
- Are selected files and branch results reacquired before append?
- Can a judgment mutate artifacts? It must not.
- Can a landing avoid verification debt? It must not.
- Are external source batches all-or-nothing?
- Does replay reject stale, conflicting, and sibling-branch identities?
- Does hot reload restore only Developer's own tool delta?
