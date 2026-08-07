# Developer Action Loop Architecture v0.1

English | [한국어](./ko/action-loop-architecture-v0.1.md)

> Status: reconstruction working contract
>
> Baseline: `@hobin/developer@0.1.19`
>
> Related contracts:
> [Concept Vocabulary](./action-loop-concept-vocabulary-v0.1.md) ·
> [Capability and Material Routing](./action-loop-routing-contract-v0.1.md)
>
> Runtime note: the published 0.1.19 artifact does not implement this architecture. The reconstruction branch now uses the Action Loop adapter for `before_agent_start` Capability admission, packages `src/action-loop`, and carries one Pi session branch-owned Work Case through current Judgment, Capability Assignment, Reference sealing, Contribution, Need Coverage, Conclusion, exact Pi Action Clearance and occurrence, Effect Observation and settlement, Closure Claim, and completion. Versioned semantic session events replay that state from the current Pi branch without persisting sealed Skill or Reference bytes. The live adapter inherits Pi's default permission policy without adding a separate approval feature. Exact adverse Effect remediation and all three durable nonterminal states—human-owned pause, observed-condition waiting, and Claim-Assured blocking—are live. The published runtime and Skills remain the recovery baseline.
>
> Date written: 2026-08-06

## 1. Why this reconstruction is being done

Developer’s next product question is not how to expand the Skill inventory or a fixed development procedure.

> Within a Pi extension, how can delegated outcome be preserved as canonical active work while continuously verifying whether the next action or completion claim is justified by the current context, judgment, effect, and evidence?

The initial flow for this was:

```text
Observe → Judge → Act → Settle → Complete | Block | Pause
```

Because `Judge` was too broad, the following questions were investigated first.

1. When should judgment be opened?
2. What upper-level categories exist for recurring warrant gaps?
3. What question and independent stop does each category have?
4. How should upper-level categories, Contribution Needs, Skills, and References be separated?

Comparing multiple sources and transfer cases produced four candidate upper-level categories.

```text
Contextual Adequacy
Proportionate Intervention
Consequence Integrity
Claim Assurance
```

Instead of expanding the source taxonomy further, these categories are now fixed as the v0 contract, and the architecture returns to the original Action Loop. Category names or boundaries are reopened only when transition traces reveal the absence, duplication, or omission of an independent stop or warrant gap.

## 2. Overengineering correction

After validating the upper-level categories, the process of separating professional role from authority began to produce a separate subsystem like the following.

```text
AuthorityEnvelope
AuthorizationReceipt
delegation revision
reserved-decision taxonomy
closure-requirement union
```

This contained one valid insight.

> The evidence, observation, and decision required by Judgment are instance-specific, and professional role is not an upper-level ontology or package boundary.

However, there is not yet enough evidence to finalize an authority schema before the action trace and extension contract. The current architecture retains only the following minimal rules.

- A category Conclusion and Action Clearance are not the same thing.
- If a required external decision or Evidence is missing, Judgment does not close.
- The expertise of a Contribution source or the result of a Skill does not by itself create permission or Action Clearance.
- The environment provides observations and constraints but is not the judgment owner.

The following are deferred until required by a trace.

- independent authority subsystem
- authorization receipt and delegation revision schema
- contributor identity or professional-role taxonomy
- generalized precedence engine

## 3. Product contract

Developer is not a role-playing agent or an automatic planner.

> Developer is a role-independent work layer that preserves delegated outcome as canonical active work and helps ensure that consequential next actions and completion claims are justified by the required judgments, observed effects, and claim-relevant evidence.

Developer does the following.

1. It observes the intended outcome and current relevant reality.
2. It identifies consequential unresolved Warrant Gaps around the next Action Candidate or Closure Claim.
3. It opens only the required upper-level Judgment instances.
4. It composes internal, external, and project-local Capabilities and context according to the Contribution Needs required by a Judgment.
5. It synthesizes Contributions according to the category contract.
6. It proceeds with one of justified action, no-change, wait, block, pause, or completion.
7. It observes and settles the actual effect of a controlled action.
8. It permits only completion claims that do not exceed what the evidence supports.

Developer does not turn all work into a heavy judgment procedure. Work that is trivial, bounded, reversible, and directly verifiable can be accounted for directly without unnecessary upper-level judgment.

### Model-neutrality invariant

