# Judgment Authoring Policy Schema 0.1

Status: implemented authoring and compiler surface for the private 0.1.0 candidate.

The human-authored policy has only two jobs:

```text
State when the owning capability should be used, unless an explicit exclusion applies.
State when each packaged reference is relevant.
```

Runtime questions are created from the current task and evidence. They are not
pre-authored.

## Canonical authored shape

```json
{
  "$schema": "https://raw.githubusercontent.com/dev-hobin/agent/main/packages/judgment/schemas/judgment-authoring.schema.json",
  "specVersion": "0.1",
  "when": [
    "Caller-facing operations, ownership, data flow, or implementation shape still need to be invented."
  ],
  "unless": [
    "A concrete candidate already exists and only its stability must be reviewed.",
    "The unresolved issue is product meaning rather than implementation shape."
  ],
  "references": [
    {
      "path": "references/meaning-preserving-conversions.md",
      "when": [
        "A cross-representation design needs explicit preserved-observer, loss, ambiguity, cycle, or unsupported-path checks."
      ]
    },
    {
      "path": "references/design-levels-and-boundaries.md",
      "when": [
        "A design needs an explicit caller vocabulary, owner, hidden mechanism, or dependency direction."
      ]
    }
  ]
}
```

## Reading rule

```text
Use the owning capability
  when at least one root when statement is materially true
  unless at least one root unless statement is materially true.

Consider a packaged reference
  when at least one of that reference's when statements is materially true.
```

`unless` is an exclusion, not merely counterevidence. It wins when both positive
and exclusion conditions are true. An ambiguous or evidence-dependent concern
must not be authored as `unless`; it remains a runtime evidence question.

## Why these names

*Elements of Clojure* asks a public name to expose a narrow, stable sense while
letting module context remove redundant words.

| Name | Stable sense | Detail deliberately omitted |
| --- | --- | --- |
| root `when` | positive applicability of the enclosing capability | owner identity already supplied externally |
| root `unless` | explicit exclusion that overrides positive applicability | handoff implementation and runtime evidence gathering |
| `references` | package-local prepared guidance | runtime inventory and external material |
| `path` | natural identity of one packaged file | synthetic source or route ID |
| reference `when` | complete relevance claim for that file | separate trigger/purpose fields and static question |

The same `when` relation is reused honestly at two levels:

```text
policy.when    → when the owner should be used
reference.when → when the reference is relevant
```

The enclosing data supplies the referent. Longer names such as `appliesWhen` and
`doesNotApplyWhen` repeat context already visible in the object. Bare negative
forms such as `notWhen` are less natural, while `unless` also communicates the
intended exclusion precedence.

## Why trigger and purpose are one statement

The earlier candidate separated `useWhen` and `useFor`:

```json
{
  "useWhen": ["Two representation worlds must interoperate."],
  "useFor": "Expose preserved observers and consequential loss."
}
```

Those are the pressure and intended contribution of one relevance claim. The
same meaning is clearer as one complete `when` statement:

```json
{
  "when": [
    "A cross-representation design needs explicit preserved-observer and loss checks."
  ]
}
```

Every reference `when` statement must name both:

```text
the observable situation or pressure
+
the material distinction this reference can add
```

A merely topical statement such as “when conversions are involved” is too weak.
If separate fields can be merged without losing selection behavior, they do not
earn separate public names.

## Why this is an array, not a path-keyed object

A path-keyed map is shorter:

```json
{
  "references": {
    "references/book-continuity.md": {
      "when": [
        "A chapter needs a wider-book terminology or example-order relation."
      ]
    }
  }
}
```

The array form is retained because each item is a documented record. It gives
JSON Schema a normal `path` property, produces clearer field-level diagnostics
and `judgment explain` output, and lets the exact parser reject duplicate paths
before silent object-key replacement. The compiler still indexes by path
internally.

## Why there are no routes, IDs, or authored questions

Several references being useful for one task does not create an author-owned
route:

```text
current task evidence
→ independently compare each reference.when
→ read zero, one, or several useful references
→ combine them with exact external context
```

Real identities already exist:

```text
owning capability  → supplied by SKILL.md or adapter registration
prepared reference → normalized relative path
runtime judgment   → generated judgmentId
exact content      → generated hash
```

The exact question depends on the current task and evidence. One policy may
yield:

