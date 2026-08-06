# Developer Action Loop Concept Vocabulary v0.1

English | [한국어](./ko/action-loop-concept-vocabulary-v0.1.md)

> Status: reconstruction concept contract
>
> Related documents:
> [Action Loop Architecture](./action-loop-architecture-v0.1.md) ·
> [Capability and Material Routing](./action-loop-routing-contract-v0.1.md)
>
> Baseline: `@hobin/developer@0.1.19`
>
> Runtime note: this vocabulary is domain language for describing transition traces. It does not describe the type, tool, or event names of the current 0.1.19 runtime, nor does it require creating a class or JSON field for every concept.
>
> Written: 2026-08-06

## 1. Purpose

The Action Loop architecture mixes domain concepts, connector relations, operational patterns, and runtime components. Failing to distinguish them causes the following problems.

- Temporary explanatory terms become fixed as if they were public APIs.
- Different meanings are combined under one name, as with `Judgment`, `Conclusion`, and `Authorization`.
- Creating an object for every relation unnecessarily expands state and protocol.
- Names from the current extension implementation determine the product ontology.
- Professional roles and contribution functions become confused again.

This document defines the stable senses that the architecture must actually distinguish and separates implementation details from connector relations.

## 2. The architecture’s four runtime obligations

The Action Loop is supported not by four top-level judgment categories, but by the following runtime obligations.

### Outcome Continuity

Preserve canonical work until one outcome is achieved or explicitly stopped.

### Warranted Transition

A consequential action or work-status transition must be justified by current evidence and the required decision.

### Effect Accountability

Distinguish executing an Action from the actual occurrence of an Effect, and account for the Effect sufficiently before the next transition.

### Evidence-bounded Closure

A closure claim such as complete, blocked, or no-change cannot be broader than its supporting evidence.

These obligations are runtime invariants. They are not the same as judgment categories such as `Context Fit`, `Intervention Proportionality`, `Consequence Integrity`, and `Claim Assurance`.

### Cross-cutting Model Neutrality

Model Neutrality is not a fifth work obligation or Judgment Category, but an architecture invariant that cuts across every obligation.

> The same Work Case semantics and transition guards must be maintained independently of model, provider, prompt style, and response envelope.

A Model is not the canonical state owner, but a proposal source or semantic evaluator. Model identity may be proposal provenance, but it does not substitute for Capability identity, permission, assurance strength, Need Coverage, or Conclusion.

```text
model/provider-specific output
  → normalized proposal
    → common transition guard
      → accepted domain transition or explicit rejection
```

A model switch does not change accepted Work Case state. State changes only when a new proposal produces an accepted transition.

## 3. The four layers of the vocabulary

### Domain concept

Something that must retain independent meaning and a failure boundary while work progresses.

```text
Work Case
Warrant Gap
Judgment
Closure Requirement
Contribution Need
Contribution
Need Coverage
Action
Effect
Claim
```

### Connector relation

A relation that occurs between concepts. It may not be a separate state object.

```text
reveals
opens
requires
addresses
synthesizes
warrants
permits
clears
produces
settles
assures
transitions
```

### Operational pattern

A flow that repeatedly coordinates multiple concepts and relations.

```text
Adaptive Action Loop
```

### Runtime component

A structure that executes and preserves domain concepts inside the Pi extension.

```text
Work Core
Contribution Router
Model Protocol
Pi Adapter
Work Record
Work View
```

## 4. Concept relation map

```text
Outcome
  → defines Work Case
    → receives Observations
      → may reveal Warrant Gap
        → opens Judgment

Judgment Category + Judgment Subject + current Context
  → derive Closure Requirements
    → current unmet requirement reveals Contribution Need
      → assigned Capability produces Contribution
        → Upper Judgment assesses Need Coverage
          → Coverage + all Closure Requirements support Conclusion

Conclusion
  ├→ warrants Action Candidate
  │    + permission
  │      → Action Clearance
  │        → Action
  │          → Effect
  │            → Effect Observations
  │              → Effect Settlement
  │                → Work Case
  │
  └→ warrants Claim
       → Claim Assurance bounds Closure Claim
         → supports Work Status transition
```

