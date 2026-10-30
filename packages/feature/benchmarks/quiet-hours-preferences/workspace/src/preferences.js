export function parsePreferences(raw) {
  if (raw.version === 2) return { ...raw };
  // v1 -> v2
  return {
    version: 2,
    channels: { email: Boolean(raw.email), sms: Boolean(raw.sms) },
    quietHours: null,
  };
}

export function serializePreferences(prefs) {
  return { ...prefs };
}

export function setQuietHours(prefs, { start, end }) {
  throw new Error('not implemented');
}
