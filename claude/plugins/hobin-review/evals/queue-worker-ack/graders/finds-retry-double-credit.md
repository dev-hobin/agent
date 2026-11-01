---
type: regex
target: { source: file, path: REVIEW.md }
pattern: "\\[P[01]\\](?:(?!\\n\\s*\\n|\\n\\[P)[\\s\\S])*?(idempot|double|twice|duplicate)"
flags: i
---
