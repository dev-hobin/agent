// Amounts are integer cents.

// Display amount for statements, for example 123450 -> "1234.50".
export function formatAmount(cents) {
  const whole = Math.trunc(Math.abs(cents) / 100);
  const frac = String(Math.abs(cents) % 100).padStart(2, '0');
  return `${cents < 0 ? '-' : ''}${whole}.${frac}`;
}

// Adjustment lines always show a sign: 1250 -> "+12.50", -1250 -> "-12.50".
export function formatSigned(cents) {
  return `${cents < 0 ? '-' : '+'}${formatAmount(Math.abs(cents))}`;
}
