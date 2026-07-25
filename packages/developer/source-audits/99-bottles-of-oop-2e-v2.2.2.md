# Source Audit: 99 Bottles of OOP, Second Edition, v2.2.2

<!-- markdownlint-disable MD013 MD024 -->

The audit uses repeated chapter-local headings and evidence tables whose source
locations and hashes are intentionally kept on one row.

## Status

Complete. Chapters were read in order because the authors state that they build
on one another. The cumulative argument, Afterword, packaged-reference repairs,
and verification are recorded below.

> Integration note: the post-repair hashes in this audit attest the fidelity
> snapshot reviewed here. Current runtime references were later reorganized by
> source-independent judgment role in
> [`cross-source-judgment-integration-2026-07-24.md`](cross-source-judgment-integration-2026-07-24.md),
> which records splits, moved ownership, and current synthesis verification.

| Scope | Status |
| --- | --- |
| Source identity and extraction | complete |
| Front matter and reading order | complete |
| Chapter 1, *Rediscovering Simplicity* | complete |
| Chapter 2, *Test Driving Shameless Green* | complete |
| Chapter 3, *Unearthing Concepts* | complete |
| Chapter 4, *Practicing Horizontal Refactoring* | complete |
| Chapter 5, *Separating Responsibilities* | complete |
| Chapter 6, *Achieving Openness* | complete |
| Chapter 7, *Manufacturing Intelligence* | complete |
| Chapter 8, *Developing a Programming Aesthetic* | complete |
| Chapter 9, *Reaping the Benefits of Design* | complete |
| Cross-reference repair and verification | complete |

## Source Identity

- Title: *99 Bottles of OOP*
- Authors: Sandi Metz, Katrina Owen, and TJ Stankus
- Edition: Second Edition
- Version: 2.2.2
- Version date: 2024-12-01
- PDF pages: 296
- Source SHA-256:
  `7c3917b53033f59c1e7bc18feab89571c6aff077efe03a76452e870a93b9a83b`
- Audit use: authorized local PDF; the PDF is not copied into this repository

Page ranges below use the page numbers printed in the book. For Chapters 1-9,
the corresponding PDF page is the printed page plus 14.

## Audit Method

For each chapter:

1. read every extracted page in sequence rather than searching only for cited
   terms;
2. inspect rendered pages for figures, tables, sidebars, or code whose structure
   may be lost in text extraction;
3. reconstruct the chapter's argument, examples, qualifications, and connection
   to earlier chapters;
4. compare those claims and boundaries with every Developer reference that cites
   the book;
5. defer edits that depend on later chapters until the cumulative argument has
   been read.

The pre-audit keyword and table-of-contents search is treated only as an index.
It is not fidelity evidence.

## Reference Snapshot Before Repair

These hashes identify the packaged text being compared during the Chapter 1-2
pass. Later repairs must record replacement hashes.

| Path | SHA-256 |
| --- | --- |
| `skills/signal/references/structural-movement.md` | `0cb55f2491325d1ae0ae027e5c9f1fd2ac44b20a2a3d913cf1121b8de0dca9a8` |
| `skills/schedule/references/structural-change-timing.md` | `0d1f37a97218a588ac8d9b57f5516478703cb8eb5fa2a2900b5bcb59fba82474` |
| `skills/naming-judgment/references/domain-naming.md` | `52574374491deaca5e90989e639bf11457882969396c36a7c46e96420d1ef4b2` |
| `skills/verify/references/verifier-selection-and-pass-but-wrong.md` | `74198de88001d79745c76b2b3e369265957ae0d01ff0d044e6daf714a78efb4b` |
| `skills/sketch/references/responsibility-and-variation.md` | `5d3ef6d9604536bcc674699bdc13142df0ee720ec6b5896635ec9f4800f98321` |
| `skills/abstraction-review/references/recipe-cards.md` | `d47863bcd3bd1a627f2905d1c456f67abf41c866aff44357e79b7e087dcc3a20` |
| `extensions/references/behavior-preserving-structural-change.md` | `938d8d93b163e9f91db3039e92bca44712fd70c7af458164638a18e69b4e4210` |
| `SOURCES.md` | `fbab97899f9b99051e1b7f34e558a037bfb641d20e7882973a49edfa6c6ee256` |

## Reference Snapshot After Repair

| Path | SHA-256 |
| --- | --- |
| `skills/signal/references/structural-movement.md` | `011f8fafb48fdb11a1b50d891261076c5345257cfcd917aa69388c67f2687410` |
| `skills/schedule/references/structural-change-timing.md` | `78d580400c6950407297f2bd13a8740ea1cc38442e9551d53175b3e72ee6bae6` |
| `skills/naming-judgment/references/domain-naming.md` | `9a47d0a311457f5f699813349b41bed14ccdf87bf7d665202cbc02032b060dd2` |
| `skills/verify/references/verifier-selection-and-pass-but-wrong.md` | `75112b1e4843e5fcab548eae62735968277a00d0929b7bab217f177bf9239141` |
| `skills/sketch/references/responsibility-and-variation.md` | `1a97219191a7ebda47c5b7b8c9ccad9fd01d656b18aca868058805faef0c20c5` |
| `skills/abstraction-review/references/recipe-cards.md` | `4205c619aaae2cd3b883186ed95369e321c02a850f25148d84426150cb066ac3` |
| `extensions/references/behavior-preserving-structural-change.md` | `b343e0b6f6a2ac248a4fd528568aa60b69c952f1702606e36d536b25f2b08cd6` |
| `SOURCES.md` | `e77589a0642b4564b1379d5d3ec1bc49c68bd90639288daffd1d7b6c8e1f011d` |

## Chapter 1: Rediscovering Simplicity

**Read:** printed pages 2-22, PDF pages 16-36.

**Visual inspection:** PDF pages 17, 34, and 35. This confirmed the
concrete-to-abstract continuum, the four-solution metrics table, and the SLOC/ABC
comparison chart rather than relying on flattened extraction.

### Argument Reconstructed

The chapter begins with the cost bargain of object-oriented design: indirection,
smaller classes, and injected dependencies can lower later change cost, but they
also impose present comprehension and coordination costs. An abstraction is
therefore justified only when its offsetting benefit pays for it.

Four implementations provide the evidence rather than serving as four equally
valid styles:

1. **Incomprehensibly Concise** compresses duplicated and inconsistent logic,
   hides domain concepts, and optimizes for brevity rather than comprehension.
2. **Speculatively General** exposes some variants but adds choosing and rendering
   machinery whose indirection does not improve changeability enough to pay for
   itself.
3. **Concretely Abstract** has many small, DRY methods, but names implementation
   details and extracts the wrong concepts. Local simplicity does not compose
   into an understandable whole.
4. **Shameless Green** keeps four concrete verse variants visible, is cheap to
   write and understand, and waits for evidence before extracting the hidden
   abstractions.

