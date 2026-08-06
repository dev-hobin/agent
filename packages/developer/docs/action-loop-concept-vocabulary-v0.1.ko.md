# Developer Action Loop Concept Vocabulary v0.1

> 상태: reconstruction concept contract
>
> 관련 문서: [Developer Action Loop Architecture v0.1](./action-loop-architecture-v0.1.ko.md)
>
> 기준선: `@hobin/developer@0.1.19`
>
> Runtime note: 이 vocabulary는 transition trace를 서술하기 위한 domain language다. 현재 0.1.19 runtime의 type, tool, event 이름을 설명하지 않으며, concept마다 class나 JSON field를 만들 것을 요구하지 않는다.
>
> 작성 시점: 2026-08-06

## 1. 목적

Action Loop architecture에는 domain concept, connector relation, operational pattern, runtime component가 섞여 있다. 이들을 구분하지 않으면 다음 문제가 생긴다.

- 설명용 임시어가 public API처럼 굳는다.
- `Judgment`, `Conclusion`, `Authorization`처럼 다른 의미가 한 이름에 합쳐진다.
- relation마다 객체를 만들면서 state와 protocol이 불필요하게 커진다.
- 현재 extension 구현의 이름이 product ontology를 결정한다.
- professional role과 contribution function이 다시 혼동된다.

이 문서는 architecture가 실제로 구별해야 하는 stable sense를 정하고, 구현 detail과 connector relation을 분리한다.

## 2. Architecture의 네 runtime obligation

Action Loop를 지탱하는 것은 네 개의 상위 judgment category가 아니라 다음 runtime obligation이다.

### Outcome Continuity

하나의 outcome이 달성되거나 명시적으로 중단될 때까지 canonical work를 보존한다.

### Warranted Transition

Consequential action이나 work-status transition은 현재 evidence와 필요한 decision에 의해 정당화되어야 한다.

### Effect Accountability

Action을 실행한 것과 실제 effect가 발생한 것을 구분하고, 다음 transition 전에 effect를 충분히 정산한다.

### Evidence-bounded Closure

Complete, blocked, no-change 같은 closure claim은 supporting evidence보다 넓을 수 없다.

이 obligation은 runtime invariant다. `Context Fit`, `Intervention Proportionality`, `Consequence Integrity`, `Claim Assurance`와 같은 judgment category와 동일하지 않다.

## 3. Vocabulary의 네 층

### Domain concept

작업이 진행되는 동안 독립된 의미와 failure boundary를 유지해야 하는 것.

```text
Work Case
Warrant Gap
Judgment
Contribution
Action
Effect
Claim
```

### Connector relation

Concept 사이에서 일어나는 관계. 별도 state object가 아닐 수 있다.

```text
reveals
opens
requires
addresses
synthesizes
warrants
permits
clears
produces
settles
assures
transitions
```

### Operational pattern

여러 concept와 relation을 반복적으로 조정하는 흐름.

```text
Adaptive Action Loop
```

### Runtime component

Domain concepts를 Pi extension 안에서 실행하고 보존하는 구조.

```text
Work Core
Contribution Router
Model Protocol
Pi Adapter
Work Record
Work View
```

## 4. Concept relation map

```text
                         ┌───────────────┐
                         │    Outcome    │
                         └───────┬───────┘
                                 │ defines
                                 ▼
                         ┌───────────────┐
                         │   Work Case   │
                         └───────┬───────┘
                                 │ receives
                                 ▼
                         ┌───────────────┐
                         │  Observation  │
                         └───────┬───────┘
                                 │ may reveal
                                 ▼
                         ┌───────────────┐
                         │  Warrant Gap  │
                         └───────┬───────┘
                                 │ opens
                                 ▼
                         ┌───────────────┐
                         │   Judgment    │
                         └───────┬───────┘
                                 │ requires
                                 ▼
                      ┌──────────────────────┐
                      │  Contribution Need   │
                      └──────────┬───────────┘
                                 │ addressed by
                                 ▼
                         ┌───────────────┐
                         │ Contribution  │
                         └───────┬───────┘
                                 │ synthesized into
                                 ▼
                         ┌───────────────┐
                         │  Conclusion   │
                         └───────┬───────┘
                                 │ warrants
                 ┌───────────────┴────────────────┐
                 ▼                                ▼
        ┌────────────────┐               ┌────────────────┐
        │ Action Candidate│               │     Claim      │
        └───────┬────────┘               └───────┬────────┘
                │ warrant + permission           │ assurance
                ▼                                ▼
        ┌────────────────┐               ┌────────────────┐
        │ Action Clearance│               │ Closure Claim  │
        └───────┬────────┘               └───────┬────────┘
                │ execute                        │ supports
                ▼                                ▼
        ┌────────────────┐               ┌────────────────┐
        │     Effect     │               │  Work Status   │
        └───────┬────────┘               └────────────────┘
                │ observed and settled
                └──────────────────────────────→ Work Case
```

