# Developer Action Loop Routing Contract v0.1

> 상태: reconstruction design contract
>
> 관련 문서:
> [Action Loop Architecture](./action-loop-architecture-v0.1.ko.md) ·
> [Action Loop Concept Vocabulary](./action-loop-concept-vocabulary-v0.1.ko.md)
>
> 기준선: `@hobin/developer@0.1.19`
>
> Runtime note: 이 문서는 새 schema-identified TOC descriptor의 최소 authoring surface와 runtime enforcement boundary를 정의한다. 0.1.19 runtime은 이를 구현하지 않는다. 기존 `judgment.json`과 `reference-policy.json`은 compatibility target이 아니라 migration evidence다.
>
> 작성 시점: 2026-08-06

## 1. 설계 교정

첫 TOC candidate는 runtime이 필요한 identity, artifact, stop, route grouping, handoff, coverage 정보를 모두 사용자가 작성하게 했다.

```text
contribution contract
route question
route artifacts
route stop
separate conditions
read grouping and order
material application
```

이 shape는 강한 runtime을 만들 수는 있지만 authoring surface로는 사용할 수 없다. 같은 의미가 `SKILL.md`, Reference body, runtime protocol에 이미 있는데 TOC에 다시 작성하도록 요구하기 때문이다.

새 원칙은 다음과 같다.

> Author는 applicability와 local material relevance만 작성한다. Content contract는 Markdown이 소유하고, identity·selection·provenance·coverage의 복잡성은 compiler와 runtime이 생성한다.

따라서 TOC descriptor는 기존 `judgment.json`과 비슷한 작은 shape를 유지한다. `toc.json`은 권장 filename일 뿐 identity가 아니다.

## 2. 해결할 linking 구조

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

두 linking 단계는 같은 Contribution Need와 current context를 순차적으로 사용한다.

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

Category는 Skill names를 소유하지 않고, Skill은 sibling Skills를 소유하지 않는다.

## 3. Responsibility ownership

### Upper Judgment Category

Stable question과 Closure Requirements를 소유한다. Skill 또는 Reference inventory를 소유하지 않는다.

### Contribution Need

현재 Closure Requirement를 판단하기 위해 부족한 input을 표현한다.

### `SKILL.md`

Skill family의 Core Question, Judgment Spine, Output, Completion, Missing Evidence, Boundary를 소유한다.

### Schema-identified TOC descriptor

Skill family applicability와 Skill-local Reference relevance만 소유한다. Pi가 발견한 Skill root의 direct-child JSON 가운데 canonical `$schema`를 선언한 문서로 식별한다.

### Reference Markdown

구체적인 method, distinctions, examples, artifact, stop, counterexample, separation boundary를 소유한다.

### Compiler and runtime

Owner binding, IDs, hashes, selection state, exact content, applied-material relation, Contribution, limitations, residual Needs, Need Coverage, staleness를 소유한다.

## 4. Minimal TOC descriptor

```json
{
  "$schema": "https://raw.githubusercontent.com/dev-hobin/agent/main/packages/developer/schemas/skill-toc-v0.1.schema.json",
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

이것이 전체 authoring shape다. `toc.json`을 권장하지만 filename은 계약이 아니다.

No route IDs, artifact declarations, stop strings, sibling Skill links, hashes, Coverage fields, or runtime state are authored here.

## 5. Discovery and field contract

### Descriptor discovery

Developer는 임의의 filesystem을 검색하지 않는다. 먼저 Pi가 package, global, project, settings, 또는 CLI source에서 Skill을 발견해야 한다. Project Skill은 Pi trust boundary를 통과해야 한다.

각 discovered Skill root에서만 bounded discovery를 수행한다.

```text
Pi-discovered Skill root
  → direct-child regular `*.json` files only
  → bounded file count and bytes
  → top-level `$schema` exact match
  → one recognized TOC descriptor
