# Observer v0.1 구현 계획

> 상태: 승인된 실행 기준선
>
> 기준 제품 명세: [`product-spec-v0.1.ko.md`](product-spec-v0.1.ko.md)
>
> 작업 브랜치: `feature/observer`
>
> 다음 실행 단위: Slice 8 — OFF pending-request tool-result capture (재라우팅 필요)
>
> 실행 방식: `/develop on` 이후 한 slice씩 판단·구현·검증하고 stable landing에서 멈춘다.

---

## 1. 계획의 목적

이 계획은 전체 architecture를 미리 완성하려는 roadmap이 아니다. 승인된 제품 명세를 사용자에게 검증 가능한 작은 vertical slice로 구현하기 위한 실행 기준선이다.

각 slice는 다음 형식을 가진다.

```text
Claim
→ 이번 slice가 사용자 또는 다음 slice에 보장할 것

Scope
→ 이번에 구현할 것

Non-scope
→ 의도적으로 구현하지 않을 것

State movement
→ 허용하거나 새로 증명할 상태 전이

Evidence
→ claim을 반증할 수 있는 검사

Stop
→ 다음 판단 전 멈출 stable landing
```

한 slice가 green이더라도 다음 slice로 자동 이동하지 않는다. Developer가 새 evidence를 보고 다시 route한다.

---

## 2. 문서의 역할과 업데이트 규칙

### 제품 명세

[`product-spec-v0.1.ko.md`](product-spec-v0.1.ko.md)는 다음을 소유한다.

```text
제품 의미
사용자 경험
명령의 effect
상태와 lifecycle
Local-first 경계
Markdown record의 의미
Golden Path와 Non-goals
```

제품 의미가 바뀌면 코드를 먼저 고치지 않고 제품 명세를 먼저 수정·승인한다.

### 구현 계획

이 문서는 다음을 소유한다.

```text
현재 진행 slice
각 slice의 Claim/Scope/Evidence/Stop
기술적 위험과 보류 결정
완료 evidence와 commit
다음 실행 단위
```

### Stable landing 업데이트

각 slice가 끝날 때 같은 변경 흐름에서 이 문서를 갱신한다.

```text
1. slice 상태를 complete로 변경
2. 실제 구현된 범위를 기록
3. 실행한 verifier와 결과를 기록
4. 남은 위험과 발견된 질문을 기록
5. 다음 slice를 next로 표시
6. code와 docs가 같은 현실을 설명하는지 확인
```

계획이 바뀌면 기존 기록을 지우고 성공한 것처럼 다시 쓰지 않는다. 변경 이유를 `결정 기록`에 append한다.

---

## 3. 현재 현황

| 항목 | 상태 | Evidence |
| --- | --- | --- |
| Product Spec | Accepted baseline | `docs/product-spec-v0.1.ko.md` |
| Package scaffold | Complete | private `@hobin/observer@0.0.0` baseline |
| Runtime implementation | Slice 8 in progress | One-shot OPEN/OFF request + inline capture complete |
| Previous implementation | Archived only | `archive/observer-v0.1` |
| Git/remote integration | Out of scope | Product Spec Non-goals |
| Current slice | In progress | Slice 8 — One-shot Golden Path |
| Next movement | Requires routing | OFF pending-request tool-result capture |

### 현재 branch checkpoint

```text
feature/observer
├─ c7a6165 chore(observer): scaffold spec-first package
├─ cf0ac38 docs(observer): define v0.1 implementation plan
├─ a45c1ac feat(observer): validate Markdown profile records
├─ 192a634 feat(observer): validate notebook graph integrity
├─ 84febc2 feat(observer): add pure lifecycle machine
├─ c93e4f9 feat(observer): add notebook setup and recovery
├─ b3640f4 feat(observer): persist approved wrap batches
├─ 6b92a94 feat(observer): integrate Pi command lifecycle
├─ 5f3042d feat(observer): reconcile working memos
├─ dc9fdb6 feat(observer): add source-first sidecar ledger
├─ fbd3e62 style(observer): format memo and session sources
├─ a34734e feat(observer): add pure memo trigger
├─ c52125f style(observer): format sidecar sources
├─ eb56b39 feat(observer): trigger staged memo scope
├─ c6da53f style(observer): format memo trigger sources
├─ 3d366e7 feat(observer): apply staged memo instructions
├─ cfae6f7 style(observer): format memo preparation tests
├─ b42e9f9 fix(observer): preserve sidecar null semantics
├─ 273e98a style(observer): format sidecar ingress repair
├─ 4cc82e7 feat(observer): project memo preparation guide
├─ 94de94d style(observer): format memo preparation guide
├─ f236cbf feat(observer): expose exact memo preparation contract
├─ 7a970bd style(observer): format memo tool contract
├─ af4e088 fix(observer): accept semantic-only memo submissions
├─ b3b7525 fix(observer): replay memo source basis at install
├─ 40b6be0 style(observer): format memo install repair
├─ 7dc10ce fix(observer): encode memo revise disposition
├─ ebe2aca style(observer): format memo outcome projection
├─ a18dc90 fix(observer): replay memo source basis at apply
├─ b8539f3 feat(observer): bind pure wrap requests
├─ ce5f4e4 style(observer): format wrap request sources
├─ 1c4c44e feat(observer): expose wrap request scope
├─ 8f78d2d style(observer): format wrap scope tests
├─ c5f6634 feat(observer): complete approved wrap flow
├─ 05e4917 style(observer): format wrap completion sources
├─ 79f5be6 fix(observer): validate memo before instruction
├─ f0ee01d docs(observer): record memo boundary repair
├─ 62b58eb fix(observer): hand off wrap scope once
├─ 63f9925 style(observer): format wrap handoff prompt
├─ 3a8d65b fix(observer): explain wrap markdown rules
├─ 23e0b7f docs(observer): record live wrap completion
├─ b6aca1b docs(observer): close sidecar golden path
├─ 95cf2a2 feat(observer): define pure one-shot protocol
├─ 93787d7 style(observer): format one-shot protocol
├─ 778a288 feat(observer): open one-shot lifecycle episodes
└─ Slice 8 landing A-3: request-before-inline-candidate
```

---

## 4. 전체 완료 주장

Observer v0.1 구현은 다음 두 Golden Path를 실제 Pi에서 증명할 때 멈춘다.

### Sidecar

```text
setup
→ on
→ 다른 학습 작업과 자료 관찰
→ 사용자 가설 추적
→ Hybrid 중요 변화 알림
→ memo
→ 계속 관찰
→ wrap proposal
→ 사용자 승인
→ local save
→ OFF
→ fresh session re-entry
```

### One-shot

```text
Observer OFF
→ 자료를 Observer 관점으로 요청
→ open episode의 pending inquiry/memo 업데이트
→ Mode OFF 유지
→ memo while OFF
→ wrap
→ local save
→ fresh session re-entry
```

통과한 unit test 수나 구현된 endpoint 수만으로 v0.1 완료를 주장하지 않는다.

---

## 5. Architecture Baseline

### 5.1 독립 package

Observer는 `@hobin/developer` 또는 `@hobin/learning`을 runtime dependency로 사용하지 않는다.

- Developer는 구현 작업을 조정하는 개발 도구다.
- Learning은 Observer가 함께 작동할 수 있는 사용자 workflow다.
- Observer는 두 package의 내부 상태나 public contract를 변경하지 않는다.

### 5.2 Archive의 역할

`archive/observer-v0.1`은 다음 용도로만 사용한다.

```text
source audits
failure evidence
characterization cases
정확히 맞는 leaf behavior 비교
```

다음을 하지 않는다.

```text
archive package 전체 import
기존 orchestration을 새 baseline으로 사용
검증 없이 module 복사
기존 endpoint 수를 목표로 복원
```

### 5.3 Local-first

Observer의 durable effect는 선택된 로컬 notebook에 기록하는 데서 끝난다.

```text
Observer owns:
Source/Inquiry/Memo/Zettel local persistence

Observer does not own:
Git, GitHub, sync, remote backup, graph DB, vector DB
```

---

## 6. Developer 상태 머신 패턴 재사용

### 6.1 가져올 패턴

Developer의 다음 구조를 Observer 도메인에 다시 적용한다.

```text
명시적 Domain State
+ 정규화된 Event decoder
+ pure reducer
+ XState guards/parallel state projection
+ Pi branch entry replay
```

Wished surface:

```ts
initialObserverState()
normalizeObserverEvent(value)
canApplyObserverEvent(state, event)
applyObserverEvent(state, event)
observerSnapshot(state)
reconstructObserverState(branchEntries)
```

### 6.2 직접 재사용하지 않을 것

```text
DeveloperState
route/question/judgment event
Developer tool-policy
Developer machine.ts import
Developer package runtime dependency
```

Observer가 필요하면 자신의 `xstate` dependency를 선언한다. 공통 state-machine abstraction은 두 package의 실제 반복 압력이 확인되기 전에는 추출하지 않는다.

### 6.3 상태 머신의 책임

상태 머신이 소유한다.

```text
Mode: OFF | ON
Episode: EMPTY | OPEN | REVIEWING_WRAP | SETTLED
selected notebook identity
snapshot된 episode language
현재 wrap proposal identity
compact memo/wrap receipt metadata
legal transition guards
branch replay
```

