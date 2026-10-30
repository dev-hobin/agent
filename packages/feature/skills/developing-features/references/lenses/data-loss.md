<!-- Generated from sources/lenses/data-loss.md. Edit the source and run node scripts/sync-sources.mjs. -->
# Data Loss

Catches: a transformation or write that erases a distinction someone still needs (identity, source, multiplicity, order, precision, absence or error state, history), or that irreversibly rewrites data that is already stored.
Applies when: a change aggregates, groups, deduplicates, normalizes, rounds, truncates, buckets, projects, summarizes, serializes, converts between representations, migrates, or overwrites or deletes stored records or fields.
Skip when: data passes through unchanged in meaning and representation, and nothing stored is rewritten or removed.

## Gotchas
- Scrubbing or rewriting data that is already stored is irreversible loss, not cleanup. Preserve it by default and treat removal as an owner decision, even when the new representation no longer needs the field.
- Correct arithmetic does not show that the discarded distinctions were irrelevant. One 60-minute outage and sixty 1-minute outages give the same daily percentage.
- Converting a list of key/value entries to a map looks like a reshape, but it overwrites duplicate keys, so it is also a reduction. A set drops order and multiplicity in the same way.
- A label on the output (`total`, `availability`, `status`) does not restore the structure that was discarded to compute it.
- Recovering from another authoritative source differs from recovering from the output. It works only while that source keeps the data, so its expiry or deletion is the real point of no return.
- Lossy is not automatically wrong. Canonicalizing case or whitespace in identifiers is fine once the rule, collision behavior, display needs, and every construction path are explicit, and the purpose owns the resulting equivalence.

## Distinctions
- **Accrete**: adds derived or contextual information (a period derived from a timestamp, a classification).
- **Reduce**: intentionally makes distinct inputs equivalent (sum, dedup, round, truncate, bucket, drop a field).
- **Reshape**: reorganizes access while intending to keep meaning (group, index, record-to-map). It still changes what is cheap or possible to observe.
- **Equivalence witness**: two accepted inputs that differ before a step and are equal after it.
- **Observer**: a downstream decision or consumer (UI, audit, correction, report, replay) and the distinctions it needs.
- **Provenance**: source identities, correction links, and derivation that let an output be explained or rebuilt.
- **First irreversible point**: the first step after which the lost distinction cannot be recovered from any retained source.

## Questions
| Before building, decide | After building, find |
| --- | --- |
| Which downstream decisions need which input distinctions? | Find a consumer (screen, audit, correction flow, report, export) that needs an identity, source, or field that this transformation drops. |
| For each reduction, which two inputs become equal, and is that acceptable for the stated purpose? | Find a sum, dedup, round, truncate, or bucket step where two inputs differing in identity, source, sign, or error state collapse while some consumer treats them differently. |
| Does any reshape quietly reduce? | Find `fromEntries`, `new Map`, `keyBy`, `groupBy`, `Set`, or unique-by conversions over data that can contain duplicates, and check whether first-wins, last-wins, or error is a stated policy. |
| Which absence and error distinctions must survive normalization? | Find normalization that maps null, missing, invalid, and failed to the same value (`0`, `''`, `[]`, `"unknown"`) where a consumer needs to tell them apart. |
| What happens to data already stored, and who decided? | Find writes that overwrite, delete, null out, or reformat stored rows, fields, or payloads (migrations, cleanup jobs, updates that drop a value), and check that the original is retained or that removal was an explicit owner decision. |
| Is provenance kept next to every aggregate that must be explained or corrected? | Find persisted summaries or totals with no source ids or correction links when the feature offers drill-down, dispute, or correction. |
| Which observers change across serialization or representation conversion? | Find conversions that drop precision (float, bigint to number, decimal to float), timezone or offset, order, unknown fields, type discriminators, or required context such as currency or unit. |
| Is truncation or projection applied at display, or before storage? | Find text truncation, field projection, or formatting applied before persisting, which makes the full value unrecoverable. |
| Where is the first irreversible point, and is it later than every consumer that needs the detail? | Find raw data that expires, is deleted, or is overwritten before a consumer that needs it (diagnosis, audit, replay) can read it. |
| Does a mixed step hide a reduction inside an accretion or reshape? | Find a single function that enriches, groups, and reduces in one pass, so the dropped distinction is not visible at any named step. |

## Report a finding only when
- You can name two concrete inputs (or a stored record) that become indistinguishable or are destroyed at `file:line`, and a downstream consumer or decision that needs the lost distinction. For a rewrite of stored data, the absence of a recorded owner decision is enough.
- These do NOT count: a lossy operation whose purpose explicitly owns the equivalence; hypothetical future consumers; display formatting that leaves the stored value intact; dropping data that was never persisted and that no consumer reads.

## Sources
- `archive/developer-0.2.2/skills/information-loss-judgment/SKILL.md` (gotcha on scrubbing stored data; accrete/reduce/reshape method; equivalence pairs; first irreversible point).
- `archive/developer-0.2.2/skills/information-loss-judgment/references/accrete-reduce-reshape.md` (step ledger, usage-billing case, duplicate-key reshape counterexample).
- `archive/developer-0.2.2/skills/information-loss-judgment/references/equivalence-and-information-loss.md` (equivalence by `f(x) = f(y)`, availability case, recovery from another source, accepted normalization).
- `archive/developer-0.2.2/skills/sketch/references/meaning-preserving-conversions.md` (conversion paths that lose precision or required context).
- `archive/developer-0.2.2/skills/schedule/references/structural-change-timing.md` (normalization erases source distinctions; persisted representation makes delay costly).
- Zachary Tellman, *Elements of Clojure*, Leanpub 2019-02-11: Indirection, public-manuscript pp. 70-89; Composition, pp. 104-112 (accrete, reduce, reshape).
- Matthias Felleisen et al., *How to Design Programs*, living build 9.2.0.3: Intermezzo 1, Chapters 19-20.
- Hillel Wayne, *Logic for Programmers*, v0.14.0, 2026-05-04: Chapters 2-5, pp. 5-60 (domains, ability/guarantee, observer-relative replacement).
- Harold Abelson and Gerald Jay Sussman with Julie Sussman, *Structure and Interpretation of Computer Programs*, Second Edition: Section 2.5 (coercion and conversion paths).
- Replay experiment, 2026-10-29 (first gotcha, recorded in `docs/plans/2026-10-30-restructure.md`).
