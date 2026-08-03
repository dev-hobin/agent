# Developer runtime protocol

[English](../runtime-protocol.md) | 한국어

이 문서는 persisted `developer/v8` envelope, 모델이 호출하는 다섯 operation, pure
replay, non-authoritative result summary, receipt projection을 설명합니다. 사용자 명령은
[사용자 가이드](./user-guide.md)를 보세요.

## Ownership과 값

Developer는 다음 값을 구분합니다.

```text
DeveloperWorkScope  root lifetime과 active invocation 하나 제한
RouteDefinition     stable sign과 strong stable sense
RouteFrame          exact revision, obligations, blockers, support, conclusion
Skill               선택적이며 교체 가능한 collaborator
Judgment result     bounded candidate support
Authorization       replay-current 구현 capability 하나
Landing             consumed authorization과 changed-path provenance
Receipt             accepted event 하나의 read-only projection
```

어떤 ID도 서로 바꿔 쓸 수 없고 source type은 스스로 promote되지 않습니다.

## 다섯 operation

| Operation | Accepted boundary | Runtime movement |
| --- | --- | --- |
| `developer_open_judgment` | Route definition, exact question, obligations, optional owner assignment | Frame과 선택적 routed Skill invocation 열기 |
| `developer_open_context_sources` | Current frame ID와 exact Pi-visible descriptor ID | Atomic material-support batch 하나 관찰 |
| `developer_conclude_judgment` | Applicability, exact nominations, coverage, outcome, stop evidence | Owner를 settle하고 support admit, obligation discharge, resolved일 때만 conclude |
| `developer_authorize_change` | Current concluded frame과 conclusion hash, bounded movement, stable landing, verification target | Process-local root authorization 하나 생성 |
| `developer_record_landing` | Exact active authorization, non-empty changed paths, result, verification observations | Authorization을 소모하고 reroute/verification debt 생성 |

Root는 replay-current scope에서 합법적인 operation만 노출합니다. Context source를 열거나
Skill을 settle해도 파일 변경 권한은 생기지 않습니다.

## Envelope format

Pi custom type이 `developer.runtime`인 entry만 runtime replay에 들어옵니다. Data는 다음
exact canonical envelope여야 합니다.

```text
protocolVersion = developer/v8
eventId
workScopeId
scopeSequence
previousScopeEventSha256
causalRefs[] = { workScopeId, eventId, eventSha256 }
occurredAt
event = { kind, payload }
eventSha256
```

`scopeSequence`와 previous-event hash가 한 scope의 순서를 정합니다. `occurredAt`은 audit
용도일 뿐입니다. Canonical JSON identity는 locale-independent이며 transition effect 전에
unknown field, unsafe number, oversized payload, duplicate causal reference, hash drift를
거부합니다.

## Event kinds

Closed v8 event union에는 18개 kind가 있습니다.

| Group | Kinds |
| --- | --- |
| Scope/root | `work-scope-opened`, `work-scope-closed`, `change-authorized`, `implementation-landing-recorded` |
| Frame/routing | `route-frame-opened`, `route-frame-replaced`, `routing-snapshot-opened`, `routing-page-accounted`, `routing-coverage-completed`, `can-serve-basis-created` |
| Skill lifecycle | `ready-assignment-recorded`, `skill-invocation-started`, `invocation-settled` |
| Support/completion | `support-observed`, `frame-contribution-admitted`, `frame-blocker-resolved`, `obligation-discharged`, `route-frame-concluded` |

Pure reducer가 모든 event를 검사합니다. Byte가 저장됐다는 이유만으로 semantically
rejected envelope가 accepted되지는 않습니다.

## Frame open과 routing

Developer는 Skill과 독립적으로 stable Route를 찾고 bounded ordered descriptor snapshot을
고정한 뒤 exact frame revision을 만듭니다. Routing coverage가 끝나려면 admitted
snapshot의 모든 candidate를 bounded page로 account해야 합니다.

선택적 owner assignment는 capability ID, Skill revision, policy state, target obligation ID,
limit, subquestion, expected contribution, `canServe` basis를 묶습니다. Candidate나 owner
invocation이 0개일 수 있습니다. 한 work scope에서 active invocation이 두 개일 수는
없습니다.

## Context와 Judgment

