---
name: patternize
description: "Turns several cases, notes, postmortems, or repeated judgments into a reusable working pattern: a workflow, decision path or flow, diagnostic procedure, checklist, or operational routine, tested for transfer and failure. Use whenever the user wants a repeatable procedure or decision flow drawn from more than one example, even if they never say 'pattern' and even before the examples are shared. Produces a complete pattern result and, when requested, a self-contained plain Markdown artifact. Not for defining a single concept, studying one source, practice drills, or code-level design patterns and pattern matching."
argument-hint: "[the cases, notes, or judgments to compare, and where to save the result]"
allowed-tools:
  - "Bash(node ${CLAUDE_PLUGIN_ROOT}/scripts/output-contract.mjs *)"
---

# Patternize

Find the one recurring coordination axis across several materials, cases, concepts,
diagnostics, or repeated judgments, and write down, in a form someone can execute, the
context it applies in, the forces in tension, the moves, the checks, the outcome, and where it
fails.

Cases to compare and save path: $ARGUMENTS (if empty, take them from the request)

Read `${CLAUDE_PLUGIN_ROOT}/knowledge/patternize/method.md` before every run: it is the full
method. The essentials are below.

## When this applies

- Use it when two or more independent cases, concepts, diagnostics, or judgments seem to share
  a practical problem or a successful move and must be told apart from a topic cluster; or
  when the pattern holds several semantic roles, branches, iterative feedback, state
  transitions, or a comparison matrix that is much harder to execute from prose alone.
- Do not use it to define or refine one atomic concept (use `conceptualize`), or when no
  recurring axis coordinates several concepts, connections, diagnostics, or judgments into a
  working procedure. These exclusions win.
- Not for studying one source, practice design, or broad topic notes.
- "No pattern yet" is a normal result. Do not invent a workflow from a topic cluster.

## Gotchas

- Sharing vocabulary or a folder is not recurrence. It is a pattern only when one coordination
  mechanism explains the cases.
- If the axis is a folder name or a broad topic, discard it.
- Do not duplicate concept explanations inside the pattern; reference the concept.
- Do not add a diagram that only repeats the text.
- The thinking-tool list (observe → compare → recognize → abstract → model → transform →
  synthesize) is a menu of operations you may use, not a pipeline to show the user.
- One case yields only a pattern hypothesis, not a pattern claim.
- Do not modify the input materials; write only the requested artifact.

## Procedure

1. **Gather cases**, keeping source, conditions, observed result, and uncertainty. Include
   failures and counterexamples.
2. **Pattern gate.** Build the table `Case | Context | Problem | Forces | Successful move |
   Check | Failure if omitted`. If only a shared topic shows, answer "no pattern yet".
3. **Name the recurring axis.**
4. **Context and signals:** when it is useful, premises and observable triggers, what is out of
   scope.
5. **Extract forces:** tensions, constraints, tradeoffs, the cost of overuse and of non-use.
6. **Semantic roles:** input, transformation, control or constraint, check, output and feedback.
7. **Order the moves.** Each move has an input, an action, an output, and a local check.
   Branches become a decision path; where later evidence changes an earlier judgment, a
   feedback loop.
8. **Diagram only when it lowers the cost of judging** (see the visualization reference).
9. **Test:** a source case, a transfer case outside the sources, a boundary case where it must
   not be used, a failure case with one move skipped, and evidence that would refute the
   recurrence.
10. **Return the result** with evidence strength and gaps; save it in the shape below if
    requested.

## Output

Default: a complete pattern result in the conversation.

```text
Pattern candidate:
Evidence level:
Recurring context and signals:
Axis:
Cases compared:
Forces:
Roles:
Moves / decision path:
Checks and feedback:
Visual, if useful:
Transfer case:
Boundary and failure case:
Falsifier / evidence gap:
Handoff:
```

If saving was requested, write a plain Markdown pattern artifact to the path the user gave and
no other file, holding context, cases, axis, forces, roles, moves, checks, transfer, boundary,
and evidence gaps; assume no archive structure or metadata schema. If the path is unknown, ask
only for the path.

## Output contract (saved results)

The required parts of a saved result are data in `assets/output-contract.json`. Start the
file from its skeleton, fill every part, and finish only when the check passes:

```text
node ${CLAUDE_PLUGIN_ROOT}/scripts/output-contract.mjs new ${CLAUDE_SKILL_DIR}/assets/output-contract.json <file>
node ${CLAUDE_PLUGIN_ROOT}/scripts/output-contract.mjs check ${CLAUDE_SKILL_DIR}/assets/output-contract.json <file>
```

Keep the skeleton's marker line and headings. If a part has nothing to report, keep it and
write "none" with the reason. A plugin hook also runs the same check on every write of a
result started from the skeleton and reports what to fix.

## Every result must

- (When saved) pass the output contract check.
- (When saved) be readable Markdown at the user's path, with no other file written.
- Carry a case comparison table, context and signals, axis, forces, roles, ordered moves,
  checks, a transfer case, a boundary or failure case, and a falsifier or evidence gap.
- When recurrence is only a shared topic, return "no pattern yet" and the missing evidence
  instead of a workflow.
- Leave the input materials unchanged.
- Preferably, include a diagram only when it shows relation, order, state, or feedback more
  cheaply than prose.

## Reference files

Each is an independent candidate, not a requirement.

- `${CLAUDE_PLUGIN_ROOT}/knowledge/patternize/method.md` — always: the full method (input and
  evidence gates, distinctions, pattern gate, default flow, thinking tools, output, quality
  bar, completion).
- `${CLAUDE_PLUGIN_ROOT}/knowledge/patternize/recurrence-and-forces.md` — when at least two
  independent cases, concepts, diagnostics, or judgments appear to share a practical problem
  or successful movement and must be distinguished from a topic cluster.
- `${CLAUDE_PLUGIN_ROOT}/knowledge/patternize/pattern-visualization.md` — when the pattern
  contains several semantic roles, branches, iterative feedback, state transitions, or a
  comparison matrix that is materially harder to execute from prose alone.
