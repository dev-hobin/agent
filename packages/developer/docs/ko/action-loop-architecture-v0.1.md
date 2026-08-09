# Developer Action Loop Architecture v0.1

[English](../action-loop-architecture-v0.1.md) | 한국어

> 상태: `@hobin/developer@0.1.20` 구현 계약
>
> 기준선: `@hobin/developer@0.1.19`
>
> 관련 계약:
> [Concept Vocabulary](./action-loop-concept-vocabulary-v0.1.md) ·
> [Capability and Material Routing](./action-loop-routing-contract-v0.1.md)
>
> Runtime note: `@hobin/developer@0.1.20`은 이 architecture를 구현한다. `before_agent_start` Capability admission에 Action Loop adapter를 사용하고 `src/action-loop`을 package에 포함하며 하나의 Pi session branch-owned Work Case를 current Judgment, Capability Assignment, Reference sealing, Contribution, Need Coverage, Conclusion, exact Pi Action Clearance와 occurrence, Effect Observation과 settlement, Closure Claim, completion까지 진행한다. Versioned semantic session event가 sealed Skill 또는 Reference bytes를 저장하지 않고 current Pi branch에서 그 state를 replay한다. Live adapter는 별도 approval feature를 추가하지 않고 Pi의 default permission policy를 상속한다. Exact adverse Effect remediation과 세 durable nonterminal state—human-owned pause, observed-condition waiting, Claim-Assured blocking—가 모두 live다. Published `0.1.19`는 immutable recovery baseline으로 남는다.
>
> 작성 시점: 2026-08-06

## 1. 이 architecture가 변경된 이유

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
4. 상위 범주, Contribution Need, Skill, Reference는 어떻게 분리되는가?

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

- category Conclusion과 Action Clearance는 같은 것이 아니다.
- 필요한 external decision이나 Evidence가 없으면 Judgment는 닫히지 않는다.
- Contribution source의 전문성이나 Skill 결과가 스스로 permission 또는 Action Clearance를 만들지 않는다.
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
2. 다음 Action Candidate 또는 Closure Claim 주위의 consequential unresolved Warrant Gap을 식별한다.
3. 필요한 상위 Judgment instance만 연다.
4. Judgment가 요구하는 Contribution Need에 맞춰 internal, external, project-local Capability와 context를 조합한다.
5. category contract에 따라 Contributions를 종합한다.
6. 정당화된 action, no-change, wait, block, pause, completion 중 하나로 진행한다.
7. controlled action의 실제 effect를 관찰하고 settle한다.
8. evidence가 지지하는 범위를 넘지 않는 completion claim만 허용한다.

Developer는 모든 작업을 무거운 판단 절차로 바꾸지 않는다. trivial하고 bounded하며 reversible하고 직접 확인 가능한 작업은 불필요한 상위 judgment 없이 직접 accounting할 수 있다.

### Model-neutrality invariant

Developer의 canonical work, Judgment, routing, Action Clearance, Effect Settlement, Closure semantics는 특정 model, provider, prompt style, structured-output feature, SDK에 의존하지 않는다.

```text
provider/model transport
  → Pi Adapter normalization
    → model-neutral proposal protocol
      → Work Core transition guards
```

다음은 반드시 유지한다.

- Work Core는 provider SDK type, response envelope, model name을 알지 않는다.
- Model output은 Observation, applicability, Contribution, Coverage, Action, settlement, Closure의 proposal이지 canonical mutation이 아니다.
- 모든 proposal은 같은 refined protocol과 transition guards를 통과한다.
- Model 교체, retry, compaction, reload는 Work Case identity와 accepted state를 지우지 않는다.
- malformed, refused, empty, timed-out output은 unresolved 상태로 남고 success나 no-gap으로 해석되지 않는다.
- model identity와 provider metadata는 provenance일 수 있지만 permission, Coverage, Conclusion의 authority가 아니다.
- provider-specific prompt나 parser tuning은 optional adapter detail이며 canonical domain policy가 아니다.
- replay는 model memory나 hidden conversation state가 아니라 Work Record의 accepted transitions와 evidence에서 복구된다.

