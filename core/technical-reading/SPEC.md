---
id: technical-reading
plugin: hobin-learning
skill: technical-reading
version: 0.3.0
---

# technical-reading — 기술 문서 읽기

이 문서가 technical-reading 역량의 인터페이스다. 특정 호스트를 알지 않는다. 호스트별 구현체는
이 명세에서 `implementing-core` skill로 만든다.

## 1. 목적과 범위

책, 글, 문서 페이지, 명세, 튜토리얼, PDF, 웹페이지 같은 기술 산문을 원천에 충실하게 읽는다.
글을 압축하는 것이 아니라, 원천이 독자에게 보고, 하고, 설명하고, 예측하고, 판단할 수 있게
하려는 것을 복원하고, 그 배움을 근거와 경계가 보이게 정리한다.

- 대상: 코칭과 분리된 충실한 번역, 원천 의도 복원, 원천에 근거한 질문 응답, 원천의 주장·예시·
  경계·실용적 귀결을 재사용할 인사이트 후보로 정리, 요청 시 Markdown 산출물.
- 대상 아님: 코드가 주된 근거인 저장소 공부(opensource-reading), 연습 설계(exercise), 원천에서
  독립된 개념 만들기(conceptualize), 여러 사례의 작업 패턴(patternize).

설명문(호스트가 skill 목록에 보여 줄 문장, 영어):

> Studies technical prose whose primary evidence is a book, article,
> documentation page, specification, tutorial, PDF, or webpage. Use for
> faithful translation separated from coaching, source-intent reconstruction,
> source-grounded questions, and organizing a source's claims, examples,
> boundaries, and practical consequences into reusable insight candidates. Not
> for code-first repository study or designing practice exercises.

짧은 설명: Read technical prose faithfully and synthesize source-bound insights
표시 이름: Technical Reading

## 2. 호출

- 사용자가 부를 수도 있고, **모델이 스스로 고를 수도 있다**. 선택 판정 사례는 아직 없다
  (`triggers.yaml` 없음).
- 다음 중 하나라도 해당하면 이 역량을 쓴다.
  - 원천이 빽빽하거나, 여러 종류의 작업을 섞거나, 국소적인 설명만으로 독자의 혼란이 풀리지 않는다.
  - 원천이 책의 장이나 절이고, 그 의미·순서·용어·예시가 책 전체 구조에 실질적으로 기댄다.
  - 사용자가 한 원천의 여러 조각, 예시, 질문, 시각 설명에서 무엇을 배웠는지, 무엇이 중요한지 묻는다.
- 다음 중 하나라도 해당하면 쓰지 않는다. 이 제외가 위 조건보다 우선한다.
  - 주된 근거가 실행 흐름이나 구현 계약을 추적해야 하는 오픈 소스 저장소다.
  - 원천에 충실한 읽기가 아니라 연습이나 숙달 근거를 원한다.
- 인자: 읽을 원천(붙여 넣은 글, 파일, URL)과 범위, 저장을 원하면 저장할 경로.

## 3. 산출물

요청에 따라 세 모양 가운데 하나다.

- **읽기 진행**("계속", "다음", "이 절 읽어 줘", "번역해 줘"): 다음 순서를 지킨다. 해석, 조언,
  퀴즈, 종합을 읽기·번역보다 앞에 두지 않는다.

  ```text
  1. Scope
  2. Reading chunk / translation
  3. Brief explanation
  4. Coaching
  5. Next reading move
  ```

- **독자 질문**: 첫 한두 문장에서 바로 답하고, 원천에 근거한 다듬기, 작은 예시나 대조, 흔한
  오독이나 경계, 읽기·종합으로 넘기기를 필요한 만큼 붙인다.
- **인사이트 종합**(무엇을 배웠나, 무엇을 가져가나): 원천에 묶인 인사이트 묶음. 쓸모 있는
  항목만 쓴다.

  ```text
  Source scope
  Faithful claim or model
  Insight
  Source evidence
  Example or contrast
  Boundary / likely misreading
  Practical consequence
  Unresolved question
  Evidence level: source claim | interpretation | hypothesis
  ```

- 보이는 제목과 글은 사용자의 언어로 쓰되, 원천 제목, 코드, API, 식별자, 정확한 기술 용어는
  필요하면 보존한다.
- 사용자가 저장을 요청하면 완성된 결과를 사용자가 준 경로에 plain Markdown으로 쓴다. 경로를
  모르면 경로만 묻는다. 보관 구조, 메타데이터 스키마, 수명 주기, 외부 연동을 가정하지 않는다.

## 4. 보장 (관찰 가능한 결과만)

| ID | 보장 | 수준 |
| --- | --- | --- |
| G1 | 원천 범위(원천 이름과 다룬 절·쪽)를 밝힌다 | 필수 |
| G2 | 원천의 주장과 해석·가설을 구별할 수 있게 근거 수준을 표시한다 | 필수 |
| G3 | 인사이트마다 원천 근거(절, 문장, 용어)와 경계나 흔한 오독, 실용적 귀결을 단다 | 필수 |
| G4 | 풀리지 않은 질문이나 원천이 정하지 않은 것을 숨기지 않고 적는다 | 필수 |
| G5 | 읽기 진행 응답에서 번역·재구성이 해석과 코칭보다 앞선다 | 필수 |
| G6 | 원천 파일을 바꾸지 않는다. 쓰는 것은 요청된 산출물뿐이다 | 필수 |

