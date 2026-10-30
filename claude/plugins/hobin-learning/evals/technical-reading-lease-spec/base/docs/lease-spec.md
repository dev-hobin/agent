# Shard Lease Protocol (draft 2)

This document is synthetic example material for a reading exercise.

## 1. Purpose

A shard is processed by at most one worker at a time. Workers coordinate
through a lease stored in the coordinator. This document defines how a worker
acquires, renews, and gives up a lease, and what the storage layer must do to
keep a shard consistent when a worker loses its lease without noticing.

## 2. Terms

- **Lease**: a grant from the coordinator that lets one worker process one
  shard until the lease expires.
- **TTL**: the lease duration, measured by the coordinator's clock.
- **Fencing token**: an integer the coordinator returns with every grant.
  Each new grant for a shard returns a token greater than any token issued
  before for that shard.

## 3. Acquiring and renewing

3.1 A worker acquires a lease by calling `Acquire(shard)`. On success the
coordinator returns the TTL and a fencing token.

3.2 A worker SHOULD renew the lease after half of the TTL has passed, measured
on its local clock from the moment it sent `Acquire`.

3.3 A worker MUST stop issuing writes for a shard once the TTL has passed on
its local clock, even if it has not received an error.

## 4. Storage rules

4.1 Every write to shard storage MUST carry the fencing token of the lease
under which it was made.

4.2 Storage MUST reject a write whose token is lower than the highest token
it has accepted for that shard.

4.3 Rule 4.2 is the only rule that protects shard data. Rules 3.2 and 3.3
reduce how often a stale worker tries to write; they do not prevent it.

## 5. Why local timing is not enough

A worker can pause for longer than the TTL, for example during a long garbage
collection or when its virtual machine is suspended. When it resumes, its
local clock may not show that time has passed in the way the coordinator saw
it, and it may still believe it holds the lease. Meanwhile the coordinator has
granted the lease to another worker. Only the storage, by comparing tokens,
can see that the resumed worker is stale.

## 6. Open items

- Whether storage should also reject writes with an equal token from a
  different worker is not yet decided.
- Clock drift bounds between workers and the coordinator are not specified.
