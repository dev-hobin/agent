# Developer operating principles

English | [한국어](./ko/how-it-works.md)

This document describes mechanism rather than command order: how Developer
reconstructs current state, projects legal protocol operations and built-in tool
access from that state, and keeps judgment separate from mutation authority.

The central separation is between two lanes:

```text
judgment: question → sealed evidence → contribution coverage → conclusion
mutation: bounded authorization → file change → landing → verification debt
```

A conclusion in the judgment lane is not authority in the mutation lane. The
only bridge is an explicit `AuthorizedChange` created by Developer.

## 1. Branch events, not a mutable singleton, are the state source

Developer does not retain one mutable state object and patch it in command
handlers. It reads `developer/v7` entries from the current Pi branch ancestry,
parses each exact event variant, and applies it to the pure
`transitionDeveloper()` function in order.

`DeveloperState` is an immutable replay projection:

```text
enabled
+ activeWork: ActiveJudgment | AuthorizedChange | none
+ completed judgments
+ completed landings
+ pending questions
+ focused question
+ obligations:
    rerouteRequired
    implementationFramingRequired
    verificationRequired
```

Raw tool input is parsed into a protocol value first. The extension appends an
event to the Pi session only after the transition accepts it. The normal write
path therefore cannot create a session event that the state machine itself
rejects.

Replay stops interpreting later Developer entries after a malformed v7 event or
an illegal transition and reports a diagnostic. Historical v6 entries remain in
the session but are never guessed into v7 meaning.

## 2. State projects the next operations and tool access

Commands do not toggle arbitrary tools. `developerNextOperations(state)` and
`developerToolAccess(state)` derive legal protocol tools and built-in capability
access from the immutable state.

| Current projection | Legal protocol operations | `bash` | Built-in `edit` and `write` |
| --- | --- | --- | --- |
| Disabled | None | Pi's prior state | Pi's prior state |
| Enabled, no active work | Open judgment; authorize if gates allow | Withheld | Withheld |
| `ActiveJudgment` | Open external context; conclude judgment | Available | Withheld |
| `AuthorizedChange` | Record landing | Available | Available |
| Obligations after landing | Open next judgment | Withheld | Withheld |

The tool policy controls only source-identified built-ins named `bash`, `edit`,
and `write`. An extension tool with the same name is not mistaken for a built-in.
Developer remembers only built-ins it actually withheld, so disabling Developer
does not enable a tool the user had already disabled.

This is a Pi workflow gate, not an operating-system sandbox. `bash` can mutate
files depending on the command, and other extensions retain their own authority.
Developer enforces only its protocol operations and activation of those three
built-in tools.

## 3. Exactly one active work item exists at a time

`activeWork` holds either one `ActiveJudgment` or one `AuthorizedChange`. An
overlap or reused work identity is rejected.

This prevents a circular history in which the model edits while investigating
and then silently treats its own edit as pre-existing evidence. During a
judgment there is no artifact-tool authority. During an authorized change, a
second judgment cannot overlap before the authorization is consumed by a
landing.

Developer does not require a judgment for every task. If the requirement,
movement, stable result, and verification target are already exact and no gate
blocks implementation, idle state may create an `AuthorizedChange` directly.

## 4. A Skill owns a question; it is not a workflow phase

`developer_open_judgment` selects one Skill whose method owns the current
question. `specify` owns product meaning, `model` owns condition space, `sketch`
owns implementation surface, and `verify` owns the relation between claims and
observed evidence.

Selecting a Skill is neither a conclusion nor entry into a mandatory phase.
Developer does not force every request through `specify → model → sketch →
verify`.

If another installed Skill can help, `developer_open_context_sources` opens only
its exact Pi-visible Skill ID. The external Skill is a provider of method,
optional policy, and references:

- it does not replace the current question owner;
- it does not start another Judgment workflow;
- its filesystem root and policy identity remain source-local;
- it cannot contribute positively before applicability is established; and
- it cannot grant mutation authority.

## 5. Developer uses Judgment as its evidence engine

For an `ActiveJudgment`, Developer inventories only material that can be
recovered on the current branch. Context files, the owning Skill method,
nominated external Skills, tool results, and user events may become candidates.

