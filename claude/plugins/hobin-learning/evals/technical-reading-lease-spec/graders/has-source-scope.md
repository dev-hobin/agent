---
type: "regex"
target: { source: "file", path: "out/insights.md" }
pattern: "^(#{1,6} [^\\n]*scope|\\s*[-*]?\\s*\\**[^\\n:]{0,40}scope[^\\n:]{0,20}\\**:)"
flags: "im"
---
