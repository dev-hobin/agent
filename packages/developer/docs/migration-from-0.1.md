# Developer 0.1.16 → 0.1.17 Behavior and Protocol Changes

This compares published `@hobin/developer@0.1.16` (`developer/v6`) with the
private `0.1.17` patch candidate (`developer/v7`). The package remains on the
`0.1.x` line by release policy; patch numbering does not imply wire-payload
compatibility.

## Preserved product behavior

- `/developer`, status, questions, settings, activation, and `--developer`;
- eleven independently invocable skills and adaptive method choice;
- PendingQuestion owner, gate, criteria, and explicit resolution;
- branch-local replay and read-only Workbench;
- edit/write withholding until bounded mutation authority exists;
- stable landing, reroute, and separate verification debt;
- ordinary Pi tools perform reads, edits, writes, and tests.

## Protocol split

```text
0.1.16 / developer/v6
route
→ optional fixed complete GuidanceSet
→ one developer_record_judgment
→ changedArtifacts boolean

0.1.17 / developer/v7
semantic lane:
developer_open_judgment
→ developer_open_context_sources (zero or more calls)
→ exact material nomination
→ atomic selection + sealing
→ contribution coverage
→ developer_conclude_judgment

mutation lane:
developer_authorize_change
→ bounded Pi mutation
→ developer_record_landing with exact changed paths
→ reroute + separate verify judgment
```

The split is semantic, not a set of aliases.

| 0.1.16 | 0.1.17 |
| --- | --- |
| `developer_route_question` skill target | `developer_open_judgment` |
| `developer_route_question` implementation target | `developer_authorize_change` |
| `developer_load_guidance` | no direct replacement; nominate exact relevant material |
| `developer_record_judgment` semantic result | `developer_conclude_judgment` |
| `changedArtifacts: true` | `developer_record_landing`, then separate verification |
| Active Route | immutable ActiveJudgment or AuthorizedChange |
| fixed-set member contribution and synthesis | task-specific material contributions |
| v6 XState route replay | pure exact v7 transition/replay |

A `judgment_id` and `authorization_id` cannot close each other.
`pending_question_id` always names an existing Developer PendingQuestion; it is
not a capability, policy, or runtime question identifier.

## `judgment.json` migration

The old line admitted a fixed complete GuidanceSet. Intermediate reconstruction
candidates used authored question/need/source graphs. The final 0.1.17 candidate
uses neither.

```json
{
  "specVersion": "0.1",
  "when": [
    "Observable pressure establishes that the owning skill is applicable."
  ],
  "unless": [
    "An explicit exclusion establishes that another capability boundary owns the work."
  ],
  "references": [
    {
      "path": "references/example.md",
      "when": [
        "Observable pressure needs the material distinction this reference can add."
      ]
    }
  ]
}
```

Migration rules:

1. owner identity comes from the loaded Pi skill, never an authored contract ID;
2. root `unless` wins over root `when`;
3. each reference `when` independently combines pressure and material
   distinction;
4. a matching reference is a candidate, not a requirement or authority;
5. runtime creates the exact question, material relations, coverage, and hashes;
6. skills without conditional packaged references remove `judgment.json`;
7. absent policy is a normal complete skill; present malformed policy fails;
8. legacy routes, question IDs, need IDs, roles, assurances, tool catalogs, and
   source wiring have no compatibility aliases.

Current policy-aware skills are `abstraction-review`, `model`,
`naming-judgment`, `schedule`, `signal`, `sketch`, and `verify`.
`adversarial-eval`, `doctor`, `specify`, and `visualize` have no packaged
conditional references and intentionally own no policy.

See [Developer Judgment Policies](../JUDGMENT_POLICIES.md) and Judgment's
[Authoring Policy Schema](https://github.com/dev-hobin/agent/blob/main/packages/judgment/docs/authoring-schema-v0.1.md).

## Context proposal migration

Old fixed-set or static-need payloads cannot be mechanically renamed.

```text
nominationId
+ exact inventory / branchResultId / user event
→ materialId
+ useAs: constraint | evidence | decision | method | guidance
+ concrete contribution
+ agent-asserted | domain-verified | user-accepted
→ derived contributionId
```

A contextual outcome cites `contributionIndex` at the Developer tool boundary;
the adapter resolves it to the derived contribution identity. A needs-evidence
outcome derives exact conflict and limitation IDs from coverage.

`branchResultId` remains a compact active-branch alias. Runtime maps it to the
full Pi tool call, arguments hash, ordered content, status, and sequence. Alias
collision, missing result, cross-branch result, error selection, or content drift
fails closed.

## Scenario comparison

### Read-only design judgment

```text
0.1.16:
route sketch → load every admitted member → synthesize fixed set

0.1.17:
open sketch judgment
→ inspect exact repository evidence
→ optionally select zero, one, or several prepared references
→ record material contributions
→ conclude without mutation authority
```

### Already specified local change

```text
0.1.16:
implementation route → mutate → changedArtifacts=true

0.1.17:
optional focused judgment if needed
→ developer_authorize_change
→ mutate
→ developer_record_landing with exact paths
→ reroute → verify
```

### Missing product decision

A user-owned PendingQuestion still blocks its gate. `user-accepted` assurance now
requires the matching selected user event; model prose cannot simulate an
answer.

## Session and upgrade behavior

`developer/v6` and `developer/v7` are intentionally incompatible. The 0.1.17
runtime retains v6 entries as evidence, reports them as unsupported, and requires
restart/reroute where previous tool state cannot be reconstructed safely. It
does not rewrite user repository files or reinterpret old history.

## Operational checklist

- all eleven skills remain visible;
- old tool names are absent and the five v7 tools are discoverable;
- policy-absent and policy-aware skills both open dynamic judgments;
- malformed present policies fail closed;
- ActiveJudgment allows evidence work but no artifact mutation;
- AuthorizedChange permits only its bounded movement and landing;
- each selected material has a contribution;
- typed assurance cannot be forged from prose;
- selected tool evidence belongs to the active branch;
- landing requires exact non-empty changed paths and creates verification debt;
- v6 history produces a diagnostic rather than v7 state.
