# Source Audit — Parse, don’t validate (2019-11-05)

## Status

Complete for the single canonical article — source read in full and integrated
as a bounded cross-cutting invariant plus one `sketch` reference route.

## Source Identity

- Author: Alexis King
- Title: “Parse, don’t validate”
- Published: 2019-11-05
- Canonical URL:
  `https://lexi-lambda.github.io/blog/2019/11/05/parse-don-t-validate/`
- Retrieved: 2026-07-27
- Retrieved HTML size: 44,501 bytes
- Retrieved HTML SHA-256:
  `c96a0b89ab3944d42083cf0d913f230b1dfa6096b337b12ee16aee724e9f534b`

The canonical article was fetched and read from beginning through footnotes. No
archived source file is committed or packaged.

## Audit Question

Which claims can Developer import to prevent a model or implementation from
stating an invariant, discarding the evidence that established it, and then
recreating the stronger type through an unchecked assertion?

## Source Intent

The article explains type-driven design as a process rather than a collection of
advanced type-system tricks. Its central move is to replace checks that return no
useful information with fallible transformations into more precise data. It aims
to make downstream functions total over their admitted input and to separate
input failure from execution failure.

Compression into “validate at the boundary” would lose the source's main
contrast. Both compared functions validate; only the parser returns a value that
preserves the learned fact.

## Claim And Boundary Matrix

| Imported claim | Source support | Qualification retained |
| --- | --- | --- |
| Strengthening an input representation can make a formerly partial operation total. | `head` over a list versus `head` over `NonEmpty` | The target language may encode the guarantee through a type, abstract representation, or smart constructor rather than a Haskell datatype. |
| Parsing differs from validation primarily in whether learned information is preserved. | `validateNonEmpty` returns `()` while `parseNonEmpty` returns `NonEmpty` | A language-native narrowing predicate can preserve information in a bounded scope; the package must judge the contract, not the function name. |
| A parser can consume any less-structured value, not only text. | List-to-`NonEmpty` argument and the article's parser definition | “Less structured” is relative to the required invariant and admitted domain. |
| Parsing should occur before input-dependent execution. | Boundary-library examples and parsing/execution stratification | Small authorization or abuse-resistance checks may precede expensive parsing; they must not perform the dependent domain mutation. |
| Validation spread through processing creates shotgun parsing and late failure risk. | Article's LangSec discussion | The quoted LangSec paper was not independently audited here; Developer imports the article's operational phase-separation lesson, not a broader security proof. |
| Use precise structures and push proof burden upward as far as possible, but no further. | Duplicate-key list-to-map example and two practical rules | Narrowing loses abilities such as duplicate preservation or order, so `model` must establish that the loss is acceptable. |
| Abstract types and smart constructors can contain invariants that are impractical to encode directly. | Practical advice on abstract `newtype` validators | This does not justify public raw constructors or unchecked casts outside the owner. |
| Multi-pass parsing is compatible with the principle. | Practical advice section | No input-dependent domain effect may consume a value before the relevant pass establishes its required invariant. |
| The principle is an ideal requiring judgment, not a mandate for maximal type machinery. | Closing caveat and radioactive `impossible` guidance | Exceptions must be bounded and explicit; this caveat must not become a generic escape hatch. |

## Excluded Or Narrowed Claims

- Haskell syntax, `IO`, `Maybe`, `NonEmpty`, `Map`, `newtype`, and specific
  library examples are not universal destination APIs.
- The package does not equate all validation with failure. Validation that
  returns or narrows to an invariant-carrying value performs the required job.
- The package does not ban every cast-like syntax. Literal preservation and a
  cast after a complete but inexpressible check differ from claiming hostile
  input as a domain value.
- The package does not promise that static types prove external truth forever.
  Persisted data, remote services, mutable stores, and environment drift still
  require owned re-entry parsing or observation.
- The package does not import the article's secondary citations as independently
  audited proof.
- The package does not require maximal dependent typing or whole-application
  up-front parsing when streaming, staging, authorization, or resource limits
  establish a smaller honest phase boundary.

## Integration Decision

### Always-on invariant

Developer protocol, `model`, `sketch`, implementation, and `verify` must agree:

```text
unchecked narrowing is not invariant evidence
```

A model may place a representable-state guarantee at a type only when all
construction paths establish it through an evidence-bearing transition. An
implementation must stop rather than bridge a missing transition with a cast,
type assertion, non-null assertion, unchecked deserialization target, or ignored
conversion result.

