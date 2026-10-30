---
id: opensource-reading
plugin: hobin-learning
skill: opensource-reading
version: 0.3.0
---

# opensource-reading — 오픈 소스 저장소 조각 읽기

이 문서가 opensource-reading 역량의 인터페이스다. 특정 호스트를 알지 않는다. 호스트별 구현체는
이 명세에서 `implementing-core` skill로 만든다.

## 1. 목적과 범위

오픈 소스 저장소를 근거가 있는 **코드 조각 하나**로 공부한다. 범위를 좁히고, 가설을 드러내고,
저장소 근거로 그 가설을 시험해, 하나의 검사 가능한 계약, 흐름, 불변식, 실패 모드, 경계, 절충을
복원한다.

- 대상: 공개 API, 모듈, 테스트 묶음, 실행 흐름, 계약, 불변식, 실패 모드, 아키텍처 경계, 절충을
  문서·테스트·예제·구현 코드에 걸쳐 추적하기, 원천에 묶인 엔지니어링 인사이트, 요청 시 Markdown
  산출물.
- 대상 아님: 저장소 전체를 한 번에 둘러보기, 빠른 API 조회, 코드 없는 산문 공부(technical-reading),
  원천 독립 개념(conceptualize), 반복 패턴(patternize), 연습 설계(exercise).

설명문(호스트가 skill 목록에 보여 줄 문장, 영어):

> Studies an open source repository through one evidence-backed code slice.
> Use for tracing a public API, module, test group, runtime flow, contract,
> invariant, failure mode, architecture boundary, or tradeoff across docs,
> tests, examples, and implementation code, and for producing complete source-
> bound engineering insights and optional plain Markdown artifacts. Not for
> touring a whole repository at once, a quick API lookup, or studying prose
> documents without code.

짧은 설명: Study one evidence-backed slice of an open source repository
표시 이름: Open Source Reading

## 2. 호출

- 사용자가 부를 수도 있고, **모델이 스스로 고를 수도 있다**. 선택 판정 사례는 아직 없다
  (`triggers.yaml` 없음).
- 다음이 해당하면 이 역량을 쓴다.
  - 조각이 여러 근거 표면에 걸치거나, 코드 한 번 찾아보기를 넘거나, 인터페이스·테스트·불변식·
    아키텍처·절충·실행 흐름 가운데 어느 관점을 고르느냐에 따라 살펴볼 것이 달라진다.
- 다음 중 하나라도 해당하면 쓰지 않는다. 이 제외가 위 조건보다 우선한다.
  - 주된 근거가 오픈 소스 저장소가 아니라 기술 산문이다.
  - 공부할 저장소 조각, API, 실행 흐름, 계약, 불변식, 실패 모드, 아키텍처 경계가 정해지지 않았다.
- 인자: 저장소(경로나 URL)와 공부할 조각, 저장을 원하면 저장할 경로.

## 3. 산출물

기본은 대화 안의 완결된 저장소 공부 결과다.

- 조각 정의:

  ```text
  Project:
  Learning objective:
  Slice:
  User-facing or caller-facing promise:
  Entry evidence:
  Likely source files:
  Likely tests:
  Out of scope:
  ```

- 산출물 하나: 계약표, 데이터·제어 흐름 추적, 불변식·실패 표, 동작-테스트 대응표, 모듈 경계도,
  결정·절충 노트, 복원한 명세 가운데 조각에 맞는 것. 복원한 명세의 칸(의도와 범위, 성공 기준,
  인터페이스와 관찰자, 경계, 동작이나 전이, 불변식, 실패 모드, 검증, 결정과 절충)은 근거가 있는
  것만 채우고 나머지는 추론이나 공백으로 표시한다.
- 인사이트 넘기기:

  ```text
  Repository scope:
  Promise or invariant:
  Insight:
  Evidence path:
  Counterexample or failure:
  Transfer possibility:
  Evidence level:
  Open question:
  ```

- 다음 움직임: 다음 저장소 조각, 개념·패턴·연습으로 넘기기, 풀리지 않은 근거 점검.
- 사용자가 저장을 요청하면 사용자가 준 경로에 plain Markdown으로 쓴다. 정확한 조각, 근거 경로,
  해석, 공백, 다음 움직임을 담고, 보관 구조나 메타데이터 스키마를 가정하지 않는다.

결과를 파일로 쓸 때는 위 형식의 영어 제목과 라벨(예: `Direct evidence`, `Inference`, `Gap`)을 그대로 쓴다. 사람과 다른 도구가
이 라벨로 결과의 각 부분을 찾는다. 해당 내용이 없으면 라벨을 남기고 "none"과 이유를 적는다.

## 4. 보장 (관찰 가능한 결과만)

