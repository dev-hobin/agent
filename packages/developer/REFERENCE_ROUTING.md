# Reference Routing Contract

This document defines how `@hobin/developer` routes Pi-admitted Skills and their
packaged References inside the canonical Action Loop.

## Decision

Upper Judgment owns cross-Skill routing. A Skill owns only the Reference
selection needed to produce one Contribution for one assigned Need.

```text
Contribution Need
→ Capability applicability
→ Capability Assignment
→ local Reference disposition
→ sealed Skill Context
→ Skill Contribution
→ upper Coverage
→ Conclusion
```

Categories describe Warrant Gaps. They do not contain Skill names. Capability
applicability is evaluated from the current Need and the admitted Capability
inventory, never from a Category-to-Skill table.

## Framework-independent Skill TOC

A Skill TOC describes when a Skill applies and when its colocated supporting
materials are relevant. The contract does not depend on Developer. Developer
consumes it as routing input but does not own its meaning.

The default descriptor is direct-child `toc.json`; `$schema` is optional there:

```json
{
  "when": [
    "A condition under which this Skill materially applies."
  ],
  "unless": [
    "A condition that overrides applicability."
  ],
  "references": [
    {
      "path": "references/example.md",
      "when": [
        "A condition under which this material adds a needed distinction."
      ]
    }
  ]
}
```

An alternate direct-child filename is recognized only when it declares the
canonical generic schema:

```json
{
  "$schema": "https://raw.githubusercontent.com/dev-hobin/agent/main/schemas/skill-toc-v0.1.schema.json",
  "when": ["..."],
  "unless": ["..."],
  "references": []
}
```

The schema is closed. Unknown fields, duplicate normalized conditions, duplicate
paths, path escape, malformed UTF-8, unsupported schema identity, oversized
input, and unbounded discovery all fail closed. A default `toc.json` and an
alternate schema-identified descriptor together are ambiguous rather than
silently prioritized.

The TOC owns only:

- Skill-level `when` and `unless` conditions;
- the complete direct Reference catalog for that Skill;
- local relevance conditions for each Reference path.

It does not author Category, Requirement, Need, Assignment, Coverage, Conclusion,
identity, hash, confidence, artifact prose, stop prose, sibling Skill links, or
runtime state. Those belong to a consuming runtime or the Skill method itself.

A Skill with neither default `toc.json` nor a schema-identified alternate is
unstructured. Developer gives it no authored Reference route and seals only its
exact admitted `SKILL.md` after applicability creates an Assignment. Retired
route-policy shapes are not recognized.

## Skill and Reference Responsibilities

`SKILL.md` owns:

- Pi discovery metadata and the Capability boundary;
- the Skill's core question and always-on method;
- its inspectable output shape and stop;
- residual and emergent Need behavior;
- neighboring Capability boundaries.

The Skill TOC owns conditional local routing. `references/*.md` owns deeper,
source-independent derivation for one local condition. `SKILL.md` tells a
standalone user to inspect the TOC and read the smallest materially applicable
set when no host selection is supplied. A host-supplied bounded selection is
used as the current selection while visible mismatches remain explicit
limitations.

Repository source audits own bibliographic provenance, source comparison,
defects, and edition history; they are maintainer evidence and are not published
runtime material.

A Reference must refine the assigned Skill's method. It must not become a topic
shelf, a second upper ontology, a hidden Category-to-Skill mapping, or an excuse
to summarize unrelated source material.

## Runtime Contract

1. Pi's admitted Skill inventory is canonical. Developer adapts only those
   source-qualified descriptors and never rediscovers excluded Skills.
2. The primary SDK controller dispositions one admitted Capability for one exact current Contribution Need. Applicability creates an Assignment but no Contribution.
3. Every applicable Assignment passes through canonical Reference disposition and Context sealing.
   - Structured Capability: disposition every declared Reference exactly once as `selected`, `not-needed`, or `needs-context`.
   - Unstructured Capability: use an empty disposition list and seal `SKILL.md` alone.
4. Any `needs-context` disposition leaves structured selection unresolved. It cannot produce a sealed Context or authorize Skill Contribution.
5. A ready selection acquires and seals exact Skill and selected Reference bytes atomically. Missing, drifting, symlink-escaped, non-regular, invalid, or oversized material produces no partial Context.
6. Selected References are supplied to the bounded Skill Contribution session only from exact sealed bytes. Ordinary file reads are Observations, not canonical structured Reference evidence.
7. Canonical Contribution admission must account exactly once for every selected Reference and preserve local limitations, residual Needs, and emergent Needs. Skill-local `resolved` never implies upper Coverage or Conclusion.
8. The upper Coverage and Conclusion controllers disposition every current Contribution and synthesize the category-bound Conclusion. These lower-level operations are SDK-composable and are not separately registered as model-facing tools.

When the same Capability serves several Needs, each Need receives a distinct
Assignment, sealed Context, Contribution, Coverage assessment, and upper
synthesis path. Skill-local code cannot route a sibling Capability.

## Acquisition and Replay Boundaries

Structured and unstructured acquisition is bounded, source-qualified,
hash-verified, atomic, and fail-closed. Sealed bytes remain external to Pi
session events. Replay stores semantic proposals and expected identities, then
reacquires current admitted Skill material where the transition requires it.
Drift, missing material, malformed events, or a changed admitted inventory makes
replay unavailable rather than silently degrading to absence.

## Package Coverage

| Skill | Routing shape |
| --- | --- |
| `abstraction-review` | structured; review calibration References |
| `convention-judgment` | structured; enforcement-strength and operational-convention References |
| `information-loss-judgment` | structured; transformation and equivalence References |
| `model` | structured; condition, contract, relation, temporal, proof, solver, logic, and planning References |
| `module-judgment` | structured; environment, assumption, drift, and boundary-pressure References |
| `naming-judgment` | structured; domain-sense naming Reference |
| `process-judgment` | structured; process, phase, execution-model, and effect-data References |
| `schedule` | structured; structural timing Reference |
| `signal` | structured; structural movement Reference |
| `sketch` | structured; data, composition, representation, process, state, dispatch, conversion, runtime, responsibility, and variation References |
| `task-protocol-judgment` | structured; topology, acknowledgment, and retry-protocol References |
| `variation-judgment` | structured; conditional, table, registration, and dispatch References |
| `verify` | structured; verifier selection and pass-but-wrong Reference |
| `adversarial-eval` | unstructured |
| `doctor` | unstructured; self-contained bounded code diagnosis |
| `specify` | unstructured |
| `visualize` | unstructured |

Doctor does not know Developer's Skill inventory or orchestration protocol. It
emits bounded follow-up investigation questions. When Developer is active, the
ordinary Action Loop may route those questions through the admitted Capability
inventory without changing Doctor's standalone method.

## Evaluation Contract

Live evaluation checks more than schema conformance. A valid trace must show:

- canonical Work Case and Judgment ownership;
- admissible first Capability routing;
- exact sealed Reference loads required by the fixture;
- Contribution before upper Coverage;
- Coverage before Conclusion;
- exact Action Clearance before controlled mutation;
- explicit Effect settlement;
- completion, pause, waiting, or blocking consistent with the fixture outcome.

The runtime proves admission, complete disposition accounting, exact acquisition,
and provenance binding. It does not prove that model synthesis is semantically
good; adversarial fixtures still check relevance, counterexamples, stop
satisfaction, and pass-but-wrong risk.
