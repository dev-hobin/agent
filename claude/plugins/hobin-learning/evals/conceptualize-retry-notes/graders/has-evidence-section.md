---
type: "regex"
target: { source: "file", path: "out/concept.md" }
pattern: "^(#{1,6} [^\\n]*(evidence|provenance)|\\s*[-*]?\\s*\\**[^\\n:]{0,40}(evidence|provenance)[^\\n:]{0,20}\\**:)"
flags: "im"
---