The metrics discussion supplies a comparative check, not an automatic design
oracle. SLOC, cyclomatic complexity, and ABC illuminate different dimensions;
the authors explicitly retain common-sense judgment and call metrics fallible.
The chapter closes by defining Shameless Green as a quick, understandable,
test-backed accumulation of concrete examples whose temporary duplication is
cheaper than recovery from an incorrect abstraction.

### Boundaries That Must Survive Derivation

- The chapter does **not** reject abstraction. It asks for the cost-effective
  point between excessive concretion and excessive abstraction.
- It does **not** make duplication intrinsically good. Duplication is tolerated
  while it preserves understandable, distinct examples and prevents premature
  commitment.
- It does **not** make metrics authoritative. Metrics challenge opinion and aid
  comparison, but do not replace domain and cost reasoning.
- Shameless Green is not the final design for every changing system. It may be
  the cheapest final answer when no change arrives; later change pressure raises
  the design standard.
- A method should be named for the domain meaning it represents, not merely the
  value or mechanism it currently returns.

### Developer Comparison

| Packaged claim or use | Source location | Decision |
| --- | --- | --- |
| An understandable concrete implementation with protected examples can be a strong baseline. | pp. 2-15, 22 | supported |
| Temporary duplication may be cheaper than a guessed abstraction. | pp. 2, 12-15, 22 | supported |
| Static size or complexity numbers must not substitute for change-cost evidence. | pp. 16-22 | supported; Developer states the boundary more operationally |
| Implementation-shaped names become false when implementation changes. | pp. 12-13 | supported, but `domain-naming.md` currently omits Chapter 1 from its 99 Bottles trace |
| `SOURCES.md` assigns the combined Chapters 1-2 row primarily to `verify`. | pp. 2-22 | repair candidate: Shameless Green and the concrete baseline are principally used by `signal` and timing judgment; testing evidence belongs to `verify` |

No Chapter 1 contradiction was found in `structural-movement.md` or
`structural-change-timing.md`. Final wording remains open until the book's later
change-pressure and refactoring argument is read.

## Chapter 2: Test Driving Shameless Green

**Read:** printed pages 23-50, PDF pages 37-64.

**Visual inspection:** PDF pages 44, 45, 60, and 63. This confirmed both metrics
tables, the exact contrast between the two verse-2 implementations, the
implementation-echo test, the pass-but-wrong implementation, and the final test
options.

### Argument Reconstructed

Chapter 2 shows how the concrete baseline is produced rather than merely praising
its final form. Red/Green/Refactor repeatedly constrains the implementation with
new examples. Green means only that the implementation is supported by the tests
currently at hand; incomplete tests still permit incomplete or wrong code.

The development sequence distinguishes two superficially similar kinds of
duplication:

- verses 99 and 3 provide enough instances of one understood varying template to
  justify a generalization;
- verses 2, 1, and 0 provide distinct information whose shared abstraction is not
  yet understood, so preserving whole concrete branches is clearer than hiding a
  guessed pluralization rule;
- copying already-owned verse lyrics into `verses` supplies no independent
  example and obscures responsibility, so that duplication should be removed by
  delegating to `verse`.

The chapter then derives API and naming decisions from sender knowledge.
`verses` owns range traversal and accumulation; `verse` owns a single verse;
`song` preserves an intention-level message so callers need not know the
implementation range or argument order.

The testing argument culminates in an explicit pass-but-wrong case. A test that
compares `song` with `verses(99, 0)`, or reimplements the same loop in the test,
can pass while the application fails to produce the song. A concrete expected
result is longer but independent of the current implementation and directly
checks the public responsibility.

### Boundaries That Must Survive Derivation

- Small TDD steps are a learning and correction mechanism, not ritual. An obvious
  implementation may skip steps when the leap is genuinely small and certain.
- Duplication is informative only when each example is independent and adds new
  information. Repeating an already-understood implementation is not protected
  by the same argument.
- Horizontal progress in this chapter means reaching a complete, maximally
  informative concrete baseline before taking speculative abstraction tangents.
  It is not a universal ban on alternating all behavior and structural work.
- The chapter's preference for concrete expected output addresses tests that
  would otherwise mirror production logic. It must not be inflated into a ban
  on every test helper, property, contract test, or abstraction in every domain.
- Green is evidence relative to assertions and coverage, not proof that the
  intended behavior is present.

### Developer Comparison

| Packaged claim or use | Source location | Decision |
| --- | --- | --- |
| Preserve whole, understandable examples when only a guessed abstraction would remove duplication. | pp. 30-36 | supported |
| Distinguish useful independent examples from duplication that repeats an already-owned responsibility. | pp. 37-41 | supported; this qualification should remain visible wherever "tolerate duplication" is summarized |
| Derive names and public messages from responsibility and sender knowledge. | pp. 37-43 | supported |
| Prefer tests of public responsibility over tests that echo implementation. | pp. 44-49 | supported |
| Search for an implementation that passes the current test but violates the intended result. | pp. 45-48 | directly supported |
| Passing execution is distinct from verifier relevance. | pp. 44-48 | supported with synthesis; Developer generalizes the book's concrete example |
| Use claim-specific test layers, properties, role tests, and stateful fixtures. | Chapter 2 alone does not establish this broader ladder | pending Chapters 9 and the other cited sources |
| `domain-naming.md` cites Chapter 2 for responsibility-derived naming. | pp. 37-43 | supported |

No Chapter 2 contradiction was found in
`verifier-selection-and-pass-but-wrong.md`. Its broader verifier ladder is not
credited to this chapter alone and will be judged against Chapter 9 and its other
cited sources.

## Chapter 3: Unearthing Concepts

**Read:** printed pages 51-72, PDF pages 65-86.

**Visual inspection:** PDF pages 69, 73, 78, 82, and 84. This confirmed the
Open/Closed flowchart, the complete Flocking Rules and sidebar, the naming table,
and both sides of the gradual sender/receiver cutover.

### Argument Reconstructed

A concrete new six-pack requirement changes the economics established in the
first two chapters. The authors still reject speculation: the code should meet
the stated request, not imagined multiples-of-six or case-of-beer requirements.
But the actual request reveals that the current conditional is not open to this
kind of change and raises the design standard for the affected code.

The Open/Closed flow is conditional rather than dogmatic:

1. if the code is open, make the behavior change;
2. if it is not open but the safe rearrangement is known, make it open and then
   add the behavior;
3. if neither is true, remove the easiest-to-fix or best-understood smell, then
   reassess.

The chosen duplication smell is a point of attack, not a proven direct route to
the final design. The Flocking Rules then replace destination-first design with
a repeatable discovery process: select the most alike pair, find its smallest
difference, and make the simplest behavior-preserving change that removes that
difference. The operational sequence is parse, execute, use the result, and
delete the replaced code. Tests run between changes; an unexplained red result
means undoing and taking a smaller step.

