# Developer for Pi

[English](./README.md) | 한국어

Developer는 [Pi](https://pi.dev)가 추측을 멈추고, 적절한 설계·검토 방법을 고르고, 정당화된 한 번의 변경을 수행하고, 그 근거를 보여주도록 돕는 branch-aware judgment workbench입니다.

제품 규칙, 중요한 경우, ownership, compatibility, structural timing, pass-but-wrong verification이 숨어 있을 수 있는 작업에 사용합니다. Developer는 중요한 불확실성을 Question으로 만들고, 11개의 focused judgment Skill 중 하나로 라우팅하며, observable trigger가 요구하는 Reference만 읽고, 현재 session branch에 implementation·미해결 Question·verification evidence를 보존합니다. 고정 phase를 강제하지 않습니다.

## 설치

Node.js 22.19 이상이 필요합니다. 0.1.16 Workbench는 Pi 0.80.10, 0.82.1, 0.83.0 및 TypeBox 1.3.6/1.3.7 조합에서 검증됐습니다.

```sh
pi install npm:@hobin/developer
```

설치하지 않고 한 번 실행할 수도 있습니다.

```sh
pi -e npm:@hobin/developer
```

Pi에서 Developer를 켭니다.

```text
/developer on
```

설치 확인에는 `pi list`를 사용합니다.

## 사용해 보기

Skill이나 내부 protocol tool을 지정하지 말고 제품 작업을 평소처럼 설명합니다.

```text
/developer on
The selected payment method disappears after navigating back to checkout.
Find the cause and fix it.
```

Repository가 이미 확정한 내용에 따라 Developer는 빠진 제품 결정을 묻고, behavior를 조사하고, focused model 또는 sketch로 라우팅하고, 한 번의 implementation movement를 허용한 뒤 completion 전에 evidence를 요구할 수 있습니다.

```text
Add scheduled invoice delivery.
Clarify any missing product rules before editing.
```

```text
This parser change is green, but the conditionals are spreading.
Decide whether structural work belongs now.
```

```text
The tests pass after this cache rewrite.
Check what they do not prove before calling it done.
```

기존 코드 진단과 개선 계획에는 Doctor를 명시하고 path, flow, boundary, package, subsystem 같은 범위를 제공합니다.

```text
Run a thorough Doctor review of the checkout request-to-persistence flow.
Preserve current external behavior, consult every triggered Developer judgment,
and produce a now/next/observe/leave-alone plan without modifying files.
```

유용한 범위가 없으면 Doctor는 저비용 orientation으로 범위를 제안하고 requested·inspected·claim scope를 구분합니다.

## Developer가 필요한 이유

일반 coding request에는 implementation detail처럼 보이지만 실제로는 product, model, boundary, evidence 결정인 항목이 자주 들어 있습니다.

| 이전 | Developer 사용 |
| --- | --- |
| 모호한 요청이 제품 behavior를 결정 | Unknown을 owner가 있는 Question으로 만듦 |
| Green test가 Claim을 대신함 | Evidence를 각 Claim에 대응 |
| 취향과 momentum으로 refactor | 관찰된 pressure를 따라 구조 결정 |
| 모든 method를 context에 포함 | Trigger된 method만 load |
| Branch가 rationale을 잃음 | Evidence가 branch와 함께 replay |

Pi는 계속 정상 tool로 제품을 읽고, 수정하고, 실행하고, test합니다. Assertion, cast, non-null claim, typed decode는 domain invariant의 evidence가 아니며 broader input은 refined value를 반환하는 owner parser나 smart constructor를 통과해야 합니다.

## 동작 방식

```text
Discover → Load → Derive → Act → Check → Learn
```

1. Request, repository, latest evidence에서 unresolved question을 발견합니다.
2. Focused Skill 하나와 실제 trigger가 적용되는 Reference만 읽습니다.
3. Case table, boundary map, wished interface, review card, timing/evidence matrix 같은 inspectable artifact를 만듭니다.
4. Mutation이 맞는 다음 단계일 때 정당화된 movement 하나를 수행합니다.
5. 적절한 observer와 verifier로 changed claim을 확인합니다.
6. Stable landing에서 배우고 remaining Question을 보존한 뒤 momentum 대신 다시 라우팅합니다.

이는 mandatory phase sequence가 아닙니다. 단순 작업은 바로 implementation으로 갈 수 있고, 새 evidence는 뒤나 옆으로 라우팅할 수 있습니다.

## 주요 workflow와 Skill

Developer는 diagnosis, feature clarification, behavior modeling, code shaping, safe input refinement, design inspection, abstraction review, refactor timing, naming, completion verification, adversarial checks, visual decision을 돕습니다.

| Skill | 판단 질문 |
| --- | --- |
| `doctor` | Bounded existing-code scope가 무엇을 보존·처리·관찰·유지할지 |
| `specify` | Product meaning, scope, invariant, blocker |
| `model` | Case, contract, transition, guarantee, check |
| `sketch` | Data, interface, collaboration, flow, state, code shape |
| `signal` | Structural movement와 model-code mismatch |
| `naming-judgment` | Stable domain meaning, effect, multiple sense |
| `abstraction-review` | Keep, revise, split, reject, defer |
| `schedule` | Structural work가 now, after, never 중 어디인지 |
| `verify` | Evidence가 무엇을 증명하고 어떤 pass-but-wrong risk가 남는지 |
| `visualize` | 어떤 visual surface가 judgment cost를 낮추는지 |
| `adversarial-eval` | 어떤 finite check가 Claim을 반증할 수 있는지 |

직접 호출할 때는 `/skill:<name>`을 사용할 수 있습니다. Doctor는 ordinary task의 기본 입구가 아니라 explicit coordination workflow이며 sibling Reference를 대신하는 giant checklist가 아닙니다.

## 명령

| 명령 | 효과 |
| --- | --- |
| `/developer` | Branch-aware Workbench 열기 |
| `/developer status` | Overview 또는 non-TUI current state |
| `/developer questions` | Unresolved Question 검토·응답·조사 |
| `/developer settings` | Activation Settings 열기 |
| `/developer pause` | Human-supplied reason으로 current Work Case를 명시적으로 pause |
| `/developer resume` | Current paused Work Case를 명시적으로 confirm하고 resume |
| `/developer on` | Adaptive routing과 route-bound tool access 켜기 |
| `/developer off` | Developer를 끄고 current protocol state 제거 |

```sh
pi --developer
```

0.1.15부터 `/develop`, `--develop`, colon-style alias는 제공하지 않습니다. Pending work나 Question이 있으면 interactive off에서 confirmation을 요구하며 history는 남고 current protocol state만 제거됩니다.

## Workbench와 visible state

```text
Overview → Active Route → Questions → Judgments → Landings → Settings
```

Overview는 obligation, mutation authority, gate, active target, next action, runtime resource, verification debt를 보여줍니다. Active Route는 question, reason, known evidence, alternatives, Reference provenance, bounded implementation contract를 보여줍니다. Judgment는 complete Markdown result와 basis/artifact를 보존합니다. Landing은 schema에 없는 per-landing `Verified`를 발명하지 않습니다.

Workbench는 terminal scrollback이 아닌 keyboard-complete viewport입니다. Arrow 또는 `j/k`, Enter, Escape, Tab, Page Up/Down, Home/End, `y`, `?`를 사용합니다. Copy는 border나 styling 없이 complete semantic record를 반환합니다. Pi가 extension-scoped wheel capture를 제공하지 않으므로 mouse를 전역 점유하지 않습니다. Inspection은 entry, message, active tool, file을 변경하지 않습니다.

Question은 resolver, close evidence/answer, implementation/completion blocker 여부를 기록합니다. `/developer questions`는 Markdown 설명과 고정된 answer/defer action을 가진 bounded decision brief를 엽니다.

| 상태 | 의미 |
| --- | --- |
| `idle` | Active route나 unresolved Developer Question 없음 |
| `needs-judgment` | Current route에 result 필요 |
| `needs-evidence` | Agent/environment evidence 필요 |
| `needs-answer` | User decision 필요 |
| `needs-routing` | Implementation landing 재라우팅 필요 |
| `needs-verification` | Changed artifact verification 필요 |
| `blocked` | Required answer, observation, access unavailable |

이 상태는 timeless completion Claim이 아닙니다. `idle`도 사용자 task completion을 뜻하지 않습니다.

## Tool boundary

Developer가 켜져 있을 때 built-in `bash`는 inspection과 verification에 사용되고, `edit`/`write`는 unresolved before-implementation gate가 없는 active implementation route를 요구합니다. 다른 tool과 user-disabled 설정은 유지됩니다.

이는 workflow integrity control이지 security sandbox가 아닙니다. Shell command를 security language로 parse하지 않으며 Pi package는 Pi process 권한으로 실행됩니다.

## Reference와 auditability

항상 필요한 method는 `SKILL.md`에, conditional derivation은 `references/*.md`에 있습니다. `reference-policy.json`은 observable trigger를 question, required Reference, artifact, stop, handoff와 연결합니다. Resolved Judgment는 relied-on Reference를 trigger, applied rule, artifact와 연결합니다.

[Reference routing](./REFERENCE_ROUTING.md)과 [Terminal Judgment Workbench 연구](./docs/ko/terminal-judgment-workbench-study-v0.1.md)를 참고하세요.

## Action Loop reconstruction boundary

Reconstruction package는 이제 `src/action-loop`을 포함하며 live `before_agent_start` boundary는 Pi가 trust-filter한 Skill catalog에서만 Capability를 admit합니다.

```text
Pi-admitted Skills
→ bounded TOC discovery
→ exact Skill-byte binding
→ source-bound Capability inventory
→ first-party compatibility projection
```

Rejected catalog는 어떤 Developer Skill도 admit하지 않습니다. Invalid descriptor나 failed entry는 조용히 unstructured로 바뀌지 않습니다. Extension은 하나의 bounded `developer_open_work_case` proposal을 accept하고 그 active Outcome을 이후 turn에 projection할 수 있습니다. Exact duplicate는 stutter하고 다른 Outcome은 active work를 교체할 수 없으며 opening은 Action Clearance나 completion을 부여하지 않습니다. `developer_route_question`은 이 Work Case가 생기기 전 consequential routing을 거부합니다.

그 Work Case 안에서 `developer_open_judgment`는 하나의 Category, Subject, Question, 명시적인 Closure Requirements, 기능적인 Contribution Needs, basis를 accept합니다. Adapter는 Work Case identity와 분리된 current Context revision을 공급하고 open Judgment를 canonical Work Case inventory에 기록하며 그 requirements와 Needs를 이후 turn에 projection합니다. Exact duplicate는 stutter하고, 이 좁은 live slice에서는 다른 Judgment가 current open Judgment를 교체할 수 없습니다. Consequential routing은 이제 그 open Judgment를 요구하고 route를 exact `contribution_need_id`에 bind합니다. 단, Judgment에 모호하지 않은 Need가 하나뿐이면 ID를 생략할 수 있습니다. `before_agent_start`는 각 bound Capability revision과 exact declared `when`/`unless` condition을 projection합니다. `developer_assess_capability`는 Skill name에서 Need를 도출하거나 unstructured Skill에 predicate를 합성하지 않고 `applicable`, `not-applicable`, `needs-context` proposal을 accept합니다. `applicable` assessment만 revision-bound Capability Assignment를 만들고, Skill route는 그 exact assignment를 가져야 합니다. Route event는 Need, Assignment, Capability revision identity를 보존합니다. Unstructured Capability은 정확히 Skill file 하나만 seal하고 Reference는 seal하지 않습니다. Structured Capability은 모든 Reference disposition을 요구하며, ready selection만 Skill과 selected Reference를 atomic하게 seal합니다. Selected Reference는 filesystem에서 재획득하지 않고 sealed bytes에서 load됩니다. `developer_accept_contribution`은 Skill-local result와 exact Reference application을 그 context에 bind합니다. `developer_assess_coverage`는 cross-Contribution Need Coverage를 소유하고, `developer_close_judgment`는 exact Requirement와 Coverage accounting 뒤에만 Conclusion을 기록합니다. 이후 `developer_propose_action`은 proposed Pi tool input에서 exact `bash`, `edit`, `write` identity를 도출해 Action Candidate를 기록합니다. Model proposal이 아니라 live adapter가 Pi의 default permission policy를 상속하고 별도 approval setting이나 prompt 없이 matching Action Clearance를 기록합니다. Exact unconsumed tool input만 그 Clearance를 통과할 수 있고, host occurrence는 pending Effect를 시작하며 Clearance를 한 번만 consume합니다. `tool_result`는 exact evidence를 기록하지만 Effect success를 뜻하지 않습니다. `developer_settle_effect`는 모든 Observation과 intended Effect accounting을 요구합니다. `developer_prepare_closure`는 전체 canonical Work Case에서 Closure Target을 도출하고, `developer_complete_work_case`는 complete obligation/evidence accounting 뒤에 completion을 atomic하게 재검증합니다.

Current Pi session branch가 이제 이 Work Case를 durable하게 소유합니다. Accepted protocol-tool transition은 versioned semantic replay event를 tool-result `details`에 저장하고, exact controlled-tool occurrence, Effect Observation, human pause/resume transition은 작은 custom session entry에 저장합니다. `session_start` 또는 `session_tree`에서 Developer는 `ctx.sessionManager.getBranch()`만 같은 transition boundary로 fold하고 재생성된 모든 canonical identity를 검증합니다. 따라서 fork는 자기 branch history만 상속하고, pause는 human-owned reason과 revision을 복구하며, resume은 새 continuity-bound active revision을 만들고, completion은 마지막 revision-bound `CompletedWorkCase` projection을 복구합니다.

Replay event는 sealed Skill 또는 Reference bytes를 저장하지 않습니다. Source-bound Capability revision, selection, hash, canonical proposal, expected identity를 보존합니다. Claimed event 각각은 closed-shape decoding과 domain replay 전에 2 MiB로 제한됩니다. Replay는 current Pi-admitted inventory에서 bounded loader를 통해서만 material을 재획득하고 exact Capability와 sealed Context identity가 재생성될 때에만 accept합니다. Missing, excluded, changed, oversized, malformed, unsupported material은 replay를 visibly unavailable하게 만들며 absence, replacement Work Case, unstructured fallback, silently substituted evidence가 되지 않습니다. `--no-session` Pi process는 in-memory branch만 유지하므로 restart durability가 없습니다.

Human-owned `paused`는 이제 `/developer pause`와 `/developer resume`으로 live이며 Pi `--no-session`에서는 사용할 수 없고 explicit resume 또는 `/developer off` 전까지 controlled Action과 replacement work를 block합니다. Observational `waiting`과 assured `blocked`는 각자의 evidence-bound live/resume surface가 연결될 때까지 검증된 pure module로 남습니다. 더 강한 optional approval policy는 나중에 explicit feature로 추가할 수 있지만 이번 cutover에는 포함하지 않습니다. npm registry의 0.1.19 artifact는 recovery baseline이며 이 reconstruction surface는 publish되지 않았습니다.

## Branch, compaction, reload

Route, Judgment, Question, activation, canonical Action Loop transition은 Pi session entry에 저장되고 current branch에서 replay됩니다. Fork는 자기 branch history만 상속합니다. Compaction은 Pi에 맡기며 Developer는 current route와 recovery metadata를 보존 가능한 위치에 둡니다. Unsafe hot reload는 tool configuration을 추측하지 않고 Pi restart를 요구합니다.

## 업데이트, 설정, 제거

```sh
pi list
pi config
pi update npm:@hobin/developer
pi remove npm:@hobin/developer
```

Project-local 설치:

```sh
pi install -l npm:@hobin/developer
```

[Pi package 문서](https://pi.dev/docs/latest/packages)에서 scope, filtering, pinning, security behavior를 확인할 수 있습니다.

## 개발

```sh
pnpm install
pnpm --filter @hobin/developer check
pnpm --filter @hobin/developer eval
```

Workspace package 실행:

```sh
pi -e ./packages/developer
```

`check`는 package structure와 deterministic behavior를 검증하고 `eval`은 model 없이 실제 Pi RPC surface를 실행합니다. Model-dependent evaluation의 한 번 성공은 proof가 아닙니다. `PI_BIN`으로 exact Pi installation을 지정할 수 있습니다.

Published package에는 runtime extension, Skill, user documentation, license가 들어갑니다. Source audit, eval fixture, script, test는 repository-only maintenance evidence입니다.

## 라이선스

[MIT](./LICENSE)
