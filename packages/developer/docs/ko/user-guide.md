# Developer 사용자 가이드

[English](../user-guide.md) | 한국어

## 켜고 끄기

```text
/developer on
/developer off
```

`on`은 판단 기록과 built-in 변경 도구 제어를 켭니다. 진행 중인 판단이나 미해결
질문이 있는 상태에서 `off`를 실행하면 정리하기 전에 확인합니다. 과거 event는 Pi
session branch에 그대로 남습니다.

처음부터 켠 상태로 Pi를 실행할 수도 있습니다.

```sh
pi --developer
```

## 요청하는 법

내부 Skill이나 protocol 이름을 몰라도 됩니다.

```text
예약 청구서 발송을 추가해 줘. 구현 전에 빠진 제품 규칙이 있으면 먼저 물어봐.
```

```text
Serializer 교체 뒤 test는 통과해. 저장된 값과 source compatibility까지 실제로
확인됐는지 검증해 줘.
```

질문을 맡을 Skill을 이미 알고 있다면 직접 부를 수 있습니다.

```text
/skill:model 이 config 변경에서 값 교체와 default의 의미를 정리해 줘.
/skill:sketch 승인된 요구사항을 구현할 interface를 잡아 줘.
/skill:verify 지금 검사 결과가 완료 주장을 지지하는지 판단해 줘.
```

## 명령

| 명령 | 하는 일 |
| --- | --- |
| `/developer` | Workbench 열기 |
| `/developer status` | 현재 상태와 다음에 가능한 동작 확인 |
| `/developer questions` | 미해결 질문을 읽고 답하거나 조사 |
| `/developer settings` | 활성화 설정 열기 |
| `/developer on` | Developer 켜기 |
| `/developer off` | 확인 후 Developer 끄기 |

Pi의 일반 `/skill:<name>` 명령도 그대로 쓸 수 있습니다.

## Workbench에서 보는 것

| 화면 | 내용 |
| --- | --- |
| Overview | 현재 상태, 구현·완료 gate, 다음 operation |
| Active Judgment | 현재 질문, 사용한 자료, contribution, conflict, limitation |
| Questions | user, agent, environment가 각각 답해야 할 질문 |
| Judgments | 끝난 판단과 그때 고정한 context basis |
| Landings | 변경 승인, 실제 changed path, verification target |
| Settings | Developer 활성화 |

키 조작:

| 키 | 동작 |
| --- | --- |
| `↑` / `↓`, `j` / `k` | 항목 이동 |
| Enter | 선택한 항목 열기 |
| Escape | 이전 화면으로 돌아가기 |
| Tab | 영역 사이 이동 |
| Page Up / Page Down | 한 화면씩 스크롤 |
| Home / End | 처음 또는 끝으로 이동 |
| `y` | 선택한 record 전체 복사 |
| `?` | 현재 화면 도움말 |

Workbench를 열고 읽고 복사하는 일은 state를 바꾸지 않습니다.

## 질문은 누가 답하나요?

`/developer questions`에서 질문의 owner와 gate를 확인할 수 있습니다.

| Owner | 예 |
| --- | --- |
| User | “뒤로 갔다 돌아와도 선택값을 유지해야 하나?” |
| Agent | “이 값은 어느 코드 경로에서 사라지나?” |
| Environment | “Staging credential로 이 API를 관찰할 수 있나?” |

모델은 user-owned question에 사용자를 대신해 답할 수 없습니다. Agent-owned
question은 repository나 runtime을 조사해 해결합니다. Environment-owned question은
접근 권한이나 외부 상태가 필요할 수 있습니다.

Gate의 의미:

- `before implementation`: 답을 얻기 전에는 변경 승인 불가
- `before completion`: 수정은 가능해도 완료 주장 불가
- `non-blocking`: 계속 보이지만 현재 작업은 진행 가능

## 자주 쓰는 흐름

### 제품 규칙이 모호한 bug

```text
현재 동작 재현
-> 빠진 제품 규칙을 user question으로 기록
-> 사용자 답변
-> 변경 범위 승인
-> 수정과 test
-> landing 기록
-> verify
```

### 이미 정확히 정해진 작은 변경

요구사항, 바꿀 위치, 검사 방법이 모두 분명하면 판단을 억지로 열지 않습니다.
Developer는 바로 제한된 변경을 승인하고, landing 뒤에 그 claim만 검증합니다.

### 파일을 바꾸지 않는 Doctor review

```text
/skill:doctor checkout request부터 persistence까지 범위를 진단해 줘.
외부 behavior는 바꾸지 말고 now / next / observe / leave-alone plan만 만들어 줘.
```

Doctor는 실제로 확인한 범위와 최종 주장의 범위를 구분합니다. 일부 sample을 전체
저장소 review처럼 말하지 않습니다.

## 현재 상태가 뜻하는 것

| 상태 | 다음에 필요한 일 |
| --- | --- |
| `idle` | 활성 작업 없음. 전체 요청 완료를 뜻하지는 않음 |
| `needs-judgment` | 현재 질문의 결론 필요 |
| `needs-evidence` | Agent 또는 environment 근거 필요 |
| `needs-answer` | 사용자 답변 필요 |
| `needs-routing` | Landing 뒤 다음 판단 결정 필요 |
| `needs-verification` | 변경 결과의 claim-relative 검증 필요 |
| `blocked` | 필요한 답, 근거, 접근을 현재 얻을 수 없음 |

## Branch와 reload

Fork한 branch는 자기 ancestry만 사용합니다. 다른 branch의 tool result나 사용자
답변은 현재 판단 자료로 선택할 수 없습니다.

Pi가 session을 compact해도 Developer는 필요한 상태를 제한된 context로 다시
제공합니다. Hot reload 뒤 이전 tool state를 안전하게 알 수 없다는 경고가 나오면
Pi를 재시작하세요. Developer는 임의로 tool을 켜지 않습니다.

## 업데이트와 제거

```sh
pi update npm:@hobin/developer
pi remove npm:@hobin/developer
```

현재 프로젝트에만 설치하려면 `pi install -l npm:@hobin/developer`를 사용합니다.
