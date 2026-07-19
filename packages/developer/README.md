# @hobin/developer

Adaptive product-development judgment for [Pi](https://pi.dev).

Developer combines a small, branch-aware coordination extension with ten
independent skills. It routes one concrete question at a time, records the
resulting evidence, and preserves unresolved questions without turning product
development into a fixed lifecycle.

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
| `/develop on` | Enable adaptive routing without restricting Pi's existing tools |
| `/develop strict` | Enable routing and withhold Pi's built-in mutation tools until a direct route is active |
| `/develop status` | Inspect current branch state in a read-only panel |
| `/develop questions` | Choose an unresolved question and prepare an editable revisit prompt |
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
| `on` | Adaptive | Unchanged | Normal product development |
| `strict` | Adaptive | Pi built-in `edit`, `write`, and `bash` require an active `direct` route | High-risk changes and workflow-discipline experiments |
| `off` | Disabled | Developer makes no changes to the active set | Normal Pi behavior without the protocol |

Strict mode is a workflow-integrity gate, not a security sandbox. It recognizes
Pi built-ins from their provenance and does not claim to classify or block
mutation-capable tools registered by other extensions. It also preserves
unrelated active tools and does not force-enable read tools the user disabled.

## How a request runs

Developer adds two model-facing protocol tools:

1. `developer_route_question` opens one route for one concrete question.
2. The route target is `direct` or one currently available Developer skill.
3. A skill route returns the exact Pi-discovered `SKILL.md` instructions and canonical
   path; a direct route keeps implementation tools available for the justified
   action.
4. `developer_record_judgment` closes the route with a status, result, evidence,
   artifacts, and any newly opened questions.

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
- `/develop status` opens a branch-grounded, read-only status panel.
- `/develop questions` uses stable question IDs and only prepares editor text;
  selection alone never mutates protocol state.
- Protocol tool rows show compact status by default and evidence details when
  expanded with the user's configured Pi keybinding.

RPC, JSON, and print modes keep the same protocol semantics without depending on
terminal components.

## Protocol states

| State | Meaning |
| --- | --- |
| `idle` | No active route and no unresolved Developer question |
| `needs-judgment` | One route is active and must be closed with a judgment |
| `needs-evidence` | At least one question remains open for evidence |
| `blocked` | At least one pending question carries a recorded blocker |

These are routing states, not product-completion claims. In particular:

- `idle` does not mean the user's task is finished.
- A resolved `specify` judgment is not user acceptance.
- A resolved `verify` judgment is not timeless proof after later changes.

Pending questions receive stable IDs. A later route revisits one by passing the
exact ID; wording similarity is never used as identity.

## Skills

Pi may match these skills automatically, Developer may route a question to one,
or the user may invoke one directly with `/skill:<name>`.

| Skill | Helps decide |
| --- | --- |
| `specify` | Product meaning, scope, invariants, risks, and blocking unknowns |
| `model` | Predicates, cases, rules, forbidden states, transitions, and objectives |
| `sketch` | Data definitions, wished interfaces, representative cases, and checks |
| `signal` | Repetition, difference, structural pressure, and model-code mismatch |
| `naming-judgment` | Stable domain meaning and names that preserve change boundaries |
| `abstraction-review` | Whether a candidate should be kept, revised, split, rejected, or deferred |
| `schedule` | Whether a structural change belongs now, after, or never |
| `verify` | Whether current evidence actually supports an implementation claim |
| `visualize` | The smallest visual surface that lowers judgment cost |
| `adversarial-eval` | Finite, escalating attempts to falsify a skill or implementation claim |

Pi's loaded resource metadata is authoritative. If package configuration filters
or disables a skill, Developer cannot route to it even if its file exists in the
npm package.

Several skills link to detailed documents under their own `references/`
directory. Pi loads the `SKILL.md` instructions on demand; the instructions say
when the additional reference is worth reading and resolve it relative to the
skill directory. Small, already-settled judgments do not need the extra context.

## State, branches, and compaction

Mode changes are stored as Pi custom session entries. Routes and judgments are
stored in tool-result details. Developer reconstructs state from the current
session branch on startup and tree navigation, so a fork inherits only the
events on its branch.

The current event contract is `developer/v2`. Legacy `developer/v1` routing
history can be replayed, but removed inferred fields are not revived.

Developer uses Pi's normal compaction. Each new agent turn receives current
protocol state, and route results place identity and recovery metadata before
potentially long skill instructions. Tool output is checked against Pi's standard size
limits before state changes are committed. At most twenty pending questions may
remain in current state.

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
├── state.ts        # replayable developer/v2 branch state
├── skills.ts       # Pi-native skill discovery and instruction loading
├── tool-policy.ts  # strict-mode active-tool reconciliation
└── tui.ts          # selectors, widget, status panel, and prompt preparation
skills/             # ten independently loadable Pi skills
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

`check` validates package structure and deterministic behavior. `eval` launches
the real Pi RPC surface without a model and covers package resources, commands,
mode state, and strict tool gating. Maintainers can use `eval:json` and the live
fixtures for model-dependent scenarios.

## License

[MIT](./LICENSE)
