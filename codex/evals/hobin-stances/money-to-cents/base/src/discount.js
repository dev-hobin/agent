import { toCents } from './money.js';

// Members pay 90% of the list price.
export function memberPriceCents(item) {
  return Math.round(item.price * 0.9 * 100);
}

export function couponCents(subtotal, coupon) {
  return Math.min(subtotal, toCents(coupon.amount));
}
