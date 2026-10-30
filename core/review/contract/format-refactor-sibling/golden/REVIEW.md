[P1] The existing test "formatAmount keeps large amounts machine-readable" now fails (1,234.50 vs 1234.50) — test/format.test.js:10
[P1] formatSigned(-1250) now returns -13.-50 through splitCents and has no test — src/format.js:18
[P1] toCsv emits unquoted thousands separators, breaking the comma-split import — src/csv.js:6
