---
name: work-slice
description: Select the next smallest authentic and inspectable slice of a broad, tangled, or fragmented task. Use when work is being organized by files, layers, or topics; when a local change may lose its connection to the user-visible outcome; or when one consequential focus and its reconnect edge must be chosen before design or execution. Not for trivial work or full implementation planning.
metadata:
  version: "0.1.0"
---

# Work Slice

Choose one bounded unit of work without severing the relation that makes it useful.

## Core Question

What single focus should be worked next, and how will its result reconnect to the authentic outcome?

## Inputs

- intended outcome or accepted task;
- relevant contract, actor, or initiating condition;
- known collaborators or causal path;
- important invariant, uncertainty, or failure;
- available local and end-to-end observers.

Return `needs-meaning` when product purpose or accepted outcome is missing. Return `not-applicable` for a trivial reversible task or an already bounded focus.

## Method

### 1. Bound the current whole

Choose the smallest authentic end-to-end context containing:

```text
initiating actor or condition
-> consequential relation or flow
-> observable success or failure
```

The whole is too broad when most of it cannot affect the current decision. It is too narrow when the focus can pass while the accepted outcome or governing invariant fails.

### 2. Name candidate pressures

Consider only concrete candidates such as:

- unresolved contract or product choice;
- earliest causal edge capable of the observed failure;
- invariant with unclear owner;
- security, data, or irreversible effect;
- uncertainty blocking reliable design or execution;
- boundary whose output can be checked independently.

A file, class, layer, or topic heading is not a focus unless it corresponds to one of these pressures.

### 3. Split or keep together

Split when candidate parts differ materially in purpose, assumptions, failure mode, owner, observer, or change pressure.

Keep them together when they jointly enforce one invariant, require the same unresolved assumption, can only be verified end to end, or would repeat most context after separation.

### 4. Choose one focus

Prefer the focus with the largest consequential uncertainty or the cheapest evidence capable of changing the plan. Do not pull a deferred product decision forward when the current slice can use representative inputs outside that ambiguity and still produce reusable evidence.

Use task-appropriate order:

```text
runtime failure       -> earliest plausible causal edge
short procedure       -> dependency or execution order
unfamiliar system     -> small representative end-to-end case
uncertain design      -> consequential choice with discriminating evidence
```

### 5. Preserve the reconnect edge

State exactly which actor, transition, contract, or causal edge in the current whole will consume the focus result.

## Output

```text
Status: resolved | needs-meaning | not-applicable
Current whole:
Next focus:
Why this focus now:
Input or precondition:
Invariant or decision criterion:
Local observer:
Reconnect edge:
Deferred work:
Stop check:
```

## Stop Check

Resolve only when:

- there is exactly one consequential focus;
- it has a local observer capable of failing it;
- its relevant invariant or criterion is preserved;
- its result has an explicit reconnect edge to the current whole;
- deferred work can remain deferred without invalidating the focus.

Do not design the implementation, execute commands, approve an abstraction, verify completion, or run the rest of the workflow.
