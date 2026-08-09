# Action Loop 전이 모델 v0.1

[English](../action-loop-transition-model-v0.1.md) | 한국어

## 질문

모든 모델 proposal과 canonical 상태에 대해 Developer는 proposal을 거부하거나, 모델 텍스트를 host 권한이나 외부 세계의 참값으로 취급하지 않으면서 구조적으로 유효한 다음 상태 하나를 구성하는가?

이 모델은 canonical 전이 안전성을 다룬다. 완료된 Work Case가 사용자의 현실 문제를 객관적으로 해결했다고 주장하지 않는다. 사용자는 그 외부 관계의 observer이자 최종 판단자로 남는다.

## Canonical Phase 상태

Canonical control ownership은 다음 discriminated union이다.

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

이전의 독립 축—open Judgment 수, pending Clearance 수, Effect 상태, Intervention disposition, Assurance 수—은 canonical control type에 존재하지 않는다. 따라서 1,890칸 Cartesian product는 더 이상 runtime 표현이 아니다.

각 phase는 허용된 다음 전이에 필요한 정확한 canonical object를 직접 가진다. 예를 들어 `ActionProposal`은 현재 `action-required` Intervention 하나를 가지며, `HostActionPending`은 정확한 Candidate와 Clearance를 가진다. Controller는 Work Case history를 scan하여 권한을 다시 추론하지 않는다.

`ActionLoopPhase`는 branded type이며 phase constructor와 transition function만 구성할 수 있다. Work Case collection은 durable ledger와 evidence history로 남지만 다음 route를 선택하지 않는다.

Broad aggregate-state 호환 adapter는 유지하지 않는다. Ledger collection만 있고 canonical phase ownership이 없는 state snapshot은 Action Loop state가 아니다. Semantic event replay는 동일한 전이를 적용하여 phase를 재구성하며, 호환되지 않는 history는 fail closed한다.

## Admission 경계

```text
raw model proposal
-> closed-shape parsing
-> exact inventory and identity binding
-> canonical admission or rejection
-> phase-specific transition
-> next ActionLoopPhase
```

안전성 주장은 다음과 같다.

```text
모든 canonical phase s와 raw proposal p에 대해:
  admit(s, p) = reject
  또는
  transition(s, admit(s, p))이 ActionLoopPhase 하나를 구성한다
```

자유로운 모델 작성 텍스트는 phase discriminant에 나타나지 않는다. `outcome-attained` 같은 의미 값은 admitted Judgment disposition이지, 관찰자와 무관한 진리 주장이 아니다.

## 전이표

| 현재 phase | admitted transition | 다음 phase |
| --- | --- | --- |
| `JudgmentOpening` | 정확한 필수 Judgment가 열림 | `JudgmentActive` |
| `JudgmentActive` | action-required Intervention 결론 | `ActionProposal` |
| `JudgmentActive` | blocked/waiting no-Action 결론 | `Continuity` |
| `JudgmentActive` | adverse Effect가 없는 attained no-Action | `JudgmentOpening(Claim Assurance)` |
| `JudgmentActive` | adverse Effect가 있는 attained no-Action | `EffectRemediationRequired` |
| `JudgmentActive` | Claim Assurance 결론 | `CompletionReady` |
| `ActionProposal` | 정확한 Candidate와 host Clearance admission | `HostActionPending` |
| `HostActionPending` | 정확한 host occurrence가 Effect accounting을 시작 | `EffectAssessment` |
| `EffectAssessment` | incomplete assessment admission | `EffectAssessment` |
| `EffectAssessment` | settled nonadverse Effect | `JudgmentOpening(Proportionate Intervention)` |
| `EffectAssessment` | settled adverse Effect | adverse settlement를 가진 `JudgmentOpening(Proportionate Intervention)` |
| `EffectAssessment` | 이전 adverse settlement에 대한 성공 repair | `EffectRemediation` |
| `EffectRemediation` | 정확한 remediation relation admission | `EffectRemediation` 또는 `JudgmentOpening(Proportionate Intervention)` |
| `CompletionReady` | complete current Closure Target 재검증 | terminal Completion |

