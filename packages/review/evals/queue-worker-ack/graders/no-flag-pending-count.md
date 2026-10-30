---
type: regex
target: { source: file, path: REVIEW.md }
pattern: "\\[P[01]\\][^\\n]*pendingCount"
match: not_contains
---
