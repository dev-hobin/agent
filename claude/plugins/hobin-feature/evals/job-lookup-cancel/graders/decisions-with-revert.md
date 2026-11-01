---
type: regex
target: { source: file, path: "REPORT.md" }
pattern: "decision[\\s\\S]*\\b(revert|undo|roll back|to change (it|this))"
flags: i
---
