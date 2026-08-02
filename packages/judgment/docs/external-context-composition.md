# External Context Composition

Status: design decision revised after author review; implementation is pending.

## Invariant

A packaged reference is prepared guidance, not privileged truth or a mandatory
coverage unit. Context acquired outside the package may be more relevant,
current, authoritative, or specific. Local and external material must be usable
together without flattening provenance or authority.

```text
package reference availability ≠ requirement
external context availability  ≠ relevance
relevance                      ≠ selection
selection                      ≠ authority
authority                      ≠ semantic correctness
```

## Current implementation

The current candidate already has a package-neutral acquisition seam:

- inventory includes packaged references, visible Pi skills, and Pi-loaded
  context files;
- observed context admits exact active-branch tool-call/result pairs and explicit
  user events;
- selection and sealing preserve exact chosen content;
- assurance keeps `agent-asserted`, `domain-verified`, and `user-accepted`
  distinct; and
- Observer creates typed domain observations through its own adapter.

Its authoring defect is that every policy must predeclare source slots,
`toolNames`, roles, assurances, questions, needs, and `canInform` links. That
closed graph rejects useful context the author did not predict and makes runtime
mechanics part of package authorship.

## Context lanes

External context enters through package-neutral runtime lanes, not per-skill
source catalogs.

| Lane | Examples | Authority boundary |
| --- | --- | --- |
| Ambient constraints | system/developer instructions and Pi-loaded project context | constrain execution; guidance cannot override them |
| Prepared references | package-local files listed with complete `when` relevance statements | agent-asserted guidance |
| Current-task observations | repository reads, tests, diagnostics, runtime output, fetched specifications | exact provenance; semantic interpretation remains agent-owned |
| Explicit user decisions | direct branch-local user answers and accepted choices | authority only for user-owned policy or acceptance |
| Domain evaluator observations | typed evaluator result for one declared relation | authority only for that evaluator's declared relation |
| Peer capability results | completed visible Pi skill or package-neutral tool result | method/guidance unless a typed adapter grants narrower authority |

Other packages remain peers. Judgment never imports their private modules or
branches on package names. Their material becomes eligible only through normal
Pi-visible context, tool results, user events, or typed evaluators.

## Composition is a typed union

```text
ExecutionContext =
    AmbientConstraints
  ⊕ CurrentTaskObservations
  ⊕ ExplicitUserDecisions
  ⊕ SelectedPreparedReferences
  ⊕ NominatedExternalMaterial
  ⊕ DomainEvaluatorObservations
```

`⊕` is not text concatenation and has no global “newer wins” ordering.

- constraints bound legal results;
- observations support or challenge factual claims;
- user decisions choose only within user-owned policy space;
- methods organize work;
- guidance contributes distinctions and counterexamples; and
- evaluators establish only their declared domain predicates.

A user decision cannot make a failing test pass. A packaged reference cannot
overrule current repository evidence. A web page cannot override a project
constraint merely because it is newer. A domain evaluator cannot manufacture a
semantic conclusion outside its declared relation.

## Prepared-reference selection

The authored policy lists each prepared reference independently:

```json
{
  "path": "references/verifier-selection-and-pass-but-wrong.md",
  "when": [
    "A green check needs a falsifying observer and a plausible pass-but-wrong case before it can support a consequential product or contract claim."
  ]
}
```

Runtime behavior is direct:

```text
current task and evidence
→ compare with each reference.when
→ select the smallest materially useful set
→ read exact selected files
→ combine with exact useful external context
→ persist the dynamic question and actual contributions
```

No pre-authored route or question must be resolved. An applicable reference may
remain unread when exact selected external material already provides its useful
distinction; the selection basis records why the local read would be redundant.
An unavailable unselected reference creates no missing-context obligation.

If exact packaged text is normative, it belongs in `SKILL.md`, adapter code, or
ambient constraints rather than optional guidance.

## Runtime relation model

The runtime keeps three values distinct:

```text
DynamicJudgmentQuestion
  generated judgment identity
  exact current question text
  owning capability
  basis material identities
  branch identity and hash

ContextMaterial
  identity and origin kind
  exact provenance
  branch/time scope
  content hash
  success/error/truncation state

ContextContribution
  material identity
  generated judgment identity
  use as: constraint | evidence | decision | method | guidance
  exact contribution statement
  assurance bounded by origin/adapter
```