The verse-2/default comparison demonstrates the full argument. Apparent numeric
differences are first converted to a common variable. The surviving
`bottle`/`bottles` difference is named `container` only after the six-pack case
and imagined neighboring examples reveal a domain category. The book rejects
both a too-concrete `bottle` name and a many-levels-too-abstract `unit` name.

Finally, the new `container` argument is introduced by gradual cutover. A
usefully wrong temporary default lets receiver and senders change one at a time.
After every sender supplies the argument, the default and now-identical verse-2
branch are deleted. The temporary compatibility shape is part of the route, not
part of the destination.

### Boundaries That Must Survive Derivation

- Waiting for change does not mean ignoring a change once it arrives. Current
  pressure licenses improvement of the affected code while still forbidding
  invented requirements.
- Open/Closed does not prescribe a class hierarchy or factory here. It first
  separates structural opening from the behavior addition.
- A code smell selects a tractable experiment when the path is unknown; it does
  not prove a particular abstraction or final architecture.
- Horizontal focus is not an absolute ban on interleaving work. The text allows
  interleaving but recommends finishing the current path when its terminus is in
  sight.
- One-line changes are deliberate training and a fallback when larger steps go
  red. The authors explicitly permit combining steps when circumstances and
  feedback allow.
- A temporary default must be recognizable and removed after cutover. Leaving
  the shim in place would contradict the example.

### Developer Comparison

| Packaged claim or use | Source location | Decision |
| --- | --- | --- |
| State actual change pressure and do not manufacture a future requirement. | pp. 51-54 | supported |
| When the destination is unknown, select one tractable smell or point of attack and reassess after movement. | pp. 55-57, 71-72 | supported |
| Compare the most alike pair and expose one smallest meaningful difference. | pp. 58-64 | directly supported |
| Treat horizontal alignment as evidence gathering rather than advance selection of polymorphism or a factory. | pp. 60-64 | supported; Developer deliberately narrows the book's method to the `signal` boundary |
| Use parse, execute, use, and delete as safe intermediate states. | pp. 58-59, 65-71 | directly supported |
| Move senders gradually while old and new call shapes safely coexist, then remove the temporary compatibility form. | pp. 67-71 | directly supported |
| A stable domain name should be above current instances but not detached from domain language. | pp. 63-64 | directly supported |
| `domain-naming.md` attributes 99 Bottles naming only to Chapters 2, 4, 5, and 9. | pp. 63-64 | repair candidate: Chapter 3 contains one of the book's central naming derivations |
| Stop every implementation route and reroute after each stable landing. | Chapter 3 establishes green deployable intermediates, not Developer's route lifecycle | supported with synthesis from the runtime architecture and later stable-landing material; do not attribute the orchestration rule solely to this chapter |

No contradiction was found in `structural-movement.md` or
`behavior-preserving-structural-change.md`. Their separation of observation from
mutation and their adaptive rerouting are Developer responsibility boundaries,
not claims that the book itself defines those leaf skills.

## Chapter 4: Practicing Horizontal Refactoring

**Read:** printed pages 73-101, PDF pages 87-115.

**Visual inspection:** PDF pages 93, 99, 103, 108, and 114. This confirmed the
responsibility-naming table, stable-landing discussion, Liskov contract argument,
the green-but-wrong `quantity` expansion, and the final common-template cutover.

### Argument Reconstructed

Chapter 4 completes the horizontal refactoring begun in Chapter 3. It repeatedly
aligns the nearest remaining branch with the default branch, replacing each
surviving difference with a named message. The repetition is important: it first
teaches tiny-step extraction, then permits larger steps only after the movement
pattern is recognized and can be recovered when a larger step goes red.

Naming is treated as an evidence-sensitive activity. `pronoun` is accepted as a
provisional, good-enough name so progress need not wait for certainty. `quantity`
is derived by describing the responsibility and comparing representative values.
The tempting `remainder` name is rejected because it describes one position in
the current implementation, not the concept's wider use. Names are reassessed as
new examples reveal more.

The temporary-default examples add an important operational qualification. A
sentinel default works only when it routes execution through the already-working
branch. When the opposite branch must execute, the temporary default must be a
real value that satisfies that condition. In both cases the default is removed
when all senders have moved.

The extracted methods reach a stable landing because they are green, consistent,
understandable, and safe to pause on. Their common shape is not cosmetic; it
makes the next structural comparison possible. The following Liskov discussion
then shows why a receiver must honor the contract its senders rely on. Returning
a string in one branch and an integer in another forces the sender to know and
repair the receiver's variation; making the receiver return a consistently
capitalizable value removes that leaked knowledge.

The final `successor` extraction is also a pass-but-wrong lesson. Expanding
`quantity` to handle the restart value keeps tests green but conflates two
responsibilities and creates an inconsistent method shape. Further alignment
reveals that choosing what text represents a number and choosing the next verse
are separate concepts. The final cutover runs the common template alongside the
old case statement before deleting the replaced conditional.

### Boundaries That Must Survive Derivation

- Provisional naming is allowed, but a vague placeholder is a debt marker rather
  than evidence that the concept is sound.
- A stable landing is not merely any passing command. In this chapter it is a
  coherent, consistent state from which the next move can be judged safely.
- Larger refactoring steps are earned by recognition of a previously practiced
  movement and must shrink again when feedback shows lost understanding.
- Liskov is used here as a sender/receiver contract and substitution argument.
  It does not imply that every differing return representation requires a class
  hierarchy.
- Passing tests do not validate an abstraction's responsibility. The
  `quantity` overreach is behaviorally green and structurally wrong.
- Static metrics can worsen while the design improves because isolated domain
  responsibilities and dependency placement are not fully measured by those
  metrics.
- Depending on an abstraction requires using it at every location where the
  concept applies; an accidentally passing raw expression is not equivalent.

### Developer Comparison

| Packaged claim or use | Source location | Decision |
| --- | --- | --- |
| Intermediate names may remain provisional while horizontal movement reveals responsibility. | pp. 75-80 | directly supported |
| Derive a name from what a unit represents or promises rather than its current branch or expression. | pp. 78-80, 93-99 | directly supported |
| A stable landing is green, understandable, consistent, safe to pause on, and useful for the next comparison. | pp. 84-86 | directly supported |
| Increase step size only after the movement is understood; shrink after unexplained red feedback. | pp. 90-93 | directly supported |
| Require substitutable collaborators or returns to honor the sender-visible contract. | pp. 86-90 | directly supported |
| A passing test can coexist with a responsibility error or structurally wrong abstraction. | pp. 93-99 | directly supported |
| Use the new result alongside old selection code, then delete the replaced conditional after green evidence. | pp. 99-100 | directly supported |
| Every stable landing must close a Developer implementation route. | The source supports pausing and replanning, not the runtime state-machine rule itself | supported with synthesis; retain explicit ownership by Developer orchestration |
| `SOURCES.md` groups stable landings under the Chapters 4-5 row led by `abstraction-review`. | pp. 84-86 | repair candidate: stable-landing observation and mutation are primarily owned by `signal` and the implementation protocol |

