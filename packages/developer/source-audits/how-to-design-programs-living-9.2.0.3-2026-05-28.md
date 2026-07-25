# Source Audit: How to Design Programs, Living Edition 9.2.0.3

<!-- markdownlint-disable MD013 MD024 -->

The audit uses repeated source-unit headings and evidence tables whose anchors
and hashes are intentionally kept on one row.

## Status

**Complete — faithful after repair.** All canonical units were read in order,
code and visual evidence were inspected, the consolidated H1-H8 repair queue was
applied, exact living-build anchors were validated against the local source
snapshot, and package verification passed. Canonical defects remain documented
and excluded from derivation evidence.

> Integration note: this audit's post-repair hashes attest its fidelity snapshot.
> Current runtime references were later split and reorganized around generalized
> judgment steps in
> [`cross-source-judgment-integration-2026-07-24.md`](cross-source-judgment-integration-2026-07-24.md).

## Source Identity

- Title: *How to Design Programs*, Second Edition, official living edition
- Authors: Matthias Felleisen, Robert Bruce Findler, Matthew Flatt, and Shriram
  Krishnamurthi
- Build: 9.2.0.3
- Released: Thursday, May 28, 2026 at 10:37:57
- Root URL:
  <https://htdp.org/2026-5-28/Book/index.html>
- Retrieved: 2026-07-24T08:37:02Z
- Source type: versioned HTML book with code, figures, notes, exercises, and
  stable section anchors

The online release is the primary source. Printed page numbers are not used for
traceability because they do not identify positions in this build. Citations in
this audit use source-unit names, section titles, and exact HTML anchors.

## Acquisition And Inspection Method

All top-level HTML units were downloaded to
`/tmp/htdp-audit-2026-05-28/html` for local search and hashing. This local copy
is audit evidence only and is not part of the package. Readable extraction is
checked against the raw HTML whenever code structure, a figure, an instructor
aside, a note, or link context affects the argument. Referenced visual assets
are downloaded and inspected individually.

Search and the table of contents are navigation aids, not fidelity evidence.
Each source unit is read in the authors' recommended order before its packaged
claims are closed.

## Source Snapshot

| Unit | SHA-256 |
| --- | --- |
| `index.html` | `ff2f893c7d7a38e78baf53e160f4db45da99305a648e1bfba6753fab889b1878` |
| `part_preface.html` | `4ca5f9178cd1755981a6b2e74533d0fd475807e352b6a5cb1c7f580425d85b80` |
| `part_prologue.html` | `971f1b6c8680321ece66449f229a4997f7fb891c2a920c70fd821804369fcf7f` |
| `part_one.html` | `006208e5baf705de6089521de42e3fdc7c90884f72f2740114e18b834eeffc09` |
| `i1-2.html` | `5835bde84d43c494dd34d291d00e0bd3c07807a698b2175a72fc543679d44ddc` |
| `part_two.html` | `847c695a7926b97465a58598a00791b148b4a020adeb3dc36bd0b91f3f1cf2e8` |
| `i2-3.html` | `7098fad23308dfc298880c7b1ae8f19335097cfb9818415b051a0a3d749fa081` |
| `part_three.html` | `4c6e324a4f9054fb85a6f9c96c90d45f404b99ff080770631f362f7ef0b78f69` |
| `i3-4.html` | `7a73e644f142fc6b7fe7b924cd5a957d2fb17adccedf76c444f8645d7f564964` |
| `part_four.html` | `89440f812822b72183bd310815c4f0b4348d95d5cbc4614c0a4b6b889d97a09a` |
| `i4-5.html` | `872dc0f8257363fca7f71b6018c2e1ed02f49a78bb871e9d116c9f386ce61d7d` |
| `part_five.html` | `c7a63f1c2145f0e3ca70046943516cf95042da8eb4621fc702d679a7a1e2efea` |
| `i5-6.html` | `4c601d7b31f1797fc19fcad6360e7fa418d8a732e6ffdf1bf4655777fd8f0a3f` |
| `part_six.html` | `57edf8c711c835345092420ee48679e12cba33a4fc2b92c60503d02e2110a257` |
| `part_epilogue.html` | `24552d69649887e8fc36cb5ad6887d96a825ff5537074681b0694e57df937548` |

## Packaged Reference Snapshot Before Audit

| Path | SHA-256 |
| --- | --- |
| `SOURCES.md` | `e77589a0642b4564b1379d5d3ec1bc49c68bd90639288daffd1d7b6c8e1f011d` |
| `skills/sketch/references/data-driven-design.md` | `ba57743dddec30e67c65d0801704827ded54c7ee0e5bf9e2d7d0f9853b1335c1` |
| `skills/sketch/references/data-shape-template-catalog.md` | `23d29a88dc6986c6566a5d6f6a10247c1996e9de35e91ae6653c2d1025bafb42` |
| `skills/sketch/references/composition-generative-recursion-and-accumulators.md` | `c13da431b39cdd4f1812e3c14983c8beaf1fbd10af64fa41c10557763d21016b` |
| `skills/model/references/problem-modeling.md` | `2a15141da3aefcb67edf9a372659a003449c559ec25532e9357365639fae2add` |
| `skills/verify/references/verifier-selection-and-pass-but-wrong.md` | `75112b1e4843e5fcab548eae62735968277a00d0929b7bab217f177bf9239141` |
| `skills/signal/references/structural-movement.md` | `011f8fafb48fdb11a1b50d891261076c5345257cfcd917aa69388c67f2687410` |
| `skills/abstraction-review/references/recipe-cards.md` | `4205c619aaae2cd3b883186ed95369e321c02a850f25148d84426150cb066ac3` |
| `extensions/references/behavior-preserving-structural-change.md` | `b343e0b6f6a2ac248a4fd528568aa60b69c952f1702606e36d536b25f2b08cd6` |

## Packaged Reference Snapshot After Repair

| Path | SHA-256 |
| --- | --- |
| `SOURCES.md` | `029f7a68e6cad5f80d27d993e93292a02ff8e4bb8278ab1e1fe5fd259386c46b` |
| `skills/sketch/references/data-driven-design.md` | `3d0d3080dc18f4b7a0eb571638e6c85fbd708b57f230321321efb7c606562573` |
| `skills/sketch/references/data-shape-template-catalog.md` | `a2399fadce66385805d69d4eb65aa284add0c795724008d5589e20feaaee77a1` |
| `skills/sketch/references/composition-generative-recursion-and-accumulators.md` | `94a146584ed932df3895665988e5ef07c4084626b337e0a5b5a3641e8408d83e` |
| `skills/model/references/problem-modeling.md` | `7df21a88ffefab4af666b4013f9bcb392f66db14cb30ba5e1694f19ef5121235` |
| `skills/verify/references/verifier-selection-and-pass-but-wrong.md` | `f821c0e4d1f87abedb1fb78621abf7ab68f53369b2944a254cbb82f0bccebc54` |
| `skills/signal/references/structural-movement.md` | `53c34b17abd01d923ebc3cb200e4b829439cb1580897fc6e7154b2ec2a9f8f09` |
| `skills/abstraction-review/references/recipe-cards.md` | `1f8cb7b5fc3c5739bc62befc598cbe6c8457dcb96c778f9a7d7fd4c15e2c5357` |
| `extensions/references/behavior-preserving-structural-change.md` | `45a6e1cae6b19c1864abc09b1127c5ae2762e00b92acd0c24e520afa7bca2bf0` |

## Reading Progress

| Source unit | Status |
| --- | --- |
| Preface | complete |
| Prologue: How to Program | complete |
| Part I: Fixed-Size Data | complete |
| Intermezzo 1: Beginning Student Language | complete |
| Part II: Arbitrarily Large Data | complete |
| Intermezzo 2: Quote, Unquote | complete |
| Part III: Abstraction | complete |
| Intermezzo 3: Scope and Abstraction | complete |
| Part IV: Intertwined Data | complete |
| Intermezzo 4: The Nature of Numbers | complete |
| Part V: Generative Recursion | complete |
| Intermezzo 5: The Cost of Computation | complete |
| Part VI: Accumulators | complete |
| Epilogue: Moving On | complete |
| Cross-reference repair and verification | complete |

## Preface

**Read:** complete Preface, including `Systematic Program Design`, `DrRacket
and the Teaching Languages`, `Skills that Transfer`, `This Book and Its Parts`,
`The Differences`, and both acknowledgment sections.

**Primary URL:**
<https://htdp.org/2026-5-28/Book/part_preface.html>

**Visual inspection:** Figure 1's six-step recipe and Figure 2's 534 by 534
part-dependency graph. The Figure 2 asset has SHA-256
`96d9ae2d673af52a4dbe895f1126a8a9645615f345adf2f587a21208ea2b1fd7`.
The graph confirms that the recommended linear path is not the only legal path:
solid edges mark prerequisites and dotted edges mark recommendations.

### Argument Reconstructed

The Preface opposes systematic design to programming by trial and error. A
program that happens to run is not yet a well-designed program because it does
not necessarily articulate why its behavior should satisfy the desired
functionality. The teaching goal is therefore not command fluency in a current
language. It is a transferable practice of analysis, planning, construction,
checking, and revision.

Systematic design combines two mechanisms. A design recipe creates inspectable
intermediate products, while iterative refinement makes complex problems
tractable by first solving an idealized core and then restoring omitted details
one at a time. These are related but not interchangeable. The recipe structures
one design problem; refinement changes the problem model and reuses prior
solutions as the model becomes more realistic.

The basic function recipe has six ordered outcomes:

1. analyze information, define its data representation, and construct data
   examples;
2. state a signature, purpose, and header or stub;
3. work functional examples;
4. translate the data definition into a function template;
5. complete the definition using the purpose and examples;
6. turn examples into tests and check the result.

The order is productive because each intermediate artifact exposes a different
kind of mistake. Data examples test whether information can be represented and
interpreted. Functional examples clarify expected computation. The template
turns data organization into an implementation outline. Tests catch some
mismatches and explain the definition to later readers. Running against
real-world data may still reveal discrepancies, so example tests are evidence,
not exhaustive proof.

The recipe applies at both function and program levels, but the levels have
different shapes. Whole-program design starts top-down from library interfaces
and a wish list, while construction proceeds bottom-up by applying the function
recipe to each wished component. Event-driven and batch programs have distinct
program-level recipes. The Preface therefore does not support treating every
software problem as one isolated function template.

The teaching languages deliberately constrain mechanism so beginners can see
the whole language and receive comprehensible errors. BSL and the later student
languages are instructional scaffolds, not the subject of the book and not a
claim that production systems should use Racket. DrRacket also separates data
manipulation from real-world input and output, allowing model/view/controller
separation to emerge before infrastructure complexity obscures it.

The transfer claim is broader than code generation. The recipe practices
analytical reading, exact writing, examples, planning, evaluation, and revision.
Transfer to other languages and scales requires reflection; merely reproducing
BSL syntax or pedagogical comments would not transfer the skill.

The book is a cumulative curriculum with qualified alternative paths. The
Preface recommends that independent readers work through the entire book and
its exercises in order. Figure 2 nevertheless distinguishes mandatory from
suggested dependencies and gives legal abbreviated paths. Parts teach program
design; intermezzos teach syntax, semantics, scope, number behavior, and cost
models needed to reason about execution.

### Boundaries That Must Survive Derivation

- A data definition represents information and includes an interpretation. It is
  not merely a host-language type declaration.
- Data examples and functional examples serve different diagnostic purposes.
- A template is an intermediate outline derived for a particular recipe. It is
  not the completed behavior and does not replace purpose or examples.
- Tests establish agreement for selected cases and improve readability; they do
  not prove all behavior or eliminate feedback from real data and users.
- The function recipe and the whole-program recipe are different. Whole-program
  planning produces a wish list before bottom-up function construction.
- Iterative refinement starts from an intentionally simplified model, restores
  details incrementally, and reuses the prior solution. It is not arbitrary
  cleanup of an unchanged problem.
- Teaching-language restrictions are scaffolding for transfer, not universal
  production-language rules.
- Structural design is the baseline, but later parts add composition,
  abstraction, generative recursion, and accumulators where structural templates
  alone are insufficient.
- The authors recommend full linear study, while their dependency graph permits
  narrower paths. A source audit may read linearly without pretending every
  adjacent source unit is a strict prerequisite.

### Developer Comparison

| Packaged claim or use | Source location | Preliminary decision |
| --- | --- | --- |
| A data definition plus interpretation should precede implementation shape. | `Systematic Program Design`, Figure 1 step 1 | directly supported |
| Data examples and behavior examples are separate artifacts. | `Systematic Program Design`, Figure 1 steps 1 and 3 | directly supported |
| Signature, purpose, and executable stub precede the template and body. | `Systematic Program Design`, Figure 1 steps 2, 4, and 5 | directly supported |
| The template is translated from the accepted data definition. | `Systematic Program Design`, Figure 1 step 4 | directly supported for the basic structural recipe; later recipes must supply their own derivation source |
| Intermediate artifacts provide a diagnostic surface when design is stuck. | `Systematic Program Design`, paragraphs following Figure 1 | directly supported |
| The six-artifact order is diagnostic rather than production ceremony. | `Systematic Program Design`; `Skills that Transfer` | faithful Developer adaptation; the source prescribes ordered beginner artifacts, while Developer recovers equivalent evidence from an existing repository |
| Tests are successive constraints rather than exhaustive proof. | `Systematic Program Design`, Figure 1 step 6 and following discussion | directly supported |
| Whole-program design uses top-down planning, a wish list, and bottom-up function construction. | `The Differences`, items 1-3 | directly supported |
| Design by composition may require inventing useful intermediate data. | `The Differences`, item 4 | directly supported as an insight-bearing move, not a purely mechanical consequence of the input type |
| Iterative refinement propagates a changed model through dependent artifacts. | `Systematic Program Design`; `This Book and Its Parts` | core refinement principle supported; exact artifact propagation requires confirmation in Part IV |
| HtDP supports reference routes for `sketch`, `model`, `verify`, `signal`, and `abstraction-review`. | entire Preface and part map | provisionally supported; detailed ownership remains subject to the relevant parts |
| HtDP defines Developer's route lifecycle and reference-loading protocol. | no source location | not a source claim; these are package-owned operational syntheses |

### Provisional Repair Notes

- Replace remaining 2018-only HtDP citations with the audited living build and
  exact section anchors after all relevant parts are mapped.
- Preserve the distinction between function-level recipes and whole-program
  top-down planning when auditing `data-driven-design.md` and recipe cards.
- Keep tests claim-relative: the source explicitly allows real inputs and later
  feedback to reveal mismatches that the examples did not cover.
- Do not attribute Developer's existing-code recovery, compatibility surfaces,
  or route orchestration directly to HtDP unless later chapters provide the
  narrower underlying rule.
- Treat composition's intermediate-data insight as a creative design step rather
  than claiming every auxiliary follows mechanically from the original data
  definition.

## Prologue: How to Program

**Read:** complete Prologue, from the initial DrRacket calculation through
`Arithmetic and Arithmetic`, `Inputs and Output`, `Many Ways to Compute`, `One
Program, Many Definitions`, `One More Definition`, `You Are a Programmer Now`,
and `Not!`.

**Primary URL:**
<https://htdp.org/2026-5-28/Book/part_prologue.html>

**Visual and code inspection:** all 29 referenced PNG assets, the DrRacket
definitions/interactions split, the image-composition order examples, coordinate
grid, image sequence, piecewise sign function, rocket positions, and the time to
distance equations. Figures 4-9 were reconstructed from raw HTML to preserve the
six code versions whose formatting is partly lost in prose extraction. The
asset-manifest SHA-256 is
`301c0d711a901dbadcc31510c71523e165f0327d443bf9bca21c3ee8889ed356`.

### Argument Reconstructed

The Prologue deliberately teaches enough language mechanics to produce an
impressive animation and then denies that this achievement constitutes program
design. Its pedagogical movement is the argument: expression evaluation,
multiple data kinds, functions, conditionals, libraries, event-driven execution,
constants, and several working revisions create confidence, but the final
`Not!` section exposes the gap between knowing mechanisms and systematically
solving and communicating a problem.

The opening frames programming as writing expressions and computing as
predicting their values. Nested syntax is valuable because evaluation order is
visible and unambiguous. The reader is repeatedly asked to predict results
before using DrRacket. Running an expression is therefore not a substitute for
an execution model, even in this informal introduction.

Numbers, strings, Booleans, and images are all presented as data with different
operations. The image examples make two boundaries visible. Operations that
look like addition need not have the same algebraic properties: reversing the
arguments to `overlay` changes the result. Representations also carry coordinate
conventions: the scene origin is at the upper left and the vertical axis grows
downward. Generic words such as arithmetic do not erase operation-specific
semantics.

Functions turn a finite input/output table into a rule for arbitrarily many
inputs. `animate` then treats a rendering function as a role: on each clock tick
it supplies the current tick count and displays the resulting image. The text
distinguishes applying a function to selected inputs as a test from letting a
library apply it repeatedly as running the program. The function-library
boundary determines how the simple program participates in event-driven
execution.

The rocket is revised through six versions. The first renders a rocket at a
supplied height. The second adds a conditional stop but incorrectly places the
rocket's center on the bottom edge. The third uses the image height to stop when
the rocket's bottom meets the ground. The fourth names dimensions and the rocket
asset so likely changes become localized. The fifth names repeated derived
expressions and separates graphical constants from functions. The sixth notices
that `animate` supplies elapsed ticks, not height, renames the parameter from
height to time, and introduces a `distance` function. The apparently working
program had used time as distance by accident; a more truthful name reveals the
missing domain relation.

This sequence contains useful design signals, but the source explicitly labels
it plain programming rather than the systematic method taught later. The
revisions arise from observation, experimentation, repeated expressions, and
new domain facts. They motivate the need for a method; they do not yet establish
that trial-and-error evolution is the design recipe.

The closing argument defines good programming as communication with future
readers. A program should reflect the problem statement and its important
concepts, include a concise account of its purpose, and use examples that connect
that account to behavior. Language vocabulary and API knowledge are necessary
mechanics, comparable to words and grammar, but they do not determine how to
organize a solution.

### Boundaries That Must Survive Derivation

- Passing selected examples is testing in the Prologue's informal sense, not a
  proof that the rule works for every input.
- Running and testing are different activities: a framework may invoke a role on
  many inputs without explaining the intended behavior.
- A program can animate successfully while confusing time with distance.
  Observable success does not rescue a false domain interpretation.
- Names can expose semantic mistakes. Renaming `height` to `time` is not cosmetic
  because it makes an invalid relation visible.
- Factoring repeated constants localizes likely changes and explains derived
  values, but the text does not license extracting every literal or predicting
  arbitrary future variation.
- The order of arguments and coordinate conventions are semantic. A shared
  syntactic shape does not make image composition equivalent to numeric
  addition.
- Libraries impose callback roles and execution behavior. A small function must
  still be understood in the contract of the library that invokes it.
- The six rocket versions motivate systematic design but are not themselves the
  later six-step function recipe.
- Domain knowledge may require consultation and explicit modeling. The missing
  time-to-distance relation cannot be derived from BSL syntax.
- Comments and organization serve future readers, but readable code must also
  reflect the problem's concepts and examples.

### Developer Comparison

| Packaged claim or use | Source location | Preliminary decision |
| --- | --- | --- |
| Product meaning should be stated separately from host-language representation. | `One More Definition`; `Not!` | directly supported by the time/height accidental-success example and the demand that code reflect problem concepts |
| Names should describe domain meaning rather than a convenient current value. | `One More Definition` | directly supported; HtDP is not currently a named source for `domain-naming.md` |
| Examples should connect purpose to expected behavior for future readers. | `Inputs and Output`; `Not!` | directly supported |
| A green or visibly working result can still encode the wrong model. | `One More Definition`; `Not!` | directly supported and relevant to pass-but-wrong verification |
| Framework or library interfaces constrain program roles. | `Inputs and Output`, discussion of `animate` | directly supported; detailed world-program recipes remain for Part I |
| Repeated expressions and change friction are design signals. | `One Program, Many Definitions` | directly supported in the concrete constant-extraction case, not as a universal abstraction mandate |
| The Prologue's successive edits are the HtDP function design recipe. | entire rocket sequence; `Not!` | contradicted by the source's own framing; they motivate rather than instantiate systematic design |
| Existing-repository artifacts may substitute for pedagogical recipe comments. | no direct Prologue location | Developer adaptation; compatible with the transfer goal but not yet directly sourced |

### Provisional Repair Notes

- Consider whether HtDP should appear as supporting provenance for semantic
  naming or whether the stronger existing naming sources already own that
  capability without duplication.
- Preserve the `test` versus `run` distinction when mapping examples to
  verification evidence.
- Do not cite the rocket revisions as direct proof of the full design recipe.
  Their source role is to demonstrate that successful tinkering and mechanism
  knowledge remain insufficient.
- Use the time/height example as a pass-but-wrong calibration case: outputs can
  look plausible while the input interpretation is false.

## Part I: Fixed-Size Data

**Primary URL:** <https://htdp.org/2026-5-28/Book/part_one.html>

Part I begins the formal curriculum by extracting program structure from the
kinds of data a program consumes and produces. Chapter-level decisions remain
provisional until Part I's summary has restated the complete fixed-size recipe.

### Chapter 1: Arithmetic

**Read:** complete Chapter 1, sections 1.1-1.7.

**Source anchor:**
`part_one.html#%28part._ch~3abasic-arithmetic%29`

**Visual inspection:** the distance equation, primitive image values, Figure 10's
image-construction laws, scene placement, and the cat used for image-property
exercises. The Chapter 1 asset-manifest SHA-256 is
`f78e137997995142798f7155fc5a2fa14575ef20b3307aa47cffb651bba50749`.

#### Argument Reconstructed

The chapter installs a predictable execution model before introducing formal
design. Primitive applications evaluate their argument expressions and then
apply an operation to the resulting data. Calculation steps are not merely
pedagogical notation: a programmer must be able to predict evaluation because
unexamined runtime behavior can harm users.

Programming languages provide data and operations over data. BSL begins with
atomic numbers, strings, images, and Booleans. Atomic means the designer does
not decompose these values structurally; available operations create values,
combine them, or extract relevant properties. This is the first boundary on the
later template rule: an atomic input does not imply selectors or recursion.

The string discussion distinguishes information from its encoding. Real-world
colors, names, and conversations could be encoded numerically, but such an
encoding would obscure meaning and burden every reader with a code table. A
language representation should fit the information being represented, not just
prove that some encoding is technically possible.

Mixed expressions work only when producer and consumer data kinds align. A
string operation may produce a number that a numeric operation consumes, while
passing a number where a string is required produces a localized error. This is
an elementary composition contract: nesting is valid because the intermediate
result has the kind expected by the outer operation.

Image operations make representation-specific contracts visible. Images have
width, height, rectangular extent, and implicit anchor points. Argument order
and coordinates affect composition; placement may crop an image. Calling these
operations an arithmetic does not grant them all numeric laws.

Booleans represent decisions and statuses. Conditional evaluation first obtains
a Boolean and then evaluates only the selected result expression. This selective
rule matters for safety, as shown by guarding division by zero. Predicates make
data-class membership explicit and can protect an operation when an input may
belong to several classes.

The chapter repeatedly combines prediction, experimentation, documentation, and
intentional error. These activities establish operation contracts and runtime
semantics. They do not yet constitute the design recipe introduced in Chapter 3.

#### Boundaries That Must Survive Derivation

- Information and data are related by an interpretation; any technically
  possible encoding is not automatically a good representation.
- Atomic data has operations and properties but no structurally derived
  decomposition template.
- Nested operations compose only when intermediate output and expected input
  kinds align.
- An operation's algebraic behavior must be established rather than inferred
  from a loose analogy such as arithmetic.
- Conditional expressions evaluate one selected result, not all possible
  results. A template that ignores this semantic distinction can invent errors.
- Predicates classify values at runtime; they do not by themselves explain the
  domain meaning of each class.
- Exact and inexact numbers have different guarantees. `Number` is a broad data
  class that may need refinement when precision matters.
- Experiments and examples support understanding, but the source also requires
  the reader to predict execution and consult operation contracts.

#### Developer Comparison

| Packaged claim or use | Source location | Preliminary decision |
| --- | --- | --- |
| A data definition needs an interpretation in product or domain terms. | §1.2, `The Arithmetic of Strings` | directly supported by the distinction between information and possible numeric encodings |
| Atomic templates use the value and relevant domain constants rather than invented decomposition. | chapter introduction; §§1.1-1.5 | provisionally supported; the formal template appears in Chapter 3 |
| Composition requires an explicit intermediate contract. | §1.3, `Mixing It Up` | supported at the primitive-operation level; design-by-composition remains for later chapters |
| Predicate branches may protect operations from invalid input kinds. | §1.7, `Predicates: Know Thy Data` | directly supported as runtime mechanics, not yet a complete domain itemization recipe |
| Every available numeric interval deserves a branch. | §§1.6-1.7 | not supported; conditionals serve meaningful distinctions and safety conditions |
| Examples alone are sufficient evidence of an operation's semantics. | §§1.1-1.7 | not supported; prediction, errors, and documentation are also used |

#### Provisional Repair Notes

- Ensure `data-shape-template-catalog.md` keeps atomic data free of invented
  selectors and structural recursion.
- Keep host-language runtime predicates separate from domain interpretations;
  the latter cannot be recovered from `number?` or `string?` alone.
- Do not attribute the later six-step recipe to Chapter 1's exploratory
  exercises.

### Chapter 2: Functions and Programs

**Read:** complete Chapter 2, sections 2.1-2.5.

**Source anchor:** `part_one.html#%28part._ch~3afuncs-progs%29`

**Visual and code inspection:** the substitution stepper, attendance and
temperature formulas, Figures 12 and 14's complete batch and interactive
programs, Figure 13's state/event transition table, and the rendered world-state
sequence. The Chapter 2 asset-manifest SHA-256 is
`e3092f15d378fd411ad200218b551366deccf511ebd6faa859ec31a3542db569`.

#### Argument Reconstructed

The chapter moves from primitive expressions to reusable definitions and then
to complete program shapes. Function parameters represent unknown input data;
they are not data themselves. A definition introduces an operation, and an
application supplies argument values. The substitution model explains how an
application evaluates and provides a concrete debugging model rather than
asking readers to trust output alone.

Function composition is introduced as the normal shape of a program. A main
function turns results from auxiliary functions into the final result. The
source's slogan, “one function per task,” is grounded in tasks named by the
problem statement: letter opening, body, closing, attendance, revenue, cost, and
profit. Smallness is a benefit, not the criterion that creates an auxiliary.
Each function owns a distinguishable computation and their input/output meanings
permit composition.

The movie-theater example derives a collaboration graph from stated
dependencies. Ticket price determines attendance; price and attendance determine
revenue; attendance determines variable cost; revenue and cost determine profit.
The composed definitions mirror this explanation, while one nested monolith
produces the same selected answers but obscures the problem structure and makes
a changed cost rule harder to locate.

Global constants name problem facts and derived values. The chapter recommends
one definition for each constant mentioned in the problem statement, both to
explain where a value comes from and to localize legitimate change. This does not
say that every literal in every program deserves global scope; the source ties
the rule to problem constants.

The program-level distinction is then made explicit. A batch program receives
its input as a whole and composes functions into an output. An interactive
program receives events over time. Its main function declares handler roles to
the runtime, while a single current world state carries the information needed
between events.

`big-bang` is a collaboration contract. Tick, key, and mouse handlers consume
the current state and event information and produce a next state. A renderer
translates state into an image; a stopping predicate decides termination. Events
are ordered, and each transition's output becomes the next transition's input.
Figure 13 expresses this as a state/event table and makes event sequences
predictable as compositions of handler applications.

Chapter 2 teaches program mechanics and collaborations, not yet the systematic
procedure for designing these functions. Its closing sense of overload is
intentional: knowing definitions, composition, constants, events, and runtime
contracts still does not answer how to proceed from an unfamiliar problem
statement. Chapter 3 supplies that method.

#### Boundaries That Must Survive Derivation

- “One function per task” means one independently explainable problem task, not
  one helper per code fragment or an arbitrary line-count threshold.
- A main function composes collaborators; the existence of helpers does not by
  itself prove that responsibilities are well chosen.
- Substitution explains functional evaluation in BSL. It is not a universal
  claim that production runtimes literally execute by textual replacement.
- A constant definition should preserve a problem fact or useful derived value.
  Extracting every literal globally can weaken locality and meaning.
- Batch and interactive programs have different input and execution shapes.
- World state is the value carried between ordered events. Handlers return new
  state; `big-bang` safeguards and passes state rather than mutating it in place.
- Rendering and transition are distinct roles. The renderer is the declared
  means by which state becomes visible.
- Framework clauses specify callback contracts. Handler arity, input meaning,
  and output meaning come from the library boundary.
- The world mechanics do not yet determine which data representation should be
  chosen for a real application; that design step follows in Chapter 3.

#### Developer Comparison

| Packaged claim or use | Source location | Preliminary decision |
| --- | --- | --- |
| Wished auxiliaries need distinct purposes and contracts. | §2.3, `Composing Functions` | directly supported by one-function-per-task and dependency examples |
| A helper is earned merely because the parent function is long. | §2.3 | not supported; source tasks and dependencies justify decomposition |
| A top-level sketch may compose wished functions before all bodies exist. | §§2.3 and 2.5 | conceptually supported; the formal wish-list method remains for Chapter 3 |
| Interactive design starts from explicit world state and handler roles. | §2.5, `Interactive Programs` | directly supported as runtime structure; design procedure remains for §3.6 |
| Event order can be represented as state transition examples. | §2.5, Figure 13 | directly supported |
| A stale asynchronous response must carry an identity field. | no Chapter 2 location | Developer product-code extension, not an HtDP claim |
| Data flow through composed functions should mirror problem dependencies. | §2.3, movie-theater example | directly supported |
| Constants should carry stable problem meaning. | §2.4 | directly supported; universal extraction of all literals is not supported |

#### Provisional Repair Notes

- Preserve “one function per problem task” as the source criterion behind
  Developer's independent-purpose rule for wished helpers.
- Attribute stale-event identities, asynchronous effects, and compatibility
  concerns in the interactive template to Developer synthesis or other sources,
  not HtDP.
- Keep the runtime mechanics of world programs separate from Chapter 3's design
  recipe for choosing state and handlers.

### Chapter 3: How to Design Programs

**Read:** complete Chapter 3, sections 3.1-3.7.

**Source anchor:** `part_one.html#%28part._ch~3ahtdp%29`

**Visual and code inspection:** Figure 15's bidirectional
information/data boundary, the completed step-5 example, executable tests,
Figure 18's world-program wish list, the moving-car states, and Figure 19's
paired expected-image and image-construction tables. The Chapter 3
asset-manifest SHA-256 is
`d7e1a69f8f01eac49413e1d8b197d0da42b2f62cb230b256f92b3ef0cc24e94f`.

#### Argument Reconstructed

Chapter 3 supplies the method whose absence the first two chapters made
painful. Programming requires language mechanics, but program design asks how to
move from a problem statement to a readable, checkable product whose relation to
the problem remains visible when people, requirements, and maintainers change.
The recipe organizes progress around problem data and leaves diagnostic
intermediate products.

Figure 15 gives the central representation model. Domain information is
represented as program data, and output data is interpreted back as domain
information. A data definition records the relevant class of data, how members
can be constructed or recognized, and what those members mean in the domain.
The same `Number` value can mean position, velocity, temperature, dimensions, or
count. Host type equality therefore does not imply domain equivalence.

The source also warns against multiplying aliases. A domain name in a signature
can communicate intent, but too many names for unchanged host classes create
confusion. A new named data definition must improve the information/data
mapping, not merely make the design look domain-oriented.

The function recipe makes six outcomes explicit:

1. state representations, interpretations, and relevant data definitions;
2. write the signature, purpose, and executable header or stub;
3. construct functional examples from the accepted input and output classes;
4. inventory available data in a template;
5. complete the function using the purpose, examples, domain knowledge, and
   available operations;
6. convert examples to tests and compare actual with expected outcomes.

The purpose statement answers what the function computes and should be
understandable without reading the body. Parameter names may clarify both data
kind and purpose. Functional examples instantiate the signature and force a
specific expected result before implementation. For atomic inputs, the initial
template is only an inventory of parameters. Relevant global constants may also
belong in the inventory; later data definitions make template structure richer.

Completion is the creative step. A template says which ingredients are
available, not how to combine them. The missing relation may come from an
external domain expert or from an operation supplied by the language and its
libraries. The source therefore does not claim that the data definition alone
fully determines behavior.

Testing reuses the earlier examples as executable checks. A mismatch can mean
the expectation is wrong, the function is wrong, or both are wrong. Automated
passing is thus conditional on the examples' correctness. The expected
expressions in image tests can help derive a body without becoming circular
when they were worked from the problem before the implementation.

A multi-function design keeps a wish list. Each wish contains a meaningful
name, signature, and purpose. Batch design starts with its main function;
interactive design starts with roles required by the framework. Designing one
wish may reveal another. The recipe applies independently to each wished
function until the list is empty.

The world-program recipe begins with fixed properties as constants and changing
properties as world state. The state definition must represent every changing
fact needed by handlers and rendering, but should avoid redundant facts that can
be derived. Framework contracts produce an initial wish list for rendering,
selected event handlers, and stopping. Only relevant event kinds earn handlers.
A small main function wires the completed roles into `big-bang`.

The moving-car example demonstrates model revision. A number can represent the
car's center, edge, or elapsed time, and the interpretation changes every
handler and renderer that consumes it. If an observed result exposes ambiguity,
the designer revisits the data definition rather than patching only the visible
image. When a mouse-click requirement is later added, the recipe shows that
constants and existing state remain adequate while one handler and one wiring
clause must be added. Model/view separation confines the change.

#### Boundaries That Must Survive Derivation

- A data definition names a class, explains construction or membership, and
  interprets its values as information. A type alias alone may do none of these.
- New data names have a readability cost. The source explicitly warns against
  alias proliferation.
- Signature, purpose, and header are one recipe stage but distinct artifacts.
  The purpose describes the result, not the implementation technique.
- Functional examples are selected from the data classes and solved before the
  body. They are not retrospective illustrations of finished code.
- The data definition determines the structural part of a template, but the
  full inventory may include relevant constants and later wished operations.
- A template exposes available ingredients; domain knowledge and examples still
  determine how they should be combined.
- A passing check can preserve a wrong expectation. Test automation does not
  establish that an example represents the intended domain result.
- Every wished function needs a name, signature, and purpose, including helpers
  discovered during another function's design.
- World state contains changing information; fixed facts belong in constants,
  and derivable duplicates should not be carried merely for convenience.
- Framework callbacks receive generic signatures, but their purpose statements
  must be specialized to the actual problem.
- The book exempts a tiny declarative `main` from separate pedagogical design and
  tests. This is a local wiring judgment, not a universal rule that entry points
  need no evidence.
- Changed requirements are replayed through constants, state, wish list, and
  wiring so the existing model is retained or revised deliberately.

#### Developer Comparison

| Packaged claim or use | Source location | Preliminary decision |
| --- | --- | --- |
| A data definition is a construction rule plus interpretation. | §3.1, `Information and Data` | directly supported, with membership recognition as an additional source responsibility |
| Data examples, behavior examples, signature, purpose, stub, template, body, and checks are distinct diagnostic artifacts. | §3.1, `The Design Process` | directly supported; Developer's six-artifact grouping adapts rather than duplicates the source numbering |
| Purpose should state product result rather than traversal or branching. | §3.1 | directly supported by the “what does the function compute?” criterion |
| A template is derived only from the data definition. | §§3.1 and 3.4 | too broad if “only” describes the entire inventory: relevant global constants may be added; later wished functions also affect completion |
| A wished helper needs a meaningful name, signature, and purpose. | §3.4, `From Functions to Programs` | directly supported |
| Repository schemas, fixtures, callers, and tests may recover equivalent artifacts. | Chapter 3 introduction | source says the recipe helps understand existing programs; the exact repository evidence map is Developer adaptation |
| Passing examples can still encode the wrong claim. | §§3.1 and 3.5 | directly supported by the explicit expectation/body/both error cases |
| World design begins with fixed facts, changing state, handler roles, and event examples. | §3.6 | directly supported |
| State representation should be revisited when rendering exposes an ambiguous interpretation. | §3.6, moving-car revisions | directly supported |
| Requirement changes should be propagated through the design artifacts they affect. | §3.6, hyperspace extension | directly supported at the world-program level; later iterative refinement generalizes it |

