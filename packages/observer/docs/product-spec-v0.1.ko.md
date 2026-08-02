# Observer v0.1 제품 명세

> 상태: 승인된 v0.1 제품 기준선
>
> 범위: 사용자 경험, 상태 모델, 로컬 기록, Zettelkasten 승격 및 검증 계약
>
> 제외: 구현 언어, Pi extension API, JSON Schema 코드, graph DB, vector DB, Git 자동화
>
> 현재 런타임 순서: [`runtime-flow.md`](runtime-flow.md)

---

## 1. 문서의 목적

이 문서는 Observer가 무엇을 만들고 어떻게 사용되어야 하는지를 구현보다 먼저 고정한다.

Observer의 이전 시도는 원전 감사와 많은 기술적 증거를 남겼지만, 사용자가 실제로 경험할 Golden Path와 제품의 성공 조건을 고정하기 전에 persistence, transaction, validation, retrieval을 고도화했다. 이 문서는 같은 실패를 반복하지 않기 위한 구현 차단 조건이다.

다음 질문에 이 문서 하나로 답할 수 있어야 한다.

```text
누가, 언제 Observer를 켜는가?
Observer가 켜지면 무엇을 관찰하는가?
가설은 어떻게 생성되고 검증되고 다시 활성화되는가?
memo와 save은 무엇을 하는가?
무엇이 언제 로컬 기록이 되는가?
어떤 기록이 Zettel로 승격되는가?
다음 세션에서는 어떻게 이어지는가?
Observer가 하지 않는 일은 무엇인가?
```

---

## 2. 제품 약속

> Observer는 사용자가 자료를 읽고 학습하거나 분석하는 동안 Pi에 별도의 관찰 관점을 활성화한다. Observer는 자료와 사용자–에이전트의 작업 흐름을 source-faithful하게 관찰하고, 여러 가설–검증 루프를 장기간 추적하며, 중요한 반례·새 가설·방향 전환만 알린다. 사용자가 `memo`를 요청하면 아직 Zettel로 승격되지 않은 통찰을 현재까지의 관련 컨텍스트로 재조정하고, `save`을 요청하면 저장 계획을 검토받은 뒤 성숙한 지식과 미결 탐구를 사용자가 소유한 로컬 Markdown 기록으로 남긴다.

Observer는 지식관리 데이터베이스가 아니라 다음의 결합이다.

```text
지속되는 관찰 관점
+ 병렬적인 가설–검증 루프
+ 필요할 때만 사용하는 thinking tools
+ 재조정 가능한 Memo
+ 성숙한 Zettel 승격
+ 자동 재진입 가능한 standing inquiry
```

---

## 3. 원전으로부터 가져오는 책임

세 원전은 하나의 공동 architecture를 제시하지 않는다. Observer는 각 원전에서 서로 다른 책임을 가져와 재구성한다.

```text
사도시마 요헤이
→ 질문, 가설, 관찰, 어긋남, 갱신의 탐구 순환

Root-Bernstein 부부
→ 상황에 따라 선택적으로 사용하는 thinking-tool repertoire

Sönke Ahrens
→ 자료, 기여, 관계, 미결 질문, 재진입 가능한 장기 기록
```

이를 다음처럼 잘못 번역하지 않는다.

```text
사도시마 → 복잡한 상태 머신 전체를 요구함
Root-Bernstein → 모든 사고도구를 실행하는 13단계 pipeline
Ahrens → Observer가 Git과 검색 DB까지 소유하는 notebook engine
```

Thinking tool은 내부적으로 필요할 때만 사용하며, 사용자가 따라야 할 필수 pipeline이 아니다.

---

## 4. 주 사용자와 사용 장면

### 4.1 주 사용자

자료를 읽고 학습·연구·분석하면서 다음을 원하는 사용자다.

- 지금 떠오른 가설을 잃지 않고 계속 검증하고 싶다.
- 하나의 자료에 갇히지 않고 다른 자료가 기존 가설을 수정하게 하고 싶다.
- 매 순간 완성된 문서를 쓰느라 학습 흐름을 끊고 싶지 않다.
- 충분히 성숙한 지식만 재사용 가능한 형태로 남기고 싶다.
- 다음 세션에서 과거 context ID를 직접 찾지 않고 이어가고 싶다.

### 4.2 Sidecar 사용

```text
Observer ON
→ 자료 읽기 또는 다른 사용자 작업 수행
→ Observer가 자료와 상호작용을 함께 관찰
→ 중요한 변화만 알림
→ memo로 중간 재조정
→ 계속 학습
→ Review로 proposal 준비·검증
→ Save에서 파일별 검토 후 batch 전체 승인·로컬 저장·종료
```

### 4.3 Add a hypothesis 사용

```text
Observer ON 또는 OFF
→ 사용자가 가설 원문과 선택적 context를 입력
→ 원문과 origin=user를 즉시 working state에 보존
→ 현재 Pi context와 Episode working state를 그 가설의 렌즈로 재검토
→ 지지 단서, 도전 단서, 부족한 정보, 실제 Source 연결, 해석 경계를 기록
→ 기존 Mode 유지
```

가설 등록에는 근거·개연성·성숙도 gate를 두지 않는다. 다만 최초 context review가
끝나기 전에는 Memo reconciliation을 시작하지 않는다. 이는 가설 등록 조건이 아니라
사용자가 제공한 context와 Observer의 해석을 분리하고, 현재 context에서 왜 이 가설을
계속 추적할지 또는 무엇이 부족한지 남기기 위한 절차다. `insufficient-context`도 유효한
완료 결과이며 가설 원문을 삭제하거나 수정하지 않는다.

### 4.4 Observe material 사용

```text
Observer ON 또는 OFF
→ `/observer material <자료 또는 retrieval 요청>`
→ 해당 요청 동안 scoped Observe material 수행
→ 기존 standing inquiry를 실제 working state에서 업데이트
→ 요청한 결과 반환
→ 기존 Observer Mode 유지
→ 이후 Memo·Review에서 누적 결과를 재조정하고 별도 Save 승인으로 저장
```

