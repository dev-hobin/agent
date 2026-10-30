---
name: opensource-reading
description: "Studies an open source repository through one evidence-backed code slice. Use for tracing a public API, module, test group, runtime flow, contract, invariant, failure mode, architecture boundary, or tradeoff across docs, tests, examples, and implementation code, and for producing complete source-bound engineering insights and optional plain Markdown artifacts. Not for touring a whole repository at once, a quick API lookup, or studying prose documents without code."
argument-hint: "[repository path or URL, the slice to study, and where to save the result]"
---

# Open Source Reading

Study a repository through one slice small enough to finish: narrow the scope, state a
hypothesis, test it against repository evidence, and recover one checkable contract, flow,
invariant, failure mode, boundary, or tradeoff.

Repository, slice, and save path: $ARGUMENTS (if empty, take them from the request)

Read `${CLAUDE_PLUGIN_ROOT}/knowledge/opensource-reading/method.md` before every run: it is the
full method. The essentials are below.

## When this applies

- Use it when the slice spans several evidence surfaces, goes beyond one code lookup, or the
  chosen view (interface, tests, invariants, architecture, tradeoffs, runtime flow) changes
  what must be inspected.
- Do not use it when the main evidence is prose rather than a repository (use
  `technical-reading`), or when no slice, API, flow, contract, invariant, failure mode, or
  boundary has been chosen. These exclusions win.
- Not for touring the whole repository at once or a quick API lookup.

## Gotchas

- "Architecture", "all the tests", and "how does it work" are not covered before one small
  path is finished.
- A prose tour that walks files in order is not a result. Reshape it into evidence, contract,
  flow, invariant, failure, and verification.
- Executed behavior and public contract are stronger evidence than popularity, file names, or
  unverified comments.
- When evidence conflicts, say so and explain which side is more authoritative for the
  present observer: the user-visible contract, current execution, a compatibility promise, or
  the design rationale.
- In interactive learning, ask for the learner's prediction before the polished explanation.
  For an unfamiliar mechanism, show one path end to end first and ask for predictions only on
  a changed case. Do not ask on a direct lookup request.
- Do not modify repository files; the only thing you write is the requested artifact.

## Procedure

1. **Choose the slice**, and say why it is small enough to finish.
2. **Set the promise**: consumer, capability, normal behavior, visible edge cases.
3. **Draw out hypotheses**: what looks like the central problem, inputs and outputs, state
   changes, risks.
4. **Trace one path**: public entry point → core representation or abstraction → internal
   transformations and transitions → integration, effect, and error boundaries → the tests or
   examples that pin the behavior.
5. **Review the interpretation**: exact, partly right, insufficient evidence, risky
   assumption, or a better frame.
6. **Produce one artifact** that fits the slice (below).
7. **Name the next move**: next slice, a handoff, or an unresolved evidence check.

## Output

Default: a complete repository study in the conversation. Define the slice first:

```text
Project:
Learning objective:
Slice:
User-facing or caller-facing promise:
Entry evidence:
Likely source files:
Likely tests:
Out of scope:
```

Then one artifact: a contract table, data or control flow trace, invariant and failure table,
behavior-to-test map, module boundary diagram, decision and tradeoff note, or recovered spec.
A recovered spec's fields (intent and scope, success criteria, interfaces and observers,
boundaries, behavior or transitions, invariants, failure modes, verification, decisions and
tradeoffs) are filled only where evidence exists; mark the rest as inference or gap.

Insight handoff:

```text
Repository scope:
Promise or invariant:
Insight:
Evidence path:
Counterexample or failure:
Transfer possibility:
Evidence level:
Open question:
```

If saving was requested, write plain Markdown to the path the user gave, holding the exact
slice, evidence paths, interpretation, gaps, and next move; assume no archive structure or
metadata schema. Use a diagram only when it shows order, boundary, state, relation, or
evidence more cheaply than prose.

## Every result must

- Name exactly one slice and what lies outside it.
- State the caller-visible promise and support it with an evidence path of real file paths
  across docs, tests, and implementation.
- Distinguish direct evidence, inference, hypothesis, and gap for each important claim.
- State an invariant or tradeoff that explains the design, and the evidence or missing check
  that would prove the interpretation wrong.
- Name the next slice or handoff.
- Leave repository files unchanged.

## Reference files

Each is an independent candidate, not a requirement.

- `${CLAUDE_PLUGIN_ROOT}/knowledge/opensource-reading/method.md` — always: the full method
  (core rules, evidence classes, slice protocol, default flow, recovered-spec fields, insight
  handoff, delivery, quality bar).
- `${CLAUDE_PLUGIN_ROOT}/knowledge/opensource-reading/repository-lenses.md` — when the slice
  spans several evidence surfaces, exceeds one direct code lookup, or choosing among
  interface, test, invariant, architecture, tradeoff, and runtime-flow views changes what
  must be inspected.
