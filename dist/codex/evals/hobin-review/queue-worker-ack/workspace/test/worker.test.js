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
  assert.equal(queue.pendingCount(), 0);
  assert.equal(queue.inFlightCount(), 0);
});

test('retries a transient ledger failure', async () => {
  const queue = createQueue([{ id: 'j1', accountId: 'acct-1', amount: 500 }]);
  const ledger = createLedger();
  let calls = 0;
  const flaky = {
    credit: async (...args) => {
      calls += 1;
      if (calls === 1) throw new Error('timeout');
      return ledger.credit(...args);
    },
  };
  await runOnce({ queue, ledger: flaky, notifier: okNotifier });
  assert.equal(ledger.balance('acct-1'), 500);
});

test('logs a job that keeps failing instead of redelivering it forever', async () => {
  const queue = createQueue([{ id: 'j1', accountId: 'acct-1', amount: 500 }]);
  const failing = { credit: async () => { throw new Error('ledger down'); } };
  const lines = [];
  await runOnce({ queue, ledger: failing, notifier: okNotifier, log: (l) => lines.push(l) });
  assert.match(lines[0], /j1 failed after retries/);
  assert.equal(queue.pendingCount(), 0);
});