Do not omit the following two intermediate stops in this map.

```text
Contribution
  ≠ Need Coverage

Need Coverage
  ≠ Conclusion
```

## 5. Core domain concepts

### 5.1 Work Case

> The canonical work unit that connects Judgment, Action, Effect, and Claim end to end around a single Outcome.

A Work Case is not the same as a chat session, assistant response, git branch, or task list. A V0 Work Case creates a content-bound identity from a normalized Outcome statement, one or more acceptance conditions, and zero or more constraints, and opens as `active`. Proposal provenance is preserved, but model, provider, session, branch, and professional role do not enter into Outcome or Work Case identity.

- It may span multiple agent turns.
- It remains in place during an external wait.
- It may contain multiple Judgments and Actions.
- It does not disappear before an explicit supported transition.

#### Name selection

| Candidate | What it reveals | Problem |
| --- | --- | --- |
| `Work Thread` | continuity | Confusable with an execution thread or chat thread |
| `Work Scope` | scope | Weak lifecycle and closure semantics |
| `Work Case` | bounded matter and persistent record | Learning cost of the general term `case` |

V0 uses `Work Case`. `WorkState` is a possible implementation representation, not the domain concept name.

### 5.2 Outcome

> The desired condition that is the reason a Work Case exists.

An Outcome is not a plan or action list.

```text
Outcome:
  What must become true?

Action:
  What will be done now to make it true?
```

Documentation may use `delegated outcome` to expose provenance, but the core concept is `Outcome`.

### 5.3 Constraint

> An accepted boundary that must be maintained while achieving the Outcome.

Distinguish an Observation from a Constraint.

```text
Observation:
  The repository currently uses Node 22.

Constraint:
  Node 22 compatibility must be maintained.
```

An Observation may become a Constraint when combined with an accepted requirement.

### 5.4 Observation

> A fact or observed result about current reality, recorded with provenance.

An Observation is not automatically Evidence.

```text
test passed
  → Observation

this test supports the compatibility Claim
  → Evidence relation
```

The same Observation may be Evidence for one Claim and irrelevant to another.

### 5.5 Warrant Gap

> Grounds that are still insufficient to justify a consequential Action or Claim.

Not every unknown or open question is a Warrant Gap.

```text
unknown
+ relevant to Outcome
+ consequential
+ unresolved
+ independent stop
= Warrant Gap
```

The Korean explanation may use `정당화 공백`. Code and architecture vocabulary retain `Warrant Gap`.

### 5.6 Judgment

> A bounded inquiry intended to close one Warrant Gap with respect to a specific Judgment Subject.

Distinguish Judgment from Conclusion.

```text
Judgment:
  question, subject, category, closure requirements, contribution needs,
  need coverage, current status

Conclusion:
  the category-scoped answer produced by synthesizing that Judgment’s
  requirements and coverage
```

### 5.7 Judgment Subject

> The Action, model, Claim, boundary, or situation addressed by the current Judgment.

In semiotic analysis, `referent` is precise, but `Judgment Subject` is more direct in product and implementation vocabulary.

### 5.8 Judgment Category

> A stable question, trigger, closure, and reopen contract for deciding recurring Warrant Gaps.

A Category is not a phase, Skill group, profession, or source chapter. One Work Case may open zero, one, or several category instances.

The current category signs and stable senses are as follows.

| Current sign | Stable sense | Parallel sign candidate |
| --- | --- | --- |
| Contextual Adequacy | Fit | `Context Fit` |
| Proportionate Intervention | Proportion | `Intervention Proportionality` |
| Consequence Integrity | Integrity | `Consequence Integrity` |
| Claim Assurance | Assurance | `Claim Assurance` |

