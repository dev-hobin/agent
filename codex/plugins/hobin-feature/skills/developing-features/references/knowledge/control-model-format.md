# Control Model Format And Checks

Read this when filling `assets/control-decisions.json` or reading what the scripts
print. The method behind each field is in [control-model.md](control-model.md).

```sh
node scripts/compile-control-model.mjs --gate [control-decisions.json] [--require]
node scripts/compile-control-model.mjs control-decisions.json [--canonical] > control-model.json
node scripts/check-control-model.mjs control-model.json [--strict] [--json]
node scripts/check-control-model.mjs --compare a.json b.json
node scripts/check-control-model.mjs --scenarios control-model.json
node scripts/check-control-model.mjs --canonical control-model.json
```

## Decision Record

`compile-control-model.mjs` turns a decision record into a control model. The
same record always compiles to the same model, whatever order it is written in.

| Field | Shape | Checked |
| --- | --- | --- |
| `facts` | `[{"code": "...", "evidence": "file:line", "symbol": "...", "answer": "variable" \| "input" \| "event" \| "excluded" \| "outside", ...}]` | every fact has evidence, a `symbol` (the code name or literal it is about, found on the cited lines as a whole token), and one answer. An `input` lists the conditions it stands for in `from`, each with its own evidence and symbol. `variable`, `input`, and `event` name their target in `as`. `excluded` needs `reason`: display, derived, owned, unbounded, or server. `outside` needs `as`: assumption, function, or wait. Every declared variable, input, and event rests on a fact |
| `variables` | `{"busy": "bool", "failure": ["none", "review"]}` | state the code owns; the states are their reachable combinations |
| `inputs` | same shape | data another owner keeps. A rule that reads an input splits that event into declared guards, one per combination of the inputs it reads |
| `initial` | `{"busy": false, ...}` | a value for every variable |
| `events.NAME` | `{"source": "...", "arrives": "expression", "evidence": "file:lines", "rules": [...]}` | `arrives`, read over variables, says when a result belongs to the current attempt. Outside it the cell is a dropped stale result. `evidence` cites the line that drops it |
| a rule | `{"when": "expression", "then": {"var": "expression"}, "evidence": "file:lines"}`, or `refuse`, `ignore`, or `question` in place of `then` | exactly one rule holds for each reachable combination. `then` values stay inside the variable's values. A rule that changes nothing is `ignore`, unless it says `restart: true`. `evidence` cites the lines the rule copies |
| `variants`, `assumptions`, `invariants` | as in the model | passed through. Invariants are written over variables |
| `findings` | `[{"id": "dead-end:...", "note": "..."}]` | every finding the check computes is acknowledged by id, and no other id is listed |
| `progress` | `{"when": "expression", "assuming": "K1"}` | `when` becomes the list of matching states |

States are named by their values (`busy=1,failure=none`). Refinement entries are
computed, and so is the `unreachable` entry (`by: "computed"`).

`--gate` is the pass/fail check for a record. Without a path it checks every
`control-decisions*.json` under the current directory. With none found it passes,
or fails under `--require`. It fails when:
- evidence does not resolve: the file or line is missing, or the symbol is not on the cited lines;
- a rule or an `arrives` has no evidence, or its cited lines mention none of the symbols of a variable it reads or writes;
- a cited line writes state (`this.x =`, `x.current =`, `setX(`) that no fact's symbol covers;
- the record does not compile;
- the compiled model has an error or a warning, or an invariant fails;
- a computed finding is not acknowledged, or an acknowledged one no longer occurs;
- compiling twice differs, or the canonical form is not stable.

A finding is a fact about the code, not a failure of the record. Acknowledging it
records that someone saw it.

The gate checks structure: that each citation exists and names what it points at.
A citation that exists but is read wrongly passes. Hidden tests and benchmarks
judge that.

## Events

`events` lists every event. `sources` says who controls each one:

| Source | Meaning |
| --- | --- |
| `control` | a control the code renders; the only kind that can be refused |
| `response` | the result of work the code started |
| `timer`, `lifecycle`, `external` | a timer firing, a mount or prop change, anything else from outside |

## States

| Field | Meaning |
| --- | --- |
| `terminal` | the flow ends here |
| `owns` | result events of the attempt this state starts. Outside an owner, those cells are filled with a stale-result `ignore`; writing one by hand is an error |
| `otherwise` | fills this state's empty cells. Only `ignore` or `forbid: assumption`, and never a `control` event |
| `recurrent` | the exit condition of a loop that is meant to repeat |

## Cells

Every state x event cell holds exactly one of these:

| Cell | Meaning |
| --- | --- |
| `{"to": "s"}` | transition. A self-transition in a state that owns an attempt says `reenter: true` (the work restarts) or `false` |
| `{"ignore": "why"}` | accepted, nothing changes: an enabled control whose handler returns early, or an outside event that is dropped |
| `{"forbid": "guarantee"}` | refused: the control is not offered here. `control` events only |
| `{"forbid": "assumption", "assumption": "K1"}` | the outside promises not to send it here. Needs an `arrival` assumption |
| `{"question": "D1: ..."}` | an owner decision; list it in the scenario file's `decisions` |
| `[{"guard": "g", ...cell}, ...]` | one branch per label of `guards.EVENT`, each label exactly once |

