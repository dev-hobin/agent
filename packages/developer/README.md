# @hobin/developer

English | [한국어](README.ko.md)

Developer is a Pi package for carrying one bounded engineering Outcome through evidence-backed judgment, exact action, effect settlement, and completion.

It is model-neutral and role-independent. Its canonical loop is:

```text
Observe → Judge → Act → Settle → Complete | Block | Pause
```

The loop names responsibilities, not a mandatory phase order. New evidence can reopen judgment at any time.

## Canonical ownership

One Work Case is the sole owner of:

- the delegated Outcome, acceptance conditions, and constraints,
- open Judgments and their functional Contribution Needs,
- admitted Capabilities and sealed Skill/Reference context,
- Contributions, Need Coverage, and Conclusions,
- exact one-use Action Clearances,
- observed Effects, settlements, and remediations,
- pause, waiting, block, resume, and completion continuity.

Developer does not maintain a parallel persistence database. The current Pi session branch is the durability boundary. Session deletion deletes Developer continuity.

## Evidence boundary

Developer admits two exact host Observation kinds:

- the current user prompt,
- a finalized Pi tool result.

An Observation proves that Pi received those bytes and provenance. It is evidence, not truth and not a Conclusion. When an Observation directly answers a current functional Need, `developer_accept_observation_contribution` can bind it as an open-world Contribution. Otherwise a Skill may interpret sealed context and return a Skill-local Contribution.

Internal Work Case, revision, Observation, Contribution, and transition identities are available only to the protocol and model context. Normal and expanded user rendering shows semantic status, reasons, resume conditions, obligations, evidence, Effects, and history instead.

## Judgment and Capability routing

The four v0 Warrant Gap Categories are:

- **Contextual Adequacy**
- **Proportionate Intervention**
- **Consequence Integrity**
- **Claim Assurance**

Categories never hard-code Skill names. Upper Judgment identifies functional Contribution Needs and routes them through Pi's already admitted Skill inventory. Developer never rediscovers excluded Skills or bypasses Pi's trust, filter, or dedup decisions.

Included Skills:

- `specify`
- `model`
- `signal`
- `sketch`
- `abstraction-review`
- `naming-judgment`
- `schedule`
- `verify`
- `adversarial-eval`
- `doctor`
- `visualize`

Structured Skills select declared References, seal exact bytes and hashes, and fail closed on drift. Unstructured Skills seal the exact admitted `SKILL.md`. Skill-local resolution never grants upper Need Coverage or closes Judgment.

## Exact Actions and Effects

Controlled `bash`, `edit`, and `write` inputs require an exact one-use Action Clearance. Developer inherits Pi's default permission policy; it does not add a separate approval feature.

A tool return records an Effect Observation. Exit status or returned text does not imply success. Every Effect remains explicitly `pending`, `unknown`, successful, partially applied, failed, or adverse until settled. Adverse history cannot be rewritten as success; a distinct successful remediation is recorded separately.

Completion revalidates the complete current Work Case revision. Callers cannot choose convenient Conclusion or Effect subsets.

## Pause, waiting, block, and resume

Routine continuity uses normal conversation:

- a human prompt may pause work,
- an observed external condition plus an exact predicate may enter waiting,
- current Claim Assurance plus complete blocker accounting may block work,
- new host evidence may resume held work when the stored conditions are satisfied.

No background polling, timer, webhook, watcher, or idle-agent wake-up is implied. `--no-session` cannot truthfully preserve durable nonterminal ownership, so pause, waiting, and block transitions fail closed there.

Slash commands remain fallback controls:

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

`/developer` opens the read-only canonical Workbench in TUI mode. The Workbench projects `off`, `idle`, `active`, `paused`, `waiting`, `blocked`, `completed`, and `unavailable` without exposing internal identities.

## SDK controller

