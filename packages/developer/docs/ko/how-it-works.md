# Developer 동작 원리

[English](../how-it-works.md) | 한국어

Developer는 한정된 coding turn의 root runtime입니다. Routing, invocation order,
support admission, obligation discharge, 파일 변경 승인, landing debt, replay, frame
conclusion을 소유합니다. Judgment는 pure evidence/outcome engine으로 남고, Skill은
교체 가능한 collaborator로 남습니다.

중앙 분리는 다음과 같습니다.

```text
semantic lane: RouteDefinition -> RouteFrame -> admitted support -> conclusion
change lane: concluded frame -> authorization -> landing -> reroute + verification
observer lane: accepted event -> receipt -> exact-current bounded page
```

익숙한 이름을 가졌다는 이유만으로 lane 사이 권한이 이동하지 않습니다.

## 1. Stable Route와 dynamic frame은 다른 값입니다

`RouteDefinition`에는 stable sign과 strong stable sense가 있습니다. 같은 이름의 Skill이
없어도 그 의미가 유효해야 합니다. `RouteFrame`은 revision, question, obligations,
blockers, contributions, discharges, 선택적 conclusion을 가진 정확한 runtime
realization입니다.

어떤 Route든 첫 movement나 terminal movement가 될 수 있습니다. Developer는 고정 phase
pipeline을 강제하지 않습니다. Frame replacement는 새 revision을 만들고 이전 revision의
routing, assignment, invocation, admission, discharge, cursor, conclusion authority를 모두
지웁니다.

## 2. Descriptor-first routing은 유한하고 bounded합니다

열린 frame에서 Developer는 immutable ordered candidate snapshot을 고정합니다. Bounded
page를 account하고 그 admitted snapshot에 대해서만 coverage를 끝냅니다. Coverage는
검토 범위를 증명할 뿐 obligation을 discharge하거나 frame을 conclude할 수 없습니다.

이름이 같은 Skill은 service relation을 만들지 않습니다. Service에는 exact selected
capability, current `canServe` basis, assignment target, invocation, return,
frame-local admission, explicit discharge가 필요합니다.

한 work scope에는 active Skill invocation이 하나만 있을 수 있습니다. 다른 Skill은
context 자료로 열 수 있지만 owner가 되지 않습니다.

## 3. Skill return은 authority가 아니라 candidate입니다

Skill lifecycle:

```text
canServe -> invoked -> returned -> conforming -> admitted -> discharged
```

Return은 `Contribution`, `Dependency`, `NotApplicable`, `NeedsContext`, `Abort` 중 정확히
하나입니다. Provider failure, lifecycle settlement, parsed `Abort`는 서로 다른 사실입니다.
첫 terminal settlement만 유효합니다.

Returned contribution은 contribution-to-obligation edge마다 `useAs`를 가집니다. Current
frame이 exact settlement cause에 맞춰 admit하기 전에는 아무것도 discharge하지 못합니다.
Child frame result, material, tool, Judgment outcome도 같은 candidate-support 규칙을
따릅니다.

## 4. Frame completion은 reducer가 지킵니다

Frame conclusion에는 다음이 모두 필요합니다.

- 모든 current obligation에 current discharge가 있음
- 모든 discharge가 admitted support를 인용함
- Stop evidence가 비어 있지 않고 current임
- 제안한 blocker-set identity가 exact empty current set과 일치함
- Active invocation이나 unresolved blocker가 없음

부정적인 판단도 이 조건을 만족할 수 있습니다. `resolved`는 bounded question에 outcome이
있다는 뜻이며 approval, correctness, authorization이 아닙니다. Current admitted
non-Skill support가 obligation을 증명하면 zero-Skill completion도 유효합니다.

## 5. Judgment는 bounded context와 outcome을 제공합니다

`@hobin/judgment`는 route하거나 mutate하지 않습니다. Developer가 exact Skill owner,
dynamic question, selected branch-local material, compiled optional policy, contribution
coverage, outcome proposal을 공급합니다.

