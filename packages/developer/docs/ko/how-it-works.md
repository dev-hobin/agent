# Developer 동작 방식

[English](../how-it-works.md) | 한국어

Developer의 핵심은 “생각한 뒤 수정한다”는 권고가 아닙니다. Pi session에 현재
상태를 기록하고, 그 상태에 맞춰 실제 built-in tool과 다음 protocol operation을
제한합니다.

## 예: checkout에서 선택한 결제 수단이 사라진다

사용자가 다음처럼 요청했다고 가정하겠습니다.

```text
/developer on
뒤로 갔다 checkout으로 돌아오면 선택한 결제 수단이 사라져.
원인을 찾아 고쳐 줘. 제품 규칙이 빠져 있다면 추측하지 마.
```

### 1. 켤 때 현재 branch를 복구한다

`/developer on`을 실행하면 Developer는 현재 Pi branch의 `developer/v7` event를
순서대로 replay합니다. 이전에 진행하던 판단, 미해결 질문, 변경 승인, landing이
있다면 여기서 복구됩니다.

State는 크게 다음 중 하나입니다.

| 상태 | 뜻 |
| --- | --- |
| Idle | 진행 중인 판단이나 변경 승인이 없음 |
| ActiveJudgment | 질문 하나를 조사하는 중 |
| AuthorizedChange | 정해진 범위의 파일 변경을 허용한 상태 |
| NeedsRouting | Landing 뒤 다음 검증이나 판단을 정해야 함 |

Malformed event나 불가능한 순서가 보이면 억지로 복구하지 않고 diagnostic을
남깁니다.

### 2. 질문을 맡을 Skill 하나를 고른다

예제에서 먼저 알아야 할 것은 “선택값을 저장해야 하는가?”라는 제품 규칙일 수도
있고, 이미 규칙은 분명하지만 “어느 경로에서 값이 빠지는가?”라는 근거 문제일 수도
있습니다.

Developer는 현재 핵심 질문을 맡는 Skill 하나로 `ActiveJudgment`를 엽니다.

```text
developer_open_judgment
- skill: specify
- question: checkout을 다시 열었을 때 선택한 결제 수단을 유지해야 하는가?
- known evidence: 현재 요구사항과 재현 조건
```

Skill은 질문을 푸는 방법을 제공합니다. Skill 이름 자체가 결론은 아닙니다.

### 3. 판단 중에는 근거만 찾는다

`ActiveJudgment`가 열리면 `bash`는 사용할 수 있지만 built-in `edit`와 `write`는
닫힙니다. 따라서 모델은 코드 경로, 기존 테스트, runtime behavior를 조사할 수는
있어도 조사 중에 바로 고칠 수는 없습니다.

모델은 현재 branch의 tool result를 exact call ID로 지명합니다. Developer가 call,
arguments, result order, content hash를 다시 확인하므로 다른 branch나 이전 run의
결과를 끼워 넣을 수 없습니다.

외부 Skill이 필요하면 `developer_open_context_sources`로 exact Skill ID만 엽니다.
그 Skill은 조사 방법을 보탤 뿐 현재 질문의 owner가 되지 않습니다.

### 4. 판단을 닫을 때 사용한 근거를 함께 고정한다

`developer_conclude_judgment`는 단순한 요약을 받지 않습니다. 다음을 한 번에
요구합니다.

- 외부 source별 적용 여부
- 실제로 선택한 file, Skill method, tool result, user event
- 각 자료가 질문에 보탠 내용
- 충돌하거나 빠진 근거
- 현재 자료로 가능한 결론
- 새로 생기거나 해결된 `PendingQuestion`

Judgment engine이 선택한 원문을 다시 읽고 hash로 고정한 뒤에만 conclusion event를
만듭니다. 하나라도 stale하거나 contribution이 없으면 event를 append하지 않습니다.

제품 규칙이 실제로 빠져 있다면 user-owned `PendingQuestion`이 남습니다. 모델은
사용자 대신 그 질문에 답할 수 없습니다.

### 5. 질문이 닫혀야 변경을 승인할 수 있다

구현 전에 막는 질문이 없고 필요한 설계가 정해졌다면
`developer_authorize_change`를 사용할 수 있습니다.

```text
movement:
  checkout 복원 시 저장된 paymentMethodId를 form state에 다시 넣는다.
stable landing:
  기존 선택이 보이고, 유효하지 않은 저장값은 기존 fallback을 따른다.
verification target:
  뒤로 갔다 돌아오는 재현 경로와 invalid saved value를 검사한다.
```

이때 `AuthorizedChange`가 생기고 built-in `edit`와 `write`가 열립니다. 승인은
“마음대로 수정해도 된다”가 아니라 적어 둔 movement 하나에만 해당합니다.

이미 요구사항과 변경 범위가 충분히 분명하고 구현 전 질문도 없다면, 불필요한
judgment 없이 바로 이 승인을 만들 수도 있습니다.

### 6. 바꾼 파일을 기록하면 권한이 끝난다

수정을 마치면 `developer_record_landing`에 authorization ID와 실제 changed path를
넘깁니다.

```text
packages/checkout/src/payment-state.ts
packages/checkout/tests/payment-return.test.ts
```

Transition이 이 event를 받으면 `AuthorizedChange`를 지우고 두 obligation을
만듭니다.

- `rerouteRequired`: 다음에 무엇을 판단할지 정해야 함
- `verificationRequired`: 아직 완료를 주장할 수 없음

그래서 landing 뒤에는 변경 도구가 다시 닫힙니다.

### 7. 별도의 verify 판단이 완료 주장을 검사한다

마지막으로 `verify`가 소유한 판단을 엽니다. 이 질문은 “코드가 바뀌었는가?”가
아니라 “현재 test와 runtime observation이 어떤 claim을 실제로 지지하는가?”입니다.

테스트가 통과해도 invalid saved value, source compatibility, sibling branch, 실제
사용자가 거치는 construction path를 보지 않았다면 pass-but-wrong risk로 남깁니다.

검증 결론이 필요한 claim을 지지하고 completion gate가 모두 닫혀야 그 범위에서
완료를 말할 수 있습니다.

## PendingQuestion은 누가 답하는가?

| Owner | 답을 얻는 곳 |
| --- | --- |
| `user` | 사용자의 제품 결정이나 명시적인 수락 |
| `agent` | 저장소, test, runtime, 문서 조사 |
| `environment` | credential, 외부 system 상태, 접근 권한 |

질문에는 gate도 붙습니다. `before implementation`은 변경 승인을 막고,
`before completion`은 landing은 허용하되 완료를 막습니다. `non-blocking`은 계속
보이지만 현재 작업을 멈추지는 않습니다.

## Branch와 tool state

Developer state는 현재 Pi branch의 event에서만 복구합니다. Sibling branch에서
얻은 근거는 현재 판단에 쓸 수 없습니다.

Developer는 자신이 닫거나 연 built-in tool의 차이만 관리합니다. 다른 extension의
tool이나 사용자가 꺼 둔 tool을 임의로 복원하지 않습니다. 안전하게 이전 상태를
알 수 없는 hot reload에서는 추측하지 않고 Pi restart를 요청합니다.
