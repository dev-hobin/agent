---
type: "regex"
target: { source: "file", path: "out/pattern.md" }
pattern: "^(#{1,6} [^\\n]*roles|\\s*[-*]?\\s*\\**[^\\n:]{0,40}roles[^\\n:]{0,20}\\**:)"
flags: "im"
---
