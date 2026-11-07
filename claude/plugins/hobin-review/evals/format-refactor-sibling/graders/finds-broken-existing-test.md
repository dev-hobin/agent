---
type: regex
target: { source: file, path: REVIEW.md }
pattern: "^\\[P[01]\\](?:(?!\\n\\[P\\d\\])[\\s\\S])*?(machine-readable|existing test|format\\.test|1,234\\.50)"
flags: im
---
