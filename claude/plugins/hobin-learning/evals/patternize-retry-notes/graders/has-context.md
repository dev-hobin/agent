---
type: "regex"
target: { source: "file", path: "out/pattern.md" }
pattern: "^(#{1,6} [^\\n]*(context|signals)|\\s*[-*]?\\s*\\**[^\\n:]{0,40}(context|signals)[^\\n:]{0,20}\\**:)"
flags: "im"
---
