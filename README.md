# Hobin agent resources

English | [한국어](./README.ko.md)

Agent skills for code review, feature development, engineering stances, skill evaluation,
and learning, maintained by dev-hobin. Each capability is specified once in `core/`
and implemented separately for Claude Code and for Codex, each in that host's own
recommended form.

## How it is organized

```text
core/<id>/                 the interface: SPEC.md, knowledge, scripts, assets,
                           acceptance scenarios (and trigger sets)
claude/plugins/<plugin>/   Claude Code implementation (skills, agents, evals for claude plugin eval)
codex/plugins/<plugin>/    Codex implementation (plugin.json, skills, agents/openai.yaml)
codex/evals/               plugin-eval benchmarks for the Codex implementations
.agents/skills/implementing-core/   applies a spec change to both implementations
```

The specs promise observable outcomes and prove each acceptance scenario with a golden
result. Each implementation declares how strongly it meets every promise on its host
(enforced, instructed, or unsupported) and is evaluated with that host's own tools.

## Plugins

| Plugin | Skills | Use |
| --- | --- | --- |
| `hobin-review` | `reviewing-code` | Review a diff, branch, or pull request, or diagnose a named scope; reports verified P0/P1 defects only |
| `hobin-feature` | `developing-features` | Build a non-trivial feature through acceptance scenarios, owner decisions, design, slices, and verification |
| `hobin-stances` | `applying-stances`, `enforcing-conventions` | Install short stances into agent instructions; turn repeatedly broken rules into checks |
| `hobin-skill-eval` | `evaluating-skills` | Structure, regression, and benchmark evaluations for any agent skill |
| `hobin-learning` | `technical-reading`, `opensource-reading`, `conceptualize`, `patternize`, `exercise` | Source-grounded study and practice |

## Install

Register this repository once as the `hobin` marketplace, then install what you use.

```sh
# Claude Code
claude plugin marketplace add /absolute/path/to/agent --scope user
claude plugin install hobin-review@hobin --scope user
# Codex
codex plugin marketplace add /absolute/path/to/agent
codex plugin add hobin-review@hobin
```

Start a new session after installing. Agents pick a skill when the request fits it;
start one yourself with `/hobin-review:reviewing-code` in Claude Code or
`$hobin-review:reviewing-code` in Codex. In Codex, trust the bundled hooks with `/hooks` so the
result checks run automatically, and trust them again after each plugin update: Codex runs no
untrusted hook. Without them hobin-feature has no session registry, so its `scenarios.mjs` stops
and says the hooks are not active. See
[installation](./docs/installation.md).

## Changing a capability

Edit `core/<id>/SPEC.md` (and its resources), then run `/implementing-core <id>`.
`pnpm check` fails until both implementations follow the new spec.

## Development and checks

Requires Node.js 22.19+, pnpm 10.33.4, and Python 3.11+ for the pinned Agent Skills
validator.

```sh
python3 -m venv .venv
. .venv/bin/activate
python -m pip install -r requirements-skills.txt
pnpm install --frozen-lockfile
pnpm check                      # standards, core vs implementations, eval suites (no models)
pnpm check:claude               # claude plugin validate --strict
pnpm check:install -- claude    # isolated install, no credentials, no models
pnpm check:install -- codex
```

Live host checks call a small model and are opt-in. They check hobin-feature's Stop gate with the
plugin's hooks really running, the same way on both hosts: a session runs `scenarios.mjs init`
(also for a record in another directory, by absolute path), which registers the record in the
session registry the hooks created, and Stop must send it back; a session that registers a complete
record must be let through; `init` run after `cd` away from the start directory must stop with the
"no registry" message. Codex plugin-eval never installs the plugin, so this is the gate's only check
on Codex.

```sh
pnpm check:live -- claude                                         # claude -p --plugin-dir; ~/.claude is not changed
pnpm check:live -- codex --codex-home ~/.cache/hobin-live-codex   # codex plugin add, then codex exec (workspace-write, approval never)
```

The Codex check never reads or copies `~/.codex`. It needs a dedicated Codex home that you log in
to with ChatGPT once (subscription billing; `CODEX_API_KEY` and `OPENAI_API_KEY` are removed from
its environment):

```sh
mkdir -m 700 ~/.cache/hobin-live-codex
touch ~/.cache/hobin-live-codex/.hobin-live-codex-home   # marks it as dedicated: each run clears it except auth.json
printf 'cli_auth_credentials_store = "file"\n' > ~/.cache/hobin-live-codex/config.toml
CODEX_HOME=~/.cache/hobin-live-codex codex login      # add --device-auth without a browser
```

That directory holds a credential as sensitive as a password: keep it out of any repository and do
not share it. Each run uses it in place (Codex writes refreshed tokens back to its `auth.json`), one
run at a time (a lock file), after clearing everything but `auth.json` and the credentials-store
line of `config.toml`. When the home is missing, is `~/.codex`, has no marker file, has loose
permissions, lacks that line, or is not a ChatGPT login, the check prints these steps and exits 2 as skipped, not passed.

Host evaluations call models and cost money:

```sh
claude plugin eval claude/plugins/<plugin> --tag regression --ablation none --scaffold \
  --allow-tools Bash Write Edit --model sonnet --runs 3 --trust-plugin --no-publish --keep-temp
```

hobin-feature needs no extra flags: its records are made with `scenarios.mjs` in the shell
(`Bash` is granted above), and the eval runs its hooks, which create the session registry.

`--keep-temp` keeps what a failed run needs for diagnosis. The JSON result names each run's
`tracePath`. The run's workspace is `../sealed/home/cwd` next to that trace; `chmod u+rx` the
`sealed` directory to read it. Rerun the failed check there, such as the hidden tests.

Codex benchmarks use OpenAI's `plugin-eval`; see
`.agents/skills/implementing-core/references/codex.md`. plugin-eval never installs the plugin
(it is listed as available only), so no plugin hook runs there: a run measures the skill alone,
and hobin-feature's Stop gate is checked by `pnpm check:live -- codex`.

## License

Repository-owned resources: [MIT](./LICENSE). The unmodified Agent Plugins schema under
[`schemas/upstream/`](./schemas/upstream/agent-plugins/1.0.0) keeps its upstream
Apache-2.0 license and attribution.
