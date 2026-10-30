# Evidence

Catches: a completion or correctness claim that is broader than what the evidence actually observed: a green check that never reaches the changed behavior, a new test standing in for the existing suites, or one path's evidence applied to an unobserved sibling.
Applies when: a change is reported as done, fixed, compatible, or safe; tests were added or changed; or a claim covers several fields, branches, roles, providers, paths, or versions.
Skip when: no claim is made beyond "this compiles", or the stated check observes exactly the claimed behavior and no broader inference is drawn.

## Gotchas
- A new passing test says nothing about the existing tests that cover the changed code. Run the existing suites around the change before claiming completion.
- Running a check is not the same as the check being relevant. A test can pass without reaching the changed branch, or assert only that nothing threw, that a value is truthy, or that a snapshot exists.
- A typecheck proves only that the code follows its declared types. A cast, type assertion, non-null assertion, `any`, or suppression lets a false declaration typecheck.
- Evidence for one sibling does not cover another: a different field, branch, role, provider, create vs update, sequential vs concurrent, or happy vs absent configuration.
- A negative test can pass while the unwanted effect has already happened. A validation error returned after a write, send, or partial update still passes "rejects invalid input".
- A green run on a different source than the one claimed is not evidence about the target: a stale build, the workspace instead of the packed or installed artifact, or another branch or version.
- One test per state cannot tell histories apart. Every enum state can be reachable while a stale, duplicate, or reordered event still commits twice.

## Distinctions
- **Claim**: one behavior that one kind of observer can falsify. Split a compound claim (behavior, HTTP shape, stored state, concurrency, compatibility) into separate claims.
- **Observer**: the check that observes the claim, the distinction it can actually see, and the source and version it ran on.
- **Pass-but-wrong case**: the smallest realistic wrong implementation that still passes the observer.
- **Status**: supported (direct evidence that fits), narrowed (a weaker claim holds), unverified (nothing exercised it), contradicted, or blocked (needs an unavailable environment or human acceptance).
- **Unobserved sibling**: a path, field, participant, or case that shares a name or code with the observed one but was not exercised.
- **Escalation ladder**: smoke (syntax, build) → visible baseline behavior → stronger invariants and hidden checks → adversarial (stale, conflicting, stateful, nested) → compatibility with the actual source → residual left to humans. Climb only while the next step could change the claim.

## Questions
| Before building, decide | After building, find |
| --- | --- |
| Which exact claims will this change make, each with its own observer? | Find completion claims in the report, commit message, or PR text that are broader than any check, for example "handles all X" with one X exercised. |
| Which existing tests cover the code being changed? | Find existing test files that import or exercise the changed modules, and confirm they ran on the final diff. A failing existing test, or one that never ran, is a finding. |
| What is the cheapest check that could falsify each claim? | Find each new test's fixture and assertion, and check whether it reaches the changed branch with a meaningful case, rather than only asserting no-throw, truthiness, or a snapshot. |
| What wrong implementation would still pass the planned checks? | Name one (for example, returning an empty result on a malformed response), then find whether any test fails for it. |
| Which siblings share this code but will not be exercised? | Find claims covering several roles, providers, fields, branches, or create and update where only one was exercised, and list the unexercised ones. |
| For rejection paths, what must not have happened? | Find negative tests that assert the error but do not assert the absence of a write, send, or state change. |
| Which absence states need their own case? | Find tests that cover only the configured or happy case, where missing, null, empty, and malformed inputs would take different paths. |
| Does the type itself carry part of the claim? | Find casts, `as`, `!`, `any`, or suppressions on the changed path that make the typecheck vacuous for the claimed invariant, and find construction paths that tests never take. |
| Does the claim depend on order, retry, or concurrency? | Find asynchronous or stateful claims tested only one call at a time, with no duplicate, stale, reordered, or retried trace. |
| Which source and version must the evidence come from? | Find evidence produced from a different build, artifact, installed version, or branch than the one the claim is about. |
| Which collaborators are faked, and does the claim depend on them? | Find tests that mock the persistence, HTTP, or wiring layer the claim is about, so the claimed integration is never observed. Find mocks that only echo private calls. |

## Report a finding only when
- You can name the specific claim, the evidence offered for it, and a concrete wrong implementation or trace that passes that evidence, located at `file:line`. An existing test that fails, or that never ran against the changed code, also counts.
- These do NOT count: generic "add more tests"; coverage percentages; missing tests for unchanged code; demanding a stronger verifier when no plausible wrong shape passes the current one.

## Sources
- `archive/developer-0.2.2/skills/verify/SKILL.md` (gotcha on existing suites; execution vs relevance; narrowing claims; source/version binding).
- `archive/developer-0.2.2/skills/verify/references/verifier-selection-and-pass-but-wrong.md` (verifier by falsification power, counterexample families, construction-path and effect-order rows, test design as evidence).
- `archive/standalone-0.1.0/skills/claim-evidence/SKILL.md` (splitting compound claims, binding observers, pass-but-wrong case, bounded status, sibling generalization).
- `archive/developer-0.2.2/skills/adversarial-eval/SKILL.md` (escalation ladder smoke → visible → hidden-parent → adversarial → compatibility → gate-residual; marginal-value stop).
- Alexis King, "Parse, don't validate," November 5, 2019.
- Hillel Wayne, *Logic for Programmers*, v0.14.0, 2026-05-04: Chapters 3-6 and 9-11, pp. 23-155.
- Sandi Metz, Katrina Owen, and TJ Stankus, *99 Bottles of OOP*, Second Edition, v2.2.2: Chapters 2 and 9, pp. 23-50 and 226-268.
- Matthias Felleisen et al., *How to Design Programs*, living build 9.2.0.3: Prologue, Chapters 18, 23, 25, 27-29, Intermezzi 4-5.
- Replay experiment, 2026-10-29 (first gotcha, recorded in `docs/plans/2026-10-30-restructure.md`).
