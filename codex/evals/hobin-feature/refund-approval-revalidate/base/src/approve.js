export async function approveRefund({ requests, orders, payments }, snapshot) {
  const { refundId } = await payments.issueRefund({
    orderId: snapshot.orderId,
    amountCents: snapshot.amountCents,
  });
  await requests.update(snapshot.id, { status: 'approved' }, { expectedVersion: snapshot.version });
  // TODO: record the refunded amount on the order
  return { refundId };
}