상태 머신이 소유하지 않는다.

```text
Source/Memo/Zettel 전체 본문
전체 evidence graph
semantic relation 판단
Markdown file I/O
embedding/search index
Git state
```

### 6.4 초기 event 후보

```ts
type ObserverEvent =
  | { kind: "episode-opened"; episodeId; notebookId; lang }
  | { kind: "activation-changed"; enabled: boolean }
  | { kind: "memo-reconciled"; revisionId; receipt }
  | { kind: "wrap-proposed"; proposalId; summary }
  | { kind: "wrap-cancelled"; proposalId }
  | { kind: "wrap-committed"; proposalId; receipt };
```

이 목록은 Slice 2의 transcript cases에서 도출하며 지금 public API로 고정하지 않는다.

### 6.5 핵심 guard

```text
ON
→ valid selected notebook과 episode language 필요

MEMO
→ OPEN episode 필요; Mode는 ON/OFF 모두 허용

WRAP_PROPOSED
→ OPEN episode 필요

WRAP_COMMITTED
→ 현재 proposal ID와 일치
→ validated local save receipt 필요

notebook switch
→ OPEN episode가 없어야 함

OFF
→ episode를 settle하지 않음
```

### 6.6 Durable-first ordering

```text
사용자 wrap 승인
→ proposed records 검증
→ local save
→ saved content 재검증
→ wrap-committed Pi event
→ Episode SETTLED + Mode OFF
```

Filesystem 저장보다 먼저 Pi event가 durable save 성공을 주장하지 않는다.

---

# 7. Slice Plan

## Slice 0 — Package와 제품 계약

**Status:** Complete

### Claim

> Observer는 이전 구현과 분리된 private package와 승인된 제품 기준선을 가진다.

### Implemented

```text
packages/observer/package.json
packages/observer/README.md
packages/observer/LICENSE
packages/observer/docs/product-spec-v0.1.ko.md
packages/observer/docs/implementation-plan-v0.1.ko.md
```

### Evidence

```text
workspace lock importer 존재
package dry-run에 docs/README/LICENSE 포함
Developer 148/148
Learning 22/22
Markdown/JSON diagnostics clean
```

### Stop

Runtime code, dependency, schema, test를 추가하지 않은 docs-only baseline.

---

## Slice 1 — Markdown Profile Fixtures와 Validation

**Status:** Complete

### Claim

> Source, Inquiry, Memo, Zettel 및 direct observation을 Markdown으로 표현하고, 구조 또는 graph invariant를 위반한 기록을 의도한 이유로 거부할 수 있다.

### Scope

```text
정상 Markdown fixtures
- external-material Source
- direct-observation Source
- open Inquiry
- incubating Memo
- mature Zettel

거부 fixtures
- schema/type/ID mismatch
- invalid lang/timestamp/status
- dangling source/lineage/relation
- orphan Memo
- direct Source가 없는 Zettel
- promoted Memo/Zettel lineage 불일치

frontmatter parser
observer-record/v1 JSON Schema
record decoder
notebook graph validator
bounded diagnostics
```

### Non-scope

```text
Pi extension
XState machine
writer
wrap transaction
semantic Zettel quality 자동 판정
RDF/SHACL runtime
Graph DB
```

### State movement

없음. Read-only validation slice다.

### Evidence

```text
각 정상 fixture가 decode + graph validation 통과
각 거부 fixture가 지정된 rule과 record ID로 실패
manual file order와 filesystem order에 결과가 의존하지 않음
unknown field/version 정책이 명시됨
```

### Current evidence — Slice 1 stable landing

```text
JSON Schema 2020-12: schemas/observer-record.v1.schema.json
Pure decoder: src/markdown-profile.ts
Pure graph validator: src/notebook-validation.ts
Valid record fixtures: 5
Local invalid fixtures: 13
Valid notebook records: 6
Graph invalid notebooks: 12
Focused tests: 34/34
TypeScript diagnostics: 0
Type assertions (`as`): 0
```

Phase A는 external/direct Source, Inquiry, Memo, Zettel을 decode하고 Markdown envelope, schema, ID prefix, timestamp order, inquiry revision reason을 검증한다. Phase B는 Phase A를 모두 통과한 record만 받아 ID uniqueness, target existence, self/duplicate edges, Memo/Zettel provenance, lineage endpoint, promotion pairing을 검증한다. 어떤 Phase A 오류가 있어도 graph는 `not evaluated`이며 filesystem 접근은 없다.

### Stop

Validator가 승인된 fixture contract만 보호하고 writer나 generalized ontology를 포함하지 않는 상태.

### Slice 1 설계 결정

```text
[x] Source locator: optional non-empty human-readable string
[x] JSON Schema: 2020-12, observer-record/v1
[x] Unknown field: unprefixed top-level 보존, unknown observer_* 거부
[x] Relation endpoint/multiplicity policy: accepted G1–G9 model
[x] Fixture ID: type-prefixed lowercase RFC 4122 UUID v4
```

Source target type은 별도 graph branch가 아니다. `SourceRef`의 source-prefixed ID, Phase A type/ID agreement, Phase B target existence의 합성으로 보장된다. 도달 불가능한 `graph.source.target-type` fixture와 diagnostic은 만들지 않았다.

Slice 1의 Claim과 Stop은 충족됐다. 다음 movement는 Slice 2의 lifecycle condition과 executable surface를 현재 evidence에서 다시 판단한 뒤 시작한다.

---

## Slice 2 — Pure Observer Lifecycle Machine

**Status:** Complete

### Claim

> on/off, Sidecar, One-shot, memo, wrap lifecycle을 filesystem과 Pi UI 없이 결정론적으로 적용하고 replay할 수 있다.

### Scope

```text
ObserverState
ObserverEvent decoder
pure reducer
XState parallel machine
guards/tags
snapshot projection
branch-entry replay
```

### Required cases

```text
OFF → ON → MEMO → WRAP proposal → cancel → OPEN
OFF → One-shot로 Episode OPEN, Mode는 OFF
Mode OFF에서 MEMO 허용
ON → OFF, Episode OPEN 유지
잘못된 proposal ID commit 거부
validated receipt 없는 wrap commit 거부
wrap commit → SETTLED + OFF
같은 event replay → 같은 state
branch fork → fork별 state
```

### Non-scope

```text
Markdown I/O
Pi command/UI
실제 Memo 내용
Model inference
```

### Evidence

```text
Pure lifecycle: src/lifecycle.ts
XState projection: src/lifecycle-machine.ts
Normalized event kinds: 6
Decoder valid/invalid cases: 17
Transition cases: 13
Replay/XState cases: 5
Lifecycle focused tests: 35/35
Observer package tests: 69/69
TypeScript diagnostics: 0
Type assertions (`as`): 0
```

Transition table은 Sidecar, One-shot, OFF memo, off-preserving-open, proposal cancel, stale ID, unvalidated receipt, settle+OFF, episode reopen을 구분한다. Replay는 malformed/illegal entry를 index와 stage로 보고하면서 다음 entry를 계속 처리하고, 같은 ordered input과 shared-prefix branch fork에 대해 결정적이다.

XState는 별도 lifecycle policy를 소유하지 않는다. `src/lifecycle.ts`의 guard/reducer를 호출하고 Mode와 Episode를 parallel state/tag로 projection한다. 모든 legal trace step과 rejected transition에서 reducer state와 machine context가 일치한다.

`wrap-committed`의 `validated` status는 filesystem 검증 결과를 나타내는 evidence token이다. Slice 2는 token을 소비할 뿐 실제 save/readback truth를 만들지 않으며, 그 책임은 Slice 4에 남긴다.

### Stop

Transcript의 legal lifecycle만 표현하며 notebook/persistence 구현을 포함하지 않는 pure module. 충족됨.

---

## Slice 3 — Notebook Setup과 Language Binding

**Status:** Complete

### Claim

> 사용자가 로컬 notebook과 ko/en 기본 생성 언어를 선택하고 다음 process/session에서 같은 설정을 다시 열 수 있다.

### Scope

```text
notebook initialize/open
notebook identity/manifest
한 시점에 하나의 selected notebook
ko/en default language
episode language snapshot
read-only status projection
```

### Non-scope

```text
Zettel/Memo writer
Git repository initialization
notebook migration
여러 notebook 동시 episode
```

### Evidence

```text
Manifest/layout boundary: src/notebook.ts
Atomic single-file publication: src/atomic-file.ts
Selection persistence: src/notebook-selection-store.ts
Setup/recovery collaboration: src/notebook-service.ts
Lifecycle notebook-selected event: src/lifecycle.ts
Notebook setup focused tests: 24/24
Lifecycle focused tests: 37/37
Observer package tests: 95/95
TypeScript diagnostics: 0
Type assertions (`as`): 0
```

검증된 동작:

```text
새 folder와 기존 folder setup
strict observer-notebook/v1 manifest
stable notebook UUID + canonical absolute root
fresh service에서 selected notebook recovery
missing/corrupt/unsupported manifest rejection
malformed/null selection과 stale path/ID 구분
OPEN/REVIEWING 중 다른 ID 또는 같은 ID·다른 path switch 거부
ko/en notebook default와 episode language snapshot 분리
기존 Markdown exact bytes와 status read-only 보존
records/*.md를 Slice 1 decoder/graph validator로 검증
selection publication 실패 후 selected state 미주장
```

