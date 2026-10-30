# Approve refunds from the review queue

Support agents open the review queue, which loads a snapshot of each refund
request: `{ id, orderId, amountCents, status, version }`. Clicking
**Approve** calls `approveRefund(deps, snapshot)` in `src/approve.js`.

Approving must:

1. issue the refund through the payment provider,
2. mark the request `approved`,
3. add the amount to the order's `refundedCents`.

`approveRefund` resolves to `{ refundId }`. When approval is refused for any
reason it rejects with an `Error` and leaves the request and order unchanged.

## Dependencies (all async)

- `requests.get(id)` -> `{ id, orderId, amountCents, status, version }` or
  `undefined`. `status` is `pending`, `approved` or `rejected`.
- `requests.update(id, patch, { expectedVersion })` -> updated record with
  `version + 1`. Rejects if the stored version differs from `expectedVersion`.
- `orders.get(id)` -> `{ id, paidCents, refundedCents }`;
  `orders.update(id, patch)`.
- `payments.issueRefund({ orderId, amountCents, idempotencyKey })` ->
  `{ refundId }`. This moves real money and cannot be undone. The provider
  returns the original result for a repeated `idempotencyKey`.

## Open questions (product owner unavailable this week)

1. The queue snapshot can be minutes old. Customers can edit the amount and
   other agents can approve or reject the same request in the meantime.
2. Another partial refund may have been issued on the order since the
   request was created.
3. Agents double-click Approve.
4. Requests imported from the old CSV tool can have fractional cents.

Make a decision for each, record it, and say how to change it later.
