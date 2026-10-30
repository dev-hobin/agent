# Portable implementation contract

Pinned: Agent Skills specification @ 69ef37e9424c0a7ea9dd2293b559e43ec8176379
([neutral standards research](../../docs/research/2026-10-30-neutral-standards.md)).

A plain Agent Skills directory with specification fields only, for hosts without a
dedicated implementation (for example Pi, Cursor, Gemini CLI reading `.agents/skills`).
Explicit invocation has no standard field, so it is not expressed; delegation is described
for any host with a sequential fallback.