The model nominates exact source IDs. Developer rechecks tool-call identity,
arguments, result order, status, branch, and content hash. Judgment reacquires
and atomically seals selected material, then checks each material's contribution,
conflict, limitation, and assurance.

The conclusion event stores a compact `DeveloperContextBasis` binding:

- Judgment/question and owner-policy identities;
- opened provider descriptor, policy, and applicability identities;
- selection and sealed-content identities;
- material contributions, conflicts, and limitations; and
- coverage and outcome identities.

The context basis is not a copy of every source byte. It is a domain record that
makes the exact content-and-relation basis replayable. A conclusion whose basis
does not match the active judgment contract is rejected.

## 6. A PendingQuestion makes uncertainty operational

If missing evidence exists only in prose, the next operation can forget it.
Developer represents unresolved work as a `PendingQuestion` with both an owner
and a gate.

| Property | Value | Meaning |
| --- | --- | --- |
| `owner` | `user` | Product decision or explicit acceptance is required |
| | `agent` | Repository, test, runtime, or documentation evidence is required |
| | `environment` | Credentials, external system state, or access is required |
| `gate` | `before-implementation` | Blocks change authorization |
| | `before-completion` | Allows landing but blocks completion |
| | `none` | Remains visible without blocking current movement |

A conclusion event may create, answer, block, or reopen questions only through
exact question and work identities. Agent evidence cannot close a user-owned
question on the user's behalf.

## 7. Obligations are derived by transitions, not command convention

Developer carries follow-up work as state obligations:

- a contextual `model` conclusion sets `implementationFramingRequired`;
- a valid `sketch` or `signal` conclusion can clear that framing obligation;
- every landing sets `rerouteRequired` and `verificationRequired`; and
- only a contextual `verify` conclusion with no remaining gated question clears
  `verificationRequired`.

A good condition model therefore may still be insufficient to authorize a code
representation. Conversely, Developer does not add an unnecessary Skill when
implementation framing is already established.

## 8. Authorization is a capability for one bounded movement

`developer_authorize_change` constructs one immutable value containing:

- the bounded movement to perform;
- the stable landing expected afterward;
- the verification target;
- an optional revert or refinement boundary; and
- an optional PendingQuestion target.

The transition requires no active work, no before-implementation gate, no
implementation-framing obligation, and a valid target question. Only then does
the tool projection make built-in `edit` and `write` available.

An authorization is not repository-wide capability. The built-in tools are not
path-level sandboxes, so the model and adapter must still compare actual changed
paths and later evidence with the authorized movement.

## 9. Landing consumes authorization and creates verification debt

`developer_record_landing` receives the active authorization ID and actual
changed paths. A missing or different authorization is rejected.

An accepted landing performs these changes together:

1. removes the authorization from `activeWork`;
2. stores the authorization and landing as a completed pair;
3. sets `rerouteRequired`;
4. sets `verificationRequired`; and
5. projects mutation tools back to withheld.

A landing is therefore not completion. It is provenance saying that these paths
changed under this authorization, while the claim that the movement succeeded
remains unverified.

## 10. Verify is a separate judgment about claims

After landing, a `verify` judgment asks what current tests, diagnostics, and
runtime observations actually support. It does not merely ask whether code now
exists.

For a checkout restoration bug, distinct claims need distinct evidence:

| Claim | Example evidence needed |
| --- | --- |
| A valid choice is restored after navigation | Test or observation through the actual navigation path |
| Invalid persisted values follow the existing fallback | Explicit invalid-value case |
| No sibling-branch result was substituted | Current-branch source identity |
| Related untouched paths still work | Relevant regression checks |

A successful test command need not support all four claims. Verification debt is
cleared only when the `verify` conclusion and remaining gated-question state
support the required scope.

## 11. Tool ownership is not guessed across hot reload

The runtime tracks which built-ins it withheld through lifecycle markers and
local memory. If a reload cannot safely reconstruct that ownership, Developer
asks for a Pi restart instead of arbitrarily enabling or disabling tools.

This is deliberately conservative: preserving another extension's or the
user's tool state is more important than guessing a convenient recovery.