v1 layout은 `<root>/.observer/notebook.json`과 direct regular `records/*.md`다. Record filename은 canonical record ID가 아니며, nested/symlink/non-Markdown record entry는 silent drop 없이 layout error다. Selection file 위치는 caller가 absolute path로 주입하므로 cwd나 숨은 global default를 사용하지 않는다.

Manifest initial create는 no-replace이고 manifest/selection update는 같은 directory의 temporary file을 rename하는 atomic visible replacement다. fsync 기반 crash durability, concurrent writer coordination, cross-file atomicity는 주장하지 않는다.

### Stop

Knowledge record를 쓰지 않고 notebook identity와 language만 안정적으로 복구하는 상태. 충족됨.

---

## Slice 4 — Wrap Local Persistence

**Status:** Complete

### Claim

> 준비된 wrap proposal을 사용자가 승인하면 검증된 Source/Inquiry/Memo/Zettel이 로컬에 일관되게 저장되고 fresh read로 다시 열리며, 성공 후에만 episode가 settle된다.

### Scope

```text
prepared wrap proposal
사용자 승인 input
record batch preflight
schema + graph validation
local publication
save receipt
saved-content readback
wrap-committed ordering
fresh notebook reopen
```

### Non-scope

```text
Model이 proposal을 생성하는 과정
memo reconciliation
Git commit/push
Graph/vector projection
모든 OS crash scenario의 일반화
```

### Evidence

```text
Exact content hash: src/content-hash.ts
Exact notebook inventory: src/notebook.ts
Prepared/approval profile: src/wrap-profile.ts
Pure E/B/F preflight: src/wrap-preflight.ts
Stage/publish/rollback: src/wrap-transaction.ts
Durable-first coordinator: src/wrap-service.ts
Wrap focused tests: 11/11
Observer package tests: 106/106
TypeScript diagnostics: 0
Type assertions (`as`): 0
```

검증된 동작:

```text
approved create의 exact Markdown save + fresh reopen
exact SHA-256 update와 기존 path 보존
update Memo + create Zettel의 final graph validation
approved empty batch
approval/proposal/notebook/root/language mismatch의 zero-write rejection
duplicate/create collision/update missing/stale/invalid graph의 preflight rejection
non-target inventory drift의 first-write 이전 rejection
stage/publish/readback fault의 reverse rollback
unknown concurrent bytes를 덮지 않는 recovery-required
receipt ID/path/hash와 fresh files 일치
receipt 검증 후에만 SETTLED + OFF
duplicate settled commit과 active transaction overlap 거부
```

Create는 decoded stable ID에서 `records/<id>.md`를 만들고, update는 existing path와 exact-byte SHA-256 precondition을 보존한다. Batch B만이 아니라 existing E에 B를 치환한 final F 전체를 Slice 1 validator로 검증한다.

Transaction은 `.observer/transactions/active/`에 stage와 update before-image를 모두 준비한 뒤 snapshot을 다시 검사하고 deterministic order로 publish한다. Expected failure에서는 reverse rollback을 시도한다. Rollback 대상 bytes가 planned next hash와 다르면 외부 edit를 파괴하지 않고 `recovery-required`를 반환한다.

보장 범위는 validation-before-write, stage-all, expected-failure rollback, fresh-read receipt, durable-first lifecycle ordering이다. fsync/power-loss durability, 모든 crash 시나리오, concurrent external editor 보존, 자동 crash recovery는 주장하지 않는다.

### Stop

Prepared data로 최초 local durable vertical slice가 증명된 상태. 충족됨.

### Slice 4 설계 결정

```text
[x] create/update batch: explicit operation, stable ID, update path preservation
[x] manual edit policy: exact-byte SHA-256 mismatch 시 overwrite 없이 거부
[x] expected write failure: safe reverse rollback 후 retry 가능
[x] rollback precondition mismatch: recovery-required, 자동 retry 금지
[x] process crash: lifecycle commit을 주장하지 않으며 universal atomicity는 보류
```

---

## Slice 5 — Pi Commands와 Branch Replay

**Status:** Complete

### Claim

> 실제 Pi에서 setup/status/on/off/wrap lifecycle이 작동하고 restart·branch fork·compaction 이후 상태가 올바르게 복구된다.

### Scope

```text
Pi extension entry
/observe setup
/observe status
/observe on
/observe off
/observe wrap (prepared proposal 사용)
session entry encoding/decoding
branch replay
compact status/footer
```

### Non-scope

```text
Memo model behavior
Hybrid observation
One-shot semantic analysis
복잡한 TUI panel
```

### Evidence

```text
Strict branch entry/replay: src/pi-session.ts
Command grammar/coordinator: src/observer-command.ts, src/observer-controller.ts
Korean status/footer: src/observer-status.ts
Post-save acknowledgment recovery: src/wrap-acknowledgment.ts
Pi adapter: extensions/observer.ts
Focused branch/controller/Pi tests: 23/23
Observer package tests: 129/129
Offline Pi 0.80.10 RPC smoke: setup/status/on/off passed
Pack dry-run: 25 intended files
TypeScript diagnostics: 0
Type assertions (`as`): 0
```

검증된 동작:

```text
explicit setup root + ko/en, next-process selection recovery
EMPTY/SETTLED에서 새 episode open, OPEN/REVIEWING resume
off가 Mode만 끄고 OPEN episode를 보존
malformed Observer-owned branch entry에서 fail-closed mutation block
prepared handoff → proposal → approval attempt → local save/readback → commit entry
wrap decline에서 canonical record write 없음
save 완료/session acknowledgment 전 gap의 exact-final recovery
before-state 자동 write 금지, mixed/active state recovery-required
same-file ancestry, persisted restart, extracted branch isolation
compaction entry 전후 lifecycle stutter
status의 notebook/replay/persistence/prepared health와 정직한 미집계 semantic counts
package `/observe` discovery와 extension shutdown status cleanup
```

Pi branch 기준 데이터는 `getBranch()` ancestry의 `observer.lifecycle`, `observer.prepared-wrap`, `observer.wrap-attempt` custom entry다. Compaction summary나 LLM context는 lifecycle 기준 데이터가 아니다. Observer-owned entry decode/transition issue가 하나라도 있으면 status 외 mutation을 진행하지 않는다.

Selection metadata는 `getAgentDir()/observer/selection.json`에 저장하며 `PI_CODING_AGENT_DIR` override를 따른다. 이 agent-state 경로는 notebook default가 아니다. Notebook root와 ko/en은 setup에서 명시적으로 받는다.

Prepared proposal identity는 strict normalized handoff의 SHA-256이다. 승인 시 attempt entry를 filesystem effect보다 먼저 append하고, fresh receipt 뒤에만 committed entry를 append한다. Restart에서 matching attempt, no active transaction, exact approved final bytes, valid full graph가 모두 확인될 때만 acknowledgment를 복원한다.

보장 범위는 persisted Pi session의 current-branch replay다. Ephemeral session은 현재 process만 보장하며 status에 표시한다. Active transaction 자동 repair, corrupt Pi JSONL repair, concurrent command queue, semantic proposal generation은 Slice 5 밖이다. RPC는 setup/status/on/off를 실제 Pi에서 수행했고, prepared wrap의 decline/approve/recovery는 같은 command controller와 real notebook service integration으로 수행했다.

### Stop

실제 Pi command lifecycle과 local persistence가 연결되지만 semantic observation은 아직 없는 상태. 충족됨.

### Slice 5 설계 결정

```text
[x] current branch ancestry만 replay하며 sibling branch를 합성하지 않음
[x] malformed owned entry를 건너뛰지 않고 mutation을 차단
[x] compaction은 lifecycle stutter이며 summary를 state로 사용하지 않음
[x] setup은 explicit absolute root와 ko/en을 요구
[x] duplicate on/off와 exact prepared entry는 append-free/idempotent stutter
[x] prepared approval attempt를 local write보다 먼저 기록
[x] exact final readback만 post-save acknowledgment로 복구
[x] Memo/Hybrid/one-shot/complex TUI는 다음 slice로 보류
```

---

## Slice 6 — Memo Reconciliation

**Status:** Complete

### Claim

> 현재 episode와 관련 standing inquiry의 미승격 Memo를 현재 컨텍스트로 재조정하고, 장기 Zettel 저장 없이 compact receipt와 working revision을 남길 수 있다.

### Initial scope

```text
create
revise
merge
incubate
promotion candidate
사용자 가설 original/current revision 보존
```

### Deferred until observed

```text
복잡한 split
다단계 conflict resolution
대량 Memo prioritization
자동 retire policy
```

### Evidence

```text
[x] 새 prepared pass가 없을 때 반복 memo가 session entry를 추가하지 않음
[x] current episode + 명시적으로 관련된 standing inquiry만 검토
[x] unrelated durable Memo를 scope에 포함하지 않음
[x] 모든 live scoped Memo/hypothesis에 정확히 한 outcome 요구
[x] create/revise/keep/promotion-candidate/merge를 atomic하게 적용
[x] 사용자 가설 origin/original을 revision 뒤에도 보존
[x] merge source를 superseded history로 보존
[x] stale basis, incomplete coverage, duplicate semantic key를 fail-closed 거부
[x] Memo command 전후 notebook inventory bytes 불변
[x] applied working entry 뒤 lifecycle acknowledgment 기록
[x] acknowledgment append gap을 재적용 없이 다음 bind에서 복구
[x] restart/fork/compaction을 current branch ancestry로 복원
```