Observe material은 단순한 read-only 분석이 아니다. 관련 가설과 Memo의 pending revision을 실제 working state에 남긴다. 다만 `/observer save` 승인 전에는 장기 Zettel 기록으로 승격하지 않는다.

### 4.5 Review·Save와 Notebook publication 경계

사용자 연산은 proposal을 준비하는 `Review`와 승인된 proposal을 기록하는 `Save`로
분리된다. 코드의 `SaveService`는 승인 이후의 Notebook target·lifecycle·최종 receipt
계약을 소유한다. 실제 record graph를 publication plan으로 묶고 원자적으로 쓰고
readback과 rollback을 수행하는 과정은 주입된 `NotebookPublicationService`의 내부
구현이다.

```text
Review request
→ final Memo reconciliation
→ exact proposal preparation
→ SaveService preflight: decode · recover target · validate final graph · build publication plan
→ valid proposal만 ready 상태로 전환
→ stop without file writes

Save inspection and approval
→ 현재 target에 대해 SaveService preflight 재실행
→ target path · create/update · 문서 유형 · diff · exact final Markdown 검토
→ Save all N records 명시적 batch 승인
→ SaveService: authorize current proposal
→ SaveService: lifecycle preflight
→ NotebookPublicationService.commit: stage · publish · readback · rollback
→ SaveService: public save receipt · settle Episode
```

따라서 Notebook publication은 사용자 command, model action, public event/protocol이
아니다. 내부 publication failure도 `SaveService` 경계에서 `save.invalid-plan`,
`save.busy`, `save.concurrent-change`, `save.persistence`로 변환한다. pre-1.0의 폐기된
action·event·ID 이름을 decode하는 별도 legacy 경로는 두지 않는다.

---

## 5. 핵심 용어

### Observer Mode

현재 대화와 작업을 지속적으로 관찰할지 나타내는 활성 상태다.

```text
OFF ↔ ON
```

### Observation Episode

관찰, 가설, Memo가 쌓이는 하나의 작업 구간이다. Mode와 독립적이다.

```text
EMPTY → OPEN → SAVE PROPOSAL → SETTLED
```

다음 상태가 가능하다.

```text
Mode: OFF
Episode: OPEN
```

예: Observer를 잠시 껐거나, Observe material 결과가 쌓였지만 아직 Review & Save를 완료하지 않은 상태.

### Standing Inquiry

여러 세션과 여러 자료를 가로질러 살아 있는 하나의 가설–검증 루프다. 사용자가 context ID를 수동으로 선택하지 않아도 새 자료와 관련되면 자동으로 foreground에 들어온다.

### Foreground Inquiry

현재 자료와 관련성이 확인되어 전체 컨텍스트가 일시적으로 활성화된 standing inquiry다. Runtime 상태이며 Markdown lifecycle status는 아니다.

### Memo

현재 관찰에서 놓치지 않을 가치가 있지만 아직 장기 지식으로 확정되지 않은 분석적 중간 기록이다. Memo는 새 증거에 따라 수정, 병합, 분리, 보류, 철회, 승격될 수 있다.

### Zettel

하나의 중심 생각을 독립적으로 이해하고 다른 자료·지식과 조합할 수 있게 만든 성숙한 기록이다. Zettel은 직접 Source reference를 가진다.

### Source

판단이나 가설에 영향을 준, 다시 식별할 수 있는 증거의 기원이다.

```text
external-material
→ 책, 논문, 웹페이지, 코드, 영상, 데이터셋 등

direct-observation
→ 사용자가 직접 본 현상, 수행한 실험, 반복해서 발견한 패턴
```

사용자 가설 자체는 Source가 아니다.

---

## 6. 사용자 명령과 스크립트

### `/observer`

`/observer`는 제품 이름과 workbench namespace를 나타내는 유일한 canonical root command다. 하위 action은 Pi의 일반 command grammar에 맞춰 `/observer on`, `/observer material <request>`처럼 공백으로 구분한다. `/observe` compatibility command와 `/observer:on` 형태의 colon command는 등록하지 않는다.

Pi TUI에서는 인자 없이 실행하면 현재 branch의 Observer inquiry workbench를 연다.

```text
Overview
→ Mode, Episode, processing, health, publication 상태

Activity
→ SourceRead, faithful summary, claims, semantic Observation,
  user hypothesis와 context review

Inquiries / Memos
→ original/current/revision/evidence와 complete working content

Proposal
→ Not requested / Needs reconciliation / Preparing / Ready / Invalid
→ Ready일 때 record별 Diff / exact proposed Markdown / existing Markdown

Notebook
→ 기존 records/*.md inventory와 exact saved Markdown

Settings
→ Notebook, Observer On/Off, 기본 출력 언어, processing policy
```

Workbench projection은 branch replay와 Notebook inventory를 read-only로 해석한다. item을 Enter로 여는 동작은 lifecycle event나 파일 write를 만들지 않는다. Wide terminal에서는 section/content pane을 함께 보이고, narrow terminal에서는 list/detail route를 사용한다. focus된 list/detail이 ↑/↓, `j/k`, PageUp/PageDown, Home/End를 소유하며 Esc는 detail → section → Pi 순서로 한 단계씩 돌아간다. `?` help가 열린 동안 아래 workbench action은 실행되지 않는다.

State-changing action은 현재 section에서 legal할 때만 contextual key로 노출한다. Proposal의 `s`는 기존 별도 batch approval viewer를 열 뿐 즉시 저장하지 않는다. Save 전에는 current branch와 Notebook target을 다시 검증한다. TUI가 아닌 RPC/print/json mode에서 인자 없는 `/observer`는 기존처럼 read-only status를 반환한다. `/observer settings`는 Settings를 직접 열고 Esc 뒤 workbench로 돌아간다.

### `/observer setup`

