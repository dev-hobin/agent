# Action Loop Transition Model v0.1

English | [한국어](./ko/action-loop-transition-model-v0.1.md)

## Question

For every model proposal and canonical state, does Developer either reject the
proposal or construct one structurally valid next state without treating model
text as host authority or external truth?

This model covers canonical transition safety. It does **not** claim that a
completed Work Case objectively solved the user's real-world problem. The user
remains the observer and final judge of that external relation.

## Canonical Phase State

Canonical control ownership is a discriminated union:

```text
ActionLoopPhase =
  JudgmentOpening(purpose)
  | JudgmentActive(purpose, judgment)
  | ActionProposal(intervention, adverseSettlements)
  | HostActionPending(intervention, candidate, clearance, adverseSettlements)
  | EffectAssessment(effect, adverseSettlements)
  | EffectRemediation(adverseSettlements, successfulSettlements)
  | EffectRemediationRequired(intervention, adverseSettlements)
  | Continuity(blocked | waiting, intervention, adverseSettlements)
  | CompletionReady(intervention, claimAssurance)
```

The former independent axes—open-Judgment counts, pending-Clearance counts,
Effect status, Intervention disposition, and Assurance counts—do not exist in
the canonical control type. Their 1,890-cell Cartesian product is no longer a
runtime representation.

Each phase carries the exact canonical objects needed by its permitted next
transition. For example, `ActionProposal` carries one current
`action-required` Intervention, and `HostActionPending` carries the exact
Candidate and Clearance. A controller does not rediscover authority by scanning
Work Case history.

`ActionLoopPhase` is branded and can be constructed only by phase constructors
and transition functions. The Work Case collections remain the durable ledger
and evidence history, but they do not select the next route.

No broad aggregate-state compatibility adapter is retained. A state snapshot
that contains only ledger collections and omits canonical phase ownership is not
an Action Loop state. Semantic event replay reconstructs phases by applying the
same transitions; an incompatible history fails closed.

## Admission Boundary

```text
raw model proposal
-> closed-shape parsing
-> exact inventory and identity binding
-> canonical admission or rejection
-> phase-specific transition
-> next ActionLoopPhase
```

The safety claim is:

```text
for every canonical phase s and raw proposal p:
  admit(s, p) = reject
  or
  transition(s, admit(s, p)) constructs one ActionLoopPhase
```

Free model-authored text does not occur in the phase discriminant. Semantic
values such as `outcome-attained` are admitted Judgment dispositions, not claims
of mind-independent truth.

## Transition Table

| Current phase | Admitted transition | Next phase |
| --- | --- | --- |
| `JudgmentOpening` | exact required Judgment opened | `JudgmentActive` |
| `JudgmentActive` | action-required Intervention concluded | `ActionProposal` |
| `JudgmentActive` | blocked/waiting no-Action concluded | `Continuity` |
| `JudgmentActive` | attained no-Action with no adverse Effect | `JudgmentOpening(Claim Assurance)` |
| `JudgmentActive` | attained no-Action with adverse Effect | `EffectRemediationRequired` |
| `JudgmentActive` | Claim Assurance concluded | `CompletionReady` |
| `ActionProposal` | exact Candidate and host Clearance admitted | `HostActionPending` |
| `HostActionPending` | exact host occurrence begins Effect accounting | `EffectAssessment` |
| `EffectAssessment` | incomplete assessment admitted | `EffectAssessment` |
| `EffectAssessment` | settled nonadverse Effect | `JudgmentOpening(Proportionate Intervention)` |
| `EffectAssessment` | settled adverse Effect | `JudgmentOpening(Proportionate Intervention)` carrying the adverse settlement |
| `EffectAssessment` | successful repair with prior adverse settlement | `EffectRemediation` |
| `EffectRemediation` | exact remediation relation admitted | `EffectRemediation` or `JudgmentOpening(Proportionate Intervention)` |
| `CompletionReady` | complete current Closure Target revalidated | terminal Completion |

An Action transition can consume only the Intervention carried by
`ActionProposal`. A post-Effect reassessment cannot be skipped by selecting an
earlier Conclusion from the ledger.

## Impossible States and Forbidden Histories

The type removes combinations such as:

```text
CompletionReady plus blocked/waiting
CompletionReady plus an incomplete or unremediated adverse Effect
ActionProposal without one exact action-required Intervention
HostActionPending without one exact Candidate and Clearance
EffectAssessment without one exact host occurrence
Claim Assurance opening without the attained Intervention it must assure
multiple current control owners represented as independent counts
```

Transitions additionally reject wrong Work Case identities, wrong phase order,
wrong Judgment purpose, stale Candidate or Clearance identity, cross-Effect
settlement, and unrelated remediation.

Stale, duplicate, malformed, and unavailable proposals stutter by rejection: the
canonical phase remains unchanged.

## Checkpoint and Replay Boundary

A transition is computed and validated before its checkpoint is offered to the
host. The current in-memory phase changes only after the checkpoint succeeds.
The Pi adapter reproduces the same transition before append, appends the semantic
event, and only then replaces its acknowledged projection.

Replay folds semantic events through the same phase constructors and transition
functions. It does not infer control ownership from final ledger counts.

## Progress and Fairness Boundary

Safety is unconditional over canonical phases. Progress is conditional:

- the model or user eventually supplies an admissible proposal;
- required host evidence or permission eventually arrives;
- bounded progression is resumed by a new trusted boundary;
- external waiting may remain waiting indefinitely;
- no autonomous polling or wake-up is assumed.

Therefore safety does not imply liveness, and liveness does not imply that the
external user problem is objectively solved.

## Completion Observer

`work-case-completed` means:

> The canonical Work Case's admitted obligations were discharged under the
> current evidence and transition rules.

It does not mean:

> Developer proved that the user's real-world problem was solved.

Executable fixture oracles can provide bounded empirical evidence for a concrete
case. The final user remains the owner of acceptance outside those bounded
observers.

## Guarantee Owners and Verification Targets

| Guarantee | Owner | Verification |
| --- | --- | --- |
| closed proposal shape | SDK proposal tool | malformed-proposal tests |
| exact evidence authority | Judgment admission controller | unavailable-operation rejection tests |
| only nine canonical control variants | `ActionLoopPhase` | phase type and constructor tests |
| out-of-order transition rejection | phase transition functions | wrong-phase tests |
| no blocked/waiting Completion | phase transition functions and closure target | continuity and closure tests |
| no incomplete/adverse Completion | phase transition functions and closure target | Effect and remediation tests |
| current Intervention consumed by Action | phase transition functions and progression controller | Action checkpoint integration test |
| checkpoint before dependent mutation | SDK controller and Pi adapter | checkpoint-failure tests |
| deterministic durable replay | semantic event reducer | session replay tests |
| real-world acceptance | final user | outside canonical safety claim |
