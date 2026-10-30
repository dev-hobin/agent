---
type: "regex"
target: { source: "file", path: "out/concept.md" }
pattern: "^(#{1,6} [^\\n]*(counterexample|boundary|near miss)|\\s*[-*]?\\s*\\**[^\\n:]{0,40}(counterexample|boundary|near miss)[^\\n:]{0,20}\\**:)"
flags: "im"
---
