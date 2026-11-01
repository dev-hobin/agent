---
tags: [trigger]
runs: 3
max_turns: 3
allowed_tools: [Skill]
---

Implement retries with backoff for the webhook sender. Failed deliveries are retried up to 5 times, and a delivery must never be sent twice.
