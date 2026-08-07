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

## Canonical tools

```text
developer_open_work_case
developer_open_judgment
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
