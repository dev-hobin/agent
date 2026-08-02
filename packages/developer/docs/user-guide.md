# Developer user guide

English | [한국어](./ko/user-guide.md)

## Turn Developer on and off

```text
/developer on
/developer off
```

`on` enables judgment tracking and built-in mutation-tool gating. If a judgment
or unresolved question is still open, `off` asks before clearing the current
Developer state. Historical events remain on their Pi session branch.

Start Pi with Developer already enabled:

```sh
pi --developer
```

## Ask normally

You do not need to know the internal Skill or protocol names:

```text
Add scheduled invoice delivery. Ask before editing if a product rule is missing.
```

```text
The serializer replacement passes its tests. Verify persisted values and source
compatibility before calling it complete.
```

If you already know which Skill owns the question, invoke it directly:

```text
/skill:model Define replacement and default semantics for this config change.
/skill:sketch Shape the interface for the accepted requirement.
/skill:verify Decide whether the current checks support completion.
```

## Commands

| Command | Effect |
| --- | --- |
| `/developer` | Open the Workbench |
| `/developer status` | Inspect current state and legal next operations |
| `/developer questions` | Inspect, answer, or investigate pending questions |
| `/developer settings` | Open activation settings |
| `/developer on` | Enable Developer |
| `/developer off` | Disable Developer after confirmation when needed |

Pi's normal `/skill:<name>` commands remain available.

## What the Workbench shows

| View | Contents |
| --- | --- |
| Overview | Current state, implementation/completion gates, next operation |
| Active Judgment | Question, selected material, contributions, conflicts, limitations |
| Questions | Questions owned by the user, agent, or environment |
| Judgments | Completed outcomes and their sealed context basis |
| Landings | Authorization, changed paths, and verification target |
| Settings | Developer activation |

Keyboard controls:

| Key | Action |
| --- | --- |
| `↑` / `↓`, `j` / `k` | Move |
| Enter | Open the selected item |
| Escape | Go back |
| Tab | Move between regions |
| Page Up / Page Down | Scroll by viewport |
| Home / End | Jump to the beginning or end |
| `y` | Copy the complete selected record |
| `?` | Show help for the current view |

Opening, reading, and copying Workbench records does not change state.

## Who answers a question?

`/developer questions` shows each question's owner and gate.

| Owner | Example |
| --- | --- |
| User | “Should the choice persist after returning to checkout?” |
| Agent | “Where in the code path is the value lost?” |
| Environment | “Can the staging API be observed with current credentials?” |

The model cannot answer a user-owned question on the user's behalf. Agent-owned
questions are resolved through repository or runtime evidence. Environment-owned
questions may require access or external state.

Gates mean:

- `before implementation`: no change authorization until resolved;
- `before completion`: a landing may exist, but completion remains blocked;
- `non-blocking`: remains visible without stopping current movement.

## Common workflows

### Ambiguous bug

```text
reproduce current behavior
-> record missing product rule as a user question
-> receive user answer
-> authorize bounded change
-> edit and test
-> record landing
-> verify
```

### Already-specified local change

When requirement, location, and verification are all exact, Developer does not
open a judgment merely for ceremony. It can authorize the bounded change and
verify only the changed claim after landing.

### Read-only Doctor review

```text
/skill:doctor Diagnose checkout from request to persistence.
Preserve external behavior and return a now / next / observe / leave-alone plan.
```

Doctor separates requested, inspected, and claimed scope. It does not present a
sample as an exhaustive repository review.

## What each routing state means

| State | Required next work |
| --- | --- |
| `idle` | No active Developer work; not a claim that the whole request is done |
| `needs-judgment` | Current question needs an outcome |
| `needs-evidence` | Agent or environment evidence is missing |
| `needs-answer` | A user decision is missing |
| `needs-routing` | A landing needs its next judgment |
| `needs-verification` | Changed artifacts need claim-relative verification |
| `blocked` | A required answer, fact, or access is unavailable |

## Branches and reload

A fork uses only its own ancestry. Tool results and user answers from a sibling
branch cannot be selected into the current judgment.

Developer supplies bounded state during Pi compaction. If a hot reload reports
that the previous tool state cannot be recovered safely, restart Pi. Developer
does not guess which tools should be re-enabled.

## Update and remove

```sh
pi update npm:@hobin/developer
pi remove npm:@hobin/developer
```

Use `pi install -l npm:@hobin/developer` for a project-local installation.
