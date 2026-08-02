# Notebook publication

English | [한국어](./ko/notebook-publication.md)

Notebook Markdown is Observer's durable record. SourceReads, working Memos, and
proposals inside the Pi session are preparation state, not saved knowledge.

## Record types

| Type | Contents |
| --- | --- |
| Source | External material or direct observation, provenance, and claims |
| Inquiry | Original question or hypothesis, current wording, revision reason, evidence |
| Memo | Working synthesis tied to one or more Inquiries |
| Zettel | Reviewed note promoted for independent use |

All records use `observer-record/v1`. The schema is
[`../schemas/observer-record.v1.schema.json`](../schemas/observer-record.v1.schema.json).

A Zettel must retain at least one direct Source reference. A note linked only to
an Inquiry or Memo cannot be traced back to source material and is rejected.

## One Markdown file

A record file contains:

```text
YAML frontmatter
exactly one H1
non-empty Markdown body
```

Observer preserves custom frontmatter fields outside its own schema-controlled
structures. Unknown fields inside Observer structures are rejected. Record ID
prefix must match record type, and timestamps and language tags must be valid.

## Why the whole graph is validated

A document can satisfy its schema while pointing to a missing or invalid record.
Review builds the Notebook as it would exist after the proposed batch, then
checks:

- record IDs are unique;
- Source, Inquiry, evidence, and lineage targets exist;
- there are no self-edges or duplicate edges;
- each Memo remains connected to its Inquiry scope;
- revision lineage points to the same record type;
- promotion status and target type agree; and
- every Zettel has a direct Source.

A document error is rejected before graph rules run.

## What Review binds

A prepared proposal fixes:

```text
Notebook canonical path and identity
Episode and review request ID
output language
exact create/update paths
existing content hash for each update
final Markdown for every target
the complete final record set
proposal ID
```

If another process changes a target after Review, that proposal cannot be saved.
A new proposal must be prepared from current bytes.

## What the user sees

For every target, Proposal shows:

- create or update operation;
- existing Markdown;
- line diff;
- final Markdown; and
- validation errors.

Inspecting the view changes no files. Approval exists only after the user selects
**Save all N records**. A different proposal ID or partial record set is rejected.

## Save transaction

Approval does not immediately overwrite final files:

1. **Preflight:** recheck Notebook identity and current target bytes.
2. **Plan:** compute create/update operations and expected final bytes.
3. **Stage:** write every record to temporary files.
4. **Publish:** replace targets in the planned order.
5. **Readback:** reopen the Notebook and validate final bytes and graph.
6. **Settle:** append `SaveCommitted` only after exact readback.

Without `SaveCommitted`, the Episode is not considered saved.

## Failure during publication

On stage, publish, or readback failure, Observer restores prior bytes that it
still knows are safe to restore. If another actor changed a target, Observer does
not overwrite those unknown bytes and reports `recovery-required` instead.

| Situation | Behavior |
| --- | --- |
| Update target changes before approval | Reject Save and prepare again in Review |
| Another file appears at a create path | Reject collision |
| Notebook path or manifest changes | Reject the target |
| A non-target record change breaks the final graph | Reject preflight |
| Readback differs from the plan | Do not settle; roll back or require recovery |
| Commit acknowledgment is retried | Recover only when exact receipt and state match |

## Guarantee boundary

Observer provides one logical all-or-not-settled batch from its own process. It
does not provide filesystem snapshots, distributed transactions, complete
power-loss durability, concurrent multi-process coordination, external editor
locks, Git history, remote sync, backup, or semantic truth.

Apply your own backup or version-control policy to the Notebook directory when
those properties matter.
