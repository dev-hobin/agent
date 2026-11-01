---
type: regex
target: { source: file, path: REVIEW.md }
pattern: "\\[P[01]\\](?:(?!\\n\\s*\\n|\\n\\[P)[\\s\\S])*?(envelope|parseRows|empty (list|array|result|catalog)|\\[\\])"
flags: i
---
