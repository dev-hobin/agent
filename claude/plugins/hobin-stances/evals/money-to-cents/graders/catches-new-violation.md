---
type: regex
target: { source: file, path: SCENARIO_CHECK.txt }
pattern: "^pass catches-new-violation$"
flags: m
---
Run by the eval verify plugin (verify/) when the run stops: the core scenario's `catches-new-violation` check.
