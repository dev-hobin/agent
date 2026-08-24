---
name: delegation-gate
description: Decide whether one concrete proposed agent action should proceed, pause for a user-owned choice, be narrowed, or be declined. Use before destructive, hard-to-reverse, externally visible, security/privacy/credential, durable-data, public-contract, costly, or presently unevaluable actions. Do not use for routine reversible work or to orchestrate an entire task.
metadata:
  version: "0.1.0"
---

# Delegation Gate

Place one truthful control boundary before one concrete action.

## Core Question

May the agent perform this action within accepted authority and available evaluability, or must control return to the user?

## Inputs

```text
Proposed action:
Intended purpose:
Effects and affected participants:
Reversibility and latest safe point:
User-owned meaning or value choice:
Security, privacy, credential, data, and public-contract impact:
Available observer or review capability:
Default if no choice is supplied:
```

Return `not-applicable` when no concrete action is proposed or the action is routine, reversible, and already inside accepted scope.

## Decision

Choose exactly one:

### `proceed`

Use when purpose and constraints are accepted, effects are bounded or reversible, user-owned values are settled, and the result has a fitting observer.

### `pause`

Use when the action commits unresolved product meaning, value, public compatibility, destructive or irreversible effects, security/privacy/credential policy, or durable data semantics.

### `narrow`

Use when part of the action is safe but the requested scope exceeds authority or evaluability. State the largest safe subset.

### `decline`

Use when the action is unauthorized, unsafe, prohibited, or cannot be made acceptably bounded with available evidence.

Low familiarity alone does not require a pause if a small model and independent observer make the result evaluable. Fluent agent confidence alone never supplies evaluability.

## Gate Construction

For `pause`, expose a real choice:

```text
User-owned choice:
Recommendation and criterion:
Viable alternatives:
Consequence of each:
Latest safe intervention point:
Default without approval:
```

“Shall I continue?” is not a gate when no consequential choice exists.

For `narrow`, state:

```text
Accepted safe subset:
Excluded effect or uncertainty:
Evidence needed to widen later:
```

## Output

```text
Status: resolved | needs-facts | not-applicable
Decision: proceed | pause | narrow | decline
Action boundary:
User-owned choice, if any:
Reason:
Latest safe intervention point:
Required evidence:
Default:
```

## Stop Check

Resolve only when:

- the proposed action is concrete;
- every consequential effect has an owner;
- the decision identifies the latest safe intervention point;
- a pause exposes a genuine user-owned choice;
- proceed does not rely solely on agent confidence;
- narrow names an executable safe subset;
- decline states the blocking condition.

Do not execute the action, design its implementation, or ask permission for unrelated routine steps.
