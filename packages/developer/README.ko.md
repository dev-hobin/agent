# @hobin/developer

[English](README.md) | 한국어

Developer는 하나의 bounded engineering Outcome을 evidence-backed judgment, exact action, Effect settlement, completion까지 이어 가는 Pi package입니다.

Model-neutral하고 role-independent한 canonical loop는 다음과 같습니다.

```text
Observe → Judge → Act → Settle → Complete | Block | Pause
```

이 loop는 강제 phase 순서가 아니라 책임을 나타냅니다. 새로운 evidence가 생기면 언제든 Judgment로 돌아갈 수 있습니다.

## Canonical ownership

하나의 Work Case가 다음을 단독으로 소유합니다.

- delegated Outcome, acceptance conditions, constraints
- open Judgments와 functional Contribution Needs
- admitted Capabilities와 sealed Skill/Reference context
- Contributions, Need Coverage, Conclusions
- exact one-use Action Clearances
- observed Effects, settlements, remediations
- pause, waiting, block, resume, completion continuity

Developer는 별도의 persistence database를 만들지 않습니다. 현재 Pi session branch가 durability boundary입니다. Session을 삭제하면 Developer continuity도 삭제됩니다.

## Evidence boundary

Developer는 두 종류의 exact host Observation을 admit합니다.

- 현재 user prompt
- finalized Pi tool result

Observation은 Pi가 해당 bytes와 provenance를 받았다는 evidence일 뿐, truth나 Conclusion이 아닙니다. Observation이 현재 functional Need에 직접 답하면 `developer_accept_observation_contribution`이 이를 open-world Contribution으로 bind할 수 있습니다. 그렇지 않으면 Skill이 sealed context를 해석해 Skill-local Contribution을 반환할 수 있습니다.

Work Case, revision, Observation, Contribution, transition identity는 protocol과 model context에서만 사용합니다. Normal/expanded user rendering에는 semantic status, reason, resume condition, obligation, evidence, Effect, history만 표시합니다.

## Judgment와 Capability routing

네 가지 v0 Warrant Gap Category는 다음과 같습니다.

- **Contextual Adequacy**
- **Proportionate Intervention**
- **Consequence Integrity**
- **Claim Assurance**

Category는 Skill name을 hard-code하지 않습니다. Upper Judgment가 functional Contribution Need를 식별하고 Pi가 이미 admit한 Skill inventory를 통해 route합니다. Developer는 excluded Skill을 다시 discover하거나 Pi의 trust, filter, dedup 결정을 우회하지 않습니다.

포함된 Skill:

- `specify`
- `model`
- `signal`
- `sketch`
- `abstraction-review`
- `naming-judgment`
- `convention-judgment`
- `variation-judgment`
- `module-judgment`
- `information-loss-judgment`
- `process-judgment`
- `task-protocol-judgment`
- `schedule`
- `verify`
- `adversarial-eval`
- `doctor`
- `visualize`

Structured Skill은 declared Reference를 선택하고 exact bytes/hash를 seal하며 drift가 생기면 fail closed합니다. Unstructured Skill은 admit된 정확한 `SKILL.md`를 seal합니다. Developer가 꺼져 있을 때는 각 Reference-bearing Skill의 framework-independent `Supporting Materials` 절이 colocated Skill TOC와 materially applicable한 최소 Reference set을 직접 읽도록 안내합니다. Skill-local resolution은 upper Need Coverage를 부여하거나 Judgment를 닫지 않습니다.

## Exact Action과 Effect

Controlled `bash`, `edit`, `write` input에는 exact one-use Action Clearance가 필요합니다. Developer는 Pi default permission policy를 상속하며 별도 approval feature를 추가하지 않습니다.

Tool return은 Effect Observation을 기록합니다. Exit status나 returned text가 success를 뜻하지 않습니다. 모든 Effect는 settle될 때까지 `pending`, `unknown`, successful, partially applied, failed, adverse 중 명시적인 상태를 유지합니다. Adverse history를 success로 다시 쓸 수 없고, 별개의 successful remediation을 따로 기록합니다.

Completion은 현재 Work Case revision 전체를 다시 검증합니다. Caller가 편리한 Conclusion이나 Effect subset을 고를 수 없습니다.

## Pause, waiting, block, resume

Routine continuity는 일반 대화를 사용합니다.

- human prompt가 work를 pause할 수 있습니다.
- observed external condition과 exact predicate가 waiting을 만들 수 있습니다.
- current Claim Assurance와 complete blocker accounting이 work를 block할 수 있습니다.
- stored condition을 만족하는 새로운 host evidence가 held work를 resume할 수 있습니다.