최초 Notebook 위치와 기본 출력 언어를 설정한다. TUI에서는 두 설정을
별도 option으로 노출한다. Mode On/Off만 toggle로 취급한다. 기본 출력 언어는
현재 선택을 미리 가리키는 `English (en)` / `Korean (ko)` 명시적 chooser로
제공하며 Enter 때 다음 값으로 순환시키지 않는다. 파일 작업 전에는 Pi cwd 기준으로
resolve한 절대 경로와 선택 언어를 다시 보여준다. 초기 선택은 `Go back`이며 사용자가
`Set up <path>`를 명시적으로 선택한 경우에만 새 Notebook을 초기화하거나 기존 folder를
adopt한다.

```text
입력
- 사용자가 소유한 로컬 folder의 절대 경로 또는 Pi 현재 작업 디렉터리 기준 상대 경로
- Memo와 Zettel Markdown의 기본 출력 언어: ko 또는 en

결과
- notebook 선택
- 다음 세션에도 설정 유지
- Git 저장소 생성 없음
```

### `/observer on`

Observer의 지속 관찰을 활성화한다.

```text
- 선택된 notebook과 episode 언어 확인
- 열린 episode가 있으면 재개
- 없으면 새 episode 생성
- standing inquiry compact index 복구
- Hybrid 개입 정책 활성화
```

### `/observer off`

지속 관찰만 비활성화한다.

```text
- Zettel 승격 없음
- save 없음
- 열린 episode 유지
- working state는 recovery 가능하게 보존
```

### `/observer memo`

현재 episode와 관련 standing inquiry에 연결된 모든 미승격 Memo를 현재까지의 관련 컨텍스트로 재검토·재조정한다.

```text
가능한 처리
- 신규 Memo 생성
- 기존 Memo 수정
- 중복 병합
- 혼합된 생각 분리
- 반례로 보류
- 철회 또는 supersede
- Zettel 승격 준비 표시

효과
- compact receipt 표시
- 장기 Zettel 저장 없음
- Git 작업 없음
- Mode 상태 변경 없음
```

`memo`는 Mode가 OFF여도 열린 episode에 적용할 수 있다.

### `/observer add-hypothesis <text>`

사용자 가설 원문을 즉시 추가하고 선택적 `Context:`를 분리해 보존한다.
Observer Mode와 무관하게 같은 OPEN Episode를 사용하며 최초 current-context
review를 시작한다.

### 일반 Sidecar tool-result 선별

일반 Mode ON agent run에서 tool execution은 Observation이 아니라 잠재적 evidence다.
Observer는 tool result 본문을 즉시 candidate event로 복제하지 않는다. 현재 agent run의
bounded tool-call reference만 일시적으로 유지하고, 모델이 다음 조건 중 하나를 구체적인
이유와 함께 `nominate-tool-results`로 선택할 때만 원본 Pi tool result를 candidate로
승격한다.

- Source claim을 제공한다.
- 반례나 중요한 경계를 제공한다.
- 현재 Inquiry 또는 Memo에 관련된 판단 근거를 제공한다.

단순 navigation, 목록, write acknowledgement, 반복 read, routine diagnostics는 실행됐다는
이유만으로 nominate하지 않는다. reference는 agent run 종료, 새 사용자 입력, session 전환,
명시적 material-review run 시작 시 폐기한다. 이전 run의 tool-call ID와 현재 branch에 없는
결과는 nominate할 수 없다. nomination reason은 candidate origin에 보존하고, 같은
`tool_call_id + content hash`의 재시도는 기존 candidate를 resume한다. reason의 의미
품질은 model-owned judgment이며 runtime은 current-run ownership, exact branch result,
non-empty bounded reason만 구조적으로 보장한다.

명시적 retrieved `/observer material`은 사용자가 exact 자료 retrieval을 요청했으므로 이
선별 규칙의 유일한 자동 capture 예외다.

### `/observer material <request>`

inline 자료, 경로, URL 또는 retrieval 요청을 명시적인 Observe material agent run으로
전달한다. Observer Mode가 ON이면 ON, OFF이면 OFF로 유지하며, command 자체를
Source evidence로 취급하지 않는다.

retrieved tool result를 request-linked candidate로 포착하는 권한은 material-review-start가
성공한 현재 agent run에만 존재한다. 같은 agent run 안의 여러 model turn과 retrieval
호출은 허용하지만, agent run이 settle되거나 무관한 사용자 입력이 도착하면 capture
window를 닫는다. durable pending request는 유지하되 이후 tool result를 암묵적으로
가로채지 않는다.

```text
pending + capture window active
→ 현재 exact request의 retrieved tool result만 request-linked candidate

pending + capture window suspended + Mode OFF
→ 이후 tool result 무시

pending + capture window suspended + Mode ON
→ 이후 tool result는 현재 run의 nomination-eligible reference일 뿐이며,
  명시적으로 nominate되기 전에는 candidate가 아니고 stale request와 연결하지 않음
```

### `/observer material retry`

현재 exact pending request를 새로 만들지 않고 한 번의 bounded agent run에서 재개한다.
retrieved material이면 그 run에만 capture window를 다시 열고, inline material이면 기존
candidate 처리만 재개한다. session reload 뒤 durable pending request는 항상 suspended로
복구되며 명시적 retry 전에는 retrieval capture를 재개하지 않는다.

### `/observer material cancel`

현재 exact pending request에 durable cancellation event를 기록한다. Mode와 OPEN Episode는
변경하지 않으며, 취소된 request에 연결된 미완료 candidate는 일반 Sidecar 작업으로
재사용하지 않는다. cancel 이후에는 새 Observe material request를 시작할 수 있다.

pending material review가 있는 동안 Review는 시작할 수 없다. 사용자는 finish 또는 cancel로
해소해야 하며, 이 guard는 Episode가 먼저 SETTLED되어 pending request가 고아가 되는 상태를
막는다.

### `/observer review`

현재 working state를 하나의 저장 가능한 proposal로 정리한다. 필요하면 마지막 Memo
reconciliation을 먼저 수행한 뒤, 모든 create/update Markdown과 최종 Notebook graph를
검증한다. 유효한 proposal만 `Ready to save` 상태가 된다. Review는 Notebook 파일을
변경하지 않고 Save UI를 자동으로 열지도 않는다.