No contradiction was found in `domain-naming.md`, `structural-movement.md`, or
`responsibility-and-variation.md`. The stronger checklist in
`behavior-preserving-structural-change.md` is a conservative operationalization
of the chapter's examples plus Developer's route boundary, not a verbatim rule
from the book.

## Chapter 5: Separating Responsibilities

**Read:** printed pages 102-137, PDF pages 116-151.

**Visual inspection:** PDF pages 120, 126, 130, 133, 135, 142, 146, and 149.
This confirmed the Squint Test and conditional-shape comparison, the object-versus-
behavior conditional distinction, the class-extraction cutover, argument-removal
steps, immutability rationale, cache tradeoff, and unfinished Liskov repair.

### Argument Reconstructed

The chapter does not treat the previous refactoring's failure to achieve openness
as proof that it should continue. It first asks whether the resulting code is
better enough to justify another experiment and explicitly preserves reversion
as an option. The next candidate is then inferred from overlapping observations,
not from one smell: five methods share shape, conceptual argument, conditional
form, privacy boundary, and dependence on the argument rather than the host
class. The book also distinguishes identical argument names from identical
concepts; `number` denotes a verse number in one context and a bottle number in
another.

Those observations identify Primitive Obsession and motivate `BottleNumber`.
The conceptual move matters more than the Ruby class: an object may model an idea,
not only a physical thing. The class groups a bottle number's value with behavior
that was previously supplied for a primitive. A conditional that selects an
object remains legitimate; a conditional that repeatedly interprets a value and
supplies that value's behavior indicates a missing responsibility in this OO
example.

Class naming receives a narrower rule than method naming. Methods should name
what they mean, but naming the class `ContainerNumber` would anticipate a broader
future. Two actual bottle requirements justify the more concrete
`BottleNumber`; the name can be revisited when evidence changes.

The extraction itself preserves known code before improving it. Methods are
copied into an unused class, parsed, executed without using their results, used
one forwarding method at a time, and only then deleted from the old owner. The
existing `Bottles` tests temporarily become integration coverage for the new
class. Redundant arguments are removed through a separate five-step cutover:
make the body use owned state, allow old and new calls, update senders, make stale
senders fail, and clean up. A failure in `pronoun` reveals a missed internal
sender rather than invalidating the recipe.

The immutability and performance sections then challenge a premature optimization
assumption. Immutable values are easier to reason about and test and avoid shared-
mutation races. Caching and mutation can reduce allocations but add invalidation,
coordination, and test costs. The default proposed here is simple immutable
objects followed by measurement and profiling, while a local temporary cache is
accepted when it has a clear benefit and little invalidation complexity.

Finally, `successor` exposes a type-transition contract problem. After the bottle
number concept becomes an object, returning an integer from `successor` no longer
honors the caller's expectation of another role-compatible bottle number. The
chapter records the violation but finishes the current horizontal cache cutover
before repairing it. It ends at an explicitly imperfect stable landing: focused
responsibilities and regular code coexist with no direct `BottleNumber` unit
tests, remaining conditionals, temporary variables, and the known Liskov issue.

### Boundaries That Must Survive Derivation

- A class extraction is supported by several converging observations. A repeated
  argument, shared shape, or conditional alone is not sufficient evidence.
- Same spelling does not imply same domain concept, and different spellings do
  not imply different concepts. Ownership analysis must follow meaning and use.
- The chapter's suspicion of conditionals is bounded: selection and construction
  conditionals remain legitimate; dispersed behavior-selection conditionals are
  the target.
- Extracting a responsibility does not prove the wider requirement is local yet.
  Chapter 5 still has not achieved six-pack openness.
- A class may be named concretely from current domain evidence. The method-level
  “one abstraction higher” rule is not promoted to a universal naming formula.
- Immutability is a preferred starting point in this argument, not evidence that
  identity, history, or measured performance can never justify mutation.
- “Treat object creation as free” is a design default pending measurement, not a
  claim about actual runtime cost.
- A stable landing can contain known, recorded defects and missing focused tests.
  It is safe and coherent enough to pause, not perfect or finished.
- Refactoring under a recipe is not mindless. A localized failure is evidence to
  inspect the changed dependency or missed sender.

### Developer Comparison

| Packaged claim or use | Source location | Decision |
| --- | --- | --- |
| Group knowledge and behavior only when repeated arguments, shape, dependence, privacy, and change pressure converge. | pp. 103-112 | directly supported |
| Treat a smell as evidence for a movement, not a pattern-shaped destination. | pp. 102-112 | directly supported |
| Distinguish conditionals that select collaborators from conditionals that supply their behavior. | pp. 110-112 | directly supported |
| Model a domain idea and its behavior together rather than passing a primitive through behavior providers. | pp. 111-117 | directly supported |
| Move copied behavior through parse, execute, use, and delete before improving it. | pp. 113-117 | directly supported |
| Update senders one at a time and use the final signature to expose any stale sender. | pp. 118-125 | directly supported |
| Prefer immutable extracted values when that simplifies reasoning, while preserving identity/history exceptions. | pp. 127-129 | supported with an explicit Developer boundary; the book argues the default more strongly |
| Measure before introducing cache or mutation complexity, but accept a low-cost local cache when justified. | pp. 128-132 | directly supported |
| A transition operation should return a value that honors the receiver's role contract. | pp. 133-135 | directly supported |
| Stop at a coherent landing even when a separately identified Liskov repair remains. | pp. 133-137 | directly supported |
| `domain-naming.md` cites Chapter 5 for naming classes. | pp. 112-113 | supported |
| `responsibility-and-variation.md` separates target collaboration from sender-by-sender implementation. | pp. 113-125 | supported and ownership-preserving |

No contradiction was found in `recipe-cards.md`,
`responsibility-and-variation.md`, or
`behavior-preserving-structural-change.md`. Their requirement that an eventual
candidate localize a representative change is stricter than the intermediate
Chapter 5 result, but it prevents the chapter's temporary extraction from being
mistaken for a finished abstraction.

## Chapter 6: Achieving Openness

**Read:** printed pages 138-170, PDF pages 152-184.

**Visual inspection:** PDF pages 155, 158, 163, 165, 171, 174, 176, 177, and
183. This confirmed the four-phrase template, competing conditional recipes,
factory seam, polymorphic role, domain-question rewrite, factory relocation,
dual-type bridge, side-by-side return-type cutover, and final domain-defense
counterexample.