The four judgment criteria can be condensed as follows.

```text
Fit
Proportion
Integrity
Assurance
```

`Context Fit` and `Intervention Proportionality` are candidates for more parallel signs, but the rename is not finalized before a transition trace exists.

### 5.9 Closure Requirement

> A category-specific condition that must be demonstrated or explicitly dispositioned to close a Judgment.

A Judgment Category owns a Closure Requirement family. An actual requirement is derived instance-specifically from the combination of Category, Judgment Subject, and current Context.

```text
Consequence Integrity category:
  possible execution must remain within the acceptable consequence envelope.

Current Judgment requirement:
  duplicate callback history must preserve the at-most-one capture invariant.
```

Distinguish a Closure Requirement from a Contribution Need.

```text
Closure Requirement:
  What must be true or dispositioned to close the Judgment?

Contribution Need:
  What input is currently missing to evaluate that requirement?
```

A Closure Requirement does not include a Skill name, verifier name, or professional role.

### 5.10 Contribution Need

> The functional role of input required to close a Judgment.

Use `Contribution Need` instead of `Contribution Role`, because `role` may be misunderstood as a professional role.

Examples:

```text
confirm accepted behavior
search for counterexamples
compare possible executions
external product decision
claim-relevant verifier
```

A Contribution Need does not contain a Skill name.

### 5.11 Contribution

> A source-bounded input that actually addresses one Contribution Need.

A Contribution may be an Observation, analysis, model, comparison, candidate, verifier result, or external decision. A Contribution does not itself become a Conclusion or create permission.

```text
Skill output
  → Contribution

evaluate Contributions by Need
  → Need Coverage

synthesize Need Coverage and Closure Requirements under the category contract
  → Conclusion
```

### 5.12 Capability

> A means capable of repeatedly producing a particular kind of Contribution.

The Capability inventory is open-world.

```text
package Skill
external or project-local Skill
tool
specialist capability
```

`AGENTS.md` and repository instructions are usually Context sources. They do not automatically become Capabilities.

A Skill `name` is a human-facing label, not Capability identity. The runtime generates a discovered source-bound Capability ID and a Skill/TOC content-bound revision ID. Handling identical names and the Pi discovery boundary are defined by [Capability and Material Routing](./action-loop-routing-contract-v0.1.md).

### 5.13 Need Coverage

> A relation in which the Upper Judgment assesses how fully current Contributions address one Contribution Need.

```text
covered
partially-covered
conflicted
missing
```

- `covered`: sufficient support exists to evaluate the related Closure Requirement.
- `partially-covered`: useful support exists, but a consequential residual remains.
- `conflicted`: material Contributions support incompatible interpretations.
- `missing`: no usable Contribution addresses the Need.

`superseded` is not Coverage. It is a Need lifecycle state in which the Need is no longer current because the Subject, Context, or Closure Requirement changed.

A Skill, Reference, or tool does not declare Need Coverage for itself. The Upper Judgment assesses it after considering all Contributions, conflicts, limitations, and residual Needs. Even when Need Coverage exists, no Conclusion can be produced unless all Closure Requirements are satisfied.

### 5.14 Conclusion

> A category-scoped answer that closes one Judgment.

The following are distinct.

```text
Conclusion ≠ external permission
Conclusion ≠ executed Action
Conclusion ≠ Work Case completion
```

For example, even if there is a Conclusion that `publishing is appropriate`, it cannot be executed without publish permission.

### 5.15 Action Candidate

> One concrete controlled Action under consideration to advance the current Work Case.

An Action Candidate is not yet executable. A V0 candidate binds together a kind and SHA-256 fingerprint assigned by the host to an exact controlled action representation, intended Effects, and required Conclusion IDs. The fingerprint does not mean permission or execution success, nor does it cause the Work Core to own provider-specific tool arguments.

