# Abstraction Review Failure Localization

Use this reference when a concrete abstraction candidate has failed an
observable review stop. Its job is to locate the broken promise and the smallest
missing artifact. It does not require another document to establish its local
contract, and it does not repair the design.

## Accepted Input And Result

Supply the candidate surface, caller contract, promise under review, failed stop,
exact observation, and available evidence. If any of those is absent, the failure
cannot be localized from the supplied facts.

This member contributes failure localization and revision ownership. It assumes
only that the candidate and failed observation are concrete; it does not assume
a prior field-card vocabulary or decision. Its output is the failure log,
revision class, missing artifact, and evidence needed to rerun the same stop.

## Diagnostic Loop

```text
failed stop
-> exact observation
-> candidate promise contradicted
-> broken layer or missing owner
-> smallest revision class
-> bounded missing artifact
-> re-run the same stop after later work
```

A better name is not a repair unless the failed promise was stable sense.

## Failure Log

```text
Candidate:
Failed stop:
Observation:
Promise contradicted:
Likely broken layer:
Revision class:
Missing artifact:
Evidence needed before re-review:
```

## Localization Matrix

| Failure observation | Candidate defect | Review decision | Missing artifact |
| --- | --- | --- | --- |
| caller still reads fields, indexes, tags, or provider shape | barrier is below the caller need or only renames layout | `revise-surface` | representation-boundary design |
| representative change still touches several unrelated owners | responsibility is incoherent | `split` or `reject` | responsibility and collaboration design |
| shared role requires stronger preconditions or different effects for one implementation | substitution promise is false | `split` or `revise-model` | replacement-contract meaning |
| similar cases share syntax but not reason to change | candidate came from incidental similarity | `reject` | further structural comparison, if useful |
| closed operation returns a different value world or hides effects | closure promise is false | `revise-surface` | closure and finalizer design |
| new variant still edits old packages | extension axis or ownership is wrong | `revise-surface` | variant-operation design |
| registration accepts overlap without visible precedence | openness moved policy into load order | `revise-model` or `split` | precedence meaning and dispatch design |
| conversion path loses precision, identity, order, or capability silently | preserved meaning is too broad | `revise-model` | preserved-meaning relation |
| result is right but stack, wait, order, resource, or failure behavior changes | contract omitted a process observer | `revise-surface` | process-surface design |
| same call changes after history but candidate has no history owner | state promise is incomplete | `revise-model` | temporal meaning and state design |
| public interface has one participant and one purpose with no independent cycle | boundary lacks durable pressure | `defer` or `reject` | none until participant pressure appears |
| verifier executes but cannot fail the promise | stop is irrelevant | `defer` | claim-relevant evidence |
| only the proposed name changes while contract stays unclear | sense is downstream of missing design | `defer` | stable ownership before naming |

## Collision Rules

When several failures appear, localize the earliest broken promise:

1. disputed meaning before surface;
2. missing caller surface before candidate review;
3. responsibility or boundary before naming;
4. semantic contract before process optimization;
5. process/history observer before timing;
6. relevant evidence before approval.

Do not combine all repairs into one redesign. The same failed stop should be
re-run after the focused method produces a new candidate.

## Exit Check

Leave with exactly one of:

```text
re-review now:
  existing evidence already supports a revised decision

incomplete localization:
  a required artifact is absent from the supplied evidence

defer:
  accessible evidence is insufficient but no current blocker exists

reject:
  the candidate promise is contradicted and no smaller truthful surface remains
```

## Source Trace

This diagnostic table is self-contained synthesis defined in this guide. Its
promise boundaries are calibrated by the exact sources listed in Abstraction
Candidate Review; it introduces no additional
source claim or construction method.
