---
type: "regex"
target: { source: "file", path: "out/concept.md" }
pattern: "^(#{1,6} [^\\n]*definition|\\s*[-*]?\\s*\\**[^\\n:]{0,40}definition[^\\n:]{0,20}\\**:)"
flags: "im"
---
