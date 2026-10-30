---
type: "regex"
target: { source: "file", path: "out/study.md" }
pattern: "^(#{1,6} [^\\n]*slice|\\s*[-*]?\\s*\\**[^\\n:]{0,40}slice[^\\n:]{0,20}\\**:)"
flags: "im"
---
