---
name: doctor
description: "Diagnose a user-selected or explicitly bounded existing codebase scope and produce an evidence-backed improvement plan. Use for repository, package, directory, module, runtime-flow, boundary, or feature-slice review when behavior to preserve, invariant risk, structural pressure, evidence gaps, and justified now/next/later/leave-alone work must be assessed together. Not for pull-request diff review, environment setup checks, speculative cleanup, or automatic repair."
---

# Doctor

Diagnose one bounded existing-code scope, consult the focused Developer judgments
that its evidence actually triggers, and synthesize a treatment plan without
turning age, style, or code smells into disease.

## Core Question

Within this explicit codebase scope, what must be preserved, what is at risk or
obstructing change, and what should be treated now, prepared next, observed, or
left alone?

## Judgment Spine

```text
requested target and change horizon
-> requested / inspected / claim scope
-> behavior-preservation baseline
-> broad, shallow disposition of every Developer judgment lens
-> narrow, deep owner-skill consultations and triggered references
-> evidence-backed mechanisms and treatment candidates
-> treat-now | prepare-next | observe | leave-alone | needs-decision
-> first concrete handoff
```

Doctor is broad in lens coverage and bounded in code coverage. It is not a fixed
prelude for ordinary tasks.

## Inputs

- User-selected target, or evidence sufficient to propose one
- Repository structure, entry points, callers, runtime flows, and public boundaries
- Accepted behavior, tests, traces, incidents, schemas, and compatibility evidence
- Current change pressure and intended horizon when available
- Explicit review depth, lenses, exclusions, and evidence budget

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
| Lenses | Requested concerns, or `balanced` when no concern dominates |
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

- `quick`: inspect the strongest observable risk and label all omitted lenses and
  code surfaces as unreviewed;
- `standard`: disposition every Developer lens, then deepen only the
  highest-consequence or currently pressured consultations;
- `thorough-within-scope`: disposition every available Developer lens, route
  every triggered distinct consultation, inspect every policy-route trigger in
  each selected owner skill, and apply every reference required by every
  selected route.

Exhaustiveness applies to judgment coverage inside the claim boundary, not to
unbounded file traversal or unsupported whole-system claims.

## Evidence Order

Prefer evidence in this order while keeping disagreements visible:

1. accepted user or product contract;
2. observed externally meaningful behavior, production trace, incident, or
   compatibility obligation;
3. executable tests and fixtures whose observers match the claim;
4. callers, state transitions, persisted representations, and effect order;
5. implementation structure and static relationships;
6. history, churn, coverage counts, complexity, and code smells as scope or
   pressure clues only.

A smell becomes a finding only when it is connected to a behavior, invariant,
change cost, failure mode, evidence gap, or compatibility consequence. Age,
language fashion, low coverage, duplication, or a long function alone does not
justify treatment.

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

## Universal Lens Sweep

In `standard` and `thorough-within-scope`, give every available Developer skill
other than Doctor one disposition: `triggered`, `no-trigger`, `needs-evidence`,
`out-of-scope`, or `blocked`. Each disposition requires concrete scope evidence.

| Owner skill | Diagnostic question | Representative trigger |
| --- | --- | --- |
| `specify` | Is code deciding unresolved product meaning or scope? | docs, tests, callers, or defaults imply different product senses |
| `model` | Are admitted, forbidden, absent, replacement, relational, or temporal conditions unsettled? | null/default/legacy combinations, invalid states, retries, ordering, solver or query semantics |
| `sketch` | Is an implementable owner, boundary, representation, data flow, state flow, or collaboration missing? | unchecked narrowing, shotgun parsing, navigation leaks, mixed effects, repeated ownership decisions |
| `signal` | Is observable structural movement present rather than mere similarity? | repeated change, closest parallel cases, model-code mismatch, boundary pressure |
| `naming-judgment` | Do names preserve stable domain sense and expose consequential effects? | filler names, effect-hiding verbs, implementation-shaped names, sense collisions |
| `abstraction-review` | Can callers safely rely on an already-shaped helper, API, interface, boundary, or workflow rule? | a concrete candidate makes unstable or leaking promises |
| `schedule` | When does a stable concrete structural candidate belong? | current invariant pressure, nested work, delay cost, or lost reversibility |
| `verify` | What do current checks prove, and what plausible wrong shape still passes? | green checks with observer, source, branch, construction-path, or effect-order gaps |
| `adversarial-eval` | Does a consequential claim need escalating finite counterexamples? | ordinary checks can pass while security, data, compatibility, or workflow behavior is wrong |
| `visualize` | Would a visual surface materially lower the cost of inspecting this judgment? | prose obscures consequential relationships, order, state, comparison, or evidence gaps |

Use this inspection surface:

| Skill | Disposition | Scope evidence | Concrete consultation question or exemption |
| --- | --- | --- | --- |

`no-trigger` means observed evidence makes the compact question irrelevant here;
it does not mean the entire codebase is healthy. `needs-evidence` names the
smallest observation that could change the disposition.