### Argument Reconstructed

The chapter first removes a `quantity`/`container` pairing as a small data clump.
It explicitly admits that custom `to_s` is close to being too specific to the
verse context; the example is useful because it reveals the four-phrase template,
not because every such pair should become a string conversion. The remaining
blank line in `verse` is treated as evidence of another responsibility rather
than proof of a particular destination.

The repeated `BottleNumber` conditionals then expose a Switch Statement smell.
Two recipes could apply: State/Strategy through composition or polymorphism
through inheritance. The authors choose the latter because it fits this case,
while recommending reversible experiments with competing recipes when judgment
is uncertain. The choice is not presented as a universal inheritance rule.

Replace Conditional with Polymorphism moves each true branch into a specialized
role player and leaves default behavior in the base class. As soon as more than
one class plays the bottle-number role, selection knowledge is centralized in a
factory. The factory is the one allowed place for concrete class names and
selection logic; callers depend only on the common messages. This introduces a
new dependency deliberately rather than pretending polymorphism removes all
conditionals.

After the hierarchy is formed, the domain questions themselves change. The code
no longer primarily explains verse variants; it says that verses share a
template while bottle numbers vary. This reframing exposes the outstanding
`successor` contract violation: a bottle number transition still returns an
integer because its representation was not updated when the domain type changed.

The return-type migration proceeds through valid intermediate states. The factory
is moved within reach of all `successor` implementations and temporarily accepts
both integers and bottle numbers. Implementations are migrated one by one, then
the caller runs old and new forms side by side before selecting the new result.
Once every implementor and sender agrees on the bottle-number return type, the
type guard and old path are removed. A temporary type check is accepted as
migration scaffolding, not retained as final design.

Only after this structural work does the chapter return to TDD for the six-pack
behavior. The new variant needs two tiny domain methods, but the still-closed
factory also needs a new branch. The authors therefore qualify the claim of
openness: behavior is open except for selection registration. Finally, a shorter
`to_s` override is rejected even though it passes tests, because it hides the
true `quantity` and `container` responsibilities and couples the variant to the
current rendering context.

### Boundaries That Must Survive Derivation

- A data clump is a signal of a concept, but the selected representation must
  still fit uses beyond the current caller. The chapter itself questions its
  specialized `to_s` choice.
- Polymorphism does not eliminate selection conditionals. It concentrates them
  in a creation boundary and introduces concrete-class knowledge there.
- State/Strategy and inheritance are competing realizations. This example's
  choice of inheritance is contextual, reversible, and not a universal target.
- A factory is required here only after several classes play one role. It is not
  prescribed before the variant set and selection pressure exist.
- Type transitions are part of the role contract. Changing a domain
  representation without changing transition results leaves duplicated repair
  knowledge in senders.
- Temporary mixed-type acceptance is valid only during migration and must be
  removed after all implementors and callers converge.
- The code is not fully open while adding a variant still requires editing the
  factory. Chapter 7, not this chapter, judges whether greater factory openness
  is worth its cost.
- Passing feature tests does not validate a shortcut that lies about domain
  responsibilities or relies on one rendering context.

### Developer Comparison

| Packaged claim or use | Source location | Decision |
| --- | --- | --- |
| Treat repeated data or messages that travel together as a possible missing concept, then test whether the chosen boundary is general enough. | pp. 138-141, 169-170 | supported; the second clause preserves the book's own `to_s` warning |
| Choose polymorphism only for a real common role whose callers can ignore concrete type. | pp. 143-156 | directly supported |
| Keep conditionals when they own selection; do not confuse selection with supplying every variant's behavior. | pp. 143-151 | directly supported |
| Centralize concrete-class and selection knowledge in a factory after multiple role players exist. | pp. 147-151 | directly supported |
| Model a transition with current type, target type, operation, preserved role, and boundary behavior. | pp. 156-165 | directly supported |
| Permit old and new return types to coexist temporarily, move implementors and callers, then remove the bridge. | pp. 159-164 | directly supported |
| Run old and new result paths side by side when the replacement is uncertain. | pp. 162-163 | directly supported |
| Reject a pass-but-wrong shortcut that couples a domain role to the current output context. | pp. 168-170 | directly supported |
| Prefer the least powerful factory mechanism that satisfies actual extension pressure. | Chapter 6 establishes the concrete factory and leaves its openness unresolved | pending Chapter 7; not established by Chapter 6 alone |
| `domain-naming.md` omits Chapter 6's generic factory-name and receiver-context argument. | pp. 159-160 | coverage candidate, not a current contradiction; other cited naming material may already support the packaged rule |

No contradiction was found in `responsibility-and-variation.md` or
`recipe-cards.md`. Their warnings against choosing polymorphism or factories in
advance accurately preserve the chapter's sequence: the role and variant
pressure precede those structures. The implementation protocol's temporary
compatibility-shape rule is directly supported by the mixed-type factory bridge.

## Chapter 7: Manufacturing Intelligence

**Read:** printed pages 171-187, PDF pages 185-201.

**Visual inspection:** PDF pages 186-189, 191-192, 194, 196-197, 199, and
201. This confirmed the Shameless Green/factory contrast, factory dimensions,
meta-programmed lookup and its objections, default-first lookup sidebar,
syntax-color comparison, dispersed selection, self-registration dependency,
auto-registration hook, and final summary.

### Argument Reconstructed

The chapter begins by comparing the only conditional in Shameless Green with the
only conditional in the concrete factory. Their branch counts differ partly
because they classify different domain things: verse 2 is special only because
it contains bottle number 1. The deeper distinction is responsibility. The
procedural conditional both decides why to switch and supplies the behavior; the
factory decides why to switch and selects the class that supplies behavior. A
factory therefore separates choosing from the chosen rather than making
conditional logic disappear.

For a polymorphic role to protect senders from new variants, senders must remain
ignorant of concrete class names and selection rules. The factory owns exactly
that knowledge: manufacture the right role player without implementing the
variant's behavior. The chapter then varies factory design along three
independent axes: open versus closed membership, factory-owned versus
candidate-owned choosing logic, and factory discovery versus candidate
volunteering.

A naming-convention and reflective lookup makes the factory open, but at concrete
cost. It is harder to understand, hides source references, risks deletion of
apparently unused classes, uses an exception for control flow, and silently
ignores classes that violate the convention. Whether those costs are justified
depends on how frequently variants are added. If the factory rarely changes,
the simple closed conditional is cheaper; openness is secondary to correctly
manufacturing the role player.

A key/value factory supports arbitrary names and separates mapping data from the
lookup algorithm. This creates options for external configuration while making
the whole operation somewhat harder to read. The syntax-color comparison is a
visual heuristic for topic alternation and cohesion, not an independent proof of
a good abstraction. The chapter explicitly accepts small, isolated procedures
that do not change and recommends paying OO's indirection cost only for shared,
changing domain behavior.

