---
type: "regex"
target: { source: "file", path: "out/insights.md" }
pattern: "^(#{1,6} [^\\n]*(unresolved|open) question|\\s*[-*]?\\s*\\**[^\\n:]{0,40}(unresolved|open) question[^\\n:]{0,20}\\**:)"
flags: "im"
---