```text
Which old parser values and diagnostics must the replacement preserve?
Which identity and order observers must this database conversion preserve?
```

Runtime persists the generated question and its basis. The package author does
not freeze a generic substitute.

## Property contract

### Root

| Property | Required | Meaning |
| --- | --- | --- |
| `$schema` | no, recommended | Editor discovery only; excluded from semantic policy identity. |
| `specVersion` | yes | Exactly `"0.1"`, the human authoring vocabulary version. |
| `when` | yes | Observable situations that positively establish owner applicability. |
| `unless` | yes | Explicit exclusions that override matching `when` statements. |
| `references` | yes | Independently selectable package-local prepared references. |

Owner identity is absent. A Pi adapter derives it from the exact loaded Skill;
a typed domain adapter derives it from its registered operation. Every caller
supplies the refined owner to the compiler.

A capability with no conditional packaged references should not own this file.
Its `SKILL.md` or adapter contract remains complete without Judgment authoring
ceremony.

### Reference

| Property | Required | Meaning |
| --- | --- | --- |
| `path` | yes | Normalized relative POSIX path from the policy directory to one contained package file. |
| `when` | yes | Complete relevance statements combining observable pressure with the material distinction this reference can add. |

Each path appears once. Array order implies neither priority nor authority. A
matching reference statement makes the file relevant, not mandatory or
authoritative. Zero, one, or several references may match; runtime selects the
smallest materially useful set.

A reference has no `unless`. Its positive `when` statements must be narrow enough
to exclude irrelevant cases. Adding a second negative rule set to every optional
reference would recreate the authoring ceremony this schema removes.

## External context

External context is absent from the authored reference list. Runtime admits it
through package-neutral lanes:

```text
ambient constraint
active-branch tool observation
explicit user event
visible peer-capability result
typed domain evaluator observation
```

Exact external material may be more current or specific than packaged guidance.
Runtime preserves origin and authority, records selected material and its
contribution to the dynamic question, and may skip a redundant local read.
Catalog availability never creates a coverage obligation.

There is no authored missing-reference policy. Normative text or mutation gates
belong in `SKILL.md`, adapter code, or ambient constraints. Failed acquisition of
a selected file still fails closed.

## Exact JSON Schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://raw.githubusercontent.com/dev-hobin/agent/main/packages/judgment/schemas/judgment-authoring.schema.json",
  "title": "Judgment Authoring Policy",
  "description": "Declares when an enclosing capability should be used unless excluded, and when each package-local prepared reference is relevant. Owner identity and runtime questions are supplied outside this file.",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "specVersion",
    "when",
    "unless",
    "references"
  ],
  "properties": {
    "$schema": {
      "title": "Schema location",
      "description": "Canonical editor-discovery URL. It does not enter semantic policy identity.",
      "type": "string",
      "format": "uri",
      "examples": [
        "https://raw.githubusercontent.com/dev-hobin/agent/main/packages/judgment/schemas/judgment-authoring.schema.json"
      ]
    },
    "specVersion": {
      "title": "Authoring specification version",
      "description": "Version of this human authoring vocabulary, distinct from package and runtime event versions.",
      "const": "0.1",
      "examples": ["0.1"]
    },
    "when": {
      "title": "When to use the owning capability",
      "description": "Observable situations that positively establish applicability for the enclosing skill or adapter operation.",
      "$ref": "#/$defs/statements",
      "examples": [["Caller-facing operations and ownership still need to be invented."]]
    },
    "unless": {
      "title": "When not to use the owning capability",
      "description": "Explicit exclusions that override matching root when statements. Ambiguous evidence concerns do not belong here.",
      "$ref": "#/$defs/statements",
      "examples": [["A concrete candidate already exists and only its stability must be reviewed."]]
    },
    "references": {
      "title": "Prepared references",
      "description": "Package-local references with complete, independent relevance conditions.",
      "type": "array",
      "minItems": 1,
      "maxItems": 128,
      "items": { "$ref": "#/$defs/reference" },
      "examples": [
        [
          {
            "path": "references/book-continuity.md",
            "when": [
              "A chapter needs a wider-book terminology, dependency, or example-order relation."
            ]
          }
        ]
      ]
    }
  },
  "$defs": {
    "statement": {
      "type": "string",
      "minLength": 1,
      "maxLength": 2000,
      "pattern": "\\S"
    },
    "statements": {
      "type": "array",
      "minItems": 1,
      "maxItems": 64,
      "uniqueItems": true,
      "items": { "$ref": "#/$defs/statement" }
    },
    "reference": {
      "title": "Prepared package reference",
      "description": "One contained package-local file and complete statements of when its material distinction is relevant.",
      "type": "object",
      "additionalProperties": false,
      "required": ["path", "when"],
      "properties": {
        "path": {
          "title": "Reference path",
          "description": "Normalized relative POSIX path from the policy directory. Absolute paths, backslashes, empty segments, dot segments, traversal, and physical escape are rejected by the parser and sealer.",
          "type": "string",
          "minLength": 1,
          "maxLength": 1024,
          "pattern": "\\S",
          "examples": ["references/book-continuity.md"]
        },
        "when": {
          "title": "When this reference is relevant",
          "description": "Complete relevance statements combining an observable situation or pressure with the material distinction this reference can add.",
          "$ref": "#/$defs/statements",
          "examples": [["A chapter needs a wider-book terminology, dependency, or example-order relation."]]
        }
      }
    }
  }
}
```

The exact parser/compiler additionally rejects duplicate reference paths,
surrounding whitespace, empty normalized prose, path escape, missing packaged
files at package-check/acquisition time, semantic duplicates after whitespace
normalization, and all unknown or legacy graph fields.

## Compiler and runtime boundary

```ts
interface PolicyOwner {
  readonly kind: "pi-skill" | "adapter-capability";
  readonly namespace: string;
  readonly name: string;
  readonly provenance: {
    readonly source: string;
    readonly scope: "user" | "project" | "temporary";
    readonly origin: "package" | "top-level" | "session";
    readonly path?: string;
  };
}

