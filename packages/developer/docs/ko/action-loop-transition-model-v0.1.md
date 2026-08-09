# Action Loop 전이 모델 v0.1

[English](../action-loop-transition-model-v0.1.md) | 한국어

## 질문

모든 모델 proposal과 canonical 상태에 대해 Developer는 proposal을 거부하거나, 모델 텍스트를 host 권한이나 외부 세계의 참값으로 취급하지 않으면서 구조적으로 유효한 다음 route 하나를 선택하는가?

이 모델은 canonical 전이 안전성을 다룬다. 완료된 Work Case가 사용자의 현실 문제를 객관적으로 해결했다고 주장하지 않는다. 사용자는 그 외부 관계의 observer이자 최종 판단자로 남는다.

## Admission 경계

```text
raw model proposal
-> closed-shape parsing
-> exact inventory and identity binding
-> canonical admission or rejection
-> finite control facts
-> one transition decision
```

안전성 주장은 다음과 같다.

```text
모든 canonical state s와 raw proposal p에 대해:
  admit(s, p) = reject
  또는
  decide(facts(admit(s, p)))가 모든 canonical invariant를 만족한다
```

자유로운 모델 작성 텍스트는 유한 control facts에 나타나지 않는다. `outcome-attained` 같은 의미 값은 admitted Judgment disposition이지, 관찰자와 무관한 진리 주장이 아니다.

## 유한 Control Domain

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

Cartesian control domain에는 `2 × 3 × 3 × 5 × 7 × 3 = 1,890`개 조합이 있다. 유효하지 않은 조합도 domain에 포함되며 명시적 invariant failure로 route되어야 한다. 현재 정책에서 non-invariant 조합은 37개뿐이고, 1,853개 조합(98.04%)은 fail closed한다. 이는 유용한 exhaustive pressure인 동시에 representation residual이다. 후속 discriminated phase 모델은 이 invalid 조합 대부분을 거부하는 대신 표현 불가능하게 만들어야 한다. 그 representation 변경은 현재 safety correction과 의도적으로 분리한다.

`intervention`은 아직 Action Candidate가 소비하지 않은 Proportionate Intervention Conclusion이다. 이전에 소비된 Intervention은 history이지 현재 Action 권한이 아니다.

## 전이표

위쪽 행이 우선한다.

| Guard | 필수 route |
| --- | --- |
| control owner가 multiple 또는 invalid | `invariant-failure` |
| 일관된 open Judgment 하나 | `progress-open-judgment` |
| 일관된 pending Clearance 하나 | `ready-for-host-action` |
| Conclusion이 없고 나머지 상태가 비어 있음 | initial Proportionate Intervention 열기 |
| incomplete Effect | `progress-effect` |
| settled adverse와 성공한 repair evidence가 함께 있음 | `progress-remediation` |
| settled adverse, 현재 Intervention 없음 | Proportionate Intervention 열기 |
| settled adverse, action-required | repair Action 제안 |
| settled adverse, blocked/waiting | nonterminal continuity |
| settled adverse, outcome-attained | `remediation-required` |
| settled nonadverse, 현재 Intervention 없음 | Proportionate Intervention 열기 |
| settled nonadverse, action-required | 다음 Action 제안 |
| settled nonadverse, blocked/waiting | nonterminal continuity |
| settled nonadverse, outcome-attained, Assurance 없음 | Claim Assurance 열기 |
| settled nonadverse, outcome-attained, Assurance 하나 | completion-ready |
| Effect 없음, 현재 Intervention 없음 | Proportionate Intervention 열기 |
| Effect 없음, action-required | Action 제안 |
| Effect 없음, blocked/waiting | nonterminal continuity |
| Effect 없음, outcome-attained, Assurance 없음 | Claim Assurance 열기 |
| Effect 없음, outcome-attained, Assurance 하나 | completion-ready |

Action route는 현재 `action-required` Intervention만 Action proposal에 노출한다. 모델은 다른 Conclusion을 대신 소비하여 필수 post-Effect 재평가를 건너뛸 수 없다.

## 금지 상태와 History

```text
blocked 또는 waiting -> Action, Claim Assurance, 또는 Completion
incomplete Effect -> Claim Assurance 또는 Completion
remediation되지 않은 adverse Effect -> Claim Assurance 또는 Completion
fresh Intervention 없는 settled Effect -> Completion
현재 outcome-attained Intervention 없는 Claim Assurance
여러 open Judgment, pending Clearance, current Intervention, 또는 Assurance
현재 action-required Intervention을 소비하지 않는 Action Candidate
model text 또는 unavailable capability가 control authority가 되는 경우
```

stale, duplicate, malformed, unavailable proposal은 거부를 통해 stutter한다. canonical 상태는 바뀌지 않는다. Checkpoint failure도 acknowledged projection을 바꾸지 않는다.

## Progress와 Fairness 경계

Safety는 admitted control facts에 대해 무조건적이다. Progress에는 조건이 있다.

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
| 유한한 다음 route 하나 | transition policy | exhaustive 1,890-state test |
| blocked/waiting Completion 금지 | transition policy와 closure target | exhaustive property와 closure tests |
| incomplete/adverse Completion 금지 | transition policy와 closure target | exhaustive property와 Effect tests |
| 현재 Intervention의 Action 소비 | progression controller | Action checkpoint integration test |
| dependent mutation 전 checkpoint | Pi adapter | checkpoint-failure tests |
| 결정론적 durable replay | session event replay | saved-session replay tests |
| 현실 세계 acceptance | 최종 사용자 | canonical safety claim 밖 |
