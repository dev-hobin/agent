# Developer Action Loop Routing Contract v0.1

English | [한국어](./ko/action-loop-routing-contract-v0.1.md)

> Status: reconstruction design contract
>
> Related documents:
> [Action Loop Architecture](./action-loop-architecture-v0.1.md) ·
> [Action Loop Concept Vocabulary](./action-loop-concept-vocabulary-v0.1.md)
>
> Baseline: `@hobin/developer@0.1.19`
>
> Runtime note: `@hobin/developer@0.2.0-rc.1` implements this default-or-schema-identified Skill TOC boundary. The old route-policy files are removed; there is no compatibility loader for that retired shape.
>
> Authored: 2026-08-06

## 1. Design correction

The first TOC candidate required users to author all identity, artifact, stop, route grouping, handoff, and coverage information needed by the runtime.

```text
contribution contract
route question
route artifacts
route stop
separate conditions
read grouping and order
material application
```

This shape can create a strong runtime, but it is not usable as an authoring surface. It requires the same meaning already present in `SKILL.md`, Reference bodies, and the runtime protocol to be authored again in the TOC.

The new principle is:

> Authors write only applicability and local material relevance. Markdown owns the content contract, while the compiler and runtime generate the complexity of identity, selection, provenance, and coverage.

The Skill TOC therefore retains a small, framework-independent shape. The default `toc.json` needs no schema declaration; an alternate direct-child filename opts in by declaring the canonical `$schema`.

## 2. Linking structure to resolve

```text
Upper Judgment
  → Contribution Needs
  → context-matched Skills

Selected Skill
  → context-matched References
  → Skill Contribution

Upper Judgment
  → Need Coverage
  → Conclusion
```

The two linking stages use the same Contribution Need and current context sequentially.

```text
Contribution Need
  ↓ evaluate Skill when/unless
Selected Skill
  ↓ evaluate references[].when
Selected References
  ↓ exact reading and application
Skill Contribution
  ↓
Need Coverage
```

A Category does not own Skill names, and a Skill does not own sibling Skills.

## 3. Responsibility ownership

### Upper Judgment Category

Owns the Stable Question and Closure Requirements. It does not own a Skill or Reference inventory.

### Contribution Need

Expresses an input missing from the evaluation of the current Closure Requirement.

### `SKILL.md`

Owns the Skill family’s Core Question, Judgment Spine, Output, Completion, Missing Evidence, and Boundary.

### Skill TOC descriptor

Owns only Skill applicability and local supporting-material relevance. The colocated `toc.json` is the default descriptor. An alternate direct-child JSON document is a descriptor only when it declares the canonical `$schema`. This contract is framework-independent; Developer is one consumer.

### Reference Markdown

Owns concrete methods, distinctions, examples, artifacts, stops, counterexamples, and separation boundaries.

### Compiler and runtime

Own owner binding, IDs, hashes, selection state, exact content, applied-material relations, Contributions, limitations, residual Needs, Need Coverage, and staleness.

## 4. Minimal TOC descriptor

```json
{
  "when": [
    "An observable situation in which this Skill can materially address the current Contribution Need."
  ],
  "unless": [
    "An explicit situation in which a related but different capability or decision owns the Need."
  ],
  "references": [
    {
      "path": "references/example.md",
      "when": [
        "An observable pressure in which this Reference adds a material distinction to the selected Skill judgment."
      ]
    }
  ]
}
```

This is the entire default `toc.json` authoring shape. `$schema` is optional at that filename. To use another direct-child filename, add the canonical `$schema` shown by the checked-in generic Skill TOC schema.

No route IDs, artifact declarations, stop strings, sibling Skill links, hashes, Coverage fields, or runtime state are authored here.

## 5. Discovery and field contract

### Descriptor discovery

Developer does not search an arbitrary filesystem. Pi must first discover a Skill from a package, global, project, settings, or CLI source. A Project Skill must pass through Pi’s trust boundary.

Bounded discovery is performed only within each discovered Skill root.

```text
Pi-discovered Skill root
  → direct-child regular `*.json` files only
  → bounded file count and bytes
  → default `toc.json`, with optional canonical `$schema`
     or alternate filename with exact canonical `$schema`
  → one recognized TOC descriptor
```

