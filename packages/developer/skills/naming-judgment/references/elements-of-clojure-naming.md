# Elements Of Clojure Naming Notes

These notes adapt naming ideas from Zachary Tellman's *Elements of Clojure*
(2019), especially the `Names` chapter and the beginning of `Indirection`. Use
them as judgment prompts, not hard rules.

## Core Observations

- Names are a common form of indirection. A name lets a reader stop at what the
  code means without reading how it works.
- A name has a textual sign, a current referent, and a sense. In software, the
  sense matters most because the referent can change while callers keep relying
  on the same idea.
- Narrow does not mean maximally specific. A too-general name hides necessary
  properties; a too-specific name exposes implementation details that should be
  free to change.
- Consistency is contextual. A name is understood through local code, domain
  language, ecosystem conventions, documentation, and conversation.
- Natural names help readers reason by analogy but carry multiple senses.
  Synthetic names can be precise for experts but create a cliff for new readers.
- A name can be valid in one audience or namespace and misleading in another.
  Reusing a natural word across different product contexts requires active
  boundary management.

## Data Names

- Data names should communicate the invariant or role readers can rely on, not
  every structural detail.
- A function parameter only controls the sign; the caller controls the value. If
  the name assumes an invariant, enforce it at the boundary where outside data
  enters.
- A local binding name should let the reader skip the right-hand expression. If
  the name does not improve skimming, prefer direct composition or keep the
  expression inline.
- Avoid naming every intermediate value. Introduce a name when it adds a stable
  concept or removes real cognitive load.
- Collection and map shape can help when it distinguishes real cases. Prefer
  local project conventions over imported notation.

## Function Names

- Functions pull data into scope, transform data already in scope, push data into
  another scope, or combine those actions.
- A function that crosses a data-scope boundary should usually have a verb.
- A pure transform can often be named by its result, property, or conversion
  rather than a generic verb.
- A function that both pushes and returns data should make the combined behavior
  explicit or be split.
- Namespace/module context can narrow function names. If every function operates
  on the same domain object or data scope, the repeated noun can often move to
  the module boundary.

## Indirection And Modules

- Indirection separates what from how and gives permission not to inspect deeper
  layers.
- A software module can be viewed as model, interface, and environment. Names
  live on the interface side: they describe what the model is and what it is
  expected to become.
- An abstraction is useful only in an environment. A name that is internally tidy
  but wrong for the product context is not a good name.
- Every model omits facets of the environment; the omissions become assumptions.
  Names should not quietly turn fragile assumptions into permanent facts.

## Practical Review Prompts

- What does this name let a reader safely ignore?
- Which property must remain true if the implementation changes?
- Is the name too close to the current implementation, storage, UI widget, or
  library?
- Is the name too broad to exclude invalid uses?
- Is a natural word carrying different senses in different parts of the system?
- Would a shorter name become clear if this code moved into a better module?
- Is the name hiding a side effect, external boundary, or mutation?
