# Relational Constraint Models

Use this reference when correctness concerns possible combinations of entities,
intervals, records, or facts rather than one directional computation. It is
self-contained and does not require another modeling reference.

## Accepted Modeling Context

Supply the bounded question, admitted entity and value domains, identity and
equality facts, known valid and invalid combinations, environmental assumptions,
and the runtime observers that make the relation consequential. Unknown policy
remains explicit.

This member contributes quantified constraints, multiplicity and endpoint
semantics, contradiction behavior, runtime translation risks, guarantee owners,
and verification targets.

## Relation Before Procedure

State the admitted domains and relationship without choosing an execution
direction:

```text
Employee(id)
Department(id)
Management(employeeId, departmentId, start, end?)

all m in Management:
  exists Employee(m.employeeId)
  exists Department(m.departmentId)
  m.end is absent || m.start < m.end
```

Classify each predicate:

- **decision** may vary across valid instances;
- **property** must hold for every admitted instance;
- **assumption** limits the instances for which the property is claimed.

A relation can receive information from several directions. Use a propagation
network only when bidirectional assertion, retraction, provenance, and conflict
behavior are real requirements. A normal function is clearer when direction is
fixed.

## Quantified Integrity

For uniqueness, overlap, containment, or reachability rules, state:

```text
quantified domains
identity and equality
interval endpoint convention
existence requirements
allowed empty instances
conflict or contradiction result
```

A checker can prove consequences of the encoded relation but cannot tell whether
the domain omitted a real entity, event, or exception.

## Runtime Translation Boundary

Mathematical relations and storage/query semantics differ. When translating to a
database or collection runtime, verify:

- closed, open, or half-open endpoint behavior;
- `NULL`, missing, and three-valued logic;
- set versus bag multiplicity;
- row identity and duplicate joins;
- every create/update/delete path that can violate the rule;
- transaction or locking scope for cross-row invariants.

A half-open interval is not SQL `BETWEEN`. A correct query does not enforce a
constraint on mutation paths it never observes.

## Worked Shape

Requirement: a department has at most one active manager at any instant.

```text
all a, b in Management where a != b
  && a.departmentId == b.departmentId:
    intervalsDoNotOverlap(a, b)
```

Exercise historical, current, future, open-ended, touching-boundary, overlapping,
and missing-reference instances. The enforcement owner may be an exclusion
constraint, serialized transaction, or application rule with locking; select it
only after the relation is accepted.

## Artifact

```text
Domains and relations:
Decisions / properties / assumptions:
Quantified constraints:
Identity, equality, multiplicity, and endpoint conventions:
Known valid and invalid instances:
Runtime translation risks:
Contradiction behavior:
Guarantee owner and verification target:
```

## Stop And Separation

Stop when known valid and invalid instances differ for the stated reason and the
runtime translation obligations are explicit.

Hand off to `temporal-behavior-models` when histories rather than static instances
carry meaning, to `solver-result-boundaries` when bounded exhaustive status is
the claim, and to `sketch` when an enforcement surface must be designed.

## Source Trace

- Hillel Wayne, *Logic for Programmers*, v0.14.0:
  Chapter 7, pp. 73-88, for relational integrity and SQL/model translation.
  The recorded half-open/`BETWEEN` defect is excluded.
- Harold Abelson and Gerald Jay Sussman with Julie Sussman, *Structure and
  Interpretation of Computer Programs*, Second Edition:
  Section 3.3.5
  for multi-directional constraint propagation, informants, retraction, and
  contradiction.
