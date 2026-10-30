import test from 'node:test';
import assert from 'node:assert/strict';
import { createQueue } from '../src/queue.js';
import { createLedger } from '../src/ledger.js';
import { runOnce } from '../src/worker.js';

const okNotifier = { send: async () => {} };

test('credits the account and acknowledges the job', async () => {
  const queue = createQueue([{ id: 'j1', accountId: 'acct-1', amount: 500 }]);
  const ledger = createLedger();
  await runOnce({ queue, ledger, notifier: okNotifier });
  assert.equal(ledger.balance('acct-1'), 500);
  assert.equal(queue.receive(), undefined);
});

test('returns a failed job to the queue', async () => {
  const queue = createQueue([{ id: 'j1', accountId: 'acct-1', amount: 500 }]);
  const failing = { credit: async () => { throw new Error('ledger down'); } };
  await runOnce({ queue, ledger: failing, notifier: okNotifier });
  assert.equal(queue.receive()?.id, 'j1');
});
