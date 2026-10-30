import { toCents } from './money.js';

// items: [{ sku, price: "19.99", qty: 2 }]
export function subtotalCents(items) {
  return Math.round(items.reduce((sum, item) => sum + item.price * item.qty, 0) * 100);
}

export function shippingCents(items) {
  return subtotalCents(items) >= 5000 ? 0 : toCents('4.99');
}
