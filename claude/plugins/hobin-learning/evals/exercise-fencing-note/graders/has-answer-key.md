---
type: "regex"
target: { source: "file", path: "out/exercise.md" }
pattern: "^(#{1,6} [^\\n]*answer key|\\s*[-*]?\\s*\\**[^\\n:]{0,40}answer key[^\\n:]{0,20}\\**:)"
flags: "im"
---
