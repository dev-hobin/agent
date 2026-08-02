# Judgment의 동작 원리

[English](../how-it-works.md) | 한국어

이 문서는 CLI 사용법이 아니라 Judgment가 **어떤 값을 만들고, 다음 단계로 무엇을
넘기며, 잘못된 결론 구성을 어디서 막는지** 설명합니다.

Judgment의 기본 원리는 간단합니다. 모델이 낸 긴 설명을 곧바로 결론으로 저장하지
않고, 질문과 원문과 쓰임을 단계별로 더 강한 값으로 바꿉니다. 뒤 단계는 앞 단계의
검사를 통과한 값만 받습니다.

```text
raw policy
→ owner에 묶인 compiled policy
→ 현재 질문의 identity
→ exact context selection
→ 원문 byte가 고정된 sealed context
→ 자료별 contribution과 assurance
→ coverage 안에서만 만든 outcome
```

## 1. 검사를 따로 기억하지 않고, 검사된 값을 만든다

Judgment parser는 raw JSON을 확인한 뒤 원래 객체를 그대로 돌려주지 않습니다.
정규화하고 중복을 제거하고 허용되지 않은 필드를 거부한 다음, 이후 코드가 믿을 수
있는 immutable value를 새로 만듭니다.

이 방식 때문에 다음과 같은 중간 상태가 없습니다.

- “검사는 했지만 아직 raw object인 정책”
- “파일 ID는 골랐지만 실제 원문은 읽지 않은 선택”
- “근거를 읽었지만 결론에 어떻게 썼는지 모르는 coverage”
- “예전 coverage를 가리키면서 새 자료를 주장하는 outcome”

`judgment.json`이 없는 것은 정상입니다. 파일이 실제로 존재하는데 malformed라면
그 provider만 실패합니다. JSON 안에는 owner가 없습니다. 어떤 기능의 정책인지
정하는 권한은 항상 호출자가 가진 `PolicyOwner`에 있습니다.

## 2. 질문은 문장 하나가 아니라 현재 판단 조건 전체다

`DynamicJudgmentQuestion`은 질문 문장 외에도 다음을 함께 묶습니다.

- 질문을 맡은 owner
- 적용되는 owner policy의 identity
- 이미 알려진 basis material
- 현재 Pi branch identity
- 질문을 다시 찾을 수 있는 caller metadata

따라서 문장이 같아도 owner나 branch가 다르면 다른 질문입니다. 이 전체 payload에서
`questionSha256`을 계산합니다. Hash는 질문이 참인지 증명하지 않고, 나중에 같은
질문을 다루고 있는지 확인합니다.

## 3. 후보 발견과 원문 획득을 분리한다

처음 만드는 `ContextInventory`에는 보통 원문 전체가 아니라 descriptor만 들어갑니다.
Skill 이름, source ID, policy identity, reference path, branch-local tool-call ID처럼
“다시 찾을 수 있는 후보”를 싼 비용으로 보여 주기 위한 값입니다.

모델이 exact ID를 지명한 뒤에야 acquisition callback이 원문을 읽습니다. 이 분리에는
세 가지 이유가 있습니다.

1. 설치된 Skill과 reference를 전부 읽어 context를 오염시키지 않습니다.
2. 모델이 무엇을 골랐는지 선택 기록을 남길 수 있습니다.
3. 선택 시점의 descriptor와 실제로 읽은 byte가 같은 source인지 다시 확인할 수
   있습니다.

외부 provider에 정책이 있으면 method와 policy 내용을 먼저 보여 주고 적용 여부를
정합니다. Root `unless`가 맞으면 `when`이 맞아도 제외됩니다. `applicable`이
확인된 provider만 method나 reference를 긍정적인 contribution으로 낼 수 있습니다.
`needs-context`는 적용된 것으로 추측하지 않습니다.

## 4. 선택과 봉인을 하나의 원자적 전이로 처리한다

`selectAndSeal()`은 selection event를 먼저 남기고 나중에 파일을 읽는 함수가
아닙니다. Exact ID 확인, branch 확인, 원문 재획득, hash 계산, provenance 고정을 모두
마친 뒤 selection과 sealed context를 함께 반환합니다.

다음 중 하나라도 실패하면 새 transition value가 나오지 않습니다.

- 선택한 descriptor, policy 또는 원문이 바뀜
- tool result가 다른 branch나 다른 run에 속함
- 결과가 error 또는 truncated 상태임
- 파일이 provider의 lexical root나 실제 filesystem root를 벗어남
- symlink가 허용된 root 밖을 가리킴
- UTF-8 또는 byte limit을 만족하지 못함
- batch acquisition이 취소됨

여러 provider를 한 질문에 써도 각 provider는 자기 policy identity와 contained reader를
가집니다. 한 provider의 reference path를 다른 provider root에서 해석하지 않습니다.
Batch 일부만 성공한 sealed context도 만들지 않습니다.

## 5. Identity chain이 무엇이 오래됐는지 결정한다

각 단계의 identity는 앞 단계 payload와 이번 단계 payload를 함께 canonicalize해서
만듭니다.

```text
owner + normalized policy                    → policySha256
owner + policy + question + basis + branch   → questionSha256
question + admitted policies + selected IDs  → selectionSha256
selection + exact acquired bytes             → sealedContextSha256
sealed members + contributions + gaps        → coverageSha256
question + coverage + cited relation IDs      → outcomeSha256
```