```text
exact controlled action fingerprint
+ intended Effects
+ required Conclusions
  → Action Candidate

Action Candidate
+ sufficient warrant
+ current permission
= cleared Action
```

### 5.16 Action Clearance

> A bounded gate result stating that a specific Action Candidate may currently be executed.

```text
warranted(action):
  Does the current Judgment support the Action?

permitted(action):
  Do the current delegation and host Constraint allow the Action?

cleared(action):
  warranted(action) && permitted(action)
```

`Action Clearance` distinguishes a Conclusion from permission without yet requiring an independent authority subsystem. A V0 Permission Decision is a separate refined input bound to an Action Candidate and preserves `granted | denied | unknown`, source, and basis. Model proposal provenance does not substitute for a Permission Decision. If a required Conclusion is absent or permission is `denied | unknown`, the result is explicit `not-cleared`, not malformed success. The internal representation is expanded only when permission variation becomes complex in a finite trace.

### 5.17 Effect

> The result that actually occurred in reality after an Action.

Distinguish an Effect from a tool result.

```text
tool result:
  the command returned exit 0.

Effect:
  the intended file actually changed and no other mutation occurred.
```

The actual Effect may initially be unknown. The V0 runtime creates a pending Effect identity only when it receives a host occurrence whose exact controlled-action fingerprint matches the Action Clearance. Different occurrence IDs produce separate Effects even under the same clearance. A host occurrence means only that execution was attempted; it does not mean the intended Effect succeeded or was settled.

### 5.18 Effect Observation

> An Observation that enables an evidence-bounded judgment about the actual Effect.

A filesystem diff, registry lookup, process state, or test result may be an Effect Observation. A V0 Observation associates an evidence kind, locator, exact fingerprint, bounded statement, and limitation with an Effect identity. None automatically proves every Effect. In particular, a `tool-result` Observation records a host command outcome only; it does not produce an `observed-success` settlement.

### 5.19 Effect Settlement

> An accounting operation that connects an Action and Effect Observations to conclude the actual result sufficiently for the next transition.

The following may be settled conclusions.

```text
observed-success
observed-no-effect
failed
partially-applied
```

A known partial effect may be settled as partial, but may prevent completion or reopen a Judgment. A V0 settlement accounts for every current Observation exactly once as `relied-on | not-relied-on` and every intended Effect exactly once as `observed | not-observed | failed | partially-observed | unknown`. The Outcome is derived from this accounting, and a proposal string cannot declare a stronger result.

The following remain unsettled states.

```text
pending  // there is no relied-on Observation
unknown  // Observations exist, but the intended Effect is indeterminate
```

### 5.20 Claim

> An explicit proposition that Evidence can support or challenge.

Evidence is not an independent object so much as a support relation between an Observation or Contribution and a specific Claim.

### 5.21 Closure Claim

> A proposed Claim for transitioning a Work Case to complete, blocked, or another explicit status.

`Closure Claim` is broader than `Completion Candidate`.

```text
complete:
  the requested behavior was satisfied within the verifier’s scope.

blocked:
  the acceptance condition cannot be closed without the required external decision.

no-change:
  the current implementation already satisfies the accepted contract.
```

A Claim Assurance Judgment bounds the scope of a Closure Claim to the Evidence. The V0 completion path seals every Outcome acceptance condition, Constraint, Conclusion, occurred Effect, and current Effect assessment from the canonical Work Case revision as a `Closure Target`, without a caller-selected subset. Missing Claim Assurance, a missing Effect assessment, `pending | unknown`, or unresolved `failed | partially-applied` prevents target creation. A Closure Claim must account exactly for all obligations and current evidence in the Target and does not directly perform the status transition. Completion Claim mode is `completed | no-change`. `blocked` is created as a separate transition when the current Claim Assurance Conclusion accounts for every current closure blocker and supports the absence of a current closure path.

### 5.22 Work Status

