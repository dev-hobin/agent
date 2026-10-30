# Quiet hours for notification preferences

Users can set quiet hours. A notification that would be delivered during
quiet hours is deferred to the end of the quiet window.

## Data

Stored preferences are JSON. Version 1 records are still in the database:

    { "version": 1, "email": true, "sms": false, ... }

The version 2 shape adds quiet hours:

    { "version": 2, "channels": { "email": true, "sms": false },
      "quietHours": { "start": "22:00", "end": "07:00" } | null }

## API

`src/preferences.js`

- `parsePreferences(raw)` returns preferences in the v2 shape from a stored
  v1 or v2 record.
- `serializePreferences(prefs)` returns the JSON object to store.
- `setQuietHours(prefs, { start, end })` returns new preferences with quiet
  hours set. Times are `HH:MM`, 24-hour, local time. Invalid input throws.

`src/schedule.js`

- `deliveryMinute(prefs, minute)` takes the minute of the day (0-1439) when a
  notification is due and returns the minute it should be delivered.
  Quiet hours include `start` and exclude `end`; a window may cross midnight.

## Open questions (product owner unavailable this week)

1. Some v1 records contain fields that are not in the v2 shape, such as
   `dnd` from the old mobile app and other keys we have not catalogued.
2. What should happen when `start` equals `end`?
3. Support has seen users type times such as `7pm` or `24:00`.

Make a decision for each, record it, and say how to change it later.
