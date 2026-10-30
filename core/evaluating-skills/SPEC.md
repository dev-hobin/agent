---
id: evaluating-skills
plugin: hobin-skill-eval
skill: evaluating-skills
version: 0.3.0
---

# evaluating-skills — skill 평가

이 문서가 evaluating-skills 역량의 인터페이스다. 호스트를 알지 않는다. 각 호스트의 구현체는
`claude/`, `codex/` 아래에 있고, 이 명세가 바뀌면 `implementing-core` skill로 반영한다.

## 1. 목적과 범위

Agent Skill 하나에 대해 세 가지 질문을 떼어 각각의 평가를 만든다: skill이 잘 짜였는가(구조),
하던 일을 여전히 하는가(회귀), 컨텍스트 비용만큼 값을 하는가(벤치마크). 앞의 둘만 변경을 막는다.

- 대상: skill을 새로 만들거나 바꿀 때의 평가 세트 작성과 실행, skill을 유지·수정·병합·폐기할지의
  판단.
- 대상 아님: 애플리케이션 코드 테스트, 답변 하나의 채점, 애플리케이션이나 챗봇의 품질 평가.

설명문(호스트가 skill 목록에 보여 줄 문장, 영어):

> Builds evaluations for an Agent Skill in three layers: deterministic structure checks, a
> regression suite of pass/fail cases graded by code (trigger and outcome cases), and a
> separate benchmark that compares with-skill, without-skill, and a length-matched control.
> Use when creating or changing a skill, or deciding whether a skill earns its context cost.
> Not for testing application code or grading a single answer.

짧은 설명: Evaluate whether an Agent Skill earns its cost
표시 이름: Hobin Skill Eval

## 2. 호출

- **모델이 스스로 고를 수 있다.** 사용자가 명시적으로 불러도 된다. 고를 질의와 고르지 말아야 할
  near-miss 질의는 `triggers.yaml`에 있다.
- 인자: 평가할 skill의 경로나 이름. 없으면 요청에서 찾는다.

## 3. 산출물

1. **평가 세트.** 프로젝트가 쓰는 평가 위치, 없으면 `evals/<skill>/`. 내용은
   `knowledge/formats.md`를 따른다: 구조 검사, 회귀 사례(작업 공간, 요청, 결정적 판정 기준, 참조
   결과), 모델이 고를 수 있는 skill이면 트리거 세트, 벤치마크 과제와 길이를 맞춘 대조 텍스트.
2. **보고.** 요청이 지정한 파일, 지정이 없으면 답변에 다음을 쓴다.

```text
Eval set:       <경로>
Structure:      <검사들> — <결과 | not run>
Regression:     <사례 id>: <판정 기준 요약>. Gate: <조건, 실행 수, 기준 통과율>
Triggers:       <should n> / <near miss n> (모델이 고를 수 있는 skill만)
Benchmark:      with skill / without skill (baseline) / length-matched control; <모델들>; <실행 수>
Decision rule:  keep / revise / merge / retire 각각의 조건
Results:        <조건·모델별 기록 | not run>
Not checked:    <결정적 판정이 없어 판정하지 않는 것>
```

## 4. 보장 (관찰 가능한 결과만)

| ID | 보장 | 수준 |
| --- | --- | --- |
| G1 | 평가 대상 skill의 파일을 바꾸지 않는다. 쓰는 것은 평가 세트와 보고서뿐이다 | 필수 |
| G2 | 회귀 사례의 판정 기준은 모두 결정적이다: 실행이 남긴 파일, 명령 종료 코드, 실행한 명령만 보고, 같은 출력에는 언제나 같은 판정을 낸다 | 필수 |
| G3 | 판정 기준은 skill이 약속한 결과를 본다. 결과에 이르는 경로(쓴 도구, 하위 실행자, 단계 순서)는 skill이 그 행동 자체를 약속한 경우(예: 테스트 실행)가 아니면 판정하지 않는다 | 필수 |
| G4 | 모델이 고를 수 있는 skill의 평가 세트에는 골라야 할 질의와, 어휘를 공유하지만 다른 일을 요구하는 near-miss 질의가 함께 있다 | 필수 |
| G5 | 보고는 비교 기준(skill 없음, 길이를 맞춘 대조)과 keep / revise / merge / retire 결정 규칙을 밝히고, 결정은 한 번의 실행이 아니라 벤치마크 기록으로 내린다 | 필수 |
| G6 | 구조 검사와 회귀 사례만 변경을 막는다. 벤치마크는 막지 않고 기록하고 비교한다 | 필수 |
| G7 | 판정 기준마다 손대지 않은 작업 공간에서 실패하고 참조 결과에서 통과함이 구조 검사로 증명된다 | 권장 |

