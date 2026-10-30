---
id: enforcing-conventions
plugin: hobin-stances
skill: enforcing-conventions
version: 0.3.0
---

# enforcing-conventions — 관례를 자동 검사로 올리기

이 문서가 enforcing-conventions 역량의 인터페이스다. 호스트(Claude Code, Codex)를 알지 않는다.
각 호스트의 구현체는 `claude/`, `codex/` 아래에 있고, 이 명세가 바뀌면 `implementing-core`
skill로 반영한다.

## 1. 목적과 범위

사람과 에이전트가 계속 어기는 규칙을 산문에서 꺼내, 고치는 방법을 메시지에 담고 실패하는
검사로 옮긴다.

- 대상: 계속 어겨지는 코딩 관례나 에이전트 지침 규칙, 자동 검사가 필요한 입장. 위반을 잡는
  가장 싼 강제(타입, 생성 경계, lint 규칙, 테스트, hook)를 고르고 구현한다.
- 대상 아님: 스타일 가이드 고르기, 한 번 있었던 위반 하나 고치기.

설명문(호스트가 skill 목록에 보여 줄 문장, 영어):

> Turns a coding convention that keeps being violated into the cheapest automatic
> enforcement that catches it — a type, construction boundary, lint rule, test, or hook —
> with an error message that tells the reader how to fix it. Use when a convention or
> agent-instruction rule keeps being broken, or a stance needs an automatic check. Not for
> choosing a style guide or fixing a one-off violation.

짧은 설명: Turn a repeatedly broken convention into a check
표시 이름: Enforcing Conventions

## 2. 호출

- **모델이 스스로 고를 수 있다.** 사용자가 명시적으로 불러도 된다. 골라야 할 요청과 고르면 안 되는
  요청은 `triggers.yaml`에 있다.
- 인자: 강제할 규칙이나 그 규칙이 적힌 곳. 없으면 요청에서 찾는다.

## 3. 산출물

저장소의 변경과 보고다.

- 변경: 프로젝트가 이미 쓰는 도구로 만든 검사, 표준 검사 명령에 그 검사를 연결,
  기존 위반의 수정이나 검사가 읽는 명시적 baseline, 규칙의 출처 문서에서 산문을 검사를 가리키는
  한 줄로 바꾼 것.