Inventory에 관계없는 후보가 하나 추가됐다고 이미 봉인한 작업이 stale해지지는
않습니다. 반대로 선택한 descriptor, policy, content, question 또는 branch가 달라지면
그 차이에 의존하는 뒤 단계는 다시 만들어야 합니다.

저장된 값을 replay할 때 parser는 payload에서 hash를 다시 계산합니다. 저장소에서 hash
문자열만 바꾸거나, 옛 outcome에 새 coverage를 끼워 넣는 방식은 통과하지 못합니다.

## 6. 자료 자체가 아니라 질문과 자료 사이의 관계가 근거다

같은 파일도 질문에 따라 역할이 달라집니다. 그래서 source kind만 보고 “이것은
근거”, “이것은 방법”이라고 고정하지 않습니다. `assessCoverage()`는 선택한
material마다 현재 질문에 대한 relation을 요구합니다.

| `useAs` | 현재 질문에서 하는 일 |
| --- | --- |
| `constraint` | 허용되는 결론이나 실행 범위를 제한 |
| `evidence` | 사실 주장을 지지하거나 반박 |
| `decision` | 그 결정을 내릴 권한이 있는 owner의 선택을 기록 |
| `method` | 조사 순서나 비교 방법을 제공 |
| `guidance` | 빠진 구분, 반례, 점검 기준을 추가 |

Contribution은 “참고했다”가 아니라 결과에 생긴 차이를 적어야 합니다. 예를 들어
“재시작 뒤 기존 key를 읽는 테스트는 통과했지만, 이전 버전 TTL 단위는 검사하지
않았다”처럼 주장과 한계를 함께 특정해야 합니다.

선택됐지만 쓸 수 있는 contribution이 하나도 없는 material은 coverage를 완성할 수
없습니다. 반대로 패키지에 준비된 reference라고 해서 반드시 선택하거나 authoritative
source로 취급하지도 않습니다.

## 7. Assurance는 provenance가 허용하는 만큼만 올라간다

Judgment는 contribution 내용과 그 내용을 얼마나 강하게 말할 수 있는지를 분리합니다.

| Assurance | 성립 조건 |
| --- | --- |
| `agent-asserted` | 모델이 exact sealed content를 읽고 해석함 |
| `domain-verified` | 이름이 정해진 evaluator가 특정 relation을 확인함 |
| `user-accepted` | 현재 branch의 exact user event가 사용자 소유 결정을 담고 있음 |

테스트 출력 문자열을 모델이 읽었다고 자동으로 `domain-verified`가 되지 않습니다.
사용자가 제품 결정을 받아들였다고 테스트 성공이 되지도 않습니다. Error, truncation,
unsealed prose, stale result는 긍정적인 assurance를 만들 수 없습니다.

## 8. Outcome은 현재 coverage 밖의 말을 할 수 없다

`conclude()`는 현재 coverage에 들어 있는 contribution, conflict, limitation ID만
인용할 수 있습니다. 그래서 결론 문장에 새 근거를 슬쩍 추가하려면 먼저 selection과
coverage를 다시 만들어야 합니다.

Outcome은 보통 다음 중 하나입니다.

- 현재 coverage가 지지하는 contextual judgment
- 아직 필요한 자료와 이유를 특정한 `needs-evidence`
- 조사 중 분리해서 다뤄야 한다고 드러난 emergent question

예를 들어 캐시 변경에서 재시작 테스트만 봉인했다면 “재시작 뒤 key를 읽을 수
있다”는 좁은 결론은 가능하지만 “이전 저장 형식 전체와 호환된다”는 결론은 만들 수
없습니다. TTL 단위가 검사되지 않았다는 limitation이 coverage에 남기 때문입니다.

## 9. `ContextAttempt`는 이 원리를 순서대로 쓰게 하는 facade다

Core value와 transition은 독립 함수로 사용할 수 있습니다. `ContextAttempt`는
adapter가 올바른 순서를 쉽게 지키도록 다음 상태 이동을 감싼 편의 계층입니다.

| 호출 | 만드는 값 |
| --- | --- |
| `open` | question과 시작 event |
| `recordApplicability` | 현재 owner/provider의 적용 상태 |
| `selectAndSeal` | exact selection과 sealed context |
| `assessCoverage` | contributions, conflicts, limitations |
| `conclude` | coverage에 묶인 outcome |

반환되는 `.events`는 Judgment 내부 전이 사실입니다. Pi session 형식은 아닙니다.
호출자는 이 event를 자기 protocol 안에 넣거나, 필요한 identity만 자기 domain record에
저장할 수 있습니다.

## 10. 엔진과 호출자의 책임 경계

Judgment가 맡는 것은 parsing, policy compilation, question identity, selection,
sealing, coverage, outcome 구성입니다. 다음은 의도적으로 호출자에게 남깁니다.

- 어떤 후보를 발견해서 inventory에 넣을지
- 어떤 UI와 tool로 모델 또는 사용자에게 물을지
- event와 결과를 어디에 저장할지
- evaluator가 실제로 어떤 검사를 수행할지
- outcome이 코드 변경이나 제품 결정을 허용하는지

즉 Judgment는 “결론이 exact material과 명시적인 relation에 묶였다”는 구조를
보장합니다. Source의 진실성, 모델 해석의 정확성, domain 권한까지 대신 보장하지는
않습니다.