### Conditional construction owner

The concrete derivation belongs to `sketch`, not a new leaf and not `model`.
`skills/sketch/references/evidence-preserving-boundaries.md` owns one question:

```text
How does less-trusted or less-structured input become a domain value that
carries the established invariant?
```

Its route produces a raw/refined pipeline, parser or smart-constructor contract,
failure representation, construction/escape audit, first-effect boundary, and
trusted-compiler-gap record.

### Completion owner

`verify` treats validation followed by assertion, late invalid-input failure,
public raw construction, repeated downstream checks, and unchecked persisted or
wire decoding as plausible pass-but-wrong shapes.

### Why no new skill

The article does not introduce a new independent product judgment. `model`
settles admitted values and lost abilities; `sketch` shapes the caller-visible
boundary; implementation follows it; `verify` judges the resulting claim. A
`parse` leaf would duplicate those owners and encourage keyword routing.

### Why no syntax scanner

Developer is stack-independent and does not parse every target language. A
regex ban on `as`, casts, or assertion syntax would miss semantic equivalents
and reject harmless constructs. The runtime instead requires a structured
invariant-handoff declaration before implementation and adversarially evaluates
whether the model treats unchecked narrowing as evidence. Repository-native AST,
lint, compiler, or policy checks remain stronger mechanical evidence when
available.

## Runtime And Repository Changes

- add `evidence-preserving-boundaries` under `sketch`;
- add the `evidence-preserving-boundary` reference-policy route;
- strengthen `model` guarantee placement and `sketch` completion rules;
- add a protocol-wide unchecked-narrowing rule;
- require implementation routes to classify invariant handling as not
  applicable, evidence-preserving, or a bounded trusted compiler gap;
- extend verification with construction-path, bypass, and effect-order checks;
- add deterministic policy checks and live adversarial fixtures;
- audit obvious assertions in Developer's own runtime under the same rule.

## Verification Targets

- package policy/catalog tests include the new reference and route;
- protocol tests expose the invariant rule and implementation declaration;
- state replay parses new declarations and supplies an explicit legacy fallback;
- live evaluation rejects `validate(raw); raw as Domain` as a completed boundary;
- package checks, tests, type diagnostics, diff checks, and pack contents remain
  clean;
- source audits remain excluded from the published package.

## Verification Evidence

- `pnpm --filter @hobin/developer check`: package structure and 149/149
  deterministic tests passed.
- Eval workspace: 8/8 exact behavior tests passed.
- Live JSON evaluation passed the new `evidence-preserving-input-boundary`
  fixture with preferred first target `sketch`, one route, the exact new policy
  route/reference, and a settled unchanged result. Its first sample exceeded the
  default 60-second no-progress budget after correct route selection, source
  inspection, reference load, and repository search; the bounded rerun used a
  140-second no-progress allowance and completed successfully.
- Live JSON evaluation passed the new `unchecked-narrowing-pass-but-wrong`
  fixture with preferred first target `verify`, one route, the claim-evidence
  reference, and a settled unchanged result. An earlier request phrased as a
  broad challenge selected `adversarial-eval`; the fixture was narrowed to the
  requested verify evidence matrix rather than treating that admissible but
  different work product as a package failure.
- Live JSON evaluation passed `implementation-stable-landing-paused` with first
  target `implementation`, proving the new required invariant-handling schema
  remains usable for a non-boundary mutation.
- Primary TypeScript LSP diagnostics were clean for all changed TypeScript and
  evaluation source files.
- `git diff --check` and package-local Markdown/JSON checks were clean.
- `pnpm pack --dry-run` produced `@hobin/developer@0.1.11`, included the new
  runtime reference, and excluded `SOURCES.md`, source audits, tests, scripts,
  and evaluation fixtures as intended.
- Session-wide diagnostics reported no blocking findings. Remaining complexity,
  fan-out, nested-ternary, and console warnings are pre-existing structural
  signals in the large extension/check script and are not used as evidence for
  this boundary claim.

## Verdict

Import the principle now as an evidence-preservation invariant. Its durable
Developer form is not “always add schemas” or “ban the token `as`”; it is:

```text
A stronger domain claim must be produced by an owned transition whose success
returns the stronger representation, and every construction path must respect
that transition before dependent effects begin.
```
