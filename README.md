# Hobin agent resources

English | [한국어](./README.ko.md)

Canonical engineering judgment and source-grounded learning methods maintained
by dev-hobin. Methods follow [Agent Skills](https://agentskills.io/specification);
packages follow [Agent Plugins](https://agent-plugins.org/specification).
Service-specific compatibility is optional and consumes the same originals.

## Why these packages exist

People do not keep every detail in working memory. They retain a small method
for deciding what kind of work is in front of them, then consult specific
material when the situation requires it.

These packages shape agent context in the same way. A Skill carries the durable
working method. Supporting References provide situational detail only when that
detail can change the result. This keeps the active context focused without
reducing every task to one preset or fixed pipeline.

Start with the [standards adoption register](./docs/standards.md) and
[our conditional-reference contract](./docs/skill-references.md). The latter is
our convention, not an additional Agent Skills standard. The register separates
published specifications, conditional candidates, host contracts and our rules.

## Canonical resources

| Location | Purpose |
| --- | --- |
| `packages/*/plugin.json` | Portable package identities: `hobin-developer` and `hobin-learning` |
| [`packages/developer/skills/`](./packages/developer/skills) | 17 engineering judgment Skills and conditional references |
| [`packages/learning/skills/`](./packages/learning/skills) | Five independent reading, repository-study, concept, pattern and practice Skills |
| [`skills/`](./skills) | Four standalone collaboration Skills, outside both package catalogs |
| [`agents/`](./agents) | Optional project-context fragments, not standardized subagent definitions |
| `packages/*/.claude-plugin/plugin.json` | Identity-only legacy Claude compatibility |
| `.claude-plugin/marketplace.json`, `.agents/plugins/marketplace.json` | Host-specific catalogs pointing at the same two package roots |
| `packages/*/adapters/pi/` | Optional existing Pi lifecycle and chooser components |

`@hobin/developer` and `@hobin/learning` are independently distributable npm
packages, not phases of one workflow. There is no shared agent loop, mandatory
policy runtime, or hidden cross-Skill state. The private workspace root is not a
third plugin that recursively loads the package catalogs.

**Version boundary: 0.2.2 adds portable package manifests.** Version 0.2.1 has
only the Claude compatibility descriptors. The native marketplace catalogs live
in this Git repository, not in the individual npm archives; use a checkout
containing them for the native route below. See [0.2.2 release notes](./docs/releases/0.2.2.md),
[0.2.1 notes](./docs/releases/0.2.1.md) and the [0.2.0 migration](./docs/releases/0.2.0.md).

## Install once with the native plugin manager

From any directory, register the **resource checkout**, not a selected work
project. Each manager owns its install/cache settings.

### Claude Code

```sh
claude plugin marketplace add /absolute/path/to/agent --scope user
claude plugin install hobin-developer@hobin-agent --scope user
claude plugin install hobin-learning@hobin-agent --scope user
```

`user` is the default and makes the plugins available across your projects on
this machine. Start a new session or run `/reload-plugins`.

### Codex

```sh
codex plugin marketplace add /absolute/path/to/agent
codex plugin add hobin-developer@hobin-agent
codex plugin add hobin-learning@hobin-agent
```

The native installation persists in user configuration across work directories.
Start a new session. Codex's plugin catalog qualifies Skill names rather than
installing them flat.

| Host | Explicit invocation example |
| --- | --- |
| Claude Code plugin | `/hobin-developer:sketch`, `/hobin-learning:technical-reading` |
| Codex plugin | `$hobin-developer:sketch`, `$hobin-learning:technical-reading` |
| Pi | `/skill:sketch`, `/skill:technical-reading` |

These are host-specific interfaces, not a universal invocation language. See
[installation, release status and exercised evidence](./docs/installation.md)
and [Claude collision boundaries](./docs/claude-plugins.md). Session-only
`--plugin-dir` is for development; it is not the default persistent installation.
No custom consumer installer is provided.

## Portable methods and individual Skills

Instruction-only Skills need neither Pi nor Node.js. Install or expose each
**whole Skill directory**, including supporting files, through any compatible
host's discovery mechanism. This also applies to the four standalone Skills.
An extracted npm package and the checkout contain the same canonical resources.

Flat installation, including an optional common tool such as Vercel Labs'
`skills` CLI, does not create native plugin namespaces. Inspect same-named
entries and overwrite warnings. Native plugin installation does not remove old
flat copies; never blindly delete shared resources another client uses.

Developer reads `references.json` through normal instructions and file access;
Learning embeds generated selection directions in `SKILL.md`. Neither needs a
service-specific reference loader. Actual method selection and adherence remain
model behavior, not properties enforced by the file formats.

## Optional Pi integration

Existing published package installation remains supported:

```sh
pi install npm:@hobin/developer
pi install npm:@hobin/learning
```

From a checkout, use the package roots:

```sh
pi -e ./packages/developer
pi -e ./packages/learning
```

The Pi manifests point at `adapters/pi/`. If you configured an extension's source
path directly, replace `extensions/` with `adapters/pi/`. Package installation
and resource filters such as `"extensions": []` keep working. See the package
READMEs for adapter behavior and controls. These are legacy Pi components, not
claimed portable Agent Plugins client extensions.

## Development and checks

Authoring requires Node.js 22.19+, pnpm 10.33.4, and Python 3.11+ for the pinned
Skill reference validator. These are not instruction-only Skill runtime needs.

```sh
python3 -m venv .venv
. .venv/bin/activate
python -m pip install -r requirements-skills.txt
pnpm install --frozen-lockfile
pnpm check:standard  # Agent Skills and Agent Plugins
pnpm check:portable  # Also policies, negative cases and real packed artifacts
pnpm check:pi
pnpm check
# Optional native, model-free checks with the relevant CLI installed:
pnpm check:claude
pnpm check:install -- claude
pnpm check:install -- codex
```

On Windows activate `.venv\Scripts\activate` using your shell's syntax. Use an
installed Python 3.11+ when creating the environment if the system default is
older. The checker uses `python` from the active environment.

Portable checks can run with only root authoring dependencies:
`pnpm install --filter agent --frozen-lockfile`, then `pnpm check:portable` in the
activated Python environment. CI exercises this separation from Pi and from
Claude/Codex. The upstream plugin schema/license are vendored without changes,
with immutable source and SHA-256 provenance; checks do not download a schema.

The opt-in installation harness uses temporary HOME/config and actual npm packs;
it checks two work directories, native inventories, same-named peer isolation
and installed resource bytes. It does not invoke a model or modify real user
configuration. Structural and model-free integration checks do not prove model
selection quality, security certification or every future client's behavior.
Paid live-model evaluation and publishing require separate authorization.

## License

Repository-owned resources: [MIT](./LICENSE). The unmodified development-time
Agent Plugins schema under [`schemas/upstream/`](./schemas/upstream/agent-plugins/1.0.0)
retains its upstream Apache-2.0 license and attribution.
