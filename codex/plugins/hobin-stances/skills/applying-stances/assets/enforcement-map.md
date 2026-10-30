# Where each stance can be checked

Look for these in the project before linking a stance. Link only checks that exist.

| Stance | Checks that can enforce it |
| --- | --- |
| Separate behavior and cleanup | Pull request template or review checklist; commit message convention check |
| Run covering checks before done | CI that runs the full test suite on every change; a pre-push hook running the test command |
| Preserve stored data | Migration review rule or lint that flags dropped columns and destructive updates; database constraints; tests on migrations |
| Reject unclear boundary input | Parser or schema types at the boundary; tests for missing, empty, and malformed responses |
| Conservative open decisions | Decision log or feature document template with decision, reason, revert fields |
| Ask before irreversible actions | Host permission rules that require approval for deploy, push, and database commands; protected branches |
| Smallest slice | None automatic; review |
| Duplication as signal | None automatic; review |
| Promote broken rules | The project's lint and type configuration |
