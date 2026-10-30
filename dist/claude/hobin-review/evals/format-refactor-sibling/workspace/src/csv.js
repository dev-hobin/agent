import { formatAmount } from './format.js';

// Export consumed by the accounting import, which splits lines on commas.
export function toCsv(rows) {
  const lines = rows.map(({ id, cents }) => `${id},${formatAmount(cents)}`);
  return ['id,amount', ...lines].join('\n');
}