#### Provisional Repair Notes

- Revise `data-driven-design.md` after the full book so “template derived only
  from the data definition” clearly refers to structural branches, selectors,
  recursive positions, and delegations. The full inventory may also include
  relevant constants and separately designed wished operations.
- Preserve HtDP's warning against alias proliferation when translating data
  definitions into production types or concept names.
- Add exact §3.1, §3.4, §3.5, and §3.6 anchors to the final traces for data
  design, composition, verification, and world programs.
- Retain the difference between generic framework callback signatures and
  problem-specific purpose statements.

### Chapter 4: Intervals, Enumerations, and Itemizations

**Read:** complete Chapter 4, sections 4.1-4.7.

**Source anchor:** `part_one.html#%28part._ch~3aintervals-enums%29`

**Visual and code inspection:** open and closed interval diagrams, the vertical
UFO-state partition, Figures 20-25's conditional transformations and rocket
state machine, the traffic-light information/data transition pair, rendered
bulbs, and the door's domain and encoded transition diagrams. The Chapter 4
asset-manifest SHA-256 is
`712440000b4780bdb36943dd95d3bfc210af799b209357a3f5036eceeeee4151`.

#### Argument Reconstructed

Chapter 4 introduces data definitions with explicit alternatives. An
enumeration lists every member, an interval characterizes values by boundaries,
and an itemization combines literals, intervals, and previously defined data
classes. Conditional code becomes systematic only when its clauses correspond
to these accepted alternatives rather than to branches invented during coding.

A `cond` clause makes one situation from the problem visible. The source prefers
`cond` when several distinct situations come from a data definition and reserves
`if` for a binary one-versus-the-other distinction. `else` denotes the
complement of previous conditions and avoids re-deriving a final predicate, but
it is valid only when all remaining accepted inputs share that result.

Enumerations make finite cases explicit. The initial template has one condition
per data clause, and examples cover each clause. The KeyEvent example then adds
an important optimization boundary: when an externally supplied enumeration is
large but only left and right matter to the product behavior, the properly
designed function can be rearranged into two relevant cases plus one unchanged
default. The source performs this compression after exposing the complete data
space, not before understanding it.

Intervals force boundary decisions. Examples must include each relevant
interior and every endpoint; overlapping clauses must be resolved so each input
has one meaning. The sales-tax problem intentionally leaves 1,000 and 10,000
ambiguous. The programmer cannot settle tax law by reading syntax or choosing a
convenient inequality; a domain specialist owns the missing policy. Once that
policy is known, the definition, examples, conditions, and expected amounts must
agree.

Itemizations combine unlike representations under one domain class. `NorF`
contains `#false` or a number; the rocket state contains a resting literal, a
countdown interval, or a non-negative flight position. One representative test
per alternative is the minimum, while intervals require endpoint and interior
coverage. Creating examples also exposes product choices that the requirement
did not specify, such as what a countdown should display.

The rocket example shows that mechanically complete representation is not
necessarily a good one. Negative numbers can encode countdown states and support
a working program, but the source calls the representation brittle and promises
structures as a repair. A passing program therefore does not establish that its
data model will remain intelligible or adaptable.

Conditional structure can be factored without erasing cases. When every branch
produces a text image that is placed into the same scene position, the
conditional can compute only the varying text and the shared placement can
surround it. Likewise, a repeated rocket placement earns an auxiliary. The
source preserves case distinctions while moving invariant computation out of
the branch bodies.

Finite-state programs connect two models. A domain transition diagram identifies
states, legal transitions, and causes such as time, locking, or pushing. A data
transition diagram chooses concrete values and runtime events for those facts.
The resulting state definition drives examples and templates for transition and
rendering functions.

The traffic-light alternatives demonstrate representation economics. Numeric
encoding can make one transition formula shorter, but symbolic case analysis
continues to work if state constants later change from numbers to strings. A
compact formula that depends on accidental encoding arithmetic may communicate
less intent and preserve less substitutability than a case-based function.

The door example also shows that an example table need not enumerate every
state/key cross-product when all unlisted combinations intentionally preserve
the current state. The default is justified by a known invariant, not by
ignorance of the remaining cases.

#### Boundaries That Must Survive Derivation

- One data alternative normally yields one conditional clause and at least one
  behavior example.
- Intervals need interior and endpoint examples. Boundary ownership is domain
  policy, not an implementation detail.
- Data clauses should be disjoint or have an explicit precedence whose domain
  meaning is clear.
- `else` means the complement of prior conditions. It is safe only when the
  accepted remainder has one known behavior.
- A large external enumeration may be compressed to relevant cases plus an
  unchanged default after the full input space is understood.
- Tests that cover every branch can still preserve a brittle representation or
  an invented boundary policy.
- Conditions must safely identify their data class. A string equality operation
  alone cannot classify an itemization that may contain numbers.
- Invariant context may move outside a conditional while the meaningful case
  distinction remains inside it.
- Equivalent current outputs do not make two data alternatives semantically
  identical. Merge cases only when their product meaning and expected evolution
  are also shared.
- A shorter transition formula may depend on concrete representation details;
  symbolic branches can better preserve the data abstraction.
- FSM arrows describe allowed transitions and their causes, not merely all
  pairs of state labels.

#### Developer Comparison

| Packaged claim or use | Source location | Preliminary decision |
| --- | --- | --- |
| One meaningful data clause becomes one branch and behavior example. | §§4.3-4.6 | directly supported |
| Numeric intervals should exist only where product behavior changes. | §§4.4 and 4.6 | directly supported by status and tax partitions |
| Interval examples should cover boundaries and an interior point. | §§4.4-4.6 | directly supported |
| A catch-all is always evidence of an incomplete design. | §§4.1, 4.3, and 4.7 | contradicted as a universal rule; source justifies defaults after identifying meaningful cases and the common remainder behavior |
| Catch-alls are suspicious when a new domain variant should require a decision. | §§4.3, 4.6, and 4.7 | supported as a qualified diagnostic, though the source does not use this exact wording |
| Merge branches only when product meaning, not merely current bodies, is shared. | §4.3 and finite-state examples | supported by full-design-then-rearrange and symbolic-state comparisons |
| A decision table may model independently varying complex inputs. | §4.7, door actions | supported at a simple state/event level; full two-complex-input recipes remain later |
| Every data definition that runs successfully is an adequate model. | §4.5, countdown rocket | contradicted by the explicitly brittle negative-number representation |
| Representation choices affect how easily behavior survives substitution. | §4.7, numeric versus symbolic traffic lights | directly supported |

#### Provisional Repair Notes

- Preserve the legitimate `else` cases in `data-shape-template-catalog.md`:
  defaults require an understood remainder with one behavior, not merely a desire
  to shorten code.
- Add Chapter 4's endpoint/interior rule and boundary-policy example to final
  verification and modeling traces.
- Use the brittle countdown representation as calibration against treating
  green branch coverage as model-quality evidence.
- Preserve the difference between a full domain enumeration and a larger
  framework enumeration from which the product uses only a few cases.

### Chapter 5: Adding Structure

**Read:** complete Chapter 5, sections 5.1-5.11.

**Source anchor:** `part_one.html#%28part._ch~3astructure%29`

**Visual and code inspection:** Cartesian and Manhattan positions, nested
lockbox diagrams, the full data-universe and structure-expansion figures, the
3-D distance equation, editor states and cursor geometry, and the transparent
chameleon asset. The Chapter 5 asset-manifest SHA-256 is
`66c16692e1ad09e80622b57971dab390f6a4a442c4b207f3eb40c0188855e20b`.

#### Argument Reconstructed

Chapter 5 addresses information that forms a fixed natural whole. Encoding two
facts into one number may be mathematically reversible, but it obscures intent.
A structure instead combines named fields into one value and supplies a
constructor, one selector per field, and a predicate. The representation says
which properties belong together while preserving access to each constituent.

Structure names and field names communicate domain roles. A `ball` and a `posn`
may both contain two numbers, yet reusing `posn-y` for velocity would mislead
readers. Likewise, named fields are preferable to numbered positions because
they preserve meaning at every construction and selection site. This semantic
benefit, not field count, earns a distinct structure.

A host-language structure type permits far more values than a program intends.
After defining `posn`, BSL can construct values whose fields contain strings or
nested structures. The data definition selects the legitimate subset, states
the expected class of each field, and interprets the whole in the domain.
Constructor availability is therefore not runtime enforcement of validity.

The same structure mechanism may support different data definitions. A `ball`
with two numeric fields can mean one-dimensional location and velocity, while a
`ball` containing `Posn` and `Vel` means a two-dimensional object. Within one
program, the source recommends one consistent interpretation. A structure type
alone does not settle its meaning.

Nested domain information is naturally represented by nested structures. A
moving object's location and velocity each contain horizontal and vertical
components; a contact entry contains phone structures. The source also presents
a flat four-field alternative. The choice is a design decision about natural
sub-wholes, navigation, and future operations, not a syntax mandate.

For a structure-consuming function, the HtDP template inventories one selector
per field. The completed body may ignore selectors irrelevant to the purpose.
For a structure-producing function, examples expose the expected constructor
and field values. Functional setters preserve unchanged fields and replace one
selected value.

Deeply expanding every nested selector into one function produces an unreadable
outline. The source's rule is one function per level of nesting. The outer
function handles the outer whole and delegates a nested subproblem to a wished
function with its own signature, purpose, examples, template, and body. Examples
for the wish can be derived from the parent examples, but the wish still owns a
separate operation such as adding a velocity to a position.

The universe-of-data figures separate constructibility from legitimacy. A
structure definition expands what the runtime can construct; a data definition
names only the subset a function promises to consume or produce. Data examples
must be generated from each clause and field rule, not from every value the host
constructor happens to accept.

The editor exercise makes representation choice explicit. Cursor state can be a
whole string plus an index or two strings split at the cursor. Both can represent
the information, but operations have different complexity. The source asks the
reader to replay the complete recipe and compare the alternatives, making data
representation the first architectural decision rather than a passive type
annotation.

World states use structures when several changing facts must travel together.
Each field may itself represent a compound fact. Requirement growth can extend
or nest the state definition, after which handlers, rendering, tests, and
construction must be reconsidered.

#### Boundaries That Must Survive Derivation

- A structure is warranted when relevant properties belong to a natural whole,
  not merely because several variables are currently adjacent.
- Host constructors can create values outside the named data definition. Static
  or runtime enforcement is a separate guarantee.
- The same field shape can carry different domain meanings. Structure and field
  names should reveal the accepted interpretation.
- Within one program, one structure use should have one consistent
  interpretation.
- Nested information may justify nested representation, but flat and nested
  alternatives must be compared against operations and change pressure.
- The canonical HtDP structure template inventories every field selector; the
  completed function may not need every field.
- Output definitions constrain constructors and expected field values just as
  input definitions constrain selectors.
- One function per nesting level prevents deep structural navigation from
  swallowing distinct subproblems.
- A wish is allowed before implementation, but it requires its own design
  artifacts and tests.
- Data examples demonstrate membership in the intended class; they do not prove
  the host constructor rejects other values.
- Representation choice can move complexity between operations. No single
  representation is universally best without the program's purposes.

#### Developer Comparison

| Packaged claim or use | Source location | Preliminary decision |
| --- | --- | --- |
| A record groups a fixed natural whole. | chapter introduction; §§5.4 and 5.8 | directly supported |
| Fields become selectors or destructured values in the structural template. | §§5.3, 5.6, and 5.8 | directly supported |
| Only fields currently relevant to the purpose should appear in the template. | §5.8 | differs from the canonical pedagogical recipe, which inventories all selectors and permits the body to ignore some; may be a justified Developer boundary adaptation |
| Host schemas and constructors may admit values outside the product data definition. | §5.7, `The Universe of Data` | directly supported |
| Nested data should create one delegated function per level. | §5.6, nested UFO example | directly supported |
| A wished auxiliary can be used to complete a parent before its body exists. | §5.6, `ufo-move-1` and `posn+` | directly supported |
| Complex output definitions constrain constructors. | §5.6, `x+`, `reset-dot`, and `ufo-move-1` | directly supported |
| Representation alternatives should be compared by operation complexity. | §5.10, graphical editor | directly supported |
| Runtime presence of an “impossible-looking” shape contradicts a declared product definition. | §5.7 | supported as a diagnostic; source shows constructible values can exceed the declared legitimate subset |

#### Provisional Repair Notes

- Decide after later chapters whether `data-shape-template-catalog.md` should
  distinguish HtDP's complete selector inventory from Developer's narrower
  responsibility-facing template. Do not attribute the narrowed rule directly
  to HtDP without marking the adaptation.
- Preserve constructibility versus legitimacy in `data-driven-design.md` and
  existing-code recovery.
- Add §5.6 to the final provenance for wished helpers and one-function-per-level
  delegation.
- Use the editor alternatives as calibration for representation choice rather
  than declaring nested or flat data universally superior.

### Chapter 6: Itemizations and Structures

**Read:** complete Chapter 6, sections 6.1-6.5.

**Source anchor:** `part_one.html#%28part._ch~3amix%29`

**Visual and code inspection:** the two pre-launch/post-launch game-state
variants, rendered space-invader examples, optional-missile examples,
pedestrian-light states, Figure 37's sequence-recognition FSM, and the open-ended
BSL universe. The Chapter 6 asset-manifest SHA-256 is
`75c15e9b47470dd8cda94484335603e41c41ef344c066db7b1cdbaaea72405e0`.

#### Argument Reconstructed

Chapter 6 composes the prior two representation mechanisms. A domain may have
several alternatives, some of which are fixed compound wholes. The first space
invader representation therefore uses one structure before launch and another
after launch. Its data definition is an itemization whose clauses describe
different structures.

The resulting template has two dimensions. Itemization clauses determine
conditional branches and recognition predicates. Structure fields determine
selectors inside the branch that owns that structure. If a clause refers to a
separately named data definition, the template delegates to a separately
designed function instead of recursively expanding every selector in place.
This is the precise branch/selector/delegation rule behind Developer's template
catalog.

The source adds a prior decision: inspect the problem for distinct tasks before
building a large structural template. If several tasks are visible, composition
of separately designed functions may be more appropriate. The renderer delegates
tank, UFO, and missile drawing to wishes with their own signatures and purposes.
The data shape guides collaboration, but does not require one monolithic
function that exposes every nested field.

During completion, HtDP permits filling easy branches first and leaving default
values that make remaining tests fail. This is visible, bounded progress inside
one design, not evidence that the function is complete. A wished function may
also remain a stub while its caller is grammatically runnable; its tests remain
red until the wish is fulfilled.

The random-movement example separates an uncontrollable choice from a
predictable core. A thin wrapper obtains a random delta, while
`si-move-proper` receives the delta explicitly and can be checked with fixed
examples. Nondeterminism is not mocked away inside the domain calculation; it is
moved to an edge with an explicit input contract.

The second space-invader representation demonstrates non-uniqueness. Instead of
two state structures, it uses one structure whose missile field is `#false` or a
position. This changes the top-level template from case analysis to selectors
and moves the case split into missile-specific operations. Neither form is
presented as universally correct; data organization relocates branching and
collaboration costs.

The optional-missile example exposes a subtle pass-but-wrong defect. A template
condition using `boolean?` accepts both `#false` and `#true`, though the data
definition admits only `#false`. Tests for `#false` and a position can pass while
the implementation accepts an invalid value. Designing the exact
`missile-or-not?` predicate repairs the gap. Structural branch coverage is not
membership correctness.

Checked functions widen their input signature to the open-ended universe of BSL
values, preserve the original function's result for valid inputs, and signal an
intentional error otherwise. The source places these checks at boundaries where
programs are handed to less controlled callers. Core functions are still
designed against narrower signatures to avoid drowning every definition in
open-universe checks.

World programs can use an exact state predicate after every transition. This
catches a handler that produces a value outside the state definition at the
point of production rather than after several later events. The guarantee is
attached to the state-machine boundary, where every next state passes.

Domain equality is also narrower than representation equality. Two traffic-light
states are strings, but arbitrary strings are not traffic lights. A checked
equality operation first establishes membership in the domain class and only
then compares representations.

#### Boundaries That Must Survive Derivation

- Itemizations of structures derive both branches and branch-local field access.
- A referenced data definition should normally be delegated to its own function,
  not flattened into deep selector chains.
- Distinct problem tasks can justify composition instead of one mechanically
  expanded template.
- Temporary defaults and failing tests are allowed while completing a design,
  but they are explicit unfinished states, not successful landings.
- A wish can make a caller syntactically runnable before behavior is complete;
  its independent contract and failing evidence must remain visible.
- Nondeterministic choice can be isolated while the deterministic transformation
  remains directly testable.
- Alternative representations move branches between levels. Fewer top-level
  variants do not mean the domain distinction disappeared.
- A broad host predicate may recognize a superset of the declared data clause.
  Exact membership needs negative examples as well as valid representatives.
- Checked wrappers deliberately widen inputs and own validation; internal core
  functions may rely on established signatures.
- State validation is strongest at the transition boundary that produces every
  next state.
- Representation equality is not domain membership or domain equality.

#### Developer Comparison

| Packaged claim or use | Source location | Preliminary decision |
| --- | --- | --- |
| Itemization clauses produce branches and structure clauses produce branch-local selectors. | §6.1, `The Design Recipe` | directly supported |
| References to another data definition produce delegation at that exact position. | §6.1 | directly supported |
| A giant nested conditional may indicate collapsed separately defined data. | §6.1, space-invader renderer | directly supported |
| A structural template is always preferable to design by composition. | §6.1 | contradicted; source says to inspect for distinct tasks and skip the template in favor of composition when appropriate |
| Nondeterministic effects should be separated from a predictable testable core. | §6.1, `si-move` | directly supported in the random-number case |
| Data examples and branch tests prove exact data membership. | §§6.1 and 6.3 | contradicted by `boolean?` accepting invalid `#true` for `MissileOrNot` |
| Runtime state invariants should be checked at transition boundaries. | §6.4, `Checking the World` | directly supported |
| Validation belongs at public or uncontrolled input boundaries rather than indiscriminately in every core function. | §6.3, `Input Errors` | directly supported in the book's pedagogical setting |
| Different valid representations can relocate conditional complexity. | §6.1, `SIGS` versus `SIGS.v2` | directly supported |
| Domain equality may require membership checks beyond host equality. | §6.5 | directly supported |

#### Provisional Repair Notes

- Use the `boolean?` versus `#false` example as an adversarial fixture for exact
  clause membership and pass-but-wrong branch coverage.
- Ensure final template wording permits composition to replace full structural
  expansion when the problem exposes distinct tasks.
- Preserve the difference between bounded red work in progress and verified
  completion when comparing HtDP with Developer's stable implementation
  landings.
- Add §6.3-6.4 to final provenance for boundary validation and invariant
  placement.

### Chapter 7: Summary

**Read:** complete Chapter 7.

**Source anchor:** `part_one.html#%28part._ch~3asummary1%29`

The summary states that the design recipe has two independent dimensions: an
ordered process and a data representation that changes the details of examples,
templates, and completion. It also restates top-down presentation of main and
wished functions, batch composition, world-program handler roles, predictable
language semantics, and reuse of library contracts.

### Part I Cumulative Decision

Part I directly supports Developer's base data-design route: interpret domain
information, define accepted data, construct data and behavior examples, state a
purposeful contract, derive branches/selectors/delegations from data shape,
complete with domain and library knowledge, and check examples. It also supplies
several qualifications that final references must preserve:

- template structure is data-driven, but full design also uses constants,
  domain knowledge, library roles, wishes, and composition;
- constructible host values may exceed legitimate product values;
- exact membership and boundary policy need negative and endpoint evidence;
- data representations are alternatives that relocate complexity;
- green examples do not establish model quality or exact validity; and
- validation should be attached to the boundary that owns uncontrolled input or
  state production.

No packaged reference is repaired yet. Parts II-VI may refine structural
recursion, abstraction, intertwined data, generative recursion, and accumulator
claims that constrain the final wording.

## Intermezzo 1: Beginning Student Language

**Read:** complete Intermezzo 1, including vocabulary, grammar, meaning,
computation, errors, Boolean expressions, constant and structure definitions,
tests, and the error-message catalog.

**Primary URL:** <https://htdp.org/2026-5-28/Book/i1-2.html>

**Visual and structural inspection:** Figures 39-43 are HTML-native grammar,
evaluation, syntax, and test tables rather than external images. Their code-row
structure was checked against the raw HTML because flattened prose loses some
category and equation alignment.

### Argument Reconstructed

The intermezzo separates three questions that informal programming often
conflates. Vocabulary identifies tokens, syntax determines which combinations
are grammatical, and semantics determines how legal phrases evaluate. A phrase
can be syntactically valid yet get stuck at runtime because an operation receives
the wrong kind of value or has no defined result.

BSL's evaluation model uses algebraic replacement. Primitive applications reduce
according to operation laws, function applications replace parameters with
argument values, and conditionals discard false clauses or select the first true
answer. The stepper is explicitly described as a model of DrRacket's evaluation
mechanism, complementary to program-design principles. These rules support
prediction and debugging in BSL; they are not a universal account of how every
production runtime executes functions.

Evaluation context matters. A division by zero in an unselected conditional
branch does not execute. `and` and `or` are syntax with short-circuit semantics,
not ordinary eager functions. The operational guideline chooses the outermost,
left-most nested expression that is ready. Looking at every syntactically nested
expression as if it executes would produce false failure claims.

A stuck legal expression corresponds to a runtime error; an illegal phrase is a
syntax error. The stepper can help isolate runtime and logical mistakes by
copying a program and pruning irrelevant pieces. Error messages may point to a
primitive where an unenforced function-signature assumption finally fails,
which can be later than the true source of the invalid value.

Constant definitions are evaluated in order. A computed constant may use only
previously available definitions, so moving a function below a constant that
calls it changes validity. Function definitions do not behave like arbitrary
order-independent declarations in this pedagogical semantics.

A structure definition extends the value universe and introduces constructor,
selector, and predicate laws. Its constructor accepts arbitrary BSL values;
selectors and predicates enforce only structure identity. This formal section
confirms Part I's distinction between runtime constructibility and the narrower
legitimate collection named by a data definition.

The test grammar provides several distinct evidence relations:

- `check-expect` uses equality;
- `check-member-of` accepts one of several expected values;
- `check-within` uses numeric tolerance, including nested inexact values;
- `check-range` accepts an interval;
- `check-error` checks that some error occurs;
- `check-random` coordinates random-call sequences between actual and expected
  expressions; and
- `check-satisfied` asks whether an outcome has a property.

These are not interchangeable styles. The expected relation must match the
claim: exact value, allowed set, tolerance, interval, failure, controlled
randomness, or property. DrRacket collects tests, evaluates definitions, and then
runs tests in source order, so test placement in the file does not imply test
execution before definitions are available.

### Boundaries That Must Survive Derivation

- Syntax, runtime meaning, and design correctness are separate judgments.
- The substitution and stepper model predicts BSL behavior; it should not be
  stated as the literal implementation of unrelated runtimes.
- Unselected conditional and short-circuited expressions do not execute.
- A runtime error may surface at a downstream primitive even when an earlier
  boundary introduced the invalid value.
- Constant-definition order is semantically relevant in BSL.
- Structure predicates recognize constructor identity, not field validity under
  a domain data definition.
- Different test forms encode different acceptance relations and therefore
  support different claims.
- `check-error` accepts any error; it does not by itself establish the exact
  failure kind or message.
- A property check can accept many outputs, while equality checks one expected
  value. Neither dominates without a stated claim.
- Controlled random evaluation is specific evidence for nondeterministic code,
  not a substitute for isolating a deterministic core when possible.
- Error-message highlighting is diagnostic evidence, not proof of the original
  semantic cause.

### Developer Comparison

| Packaged claim or use | Source location | Preliminary decision |
| --- | --- | --- |
| Choose a verifier whose acceptance relation matches the claim. | `BSL Tests`, Figure 43 | directly supported by the distinct equality, membership, tolerance, range, error, random, and property forms |
| Passing one verifier may leave another property untested. | `BSL Tests` | directly supported by the non-equivalent test relations, though the source does not use Developer's evidence taxonomy |
| Runtime semantics must be predicted rather than inferred from output alone. | `BSL Meaning`; `Meaning and Computing` | directly supported |
| Every nested expression is evaluated before a function returns. | `BSL Errors`; `Boolean Expressions` | contradicted by conditionals and short-circuiting |
| Constructor success proves data-definition validity. | `Structure Type Definitions` | contradicted; constructors extend the universe with arbitrary field values |
| A downstream error location identifies the boundary that caused invalid data. | `BSL Error Messages` | not supported; unchecked signatures can fail only at a later primitive |
| Test placement and test execution order are the same. | `BSL Tests` | contradicted; tests are collected and moved after definitions while retaining test order |

### Provisional Repair Notes

- Expand the final HtDP trace in
  `verifier-selection-and-pass-but-wrong.md` beyond generic examples and tests;
  Intermezzo 1 directly supports claim-relative verifier selection.
- Preserve the weakness of an any-error check when Developer requires an exact
  failure contract.
- Keep BSL's substitution model as source-specific semantics rather than a
  universal execution rule.
- Add constant-order and short-circuit boundaries only where Developer makes a
  runtime-semantic claim; do not burden general design routes with BSL details.

## Part II: Arbitrarily Large Data

**Primary URL:** <https://htdp.org/2026-5-28/Book/part_two.html>

Part II extends fixed-size data definitions to finite values of arbitrary size.
It revises the template rule so self-reference in data creates a natural
self-reference in functions, then develops production, nested structures,
composition, and larger projects.

### Chapter 8: Lists

**Read:** complete Chapter 8, sections 8.1-8.4.

**Source anchor:** `part_two.html#%28part._ch~3alists1%29`

**Visual and code inspection:** nested list boxes, preferred box-and-arrow list
orientation, three stages of list evaluation, and Figure 51's arrows connecting
data-definition self-reference to function-template self-reference. The Chapter
8 asset-manifest SHA-256 is
`96c344b72614c9016068c5cc959ea0fed01a842dd0138bae06da16d8633d5634`.

#### Argument Reconstructed

Fixed-size structures cannot represent an unknown finite number of facts as one
value. Lists solve this by a self-referential definition with a base value and a
construction rule: a list of names is empty, or it is a string combined with
another list of names. The recursive clause does not merely describe storage;
it explains how to construct arbitrarily large valid examples and how to
recognize membership one layer at a time.

Self-reference is meaningful only because construction can start. The empty
clause supplies a confirmed value, and the recursive clause builds a larger
value from a new item and an already confirmed smaller value. A definition like
“a table is a table” supplies neither a base nor a growth rule and does not earn
recursion.

`cons` behaves like a protected two-field structure whose second field must be a
list. Its actual representation is hidden so clients cannot construct malformed
rest fields. `first`, `rest`, and `cons?` expose the approved interface. This is
an abstraction barrier around a representation invariant, not just convenient
syntax for pairs.

Lists can technically mix arbitrary values, but the source rejects using a list
as an opaque fixed-size personnel record. When information has a fixed number of
named roles, a structure communicates it better. Arbitrary size and fixed
heterogeneous product shape are distinct data pressures.

The `contains-flatt?` design shows how self-reference propagates into the
function template. The empty clause creates a base branch. The constructed
clause exposes the first item and the rest list. Because `rest` has the same data
definition as the original input, the template contains a natural recursive call
on exactly `rest`. No other “smaller” input is invented.

Completion uses the purpose statement recursively. If the first item matches,
the answer is true; otherwise the recursive result answers the same question for
the rest. Short-circuit disjunction expresses this combination without
searching the remainder after a match.

The chapter also gives an explicit pass-for-the-wrong-reason example. Before the
body is complete, a constant `#false` stub passes empty and negative search
examples while failing positive ones. Those passing tests do not support the
search behavior; they happen to agree with the stub's default. Test count and
green status must be tied to which branch and claim produced the result.

The evaluation walkthrough confirms that recursive execution follows the data
construction one layer at a time. The natural call is not justified by recursion
as a programming style. It is justified because `rest` is the recursive field in
the accepted data definition.

#### Boundaries That Must Survive Derivation

- Arbitrarily large data is still finite at runtime; the definition describes
  values of unbounded possible size.
- A useful self-referential definition needs a constructible base and a clause
  that builds larger values from a smaller confirmed value.
- The natural recursive call appears at the exact self-referential field.
- Recursing on an arbitrary computed “smaller” value is not structural recursion.
- A list's protected constructor enforces only list shape; the element data
  definition still determines semantic membership.
- Heterogeneous list capability does not justify replacing a fixed named record
  with positional items.
- A stub can pass examples for the wrong reason. Passing evidence must be mapped
  to the intended branch and behavior.
- Short-circuit search may avoid recursive work after the answer is known.
- Representation hiding prevents malformed construction that a public generic
  pair constructor would permit.

#### Developer Comparison

| Packaged claim or use | Source location | Preliminary decision |
| --- | --- | --- |
| Self-referential data needs a non-recursive clause and a recursive growth clause. | §8.1, `Creating Lists` | directly supported |
| A self-reference creates one natural recursive call at that exact field. | §§8.3-8.4 and Figure 51 | directly supported |
| Recursing on `dropEveryOther(rest)` remains structural because the value is smaller. | §§8.3-8.4 | not supported; the natural structural value is the selected `rest` field itself |
| Fixed heterogeneous records should be represented as named structures rather than positional lists. | §8.1 | directly supported |
| A protected constructor can enforce a representation barrier. | §8.2 | directly supported |
| Green examples prove the stub implements the corresponding behavior. | §8.3 | explicitly contradicted by tests that succeed for the wrong reason |
| Structural recursion is selected from data shape rather than preferred as a style. | §§8.1 and 8.3 | directly supported |

#### Provisional Repair Notes

- Add §8.3's wrong-reason green tests to the final pass-but-wrong provenance.
- Preserve the exact-position criterion in
  `data-shape-template-catalog.md`; “smaller” alone is insufficient.
- Keep representation barriers distinct from data-definition membership:
  protected list shape does not validate every element's domain meaning.

### Chapter 9: Designing with Self-Referential Data Definitions

**Read:** complete Chapter 9, sections 9.1-9.6.

**Source anchor:** `part_two.html#%28part._ch~3adesign-lists%29`

**Visual and structural inspection:** Figures 52-59's HTML-native recipe,
arrowing, and combinator tables; clean and balloon-struck lecture halls; Russian
doll layers; the list-based shot world; and the two list representations of
sets. The Chapter 9 asset-manifest SHA-256 is
`728eb894b036b0732c714829c87a07d354448b85c827121a6ae8e332f3f2d335`.

#### Argument Reconstructed

Chapter 9 turns the list intuition into a general recipe. Information of finite
but arbitrary size calls for a self-referential data definition. A valid
definition has at least two clauses, including a clause with no self-reference.
Examples begin from that base and repeatedly use recursive clauses to construct
larger values. If no examples can be generated, the definition is invalid; if
examples cannot grow, it may contradict its interpretation.

Functional examples must traverse the recursive clause several times. A base
example plus one shallow recursive value is insufficient to reveal how repeated
construction affects behavior. These examples later supply rows for branch,
selector, and recursive-result reasoning.

Figure 52 formalizes template derivation. Data alternatives create conditional
clauses; structured alternatives create selectors; every self-reference creates
a natural recursion at the corresponding clause and field; and references to
other data definitions create specialized delegation. The number and placement
of recursive calls must match the data-definition arrows, not a programmer's
preference for recursion.

Function completion starts with base cases. In recursive clauses, each selector's
meaning comes from the data definition and the natural recursion's meaning comes
from the function purpose. The “leap of faith” assumes the same purpose already
holds for the structurally contained value. It does not assume the implementation
mechanism or inspect how the recursive call reaches its answer.

When the combinator is unclear, the source tabulates input, selectors, recursive
results, and desired output. Additional examples are added until a stable
relationship becomes visible. This table is a discovery and diagnostic surface;
a guessed expression still needs tests and an explanation of why it applies to
all values generated by the definition.

Not every structural template should be completed directly. Average has no
meaningful result for the empty list and combines poorly from a first temperature
plus the average of the remainder. Its ordinary definition instead composes the
separate tasks of summing, counting, and dividing. The problem statement's
operation supplies the decomposition more clearly than the recursive input shape.

The average example also distinguishes partiality from representation. A checked
wrapper can reject an empty list, or the signature can use a non-empty list data
definition and make average total over its declared domain. The non-empty list
has a one-element base and a recursive multi-element clause, producing a
different template. The shape of the representation determines where the base
case falls.

Natural numbers are treated as self-referential data: zero is the base, `add1`
builds larger values, and `sub1` selects the contained predecessor. A structurally
recursive function on a natural number recurs on exactly `sub1 n`. Atomic host
syntax does not prevent a domain-specific structural interpretation.

Russian dolls show that the base need not be an empty sentinel. A string
represents the innermost doll, while a layer structure contains a color and
another doll. The template branches by the two clauses and recurs only through
the nested-doll field. Unused color selectors remain part of the full inventory
but may disappear from a depth implementation.

The list-based world program scales state to an unknown number of shots. Its
renderer and tick handler recurse structurally over all shots; the key event,
not the list, controls the key handler's case split. Later cleanup pressure is
visible when off-canvas shots remain in state after disappearing from view.
Visible absence is not state absence.

The final section separates sets as mathematical collections from lists as one
finite representation. Order and duplicate count are meaningful for lists but
irrelevant for set membership. Two list representations—duplicates permitted or
forbidden—require different removal implementations. Equality against one list
order is the wrong verifier for a set claim; `check-satisfied` expresses the
representation-independent property that the removed member is absent.

#### Boundaries That Must Survive Derivation

- Self-referential validity requires a non-recursive base and the ability to
  generate increasingly large examples.
- Functional examples should exercise multiple recursive layers.
- Every natural recursion corresponds to one exact self-reference; arrow count
  and position should match.
- Recursive-result meaning comes from the purpose statement, not from imagining
  the implementation's internal steps.
- A combinator table supports discovery but does not prove a guessed expression.
- Structural shape can suggest a template while the problem's distinct tasks
  justify composition instead.
- Excluding an invalid base value in the data definition can turn a partial
  function into a total function over a narrower domain.
- A function designed for a broader list class may work for a narrower non-empty
  subclass, but that compatibility needs a contract argument rather than name
  similarity.
- Self-referential bases may be empty values, singleton structures, atomic
  values, or other non-recursive clauses.
- For multiple complex inputs, one input may control the case structure while
  another remains available; the relationship must be stated.
- Invisible objects can remain in world state and continue to impose processing
  cost or semantic debt.
- Representation equality is often the wrong verifier for an abstract set
  property.
- Sets named by data definitions and list values live at different conceptual
  levels; finite lists cannot represent every infinite set extensionally.

#### Developer Comparison

| Packaged claim or use | Source location | Preliminary decision |
| --- | --- | --- |
| A self-referential definition needs a constructible base and recursive growth. | Chapter 9 opening recipe | directly supported with explicit validity conditions |
| One natural call appears per self-reference at the matching selector. | Figures 52 and 56 | directly supported |
| Recursive examples should include at least two layers. | Chapter 9 opening recipe | directly supported |
| The purpose statement supplies the meaning of a recursive result. | Figures 53-54 | directly supported |
| A helper or composition may replace direct structural completion when the problem exposes separate tasks. | §9.2, average | directly supported |
| A narrower representation can place a precondition into the data definition. | §9.2, non-empty lists | directly supported |
| Natural numbers can be treated by structural recursion on a predecessor. | §9.3 | directly supported |
| One function per nesting level is compatible with self-referential structures whose recursive field is not a list. | §9.4, Russian dolls | directly supported |
| One complex input may control a multi-input template. | §9.5, `keyh` | directly supported as an introductory case; the complete relation taxonomy remains later |
| Property-based evidence can avoid coupling tests to one representation. | §9.6, list representations of sets | directly supported |
| Equal serialized output is always the strongest verifier for collection behavior. | §9.6 | contradicted when order and duplicates are irrelevant to the abstract claim |

#### Provisional Repair Notes

- Add Chapter 9's exact self-reference validity and arrow-position rules to the
  final source trace for `data-shape-template-catalog.md`.
- Preserve composition as an alternative when a direct recursive combinator is
  unnatural or the purpose names distinct tasks.
- Add §9.6 to verifier provenance for representation-independent property
  checks.
- Consider adding off-canvas shots as a calibration case for visible output
  passing while obsolete state remains.

### Chapter 10: More on Lists

**Read:** complete Chapter 10, sections 10.1-10.4.

