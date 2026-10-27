# Learning operating principles

English | [한국어](./ko/how-it-works.md)

Learning is a collection of complete Agent Skills, not a service or a runtime
tracking progress through a curriculum. Its optional Pi chooser is separate from
its canonical methods.

## 1. The portable unit is a whole Skill directory

```text
skills/<name>/
├─ SKILL.md          -> complete method and generated selection directions
├─ judgment.json     -> authoring source, not a required host policy API
└─ references/*.md   -> conditional supporting material
```

A host discovers the Skill's metadata and loads `SKILL.md` when selected. The
agent follows its method using ordinary tools and reads supporting files only
when needed. Relative resource paths start at the owning Skill directory, not
the current task directory. No Learning-specific loader or controller is needed.

The upstream format is Agent Skills. The `judgment.json` vocabulary, generated
section, and material-relevance rules are repository conventions, not additional
standard fields or host APIs.

## 2. The method is a prompt-time execution contract

Each Skill independently defines:

- its central question and accepted requests;
- source scope, investigation order, and distinctions;
- behavior when evidence is missing or another question becomes consequential;
- a complete result and stop condition.

Its core method remains complete when no prepared reference is opened. It does
not require a previous Learning Skill or a TypeScript controller to begin.

| Skill | Central question owned |
| --- | --- |
| `technical-reading` | What does this source actually claim, demonstrate, and bound? |
| `opensource-reading` | What contract and tradeoff does an exact public code slice implement? |
| `conceptualize` | What concept remains after source-specific wording is removed? |
| `patternize` | When does recurrence across cases become a reusable routine? |
| `exercise` | What observable performance demonstrates usable understanding? |

Technical reading preserves meaningful source wording and order; conceptualize
removes source-specific language to test transfer. An automatic phase joining
them would damage their different completion conditions.

## 3. Authoring JSON becomes standard Markdown before execution

A development-time, package-local parser and renderer compile `judgment.json`
into `## Context Directions` inside `SKILL.md`:

```sh
node packages/learning/scripts/write-context-directions.mjs
```

No installed policy service interprets the JSON. The model sees the generated
Markdown as normal Skill instructions. Checks compare the generated section with
the authoring source byte for byte, and check reference coverage and existence.
Changing a policy without regenerating the directions fails authoring checks.

## 4. Supporting references are conditional

For a candidate method, at least one root `when` must apply and any matching
`unless` excludes it. Exclusions win. For an applicable method:

1. inspect the source through the core method;
2. identify a consequential missing distinction, counterexample, or check;
3. read only references whose independent conditions can change the result;
4. skip material the source already supplies.

Zero, one, and several reference reads are valid. Reference growth does not mean
eagerly injecting every body. These are model instructions, not access-control
rules enforced by the optional chooser or a standard runtime.

## 5. There is no package-wide lifecycle or persistence service

Learning stores no phase, completion percentage, next required Skill, shared
artifact schema, default Notebook, or hidden cross-Skill state. Results can be
composed as explicit user-visible inputs; there is no automatic handoff.

Methods default to complete conversational results. They direct the agent to
write only when a user requests persistence and names or approves a target.
Distinguish three levels:

- the Pi chooser structurally changes only editor text and stores no state;
- the Skill method instructs the model to respect the save boundary;
- the host actually executes file tools under its own permissions.

Learning is not an operating-system write sandbox or an artifact writer.

## 6. Pi integration is optional

`package.json` exposes Skills and the chooser independently:

```text
pi.skills      -> skills/
pi.extensions  -> adapters/pi/learning.ts
```

Pi's native loader owns discovery and `/skill:<name>` invocation. The adapter
registers only `/learning`; it does not duplicate the catalog or assemble model
prompts. Users can invoke Skills without opening the chooser.

The chooser parses an argument or TUI selection into one of the five names and
calls `prepareLearningSkill()`. It replaces only an existing Learning prefix,
preserving the rest of the draft:

```text
before: Explain the state-transition failure in this RFC.
after:  /skill:technical-reading Explain the state-transition failure in this RFC.
```

It makes no model request or source read and does not send the editor. The user
reviews and submits it. `/learning technical-reading` bypasses the selector,
not this send boundary. Other hosts need not reproduce this UI.

## 7. Verification has separate owners

- Root `pnpm check:portable` uses pinned upstream reference validation, checks our
  resource conventions, and consumes packed/relocated Skill bundles without
  adapters or package manifests.
- Package `check:portable` checks the independent catalog, authoring directions,
  paths, and absence of the removed shared runtime artifacts.
- Package `check:pi` checks Pi discovery, chooser wiring, editor behavior, and
  provider-free adapter tests. Pi RPC evaluation drivers are host-specific
  development tools, not portable method dependencies.

These checks do not prove semantic learning quality or correct model selection.
Live-model evaluations are optional, host-specific evidence outside default
checks. A successful validator is not proof of support by every future service.
