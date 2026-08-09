# Accrete, Reduce, And Reshape

Use this reference when a concrete transformation pipeline mixes information
addition, loss, and representation change. It supplies a step classifier,
observer trace, complete case, counterexample, artifact, and stop without another
reference.

## Accepted Judgment Context

Supply the input and output representations, ordered transformation steps,
downstream purpose, consequential input distinctions, required observers, and
one pair of inputs whose downstream treatment may differ.

## Three Operations

```text
accrete:
  add derived, contextual, linked, or classified information

reduce:
  discard distinctions and intentionally make several inputs equivalent

reshape:
  reorganize representation or access while intending to preserve domain meaning
```

A step may mix operations. Split it until each irreversible decision and each
representation change can be inspected independently.

## Step Ledger

| Step | Before | Operation | Added | Discarded | Reshaped | Observer after |
| --- | --- | --- | --- | --- | --- | --- |

Check only observers relevant to the accepted purpose, but do not silently omit:

```text
identity
order
multiplicity
precision
provenance
error and absence distinctions
ability to replay or explain
cost or access pattern when promised
```

A reshape may preserve domain meaning while changing operational abilities. A
map may lose duplicate keys; a set loses order and multiplicity; an index gains
lookup ability while adding consistency obligations.

## Worked Case: Usage Billing Pipeline

Input events contain:

```text
event identity, account, timestamp, unit quantity, source, correction link
```

Pipeline:

1. attach the account's billing period;
2. group events by account and period;
3. sum unit quantity;
4. produce invoice-line records keyed by account and period.

Ledger:

| Step | Operation | Added | Discarded | Reshaped |
| --- | --- | --- | --- | --- |
| attach period | accrete | billing period derived from timestamp and policy | none | none |
| group | reshape | group membership | none yet | sequence to keyed groups |
| sum | reduce | aggregate quantity | event identity, order, individual quantity, correction link unless retained | group to scalar |
| invoice lines | reshape | invoice identity and presentation fields | none beyond prior reduction | keyed groups to records |

Equivalent-after witness:

```text
[e1: 2 units, e2: 3 units]
[e3: 5 units]
```

Both become `5 units` after summation, but they are not equivalent for audit,
correction, or source attribution.

Decision:

```text
accept reduction for pricing total
retain source event identities and correction relation beside each aggregate
make grouping and summation separate visible steps
```

The result is neither “never aggregate” nor “store everything forever.” It names
the purpose that owns equivalence and the evidence required for accepted recovery.

## Counterexample: Hidden Reshape With Duplicate Loss

Converting a sequence of `(key, value)` entries directly to a keyed map is called
a reshape, but duplicate keys are overwritten. The step is also a reduction.
It must state first/last/error/all policy and provide two duplicate-bearing inputs
that expose the loss.

## Artifact

```text
Purpose and consequential input distinctions:
Ordered step ledger:
Accreted information and derivation:
Reduced information and equivalence witnesses:
Reshaped representation and changed abilities:
Required downstream observers:
First irreversible point:
Provenance or recovery boundary:
Decision:
```

## Stop And Separation

Stop when every step is classified, every reduction has an equivalence witness,
every reshape names changed abilities, and the downstream purpose owns all
accepted loss. Matching output values alone is not a stop when provenance,
identity, multiplicity, or explanation matters.

This document does not invent the downstream purpose, prescribe storage, or
design the transformation API.

## Source Trace

- Zachary Tellman, *Elements of Clojure*, Leanpub 2019-02-11:
  Composition, public-manuscript pp. 104-112, for transform phases that accrete,
  reduce, or reshape data and for delaying operational interpretation. The
  categories are used as an inspection vocabulary rather than a required
  pipeline syntax.
- Matthias Felleisen, Robert Bruce Findler, Matthew Flatt, and Shriram
  Krishnamurthi, *How to Design Programs*, living build 9.2.0.3:
  Intermezzo 1 and Chapters 19-20, for explicit data interpretation, simplest
  sufficient representation, prediction, and model refinement.
