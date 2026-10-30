---
id: exercise
plugin: hobin-learning
skill: exercise
version: 0.3.0
---

# exercise — 의도적 연습과 숙달 근거

이 문서가 exercise 역량의 인터페이스다. 특정 호스트를 알지 않는다. 호스트별 구현체는 이 명세에서
`implementing-core` skill로 만든다.

## 1. 목적과 범위

배운 개념, 연결, 패턴, 읽기 인사이트, 저장소 공부 결과를 의도적 연습으로 바꾸고, 학습자가 그
대상을 문구로 알아보는 것이 아니라 **쓸 수 있다는 관찰 가능한 근거**를 얻게 한다.

- 대상: 예측 과제, 오개념 진단, 풀어 준 예제와 점점 지원을 줄이는 예제, 대조 묶음, 고치기 과제,
  전이 문제, 튜터 대본, 간격 인출 계획, 숙달 루브릭, 실제 작업 중의 체크포인트 하나, 요청 시
  Markdown 워크북.
- 대상 아님: 학습자가 본 적 없는 메커니즘을 처음 가르치기, 관찰 가능한 숙달 목표 없는 설명,
  일반 퀴즈 생성, 요약.
- 연습이 개념 경계의 잘못이나 빠진 패턴을 드러내면 몰래 고치지 않고 그 근거를 conceptualize나
  patternize로 넘긴다.

설명문(호스트가 skill 목록에 보여 줄 문장, 영어):

> Turns a learned concept, connection, pattern, reading insight, or repository
> study result into deliberate practice and observable mastery evidence. Use
> for prediction tasks, misconception diagnostics, worked and faded examples,
> contrast sets, repair tasks, transfer problems, tutor scripts, spaced
> retrieval plans, mastery rubrics, and optional plain Markdown workbooks. Not
> for first teaching a mechanism the learner has not seen, or explanation
> without an observable mastery objective.

짧은 설명: Turn learned material into practice with observable mastery evidence
표시 이름: Exercise

## 2. 호출

- 사용자가 부를 수도 있고, **모델이 스스로 고를 수도 있다**. 선택 판정 사례는 아직 없다
  (`triggers.yaml` 없음).
- 다음 중 하나라도 해당하면 이 역량을 쓴다.
  - 작은 드릴 하나가 아니라 큰 워크북, 여러 단계 진행, 간격 계획, 숙달 루브릭, 대화형 튜터가
    필요하다.
  - 큰 드릴 묶음이나 튜터 대본에 예측, 풀어 준 예제, 지원 줄이기, 대조, 고치기, 전이, 인출,
    루브릭, 오개념을 고려한 정답 해설 틀이 자세히 필요하다.
- 다음 중 하나라도 해당하면 쓰지 않는다. 이 제외가 위 조건보다 우선한다.
  - 연습할 배운 개념, 연결, 패턴, 읽기 결과, 저장소 공부 결과가 없다.
  - 관찰 가능한 숙달 목표 없이 설명이나 산출물 추출만 원한다.
- 인자: 연습할 대상(노트, 개념, 패턴, 공부 결과)과, 저장을 원하면 저장할 경로.

## 3. 산출물

두 모양 가운데 하나다.

- **연습 결과**(기본): 쓸모 있는 가장 작은 형태.

  ```text
  Exercise Design Brief
  Practice sequence
  Answer keys and misconception diagnoses
  Hint and retry rules
  Transfer task
  Spaced retrieval plan, when useful
  Mastery rubric
  Observed or expected evidence gap
  Handoff
  ```

  재사용할 사본은 대화 전체가 아니라 문제, 정답 해설, 진단, 전이 과제, 인출 일정, 루브릭을 보존한다.
- **체크포인트**(학습자가 실제 작업 중이고, 메커니즘이나 결정 모델 하나가 방금 제시되었고, 다음
  단계가 학습자의 행동 하나일 때): 대상, 현재 근거 상태, 체크포인트 문제 하나, 이 행동을 고른
  이유, 상태를 올릴 근거, 흔한 오개념, 첫 시도가 틀렸을 때의 힌트 하나. 학습자가 답하기 전에는
  정답을 주지 않고 멈춰 기다린다. 모델이 제시된 적 없으면 `needs-model`과 빠진 최소 조각, 필요한
  최소 예제를 돌려준다.
- 근거 상태: `uncovered → covered → practiced → demonstrated → transferred`. 맞은 답은 추론이 맞을
  때만 상태를 올린다. 수긍만으로는 `covered`에 머문다.
- 사용자가 저장을 요청하면 사용자가 준 경로에 plain Markdown 워크북, 튜터 대본, 진단 묶음, 인출
  계획, 루브릭을 쓴다. 문제, 정답 해설, 오개념 진단, 전이 과제, 숙달 근거를 보존하고, 보관 구조나
  메타데이터 스키마를 가정하지 않는다.

## 4. 보장 (관찰 가능한 결과만)

| ID | 보장 | 수준 |
| --- | --- | --- |
| G1 | 연습 결과는 이름 붙인 연습 대상과 관찰 가능한 학습 목표를 밝힌다 | 필수 |
| G2 | 새 사례를 설명하기 전에 예측을 요구하는 문제가 있다. 낯선 메커니즘이면 풀어 준 예제가 그 앞에 있다 | 필수 |
| G3 | 오개념 함정이나 가까운 오답, 그리고 그럴듯한 오답이 왜 틀리는지 설명하는 정답 해설이 있다 | 필수 |
| G4 | 원래 맥락 밖으로의 전이 과제와, 관찰 가능한 행동으로 정의된 숙달 근거(루브릭)가 있다 | 필수 |
| G5 | 힌트와, 다시 하기·단순화·멈춤 조건이 있다 | 필수 |
| G6 | 체크포인트 모드에서는 문제 하나만 내고 학습자가 답하기 전에 정답을 보이지 않는다 | 필수 |
| G7 | 입력 자료를 바꾸지 않는다. 쓰는 것은 요청된 산출물뿐이다 | 필수 |