Background polling, timer, webhook, watcher, idle-agent wake-up을 뜻하지 않습니다. `--no-session`은 durable nonterminal ownership을 정직하게 보존할 수 없으므로 pause, waiting, block transition은 fail closed합니다.

Slash command는 fallback control로 남습니다.

```text
/developer
/developer status
/developer settings
/developer pause
/developer wait
/developer block
/developer resume
/developer on
/developer off
```

TUI mode의 `/developer`는 read-only canonical Workbench를 엽니다. Workbench는 internal identity를 노출하지 않고 `off`, `idle`, `active`, `paused`, `waiting`, `blocked`, `completed`, `unavailable`을 projection합니다.

## SDK controller

Prerelease SDK surface는 `@hobin/developer/sdk`에서 제공합니다. 하나의 숨은 workflow manager가 아니라 작고 조합 가능한 command 집합입니다.

```text
openWorkCaseWithSdk
→ openJudgmentWithSdk
→ assessCapabilityInventoryWithSdk
→ sealCapabilityContextWithSdk
→ contributeSkillWithSdk
→ assessNeedCoverageWithSdk
→ concludeJudgmentWithSdk
→ proposeActionWithSdk
→ clearActionWithHostPermission
→ [host execution과 exact Observation]
→ settleEffectWithSdk
→ fresh Proportionate Intervention
→ Claim Assurance | next Action | Block | Wait
→ completeWorkCaseWithSdk
```

각 command는 한 가지 일만 하고 명시적인 값을 입력·출력하며, bounded in-memory proposal session을 통해서만 model output을 admit합니다. Pure progress inspector는 별도 checkpoint를 만들지 않고 canonical record에서 다음 Context, Contribution, Coverage 작업을 계산합니다. Controller는 retry, run별 time limit, complete inventory accounting, canonical identity binding, non-mutating `bounded-stop`을 소유합니다. Provider error는 domain invariant failure와 구분합니다.

모든 nested model request는 closed stage vocabulary를 가진 하나의 proposal-prompt boundary에서 생성됩니다. System contract에는 stage objective, proposal-only authority, trusted-controller ownership, stage-local rule만 있고, data packet에는 label이 붙은 current-state section과 하나의 decision request만 있습니다. Exact sealed material은 해당 section 안에서 byte-preserved 상태로 유지되며 canonical rejection feedback은 실제 rejected attempt 뒤에만 추가됩니다. Package check는 SDK controller가 이 renderer를 우회하지 못하게 합니다. 따라서 prompt text는 proposal 생성을 제한하지만 identity, permission, Effect settlement, Completion authority, canonical state가 되지 않습니다.

`progressActionLoopWithSdk`는 누락된 Work Case와 Judgment ownership을 열고 Inventory, Context, Contribution, Coverage, Conclusion progression을 조합하고, 별도 host Permission과 Clearance를 위한 exact controlled Action 하나를 제안하며, exact host Observation에서 Effect를 settle하고 revision-bound closure 재검증 뒤에만 complete합니다. Accepted transition마다 host checkpoint를 요구하고, checkpoint 실패 시 dependent work 전에 중단하며, 완료 batch를 재계산하지 않고 canonical record에서 재개하고, concluded ownership을 중복하지 않고 explicit next Warrant Gap에 대해서만 후속 Judgment를 엽니다. Pi Extension은 이를 구현 세부사항을 숨긴 primary `developer_progress_action_loop` tool로 노출하고 semantic branch event에서 미소비 exact Pi Action input을 복원합니다. Pi host만 Action을 실행하고 결과 Observation을 기록합니다. Sequential Warrant Gap은 명시적으로 유지합니다. contextual/consequence Conclusion은 required Proportionate Intervention Judgment로 진행하고, 그 canonical `action-required` 또는 `no-action` disposition이 Action과 Claim Assurance 중 다음 단계를 결정합니다. 완전히 settle된 모든 Effect inventory는 다음 Action이나 Claim Assurance 전에 fresh Proportionate Intervention을 요구합니다. `blocked`와 `waiting`은 nonterminal로 남고, remediation되지 않은 `failed | partially-applied` Effect는 Claim Assurance나 Completion으로 진행할 수 없습니다. 이후 별개의 `observed-success` Effect는 SDK-owned canonical remediation decision과 Pi branch checkpoint를 거쳐 Claim Assurance 전에 결합됩니다. Claim-Assured no-change Outcome은 Action proposal 전에 complete합니다. `progressJudgmentWithSdk`와 lower-level opening/routing/Action/Effect/remediation/Completion operation은 SDK-composable 상태와 direct unit test를 유지하지만, Pi Extension은 더 이상 각각의 model-facing tool을 등록하지 않습니다. Exact host evidence와 continuity control은 Pi boundary에 남고 adverse-Effect remediation은 primary SDK controller를 통해 진행합니다.

