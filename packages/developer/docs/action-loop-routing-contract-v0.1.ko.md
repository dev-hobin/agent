# Developer Action Loop Routing Contract v0.1

> 상태: reconstruction design contract
>
> 관련 문서:
> [Action Loop Architecture](./action-loop-architecture-v0.1.ko.md) ·
> [Action Loop Concept Vocabulary](./action-loop-concept-vocabulary-v0.1.ko.md)
>
> 기준선: `@hobin/developer@0.1.19`
>
> Runtime note: 이 문서는 새 `toc.json` authoring surface와 enforcement pipeline의 v0 candidate를 정의한다. 0.1.19 runtime은 이를 구현하지 않는다. 기존 `judgment.json`과 `reference-policy.json`은 compatibility target이 아니라 migration evidence다.
>
> 작성 시점: 2026-08-06

## 1. 해결할 문제

Action Loop에는 두 단계의 adaptive routing이 필요하다.

```text
Upper Judgment
  → Contribution Needs
  → context-matched Skills

Selected Skill
  → local subordinate questions
  → context-matched References
```

Skill이 Reference를 위한 local router일 수 있다는 전제를 받아들이면 전체 흐름은 다음과 같다.

```text
Closure Requirements
  ↓
Contribution Needs
  ↓ Capability Routing
Skill Routers
  ↓ Material Routing
Reference Routes
  ↓
Route Artifacts
  ↓ Skill-local composition
Contributions
  ↓ Need Coverage
Upper Judgment Synthesis
  ↓
Conclusion
```

현재 빠진 것은 이 흐름을 authoring data로 표현하고, runtime이 다음 위반을 막는 계약이다.

- Category가 fixed Skill names를 소유한다.
- Applicable해 보이는 모든 Skill과 Reference를 읽는다.
- Reference 하나만 읽고 co-required route 전체를 수행했다고 주장한다.
- Skill이 sibling Skill을 내부에서 호출해 cross-Skill routing을 숨긴다.
- Selected material이 Contribution에 어떤 차이를 만들었는지 기록되지 않는다.
- Skill output이 Need Coverage와 Upper Conclusion을 스스로 확정한다.
- TOC, Skill, Reference content가 바뀌었는데 이전 결과를 재사용한다.
- Malformed TOC를 absent TOC처럼 처리한다.

## 2. Accepted semantic contract

이 문서가 전제로 삼는 의미는 다음과 같다.

### Upper Judgment Category

Stable question과 Closure Requirements를 소유한다. Skill이나 Reference names를 소유하지 않는다.

### Contribution Need

현재 Closure Requirement를 판단하기 위해 부족한 input을 표현한다.

### Skill

하나의 Contribution family에 대한 applicability boundary, local route inventory, route selection, local composition, handoff boundary를 소유한다.

### Reference Route

하나의 independently stoppable subordinate question과 그것을 수행하는 co-required materials를 소유한다.

### Contribution

선택된 route artifacts를 Skill이 local하게 종합해 하나의 assigned Need에 반환한 결과다.

### Need Coverage

Upper Judgment가 Contribution이 Need를 얼마나 다뤘는지 판정한 관계다.

### Cross-Skill boundary

Skill은 local References만 route한다. Sibling Skill이 필요한 independent question은 residual or emergent Need로 Upper Judgment에 반환한다.

## 3. Representative cases

| Case | Required contract behavior |
| --- | --- |
| Self-contained leaf Skill | Direct path로 Contribution을 만들며 Reference가 필요하지 않다. |
| Pure routing Skill | 하나 이상의 Reference route 없이는 resolved Contribution을 만들지 않는다. |
| One specialized route | 하나의 route와 그 materials만 읽는다. |
| Co-required route | Route의 모든 materials를 atomic set으로 읽는다. |
| Ordered route | Declared reading order를 보존한다. |
| Several independent routes | 각각 독립 artifact와 stop이 있을 때 여러 route를 선택한다. |
| No route matches | Declared direct path가 없으면 결과를 발명하지 않는다. |
| Route needs context | Missing context가 충족되기 전 resolved result를 만들지 않는다. |
| Independent sibling question | Local route 대신 residual Need를 Upper Judgment에 반환한다. |
| Malformed TOC | 해당 structured capability source를 거부하며 absence로 downgrade하지 않는다. |
| Reference content drift | Selection 이후 content가 바뀌면 reading과 이후 Contribution을 stale 처리한다. |
| Selected material unused | Complete local Contribution을 허용하지 않는다. |
| External Skill without TOC | Unstructured Capability로 남고 prepared local routes는 주장하지 않는다. |
| Tool or external decision | Skill을 거치지 않고도 Contribution Need를 다룰 수 있다. |