## 5. Core domain concepts

### 5.1 Work Case

> 하나의 Outcome을 중심으로 Judgment, Action, Effect, Claim을 끝까지 연결하는 canonical work unit.

Work Case는 chat session, assistant response, git branch, task list와 동일하지 않다.

- 여러 agent turn을 통과할 수 있다.
- external wait 동안에도 유지된다.
- 여러 Judgment와 Action을 포함할 수 있다.
- explicit supported transition 전에는 사라지지 않는다.

#### 이름 선택

| Candidate | 드러내는 것 | 문제 |
| --- | --- | --- |
| `Work Thread` | continuity | execution thread, chat thread와 혼동 |
| `Work Scope` | 범위 | lifecycle과 closure가 약함 |
| `Work Case` | bounded matter와 지속되는 기록 | 일반적인 `case` 학습 비용 |

v0에서는 `Work Case`를 사용한다. `WorkState`는 가능한 구현 representation이지 domain concept 이름이 아니다.

### 5.2 Outcome

> Work Case가 존재하는 이유가 되는 desired condition.

Outcome은 plan이나 action list가 아니다.

```text
Outcome:
  무엇이 참이 되어야 하는가?

Action:
  그것을 위해 지금 무엇을 할 것인가?
```

문서에서는 provenance를 드러내기 위해 `delegated outcome`이라고 표현할 수 있지만 core concept는 `Outcome`이다.

### 5.3 Constraint

> Outcome을 달성하는 동안 유지해야 하는 accepted boundary.

Observation과 Constraint를 구분한다.

```text
Observation:
  repository가 현재 Node 22를 사용한다.

Constraint:
  Node 22 compatibility를 유지해야 한다.
```

Observation이 accepted requirement와 결합될 때 Constraint가 될 수 있다.

### 5.4 Observation

> 현재 reality에 관해 provenance와 함께 기록된 사실 또는 관측 결과.

Observation은 자동으로 Evidence가 아니다.

```text
test passed
  → Observation

이 test가 compatibility Claim을 지지한다
  → Evidence relation
```

같은 Observation도 한 Claim에는 Evidence이고 다른 Claim에는 무관할 수 있다.

### 5.5 Warrant Gap

> Consequential Action이나 Claim을 정당화하기 위해 아직 부족한 근거.

모든 unknown이나 open question이 Warrant Gap은 아니다.

```text
unknown
+ relevant to Outcome
+ consequential
+ unresolved
+ independent stop
= Warrant Gap
```

한국어 설명에서는 `정당화 공백`을 사용할 수 있다. 코드와 architecture vocabulary에서는 `Warrant Gap`을 유지한다.

### 5.6 Judgment

> 하나의 Warrant Gap을 특정 Judgment Subject에 대해 닫기 위한 bounded inquiry.

Judgment와 Conclusion을 구분한다.

```text
Judgment:
  question, subject, category, contribution needs, current status

Conclusion:
  그 Judgment가 종합한 category-scoped answer
```

### 5.7 Judgment Subject

> 현재 Judgment가 다루는 Action, model, Claim, boundary 또는 situation.

Semiotic analysis에서는 `referent`가 정확하지만 product와 implementation vocabulary에서는 `Judgment Subject`가 더 직접적이다.

### 5.8 Judgment Category

> 반복되는 Warrant Gap을 판정하기 위한 stable question, trigger, closure, reopen contract.

Category는 phase, Skill group, profession, source chapter가 아니다. 하나의 Work Case가 zero, one, several category instance를 열 수 있다.

현재 category sign과 stable sense는 다음과 같다.

| Current sign | Stable sense | Parallel sign candidate |
| --- | --- | --- |
| Contextual Adequacy | Fit | `Context Fit` |
| Proportionate Intervention | Proportion | `Intervention Proportionality` |
| Consequence Integrity | Integrity | `Consequence Integrity` |
| Claim Assurance | Assurance | `Claim Assurance` |

네 judgment criterion은 다음처럼 압축할 수 있다.

```text
Fit
Proportion
Integrity
Assurance
```

`Context Fit`과 `Intervention Proportionality`는 더 평행적인 sign 후보지만 transition trace 전에는 rename을 확정하지 않는다.

### 5.9 Contribution Need

> Judgment를 닫기 위해 필요한 input의 기능적 역할.

`Contribution Role` 대신 `Contribution Need`를 사용한다. `role`이 professional role로 오해될 수 있기 때문이다.

예:

```text
accepted behavior 확인
counterexample 탐색
possible execution 비교
external product decision
claim-relevant verifier
```

Contribution Need에는 Skill 이름이 들어가지 않는다.

### 5.10 Contribution

> 하나의 Contribution Need를 실제로 다루는 source-bounded input.