Model neutrality는 모든 model이 같은 prose나 semantic conclusion을 만든다는 뜻이 아니다. Developer가 보존하는 것은 same domain contract, admissible transitions, forbidden states, provenance requirements, failure behavior다.

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
- Canonical Conclusion은 `action-required` 또는 `no-action`을 보유하며, prose만으로 Action을 authorize하거나 Claim Assurance를 조용히 건너뛸 수 없다.
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

다음은 settled conclusion이 될 수 있다.

```text
observed-success
observed-no-effect
failed
partially-applied
```

다음은 아직 unsettled state다.

```text
pending
unknown
```

Known partial effect는 partial로 settle될 수 있지만 completion을 막거나 Judgment를 다시 열 수 있다. 관찰된 Effect가 expectation과 materially diverge할 때 Contextual Adequacy, Proportionate Intervention, Consequence Integrity, 또는 Claim Assurance가 다시 열릴 수 있다.

후속 successful Action은 이전 adverse Effect를 다시 쓰지 않는다. Closure는 current Effect Remediation이 exact `failed | partially-applied` settlement를 별개의 exact `observed-success` settlement와 결합하고 둘 다 current일 때만 진행할 수 있다. Reassessment는 이 relation을 무효화하며 Closure Claim은 adverse settlement, resolving settlement, remediation relation을 모두 accounting해야 한다. Adverse consequence의 deliberate acceptance는 explicit human decision과 Constraint compatibility contract가 생길 때까지 보류한다.

## 8. Judgment closure와 Contribution composition

상위 category는 fixed Skill list를 선언하지 않는다. Category contract는 Judgment Subject와 current context에 맞는 Closure Requirements를 도출하고, 현재 충족되지 않은 requirement가 Contribution Needs를 만든다.

```text
Judgment Category + Subject + Context
  → Closure Requirements
    → current unmet requirements
      → Contribution Needs
        → context-matched Capabilities
          → selected Skill families or other sources
            → Skill-local References when applicable
              → Contributions
                → Need Coverage
                  → Upper Judgment synthesis
                    → Conclusion
```

다음 구분을 유지한다.

```text
Closure Requirement:
  Judgment를 닫기 위해 입증되거나 disposition되어야 하는 condition

Contribution Need:
  현재 Closure Requirement를 평가하기 위해 부족한 input

Contribution:
  하나의 Need를 실제로 다루는 source-bounded input

Need Coverage:
  Contributions가 Need를 어느 정도 다루는지에 대한 Upper Judgment relation
```

Need Coverage는 `covered`, `partially-covered`, `conflicted`, `missing`을 구분한다. `superseded`는 Coverage가 아니라 Subject나 requirement 변화에 따른 Need lifecycle이다. Skill output은 Coverage나 Conclusion을 스스로 선언하지 않는다.

Capability inventory는 open-world다.

- Developer package Skills
- external package Skills
- project-local Skills
- tools와 verifier
- specialist contribution
- external decision source
- code, tests, user language, observed effect

다음 capability boundary를 유지한다.

```text
Capability:
  반복적으로 Contribution을 만들 수 있는 수단

Skill:
  method와 handoff boundary를 가진 Capability

TOC descriptor:
  Skill applicability와 Skill-local Reference relevance만 선언하는 authoring contract

Reference:
  selected Skill 안에서 trigger에 따라 선택되는 deeper method

Context source:
  selection과 acceptance를 바꾸는 Observation 또는 Constraint

Category:
  반복되는 consequential Warrant Gap의 stable question과 closure contract
```

