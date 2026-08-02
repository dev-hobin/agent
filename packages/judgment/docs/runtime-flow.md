# Judgment Engine Flow

`@hobin/judgment` is a side-effect-free engine. An adapter owns discovery,
interaction, persistence, UI, and domain authority.

## Policy loading

```mermaid
flowchart LR
  C[Pi-visible Skill candidate] --> N[Agent nomination]
  N --> P{co-located judgment.json}
  P -->|absent| S[Normal complete Skill source]
  P -->|present + valid| V[Compiled policy]
  P -->|present + invalid| X[Reject this source]
  V --> A[Policy visible before applicability]
  A --> R[Applicable prepared references]
```

Adapters inspect only exact nominated Skills. The engine does not crawl every
policy or read reference content at inventory time.

## One judgment, several context sources

```mermaid
flowchart TD
  Q[One dynamic question] --> I[Internal prepared context]
  Q --> E1[External Skill 1]
  Q --> E2[External Skill 2]
  Q --> O[Observed branch context]
  E1 --> P1[Optional policy + references]
  E2 --> P2[Optional policy + references]
  I & P1 & P2 & O --> S[One selection and atomic seal]
  S --> C[One contribution coverage]
  C --> J[One outcome]
```

A Skill may be a primary capability in one request and a context method,
constraint, evidence source, or guidance source in another. `judgment.json`
describes applicability and reference relevance; it does not start another
workflow.

## Engine lifecycle

```mermaid
stateDiagram-v2
  [*] --> Started: parse dynamic question
  Started --> SelectionOpen: applicable
  Started --> NotApplicable: excluded
  Started --> NeedsContext: applicability unresolved
  SelectionOpen --> Selected: exact nominations
  Selected --> Sealed: bounded acquisition succeeds
  Sealed --> Covered: contributions assessed
  Covered --> Outcome: conclude
  Covered --> Selected: revise selection
  NotApplicable --> [*]
  NeedsContext --> [*]
  Outcome --> [*]
```

Selection and sealing commit atomically. Failed acquisition leaves the attempt
at its prior immutable state.

## Material and authority

```mermaid
flowchart TD
  M[Selected material] --> U[useAs]
  U --> K[constraint]
  U --> E[evidence]
  U --> D[decision]
  U --> T[method]
  U --> G[guidance]
  K & E & D & T & G --> C[Concrete contribution]
  C --> A{Assurance}
  A -->|agent prose| AA[agent-asserted]
  A -->|typed evaluator| DV[domain-verified]
  A -->|exact user event| UA[user-accepted]
```

Every selected usable material needs a contribution. Generic prose cannot create
`domain-verified` or `user-accepted` assurance. The engine never grants mutation
authority; the owning adapter does.

## Identity

```text
owner + policy
→ question + branch
→ admitted source policies
→ selected descriptors + selected content
→ contributions + conflicts + limitations
→ outcome
```

Selected policy, question, descriptor, or content drift fails. Unrelated
inventory growth does not.