Contribution은 Observation, analysis, model, comparison, candidate, verifier result, external decision일 수 있다. Contribution은 스스로 Conclusion이 되거나 permission을 생성하지 않는다.

```text
Skill output
  → Contribution

Contributions를 category contract로 종합
  → Conclusion
```

### 5.11 Capability

> 특정 종류의 Contribution을 반복적으로 만들어낼 수 있는 수단.

Capability inventory는 open-world다.

```text
package Skill
external or project-local Skill
tool
specialist capability
```

`AGENTS.md`와 repository instruction은 보통 Context source다. 자동으로 Capability가 되지 않는다.

### 5.12 Conclusion

> 하나의 Judgment를 닫는 category-scoped answer.

다음은 서로 다르다.

```text
Conclusion ≠ external permission
Conclusion ≠ executed Action
Conclusion ≠ Work Case completion
```

예를 들어 `publish가 적절하다`는 Conclusion이 있어도 publish permission이 없으면 실행할 수 없다.

### 5.13 Action Candidate

> 현재 Work Case를 진행시키기 위해 고려 중인 하나의 concrete controlled Action.

Action Candidate는 아직 실행 가능한 상태가 아니다.

```text
Action Candidate
+ sufficient warrant
+ current permission
= cleared Action
```

### 5.14 Action Clearance

> 특정 Action Candidate가 현재 실행되어도 된다는 bounded gate result.

```text
warranted(action):
  현재 Judgment가 Action을 지지하는가?

permitted(action):
  현재 delegation과 host Constraint가 Action을 허용하는가?

cleared(action):
  warranted(action) && permitted(action)
```

`Action Clearance`는 Conclusion과 permission을 구별하면서도 아직 독립 authority subsystem을 요구하지 않는다. Permission variation이 finite trace에서 복잡해질 때만 내부 representation을 확장한다.

### 5.15 Effect

> Action 이후 reality에서 실제로 발생한 결과.

Effect와 tool result를 구분한다.

```text
tool result:
  command가 exit 0을 반환했다.

Effect:
  의도한 파일이 실제로 변경됐고 다른 mutation은 없었다.
```

실제 Effect는 처음에는 unknown일 수 있다.

### 5.16 Effect Observation

> 실제 Effect를 evidence-bounded하게 판단할 수 있게 해주는 Observation.

Filesystem diff, registry 조회, process state, test result가 Effect Observation이 될 수 있다. 어느 것도 모든 Effect를 자동으로 증명하지 않는다.

### 5.17 Effect Settlement

> Action과 Effect Observation을 연결해 다음 transition에 충분할 정도로 실제 결과를 결론 내리는 accounting operation.

다음은 settled conclusion이 될 수 있다.

```text
observed-success
observed-no-effect
failed
partially-applied
```

Known partial effect는 partial로 settle될 수 있지만 completion을 막거나 Judgment를 다시 열 수 있다.

다음은 아직 unsettled state다.

```text
pending
unknown
```

### 5.18 Claim

> Evidence가 support하거나 challenge할 수 있는 명시적 proposition.

Evidence는 독립 물체라기보다 Observation 또는 Contribution과 특정 Claim 사이의 support relation이다.

### 5.19 Closure Claim

> Work Case를 complete, blocked 또는 다른 explicit status로 전환하기 위해 제안된 Claim.

`Completion Candidate`보다 `Closure Claim`이 넓다.

```text
complete:
  요청된 behavior가 verifier 범위 안에서 충족됐다.

blocked:
  필요한 external decision 없이는 acceptance condition을 닫을 수 없다.

no-change:
  현재 implementation이 accepted contract를 이미 만족한다.
```

Claim Assurance Judgment가 Closure Claim의 scope를 Evidence에 맞춘다.

### 5.20 Work Status

> Work Case가 continuation과 closure 관점에서 현재 어디에 있는지 나타내는 상태.

```text
active
waiting
blocked
paused
complete
```

- `active`: 현재 continuation path가 있다.
- `waiting`: 알려진 external condition이 바뀌기를 기다린다.
- `blocked`: 현재 required closure path가 없다.
- `paused`: continuation은 가능하지만 명시적으로 중단됐다.
- `complete`: Closure Claim이 assured되고 consequential Effect가 settled됐다.

## 6. Runtime component vocabulary

### Work Core

Work Case transition과 invariant를 소유한다. Pi hook, TUI, Skill discovery를 소유하지 않는다. `pure`는 implementation property이므로 product concept 이름에는 포함하지 않는다.

### Contribution Router

Contribution Need와 context를 보고 사용할 Capability를 선택한다. Conclusion을 만들거나 fixed Skill order를 강제하지 않는다.

### Model Protocol

Model이 Observation, Contribution, Action Candidate, settlement, Closure Claim을 명시적으로 제안하는 경계다. Model은 canonical state owner가 아니다.