각 구현체는 보장마다 호스트가 **강제**하는지, skill이 **지시**만 하는지, **지원하지 않는지**를
자기 `IMPLEMENTS.json`에 밝힌다.

## 5. 절차

| 층 | 질문 | 판정 | 변경을 막나 |
| --- | --- | --- | --- |
| 구조 | skill과 평가 세트가 잘 짜였나 | 검증기와 스크립트, 모델 없음 | 매 변경 |
| 회귀 | skill이 여전히 골라지고, 약속한 산출물을 여전히 내나 | 결정적: 정규식, 파일 존재, 미변경, 테스트 종료 코드, 실행한 명령 | 고정된 기준 통과율 |
| 벤치마크 | skill 없음과, 같은 길이의 일반 조언보다 나은가 | 같은 결정적 판정과 숨은 테스트. 모델 판정자는 짧은 출력의 보조 신호로만 | 막지 않음, 기록하고 시간에 따라 비교 |

### 함정 (관찰된 실패)

- 모델 실행은 반복 가능하지 않지만 판정은 반복 가능해야 한다. 긴 답변을 읽는 모델 판정자는
  같은 출력에 다른 판정을 낸다. 실행이 결과를 고정된 형식의 파일로 남기게 하고 그 파일을 정규식이나
  테스트로 판정한다. 마지막 답변만 보는 판정은 모든 평가기가 읽을 수 있는 것도 아니다.
- skill이 골라지는지와 skill이 무엇을 더하는지는 다른 질문이다. 결과 사례는 요청에서 skill을
  지정하고, 트리거 사례는 자연스러운 표현을 쓰되 실행이 skill 선택만 할 수 있게 한다. 그래야 빈
  작업 공간을 탐색하다 결정 전에 멈추지 않는다.
- 모든 도구가 열려 있으면 모델은 명시 호출 skill을 불러오지 않고 일을 직접 하곤 한다. skill이
  불러와지지 않은 채 차이가 0에 가까우면 skill이 아무것도 더하지 않는다는 뜻이 아니라 skill이
  돌지 않았다는 뜻이다.
- 작은 합성 과제는 천장에 닿는다: 강한 모델은 skill이 있든 없든 통과한다. skill 없는 조건을 먼저
  돌리고 그것이 실패하는 과제만 남긴다.
- 숨은 테스트는 구현 하나를 고정할 수 있다. 손대지 않은 작업 공간(실패해야 함), 참조 결과, 다르게
  쓴 두 번째 정답으로 확인한다.
- 실행의 경로(하위 실행자에게 맡겼는지, 어떤 도구를 썼는지)를 판정하면 같은 결과를 다른 길로 낸
  실행이 떨어진다. 약속한 결과를 판정한다.
- 트리거 실행은 질의마다 skill을 불러오므로 큰 모델에서 비용이 빨리 쌓인다. 전체 행렬 전에 몇 번의
  실행으로 비용을 어림한다.

### 단계

1. **구조.** 호스트의 skill 검증기를 돌리고, 평가 세트 자체에 대한 모델 없는 검사를 둔다: 사례 필드,
   패턴 컴파일, 작업 공간 구성, 판정 기준이 손대지 않은 작업 공간에서 실패하고 참조에서 통과함.
2. **트리거 세트.** 모델이 고를 수 있는 skill이면 현실적인 질의 20개: 골라야 할 10개와, 어휘를
   공유하지만 다른 일을 요구하는 near-miss 10개. 질의마다 사례 하나, 판정은 하나: 골랐다(최소 1회)
   또는 고르지 않았다(0회).
3. **결과 사례.** 현실적인 과제 2–3개. 실행이 결과를 고정된 형식의 파일(예: `REVIEW.md`,
   시나리오 파일, `TEST_OUTPUT.txt`)로 남기게 하고 결정적으로 판정한다: 필요한 발견이 있음, 알려진
   비결함이 없음, 필요한 명령을 실행함, 금지된 수정이 없음. 요청에서 skill을 지정한다.
