# Developer Action Loop Architecture v0.1

> 상태: reconstruction working contract
>
> 기준선: `@hobin/developer@0.1.19`
>
> Runtime note: 0.1.19는 이 문서의 architecture를 아직 구현하지 않는다. 현재 release runtime과 Skills는 reconstruction 중에도 작동하는 보존 기준선이다.
>
> 작성 시점: 2026-08-06

## 1. 이 reconstruction을 하는 이유

Developer의 다음 제품 질문은 Skill 목록이나 고정된 개발 절차를 어떻게 늘릴지가 아니다.

> Pi extension 안에서 delegated outcome을 canonical active work로 유지하면서, 다음 action이나 completion claim이 현재 context, 판단, effect, evidence에 의해 정당화되는지 어떻게 계속 확인할 것인가?

이를 위한 초기 흐름은 다음과 같았다.

```text
Observe → Judge → Act → Settle → Complete | Block | Pause
```

`Judge`가 너무 넓었기 때문에 다음을 먼저 조사했다.

1. 언제 judgment를 열어야 하는가?
2. 반복되는 warrant gap에는 어떤 상위 범주가 있는가?
3. 각 범주는 어떤 질문과 독립적인 stop을 갖는가?
4. 상위 범주, contribution role, Skill, Reference는 어떻게 분리되는가?

여러 source와 transfer case를 비교한 결과 네 개의 상위 범주 후보를 얻었다.

```text
Contextual Adequacy
Proportionate Intervention
Consequence Integrity
Claim Assurance
```

이제 source taxonomy를 더 확장하는 대신 이 범주들을 v0 계약으로 고정하고 원래 Action Loop로 돌아간다. 범주 이름이나 경계는 transition trace가 독립된 stop의 부재, 중복, 또는 빠진 warrant gap을 드러낼 때만 다시 연다.

## 2. Overengineering correction

상위 범주를 검증한 뒤 professional role과 authority를 분리하는 과정에서 다음과 같은 별도 subsystem을 설계하기 시작했다.

```text
AuthorityEnvelope
AuthorizationReceipt
delegation revision
reserved-decision taxonomy
closure-requirement union
```

여기에는 유효한 통찰이 하나 있었다.

> Judgment가 요구하는 evidence, observation, decision은 instance-specific하며, professional role은 상위 ontology나 package boundary가 아니다.

그러나 action trace와 extension contract보다 먼저 authority schema를 확정할 증거는 아직 없다. 현재 architecture에는 다음 최소 규칙만 남긴다.

- category conclusion과 action authorization은 같은 것이 아니다.
- 필요한 external decision이나 evidence가 없으면 judgment는 닫히지 않는다.
- contribution source의 전문성이나 Skill 결과가 스스로 authorization을 만들지 않는다.
- environment는 observation과 constraint를 제공하지만 judgment owner가 아니다.

다음은 trace가 요구할 때까지 보류한다.

- 독립 authority subsystem
- authorization receipt와 delegation revision schema
- contributor identity 또는 professional-role taxonomy
- 일반화된 precedence engine

## 3. Product contract

Developer는 role-playing agent나 자동 계획기가 아니다.

> Developer는 delegated outcome을 canonical active work로 보존하고, consequential한 다음 action과 completion claim이 필요한 판단, 관찰된 effect, claim-relevant evidence에 의해 정당화되도록 돕는 role-independent work layer다.

Developer는 다음을 수행한다.

1. intended outcome과 현재 relevant reality를 관찰한다.
2. 다음 action 또는 completion candidate 주위의 consequential unresolved warrant gap을 식별한다.
3. 필요한 상위 judgment instance만 연다.
4. judgment가 요구하는 contribution role에 맞춰 internal, external, project-local capability와 context를 조합한다.
5. category contract에 따라 contributions를 종합한다.
6. 정당화된 action, no-change, wait, block, pause, completion 중 하나로 진행한다.
7. controlled action의 실제 effect를 관찰하고 settle한다.
8. evidence가 지지하는 범위를 넘지 않는 completion claim만 허용한다.

Developer는 모든 작업을 무거운 판단 절차로 바꾸지 않는다. trivial하고 bounded하며 reversible하고 직접 확인 가능한 작업은 불필요한 상위 judgment 없이 직접 accounting할 수 있다.

## 4. 전체 Action Loop