### `/observer save`

`/observer review`가 준비·검증한 proposal만 검토하고 저장한다. Save는 최종
reconciliation이나 proposal 생성을 암묵적으로 시작하지 않는다.

```text
1. 현재 Notebook target에 대해 prepared proposal을 다시 검증
2. record별 target path·create/update·문서 유형을 목록으로 표시
3. update는 diff, final Markdown, existing Markdown을 전환해 검토
4. create는 exact final Markdown을 검토
5. Back / Return to Review / Save all N records 중 하나를 명시적으로 선택
6. batch 전체 승인 후에만 로컬 기록으로 저장
7. readback validation 후 episode를 SETTLED로 전환
8. Observer Mode를 OFF로 전환
```

`Back`은 lifecycle을 바꾸지 않고 proposal을 ready 상태로 유지한다. `Return to
Review`는 proposal만 폐기하고 Episode와 working state를 OPEN으로 유지한다. `Save all
N records`만 파일을 변경한다. record별 검토는 지원하지만 부분 저장은 지원하지 않는다.

### `/observer status`

최소한 다음을 보여준다.

```text
Observer Mode
Episode 상태
Notebook 위치
현재 출력 언어
Pending Memo 수
Pending material-review request ID, material 종류, coverage phase
Material capture window active/suspended 상태
`/observer material retry` / `/observer material cancel` 복구 action
Open Inquiry 수
Zettel 후보 수
Notebook validation health
```

### `/observer settings`

Workbench의 secondary section으로 Notebook과 기본 출력 언어를 서로 구분된 option으로 확인·변경한다. `/observer settings`는 이 section의 기존 Settings surface를 직접 연다. 기본 출력 언어는 Memo와 Zettel Markdown 생성 언어이며 TUI 표시 언어가 아니다.

- 여러 notebook이 존재할 수 있다.
- 한 시점에는 하나만 선택한다.
- 열린 episode에 pending work가 있으면 notebook을 조용히 변경할 수 없다.
- 출력 언어 변경은 Episode 경계와 무관하게 새 Memo·Zettel 작업에 즉시 적용한다.
- 이미 준비된 Memo·Review & Save 작업은 승인·재시도 scope에 잠긴 언어를 유지한다.

### Workbench 표시 상태

```text
Working
→ SourceRead, Observation, Inquiry, Memo 같은 session working state

Preparing
→ locked request scope, 현재 processing mode와 wait reason
→ model partial output은 proposal Markdown으로 표시하지 않음

Ready
→ atomic preparation과 current local preflight를 통과한 exact proposal

Saved
→ Notebook inventory에서 다시 읽은 durable Markdown
```

Quietness는 push notification 빈도를 낮추는 정책이지 working state를 숨기는 정책이 아니다. Review는 이미 inspectable한 working state를 publication scope로 freeze하고 검증하는 경계이며, working state를 처음 보여주는 화면이 아니다.

---

## 7. 상태 모델

### 7.1 Mode와 Episode의 직교 상태

```text
                 /observer on
Mode OFF ─────────────────────────→ Mode ON
Mode OFF ←───────────────────────── Mode ON
                 /observer off

Episode EMPTY
    │ on 또는 observe-material
    ▼
Episode OPEN
    │ material start
    ├─ active agent run → finish → Episode OPEN
    ├─ settle/input → pending suspended → retry → active agent run
    └─ cancel → Episode OPEN
    │ memo 0..N회
    ▼
Episode OPEN
    │ pending material-review 없음 + review
    ▼
VALIDATED SAVE PROPOSAL
    ├─ Back                  → proposal 유지, 같은 상태
    ├─ Return to Review      → Episode OPEN + working state 유지
    └─ Save all N + readback → Episode SETTLED + Mode OFF
```

### 7.2 Compaction 안전성

```text
Observer가 활성 상태이거나 episode가 열려 있음
→ Pi context compaction 발생
→ working hypothesis와 Memo 후보가 사라지지 않음
→ 사용자 의사 없이 Zettel로 자동 승격하지 않음
```

자동 recovery persistence와 장기 knowledge persistence는 다르다.

```text
automatic recovery
= 손실 방지용 provisional working state

save persistence
= 사용자가 승인한 로컬 장기 기록
```

---

## 8. Hybrid 개입 정책

Observer는 기본적으로 조용히 관찰한다.

### 즉시 알리는 경우

- 기존 가설의 핵심을 흔드는 반례
- 새로운 독립 가설의 출현
- 탐구 방향이 크게 바뀌는 revision
- 사용자나 메인 에이전트가 중요한 어긋남을 놓친 경우
- Thinking tool 결과가 현재 판단을 실질적으로 바꾼 경우

### 내부에 누적하는 경우

- 기존 가설을 단순히 반복 지지하는 증거
- 표현만 조금 정교하게 만드는 변화
- 아직 중요성이 불분명한 연상
- Memo나 save에서 함께 보는 편이 좋은 작은 변화

사용자는 일반적인 발전 상황을 `memo`와 `save`에서 확인한다.

### 조용함의 표시 경계

성공한 routine `observer_sidecar` call과 result는 Pi TUI transcript에 빈 self-render
component로 표시되어 행 자체를 만들지 않는다. 실패, recovery 상태, 명시적 receipt,
Major 알림은 계속 보인다. 이는 표시 정책이며 session log 삭제 정책이 아니다.
Pi session의 tool message와 Observer custom entry는 model continuity, branch replay,
audit를 위해 보존한다.

---

## 9. Source-first 관찰과 관련성 재활성화

기존 가설이 새 자료를 왜곡하지 않도록 순서를 고정한다.

```text
1. 자료가 실제로 말하는 내용을 먼저 복원
2. standing inquiry compact index와 관련성 비교
3. 관련 후보만 full context로 hydrate
4. 지지·반박·수정·경계·무관함을 판정
5. 관련 inquiry가 없으면 새 가설 후보를 열 수 있음
```

