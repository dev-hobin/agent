import test from 'node:test';
import assert from 'node:assert/strict';
import { formatAmount, formatSigned } from '../src/format.js';

test('formatAmount pads cents', () => {
  assert.equal(formatAmount(5), '0.05');
});

test('formatAmount keeps large amounts machine-readable', () => {
  assert.equal(formatAmount(123450), '1234.50');
});

test('formatSigned marks credits with a plus sign', () => {
  assert.equal(formatSigned(1250), '+12.50');
});
