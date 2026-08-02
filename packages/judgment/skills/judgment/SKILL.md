---
name: judgment
description: Make one bounded, provenance-preserving dynamic judgment from exact prepared or observed context. Use when selection, sealing, contribution assurance, replay, or explicit closure matters; a co-located judgment.json policy is optional and never grants authority.
---

# Judgment

Make one task-specific judgment while preserving exact material identity,
semantic contribution, assurance, conflict, limitation, and closure.

## Runtime contract

```text
optional JudgmentAuthoringPolicy
→ CompiledJudgmentPolicy
→ DynamicJudgmentQuestion
→ ContextInventory + ObservedContext
→ ContextSelection + SealedContext
→ ContextContribution + ContextCoverage
→ ContextualJudgment | NeedsEvidence | EmergentQuestion
```

Availability is not applicability. Applicability is not selection. Selection is
not contribution. Contribution is not authority. Landing is not completion.

Pi owns discovery and physical acquisition. You own semantic nomination and
agent-level interpretation. Typed adapters own domain assurance. Explicit user
events own user acceptance. Judgment owns exact parsing, identity, selection,
sealing, assurance verification, replay, and optional closure.

## Workflow

### 1. Select one capability and dynamic question

Call `judgment_open_context` with the exact Pi skill name, current question,
and known basis material IDs when available. It loads and reveals the selected
skill's optional policy before applicability is judged.

A co-located `judgment.json` has three outcomes:

```text
absent  → normal complete Pi skill
valid   → compiled applicability and prepared-reference policy
invalid → fail closed
```

After seeing that exact policy, call `judgment_assess_applicability`. Root
`unless` exclusions win over root `when`. Ambiguous applicability becomes a
`needs-context` terminal result; do not turn it into an invented exclusion. A
not-applicable result also terminates without selection ceremony.

### 2. Acquire context naturally

Use ordinary Pi skills and tools. Prepared references are independently
conditional candidates. Project constraints, current repository observations,
explicit user events, visible peer-capability results, and typed evaluator
observations remain open-world context.

Do not ask Judgment to rank skills, crawl resources, activate hidden tools, infer
policy from prose, or choose the domain method.

### 3. Select and seal atomically

Call `judgment_select_context` with the generated judgment ID, a concise basis,
and only material that can change the question:

- `inventory-source`: one exact prepared reference, Pi skill, or ambient context
  descriptor;
- `tool-result`: one exact current-branch tool call/result;
- `user-decision`: one exact current-branch user event.

A failed acquisition records neither selection nor seal. Selected descriptor,
policy, question, branch, or content drift fails. Unrelated inventory growth does
not stale selected work.

Error or truncated tool output cannot be selected as positive material.

### 4. Relate every selected material

Call `judgment_assess_coverage`. Every usable selected material needs at least
one concrete contribution to the current dynamic question:

```text
materialId
+ useAs: constraint | evidence | decision | method | guidance
+ contribution
+ assurance
```

Use `agent-asserted` for semantic interpretation you own. Use
`domain-verified` only with matching selected typed evaluator evidence. Use
`user-accepted` only with the matching selected user event.

Record contradictions as conflicts and unavailable distinctions as limitations.
Use `sufficient` only when no conflict remains. Use `needs-evidence` only with an
explicit conflict or limitation.

### 5. Conclude once

Call `judgment_conclude` with exact selection, sealed-context, and coverage
identities.

- `contextual-judgment`: sufficient coverage, exact contribution citations,
  rationale, artifact, and stop evidence;
- `needs-evidence`: exact unresolved conflict/limitation IDs, evidence needed,
  and resolution owner;
- `emergent-question`: one genuinely distinct question, reason, artifact, and
  stop evidence.

Do not cite catalog membership. Cite the contribution that changed the artifact.
Do not continue a terminal judgment.

## Assurance and provenance

- Generic prose cannot create domain or user assurance.
- A user decision cannot rewrite an observed fact.
- Prepared guidance cannot override an ambient constraint.
- Same-title skills remain distinct by source identity and provenance.
- Tool arguments and ordered mixed text/image content enter evidence identity.
- Another branch's result is not current-branch evidence.
- Project skill policy cannot authorize Developer mutation.

## Stop

Stop when one is observable:

1. positive evidence establishes non-applicability;
2. applicability or evidence remains unresolved with an owner;
3. one sealed, covered outcome is recorded;
4. one distinct emergent question is recorded.

Structural closure proves runtime-contract conformance, not domain truth. Keep
assumptions, limitations, conflicts, evaluator provenance, and user ownership
visible.
