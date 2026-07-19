# @hobin/learning

Source-grounded learning for [Pi](https://pi.dev).

Learning provides five independent skills for studying technical material and
repositories, forming durable concepts, coordinating them into operational
patterns, and designing deliberate practice. Its extension adds an optional TUI
chooser and one read-only structural validator for saved learning artifacts.

## Install

Requires Node.js 22.19 or newer. Tested with Pi 0.80.3 and 0.80.10.

```sh
pi install npm:@hobin/learning
```

Try it for one run without installing:

```sh
pi -e npm:@hobin/learning
```

## Quick start

Ask Pi a learning question normally. Pi can match the appropriate skill from
its description:

```text
Help me read this parser implementation by forming hypotheses from its tests and checking them against the code.
```

Or open the optional package chooser:

```text
/learning
```

The chooser presents the five learning approaches and saved-artifact validation
as outcomes rather than phases. Selecting an approach preserves the existing
editor draft and prepares an explicit `/skill:...` command. It never sends the
prompt automatically.

## Learning approaches

| Skill | Use it when | Example invocation |
| --- | --- | --- |
| `technical-reading` | The main evidence is a book, article, documentation page, specification, tutorial, PDF, or webpage | `/skill:technical-reading Explain this specification without collapsing its edge cases.` |
| `opensource-reading` | The main evidence is a repository slice across docs, tests, examples, and implementation | `/skill:opensource-reading Trace how this library represents cancellation.` |
| `conceptualize` | Source-bound observations should become a reusable concept or update a living concept graph | `/skill:conceptualize Turn these notes into one atomic concept and test its boundary.` |
| `patternize` | Several concepts or repeated judgments should become an operational workflow, decision routine, or diagnostic | `/skill:patternize Build a debugging pattern from these related concepts.` |
| `exercise` | A concept, pattern, or reading artifact needs retrieval, diagnosis, repair, transfer, or mastery practice | `/skill:exercise Turn this concept into deliberate practice with observable mastery evidence.` |

There is no required sequence. For example, a session may go directly from
repository reading to exercises, or begin with an existing concept and move to
patternization. The source and current learning question determine the next
useful skill.

## What each skill is trying to preserve

### Technical reading

Separates faithful source reconstruction from coaching. It can recover a
document's intent, choose complementary reading lenses, test claims and examples,
and preserve continuity across a longer book without reducing the result to a
generic summary.

### Open-source reading

Narrows work to one evidence-backed slice. It asks the learner to form and test
hypotheses across documentation, public interfaces, tests, implementation,
failure modes, and design tradeoffs instead of passively touring a repository.

### Conceptualization

Moves from source-bound observations to source-independent concepts. A new
source may add, reinforce, refine, split, merge, connect, weaken, or retire a
concept; it does not automatically justify creating another note.

### Patternization

Coordinates multiple concepts under one operational axis. The result may be a
workflow, decision routine, diagnostic path, checklist, concept-role map, or
visual execution model rather than another isolated concept.

### Exercise design

Builds practice that makes understanding observable: prediction, misconception
diagnosis, worked and faded examples, contrast, repair, retrieval, transfer, and
mastery checks. It is not a generic quiz generator.

## Saved learning artifacts

Learning includes the model-facing `validate_learning_artifact` tool. Pi should
use it after writing or revising a graph-shaped Markdown artifact such as a:

- concept
- source-bound concept update
- concept scheme structure note
- reusable pattern linked to the concept graph

The tool reads one `.md` path, absolute or relative to Pi's current working
directory. It checks frontmatter and relation structure, including namespace,
family, status, source-independence expectations, and typed relation shapes.

A valid result means only that the artifact follows the package's structural
conventions. It does not prove that:

- the source is reliable or interpreted faithfully
- a concept is truly atomic, useful, or source-independent
- a pattern transfers beyond its examples
- an exercise demonstrates mastery
- the artifact's claims are true

Standalone diagnostics and exercise workbooks are not forced into a graph schema
the package has not defined for them.

To prepare validation from the TUI, run `/learning` and choose **Validate a saved
artifact**. The editor receives an editable request ending in `@`, so Pi's native
file completion can select the path.

## What the TUI shows

Learning deliberately uses transient UI rather than a persistent dashboard:

- `/learning` opens a `SelectList` chooser for approaches and validation.
- The validation tool row shows validity and error/warning counts when collapsed.
- Expanding the row reveals the artifact identity and grouped issues using the
  user's configured Pi keybinding.
- Partial execution and actual tool failures have distinct rendering.

Learning does not install a footer or progress widget because it owns no truthful
session-wide phase or completion percentage. RPC, JSON, and print modes keep the
same skill and validation behavior without terminal components.

## Update, configure, and remove

```sh
pi list
pi config
pi update npm:@hobin/learning
pi remove npm:@hobin/learning
```

Use a project-local install when a repository should declare the package in
`.pi/settings.json`:

```sh
pi install -l npm:@hobin/learning
```

Pi packages execute with Pi's system access. Review the extension and skills
before installation. See the [Pi package
documentation](https://pi.dev/docs/latest/packages) for package scope, filtering,
pinning, and security behavior.

## Package contents

```text
extensions/
├── learning.ts            # /learning command and artifact-validation tool
├── tui.ts                 # approach selector and editor prompt preparation
└── artifact-validator.ts  # deterministic Markdown/frontmatter validation
references/
├── graph-artifact-standard.md
└── skill-boundaries.md
skills/
├── technical-reading/
├── opensource-reading/
├── conceptualize/
├── patternize/
└── exercise/
tests/                     # validator, extension, RPC codec, and TUI tests
```

Each skill keeps its detailed method and relevant references inside its own
directory. Shared references define only cross-skill boundaries and artifact
conventions.

## Development

From the monorepo root:

```sh
pnpm install
pnpm --filter @hobin/learning check
pnpm --filter @hobin/learning eval
```

Load the workspace package into Pi without installing it:

```sh
pi -e ./packages/learning
```

`check` validates package structure, artifact behavior, extension rendering, and
TUI interactions. `eval` launches the real Pi RPC surface and confirms that the
chooser command, validator, and five skill commands are loaded from the package.

## License

[MIT](./LICENSE)