| ID | 보장 | 수준 |
| --- | --- | --- |
| G1 | 결과는 정확한 조각 하나와 그 범위 밖을 밝힌다 | 필수 |
| G2 | 호출자에게 보이는 약속을 적고, 그 약속을 문서·테스트·구현의 실제 파일 경로로 이어진 근거 경로로 뒷받침한다 | 필수 |
| G3 | 중요한 주장마다 직접 근거, 추론, 가설, 공백을 구별한다 | 필수 |
| G4 | 설계를 설명하는 불변식이나 절충, 그리고 해석을 반증할 근거나 빠진 점검을 적는다 | 필수 |
| G5 | 다음 조각이나 넘기기를 적는다 | 필수 |
| G6 | 저장소 파일을 바꾸지 않는다. 쓰는 것은 요청된 산출물뿐이다 | 필수 |

각 구현체는 보장마다 호스트가 **강제**하는지, skill이 **지시**만 하는지, **지원하지 않는지**를
자기 `IMPLEMENTS.json`에 밝힌다.

## 5. 절차

전체 방법은 `knowledge/method.md`(영어 원문)에 있고, 실행할 때마다 읽는다. 아래는 요약과 관찰된
함정이다.

### 함정

- "아키텍처", "모든 테스트", "어떻게 동작하나"는 작은 경로 하나를 끝내기 전에는 다루지 않는다.
- 파일을 차례로 설명하는 산문 여행은 결과가 아니다. 근거, 계약, 흐름, 불변식, 실패, 검증
  모양으로 고친다.
- 실행되는 동작과 공개 계약이 인기, 파일 이름, 검증되지 않은 주석보다 강한 근거다.
- 근거가 충돌하면 충돌을 밝히고, 지금의 관찰자(사용자에게 보이는 계약, 현재 실행, 호환성 약속,
  설계 근거)에게 어느 쪽이 더 권위 있는지 설명한다.
- 대화형 학습에서는 다듬어진 설명보다 먼저 학습자의 예상을 묻는다. 낯선 메커니즘이면 경로 하나를
  먼저 끝까지 보여 주고, 바뀐 사례에 대해서만 예측을 묻는다. 직접 조회 요청에는 묻지 않는다.

### 단계

1. **조각 고르기.** 끝낼 수 있을 만큼 작은 이유를 밝힌다.
2. **약속 세우기.** 소비자, 능력, 정상 동작, 보이는 경계 사례.
3. **가설 끌어내기.** 무엇이 중심 문제, 입출력, 상태 변화, 위험으로 보이는가.
4. **경로 하나 추적.** 공개 진입점 → 핵심 표현이나 추상 → 내부 변환·전이 → 통합·효과·오류 경계
   → 동작을 묶는 테스트나 예제.
5. **해석 검토.** 정확함, 부분적으로 맞음, 근거 부족, 위험한 가정, 더 나은 틀.
6. **산출물 하나 만들기.** 3절의 형태 가운데 하나.
7. **다음 움직임.** 다음 조각, 넘기기, 풀리지 않은 근거 점검.

## 6. 권장 전략

없음. 위임 없이 한 실행에서 끝낸다. 그림은 순서, 경계, 상태, 관계, 근거를 글보다 싸게 보여 줄
때만 쓴다.

## 7. 지식

참조 파일은 독립적인 후보일 뿐 요구 사항이나 권위가 아니다. 핵심 방법(`method.md`)만으로
결과가 완결되며, 조건이 결과를 실질적으로 바꿀 수 있을 때만 읽는다. "언제 읽나"는 원래의 판단
조건을 영어 그대로 옮긴 것이다.

| 파일 | 언제 읽나 | 다루는 것 |
| --- | --- | --- |
| `knowledge/method.md` | 항상 | 전체 방법: 핵심 규칙, 근거 분류, 조각 프로토콜, 기본 흐름, 복원 명세 칸, 인사이트 넘기기, 전달, 품질 기준 |
| `knowledge/repository-lenses.md` | The slice spans several evidence surfaces, exceeds one direct code lookup, or choosing among interface, test, invariant, architecture, tradeoff, and runtime-flow views changes what must be inspected. | 근거 렌즈 선택과 계약, 테스트, 불변식, 경계, 흐름, 절충 산출물 틀 |

지식 파일은 구현체에 그대로 복사된다(내용 동일).

## 8. 수용 시나리오

각 시나리오는 `scenarios/<id>/`에 있다: `base/`(실행 전 상태), `golden/`(정답 예시),
`scenario.yaml`(요청과 결정적 판정 기준). 저장소는 합성 자료다.

| ID | 상황 | 결과에 있어야 할 것 | 바뀌면 안 되는 것 |
| --- | --- | --- | --- |
| token-bucket | 작은 합성 저장소(토큰 버킷 rate limiter, README·구현·테스트)에서 `take()`가 README의 약속을 어떻게 지키는지 공부해 `out/study.md`에 저장 | 조각, 약속, README·`src/bucket.js`·`test/bucket.test.js`를 잇는 근거 경로, 직접 근거와 추론·가설·공백 구별, 불변식이나 절충, 반증 근거나 빠진 점검, 다음 조각이나 넘기기 | `README.md`, `package.json`, `src/`, `test/` |
