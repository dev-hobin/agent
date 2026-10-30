---
type: "regex"
target: { source: "file", path: "out/pattern.md" }
pattern: "^(#{1,6} [^\\n]*axis|\\s*[-*]?\\s*\\**[^\\n:]{0,40}axis[^\\n:]{0,20}\\**:)"
flags: "im"
---