Developer’s canonical work, Judgment, routing, Action Clearance, Effect Settlement, and Closure semantics do not depend on a specific model, provider, prompt style, structured-output feature, or SDK.

```text
provider/model transport
  → Pi Adapter normalization
    → model-neutral proposal protocol
      → Work Core transition guards
```

The following must be preserved.

- Work Core does not know provider SDK types, response envelopes, or model names.
- Model output is a proposal for Observation, applicability, Contribution, Coverage, Action, settlement, or Closure, not a canonical mutation.
- Every proposal passes through the same refined protocol and transition guards.
- Model replacement, retry, compaction, or reload does not erase Work Case identity or accepted state.
- Malformed, refused, empty, or timed-out output remains unresolved and is not interpreted as success or no-gap.
- Model identity and provider metadata may be provenance, but they are not authority for permission, Coverage, or Conclusion.
- Provider-specific prompt or parser tuning is an optional adapter detail, not canonical domain policy.
- Replay recovers from accepted transitions and evidence in the Work Record, not from model memory or hidden conversation state.

Model neutrality does not mean that every model produces the same prose or semantic conclusion. What Developer preserves is the same domain contract, admissible transitions, forbidden states, provenance requirements, and failure behavior.

## 4. Overall Action Loop

```text
                      ┌─────────────────────────────┐
                      │                             │
                      ▼                             │
Intended outcome → Observe current reality          │
                      │                             │
                      ▼                             │
              Next action or claim candidate        │
                      │                             │
                      ▼                             │
                    Judge                           │
         ┌────────────┼──────────────┐              │
         │            │              │              │
    no warrant gap    open gaps      cannot close   │
         │            │              │              │
         │            ▼              ▼              │
         │      gather contributions  Wait | Block  │
         │            │                             │
         │            ▼                             │
         │       synthesize judgment                │
         │            │                             │
         └────────────┼─────────────────────────────┘
                      ▼
        Act | No change | Completion candidate
             │                    │
             │                    ▼
             │             Claim Assurance
             │                    │
             ▼                    ▼
            Act                Complete
             │
             ▼
        Observe effect
             │
             ▼
           Settle
             │
             └──────────────────────────────→ Observe
```

This flow is not a fixed phase sequence.

- One candidate may open zero, one, or several judgments.
- New evidence or effects may reopen a previous judgment.
- No-change is not a failure; it may be a justified intervention conclusion.
- The end of an assistant response is not the end of canonical work.
- An external wait may suspend continuation but does not erase the active outcome.

## 5. Judgment admission

An upper-level judgment instance is opened only when the following predicate is satisfied.

```text
openJudgment(gap) =
  relevantToDelegatedOutcome(gap)
  && consequential(gap)
  && unresolved(gap)
  && hasIndependentStop(gap)
```

### `relevantToDelegatedOutcome`

The conclusion must be able to materially change the current outcome, constraints, next action, or completion claim.

### `consequential`

Closing it incorrectly must meaningfully change at least one of product meaning, action choice, effect envelope, compatibility, or completion claim.

### `unresolved`

Do not recreate a question already closed by an accepted constraint, direct observation, sufficient verifier, or explicit decision.

### `hasIndependentStop`

It must be possible to say when the gap itself has been resolved without closing another question. For example, candidate preference is not a separate upper-level category because it does not have a closure condition independent of the intervention’s scope, timing, action, no-action, and stop.

## 6. Upper-level judgment categories v0

### 6.1 Contextual Adequacy

#### Stable question

> Does this action, model, or claim fit the delegated intent and relevant environment?

#### Trigger

- The meaning of the request or acceptance boundary is unclear.
- A candidate contains a consequential assumption about context.
- The repository, caller, compatibility requirements, and user language suggest different meanings.
- Formal validity and actual context fit can fail independently.

#### Non-trigger

- Meaning, constraints, and applicability are already determined, and only a small mechanical action remains.

#### Closure

- Consequential assumptions and relevant constraints are exposed.
- The candidate’s fit or mismatch with the context has been concluded with evidence.
- If a required external decision remains, the state becomes wait or block rather than pretending to be resolved.

#### Reopen

- A new caller, constraint, user decision, or repository evidence changes the existing fit conclusion.

### 6.2 Proportionate Intervention

#### Stable question

> What action or no-action is currently justified, and how far should its timing, scope, and stop extend?

#### Trigger