> The state indicating where a Work Case currently stands with respect to continuation and closure.

```text
active
waiting
blocked
paused
complete
```

- `active`: a current continuation path exists.
- `waiting`: a human, tool, or external Observation has confirmed an external condition, and the Work Case is waiting for an observable resume predicate to be satisfied. It returns to a new active revision only when the resume predicate is `satisfied` by a current Observation.
- `blocked`: the current Claim Assurance Conclusion accounts for every closure blocker and supports that no current required closure path exists. It returns to a new active revision only when a human, tool, or external Observation provides a changed condition and a concrete continuation path.
- `paused`: continuation is possible, but work was stopped by an explicit human decision. Resumption also requires an explicit human decision.
- `complete`: required Closure Requirements and Need Coverage support the Judgment Conclusion, the Closure Claim is assured, and consequential Effects have been settled. The V0 complete transition recalculates the Closure Target from the current Work Case and revalidates the target revision and Claim binding. If a Conclusion, Action, Effect, or assessment is added after the Claim, the previous Target is stale and completion fails closed.

A transition from `paused | waiting | blocked` back to `active` records stop/resume identity in Outcome continuity. Therefore, a Closure Target from before the pause or wait does not become valid again after resumption.

## 6. Runtime component vocabulary

### Work Core

Owns Work Case transitions and invariants. It does not own Pi hooks, TUI, or Skill discovery. `pure` is an implementation property and therefore is not included in the product concept name.

### Contribution Router

Selects an available Capability based on the Contribution Need and Context. For a structured Skill-backed Capability, it applies root applicability from the schema-identified TOC and Skill-local Reference relevance. For an unstructured Capability, it does not synthesize an authored predicate or Reference route and permits only open-world applicability using Pi-admitted metadata and an explicit basis. It does not produce Conclusions or Need Coverage and does not enforce a fixed Skill order.

### Model Protocol

The boundary through which a model, provider, or human evaluator proposes Observation, applicability, Reference disposition, Contribution, Need Coverage, Action Candidate, settlement, and Closure Claim in the same semantic shape. A Proposal is not canonical state and must pass a Work Core transition guard.

Provider-specific response envelopes, tool-call dialects, structured-output limitations, and prompt tuning are adapter details outside the protocol. The V0 evaluator attempt boundary preserves adapter/provider/model provenance while normalizing the transport outcome to `proposal | unresolved | invalid`. Only a `returned` payload that passes a proposal-specific refiner becomes a proposal. Malformed, refused, failed, empty, or timed-out output remains an unresolved or invalid outcome and does not become implicit success.

### Pi Adapter

Translates between Pi hooks and Work Core transitions. It combines Pi-selected Skill provenance, exact Skill content, and a schema-identified TOC or explicit no-TOC state into a refined Capability inventory, and generates source-bound Capability IDs and content-and-routing-bound revision IDs. A recognized invalid descriptor is not reduced to a no-TOC state. It normalizes provider/model-specific responses into Model Protocol proposals. It does not cause the Work Core to own the raw filesystem, Pi discovery policy, or provider SDK types.

### Work Record

Preserves the accepted work history, rejected proposal disposition, and evidence provenance required for replay. It does not depend on model memory or hidden conversation state. Model/provider metadata may be recorded as provenance but is not domain authority. It does not prematurely establish `event store` or append-only storage as a public concept.

### Work View

A read-only projection that presents a Work Case to the user. It does not own mutation or transitions.

## 7. Canonical relation vocabulary

Use whether the following sentences remain natural as a concept boundary check.

