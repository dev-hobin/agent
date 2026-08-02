# Judgment 동작 방식

[English](../how-it-works.md) | 한국어

Judgment는 결론을 대신 내려 주는 모델이 아닙니다. 호출자가 내린 결론이 **어떤
질문과 어떤 원문에 기대고 있는지** 프로그램으로 확인하게 해 주는 엔진입니다.

## 예: 캐시 변경을 완료했다고 말해도 되는가?

어떤 Pi 확장이 다음 질문을 확인한다고 가정해 보겠습니다.

> 새 캐시 구현이 기존 저장값과 재시작 동작을 그대로 보존하는가?

후보 자료는 다음과 같습니다.

- 변경 요구사항이 적힌 context file
- 캐시 관련 Skill의 method
- 해당 Skill에 포함된 호환성 점검 자료
- 현재 branch에서 실행한 테스트 결과
- 사용자가 승인한 migration 방침

Judgment는 이 자료를 모두 읽지 않습니다. 호출자가 보여 준 목록에서 모델이 정확한
ID를 골라야 실제 원문을 읽습니다.

## 1. 질문을 연다

`ContextAttempt.open()`은 한 질문의 처리 상태를 만듭니다. 이때 질문은 다음과
묶입니다.

- 질문을 소유한 기능
- 그 기능의 정책 hash(정책이 있다면)
- 현재 Pi branch
- 이미 알고 있는 근거의 ID

같은 문장이라도 owner나 branch가 다르면 다른 질문입니다. 여기서
`questionSha256`이 정해집니다.

```ts
const opened = ContextAttempt.open({
  question,
  applicability,
});
const attempt = opened.value;
```

`ContextAttempt`는 내부 상태와 그 상태를 만든 event를 함께 돌려줍니다. 호출자는 이
event를 자신의 세션 형식에 넣어도 되고, 최종 결과만 보관해도 됩니다.

## 2. 쓸 수 있는 자료를 목록으로 만든다

호출자는 `ContextInventory`를 만듭니다. 여기에는 아직 참고 문서의 본문이 아니라
다음과 같은 가벼운 설명만 들어갑니다.

- Skill 이름과 위치
- context file의 현재 identity
- 적용이 확인된 정책에 딸린 참고 자료
- 현재 branch에서 다시 찾을 수 있는 도구 결과와 사용자 event

외부 Skill에 정책이 있다면 먼저 정책 내용을 모델에 보여 주고 적용 여부를 받아야
합니다. `not-applicable` 또는 `needs-context`인 Skill의 method와 참고 자료는 긍정적
근거 후보가 될 수 없습니다.

## 3. 지명된 자료만 읽고 한꺼번에 고정한다

모델은 자료의 exact ID를 지명합니다. `selectAndSeal()`은 두 작업을 한 번에
처리합니다.

1. ID가 현재 inventory와 branch에 실제로 있는지 확인합니다.
2. 각 자료를 다시 읽어 byte, content hash, provenance를 고정합니다.

```ts
const sealed = await attempt.selectAndSeal({
  inventory,
  observedContext,
  proposal,
  admittedPolicySha256s,
  acquisition,
});
```

다음 중 하나라도 생기면 결과를 만들지 않습니다.

- 선택한 파일이 사라지거나 내용이 바뀜
- 다른 branch의 도구 결과를 지명함
- 읽기 결과가 error 또는 truncated 상태임
- 참고 자료가 허용된 root 밖으로 빠져나감
- UTF-8이 아니거나 크기 제한을 넘음
- 작업이 취소됨

즉 “선택은 기록됐지만 원문은 못 읽은 상태”가 남지 않습니다. 모든 자료를 읽고
봉인한 상태만 반환하거나, 호출 전 상태를 그대로 둔 채 실패합니다.

## 4. 자료마다 실제 쓰임을 적는다

원문을 읽었다는 사실만으로는 근거가 되지 않습니다. `assessCoverage()`에 넘기는
proposal은 선택한 자료마다 다음을 적어야 합니다.

- `constraint`: 가능한 결론이나 실행 범위를 제한함
- `evidence`: 사실 주장을 지지하거나 반박함
- `decision`: 해당 owner가 내린 결정을 기록함
- `method`: 조사 순서를 정함
- `guidance`: 놓치기 쉬운 구분이나 반례를 추가함

예를 들면 다음처럼 구체적이어야 합니다.

```text
테스트 결과 test-42는 재시작 뒤 기존 key를 읽을 수 있음을 보여 준다.
하지만 이전 버전이 쓴 TTL 값의 단위 호환성은 검사하지 않았다.
```

“유용했다”, “참고했다”처럼 결과에 어떤 영향을 주었는지 알 수 없는 문장은
거부됩니다. 사용 가능한 선택 자료에는 적어도 하나의 기여가 있어야 합니다.

## 5. 확인 수준을 넘겨 쓰지 않는다

Judgment는 세 수준을 구분합니다.

| 수준 | 뜻 |
| --- | --- |
| `agent-asserted` | 모델이 선택한 원문을 읽고 해석함 |
| `domain-verified` | 이름이 정해진 evaluator가 특정 관계를 확인함 |
| `user-accepted` | 현재 branch의 정확한 사용자 event가 결정을 담고 있음 |

테스트 결과를 모델이 읽었다고 해서 `domain-verified`가 되지는 않습니다. 사용자
승인도 제품 결정을 확정할 수는 있지만 테스트를 통과시키지는 못합니다.

## 6. 커버리지 안에서만 결론을 만든다

`conclude()`는 방금 만든 contribution, conflict, limitation ID만 인용할 수
있습니다. 결과는 세 가지 형태 중 하나입니다.

- 현재 자료로 답할 수 있는 contextual judgment
- 무엇이 더 필요한지 정확히 적은 needs-evidence 결과
- 조사 중 드러난 별개의 emergent question

앞의 캐시 예라면 “재시작 호환성은 확인됐지만 TTL 단위 호환성은 확인되지 않아
완료를 주장할 수 없다”가 needs-evidence 결과가 됩니다.

## 호출자가 받는 것

완료된 attempt에는 다음 값이 있습니다.

```text
question
selection
sealedContext
coverage
outcome
```

각 값은 바로 앞 단계의 identity를 포함합니다. 저장한 값을 다시 읽을 때 payload로
hash를 재계산하므로, hash 문자열만 바꾸거나 예전 결론에 새 자료를 끼워 넣을 수
없습니다.

## Judgment가 보장하지 않는 것

Judgment가 확인하는 것은 “이 결론이 이 자료와 이 관계에 묶여 있다”는 사실입니다.
다음은 확인하지 않습니다.

- 출처가 거짓말하지 않는가?
- 모델의 해석이 옳은가?
- 이 결론으로 코드를 바꿔도 되는가?
- 패키지가 운영체제 권한 안에서 안전한가?

이 판단과 권한은 Judgment를 사용하는 adapter가 따로 다뤄야 합니다.