**Source anchor:** `part_two.html#%28part._ch~3alists2%29`

**Visual and structural inspection:** Figures 64-65's list-producing payroll
programs, the poem and its line/word representations in Figures 66-68, the
encoder and matrix-transposition code in Figures 69-70, the `rev` table in
Figure 71, and the graphical editor display. The sole raster asset is the
editor display; the Chapter 10 asset-manifest SHA-256 is
`575e83941042bf6492a97589a611ec48da94fdfee9ce7dba166c8b3232dab105`.

#### Argument Reconstructed

A structurally recursive consumer can produce arbitrarily large data as well as
reduce it. The payroll example consumes one list and constructs another in the
same order: the empty input produces an empty output, while each recursive
clause transforms the first item and `cons`es it onto the recursively produced
remainder. The recursive result's signature and purpose establish both its
representation and information meaning before the function exists.

Production and validation can share the traversal. If employee hours above 100
are impossible for the product, the function must reject such an item when it
encounters it rather than silently compute a wage. This condition does not come
from the broad `List-of-numbers` shape; it comes from the product domain.
Changing a universal pay rate should likewise become one definition rather than
several coordinated edits.

When a list contains structures, a flat expanded template can enumerate every
selector, but the recommended working strategy is one template and eventual
function per referenced complex data definition. `wage*.v2` owns list traversal;
`wage.v2` owns one work record. The boundary follows the data-definition
reference and gives each function a specific input class and purpose. The
list-level result can itself contain structures, as the paycheck refinement
exercises emphasize.

Chapter 10 introduces iterative refinement explicitly. Initial payroll
representations omit realistic employee identity and paycheck information; later
versions add those distinctions and revise the affected representations and
functions. The exercise is intentionally excessive for the small example but
prepares for problems where complete information cannot be modeled responsibly
in one pass.

Text files demonstrate representation choice through preserved information.
One string retains characters and line breaks but poorly exposes line and word
organization. A list of lines preserves blank lines; a flat list of words loses
them; a list of lists of words preserves both line organization and word
boundaries. The right intermediate form is therefore relative to the next
operation, not universally best.

Nested lists repeat the per-data-definition boundary. `words-on-line` traverses
the outer list and delegates one line to a line processor. Once its purpose is
recognized as ordinary cardinality, an existing `how-many` or generic `length`
can replace a new recursive implementation. Reuse depends on the actual input
and result contract, not the original example's domain vocabulary.

`file-statistic` composes a reader whose output matches the processor's input.
The source generalizes this into a planning rule: designers can choose an
intermediate data collection specifically to communicate one computation's
result to the next, and can design toward an available library function's
output rather than discover compatibility by accident.

The matrix exercise marks a limit of the recipe learned so far. A matrix is a
non-empty list of equal-length rows, and transpose repeatedly removes the first
item from every row. Its recursive input is produced by `rest*`; it is not the
single direct recursive field exposed by the outer list definition. The text
explicitly says the recipes presented so far cannot design this function, even
though wish-list functions can make its high-level operation understandable.

The graphical editor compares two valid representations of the same
information. Its prefix may be stored in display order or reverse order. The
reversed prefix makes insertion, deletion, and cursor movement local list
operations, while rendering reverses the prefix at the representation boundary.
Both representations are semantically valid; operational simplicity decides
between them.

The editor also sharpens multi-input and nested-data design. The key event drives
the handler's cases, with special one-character keys handled before the general
one-character clause. Each event task becomes a wished function. Those helpers
inspect the editor structure, but they recurse into its list fields only when
the operation requires traversal; insertion merely uses `cons`. Complex nested
data does not itself mandate recursive expansion.

Finally, an `editor-text` unit test passes while the composed renderer test
fails because the reversed-prefix interpretation was omitted at composition.
The smaller test localizes the working collaborator, and the larger test exposes
a boundary mismatch. A green helper does not imply that its caller has adapted
representation semantics correctly.

#### Boundaries That Must Survive Derivation

- List-producing structural recursion derives traversal from the input shape;
  output construction still comes from the purpose and examples.
- Product-domain validation may be stricter than the host-shaped data definition.
- Referenced complex data suggests a separate template and collaborator, but an
  operation that only constructs or selects locally may need no recursive helper.
- Data representation determines which distinctions survive: flattening words
  loses empty-line and line-boundary information.
- An intermediate representation should be judged against the communication
  needs of adjacent computations.
- Reuse is justified by compatible contracts and behavior, not shared names or
  the story attached to the original implementation.
- Decimal expectations written with the same arithmetic expression avoid a
  brittle literal on inexact-number hosts, but shared computation can also weaken
  independence of the test oracle; the supported claim must be stated narrowly.
- Matrix row-length equality is a representation constraint in addition to the
  recursive list shapes.
- Recursion over a transformed whole input is outside the direct natural-recursion
  recipe presented through Chapter 10.
- Equivalent representations can have different operational costs and local
  update complexity.
- Conditional ordering matters when a specific case overlaps a broader case.
- Passing unit evidence for a helper does not verify representation adaptation at
  a composition boundary.

#### Developer Comparison

| Packaged claim or use | Source location | Preliminary decision |
| --- | --- | --- |
| Recursive list functions may construct result lists while preserving input order and cardinality. | §10.1, `wage*` | directly supported for map-like transformations |
| Referenced complex definitions suggest separate templates and functions. | §10.2 and §10.3 | directly supported |
| Every nested complex value requires immediate recursive expansion. | §§10.2-10.4 | contradicted; delegation, primitives, or local construction may suffice |
| Data representation should preserve distinctions needed by downstream operations. | §10.3, file representations | directly supported |
| Composition can be planned around an explicit intermediate data contract. | §10.3, `file-statistic` | directly supported |
| Existing generic operations should be reused when their actual contract matches. | §10.3, `length` | directly supported |
| All decreasing recursive inputs count as structural recursion derived from the data template. | §10.3, transpose | contradicted by the chapter's explicit recipe limit |
| Representation choice should account for operation simplicity. | §10.4, reversed editor prefix | directly supported |
| The data-shape inventory is a mandatory implementation skeleton. | §§10.2 and 10.4 | contradicted; the source separates complete template knowledge from selected implementation needs |
| Unit tests plus a composition test can localize a representation-boundary defect. | §10.4, `editor-text` and `editor-render` | directly supported in the worked case |

#### Provisional Repair Notes

- Preserve the distinction between direct natural recursion and recursion on a
  transformed whole input; later generative-recursion chapters must supply the
  final terminology and rules.
- Add the file-representation contrast to `problem-modeling.md` or the appropriate
  representation-choice derivation only after whole-book routing is known.
- Add the reversed editor prefix as a representation-economics calibration case:
  equal information, different local-operation cost.
- Ensure `data-driven-design.md` does not turn one-function-per-definition into an
  unconditional helper requirement when primitives or local constructors already
  satisfy the purpose.
- Consider the passing-helper/failing-renderer example for composition-boundary
  verification provenance.

### Chapter 11: Design by Composition

**Read:** complete Chapter 11, sections 11.1-11.4.

**Source anchor:** `part_two.html#%28part._ch~3alist-sort%29`

**Visual and structural inspection:** the `list` abbreviation expansions; the
composition guidelines and wish-list protocol; insertion sort and its `insert`
collaborator in Figure 72; polygon examples, templates, and failed renderings;
and the generalized polygon program in Figure 73. The three raster images
confirm the failure analysis: the recursive attempt closes only the trailing
triangle and merely chains any preceding points, so four- and five-point inputs
do not close the requested polygon. The Chapter 11 asset-manifest SHA-256 is
`d3808faf505ab58a55a36d9058ffd4d256e12f9058a9cc3a599b1001d6e5499a`.

#### Argument Reconstructed

The chapter coordinates three existing decomposition pressures. A problem may
name distinct tasks, quantities may depend on one another, or one data
definition may refer to another. The established rules are one function per
task or quantity dependency and one template per data definition. Chapter 11
adds definition-time pressures that only appear while combining template
results.

An auxiliary is indicated when result combination requires domain knowledge,
when it requires substantial case analysis over available values, or when it
must process an arbitrarily large value. If these moves still yield an awkward
or wrong definition, the designer may solve a more general problem and define
the original operation as a specialization or composition of that solution.
These are discovery prompts, not a mandate to extract every expression.

The wish list is the control surface for unfinished collaboration. Each entry
has a complete header so finished portions can be exercised while other tests
still fail. Before adding an entry, the designer checks language libraries and
existing wishes for an equivalent operation. Completion means the wish list is
empty, tests pass, and all functions are covered, though those conditions alone
do not establish every semantic claim.

Insertion sort demonstrates an auxiliary that recursively processes an
intermediate result. The original statement “sort” is first clarified to mean
descending order. The outer function structurally sorts the remainder, then
`insert` searches that sorted result for the first valid position. `insert`'s
contract includes a crucial precondition: its list argument is already sorted.
That invariant justifies stopping when the new number is at least the first
number, because every later number is no larger.

The sorting exercises also expose a verifier boundary. A predicate that checks
only whether output is sorted accepts `sort>/bad`, which always returns the same
sorted list. A complete sorting specification must relate the output to the
particular input, preserving its elements and occurrence counts in addition to
ordering them. The text explicitly notes that test predicates may need their
own design and tests, and reserves a complete relational specification for a
later lambda section.

The polygon example begins with representation repair. Plain lists of points
admit empty, one-point, and two-point values that do not meet the stated polygon
meaning. A `Polygon` therefore has a three-point base and recursive growth. This
revision illustrates that correcting a data definition during design is normal
and should propagate through examples, templates, and functions.

The direct structural rendering attempt follows the recipe and still fails. It
renders the recursively contained polygon, then connects the new first point to
the second. For a square, this closes the trailing triangle but never connects
the full polygon's first and last points. Additional experiments and drawings
show the same defect for five points. Systematic derivation organizes available
parts; it does not guarantee that the chosen combinator has the intended domain
meaning.

Failure analysis reveals that the implementation already solves a broader,
simpler operation: connect successive points without closing the shape.
`connect-dots` accepts any non-empty list of points, including values that are
not polygons. `render-poly` then composes this open-path renderer with one final
line from the first point to the last. The broader input domain produces a
simpler recursive contract, while the narrower polygon operation becomes a
one-line specialization.

The subset argument is explicit: every `Polygon` is a non-empty list of points,
but not conversely. This justifies passing a polygon to `connect-dots`. The text
considers making `last` general over non-empty point lists as well, while Figure
73 retains a polygon-specialized `last`; both scopes require their own declared
contract and matching base case.

The source prefers built-in predicates and selectors over a custom recursive
operation merely to distinguish the three-point base. Three `rest` selections
make the structural test direct, whereas `length` traverses the list; the full
cost explanation is deferred to Intermezzo 5. This is an operationally motivated
choice, not a blanket prohibition on named predicates.

#### Boundaries That Must Survive Derivation

- `list` is evaluated notation for nested `cons`; it does not introduce a new
  semantic kind of collection.
- Auxiliary-function guidelines identify composition pressure but do not require
  extraction without a concrete task or contract.
- A wish-list entry needs enough signature and purpose information to test and
  reason about callers before implementation exists.
- Clarifying sort direction is product semantics, not an implementation detail.
- `insert` is correct only under its sorted-input precondition; the early stop
  depends on that invariant.
- “Output is sorted” is necessary but insufficient evidence that an operation
  sorted its input.
- Verifier helpers are code and may need independent tests.
- A data definition that admits values outside the intended information domain
  should be repaired rather than left to names alone.
- A mechanically derived template can still be combined incorrectly.
- Failure artifacts can reveal a nearby operation that the code does implement;
  that observation must be turned into an explicit new purpose and contract.
- A generalized function may accept more inputs yet have a simpler definition.
- Subset compatibility justifies calling a broader-domain function with a
  narrower value, not the reverse.
- The initial polygon examples all use `MT`; therefore they do not independently
  verify the claim that rendering preserves an arbitrary supplied background.
  Figure 73's final composition threads `img`, but that behavior deserves a
  non-`MT` test.
- Cost-based preference for selectors over a recursive discriminator remains
  provisional until Intermezzo 5 supplies the cost model.

#### Developer Comparison

| Packaged claim or use | Source location | Preliminary decision |
| --- | --- | --- |
| Distinct tasks and cross-data-definition processing suggest collaborators. | §§11.2-11.3 | directly supported |
| Definition-time domain knowledge, case analysis, or recursive intermediate data may create new auxiliary pressure. | §11.2 | directly supported as informal guidelines |
| A maintained wish list enables incremental composition and testing. | §11.2 | directly supported |
| An intermediate invariant can strengthen a helper's reasoning and permit early termination. | §11.3, `insert` and sorted search | directly supported |
| A passing output property is enough to verify a transformation. | Exercise 186, `sort>/bad` | contradicted; the property must relate the particular input and output |
| Following the recipe guarantees a semantically correct combinator. | §11.4, failed `render-poly` | contradicted explicitly by the worked failure |
| A failed concrete solution may reveal a stable generalized operation. | §11.4, `connect-dots` | directly supported |
| Generalization always increases implementation complexity. | §11.4 | contradicted; broader `connect-dots` is simpler than the attempted polygon-only recursion |
| Generalization is valid when the original domain is a subset and the original result can be recovered by composition. | §11.4 | directly supported in the polygon case |
| Passing examples on one constant background verify arbitrary-background preservation. | §11.4 examples | unsupported; the examples do not vary `img` |

#### Provisional Repair Notes

- Add `sort>/bad` to the final verifier calibration: an output-only predicate can
  be green while a transformation ignores its input.
- Preserve helper preconditions such as “already sorted” as explicit contracts,
  not comments that disappear from derived guidance.
- Add the failed polygon renderer to composition guidance as evidence that
  templates inventory parts but do not choose a semantically correct combinator.
- Use `connect-dots` as a generalization candidate only with its subset argument,
  broader purpose, and reconstruction of the original result.
- Revisit abstraction-review's recipe cards after later abstraction chapters:
  this chapter supports failure-driven generalization but not automatic
  generalization from any awkward implementation.
- Consider arbitrary-background variation as a pass-but-wrong test-design case.

### Chapter 12: Projects: Lists

**Read:** complete Chapter 12, sections 12.1-12.8.

**Source anchor:** `part_two.html#%28part._ch~3aproj-lists%29`

**Visual and structural inspection:** dictionary and iTunes representations,
word-game composition and deep wish lists, the random-food recursion, the
multi-stage Worm and Simple Tetris screenshots, and the FSM representations and
simulation states. The six raster assets confirm Worm's single-segment,
near-food, and wall-collision states and Tetris's falling, landed, and
ceiling-reaching stacks. The Chapter 12 asset-manifest SHA-256 is
`b7e996b4c1d3bff8c9d1ed64537ba5b27551220d2dbf2b057141d79b5a5dc59c`.

#### Argument Reconstructed

Chapter 12 uses projects rather than another compact recipe. The projects
combine batch input, interactive state, composition, wish lists, structural
recursion, and iterative refinement. Their common method is to design against
small explicit examples, isolate acquisition of large or uncontrolled data, and
only then run the program on real collections or interactive worlds.

The dictionary project separates correctness work from scale work. Hundreds of
thousands of words should not become design examples. Once small examples give
credible behavioral evidence, the real dictionary becomes an application input.
If processing is too slow, the source recommends examining functions for
redundant computation; generative-recursion and cost analysis remain later
subjects.

The two `most-frequent` designs expose legitimate structural alternatives: scan
for the maximum directly or sort and select the first. Grouping words by first
letter introduces another tradeoff. Omitting empty groups simplifies the
consumer but needs a filtering auxiliary; retaining them simplifies production
but complicates the consumer. The intermediate grouped dictionaries may be
large and exist only to be counted. Fusion or deforestation can remove that
materialization, but the chapter recommends considering such removal in response
to actual performance pressure rather than replacing the clear composition
prematurely.

The iTunes project contrasts fixed and semi-structured representations. A
`Track` structure provides a stable eight-field schema and is constructed only
when all required information is legitimate. A list of key-value associations
preserves whichever attributes are available, including rare ones, at the cost
of weaker organization and lookup through keys and defaults. Both can be useful:
the flexible form supports exploration of uncertain information, after which a
checked conversion may create the stable structure where possible.

Large iTunes files are explicitly excluded from data and functional examples;
small `Date`, `Track`, and list examples are designed first. The project then
builds queries by selection, unique-value construction, date comparison, and
grouping. Comparing results from the structure- and list-based readers is a
diagnostic question, not an instruction to assume equality: the two
representations may retain different available records or attributes.

The word-game project begins from a high-level pipeline: represent the input as
letters, generate arrangements, convert them back to strings, and retain those
found in a dictionary. Examples reveal that an apparently natural atomic
`String` is wrong for the transformation's core operation; explicit adapters
keep strings at the external boundary and lists of one-character strings inside.
Composition is checked by matching each function's result contract to the next
function's input contract.

The intended result is set-like: word order is irrelevant, and repeated input
letters may produce duplicate arrangements that this exercise deliberately
accepts. `check-member-of` becomes unwieldy as valid result orderings multiply,
so `check-satisfied` checks required membership. The shown
`all-words-from-rat?` predicate, however, checks only that three expected words
occur. It would also accept extra invalid words and arbitrary duplicates. It is
evidence for required inclusion, not a complete specification of the result.

The arrangement generator illustrates a deep wish list. Structural recursion
produces all arrangements of the remaining letters; a collaborator must insert
the first letter into every position of every resulting word. Solving that wish
reveals further list-processing functions. The base case is crucial:
`(list '())` represents one arrangement of the empty word, whereas `'()` would
represent no arrangements and leave nothing into which later letters could be
inserted.

Worm is developed in stages: one moving segment, wall termination, a connected
multi-segment body, self-collision, then food and growth. Each stage changes one
behavioral slice and revises state and handlers as needed while reusing earlier
functions and tests. The project explicitly contrasts physical pixel coordinates
with logical segment coordinates; logical coordinates make changes in segment
size and canvas appearance less invasive.

Random food introduces generative recursion before its formal treatment. A
candidate equal to the previous food position is discarded and regenerated.
For `MAX > 1`, termination is probabilistic rather than justified by a
structurally smaller argument. The supplied property test establishes only that
the result differs from one forbidden position; it does not establish a bound on
retries, distribution quality, or avoidance of the entire worm.

Simple Tetris repeats the physical-versus-logical decision and chooses logical
block coordinates. Its prose says coordinates fall within board bounds but then
explicitly ignores that knowledge in the `Block` data definition, which uses
unrestricted natural numbers. Event functions must therefore maintain a product
invariant that the representation itself does not encode. The staged program
adds landing, new-block generation, legal horizontal movement, and ceiling
termination in separate increments.

The FSM project attempts to replace several near-duplicate recognizers with one
interpreter over transition data. It deliberately starts with a restricted
machine: any key advances the state, states are colors, and initial/final states
are absent. A more ambitious recognizer over key sequences is explicitly
deferred until backtracking because the principles available in Parts I-II are
insufficient. Generality is not accepted merely because it is attractive.

Simulation also exposes language expressiveness. The FSM description is
semantically constant during a run, but BSL+ handlers cannot close over it
locally. The work-around stores both the FSM and current state in every world
state. This representation computes the behavior but fails to express that one
component is invariant. The simulator also accepts an explicit initial state
because the transition list alone does not determine one. Later refinements add
key-sensitive transitions, then initial and final states, propagating these new
facts through data, examples, handlers, and stopping behavior.

#### Boundaries That Must Survive Derivation

- Large real data is application evidence, not a substitute for small,
  interpretable design examples.
- Correctness structure should be established before optimizing redundant
  traversals or intermediate allocations.
- Materialized intermediate data can clarify composition even when later fusion
  is economically justified.
- Fixed-schema and semi-structured representations preserve different kinds of
  evidence; neither is universally superior.
- Checked conversion from exploratory data to a stable structure may fail and
  must expose that failure.
- Differential results from two readers require explanation of retained data,
  not an automatic equality assertion.
- A representation suitable at an external boundary may be unsuitable for the
  core transformation; adapters can preserve both roles.
- Set-like output needs tests for exclusion and multiplicity policy as well as
  required membership.
- The empty combinatorial input can have one empty result rather than zero
  results; the composition identity must follow the problem meaning.
- Deep wish lists are acceptable when each newly discovered function has a
  concrete contract and closes a real dependency.
- Iterative refinement adds coherent behavior slices and propagates model changes;
  it is not merely editing until examples happen to pass.
- Random retry recursion lacks a structural decrease and carries probabilistic
  termination and distribution obligations.
- Logical coordinates reduce presentation coupling but still need enforceable
  board invariants somewhere.
- Semantically constant configuration may be forced into dynamic state by a
  weak language boundary; the workaround should not erase the distinction.
- A desired generalization must be deferred when the available design method
  cannot support it.
- Transition-list lookup must define what happens when no current state is found;
  the worked wish uses an explicit error.

#### Developer Comparison

| Packaged claim or use | Source location | Preliminary decision |
| --- | --- | --- |
| Begin large-data programs with small explicit examples and separate scale diagnosis. | §12.1 and §12.2 | directly supported |
| Intermediate structures should always be fused away. | §12.1, deforestation note | contradicted; removal is a performance response, not the default design |
| Flexible association data can precede a stable checked representation. | §12.2 | directly supported |
| Matching adjacent signatures is part of composition design. | §12.3, `alternative-words` | directly supported |
| Membership of all expected values completely verifies set-like output. | §12.3, `all-words-from-rat?` | unsupported; extras and duplicate policy remain unchecked |
| Recursive combinators need a semantically correct identity base. | §12.4, `arrangements` | directly supported |
| Iterative refinement changes state and collaborators one coherent feature at a time. | §§12.5-12.8 | directly supported |
| Random retry is structural recursion because it eventually returns a candidate. | §12.5, `food-create` | contradicted; the source labels it generative recursion |
| A logical representation automatically enforces logical bounds. | §12.6 | contradicted by the explicitly ignored coordinate constraints |
| Configuration carried in world state is necessarily dynamic product state. | §12.8 | contradicted; the FSM remains constant and is carried only as a BSL+ work-around |
| Every useful generalization should be implemented immediately. | §12.8, deferred recognizer | contradicted; the more general recognizer waits for backtracking techniques |

#### Provisional Repair Notes

- Add `all-words-from-rat?` beside `sort>/bad` in verifier calibration: required
  membership alone permits extra and duplicate results.
- Preserve deforestation as a measured optimization option, not a default
  objection to intermediate data contracts.
- Use iTunes fixed-versus-semi-structured representations to calibrate
  representation choice under incomplete information.
- Add `(list '())` as a recursion-base case where the identity denotes one empty
  construction rather than no constructions.
- Defer final treatment of random retry to the generative-recursion chapters and
  of cost/fusion to Intermezzo 5.
- Distinguish dynamic world state from semantically invariant configuration even
  when a language limitation forces both into one structure.
- Add the deferred FSM recognizer as evidence that abstraction timing depends on
  available method and proof obligations, not only duplication pressure.

### Chapter 13: Summary

**Read:** complete Chapter 13.

**Source anchor:** `part_two.html#%28part._ch~3asummary2%29`

**Visual inspection:** no chapter-specific raster assets. The chapter is a prose
synthesis of Part II and was checked against the completed Chapters 8-12 audit.

#### Argument Reconstructed

Part II extends systematic design from fixed-size data to information with no
prespecified size bound. Its first lesson is structural: self-references in data
definitions call for recursive processing, while cross-references call for
collaboration with processing appropriate to the referenced definition.

Its second lesson is decomposition plus composition. A complex problem is split
into separate problems, but independent functions are only half the design. The
data definitions that communicate intermediate results must also be specified,
and wish-list entries need those data contracts before collaborators are built
in isolation. Otherwise individually plausible functions may not compose.

The summary names three recurring decomposition triggers: the requirement names
auxiliary tasks; definition completion discovers that another arbitrarily large
value must be traversed; or a broader problem is easier to state and solve than
the requested special case. The polygon case supplies the final trigger's
calibration: broader domain, simpler purpose, explicit subset compatibility, and
a small reconstruction of the original operation.

Its third lesson is pragmatic. Systematic design does not replace knowledge of
the execution framework, the problem domain, or available mathematical and
library operations. Correct use of `big-bang` requires understanding its
clauses; mathematical software requires knowing which relevant operations the
language supplies.

Lists are the teaching vehicle rather than the boundary of the method. The same
self-reference, decomposition, communication-data, and composition reasoning is
claimed to extend to files, folders, databases, and other arbitrarily large
data. Intertwined Data is explicitly left to Part IV, where several large data
definitions interact more deeply.

#### Boundaries That Must Survive Derivation

- “A self-reference calls for recursion” means recursion at the corresponding
  structural position; it does not classify every call on a merely smaller or
  transformed value as natural recursion.
- “A cross-reference calls for an auxiliary” includes an existing primitive or
  reusable collaborator satisfying the referenced contract; it does not require
  a freshly written wrapper for every nested value.
- Decomposition is incomplete without explicit communication data and compatible
  contracts between the resulting functions.
- Wish-list signatures and data definitions are prospective integration checks,
  not documentation added after implementation.
- Generalization is one conditional decomposition route, not the default answer
  to every failed or awkward definition.
- Framework and domain knowledge remain correctness dependencies even when the
  structural recipe has been followed exactly.
- Claims about intertwined data, generative recursion, backtracking, local
  expressiveness, and computational cost remain deferred to their later units.

#### Part II Cumulative Assessment

Part II supports the packaged distinction between data-shape-derived structure
and purpose-derived behavior, with several important limits. Data definitions
determine alternatives, selector inventory, direct recursive positions, and
cross-definition boundaries. They do not choose the correct combinator, decide
which selectors an implementation needs, guarantee that a broad host type meets
the product domain, or prove that tests establish the intended transformation.

The part also supplies a stronger account of composition than “split into small
functions.” A valid decomposition preserves task meaning, declares intermediate
data, records collaborator preconditions, and checks that adjacent contracts
connect. Composition-boundary failures, sorted-input invariants, set-like output,
and representations that omit needed distinctions all show how individually
green functions can still form a wrong program.

Generalization is supported as a failure-driven move when the failed artifact
reveals a coherent broader purpose and the original result can be recovered.
Part II simultaneously provides a timing counterexample: the generalized FSM
recognizer is deferred because the current methods cannot support its search
behavior. Thus pressure toward generality and readiness to implement it are
separate judgments.

Verification evidence remains claim-relative throughout the part. Expression
coverage and passing examples can miss wrong-reason stubs, output-only sort
properties, extra set members, arbitrary-background behavior, state retained
after disappearing visually, or representation adaptation in a caller. These
cases materially support the package's pass-but-wrong calibration, subject to
exact source anchoring after the whole-book audit.

#### Developer Comparison

| Packaged claim or use | Source location | Preliminary decision |
| --- | --- | --- |
| Self-reference, cross-reference, and task decomposition are distinct design pressures. | Chapter 13, lessons 1-2 | directly supported |
| Function decomposition is complete without specifying intermediate data. | Chapter 13, lesson 2 | contradicted explicitly |
| Wishes should carry the data contracts needed for later composition. | Chapter 13, lesson 2 | directly supported |
| Traversal of another arbitrary-size value may create an auxiliary task. | Chapter 13, lesson 2 | directly supported |
| A broader problem can sometimes be easier than the requested one. | Chapter 13, lesson 2 | directly supported, conditional rather than universal |
| Structural method eliminates the need for framework, library, and domain knowledge. | Chapter 13, lesson 3 | contradicted explicitly |
| List-specific templates are the final scope of the design method. | Chapter 13 closing | contradicted; the method is intended to transfer to other arbitrarily large data |

#### Provisional Repair Notes

- Use Chapter 13 as the direct source for the decomposition contract: separate
  functions plus explicit communication-data definitions.
- Keep the package's purpose-relevant implementation adaptation separate from
  HtDP's full template inventory and per-data-definition template rule.
- Do not flatten direct structural recursion, transformed-input recursion, and
  random retry into one “recursive data” category.
- Preserve generalization pressure separately from scheduling readiness.
- Carry all Part II verifier counterexamples into the final whole-book repair
  queue, but wait for later specification and abstraction chapters before
  choosing final wording.

## Intermezzo 2: Quote, Unquote

**Read:** complete Intermezzo 2, including `Quote`, `Quasiquote and
Unquote`, and `Unquote Splice`.

**Source anchor:** `i2-3.html#%28part._i2-3%29`

**Visual and structural inspection:** quote-to-`list` and `cons` expansions,
nested table data, symbol-valued expressions, the HTML page representation in
Figure 84, row and cell construction, splicing, and the generated first-page and
ranking screenshots. The browser images confirm that repeated title holes and
spliced table cells reach the displayed HTML structure. The Intermezzo 2
asset-manifest SHA-256 is
`f003984cdb6221870e4e9dd841c4efa5404c683bc1c79c066d2c885750f03dc3`.

### Argument Reconstructed

Quotation is introduced as compact construction notation, not a new collection
model. A quoted list expands recursively into `list` constructions and
ultimately into `cons`. This surface notation makes large nested data readable,
but the source intentionally teaches `cons` first because quotation hides the
step-wise construction knowledge needed to design recursive list functions.

Quotation changes the status of identifiers and expressions. In
`'(40 41 x 43)`, `x` is the symbol `'x`, not the value of the variable `x`.
Likewise, `'(+ 1 1)` represents a list whose first item is the symbol `'+`; it
does not apply the bound addition function. Symbols are values suitable for
representing names and symbolic information, while variables are references to
values. Similar spelling does not imply evaluation or binding identity.

Quasiquote retains quoted structure but permits selected escapes into ordinary
computation. Unquote evaluates one expression and inserts its resulting value at
one position. This creates a template-like construction surface: fixed symbols
and nesting define stable structure, while parameters or expressions fill
explicit holes. The HTML example inserts one title into two different locations
and an author into another while preserving the surrounding page shape.

Here “template” means a data-construction skeleton with holes. It is distinct
from the function templates derived from data definitions in Parts I-II. The
page skeleton helps construct one deeply nested value; it does not by itself
derive traversal, branches, recursion, or a behavioral contract.

Unquote and unquote-splicing have different shape contracts. Ordinary unquote
inserts a list result as one nested item. Splicing inserts that result's items
into the surrounding list. For an HTML row, unquoting `make-row` would produce a
row containing one list of cells; splicing produces a row whose remaining items
are the cells themselves. The choice is therefore semantic structure, not mere
formatting convenience.

The web examples show code producing a nested-list representation that another
system interprets as HTML. Symbols mark vocabulary such as `html`, `head`, `tr`,
and `td`; strings and generated lists supply content and repeated structure.
The browser screenshot validates one downstream rendering, while the explicit
nested-list expansion preserves evidence about the actual interchange shape.

The ranking exercise supplies a deliberately indirect `reverse`/`length`
solution and points ahead to accumulators for a simpler design. The intermezzo
does not use the terser syntax as evidence that the underlying traversal or cost
has disappeared; notation, representation, process, and cost remain distinct.

### Boundaries That Must Survive Derivation

- Quote, quasiquote, and splicing are construction forms over list structure;
  they do not introduce a new abstract collection.
- Quoted identifiers are symbol data, not lookups of same-spelled variables or
  functions.
- Quoted expression-shaped data is not executed merely because it resembles
  source code.
- Unquote inserts one computed value; unquote-splicing requires a list-shaped
  result and inserts its elements at the surrounding level.
- Compact syntax may improve authoring while obscuring the constructor structure
  needed for recursive design.
- A quasiquoted data skeleton and a data-definition-derived function template
  are different concepts despite sharing the word “template.”
- Browser appearance is useful integration evidence but does not replace checking
  the nested interchange representation.
- Repeated holes may intentionally share one value; their multiplicity is part
  of the generated artifact's contract.
- Concise notation does not imply a cheaper runtime process.

### Developer Comparison

| Packaged claim or use | Source location | Preliminary decision |
| --- | --- | --- |
| Surface notation should remain distinguishable from underlying constructors. | `Quote` | directly supported |
| Identifier-shaped data and bound operations have the same semantics. | `Quasiquote and Unquote` | contradicted explicitly by symbols |
| A fixed data skeleton may expose explicit computed holes. | Figure 83 | directly supported for construction templates |
| All objects called templates derive control flow from data definitions. | Figure 83 and surrounding prose | contradicted; quasiquote templates construct data rather than derive functions |
| Nested insertion and splicing are interchangeable. | `Unquote Splice` | contradicted; they produce different list shapes |
| A generated artifact can cross into another interpreter through an explicit data representation. | Figures 83-85 | directly supported |
| Shorter construction syntax proves lower computational cost. | closing ranking exercise | unsupported; accumulator treatment is deferred |

### Provisional Repair Notes

- Keep “function template,” “construction template,” and “intermediate data
  representation” terminologically distinct in final packaged wording.
- Add ordinary insertion versus splicing as a shape-contract calibration case if
  the final template catalog discusses variadic or repeated children.
- Use symbol-versus-binding as a representation-boundary example only where the
  relevant route concerns code-shaped data or languages.
- Defer all cost conclusions about `reverse`, repeated `length`, and ranking to
  Intermezzo 5 and Accumulators.

## Part III: Abstraction

**Part opening read:** complete. The opening identifies copied similarity as a
maintenance hazard: defects and later data-definition changes must be repaired
across every copy. It presents abstraction as an editing process applied after a
working draft, potentially over several iterations, and distinguishes creating
an abstraction from using one already supplied by the language.

**Source anchor:** `part_three.html#%28part._part~3athree%29`

### Chapter 14: Similarities Everywhere

**Read:** complete Chapter 14, sections 14.1-14.5.

**Source anchor:** `part_three.html#%28part._ch~3add-similarities%29`

**Visual and structural inspection:** side-by-side `contains-dog?` and
`contains-cat?`, `small` and `large`, and `inf` and `sup`; their abstracted
forms; parametric list, pair, nested-layer, non-empty-list, and `Maybe` data
definitions; and the substitution traces for function-valued arguments. All
figures in this chapter are HTML-native code or tables; there are no
chapter-specific raster assets.

#### Argument Reconstructed

Functions over the same data definition inherit the same basic template, so
similarity is expected. The first abstraction replaces the only varying string
in two membership functions with an additional parameter. The original
functions are then reconstructed as one-line specializations, while the new
function also supports values not named by either original.

The second example varies an operation rather than an atomic value. `small` and
`large` share traversal and result construction but use `<` and `>` at one
position. `extract` turns that varying operator into a function-valued
parameter. Its contract is behavioral: the supplied function consumes an item
and threshold and decides whether the item is retained. Built-in comparisons and
a newly designed `squared>?` can occupy that role.

These examples establish two checks on a proposed functional abstraction. It
must reconstruct the original behaviors using explicit arguments, and its
parameter contract must admit coherent additional uses. Shorter specialized
functions are not the main benefit. Shared correction, performance improvement,
and energy improvement become possible through one point of control.

The `inf` and `sup` exercise places a limit on this benefit. Their first forms
compute the same recursive result more than once. Abstracting those forms can
centralize the duplicated process without removing it. Revising the combination
to `min` or `max` avoids repeated recursion, after which a second abstraction
shares the improved structure. Result equivalence does not imply equivalent
process cost.

Similarity also occurs between data definitions. A parametric data definition
replaces a varying referenced data class with a parameter. `[List-of ITEM]`
abstracts over the element class while retaining empty and recursive list shape;
`[CP H V]` abstracts independently over two structure fields. These parameters
range over classes of values, not individual runtime values.

Instantiation validates a parametric definition by substituting concrete data
classes and checking that the ordinary definition is recovered. Parametric
definitions compose: lists may contain instantiated pairs, and a pair field may
itself contain a list. The nested notation preserves which structural layer owns
each parameter.

ISL supports functional abstraction by treating functions and primitive
operations as values. Function names can appear as arguments or list items, and
a parameter may appear in application position. Evaluation still uses
substitution: a function-valued argument replaces the parameter, including in
operator position, and ordinary evaluation continues.

The chapter closes an important verification boundary. Two functions may be
compared at three selected inputs, but mathematical function equality quantifies
over every possible input. No finite sample establishes that universal claim,
and a general `function=?` cannot be defined merely by extending the sampled
checker.

#### Boundaries That Must Survive Derivation

- Similarity is first observed in concrete definitions; abstraction turns the
  corresponding differences into parameters.
- Shared shape alone does not identify a parameter contract. The differing
  values or operations must occupy corresponding semantic roles.
- A higher-order parameter is constrained by what inputs the abstraction gives
  it and what result the abstraction needs from it.
