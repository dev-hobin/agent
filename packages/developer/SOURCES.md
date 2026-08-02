# Developer source provenance

This repository-only maintainer index records the sources audited while shaping
Developer's Skills and references. It is not a Pi runtime resource, a required
workflow, or proof that a source-derived claim is correct.

The published package contains source-independent Skill methods and conditional
references. Full audit workpapers and copyrighted source files are not packaged.

## Responsibility rule

A source idea belongs to the Skill that performs its observable job:

| Question | Owner |
| --- | --- |
| Existing-code treatment plan inside a declared scope | `doctor` |
| Product meaning, scope, invariant, blocker | `specify` |
| Cases, rules, contracts, state, replacement | `model` |
| Data, interface, collaboration, flow, implementation shape | `sketch` |
| Observable structural movement | `signal` |
| Stable code meaning and effect visibility | `naming-judgment` |
| Stability of an already-shaped abstraction | `abstraction-review` |
| Timing of a concrete structural change | `schedule` |
| Claim-to-evidence support and pass-but-wrong risk | `verify` |
| Finite falsification workflow | `adversarial-eval` |

No source creates a mandatory order among Skills. Doctor coordinates bounded
consultation but does not absorb another Skill's method.

## Runtime boundary

```text
source audit
→ source-independent Skill method or reference
→ optional judgment.json relevance policy
→ exact runtime selection and contribution
→ contextual outcome
```

These are separate claims:

- a source audit supports fidelity to an inspected source;
- policy compilation supports deterministic applicability/relevance wording;
- runtime hashes support identity and drift detection;
- a selected contribution supports one task-specific relation; and
- none of the above proves semantic truth by itself.

`SKILL.md` contains the complete always-needed method. A self-contained reference
contains a conditional distinction that can be selected independently. Current
policy fields are only root `when`, winning root `unless`, and
`references[{path, when}]`; see
[Judgment policy authoring](../judgment/docs/policy-authoring.md).

## Audit records

| Source | Audit record |
| --- | --- |
| *99 Bottles of OOP*, Second Edition 2.2.2 | [`99-bottles-of-oop-2e-v2.2.2.md`](./source-audits/99-bottles-of-oop-2e-v2.2.2.md) |
| *How to Design Programs*, living build 9.2.0.3 | [`how-to-design-programs-living-9.2.0.3-2026-05-28.md`](./source-audits/how-to-design-programs-living-9.2.0.3-2026-05-28.md) |
| *Structure and Interpretation of Computer Programs*, Second Edition | [`structure-and-interpretation-of-computer-programs-2e-texinfo-2.andresraba5.6.md`](./source-audits/structure-and-interpretation-of-computer-programs-2e-texinfo-2.andresraba5.6.md) |
| *Logic for Programmers* 0.14.0 | [`logic-for-programmers-v0.14.0-2026-05-04.md`](./source-audits/logic-for-programmers-v0.14.0-2026-05-04.md) |
| *Elements of Clojure*, 2019 Leanpub edition | [`elements-of-clojure-leanpub-2019-02-11.md`](./source-audits/elements-of-clojure-leanpub-2019-02-11.md) |
| *Tidy First?*, First Edition, Second Release | [`tidy-first-first-edition-second-release-2025-12-12.md`](./source-audits/tidy-first-first-edition-second-release-2025-12-12.md) |
| “Parse, don't validate” | [`parse-dont-validate-2019-11-05.md`](./source-audits/parse-dont-validate-2019-11-05.md) |
| Cross-source ownership and synthesis | [`cross-source-judgment-integration-2026-07-24.md`](./source-audits/cross-source-judgment-integration-2026-07-24.md) |

## Audit maintenance

When a Skill or reference changes because of a source, record:

```text
exact source version and inspected scope
+ claim, recipe, example, or boundary under review
+ supporting or challenging source location
+ excluded defects or source-specific idioms
+ source-independent Developer representation
+ content hashes needed for later reproduction
```

Do not import language-specific examples as universal rules. Do not use source
prestige as runtime authority. Re-audit when a changed reference makes a new
fidelity claim; do not reuse an old digest as evidence for new text.
