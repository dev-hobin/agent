// Owner decisions (each refusal rejects before any money moves):
// 1. Stale snapshot: re-read the request; refuse unless status is pending and
//    version equals the snapshot's. Revert: compare fields instead of version.
// 2. Over-refund: refuse when amount > paidCents - refundedCents (fresh order).
// 3. Double click: claim the request (pending -> processing) with a version
//    check before paying; the idempotency key is the request id.
// 4. Fractional cents: refuse; never round. Revert: Math.round before checks.
export async function approveRefund({ requests, orders, payments }, snapshot) {
  const fresh = await requests.get(snapshot.id);
  if (!fresh || fresh.status !== 'pending' || fresh.version !== snapshot.version) {
    throw new Error('refund request changed since it was loaded; reload and review again');
  }
  if (!Number.isInteger(fresh.amountCents) || fresh.amountCents <= 0) {
    throw new Error('refund amount must be a positive whole number of cents');
  }
  const currentOrder = await orders.get(fresh.orderId);
  if (!currentOrder || fresh.amountCents > currentOrder.paidCents - currentOrder.refundedCents) {
    throw new Error('refund exceeds the refundable amount');
  }
  const claimed = await requests.update(fresh.id, { status: 'processing' }, { expectedVersion: fresh.version });
  const { refundId } = await payments.issueRefund({
    orderId: fresh.orderId,
    amountCents: fresh.amountCents,
    idempotencyKey: `refund-request:${fresh.id}`,
  });
  const latestOrder = await orders.get(fresh.orderId);
  await orders.update(fresh.orderId, { refundedCents: latestOrder.refundedCents + fresh.amountCents });
  await requests.update(fresh.id, { status: 'approved', refundId }, { expectedVersion: claimed.version });
  return { refundId };
}
