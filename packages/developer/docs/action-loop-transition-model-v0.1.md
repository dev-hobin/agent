# Action Loop Transition Model v0.1

English | [한국어](./ko/action-loop-transition-model-v0.1.md)

## Question

For every model proposal and every canonical state, does Developer either reject
the proposal or select one structurally valid next route without treating model
text as host authority or external truth?

This model covers canonical transition safety. It does **not** claim that a
completed Work Case objectively solved the user's real-world problem. The user
remains the observer and final judge of that external relation.

## Admission Boundary

```text
raw model proposal
-> closed-shape parsing
-> exact inventory and identity binding
-> canonical admission or rejection
-> finite control facts
-> one transition decision
```

The safety claim is:

```text
for every canonical state s and raw proposal p:
  admit(s, p) = reject
  or
  decide(facts(admit(s, p))) satisfies every canonical invariant
```

Free model-authored text does not occur in the finite control facts. Semantic
values such as `outcome-attained` are admitted Judgment dispositions, not claims
of mind-independent truth.

## Finite Control Domain

```text
hasConclusions          = false | true
openJudgments           = 0 | 1 | many
pendingActionClearances = 0 | 1 | many
effectPhase             = none
                        | incomplete
                        | settled-nonadverse
                        | settled-adverse
                        | settled-mixed
intervention            = absent
                        | action-required
                        | outcome-attained
                        | blocked
                        | waiting
                        | invalid
                        | multiple
claimAssurances         = 0 | 1 | many
```

The Cartesian control domain contains `2 × 3 × 3 × 5 × 7 × 3 = 1,890`
combinations. Invalid combinations are part of the domain and must route to an
explicit invariant failure. The current policy admits only 37 non-invariant
combinations; 1,853 combinations (98.04%) fail closed. This is useful exhaustive
pressure and also a representation residual: a later discriminated phase model
should make most of those invalid combinations unrepresentable rather than
merely rejected. That representation change is intentionally deferred from this
safety correction.

`intervention` is the Proportionate Intervention Conclusion not yet consumed by
an Action Candidate. Earlier consumed Interventions are history, not current
Action authority.

## Transition Table

Higher rows have priority.

| Guard | Required route |
| --- | --- |
| multiple or invalid control owner | `invariant-failure` |
| one coherent open Judgment | `progress-open-judgment` |
| one coherent pending Clearance | `ready-for-host-action` |
| no Conclusions and otherwise empty state | open initial Judgment |
| incomplete Effect | `progress-effect` |
| settled adverse plus successful repair evidence | `progress-remediation` |
| settled adverse, no current Intervention | open Proportionate Intervention |
| settled adverse, action-required | propose repair Action |
| settled adverse, blocked/waiting | nonterminal continuity |
| settled adverse, outcome-attained | `remediation-required` |
| settled nonadverse, no current Intervention | open Proportionate Intervention |
| settled nonadverse, action-required | propose next Action |
| settled nonadverse, blocked/waiting | nonterminal continuity |
| settled nonadverse, outcome-attained, no Assurance | open Claim Assurance |
| settled nonadverse, outcome-attained, one Assurance | completion-ready |
| no Effect, no current Intervention | open Proportionate Intervention |
| no Effect, action-required | propose Action |
| no Effect, blocked/waiting | nonterminal continuity |
| no Effect, outcome-attained, no Assurance | open Claim Assurance |
| no Effect, outcome-attained, one Assurance | completion-ready |

An Action route exposes exactly the current `action-required` Intervention to the
Action proposal. The model cannot consume another Conclusion instead and thereby
skip the required post-Effect reassessment.

## Forbidden States and Histories

```text
blocked or waiting -> Action, Claim Assurance, or Completion
incomplete Effect -> Claim Assurance or Completion
unremediated adverse Effect -> Claim Assurance or Completion
settled Effect without fresh Intervention -> Completion
Claim Assurance without current outcome-attained Intervention
multiple open Judgments, pending Clearances, current Interventions, or Assurances
Action Candidate that does not consume the current action-required Intervention
model text or unavailable capability becoming control authority
```

Stale, duplicate, malformed, and unavailable proposals stutter by rejection: the
canonical state remains unchanged. A checkpoint failure also leaves the
acknowledged projection unchanged.

## Progress and Fairness Boundary

Safety is unconditional over admitted control facts. Progress is conditional:

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
| one finite next route | transition policy | exhaustive 1,890-state test |
| no blocked/waiting Completion | transition policy and closure target | exhaustive property and closure tests |
| no incomplete/adverse Completion | transition policy and closure target | exhaustive property and Effect tests |
| current Intervention consumed by Action | progression controller | Action checkpoint integration test |
| checkpoint before dependent mutation | Pi adapter | checkpoint-failure tests |
| deterministic durable replay | session event replay | saved-session replay tests |
| real-world acceptance | final user | outside canonical safety claim |
