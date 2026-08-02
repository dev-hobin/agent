# Developer의 동작 원리

[English](../how-it-works.md) | 한국어

이 문서는 명령을 어떤 순서로 입력하는지보다 Developer가 **현재 상태를 어떻게
복구하고, 그 상태에서 가능한 다음 operation과 built-in tool을 어떻게 계산하며,
판단 결과와 변경 권한을 왜 분리하는지** 설명합니다.

핵심은 다음 두 처리선을 섞지 않는 것입니다.

```text
판단선: 질문 → 근거 선택·봉인 → contribution coverage → 결론
변경선: bounded authorization → 파일 변경 → landing → verification debt
```

판단선의 결론은 변경선의 권한이 아닙니다. 두 선을 잇는 유일한 값은 Developer가
별도로 만든 `AuthorizedChange`입니다.

## 1. 현재 상태의 원본은 mutable singleton이 아니라 branch event다

Developer가 상태를 직접 저장해 두고 명령마다 조금씩 고치는 방식은 쓰지 않습니다.
Pi가 현재 branch ancestry에서 돌려준 `developer/v7` entry를 순서대로 읽고, 각 entry를
정확한 event variant로 parse한 뒤 pure `transitionDeveloper()`에 적용합니다.

`DeveloperState`는 replay 결과로 만들어지는 immutable projection입니다.

```text
enabled
+ activeWork: ActiveJudgment | AuthorizedChange | none
+ completed judgments
+ completed landings
+ pending questions
+ focused question
+ obligations:
    rerouteRequired
    implementationFramingRequired
    verificationRequired
```

Raw tool input은 먼저 protocol value로 parse됩니다. Transition이 거부한 event는 Pi
session에 append하지 않습니다. 따라서 “session에는 기록됐지만 state machine이
설명할 수 없는 새 event”를 정상 경로에서 만들 수 없습니다.

Replay 중 malformed v7 entry나 불가능한 전이를 만나면 그 지점에서 이후 Developer
entry 해석을 멈추고 diagnostic을 남깁니다. 과거 v6 entry는 보존하지만 v7로 추측해서
재해석하지 않습니다.

## 2. 상태는 다음 operation과 도구 접근으로 투영된다

Extension이 상황마다 tool을 임의로 켜고 끄는 것이 아닙니다.
`developerNextOperations(state)`와 `developerToolAccess(state)`가 현재 immutable
state에서 가능한 protocol operation과 built-in capability를 계산합니다.

| 현재 projection | 가능한 protocol operation | `bash` | built-in `edit`·`write` |
| --- | --- | --- | --- |
| Disabled | 없음 | Pi 원래 상태 | Pi 원래 상태 |
| Enabled, active work 없음 | 판단 열기, gate가 없으면 변경 승인 | 닫힘 | 닫힘 |
| `ActiveJudgment` | 외부 context 열기, 판단 결론 내기 | 열림 | 닫힘 |
| `AuthorizedChange` | landing 기록 | 열림 | 열림 |
| Landing 뒤 obligation만 있음 | 다음 판단 열기 | 닫힘 | 닫힘 |

Tool policy는 source가 `builtin`인 `bash`, `edit`, `write`만 제어합니다. 같은 이름을 쓴
다른 extension tool은 built-in으로 오인하지 않습니다. Developer가 실제로 닫았던
built-in 목록만 memory에 보관했다가 해제할 때 복구하므로, 사용자가 원래 꺼 둔 tool을
마음대로 켜지 않습니다.

이 장치는 Pi 수준의 workflow gate이지 운영체제 sandbox가 아닙니다. 판단 중 열린
`bash`도 shell command에 따라 파일을 바꿀 수 있고, 다른 extension은 별도 권한을
가집니다. Developer가 강제하는 범위는 자신이 소유한 protocol operation과 세 built-in
tool의 활성 상태입니다.

## 3. 한 번에 active work는 하나뿐이다

`activeWork`에는 `ActiveJudgment` 또는 `AuthorizedChange` 하나만 들어갑니다. 둘이
겹치거나 같은 work ID를 다시 쓰면 transition이 거부됩니다.