Choosing logic moves into candidates only when it is complex and changes with
the candidate. In this simple example `handles?` is acknowledged as excessive.
The move also introduces ordering, default-placement, overlapping-match, and
possible priority questions. A registry can remove the factory's hard-coded
candidate list, but then candidates depend on either the factory's concrete name
or an inherited registration method. Omitting an explicit receiver does not
remove dependency; it exchanges one dependency for another whose stability must
be judged.

Automatic registration likewise requires an identifying convention. Reflection
can discover broadly but may be slow and obscure; an inheritance hook is fast
only by committing every role player to one hierarchy. Each increasingly open
factory is therefore an alternative with a different dependency arrangement,
not the chapter's required final destination. The next chapter immediately
reverts to the simple case-statement factory before making other design
judgments.

### Boundaries That Must Survive Derivation

- A selection conditional and a behavior conditional can have similar syntax
  while owning materially different responsibilities.
- A factory does not remove conditional knowledge. It isolates variant names,
  eligibility, and selection from role-using senders.
- Openness is an economic choice governed by actual variant frequency and change
  cost. It is not a quality that every factory should maximize.
- Moving mappings from code to data changes the update surface; it does not make
  variant introduction free or automatically easier to understand.
- Candidate-owned selection is justified when that logic is substantial and
  changes with the candidate, not merely because self-selection is possible.
- Registries require explicit policies for default ordering, multiple matches,
  priority, duplicate candidates, and failure visibility.
- Self-registration and auto-discovery add dependencies on a factory name,
  hierarchy, naming convention, reflection mechanism, or load behavior. Hidden
  dependencies are still dependencies.
- Inheritance is one way to implement a role, not part of the role contract.
  Auto-registration through an inheritance hook deliberately narrows that
  freedom.
- Small stable procedures can remain procedural. Splitting behavior into objects
  carries a whole-system comprehension cost that must be repaid by change.
- The chapter's escalating examples are a tradeoff survey, not a prescribed
  migration from conditional to reflection to registry.

### Developer Comparison

| Packaged claim or use | Source location | Decision |
| --- | --- | --- |
| Separate a coordinator that both chooses a variant and implements every variant's behavior. | pp. 171-174 | directly supported |
| Keep role users dependent on the role and place concrete selection knowledge at a creation boundary. | pp. 173-174 | directly supported |
| Treat concrete conditional, mapping, registration, self-registration, and discovery as a factory continuum. | pp. 174-186 | directly supported |
| Compare who knows variants, how variants enter, ordering, reflection, naming, and failure assumptions. | pp. 174-186 | directly supported; duplicate and deployment checks are conservative operational additions |
| Choose the least powerful mechanism that satisfies real extension pressure. | pp. 174-176, 179-186 | directly supported; resolves the Chapter 6 pending item |
| Keep a local finite conditional when it remains understandable and cheap to change. | pp. 175-179 | directly supported |
| Move choosing logic into candidates only when it changes in lockstep with them. | pp. 179-181 | directly supported |
| Judge dependencies by likely stability rather than claiming that implicit registration removes them. | pp. 182-185 | directly supported |
| Use registration whenever adding a fake variant can be made additive. | Chapter 7 repeatedly says registration may be excessive and openness may not repay its cost | not a valid source-derived universal rule; current `Dispatch Registration` card remains bounded by candidate pressure and the package's rejection/defer gates |
| Push construction to the application edge to avoid an internal factory. | Chapter 7 does not make this argument | pending Chapter 8 |

No contradiction was found in `responsibility-and-variation.md`. Its factory
continuum, operational checks, and least-powerful-mechanism rule accurately
compress the chapter while retaining costs that the examples expose. The compact
`Dispatch Registration` recipe card is not a summary of Chapter 7's factory
advice by itself; it is safe only under the package's existing pressure and
candidate-review gates. It should not become the sole routed reference for an
unsettled factory choice.

## Chapter 8: Developing a Programming Aesthetic

**Read:** printed pages 188-225, PDF pages 202-239.

**Visual inspection:** PDF pages 205, 207, 211, 217-218, 220, 222, 225-226,
230, 233, and 238-239. This confirmed the blank-line smell, speculative
conditional, wishful-message derivation, extract/inject role diagrams, DIP and
Demeter boundaries, forwarding-versus-abstraction contrast, sender-oriented role
API, creation/use separation, optional final extraction, and five aesthetic
precepts.

### Argument Reconstructed

The chapter first returns to the simplest Chapter 7 factory. This confirms that
the prior chapter's escalating factories were alternatives, not a required final
state. It then presents an unresolved tension: `verse` appears to do two things,
but it is short, working, and under no change pressure. Splitting it would add
indirection. Intuition may identify a concern, but voluntary restructuring is a
bet whose cost needs an articulable heuristic rather than an unexplained feeling.

A real requirement then arrives: support other countdown songs with different
lyrics. When no existing smell clearly reveals the move, a speculative
conditional is written as pseudocode. Its branches make the future Switch
Statement and Long Function visible, allowing the code to revert and treat the
current lyrics as one branch to extract. Pseudocode is used here to produce
information cheaply, not as implementation or evidence that every imagined
branch should be built.

`BottleVerse` is first extracted by the safe copy, execute, use, and delete
recipe. Wishful thinking then permits a larger but reversible variation: ask
what `Bottles` wants from the receiver and name the message `lyrics`. This can
reduce mechanical steps, but until the extracted class is wired back into the
covered path, tests establish syntax rather than behavior. Failure requires an
immediate fix, undo, smaller recipe steps, or TDD of the new class.

Extraction alone leaves `Bottles` coupled to the concrete `BottleVerse` class.
The accepted variation is isolated by naming a verse-template role, injecting a
player of that role, and forwarding the desired message. Dependency inversion is
therefore not generic indirection: high-level song behavior retains necessary
knowledge of the role while concrete provider choice comes from outside. The
chapter's central movement is extract the behavior that must vary and inject it
back behind the role.

The initial role API still chains `verse_template.new(number).lyrics`. Demeter is
about crossing API boundaries to collaborators' collaborators, not counting
periods: a chain whose intermediate values preserve one API can be valid. A long
cross-object chain creates context-heavy reuse and test setup and often hides the
sender's actual request. Mechanical forwarding reduces direct coupling, but a
forwarding name assembled from the old object path preserves structural context.
The stronger repair asks the direct collaborator for the sender's domain desire,
such as `playdate_time_limit` or `lyrics(number)`.

The `lyrics(number)` role boundary cannot simply inject a prebuilt verse instance
because the verse number is known only during enumeration. The forwarding class
method therefore acts as the injected role player while domain behavior remains
on an instance. The book strongly prefers instance domain behavior because it
preserves room for per-object data; this is a Ruby/OO heuristic rather than a
language-independent requirement imported wholesale into Developer.

