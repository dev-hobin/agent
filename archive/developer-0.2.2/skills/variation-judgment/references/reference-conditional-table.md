# Reference, Conditional, And Table

Use this reference when a concrete variation can be represented by passing a
choice, deciding among closed cases, or looking up an externally keyed case. It
makes ownership and failure explicit without assuming that more indirection is
better.

## Accepted Judgment Context

Supply accepted cases, caller purpose, who provides and who decides the choice,
case overlap and precedence, key ownership, unsupported behavior, and one
credible change. Public operations and product cases must already be known.

## Three Different Jobs

```text
reference:
  conveys a chosen value or behavior across a boundary

conditional:
  owns a finite or ordered decision among cases

table:
  maps an explicit key to a case under registration and conflict rules
```

A caller-supplied reference opens selection while leaving construction or policy
elsewhere. A conditional keeps cases and precedence under one code owner. A table
moves case association into data; it does not remove duplicate, overlap,
precedence, visibility, or missing-key decisions.

## Decision Table

| Pressure | Reference | Conditional | Table |
| --- | --- | --- | --- |
| one caller chooses among already accepted behaviors | strong fit | duplicates caller choice | unnecessary key boundary |
| few closed policy cases with meaningful order | can hide policy owner | strong fit | may obscure precedence |
| externally named additive cases | requires another selector | central edits remain | fit only with explicit key/conflict ownership |
| overlapping predicates | conveys one selected predicate | can own order visibly | key lookup cannot express overlap without extra policy |
| missing case must be exhaustive failure | depends on provider | local exhaustiveness possible | missing-key failure required |

## Worked Case: Report Encoding

Accepted formats are `text` and `structured`. A command-line caller chooses the
format before invoking the report generator. No third party registers formats.

### Reference alternative

```text
renderReport(data, render)
```

The caller chooses one accepted renderer and the generator does not know a key.
This is adequate when the variation role is stable and trusted callers already
own selection.

### Conditional alternative

```text
renderReport(data, format):
    if format is text: renderText(data)
    else if format is structured: renderStructured(data)
    else: unsupported(format)
```

This is adequate when untrusted input supplies the format and one local owner
must validate and exhaust the closed set.

### Table alternative

```text
register(textKey, renderText)
register(structuredKey, renderStructured)
renderByKey(textKey, data)
```

The table adds key identity, duplicate registration, load timing, missing-key,
and inspection obligations without observed independent registration pressure.

Judgment:

```text
trusted caller already selects behavior -> reference
untrusted external key under closed policy -> conditional
independent modules must add named cases -> table, after conflict policy exists
```

The same referents can support different mechanisms because the choice owner and
boundary differ.

## Counterexample: Ordered Fraud Rules In A Map

Moving overlapping fraud predicates from an ordered conditional into a map does
not make the policy open. If several rules match, some owner still chooses first,
last, highest priority, all, or error. A table is unsound until that precedence is
part of the contract.

## Artifact

```text
Accepted cases:
Choice provider:
Decision owner:
Overlap and precedence:
Key owner, if any:
Unsupported behavior:
Credible change:
Reference / conditional / table comparison:
Decision and falsifier:
```

## Stop And Separation

Stop when one mechanism owns the actual choice with explicit unsupported and
conflict behavior, and a weaker mechanism has been ruled out by evidence rather
than taste. When case meaning or precedence is undecided, no mechanism conclusion
follows.

This document does not invent cases, operations, or caller workflow.

## Source Trace

- Zachary Tellman, *Elements of Clojure*, Leanpub 2019-02-11:
  Indirection, public-manuscript pp. 64-69, for references as conveyed choices,
  conditionals as decisions, table conflicts, and qualified openness costs. Broad
  claims about unordered openness and runtime efficiency are treated as design
  pressures rather than portable laws.