## Consultation Workflow

Doctor does not impersonate other skills or treat their reference catalogs as
mandatory reading. Doctor must not read sibling skill references directly; each
owner skill selects and applies its own routed references.

For every `triggered` disposition:

1. write one bounded consultation question and its concrete trigger evidence;
2. close the Doctor triage judgment;
3. open the dynamic question with its owning Developer skill;
4. apply a present policy's root `when`/winning `unless`, or use the complete
   skill normally when no policy exists;
5. nominate and seal only current-branch material that can change the result;
6. relate every selected material through a concrete contribution and bounded
   assurance while preserving conflicts and limitations;
7. preserve contribution citations, artifact, stop, and question boundary
   without one-reference-per-file ceremony;
8. open a later Developer judgment for any genuinely distinct question, then
   return to Doctor only after consultations resolve or become explicit gaps.

Use dependency only when evidence requires it: unresolved meaning or condition
space precedes a design that depends on it; `signal` precedes promotion of a
new structural candidate; `sketch` creates an original surface;
`abstraction-review` judges an existing surface; `schedule` requires a stable
candidate; `verify` and `adversarial-eval` challenge the resulting claims. Do
not run this as a mandatory phase sequence when a lens is `no-trigger`.

When Developer protocol is active and consultations remain, keep one
agent-owned `before-completion` Doctor synthesis question rather than opening one
pending question per lens. Owner-skill judgments may resolve their narrow
question while retaining that synthesis question with updated remaining work.
The final Doctor route resolves it after integrating the consultation ledger.

Use a consultation ledger:

| Skill / optional policy | Applicability evidence | Judgment artifact | Result | Residual gap |
| --- | --- | --- | --- | --- |

## Diagnosis

Synthesize consultations into findings without erasing disagreement or evidence
limits.

| ID | Observation | Consequence | Mechanism | Evidence | Confidence | Affected scope | Owner judgment |
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
- `prepare-next`: the treatment is needed before the next related change to
  avoid nested work or prevent a known recurrence;
- `observe`: current pressure is insufficient; record an observable reopen
  condition;
- `leave-alone`: treatment is speculative, destroys useful freedom, or costs
  more than the evidenced problem;
- `needs-decision`: product, operational, or risk ownership cannot be inferred.

Do not turn the treatment plan into a predetermined multi-step implementation
queue. Provide one first handoff with its owner skill, preserved behavior,
smallest stable landing, narrow verifier, and explicitly deferred work. Reobserve
and reroute after that landing.

## Output

Lead with scope and the user's actual change or risk, not a health score. A
resolved Doctor report contains:

1. Doctor scope and actual coverage;
2. preservation baseline;
3. all required lens dispositions;
4. consultation ledger with dynamic question, selected-material, contribution, assurance, and citation provenance;
5. diagnosis table;
6. treatment plan;
7. first concrete handoff and residual unknowns;
8. an ASCII flow, ownership, state, or dependency map when relationships are
   materially consequential.

When used inside a larger task, return:

```text
Status: resolved | needs-evidence | not-applicable | blocked
Result: scope-bound diagnosis and treatment order, or the consultation plan still required
Basis: inspected code, behavior, callers, tests, traces, history, and owner-skill judgments
Open questions: unresolved consultations, scope choices, product decisions, or none
Artifacts: scope/coverage map, preservation baseline, lens matrix, consultation ledger, findings, treatment plan, and first handoff
```

Return only Doctor's scope, triage, or synthesis judgment for the current route;
leave owner-skill consultation and implementation routing to the caller.

## Completion

A `thorough-within-scope` diagnosis is resolved only when:

- requested, selected, inspected, and claim scopes are explicit;
- every available non-Doctor skill has an evidence-backed disposition;
- every triggered consultation is resolved or retained as an explicit gap;
- every owner-skill judgment atomically seals only selected material and records
  exact contributions before coverage and outcome;
- every finding has an observable consequence, mechanism, evidence, confidence,
  scope, and falsifier;
- every treatment preserves named behavior and has an owner and verifier;
- every `treat-now` item has a smallest stable landing;
- every `observe` item has a reopen condition;
- intentionally unchanged areas are visible.

Return `needs-evidence` after triage when owner-skill consultations, a baseline
observer, or bounded repository evidence can settle the diagnosis. Return
`blocked` when required product, operational, access, or risk ownership cannot
be obtained. Return `not-applicable` when the request is a local diff review,
environment check, already-shaped single judgment, or implementation task better
owned directly by another skill.

## Boundary

Do not implement treatment, automatically repair files, recommend a rewrite
because code is old, equate style or metrics with risk, invent product meaning,
promote every duplication into an abstraction, flatten sibling skills into a
checklist, treat a reference catalog as mandatory, or claim coverage beyond the inspected
scope. Doctor owns scope, lens coverage, consultation planning, diagnostic
synthesis, and treatment ordering; focused Developer skills own their actual
questions, context coverage, and judgments.