기존 inquiry는 의무적 해석 프레임이 아니라 검증 대기 중인 관점 후보다.

```text
Source A ─┬→ Inquiry H1
          └→ Inquiry H2

Source B ───→ Inquiry H1

Source C ─┬→ Inquiry H2
          └→ 새 Inquiry H3
```

사용자는 기본 흐름에서 `load inquiry-123` 같은 명령을 사용하지 않는다.

---

## 10. 사용자 가설 처리

사용자가 명시적으로 가설을 제안하면 즉시 working state에 등록한다.

```text
“내 가설은…”
“혹시 … 아닐까?”
“이걸 가설로 추적해 줘.”
```

### 보존할 것

- 사용자가 처음 표현한 원문
- 사용자가 직접 제공한 context 또는 이유
- 현재 revision
- 가설을 촉발한 자료와 문맥
- 사용자 제안인지 Observer 제안인지에 대한 origin
- 지지·반박·경계 증거
- revision 이유

### 최초 context review

```text
가설 capture
→ user context를 별도 보존
→ 현재 보이는 Pi 대화와 tool result 재검토
→ 현재 Episode의 Observation·Memo·Inquiry working state 재검토
→ supports | challenges | mixed | insufficient-context 판단
→ supporting clues / challenging clues / missing information 기록
→ 실제로 식별 가능한 Source만 source_ids에 연결
→ interpretation boundary 기록
```

사용자 context는 사용자가 왜 그렇게 생각했는지에 대한 단서이지 자동으로 검증된
Source evidence가 아니다. Observer가 현재 context에서 추론한 이유도 사용자 이유처럼
기록하지 않는다. 파일·URL·도구 경로는 실제 내용을 조회하기 전까지 Source가 아니다.
context review 실패 시 가설은 `pending` 상태로 보존하고 다음 turn에서 정확한 가설 ID로
재개한다.

### 구분할 것

```text
Source claim
= 자료가 실제로 주장한 것

User hypothesis
= 사용자가 자료를 보고 추론한 것

Observer hypothesis
= Observer가 관찰에서 추가로 제안한 것
```

Observer는 사용자 가설을 조용히 덮어쓰지 않는다.

```text
original hypothesis
→ evidence
→ current revision
→ revision reason
```

가설이 틀렸다는 이유로 조용히 삭제하지 않는다. 반박된 가설에서 이동 가능한 지식이 생기면 Zettel 후보가 될 수 있다. 근거 없는 가설도 Inquiry나 incubating Memo로 유지할 수 있으며, Source 요건은 가설 등록이 아니라 재사용 가능한 Zettel 승격 경계에 적용한다.

---

## 11. Memo reconciliation 계약

`memo`는 새로운 메모 하나를 단순 추가하는 명령이 아니다.

```text
MemoSet'
  = reconcile(
      현재 episode의 미승격 Memo,
      관련 standing inquiry의 incubating Memo,
      새 관찰,
      가설 revisions,
      반례,
      새 관계
    )
```

### 범위

- 현재 open episode
- 현재 episode와 관련된 standing inquiry
- 해당 inquiry에 연결된 incubating Memo

관련 없는 모든 과거 Memo를 매번 전부 읽지 않는다.

### 반복 안정성

새 증거가 없는데 `memo`를 반복 호출해도 같은 내용의 Memo가 계속 복제되면 안 된다.

### Memo receipt 예시

```text
Memo pass 2

검토 범위
- 현재 episode
- 관련 standing inquiry 2개
- 미승격 Memo 6개

재조정
- 신규: 1
- 수정: 2
- 병합: 1
- 보류: 1
- Zettel 승격 준비: 2

Observer remains ON/OFF (기존 Mode 유지)
```

---

## 12. Review와 Save 계약

Review와 Save는 서로 다른 사용자 연산이다. Review는 판단 가능한 제안을 만들고 멈추며,
Save만 승인 후 파일을 변경한다.

```text
Review
= 최종 의미 정리
+ 승격 판단
+ 현재 Memo/Inquiry 상태 확인
+ exact Notebook proposal 준비
+ 파일 변경 없음

Save
= 현재 Notebook target에 대한 proposal 재검증
+ bounded record 목록과 update diff/exact Markdown 표시
+ Back / Return to Review / Save all N records 선택
+ batch 전체가 승인된 경우에만 로컬 저장
+ readback validation
+ Episode 종료
+ Observer OFF
```

미소비 Observation, pending Memo request, prepared Memo가 남아 있으면 Review는
`review-save` continuation으로 마지막 Memo reconciliation을 먼저 완료하고 같은 흐름에서
proposal 준비까지 이어진다. 사용자가 먼저 별도의 `memo` 명령을 실행할 필요는 없다. 이미
Memo reconciliation이 끝난 상태라면 곧바로 proposal을 준비한다. 마지막 Memo pass와
proposal은 각각 준비 시점의 scope와 출력 언어를 잠근다. proposal 준비가 끝나도 Save를
자동 실행하거나 승인 UI를 자동으로 열지 않는다.

### Review proposal 필수 정보

```text
저장할 notebook 위치
문서 생성 언어
관찰한 Source
새 Zettel 후보
정교화할 기존 Zettel
Incubating으로 유지할 Memo
Standing으로 유지할 Inquiry
Retire 또는 supersede할 항목과 이유
각 create/update record의 exact Markdown
```

현재 working Memo와 Inquiry는 Status에서 제목·상태·현재 내용을 확인할 수 있어야 한다.
Save 확인 화면은 record ID만이 아니라 target 상대 경로, create/update, 문서 유형,
제목과 실제 제안 Markdown을 보여야 한다. update는 diff를 기본으로 보여주되 existing
Markdown과 exact final Markdown으로 전환할 수 있어야 한다. terminal 높이를 넘는 내용은
고정 header/footer 사이에서 키보드로 scroll할 수 있어야 한다.

### Save 승인

사용자는 다음을 할 수 있다.

