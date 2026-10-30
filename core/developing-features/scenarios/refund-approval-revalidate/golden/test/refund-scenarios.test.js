import test from 'node:test';
import assert from 'node:assert/strict';
import { approveRefund } from '../src/approve.js';
import { createDeps } from '../fakes/memory.js';

const snapshot = { id: 'rq-1', orderId: 'or-1', amountCents: 2500, status: 'pending', version: 1 };
const order = { id: 'or-1', paidCents: 10000, refundedCents: 0 };

async function assertRefused(deps, loaded) {
  await assert.rejects(approveRefund(deps, loaded));
  assert.equal(deps.issued().length, 0, 'no money moved');
  assert.equal(deps.order('or-1').refundedCents, order.refundedCents);
}

test('S1 approving a current request refunds once and records it', async () => {
  const deps = createDeps({ request: snapshot, order });
  const { refundId } = await approveRefund(deps, { ...snapshot });
  assert.ok(refundId);
  assert.equal(deps.issued().length, 1);
  assert.equal(deps.order('or-1').refundedCents, 2500);
  assert.equal(deps.request('rq-1').status, 'approved');
});

test('S2 an amount edited after the snapshot is refused before paying', async () => {
  const deps = createDeps({ request: { ...snapshot, amountCents: 9000, version: 2 }, order });
  await assertRefused(deps, { ...snapshot });
  assert.equal(deps.request('rq-1').status, 'pending');
});

test('S3 a request another agent rejected is refused', async () => {
  const deps = createDeps({ request: { ...snapshot, status: 'rejected', version: 2 }, order });
  await assertRefused(deps, { ...snapshot });
});

test('S4 a missing request is refused', async () => {
  const deps = createDeps({ request: { ...snapshot, id: 'rq-other' }, order });
  await assertRefused(deps, { ...snapshot });
});

test('S5 more than the refundable remainder is refused', async () => {
  const deps = createDeps({ request: snapshot, order: { ...order, paidCents: 3000, refundedCents: 1000 } });
  await assert.rejects(approveRefund(deps, { ...snapshot }));
  assert.equal(deps.issued().length, 0);
  assert.equal(deps.order('or-1').refundedCents, 1000);
});

test('S6 fractional cents are refused, not rounded', async () => {
  const fractional = { ...snapshot, amountCents: 1050.5 };
  const deps = createDeps({ request: fractional, order });
  await assertRefused(deps, { ...fractional });
});

test('S7 a double click moves money once and records it once', async () => {
  const deps = createDeps({ request: snapshot, order });
  await Promise.allSettled([approveRefund(deps, { ...snapshot }), approveRefund(deps, { ...snapshot })]);
  assert.equal(deps.issued().length, 1);
  assert.equal(deps.order('or-1').refundedCents, 2500);
  assert.equal(deps.request('rq-1').status, 'approved');
});