```text
                      ┌─────────────────────────────┐
                      │                             │
                      ▼                             │
Intended outcome → Observe current reality          │
                      │                             │
                      ▼                             │
              Next action or claim candidate        │
                      │                             │
                      ▼                             │
                    Judge                           │
         ┌────────────┼──────────────┐              │
         │            │              │              │
    no warrant gap    open gaps      cannot close   │
         │            │              │              │
         │            ▼              ▼              │
         │      gather contributions  Wait | Block  │
         │            │                             │
         │            ▼                             │
         │       synthesize judgment                │
         │            │                             │
         └────────────┼─────────────────────────────┘
                      ▼
        Act | No change | Completion candidate
             │                    │
             │                    ▼
             │             Claim Assurance
             │                    │
             ▼                    ▼
            Act                Complete
             │
             ▼
        Observe effect
             │
             ▼
           Settle
             │
             └──────────────────────────────→ Observe
```

이 흐름은 고정 phase sequence가 아니다.

- 하나의 candidate가 zero, one, several judgment를 열 수 있다.
- 새 evidence나 effect가 이전 judgment를 다시 열 수 있다.
- no-change는 실패가 아니라 정당한 intervention conclusion일 수 있다.
- assistant response의 종료는 canonical work의 종료가 아니다.
- external wait는 continuation을 중단할 수 있지만 active outcome을 지우지 않는다.

## 5. Judgment admission

다음 predicate를 만족할 때만 상위 judgment instance를 연다.

```text
openJudgment(gap) =
  relevantToDelegatedOutcome(gap)
  && consequential(gap)
  && unresolved(gap)
  && hasIndependentStop(gap)
```

### `relevantToDelegatedOutcome`

결론이 현재 outcome, constraints, next action, 또는 completion claim을 실제로 바꿀 수 있어야 한다.

### `consequential`

잘못 닫았을 때 product meaning, action choice, effect envelope, compatibility, completion claim 중 하나가 유의미하게 달라져야 한다.

### `unresolved`

이미 accepted constraint, 직접 관찰, 충분한 verifier, 또는 명시된 결정으로 닫힌 질문을 다시 만들지 않는다.

### `hasIndependentStop`

다른 질문을 닫지 않고도 그 gap 자체가 언제 해소됐는지 말할 수 있어야 한다. 예를 들어 candidate preference는 intervention의 scope, timing, action, no-action, stop과 독립된 closure condition을 갖지 않으므로 별도 상위 범주가 아니다.

## 6. 상위 judgment 범주 v0

### 6.1 Contextual Adequacy

#### 안정 질문

> 이 action, model, 또는 claim은 delegated intent와 relevant environment에 맞는가?

#### Trigger

- 요구의 의미나 acceptance boundary가 불명확하다.
- candidate가 context에 관한 consequential assumption을 포함한다.
- repository, caller, compatibility, user language가 서로 다른 의미를 시사한다.
- formal validity와 실제 context fit이 독립적으로 실패할 수 있다.

#### Non-trigger

- 의미, 제약, 적용 범위가 이미 정해져 있고 작은 mechanical action만 남아 있다.

#### Closure

- consequential assumption과 relevant constraint가 드러나 있다.
- candidate와 context의 fit 또는 mismatch가 evidence와 함께 결론 났다.
- 필요한 외부 결정이 남았다면 resolved로 가장하지 않고 wait 또는 block 상태가 된다.

#### Reopen

- 새로운 caller, constraint, user decision, repository evidence가 기존 fit conclusion을 바꾼다.

### 6.2 Proportionate Intervention

#### 안정 질문

> 현재 정당화되는 action 또는 no-action은 무엇이며, timing, scope, stop은 어디까지인가?

#### Trigger

- 여러 action이나 no-action이 가능한데 비용, reversibility, scope, timing이 다르다.
- structural change와 behavior progress가 경쟁한다.
- 큰 intervention이 가능하지만 더 작은 action으로도 현재 outcome을 달성할 수 있다.
- 언제 멈출지가 결과의 정당성을 바꾼다.

#### Non-trigger

- 하나의 bounded, reversible, directly verifiable action이 명백하다.

#### Closure

- 선택된 action 또는 no-action, scope, timing, stop이 현재 evidence에 비례한다.
- material alternative가 왜 선택되거나 배제됐는지 설명할 수 있다.
- speculative future flexibility만으로 scope가 확장되지 않는다.

#### Reopen

- 새로운 cost, failure, dependency, change pressure가 현재 intervention의 비례성을 바꾼다.

