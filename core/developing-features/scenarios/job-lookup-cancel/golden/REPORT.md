# Cancel a running lookup

## Scenarios

| ID | Then | Check | Last result |
| --- | --- | --- | --- |
| S1 | Cancel is refused while nothing runs and offered while a lookup runs | `node --test --test-name-pattern '^S1 ' test/cancel.test.js` | pass |
| S2 | A cancelled lookup with a job id refuses a new lookup and offers a recheck | `node --test --test-name-pattern '^S2 ' test/cancel.test.js` | pass |
| S3 | A lookup cancelled before its job id arrived refuses both until reset | `node --test --test-name-pattern '^S3 ' test/cancel.test.js` | pass |
| S4 | A late result of a cancelled lookup is dropped | `node --test --test-name-pattern '^S4 ' test/cancel.test.js` | pass |
| S5 | A cancelled recheck keeps the review recheckable | `node --test --test-name-pattern '^S5 ' test/cancel.test.js` | pass |
| S6 | Cancel is not offered while an outcome is unknown and nothing runs | `node --test --test-name-pattern '^S6 ' test/cancel.test.js` | pass |

Full record: `acceptance-scenarios.json`. Control model: `control-decisions.json`, with `control-baseline.json` taken before the change. The six changed cells (all `CANCEL`) are covered by S1-S3, S5 and S6; the gate passes with one finding acknowledged (completed and failed lookups differ only in what is shown).

## Owner decisions

The product owner was unavailable, so each open question got the conservative, reversible default.

- **D1 A new lookup right after cancel.** Decision: refused. A cancelled lookup becomes a review, recheckable when the job id is known.
  Reason: the server job keeps running; a new lookup could create a duplicate job.
  Revert: in `cancel()` (`src/lookup.js`), set `review` to `null` instead of `withId`/`withoutId`.
- **D2 A result that arrives after cancel.** Decision: dropped.
  Reason: the user stopped waiting; a recheck can still read the outcome.
  Revert: remove `this.attempt++` from `cancel()`.
- **D3 Cancel during a recheck.** Decision: stop waiting and keep the review recheckable.
  Reason: the job's outcome is still unknown.
  Revert: clear `review` in `cancel()` when cancelling a recheck.

## Checks run

- `node --test 'test/**/*.test.js'` — pass
- `node scripts/compile-control-model.mjs --gate` — pass

## Not verified

- Behavior against a real server job; the panel is exercised through its calls only.
