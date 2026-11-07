[P0] A job that fails after the early step is lost for good — src/worker.js:16

  Scenario: the ledger throws three times → retry gives up, but the job was already acknowledged and removed from the queue, so the credit never happens.

  Evidence: runOnce calls queue.ack(job.id) before retry(...); queue.ack deletes the in-flight job (src/queue.js:13).

  Direction: settle the job only after processJob succeeds; nack on final failure.

[P1] A failed notify makes the next attempt credit the account again — src/worker.js:6

  Scenario: ledger.credit succeeds, notifier.send throws → retry calls credit with a new randomUUID() key and the account is credited twice.

  Evidence: the key is created inside processJob on every attempt; src/ledger.js returns the stored receipt only for a repeated key.

  Direction: derive the key from the job id once, before the first attempt.

Checked without findings: structure, data-loss
Not checked: production queue redelivery settings
