---
type: "regex"
target: { source: "file", path: "out/study.md" }
pattern: "^(#{1,6} [^\\n]*(invariant|trade-?off)|\\s*[-*]?\\s*\\**[^\\n:]{0,40}(invariant|trade-?off)[^\\n:]{0,20}\\**:)"
flags: "im"
---