### Current evidence — Slice 6 stable landing

```text
Observer tests: 142/142
Focused reconciliation/session/controller: 23/23
Actual Pi 0.80.10 RPC: setup/status/on/memo-stutter/off 통과
TypeScript LSP: Slice 6 files clean
Observer TypeScript `as` token: 0
```

구현 surface:

```text
src/memo-profile.ts
src/memo-reconciliation.ts
src/memo-session.ts
src/observer-command.ts
src/observer-controller.ts
src/observer-status.ts
extensions/observer.ts
```

Prepared semantic pass는 strict unknown decoder와 `installPreparedMemo(...)` handoff를 통과한다. `/observe memo`는 notebook을 read-only hydrate하고, complete coverage·basis·provenance 검증 뒤 applied working custom entry를 먼저 기록한다. compact lifecycle `memo-reconciled` acknowledgment는 그 뒤에 기록되며, 두 effect 사이의 실패는 다음 bind에서 pass 재적용 없이 acknowledgment만 복구한다.

Memo working state는 Pi current branch의 custom entry replay 결과다. Compaction summary는 기준 데이터가 아니고, fork는 전달된 ancestry만 복원한다. Durable Markdown Memo/Zettel 저장, source-first relevance 판단, semantic pass 생성, Hybrid 개입은 Slice 7 이후 책임이다.

### Stop

대표 reconciliation cases와 product transcript가 일치하고 Zettel persistence가 발생하지 않는 상태.

Slice 6의 Claim과 Stop은 prepared semantic input 경계에서 충족됐다. 다음 movement는 source-first observation과 Hybrid intervention을 실제 Sidecar Golden Path에 연결하는 Slice 7을 현재 evidence에서 다시 판단한 뒤 시작한다.

### Slice 6 설계 결정

```text
[x] Working Memo/Hypothesis truth는 durable notebook이 아니라 Pi current branch가 소유
[x] prepared → applied → lifecycle acknowledgment 순서
[x] compact lifecycle receipt와 full applied working event 분리
[x] durable incubating Memo는 명시적 related Inquiry scope에서만 read-only overlay
[x] live scoped entity는 정확히 한 outcome을 가져야 함
[x] merge는 새 target을 만들고 source를 superseded로 보존
[x] user hypothesis origin/original 불변
[x] exact pass duplicate/no-prepared retry는 append-free stutter
[x] malformed/stale/conflicting pass와 history는 fail-closed
[x] memo는 Mode/Episode와 notebook Markdown을 변경하지 않음
[x] semantic pass 생성과 relevance 판단은 Slice 7로 보류
```

---

## Slice 7 — Sidecar Golden Path

**Status:** In progress

### Claim

> Observer ON 상태에서 다른 학습 workflow를 방해하지 않고 중요한 변화만 알리며, 사용자 가설과 Memo를 wrap/re-entry까지 이어갈 수 있다.

### Scope

```text
Observer activation context
visible user/main-agent/tool outputs 관찰
source-first pass
standing inquiry relevance
Hybrid interrupt threshold
사용자 가설 acknowledgment
memo → continue → wrap
fresh-session re-entry
```

### Non-scope

```text
Subagent
hidden chain-of-thought 접근
모든 Learning skill과의 전용 adapter
```

### Evidence

승인된 Sidecar transcript를 실제 Pi session과 packed RPC에서 수행한다.

### Stop

한 자료에서 시작해 다른 자료로 standing inquiry가 재활성화되고 wrap 후 fresh session에서 이어지는 상태.

### Landing 7A — Observation ledger와 sequential Sidecar controller

```text
[x] visible user/main-agent/tool result를 current OPEN+ON Episode candidate로 append
[x] Observer 자체 tool/control과 OFF input은 무시
[x] source-read 전 Standing Inquiry 내용을 노출하지 않는 source-first 순서
[x] deterministic StandingIndex를 반환한 뒤 선택한 Inquiry만 hydrate
[x] strict action decoder와 action-specific semantic preflight
[x] candidate → source-read → hydrate → observation/user-H branch replay
[x] minor/support/uncertain observation은 silent accumulation
[x] major counterexample/new hypothesis/direction change/missed mismatch만 Hybrid alert
[x] observation append와 replay 확인 뒤에만 alert/tool success 허용
[x] malformed/unknown/stale/duplicate action은 append-free로 거부 또는 stutter
[x] user hypothesis origin/original과 acknowledged Memo consumption 보존
[x] hidden Sidecar context와 sequential `observer_sidecar` Pi tool 연결
[x] notebook Markdown, Git, subagent, background worker를 변경하지 않음
```

Verifier evidence:

```text
Observer: 154/154
Focused observation controller/prompt/session: 10/10
Pi 0.80.10 RPC package discovery: pass
TypeScript LSP: clean
Observer TypeScript `as` token: 0
```

Remaining Slice 7 work:

```text
Observation batch에서 complete prepared Memo pass를 생성·설치하는 semantic trigger
memo → continue → wrap 실제 Sidecar transcript
packed artifact에서 observer_sidecar staged contract 확인
wrap 후 fresh-session standing Inquiry re-entry
```

Landing 7A는 visible candidate를 source-first로 판정하고 중요한 변화만 append 후 알리는 경계까지 닫는다. Durable Memo/Zettel 저장과 Episode settlement는 여전히 기존 `/observe memo`와 `/observe wrap`의 명시적 경계를 통과해야 한다.

### Landing 7B — Pure Memo request/context/instruction contract

```text
[x] `/observe memo`용 exact all-eligible request planner
[x] OPEN Episode에서 Mode와 독립적인 one-pending-request policy
[x] episode/base revision/ordered Observation event digest를 묶는 request digest
[x] pending retry stutter와 later Observation next-batch 분리
[x] request subset에서만 Related Inquiry와 WorkingSource basis hydrate
[x] unknown nested pass를 parser-refined PreparedMemoPass로 전환
[x] 모든 requested Observation에 정확히 하나의 persisted disposition 요구
[x] pass에 없는 Memo/Hypothesis/Evidence reference 거부
[x] user/Observer hypothesis의 exact Inquiry outcome reference 요구
[x] request → instruction branch replay, exact duplicate stutter, conflict/reorder/fork fail-closed
[x] no Pi hook, no notebook write, no Git, no background worker
```

Verifier evidence:

```text
Observer: 158/158
Focused Memo trigger + Observation/Memo session: 13/13
Package TypeScript LSP: clean
Current-turn lens diagnostics: clean
Changed Observer TypeScript `as` token: 0
```

Remaining Slice 7 work:

```text
`/observe memo` request append/replay와 nontruth Pi agent trigger
`observer_sidecar memo-scope` / `memo-prepare` sequential action
instruction → prepared → applied → acknowledgment failure recovery
memo → continue → wrap 실제 Sidecar transcript
packed artifact contract와 fresh-session re-entry
```

Landing 7B는 raw semantic preparation이 complete Observation disposition과 exact request/scope를 보존하는 refined instruction이 되는 pure 경계를 닫는다.

### Landing 7C — `/observe memo` request trigger와 `memo-scope`

```text
[x] strict `memo-scope` Sidecar action과 TypeBox tool variant
[x] `/observe memo`가 prepared/pending apply path를 기존 controller로 delegate
[x] eligible Observation이 있으면 exact request append + replay confirmation
[x] exact retry는 request append 없이 같은 request resume
[x] request 확인 뒤에만 nontruth `pi.sendMessage` trigger
[x] trigger failure 뒤에도 request truth를 보존해 command retry 가능
[x] Mode OFF + Episode OPEN에서도 pending Memo request와 hidden context 유지
[x] `memo-scope`가 request-only Observation/MemoScope를 tool content로 반환
[x] unknown/extra/stale request action은 append-free fail-closed
[x] request/scope 전후 notebook Markdown exact equality
[x] 이 landing에서는 prepared/applied Memo entry를 생성하지 않음
```

Verifier evidence:

```text
Observer: 161/161
Focused request/scope/controller/prompt/extension: 16/16
Pi 0.80.10 RPC setup/status/on/memo-empty/off: pass
Package TypeScript LSP: clean
Current-turn lens diagnostics: clean
Changed Observer TypeScript `as` token: 0
```

Remaining Slice 7 work:

```text
strict `memo-prepare` Sidecar action
instruction append/replay → prepared install → Memo apply → acknowledgment
instruction/prepared/apply/ack crash-gap recovery
memo → continue → wrap 실제 Sidecar transcript
packed artifact contract와 fresh-session re-entry
```

Landing 7C는 command가 semantic request를 durable-in-session truth로 만든 뒤 request-only context를 agent에 제공하는 순서까지 닫는다. Semantic preparation 제출과 Memo 적용은 아직 연결하지 않았으므로 `/observe memo` completion을 주장하지 않는다.

