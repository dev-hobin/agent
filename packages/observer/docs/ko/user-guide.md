# Observer 사용자 가이드

[English](../user-guide.md) | 한국어

## Notebook 만들기 또는 선택하기

Workbench에서 **Settings**를 열거나 명령을 사용합니다.

```text
/observer setup ko ~/notes/observer
/observer setup en ./notes/observer
```

경로는 다음처럼 해석합니다.

| 입력 | 실제 위치 |
| --- | --- |
| `/absolute/path` | 입력한 경로 그대로 |
| `./notes` 또는 `notes` | 현재 Pi working directory 기준 |
| `~` 또는 `~/notes` | 현재 사용자의 home directory 기준 |
| `~other-user/notes` | 추측하지 않고 거부 |

새 폴더를 만들거나 기존 폴더를 선택하기 전에 absolute path를 보여 줍니다. 기존
폴더를 선택해도 Observer와 관계없는 파일은 건드리지 않습니다.

`ko`와 `en`은 앞으로 새로 저장할 Memo와 Zettel의 언어입니다. Workbench UI나
기존 record의 언어는 바뀌지 않습니다.

## Workbench

```text
/observer
```

| 화면 | 볼 수 있는 것 |
| --- | --- |
| Overview | Notebook 상태, mode, Episode, 다음 동작 |
| Activity | SourceRead, observation, material review, hypothesis review |
| Inquiries | 사용자가 적은 원문과 현재 hypothesis, evidence |
| Memos | Working Memo 전문과 연결 관계 |
| Proposal | 저장 준비 상태, existing/diff/final Markdown |
| Notebook | 이미 저장된 record와 원문 |
| Settings | Notebook, language, processing mode |

주요 키:

| 키 | 동작 |
| --- | --- |
| `↑` / `↓`, `j` / `k` | 항목 이동 |
| Enter | 항목 보기 또는 현재 동작 실행 |
| Escape | 이전 화면 |
| Tab | 영역 사이 이동 |
| Page Up / Page Down | 스크롤 |
| Home / End | 처음 또는 끝 |
| `y` | 선택한 record 전체 복사 |
| `?` | 도움말 |

기록을 열고 스크롤하고 복사하는 것은 읽기 전용입니다.

## 평소 작업에서 근거 모으기

```text
/observer on
```

그 뒤에는 Pi를 평소처럼 사용합니다. Observer는 현재 agent run의 tool result를
후보로만 들고 있다가, 모델이 inquiry에 실제로 중요하다고 지명한 result만
SourceRead와 observation으로 기록합니다.

```text
/observer off
```

`off`는 새 continuous observation을 멈춥니다. 열린 Episode, SourceRead, Memo는
지우지 않습니다.

## 사용자 가설에서 시작하기

```text
/observer add-hypothesis 기록 시점이 해석의 편향을 바꾼다.
Context: 앞의 두 사례는 note를 늦게 적은 뒤에만 결과가 달라졌다.
```

첫 줄은 사용자의 원문으로 보존합니다. `Context:`는 참고 맥락으로 따로 남습니다.
Observer는 현재 자료에서 지지하는 단서, 반대 단서, 빠진 정보, 해석 범위를
정리합니다. 근거가 부족하다고 판단해도 원문을 고쳐 쓰지 않습니다.

## 자료 하나만 따로 검토하기

```text
/observer material <inline text, file path, URL, or retrieval request>
```

Sidecar가 꺼져 있어도 쓸 수 있습니다. File이나 URL을 넘기면 Pi가 자료를 가져온
뒤, 그 request를 처리한 exact agent run의 result만 후보로 사용합니다. Command
문장 자체를 source content로 취급하지 않습니다.

처리가 중간에 멈췄다면:

```text
/observer material retry
/observer material cancel
```

`retry`는 같은 request를 한 번 더 처리합니다. `cancel`은 request만 끝내고
Episode와 Sidecar mode는 그대로 둡니다.

## Memo 만들기

```text
/observer memo
```

현재 SourceRead, observation, hypothesis, working Memo와 명시적으로 관련된 기존
Notebook record를 한꺼번에 비교합니다. Memo를 새로 만들거나, 고치거나, 합치거나,
그대로 둘 수 있습니다.

이 단계는 Pi session의 working state만 바꿉니다. Notebook file은 쓰지 않습니다.

## Review와 Save

```text
/observer review
```

남은 Memo 작업이 있으면 먼저 끝냅니다. 그 다음 저장할 record마다 다음을
보여 주는 proposal을 만듭니다.

- 새 파일인지 update인지
- target path
- 기존 Markdown
- line diff
- 최종 Markdown
- 현재 validation error

준비가 끝나도 아직 파일은 바뀌지 않습니다.

Proposal에서 `s`를 누르거나 `/observer save`를 실행하면 승인 화면이 열립니다.
선택지는 세 가지입니다.

- **Back**: proposal을 그대로 두고 나가기
- **Return to Review**: proposal만 버리고 working state는 유지
- **Save all N records**: 현재 proposal의 전체 batch 저장

Default approval과 일부 record만 저장하는 기능은 없습니다.

## Processing mode

```text
/observer processing piggyback
/observer processing local
/observer processing off
```

- `piggyback`: 현재 Pi model turn에서 처리
- `local`: 사용자가 고른 loopback model의 in-memory queue에서 처리
- `off`: request와 candidate state는 유지하고 model interpretation은 멈춤

Local mode는 endpoint가 실제로 `localhost`, `127.0.0.0/8`, `::1`인지 확인합니다.
가격 metadata에 local이라고 적혀 있는지는 믿지 않습니다.

## 상태 확인과 복구

```text
/observer status
```

| 상태 | 할 일 |
| --- | --- |
| Material request suspended | `material retry` 또는 `material cancel` |
| Proposal ready | Proposal 내용을 확인한 뒤 Save |
| Target drift로 proposal invalid | Review로 돌아가 현재 파일 기준으로 다시 준비 |
| Episode 중 Notebook 이동 또는 교체 | 원래 Notebook을 복구하거나 현재 작업을 정리한 뒤 다른 Notebook 선택 |
| Local processing paused | 일반 Pi work를 끝내거나 processing mode 변경 |
| Malformed branch history | Diagnostic을 보존하고 강제로 state를 바꾸지 않음 |

## 업데이트와 제거

```sh
pi update npm:@hobin/observer
pi remove npm:@hobin/observer
```

현재 프로젝트에만 설치하려면 `pi install -l npm:@hobin/observer`를 사용합니다.
