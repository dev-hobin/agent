---
type: "regex"
target: { source: "file", path: "out/study.md" }
pattern: "^(#{1,6} [^\\n]*(next (slice|move)|handoff)|\\s*[-*]?\\s*\\**[^\\n:]{0,40}(next (slice|move)|handoff)[^\\n:]{0,20}\\**:)"
flags: "im"
---
