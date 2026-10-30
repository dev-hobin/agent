# Repository study: how `take()` keeps the tiny-bucket promise

## Slice

- **Project:** tiny-bucket (synthetic example project).
- **Learning objective:** understand how a lazily refilled token bucket
  decides allow or reject, and which promises the tests actually pin down.
- **Slice:** one public call, `bucket.take(cost)`, from the README promise
  through `src/bucket.js` to `test/bucket.test.js`.
- **Why it is small enough:** one function and its private `refill()`; no I/O.
- **Out of scope:** packaging, `available()` except where tests use it to
  observe `take()`.

## Promise (caller-facing contract)

From `README.md` (direct evidence):

| Promise | README wording | Implementation | Test |
| --- | --- | --- | --- |
| Starts full | "The bucket starts full." | `let tokens = capacity` (`src/bucket.js`) | "starts full and allows a burst up to capacity" |
| Burst at most `capacity` | "`capacity`: the largest burst" | tokens never exceed `capacity` via `Math.min` in `refill()` | "starts full and allows a burst up to capacity" |
| Refill up to `capacity` | "tokens added per second, up to `capacity`" | `Math.min(capacity, tokens + elapsed * refillPerSecond)` | "refills over time but never above capacity" |
| Reject removes nothing | "otherwise returns `false` and removes nothing" | `if (cost > tokens) return false;` before `tokens -= cost` | "a rejected take removes nothing" |

## Evidence path

1. `README.md` usage: `take()` returns a boolean the caller uses to accept or
   reject a request.
2. `src/bucket.js` `take(cost = 1)`: calls `refill()` first, then compares
   `cost` with `tokens`; subtracts only on success.
3. `src/bucket.js` `refill()`: computes elapsed time since the last call from
   the injected `now()`, adds `elapsed * refillPerSecond`, caps at `capacity`,
   and moves `last` forward.
4. `test/bucket.test.js`: a fake clock (`clock()`) is injected through `now`,
   so tests control time exactly.

## Core representation

Two numbers, `tokens` (may be fractional) and `last` (timestamp of the last
refill). There is no timer: refill is computed lazily on each call (comment at
the top of `src/bucket.js`, direct evidence).

## Invariant and tradeoff

- **Invariant (inference):** `0 <= tokens <= capacity` after every call. The
  upper bound comes from `Math.min` in `refill()`; the lower bound comes from
  subtracting only when `cost <= tokens`.
- **Tradeoff (inference):** lazy refill needs no timer and no background work,
  at the cost of reading the clock on every call. The injected `now` makes this
  testable, which the tests rely on.
- **Clock going backwards (direct evidence):** `Math.max(0, current - last)`
  adds nothing instead of removing tokens; the comment states this intent.

## Interpretation review

| Claim | Evidence level |
| --- | --- |
| Start-full, burst cap, refill cap, reject-removes-nothing | Direct evidence: README + code + test |
| Tokens are never negative | Inference from the guard; no test |
| Clock going backwards is harmless | Direct evidence in code; gap: no test |
| `cost` is meant to be a positive number | Hypothesis: README says "removes `cost` tokens" but no validation exists |

## Falsifier and missing check

- **Would prove the invariant reading wrong:** `take(-5)` on a full bucket.
  `-5 > tokens` is false, so `tokens -= -5` raises `tokens` above `capacity`,
  breaking "the largest burst the bucket allows". Reading the code predicts
  this; no test checks it. A test with a negative or non-numeric `cost` is the
  missing check.
- **Missing check:** no test moves the fake clock backwards, so the
  `Math.max(0, …)` guard is unverified.
- **Missing check:** fractional refill (e.g. 500 ms at 1 token/s, then
  `take()`) is not tested; the code keeps 0.5 tokens and rejects, which is
  consistent with the README but not pinned down.

## Insight handoff

- **Repository scope:** `take()` in tiny-bucket.
- **Promise or invariant:** a rejected take removes nothing; tokens stay
  within `[0, capacity]`.
- **Insight:** the guard that protects the promise checks only one side of
  the input (`cost > tokens`); invariants enforced by comparison need the
  input's own domain checked too.
- **Evidence path:** `README.md` → `src/bucket.js` → `test/bucket.test.js`.
- **Counterexample or failure:** `take(-5)` as above.
- **Transfer possibility:** any "subtract if enough" balance (credits, stock,
  quotas).
- **Evidence level:** direct evidence for the guard; inference for the
  failure, which is not executed by any test.
- **Open question:** is a negative cost a supported "refund" or a bug? The
  README does not say.

## Next move

- Next slice: `createBucket` argument validation, to see whether `cost`
  validation was left out on purpose.
- Exercise handoff: predict `take()` results under a fake clock with
  fractional refills.
