# Reading insights: Shard Lease Protocol (draft 2)

## Source scope

`docs/lease-spec.md`, "Shard Lease Protocol (draft 2)", all sections §1–§6.
Source type: specification (operational intent: defines a contract between
workers, coordinator, and storage).

Source intent: make the reader see that a lease alone does not keep a shard
safe; the storage check on the fencing token does.

## Insight 1: Safety lives in storage, not in the worker

- **Faithful claim or model** (source claim): every write carries the fencing
  token of its lease (§4.1); storage rejects a write whose token is lower than
  the highest it has accepted for that shard (§4.2); §4.3 says rule 4.2 is "the
  only rule that protects shard data".
- **Insight** (interpretation): the protocol splits two jobs. Timing rules
  (§3.2 renew at half TTL, §3.3 stop writing after TTL) are an optimisation
  that makes stale writes rare. Correctness comes from a monotonic number
  checked at the place where the damage would happen.
- **Source evidence:** §4.3 states the split directly; §5 explains why the
  worker cannot be trusted to know it is stale.
- **Example or contrast:** worker A acquires the lease with token 7, then
  pauses in a long garbage collection. The coordinator grants the lease to
  worker B with token 8, and B writes. A resumes, still believes it holds the
  lease, and writes with token 7. Storage has already accepted 8, so it rejects
  A's write (§4.2). Without the token check, A's write would overwrite B's.
- **Boundary / likely misreading:** "renew early and stop at TTL, and we are
  safe" is the tempting reading of §3. §4.3 rules it out: §3 only reduces how
  often a stale worker tries to write.
- **Practical consequence:** in the design review, ask of every storage path
  "does this write carry and check the token?" A path that skips it (a cache,
  a side table, a second storage system) is unprotected no matter how good
  the renewal logic is.
- **Evidence level:** source claim for §4.1–4.3; interpretation for the
  "optimisation vs correctness" split.

## Insight 2: Local clocks decide when to stop, not whether you may write

- **Faithful claim or model** (source claim): TTL is measured on the
  coordinator's clock (§2); workers measure renewal and stop times on their
  local clock from the moment they sent `Acquire` (§3.2, §3.3). §5: a paused
  worker may resume believing it still holds the lease.
- **Insight** (interpretation): measuring from the send time, not the
  receive time, makes the worker err towards stopping early. This is
  deliberate pessimism, but it still cannot cover a pause the worker cannot
  see.
- **Source evidence:** §3.2 "measured on its local clock from the moment it
  sent `Acquire`"; §5 "its local clock may not show that time has passed in
  the way the coordinator saw it".
- **Example or contrast:** a virtual machine suspended for 40 s with a 30 s
  TTL resumes; its process may not observe the gap before its next write.
- **Boundary / likely misreading:** the spec does not claim that local timing
  is useless, only that it is not enough (§5 title).
- **Practical consequence:** tests for this protocol should include a paused
  worker scenario, not only network delays.
- **Evidence level:** source claim for §3 and §5; hypothesis for "send time
  was chosen to err early" (the spec does not state the reason).

## Unresolved question

- §6: should storage reject an equal token from a different worker? With
  only "lower than" rejected, two writers holding the same token are not
  distinguished. Whether that can happen depends on the coordinator, which the
  spec does not define.
- §6: no clock drift bounds are given, so the margin in §3.2 cannot be
  checked.

## Handoff

- Possible concept for conceptualize: "check validity where the effect lands,
  not where the decision is made" (needs other sources to test transfer).