```text
Outcome defines Work Case.

Observation may reveal Warrant Gap.

Warrant Gap opens Judgment.

Judgment is classified by Judgment Category.

Judgment Category, Subject, and Context derive Closure Requirements.

Current unmet Closure Requirement reveals Contribution Need.

Capability produces Contribution.

Contribution addresses Contribution Need.

Upper Judgment assesses Need Coverage.

Judgment synthesizes Coverage and Contributions into Conclusion.

Conclusion warrants an Action Candidate or Claim.

Warrant and permission clear an Action Candidate.

A cleared Action produces an Effect.

Effect Observations settle the Effect.

Claim Assurance bounds a Closure Claim.

Closure Claim supports a Work Status transition.
```

## 8. Current-to-domain rename map

This table is not a code rename instruction. It defines the domain senses to use in transition traces and new implementations.

| Current expression | Problem | Domain candidate |
| --- | --- | --- |
| `WorkState` | Representation name | `Work Case` |
| `intendedOutcome` | Delegation provenance and concept are mixed | `Outcome` |
| `referent` | Abstract for product readers | `Judgment Subject` |
| `requiredContributions` | Reads as though Contributions already exist | `Contribution Needs` |
| `authorizedAction` | Mixes warrant and permission | `Cleared Action` |
| `unsettledEffects` | Hides the relation | `Effects Pending Settlement` |
| `completionCandidate` | Does not encompass blocked and no-change | `Closure Claim` |
| capability discovery | Reads like list exploration | `Contribution Routing` |
| read-only projection | Centered on implementation terminology | `Work View` |

## 9. Transfer and boundary cases

| Case | Concept boundary exposed |
| --- | --- |
| Fixing a trivial typo | Not every unknown is a Warrant Gap. |
| Retention policy is undecided | Even with a Contribution, no Conclusion can be produced without the required external decision. |
| A Skill returns a local result as resolved | Skill-local resolution, Need Coverage, and Conclusion are distinct. |
| Two Contributions conflict | Even when useful input exists, Coverage is `conflicted` and does not close the Judgment. |
| A release is ready but publishing is not permitted | Conclusion and Action Clearance are distinct. |
| The tool succeeded but the file did not change | Tool result and Effect are distinct. |
| The file changed only partially | Effect and Effect Settlement are distinct. |
| Tests are green but compatibility is unverified | Observation and claim-relevant Evidence are distinct. |
| The response ended | An agent turn and Work Status are distinct. |
| Waiting for an external API | The Environment is not the owner, and the Work Case remains waiting. |
| Switching from model A to model B | The Model is not the Work Case owner, so accepted state is preserved. |
| Malformed or refused model output | It is a proposal failure, not no-gap, Coverage, or completion. |

## 10. Implementation promotion rule

Do not create a type, class, event, or JSON field merely because a concept exists. Promote a concept into an implementation representation only when it satisfies the following conditions.

```text
it has independent state in a finite trace
&& it can fail independently of other concepts
&& it is required to preserve an invariant or forbidden state
&& it cannot be replaced by one smaller representation
```

As much as possible, leave connector relations as predicates, transition guards, or field relations. Add runtime components only when required by a current host boundary or verification need.

## 11. Deferred vocabulary

The following are not yet stable concepts and therefore must not be made into canonical schema.

- `AuthorityEnvelope`
- `AuthorizationReceipt`
- delegation revision model
- contributor professional role
- generalized precedence engine
- confidence calculus
- SDK-owned controller
- provider-specific domain state
- model-specific Judgment Category or Capability identity

Reopen authority vocabulary when finite traces of `Action Clearance` cannot express permission variation.

## 12. Reopen rule

Reopen this vocabulary when the following evidence appears.

- Two concepts always move at the same stop in the same transition, eliminating their independent boundary.
- One concept contains two or more independent questions or failure mechanisms.
- A name’s stable sense does not hold in a source-external trace.
- Replay or an invariant breaks unless a connector relation is preserved as state.
- A runtime caller can reasonably infer an incorrect effect, authority, or lifecycle from the current name.
- A materially different model or human evaluator cannot express the same accepted domain proposal through the current protocol.

Until then, do not add synonyms or promote a current implementation mechanism into a domain name.
