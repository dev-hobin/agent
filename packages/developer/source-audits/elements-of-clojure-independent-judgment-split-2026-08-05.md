# Integration Record: Independent Judgment Split From *Elements of Clojure*

## Status

**Accepted as a source-independent capability reorganization.** This record does
not revise the source-fidelity verdict in
`elements-of-clojure-leanpub-2019-02-11.md`. It records later evidence that six
concrete engineering questions need standalone judgment surfaces rather than
remaining available only as construction references.

## Trigger

The prior audit correctly concluded that the source alone did not require a new
route. Later direct design pressure established a different question:

```text
Can each durable concept be invoked as a complete judgment without depending on
another Skill, Reference, technology stack, package runtime, or source sequence?
```

The trigger is therefore an independently useful caller contract, not a chapter
heading or source vocabulary.

## Decision Rule

A new Skill is admitted only when it owns all of the following:

```text
one core engineering question
accepted input boundary
always-on derivation method
inspectable output
local completion and missing-evidence behavior
clear non-ownership boundary
```

A concept remains a Reference distinction when it cannot terminate in an
independent artifact and stop.

## Accepted Capability Split

| Skill | Independent question | Main artifact | Boundary |
| --- | --- | --- | --- |
| `convention-judgment` | Should one concrete code-shape-to-intent mapping remain conventional or receive stronger enforcement? | convention card and violation test | does not invent product meaning or an API |
| `variation-judgment` | Which least-powerful mechanism owns an accepted variation surface? | variant-operation matrix and mechanism decision | does not invent variants or operations |
| `module-judgment` | Does one concrete module remain useful in its environment? | module, assumption, and drift card | does not create the original interface |
| `information-loss-judgment` | Which distinctions does one concrete transformation add, preserve, discard, or reorganize? | information-flow table and equivalence witnesses | does not invent product equivalence |
| `process-judgment` | Can one concrete generated execution be understood independently? | process trace and bounded execution card | does not define business completion or a system protocol |
| `task-protocol-judgment` | Who owns outstanding work and business completion across process boundaries? | protocol card and failure trace | does not invent business completion or promise exactly-once delivery |

`naming-judgment` already owns the independent sign, referent, sense, audience,
and expected-evolution question and remains unchanged as the Names capability.

## Reference Independence Contract

Directory ownership is catalog placement, not a semantic prerequisite. Every
new Reference is usable as a standalone document and contains accepted context,
a local derivation, a complete worked case, an artifact, a stop, and bibliographic
Source Trace.

Before `## Source Trace`, a Reference must not contain:

```text
Skill status
Skill or Reference identifiers
cross-Reference Markdown links
handoff or next-capability language
Developer or Action Loop vocabulary
technology-stack assumptions
source-title-dependent operational guidance
```

A Reference returns local findings, artifacts, limitations, and stop conditions.
It does not decide `resolved`, `needs-evidence`, `not-applicable`, or `blocked`.

## Skill Independence Contract

A Skill owns its local result envelope:

```text
Status: resolved | needs-evidence | not-applicable | blocked
Result: this Skill's concrete judgment
Basis: concrete observations and accepted assumptions
Open questions: concrete unanswered questions in the caller's language, or none
Artifacts: inspectable outputs
```

A Skill does not select a sibling or classify a next capability. The package
routing layer may interpret its completed contribution, but that orchestration is
not part of the Skill document.

The core method remains complete when no Reference applies. The TOC contributes
only local applicability and conditional Reference selection.

## Source Boundaries Preserved

The reorganization keeps the original audit exclusions:

- Clojure syntax, macros, dynamic vars, atoms, refs, agents, STM, option-map
  conventions, and host lookup behavior are not portable rules.
- Ordered openness and dispatch-performance claims remain pressures rather than
  universal laws.
- Internal consistency does not prove environmental usefulness.
- Effectful lazy acquisition requires complete resource ownership beyond the
  source example.
- Edge-held outstanding work is a candidate ownership boundary, not an
  exactly-once or durable-recovery guarantee.
- Cancellation, idempotency, full recovery, production capacity, telemetry,
  rollout, and migration remain qualified operational extensions.

## Existing Reference Repair

The independence rule applies uniformly to packaged runtime material. Existing
References were repaired to remove:

- direct sibling Skill selection;
- direct selection of another Reference;
- Reference-level Skill statuses;
- source names in operational guidance; and
- abstract handoff or residual-need fields.

Concrete open questions remain a Skill output responsibility. Cross-Skill routing
remains documented only in package integration material.

## Verification

The package checker now fails closed when operational Reference content contains
Skill status, package orchestration terms, Skill or Reference identifiers,
cross-Reference Markdown links, technology-stack terms, source-title terms, or
packaging-file dependencies. It also requires every Skill to use the concrete
`Open questions` contract and checks that all sixteen new References expose the
complete standalone document surface.

Verification performed after the reorganization:

```text
node packages/developer/scripts/check-package.mjs
pnpm --filter @hobin/developer check
node scripts/check-documentation.mjs
git diff --check
```

The package check completed with 384 passing tests and no failures. Documentation
locale/link checks and diff whitespace checks passed. Language-server and cached
diagnostic scans reported no blocking errors; JSON language-service warnings for
the remote TOC schema URL remain an existing external schema-availability issue,
while the checked-in parser and schema contract pass package tests.

## Outcome

The source remains provenance rather than runtime sequence. The six new Skills
are justified by independent engineering questions, and their References are
standalone derivation documents rather than hidden routes to other Skills or
technology-specific companions.
