---
type: "regex"
target: { source: "file", path: "out/insights.md" }
pattern: "^(#{1,6} [^\\n]*insight|\\s*[-*]?\\s*\\**[^\\n:]{0,40}insight[^\\n:]{0,20}\\**:)"
flags: "im"
---
