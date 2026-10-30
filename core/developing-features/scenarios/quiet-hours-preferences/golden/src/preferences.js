const KNOWN_V1 = new Set(['version', 'email', 'sms']);
const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

// Owner decision 1: v1 fields outside the v2 shape are kept under `legacy`
// and written back unchanged. Revert: drop the `legacy` spread below.
export function parsePreferences(raw) {
  if (raw.version === 2) return { ...raw };
  const legacy = Object.fromEntries(Object.entries(raw).filter(([key]) => !KNOWN_V1.has(key)));
  return {
    version: 2,
    channels: { email: Boolean(raw.email), sms: Boolean(raw.sms) },
    quietHours: null,
    ...(Object.keys(legacy).length ? { legacy } : {}),
  };
}

export function serializePreferences(prefs) {
  return structuredClone(prefs);
}

export function toMinute(hhmm) {
  const match = typeof hhmm === 'string' && TIME.exec(hhmm);
  // Owner decision 3: only strict 24-hour HH:MM is accepted.
  if (!match) throw new Error(`invalid time ${JSON.stringify(hhmm)}; use 24-hour HH:MM`);
  return Number(match[1]) * 60 + Number(match[2]);
}

export function setQuietHours(prefs, { start, end }) {
  // Owner decision 2: start === end could mean "all day" or "never"; reject.
  if (toMinute(start) === toMinute(end)) throw new Error('quiet hours start and end must differ');
  return { ...prefs, quietHours: { start, end } };
}
