// In-memory template store. Records persist across schema versions.
export function createStore(records = []) {
  const byId = new Map(records.map((r) => [r.id, r]));
  return {
    get: (id) => byId.get(id),
    put: (record) => void byId.set(record.id, record),
    remove: (id) => void byId.delete(id),
    list: () => [...byId.values()],
  };
}