- record별 내용을 검토한 뒤 prepared proposal 전체 승인
- Back으로 Save UI를 닫고 같은 proposal을 나중에 다시 검토
- Return to Review로 proposal만 폐기하고 추가 관찰·Memo reconciliation 수행

Save action은 `Yes/No`가 아니라 결과를 설명하는 label을 사용한다. 초기 Enter는 승인으로
이어지지 않으며, `Save all N records`를 명시적으로 선택한 뒤에만 파일을 변경한다.
prepared proposal 없이 Save를 실행하면 Review를 먼저
실행하라는 안내만 제공하며 Review를 암묵적으로 시작하지 않는다.

### Save 완료 receipt

```text
Save completed

Saved locally
- Zettel: N
- Incubating Memo: N
- Standing Inquiry: N
- Source: N

Git commit/push: 수행하지 않음
Observer: OFF
Episode: SETTLED
```

---

## 13. 기록의 생명주기

### Source

```text
available
unavailable
superseded
```

`source_kind`:

```text
external-material
direct-observation
```

### Inquiry

```text
open
dormant
resolved
retired
```

Inquiry record 하나는 지속 가능한 하나의 가설–검증 루프를 나타낸다. 병렬 가설은 여러 Inquiry record로 표현한다.

### Memo

```text
working (recovery state, 아직 장기 record 아님)
→ incubating
→ promoted | superseded | retired
```

Review & Save에서 미성숙하다는 이유만으로 폐기하지 않는다. 가능성이 있는 Memo는 incubating으로 보존한다.

### Zettel

```text
mature
superseded
retired
```

Draft Zettel은 만들지 않는다. 승격 전 상태는 Memo다.

---

## 14. 직접 관찰과 외부 자료

### External Material Source

다음 중 식별 가능한 정보를 보존한다.

```text
source_uri
revision/edition
content hash
retrieval context
```

### Direct Observation Source

최소한 다음을 보존한다.

```text
observed_at
observed_by
관찰한 사실
관찰 조건
관찰과 해석의 경계
```

### 직접 관찰과 가설의 차이

```text
직접 관찰
“완성된 Markdown을 반복 작성할 때 읽기 흐름이 세 번 끊겼다.”

사용자 가설
“매번 영속화하는 것이 학습을 방해하는 원인일 것이다.”
```

첫 번째는 Source가 될 수 있다. 두 번째는 Inquiry에서 검증해야 한다.

---

## 15. Local-first와 책임 경계

### Observer가 소유하는 것

- 관찰과 가설–검증 루프
- Memo reconciliation
- Zettel 승격 판단
- Source·lineage·relation 보존
- 사용자가 선택한 로컬 notebook에 기록
- 다음 세션의 재진입

### Observer가 소유하지 않는 것

```text
git init
git status
git add
git commit
git push
GitHub 인증
branch/PR 관리
원격 백업
동기화 충돌 해결
```

Observer는 notebook이 Git 저장소인지 알 필요가 없다.

```text
Observer
→ 무엇을 어떤 로컬 지식으로 남길 것인가

사용자 또는 외부 도구
→ 그 파일을 어떻게 버전 관리·백업·동기화할 것인가
```

Observer는 “로컬 저장 완료”만 보장한다. 원격 백업이나 다른 기기 복구를 보장하지 않는다.

---

## 16. Notebook과 언어

### Notebook 위치

- 사용자가 명시적으로 선택한다.
- 절대 경로와 상대 경로를 모두 받는다.
- 상대 경로는 Pi의 현재 작업 디렉터리를 기준으로 절대 경로로 정규화한다.
- 현재 작업 디렉터리나 숨겨진 기본 위치를 입력 없이 조용히 선택하지 않는다.
- 기존 폴더 또는 새 폴더를 선택할 수 있다.
- 여러 notebook이 존재할 수 있지만 한 시점에는 하나만 선택한다.
- 열린 episode 도중 notebook을 변경하지 않는다.

### 생성 언어

초기 설정은 다음을 제공한다.

```text
ko
en
```

- Notebook별 Memo·Zettel Markdown 기본 출력 언어를 가진다.
- 이 설정은 TUI label, help, status의 표시 언어를 변경하지 않는다.
- 출력 언어 변경은 열린 Episode를 교체하지 않고 이후 새 작업에 즉시 적용한다.
- 이미 준비된 작업은 승인·재시도 일관성을 위해 준비 시점의 언어를 유지한다.
- 특정 문서에 대한 명시적 언어 override는 허용한다.
- 기존 문서를 수정할 때는 해당 문서의 기존 언어를 유지한다.
- Source의 실제 언어는 ko/en 이외의 BCP 47 tag도 허용한다.
- 원문 인용, 원제, 코드, API, 경로, record ID는 번역하지 않는다.

---

## 17. Observer Markdown Profile v1 — 제품 수준 결정

### 17.1 Compatibility Core

주요 Markdown/Zettelkasten 도구의 공통 관행과 맞추는 필드다.

```yaml
id: zettel-<stable-id>
title: Capture는 이후 판단 가능성을 보존한다
lang: ko
created: 2026-07-27T10:00:00Z
modified: 2026-07-27T10:00:00Z
tags:
  - note-taking
aliases:
  - 재진입 가능한 기록
```

### 17.2 Observer Extension

```yaml
observer_schema: observer-record/v1
observer_type: zettel
observer_status: mature

sources:
  - record: source-<stable-id>
    locator: "p. 44–46"
    role: supports

lineage:
  - type: promoted_from
    target: memo-<stable-id>

relations:
  - type: extends
    target: zettel-<stable-id>
```

Nested YAML을 허용한다. Obsidian Properties UI가 모든 nested field를 완전히 표현하지 못하더라도 YAML 원문을 보존할 수 있으며, Observer가 의미와 검증을 소유한다.

### 17.3 Identity

```text
Stable ID는 filename, title, Git SHA, DB row, vector ID와 독립적이다.
```

### 17.4 Source influence

초기 role:

```text
supports
challenges
context
example
```

