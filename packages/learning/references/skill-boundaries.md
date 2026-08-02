# Learning Skill Boundaries

This is the shared source of truth for deciding which Learning skill owns a
thinking task and when to hand work to another Learning skill.

Every skill is independently invokable and must produce a complete useful
result from its declared inputs.

## Skill Ownership

```text
technical-reading
  Faithful study of prose sources and source-bound insight synthesis.

opensource-reading
  Evidence-backed study of one repository slice and source-bound engineering
  insight synthesis.

conceptualize
  Cross-source formation and testing of one transferable concept.

patternize
  Discovery and testing of recurring operational coordination across several
  cases, concepts, or judgments.

exercise
  Deliberate practice and observable mastery evidence.
```

## Boundary Tests

- If the result explains what one prose source teaches, use
  `technical-reading`.
- If the result reconstructs one repository's contract, invariant, flow, or
  tradeoff, use `opensource-reading`.
- If several source-bound insights should become one source-independent
  operation or distinction, use `conceptualize`.
- If several cases or concepts should become a repeatable workflow, decision
  path, diagnostic path, or composition routine, use `patternize`.
- If the user must predict, explain, repair, discriminate, or transfer, use
  `exercise`.

## Handoff Rules

Make handoffs explicit. Do not silently perform another skill's job.

- `technical-reading -> conceptualize`: insights from one or more sources may
  support a transferable concept.
- `opensource-reading -> conceptualize`: a repository lesson may survive beyond
  the project.
- `conceptualize -> patternize`: several concepts participate in one recurring
  operational coordination.
- `patternize -> conceptualize`: a pattern exposes a missing semantic concept.
- Any learning skill `-> exercise`: the user wants practice or mastery evidence.
- `exercise -> conceptualize/patternize`: practice exposes a wrong concept
  boundary or a recurring coordination.

A handoff changes the learning question; it is not required for capture,
storage, or package interoperability.

## Independent Artifact Delivery

Each skill owns the semantic completeness of its result. By default, return that
result in conversation or as copyable Markdown.

When the user explicitly asks to save it:

1. use a path or target the user already supplied;
2. otherwise ask only for the missing target;
3. write the current skill's complete result as plain Markdown unless the user
   requested another known format;
4. do not assume a storage layout, metadata schema, or Git workflow;
5. do not turn persistence mechanics into the skill's core method.

This rule keeps the package self-contained: Learning produces and delivers its
own artifacts without defining an integration contract outside its boundary.

## Standalone Rule

- Keep the core procedure and output shape in each `SKILL.md`.
- Read a prepared reference only when its independent `when` statement matches and its material distinction can change the result; keep missing context and limitations visible.
- Ask only for missing source or learner information that can materially change
  the result.
- A handoff may be recommended, but another skill is not required for the
  current skill to finish.