- 검사의 실패 메시지 형식: 규칙, 이유, 대신 쓸 정확한 방법.
- 보고(요청이 지정한 파일, 지정이 없으면 답변): 강제하는 대응("이 코드 모양은 이 독자에게 이
  의도를 말한다"), 고른 강도와 이유, 다룬 경로와 다루지 못한 뒷문, 위반 표본·준수 표본·표준 검사
  명령의 실행 결과.

## 4. 보장 (관찰 가능한 결과만)

| ID | 보장 | 수준 |
| --- | --- | --- |
| G1 | 추가한 검사는 프로젝트의 표준 검사 명령에서 실행된다 | 필수 |
| G2 | 규칙을 어기는 새 코드가 들어오면 표준 검사 명령이 실패하고, 출력은 규칙, 이유, 대신 쓸 방법을 말한다 | 필수 |
| G3 | 변경 후의 코드에서 표준 검사 명령이 통과한다. 기존 위반은 같은 변경에서 고치거나 명시적 baseline으로 남긴다 | 필수 |
| G4 | 프로젝트에 이미 있는 도구로 구현하고 의존성을 새로 들이지 않는다 | 필수 |
| G5 | 규칙이 지침 문서(`AGENTS.md`, `CLAUDE.md`, 기여 안내 같은 관례 문서)에서 왔으면 그 산문을 검사를 가리키는 한 줄로 바꾼다 | 필수 |
| G6 | 끝났다고 말하기 전에 표준 검사 명령을 실행한다 | 필수 |

각 구현체는 보장마다 호스트가 **강제**하는지, skill이 **지시**만 하는지, **지원하지 않는지**를
자기 `IMPLEMENTS.json`에 밝힌다.

## 5. 절차

### 함정 (관찰된 실패)

- 지침을 길게 써도 반복 위반은 멈추지 않는다. 멈추게 하는 것은 실패하는 검사다. 검사가 생기면
  산문 규칙을 그 검사를 가리키는 한 줄로 바꾼다.
- 평범한 코드가 우회할 수 있는 검사는 강제가 아니다. 캐스트, 날것의 생성자, ORM hydration,
  역직렬화, 테스트 팩토리가 흔한 뒷문이다.
- 위반의 이름만 대는 오류 메시지는 피해 가게 된다. 규칙, 그 규칙이 있는 이유, 대신 쓸 정확한
  방법을 말한다.
- 기존 위반이 남은 채 규칙을 더하면 검사가 빨갛게 되고, 빨간 검사는 꺼진다. 기존 위반은 같은
  변경에서 고치거나 명시적으로 baseline으로 남긴다.

### 단계

1. **대응 말하기**: "이 코드 모양은 이 독자에게 이 의도를 말한다". 코드베이스에서 준수 예 하나와
   위반 예 하나를 찾는다.
2. **모든 경로 나열하기.** 다스리는 값이나 효과를 만들거나 바꿀 수 있는 경로를 위의 뒷문까지
   포함해 모두 적는다.
3. **모든 경로에서 위반을 잡는 가장 약한 강도 고르기.** 위반이 비싸거나, 멀리서 일어나거나,
   되돌릴 수 없으면 더 강하게:

   | 강도 | 예 | 잡는 것 |
   | --- | --- | --- |
   | Signal | 이름, 주석, 모듈 배치 | 없음. 알리기만 한다 |
   | Localize | 한 모듈이 그 연산을 소유 | 그 모듈 밖의 위반, 리뷰로 |
   | Static check | 타입, lint 규칙, 검사 명령 안의 스크립트 grep | 빌드나 CI 시점의 위반 |
   | Restricted construction | branded·opaque 타입, private 생성자, 정제된 타입을 돌려주는 파서 | 하류 어디서든 잘못된 값 |
   | Runtime rejection | 경계의 assertion이나 검증 | 실행 시점의 잘못된 입력 |
   | Exclusive ownership | 한 서비스나 테이블 제약이 그 효과를 수행 | 동시·원격 위반 |

4. **프로젝트의 기존 도구로 구현하기**(그 프로젝트의 linter, 타입 시스템, 테스트 러너, CI나
   pre-commit hook). 메시지는 규칙, 이유, 대신 쓸 방법 순으로 쓴다.
5. **기존 위반 처리하기**: 같은 변경에서 고치거나, 검사가 읽는 명시적 baseline을 기록한다.
6. **증명하기**: 위반 표본은 그 메시지와 함께 실패하고, 준수 표본은 통과하고, 검사가 프로젝트의
   표준 검사 명령에서 실행된다.
7. **지침 갱신하기**: 규칙이 `AGENTS.md`, `CLAUDE.md`, 기여 안내에서 왔으면 그 산문을 검사를
   가리키는 한 줄로 바꾼다.

## 6. 권장 전략

없음. 한 실행에서 위임 없이 끝낸다.

## 7. 지식

지식 파일, 스크립트, assets는 없다. 강도 표는 5절 3단계에 있다.

출처: OpenAI, "Harness engineering"(고치는 방법을 오류 메시지에 담은 custom lint, 규칙을 코드로
올리기). Alexis King, "Parse, don't validate"(2019). 이 저장소의 `convention-judgment` Skill과
그 `enforcement-strength` reference(0.2.2).

## 8. 수용 시나리오

각 시나리오는 `scenarios/<id>/`에 있다: `base/`(실행 전 상태), `golden/`(정답 예시),
`hidden/`(실행 뒤에만 더하는 검사 파일), `scenario.yaml`(요청과 판정 기준). 판정 기준은
결정적이다(정규식 일치·불일치, 명령 실행 여부, hidden 명령 통과). 각 구현체는 자기 호스트의 공식
평가기로 모든 시나리오를 같은 ID로 돌린다. 모델 선택은 `triggers.yaml`의 질의로 따로 확인한다.

| ID | 상황 | 해야 할 것 | 하면 안 되는 것 |
| --- | --- | --- | --- |
| money-to-cents | `CONVENTIONS.md`의 "금액은 `toCents()`를 거친 정수 cents로만 계산" 규칙을 `cart.js`, `discount.js`가 어기고 리뷰어가 손으로 잡는 프로젝트 | `npm run check` 추가와 실행, 기존 위반 수정, 새 `line.price * line.qty` 위반을 `toCents`를 말하며 실패, `CONVENTIONS.md`가 `npm run check`를 가리킴 | 의존성 추가(예: ESLint), 두 함수만 좁게 테스트해 새 위반을 놓치기, "forbidden pattern"만 말하는 메시지 |