- Reconstructing old functions is compatibility evidence, not proof over all
  possible inputs.
- Novel uses demonstrate additional utility only when they satisfy the same role
  contract.
- A single point of control exists only after clients actually delegate to the
  abstraction; untouched copies remain independent maintenance sites.
- Abstraction can preserve a duplicated or expensive process. Behavioral reuse
  and process improvement are separate moves.
- Parametric data-definition parameters denote data classes; function parameters
  denote runtime values, including function values.
- Instantiation must preserve recursive references and field ownership, not just
  replace words textually in isolated positions.
- Functions being values does not make extensional function equality decidable
  from finitely many observations.
- The part opening advocates eliminating copied similarity after drafting, but
  later chapters must still supply the method and limits for deciding which
  similarities form useful abstractions.

#### Developer Comparison

| Packaged claim or use | Source location | Preliminary decision |
| --- | --- | --- |
| Repeated corresponding definitions create maintenance pressure. | Part III opening and §14.1 | directly supported |
| Functional abstraction replaces concrete variation with parameters. | §§14.1-14.2 | directly supported |
| A candidate should be able to reconstruct its motivating examples. | §§14.1-14.2 | directly supported by specialization tests |
| Parameterizing an operation requires a behavioral role contract. | §14.2, `extract` | directly supported in use, with formal signatures deferred to Chapter 15 |
| One shared implementation creates a correction and optimization control point. | §14.2 | directly supported after clients delegate |
| Extracting common structure automatically improves runtime cost. | Exercise 238 | contradicted; the first abstraction preserves repeated recursion |
| Parametric data definitions abstract classes independently of runtime values. | §14.3 | directly supported |
| A few matching observations establish equality of two functions. | §14.4, Exercise 245 | contradicted explicitly |
| Function-valued arguments require an entirely unrelated evaluation model. | §§14.4-14.5 | contradicted; substitution is extended to function values and operator position |

#### Provisional Repair Notes

- Use the concrete-difference-to-parameter move and reconstruction of original
  functions when checking `recipe-cards.md` after Chapter 15.
- Keep “single point of control” conditional on actual delegation and do not
  treat mere helper existence as consolidation.
- Add first-pass `inf`/`sup` abstraction as a case where structural cleanup can
  preserve a costly process.
- Add finite sampled function equality to verifier calibration as evidence for a
  bounded claim only.
- Preserve the distinction between parametric data classes and higher-order
  runtime function parameters in the final template catalog.

### Chapter 15: Designing Abstractions

**Read:** complete Chapter 15, sections 15.1-15.4.

**Source anchor:** `part_three.html#%28part._ch~3aabstract%29`

**Visual and structural inspection:** the `cf*`/`names` comparison and staged
`map1` abstraction; `tabulate`, `fold1`, and `fold2` source pairs; the four
signature-correspondence diagrams; the single-point-of-control guideline; and
the direct `reduce` abstraction from the list template. The diagrams confirm
that signature parameters follow connected semantic correspondences rather than
same-spelled concrete types alone. The Chapter 15 asset-manifest SHA-256 is
`6fa9a89a51367b5c2b8d2ade3959eecfe5a50c652ebf70fddb9f18fa0418ff45`.

#### Argument Reconstructed

Chapter 15 turns the previous chapter's examples into an explicit abstraction
recipe. Begin with two concrete definitions, compare them, and mark differences
at analogous positions. Differences in function and parameter names are treated
as inessential. Corresponding concrete values or operations are connected, and
one parameter is introduced for each relationship rather than for each textual
occurrence.

Every occurrence in a correspondence is replaced consistently, including
recursive calls, which must carry the new parameters. The resulting definitions
are renamed to expose that their structure is now identical. In the `cf*` and
`names` example, the per-item operation becomes one function parameter and the
shared traversal becomes `map1`.

Validation reconstructs each motivating function as a specialization of the
abstraction and reruns its existing tests. The stated semantic target is
behavioral equivalence for every valid original input; copied test suites provide
finite regression evidence toward that target. Additional coherent uses—such as
mapping `add1` or extracting inventory prices—strengthen the claim that the
parameterized operation is useful beyond its two source examples. A library
search should follow because a mature version may already exist.

A reusable abstraction requires a signature general enough to connect all of
its roles. Signatures describe classes of functions and can themselves be
abstracted. In `map1`, `X` links list elements to the input of the supplied
function; `Y` links that function's output to result-list elements:
`[List-of X] [X -> Y] -> [List-of Y]`. These repeated variables express
relationships, not placeholders chosen independently at each occurrence.

The `fold2` derivation makes the correspondence rule sharper. In `product`, the
concrete type `Number` occupies both element and accumulated-result positions.
In the analogous image function those positions are `Posn` and `Image`.
Therefore the abstract signature needs two variables, `X` and `Y`, even though
one motivating signature happened to spell both as `Number`. Cross-example role
alignment determines parameter identity; textual equality in one example does
not.

Abstract signatures are checked in two ways. Substitution should recover each
concrete revised signature. The generalized signature must also agree with the
body: callback arity, argument classes, result class, base value, and final
result use must line up. ISL treats these signatures as informal, while other
languages may check and further constrain them before execution.

The chapter names single point of control as the main maintenance benefit and
states a strong rule: form an abstraction instead of copying and modifying code.
Once clients delegate, a defect fix, new supported case, or process improvement
has one owner. The claim presupposes successful migration and a sound shared
contract; an abstraction beside untouched copies does not provide that control.

Finally, abstraction need not wait for two finished functions. The list template
has a base-result gap and a recursive-combination gap. Turning those gaps into a
base parameter and an `[X Y -> Y]` function yields `reduce`. `sum` and `product`
then instantiate it with distinct identity values and combiners. This is a
direct abstraction over a known template family rather than a comparison of
accidental application code.

#### Boundaries That Must Survive Derivation

- Corresponding differences must occupy analogous roles; unrelated textual
  differences should not be forced under one parameter.
- One relationship produces one parameter, even when it has several occurrences.
- Newly introduced parameters must be threaded through recursive calls.
- Original-function reconstruction and old tests establish compatibility only for
  the exercised cases, not universal equivalence by themselves.
- Extra uses support usefulness only if they obey the same generalized signature
  and purpose.
- Signature variables encode equality relationships among positions. They cannot
  be renamed or split independently without changing the contract.
- Same concrete type in multiple positions does not prove those positions belong
  to one abstract type variable.
- A higher-order signature must remain synchronized with callback use in the
  implementation.
- Single point of control is an ownership result after delegation, not a property
  of merely extracting a helper.
- `reduce` abstracts the list-template family with one base value and one
  first-item/recursive-result combination. It is not evidence that every
  list-processing purpose fits that exact interface.
- The chapter's anti-copy rule and automatic template abstraction are strong
  source positions. Whether the packaged workflow applies them unconditionally
  or adds stability and timing gates is an adaptation to be marked explicitly.

#### Developer Comparison

| Packaged claim or use | Source location | Preliminary decision |
| --- | --- | --- |
| Compare concrete definitions, connect corresponding differences, and parameterize each relation. | §15.1 | directly supported |
| Recursive calls must carry newly abstracted parameters. | §15.1 | directly supported |
| Reconstruct motivating functions and rerun their tests. | §15.1 | directly supported as the chapter's validation method |
| Passing copied tests proves universal behavioral equivalence. | §15.1 | unsupported; the prose states a universal target but tests are finite |
| General signatures preserve relationships among element, callback, accumulator, and result roles. | §15.2 | directly supported |
| Repeated concrete types always collapse to one signature variable. | §15.2, `fold2` | contradicted explicitly by the correspondence diagrams |
| Single point of control follows from shared ownership and client delegation. | §15.3 | directly supported, with migration as a necessary operational condition |
| Template gaps can become explicit higher-order parameters. | §15.4, `reduce` | directly supported |
| Every list behavior should be represented by the shown `reduce` interface. | §15.4 | unsupported; the source derives it from a specific template shape and says it defines many functions |
| All copied similarity should be abstracted without a separate timing judgment. | §15.3 and §15.4 | directly advocated by this chapter; any package-level qualification must be labeled adaptation |

#### Provisional Repair Notes

- Compare `recipe-cards.md` against the full four-part sequence: corresponding
  examples, parameterization, reconstruction tests, and generalized signature.
- Add signature-role diagrams to the final derivation for stable parameter
  relationships; do not infer type-variable identity from one concrete example.
- State that regression reuse is necessary compatibility evidence but not a proof
  of universal equivalence.
- Preserve the package's stability/timing review, if retained, as an explicit
  adaptation to HtDP's stronger anti-copy and automatic-template guidance.
- Scope direct template abstraction to interfaces whose base and combination
  roles actually match the desired computations.

### Chapter 16: Using Abstractions

**Read:** complete Chapter 16, sections 16.1-16.8.

**Source anchor:** `part_three.html#%28part._ch~3a3use%29`

**Visual and structural inspection:** signatures and abstract examples for
`build-list`, `filter`, `sort`, `map`, `andmap`, `ormap`, `foldr`, and `foldl`;
the address-list pipeline; progressively scoped `local` definitions; the shared
recursive result in `inf.v2`; FSM closure organization; local-renaming and
lifting traces; and the empty 200-by-200 scene used in the abstraction-selection
recipe. Figures 115-122 are tiny visual separators between lifted definitions
and expressions, not semantic diagrams. The Chapter 16 asset-manifest SHA-256
is `7103da3e7b99aa1f4a11672fa42dc12e0b13662504e8992be448c4d159a0b76d`.

#### Argument Reconstructed

Existing, well-known abstractions should be preferred when their purposes and
signatures match because they centralize traversal and communicate intent more
directly than a custom recursive definition. The chapter distinguishes common
list processes: `map` preserves one result per item, `filter` retains selected
items, `sort` reorders, `andmap` and `ormap` reduce predicates universally or
existentially, and folds combine items with a base value.

A signature match supplies candidates, not the final choice. `map`, `filter`,
and `sort` can all consume and produce lists, but only `map` matches a purpose
that transforms every point and preserves list cardinality. Boolean output
narrows a search to `andmap` or `ormap`, while “any” versus “every” selects the
quantifier. Purpose, examples, cardinality, order, and result meaning refine the
structural match.

`foldr` and `foldl` expose combination direction. Their results agree for some
operators but differ for non-associative or order-sensitive composition. A base
value and callback signature are therefore insufficient to choose between them;
the desired association and observable ordering must also be checked. The
chapter defers from-scratch accumulator-based designs for operations such as
`foldl`.

The `listing` example composes `map`, `sort`, and `foldr` into an explicit data
pipeline: extract first names, order them, then concatenate. Each adjacent result
and input signature agrees. A small custom combiner remains where the library
cannot express the exact string formatting directly.

`local` expresses ownership, scope, and data flow. Intermediate values can name
steps in a deeply nested expression; a subordinate helper can be visible only to
the step that needs it; and mutually related sorting helpers can share one
private context. A local helper may refer to enclosing parameters, so `cmp` or an
FSM description remains fixed across a traversal without being threaded through
every helper call.

Locality is also a contract boundary. A private `insert` is visibly tied to the
sorting process whose invariant gives “sorted” its meaning, discouraging
out-of-context reuse. Conversely, a collaborator with broad independent utility
should remain outside rather than being hidden merely because one caller uses
it. Scope should reflect ownership, not just call count.

A local constant evaluates its right-hand side once and allows several uses of
the result. In `inf.v2`, naming the recursive result prevents a path from
recomputing the entire suffix and materially changes the process. Mere textual
duplication does not always imply this benefit: in `extract1`, duplicated
recursive expressions occupy exclusive conditional branches, so only one is
executed on a call. Sharing and performance claims require control-flow
analysis, not just matching text.

The FSM example confirms the expressiveness point deferred from Part II. A local
key handler closes over the invariant FSM while the world state contains only
the changing current state. This organization makes the model's constant versus
dynamic distinction visible in code. The language's scoping constructs affect
whether the design insight can be represented directly.

Operationally, the chapter explains `local` through fresh renaming and lifting.
Local names are first made globally unique, then definitions are lifted and the
body is evaluated in their place. Fresh names prevent unrelated activations or
nested locals from being conflated. A local expression may itself produce a
function value.

The reuse recipe begins with signature, purpose, examples, and a stub. It then
selects an abstraction whose purpose is more general and whose signature can be
instantiated to the desired result. A local template records the chosen
abstraction and a helper stub inferred from its parameter role. The helper is
designed using its own inputs, global constants, and invariant enclosing
parameters; the completed composition is then tested, optionally using the
abstraction's algebraic example to predict the process.

#### Canonical Source Defects Observed

The living build contains three apparent code-transcription defects in §16.4 and
§16.5. They are recorded so packaged guidance does not inherit them:

- After substituting `AN-FSM`, the fresh local handler body is printed twice as
  `(find AN-FSM a-state)` even though its parameter is `s`; the faithful
  substitution is `(find AN-FSM s)`.
- One intermediate `inf` lifting display refers to `smallest-in-rest-3` in the
  outer conditional before that name is defined; the surrounding derivation and
  next display use `smallest-in-rest-1`.
- The completed `good?` helper is annotated `Posn -> Posn` even though `filter`
  and its Boolean body require `Posn -> Boolean`; the earlier stub and prose give
  the latter signature.

These are local presentation errors, not support for alternate scoping or
signature rules.

#### Boundaries That Must Survive Derivation

- Reuse requires both a purpose match and a valid signature instantiation.
- Same input/output outer shape does not distinguish mapping, filtering, sorting,
  quantification, or folding.
- Fold direction matters whenever combination is not observationally independent
  of association and order.
- Local definitions can expose sequential data flow, private collaboration, or
  captured invariant context; these are distinct reasons for locality.
- A helper should not be localized if it has stable independent utility outside
  the caller.
- Naming an expression changes cost only when the original control flow could
  evaluate the expression more than once.
- Capturing an enclosing parameter signals that it remains invariant for that
  helper activation; mutable-language adaptations need an equivalent guarantee
  or an explicit caveat.
- Language expressiveness can force configuration into state or allow the code to
  preserve the model distinction directly.
- Fresh renaming is necessary when reasoning about lifted local definitions.
- Tests retained during abstraction-based rewrites protect only the behavior they
  exercise; the source's statement that tests prevent mistakes must remain
  claim-relative.
- Abstract examples explain general mechanics but do not replace product-specific
  tests.

#### Developer Comparison

| Packaged claim or use | Source location | Preliminary decision |
| --- | --- | --- |
| Prefer a known abstraction when purpose and signature both match. | §§16.1 and 16.6 | directly supported |
| Outer signature shape alone selects the correct abstraction. | §§16.5-16.6 | contradicted by the map/filter/sort and andmap/ormap comparisons |
| Intermediate names can expose a composition pipeline. | §16.2, `listing.v2` | directly supported |
| Scope can encode private ownership and invariant context. | §§16.2-16.3 | directly supported |
| Localizing any repeated expression necessarily improves performance. | Figures 100-101 | contradicted; branch exclusivity matters |
| Captured configuration can remain distinct from dynamic world state. | §16.3, FSM simulation | directly supported |
| Abstraction reuse can be designed by matching purpose, signature variables, and helper role. | §16.6 | directly supported |
| Existing tests make an abstraction-based rewrite risk-free. | §16.8 | overstated if read universally; supported only for covered behavior |
| All custom recursive code should be replaced based only on the presence of a library traversal. | §§16.6-16.8 | unsupported; semantic matching and tests remain required |

#### Provisional Repair Notes

- Compare `recipe-cards.md` with §16.6's exact reuse sequence and preserve both
  purpose and signature matching.
- Add map/filter/sort and andmap/ormap as contrast sets for abstraction selection.
- Add duplicated syntax in mutually exclusive branches as a counterexample to
  automatic “name once for performance” advice.
- Use local `insert` and the FSM handler to distinguish ownership scope from
  invariant-context capture.
- Preserve fold direction and base semantics in any packaged composition catalog.
- Exclude the three canonical transcription defects above from all final source
  derivations.

### Chapter 17: Nameless Functions

**Read:** complete Chapter 17, sections 17.1-17.5.

**Source anchor:** `part_three.html#%28part._ch~3a3lambda%29`

**Visual and structural inspection:** lambda syntax and direct applications,
function-definition expansion, beta-value substitution, non-terminating self
application, local-to-lambda rewrites, the curried sorted-list predicates,
progressively strengthened sorting specifications, predicate-based shape
representations, distance formulas, and the rocket image-stream example. The
Chapter 17 asset-manifest SHA-256 is
`985bc6126c277e5a40a331146734098ac0b6508aee2c8b36097c5589d7245068`.

#### Argument Reconstructed

Lambda is introduced as a lightweight way to construct a function where an
abstraction requires one. It is especially useful for short, context-specific
callbacks that would otherwise need a multi-line local definition. Operationally,
a lambda is equivalent to a local function with a fresh inaccessible name, and a
named function definition can be understood as a constant definition whose value
is a lambda.

Naming and namelessness serve different ownership needs. A function used from
several places should not be repeated as lambda syntax, and recursion normally
needs a stable name. A short callback can remain inline when its role is evident
from the receiving abstraction and its body. If the callback is long or its
purpose needs explanation, a named local function is easier to understand. The
chapter recommends designing with local first when uncertain, then converting
the tested result to lambda.

Lambda does not change the core application rule. Arbitrary expressions may now
appear in function position and can evaluate to function values. Applying a
lambda substitutes argument values for its parameters and evaluates the body.
Self-application demonstrates a new process boundary: legal function-valued
syntax can produce a computation that never reaches a value.

The specification section turns function-producing functions into verifier
factories. `sorted` consumes a comparison and returns a list predicate;
`sorted-variant-of` additionally captures the original input so the produced
predicate can relate a candidate output to that input. Since function values
cannot be compared extensionally, these factories are tested by applying their
results to representative values.

The sorting specification is strengthened through explicit counterexamples.
Checking only order accepts a constant unrelated sorted list. Requiring every
input item to occur in the output catches omissions but accepts extra items.
Adding membership in both directions catches extras at the set level but still
ignores duplicate multiplicity. Each green counterexample reveals one omitted
part of the transformation contract.

Random generation broadens exercised examples but does not convert a test into a
universal claim. A generated list of 500 numbers is described as “almost like” a
quantified statement, while the source reserves correctness for a theorem that
the implementation satisfies its specification for all inputs. Even that theorem
is only as strong as the specification: the mutual-membership sorting predicate
remains wrong for duplicates.

The `random-posns` exercise makes the same point for nondeterministic behavior. A
predicate that checks result length and coordinate bounds can be satisfied by a
non-random implementation. Shape and range properties do not establish
randomness, distribution, independence, or variation across runs.

The final section uses functions as intensional data representations. A `Shape`
is a predicate from points to Booleans; constructor-like functions create point,
circle, and rectangle predicates by capturing parameters; `inside?` observes the
representation; and combination constructs a predicate that uses logical `or`.
The data records how to decide membership rather than enumerating every member.

This representation supports infinite or impractically large information such
as image streams and mathematical sets. Examples cannot compare represented
functions directly, so they apply an observer at included, excluded, and boundary
points. The source also notes that a self-referential shape representation is a
valid alternative and that function-represented streams require design concepts
beyond those supplied in this book. First-class functions expand the
representation space but do not make the usual recipe automatically sufficient.

#### Canonical Source Defects Observed

Two additional apparent transcription defects occur in the worked lambda
examples:

- The opening `find` function is twice annotated
  `[List-of IR] Number -> Boolean`, but its body calls `filter`, its prose says it
  finds all matching items, and its value is a list. The result contract should
  be `[List-of IR]`.
- The lambda rewrite of `close?` calls `close-to`, while the source function it
  explicitly revises is named `close-to?`. No intervening rename is introduced.

These do not alter the chapter's higher-order or specification argument.

#### Boundaries That Must Survive Derivation

- Lambda is a function-construction convenience, not a reason to erase a useful
  callback name or purpose boundary.
- Inline suitability depends on callback size, role clarity, reuse, and recursive
  needs rather than an arbitrary line count.
- Captured values remain part of a function value's behavior even though they are
  absent from its explicit parameter list.
- Legal higher-order evaluation need not terminate.
- Function-producing functions must be tested through observable applications,
  not direct function equality.
- An output-only invariant does not specify a transformation.
- One-way containment checks omission but not addition; two-way membership still
  loses multiplicity.
- Randomized examples increase case diversity but neither quantify over all
  inputs nor prove a distributional claim.
- Correctness relative to an incomplete specification can certify the wrong
  product behavior.
- Function-backed representations need an interpretation and behavioral
  observers because structural equality is unavailable or irrelevant.
- Predicate representation preserves membership behavior but may omit other
  desired properties such as geometric decomposition, serialization, or finite
  enumeration.
- Easy tests for a function-backed stream do not imply that the available design
  method explains the interactive program that consumes it.

#### Developer Comparison

| Packaged claim or use | Source location | Preliminary decision |
| --- | --- | --- |
| Short context-specific callbacks may be expressed inline. | §§17.1 and 17.3 | directly supported |
| Lambda should replace named helpers regardless of size or explanatory value. | §17.3 | contradicted explicitly |
| Verifier factories can capture inputs and configuration to check a later result. | §17.4 | directly supported |
| Sorted output alone specifies a sorting transformation. | §17.4, `sort-cmp/bad` | contradicted explicitly |
| Mutual membership completely specifies sorting. | §17.4, duplicate counterexample | contradicted explicitly |
| Property checks and generated examples amount to a universal correctness proof. | §17.4 | contradicted; proof of a theorem is distinguished from testing |
| Range and length properties verify random generation. | Exercise 295 | contradicted by the requested bad implementation |
| Functions can act as abstraction-barrier representations observed through domain operations. | §17.5, `Shape` | directly supported |
| A first-class-function representation automatically fits the established design recipe. | Exercise 298 note | contradicted explicitly for the stream/world case |

#### Provisional Repair Notes

- Use the full sorting-specification escalation in verifier provenance: order,
  preservation, no additions, then duplicate multiplicity.
- Keep generated property tests classified as broad finite evidence rather than
  universal or distributional proof.
- Add function-backed `Shape` to abstraction-barrier calibration, with observer
  tests and explicitly omitted capabilities.
- Preserve local-first-then-lambda as a readability fallback rather than a
  mandatory rewrite.
- Exclude the two Chapter 17 transcription defects from final source derivations.

### Chapter 18: Summary

**Read:** complete Chapter 18.

**Source anchor:** `part_three.html#%28part._ch~3asummary3%29`

**Visual inspection:** no chapter-specific raster assets. The chapter is a prose
synthesis and was checked against the complete Chapters 14-17 audit.

#### Argument Reconstructed

Part III presents abstraction as two coupled activities: creation and use.
Creation factors repeated structure into one definition and turns corresponding
differences into parameters. Use delegates concrete behavior to that definition
so mistakes, inefficiencies, and later improvements have one control point rather
than many copied repair sites.

The summary states the source's policy strongly: repeated code patterns call for
abstraction. Its promised maintenance benefit is conditional in operation,
however. The abstraction must represent the intended common behavior, copies
must actually migrate to it, and callers must remain within its parameter
contract. A shared but wrong or unused definition does not eliminate a defect
“once and for all.”

Effective reuse requires an acquisition contract. Abstraction providers should
supply a purpose statement, signature, and good examples; users must understand
these before applying the abstraction. The preceding chapters make the implied
selection method concrete: relate the desired purpose and signature to the more
general operation, derive helper roles, then retain product-specific tests.

Programming languages differ not only in whether they can express abstractions
but in which mechanisms and standard abstractions they provide and how clearly
those mechanisms preserve design intent. Local definitions, captured invariant
context, higher-order functions, and lambda have shown distinct effects on
ownership and readability.

The part's final lesson extends the data model: functions are values and can
represent information. This enables callbacks, verifier factories, predicates as
shapes or sets, and streams as index-to-value functions. Such representations
are judged through their behavioral observers and may require design methods
beyond structural data decomposition.

#### Boundaries That Must Survive Derivation

- Abstraction creation without client use does not establish a single point of
  control.
- Purpose, signature, and examples are required reuse inputs, but examples alone
  do not prove a generalized contract.
- Shared defects can also be centralized; consolidation is not automatic
  correctness.
- Language abstraction mechanisms should be judged by the design distinctions
  they can express, not mere computational equivalence.
- Functions-as-information are behavioral representations and need explicit
  observers, interpretation, and omitted-capability analysis.
- HtDP's “repeated patterns call for abstraction” is a direct source rule. Any
  package policy that defers a weak or unstable candidate is an explicit
  evidence-and-scheduling adaptation rather than a quotation of that rule.

#### Part III Cumulative Assessment

Part III directly supports a traceable abstraction workflow: observe at least
two corresponding concrete definitions; separate essential variation from
inessential naming; introduce one parameter per semantic correspondence; thread
it through recursion; reconstruct the motivating functions; generalize and
validate the signature; identify further coherent uses; migrate clients; and use
the shared definition as the control point.

It also supports an existing-abstraction workflow: start from a product signature,
purpose, example, and stub; choose a known operation whose purpose is more
general and whose signature can be instantiated; derive the callback role;
express invariant context and ownership with appropriate scope; and rerun
product-level tests. Structural resemblance without purpose agreement is
insufficient.

The source's automation pressure is stronger than the current Developer
abstraction-review stance. Chapter 15 says to avoid copying and to abstract
directly from templates, while Developer asks whether a concrete candidate is
stable enough to keep, revise, split, reject, or defer. The latter may remain a
useful operational adaptation, especially given false similarity, incomplete
contracts, migration cost, and timing evidence from other sources, but final
packaged prose must not attribute that gate directly to HtDP.

Part III materially strengthens verifier calibration. It distinguishes sampled
function agreement from extensional equality, output invariants from relational
transformation contracts, one-way containment from no-addition checks, set-like
membership from multiplicity, generated examples from universal proof, and
range properties from randomness. It also says correctness is relative to a
specification, which can itself be incomplete.

Finally, abstraction and process remain independent axes. An abstraction may
preserve duplicated recursion, fold direction can change order-sensitive
results, locality improves cost only when control flow would reevaluate a value,
and lambda can hide useful names. Less code and more reuse are not sufficient
claims of semantic, performance, or readability improvement.

#### Developer Comparison

| Packaged claim or use | Source location | Preliminary decision |
| --- | --- | --- |
| Abstraction has separate creation and use responsibilities. | Chapter 18 | directly supported |
| Repeated patterns should be factored and parameterized. | Chapter 18, lesson 1 | directly advocated by the source |
| Shared definition alone guarantees one-point repair. | Chapter 18, lesson 1 | requires correct common contract and actual client delegation |
| Purpose, signature, and good examples are required for abstraction reuse. | Chapter 18, lesson 2 | directly supported |
| Language mechanisms differ in their ability to express abstraction intent. | Chapter 18 closing | directly supported |
| Functions can be both executable values and information representations. | Chapter 18 closing | directly supported |
| Stability review and deferral are HtDP's stated abstraction recipe. | Part III as a whole | unsupported; they are package-level qualifications |

#### Provisional Repair Notes

- Anchor `recipe-cards.md` in both Chapter 15's creation recipe and Chapter 16's
  reuse recipe rather than describing one undifferentiated abstraction process.
- Mark Developer's stability and scheduling gates as adaptations to HtDP's strong
  anti-copy policy.
- Preserve client migration as the event that creates a single point of control.
- Include purpose, generalized signature, examples, and reconstruction evidence
  in any retained abstraction contract.
- Carry Part III's full verifier escalation into the final whole-book repair
  queue.
- Keep behavioral function representations distinct from structurally decomposed
  data in `data-driven-design.md` and the template catalog.

## Intermezzo 3: Scope and Abstraction

**Read:** complete Intermezzo 3, including `Scope`, `ISL for Loops`, and
`Pattern Matching`.

**Source anchor:** `i3-4.html#%28part._i3-4%29`

**Visual and structural inspection:** lexical-binding arrows, top-level and local
scope boxes, nested shadowing holes, lambda binding, parallel and nested loop
scope, and match-clause bindings. The eleven images are semantic diagrams rather
than decoration and confirm which occurrence each binder owns. The Intermezzo 3
asset-manifest SHA-256 is
`3b5e76bd8b2aeed02abce7bb531864575584633a3dcbb8622bdc4c474293e8ac`.

### Argument Reconstructed

Lexical scope gives precise vocabulary to the abstraction mechanisms introduced
in Part III. A parameter or definition occurrence binds particular uses within a
textual region. Bound occurrences receive their value from that binder; a free
occurrence has no binder supplied by the language, teachpacks, or program.
Top-level names and local names have different scope regions.

Renaming is binding-directed, not text replacement. A parameter may be renamed
only together with the occurrences it binds; same-spelled occurrences under
another function or nested binder remain unchanged. When a nested definition
reuses a name, its scope creates a hole in the enclosing name's scope. Scope
regions for the same spelling are disjoint or nested, never ambiguously
partially overlapping.

A `local` definition binds throughout its local expression, allowing local
definitions to refer to one another, while a function parameter binds only its
body. Lambda introduces parameter bindings over its body in the same fashion.
These relationships explain capture, private collaboration, fresh renaming, and
why editor-style rename operations must follow lexical references.

The intermezzo then distinguishes programmer-defined functional abstractions
from language-level syntactic abstractions. `for` loops and `match` introduce
new grammar, binding forms, scopes, and evaluation rules; ordinary programmers
usually cannot add these constructs merely by defining a function. Syntactic
loops may communicate traversal intent directly and are often compiled more
efficiently, but this is a language-implementation tendency rather than a
semantic guarantee for every use.

A `for/list` clause obtains a sequence from a list, natural number, or string.
Parallel clauses advance together and stop when the shortest sequence is
exhausted. In `for/list`, clause expressions do not see sibling loop binders; in
`for*/list`, each subsequent clause is inside the previous binders' scope and is
recomputed for each outer value. The latter denotes nested traversal and flattens
its collected results.

This distinction explains zip versus Cartesian-product behavior. It also permits
a finite sequence to control traversal of an infinite one: `enumerate.v2` pairs a
finite input list with `in-naturals`, and shortest-sequence termination bounds
the loop. Loop suffixes declare their collection mode—list, conjunction,
disjunction, sum, product, or string—but `for/and` and `for/or` may return
non-Boolean truthy values according to the shown operational rules.

The `cross` example intentionally avoids output-order prediction, but its test
checks only that six results are produced. Any six values, missing pairs,
duplicated pairs, or malformed pairs satisfy that predicate. Order-insensitive
verification still needs pair membership, no additions, and the required
multiplicity rather than cardinality alone.

The compact `arrangements` loop demonstrates expressive power, not the derivation
method. It combines nested loops with recursion on `(remove item w)`, an unusual
transformed input. The text explicitly points elsewhere for the underlying
design. Concision and language power are not evidence that a recursive process
was systematically derived or that its duplicate behavior is understood.

Pattern matching abstracts the repeated predicate-selector structure of
conditionals over algebraic data. A match evaluates one value and tries patterns
in order. Literal patterns match themselves; variables match any value and bind
it for that clause body; cons and structure patterns recursively match fields;
and predicate patterns delegate acceptance to a one-argument Boolean function.
A broad variable pattern is therefore a catch-all whose position affects later
reachability.

Pattern-bound variables have clause-local scope, so same-spelled variables in
different clauses cannot interfere. Cons and structure patterns mirror
construction shape and make selected fields directly available, but they do not
change the original data definition, recursion positions, or branch semantics.
For self-referential data, recursive calls still occur on the field corresponding
to the self-reference.

The final examples combine abstractions: `move-right` uses a loop for traversal
and match for structure decomposition. Named input and expected fixtures improve
readability without changing test semantics. The source asks readers to compare
this form with the equivalent conditional-and-selector version rather than
claiming syntax is universally superior.

### Canonical Source Inconsistency Observed

The pattern-matching `depth` example defines `RD.v2` with the literal base
`"doll"`, says the sample problem measures layers surrounding the inner doll,
and expects one layer to yield `1`. Its copied purpose comment nevertheless says
“how many dolls are a part of an-rd,” wording from Chapter 9's different
representation where the base itself counts as a doll. The Intermezzo 3 function
counts surrounding layers, not total dolls, and must not be cited as semantic
equivalence with Chapter 9's `depth`.

### Boundaries That Must Survive Derivation

- Variable identity follows a binding relation, not spelling alone.
- Safe renaming changes one binder and exactly its bound occurrences.
- Shadowing creates a nested scope hole; it does not mutate the outer binding.
- Local and lambda capture must be analyzed against lexical scope, including
  intervening binders with the same name.
- Language constructs can abstract syntax and binding behavior that ordinary
  higher-order functions cannot introduce.
- Parallel and nested comprehensions differ in both scope and generated data.
- Parallel loops stop at the shortest sequence, which can silently truncate
  longer inputs if equal length was a product invariant.
- Loop collection suffixes have exact result semantics; `/and` and `/or` should
  not be assumed to normalize all success values to `#true`.
- Result count alone does not verify a Cartesian product.
- Compact recursion over a transformed input remains a generative-design question
  even when a loop makes the implementation short.
- Pattern order matters, and variable patterns match every value.
- Pattern matching removes explicit predicates and selectors but does not remove
  the need for correct data definitions, purpose statements, or recursion.
- Equivalent information can support different measures; Chapter 9's total-doll
  depth and Intermezzo 3's surrounding-layer depth must remain distinct.

### Developer Comparison

| Packaged claim or use | Source location | Preliminary decision |
| --- | --- | --- |
| Names should be understood and renamed through lexical binding ownership. | `Scope` | directly supported |
| Same-spelled occurrences necessarily denote one concept or value. | `Scope` diagrams | contradicted explicitly by separate and shadowed binders |
| Scope can express local ownership and invariant capture. | `Scope` and Part III linkage | directly supported |
| Functional and syntactic abstractions have identical extension capabilities. | intermezzo opening and `ISL for Loops` | contradicted; new binding syntax needs language support |
| Parallel traversal and nested traversal are interchangeable. | `ISL for Loops` | contradicted by zip and Cartesian-product examples |
| A length-only property verifies all-pairs generation. | `cross` test | contradicted as a complete claim; it establishes cardinality only |
| Short loop-based code demonstrates that its recursion has been systematically designed. | Figure 108 note | contradicted explicitly; the figure is an exhibition of expressive power |
| Pattern matching follows and exposes data construction shape. | `Pattern Matching` | directly supported |
| Pattern matching itself selects the correct domain behavior. | `Pattern Matching` | unsupported; clause order and bodies still encode purpose |

### Provisional Repair Notes

- Add binding-directed rename and shadowing holes to naming provenance where
  scope-sensitive names are discussed.
- Preserve zip, truncation, and Cartesian-product semantics in any multi-input
  template catalog.
- Add `cross` to verifier calibration as a cardinality-only pass-but-wrong case.
- Do not derive generative-recursion guidance from the compact `arrangements`
  exhibition before its later design chapter.
- Use match as a structure-deconstruction surface, not as evidence that purpose or
  data membership is automatic.
- Exclude the stale total-doll purpose comment from the surrounding-layer depth
  derivation.

## Part IV: Intertwined Data

**Part opening read:** complete. The opening generalizes structural design to
multiple self-references, mutually referential data definitions, iterative model
refinement, interpreters, exchange languages, and simultaneous processing of two
complex inputs. It frames iterative refinement as a scientific model-and-test
process rather than an informal sequence of edits.

**Source anchor:** `part_four.html#%28part._part~3afour%29`

### Chapter 19: The Poetry of S-expressions

**Read:** complete Chapter 19, sections 19.1-19.6.

**Source anchor:** `part_four.html#%28part._ch~3apoetry-sexp%29`

**Visual and structural inspection:** the shared-ancestor family graph; arrows
between S-expression definitions and their corresponding templates; valid and
invalid binary-tree orderings; and the staged simplification of intertwined
functions. The Chapter 19 asset-manifest SHA-256 is
`abc39b5aa867295d21707d55be6ac60dbcd8cfc51b886e878d1df2aa24f01d8e`.

#### Argument Reconstructed

The family-tree example first rejects an unconstructible self-reference. A
`Child` whose father and mother must themselves always be `Child` has no finite
value because no clause stops construction. A valid structural definition needs
a non-referential base. Here absence of known ancestry is represented with the
named `no-parent` structure rather than an unrelated generic sentinel, making the
missing-information meaning explicit.

The product domain is a family tree (`FT`), not merely a child record. Its known
case has two independent `FT` fields, so its template contains two natural
recursions at exactly the father and mother positions. Name, date, and eye-color
selectors remain in the full template inventory, but a specific purpose such as
blue-eye search uses only the eye color and recursive results.

