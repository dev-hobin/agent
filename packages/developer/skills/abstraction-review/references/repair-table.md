# Abstraction Review Repair Table

Use this table when a wished abstraction failed, or when the observed symptom is
clearer than the broken layer.

## Diagnostic Loop

```text
observed mismatch
  -> evidence
  -> broken layer hypothesis
  -> recipe card
  -> repair output
  -> re-run same symptom
```

Do not jump from mismatch to a better name. Names can be repair outputs, but the
repair must change a layer, contract, or artifact.

## Repair Log

```text
Observed symptom:
Evidence:
Broken layer hypothesis:
Selected recipe:
Repair output:
Re-run result:
Open consequence:
```

If the repair output is empty, the review only explained the problem.

## Repair Matrix

| Symptom | Suspect layer | First repair | Output to create | Stop check |
| --- | --- | --- | --- | --- |
| Helpers have nice names but the domain rule is invisible | Language | Restate desired vocabulary | primitive/combination/abstraction vocabulary | new case can be spoken without representation detail |
| Similar functions differ only by predicate, term, next step, or strategy | Language/Unit | Movement Pattern Extraction | common movement plus variation role table | old cases become simple calls |
| Similar-looking code has different responsibilities | Unit/Boundary | Reject or split the abstraction | responsibility split note | no shared unit is promoted |
| Caller reads object fields, list indexes, tags, or provider-specific shape | Boundary | Data Abstraction Boundary | constructor/selector/predicate/operation list | caller no longer touches representation primitive |
| Operation result cannot be fed into later operations | Unit | Closure Composition Unit | closed operation table | closed operations build larger units |
| Chainable API forces final side effects into the chain | Unit/Boundary | Split closed operations from finalizers | observer/finalizer boundary | closed operations and boundary effects are distinct |
| State variables have no meaning | Law | Invariant Iteration | invariant statement | initial/step/final checks pass |
| Loop is fast but correctness cannot be explained | Law/Run | Invariant + process trace | invariant and process trace | correctness follows from preserved meaning |
| Recursive version is clear but stack or deferred work grows | Run | Procedure -> Process, then Invariant | shape note and accumulator option | shape change is explicit |
| Constructor, validator, and normalizer are scattered | Boundary/Engine | Creation policy boundary | creation policy note | value enters the world through one gate |
| Constructor is too expensive | Engine/Run | Cost placement decision | create/read/update cost note | cost owner is explicit |
| New representation changes old code | Engine | Dispatch Registration | variant x operation table | new row/package is enough |
| New operation changes every variant | Engine | Re-evaluate row/column axis | axis decision | frequently growing axis is explicit |
| Mixed types explode into direct cases | Engine/Law | Meaning-Preserving Path | conversion graph | legal, loss, and unsupported paths are visible |
| Conversion loses precision, identity, order, or capability | Law | Narrow preserved meaning | loss note | loss appears in contract |
| Expression rewrite uses strings or indexes | Language/Boundary | Notation As Data | expression selectors/constructors | rules ignore raw layout |
| AST exists but transforms are representation-specific | Boundary | Data Abstraction Boundary | representation-independent rules | representation can change |
| Same call returns different results after prior interactions | Time | History Placement | state/history contract | history location is explicit |
| Caller keeps passing previous state everywhere | Time/Boundary | History Placement | local state decision | burden is intentionally hidden or kept explicit |
| Local state makes testing/reasoning hard | Time/Run | History Placement + process trace | hidden history note | loss of referential transparency is accepted |
| Undo, replay, audit, or collaboration needs past events | Time | History as stream/log | stream/log decision | history is manipulable data |
| Stream merge changes meaning | Time/Run | Event Order Protection | merge/order policy | forbidden interleaving is explainable |
| Concurrent read-compute-write breaks invariant | Time/Run | Event Order Protection | protected region | invariant-breaking interleaving is blocked |
| Lock/serializer blocks too much | Time/Engine | Narrow the order law | smaller protected relation | only meaningful order is protected |
| Generic abstraction is clean but slow | Run/Engine | Procedure -> Process | cost surface | dispatch/lookup/coercion cost is visible |
| Everything feels abstract and nothing is actionable | Run | Field Card + Recipe Cards | selected recipe card | trigger/input/output/stop are filled |

## Collision Rules

| Collision | Prefer first when evidence says... | Then check... |
| --- | --- | --- |
| Language vs Boundary | caller has no useful words except representation details | whether a boundary is still needed after vocabulary exists |
| Movement vs Duplication | cases share behavior roles, not just text | whether old cases become simpler and responsibility stays coherent |
| Unit vs Boundary | results leave the composable world | observer/finalizer separation |
| Law vs Run | result is right but why is unclear | invariant first, then process shape |
| Boundary vs Engine | caller knows internal details | boundary first, then registry/table placement |
| Engine vs Law | dispatch/conversion works but meaning loss hides | preserved meaning, then path graph |
| Time vs Boundary | same call changes with history | whether history is public contract or hidden state |
| Time vs Run | delayed execution or event order changes correctness | order law or process trace |
| Run vs Engine | abstraction is semantically right but costs too much | cost trace, then dispatch/coercion placement |

## Exit Checks

Before leaving the table, check:

```text
Symptom:
  Did the review name the actual mismatch?

Evidence:
  Was the mismatch observed in caller code, trace, test, cost, history, or order?

Layer:
  Is the layer a likely cause, not merely a consequence?

Recipe:
  Does the selected card require an output artifact?

Re-run:
  Did the same symptom disappear, remain, or become a new symptom?
```
