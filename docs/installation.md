# Install the plugins

The repository is one marketplace named `hobin` for both hosts. Register the checkout
once, then install the plugins you use. Each host installs its own implementation:
Claude Code from `claude/plugins/`, Codex from `codex/plugins/`.

## Claude Code

```sh
claude plugin marketplace add /absolute/path/to/agent --scope user
claude plugin install hobin-review@hobin --scope user
claude plugin list --json
```

`user` scope applies across your projects; `project` and `local` scopes are Claude Code
options. Start a new session or run `/reload-plugins`. Skills are namespaced by plugin:

```text
/hobin-review:reviewing-code review this branch against main
/hobin-feature:developing-features add CSV export to the orders page
```

Explicit-only skills set `disable-model-invocation`, so Claude never starts them on its
own. During development, `claude --plugin-dir claude/plugins/<plugin>` loads one plugin
for a single session.

## Codex

```sh
codex plugin marketplace add /absolute/path/to/agent
codex plugin add hobin-review@hobin
codex plugin list --json
```

Start a new session and mention a skill with `$`, for example
`$hobin-review:reviewing-code review this branch against main`. Explicit-only skills set
`policy.allow_implicit_invocation: false` in `agents/openai.yaml`.

## Model-free installation check

```sh
pnpm check:install -- claude
pnpm check:install -- codex
```

The probe creates a temporary HOME and configuration without credentials, installs every
catalog plugin plus a peer plugin with a same-named skill from two work directories,
checks the native inventories, and compares installed skill files with the source. It
sends no model request.

### Evidence recorded on 2026-10-30

| Host | Result |
| --- | --- |
| Claude Code 2.1.314 | All five plugins installed at user scope from both work directories; skill inventories match; installed files match the source |
| Codex CLI 0.165.0 | All five plugins installed; qualified names such as `hobin-review:reviewing-code` listed; a peer `reviewing-code` coexists under another plugin ID |

These are installation observations, not evidence of model behavior; that comes from
each implementation's eval suite.
