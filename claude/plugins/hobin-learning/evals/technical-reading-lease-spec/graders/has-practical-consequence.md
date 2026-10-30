---
type: "regex"
target: { source: "file", path: "out/insights.md" }
pattern: "^(#{1,6} [^\\n]*consequence|\\s*[-*]?\\s*\\**[^\\n:]{0,40}consequence[^\\n:]{0,20}\\**:)"
flags: "im"
---
