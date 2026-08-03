# Developer 사용자 가이드

[English](../user-guide.md) | 한국어

## 켜고 끄기

```text
/developer on
/developer off
```

`on`은 Developer v8 work scope를 열고 protocol-aware built-in tool gating을 켭니다.
변경 승인이 active이면 `off`는 scope를 닫지 않습니다. 그 외에는 active Skill
invocation을 lifecycle cancellation으로 settle하고 scope를 닫습니다. 저장된
`developer.runtime` entry는 Pi session branch에 남습니다.

처음부터 켤 수도 있습니다.

```sh
pi --developer
```

## 평소처럼 요청하기

Route나 Skill identifier를 몰라도 됩니다.

```text
예약 청구서 발송을 추가해 줘. 구현 전에 빠진 제품 규칙이 있으면 먼저 물어봐.
```

```text
Serializer 교체 뒤 test는 통과해. 저장된 값과 source compatibility까지 확인됐는지
검증해 줘.
```

질문을 맡을 capability를 직접 부를 수도 있습니다.

```text
/skill:model 이 config 변경의 replacement와 default 의미를 정리해 줘.
/skill:sketch 승인된 요구사항의 interface를 잡아 줘.
/skill:verify 현재 검사가 완료 주장을 지지하는지 판단해 줘.
```

## 명령

| 명령 | 하는 일 |
| --- | --- |
| `/developer` | TUI에서 간결한 progress overlay 열기. `d`를 누르면 audit receipt 표시 |
| `/developer status` | 현재 phase, 끝난 milestone, 다음 사용자 관련 단계 보기 |
| `/developer questions` | Receipt 요약을 보는 호환 alias |
| `/developer settings` | Receipt 요약을 보는 호환 alias |
| `/developer on` | Work scope 열기 |
| `/developer off` | 활성 승인이 없을 때 현재 scope 닫기 |

Pi의 일반 `/skill:<name>` 명령도 그대로 사용할 수 있습니다.

## Progress와 audit overlay

Overlay는 읽기 전용입니다. 기본 progress view는 hash, opaque ID, receipt inventory 없이
현재 phase, 끝난 milestone, 다음 사용자 관련 단계를 보여 줍니다. `d`를 누르면 audit
mode로 들어갑니다. Audit mode는 열 때 current였던 exact receipt projection에 묶이며 한
번에 bounded page 하나만 읽습니다.

| 키 | 동작 |
| --- | --- |
| `d` | Progress와 audit detail 전환 |
| `↓`, Page Down, Enter | Audit mode에서 opaque cursor로 다음 page 읽기 |
| `↑`, Page Up | Audit mode에서 exact previous cursor로 돌아가기 |
| `g` | Audit mode에서 첫 page로 돌아가기 |
| `r` | Progress refresh 또는 audit cursor 다시 읽기 |
| `y` | 현재 semantic view 복사 |
| Escape | 닫기 |

Audit mode가 열린 동안 projection이 바뀌면 refresh하거나 다시 열어 새 projection을
묶으세요. 화면 높이 때문에 receipt가 생략되면 생략 사실과 수를 명시합니다. 이동과
복사는 runtime event를 append하지 않습니다.

## Frame 진행 방식

```text
stable RouteDefinition
-> exact RouteFrame과 obligations
-> finite descriptor snapshot
-> 선택적 owning Skill invocation
-> returned candidate support
-> 명시적 frame-local admission
-> 명시적 obligation discharge
-> guarded frame conclusion
```

어떤 Route든 첫 movement나 마지막 movement가 될 수 있습니다. 고정된
`specify -> model -> sketch -> verify` pipeline은 없습니다. 현재 admit된 non-Skill
support가 충분하면 Skill을 호출하지 않고도 frame을 끝낼 수 있습니다.

답이나 근거가 빠졌으면 frame이 열린 채로 남거나 target blocker를 기록합니다.
Developer는 absence를 approval로 바꾸지 않습니다. 답이나 근거를 얻은 뒤 current
frame과 blocker identity에 맞춰 결론을 냅니다.

## 구현과 검증

변경 승인은 replay-current concluded frame 하나와 한정된 movement 하나에만
유효합니다. 이 승인 전까지 built-in shell, edit, write는 닫혀 있습니다. Developer는
승인 시 Git baseline을 잡고 landing의 reported path가 관찰한 authorized delta와 정확히
일치해야만 허용합니다. Landing을 기록하면 authority를 소모하고 서로 다른 follow-up
identity 두 개를 만듭니다.

- `reroute-decision` frame은 다음에 할 일을 결정합니다.
- `verification-decision` frame은 landing 근거가 지지하는 claim을 결정합니다.

Model continuation마다 required purpose를 알려 주며, runtime은 순서를 벗어난 purpose를
거부합니다. 두 debt가 모두 끝나야 다음 승인을 만들 수 있습니다. 통과한 command는
실제로 실행한 claim의 근거일 뿐입니다.

## Branch, replay, reload

Fork는 자기 ancestry만 사용합니다. Timestamp가 아니라 scope sequence와 hash chain
identity가 runtime event 순서를 정합니다. 거부된 entry는 replay state를 전진시키지
않습니다.

Developer는 replay-accepted event에서만 receipt를 만듭니다. Cursor, page,
publication, reconstruction value, mutation capability는 process-local이며 clone되거나
stale이면 fail closed합니다.

Hot reload가 safe lifecycle marker로 이전 tool ownership을 증명하지 못하면 Developer는
Pi restart를 요구하고 reconciliation event를 쓰지 않습니다. 어떤 tool을 켤지
추측하지 않습니다.

## 업데이트와 제거

```sh
pi update npm:@hobin/developer
pi remove npm:@hobin/developer
```

현재 프로젝트에만 설치하려면 `pi install -l npm:@hobin/developer`를 사용합니다.
