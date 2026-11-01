---
id: conceptualize
plugin: hobin-learning
skill: conceptualize
version: 0.3.0
---

# conceptualize — 여러 근거에서 하나의 개념 만들기

이 문서가 conceptualize 역량의 인터페이스다. 특정 호스트를 알지 않는다. 호스트별 구현체는 이
명세에서 `implementing-core` skill로 만든다.

## 1. 목적과 범위

여러 원천에 묶인 인사이트, 자료, 예시, 관찰을 비교해 원천의 어휘와 예시가 바뀌어도 남는
**하나의** 연산, 관계, 구분, 힘, 판단을 찾고, 그것이 하나의 개념이 될 만한지 전이 사례와 반례로
시험한다.

- 대상: 원천별 표현 비교, 우연한 세부 걷어 내기, 이웃 개념·연결 관계와의 구분, 전이 사례와
  반례로 후보 시험, 그리고 요청이 있을 때 자기완결적인 Markdown 개념 산출물.
- 대상 아님: 한 원천이 무엇을 말하는지 공부하기(technical-reading, opensource-reading),
  여러 사례를 반복 가능한 작업 흐름으로 만들기(patternize), 연습 설계(exercise).
- 개념 관문을 통과하지 못하는 것도 정상 결과다. 요청이 개념화였다는 이유로 다듬어 내지 않는다.

설명문(호스트가 skill 목록에 보여 줄 문장, 영어):

> Forms and tests one source-independent concept from several sources, notes, insights,
> talks, or examples. Use whenever the user asks what single idea several materials or
> mechanisms share, whether two named ideas are one concept or two, or to strip
> source-specific detail and keep what transfers, even when the answer seems known from
> general knowledge and even before the materials are shared. Tests the candidate with
> transfer cases and counterexamples and separates it from nearby concepts. Produces a
> complete concept result and, when requested, a self-contained plain Markdown artifact.
> Not for explaining or summarizing one source or one term, turning cases into a
> step-by-step procedure or decision path, practice problems, or domain modeling.

짧은 설명: Form and test one transferable concept from several sources
표시 이름: Conceptualize

## 2. 호출

- 사용자가 부를 수도 있고, **모델이 스스로 고를 수도 있다**. 선택 판정 사례는 `triggers.yaml`에 있다.
- 다음 중 하나라도 해당하면 이 역량을 쓴다.
  - 비교할 독립적인 원천, 인사이트 묶음, 저장소 사례, 관찰이 둘 이상 있다. 또는 원천 하나와
    진짜 원천 밖 전이 사례가 있다.
  - 후보가 여러 동사나 실용적 질문을 담거나, 개념과 작업 흐름을 섞거나, 전이가 불확실하거나,
    구별하는 반례가 없다.
- 다음 중 하나라도 해당하면 쓰지 않는다. 이 제외가 위 조건보다 우선한다.
  - 원하는 결과가 개념 추출이나 수정이 아니라 의도적 연습이다.
  - 원천에 충실한 읽기나 번역이 필요할 뿐, 원천에서 독립된 개념은 필요 없다.
- 인자: 비교할 자료(노트, 인사이트, 사례)와, 저장을 원하면 저장할 경로.

## 3. 산출물

기본은 대화 안의 완결된 개념 결과다. 다음 항목 가운데 쓸모 있는 최소 부분집합을 쓴다.

```text
Concept candidate:
One-sentence definition:
Practical question answered:
Cross-source evidence:
Portable model:
Mechanism:
Technical anchors:
Transfer case:
Counterexample / boundary:
Related concepts and connector relations:
Evidence gap:
Handoff:
```

- 사용자가 저장을 요청하면 사용자가 준 경로에 plain Markdown 개념 산출물을 쓴다. 정의, 근거,
  메커니즘, 전이, 경계, 관계, 출처를 담고, 어떤 보관 구조나 메타데이터 스키마도 가정하지 않는다.
  경로를 모르면 경로만 묻는다.
- 결과는 개념이 지지됨, 반박됨, 쪼개짐, 잠정 중 하나로 끝난다.

**산출물 계약.** 결과를 파일로 쓸 때의 필수 부분은 `assets/output-contract.json`에 데이터로
정해 둔다. `../shared/scripts/output-contract.mjs new <계약> <파일>`로 뼈대를 만들어 채우고,
`check`가 통과할 때까지 고친다. 검사기는 빠진 부분과 고칠 방법을 알려 준다.

## 4. 보장 (관찰 가능한 결과만)

