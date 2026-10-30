[P1] The existing test "formatAmount keeps large amounts machine-readable" now fails (1,234.50 vs 1234.50) — src/format.js:12
  Scenario: run the full suite → test/format.test.js expects "1234.50" for 123450 and gets "1,234.50".
  Evidence: node --test fails the existing machine-readable test; only the new grouping tests pass.
  Direction: keep machine-readable output for the CSV path and group only for display.
[P1] formatSigned(-1250) now returns -13.-50 through splitCents and has no test — src/format.js:18
  Scenario: an adjustment of -1250 cents → splitCents gives whole -13 and frac "-50" → "-13.-50".
  Evidence: Math.floor(-12.5) is -13 and -1250 % 100 is -50; no test covers negative amounts.
  Direction: split the absolute value and apply the sign once.
[P1] toCsv emits unquoted thousands separators, breaking the comma-split import — src/csv.js:5
  Scenario: a row with 123450 cents → "7,1,234.50" → the import splits it into three fields.
  Evidence: toCsv now calls formatAmount, which groups thousands with commas.
  Direction: use an ungrouped amount in the CSV.

Checked without findings: contract, async-flow
Not checked: the accounting import itself
