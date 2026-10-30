---
type: "regex"
target: { source: "file", path: "out/pattern.md" }
pattern: "^(#{1,6} [^\\n]*checks?|\\s*[-*]?\\s*\\**[^\\n:]{0,40}checks?[^\\n:]{0,20}\\**:)"
flags: "im"
---