### Landing 7D — strict `memo-prepare` install/apply/ack

```text
[x] exact `memo-prepare` outer action과 TypeBox tool variant
[x] raw nested instruction을 live request-only context로 strict refinement
[x] malformed/stale/incomplete/conflicting instruction은 effect 전 fail-closed
[x] instruction append 뒤 current-branch replay exact confirmation
[x] exact instruction retry는 append-free resume
[x] replay-confirmed instruction만 PreparedMemoPass encoder/install 경계에 전달
[x] install 성공 뒤에만 existing Memo apply/ack command 실행
[x] instruction/install/apply/ack gap에서 duplicate 없이 `/observe memo` 복구
[x] applied+acknowledged 뒤에만 requested Observation consumption
[x] Mode OFF + Episode OPEN을 유지하고 notebook Markdown exact equality
```

Verifier evidence:

```text
Observer: 162/162
Focused trigger/observation/main-controller/prompt/extension: 29/29
TypeScript LSP: clean
Changed Observer TypeScript `as` token: 0
```

Remaining Slice 7 work:

```text
actual Pi/model-driven source-read → hydrate → record → memo-scope → memo-prepare transcript
memo → continue → wrap approval/save/ack transcript
packed artifact contract
wrap 후 fresh-session standing Inquiry re-entry
```

Landing 7D의 지원 범위는 parser-refined instruction과 기존 Memo effect 경계의 실제 controller collaboration이다. Extension tool registration/package load와 empty RPC는 검증하지만 model이 schema를 따라 nonempty instruction을 생성하는 실제 transcript는 아직 주장하지 않는다.

### Landing 7E — Pi ingress null/error compatibility repair

실제 `openai-codex/gpt-5.3-codex-spark` live eval에서 provider의 `locator: null`이 Pi 0.80.10 `Value.Convert` 뒤 `""`로 바뀌어 strict decoder에 거부됐고, 그 거부가 `isError:false`로 전달돼 model retry가 증폭되는 pass-but-wrong failure를 발견했다.

```text
[x] shared nullable TypeBox schema를 Null-first union으로 변경
[x] Pi 0.80.10 Value.Convert 뒤 explicit null 보존 regression test
[x] strict domain/controller rejection을 throw해 actual tool error로 전달
[x] prepared install failure도 successful JSON이 아닌 actual tool error로 전달
[x] domain decoder, lifecycle, Memo semantics, Markdown write boundary는 변경하지 않음
```

Verifier evidence:

```text
Observer: 164/164
Focused extension/action/controller: 15/15
Package TypeScript LSP: clean
Changed Observer TypeScript `as` token: 0
```

Remaining Slice 7 work:

```text
repaired ingress로 actual source-read → hydrate → record → memo-scope → memo-prepare 재검증
memo → continue → wrap approval/save/ack transcript
packed artifact contract
wrap 후 fresh-session standing Inquiry re-entry
```

Landing 7E 뒤 bounded real-provider rerun은 `source-read → hydrate → record → memo-scope`까지 통과했다. `memo-prepare`에서는 exact request digest, locked identities, complete outcome/evidence shape가 model-facing contract에 없어서 actual tool error로 멈췄다.

### Landing 7F-1 — Pure Memo preparation guide

```text
[x] reconciliation과 동일한 durable/working overlay coverage query
[x] hypothesis/Memo exact current coverage를 project 함수도 공동 사용
[x] refined request UUID에서 deterministic `memo-pass-<same UUID>` 구성
[x] request ID/digest/base/basis/related IDs/instruction ID locked seed
[x] requested semantic Observation에 연결된 SourceRead claims만 evidence source로 projection
[x] baseline/empty/working/retry deterministic tests
[x] 아직 Pi response와 TypeBox outcome schema는 변경하지 않음
```

Verifier evidence:

```text
Observer: 166/166
Focused Memo reconciliation/trigger/session: 18/18
TypeScript LSP: clean
Changed Observer TypeScript `as` token: 0
```

Remaining Slice 7 work:

```text
explicit Evidence/Hypothesis/Memo outcome TypeBox schema
memo-scope response에 request digest + MemoPreparationGuide 노출
schema/parser conformance tests
bounded real-provider memo-prepare 재검증
wrap approval/save/ack + fresh-session re-entry
```

Landing 7F-1은 model이 선택할 semantic outcome을 자동 생성하지 않는다. Exact basis와 available scope만 deterministic projection하고 strict contextual decoder를 semantic authority로 유지한다.

### Landing 7F-2 — Exact model-facing Memo contract

```text
[x] memo-scope가 exact request_digest와 MemoPreparationGuide 반환
[x] hidden guidance가 locked instruction_seed 복사와 exact coverage를 지시
[x] stable ID마다 lowercase UUID-v4 TypeBox pattern
[x] EvidenceItem exact schema와 Null-first source_id
[x] Hypothesis outcome 3개 clause와 nested draft exact schema
[x] Memo outcome 5개 clause와 nested draft/revision exact schema
[x] contextual memo-prepare instruction_id는 nullable이 아닌 request ID
[x] disposition exact schema
[x] 모든 clause Value.Check, null conversion, wrong prefix/null instruction 거부
[x] TypeBox success 뒤에도 contextual decoder가 유일한 semantic authority
```

Verifier evidence:

```text
Observer: 167/167
Focused extension/memo-trigger/observation-controller/prompt: 20/20
TypeScript LSP: clean
Changed Observer TypeScript `as` token: 0
```

Remaining Slice 7 work:

```text
bounded real-provider memo-prepare → install → applied → acknowledgment rerun
memo → continue → wrap approval/save/ack transcript
packed artifact contract
wrap 후 fresh-session standing Inquiry re-entry
```

Landing 7F-2 bounded rerun에서 model은 locked basis와 semantic outcome 내용을 정확히 개선했지만 세 번 모두 `dispositions`를 `instruction.pass` 안에 중첩했다. Full instruction 복사 자체가 producer-owned representation을 model에 불필요하게 맡긴다는 새 failure evidence가 됐다.

### Landing 7F-3 — Semantic-only Memo submission

```text
[x] memo-prepare raw action을 request_id + submission 한 단계로 축소
[x] submission은 evidence/hypothesis_outcomes/memo_outcomes/dispositions만 허용
[x] locked request/pass fields는 fresh MemoPreparationGuide에서 controller가 조립
[x] raw outer submission은 array shape만 refine하고 semantic truth를 주장하지 않음
[x] assembled unknown instruction을 contextual decoder가 다시 complete refinement
[x] caller의 instruction/locked field injection은 effect 전 거부
[x] malformed semantic submission은 instruction entry 0
[x] hidden prompt와 submission_seed가 같은 one-level shape를 지시
```

Verifier evidence:

```text
Observer: 167/167
Focused action/controller/schema/prompt: 20/20
TypeScript LSP: clean
Changed Observer TypeScript `as` token: 0
```

Remaining Slice 7 work:

```text
bounded real-provider semantic-only memo-prepare 재검증
memo → continue → wrap approval/save/ack transcript
packed artifact contract
wrap 후 fresh-session standing Inquiry re-entry
```

Landing 7F-3은 model의 semantic 선택을 자동화하지 않는다. Model은 semantic arrays만 제안하고, producer는 locked representation을 소유하며, contextual decoder가 effect 전 최종 경계를 유지한다.

7F-3 bounded rerun에서 model은 첫 시도에 exact one-level semantic submission을 생성했고 instruction append까지 통과했다. 이어 prepared-pass installer가 `workingSourceBases: []`로 scope를 다시 구성해 `Prepared Memo pass has a stale or mismatched basis`로 실패했다. 이는 model failure가 아니라 preparation/installation scope reconstruction 불일치였다.

### Landing 7F-4 — Source-bearing install basis replay

```text
[x] prepared-pass installer가 current branch Observation history를 strict replay
[x] instruction_id를 exact pending Memo request로 refine
[x] preparation과 같은 hydrateObservationMemoContext owner를 재사용
[x] request-related WorkingSource만 Memo scope basis에 포함
[x] Observation replay/context failure는 prepared append 전 거부
[x] source-empty manual prepared pass의 기존 경로 유지
[x] source-bearing Memo integration이 instruction → prepared → applied → ack 완주
```

Verifier evidence:

```text
Focused trigger/observation/lifecycle controllers: 22/22
TypeScript LSP: clean
Changed Observer TypeScript `as` token: 0
```

Remaining Slice 7 work:

```text
bounded real-provider source-bearing rerun
memo → continue → wrap approval/save/ack transcript
packed artifact contract
wrap 후 fresh-session standing Inquiry re-entry
```

Landing 7F-4는 branch replay durability나 concurrent instance를 새로 주장하지 않는다. 현재 Pi branch ancestry 안에서 preparation과 installation이 동일한 request-scoped basis owner를 사용한다는 범위만 닫는다.

7F-4 이후 동일 fixture를 두 번 재실행했으나 provider는 rich Memo revision을 만들면서도 독립 outer field `disposition`을 매번 누락했다. 한 run은 같은 Memo에 revise와 keep-incubating도 동시에 제출했다. TypeBox union 오류가 관련 없는 다른 branch diagnostic부터 노출해 controller에는 도달하지 못했다.

### Landing 7F-5 — Explicit model-facing Memo revise variants

