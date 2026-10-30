// The upstream catalog API answers { rows: [...] } on success. It sometimes
// answers {} when the catalog is empty, so treat a missing list as empty.
export function parseRows(body) {
  return Array.isArray(body?.rows) ? body.rows : [];
}
