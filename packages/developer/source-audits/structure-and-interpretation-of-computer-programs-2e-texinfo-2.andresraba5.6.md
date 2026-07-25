# Source Audit: Structure and Interpretation of Computer Programs, Second Edition

<!-- markdownlint-disable MD013 MD024 -->

## Status

**Complete — faithful after repair.** All 883 PDF pages were read in order and
visually audited against the MIT Press-hosted HTML where presentation affected
meaning. Front matter, Chapters 1-5, References, exercise/figure lists, index,
and colophon are complete. The integrated repair queue is applied and package
verification is green. Fidelity is claim-relative to the capability boundaries
and Developer adaptations recorded below.

> Integration note: this audit's post-repair hashes attest its fidelity snapshot.
> Current process/state and generic/language references were later separated by
> independent judgment question in
> [`cross-source-judgment-integration-2026-07-24.md`](cross-source-judgment-integration-2026-07-24.md).

## Source Identity

- Title: *Structure and Interpretation of Computer Programs*, Second Edition
- Authors: Harold Abelson and Gerald Jay Sussman, with Julie Sussman
- Foreword: Alan J. Perlis
- Work edition: second edition, © 1996 Massachusetts Institute of Technology
- Provided artifact: *Unofficial Texinfo Format* `2.andresraba5.6`, dated
  February 2, 2016, based on `2.neilvandyke4` dated January 10, 2007
- PDF pages: 883 physical pages, labeled `i`-`xxviii` and `1`-`855`
- Provided PDF SHA-256:
  `40fb9172ee270c67f7c1e86e4b1803db065ad0393c016da5b1b6d59b5ffe2c9d`
- PDF metadata creation date: 2016-02-02T22:09:17Z
- PDF metadata modification date: 2026-01-21T15:59:40Z
- Official full-text root:
  <https://mitp-content-server.mit.edu/books/content/sectbyfn/books_pres_0/6515/sicp.zip/full-text/book/book.html>
- Official HTML snapshot retrieved: 2026-07-24T12:01:23Z

The provided PDF is the active sequential-reading source, but it is not an
official presentation artifact. Its own introduction warns that the Texinfo
transliteration may have introduced figure, superscript, subscript, and other
formatting breakage. The MIT Press-hosted second-edition HTML is therefore the
canonical cross-check for suspicious code, mathematics, figures, captions, and
section anchors. Conversion defects are not source claims and will not become
Developer derivation evidence.

## Acquisition And Inspection Method

- Extracted page-labeled text:
  `/tmp/sicp-audit-40fb9172/book.txt`
- Extracted text SHA-256:
  `88c85cd13e808e8aae84acf5772e99fe3bbc0c1e268e1af04c1ffe5b2beee8da`
- PDF extractor:
  `/tmp/sicp-audit-40fb9172/extract.swift`
- PDF extractor SHA-256:
  `5b5eda14b49d413078d66f283b35f2e5f699fd220caaa649881688a55b5d5bb3`
- PDF renderer:
  `/tmp/sicp-audit-40fb9172/render.swift`
- PDF renderer SHA-256:
  `7f9ea48178ca9564ef75ea379747d826d353ab63ca3148563d0b02a3e20bdb0a`
- Official HTML snapshot:
  `/tmp/sicp-audit-40fb9172/official-html`
- Official HTML manifest SHA-256:
  `a8bb40f4bd508f91fa9e058ea17d738555fe40535a76a0579c3faf1e438f182a`
- Front-matter contact sheet SHA-256:
  `fe3624d103cfb4347f31aed0990dca4f9490196e16b9440f68df0811107273bf`

The PDF is read from first page to last. Search and extracted text are navigation
and prose aids only. Pages containing diagrams, code whose layout carries
meaning, mathematical notation, tables, or typography-sensitive distinctions
are rendered and visually inspected. Suspected conversion defects are checked
against the locally hashed official HTML before they are classified.

## Official HTML Snapshot

| Unit | SHA-256 |
| --- | --- |
| `book.html` | `3ec3a7277c3cb99fa21d51c467553245ac86443f5d67a5b6ac17359404f7f48a` |
| `book-Z-H-1.html` | `dc82e1c0f04ccf96c6337520d4c650a44e6256ed31889a8ade1806ee0ffe3fa2` |
| `book-Z-H-2.html` | `7d5f1eb3a85acab8fb2e504b1569ec33ca39407da9fcb4848b090296bfde132b` |
| `book-Z-H-3.html` | `d8fa83d57f17266895d973fe6fc5c715544b56f492d01683a80ff0f5f1a61977` |
| `book-Z-H-4.html` | `63a5e0b5bd4b4f289fd13ee30941370c45ff92d32e4c09d9d0c79c93ef476f85` |
| `book-Z-H-5.html` | `6bd800823b89c42b7d0cf21df590fe02bd883c2b6257eff1e06b795cb549b9ee` |
| `book-Z-H-6.html` | `f8c4b96e01ad679b0942fb3642ad513e380f807ffd232b1d3291faec1e5b755f` |
| `book-Z-H-7.html` | `2c33a116a0a1d3fe0507b8bc7b1508727e11fe0e531a7f5b70a67e10a68097b5` |
| `book-Z-H-8.html` | `34b73f54b1a716c4774bd5b6c334b0753dabbba85d9a9b74c2664e769020f970` |
| `book-Z-H-9.html` | `2ee861947ab97f65bd47b8179cfb4195c8afb4e268952d8f874c2f9f84bab368` |
| `book-Z-H-10.html` | `a67654bcb214281b85bbe1064d510d1fc78b355c247f089f23316094a9ba45e2` |
| `book-Z-H-11.html` | `298a2ed19aeabe41745ea9ef8644dc2fbacc1da06bb7eb4098f8b1861f205cb4` |
| `book-Z-H-12.html` | `f33277a1612d24c1bc2d42f0e3d361f21f65022fd53c5a6036b878e2c217fd50` |
| `book-Z-H-13.html` | `76f344b9e96cb5b5364b346bbe7aa22afed117c67002dac41f6f090815bf059b` |
| `book-Z-H-14.html` | `862e4cb529d95f68fe750cd6160c43069281779cfe686c00237b04e9a053b01b` |
| `book-Z-H-15.html` | `1bb584d42ac0b9b6c5119a93928492df401a89320c82fa584029226870bdeaf6` |
| `book-Z-H-16.html` | `69f1623ae0e738a42d34d84f034e109d1ffe51e72efe87675a888937e2ddde58` |
| `book-Z-H-17.html` | `31da8e88c3aebbb2472db5d11ba9e995fd5e441acf994759924fee67ac081cd6` |
| `book-Z-H-18.html` | `0c47da51bce2f309fc9719c07a978d70fb23f2f8d90a5caf29bb74d28dab2357` |
| `book-Z-H-19.html` | `129f986817efa6a821851e7606c99b292de8dab7e1341bab492490724421579d` |
| `book-Z-H-20.html` | `f7bff2dfd5fbf71c97333eb05f7ba92ffa28092fb4ec389b8d9fdb14de4da817` |
| `book-Z-H-21.html` | `f14b3a4b41a47a5cea2e1a98d9456dc6b78122e790b875769cc40746571f947c` |
| `book-Z-H-22.html` | `15ce2d0164514a85f4ff2809774a7fe1f6f05be2fe73669607e76d7e57db8bee` |
| `book-Z-H-23.html` | `51d75f1c6190804b63ccf8e112cb7bd7583dae0bf4d4fa271a55ab5db72f8f7a` |
| `book-Z-H-24.html` | `640c964fde75906e6c3d4c689cdf2bf1653fd439dfd0bf49dbad295d3e50be1e` |
| `book-Z-H-25.html` | `2944c0305845d90f38719f833150e8e70247c4ad8a16db951d17c24f40a553cb` |
| `book-Z-H-26.html` | `7dd7b92dae03a5e04affdc28ee8fab22f2d9c80a77aa28e31d2a3a967319701d` |
| `book-Z-H-27.html` | `198f43c88ad3f5a1c08176568f6e3b0c1ff069a8c4149d7d0cd31c1f609e3f7f` |
| `book-Z-H-28.html` | `f8280ef7d1514a070def9eaf3b2757a15cea338046f8d2828a929c0767aded8d` |
| `book-Z-H-29.html` | `6cc2195cb5e8d31e07e331fe5a7eae7f368cb7fffceab05712e40d3138d3b2af` |
| `book-Z-H-30.html` | `cddc0462cdf7e90fe482ca63e33da99fa1abd536d9c23981f9e5633e93993ce4` |
| `book-Z-H-31.html` | `3fe5cb69cf99e905c7f1a3fe6e35fd2037b4be749c577109cb91754e3f496589` |
| `book-Z-H-32.html` | `3eca49e911fa53d58f21c93ef5b6b4d1768c17a99b8986548944f526b0acd9b9` |
| `book-Z-H-33.html` | `8827d1a77a89f45b8c2eb403f0f42def4b0938d8fba832c37dc137cbca404577` |
| `book-Z-H-34.html` | `d7e2b44919a47f2b0dbe882c41c7728c7ab41a91df965ad9f42d3ee5c977008b` |
| `book-Z-H-35.html` | `74a73798dc96c6dc9d47cbfb7bee8557d6da866f93459ba669c435d642774b4a` |
| `book-Z-H-36.html` | `8f4467c738415f5c60417f434121bc630870a8b180dc9c68ff60fd599fdd530a` |
| `book-Z-H-37.html` | `1e148d0762e1c7cb40dded13232cdc2c7481f1b020767fe679823475a9024727` |
| `book-Z-H-38.html` | `fc1644c927d59f7e9aa3ec2de9efdb8d339bb2f38334b03c9708a932030250cc` |

## Packaged Reference Snapshot Before Audit

| Path | SHA-256 |
| --- | --- |
| `SOURCES.md` | `029f7a68e6cad5f80d27d993e93292a02ff8e4bb8278ab1e1fe5fd259386c46b` |
| `skills/model/references/problem-modeling.md` | `7df21a88ffefab4af666b4013f9bcb392f66db14cb30ba5e1694f19ef5121235` |
| `skills/model/references/worked-models-and-specialized-techniques.md` | `9f987e7a589ee50d787846c689bac40cb230cc13e03b573472de00636cf6d4f5` |
| `skills/sketch/references/abstraction-barriers-and-closure.md` | `b7c4a7ee6e69208297ed65b95f177ef507fe087875fba2758add20b6001539b5` |
| `skills/sketch/references/abstraction-composition-and-state.md` | `d883e89d5b6f1ed17415ea1c63a8ca1c1c65e276b4e140092dc2bf358559b71a` |
| `skills/sketch/references/composition-generative-recursion-and-accumulators.md` | `94a146584ed932df3895665988e5ef07c4084626b337e0a5b5a3641e8408d83e` |
| `skills/sketch/references/data-driven-design.md` | `3d0d3080dc18f4b7a0eb571638e6c85fbd708b57f230321321efb7c606562573` |
| `skills/sketch/references/generic-operations-and-languages.md` | `5a9304564d03782a766bcb46454de424865d6f30be760391bbebc58d40674c2d` |
| `skills/sketch/references/processes-state-and-time.md` | `006ee0148b26cafbbca3b9266abea95309646ca7cf02d7a5e01df092aa2ea2e7` |
| `skills/sketch/references/responsibility-and-variation.md` | `1a97219191a7ebda47c5b7b8c9ccad9fd01d656b18aca868058805faef0c20c5` |
| `skills/abstraction-review/references/recipe-cards.md` | `1f8cb7b5fc3c5739bc62befc598cbe6c8457dcb96c778f9a7d7fd4c15e2c5357` |

## Reading Progress

| Source unit | Status |
| --- | --- |
| Unofficial Texinfo Format note and dedication | complete |
| Foreword | complete |
| Preface to the Second Edition | complete |
| Preface to the First Edition | complete |
| Acknowledgments | complete |
| Chapter 1: Building Abstractions with Procedures | complete |
| Chapter 2: Building Abstractions with Data | complete |
| Chapter 3: Modularity, Objects, and State | complete |
| Chapter 4: Metalinguistic Abstraction | complete |
| Chapter 5: Computing with Register Machines | complete |
| References, exercise/figure lists, index, and colophon | complete |
| Cross-reference repair and verification | complete |