The prerelease SDK surface is available from `@hobin/developer/sdk`. It is a set of small composable commands rather than one hidden workflow manager:

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
→ [host execution and exact Observation]
→ settleEffectWithSdk
→ completeWorkCaseWithSdk
```

Each command does one job, accepts and returns explicit values, and admits model output only through a bounded in-memory proposal session. Pure progress inspectors derive the next Context, Contribution, or Coverage task from canonical records rather than creating a parallel checkpoint. The controller owns retries, per-run time limits, complete inventory accounting, canonical identity binding, and non-mutating `bounded-stop` results. Provider errors remain distinct from domain invariant failures.

`progressActionLoopWithSdk` opens missing Work Case and Judgment ownership, composes Inventory, Context, Contribution, Coverage, and Conclusion progression, proposes one exact controlled Action for separate host Permission and Clearance, settles its Effect from exact host Observations, and completes only after revision-bound closure revalidation. It requires a host checkpoint after every accepted transition, stops before dependent work when checkpointing fails, resumes from canonical records rather than recomputing completed batches, and opens a later Judgment only for an explicit next Warrant Gap rather than duplicating concluded ownership. The Pi Extension exposes it as the primary `developer_progress_action_loop_with_sdk` tool and reconstructs an unconsumed exact Pi Action input from the semantic branch event. The Pi host alone executes the action and records the result Observation. Sequential Warrant Gaps remain explicit: contextual or consequence Conclusions advance to a required Proportionate Intervention Judgment, whose canonical `action-required` or `no-action` disposition determines Action versus Claim Assurance; successful settled Effects advance to Claim Assurance, while an unremediated `failed | partially-applied` Effect first opens a fresh Proportionate Intervention Judgment. A later distinct `observed-success` Effect is bound through an SDK-owned, canonically admitted, branch-checkpointed remediation decision before Claim Assurance. A Claim-Assured no-change Outcome completes before any Action proposal. `progressJudgmentWithSdk` and the lower-level opening, routing, Action, Effect, remediation, and Completion operations remain SDK-composable and directly unit-tested, but the Pi Extension no longer registers separate model-facing tools for them. Exact host evidence and continuity controls remain available at the Pi boundary; adverse-Effect remediation progresses through the primary SDK controller.

This RC provides primary SDK progression through upper Judgment Conclusion, exact Action Candidate proposal, separate host Permission clearance, explicit Effect settlement, and revision-revalidated Completion. Capability inventory admission is journaled as one atomic semantic batch, while each sealed Context, Contribution, Coverage, cleared Action, and Effect assessment remains independently replayable from the Pi branch. Exact host execution and Effect Observation stay in the Extension bridge; model output cannot grant permission or turn a tool return into success. The production Extension path remains active until live-evaluation parity and host integration are complete. Maintainers can run `pnpm eval:live:sdk:intervention` against an exact packed package and Pi SDK root to isolate the structured `action-required`/`no-action` provider contract, and `pnpm eval:live:sdk:remediation` to contrast an evidence-backed adverse-to-success binding with an unrelated-success refusal. Run `pnpm eval:live:sdk:resume` with exact `DEVELOPER_EVAL_PACKAGE_PATH`, `DEVELOPER_EVAL_SESSION_FILE`, `DEVELOPER_EVAL_WORKSPACE`, and `PI_CODING_AGENT_DIR` provenance to exercise bounded stock-Pi restarts while rejecting transitional protocol-tool fallback. Set `DEVELOPER_EVAL_ACTIVATE=1` only when the evaluator must activate Developer on a fresh session; provider failures are reported as `provider-blocked` rather than canonical progression failures. `DEVELOPER_EVAL_SESSION_OPERATION=clone|fork-latest` and `DEVELOPER_EVAL_COMPACT=1` add actual Pi branch and compaction rounds; rerun against the reported session file to verify post-operation process restart. For a branch below Pi's compaction threshold, opt-in `DEVELOPER_EVAL_COMPACTION_PADDING_BYTES` adds only read-only RPC command output before retrying compaction. Canonical pause, wait, block, resume, Effect beginning, Observation admission, and remediation commands are exported directly instead of being wrapped by another manager. Completion is admitted only after trusted code prepares the complete current Closure Target and revalidates the same Work Case revision. The Pi session branch remains the only durability boundary.

## Canonical tools

```text
developer_progress_action_loop_with_sdk
developer_open_work_case
developer_open_judgment
developer_progress_judgment_with_sdk
developer_assess_capability
developer_select_references
developer_load_selected_reference
developer_accept_contribution
developer_accept_observation_contribution
developer_assess_coverage
developer_close_judgment
developer_propose_action
developer_settle_effect
developer_record_effect_remediation
developer_pause_work_case
developer_wait_work_case
developer_block_work_case
developer_resume_work_case
developer_prepare_closure
developer_complete_work_case
```

Every applicable Capability Assignment passes through `developer_select_references`: structured Capabilities disposition every TOC Reference, while unstructured Capabilities submit an empty list and seal `SKILL.md` alone. The former route/question compatibility tools and XState runtime are not part of the package.

## Replay and boundedness

Action Loop replay events are closed-shape decoded, capped at 2,097,152 bytes, and replayed atomically. Malformed, stale, duplicate, unsupported, or source-drifting events fail closed. Sealed Skill and Reference bytes are not copied into session events; accepted history remains, while byte-dependent reuse requires exact reacquisition.

Host Observation statements and model projections are bounded. Capability acquisition is source-bound, hash-verified, and atomic.

## Install

```bash
pi install npm:@hobin/developer
```

Enable it with `/developer on` or start Pi with `--developer`.