Multiple recursive branches also introduce process distinctions. The `or`
combiner can stop after the current person or one ancestry branch succeeds, so an
implementation need not traverse the entire representable tree. Structural
availability of two recursive calls does not imply unconditional execution of
both.

`blue-eyed-ancestor?` distinguishes the current root from proper ancestors even
though it shares the same outer signature as `blue-eyed-child?`. Recursing only
with itself never inspects any eye-color field and yields `#false` for all inputs.
The correction must apply the right purpose at the father and mother boundaries.
Same signature and data shape do not determine the recursive collaborator's
meaning.

The chapter also flags a naming drift. The `child` structure was named from the
construction story—someone as a child of parents—but later functions traverse
ancestor trees. Selectors such as `child-father` can then obscure the recursive
model. A rename to `person` better preserves the stable entity meaning across
uses.

A family forest adds a list definition that cross-references `FT`. Its function
recurses over the forest and delegates each first item to the tree function,
mirroring both self- and cross-references. Forests may share or overlap trees;
naive aggregation then counts shared people multiple times. The average exercise
is valid only under its stated no-overlap assumption.

S-expressions require a nest of three definitions: an `S-expr` is an `Atom` or
an `SL`; an `SL` is empty or contains an `S-expr` and another `SL`; and an
`Atom` is a number, string, or symbol. Quoted examples make values concise but
hide the `cons` construction needed for template derivation. Code-shaped quoted
values remain data rather than executable definitions.

The generalized recipe is exact. Draw every self- and cross-reference as an
arrow. Validate the nest by constructing examples for every definition,
beginning from clauses with no outgoing dependency. Design one function per data
definition in parallel, keeping other arguments aligned. Functional examples
must exercise every mutual reference. Each data arrow becomes a corresponding
call arrow in the template; the four S-expression arrows therefore become four
function-call relationships.

Definition proceeds from base cases to self- and cross-referential cases. A
broken subordinate function may cause both its own and its caller's tests to
fail; one repair can close both reports because ownership is shared rather than
copied. Coverage should reach every piece, and unclear combiners may need a table
per case and per collaborating function.

The binary-search-tree project separates host shape from a constrained product
class. Every BST is a binary tree, but a BST additionally requires every left
key to be smaller, every right key larger, and both subtrees recursively valid.
This global invariant makes construction harder but permits search to discard one
whole subtree after each comparison. The pruning is justified by the invariant,
not by the node structure alone.

BST constructors must preserve the invariant; arbitrary assembly of two valid
BSTs and a root does not. Building from a list can yield different valid tree
shapes depending on traversal or fold direction. Structural equality to one tree
is therefore not automatically the right verifier when the claim is ordered
lookup behavior and invariant preservation.

The final section delays simplification until the data definition is known to be
final. It first builds the full three-function organization that mirrors the
S-expression definitions and validates it. Then it replaces list traversal with
`map`, collapses atomic cases using generic equality, inlines non-recursive
one-line helpers, and finally removes the redundant outer/local wrapper. Tests
are rerun after every edit, and the source explicitly says one test is almost
never enough.

The simplified result is shorter but justified by the prior structural design.
Its lambda adapts the outer `old` and `new` context to `map`'s one-argument
callback role. Starting directly from the short code would not itself preserve
the derivation evidence about intertwined ownership and recursive positions.

#### Canonical Source Defect Observed

During the third simplification, the prose directs readers to the “bottom half
of figure 121,” but the `substitute.v3` result appears in the bottom half of
Figure 122. This is a local cross-reference error and has no semantic effect.

#### Boundaries That Must Survive Derivation

- Every recursive nest needs at least one constructible path from clauses without
  recursive or mutual dependency.
- A named absence value can carry domain meaning that a generic sentinel does
  not.
- One template and function are designed per data definition, in parallel, with
  call relationships mirroring every arrow.
- Multiple structural recursions identify available subproblems, not mandatory
  eager traversal of every branch.
- Same signature and shape can support different root-versus-descendant purposes.
- Overlapping tree representations turn naive aggregation into repeated counting
  unless identity or no-overlap assumptions are explicit.
- Quote syntax is suitable for examples but should not hide the constructor shape
  used for derivation.
- BST search pruning is correct only while the ordering invariant is established
  and preserved by construction.
- Valid BSTs need not have one canonical physical shape.
- Simplification is staged after structural understanding and model stability,
  with tests between edits.
- Generic operations and inlining may collapse helpers, but the resulting code
  must retain the same behavior and parameter relationships.
- Concise final code is not retroactive evidence that the full model-driven
  design was unnecessary.

#### Developer Comparison

| Packaged claim or use | Source location | Preliminary decision |
| --- | --- | --- |
| A valid recursive definition needs a non-recursive construction path. | §19.1 and §19.4 | directly supported |
| Each self-reference and cross-reference maps to a corresponding template call. | §§19.1, 19.3-19.4 | directly supported |
| All purpose-irrelevant selectors must remain in the implementation. | §19.1 and §19.6 | contradicted; they belong to the inventory, not every body |
| Data-definition nests call for parallel specialized functions. | §§19.2-19.4 | directly supported |
| Same signature determines the same recursive purpose. | Exercise 313 | contradicted by current-child versus proper-ancestor behavior |
| A global invariant can justify eliminating an entire search branch. | §19.5, BST | directly supported |
| Any assembly of valid constrained parts preserves the whole invariant. | §19.5 | contradicted explicitly for BST construction |
| A stable structural derivation may later be simplified with generic operations and inlining. | §19.6 | directly supported |
| Simplification should precede confidence that the data definition is final. | §19.6 opening | contradicted explicitly |
| Short final code alone documents intertwined derivation. | §19.6 | unsupported; the source derives and tests the full organization first |

#### Provisional Repair Notes

- Add the exact arrow-symmetry recipe to the final source trace for
  `data-shape-template-catalog.md`.
- Use `blue-eyed-ancestor?` as a same-shape/different-purpose counterexample.
- Add overlap and double-counting to model and verifier calibration.
- Treat BST ordering as a maintained global invariant with constructor and search
  consequences, not merely a type alias.
- Use §19.6 as direct HtDP support for delaying simplification until the data
  definition is stable; reconcile this with Chapter 15's aggressive abstraction
  language in the final adaptation analysis.
- Preserve the full derive-validate-simplify sequence in abstraction-review
  provenance.
- Exclude the Figure 121/122 cross-reference typo from final citations.

### Chapter 20: Iterative Refinement

**Read:** complete Chapter 20, sections 20.1-20.3.

**Source anchor:** `part_four.html#%28part._ch~3afiles%29`

**Visual and structural inspection:** the complete sample directory graph,
including repeated `read!` names, directory sizes, depth, and all root-to-item
paths; the three successive directory representations; and the corresponding
function-redesign exercises. The sole raster asset is the directory graph. The
Chapter 20 asset-manifest SHA-256 is
`9b4ca1cdb4339085f920854018a51e067fb054ead163114a11b6fd3bd0be4b06`.

#### Argument Reconstructed

Iterative refinement is presented as a scientific modeling process. A model
represents selected real-world information; functions make predictions or
answer questions from that representation; discrepancies with observations or
new required behavior motivate a refined model. Iteration stops when the model
is sufficiently accurate for its purpose, not when it reproduces every property
of reality.

The process starts with essential information and adds distinctions as they
become necessary. Refinement may happen during initial design or after deployment
when users request behavior the current representation cannot support. Data and
functions evolve together: every representation revision calls for new examples,
updated templates or collaborators, and renewed behavioral evidence.

The first directory model treats file names as strings and directories as nested
heterogeneous lists. It can represent containment and support file counting, but
directory identity is absent. The representation therefore cannot answer a basic
question such as listing subdirectory names. Its simplicity is useful only while
those omitted distinctions are irrelevant.

Model 2 introduces a named directory structure with a name and mixed contents.
`Dir.v2` and `LOFD` refer to one another, making directory identity explicit
while retaining file names as atomic strings. The same visible directory tree is
translated again and `how-many` is redesigned, which checks that the refinement
preserves an old capability while enabling new questions.

Model 3 adds file name, size, and content and separates a directory's
subdirectories from its files. This distinction produces three connected data
definitions and supports storage calculations and path-oriented operations. It
also gives up the mixed ordering of entries, illustrating that “more fields” is
not automatically a superset of every previous representational property; the
refinement is judged against selected information needs.

The chapter repeatedly asks why the redesigned `how-many` should be trusted.
Confidence is intended to come from translating the same concrete tree into each
model, deriving functions from the revised definitions, preserving tests for old
claims, and adding examples for new distinctions. Agreement on one count alone
would not verify directory names, file attributes, or path behavior.

Once the third representation is established, parametric list definitions and
existing list abstractions may simplify it and its functions. This preserves the
Chapter 19 sequencing: model the distinctions, derive and test the full
structure, then compress routine traversals. Simplification does not precede the
refinement that discovers the actual data boundaries.

The teachpack's `create-dir` moves from controlled examples to real directory
data. The source warns readers to begin with small directories because acquisition
of a large tree may be expensive. Real filesystem output is application evidence
and a scale test after the structural design, not the first source of examples.

Function refinement remains purpose-relative. The exercises explicitly say to
use the simplest directory definition that supports each task rather than always
selecting the most detailed model. `find?`, flat listing, recursive storage,
one-path search, all-path search, and recursive listing require different
amounts of information.

The `find` exercise also rejects a tempting decomposition. Calling `find?`
before finding a path repeats essentially the same traversal, potentially once
for every subdirectory. Integrating existence detection with path construction
lets one traversal produce either a path or `#false`. Decomposition into named
tasks is not beneficial when it duplicates the dominant search process.

Finally, repeated file names expose a cardinality change. `find` may return one
valid path, while `find-all` must return every valid path; absence naturally
becomes a collection-level result rather than one failure sentinel. An alternate
design composes recursive path listing with filtering, trading direct search for
a reusable intermediate representation.

#### Boundaries That Must Survive Derivation

- Refinement accuracy is relative to questions and behavior, not resemblance to
  every real-world detail.
- Start with essential distinctions, but record what each model deliberately
  omits and which requests force revision.
- Data and function refinements must move together; changing structures without
  revalidating consumers leaves the model-code relationship stale.
- Preserving one old output does not establish new attributes or all old
  semantics.
- A later representation can improve fidelity while discarding an ordering or
  relation that was present earlier.
- The most detailed available model is not automatically the best model for a
  task; use the simplest one that supports the claim.
- Real-data and scale checks follow controlled design examples.
- Separate pre-check and work traversals may duplicate the dominant process;
  combine them when one traversal can return success evidence or failure.
- “Find one” and “find all” have different result and absence contracts.
- Duplicate names make path identity, not file name alone, necessary for
  all-occurrence claims.
- Post-refinement simplification should preserve the distinctions and evidence
  established by the explicit model.

#### Developer Comparison

| Packaged claim or use | Source location | Preliminary decision |
| --- | --- | --- |
| Iterative refinement begins with essential information and adds distinctions in response to evidence or requests. | Chapter 20 opening | directly supported |
| A model must reproduce every real-world property before use. | Chapter 20 opening | contradicted; sufficient predictive or behavioral accuracy is the stop condition |
| Representation and processing functions are refined together. | §§20.2-20.3 | directly supported |
| The richest representation should be used for every task. | §20.3 exercise guidance | contradicted explicitly |
| Stable models may be simplified with parametric definitions and existing abstractions. | §20.2, Exercise 337 | directly supported |
| Checking existence before constructing a result is always clean decomposition. | Exercise 342 hint | contradicted when it duplicates traversal |
| One matching file path is evidence for an all-occurrences claim. | Exercises 342-344 | contradicted by repeated `read!` paths |
| Real input volume can replace small model examples. | §§20.2-20.3 | contradicted by staged translation and small-directory warning |

#### Provisional Repair Notes

- Add Chapter 20's model-predict-observe-refine loop to
  `problem-modeling.md` provenance.
- Preserve explicit omitted-information and refinement-trigger fields in any
  packaged model artifact.
- Use “simplest sufficient model” as a direct source-backed boundary against
  maximal representation design.
- Add pre-check-plus-work traversal as a decomposition counterexample.
- Carry one-result versus all-results and duplicate-path identity into verifier
  calibration.
- Keep simplification ordered after sufficient model stability and regression
  evidence.

### Chapter 21: Refining Interpreters

**Read:** complete Chapter 21, sections 21.1-21.4.

**Source anchor:** `part_four.html#%28part._ch~3aevaluator%29`

**Visual and structural inspection:** expression/representation/value tables,
nested `add` and `mul` parse trees, the complete S-expression parser in Figure
125, substitution and environment evaluator variants, one-function and
multi-definition representations, and the final mixed definitions area. All
chapter figures are HTML-native code or tables; there are no chapter-specific
raster assets.

#### Argument Reconstructed

The interpreter project applies iterative refinement at two levels. Selecting
only the interactions area's evaluator from all of DrRacket is already a scope
refinement. The evaluator then grows in language slices: closed numeric
expressions, variables and constants, one-argument function applications,
multiple function definitions, and finally mixed constant and function
definitions.

The first slice separates three concepts. A source expression is language
information, its `add`/`mul` structures are data representing that expression,
and evaluation produces a numeric value. “Interpret data as information” during
modeling is related to but distinct from an interpreter that consumes program
representation and computes the represented program's value.

Addition and multiplication need distinct constructors even though both contain
two operands, because operator identity changes evaluation. Their fields contain
representations of expressions, so arbitrarily nested syntax becomes ordinary
intertwined structural data. The evaluator follows this representation and
combines recursively computed operands with the represented operator's semantics.

Quoted S-expressions are convenient external syntax but too broad and irregular
for a precise evaluator core. A parser bridges the boundary. It checks whether
input has the accepted grammar and, only on success, constructs the corresponding
`BSL-expr` parse tree; malformed arity, unknown operators, strings, and symbols
produce a declared error. `interpreter-expr` composes parsing with evaluation and
preserves parser failure rather than treating malformed source as an evaluator
case.

Coverage of every parser expression is useful structural evidence, but it does
not enumerate every malformed shape or prove the parser's stated “if and only
if” language boundary. Valid and invalid partitions, nested cases, operator
arity, and error behavior remain semantic test obligations.

Adding variables extends the expression definition with a `Symbol` clause and
requires a representation of definitions. The chapter compares two semantic
models. Substitution replaces named occurrences with values before evaluation;
the environment model carries an association list and looks up a symbol only when
encountered. They target the same constant-language meaning through different
processes and different context placement.

`eval-variable*` chooses the association list as its traversal driver while
treating the entire expression as an atomic value to be repeatedly transformed.
`eval-var-lookup` instead traverses the expression and carries the definitions
area unchanged. Which complex input controls the template is determined by the
chosen algorithm, not by the fact that both inputs have structure.

Function refinement adds application syntax plus data for function definitions.
Evaluation is call-by-value in the worked model: evaluate the argument, look up
the definition, substitute the argument value for the parameter in the body, and
evaluate the generated expression. Unknown variables or function names remain
explicit errors.

This last recursive call is not on a structural field of the original input. It
operates on a newly produced expression after substitution, so the source labels
it an uncovered form of recursion and points to Generative Recursion. The new
process can diverge; a legal represented program may run forever instead of
returning or signaling an error. The structural recipes of Parts I-IV had
previously ruled out such non-termination by construction.

A definitions area evolves from one externally supplied function contract to a
list of represented definitions, then to a mixed itemization of constants and
functions with specialized lookup operations. The final evaluator keeps the
expression and environment distinct, interprets variable references by lookup,
and interprets calls using represented function bodies. Quoted source becomes
usable only after parsers for both expressions and definitions establish the
internal contracts.

The final claim is deliberately scoped. Booleans, conditionals, strings, lists,
and many primitives remain absent, but the established refinement pattern can
add them. Recursive represented functions are already possible because function
lookup and generated-expression evaluation do not depend on source definitions
being acyclic; this capability carries the same non-termination risk.

#### Canonical Source Inconsistencies Observed

- The parser discussion names `#true` as an S-expression that is not a numeric
  `BSL-expr`, but Chapter 19's local `S-expr` definition permits only numbers,
  strings, symbols, and lists. The runtime parser rejects `#true`, yet its
  `S-expr -> BSL-expr` signature does not admit that example under the book's
  stated local definition. Either the external input class is broader than the
  signature or the Atom definition would need Boolean.
- Exercise 358 calls a represented function body a “variable expression,” while
  its required examples include calls such as `(f (* 2 y))` and later evaluation
  recursively handles applications. The body class must support the refined
  `BSL-fun-expr`, not merely the prior variable-only expression class.

These are boundary-description defects; the staged interpreter algorithm remains
clear.

#### Boundaries That Must Survive Derivation

- Source syntax, program representation, parse tree, and evaluated value are
  separate artifacts.
- Distinct syntax constructors may share field shape while requiring different
  semantics.
- A convenient broad interchange representation should be parsed into a precise
  internal model before core evaluation.
- Parsing owns grammar membership and construction; evaluation owns meaning of a
  valid internal representation.
- Structural coverage does not prove exact accepted-language membership or error
  behavior.
- Substitution and environment lookup are alternate semantic processes, not
  interchangeable implementation details without equivalence evidence.
- With two complex inputs, the selected process determines which input drives
  traversal and which context is carried.
- Evaluating a function argument before substitution is a semantic choice
  visible in the evaluator.
- Recursion on a substituted expression is generative, not natural recursion on
  an input field.
- Generative evaluator recursion introduces non-termination as an observable
  outcome.
- Missing-name errors belong to the language contract and should not collapse
  into arbitrary host failures.
- The final evaluator covers a stated subset of BSL; extensibility is not current
  feature completeness.

#### Developer Comparison

| Packaged claim or use | Source location | Preliminary decision |
| --- | --- | --- |
| Code-shaped external data should be parsed into a validated internal representation. | §21.1 | directly supported |
| Parser and evaluator have distinct grammar-versus-meaning ownership. | §21.1 | directly supported |
| Same constructor field shape implies same interpretation. | §21.1, `add` and `mul` | contradicted by operator-specific semantics |
| Alternative substitution and environment models can implement the same variable meaning with different process structure. | §21.2 | directly supported |
| Every complex input must drive simultaneous structural expansion. | §21.2 hints | contradicted; one may be carried or treated atomically |
| All evaluator recursion is data-shape-derived natural recursion. | §21.3 | contradicted explicitly by substitution-driven recursion |
| A refined evaluator may introduce divergence even when earlier structural functions terminated. | §21.3 warning | directly supported |
| Parsing success and expression coverage establish complete interpreter correctness. | §§21.1 and 21.4 | unsupported; language subset and semantic obligations remain |
| Iterative refinement can add syntax and definitions while preserving explicit error boundaries. | Chapter 21 as a whole | directly supported |

#### Provisional Repair Notes

- Add parse-versus-evaluate ownership to `generic-operations-and-languages.md`
  provenance.
- Keep external syntax, internal representation, and semantic value separate in
  model artifacts.
- Add substitution recursion as an explicit generative-recursion boundary for
  later comparison with Part V.
- Preserve controlling-input choice and carried context in multi-input template
  guidance.
- Add parser coverage versus accepted-language completeness to verifier
  calibration.
- Exclude the `#true` signature mismatch and “variable expression” wording from
  final derivations.

### Chapter 22: Project: The Commerce of XML

**Read:** complete Chapter 22, sections 22.1-22.4.

**Source anchor:** `part_four.html#%28part._ch~3amoney-sexp%29`

**Visual and structural inspection:** nested XML and its browser rendering, flat
and nested enumeration images, X-expression representation versions, the FSM
configuration file and translation pipeline, and the historical stock-alert
world. The screenshots confirm hierarchical list rendering and the intended
price/delta display but do not validate the obsolete external service. The
Chapter 22 asset-manifest SHA-256 is
`2ad34bd7d24c89ea5dc00f44ef320609f66bc484381e87b69f5106af0a66e065`.

#### Argument Reconstructed

The XML project refines an external data representation from a symbolic element
name, to nested content, to optional attributes. `Xexpr.v0` represents an empty
element, `Xexpr.v1` adds recursively nested elements, and `Xexpr.v2` adds a list
of symbol/string attributes. The progression follows observed language features
rather than attempting a complete XML model immediately.

The representation deliberately ignores whitespace and treats self-closing and
explicit empty elements as equivalent. Optional attributes are omitted for
manual convenience, though an explicit empty attribute list is also accepted.
Thus `(machine (action))` and `(machine () (action))` represent the same XML
information while remaining structurally unequal ISL+ values.

X-expressions use lists to simulate records. This lowers authoring cost but makes
automatic processing harder because quasi-fields have positional and optional
encodings. `xexpr-name`, `xexpr-attr`, and `xexpr-content` form an abstraction
barrier that normalizes those encodings and lets clients treat X-expressions like
structures. Representation convenience and processing convenience are distinct
economic choices.

The `xexpr-attr` derivation includes the complete structural inventory but omits
recursion from its final body because attribute extraction only needs to inspect
the optional first remainder item. `list-of-attributes?` is a discriminator over
the declared union of valid attribute lists and valid X-expressions, not a
validator for arbitrary host values. Its shallow first-item check is justified
only by that input precondition.

Rendering defines a small XHTML sublanguage as a subset of X-expressions and
continues to use the generic accessors. Flat enumeration rendering splits item
rendering from list reduction and selects `foldr` by result type, purpose, and
stacking order. Tests are requested for the item function without depending on
the concrete bullet constant, separating item behavior from one presentation
choice.

Nested enumerations refine `XItem`: an item may now contain a word or another
enumeration. This introduces a back-reference from items to enumerations. The
code change appears in `render-item`, where the new data alternative is
discriminated and delegated back to `render-enum`; the outer enumeration
traversal remains stable. A localized data-definition change should produce a
correspondingly localized function change when ownership boundaries align.

The DSL section treats configuration as complex arguments stored in a file. A
configuration component has two parts: a simple external language and a
translator that constructs the component's ordinary function call. XML supplies
common surface syntax; `XMachine` and `X1T` define the domain-specific subset;
and `simulate-xmachine` translates initial state and transitions before invoking
the existing FSM simulator.

`XMachine` is a subset of `Xexpr`, so the generic accessors remain usable.
`xm->transitions` maps each XML action to one internal transition, making the DSL
boundary explicit: external vocabulary and shape are translated into the core
component's stable data contract. The simulator does not need to understand XML.

The chapter's file and web readers introduce effects and time. Repeated calls
with the same file name or URL may produce different values because external
content can change. This breaks the algebraic same-arguments/same-result property
assumed by the earlier computational model. The stock-alert tick handler ignores
the old world and replaces it with newly retrieved external information; the
external read is an event boundary rather than a deterministic core calculation.

External acquisition also creates new failure and provenance obligations. URL
reads may return `#false`, malformed or changed documents may violate the
expected sublanguage, and a provider may remove the service entirely. The source
explicitly says the Google stock exercise can no longer be completed. Historical
screenshots and examples therefore establish design intent, not current endpoint
compatibility.

The `get` wrapper separates a public string result from a `[Maybe String]`
recursive search and turns absence into an explicit error. Yet the displayed
stock handler passes the result of `read-xexpr/web` directly to `get` without
handling its documented `#false` case. A robust boundary must validate acquisition
before traversing expected XML.

#### Canonical Source Defects Observed

- Figure 128 defines `COLOR` as `"black"` but uses an undefined identifier
  `BLACK` in the bullet and word rendering expressions. Both uses require the
  defined color constant or another explicit color definition.
- Figure 133 annotates the two-argument local helper `(word sel col)` as
  `[StockWorld String -> String] -> Image`. Its actual roles are a selector such
  as `[StockWorld -> String]` and a color argument, producing an `Image`; the
  printed signature omits or conflates the second parameter.

#### Boundaries That Must Survive Derivation

- External syntax can have multiple structural encodings for the same domain
  information; accessors may normalize them.
- A list-backed record representation trades concise authoring against parser and
  accessor complexity.
- A discriminator over a declared union is not automatically an `Any` validator.
- Full template inventory does not force recursion into a local extraction
  purpose.
- A domain-specific sublanguage may reuse a generic representation barrier while
  imposing stronger shape and vocabulary constraints.
- Data refinement should change the collaborator that owns the new alternative,
  not every caller indiscriminately.
- A DSL translator should terminate at the core component's existing argument
  contract rather than leak external syntax into domain execution.
- File and web reads are effectful, time-varying boundaries; deterministic core
  claims must isolate them.
- A `[Maybe X]` acquisition result must be checked before an `X`-only consumer.
- Historical endpoint screenshots cannot verify present service compatibility.
- External documents require both transport-success and accepted-sublanguage
  validation.
- Presentation tests should distinguish structural rendering behavior from one
  replaceable visual constant.

#### Developer Comparison

| Packaged claim or use | Source location | Preliminary decision |
| --- | --- | --- |
| Generic accessors can form a barrier over a compact but irregular representation. | §22.1 | directly supported |
| Representation equality is required when two encodings denote the same XML information. | §22.1, `e2`/`e3` | contradicted; accessors normalize optional attributes |
| Purpose-irrelevant natural recursion may disappear from the implementation. | Exercise 367 | directly supported |
| A sublanguage can reuse a broader representation while adding domain constraints. | §§22.2-22.3 | directly supported |
| Data-definition refinement should localize function changes along matching ownership. | Figures 127-128 | directly supported |
| A DSL consists of external vocabulary plus translation to a stable component contract. | §22.3 | directly supported |
| Same arguments always produce the same result at file and web boundaries. | §22.4 | contradicted explicitly |
| Successful historical rendering proves a live endpoint still satisfies the contract. | §22.4 stock note | contradicted by the retired service |
| A documented Maybe result can be passed directly to an X-only parser or accessor. | Figures 132-133 | contradicted by the missing failure branch |

#### Provisional Repair Notes

- Add X-expression quasi-field accessors to abstraction-barrier provenance as a
  normalization layer over noncanonical encodings.
- Keep shallow discriminators scoped to their declared valid union; do not present
  them as arbitrary-input validators.
- Add DSL translation as an external-language-to-core-contract pattern in
  `generic-operations-and-languages.md`.
- Add effectful acquisition, time variance, transport failure, and schema drift to
  process/state and verifier provenance.
- Use the retired stock endpoint as evidence that screenshots and old integration
  examples decay independently of core logic.
- Exclude the undefined `BLACK` uses and malformed `word` signature from final
  derivations.

### Chapter 23: Simultaneous Processing

**Read:** complete Chapter 23, sections 23.1-23.7.

**Source anchor:** `part_four.html#%28part._ch~3asimu%29`

**Visual and structural inspection:** the three two-input template cases,
`list-pick`'s two-dimensional case table and algebraic simplification, the
Hangman and linear-combination examples, database schema/content tables,
integrity checking, projection masks, and one-to-many joins. The six raster
assets are the linear-combination formulas and their instantiated values; the
remaining evidence is HTML-native code and tables. The Chapter 23 asset-manifest
SHA-256 is
`39da6750375a3219c8d0c75ad20f07a614108d591f0e7e2aa51e2bda10119462`.

#### Argument Reconstructed

Functions over two complex inputs are classified by the semantic relationship
between the inputs, not by their host types alone. The chapter identifies three
cases: one input dominates while the other is carried atomically; the inputs
have an equal structural relationship and advance in lockstep; or the inputs are
independent enough that all combinations of their data clauses must be analyzed.

`replace-eol-with` demonstrates the dominant-input case. Only the first list is
deconstructed and recursively traversed. The second list is a complete value
inserted at the first list's base; its internal structure never affects the
control flow. A complex argument may therefore remain atomic relative to one
purpose.

The payroll example demonstrates lockstep processing. Its two lists are assumed
equal in length and corresponding positions refer to one employee. That
relational invariant makes emptiness and non-emptiness coincide and justifies
one conditional plus selectors and recursive progress on both lists. Without the
invariant, selecting or recursing on the second list from a first-list-driven
template would be unsafe or would silently ignore unmatched data.

`list-pick` demonstrates the all-cases route. A list and a natural number have no
shape-equality invariant, so their two clauses produce a four-cell Cartesian
case table. Examples cover every cell, including error cases and the decision to
use zero-based indexing. Each condition combines one classifier from each axis,
and each body inventories the selectors available in that cell.

Selector availability alone does not choose recursion. In the non-empty,
positive-index case, three calls are structurally expressible: shrink both
inputs, shrink only the number, or shrink only the list. Applying each candidate
to a worked example shows that only `(rest l, sub1 n)` preserves the purpose.
For multi-input functions, data shape enumerates feasible recursive moves while
the relation and purpose choose the move.

The full four-case function is simplified only after systematic derivation.
Duplicate error outcomes are merged, Boolean expressions are factored with
algebraic laws, facts about natural numbers eliminate a tautology, and earlier
clauses make later `cons?` checks redundant. The resulting three-clause function
is trusted because every transformation preserves the already analyzed case
space; directly guessing the short form would not provide that evidence.

The generalized recipe first expands shorthand data definitions and examples if
necessary, then classifies the input relationship. A dominant input gets the
ordinary template. Equal-status inputs need an explicit same-size or same-shape
invariant and parallel traversal. Otherwise, a two-dimensional table drives
examples, conditions, selectors, and candidate recursions. Three independent
complex inputs imply the same reasoning over a conceptual three-dimensional
case space.

The database project makes relation ownership concrete. A database combines a
schema and content. Each schema entry contains a label and an executable
predicate; every row must have schema width and each cell must satisfy its
position's predicate. Integrity is therefore a relational invariant between two
lists, not a property of rows or schemas in isolation.

Integrity checking first verifies equal lengths and then applies schema
predicates to cells in parallel. The ordering of those checks matters: the
length guard prevents a shortest-list traversal from silently accepting an
unmatched suffix. The built-in multi-list `andmap` supplies the lockstep process
once that precondition has been checked.

Systematic hoisting separates invariant work from per-row work. Schema, content,
and width are computed once; projection later precomputes a Boolean mask from
schema labels and reuses it for every row. The mask is an explicit intermediate
contract between column selection and row transformation. Hoisting improves cost
only because schema and labels remain unchanged across all rows.

Database projection exposes a verifier boundary. A whole-DB `check-expect` fails
because schemas contain predicate functions and function values cannot be
compared extensionally. Weakening the test to content alone avoids that host
error but does not verify projected labels or predicate behavior. Complete
evidence must observe schema labels and test predicates through representative
applications while separately checking content and integrity.

The final join exercise makes assumptions explicit but also shows their limit.
The last specification of the first schema must agree with the first of the
second, and the second database may map one key to one or many rows. Iterative
refinement handles the one-to-many expansion. A fully checked join is deferred
because “exact same Spec” includes function comparison, which the current model
cannot decide. Informal preconditions are not runtime guarantees.

#### Canonical Source Defects Observed

- The `wages*.v2` names and prose say the first list contains hours and the second
  pay rates, but every numerical example passes `5.65` first and `40` second and
  the helper treats them as pay rate and hours. The argument roles are reversed
  between the stated contract and worked implementation.
- During Boolean simplification, one intermediate definition changes the header
  from `(list-pick alos n)` to `(list-pick n alos)` while its recursive call and
  all surrounding versions retain the original order. This is a transcription
  error, not an intentional API change.

#### Boundaries That Must Survive Derivation

- Complex-input count does not determine template shape; the relationship among
  inputs does.
- An argument can be structurally complex yet atomic for a specific operation.
- Lockstep traversal requires an equal-size or equal-shape invariant plus a
  correspondence interpretation.
- Parallel traversals must define behavior for invariant violations rather than
  rely on shortest-input truncation accidentally.
- In the independent case, examples and template clauses cover the Cartesian
  product of data alternatives.
- Feasible selector combinations are recursion candidates, not automatic calls.
- Purpose and examples select which inputs make progress together.
- Simplification follows exhaustive case derivation and uses explicit preserving
  laws.
- Schema integrity is relational: row width and position-sensitive predicates
  belong together.
- Hoisted values must be invariant across the scope where they are reused.
- Function-valued schema fields require behavioral observation; structural DB
  equality is unavailable.
- Content-only projection tests omit schema and predicate claims.
- Database operations built on informal schema assumptions need checked
  boundaries in production, even when the teaching model cannot implement full
  function equality.
- One-to-many joins change result cardinality and need examples beyond the
  one-result first refinement.
- Test suites protect only covered behavior during simplification and hoisting.

#### Developer Comparison

| Packaged claim or use | Source location | Preliminary decision |
| --- | --- | --- |
| Two-complex-input design begins by classifying the relationship among inputs. | §§23.1-23.5 | directly supported |
| Every complex input requires simultaneous structural expansion. | §23.1 | contradicted by the dominant-input case |
| Same-length corresponding inputs may share one lockstep template. | §23.2 | directly supported under an explicit invariant |
| Independent data alternatives require Cartesian case analysis. | §§23.3 and 23.5 | directly supported |
| Every structurally feasible recursive call belongs in the final body. | §23.3 | contradicted; purpose and examples choose among candidates |
| A compact multi-input function should be guessed before exhaustive cases. | §23.4 | contradicted explicitly by derive-then-simplify |
| Precomputed masks can move invariant decisions out of repeated row processing. | §23.7 | directly supported |
| Content equality verifies an entire database projection. | §23.7 | contradicted; schema labels and predicates remain unverified |
| Informal same-schema assumptions are equivalent to checked contracts. | join note | contradicted explicitly |

#### Provisional Repair Notes

- Add the dominant, lockstep, and Cartesian routes to
  `data-shape-template-catalog.md` with explicit relationship predicates.
- Require equal-shape violation behavior for parallel traversals; do not inherit
  shortest-sequence semantics silently.
- Preserve feasible-recursion inventory separately from purpose-selected calls.
- Add exhaustive-case-then-algebraic-simplification to structural-change
  provenance.
- Use database integrity and projection masks as relational-invariant and hoisting
  examples.
- Add function-valued schema and content-only tests to verifier calibration.
- Exclude the swapped payroll semantics and temporary `list-pick` parameter order
  from final derivations.

### Chapter 24: Summary

**Read:** complete Chapter 24.

**Source anchor:** `part_four.html#%28part._ch~3asummary4%29`

**Visual and structural inspection:** prose summary only; the chapter contains no
raster assets, code figures, or additional diagrams.

#### Argument Reconstructed

Part IV closes by asserting that the design recipe scales to data described by
multiple intertwined definitions. When data definition `A` refers to `B`, their
templates are developed together, and the template for `A` refers to the
template for `B` at the position corresponding to the data reference. Each data
definition receives its own template function.

This is a rule for template inventory, not a demand that every final function
execute every structurally available delegation. Earlier chapter examples still
require purpose to select the relevant fields, branches, and recursions. The
summary's “exact same place and manner” describes the structural correspondence
between data definitions and initial templates.

For functions over two complex inputs, the summary repeats the three-way
classification from Chapter 23: one input may be atomic relative to the purpose;
two inputs may have exactly aligned structure and be traversed in parallel; or
all combinations of their alternatives may need separate treatment. Only the
third route calls for the full two-dimensional case table.

The dimensional idea generalizes to three independent complex inputs as a
conceptual three-dimensional table. This is not a rule to construct a Cartesian
cube whenever three complex values appear; dominant and aligned relationships
can still reduce the relevant case space before enumeration.

The final claim that the reader has seen the structural data forms likely to
occur in a career is a pedagogical confidence claim, qualified by “the details
will differ.” Its durable conclusion is narrower: when unfamiliar structural
data causes uncertainty, data analysis and the design recipe provide a systematic
starting point. They do not by themselves settle purpose, effects, cost,
external validity, or domain policy.

#### Boundaries That Must Survive Derivation

- Mutually referential data definitions induce mutually referential initial
  templates, one per definition.
- Structural template correspondence must not be confused with mandatory final
  recursion.
- Multiple complex inputs are classified by relationship before their cases are
  multiplied.
- Cartesian tables apply to independent alternatives, not automatically to every
  multi-input signature.
- Higher-dimensional case analysis is a conceptual extension and may expose
  combinatorial pressure that calls for a better model or decomposition.
- The design recipe is a systematic starting method, not a guarantee that
  structural analysis alone determines behavior.
- The summary does not erase the part's chapter-specific qualifications about
  model stability, parser boundaries, external effects, schema validation, and
  evidence gaps.

#### Developer Comparison