각 구현체는 보장마다 호스트가 **강제**하는지, skill이 **지시**만 하는지, **지원하지 않는지**를
자기 `IMPLEMENTS.json`에 밝힌다.

## 5. 절차

전체 방법은 `knowledge/method.md`(영어 원문, Checkpoint Mode 포함)에 있고, 실행할 때마다 읽는다.
아래는 요약과 관찰된 함정이다.

### 함정

- 제시되지 않은 지식에 대해 예측을 묻지 않는다. 낯선 메커니즘은 예제 하나를 끝까지 풀어 준 뒤
  바뀐 사례에 대해 예측을 묻는다.
- 용어만이 아니라 메커니즘을 요구한다. 원천의 사소한 사실을 묻지 않는다.
- 틀린 답과, 맞았지만 추론이 틀린 답을 구별한다.
- 숙달은 자기 보고가 아니라 근거다.
- AI 튜터는 틀릴 수 있다. 정답 누설과 과잉 답변을 막는다.
- 여러 대상을 섞기 전에 하나씩 연습한다. 조합 자체를 시험하면 새 조정에 이름을 붙인다.
- 원천 글을 받으면 연습에 필요한 주장, 메커니즘, 예시, 가정, 반례만 뽑는다. 요청받지 않으면 길게
  다시 가르치거나 번역하지 않는다.

### 단계

1. **입력 파악.** 읽기 인사이트, 저장소 공부 결과, 개념·패턴 제안, 붙여 넣은 노트, 학습자의
   시도나 오개념. 실제 작업 중의 한 단계이면 체크포인트 모드로 간다.
2. **설계 요약.** 대상과 대상 종류(단일 개념, 개념 연결, 조합, 진단, 전이), 정신 모형, 선행 지식,
   흔한 오개념, 전이 대상, 필요한 숙달 근거, 가정이나 공백. 대상이 넓으면 짧은 진행으로 쪼갠다.
3. **연습 모양 고르기.** 짧은 진단 드릴, 집중 워크북, 여러 날 인출 계획, 대화 튜터 대본, 숙달 평가.
4. **진행 만들기.** 예측 → 오개념 함정 → 풀어 준 예제 → 자기 설명 → 지원 줄인 완성 → 대조 묶음
   → 디버그·고치기 → 전이 → 지연 인출 → 숙달 점검 가운데 필요한 것.
5. **정답과 코칭 계약.** 기대 답과 메커니즘, 흔한 오답, 진단, 힌트 사다리, 다시 하기 조건, 모델
   수정을 확인하는 후속 질문.
6. **근거 판단.** 새 예측, 인과 설명, 가까운 오답 구별, 검증된 고치기, 전이, 경계 진술.

## 6. 권장 전략

없음. 위임 없이 한 실행에서 끝낸다.

## 7. 지식

참조 파일은 독립적인 후보일 뿐 요구 사항이나 권위가 아니다. 핵심 방법(`method.md`)만으로
결과가 완결되며, 조건이 결과를 실질적으로 바꿀 수 있을 때만 0개, 1개, 여러 개를 읽는다.
"언제 읽나"는 원래의 판단 조건을 영어 그대로 옮긴 것이다.

| 파일 | 언제 읽나 | 다루는 것 |
| --- | --- | --- |
| `knowledge/method.md` | 항상 | 전체 방법: 핵심 규칙, 연습 대상 모형, 체크포인트 모드, 기본 흐름, 입력 처리, 출력, 전달, 품질 기준, 완료 |
| `knowledge/workbook-design.md` | The user needs a substantial workbook, multi-stage progression, spaced plan, mastery rubric, or dialogue tutor rather than one tiny drill. | 진행, 지원 설계, 튜터 동작, 인출, 전이, 숙달 근거 설계 제약 |
| `knowledge/exercise-patterns.md` | A substantial drill set or tutor script needs detailed prediction, worked, faded, contrast, repair, transfer, retrieval, rubric, or misconception-aware answer-key templates. | 진단, 예측, 풀어 준 예제, 지원 줄이기, 대조, 고치기, 전이, 인출, 루브릭 틀 |

지식 파일은 구현체에 그대로 복사된다(내용 동일).

## 8. 수용 시나리오

각 시나리오는 `scenarios/<id>/`에 있다: `base/`(실행 전 상태), `golden/`(정답 예시),
`scenario.yaml`(요청과 결정적 판정 기준). 개념 노트는 합성 자료다.

| ID | 상황 | 결과에 있어야 할 것 | 바뀌면 안 되는 것 |
| --- | --- | --- | --- |
| fencing-note | 짧은 합성 개념 노트(fencing token)를 연습 워크북으로 바꿔 `out/exercise.md`에 저장 | 연습 대상, 예측 문제, 풀어 준 예제, 오개념 함정이나 가까운 오답, 정답 해설, 힌트, 다시 하기 조건, 전이 과제, 숙달 루브릭 | `notes/` |
