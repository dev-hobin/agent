---
type: "regex"
target: { source: "file", path: "out/exercise.md" }
pattern: "^(#{1,6} [^\\n]*target|\\s*[-*]?\\s*\\**[^\\n:]{0,40}target[^\\n:]{0,20}\\**:)"
flags: "im"
---