TOC는 모든 Capability에 요구되지 않는다. Tool, direct Observation, external decision은 다른 adapter를 통해 Contribution을 만들 수 있다. `AGENTS.md`, repository instructions, code, test는 Context source이며 자동으로 Skill이나 상위 category가 되지 않는다. Skill이 추가되어도 top-level responsibility ontology가 자동으로 늘어나지 않는다.

Skill의 human-facing `name`은 runtime identity가 아니다. Pi Adapter는 discovered source provenance와 Skill-relative root에서 source-bound Capability ID를 생성하고, exact `SKILL.md`와 routing fingerprint에서 Capability revision ID를 생성한다. Structured Skill의 fingerprint는 normalized TOC hash이고, unstructured Skill은 explicit versioned no-TOC marker를 사용한다. Recognized invalid descriptor는 unstructured fallback이 아니다. Current Pi가 name collision로 제외한 Skill을 Developer가 독자적인 filesystem scan으로 복원하지 않는다.

Contribution Need의 final TypeScript representation은 아직 확정하지 않는다. 그러나 Closure Requirement, Need, Capability routing, Reference routing, Contribution, Coverage, Conclusion 사이의 linking semantics는 [Capability and Material Routing](./action-loop-routing-contract-v0.1.md)을 따른다.

## 9. 최소 canonical state

첫 Work Core는 다음보다 넓어지지 않는다.

```text
WorkState {
  outcome
  status
  openJudgments
  clearedAction?
  effectsPendingSettlement
  closureClaim?
}
```

```text
Judgment {
  category
  subject
  question
  closureRequirements
  contributionNeeds
  contributions
  needCoverage
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

clear action
  → bind one warranted and permitted controlled action

observe effect
  → record what happened

settle effect
  → classify actual outcome

propose closure
  → state an evidence-bounded Closure Claim

complete | block | pause
  → leave active only through an explicit supported transition
```

### Forbidden states

- consequential Contextual Adequacy 또는 Proportionate Intervention gap이 열린 채 관련 Action을 clear한다.
- unsettled consequential Effect가 있는 상태에서 complete한다.
- supporting Evidence보다 넓은 Closure Claim을 만든다.
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
│ Skill source와 TOC를 refined Capability inventory로 결합                │
│ controlled tool action 전 Action Clearance를 확인                        │
│ tool result를 Effect Observation으로 기록                               │
└───────────────────────────────────┬─────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────── Pure Work Core ─────────────────────────────┐
│ Work Case · pure transitions · invariants                               │
│ warrant-gap admission · Closure Requirements · Need Coverage             │
│ Contribution assignment · action/effect · evidence-bounded completion   │
└───────────────┬───────────────────┬───────────────────┬─────────────────┘
                │                   │                   │
                ▼                   ▼                   ▼
       Contribution routing   Model Protocol      Work View
       internal/external/     and guidance        session replay / TUI
       project-local Skills
