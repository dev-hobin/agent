---
type: regex
target: { source: file, path: SCENARIO_CHECK.txt }
pattern: "^pass report-format$"
flags: m
---
Run by the eval verify plugin (verify/) when the run stops: the core scenario's `report-format` check.
