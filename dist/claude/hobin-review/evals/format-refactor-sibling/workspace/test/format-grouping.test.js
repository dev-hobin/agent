import test from 'node:test';
import assert from 'node:assert/strict';
import { formatAmount } from '../src/format.js';

test('formatAmount groups thousands', () => {
  assert.equal(formatAmount(123456789), '1,234,567.89');
});

test('formatAmount leaves small amounts ungrouped', () => {
  assert.equal(formatAmount(99), '0.99');
});