```

### Discovery and I/O boundary

Pi Adapter는 Pi가 trust, settings, CLI, package discovery를 적용한 Skill catalog만 받아들인다. Admitted directory Skill에만 bounded direct-child JSON scan을 적용하고 direct-file Skill의 parent는 scan하지 않는다. `$schema` validation, path containment, source-bound Capability identity, exact content acquisition, explicit structured/unstructured routing state를 host-side refined values로 바꾼다. Structured sealing은 ready Reference Selection을 요구한다. Unstructured sealing은 admitted exact Skill file 하나만 봉인하며 Reference Selection이나 `selectionId`를 합성하지 않는다.

Work Core는 filesystem을 검색하거나 raw TOC JSON을 해석하지 않는다. 이미 provenance가 결합된 Capability inventory와 sealed Skill context만 받아 pure assignment, Coverage, transition invariant를 적용한다. Structured applicability는 declared `when/unless` accounting을 요구한다. Unstructured applicability는 같은 proposal protocol을 사용하되 condition match를 합성하지 않고 explicit basis만으로 `applicable | not-applicable | needs-context`를 정제한다. Contribution acceptance는 두 sealed-context 형식의 공통 identity와 exact `selectedPaths` accounting만 사용하므로 unstructured Contribution은 빈 Reference application 집합을 유지한다.

### Model Protocol boundary

Model Protocol은 provider response format을 public domain shape로 만들지 않는다. Pi Adapter가 provider/model-specific output을 bounded proposal로 정규화하고, Work Core는 proposal provenance와 semantic fields만 검사한다.

```text
model A response ─┐
model B response ─┼→ Pi Adapter → same proposal contract → Work Core
human evaluator ──┘
```

Model switch는 Outcome, open Judgment, Closure Requirements, Need Coverage, cleared Action, unsettled Effect를 자동으로 stale하게 만들지 않는다. 새 model proposal은 기존 accepted state 위에서 별도로 평가된다. Invalid proposal은 canonical transition을 만들지 않는다.

### Hook responsibilities

- `before_agent_start`: current canonical work, unresolved Closure Requirements와 Contribution Needs를 model context에 제공한다.
- primary progression tool: bounded proposal session을 위임하고 trusted controller가 judgment, contribution, action, settlement, completion transition을 admit한다. Exact host evidence와 continuity는 별도 Pi-boundary tool에 남는다.
- `tool_call`: controlled Action이 현재 Cleared Action과 맞는지 확인한다.
- `tool_result`: 실행 결과를 Effect Observation으로 기록한다.
- `agent_settled`: completion으로 오인하지 않고 continuation, waiting, blocked, paused candidate를 판단한다.
- session replay: append-only evidence에서 canonical state를 복구한다.
- TUI projection: intended outcome, open judgment, action/effect, status를 read-only로 보여준다.

첫 adapter surface는 pure trace에서 필요한 transition만 노출한다. 이전 runtime의 protocol tool, state region, workbench surface를 그대로 계승하지 않는다.

처음 승인된 live cutover는 Work Case activation보다 좁다.

```text
before_agent_start.systemPromptOptions.skills
  → source-bound catalog and bounded TOC discovery
  → exact Skill-byte Capability binding
  → canonical Capability inventory
  → Action Loop protocol prompt
```

이 boundary는 `@hobin/developer@0.1.20`에서 live다. Rejected catalog는 어떤 Developer Skill도 admit하지 않고, entry별 descriptor 또는 binding failure는 unstructured routing으로 fallback하지 않은 채 unavailable로 남는다.

다음 live slice는 하나의 bounded Work Case를 열고 projection한다.

```text
primary SDK Work Case proposal
  → bounded Outcome, acceptance conditions, Constraints, and basis
  → openWorkCase transition
  → current Pi session branch-owned active Work Case
  → next-turn, restart, session-tree projection
```

Exact duplicate는 stutter하고, 다른 Outcome은 active work를 교체할 수 없으며, Developer를 끄면 기존 confirmation boundary 뒤에 canonical branch-local mode reset을 append한다. Opening은 Action Clearance를 부여하지 않고 completion을 뜻하지 않는다. 모든 canonical Judgment, Contribution, Action, Effect, continuity, completion transition은 current Work Case ownership을 요구하므로 compatibility protocol이 Outcome continuity를 우회할 수 없다.

그 Work Case 안에서 current upper Judgment 하나를 여는 다음 slice도 live다.

```text
primary SDK Judgment proposal
  → Judgment Category + Subject + Question
  → explicit Closure Requirements + functional Contribution Needs + basis
  → adapter-supplied Work Case identity + separate current Context revision
  → openJudgment transition
  → recordWorkCaseJudgment transition
  → next-turn before_agent_start projection
