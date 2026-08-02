# Observer의 동작 원리

[English](../how-it-works.md) | 한국어

Observer는 tool result를 곧바로 note file로 옮기는 recorder가 아닙니다. 작업 중
근거와 해석은 현재 Pi branch의 event로 유지하고, 검토를 끝낸 exact Markdown만 별도
publication transaction을 거쳐 Notebook에 씁니다.

가장 중요한 구분은 각 표현이 서로 다른 의미를 가진다는 점입니다.

```text
Tool result
→ Candidate
→ SourceRead
→ Observation 또는 hypothesis review
→ working Memo
→ PreparedSave
→ 사용자 승인
→ Notebook record + SaveCommitted
```

앞 단계가 생겼다고 다음 단계가 자동으로 성립하지 않습니다. Candidate는 아직
source가 아니고, SourceRead는 아직 해석이 아니며, Memo는 아직 Notebook record가
아닙니다.

## 1. Session branch와 Notebook은 서로 다른 state owner다

Observer에는 두 저장 경계가 있습니다.

| 위치 | 소유하는 값 | 수명 |
| --- | --- | --- |
| 현재 Pi branch | Episode, mode, Candidate, SourceRead, Observation, hypothesis, working Memo, prepared proposal | Branch를 replay할 수 있는 동안 |
| 사용자가 고른 Notebook | Source, Inquiry, Memo, Zettel Markdown | Save publication과 readback이 끝난 뒤 |

Extension command와 sidecar action은 먼저 typed custom entry를 현재 branch에
append합니다. Runtime은 branch ancestry의 entry를 다시 parse하고 pure transition 또는
reconstruction 함수에 적용해 현재 snapshot을 만듭니다.

Notebook 파일을 읽어 working session state처럼 계속 고치지 않습니다. 반대로 session
Memo를 durable record라고 간주하지도 않습니다. 이 분리 덕분에 모델 해석이 진행
중이거나 실패한 상태가 자동으로 Notebook에 섞이지 않습니다.

## 2. Mode와 Episode는 독립된 상태다

`mode`는 continuous observation을 할지 결정하고, `Episode`는 어떤 탐구 묶음이 현재
열려 있는지 결정합니다.

- `/observer on`은 Notebook identity를 확인하고 필요하면 Episode를 연 뒤 mode를
  `on`으로 바꿉니다.
- `/observer off`는 새 continuous capture와 해석만 멈춥니다.
- 열린 Episode, SourceRead, Observation, Memo는 그대로 남습니다.
- Material review와 명시적인 사용자 hypothesis는 mode가 off여도 열린 Episode에서
  진행할 수 있습니다.

Episode는 `empty`, `open`, `reviewing save`, `settled` 상태를 가집니다. 저장 proposal을
만들었다고 settled가 되지 않습니다. Exact proposal이 실제로 publish되고 readback된
뒤 `SaveCommitted` event가 적용돼야 settled가 됩니다.

## 3. Branch entry는 하나의 permissive JSON이 아니라 typed stream으로 읽힌다

Observer는 lifecycle, observation, Memo, Save, processing policy를 서로 다른 protocol
값으로 decode합니다. Decoder는 event kind마다 필요한 key와 허용된 key를 정확히
확인합니다.

예를 들어 observation replay는 다음 관계를 따로 검사합니다.

- Candidate가 live Episode와 허용된 capture window에서 생겼는가
- SourceRead가 아직 쓰이지 않은 exact Candidate를 가리키는가
- Hydration이 존재하는 SourceRead와 standing index digest에 묶였는가
- Semantic observation이 valid SourceRead와 optional hydration을 가리키는가
- Memo request가 현재 unconsumed observation set을 정확히 포함하는가

Malformed entry나 순서가 맞지 않는 entry는 정상 state에 억지로 합치지 않고 replay
issue로 남깁니다. Sibling branch의 entry는 현재 snapshot의 근거가 되지 않습니다.

## 4. Candidate capture는 관찰이 아니라 짧은 nomination window다

Continuous mode에서 agent run이 시작되면 Observer는 그 run의 tool result를 exact
call ID, tool name, arguments, content, status, capture time과 함께 후보로 만들 수
있습니다.

Candidate의 목적은 “나중에 모델이 고를 수 있도록 원문을 잠깐 고정하는 것”입니다.
다음 이유로 모든 결과를 observation으로 바꾸지 않습니다.