- Multiple actions or no-action are possible, with differing cost, reversibility, scope, or timing.
- Structural change and behavioral progress compete.
- A large intervention is possible, but a smaller action may achieve the current outcome.
- Where to stop changes the justification of the result.

#### Non-trigger

- One bounded, reversible, directly verifiable action is evident.

#### Closure

- The selected action or no-action, scope, timing, and stop are proportionate to the current evidence.
- It is possible to explain why a material alternative was selected or excluded.
- Scope is not expanded solely for speculative future flexibility.

#### Reopen

- A new cost, failure, dependency, or change pressure alters the proportionality of the current intervention.

### 6.3 Consequence Integrity

#### Stable question

> Are the possible ordering, repetition, failure, and shared-state outcomes within an acceptable consequence envelope?

#### Trigger

- The timing or repetition of an action changes the outcome.
- Partial failure, retry, concurrency, a shared resource, or an external effect exists.
- A local procedure is correct, but the execution process or ordering may violate an invariant.
- Safety and liveness can fail independently.

#### Non-trigger

- The action is local and atomic, and its possible effects are bounded and directly observable.

#### Closure

- Material execution and failure paths are within the acceptable envelope or have been explicitly excluded or mitigated.
- An unknown consequence is not treated as success.

#### Reopen

- An observed effect differs from expectations, or a new ordering, repetition, or shared-state path is discovered.

### 6.4 Claim Assurance

#### Stable question

> What completion, correctness, compatibility, blocked, or no-change claim does the current evidence actually support?

#### Trigger

- A completion or correctness claim is about to be made.
- It is unclear whether a green test represents a broader claim.
- Compatibility, no-change, blocked, and partial completion must be distinguished.
- Verifier relevance and strength may be insufficient for the claim.

#### Non-trigger

- Only the direct result of a small action is being accounted for, without a separate consequential claim.

#### Closure

- Claim scope and evidence scope match.
- Material verifier blind spots and pass-but-wrong risks have been dispositioned.
- No claim broader than the evidence is made.

#### Reopen

- A new failure, counterexample, changed artifact, or stale verifier weakens the existing claim.

## 7. Position of effect settlement

Consequence Integrity and effect settlement are different.

```text
Consequence Integrity:
  Are possible executions and effects acceptable?

Effect settlement:
  What did this controlled action actually do?
```

Effect settlement is not a separate upper-level category; it is a canonical accounting obligation of the Action Loop.

The following may be settled conclusions.

```text
observed-success
observed-no-effect
failed
partially-applied
```

The following remain unsettled states.

```text
pending
unknown
```

A known partial effect may be settled as partial, but it may prevent completion or reopen a Judgment. When an observed Effect materially diverges from expectations, Contextual Adequacy, Proportionate Intervention, Consequence Integrity, or Claim Assurance may reopen.

A later successful Action does not rewrite an earlier adverse Effect. Closure may proceed only after a current Effect Remediation binds the exact `failed | partially-applied` settlement to a distinct exact `observed-success` settlement and both remain current. Reassessment invalidates that relation, and the Closure Claim must account for the adverse settlement, resolving settlement, and remediation relation. Deliberate acceptance of an adverse consequence remains deferred until an explicit human decision and Constraint-compatibility contract exist.

## 8. Judgment closure and Contribution composition

An upper-level category does not declare a fixed Skill list. The Category contract derives Closure Requirements appropriate to the Judgment Subject and current context, and currently unmet requirements create Contribution Needs.

```text
Judgment Category + Subject + Context
  → Closure Requirements
    → current unmet requirements
      → Contribution Needs
        → context-matched Capabilities
          → selected Skill families or other sources
            → Skill-local References when applicable
              → Contributions
                → Need Coverage
                  → Upper Judgment synthesis
                    → Conclusion
```

The following distinctions are preserved.

```text
Closure Requirement:
  A condition that must be demonstrated or dispositioned to close Judgment

Contribution Need:
  Input currently missing to evaluate a Closure Requirement

Contribution:
  A source-bounded input that actually addresses one Need

Need Coverage:
  An Upper Judgment relation describing the extent to which Contributions address a Need
```

Need Coverage distinguishes `covered`, `partially-covered`, `conflicted`, and `missing`. `superseded` is not Coverage; it is a Need lifecycle state caused by a change to the Subject or requirement. Skill output does not declare Coverage or Conclusion by itself.

