[P0] Job is acknowledged before processing finishes, so a crash or exhausted retries drop it — src/worker.js:16
  Scenario: the ledger throws three times → retry gives up, the job is already acked and removed, and the credit never happens.
  Evidence: runOnce calls queue.ack(job.id) before retry(...); queue.ack deletes the in-flight job (src/queue.js:13).
  Direction: ack only after processJob succeeds; nack on final failure.
[P1] Each retry uses a fresh idempotency key, so a credit followed by a failed notify is applied twice — src/worker.js:6
  Scenario: ledger.credit succeeds, notifier.send throws → retry calls credit again with a new randomUUID() key and the account is credited twice.
  Evidence: the key is created inside processJob on every attempt; src/ledger.js returns the stored receipt only for a repeated key, contradicting the comment on line 5.
  Direction: derive the key from the job id once, before the first attempt.

Checked without findings: structure, data-loss
Not checked: production queue redelivery settings