### 6.3 Consequence Integrity

#### 안정 질문

> 가능한 ordering, repetition, failure, shared-state outcome이 acceptable consequence envelope 안에 있는가?

#### Trigger

- action의 timing이나 repetition이 outcome을 바꾼다.
- partial failure, retry, concurrency, shared resource, external effect가 있다.
- local procedure는 맞지만 실행 process나 ordering이 invariant를 깨뜨릴 수 있다.
- safety와 liveness가 독립적으로 실패할 수 있다.

#### Non-trigger

- action이 local하고 atomic하며 가능한 effect가 bounded하고 직접 관찰된다.

#### Closure

- material execution path와 failure path가 acceptable envelope 안에 있거나 명시적으로 배제·완화됐다.
- unknown consequence를 success로 간주하지 않는다.

#### Reopen

- observed effect가 예상과 다르거나 새로운 ordering, repetition, shared-state path가 발견된다.

### 6.4 Claim Assurance

#### 안정 질문

> 현재 evidence는 어떤 completion, correctness, compatibility, blocked, 또는 no-change claim을 실제로 지지하는가?

#### Trigger

- completion 또는 correctness를 주장하려 한다.
- green test가 broader claim을 대표하는지 불분명하다.
- compatibility, no-change, blocked, partial completion을 구분해야 한다.
- verifier relevance와 strength가 claim에 비해 부족할 수 있다.

#### Non-trigger

- 별도의 consequential claim 없이 작은 action의 직접 결과만 accounting한다.

#### Closure

- claim scope와 evidence scope가 일치한다.
- verifier의 blind spot과 pass-but-wrong risk가 material하면 disposition됐다.
- evidence보다 넓은 claim을 만들지 않는다.

#### Reopen

- 새 failure, counterexample, changed artifact, stale verifier가 기존 claim을 약화한다.

## 7. Effect settlement의 위치

Consequence Integrity와 effect settlement는 다르다.

```text
Consequence Integrity:
  가능한 execution과 effect가 acceptable한가?

Effect settlement:
  이 controlled action이 실제로 무엇을 했는가?
```

Effect settlement는 별도 상위 범주가 아니라 Action Loop의 canonical accounting obligation이다.

```text
observed-success
observed-no-effect
failed
partially-applied
pending
unknown
```

관찰된 effect가 expectation과 materially diverge할 때 Contextual Adequacy, Proportionate Intervention, Consequence Integrity, 또는 Claim Assurance가 다시 열릴 수 있다.

## 8. Contribution composition

상위 category는 fixed Skill list가 아니라 필요한 contribution role을 선언한다.

```text
judgment situation / referent
  → upper judgment category
    → required contribution roles
      → context-matched capabilities
        → Skill-specific References
```

Capability inventory는 open-world다.

- Developer package Skills
- external package Skills
- project-local Skills
- tools와 verifier
- specialist contribution
- code, tests, user language, observed effect

다음 구분을 유지한다.

```text
Skill:
  반복 가능한 contribution capability

Reference:
  Skill 내부에서 trigger에 따라 선택되는 deeper method

Context source:
  selection과 acceptance를 바꾸는 observation 또는 constraint

Category:
  반복되는 consequential warrant gap의 stable question과 stop
```

`AGENTS.md`, repository instructions, code, test는 context source다. 자동으로 Skill이나 상위 category가 되지 않는다. Skill이 추가되어도 top-level responsibility ontology가 자동으로 늘어나지 않는다.

Contribution role의 구체적인 vocabulary와 matching representation은 아직 확정하지 않는다. 먼저 transition trace에서 실제로 필요한 contribution을 관찰한다.

## 9. 최소 canonical state

첫 pure core는 다음보다 넓어지지 않는다.

```text
WorkState {
  intendedOutcome
  status
  openJudgments
  authorizedAction?
  unsettledEffects
  completionCandidate?
}
```

```text
Judgment {
  category
  referent
  question
  requiredContributions
  contributions
  conclusion?
  status
}
```

이것은 final TypeScript API가 아니라 trace를 위한 최소 semantic shape다. trace가 요구하지 않은 `owner`, professional role, authority envelope, receipt, revision, confidence calculus는 추가하지 않는다.

### Work status

```text
active
waiting
blocked
paused
complete
```

