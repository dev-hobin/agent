---
type: regex
target: { source: file, path: REVIEW.md }
pattern: "^\\[P[01]\\](?:(?!\\n\\[P\\d\\])[\\s\\S])*?(idempot|double|twice|duplicate)"
flags: im
---
