export const TEMPLATE_SCHEMA_VERSION = 1;

// A template body with {placeholders} and an optional per-template footer
// (for example, legal or opt-out text that differs between templates).
export function createTemplate({ id, body, footer }) {
  if (!id || typeof body !== 'string') throw new Error('id and body are required');
  return { id, version: TEMPLATE_SCHEMA_VERSION, payload: { body, footer: footer ?? null } };
}