| ID | 보장 | 수준 |
| --- | --- | --- |
| G1 | 저장을 요청받으면 사용자가 지정한 경로에 다른 파일 없이 읽히는 Markdown 개념 산출물을 쓴다 | 필수 |
| G2 | 산출물은 정의, 메커니즘, 원천별 근거와 출처, 전이 사례, 반례나 경계, 관련 개념·연결 관계를 담는다 | 필수 |
| G3 | 입력 자료를 바꾸지 않는다. 쓰는 것은 요청된 산출물뿐이다 | 필수 |
| G4 | 근거가 원천 하나뿐이면 원천 독립성을 근거 공백으로 밝힌다 | 필수 |
| G5 | 결과 파일은 산출물 계약 검사(`output-contract.mjs check`)를 통과한다 | 필수 |

각 구현체는 보장마다 호스트가 **강제**하는지, skill이 **지시**만 하는지, **지원하지 않는지**를
자기 `IMPLEMENTS.json`에 밝힌다.

## 5. 절차

전체 방법은 `knowledge/method.md`(영어 원문)에 있고, 실행할 때마다 읽는다. 아래는 요약과 관찰된
함정이다.

### 함정

- 같은 어휘나 같은 주제는 같은 개념이 아니다. 원천들이 메커니즘이나 판단을 공유할 때만
  개념을 지지한다.
- 모순을 매끄럽게 덮지 않는다. 기록한다.
- 의미의 원자성은 파일의 원자성이 아니다. 파일 모양은 의미 판단이 끝난 뒤의 전달 선택이다.
- 두 개념 사이의 관계는 보통 또 하나의 개념이 아니라 연결 관계다. 작업 흐름 모양의 조정은
  patternize로 넘긴다.
- 고유명사, 장 순서, 도구 이름을 걷어 낼 때 의미가 보존되는 경우에만 걷어 낸다. 정밀도나
  검색에 필요한 표준 기술 용어는 닻으로 남긴다.

### 단계

1. **관찰 모으기.** 원천 주장, 해석, 가설, 예시, 경계를 서로 다른 근거 종류로 보존한다. 개념
   경계를 바꿀 수 있는 자료가 빠졌을 때만 묻는다.
2. **비교표 만들기.** `Evidence context | Source-local expression | Example | Boundary |
   Candidate invariant`.
3. **역할 분류.** 개념 후보, 연결 관계, 작업 패턴 후보, 원천 국소 세부, 풀리지 않은 모순.
4. **원천 비계 걷어 내기.**
5. **후보 진술.** 짧은 이름, 한 문장 정의, 답하는 실용적 질문, 메커니즘.
6. **경계 관문.** 독립된 동사·메커니즘·질문은 쪼갠다.
7. **전이 시험.** 원천 밖 사례 하나, 가까운 오답이나 반례 하나, 가정, 일반성을 반박할 첫 조건.
8. **결과 반환.** 출처와 근거 공백을 보존하고, 요청되면 3절대로 저장한다.

## 6. 권장 전략

없음. 위임 없이 한 실행에서 끝낸다. 개념이 중심적이거나 가져가야 할 것이면 method.md의
Portable Mental Model로 메커니즘을 압축한다(순서, 축, 루프, 역할표, 관계도).

## 7. 지식

참조 파일은 독립적인 후보일 뿐 요구 사항이나 권위가 아니다. 핵심 방법(`method.md`)만으로
결과가 완결되며, 조건이 결과를 실질적으로 바꿀 수 있을 때만 0개, 1개, 여러 개를 읽는다.
"언제 읽나"는 원래의 판단 조건을 영어 그대로 옮긴 것이다.

| 파일 | 언제 읽나 | 다루는 것 |
| --- | --- | --- |
| `knowledge/method.md` | 항상 | 전체 방법: 구분, 근거 관문, 기본 흐름, 이동 가능한 모델, 출력, 품질 기준, 완료 |
| `knowledge/cross-source-synthesis.md` | At least two independent sources, insight bundles, repository cases, or observations—or one source plus a genuine transfer case—are available for comparison. | 원천 간 비교, 우연한 비계 제거, 모순 보존 점검 |
| `knowledge/concept-boundaries.md` | The candidate contains multiple verbs or practical questions, mixes concept and workflow, has uncertain transfer, or lacks a discriminating counterexample. | 의미 원자성, 역할, 전이, 가까운 오답, 반증 조건 점검 |

지식 파일은 구현체에 그대로 복사된다(내용 동일).

## 8. 수용 시나리오

각 시나리오는 `scenarios/<id>/`에 있다: `base/`(실행 전 상태), `golden/`(정답 예시),
`scenario.yaml`(요청과 결정적 판정 기준).

| ID | 상황 | 결과에 있어야 할 것 | 바뀌면 안 되는 것 |
| --- | --- | --- | --- |
| retry-notes | 서로 다른 사고에서 나온 노트 세 개(주문 API 멱등 키, 배송 라벨 중복, 송금 타임아웃)에서 하나의 개념을 만들어 `out/concept.md`에 저장 | 정의, 메커니즘, 세 노트 모두를 가리키는 근거, 전이 사례, 반례나 경계, 관련 개념·연결 관계 | `notes/` |