```

- matching descriptor 0개: unstructured Capability다.
- matching descriptor 1개: parse, validate, and bind한다.
- matching descriptor 2개 이상: ambiguous TOC failure다.
- known TOC schema family의 unsupported version: unsupported-version failure다.
- nested JSON과 Skill root 밖의 JSON은 후보가 아니다.
- runtime은 schema URI를 network fetch하지 않고 bundled validator에 exact mapping한다.
- `toc.json`은 authoring convention일 뿐 다른 direct-child filename도 같은 schema URI로 식별할 수 있다.

### `$schema`

Required document-kind and authoring-version discriminator다. 값은 schema가 `const`로 요구하고 compiler가 지원하는 canonical URI와 exact match해야 한다. Editor association, discovery, validation selection을 한 field가 담당한다.

Schema URI는 package version과 runtime event version과 독립적이며 normalized TOC identity에 포함된다.

### Human name and runtime identity

Skill frontmatter의 `name`은 사람, model, `/skill:name` surface를 위한 label이지 runtime identity가 아니다.

Developer는 사용자가 ID를 authoring하게 하지 않는다. Pi Adapter가 discovered source provenance로 모든 Capability에 opaque identity를 부여한다.

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
    normalized TOC hash
  )
```

`CapabilityId`는 어느 source의 어느 Skill occurrence인지를 보존한다. `CapabilityRevisionId`는 같은 occurrence의 current Skill and TOC content state를 보존한다. Selected Reference hashes는 더 뒤의 Sealed Skill Context가 소유하므로 unselected Reference body drift만으로 Capability revision을 바꾸지 않는다.

```text
name: model
source: package:@hobin/developer/skills/model
capabilityId: cap_A

name: model
source: project:.pi/skills/model
capabilityId: cap_B
```

이론적으로 두 occurrences는 같은 name이어도 다른 Capability다. 그러나 현재 Pi는 same-name Skills를 Developer inventory 이전에 경고하고 하나만 유지한다. V0 Developer는 Pi가 제외한 candidate를 독자적인 filesystem scan으로 복원하지 않는다.

```text
Pi-selected descriptor
  → Developer Capability inventory

Pi-excluded same-name descriptor
  → not reconstructed by Developer
```

따라서 v0에서 동시에 사용해야 하는 local Skills는 `payment-model`, `company-contract-model`처럼 distinct human names를 사용한다. Same-name coexistence는 Pi가 trust와 filtering을 적용한 pre-dedup source descriptors와 disambiguated command surface를 제공할 때 재검토한다.

### `when`

현재 Contribution Need와 context에서 이 Skill family가 material Contribution을 만들 수 있는 observable conditions다.

적어도 하나가 materially match해야 structured applicability가 성립한다.

### `unless`

Skill family의 explicit exclusions다. `when`과 동시에 match하면 `unless`가 우선한다.

Evidence가 부족한 상태는 `unless`가 아니라 runtime `needs-context`다.

### `references`

Skill-local prepared materials다. Empty array는 self-contained Skill을 표현할 수 있다.

Matching TOC schema descriptor가 없는 Skill도 정상적인 unstructured Capability로 발견될 수 있다.

### `references[].path`

Skill root 아래의 normalized relative POSIX path다. Runtime Reference identity의 stable source가 된다.

### `references[].when`

현재 assigned Need와 context에서 이 Reference가 Skill core에 material distinction을 추가하는 conditions다.

유용한 문장은 observable pressure와 추가되는 distinction을 함께 말한다.

```text
Too broad:
  When temporal behavior is involved.

Useful:
  Retry, duplicate, reorder, safety, or progress is consequential, and this
  material adds allowed-history, frame-condition, and liveness distinctions.
```

## 6. Concrete `verify/toc.json`

`toc.json`이라는 권장 filename을 사용한 예다.

