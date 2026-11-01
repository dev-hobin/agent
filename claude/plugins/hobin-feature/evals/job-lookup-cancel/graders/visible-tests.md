---
type: regex
target: { source: file, path: SCENARIO_CHECK.txt }
pattern: "^pass visible-tests$"
flags: m
---
Run by the eval verify plugin (verify/) when the run stops: the core scenario's `visible-tests` check.