## 4. Authoring representation

Reference-bearing 또는 structured direct path를 제공하는 Skill은 Skill root에 optional `toc.json`을 둘 수 있다.

```text
skills/<skill-name>/
  SKILL.md
  toc.json
  references/
    ...
```

`toc.json`은 다음 두 질문에 답한다.

1. 이 Skill family는 어떤 Contribution Need에 applicable한가?
2. Applicable한 Skill 안에서 어떤 local route와 materials가 필요한가?

Owner, package provenance, filesystem root, Skill body hash는 파일이 스스로 선언하지 않는다. Discovery와 compiler가 외부에서 결합한다.

## 5. Proposed `toc.json` shape

다음은 authoring candidate다. Field spelling은 implementation 전 schema review에서 바뀔 수 있지만 각 field의 의미와 boundary는 이 문서의 contract다.

```json
{
  "$schema": "https://raw.githubusercontent.com/dev-hobin/agent/main/packages/developer/schemas/toc.schema.json",
  "version": 1,
  "when": [
    "Several claims need different evidence or a green check may not exercise accepted meaning."
  ],
  "unless": [
    "There is no concrete correctness, compatibility, coverage, or evidence claim."
  ],
  "contribution": {
    "question": "What strongest claim does the available evidence support?",
    "stop": "The assigned Need is answered with explicit support, contradiction, limitation, and residual."
  },
  "direct": {
    "when": [
      "One narrow claim has direct relevant evidence and no local route adds an independent artifact."
    ],
    "produces": [
      {
        "id": "bounded-claim",
        "description": "The strongest claim directly supported by the current evidence."
      }
    ],
    "stop": "The exact claim, observer, evidence, and bounded residual are explicit."
  },
  "routes": [
    {
      "id": "claim-evidence-gap",
      "question": "What plausible wrong result can pass the current verifier?",
      "when": [
        "Verifier relevance, source compatibility, or pass-but-wrong risk is consequential."
      ],
      "separateWhen": [
        "The claim meaning itself is unresolved or remaining acceptance requires an external decision."
      ],
      "read": [
        {
          "path": "references/verifier-selection-and-pass-but-wrong.md",
          "adds": "Verifier relevance, plausible wrong shapes, distinguishing checks, and residual-risk boundaries."
        }
      ],
      "produces": [
        {
          "id": "claim-evidence-matrix",
          "description": "Claims, observers, evidence relevance, and residuals."
        },
        {
          "id": "distinguishing-check",
          "description": "A plausible wrong shape and the cheapest check that distinguishes it."
        }
      ],
      "stop": "Every admitted claim is supported, narrowed, contradicted, or explicitly unverified."
    }
  ]
}
```

## 6. Top-level field contract

### `$schema`

Optional editor-discovery hint. It does not enter semantic TOC identity.

### `version`

Authoring specification version. It is independent from package, runtime event, and Skill content versions.

### `when`

Observable conditions under which the Skill family can produce a material Contribution for an assigned Need.

At least one statement must materially match for structured applicability.

### `unless`

Explicit Skill-family exclusions. A matching `unless` overrides root `when`.

Insufficient evidence is not an `unless`; it produces `needs-context`.

### `contribution`

The Skill family's local composition promise.

- `question`: what the composed Contribution answers for the assigned Need.
- `stop`: what must be explicit before the Skill may return a locally resolved Contribution.

This is not the Upper Judgment Closure Requirement.

### `direct`

Optional self-contained path implemented by the Skill body without deeper material.

Direct and routed execution are mutually exclusive for one assignment. Direct may be selected only when no local route is required and its own `when` matches.

### `routes`

Zero or more local Reference routes. At least one of `direct` or `routes` must be present and non-empty in a valid TOC.