### 17.5 Process lineage

초기 type:

```text
derived_from
promoted_from
merged_from
split_from
supersedes
```

### 17.6 Semantic relation

초기 type:

```text
supports
contradicts
refines
extends
applies_to
distinguishes
alternative_to
related
```

새 relation은 실제 반복 사례가 생긴 뒤 profile version으로 추가한다.

---

## 18. Zettel 승격 기준

Zettel은 다음을 만족해야 한다.

```text
- 중심 생각이 하나다.
- Source와 근거를 직접 추적할 수 있다.
- 원문 전체 없이 이해할 수 있다.
- 특정 자료의 단순 요약을 넘어 다른 상황으로 이동 가능하다.
- 적용 조건이나 경계가 드러난다.
- 핵심 의미를 뒤집을 미해결 반례가 없다.
```

통과하지 못한 기록은 오류가 아니라 incubating Memo다.

### 반드시 직접 Source reference를 가진다

- 외부 자료를 직접 참조할 수 있다.
- 사용자의 직접 관찰을 Source record로 만들 수 있다.
- 사용자 가설 자체를 Source로 사용해서는 안 된다.

---

## 19. 검증 계약

### 19.1 구조 검증

기계적으로 확인한다.

```text
- UTF-8 Markdown
- 첫 YAML frontmatter
- 지원하는 schema version
- type과 ID prefix 일치
- 필수 필드 존재
- BCP 47 lang
- timestamp 형식
- type별 status
- tags/aliases 자료형
- H1과 비어 있지 않은 body
```

### 19.2 Graph integrity 검증

Notebook 전체에서 확인한다.

```text
- ID uniqueness
- sources.record가 실제 Source를 가리킴
- lineage target 존재
- relation target 존재
- 허용된 edge type
- 중복 relation 없음
- 자기 자신을 향한 relation 없음
- Memo가 Source 또는 Inquiry lineage 없이 고립되지 않음
- Zettel이 직접 Source reference를 가짐
- promoted Memo와 Zettel의 lineage 연결
```

### 19.3 의미적 검증

모델 또는 사용자가 판단한다.

```text
- 실제로 하나의 생각인가?
- 독립적으로 이해 가능한가?
- 단순 요약이 아닌가?
- 이동 가능한가?
- 근거와 경계가 충분한가?
```

구조 validator가 의미적 품질까지 증명한다고 주장하지 않는다.

### 19.4 검증 시점

```text
- Review proposal이 ready 상태가 되기 전
- Save UI를 열 때 현재 Notebook target에 대해
- 사용자 batch 승인 후 실제 저장 직전
- notebook을 열거나 선택할 때
- standing inquiry를 재진입할 때
- status에서 notebook health를 요청할 때
```

Manual edit도 동일한 decoder와 graph validator를 통과해야 한다.

### 19.5 저장 원칙

Review/Save batch 중 하나라도 무효라면 일부 파일만 저장하지 않는다. record별 검토는
가능하지만 record별 승인·제외는 graph proposal을 다시 계산하지 않고 수행하지 않는다.

```text
모두 유효 → 로컬 저장
하나라도 무효 → 저장 없음 + 수정 가능한 설명
```

---

## 20. Graph·Backlink·Tag·Vector 확장 계약

```text
Markdown records
        │
        ├─ relations ─────────→ Graph edges
        ├─ sources ───────────→ Provenance edges
        ├─ lineage ───────────→ Process graph
        ├─ tags ──────────────→ Tag index 또는 tag nodes
        ├─ Markdown links ────→ Backlinks
        └─ title/body/lang ───→ Vector embedding
```

다음은 모두 projection이다.

```text
Graph DB
Backlink index
Tag index
Vector DB
Search DB
Embedding cache
```

삭제해도 Markdown에서 다시 만들 수 있어야 한다. Projection은 record identity나 relation truth의 기준이 아니다.

향후 graph export의 의미 표준으로 다음을 참고할 수 있다.

- RDF: stable node와 typed edge
- PROV-O: lineage와 provenance
- Web Annotation: source locator와 selector
- SHACL: projected graph shape validation

v0.1 core에 graph DB나 RDF runtime을 넣지 않는다.

---

## 21. Golden Path Acceptance

### 21.1 최초 설정과 Sidecar

```text
/observer setup
→ notebook 위치 선택
→ ko/en 선택

/observer on
→ standing inquiry 복구
→ 자료 읽기 수행
→ 사용자 가설 등록
→ Hybrid 중요 변화 알림
→ /observer memo
→ 계속 학습
→ /observer review
→ validated proposal ready, 파일 변경 없음
→ /observer save
→ target path·diff·exact Markdown 검토
→ Save all N records 승인
→ Source/Memo/Inquiry/Zettel 로컬 저장
→ Observer OFF
```

### 21.2 Off/On 재개

```text
Observer ON + Episode OPEN
→ /observer off
→ Mode OFF, Episode OPEN 유지
→ 새 세션
→ /observer on
→ 같은 episode와 pending context 재개
```

### 21.3 Add a hypothesis

```text
Observer ON 또는 OFF
→ /observer add-hypothesis <가설>
→ optional Context: <사용자 이유>
→ original + user context 즉시 보존
→ 현재 context lens review trigger
→ supports/challenges/mixed/insufficient-context 기록
→ Mode 유지
→ review 완료 뒤 memo 가능
```

### 21.4 Observe material

```text
Observer ON 또는 OFF
→ /observer material <자료 또는 retrieval 요청>
→ scoped Observe material
→ 관련 standing inquiry pending revision
→ 기존 Mode 유지
→ 여러 Observe material 요청 누적 가능
→ 완료된 hypothesis context review와 Observe material 결과를 memo에서 재조정
→ /observer review로 proposal 준비·검증
→ /observer save에서 batch 승인 후 로컬 저장
```

### 21.5 Fresh-session re-entry

```text
이전 Episode Review & Save 완료
→ 새 Pi 세션
→ /observer on
→ compact standing inquiry index 복구
→ 새 자료 관찰
→ 관련 inquiry와 incubating Memo 자동 foreground
→ 가설 검증 계속
```

