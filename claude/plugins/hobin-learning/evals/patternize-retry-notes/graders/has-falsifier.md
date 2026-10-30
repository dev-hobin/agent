---
type: "regex"
target: { source: "file", path: "out/pattern.md" }
pattern: "^(#{1,6} [^\\n]*(falsifier|evidence gap)|\\s*[-*]?\\s*\\**[^\\n:]{0,40}(falsifier|evidence gap)[^\\n:]{0,20}\\**:)"
flags: "im"
---
