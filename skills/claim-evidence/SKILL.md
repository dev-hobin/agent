---
name: claim-evidence
description: Judge exactly what concrete evidence supports about one or more completion, correctness, compatibility, safety, learning, or source-backed claims. Use when a green check, implementation report, explanation, citation, or multi-turn follow-up may be broader than what was actually observed, especially when evidence for one field, branch, participant, or path is generalized to an unobserved sibling. Not for a routine bounded completion report whose stated observer directly matches the claim and no broader inference is disputed. Produce a bounded support judgment and residual gap; do not repair or execute the work.
metadata:
  version: "0.1.0"
---

# Claim Evidence

Prevent activity or a passing observer from becoming a broader proof than it can support.

## Core Question

What is the strongest bounded claim justified by the current evidence, and what plausible wrong case could still pass?

## Inputs

- exact claim or compound claims;
- observed tests, commands, runtime state, source passages, learner actions, or reports;
- accepted invariant, contract, version, or target when available;
- known counterexamples or near misses.

Return `needs-claim` when there is no concrete claim. Return `needs-evidence` when an accessible observer could decide the claim but no relevant observation is supplied. Return `not-applicable` for a routine bounded completion report whose observer directly matches its claim and that makes no broader correctness inference.

## Method

### 1. Split compound claims

Separate claims that need different observers.

```text
sequential behavior
concurrent behavior
HTTP shape
database state
architecture responsibility
security property
source support
learner capability
```

Do not let evidence for one substitute for another.

### 2. Bind each observer

For every claim, state:

```text
Evidence:
What distinction it can observe:
Actual observation:
Source/version/environment:
```

“Test passed” supports only behavior the test can distinguish from a plausible wrong implementation.

### 3. Construct one pass-but-wrong case

Name the smallest realistic implementation or interpretation that would satisfy the observer while violating the claim.

Examples:

- sequential pre-check passes while concurrent inserts leak a database exception;
- HTTP 422 is returned after an unwanted persistence effect;
- generated code passes tests while violating an accepted responsibility boundary;
- a paper discusses a topic but does not test the adapted workflow;
- the learner acknowledges an explanation but cannot apply it to a changed case.

### 4. Assign bounded status

Use one:

```text
supported     direct fitting evidence supports the scoped claim
narrowed      a weaker version is supported, but the stated claim is too broad
unverified    no fitting observation exercises the claim
contradicted  current evidence conflicts with the claim
blocked       evidence depends on unavailable environment or human acceptance
```

### 5. Name the residual

State the next cheapest observer only when it could change the judgment. Do not produce an implementation plan.

## Output

| Claim | Evidence and provenance | Distinction observed | Pass-but-wrong case | Status |
| --- | --- | --- | --- | --- |

Then return:

```text
Strongest supported claim:
Unverified or contradicted claims:
Next discriminating observer, if useful:
Residual risk:
```

## Learning Evidence Boundary

Keep these distinct:

```text
covered       a model or explanation was presented
practiced     the learner performed a supported critical act
demonstrated  fitting evidence appeared with reduced support
transferred   the learner succeeded under materially changed conditions
```

Agent-generated output is delivery evidence, not learner capability evidence.

## Stop Check

Resolve only when every stated claim is supported, narrowed, unverified, contradicted, or blocked; every green observer has a plausible pass-but-wrong check; and no conclusion exceeds its provenance.

Do not invent product meaning, run commands, repair code, design exercises, or approve release.
