#!/bin/sh
# Builds the workspace in the current empty directory: doc comments are added in
# three directories under src/, so the message must have no scope.
set -eu
git init -q
git config user.name eval
git config user.email eval@example.invalid
mkdir -p src/auth src/billing src/mail
printf 'export function isExpired(token, now) {\n  return token.expiresAt <= now;\n}\n' > src/auth/token.js
printf 'export function total(lines) {\n  return lines.reduce((sum, line) => sum + line.cents, 0);\n}\n' > src/billing/invoice.js
printf 'export function subject(user) {\n  return `Hello ${user.name}`;\n}\n' > src/mail/welcome.js
git add -A
git commit -qm "initial"
for f in src/auth/token.js src/billing/invoice.js src/mail/welcome.js; do
  { printf '/** Public API; keep the signature stable. */\n'; cat "$f"; } > "$f.tmp" && mv "$f.tmp" "$f"
done
git add -A
