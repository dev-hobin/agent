# Concept: Unknown outcome is a third state

Status: supported across three independent incidents; transfer tested once.

## One-sentence definition

When a caller stops waiting for a request that has a side effect, the effect is
in a third state, unknown, which is neither success nor failure, and the next
action must be correct under both possibilities.

## Practical question answered

After a timeout or a lost response, what may I do next without causing the
effect twice or not at all?

## Cross-source evidence

| Evidence context | Source-local expression | Example | Boundary | Candidate invariant |
| --- | --- | --- | --- | --- |
| Order API (`notes/idempotency-keys.md`) | "users tap Submit again when nothing seems to happen" | A second tap after a slow response created a second order | Key reused after a cart edit returned the old order | A repeat of the same intent must be recognizable as the same intent |
| Shipping labels (`notes/retries.md`) | "from a timeout alone we cannot tell whether the label exists" | Retrying on timeout billed four labels; never retrying lost labels | Connection errors before sending are known failures | Neither "retry" nor "give up" is safe while the outcome is unknown |
| Bank payouts (`notes/timeouts.md`) | "A timeout means we stopped waiting, not that the bank stopped working" | Timed-out transfers shown as FAILED were re-sent and paid twice | The status endpoint can resolve the state later | Unknown must be shown as UNKNOWN until resolved |

Contradiction kept: the shipping note's first fix treated timeout as failure and
lost labels; the payout note treated it as failure and paid twice. Both errors
are the same collapse of three states into two, in opposite directions.

## Mechanism

A request with a side effect has three observable endings for the caller:
confirmed success, confirmed failure, and no answer. "No answer" (timeout,
dropped connection after sending, crash before reading the reply) carries no
information about whether the receiver applied the effect. Mapping it to
failure makes a retry duplicate the effect; mapping it to success makes a
missing effect invisible. Only two moves keep the next action correct in both
worlds: make the repeat recognizable by the receiver (a stable identity for the
intent), or resolve the state by asking (a status query) before acting.

## Portable model

```text
send -> { success | failure | unknown }
unknown --resolve by--> query status
unknown --make safe to repeat by--> stable intent identity
```

## Technical anchors

Timeout, at-least-once delivery, idempotency key, status endpoint.

## Transfer case

A deploy tool calls a cloud API to create a load balancer and the call times
out. Treating it as failed and re-running creates a second, billed load
balancer; treating it as done skips the DNS step that needs it. The concept
predicts the fix: tag the create call with a client token (stable identity), or
list resources by tag before retrying. The cloud API's client-token parameter
exists for exactly this reason, so the concept transfers outside payments and
orders.

## Counterexample / boundary

- A request without side effects (a read) has no third state that matters:
  repeating it is harmless, so the concept does not apply.
- A failure detected before the request left the caller (DNS error, refused
  connection) is a known failure, not unknown.
- Near miss: "retries are dangerous" is not this concept. The shipping note
  shows that refusing to retry is equally wrong while the outcome is unknown.

Falsifier: a system where a timed-out side-effecting call is always rolled back
by the receiver would make "unknown" collapse to "failure"; the concept would
not hold there.

## Related concepts and connector relations

- Unknown outcome --is made safe to repeat by--> idempotency key (a separate
  concept: stable identity of an intent, with its own pitfalls such as key
  scope and payload mismatch).
- Unknown outcome --is resolved by--> status query / reconciliation.
- Handling a possibly retried call end to end (when to key, when to query, what
  to show the user) is a workflow; hand it to patternize.

## Evidence gap

All three contexts are networked service calls. No evidence yet from local
side effects (file writes, hardware commands) where "unknown" may arise from a
crash rather than a timeout.

## Handoff

Pattern candidate for patternize: a routine for side-effecting calls that may
be retried.
