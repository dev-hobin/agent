---
name: doctor
description: "Diagnose a user-selected or explicitly bounded existing codebase scope and produce an evidence-backed improvement plan. Use for repository, package, directory, module, runtime-flow, boundary, or feature-slice review when behavior to preserve, invariant risk, structural pressure, evidence gaps, and justified now/next/later/leave-alone work must be assessed together. Not for pull-request diff review, environment setup checks, speculative cleanup, or automatic repair."
---

# Doctor

Diagnose one bounded existing-code scope and synthesize a treatment plan without
turning age, style, metrics, or code smells into disease.

## Core Question

Within this explicit codebase scope, what must be preserved, what is at risk or
obstructing change, and what should be treated now, prepared next, observed, or
left alone?

## Judgment Spine

```text
requested target and change horizon
→ requested / inspected / claim scope
→ behavior-preservation baseline
→ broad, shallow diagnostic lens sweep
→ narrow, deep follow-up investigations where evidence triggers them
→ evidence-backed mechanisms and treatment candidates
→ treat-now | prepare-next | observe | leave-alone | needs-decision
→ first concrete handoff
```

Doctor is broad in diagnostic coverage and bounded in code coverage. It is not
a fixed prelude for ordinary tasks.

## Inputs

- User-selected target, or evidence sufficient to propose one
- Repository structure, entry points, callers, runtime flows, and public boundaries
- Accepted behavior, tests, traces, incidents, schemas, and compatibility evidence
- Current change pressure and intended horizon when available
- Explicit review depth, concerns, exclusions, and evidence budget

## Scope Contract

Establish scope before diagnosis. Separate what was requested from what was
actually inspected and from the area to which conclusions may apply.

| Field | Required meaning |
| --- | --- |
| Requested target | What the user asked Doctor to review |
| Selected scope | Path, symbol, runtime flow, boundary, feature slice, subsystem, or repository sample |
| Included | Concrete paths, symbols, entry points, flows, or collaborators admitted |
| Excluded | Nearby areas this review does not cover |
| Depth | `local`, `collaborators`, `flow`, `subsystem`, or `repository-sample` |
| Concerns | Requested concerns, or `balanced` when no concern dominates |
| Evidence budget | Bounded files, history, commands, traces, or sampling rule |
| Inspected scope | Evidence actually read or executed |
| Claim boundary | The largest area current evidence can support conclusions about |

If the user did not select a useful scope, perform only a cheap orientation pass:
inspect manifests, subsystem boundaries, entry points, current failures or
requests, recent change pressure, dependency hubs, and irreversible effects.
Then propose the smallest valuable scope with evidence. Do not call an
orientation sample a whole-repository diagnosis.

A dependency outside scope may be inspected when the declared depth includes it.
Otherwise present a scope-expansion candidate with the trigger, added surface,
expected value, and cost. Never expand recursively by curiosity.

## Review Mode

Use `thorough-within-scope` unless the user explicitly asks for a faster pass.

- `quick`: inspect the strongest observable risk and label omitted lenses and
  code surfaces as unreviewed;
- `standard`: disposition every relevant diagnostic lens, then deepen only the
  highest-consequence or currently pressured investigations;
- `thorough-within-scope`: disposition every diagnostic lens, pursue every
  materially triggered distinct investigation, and account for every selected
  source of supporting evidence.

Exhaustiveness applies to diagnostic coverage inside the claim boundary, not to
unbounded file traversal or unsupported whole-system claims.

## Evidence Order

Prefer evidence in this order while keeping disagreements visible:

1. accepted user or product contract;
2. observed externally meaningful behavior, production trace, incident, or
   compatibility obligation;
3. executable tests and fixtures whose observers match the claim;
4. callers, state transitions, persisted representations, and effect order;
5. implementation structure and static relationships;
6. history, churn, test counts, complexity, and code smells as scope or pressure
   clues only.

A smell becomes a finding only when connected to behavior, an invariant, change
cost, a failure mode, an evidence gap, or a compatibility consequence. Age,
language fashion, low test counts, duplication, or a long function alone does
not justify treatment.

## Preservation Baseline

Before finding defects, record behavior and obligations that treatment must not
break.

| Behavior or contract | Owner / observers | Evidence | Confidence | Failure consequence |
| --- | --- | --- | --- | --- |

Cover relevant public APIs, critical user flows, persisted or legacy data,
external input boundaries, state transitions, effect order, failure and retry
behavior, and compatibility surfaces. Record `baseline evidence gap` when an
important obligation has no distinguishing observer; do not silently treat it
as absent.

## Diagnostic Lens Sweep

In `standard` and `thorough-within-scope`, give every lens one disposition:
`triggered`, `no-trigger`, `needs-evidence`, `out-of-scope`, or `blocked`. Each
disposition requires concrete scope evidence.

| Lens | Diagnostic question | Representative trigger |
| --- | --- | --- |
| Product meaning | Is code deciding unresolved meaning, default semantics, or scope? | docs, tests, callers, and defaults imply different product senses |
| Condition model | Are admitted, forbidden, absent, replacement, relational, or temporal cases unsettled? | invalid states, null/default/legacy combinations, retries, ordering, solver or query semantics |
| Design shape | Is an implementable owner, boundary, representation, data flow, state flow, or collaboration missing? | unchecked narrowing, scattered parsing, mixed effects, repeated ownership decisions |
| Structural movement | Is observable structural pressure present rather than mere similarity? | repeated change, parallel cases, model-code mismatch, boundary pressure |
| Naming | Do names preserve stable domain sense and expose consequential effects? | filler names, effect-hiding verbs, implementation-shaped names, sense collisions |
| Abstraction stability | Can callers rely on an already-shaped helper, API, interface, boundary, or workflow rule? | a concrete candidate makes unstable or leaking promises |
| Timing | When does a stable structural candidate belong? | current invariant pressure, nested work, delay cost, or lost reversibility |
| Verification | What do current checks prove, and what plausible wrong shape still passes? | observer, source, branch, construction-path, or effect-order gaps |
| Adversarial confidence | Does a consequential claim need escalating finite counterexamples? | ordinary checks can pass while security, data, compatibility, or workflow behavior is wrong |
| Inspection surface | Would a visual representation materially lower judgment cost? | prose obscures consequential relationships, order, state, comparison, or evidence gaps |

