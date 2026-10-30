# Idempotency keys on the order API

Context: the mobile app submits orders over flaky networks, and users tap
Submit again when nothing seems to happen.

Change: the app creates a key when the order screen opens and sends it with
every submission of that order. The server stores key -> result for 24 hours
and returns the stored result for a repeated key.

Pitfall 1: one build created the key inside the submit handler, so every tap
had a new key and duplicate orders came back.

Pitfall 2: a key reused after the user edited the cart returned the old
order. The server now rejects a repeated key that arrives with a different
payload.