이 제한은 “생각하면서 조금 고치고, 고친 결과를 다시 근거라고 부르는” 순환을 막기
위한 것입니다. 질문을 조사하는 동안에는 mutation authority가 없고, 변경 권한이
열린 뒤에는 그 authorization을 landing으로 소비하기 전까지 새 판단을 겹쳐 열 수
없습니다.

다만 모든 작업에 판단을 의무화하지는 않습니다. 요구사항, 변경 범위, 안정된 결과,
검증 target이 이미 분명하고 blocking question이 없다면 idle state에서 바로
`AuthorizedChange`를 만들 수 있습니다.

## 4. Skill은 질문의 owner이고, 작업 단계 이름이 아니다

`developer_open_judgment`는 현재 질문을 가장 잘 맡는 Skill 하나를 owner로 정합니다.
예를 들어 `specify`는 제품 의미, `model`은 조건 공간, `sketch`는 구현 surface,
`verify`는 근거와 claim의 관계를 맡습니다.

Skill 선택은 결론도, 고정된 phase도 아닙니다. 현재 질문 하나에 적용할 method를
고르는 일입니다. 그래서 `specify → model → sketch → verify`를 항상 순서대로 거치지
않습니다.

질문에 다른 Skill의 방법이 도움이 되면 `developer_open_context_sources`가 Pi에 이미
보이는 exact Skill ID만 엽니다. 외부 Skill은 provider로서 method, 선택적 policy,
reference를 보탤 뿐입니다.

- 현재 질문의 owner는 바뀌지 않습니다.
- 별도 Judgment workflow를 만들지 않습니다.
- Provider의 파일 root와 policy identity는 서로 섞이지 않습니다.
- 그 Skill이 적용되는지 확인되기 전에는 긍정적 contribution을 낼 수 없습니다.
- 외부 Skill 결과만으로 변경 권한이 생기지 않습니다.

## 5. Developer는 Judgment를 내부 근거 엔진으로 사용한다

`ActiveJudgment`가 열리면 Developer는 현재 branch에서 다시 찾을 수 있는 자료만
inventory에 넣습니다. Context file, bundled Skill method, 지명한 외부 Skill, tool
result, user event가 후보가 될 수 있습니다.

모델은 exact source ID를 골라야 합니다. Developer는 tool call의 ID, arguments,
result order, status, branch, content hash를 다시 확인합니다. Judgment engine은 선택한
material을 재획득해 한 번에 봉인하고, 각 material의 contribution, conflict,
limitation, assurance를 검사합니다.

결론이 만들어지면 Developer는 다음 identity를 `DeveloperContextBasis`로 압축해
`judgment-concluded` event에 넣습니다.

- Judgment/question와 owner policy identity
- 열린 외부 source의 descriptor, policy, applicability identity
- selection과 sealed content identity
- material contribution, conflict, limitation
- coverage와 outcome identity

Context basis는 모든 원문 byte의 복사본이 아니라, 어떤 exact content와 relation에서
결론이 나왔는지 replay할 수 있게 묶은 domain record입니다. Active judgment가 약속한
basis와 conclusion basis가 다르면 transition이 거부됩니다.

## 6. PendingQuestion은 모호함을 상태로 남기는 방법이다

근거가 부족하다고 prose에만 적으면 다음 operation이 그 부족함을 잊을 수 있습니다.
Developer는 해결되지 않은 내용을 `PendingQuestion`으로 만들고 두 속성을 붙입니다.

| 속성 | 값 | 의미 |
| --- | --- | --- |
| `owner` | `user` | 제품 결정이나 명시적 수락이 필요 |
| | `agent` | 저장소, test, runtime, 문서 조사가 필요 |
| | `environment` | credential, 외부 system, 접근 권한이 필요 |
| `gate` | `before-implementation` | 변경 승인을 막음 |
| | `before-completion` | landing은 허용하지만 완료를 막음 |
| | `none` | 계속 보이지만 현재 작업은 막지 않음 |

결론 event는 질문을 create, answer, block, reopen할 수 있지만 exact question ID와 현재
work ID가 맞아야 합니다. 모델은 user-owned question을 agent evidence로 닫을 수
없습니다.

## 7. Obligation은 명령 code가 아니라 transition에서 파생된다

