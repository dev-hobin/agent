# Reference Routing Contract

This document defines how `@hobin/developer` decides which packaged references
an active skill judgment must load and apply.

## Decision

`primary` and `companion` are not intrinsic properties of a reference file.
They are too coarse for the package because the same document can be sufficient
for one question and only one part of a larger derivation for another.

The routing unit is instead:

```text
skill core judgment
-> one observable unresolved subquestion
-> one named skill-method step to refine
-> policy route ID and co-required reference set
-> one inspectable artifact and stop condition
-> separation/handoff boundary
-> reference_basis evidence
```

Every path listed by one selected route is equally required for that route.
Requiredness does not imply a global rank. Reading sequence is a separate,
route-local property: `read_order: listed` is used only when a later document
assumes the earlier document's method, vocabulary, or invariant; `any` is used
when no such dependency exists. A singleton set is valid. Several routes may be
selected when they answer distinct unresolved questions; the runtime checks the
union of their reference sets without imposing cross-route order.

## Judgment Integration Rules

A reference is a conditional extension of a skill judgment, not a source summary
or topic shelf. Its operational body must be understandable without its source,
refine one declared method step, produce the route artifact, and stop at the same
skill boundary. Runtime `Source Trace` uses ordinary bibliographic book,
edition, chapter, and section citations. Exact URLs/anchors, reading sequence,
source-local examples, defects, and edition verification belong in source audits
unless they are the concept itself.

Every source-derived insight must serve one of five roles:

```text
recognize a trigger
make a consequential distinction
constrain artifact derivation
supply a falsifier or stop
force a separation/handoff
```

If it serves none, it does not belong in an active runtime reference. If it is
always required for the skill's judgment, move it into `SKILL.md`. If it changes
the core question, output, owner, or stop, separate it into another route or
skill rather than asking the model to synthesize unrelated material at runtime.

Create separate routes when triggers can be observed independently and resulting
artifacts answer different questions. Treat these as strong separation signals:

- different core question;
- independently observable trigger;
- independently useful output artifact;
- different falsifier or stop condition;
- different owner or downstream handoff;
- either judgment can complete without the other.

Two or more signals normally require separation. For example, composition,
generative recursion, and accumulator design share a broad recursion context but
have independent triggers, artifacts, correctness obligations, and stops; they
must not remain one OR-shaped route.

Put several references in one route when the claimed artifact cannot be derived
honestly from only one of them. Examples include:

- the base data recipe plus the recursive template catalog;
- the level-of-language method plus a representation-barrier construction;
- the modeling method plus a complete specialized calibration;
- an abstraction review field card plus the selected construction or repair
  procedure.

Use `read_order: listed` only when reversing the order would make the later
reference incomplete or misleading—for example, a template catalog explicitly
extends the six-artifact data recipe. Use `read_order: any` when every member can
be understood independently even though all are needed for the final artifact.
This sequence decision must come from document assumptions, not prestige,
length, or book order.

Use one reference in a route when that document independently supplies the
needed method and stop check. Do not create hierarchy for hierarchy's sake. If
several references are interchangeable ways to satisfy one obligation, model an
explicit alternative selection mode in a future policy version rather than
mislabeling them co-required; the current corpus contains no such route.

Use no reference route when a skill has no packaged references. For a
reference-bearing skill, use the declared exemption only when no route trigger
applies and the required concrete evidence shows that the compact method is
sufficient.

Do not encode:

- book prestige or chapter order;
- a universal beginner-to-advanced progression;
- a broad reference that must always be read merely because another file links
  to it;
- duplicate broad and narrow routes for the same unresolved question;
- optional reading disguised as a hard dependency.

## `SKILL.md` Responsibility

`SKILL.md` remains the executive method, not merely a description or routing
table. It owns:

- Pi discovery metadata and capability boundary;
- the core question and accepted inputs;
- always-on method and invariants;
- inspectable output shape;
- completion, missing-evidence, and not-applicable behavior;
- what the skill must not absorb from neighboring capabilities.

`reference-policy.json` is the sole route-specific authority. It owns the
narrower question, trigger classification, skill-method integration point,
co-required reference set, application artifacts, stop, separation boundary, and
exemption evidence. `references/*.md` owns the deeper source-independent
derivation and bounded calibration. Repository-only source audits own source
sequence, comparison, defects, edition fidelity, and provenance history; they
are maintainer evidence and are excluded from the published package.

Keeping those roles separate avoids two failure modes: hiding trigger recognition
inside a long reference, and maintaining conflicting route tables in `SKILL.md`
and JSON.

## Policy Schema

Each reference-bearing skill declares:

```json
{
  "version": 2,
  "routes": [
    {
      "id": "stable-route-id",
      "question": "One narrower judgment question",
      "trigger": "Observable condition that makes the route relevant",
      "method_step": "Exact skill judgment step this route refines",
      "references": [
        "references/one.md",
        "references/two.md"
      ],
      "read_order": "listed",
      "artifacts": [
        "inspectable result proving the method was applied"
      ],
      "stop": "Observable condition that completes this route",
      "separate_when": "Condition requiring another route or skill handoff"
    }
  ],
  "exemption": {
    "when": "Condition under which no route applies",
    "evidence": [
      "concrete fact required to justify that exemption"
    ]
  }
}
```

Policy validation requires unique route IDs; non-empty questions, triggers,
method steps, artifacts, stops, and separation boundaries; direct skill-relative
reference paths; explicit `listed` or `any` order for every multi-reference
route; and coverage of every packaged reference owned by the skill. Singleton
routes default to `any`.

## Runtime Contract

1. `developer_route_question` loads and hashes the policy and exposes every
   route's narrower question, trigger, method step, reference set, artifact,
   stop, separation boundary, and exemption criteria.
2. `developer_load_reference` receives `reference_route`, `path`, and observable
   trigger evidence. The path must belong to that route.
3. Loading any path selects that policy route. A `listed` route enforces its
   declared sequence; an `any` route does not. Before judgment, every path in
   every selected route must have loaded successfully. One load may satisfy
   overlapping route sets. A shared path is loaded once; select another
   overlapping route through one of its not-yet-loaded paths and provide one
   `reference_basis` entry per distinct path.
4. The branch records policy route IDs, path, content SHA-256, Source Trace, and
   selection reason.
5. A judgment must provide one `reference_basis` entry for every loaded path,
   naming the trigger, applied rule, and resulting artifact.
6. `reference_exemption` is valid only when no reference was loaded and no policy
   trigger applies.

This runtime gate proves route selection, integration-point exposure, and
claimed application. It does not prove the synthesis is semantically good; live
evaluations still check route relevance, artifact quality, stop satisfaction,
separation behavior, and pass-but-wrong cases.

## Package Coverage

| Skill | Policy routes | Shape |
| --- | --- | --- |
| `abstraction-review` | `candidate-contract-review`, `failed-candidate-check`, `candidate-calibration` | review, failure localization, or promise-based calibration; no shadow construction |
| `model` | `condition-space`, `contract-replacement`, `relational-constraints`, `temporal-behavior`, `proof-obligation`, `solver-result-boundary`, `logic-query-semantics`, `planning-model` | one model artifact per uncertainty and stop condition |
| `sketch` | `data-driven-design`, `data-shape-template`, `composition-by-wishes`, `earned-abstraction`, `generative-recursion`, `accumulator-invariant`, `evidence-preserving-boundary`, `design-levels`, `representation-barrier`, `closure-interface`, `process-resources`, `state-history-order`, `generic-dispatch`, `meaning-preserving-conversion`, `language-semantics`, `runtime-compilation`, `responsibility-collaboration`, `variation-role`, `type-transition`, `selection-creation` | one implementable design question per route, with route-local common kernels only where required |
| `signal` | `behavior-preserving-movement` | singleton |
| `schedule` | `structural-timing-tradeoff` | singleton |
| `naming-judgment` | `domain-sense-boundary` | singleton |
| `verify` | `claim-evidence-gap` | singleton |
| `specify` | none | no packaged reference |
| `visualize` | none | no packaged reference |
| `adversarial-eval` | none | no packaged reference |

The implementation execution profile under `extensions/references/` is selected
by `execution_profile`, not by skill reference routing, and remains a separate
contract.

## Evaluation Contract

Deterministic checks validate policy shape, reference coverage, runtime route
membership, route-set completeness, provenance recording, and one-to-one loaded
path/basis coverage.

Live fixtures additionally declare expected policy route IDs and expected paths.
They must reject at least these pass-but-wrong shapes:

- reading a relevant path under an unrelated route;
- ignoring a selected route's evidence-backed listed read order;
- loading only part of a selected route set;
- loading all paths but omitting application evidence;
- producing the right final answer without refining the route's declared method
  step or producing its derivation artifact;
- satisfying topic keywords while missing the route stop condition;
- absorbing work named by `separate_when` instead of handing it off;
- selecting every broad route and over-designing a local question;
- claiming exemption while an observable route trigger is present.

## Source-Fidelity Gate

Original PDF or book review binds each derived rule to an exact edition, chapter
or section, and page range. Cross-source integration is a second gate: after
fidelity repair, reorganize insights by source-independent judgment role, record
moves and splits in an integration audit, and recheck that no source limitation
was erased. Historical post-repair hashes attest the audited snapshot; a later
integration audit must attest the current synthesized document set.
