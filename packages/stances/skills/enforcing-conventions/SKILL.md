---
name: enforcing-conventions
description: "Turns a coding convention that keeps being violated into the cheapest automatic enforcement that catches it — a type, construction boundary, lint rule, test, or hook — with an error message that tells the reader how to fix it. Use when a convention or agent-instruction rule keeps being broken, or a stance needs an automatic check. Not for choosing a style guide or fixing a one-off violation."
metadata:
  version: "0.3.0"
---

# Enforcing Conventions

Move a rule that people and agents keep breaking out of prose and into a check that
fails with the fix in its message.

## Gotchas

- Longer instructions do not stop repeat violations; a failing check does. Once the
  check exists, replace the prose rule with a one-line pointer to it.
- A check that ordinary code can bypass is not enforcement. Casts, raw constructors,
  ORM hydration, deserialization, and test factories are the usual side doors.
- An error message that only names the violation gets worked around. State the rule,
  why it exists, and the exact replacement to use.
- Adding a rule while existing violations remain turns the check red, and red checks
  get disabled. Fix or explicitly baseline existing violations in the same change.

## Procedure

1. **State the mapping**: "this code shape tells this audience this intent". Find one
   compliant and one violating example in the codebase.
2. **List every path** that can create or change the governed value or effect,
   including the side doors above.
3. **Choose the weakest strength that catches the violation on every path**, stronger
   when a violation is costly, remote, or irreversible:

   | Strength | Examples | Catches |
   | --- | --- | --- |
   | Signal | name, comment, module placement | nothing; it only informs |
   | Localize | one module owns the operation | violations outside that module, by review |
   | Static check | type, lint rule, scripted grep in the check command | violations at build or CI time |
   | Restricted construction | branded or opaque type, private constructor, parser that returns the refined type | invalid values everywhere downstream |
   | Runtime rejection | assertion or validation at the boundary | invalid input at run time |
   | Exclusive ownership | one service or table constraint performs the effect | concurrent or remote violations |

4. **Implement with the project's existing tools** (its linter, type system, test
   runner, CI or pre-commit hooks). Write the message as: rule, reason, replacement.
5. **Handle existing violations**: fix them, or record an explicit baseline the check
   reads, in the same change.
6. **Prove it**: a violating sample fails with the message, a compliant sample passes,
   and the check runs in the project's standard check command.
7. **Update the instructions**: if the rule came from `AGENTS.md`, `CLAUDE.md`, or a
   contributing guide, replace its prose with a pointer to the check.

## Sources

OpenAI, "Harness engineering" (custom lints whose error messages carry remediation;
promoting rules into code). Alexis King, "Parse, don't validate" (2019). This
repository's `convention-judgment` Skill and its `enforcement-strength` reference
(0.2.2).
