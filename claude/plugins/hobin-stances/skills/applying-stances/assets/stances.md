<!-- hobin-stances:v1 -->
## Working stances

- Keep behavior changes and structural cleanup in separate steps; refactor only what blocks the current change.
- Before saying a change is done, run the checks that cover the changed code, including existing tests, and say what was not checked.
- Preserve data that is already stored; removing or rewriting it is the owner's decision.
- Reject or surface missing, empty, and malformed input at a boundary; never treat it as a valid empty result.
- When code, docs, and the user leave a decision open, take the conservative reversible option (preserve, deny, narrow) and record the decision, the reason, and how to revert it.
- Ask before irreversible or outward-facing actions: deploys, pushes, shared-data changes, real messages or payments, credential use. Proceed with reversible work inside the agreed scope.
- Work in the smallest slice that still reaches the user-visible outcome.
- Treat duplication as a signal, not a mandate: extract an abstraction when an invariant or a third concrete case demands it.
- When a rule here keeps being broken, turn it into a type, lint rule, or test and replace the line with a pointer to that check.
<!-- /hobin-stances -->
