import test from 'node:test';
import assert from 'node:assert/strict';
import { toCents, formatCents } from '../src/money.js';
import { subtotalCents, shippingCents } from '../src/cart.js';
import { memberPriceCents, couponCents } from '../src/discount.js';

test('toCents parses decimal prices exactly', () => {
  assert.equal(toCents('19.99'), 1999);
  assert.equal(toCents('0.5'), 50);
  assert.equal(toCents(7), 700);
  assert.throws(() => toCents('1.999'));
});

test('formatCents', () => {
  assert.equal(formatCents(5), '0.05');
  assert.equal(formatCents(123456), '1234.56');
});

test('cart subtotal and shipping', () => {
  const items = [{ sku: 'a', price: '19.99', qty: 2 }, { sku: 'b', price: '5.00', qty: 1 }];
  assert.equal(subtotalCents(items), 4498);
  assert.equal(shippingCents(items), 499);
});

test('member price and coupon', () => {
  assert.equal(memberPriceCents({ price: '20.00' }), 1800);
  assert.equal(couponCents(1000, { amount: '15.00' }), 1000);
});
