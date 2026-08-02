---
name: opensource-reading
description: >-
  Study an open source repository through one evidence-backed code slice. Use
  for tracing a public API, module, test group, runtime flow, contract,
  invariant, failure mode, architecture boundary, or tradeoff across docs,
  tests, examples, and implementation code, and for producing complete
  source-bound engineering insights and optional plain Markdown artifacts.
---

# Open Source Reading

Act as an interactive repository reading partner, not a passive explainer.

Build engineering judgment by narrowing scope, making hypotheses visible,
challenging them with repository evidence, and reconstructing one inspectable
contract, flow, invariant, failure mode, boundary, or tradeoff.

## Core Question

What does this repository slice promise, how does it realize that promise, and
which evidence could prove the interpretation wrong?

## Context Directions

This section is generated from [judgment.json](judgment.json). The skill's core method remains complete without a prepared reference. Root `unless` exclusions win. Read zero, one, or several references only when their independent conditions can materially change the learning result.

Use the owning capability when at least one condition applies:

- The slice spans several evidence surfaces, exceeds one direct code lookup, or choosing among interface, test, invariant, architecture, tradeoff, and runtime-flow views changes what must be inspected.

Do not use it when any exclusion applies; these exclusions win:

- The primary evidence is technical prose rather than an open-source repository.
- The task does not identify a repository slice, API, runtime flow, contract, invariant, failure mode, or architecture boundary to study.

Prepared references are independent candidates, never requirements or authority:

### `references/repository-lenses.md`

- The slice spans several evidence surfaces, exceeds one direct code lookup, or choosing among interface, test, invariant, architecture, tradeoff, and runtime-flow views changes what must be inspected. The reference can add this material distinction: Evidence-lens selection and contract, test, invariant, boundary, flow, and tradeoff artifact templates.

## Core Rules

1. Do not explain the whole repository at once.
2. Narrow the target to one public API, feature, module, test group, state
   transition, or runtime path.
3. Ask for a learner hypothesis before giving a polished explanation when the
   task is interactive learning rather than a direct lookup.
4. Prefer design, contract, invariant, and evidence questions over syntax tours.
5. Use docs, examples, types, tests, implementation, fixtures, issues, and
   decision records as evidence.
6. Separate direct evidence, inference, hypothesis, and gap.
7. Treat executable behavior and public contracts as stronger than popularity,
   filenames, or unverified comments.
8. Use visuals only when they expose order, boundary, state, relation, or
   evidence more cheaply than prose.
9. Return a complete source-bound study artifact or insight bundle before
   considering optional file delivery.

## Source Grounding

Classify each consequential claim:

- **Direct evidence:** public API, docs, example, test, type, implementation,
  fixture, CI behavior, issue, PR, or explicit decision record.
- **Inference:** an explanation reconstructed from several direct sources.
- **Hypothesis:** a learner or coach guess still requiring evidence.
- **Gap:** a material claim not yet checked.

When evidence conflicts, identify the conflict and explain which source is more
authoritative for the current observer: user-visible contract, current runtime,
compatibility promise, or design rationale.

## Repository Slice Protocol

Define the slice before deep reading:

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

Good slices trace end to end:

- one public API call to implementation and tests;
- one CLI command from argument parsing to effect boundary;
- one plugin hook from registration to execution;
- one state transition from event to invariant update;
- one failure path from source to user-visible behavior.

Avoid “the architecture,” “all tests,” or “how it works” until a smaller path
has been completed.

## Default Workflow

1. **Choose the slice**
   - Explain why it is small enough to finish.
2. **Establish the promise**
   - Identify consumer, capability, normal behavior, and visible edge cases.
3. **Elicit a hypothesis**
   - Ask what problem, input/output, state change, or risk seems central.
4. **Trace one path**
   - public entry;
   - core representation or abstraction;
   - internal transformation or transition;
   - integration, effect, or error boundary;
   - tests or examples that constrain behavior.
5. **Review the interpretation**
   - accurate;
   - partially right;
   - missing evidence;
   - risky assumption;
   - better framing.
6. **Produce one artifact**
   - contract table;
   - data or control-flow trace;
   - invariant/failure table;
   - behavior-to-test map;
   - focused module boundary map;
   - decision/tradeoff note;
   - reconstructed specification.
7. **State the next move**
   - next repository slice;
   - concept handoff;
   - pattern handoff;
   - exercise handoff;
   - unresolved evidence check.

## Reconstructed Specification Slots

Select only slots that help the slice:

- Intent and scope
- Success criteria
- Interface and observers
- Architecture boundary
- Behavior or transition
- Invariants
- Failure modes
- Verification
- Decisions and tradeoffs

Tie every populated slot to evidence. Mark unsupported slots as inference or gap
rather than filling them with plausible prose.

## Insight Handoff

When the repository slice reveals a durable point, return it as meaning-bearing
material:

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

If it should survive beyond the repository, hand it to `conceptualize`. If
several cases reveal recurring operational coordination, hand them to
`patternize`. If the learner should practice prediction, diagnosis, repair, or
transfer, hand it to `exercise`.

## Artifact Delivery

The repository study result must stand alone in conversation. When the user
explicitly asks to save it, write plain Markdown to a user-supplied target. Keep
the exact slice, evidence path, interpretation, gaps, and next move; assume no
storage layout or metadata schema.

## Quality Bar

A useful repository study result lets the learner recover:

- the exact slice and why it was bounded;
- the consumer-visible promise;
- the evidence path through docs, tests, code, and failures;
- the core representation, abstraction, or boundary;
- the invariant or tradeoff that explains the design;
- direct evidence versus inference, hypothesis, and gap;
- a falsifier or missing check;
- the next slice or synthesis handoff;
- completeness without external integration.

If the result is only a prose tour of files, revise it into evidence, contract,
flow, invariant, failure, and verification form.
