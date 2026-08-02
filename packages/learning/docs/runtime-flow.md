# Learning Runtime Flow

Learning exposes five independently complete skills. The map separates package
authoring from the model-visible runtime; it must not be read as a required
learning phase sequence.

## Independent capability selection

```mermaid
flowchart TD
  R[Current learning question] --> S{Owning skill}
  S --> TR[technical-reading]
  S --> OR[opensource-reading]
  S --> C[conceptualize]
  S --> P[patternize]
  S --> E[exercise]
  TR --> O[Complete conversational or Markdown result]
  OR --> O
  C --> O
  P --> O
  E --> O
```

A handoff occurs only when another skill's core question becomes consequential.
No skill is a mandatory predecessor or successor of another.

## Authoring versus runtime

```mermaid
flowchart LR
  subgraph Development time
    J[judgment.json] --> P[Exact policy parser]
    P --> D[Generated Context Directions]
    D --> K[SKILL.md parity check]
  end
  subgraph Packed runtime
    K --> M[Model-visible skill method]
    M --> A[Ordinary Pi acquisition]
    A --> R[Learning result + limitations]
  end
```

Learning does not ship the Judgment extension, session lifecycle, or nested
Judgment skill. It uses Judgment only to compile deterministic directions during
development.

## Reference selection

```mermaid
flowchart TD
  C[Current question and exact source material] --> W{Reference when matches?}
  W -->|no| Z[Read zero prepared references]
  W -->|yes, distinction still missing| R[Read that exact reference]
  W -->|yes, external material already supplies it| Z
  R --> O[Record how it changed the result]
  Z --> O
```

Prepared references are candidates, not requirements or authority. External
source material remains open-world and may make local guidance redundant.

## Persistence boundary

Every skill returns a complete result in conversation. Files are written only
when the user explicitly asks for a target. Learning assumes no notebook, graph,
Git workflow, or sibling-package persistence owner.