- 0 recognized descriptors: it is an unstructured Capability.
- 1 recognized descriptor: parse, validate, and bind it.
- 2 or more recognized descriptors: ambiguous TOC failure.
- Unsupported version from the known TOC schema family: unsupported-version failure.
- Nested JSON and JSON outside the Skill root are not candidates.
- The runtime does not fetch the schema URI over the network; it maps it exactly to a bundled validator.
- An unrelated direct-child JSON file without the canonical schema is not a descriptor.

### `$schema`

Optional in the default `toc.json`; required as the document-kind and authoring-version discriminator for any alternate filename. When present, its value must exactly match the canonical URI required by the schema’s `const` and supported by the compiler.

Parsing normalizes both forms to the same canonical schema identity, so adding or removing the optional declaration from an otherwise identical `toc.json` does not change the normalized TOC. The schema URI remains independent of package and runtime event versions.

### Human name and runtime identity

The `name` in Skill frontmatter is a label for humans, models, and the `/skill:name` surface, not runtime identity.

Developer does not require users to author IDs. The Pi Adapter assigns every Capability an opaque identity from discovered source provenance.

```text
CapabilityId =
  hash(
    identity vocabulary version,
    Pi source kind,
    canonical source locator,
    Skill-relative root
  )

CapabilityRevisionId =
  hash(
    CapabilityId,
    exact SKILL.md hash,
    routing fingerprint
  )

routing fingerprint =
  structured   → normalized TOC hash
  unstructured → explicit versioned no-TOC marker
```

`CapabilityId` preserves which Skill occurrence from which source is represented. `CapabilityRevisionId` preserves the current Skill content and routing mode of the same occurrence. Adding or removing a canonical TOC preserves the Capability ID while changing the revision. A recognized invalid, ambiguous, or unsupported descriptor does not fall back to the no-TOC marker. Selected Reference hashes are owned by the later Sealed Skill Context, so drift in an unselected Reference body alone does not change the Capability revision.

```text
name: model
source: package:@hobin/developer/skills/model
capabilityId: cap_A

name: model
source: project:.pi/skills/model
capabilityId: cap_B
```

In principle, two occurrences are different Capabilities even when they have the same name. However, Pi currently warns about same-name Skills before the Developer inventory and retains only one. V0 Developer does not restore a candidate excluded by Pi through an independent filesystem scan.

```text
Pi-selected descriptor
  → Developer Capability inventory

Pi-excluded same-name descriptor
  → not reconstructed by Developer
```

Therefore, local Skills that must be used simultaneously in v0 use distinct human names such as `payment-model` and `company-contract-model`. Same-name coexistence will be reconsidered when Pi provides trust- and filtering-applied pre-dedup source descriptors and a disambiguated command surface.

### `when`

Observable conditions under which this Skill family can make a material Contribution for the current Contribution Need and context.

Structured applicability requires at least one material match.

### `unless`

Explicit exclusions for the Skill family. If `when` and `unless` both match, `unless` takes precedence.

Insufficient evidence is not an `unless`; it is runtime `needs-context`.

### `references`

Skill-local prepared materials. An empty array can represent a self-contained Skill.

A Skill with neither default `toc.json` nor a schema-identified alternate can also be discovered normally as an unstructured Capability.

### `references[].path`

A normalized relative POSIX path beneath the Skill root. It becomes the stable source of runtime Reference identity.

### `references[].when`

Conditions under which this Reference adds a material distinction to the Skill core for the currently assigned Need and context.

A useful sentence states both the observable pressure and the distinction being added.

```text
Too broad:
  When temporal behavior is involved.

Useful:
  Retry, duplicate, reorder, safety, or progress is consequential, and this
  material adds allowed-history, frame-condition, and liveness distinctions.
```

## 6. Concrete `verify/toc.json`

This example uses the recommended filename `toc.json`.

```json
{
  "$schema": "https://raw.githubusercontent.com/dev-hobin/agent/main/schemas/skill-toc-v0.1.schema.json",
  "when": [
    "A concrete completion, correctness, compatibility, coverage, or evidence claim must be judged."
  ],
  "unless": [
    "There is no concrete claim whose support or residual risk must be assessed."
  ],
  "references": [
    {
      "path": "references/verifier-selection-and-pass-but-wrong.md",
      "when": [
        "Several claims need different evidence, a green check may not exercise accepted meaning, source or version compatibility matters, behavior can pass while structure degrades, or verifier relevance and residual risk are unclear."
      ]
    }
  ]
}
```

