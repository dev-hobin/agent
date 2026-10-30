import { formatAmount } from './format.js';

// Export consumed by the accounting import, which splits lines on commas.
export function toCsv(rows) {
  const lines = rows.map((row) => `${row.id},${formatAmount(row.cents)}`);
  return ['id,amount', ...lines].join('\n');
}
