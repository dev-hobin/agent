---
type: regex
target: { source: file, path: REVIEW.md }
pattern: "^\\[P[01]\\](?:(?!\\n\\[P\\d\\])[\\s\\S])*?(envelope|parseRows|empty (list|array|result|catalog)|\\[\\])"
flags: im
---