Developer는 다음 일을 prose 관례로만 두지 않고 state obligation으로 남깁니다.

- `model` 판단이 condition space를 확정하면 `implementationFramingRequired`가 켜집니다.
- `sketch` 또는 `signal`의 유효한 결론이 그 framing obligation을 해제할 수 있습니다.
- Landing은 항상 `rerouteRequired`와 `verificationRequired`를 켭니다.
- `verify`의 contextual judgment가 끝나고 gated PendingQuestion이 없을 때만
  `verificationRequired`가 해제됩니다.

이 규칙 때문에 문제를 잘 모델링했다는 사실만으로 바로 수정할 수 없습니다. 모델에서
구현 representation으로 넘어가는 판단이 한 번 더 필요할 수 있습니다. 반대로 이미
구현 framing이 명확하다면 불필요한 Skill을 추가로 요구하지 않습니다.

## 8. Authorization은 정확히 한 movement를 허용하는 capability다

`developer_authorize_change`는 다음 내용을 하나의 immutable value로 만듭니다.

- 무엇을 바꿀지 나타내는 bounded movement
- 변경 뒤 안정적으로 보여야 할 landing
- 무엇으로 확인할지 나타내는 verification target
- 필요하다면 revert 또는 refinement boundary
- 어떤 PendingQuestion을 위한 변경인지 나타내는 target

Transition은 active work가 없는지, before-implementation gate가 닫혔는지,
implementation framing obligation이 없는지, target question이 유효한지 확인합니다.
통과하면 그때만 built-in `edit`와 `write`가 열립니다.

Authorization은 repository 전체에 대한 권한이 아닙니다. Tool 자체는 path-level
sandbox를 제공하지 않으므로, 모델과 adapter는 실제 변경이 적어 둔 movement 안에
있는지 landing과 후속 검증에서 다시 확인해야 합니다.

## 9. Landing은 authorization을 소비하고 검증 빚을 만든다

`developer_record_landing`은 현재 authorization ID와 실제 changed paths를 받습니다.
ID가 active authorization과 다르거나 authorization이 없으면 거부합니다.

정상 landing이 기록되면 transition은 동시에 다음을 수행합니다.

1. `activeWork`에서 authorization을 제거합니다.
2. authorization과 landing을 completed pair로 보관합니다.
3. `rerouteRequired`를 켭니다.
4. `verificationRequired`를 켭니다.
5. mutation tool projection을 다시 닫습니다.

그래서 landing은 완료 event가 아닙니다. “이 authorization 아래 이 파일들이
바뀌었다”는 provenance event이고, 그 변경이 목표를 만족한다는 claim은 아직
미검증 상태입니다.

## 10. Verify는 구현과 별개의 claim 판단이다

Landing 뒤 새 `ActiveJudgment`를 열 때 `verify`는 “코드가 존재하는가?”가 아니라
“현재 test, diagnostics, runtime observation이 어떤 claim을 실제로 지지하는가?”를
묻습니다.

예를 들어 checkout 복원 버그를 고쳤더라도 다음은 따로 확인해야 합니다.

| Claim | 필요한 근거 예 |
| --- | --- |
| 돌아온 화면에서 유효한 선택이 복원됨 | 실제 navigation path를 거치는 test 또는 관찰 |
| 잘못된 저장값이 기존 fallback을 따름 | invalid value case |
| 다른 branch 결과를 쓰지 않음 | current-branch source identity |
| 변경하지 않은 경로가 깨지지 않음 | 관련 회귀 검사 |

테스트 command가 성공했다는 사실만으로 이 claim 전부가 성립하지 않습니다. Verify
결론과 gated question 상태가 필요한 범위를 지지할 때만 verification obligation이
사라집니다.

## 11. Hot reload에서도 tool ownership을 추측하지 않는다

Runtime은 자신이 어떤 built-in tool을 닫았는지 lifecycle marker와 memory로
추적합니다. Reload 뒤 그 소유 관계를 확실히 복구할 수 없으면 임의로 tool을 켜거나
끄지 않고 Pi restart를 요구합니다.

이 원칙은 보수적이지만, 다른 extension이나 사용자가 만든 tool state를 Developer가
자기 상태로 오인해 덮는 것보다 안전합니다.