Runtime interpretation:

```text
Contribution Need asks for claim assurance
  ↓ root when matches and unless does not
verify selected
  ↓ reference condition assessed
pass-but-wrong pressure present
  ↓
SKILL.md + selected Reference read
  ↓
Skill Contribution returned
```

If the Reference condition does not match, `SKILL.md` alone may produce the Contribution. The runtime records why no prepared Reference added a consequential distinction.

## 7. Several References

An abbreviated portion of `model` looks like this.

```json
{
  "$schema": "https://raw.githubusercontent.com/dev-hobin/agent/main/schemas/skill-toc-v0.1.schema.json",
  "when": [
    "Consequential conditions, rules, contracts, histories, or proof boundaries must be modeled."
  ],
  "unless": [
    "The laws or invariants are already settled and only an implementable interface shape is needed."
  ],
  "references": [
    {
      "path": "references/problem-modeling.md",
      "when": [
        "Consequential conditions require an admitted domain, distinctions, assumptions, rules, forbidden cases, owners, or counterexamples.",
        "Contract replacement requires a shared domain, observer set, assumptions, and forbidden compatibility cases.",
        "Temporal behavior requires accepted states, actions, assumptions, invariants, and forbidden histories."
      ]
    },
    {
      "path": "references/contract-and-replacement-models.md",
      "when": [
        "Caller or callee obligations, preconditions, postconditions, failures, compatibility observers, replacement, or refinement are consequential."
      ]
    },
    {
      "path": "references/temporal-behavior-models.md",
      "when": [
        "Retry, stale or duplicate events, lifecycle, reorder, concurrency, safety, progress, stuttering, fairness, or temporal refinement is consequential."
      ]
    }
  ]
}
```

In a contract-replacement case, the conditions for both `problem-modeling.md` and `contract-and-replacement-models.md` match. In a temporal case, both `problem-modeling.md` and `temporal-behavior-models.md` match.

There is no separate user-authored route group. A co-required relation is represented by complete relevance conditions matching together in the same case.

## 8. Selection and reading order

Each Reference is dispositioned independently.

```text
selected
not-needed
needs-context
```

- `selected`: adds a material distinction to the current Need.
- `not-needed`: adds nothing consequential to the Skill core in the current context.
- `needs-context`: information needed to determine relevance is missing.

All declared References of a selected Skill are dispositioned so that References cannot be skipped silently.

Selected References are read in TOC declaration order.

```text
references[0]
→ references[1]
→ references[2]
```

This order is a deterministic acquisition order, not a global importance rank. Co-required membership is determined by condition matching. A more complex dependency field will not be added until a concrete failing case arises.

## 9. Self-contained and unstructured Skills

### Structured self-contained Skill

```json
{
  "$schema": "https://raw.githubusercontent.com/dev-hobin/agent/main/schemas/skill-toc-v0.1.schema.json",
  "when": [
    "The Skill's bounded judgment is applicable."
  ],
  "unless": [
    "A declared sibling boundary owns the question."
  ],
  "references": []
}
```

Root applicability is machine-visible, but `SKILL.md` owns the entire method.

### Unstructured Skill

No default `toc.json` or schema-identified alternate is present. Pi-admitted metadata and the Skill description remain available for open-world matching, but the Capability advertises no authored applicability predicate or structured Reference inventory.

Unstructured applicability uses the same proposal protocol as structured applicability. `matchedWhen` and `matchedUnless` must both be empty, an explicit nonblank basis is still required, and `applicable | not-applicable | needs-context` retain their ordinary meaning. The runtime does not invent a synthetic `when` merely to permit assignment.

### Invalid or ambiguous descriptor

A default `toc.json` that fails validation, or an alternate descriptor that declares the recognized schema but fails validation, is not treated as absent. Multiple recognized descriptors are also invalid. Developer rejects the structured routing advertisement rather than choosing silently.

Pi may still expose the underlying Skill independently of Developer.

## 10. What does not belong in TOC

| Information | Owner |
| --- | --- |
| Core Question and Judgment Spine | `SKILL.md` |
| Skill Output and Completion | `SKILL.md` |
| Method, Artifact, Stop, Boundary | Reference Markdown |
| Skill name and provenance | discovery/compiler |
| Reference ID | normalized path/compiler |
| Skill applicability result | runtime |
| Reference dispositions | runtime |
| Selected content hashes | runtime |
| Material application | runtime Contribution |
| Residual or emergent Need | runtime Contribution |
| Need Coverage | Upper Judgment runtime |
| Conclusion | Upper Judgment synthesis |