- directory listing이나 단순 acknowledgment는 inquiry 의미를 거의 바꾸지 않습니다.
- 반복 read를 모두 남기면 같은 근거가 여러 번 세어집니다.
- Error는 빠진 근거를 설명할 수 있지만 긍정적인 source assurance를 만들 수 없습니다.
- Observer 자신의 tool result를 다시 관찰하면 자기 증폭 순환이 생깁니다.

선택되지 않은 일반 Candidate는 agent run이 끝나면 nomination 대상에서 사라집니다.
Material review Candidate는 request와 attempt에 별도로 묶여 retry/cancel 규칙을
따릅니다.

## 5. Processing mode는 같은 domain action을 언제 실행할지만 바꾼다

| Mode | Scheduling mechanism | 지속성 |
| --- | --- | --- |
| `piggyback` | 현재 foreground model turn에 bounded hidden context와 `observer_sidecar`를 추가 | 현재 turn |
| `local` | 명시적으로 고른 loopback model에 in-memory queue job을 하나씩 실행 | 현재 process |
| `off` | Candidate와 request coordination만 유지하고 model interpretation은 실행하지 않음 | Session event만 유지 |

Piggyback은 별도 inference request를 만들지 않습니다. Model은 현재 run의 exact tool-call
ID를 지명하고 마지막 tool call 하나로 `observer-commit`을 제출합니다. 그 call은
follow-up model turn 없이 terminate합니다.

Local queue는 capacity가 제한되고 job ID 중복을 받지 않으며 한 번에 하나만 실행합니다.
Foreground input이 들어오면 active job을 abort하고 같은 epoch의 queue 앞에 다시 넣어
양보합니다. Process가 끝나면 queue도 사라지므로 daemon이나 durable scheduler가
아닙니다.

“Local model” 여부는 가격 metadata가 아니라 endpoint가 loopback host인지 확인해
정합니다. Remote endpoint를 무료라고 표시해 local로 오인하지 않습니다.

## 6. SourceRead는 source identity와 원문 충실성을 고정한다

Model이 Candidate를 지명하면 observation controller는 먼저 exact Candidate ID와 현재
capture ancestry를 확인합니다. 그 다음 여러 Candidate를 하나의 source reading으로
묶어 원래 순서와 content를 보존하고 다음을 기록합니다.

- External material인지 direct observation인지 나타내는 source kind
- URI, revision, content hash 같은 provenance
- 원문을 과장하지 않는 faithful summary
- 주장과 exact locator
- 만들어진 `SourceReadId`

이 단계는 모델이 무엇을 읽었는지 고정할 뿐, inquiry에 어떤 의미가 있는지 아직
결정하지 않습니다. SourceRead receipt가 summary의 진실을 증명하지도 않습니다.

## 7. Observation은 Source와 Inquiry 사이의 typed relation이다

기존 Inquiry와 연결하려면 모델은 bounded standing index에서 exact Inquiry ID를 고르고
hydrate해야 합니다. Hydration은 필요한 record만 읽고 index digest와 SourceRead에
묶입니다.

그 뒤 context assessment가 다음을 확인합니다.

- SourceRead와 optional Inquiry context가 같은 현재 basis에 있는가
- related Inquiry ID와 hydration이 일치하는가
- 필요한 source/inquiry relation이 실제 payload identity로 성립하는가
- conflict와 빠진 context가 무엇인가

통과하면 `supports`, `challenges`, `refines`, `boundary`, `uncertain` 중 하나의 semantic
observation을 기록할 수 있습니다.

Observer는 이 검사에 Judgment primitive를 내부적으로 쓰지만 generic Judgment session을
사용자에게 열지는 않습니다. Named evaluator가 확인하는 것은 source ID, inquiry ID,
content identity 같은 domain relation입니다. Stance, movement, rationale은 여전히
`agent-asserted` 해석입니다.

## 8. 사용자 hypothesis는 원문과 해석을 분리한다

`/observer add-hypothesis`로 받은 문장은 `origin: user`와 함께 그대로 기록합니다.
Observer가 고칠 수 있는 것은 별도 context review입니다.

- supporting clues
- challenging clues
- missing information
- interpretation boundary
- 관련 Source ID

따라서 근거가 약해도 사용자 문장을 더 그럴듯한 문장으로 덮어쓰지 않습니다.
`insufficient-context`도 정상적인 review 결과입니다.

## 9. `observer-commit`은 branch fingerprint 위에서 원자적으로 적용된다

Piggyback model은 observations, hypothesis reviews, Memo preparation 또는 Save
preparation을 하나의 proposal에 넣을 수 있습니다. Observer는 이를 실제 session에
바로 append하지 않습니다.