```

Pure Work Case revision은 이제 open Judgment identity를 포함하고 open Judgment는 Closure Target 준비를 막는다. Matching Conclusion은 open inventory에서 Judgment를 제거하고, Category, Subject, Context identity를 바꾸는 Conclusion은 거부된다. Narrow live adapter는 current open Judgment 하나만 admit한다. Exact duplicate는 stutter하고 다른 proposal은 그것을 교체할 수 없다.

Capability inventory controller는 그 open Judgment가 없으면 routing을 거부한다. Exact current Contribution Need를 선택하고, 선택이 모호하지 않은 Need 하나만 있을 때에만 sole Need를 자동 선택한다. Capability name이 Need를 도출하지 않는다.

Capability Applicability slice도 live다.

```text
before_agent_start bound Capability projection
  → exact Capability revision + declared when/unless conditions
primary SDK applicability proposal
  → applicable | not-applicable | needs-context
  → acceptCapabilityApplicability
  → current assessment
  → Capability Assignment only when applicable
```

Unstructured Capability은 synthetic predicate 대신 empty condition match를 요구한다. 같은 Need, Capability revision, live Context에 대한 서로 다른 두 번째 assessment는 accepted state를 조용히 교체하지 않고 거부된다. Skill Contribution은 exact current Assignment를 요구하며 `not-applicable`과 `needs-context`는 acquisition이나 Contribution을 authorize할 수 없다. Canonical event는 Contribution Need, Assignment, Capability revision identity를 보존한다.

Selected-material과 Judgment synthesis path도 이제 live다.

```text
Capability Assignment
  → unstructured: seal exactly one Skill file and no References
  → structured: disposition every declared Reference exactly once
      → needs-context: remain unsealed
      → ready: atomically seal Skill + selected References
  → load selected Reference from sealed bytes
  → accept Skill Contribution with exact Reference applications
  → assess all current Contributions for Need Coverage
  → disposition every Closure Requirement against current Coverage
  → Judgment Conclusion or explicit refusal
  → derive exact Pi built-in tool input identity
  → record exact Action Candidate
  → adapter-owned Pi default Permission Decision
  → record matching Action Clearance
  → exact one-time tool occurrence begins pending Effect
  → tool result becomes Observation, not implicit success
  → complete Observation + intended Effect settlement accounting
  → whole-inventory Closure Target
  → complete Closure Claim accounting
  → atomic Work Case completion revalidation
