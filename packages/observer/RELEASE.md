# Observer release procedure

This file governs maintainer actions for `@hobin/observer`. It is intentionally excluded from the npm tarball. The public README owns consumer behavior; this file owns source, verification, publication, acknowledgment, and retry order.

## Release invariants

- Publish only an exact, clean commit already visible at the repository/homepage path.
- Treat `pnpm pack` and `pnpm publish --dry-run` as packaging evidence, not publication evidence.
- Never bypass `prepublishOnly` or the exact pack allowlist.
- Do not publish with an unexplained high or critical fresh-consumer advisory.
- Never infer permission to push or publish. Both are explicit maintainer effects.
- npm versions are immutable. Never retry by overwriting or silently changing the version.

## 0.1.6 candidate contract

```text
package: @hobin/observer@0.1.6
npm access/tag: public/latest
Node: >=22.19.0
Pi peer: >=0.80.10 <0.84.0
TypeBox peer: ^1.3.6
pack: exactly 59 allowlisted files; no tests or scripts
```

The supported Pi matrix is `0.80.10`, `0.81.1`, `0.82.1`, and `0.83.0`.
Pi `0.79.10` is the lower-bound counterexample: strict peer resolution must
reject it before runtime. Pi 0.83 coverage includes bundled TypeBox 1.3.7
compiled validation of Observer's nullable tool arguments and session-scoped
local-model selection.

## Candidate preparation

From the repository root:

```sh
git status --short
pnpm --filter @hobin/observer check
```

From `packages/observer`:

```sh
pnpm run release:check
pnpm publish --dry-run
```

`release:check` must run from a clean tree. It executes the full package check, runs `pnpm pack`, and enforces the versioned filename, exact file allowlist, absence of bundled dependencies, and the packed manifest rewrite from `workspace:^0.1.0` to `^0.1.0`. Run it through the repository's pinned pnpm workspace with the default isolated linker.

Inspect the diff from the last verified runtime commit. Release-only preparation must not hide runtime changes.

## Fresh-consumer matrix

Create each consumer under `/tmp`, install the packed candidate with strict peer handling, run the Pi RPC smoke, record exact versions, and remove the consumer in `finally`/`trap` cleanup.

```text
Pi 0.80.10 + supported Node + resolved TypeBox → RPC smoke
Pi 0.81.1  + supported Node + resolved TypeBox → RPC smoke
Pi 0.82.1  + supported Node + resolved TypeBox → RPC smoke
Pi 0.83.0  + supported Node + bundled TypeBox 1.3.7 → RPC + compiled tool-schema smoke
Pi 0.79.10 + strict peer handling             → ERESOLVE
```

At minimum, the smoke must discover the package and exercise setup, status, on, Memo stutter, and off. Reuse the already bounded Golden Path evidence for runtime semantics only when the release diff contains no runtime or extension source change.

Run a production dependency audit in a fresh supported consumer:

```sh
npm audit --omit=dev --audit-level=high
```

A high or critical finding stops publication unless the release owner explicitly records the affected dependency path, impact, scope, rationale, and acceptance. “Upstream” alone is not acceptance.

## Source integration

The feature-branch candidate is not publishable while the advertised main-branch path is absent.

```text
rebase/merge current origin/main
→ resolve and verify
→ rerun release:check and the fresh-consumer matrix
→ obtain explicit permission to push
→ push the exact source commit
→ confirm the repository/homepage path is readable
```

Do not reuse pre-integration digests as integrated-commit evidence.

## Publication boundary

Publication is an irreversible, user-owned effect. Immediately before it:

```sh
npm whoami
npm profile get --json
npm view @hobin/observer version --json
```

For the first release, registry E404 is expected only if scope ownership and authentication have already been verified. Check registry state again before any retry.

With explicit publication approval and all gates green:

```sh
pnpm publish --access public
```

Supply the write-TFA OTP interactively. Do not store it in scripts, logs, or repository files.

## Acknowledgment and retry

Publication is complete only after registry readback and a fresh Pi install:

```sh
npm view @hobin/observer@0.1.6 name version dist-tags dist.integrity --json
pi install npm:@hobin/observer@0.1.6
pi list
```

Run the installed-package RPC smoke from a fresh workspace/config root. Then create and push the release tag only with explicit remote permission.

If publication returns an error:

1. Query the exact version from npm.
2. If the version exists, verify its integrity and continue readback; do not republish.
3. If it does not exist, preserve the same commit/version, fix only the environmental blocker, and rerun all gates before retrying.
4. Never delete, overwrite, or silently bump a public version as recovery.

## Current known gate

Rechecked on 2026-08-02 in a fresh consumer with the packed Judgment `0.1.0`
and Observer `0.1.6` candidates, Pi/TUI `0.83.0`, and TypeBox `1.3.7`.
`npm audit --omit=dev --audit-level=high` reported one high vulnerability and
zero critical vulnerabilities:

- advisory: `GHSA-mh99-v99m-4gvg`, unbounded brace expansion can cause an
  out-of-memory denial of service;
- resolved path: `@earendil-works/pi-coding-agent@0.83.0`
  → `minimatch@10.2.5` → `brace-expansion@5.0.7`;
- source of the stale resolution: Pi `0.83.0` publishes an `npm-shrinkwrap.json`
  that pins `brace-expansion@5.0.7`, even though `minimatch` accepts `^5.0.5`
  and patched `5.0.9` is available;
- Observer does not own or execute this transitive dependency directly.

Candidate preparation may continue. Publication remains gated until Pi publishes
a patched shrinkwrap or the release owner explicitly records acceptance of this
transitive risk.

## Release-owner acceptance for 0.1.6

The release owner explicitly accepted this transitive risk on
`2026-08-02T23:48:17Z` for `@hobin/observer@0.1.6` only.

- accepted by: `dev-hobin`;
- approval provenance: explicit release-owner instruction during the `0.1.6`
  release-preparation session;
- runtime candidate commit: `9fecaae5cd7a60b03e3f725163d96066f3dd5870`;
- accepted advisory: `GHSA-mh99-v99m-4gvg` through Pi's pinned
  `brace-expansion@5.0.7`;
- observed impact: a crafted glob can exhaust memory in the Pi host process;
- Observer boundary: Observer neither imports `minimatch` nor supplies the
  affected package or model-scope patterns;
- package-owned graph: an audit excluding host-owned peers reported zero high
  or critical vulnerabilities;
- rejected mitigations: an Observer direct dependency, consumer root override,
  and `npm audit fix` all left Pi's nested `5.0.7` unchanged;
- upstream status: Pi main commit
  `f0deb8dd8e9611e89b5bc4145ca92c03ae6ed4ee` pins patched `5.0.8`, but npm
  `0.83.0` still contains the vulnerable shrinkwrap;
- control result: replacing only the published Pi shrinkwrap entry with the
  upstream patched version produced a fresh-consumer audit with zero high or
  critical vulnerabilities.

The owner accepts the residual host-process denial-of-service risk because it is
pre-existing in the supported Pi host, Observer introduces no additional call
path, the package-owned graph is clean, and an upstream fix already exists. This
acceptance satisfies the publication gate only for Observer `0.1.6`; it must not
be reused for another Observer or Pi version. Re-run the fresh-consumer audit on
the next release and remove this exception once a patched Pi package is
published.