[Action Loop 전이 모델](docs/ko/action-loop-transition-model-v0.1.md)은 canonical 전이 안전성과 외부 사용자 acceptance를 분리하고, branded phase 아홉 개로 invalid control 조합을 표현 불가능하게 만듭니다. 현재 RC는 upper Judgment Conclusion, exact Action Candidate proposal, 별도 host Permission clearance, explicit Effect settlement, revision-revalidated Completion까지 primary SDK progression으로 제공합니다. Capability inventory admission은 하나의 atomic semantic batch로 journal하고, 각 sealed Context, Contribution, Coverage, cleared Action, Effect assessment는 Pi branch에서 독립적으로 replay할 수 있습니다. Exact host execution과 Effect Observation은 Extension bridge에 남으며 model output은 permission을 부여하거나 tool return을 success로 바꿀 수 없습니다. Pi Extension은 model-facing tool, exact host evidence, branch durability, TUI projection을 맡는 host adapter로 유지되고, SDK controller가 Action Loop progression을 소유합니다. Maintainer는 exact packed package와 Pi SDK root에 `pnpm eval:live:sdk:intervention`을 실행해 structured `action-required`/`no-action` provider contract를 분리 검증하고, `pnpm eval:live:sdk:remediation`으로 evidence-backed adverse-to-success binding과 unrelated-success refusal을 대조할 수 있습니다. Exact `DEVELOPER_EVAL_PACKAGE_PATH`, `DEVELOPER_EVAL_SESSION_FILE`, `DEVELOPER_EVAL_WORKSPACE`, `PI_CODING_AGENT_DIR` provenance와 함께 `pnpm eval:live:sdk:resume`을 실행해 현재 six-tool surface 밖의 Developer tool을 거부하면서 bounded stock-Pi restart를 검증할 수 있습니다. Fresh session에서 evaluator가 Developer를 활성화해야 할 때만 `DEVELOPER_EVAL_ACTIVATE=1`을 설정하며, provider failure는 canonical progression failure가 아니라 `provider-blocked`로 보고합니다. `DEVELOPER_EVAL_SESSION_OPERATION=clone|fork-latest`와 `DEVELOPER_EVAL_COMPACT=1`은 실제 Pi branch/compaction round를 추가하며, 출력된 session file로 다시 실행해 operation 이후 process restart도 검증합니다. Pi compaction threshold보다 작은 branch에서는 opt-in `DEVELOPER_EVAL_COMPACTION_PADDING_BYTES`가 read-only RPC command output만 추가한 뒤 compaction을 재시도합니다. Canonical pause, wait, block, resume, Effect beginning, Observation admission, remediation command는 다른 manager로 다시 감싸지 않고 직접 export합니다. Completion은 trusted code가 complete current Closure Target을 준비하고 동일한 Work Case revision을 다시 검증한 뒤에만 admit됩니다. Pi session branch는 계속 유일한 durability boundary입니다.

## Model-facing tools

```text
developer_progress_action_loop
developer_accept_observation_contribution
developer_pause_work_case
developer_wait_work_case
developer_block_work_case
developer_resume_work_case
```

모든 applicable Capability Assignment는 primary SDK controller의 canonical Reference disposition과 Context sealing path를 거칩니다. Structured Capability는 선언된 모든 TOC Reference를 disposition하고, unstructured Capability는 빈 disposition 목록으로 `SKILL.md`만 seal합니다. Lower-level opening, routing, Contribution, Coverage, Conclusion, Action, Effect, remediation, Completion operation은 SDK-composable 상태로 남지만 별도 model-facing tool로 등록되지 않습니다. 기존 route/question tool과 XState runtime은 package surface에 포함되지 않습니다.

## Replay와 boundedness

Action Loop replay event는 closed-shape로 decode하고 2,097,152 bytes로 cap하며 atomically replay합니다. Malformed, stale, duplicate, unsupported, source-drifting event는 fail closed합니다. Sealed Skill/Reference bytes는 session event에 복사하지 않습니다. Accepted history는 남지만 byte-dependent reuse에는 exact reacquisition이 필요합니다.

Host Observation statement와 model projection은 bounded합니다. Capability acquisition은 source-bound, hash-verified, atomic합니다.

## 설치

```bash
pi install npm:@hobin/developer
```

`/developer on` 또는 Pi의 `--developer` flag로 활성화합니다.
