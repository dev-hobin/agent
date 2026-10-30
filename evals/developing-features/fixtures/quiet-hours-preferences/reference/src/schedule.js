import { toMinute } from './preferences.js';

export function deliveryMinute(prefs, minute) {
  if (!prefs.quietHours) return minute;
  const start = toMinute(prefs.quietHours.start);
  const end = toMinute(prefs.quietHours.end);
  const quiet = start < end ? minute >= start && minute < end : minute >= start || minute < end;
  return quiet ? end : minute;
}