각 구현체는 보장마다 호스트가 **강제**하는지, skill이 **지시**만 하는지, **지원하지 않는지**를
자기 `IMPLEMENTS.json`에 밝힌다.

## 5. 절차

전체 방법은 `knowledge/method.md`(영어 원문)에 있고, 실행할 때마다 읽는다. 아래는 요약과 관찰된
함정이다.

### 함정

- 고정된 출력 틀이 아니라 원천의 의도에서 시작한다. 원천 종류는 근거일 뿐 운명이 아니다. 한
  구절이 개념 논증, 실행 의미, API 계약, 불변식, 실용 판단을 섞을 수 있다.
- 조작 설명서나 명세에 숨은 철학적 통찰을 억지로 끌어내지 않는다. 계약, 실행 규칙, 경계 사례,
  선택 기준이 쓸모 있는 결과일 수 있다.
- 번역에 코칭을 섞지 않는다. 요약을 요청받지 않았으면 고른 저자 문장을 모두 보존한다.
  용어를 지키려고 원문 어순을 억지로 남기지 않는다.
- 그림, 표, 수식, 레이아웃이 가르치는 몫을 하는 원천에서 추출된 텍스트만 믿지 않는다.
- 저작권, 원천 크기, 응답 한도 때문에 범위를 다 못 다루면 조각을 줄이고 그 작은 단위부터
  번역·재구성한다.
- 여러 인사이트 묶음을 하나의 거대한 교훈으로 합치지 않는다.

### 단계

1. **원천 받아들이기.** 의미를 보존하는 입력 방법을 고른다(붙여 넣은 글, PDF의 텍스트와 렌더링,
   스캔 이미지, 웹 문서의 제목·표·코드·경고).
2. **읽기 커서 유지.** 원천 위치·종류, 판·버전, 현재 장·절·쪽, 이미 나온 용어, 풀리지 않은
   질문. "계속"은 이전 끝점에서 다음 의미 단위를 찾는다. 커서를 영구 보관소로 만들지 않는다.
3. **원천 의도 파악.** 독자가 무엇을 하게 되어야 하나, 무엇을 바꾸려 하나, 요약이 무엇을 지우나.
4. **요청 모양에 맞춰 응답.** 3절의 읽기 진행, 독자 질문, 인사이트 종합 가운데 하나. 조각은
   같은 길이가 아니라 배움의 움직임(구분, 규칙, 예제, 단서, 경계, 귀결) 단위로 자른다.
5. **넘기기.** 원천 독립 개념은 conceptualize, 반복 사례의 조정은 patternize, 연습은 exercise로
   명시적으로 넘긴다. 넘기기 없이도 이 역량의 결과는 완결된다.
6. **전달.** 저장 요청이 있으면 완성된 결과를 그대로 쓴다.

## 6. 권장 전략

없음. 위임 없이 한 실행에서 끝낸다.

## 7. 지식

참조 파일은 독립적인 후보일 뿐 요구 사항이나 권위가 아니다. 핵심 방법(`method.md`)만으로
결과가 완결되며, 조건이 결과를 실질적으로 바꿀 수 있을 때만 0개, 1개, 여러 개를 읽는다.
"언제 읽나"는 원래의 판단 조건을 영어 그대로 옮긴 것이다.

| 파일 | 언제 읽나 | 다루는 것 |
| --- | --- | --- |
| `knowledge/method.md` | 항상 | 전체 방법: 방향, 원천 받아들이기, 읽기 연속성, 의도 파악, 읽기·질문 프로토콜, 인사이트 종합, 전달, 완료 |
| `knowledge/lens-library.md` | The source is dense, mixes several kinds of work, or a direct local explanation cannot resolve the reader's confusion. | 원천 의도와 개념, 의미, 계약, 절차, 불변식, 예시, 경계, 판단 읽기 렌즈 |
| `knowledge/book-continuity.md` | The source is a book chapter or section whose meaning, order, terminology, or examples materially depend on wider book structure. | 책 구조, 의존, 용어, 예시, 전환 연속성 점검 |
| `knowledge/insight-synthesis.md` | The user asks what was learned or what matters across several chunks, examples, questions, or visual explanations from one source. | 원천에 묶인 주장, 근거, 예시, 경계, 귀결, 열린 질문 종합 점검 |

지식 파일은 구현체에 그대로 복사된다(내용 동일).

## 8. 수용 시나리오

각 시나리오는 `scenarios/<id>/`에 있다: `base/`(실행 전 상태), `golden/`(정답 예시),
`scenario.yaml`(요청과 결정적 판정 기준). 원천은 합성 자료다.

| ID | 상황 | 결과에 있어야 할 것 | 바뀌면 안 되는 것 |
| --- | --- | --- | --- |
| lease-spec | 짧은 합성 명세(샤드 lease와 fencing token)를 읽고 가져갈 인사이트를 `out/insights.md`에 저장 | 원천 범위, 인사이트, 원천 근거와 핵심 저장 규칙(4.2/4.3) 인용, `fencing token`, 근거 수준(`source claim`과 해석·가설), 예시나 대조, 경계나 오독, 실용적 귀결, 풀리지 않은 질문 | `docs/` |
