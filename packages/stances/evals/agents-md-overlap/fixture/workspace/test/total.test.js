import test from 'node:test';
import assert from 'node:assert/strict';
import { total } from '../src/total.js';

test('total adds values', () => {
  assert.equal(total([1, 2, 3]), 6);
});
