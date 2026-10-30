---
id: patternize
plugin: hobin-learning
skill: patternize
version: 0.3.0
---

# patternize — 반복되는 사례에서 작업 패턴 만들기

이 문서가 patternize 역량의 인터페이스다. 특정 호스트를 알지 않는다. 호스트별 구현체는 이
명세에서 `implementing-core` skill로 만든다.

## 1. 목적과 범위

여러 자료, 사례, 개념, 진단, 반복된 판단에서 **하나의** 반복되는 조정 축을 찾고, 그 패턴이
쓰이는 맥락, 충돌하는 힘, 수행할 동작, 점검, 결과, 실패 경계를 실행할 수 있게 적는다.

- 대상: 작업 흐름, 결정 경로, 진단 경로, 조합 절차, 체크리스트, 실행 모델과 그 전이·실패 점검,
  그리고 요청이 있을 때 자기완결적인 Markdown 패턴 산출물.
- 대상 아님: 하나의 전이 가능한 개념 정의(conceptualize), 한 원천 공부(technical-reading,
  opensource-reading), 연습 설계(exercise), 넓은 주제 노트.
- 패턴 관문을 통과하지 못하는 것("아직 패턴 없음")도 정상 결과다. 주제 묶음에서 작업 흐름을
  지어내지 않는다.

설명문(호스트가 skill 목록에 보여 줄 문장, 영어):

> Discovers and tests a reusable operational pattern across several materials,
> cases, concepts, diagnostics, or repeated judgments. Use when recurring
> context and forces should become a workflow, decision path, diagnostic path,
> composition routine, checklist, or execution model with transfer and failure
> checks. Produces a complete pattern result and, when requested, a self-
> contained plain Markdown artifact. Not for forming a single transferable
> concept or studying one source.

짧은 설명: Discover and test a reusable operational pattern across cases
표시 이름: Patternize

## 2. 호출

- 사용자가 부를 수도 있고, **모델이 스스로 고를 수도 있다**. 선택 판정 사례는 `triggers.yaml`에 있다.
- 다음 중 하나라도 해당하면 이 역량을 쓴다.
  - 독립된 사례, 개념, 진단, 판단 둘 이상이 실용적 문제나 성공한 움직임을 공유하는 것처럼
    보이고, 주제 묶음과 구별해야 한다.
  - 패턴이 여러 의미 역할, 분기, 반복 피드백, 상태 전이, 비교 행렬을 담아 글만으로는 실행하기
    훨씬 어렵다.
- 다음 중 하나라도 해당하면 쓰지 않는다. 이 제외가 위 조건보다 우선한다.
  - 하나의 원자적 개념을 정의하거나 다듬는 일이다.
  - 여러 개념, 연결, 진단, 판단을 작업 절차로 조정하는 반복 축이 없다.
- 인자: 비교할 사례(노트, 진단, 판단)와, 저장을 원하면 저장할 경로.

## 3. 산출물

기본은 대화 안의 완결된 패턴 결과다.

```text
Pattern candidate:
Evidence level:
Recurring context and signals:
Axis:
Cases compared:
Forces:
Roles:
Moves / decision path:
Checks and feedback:
Visual, if useful:
Transfer case:
Boundary and failure case:
Falsifier / evidence gap:
Handoff:
```

- 사용자가 저장을 요청하면 사용자가 준 경로에 plain Markdown 패턴 산출물을 쓴다. 맥락, 사례,
  축, 힘, 역할, 동작, 점검, 전이, 경계, 근거 공백을 담고, 어떤 보관 구조나 메타데이터 스키마도
  가정하지 않는다. 경로를 모르면 경로만 묻는다.
- 사례 하나로는 패턴 주장이 아니라 패턴 가설만 낸다.

**산출물 계약.** 결과를 파일로 쓸 때의 필수 부분은 `assets/output-contract.json`에 데이터로
정해 둔다. `../shared/scripts/output-contract.mjs new <계약> <파일>`로 뼈대를 만들어 채우고,
`check`가 통과할 때까지 고친다. 검사기는 빠진 부분과 고칠 방법을 알려 준다.

## 4. 보장 (관찰 가능한 결과만)

| ID | 보장 | 수준 |
| --- | --- | --- |
| G1 | 저장을 요청받으면 사용자가 지정한 경로에 다른 파일 없이 읽히는 Markdown 패턴 산출물을 쓴다 | 필수 |
| G2 | 산출물은 사례 비교표, 맥락과 신호, 축, 힘, 역할, 순서 있는 동작, 점검, 전이 사례, 경계·실패 사례, 반증 조건이나 근거 공백을 담는다 | 필수 |
| G3 | 입력 자료를 바꾸지 않는다. 쓰는 것은 요청된 산출물뿐이다 | 필수 |
| G4 | 반복이 주제 공유뿐이면 작업 흐름 대신 "아직 패턴 없음"과 빠진 근거를 돌려준다 | 필수 |
| G5 | 그림은 관계, 순서, 상태, 피드백을 글보다 싸게 보여 줄 때만 넣는다 | 권장 |
| G6 | 결과 파일은 산출물 계약 검사(`output-contract.mjs check`)를 통과한다 | 필수 |