Authors do not duplicate these values in the TOC.

## 11. Runtime refinement pipeline

Strong enforcement comes from generated refined values, not from a large authoring schema.

```text
Pi-admitted Skill material
  → exact bounded Skill bytes
  → structured: default-or-schema-identified TOC bytes → Parsed TOC
    | unstructured: explicit versioned no-TOC state
  → source-bound Capability revision
  → Capability Applicability
  → Capability Assignment
  → structured: Reference Dispositions → Reference Selection
    | unstructured: no synthetic Reference route
  → Sealed Skill Context
  → Skill Contribution
  → Need Coverage
```

### Parsed TOC

Normalized canonical schema identity, `when`, `unless`, Reference paths, and Reference conditions. A default descriptor with or without its optional `$schema` declaration refines to the same value. It contains no self-declared owner or Capability ID.

### Skill-bound TOC

Binds the Parsed TOC to Pi-discovered source provenance, canonical Skill root, `SKILL.md` descriptor, generated Capability ID, and Capability revision ID.

### Unstructured Capability

Binds the explicit no-TOC routing state and exact Skill hash to the same source-bound Capability identity. It has no `toc`, `tocHash`, or declared conditions.

### Capability Applicability

```text
applicable(basis)
not-applicable(reason, evidence)
needs-context(missing)

structured applicable
  → at least one declared when matches
  → no declared unless matches

unstructured applicable
  → matchedWhen = []
  → matchedUnless = []
  → explicit basis, without a synthetic predicate
```

### Capability Assignment

Binds one Contribution Need to one selected Skill and its applicability basis.

### Reference Dispositions

Every declared Reference receives `selected`, `not-needed`, or `needs-context` with a basis.

### Reference Selection

Contains exactly the selected paths in TOC declaration order. Undeclared paths cannot enter through this contract.

### Sealed Skill Context

Structured routing binds the assignment and selection to exact `SKILL.md` and selected Reference bytes, hashes, provenance, and Work Case context. Unstructured routing binds the assignment directly to exactly one admitted Skill file. It preserves an empty selected-Reference set and has no synthetic `selectionId`.

### Skill Contribution

States which Need it addresses, which selected References were applied, what result they produced, and which limitations or residual Needs remain.

### Need Coverage

Upper Judgment classifies the Need as `covered`, `partially-covered`, `conflicted`, or `missing`.

## 12. Authoring enforcement

Schema and package checks enforce only what authors actually write.

```text
canonical `$schema` optional in `toc.json`, required and const in alternates
unknown fields rejected
when/unless arrays non-empty and duplicate-free
Reference paths unique
Reference when arrays non-empty and duplicate-free
path uses normalized relative POSIX syntax
no absolute, empty, dot, dot-dot, or backslash segments
file exists and is regular
realpath remains under Skill root
symlink escape rejected
all shipped files under the route-material directory are declared
```

A parser returns a refined immutable TOC. It does not validate raw JSON and then continue using the raw object.

## 13. Capability routing enforcement

For each Contribution Need:

1. Discover available package, external, and project-local Capabilities.
2. For structured Skills, assess root `when` and `unless` against the exact Need and context. For unstructured Skills, use an explicit open-world basis with empty condition matches.
3. Preserve `needs-context` instead of guessing applicability.
4. Select the smallest set of Skills that can make non-substitutable Contributions to required Needs.
5. Record every assignment against the exact Need and Skill identity.
6. Leave external decisions unresolved; Skill applicability cannot substitute for permission or product choice.

The engine can enforce state shape and identities. Whether natural-language conditions materially match remains owned by the model or evaluator and must include an explicit basis.

## 14. Reference routing enforcement

For each selected structured Skill:

1. Assess every declared `references[].when` against the assigned Need and current context.
2. Record `selected`, `not-needed`, or `needs-context` with a basis.
3. Select every matching Reference, not a preferred subset.
4. Preserve TOC declaration order among selected References.
5. If any consequential Reference remains `needs-context`, do not claim a fully resolved local Contribution.
6. Read no undeclared path through the TOC contract.
7. If no Reference is selected, record why `SKILL.md` alone is sufficient.