The Capability inventory is open-world.

- Developer package Skills
- external package Skills
- project-local Skills
- tools and verifiers
- specialist contribution
- external decision source
- code, tests, user language, observed effect

The following capability boundaries are preserved.

```text
Capability:
  A means that can repeatedly produce Contributions

Skill:
  A Capability with a method and handoff boundary

TOC descriptor:
  An authoring contract that declares only Skill applicability and Skill-local Reference relevance

Reference:
  Deeper method selected by trigger within a selected Skill

Context source:
  An Observation or Constraint that changes selection and acceptance

Category:
  A stable question and closure contract for a recurring consequential Warrant Gap
```

A TOC is not required for every Capability. Tools, direct Observations, and external decisions may produce Contributions through other adapters. `AGENTS.md`, repository instructions, code, and tests are Context sources and do not automatically become Skills or upper-level categories. Adding a Skill does not automatically expand the top-level responsibility ontology.

A Skill’s human-facing `name` is not its runtime identity. The Pi Adapter generates a source-bound Capability ID from discovered source provenance and the Skill-relative root, and generates a Capability revision ID from the exact `SKILL.md` and routing fingerprint. The fingerprint of a structured Skill is the normalized TOC hash, while an unstructured Skill uses an explicit versioned no-TOC marker. A recognized invalid descriptor is not an unstructured fallback. Developer does not independently recover a Skill excluded by current Pi name-collision handling through its own filesystem scan.

The final TypeScript representation of Contribution Need is not yet finalized. However, the linking semantics among Closure Requirement, Need, Capability routing, Reference routing, Contribution, Coverage, and Conclusion follow [Capability and Material Routing](./action-loop-routing-contract-v0.1.md).

## 9. Minimal canonical state

The first Work Core does not extend beyond the following.

```text
WorkState {
  outcome
  status
  openJudgments
  clearedAction?
  effectsPendingSettlement
  closureClaim?
}
```

```text
Judgment {
  category
  subject
  question
  closureRequirements
  contributionNeeds
  contributions
  needCoverage
  conclusion?
  status
}
```

This is not a final TypeScript API, but the minimal semantic shape for traces. Do not add `owner`, professional role, authority envelope, receipt, revision, or confidence calculus unless required by a trace.

### Work status

```text
active
waiting
blocked
paused
complete
```

- `active`: continuation is possible, and the current outcome remains canonical.
- `waiting`: waiting for a required external decision, observation, or dependency.
- `blocked`: a required closure condition cannot currently be satisfied.
- `paused`: continuation is possible but has been explicitly suspended.
- `complete`: required judgments are closed, effects are settled, and evidence supports the completion claim.

## 10. Pure transitions

The first implementation prioritizes pure transitions and traces over frameworks.

```text
delegate outcome
  → activate work

observe
  → update relevant reality

open judgment
  → record consequential unresolved warrant gap

record contribution
  → attach source-bounded evidence or candidate

close judgment
  → record category synthesis

clear action
  → bind one warranted and permitted controlled action

observe effect
  → record what happened

settle effect
  → classify actual outcome

propose closure
  → state an evidence-bounded Closure Claim

complete | block | pause
  → leave active only through an explicit supported transition
```

### Forbidden states

- Clearing a related Action while a consequential Contextual Adequacy or Proportionate Intervention gap remains open.
- Completing while a consequential Effect remains unsettled.
- Making a Closure Claim broader than its supporting Evidence.
- Closing a missing external decision with a Skill result instead.
- Treating Skill output as a final warrant without category synthesis.
- Creating unnecessary judgments for trivial work.
- Treating justified no-change as failure.
- Ending work solely because of an assistant response, Skill invocation, tool result, or external wait.

## 11. Pi extension architecture

```text
┌──────────────────────────────── Pi Host ────────────────────────────────┐
│ before_agent_start · tool_call · tool_result · agent_settled · session │
└───────────────────────────────────┬─────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────── Pi Extension Adapter ─────────────────────────┐
│ translate host events into pure work commands/events                    │
│ combine Skill sources and TOCs into refined Capability inventory        │
│ verify Action Clearance before a controlled tool action                 │
│ record tool results as Effect Observations                              │
└───────────────────────────────────┬─────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────── Pure Work Core ─────────────────────────────┐
│ Work Case · pure transitions · invariants                               │
│ warrant-gap admission · Closure Requirements · Need Coverage            │
│ Contribution assignment · action/effect · evidence-bounded completion   │
└───────────────┬───────────────────┬───────────────────┬─────────────────┘
                │                   │                   │
                ▼                   ▼                   ▼
       Contribution routing   Model Protocol      Work View
       internal/external/     and guidance        session replay / TUI
       project-local Skills
```

