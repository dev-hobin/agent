<!-- output-contract: technical-reading-insights -->

# Reading insights: Shard Lease Protocol (draft 2)

## Source scope

[docs/lease-spec.md](../docs/lease-spec.md), **Shard Lease Protocol (draft 2)**, §§1–6, read in full. The document identifies itself as synthetic example material. This is a source-bound design-review aid, not implementation verification.

**Source reconstruction:** The spec defines lease acquisition, worker timing obligations, and storage rejection rules intended to keep shard data consistent when a worker fails to notice lease loss.

**Interpretation of its learning purpose:** Carry forward the ability to identify where stale writes are actually rejected, distinguish scheduling advice from protection, and test the stated purpose against the precise rejection predicate. A summary saying “leases and fencing prevent concurrent writes” would hide the conditions that matter in review.

## Source terms

The following definitions are copied verbatim from §2, with line wrapping normalized:

- **Lease**: a grant from the coordinator that lets one worker process one shard until the lease expires.
- **TTL**: the lease duration, measured by the coordinator's clock.
- **Fencing token**: an integer the coordinator returns with every grant. Each new grant for a shard returns a token greater than any token issued before for that shard.

## Insight 1: Review storage enforcement separately from worker compliance

- **Faithful claim or model — source claim:** Every write MUST carry its lease's Fencing token. Storage MUST reject a token lower than the highest token it has accepted for that shard. The spec explicitly says this storage rule alone protects shard data; renewal and stopping rules reduce stale write attempts but do not prevent them.
- **Source evidence:** §§4.1–4.3; §5 explains how a paused worker can resume believing its Lease is still valid.
- **Insight — interpretation:** Treat the storage write boundary as the central review target. Correct worker behavior is required, but evidence that workers obey timers is insufficient evidence for the spec's data-protection claim.
- **Example or contrast — illustrative interpretation:** Worker A pauses with token 7. Worker B receives token 8 and storage accepts a write carrying 8. When A resumes and sends 7, §4.2 requires rejection even if A believes it still holds a Lease.
- **Boundary / likely misreading:** Fencing does not stop A from executing or sending requests. The stated rule covers shard storage writes; the document provides no protection contract for other side effects.
- **Practical consequence — interpretation:** Ask reviewers to trace every shard write to token enforcement, including the state recording the highest accepted token. Request a paused-worker scenario demonstrating rejection after a higher token is accepted. Ask whether concurrent check-and-write operations preserve §4.2.
- **Evidence level:** Source claim for the requirements and failure scenario; interpretation for the review priority, numbered example, and proposed validation.

## Insight 2: A new grant is not the same event as storage accepting a higher token

- **Faithful claim or model — source claim:** The coordinator issues increasing Fencing tokens for each shard, but storage compares against the highest token it has **accepted**, not the highest token the coordinator has **issued**.
- **Source evidence:** §2, Fencing token; §§3.1 and 4.2. Compare the broad purpose in §1 with the exact predicate in §4.2.
- **Insight — interpretation:** The specified rejection condition establishes an ordering boundary at storage acceptance. It does not establish immediate rejection of an old token at lease expiration or at a new grant. This is a limitation of what the text establishes, not evidence of a particular implementation bug.
- **Example or contrast — illustrative interpretation:** Storage's highest accepted token is 7. A's Lease expires; B acquires token 8 but has not written. A sends a delayed write carrying 7. Rule 4.2 does not require rejecting it because 7 is not lower than 7. Once storage accepts 8, a later write carrying 7 must be rejected. Other rejection rules could exist, but the draft does not specify them.
- **Boundary / likely misreading:** “Not required to reject” does not mean “required to accept.” Likewise, §1's statement that a shard is processed by at most one worker at a time should not be treated as a demonstrated guarantee of non-overlapping execution: §5 explicitly allows a stale worker to resume while another holds a Lease.
- **Practical consequence — interpretation:** Bring the before-first-write trace to the review. Ask what “consistent” and “processed by at most one worker” must mean: ordered storage effects, exclusive execution, or rejection immediately upon lease loss. Require the chosen guarantee to be reconciled with §4.2 before treating the purpose as established.
- **Evidence level:** Source claim for the two distinct token events and comparison rule; interpretation for the trace, guarantee boundary, and review question.

## Insight 3: Preserve the timing obligations without assuming a complete renewal protocol

- **Faithful claim or model — source claim:** A worker SHOULD renew after half the TTL, measured locally from when it sent `Acquire`. It MUST stop issuing writes once the TTL has passed on its local clock, even without an error. TTL itself is measured by the coordinator's clock. Pauses can make the worker's view differ from the coordinator's; clock drift bounds are unspecified.
- **Source evidence:** §2, TTL; §§3.2–3.3; §5; §6's clock-drift open item.
- **Insight — interpretation:** Distinguish an early-renewal recommendation from a mandatory stop condition, and distinguish both from storage protection. The initial renewal reference point is explicit, but the rules for successful and failed renewal are incomplete.
- **Example or contrast — illustrative interpretation:** With a returned TTL of 10 seconds and an `Acquire` send time of local t=0, §3.2 points to renewal around local t=5, not five seconds after the response. A response arriving at t=4 leaves roughly one second before that recommended renewal point. This is local scheduling arithmetic, not proof that coordinator and worker expiry agree.
- **Boundary / likely misreading:** Half-TTL renewal is SHOULD, not MUST. A local deadline is not a proof that a stale worker cannot write. The draft does not explicitly define the starting reference for §3.3 or how a successful renewal changes it; importing §3.2's reference into all later deadlines would be an interpretation.
- **Practical consequence — interpretation:** Ask for a renewal timeline covering delayed responses, timeout or failure, and successful renewal. Require an explicit deadline reference and reset rule, and clarify whether renewal preserves the Fencing token or constitutes a new grant. Keep storage enforcement necessary in all cases.
- **Evidence level:** Source claim for timing language and missing drift bounds; interpretation for the numeric example, identified ambiguities, and requested clarification.

## Unresolved question

**Explicitly open in the source (§6):**

- Whether storage should also reject writes with an equal token from a different worker.
- Clock drift bounds between workers and the coordinator.

**Additional review questions derived from the text — interpretation, not source requirements:**

1. **What exact guarantee is intended?** Resolve the gap between §1's purpose and the before-first-write case in Insight 2. Which stale effects are acceptable, if any?
2. **How is §4.2 maintained under concurrency and recovery?** Specify how the highest accepted token survives failures and how comparison, token-state update, and the write relate. The draft states the rule but supplies no mechanism.
3. **What is the full renewal contract?** Define the API, responses, token behavior, deadline origin/reset, and worker behavior when a renewal result is uncertain. Section 3's title promises renewal, but only its recommended timing is provided.
4. **How would the equal-token decision be enforced?** If worker identity matters, what binds a worker to a token and what information must storage receive? The current write requirement names the token only. Do not silently replace the strict “lower than” comparison with “lower than or equal.”

For next week's review, lead with the storage-acceptance trace and the intended guarantee, then use the timing and equal-token questions to make the remaining contract precise. This prioritization is interpretation; no implementation behavior has been verified.
