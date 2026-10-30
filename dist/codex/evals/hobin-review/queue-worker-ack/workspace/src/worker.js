import { randomUUID } from 'node:crypto';
import { retry } from './retry.js';

export async function processJob(job, { ledger, notifier }) {
  // The ledger rejects a reused key, so every call gets a fresh one.
  const receipt = await ledger.credit(job.accountId, job.amount, { idempotencyKey: randomUUID() });
  await notifier.send(job.accountId, `Credited ${job.amount}`);
  return receipt;
}

// Handles one job. Ack first so a slow job is not redelivered to another
// worker while it is still running; transient failures are retried in place.
export async function runOnce({ queue, ledger, notifier, log = () => {}, delayMs = 0 }) {
  const job = queue.receive();
  if (!job) return false;
  queue.ack(job.id);
  try {
    await retry(() => processJob(job, { ledger, notifier }), { delayMs });
  } catch (err) {
    log(`job ${job.id} failed after retries: ${err.message}`);
  }
  return true;
}