Context source open은 선택한 Pi-visible descriptor와 method content만 얻습니다. Present
malformed policy는 fail closed하고 absence는 유효합니다. Material open은 support identity를
기록하지만 contribution을 admit하지 않습니다.

Conclusion에서 모든 `branchResultId`는 Judgment에 전달되기 전에 exact current-branch
call/result로 resolve됩니다. 선택적 owner settlement는 closed return variant 하나로
parse됩니다. Judgment output은 candidate support가 되며 frame은 contribution admit과
obligation discharge를 여전히 명시적으로 해야 합니다.

Outcome에 context가 더 필요하거나 dependency가 생기면 current blocker identity와 함께
frame이 열린 채로 남습니다. Resolve되면 conclusion proposal은 frame revision, discharge
ID, stop evidence, exact empty blocker set을 묶어야 합니다.

## Authorization, landing, debt

Authorization은 exact current frame conclusion을 검증해 process-local 값 하나를 만듭니다.
Structural clone과 serialized copy에는 mutation authority가 없습니다.

Landing은 그 authorization을 검증하고 sorted changed path와 verification observation을
저장하며 mutation authority를 소모하고 서로 다른 reroute/verification frame ID를
만듭니다. 해당 Route conclusion이 debt를 따로 해소합니다. Authorization, invocation,
frame, landing debt가 active이면 scope closure는 거부됩니다.

## Replay와 interruption

Replay는 dedicated runtime entry만 branch 순서로 처리합니다.

```text
parse envelope
-> per-scope sequence/hash head와 causal reference 검증
-> semantic event parse
-> candidate accumulator에 root/frame transition 적용
-> entry 전체 accept 또는 exact prior accumulator 유지
```

Full-batch preflight가 append 전에 모든 event를 예측합니다. Append는 prefix-safe합니다.
Persistence가 중간에 멈추면 `finally`에서 reconstruct하고, 저장된 prefix만 accept하며
존재하지 않는 suffix를 만들지 않습니다.

## Evaluator용 tool-result summary

성공한 model-facing operation은 opaque event ID와 bounded plain summary 하나를 반환합니다.

```text
protocol: developer/v8-result
workScopeId: string | null
eventIds: string[]
runtime:
  state: inactive | blocked | idle | frame | authorized
  reroutePending: boolean
  verificationPending: boolean
```

이 serialized summary는 replay input, receipt, authority가 아닙니다. Evaluator는 exact key를
parse하고 `idle`이면서 두 debt flag가 false일 때만 completion을 주장할 수 있습니다.
Matching details가 없거나 malformed이면 outcome publish 전에 실패합니다.

## Receipt와 latest-only publication

Replay-accepted opaque event만 대응하는 18개 receipt kind를 만들 수 있습니다.
Projection과 page identity는 canonical하고 process-local입니다. Page size는 최대 100이며
cursor는 opaque하고 projection-bound입니다.

Refresh coordinator는 최신 successful requested revision만 publish합니다. `Refreshing`,
unavailable, failed-latest, stale publication, stale cursor, stale page, clone 값은 이전
current data를 노출하지 않습니다. Receipt TUI는 exact verified page 하나만 읽고
transition이나 persistence operation을 갖지 않습니다.

## Reload

Safe reload는 current active invocation에 uncertain lifecycle cancellation만 기록합니다.
Effect를 다시 실행하거나 provider failure를 만들지 않습니다. Safe lifecycle marker가
없으면 restart를 요구하고 아무것도 쓰지 않습니다.

## 검토 목록

- `developer.runtime`이 유일한 persistence entry point인가?
- 모든 raw envelope와 semantic variant가 unknown field를 거부하는가?
- Timestamp가 아니라 scope sequence가 순서를 정하는가?
- Candidate가 frame-local admission 전에 obligation에 영향을 줄 수 없는가?
- Child conclusion이 parent를 닫을 수 없는가?
- Replacement가 이전 frame authority를 지우는가?
- Landing이 debt 하나라도 건너뛸 수 없는가?
- Clone된 reconstruction, authorization, projection, cursor, page를 쓸 수 없는가?
- Evaluator가 missing v8 result details를 idle로 해석할 수 없는가?
- Receipt observer가 route, mutate, persist할 수 없는가?
