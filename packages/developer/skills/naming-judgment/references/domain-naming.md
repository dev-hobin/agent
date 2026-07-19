# Domain Naming

Use this reference when an identifier is generic, implementation-shaped,
misleading, effect-hiding, or disputed across callers. This capability judges
the word and the sense readers may rely on; it does not redesign the surrounding
module or process.

## Narrow And Consistent

A useful name is both narrow and consistent:

- **narrow**: it excludes meanings and uses the value cannot support;
- **consistent**: it agrees with the local code, domain vocabulary, ecosystem
  conventions, documentation, and intended audience.

Narrow does not mean maximally specific. A name that exposes the current storage
format, library, widget, transport, or algorithm becomes false when that detail
changes. A name that says only `data`, `item`, `manager`, or `handler` may admit
uses the contract cannot support.

## Sign, Referent, And Sense

Separate:

```text
sign: the identifier text
referent: the current value, function, type, or implementation
sense: the stable properties readers understand and rely on
```

Judge the name around its sense. Complete this statement before proposing a
rename:

```text
<old> says <current sense>, but callers rely on <actual sense>.
The current referent is <implementation detail>, which should remain
hidden/exposed because <reason>.
```

If the relied-upon sense cannot be stated, the apparent naming problem may be a
missing product concept, invalid abstraction, or mixed responsibility.

## Names As Useful Indirection

A name creates a place where a reader may stop descending. It succeeds only when
the reader can use the named thing without reopening details that should be
hidden.

- a data name hides the current representation while exposing role or invariant;
- a function name hides a computation or effect while exposing its result or
  action;
- a module-qualified name supplies shared context;
- a public name forms vocabulary that future callers may depend on.

Indirection that only renames syntax adds lookup cost without reducing
conceptual burden. An inline expression can be more honest than a helper with no
stable sense.

## Data Names

Name data by domain interpretation, role, or invariant rather than by field
inventory. A parameter name cannot establish the invariant it implies; validation,
types, or construction must own that guarantee.

Short local names are appropriate when scope makes the arbitrary role obvious
and they match project conventions. Long names do not repair a missing boundary.

Absence needs an honest vocabulary. Distinguish missing, `undefined`, `null`,
empty, defaulted, legacy, and invalid values when callers rely on those
differences. Do not hide a product default in an adjective such as `effective`
unless its precedence and source are stable parts of the sense.

## Function Names And Effects

Identify whether the function primarily:

1. pulls data from another scope;
2. transforms data already in scope;
3. pushes data or an effect into another scope.

A pure transformation should name the domain result or conversion. A boundary
action should state its effect or destination. Mutation, I/O, caching, logging,
network calls, retries, and persistence must not hide behind a name that reads as
a pure calculation.

When a function truly combines phases, an honest composite name may be better
than a false pure name. Whether the phases should be split is a `sketch` or
`abstraction-review` question, not a rename performed here.

## Audience And Context

The same natural word can carry different senses in different contexts. Inspect
who must understand it:

- public and top-level names must work for newcomers and domain readers;
- local implementation names may rely on established nearby vocabulary;
- external conventions usually remain intact at adapters;
- synthetic terms improve precision only when their definition and learning cost
  are acceptable.

Module placement can supply context and shorten names, but this leaf may only
recommend a placement review. It must not invent a module solely to make a word
shorter or redesign module ownership under the label of naming.

## Responsibility-Derived Names

Choose names from what the unit knows, does, or promises, not from the conditional
or first special case that revealed it. Intermediate names may remain provisional
while horizontal movement exposes the real responsibility.

For a type or role, ask:

- which messages callers need to send;
- which knowledge the receiver owns;
- which change would belong inside it;
- which current mechanism callers should not learn.

A rich-sounding name does not make an extracted class or interface valid. Return
that candidate to `abstraction-review` when its responsibility is still disputed.

## Worked Review

Candidate:

```text
getEffectiveSchedule(formValues)
```

Caller inspection shows that the function performs no I/O, chooses no fallback,
and converts editable form values into a validated domain value. The word `get`
suggests a pull from another scope; `effective` suggests precedence or default
policy that does not exist; `Schedule` hides that the result is specifically
content used by the contract boundary.

```text
sign: getEffectiveSchedule
referent: pure mapper from ScheduleFormValues to ScheduleContent
relied-upon sense: validate and convert editable values into domain content
audience: feature callers and tests
reveal: conversion and target domain value
hide: current object literal and validation library
candidate: toScheduleContent
```

Check callers after the rename:

```text
toScheduleContent(values)       // reads as a pure conversion
saveScheduleContent(content)    // separately exposes the effect
```

If inspection instead reveals defaults selected from account settings, the
rename cannot erase that policy. Use an honest name such as
`resolveScheduleContent` only after the precedence contract is stated, or return
the mixed operation to `sketch`.

Second contrast:

```text
readCache(key)            // honest only if it observes cache state
cachedPrice(input)        // dishonest if it may call a network and write cache
loadAndCachePrice(input)  // honest composite while a split remains undecided
```

The result is a rename map plus preserved behavior checks, not a new module or
class design.

## Review Procedure

1. Read callers, callees, tests, and surrounding vocabulary.
2. Identify audience, current referent, and relied-upon sense.
3. Classify the failure: too broad, too specific, effect-hidden, verb mismatch,
   sense collision, false indirection, or responsibility leak.
4. State what the name should reveal and what it should hide.
5. Propose the smallest rename map and affected scope.
6. Identify checks and external conventions that must remain unchanged.
7. Defer boundary redesign instead of smuggling it into the rename.

## Failure Checks

Naming judgment is weak when:

- callers were not inspected;
- the word describes an algorithm rather than stable sense;
- a broad term admits unsupported uses;
- a pure-sounding verb hides effects or scope crossing;
- every intermediate value receives a name without gaining meaning;
- a rename disguises a model, responsibility, or abstraction problem;
- external vocabulary is changed without redesigning the adapter contract;
- module or process redesign is performed under naming authority.

## Source Trace

- Zachary Tellman, *Elements of Clojure*, 2019: the Names chapter on narrow and
  consistent names, sign/referent/sense, naming data, functions, and macros; the
  Indirection and Composition chapters inform effect and context boundaries but
  their architectural decisions are owned by `sketch` and
  `abstraction-review`.
- Sandi Metz, Katrina Owen, and TJ Stankus, *99 Bottles of OOP*, Second
  Edition, version 2.2.2, 2024: chapters 2, 4, 5, and 9 on exposing
  responsibilities, provisional names, deriving names from responsibilities,
  naming classes, and communicating with future readers.