4. **회귀 게이트.** 트리거·결과 사례를 skill이 있는 조건으로만 3회 돌리고, 고정된 기준 아래면
   실패시킨다. 한동안 1.0인 사례가 회귀 세트다. 불안정한 사례는 판정 기준을 고칠 때까지 벤치마크로
   돌려보낸다.
5. **벤치마크.** 같은 사례와 숨은 테스트 과제를 skill 있음, 없음, 길이를 맞춘 대조 조건으로, 모델
   두 개 이상에서 돌린다. 조건별 통과율, 비용, 시간을 기록한다.
6. **결정.** 벤치마크 기록으로 정하고, 한 번의 실행으로 정하지 않는다.

| 결정 | 조건 |
| --- | --- |
| keep | 두 개 이상의 모델에서 결정적 판정으로 skill 없음과 대조를 모두 이기고, 비용 증가가 받아들일 만함 |
| revise | skill 없음은 이기지만 대조는 못 이김, 또는 기록상 skill이 불러와지지 않음 |
| merge | 두 skill이 공유 과제에서 구별되지 않는 결과를 냄, 또는 트리거 세트가 서로의 질의에 반응함 |
| retire | 어느 모델에서도 skill 없음보다 나아지지 않음 |

7. **보고.** 3절 형식으로. 모델을 돌리지 말라는 요청이면 평가 세트와 구조 검사까지만 하고
   결과는 `not run`으로 적는다.

## 6. 권장 전략

보장이 아니라 전략이다. 쓸지는 구현체와 실행이 정한다.

- **호스트 평가기로 옮기기.** 평가 세트의 내용(`knowledge/formats.md`)을 호스트의 공식 평가기
  형식으로 옮겨 돌린다. 조건별 실행기, 대조 조건 구성, 실행 기록에서 판정하는 도구는 구현체가
  제공한다.
- **조건별 격리 실행.** 조건마다 같은 시작 상태의 새 작업 공간에서, 다른 조건의 결과를 볼 수 없는
  독립 실행자로 돌린다. 가능하면 병렬로.
- **모델 판정자는 보조 신호로만.** 짧은 출력에만 쓰고, 회귀 게이트에는 쓰지 않는다.

## 7. 지식

| 파일 | 언제 읽나 |
| --- | --- |
| `knowledge/formats.md` | 구조 검사, 회귀 사례, 트리거 세트, 벤치마크 과제를 쓰기 전 |

지식 파일은 구현체에 그대로 복사된다(내용 동일). 스크립트와 자산은 없다. 벤치마크 실행기와 호스트
평가 명령은 호스트 도구이므로 구현체에 둔다.

출처: Agent Skills
[evaluating skills](https://github.com/agentskills/agentskills/blob/69ef37e9424c0a7ea9dd2293b559e43ec8176379/docs/skill-creation/evaluating-skills.mdx),
[optimizing descriptions](https://github.com/agentskills/agentskills/blob/69ef37e9424c0a7ea9dd2293b559e43ec8176379/docs/skill-creation/optimizing-descriptions.mdx).
결정적 판정 우선, 회귀 세트와 역량 세트의 구분, pass@k와 pass^k는 공개된 에이전트 평가 지침을
따른다.

## 8. 수용 시나리오

각 시나리오는 `scenarios/<id>/`에 있다: `base/`(요청 전 상태), `golden/`(정답 예시),
`scenario.yaml`(요청과 판정 기준). 판정 기준은 결정적이다(파일 존재, 정규식 일치, 다른 파일
미변경). 각 구현체는 자기 호스트의 공식 평가기로 모든 시나리오를 같은 ID로 돌리고, `triggers.yaml`의
질의마다 트리거 사례를 둔다.

| ID | 상황 | 통과해야 할 것 | 흔한 실패 |
| --- | --- | --- | --- |
| commit-message-evals | 평가가 없는 commit-message skill, 모델은 아직 돌리지 말라는 요청 | `evals/commit-message/` 아래 평가 세트, `skills/` 미변경, `REPORT.md`에 skill 없음 기준선, 길이를 맞춘 대조, keep·retire를 포함한 결정 규칙 | 평가 대상 skill을 고침, 기준선이나 대조 없이 사례만 만듦, 유지 판단 규칙이 없음 |
