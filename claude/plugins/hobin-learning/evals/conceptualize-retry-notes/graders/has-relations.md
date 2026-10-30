---
type: "regex"
target: { source: "file", path: "out/concept.md" }
pattern: "^(#{1,6} [^\\n]*(related|relation|connector)|\\s*[-*]?\\s*\\**[^\\n:]{0,40}(related|relation|connector)[^\\n:]{0,20}\\**:)"
flags: "im"
---
