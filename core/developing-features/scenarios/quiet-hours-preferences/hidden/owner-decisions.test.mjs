import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePreferences, serializePreferences, setQuietHours } from '../src/preferences.js';
import { deliveryMinute } from '../src/schedule.js';

const v1 = () => ({ version: 1, email: true, sms: true, dnd: true, legacyTheme: 'dark' });

test('stored v1 fields outside the v2 shape survive a read/write round trip', () => {
  const stored = JSON.stringify(serializePreferences(parsePreferences(v1())));
  assert.match(stored, /"dnd":true/);
  assert.match(stored, /"legacyTheme":"dark"/);
});

test('stored v1 fields survive setting quiet hours', () => {
  const prefs = setQuietHours(parsePreferences(v1()), { start: '22:00', end: '07:00' });
  const stored = JSON.stringify(serializePreferences(prefs));
  assert.match(stored, /"dnd":true/);
  assert.match(stored, /"legacyTheme":"dark"/);
});

test('start equal to end is rejected as ambiguous', () => {
  assert.throws(() => setQuietHours(parsePreferences(v1()), { start: '22:00', end: '22:00' }));
});

test('times outside strict 24-hour HH:MM are rejected', () => {
  const prefs = parsePreferences(v1());
  for (const [start, end] of [['7pm', '07:00'], ['24:00', '07:00'], ['22:00', '7:00'], ['22:60', '07:00'], ['22:00', undefined]]) {
    assert.throws(() => setQuietHours(prefs, { start, end }), `${start}-${end} should be rejected`);
  }
});

test('a v2 record round-trips with its quiet hours', () => {
  const raw = { version: 2, channels: { email: true, sms: false }, quietHours: { start: '01:00', end: '02:00' } };
  const prefs = parsePreferences(raw);
  assert.equal(deliveryMinute(prefs, 90), 120);
  assert.deepEqual(serializePreferences(prefs).quietHours, raw.quietHours);
});
