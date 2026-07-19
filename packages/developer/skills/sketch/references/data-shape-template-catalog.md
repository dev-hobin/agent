# Data-Shape Template Catalog

Use this catalog after the six-artifact recipe in
[Data-Driven Design](data-driven-design.md). Its core rule is:

```text
data clause          -> function branch
compound field       -> selector or destructured value
self-reference       -> natural recursive call at that exact position
reference to B       -> delegation to B's template at that exact position
```

The template inventories available ingredients. The purpose and examples decide
how to combine them.

## Atomic And Fixed-Size Data

For an atomic value, the template contains the parameter and relevant domain
constants. There is no structural decomposition to invent.

```text
Celsius = Number interpreted as a measured temperature

alertLevel : Celsius -> Level
alertLevel(celsius) = ... celsius ... FREEZE_POINT ... HEAT_LIMIT ...
```

Intervals add meaningful partitions only when behavior changes at their
boundaries:

```text
alertLevel(celsius):
  if celsius < 0        -> ...
  else if celsius < 35  -> ...
  else                  -> ...
```

Do not branch on arbitrary numeric ranges merely because a conditional is
possible. Each range needs a product interpretation and boundary examples.

## Itemizations And Enumerations

For a finite set of alternatives, create one branch and one behavior example per
meaningful clause. The complete fulfillment example in the parent reference is
the canonical shape.

Template:

```text
Result = Success(value) | Rejected(reason) | Retryable(delay)

render(result):
  match result:
    Success(value)      -> ... value ...
    Rejected(reason)    -> ... reason ...
    Retryable(delay)    -> ... delay ...
```

Merge two clauses only when their product meaning, not merely their current body,
is the same. A catch-all branch is suspicious when adding a variant should force
a new decision.

## Structures And Records

A record groups a fixed natural whole. List only fields relevant to the purpose;
the template is not permission to expose every stored field.

```text
Schedule = Schedule(start, end, timezone)

duration(schedule):
  ... schedule.start ... schedule.end ...
```

`timezone` remains absent because elapsed duration does not need it. If the
function unexpectedly needs recurrence policy, either the purpose is broader
than stated or the data definition lacks information.

## Self-Referential Data

A valid self-referential definition has at least one non-recursive clause from
which values can be constructed and at least one recursive clause that creates
larger values.

```text
Tasks = Empty | Node(Task, Tasks)
interpretation: a finite ordered task sequence
```

Construct examples from the base outward:

```text
Empty
Node(Task("review", 20), Empty)
Node(Task("write", 40), Node(Task("review", 20), Empty))
```

For `totalEstimate`, derive the template mechanically:

```text
totalEstimate(tasks):
  match tasks:
    Empty -> ...
    Node(first, rest) ->
      ... first ... totalEstimate(rest) ...
```

Why that recursive call? The `Node` clause contains one `Tasks` field named
`rest`; the template therefore contains one natural recursive call on `rest`.
The completed function follows from examples:

```text
totalEstimate(tasks):
  match tasks:
    Empty -> 0
    Node(first, rest) -> first.minutes + totalEstimate(rest)
```

Test at least two recursive layers. Recursing on `dropEveryOther(rest)` or a
newly partitioned list is not structurally derived; use the generative-recursion
recipe instead.

## Mutually Referential Data

When definitions refer to each other, derive a family of templates with a
delegation wherever the reference occurs.

```text
Document = Document(List<Section>)
Section  = Section(title, List<Block>, List<Section>)
Block    = Paragraph(text) | Image(src)
```

For a word-count sketch:

```text
countDocument(document):
  combine map(countSection, document.sections)

countSection(section):
  combine map(countBlock, section.blocks)
          map(countSection, section.children)

countBlock(block):
  match block:
    Paragraph(text) -> words(text)
    Image(src)      -> 0
```

The reference graph, not convenience, determines the delegations. An oversized
function with nested tags usually means the template family was collapsed.

## Two Complex Inputs

Do not automatically multiply every clause. Decide how the two values move.

### One input controls

`applyDiscounts(cart, rules)` traverses the cart while `rules` is constant or
queried. Derive the traversal from `Cart`; treat `Rules` as domain knowledge.

### Inputs move in lockstep

`sameShape(leftTree, rightTree)` compares corresponding nodes. State the shape
relation and branch on paired cases:

```text
(Leaf, Leaf)
(Node, Node) -> recurse on corresponding children
(Leaf, Node) or (Node, Leaf) -> false
```

### Inputs vary independently

Collision policy between `UserRole` and `ResourceState` may need the meaningful
cross-product or a decision table. Write all relevant combinations explicitly;
do not hide them in nested defaults.

The smell is not “two loops.” It is an unstated relationship between the input
shapes.

## Functions That Produce Complex Data

The output definition constrains constructors just as the input definition
constrains selectors.

```text
Notice = Info(text) | Warning(text) | Blocked(reason)

classify(order):
  ... -> Info(...)
  ... -> Warning(...)
  ... -> Blocked(...)
```

Work expected output values before choosing constructors. If several output
variants are valid, the unresolved choice is policy, not implementation freedom.

## Interactive Programs

Define the world state before handlers:

```text
World = Editing(draft) | Saving(draft, requestId) | Failed(draft, reason)

onEvent : World x Event -> World
view    : World -> UI
stop    : World -> Boolean
```

Then write event traces, not only snapshots:

```text
Editing("a") --Save--> Saving("a", 7)
Saving("a", 7) --Saved(7)--> Editing("a")
Saving("a", 7) --Saved(6)--> Saving("a", 7)   // stale response ignored
```

The handlers derive branches from both the world and event definitions. If
correctness depends on history beyond `World`, refine the state or hand the
temporal rule to `model`.

## Diagnosis

| Symptom | Likely repair |
| --- | --- |
| branch does not correspond to a data clause | remove it or repair the data definition |
| selector is used outside its clause | restore the clause guard or use a better representation |
| recursive call has no self-reference | classify as generative recursion or remove it |
| self-reference has no recursive call | explain why that portion is intentionally ignored |
| mutually referential logic is one giant conditional | derive one template per definition |
| two complex inputs create accidental nested loops | state controlling, lockstep, or independent relation |
| event handler cannot distinguish stale events | add identity/history to the world model |

## Source Trace

- [*How to Design Programs*, official living edition](https://htdp.org/2026-5-28/Book/index.html):
  the recipes for atomic data, intervals, itemizations, structures,
  self-referential and intertwined definitions, multiple complex inputs,
  complex outputs, and world programs. The examples here are adapted to ordinary
  product code and are not copied from the book.
