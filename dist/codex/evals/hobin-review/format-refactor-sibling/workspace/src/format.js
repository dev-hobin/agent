// Amounts are integer cents.

const THOUSANDS = /\B(?=(\d{3})+(?!\d))/g;

function splitCents(cents) {
  return { whole: Math.floor(cents / 100), frac: String(cents % 100).padStart(2, '0') };
}

// Display amount for statements, for example 123450 -> "1,234.50".
export function formatAmount(cents) {
  const { whole, frac } = splitCents(cents);
  return `${String(whole).replace(THOUSANDS, ',')}.${frac}`;
}

// Adjustment lines always show a sign: 1250 -> "+12.50", -1250 -> "-12.50".
export function formatSigned(cents) {
  const { whole, frac } = splitCents(cents);
  return `${cents < 0 ? '' : '+'}${whole}.${frac}`;
}
