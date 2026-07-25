# Abstraction Review Failure Localization

Use this reference only after the candidate review's observable stop has failed.
Its job is to locate the broken promise and choose a handoff. It does not repair
the design inside `abstraction-review`.

## Diagnostic Loop

```text
failed stop
-> exact observation
-> candidate promise contradicted
-> broken layer or missing owner
-> smallest revision class
-> owning skill handoff
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
Owning handoff:
Evidence needed before re-review:
```

## Localization Matrix

| Failure observation | Candidate defect | Review decision | Handoff |
| --- | --- | --- | --- |
| caller still reads fields, indexes, tags, or provider shape | barrier is below the caller need or only renames layout | `revise-surface` | `sketch` representation boundary |
| representative change still touches several unrelated owners | responsibility is incoherent | `split` or `reject` | `sketch` responsibility/collaboration |
| shared role requires stronger preconditions or different effects for one implementation | substitution promise is false | `split` or `revise-model` | `model` replacement contract |
| similar cases share syntax but not reason to change | candidate came from incidental similarity | `reject` | `signal` if further comparison is useful |
| closed operation returns a different value world or hides effects | closure promise is false | `revise-surface` | `sketch` closure/finalizer boundary |
| new variant still edits old packages | extension axis or ownership is wrong | `revise-surface` | `sketch` generic operation system |
| registration accepts overlap without visible precedence | openness moved policy into load order | `revise-model` or `split` | `model` policy, then `sketch` dispatch |
| conversion path loses precision, identity, order, or capability silently | preserved meaning is too broad | `revise-model` | `model` relation/contract |
| result is right but stack, wait, order, resource, or failure behavior changes | contract omitted a process observer | `revise-surface` | `sketch` process shape |
| same call changes after history but candidate has no history owner | state promise is incomplete | `revise-model` | `model` temporal, then `sketch` state |
| public interface has one participant and one purpose with no independent cycle | boundary lacks durable pressure | `defer` or `reject` | none until participant pressure appears |
| verifier executes but cannot fail the promise | stop is irrelevant | `needs-evidence` | `verify` |
| only the proposed name changes while contract stays unclear | sense is downstream of missing design | `defer` | `sketch` or `naming-judgment` after ownership |

## Collision Rules

When several failures appear, localize the earliest broken promise:

1. disputed meaning before surface;
2. missing caller surface before candidate review;
3. responsibility or boundary before naming;
4. semantic contract before process optimization;
5. process/history observer before timing;
6. relevant evidence before approval.

Do not combine all repairs into one redesign. The same failed stop should be
re-run after the owning leaf produces a new candidate.

## Exit Check

Leave with exactly one of:

```text
re-review now:
  existing evidence already supports a revised decision

handoff:
  another leaf owns a missing artifact

defer:
  accessible evidence is insufficient but no current blocker exists

reject:
  the candidate promise is contradicted and no smaller truthful surface remains
```

## Source Trace

This diagnostic table is Developer synthesis. Its promise boundaries are
calibrated by the exact sources listed in
Abstraction Candidate Review; it introduces no additional
source claim or construction method.
