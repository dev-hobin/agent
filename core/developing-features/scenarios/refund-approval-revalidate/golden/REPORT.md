# Refund approval

## Scenarios

| ID | Then | Last result |
| --- | --- | --- |
| S1 | A current pending request refunds once, is approved, and the order records the amount | pass |
| S2 | An amount edited after the snapshot is refused before any money moves | pass |
| S3 | A request another agent rejected is refused | pass |
| S4 | A missing request is refused | pass |
| S5 | More than the refundable remainder is refused | pass |
| S6 | Fractional cents are refused, not rounded | pass |
| S7 | A double click moves money once and records it once | pass |

Each check is `node --test --test-name-pattern '^S<n> ' test/refund-scenarios.test.js`;
the full record is `acceptance-scenarios.json`.

## Owner decisions

The owner could not be reached, so every open question got the conservative, reversible
default. Every refusal happens before `issueRefund`, the step that cannot be undone.

- **D1 Stale snapshot.** Decision: re-read the request right before paying and refuse
  unless it is still `pending` at the snapshot's version. Reason: the agent must refund
  what they reviewed. Revert: in `src/approve.js`, compare only amount and status instead
  of the version.
- **D2 Earlier partial refunds.** Decision: refuse when the amount exceeds
  `paidCents - refundedCents` on a fresh read of the order. Reason: refunding more than
  was paid moves money that is not owed. Revert: remove that check, or cap the amount.
- **D3 Double click.** Decision: claim the request (`pending` to `processing`, version
  checked) before paying, and use `refund-request:<id>` as the idempotency key. Reason:
  only one approval can claim the version; the provider deduplicates the key. Revert:
  drop the claim and rely on the key alone.
- **D4 Fractional cents.** Decision: refuse, never round. Reason: rounding changes the
  money moved without a decision. Revert: `Math.round` the amount before the checks.

## Checks run

- `npm test`: 9 tests, 0 failures.
- Independent re-check of every scenario command and the existing suite: no must-fix items.

## Not verified

- A crash between `issueRefund` and the final updates leaves the request in `processing`;
  retrying with the same idempotency key is safe, but nothing retries it automatically yet.
- The real payment provider's idempotency window; only the fake was exercised.
