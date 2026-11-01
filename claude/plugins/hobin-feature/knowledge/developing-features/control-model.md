# Control Model

Read this when the actions a user or system may take depend on a mode: an
external job is created and polled, a request can be retried, rechecked, or
cancelled, a late result can arrive, or two or more flags and nullable values
together enable or block an action. If nothing depends on order, a decision
table in [condition-modeling.md](condition-modeling.md) is enough.

Decide what belongs in the statechart before drawing it. Judgment belongs at
the two boundary questions and in cells that need an owner decision.

Write a decision record (`assets/control-decisions.json`), not the table. It
holds only what reading the code, or the requirement, can decide:
- each code fact with its evidence;
- a closed answer for each fact;
- the rules that copy what the code does.

`scripts/compile-control-model.mjs` computes the states, the table, and the
canonical form from it, so the same record always gives the same model. Model
output varies from run to run; a record that is kept and compiled does not. The
JSON fields and every check are in
[control-model-format.md](control-model-format.md).

## 1. Keep Out What The Code Does Not Control

| Question | If yes |
| --- | --- |
| Does something the code does not control decide it (another system's job, a provider, elapsed time)? | Not a state. Bring in only what the code actually receives (a response, a timer firing, a prop change) as events. Write the outside behavior as an assumption |
| Does a local value mirror outside state? | It is the last observation, not the truth. It cannot establish an invariant about the outside. After a start or an interruption (remount, target change), enter a "not yet observed" state rather than reusing the last observation. If a decision depends on freshness, add a timer event instead of a guard on a timestamp |
| Is it a computation from input to output (parse, validate, map)? | A function. The chart says only when it runs and where each result goes |
| Is it a person deciding? | Model the wait and the controls the person can use, not the person |

Record each item in `outside`. Declare who controls each event in `sources`.
Only a control the code renders can be refused. A mount-time mode in which some
events cannot arrive (the component embedded with a fixed target, say) is part
of the boundary too: declare it as a variant named after the prop or condition
that selects it.

Name events so that the table carries the outside's outcomes, not guards. Start
from the raw outcomes the code distinguishes (statuses, error codes). Give two of
them one event only when they lead to the same cell in every state; otherwise
give each its own event. Keep guards for conditions on the code's own data.

## 2. Keep Out What Must Not Be Control State

| Question | If yes |
| --- | --- |
| Does every event behave the same whatever this value is? | Data, not a state. Different behavior for the same event means a different state; the same behavior means the same state |
| Is it computed from other values? | Derive it; do not store it |
| Does another owner already keep it (server cache, URL, form library, store)? | Leave it there. A copy creates two sources of truth. Use the project's ownership rules when it has them |
| Is its range unbounded (ids, timestamps, lists)? | Keep it as data attached to a state. Control states must stay finite so the table closes and two models can be compared |
| Must it survive a reload, navigation, or another user? | The server owns it. The client chart only observes it |

Ask the ownership question before the behavior question. A value another owner
keeps (a query's fetch status, a parent's prop) stays data even when events
behave differently with it; the difference goes into a guard.

Record each item in `excluded` with its reason and owner. These questions keep
the inside checkable.

## 3. Fix The Semantics And The Attempts

Write these into `semantics`:
- one event is handled before the next;
- what leaving a state does to work it started;
- how a result of an ended attempt is recognized;
- that two enabled transitions for one state and event are an error, not resolved by order.

A result event means the outcome of the current attempt only. Give each one
`arrives`: the combination in which its attempt is running (`busy`). When one run
awaits several steps in turn (send, then reload), each step's results arrive only
in that step. A result outside `arrives` is not an event of the chart: the
compiler drops it, so never write a "superseded attempt" rule. Name the runtime's
mechanism: a stopped XState
v5 actor delivers no result; hand-written async UI code needs an `AbortController`
per attempt and an attempt check before writing state. Aborting a request does
not stop work the server already accepted.

## 4. Write The Decision Record

1. List the code facts, each with `file:line`:
   - each piece of state and each ref;
   - the props and queries the code reads;
   - each handler wired to a control;
   - each outcome of each awaited call;
   - each effect and timer.
   Designing new behavior instead, list the requirement's facts and cite the
   requirement.
2. Answer each fact. Ask in this order; the first yes decides:

   | Question | Answer |
   | --- | --- |
   | Does another owner keep it (a prop, a query's status, the browser), and does it only decide what is accepted? | `input` |
   | Does the code react to it (a control's handler, a call's outcome, a timer, unmount)? | `event` |
   | Is it outside: another system's behavior, a computation, a person deciding? | `outside`, as an assumption, a function, or a wait |
   | Is it only shown, derived, kept elsewhere without deciding anything, unbounded, or owned by the server? | `excluded`, with that reason |
   | Otherwise: state the code owns that decides what is accepted | `variable`, abstracted to a few values |

3. Give each variable its initial value. For each event, write rules that copy
   its handler, each citing the lines it copies in `evidence`; those lines mention
   every variable the rule reads or writes:
   - `then` lists the assignments the code makes; a variable not assigned keeps its value;
   - `arrives` says when a result can belong to the current attempt;
   - `refuse` covers a disabled or absent control;
   - `ignore` covers an enabled control whose handler returns early.

   Exactly one rule must hold for each reachable combination. The compiler
   reports a gap or an overlap with the combination that shows it.
4. Merge two raw outcomes into one event only when they lead to the same cell in
   every state. The check warns when they do.
5. Before changing existing code, make the record pass the gate for the code as it
   is and take a baseline (`--baseline`). Change the code and the record together.
   Every cell whose behavior differs from the baseline needs an acceptance scenario
   that names it in `covers` and passes; `--changes` lists them. A wrong reading of
   the old code shows up as a failing scenario on the code it describes.
6. Compile, check, derive scenarios, and compare canonical forms (section 7).

For existing code, copy what it does, including what looks wrong. Put
disagreements in `findings`, and use `question` only for behavior an owner has
to decide.

Guards on data are where state machines decay. When a rule tests what happened
earlier, that history belongs in a variable. Superstates and regions are not
needed here: one rule that covers several combinations does what a superstate's
shared transition does, and the compiler computes the combinations that regions
would spare writing. History pseudostates, deferred events, and events the chart
raises for itself are not supported.

## 5. Assumptions, Invariants, Progress

An assumption is something the outside is trusted to do. Say whether it is about
which events arrive when, about hidden outside state, or that something will
eventually arrive. An invariant must hold initially and after every transition.
Write it so the checker can evaluate it; keep text only for rules the table
cannot express. An invariant that relies on an unverified assumption is not
established. Treat that assumption as an owner question. Until it is verified,
take the conservative default: reject, preserve, narrow.

Progress is separate from safety. A state whose every way out is the result of
work the code started needs a timer event, or an `eventual` assumption that says
what ends the wait. A state a person or a lifecycle event leaves is resting, not
waiting.

## 6. Keep The Record; Do Not Regenerate It

Abstracting a value into a few cases (an error message becomes
`failure: none | other | review`) is a claim that no behavior depends on the
detail it drops. Write that claim into the fact's answer.

A decision record is kept, not rewritten. On a later run:
- check that each fact's evidence still matches the code;
- add facts for code the record lacks;
- change an answer or a rule only where the cited code changed, and say so in `findings`.

A run on unchanged code changes nothing. A difference between two records is a
difference in specific answers, and each one is a question for the owner.

## 7. Check, Scenarios, Comparison

An unreachable or dead-end state is a finding about the code, not a modeling
error. The other checks still run with it. Never mark a state terminal or change
a cell to make one go away; record it.

A clean `--strict` check means every table, one per variant, is closed and
consistent with its expressions. It does not prove that the code matches the
model, and a model and code that share one misreading of the requirement agree
with each other. Two things connect them to the truth: scenarios that run the
changed cells against the code, and an independent reader who writes down from
the requirement alone what each changed cell should do and compares. The
scenarios connect model and code:
- one per leaf of a breadth-first tree of transitions, asserting the state after every step;
- one per state that sends every event the state must not react to, late results included;
- for refusals, an assertion that the control is not offered, and that forcing the event changes nothing.

Assumption cells are not tests; verify the assumptions. Question cells are owner
decisions.

`--compare` tells whether two models of the same boundary behave the same up to
state names. Behavior means what the table makes observable: which controls are
offered, terminal states, events assumed absent, and open questions. States that
differ only in what they display compare equal. Two models that disagree point to
an unclear boundary or requirement.

## Sources

Checked against the source text:
- Pamela Zave and Michael Jackson, "Four Dark Corners of Requirements Engineering," ACM TOSEM 6(1), 1997: environment- vs machine-controlled phenomena; the machine's model of the environment as an imperfect copy (§3.3).
- Michael Jackson, problem frames and JSD papers: a model and the real world share no phenomena; the event list as a filter.
- David Harel, "Statecharts: A Visual Formalism for Complex Systems," Science of Computer Programming 8, 1987: statecharts describe "the control part of the system"; depth and orthogonality translate into ordinary automata, while events the chart raises itself are the hard part.
- W3C SCXML Recommendation, 2015: an unmatched event "is discarded" (§3.1.2); the most deeply nested state is consulted first (§3.1.2, §3.13); invocations cancelled on exit, and events from a cancelled session ignored (§6.4.3).
- OMG UML 2.5.1, 2017, §14: an event with no enabled transition is discarded (§14.2.3.9.1); internal vs external self-transitions (§14.2.3.8.1); redefinition of an extended state machine (§14.3.3); an unexpected trigger in a protocol state machine is a pre-condition violation (§14.4.3.2.1).
- Stately documentation: XState v5 actors; "Different behavior = different state" (finite-states); Matt Pocock, "Should this be a state, or in context?", 2021-04-29: states "gate events"; "Thinking in state machines": "A blocking `await` on a person is a wait, not work."
- Miro Samek, *Practical UML Statecharts in C/C++*, 2nd ed., 2008: the design procedure of §2.4 (primary use case, consolidated events); guards as "the primary mechanism of architectural decay" (p. 65); history kept as a data member (§5.5).
- C.A.R. Hoare, *Communicating Sequential Processes*, 1985 (2015 electronic edition): refusals and failures (§3.4, §3.9).
- R.J. van Glabbeek, "The Linear Time – Branching Time Spectrum," CONCUR '90, and "Spectrum I," Handbook of Process Algebra, 2001: a refused button "will not go down" (§10); on deterministic processes the semantics coincide (§16, Theorem 6).
- Nancy Lynch and Mark Tuttle, "An Introduction to Input/Output Automata," MIT report, 1988: inputs cannot be blocked; CSP blocking serves "blocking the activity of the environment" and "eliminating undesirable inputs".
- Matthew Hennessy and Huimin Lin, "Symbolic Bisimulations," Sussex report 1/92: guards matched by case split; undecidable for rich guards.
- Constance Heitmeyer, Ralph Jeffords, Bruce Labaw, "Automated Consistency Checking of Requirements Specifications," ACM TOSEM 5(3), 1996: coverage and disjointness checks; a partial transition function because not all input events can occur in a given state. Heitmeyer, J.UCS 13(5), 2007: a set of initial states.
- Mats Heimdahl and Nancy Leveson, "Completeness and Consistency in Hierarchical State-Based Requirements," IEEE TSE 22(6), 1996 (scanned journal text): robustness rules, including a timeout in every waiting state. Nancy Leveson, "Completeness in Formal Specification Language Design for Process-Control Systems," FMSP 2000: an unknown state after an interruption, inputs that are never used, recurrent behavior bounded by an exit condition. (Retrieved by retrying an archived copy with a browser user-agent after a bot-block page.)
- Alan Wassyng and Mark Lawford, FME 2003, and Lawford, Froebel and Moum, 2001 manuscript: tabular specifications in practice, with explicit "No Change" rows; an undocumented assumption exposed by a disjointness check.
- Martín Abadi and Leslie Lamport, "Conjoining Specifications," ACM TOPLAS, 1995 (assumption/guarantee); "The Existence of Refinement Mappings," TCS, 1991; Lamport, *Specifying Systems*, 2002 (Init ⇒ Inv, Inv ∧ [Next] ⇒ Inv′).
- Bowen Alpern and Fred B. Schneider, "Defining Liveness," IPL, 1985.
- Daniel Jackson, "Alloy: A Language and Tool for Exploring Software Designs," CACM draft, 2019: the small scope hypothesis, which here applies only to abstracting data into small domains.
- Tsun S. Chow, "Testing Software Design Modeled by Finite-State Machines," IEEE TSE, 1978: branch cover misses transfer errors. David Lee and Mihalis Yannakakis, "Conformance Testing" (author copy): a status read at each visited state makes a covering path a complete check.
- Jan Tretmans, "Test Generation with Inputs, Outputs, and Quiescence" (author copy): non-acceptance is implemented by accepting and then signalling it; observing "nothing happened" needs a timeout.
- React documentation, "Choosing the State Structure" (avoid redundant and duplicated state).

Read from scanned pages:
- David Harel and Amir Pnueli, "On the Development of Reactive Systems," 1985 (reactive vs transformational).
- David Harel and Michal Politi, *Modeling Reactive Systems with Statecharts*, 1998: basic activities by "other means";.
- Harel and Naamad, "The STATEMATE Semantics of Statecharts," 1996: events live one step.

Seen only through other sources: Parnas and Madey, "Functional Documents for Computer Systems," 1995 (monitored and controlled variables, through Heitmeyer); de Alfaro and Henzinger, "Interface Automata," 2001 (unaccepted inputs as environment assumptions); Horrocks, *Constructing the User Interface with Statecharts*, 1999 (no step here rests on it).

Our own construction, not any source's method:
- the second boundary as a category;
- the two boundaries as the only judgment points;
- the cell kinds and the `sources` rule;
- attempts with automatic stale cells;
- variants as `without` overlays;
- the expression format, the three invariant forms, and assumption kinds;
- the event-merging rule;
- the decision record, its closed answers, and states computed from variables;
- `--compare` as a reproducibility check.

The method was first exercised on a synthetic external job lookup
(`tests/fixtures/control-model/`) and on a four-agent reproducibility run.
