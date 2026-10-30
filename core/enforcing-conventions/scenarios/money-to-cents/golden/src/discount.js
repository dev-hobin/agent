import { toCents } from './money.js';

// Members pay 90% of the list price.
export function memberPriceCents(item) {
  return Math.round((toCents(item.price) * 9) / 10);
}

export function couponCents(subtotal, coupon) {
  return Math.min(subtotal, toCents(coupon.amount));
}