A Reference may become relevant after another selected material exposes new evidence. The runtime rebuilds dispositions and selection rather than mutating an old sealed context.

## 15. Exact reading and staleness

Selection and content acquisition form one atomic boundary.

```text
structured:
  Capability Assignment
  + Reference Selection
    ↓ acquire
  exact SKILL.md bytes
  + exact selected Reference bytes
  + hashes and provenance
    ↓
  Sealed Skill Context with selectionId

unstructured:
  Capability Assignment
  + admitted exact Skill file path
    ↓ acquire
  exactly one Skill material
  + hash and provenance
    ↓
  Sealed Skill Context without selectionId
```

No sealed value is returned if a selected member:

- is missing, unreadable, non-regular, invalid UTF-8, truncated, or over byte limits;
- differs from its selected descriptor or expected hash;
- escapes the lexical or physical Skill root;
- belongs to another Skill, Work Case, branch, or structured selection;
- is only partially acquired when the structured batch fails.

A direct-file Skill and a directory Skill’s `SKILL.md` use the same unstructured sealing contract: the admitted exact file path is acquired as one regular, bounded UTF-8 material. Parent-directory TOC or Reference discovery is not reopened during sealing.

Identity chain:

```text
Pi source kind + canonical source locator + Skill-relative root
  → capabilityId

capabilityId + exact SKILL.md + (normalized TOC | versioned no-TOC marker)
  → capabilityRevisionId

Contribution Need + Work Case + capabilityRevisionId + applicability basis
  → assignmentId

structured assignment + all Reference dispositions
  → selectionId

structured selection + exact Skill and selected Reference bytes
  → sealedContextId

unstructured assignment + capabilityRevisionId + exact admitted Skill file bytes
  → sealedContextId

assignment + sealed context + material applications + result + residuals
  → contributionId

Need + current Contributions + conflicts + limitations
  → coverageId
```

Changing selected TOC conditions, the Skill body, a selected Reference body, the Need, a disposition, or Work Case context invalidates dependent values. Name alone never establishes continuity. Adding an unrelated Capability or changing an unselected Reference body does not stale an already sealed contribution basis.

Model or provider identity is not part of Capability ID, Capability revision ID, assignment ID, selection ID, or sealed context ID. Switching models does not stale accepted routing state. A normalized Contribution records proposal provenance separately so a later evaluator can inspect who or what produced it without turning that provenance into authority.

## 16. Contribution enforcement

Skill Contribution must state:

```text
assigned Need ID
selected Skill identity
sealed context identity
selected References
how each selected Reference changed the result
result supplied to Upper Judgment
limitations
residual or emergent Needs
local status
```

Every selected Reference requires a question-specific application relation. A sealed unstructured context has an exact empty selected-Reference set, so its Contribution must carry `referenceApplications: []`. Any synthetic Reference application is rejected rather than treated as additional evidence.

```text
selected material:
  temporal-behavior-models.md

insufficient application:
  this was useful

bounded application:
  duplicate and reorder traces expose a missing frame condition; progress remains
  conditional on eventual acknowledgment
```

A selected Reference without an application disposition prevents a locally complete Contribution.

Forbidden:

- citing an unselected Reference;
- omitting a selected Reference from application accounting;
- declaring local resolution while Reference relevance remains `needs-context`;
- internally invoking a sibling Skill instead of returning a residual Need;
- declaring Need Coverage or Upper Conclusion.

## 17. Need Coverage and Upper synthesis

```text
Contribution Need
+ all Contributions addressing it
+ conflicts
+ limitations
+ residual Needs
→ Need Coverage
```

Coverage meanings:

- `covered`: enough support exists to evaluate the related Closure Requirement.
- `partially-covered`: useful support exists, but a consequential residual remains.
- `conflicted`: material Contributions support incompatible interpretations.
- `missing`: no usable Contribution addresses the Need.

Upper Judgment may conclude only after required Needs have acceptable Coverage and the Category’s Closure Requirements are met.

```text
Skill local resolved
≠ Need covered

Need covered
≠ Upper Judgment concluded
```

## 18. Cross-Skill boundary

Skill-local routing can select only its declared References.

```text
deeper distinction within the same Skill family
  → local Reference selection

question belonging to an independent capability family
  → residual or emergent Need
  → Upper Judgment routes again
```