| Packaged claim or use | Source location | Preliminary decision |
| --- | --- | --- |
| Cross-references among data definitions should appear at corresponding positions in their initial templates. | Chapter 24, first bullet | directly supported |
| Every template recursion must remain in the final function. | Chapter 24 read with Chapters 22-23 | contradicted; purpose may eliminate candidates |
| Multi-input case multiplication follows relationship classification. | Chapter 24, second bullet | directly supported |
| Every function with three complex inputs requires an exhaustive cube. | Chapter 24 final paragraphs | overbroad; only independent alternatives require it |
| Structural data analysis determines domain purpose and external policy. | Chapter 24 closing | not supported; the recipe only gets the designer started |

#### Part IV Cumulative Judgment

Part IV supports a relationship-sensitive extension of data-driven design.
Mutual references create collaborating templates; stable data definitions enable
simplification; filesystem searches distinguish traversal shape from carried
context and result contract; parsers separate external grammar from evaluation;
X-expressions demonstrate normalization barriers and DSL translation; and
multi-input functions require dominant, lockstep, or Cartesian analysis.

The part also limits purely structural reasoning. The simplest sufficient model
should be chosen for the task. A structurally rich model can duplicate dominant
traversals or obscure a simpler search. Parsing validates and constructs syntax
but does not own meaning. External acquisition introduces time, failure, and
schema drift. Database schemas contain executable predicates that defeat naïve
structural equality. Tests must therefore be claim-relative rather than treated
as generic confirmation.

The strongest faithful derivation is not “copy the data shape into code.” It is:
use data definitions to expose the complete structural possibility space, state
the relationships and invariants among inputs, let purpose select the needed
collaborations and recursive progress, and simplify only after the resulting
case coverage is explicit.

#### Provisional Repair Notes

- Preserve “one template per mutually referential definition” as initial
  inventory, while retaining purpose-based elimination in final functions.
- Route multi-input work through relationship classification before suggesting a
  case matrix.
- Present three-dimensional tables as a diagnostic fallback for independent
  alternatives, not a default implementation plan.
- Carry Part IV's limits into HtDP-derived references: structural recipes do not
  replace semantic modeling, boundary validation, cost analysis, or
  claim-relative verification.

## Intermezzo 4: The Nature of Numbers

**Read:** complete intermezzo, including Fixed-Size Number Arithmetic,
Overflow, Underflow, and *SL Numbers.

**Source anchor:** `i4-5.html#%28part._i4-5%29`

**Visual and structural inspection:** all 26 raster assets, including the
mantissa/exponent equations, range endpoints, normalization and rounding
examples, overflow and underflow magnitudes, loss-of-significance equations,
and the alternating `oscillate` graph. The graph confirms alternating signs and
decaying magnitude; it does not establish the numerical accuracy of either
summation order. The Intermezzo 4 asset-manifest SHA-256 is
`2d2249742284af8f1c53ef5e15fabde833c66cb1b49ade57792e37b5f8b08b3b`.

### Argument Reconstructed

Programming languages mediate between mathematical numbers and finite hardware
representations. A fixed amount of storage offers only finitely many encodings,
so it cannot represent every value in even a bounded real interval. A number
system therefore chooses among range, precision, arithmetic cost, and exceptional
behavior rather than merely selecting a syntax.

The teaching `Inex` representation makes the choice concrete. A value has an
integer mantissa from 0 through 99, an exponent sign, and a magnitude from 0
through 99; its interpretation is `m * 10^(s*e)`. A checked constructor enforces
those representational bounds, while `inex->number` supplies the interpretation.
The host structure constructor and the valid-domain constructor consequently
have different contracts.

Representation and mathematical value are not one-to-one. `120 * 10^1` is a
valid mathematical description of 1200 but an invalid `Inex`, while both
`50 * 10^-20` and `5 * 10^-19` are valid encodings of the same number. Zero has
many possible encodings as well. Structural equality is therefore neither
necessary for numeric equivalence nor sufficient evidence of a canonical
representation.

Scientific notation greatly expands representable range but leaves gaps. The
model spans from `10^-99` through `99 * 10^99` for positive nonzero values, yet
between 1200 and 1300 it cannot exactly represent 1240. Mapping a mathematical
value into this finite set requires a rounding policy. The chapter uses nearest
representable values but does not fully specify tie-breaking or a general
normalization policy.

Arithmetic must maintain the representation invariant. Addition with aligned
exponents combines mantissas, then shifts a digit into the exponent if the
mantissa is too large. Multiplication combines mantissas and exponents and may
need the same normalization. If discarded digits have information, the operation
is approximate. The arithmetic functions are required to detect their own
out-of-range results instead of delegating their public failure contract
accidentally to `create-inex`.

Approximation error composes across operations. Repeatedly adding an inexact
`1/185` need not produce exactly 1, and repeatedly subtracting it need not reach
exactly zero. An equality-based stopping condition can therefore alter control
flow or fail to terminate, not merely perturb the final printed digits.

Overflow occurs when a result's magnitude exceeds the representable maximum.
Implementations may signal an error or introduce an infinity value and propagate
it. Underflow occurs when a nonzero result is smaller than the smallest
representable positive magnitude. Implementations may signal an error or replace
the result with zero. The latter destroys the nonzero distinction and can change
comparisons, branches, and later operations.

The teaching languages distinguish exact and inexact values. Integers and
rationals use arbitrary-precision representations bounded by available memory,
with representation and arithmetic switching hidden behind the language's
numeric interface. Exactness is preserved when the result remains exactly
representable; an irrational result such as `sqrt 2` is inexact. An exact input
can produce an exact result such as `sqrt 4`, while an inexact encoding of 4
produces an inexact 2. Numeric literals are exact rationals by default in the
teaching languages unless prefixed with `#i`.

Inexact arithmetic invalidates unqualified algebraic assumptions. Adding values
with widely different magnitudes may discard the smaller operand, and floating
addition is operationally order-sensitive. `sum JANUS`, its reverse, and its
sorted form can produce radically different answers even though mathematical
addition is associative and commutative. Starting with the smallest values is a
heuristic, not a universal remedy.

Converting stored inexact values to exact rationals, summing, and converting the
result back can eliminate additional rounding during accumulation. It cannot
recover information already lost when the source values were first rounded to
inexact representations. The resulting claim is exact with respect to the
stored machine values, not necessarily with respect to the intended physical or
decimal quantities.

A numerically small discrepancy may become material in context. The two orders
of summing the `oscillate` series differ only in trailing digits, but downstream
multiplication by `10^16` exposes a difference of 14. Verification must evaluate
error against later use, scale, and domain tolerance rather than judge the raw
display in isolation.

The choice between exact and inexact arithmetic is contextual. The source
recommends exact arithmetic for financial statements, where approximation errors
are unacceptable, and analyzed inexact arithmetic for scientific computations
when exact calculation costs too much. The durable rule is not one universal
number type: representation, performance budget, error model, and acceptable
output tolerance belong in the problem contract.

### Canonical Source Defects Observed

- The Underflow section says replacing a nonzero value with zero is “not within a
  predictable percentage range” of the true result. Under the ordinary relative
  error definition, this replacement has a predictable 100% relative error for
  every nonzero true value. Its important distinction is total loss of the
  mantissa and nonzero property, not unpredictability of that particular ratio.
- The *SL Numbers section says plain Racket “renders all real numbers as
  decimals, regardless of whether they are exact or inexact.” Current Racket
  printer documentation instead specifies that exact non-integer reals normally
  print as rational `m/n` forms, while inexact numbers print with decimal or
  exponent notation. The reading claim that unprefixed decimal literals are
  normally inexact and that `#e` requests exact reading is separate and valid.
- “Most programming languages support only approximate number representations
  and arithmetic for numbers” is overbroad as written; the immediately following
  sentence itself describes bounded integer representations, which are exact for
  values inside their range. The approximation discussion applies to common
  representations of non-integer reals.

### Boundaries That Must Survive Derivation

- Mathematical value, valid representation, and concrete encoding are separate
  layers.
- A smart constructor enforces representation invariants; a raw structure
  constructor may not.
- Multiple encodings can denote one value, so structural equality and semantic
  numeric equality differ.
- Finite representation design jointly determines range, precision, rounding,
  overflow, and underflow behavior.
- “Round to nearest” is incomplete without tie, normalization, and exceptional
  policies.
- Arithmetic operations own validation of the results they create.
- Approximation can change termination and branch behavior, not only output
  precision.
- Overflow-to-infinity and underflow-to-zero are semantic policies, not ordinary
  numeric values silently interchangeable with mathematical results.
- Exactness is a property of represented values and operations, not of decimal
  appearance.
- Reassociation, reordering, parallel reduction, and “equivalent” algebraic
  simplification may change inexact results.
- Tolerance must be derived from the claim and downstream use; it is not a generic
  substitute for equality.
- Exact accumulation over converted floats preserves the stored values, not the
  pre-rounding intent.
- Numerical green evidence from one input order or magnitude distribution does
  not establish stability across orders and scales.
- The exact/inexact choice is a domain and cost decision.

### Developer Comparison

| Packaged claim or use | Source location | Preliminary decision |
| --- | --- | --- |
| Representation constraints and mathematical meaning should be modeled separately. | Fixed-Size Number Arithmetic | directly supported |
| Structurally unequal numeric encodings must denote different values. | equivalent `Inex` examples | contradicted |
| A successful constructor call proves arithmetic results cannot overflow later. | Overflow | contradicted |
| Small numeric discrepancies are harmless when their printed difference is tiny. | Exercises 419-420 | contradicted by order and downstream-scale examples |
| Algebraic reassociation is behavior-preserving for inexact arithmetic. | Exercises 419-420 | contradicted |
| Sorting values from smallest to largest universally fixes floating summation. | Exercise 419 | contradicted explicitly |
| Converting machine values to rationals reconstructs their intended source values. | Exercise 419 | not supported; it preserves already-rounded values |
| Numerical tolerances should be chosen from the consuming domain. | closing comparison of finance and science | directly supported |

### Provisional Repair Notes

- Add representation range, precision, rounding, overflow, underflow, and
  exceptional-value policies to numeric problem-model calibration.
- Add noncanonical encodings and smart-constructor ownership to representation
  barrier provenance.
- Add order, magnitude, accumulated error, termination, and downstream
  amplification to numerical verifier selection.
- Qualify behavior-preserving structural changes: reassociation, reordering, and
  parallelization require numerical evidence when operations are inexact.
- Treat exact conversion as a statement about stored machine values, not recovery
  of lost intent.
- Exclude the underflow percentage claim, plain-Racket printing claim, and
  overbroad all-numbers approximation sentence from final derivations.

## Part V: Generative Recursion

**Part opening read:** complete. The opening distinguishes recursion on immediate
data components from recursion on newly generated instances of the same problem.
It frames algorithms as problem representation, generation or division into
subproblems, recursive solution, and combination. The ordinary recipe remains
useful, but the generation step may require domain insight and must be explained
for implementers and future readers.

**Source anchor:** `part_five.html#%28part._part~3afive%29`

The claim that generative recursion is “strictly more powerful” is read as a
claim about the direct structural design discipline presented so far, not as a
license to ignore data definitions or proof obligations. The chapters themselves
continue to use structural functions as helpers and to depend on representation,
purpose, and invariants.

### Chapter 25: Non-standard Recursion

**Read:** complete Chapter 25, sections 25.1-25.2.

**Source anchor:** `part_five.html#%28part._ch~3astrange-recursions%29`

**Visual and structural inspection:** all four rejected direct templates for
`bundle`, the `take`/`drop` implementation, the quick-sort implementation and
hand evaluation, and Figure 148's divide/conquer tree. The diagram confirms that
each distinct pivot is removed from its descendants and that sorted child
results are recombined around the pivot; it does not establish balanced
partitions or general performance. The Chapter 25 asset-manifest SHA-256 is
`d7e68daf9f3001bf4a5e3e542c49b000ddc3d44dc2dedde706b1495d9db8a7c8`.

#### Argument Reconstructed

`bundle` first exposes a specification choice that data shape cannot settle. If
the input length is not divisible by the chunk size, the remainder could be
placed at the beginning, at the end, or distributed by another policy. The
chapter chooses a final short chunk. Empty input similarly could mean an empty
list or a list containing an empty string; the selected result is part of the
contract, not a consequence of list recursion.

The standard multi-input templates do not directly express the chosen process.
Neither input is irrelevant, plain lockstep traversal cannot reset the chunk
counter, and a full Cartesian template treats the inputs as more independent
than the purpose permits. The failure is specific to the current interface and
direct templates: it does not prove that no structurally recursive helper with
additional state could implement chunking.

The generative idea is “take up to `n` items, emit them, and drop up to `n`
items.” The recursive call receives `drop s n`, not the immediate `rest s` from
the list definition. For `n = 1` this process specializes to ordinary structural
recursion; for larger positive `n`, it advances through a generated suffix. A
generated subproblem need not be an arbitrary rearrangement—it may be a larger
structural step that still preserves sequence order.

The displayed signature admits all natural numbers, but the implementation
makes progress only for positive chunk sizes. At `n = 0`, `take` emits an empty
chunk, `drop` returns the original non-empty input, and `bundle` recurs forever.
Exercise 421 deliberately exposes this contract gap. A usable API must narrow the
input to positive naturals or check zero and define an explicit failure result.

Quick-sort introduces divide-and-conquer. A non-empty list selects its first item
as pivot, partitions the input into values smaller and larger than the pivot,
recursively sorts those generated lists, and appends the smaller result, pivot,
and larger result. The driver is generative even though `smallers` and `largers`
are ordinary structurally recursive helpers.

The recursive calls are not on the input list's immediate `rest`; they are on
filtered collections whose membership is selected by a relation to the pivot.
Thus “ignores structure” means the recursive problem decomposition does not
mirror the list data definition. It does not mean the implementation never uses
`first`, `rest`, or structural traversals.

Under the chapter's distinct-number assumption, strict smaller/larger partitions
exclude the pivot and are both shorter than the input. That gives a termination
argument for the pictured process. Termination depends on the partition contract:
a later duplicate-preserving or custom-comparator variant must still ensure that
no recursive partition retains every element including the pivot.

The initial quick-sort is intentionally incorrect for duplicate inputs. Both
strict partitions discard every value equal to the pivot, while only one pivot
is reinserted, so the result may be ordered yet shorter than the input. Sortedness
alone is pass-but-wrong evidence; a sorting contract also needs input
preservation, no additions, and multiplicity preservation.

The chapter's speed motivation is conditional. Quick-sort can reduce problems
rapidly when pivots produce useful partitions, but the diagram proves neither
balance nor an asymptotic improvement for every input. Pivot quality, duplicate
policy, repeated partition traversals, append cost, and small-input overhead all
matter. The proposed hybrid switches to a simpler sort below a threshold,
showing that algorithm selection may vary by problem scale.

#### Contract Gap Deliberately Exposed

- `bundle` is declared with `N`, but the implementation does not terminate for a
  non-empty input and `n = 0`. Because Exercise 421 asks the reader to diagnose
  this exact case, it is treated as an intentional open contract boundary rather
  than an accidental canonical typo. Final derivations must nevertheless use a
  positive-size precondition or checked failure branch.

#### Boundaries That Must Survive Derivation

- Data shape does not decide remainder placement, empty-result policy, or other
  domain choices.
- Failure of a direct structural template does not prove that no structural
  helper or enriched state model can solve the problem.
- Generative recursion is identified by generated recursive problem instances,
  not merely by taking more than one list step.
- A generated instance may still be an ordered suffix or other integral portion
  of the original input.
- Every generation rule needs a progress argument over its accepted domain.
- A signature that admits zero is incompatible with a process whose measure
  decreases only for positive step sizes.
- A generative driver may collaborate with structurally recursive partitioning
  helpers.
- Divide, recursively solve, and combine are separate obligations.
- Partition membership, pivot exclusion, and recombination jointly determine
  sorting correctness and termination.
- Ordered output does not prove permutation or multiplicity preservation.
- A worked recursion tree demonstrates one execution shape, not general balance
  or complexity.
- Hybrid algorithm thresholds express a cost tradeoff, not a semantic difference
  in the sorting result.

#### Developer Comparison

| Packaged claim or use | Source location | Preliminary decision |
| --- | --- | --- |
| Generative recursion works on newly produced problem instances rather than necessarily immediate data components. | Part V opening and §§25.1-25.2 | directly supported |
| Any recursion that skips multiple list cells is unrelated to structural data. | §25.1 | contradicted; `drop` still returns an ordered suffix |
| A failed direct template proves structural helpers cannot contribute. | Figures 146-149 | contradicted by `take`, `drop`, `smallers`, and `largers` |
| A generation rule must make progress on every accepted recursive input. | Exercise 421 and quick-sort diagram | directly supported |
| Sortedness alone verifies a sorting algorithm. | Exercise 428 | contradicted by duplicate loss |
| One balanced quick-sort example proves general speed. | Figure 148 and Exercises 427-428 | not supported |
| Different problem sizes may justify different algorithms behind one result contract. | Exercise 427 | directly supported |

#### Provisional Repair Notes

- Define the generative-recursion trigger by the origin of recursive subproblems,
  not by recursion depth or the use of non-selector helpers.
- Preserve structural helpers inside generative designs rather than presenting
  the categories as mutually exclusive at whole-program level.
- Require accepted-domain progress, including zero-step counterexamples, beside
  every generation rule.
- Add sorting multiplicity to pass-but-wrong calibration and keep it separate
  from orderedness.
- Treat partition balance and hybrid thresholds as performance evidence that
  requires representative input distributions.

### Chapter 26: Designing Algorithms

**Read:** complete Chapter 26, sections 26.1-26.4.

**Source anchor:** `part_five.html#%28part._ch~3adesign-algo%29`

**Visual and structural inspection:** the four-question generative blueprint,
quick-sort combination table, two-part recipe tables, reduction of the generic
template to structural list recursion, structural GCD search, and Euclidean GCD
trace. All figures in this chapter are HTML-native code or tables; there are no
raster assets.

#### Argument Reconstructed

The generative recipe retains problem representation, signature, purpose,
examples, definition, and tests, but changes what several steps must communicate.
Representation can enable or obstruct the intended process, so algorithm design
may require planning ahead or backtracking to a different model. The purpose
must explain both what result is computed and the non-structural “how” that
generates subproblems.

Worked examples have two roles. Input/output examples specify the extensional
contract, while process examples expose pivot choices, partitions, generated
problems, and recombination. A trace or diagram is explanatory process evidence;
it does not replace result tests across boundary and counterexample classes.

The chapter's generic algorithm form separates four questions: what problems are
trivially solvable, how those are solved, how nontrivial problems generate one or
more easier instances, and whether recursive solutions are returned directly or
combined with each other and original problem data. “Trivial” is a technical
base-case classification, not a claim that its code or domain meaning is
unimportant.

The template is explicitly suggestive rather than mandatory. An algorithm may
generate one problem or several; combination may be identity, as in Euclid's
GCD step, or may use original data, as in reinserting a quick-sort pivot. The
four answers must be made concrete through the selected representation and
collaborating functions.

Generative recursion adds an explicit termination obligation. Structural
recursion over finite inductively constructed data inherits a well-founded
measure from immediate components. Generated problems have no such automatic
connection. A valid progress argument must identify a well-founded measure and
show that every recursive call decreases it, not merely call the new problem
“easier” or “smaller.”

When termination cannot be established for all accepted inputs, the alternative
is to exhibit and explain divergence and, ideally, characterize its input class.
The repeating `bundle` evaluation proves that positive non-empty input with a
zero chunk size returns to the identical call. A termination comment documents
this fact but does not enforce it; a checked API must reject the bad class or
narrow the signature.

The chapter acknowledges that termination is undecidable in general. This does
not prevent exact termination predicates for particular programs such as
`bundle`. Nor does one diverging example establish the complete divergence
class of an arbitrary algorithm. Proof, counterexample, and unknown status are
distinct outcomes.

Quick-sort demonstrates guarantee placement. A partition helper changed from
`<` to `<=` can include the pivot itself; because the original helper receives
the whole list, the recursive problem may equal the input and loop. Passing the
pivot-free `rest` into both partition helpers establishes a stronger
construction-level guarantee: every generated partition is bounded by a list
already shorter than the original, even as membership policy evolves.

Random retry needs a different termination claim. The earlier `food-create`
process can repeatedly generate the forbidden position. If each draw is
independent with a nonzero chance of success, termination may hold with
probability 1 while no finite execution bound or per-run guarantee exists.
“Almost surely terminates,” “terminates for every random stream,” and “has
bounded expected retries” are separate claims.

The generic template can be specialized to structural recursion by choosing an
ordinary data base case and an immediate component as generator. Formally,
structural recursion is included in the larger shape. Keeping the design methods
separate remains useful because they demand different knowledge: structural
design derives control shape from data analysis and naturally supplies progress,
whereas generative design needs a problem-solving insight, explanation, and
independent termination argument.

The GCD comparison separates result equivalence from process and cost. A
structural version counts downward from the smaller input and tests every
candidate divisor. Euclid's algorithm relies on the theorem
`gcd(L,S) = gcd(S,remainder(L,S))`, preserves the answer without a combination
step, and decreases the second argument to zero. The local workhorse establishes
`L >= S >= 0`; `remainder(L,S) < S` supplies its well-founded measure.

For the displayed large input, the Euclidean process performs nine remainder
steps while the countdown checks tens of millions. This trace is strong evidence
for that case and illustrates the mathematical insight, but it is not by itself
a universal benchmark or complexity proof.

Algorithm choice includes correctness, design cost, readability, and measured
performance. Generative recursion is not automatically faster; pivot behavior
can make quick-sort poor, and a simple structural sort can win on small inputs.
The chapter recommends starting with the simpler structural design when both
meet the contract, then considering a generative replacement when task-relevant
measurements show an actual cost problem.

Crossover measurements are contextual. They depend on implementation, hardware,
input size and distribution, comparator cost, and pivot policy. Random tests
alone can miss ordered input, duplicates, or adversarial partitions; a hybrid
threshold inferred from them is not a universal constant.

#### Canonical Source Defects Observed

- Section 26.4 calls `sort<` and the chapter's `quick-sort<` observably
  equivalent for lists of numbers without restating the latter's distinct-number
  precondition or assuming the duplicate-preserving repair from Exercise 428.
  The displayed Figure 149 implementation is not equivalent on duplicate inputs.
- Exercise 444 expands GCD as “greatest common denominator.” The established term
  and the chapter's own preceding usage are “greatest common divisor.”
- Figure 152's activity text says “problem data for each recursive data”; the
  intended object is each recursive call or generated problem.

#### Boundaries That Must Survive Derivation

- A generative purpose explains both result and generation strategy.
- Process examples and result examples provide different evidence.
- The trivial/generate/solve/combine template is a question checklist, not a
  required syntax tree.
- “Easier” becomes a termination proof only through a well-founded decreasing
  measure for every recursive call.
- Termination comments document but do not enforce accepted-domain safety.
- A divergence witness, a complete divergence classification, almost-sure
  termination, and universal termination are distinct claims.
- Tests cannot prove termination in general.
- Progress guarantees are more robust when enforced by subproblem construction,
  such as partitioning an already pivot-free list.
- Structural and generative recursion may share a formal template while remaining
  different design methods with different evidence obligations.
- Observable result equivalence must use the same domain and full contract before
  implementation processes can be substituted.
- A preserving equation such as Euclid's supplies semantic justification; size
  decrease supplies termination. Neither substitutes for the other.
- One timing trace does not establish general complexity or a portable crossover
  threshold.
- Optimize after task-relevant evidence, while retaining the simpler design when
  it already satisfies the cost contract.
- Random performance generation should be supplemented by boundary and
  adversarial shapes.

#### Developer Comparison

| Packaged claim or use | Source location | Preliminary decision |
| --- | --- | --- |
| A generative design must state trivial cases, generation, recursive solving, combination, and termination. | §§26.1-26.2 | directly supported as a question set |
| Calling a generated problem “smaller” is a sufficient progress argument. | §26.2 | too weak; a decreasing well-founded measure is required |
| A termination warning makes an unsafe accepted input safe. | `bundle` comment and Exercise 433 | contradicted |
| Partitioning the pivot-free remainder can make quick-sort progress robust to helper changes. | Exercises 434-435 | directly supported |
| Structural and generative methods should be collapsed because one template can encode both. | §26.3 | contradicted explicitly |
| Equivalent outputs imply equal cost and equal evidence obligations. | §26.4 | contradicted by GCD and sorting comparisons |
| A measured need should precede replacing a sufficient structural design with a more insight-heavy algorithm. | §26.4 | directly supported |
| Random benchmark cases alone establish a universal hybrid threshold. | Exercises 441-442 | not supported |

#### Provisional Repair Notes

- Expand generative design cards with separate result examples, process traces,
  preserving relation, well-founded measure, and combination rule.
- Distinguish documented nontermination from checked-domain enforcement.
- Add probabilistic termination vocabulary for retry-based generation.
- Prefer construction-level progress guarantees over fragile helper comments.
- Require common domain and full behavioral contract before claiming observable
  equivalence.
- Route structural-to-generative replacement through measured cost pressure and
  adversarial performance cases, not generic algorithm prestige.
- Exclude the duplicate-insensitive equivalence claim and GCD terminology typo
  from final derivations.

### Chapter 27: Variations on the Theme

**Read:** complete Chapter 27, sections 27.1-27.3.

**Source anchor:** `part_five.html#%28part._ch~3agen-rec-samples%29`

**Visual and structural inspection:** the full, base, and one-step Sierpinski
triangles; image composition from three half-sized copies; the continuous root
bracket and midpoint; and the matrix-dimension formula. The images confirm
self-similar composition and interval narrowing, but do not prove recursive
termination, continuity, root uniqueness, or numerical stability. The Chapter 27
asset-manifest SHA-256 is
`f56034ed0d179ec0df7dd3da1ed4461ddaea8877f436be69c15967af68b6325b`.

#### Argument Reconstructed

The chapter presents three different generation relations: scale an image
problem, halve a theorem-backed search interval, and remove a delimiter-bounded
prefix. The common shape is not a particular data type or syntax. Each process
needs a preserving relation between original and generated problem, a base
criterion, and a progress argument appropriate to its domain.

The Sierpinski example offers two legitimate process models. A geometric model
subdivides one triangle into four and recurs on the outer three. The selected
image-composition model instead recursively computes one half-sized image and
places three copies with `above` and `beside`. Equivalent target images do not
imply identical generation, intermediate data, or cost.

The local `half-sized` binding computes the recursive result once and reuses the
immutable image three times. Writing three recursive calls would describe the
same mathematical composition but repeat the entire subproblem. A collaboration
or local name can encode common-subproblem sharing, not merely improve spelling.

Sierpinski's visual cutoff is a domain policy. `SMALL` says when further detail
is pointless at the chosen pixel scale; it is not derived from triangle data
shape. For finite positive `side` and positive `SMALL`, repeated halving reaches
the base condition. The displayed `Number` signature is broader than this
termination argument and intended image domain.

The root finder derives its generation rule from the Intermediate Value Theorem.
For a continuous function whose endpoint values bracket zero, evaluating the
midpoint identifies at least one half that still brackets a root. Recursion
returns that half's answer directly; no combination step is needed. The theorem
justifies root preservation, while interval width supplies progress.

The result contract is spatial: return a left boundary `R` such that a root lies
in `[R,R+ε]`. It does not promise that `R` itself is a root or that `|f(R)|` is
small. A steep function can have a narrow root-containing interval while its
left endpoint has a large residual. Location tolerance and residual tolerance
require different verifiers.

The bracketing condition establishes existence, not uniqueness. An interval may
contain several roots, and a root can exist without opposite endpoint signs.
The algorithm promises one retained root only for inputs satisfying its stated
bracket invariant; it is not a complete root enumerator or root-existence test.

Termination by interval halving requires ordered finite bounds and a strictly
positive tolerance. With exact endpoints, width becomes `S/2^k` and eventually
falls below positive `ε`. With `ε = 0`, exact bisection need never reach width
zero. With inexact endpoints and a tolerance below machine resolution, the
midpoint can round to an existing boundary, so a recursive call may stop making
progress. A mathematical size proof and a machine-arithmetic progress check are
separate obligations.

The root implementation repeatedly evaluates `f` at unchanged boundaries. Local
hoisting removes same-stage duplication; carrying endpoint values into a helper
reuses them across stages. This optimization assumes `f` is stable and
side-effect free. For a time-varying or effectful observer, memoizing a call can
change behavior and must be justified by a stronger function contract.

The table exercise transfers interval search from continuous numbers to discrete
natural indices. Its `length` field defines the valid domain of the `array`
function, and integer midpoint/base cases must ensure every lookup remains in
`[0,length)`. The representation permits the underlying function to accept more
indices, but clients may not infer those extra values from the table contract.
Conversely, the shown `table-ref` does not enforce the bound, so validity remains
a caller obligation.

Discrete “root” search also needs a precise closeness predicate and selection
contract. Finding any close-to-zero entry differs from finding the smallest such
index. Strictly increasing values make order useful, but the binary decision and
boundary conditions must preserve the smallest-index claim, not merely find a
nearby value.

The file example uses delimiter-guided generation. `first-line` returns the
prefix before newline and `remove-first-line` removes that prefix plus the
newline when present. The recursive driver receives the remaining file, while
both helpers are structurally recursive. This is another generative driver built
from structural collaborators.

Line splitting has observable boundary policy. Empty input produces no lines; a
leading or consecutive newline produces an empty line; a trailing newline closes
the preceding line but does not add another empty line; and a final unterminated
segment still becomes a line. These cases distinguish plausible parsers that
agree on ordinary files.

The `File` alternatives overlap because newline is itself a `1String`. The
interpretation gives the distinguished newline case precedence over the generic
character case. This is a valid catch-all only after the special delimiter has
been tested.

Termination follows because every non-empty file loses at least one item:
newline-first input loses the delimiter, a later newline loses a non-empty
prefix and delimiter, and input without newline becomes empty. Merely saying
“remove a line” would be too vague; the empty-line case requires proving that the
delimiter itself is consumed.

The source explicitly limits this example to a glimpse of parsing. Delimiter
segmentation does not establish grammar validation, ambiguity handling, source
locations, diagnostics, or recovery behavior for a production parser.

#### Canonical Source Defects Observed

- Section 27.1 uses `s-triangle` in three interaction snippets without defining or
  introducing it. The surrounding implementation uses `triangle` and later
  defines `sierpinski`; the snippets are not independently reproducible.
- Figure 159 references the global constant `ε`, but Chapter 27 provides no
  definition for it. The function requires an external positive tolerance before
  it can run.
- Exercise 448 says Figure 159 terminates for all continuous functions and
  endpoint pairs satisfying the sign assumption. This omits necessary conditions
  including `left < right`, finite ordered bounds, and `ε > 0`; inexact midpoint
  stagnation can require an additional machine-progress base case.
- The Sierpinski signature accepts every `Number`, while its stated legal-domain
  and termination argument cover positive sides and silently require finite
  values. Positive infinity remains unchanged by halving and does not reach a
  positive finite `SMALL` cutoff.

#### Deliberate Partial-Function Boundary

- `Table` stores a field described syntactically as `[N -> Number]`, yet `table2`
  deliberately raises an error outside index 0 and validity is restricted by the
  separate `length` field. This is best read as a length-indexed partial-function
  contract that the simple function signature cannot express. `table-ref` does
  not check the bound, so final derivations must not present it as runtime-safe
  arbitrary indexing.

#### Boundaries That Must Survive Derivation

- Similar outputs can arise from different generation models with different
  intermediate representations and costs.
- Binding one recursive result for multiple uses can prevent duplicate subproblem
  execution.
- Visual resolution thresholds are product policies, not structural facts.
- A theorem-backed preserving relation and a decreasing measure prove different
  parts of an algorithm.
- Root bracketing proves existence under continuity, not uniqueness or exhaustive
  discovery.
- Interval-width and function-residual tolerances are different contracts.
- Mathematical halving does not guarantee floating-point midpoint progress.
- Cached function evaluations require stability and purity assumptions.
- Function-backed arrays need explicit valid-index ownership even when their
  underlying function accepts a wider domain.
- “Find any” and “find the smallest index” require different binary-search
  invariants.
- Leading, consecutive, trailing, absent, and final delimiters define distinct
  parser boundary cases.
- Overlapping data alternatives require ordered interpretation.
- Delimiter consumption, not only prefix removal, establishes progress on empty
  lines.
- Token splitting is not evidence of a production grammar parser.

#### Developer Comparison

| Packaged claim or use | Source location | Preliminary decision |
| --- | --- | --- |
| One generated result may be shared across several combination positions. | §27.1, local `half-sized` | directly supported |
| A continuous sign-changing bracket preserves at least one root under midpoint selection. | §27.2 | directly supported under the IVT assumptions |
| A narrow interval guarantees a small function residual at its returned endpoint. | `find-root` contract | contradicted; the guarantee is spatial |
| Halving always terminates even with zero tolerance or inexact midpoint stagnation. | Exercise 448 | contradicted |
| Reusing a prior function result is behavior-preserving for arbitrary observers. | Exercise 449 | not supported; stability is assumed |
| Binary search for any qualifying value automatically finds the smallest index. | Exercise 451 | not supported; smallest-index preservation is additional |
| Empty, leading, consecutive, and trailing delimiters may be tested interchangeably. | §27.3 boundary examples | contradicted by distinct output policies |
| A delimiter splitter supplies the obligations of a full parser. | §27.3 closing scope | contradicted explicitly |

#### Provisional Repair Notes

- Add preserving theorem/relation and machine-level progress as separate fields in
  generative-recursion guidance.
- Distinguish location tolerance, residual tolerance, and representation progress
  in verifier selection.
- Add shared recursive-result binding as an execution-cost decision, not merely a
  local naming style.
- Require purity or stability before hoisting repeated generated observations.
- Add ordered finite bounds, positive tolerances, and midpoint-stagnation cases to
  binary-search calibration.
- Add function-backed index domains and smallest-match invariants to abstraction
  barrier and search references.
- Add delimiter boundary matrices to parsing examples while preserving the
  source's explicit non-production scope.
- Exclude the undefined `s-triangle`, missing `ε`, and overbroad termination
  claims from final derivations.

### Chapter 28: Mathematical Examples

**Read:** complete Chapter 28, sections 28.1-28.3.

**Source anchor:** `part_five.html#%28part._ch~3agen-rec-math%29`

**Visual and structural inspection:** all 39 raster assets, including the
finite-difference slope and tangent-root derivation, Newton failure graph,
velocity/distance plots, integration regions, trapezoid and midpoint formulas,
adaptive-integration candidate, and every Gaussian-elimination equation system
and back-substitution step. The figures confirm the intended algebra and the
specific inconsistent system; they do not prove convergence, approximation
error bounds, numerical stability, or uniqueness. The Chapter 28 asset-manifest
SHA-256 is
`70333e834000c05e74857044b775f9c37ed932c7a091f712a06b7d8a360a20d2`.

#### Argument Reconstructed

The chapter's three examples translate mathematical knowledge into generation
rules: Newton's tangent update, recursive interval refinement for integration,
and solution-preserving row transformations for Gaussian elimination. In each
case the mathematics supplies more than a formula. It supplies assumptions,
preserving claims, stopping criteria, and known failure modes that must survive
translation into code.

Newton's method generates a new root guess from the root of a tangent at the
current guess. The displayed implementation approximates the derivative with a
symmetric finite difference, computes `r - f(r)/slope(f,r)`, and stops when
`|f(r)| <= ε`. Its result contract is residual-based, unlike Chapter 27's
root-containing interval contract.

The same symbol `ε` plays two conceptually different roles in the presentation:
it is the finite-difference step used to estimate slope and the accepted residual
used to stop Newton iteration. These quantities have different units, error
tradeoffs, and calibration pressures. A production numerical contract should
name and tune derivative-step and residual tolerances separately.

Newton generation does not carry a simple universal decreasing measure. A zero
or near-zero slope makes the tangent update undefined or enormous; an initial
guess may converge to different roots, cycle, diverge, overflow, or enter
non-finite states. Convergence requires conditions on the function, derivative,
initial guess, and arithmetic, not merely repeated application of the update.

The exact and inexact examples distinguish slow progress from divergence. An
exact rational start near the flat point can build costly rational computations
and appear stuck while still computing. An inexact start at the flat point
produces infinity and then NaN; comparisons with NaN never satisfy the residual
base case, so the process repeats non-finite values. Runtime error, excessive
cost, divergence, and successful convergence are separate outcomes.

Figure 161's `check-within` tests compare the returned number with known root
locations. The function's stated contract instead asks whether `|f(r)| <= ε`.
For the selected polynomial these claims are related locally, but in general a
small residual does not guarantee a root-location error of at most the same
numeric tolerance. The direct verifier should test the residual claim; a
location test needs additional conditioning knowledge.

