import test from 'node:test';
import assert from 'node:assert/strict';
import { approveRefund } from '../src/approve.js';
import { createDeps } from './memory.mjs';

const pending = { id: 'rq-1', orderId: 'or-1', amountCents: 2500, status: 'pending', version: 1 };
const order = { id: 'or-1', paidCents: 10000, refundedCents: 0 };

async function refused(deps, snapshot) {
  await assert.rejects(approveRefund(deps, snapshot));
  assert.equal(deps.issued().length, 0, 'no refund may be issued');
}

test('an amount edited after the snapshot was loaded is not refunded', async () => {
  const deps = createDeps({ request: { ...pending, amountCents: 9000, version: 2 }, order });
  await refused(deps, { ...pending });
  assert.equal(deps.request('rq-1').status, 'pending');
});

test('a request rejected by another agent is not refunded', async () => {
  const deps = createDeps({ request: { ...pending, status: 'rejected', version: 2 }, order });
  await refused(deps, { ...pending });
});

test('a refund larger than what is still refundable is refused', async () => {
  const deps = createDeps({ request: pending, order: { ...order, paidCents: 5000, refundedCents: 4000 } });
  await refused(deps, { ...pending });
  assert.equal(deps.order('or-1').refundedCents, 4000);
});

test('fractional cents are refused rather than rounded', async () => {
  const fractional = { ...pending, amountCents: 1050.5 };
  const deps = createDeps({ request: fractional, order });
  await refused(deps, { ...fractional });
});

test('a double click moves money once and records it once', async () => {
  const deps = createDeps({ request: pending, order });
  await Promise.allSettled([approveRefund(deps, { ...pending }), approveRefund(deps, { ...pending })]);
  assert.equal(deps.issued().length, 1);
  assert.equal(deps.order('or-1').refundedCents, 2500);
  assert.equal(deps.request('rq-1').status, 'approved');
});
