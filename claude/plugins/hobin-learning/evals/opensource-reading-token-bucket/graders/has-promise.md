---
type: "regex"
target: { source: "file", path: "out/study.md" }
pattern: "^(#{1,6} [^\\n]*(promise|contract)|\\s*[-*]?\\s*\\**[^\\n:]{0,40}(promise|contract)[^\\n:]{0,20}\\**:)"
flags: "im"
---