- `active`: continuation이 가능하며 현재 outcome이 아직 canonical하다.
- `waiting`: 필요한 external decision, observation, dependency를 기다린다.
- `blocked`: required closure condition을 현재 만족할 수 없다.
- `paused`: continuation은 가능하지만 명시적으로 중단됐다.
- `complete`: required judgment가 닫히고 effect가 settled되며 evidence가 completion claim을 지지한다.

## 10. Pure transitions

첫 구현은 framework보다 pure transition과 trace를 우선한다.

```text
delegate outcome
  → activate work

observe
  → update relevant reality

open judgment
  → record consequential unresolved warrant gap

record contribution
  → attach source-bounded evidence or candidate

close judgment
  → record category synthesis

authorize action
  → bind one justified controlled action

observe effect
  → record what happened

settle effect
  → classify actual outcome

propose completion
  → state an evidence-bounded claim

complete | block | pause
  → leave active only through an explicit supported transition
```

### Forbidden states

- consequential Contextual Adequacy 또는 Proportionate Intervention gap이 열린 채 관련 action을 authorize한다.
- unsettled consequential effect가 있는 상태에서 complete한다.
- supporting evidence보다 넓은 completion claim을 만든다.
- missing external decision을 Skill result로 대신 닫는다.
- Skill output을 category synthesis 없이 final warrant로 취급한다.
- trivial work에 불필요한 judgment를 생성한다.
- justified no-change를 failure로 취급한다.
- assistant response, Skill invocation, tool result, external wait만으로 work를 종료한다.

## 11. Pi extension architecture

```text
┌──────────────────────────────── Pi Host ────────────────────────────────┐
│ before_agent_start · tool_call · tool_result · agent_settled · session │
└───────────────────────────────────┬─────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────── Pi Extension Adapter ─────────────────────────┐
│ host event를 pure work command/event로 번역                             │
│ controlled tool action 전 authorization을 확인                          │
│ tool result를 effect observation으로 기록                               │
└───────────────────────────────────┬─────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────── Pure Work Core ─────────────────────────────┐
│ WorkState · pure transitions · invariants                               │
│ warrant-gap admission · category contracts                              │
│ action/effect accounting · evidence-bounded completion                  │
└───────────────┬───────────────────┬───────────────────┬─────────────────┘
                │                   │                   │
                ▼                   ▼                   ▼
       Capability discovery   Model protocol      Read-only projection
       internal/external/     and guidance        session replay / TUI
       project-local Skills
```

### Hook responsibilities

- `before_agent_start`: current canonical work와 unresolved obligations를 model context에 제공한다.
- protocol tools: model이 judgment, contribution, action, settlement, completion transition을 명시적으로 제안하게 한다.
- `tool_call`: controlled action이 현재 authorized action과 맞는지 확인한다.
- `tool_result`: 실행 결과를 observation으로 기록한다.
- `agent_settled`: completion으로 오인하지 않고 continuation, waiting, blocked, paused candidate를 판단한다.
- session replay: append-only evidence에서 canonical state를 복구한다.
- TUI projection: intended outcome, open judgment, action/effect, status를 read-only로 보여준다.

첫 adapter surface는 pure trace에서 필요한 transition만 노출한다. 이전 runtime의 protocol tool, state region, workbench surface를 그대로 계승하지 않는다.

## 12. Extension-level guarantee boundary

Extension은 다음을 소유할 수 있다.

- canonical work status와 replay
- judgment identity와 closure accounting
- controlled action authorization 기록
- observed effect와 settlement
- completion claim과 evidence scope
- bounded continuation과 visible pause/block

Extension만으로 다음을 보장할 수는 없다.

- model correctness 전체
- provider liveness
- 알려지지 않은 모든 external effect
- model이 protocol을 항상 올바르게 호출함
- host가 display하기 전의 모든 output 통제
- SDK-level process ownership

따라서 첫 목표는 완전한 autonomous controller가 아니라 inspectable하고 replayable한 action loop다. SDK ownership은 extension contract와 failure trace가 이를 요구할 때만 다시 검토한다.

## 13. Bottom-up implementation order

```text
0. Published 0.1.19 recovery baseline
        ↓
1. This architecture working contract
        ↓
2. Pure WorkState and transitions
        ↓
3. Transition trace tests
        ↓
4. Model-facing protocol and guidance
        ↓
5. Pi hook adapter
        ↓
6. Session replay and TUI projection
        ↓
7. Old runtime cutover and removal
        ↓
8. Packed artifact verification
```

### Behavior and structure separation