```text
[x] model raw revise를 revise-incubating/revise-promotion-candidate로 분리
[x] strict raw sum parser가 legacy revise/extra field를 effect 전 거부
[x] total lowering이 기존 domain revise + disposition으로 변환
[x] nested IDs/drafts/coverage/reference/basis는 contextual decoder가 계속 소유
[x] domain MemoOutcome와 persisted instruction/session format은 변경 없음
[x] hidden prompt가 exactly-one kind와 revise+keep 금지를 명시
[x] 양쪽 revise lowering, legacy, additional field, zero-effect tests
```

Boundary:

```text
unknown provider outcome
→ exact six-variant raw parser
→ total domain-shape lowering
→ fresh locked instruction assembly
→ contextual domain decoder
→ instruction append
```

Verifier evidence:

```text
Focused action/schema/controller/prompt/trigger: 20/20
TypeScript LSP: clean
Changed Observer TypeScript `as` token: 0
```

Remaining Slice 7 work:

```text
bounded real-provider explicit-revise rerun
memo → continue → wrap approval/save/ack transcript
packed artifact contract
wrap 후 fresh-session standing Inquiry re-entry
```

Landing 7F-5는 model semantic truth나 exact-one을 TypeBox로 증명하지 않는다. Disposition omission만 raw variant에서 불가능하게 만들고, duplicate/completeness 의미는 기존 contextual decoder가 계속 fail-closed한다.

7F-5 bounded rerun에서 provider는 첫 시도에 `revise-incubating`을 정확히 사용했고 instruction/prepared install까지 성공했다. 그러나 `/observe memo` apply revalidation이 별도 `workingSourceBases: []` 경로를 사용해 다시 stale basis로 실패했다. 기존 integration fixture의 WorkingSource ID가 durable Source ID와 우연히 같아 이 차이를 가리고 있었다.

### Landing 7F-6 — Apply-time request scope replay

```text
[x] install/apply가 같은 preparedMemoScope owner를 사용
[x] instruction-bearing pass는 exact pending-request context를 replay
[x] instruction_id null manual pass는 source-empty fallback 유지
[x] replay/context failure는 observer.memo-pass append 전 거부
[x] integration WorkingSource ID를 durable fixture와 비충돌로 변경
[x] non-colliding source-bearing pass가 instruction → prepared → applied → ack 완주
```

Verifier evidence:

```text
Focused Observation/controller: 17/17
TypeScript LSP: clean
Changed Observer TypeScript `as` token: 0
```

Remaining Slice 7 work:

```text
bounded real-provider apply-scope rerun
memo → continue → wrap approval/save/ack transcript
packed artifact contract
wrap 후 fresh-session standing Inquiry re-entry
```

Landing 7F-6은 apply effect 전에 같은 request-scoped basis를 재확립한다. Crash/power-loss durability나 concurrent instance를 새로 주장하지 않는다.

### Landing 7F-7 — Bounded real-provider Memo completion evidence

Target:

```text
Pi: 0.80.10
provider/model: openai-codex / gpt-5.3-codex-spark
HEAD: a18dc90
fixture: /tmp/observer-live-eval-a18dc90.mjs
transcript: /tmp/observer-live-eval-transcript.json
```

Observed trace:

```text
source-read → hydrate → semantic observation → off
→ memo-request → memo-scope
→ 2 malformed semantic attempts (zero instruction effect)
→ revise-incubating submission
→ observer.memo-instruction × 1
→ observer.prepared-memo-pass × 1
→ observer.memo-pass(applied) × 1
→ memo-reconciled × 1
→ completed
```

Assertions:

```text
[x] final memo-prepare result ok:true/status:completed
[x] instruction < prepared < applied < memo-reconciled
[x] each Memo entry exactly once
[x] six notebook record digests before/after identical
[x] Memo round bash calls 0
[x] /tmp sandbox removed in finally
```

Remaining Slice 7 work:

```text
memo → continue → wrap approval/save/ack transcript
packed artifact contract
wrap 후 fresh-session standing Inquiry re-entry
```

이 evidence는 한 bounded stochastic run의 실제 completion을 지지한다. Provider reliability rate, model semantic truth, crash/power-loss durability, concurrent/multi-instance 실행은 주장하지 않는다.

### Landing 7G-1 — Pure Wrap request/context/guide

```text
[x] strict observer.wrap-request/v1 decode/encode
[x] request ID + proposal ID + episode/Memo/source/inventory digest binding
[x] current-branch request replay, exact duplicate stutter, conflict fail-closed
[x] wrap-proposed/cancelled/committed proposal이 request를 consume
[x] OPEN + no pending Memo/Observation guard
[x] exact pending request resume와 stale state 거부
[x] locked notebook/root/language/proposal target projection
[x] observed SourceRead + Memo working state + full inventory guide
[x] no Pi hook, no controller mutation, no notebook write
```

Order model:

```text
OPEN/no pending work
→ wrap-requested
→ exact wrap context
→ future prepared handoff
→ existing approval/save/commit core
```

Verifier evidence:

```text
Focused Wrap request/context/guide: 3/3
TypeScript LSP: clean
Lens: changed files clean
Changed Observer TypeScript `as` token: 0
```

Remaining Slice 7 work:

```text
/observe wrap request append/replay + nontruth trigger
observer_sidecar wrap-scope/wrap-prepare schema and producer assembly
approval/save/ack recovery tests
bounded real-provider wrap transcript
packed artifact + fresh-process Standing Inquiry re-entry
```

Landing 7G-1은 model Markdown을 승인하거나 저장하지 않는다. 다음 Pi landing이 refined request event만 append하고, 기존 handoff decoder/preflight/graph validator를 effect 전 authority로 유지해야 한다.

### Landing 7G-2 — Pi Wrap request and read-only scope

```text
[x] /observe wrap가 existing prepared review와 new/resumed request를 구분
[x] refined observer.wrap-request append 후 exact replay 확인
[x] append throw/drop과 stale/pending/conflict fail-closed
[x] request 확인 뒤에만 nontruth observer.wrap-trigger follow-up
[x] strict wrap-scope action + TypeBox variant
[x] Wrap scope가 locked target/source/working/inventory guide 반환
[x] Mode OFF + Episode OPEN에서도 hidden Wrap request context 유지
[x] locked root/notebook/language/proposal/digest를 hidden prompt에서 비노출
[x] no prepared wrap, no wrap-proposed lifecycle, no notebook write
```

Verifier evidence:

```text
Observer: 172/172
Focused action/controller/prompt/extension/wrap: 20/20
TypeScript LSP: clean
Changed Observer TypeScript `as` token: 0
```

Remaining Slice 7 work:

```text
wrap-prepare semantic schema/action + producer-owned handoff assembly
prepared install → user approval/cancel → save/readback → wrap-committed recovery
bounded real-provider wrap transcript
packed artifact + fresh-process Standing Inquiry re-entry
```

Landing 7G-2는 Wrap proposal을 만들거나 승인하지 않는다. Request entry만 branch truth이며 wrap-scope는 read-only다. 다음 landing은 unknown model submission을 existing `decodePreparedWrapHandoff`로 refine한 뒤에만 prepared effect를 허용해야 한다.

### Landing 7G-3 — semantic Wrap preparation and durable completion

```text
[x] strict wrap-prepare action + exact TypeBox model surface
[x] submit-only request_id/summary/records; locked proposal/notebook/root/lang 비노출
[x] fresh exact request/context recheck before handoff assembly
[x] observed Source + current Inquiry + current Memo required-record coverage
[x] create/update operation 및 expected SHA-256 lock
[x] duplicate/missing/wrong-operation/wrong-digest fail-closed
[x] producer-owned PreparedWrapHandoff assembly + existing strict decoder
[x] prepared append 뒤 explicit Pi confirmation
[x] decline → wrap-cancelled, Episode OPEN, notebook write 0
[x] approve → preflight → local save → readback → wrap-committed
[x] successful settlement → Episode SETTLED + Mode OFF
[x] invalid/install failure before prepared effect
```

Verifier evidence:

```text
Focused Wrap/controller/extension/persistence: 44/44
Pi 0.80.10 bounded continue→Memo→Wrap: pass
TypeScript LSP: 47 files clean
Changed Observer TypeScript `as` token: 0
Pi extension coordinator warnings introduced by G2/G3: removed
```

Remaining Slice 7 work:

```text
none — Landing G-4 closes the accepted Sidecar Golden Path boundary
```

Landing 7G-3의 required coverage는 각 observed Source, current working Inquiry, current working Memo ID를 정확히 한 proposed record로 표현하게 한다. Promotion candidate는 같은 Memo record의 durable disposition과 필요 시 추가 Zettel record로 표현할 수 있으며, 추가 records도 기존 Markdown/graph preflight를 통과해야 한다. Live provider reliability와 semantic truth는 아직 주장하지 않는다.

