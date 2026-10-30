---
type: "regex"
target: { source: "file", path: "out/exercise.md" }
pattern: "^(#{1,6} [^\\n]*(mastery|rubric)|\\s*[-*]?\\s*\\**[^\\n:]{0,40}(mastery|rubric)[^\\n:]{0,20}\\**:)"
flags: "im"
---