### 21.6 Compaction

```text
긴 관찰 중 Pi compaction
→ 사용자가 별도 checkpoint를 기억하지 않아도 working state 보존
→ 자동 Zettel 승격 없음
→ 다음 memo에서 compaction 이전 관찰 포함
```

---

## 22. 명시적 Non-goals

v0.1에 포함하지 않는다.

```text
Git init/commit/push
GitHub adapter
Graph DB
Vector DB
Semantic retrieval backend
Graph view UI
Backlink UI
Tag browser UI
Subagent architecture
Background worker concurrency
모든 thinking tool을 강제하는 pipeline
모든 관찰 turn의 Markdown 저장
Compaction 시 자동 Zettel 승격
사용자가 record ID를 직접 골라 context를 복구하는 기본 흐름
프로젝트/출판/협업 workflow
원격 sync 또는 backup
```

Subagent는 제3자 관찰 관점을 구현할 후보지만 v0.1 설계와 구현에서 제외한다. 제품 계약은 main agent 내부 구현으로도 만족할 수 있어야 한다.

---

## 23. 구현 전 Gate

다음이 승인되기 전에는 코드를 작성하지 않는다.

```text
[x] 이 제품 약속이 사용자가 기대한 Observer를 설명한다.
[x] Sidecar transcript의 사용감이 맞다.
[x] Add a hypothesis가 원문과 user context를 보존하고 현재 context를 lens review한다.
[x] Observe material transcript의 부작용이 맞다.
[x] on/off/memo/Review/Save의 effect가 구분된다.
[x] Mode와 Episode의 독립 상태가 이해된다.
[x] Memo와 Zettel의 생명주기가 맞다.
[x] 직접 관찰과 사용자 가설이 구분된다.
[x] Review와 Save가 무엇을 검증·표시·저장하고 무엇을 묻는지 맞다.
[x] Notebook 위치와 언어 설정 방식이 맞다.
[x] Local-first와 Git 비책임 경계가 맞다.
[x] Markdown Profile의 record 종류와 relation 분리가 맞다.
[x] Non-goals가 충분히 좁다.
```

이 Gate는 사용자 검토를 거쳐 승인됐다. 이후 제품 의미가 바뀌면 이 문서를 먼저 수정하고 다시 검토한다.

---

## 24. 구현된 런타임 표면

현재 패키지는 다음 제품 표면을 구현한다.

```text
Package와 제품 계약
→ Markdown Profile과 validation
→ branch-local Observer lifecycle
→ Notebook setup과 language binding
→ Review/Save local persistence
→ Memo reconciliation
→ Sidecar와 Observe material 진입점
→ proposal inspection, explicit batch approval, readback
```

실제 상태와 write boundary는 [`runtime-flow.md`](runtime-flow.md)가 요약한다.
Graph DB, vector DB, Git 자동화, subagent는 여전히 범위 밖이다.

---

## 25. 제품 명세 밖의 기술 규격

다음 세부 사항은 현재 코드, schema, test가 소유하며 이 제품 명세의
사용자 의미와 분리한다.

```text
- 정확한 UUID 형식
- 실제 folder layout과 filename convention
- JSON Schema 파일
- Graph validation rule 목록과 오류 형식
- Source locator의 세부 표현
- Atomic save transaction 방식
- Pi compaction recovery 구현
- Existing Markdown manual edit 처리
- 실제 Pi extension에서 다른 skill output을 관찰하는 방법
```

이 항목을 변경할 때도 제품 계약을 바꾸지 않는다. 사용자 의미를 바꿔야
한다면 이 문서를 먼저 수정하고 다시 검토한다.

---

## 26. 조사 근거

### Zettelkasten/Markdown 관행

- zk YAML frontmatter: `title`, `date`, `modified`, `tags`/`keywords`, `aliases`, arbitrary metadata
  - <https://zk-org.github.io/zk/notes/note-frontmatter.html>
- Zettlr YAML/Pandoc metadata와 Zettelkasten ID/link 관행
  - <https://docs.zettlr.com/en/editor/yaml-frontmatter/>
  - <https://docs.zettlr.com/en/pkms/zkn-method/>
- Obsidian Properties, Markdown link/wikilink, backlinks
  - <https://obsidian.md/help/properties>
  - <https://obsidian.md/help/links>
  - <https://obsidian.md/help/plugins/backlinks>
- Quartz frontmatter compatibility
  - <https://quartz.jzhao.xyz/plugins/Frontmatter>

### Graph와 provenance 표준

- RDF 1.1 Concepts
  - <https://www.w3.org/TR/rdf11-concepts/>
- PROV-O
  - <https://www.w3.org/TR/prov-o/>
- Web Annotation Data Model
  - <https://www.w3.org/TR/annotation-model/>
- SHACL
  - <https://www.w3.org/TR/shacl/>
- SKOS
  - <https://www.w3.org/TR/skos-reference/>

### Observer 원전 책임

- 사도시마 요헤이 공식 공개 자료 감사
- Robert Root-Bernstein, Michèle Root-Bernstein, *Sparks of Genius*
- Sönke Ahrens, *How to Take Smart Notes*, Second Edition

세 원전 감사의 세부 evidence는 기존 `archive/observer-v0.1`에 보존되어 있다.

---

## 27. 한 문장 확인

> 사용자는 Observer를 켜고 자신의 학습을 계속한다. Observer는 자료와 상호작용 속에서 여러 가설을 조용히 추적하고 중요한 변화만 알린다. 사용자가 `memo`를 호출하면 미성숙한 생각들을 현재까지의 관련 컨텍스트로 재조정하고, `save`을 호출하면 저장 계획을 보여준 뒤 승인된 Source·Inquiry·Memo·Zettel을 선택한 로컬 notebook에 저장하고 관찰을 끝낸다. 다음 세션에서는 새 자료가 관련될 때 미결 가설이 자동으로 다시 활성화된다.