Finally, `BottleVerse#lyrics` still creates a `BottleNumber`. Moving that
conversion to the class-side boundary separates object creation from instance
use and removes the concrete class name from the instance method. The migration
again uses temporary dual-type acceptance, then renames the owned value through
small or one-undo changes. A final `for` extraction would separate creation and
use even more rigorously, but the chapter explicitly defers it because no caller
needs direct access to a verse object.

### Boundaries That Must Survive Derivation

- An intuition or code smell invites inspection; without change pressure or an
  explainable payoff, even a plausible responsibility split may add unjustified
  indirection.
- Speculative pseudocode is a low-commitment probe. Imagined variation is not an
  accepted implementation scope.
- Wishful messages come from what the sender wants, not from concatenating the
  current construction and navigation path.
- Larger refactoring steps trade safety for speed. Behavior evidence begins only
  when the new path is actually used.
- Dependency inversion preserves a necessary role dependency while removing a
  concrete provider dependency. It does not mean injecting every reachable
  object.
- Isolate the behavior implicated by the accepted variation; do not generalize
  every dimension merely because another role could be invented.
- Demeter violations are determined by changing collaborator APIs, not by the
  visual number of message sends or dots.
- Forwarding can be a useful decoupling step even when it leaves a
  structure-shaped name. A deeper abstraction is justified when the sender's
  actual domain request can be named and owned coherently.
- Test setup is reuse evidence: nested collaborators and stubs-in-stubs expose
  context coupling, but simple forwarding should not be added unless it changes
  what the sender must know.
- Pushing creation toward an edge removes concrete construction knowledge from
  domain instance methods; it does not necessarily eliminate a factory.
- The book's five closing precepts are intentionally strong, but the chapter
  itself also defers an unnecessary final separation and earlier declines an
  unpressured split. Developer must preserve that evidence-sensitive boundary.
- `one-undo` means one reversible editor operation, not permission for a broad
  mixed-purpose diff.

### Developer Comparison

| Packaged claim or use | Source location | Decision |
| --- | --- | --- |
| Begin with an accepted change and do not design toward roles, injection, or factories in advance. | pp. 188-193, 224-225 | supported by the worked argument; the closing rhetoric is broader, so Developer intentionally retains the earlier evidence gate |
| Write wished messages from the sender's desired domain result. | pp. 196-198, 210-216 | directly supported |
| Isolate the behavior that the real requirement needs to vary, then extract and inject a role player. | pp. 192-205 | directly supported |
| High-level behavior should depend on a stable role rather than the concrete variant. | pp. 199-205 | directly supported |
| Inject a dependency when it represents a caller-chosen collaborator, not merely to make every object configurable. | pp. 199-205, 218-224 | supported as a conservative Developer boundary; the chapter's closing prose advocates broader decoupling |
| Treat difficult setup and nested stubs as evidence of context coupling and weak reuse. | pp. 207-215 | directly supported |
| Prefer asking the direct collaborator for the sender's domain result. | pp. 209-216 | directly supported |
| Treat any long navigation chain as a violation. | pp. 209-210 | too broad: the source explicitly exempts same-API chains; current reference needs a sharper API-boundary criterion |
| Reject forwarding whenever it preserves the underlying data path. | pp. 210-213 | too strong: forwarding alone lowers direct coupling and test setup, although a sender-oriented abstraction is the better final result when available |
| Push object creation toward the edge and separate it from use. | pp. 218-224 | directly supported |
| Pushing creation to the edge removes the need for an elaborate domain factory. | pp. 218-224 | not established: the example retains `BottleNumber.for`; moving creation removes it from the instance method, not from the application |
| Defer a more rigorous creation/use split until a caller needs the separately created object. | pp. 223-224 | directly supported |
| Derive names from the sender's desired result rather than the current object path. | pp. 210-216 | directly supported; `domain-naming.md` should include Chapter 8 |
| Keep domain behavior on instances and avoid class names in instance methods as universal cross-language rules. | pp. 216-225 | source presents strong OO precepts; Developer correctly treats Ruby class shapes as contextual in `SOURCES.md` |

`responsibility-and-variation.md` accurately captures accepted variation,
wishful messages, dependency inversion, object-creation placement, and the
optional final stopping point. Its navigation paragraph is the first direct
fidelity repair candidate in the reference body: it omits the same-API exception
and understates the value of forwarding as an intermediate decoupling step. Its
claim that edge creation may remove an elaborate factory is plausible synthesis,
but it is not what this chapter's example demonstrates and should not be
attributed to Chapter 8 without qualification.

## Chapter 9: Reaping the Benefits of Design

**Read:** printed pages 226-268, PDF pages 240-282.

**Visual inspection:** PDF pages 243, 245, 252, 255-256, 260, 264-265,
268, 270, 273, 275, 277, and 281-282. This confirmed implementation-echo tests,
visibility-based unit choice, provisional test names, complete special-case
coverage, context-independent renaming, fake collaborator, redundant-range
removal, injected song limits, concise final suite, role verification, obsolete
default removal, and final design summary.

### Argument Reconstructed

The inherited `Bottles` tests still catch regressions, but their meaning has
changed as classes were extracted. What began as one class's unit tests has
become broad integration coverage that misstates present responsibilities. The
chapter distinguishes unit tests, which explain and localize one public
responsibility, from integration tests, which prove a chain of collaboration.
Both matter, but a broad green suite cannot substitute for an honest unit story.

The default is strongly biased toward testing every class's public API. The
exception is economic rather than ideological: a tiny, simple collaborator that
is invisible outside its enclosing public unit and used in no other context may
be exercised through that unit. Tests that merely repeat a one-line
implementation can constrain change without adding confirmable behavior. The
`BottleNumber` factory can still deserve a focused test because class selection
is its distinct responsibility even if individual tiny role players do not.

Tests are moved to `BottleVerse` using the same copy, retarget, and delete
refactoring used for production code. Once the tests belong to the right
responsibility, their names can explain the general rule and its boundaries.
Early vague names were acceptable when the domain was unknown; later knowledge
creates an obligation to improve the story. All actual special verses receive
examples, including 7 and 6, while one general upper/lower pair explains the
ordinary range.

Testing then exposes obsolete context. The class formerly named `Bottles` now
only coordinates a descending range and a verse-template role. Renaming it
`CountdownSong` reveals that the old default provider and 99/0 constants are no
longer justified by its responsibility. The rename follows the abstraction that
already emerged; it does not speculate beyond the code's present behavior.

`CountdownSong` tests initially remain coupled to bottle lyrics. A small
`VerseFake` preserves the verse-template role while removing irrelevant lyrical
context, making countdown behavior visible. Test-only code may reasonably use a
pattern name and class-side behavior that would be questionable in production,
because its local test-domain purpose is to communicate the role cheaply rather
than preserve broad production adaptability.