Numerical integration begins with exact examples whose mathematical integrals
are known, then changes to `check-within` because the algorithms are approximate.
Constant, linear, and quadratic functions provide useful calibration oracles,
but passing three smooth examples does not establish a generic integration error
bound.

The fixed methods embody different sampling policies. Kepler's method compares a
small fixed number of trapezoids. The midpoint-rectangle method selects a global
rectangle count `R`, samples every interval uniformly, and trades more calls for
potentially smaller discretization error. More samples are not inherently
monotonic evidence of greater accuracy for every function; regularity, sampling
alignment, floating error, and the chosen rule matter.

The basic divide-and-conquer integrator refines every region based on interval
size. Adaptive integration instead compares one coarse trapezoid with the two
half-interval trapezoids and refines only where their discrepancy exceeds a
local area tolerance. Its guaranteed behavior is allocation according to this
estimator, not correctness of the estimator itself.

Agreement between coarse and refined samples is a heuristic error signal. A
function can oscillate between sample points or exhibit cancellation so that the
estimates agree while both are wrong. The source explicitly withholds a
termination discussion and asks whether adaptive integration always improves the
answer. Final derivations must not turn this exercise into a universal accuracy
or termination theorem.

The integration prose calls the quantity “area under the curve,” while the
trapezoid formulas compute a signed definite integral when function values are
negative. Geometric unsigned area and signed accumulation agree for the positive
examples but are different contracts for curves that cross the axis.

Gaussian elimination starts with a constrained representation: a non-empty
square system has `n` rows of `n+1` coefficients, and column position carries
variable identity. Variable names can be omitted only because consistent column
order preserves the equations under renaming. Matrix shape and column meaning
are representation invariants, not incidental list lengths.

Candidate verification substitutes a solution into every equation. For exact
coefficients this directly checks satisfaction, but it establishes neither
uniqueness nor that an algorithm will find a solution. For inexact coefficients,
raw numeric equality needs replacement by a domain-scaled residual criterion.

Triangulation generates a smaller system by replacing rows with suitable linear
combinations and dropping the newly zero leading column. The recursive input is
not an immediate part of the original matrix; it is a transformed matrix whose
solution set is preserved by a mathematical row-operation theorem. The number of
remaining equations supplies progress once a usable pivot is available.

A zero pivot reveals that generation and progress depend on a stronger
precondition than matrix shape. Row swapping preserves the solution set and may
move a nonzero coefficient into pivot position. Rotation must be bounded by the
number of remaining rows; otherwise a column with no usable pivot cycles forever.

An all-zero pivot column does not universally mean “no solution.” The pictured
system is inconsistent because its reduced equations demand both `2z = 6` and
`-z = 0`, but a singular system may instead have redundant equations and
infinitely many solutions. The teaching algorithm treats absence of a pivot as
an error and does not classify rank, inconsistency, or free variables.

Choosing any nonzero pivot is sufficient for the exact algebra developed here.
With inexact arithmetic, a very small pivot can amplify error; practical Gaussian
elimination uses stronger pivot-selection and numerical-stability policies. The
source's exact row-preservation argument must not be generalized unqualified to
floating behavior.

Back-substitution is structurally recursive over the triangular matrix. It solves
the last variable, then uses the known suffix solution to solve preceding rows.
The final `gauss` composition therefore separates a generative transformation
phase from a structural consumption phase behind one solver contract.

#### Canonical Source Claims Requiring Qualification

- The Newton introduction says that repeating tangent-root improvement
  sufficiently often can find a root and attributes this fact to Newton without
  stating convergence hypotheses. The section's own zero-slope, infinity, NaN,
  and divergence examples show that this is not a universal claim.
- Exercise 459 says that using more rectangles makes the estimate closer to the
  actual area. This is a useful expectation for suitable integrands and a
  convergent rule, not a monotonic guarantee for arbitrary functions or finite
  precision.
- The adaptive section says estimator agreement makes it “safe to assume” the
  coarse area is good. No function class or error theorem is supplied; the test
  is a refinement heuristic and can be fooled by unsampled behavior.

#### Deliberately Incomplete Contracts

- Figure 161 documents successful Newton output but has no iteration limit,
  zero-slope branch, non-finite check, or convergence precondition. The text
  deliberately explores these failures rather than repairing the API.
- `triangulate` is initially typed `SOE -> TM`, then exercises reveal zero pivots
  and no-pivot systems that must signal errors. The final usable contract needs a
  solvability/full-rank precondition or an explicit checked result type.

#### Boundaries That Must Survive Derivation

- A mathematical update formula does not imply convergence from every initial
  state.
- Derivative-step, residual, location, and integration-error tolerances are
  different quantities.
- Slow exact computation, runtime failure, divergence, cycling, and non-finite
  propagation need distinct statuses.
- A verifier should observe the stated residual contract rather than substitute
  root-location proximity without conditioning evidence.
- Known-function integration tests calibrate examples but do not prove a generic
  error bound.
- Sample count alone is not an accuracy guarantee.
- Adaptive estimator agreement governs work allocation, not necessarily true
  error.
- Signed integration and geometric area differ when the function crosses below
  zero.
- Matrix shape, column order, and pivot availability are separate invariants.
- Row operations need both a solution-preservation argument and a progress
  argument.
- Pivot search must terminate when no pivot exists.
- No pivot may indicate inconsistency, redundancy, or free variables; one error
  category does not explain all singular systems.
- Exact row equivalence does not establish floating-point numerical stability.
- Candidate satisfaction does not prove uniqueness.
- A generative producer and structural consumer may compose into one algorithm.

#### Developer Comparison

| Packaged claim or use | Source location | Preliminary decision |
| --- | --- | --- |
| Mathematical algorithms require domain assumptions and failure analysis in addition to an update formula. | §§28.1-28.3 | directly supported |
| Newton's update converges for every function and initial guess. | §28.1 termination discussion | contradicted explicitly |
| A root-location `check-within` directly verifies Newton's residual contract. | Figure 161 | not generally supported |
| Increasing a global sample count monotonically improves every integration result. | Exercise 459 | overbroad |
| Adaptive refinement always returns a more accurate answer. | Exercise 461 | challenged explicitly |
| Algebraic row replacement and row swapping preserve the solution set. | §28.3 | directly supported for exact arithmetic |
| A candidate satisfying all equations proves the system has a unique solution. | Exercise 462 | contradicted; uniqueness is not checked |
| Failure to find a pivot always means no solution exists. | Exercises 467-468 | contradicted for singular underdetermined systems |
| Generative transformation can feed a structurally recursive finishing phase. | Exercises 469-470 | directly supported |

#### Provisional Repair Notes

- Add update preconditions, convergence status, iteration budget, non-finite
  handling, and separate tolerance roles to numerical generative-recursion cards.
- Add residual-versus-location verifier selection and conditioning requirements.
- Treat integration tests as calibration against known oracles plus adversarial
  sampling cases, not generic proof.
- Preserve adaptive-estimator limits and the source's intentionally unresolved
  termination question.
- Add matrix shape, pivot search bounds, rank outcomes, and exact-versus-inexact
  stability to problem-modeling provenance.
- Use Gaussian row operations as a preserving-relation example only with their
  algebraic preconditions.
- Add composed generative-producer/structural-consumer as a mixed-process pattern.
- Exclude universal Newton convergence, monotonic rectangle accuracy, and
  estimator-safety wording from final derivations.

### Chapter 29: Algorithms that Backtrack

**Read:** complete Chapter 29, sections 29.1-29.2.

**Source anchor:** `part_five.html#%28part._ch~3abacktrack%29`

**Visual and structural inspection:** the acyclic and cyclic directed graphs,
queen threat lines, all three representative dead-end placements on a 3-by-3
board, valid 4- and 5-queen boards, and the second 4-queen solution. The graph
figures confirm edge direction and the added `C -> B` cycle; the boards confirm
specific placements but do not prove search completeness or representation
invariants. The Chapter 29 asset-manifest SHA-256 is
`6f3637375c1ce72b4e532822cfee01d9f920947cb9052b5262dfbcc9a4e5e9b8`.

#### Argument Reconstructed

Backtracking treats a generated choice as provisional. It explores one candidate;
if that candidate returns explicit failure, it resumes at the most recent choice
point and tries the remaining candidates. A branch that diverges or raises an
unhandled error does not return failure and therefore prevents backtracking to
later alternatives.

The graph problem first resolves output ambiguity. A successful `Path` includes
both origin and destination, so a singleton represents the trivial same-node
path. `#false` represents absence because an empty list may be a meaningful path
under other output conventions. Failure and successful empty data must not share
one encoding.

`find-path` and `find-path/list` divide responsibilities. The former generates
path problems from one node's neighbors and prepends the current origin to a
successful candidate. The latter structurally traverses the ordered list of
choices, returning the first successful path and trying the rest only after
`#false`. The overall algorithm combines a generative search driver with a
structural choice enumerator.

Neighbor order is operational policy. On a graph with several valid paths, the
first depth-first branch that returns determines the result. `check-member-of`
correctly admits the two expected `E`-to-`D` paths without requiring a particular
one, but it still assumes that the known list exhausts acceptable outputs for
that fixture.

The first algorithm is total on finite acyclic graphs because every recursive
path extends without revisiting a node, so depth and the number of alternatives
are finite. In a cyclic graph, a branch can regenerate an identical path problem.
The displayed `B -> E -> C -> B` trace repeats before the choice enumerator reaches
other branches, even though a path to `D` exists. Depth-first search without cycle
control can be incomplete operationally: an existing solution is starved by an
earlier divergent branch.

A cycle does not imply divergence for every query or choice order. It creates the
possibility. The relevant claim depends on reachability, neighbor order, target,
and whether the search tracks path-local or globally visited nodes. Chapter 29
diagnoses the problem and defers the cycle-safe variant.

The graph contract also needs integrity assumptions. Origin and destination must
belong to the graph; node entries should be unique; neighbor references should
name represented nodes; and `neighbors` must match the concrete representation.
As written, the same-node base case returns a singleton even for an unknown
symbol because it does not consult the graph.

Graph data abstraction is expressed through `neighbors`. The search does not
need the list encoding when given a graph and its matching observer. This is a
relational abstraction contract: an arbitrary graph value and an unrelated
`neighbors` function are not valid just because their individual signatures
fit. Representation independence depends on the pair satisfying shared laws.

The FSM exercise uses a similar generated state: the problem at each step is the
current machine state plus the unconsumed characters. Progress comes from
consuming input, while transition lookup generates the next state. Termination,
recognition, and determinism depend on transition and final-state contracts, not
only on the recursive shape.

The compact `arrangements` example recursively removes each selected item,
arranges the shorter list, and prefixes the item to every result. `remove`
provides the decreasing measure. With duplicate input values, repeated choices
can generate duplicate output lists, so “all rearrangements” needs either list
multiplicity semantics or a unique-permutations policy.

Its `check-satisfied` predicate checks only that `rat`, `art`, and `tar` occur.
An implementation returning those three plus invalid, duplicate, or missing
permutations can pass. Membership examples are not evidence for cardinality,
completeness, multiplicity, or absence of additions.

The queens project turns the same search shape into constrained placement. A
choice is a currently safe square; `add-queen` generates a board with additional
threatened positions; a recursive failure triggers another square. The remaining
queen count decreases in successful recursive generation, while the candidate
list is structurally exhausted on backtracking.

The Board representation is intentionally postponed until the required
operations are known. A board may store open positions, placed queens, or a grid
with threat status, as long as `board0`, `add-queen`, and `find-open-spots` satisfy
the same behavioral laws. The wished interface shapes representation without
forcing one concrete structure.

Those laws are essential: `board0 n` must enumerate exactly the legal board;
`find-open-spots` must return all and only currently safe legal positions; and
`add-queen` must preserve prior placements while excluding every newly threatened
position. Signatures alone do not establish search soundness or completeness.

Enumerating every list order for a valid placement is rejected as an unusable
test strategy. A solution predicate can instead check length and pairwise
non-threat. To be complete, it must also check every coordinate lies inside the
particular `n`-by-`n` board and treat duplicate positions as conflict. Set-based
comparison is sound only when the lists are already known to represent sets.

A property test for successful output does not alone verify the failure side. A
queens solver needs both valid-placement evidence for solvable sizes and explicit
`#false` evidence for unsatisfiable sizes; performance and completeness over all
sizes remain separate claims.

#### Canonical Source Defects Observed

- The repeated-call argument says random generation is the only exception to
  same-input/same-evaluation behavior. Chapter 22 already introduced file and web
  readers whose results can change for the same argument; other effects can also
  invalidate the statement. `find-path` itself is deterministic, so the cycle
  trace remains valid.
- The queens section calls Figure 173 “solutions for `k = 3` and `n = 2`” without
  defining `k` or establishing a two-parameter puzzle. The figures are partial
  placements of two non-threatening queens on a 3-by-3 board.
- `QP` constrains coordinates with the global constant `QUEENS = 8`, while
  `n-queens` is generalized over arbitrary `n` and immediately tests 4-by-4
  boards. Position validity must depend on the board argument; the global
  8-by-8 range admits illegal coordinates for smaller puzzles.

#### Deliberately Incomplete Contracts

- `find-path` assumes graph membership and representation integrity but does not
  state or check them. Its same-node branch accepts unknown symbols.
- The proposed `n-queens-solution?` bullets mention length and non-threat but not
  board-relative coordinate validity. Combined with the global `QP` range, that
  predicate can accept an off-board placement for `n < QUEENS` unless repaired.

#### Boundaries That Must Survive Derivation

- Backtracking occurs only after an explored branch returns an explicit failure.
- Divergence in an early branch can starve later successful alternatives.
- Choice order affects which valid answer is returned and whether an unsafe
  depth-first search reaches it.
- Success and failure encodings must remain disjoint.
- Acyclic totality and cyclic possibility of divergence are different claims.
- Graph representation independence requires a matching observer and graph laws.
- Search soundness, completeness, termination, and answer-order policy are
  separate obligations.
- Removing one item proves permutation recursion progress but not output
  uniqueness.
- Partial membership predicates do not verify permutation completeness or
  absence of additions.
- A backtracking driver can be generative while its choice traversal is
  structural.
- Board operations form a behavioral interface; signatures alone do not make
  different representations substitutable.
- Queen validity includes cardinality, board bounds, and pairwise non-threat.
- Set equality requires set-representation invariants or explicit duplicate
  handling.
- Successful-solution properties and unsatisfiable-case evidence are both needed.

#### Developer Comparison

| Packaged claim or use | Source location | Preliminary decision |
| --- | --- | --- |
| Backtracking tries the next candidate after the current candidate returns failure. | §29.1 and §29.2 | directly supported |
| A later valid branch guarantees depth-first search will return it. | cyclic graph trace | contradicted by divergence starvation |
| Any cycle makes every path query diverge. | §29.1 termination discussion | contradicted; the source says “may” for some inputs |
| An accessor parameter alone establishes representation independence. | data-abstraction note | too weak; graph and observer must match |
| Three required permutation members verify all rearrangements. | Figure 171 | contradicted as incomplete evidence |
| Board representation can vary behind stable operations. | Exercises 482-483 | directly supported under behavioral laws |
| Length and non-threat alone validate an arbitrary `n`-queens result. | Exercise 481 read with the `QP` definition | incomplete without board bounds and duplicate treatment |
| Enumerating all concrete output orders is the preferred test for nondeterministic valid results. | Exercise 481 | contradicted explicitly |

#### Provisional Repair Notes

- Add branch outcome, choice order, failure propagation, cycle policy, and visited
  scope to backtracking design guidance.
- Distinguish path soundness, search completeness, termination, and selected-path
  policy in verifier calibration.
- Treat representation abstraction as a graph/observer law bundle rather than
  unrelated parameters.
- Add permutation cardinality, multiplicity, and no-additions checks to
  pass-but-wrong examples.
- Add board-relative bounds and operation laws to the queens property predicate.
- Use queens to illustrate property-based acceptance of multiple valid outputs
  while retaining explicit unsatisfiable cases.
- Exclude the effects-blind repeated-call statement, undefined `k` notation, and
  global `QUEENS` coordinate contract from final derivations.

### Chapter 30: Summary

**Read:** complete Chapter 30.

**Source anchor:** `part_five.html#%28part._ch~3asummary5%29`

**Visual and structural inspection:** prose summary only; the chapter contains no
raster assets, code figures, or additional diagrams.

#### Argument Reconstructed

Part V closes by contrasting structural derivation with “eureka” design.
Generative design starts from a problem-solving idea that constructs recursive
instances related to the original but not necessarily its immediate data
components. The insight may be simple or supplied by a domain specialist, but it
must still be translated into explicit representations, contracts, examples,
and code.

The standard design-recipe outline remains. The coding step adds four questions:
identify a trivially solvable class, determine its solution, generate one or more
new instances for nontrivial inputs, and explain how their solutions produce the
original solution. Calling a generated instance “simpler” remains informal until
a preserving relation and well-founded progress measure are stated.

The summary calls termination a “minor change” to the recipe because it adds one
row rather than replacing the preceding steps. Semantically it is not minor.
Generative recursion may diverge due to the problem-solving idea, an incomplete
accepted-domain contract, numerical behavior, branch order, or a faulty
translation. Future readers need the claim and evidence, not only the code.

A warning about bad inputs is the minimum documentation response. When a boundary
can be checked or narrowed, production design should enforce it through a
precondition, checked constructor, explicit failure result, iteration budget, or
cycle/progress control. Undecidability in general does not excuse leaving known
bad classes unenforced.

The final appeal to specialists reinforces a responsibility split. Deep domain
insight may come from mathematicians or other experts; programmers must still
understand the preserving idea, encode its assumptions, select failure behavior,
and communicate it well enough to implement and verify the algorithm.

#### Claims Requiring Qualification

- “Most computer scientists refer to these functions as algorithms” is useful
  pedagogical shorthand, but algorithm is broader than generative-recursive
  functions and generative recursion is not the only implementation form of an
  algorithm.
- “New problem ... simpler” is not itself a termination argument. The chapter's
  earlier examples require a concrete decreasing measure, probabilistic claim,
  bounded search, or explicit nontermination class.
- A warning is not equivalent to an enforced safe contract when bad inputs are
  recognizable.

#### Boundaries That Must Survive Derivation

- Eureka supplies the generation insight but does not replace the ordinary
  design-recipe evidence.
- Trivial condition, trivial solution, generation, and combination remain
  separate questions.
- Semantic preservation and recursive progress require separate arguments.
- Termination is an additional first-class claim even if it is a small textual
  addition to the recipe.
- Known divergence classes should be enforced where feasible, not merely noted.
- Domain experts may supply the theorem or model; implementation ownership still
  includes assumptions, failures, and verification.
- “Algorithm” must not be reduced to one recursion style.

#### Developer Comparison

| Packaged claim or use | Source location | Preliminary decision |
| --- | --- | --- |
| The ordinary design-recipe steps remain applicable around a generative insight. | Chapter 30, first two bullets | directly supported |
| Eureka eliminates the need to state representation, purpose, examples, or tests. | Chapter 30 | contradicted |
| The four algorithm questions can be collapsed into “recurse on something simpler.” | Chapter 30, coding bullet | contradicted by the four separate obligations |
| A termination warning is always the strongest feasible guarantee. | Chapter 30, termination bullet read with Chapters 25-29 | contradicted when the bad class is checkable |
| Domain-specialist input transfers all implementation responsibility away from programmers. | closing paragraph | contradicted; programmers must turn concepts into programs |

#### Part V Cumulative Judgment

Part V supports a disciplined account of generative recursion rather than a
license for ad hoc recursive calls. A faithful design identifies where generated
problems come from, why solving them preserves or contributes to the original
answer, how solutions combine, and why recursive exploration progresses—or
which inputs, numeric states, or branch orders prevent it.

Structural and generative design coexist at multiple levels. `bundle` generates a
suffix with structural `take` and `drop`; quick-sort generates filtered problems
with structural partition helpers; file parsing removes a generated prefix using
structural scans; Gaussian elimination feeds a generated triangular matrix to
structural back-substitution; and backtracking pairs a generative branch search
with structural choice traversal. Whole programs should not be assigned one
recursion label merely because one collaborator uses it.

The part establishes several distinct correctness obligations. A generation
step may need a theorem-backed preserving equation, as in Euclid or row
operations. Termination needs a well-founded measure, bounded candidate search,
probabilistic qualification, or documented divergence. Combination must preserve
multiplicity and original data where required. Backtracking needs explicit
failure propagation and cycle policy. Numerical algorithms additionally need
finite-state handling, convergence conditions, tolerance meanings, and
machine-progress checks.

The examples also calibrate evidence. An ordered quick-sort result can lose
duplicates. A few permutation members do not prove completeness. A narrow root
interval does not imply a small residual. Known integration examples do not
establish a generic error bound. One timing trace or random benchmark does not
prove complexity. One valid queen placement does not establish board bounds,
unsatisfiable behavior, or search completeness. Green evidence remains
claim-relative.

The strongest faithful workflow is:

1. Model the problem and accepted domain.
2. State the generated-instance relation and process examples.
3. Separate base recognition, base solution, generation, and combination.
4. Prove semantic preservation or contribution to the original answer.
5. Establish progress for every recursive branch, or classify unsupported and
   divergent states.
6. Compose structural helpers where they already own traversal.
7. Verify result properties, failure behavior, and process-specific risks.
8. Prefer the simpler sufficient process until measured or semantic pressure
   justifies a more insight-heavy algorithm.

#### Provisional Repair Notes

- Keep generative-recursion guidance as an evidence-bearing workflow, not a
  generic “recurse on a smaller problem” slogan.
- Make preserving relation, progress measure, branch/failure policy, and
  combination contract explicit artifacts.
- Preserve mixed structural/generative collaboration across function boundaries.
- Add numerical and backtracking failure taxonomies to verifier routing.
- Treat warnings as documentation evidence and checked boundaries as stronger
  runtime evidence.
- Qualify the source's algorithm terminology and “minor” termination wording in
  final derivations.

## Intermezzo 5: The Cost of Computation

**Read:** complete intermezzo, including Concrete Time, Abstract Time; the
formal definition of “On the Order Of”; and the predicate/selector comparison.

**Source anchor:** `i5-6.html#%28part._i5-6%29`

**Visual and structural inspection:** all 36 raster assets, including the
linear/quadratic crossover graph, average and insertion-step sums, exponential
recurrence simplification, formal Big-O inequalities, witnesses, and comparison
functions. The figures confirm the displayed algebra and crossover examples;
they do not establish a program's cost model, input distribution, tight bound,
or measured runtime. The Intermezzo 5 asset-manifest SHA-256 is
`11ad830ab7ed1be4f8d45d2f1225f8d675a376c5d653d9ea20b68f4aaee9a0c2`.

### Argument Reconstructed

Finite tests constrain behavior only on their tested inputs. Finite timing runs
likewise constrain performance only for the selected implementation, machine,
inputs, and run conditions. A linear-cost program with a large constant can lose
to a quadratic one on small inputs and win after a crossover. Benchmark evidence
must match the client's size range and input shapes.

Algorithmic analysis replaces isolated timings with a growth relationship. The
teaching model maps an explicitly defined input-size measure to a count of
recursive evaluation steps while treating selected primitive operations as
constant cost. “Order of `n`” is meaningless until `n` is tied to a measure such
as list length or number of digits.

This recursive-step model is intentionally abstract and representation-relative.
It works for `how-many` because `empty?` and `rest` are constant-time operations
on the teaching language's linked lists. It fails as a complete model when a
supposed primitive performs a traversal, arithmetic cost grows with operand size,
or memory, allocation, I/O, cache behavior, or parallel work matters. A useful
analysis must state its cost model.

Best-, worst-, and average-case analysis quantify different input classes.
`contains-flatt?` can stop immediately when the target is first and scan the
whole list when it is last or absent. An average of `n/2` recursive steps requires
a probability model such as guaranteed presence with uniformly distributed
position. “Average input” has no meaning without a distribution, including the
probability of absence.

Abstract growth ignores fixed multiplicative constants and lower-order terms.
The insertion-sort analysis counts one structural setup per item and a varying
number of insertion steps across lists of lengths `n-1` through 0. Under the
stated comparison-cost and average-position assumptions, the dominant term is
quadratic. Different input orders still matter to best and worst cases.

The original `inf` demonstrates duplicate recursive work. In the false branch it
recomputes the same suffix minimum already evaluated for the condition, creating
an exponential recurrence on the worst input shape. Naming the suffix result in
`local` evaluates it once per level and reduces both best and worst cases to
linear recursive work. Hoisting can change a complexity class when it removes a
recursively duplicated subproblem.

The intermezzo defines `O(g)` as an eventual upper-bound class: `f` belongs when
there are a constant multiplier and threshold after which `f(n) <= c*g(n)` for
all input sizes. This formalizes why finite prefixes, machine-speed constants,
and lower-order terms can be ignored for asymptotic upper bounds.

Big-O is one-sided and not automatically tight. If a running time is `O(n)`, it
is also normally in `O(n^2)`; proving only the latter does not establish that the
program “takes quadratic time.” Tight classification requires matching lower
information or another relation such as Θ. Likewise, `O(1)` means eventually
bounded by a constant under the model, not necessarily exactly the same runtime
for every input.

Asymptotic “no worse” does not imply faster on the operational domain. The
linear-versus-exponential exercise explicitly asks the reader to reconsider when
sizes are guaranteed to remain between 3 and 12. Constants, thresholds, and
bounded product ranges remain relevant to implementation choice.

The final comparison explains why structural predicates and selectors can carry
cost information. `searchL` uses constant-time `empty?`, `first`, and `rest`, so
an absent target causes one constant-cost stage per list item. `searchS` calls
`length` on every suffix; if `length` traverses its input, the total work is
`n + (n-1) + ... + 1`, which is quadratic.

The important distinction is not that every non-template helper is expensive.
It is that an operation's apparent simplicity does not establish its cost.
Another container representation may cache its size and make `length`
constant-time, usually by paying storage and update costs elsewhere. API cost is
part of a representation contract.

Concrete timing remains useful for validating model assumptions and constants,
but the shown doubling experiment is noisy evidence. Warm-up, garbage
collection, timer resolution, machine load, and returned-versus-printed timing
semantics must be controlled before drawing quantitative conclusions.

### Canonical Source Defects Observed

- `contains-flatt?` calls `string=?` with the symbol `'flatt`, while every shown
  list contains the string `"flatt"`. The function errors on a non-empty string
  list instead of exhibiting the analyzed search behavior; it needs `"flatt"`
  or a consistently symbolic representation and comparator.
- The `inf` discussion says the exponential worst case occurs “when the last
  number is the maximum.” Its running example is descending `(3 2 1 0)`, whose
  last number is the minimum; Exercise 484 also identifies descending order as
  worst.
- The Big-O example says `cL` is the per-step constant for `prog-square` and `cS`
  for `prog-linear`, but the displayed functions are `L(n)=cL*n` and
  `S(n)=cS*n^2`. The prose assigns the constants to the wrong programs.
- The shorthand paragraph attributes `O(2^n)` to `inc`, but no `inc` function is
  defined in the intermezzo. The preceding exponential example is `inf`.
- The search header and tests call an undefined function `search`, while the two
  implementations are named `searchL` and `searchS`. The tests must be
  instantiated for each implementation or the functions renamed.
- `timing` claims to return `[List Number Number]`, but the teaching-language
  `time` form prints timing information and returns the value of its expression.
  Both searches return Booleans, so the function returns a list of Booleans while
  printing timings, not a list of measured numbers.
- The note calls `searchS` generatively recursive even though every recursive call
  consumes the immediate structural component `(rest l)`. Its branch test is
  unnecessarily expensive and its design did not follow the structural template,
  but the recursion itself is structural under the book's earlier definition.

### Formal and Statistical Qualifications

- The printed Big-O definition says there exist “numbers” `c` and `bigEnough`.
  The standard upper-bound definition requires a positive constant `c` and an
  eventual threshold, with nonnegative cost functions. Those constraints should
  remain explicit in formal derivations.
- The claimed average position of `flatt` assumes a distribution that the source
  does not state. Average-case claims must name their probability model.
- Counting recursive calls is a pedagogical proxy, not a language-independent
  definition of time complexity.

### Boundaries That Must Survive Derivation

- Passing examples and passing benchmarks are both finite, claim-relative
  evidence.
- Performance comparisons require behaviorally equivalent contracts first.
- Input size, costed operation, and best/worst/average case must be named.
- Average-case analysis requires an explicit probability distribution.
- Big-O ignores finite prefixes and constant factors but not the product's bounded
  operating range.
- Big-O is an upper bound, not automatically a tight classification.
- Primitive-operation cost depends on language and representation.
- Recursive-step counts omit memory, allocation, I/O, arithmetic bit cost, and
  other resources unless added to the model.
- Reusing one recursive result can remove exponential duplicated work.
- Calling a traversal inside every recursive stage can raise the growth class.
- Cached metadata may improve queries while shifting costs to construction and
  updates.
- Wall-clock experiments validate particular model assumptions; they do not
  replace asymptotic analysis.
- A timing form that prints measurements but returns the computed value must not
  be modeled as a numeric measurement API.

### Developer Comparison

| Packaged claim or use | Source location | Preliminary decision |
| --- | --- | --- |
| Finite green timings establish performance only for the measured cases. | opening | directly supported |
| A complexity claim must define input size and the analyzed case. | Concrete Time, Abstract Time | directly supported |
| “Average” is meaningful without an input distribution. | `contains-flatt?` discussion | not supported despite the source's informal assumption |
| Hoisting a duplicated recursive result can change exponential work to linear. | `inf` versus `infL` | directly supported |
| `f in O(g)` proves a tight bound equal to `g`. | Big-O definition | contradicted; it gives an eventual upper bound |
| Better asymptotic growth always wins on a small bounded domain. | Exercise 487 | contradicted explicitly |
| Standard selectors and arbitrary whole-container observers have interchangeable cost. | `searchL` versus `searchS` | contradicted for teaching-language lists |
| A container's size-query cost is independent of representation. | closing paragraph | contradicted explicitly |

### Provisional Repair Notes

- Add input-size measure, cost model, case class, distribution, and bound type to
  performance-claim artifacts.
- Separate concrete benchmark evidence from asymptotic evidence and record the
  product's actual size range.
- Add duplicate-recursion hoisting and hidden traversal as vertical cost-movement
  signals.
- Qualify structural-change preservation with resource claims: same outputs may
  have a different complexity class.
- Add API operation cost and shifted construction/update cost to abstraction
  review.
- Use the malformed `contains-flatt?`, undefined `search`, and `timing` result as
  examples of why performance experiments require executable semantic checks
  before interpreting measurements.
- Exclude the maximum/minimum reversal, swapped constants, `inc` typo, and
  `searchS` recursion classification from final derivations.

## Part VI: Accumulators

**Part opening read:** complete. The opening frames pure function application as
context-independent and accumulators as explicit data that restores traversal
context otherwise absent from a recursive subproblem. It distinguishes ordinary
arguments, which continue to describe the remaining problem, from accumulator
arguments, whose values summarize a relationship between that problem and its
calling context.

**Source anchor:** `part_six.html#%28part._part~3asix%29`

The opening's “loss of knowledge” is not mutable hidden state. It is information
that the recursive interface did not receive: processed prefixes, visited nodes,
partial results, or other context needed for cost or totality. Accumulator design
therefore begins with a representation invariant connecting the extra argument
to the original input and current subproblem.

### Chapter 31: The Loss of Knowledge

**Read:** complete Chapter 31, sections 31.1-31.2.

**Source anchor:** `part_six.html#%28part._ch~3aaccumulator-samples%29`

**Visual and structural inspection:** relative versus cumulative road-distance
figures, the six-node functional graph, the repeating `C -> E -> B -> C` trace,
and the corresponding changing `seen` traces. The graph confirms one outgoing
edge per represented node and two cycles; the ellipsis images merely abbreviate
unchanged graph data. The Chapter 31 asset-manifest SHA-256 is
`20c4540ff7cde629760787c0dd07596db1692358680ba8f04fc67dffe108d7c6`.

#### Argument Reconstructed

The relative-distance problem computes prefix sums. The direct structural
version first solves the suffix relative to its own origin, then adds the current
distance to every suffix result. Each recursive level reprocesses an increasingly
long result list, producing quadratic total work even though the output itself
has only linear size.

This cost is not caused by structural recursion alone. It comes from a mismatch
between the direction in which context is needed and the information available
to the natural recursion. A suffix call cannot know the sum of the already
processed prefix, so the caller repairs every returned value afterward.

The accumulator version makes the missing relation explicit. For a call on
remaining list `l`, `accu-dist` denotes the sum of all original distances before
`l`, or equivalently the absolute distance to the start of the current suffix.
The next emitted value is `accu-dist + first(l)`, and that same tally is the
accumulator for `rest(l)`. Initializing it to the additive identity 0 establishes
the invariant for the full input.

Each input item is then consumed and emitted once, reducing the modeled work from
quadratic to linear. This is a specific repair for repeated post-processing, not
a universal cure for slow programs. It also retains linear output allocation and
may carry arithmetic costs omitted by the recursive-step model.

A public wrapper preserves the original one-argument contract, fixes the only
valid initial accumulator, and keeps the helper's stronger relational precondition
private. The helper is not a second public mode. Lexical scope enforces ownership
of initialization and captures the original collaboration boundary.

The `reverse`/`foldr` alternative does not eliminate the underlying idea. Library
`reverse` is itself typically implemented with accumulated context, and the
expression still changes traversal direction to make prefix knowledge available.
It also calls `first` and `rest` before handling empty input, so it does not match
the original function's empty-list domain without an additional branch.

The graph example concerns a finite functional graph: every node has exactly one
outgoing neighbor. Path search therefore follows a single orbit. If the
destination is not encountered, finite-state repetition implies that the orbit
has entered a cycle and no future step on that orbit can reach a new node.

The first `path-exists?` implementation has a success base case but no failure
base case. Its recursive problem may repeat exactly, so an unreachable target
causes divergence. Inspecting the output inventory reveals the design gap before
timing does: a Boolean function expected to return both values contains no route
to `#false`.

For the revised helper, `seen` denotes the prior origin nodes on the current
orbit. The initial value is empty; each nonterminal step adds the current origin.
The destination check comes first. If the current origin is already in `seen`,
the deterministic orbit has closed without encountering the destination and the
correct result is `#false`.

Termination now follows from graph finiteness and the invariant. Every recursive
step either reaches the destination, detects a repeated node, or adds a previously
unseen valid node. The number of such additions is bounded by the graph's node
count. This proof also requires neighbor lookup to be total and closed over the
represented node set.

The accumulator changes the graph function's semantic domain rather than merely
its speed. On reachable cases it preserves the prior successful answers; on
cyclic unreachable cases it replaces divergence with `#false`. The appropriate
claim is a totality repair plus agreement on the old terminating domain, not full
behavioral equivalence.

A list-valued `seen` makes membership linear in the number of visited nodes, so a
single-orbit traversal can perform quadratic membership work. Accumulation can
improve termination while introducing a new representation-dependent cost. A
set-backed visited representation may improve lookup at the price of different
construction and storage costs.

Extending `seen` to branching graph search requires a scope decision. A
path-local set prevents cycles within one candidate path but may revisit nodes
across branches. A global set can avoid repeated exploration, but its update
point must preserve search completeness. “Already seen” has different meanings
for current path, generated frontier, and fully explored graph.

#### Canonical Source Defects and Overstatements Observed

- The Part VI opening again says random is the true exception to same-input,
  same-result evaluation. Chapter 22's file and web readers already establish
  time-varying effectful exceptions. The context-independence principle is valid
  for the pure function subset.
- The opening calls an added argument “the only solution” to context loss. Pure
  alternatives include changing the representation, returning richer summaries,
  composing traversals differently, using a closure, or relying on an abstraction
  that encapsulates accumulation. An accumulator is the method developed here,
  not the sole possible design.
- The source says the two relative-distance versions are indistinguishable by
  input/output. Their addition association differs: the direct version can form
  `a + (b + c)`, while the accumulator forms `(a + b) + c`. They agree for exact
  arithmetic but can differ for inexact numbers, as Intermezzo 4 warns.
- The final comparison refers to `relative-to-absolute2`, but the defined function
  is `relative->absolute.v2`.

#### Boundaries That Must Survive Derivation

- An accumulator represents a stated relation between processed context and the
  remaining ordinary argument.
