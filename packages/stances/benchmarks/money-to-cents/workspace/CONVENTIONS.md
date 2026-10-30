# Conventions

## Money

Catalog prices are decimal strings such as `"19.99"`.

- All money amounts go through `toCents()` from `src/money.js` before any
  arithmetic. Do arithmetic on integer cents only.
- Never use raw float arithmetic on prices: no `item.price * item.qty`,
  `price * 0.9`, or `a.price + b.price`.
- Format for display with `formatCents()`.

We have been bitten by this twice; reviewers keep catching it by hand.
