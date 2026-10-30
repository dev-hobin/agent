---
name: commit-message-control
description: >-
  General guidance for writing commit messages. Length-matched control for
  the commit-message skill: same size, no skill-specific rules.
---

# Writing commit messages

A good commit message helps the next reader understand the history of the
project without opening every diff. Keep these general points in mind.

## Guidance

1. Look at the changes before writing anything, and make sure you understand
   what the commit contains.
2. Start with a short summary line that tells the reader what changed in
   plain, direct language.
3. Keep the summary focused on one idea. If the commit does several unrelated
   things, consider whether it should be split.
4. After a blank line, add a body when the summary alone is not enough.
   Describe the motivation and any context a reviewer would need.
5. Mention anything that might surprise people who depend on this code.
6. Prefer clear words over jargon, and avoid vague summaries such as
   "update" or "misc".
7. Present the message cleanly so it can be pasted directly into git.
