---
type: "regex"
target: { source: "file", path: "PROPOSAL.md" }
pattern: "(```diff|^@@ |^\\+(?!\\+\\+ ))"
flags: "m"
---