각 구현체는 보장마다 호스트가 **강제**하는지, skill이 **지시**만 하는지, **지원하지 않는지**를
자기 `IMPLEMENTS.json`에 밝힌다.

## 5. 절차

전체 방법은 `knowledge/method.md`(영어 원문)에 있고, 실행할 때마다 읽는다. 아래는 요약과 관찰된
함정이다.

### 함정

- 같은 어휘나 같은 폴더에 있다는 것은 반복이 아니다. 하나의 조정 메커니즘이 사례들을 설명할
  때만 패턴이다.
- 축이 폴더 이름이나 넓은 주제이면 버린다.
- 개념 설명을 패턴 안에 복제하지 않는다. 개념은 참조만 한다.
- 글을 되풀이하기만 하는 그림은 넣지 않는다.
- 생각 도구 목록(관찰 → 비교 → 인식 → 추상 → 모델 → 변환 → 종합)은 쓸 수 있는 연산의 목록이지
  사용자에게 보여 줄 필수 파이프라인이 아니다.

### 단계

1. **사례 모으기.** 근거 출처, 조건, 관찰 결과, 불확실성을 보존하고, 실패와 반례도 넣는다.
2. **패턴 관문.** `Case | Context | Problem | Forces | Successful move | Check | Failure if
   omitted` 표를 만든다. 공유 주제만 드러나면 "아직 패턴 없음".
3. **반복 축 이름 붙이기.**
4. **맥락과 신호.** 언제 유용한지, 전제와 관찰 가능한 계기, 범위 밖.
5. **힘 추출.** 긴장, 제약, 절충, 과용과 미사용의 비용.
6. **의미 역할.** 입력, 변환, 통제·제약, 점검, 출력과 피드백.
7. **동작 순서.** 각 동작은 입력, 행동, 출력, 국소 점검을 가진다. 분기는 결정 경로로, 나중
   근거가 앞 판단을 바꾸면 피드백 루프로.
8. **그림은 판단 비용을 낮출 때만.**
9. **시험.** 원천 사례, 원천 밖 전이 사례, 쓰면 안 되는 경계 사례, 동작 하나를 빼먹은 실패 사례,
   반복을 반증할 근거.
10. **결과 반환.** 근거 강도와 공백을 밝히고, 요청되면 3절대로 저장한다.

## 6. 권장 전략

없음. 위임 없이 한 실행에서 끝낸다.

## 7. 지식

참조 파일은 독립적인 후보일 뿐 요구 사항이나 권위가 아니다. 핵심 방법(`method.md`)만으로
결과가 완결되며, 조건이 결과를 실질적으로 바꿀 수 있을 때만 0개, 1개, 여러 개를 읽는다.
"언제 읽나"는 원래의 판단 조건을 영어 그대로 옮긴 것이다.

| 파일 | 언제 읽나 | 다루는 것 |
| --- | --- | --- |
| `knowledge/method.md` | 항상 | 전체 방법: 입력과 근거 관문, 구분, 패턴 관문, 기본 흐름, 생각 도구, 출력, 품질 기준, 완료 |
| `knowledge/recurrence-and-forces.md` | At least two independent cases, concepts, diagnostics, or judgments appear to share a practical problem or successful movement and must be distinguished from a topic cluster. | 반복, 힘, 조정 축, 동작, 점검, 결과 시험 |
| `knowledge/pattern-visualization.md` | The pattern contains several semantic roles, branches, iterative feedback, state transitions, or a comparison matrix that is materially harder to execute from prose alone. | 역할, 작업 흐름, 결정, 피드백, 상태, 행렬 그림 선택 제약 |

지식 파일은 구현체에 그대로 복사된다(내용 동일).

## 8. 수용 시나리오

각 시나리오는 `scenarios/<id>/`에 있다: `base/`(실행 전 상태), `golden/`(정답 예시),
`scenario.yaml`(요청과 결정적 판정 기준).

| ID | 상황 | 결과에 있어야 할 것 | 바뀌면 안 되는 것 |
| --- | --- | --- | --- |
| retry-notes | 서로 다른 사고에서 나온 노트 세 개(주문 API 멱등 키, 배송 라벨 중복, 송금 타임아웃)에서 재시도될 수 있는 부수 효과 호출용 패턴을 만들어 `out/pattern.md`에 저장 | 사례 표, 맥락, 축, 힘, 역할, `1.`로 시작하는 순서 있는 동작, 점검, 세 노트 모두를 가리키는 사례, 전이 사례, 쓰면 안 되는 경계, 반증 조건이나 근거 공백 | `notes/` |
