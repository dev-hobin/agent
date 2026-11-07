---
type: regex
target: { source: file, path: REVIEW.md }
pattern: "^\\[P[01]\\](?:(?!\\n\\[P\\d\\])[\\s\\S])*?\\b(ack|acknowledg)"
flags: im
---