### Discovery and I/O boundary

The Pi Adapter accepts only the Skill catalog to which Pi has applied trust, settings, CLI, and package discovery. It applies a bounded direct-child JSON scan only to admitted directory Skills and does not scan the parent of a direct-file Skill. It converts `$schema` validation, path containment, source-bound Capability identity, exact content acquisition, and explicit structured/unstructured routing state into host-side refined values. Structured sealing requires a ready Reference Selection. Unstructured sealing seals only one admitted exact Skill file and does not synthesize Reference Selection or `selectionId`.

Work Core does not search the filesystem or interpret raw TOC JSON. It receives only a Capability inventory and sealed Skill context already bound to provenance, then applies pure assignment, Coverage, and transition invariants. Structured applicability requires declared `when/unless` accounting. Unstructured applicability uses the same proposal protocol, but refines `applicable | not-applicable | needs-context` solely from an explicit basis without synthesizing condition matches. Contribution acceptance uses only the common identity and exact `selectedPaths` accounting of the two sealed-context forms, so an unstructured Contribution retains an empty Reference application set.

### Model Protocol boundary

Model Protocol does not turn provider response formats into public domain shapes. The Pi Adapter normalizes provider/model-specific output into bounded proposals, while Work Core validates only proposal provenance and semantic fields.

```text
model A response ─┐
model B response ─┼→ Pi Adapter → same proposal contract → Work Core
human evaluator ──┘
```

A model switch does not automatically make Outcome, open Judgment, Closure Requirements, Need Coverage, cleared Action, or unsettled Effect stale. A new model proposal is evaluated separately on top of existing accepted state. An invalid proposal does not produce a canonical transition.

### Hook responsibilities

- `before_agent_start`: provides the model context with current canonical work, unresolved Closure Requirements, and Contribution Needs.
- protocol tools: require the model to explicitly propose judgment, contribution, action, settlement, and completion transitions.
- `tool_call`: verifies that a controlled Action matches the current Cleared Action.
- `tool_result`: records the execution result as an Effect Observation.
- `agent_settled`: does not mistake settlement for completion and evaluates continuation, waiting, blocked, and paused candidates.
- session replay: recovers canonical state from append-only evidence.
- TUI projection: presents intended outcome, open judgment, action/effect, and status as read-only information.

The first adapter surface exposes only the transitions required by pure traces. It does not inherit the previous runtime’s protocol tools, state region, or workbench surface as-is.

The first authorized live cutover is narrower than Work Case activation:

```text
before_agent_start.systemPromptOptions.skills
  → source-bound catalog and bounded TOC discovery
  → exact Skill-byte Capability binding
  → bound first-party compatibility projection
  → existing protocol prompt
```

This boundary is live in the reconstruction package. Rejected catalogs admit no Developer Skill, while per-entry descriptor or binding failures remain unavailable rather than falling back to unstructured routing.

The next live slice opens and projects one bounded Work Case:

```text
developer_open_work_case proposal
  → bounded Outcome, acceptance conditions, Constraints, and basis
  → openWorkCase transition
  → current Pi session branch-owned active Work Case
  → next-turn, restart, and session-tree projection
```

An exact duplicate stutters, a different Outcome cannot replace active work, and turning Developer off appends the branch-local activation reset after the existing confirmation boundary. Opening grants no Action Clearance and implies no completion. The live `developer_route_question` boundary now rejects consequential routing until this Work Case exists, so the preserved protocol cannot bypass Outcome continuity.

The following slice opens one current upper Judgment inside that Work Case:

```text
developer_open_judgment proposal
  → Judgment Category + Subject + Question
  → explicit Closure Requirements + functional Contribution Needs + basis
  → adapter-supplied Work Case identity + separate current Context revision
  → openJudgment transition
  → recordWorkCaseJudgment transition
  → next-turn before_agent_start projection
```

The pure Work Case revision now includes open Judgment identities, and an open Judgment blocks Closure Target preparation. A matching Conclusion removes it from open inventory; a Conclusion that changes Category, Subject, or Context identity is refused. The narrow live adapter admits only one current open Judgment: an exact duplicate stutters and a different proposal cannot replace it.