먼저 current branch entry를 복사하고 fingerprint를 계산한 뒤 staging port를 만듭니다.
모든 controller action은 staging port의 가상 branch에 적용됩니다. ID, Episode,
Candidate, hydration, context basis, request를 전부 통과한 뒤에만 다음을 수행합니다.

1. 실제 branch fingerprint가 시작 때와 같은지 다시 확인합니다.
2. Staged custom entry를 원래 순서대로 append합니다.
3. Notification과 status update를 반영합니다.

중간에 하나라도 실패하거나 branch가 바뀌면 실제 session에는 아무 staged entry도
쓰지 않습니다. Memo와 Save를 같은 commit에 넣을 수 없는 이유는 Save scope가 완료된
Memo 결과에 의존하기 때문입니다.

## 10. Memo reconciliation은 working state를 재구성한다

`/observer memo`는 현재 SourceRead, observation, user/observer hypothesis, working
Memo, 명시적으로 관련된 standing record를 exact scope로 묶습니다.

Model은 scope의 각 대상을 create, revise, merge, keep 중 하나로 처리하고, 결과가 어떤
evidence ID에 의존하는지 적습니다. Prepare 단계는 current basis에서 instruction을
만들고, apply 단계는 그 instruction 전체를 하나의 domain transition으로 적용합니다.

여기서 만들어지는 Memo는 계속 branch-local working synthesis입니다. Notebook의
기존 Memo를 자동으로 덮어쓰지 않습니다.

## 11. Review는 파일이 아니라 exact publication proposal을 만든다

`/observer review`는 먼저 남은 Memo reconciliation을 끝내고, 현재 working state에서
create/update할 record의 최종 Markdown을 만듭니다.

Preparation은 다음을 proposal identity에 묶습니다.

- Notebook와 Episode identity
- Existing target path와 현재 byte hash
- Create/update operation과 record ID
- 각 document의 parsed schema
- Batch 적용 뒤의 전체 record graph
- 최종 Markdown byte

Workbench가 보여 주는 existing, diff, final 내용은 이 exact proposal에서 나옵니다.
화면을 열거나 diff를 봤다는 사실은 파일 write가 아닙니다. 사용자가 같은 proposal
ID의 전체 batch를 승인해야 publication을 시작할 수 있습니다.

## 12. Notebook publication은 stage, publish, readback으로 끝난다

저장은 record마다 따로 성공 처리하지 않습니다.

```text
preflight snapshot 확인
→ Notebook 내부 transaction directory 획득
→ 모든 next content와 before image stage
→ target inventory drift 재확인
→ record별 atomic create/replace
→ 최종 inventory와 byte readback 검증
→ transaction directory 제거
→ SaveCommitted append
```

이미 active transaction directory가 있으면 중단되었거나 다른 save가 진행 중인 것으로
보고 recovery를 요구합니다. Publish 중 실패하면 Observer가 이미 쓴 known entry를
before image로 rollback합니다.

Rollback 또는 cleanup까지 실패하면 성공으로 숨기지 않고 `recoveryRequired` 상태를
남깁니다. 다른 process가 target을 바꿔 before image로 되돌리는 것이 위험한 경우에도
임의로 덮지 않습니다.

`SaveCommitted`는 readback이 proposal과 정확히 일치한 뒤에만 lifecycle에 추가됩니다.
따라서 prepared proposal, 사용자 승인, 일부 file publish 중 어느 것도 durable
completion과 같지 않습니다.

## 13. 세 원자성 경계는 서로 다른 owner를 보호한다

Observer에는 세 개의 별도 all-or-nothing boundary가 있습니다.

| 경계 | 보호하는 state | 실패 시 남지 않는 것 |
| --- | --- | --- |
| `observer-commit` | 현재 Pi branch proposal | 일부 SourceRead나 observation |
| Memo apply | Working inquiry synthesis | Scope 일부만 반영된 Memo |
| Notebook publication | Local Markdown record set | 일부 record만 완료된 Save |

하나의 거대한 transaction으로 합치지 않는 이유는 state owner와 실패 복구 방법이
다르기 때문입니다. Session append의 stale check와 filesystem rollback은 같은 문제가
아닙니다.

Observer가 보장하는 것은 이 경계와 provenance입니다. Source가 진실인지, 모델 해석이
옳은지, 여러 process가 같은 Notebook을 동시에 안전하게 쓸 수 있는지까지 보장하지는
않습니다.
