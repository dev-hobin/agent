# Developer user guide

English | [한국어](./ko/user-guide.md)

## Turn Developer on and off

```text
/developer on
/developer off
```

`on` opens a Developer v8 work scope and enables protocol-aware built-in tool
gating. `off` refuses to close while a change authorization is active. Otherwise
it settles any active Skill invocation as lifecycle cancellation and closes the
scope. Persisted `developer.runtime` entries remain on their Pi session branch.

Start Pi with Developer enabled:

```sh
pi --developer
```

## Ask normally

You do not need to know Route or Skill identifiers:

```text
Add scheduled invoice delivery. Ask before editing if a product rule is missing.
```

```text
The serializer replacement passes its tests. Verify persisted values and source
compatibility before calling it complete.
```

You may still invoke an owning capability directly:

```text
/skill:model Define replacement and default semantics for this config change.
/skill:sketch Shape the interface for the accepted requirement.
/skill:verify Decide whether the current checks support completion.
```

## Commands

| Command | Effect |
| --- | --- |
| `/developer` | Open the compact progress overlay in TUI mode; press `d` for audit receipts |
| `/developer status` | Show the current phase, completed milestones, and next user-relevant step |
| `/developer questions` | Compatibility alias for the receipt summary |
| `/developer settings` | Compatibility alias for the receipt summary |
| `/developer on` | Open a work scope |
| `/developer off` | Close the current scope when no authorization is active |

Pi's normal `/skill:<name>` commands remain available.

## Progress and audit overlay

The overlay is read-only. Its default progress view shows the current phase,
completed milestones, and next user-relevant step without hashes, opaque IDs, or
receipt inventory. Press `d` to enter audit mode. Audit mode binds the exact
receipt projection that was current when opened and reads at most one bounded
page at a time.

| Key | Action |
| --- | --- |
| `d` | Switch between progress and audit details |
| `↓`, Page Down, Enter | In audit mode, read the next page through its opaque cursor |
| `↑`, Page Up | In audit mode, return through the exact retained previous cursor |
| `g` | In audit mode, return to the first page |
| `r` | Refresh progress or re-read the audit cursor |
| `y` | Copy the current semantic view |
| Escape | Close |

If the projection changes while audit mode is open, refresh or reopen it to bind
the new projection. Height-limited rendering reports omitted receipt entries
explicitly. Navigation and copy never append runtime events.

## How a frame progresses

```text
stable RouteDefinition
-> exact RouteFrame and obligations
-> finite descriptor snapshot
-> optional owning Skill invocation
-> returned candidate support
-> explicit frame-local admission
-> explicit obligation discharge
-> guarded frame conclusion
```

Any Route may be the first or last semantic movement. There is no fixed
`specify -> model -> sketch -> verify` pipeline. A frame may also conclude with
zero Skill invocations when current admitted non-Skill support is sufficient.

When an answer or evidence item is missing, the frame remains open or records a
targeted blocker. Developer does not convert absence into approval. Supply the
answer or acquire the evidence, then conclude against the current frame and
blocker identities.

## Implementation and verification

A change authorization is valid only for one replay-current concluded frame and
one bounded movement. Built-in shell, edit, and write stay withheld until that
authorization. Developer captures a Git baseline at authorization and requires
the landing's reported paths to match the observed authorized delta exactly.
Recording the landing consumes authority and creates two distinct follow-up
identities:

- a `reroute-decision` frame decides what belongs next;
- a `verification-decision` frame decides what the landing evidence supports.

The required purpose is shown to the model before every continuation and the
runtime rejects an out-of-order purpose. Both debts must conclude before another
authorization is available. A passing command is evidence for only the claim it
actually exercises.

## Branches, replay, and reload

A fork uses only its own ancestry. Scope sequence and hash-chain identity, not
timestamps, order runtime events. Rejected entries do not advance replay state.

Developer projects receipts only from replay-accepted events. Cursors, pages,
publications, reconstruction values, and mutation capabilities are process-local
and fail closed when cloned or stale.

If hot reload cannot prove prior tool ownership from a safe lifecycle marker,
Developer requests a Pi restart and writes no reconciliation event. It never
guesses which tools to re-enable.

## Update and remove

```sh
pi update npm:@hobin/developer
pi remove npm:@hobin/developer
```

Use `pi install -l npm:@hobin/developer` for a project-local installation.