```

새 Contribution은 그 Need의 current Coverage를 invalidate한다. Refusal은 Judgment를 open 상태로 남긴다. Conclusion은 open Judgment를 제거하고 canonical Work Case revision을 전진시킨다. Skill Contribution과 host Contribution은 같은 minimal upper Coverage projection을 공유하고, Skill Contribution은 Assignment, Capability revision, Reference Selection, sealed Context identity도 보존한다.

이 live slice는 이제 Pi의 append-only current branch에서 canonical Action Loop state를 replay한다. Protocol-tool result는 versioned semantic transition event를 가진다. Exact controlled-tool occurrence와 Effect Observation은 Developer protocol-tool result에 속하지 않으므로 작은 custom session entry를 사용한다. `session_start`와 `session_tree`는 `ctx.sessionManager.getBranch()`만 같은 domain transition으로 fold하고 expected canonical identity를 비교하며 active, nonterminal, 또는 last-completed ownership을 복구한다. Branch change는 selected branch를 fold하기 전에 prior in-memory projection을 제거한다. Duplicate nonterminal transition, stale resume, malformed event, unsupported claimed event는 ownership을 rewrite하거나 absence가 되지 않고 fail-closed한다.

Session event는 Capability revision, source descriptor, selection, hash, proposal, expected identity를 유지하지만 sealed Skill 또는 Reference bytes를 저장하지 않는다. Claimed event 각각은 closed-shape decoding과 domain replay 전에 2 MiB로 제한된다. Replay는 current Pi-admitted bounded loader를 통해서만 selected material을 재획득한다. Exclusion, absence, oversize, content drift로 exact Capability 또는 sealed Context identity를 재생성하지 못하면 replay는 visibly unavailable해지고 replacement work를 block한다. Filesystem fallback이나 silent substitution은 없다. Pi `--no-session` mode는 process-local이며 restart를 넘어 continuity를 보존할 수 없다.

Model은 계속 Candidate만 제안하고 adapter가 exact tool identity를 도출하며 Pi default policy에서 Permission Decision을 공급한다. Exact Clearance는 그 built-in tool을 일시적으로 expose하고 변경되거나 반복된 input을 거부한다. 별도 approval setting이나 prompt는 추가하지 않는다. 더 강한 approval policy는 implicit restriction이 아니라 나중의 optional feature로 남긴다. Exact user prompt와 finalized tool result는 truth나 Conclusion이 되지 않는 host Observation으로 admit된다. Action에 속한 tool result는 Effect Observation으로도 남고 explicit settlement accounting이 `pending`, `unknown`, 또는 settled outcome을 도출해야 한다. Current failed 또는 partially-applied settlement는 distinct current `observed-success` repair에만 bind할 수 있고 closure accounting은 두 Effect history를 모두 보존한다. Closure preparation은 전체 Work Case inventory를 소유하고 completion은 revision-bound Target과 Claim을 재검증한다. Durable substrate는 natural-language evidence와 canonical pause, wait, block, resume tool을 통해 human-owned pause, observed-condition waiting, Claim-Assured blocking을 보존한다. Waiting tool은 exact current host Observation과 exact resume predicate를 요구하고 blocking tool은 caller-selected subset을 받지 않고 complete current blocker inventory를 도출한다. 이 transition은 Pi `--no-session`에서 사용할 수 없고 nonterminal ownership을 유지하는 동안 controlled Action을 block한다. Waiting은 새 Observation이 stored predicate를 만족한 뒤에만 resume한다. Blocking은 모든 current closure blocker를 도출하고 current Claim Assurance Conclusion을 요구하며 observed change가 concrete continuation을 공급한 뒤에만 resume한다.

## 12. Extension-level guarantee boundary

Extension은 다음을 소유할 수 있다.

- provider/model-independent canonical work semantics
- model proposal validation과 accepted-transition boundary
- canonical work status와 replay
- judgment identity와 closure accounting
- controlled Action Clearance 기록
- observed Effect와 settlement
- Closure Claim과 Evidence scope
- bounded continuation과 visible pause/block

Extension만으로 다음을 보장할 수는 없다.

- model correctness 전체
- provider liveness
- 알려지지 않은 모든 external effect
- model이 protocol을 항상 올바르게 호출함
- host가 display하기 전의 모든 output 통제
- SDK-level process ownership

따라서 첫 목표는 완전한 autonomous controller가 아니라 inspectable하고 replayable한 action loop다. SDK ownership은 extension contract와 failure trace가 이를 요구할 때만 다시 검토한다.

## 13. Unix-style POC strategy

첫 구현 단위는 큰 `WorkCore` class나 workflow machine이 아니다.

> 하나의 invariant와 failure boundary를 완전히 소유하는 작은 module을 만들고, 독립 test에서 빠르게 실패시키고, green이 된 module만 다음 module과 조합한다.

### Small and complete module rule

각 module은 다음 계약을 만족한다.

```text
one semantic decision
+ explicit refined input
+ explicit success, uncertainty, invalid output
+ no hidden shared state
+ no Pi or provider dependency
+ focused independent tests
= one complete POC module
```

- External 또는 model-authored input failure는 explicit invalid result로 반환하고 dependent effect 전에 멈춘다.
- `needs-context`, `partial`, `conflicted` 같은 domain uncertainty를 parse failure나 boolean false로 접지 않는다.
- Refined input 이후 불가능한 internal state만 programmer error로 fail fast한다.
- Module test가 green이 되기 전에 coordinator, framework, public facade를 만들지 않는다.
- Composition은 먼저 test가 module functions를 직접 연결해 증명한다. 반복 pressure가 생기기 전에는 orchestration abstraction을 승격하지 않는다.
- 한 module 수정은 그 module의 focused test와 이미 조합된 slice만 다시 실행할 수 있어야 한다.

### Module loop

```text
one accepted invariant
  → one failing representative check
    → smallest complete module
      → focused green test
        → commit
          → next independent module
            → direct composition test
              → vertical slice
