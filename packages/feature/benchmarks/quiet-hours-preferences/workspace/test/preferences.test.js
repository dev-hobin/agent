import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePreferences, setQuietHours } from '../src/preferences.js';
import { deliveryMinute } from '../src/schedule.js';

const at = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));

test('a v1 record is read in the v2 shape', () => {
  const prefs = parsePreferences({ version: 1, email: true, sms: false });
  assert.equal(prefs.version, 2);
  assert.deepEqual(prefs.channels, { email: true, sms: false });
  assert.equal(prefs.quietHours, null);
});

test('an overnight window defers to its end', () => {
  const prefs = setQuietHours(parsePreferences({ version: 1, email: true }), { start: '22:00', end: '07:00' });
  assert.equal(deliveryMinute(prefs, at('23:30')), at('07:00'));
  assert.equal(deliveryMinute(prefs, at('03:00')), at('07:00'));
  assert.equal(deliveryMinute(prefs, at('12:00')), at('12:00'));
});

test('start is quiet, end is not', () => {
  const prefs = setQuietHours(parsePreferences({ version: 1 }), { start: '13:00', end: '14:00' });
  assert.equal(deliveryMinute(prefs, at('13:00')), at('14:00'));
  assert.equal(deliveryMinute(prefs, at('14:00')), at('14:00'));
});
