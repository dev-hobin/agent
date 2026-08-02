# Learning operating principles

English | [한국어](./ko/how-it-works.md)

Learning is not a runtime that tracks progress through a curriculum. The package
contains five complete `SKILL.md` methods that Pi loads directly and one small
extension that makes choosing a method convenient.

That separation is the central mechanism:

```text
Pi package discovery
├─ extensions/learning.ts  → /learning chooser
└─ skills/*/SKILL.md       → methods loaded into model context by Pi
```

The chooser does not execute a Skill, and Skills do not run on a Learning-owned
state machine.

## 1. Pi discovers the extension and Skills as separate resources

`pi.extensions` in `package.json` points to `extensions/learning.ts`, while
`pi.skills` points to the `skills/` directory.

When Pi loads the package it does two independent things:

1. executes the extension module, which registers `/learning`; and
2. discovers each `skills/<name>/SKILL.md` through the normal Pi Skill loader.

The extension does not copy Skills into a private registry or assemble their
model prompts. Pi owns Skill discovery and `/skill:<name>` execution. A user can
therefore invoke `/skill:technical-reading` without ever opening `/learning`.

## 2. `/learning` changes editor text only

The chooser handler parses either its argument or the TUI selection into one of
five Skill names, then calls `prepareLearningSkill()`.

That function removes only an existing Learning Skill prefix from the editor and
preserves the rest of the draft before prepending the new command:

```text
editor before:
  Explain the state-transition failure in this RFC.

after choosing technical-reading:
  /skill:technical-reading Explain the state-transition failure in this RFC.
```

No model request, Learning session event, or source read occurs. The extension
calls `setEditorText()` and returns. Pi loads the Skill only after the user
reviews and sends the edited message.

`/learning technical-reading` uses the same function. It bypasses the selector,
not the send boundary.

## 3. A Skill method is a prompt-time execution contract

When the user sends `/skill:technical-reading`, Pi places that `SKILL.md` in the
current model context. Reading, repository navigation, conceptualization,
pattern judgment, and exercise design then use ordinary Pi tools under the Skill
method.

The execution semantics therefore live in `SKILL.md`, not a TypeScript
controller. Every Skill must independently define:

- which requests and central question it owns;
- accepted source and scope;
- investigation order and distinctions;
- behavior for missing evidence or a newly consequential question; and
- its result and stop condition.

The core method must remain complete when no packaged reference is opened. A
method that cannot begin without a reference or another Learning Skill is not an
independent capability.

## 4. Skills are separated by question ownership, not output format

| Skill | Central question owned |
| --- | --- |
| `technical-reading` | What does this source actually claim, demonstrate, and bound? |
| `opensource-reading` | What contract and tradeoff does an exact public code slice implement? |
| `conceptualize` | What concept remains valid after source-specific wording is removed? |
| `patternize` | Under what conditions does recurrence across cases become a reusable routine? |
| `exercise` | What observable performance would demonstrate usable understanding? |

Technical reading preserves source wording and order when they carry meaning.
Conceptualization deliberately removes source-specific language to test
transfer. An automatic package phase joining them would damage their different
completion conditions.

## 5. There is no package-wide lifecycle state

Learning does not persist:

- a current learning phase;
- completion percentage;
- the next required Skill;
- one artifact schema; or
- a default Notebook or repository path.

A Skill result may recommend a handoff when another central question becomes
important. The package runtime does not automatically start that Skill or pass
hidden shared state. A later user request causes Pi to load the next method
normally.

Independence does not forbid composition. It means results move between Skills
as explicit user-visible inputs rather than implicit lifecycle state.

## 6. `judgment.json` is an authoring source, not a runtime policy engine

Each Skill's `judgment.json` is a maintainer source for conditions under which
packaged references may help. During development, a script compiles that policy
through `judgmentPolicyDirections()` into deterministic Markdown under the
Skill's `## Context Directions` section.

```sh
node packages/learning/scripts/write-context-directions.mjs
pnpm --filter @hobin/learning check
```

The installed package starts no Learning policy service or Judgment session.
The runtime instruction visible to the model is the generated text already
embedded in `SKILL.md`. This is why `@hobin/judgment` is a development dependency.

Package checks compare policy output and the embedded section byte for byte. A
maintainer cannot change only the policy and pass release checks with a stale
Skill prompt.

## 7. References are conditional supporting material

Files under `references/` do not replace the core method. Context Directions give
each file an independent condition describing what missing distinction,
counterexample, or check it can add.

The intended decision is:

1. inspect the actual source through the core method;
2. identify a consequential missing distinction;
3. open only an exact reference that can supply it with an ordinary file tool;
4. skip the reference when the source already supplies the distinction.

Reference growth therefore does not inject every file into model context. Zero,
one, or many references are all valid. Generated directions also preserve root
`unless` exclusions rather than treating a similar `when` as sufficient.

This selection is agent behavior under prompt instructions. The Learning
extension does not intercept tool calls to enforce it as access control.

## 8. Persistence is also a Skill contract, not a hidden service

Each method is written to complete a conversational result by default and to use
ordinary file tools only after the user requests persistence and selects or
approves a target.

The extension has no artifact writer, Notebook service, graph database, or
Learning session store. Three distinct levels matter:

- **structurally enforced:** the chooser changes only the editor and stores no
  Learning state;
- **required by the Skill method:** do not write without a user-owned target and
  save request;
- **performed by Pi:** an active model tool writes with host permissions when
  invoked.

Learning is not an operating-system write sandbox. Persistence discipline is an
execution contract carried by the Skill prompt.

## 9. Package checks protect the structural boundary

`pnpm --filter @hobin/learning check` verifies that:

- Pi discovers all five Skills without diagnostics;
- chooser names match actual Skill directories;
- each Skill has frontmatter, a complete method, and Context Directions;
- every packaged reference is governed by exactly one policy entry;
- policy paths name existing Markdown under the Skill root;
- generated directions match their policies; and
- the removed artifact validator, shared graph schema, and Judgment runtime
  extension do not return.

These checks do not prove semantic learning quality. They prove that the package
continues to preserve independent Skills and the authoring/runtime boundary.