```

### First Judgment-routing slice

첫 slice는 architecture 전체가 아니라 가장 불확실했던 Upper Judgment–Skill–Reference linking을 끝까지 통과한다.

```text
raw default-or-schema-identified TOC
  → Parsed TOC
  → source-bound Capability
  → accepted applicability proposal
  → complete Reference dispositions
  → Reference Selection
  → exact Sealed Skill Context
  → accepted Skill Contribution
  → Need Coverage
  → Judgment Conclusion or explicit refusal
```

각 화살표는 독립 module과 focused test를 갖는다. 첫 완성 module은 모든 declared Reference를 `selected | not-needed | needs-context`로 정확히 한 번 disposition하고 declaration order를 보존하는 Reference Selection이다.

첫 slice의 composition test는 deterministic fake evaluator를 사용한다. Pi hook, live model, TUI, replay는 포함하지 않는다. 같은 slice가 success, missing disposition, needs-context, selected-content drift, partial Coverage, conflicting Coverage를 구분해야 한다.

### Second Action-effect slice

첫 slice가 green일 때만 Conclusion 이후를 조합한다.

```text
Conclusion
  → exact controlled-action fingerprint + intended Effects
  → Action Candidate
  → required Conclusions + separate current Permission Decision
  → Action Clearance | explicit not-cleared
  → matching host controlled-Action occurrence
  → pending Effect
  → Effect Observation
  → Effect Settlement
  → Closure Claim
  → Work Status transition
```

### Macro cutover order

```text
0. Published 0.1.19 recovery baseline
        ↓
1. Focused failing module checks
        ↓
2. Small complete pure modules
        ↓
3. Judgment-routing vertical slice
        ↓
4. Action-effect vertical slice
        ↓
5. Model-neutral protocol adapters
        ↓
6. Pi hook adapter
        ↓
7. Session replay and TUI projection
        ↓
8. Old runtime cutover and removal
        ↓