A Skill-local protocol cannot assign a sibling Skill. This preserves Need identity, cross-Skill visibility, duplicate detection, and Upper synthesis ownership.

The separation condition itself belongs in `SKILL.md` or Reference Boundary text, not duplicated in the TOC.

## 19. Deterministic and semantic guarantees

### Deterministically enforceable

- authoring shape, uniqueness, path containment, and file existence;
- owner binding outside the TOC;
- applicability and disposition state shape;
- declared-path-only selection;
- deterministic selected Reference order;
- exact content sealing and staleness;
- selected-material application completeness;
- Contribution-to-assignment identity;
- Coverage and Conclusion citation boundaries;
- replay consistency.

### Model- or evaluator-owned

- whether `when` and `unless` materially match;
- whether one Skill adds non-substitutable value;
- whether a Reference distinction was honestly applied;
- whether the resulting Contribution is semantically correct;
- whether Need Coverage is adequate for a Closure Requirement;
- whether evidence supports the domain Claim.

The runtime cannot prove these semantic claims. It can require an explicit basis, preserve exact provenance, reject stale or structurally impossible claims, and attach stronger evaluator or user assurance when available.

### Model-neutral routing boundary

Applicability, Reference disposition, material application, Contribution, and Coverage proposals use the same semantic contract regardless of model, provider, prompt style, tool-call dialect, or human evaluator.

```text
provider/model response
  → adapter normalization
    → model-neutral routing proposal
      → deterministic shape and identity checks
        → accepted proposal or explicit rejection
```

- Work Core and the TOC schema contain no provider or model names.
- Provider-specific parsing, retries, and prompt tuning do not change routing semantics.
- Malformed, refused, empty, or timed-out output cannot become `not-applicable`, `not-needed`, `covered`, or resolved by default.
- A model switch does not change Capability or sealed context identity.
- Proposal provenance may name a model or provider, but does not increase permission, Coverage, or Conclusion authority.
- Semantic variance is expected; admissible states, required basis, provenance, and failure behavior remain invariant.

## 20. Failure behavior

| Failure | Required outcome |
| --- | --- |
| Default and schema-identified TOC both absent | Capability remains unstructured. |
| Pi excludes a same-name candidate | Developer follows the Pi-selected catalog and does not reconstruct the excluded source. |
| Recognized TOC fails validation | Structured routing advertisement rejected; no silent fallback. |
| Multiple matching descriptors | Ambiguous TOC failure; none selected. |
| Known schema family has unsupported version | Unsupported-version failure; no network fallback. |
| Structured root applicability uncertain | `needs-context`; no positive assignment. |
| Unstructured applicability uncertain | `needs-context`; no synthetic condition or positive assignment. |
| Reference relevance uncertain | Selection remains unresolved or Contribution remains partial. |
| Selected file missing or drifted | Atomic sealing failure. |
| Undeclared Reference nominated | Selection rejected. |
| Selected Reference unused | Locally complete Contribution rejected. |
| Sibling capability discovered locally | Residual Need returned upward. |
| Contribution names another Need | Contribution rejected. |
| Contributions conflict | Coverage is conflicted, not silently covered. |
| Required Need missing | Upper complete transition rejected. |

## 21. Existing-policy migration

### Existing `judgment.json`

Its authoring shape is already close to the proposed TOC.

Retain:

```text
root when
root overriding unless
references[].path
references[].when
absence normal
malformed presence rejected
owner supplied outside file
```

### Removed route-policy representation

The earlier richer route metadata was migration evidence, not fields users must reproduce.

Move information to its actual owner:

| Current route information | New owner |
| --- | --- |
| route question | Reference title and purpose |
| method step | Reference method body |
| artifacts | Reference Artifact section |
| stop | Reference Stop section |
| separation boundary | Skill or Reference Boundary section |
| reference set | independently matching `references[].when` conditions |
| read order | TOC declaration order |
| exemption | runtime no-Reference selection basis |

No dual-format compatibility loader exists. Cutover is complete: every reference-bearing packaged Skill has one canonical TOC, and semantic selection fixtures verify required Skill and Reference choices.

## 22. Authoring complexity budget

No new TOC field is admitted merely because the runtime records the corresponding fact.

A field may be added only when:

