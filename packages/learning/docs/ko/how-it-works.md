# Learning의 동작 원리

[English](../how-it-works.md) | 한국어

Learning은 완전한 Agent Skills의 모음이지, 학습 진도를 추적하는 service나
runtime이 아닙니다. 선택적인 Pi 선택기와 표준 method 원본은 분리되어 있습니다.

## 1. 표준 소비 단위는 Skill 디렉터리 전체다

```text
skills/<name>/
├─ SKILL.md          -> 완전한 method와 생성된 선택 지침
├─ judgment.json     -> 개발용 원본, 필수 호스트 정책 API가 아님
└─ references/*.md   -> 조건부 보강 자료
```

호스트는 metadata를 발견하고 선택된 `SKILL.md`를 로드합니다. 에이전트는 일반
도구로 method를 따르고, 필요할 때 supporting file을 읽습니다. 상대경로는 현재
작업 디렉터리가 아니라 소유 Skill 디렉터리를 기준으로 합니다. Learning 전용
loader나 controller는 필요하지 않습니다.

상위 형식은 Agent Skills입니다. `judgment.json`의 어휘, generated section, 실질적
관련성 규칙은 저장소의 자체 규약이지 추가 표준 필드나 호스트 API가 아닙니다.

## 2. Method는 prompt-time 실행 계약이다

각 Skill은 독립적으로 다음을 정의합니다.

- 중심 질문과 받아들이는 요청
- Source 범위, 조사 순서, 필요한 구분
- 근거가 부족하거나 다른 질문이 중요해질 때의 처리
- 완전한 결과와 종료 조건

참고 자료를 하나도 읽지 않아도 core method는 완전해야 합니다. 이전 Learning
Skill이나 TypeScript controller가 있어야 시작할 수 있는 구조가 아닙니다.

| Skill | 소유하는 중심 질문 |
| --- | --- |
| `technical-reading` | Source가 실제로 무엇을 주장하고, 보여 주고, 제한하는가? |
| `opensource-reading` | Exact public code slice가 어떤 contract와 tradeoff를 구현하는가? |
| `conceptualize` | Source 표현을 제거해도 유지되는 개념은 무엇인가? |
| `patternize` | 사례의 반복이 언제 재사용 가능한 routine이 되는가? |
| `exercise` | 어떤 관찰 가능한 수행이 쓸 수 있는 이해를 보여 주는가? |

Technical reading은 의미 있는 원문의 표현과 순서를 보존하지만, conceptualize는
출처의 어휘를 제거해 transfer를 시험합니다. 자동 phase로 묶으면 서로 다른
완료 조건을 훼손합니다.

## 3. 개발용 JSON은 실행 전에 표준 Markdown으로 생성된다

Package-local parser와 renderer가 `judgment.json`을 `SKILL.md`의
`## Context Directions`로 생성합니다.

```sh
node packages/learning/scripts/write-context-directions.mjs
```

설치된 policy service가 JSON을 해석하지 않습니다. 모델은 생성된 Markdown을 일반
Skill 지침으로 봅니다. 검사는 authoring source와 generated section을 byte 단위로
비교하고, reference의 누락과 파일 존재를 확인합니다. 정책만 바꾸고 생성하지 않으면
개발 검사가 실패합니다.

## 4. 참고 자료는 조건부 보강 자료다

후보 method는 root `when` 중 하나 이상이 적용되고, 어떤 `unless`에도 해당하지
않아야 합니다. 제외 조건이 우선합니다. 적용 가능한 method에서는 다음을 따릅니다.

1. Core method로 실제 source를 먼저 살펴봅니다.
2. 결과에 중요한 구분, 반례, 검사가 빠져 있는지 확인합니다.
3. 독립적인 조건이 맞고 결과를 바꿀 reference만 읽습니다.
4. Source가 이미 제공하는 내용은 다시 읽지 않습니다.

Zero, one, many가 모두 정상입니다. Reference가 늘어도 본문을 모두 주입하지
않습니다. 이 규칙은 모델을 위한 지침이지 선택기나 표준 runtime이 강제하는
접근 제어가 아닙니다.

## 5. Package 전체의 lifecycle이나 저장 service가 없다

Learning은 phase, 완료율, 필수 다음 Skill, 공통 artifact schema, 기본 Notebook,
숨은 cross-Skill state를 저장하지 않습니다. 결과를 사용자에게 보이는 명시적인
입력으로 연결할 수 있지만 자동 handoff는 없습니다.

Method는 기본적으로 대화에서 완전한 결과를 만들고, 사용자가 저장을 요청하고
target을 정하거나 승인했을 때만 쓰도록 지시합니다. 다음 세 층을 구분합니다.

- Pi 선택기는 구조적으로 editor text만 바꾸며 state를 저장하지 않음
- Skill method는 모델에게 저장 경계를 지키도록 지시함
- 호스트가 자기 권한으로 실제 file tool을 실행함

Learning은 운영체제 수준의 write sandbox나 artifact writer가 아닙니다.

## 6. Pi 연동은 선택 사항이다

`package.json`은 Skill과 선택기를 독립적인 resource로 노출합니다.

```text
pi.skills      -> skills/
pi.extensions  -> adapters/pi/learning.ts
```

Discovery와 `/skill:<name>` 호출은 Pi의 기본 loader가 맡습니다. 어댑터는
`/learning`만 등록하고 catalog를 복제하거나 model prompt를 조립하지 않습니다.
선택기를 열지 않아도 Skill을 직접 호출할 수 있습니다.

선택기는 인자나 TUI 선택을 다섯 이름 중 하나로 해석하고 `prepareLearningSkill()`을
호출합니다. 기존 Learning prefix만 교체하고 나머지 초안은 보존합니다.

```text
변경 전: 이 RFC의 state-transition 실패를 설명해 줘.
변경 후: /skill:technical-reading 이 RFC의 state-transition 실패를 설명해 줘.
```

Model request, source read, 자동 전송은 없습니다. 사용자가 검토하고 전송해야
합니다. `/learning technical-reading`도 선택기만 건너뛰며 이 전송 경계를 바꾸지
않습니다. 다른 호스트가 같은 UI를 재현할 필요는 없습니다.

## 7. 검증의 소유권도 구분한다

- 루트 `pnpm check:portable`은 고정한 공식 reference validator와 자체 resource
  검사를 실행하고, adapter나 package manifest 없이 packed/relocated Skill을 확인합니다.
- Package `check:portable`은 독립 catalog, authoring directions, 경로와 제거된
  공통 runtime artifact의 부재를 확인합니다.
- Package `check:pi`는 Pi discovery, 선택기 연결, editor 동작과 provider-free
  어댑터 검사를 담당합니다. Pi RPC 평가 driver는 호스트별 개발 도구이지 표준
  method의 의존성이 아닙니다.

이 검사는 학습 결과의 의미적 품질이나 모델의 올바른 선택을 증명하지 않습니다.
실모델 평가는 기본 검사 밖의 선택적인 호스트별 근거입니다. Validator 통과가
미래의 모든 서비스 지원을 증명하지는 않습니다.