A Skill with neither structured direct behavior nor prepared routes needs no TOC.

## 7. Route field contract

### `id`

Stable capability-local identity. IDs are unique within one TOC and enter selection, result, Contribution, and replay identities.

### `question`

One subordinate question with an independent artifact and stop.

If two questions can fail independently, they require separate routes.

### `when`

Conditions under which this route is required for the assigned Need and current context.

A route is not selected merely because its topic is related.

### `separateWhen`

Conditions showing that the question belongs outside this Skill family. A match returns a residual or emergent Need to the Upper Judgment instead of invoking a sibling Skill locally.

### `read`

The complete co-required material set for this route.

- Every listed material is selected atomically with the route.
- A path is capability-local and cannot escape the Skill root.
- Reusing the same material in several routes is allowed because its route-specific `adds` relation may differ.

### `read[].adds`

The material distinction this exact file is expected to add on this route. Runtime output must state how that distinction changed the route artifact or why the route could not complete.

### `readOrder`

Optional for one material. Required for several materials.

```text
listed:
  later material assumes an earlier vocabulary, method, or artifact

any:
  every material is co-required but sequence is not semantically relevant
```

Membership and reading sequence are separate facts.

### `produces`

Inspectable route artifacts. Each artifact has a stable route-local ID and description. A route result must disposition every declared artifact.

### `stop`

The route-local completion condition. Passing this stop means the route artifact is ready for Skill-local composition, not that the assigned Need or Upper Judgment is covered.

## 8. Authoring invariants

A parsed TOC must satisfy the following before it can enter routing.

```text
unknown fields rejected
nonblank bounded statements
root when/unless statements unique
route IDs unique
artifact IDs unique within a route or direct path
at least one direct or routed path
route read sets non-empty
multi-material routes declare readOrder
single-material listed order is optional but valid
paths are normalized relative POSIX paths
no absolute, empty, dot, dot-dot, or backslash path segment
no duplicate material path inside one route
all referenced files exist and are regular files
realpath remains under the owning Skill root
symlink escape rejected
all shipped route materials are reachable or explicitly kept outside the route-material directory
```

Malformed presence is not absence.

```text
TOC absent
  → normal unstructured Capability

TOC present and valid
  → structured owner-bound Capability

TOC present and invalid
  → reject this structured Capability source
```

Pi may still expose the underlying Skill independently, but Developer must not silently route it as if the malformed TOC did not exist.

## 9. Refined runtime values

Runtime code must not validate raw JSON and continue using the raw object. Each boundary returns a stronger immutable representation.

```text
raw JSON bytes
  → ParsedToc
  → Skill-bound TocContract
  → Capability Assignment
  → Route Assessments
  → Route Selection
  → Sealed Reading
  → Route Results
  → Skill Contribution
  → Need Coverage
```

### Parsed TOC

Carries normalized authoring data, safe lexical paths, canonical authoring identity, and no owner claim.

### Skill-bound TOC contract

Binds Parsed TOC to discovered Skill identity, package/project provenance, Skill root, and Skill body descriptor.

### Capability assignment

Binds one Contribution Need to one selected Skill family and its applicability basis.

One Skill may receive several assignments, but each Need binding remains inspectable.

### Route assessment

Every local route receives one disposition for the current assignment.

```text
required
not-required
needs-context
separate
```

- `required`: select the route.
- `not-required`: record why its distinction is immaterial.
- `needs-context`: name missing context; do not claim local resolution.
- `separate`: return a residual or emergent Need to the Upper Judgment.

### Route selection

Contains either a direct path or the exact set of required route IDs, never both.

### Sealed reading

Binds the selection to exact `SKILL.md` and selected Reference bytes, hashes, provenance, branch or Work Case context, and declared reading order.

### Route result

Binds one selected route to its declared artifact dispositions, material uses, stop assessment, limitations, and residual Needs.

### Skill Contribution

Composes selected route results for exactly one Capability Assignment. It may be resolved, partial, blocked, or need more context, but it cannot determine Upper Need Coverage.

### Need Coverage

Upper Judgment relation classifying the assigned Need against one or more Contributions.

```text
covered
partially-covered
conflicted
missing
```

## 10. Identity and staleness chain

Each runtime identity incorporates the representation it depends on.

