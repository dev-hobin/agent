# Developer Judgment Policy: Skill Applicability and Reference Selection

Developer's human-authored Judgment policy has one essential job:

```text
Use this skill in these situations.
When the skill is active, use each packaged reference in these situations and for these purposes.
```

`SKILL.md` owns the complete method, result shape, and stop. Runtime creates the
exact current judgment question from the user's task and observed evidence.

## Identity comes from real objects

For Developer, the containing Pi skill already identifies the reusable
capability:

```text
skills/sketch/SKILL.md       name: sketch
skills/sketch/judgment.json  policy for sketch
```

Therefore the policy has no root `contractId`, `decisionUnit`, or `skillName`.
It also has no `routeId`: Developer authors know skills and references, but do
not own a separate stable route object.

| Intended meaning | Correct Developer representation |
| --- | --- |
| A new reusable capability | Create a new Pi skill with its own `SKILL.md`. |
| One situation handled by `verify` | Add it to `verify`'s root `when`. |
| One explicit exclusion for `verify` | Add it to `verify`'s root `unless`. |
| One situation where a reference can add a material distinction | Add one complete statement to that reference's `when`. |
| The current user's API review question | Generate it at runtime under a new `judgmentId`. |

The normalized relative reference path is the prepared source's natural identity.
Runtime judgment and content identities are generated.

## Decided authoring shape

```json
{
  "specVersion": "0.1",
  "when": [
    "A completion claim must be matched to current code, tests, and observed command results."
  ],
  "unless": [
    "No concrete completion claim is being made or reviewed."
  ],
  "references": [
    {
      "path": "references/verifier-selection-and-pass-but-wrong.md",
      "when": [
        "A green check needs a falsifying observer and a plausible pass-but-wrong case before it can support a consequential product or contract claim."
      ]
    }
  ]
}
```

Authors answer only:

1. What task evidence makes this skill the right method?
2. Which explicit exclusions make the skill inapplicable even when a positive
   condition also matches?
3. For each packaged reference, which observable pressure and material
   distinction together make it relevant?

A root `unless` condition wins over a matching root `when`. Ambiguous evidence
or an unresolved tradeoff is not an exclusion and must remain a runtime question.

They do not pre-author runtime questions, source graphs, tool catalogs, coverage,
or technical route identities.

See Judgment's
[authoring schema decision](https://github.com/dev-hobin/agent/blob/main/packages/judgment/docs/authoring-schema-v0.1.md)
for exact property semantics and the complete JSON Schema.

## Multiple references

Each reference is evaluated independently:

```text
zero matching references    → run SKILL.md without optional references
one matching reference      → read it when it materially helps
several matching references → read the smallest useful set
```

This still supports current Developer cases where a foundation and a specialized
reference both help. Their independent `when` values both match the same task;
no shared route or ID is required.

Directory membership, catalog visibility, array order, or topical similarity
never makes a file required. If exact text is normative, its invariant belongs
in `SKILL.md`, adapter code, or ambient constraints.

## Dynamic judgment question

The runtime question is task-specific:

```text
user task + current repository evidence + selected skill
→ exact unresolved gap
→ generated question text
→ generated judgmentId and question hash
```

For example, the authored reference policy may say that conversion guidance helps
when meanings can be lost. Runtime can then create:

```text
Which old parser values and diagnostic distinctions must the new parser preserve?
```

That question should not be frozen into every package policy. A different task
using the same reference should produce a different exact question.

## Package-external context

A packaged reference is prepared guidance, not the only admissible source.
Current repository observations, tests, specifications, explicit user decisions,
typed evaluator results, Pi context files, and completed peer-skill results may
be more current or specific.

Developer admits those through normal Pi context, exact active-branch tool
results, user events, or typed adapters. The authoring policy does not enumerate
every tool or external package.

External material may make a local read redundant when it already supplies the
same distinction named by a reference's `when`. Runtime records only exact selected material, its role,
its contribution to the dynamic question, and its bounded assurance. Constraints,
evidence, decisions, methods, and guidance remain labeled rather than flattened.

See Judgment's
[external context composition model](https://github.com/dev-hobin/agent/blob/main/packages/judgment/docs/external-context-composition.md).

## Runtime responsibility

Developer and Judgment retain:

- exact current-branch provenance;
- atomic selection and sealing;
- missing/error/truncation state for selected material;
- deterministic model-visible directions;
- dynamic question identity;
- branch replay and stale-content rejection; and
- outcome contribution/citation.

Those are runtime mechanisms, not package-author fields.

Mutation remains separate:

```text
skill/reference judgment
→ optional semantic conclusion
→ developer_authorize_change
→ edit/write
→ developer_record_landing
→ verify
```

Reference applicability cannot authorize product mutation.

## Research basis

The design follows:

- JSON Schema's schema-local descriptions/examples;
- OpenAPI's requirement that a technical ID have an explicit referent and scope;
- Kubernetes' split between contextual human names and generated occurrence IDs;
- Smithy's split between human IDL and normalized semantic model;
- CUE's deterministic derivation;
- DMN's separation of human decision meaning and technical deployment IDs;
- Temporal's separation of business and execution identity; and
- *Elements of Clojure* on narrow names, context-supplied meaning, useful
  indirection, and public-interface calcification.

See Judgment's
[authoring policy schema](https://github.com/dev-hobin/agent/blob/main/packages/judgment/docs/authoring-schema-v0.1.md)
for the normative field and boundary rules.
