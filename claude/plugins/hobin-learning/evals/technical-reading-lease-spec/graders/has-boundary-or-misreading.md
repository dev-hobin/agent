---
type: "regex"
target: { source: "file", path: "out/insights.md" }
pattern: "^(#{1,6} [^\\n]*(boundary|misreading)|\\s*[-*]?\\s*\\**[^\\n:]{0,40}(boundary|misreading)[^\\n:]{0,20}\\**:)"
flags: "im"
---
