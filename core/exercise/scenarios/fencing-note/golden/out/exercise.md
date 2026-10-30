# Workbook: Fencing tokens

## Exercise Design Brief

- **Target:** single concept, fencing token (`notes/fencing-tokens.md`).
- **Learning objective:** given a timeline of lease grants and writes, the
  learner predicts which writes the resource accepts, explains why the stale
  holder cannot protect itself, and says where the check must live.
- **Mental model:** the resource remembers the highest token accepted and
  rejects lower ones; the holder's belief is irrelevant.
- **Prerequisites:** what a lock or lease is; that a process can pause.
- **Common wrong models:**
  1. "Renewing the lease early is enough" (timing replaces the check).
  2. "The holder checks its own token before writing" (check at the decider).
  3. "Any side effect is protected once tokens exist" (ignores resources that
     do not check).
- **Transfer contexts:** a device controller, a job queue, a config store.
- **Mastery evidence:** correct predictions with correct reasons on an unseen
  timeline, plus a boundary statement on an unprotected side effect.

## Practice sequence

### 1. Worked example

Worker A gets a lease with token 12. A pauses for a long garbage collection.
The lease expires; worker B gets token 13 and writes `x = 2` with token 13.
The store records highest = 13. A resumes and writes `x = 1` with token 12.

- The store compares 12 with 13. 12 is lower, so it rejects A's write.
- A never learned it lost the lease; it did not need to. The store did the
  check where the damage would happen.

### 2. Prediction (changed case)

Same store, highest accepted = 13. Predict accept or reject for each write, in
order, and give the reason before reading the answer key:

a. B writes with token 13.
b. C gets a new grant and writes with token 14.
c. B writes again with token 13.
d. A writes with token 12.

### 3. Misconception trap

A teammate says: "We renew at half the TTL and stop writing at the TTL, so
we can drop the token check in the store." Is the teammate right? Explain
using one concrete timeline.

### 4. Faded completion

Fill in the blanks: the store keeps ______ for each resource; a request is
rejected when its token is ______ than that; the old holder cannot detect its
own staleness because ______.

### 5. Near miss: contrast

Which of these is protected by fencing tokens, and which is not? Why?

a. Writes to a database table that checks the token column.
b. An email sent by the lease holder through a third-party mail service.

### 6. Repair

This store code accepts stale writes. Find and fix the defect:

```text
on write(token, value):
  if token >= lastSeen: accept; lastSeen = token
  else if holder.stillHasLease(): accept
  else: reject
```

### 7. Transfer task

A robot arm controller receives move commands from whichever planner holds a
lease. Design where the token goes and what the controller must remember.
Say one thing the token does not protect in this system.

## Answer keys and misconception diagnoses

1. Worked example: no answer needed.
2. Prediction:
   a. Accept (13 is not lower than 13).
   b. Accept; highest becomes 14.
   c. Reject: 13 is lower than 14. A learner who says "accept, B had the
      lease" is checking the holder's belief, wrong model 2.
   d. Reject: 12 is lower than 14.
   Correct answer with wrong reasoning: "d is rejected because A's lease
   expired." The store does not know about expiry; it rejects because 12 < 14.
3. Misconception trap: the teammate is wrong. Timeline: A pauses longer than
   the TTL; on resume A's own clock has not noticed, so A writes. Only the
   store's comparison stops it. Timing reduces stale writes; it does not
   prevent them (wrong model 1).
4. Faded completion: the highest token accepted; lower; it cannot observe its
   own pause or the newer grant.
5. Near miss: (a) is protected; (b) is not, because the mail service never
   sees or checks the token (wrong model 3).
6. Repair: the `holder.stillHasLease()` branch trusts the holder's belief.
   Remove it so lower tokens are always rejected. Verify with prediction d.
7. Transfer: commands carry the planner's token; the controller remembers the
   highest token and rejects lower ones. Not protected: a physical motion
   already in progress when a newer planner takes over, or side effects the
   planner causes through other systems.

## Hint and retry rules

- **Hint ladder for task 2:** (1) "What number does the store remember?"
  (2) "Compare each token with that number, not with who holds the lease."
- **Retry:** if any prediction in task 2 is wrong or has the wrong reason,
  redo the worked example aloud, then retry task 2 with the tokens shuffled.
- **Simplify:** if task 3 fails twice, draw the timeline as three columns
  (A, coordinator, store) before answering.
- **Stop:** stop after two clean runs of task 2 and task 7 with correct reasons.

## Spaced retrieval plan

- Day 1: tasks 1–4.
- Day 3: tasks 2 and 5 with new numbers, without notes.
- Day 7: task 7 in a new context of your choice.

## Mastery rubric

| Evidence | Not yet | Practiced | Demonstrated |
| --- | --- | --- | --- |
| Prediction | Wrong verdicts | Right verdicts, reasons cite lease state | Right verdicts, reasons cite token comparison only |
| Explanation | "Tokens make it safe" | Names the stale holder | Explains why the holder cannot detect staleness |
| Boundary | None | Names one unprotected effect | Names why: the resource does not check |
| Transfer | Cannot place the check | Places the check at the resource | Places the check and states what stays unprotected |

## Observed or expected evidence gap

No learner attempt yet; the rubric states the expected evidence. The note does
not cover equal tokens from different holders, so no task tests it.

## Handoff

If the learner keeps reasoning from lease state, the concept note's mechanism
section may need a worked timeline; hand that back to conceptualize.