```text
a representative authoring case cannot be expressed with when/unless/path
&& the missing distinction changes selected content or safety
&& SKILL.md, Reference Markdown, or runtime generation cannot own it
&& a finite failing fixture demonstrates the gap
```

Co-required grouping, explicit route IDs, artifact declarations, custom read orders, sibling Skill links, confidence, assurance, and Coverage do not currently pass this gate.

## 23. First implementation queue

Each item has an independent module, focused failing check, and green commit. The next item must compose the previous module’s explicit output without modifying that module.

1. Complete Reference Selection: every declared Reference is dispositioned exactly once, uncertainty is preserved, and selected paths follow declaration order.
2. Parse one default-or-schema-identified TOC: raw bytes either become one immutable Parsed TOC or fail before owner binding and file acquisition.
3. Bind one Capability: Pi source provenance and Skill-relative root generate Capability identity; exact Skill plus normalized TOC or an explicit versioned no-TOC marker generate revision identity.
4. Accept one applicability proposal: `applicable | not-applicable | needs-context` requires model-neutral basis and binds exactly one Need and Capability revision.
5. Seal one selected context: selected paths are acquired atomically with containment, exact bytes, hashes, and provenance.
6. Accept one Skill Contribution: assignment and sealed context identities match and every selected Reference has an application disposition.
7. Assess one Need Coverage proposal: current Contributions produce `covered | partially-covered | conflicted | missing` without Skill authority leakage.
8. Close one Judgment: required Coverage and Closure Requirements either produce one Conclusion or an explicit refusal.
9. Compose the modules directly in one deterministic Judgment-routing slice test covering success, needs-context, drift, partial, and conflict.
10. Pilot the same slice with `verify`, `model`, an external fixture Skill, and materially different evaluator adapters.
11. Only after the pure slice passes, expose it through the Pi adapter.
12. Convert remaining first-party Skills and remove old policy formats in one explicit cutover.

Do not begin with TUI, XState, automatic migration generation, a generalized router, or a coordinator class. Composition belongs in the slice test until repeated pressure earns an orchestration surface.

## 24. Verification targets

### Authoring

- a simple TOC can be written without repeating Skill or Reference bodies;
- default `toc.json` works without `$schema`, while alternate filenames require the exact schema inside Pi-discovered Skill roots;
- a default plus an alternate, duplicate alternates, and unsupported schema versions fail clearly;
- same names from different source descriptors cannot collapse into one runtime identity;
- Capability revision changes with SKILL or TOC content, but not with unselected Reference body drift;
- Pi-excluded same-name candidates are not recovered by an independent Developer scan;
- unknown fields and malformed conditions fail clearly;
- path traversal and symlink escape fail;
- every declared file exists;
- every first-party route material is declared;
- absence of both descriptor forms remains normal, while an invalid default or recognized alternate remains visible.

### Selection

- one Need selects zero, one, or several Skills;
- one selected Skill selects zero, one, or several References;
- `unless` overrides `when`;
- every Reference is dispositioned;
- all matching References are selected in declaration order;
- missing context does not become `not-needed`;
- a cross-Skill question returns upward.

### Contribution and Coverage

- exact selected contents are bound to the Contribution;
- every selected Reference has an applied difference or explicit limitation;
- a Skill cannot claim Coverage;
- partial and conflicting Contributions remain visible;
- missing required Coverage prevents Upper completion;
- replay detects selected-content and Need drift.

### Model neutrality

- two materially different model adapters and a deterministic fake evaluator emit the same proposal shape;
- model substitution preserves accepted Work Case, assignment, selection, and sealed context identities;
- malformed, refused, empty, and timed-out outputs produce no implicit routing or closure state;
- provider metadata remains provenance and never becomes Capability identity or assurance authority;
- provider-specific prompt or parsing changes cannot alter deterministic transition guards.

## 25. Open questions

The following remain provisional and should be decided through fixtures rather than additional authoring fields.

- Whether declaration order is sufficient for all real co-required Reference cases.
- Whether every Reference must be dispositioned or a bounded candidate shortlist can preserve omission safety at lower context cost.
- How stronger evaluator and user assurance attach to Contributions.
- Whether Pi will expose trust-filtered pre-dedup source descriptors and a disambiguated command surface for same-name coexistence.
- Whether one Skill Contribution may address several Needs or batching remains a projection over one-Need assignments.

Reopen the authoring shape only when a finite selection fixture cannot express an accepted case without weakening an invariant.
