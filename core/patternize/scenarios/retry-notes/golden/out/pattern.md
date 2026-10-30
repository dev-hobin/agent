# Pattern: Resolve-or-dedupe before repeating a side effect

Evidence level: supported by three independent incidents (order API, shipping
labels, bank payouts); one source-external transfer case checked.

## Recurring context and signals

Use this pattern when:

- a call causes an effect outside the caller (creates, charges, ships, sends);
- the caller can stop waiting before it learns the result (timeout, dropped
  connection, user gives up, worker crash);
- someone or something may repeat the call (automatic retry, a user tapping
  again, an operator re-sending by hand).

Signals: duplicate records or charges after slow periods; items "missing" after
a no-retry fix; dashboards that show timeouts as FAILED.

Out of scope: reads and other calls without side effects; failures known to
have happened before the request was sent.

## Axis

The one criterion that ties the cases together: **before repeating a side
effect whose outcome is unknown, either make the repeat recognizable to the
receiver or resolve the outcome first.**

## Cases compared

| Case | Context | Problem | Forces | Successful move | Check | Failure if omitted |
| --- | --- | --- | --- | --- | --- | --- |
| Order API (`notes/idempotency-keys.md`) | Mobile submit over flaky network | Second tap created a second order | User wants feedback now; network is slow | Key created once per order screen and sent with every submit; server returns the stored result | Server rejects a repeated key with a different payload | Key per tap gave duplicates; reused key after cart edit returned the old order |
| Shipping labels (`notes/retries.md`) | Worker retries a carrier call after a 2 s timeout | Four billed labels for one parcel | Labels must exist; labels cost money | (Missing in the note) retry only with a stable request identity, or look up the label first | Count labels per parcel | Retry on timeout duplicated; never retrying lost labels |
| Bank payouts (`notes/timeouts.md`) | Payout call with a 5 s timeout, manual re-send by staff | Recipients paid twice | Staff want to fix "failed" items fast | Show UNKNOWN; check the status endpoint before any re-send | Status endpoint result recorded before re-send | Timeout shown as FAILED led to double payment |

## Forces

- **Completeness vs duplication:** not repeating loses effects (labels went
  missing); repeating blindly duplicates them (labels, payouts, orders).
- **Speed vs certainty:** users and staff want an immediate answer; the true
  outcome may only be known later.
- **Receiver support:** dedupe needs the receiver to store and honour a key;
  resolving needs a status endpoint. Some receivers offer only one.
- Overuse cost: keys and status checks add storage and latency to calls that
  could never be repeated. Underuse cost: money and trust.

## Roles

- Input: an intent to cause one effect (one order, one label, one payout).
- Transformation: the call to the receiver.
- Control: the intent identity (idempotency key) and the rule "unknown is not
  failed".
- Check: receiver-side duplicate detection, or a status lookup.
- Output and feedback: the stored result returned to every repeat; the
  resolved state shown to people.

## Moves / decision path

1. **Name the intent.** Input: the user's or job's request. Action: create one
   identity per intended effect, at the moment the intent is formed (when the
   order screen opens, when the parcel is queued), not per attempt. Output: a
   key. Check: two attempts for the same intent carry the same key; an edited
   intent gets a new key.
2. **Classify the ending.** Input: the call's result. Action: map it to
   success, known failure (not sent), or unknown (sent, no answer). Output: one
   of three states. Check: timeouts are never classified as failure.
3. **If unknown, choose by receiver support.**
   - Receiver honours keys: repeat with the same key. Check: the receiver
     returns the stored result or rejects a payload mismatch.
   - Receiver has a status query: resolve first, then act only on a known
     state. Check: the status result is recorded before any repeat.
   - Neither: stop and surface UNKNOWN to a person; do not repeat
     automatically.
4. **Show unknown as unknown.** Action: display UNKNOWN (not FAILED) to users
   and operators until resolved. Check: no manual re-send action is enabled
   while the state is UNKNOWN.
5. **Feed back.** Action: count duplicates and unresolved unknowns per period.
   Check: the counts stay at zero; a rise sends you back to move 1 or 3.

```text
call -> success ---------------------------------> done
     -> known failure ---------------------------> safe to retry
     -> unknown -> keys honoured? -> retry same key
                -> status query?  -> resolve -> act on known state
                -> neither        -> UNKNOWN to a person
```

## Checks and feedback

- Per move checks are listed above.
- Feedback loop: duplicates found later mean the intent identity was formed at
  the wrong moment (move 1); missing effects mean unknown was treated as
  failure (move 2).

## Transfer case

An infrastructure script creates a cloud load balancer and the call times out.
Move 1: pass a client token derived from the deploy ID. Move 2: classify as
unknown. Move 3: the API honours client tokens, so re-run with the same token;
the API returns the existing load balancer instead of creating a second one.
The pattern carried over unchanged outside orders and payments.

## Boundary and failure case

- **When not to use:** read-only calls (repeating is harmless), and calls
  whose receiver guarantees rollback on timeout. Use a plain retry instead.
- **Boundary:** a failure detected before sending (DNS error, refused
  connection) is a known failure; move 3 does not apply.
- **Skipped-move failure:** skipping move 1 (key per attempt) reproduces the
  order API's duplicate orders even though keys exist. Skipping move 4
  reproduces the payout incident: staff re-send what the screen calls FAILED.

## Falsifier / evidence gap

- Falsifier: an incident where a repeat of an unknown side effect was safe
  without identity or resolution (and not because the call was read-only)
  would show the axis is incomplete.
- Evidence gap: all three cases are networked calls between services. No case
  yet covers local side effects (file writes, device commands) where "unknown"
  comes from a crash.

## Handoff

- Concept handoff to conceptualize: "unknown outcome is a third state" and
  "intent identity" are concepts this pattern only refers to.
- Exercise handoff: practise classifying endings (move 2) on new incident
  descriptions.