`developer_route_question` now refuses routing without that open Judgment. It selects the exact requested `contribution_need_id`, or the sole Need only when selection is unambiguous. A Capability name never derives the Need.

The Capability Applicability slice is also live:

```text
before_agent_start bound Capability projection
  → exact Capability revision + declared when/unless conditions
developer_assess_capability proposal
  → applicable | not-applicable | needs-context
  → acceptCapabilityApplicability
  → current assessment
  → Capability Assignment only when applicable
```

Unstructured Capabilities require empty condition matches rather than synthetic predicates. A second different assessment for the same Need, Capability revision, and live Context is refused instead of silently replacing accepted state. A Skill route requires the exact current Assignment; `not-applicable` and `needs-context` cannot authorize routing. The route event preserves Contribution Need, Assignment, and Capability revision identities. The preserved implementation compatibility route is not a Capability Assignment and remains outside this gate.

The selected-material and Judgment synthesis path is now live:

```text
Capability Assignment
  → unstructured: seal exactly one Skill file and no References
  → structured: disposition every declared Reference exactly once
      → needs-context: remain unsealed
      → ready: atomically seal Skill + selected References
  → load selected Reference from sealed bytes
  → accept Skill Contribution with exact Reference applications
  → assess all current Contributions for Need Coverage
  → disposition every Closure Requirement against current Coverage
  → Judgment Conclusion or explicit refusal
  → derive exact Pi built-in tool input identity
  → record exact Action Candidate
  → adapter-owned Pi default Permission Decision
  → record matching Action Clearance
  → exact one-time tool occurrence begins pending Effect
  → tool result becomes Observation, not implicit success
  → complete Observation + intended Effect settlement accounting
  → whole-inventory Closure Target
  → complete Closure Claim accounting
  → atomic Work Case completion revalidation
```

A new Contribution invalidates current Coverage for its Need. A refusal leaves the Judgment open. A Conclusion removes the open Judgment and advances canonical Work Case revision. The accepted Contribution also closes the matching preserved compatibility route in memory, but that projection does not become canonical Work Case evidence. The route event preserves Need, Assignment, Capability revision, Reference Selection, and sealed Context identities.

This live slice now replays canonical Action Loop state from Pi's append-only current branch. Protocol-tool results carry versioned semantic transition events. Exact controlled-tool occurrences and Effect Observations use small custom session entries because they do not belong to a Developer protocol-tool result. `session_start` and `session_tree` fold only `ctx.sessionManager.getBranch()` through the same domain transitions, compare expected canonical identities, and restore active, nonterminal, or last-completed ownership. A branch change discards the prior in-memory projection before folding the selected branch. Duplicate nonterminal transitions, stale resumes, malformed events, and unsupported claimed events fail closed rather than rewriting ownership or becoming absence.

The session events retain Capability revisions, source descriptors, selections, hashes, proposals, and expected identities, but do not persist sealed Skill or Reference bytes. Every claimed event is limited to 2 MiB before closed-shape decoding and domain replay. Replay reacquires selected material only through the current Pi-admitted bounded loader. Exclusion, absence, oversize, or content drift prevents exact Capability or sealed Context identity reproduction, makes replay visibly unavailable, and blocks replacement work; no filesystem fallback or silent substitution occurs. Pi `--no-session` mode remains process-local across restart by definition.

The model still proposes only the Candidate; the adapter derives the exact tool identity and supplies the Permission Decision from Pi's default policy. An exact Clearance temporarily exposes its built-in tool and rejects changed or repeated input. No separate approval setting or prompt is added. A stronger approval policy remains a possible later feature rather than an implicit restriction. Tool results are preserved as limited Observations, while explicit settlement accounting must derive `pending`, `unknown`, or a settled outcome. A current failed or partially-applied settlement may bind only to a distinct current `observed-success` repair, preserving both Effect histories in closure accounting. Closure preparation owns the complete Work Case inventory, and completion revalidates its revision-bound Target and Claim. The durable substrate now preserves human-owned pause, observed-condition waiting, and Claim-Assured blocking through `developer_wait_work_case`, `developer_block_work_case`, `/developer pause`, `/developer wait`, `/developer block`, and `/developer resume`. The model-facing waiting tool requires an exact current Effect Observation; the blocking tool derives the complete current blocker inventory rather than accepting a caller-selected subset. These transitions are unavailable under Pi `--no-session` and block controlled Actions while nonterminal ownership is retained. Waiting resumes only after an explicit human Observation confirms its exact predicate. Blocking derives every current closure blocker, requires a current Claim Assurance Conclusion, and resumes only after an observed change supplies a concrete continuation.