## Variables And Expressions

`variables` declares the code's deciding variables as `"bool"` or a list of
values. Expressions use variable names, literals (`true`, `false`, `"text"`,
integers), `==`, `!=`, `!`, `&&`, `||`, parentheses, and `in(state, ...)`.
`in` is true in the named states. It may appear only in invariants. A negation may follow `==` or `!=`
(`active == !in(idle)`). The checker tries every combination of
values; more than 100,000 combinations is an error.

| Field | Shape | Checked |
| --- | --- | --- |
| `guards.EVENT` | `{"label": "expression", ...}` | in each state with a guarded cell, every possible combination that maps to the state satisfies exactly one guard; a guard that never holds there is reported dead. A bare list of labels is compared but not checked |
| `refinement` | `[{"implementation": "code text", "when": "expression", "state": "s"}]` | every combination maps to exactly one state or is unreachable, never both; every reachable state has a combination |
| `unreachable` | `[{"when": "expression", "reason": "...", "by": "invariant", "invariant": "I2"}]` or `"by": "assumption", "assumption": "K3"` | combinations that cannot occur, and who makes them impossible (our invariant, or an `arrival` assumption) |

## Invariants, Assumptions, Progress

| Invariant form | Example | Checked |
| --- | --- | --- |
| `holds` | `"busy == in(working)"` | true in every reachable state, for every combination that maps to it |
| `refuses` | `{"event": "START", "when": "in(working) \|\| !ready"}` | the event is refused wherever `when` holds; with variables, for every combination that maps to the state, following the guard that holds |
| `step` | `{"event": "RESET", "from": "!in(unknown)", "to": "in(idle)"}` | every transition on the event (`"*"` for any) from a `from` state lands in a `to` state |
| text only | `{"text": "..."}` | warned as not checked |

`reliesOn` lists assumptions; an `unverified` one leaves the invariant not
established.

| Assumption `kind` | Meaning | Can back |
| --- | --- | --- |
| `arrival` | which events can arrive when | `forbid: assumption` cells, `unreachable` entries |
| `world` | a fact about hidden outside state | `reliesOn` |
| `eventual` | something will eventually arrive | `progress` entries |

`progress` entries name `states` and the `eventual` assumption they rest on
(`assuming`).

## Variants

`variants` declares mount-time modes:
`{"embedded": {"without": ["RESET"], "cells": {...}, "states": {...}, "initial": "s"}}`.
`without` removes events that cannot arrive in that mode. The other fields
overlay the base. Each variant is checked, compared, and turned into scenarios as
its own table. Invariants about a removed event are skipped in that variant.

## Not Supported

Superstates, regions, history, deferred events, choice states, and events the
chart raises for itself. The compiler produces flat tables; rules over variables
already cover what superstates and regions would save.

## What The Check Reports

Each variant is reported separately (`[name]`), and a finding id from a variant
other than base starts with `<variant>:`.

**Errors** mean the table or the record is broken:
- empty cells, unknown targets, malformed cells and guards;
- refusals of events the code cannot block, hand-written stale-result cells,
  self-transitions in an attempt owner without `reenter`, `otherwise` misuse;
- assumption kinds used in the wrong place;
- refinement and `unreachable` coverage, guard coverage and overlap, invariants
  that fail, and undeclared variables, values, or states in expressions.

**Findings** are facts about the code, each with a stable id:

| Id | Meaning |
| --- | --- |
| `dead-end:<state>` | a non-terminal state with no way out |
| `unreachable:<state>` | a state the initial state never reaches |
| `waiting:<state>` | every way out is a `response`, and there is no timer event or progress entry |
| `closed-group:<s1>\|<s2>` | a group of states that nothing leads out of |
| `never-changes:<event>` | an event that changes the state nowhere |
| `same-states:<s1>\|<s2>` | states that behave the same for every event |
| `same-events:<e1>\|<e2>` | events with the same cell in every state |
| `dead-guard:<state>.<event>[<label>]` | a guard that never holds in that state |
| `question:<state>.<event>` | an open owner question |
| `text-invariant:<id>` | an invariant written only as text, so it is not checked |
| `unverified:<invariant>:<assumption>` | an invariant that relies on an unverified assumption |

Expression and completeness checks run once the table has no errors.

Without `--strict` only errors fail. `--strict` also fails on warnings and findings.

`--compare` gives one of three verdicts:
- `equivalent`.
- `equivalent modulo guards`: a guarded event lacked the same labels in both models.
- `not equivalent`: the shortest distinguishing step is printed.

It compares each variant separately, pairing variants by the events they remove
when their names differ.

`--scenarios` prints `transitions` and `stays` scenarios per variant. It also
prints an `untested` list of assumption and question cells.

`--canonical` prints the behavior alone, in one form per behavior. It produces one
table per variant, keyed `base` or `without:EVENT,...`. In each table:
- Reachable states are minimized and numbered `S0`, `S1`, ... in breadth-first order.
- Guarded events are split into `EVENT[label]` letters.
- Events whose cells agree in every state are merged, with their names joined by `+`.
- Free text is dropped.

Two models are equivalent exactly when their canonical forms are identical, so a
plain diff compares them. Canonicalizing a canonical form returns it unchanged.