Action 전이는 `ActionProposal`이 가진 Intervention만 소비할 수 있다. Ledger의 이전 Conclusion을 선택하여 post-Effect 재평가를 건너뛸 수 없다.

## 표현 불가능한 상태와 금지 History

Type은 다음 조합을 제거한다.

```text
CompletionReady와 blocked/waiting의 공존
CompletionReady와 incomplete 또는 remediation되지 않은 adverse Effect의 공존
정확한 action-required Intervention이 없는 ActionProposal
정확한 Candidate와 Clearance가 없는 HostActionPending
정확한 host occurrence가 없는 EffectAssessment
보증해야 할 attained Intervention이 없는 Claim Assurance opening
독립 count로 표현된 여러 current control owner
```

Transition은 잘못된 Work Case identity, 잘못된 phase 순서, 잘못된 Judgment purpose, stale Candidate 또는 Clearance identity, cross-Effect settlement, 무관한 remediation도 거부한다.

Stale, duplicate, malformed, unavailable proposal은 거부를 통해 stutter한다. Canonical phase는 바뀌지 않는다.

## Checkpoint와 Replay 경계

전이는 checkpoint를 host에 제공하기 전에 계산되고 검증된다. 현재 in-memory phase는 checkpoint가 성공한 뒤에만 바뀐다. Pi adapter는 append 전에 동일한 전이를 재현하고, semantic event를 append한 뒤 acknowledged projection을 교체한다.

Replay는 semantic event를 동일한 phase constructor와 transition function에 fold한다. 최종 ledger count에서 control ownership을 추론하지 않는다.

## Progress와 Fairness 경계

Safety는 canonical phase에 대해 무조건적이다. Progress에는 조건이 있다.

- 모델이나 사용자가 결국 admissible proposal을 제공한다.
- 필요한 host evidence 또는 permission이 결국 도착한다.
- bounded progression은 새로운 trusted boundary에서 재개된다.
- external waiting은 무기한 waiting으로 남을 수 있다.
- autonomous polling이나 wake-up을 가정하지 않는다.

그러므로 safety는 liveness를 함의하지 않으며, liveness는 외부 사용자 문제가 객관적으로 해결되었음을 함의하지 않는다.

## Completion Observer

`work-case-completed`의 의미는 다음과 같다.

> 현재 evidence와 전이 규칙 아래에서 canonical Work Case의 admitted obligation이 해소되었다.

다음을 의미하지 않는다.

> Developer가 사용자의 현실 문제 해결을 증명했다.

실행 가능한 fixture oracle은 구체적 case에 대한 bounded empirical evidence를 제공할 수 있다. 그 bounded observer 밖에서는 최종 사용자가 acceptance를 소유한다.

## Guarantee Owner와 Verification Target

| Guarantee | Owner | Verification |
| --- | --- | --- |
| closed proposal shape | SDK proposal tool | malformed-proposal tests |
| exact evidence authority | Judgment admission controller | unavailable-operation rejection tests |
| canonical control variant 아홉 개만 존재 | `ActionLoopPhase` | phase type과 constructor tests |
| 순서가 잘못된 전이 거부 | phase transition functions | wrong-phase tests |
| blocked/waiting Completion 금지 | phase transition functions와 closure target | continuity와 closure tests |
| incomplete/adverse Completion 금지 | phase transition functions와 closure target | Effect와 remediation tests |
| 현재 Intervention의 Action 소비 | phase transition functions와 progression controller | Action checkpoint integration test |
| dependent mutation 전 checkpoint | SDK controller와 Pi adapter | checkpoint-failure tests |
| 결정론적 durable replay | semantic event reducer | session replay tests |
| 현실 세계 acceptance | 최종 사용자 | canonical safety claim 밖 |
