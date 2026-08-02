# Developer runtime protocol

[English](../runtime-protocol.md) | 한국어

이 문서는 `developer/v7` session event나 모델이 호출하는 다섯 operation을 바꾸는
maintainer를 위한 문서입니다. 일반 사용법은 [사용자 가이드](./user-guide.md)를
보세요.

## Protocol을 나눈 이유

Developer는 판단, 파일 변경 권한, landing을 서로 다른 값으로 다룹니다. 모델은
판단 결론 안에 changed path를 끼워 넣거나, judgment ID를 authorization ID 대신
쓸 수 없습니다.

## 다섯 operation

| Operation | 받는 값 | State 변화 |
| --- | --- | --- |
| `developer_open_judgment` | Bundled Skill 하나, 동적 질문 하나, 선택적 target PendingQuestion | `ActiveJudgment` 생성 |
| `developer_open_context_sources` | Active judgment ID와 1–16개 exact Pi-visible Skill source ID | 현재 판단에 atomic source batch 추가 |
| `developer_conclude_judgment` | Applicability, nomination, contribution, coverage, outcome, question update | 끝난 판단을 기록하고 active judgment 제거 |
| `developer_authorize_change` | Bounded movement, stable landing, verification target, 선택적 boundary | `AuthorizedChange` 생성 |
| `developer_record_landing` | Active authorization ID와 non-empty changed path | Landing 기록 후 reroute/verification obligation 생성 |

Pure state는 지금 호출할 수 있는 operation만 노출합니다.

| 현재 상태 | 가능한 operation |
| --- | --- |
| Disabled | Activation command만 |
| Idle | Judgment 열기. 구현 gate가 닫혔을 때만 변경 승인 |
| ActiveJudgment | Context source 열기 또는 판단 끝내기 |
| AuthorizedChange | Landing 기록 |
| Landing 이후 | 다음 판단 열기. Obligation이 허용하기 전에는 새 변경 승인 불가 |

`developerNextOperations`와 `developerToolAccess`가 state에서 이 목록을 계산합니다.
Extension이 별도의 mutable registry를 관리하지 않습니다.

## Judgment 열기

Extension은 현재 Pi inventory에서 Skill을 다시 찾고 method를 읽으며 선택적 policy를
compile합니다. Event에 묶이는 값:

```text
judgmentId
Skill 이름과 정확한 위치
질문 문장
선택적 target PendingQuestion
선택적 compiled policy
현재 branch identity
known evidence
```

`judgment.json`이 없는 Skill도 유효합니다. Prepared reference가 없을 뿐입니다.

## 외부 context source 열기

같은 judgment가 active인 동안 여러 번 호출할 수 있습니다. Source ID마다 다음을
처리합니다.

1. 현재 Pi descriptor에서 다시 찾습니다.
2. Byte limit 안에서 `SKILL.md`를 읽습니다.
3. 옆에 policy가 있으면 읽습니다.
4. 실제 source owner와 root를 사용해 policy를 compile합니다.
5. Descriptor와 method content identity를 계산합니다.

한 번의 call에 든 source는 모두 함께 성공해야 합니다. Duplicate, stale
descriptor, unsafe path, oversized method, malformed present policy가 하나라도 있으면
call 전체를 거부합니다. 이전 call에서 성공한 batch는 그대로 남습니다.

Source를 열었다고 적용되는 것은 아닙니다. 모델이 method와 policy를 본 뒤,
conclusion에서 policy-bearing source마다 applicability 하나를 제출해야 합니다.

## Judgment 끝내기

Model boundary에서 `branchResultId`는 현재 branch의 Pi tool call 하나를 가리키는
짧은 ID입니다. Extension은 Judgment engine에 넘기기 전에 실제 call, arguments,
result order, status, content hash를 다시 찾습니다.

Conclusion은 다음 순서로 만들어집니다.

```text
raw conclusion field parse
-> owning/external Skill descriptor 재검사
-> policy와 branch result 재검사
-> applicable external provider만 허용
-> nominated content를 atomic하게 select/seal
-> usable member마다 contribution 확인
-> coverage와 outcome 생성
-> DeveloperContextBasis 생성
-> pure Developer transition 미리 검사
-> JudgmentConcluded append
```

Acquisition, sealing, coverage, outcome parsing, pure transition 중 하나라도 실패하면
아무 event도 append하지 않습니다.

Conclusion은 `PendingQuestion`을 resolve, defer, supersede하거나 새로 만들 수
있습니다. Question owner, gate, resolution criteria는 현재 state와 맞아야 합니다.
User-owned resolution에 `user-accepted`를 쓰려면 현재 branch의 exact user event가
필요합니다.

## 변경 승인

`developer_authorize_change`는 다음 조건에서만 받습니다.

- Developer가 켜져 있고 active work가 없음
- Target PendingQuestion을 넘겼다면 실제로 존재
- 미해결 before-implementation question 없음
- Reroute와 implementation-framing obligation이 닫힘
- Movement, stable landing, verification target이 비어 있지 않음
- 선택적 refinement 또는 trusted-compiler boundary가 exact variant로 parse됨

Trusted-compiler boundary는 한정된 evidence gap이지 아무 값이나 cast할 권한이
아닙니다.

## Landing 기록

`developer_record_landing`은 exact active authorization과 changed path 하나 이상을
요구합니다. Transition은 authorization과 landing을 함께 저장하고 mutation
authority를 지운 뒤 다음을 설정합니다.

```text
rerouteRequired = true
verificationRequired = true
```

Landing에는 일부러 `verified` flag를 두지 않습니다.

## Replay와 append 순서

Developer는 현재 branch의 custom entry에서 state를 다시 만듭니다.

```text
Developer-owned entry 식별
-> exact event variant parse
-> pure transition 적용
-> accepted state 유지 또는 bounded replay issue 보고
```

Runtime은 parse -> evidence 도출 -> event 생성 -> transition 미리 검사 -> session
entry append -> tool/UI 반영 순서를 지킵니다. Session append가 성공하기 전에 새
state를 공개하지 않습니다.

### 지원하지 않는 v6 history

`developer/v6` entry는 문제를 알리기 위해서만 인식합니다. 이전 route, guidance,
judgment, mutation, landing 값은 현재 권한과 일대일로 맞지 않으므로 v7로 번역하지
않습니다.

## 검토 목록

- Raw variant가 unknown field를 거부하는가?
- 지금 합법적인 operation만 호출할 수 있는가?
- Append 전에 selected file과 branch result를 다시 읽는가?
- Judgment 중에 artifact를 바꿀 수 없는가?
- Landing이 verification debt를 건너뛸 수 없는가?
- External source batch가 all-or-nothing인가?
- Replay가 stale, conflicting, sibling-branch identity를 거부하는가?
- Hot reload가 Developer가 소유한 tool delta만 복원하는가?
