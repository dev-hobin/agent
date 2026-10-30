---
type: "regex"
target: { source: "file", path: "out/pattern.md" }
pattern: "^(#{1,6} [^\\n]*transfer|\\s*[-*]?\\s*\\**[^\\n:]{0,40}transfer[^\\n:]{0,20}\\**:)"
flags: "im"
---
