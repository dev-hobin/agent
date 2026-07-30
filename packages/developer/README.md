# Developer for Pi

Developer is a branch-aware judgment workbench that helps [Pi](https://pi.dev)
stop guessing, choose the right design or review method, make one justified
change, and show the evidence behind it.

Use it when a task may hide product rules, consequential cases, ownership,
compatibility, structural timing, or pass-but-wrong verification. Developer:

- turns consequential uncertainty into explicit questions;
- routes Pi to one of eleven focused judgment skills;
- loads deeper references only when an observable trigger calls for them;
- keeps implementation, unresolved questions, and verification evidence visible
  on the current session branch.

Developer is adaptive rather than phase-driven. It does not force every task
through a fixed plan, design, implementation, and review sequence.

## Install

Requires Node.js 22.19 or newer. The 0.1.15 Workbench was verified with Pi
0.80.10 and 0.82.1; the verified TypeBox resolution was 1.3.6.

```sh
pi install npm:@hobin/developer
```

Try it for one run without installing:

```sh
pi -e npm:@hobin/developer
```

Start Pi and enable Developer:

```text
/developer on
```

Run `pi list` if you want to confirm that the package is installed.

## Try it

Describe the product task normally. You do not need to name a skill or call an
internal protocol tool.

```text
/developer on
The selected payment method disappears after navigating back to checkout.
Find the cause and fix it.
```

Depending on what the repository already establishes, Developer may ask for a
missing product decision, inspect the relevant behavior, route a focused model
or sketch, permit one implementation movement, and require evidence before the
changed work is treated as complete.

Other useful first requests:

```text
Add scheduled invoice delivery.
Clarify any missing product rules before editing.
```

```text
This parser change is green, but the conditionals are spreading.
Decide whether structural work belongs now.
```

```text
The tests pass after this cache rewrite.
Check what they do not prove before calling it done.
```

For a scope-bound existing-code diagnosis and improvement plan, ask for Doctor
explicitly and name a path, flow, boundary, package, or subsystem when you can:

```text
Run a thorough Doctor review of the checkout request-to-persistence flow.
Preserve current external behavior, consult every triggered Developer judgment,
and produce a now/next/observe/leave-alone plan without modifying files.
```

When no useful scope is supplied, Doctor performs a cheap orientation pass and
proposes one. It distinguishes requested, inspected, and claim scope rather than
presenting a repository sample as an exhaustive review.

## Why Developer

Ordinary coding requests often contain decisions that look like implementation
details but are actually product, model, boundary, or evidence questions.

| Before | With Developer |
| --- | --- |
| Vague requests decide product behavior | Unknowns become owned questions |
| Green tests stand in for claims | Evidence is matched to each claim |
| Refactoring follows taste or momentum | Structure follows observed pressure |
| All methods enter context | Only triggered methods load |
| Branches lose rationale | Evidence replays with its branch |

Developer coordinates judgment; Pi still reads, edits, runs, and tests the
product with its normal tools. Across those judgments, an unchecked assertion,
cast, non-null claim, or typed decode is never treated as evidence that a domain
invariant holds: broader input must cross an owned parser or smart-constructor
boundary whose success returns the refined value.

## How it works

Developer follows a small adaptive loop:

```text
Discover → Load → Derive → Act → Check → Learn
```

1. **Discover** the current unresolved question from the request, repository,
   and latest evidence.
2. **Load** one focused skill, plus only the deeper references whose triggers
   actually apply.
3. **Derive** an inspectable artifact such as a case table, boundary map, wished
   interface, review card, timing matrix, or evidence matrix.
4. **Act** through one justified implementation movement when mutation is the
   right next step.
5. **Check** the changed claim with an appropriate observer and verifier.
6. **Learn** from the stable landing, preserve remaining questions, and route
   again rather than continuing by momentum.

This is not a mandatory phase sequence. A simple task can move directly to
implementation. New evidence can route backward or sideways. Consecutive
implementation movements are allowed when the previous landing is re-observed
and the plausible judgment routes add no useful information.

## Common workflows

| Need | Developer helps Pi… |
| --- | --- |
| Diagnose existing code | Bound the review, preserve behavior, consult triggered judgments, and order justified improvements |
| Clarify a feature | Separate meaning, constraints, examples, and blockers |
| Model behavior | Enumerate cases, contracts, transitions, and guarantees |
| Shape code | Expose data, interfaces, collaboration, state, and checks |
| Refine input safely | Turn broader input into invariant-carrying domain values before dependent effects |
| Inspect a design | Identify structural movement and model-code mismatch |
| Review an abstraction | Keep, revise, split, reject, or defer the candidate |
| Time a refactor | Separate behavior work and judge the cost of delay |
| Name code | Preserve domain meaning and expose effects or multiple senses |
| Verify completion | Match evidence to claims and find pass-but-wrong risks |
| Challenge a claim | Run finite adversarial checks with an explicit stop |
| Clarify a decision | Choose the smallest useful visual surface |

## Skills

Developer may route these skills automatically. You can also invoke any one
directly with `/skill:<name>`.

| Skill | Helps decide |
| --- | --- |
| `doctor` | What a bounded existing-code scope must preserve, treat, observe, or leave alone |
| `specify` | Product meaning, scope, invariants, and blockers |
| `model` | Cases, contracts, transitions, guarantees, and checks |
| `sketch` | Data, interfaces, collaboration, flow, state, and code shape |
| `signal` | Structural movement and model-code mismatch |
| `naming-judgment` | Stable domain meaning, effects, and multiple senses |
| `abstraction-review` | Whether to keep, revise, split, reject, or defer |
| `schedule` | Whether structural work belongs now, after, or never |
| `verify` | What evidence proves and what pass-but-wrong risk remains |
| `visualize` | Which visual surface materially lowers judgment cost |
| `adversarial-eval` | Which finite checks could falsify a claim |

Each skill produces an artifact suited to its question instead of defaulting to
undifferentiated prose. Simple judgments remain compact when prose is genuinely
clearer.

Doctor is an explicit coordination workflow, not the default front door for
ordinary tasks. It first makes a broad, shallow disposition of every available
Developer judgment lens inside a declared scope. It then closes so each
triggered question can run through its owning skill and all reference-policy
routes supported by observable evidence. A final Doctor route synthesizes those
owner judgments into a treatment plan; Doctor never reads sibling references or
replaces their methods with one giant checklist.

## Commands

| Command | Effect |
| --- | --- |
| `/developer` | Open the branch-aware judgment Workbench |
| `/developer status` | Open Workbench Overview, or print current state outside TUI mode |
| `/developer questions` | Review, answer, or investigate an unresolved Question |
| `/developer settings` | Open activation Settings, then return to the Workbench |
| `/developer on` | Enable adaptive routing and route-bound tool access |
| `/developer off` | Disable Developer and clear current protocol state |

Start a preconfigured session with Developer enabled:

```sh
pi --developer
```

Developer 0.1.15 intentionally replaces the old `/develop` command and
`--develop` startup flag without aliases. Commands use Pi's normal
`/developer <action>` grammar; colon-style command names are not registered.

Turning Developer off while work or questions remain asks for confirmation in
interactive mode. Historical session entries remain; only current protocol state
is cleared.

## Workbench and visible state

`/developer` makes the current judgment state visible without changing it:

```text
Overview → Active Route → Questions → Judgments → Landings → Settings
```

Overview shows the current obligation, mutation authority, gates, active target,
next action, runtime resources, and verification debt. Active Route exposes the
route question, reason, known evidence, alternatives, reference provenance, and
one bounded implementation contract when mutation is authorized. Judgments keep
complete result Markdown with basis and artifacts. Landings index implementation
judgments without inventing a per-landing `Verified` claim that the event schema
does not record.

The Workbench is keyboard-complete. Use arrows or `j/k` to move, Enter to open,
Escape to return one level, Tab to change focus, Page Up/Page Down and Home/End
to scroll, and `?` for contextual help. Opening and scrolling the Workbench does
not append session entries, send messages, change active tools, or write files.

Developer keeps consequential unknowns explicit instead of silently turning them
into assumptions. A Question records who can resolve it, what evidence or answer
would close it, and whether it blocks implementation or completion.

`/developer questions` opens a bounded decision brief with the Markdown
explanation visible in the initial viewport and answer/defer actions pinned below
it. Page Up and Page Down move through longer detail without displacing those
actions. User-owned Questions accept an answer, agent-owned Questions can be
sent back to Pi for investigation, and environment-owned Questions identify
access or observations that must come from outside the session.

The footer shows activation and the current route. A compact widget appears only
while a route or unresolved Question exists. `/developer status` and
`/developer questions` remain direct accelerators for explicit inspection and
action.

Visible routing states include:

| State | Meaning |
| --- | --- |
| `idle` | No active route or unresolved Developer question |
| `needs-judgment` | Current route still needs a recorded result |
| `needs-evidence` | Agent or environment evidence is still required |
| `needs-answer` | A user decision is still required |
| `needs-routing` | An implementation landing must be routed again |
| `needs-verification` | Changed artifacts still need verification |
| `blocked` | A required answer, observation, or access is unavailable |

These are routing states, not timeless product-completion claims. In particular,
`idle` does not mean that the user's task is complete, and later changes can
invalidate an earlier verification judgment.

## Tool boundaries

While Developer is on:

- Pi's built-in `bash` is available for repository inspection and verification
  during skill and implementation routes;
- built-in `edit` and `write` require an active implementation route with no
  unresolved before-implementation gate;
- unrelated tools and user-disabled tools keep their existing configuration;
- product changes still happen through Pi's normal tools, not through
  Developer's coordination tools.

These controls protect workflow integrity. They are **not a security sandbox**:
shell commands are not parsed as a security language, and Pi packages run with
the access of the Pi process. Review the package before installation and use an
external sandbox when you need an operating-system security boundary.

## References and auditability

A skill's always-needed method lives in `SKILL.md`. Conditional derivations live
in `references/*.md`, while `reference-policy.json` maps an observable trigger
to one question, required reference set, expected artifact, stop condition, and
handoff boundary.

During a Developer route, selected references are loaded through a dedicated
trace rather than an ordinary file read. A resolved judgment connects each
relied-upon reference to the observed trigger, applied rule, and resulting
artifact.
Reference and policy hashes make that application replayable on the current
branch; they do not by themselves prove source fidelity.

See [Reference routing](./REFERENCE_ROUTING.md) for the runtime contract and
policy schema. See the
[Terminal Judgment Workbench study](./docs/terminal-judgment-workbench-study-v0.1.ko.md)
for the product meaning, comparative terminal research, transfer boundaries, and
inspection contract behind the Workbench.

## Branches, compaction, and reloads

Routes, judgments, questions, and activation changes are stored in Pi session
entries and replayed from the current branch. A fork therefore inherits only its
own branch history.

Developer leaves compaction to Pi. Current route and recovery metadata are
placed where the normal Pi compactor can preserve them. Configure Pi's
compaction settings if you want an earlier threshold.

Developer restores only the built-in tool changes it owns when a session runtime
shuts down. If a hot reload encounters older Developer history without a safe
release marker, restart the Pi process rather than guessing the user's original
tool configuration.

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

See the [Pi package documentation](https://pi.dev/docs/latest/packages) for
package scope, filtering, pinning, and security behavior.

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

`check` validates package structure and deterministic behavior. `eval` exercises
the real Pi RPC surface without a model. Model-dependent evaluations are
probabilistic and must not be interpreted as proof from a single successful
sample.

The published npm package contains the runtime extension, skills, user-facing
documentation, and license. Source audits, evaluation fixtures, scripts, and
tests remain repository-only maintenance evidence.

## License

[MIT](./LICENSE)
