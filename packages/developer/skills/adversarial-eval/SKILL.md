---
name: adversarial-eval
description: "Design and run finite adversarial evaluations for Pi skills, packages, agent workflows, or implementation claims using exact source provenance, escalating counterexamples, hidden checks, failure classification, and a marginal-value stop rule. Use when ordinary checks may miss real workflow, compatibility, or pass-but-wrong failures."
---

# Adversarial Eval

Design and run the smallest evaluation that can falsify the target claim.

## Core Question

What adversarial evidence would expose the target's real failure modes?

## Inputs

- Target, exact source or version, and falsifiable claims
- Existing tests, transcripts, reports, diffs, or recent failures
- Likely pass-but-wrong shapes and compatibility hazards
- Cost, time, mutation, and safety limits

## Output

Lead with the target claim and observed failure mode; keep eval labels secondary.
Render the escalation ladder as an ordered matrix with source/version,
fixture, verifier, expected falsifier, mutation scope, and stop condition. After
execution, append observations to the evidence table below and show round
progression as a compact `smoke → visible → … → stop` line. Do not replace exact
commands or fixture provenance with narrative summaries. Produce target
provenance, claims and risk model, observed feedback, failure taxonomy, stop
rule, and residual risks. When used inside a larger task, return:

```text
Status: resolved | needs-evidence | not-applicable | blocked
Result: evidence for or against the exact evaluated claim
Basis: fixtures, commands, transcripts, provenance, and observations
Open questions: untested failure modes or source gaps, or none
Artifacts: fixtures, execution matrix, feedback, and stop decision
```

When reporting multiple claims or rounds, keep the local evidence auditable:

| Claim | Fixture or verifier | Observation | Classification | Residual |
| --- | --- | --- | --- | --- |

Use only the failure classes defined below. This table records evaluation
evidence; it does not choose another capability.

Return only this skill's judgment for the question at hand; leave subsequent
routing to the caller.

## Completion

Finish when the highest-risk failure modes have been exercised, the last useful
round no longer changes a patch or decision, or the next round's expected
information is lower than its cost. Revisit after a new source version, failure
class, user regression, or compatibility path appears.

## Method

1. Bind the target to its requested and actual source or version.
2. State a falsifiable behavioral claim.
3. Build a risk model from likely hidden conditions, stale source, human-owned
   decisions, mutation scope, and pass-but-wrong behavior.
4. Choose the smallest useful ladder:
   - `smoke`: metadata, syntax, manifest, or command health;
   - `visible`: straight-line baseline behavior;
   - `hidden-parent`: stronger local invariants and artifact checks;
   - `adversarial`: ambiguous, conflicting, stale, stateful, or nested cases;
   - `compatibility`: requested source versus actually loaded source;
   - `gate-residual`: evidence or acceptance that must remain unresolved.
5. For each round, state the claim, fixture, verifier, expected evidence,
   failure meaning, mutation scope, and stop condition.
6. Run each round within the declared mutation and safety limits, preserving
   exact command, fixture, source, and observation provenance.
7. Classify results as `pass`, `implementation-fail`, `model-or-spec-fail`,
   `verifier-gap`, `blocked-environment`, `pass-but-wrong-risk`, or
   `structural-degradation`.
8. Add or rerun a round only when it can change the target claim or decision.

## Missing Evidence

Return `needs-evidence` when a concrete fixture or exact-source run is still
available. Return `not-applicable` when the claim is not falsifiable. Return
`blocked` when the requested source or environment was not actually exercised.
Never count evidence from a mismatched source as a target failure.

## Boundary

Do not import the target workflow's responsibilities, repair the evaluated
target, exceed the declared fixture mutation scope, or present evaluation
evidence as release approval.
