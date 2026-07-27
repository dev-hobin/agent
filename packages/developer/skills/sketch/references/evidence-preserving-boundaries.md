# Evidence-Preserving Boundaries

Use this reference when less-trusted or less-structured input must become a domain
value whose type or abstract representation carries an accepted invariant. The
input may be bytes, JSON, form values, command-line arguments, database rows,
legacy records, framework payloads, foreign values, or an overly broad in-memory
type. Parsing here means any fallible transformation from a weaker
representation to a stronger one; it is not limited to text.

## Information Must Survive The Check

Two operations may perform the same runtime checks while establishing different
contracts:

```text
validate : Raw -> Result<Unit, BoundaryError>
parse    : Raw -> Result<Domain, BoundaryError>
```

`validate` reports only success or failure. Unless its result narrows the value
in a scope the compiler preserves, later code still receives `Raw` and must
repeat the check, trust a comment, or assert `Domain`. `parse` returns the more
precise value and makes the learned information necessary for execution.

Treat these as evidence-destroying by default:

```text
validate(raw); cast raw to Domain
JSON.decode(bytes) as Domain
lookup(key)! where absence has domain meaning
construct Domain through public raw fields
```

A type assertion, cast, non-null assertion, ignored conversion result, or typed
deserialization target is not evidence that an invariant holds.

## Preserve Prior Representation Evidence

Trust, provenance, and representation precision are separate facts. Input can be
external or less trusted while still having a specific structure established by
an earlier decoder, protocol, constructor, or type. Do not widen that structure
to a top type merely to check it again.

For representations ordered by the values they admit:

```text
Values(Domain) ⊆ Values(Raw) ⊆ Values(External)

establish : External -> Result<Raw, EstablishError>
parse     : Raw      -> Result<Domain, ParseError>
execute   : Domain   -> Effect<Result>
```

The input type of `parse` is the narrowest honest representation the caller can
already supply at that boundary. If an earlier transition established `Raw`,
accepting `External` instead discards evidence and repeats that transition. A
single operation may legitimately combine `establish` and `parse` when it owns
the actual external edge, but that does not justify exposing the broader type to
callers that already hold `Raw`.

Use a maximally broad input type only when the caller genuinely has no stronger
representation. Less trusted does not imply less typed, and parsing does not
require erasing information before refinement.

## Draw The Refinement Boundary

Derive this pipeline before choosing library syntax:

```text
external / raw / legacy representation
                |
                | parse / refine / smart constructor
                | failure is explicit here
                v
       invariant-carrying domain value
                |
                | total core operations
                v
             domain effects
```

Record:

```text
raw representation and provenance
accepted domain representation
invariant learned at the transition
parser or smart-constructor signature
success and failure result
single construction owner
first domain effect allowed after success
legacy, persistence, and re-entry paths
```

Push the proof burden toward the earliest boundary that has enough information,
but no further. Authorization or a small resource guard may precede expensive
parsing when abuse resistance requires it; those checks must not perform the
domain mutation that depends on parsed input. Parsing may use several passes or
select a later parser from an earlier discriminator as long as execution does
not consume partially parsed domain data.

## Choose A Stronger Representation

Prefer the most precise representation the current language and repository can
reasonably support:

- a product type when required fields must be present together;
- a sum type when cases have different meanings or fields;
- a non-empty, bounded, normalized, branded, opaque, or capability-bearing type
  when that restriction removes a real downstream branch;
- a map or set when uniqueness or duplicate policy is accepted;
- an abstract type with a smart constructor when the host type system cannot
  directly encode the invariant.

Do not call a narrower representation better until the excluded ability is known
to be unnecessary. The accepted domain comes from `model`; this route owns the
boundary that constructs it.

## Wished Interface

Use the target language's ordinary result and error conventions. The important
shape is that the parser accepts the representation already known at its caller
boundary and success carries the stronger result:

```text
parseNonEmpty : List<Item> -> Result<NonEmpty<Item>, EmptyInput>
process       : NonEmpty<Item> -> Effect<ProcessResult>

handle(items: List<Item>):
  nonEmpty <- parseNonEmpty(items)
  process(nonEmpty)
```

When no prior transition has established `List<Item>`, add or combine the actual
external decoding edge explicitly:

