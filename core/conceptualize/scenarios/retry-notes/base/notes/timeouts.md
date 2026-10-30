# Payouts marked FAILED that went through

Context: the payout service calls a bank transfer endpoint with a 5 second
timeout. The dashboard showed every timed-out transfer as FAILED.

What happened: support staff re-sent "failed" transfers by hand. Several
recipients were paid twice.

Observation: the bank's status endpoint later showed most of those transfers
as completed. A timeout means we stopped waiting, not that the bank stopped
working.

Change: timed-out transfers now show UNKNOWN, and nobody may re-send one until
the status endpoint has been checked.