첫 bounded continuation은 unchanged-current Hypothesis revise가 instruction append 뒤 install에서 거부되어 request를 poison하는 기존 Memo ordering gap을 노출했다. `79f5be6 fix(observer): validate memo before instruction`은 exact request-bound `MemoScope`에서 `reconcileMemoPass`를 instruction effect 전에 dry-run하고 install/apply revalidation을 유지한다. 두 번째 run은 Memo completion을 통과했으며, Wrap 단계에서 repeated wrap-scope 후 prepare 없이 종료되는 live guidance gap을 남겼다. `62b58eb`은 one-scope `next_action=wrap-prepare` handoff를 명시했고, 다음 run에서 드러난 Inquiry `revision_reason` authoring gap은 `3a8d65b`의 profile rule projection으로 보완했다.

최종 bounded run:

```text
Pi: 0.80.10
provider/model: openai-codex / gpt-5.3-codex-spark
HEAD: 3a8d65b
script: /tmp/observer-live-wrap-05e4917.mjs
transcript: /tmp/observer-live-wrap-transcript.json

source-read → hydrate → observation → off
→ memo-scope → memo-prepare → prepared → applied → memo-reconciled
→ wrap-request → wrap-scope × 1 → wrap-prepare × 1
→ wrap-proposed → user confirm × 1 → approved attempt
→ local save/readback → wrap-committed → SETTLED+OFF
```

Notebook evidence:

```text
before: 6 records
post-Memo: same 6 names/digests
post-Wrap: 7 records
changed: inquiry.md, memo-incubating.md
created: source-0b7fab8d-d616-49a0-bf35-b80649a0f7a5.md
Wrap round bash calls: 0
```

이 evidence는 한 finite provider completion만 지지하며 model semantic truth나 provider reliability rate로 일반화하지 않는다.

### Landing 7G-4 — packed fresh-process Standing Inquiry re-entry

```text
[x] HEAD 23e0b7f tarball을 fresh consumer node_modules에 extract
[x] packed artifact runtime으로 process 1 explicit setup
[x] persisted selection + local Markdown만 process boundary를 통과
[x] 서로 다른 workspace의 Pi process 2, 둘 다 --no-session
[x] selection bytes process 전후 동일
[x] fresh /observe on → Mode ON + Episode OPEN
[x] 다음 source-read StandingIndex에 exact durable Inquiry ID/current marker
[x] hydrate/record가 같은 fresh process에서 후속 진행
```

Provenance:

```text
Pi: 0.80.10
provider/model: openai-codex / gpt-5.3-codex-spark
packed HEAD: 23e0b7f
tarball: /tmp/observer-reentry-pack/hobin-observer-0.0.0.tgz
script: /tmp/observer-packed-reentry.mjs
transcript: /tmp/observer-packed-reentry-transcript.json
process count: 2
Pi session continuity: none (--no-session × 2)
```

Golden Path judgment:

```text
live provider: source → Memo → approved Wrap → save/readback → SETTLED+OFF
packed fresh process: persisted selection/notebook → new OPEN Episode
                    → next source-read exposes durable Standing Inquiry
```

두 bounded verifier의 합성은 Slice 7 Sidecar Golden Path를 지지한다. 동일 stochastic run의 universal reliability, crash/power-loss durability, concurrent instances, semantic truth는 계속 비주장 범위다.

**Slice 7 Status: Complete**

---

## Slice 8 — One-shot Golden Path

**Status:** In progress

### Claim

> Observer OFF 상태의 scoped 요청도 open episode의 relevant inquiry와 Memo를 실제 업데이트하며, Mode를 켜지 않고 memo/wrap까지 이어갈 수 있다.

### Scope

```text
one-shot intent detection 또는 최소 explicit surface
Mode OFF 유지
Episode OPEN 생성/재사용
pending inquiry revision
Mode OFF에서 memo/wrap
```

### Evidence

승인된 One-shot transcript를 실제 Pi session과 packed RPC에서 수행한다.

### Stop

Sidecar와 One-shot이 같은 state, record, persistence model을 사용하고 서로 다른 별도 architecture를 만들지 않는 상태.

### Landing 8A-1 — pure One-shot trigger/session protocol

```text
[x] inline-user-message | retrieved-tool-results exact sum
[x] strict one-shot-start action shape + latest user digest refinement
[x] opaque OneShotIntent with producer-owned request ID and exact text
[x] request event stores material meaning without treating instruction as Source
[x] request/completion codec + current-branch replay
[x] duplicate stutter, identity conflict, overlap, reorder fail-closed
[x] completion requires every request candidate → SourceRead → Observation
[x] at least one semantic Observation required
[x] no lifecycle, candidate, prompt, Pi, Markdown effect
```

Verifier evidence:

```text
One-shot focused: 4/4
Observer: 176/176
LSP: 49 files clean
Pi-lens changed files: clean
Packed files: 39
Packed tests: 0
TypeScript assertion-expression scan: 0
```

Design correction before implementation:

```text
automatic exact-user candidate
→ rejected for path/URL instructions that are not Source material
→ start material is now an exact sum
   inline-user-message: exact user text becomes future candidate
   retrieved-tool-results: waits for future request-linked tool result
```

### Landing 8A-2 — OPEN/OFF lifecycle capability

```text
[x] lifecycle owner consumes only refined OneShotIntent
[x] selected notebook recovery precedes lifecycle effects
[x] EMPTY/SETTLED opens a new Episode; OPEN reuses exact Episode
[x] replay-confirmed OFF + OPEN returns opaque OneShotEpisodeCapability
[x] capability binds request, Episode, notebook, and language identity
[x] Mode ON, wrap review, malformed replay, recovery mismatch fail closed
[x] append throw/drop returns no capability and remains retryable
[x] activation-changed(true) is never appended
[x] no one-shot request, candidate, prompt, Pi, or Markdown effect
```

Verifier evidence:

```text
Observer controller + One-shot focused: 19/19
Observer: 178/178
LSP: 49 files clean
Pi-lens new lifecycle complexity: cleared
Packed files: 39
Packed tests: 0
TypeScript assertion-expression scan: 0
```

Known structural residual:

```text
observer-controller.ts now directly imports 16 modules (threshold 15).
This coordination-module pressure is explicit; behavior-preserving splitting is
not folded into the One-shot lifecycle movement. Existing memoCommand complexity
warning also remains pre-existing.
```

### Landing 8A-3 — request-before-inline-candidate

```text
[x] ObservationController.startOneShot owns request/candidate collaboration
[x] capability and intent identities are checked before request append
[x] one-shot-requested append is replay-confirmed before any candidate
[x] retrieved-tool-results stops pending without user-source contamination
[x] inline-user-message appends exact text and input source once
[x] candidate event digest carries optional exact oneShotRequestId ancestry
[x] old Sidecar candidate bytes remain valid and continue to require Mode ON
[x] OFF replay requires request-before-candidate pending prefix
[x] request/candidate append throw/drop gaps remain retryable
[x] retry with a new producer intent ID resumes the original request/candidate
[x] no SourceRead/hydrate/record, completion, prompt, Pi, or Markdown effect
```

Verifier evidence:

```text
Focused One-shot/Observation/lifecycle: 32/32
Observer: 182/182
LSP changed files: clean
TypeScript assertion-expression scan: 0
```

Known structural residual:

```text
observation-controller.ts now imports 17 modules (threshold 15) because the
One-shot start collaborator crosses lifecycle proof and One-shot protocol.
The existing Observation Session replay coordinator remains high-complexity and
high-fan-out; neither concern was disguised as behavior work in this landing.
```

Remaining Slice 8 work:

```text
OFF pending-request tool-result capture
candidate/read ancestry authorization for source-read/hydrate/record
one-shot-finish Pi action and compact receipt
bounded One-shot → memo → wrap transcript
```

---

## Slice 9 — v0.1 Golden Path Verification

**Status:** Planned

### Claim

> Fresh install에서 Sidecar와 One-shot의 핵심 약속이 restart/re-entry까지 작동한다.

### Evidence matrix

```text
workspace package checks
packed npm tarball contents
Pi 0.82.1 RPC discovery
fresh notebook setup
Sidecar transcript
One-shot transcript
compaction continuity
wrap local save
fresh process standing inquiry re-entry
manual Markdown validation failure
```

### Stop

제품 명세의 Golden Path를 증명한 뒤 멈춘다. 새로운 backend나 편의 기능을 추가하지 않는다.

---

## 8. Verification Rhythm

코드가 생긴 뒤 각 slice에서 다음 순서를 기본으로 사용한다.

```text
1. 변경 파일 LSP/structure diagnostics
2. 가장 좁은 focused tests
3. package check
4. diff와 public surface inspection
5. 필요할 때만 packed/RPC integration
6. implementation plan status update
7. stable landing commit
```

Green test는 claim과 연결될 때만 evidence로 사용한다.

---

## 9. Endpoint Budget

제품 명세의 사용자 command 외에 public endpoint를 선제적으로 추가하지 않는다.

### 현재 승인된 human surface

```text
/observe setup
/observe status
/observe settings
/observe on
/observe off
/observe memo
/observe wrap
```

### 승인된 자연어 surface

```text
자료를 Observer 관점으로 봐달라는 One-shot
사용자가 명시적으로 제안하는 가설
특정 Memo/Zettel의 언어 override
```

Model tool의 이름과 개수는 Slice 6/7의 실제 collaboration에서 도출한다. 기존 archive의 tool 목록을 복원하지 않는다.

새 endpoint는 최소한 다음을 답해야 한다.