Once irrelevant context is removed, two range tests are visibly the same logical
claim despite using different examples. One is deleted. This differs from the
independent special-verse examples: those establish different domain behavior,
whereas repeated ranges exercise one already-owned responsibility without new
information. A missing public `verse` claim is then restored using the fake.

The remaining 304-line song test reveals hard-coded context in production. By
injecting the song's maximum and minimum, a short test can exercise a different
range and the class becomes reusable outside 99 bottles. Test difficulty is used
as design evidence rather than defeated with elaborate setup. Finally, role
tests check that both production and fake providers respond to the common API,
preventing a fake from continuing to pass after the production role changes.
The chapter presents a ceremony ladder: verify no more of the role than team and
runtime risk justify.

### Boundaries That Must Survive Derivation

- Green integration coverage can detect breakage while still lying about unit
  ownership, public responsibility, and present domain vocabulary.
- The source's default is an explicit unit test for each public class API, but
  cost, simplicity, visibility, and context can justify a larger enclosing unit.
- Coverage and test ownership are different questions. Code can be executed by
  a distant test while remaining poorly explained and hard to debug.
- A test that mirrors implementation is not automatically useful evidence.
  Confirmable responsibility, failure localization, and freedom to refactor
  matter.
- Initial test and code names may be provisional. Rename only after accumulated
  examples reveal a more stable responsibility or rule.
- Complete special-case examples and redundant repetitions are different.
  Preserve cases that add domain information; remove examples that repeat the
  same logical claim without added safety.
- A fake should preserve the collaborator role while deleting irrelevant
  context. It should not restate the production implementation or bypass the
  boundary under test.
- Test-only naming and structure may follow the test domain rather than
  production naming rules when that choice makes the role clearer and cheaper.
- Hard-to-write tests are design evidence, not proof that production must always
  be generalized. Here the awkwardness exposes already-emerged countdown
  responsibility and obsolete fixed limits.
- Role verification should match language and team risk. Verifying message
  existence is often enough; arity, types, and result contracts add ceremony.
- Style and data signals work only as shared conventions. Prime numbers or Ruby
  block delimiters are not universal verification rules.
- Removing obsolete defaults happens only after callers and tests explicitly
  provide the dependency. Context cleanup is a green migration, not a flag day.

### Developer Comparison

| Packaged claim or use | Source location | Decision |
| --- | --- | --- |
| Choose units to test by public responsibility and cost rather than mechanically mirroring every implementation class. | pp. 226-232 | directly supported, provided the source's strong default toward public-API unit tests remains visible |
| Use integration evidence for collaborations and focused unit evidence for stable public responsibilities. | pp. 226-232 | directly supported |
| Prefer tests that expose product meaning over tests that echo private implementation. | pp. 228-232, 244-256 | directly supported |
| Treat tests as reuse evidence and difficult setup as a coupling signal. | pp. 226-232, 241-256, 267-268 | directly supported |
| Use fakes to remove irrelevant context while preserving the collaborator role. | pp. 244-248 | directly supported |
| Delete or reorganize tests only when retained evidence still supports the same claim. | pp. 233-251 | directly supported |
| Distinguish informative independent examples from logically redundant repetition. | pp. 237-251 | directly supported; resolves the Chapter 2 pending distinction |
| Verify a polymorphic role shared by production and test doubles. | pp. 259-261 | directly supported; ceremony must match language and risk |
| Rename a unit when its current responsibility has outgrown the discovery context. | pp. 241-243 | directly supported |
| Remove obsolete defaults and fixed context after explicit callers exist. | pp. 252-263 | directly supported |
| Use prime-number test values as a universal signal of arbitrariness. | pp. 257-259 | contextual team convention; correctly not imported into Developer |
| `SOURCES.md` assigns Chapter 9 primarily to `verify`, with `sketch` as a secondary owner. | pp. 226-268 | supported: most work concerns evidence design, while test friction feeds responsibility and dependency redesign |

No contradiction was found in
`verifier-selection-and-pass-but-wrong.md`. Its claim-based unit selection,
fakes, role tests, integration boundary, obsolete-context warning, and
redundancy judgment preserve the chapter without importing Ruby-specific test
machinery. The phrase “do not require one test layer per class” is faithful only
when read with the surrounding cost and public-responsibility criteria; the book
retains a strong default toward explicit public-API unit evidence.

## Repair Closure

1. `SOURCES.md` now separates Chapter 1's concrete-baseline economics from
   Chapter 2's test and pass-but-wrong capability, and gives stable landings an
   explicit `signal`/implementation row.
2. `domain-naming.md` now traces Chapters 1, 2, 3, 4, 5, 6, 8, and 9 with printed
   page ranges, including implementation-shaped, receiver-context, and
   sender-oriented names.
3. Every Developer reference that cites this book now gives stable printed page
   ranges rather than only a broad chapter label.
4. `verifier-selection-and-pass-but-wrong.md` already distinguishes independent
   claim evidence from obsolete repetition; Chapter 9 confirmed that boundary.
5. `behavior-preserving-structural-change.md` retains explicit Developer
   ownership of route closure and rerouting. Its source trace now attributes only
   green mutation and stable-landing mechanics to the book.
6. `responsibility-and-variation.md` now defines Demeter pressure by API-boundary
   crossing, preserves same-API chains, recognizes forwarding as useful
   intermediate decoupling, and distinguishes moving creation from eliminating a
   factory.
7. `responsibility-and-variation.md` now preserves Chapter 9's strong default
   toward public-API unit evidence while retaining the small, simple, invisible
   collaborator exception.

No `reference-policy.json` change was required. Existing routes already select
these references from observable responsibility, naming, movement, timing, and
verification questions; the defects were in derivation detail and provenance,
not route membership or order.

## Final Fidelity Decision

**Decision:** faithful after repair for the capabilities Developer claims to
extract from *99 Bottles of OOP*, Second Edition, version 2.2.2.

The packaged material preserves the source's cumulative movement from concrete
examples through change pressure, horizontal refactoring, responsibility
extraction, role substitution, factory tradeoffs, dependency inversion,
context-independent tests, and role verification. It also preserves the main
qualifications: patterns are not destinations, openness has cost, temporary
bridges must disappear, green evidence is claim-relative, and tests or names can
pass while telling the wrong structural story.

Developer intentionally does not import Ruby class shapes, inheritance hooks,
prime-number signals, one factory style, or the book's strongest universal OO
rhetoric as cross-language mandates. Conversely, Developer's route lifecycle,
reference-load enforcement, evidence taxonomy, and explicit residual-risk model
are operational syntheses owned by this package rather than claims that the book
itself defines them.

The authorized PDF remains local audit evidence and is not included in the
package.
