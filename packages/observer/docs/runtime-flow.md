# Observer Runtime Flow

Observer coordinates one branch-local inquiry Episode and publishes only an
explicitly approved Notebook batch. The diagram shows ordering and write
boundaries; it does not imply that model interpretation is true.

## Episode flow

```mermaid
flowchart TD
  S[Notebook selected] --> E[Open or resumed Episode]
  E --> I{Entry path}
  I -->|Sidecar on| N[Explicitly nominated tool result]
  I -->|Add hypothesis| H[Exact user hypothesis]
  I -->|Observe material| M[Inline or retrieved material]
  N & H & M --> R[SourceRead]
  R --> D[Typed domain-context gate]
  D -->|missing or conflicting| B[Block semantic mutation]
  D -->|covered| O[Observation / hypothesis review]
  O --> MM[Memo reconciliation]
  MM --> P[Prepare Review proposal]
  P --> V[Inspect diff + final + existing Markdown]
  V -->|Back| P
  V -->|Return to Review| MM
  V -->|Save all approved| W[Write batch]
  W --> RB[Readback validation]
  RB --> X[Settle Episode]
```

Only the `Save all` path writes Notebook Markdown. Preparation, workbench
inspection, Memo reconciliation, and proposal review are read-only with respect
to the Notebook.

## Processing policy

```mermaid
flowchart LR
  C[Pending Observer work] --> P{Processing policy}
  P -->|Off| S[Keep local staging only]
  P -->|Piggyback| F[Use an existing foreground turn]
  P -->|Local background| L[One selected loopback model]
  F --> A[At most one final observer-commit]
  L --> A
```

Piggyback means no separate inference request, not zero token overhead. Local
background accepts only a loopback endpoint and runs with concurrency one.

## Evidence and assurance

```text
exact SourceReading / InquiryContext / Memo scope
→ adapter-owned evaluator relation
→ compact observer-context-basis/v1
→ semantic action proposal
→ immediate branch revalidation
→ serialized append
```

Named evaluators establish only declared source, inquiry, or memo relations.
Semantic stance and movement remain agent-asserted. User-owned decisions require
an explicit user event. Missing context, stale basis, cross-branch evidence, or
conflicting relations block mutation.

## Durable boundary

```mermaid
flowchart LR
  PS[Pi session events] -->|coordination + replay| E[Episode]
  E -->|approved publication only| NB[Notebook Markdown]
  NB -->|durable source of truth| R[Source / Inquiry / Memo / Zettel]
```

Pi events do not replace the Notebook. Observer does not own Git, remote sync,
backup, graph databases, or model semantic truth.
