# Observer release procedure

This file governs maintainer actions for `@hobin/observer`. It is intentionally excluded from the npm tarball. The public README owns consumer behavior; this file owns source, verification, publication, acknowledgment, and retry order.

## Release invariants

- Publish only an exact, clean commit already visible at the repository/homepage path.
- Treat `npm pack` and `npm publish --dry-run` as packaging evidence, not publication evidence.
- Never bypass `prepublishOnly` or the exact pack allowlist.
- Do not publish with an unexplained high or critical fresh-consumer advisory.
- Never infer permission to push or publish. Both are explicit maintainer effects.
- npm versions are immutable. Never retry by overwriting or silently changing the version.

## 0.1.0 candidate contract

```text
package: @hobin/observer@0.1.0
npm access/tag: public/latest
Node: >=22.19.0
Pi peer: >=0.80.10 <0.83.0
TypeBox peer: ^1.3.6
pack: exactly 41 allowlisted files; no tests or scripts
```

The supported Pi matrix is `0.80.10`, `0.81.1`, and `0.82.1`. Pi `0.79.10` is the lower-bound counterexample: strict peer resolution must reject it before runtime.

## Candidate preparation

From the repository root:

```sh
git status --short
pnpm --filter @hobin/observer check
```

From `packages/observer`:

```sh
npm run release:check
npm publish --dry-run
```

`release:check` must run from a clean tree. It executes the full package check, decodes `npm pack --dry-run --ignore-scripts --json`, and enforces the versioned filename and exact file allowlist.

Inspect the diff from the last verified runtime commit. Release-only preparation must not hide runtime changes.

## Fresh-consumer matrix

Create each consumer under `/tmp`, install the packed candidate with strict peer handling, run the Pi RPC smoke, record exact versions, and remove the consumer in `finally`/`trap` cleanup.

```text
Pi 0.80.10 + supported Node + resolved TypeBox → RPC smoke
Pi 0.81.1  + supported Node + resolved TypeBox → RPC smoke
Pi 0.82.1  + supported Node + resolved TypeBox → RPC smoke
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
npm publish --access public
```

Supply the write-TFA OTP interactively. Do not store it in scripts, logs, or repository files.

## Acknowledgment and retry

Publication is complete only after registry readback and a fresh Pi install:

```sh
npm view @hobin/observer@0.1.0 name version dist-tags dist.integrity --json
pi install npm:@hobin/observer@0.1.0
pi list
```

Run the installed-package RPC smoke from a fresh workspace/config root. Then create and push the release tag only with explicit remote permission.

If publication returns an error:

1. Query the exact version from npm.
2. If the version exists, verify its integrity and continue readback; do not republish.
3. If it does not exist, preserve the same commit/version, fix only the environmental blocker, and rerun all gates before retrying.
4. Never delete, overwrite, or silently bump a public version as recovery.

## Current known gate

The latest fresh supported consumers resolved Pi's `brace-expansion@5.0.7`, which npm reports under a high-severity denial-of-service advisory. Observer does not own that transitive dependency. Candidate preparation may continue, but publication requires either a patched Pi consumer audit or an explicit release-owner acceptance record.