## 12. Extension-level guarantee boundary

The extension can own the following.

- provider/model-independent canonical work semantics
- model proposal validation and accepted-transition boundary
- canonical work status and replay
- judgment identity and closure accounting
- controlled Action Clearance records
- observed Effects and settlement
- Closure Claim and Evidence scope
- bounded continuation and visible pause/block

The extension alone cannot guarantee the following.

- complete model correctness
- provider liveness
- every unknown external effect
- that the model always invokes the protocol correctly
- control over all output before the host displays it
- SDK-level process ownership

Therefore, the first goal is not a fully autonomous controller, but an inspectable and replayable action loop. SDK ownership is reconsidered only when required by the extension contract and failure traces.

## 13. Unix-style POC strategy

The first implementation unit is not a large `WorkCore` class or workflow machine.

> Build a small module that completely owns one invariant and failure boundary, fail it quickly in an independent test, and compose only modules that have become green with the next module.

### Small and complete module rule

Each module satisfies the following contract.

```text
one semantic decision
+ explicit refined input
+ explicit success, uncertainty, invalid output
+ no hidden shared state
+ no Pi or provider dependency
+ focused independent tests
= one complete POC module
```

- External or model-authored input failure is returned as an explicit invalid result and stops before any dependent effect.
- Domain uncertainty such as `needs-context`, `partial`, or `conflicted` is not collapsed into parse failure or boolean false.
- Only impossible internal states after refined input fail fast as programmer errors.
- Do not build a coordinator, framework, or public facade before the module test is green.
- Composition is first demonstrated by tests that directly connect module functions. Do not promote an orchestration abstraction before repeated pressure appears.
- A change to one module should require rerunning only that module’s focused tests and already composed slices.

### Module loop

```text
one accepted invariant
  → one failing representative check
    → smallest complete module
      → focused green test
        → commit
          → next independent module
            → direct composition test
              → vertical slice
```

### First Judgment-routing slice

The first slice does not cover the whole architecture. It passes end-to-end through the Upper Judgment–Skill–Reference linking that had the greatest uncertainty.

```text
raw schema-identified TOC
  → Parsed TOC
  → source-bound Capability
  → accepted applicability proposal
  → complete Reference dispositions
  → Reference Selection
  → exact Sealed Skill Context
  → accepted Skill Contribution
  → Need Coverage
  → Judgment Conclusion or explicit refusal
```

Each arrow has an independent module and focused test. The first completed module dispositions every declared Reference exactly once as `selected | not-needed | needs-context` and preserves declaration order in the Reference Selection.

The first slice’s composition test uses a deterministic fake evaluator. Pi hooks, live models, TUI, and replay are excluded. The same slice must distinguish success, missing disposition, needs-context, selected-content drift, partial Coverage, and conflicting Coverage.

### Second Action-effect slice

Only after the first slice is green is the flow after Conclusion composed.

```text
Conclusion
  → exact controlled-action fingerprint + intended Effects
  → Action Candidate
  → required Conclusions + separate current Permission Decision
  → Action Clearance | explicit not-cleared
  → matching host controlled-Action occurrence
  → pending Effect
  → Effect Observation
  → Effect Settlement
  → Closure Claim
  → Work Status transition
```

### Macro cutover order

```text
0. Published 0.1.19 recovery baseline
        ↓
1. Focused failing module checks
        ↓
2. Small complete pure modules
        ↓
3. Judgment-routing vertical slice
        ↓
4. Action-effect vertical slice
        ↓
5. Model-neutral protocol adapters
        ↓
6. Pi hook adapter
        ↓
7. Session replay and TUI projection
        ↓
8. Old runtime cutover and removal
        ↓
9. Packed artifact verification
```

### Behavior and structure separation

- The 0.1.19 runtime remains an operational baseline until the new slices are verified.
- POC modules are built under `src/action-loop/`, separated from the host.
- After the new adapter demonstrates equivalent or intentionally changed behavior, the existing `extensions/machine.ts`, `state.ts`, and Workbench protocol are removed.
- `xstate`, existing eval scripts, package description, and README are cleaned up after verifying actual use during cutover.
- Package versioning, publication, and merge to main are separate approval matters from reconstruction completion.

