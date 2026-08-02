# @hobin/observer

[English](./README.md) | 한국어

Pi로 조사하며 얻은 근거를 현재 session에 모아 두었다가, 사용자가 직접 검토한
Markdown 묶음만 로컬 notebook에 저장하는 sidecar입니다.

Observer는 모든 tool result를 저장하지 않고, 작업 중에 note file을 계속 쓰지도
않습니다. Working evidence는 현재 Pi branch에 남고, 사용자가 정확한 proposal을
확인해 전체 batch를 승인해야 notebook file이 바뀝니다.

## 설치

Pi 0.80.10–0.83.x와 Node.js 22.19 이상이 필요합니다.

```sh
pi install npm:@hobin/observer
```

설치하지 않고 한 번만 써 보려면:

```sh
pi -e npm:@hobin/observer
```

## 먼저 해보기

Workbench를 엽니다.

```text
/observer
```

**Settings**에서 local Notebook folder를 고르고 Observer를 켭니다. 그 뒤에는
Pi와 평소처럼 작업하면 됩니다.

정리할 자료가 모이면:

```text
/observer memo
/observer review
```

`review`는 어떤 파일을 만들거나 고칠지, diff가 무엇인지, 최종 Markdown이
무엇인지 준비해서 보여 줍니다. 이 단계에서는 파일을 쓰지 않습니다. **Proposal**을
살핀 뒤 **Save all**을 눌러야 실제로 저장합니다.

## Observer를 켜 두면 일어나는 일

1. `/observer on`이 선택한 Notebook을 다시 확인하고, 필요하면 새 Episode를 연
   뒤 continuous observation mode를 켭니다.
2. 현재 agent run에서 성공한 Pi tool result가 후보가 됩니다. 아직 저장되지는
   않습니다.
3. 그 결과가 inquiry를 실제로 지지하거나, 반박하거나, 좁히거나, 적용 범위를
   바꾼다고 모델이 판단하면 exact tool-call ID를 지명할 수 있습니다.
4. Observer는 provenance와 원문에 충실한 요약을 담은 `SourceRead`를 기록하고,
   exact Source/Inquiry ID에 연결된 observation을 기록합니다.
5. 이 기록은 현재 Pi session branch에만 남습니다.
6. `/observer memo`가 현재 근거를 working Memo로 정리합니다. 여전히 Notebook
   file은 쓰지 않습니다.
7. `/observer review`가 완전한 Notebook proposal을 만듭니다.
8. 사용자가 승인하면 전체 batch를 stage하고, publish하고, 다시 읽어 확인한 뒤
   Episode를 끝냅니다.

이 표현들이 branch event, typed relation, staged commit, publication transaction으로
이어지는 원리는 [Observer의 동작 원리](./docs/ko/how-it-works.md)에 설명합니다.

## 탐구를 시작하는 세 가지 방법

| 방법 | 쓸 때 | 명령 |
| --- | --- | --- |
| Continuous Sidecar | 평소 Pi 작업 중 중요한 근거가 나올 수 있을 때 | `/observer on` |
| 사용자 가설 | 사용자의 원래 문장을 보존하고 그 질문으로 현재 근거를 볼 때 | `/observer add-hypothesis <text>` |
| 한정된 자료 검토 | Sidecar mode를 바꾸지 않고 제공하거나 가져온 자료 하나를 검토할 때 | `/observer material <request>` |

세 방법 모두 같은 Episode, Memo, Review, Save 처리를 사용합니다.

## Session state와 Notebook file

| 위치 | 들어 있는 것 | 바뀌는 때 |
| --- | --- | --- |
| 현재 Pi branch | Candidate, SourceRead, observation, hypothesis, working Memo, proposal state | Observer 작업 중 |
| Local Notebook | Source, Inquiry, Memo, Zettel Markdown record | 전체 batch를 승인하고 readback까지 성공한 뒤 |

Observer를 꺼도 continuous model observation만 멈춥니다. 열린 Episode와 working
evidence는 그대로 남습니다.

## 처리 방식

| Mode | 동작 |
| --- | --- |
| `piggyback` | 이미 실행 중인 foreground Pi turn 사용. 별도 inference request 없음 |
| `local` | 사용자가 고른 loopback model에서 한 번에 job 하나 실행 |
| `off` | Coordination state는 유지하지만 model interpretation은 하지 않음 |

Piggyback은 기존 turn의 context token을 늘릴 수 있습니다. Local mode의 queue는
memory에만 있으며 daemon이 아닙니다.

## 주요 명령

| 명령 | 하는 일 |
| --- | --- |
| `/observer` | Workbench 열기 |
| `/observer setup <ko\|en> <path>` | Notebook 초기화 또는 선택 |
| `/observer on` / `/observer off` | Continuous observation 켜기/끄기 |
| `/observer add-hypothesis <text>` | 사용자 가설을 원문 그대로 보존하고 검토 |
| `/observer material <request>` | 한정된 material review 시작 |
| `/observer material retry` / `cancel` | Pending request 재개 또는 취소 |
| `/observer memo` | Working evidence를 Memo로 정리 |
| `/observer review` | 저장 proposal 준비 |
| `/observer save` | 준비된 proposal 확인과 명시적 승인 |
| `/observer status` | Notebook, Episode, processing, recovery 상태 확인 |

`ko`와 `en`은 새로 저장하는 record의 언어를 고릅니다. Workbench UI 언어를
바꾸지는 않습니다. Observer가 Notebook 경로를 임의로 고르는 일도 없습니다.

## 파일을 안전하게 저장하는 과정

저장은 전체 batch가 한꺼번에 성공해야 하는 transaction입니다.

```text
최종 Markdown과 전체 graph 준비
-> 사용자에게 exact batch 표시
-> 해당 proposal ID의 전체 저장 승인
-> 현재 target byte 재확인
-> 모든 record stage
-> 모든 record publish
-> 최종 Notebook을 다시 읽고 검증
-> SaveCommitted 기록
```

Target이 바뀌었거나, Markdown이나 graph가 잘못됐거나, proposal이 오래됐거나,
readback이 다르면 완료 처리하지 않습니다. 안전하게 되돌릴 수 있는 known write는
rollback하고, 다른 process가 바꾼 byte를 덮어쓸 수 있다면 복구가 필요하다고
알립니다.

## 문서

- [Observer의 동작 원리](./docs/ko/how-it-works.md) — branch replay, capture
  window, typed relation, staged commit, publication transaction
- [사용자 가이드](./docs/ko/user-guide.md) — setup, command, recovery
- [Notebook 저장](./docs/ko/notebook-publication.md) — record 규칙과 save transaction

## 하지 않는 일

Observer는 Git sync, backup, remote sharing, vector database, model truth,
crash-proof daemon, 여러 process의 동시 Notebook 쓰기를 제공하지 않습니다.

## 개발

```sh
pnpm --filter @hobin/observer check
pnpm --filter @hobin/observer eval
pi -e ./packages/observer
```

## 라이선스

[MIT](./LICENSE)
