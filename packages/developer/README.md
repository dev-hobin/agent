# @hobin/developer

Adaptive product-development judgment for [Pi](https://pi.dev).

Developer combines a small, branch-aware coordination extension with ten
independent skills. It routes one concrete question or green-to-green movement
at a time, records the resulting evidence, and preserves unresolved questions.
Its default topology gives feature work a useful backbone without turning every
task into a fixed lifecycle.

## Install

Requires Node.js 22.19 or newer. Tested with Pi 0.80.3 and 0.80.10.

```sh
pi install npm:@hobin/developer
```

Try it for one run without installing:

```sh
pi -e npm:@hobin/developer
```

## Quick start

Start Pi, enable adaptive mode, and describe the product task normally:

```text
/develop on
The selected payment method disappears after navigating back to checkout. Find the cause and fix it.
```

Most users should begin with `on`. Developer decides whether the next concrete
question would benefit from a focused skill or is already justified as direct action. You
do not need to call its internal protocol tools yourself.

For a risky refactor where Pi should justify mutation before using its built-in
edit, write, or shell tools:

```text
/develop strict
Unify the duplicate schedule types and conversion logic without changing existing behavior.
```

## Commands

| Command | Effect |
| --- | --- |
| `/develop` | Open the interactive Developer control menu |
| `/develop on` | Enable adaptive routing; tools stay active unless a `before-direct` question gate is open |
| `/develop strict` | Gate shell execution behind an active route and structured artifact mutation behind a direct route |
| `/develop status` | Inspect current branch state in a read-only panel |
| `/develop questions` | Choose an unresolved question, answer it or request investigation, and submit it to Pi |
| `/develop off` | Disable the protocol and clear current protocol state |

Explicit command arguments participate in Pi's completion UI. In interactive
mode, turning Developer off while a route or unresolved question exists requires
confirmation. The historical session entries remain; only current protocol
state is cleared.

Start a non-interactive or preconfigured session in a mode with the extension
flag:

```sh
pi --develop-mode on
pi --develop-mode strict
```

## Modes

| Mode | Routing | Built-in mutation tools | Best fit |
| --- | --- | --- | --- |
| `on` | Adaptive | Unchanged except while a `before-direct` question gate is open | Normal product development |
| `strict` | Adaptive | `bash` is available during skill/direct routes; Pi built-in `edit` and `write` require an active `direct` route and no `before-direct` gate | High-risk changes and workflow-discipline experiments |
| `off` | Disabled | Developer makes no changes to the active set | Normal Pi behavior without the protocol |

Strict mode and question gates are workflow-integrity controls, not a security
sandbox. A skill route receives the shell execution lane needed for repository
inspection and verifier execution, while structured `edit`/`write` mutation
remains direct-only. Shell commands are not parsed as a security language; skill
contracts prohibit artifact mutation, and adversarial evaluation checks the
workspace boundary. Developer recognizes Pi built-ins from their provenance,
preserves unrelated active tools, and does not force-enable tools the user
disabled.

## How a request runs

Developer adds two model-facing protocol tools:

1. `developer_route_question` opens one route for one concrete question.
2. The route target is `direct` or one currently available Developer skill.
3. A skill route returns the exact Pi-discovered `SKILL.md` instructions and canonical
   path; a direct route declares one movement, its stable landing, and its narrow
   verification. A behavior-preserving structural route also loads the focused
   execution profile based on flocking-style movement and small tidyings.
4. `developer_record_judgment` closes the route with a status, result, evidence,
   artifacts, and any newly opened questions. Developer then routes again from
   the stable landing before another movement.
5. Consecutive direct routes remain valid. To prevent routing by momentum, a
   direct route that follows a direct judgment must cite the previous landing
   evidence and record the plausible skill routes reconsidered plus why they add
   no useful judgment at that point.

The conditional default topology is:

```text
clarify when needed → model consequential cases
→ sketch the first feature implementation surface OR signal existing-code movement
→ one direct green-to-green movement → re-route from evidence
→ verify before completion
```

This is not a mandatory phase sequence. A stage may be not applicable and new
evidence may route backward or sideways. One guard is deliberate: a resolved
model cannot flow straight into mutation. New feature work receives an initial
`sketch`; existing-code structural work receives a `signal` first.

Product code is still read, edited, executed, and tested with Pi's normal tools.
Developer's tools only route and record judgment; they do not implement product
changes themselves.

There is never a required order such as `specify → model → sketch → verify`.
Each new route is chosen from the current question and evidence.

## What the TUI shows

Developer uses different Pi surfaces for different information:

- The footer contains only global mode, protocol state, and current route target.
- A compact widget appears only while a route or unresolved question exists.
- `/develop` uses a `SelectList` action menu.
- `/develop status` opens a branch-grounded, read-only status panel with recent
  route/judgment history and the alternatives recorded for consecutive direct work.
- `/develop questions` uses stable internal question IDs. Selecting one opens an
  answer/evidence editor and submits the resulting resolution request to Pi;
  cancelling the editor leaves protocol state unchanged.
- Selection and status overlays use most of the terminal, keep a stable rendered
  height while navigating or scrolling, and remain bounded on small terminals.
  They support mouse-wheel/trackpad scrolling, arrow keys, Page Up/Down, and
  Home/End. Terminal mouse reporting is enabled only while the overlay is open
  and is released when it closes.
- Protocol tool rows show compact status by default and higher-contrast evidence
  details when expanded with the user's configured Pi keybinding. They render
  without Pi's default full tool-row background.

RPC, JSON, and print modes keep the same protocol semantics without depending on
terminal components.

## Protocol states

| State | Meaning |
| --- | --- |
| `idle` | No active route and no unresolved Developer question |
| `needs-judgment` | One route is active and must be closed with a judgment |
| `needs-evidence` | At least one agent- or environment-owned evidence question remains open |
| `needs-answer` | At least one user-owned answer or decision remains open |
| `needs-routing` | A direct stable landing must be re-observed and routed again |
| `needs-verification` | Changed artifacts still need a resolved verify judgment |
| `blocked` | A question is unavailable or explicitly gates direct work |

These are routing states, not product-completion claims. In particular:

- `idle` does not mean the user's task is finished.
- A resolved `specify` judgment is not user acceptance.
- A resolved `verify` judgment is not timeless proof after later changes.

Pending questions receive stable internal IDs, but users do not type them. Each
question records:

- `resolutionOwner`: `agent`, `user`, or `environment`;
- `gate`: `none`, `before-direct`, or `before-completion`;
- `resolutionCriteria`: the observable evidence or answer that closes it.

Selecting `/develop questions` opens an owner-specific editor: user questions
ask for the required decision, agent questions ask Pi to investigate, and
environment questions request access or an external observation. Submitting the
editor focuses the question in branch state; an explicit ID, focus, or exact
question match associates the next route. Selection alone never closes it.

Every judgment rechecks all pending questions. `question_updates` can resolve an
unfocused question when implementation, tests, inspection, user input, or an
environment observation naturally supplies its criteria. A focused question
must receive an explicit update: resolve or dismiss it with concrete basis,
retain it as open or blocked, or close the broad parent while opening narrower
children. Resolved and not-applicable updates remove the question with recorded
basis; open or blocked updates preserve its identity. A `before-direct` question blocks both direct
routes and Pi built-in mutation tools even in adaptive mode. A
`before-completion` question allows investigation and implementation but keeps
the protocol non-idle and prevents verification debt from being cleared as a
completion claim.

When a judgment replaces a broad unresolved question with more specific evidence
questions, only the actionable children remain. Equivalent question wording is
deduplicated while preserving the existing identity.

## Skills

Pi may match these skills automatically, Developer may route a question to one,
or the user may invoke one directly with `/skill:<name>`.

| Skill | Helps decide |
| --- | --- |
| `specify` | Product meaning, scope, invariants, risks, and blocking unknowns |
| `model` | Condition spaces, contracts, replacement, transitions, guarantees, and verification targets |
| `sketch` | Inspectable code/pseudocode skeletons, case and interface tables, boundary/flow maps, state, responsibility, and variation |
| `signal` | Evidence-backed structural movement and model-code mismatch |
| `naming-judgment` | Domain sense, honest effects, and change-preserving names |
| `abstraction-review` | Whether a candidate should be kept, revised, split, rejected, or deferred |
| `schedule` | Behavior/structure timing: now, after, or never |
| `verify` | Verifier selection, evidence relevance, and pass-but-wrong risk |
| `visualize` | The smallest visual surface that lowers judgment cost |
| `adversarial-eval` | Finite, escalating attempts to falsify a skill or implementation claim |

Each leaf chooses a surface that matches its inspection problem instead of
returning undifferentiated prose: contract and scope tables for `specify`, case
or transition models for `model`, code/interface/check surfaces for `sketch`,
artifact comparisons for `signal`, rename maps for `naming-judgment`, review
cards and boundaries for `abstraction-review`, timing matrices for `schedule`,
evidence matrices for `verify`, escalation matrices for `adversarial-eval`, and
a completed visual artifact for `visualize` when a visual is warranted. Simple
judgments may remain compact when prose is genuinely clearer.

Skill judgment results preserve those surfaces as Markdown. Expanded protocol
rows render tables and code blocks through Pi's Markdown component rather than
flattening them into dim text.

Pi's loaded resource metadata is authoritative. If package configuration filters
or disables a skill, Developer cannot route to it even if its file exists in the
npm package.

Several skills link to detailed capability documents under their own
`references/` directory. Pi loads the `SKILL.md` instructions on demand; the
instructions say when each reference is worth reading and resolve it relative to
the skill directory. A reference may synthesize several sources because the
leaf's question, not a book title, owns the capability. Each source-derived
reference includes a source trace, and [SOURCES.md](./SOURCES.md) maps the full
book coverage across leaves and the direct path. Small, settled judgments do not
need the extra context.

Primary references retain the capability's core insight and one complete case.
When a question has materially different derivation rules, the skill routes a
more focused supporting reference—for example, data-shape templates separately
from generative recursion, or representation barriers separately from state and
time. This follows Pi's documented progressive-disclosure structure: supporting
files stay relative to their skill and load only when the unresolved question
needs them. `SOURCES.md` also records the reference-quality contract used to
prevent source summaries from replacing executable judgment recipes.

Developer treats Pi's loaded `systemPromptOptions.skills` metadata as the skill
SSOT. It does not rescan the package and cannot route a skill Pi filtered,
disabled, or replaced through resource configuration.

## State, branches, and compaction

Mode changes are stored as Pi custom session entries. Routes and judgments are
stored in tool-result details. Developer replays the current branch through an
XState v5 machine on startup and tree navigation, so a fork inherits only the
events on its branch. Parallel machine regions keep mode, route, question gates,
framing debt, and verification debt explicit; transition guards reject a direct
route while a `before-direct` question remains.

```text
developerMachine (parallel)
├── mode: off | on | strict
├── route: idle | judgment | direct
├── questions: clear | open
├── directGate: clear | blocked
├── completionGate: clear | blocked
├── checkpoint: ready | required
├── framing: clear | required
└── verification: current | required
```

Judgment routes carry the `execute` tag, direct routes carry `execute` and
`mutate`, and question/debt regions expose blocking tags. Every direct judgment
moves the checkpoint to `required`; the next accepted route returns it to
`ready`. Tool availability, runtime call guards, status, and direct-transition
eligibility are derived from the same machine snapshot.

The current event contract is `developer/v4`. Legacy `developer/v1` through
`developer/v3` routing history can be replayed. Legacy questions receive
conservative owner, gate, and resolution-criteria defaults rather than guessed
product decisions.

Developer deliberately leaves compaction ownership to Pi. It does not trigger,
cancel, or replace threshold/overflow compaction, so it cannot override the
user's Pi settings or race another extension. Configure earlier compaction with
Pi's `compaction.reserveTokens` and `compaction.keepRecentTokens` settings when
a large-context model reaches its limit too abruptly.

Each new agent turn receives current protocol state, and route results place
identity and recovery metadata before potentially long skill instructions. That
makes the active route recoverable after Pi compacts normally. Tool output is
checked against Pi's standard size limits before state changes are committed.
At most twenty pending questions may remain in current state.

## Update, configure, and remove

```sh
pi list
pi config
pi update npm:@hobin/developer
pi remove npm:@hobin/developer
```

Use a project-local install when a repository should declare the package in
`.pi/settings.json`:

```sh
pi install -l npm:@hobin/developer
```

Pi packages execute with Pi's system access. Review the extension and skills
before installation. See the [Pi package
documentation](https://pi.dev/docs/latest/packages) for package scope, filtering,
pinning, and security behavior.

## Package contents

```text
extensions/
├── developer.ts    # command, protocol tools, events, and Pi integration
├── machine.ts      # XState v5 parallel regions, guards, transitions, and tags
├── references/     # direct execution profiles loaded through tool results
├── state.ts        # developer/v4 event normalization and branch replay
├── skills.ts       # loaded-skill filtering and instruction rendering
├── tool-policy.ts  # machine-derived execution and mutation access policy
└── tui.ts          # selectors, widget, status panel, and prompt preparation
skills/             # ten independently loadable Pi skills
SOURCES.md          # source-to-capability maintenance trace
evals/              # model-dependent scenarios and workspace assertions
tests/              # deterministic state, policy, extension, and TUI tests
```

## Development

From the monorepo root:

```sh
pnpm install
pnpm --filter @hobin/developer check
pnpm --filter @hobin/developer eval
```

Load the workspace package into Pi without installing it:

```sh
pi -e ./packages/developer
```

Launch the isolated modal fixture in a new Ghostty window for visual QA:

```sh
./packages/developer/scripts/ghostty-tui-qa.sh
```

Choose **Inspect status** or **Revisit an open question**, then resize the window
while the modal is open. The fixture disables discovered extensions, skills,
tools, sessions, and network startup so it cannot mutate Developer state or call
a model.

`check` validates package structure and deterministic behavior. `eval` launches
the real Pi RPC surface without a model and covers package resources, commands,
mode state, and strict tool gating. These are release-gating checks.

Model-dependent runs are probabilistic evaluations rather than binary tests:

```sh
PI_CODING_AGENT_DIR=~/.pi/agent \
DEVELOPER_EVAL_FIXTURE=agent-before-direct-evidence-gate \
DEVELOPER_EVAL_TRIALS=5 \
pnpm --filter @hobin/developer eval:live
```

Use `eval:live:json` for the JSON transport. Each report separates the hard
admissibility envelope from routing quality: structurally valid runs must use an
admissible route, preserve mutation/question/completion invariants, satisfy
hidden artifact checks, include required semantic terms, and end in a declared
outcome. Among accepted runs, `preferredFirstOwners` measures better versus
merely admissible routing. Reports include acceptance and preference rates,
95% Wilson intervals, inadmissible results, rejected protocol attempts, budget
exhaustion, and environment failures. Any accepted inadmissible result makes the
evaluation command fail; ordinary admissible preference variation remains a
rate. A single model sample is not release evidence.

Live fixtures classify terminal outcomes as `settled-unchanged`, `pending`,
`changed-paused`, or `changed-verified`. An eval-only observer compares
product-file snapshots around bash/edit/write calls and rejects artifact changes
outside a direct route. Dedicated fixtures sample a deliberately paused direct
landing and an agent-owned before-direct question resolved through a non-direct
bash evidence route; their structural guarantees also have deterministic machine,
extension, trace, filesystem, and outcome tests. RPC and JSON runners share
route, tool-call, tool-error, wall-clock, and no-progress budgets and preserve a
trace for diagnosis.

## License

[MIT](./LICENSE)
