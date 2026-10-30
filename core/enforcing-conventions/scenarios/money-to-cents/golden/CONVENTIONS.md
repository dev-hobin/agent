# Conventions

## Money

Catalog prices are decimal strings such as `"19.99"`. Convert them with `toCents()` from
`src/money.js`, do arithmetic on integer cents, and format with `formatCents()`.
`npm run check` enforces this (`scripts/check-money.mjs`).
