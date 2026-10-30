import { parseRows } from './upstream.js';
import { createTemplate } from './templates.js';

// Mirrors the upstream catalog: removes local templates the catalog no longer
// lists and adds templates that are new upstream.
export async function syncTemplates(store, fetchCatalog) {
  const remote = parseRows(await fetchCatalog());
  const remoteIds = new Set(remote.map((row) => row.id));
  for (const template of store.list()) {
    if (!remoteIds.has(template.id)) store.remove(template.id);
  }
  for (const row of remote) {
    if (!store.get(row.id)) store.put(createTemplate(row));
  }
  return store.list().length;
}