- Initial accumulator values are identities derived from that relation, not
  arbitrary defaults.
- Public wrappers can enforce initialization and hide helper preconditions.
- Reprocessing recursive results is a signal to consider accumulation, not proof
  that every accumulator rewrite is necessary or safe.
- Exact output equivalence does not automatically extend to reassociated inexact
  arithmetic.
- Library combinators may encapsulate rather than eliminate accumulated context.
- Cycle detection relies on graph finiteness, node closure, and the meaning of
  `seen`.
- Destination-before-repeat ordering preserves the trivial successful path.
- Replacing divergence with failure is a totality change, not ordinary refactoring
  equivalence.
- Visited-list membership can introduce quadratic work even when traversal steps
  are linear.
- Path-local, frontier, and globally explored accumulators support different
  search guarantees.

#### Developer Comparison

| Packaged claim or use | Source location | Preliminary decision |
| --- | --- | --- |
| Repeated post-processing of recursive results can reveal missing traversal context. | §31.1 | directly supported |
| An accumulator should be added without stating what it represents. | §§31.1-31.2 | contradicted by both derivations |
| A wrapper can preserve the public contract and own accumulator initialization. | Figure 178 and Figure 181 | directly supported |
| Accumulator conversion always preserves exact runtime behavior. | relative-distance versions read with Intermezzo 4 | contradicted for reassociated inexact arithmetic |
| Tracking prior nodes can turn cyclic divergence into explicit failure. | §31.2 | directly supported for the functional graph invariant |
| A visited list makes cycle-safe traversal asymptotically free. | Figure 181 | not supported; membership cost accumulates |
| One undifferentiated `seen` meaning works for every graph search. | §31.2 and Exercise 492 | not supported; scope affects completeness and repeated work |

#### Provisional Repair Notes

- Require an accumulator interpretation, initialization proof, update equation,
  and wrapper boundary in accumulator guidance.
- Add arithmetic reassociation to behavior-preservation checks for accumulator
  transformations.
- Distinguish result-equivalent optimization from totality repair.
- Treat accumulated-context representation cost as part of abstraction review.
- Add visited-scope choices and graph closure assumptions to search modeling.
- Preserve the hidden-accumulation lesson from the `reverse`/`foldr` alternative
  without claiming a unique implementation technique.
- Exclude the effects-blind purity statement, sole-solution claim, unqualified
  numeric equivalence, and misnamed function from final derivations.

### Chapter 32: Designing Accumulator-Style Functions

**Read:** complete Chapter 32, sections 32.1-32.4.

**Source anchor:** `part_six.html#%28part._sec~3adesign-accu%29`

**Visual and structural inspection:** stripped binary-tree shapes and depth
annotations, the million-cell rotation cost, decimal positional evaluation, and
the quadratic reverse cost. All editor evidence is HTML-native code and prose.
The figures support the stated examples but do not prove an invariant,
equivalence, stack bound, or user-experience quality. The Chapter 32
asset-manifest SHA-256 is
`6bd962b0a788f0aeb1cedacf1fb81284691a2a0484475b3c371adc9d1cd59b57`.

#### Argument Reconstructed

Accumulator design begins after a conventional function makes pressure
observable. The primary structural signal is a recursive helper that repeatedly
traverses the result of a natural recursion, as `add-as-last` does for every
suffix result of `invert`. This is a candidate signal, not an automatic rewrite:
insertion sort also processes a recursive result, but its repeated comparisons
belong to the sorting problem rather than merely restoring forgotten context.

For generative functions, the recognition problem is broader: determine whether
an expected answer is prevented by lost search history or progress context. A
visited accumulator can help, but only after the original algorithm's divergence
and the meaning of prior states are understood.

The chapter's method makes the accumulator invariant the design center. Starting
from an outer argument `d0` and current ordinary argument `d`, the designer states
what accumulator `a` represents about their relationship. That statement derives
the accumulator data type, initial value, recursive update, and where the value
is consumed. A hand trace tests whether the relation remains true at every call.

The wrapper/helper template assigns ownership. The outer function keeps the
original public signature and captures `d0`; the local helper accepts the current
subproblem and accumulator; the outer call supplies the unique valid identity.
This avoids exposing arbitrary accumulator states as public inputs.

For reverse, `a` is the reverse of the prefix that the current suffix lacks from
the original list. Empty initialization represents the missing empty prefix;
`cons first(alox) a` preserves the relation as the suffix shrinks; and when the
suffix is empty, `a` is the complete reverse. The accumulator removes repeated
end insertion and changes modeled time from quadratic to linear.

The sum and factorial transformations are calibration exercises rather than
needed optimizations. For sum, `a` is the sum of the original prefix no longer in
`alon`; 0 is the additive identity. For factorial, `a` is the product of already
processed descending factors; 1 is the multiplicative identity. These examples
isolate invariant derivation while also showing that an accumulator is not
justified merely because one can be written.

Operation order is observable. Direct sum performs additions from right to left,
while accumulator sum proceeds left to right. Exact arithmetic preserves the
mathematical result; inexact arithmetic may not. Direct factorial builds products
from smaller factors outward, while the accumulator multiplies large descending
factors immediately. Arbitrary-precision multiplication cost depends on operand
size, and the measured accumulator version is slightly slower in the displayed
experiment.

The height example shows that an accumulator need not become the sole result and
does not guarantee tail recursion. Its depth accumulator is the number of edges
from the original root to the current subtree. Empty leaves return absolute
depth, while an internal node still combines two recursive results with `max`.
The ordinary structural collaboration remains necessary.

A second possible height design tracks both depth and the largest height already
seen to the left. It has a more complex invariant and no demonstrated advantage.
The source recommends completing variants and comparing evidence rather than
assuming that more accumulated knowledge is better.

Accumulator conversion may affect stack space even when time remains linear.
A direct list count leaves `add1` work pending during descent; an accumulator can
place the recursive call in tail position. Constant stack then depends on the
language's proper-tail-call execution guarantee, not on the word “accumulator”
alone.

The matrix rotation example combines totality and cost pressure. Repeatedly
moving a zero-leading first row to the end with `append` copies nearly the entire
matrix per rotation, yielding quadratic allocation in the worst case. It also
loops forever when every leading coefficient is zero. A structural pass can
accumulate skipped rows once, stop at a usable pivot, and reconstruct the rotated
matrix or signal error after exhausting the finite input.

The accumulated rows need their own invariant: they are exactly the zero-leading
prefix removed from the original matrix, usually stored in reverse order for
constant-time `cons`. Success reconstructs the usable suffix followed by the
prefix in original order. Exhaustion is a bounded no-pivot result, not another
rotation.

`to10` illustrates Horner-style accumulation. For a processed digit prefix, the
accumulator is its decimal value; the update `10*a + digit` appends the next
place. The invariant replaces explicit exponent calculation and aligns the
process with left-to-right positional interpretation.

The prime exercise exposes another option. The original number is stable context
while a candidate divisor changes. It may be threaded as an additional argument,
but a local helper can also capture the original value lexically. Stable captured
context and changing accumulated summaries should not be conflated merely
because both add information to recursion.

The `foldl` derivation makes operation order explicit. Naive reverse plus `foldr`
can inherit a quadratic reverse; accumulator reverse restores two linear passes;
then updating the fold accumulator directly on the original order removes the
reverse entirely. If the processed prefix is `(x1 x2 x3)`, the accumulator is
`f(x3, f(x2, f(x1, i)))` under the chapter's argument order. This invariant is
precisely `foldl` semantics, including its difference from `foldr` for
non-associative `f`.

The editor exercise applies accumulation to a two-part result. Structural search
for a click position consumes larger prefixes but loses the text to the left of
the current suffix. An accumulator can retain that prefix in the reversed form
already required by `Editor`, while the ordinary argument remains the right-hand
suffix. The split contract must connect storage orientation, visible text, pixel
measurement, and end-of-line behavior.

Passing split tests does not settle cursor behavior. The first containing glyph
boundary may differ from the nearest insertion boundary users expect. Interactive
experimentation supplies product evidence that ordinary structural tests omit;
“valid split” and “appropriate look and feel” are separate claims.

#### Canonical Source Defects Observed

- The sum note refers readers to inexact-number exercises at the end of
  Intermezzo 5. The relevant order-sensitive summation exercises are in
  Intermezzo 4, The Nature of Numbers.
- The factorial invariant says `a` is the product over interval `[n0,n)`, yet for
  `n0 = 3` and `n = 1` it says `a = 6`. In standard interval notation the needed
  descending factors form `(n,n0]`, not `[n0,n)`.
- Exercise 502 asks for `palindrome` but its supplied composition and test define
  and call `mirror`. The intended contract is clear, but the function name is
  inconsistent.
- Exercise 508 declares `ed`, `p`, and `s` as lists of 1Strings, then uses
  `(string-append p s)` and `string=?` as if they were strings. It also ignores
  that `Editor` stores `pre` in reverse order.
- The same exercise calls `(append p (first s))`; `first s` is a 1String rather
  than a singleton list. For the declared list representation it needs a list
  wrapper and must measure the visible prefix in its correct orientation.

#### Boundaries That Must Survive Derivation

- Complete the ordinary design first so accumulator pressure is observable.
- Reprocessing a recursive result is a candidate signal, not automatic evidence
  that accumulation improves the design.
- Every accumulator needs a relation to the original and current arguments.
- Initial value, update, and use are proof obligations derived from the invariant.
- A wrapper owns valid initialization and hides helper-only states.
- Accumulator style does not imply tail recursion or constant space.
- Reassociation can change inexact numeric results and arbitrary-precision cost.
- Multiple accumulator invariants may be correct while differing in complexity
  and clarity.
- A bounded structural pass can replace an unbounded rotate-and-copy process.
- Stable lexical context may be captured rather than threaded as changing state.
- `foldl` and `foldr` differ in function-application order for non-associative
  operations.
- Stored editor prefix orientation and rendered orientation must be distinguished.
- Structural validity tests do not establish interaction quality.

#### Developer Comparison

| Packaged claim or use | Source location | Preliminary decision |
| --- | --- | --- |
| Accumulator adoption should follow an observed missing-context or repeated-processing signal. | §§32.1-32.2 | directly supported |
| The invariant may be omitted once the accumulator code looks familiar. | §32.2-32.3 | contradicted explicitly |
| Every accumulator transformation improves time. | factorial and product/how-many exercises | contradicted explicitly |
| Accumulator style automatically yields tail recursion. | height.v2 | contradicted by two recursive calls plus `max` |
| A more elaborate accumulator is preferable because it tracks more facts. | height.v3 note | contradicted absent evidence |
| Bounded accumulation can replace repeated full-list rotation. | Exercise 503 | directly supported |
| Reverse-plus-fold and direct `foldl` are interchangeable without considering operation order. | Exercise 507 | contradicted for order-sensitive functions |
| Passing pure split tests establishes acceptable cursor placement. | §32.4 | contradicted by interaction experiments |

#### Provisional Repair Notes

- Add candidate signal, invariant, identity, update, consumption point, and wrapper
  to accumulator design artifacts.
- Require time, stack, arithmetic-order, and readability evidence before accepting
  accumulator transformations.
- Distinguish context capture from changing accumulation.
- Add no-pivot exhaustion and reconstruction order to matrix-rotation examples.
- Preserve `foldl` application order as a behavioral contract.
- Add representation orientation and interaction-quality checks to editor split
  examples.
- Exclude the wrong cross-reference, reversed factorial interval, naming mismatch,
  and malformed editor expressions from final derivations.

### Chapter 33: More Uses of Accumulation

**Read:** complete Chapter 33, sections 33.1-33.3.

**Source anchor:** `part_six.html#%28part._ch~3amore-accu%29`

**Visual and structural inspection:** lexical-scope paths and static-distance
trees, initial/intermediate/final missionary-and-cannibal states and game tree,
distance and midpoint formulas, failed and successful scene combinations,
Savannah generation, and Bézier subdivision. The figures confirm the represented
paths and specific drawing behavior but do not prove lexical correctness, cached
field consistency, search termination, shortest-path guarantees, or geometric
convergence. The Chapter 33 asset-manifest SHA-256 is
`627d1b0c12da9abde94b331b8b248da37d7ac4b8856ecf7cad1672ea687c8d91`.

#### Argument Reconstructed

The chapter expands accumulation across three ownership locations: a traversal
helper carries lexical context, a data value stores construction history, and a
recursive result becomes the accumulator for the next branch. The common idea is
not “add a parameter” but preserve information at the boundary that owns its
lifetime and interpretation.

The lambda-term example separates static syntax processing from execution. The
compiler-like pass traverses a finite representation even when the represented
program diverges at runtime. Runtime termination and static-transform termination
are different claims over different data.

For `undeclareds/a`, the accumulator is the ordered list of lambda parameters on
the root-to-current path. Entering a lambda extends the environment only for its
body. Both children of an application receive the same unextended environment,
so declarations do not leak across sibling subtrees. Empty initialization
represents top-level scope.

At a variable, membership in this path environment determines bound versus free.
Duplicate names must remain because nested lambdas may shadow outer binders.
Membership suffices for declared/free classification, while static distance needs
the nearest matching binder's index in the innermost-first list. A set would lose
that ordering and multiplicity.

The source's `*undeclared` replacement deliberately collides with the legal
symbol namespace; Exercise 515 exposes the ambiguity. Replacing variables with
application-shaped lists or synthesized symbols merely changes the collision
surface. A robust diagnostic transform needs a distinct tagged AST variant that
preserves the original identifier and status.

A path-list environment has representation cost. Each membership or static
index lookup can scan lexical depth, yielding quadratic work on deeply nested
terms with many variable occurrences. A richer environment may improve lookup
but must still support shadowing and path-local restoration across sibling
branches.

The cached-length list moves accumulation into data construction. Each non-empty
node stores `1 + tail.count`, so `our-length` can answer in constant time. This is
denormalization: a derived fact is copied into every constructor instance and is
valid only if every construction path preserves the invariant.

The checked `our-cons` boundary derives count from a valid tail in constant time.
If callers can invoke raw `make-cpair` or mutate fields, they can create a
structurally plausible list with a false count. Constant-time queries require an
enforced constructor barrier, not just an explanatory comment.

Caching count shifts cost rather than eliminating it. Every list node uses more
space and every construction performs count maintenance, even in programs that
never ask for length. Whether the trade is worthwhile depends on query frequency,
construction/update frequency, memory budget, and the costs of the target
runtime's container representation.

The puzzle search needs per-candidate history rather than one shared function
accumulator. Every generated `PuzzleState` owns the sequence by which that state
was reached. This provenance supports both path reconstruction at the final state
and path-local cycle rejection during successor generation.

Breadth-first search maintains a frontier-depth invariant: all states reachable
in `n` rides are checked before any requiring `n+1`. If a goal is reachable and
successors have uniform step cost, the first goal depth is minimal. That does not
by itself guarantee termination when no goal is reachable, especially if prior
states are regenerated or the empty frontier has no failure base case.

State generation has three independent filters: boat moves must obey transition
rules, resulting states must satisfy the safety invariant, and repeated states
must be rejected under the chosen history scope. A path-local history prevents
cycles in one candidate route. A global explored set can remove duplicate work
across frontier paths but has different ownership and reconstruction needs.

Embedding full histories duplicates prefixes across the breadth-first frontier
and can consume substantial memory. Parent links, predecessor maps, or shared
persistent paths offer different reconstruction/storage tradeoffs. “Accumulator
in the data” is a provenance design choice, not free metadata.

The Sierpinski example starts with three independent recursive images but finds
no valid merge operation because each scene is a complete opaque canvas. Overlay
and underlay hide lines instead of combining incremental changes. The available
result-combination API therefore changes the recursion organization.

The repaired design threads one image value through all three branches. The
current triangle is added to `scene0`; the first recursive result becomes the
scene argument for the second; the second becomes the argument for the third;
and the final branch result is returned. The scene is simultaneously input,
accumulated drawing, and output.

This state-passing form makes branch order observable if drawing is noncommutative,
uses opacity, or applies effects. It is equivalent to independent branch drawing
plus merge only when a lawful merge operation exists and the drawing operations
satisfy its ordering assumptions.

The base case returns the incoming scene unchanged, making it the identity for
“no more drawing.” Midpoints are named once and shared. Termination still needs a
positive geometric cutoff, finite coordinates, and a measure that shrinks for
every generated triangle.

Measuring one side for `too-small?` is sufficient for the equilateral initial
triangle and midpoint subdivision because that shape invariant is preserved. It
is not sufficient for the broader signature's arbitrary three points, where one
short side can coexist with a long side. The precondition or size predicate must
match the accepted geometry.

Savannah and Bézier exercises generalize the pattern: recursively generated
branches update a shared drawing result, while length or geometric size supplies
the cutoff. Visual smoothness and density remain product policies established by
experimentation, not structural or mathematical correctness alone.

#### Canonical Source Defects Observed

- The rendered `MyList` data definition contains `(tech "N")` inside the
  `make-cpair` form, exposing a documentation-markup helper instead of the
  intended natural-number field type `N`.
- Increasing a two-field pair to three fields is described as a “33% increase” in
  memory. Counting fields alone, the increase from 2 to 3 is 50%; actual object
  overhead and alignment require measurement rather than either simple ratio.
- `our-length` reports errors with the label `"my-length: ..."`, which does not
  match the defined function name.
- Exercise 520 says breadth-first `solve*` cannot enter an infinite loop even
  while it regenerates prior states. If no final state is reachable, cyclic
  frontiers can repeat forever; an empty frontier also recurs forever because the
  displayed function has no failure base case.
- The Savannah hint specifies angle changes of `0.15` and `0.2` degrees, but the
  visible branching and Racket trigonometric APIs are naturally consistent with
  radians. If degrees are truly intended, explicit conversion is required; the
  unit is otherwise inconsistent with the surrounding numeric guidance.

#### Deliberately Exposed Representation Gaps

- Replacing a free variable with the legal symbol `*undeclared` is ambiguous when
  a program binds that name. The exercises intentionally ask the reader to expose
  and refine this diagnostic representation.
- `solve` returns only a final state and has no failure result. The later exercises
  intentionally add path history, cycle rejection, and a path result, but an
  unreachable final state still requires an empty-frontier contract.

#### Boundaries That Must Survive Derivation

- Lexical context follows the root-to-current path and must not leak between
  application siblings.
- Shadowing requires ordered, duplicate-preserving binder context.
- Static analysis of syntax does not execute the represented program.
- Diagnostic annotations need a representation disjoint from legal source forms.
- Cached derived fields require a closed constructor/update barrier.
- Constant-time queries trade against write cost and memory.
- Per-state path history and global search history have different meanings.
- Breadth-first order proves minimum depth only under uniform edge costs and does
  not itself prove failure termination.
- Search needs explicit empty-frontier behavior and duplicate-state policy.
- Full embedded histories can dominate frontier memory.
- When recursive results cannot be lawfully merged, sequential state threading is
  a different collaboration shape.
- Accumulator-as-result designs may make branch order observable.
- Geometric cutoffs require a preserved shape/size invariant over the accepted
  domain.
- Visual quality thresholds require experimentation beyond structural tests.

#### Developer Comparison

| Packaged claim or use | Source location | Preliminary decision |
| --- | --- | --- |
| A path accumulator can model lexical scope for tree traversal. | §33.1 | directly supported |
| An unordered set is interchangeable with an ordered binder stack for static distance. | Exercise 517 | contradicted by nearest-binder indexing |
| Cached metadata makes reads cheaper by shifting cost to construction and storage. | §33.2 list example | directly supported |
| A cached field remains trustworthy when raw constructors bypass its invariant. | Figure 189 and `cpair` extension | contradicted |
| Breadth-first ordering alone guarantees termination on cyclic unreachable searches. | Exercise 520 | contradicted |
| Branch-local provenance belongs naturally in each generated state. | Exercises 522-524 | directly supported |
| Independent full-canvas results can always be merged after recursive drawing. | Figures 191-192 | contradicted by the image API |
| An accumulator may simultaneously be argument, collected state, and result. | Figure 192 | directly supported |

#### Provisional Repair Notes

- Add lexical environment ordering, sibling isolation, shadowing, and diagnostic
  tagging to tree-accumulator guidance.
- Treat data accumulators as denormalized fields with constructor closure and
  read/write/memory economics.
- Separate frontier order, visited scope, path reconstruction, and empty-frontier
  failure in breadth-first search models.
- Add provenance-storage alternatives instead of assuming full path copies.
- Add accumulator-as-result/state-threading to mixed recursion patterns, including
  branch-order semantics and merge-law requirements.
- Scope one-edge geometric cutoffs to preserved equilateral inputs or strengthen
  the predicate.
- Exclude leaked markup, the memory percentage, mislabeled error, unconditional
  BFS termination, and ambiguous angle unit from final derivations.

### Chapter 34: Summary

**Read:** complete Chapter 34.

**Source anchor:** `part_six.html#%28part._ch~3asummary6%29`

**Visual and structural inspection:** prose summary only; the chapter contains no
raster assets, code figures, or additional diagrams.

#### Argument Reconstructed

Part VI closes with a three-stage method. First, recognize pressure from context
that traversal forgets. Second, state exactly what accumulated knowledge means
and which data represents it. Third, derive initialization, maintenance, and use
from that invariant. The source calls the third step “minor” because a precise
invariant constrains the mechanics; it is still an implementation and proof
obligation.

Recognition remains conditional. An accumulator can repair repeated traversal,
missing search history, or awkward result construction, but not every slow or
recursive function benefits. The previous chapters require a complete ordinary
design or concrete failure signal before switching templates.

Most helper accumulators describe a relation between the original argument and
the current subproblem: processed prefix versus remaining suffix, root-to-node
path, visited orbit, or partial fold. Chapter 33 extends the idea beyond helper
parameters to cached construction facts, per-state provenance, and results
threaded as the next branch's state.

An accumulator eliminates a termination problem only when its invariant enables
a new well-founded or repetition-detecting base case. Merely adding history does
nothing unless the algorithm consults it correctly, and the representation and
scope of that history affect cost and completeness.

Functional and imperative programs can share the same invariant reasoning. In an
imperative loop, a changing variable may represent the same processed/remaining
relation as a recursive accumulator. Mutation adds sequencing, aliasing, and
intermediate-state obligations, however, so the implementation details are not
interchangeable merely because the invariant is analogous.

#### Claims Requiring Qualification

- “Adding an accumulator can ... eliminate termination problems” is existential,
  not universal. The accumulator must support a valid cycle/progress decision,
  and some divergence cannot be repaired this way.
- Switching to an accumulator template follows recognition and evidence; it
  should not replace completion of the ordinary design before the pressure is
  understood.
- The statement that primitive imperative loops “cannot return values” is too
  broad across languages. Some loop constructs yield values or support early
  return; assignment-based accumulation remains a common implementation form.
- Imperative accumulator design shares invariant reasoning with functional
  design, but mutation introduces additional temporal and aliasing risks outside
  this book's scope.

#### Boundaries That Must Survive Derivation

- Accumulator adoption begins from observed missing context, not recursion alone.
- The invariant names both accumulated knowledge and its representation.
- Initialization, update, and use are derived checks, not arbitrary coding
  details.
- Termination repair requires the accumulated fact to participate in a sound base
  condition.
- Helper parameters, data fields, per-state provenance, and threaded results are
  distinct ownership locations for accumulation.
- Functional and imperative forms may share an invariant while differing in
  execution hazards.

#### Developer Comparison

| Packaged claim or use | Source location | Preliminary decision |
| --- | --- | --- |
| Accumulator work begins by recognizing forgotten context and stating its invariant. | Chapter 34, first two lessons | directly supported |
| Any recursive function should immediately switch to an accumulator template. | Chapter 34 read with Chapters 31-33 | contradicted |
| Initial value and update may be selected independently of the invariant. | Chapter 34, third lesson | contradicted explicitly |
| Tracking history automatically guarantees termination. | opening read with graph and BFS examples | contradicted; history must be consulted with sound scope |
| Functional and imperative accumulators can share conceptual invariants. | closing paragraph | directly supported with implementation qualifications |

#### Part VI Cumulative Judgment

Part VI supports accumulator design as explicit context modeling. The durable
artifact is an invariant connecting original input, current subproblem, and
accumulated data. That invariant determines identity, update, use, and ownership;
a local wrapper normally protects initialization and preserves the public API.

The source demonstrates four materially different outcomes. Prefix sums and
reverse remove repeated traversal. Visited nodes replace cyclic divergence with a
failure result. Binder paths provide lexical context to tree processing. Cached
length and embedded puzzle histories place derived facts in data. Sierpinski
drawing threads each recursive result as the next branch's input. These should
not be flattened into one “extra parameter” recipe.

Accumulator transformations carry risks. Reassociated inexact arithmetic can
change results; multiplication order can change arbitrary-precision cost;
list-based visited sets can add quadratic lookup; cached fields can become stale;
full path histories can dominate memory; global versus path-local history can
change search completeness; and threaded branch results can make order
observable. Output equivalence and resource improvement both require evidence.

The strongest faithful workflow is:

1. Complete or inspect the ordinary design and identify the exact lost-context,
   repeated-work, totality, or construction pressure.
2. Choose the ownership location: helper argument, captured context, data field,
   per-branch provenance, or threaded result.
3. State the invariant relating original input, current subproblem, and
   accumulated value.
4. Derive the identity, update, consumption point, and wrapper boundary.
5. Prove the invariant across every structural or generated branch.
6. Check semantic changes such as arithmetic order, failure replacement, branch
   order, and diagnostic representation.
7. Measure time and space under the accumulator representation's own operation
   costs.
8. Keep the accumulator only when the evidence improves the intended contract.

#### Provisional Repair Notes

- Keep invariant-first accumulator guidance while broadening ownership beyond
  helper parameters.
- Route accumulator candidates through behavior, termination, time, space, and
  representation checks before acceptance.
- Distinguish optimization, totality repair, context-sensitive transformation,
  cached metadata, provenance, and state-threading uses.
- Qualify imperative transfer with sequencing and aliasing obligations.
- Preserve “consider,” not “always convert,” as the adoption rule.

## Epilogue: Moving On

**Read:** complete Epilogue, including Computing; Program Design; Onward,
Developers and Computer Scientists; and the transfer discussion for other
professions.

**Source anchor:** `part_epilogue.html#%28part._part~3aepilogue%29`

**Visual and structural inspection:** prose only; the Epilogue contains no raster
assets, code figures, or additional diagrams.

### Argument Reconstructed

The Epilogue returns to the book's foundational boundary: information from a
domain is represented as data, programs compute over that data, and results must
be interpreted back in the domain. Computing generalizes arithmetic by supplying
many data classes and operations rather than reducing every design directly to
bits or numbers.

Equational laws explain the pure computational core. Function application
substitutes values for parameters, and data-operation laws determine subsequent
steps. This model supports prediction and local reasoning. It is not a complete
account of the book's own effects, random generation, interaction, resource
costs, or external systems, all of which require additional semantics.

Program structure is framed as communication across people and time. Purpose,
data relationships, function collaborations, and process choices must remain
legible after the original author leaves. Systematic design is therefore both a
correctness practice and an ownership/maintenance practice.

The whole-program recipe begins with domain information and representation,
continues with a work list of wished functions, and uses iterative refinement
when the list is large. A small coherent subset should produce something a
client can inspect; observed interaction then informs which work-list item to
address next. Iteration is evidence-guided scope selection, not arbitrary partial
implementation.

At function scale, a concise purpose and worked examples establish initial
understanding. Turning examples into tests preserves reusable evidence for later
modification. The Epilogue correctly calls these “basic examples”; it does not
establish exhaustive correctness from their passage.

The debugging workflow follows collaborations downward. Start with a failing
main-function example, derive focused tests for mentioned functions, and continue
until the fault is localized. Passing collaborator tests narrow hypotheses, but
they do not universally exonerate a component: integration contracts, shared
state, timing, environment, and combinations can fail while isolated examples
pass.

A green suite is followed by design inspection. The Epilogue asks programmers to
look for flaws and repeated designs, then use existing or new abstractions where
a real pattern exists. Read with the preceding chapters, this is not a demand to
abstract every visual repetition immediately. Stable semantic correspondence,
ownership, migration, and evidence still govern timing.

The next-learning discussion identifies scaling dimensions absent from the
teaching languages: full language semantics, classes and objects, static types,
framework instantiation, component production, theoretical and practical cost,
hardware, networking, software layers, and specialized algorithms. The book
positions its recipe as a foundation rather than a complete software-engineering
curriculum.

The transfer-to-other-professions section is analogical. Information gathering,
hypothesis formation, worked examples, and cross-checking can resemble design
steps, and repeated work may benefit from a single point of control. These
analogies can suggest questions; they do not prove that medical, legal,
journalistic, or engineering evidence obligations are interchangeable with
program tests.

### Claims Requiring Qualification

- “That’s all there is to computing” is a pedagogical reduction to pure
  substitution and data laws. Effects, concurrency, interaction, failure,
  physical resources, and external systems require more.
- A systematic method improves comprehensibility but cannot guarantee that every
  resulting organization is understandable to every future reader.
- A collaborator passing newly derived isolated tests does not prove it cannot
  contribute to an integration failure.
- A whole suite returning green supports the represented claims; it does not
  prove the program is fixed for unmodeled inputs and environments.
- “If you find any design patterns, form new abstractions” must retain the book's
  earlier evidence and timing qualifications. Surface repetition alone is not a
  stable abstraction.

### Boundaries That Must Survive Derivation

- Domain information, data representation, computation, and result
  interpretation remain distinct responsibilities.
- Equational reasoning is strongest for the pure core and must be extended at
  effectful boundaries.
- Program organization communicates purpose and collaboration across time.
- Iterative work-list refinement uses inspectable product evidence to choose the
  next slice.
- Example suites are durable but claim-relative evidence.
- Debugging narrows hypotheses through the collaboration graph; isolated green
  evidence does not erase integration risk.
- Test completion and design-quality inspection are separate gates.
- Repeated shape becomes an abstraction only after semantic and ownership review.
- The introductory recipe is a foundation for, not a substitute for, language,
  systems, performance, and domain-specific study.
- Cross-profession transfer is heuristic and must preserve each field's evidence
  standards.

### Developer Comparison

| Packaged claim or use | Source location | Preliminary decision |
| --- | --- | --- |
| Information-to-data and data-to-information boundaries anchor program design. | Computing | directly supported |
| Program structure is a communication medium across maintainers and time. | Program Design | directly supported |
| Passing basic examples proves complete correctness. | Program Design testing paragraphs | contradicted by the source's limited “basic examples” framing |
| Passing isolated collaborator tests fully exonerates that collaborator. | debugging paragraph | overbroad under integration interactions |
| Green behavior should be followed by design and repetition inspection. | final Program Design paragraphs | directly supported |
| Every repeated shape should immediately become a new abstraction. | same paragraph read with Parts III-IV | too broad; stable pattern evidence remains necessary |
| The book's method eliminates the need for systems and performance study. | Onward, Developers and Computer Scientists | contradicted explicitly |
| Design-process analogies transfer proof standards unchanged across professions. | final section | not supported; the source offers analogies |

### Full-Reading Checkpoint

All canonical top-level units in HtDP living build 9.2.0.3 have now been read in
order: Preface, Prologue, Parts I-VI, all five Intermezzos, and Epilogue. Chapter
code, tables, diagrams, and raster assets have been inspected where present.
Canonical source defects and Developer adaptations remain separated from usable
derivation evidence throughout this audit.

The full reading supports the book's central method with important constraints:
model domain information explicitly; derive structural possibilities from data;
let purpose select behavior; use composition and abstraction after semantic
correspondence is understood; treat generative relations, accumulators, effects,
numerics, and costs as additional contracts; and interpret every green test
relative to the claim it observes.

No final fidelity verdict for the packaged HtDP references is recorded yet. The
next phase is to compare each packaged claim and existing anchor against this
complete evidence set, produce one consolidated repair queue, apply the repairs,
and then run source, package, type, test, and diagnostic verification.

### Provisional Repair Notes

- Add information/data/interpretation separation and maintenance communication to
  the whole-book provenance synthesis.
- Preserve iterative work-list refinement as evidence-guided scope selection.
- Qualify debugging guidance so isolated green collaborators do not erase
  integration and combination failures.
- Keep post-green design inspection separate from behavioral completion.
- Reconcile the Epilogue's abstraction encouragement with the stronger timing and
  semantic-correspondence evidence from Parts III-IV.
- Mark pure equational reasoning and effectful boundaries separately.

## Consolidated Packaged-Reference Repair Queue

The queue below is authorized only after the complete reading. It maps each
repair to the smallest packaged owner and keeps HtDP claims separate from
Developer adaptations.

| ID | Packaged owner | Repair | Canonical evidence |
| --- | --- | --- | --- |
| H1 | `skills/sketch/references/data-driven-design.md` | Separate function recipe from whole-program wish-list/refinement; distinguish full template inventory from purpose-selected final code; mark existing-repository recovery as Developer adaptation. | Preface; Chapters 3, 6, 13; Epilogue |
| H2 | `skills/sketch/references/data-shape-template-catalog.md` | Add constructibility, catch-all meaning, purpose-based omission, mutual-template collaboration, and the dominant/lockstep/Cartesian multi-input routes with invariant-violation behavior. | Chapters 4-6, 9-10, 19, 22-24 |
| H3 | `skills/sketch/references/composition-generative-recursion-and-accumulators.md` | Separate composition, abstraction timing, generated-instance preservation/progress, probabilistic and machine progress, accumulator ownership/invariant, totality change, and arithmetic/order/resource checks. | Chapters 11, 14-20, 25-34; Intermezzos 4-5 |
| H4 | `skills/model/references/problem-modeling.md` | Add simplest-sufficient-model calibration, prediction/observation/discrepancy refinement, syntax/parser/value separation, external/numeric assumptions, and well-founded progress. | Chapters 19-23, 26-29; Intermezzo 4 |
| H5 | `skills/verify/references/verifier-selection-and-pass-but-wrong.md` | Add exact HtDP calibrations for multiplicity, partial properties, function-valued schemas, residual versus location tolerance, order-sensitive numerics, and benchmark relevance. | Chapters 18, 23, 25, 27-29; Intermezzos 4-5 |
| H6 | `skills/signal/references/structural-movement.md` and `skills/abstraction-review/references/recipe-cards.md` | Preserve model-stability-before-simplification, full-template-versus-final-purpose, invariant evidence, and no-advantage accumulator variants; replace chapter-generic provenance with exact anchors. | Chapters 14-20, 24, 31-34 |
| H7 | `extensions/references/behavior-preserving-structural-change.md` | Add derive-complete-then-simplify, data-change propagation, runtime-semantic caveats for effects/inexact arithmetic/order, and resource-claim separation. | Chapters 19, 23; Intermezzos 4-5; Parts V-VI |
| H8 | `SOURCES.md` and all HtDP `Source Trace` blocks | Pin living build 9.2.0.3, retrieval date, exact HTML anchors, Developer adaptations, and canonical-defect exclusions. | this complete audit |

Repairs must not import the living build's recorded typos, undefined identifiers,
contract gaps, overbroad convergence/termination claims, or markup leaks. The
routing policies remain unchanged because the audit found derivation and
provenance defects, not a missing route relationship.

## Repair Application And Verification

All H1-H8 queue items were applied to their declared owners. The repaired
references now pin living build 9.2.0.3 and distinguish canonical HtDP methods
from Developer adaptations. The anchor validator checked 77 HtDP URL occurrences,
covering 34 unique source-unit/anchor pairs, against the locally hashed HTML
snapshot with no missing unit or anchor.

Verification evidence:

- package structure check: passed;
- package tests: 139 passed, 0 failed;
- focused Markdown/lens diagnostics: no findings across the ten repaired and
  audit files;
- primary TypeScript LSP diagnostics: no findings across the four extension
  modules;
- `git diff --check` on repaired references: passed;
- exact post-repair SHA-256 values: recorded above.

An initial `npm run check` from `/Users/boostree/coding` failed because that parent
directory has no `package.json`; it is not verification evidence. The same command
was rerun from `/Users/boostree/coding/agent/packages/developer` and passed.

### Final Fidelity Decision

The HtDP-derived packaged reference set is **faithful after repair** for its
claimed capability scope. It preserves source distinctions among function and
program recipes, structural inventory and purpose, composition and abstraction
timing, generated-problem correctness and progress, accumulator invariants and
ownership, numerical/cost caveats, and claim-relative verification. Package-owned
repository recovery, route ownership, compatibility surfaces, and machine-level
checks are now labeled as adaptations rather than attributed directly to HtDP.
