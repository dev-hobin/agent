#!/bin/sh
# Builds the workspace in the current empty directory: a fix to src/auth is staged,
# an unrelated edit to src/billing is left unstaged and must not be described.
set -eu
git init -q
git config user.name eval
git config user.email eval@example.invalid
mkdir -p src/auth src/billing
cat > src/auth/token.js <<'JS'
export function isExpired(token, now) {
  return token.expiresAt < now;
}
JS
cat > src/billing/invoice.js <<'JS'
export function total(lines) {
  return lines.reduce((sum, line) => sum + line.cents, 0);
}
JS
git add -A
git commit -qm "initial"
cat > src/auth/token.js <<'JS'
// A token that expires exactly now is no longer valid; sessions were kept alive
// for one extra request at the boundary.
export function isExpired(token, now) {
  return token.expiresAt <= now;
}
JS
git add src/auth/token.js
cat >> src/billing/invoice.js <<'JS'

export function lineCount(lines) {
  return lines.length;
}
JS
