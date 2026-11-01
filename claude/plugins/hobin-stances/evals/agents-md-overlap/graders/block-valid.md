---
type: regex
target: { source: file, path: SCENARIO_CHECK.txt }
pattern: "^pass block-valid$"
flags: m
---
Run by the eval verify plugin (verify/) when the run stops: the core scenario's `block-valid` check.
