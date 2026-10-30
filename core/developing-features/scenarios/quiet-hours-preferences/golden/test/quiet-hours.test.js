import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePreferences, serializePreferences, setQuietHours } from '../src/preferences.js';
import { deliveryMinute } from '../src/schedule.js';

const at = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));
const storedV1 = () => ({ version: 1, email: true, sms: false, dnd: true, theme: 'dark' });

test('S1 a notification inside an overnight window waits for its end', () => {
  const prefs = setQuietHours(parsePreferences(storedV1()), { start: '22:00', end: '07:00' });
  assert.equal(deliveryMinute(prefs, at('23:59')), at('07:00'));
  assert.equal(deliveryMinute(prefs, at('00:00')), at('07:00'));
  assert.equal(deliveryMinute(prefs, at('07:00')), at('07:00'));
  assert.equal(deliveryMinute(prefs, at('21:59')), at('21:59'));
});

test('S2 v1 fields outside the v2 shape survive read, set, and write', () => {
  const prefs = setQuietHours(parsePreferences(storedV1()), { start: '22:00', end: '07:00' });
  const stored = serializePreferences(prefs);
  assert.equal(stored.legacy.dnd, true);
  assert.equal(stored.legacy.theme, 'dark');
  assert.deepEqual(serializePreferences(parsePreferences(stored)).legacy, stored.legacy);
});

test('S3 start equal to end is rejected', () => {
  assert.throws(() => setQuietHours(parsePreferences(storedV1()), { start: '22:00', end: '22:00' }), /must differ/);
});

test('S4 times outside strict 24-hour HH:MM are rejected', () => {
  const prefs = parsePreferences(storedV1());
  for (const time of ['7pm', '24:00', '7:00', '22:60', '', undefined, null]) {
    assert.throws(() => setQuietHours(prefs, { start: time, end: '07:00' }), /HH:MM/, String(time));
  }
});

test('S5 preferences without quiet hours deliver on time', () => {
  assert.equal(deliveryMinute(parsePreferences(storedV1()), at('03:00')), at('03:00'));
});