## 14. Required transition traces

The first pure core must explain and validate the following finite traces.

1. **Justified change**: close the relevant gap, perform the action, settle the effect, and complete.
2. **Justified no-change**: the intervention judgment selects no-action and closes with an evidence-bounded claim.
3. **Missing contribution**: become waiting or blocked because required evidence or a decision is unavailable.
4. **Successful action**: distinguish tool success from actual effect observation, then settle.
5. **Failed or partial effect**: failure or partial application prevents completion until a distinct observed-success Effect is bound as current remediation; the original adverse settlement remains in closure accounting.
6. **External decision wait**: remain waiting while identifying the required decision without inventing a professional role.
7. **No-progress pause**: preserve the outcome and pause when responses repeat or continuation makes no progress.
8. **Evidence-bounded completion**: permit a completion claim only up to the scope supported by the verifier.
9. **Open-world capability composition**: one Need is addressed by zero, one, or several Skills or non-Skill sources, and a selected Skill selects zero, one, or several References.
10. **Partial and conflicting Coverage**: even with useful Contributions, do not permit Conclusion or completion when a consequential residual or conflict remains.
11. **Capability identity and drift**: the same human name does not merge source identities, and Skill/TOC or selected Reference drift makes dependent values stale.
12. **Model substitution and failure**: different models or a human evaluator use the same proposal contract, and model replacement or malformed/refused output does not erase accepted Work Case state or create an invalid transition.

Additional states, events, and abstractions are introduced only when required by one of these traces.

## 15. Current non-goals

- package separation by professional identity
- assigning canonical accountability to the `Developer` actor
- including a fixed Skill-name routing table in the category contract
- treating `AGENTS.md` as a Skill or upper-level category
- forcing all work through the four categories
- promoting effect settlement to a separate upper-level category
- a general-purpose ontology for authority, confidence, or priority
- post-reconstruction backward compatibility with the previous runtime
- modifying or integrating Operator
- an SDK-owned host implementation
- provider/model-specific state machine, category, TOC, or Work Core type
- using specific prompt wording or structured-output features as the canonical correctness boundary

## 16. Source basis and boundaries

The upper-level categories were not derived directly from book titles, chapters, professions, or current Skill names. Sources were used as evidence to test each category’s independent failure and stop.

- *Tidy First?*: compared action/no-action, timing, scope, reversibility, and stop against Proportionate Intervention.
- *Elements of Clojure*: used environment fit, assumptions, composition, acknowledgment, and effect accounting for the boundary between Contextual Adequacy and settlement.
- *99 Bottles of OOP*: used factual comparison, change pressure, abstraction cost, and justified duplication for intervention boundaries.
- *Sparks of Genius*: treated observing, patterning, modeling, transforming, and synthesizing not as upper-level categories, but as general capabilities that contribute to multiple categories.
- *Logic for Programmers*: tested category closure and independent failure through partial specification, contract, replacement, safety, liveness, and refinement.
- *Grokking Simplicity*: tested Consequence Integrity through action, timing, repetition, shared resources, timelines, and coordination.
- *Structure and Interpretation of Computer Programs*: distinguished possible execution from invariant-preserving outcome through procedure/process, abstraction barriers, state, identity, ordering, and concurrency.

Current Developer Skills and `reference-policy.json` are evidence for capability and Skill-to-Reference routing. The new schema-identified TOC descriptor moves this evidence into a small authoring surface as a reconstruction contract. No file format or Skill inventory is treated as the canonical representation of the upper ontology.

## 17. Reopen and stop rule

This working contract is structurally reopened only when the following evidence appears.

- A finite trace reveals a consequential warrant gap that does not belong to any of the four categories.
- Two categories always close together for the same Judgment Subject without independent stops.
- A host guarantee that cannot be expressed as a pure transition actually blocks extension implementation.
- A concrete case demonstrates that an open-world capability cannot express a required contribution.
- The model-neutral proposal contract cannot express an accepted transition across two or more materially different evaluators.
- Combining effect settlement and judgment closure into the same state permits forbidden completion.

Until then, do not design additional categories, an authority subsystem, an SDK host, or a professional-role package.
