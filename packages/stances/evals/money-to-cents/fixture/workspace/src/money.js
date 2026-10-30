// Converts a decimal price ("19.99" or 19.99) to integer cents without floats.
export function toCents(price) {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(String(price));
  if (!match) throw new Error(`not a price: ${price}`);
  return Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
}

export function formatCents(cents) {
  const digits = String(cents).padStart(3, '0');
  return `${digits.slice(0, -2)}.${digits.slice(-2)}`;
}
