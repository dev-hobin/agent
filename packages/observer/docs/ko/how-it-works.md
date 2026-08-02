# Observer 동작 방식

[English](../how-it-works.md) | 한국어

Observer는 두 곳에 서로 다른 상태를 둡니다.

- **현재 Pi branch:** 아직 작업 중인 source, observation, hypothesis, Memo
- **사용자가 고른 Notebook:** 검토와 저장을 모두 마친 Markdown record

작업 중인 내용을 바로 파일로 쓰지 않는 것이 핵심입니다.

## 1. `/observer on`이 하는 일

Observer를 켜면 먼저 선택한 Notebook을 다시 엽니다. Path와 manifest가 유효한지
확인한 뒤 현재 session state와 같은 Notebook인지 맞춥니다.

열린 Episode가 없다면 새 Episode를 만들고 Notebook의 default language를
고정합니다. 그 다음 observation mode를 `on`으로 바꿉니다.

Episode와 mode는 별개입니다. `/observer off`를 실행하면 새 tool result 관찰만
멈추고, 이미 열린 Episode와 그 안의 작업은 남습니다.

## 2. Tool result는 먼저 후보가 된다

Mode가 켜져 있고 Episode가 열린 동안, Pi extension은 현재 agent run의 tool
result를 짧은 후보 목록에 넣습니다. 이때 저장하는 것은 call ID, tool name,
arguments, result content, 성공 여부, 발생 시각입니다.

후보가 됐다고 observation이 되는 것은 아닙니다. 다음과 같은 결과는 보통 고르지
않습니다.

- 단순한 directory listing
- 반복해서 읽은 같은 내용
- 파일을 썼다는 acknowledgment
- 일반 diagnostic boilerplate
- Observer 자신의 tool result

Error result는 빠진 근거를 설명할 수는 있지만 긍정적인 source로 쓸 수 없습니다.
Agent run이 끝나면 고르지 않은 후보는 만료됩니다.

## 3. Piggyback은 기존 model turn에서 후보를 고른다

기본 processing mode인 `piggyback`은 별도 model request를 만들지 않습니다. Pi가
이미 응답을 만드는 turn의 hidden context에 다음만 추가합니다.

- 이번 run에서 지명할 수 있는 tool result
- 현재 Episode의 미완료 Observer request
- 관련 Inquiry/Memo의 작은 index
- `observer_sidecar` tool

모델은 정말 의미가 있는 result의 exact tool-call ID와 이유를 지명합니다. 한 run의
마지막에 `observer-commit` 하나로 제안하며, 이 call은 follow-up model turn 없이
끝납니다.

## 4. Candidate를 SourceRead와 observation으로 바꾼다

`observer-commit` 안에서 source 하나를 기록할 때 다음 순서를 지킵니다.

1. 지명한 call ID가 이번 run의 후보인지 확인합니다.
2. Candidate의 원문과 순서를 보존해 `SourceRead`를 만듭니다.
3. 외부 source인지 직접 observation인지 구분하고 provenance를 붙입니다.
4. Model이 faithful summary와 정확한 claim locator를 제출합니다.
5. 기존 Inquiry와 연결하려면 bounded index에서 exact Inquiry ID를 골라 hydrate합니다.
6. Typed context check가 SourceRead와 Inquiry relation이 실제로 있는지 확인합니다.
7. 그 뒤에야 `supports`, `challenges`, `refines`, `boundary`, `uncertain` 중 하나의
   observation을 기록합니다.

Source identity 확인은 evaluator가 할 수 있지만 summary와 stance의 의미는 여전히
모델의 해석입니다. 성공 receipt가 observation의 진실을 증명하지는 않습니다.

## 5. 한 commit은 전부 성공하거나 전부 실패한다

하나의 `observer-commit`에는 여러 SourceRead와 observation, hypothesis review,
Memo 준비 또는 Save 준비가 함께 들어갈 수 있습니다.

Observer는 실제 session에 바로 쓰지 않고 staging port에 먼저 적용합니다. 모든
ID, context basis, request, branch가 맞아야 staged entry를 한꺼번에 append합니다.
하나라도 stale하거나 잘못되면 전체 proposal을 버립니다.

Memo 준비와 Save 준비는 같은 commit에 넣을 수 없습니다. Save scope가 끝난 Memo
결과에 의존하기 때문입니다.

## 6. Material review는 capture window를 따로 연다

```text
/observer material <request>
```

이 명령은 Sidecar mode를 바꾸지 않고 정확한 request 하나에 대한 capture window를
엽니다. Inline text는 해당 user message가 source가 되고, URL이나 file은 그
request를 처리한 agent run의 successful retrieval result만 후보가 됩니다.

Run이 끝날 때 모든 candidate를 읽고 observation으로 만들지 못했다면 request는
`suspended`가 됩니다.

```text
/observer material retry
/observer material cancel
```

`retry`는 같은 request에 window를 한 번 더 열고, `cancel`은 Episode를 닫지 않은
채 request만 끝냅니다.

## 7. 사용자 hypothesis는 원문을 보존한다

```text
/observer add-hypothesis <text>
```

사용자가 쓴 문장은 `origin: user`와 함께 그대로 저장합니다. Observer는 supporting
clue, challenging clue, missing information, interpretation boundary를 따로 기록합니다.
근거가 부족하다는 결과도 정상이며 original text를 고쳐 쓰지 않습니다.

## 8. Memo는 session 안에서 working synthesis를 만든다

`/observer memo`는 현재 source, observation, hypothesis, working Memo, 명시적으로
고른 standing record를 한 scope로 묶어 reconciliation request를 만듭니다.

Model은 각 항목을 create, revise, merge, keep할지 제안해야 하고, scope의 모든
대상을 빠짐없이 처리해야 합니다. Proposal이 현재 basis와 맞으면 하나의 prepared
pass로 적용한 뒤 lifecycle acknowledgment를 기록합니다.

여기까지도 Notebook file은 바뀌지 않습니다.

## 9. Review가 저장할 Markdown을 만든다

`/observer review`는 남은 Memo 작업을 먼저 끝냅니다. 그 다음 current working
state에서 create/update할 record의 정확한 Markdown을 준비합니다.

Observer는 proposal을 준비할 때:

- target path와 기존 byte를 고정하고
- 각 document schema를 검사하고
- batch를 적용한 뒤의 전체 record graph를 검사하고
- Notebook, Episode, language, record set, final Markdown을 proposal ID에 묶습니다.

사용자는 Workbench에서 existing, diff, final Markdown을 확인할 수 있습니다.
아직 파일은 쓰지 않았습니다.

실제 저장 transaction은 [Notebook 저장](./notebook-publication.md)에 설명합니다.

## Processing mode 차이

| Mode | 실제 동작 |
| --- | --- |
| `piggyback` | Foreground turn에 hidden Observer context를 넣어 처리 |
| `local` | 명시적으로 고른 loopback model에 in-memory job queue 사용 |
| `off` | Candidate/request state는 유지하지만 model interpretation을 실행하지 않음 |

Local queue는 한 번에 job 하나만 실행하고 foreground input이 오면 양보합니다.
Process가 끝나면 queue도 사라집니다. Model price metadata가 아니라 endpoint가
실제로 loopback인지 확인합니다.
