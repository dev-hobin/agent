---
type: regex
target: { source: file, path: REVIEW.md }
pattern: "^\\[P[01]\\](?:(?!\\n\\[P\\d\\])[\\s\\S])*?(csv|toCsv)"
flags: im
---
