# Cancel a running lookup

A lookup can take minutes while the server works on its job. Users need a way to stop
waiting.

- Add `cancel()` to `LookupPanel` in `src/lookup.js`, with `canCancel()` telling whether it
  is offered. It stops waiting for the running lookup or recheck.
- The server job is not cancelled. It keeps running and may still finish.

Open questions (the product owner is away):

1. After a lookup is cancelled, may the user submit a new lookup for the same target right away?
2. What happens to a result that arrives after its lookup was cancelled?
3. What does cancel do during a recheck?
