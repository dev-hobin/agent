[P0] Job is acknowledged before processing finishes, so a crash or exhausted retries drop it — src/worker.js:12
[P1] Each retry uses a fresh idempotency key, so a credit followed by a failed notify is applied twice — src/worker.js:20