```text
decodeItems : External -> Result<List<Item>, DecodeError>
parseNonEmpty : List<Item> -> Result<NonEmpty<Item>, EmptyInput>
```

Throwing at an application edge, returning an option/either/result, or using a
checked constructor can all be valid. A predicate or assertion function can also
preserve information when the language genuinely narrows the checked value in
the only scope where it is consumed. What is not valid is checking one value and
then separately claiming a stronger type without a compiler-visible or
abstraction-visible connection. It is also not valid to erase a representation
already established for the caller and present the repeated structural check as
new domain evidence.

## Construction And Escape Audit

List every way `Domain` can enter the core:

| Path | Input provenance | Establishes invariant by | Produces | Bypass risk |
| --- | --- | --- | --- | --- |
| public parser | external raw value | complete boundary checks | `Domain` or failure | expected path |
| smart constructor | broad in-memory value | constructor checks | abstract `Domain` or failure | expected path |
| deserializer | persisted or wire value | parser plus compatibility policy | `Domain` or failure | unchecked typed decode |
| internal constructor | already refined fields | private construction law | `Domain` | public/raw export |
| test factory | test data | public or equivalent checked path | `Domain` | unrealistic invalid fixtures |

A claimed invariant is only as strong as its weakest construction path. Search
for raw constructors, object literals, reflection, ORM hydration, generated
adapters, test factories, casts, suppressions, and legacy re-entry points.

## Trusted Compiler Gaps

Sometimes a complete check establishes a fact that the host type system cannot
retain. Do not spread assertions to compensate. Isolate the smallest exception
inside the one parser or smart-constructor owner and record:

```text
exact assertion or unsafe operation
fact already established
complete check or trusted contract that established it
why ordinary narrowing cannot express the fact
containment boundary
falsifying test, type check, or structural inspection
```

Literal-preservation syntax and framework types already guaranteed by a runtime
schema are not the same as asserting hostile input into a domain type. The
burden is still on the exception to name its prior evidence. If that evidence is
missing, return to the parser design instead of documenting a wish.

## Shotgun And Effect Check

Reject a design when parsing or validation is mixed through processing code:

- consumers repeat checks for the same invariant;
- a late branch can discover malformed input after writes, sends, or mutations;
- every core function reserves an "impossible" failure despite an earlier check;
- compatibility adapters emit partially refined values;
- normalized and raw forms remain mutable and can drift apart.

Parse before the first domain effect. If staging or streaming makes one complete
up-front parse impractical, define an explicit phase or transaction boundary and
ensure each effect consumes a value whose required invariant is already carried
by that phase's representation.

## Artifact

```text
Raw representation and provenance:
Representation guarantee already established before this boundary:
Why the parser input is the narrowest honest caller contract:
Refined domain representation:
Invariant gained and ability lost:
Parser/smart-constructor signature:
Failure representation:
Construction owner and escape audit:
First domain effect after success:
Legacy/persistence/re-entry handling:
Trusted compiler gaps, or none:
Negative, bypass, and effect-order checks:
```

## Stop And Separation

Stop when every core construction path either produces the refined domain value
through the declared parser/constructor or fails explicitly, invalid input is
rejected before the domain effect that depends on it, no unchecked narrowing or
public raw constructor claims the invariant, and the parser input preserves every
representation guarantee established by prior boundaries.

Return to `model` when the admitted values or failure policy are disputed. Use
`representation-barrier` when alternate internal representations and public laws
are independently consequential, `type-transition` when an accepted domain
event transforms one valid domain type into another, and `contract-replacement`
when old and new boundary compatibility remains unsettled.

## Source Trace

- Alexis King, “Parse, don’t validate,” published November 5, 2019: the
  `NonEmpty` example, validation-versus-parsing return-type contrast, boundary
  parsing and shotgun-parsing discussion, practical duplicate-key example, and
  guidance on precise datatypes, proof placement, multi-pass parsing,
  denormalization, abstract datatypes, and bounded exceptions.
- The prior-representation evidence rule, construction-path audit,
  trusted-compiler-gap record, effect-order check, repository compatibility
  paths, and language-neutral assertion taxonomy are Developer adaptations of
  that source's type-driven design argument.
