# @hobin/developer

[English](./README.md) | 한국어

의미 판단, 파일 변경 권한, claim-relative 검증을 서로 분리하는 Pi extension입니다.

## 설치

[Pi](https://pi.dev)와 Node.js 22.19 이상이 필요합니다.

```sh
pi install npm:@hobin/developer
```

한 번만 실행해 볼 수도 있습니다.

```sh
pi -e npm:@hobin/developer
```

Pi 안에서 켭니다.

```text
/developer on
```

## 먼저 이렇게 써 보세요

평소처럼 변경을 요청합니다.

```text
/developer on
결제 수단을 고른 뒤 checkout으로 돌아오면 선택이 사라져.
빠진 제품 동작을 추측하지 말고 원인을 찾아 고쳐 줘.
```

Developer가 runtime turn을 소유합니다. 안정된 `RouteDefinition` 하나를 선택해 정확한
`RouteFrame`을 열고, 필요하면 owning Skill을 0개 또는 1개 호출합니다. 다른 Skill은
context 자료일 뿐이며, 이름이 Route와 같다는 이유로 권한을 얻지 않습니다.

## 변경 중 일어나는 일

1. 현재 의미 obligation을 위한 frame을 엽니다.
2. 현재 admit된 support만으로 끝내거나, 유한 routing snapshot에서 owning Skill 하나를
   호출할 수 있습니다.
3. Skill output은 frame이 명시적으로 admit하기 전까지 candidate입니다.
4. Frame을 끝내려면 모든 obligation의 명시적 discharge와 현재 stop evidence가
   필요합니다.
5. 끝난 frame은 한정된 구현 movement 하나를 승인할 수 있습니다.
6. 모델이 실제 changed path를 landing 하나로 기록합니다.
7. Landing은 변경 권한을 소모하고 reroute debt와 verification debt를 따로 만듭니다.
8. 이후 frame이 두 debt를 독립적으로 해소합니다.

Landing은 “이 경로가 이 승인 아래 바뀌었다”는 뜻이지 “작업 완료”가 아닙니다.
판단은 부정적인 결론으로도 resolve될 수 있으며, resolve는 approval이 아닙니다.

Routing, replay, admission, authorization, receipt projection은
[Developer 동작 원리](./docs/ko/how-it-works.md)를 보세요.

## 도구 접근

| 현재 runtime 상태 | `bash` | Built-in `edit` / `write` |
| --- | --- | --- |
| 켜졌지만 열린 frame 없음 | 닫힘 | 닫힘 |
| 의미 frame 열림 | 근거 수집에 사용 가능 | 닫힘 |
| Replay-current 변경 승인 | 사용 가능 | 한정된 movement에 사용 가능 |
| Landing debt 존재 | 다음 frame을 열기 전까지 닫힘 | 닫힘 |

이 제어는 workflow gate이지 운영체제 sandbox가 아닙니다. Shell command와 third-party
extension은 Pi process 권한을 그대로 가집니다.

## Skills

Developer에는 독립적인 Skill 열 개가 있습니다. 현재 질문을 실제로 소유하는
capability만 선택하며, `/skill:<name>`으로 직접 호출할 수도 있습니다.

| Skill | 맡는 질문 |
| --- | --- |
| `doctor` | 한정된 기존 코드 범위에서 지금, 나중, 관찰, 유지할 일은 무엇인가? |
| `specify` | 제품 요구사항은 정확히 무엇을 뜻하는가? |
| `model` | 어떤 case, rule, state, contract, forbidden condition이 있는가? |
| `sketch` | 어떤 data, interface, ownership, collaboration이 필요한가? |
| `signal` | 단순 유사성이 아니라 관찰 가능한 구조 압력이 있는가? |
| `naming-judgment` | 어떤 이름이 domain 의미와 effect를 정확히 드러내는가? |
| `abstraction-review` | 구체 abstraction을 유지할 만큼 안정적인가? |
| `schedule` | 구체 구조 변경을 지금, 나중, 또는 전혀 하지 않아야 하는가? |
| `verify` | 현재 근거가 어떤 claim을 지지하는가? |
| `adversarial-eval` | 중요한 claim을 반증할 유한 counterexample은 무엇인가? |

이 Skill들은 필수 단계가 아니라 서로 다른 collaborator입니다.

## 명령

| 명령 | 하는 일 |
| --- | --- |
| `/developer` | TUI에서 exact-current 읽기 전용 receipt overlay 열기 |
| `/developer on` | Developer v8 work scope 열기 |
| `/developer off` | 활성 변경 승인이 없을 때 scope 닫기 |
| `/developer status` | 현재 receipt projection 요약 보기 |
| `/developer questions` | 같은 receipt 요약을 보는 호환 alias |
| `/developer settings` | 같은 receipt 요약을 보는 호환 alias |

처음부터 켠 상태로 실행할 수도 있습니다.

```sh
pi --developer
```

## Receipt observer

Overlay는 exact current projection에서 검증한 page 하나만 읽습니다. Opaque page
cursor로 이동하고, 첫 page로 돌아가고, refresh·copy·close할 수 있습니다. Routing,
settlement, admission, discharge, conclusion, authorization, persistence, publication은
할 수 없습니다. 열린 동안 projection이 바뀌면 overlay를 다시 여세요.

## 문서

- [Developer 동작 원리](./docs/ko/how-it-works.md) — runtime ownership, routing,
  contribution admission, authorization, replay
- [사용자 가이드](./docs/ko/user-guide.md) — 명령, receipt 이동, 복구
- [Runtime protocol](./docs/ko/runtime-protocol.md) — v8 envelope, event, replay,
  result summary, receipt projection

## 개발

```sh
pnpm --filter @hobin/developer check
pnpm --filter @hobin/developer eval
pi -e ./packages/developer
```

## 라이선스

[MIT](./LICENSE)