```json
{
  "$schema": "https://raw.githubusercontent.com/dev-hobin/agent/main/packages/developer/schemas/skill-toc-v0.1.schema.json",
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

If the Reference condition does not match, `SKILL.md` alone may produce the Contribution. Runtime records why no prepared Reference added a consequential distinction.

## 7. Several References

`model`의 일부를 축약하면 다음과 같다.

```json
{
  "$schema": "https://raw.githubusercontent.com/dev-hobin/agent/main/packages/developer/schemas/skill-toc-v0.1.schema.json",
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

Contract-replacement case에서는 `problem-modeling.md`와 `contract-and-replacement-models.md` 조건이 모두 match한다. Temporal case에서는 `problem-modeling.md`와 `temporal-behavior-models.md`가 모두 match한다.

별도 user-authored route group은 없다. Co-required relation은 complete relevance conditions가 같은 case에서 함께 match함으로써 나타난다.

## 8. Selection and reading order

각 Reference는 독립적으로 disposition된다.

```text
selected
not-needed
needs-context
```

- `selected`: current Need에 material distinction을 추가한다.
- `not-needed`: current context에서 Skill core에 consequential addition이 없다.
- `needs-context`: relevance를 판단할 information이 부족하다.

Reference를 조용히 건너뛰지 않도록 selected Skill의 declared References는 모두 disposition한다.

선택된 References는 TOC declaration order로 읽는다.

```text
references[0]
→ references[1]
→ references[2]
```

이 순서는 deterministic acquisition order이지 global importance rank가 아니다. Co-required membership은 condition matching으로 결정된다. 더 복잡한 dependency field는 concrete failing case가 생길 때까지 추가하지 않는다.

## 9. Self-contained and unstructured Skills

### Structured self-contained Skill

```json
{
  "$schema": "https://raw.githubusercontent.com/dev-hobin/agent/main/packages/developer/schemas/skill-toc-v0.1.schema.json",
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

No matching TOC schema descriptor is present. Pi metadata and Skill description remain available for open-world matching, but the Capability advertises no structured Reference inventory.

### Invalid or ambiguous descriptor

A parseable direct-child JSON that declares the recognized schema but fails validation is not treated as absence. Multiple matching descriptors are also invalid. Developer rejects the structured routing advertisement instead of choosing silently.

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

Authors do not duplicate these values in TOC.

## 11. Runtime refinement pipeline

Strong enforcement comes from generated refined values, not a large authoring schema.

```text
Pi-discovered Skill root
  → schema-identified TOC bytes
  → Parsed TOC
  → Skill-bound TOC
  → Capability Applicability
  → Capability Assignment
  → Reference Dispositions
  → Reference Selection
  → Sealed Skill Context
  → Skill Contribution
  → Need Coverage
```

### Parsed TOC

Normalized `$schema`, `when`, `unless`, Reference paths, Reference conditions, and authoring identity. It contains no self-declared owner or Capability ID.

### Skill-bound TOC

Binds Parsed TOC to Pi-discovered source provenance, canonical Skill root, `SKILL.md` descriptor, generated Capability ID, and Capability revision ID.

### Capability Applicability

```text
applicable(basis)
not-applicable(reason, evidence)
needs-context(missing)
```

### Capability Assignment

Binds one Contribution Need to one selected Skill and applicability basis.

### Reference Dispositions

Every declared Reference receives `selected`, `not-needed`, or `needs-context` with basis.

### Reference Selection

Contains exactly the selected paths in TOC declaration order. Undeclared paths cannot enter through this contract.

### Sealed Skill Context

Binds the assignment and selection to exact `SKILL.md` and selected Reference bytes, hashes, provenance, and Work Case context.

### Skill Contribution

States which Need it addresses, which selected References were applied, what result they produced, and which limitations or residual Needs remain.

### Need Coverage

Upper Judgment classifies the Need as `covered`, `partially-covered`, `conflicted`, or `missing`.

## 12. Authoring enforcement

Schema and package checks enforce only what authors actually write.

```text
canonical `$schema` required and const
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
2. Assess each viable Skill's root `when` and `unless` against the exact Need and context.
3. Preserve `needs-context` instead of guessing applicability.
4. Select the smallest set of Skills that can make non-substitutable Contributions to required Needs.
5. Record every assignment against exact Need and Skill identity.
6. Leave external decisions unresolved; Skill applicability cannot substitute for permission or product choice.

The engine can enforce state shape and identities. Whether natural-language conditions materially match remains model- or evaluator-owned and must include explicit basis.

## 14. Reference routing enforcement

For each selected structured Skill:

1. Assess every declared `references[].when` against the assigned Need and current context.
2. Record selected, not-needed, or needs-context with basis.
3. Select every matching Reference, not a preferred subset.
4. Preserve TOC declaration order among selected References.
5. If any consequential Reference remains needs-context, do not claim a fully resolved local Contribution.
6. Read no undeclared path through the TOC contract.
7. If no Reference is selected, record why `SKILL.md` alone is sufficient.

A Reference may become relevant after another selected material exposes new evidence. Runtime rebuilds dispositions and selection rather than mutating an old sealed context.

## 15. Exact reading and staleness

Selection and content acquisition form one atomic boundary.

```text
Capability Assignment
+ Reference Selection
  ↓ acquire
exact SKILL.md bytes
+ exact selected Reference bytes
+ hashes and provenance
  ↓
Sealed Skill Context
```

No sealed value is returned if a selected member:

- is missing, unreadable, non-regular, invalid UTF-8, truncated, or over byte limits;
- differs from its selected descriptor or expected hash;
- escapes the lexical or physical Skill root;
- belongs to another Skill, Work Case, branch, or selection;
- is only partially acquired when the batch fails.

Identity chain:

```text
Pi source kind + canonical source locator + Skill-relative root
  → capabilityId

capabilityId + exact SKILL.md + normalized TOC
  → capabilityRevisionId

Contribution Need + Work Case + capabilityRevisionId + applicability basis
  → assignmentId

assignment + all Reference dispositions
  → selectionId

selection + exact Skill and selected Reference bytes
  → sealedContextId

assignment + sealed context + material applications + result + residuals
  → contributionId

Need + current Contributions + conflicts + limitations
  → coverageId
```

Changing selected TOC conditions, Skill body, selected Reference body, Need, disposition, or Work Case context invalidates dependent values. Name alone never establishes continuity. Adding an unrelated Capability or changing an unselected Reference body does not stale an already sealed contribution basis.

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

Every selected Reference requires a question-specific application relation.

```text
selected material:
  temporal-behavior-models.md

insufficient application:
  this was useful

bounded application:
  duplicate and reorder traces expose a missing frame condition; progress remains
  conditional on eventual acknowledgment
```

A selected Reference with no application disposition prevents a locally complete Contribution.

Forbidden:

- citing an unselected Reference;
- omitting a selected Reference from application accounting;
- declaring local resolution while Reference relevance remains needs-context;
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
- `partially-covered`: useful support exists but consequential residual remains.
- `conflicted`: material Contributions support incompatible interpretations.
- `missing`: no usable Contribution addresses the Need.

Upper Judgment may conclude only after required Needs have acceptable Coverage and the Category's Closure Requirements are met.

```text
Skill local resolved
≠ Need covered

Need covered
≠ Upper Judgment concluded
```

## 18. Cross-Skill boundary

Skill-local routing can only select its declared References.

```text
same Skill family의 deeper distinction
  → local Reference selection

independent capability family의 question
  → residual or emergent Need
  → Upper Judgment routes again
```

Skill-local protocol cannot assign a sibling Skill. This preserves Need identity, cross-Skill visibility, duplicate detection, and Upper synthesis ownership.

The separation condition itself belongs to `SKILL.md` or Reference Boundary text, not duplicated in TOC.

## 19. Deterministic and semantic guarantees

### Deterministically enforceable

- authoring shape, uniqueness, path containment, file existence;
- owner binding outside TOC;
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

The runtime cannot prove these semantic claims. It can require explicit basis, preserve exact provenance, reject stale or structurally impossible claims, and attach stronger evaluator or user assurance when available.

## 20. Failure behavior

| Failure | Required outcome |
| --- | --- |
| Matching TOC schema absent | Capability remains unstructured. |
| Pi excludes a same-name candidate | Developer follows the Pi-selected catalog and does not reconstruct the excluded source. |
| Recognized TOC fails validation | Structured routing advertisement rejected; no silent fallback. |
| Multiple matching descriptors | Ambiguous TOC failure; none selected. |
| Known schema family has unsupported version | Unsupported-version failure; no network fallback. |
| Root applicability uncertain | `needs-context`; no positive structured assignment. |
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

### Existing `reference-policy.json`

Use its richer route metadata as migration evidence, not as fields users must reproduce.

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

Do not build a dual-format compatibility loader. Cutover occurs after semantic selection fixtures prove the new TOCs preserve required Skill and Reference choices.

## 22. Authoring complexity budget

No new TOC field is admitted merely because runtime records the corresponding fact.

A field may be added only when:

```text
a representative authoring case cannot be expressed with when/unless/path
&& the missing distinction changes selected content or safety
&& SKILL.md, Reference Markdown, or runtime generation cannot own it
&& a finite failing fixture demonstrates the gap
```

Co-required grouping, explicit route IDs, artifact declarations, custom read orders, sibling Skill links, confidence, assurance, and Coverage do not currently pass this gate.

## 23. First implementation queue

1. Add valid and invalid fixtures for schema discovery, simple, multi-Reference, no-Reference, duplicate-descriptor, unsupported-version, malformed, drift, and external-Skill cases.
2. Write the minimal versioned TOC JSON Schema with a canonical `$schema` const.
3. Implement bounded direct-child discovery, bundled schema mapping, raw-to-refined parsing, path checks, and physical containment.
4. Bind Parsed TOC to Pi source provenance and generate Capability ID and Capability revision ID without self-declared ownership or identity.
5. Implement pure Capability Applicability and Reference Disposition values.
6. Implement selected-path-only acquisition and Sealed Skill Context.
7. Implement selected-material application accounting in Skill Contribution.
8. Implement Need Coverage as an Upper Judgment relation.
9. Pilot `verify` and `model`; compare expected Skill and Reference selections against current policies.
10. Only after pure traces pass, expose the transitions through the Pi adapter.
11. Convert remaining first-party Skills and remove old policy formats in one explicit cutover.

The first executable item is the minimal schema/parser and finite selection fixtures. Do not begin with TUI, XState, automatic migration generation, or a generalized routing framework.

## 24. Verification targets

### Authoring

- simple TOC can be written without repeating Skill or Reference bodies;
- filename-independent exact schema discovery works only inside Pi-discovered Skill roots;
- duplicate descriptors and unsupported schema versions fail clearly;
- same names from different source descriptors cannot collapse to one runtime identity;
- Capability revision changes with SKILL or TOC content but not unselected Reference body drift;
- Pi-excluded same-name candidates are not recovered by an independent Developer scan;
- unknown fields and malformed conditions fail clearly;
- path traversal and symlink escape fail;
- every declared file exists;
- every first-party route material is declared;
- absent matching schema remains normal and recognized invalid presence remains visible.

### Selection

- one Need selects zero, one, or several Skills;
- one selected Skill selects zero, one, or several References;
- `unless` overrides `when`;
- every Reference is dispositioned;
- matching References are all selected in declaration order;
- missing context does not become not-needed;
- cross-Skill question returns upward.

### Contribution and Coverage

- exact selected contents are bound to Contribution;
- every selected Reference has an applied difference or explicit limitation;
- Skill cannot claim Coverage;
- partial and conflicting Contributions remain visible;
- missing required Coverage prevents Upper completion;
- replay detects selected-content and Need drift.

## 25. Open questions

The following remain provisional and should be decided through fixtures rather than more authoring fields.

- Whether every first-party Skill should have a TOC, including empty `references`, or leaf Skills may remain unstructured.
- Whether declaration order is sufficient for all real co-required Reference cases.
- Whether every Reference must be dispositioned or a bounded candidate shortlist can preserve omission safety at lower context cost.
- How stronger evaluator and user assurance attach to Contributions.
- Which independent package, if any, owns the reusable schema; Developer must not regain a runtime dependency on Judgment merely for parsing.
- Whether Pi will expose trust-filtered pre-dedup source descriptors and a disambiguated command surface for same-name coexistence.
- Whether one Skill Contribution may address several Needs or batching remains a projection over one-Need assignments.

Reopen the authoring shape only when a finite selection fixture cannot express an accepted case without weakening an invariant.
