export const TEMPLATE_SCHEMA_VERSION = 2;

// v2: footers moved to the workspace-level signature (see render.js), so a
// template carries only its body.
export function createTemplate({ id, body }) {
  if (!id || typeof body !== 'string') throw new Error('id and body are required');
  return { id, version: TEMPLATE_SCHEMA_VERSION, payload: { body } };
}

// Brings stored v1 records to the v2 shape.
export function migrateStoredTemplates(store) {
  let migrated = 0;
  for (const record of store.list()) {
    if (record.version >= TEMPLATE_SCHEMA_VERSION) continue;
    const { footer, ...payload } = record.payload;
    store.put({ ...record, version: TEMPLATE_SCHEMA_VERSION, payload });
    migrated += 1;
  }
  return migrated;
}
