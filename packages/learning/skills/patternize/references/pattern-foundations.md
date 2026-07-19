# Pattern Foundations

Load this reference when the user asks why `patternize` exists, when revising
the pattern schema, or when deciding whether an artifact belongs in `concepts/`,
`patterns/`, `diagnostics/`, or `exercises/`.

## Contents

- Research traditions behind the operational pattern model
- Archive routing among concepts, patterns, diagnostics, and exercises
- Shared graph conventions
- Pattern schema rationale

## Research Thread

This skill adapts several traditions into a practical learning-archive workflow.
Do not teach these traditions by name unless the user asks. Use them to shape
the output.

### Pattern Languages

Source basis:

- Christopher Alexander, Sara Ishikawa, Murray Silverstein et al.,
  *A Pattern Language: Towns, Buildings, Construction* (1977).
- Overview: https://en.wikipedia.org/wiki/Pattern_language
- Book overview: https://en.wikipedia.org/wiki/A_Pattern_Language

Operational takeaways:

- A pattern is not a topic bucket. It describes a recurring problem in a
  context and a reusable core solution.
- A pattern should include context, problem, forces, solution, rationale,
  consequences, and links to other patterns.
- A pattern language is a network. Links among patterns are part of the method,
  not a decorative index.
- Patterns should be abstract enough to reuse, but concrete enough to guide
  action.

Translation for Learning:

- `concepts/` stores reusable ideas and relations.
- `patterns/` stores reusable ways to coordinate concepts into action.
- A saved pattern should expose the context, forces, workflow, checks, and
  related concept links.

### Software Patterns

Source basis:

- Kent Beck and Ward Cunningham, "Using Pattern Languages for Object-Oriented
  Programs" (OOPSLA 1987).
- Erich Gamma, Richard Helm, Ralph Johnson, John Vlissides, *Design Patterns:
  Elements of Reusable Object-Oriented Software* (1994).
- Overview: https://en.wikipedia.org/wiki/Software_design_pattern
- Portland Pattern Repository overview:
  https://en.wikipedia.org/wiki/Portland_Pattern_Repository

Operational takeaways:

- Software patterns adapted the pattern language idea from architecture into
  programming practice.
- A software pattern is not code to copy. It is a named reusable solution shape
  with context and tradeoffs.
- Pattern names give teams a compact shared vocabulary for recurring design
  judgments.

Translation for Learning:

- `patternize` should name a recurring development judgment, not just preserve
  a reading insight.
- A pattern artifact should explain when the pattern applies and what tradeoffs
  it accepts.
- A pattern should be executable as a workflow, decision path, or diagnostic
  routine.

### Creative Thinking Tools

Source basis:

- Robert Root-Bernstein and Michele Root-Bernstein, *Sparks of Genius: The
  Thirteen Thinking Tools of the World's Most Creative People*.
- Open Library work record:
  https://openlibrary.org/works/OL15692313W/Sparks_of_Genius
- Internet Archive metadata:
  https://archive.org/details/sparksofgeniusth0000root

Verified metadata:

- The Open Library and Internet Archive records identify the English source as
  *Sparks of Genius* with the subtitle "The Thirteen Thinking Tools of the
  World's Most Creative People".
- Internet Archive metadata lists Robert Scott Root-Bernstein as creator,
  Michele Root-Bernstein as associated name, the 1999 Houghton Mifflin edition,
  and subject "Creative thinking".

Operational takeaways:

- Treat creative work as transformation across representational forms: observing,
  recognizing patterns, forming patterns, abstracting, modeling, transforming,
  and synthesizing.
- A useful pattern artifact should not be only verbal. It should include visual
  and structural representations that make the pattern runnable.
- Pattern creation is a constructive act: detect repeated structure, strip
  accidental detail, model the relation, transform it into a usable form, and
  synthesize a workflow.

Translation for Learning:

- Start by observing repeated cases or felt tensions.
- Find the vertical axis that makes the cases belong together.
- Model the relation visually.
- Transform the model into a workflow, decision routine, or diagnostic.
- Synthesize a saved artifact that can guide future action.

### Problem-Solving Heuristics

Source basis:

- George Polya, *How to Solve It* (1945).
- Overview: https://en.wikipedia.org/wiki/How_to_Solve_It

Operational takeaways:

- Problem solving benefits from a loop: understand the problem, devise a plan,
  carry out the plan, and look back.
- Useful heuristics include drawing a figure, solving a related problem,
  working backward, looking for patterns, and using analogy.

Translation for Learning:

- A pattern should include checks and feedback, not only a forward sequence.
- The artifact should make the user look back: what worked, what failed, what
  changed, and where else the pattern transfers.

### Concept Maps And Visual Knowledge

Source basis:

- Joseph D. Novak and Alberto J. Canas, concept mapping work.
- Overview: https://en.wikipedia.org/wiki/Concept_map
- Related visualization result: Jill H. Larkin and Herbert A. Simon, "Why a
  Diagram is (Sometimes) Worth Ten Thousand Words" (1987), Cognitive Science.

Operational takeaways:

- Concept maps represent concepts as nodes and labeled relations as edges.
- Concept maps help expose relationships, gaps, and knowledge organization.
- Diagrams can support problem solving when they make relevant relations easier
  to inspect than prose alone.

Translation for Learning:

- Every substantial pattern should include a concept-role map.
- The second visual should match the pattern's use: workflow, decision flow,
  feedback loop, state diagram, or matrix.
- Visuals should reveal order, dependency, tension, or feedback.

## Archive Routing

Use this routing when a candidate artifact feels ambiguous:

```text
concepts/
  one reusable idea, distinction, operation, or graph edge.

patterns/
  multiple concepts coordinated by one axis into a workflow, decision path,
  diagnostic routine, or composition pattern.

diagnostics/
  warning signs, review questions, smell lists, rubrics, and confidence checks
  that do not prescribe a full workflow.

exercises/
  practice material for internalizing a concept or pattern.

books/ or open-source/
  source-bound learning records.
```

## Shared Graph Rule

Use [the graph artifact standard](../../../references/graph-artifact-standard.md)
as the source of truth for
shared graph frontmatter, id namespaces, typed relations, status values, and
concept-pattern links.

The design principle is simple: `concepts/` and `patterns/` should not become
separate knowledge systems. Patterns are graph nodes that coordinate concept
nodes.

## Pattern Schema Rationale

A pattern artifact needs these slots:

- Intent: why this pattern exists.
- Context: when to apply it.
- Axis: what vertical criterion ties the concepts together.
- Concepts: which concept nodes participate.
- Forces: what tensions or constraints must be balanced.
- Moves: the repeatable sequence or decision path.
- Checks: how to avoid wishful thinking and false confidence.
- Consequences: what the pattern enables and what costs it accepts.
- Visuals: concept-role map plus execution visual.
- Examples: source case, transfer case, boundary case.
- Provenance: where the pattern came from.

This is a workflow-shaped artifact, not a summary.