```text
Object
Caller
Precondition
Effect tier
Receipt
Handoff
Forbidden responsibility
```

---

## 10. Effect Ordering

### Read-only

```text
status
record decode
notebook validation
standing inquiry candidate selection
```

### Pi session/working state

```text
on/off
open episode
pending hypothesis revision
memo reconciliation receipt
wrap proposal
```

### Local durable notebook

```text
wrap 승인 후 Source/Inquiry/Memo/Zettel save
```

### External

```text
Git
remote sync
Graph/vector service
```

External tier는 v0.1 Observer가 소유하지 않는다.

---

## 11. Risks와 결정 시점

| 위험 | 지금의 처리 | 다시 결정할 slice |
| --- | --- | --- |
| Source locator가 너무 일반화됨 | 정상/거부 fixture에서 대표 media만 모델링 | Slice 1 |
| State machine context가 지식 본문을 흡수함 | lifecycle metadata로 제한 | Slice 2 |
| Notebook transaction이 과도하게 복잡해짐 | accepted failure claim부터 모델링 | Slice 4 |
| Pi session replay와 local working recovery가 중복됨 | ownership을 분리해 증명 | Slice 5/6 |
| Hybrid가 원래 학습을 방해함 | interrupt threshold를 transcript로 검증 | Slice 7 |
| One-shot이 예기치 않은 state mutation을 만듦 | receipt/status와 wrap에서 공개 | Slice 8 |
| Graph/vector 확장 압력이 core를 키움 | Markdown projection contract만 유지 | v0.1 이후 |

---

## 12. 명시적 Deferred Work

```text
Subagent observer
Graph DB
RDF/JSON-LD runtime
SHACL runtime
Vector DB
Semantic search backend
zk adapter
Obsidian plugin
Graph view
Backlink UI
Tag browser
Git/GitHub integration
Remote sync
Multi-user collaboration
Project/output workflow
Generalized 7-body source ontology
모든 platform/crash/concurrency hardening
```

Deferred 항목은 Golden Path에서 관찰된 막힘이 없으면 다음 slice 후보가 아니다.

---

## 13. `/develop on` 이후 작업 규칙

1. 현재 `Next` slice 하나만 Developer에 제시한다.
2. Developer가 요구하는 제품·모델·설계 판단을 먼저 완료한다.
3. Active implementation route 없이 파일을 변경하지 않는다.
4. 한 movement가 stable landing에 도달하면 route를 닫고 검증한다.
5. 다음 movement 전에 현황과 docs를 갱신한다.
6. Plan이 실제 evidence와 어긋나면 plan을 고치며, 계획을 맞추기 위해 코드를 강행하지 않는다.

### 첫 실행 prompt

```text
/develop on

Observer v0.1 구현 계획의 Slice 1만 수행해줘.

목표:
정상/거부 Markdown fixtures와 observer-record/v1 JSON Schema,
notebook graph validation contract를 만든다.

제외:
Pi extension, XState machine, writer, Git, retrieval, graph DB.

Stop:
모든 정상 fixture가 통과하고 각 거부 fixture가 의도한 이유로
실패하면 멈추고 구현 계획의 현황과 evidence를 갱신한다.
```

---

## 14. 결정 기록

### Plan baseline

```text
- Product Spec을 구현의 의미 기준으로 사용한다.
- Implementation Plan을 진행 현황과 slice evidence의 기준으로 사용한다.
- Developer의 pure event + XState + branch replay 패턴을 Observer에 독립적으로 적용한다.
- Slice 1은 schema/graph fixture validation으로 시작한다.
- Runtime orchestration은 validation과 lifecycle이 각각 독립적으로 증명된 뒤 연결한다.
- docs는 각 stable landing에서 code와 함께 갱신한다.
- Untrusted Markdown을 TypeScript domain value로 연결할 때 `as` 타입 단언을 사용하지 않는다.
- Runtime validator의 type guard와 discriminated union narrowing이 성공 경로의 타입을 보장해야 한다.
- Phase A는 JSON Schema 2020-12 + YAML envelope decoder로 구현하고 filesystem을 소유하지 않는다.
- Phase B는 locally decoded record만 입력으로 받으며 hostile Markdown boundary를 중복 구현하지 않는다.
- Source target type은 Phase A ID/prefix와 Phase B existence의 합성 보장이다. 도달 불가능한 방어 branch를 만들지 않는다.
- Notebook graph diagnostics는 입력 file order와 독립적으로 정렬되고 최대 100개로 제한한다.
- Slice 2 lifecycle policy의 단일 owner는 `src/lifecycle.ts`이고 XState는 delegated parallel projection이다.
- Observer event는 `observer/v1` protocol, exact-key decoder, bounded non-empty identity를 사용한다.
- Mode와 Episode는 독립 축이지만 `ON+EMPTY`, `ON+SETTLED`는 TypeScript state union에서 표현하지 않는다.
- invalid/stale/reordered event는 state를 바꾸지 않고 reason을 반환하며 replay에서는 index/stage issue로 보존한다.
- Replay 순서는 branch별 finite total order이며 merge/concurrency/global dedupe를 소유하지 않는다.
- `validated` local-save receipt의 진실성은 Slice 4 producer boundary가 소유한다.
- XState의 `setup<ObserverState, ObserverMachineEvent>` explicit generic으로 `as` 단언을 피한다.
- Slice 3 notebook identity는 strict manifest의 `notebook-<UUID v4>`이고 path와 독립적이다.
- selected target은 notebook ID와 canonical absolute root를 함께 보존해 copy/move drift를 탐지한다.
- Selection persistence location은 caller가 명시적으로 주입하며 cwd/global fallback을 두지 않는다.
- Notebook default language와 current episode snapshot은 별도 owner이며 default update가 열린 episode나 기존 Markdown을 바꾸지 않는다.
- Open/select/status는 direct `records/*.md`를 Slice 1 validator로 검증하고 validation policy를 복제하지 않는다.
- Manifest create, selection save, language update는 single-file atomic visibility만 보장하며 fsync/concurrent writer/cross-file atomicity는 보류한다.
- Slice 4는 exact reviewed Markdown을 저장하며 decoded record를 다시 encode하지 않는다.
- Update는 existing path를 유지하고 approved exact-byte SHA-256이 현재 bytes와 일치할 때만 허용한다.
- Wrap preflight는 batch만이 아니라 existing E와 proposed B의 final union F를 검증한다.
- Transaction은 stage-all + drift check + deterministic publish + reverse rollback을 소유한다.
- Receipt는 fresh readback 후 실제 ID/path/hash에서 만들며 그 뒤에만 `wrap-committed`를 적용한다.
- Rollback 대상이 planned next bytes와 다르면 외부 edit를 덮지 않고 recovery-required로 멈춘다.
- Crash-fsync, concurrent writer, delete/rename/merge, generalized transaction은 v0.1 Slice 4 보장 밖이다.
- Slice 5 session state는 Pi current branch의 versioned custom entry를 strict decode/fold한 결과다.
- Observer-owned malformed/reordered entry는 fail-closed issue이며 status 외 mutation을 차단한다.
- Prepared proposal은 normalized payload SHA-256으로 attempt와 결합하며 Pi entry ID를 domain identity로 사용하지 않는다.
- Wrap ordering은 prepared → proposed → approved attempt → local save/readback → committed → UI success다.
- Post-save/pre-ack recovery는 no-active-marker + exact approved final bytes + valid full graph를 모두 요구한다.
- `getAgentDir()/observer/selection.json`은 user-selected notebook root를 기억하는 agent state이며 notebook default가 아니다.
- Compaction summary는 Observer state 기준 데이터가 아니며 full branch ancestry replay가 continuity를 소유한다.
- Ephemeral Pi session은 process restart continuity를 주장하지 않고 status에 limitation을 표시한다.
- Pi core는 extension peer dependency이고 lifecycle/notebook/wrap/controller domain modules은 Pi에 의존하지 않는다.
- Slice 6 prepared pass는 strict exact-field decoder와 notebook/source byte-bound basis digest를 통과한다.
- Working Memo/Hypothesis는 Pi current branch custom entry replay가 소유하고 notebook Markdown은 memo 중 read-only다.
- Memo pass는 live scoped Memo/hypothesis 각각에 정확히 한 outcome을 요구하며 invalid batch를 전체 거부한다.
- Applied Memo entry는 normalized pass와 exact scope를 보존하고 replay에서 pure reducer를 다시 적용해 receipt를 검증한다.
- Memo effect ordering은 prepared → applied working event → compact lifecycle acknowledgment다.
- Post-applied/pre-ack gap은 다음 bind에서 acknowledgment만 보충하고 pass를 재적용하지 않는다.
- Exact duplicate/no-prepared memo는 append-free stutter고 malformed/stale/conflicting branch history는 fail-closed다.
- `/observe memo` request는 exact Observation batch를 묶고 `memo-scope` → parser-refined `memo-prepare`만 기존 prepared → applied → acknowledgment 경계에 위임한다.
- Memo instruction append/replay 전에는 prepared effect를 허용하지 않으며 exact retry와 install/apply/ack gap은 duplicate 없이 복구한다.
- Memo completion은 Mode/Episode와 durable Markdown을 변경하지 않고 acknowledged request의 Observation만 consumed 처리한다.
```
