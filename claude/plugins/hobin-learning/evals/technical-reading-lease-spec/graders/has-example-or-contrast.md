---
type: "regex"
target: { source: "file", path: "out/insights.md" }
pattern: "^(#{1,6} [^\\n]*(example|contrast)|\\s*[-*]?\\s*\\**[^\\n:]{0,40}(example|contrast)[^\\n:]{0,20}\\**:)"
flags: "im"
---
