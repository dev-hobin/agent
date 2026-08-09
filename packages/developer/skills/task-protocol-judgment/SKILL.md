---
name: task-protocol-judgment
description: "Judge a concrete task protocol that crosses processes by separating command entry, topology, identity, routing, receipt, business completion, outstanding-work ownership, retry, duplicates, idempotency, cancellation, recovery, and stop. Use when message delivery may be mistaken for completed work."
---

# Task Protocol Judgment

Judge whether a task can cross process boundaries without losing authoritative
completion ownership.

## Core Question

Who can distinguish outstanding work from completed work, and do acknowledgments,
retries, duplicates, cancellation, and recovery preserve that distinction?

## Judgment Spine

```text
accepted task meaning + entry command
-> topology, identity, resolution, and route
-> uncertain effect boundary
-> receipt versus business completion acknowledgment
-> outstanding owner, retry, duplicate, cancellation, recovery, and stop
-> coherent | incomplete | unsafe | needs-owner
```

Successful transport is not successful business completion unless the protocol
explicitly makes those events equivalent.

## Inputs

- Accepted task identity, entry command, and business-completion meaning
- Concrete participating processes, channels, routes, and effects
- Receipt and completion signals, failures, timeouts, retries, and duplicates
- Outstanding-work state, durability, cancellation, recovery, and termination

## Supporting Materials

The core method is complete without supporting material. Supporting material may
refine the current question; it is guidance, not authority.

If the host has supplied a bounded selection for this invocation, use it as the
current selection. Apply each material only to the question it actually
addresses and preserve any visible mismatch as a limitation. Do not rediscover
alternatives unless the selection is explicitly incomplete.

Otherwise, inspect the colocated [Skill TOC](toc.json). Use its root `when` and
`unless` conditions to confirm that this method applies; exclusions win. If an
exclusion applies, return `not-applicable` rather than forcing the method. Then
evaluate every Reference's `when` conditions and read the smallest materially
applicable set before producing the result. Broad topic similarity alone is not
sufficient. If no Reference applies, proceed with the core method alone.

## Output

Produce a protocol card:

```text
Task identity and entry command:
Accepted business completion:
Participants, topology, and channels:
Resolution and routing:
Uncertain effect boundary:
Receipt acknowledgment:
Completion acknowledgment:
Authoritative outstanding-work owner:
Durability and recovery:
Retry and timeout owner:
Duplicate and idempotency policy:
Cancellation semantics:
Terminal failure and stop:
Residual protocol gap:
Decision:
```

Use one decision: `coherent`, `incomplete`, `unsafe`, `needs-authoritative-owner`,
or `defer`. When used inside a larger task, return:

```text
Status: resolved | needs-evidence | not-applicable | blocked
Result: protocol decision and the completion or outstanding-work boundary behind it
Basis: task semantics, topology, signals, state ownership, traces, and failure cases
Open questions: concrete unanswered questions in the caller's language, or none
Artifacts: protocol card, message trace, outstanding-state transition, and failure case
```

Return only this skill's judgment for the question at hand.

## Completion

Finish when every accepted task is either outstanding or terminal under one
authoritative owner, receipt and completion cannot be confused, and one lost,
duplicate, delayed, or canceled message can test the protocol. Revisit when
business completion, topology, durability, or recovery behavior changes.

## Method

1. State task identity, the entry command, and accepted business completion.
2. Draw participants and channels. Distinguish fixed anonymous topology from
   dynamic topology that requires identity, resolution, discovery, or routing.
3. Mark the effect boundary after which the initiator cannot know the outcome by
   local return alone.
4. Classify every response as acceptance, transport receipt, intermediate
   progress, business completion, rejection, or terminal failure.
5. Identify the authoritative outstanding-work owner and the exact transitions
   that add, retain, complete, cancel, expire, or recover a task.
6. State timeout and retry ownership, duplicate detection, idempotency scope,
   ordering assumptions, and late-result policy.
7. State durability and restart behavior. An in-memory outstanding set is not a
   durable recovery protocol.
8. Test a lost response, duplicate command, delayed completion, cancellation race,
   and owner restart as far as the accepted claim requires. Preserve every
   unowned outcome as a protocol gap.

## Missing Evidence

Return `needs-evidence` when traces, message contracts, state storage, or recovery
behavior can settle the judgment. Return `blocked` when business completion or
accepted duplicate/cancellation behavior is human-owned. Return `not-applicable`
when work does not cross process boundaries or no concrete protocol exists.

## Boundary

Do not invent business completion, assume exactly-once delivery, infer durable
recovery from a queue, design an original system topology, or implement the
protocol. State any unanswered semantics, design, or evidence question in the
caller's language.