Model boundary의 `branchResultId`는 compact alias일 뿐입니다. Judgment가 사용하기 전에
Developer가 current-branch call, arguments, ordered result, status, content hash를 다시
찾습니다. Selected material은 atomic하게 reacquire하고 seal합니다. `judgment.json`이
없는 것은 정상이며 malformed presence는 fail closed합니다.

`DeveloperContextBasis`는 policy, question, selection, sealed content, coverage, outcome,
sources, members, contributions, conflicts, limitations을 canonical hash로 묶습니다. 이 값은
frame support이지 global service authority나 change authority가 아닙니다.

## 6. Authorization과 landing은 root capability입니다

Current concluded frame만 한정된 change authorization 하나를 만들 수 있습니다. 이 값은
frame revision과 conclusion hash를 movement, stable landing, verification target, 선택적
evidence-preserving implementation boundary에 묶습니다.

Landing 기록은 exact active authorization과 non-empty changed path를 요구합니다. 기록은
승인을 소모하고 서로 다른 frame identity를 가진 causal debt 두 개를 만듭니다.

```text
reroute debt       -> 다음에 무엇이 속하는가?
verification debt  -> 현재 근거가 무엇을 지지하는가?
```

둘은 다음 승인 전에 독립적으로 해소되어야 합니다. Landing은 provenance이지 verified
flag가 아닙니다.

## 7. Runtime history는 하나의 exact v8 chain입니다

Developer는 custom type이 `developer.runtime`인 entry만 저장합니다. 각 `developer/v8`
envelope는 work-scope ID, scope sequence, previous event hash, causal references, event kind,
payload, canonical event hash를 묶습니다. Timestamp는 audit field이며 scope 순서를 정하지
않습니다.

Replay는 entry마다 pure하고 atomic합니다. Rejected entry는 head, index, root state, frame
state를 전진시키지 않습니다. 중단된 batch의 persisted prefix도 replay할 수 있습니다.
여러 open work scope, malformed envelope, illegal transition, broken causal identity는 새
write를 막습니다.

Serialized value나 structural clone은 process authority를 유지하지 못합니다. Routing
basis, assignment, reconstruction, authorization, landing, projection, publication, cursor,
page가 모두 이 규칙을 따릅니다.

## 8. Receipt만 TUI data source입니다

Replay-created opaque accepted event만 receipt를 만들 수 있습니다. Projection creation은
accepted-event provenance, canonical order, duplicate identity, bound, content hash를
검증합니다. Page에는 최대 100개 receipt가 있고 조용히 truncate하지 않습니다.

Projection coordinator는 latest-only로 publish합니다. 최신 refresh 실패가 이전
projection을 current로 복원하지 않습니다. Read에는 exact coordinator, publication,
projection, cursor, page identity가 필요합니다. `Refreshing`, stale, clone 값은 fail
closed합니다.

TUI는 exact current coordinator/publication target과 bounded verified page 하나만
받습니다. Route, settlement, admission, discharge, conclusion, authorization, enforcement,
persistence, publication을 할 수 없습니다.

## 9. Tool access는 replay-current root state를 따릅니다

Developer는 source-identified Pi built-in만 제어합니다. Current frame과 root
authorization에 따라 shell과 mutation capability를 닫고, 이전에 직접 닫은 exact tool
delta만 복원합니다. Display name이 같은 unrelated extension tool은 Pi built-in으로
분류하지 않습니다.

이 제어는 운영체제 sandbox가 아닙니다. 보장 범위는 protocol ownership과 bounded tool
projection이지 path-level process isolation이 아닙니다.

## 10. Reload는 effect를 발명하지 않습니다

Safe lifecycle marker가 있으면 uncertain active invocation을 `executionUncertain: true`인
cancellation으로 reconcile할 수 있습니다. Replay는 effect를 다시 실행하거나 provider
failure를 만들어내지 않습니다.

Marker가 없으면 Developer는 restart를 요구하고 tool ownership을 바꾸지 않으며
reconciliation event도 쓰지 않습니다. 이 restart alert는 operational 정보이므로
semantic receipt로 꾸며내지 않습니다.
