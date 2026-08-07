# Developer Terminal Judgment Workbench Study and Adoption Contract

English | [한국어](./ko/terminal-judgment-workbench-study-v0.1.md)

> Status: Developer 0.1.15 product and UX baseline
>
> Purpose: a public implementation study and adoption contract for aligning Developer from a Settings-centered command panel to a branch-aware judgment workbench
>
> Studied: 2026-07-30

## 1. Product essence

Developer is neither a Skill list nor an automatic planner.

> Developer is a judgment control surface that binds questions, judgments, evidence, change permission, and verification obligations to the current branch during Pi's software-change process.

Its core flow is:

```text
notice consequential uncertainty
→ route one judgment question
→ state the required evidence or user decision
→ permit only justified change
→ require observation and verification after change
→ preserve judgment history on the current branch
```

A user must always be able to inspect:

1. What is being judged now?
2. Why is this judgment necessary?
3. Who must resolve each Question?
4. What work is currently permitted?
5. What changed, and what verification remains?
6. Through which judgments did the current branch reach this state?

## 2. Research question and scope

Research question:

> How should a branch-aware judgment system present Routes, Questions, Judgments, Landings, and History in a terminal so users do not misunderstand state or available actions?

| Project | Studied slice | Developer correspondence |
| --- | --- | --- |
| OpenCode | session route, Permission, Question, command palette, footer | live Route, gate, focused answer, contextual action |
| Aider | ask/code mode, diff, undo, map, slash grammar | mutation authority, landing scope, command boundary |
| Jujutsu | operation log, `--at-op`, restore/revert | branch history, historical inspection, append-only recovery |
| Bubble Tea | Model/Update/View, focus, help, quit filter | pure projection, focus ownership, contextual help |
| Lazygit | selection → detail → action → refresh | judgment inspection, stale-action prevention |
| K9s | live-state home, command accelerator, history | Workbench root, navigation memory |
| Textual | screen stack, modal, scrollable container | route stack, modal input boundary, scoped scroll |
| Claude Code | permission mode, Plan approval, interactive diff | supporting comparison for authority visibility and stale diffs |

Studied revisions:

- OpenCode `1e17856ba4b5b052650c8115060852f3f023844e`
- Aider `5dc9490bb35f9729ef2c95d00a19ccd30c26339c`
- Jujutsu `6a591f0da9f09c2c60ad62af07e6a764850adc05`
- Bubble Tea `fc707bb7ea0161405bb6c653ec93f6a9c6a72fe1`
- Lazygit `df0943ad334d1d3626b42057aad4b69324da3516`
- K9s `436ea2e9f23c5dd2d8e05c3e974220657524ef17`
- Textual `06dbeef4bb70fb718236aa418ed658ef4667a126`

Claude Code is not publicly implemented, so only official documentation available at the study date was used as supporting evidence.

## 3. OpenCode

OpenCode keeps the current session as home and treats commands as accelerators. UI routes remain separate from session domain state.

Evidence:

- [route context](https://github.com/anomalyco/opencode/blob/1e17856ba4b5b052650c8115060852f3f023844e/packages/tui/src/context/route.tsx)
- [session surface](https://github.com/anomalyco/opencode/blob/1e17856ba4b5b052650c8115060852f3f023844e/packages/tui/src/routes/session/index.tsx)
- [command palette](https://github.com/anomalyco/opencode/blob/1e17856ba4b5b052650c8115060852f3f023844e/packages/tui/src/component/command-palette.tsx)

The command palette selects commands reachable from current context and exposes suggested commands separately. A keybinding and slash name may point to the same action, but the command surface is not home.

When a Permission or Question is pending, the ordinary prompt is hidden or disabled. Permission precedes Question and distinguishes `once`, `always`, and `reject`. `always` adds confirmation; edit Permission displays a diff and expands fullscreen when needed.

Evidence:

- [permission prompt](https://github.com/anomalyco/opencode/blob/1e17856ba4b5b052650c8115060852f3f023844e/packages/tui/src/routes/session/permission.tsx)
- [question prompt](https://github.com/anomalyco/opencode/blob/1e17856ba4b5b052650c8115060852f3f023844e/packages/tui/src/routes/session/question.tsx)
- [footer](https://github.com/anomalyco/opencode/blob/1e17856ba4b5b052650c8115060852f3f023844e/packages/tui/src/routes/session/footer.tsx)

Adopt in Developer:

- Keep current Route and Questions as primary home objects.
- Let the Question answer surface own focus.
- Compress pending counts in the footer and inspect full content in the Workbench.
- Keep Workbench navigation routes separate from persisted Developer state.

Do not adopt:

- Do not force every Question into a modal.
- Do not add fixed manual modes such as plan/build.
- Do not duplicate Pi's conversation timeline.

## 4. Aider

Aider distinguishes `ask`, `code`, `architect`, and `context` modes and displays the current mode in the prompt. `/ask question` applies a different mode to one request, while argument-free `/ask` changes the sticky mode.

Evidence:

- [chat mode](https://github.com/Aider-AI/aider/blob/5dc9490bb35f9729ef2c95d00a19ccd30c26339c/aider/commands.py#L138)
- [ask/code/architect](https://github.com/Aider-AI/aider/blob/5dc9490bb35f9729ef2c95d00a19ccd30c26339c/aider/commands.py#L1182-L1229)

`/diff` scopes from the commit before the last interaction. `/undo` checks whether Aider created the commit in the current chat, whether it is a merge, whether files are dirty, and whether it has already been pushed.

Evidence:

- [diff](https://github.com/Aider-AI/aider/blob/5dc9490bb35f9729ef2c95d00a19ccd30c26339c/aider/commands.py#L657-L690)
- [undo](https://github.com/Aider-AI/aider/blob/5dc9490bb35f9729ef2c95d00a19ccd30c26339c/aider/commands.py#L553-L655)

Adopt in Developer:

- Make current mutation authority ambiently identifiable.
- Anchor Landing inspection with movement, stop, and verifier.
- Separate Settings from current work state.
- Use ordinary `/root action` slash-command grammar.

Do not adopt:

- Developer does not own automatic commits or undo.
- Users do not pin a Skill or implementation mode.
- Developer does not reproduce a repository map internally.

## 5. Jujutsu

A Jujutsu operation is more than a log line: it has a repository view after the operation, parents, timestamp, user, host, and description.

Evidence: [operation log](https://github.com/jj-vcs/jj/blob/6a591f0da9f09c2c60ad62af07e6a764850adc05/cli/docs/operation-log.md)

Historical inspection and recovery are separate:

```text
jj --at-op=<id> st/diff/log → inspection
jj op restore <id>          → recover through a new operation
jj op revert <id>           → invert through a new operation
```

Restore and revert add operations instead of deleting history.

Evidence:

- [operation restore](https://github.com/jj-vcs/jj/blob/6a591f0da9f09c2c60ad62af07e6a764850adc05/cli/src/commands/operation/restore.rs)
- [operation revert](https://github.com/jj-vcs/jj/blob/6a591f0da9f09c2c60ad62af07e6a764850adc05/cli/src/commands/operation/revert.rs)

Because `jj op log` may snapshot a working copy or reconcile divergent operations, mutation-free inspection requires `--at-op=@ --ignore-working-copy`.

Evidence: [operation log command](https://github.com/jj-vcs/jj/blob/6a591f0da9f09c2c60ad62af07e6a764850adc05/cli/src/commands/operation/log.rs#L47-L115)

Adopt in Developer:

- Show the Route, basis, reference provenance, and artifact associated with each historical Judgment.
- Historical inspection must not add a session entry or focus event.
- Any future recovery feature must append an event rather than rewrite history.

Do not adopt:

- Do not add general undo/restore to the Developer protocol.
- Do not merge histories from other Pi branches into a global log.

## 6. Bubble Tea, Textual, Lazygit, and K9s

Bubble Tea separates UI into `Model → Update(event) → View`. The focused child handles input; keybindings activate according to state; short and full help adapt to terminal width.

Evidence:

- [help example](https://github.com/charmbracelet/bubbletea/blob/fc707bb7ea0161405bb6c653ec93f6a9c6a72fe1/examples/help/main.go)
- [split editors](https://github.com/charmbracelet/bubbletea/blob/fc707bb7ea0161405bb6c653ec93f6a9c6a72fe1/examples/split-editors/main.go)
- [composable views](https://github.com/charmbracelet/bubbletea/blob/fc707bb7ea0161405bb6c653ec93f6a9c6a72fe1/examples/composable-views/main.go)
- [quit interception](https://github.com/charmbracelet/bubbletea/blob/fc707bb7ea0161405bb6c653ec93f6a9c6a72fe1/examples/prevent-quit/main.go)

Textual lets a modal block underlying screen bindings and assigns scrolling to the focused container. Lazygit preserves selection → detail → contextual action → refresh and prevents actions on stale details. K9s keeps live resource state as home, uses commands as accelerators, and provides Esc history.

Adopt in Developer:

```text
DeveloperState + runtime facts
→ pure Workbench projection
→ ephemeral route/focus/scroll
→ explicit existing effects
→ fresh projection
```

- Only the focused pane handles input and scrolling.
- The contextual footer shows only currently available actions.
- `?` exposes full help.
- Revalidate the current ID immediately before an action.
- Do not enable raw terminal mouse mode until Pi provides a scoped lifecycle.

## 7. Cross-project conclusions

```text
1. Current domain state is home.
2. A command is an accelerator, not home.
3. When a gate opens, its input surface owns focus.
4. Separate inspection from mutation.
5. History shows state and provenance at that time.
6. Show only actions valid for the current selection and state.
7. Keep navigation state separate from domain history.
8. Read a fresh projection after an action and discard stale context.
9. The footer favors ambient state and contextual actions over a feature catalog.
10. Settings is a secondary surface.
```

## 8. Developer information architecture

```text
Overview
Active Route
Questions
Judgments
Landings
Settings
```

Do not flatten Evidence into an independent section. Attach it to the question or claim it supports: known evidence on Active Route, Judgment and reference basis, or Landing artifacts.

A Landing combines a `target === implementation` Judgment with that Route's implementation contract. The current event schema cannot link a specific verification Judgment to a specific Landing, so it must not infer a per-Landing `Verified` state. The Workbench shows only current-branch verification debt.

## 9. Command contract

Canonical Action Loop command surface:

```text
/developer
/developer status
/developer settings
/developer pause
/developer wait
/developer block
/developer resume
/developer on
/developer off
pi --developer
```

Do not register the old `/develop`, `--develop`, colon-style commands, or the removed question/route compatibility surface. Activation uses closed `developer.mode/v1` events, while Work Case continuity uses closed Action Loop replay events.

## 10. Safety and verification contract

Opening, closing, navigating, or inspecting Workbench history must not cause:

```text
appendEntry
sendUserMessage
setActiveTools
filesystem write
model request
```

A Question action revalidates that its Question ID remains open on the current branch. Settings Off retains the existing confirmation. Render verification covers keyboard navigation, full-detail scrolling, help input isolation, and Korean/Unicode alignment at minimum sizes `40×18`, `80×22`, and `120×36`.
