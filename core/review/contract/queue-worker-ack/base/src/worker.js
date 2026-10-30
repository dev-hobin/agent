export async function processJob(job, { ledger, notifier }) {
  const receipt = await ledger.credit(job.accountId, job.amount, { idempotencyKey: job.id });
  await notifier.send(job.accountId, `Credited ${job.amount}`);
  return receipt;
}

// Handles one job. The job is acknowledged only after it fully succeeds;
// on failure it is returned to the queue for redelivery.
export async function runOnce({ queue, ledger, notifier, log = () => {} }) {
  const job = queue.receive();
  if (!job) return false;
  try {
    await processJob(job, { ledger, notifier });
    queue.ack(job.id);
  } catch (err) {
    log(`job ${job.id} failed: ${err.message}`);
    queue.nack(job.id);
  }
  return true;
}