- 0.1.19 runtime은 새 core와 adapter가 검증될 때까지 작동하는 기준선으로 둔다.
- pure core는 먼저 `src/action-loop/`에서 host와 분리해 만든다.
- 새 adapter가 equivalent or intentionally changed behavior를 증명한 뒤 기존 `extensions/machine.ts`, `state.ts`, Workbench protocol을 제거한다.
- `xstate`, 기존 eval scripts, package description, README는 실제 cutover에서 사용 여부를 확인한 뒤 정리한다.
- package version, publication, main merge는 reconstruction 완료와 별도 승인 사항이다.

## 14. Required transition traces

첫 pure core는 다음 finite traces를 설명하고 검증해야 한다.

1. **Justified change**: relevant gap을 닫고 action을 수행한 뒤 effect를 settle하고 complete한다.
2. **Justified no-change**: intervention judgment가 no-action을 선택하고 evidence-bounded claim으로 닫힌다.
3. **Missing contribution**: 필요한 evidence 또는 decision이 없어 waiting이나 blocked가 된다.
4. **Successful action**: tool success를 실제 effect observation과 구분한 뒤 settle한다.
5. **Failed or partial effect**: failure 또는 partial application이 completion을 막고 judgment를 다시 연다.
6. **External decision wait**: professional role을 발명하지 않고 필요한 decision을 명시해 waiting으로 남는다.
7. **No-progress pause**: response가 반복되거나 continuation progress가 없을 때 outcome을 잃지 않고 pause한다.
8. **Evidence-bounded completion**: verifier가 지지하는 scope까지만 completion claim을 허용한다.

추가 상태, event, abstraction은 이 trace 중 하나가 요구할 때만 도입한다.

## 15. 현재 non-goals

- professional identity별 package 분할
- `Developer` actor에게 canonical accountability 부여
- 고정된 Skill-name routing table을 category contract에 포함
- `AGENTS.md`를 Skill이나 upper category로 취급
- 모든 작업에 네 category를 강제 적용
- effect settlement를 별도 상위 category로 승격
- authority, confidence, priority를 위한 일반 목적 ontology
- 이전 runtime과의 post-reconstruction backward compatibility
- Operator 변경 또는 통합
- SDK-owned host 구현

## 16. Source basis와 경계

상위 범주는 책 제목, chapter, profession, 현재 Skill 이름에서 직접 도출하지 않았다. source는 category의 독립된 failure와 stop을 시험하는 evidence로 사용했다.

- *Tidy First?*: action/no-action, timing, scope, reversibility, stop을 Proportionate Intervention과 대조했다.
- *Elements of Clojure*: environment fit, assumption, composition, acknowledgement, effect accounting을 Contextual Adequacy와 settlement 경계에 사용했다.
- *99 Bottles of OOP*: factual comparison, change pressure, abstraction cost, justified duplication을 intervention 경계에 사용했다.
- *Sparks of Genius*: observing, patterning, modeling, transforming, synthesizing은 상위 category가 아니라 여러 category에 기여하는 일반 capability로 보았다.
- *Logic for Programmers*: partial specification, contract, replacement, safety, liveness, refinement으로 category closure와 독립 failure를 시험했다.
- *Grokking Simplicity*: action, timing, repetition, shared resource, timeline, coordination으로 Consequence Integrity를 시험했다.
- *Structure and Interpretation of Computer Programs*: procedure/process, abstraction barrier, state, identity, ordering, concurrency로 possible execution과 invariant-preserving outcome을 구분했다.

현재 Developer Skills와 `reference-policy.json`은 capability와 Skill-to-Reference routing evidence다. 이 파일 형식이나 Skill inventory를 upper ontology의 canonical representation으로 간주하지 않는다.

## 17. Reopen and stop rule

이 working contract는 다음 evidence가 생길 때만 구조적으로 다시 연다.

- finite trace가 네 category 어디에도 속하지 않는 consequential warrant gap을 드러낸다.
- 두 category가 같은 referent에 대해 독립된 stop 없이 항상 함께 닫힌다.
- pure transition으로 표현할 수 없는 host guarantee가 extension implementation을 실제로 막는다.
- open-world capability가 필요한 contribution을 표현할 수 없다는 concrete case가 나온다.
- effect settlement와 judgment closure가 동일한 상태로 합쳐져 forbidden completion을 허용한다.

그 전까지는 category 추가, authority subsystem, SDK host, professional-role package를 설계하지 않는다.
