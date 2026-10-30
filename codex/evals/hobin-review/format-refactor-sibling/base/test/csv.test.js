import test from 'node:test';
import assert from 'node:assert/strict';
import { toCsv } from '../src/csv.js';

test('toCsv writes one line per row', () => {
  assert.equal(toCsv([{ id: 'a', cents: 1999 }]), 'id,amount\na,19.99');
});
