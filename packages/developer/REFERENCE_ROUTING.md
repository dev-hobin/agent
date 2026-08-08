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

## Canonical Capability TOC

A reference-bearing Skill contains one direct-child JSON descriptor identified by the canonical `$schema`. Packaged Developer Skills conventionally name it `toc.json`; filename is a source-bound locator, not the format discriminator:

```json
{
  "$schema": "https://raw.githubusercontent.com/dev-hobin/agent/main/packages/developer/schemas/skill-toc-v0.1.schema.json",
  "when": [
    "A condition under which this Capability contributes."
  ],
  "unless": [
    "A condition that overrides applicability."
  ],
  "references": [
    {
      "path": "references/example.md",
      "when": [
        "A local condition under which this Reference contributes."
      ]
    }
  ]
}
```

The schema is closed. Unknown fields, duplicate normalized conditions, duplicate
paths, path escape, malformed UTF-8, unsupported schema identity, oversized
input, and unbounded discovery all fail closed.

The TOC owns only:

- Capability-level `when` and `unless` conditions;
- the complete direct Reference catalog for that Skill;
- local conditions for each Reference path.

It does not author Category, Requirement, Need, Assignment, Coverage, Conclusion,
identity, hash, confidence, artifact prose, stop prose, sibling Skill links, or
runtime state. Those belong to the canonical Work Case, the Skill method, or the
runtime adapter.

A Skill without a direct-child descriptor carrying the supported canonical TOC schema is unstructured. It declares no Reference routing and seals only its exact admitted `SKILL.md` after applicability creates an Assignment. A differently named descriptor using the same current closed schema is not a legacy format; old route-policy shapes are not recognized.

## Skill and Reference Responsibilities

`SKILL.md` owns:

- Pi discovery metadata and the Capability boundary;
- the Skill's core question and always-on method;
- its inspectable output shape and stop;
- residual and emergent Need behavior;
- neighboring Capability boundaries.

`toc.json` owns conditional local routing. `references/*.md` owns deeper,
source-independent derivation for one local condition. Repository source audits
own bibliographic provenance, source comparison, defects, and edition history;
they are maintainer evidence and are not published runtime material.

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
| `model` | structured; condition, contract, relation, temporal, proof, solver, logic, and planning References |
| `naming-judgment` | structured; domain-sense naming Reference |
| `schedule` | structured; structural timing Reference |
| `signal` | structured; structural movement Reference |
| `sketch` | structured; data, composition, representation, process, state, dispatch, conversion, runtime, responsibility, and variation References |
| `verify` | structured; verifier selection and pass-but-wrong Reference |
| `adversarial-eval` | unstructured |
| `doctor` | unstructured; delegates selected owner-Skill routing |
| `specify` | unstructured |
| `visualize` | unstructured |

Doctor does not aggregate sibling Reference catalogs. It dispositions available
Capabilities at the upper level and leaves each selected owner Skill to seal and
apply its own Context.

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
