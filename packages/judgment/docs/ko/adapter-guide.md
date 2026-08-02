# Adapter 연결

[English](../adapter-guide.md) | 한국어

Judgment는 자료의 identity와 근거 점검을 맡습니다. 사용자가 실제로 보는 제품은
adapter가 맡습니다. 질문, source 검색, UI, 저장, 도메인 판단, 코드 변경 권한은
adapter의 책임입니다.

## 가장 작은 연결 순서

Stateful adapter라면 보통 다음 순서로 연결합니다.

1. 선택한 기능에서 정확한 owner를 구합니다.
2. 옆에 `judgment.json`이 있으면 읽고 compile합니다.
3. 현재 branch에 대한 질문 하나를 만듭니다.
4. 아직 본문을 읽지 않은 source 목록을 보여 줍니다.
5. 모델이 exact source ID를 고르게 합니다.
6. 고른 자료를 다시 읽어 원문과 hash를 고정합니다.
7. 선택한 자료마다 결론에 보탠 내용을 적게 합니다.
8. 결론과 근거 묶음을 adapter의 기존 protocol에 저장합니다.

사용자에게 범용 Judgment 절차를 하나 더 보여 주지 마세요. Judgment는 원래 작업을
소유한 제품 안에서 쓰는 내부 mechanism입니다.

## 가장 작은 코드 예

```ts
const opened = ContextAttempt.open({
  question: questionValue,
  applicability: applicabilityValue,
});

await opened.value.selectAndSeal({
  inventory,
  observedContext,
  proposal: selectionProposal,
  admittedPolicySha256s,
  acquisition,
});

opened.value.assessCoverage(coverageProposal);
const concluded = opened.value.conclude(outcomeProposal);

persistAdapterEvent({
  questionId: concluded.value.question.judgmentId,
  outcome: concluded.value.outcome,
});
```

호출 전체가 성공한 뒤에만 새 state를 적용하거나 저장해야 합니다.

## 먼저 찾고, 선택된 것만 연다

Pi Skill을 예로 들면 처음부터 모든 `SKILL.md`를 읽지 않습니다. 모델에는 이름,
설명, provenance, exact source ID만 보여 줍니다.

모델이 source를 고른 뒤 제한된 batch를 엽니다.

```text
exact source ID
-> 현재 descriptor에서 다시 찾기
-> 크기를 제한해 SKILL.md 읽기
-> 옆의 정책 파일이 있으면 읽기
-> 실제 owner와 정책 묶기
-> 모델에 method와 정책 보여 주기
-> 이 질문에 적용되는지 source별로 판단
```

정책이 있는 source는 모델이 정책을 본 뒤에만 적용 가능하다고 말할 수 있습니다.
잘못된 정책 하나 때문에 이번 batch가 실패하더라도 이전에 성공해서 연 source까지
지우면 안 됩니다.

## Provider의 root를 섞지 않는다

정책이 있는 provider마다 다음을 따로 보관합니다.

- `CompiledJudgmentPolicy`
- 실제 policy root
- 그 root 안에서만 읽는 reference reader
- 현재 질문에 허용된 reference 목록

두 Skill에 모두 `references/checklist.md`가 있어도 서로 다른 source입니다. Owner,
정책, root, provenance가 다르기 때문입니다. 한 provider의 상대 경로를 다른
provider root에서 해석하면 안 됩니다.

## 관찰 자료는 host에서 다시 찾는다

모델이 “이 tool result가 있다”고 보낸 값을 그대로 믿지 않습니다. 현재 host
state에서 실제 값을 다시 찾아야 합니다.

| 자료 | 다시 확인할 값 |
| --- | --- |
| Tool result | 현재 branch의 call ID, arguments, 순서, 성공 여부, content hash |
| 사용자 결정 | 정확한 branch-local user event |
| Context file | 현재 Pi descriptor와 content identity |
| Domain evaluator 결과 | 정해진 evaluator ID, 검사한 관계, exact basis |

Error나 truncated result는 “근거가 부족하다”는 설명에는 쓸 수 있지만 긍정적인
근거가 될 수는 없습니다.

## Sealing할 때 다시 읽기

`ContextAcquisition` callback은 선택한 뒤 실제 원문을 다시 가져옵니다.

- `acquirePreparedReference`: 해당 정책의 reader로 reference 읽기
- `acquireSkill`: 지명된 Skill method를 다시 확인
- `acquireObservedContext`: 현재 branch 자료를 다시 resolve

선택 전에 cache해 둔 byte가 아니라 sealing 시점의 identity를 돌려줘야 합니다.

## 기여와 확인 수준

결론에서 쓰는 자료마다 질문과의 구체적인 관계가 있어야 합니다. 확인 수준은 그
관계를 실제로 만든 source를 넘지 못합니다.

- 모델의 해석: `agent-asserted`
- 특정 관계를 검사한 typed evaluator: `domain-verified`
- 현재 branch의 사용자 결정: `user-accepted`

문장이 권위 있게 들린다는 이유로 수준을 올리면 안 됩니다.

## 저장과 replay

Judgment event는 Pi session format이 아닙니다. Adapter protocol 안에 넣어 저장하거나
다음 내용을 담은 작은 basis를 저장하세요.

- Owner, question, branch identity
- 허용한 provider descriptor, policy, applicability identity
- Selection과 sealed-content hash
- Contribution, conflict, limitation, coverage, outcome identity

Replay할 때는 payload를 parse하고 identity를 다시 계산합니다. 무엇을 가리키는지
알 수 없는 hash 문자열만 저장해서는 안 됩니다.

## 실패할 때 지켜야 할 동작

| 상황 | 처리 |
| --- | --- |
| 정책 파일 없음 | 참고 자료 없이 계속 진행 |
| 정책 파일 오류 또는 root escape | 해당 source batch 거부 |
| Provider가 적용되지 않음 | 긍정적인 method/reference 후보에서 제외 |
| 선택한 byte 변경 | 다시 읽고 다시 평가 |
| 관련 없는 descriptor 추가 | 기존 selection 유지 |
| 선택한 자료 하나를 읽지 못함 | Selection과 seal 모두 기록하지 않음 |
| 자료의 기여 누락 | Coverage 거부 |
| Adapter 저장 실패 | Adapter의 domain state를 진행하지 않음 |

맥락적 결론은 파일 변경 권한이 아닙니다. 파일을 바꿀 수 있는 adapter라면 별도의
authorization 값과 검사를 만들어야 합니다.
