import test from 'node:test';
import assert from 'node:assert/strict';
import { approveRefund } from '../src/approve.js';
import { createDeps } from '../fakes/memory.js';

const request = { id: 'rq-1', orderId: 'or-1', amountCents: 2500, status: 'pending', version: 1 };
const order = { id: 'or-1', paidCents: 10000, refundedCents: 0 };

test('approving issues the refund and marks the request approved', async () => {
  const deps = createDeps({ request, order });
  const { refundId } = await approveRefund(deps, { ...request });
  assert.ok(refundId);
  assert.equal(deps.issued().length, 1);
  assert.equal(deps.issued()[0].amountCents, 2500);
  assert.equal(deps.request('rq-1').status, 'approved');
});

test('approving records the refunded amount on the order', async () => {
  const deps = createDeps({ request, order });
  await approveRefund(deps, { ...request });
  assert.equal(deps.order('or-1').refundedCents, 2500);
});