interface PreparedReferencePolicy {
  readonly path: string;
  readonly when: readonly string[];
}

interface DynamicJudgmentQuestion {
  readonly judgmentId: string;
  readonly owner: PolicyOwner;
  readonly question: string;
  readonly basisMaterialIds: readonly string[];
  readonly branchRef: string;
  readonly questionSha256: string;
}
```

The compiler derives owner identity, canonical reference inventory, containment
basis, ordering, and policy hash. It does not derive static routes, questions,
needs, or external source catalogs. Runtime persists the task-specific question,
selected material, contributions, assurance, and sealing identities.

## Consumer fit

| Consumer depth | Use |
| --- | --- |
| Stateful adapter | Build one dynamic question, admit applicable context sources, seal selected material, and persist its own lifecycle. |
| Build-time generator | Parse policy and emit deterministic directions without runtime state. |
| Typed domain adapter | Keep non-agent assurance and mutation gates in its own protocol. |
| Capability without conditional references | Own no policy and remain complete in `SKILL.md` or its adapter contract. |

Current multi-reference questions become independently matchable references.
When several statements match, runtime may select all useful files without an
authored group or ID.

## Migration checks

The breaking migration is complete only when:

1. every retained `judgment.json` parses through this authoring schema;
2. no authored file contains `contractId`, `decisionUnit`, `referenceRoutes`,
   `routeId`, `question`, `sources`, `questions`, `needs`, `sourceIds`,
   `candidateSourceIds`, `canInform`, roles, assurances, tool-name catalogs,
   `appliesWhen`, `doesNotApplyWhen`, `useWhen`, or `useFor`;
3. policies without packaged references are removed;
4. every packaged reference appears exactly once with `path` and one or more
   complete `when` statements;
5. compiler output is canonical under representation-only array ordering;
6. runtime questions are generated from current task context and replay exactly;
7. exact external material can be selected without prior per-skill enumeration;
8. generated Context Directions are deterministic and reach the model path; and
9. package isolation, authority forgery, stale selection, cross-branch,
   error/truncation, and JSON/Markdown drift gates remain green.

## Decision summary

```text
File convention: judgment.json
Public data type: JudgmentAuthoringPolicy
Owner identity: supplied by enclosing skill/adapter
Owner boundary: when + unless (unless wins)
Prepared reference: path + when
Runtime question: generated from current task and evidence
External context: runtime contribution, never an authored catalog
Static routes/questions/needs: absent
Runtime provenance and sealing: preserved internally
```
