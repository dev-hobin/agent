---
type: "regex"
target: { source: "file", path: "out/insights.md" }
pattern: "^(#{1,6} [^\\n]*evidence|\\s*[-*]?\\s*\\**[^\\n:]{0,40}evidence[^\\n:]{0,20}\\**:)"
flags: "im"
---
