# @hobin/developer

[English](./README.md) | 한국어

코딩 agent가 자주 한데 섞는 세 가지를 분리하는 Pi 확장입니다. 무엇이 맞는지
판단하는 일, 파일을 바꿀 권한을 받는 일, 바꾼 결과를 검증하는 일을 따로
다룹니다.

## 설치

[Pi](https://pi.dev)와 Node.js 22.19 이상이 필요합니다.

```sh
pi install npm:@hobin/developer
```

설치하지 않고 한 번만 써 보려면:

```sh
pi -e npm:@hobin/developer
```

Pi 안에서 켭니다.

```text
/developer on
```

## 먼저 해보기

평소처럼 변경을 요청하세요.

```text
/developer on
The selected payment method disappears after navigating back to checkout.
Find the cause and fix it, but do not guess at missing product behavior.
```

사용자가 protocol tool을 고를 필요는 없습니다. 현재 상태에서 쓸 수 있는 operation을
Developer가 모델에 알려 줍니다.

## 변경 하나가 진행되는 과정

요청에 제품 규칙 하나가 빠져 있다고 가정해 보겠습니다.

1. Developer가 `specify`처럼 그 질문을 맡는 Skill로 판단을 하나 엽니다.
2. 판단이 열려 있는 동안 Pi는 파일을 읽고 검사를 실행할 수 있지만, built-in
   `edit`와 `write`는 사용할 수 없습니다.
3. 판단을 마치면서 질문을 해결하거나, 더 필요한 근거 또는 사용자 답변을 정확히
   기록합니다.
4. 구현 전에 해결해야 할 질문이 모두 닫히면 Developer가 `AuthorizedChange`를
   만듭니다. 여기에는 허용할 변경과 안정된 결과의 모습이 적혀 있습니다.
5. 그 변경을 수행하는 동안에만 built-in 변경 도구가 열립니다.
6. 모델이 실제로 바뀐 경로를 `ImplementationLanding`으로 기록합니다.
7. Landing을 기록하는 즉시 변경 권한은 사라지고 검증 의무가 생깁니다.
8. 별도의 `verify` 판단이 테스트와 관찰 결과가 실제로 무엇을 입증하는지
   확인합니다.

따라서 landing은 “이 승인 아래 이 파일들이 바뀌었다”는 기록이지 “작업 완료”라는
표시가 아닙니다.

전체 예시는 [Developer 동작 방식](./docs/ko/how-it-works.md)에서 볼 수 있습니다.

## 도구가 열리는 때

| 현재 상태 | `bash` | Built-in `edit` / `write` |
| --- | --- | --- |
| Developer가 켜졌지만 idle | 요청에서 이미 알려진 범위만 조사 | 닫힘 |
| 판단 진행 중 | 근거를 찾는 데 사용 가능 | 닫힘 |
| 변경 승인됨 | 사용 가능 | 승인한 변경 범위에서 사용 가능 |
| Landing 기록됨 | 다음 판단에 필요한 만큼만 사용 | 다시 닫힘 |

이 기능은 작업 순서를 지키게 하는 장치이지 운영체제 sandbox가 아닙니다. Shell
command와 다른 extension은 여전히 Pi 프로세스 권한으로 실행됩니다.

## Skills

Developer에는 질문을 하나씩 맡는 Skill 열 개가 들어 있습니다. Pi가 요청에 맞는
Skill을 고르거나 `/skill:<name>`으로 직접 부를 수 있습니다.

| Skill | 맡는 질문 |
| --- | --- |
| `doctor` | 정해진 기존 코드 범위에서 지금 고칠 것, 나중에 볼 것, 관찰할 것, 그대로 둘 것은 무엇인가? |
| `specify` | 제품 요구사항의 정확한 뜻은 무엇인가? |
| `model` | 어떤 case, rule, state, contract, 금지 조건이 있는가? |
| `sketch` | 어떤 data, interface, owner, collaboration이 필요한가? |
| `signal` | 단순한 유사성이 아니라 실제 구조적 압력이 보이는가? |
| `naming-judgment` | 도메인 의미를 보존하고 effect를 드러내는 이름은 무엇인가? |
| `abstraction-review` | 구체적인 추상화를 계속 믿고 써도 되는가? |
| `schedule` | 구조 변경을 지금, 나중, 또는 하지 않아야 하는가? |
| `verify` | 현재 근거가 어떤 주장을 지지하는가? |
| `adversarial-eval` | 중요한 주장을 깨뜨릴 수 있는 유한한 반례는 무엇인가? |

이 Skill들은 질문에 따라 고르는 대안입니다. 순서대로 모두 거치는 단계가 아닙니다.

## 외부 Skill을 참고할 때

진행 중인 Developer 판단에서 다른 Pi 패키지의 Skill을 참고할 수 있습니다.
Developer는 먼저 이름과 설명처럼 가벼운 목록만 보여 줍니다. 모델이 exact Skill
ID를 고르면 그 `SKILL.md`와 선택적 정책 파일만 엽니다.

외부 Skill은 현재 판단에 방법이나 점검 기준을 보탤 뿐입니다. 질문의 owner가
되거나, 별도 판단을 열거나, 파일 변경 권한을 주지는 않습니다.

## 명령

| 명령 | 하는 일 |
| --- | --- |
| `/developer` | 읽기 전용 workbench 열기 |
| `/developer on` | 판단과 변경 권한 제어 켜기 |
| `/developer off` | 남은 작업이 있다면 확인한 뒤 Developer 끄기 |
| `/developer status` | 현재 상태 확인 |
| `/developer questions` | 미해결 질문 확인 또는 답변 |
| `/developer settings` | 활성화 설정 열기 |

Developer를 켠 상태로 Pi를 시작하려면:

```sh
pi --developer
```

## Workbench

`/developer`에서는 진행 중인 판단, 미해결 질문, 끝난 판단, landing, 검증 의무를
볼 수 있습니다. Workbench는 읽기 전용입니다. 열거나 스크롤하거나 복사해도
session event나 파일을 만들지 않습니다.

## 문서

- [Developer 동작 방식](./docs/ko/how-it-works.md) — 질문부터 변경 승인, landing,
  검증까지 이어지는 실제 예
- [사용자 가이드](./docs/ko/user-guide.md) — 명령, 질문, 복구 방법
- [Runtime protocol](./docs/ko/runtime-protocol.md) — maintainer를 위한 정확한
  operation과 replay 규칙

## 개발

```sh
pnpm --filter @hobin/developer check
pnpm --filter @hobin/developer eval
pi -e ./packages/developer
```

## 라이선스

[MIT](./LICENSE)
