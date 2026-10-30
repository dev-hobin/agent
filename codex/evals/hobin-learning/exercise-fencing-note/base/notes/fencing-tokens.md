# Concept: Fencing token

Synthetic concept note for a practice exercise.

## Definition

A fencing token is a number that grows with every new grant of exclusive
access. The resource that is being protected remembers the highest token it
has accepted and rejects any request that carries a lower one.

## Mechanism

A holder of a lock or lease can lose it without knowing: it pauses, its
messages are delayed, or its lease expires while it is busy. When it acts
again, it still believes it has access. The holder cannot detect this itself,
but the resource can: a newer holder has already presented a higher token.

## Why it matters

The check happens where the damage would happen (the storage, the device),
not where the decision to act is made (the old holder).

## Boundary

- It only protects resources that check the token. A side effect on a system
  that ignores the token (sending an email, calling a third-party API) is not
  protected.
- It does not order requests from the same holder; it only rejects older
  holders.
- Renewing a lease early or stopping before expiry reduces stale requests but
  does not replace the token check.