Use this inspection surface:

| Lens | Disposition | Scope evidence | Follow-up question or exemption |
| --- | --- | --- | --- |

`no-trigger` means observed evidence makes the compact question irrelevant here;
it does not mean the entire codebase is healthy. `needs-evidence` names the
smallest observation that could change the disposition.

## Follow-up Investigations

Doctor does not impersonate focused expertise or turn supporting material into a
mandatory reading list. For every `triggered` lens:

1. write one bounded investigation question and its concrete trigger evidence;
2. name the expertise or decision owner needed to answer it;
3. select only code, behavior, history, or source material that can change the
   answer;
4. record the result, contradicting evidence, limitations, and smallest
   falsifier;
5. preserve citations and the exact question boundary;
6. keep genuinely distinct questions as separate investigations;
7. return to synthesis only when each investigation resolves or becomes an
   explicit gap.

Use dependency only when evidence requires it: unresolved meaning or condition
space precedes a design that depends on it; structural movement precedes
promotion of a new candidate; timing requires a stable candidate; verification
and adversarial checks challenge the resulting claims. Do not run this as a
mandatory phase sequence when a lens is `no-trigger`.

Use an investigation ledger:

| Question / expertise | Trigger evidence | Selected material | Result | Residual gap |
| --- | --- | --- | --- | --- |

## Diagnosis

Synthesize investigations into findings without erasing disagreement or evidence
limits.

| ID | Observation | Consequence | Mechanism | Evidence | Confidence | Affected scope | Decision owner |
| --- | --- | --- | --- | --- | --- | --- | --- |

A valid diagnosis names:

- the observable behavior, invariant risk, change obstruction, or evidence gap;
- the mechanism connecting code shape to that consequence;
- supporting and contradicting evidence;
- confidence and the exact claim boundary;
- the smallest plausible falsifier;
- a concrete candidate only when enough meaning and shape are stable.

Do not merge independent findings merely because one treatment could touch the
same files.

## Treatment Plan

Use ordinal decisions rather than pseudo-precise health scores.

| Candidate | Diagnosis | Behavior to preserve | Guarantee gained | Current pressure | Dependencies / reversibility | Stable landing | Verifier | Decision |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |

Decide:

- `treat-now`: current correctness, security, data, compatibility, or invariant
  risk justifies the smallest stable treatment;
- `prepare-next`: treatment is needed before the next related change to avoid
  nested work or prevent a known recurrence;
- `observe`: current pressure is insufficient; record an observable reopen
  condition;
- `leave-alone`: treatment is speculative, destroys useful freedom, or costs
  more than the evidenced problem;
- `needs-decision`: product, operational, or risk ownership cannot be inferred.

Do not turn the treatment plan into a predetermined multi-step implementation
queue. Provide one first handoff with preserved behavior, the smallest stable
landing, a narrow verifier, and explicitly deferred work. Reobserve after that
landing.

## Output

Lead with scope and the user's actual change or risk, not a health score. A
resolved Doctor report contains:

1. Doctor scope and actual coverage;
2. preservation baseline;
3. all relevant lens dispositions;
4. investigation ledger with questions, selected material, results, and citations;
5. diagnosis table;
6. treatment plan;
7. first concrete handoff and residual unknowns;
8. an ASCII flow, ownership, state, or dependency map when relationships are
   materially consequential.

When used inside a larger task, return:

```text
Status: resolved | needs-evidence | not-applicable | blocked
Result: scope-bound diagnosis and treatment order, or the investigation plan still required
Basis: inspected code, behavior, callers, tests, traces, history, and focused findings
Open questions: unresolved investigations, scope choices, product decisions, or none
Artifacts: scope map, preservation baseline, lens matrix, investigation ledger, findings, treatment plan, and first handoff
```

## Completion

A `thorough-within-scope` diagnosis is resolved only when:

- requested, selected, inspected, and claim scopes are explicit;
- every diagnostic lens has an evidence-backed disposition;
- every triggered investigation is resolved or retained as an explicit gap;
- every finding has an observable consequence, mechanism, evidence, confidence,
  scope, and falsifier;
- every treatment preserves named behavior and has an owner and verifier;
- every `treat-now` item has a smallest stable landing;
- every `observe` item has a reopen condition;
- intentionally unchanged areas are visible.

Return `needs-evidence` when a focused investigation, baseline observer, or
bounded repository evidence can settle the diagnosis. Return `blocked` when
required product, operational, access, or risk ownership cannot be obtained.
Return `not-applicable` when the request is a local diff review, environment
check, already-shaped single judgment, or implementation task better owned by a
narrower method.

## Boundary

Do not implement treatment, automatically repair files, recommend a rewrite
because code is old, equate style or metrics with risk, invent product meaning,
promote every duplication into an abstraction, flatten independent diagnostic
questions into a checklist, treat supporting material as mandatory, or claim
coverage beyond the inspected scope. Doctor owns scope, diagnostic coverage,
investigation planning, synthesis, and treatment ordering; focused expertise
owns its actual questions and evidence.
