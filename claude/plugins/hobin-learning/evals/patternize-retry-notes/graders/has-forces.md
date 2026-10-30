---
type: "regex"
target: { source: "file", path: "out/pattern.md" }
pattern: "^(#{1,6} [^\\n]*forces|\\s*[-*]?\\s*\\**[^\\n:]{0,40}forces[^\\n:]{0,20}\\**:)"
flags: "im"
---
