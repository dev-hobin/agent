#!/bin/sh
# Builds the workspace in the current empty directory: the public export
# formatPrice in src/billing is renamed to formatAmount, and the rename is staged.
set -eu
git init -q
git config user.name eval
git config user.email eval@example.invalid
mkdir -p src/billing
cat > src/billing/format.js <<'JS'
export function formatPrice(cents) {
  return (cents / 100).toFixed(2);
}
JS
cat > src/billing/invoice.js <<'JS'
import { formatPrice } from './format.js';

export function describe(line) {
  return `${line.name}: ${formatPrice(line.cents)}`;
}
JS
git add -A
git commit -qm "initial"
sed 's/formatPrice/formatAmount/' src/billing/format.js > src/billing/format.tmp && mv src/billing/format.tmp src/billing/format.js
sed 's/formatPrice/formatAmount/g' src/billing/invoice.js > src/billing/invoice.tmp && mv src/billing/invoice.tmp src/billing/invoice.js
git add -A
