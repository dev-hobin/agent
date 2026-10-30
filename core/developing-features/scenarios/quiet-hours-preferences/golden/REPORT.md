# Quiet hours

## Scenarios

| ID | Then | Check | Last result |
| --- | --- | --- | --- |
| S1 | Overnight window 22:00-07:00 defers 23:59 and 00:00 to 07:00; 07:00 and 21:59 are on time | `node --test --test-name-pattern '^S1 ' test/quiet-hours.test.js` | pass |
| S2 | Stored v1 fields outside the v2 shape (dnd, theme) are written back unchanged | `node --test --test-name-pattern '^S2 ' test/quiet-hours.test.js` | pass |
| S3 | start equal to end is rejected | `node --test --test-name-pattern '^S3 ' test/quiet-hours.test.js` | pass |
| S4 | 7pm, 24:00, 7:00, 22:60, empty, or missing times are rejected | `node --test --test-name-pattern '^S4 ' test/quiet-hours.test.js` | pass |
| S5 | Without quiet hours, delivery is on time | `node --test --test-name-pattern '^S5 ' test/quiet-hours.test.js` | pass |

Full record: `acceptance-scenarios.json`.

## Owner decisions

The product owner was unavailable, so each open question got the conservative, reversible default.

- **D1 Unknown v1 fields.** Decision: keep them under `legacy` and write them back unchanged.
  Reason: the previous parser dropped them, which deletes stored data on the next write.
  Revert: remove the `legacy` spread in `parsePreferences` (`src/preferences.js`).
- **D2 start equal to end.** Decision: reject as ambiguous (all day or never).
  Reason: either guess silently changes delivery.
  Revert: replace the throw in `setQuietHours` with the chosen meaning.
- **D3 Loose times such as 7pm or 24:00.** Decision: accept only strict 24-hour `HH:MM`.
  Reason: looser input can be added later; once accepted it cannot be taken back.
  Revert: widen the `TIME` pattern in `src/preferences.js` or add a normalizing parser.

## Checks run

- `npm test`: 8 tests, 0 failures (output in `TEST_OUTPUT.txt`).
- Independent re-check of every scenario command and the existing suite: no must-fix items.

## Not verified

- Time zones and daylight-saving changes: times are local minutes of the day, as the spec states.
- Records already stored by an earlier v2 writer that dropped v1 fields cannot be recovered.