## Package Comparison Targets

The before-audit citation search found eleven package owners: `SOURCES.md` and
ten detailed references. The audit will test the attributed claim, source
boundary, omitted counterexample, and appropriate exact section anchor in each.
It will not change `reference-policy.json` unless the complete reading exposes a
routing defect rather than a derivation or provenance defect.

Current capability groups:

1. procedure/process distinction, black-box abstraction, higher-order
   procedures, and generated process cost;
2. data abstraction, abstraction barriers, closure, conventional interfaces,
   and multiple representations;
3. state, identity, sharing, time, concurrency, streams, constraints, and
   delayed evaluation;
4. generic operations, data-directed programming, language construction,
   evaluators, register machines, and compilation;
5. Developer adaptations that may use SICP as calibration but must not be
   attributed to it as literal method.

## Front Matter

**Read:** complete PDF labels `ix`-`xxviii`, including the conversion note,
dedication, Foreword, both Prefaces, and Acknowledgments. Title, copyright, TOC,
and opening chapter layout were visually checked in the front-matter contact
sheet.

### Source Intent

The book is a cumulative curriculum about controlling the intellectual
complexity of computational processes, not a Scheme syntax manual or a catalog
of isolated algorithms. The first-edition Preface states three coordinated
means of control: abstractions that hide detail, conventional interfaces that
support composition from standard pieces, and new languages that foreground
some design aspects while suppressing others. The intended reader should be
able to read a long exemplary program by knowing what need not be read at each
moment and should be able to modify it without destroying its organizing style.

The book's phrase "procedural epistemology" marks computation as a precise way
to express *how*, complementing mathematics' traditional concern with *what*.
Programs are therefore written for people to read and only incidentally for
machines to execute. Scheme is selected because its small syntax, first-class
procedures, lexical scope, uniform program/data representation, mutation,
streams, and embedded-language capacity let the course concentrate on
organization rather than notation.

The second-edition Preface adds one cross-cutting axis: different ways to model
time through stateful objects, concurrency, functional programming, lazy
evaluation, and nondeterminism. It explicitly says the whole second edition no
longer fits one semester and names Sections 4.4, 5.2, and 5.5 as material the
authors may skip, use without implementation study, or cover only cursorily.
Full source coverage in this audit must therefore not be mistaken for a claim
that every technique is a universal or equally weighted Developer route.

### Evidence And Boundaries

- Perlis distinguishes perfection of each part from adequacy of the collection;
  component correctness alone is not system organization evidence.
- Programs model only partially understood processes and evolve as the author's
  model deepens. An abstraction is a metastable organization, not a final proof
  that the domain has stopped changing.
- Formal semantics and logic can support correctness arguments, but large-system
  specifications may themselves be inadequate, inconsistent, or wrong.
- Standard idioms and proven organizational techniques reduce detail pressure,
  yet the book also treats language invention and system evolution as ongoing.
- The Preface credits organizing data to reflect the modeled world's real
  structure as a way to avoid accidental control complexity.
- The language examples are teaching media. Scheme-specific syntax, evaluator
  machinery, and register-machine encodings are not automatic destinations for
  unrelated production designs.
- The provided Texinfo PDF is explicit about possible conversion breakage;
  extracted typography such as small-cap ligatures is not semantic evidence.

### Provisional Developer Comparison

The package's high-level capability matrix matches the front matter's three
major complexity-control techniques and its time/model axis. The complete audit
must still test whether individual references overstate closure, conventional
interfaces, data-directed dispatch, functional modularity, evaluator
boundaries, or behavior preservation. Existing-repository recovery, route
selection, compatibility inventory, and package verification remain Developer
adaptations unless later chapters directly support the exact rule claimed.

## Chapter 1: Building Abstractions with Procedures

**Read:** complete PDF labels `1`-`106`, physical pages 29-134, including all
prose, code, footnotes, and Exercises 1.1-1.46. The three section contact sheets
cover every chapter page and were inspected for code layout, process diagrams,
mathematics, and table structure.

**Canonical anchors:**