```text
discovered Skill identity + normalized TOC
  → tocContractId

Contribution Need + Work Case + Skill-bound TOC + applicability basis
  → assignmentId

assignment + all route assessments + direct/route choice
  → routeSelectionId

selection + exact Skill and Reference bytes
  → sealedReadingId

sealed reading + route artifacts + material uses + residuals
  → routeResultIds

assignment + selected route results + local limitations
  → contributionId

Need + current Contributions + conflicts + limitations
  → coverageId
```

Changing a selected TOC clause, Skill body, Reference body, assigned Need, route assessment, or Work Case context invalidates every later dependent value.

Adding an unrelated Capability or unselected route material does not stale an already sealed reading.

## 11. Capability applicability

The Capability Router evaluates Skill-family applicability before local route assessment.

```text
CapabilityApplicability =
  applicable(basis)
  | not-applicable(reason, evidence)
  | needs-context(missing)
```

Rules:

- root `unless` wins over root `when`;
- uncertainty remains `needs-context`;
- only `applicable` Skills may receive positive structured assignments;
- applicable does not mean selected;
- the Upper Router selects the smallest set that contributes non-substitutable coverage for required Needs;
- an external decision Need cannot be replaced by Skill applicability;
- Skill selection basis is recorded against the exact Need and context.

Semantic applicability is model-owned or evaluator-assisted. The engine enforces the state shape, identity, exclusions, and allowed transition; it cannot prove that natural-language conditions were interpreted honestly.

## 12. Local route selection

For one Capability Assignment:

1. Assess every local route against the assigned Need and current context.
2. Record `required`, `not-required`, `needs-context`, or `separate` with basis.
3. Select exactly every `required` route.
4. Include every material declared by each selected route.
5. Preserve route-local material grouping and `readOrder`.
6. Return every `separate` result as a residual or emergent Need.
7. If any required distinction remains `needs-context`, do not produce a locally resolved Contribution.
8. Use `direct` only when no route is required, no unresolved route context is hidden, and direct `when` matches.
9. Select no undeclared material through this contract.

A route may become required after another route exposes new local evidence. The Skill may append a new route assessment and rebuild selection. A question outside the Skill family returns upward instead of opening a sibling Skill locally.

## 13. Reading acquisition and sealing

Selection and content acquisition form one atomic transition.

```text
Route Selection
  ↓ acquire
exact SKILL.md bytes
+ exact selected Reference bytes
+ provenance
+ hashes
+ declared order
  ↓
Sealed Reading
```

No Sealed Reading is returned if any selected member:

- is missing, non-regular, unreadable, invalid UTF-8, truncated, or over byte limits;
- differs from its selected descriptor or expected content hash;
- escapes the lexical or physical Skill root;
- belongs to another Capability, Work Case, branch, or selection;
- violates the complete co-required set;
- is acquired only partially when the batch fails.

Skill metadata and TOC summaries may enter inventory without full bodies. Bodies are loaded only after exact assignment and route selection.

## 14. Route-result enforcement

A Route Result must name:

```text
route ID
sealed reading ID
artifact dispositions
material uses
stop assessment
limitations
residual Needs
status
```

Every selected material needs one question-specific use relation.

```text
material ID
expected distinction from read[].adds
actual difference made to the artifact
support, challenge, limitation, or no usable contribution
```

“This was useful” is insufficient. A selected material with no disposition prevents a complete Route Result.

Every declared artifact receives one disposition.

```text
produced
contradicted
not-producible because context is missing
not-applicable after new evidence
```

A model assertion can record semantic application but cannot raise itself to domain-verified or user-accepted assurance. Assurance remains tied to exact evaluator or user provenance when those distinctions are later required.

## 15. Skill-local composition

A Skill Contribution is constructed only from direct-path evidence or current selected Route Results.

```text
Capability Assignment
+ Route Selection
+ current Route Results
+ contribution question and stop
→ Skill Contribution
```

The Contribution must state:

- the exact Need it addresses;
- selected route and material provenance;
- the result supplied to Upper Judgment synthesis;
- conflicts among route artifacts;
- limitations and residual Needs;
- whether the Skill-local contribution stop is met.

Forbidden:

- citing an unselected route or material;
- omitting a selected Route Result;
- marking local resolution while a required route is unexecuted;
- treating `separate` as an internally completed sibling capability;
- declaring Need Coverage or Upper Conclusion.

## 16. Need Coverage and Upper synthesis

Upper Judgment, not Skill, assesses Coverage.

```text
Contribution Need
+ all Contributions addressing it
+ conflicts
+ limitations
+ residual Needs
→ Need Coverage
```

Coverage meanings:

- `covered`: enough current support exists for the related Closure Requirement evaluation.
- `partially-covered`: useful support exists but consequential residual remains.
- `conflicted`: material Contributions support incompatible interpretations.
- `missing`: no usable Contribution addresses the Need.

Upper synthesis may close only when required Needs have acceptable Coverage, conflicts are dispositioned, residual Needs are irrelevant or explicitly unresolved in a non-complete status, and the Category's own Closure Requirements are met.

Skill-local `resolved` never implies `covered`, and `covered` never by itself implies Upper Conclusion.

## 17. Wished pure interfaces

The first implementation should expose pure operations with stronger outputs rather than mutable validation flags.

```text
parseToc(rawJson, lexicalRoot)
  → Result<ParsedToc, TocAuthoringError>

bindToc(parsedToc, discoveredSkill)
  → Result<SkillTocContract, TocBindingError>

assessCapability(need, context, skillToc)
  → CapabilityApplicability

assignCapability(need, applicableSkill, basis)
  → CapabilityAssignment

assessRoutes(assignment, context, proposal)
  → Result<RouteAssessments, RouteAssessmentError>

selectRoutes(assignment, assessments, directProposal?)
  → Result<RouteSelection, RouteSelectionError>

sealReading(selection, acquire)
  → Promise<Result<SealedReading, ReadingError>>

recordRouteResult(sealedReading, proposal)
  → Result<RouteResult, RouteResultError>

composeContribution(assignment, selection, routeResults, proposal)
  → Result<SkillContribution, ContributionError>

assessNeedCoverage(need, contributions, proposal)
  → Result<NeedCoverage, CoverageError>
```

No operation accepts a raw value after its refinement boundary.

## 18. Protocol ownership

The extension protocol should expose layer-appropriate actions rather than one tool that can mutate every state.

```text
Upper routing surface:
  assess capability applicability
  assign Capability to Need
  assess Need Coverage

Skill-local routing surface:
  assess local routes
  select direct or routed reading
  submit Route Results
  compose Skill Contribution

Acquisition surface:
  seal exact Skill and Reference content

Work Core:
  accept only legal refined transitions
```

A Skill-local surface cannot assign sibling Skills or conclude the Upper Judgment. An Upper routing surface cannot nominate undeclared local Reference paths.

## 19. Deterministic and semantic guarantees

### Deterministically enforceable

- schema shape and unknown-field rejection;
- identity, uniqueness, path, root, hash, and byte limits;
- owner binding outside TOC;
- `unless` precedence in recorded applicability state;
- legal route disposition and direct-versus-routed exclusivity;
- complete route material membership and reading order;
- exact content sealing and staleness;
- selected-material and declared-artifact disposition completeness;
- Contribution-to-assignment identity;
- Coverage and Conclusion citation boundaries;
- replay consistency.

### Model- or evaluator-owned

- whether natural-language `when`, `unless`, and `separateWhen` materially match;
- whether a route artifact is semantically correct;
- whether a material distinction was honestly applied;
- whether two Contributions are substitutable or independently necessary;
- whether Coverage is adequate for the Category's Closure Requirement;
- whether evidence supports the claimed domain meaning.

The runtime cannot prove these semantic claims, but it can require explicit basis, preserve exact provenance, prevent stale or structurally impossible claims, and allow stronger evaluators to attach bounded assurance.

## 20. Failure behavior

