# Hobin agent resources

English | [한국어](./README.ko.md)

Canonical engineering judgment and source-grounded learning methods maintained
by dev-hobin. Skills follow the [Agent Skills specification](https://agentskills.io/specification);
service-specific integration is optional and consumes the same original bundles.

## Why these packages exist

People do not keep every detail in working memory. They retain a small method
for deciding what kind of work is in front of them, then consult specific
material when the situation requires it.

These packages shape agent context in the same way. A Skill carries the durable
working method. Supporting References provide situational detail only when that
detail can change the result. This keeps the active context focused without
reducing every task to one preset or fixed pipeline.

Start with [standards and adoption boundaries](./docs/standards.md) and
[our conditional-reference contract](./docs/skill-references.md). The latter is
our own convention, not an additional Agent Skills standard.

## Canonical resources

| Location | Purpose |
| --- | --- |
| [`packages/developer/skills/`](./packages/developer/skills) | 17 engineering judgment Skills and conditional references |
| [`packages/learning/skills/`](./packages/learning/skills) | Five independent Skills for reading, repository study, concepts, patterns, and practice |
| [`skills/`](./skills) | Four standalone collaboration Skills, outside both package catalogs |
| [`agents/`](./agents) | Reviewable context fragments to select and merge into project instructions, not standard subagent definitions |
| `packages/*/adapters/pi/` | Optional Pi lifecycle and chooser integration |

`@hobin/developer` and `@hobin/learning` remain independently distributable npm
packages. They are not phases of one workflow. There is no shared agent loop,
mandatory policy runtime, or hidden cross-Skill state.

## Use with an Agent Skills host

Install or expose the **whole Skill directory**, including its supporting files,
in a location your host discovers. Do not copy only `SKILL.md`. An extracted npm
package's `skills/` directories and this checkout's directories are the same
canonical resources; Node.js and Pi are not required to read them.

Host-specific examples, not universal discovery rules:

| Host | Personal Skill directory | Explicit invocation example |
| --- | --- | --- |
| [Claude Code](https://code.claude.com/docs/en/skills) | `~/.claude/skills/<name>/` | `/sketch` |
| [Codex](https://developers.openai.com/codex/skills/) | `~/.agents/skills/<name>/` | `$sketch` |
| Pi | Native Skill paths or the package manifest below | `/skill:sketch` |

For local authoring, hosts supporting symlinked Skill directories can point at
these originals. For distribution, copy complete bundles and pin the package or
repository version. Check for existing same-named Skills before installing;
updates must not overwrite someone else's resources. This repository does not
modify your global agent configuration or provide a universal installer.

References load through normal Skill instructions and file access. Developer can
read `references.json` without a hook; Learning embeds generated selection
directions in `SKILL.md`. Neither requires service-specific reference-loading
code. Actual model selection and adherence remain behavioral, not enforced by
the file format.

## Optional Pi integration

Existing package installation remains supported:

```sh
pi install npm:@hobin/developer
pi install npm:@hobin/learning
```

From a checkout, use the package directory, not the private workspace root:

```sh
pi -e ./packages/developer
pi -e ./packages/learning
```

The package manifests now point at `adapters/pi/`. If you previously configured
an extension's source path directly, replace `extensions/` with `adapters/pi/`.
Package-based installation and resource filters such as `"extensions": []` keep
working. See each package README for adapter behavior and resource control.

## Development

Authoring requires Node.js 22.19+, pnpm 10.33.4, and Python 3.11+ for the pinned
upstream reference validator. These are not requirements of instruction-only
Skills. Create a local virtual environment with a suitable Python executable:

```sh
python3 -m venv .venv
. .venv/bin/activate
python -m pip install -r requirements-skills.txt
pnpm install --frozen-lockfile
pnpm check:portable
pnpm check:pi
# Or both:
pnpm check
```

On Windows, activate `.venv\Scripts\activate` using the syntax for your shell.
If your default Python is older than 3.11, use an installed newer executable
when creating the environment. The reference checker uses `python` from the
active environment.

Portable checks can be run without installing Pi development dependencies:
`pnpm install --filter agent --frozen-lockfile`, followed by
`pnpm check:portable` in the activated Python environment. CI exercises this
separation. Pi checks use a full workspace installation.

Checks are provider-free. Structural validity, artifact preservation, and Pi
integration do not prove live-model selection quality or support by every future
agent service. Live-model qualification is separate and opt-in.

## License

[MIT](./LICENSE)