### Pi Adapter

Pi hook과 Work Core transition 사이를 번역한다. Host event를 domain policy로 해석하지 않고, core policy를 host detail에 결합하지 않는다.

### Work Record

Replay에 필요한 work history를 보존한다. `event store`나 append-only storage를 public concept로 미리 확정하지 않는다.

### Work View

Work Case를 사용자에게 보여주는 read-only projection이다. Mutation과 transition을 소유하지 않는다.

## 7. Canonical relation vocabulary

다음 문장이 자연스럽게 유지되는지를 concept boundary check로 사용한다.

```text
Outcome defines Work Case.

Observation may reveal Warrant Gap.

Warrant Gap opens Judgment.

Judgment is classified by Judgment Category.

Judgment declares Contribution Needs.

Capability produces Contribution.

Contribution addresses Contribution Need.

Judgment synthesizes Contributions into Conclusion.

Conclusion warrants an Action Candidate or Claim.

Warrant and permission clear an Action Candidate.

A cleared Action produces an Effect.

Effect Observations settle the Effect.

Claim Assurance bounds a Closure Claim.

Closure Claim supports a Work Status transition.
```

## 8. Current-to-domain rename map

이 표는 code rename 지시가 아니다. Transition trace와 새 implementation에서 사용할 domain sense를 정한다.

| Current expression | Problem | Domain candidate |
| --- | --- | --- |
| `WorkState` | representation 이름 | `Work Case` |
| `intendedOutcome` | delegation provenance와 concept가 섞임 | `Outcome` |
| `referent` | product reader에게 추상적 | `Judgment Subject` |
| `requiredContributions` | 이미 존재하는 Contribution처럼 읽힘 | `Contribution Needs` |
| `authorizedAction` | warrant와 permission을 혼합 | `Cleared Action` |
| `unsettledEffects` | relation이 숨겨짐 | `Effects Pending Settlement` |
| `completionCandidate` | blocked와 no-change를 포괄하지 못함 | `Closure Claim` |
| capability discovery | 목록 탐색처럼 읽힘 | `Contribution Routing` |
| read-only projection | 구현 용어 중심 | `Work View` |

## 9. Transfer and boundary cases

| Case | Concept boundary exposed |
| --- | --- |
| trivial typo 수정 | 모든 unknown이 Warrant Gap은 아니다. |
| retention policy 미정 | Contribution이 있어도 필요한 external decision 없이는 Conclusion을 만들 수 없다. |
| release는 준비됐지만 publish 미허용 | Conclusion과 Action Clearance는 다르다. |
| tool은 성공했지만 파일이 변하지 않음 | Tool result와 Effect는 다르다. |
| 파일이 절반만 변경됨 | Effect와 Effect Settlement는 다르다. |
| test는 green이지만 compatibility 미검증 | Observation과 claim-relevant Evidence는 다르다. |
| response가 종료됨 | agent turn과 Work Status는 다르다. |
| external API를 기다림 | Environment는 owner가 아니며 Work Case는 waiting으로 유지된다. |

## 10. Implementation promotion rule

Concept가 있다는 이유만으로 type, class, event, JSON field를 만들지 않는다. 다음 조건을 만족할 때만 구현 표현으로 승격한다.

```text
finite trace에서 독립된 상태를 가진다
&& 다른 concept와 독립적으로 실패할 수 있다
&& invariant 또는 forbidden state를 지키는 데 필요하다
&& 하나의 더 작은 representation으로 대체할 수 없다
```

Connector relation은 가능한 한 predicate, transition guard, field relation으로 남긴다. Runtime component는 현재 host boundary나 verification need가 요구할 때만 추가한다.

## 11. Deferred vocabulary

다음은 아직 stable concept가 아니므로 canonical schema로 만들지 않는다.

- `AuthorityEnvelope`
- `AuthorizationReceipt`
- delegation revision model
- contributor professional role
- generalized precedence engine
- confidence calculus
- SDK-owned controller

`Action Clearance`의 finite trace가 permission variation을 표현하지 못할 때 authority vocabulary를 다시 연다.

## 12. Reopen rule

이 vocabulary는 다음 evidence가 생길 때 다시 연다.

- 두 concept가 항상 같은 transition에서 같은 stop으로 움직여 독립 경계가 사라진다.
- 하나의 concept가 둘 이상의 독립 질문이나 failure mechanism을 포함한다.
- source-external trace에서 이름의 stable sense가 유지되지 않는다.
- connector relation을 state로 보존하지 않으면 replay 또는 invariant가 깨진다.
- runtime caller가 현재 이름에서 잘못된 effect, authority, lifecycle을 합리적으로 추론한다.

그 전까지는 synonym을 늘리거나 현재 implementation mechanism을 domain name으로 승격하지 않는다.
