# Choosing a Learning Skill

English | [한국어](./ko/choosing-a-skill.md)

Choose a Skill by the result you need, not only by the input format. The same
repository may call for implementation learning, concept formation, or practice.

## Quick choice

| Needed now | Skill | Completed result |
| --- | --- | --- |
| Understand what a source actually says | `technical-reading` | Explanation that preserves source order, examples, and exceptions |
| Learn how one feature works in a public repository | `opensource-reading` | Evidence-backed explanation with docs, tests, and code locations |
| Isolate one durable idea from several learning results | `conceptualize` | Concept tested with boundaries and counterexamples |
| Capture a recurring decision sequence across cases | `patternize` | Routine with context, steps, checks, and stop conditions |
| Test whether the learner can use the idea | `exercise` | Prediction, diagnosis, repair, transfer tasks, and mastery criteria |

## Technical reading or conceptualize?

Use `technical-reading` when the source itself remains the object of study:

```text
Explain what this chapter means without dropping its examples.
```

The result remains accountable to source order, wording, and exceptions.

Use `conceptualize` when the goal is an idea that must survive beyond the source:

```text
Name the information-preserving boundary shared by these three chapters and
test it on cases unrelated to the books.
```

Source history remains evidence, but the concept definition should not depend on
the books' wording.

## Open-source reading or ordinary code exploration?

Ordinary exploration is enough when the goal is to locate a file or implement a
fix.

Use `opensource-reading` when the result itself should be learning:

```text
Trace this repository's retry API through documentation, public entry points,
tests, and implementation. Identify one guarantee and one falsifier.
```

The result needs exact file and symbol evidence. It must not turn a small sample
into a speculative whole-repository architecture story.

## Concept or pattern?

A concept is one durable distinction or mental model. A pattern is a sequence of
moves that recurs under similar forces.

“Bind a judgment to exact source content” may be a concept. If several workflows
repeatedly use this sequence, it may become a pattern:

```text
discover candidates -> decide admission -> acquire exact content -> commit once
```

Related concepts do not form a pattern without real recurrence and a reason for
the ordering.

## Explanation or exercise?

Read or form the concept first when the learner still lacks the model.
Explanation can support understanding but is not evidence of mastery.

Use `exercise` when observable performance is needed:

- predict behavior before seeing the result;
- distinguish nearby misconceptions;
- complete a faded worked example;
- repair an incorrect solution; or
- transfer the idea to another domain.

Writing another summary is not practice.

## Handoffs are optional

Another Skill may become useful when a new question appears:

- reusable meaning emerges from reading -> `conceptualize`;
- the same coordination recurs across cases -> `patternize`;
- understanding needs performance evidence -> `exercise`.

The current Skill still completes its own result first. No handoff happens merely
because a package-level sequence says it should.

## When not to use Learning

- Pi needs to change a repository rather than learn from it.
- You need an automatic persistent notebook.
- You want a short summary without source or mastery requirements.
- No source, concept, recurrence, or performance target is precise enough yet.
