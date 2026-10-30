---
type: "regex"
target: { source: "file", path: "out/concept.md" }
pattern: "^(#{1,6} [^\\n]*mechanism|\\s*[-*]?\\s*\\**[^\\n:]{0,40}mechanism[^\\n:]{0,20}\\**:)"
flags: "im"
---
