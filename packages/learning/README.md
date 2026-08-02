# @hobin/learning

> **Development status:** `0.1.1` is a private patch candidate. Package checks,
> five reference-selection contrasts, and the Pi 0.80.10–0.83.0 source/packed
> matrix are green. Publication still requires explicit approval.

Source-grounded study, cross-source synthesis, and deliberate practice for
[Pi](https://pi.dev).

Learning provides five independent skills. They recover understanding from prose
and repositories, form concepts across sources, discover operational patterns
across cases, and design observable practice. Every skill owns a complete
question, method, result, and stop.

## Install

Requires Node.js 22.19 or newer.

```sh
pi install npm:@hobin/learning
```

Try it for one run without installing:

```sh
pi -e npm:@hobin/learning
```

## Quick Start

Ask Pi normally, invoke one skill explicitly, or open the transient chooser:

```text
/skill:technical-reading Explain this specification without flattening its edge cases.
/skill:opensource-reading Trace this public API through tests and implementation.
/skill:conceptualize Compare these insights and test whether one concept survives.
/skill:patternize Find the recurring decision path across these cases.
/skill:exercise Turn this concept into prediction, repair, and transfer practice.
/learning
```

The chooser presents independent outcomes rather than phases. It preserves the
editor draft, prepares `/skill:...`, and never sends automatically.

## Independent Skills

| Skill | Owned result |
| --- | --- |
| `technical-reading` | Faithful source-bound understanding with claims, examples, boundaries, and coaching kept distinct. |
| `opensource-reading` | One evidence-backed repository slice with promise, implementation, tests, invariant or tradeoff, and falsifier. |
| `conceptualize` | One source-independent, transfer-tested concept or an explicit provisional boundary. |
| `patternize` | One recurring operational coordination with context, forces, moves, checks, and consequences. |
| `exercise` | Deliberate practice that produces observable prediction, diagnosis, repair, transfer, and mastery evidence. |

There is no required sequence. A handoff occurs only when another skill's core
question becomes consequential. See [Learning Runtime Flow](./docs/runtime-flow.md)
for the independent-skill and authoring/runtime boundaries.

## Context Directions

Each skill has conditional packaged references and therefore owns one minimal
`judgment.json` policy:

```text
skill-local {when, unless, references[{path, when}]}
→ exact JudgmentAuthoringPolicy parser
→ deterministic Context Directions
→ parity-checked SKILL.md section
→ ordinary Pi read/tool acquisition
→ complete Learning result with used context and limitations
```

The complete learning method remains in `SKILL.md`. Generated **Context
Directions** expose capability applicability, winning exclusions, and each
reference's independent relevance statement.

A reference is a candidate, not a mandatory member or authority. A lightweight
result may use no optional reference. One or several references are read only
when their material distinctions can change the result. Exact external source
material remains open-world and may make a local reference redundant. Missing
consequential context stays visible as a limitation.

Learning uses Judgment only as a development-time authoring/compiler dependency.
It ships no Judgment extension, lifecycle, session protocol, state machine, or
nested package runtime. The committed directions are already model-visible in
the packed skills.

Regenerate directions after changing a policy:

```sh
node packages/learning/scripts/write-context-directions.mjs
```

The package check parses every real policy and fails if any shipped section
differs from deterministic compiler output.

## Artifact Delivery

Each skill returns a complete conversational result or copyable plain Markdown.
When the user explicitly asks to save it, the skill may write to a user-selected
target without assuming a notebook, graph, metadata schema, Git workflow, or
sibling package.

## Package Contents

```text
extensions/
├── learning.ts            # /learning chooser command
└── tui.ts                 # LearningSkillName selector/editor preparation
references/
└── skill-boundaries.md    # ownership and handoff boundaries
skills/
├── technical-reading/     # SKILL.md + judgment.json + conditional references
├── opensource-reading/
├── conceptualize/
├── patternize/
└── exercise/
scripts/
├── context-directions.mjs
└── write-context-directions.mjs
```

## Development

```sh
pnpm install
pnpm --filter @hobin/learning check
pnpm --filter @hobin/learning eval
pi -e ./packages/learning
```

The R2 context/parity suite can be run directly:

```sh
node --test packages/learning/tests/r2/context-parity.red.test.ts
```

## Update And Remove

```sh
pi update npm:@hobin/learning
pi remove npm:@hobin/learning
```

Pi packages execute with the Pi process's system access. Review package source
before installation.

## License

[MIT](./LICENSE)