A source does not intrinsically have one permanent semantic role. The relation
between one exact material and the current dynamic question carries `use as`.
Origin and typed adapters determine the maximum assurance that relation may
claim.

The existing binding, sealed-member, assurance, and event machinery may remain
internal, but static question, need, route, and coverage catalogs do not belong
in human authoring.

## Execution sequence

```text
1. Pi supplies ambient constraints and current branch context.
2. Pi/Developer considers an owning capability using SKILL.md discovery and policy applicability.
3. Runtime forms the exact task-specific judgment question from the current gap.
4. The agent matches package references by their independent when statements.
5. Pi acquires selected local references and useful repository, runtime, web, user, evaluator, or peer context.
6. The agent nominates exact materials and states their contributions; adapters bound authority.
7. Judgment selects and seals only context actually used.
8. The capability executes under labeled constraints, evidence, decisions, method, and guidance.
9. The outcome cites selected contributions and states any material limitation.
```

Pi owns discovery and physical acquisition. Agents own semantic nomination.
Typed adapters own non-agent assurance. Judgment owns exact parsing, provenance,
selection, sealing, and replay.

## Case model

| Case | Valid behavior |
| --- | --- |
| No packaged reference matches, but repository evidence is needed | Acquire and use task observations; no reference ceremony. |
| One reference matches and is the cheapest useful distinction | Read and cite it. |
| Several independent references match | Read the smallest set that materially contributes; no shared route ID is needed. |
| A current specification already provides a local reference's intended distinction more precisely | Select and cite the specification; record why the local read was redundant. |
| Local guidance supplies method while external context supplies current facts | Use both with separate contribution roles. |
| Local guidance conflicts with current observed behavior | Preserve both; evidence reveals drift or limits applicability. |
| Two external sources conflict | Preserve identities and scope; never choose by arrival order. |
| External output is errored or truncated | It may explain a gap but cannot support a positive contribution claim. |
| An explicit user decision conflicts with system/project constraints | Preserve user intent but reject the forbidden result. |
| Another skill owns a distinct question, artifact, and stop | Hand off; its completed result may later become context. |
| Another skill contributes one bounded distinction | Use its exact result as peer method/guidance without transferring ownership. |
| Material exists only on a sibling branch | Reject it until acquired on the active branch. |
| Unrelated inventory appears later | Do not stale selected work. |
| Selected external content changes | Reject replay and reacquire/reassess. |

## Forbidden states

| Forbidden state | Why |
| --- | --- |
| “All package references were read, therefore the judgment is complete.” | Catalog ceremony does not prove contribution. |
| A per-skill list of every acceptable tool or package | Runtime infrastructure drifts independently of skill meaning. |
| A generic authored question reused as if it were the current task question | It hides the actual evidence gap and forces reinterpretation. |
| An authored route ID created only for runtime bookkeeping | It exposes an implementation identity with no independent author meaning. |
| Unattributed prose copied into a result | It loses provenance and authority boundaries. |
| One flattened context string mixing user decisions, facts, and guidance | Conflict and assurance cannot be audited. |
| Direct sibling-package imports | They break peer isolation. |
| Agent prose claiming `domain-verified` or `user-accepted` | Those require evaluator or user events. |
| Reading another skill's private reference directory as a shared library | Peer methods enter through normal Pi interaction. |

## Guarantee map

| Guarantee | Owner | Verification target |
| --- | --- | --- |
| Human policy contains only owner applicability and independent prepared references | authoring parser/compiler | schema examples and legacy-field rejection |
| Runtime creates the exact current question | runtime adapter | different task gaps produce different replayable questions |
| Useful external context needs no prior per-skill enumeration | Pi adapter and branch resolver | external tool/context/peer-result tests |
| Every used item has exact content/provenance identity | selection and sealing | stale, duplicate, error, truncation, and cross-branch tests |
| Semantic role is contextual | contribution parser | same material used validly in different roles |
| User/domain authority cannot be forged | typed adapters and exact event provenance | assurance forgery regressions |
| Catalog availability never creates a completion obligation | runtime selection | no-reference and external-redundancy fixtures |
| Consumer packages remain isolated | repository isolation check | forbidden sibling import/content checks |

## Decision

Keep package references as independently conditional prepared guidance. Admit
exact external material through runtime lanes. Generate the judgment question
from current task evidence. Mix selected material through typed contribution
relations, not static routes, authored question catalogs, or flattened prompt
text.