- [Chapter 1](https://mitp-content-server.mit.edu/books/content/sectbyfn/books_pres_0/6515/sicp.zip/full-text/book/book-Z-H-9.html#%_chap_1)
- [Section 1.1](https://mitp-content-server.mit.edu/books/content/sectbyfn/books_pres_0/6515/sicp.zip/full-text/book/book-Z-H-10.html#%_sec_1.1)
- [Section 1.2](https://mitp-content-server.mit.edu/books/content/sectbyfn/books_pres_0/6515/sicp.zip/full-text/book/book-Z-H-11.html#%_sec_1.2)
- [Section 1.3](https://mitp-content-server.mit.edu/books/content/sectbyfn/books_pres_0/6515/sicp.zip/full-text/book/book-Z-H-12.html#%_sec_1.3)

**Visual evidence:**

- Section 1.1 contact sheet:
  `2ba2ebd474430bed4d8a80715d6aa438270443f67421b8f621ea57186d38afc1`
- Section 1.2 contact sheet:
  `9334fb8685c3df5700a47f63aab1afe8559ab9bcbad93544edc4b6f574293020`
- Section 1.3 contact sheet:
  `3860cb0b01486d3df5b02f7854e8a98fa8ff8a5031acf1eebc3c7a19670fcb35`

### 1.1 Elements, Evaluation, And Black-Box Procedures

A powerful language supplies primitive expressions, means of combination, and
means of abstraction for both procedures and data. Names gain meaning only in
an environment; even `+` is not meaningful independently of the context that
binds it. Compound procedures can be used like primitive ones, but creation of
a procedure and association of a name with it are distinct operations.

The substitution model is explicitly a simplified reasoning aid, not an
implementation account. It applies only to the early procedure subset and must
later yield to environment, evaluator, and machine models. Applicative and
normal order may produce the same value only within the stated substitution
and legitimate-value boundary; they can duplicate work, diverge differently,
and cease to be interchangeable once mutation and richer semantics enter.
Short-circuit forms also make evaluation order part of meaning: `and`, `or`,
`if`, and `cond` cannot be treated as ordinary eager procedures.

The Newton square-root example distinguishes a declarative property from an
effective procedure. Its fixed `0.001` test is intentionally inadequate for very
small and very large inputs. Tolerance is therefore part of a numerical contract,
not decorative implementation detail, and must be selected against the problem,
machine representation, and algorithm.

Black-box decomposition is not arbitrary line splitting. Each procedure must
perform an identifiable task usable in defining other procedures. Two `square`
implementations are indistinguishable only when the observation is restricted to
returned numeric values; the text immediately notes that their efficiency may
differ by hardware. Representation independence and replacement claims are
therefore observer-relative, not proof that all operational behavior is equal.

Bound-variable renaming is safe only when it is consistent and avoids capture.
Internal definitions hide auxiliaries that are irrelevant to users, while lexical
scope lets those helpers obtain stable enclosing context without repeatedly
passing it. This is direct support for ownership and information hiding, but not
for making every helper public or every closure invisible in cost.

### 1.2 Procedure Syntax Versus Generated Process

Expertise requires predicting the global process generated by local procedure
rules. A recursive procedure is a syntactic fact; a recursive or iterative process
is an execution shape. The iterative factorial process is completely summarized
by a fixed set of state variables, whereas the linear-recursive version carries
hidden deferred work. This distinction depends on the interpreter: recursive
syntax has constant-space iterative behavior only under a tail-recursive runtime
guarantee.

Tree recursion is simultaneously a clear translation of a recurrence and, for
the naive Fibonacci procedure, an exponentially redundant computation. The
book does not infer that tree recursion is universally bad: it remains natural
for hierarchical data and useful for discovering a specification. Memoization or
a different invariant may change cost, but each has additional state and process
obligations.

Exercise 1.16 makes the iterative invariant explicit: `a * b^n` must remain
unchanged as state evolves. This supports an invariant-first accumulator design:
initialization, transition, and final extraction derive from one preserved
quantity. Euclid's algorithm similarly couples a preservation fact—common
divisors remain the same—with progress toward a zero second component.
Correctness preservation and termination progress are distinct evidence.

Order-of-growth analysis requires an input-size parameter and resource measure.
The chapter calls `Theta` a crude description and warns that unit-cost arithmetic
is false for sufficiently large numbers. Timing exercises ask observed ratios to
challenge the abstract step model rather than treating a benchmark as automatic
proof of a growth class.

The Fermat test demonstrates claim-relative probabilistic evidence. A failed
trial proves compositeness, while a passing trial does not prove primality.
Carmichael numbers defeat the unqualified repetition claim even if every base is
tried. The later Miller-Rabin variation restores a bounded witness argument for
odd composites. A green randomized observation is meaningful only under the
specific theorem, generator, independence, and accepted-error assumptions.

### 1.3 Higher-Order General Methods

The summation abstraction is derived from three completed procedures whose
corresponding term and successor roles visibly align. The common template is
called strong evidence of an abstraction, not sufficient reason to abstract
arbitrarily. Exercises then generalize through `product`, `accumulate`, and
`filtered-accumulate`, while noting that these ideas become substantially more
useful only after sequence data supplies a suitable conventional interface.

Higher-order procedures turn a repeated computational method into an explicit
value. `fixed-point`, `average-damp`, derivative transforms, Newton transforms,
and iterative improvement separate reusable roles while preserving the process
they assemble. The clearer formulation exposes fixed-point search, transform,
and target function separately. The chapter nevertheless rejects maximal
abstraction as a universal goal: expert programmers choose the level appropriate
to the task.

A method abstraction carries its applicability boundary. Half-interval search
checks opposite signs and rejects unsupported inputs. Naive fixed-point square
root oscillates instead of converging. Average damping repairs that instance but
not every root with one application. Newton's method converges rapidly only for
favorable functions and sufficiently good guesses. General-method reuse does not
remove preconditions, convergence analysis, tolerance, or failure behavior.

First-class procedure rights include naming, argument passing, result return,
and inclusion in data structures. The book also names an implementation cost:
returned procedures require retaining free-variable environments. Expressive
power and runtime representation must therefore be reviewed together.

### Conversion Findings

The contact sheets preserve all five numbered process figures and the equations
whose extraction order is garbled in the plain text, especially piecewise
functions, continued fractions, and Newton transforms. The official HTML agrees
with the visually inspected PDF on the chapter's semantic claims. No canonical
Chapter 1 defect is established. Texinfo small-cap ligatures and malformed
plain-text equation ordering remain conversion artifacts and are excluded from
source claims.

### Chapter 1 Developer Comparison

- `abstraction-barriers-and-closure.md` is directionally faithful about
  black-box tasks, higher-order roles, and lexical ownership. It needs exact
  section anchors and should preserve Chapter 1's observer-relative replacement
  boundary and method preconditions.
- `processes-state-and-time.md` faithfully distinguishes procedure text from
  process shape. It should say more directly that tail-call space is a runtime
  guarantee and that evaluation strategy can change work, divergence, and later
  effects.
- `composition-generative-recursion-and-accumulators.md` correctly treats common
  templates and invariants as evidence. Its SICP trace should point to Sections
  1.1.8, 1.2, and 1.3 and preserve the source's warning against always choosing
  the most abstract formulation.
- `problem-modeling.md` is compatible with the book's sequence of successively
  refined evaluator models and its observer-relative contracts. Most of its
  replacement, solver, and product-workflow rules remain Developer or other-source
  adaptations rather than literal Chapter 1 method.
- Current broad `chapters 1 and 3` and `sections 1.1-1.3` citations are not audit
  quality. Exact anchors will be assigned only after all chapters delimit the
  final claim owners.

## Chapter 2: Building Abstractions with Data

**Read:** complete PDF labels `107`-`293`, physical pages 135-321, including all
prose, code, footnotes, and Exercises 2.1-2.97. Five section contact sheets cover
every chapter page. The abstraction diagrams, box-and-pointer structures,
signal-flow plan, picture language, set trees, Huffman tree, generic-operation
tables, type tower/network, equations, and code layout were visually inspected.

**Canonical anchors:**

- [Chapter 2](https://mitp-content-server.mit.edu/books/content/sectbyfn/books_pres_0/6515/sicp.zip/full-text/book/book-Z-H-13.html#%_chap_2)
- [Section 2.1](https://mitp-content-server.mit.edu/books/content/sectbyfn/books_pres_0/6515/sicp.zip/full-text/book/book-Z-H-14.html#%_sec_2.1)
- [Section 2.2](https://mitp-content-server.mit.edu/books/content/sectbyfn/books_pres_0/6515/sicp.zip/full-text/book/book-Z-H-15.html#%_sec_2.2)
- [Section 2.3](https://mitp-content-server.mit.edu/books/content/sectbyfn/books_pres_0/6515/sicp.zip/full-text/book/book-Z-H-16.html#%_sec_2.3)
- [Section 2.4](https://mitp-content-server.mit.edu/books/content/sectbyfn/books_pres_0/6515/sicp.zip/full-text/book/book-Z-H-17.html#%_sec_2.4)
- [Section 2.5](https://mitp-content-server.mit.edu/books/content/sectbyfn/books_pres_0/6515/sicp.zip/full-text/book/book-Z-H-18.html#%_sec_2.5)

**Visual evidence:**

- Section 2.1 contact sheet:
  `484487fbe806393d2a13303e98e73e0a849ef8b2046abae0fcd4e5cea8d00091`
- Section 2.2 contact sheet:
  `137be30f392fb3882515fd37f5348c1817c68f2c29d4500a60777a35c39463cb`
- Section 2.3 contact sheet:
  `7d8bb9f02c6ed70ccf1b42825839d167d489a651f92043f8f44be084e3e2f50f`
- Section 2.4 contact sheet:
  `17b7974b9a5f146ebc50cc75ce561dfb1aca211d1f8c72a36d0b7259bd0d0938`
- Section 2.5 contact sheet:
  `b39bab1118c3111f9976a734cad57621a08736c814c049a699508f97b0a21f14`

### 2.1 Data Abstraction Means Operations Plus Laws

Compound data raises the conceptual level, separates use from representation,
and permits higher-level procedures to pass values without knowing their parts.
The rational-number design begins wishfully with constructors and selectors,
then implements the representation later. The abstraction requirement is not
"whatever has these method names": constructors and selectors must satisfy laws.
For nonzero `d`, selecting the numerator and denominator of `make-rat(n, d)` must
recover the same rational value as `n / d`.

Figure 2.1 shows several barriers, not one wrapper: problem-domain clients,
rational operations, constructor/selector representation, pairs, and pair
implementation. Each level uses the interface immediately below it. Moving
normalization from construction to selection changes when `gcd` work occurs but
leaves rational operations unchanged. The barrier preserves that decision only
for observers whose contract excludes timing and repeated-selection cost.

The source also supplies a counterexample to simplistic replacement. Binding
`make-rat` directly to `cons` saves a call but defeats call tracing and
breakpoints. Equal abstract values do not imply equal instrumentation, cost, or
failure observations. Representation independence is always relative to the
published operations and laws.

Pairs implemented as dispatch procedures demonstrate that representation
validity comes from observable laws rather than host-language shape. The text
explicitly does not recommend the procedural pair implementation for efficiency;
it uses it to establish the abstraction argument and introduce message passing.

Interval arithmetic then exposes a semantic boundary that representation hiding
cannot repair. Algebraically equivalent formulas can produce different intervals
because repeated occurrences of one uncertain quantity are treated as independent.
Division by an interval spanning zero is undefined and must be rejected. A clean
constructor/selector barrier does not prove that the modeled arithmetic matches
the user's uncertainty semantics.

### 2.2 Closure, Conventional Interfaces, And Stratified Languages

`cons` has the closure property because its result can be combined again by
`cons`; this permits arbitrary hierarchical structures. SICP explicitly uses the
abstract-algebra meaning and distinguishes it from the unrelated implementation
term for a procedure plus free-variable environment. Closure is a property under
a particular operation and unit set, not generic chainability.

Lists are ordered chains of pairs, while list structure includes any pair-built
shape. The same representation can be viewed as nested sequences or as a tree,
and that view determines the recursive plan. Clause order can be semantic: the
empty list is both `null?` and not a pair, so reversing tests changes the case
classification.

`map` preserves the generated process of the direct list traversal while changing
the conceptual level at which it is expressed. Section 2.2.3 makes an
`enumerate -> filter -> map -> accumulate` signal flow visible and uses sequences
as a conventional interface among independently reusable stages. This is a
modularity claim, not an assertion that list-backed stages are streaming or
cheap. The chapter's implementation constructs intermediate lists; Chapter 3
later revisits the interface with delayed sequences.

Fold direction, nested-map order, and assumed input shape remain observable.
`fold-left` and `fold-right` differ unless the combining law supports the rewrite.
`accumulate-n` assumes equal-length sequences. Interchanging the queens mappings
recomputes the recursive solution set for every row and causes a severe cost
increase despite superficially similar code. Conventional vocabulary does not
license arbitrary stage reordering.

The picture language visually demonstrates one composition world: primitives are
painters, combinators such as `beside` and `below` return painters, and recursive
and higher-order combinators can therefore build larger painters. Applying a
painter to a frame performs drawing; that observation sits outside the closed
construction algebra. A transform also preserves only its stated geometry:
`rotate90` is a pure rotation only for square frames because other frames stretch
the image.

Stratified design assigns each level its own primitives, combinations, and
abstractions. A specification change should be expressed at the lowest level
whose vocabulary owns it: primitive drawing, recursive arrangement, or
four-quadrant combination. Robust locality follows from a truthful level map,
not from adding layers without a distinct language.

### 2.3 Symbolic Data, Sets, And Representation Tradeoffs

Quotation turns an expression-looking form into data and thereby breaks naive
substitution of equals for equals. The chapter separates syntactic identity from
semantic value before constructing the differentiator. Its differentiation
algorithm uses only sum/product predicates, selectors, and constructors; prefix,
fully parenthesized infix, or precedence-bearing notation belongs behind that
boundary. The last representation requires real parsing knowledge even if the
abstract differentiation rules remain unchanged.

Constructors own local simplifications such as `0 + x -> x`, but the source
warns that no representation is universally "simplest." A form simplest for one
purpose may be wrong for another. The later polynomial system makes the observer
choice explicit by treating a polynomial as a syntactic form rather than its
underlying mathematical function.

Set representations preserve membership laws while trading abilities and costs:

- unordered unique lists have simple construction but linear membership and
  quadratic intersection;
- duplicate-preserving lists make some additions cheaper while enlarging stored
  representations;
- ordered lists require comparable elements and improve merged operations;
- binary search trees require an ordering invariant and obtain logarithmic search
  only when balance holds.

Random insertion may balance a tree on average but gives no guarantee; sorted
insertion degenerates it to list behavior. The chapter therefore refuses to infer
a complexity guarantee from the representation label alone. A construction and
rebalancing policy must own the invariant.

Huffman coding is optimal only for messages whose symbol frequencies match the
frequencies used to build the tree. Equal-weight choices can produce several
valid trees, and branch orientation is arbitrary. The exact encoded bit string is
not the only valid observer even when decoded meaning and length are preserved.
The supplied decoder rejects non-bit values but silently accepts a stream that
ends partway down a code path; for production use, complete-code validation is an
additional accepted-input obligation, not evidence supplied by this procedure.

### 2.4 Multiple Representations And Additivity

Simple abstraction assumes one hidden representation. Large systems need a
second, vertical barrier so independently designed representations can coexist.
Tagged rectangular and polar complex numbers provide explicit representation
identity while generic selectors strip the outer tag before invoking
representation-local code and constructors restore it on output.

The example is deliberately pedagogical. The authors note that rectangular form
is usually preferable in real systems because conversion to and from polar form
introduces roundoff. Coexistence and mathematical convertibility do not prove
that two encodings are operationally equivalent.

Explicit type conditionals have two scaling weaknesses: every generic operation
must know every representation, and globally distinct procedure names are
required. Data-directed programming reifies the operation-by-type matrix and
moves method selection to one lookup. A new package adds table entries without
editing old generic selectors or old packages. That additivity depends on the
chosen axes and table contract; duplicate registration, installation order,
missing entries, and deployment are left unspecified by SICP and must be owned
by a production adaptation.

The chapter compares three matrix orientations:

- explicit dispatch groups the table by operation rows;
- data-directed registration keeps the table explicit;
- message passing groups behavior by type columns.

Exercise 2.76 makes extension frequency the selection criterion: a system that
adds types often and one that adds operations often need not choose the same
organization. Message passing as presented also supports only unary generic
operations. No orientation is universally open.

### 2.5 Mixed Types, Coercion, And Recursive Generic Data

Cross-type operations create an ownership problem that same-type dispatch does
not solve. Explicit methods for every type combination scale poorly and can make
responsibility between packages incoherent. Coercion is justified only when an
object of one type can be viewed as an equivalent object of another; some paths,
such as arbitrary complex-to-real conversion, do not exist.

The first coercion algorithm assumes two arguments and tries only one argument's
type or the other's. The text immediately identifies cases where both values
must move to a third type. A conversion graph can reduce explicit edges, but
path existence does not settle precision loss, ambiguity, operation-specific
methods, or termination. Installing identity coercions causes infinite recursion
when a same-type operation is missing, a pass-but-wrong extension exposed by
Exercise 2.81.

A linear numeric tower simplifies raising and inherited operations, but the
geometric type network demonstrates multiple supertypes and no unique raise
path. The authors call general interrelated-type modeling very difficult and
explicitly avoid classes and inheritance in Chapter 3. A richer hierarchy is not
a universal destination. Lowering also requires a round-trip equality check:
projecting and raising must recover the original value before simplification is
valid.

The polynomial package fixes its contract before implementation: univariate
syntactic forms, same-indeterminate operations, and generic coefficients. Generic
`add` and `mul` recursively handle polynomial coefficients, but term-list
representation remains purpose-dependent. Dense and sparse forms have different
costs, and supporting both is explicitly called a major effort rather than a
local change. `adjoin-term` also preserves ordering only because callers promise
to supply higher-order terms; the constructor alone does not close the invariant.

The final rational-function exercises expose numeric semantics below the generic
surface. Integer versus inexact division changes polynomial GCD behavior;
pseudodivision avoids fractions at the cost of huge intermediate coefficients;
and the mathematically straightforward algorithm remains extremely slow. Generic
dispatch preserves access to operations, not numerical stability or acceptable
resource use.

### Chapter 2 Contract Gaps And Conversion Findings

- The rational representation law excludes a zero denominator, but the displayed
  `make-rat` implementations do not enforce that precondition. Likewise,
  `div-rat` relies on a nonzero divisor numerator. These are pedagogical domain
  assumptions, not production validation evidence.
- The Huffman decoder does not reject an input ending at an internal node. Its
  stated examples remain correct, but arbitrary-bitstream acceptance is broader
  than the implementation verifies.
- Plain-text extraction disrupts several formulas and picture layouts; the PDF
  rendering and official HTML agree on their intended structure.
- No contradiction between the visually inspected PDF chapter and official HTML
  is established. The gaps above belong to accepted-domain and validation scope,
  not Texinfo conversion.

### Chapter 2 Developer Comparison

- `abstraction-barriers-and-closure.md` is faithful in separating use from
  representation, requiring laws and alternative representations, preserving a
  central closure unit, and isolating finalizers. It needs exact anchors and an
  explicit observer-relative replacement note.
- `generic-operations-and-languages.md` faithfully models horizontal and vertical
  axes, missing methods, coercion, symbolic constructors, and evaluator
  boundaries. Duplicate registration, load order, versioning, fake-variant tests,
  and product DSL criteria are useful Developer adaptations and should be labeled
  separately from literal SICP method.
- `abstraction-composition-and-state.md` accurately synthesizes barriers,
  stratified levels, closure, and generic extension. Its stronger module and
  pull-transform-push guidance comes from *Elements of Clojure* or Developer
  synthesis, not Chapter 2.
- `responsibility-and-variation.md` uses SICP appropriately as calibration for
  representation and dispatch-axis choices. Factory economics, sender movement,
  and role-focused tests are owned chiefly by *99 Bottles* and Developer.
- `recipe-cards.md` accurately extracts data-boundary, closure, dispatch, and
  meaning-preserving-path checks. Production registration policy and constructor
  closure are strengthened adaptations beyond the chapter's pedagogical tables.
- `data-driven-design.md` uses SICP only for wishful decomposition and
  procedure/process calibration; its six-artifact recipe remains HtDP-owned.
- All SICP traces remain too broad. Final repair should replace chapter ranges
  with exact Section 2.1-2.5 anchors and preserve the qualifications above.

## Chapter 3: Modularity, Objects, and State

**Read:** complete `book.txt:10124-16308`, PDF labels `294`-`486`, physical
pages 322-514, including all prose, code, footnotes, and Exercises 3.1-3.82.
Five section contact sheets cover every chapter page. Environment structures,
box-and-pointer graphs, queues and tables, circuit and constraint networks,
timing diagrams, stream signal-flow diagrams, equations, and code layout were
visually inspected. Chapter 4 begins at `book.txt:16309`.

**Canonical anchors:**

- [Chapter 3](https://mitp-content-server.mit.edu/books/content/sectbyfn/books_pres_0/6515/sicp.zip/full-text/book/book-Z-H-19.html#%_chap_3)
- [Section 3.1](https://mitp-content-server.mit.edu/books/content/sectbyfn/books_pres_0/6515/sicp.zip/full-text/book/book-Z-H-20.html#%_sec_3.1)
- [Section 3.2](https://mitp-content-server.mit.edu/books/content/sectbyfn/books_pres_0/6515/sicp.zip/full-text/book/book-Z-H-21.html#%_sec_3.2)
- [Section 3.3](https://mitp-content-server.mit.edu/books/content/sectbyfn/books_pres_0/6515/sicp.zip/full-text/book/book-Z-H-22.html#%_sec_3.3)
- [Section 3.4](https://mitp-content-server.mit.edu/books/content/sectbyfn/books_pres_0/6515/sicp.zip/full-text/book/book-Z-H-23.html#%_sec_3.4)
- [Section 3.5](https://mitp-content-server.mit.edu/books/content/sectbyfn/books_pres_0/6515/sicp.zip/full-text/book/book-Z-H-24.html#%_sec_3.5)

**Visual evidence:**

- Section 3.1 contact sheet:
  `f7441e2ac9acbbc0b33cefc6d3ee494c9be46e8dc547c81aabef6107253e0a8e`
- Section 3.2 contact sheet:
  `7bac64c575f4850cfcf28574d0a2865229706b9240f70a5d8db826c4fb93d695`
- Section 3.3 contact sheet:
  `f79036d5fc8d90c518b5cfbb2771d9801a50ee06799adb6e39786dfa211ec9f6`
- Section 3.4 contact sheet:
  `9f04335f81e8ba67061d73e448a0ea07162c0323b145e9b0362298f4b16113ca`
- Section 3.5 contact sheet:
  `e12597830b16bba6c7246cf2c61d7e9b6938e6e549a59b56a76e08c97aa2e664`

### Chapter Strategy: Two Incomplete Views Of Time

The chapter starts from a modularity goal: organize a large model so adding an
object or action changes a localized part. It develops two large-scale views.
The object view groups state into computational objects whose behavior changes
over time; the stream view treats entire information histories as timeless
sequences. These are competing decompositions, not a progression in which one
universally replaces the other. The conclusion explicitly leaves their
unification open.

The source's object criterion is relational. State variables should form tightly
coupled groups with looser coupling between groups. A class-shaped or
message-shaped boundary is not evidence that the modeled world decomposes that
way. The stream view similarly succeeds only when histories and transformations
form the natural module boundary. Representation choice follows the interaction
structure and observer, not a style preference.

### 3.1 Local State Gains Modularity And Loses Substitutability

An object has state when current behavior depends on interaction history. A state
variable is a sufficient summary of that history, not necessarily the complete
history itself. Encapsulating an account balance or pseudo-random generator can
stop clients from threading irrelevant state and can restore a direct expression
of Monte Carlo experimentation. Local state is therefore a real modularity tool.

The benefit is conditional on ownership. Each generated withdrawal procedure
retains a distinct local binding; a joint account deliberately aliases one
object. If two names reach one mutable object, an update through either name is
observable through the other. If two objects merely hold equal state, they still
have distinct identities. Equality of current fields, equality of construction
history, and substitutability under future mutation are different claims.

Assignment changes a variable from a name for a value into a reference to a
place whose content can change. The substitution model can no longer distinguish
an occurrence before `set!` from one after it. Referential transparency is lost,
and expression replacement must account for effects, ordering, and identity.
SICP treats this as a semantic cost, not just an implementation inconvenience.

Imperative updates also introduce order obligations within one process. The two
factorial assignments are correct in one order and wrong in the reverse order.
Unspecified argument evaluation order becomes observable when arguments mutate
shared state. A transition contract must therefore state which reads, checks,
and writes form one ordered action rather than merely list the final fields.

### 3.2 Environments Place Bindings And Preserve Lexical Ownership

The environment model represents an environment as a sequence of frames, each
with bindings and an enclosing-environment link. Lookup selects the first frame
containing a name, so an inner binding shadows an outer one. Expression meaning
is relative to this environment; even `+` requires a binding to addition.

A procedure object contains code and the environment in which its lambda was
evaluated. Application allocates a new frame binding parameters to arguments,
links that frame to the procedure's captured environment, and evaluates the body
there. `define` creates or changes a binding in the current frame; `set!` finds
the nearest existing binding and changes it. This precisely locates lexical
scope and closure ownership.

A generated withdrawal procedure retains the frame containing its balance after
the call that created it has returned. Two calls allocate two retained frames
while sharing procedure code. Internal helper procedures capture the same
outer-call frame, which both protects their names from the global environment
and gives them access to the enclosing parameters. Private scope expresses
ownership because of binding and reachability, not because a helper is textually
nested or called only once.

The environment model does not itself prove the runtime space behavior of tail
calls; the source postpones that guarantee to the explicit-control evaluator in
Chapter 5. Semantic environment diagrams and storage-allocation claims must
remain separate.

### 3.3 Mutation Turns Trees Into Identity-Bearing Graphs

Adding mutators to constructors and selectors expands representable structures
from acyclic pair-built values to shared and cyclic graphs. A printed list may
hide whether two paths reach the same pair. Mutation makes that sharing
observable, so traversal assumptions must name graph identity, cycle behavior,
and whether visited state is path-local or global.

The `count-pairs` exercises are a direct pass-but-wrong sequence: a structurally
plausible recursive procedure can return 3, 4, 7, or diverge on structures made
from the same number of distinct pairs. Correct distinct-node counting needs an
identity-aware visited set; cdr-cycle detection can use a different constant-space
algorithm. A list-shaped type name does not justify tree recursion once mutation
or sharing is admitted.

The queue shows that an invariant may permit apparently stale hidden state. After
deleting the last element, its rear pointer still reaches the removed pair, but
the abstraction defines emptiness by the front pointer and resets both pointers
on the next insertion. Raw printing looks wrong while all published operations
remain correct. Representation inspection is not an abstract behavior check.
The extra rear pointer trades storage and update complexity for constant-time
insertion.

Mutable tables provide stable object identity through a header cell. Their key
equality and record representation remain policies: approximate numeric keys,
arbitrary key paths, and ordered-tree storage produce different semantics and
costs. The memoization example also depends on recursive calls going through
`memo-fib`; wrapping the original `fib` caches only the outer call and leaves the
internal exponential tree unchanged. Cache placement, recursion routing, and
key/result domain are part of the performance contract.

#### Event-Driven Circuits

The digital-circuit simulator builds a small language: wires and gates are
primitives, wiring is combination, and procedures name compound circuits. Wires
own changing signals and callback sets; gates schedule output updates; the agenda
orders simulation events. Component interfaces alone are not enough—the model
also needs delay semantics and an event-order policy.

Running a newly attached action once initializes downstream signals. Actions
scheduled at the same simulated time must remain FIFO: reversing two input
changes can leave an `and` gate with a result inconsistent with the final input
state. The protected fact is not merely timestamp sorting but insertion order
within one time segment. Simulation time advances by agenda events and is
separate from host evaluation time.

#### Constraint Propagation

The constraint network states relations rather than choosing one fixed input and
output direction. Connectors retain values, their informants, and participating
constraints; constraints derive a value when enough information is available,
reject inconsistent facts, and propagate retractions only from the object that
supplied the fact. This is a different collaboration from an ordinary conversion
function when information can arrive from several directions.

A relation's mathematics does not automatically provide every operational
propagation direction. Implementing `b = a * a` with a generic multiplier cannot
derive `a` from `b`, because the multiplier waits for two known input connectors.
A primitive squarer must explicitly implement square-root direction, reject
negative output, and choose the nonnegative root. For each constraint primitive,
its supported inference directions and information requirements are part of the
contract.

The expression-oriented constraint surface is easier to compose but hides direct
handles to constraint objects. The original imperative-looking surface preserves
those handles for future operations. SICP therefore treats syntax convenience as
an ability-guarantee choice rather than an automatic replacement.

### 3.4 Concurrency Makes Correctness A Set Of Allowed Histories

Concurrent shared-state correctness begins with an invariant, such as money
conservation, and a forbidden interleaving. A withdrawal's balance read,
sufficient-funds check, and update must behave as one transition relative to
other mutations of that account. Serializing every mutation in the whole system
is unnecessarily strong; independent resources should still proceed
concurrently.

SICP presents serial equivalence as one useful correctness requirement: an
execution may interleave physically but must match some sequential order. This
can permit more than one correct result. It also presents weaker specifications,
such as diffusion updates that converge regardless of order. "Thread safe" is
not one universal property; a design must name allowed histories, safety facts,
and any progress or convergence condition.

A serializer protects a set of procedures sharing one mutex. The critical scope
must include every read whose value justifies the later write. Per-account
serialization does not make an exchange derived from two account balances
atomic. Protecting the complete exchange requires both account serializers and
exposes a real boundary tradeoff: internal locking is insufficient for a
cross-resource invariant, while exporting locks transfers orchestration risk to
clients.

Multiple locks introduce deadlock. A global resource order prevents the specific
exchange cycle only when required resources are known before acquisition. Nested
use of a non-reentrant serializer can also deadlock. The mutex abstraction itself
depends on atomic `test-and-set!`; implementing that check and write with ordinary
interleavable operations merely moves the original race down a level.

The distributed discussion weakens the idea of one continuously meaningful
global state. Between synchronizations, branches may hold different balances,
and the relevant correctness facts can be per-observer behavior plus state after
communication. Establishing shared state, event order, or a global clock requires
communication. A snapshot field alone cannot model this temporal boundary.

### 3.5 Streams Reify Histories But Do Not Remove Time Obligations

A stream has the same constructor/selector laws as a sequence, but changes when
its tail is evaluated. `delay` packages work and `force` requests it;
call-by-need memoizes the result after first force. This interleaves producer and
consumer work, permits finite observation of infinite sequences, and avoids
constructing list regions that no consumer demands.

That benefit depends on demand and memoization. Without memoization, repeated
forcing can turn linear recursive stream definitions exponential. With
memoization, forced values and the mutation used to cache them become observable
to effectful code. SICP explicitly calls mixing delayed evaluation with printing
or assignment confusing and states that mutability and delay do not mix well.
A delayed pipeline must specify replay, effect multiplicity, retained prefixes,
failure, and cancellation rather than claim ordinary eager-list equivalence.

Implicit self-reference can define integers, Fibonacci numbers, power series,
and feedback systems because delayed tails consume only information already
available. Productive self-reference still needs an initial element and a demand
path that makes progress. The prime stream works because enough earlier primes
exist for every next test; this is a dependency argument, not magic from
infinity.

Combining infinite streams requires fairness. Ordinary stream append never
reaches its second input when the first is infinite; `interleave` alternates so
every element eventually appears. Weighted merges additionally assume weights
increase along rows and columns. Completeness of generated combinations is an
ordering/progress claim distinct from correctness of each produced element.

Streams make complete state histories available for transformations such as
convergence acceleration, signal conditioning, and numerical integration. The
ODE and circuit examples remain discrete approximations parameterized by `dt`;
the chapter demonstrates composition but does not provide numerical stability or
error bounds for arbitrary equations. Those are separate model contracts.

The stream account reaches the chapter's boundary. A pure function can map an
input request stream to balances, but merging independent users' requests must
respect real-time observations. That merge is a relation with several acceptable
interleavings, not a deterministic function of the two streams. Functional
representation moves the synchronization problem; it does not eliminate it.

### Chapter 3 Contract Gaps And Conversion Findings

- The provided PDF's Figure 3.6 renders the withdrawal body with an extra minus,
  `(-- balance amount)`. The surrounding code and canonical MIT figure
  `ch3-Z-G-7.gif` use `(- balance amount)`; the locally fetched canonical
  figure hashes to
  `c4b255b64304f5f90c43a4f4405166ac8f19e8ca356a931c8746de134b721694`.
  This is a confirmed Texinfo conversion defect and is excluded from source
  evidence.
- Plain-text extraction scrambles the nested two-dimensional `lookup` layout on
  PDF label `364`; the rendered PDF and official HTML show the correct nesting.
  This is an extraction artifact, not a book defect.
- The general-looking `memoize` uses false both for "not found" and a cached
  false result. It is correct for the numeric Fibonacci example but does not
  memoize arbitrary false-valued calls. A production cache needs separate
  membership evidence.
- The serializer releases its mutex only after a normal return. Errors or other
  nonlocal exits can leave it locked. The presented mechanism is pedagogical,
  not production cleanup evidence.
- The account's deposit operation accepts negative values; the source explicitly
  labels the use of this fact by `exchange` a serious bug.
- A connector remembers one informant. A second independent assertion of the
  same value is ignored rather than retained as additional support, so retracting
  the first can erase a still-supported fact. The example is not a general truth-
  maintenance system.
- The numerical stream examples establish executable approximations, not general
  convergence, discretization-error, or stability guarantees.
- Apart from the confirmed Figure 3.6 conversion error, no PDF/canonical
  contradiction affecting the chapter's derivation has been established.

### Chapter 3 Developer Comparison

- `processes-state-and-time.md` is faithful on history summaries, identity,
  aliases, order laws, atomicity, and explicit state alternatives. It currently
  merges state streams and event logs too quickly. Final repair should distinguish
  a stream of states from a log folded into state, add fair/nondeterministic merge
  obligations, delayed-effect and memoization semantics, multi-resource atomic
  scope, deadlock, and release-on-failure.
- `abstraction-composition-and-state.md` faithfully treats state/process choice as
  a representation boundary and points to the detailed process reference. Its
  module-model and pull-transform-push rules come from *Elements of Clojure* and
  Developer synthesis rather than Chapter 3.
- `worked-models-and-specialized-techniques.md` accurately extracts relational
  constraint propagation, assertion ownership, retraction, and contradictions.
  It should make supported inference directions and the one-informant versus
  multi-support policy explicit.
- `problem-modeling.md` correctly separates snapshot models from histories,
  safety from progress, and abstract transitions from observable implementation
  states. Its broader formal-method and solver workflow is not SICP-owned.
- `generic-operations-and-languages.md` is consistent with the circuit and
  constraint examples as small languages. Production parsing, versioning,
  budgets, and migration requirements are strengthened Developer boundaries;
  Chapter 3's systems are constructed through host-language procedures.
- `recipe-cards.md` faithfully derives history placement and event-order checks.
  The event-order card should preserve Chapter 3's narrower-protected-region
  lesson while adding cross-resource composition and deadlock checks.
- `responsibility-and-variation.md` is supported in grouping coherent local state,
  behavior, and identity, but its role, factory, and testing method remains
  chiefly *99 Bottles*-owned.
- `composition-generative-recursion-and-accumulators.md` cites SICP only for
  wishful decomposition, higher-order abstraction, and process shape. Its recipe
  details remain HtDP-owned; Chapter 3 does not supply that construction method.
- All SICP traces remain too broad. Final repair should use exact Section 3.1-3.5
  anchors and explicitly label the production obligations that go beyond the
  pedagogical mechanisms.

## Chapter 4: Metalinguistic Abstraction

**Read:** complete `book.txt:16309-22054`, PDF labels `487`-`665`, physical
pages 515-693, including the chapter introduction, all prose, code, footnotes,
and Exercises 4.1-4.79. Four section contact sheets cover every chapter page.
The eval/apply cycle, abstract machines, parse trees, query pipelines,
unification equations, and all code whose page layout carries meaning were
visually inspected. Chapter 5 begins at `book.txt:22055`.

**Canonical anchors:**

- [Chapter 4](https://mitp-content-server.mit.edu/books/content/sectbyfn/books_pres_0/6515/sicp.zip/full-text/book/book-Z-H-25.html#%_chap_4)
- [Section 4.1](https://mitp-content-server.mit.edu/books/content/sectbyfn/books_pres_0/6515/sicp.zip/full-text/book/book-Z-H-26.html#%_sec_4.1)
- [Section 4.2](https://mitp-content-server.mit.edu/books/content/sectbyfn/books_pres_0/6515/sicp.zip/full-text/book/book-Z-H-27.html#%_sec_4.2)
- [Section 4.3](https://mitp-content-server.mit.edu/books/content/sectbyfn/books_pres_0/6515/sicp.zip/full-text/book/book-Z-H-28.html#%_sec_4.3)
- [Section 4.4](https://mitp-content-server.mit.edu/books/content/sectbyfn/books_pres_0/6515/sicp.zip/full-text/book/book-Z-H-29.html#%_sec_4.4)

**Visual evidence:**

- Section 4.1 contact sheet:
  `b2d397fdd0dc2c1e5fac80f80d0ff86346edf8669fd5ca979da1707170a30cad`
- Section 4.2 contact sheet:
  `eadaf4f531e880e539d2be644933b8cec8aac579a5e4467c63166116156d7cbd`
- Section 4.3 contact sheet:
  `42c3aa5518065216c3fcd775ff375ffbbbecf83f35b69a3b5079105d353e3b2e`
- Section 4.4 contact sheet:
  `0c03ba05b10aeabdfb81716cbb0a380861f6bf436718a0200579599454ea662b`

### Chapter Strategy: A Language Is An Executable Model Of Meaning

Metalinguistic abstraction controls complexity by choosing vocabulary suited to
a problem and implementing its meaning. The chapter's strongest claim is that an
evaluator is itself a program. Language design therefore becomes inspectable and
changeable rather than a fixed property of the host language.

The recurring architecture is broader than Lisp syntax. A language has primitive
elements, means of combination, means of abstraction, representations for syntax
and runtime state, and an evaluator that assigns meaning. Circuit simulators,
constraint networks, polynomial systems, nondeterministic search, and query rules
all fit this frame while making different semantic choices.

Calling a configuration or fluent API a language is not enough. Its evaluator or
execution mechanism must decide order, scope, value multiplicity, failure,
effects, and resource behavior. Conversely, a full parser is not required for a
host-embedded language; Chapter 4 commonly obtains syntax as already-read list
structure and concentrates on evaluation.

### 4.1 The Metacircular Evaluator Exposes Semantic Ownership

The evaluator's central cycle separates two responsibilities. `eval` classifies
an expression relative to an environment and reduces it to a procedure plus
arguments; `apply` applies that procedure, extending the captured environment for
compound procedures. This connective tissue supplies nesting, variables,
compound procedures, and special forms. Primitive operations alone do not define
a language.

Abstract syntax predicates, selectors, and constructors isolate evaluator rules
from concrete list representation. This is a representation barrier over syntax,
not validation of arbitrary input. Clause order remains semantic because a
procedure application is defined as any remaining pair after special forms have
been recognized. Moving the broad application case earlier misclassifies forms
such as `define`.

Derived expressions lower one language surface into a smaller semantic core.
`cond`, `let`, `let*`, named `let`, and iteration constructs can be translated to
`if`, lambda, application, and sequencing. Such a translation must preserve:

- single versus repeated evaluation;
- left-to-right dependencies where specified;
- short-circuit behavior;
- lexical scope and generated-name hygiene;
- effects, errors, and termination.

The text explicitly notes that user macro systems require additional work to
avoid name conflicts. A syntactic rewrite is not correct merely because pure
examples return equal values.

The implementation distinguishes the represented language from the host at
several boundaries. `true?` translates represented truth to host truth;
primitive procedure wrappers separate host procedures from evaluator procedure
objects; the host `apply` cannot directly consume a represented compound
procedure. Installing host `map` as a primitive therefore fails when it receives
represented procedures, while defining `map` inside the evaluator works.

The evaluator also inherits facts it does not explicitly own. Operand order
follows host evaluation unless `list-of-values` enforces one. The metacircular
model does not explain call/return control or tail-call space; those are deferred
to Chapter 5. Environment lookup is intentionally inefficient. Error handling and
debugging are omitted. A runnable model supports specific semantic claims, not
production completeness.

#### Programs As Data And Universal Machines

An evaluator treats the user's expression as executable syntax while itself
manipulating that expression as data. This bridge supports language tools and
self-description, but host `eval` and represented `eval` are not interchangeable:
they use different environment and procedure representations.

A universal evaluator can emulate any machine described in its accepted
language, subject to time and memory. This does not make every property of a
program decidable. The halting argument demonstrates a well-posed semantic
question for which no general deciding procedure exists. Tooling contracts must
separate execution, bounded analysis, and impossible universal guarantees.

#### Internal Definitions And Analysis Staging

Mutually recursive local definitions require all names to be in scope across the
whole body. Sequential definition happens to work when definitions come first
and their value expressions do not prematurely use one another, but that is an
accidental subset of simultaneous scope. Scanning definitions into unassigned
bindings plus later assignments makes the ownership rule explicit and turns
premature reads into errors.

The alternatives in Exercises 4.16-4.20 show that "simultaneous" itself needs an
operational contract. Allocating all names before evaluating values differs from
evaluating all values before assigning any. Correct programs may not observe the
extra frame, while ill-founded initializers expose the distinction.

Separating `analyze` from execution moves syntax classification and recursive
analysis to a once-per-expression phase. Execution procedures retain only the
environment-dependent work. This is both an optimization and a boundary:
analysis may precompute syntax structure, but variable values, effects, and
runtime branch choice remain execution facts. Benchmarks must measure both
phases rather than infer speedup from architecture alone.

### 4.2 Lazy Evaluation Changes The Language Contract

Normal-order semantics delay compound-procedure arguments until demanded;
strictness is a property of each procedure argument, not merely of the whole
language. Laziness permits a procedure to return without evaluating an erroneous
or divergent unused argument and can make constructors non-strict. That is new
expressive power, not a transparent implementation optimization.

A thunk must capture both an expression and the environment of the original
application. Forcing computes the actual value in that environment. Call-by-need
then mutates the thunk to retain its value and discards the no-longer-needed
environment. Non-memoized call-by-name can repeat work and effects; memoized
call-by-need performs them at most once per thunk. The choice changes observable
behavior in the presence of assignment.

Demand points are explicit in the evaluator: the operator before application,
primitive arguments, conditional predicates, and top-level output. Sequence
semantics remain contentious because an intermediate expression may exist only
for an effect and might never be forced. The exercises deliberately leave a
language-design judgment rather than presenting one universal answer.

Making every compound procedure lazy is incompatible with ordinary Scheme.
Per-parameter strict, lazy, and lazy-memo declarations are offered as a possible
upward-compatible design. A production language must expose or deliberately hide
this choice; accidental dependence on host demand is not a stable contract.

Lazy procedural pairs unify finite lists, streams, and more general delayed
structures, but create boundary obligations. Quoted lists read by the host retain
the host representation and fail under the new `car`; printing must decide how
much of a possibly infinite value to force. Uniform internal semantics still
requires parsing, quoting, serialization, debugging, and display adapters.

### 4.3 Nondeterministic Evaluation Makes Search Part Of Meaning

`amb` gives an expression several possible values; `(amb)` represents failure,
and `require` rejects a branch. The supplied evaluator implements left-to-right,
depth-first, chronological backtracking. This strategy is not incidental. An
infinite early branch can starve later valid alternatives, so repeatedly asking
for another answer does not by itself guarantee completeness.

A nondeterministic program separates a declarative-looking candidate relation
from a search mechanism, but source order still controls feasibility and cost.
Moving restrictions earlier can prune enormous candidate sets. Rearranging
recursive grammar alternatives can change productive enumeration into immediate
divergence. Search order, fairness, bounds, and answer multiplicity remain part of
the operational contract.

The parser examples also show that syntax and meaning do not collapse. Grammar
rules construct parse trees, and one sentence may have several structurally valid
parses with different meanings. The parser's global unparsed input relies on
left-to-right operand evaluation and rollback. A green parse example does not
prove all parses are found, invalid strings terminate, or ambiguity is resolved.

The evaluator implements search with success and failure continuations. A
success carries both a value and the continuation that can seek the next value;
a failure returns control to the most recent choice with remaining alternatives.
The top-level `try-again` deliberately invokes that saved failure path after a
successful answer.

Backtracking must also define effect semantics. Ordinary `set!` saves its old
binding and installs a failure continuation that restores it. `permanent-set!`
would deliberately survive backtracking. Errors such as unbound variables are
program faults, not search failure, and therefore do not try another branch.
Effects need an explicit category: reversible branch-local effect, committed
effect, or fatal error.

### 4.4 Logic Programming Does Not Eliminate Control

Logic programming treats facts, relations, and rules as the main vocabulary. One
append relation can answer forward construction, solve for a missing suffix, or
enumerate list splits. This multi-directional ability comes from unification and
search, not from the rule text alone. Mathematically equivalent rule sets can have
radically different termination and performance behavior.

The query system separates several mechanisms:

- pattern matching extends a frame when a datum fits a one-sided pattern;
- unification symmetrically solves compatible bindings on both sides;
- the occurs check rejects cyclic self-dependence such as binding a variable to an
  expression containing that variable;
- rule application renames variables per invocation, unifies the query with the
  rule conclusion, and evaluates the body in the extended frame;
- streams represent all matching frame extensions and interleave alternatives.

This closely parallels eval/apply: procedures bind parameters and evaluate
bodies, while rules unify conclusions and evaluate query bodies. The common
shape does not erase semantic differences. Query evaluation can yield zero, one,
many, or infinitely many frames, and the same logical answer may appear multiple
times through different proofs.

Conjunction passes a frame stream serially through each query, so clause order
changes intermediate cardinality and cost. Disjunction processes alternatives
and interleaves results to avoid starving a later stream. Explicit delay prevents
recursive rule application from being entered before any available assertion can
produce an answer. Logical equivalence alone does not preserve the generated
search process.

`not` is a filter on already-bound frames, not classical negation. Applied before
its variables are bound, it can remove the empty frame and produce an unexpected
empty answer. More fundamentally, it means "not deducible from this database"
under a closed-world assumption, not "false in the modeled world."
`lisp-value` likewise requires instantiated arguments and delegates meaning to a
host predicate. Both weaken claims that query answers follow solely from positive
mathematical logic.

Recursive rules can enter infinite proof paths; breadth-first search or loop
history can avoid some cases but no general termination detector exists. Duplicate
proofs also invalidate naive aggregation: summing a value once per result frame
may count one fact several times. A query product must specify set versus bag
semantics, proof identity, recursion strategy, negation scope, and termination.

The implementation's indexing is a performance model rather than query meaning.
Assertions and rules are grouped by a constant leading symbol, while variable-led
rules remain candidates for every matching key. More sophisticated indexing may
replace this choice if it preserves the same answer and multiplicity contract.
The data-directed `qeval` dispatch permits new query forms, but each extension
must define how it transforms frame streams and interacts with delay and binding.

### Chapter 4 Contract Gaps And Conversion Findings

- The metacircular evaluator intentionally omits production error handling and
  debugging, uses inefficient environment lookup, inherits host operand order,
  and does not model call/return control or tail-call space. It is not evidence
  that a small evaluator is a complete runtime.
- The lazy evaluator's memoization mutates thunks and changes effect multiplicity.
  Its sequence semantics are deliberately left as a design question, and its
  wholesale normal-order change is not backward compatible with Scheme.
- Lazy procedural pairs do not automatically translate quoted host lists, and an
  unbounded printer cannot safely display arbitrary infinite lists. Both are left
  as explicit exercises rather than solved interoperability claims.
- The amb evaluator rolls back assignments handled by its `set!` analyzer. It
  does not thereby establish rollback for arbitrary primitive mutation, I/O, or
  external effects. Definitions are also not generally undone. A production
  search runtime needs a complete effect policy.
- Depth-first chronological backtracking can diverge before reaching an existing
  later answer. "No answer observed" is not proof that no answer exists.
- Query-language negation is order-sensitive negation-as-failure under a closed-
  world assumption. Host predicates, duplicate proofs, and infinite deduction
  paths further bound any mathematical-logic claim.
- Plain-text extraction splits the two-page `analyze-amb` definition so its
  parentheses and expressions appear reordered. Rendered PDF labels `589`-`590`
  and the official HTML show the valid continuation argument. This is an
  extraction artifact.
- Mathematical equations and query-pipeline figures agree between the rendered
  PDF and official HTML. No new PDF/canonical contradiction affecting Chapter 4
  derivation is established.

### Chapter 4 Developer Comparison

- `generic-operations-and-languages.md` faithfully requires primitives,
  combination, abstraction, evaluator semantics, and explicit errors/effects.
  Its current evaluator contract assumes one `Result | LanguageError`; final
  repair should admit zero/one/many result protocols, search order, fairness,
  multiplicity, branch failure, rollback, negation, and termination when the
  accepted language is nondeterministic or relational.
- The same reference's validation, migrations, versioning, resource budgets, and
  production error taxonomy are valuable Developer adaptations, not literal
  Chapter 4 artifacts. SICP commonly starts from host-read symbolic data and
  intentionally omits production debugging and errors.
- `problem-modeling.md` is faithful in separating mathematical relationships from
  runtime semantics and in requiring duplicate, search-order, and termination
  policies for logic programming. Exact Section 4.3-4.4 anchors and the
  closed-world/unbound-negation boundary should be added during final repair.
- `worked-models-and-specialized-techniques.md` correctly asks logic models to
  state facts, rules, query semantics, duplicate behavior, search order, and
  cyclic termination. It should also calibrate negation-as-failure, proof versus
  answer identity, and host-predicate escape hatches.
- `abstraction-barriers-and-closure.md` is supported by abstract syntax and runtime
  representation barriers, but Chapter 4 adds a stronger warning: changing
  evaluator semantics can invalidate adapters, quoted data, host procedures, and
  effects even when internal syntax operations remain abstract.
- `abstraction-composition-and-state.md` accurately treats a language level as
  meaningful only when it introduces primitives, combinations, and reusable
  abstractions. Chapter 4 further requires an executable meaning and operational
  contract for that vocabulary.
- `processes-state-and-time.md` is supported by lazy demand, memoization,
  backtracking, and query-stream order. Final repair should connect its process
  artifact to search fairness, result multiplicity, rollback scope, and
  negation-as-failure.
- `recipe-cards.md` accurately extracts notation-as-data and event/history
  boundaries, but a language review needs an evaluator/search card or an explicit
  route to `generic-operations-and-languages.md` for semantics beyond rewriting.
- `data-driven-design.md` and
  `composition-generative-recursion-and-accumulators.md` use SICP narrowly for
  wishful decomposition, syntax/process distinctions, and higher-order
  abstraction. Their construction recipes remain HtDP-owned.
- All SICP traces remain too broad. Final repair should use exact Section 4.1-4.4
  anchors and distinguish the textbook's semantic mechanisms from the package's
  production language-engineering obligations.

## Chapter 5: Computing with Register Machines

**Read:** complete `book.txt:22055-27575`, PDF labels `666`-`833`, physical
pages 694-861, including the chapter introduction, all prose, code, footnotes,
and Exercises 5.1-5.52. Five section contact sheets cover every chapter page.
Data-path and controller diagrams, stack/register layouts, memory-vector and
collector diagrams, the evaluator chip image, generated instruction sequences,
and typography-sensitive code were visually inspected. The References begin at
`book.txt:27576` on physical page 862.

**Canonical anchors:**

- [Chapter 5](https://mitp-content-server.mit.edu/books/content/sectbyfn/books_pres_0/6515/sicp.zip/full-text/book/book-Z-H-30.html#%_chap_5)
- [Section 5.1](https://mitp-content-server.mit.edu/books/content/sectbyfn/books_pres_0/6515/sicp.zip/full-text/book/book-Z-H-31.html#%_sec_5.1)
- [Section 5.2](https://mitp-content-server.mit.edu/books/content/sectbyfn/books_pres_0/6515/sicp.zip/full-text/book/book-Z-H-32.html#%_sec_5.2)
- [Section 5.3](https://mitp-content-server.mit.edu/books/content/sectbyfn/books_pres_0/6515/sicp.zip/full-text/book/book-Z-H-33.html#%_sec_5.3)
- [Section 5.4](https://mitp-content-server.mit.edu/books/content/sectbyfn/books_pres_0/6515/sicp.zip/full-text/book/book-Z-H-34.html#%_sec_5.4)
- [Section 5.5](https://mitp-content-server.mit.edu/books/content/sectbyfn/books_pres_0/6515/sicp.zip/full-text/book/book-Z-H-35.html#%_sec_5.5)

**Visual evidence:**

- Section 5.1 contact sheet:
  `ecc3408155e9ebbc3a1a2dbdb60d3c27aa1a3bb162c4a53cc762bdafba53b671`
- Section 5.2 contact sheet:
  `6f11195a82daa0f74ea178a6f1068735aafd90f7aab744ba9a040d357e48f588`
- Section 5.3 contact sheet:
  `769c9bc87286ff080023bf3247bcb4fa82e83eb373cc001b7e8e188045508cbc`
- Section 5.4 contact sheet:
  `6eb496b8d74f4ae2dc225d3b0d9aa8cd812c12c99fddab4aaf47d69b04124598`
- Section 5.5 contact sheet:
  `df0567e444ddbfae1cfda896e40b9e7785a33cdae2765a7fdbaa523e5e46247d`

### Chapter Strategy: Lowering Exposes Hidden Guarantees

The chapter completes a sequence of increasingly precise evaluation models.
Substitution explained selected pure expressions; environments exposed binding
and state; the metacircular evaluator exposed language semantics; register
machines expose control transfer, saved state, storage, and generated code.
Each lower level resolves questions deliberately hidden by the level above.

A lower-level account is not automatically the best product interface. It is a
calibration tool for promises about process shape, stack use, evaluation order,
memory, tail calls, compiler equivalence, and interoperation. Abstraction remains
necessary, but every declared primitive leaves a lower-level obligation that
must eventually be owned somewhere.

### 5.1 A Machine Is Data Paths Plus Control

A register machine separates what values can flow from when operations happen.
Data paths identify registers, constants, primitive operations, tests, and
assignment connections. The controller orders assignments, tests, branches,
and jumps. Neither half alone describes the computation.

The textual register-machine language deliberately favors controller visibility
over a compact account of wiring. Its Lisp-like surface is misleading if read as
arbitrary Lisp: operation inputs are restricted to registers and constants, and
only the enumerated instruction forms are legal. A notation that resembles its
host still needs its own grammar and semantics.

Operations produce register values; actions such as printing cause external
effects without producing a stored result. `read` also crosses the modeled
machine boundary even though it returns a value. Treating both as primitives
makes a focused controller possible, but does not make I/O simple. The omitted
reader, printer, device, buffering, and failure mechanisms remain real runtime
work.

#### Abstraction By Progressive Lowering

The GCD machine first treats remainder as primitive, then replaces it with a
subtraction loop. This is a concrete representation-barrier test: the upper
controller purpose remains while one primitive expands into lower operations.
A complex primitive is legitimate when its contract is explicit and its lower
implementation can be supplied without changing its users.

The replacement can still change operational observers. Repeated subtraction
has different time behavior and numeric applicability from a hardware or host
remainder operation. Refinement must state which behavior is preserved and
which cost or failure properties are allowed to change.

#### Shared Subroutines Require A Return Protocol

Sharing data paths removes duplicated hardware only when old register contents
are dead or saved. Sharing controller instructions requires a continuation
location. A fixed discriminator supports a small number of callers; storing a
label in `continue` generalizes return. A nested subroutine call then has to save
the caller's continuation before installing its own.

This is not merely textual deduplication. The shared subroutine has a calling
convention: input registers, result registers, clobbered registers, saved state,
and return location. A helper whose callers silently rely on overwritten state
is not a sound abstraction.

#### Iterative And Recursive Processes Differ In Retained Work

An iterative process fits in a fixed set of state registers plus a controller
loop. A recursive process suspends unfinished work. The factorial machine must
retain both the old `n` and the continuation that says to multiply after the
subproblem returns. A stack is dictated by unbounded, last-in-first-out nesting,
not by recursive spelling alone.

Only values live after the recursive call need saving. `val` is intentionally
not saved because the subproblem result replaces it. The Fibonacci machine
shows multiple call sites and different saved values. Save-everything can be
correct but increases stack work and retains data that might otherwise become
garbage; save-too-little is pass-but-wrong whenever a later step needs a
clobbered value.

Any physical stack is finite, so the abstract machine's unbounded recursion is a
conditional model. A process claim should distinguish logical nesting depth,
maximum supported depth, overflow behavior, and possible tail-call elimination.

### 5.2 The Simulator Makes The Machine Language Executable

The simulator turns controller text into a machine model with registers, a
stack, operations, program counter, flag, and instruction sequence. Each
assembled instruction holds both its source text and a no-argument execution
procedure. Execution repeatedly invokes the procedure at `pc`; every
instruction must either advance or replace `pc`.

This architecture exposes three stages:

1. controller text names labels, registers, operations, and instructions;
2. assembly resolves labels and registers and builds execution procedures;
3. simulation executes those pre-analyzed procedures against mutable machine
   state.

The assembler therefore parallels the analyzing evaluator. Static work such as
label lookup, register lookup, operation lookup, and expression classification
happens once. Dynamic work reads current register contents and performs effects.
Moving work to assembly time is sound only when its meaning does not depend on
runtime state.

#### Language Validation Is Part Of Assembly

Instruction generators jointly define syntax and meaning. They reject unknown
instruction tags, unknown registers or operations, undefined labels, non-label
branch destinations, malformed tests, and unsupported primitive expressions.
But the baseline implementation is intentionally incomplete:

- duplicate labels are accepted and resolve according to table construction;
- operation expressions accidentally accept labels even though the stated
  language permits only registers and constants;
- a bare stack does not remember which register supplied a value;
- malformed arity and many shape errors rely on host list operations.

Exercises 5.8-5.13 are not cosmetic enhancements. They demonstrate that a
language contract includes duplicate policy, static inventory, inferred
resources, operand restrictions, and stack discipline. Running valid examples
cannot establish rejection behavior.

The three proposed `restore` semantics are all coherent but incompatible: pop
the latest value regardless of source, require source-register agreement, or
maintain a separate stack per register. Syntax alone does not select one. The
machine language must declare the policy, and its programs and optimizations
must be checked against that choice.

#### Instrumentation Turns Resource Claims Into Evidence

Instruction traces, register traces, breakpoints, instruction counts, total
pushes, and maximum stack depth are observers on the simulated process. They can
verify control paths and derive formulas over input size. A returned value alone
cannot distinguish an iterative process from a result-equivalent process that
leaks stack.

Measurements remain model-relative. Simulated instruction count is not wall
clock time, and a Scheme-hosted simulator can be much slower than the machine it
models. The useful claim is comparative only after instruction costs, input
class, and monitored boundaries are stated.

### 5.3 Representation And Collection Define Runtime Identity

Pairs can be lowered to parallel `the-cars` and `the-cdrs` vectors, with a pair
pointer represented by a typed index. `car`, `cdr`, mutation, and allocation
become vector reads, writes, and movement of a `free` pointer. This representation
preserves box-and-pointer structure, including sharing, while replacing abstract
pair cells with conventional addressed memory.

Typed-pointer design affects available indices, numeric range, primitive
instruction cost, and equality. If a number is represented directly in its
pointer, equal numbers have identical pointers; if equal numbers can occupy
different heap locations, pointer equality no longer means numeric equality.
Symbol interning deliberately canonicalizes equal names so `eq?` can be pointer
comparison. Equality and identity contracts are therefore representation
choices, not consequences of the printed value.

The simple bump allocator eventually exhausts finite memory. Garbage collection
preserves an illusion of continuing allocation by reclaiming objects unable to
influence future computation. "Unable to influence" is operationalized as not
reachable by following pair pointers from the complete root set. That definition
assumes no hidden external references, finalizers, weak references, or other
observers outside the model.

#### Stop-And-Copy Is An Invariant-Driven Graph Transformation

The collector copies reachable objects from working memory to a semispace,
updates roots and internal pointers, and flips the spaces. Forwarding addresses
in broken-heart cells preserve sharing and terminate traversal of cycles: a
second edge to an already moved object reuses the first new address rather than
copying it again.

The `scan` and `free` pointers encode a useful invariant:

```text
[0, scan)  = copied objects whose outgoing pair pointers are relocated
[scan, free) = copied objects still awaiting pointer scanning
[free, end) = unused to-space
```

Initialization relocates the root. Each loop step scans one copied pair and may
extend `free`. Termination at `scan == free` means the graph reachable from the
root has been closed under outgoing pair pointers. The invariant explains both
preservation and progress; the code listing alone does not.

Correctness depends on additional conditions:

- every live pointer is reachable from and represented in the root set;
- the collector can distinguish pair pointers from immediate values and other
  runtime objects;
- every copied reference is rewritten before old space is discarded;
- live data fits in to-space, leaving enough capacity to resume allocation;
- mutators do not concurrently change the graph unless a barrier or concurrent
  collector protocol is supplied.

The chapter's collector stops the computation and assumes two equal semispaces.
Its compactness and work proportional to live data trade away half the address
space and introduce pause time. Mark-sweep and real-time variants have different
costs. "Automatic memory" is not one performance contract.

### 5.4 Explicit Control Makes Tail Recursion A Runtime Guarantee

The explicit-control evaluator assigns stable roles to seven registers:
expression, environment, result, continuation, procedure, argument list, and
unevaluated operands. `eval-dispatch` classifies syntax; recursive evaluation is
implemented by saving live registers, installing a continuation label, and
jumping back to dispatch. `apply-dispatch` distinguishes primitive and compound
procedures under a calling convention shared by the whole machine.

Operand evaluation is explicitly left-to-right. This resolves a choice that the
metacircular evaluator inherited from its host. Register saving is determined by
liveness: environment, pending operands, procedure, accumulated arguments, and
continuation are saved only across subevaluations that may clobber them and
before they are next needed.

Tail recursion is achieved at `ev-sequence-last-exp` by restoring the caller's
continuation before jumping directly to evaluate the final expression. A
result-equivalent variant that saves environment and pending sequence around
every final expression still returns correct finite examples but accumulates
stack on iterative calls. This is a canonical pass-but-wrong case: value tests
pass while the language's proper-tail-recursion guarantee fails.

The guarantee is placement-specific. Tail position is created by the language's
sequence, conditional, and procedure-body semantics; recursive syntax does not
create it. Implementations must verify that translations and new special forms
propagate tail context rather than inserting a return frame after the call.

The evaluator still treats syntax, environment operations, primitive
application, I/O, and storage allocation as primitives. Its driver catches only
unknown expression and procedure kinds. Unbound variables, primitive type
errors, division by zero, and other failures can escape to the host unless every
operation participates in an explicit condition protocol. Resetting the stack
on re-entry avoids stale frames but is not a production error system.

### 5.5 Compilation Preserves Meaning Through A Machine Contract

An interpreter traverses source representation at runtime and dispatches through
a universal controller. A compiler traverses it ahead of time and emits an
object program specialized to that expression and target machine. Compilation
can remove repeated syntax classification, unnecessary saves, indirect variable
lookup, and generic primitive dispatch. It does not remove the runtime library,
storage allocator, calling convention, or error obligations.

The compiler carries two explicit context parameters:

- `target`: the register that must receive the expression value;
- `linkage`: continue with the next instruction, return through `continue`, or
  jump to a named label.

These are semantic collaboration contracts between generated fragments. They
prevent each generator from inventing private result and control conventions.
Compiled and interpreted procedures can interoperate only because they agree on
register roles, procedure representation, argument lists, return values, and
continuations, with adapters where stack and register placement differ.

#### Effect Summaries Drive Safe Composition

An instruction sequence carries statements plus sets of registers it `needs`
and `modifies`. `preserving` inserts saves only when the first sequence modifies
a register whose old value the second sequence needs. Sequential, parallel, and
out-of-line combinations compute different summaries because their execution
relations differ.

This is a small effect system. Its optimization is sound only if every generator's
summary is conservative and every combiner implements the correct control shape.
Omitting a modified register may generate code that silently uses a clobbered
value; claiming an unnecessary modification merely loses an optimization.
Result tests over a few expressions do not prove summary soundness across all
compositions.

Tail-call compilation is another contract-sensitive optimization. When target
is `val` and linkage is `return`, generated code jumps directly to the callee
entry without saving a continuation that would merely be restored. Adding that
apparently harmless frame preserves returned values but destroys constant-space
iteration.

#### Optimization Must Respect Scope And Evaluation Order

The compiler evaluates operands right-to-left because it reverses operand code
before consing values into source order. The explicit evaluator evaluates them
left-to-right. Scheme leaves operand order unspecified, so both implementations
can conform, but effects can make mixed execution observably different. A
language that specifies order cannot use this transformation without preserving
that order.

Lexical addressing replaces dynamic name search with frame and displacement
coordinates derived from a compile-time environment. It is valid because lexical
scope makes runtime frame structure correspond to program structure. Internal
definitions must first be normalized so frame positions are stable; dynamic
global definitions remain runtime lookups.

Open-coding a primitive call is valid only when the compiler can prove that the
name denotes that primitive. Treating `+` or `*` as permanently reserved breaks
programs that lexically rebind them. Consulting the compile-time environment
repairs the local case, while mutation or global redefinition needs a stronger
guard or deoptimization policy. Faster code is wrong when the binding assumption
is false.

#### Performance And Safety Claims Are Comparative

For factorial, the compiled example uses fewer pushes and lower maximum stack
depth than interpretation, but more than a hand-tailored machine. The chapter
asks for formulas and asymptotic ratios, not a verdict from one benchmark.
Optimization quality is relative to a source program, target machine, calling
convention, workload, and selected observers.

Bounds checks, primitive validation, and error signaling impose runtime cost.
Removing them may improve a narrow speed measurement while turning specified
errors into crashes or wrong answers. A compiler contract must state which
checks are mandatory, proven redundant, configurable, or absent.

Interpretation and compilation remain complementary. Interpreted code preserves
source-level interactive inspection; compiled code specializes across
abstraction boundaries. Porting either still ends at a small machine-specific
kernel for allocation, I/O, and primitive application. Bootstrapping the compiler
is strong consistency evidence, but identical output from two compiler paths is
not by itself a semantic proof.

### Chapter 5 Contract Gaps And Conversion Findings

- The register-machine language examples are not a complete validator. Duplicate
  labels, forbidden label operands, restore discipline, inferred registers, and
  malformed instruction shapes are deliberately delegated to exercises.
- The simulator's recursive `execute` loop relies on proper tail recursion in
  the host Scheme. A host without that guarantee can overflow while simulating
  an otherwise constant-space controller loop.
- Instruction counts and stack metrics are faithful to the simulated cost model,
  not automatically to hardware time, cache behavior, allocation, or I/O.
- The collector assumes a complete root set, recognizable pointers, stopped
  mutation, and a live graph that fits in one semispace. External handles,
  concurrency, weak references, finalizers, and out-of-memory policy are outside
  the presented model.
- The explicit evaluator and compiler omit a complete condition system. Host
  failures can escape the machine, and optimized code may omit checks unless
  safety is explicitly retained.
- The compiler supports a small Scheme subset and a rudimentary optimization
  set. Its generated-code example is not evidence of general optimization,
  semantic equivalence under every observer, or production portability.
- Plain-text extraction renders subtraction boxes in Figures 5.5 and 5.11 as
  `--`; the rendered PDF and official figures show a single minus. This is an
  extraction artifact, not a machine operation.
- On PDF label `817`, the final arguments `3` and `4` of the lexical-addressing
  lambda example are displaced toward the page margin. The official HTML keeps
  them in the same code block. The expression remains recoverable, so this is a
  Texinfo layout defect and is excluded from derivation evidence.
- All other inspected diagrams, code sequences, captions, and equations agree
  in derivation-relevant content with the official HTML. No new canonical
  contradiction affecting Chapter 5 claims is established.

### Chapter 5 Developer Comparison

- `processes-state-and-time.md` accurately requires generated-work, deferred-
  work, stack, time, space, and order traces. Its Source Trace currently names
  only SICP Chapters 1 and 3 even though Chapter 5 supplies the explicit
  continuation, liveness, tail-call, instruction-count, and stack-depth
  calibration. Final repair should add exact Sections 5.1, 5.2.4, and 5.4.2
  anchors and make proper-tail guarantees a first-class process check.
- `generic-operations-and-languages.md` cites Chapters 4-5 but contains no
  explicit machine/compiler boundary. Its language checklist and evaluator
  contract are faithful but incomplete for that citation. Final repair should
  add calling convention, zero/one/many result protocol, evaluation/search
  order, compile-time assumptions, needs/modifies or equivalent effect evidence,
  runtime roots/identity, interoperation, and safety-preserving optimization.
- `abstraction-composition-and-state.md` correctly routes process questions to
  `processes-state-and-time.md` and language/runtime questions to
  `generic-operations-and-languages.md`. Its broad SICP trace should be replaced
  with exact anchors after those detailed references own the derivations.
- `recipe-cards.md`'s Procedure -> Process Reality Check is strongly supported by
  the iterative, recursive, and tail-recursive machines. Its Notation As Data
  card is supported by assembly and compilation. The card should route
  language/runtime semantics to the detailed reference rather than absorbing
  machine-specific detail.
- `problem-modeling.md` and
  `worked-models-and-specialized-techniques.md` are supported by the chapter's
  explicit execution, liveness, reachability, and cost models. They need not
  reproduce the compiler, but broad SICP provenance should be replaced by exact
  Chapter 3-5 anchors and explicit model-versus-runtime qualifications.
- `abstraction-barriers-and-closure.md` is supported by progressive lowering of
  remainder, pair operations, syntax operations, and environment operations.
  Its existing Sections 1-2 source scope is honest; Chapter 5 does not require a
  new runtime section unless the reference begins making lowering claims.
- `composition-generative-recursion-and-accumulators.md` already treats stack
  position, operation order, and time/space as semantic deltas. Chapter 5 adds
  direct calibration for continuation placement, live-register preservation,
  tail calls, and finite stack limits; exact attribution can be added without
  importing compiler mechanics into the construction recipe.
- `data-driven-design.md` receives only narrow support from syntax classification
  and compile dispatch. Its data-shape recipe remains HtDP-owned and should not
  acquire register-machine detail.
- `responsibility-and-variation.md` is compatible with the chapter's subroutine
  and calling-convention boundaries, but those are mechanism examples rather
  than its primary ownership derivation. No Chapter 5 expansion is required.
- `SOURCES.md` correctly restricts Chapters 4-5 machinery to real DSL,
  interpreter, compiler, or runtime boundaries. Its final row should link exact
  anchors and name execution order, tail calls, liveness/effect summaries,
  storage roots, and compiled/interpreted compatibility as the bounded
  calibration surface.
- No Chapter 5 evidence requires a new `reference-policy.json` route. The
  existing language/runtime and process-shape routes own the discovered repair
  obligations.

## Back Matter And Full-Book Closure

**Read:** complete `book.txt:27576-28427`, physical pages 862-883, PDF labels
`834`-`855`: References, List of Exercises, List of Figures, Index, and
Colophon.

**Canonical units:**

- [References](https://mitp-content-server.mit.edu/books/content/sectbyfn/books_pres_0/6515/sicp.zip/full-text/book/book-Z-H-36.html#%_chap_Temp_849)
- [List of Exercises](https://mitp-content-server.mit.edu/books/content/sectbyfn/books_pres_0/6515/sicp.zip/full-text/book/book-Z-H-37.html#%_chap_Temp_850)
- [Index](https://mitp-content-server.mit.edu/books/content/sectbyfn/books_pres_0/6515/sicp.zip/full-text/book/book-Z-H-38.html#%_chap_Temp_851)

The unofficial PDF additionally contains a generated List of Figures and a
colophon that are not separate units in the official HTML snapshot. The
colophon confirms the Texinfo-to-LaTeX/XeLaTeX conversion pipeline and Inkscape
diagram production, supporting the audit's separation of conversion defects
from canonical content.

**Visual evidence:** back-matter contact sheet:
`14ee5ac7dd22590673828f851005a55fde1c485143284684f3541cce767f48a2`.

The bibliography confirms that several boundaries deliberately presented as
open tradeoffs are source-backed rather than accidental omissions: stack versus
garbage-collected allocation, real-time versus stop-and-copy collection,
negation as failure, hygienic macros, continuation transformation, deadlock,
logic programming, and tail-call implementation each point to specialized
literature. Packaged references must retain the boundary and should not promote
one textbook mechanism to a universal rule.

The exercise and figure inventories account for Exercises 1.1-5.52 and Figures
1.1-5.18, matching the sequential audit. The index confirms the book's own
cross-chapter vocabulary: procedure/process, closed-world assumption,
continuations, tail recursion, instruction effects, lexical addressing,
identity, GC, and compilation are distinct entries rather than one generic
"abstraction" claim. The back matter adds provenance and completeness evidence;
it does not create new design rules.

## Integrated Repair Queue

The complete reading turns the provisional checks into the following bounded
repairs:

1. **S1 — Pin the complete source.** Add the provided PDF identity, official
   HTML boundary, complete audit record, and conversion-defect exclusion to
   `SOURCES.md`.
2. **S2 — Make procedure/process evidence operational.** Add continuation,
   retained-state, tail-position, stack-bound, instrumentation, and reachable-
   storage checks to `processes-state-and-time.md`, with exact Sections 1.2,
   3.1, 3.4, 3.5, 5.1, 5.2.4, 5.3, and 5.4.2 anchors.
3. **S3 — Complete the language/runtime contract.** Generalize evaluator
   outcomes beyond one result; add search order, multiplicity, branch failure,
   rollback, calling conventions, compile-time assumptions, effect summaries,
   runtime roots/identity, interoperation, and safety-preserving optimization to
   `generic-operations-and-languages.md`.
4. **S4 — Calibrate relational models.** Make negation-as-failure, bound-before-
   filter order, proof versus answer identity, duplicate policy, fairness,
   failure versus divergence, and termination explicit in the model and worked
   logic references.
5. **S5 — Replace broad provenance.** Give every SICP-derived detailed reference
   exact MIT Press section anchors matching the capability it owns. Do not imply
   Chapter 5 ownership where a reference only uses Chapters 1-2.
6. **S6 — Preserve source/adaptation boundaries.** Label production validation,
   versioning, migration, compatibility, resource budgets, and repository
   recovery as Developer adaptations where SICP supplies only semantic
   calibration.
7. **S7 — Keep detail route-local.** Runtime and compiler machinery stays in the
   existing language/runtime route; process retention stays in the process
   route. `reference-policy.json` does not change.
8. **S8 — Verify claim-relative fidelity.** Validate all exact anchors, package
   structure, tests, TypeScript/LSP diagnostics, Markdown diagnostics, hashes,
   and diff cleanliness before assigning the verdict.

No repair imports Scheme syntax, register-machine code, or the original book.
The package retains source-independent decision artifacts and bounded examples.

## Repair Application

All eight repair items were applied without changing `reference-policy.json`:

- S1 pins the complete source and audit boundary in `SOURCES.md`.
- S2 adds continuation, tail-position, liveness, stack, reachability, and
  process-shaped verification to `processes-state-and-time.md`.
- S3 adds result/search plurality, fairness, rollback, calling conventions,
  effect summaries, compile-time guards, runtime roots, and interoperation to
  `generic-operations-and-languages.md`.
- S4 adds closed-world negation, binding order, proof/answer identity,
  duplicate policy, fairness, and failure-versus-divergence boundaries to the
  model and worked-model references.
- S5 replaces broad SICP provenance in all ten detailed references with exact
  MIT Press section anchors.
- S6 marks product validation, migrations, compatibility, resource budgets,
  repository recovery, and related workflow as Developer adaptations where
  appropriate.
- S7 leaves execution detail in the existing process and language/runtime
  routes; no routing expansion was justified.
- S8 verifies anchors, hashes, package structure, tests, diagnostics, and diff
  cleanliness.

### Post-Repair Package Target Hashes

| Path | SHA-256 |
| --- | --- |
| `SOURCES.md` | `72797e2f638028d8bac8e088d856bc3c23195b478738efa6ba9dc8de3c93e101` |
| `skills/model/references/problem-modeling.md` | `666b3aa504bb4c3c490e12ceb092996329e558bac11352706cdd543e6cecc9c2` |
| `skills/model/references/worked-models-and-specialized-techniques.md` | `f298c0f1db142829744464195f800740393d37ac9a98103e32a55e018517463b` |
| `skills/sketch/references/abstraction-barriers-and-closure.md` | `58766262759244417951fed4e302929a5398fb130fcdf23654a040350a096dc9` |
| `skills/sketch/references/abstraction-composition-and-state.md` | `a57dd36af318b0e9ecea82a048a11a253eae3833bd767df56539c056d0d26127` |
| `skills/sketch/references/composition-generative-recursion-and-accumulators.md` | `f1478f5887084c82e329c44a9032cf5518eaf0f2820e742258ad102053abc8f7` |
| `skills/sketch/references/data-driven-design.md` | `2dd13f2b73d60f21683f8aac31500df6fb2fce9e3425a6364cda0815f4da4475` |
| `skills/sketch/references/generic-operations-and-languages.md` | `ccbcfd44d22d1285c9053a2fa3aad4c49b3c1fd928686a5cc96c4431c0f0cc09` |
| `skills/sketch/references/processes-state-and-time.md` | `8ad4cfbb9df24b23aa7bec7e90f17c1ffb45ae2b7b939fde628903679c159703` |
| `skills/sketch/references/responsibility-and-variation.md` | `1422d5d133f8377e32fe5d4e36afc78c5739c6751fc49465b23671275e92cf66` |
| `skills/abstraction-review/references/recipe-cards.md` | `9be44e2c1cfa89ae7db45e3fff1d4c6306ebccc24dde381981d87ec71430db16` |

### Verification Evidence

- Local official-HTML validation checked 58 packaged MIT Press links, 27 unique
  unit/anchor pairs: zero missing units or anchors.
- `npm run check` from `agent/packages/developer`: package structure consistent;
  tests **139/139** passed.
- TypeScript primary LSP scan of `extensions/`: no diagnostics.
- Full lens scan of the twelve SICP-touched package/audit files: no findings.
  Marksman's isolated `SOURCES.md` check timed out, so this is not represented as
  an LSP-clean claim; package checks, lens Markdown analysis, and diff checks are
  the evidence for that file.
- `git diff --check` on all twelve touched files: clean.
- Post-repair SHA-256 values above were recomputed after lint repair.
- An initial `npm run check` from `/Users/boostree/coding` failed with the
  expected missing-root-`package.json` `ENOENT`; rerunning from the actual
  package root produced the green result above.

## Fidelity Verdict

**Faithful after repair.** The package now preserves the book's durable
capabilities and material boundaries:

- procedure text is separated from generated process and resource behavior;
- data abstraction carries operations and laws, with observer-relative
  replacement and representation-dependent identity made explicit;
- state, aliasing, mutation graphs, concurrency histories, event order, streams,
  demand, and memoization retain their separate obligations;
- generic dispatch and coercion preserve extension-axis and meaning-loss
  tradeoffs;
- languages own evaluation/search order, result multiplicity, effects, failure,
  negation, termination, and runtime behavior;
- explicit control, tail calls, liveness/effect summaries, roots, compilation
  assumptions, safety checks, and mixed execution are present only on the routes
  that need them.

The verdict does not claim that SICP itself specifies repository recovery,
production migrations, compatibility rollout, resource budgets, or modern
runtime protocols. Those remain visibly labeled Developer adaptations. Known
Texinfo extraction/layout defects and the Figure 3.6 rendering defect are
excluded from derivation evidence. No source-derived routing defect was found.