9. Packed artifact verification
```

### Behavior and structure separation

- Published 0.1.19는 immutable operational recovery baseline으로 남는다.
- Pure module은 `src/action-loop/`에서 Pi adapter와 분리한다.
- Canonical adapter, session replay, semantic Workbench, exact Action gating이 live runtime을 소유한다.
- Legacy machine, state projection, route/question tool, Workbench protocol, `xstate` dependency를 제거했다.
- Eval projection, package description, bilingual README는 canonical Action Loop semantics를 사용한다.
- publication은 구현 완료와 분리된 운영 승인 사항이다.

## 14. Required transition traces

첫 pure core는 다음 finite traces를 설명하고 검증해야 한다.

1. **Justified change**: relevant gap을 닫고 action을 수행한 뒤 effect를 settle하고 complete한다.
2. **Justified no-change**: intervention judgment가 no-action을 선택하고 evidence-bounded claim으로 닫힌다.
3. **Missing contribution**: 필요한 evidence 또는 decision이 없어 waiting이나 blocked가 된다.
4. **Successful action**: tool success를 실제 effect observation과 구분한 뒤 settle한다.
5. **Failed or partial effect**: failure 또는 partial application은 별개의 observed-success Effect가 current remediation으로 결합될 때까지 completion을 막으며, original adverse settlement는 closure accounting에 남는다.
6. **External decision wait**: professional role을 발명하지 않고 필요한 decision을 명시해 waiting으로 남는다.
7. **No-progress pause**: response가 반복되거나 continuation progress가 없을 때 outcome을 잃지 않고 pause한다.
8. **Evidence-bounded completion**: verifier가 지지하는 scope까지만 completion claim을 허용한다.
9. **Open-world capability composition**: 하나의 Need가 zero, one, several Skills 또는 non-Skill sources에 의해 다뤄지고, selected Skill은 zero, one, several References를 선택한다.
10. **Partial and conflicting Coverage**: useful Contributions가 있어도 consequential residual이나 conflict가 있으면 Conclusion과 completion을 허용하지 않는다.
11. **Capability identity and drift**: same human name이 source identity를 합치지 않고, Skill/TOC 또는 selected Reference drift가 dependent value를 stale하게 만든다.
12. **Model substitution and failure**: 서로 다른 model이나 human evaluator가 같은 proposal contract를 사용하고, model 교체 또는 malformed/refused output이 accepted Work Case state를 지우거나 invalid transition을 만들지 않는다.

추가 상태, event, abstraction은 이 trace 중 하나가 요구할 때만 도입한다.

## 15. 현재 non-goals

- professional identity별 package 분할
- `Developer` actor에게 canonical accountability 부여
- 고정된 Skill-name routing table을 category contract에 포함
- `AGENTS.md`를 Skill이나 upper category로 취급
- 모든 작업에 네 category를 강제 적용
- effect settlement를 별도 상위 category로 승격
- authority, confidence, priority를 위한 일반 목적 ontology
- `0.1.19` runtime protocol과의 backward compatibility
- Operator 변경 또는 통합
- SDK-owned host 구현
- provider/model-specific state machine, category, TOC, Work Core type
- 특정 prompt wording이나 structured-output feature를 canonical correctness boundary로 사용

## 16. Source basis와 경계

상위 범주는 책 제목, chapter, profession, 현재 Skill 이름에서 직접 도출하지 않았다. source는 category의 독립된 failure와 stop을 시험하는 evidence로 사용했다.

- *Tidy First?*: action/no-action, timing, scope, reversibility, stop을 Proportionate Intervention과 대조했다.
- *Elements of Clojure*: environment fit, assumption, composition, acknowledgement, effect accounting을 Contextual Adequacy와 settlement 경계에 사용했다.
- *99 Bottles of OOP*: factual comparison, change pressure, abstraction cost, justified duplication을 intervention 경계에 사용했다.
- *Sparks of Genius*: observing, patterning, modeling, transforming, synthesizing은 상위 category가 아니라 여러 category에 기여하는 일반 capability로 보았다.
- *Logic for Programmers*: partial specification, contract, replacement, safety, liveness, refinement으로 category closure와 독립 failure를 시험했다.
- *Grokking Simplicity*: action, timing, repetition, shared resource, timeline, coordination으로 Consequence Integrity를 시험했다.
- *Structure and Interpretation of Computer Programs*: procedure/process, abstraction barrier, state, identity, ordering, concurrency로 possible execution과 invariant-preserving outcome을 구분했다.

이제 Reference를 포함하는 각 Developer Skill은 schema-identified `toc.json` 하나를 canonical Capability 및 local Reference-routing authoring surface로 선언한다. Pi가 admit한 Skill inventory는 runtime inventory로 유지되며, 어느 파일 형식이나 Skill inventory도 upper ontology의 canonical representation으로 간주하지 않는다.

## 17. Reopen and stop rule

이 working contract는 다음 evidence가 생길 때만 구조적으로 다시 연다.

- finite trace가 네 category 어디에도 속하지 않는 consequential warrant gap을 드러낸다.
- 두 category가 같은 Judgment Subject에 대해 독립된 stop 없이 항상 함께 닫힌다.
- pure transition으로 표현할 수 없는 host guarantee가 extension implementation을 실제로 막는다.
- open-world capability가 필요한 contribution을 표현할 수 없다는 concrete case가 나온다.
- model-neutral proposal contract가 accepted transition을 둘 이상의 materially different evaluator에서 표현하지 못한다.
- effect settlement와 judgment closure가 동일한 상태로 합쳐져 forbidden completion을 허용한다.

그 전까지는 category 추가, authority subsystem, SDK host, professional-role package를 설계하지 않는다.