| Failure | Required outcome |
| --- | --- |
| TOC absent | Capability remains unstructured; no prepared routes claimed. |
| TOC malformed | Structured capability rejected; no silent fallback. |
| Root applicability uncertain | `needs-context`; no positive assignment. |
| Route applicability uncertain | Route selection unresolved; no locally resolved Contribution. |
| Route separated | Residual/emergent Need returned upward. |
| Selected file missing or drifted | Sealing fails atomically. |
| Co-required material omitted | Route Selection rejected. |
| Selected material unused | Complete Route Result rejected. |
| Declared artifact undispositioned | Route Result rejected. |
| Route Result missing | Skill Contribution cannot resolve. |
| Contribution names another Need | Contribution rejected. |
| Contributions conflict | Coverage is `conflicted`, not silently covered. |
| Required Need missing | Upper complete transition rejected. |

## 21. Existing-policy migration boundary

Existing `judgment.json` and `reference-policy.json` remain evidence for authoring coverage.

Retain these semantics:

- Skill-family `when` and overriding `unless`;
- absence normal, malformed presence rejected;
- owner identity supplied outside authoring file;
- package-local path containment;
- contextual Reference selection;
- co-required route sets and explicit read order;
- route question, artifacts, stop, and separation boundary;
- explicit direct/core basis when no Reference route applies.

Do not preserve these representations as compatibility requirements:

- flat independently selectable Reference entries;
- generated Context Directions;
- fixed Skill-to-category names;
- dual loaders for old and new policy files;
- `@hobin/judgment` dependency in Developer.

Migration should compare semantic route coverage, not field-by-field JSON similarity. Cutover removes old policy files only after every retained Skill route has a TOC route or an explicit direct path and the package check proves no route material is orphaned.

## 22. First implementation queue

1. Add representative valid and invalid TOC fixtures for the cases in section 3.
2. Define raw authoring schema and refined immutable data types.
3. Implement parser, canonical identity, lexical path checks, and physical containment checks.
4. Bind parsed TOC to discovered Skill identity without allowing self-declared ownership.
5. Implement pure Capability Applicability, Route Assessment, and Route Selection transitions.
6. Implement atomic Skill/Reference acquisition and Sealed Reading identity.
7. Implement Route Result completeness and material-use checks.
8. Implement Skill Contribution construction and Need Coverage boundary.
9. Pilot one small routing Skill and one multi-material Skill before converting the whole catalog.
10. Only after pure traces pass, expose protocol actions through the Pi adapter.
11. Convert remaining Skills and remove old policy formats in one explicit cutover.

Do not begin with filesystem discovery, TUI, XState, or automatic migration generation. The first executable item is the pure TOC parser and route-selection trace suite.

## 23. Verification targets

### Authoring checks

- schema examples pass and malformed fixtures fail for the intended reason;
- every route and artifact ID is stable and unique;
- every route material exists and remains physically contained;
- every shipped route material is reachable;
- multi-material order and duplicate policy are enforced.

### Transition checks

- direct-only, one-route, multi-material, multi-route, needs-context, and separate traces;
- required routes equal selected routes;
- direct and routed paths cannot coexist for one assignment;
- local routing cannot assign a sibling Skill;
- exact content drift invalidates later values;
- incomplete Route Results cannot compose a resolved Contribution;
- Skill Contribution cannot declare Need Coverage;
- Upper complete cannot cite missing or conflicted Coverage.

### Integration checks

- package-local, external, and project-local Skills enter one Capability inventory;
- absent TOC remains usable as unstructured Capability;
- malformed TOC is visible and rejected;
- Pi loads only selected Skill and Reference bodies;
- session replay reconstructs the identity chain;
- Work View displays Needs, selected Skill routes, materials, Contributions, Coverage, and residuals without becoming a state owner.

## 24. Open questions

The following choices remain provisional until fixtures and pure traces provide evidence.

- Whether every first-party Skill must eventually have a TOC or leaf Skills may remain unstructured.
- Whether `direct` belongs in TOC or a self-contained Skill should omit TOC entirely.
- Exact artifact-result representation and whether artifact IDs need Skill-global scope.
- Whether route applicability must be assessed for every route or can use a bounded candidate shortlist without silent omission.
- How stronger evaluator and user assurance attach to Route Result and Contribution.
- Which independent package owns the reusable TOC schema, if any; Developer must not regain a runtime dependency on Judgment merely for parsing.
- Whether one Skill Contribution may address several Needs or batching should remain a projection over one-Need assignments.

These questions do not block the first parser and finite route-selection traces. Reopen schema shape only when one of those traces cannot represent an accepted case without weakening an invariant.
