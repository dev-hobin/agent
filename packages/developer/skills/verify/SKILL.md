---
name: verify
description: "Judge what claims are supported by code, tests, diffs, command results, UI states, implementation reports, invariants, or problem models. Use when completion, correctness, verifier selection, coverage, source compatibility, structural degradation, or pass-but-wrong risk depends on mapping current evidence to a concrete claim."
---

# Verify

Map evidence to claims without turning green checks into broader proof.

## Core Question

What claims does the available evidence support?

## Inputs

- Claims under review
- Test or command output, diff, code, UI state, or implementation report
- Invariant, model, accepted decisions, and verification targets when available
- Relevant counterexamples and source provenance

## Reference Routing

Read [the verifier selection and pass-but-wrong reference](references/verifier-selection-and-pass-but-wrong.md)
when several claims need different evidence, a passing command may not exercise
the accepted meaning, source compatibility matters, or behavior can pass while
structure degrades. Also read it before a consequential completion claim whose
verifier relevance or residual risk is unclear. A narrow claim with direct,
relevant evidence does not need the reference.

## Output

Lead with the user's claim and observed evidence; keep verification labels secondary.
Use an evidence matrix as the primary surface:

| Claim | Evidence | Strength/relevance | Wrong case that could pass | Status |
| --- | --- | --- | --- | --- |

Follow it with a concise residual-risk and unverified-claims list. When source
compatibility matters, add requested-versus-exercised provenance as a separate
row or table. Produce the strongest scoped satisfaction judgment, target and
counterexample coverage, assumptions, and residual risk. When used inside a
larger task, return:

```text
Status: resolved | needs-evidence | not-applicable | blocked
Result: the strongest claim justified by the evidence
Basis: checks, inspections, provenance, and accepted assumptions
Open questions: unverified claims or human-owned acceptance, or none
Artifacts: evidence map and residual risks
```

Return only this skill's judgment for the question at hand; leave subsequent
routing to the caller.

## Completion

Finish when each stated claim is supported, narrowed, or explicitly left
unverified, and plausible pass-but-wrong shapes have been considered. Revisit
after code changes, new evidence, changed claims, or source-provenance changes.

## Method

1. Extract the exact claims from the request, accepted decisions, implementation
   report, invariant, or model.
2. Attach concrete evidence to each claim and classify its strength.
3. Check constraints, forbidden cases, transitions, callers, and abstraction
   stop checks when they are part of the claim.
4. Distinguish verifier execution from verifier relevance.
5. Ask what wrong implementation could still pass and name its concrete shape.
6. Narrow any passing claim that is broader than its evidence.
7. Separate missing evidence, blocked evidence, human judgment, and residual
   risk instead of hiding them in a passing summary.
8. For compatibility, bind evidence to the actual source and version. A source
   mismatch is not evidence about the requested target.

## Missing Evidence

Return `needs-evidence` when an available check or inspection can answer the
claim. Return `not-applicable` when there is no claim to judge. Return `blocked`
when required evidence depends on unavailable environment or human acceptance.
If no claim is stated, infer only the weakest claim justified by the evidence.

## Boundary

Do not invent product scope, run an entire development workflow, repair the
implementation, or turn weak evidence into a completion claim.
