---
type: regex
target: { source: file, path: SCENARIO_CHECK.txt }
pattern: "^pass hidden-tests$"
flags: m
---
Run by the eval verify plugin (verify/) when the run stops: the core scenario's `hidden-tests` check.
